import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const QUERIES = {
  "DEX / Trading Platform": { title: "DEX Volume by Chain — Last 14 Days", qid: "onkEUygtNeDzDdzwnUw9", sql: "SELECT date(activity_date) AS dt, chain, SUM(total_volume_usd) AS volume_usd, SUM(active_users) AS traders FROM crosschain.metrics.dex_overview WHERE activity_date >= CURRENT_TIMESTAMP - INTERVAL '14 days' GROUP BY ALL ORDER BY dt ASC, volume_usd DESC", chartType: "bar-stacked", xKey: "DT", yKey: "VOLUME_USD", groupKey: "CHAIN", fmt: "currency" },
  "Stablecoin / Payments": { title: "Stablecoin Volume — Last 14 Days", qid: "qdKDGZwrIiiAwBpT3DOX", sql: "SELECT date(activity_date) AS dt, token_symbol, SUM(transfer_volume_usd) AS volume_usd FROM crosschain.metrics.stablecoin_volume WHERE activity_date >= CURRENT_TIMESTAMP - INTERVAL '14 days' AND token_symbol IN ('USDC','USDT','DAI') GROUP BY ALL ORDER BY dt ASC", chartType: "area-stacked", xKey: "DT", yKey: "VOLUME_USD", groupKey: "TOKEN_SYMBOL", fmt: "currency" },
  "Analytics / Research / Investing": { title: "Ethereum Network — Last 30 Days", qid: "G7ApOGnLX9ThQtfplr99", sql: "SELECT date(activity_date) AS dt, active_addresses AS dau, new_addresses, dex_volume_usd, transaction_fees_usd FROM ethereum.metrics.overview WHERE activity_date >= CURRENT_TIMESTAMP - INTERVAL '30 days' ORDER BY dt ASC", chartType: "multi-line", xKey: "DT", lines: [{ key: "DAU", color: "#3b82f6", label: "Active Addresses" }, { key: "NEW_ADDRESSES", color: "#10b981", label: "New Addresses" }], fmt: "number" },
  "L1/L2 Chain / Protocol": { title: "Top DEX Projects — Last 7 Days", qid: "Jj0qKLb3u8xS3XI4S3mF", sql: "SELECT project_name, SUM(total_volume_usd) AS volume_usd, SUM(active_users) AS traders FROM crosschain.metrics.dex_overview WHERE activity_date >= CURRENT_TIMESTAMP - INTERVAL '7 days' AND is_verified = true GROUP BY ALL ORDER BY volume_usd DESC LIMIT 12", chartType: "h-bar", xKey: "PROJECT_NAME", yKey: "VOLUME_USD", fmt: "currency" },
  "Wallet / App Development": { title: "ETH DEX Volume + Fees — Last 30 Days", qid: "4MWh79JHBju30IgyDr9E", sql: "SELECT date(activity_date) AS dt, dex_volume_usd, transaction_fees_usd FROM ethereum.metrics.overview WHERE activity_date >= CURRENT_TIMESTAMP - INTERVAL '30 days' ORDER BY dt ASC", chartType: "multi-line", xKey: "DT", lines: [{ key: "DEX_VOLUME_USD", color: "#3b82f6", label: "DEX Volume" }, { key: "TRANSACTION_FEES_USD", color: "#f59e0b", label: "Fees" }], fmt: "currency" },
  "Fraud Detection / Security": { title: "ETH Tx Success vs Failure — Last 14 Days", qid: "4JjAjStwV5NEZD7uA711", sql: "SELECT date(activity_date) AS dt, success_transactions, failed_transactions FROM ethereum.metrics.overview WHERE activity_date >= CURRENT_TIMESTAMP - INTERVAL '14 days' ORDER BY dt ASC", chartType: "stacked-bars", xKey: "DT", bars: [{ key: "SUCCESS_TRANSACTIONS", color: "#10b981", label: "Success" }, { key: "FAILED_TRANSACTIONS", color: "#ef4444", label: "Failed" }], fmt: "number" },
  "Accounting / Audit / Compliance": { title: "ETH Stablecoin Transfers — Last 30 Days", qid: "ambf8ViR2ISARqyqCK4I", sql: "SELECT date(activity_date) AS dt, usd_stablecoin_transfer_volume_usd AS vol FROM ethereum.metrics.overview WHERE activity_date >= CURRENT_TIMESTAMP - INTERVAL '30 days' ORDER BY dt ASC", chartType: "area", xKey: "DT", yKey: "VOL", fmt: "currency", color: "#10b981" },
  "NFT Platform / Marketplace": { title: "ETH NFT Buyers vs Sellers — Last 30 Days", qid: "ON82Pb2Ld474pyrfHgie", sql: "SELECT date(activity_date) AS dt, nft_buyer_count, nft_seller_count FROM ethereum.metrics.overview WHERE activity_date >= CURRENT_TIMESTAMP - INTERVAL '30 days' ORDER BY dt ASC", chartType: "multi-line", xKey: "DT", lines: [{ key: "NFT_BUYER_COUNT", color: "#3b82f6", label: "Buyers" }, { key: "NFT_SELLER_COUNT", color: "#8b5cf6", label: "Sellers" }], fmt: "number" },
  "AI / Data Agent": { title: "ETH DEX Traders — Last 30 Days", qid: "YxkEPsYl7ZdH9Q7wrnfz", sql: "SELECT date(activity_date) AS dt, dex_trader_count FROM ethereum.metrics.overview WHERE activity_date >= CURRENT_TIMESTAMP - INTERVAL '30 days' ORDER BY dt ASC", chartType: "multi-line", xKey: "DT", lines: [{ key: "DEX_TRADER_COUNT", color: "#3b82f6", label: "DEX Traders" }], fmt: "number" },
};

