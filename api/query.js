// Vercel Serverless Function — Allium Explorer: create → run-async → poll → results

export const config = {
  maxDuration: 60,
};

const BASE = "https://api.allium.so/api/v1/explorer";

async function alliumFetch(url, opts, apiKey) {
  const headers = { "X-API-KEY": apiKey, ...opts.headers };
  const r = await fetch(url, { ...opts, headers });
  const text = await r.text();
  return { status: r.status, ok: r.ok, text, json: () => { try { return JSON.parse(text); } catch { return null; } } };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ALLIUM_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ALLIUM_API_KEY not set" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const sql = body.sql;
    if (!sql) return res.status(400).json({ error: "Missing sql field" });

    // Step 1: Create query
    const step1 = await alliumFetch(BASE + "/queries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "st-" + Date.now(), config: { sql, limit: 500 } }),
    }, apiKey);

    if (!step1.ok) {
      return res.status(500).json({ error: "Step 1 create failed", status: step1.status, detail: step1.text.slice(0, 300) });
    }

    const queryId = step1.json()?.query_id;
    if (!queryId) return res.status(500).json({ error: "No query_id", raw: step1.text.slice(0, 300) });

    // Step 2: Run async
    const step2 = await alliumFetch(BASE + "/queries/" + queryId + "/run-async", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parameters: {} }),
    }, apiKey);

    if (!step2.ok) {
      return res.status(500).json({ error: "Step 2 run failed", status: step2.status, detail: step2.text.slice(0, 300) });
    }

    const runId = step2.json()?.run_id;
    if (!runId) return res.status(500).json({ error: "No run_id", raw: step2.text.slice(0, 300) });

    // Step 3: Poll
    const deadline = Date.now() + 50000;
    let status = "created";
    while (Date.now() < deadline && !["success", "failed", "error", "canceled"].includes(status)) {
      await new Promise(r => setTimeout(r, 2000));
      const step3 = await alliumFetch(BASE + "/query-runs/" + runId + "/status", { method: "GET" }, apiKey);
      if (step3.ok) {
        status = step3.json()?.status || status;
        if (status === "failed" || status === "error") {
          return res.status(500).json({ error: "Query failed", detail: step3.text.slice(0, 300) });
        }
      }
    }

    if (status !== "success") {
      return res.status(504).json({ error: "Timed out, last status: " + status });
    }

    // Step 4: Results
    const step4 = await alliumFetch(BASE + "/query-runs/" + runId + "/results?f=json", { method: "GET" }, apiKey);
    if (!step4.ok) {
      return res.status(500).json({ error: "Step 4 results failed", status: step4.status, detail: step4.text.slice(0, 300) });
    }

    return res.status(200).json(step4.json());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
