export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const API_KEY = process.env.ALLIUM_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: "ALLIUM_API_KEY not set in environment" });

  const { sql } = req.body || {};
  if (!sql) return res.status(400).json({ error: "Missing sql in request body" });

  const BASE = "https://api.allium.so/api/v1/explorer";
  const headers = { "X-API-KEY": API_KEY, "Content-Type": "application/json" };

  try {
    const createRes = await fetch(BASE + "/queries", {
      method: "POST", headers,
      body: JSON.stringify({ title: "st-" + Date.now(), config: { sql, limit: 500 } }),
    });
    if (!createRes.ok) {
      const txt = await createRes.text();
      return res.status(500).json({ error: "Create failed: " + createRes.status, detail: txt });
    }
    const { query_id } = await createRes.json();

    const runRes = await fetch(BASE + "/queries/" + query_id + "/run-async", {
      method: "POST", headers,
      body: JSON.stringify({ parameters: {} }),
    });
    if (!runRes.ok) {
      const txt = await runRes.text();
      return res.status(500).json({ error: "Run failed: " + runRes.status, detail: txt });
    }
    const { run_id } = await runRes.json();

    const maxWait = 50000;
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(BASE + "/query-runs/" + run_id + "/status", { headers });
      if (!statusRes.ok) continue;
      const statusData = await statusRes.json();
      const s = statusData.status || statusData.state;
      if (s === "success" || s === "completed") break;
      if (s === "failed" || s === "error") {
        return res.status(500).json({ error: "Query failed", detail: JSON.stringify(statusData) });
      }
    }

    const resultRes = await fetch(BASE + "/query-runs/" + run_id + "/results?f=json", { headers });
    if (!resultRes.ok) {
      const txt = await resultRes.text();
      return res.status(500).json({ error: "Results fetch failed: " + resultRes.status, detail: txt });
    }
    const resultData = await resultRes.json();
    return res.status(200).json(resultData);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
