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

const DARK = { bg: "#08080d", sf: "#101018", sa: "#16161f", bd: "#1c1c2e", ba: "#3b82f6", tx: "#e2e8f0", tm: "#7c869b", td: "#3e4556", ac: "#3b82f6", ag: "rgba(59,130,246,0.12)", gn: "#10b981", gg: "rgba(16,185,129,0.1)", am: "#f59e0b", rd: "#ef4444", pu: "#8b5cf6", pg: "rgba(139,92,246,0.1)" };
const LIGHT = { bg: "#f8f9fb", sf: "#ffffff", sa: "#f0f1f4", bd: "#e0e2e8", ba: "#3b82f6", tx: "#1a1d26", tm: "#5c6478", td: "#9ca3b4", ac: "#3b82f6", ag: "rgba(59,130,246,0.08)", gn: "#059669", gg: "rgba(5,150,105,0.08)", am: "#d97706", rd: "#dc2626", pu: "#7c3aed", pg: "rgba(124,58,237,0.08)" };
let C = DARK;
const CC = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1"];

const ALLIUM_CHAINS = [
  { name: "Ethereum", eco: "EVM", layer: "L1", tables: 101, schemas: ["raw","assets","dex","lending","nfts","ens","yields","decoded","liquid_staking","metrics","bridges","prices","wallet_features"] },
  { name: "Polygon", eco: "EVM", layer: "L2", tables: 92, schemas: ["raw","assets","dex","lending","nfts","decoded","staking","predictions","bridges","metrics","wallet_features"] },
  { name: "Solana", eco: "SVM", layer: "L1", tables: 82, schemas: ["raw","assets","dex","lending","nfts","decoded","defi","staking","predictions","bridges","prices","metrics"] },
  { name: "Base", eco: "EVM", layer: "L2", tables: 79, schemas: ["raw","assets","dex","lending","nfts","decoded","yields","metrics","bridges","identity","prices","wallet_features"] },
  { name: "Arbitrum", eco: "EVM", layer: "L2", tables: 73, schemas: ["raw","assets","dex","lending","nfts","decoded","yields","metrics","bridges","prices"] },
  { name: "Avalanche", eco: "EVM", layer: "L1", tables: 68, schemas: ["raw","assets","dex","lending","nfts","decoded","metrics","bridges","prices"] },
  { name: "Worldchain", eco: "EVM", layer: "L2", tables: 65, schemas: ["raw","assets","dex","lending","nfts","decoded","yields","metrics","bridges","prices"] },
  { name: "BSC", eco: "EVM", layer: "L1", tables: 61, schemas: ["raw","assets","dex","lending","nfts","decoded","metrics","bridges","prices"] },
  { name: "Monad", eco: "EVM", layer: "L1", tables: 59, schemas: ["raw","assets","dex","lending","nfts","decoded","yields","metrics","bridges","prices"] },
  { name: "Optimism", eco: "EVM", layer: "L2", tables: 55, schemas: ["raw","assets","dex","lending","nfts","metrics","bridges"] },
  { name: "Soneium", eco: "EVM", layer: "L2", tables: 55, schemas: ["raw","assets","dex","lending","decoded","yields","metrics","bridges","prices"] },
  { name: "Unichain", eco: "EVM", layer: "L2", tables: 51, schemas: ["raw","assets","dex","lending","decoded","yields","metrics","bridges","prices"] },
  { name: "Ink", eco: "EVM", layer: "L2", tables: 50, schemas: ["raw","assets","dex","lending","decoded","yields","metrics","bridges","prices"] },
  { name: "Linea", eco: "EVM", layer: "L2", tables: 49, schemas: ["raw","assets","dex","lending","nfts","decoded","metrics","bridges","prices"] },
  { name: "Scroll", eco: "EVM", layer: "L2", tables: 47, schemas: ["raw","assets","dex","lending","nfts","decoded","metrics","bridges","prices"] },
  { name: "Celo", eco: "EVM", layer: "L1", tables: 45, schemas: ["raw","assets","dex","lending","decoded","metrics","bridges","prices"] },
  { name: "HyperEVM", eco: "EVM", layer: "L1", tables: 45, schemas: ["raw","assets","dex","lending","decoded","yields","metrics","bridges","prices"] },
  { name: "Blast", eco: "EVM", layer: "L2", tables: 43, schemas: ["raw","assets","dex","lending","nfts","decoded","metrics","bridges","prices"] },
  { name: "Sonic", eco: "EVM", layer: "L1", tables: 41, schemas: ["raw","assets","dex","lending","decoded","metrics","bridges","prices"] },
  { name: "Berachain", eco: "EVM", layer: "L1", tables: 36, schemas: ["raw","assets","dex","lending","decoded","metrics","bridges","prices"] },
  { name: "zkSync", eco: "EVM", layer: "L2", tables: 35, schemas: ["raw","assets","dex","lending","decoded","metrics","bridges","prices"] },
  { name: "Zora", eco: "EVM", layer: "L2", tables: 35, schemas: ["raw","assets","dex","lending","decoded","metrics","bridges","prices"] },
  { name: "Mode", eco: "EVM", layer: "L2", tables: 32, schemas: ["raw","assets","dex","lending","decoded","metrics","bridges","prices"] },
  { name: "Gnosis", eco: "EVM", layer: "L1", tables: 30, schemas: ["raw","assets","dex","lending","decoded","metrics","bridges"] },
  { name: "Tron", eco: "TVM", layer: "L1", tables: 29, schemas: ["raw","assets","dex","lending","staking","bridges","metrics"] },
  { name: "Sui", eco: "Move", layer: "L1", tables: 27, schemas: ["raw","assets","dex","nfts","staking","bridges"] },
  { name: "Ronin", eco: "EVM", layer: "L2", tables: 27, schemas: ["raw","assets","dex","lending","decoded","metrics","bridges"] },
  { name: "Near", eco: "NEAR", layer: "L1", tables: 26, schemas: ["raw","assets","nfts","staking"] },
  { name: "Mantle", eco: "EVM", layer: "L2", tables: 25, schemas: ["raw","assets","dex","lending","decoded","metrics","bridges"] },
  { name: "Hyperliquid", eco: "Custom", layer: "L1", tables: 23, schemas: ["raw","assets","dex","metrics"] },
  { name: "Abstract", eco: "EVM", layer: "L2", tables: 23, schemas: ["raw","assets","dex","lending","decoded","metrics"] },
  { name: "Fraxtal", eco: "EVM", layer: "L2", tables: 22, schemas: ["raw","assets","dex","lending","decoded","metrics"] },
  { name: "Sei", eco: "Cosmos", layer: "L1", tables: 20, schemas: ["raw","assets","dex","metrics","staking"] },
  { name: "Bitcoin", eco: "UTXO", layer: "L1", tables: 19, schemas: ["raw","assets","nfts","metrics"] },
  { name: "Fantom", eco: "EVM", layer: "L1", tables: 18, schemas: ["raw","assets","dex","lending","decoded","metrics"] },
  { name: "Stellar", eco: "Stellar", layer: "L1", tables: 17, schemas: ["raw","assets","staking"] },
  { name: "Aptos", eco: "Move", layer: "L1", tables: 15, schemas: ["raw","assets","staking","bridges","metrics"] },
  { name: "TON", eco: "TON", layer: "L1", tables: 11, schemas: ["raw","assets","staking","metrics"] },
  { name: "dYdX", eco: "Cosmos", layer: "L1", tables: 11, schemas: ["raw","assets","staking","metrics"] },
  { name: "Cosmos", eco: "Cosmos", layer: "L1", tables: 10, schemas: ["raw","staking"] },
  { name: "Hedera", eco: "Hashgraph", layer: "L1", tables: 10, schemas: ["raw","assets","staking","metrics"] },
  { name: "Cardano", eco: "UTXO", layer: "L1", tables: 5, schemas: ["raw","assets"] },
  { name: "Dogecoin", eco: "UTXO", layer: "L1", tables: 5, schemas: ["raw","assets"] },
  { name: "Starknet", eco: "Cairo", layer: "L2", tables: 5, schemas: ["raw"] },
  { name: "XRP Ledger", eco: "XRP", layer: "L1", tables: 4, schemas: ["raw","assets"] },
];