const KB = {
  products: { explorer: { name: "Allium Explorer", desc: "SQL via Snowflake. ~5s, 80+ chains.", fresh: "~1 hour", doc: "https://docs.allium.so/app/overview" }, datashares: { name: "Allium Datashares", desc: "Data into your Snowflake/BigQuery/Databricks/S3.", fresh: "1-3 hours", doc: "https://docs.allium.so/datashares/overview" }, realtimeAPIs: { name: "Allium Developer APIs", desc: "REST APIs: wallets, prices, tokens, PnL. Sub-5s, 1K+ RPS.", fresh: "3-5s", doc: "https://docs.allium.so/api/developer/overview" }, datastreams: { name: "Allium Datastreams", desc: "Kafka/Pub/Sub/SNS streaming. 80+ chains.", fresh: "3-5s", doc: "https://docs.allium.so/datastreams/overview" }, ai: { name: "Allium AI / MCP", desc: "NL-to-SQL + MCP for AI agents.", doc: "https://docs.allium.so/ai/mcp/overview" } },
  customers: [ { n: "Phantom", u: "Wallet backend, 15M MAUs, 90K RPS" }, { n: "Visa", u: "Stablecoin analytics dashboard" }, { n: "Stripe", u: "Crypto fraud detection" }, { n: "MetaMask", u: "Realtime balances & txns" }, { n: "Coinbase", u: "Enterprise data infra" }, { n: "Grayscale", u: "Market reports" }, { n: "Uniswap Foundation", u: "v4 adoption dashboard" }, { n: "a16z crypto", u: "State of Crypto report" }, { n: "Paradigm", u: "DeFi research" }, { n: "Electric Capital", u: "StablePulse" }, { n: "TaxBit", u: "Tax reporting" }, { n: "Bridge.xyz", u: "Tx monitoring" }, { n: "Wormhole", u: "Sybil detection, saved $100M+" }, { n: "Messari", u: "Market intelligence" }, { n: "Blowfish", u: "Fraud detection" }, { n: "Cube3", u: "AI fraud signals" } ],
  uc: { "Wallet / App Development": { p: ["realtimeAPIs", "datastreams"], sig: ["wallet", "app", "mobile", "portfolio", "balance", "transaction history"], pr: "Phantom, MetaMask, Fomo" }, "DEX / Trading Platform": { p: ["realtimeAPIs", "datashares", "datastreams"], sig: ["dex", "trading", "swap", "liquidity", "amm", "aggregator", "token screener"], pr: "Uniswap Foundation, Fomo" }, "Analytics / Research / Investing": { p: ["explorer", "datashares"], sig: ["research", "analytics", "report", "investment", "fund", "vc", "thesis", "dashboard"], pr: "a16z crypto, Paradigm, Electric Capital, Grayscale, Messari" }, "Accounting / Audit / Compliance": { p: ["datashares", "explorer", "realtimeAPIs"], sig: ["accounting", "audit", "tax", "compliance", "reconciliation", "reporting", "big 4"], pr: "TaxBit, Big 4 firms" }, "Fraud Detection / Security": { p: ["datastreams", "realtimeAPIs", "datashares"], sig: ["fraud", "security", "aml", "kyc", "monitoring", "alert", "risk"], pr: "Stripe, Bridge.xyz, Blowfish, Cube3" }, "Stablecoin / Payments": { p: ["datashares", "explorer", "datastreams"], sig: ["stablecoin", "payments", "usdc", "usdt", "remittance", "settlement", "fiat"], pr: "Visa, Bridge.xyz, Stripe" }, "NFT Platform / Marketplace": { p: ["datashares", "explorer", "realtimeAPIs"], sig: ["nft", "marketplace", "mint", "collection", "gaming"], pr: "Wallet 360" }, "L1/L2 Chain / Protocol": { p: ["datashares", "explorer", "datastreams"], sig: ["chain", "l1", "l2", "protocol", "ecosystem", "rollup", "validator"], pr: "Multiple ecosystems" }, "AI / Data Agent": { p: ["realtimeAPIs", "ai"], sig: ["ai", "agent", "llm", "autonomous", "bot", "copilot", "mcp"], pr: "Cube3, MCP, x402" } }
};

const C = { bg: "#08080d", sf: "#101018", sa: "#16161f", bd: "#1c1c2e", ba: "#3b82f6", tx: "#e2e8f0", tm: "#7c869b", td: "#3e4556", ac: "#3b82f6", ag: "rgba(59,130,246,0.12)", gn: "#10b981", gg: "rgba(16,185,129,0.1)", am: "#f59e0b", rd: "#ef4444", pu: "#8b5cf6", pg: "rgba(139,92,246,0.1)" };
const CC = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1"];
const fv = (v, t) => { if (v == null) return "—"; const n = Number(v); if (isNaN(n)) return String(v); if (t === "currency") { if (n >= 1e12) return "$"+(n/1e12).toFixed(1)+"T"; if (n >= 1e9) return "$"+(n/1e9).toFixed(1)+"B"; if (n >= 1e6) return "$"+(n/1e6).toFixed(1)+"M"; if (n >= 1e3) return "$"+(n/1e3).toFixed(0)+"K"; return "$"+n.toFixed(0); } if (n >= 1e9) return (n/1e9).toFixed(1)+"B"; if (n >= 1e6) return (n/1e6).toFixed(1)+"M"; if (n >= 1e3) return (n/1e3).toFixed(0)+"K"; return n.toLocaleString(); };
const fd = d => { if (!d) return ""; try { return new Date(String(d)).toLocaleDateString("en-US", { month: "short", day: "numeric" }); } catch { return String(d).slice(5, 10); } };

