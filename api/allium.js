// Vercel Serverless Function — runs pre-saved Allium queries by ID
// Uses: POST /queries/{id}/run-async → poll status → GET results

export const config = {
  maxDuration: 60,
};

const BASE = "https://api.allium.so/api/v1/explorer";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ALLIUM_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ALLIUM_API_KEY not set in Vercel Environment Variables" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const queryId = body.query_id;
    if (!queryId) return res.status(400).json({ error: "Missing query_id" });

    // Step 1: Trigger query run
    const runRes = await fetch(BASE + "/queries/" + queryId + "/run-async", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({}),
    });

    if (!runRes.ok) {
      const err = await runRes.text();
      return res.status(runRes.status).json({ error: "Run failed: " + err });
    }

    const runData = await runRes.json();
    const runId = runData.run_id;
    if (!runId) return res.status(500).json({ error: "No run_id returned", raw: runData });

    // Step 2: Poll for completion
    const deadline = Date.now() + 50000;
    let status = "running";
    while (Date.now() < deadline && status === "running") {
      await new Promise(r => setTimeout(r, 2000));
      const sRes = await fetch(BASE + "/query-runs/" + runId + "/status", {
        headers: { "X-API-Key": apiKey },
      });
      if (sRes.ok) {
        const sData = await sRes.json();
        status = sData.status;
        if (status === "failed") {
          return res.status(500).json({ error: "Query failed: " + (sData.error || "Unknown error") });
        }
      }
    }

    if (status !== "success") {
      return res.status(504).json({ error: "Query timed out" });
    }

    // Step 3: Fetch results
    const resultRes = await fetch(BASE + "/query-runs/" + runId + "/results?f=json", {
      headers: { "X-API-Key": apiKey },
    });

    if (!resultRes.ok) {
      const err = await resultRes.text();
      return res.status(500).json({ error: "Fetch results failed: " + err });
    }

    const data = await resultRes.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("Allium error:", err);
    return res.status(500).json({ error: err.message });
  }
}