const SCHEMA_COLS = [
  { key: "raw", label: "Raw Data", icon: "\uD83E\uDDF1" },
  { key: "assets", label: "Token Transfers", icon: "\uD83D\uDCB8" },
  { key: "dex", label: "DEX Trades", icon: "\uD83D\uDCCA" },
  { key: "lending", label: "Lending", icon: "\uD83C\uDFE6" },
  { key: "nfts", label: "NFTs", icon: "\uD83D\uDDBC\uFE0F" },
  { key: "identity", label: "ENS", icon: "\uD83E\uDEAA" },
  { key: "yields", label: "Yields", icon: "\uD83D\uDCC8" },
  { key: "decoded", label: "Decoded", icon: "\uD83D\uDD13" },
  { key: "liquid_staking", label: "Liquid Staking", icon: "\uD83D\uDCA7" },
  { key: "metrics", label: "Metrics", icon: "\uD83D\uDCC9" },
  { key: "bridges", label: "Bridges", icon: "\uD83C\uDF09" },
  { key: "prices", label: "Prices", icon: "\uD83D\uDCB5" },
  { key: "staking", label: "Staking", icon: "\uD83D\uDD12" },
  { key: "predictions", label: "Predictions", icon: "\uD83C\uDFB2" },
  { key: "wallet_features", label: "Wallet 360", icon: "\uD83C\uDFAF" },
  { key: "defi", label: "DeFi", icon: "\uD83E\uDD11" },
];

const ECO_COLORS = { EVM: "#3b82f6", SVM: "#14b8a6", Move: "#10b981", UTXO: "#f59e0b", Cosmos: "#06b6d4", TVM: "#ef4444", NEAR: "#8b5cf6", Custom: "#ec4899", Cairo: "#ef4444", TON: "#3b82f6", Stellar: "#f59e0b", Hashgraph: "#ef4444", XRP: "#6366f1" };

const ROADMAP = [
  { name: "PnL APIs", status: "In Progress", cat: "Feature", pod: "Realtime Products", target: "Q1 2026", impact: "High", desc: "Realtime profit & loss calculations via API for wallets and accounting platforms.", personas: "Accounting, Builders" },
  { name: "Metrics V2", status: "In Progress", cat: "Feature", pod: "Surfaces & AI", target: "Q1 2026", impact: "High", desc: "Revamped chain metrics with expanded coverage and improved data freshness.", personas: "Federal, Institutional" },
  { name: "CEX Data Ingestion", status: "In Progress", cat: "Data Enrichment", pod: "Analytics Engineering", target: "Q1 2026", impact: "High", desc: "Centralized exchange data integrated alongside on-chain data for unified analytics.", personas: "Builders, Fintechs, Institutional" },
  { name: "Project Beam v0", status: "In Progress", cat: "Feature", pod: "Surfaces & AI", target: "Q1 2026", impact: "High", desc: "New product surface for data exploration and visualization.", personas: "Builders" },
  { name: "Allium Shallot v1.0", status: "In Progress", cat: "Feature", pod: "Surfaces & AI", target: "Q1 2026", impact: "High", desc: "AI-powered data assistant for natural language blockchain queries.", personas: "All" },
  { name: "Holdings API", status: "In Progress", cat: "Feature", pod: "Realtime Products", target: "Q1 2026", impact: "High", desc: "Realtime portfolio holdings with token balances, prices, and PnL.", personas: "Builders" },
  { name: "DeFi Positions API", status: "In Progress", cat: "Data Enrichment", pod: "Data Platform", target: "Q1 2026", impact: "High", desc: "Track DeFi lending, staking, and LP positions across protocols in realtime.", personas: "Builders" },
  { name: "Dashboards V3", status: "In QA", cat: "Feature", pod: "Surfaces & AI", target: "Q1 2026", impact: "High", desc: "Redesigned dashboard builder with improved charting and sharing.", personas: "All" },
  { name: "BTC / UTXO Labels", status: "Backlog", cat: "Attribution", pod: "Analytics Engineering", target: "Q2 2026", impact: "High", desc: "Entity labels for Bitcoin and UTXO chains — exchanges, services, protocols.", personas: "Federal, Institutional" },
  { name: "Attribution Platform", status: "Scoping", cat: "Attribution", pod: "Analytics Engineering", target: "Q1 2026", impact: "High", desc: "Unified entity attribution system across all chains.", personas: "All" },
  { name: "Staking APIs", status: "Backlog", cat: "Feature", pod: "Realtime Products", target: "TBD", impact: "High", desc: "Realtime staking data — validators, delegations, rewards.", personas: "All" },
  { name: "Portfolio & Risk Analytics", status: "Scoping", cat: "Feature", pod: "Surfaces & AI", target: "TBD", impact: "High", desc: "Institutional-grade portfolio analytics with risk metrics.", personas: "Institutional" },
  { name: "Accounting Screen MVP", status: "Done", cat: "Feature", pod: "Surfaces & AI", target: "Q1 2026", impact: "High", desc: "Dedicated accounting view for reconciliation and audit workflows.", personas: "Accounting, Institutional" },
  { name: "MegaETH", status: "In Progress", cat: "Chain Ingestion", pod: "Core Intelligence", target: "Q1 2026", impact: "Medium", desc: "Full indexing of MegaETH chain — raw, decoded, enriched.", personas: "All" },
  { name: "Tempo Mainnet", status: "In Progress", cat: "Chain Ingestion", pod: "Core Intelligence", target: "Q1 2026", impact: "High", desc: "Full indexing of Tempo mainnet with dashboard.", personas: "All" },
  { name: "Stellar", status: "In Progress", cat: "Chain Ingestion", pod: "Core Intelligence", target: "Q1 2026", impact: "Medium", desc: "Stellar chain indexing with APIs and dashboard.", personas: "All" },
  { name: "Lighter", status: "In Progress", cat: "Chain Ingestion", pod: "Core Intelligence", target: "Q1 2026", impact: "High", desc: "Lighter chain integration.", personas: "All" },
  { name: "Stablecoin Expansion", status: "In Progress", cat: "Data Enrichment", pod: "Applied Intelligence", target: "Q1 2026", impact: "Medium", desc: "Expanded stablecoin coverage across new chains and tokens.", personas: "Fintechs, Institutional" },
  { name: "Predictions Vertical", status: "Scoping", cat: "Data Enrichment", pod: "Applied Intelligence", target: "Q1 2026", impact: "Medium", desc: "Full prediction market data — Polymarket, Kalshi, and more.", personas: "All" },
  { name: "CLOB DEXes", status: "Scoping", cat: "Data Enrichment", pod: "Data Platform", target: "Q1 2026", impact: "Medium", desc: "Central Limit Order Book DEX data indexing.", personas: "All" },
  { name: "Solana Orderflow", status: "Scoping", cat: "Data Enrichment", pod: "Applied Intelligence", target: "Q1 2026", impact: "Medium", desc: "Solana-specific orderflow analytics and MEV data.", personas: "All" },
  { name: "Geographic Wallet Tagging", status: "Backlog", cat: "Attribution", pod: "Analytics Engineering", target: "TBD", impact: "Medium", desc: "Geographic attribution for wallet addresses.", personas: "All" },
  { name: "Market Surveillance", status: "Backlog", cat: "Feature", pod: "Surfaces & AI", target: "TBD", impact: "Medium", desc: "Real-time market manipulation and anomaly detection.", personas: "Institutional" },
  { name: "Settlement & Reconciliation", status: "Backlog", cat: "Feature", pod: "Surfaces & AI", target: "TBD", impact: "Medium", desc: "Trade reporting, settlement, and reconciliation tools.", personas: "Institutional" },
  { name: "Pre & Post-Trade Analytics", status: "Scoping", cat: "Feature", pod: "Surfaces & AI", target: "TBD", impact: "Medium", desc: "Institutional trading analytics for pre and post-trade analysis.", personas: "Institutional" },
  { name: "Bridges Expansion", status: "In Progress", cat: "Data Enrichment", pod: "Applied Intelligence", target: "Q1 2026", impact: "Medium", desc: "Messaging protocol bridges with expanded chain coverage.", personas: "Foundations" },
  { name: "AI Solutions Engineer", status: "In Progress", cat: "Feature", pod: "Surfaces & AI", target: "Q1 2026", impact: "Medium", desc: "AI-powered solutions engineering for customer onboarding.", personas: "All" },
  { name: "Activities API Filtering", status: "Scoping", cat: "Feature", pod: "Realtime Products", target: "Q1 2026", impact: "Medium", desc: "Advanced filtering for wallet activity feeds.", personas: "Builders" },
  { name: "Prices API Productionization", status: "In Progress", cat: "Feature", pod: "Realtime Products", target: "Q1 2026", impact: "Medium", desc: "Production-grade price API with improved freshness and reliability.", personas: "All" },
];