function Spin({ s = 18 }) { return <><div style={{ width: s, height: s, border: "2px solid "+C.bd, borderTopColor: C.ac, borderRadius: "50%", animation: "spin .7s linear infinite" }} /><style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style></>; }
function Bg({ children, color = C.ac }) { return <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 5, fontSize: 10.5, fontWeight: 600, color, background: color+"15", border: "1px solid "+color+"28", lineHeight: "17px" }}>{children}</span>; }
function Sec({ title, icon, children, open: dO = true }) { const [o, setO] = useState(dO); return <div style={{ background: C.sf, border: "1px solid "+C.bd, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}><button onClick={() => setO(!o)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "14px 18px", background: "none", border: "none", color: C.tx, cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", textAlign: "left" }}><span style={{ display: "flex", alignItems: "center", gap: 9 }}><span style={{ fontSize: 17 }}>{icon}</span>{title}</span><span style={{ transform: o ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s", fontSize: 11, color: C.tm }}>▼</span></button>{o && <div style={{ padding: "0 18px 18px", lineHeight: 1.6 }}>{children}</div>}</div>; }
function Code({ code, lang = "sql" }) { const [cp, setCp] = useState(false); return <div style={{ marginTop: 10 }}><div style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", background: "#0b0b12", borderRadius: "8px 8px 0 0", border: "1px solid "+C.bd, borderBottom: "none" }}><span style={{ fontSize: 10, color: C.tm, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em" }}>{lang}</span><button onClick={() => { navigator.clipboard.writeText(code); setCp(true); setTimeout(() => setCp(false), 2e3); }} style={{ background: "none", border: "none", color: cp ? C.gn : C.tm, cursor: "pointer", fontSize: 10.5, fontFamily: "'DM Sans',sans-serif" }}>{cp ? "✓ Copied" : "Copy"}</button></div><pre style={{ margin: 0, padding: 14, background: "#070710", borderRadius: "0 0 8px 8px", border: "1px solid "+C.bd, overflow: "auto", maxHeight: 220, fontSize: 11.5, lineHeight: 1.55, color: "#b8c4d6", fontFamily: "'JetBrains Mono',monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{code}</pre></div>; }
function CTip({ active, payload, label, ft }) { if (!active || !payload?.length) return null; return <div style={{ background: "#13131d", border: "1px solid "+C.bd, borderRadius: 8, padding: "10px 14px", fontSize: 12, boxShadow: "0 8px 32px rgba(0,0,0,.5)" }}><div style={{ color: C.tm, marginBottom: 6, fontSize: 11 }}>{fd(label) || label}</div>{payload.map((p, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.fill }} /><span style={{ color: C.tm }}>{p.name}:</span><span style={{ color: C.tx, fontWeight: 600 }}>{fv(p.value, ft)}</span></div>)}</div>; }

