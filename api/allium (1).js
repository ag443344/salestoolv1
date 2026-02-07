// Vercel Serverless Function — runs SQL on Allium Explorer API
// Flow: create query → run async → poll status → fetch results

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

  const headers = { "Content-Type": "application/json", "X-API-Key": apiKey };

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const sql = body.sql;
    if (!sql) return res.status(400).json({ error: "Missing sql field" });

    // Step 1: Create a saved query
    const createRes = await fetch(BASE + "/queries", {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "sales-tool-" + Date.now(),
        config: { sql, limit: body.limit || 500 }
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      return res.status(createRes.status).json({ error: "Create query failed: " + err });
    }

    const createData = await createRes.json();
    const queryId = createData.query_id;
    if (!queryId) return res.status(500).json({ error: "No query_id returned" });

    // Step 2: Run the query async
    const runRes = await fetch(BASE + "/queries/" + queryId + "/run-async", {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });

    if (!runRes.ok) {
      const err = await runRes.text();
      return res.status(runRes.status).json({ error: "Run query failed: " + err });
    }

    const runData = await runRes.json();
    const runId = runData.run_id;
    if (!runId) return res.status(500).json({ error: "No run_id returned" });

    // Step 3: Poll for completion
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 1500));

      const statusRes = await fetch(BASE + "/query-runs/" + runId + "/status", {
        headers: { "X-API-Key": apiKey },
      });

      if (!statusRes.ok) continue;
      const statusData = await statusRes.json();

      if (statusData.status === "success") break;
      if (statusData.status === "failed") {
        return res.status(500).json({ error: "Query failed: " + (statusData.error || "Unknown") });
      }
    }

    // Step 4: Fetch results
    const resultRes = await fetch(BASE + "/query-runs/" + runId + "/results?f=json", {
      headers: { "X-API-Key": apiKey },
    });

    if (!resultRes.ok) {
      return res.status(500).json({ error: "Failed to fetch results" });
    }

    const data = await resultRes.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("Allium error:", err);
    return res.status(500).json({ error: err.message });
  }
}