const SCHEMAS = [
  { name: "Raw", desc: "Blocks, transactions, logs, traces", icon: "\uD83E\uDDF1" },
  { name: "Decoded", desc: "Human-readable contract events & calls", icon: "\uD83D\uDD13" },
  { name: "Token Transfers", desc: "ERC-20, ERC-721, ERC-1155 movements", icon: "\uD83D\uDCB8" },
  { name: "Balances", desc: "Point-in-time token holdings for any wallet", icon: "\uD83D\uDCB0" },
  { name: "DEX Trades", desc: "Swaps across Uniswap, Curve, Jupiter...", icon: "\uD83D\uDCCA" },
  { name: "NFT Trades", desc: "Sales on OpenSea, Blur, Magic Eden + wash flags", icon: "\uD83D\uDDBC\uFE0F" },
  { name: "Stablecoins", desc: "USDC/USDT/DAI supply, transfers, mint/burn", icon: "\uD83E\uDE99" },
  { name: "Lending", desc: "Aave, Compound — borrows, repays, liquidations", icon: "\uD83C\uDFE6" },
  { name: "Prices", desc: "DEX-derived hourly prices with volume weighting", icon: "\uD83D\uDCB5" },
  { name: "PnL", desc: "Realized/unrealized profit & loss per wallet", icon: "\uD83D\uDCC8" },
  { name: "Wallet 360", desc: "Full wallet profile — DeFi, NFT, DEX + tags", icon: "\uD83C\uDFAF" },
  { name: "Identity", desc: "ENS, Lens, Farcaster name resolution", icon: "\uD83E\uDEAA" },
  { name: "Chain Metrics", desc: "DAU, txn volume, fees, new addresses", icon: "\uD83D\uDCC9" },
  { name: "Bridges", desc: "Cross-chain transfer tracking", icon: "\uD83C\uDF09" },
  { name: "Staking", desc: "Validator rewards, delegation events", icon: "\uD83D\uDD12" },
];
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