function Viz({ cfg, data, loading, error }) {
  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, gap: 12, background: C.sa, borderRadius: 10, border: "1px solid "+C.bd }}><Spin s={22} /><span style={{ color: C.ac, fontSize: 13 }}>Querying Allium Explorer...</span></div>;
  if (error) return <div style={{ padding: 16, background: C.rd+"08", borderRadius: 10, border: "1px solid "+C.rd+"25", color: C.rd, fontSize: 13 }}>⚠ {error}</div>;
  if (!data?.length || !cfg) return null;
  const ax = { tick: { fill: C.td, fontSize: 10 }, axisLine: { stroke: C.bd } };
  const W = ch => <div style={{ background: C.sa, borderRadius: 10, border: "1px solid "+C.bd, padding: "16px 8px 8px 0" }}><ResponsiveContainer width="100%" height={330}>{ch}</ResponsiveContainer></div>;
  if (cfg.groupKey && (cfg.chartType === "bar-stacked" || cfg.chartType === "area-stacked")) {
    const gs = [...new Set(data.map(r => r[cfg.groupKey]))].slice(0, 8);
    const bx = {}; data.forEach(r => { const x = r[cfg.xKey]; if (!bx[x]) bx[x] = { [cfg.xKey]: x }; bx[x][r[cfg.groupKey]] = Number(r[cfg.yKey]) || 0; });
    const pv = Object.values(bx).sort((a, b) => String(a[cfg.xKey]).localeCompare(String(b[cfg.xKey])));
    if (cfg.chartType === "bar-stacked") return W(<BarChart data={pv}><CartesianGrid strokeDasharray="3 3" stroke={C.bd} /><XAxis dataKey={cfg.xKey} tickFormatter={fd} {...ax} /><YAxis tickFormatter={v => fv(v, cfg.fmt)} {...ax} /><Tooltip content={<CTip ft={cfg.fmt} />} /><Legend wrapperStyle={{ fontSize: 11 }} />{gs.map((g, i) => <Bar key={g} dataKey={g} stackId="a" fill={CC[i % CC.length]} radius={i === gs.length - 1 ? [3, 3, 0, 0] : 0} />)}</BarChart>);
    return W(<AreaChart data={pv}><CartesianGrid strokeDasharray="3 3" stroke={C.bd} /><XAxis dataKey={cfg.xKey} tickFormatter={fd} {...ax} /><YAxis tickFormatter={v => fv(v, cfg.fmt)} {...ax} /><Tooltip content={<CTip ft={cfg.fmt} />} /><Legend wrapperStyle={{ fontSize: 11 }} />{gs.map((g, i) => <Area key={g} type="monotone" dataKey={g} stackId="1" fill={CC[i % CC.length]} fillOpacity={.35} stroke={CC[i % CC.length]} />)}</AreaChart>);
  }
  if (cfg.chartType === "multi-line" && cfg.lines) {
    const d = data.map(r => { const row = { [cfg.xKey]: r[cfg.xKey] }; cfg.lines.forEach(l => { row[l.key] = Number(r[l.key]) || 0; }); return row; });
    return W(<LineChart data={d}><CartesianGrid strokeDasharray="3 3" stroke={C.bd} /><XAxis dataKey={cfg.xKey} tickFormatter={fd} {...ax} /><YAxis tickFormatter={v => fv(v, cfg.fmt)} {...ax} /><Tooltip content={<CTip ft={cfg.fmt} />} /><Legend wrapperStyle={{ fontSize: 11 }} />{cfg.lines.map(l => <Line key={l.key} type="monotone" dataKey={l.key} name={l.label} stroke={l.color} strokeWidth={2} dot={false} />)}</LineChart>);
  }
  if (cfg.chartType === "stacked-bars" && cfg.bars) {
    const d = data.map(r => { const row = { [cfg.xKey]: r[cfg.xKey] }; cfg.bars.forEach(b => { row[b.key] = Number(r[b.key]) || 0; }); return row; });
    return W(<BarChart data={d}><CartesianGrid strokeDasharray="3 3" stroke={C.bd} /><XAxis dataKey={cfg.xKey} tickFormatter={fd} {...ax} /><YAxis tickFormatter={v => fv(v, cfg.fmt)} {...ax} /><Tooltip content={<CTip ft={cfg.fmt} />} /><Legend wrapperStyle={{ fontSize: 11 }} />{cfg.bars.map((b, i) => <Bar key={b.key} dataKey={b.key} name={b.label} stackId="a" fill={b.color} radius={i === cfg.bars.length - 1 ? [3, 3, 0, 0] : 0} />)}</BarChart>);
  }
  if (cfg.chartType === "h-bar") {
    const d = data.map(r => ({ name: r[cfg.xKey], value: Number(r[cfg.yKey]) || 0 })).slice(0, 12);
    return <div style={{ background: C.sa, borderRadius: 10, border: "1px solid "+C.bd, padding: "16px 8px 8px 0" }}><ResponsiveContainer width="100%" height={Math.max(330, d.length * 36)}><BarChart data={d} layout="vertical" margin={{ left: 80 }}><CartesianGrid strokeDasharray="3 3" stroke={C.bd} /><XAxis type="number" tickFormatter={v => fv(v, cfg.fmt)} {...ax} /><YAxis type="category" dataKey="name" {...ax} width={90} /><Tooltip content={<CTip ft={cfg.fmt} />} /><Bar dataKey="value" fill={C.ac} radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>;
  }
  if (cfg.chartType === "area") {
    const d = data.map(r => ({ [cfg.xKey]: r[cfg.xKey], [cfg.yKey]: Number(r[cfg.yKey]) || 0 }));
    return W(<AreaChart data={d}><CartesianGrid strokeDasharray="3 3" stroke={C.bd} /><XAxis dataKey={cfg.xKey} tickFormatter={fd} {...ax} /><YAxis tickFormatter={v => fv(v, cfg.fmt)} {...ax} /><Tooltip content={<CTip ft={cfg.fmt} />} /><Area type="monotone" dataKey={cfg.yKey} fill={cfg.color || C.ac} fillOpacity={.2} stroke={cfg.color || C.ac} strokeWidth={2} /></AreaChart>);
  }
  const cols = Object.keys(data[0]).slice(0, 6);
  return <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid "+C.bd }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><thead><tr>{cols.map(c => <th key={c} style={{ padding: "8px 12px", background: C.sa, color: C.tm, fontWeight: 600, textAlign: "left", borderBottom: "1px solid "+C.bd, fontSize: 10, textTransform: "uppercase" }}>{c}</th>)}</tr></thead><tbody>{data.slice(0, 20).map((r, i) => <tr key={i}>{cols.map(c => <td key={c} style={{ padding: "6px 12px", borderBottom: "1px solid "+C.bd+"08", color: C.tx }}>{typeof r[c] === "number" ? fv(r[c]) : String(r[c] ?? "")}</td>)}</tr>)}</tbody></table></div>;
}

