// Vercel Serverless Function — runs SQL on Allium Explorer API

export const config = {
  maxDuration: 60,
};

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
    const sql = body.sql;
    if (!sql) return res.status(400).json({ error: "Missing sql field" });

    // Step 1: Submit query
    const runRes = await fetch("https://api.allium.so/api/v1/explorer/queries/run", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ sql, limit: body.limit || 500 }),
    });

    if (!runRes.ok) {
      const err = await runRes.text();
      return res.status(runRes.status).json({ error: "Allium submit failed: " + err });
    }

    const runData = await runRes.json();
    const runId = runData.run_id;

    // If data returned directly
    if (!runId && runData.data) return res.status(200).json(runData);
    if (!runId) return res.status(500).json({ error: "No run_id returned" });

    // Step 2: Poll for completion
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 1500));

      const statusRes = await fetch("https://api.allium.so/api/v1/explorer/query-runs/" + runId + "/status", {
        headers: { "X-API-Key": apiKey },
      });

      if (!statusRes.ok) continue;
      const statusData = await statusRes.json();

      if (statusData.status === "success") break;
      if (statusData.status === "failed") {
        return res.status(500).json({ error: "Query failed: " + (statusData.error || "Unknown") });
      }
    }

    // Step 3: Fetch results
    const resultRes = await fetch("https://api.allium.so/api/v1/explorer/query-runs/" + runId + "/results?f=json", {
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