function Proposal({ R }) {
  const [chainFilter, setChainFilter] = useState("All");
  const [selChains, setSelChains] = useState([]);
  const co = R.co; const ucs = R.ucs; const prods = R.prods; const cust = R.cust; const pitch = R.pitch;
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const PH = ({ children }) => <h2 style={{ fontSize: 18, fontWeight: 700, color: C.tx, marginBottom: 14, paddingBottom: 8, borderBottom: "2px solid " + C.ac + "40" }}>{children}</h2>;
  const schemaMap = { "Wallet / App Development": ["Raw","Token Transfers","Balances","DEX Trades","Prices","PnL","Wallet 360"], "DEX / Trading Platform": ["Raw","DEX Trades","Prices","Token Transfers","Balances","Chain Metrics"], "Analytics / Research / Investing": ["Chain Metrics","DEX Trades","Balances","Wallet 360","Stablecoins","Lending"], "Accounting / Audit / Compliance": ["Balances","Token Transfers","DEX Trades","Stablecoins","PnL","Bridges"], "Fraud Detection / Security": ["Raw","Decoded","Token Transfers","DEX Trades","Wallet 360","Identity"], "Stablecoin / Payments": ["Stablecoins","Token Transfers","Balances","Bridges","Prices"], "NFT Platform / Marketplace": ["NFT Trades","Token Transfers","Wallet 360","Prices","Identity"], "L1/L2 Chain / Protocol": ["Raw","Decoded","Chain Metrics","DEX Trades","Stablecoins","Staking"], "AI / Data Agent": ["Raw","Decoded","DEX Trades","Prices","Balances","Wallet 360"] };
  const relSchemaNames = schemaMap[ucs[0]?.cat] || SCHEMAS.map(s => s.name);

  return <div className="fu" style={{ maxWidth: 900, margin: "0 auto" }}>
    {/* HEADER */}
    <div style={{ background: "linear-gradient(135deg,#0c1029,#0f1a3a,#0c1029)", border: "1px solid "+C.ac+"30", borderRadius: 16, padding: "32px 28px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -50, right: -50, width: 200, height: 200, borderRadius: "50%", background: C.ac+"08" }} />
      <div style={{ fontSize: 11, fontWeight: 600, color: C.ac, textTransform: "uppercase", letterSpacing: ".15em", marginBottom: 6 }}>Data Partnership Proposal</div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>Allium × {co.name}</h1>
      <div style={{ fontSize: 13, color: C.tm, marginBottom: 14 }}>Prepared {today} — Confidential</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{ucs.slice(0, 3).map((u, i) => <Bg key={i} color={[C.ac, C.gn, C.pu][i]}>{u.cat}</Bg>)}</div>
    </div>

    {/* EXEC SUMMARY */}
    <div style={{ background: C.sf, border: "1px solid "+C.bd, borderRadius: 12, padding: 22, marginBottom: 16 }}>
      <PH>{"\u26A1"} Executive Summary</PH>
      <p style={{ fontSize: 13.5, color: C.tx, lineHeight: 1.8, margin: 0 }}>{co.name} operates in {co.industry || "the blockchain space"}, where reliable on-chain data is critical. {co.blockchainRelevance ? "Given work in " + co.blockchainRelevance.slice(0, 120) + ", " : ""}Allium proposes a data partnership providing production-grade infrastructure across <strong style={{ color: C.ac }}>80+ blockchains</strong> with <strong style={{ color: C.gn }}>sub-second freshness</strong>.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 16, background: C.bg, borderRadius: 10, padding: 12, border: "1px solid "+C.bd }}>
        {[["80+","Blockchains"],["<5s","Freshness"],["90K+","Peak RPS"],["16+","Enterprise Logos"]].map(([v, l], i) => <div key={i} style={{ textAlign: "center", padding: 8 }}><div style={{ fontSize: 22, fontWeight: 700, color: C.ac }}>{v}</div><div style={{ fontSize: 11, color: C.tm }}>{l}</div></div>)}
      </div>
    </div>

    {/* CHALLENGES */}
    <div style={{ background: C.sf, border: "1px solid "+C.bd, borderRadius: 12, padding: 22, marginBottom: 16 }}>
      <PH>{"\uD83C\uDFAF"} Challenges We Solve for {co.name}</PH>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {(co.painPoints || ["Managing blockchain data at scale","Data freshness and reliability","Multi-chain complexity","Engineering time on pipelines"]).map((p, i) => <div key={i} style={{ display: "flex", gap: 10, padding: 12, background: C.bg, borderRadius: 8, border: "1px solid "+C.bd }}><span style={{ fontSize: 14 }}>{"\u26A0\uFE0F"}</span><span style={{ fontSize: 12.5, color: C.tx }}>{p}</span></div>)}
      </div>
    </div>

    {/* PRODUCTS */}
    <div style={{ background: C.sf, border: "1px solid "+C.bd, borderRadius: 12, padding: 22, marginBottom: 16 }}>
      <PH>{"\uD83D\uDEE0\uFE0F"} Recommended Product Stack</PH>
      {prods.map((p, i) => {
        const icons = { "Allium Explorer": "\uD83D\uDD0D", "Allium Datashares": "\uD83D\uDCE6", "Allium Developer APIs": "\u26A1", "Allium Datastreams": "\uD83D\uDE80", "Allium AI / MCP": "\uD83E\uDD16" };
        return <div key={i} style={{ display: "flex", gap: 14, padding: 16, background: C.bg, borderRadius: 10, border: "1px solid "+C.bd, marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: C.ag, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{icons[p.name] || "\uD83D\uDCCA"}</div>
          <div style={{ flex: 1 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 14, fontWeight: 700, color: C.tx }}>{p.name}</span><Bg color={C.gn}>{p.fresh}</Bg></div><div style={{ fontSize: 12, color: C.tm, marginTop: 4 }}>{p.desc}</div>{p.doc && <a href={p.doc} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.ac, textDecoration: "none", marginTop: 6, display: "inline-block" }}>{"\u2192"} Documentation</a>}</div>
        </div>;
      })}
      <div style={{ marginTop: 12, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr>{["","Explorer","Datashares","Realtime APIs","Datastreams"].map((h, i) => <th key={i} style={{ padding: "7px 8px", background: C.bg, color: i === 0 ? "transparent" : C.tx, fontWeight: 600, textAlign: "left", borderBottom: "1px solid "+C.bd }}>{h}</th>)}</tr></thead><tbody>
          {[["Freshness","~1 hr","1-3 hrs","3-5s","3-5s"],["Chains","80+","80+","20+","80+"],["Interface","SQL/App","Snowflake/BQ/S3","REST API","Kafka/PubSub"],["Best For","Analytics","Data Lake","Prod Apps","Pipelines"]].map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j} style={{ padding: "6px 8px", borderBottom: "1px solid "+C.bd+"50", color: j === 0 ? C.tm : C.tx, fontWeight: j === 0 ? 600 : 400 }}>{c}</td>)}</tr>)}
        </tbody></table>
      </div>
    </div>

    {/* CHAINS */}
    <div style={{ background: C.sf, border: "1px solid "+C.bd, borderRadius: 12, padding: 22, marginBottom: 16 }}>
      <PH>{"\u26D3\uFE0F"} Blockchain Coverage</PH>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14, background: C.bg, borderRadius: 10, padding: 12, border: "1px solid "+C.bd }}>
        {[["115+","Total Chains"],["3,000+","Total Tables"],["13","Ecosystems"],["15","Data Categories"]].map(([v, l], i) => <div key={i} style={{ textAlign: "center", padding: 6 }}><div style={{ fontSize: 22, fontWeight: 700, color: C.tx }}>{v}</div><div style={{ fontSize: 10, color: C.tm, textTransform: "uppercase", letterSpacing: ".06em" }}>{l}</div></div>)}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 5 }}>
          {["All","EVM","SVM","Move","UTXO","Cosmos"].map(f => <button key={f} onClick={() => setChainFilter(f)} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid "+(chainFilter === f ? C.ac : C.bd), background: chainFilter === f ? C.ac : C.bg, color: chainFilter === f ? "#fff" : C.tm, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>{f}</button>)}
        </div>
        {selChains.length > 0 && <button onClick={() => setSelChains([])} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid "+C.rd+"40", background: C.rd+"15", color: C.rd, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Clear ({selChains.length})</button>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 7 }}>
        {ALLIUM_CHAINS.filter(ch => chainFilter === "All" || ch.eco === chainFilter).map((ch, i) => {
          const ecColor = ECO_COLORS[ch.eco] || C.ac;
          const sel = selChains.includes(ch.name);
          return <div key={i} onClick={() => setSelChains(p => sel ? p.filter(x => x !== ch.name) : [...p, ch.name])} style={{ padding: "10px 12px", background: sel ? ecColor+"18" : C.bg, borderRadius: 8, border: "1px solid "+(sel ? ecColor+"60" : C.bd), cursor: "pointer", transition: "all .15s", position: "relative" }} onMouseOver={e => { if(!sel) e.currentTarget.style.borderColor = ecColor+"40"; }} onMouseOut={e => { if(!sel) e.currentTarget.style.borderColor = C.bd; }}>
            {sel && <div style={{ position: "absolute", top: 6, right: 8, fontSize: 10, color: C.gn }}>{"\u2713"}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
              <div style={{ width: 7, height: 7, borderRadius: 2, background: ecColor, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: sel ? ecColor : C.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ch.name}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.tm, marginLeft: "auto" }}>{ch.tables}</span>
            </div>
            <div style={{ fontSize: 9.5, color: C.td }}>{ch.eco} {"\u00B7"} {ch.layer}</div>
          </div>;
        })}
      </div>

      {/* COVERAGE MATRIX */}
      {selChains.length > 0 && <div style={{ marginTop: 18, background: C.bg, borderRadius: 10, border: "1px solid "+C.bd, padding: 18 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.tx }}>Coverage Matrix {"\u2014"} {selChains.length} Chain{selChains.length > 1 ? "s" : ""} Selected</div>
          <div style={{ fontSize: 12, color: C.tm }}>{selChains.reduce((a, n) => a + (ALLIUM_CHAINS.find(c => c.name === n)?.tables || 0), 0)} tables {"\u00B7"} {new Set(selChains.flatMap(n => ALLIUM_CHAINS.find(c => c.name === n)?.schemas || [])).size} data categories available</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead><tr>
              <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid "+C.bd, color: C.tm, fontWeight: 600, position: "sticky", left: 0, background: C.bg, minWidth: 100 }}></th>
              {SCHEMA_COLS.map(s => <th key={s.key} style={{ padding: "6px 4px", textAlign: "center", borderBottom: "1px solid "+C.bd, color: C.tm, fontWeight: 500, fontSize: 9.5, minWidth: 58 }}><div style={{ fontSize: 16, marginBottom: 2 }}>{s.icon}</div>{s.label}</th>)}
            </tr></thead>
            <tbody>
              {selChains.map(name => { const ch = ALLIUM_CHAINS.find(c => c.name === name); if (!ch) return null;
                const ecColor = ECO_COLORS[ch.eco] || C.ac;
                return <tr key={name}>
                  <td style={{ padding: "7px 10px", borderBottom: "1px solid "+C.bd+"50", fontWeight: 600, color: ecColor, position: "sticky", left: 0, background: C.bg }}><div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 6, height: 6, borderRadius: 2, background: ecColor }} />{name}</div></td>
                  {SCHEMA_COLS.map(s => <td key={s.key} style={{ padding: "6px 4px", textAlign: "center", borderBottom: "1px solid "+C.bd+"50" }}>
                    {ch.schemas.includes(s.key)
                      ? <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 5, background: C.gn+"20", color: C.gn, fontSize: 11, fontWeight: 700 }}>{"\u2713"}</span>
                      : <span style={{ color: C.bd, fontSize: 14 }}>{"\u2014"}</span>}
                  </td>)}
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>}

      {selChains.length === 0 && <div style={{ marginTop: 14, padding: 18, textAlign: "center", background: C.bg, borderRadius: 9, border: "1px solid "+C.bd }}>
        <div style={{ fontSize: 22, marginBottom: 6 }}>{"\uD83D\uDC46"}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.tx }}>Click chains above to compare data coverage</div>
        <div style={{ fontSize: 11, color: C.tm }}>Select your prospect's chains to see exactly what Allium provides</div>
      </div>}

      {/* Bottom stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14 }}>
        {[["\u26A1","3-5s Freshness","p50 data latency across all chains",C.ac],["\uD83D\uDD04","Re-org Handling","Automatic detection & correction",C.gn],["\uD83D\uDEE1\uFE0F","99.9% Uptime","Enterprise SLA available",C.rd]].map(([ic, t, d, cl], i) => <div key={i} style={{ padding: 14, background: C.bg, borderRadius: 9, border: "1px solid "+C.bd }}><div style={{ fontSize: 20, marginBottom: 6 }}>{ic}</div><div style={{ fontSize: 13, fontWeight: 700, color: cl }}>{t}</div><div style={{ fontSize: 10.5, color: C.tm }}>{d}</div></div>)}
      </div>
    </div>

    {/* SCHEMAS */}
    <div style={{ background: C.sf, border: "1px solid "+C.bd, borderRadius: 12, padding: 22, marginBottom: 16 }}>
      <PH>{"\uD83D\uDDC2\uFE0F"} Data Schemas</PH>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
        {SCHEMAS.map((s, i) => { const rel = relSchemaNames.includes(s.name); return <div key={i} style={{ display: "flex", gap: 8, padding: 10, background: rel ? C.ag : C.bg, borderRadius: 8, border: "1px solid "+(rel ? C.ac+"35" : C.bd), opacity: rel ? 1 : .45 }}><span style={{ fontSize: 16 }}>{s.icon}</span><div><div style={{ fontSize: 12, fontWeight: 600, color: rel ? C.tx : C.tm }}>{s.name}</div><div style={{ fontSize: 10, color: C.tm }}>{s.desc}</div></div></div>; })}
      </div>
    </div>

    {/* SOCIAL PROOF */}
    <div style={{ background: C.sf, border: "1px solid "+C.bd, borderRadius: 12, padding: 22, marginBottom: 16 }}>
      <PH>{"\uD83C\uDFC6"} Trusted by Industry Leaders</PH>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {KB.customers.map((c, i) => <div key={i} style={{ padding: 12, background: C.bg, borderRadius: 8, border: "1px solid "+C.bd, borderLeft: cust.some(x => x.n === c.n) ? "3px solid "+C.ac : "1px solid "+C.bd }}><div style={{ fontSize: 12.5, fontWeight: 700, color: cust.some(x => x.n === c.n) ? C.ac : C.tx }}>{c.n}</div><div style={{ fontSize: 10, color: C.tm, marginTop: 2 }}>{c.u}</div></div>)}
      </div>
      <div style={{ marginTop: 12, padding: 14, background: C.bg, borderRadius: 8, border: "1px solid "+C.bd, fontSize: 12, color: C.tx, lineHeight: 1.7 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.tm, marginBottom: 4 }}>CASE STUDY HIGHLIGHTS</div>
        {"\u2022"} <strong>Phantom</strong>: 15M MAUs, 90K RPS during Jupiter airdrop (477M requests in 4 hrs){"\n"}{"\u2022"} <strong>Uniswap Foundation</strong>: v4 adoption dashboard at dexanalytics.org{"\n"}{"\u2022"} <strong>Wormhole</strong>: Sybil detection protecting $100M+ in airdrop{"\n"}{"\u2022"} <strong>Bridge.xyz</strong> (Stripe): Realtime tx monitoring & reconciliation
      </div>
    </div>

    {/* COMPETITIVE */}
    <div style={{ background: C.sf, border: "1px solid "+C.bd, borderRadius: 12, padding: 22, marginBottom: 16 }}>
      <PH>{"\uD83D\uDE80"} Why Allium Over Alternatives</PH>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[{ vs: "vs. In-House", pts: ["80+ chains from day 1","No infra maintenance","Engineering time \u2192 product"] }, { vs: "vs. Dune/Flipside", pts: ["Production SLAs, not dashboards","Sub-second API freshness","Your own Snowflake, no rate limits"] }, { vs: "vs. The Graph/Goldsky", pts: ["No subgraph development","80+ chains, one SQL interface","Enriched schemas ready to query"] }, { vs: "vs. Chainlink/Moralis", pts: ["Full historical + realtime","Cross-chain joins in one query","Enterprise Datashare to your warehouse"] }].map((item, i) => <div key={i} style={{ padding: 14, background: C.bg, borderRadius: 9, border: "1px solid "+C.bd }}><div style={{ fontSize: 12, fontWeight: 700, color: C.ac, marginBottom: 6 }}>{item.vs}</div>{item.pts.map((p, j) => <div key={j} style={{ display: "flex", gap: 6, marginBottom: 3, fontSize: 11.5, color: C.tx }}><span style={{ color: C.gn }}>{"\u2713"}</span>{p}</div>)}</div>)}
      </div>
    </div>

    {/* TIMELINE */}
    <div style={{ background: C.sf, border: "1px solid "+C.bd, borderRadius: 12, padding: 22, marginBottom: 16 }}>
      <PH>{"\uD83D\uDCC5"} Implementation Timeline</PH>
      <div style={{ paddingLeft: 20, position: "relative" }}>
        <div style={{ position: "absolute", left: 6, top: 4, bottom: 4, width: 2, background: "linear-gradient(to bottom,"+C.ac+","+C.gn+")" }} />
        {[{ w: "Day 1", t: "Kickoff & Access", d: "Explorer access, API keys, Datashare connections provisioned." },{ w: "Week 1", t: "Integration & POC", d: "Connect to your stack. Run proof-of-concept against live data." },{ w: "Week 2-3", t: "Production Deploy", d: "Schema customization, query optimization, SLA setup." },{ w: "Week 4+", t: "Scale & Optimize", d: "New chains, custom schemas, QBRs. 24/7/365 enterprise support." }].map((s, i) => <div key={i} style={{ display: "flex", gap: 12, marginBottom: 16, position: "relative" }}><div style={{ width: 14, height: 14, borderRadius: "50%", background: C.ac, border: "3px solid "+C.sf, flexShrink: 0, marginTop: 2, zIndex: 1 }} /><div><div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}><Bg color={C.ac}>{s.w}</Bg><span style={{ fontSize: 13, fontWeight: 700, color: C.tx }}>{s.t}</span></div><div style={{ fontSize: 12, color: C.tm }}>{s.d}</div></div></div>)}
      </div>
    </div>

    {/* NEXT STEPS */}
    <div style={{ background: "linear-gradient(135deg,#0c1029,#0f1a3a)", border: "1px solid "+C.ac+"30", borderRadius: 14, padding: 24, marginBottom: 16 }}>
      <PH>{"\u2728"} Next Steps</PH>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {[{ n: "1", t: "15-Min Discovery", d: "Map " + co.name + "'s data needs to Allium capabilities" },{ n: "2", t: "Live Demo", d: "Query your specific chains and tokens in real-time" },{ n: "3", t: "POC / Trial", d: "Free trial to validate quality, freshness, and performance" }].map((s, i) => <div key={i} style={{ padding: 16, background: C.sf, borderRadius: 10, border: "1px solid "+C.bd, textAlign: "center" }}><div style={{ width: 32, height: 32, borderRadius: "50%", background: C.ag, border: "2px solid "+C.ac, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 15, fontWeight: 800, color: C.ac }}>{s.n}</div><div style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 4 }}>{s.t}</div><div style={{ fontSize: 11, color: C.tm }}>{s.d}</div></div>)}
      </div>
      <div style={{ textAlign: "center", marginTop: 16 }}><a href="https://allium.so/contact" target="_blank" rel="noreferrer" style={{ display: "inline-block", padding: "11px 28px", background: "linear-gradient(135deg,"+C.ac+",#2563eb)", borderRadius: 9, color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none", fontFamily: "'DM Sans',sans-serif" }}>Schedule a Call {"\u2192"}</a></div>
    </div>
  </div>;
}

function Roadmap({ R }) {
  const [rmFilter, setRmFilter] = useState("All");
  const [rmCat, setRmCat] = useState("All");
  const co = R?.co;
  const statColors = { "In Progress": C.ac, "In QA": C.am, "Done": C.gn, "Backlog": C.tm, "Scoping": C.pu };
  const catColors = { "Feature": C.ac, "Chain Ingestion": C.gn, "Data Enrichment": C.am, "Attribution": C.pu };
  const statOrder = { "In Progress": 0, "In QA": 1, "Scoping": 2, "Backlog": 3, "Done": 4 };
  const items = ROADMAP.filter(r => (rmFilter === "All" || r.status === rmFilter) && (rmCat === "All" || r.cat === rmCat)).sort((a, b) => (statOrder[a.status] ?? 5) - (statOrder[b.status] ?? 5));
  const counts = { All: ROADMAP.length }; ROADMAP.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });

  return <div className="fu" style={{ maxWidth: 900, margin: "0 auto" }}>
    <div style={{ background: C.sf, border: "1px solid "+C.bd, borderRadius: 12, padding: 24, marginBottom: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: C.tx, margin: "0 0 4px" }}>{"\uD83D\uDDFA\uFE0F"} Allium Product Roadmap</h2>
      <p style={{ fontSize: 13, color: C.tm, margin: "0 0 16px" }}>What's coming next {co ? "— features relevant to " + co.name + " highlighted" : ""}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 16 }}>
        {["All","In Progress","In QA","Scoping","Done"].map(s => <button key={s} onClick={() => setRmFilter(s)} style={{ padding: "8px 6px", borderRadius: 8, border: "1px solid "+(rmFilter === s ? (statColors[s] || C.ac) : C.bd), background: rmFilter === s ? (statColors[s] || C.ac)+"18" : C.bg, color: rmFilter === s ? (statColors[s] || C.ac) : C.tm, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", textAlign: "center" }}>{s === "All" ? "All" : s}<div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{counts[s] || 0}</div></button>)}
      </div>
      <div style={{ display: "flex", gap: 5, marginBottom: 14, flexWrap: "wrap" }}>
        {["All","Feature","Chain Ingestion","Data Enrichment","Attribution"].map(c => <button key={c} onClick={() => setRmCat(c)} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid "+(rmCat === c ? (catColors[c] || C.ac) : C.bd), background: rmCat === c ? (catColors[c] || C.ac)+"18" : "transparent", color: rmCat === c ? (catColors[c] || C.ac) : C.tm, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>{c}</button>)}
      </div>
    </div>
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((r, i) => { const sc = statColors[r.status] || C.tm; const cc = catColors[r.cat] || C.tm; return <div key={i} style={{ background: C.sf, border: "1px solid "+C.bd, borderRadius: 10, padding: "14px 18px", borderLeft: "3px solid "+sc }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.tx }}>{r.name}</span>
              <span style={{ padding: "1px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: sc+"20", color: sc, border: "1px solid "+sc+"30" }}>{r.status}</span>
            </div>
            <div style={{ fontSize: 12.5, color: C.tm, lineHeight: 1.5 }}>{r.desc}</div>
          </div>
          {r.impact === "High" && <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: C.rd+"15", color: C.rd, border: "1px solid "+C.rd+"25", flexShrink: 0, marginLeft: 10 }}>{"\u26A1"} High Impact</span>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          <span style={{ padding: "1px 8px", borderRadius: 4, fontSize: 10, background: cc+"15", color: cc, border: "1px solid "+cc+"25" }}>{r.cat}</span>
          <span style={{ padding: "1px 8px", borderRadius: 4, fontSize: 10, background: C.bg, color: C.tm, border: "1px solid "+C.bd }}>{r.pod}</span>
          {r.target && r.target !== "TBD" && <span style={{ padding: "1px 8px", borderRadius: 4, fontSize: 10, background: C.bg, color: C.tm, border: "1px solid "+C.bd }}>{"\uD83D\uDCC5"} {r.target}</span>}
          {r.personas && r.personas !== "All" && <span style={{ padding: "1px 8px", borderRadius: 4, fontSize: 10, background: C.ag, color: C.ac, border: "1px solid "+C.ac+"20" }}>{"\uD83C\uDFAF"} {r.personas}</span>}
        </div>
      </div>; })}
    </div>
    {items.length === 0 && <div style={{ padding: 30, textAlign: "center", background: C.sf, borderRadius: 10, border: "1px solid "+C.bd }}><div style={{ fontSize: 13, color: C.tm }}>No items match that filter.</div></div>}
  </div>;
}

function Competitive() {
  return <div className="fu" style={{ maxWidth: 900, margin: "0 auto" }}>
    <div style={{ background: C.sf, border: "1px solid "+C.bd, borderRadius: 12, padding: 24, marginBottom: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: C.tx, margin: "0 0 4px" }}>{"\u2694\uFE0F"} Competitive Analysis</h2>
      <p style={{ fontSize: 13, color: C.tm, margin: "0 0 16px" }}>How Allium compares to alternatives across key dimensions</p>

      {/* Comparison Table */}
      <div style={{ overflowX: "auto", marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
          <thead><tr>
            {["","Allium","Dune","Flipside","The Graph","Goldsky","Nansen","Chainalysis"].map((h, i) => <th key={i} style={{ padding: "10px 8px", background: i === 1 ? C.ag : C.bg, color: i === 1 ? C.ac : C.tx, fontWeight: 700, textAlign: i === 0 ? "left" : "center", borderBottom: "2px solid "+C.bd, fontSize: i === 0 ? 10 : 11.5, minWidth: i === 0 ? 120 : 85 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {[
              ["Primary Use", "Full-stack data infra", "SQL dashboards", "SQL + bounties", "Subgraph indexing", "Data replication", "Wallet analytics", "Compliance"],
              ["Chains", "115+", "60+", "25+", "50+", "35+", "15+", "50+"],
              ["Data Freshness", "3-5s realtime", "Minutes-hours", "Minutes", "Seconds (subgraph)", "Seconds", "Minutes", "Minutes"],
              ["Delivery", "API + SQL + Stream", "SQL + API", "SQL + API", "GraphQL", "Streaming", "Dashboard", "Dashboard + API"],
              ["Enterprise SLA", "\u2713", "\u2717", "\u2717", "\u2717", "\u2713", "\u2713", "\u2713"],
              ["Datashare (BQ/SF)", "\u2713", "\u2713 (DataShare)", "\u2717", "\u2717", "\u2717", "\u2717", "\u2717"],
              ["Streaming (Kafka)", "\u2713", "\u2717", "\u2717", "\u2717", "\u2713", "\u2717", "\u2717"],
              ["Enriched Schemas", "\u2713 15+ types", "Basic", "Basic", "\u2717 (custom)", "Raw only", "\u2713 Labels", "\u2713 Labels"],
              ["Production APIs", "\u2713 90K+ RPS", "\u2717", "\u2717", "\u2713", "\u2717", "\u2717", "\u2717"],
              ["Wallet Labeling", "\u2713", "Community", "Community", "\u2717", "\u2717", "\u2713 Strong", "\u2713 Strong"],
              ["AI / NL-to-SQL", "\u2713 MCP", "\u2713 Sim", "\u2717", "\u2717", "\u2717", "\u2717", "\u2717"],
              ["Pricing Model", "Compute / API calls", "Subscription", "Free + bounties", "GRT token + sub", "Usage-based", "Subscription", "Enterprise"],
            ].map((row, i) => <tr key={i}>{row.map((cell, j) => {
              const isAllium = j === 1;
              const isCheck = cell === "\u2713" || cell.startsWith("\u2713");
              const isX = cell === "\u2717";
              return <td key={j} style={{ padding: "8px 8px", borderBottom: "1px solid "+C.bd+"50", textAlign: j === 0 ? "left" : "center", background: isAllium ? C.ag : "transparent", color: j === 0 ? C.tm : isCheck ? C.gn : isX ? C.rd+"90" : C.tx, fontWeight: j === 0 ? 600 : isAllium ? 600 : 400, fontSize: j === 0 ? 10.5 : 11 }}>{cell}</td>;
            })}</tr>)}
          </tbody>
        </table>
      </div>
    </div>

    {/* Detailed Breakdowns */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
      {[
        { name: "vs. Dune Analytics", icon: "\uD83D\uDCCA", strengths: ["Largest community & dashboard library", "Good SQL editor (DuneSQL)", "Free tier with public queries", "60+ chains"], weaknesses: ["No production APIs (dashboard-only)", "Minutes-hours data freshness", "No streaming / Kafka", "No enriched schemas (DEX, NFT, PnL)", "No enterprise SLA or dedicated support"], allium: "Allium wins on freshness (3-5s vs minutes), production APIs (90K+ RPS), enriched schemas, and enterprise delivery (Datashare, Kafka)." },
        { name: "vs. The Graph", icon: "\u2B21", strengths: ["Decentralized indexing network", "Good for custom subgraphs", "Fast for specific contract events", "Large developer ecosystem"], weaknesses: ["Requires building & maintaining subgraphs", "No cross-chain joins", "No enriched schemas out of the box", "GRT token economics add complexity", "No historical analytics"], allium: "Allium wins on zero-setup (no subgraphs needed), 115+ chains unified in SQL, and pre-built enriched schemas across DEX, NFT, lending, balances." },
        { name: "vs. Nansen", icon: "\uD83D\uDD0D", strengths: ["Strong wallet labeling & smart money tracking", "Good UI for non-technical users", "Token God Mode analytics", "Early mover in wallet intelligence"], weaknesses: ["Limited chain coverage (15+)", "Dashboard-only (no raw data access)", "No SQL querying", "No streaming or datashare", "No custom schemas or data delivery"], allium: "Allium wins on chain coverage (115+ vs 15+), SQL access, production APIs, data delivery (Datashare/Kafka), and enriched schemas." },
        { name: "vs. Chainalysis / TRM", icon: "\uD83D\uDEE1\uFE0F", strengths: ["Industry-standard compliance tools", "Strong entity labeling for AML/KYC", "Regulatory relationships", "Risk scoring algorithms"], weaknesses: ["Compliance-focused, not general-purpose", "Limited analytics capabilities", "No SQL or data exploration", "Very expensive enterprise licensing", "No realtime APIs for app development"], allium: "Allium complements compliance tools. Use Chainalysis/TRM for AML, Allium for everything else — analytics, app data, research, accounting." },
      ].map((comp, i) => <div key={i} style={{ background: C.sf, border: "1px solid "+C.bd, borderRadius: 12, padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.tx, marginBottom: 10 }}>{comp.icon} {comp.name}</div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.gn, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Their Strengths</div>
          {comp.strengths.map((s, j) => <div key={j} style={{ fontSize: 11, color: C.tm, marginBottom: 2, paddingLeft: 10 }}>{"\u2022"} {s}</div>)}
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.rd, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Their Gaps</div>
          {comp.weaknesses.map((w, j) => <div key={j} style={{ fontSize: 11, color: C.tm, marginBottom: 2, paddingLeft: 10 }}>{"\u2022"} {w}</div>)}
        </div>
        <div style={{ padding: 10, background: C.ag, borderRadius: 7, border: "1px solid "+C.ac+"20", fontSize: 11.5, color: C.tx, lineHeight: 1.5 }}><strong style={{ color: C.ac }}>Allium Edge:</strong> {comp.allium}</div>
      </div>)}
    </div>

    {/* When to use what */}
    <div style={{ background: C.sf, border: "1px solid "+C.bd, borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.tx, marginBottom: 12 }}>{"\uD83C\uDFAF"} Positioning Guide — When to Use Each</div>
      <div style={{ display: "grid", gap: 8 }}>
        {[
          { scenario: "Building a wallet or DeFi app", rec: "Allium Realtime APIs", why: "Sub-second data, 90K+ RPS proven at Phantom scale. The Graph requires custom subgraphs." },
          { scenario: "Internal analytics & dashboards", rec: "Allium Explorer or Dune", why: "Dune is good for public dashboards. Allium wins for private enterprise analytics with Datashare." },
          { scenario: "AML/KYC compliance", rec: "Chainalysis + Allium", why: "Use Chainalysis for risk scoring, Allium for the underlying data infrastructure and custom analytics." },
          { scenario: "Research & investment thesis", rec: "Allium Datashares", why: "Petabyte-scale data in your own Snowflake. Dune/Flipside work for quick explorations but can't scale." },
          { scenario: "Streaming to data pipeline", rec: "Allium Datastreams", why: "Kafka/PubSub/SNS with guaranteed delivery. Only Goldsky competes here, but with fewer chains." },
          { scenario: "Smart money / wallet tracking", rec: "Nansen or Allium Wallet 360", why: "Nansen has strong labels. Allium Wallet 360 is catching up with deeper cross-chain data." },
        ].map((s, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 10, padding: 12, background: C.bg, borderRadius: 8, border: "1px solid "+C.bd, fontSize: 12 }}>
          <div style={{ fontWeight: 600, color: C.tx }}>{s.scenario}</div>
          <div style={{ color: C.ac, fontWeight: 600 }}>{s.rec}</div>
          <div style={{ color: C.tm }}>{s.why}</div>
        </div>)}
      </div>
    </div>
  </div>;
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
  const [emailStyle, setEmailStyle] = useState("pas");
  const [tab, setTab] = useState("research");
  const [theme, setTheme] = useState("dark");
  C = theme === "dark" ? DARK : LIGHT;
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
      const pain2 = (co.painPoints || [])[1] || "data fragmentation across chains";
      pitch.emailData = { topUC, topProds, topCust, pain, pain2 };
      setRes({ co, st: Array.isArray(st) ? st : [st], ucs, prods, cust, pitch, d });
    } catch (e) { setErr(e.message); } finally { setLd(false); setPh(""); }
  }

  async function runViz(cat) {
    const q = QUERIES[cat]; if (!q) return;
    setVl(true); setVe(null); setVd(null); setVq(q);
    try {
      const r = await fetch("/api/alliumquery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql: q.sql }) });
      const j = await r.json();
      if (j.error) { setVe(j.error); return; }
      const rows = j.data || j;
      if (Array.isArray(rows) && rows.length) { setVd(rows.map(row => { const nr = {}; for (const [k, v] of Object.entries(row)) nr[k.toUpperCase()] = v; return nr; })); }
      else setVe("No data returned. Try another query.");
    } catch (e) { setVe(e.message); } finally { setVl(false); }
  }

  function genEmail(style, R) {
    if (!R) return "";
    const co = R.co; const ed = R.pitch.emailData || {};
    const nm = co.name; const ind = co.industry || "your space";
    const rel = co.blockchainRelevance ? co.blockchainRelevance.slice(0, 100) : "the blockchain space";
    const p1 = ed.pain || "managing blockchain data at scale";
    const p2 = ed.pain2 || "data fragmentation";
    const tc = ed.topCust || "Visa, Stripe, Coinbase";
    const tp = ed.topProds || "Allium Explorer and Developer APIs";
    const uc = ed.topUC || "blockchain data";
    const ce = R.pitch.competitiveEdge || "";

    if (style === "pas") return "Subject: " + p1 + " at " + nm + "?\n\nHi [Name],\n\nMost " + ind.toLowerCase() + " teams I talk to are struggling with " + p1 + ". It gets worse as you scale \u2014 " + p2 + " starts eating into engineering time that should go toward shipping product.\n\nWe built Allium to solve exactly this. Our " + tp + " give you clean, indexed data across 130+ blockchains with sub-second freshness. Companies like " + tc + " use us in production today.\n\nWould a 15-minute walkthrough be worth your time this week?\n\nBest,\n[Your Name]\nAllium \u2014 allium.so";

    if (style === "aida") return "Subject: How " + tc.split(",")[0].trim() + " gets blockchain data in under 5 seconds\n\nHi [Name],\n\n" + tc + " all have something in common: they stopped building blockchain data pipelines in-house.\n\nAllium indexes 130+ chains and serves production-grade data through " + tp + " \u2014 the same infra behind Phantom's 15M monthly users.\n\nFor " + nm + ", this could mean going from weeks of pipeline work to querying live " + uc.toLowerCase() + " data in minutes. " + (ce ? ce : "") + "\n\nI put together a quick teardown of how this would work for your stack. Want me to send it over?\n\nBest,\n[Your Name]\nAllium \u2014 allium.so";

    if (style === "direct") return "Subject: Quick idea for " + nm + "\n\nHi [Name],\n\nI have an idea I can explain in 10 minutes that could save " + nm + "'s data team weeks of pipeline work.\n\nWe recently helped a company in " + ind.toLowerCase() + " cut their blockchain data integration from 3 months to 2 days using our " + tp + ".\n\nCan I share how? Happy to do Tuesday or Thursday.\n\n[Your Name]\nAllium \u2014 allium.so";

    if (style === "social") return "Subject: Joining " + tc.split(",")[0].trim() + " and " + tc.split(",")[1]?.trim() + "?\n\nHi [Name],\n\nI noticed " + nm + " is doing interesting work in " + rel + ".\n\nWe power the blockchain data infrastructure for " + tc + " \u2014 and based on what I see at " + nm + ", you might be running into similar challenges around " + p1 + ".\n\nHere's what our customers typically see:\n\n\u2022 90% less time building data pipelines\n\u2022 130+ chains indexed, sub-second freshness\n\u2022 Production-grade APIs handling 90K+ RPS\n\nWorth a quick conversation?\n\nBest,\n[Your Name]\nAllium \u2014 allium.so";

    if (style === "question") return "Subject: Quick question about " + nm + "'s data stack\n\nHi [Name],\n\nCurious \u2014 how is " + nm + " currently handling " + p1 + "?\n\nI ask because most teams in " + ind.toLowerCase() + " I talk to are either building pipelines in-house (expensive) or using multiple vendors (fragmented). Neither scales well.\n\nWe built a third option that companies like " + tc + " now rely on in production. Would love to hear how you're thinking about it.\n\nEither way, happy to share what we're seeing across the industry.\n\nBest,\n[Your Name]\nAllium \u2014 allium.so";

    return "";
  }

  const R = res;
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.tx, fontFamily: "'DM Sans',-apple-system,sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{"*{box-sizing:border-box}::selection{background:"+C.ac+"40}input::placeholder{color:"+C.td+"}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:"+C.bd+";border-radius:3px}@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}.fu{animation:fadeUp .35s ease-out forwards}"}</style>
      <div style={{ padding: "20px 28px", borderBottom: "1px solid "+C.bd, display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(180deg,"+C.sf+" 0%,"+C.bg+" 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,"+C.ac+","+C.pu+")", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, color: "#fff" }}>A</div>
          <div><div style={{ fontSize: 15, fontWeight: 700 }}>Allium Sales Intelligence</div><div style={{ fontSize: 10.5, color: C.tm }}>Research {"\u2192"} Match {"\u2192"} Pitch {"\u2192"} Propose</div></div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}><Bg color={C.gn}>80+ Chains</Bg><Bg color={C.pu}>16 Logos</Bg><Bg color={C.am}>Live Viz</Bg>
          <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} style={{ marginLeft: 6, padding: "4px 12px", borderRadius: 7, border: "1px solid "+C.bd, background: C.bg, color: C.tm, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>{theme === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19"}</button>
        </div>
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

        {R && <div style={{ display: "flex", gap: 4, marginBottom: 16, background: C.sf, borderRadius: 10, padding: 4, border: "1px solid "+C.bd }}>
          {[["research", "\uD83D\uDD0D Research"], ["proposal", "\uD83D\uDCCB Proposal"], ["roadmap", "\uD83D\uDDFA\uFE0F Roadmap"], ["competitive", "\u2694\uFE0F Competitive"]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "none", background: tab === k ? C.ac : "transparent", color: tab === k ? "#fff" : C.tm, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all .15s" }}>{label}</button>
          ))}
        </div>}

        {R && tab === "proposal" && <Proposal R={R} />}
        {R && tab === "roadmap" && <Roadmap R={R} />}
        {R && tab === "competitive" && <Competitive />}

        {R && tab === "research" && <div className="fu">
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {[["pas", "Pain \u2192 Solution"], ["aida", "Attention Grabber"], ["direct", "Short & Direct"], ["social", "Social Proof"], ["question", "Open Question"]].map(([k, label]) => (
                <button key={k} onClick={() => setEmailStyle(k)} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid " + (emailStyle === k ? C.ac : C.bd), background: emailStyle === k ? C.ag : C.bg, color: emailStyle === k ? C.ac : C.tm, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all .15s" }}>{label}</button>
              ))}
            </div>
            <div style={{ position: "relative" }}>
              <button onClick={() => { navigator.clipboard.writeText(genEmail(emailStyle, R)); }} style={{ position: "absolute", top: 10, right: 10, padding: "4px 12px", background: C.sf, border: "1px solid " + C.bd, borderRadius: 6, color: C.tm, fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", zIndex: 1 }}>Copy</button>
              <div style={{ padding: 18, background: C.bg, borderRadius: 9, border: "1px solid "+C.bd, fontSize: 13, color: C.tx, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{genEmail(emailStyle, R)}</div>
            </div>
            <div style={{ marginTop: 10, padding: 10, background: C.ag, borderRadius: 7, border: "1px solid "+C.ac+"28", fontSize: 11, color: C.tm }}><strong style={{ color: C.ac }}>Tip:</strong> Always personalize the [Name] field and the subject line. Reference something specific — a recent blog post, funding round, or product launch — in the first sentence.</div>
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
