// Vercel Serverless Function — runs Allium queries via Claude + MCP
// This works because Claude's MCP connection to Allium handles auth

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const sql = body.sql;
    if (!sql) return res.status(400).json({ error: "Missing sql field" });

    // Use Claude with Allium MCP to run the query
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: "You are a data assistant. Use the explorer_run_sql tool to run the SQL query. After getting results, output ONLY the JSON object with the data array. No explanation, no markdown, just the JSON.",
        messages: [{ role: "user", content: "Run this SQL query and return the results:\n\n" + sql }],
        mcp_servers: [{ type: "url", url: "https://mcp-oauth.allium.so", name: "allium-mcp" }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return res.status(claudeRes.status).json({ error: "Claude API error: " + err.slice(0, 300) });
    }

    const claudeData = await claudeRes.json();

    // Extract data from MCP tool results first
    const toolResults = (claudeData.content || []).filter(b => b.type === "mcp_tool_result");
    for (const tr of toolResults) {
      const txt = tr.content && tr.content[0] && tr.content[0].text;
      if (txt) {
        try {
          const parsed = JSON.parse(txt);
          if (parsed.data && Array.isArray(parsed.data)) {
            return res.status(200).json(parsed);
          }
        } catch {}
      }
    }

    // Fallback: try text blocks
    const textBlocks = (claudeData.content || []).filter(b => b.type === "text");
    for (const tb of textBlocks) {
      const text = (tb.text || "").replace(/```json\n?|```/g, "").trim();
      try {
        const parsed = JSON.parse(text);
        if (parsed.data && Array.isArray(parsed.data)) {
          return res.status(200).json(parsed);
        }
        if (Array.isArray(parsed) && parsed.length) {
          return res.status(200).json({ data: parsed });
        }
      } catch {}
    }

    // Return whatever we got for debugging
    return res.status(500).json({
      error: "Could not extract data from response",
      content_types: (claudeData.content || []).map(b => b.type),
    });
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