function matchUC(t) { const s = t.toLowerCase(); const m = []; for (const [k, v] of Object.entries(KB.uc)) { const sc = v.sig.reduce((a, x) => a + (s.includes(x) ? 1 : 0), 0); if (sc > 0) m.push({ cat: k, ...v, sc }); } m.sort((a, b) => b.sc - a.sc); return m.length ? m : [{ cat: "Analytics / Research / Investing", ...KB.uc["Analytics / Research / Investing"], sc: 0 }]; }
function pickP(ucs) { const s = new Set(); ucs.forEach(u => u.p.forEach(x => s.add(x))); return [...s].map(k => KB.products[k]).filter(Boolean); }
function findC(ucs) { const ps = ucs.map(u => u.pr).filter(Boolean); const seen = new Set(); const r = []; ps.forEach(p => KB.customers.forEach(c => { if (p.includes(c.n) && !seen.has(c.n)) { seen.add(c.n); r.push(c); } })); return r.length ? r : KB.customers.slice(0, 4); }

function extractData(resp) {
  if (!resp?.content) return null;
  for (const b of resp.content) {
    if (b.type === "mcp_tool_result") {
      const t = b.content?.[0]?.text || "";
      try { const p = JSON.parse(t); if (p.data && Array.isArray(p.data)) return p.data; if (Array.isArray(p)) return p; } catch {}
    }
  }
  const txt = resp.content.filter(b => b.type === "text").map(b => b.text).join("\n");
  const m1 = txt.match(/\[[\s\S]*\]/);
  if (m1) try { const p = JSON.parse(m1[0]); if (Array.isArray(p) && p.length) return p; } catch {}
  try { const p = JSON.parse(txt.replace(/```(?:json)?\n?/g, "").trim()); if (Array.isArray(p)) return p; if (p?.data) return p.data; } catch {}
  return null;
}

export default function App() {
  const [dom, setDom] = useState("");
  const [ld, setLd] = useState(false);
  const [ph, setPh] = useState("");
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [vl, setVl] = useState(false);
  const [vd, setVd] = useState(null);
  const [ve, setVe] = useState(null);
  const [vq, setVq] = useState(null);
  const iRef = useRef(null);
  useEffect(() => { iRef.current?.focus(); }, []);

  async function ai(sys, usr) {
    const r = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: sys + " Do not use citation tags or XML markup in your response.", messages: [{ role: "user", content: usr }], tools: [{ type: "web_search_20250305", name: "web_search" }] }) });
    if (!r.ok) { const t = await r.text(); console.error("API error:", r.status, t); return ""; }
    const d = await r.json();
    const raw = d.content?.filter(b => b.type === "text").map(b => b.text).join("\n") || "";
    console.log("AI raw response:", raw.slice(0, 200));
    return raw.replace(/<\/?antml:cite[^>]*>/g, "").replace(/<\/?cite[^>]*>/g, "").trim();
  }

  async function go() {
    if (!dom.trim()) return;
    setLd(true); setErr(null); setRes(null); setVd(null); setVe(null); setVq(null);
    const d = dom.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    try {
      setPh("Researching company...");
      const cr = await ai("Research prospects for Allium blockchain data platform. Return ONLY raw JSON, no markdown fences, no citations, no <cite> tags: {\"name\":\"...\",\"description\":\"...\",\"industry\":\"...\",\"blockchainRelevance\":\"...\",\"products\":[],\"painPoints\":[],\"size\":\"...\",\"keyInsight\":\"...\"}", "Research: " + d + ". Focus on blockchain/crypto data needs.");
      let co; try { co = JSON.parse(cr.replace(/```json\n?|```/g, "").trim()); } catch { co = { name: d, description: cr.slice(0, 300), industry: "Technology", blockchainRelevance: cr, products: [], painPoints: ["Data complexity"], keyInsight: "" }; }
      setPh("Identifying stakeholders...");
      const sr = await ai("Find decision-makers for blockchain data sale. Return ONLY raw JSON array, no markdown, no citations, no <cite> tags: [{\"role\":\"...\",\"name\":\"...\",\"relevance\":\"...\",\"talkingPoints\":[],\"linkedinSearchQuery\":\"...\"}]", "Stakeholders at " + d + " (" + co.name + "), " + co.industry + ". Blockchain: " + co.blockchainRelevance);
      let st; try { st = JSON.parse(sr.replace(/```json\n?|```/g, "").trim()); } catch { st = [{ role: "VP Data", name: "Unknown", relevance: "Owns data infra", talkingPoints: ["Pipeline simplification"], linkedinSearchQuery: '"' + co.name + '" "head of data"' }]; }
      setPh("Building pitch...");
      const ucs = matchUC(JSON.stringify(co)); const prods = pickP(ucs); const cust = findC(ucs);
      const custStr = cust.map(c => c.n + " (" + c.u + ")").join("; ");
      const pr = await ai("Write Allium pitch. Return ONLY raw JSON, no markdown. Format: {\"headline\":\"...\",\"valueProps\":[{\"title\":\"...\",\"detail\":\"...\"}],\"competitiveEdge\":\"...\"}", "Company: " + co.name + ", " + d + ", " + co.description + ", " + co.industry + ", Blockchain: " + co.blockchainRelevance + ", Pain: " + JSON.stringify(co.painPoints) + ", Use Cases: " + ucs.map(u => u.cat).join(", ") + ", Proof: " + custStr + ", Products: " + prods.map(p => p.name).join(", "));
      let pitch; try { pitch = JSON.parse(pr.replace(/```json\n?|```/g, "").trim()); } catch { pitch = { headline: co.name + " needs blockchain data", valueProps: [{ title: "Unified data", detail: "One platform for 130+ chains." }], competitiveEdge: "Trusted by Visa, Stripe, Coinbase." }; }
      const topUC = ucs[0]?.cat || "blockchain data";
      const topProds = prods.slice(0, 2).map(p => p.name).join(" and ");
      const topCust = cust.slice(0, 3).map(c => c.n).join(", ");
      const pain = (co.painPoints || [])[0] || "managing blockchain data at scale";
      pitch.openingEmail = "Hi there,\n\nI came across " + co.name + " and was impressed by what you're building in " + co.industry + ". Given your work in " + (co.blockchainRelevance ? co.blockchainRelevance.slice(0, 120) : "the blockchain space") + ", I wanted to reach out.\n\nAt Allium, we provide the data infrastructure behind companies like " + topCust + " \u2014 covering 130+ blockchains with sub-second freshness. I noticed " + co.name + " likely faces challenges around " + pain + ", which is exactly what our " + topProds + " are built to solve.\n\nOur platform powers " + topUC.toLowerCase() + " use cases for teams ranging from startups to enterprises like Visa and Stripe. " + (pitch.competitiveEdge || "We'd love to show you what's possible.") + "\n\nWould you be open to a 15-minute call this week? Happy to run a live demo with your specific chains and data needs.\n\nBest,\n[Your Name]\nAllium \u2014 allium.so";
      setRes({ co, st: Array.isArray(st) ? st : [st], ucs, prods, cust, pitch, d });
    } catch (e) { setErr(e.message); } finally { setLd(false); setPh(""); }
  }

  async function runViz(cat) {
    const q = QUERIES[cat]; if (!q) return;
    setVl(true); setVe(null); setVd(null); setVq(q);
    try {
      const r = await fetch("/api/allium", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query_id: q.qid }) });
      const j = await r.json();
      if (j.error) { setVe(j.error); return; }
      const rows = j.data || j;
      if (Array.isArray(rows) && rows.length) { setVd(rows.map(row => { const nr = {}; for (const [k, v] of Object.entries(row)) nr[k.toUpperCase()] = v; return nr; })); }
      else setVe("No data returned. Try another query.");
    } catch (e) { setVe(e.message); } finally { setVl(false); }
  }

  const R = res;
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.tx, fontFamily: "'DM Sans',-apple-system,sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{"*{box-sizing:border-box}::selection{background:"+C.ac+"40}input::placeholder{color:"+C.td+"}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:"+C.bd+";border-radius:3px}@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}.fu{animation:fadeUp .35s ease-out forwards}"}</style>
      <div style={{ padding: "20px 28px", borderBottom: "1px solid "+C.bd, display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(180deg,"+C.sf+" 0%,"+C.bg+" 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,"+C.ac+","+C.pu+")", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, color: "#fff" }}>A</div>
          <div><div style={{ fontSize: 15, fontWeight: 700 }}>Allium Sales Intelligence</div><div style={{ fontSize: 10.5, color: C.tm }}>Research → Match → Pitch → Live Charts</div></div>
        </div>
        <div style={{ display: "flex", gap: 6 }}><Bg color={C.gn}>130+ Chains</Bg><Bg color={C.pu}>18 Logos</Bg><Bg color={C.am}>Live Viz</Bg></div>
      </div>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "28px 20px" }}>
        <div style={{ background: C.sf, border: "1px solid "+C.bd, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.tm, marginBottom: 10, letterSpacing: ".05em", textTransform: "uppercase" }}>Prospect Domain</div>
          <div style={{ display: "flex", gap: 10 }}>
            <input ref={iRef} value={dom} onChange={e => setDom(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} placeholder="e.g. phantom.app, bridge.xyz, stripe.com..." style={{ flex: 1, padding: "12px 16px", background: C.bg, border: "1px solid "+C.bd, borderRadius: 9, color: C.tx, fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none" }} onFocus={e => e.target.style.borderColor = C.ba} onBlur={e => e.target.style.borderColor = C.bd} />
            <button onClick={go} disabled={ld || !dom.trim()} style={{ padding: "12px 24px", background: ld ? C.bd : "linear-gradient(135deg,"+C.ac+",#2563eb)", border: "none", borderRadius: 9, color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", cursor: ld ? "not-allowed" : "pointer", opacity: !dom.trim() ? .5 : 1, whiteSpace: "nowrap" }}>{ld ? "Researching..." : "Research →"}</button>
          </div>
          {ld && <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.ag, borderRadius: 7, border: "1px solid "+C.ac+"20" }}><Spin /><span style={{ fontSize: 12, color: C.ac, fontWeight: 500, animation: "pulse 2s infinite" }}>{ph}</span></div>}
          {err && <div style={{ marginTop: 14, padding: "10px 14px", background: C.rd+"10", borderRadius: 7, border: "1px solid "+C.rd+"25", color: C.rd, fontSize: 12 }}>{err}</div>}
        </div>

        {R && <div className="fu">
          <Sec title={(R.co.name || R.d) + " — Overview"} icon="🏢">
            <p style={{ margin: "0 0 12px", color: C.tx, fontSize: 13.5 }}>{R.co.description}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ padding: 10, background: C.bg, borderRadius: 7, border: "1px solid "+C.bd }}><div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".08em", color: C.td, marginBottom: 3 }}>Industry</div><div style={{ color: C.tx, fontWeight: 500, fontSize: 13 }}>{R.co.industry || "—"}</div></div>
              <div style={{ padding: 10, background: C.bg, borderRadius: 7, border: "1px solid "+C.bd }}><div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".08em", color: C.td, marginBottom: 3 }}>Size</div><div style={{ color: C.tx, fontWeight: 500, fontSize: 13 }}>{R.co.size || "—"}</div></div>
            </div>
            {R.co.blockchainRelevance && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10.5, textTransform: "uppercase", color: C.ac, marginBottom: 5, fontWeight: 600 }}>Blockchain Relevance</div><div style={{ color: C.tx, fontSize: 13 }}>{R.co.blockchainRelevance}</div></div>}
            {R.co.painPoints?.length > 0 && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10.5, textTransform: "uppercase", color: C.am, marginBottom: 6, fontWeight: 600 }}>Pain Points</div>{R.co.painPoints.map((p, i) => <div key={i} style={{ display: "flex", gap: 7, marginBottom: 5, fontSize: 13, color: C.tx }}><span style={{ color: C.am }}>⚠</span>{p}</div>)}</div>}
            {R.co.keyInsight && <div style={{ padding: 12, background: C.pg, borderRadius: 7, border: "1px solid "+C.pu+"28" }}><div style={{ fontSize: 10.5, textTransform: "uppercase", color: C.pu, marginBottom: 3, fontWeight: 600 }}>Key Insight</div><div style={{ color: C.tx, fontSize: 13 }}>{R.co.keyInsight}</div></div>}
          </Sec>
          <Sec title="Personalized Pitch" icon="🎯">
            {R.pitch.headline && <div style={{ fontSize: 17, fontWeight: 700, color: C.tx, marginBottom: 18, lineHeight: 1.3, paddingBottom: 14, borderBottom: "1px solid "+C.bd }}>{'"'+R.pitch.headline+'"'}</div>}
            {R.pitch.valueProps?.map((v, i) => <div key={i} style={{ padding: 14, background: C.bg, borderRadius: 9, border: "1px solid "+C.bd, marginBottom: 8 }}><div style={{ fontWeight: 600, color: C.gn, fontSize: 13.5, marginBottom: 5 }}>{v.title}</div><div style={{ fontSize: 12.5, color: C.tm, lineHeight: 1.6 }}>{v.detail}</div></div>)}
            {R.pitch.competitiveEdge && <div style={{ padding: 12, background: C.ag, borderRadius: 7, border: "1px solid "+C.ac+"28", marginTop: 10 }}><div style={{ fontSize: 10.5, textTransform: "uppercase", color: C.ac, marginBottom: 3, fontWeight: 600 }}>Competitive Edge</div><div style={{ color: C.tx, fontSize: 12.5 }}>{R.pitch.competitiveEdge}</div></div>}
          </Sec>
          <Sec title="Use Cases & Products" icon="🔗">
            <div style={{ marginBottom: 14 }}><div style={{ fontSize: 10.5, textTransform: "uppercase", color: C.td, marginBottom: 8, fontWeight: 600 }}>Matched</div><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{R.ucs.map((u, i) => <Bg key={i} color={i === 0 ? C.gn : i === 1 ? C.ac : C.tm}>{u.cat} ({u.sc})</Bg>)}</div></div>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", color: C.td, marginBottom: 8, fontWeight: 600 }}>Products</div>
            {R.prods.map((p, i) => <div key={i} style={{ padding: 12, background: C.bg, borderRadius: 9, border: "1px solid "+C.bd, marginBottom: 7 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}><span style={{ fontWeight: 600, color: C.tx, fontSize: 13.5 }}>{p.name}</span>{p.fresh && <Bg color={C.gn}>{p.fresh}</Bg>}</div><div style={{ fontSize: 12, color: C.tm, marginBottom: 6 }}>{p.desc}</div><a href={p.doc} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: C.ac, textDecoration: "none" }}>Docs →</a></div>)}
          </Sec>
          <Sec title="Social Proof" icon="🏆">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{R.cust.map((c, i) => <div key={i} style={{ padding: 12, background: C.bg, borderRadius: 9, border: "1px solid "+C.bd }}><div style={{ fontWeight: 600, color: C.tx, fontSize: 13.5, marginBottom: 3 }}>{c.n}</div><div style={{ fontSize: 11.5, color: C.tm }}>{c.u}</div></div>)}</div>
          </Sec>
          <Sec title="Key Stakeholders" icon="👥">
            {R.st.map((s, i) => <div key={i} style={{ padding: 14, background: C.bg, borderRadius: 9, border: "1px solid "+C.bd, marginBottom: 8 }}>
              <div style={{ fontWeight: 600, color: C.tx, fontSize: 13.5 }}>{s.name && s.name !== "Unknown" ? s.name + " — " : ""}<span style={{ color: C.tm }}>{s.role}</span></div>
              <div style={{ fontSize: 12, color: C.ac, marginTop: 2, marginBottom: 8 }}>{s.relevance}</div>
              {s.talkingPoints?.map((t, j) => <div key={j} style={{ display: "flex", gap: 7, marginBottom: 3, fontSize: 12, color: C.tm }}><span style={{ color: C.gn }}>→</span>{t}</div>)}
              {s.linkedinSearchQuery && <a href={"https://www.linkedin.com/search/results/people/?keywords=" + encodeURIComponent(s.linkedinSearchQuery)} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8, fontSize: 11, color: C.ac, textDecoration: "none", padding: "3px 9px", borderRadius: 5, border: "1px solid "+C.ac+"28", background: C.ag }}>Find on LinkedIn</a>}
            </div>)}
          </Sec>

          <Sec title="⚡ Live Data Visualization" icon="📊">
            <div style={{ fontSize: 13, color: C.tm, marginBottom: 14 }}>Run a <strong style={{ color: C.tx }}>real query against Allium Explorer</strong> — live blockchain data for your demo.</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
              {[...new Set([...R.ucs.slice(0, 3).map(u => u.cat), "DEX / Trading Platform", "Stablecoin / Payments", "Analytics / Research / Investing"])].slice(0, 6).map((cat, i) => {
                const q = QUERIES[cat]; if (!q) return null;
                const on = vq?.title === q.title;
                return <button key={cat} onClick={() => runViz(cat)} disabled={vl} style={{ padding: "8px 14px", background: on ? C.ag : C.bg, border: "1px solid "+(on ? C.ac : C.bd), borderRadius: 8, color: on ? C.ac : C.tm, fontSize: 11.5, fontWeight: 500, fontFamily: "'DM Sans',sans-serif", cursor: vl ? "not-allowed" : "pointer", transition: "all .2s" }}>{i === 0 ? "★ " : ""}{q.title}</button>;
              })}
            </div>
            {(vl || vd || ve) && <div style={{ marginBottom: 16 }}>
              {vq && <div style={{ fontSize: 15, fontWeight: 600, color: C.tx, marginBottom: 10 }}>{vq.title}</div>}
              <Viz cfg={vq} data={vd} loading={vl} error={ve} />
              {vd && <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}><Bg color={C.gn}>{"✓ " + vd.length + " rows"}</Bg><span style={{ fontSize: 11, color: C.td }}>Live from Allium Explorer</span></div>}
            </div>}
            {vq && <><Code code={vq.sql} /><div style={{ marginTop: 12, padding: 12, background: C.gg, borderRadius: 7, border: "1px solid "+C.gn+"28", fontSize: 12, color: C.tm }}><strong style={{ color: C.gn }}>Demo Tip:</strong> Run this live on a call. Customize with their chains/tokens/protocols.</div></>}
            {!vq && !vl && <div style={{ padding: 24, textAlign: "center", background: C.sa, borderRadius: 10, border: "1px solid "+C.bd }}><div style={{ fontSize: 28, marginBottom: 8 }}>📊</div><div style={{ fontSize: 13, color: C.tm }}>Click a query above to visualize live Allium data</div></div>}
          </Sec>

          <Sec title="Draft Cold Email" icon="✉️">
            <div style={{ padding: 18, background: C.bg, borderRadius: 9, border: "1px solid "+C.bd, fontSize: 13, color: C.tx, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{R.pitch.openingEmail}</div>
          </Sec>
          <Sec title="Reference Links" icon="📚" open={false}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              {[["Docs", "https://docs.allium.so"], ["Products", "https://docs.allium.so/product-comparison"], ["Dev APIs", "https://docs.allium.so/api/developer/overview"], ["Datashares", "https://docs.allium.so/datashares/overview"], ["Datastreams", "https://docs.allium.so/datastreams/overview"], ["DEX Trades", "https://docs.allium.so/historical-data/dex-trades"], ["Balances", "https://docs.allium.so/historical-data/balances"], ["Wallet 360", "https://docs.allium.so/historical-data/wallet-360"], ["PnL", "https://docs.allium.so/historical-data/pnl"], ["Identity", "https://docs.allium.so/historical-data/identity"], ["Chains", "https://docs.allium.so/historical-data/supported-blockchains/evm"], ["AI/MCP", "https://docs.allium.so/ai/mcp/overview"], ["Analytics", "https://docs.allium.so/use-cases/analytics"], ["Apps", "https://docs.allium.so/use-cases/applications"], ["Accounting", "https://docs.allium.so/use-cases/accounting"], ["Showroom", "https://showroom.allium.so"]].map(([l, u], i) => <a key={i} href={u} target="_blank" rel="noreferrer" style={{ display: "block", padding: "9px 12px", background: C.bg, borderRadius: 7, border: "1px solid "+C.bd, color: C.ac, textDecoration: "none", fontSize: 12 }}>{l}</a>)}
            </div>
          </Sec>
        </div>}

        {!R && !ld && <div style={{ textAlign: "center", padding: "50px 0" }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>🎯</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: C.tx, marginBottom: 7 }}>Enter a prospect domain to begin</div>
          <div style={{ fontSize: 12.5, color: C.tm, lineHeight: 1.6, maxWidth: 460, margin: "0 auto" }}>AI research → use case matching → stakeholder ID → pitch → <strong style={{ color: C.ac }}>live data charts</strong></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", marginTop: 22 }}>
            {["phantom.app", "bridge.xyz", "taxbit.com", "grayscale.com", "electric.capital"].map(d => <button key={d} onClick={() => setDom(d)} style={{ padding: "7px 14px", background: C.sf, border: "1px solid "+C.bd, borderRadius: 7, color: C.tm, fontSize: 12, fontFamily: "'DM Sans',sans-serif", cursor: "pointer" }} onMouseOver={e => { e.target.style.borderColor = C.ac; e.target.style.color = C.ac; }} onMouseOut={e => { e.target.style.borderColor = C.bd; e.target.style.color = C.tm; }}>{d}</button>)}
          </div>
        </div>}
      </div>
    </div>
  );
}
