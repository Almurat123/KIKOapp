Last login: Tue Feb  3 15:26:17 on ttys012
almurat@almuratdeMacBook-Pro ~ % cd /Users/almurat/KiKo/kiko-api && npm run dev

> kiko-api@1.0.0 dev
> concurrently -k -n api,python "tsx watch src/index.ts" "cd ../kiko-python && python3 main.py"

[python] INFO:__main__:✅ Grok service mounted at /grok
[python] INFO:moderation.models:✅ OpenAI Moderation API initialized (lightweight mode)
[python] INFO:__main__:✅ Moderation service mounted at /moderation
[api] [Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] [2026-02-03T12:39:53.984Z] [INFO] [SYS-1001] Zora SDK initialized with API Key
[api] [SocialJob] Found user list at: /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
[api] [SkillRegistry:exec] Loading skills from /Users/almurat/KiKo/kiko-api/src/skills...
[api] [SkillRegistry:exec] Loaded skill: copy_trade
[api] [SkillRegistry:exec] Loaded skill: market_macro
[api] [SkillRegistry:exec] Loaded skill: polymarket_prediction
[api] [SkillRegistry:exec] Loaded skill: risk_security
[api] [SkillRegistry:exec] Loaded skill: social_farcaster
[api] [SkillRegistry:exec] Loaded skill: swap
[api] [SkillRegistry:exec] Loaded skill: token_alert
[api] [SkillRegistry:exec] Loaded skill: token_analysis
[api] [SkillRegistry:exec] Loaded skill: wallet_portfolio
[api] [SkillRegistry:exec] Loaded skill: welcome_onboarding
[api] [SkillRegistry:exec] Loaded skill: zora_nfts
[api] [SkillRegistry:clean] Loading skills from /Users/almurat/KiKo/kiko-api/src/skills...
[api] [SkillRegistry:clean] Loaded skill: copy_trade
[api] [SkillRegistry:clean] Loaded skill: market_macro
[api] [SkillRegistry:clean] Loaded skill: polymarket_prediction
[api] [SkillRegistry:clean] Loaded skill: risk_security
[api] [SkillRegistry:clean] Loaded skill: social_farcaster
[api] [SkillRegistry:clean] Loaded skill: swap
[api] [SkillRegistry:clean] Loaded skill: token_alert
[api] [SkillRegistry:clean] Loaded skill: token_analysis
[api] [SkillRegistry:clean] Loaded skill: wallet_portfolio
[api] [SkillRegistry:clean] Loaded skill: welcome_onboarding
[api] [SkillRegistry:clean] Loaded skill: zora_nfts
[api] [2026-02-03T12:39:54.571Z] [WARN] [SYS-1001] Public folder not found - skipping static file serving | DATA: {"path":"/Users/almurat/KiKo/kiko-api/public"}
[api] [2026-02-03T12:39:54.572Z] [INFO] [SYS-1001] Initializing services... | DATA: {"env":"development","port":3001,"database":"configured","privy":"✅ Configured"}
[api] [Prisma] DB connection is healthy
[api] [2026-02-03T12:39:54.630Z] [INFO] [SYS-1004] Database connection successful
[api] [DataRetention] Checking retention policies...
[api] [DataRetention] Starting cleanup job...
[api] [2026-02-03T12:39:54.686Z] [INFO] [SYS-1005] Redis initialized
[api] [2026-02-03T12:39:54.686Z] [INFO] [SYS-1001] Starting server on port 3001...
[api] {"level":30,"time":1770122394713,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","msg":"Server listening at http://0.0.0.0:3001"}
[api] [2026-02-03T12:39:54.714Z] [INFO] [SYS-1001] Server listening | DATA: {"url":"http://localhost:3001","health":"http://localhost:3001/health"}
[api] [2026-02-03T12:39:54.714Z] [INFO] [SYS-1001] RPC health monitor started
[api] [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
[api] [TokenJob] Scheduled: Every 5min (Ethereum, Solana, Base, BSC, Arbitrum, Optimism, Polygon)
[api] [SocialJob] Scheduled: Discovery (30m), Refresh (4h), Scoring (5m)
[api] [2026-02-03T12:39:54.743Z] [INFO] [SYS-1001] Background jobs started
[api] [2026-02-03T12:39:54.743Z] [INFO] [SYS-1001] Initializing auto trade service...
[api] [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
[api] [2026-02-03T12:39:54.743Z] [INFO] [SYS-1001] Auto trade service initialized (Solana watcher + EVM webhook enabled) | DATA: {"mode":"hybrid"}
[api] [2026-02-03T12:39:54.743Z] [INFO] [SYS-1001] Auto trade service started
[api] [PositionMonitor] Starting position monitor (every 30s)...
[api] [2026-02-03T12:39:54.743Z] [INFO] [SYS-1001] Position monitor started
[api] [2026-02-03T12:39:54.743Z] [INFO] [SYS-1001] Token Alert Service started
[api] [2026-02-03T12:39:54.743Z] [INFO] [SYS-1001] Token alert service started
[api] [ChatWorker] Started polling for AI tasks (interval: 3000ms)
[api] [2026-02-03T12:39:54.743Z] [INFO] [SYS-1001] Chat worker started
[api] [2026-02-03T12:39:54.743Z] [INFO] [SYS-1001] Starting Global Zora Alpha Detector (API Polling) | DATA: {"thresholds":{"farcaster":50000,"twitter":500000,"instagram":500000,"tiktok":500000},"interval":60000}
[api] [2026-02-03T12:39:54.743Z] [INFO] [SYS-1001] 🎉 All services initialized!
[api] [DataRetention] Cleaned 43 records from TrendingCast
[api] [DataRetention] Cleanup job completed.
[python] INFO:chromadb.telemetry.product.posthog:Anonymized telemetry enabled. See                     https://docs.trychroma.com/telemetry for more information.
[python] INFO:__main__:✅ RAG service mounted at /rag
[python] INFO:     Started server process [32058]
[python] INFO:     Waiting for application startup.
[python] INFO:     Application startup complete.
[python] INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
[api] [MarketJob] Running startup staleness check...
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:39:59.759Z] [INFO] [SYS-1001] No open positions to monitor
[api] [Job] ✅ Loaded 436 real hot users from /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Job] ✅ Using 436 real hot users from analysis
[api] [SocialJob] fetchCastsFromUsers starting with 436 FIDs, target: 1000
[api] [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
[api] [2026-02-03T12:40:00.764Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"ethereum","limit":100}
[api] [2026-02-03T12:40:00.773Z] [INFO] [SYS-1007] SocialRepo: Recalculated heat scores for 713 casts
[api] [2026-02-03T12:40:00.773Z] [INFO] [SYS-1007][18ms] Timer finished: recalc_heat_scores | DATA: {"count":713,"timerLabel":"recalc_heat_scores"}
[api] [MarketRepo] Memory cache miss, loading from PostgreSQL...
[api] [MarketRepo] Loaded market overview into memory cache
[api] Saved 15 trending tokens to database via Prisma with retry protection
[api] [MarketJob] Trending tokens refreshed: 15 tokens
[api] [2026-02-03T12:40:02.715Z] [INFO] [WTC-2002] Found addresses via WebSocket | DATA: {"count":190,"chain":"ethereum"}
[api] [2026-02-03T12:40:03.417Z] [ERROR] [API-5002] defillama-stablecoins-circulating failed after 1 attempts | DATA: {"error":"HTTP 404: ","url":"https://api.llama.fi/stablecoins/circulating"}
[api] Error fetching stablecoins circulating cap: Error: HTTP 404: 
[api]     at Module.fetchJson (/Users/almurat/KiKo/kiko-api/src/config/unifiedApiService.ts:169:15)
[api]     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
[api]     at async getStablecoinsCirculating (/Users/almurat/KiKo/kiko-api/src/services/defillama.ts:488:18)
[api]     at async Promise.all (index 2)
[api]     at async refreshMarketOverview (/Users/almurat/KiKo/kiko-api/src/jobs/marketDataJob.ts:57:108)
[api]     at async Timeout._onTimeout (/Users/almurat/KiKo/kiko-api/src/jobs/marketDataJob.ts:256:5)
[api] DeFiLlama Derivatives Open Interest: $43.93B
[api] Market overview saved to database and memory cache
[api] [MarketJob] ✅ Overview refreshed successfully
[api] Saved batch 1/351
[api] Saved batch 2/351
[api] Saved batch 3/351
[api] Saved batch 4/351
[api] Saved batch 5/351
[api] Saved batch 6/351
[api] Saved batch 7/351
[api] Saved batch 8/351
[api] Saved batch 9/351
[api] Saved batch 10/351
[api] Saved batch 11/351
[api] Saved batch 12/351
[api] Saved batch 13/351
[api] Saved batch 14/351
[api] Saved batch 15/351
[api] Saved batch 16/351
[api] Saved batch 17/351
[api] Saved batch 18/351
[api] Saved batch 19/351
[api] Saved batch 20/351
[api] Saved batch 21/351
[api] Saved batch 22/351
[api] Saved batch 23/351
[api] Saved batch 24/351
[api] Saved batch 25/351
[api] Saved batch 26/351
[api] Saved batch 27/351
[api] Saved batch 28/351
[api] Saved batch 29/351
[api] Saved batch 30/351
[api] Saved batch 31/351
[api] Saved batch 32/351
[api] Saved batch 33/351
[api] Saved batch 34/351
[api] Saved batch 35/351
[api] Saved batch 36/351
[api] Saved batch 37/351
[api] Saved batch 38/351
[api] Saved batch 39/351
[api] Saved batch 40/351
[api] Saved batch 41/351
[api] Saved batch 42/351
[api] Saved batch 43/351
[api] Saved batch 44/351
[api] Saved batch 45/351
[api] Saved batch 46/351
[api] Saved batch 47/351
[api] Saved batch 48/351
[api] Saved batch 49/351
[api] Saved batch 50/351
[api] Saved batch 51/351
[api] Saved batch 52/351
[api] Saved batch 53/351
[api] Saved batch 54/351
[api] Saved batch 55/351
[api] Saved batch 56/351
[api] Saved batch 57/351
[api] Saved batch 58/351
[api] Saved batch 59/351
[api] Saved batch 60/351
[api] Saved batch 61/351
[api] Saved batch 62/351
[api] Saved batch 63/351
[api] Saved batch 64/351
[api] Saved batch 65/351
[api] Saved batch 66/351
[api] Saved batch 67/351
[api] Saved batch 68/351
[api] Saved batch 69/351
[api] Saved batch 70/351
[api] Saved batch 71/351
[api] Saved batch 72/351
[api] Saved batch 73/351
[api] Saved batch 74/351
[api] Saved batch 75/351
[api] Saved batch 76/351
[api] Saved batch 77/351
[api] Saved batch 78/351
[api] Saved batch 79/351
[api] Saved batch 80/351
[api] Saved batch 81/351
[api] Saved batch 82/351
[api] Saved batch 83/351
[api] Saved batch 84/351
[api] Saved batch 85/351
[api] Saved batch 86/351
[api] Saved batch 87/351
[api] Saved batch 88/351
[api] Saved batch 89/351
[api] Saved batch 90/351
[api] Saved batch 91/351
[api] Saved batch 92/351
[api] Saved batch 93/351
[api] Saved batch 94/351
[api] Saved batch 95/351
[api] Saved batch 96/351
[api] Saved batch 97/351
[api] Saved batch 98/351
[api] Saved batch 99/351
[api] Saved batch 100/351
[api] Saved batch 101/351
[api] Saved batch 102/351
[api] Saved batch 103/351
[api] Saved batch 104/351
[api] Saved batch 105/351
[api] Saved batch 106/351
[api] Saved batch 107/351
[api] Saved batch 108/351
[api] Saved batch 109/351
[api] Saved batch 110/351
[api] Saved batch 111/351
[api] Saved batch 112/351
[api] Saved batch 113/351
[api] Saved batch 114/351
[api] Saved batch 115/351
[api] Saved batch 116/351
[api] Saved batch 117/351
[api] Saved batch 118/351
[api] Saved batch 119/351
[api] Saved batch 120/351
[api] Saved batch 121/351
[api] Saved batch 122/351
[api] Saved batch 123/351
[api] Saved batch 124/351
[api] Saved batch 125/351
[api] Saved batch 126/351
[api] Saved batch 127/351
[api] Saved batch 128/351
[api] Saved batch 129/351
[api] Saved batch 130/351
[api] Saved batch 131/351
[api] Saved batch 132/351
[api] Saved batch 133/351
[api] Saved batch 134/351
[api] Saved batch 135/351
[api] Saved batch 136/351
[api] Saved batch 137/351
[api] Saved batch 138/351
[api] Saved batch 139/351
[api] Saved batch 140/351
[api] Saved batch 141/351
[api] Saved batch 142/351
[api] Saved batch 143/351
[api] Saved batch 144/351
[api] Saved batch 145/351
[api] Saved batch 146/351
[api] Saved batch 147/351
[api] Saved batch 148/351
[api] Saved batch 149/351
[api] Saved batch 150/351
[api] Saved batch 151/351
[api] Saved batch 152/351
[api] Saved batch 153/351
[api] Saved batch 154/351
[api] Saved batch 155/351
[api] Saved batch 156/351
[api] Saved batch 157/351
[api] Saved batch 158/351
[api] Saved batch 159/351
[api] Saved batch 160/351
[api] Saved batch 161/351
[api] Saved batch 162/351
[api] Saved batch 163/351
[api] Saved batch 164/351
[api] Saved batch 165/351
[api] Saved batch 166/351
[api] Saved batch 167/351
[api] Saved batch 168/351
[api] Saved batch 169/351
[api] Saved batch 170/351
[api] Saved batch 171/351
[api] Saved batch 172/351
[api] Saved batch 173/351
[api] Saved batch 174/351
[api] Saved batch 175/351
[api] Saved batch 176/351
[api] Saved batch 177/351
[api] Saved batch 178/351
[api] Saved batch 179/351
[api] Saved batch 180/351
[api] Saved batch 181/351
[api] Saved batch 182/351
[api] Saved batch 183/351
[api] Saved batch 184/351
[api] Saved batch 185/351
[api] Saved batch 186/351
[api] Saved batch 187/351
[api] Saved batch 188/351
[api] Saved batch 189/351
[api] Saved batch 190/351
[api] Saved batch 191/351
[api] Saved batch 192/351
[api] Saved batch 193/351
[api] Saved batch 194/351
[api] Saved batch 195/351
[api] Saved batch 196/351
[api] Saved batch 197/351
[api] Saved batch 198/351
[api] Saved batch 199/351
[api] Saved batch 200/351
[api] Saved batch 201/351
[api] Saved batch 202/351
[api] Saved batch 203/351
[api] Saved batch 204/351
[api] Saved batch 205/351
[api] Saved batch 206/351
[api] Saved batch 207/351
[api] Saved batch 208/351
[api] Saved batch 209/351
[api] Saved batch 210/351
[api] Saved batch 211/351
[api] Saved batch 212/351
[api] Saved batch 213/351
[api] Saved batch 214/351
[api] Saved batch 215/351
[api] Saved batch 216/351
[api] Saved batch 217/351
[api] Saved batch 218/351
[api] Saved batch 219/351
[api] Saved batch 220/351
[api] Saved batch 221/351
[api] Saved batch 222/351
[api] Saved batch 223/351
[api] Saved batch 224/351
[api] Saved batch 225/351
[api] Saved batch 226/351
[api] Saved batch 227/351
[api] Saved batch 228/351
[api] Saved batch 229/351
[api] Saved batch 230/351
[api] Saved batch 231/351
[api] Saved batch 232/351
[api] Saved batch 233/351
[api] Saved batch 234/351
[api] Saved batch 235/351
[api] Saved batch 236/351
[api] Saved batch 237/351
[api] Saved batch 238/351
[api] Saved batch 239/351
[api] Saved batch 240/351
[api] Saved batch 241/351
[api] Saved batch 242/351
[api] Saved batch 243/351
[api] Saved batch 244/351
[api] Saved batch 245/351
[api] Saved batch 246/351
[api] Saved batch 247/351
[api] Saved batch 248/351
[api] Saved batch 249/351
[api] Saved batch 250/351
[api] Saved batch 251/351
[api] Saved batch 252/351
[api] Saved batch 253/351
[api] Saved batch 254/351
[api] Saved batch 255/351
[api] Saved batch 256/351
[api] Saved batch 257/351
[api] Saved batch 258/351
[api] Saved batch 259/351
[api] Saved batch 260/351
[api] Saved batch 261/351
[api] Saved batch 262/351
[api] Saved batch 263/351
[api] Saved batch 264/351
[api] Saved batch 265/351
[api] Saved batch 266/351
[api] Saved batch 267/351
[api] Saved batch 268/351
[api] Saved batch 269/351
[api] Saved batch 270/351
[api] Saved batch 271/351
[api] Saved batch 272/351
[api] Saved batch 273/351
[api] Saved batch 274/351
[api] Saved batch 275/351
[api] Saved batch 276/351
[api] Saved batch 277/351
[api] Saved batch 278/351
[api] Saved batch 279/351
[api] Saved batch 280/351
[api] Saved batch 281/351
[api] Saved batch 282/351
[api] Saved batch 283/351
[api] Saved batch 284/351
[api] Saved batch 285/351
[api] Saved batch 286/351
[api] Saved batch 287/351
[api] Saved batch 288/351
[api] Saved batch 289/351
[api] Saved batch 290/351
[api] Saved batch 291/351
[api] Saved batch 292/351
[api] Saved batch 293/351
[api] Saved batch 294/351
[api] Saved batch 295/351
[api] Saved batch 296/351
[api] Saved batch 297/351
[api] Saved batch 298/351
[api] Saved batch 299/351
[api] Saved batch 300/351
[api] Saved batch 301/351
[api] Saved batch 302/351
[api] Saved batch 303/351
[api] Saved batch 304/351
[api] Saved batch 305/351
[api] Saved batch 306/351
[api] Saved batch 307/351
[api] Saved batch 308/351
[api] Saved batch 309/351
[api] Saved batch 310/351
[api] Saved batch 311/351
[api] Saved batch 312/351
[api] Saved batch 313/351
[api] Saved batch 314/351
[api] Saved batch 315/351
[api] Saved batch 316/351
[api] Saved batch 317/351
[api] Saved batch 318/351
[api] Saved batch 319/351
[api] Saved batch 320/351
[api] Saved batch 321/351
[api] Saved batch 322/351
[api] Saved batch 323/351
[api] Saved batch 324/351
[api] Saved batch 325/351
[api] Saved batch 326/351
[api] Saved batch 327/351
[api] Saved batch 328/351
[api] Saved batch 329/351
[api] Saved batch 330/351
[api] Saved batch 331/351
[api] Saved batch 332/351
[api] Saved batch 333/351
[api] Saved batch 334/351
[api] Saved batch 335/351
[api] Saved batch 336/351
[api] Saved batch 337/351
[api] Saved batch 338/351
[api] Saved batch 339/351
[api] Saved batch 340/351
[api] Saved batch 341/351
[api] Saved batch 342/351
[api] Saved batch 343/351
[api] Saved batch 344/351
[api] Saved batch 345/351
[api] Saved batch 346/351
[api] Saved batch 347/351
[api] Saved batch 348/351
[api] Saved batch 349/351
[api] Saved batch 350/351
[api] Saved batch 351/351
[api] Saved 7019 protocols to database and memory cache
[api] [MarketJob] ✅ Protocols refreshed successfully: 7019 protocols
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [MarketJob] Fetching chain metrics from Dune...
[api] [2026-02-03T12:40:07.202Z] [INFO] [API-5001] Fetching chain metrics from 3 Dune queries: 6250722, 6240250, 6254391
[api] [2026-02-03T12:40:07.535Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":28,"limit":200}
[api] [2026-02-03T12:40:09.461Z] [INFO] [API-5001] All Dune chain queries completed in 2259ms
[api] [2026-02-03T12:40:09.461Z] [INFO] [API-5001] Processing 46 rows from query 6250722
[api] [2026-02-03T12:40:09.463Z] [INFO] [API-5001] Processing 5 rows from query 6240250
[api] [2026-02-03T12:40:09.463Z] [INFO] [API-5001] Processing 1 rows from query 6254391
[api] [2026-02-03T12:40:09.463Z] [INFO] [API-5001] Fetching contracts data from query 6256459
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:40:09.765Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:40:09.972Z] [INFO] [API-5001] Processing 32 contract rows
[api] [2026-02-03T12:40:09.972Z] [INFO] [API-5001] Successfully fetched metrics for 52 chains from 52 total rows
[api] [MarketJob] Fetched metrics for 52 chains from Dune
[api] [DeFiLlama] Starting with 52 Dune chains
[api] [DeFiLlama] Enriched Dune chain "bnb" (Display: "BSC") -> "BSC" with TVL: $6.16B
[api] [DeFiLlama] Enriched Dune chain "ethereum" (Display: "Ethereum") -> "Ethereum" with TVL: $59.56B
[api] [DeFiLlama] Enriched Dune chain "base" (Display: "Base") -> "Base" with TVL: $4.23B
[api] [DeFiLlama] Enriched Dune chain "arbitrum" (Display: "Arbitrum") -> "Arbitrum" with TVL: $2.45B
[api] [DeFiLlama] Enriched Dune chain "avalanche_c" (Display: "Avalanche") -> "Avalanche" with TVL: $0.96B
[api] [DeFiLlama] Enriched Dune chain "hyperevm" (Display: "Hyperliquid L1") -> "Hyperliquid L1" with TVL: $1.61B
[api] [DeFiLlama] Enriched Dune chain "polygon" (Display: "Polygon") -> "Polygon" with TVL: $1.19B
[api] [DeFiLlama] Enriched Dune chain "celo" (Display: "Celo") -> "Celo" with TVL: $0.04B
[api] [DeFiLlama] Enriched Dune chain "unichain" (Display: "Unichain") -> "Unichain" with TVL: $0.07B
[api] [DeFiLlama] Enriched Dune chain "optimism" (Display: "OP Mainnet") -> "OP Mainnet" with TVL: $0.24B
[api] [DeFiLlama] Enriched Dune chain "linea" (Display: "Linea") -> "Linea" with TVL: $0.13B
[api] [DeFiLlama] Enriched Dune chain "plasma" (Display: "Plasma") -> "Plasma" with TVL: $3.00B
[api] [DeFiLlama] Enriched Dune chain "berachain" (Display: "Berachain") -> "Berachain" with TVL: $0.10B
[api] [DeFiLlama] Enriched Dune chain "katana" (Display: "Katana") -> "Katana" with TVL: $0.34B
[api] [DeFiLlama] Enriched Dune chain "mantle" (Display: "Mantle") -> "Mantle" with TVL: $0.27B
[api] [DeFiLlama] Enriched Dune chain "sei" (Display: "Sei") -> "Sei" with TVL: $0.12B
[api] [DeFiLlama] Enriched Dune chain "gnosis" (Display: "Gnosis") -> "Gnosis" with TVL: $0.12B
[api] [DeFiLlama] Enriched Dune chain "sonic" (Display: "Sonic") -> "Sonic" with TVL: $0.05B
[api] [DeFiLlama] Enriched Dune chain "ink" (Display: "Ink") -> "Ink" with TVL: $0.45B
[api] [DeFiLlama] Enriched Dune chain "plume" (Display: "Plume Mainnet") -> "Plume Mainnet" with TVL: $0.02B
[api] [DeFiLlama] Enriched Dune chain "abstract" (Display: "Abstract") -> "Abstract" with TVL: $0.02B
[api] [DeFiLlama] Enriched Dune chain "zksync" (Display: "ZKsync Era") -> "ZKsync Era" with TVL: $0.03B
[api] [DeFiLlama] Enriched Dune chain "story" (Display: "Story") -> "Story" with TVL: $0.00B
[api] [DeFiLlama] Enriched Dune chain "ronin" (Display: "Ronin") -> "Ronin" with TVL: $0.02B
[api] [DeFiLlama] Enriched Dune chain "ton" (Display: "TON") -> "TON" with TVL: $0.07B
[api] [DeFiLlama] Enriched Dune chain "flare" (Display: "Flare") -> "Flare" with TVL: $0.16B
[api] [DeFiLlama] Enriched Dune chain "monad" (Display: "Monad") -> "Monad" with TVL: $0.21B
[api] [DeFiLlama] Enriched Dune chain "kaia" (Display: "Kaia") -> "Kaia" with TVL: $0.01B
[api] [DeFiLlama] Enriched Dune chain "worldchain" (Display: "World Chain") -> "World Chain" with TVL: $0.03B
[api] [DeFiLlama] Enriched Dune chain "hemi" (Display: "Hemi") -> "Hemi" with TVL: $0.01B
[api] [DeFiLlama] Enriched Dune chain "opbnb" (Display: "opBNB") -> "opBNB" with TVL: $0.02B
[api] [DeFiLlama] Enriched Dune chain "scroll" (Display: "Scroll") -> "Scroll" with TVL: $0.21B
[api] [DeFiLlama] Enriched Dune chain "fantom" (Display: "Fantom") -> "Fantom" with TVL: $0.00B
[api] [DeFiLlama] Enriched Dune chain "flow" (Display: "Flow") -> "Flow" with TVL: $0.04B
[api] [DeFiLlama] Enriched Dune chain "peaq" (Display: "Peaq") -> "Peaq" with TVL: $0.00B
[api] [DeFiLlama] Enriched Dune chain "somnia" (Display: "Somnia") -> "Somnia" with TVL: $0.00B
[api] [DeFiLlama] Enriched Dune chain "corn" (Display: "Corn") -> "Corn" with TVL: $0.00B
[api] [DeFiLlama] Enriched Dune chain "zkevm" (Display: "Polygon zkEVM") -> "Polygon zkEVM" with TVL: $0.00B
[api] [DeFiLlama] Enriched Dune chain "taiko" (Display: "Taiko") -> "Taiko" with TVL: $0.01B
[api] [DeFiLlama] Enriched Dune chain "tac" (Display: "TAC") -> "TAC" with TVL: $0.00B
[api] [DeFiLlama] Enriched Dune chain "nova" (Display: "Arbitrum Nova") -> "Arbitrum Nova" with TVL: $0.00B
[api] [DeFiLlama] Enriched Dune chain "mezo" (Display: "Mezo") -> "Mezo" with TVL: $0.03B
[api] [DeFiLlama] Enriched Dune chain "shape" (Display: "Shape") -> "Shape" with TVL: $0.00B
[api] [DeFiLlama] Enriched Dune chain "boba" (Display: "Boba") -> "Boba" with TVL: $0.00B
[api] [DeFiLlama] Enriched Dune chain "superseed" (Display: "Superseed") -> "Superseed" with TVL: $0.00B
[api] [DeFiLlama] Enriched Dune chain "sophon" (Display: "Sophon") -> "Sophon" with TVL: $0.01B
[api] [DeFiLlama] Enriched Dune chain "aptos" (Display: "Aptos") -> "Aptos" with TVL: $0.36B
[api] [DeFiLlama] Enriched Dune chain "bitcoin" (Display: "Bitcoin") -> "Bitcoin" with TVL: $5.83B
[api] [DeFiLlama] Enriched Dune chain "near" (Display: "Near") -> "Near" with TVL: $0.11B
[api] [DeFiLlama] Enriched Dune chain "starknet" (Display: "Starknet") -> "Starknet" with TVL: $0.31B
[api] [DeFiLlama] Enriched Dune chain "tron" (Display: "Tron") -> "Tron" with TVL: $4.19B
[api] [DeFiLlama] Enriched Dune chain "solana" (Display: "Solana") -> "Solana" with TVL: $7.48B
[api] [DeFiLlama] Created 52 chains with Dune metrics
[api] [2026-02-03T12:40:12.072Z] [INFO] [API-5001] Skipping low liquidity token | DATA: {"symbol":"REQ","liquidity":551.2121}
[api] Saved 52 chains to database
[api] [MarketJob] ✅ Chains refreshed successfully: 52 chains
[api] [2026-02-03T12:40:18.645Z] [INFO] [API-5001] Trending tokens fetch complete | DATA: {"network":"eth","count":118,"limit":200}
[api] [2026-02-03T12:40:18.645Z] [INFO] [API-5001][17881ms] Premium trending tokens fetch complete | DATA: {"count":100,"chain":"ethereum"}
[api] [TokenJob] Got 100 trending tokens for Ethereum
[api] Saved 100 trending tokens for eth to database and memory cache
[api] [TokenJob] Saved 100 tokens for Ethereum to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:40:19.771Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Starting initial token refresh...
[api] [TokenJob] Tokens for Ethereum are fresh, skipping API call
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:40:29.777Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
[api] [2026-02-03T12:40:38.755Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"solana","limit":100}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:40:39.780Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:40:40.372Z] [INFO] [WTC-2002] Found addresses via WebSocket | DATA: {"count":283,"chain":"solana"}
[api] [TokenJob] Skipping refresh for Solana - update already in progress
[api] [2026-02-03T12:40:48.078Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":124,"limit":200}
[api] [2026-02-03T12:40:48.079Z] [INFO] [API-5001][9324ms] Premium trending tokens fetch complete | DATA: {"count":100,"chain":"solana"}
[api] [TokenJob] Got 100 trending tokens for Solana
[api] Saved 100 trending tokens for solana to database and memory cache
[api] [TokenJob] Saved 100 tokens for Solana to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:40:49.786Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:40:59.791Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
[api] [2026-02-03T12:41:04.761Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"base","limit":100}
[api] [2026-02-03T12:41:06.262Z] [INFO] [WTC-2002] Found addresses via WebSocket | DATA: {"count":179,"chain":"base"}
[api] [TokenJob] Skipping refresh for Base - update already in progress
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:41:09.796Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:41:10.615Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":48,"limit":200}
[api] [2026-02-03T12:41:13.722Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-03T12:41:14.972Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-03T12:41:17.219Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:41:19.804Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:41:22.243Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"base","error":"GeckoTerminal backoff active (55s remaining)"}
[api] [2026-02-03T12:41:22.243Z] [INFO] [API-5001][17482ms] Premium trending tokens fetch complete | DATA: {"count":72,"chain":"base"}
[api] [TokenJob] Got 72 trending tokens for Base
[api] Saved 72 trending tokens for base to database and memory cache
[api] [TokenJob] Saved 72 tokens for Base to DB + cache
[api] [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
[api] [2026-02-03T12:41:28.159Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"bsc","limit":100}
[api] [2026-02-03T12:41:29.689Z] [INFO] [WTC-2002] Found addresses via WebSocket | DATA: {"count":196,"chain":"bsc"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:41:29.810Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:41:34.325Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":32,"limit":200}
[api] [2026-02-03T12:41:34.325Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"bsc","error":"GeckoTerminal backoff active (43s remaining)"}
[api] [2026-02-03T12:41:34.326Z] [INFO] [API-5001][6167ms] Premium trending tokens fetch complete | DATA: {"count":77,"chain":"bsc"}
[api] [TokenJob] Got 77 trending tokens for BSC
[api] Saved 77 trending tokens for bsc to database and memory cache
[api] [TokenJob] Saved 77 tokens for BSC to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:41:39.820Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Tokens for BSC are fresh, skipping API call
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:41:49.827Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
[api] [2026-02-03T12:41:54.383Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"arbitrum","limit":100}
[api] [2026-02-03T12:41:54.383Z] [INFO] [API-5001] Using fallback discovery (Boosts + Organic search) | DATA: {"wsAddressCount":0}
[api] [2026-02-03T12:41:57.539Z] [INFO] [API-5001] Merged addresses | DATA: {"wsCount":0,"fallbackCount":2,"totalUnique":2}
[api] [2026-02-03T12:41:59.310Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":7,"limit":200}
[api] [2026-02-03T12:41:59.310Z] [INFO] [API-5001][4927ms] Premium trending tokens fetch complete | DATA: {"count":7,"chain":"arbitrum"}
[api] [TokenJob] DexScreener returned 7 tokens, trying GeckoTerminal fallback...
[api] [TokenJob] Got 7 trending tokens for Arbitrum
[api] [2026-02-03T12:41:59.310Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"arbitrum","error":"GeckoTerminal backoff active (18s remaining)"}
[api] [2026-02-03T12:41:59.310Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"arbitrum","error":"GeckoTerminal backoff active (18s remaining)"}
[api] Saved 7 trending tokens for arbitrum to database and memory cache
[api] [TokenJob] Saved 7 tokens for Arbitrum to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:41:59.834Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Tokens for Arbitrum are fresh, skipping API call
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:42:09.841Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Fetching trending tokens for Optimism via DexScreener Premium...
[api] [2026-02-03T12:42:19.344Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"optimism","limit":100}
[api] [2026-02-03T12:42:19.344Z] [INFO] [API-5001] Using fallback discovery (Boosts + Organic search) | DATA: {"wsAddressCount":0}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:42:19.848Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:42:22.247Z] [INFO] [API-5001] Merged addresses | DATA: {"wsCount":0,"fallbackCount":4,"totalUnique":4}
[api] [TokenJob] Skipping refresh for Optimism - update already in progress
[api] [2026-02-03T12:42:24.045Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":13,"limit":200}
[api] [2026-02-03T12:42:27.308Z] [INFO] [API-5001] Skipping low liquidity token | DATA: {"symbol":"USDC","liquidity":449.0826}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:42:29.850Z] [INFO] [SYS-1001] No open positions to monitor
[api] [REPEATED x19] PREVIOUS LOG API-5001:Skipping low liquidity token
[api] [2026-02-03T12:42:32.837Z] [INFO] [API-5001] Skipping low liquidity token | DATA: {"symbol":"SONNE","liquidity":752.4485}
[api] [SocialJob] Checking Zora coin status for 92 casts...
[api] [2026-02-03T12:42:33.282Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-03T12:42:34.529Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-03T12:42:36.769Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:42:39.856Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:42:41.018Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-03T12:42:41.018Z] [ERROR] [API-5002] GeckoTerminal API error after retries | DATA: {"endpoint":"/networks/optimism/trending_pools?page=10&include=base_token&duration=5m","error":"Rate limit hit, backing off for 60000ms"}
[api] [2026-02-03T12:42:41.018Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"optimism","error":"Rate limit hit, backing off for 60000ms"}
[api] [2026-02-03T12:42:41.018Z] [INFO] [API-5001][21674ms] Premium trending tokens fetch complete | DATA: {"count":13,"chain":"optimism"}
[api] [TokenJob] DexScreener returned 13 tokens, trying GeckoTerminal fallback...
[api] [2026-02-03T12:42:41.019Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"optimism","error":"GeckoTerminal backoff active (60s remaining)"}
[api] [TokenJob] Got 13 trending tokens for Optimism
[api] Saved 13 trending tokens for optimism to database and memory cache
[api] [TokenJob] Saved 13 tokens for Optimism to DB + cache
[api] [TokenJob] Fetching trending tokens for Polygon via DexScreener Premium...
[api] [2026-02-03T12:42:42.324Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"polygon","limit":100}
[api] [2026-02-03T12:42:42.324Z] [INFO] [API-5001] Using fallback discovery (Boosts + Organic search) | DATA: {"wsAddressCount":0}
[api] {"level":30,"time":1770122565438,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50253},"msg":"incoming request"}
[api] [Error Handler] {
[api]   "requestId": "req-2",
[api]   "method": "GET",
[api]   "url": "/api/billing/usage-summary",
[api]   "ip": "127.0.0.1",
[api]   "error": {
[api]     "message": "Missing Authorization Bearer token",
[api]     "name": "Error",
[api]     "code": "UNAUTHORIZED",
[api]     "statusCode": 401,
[api]     "stack": "Error: Missing Authorization Bearer token\n    at Object.requireAuth ([REDACTED_PATH]\n    at hookIterator ([REDACTED_PATH]\n    at next ([REDACTED_PATH]\n    at handleResolve ([REDACTED_PATH]\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)"
[api]   }
[api] }
[api] {"level":30,"time":1770122565447,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1","res":{"statusCode":204},"responseTime":5.480166997760534,"msg":"request completed"}
[api] {"level":30,"time":1770122565448,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50253},"msg":"incoming request"}
[api] {"level":30,"time":1770122565474,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","res":{"statusCode":401},"responseTime":25.78312500193715,"msg":"request completed"}
[api] {"level":30,"time":1770122565476,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWt0Zm5oa3gwMGNka3kwYzN0M2xtMzZpIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzAxMjI1NjUsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc3MDEyNjE2NX0.YpvH3j_vZYm_f_Ox6L89TcuUJW81O-d9JQWsU4hgEOoB-MvHT8V2gGE3SAHpGxwpv5fvSkkBFmzdgJxHgu0uWQ","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50255},"msg":"incoming request"}
[api] {"level":30,"time":1770122565482,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","req":{"method":"OPTIONS","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50256},"msg":"incoming request"}
[api] {"level":30,"time":1770122565483,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","res":{"statusCode":204},"responseTime":0.2690420001745224,"msg":"request completed"}
[api] {"level":30,"time":1770122565483,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50257},"msg":"incoming request"}
[api] {"level":30,"time":1770122565484,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","res":{"statusCode":204},"responseTime":0.1251249983906746,"msg":"request completed"}
[api] {"level":30,"time":1770122565487,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","req":{"method":"GET","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50253},"msg":"incoming request"}
[api] {"level":30,"time":1770122565489,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50256},"msg":"incoming request"}
[api] [2026-02-03T12:42:46.164Z] [INFO] [API-5001][TID:aed1cf0c-56a6-467f-a561-13af3ae32bbf] Merged addresses | DATA: {"wsCount":0,"fallbackCount":4,"totalUnique":4}
[api] {"level":30,"time":1770122566339,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","req":{"method":"OPTIONS","url":"/api/copy-trade/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50257},"msg":"incoming request"}
[api] {"level":30,"time":1770122566341,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","res":{"statusCode":204},"responseTime":1.572665996849537,"msg":"request completed"}
[api] {"level":30,"time":1770122566343,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","req":{"method":"OPTIONS","url":"/api/polymarket/copy/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50262},"msg":"incoming request"}
[api] {"level":30,"time":1770122566346,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","res":{"statusCode":204},"responseTime":2.0268749967217445,"msg":"request completed"}
[api] {"level":30,"time":1770122566347,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","req":{"method":"OPTIONS","url":"/api/copy-trade/positions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50262},"msg":"incoming request"}
[api] {"level":30,"time":1770122566348,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","res":{"statusCode":204},"responseTime":0.7494580000638962,"msg":"request completed"}
[api] {"level":30,"time":1770122566348,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","req":{"method":"OPTIONS","url":"/api/copy-trade/positions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50257},"msg":"incoming request"}
[api] {"level":30,"time":1770122566349,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","res":{"statusCode":204},"responseTime":0.6570000015199184,"msg":"request completed"}
[api] {"level":30,"time":1770122566349,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","req":{"method":"OPTIONS","url":"/api/copy-trade/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50263},"msg":"incoming request"}
[api] {"level":30,"time":1770122566350,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","res":{"statusCode":204},"responseTime":0.8654589988291264,"msg":"request completed"}
[api] {"level":30,"time":1770122566351,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","req":{"method":"OPTIONS","url":"/api/polymarket/copy/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50264},"msg":"incoming request"}
[api] {"level":30,"time":1770122566351,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","res":{"statusCode":204},"responseTime":0.4533750005066395,"msg":"request completed"}
[api] {"level":30,"time":1770122566352,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","req":{"method":"GET","url":"/api/copy-trade/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50262},"msg":"incoming request"}
[api] {"level":30,"time":1770122566354,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","req":{"method":"GET","url":"/api/polymarket/copy/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50257},"msg":"incoming request"}
[api] {"level":30,"time":1770122566354,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","req":{"method":"GET","url":"/api/copy-trade/positions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50263},"msg":"incoming request"}
[api] {"level":30,"time":1770122566355,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","req":{"method":"GET","url":"/api/copy-trade/positions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50264},"msg":"incoming request"}
[api] [2026-02-03T12:42:46.637Z] [INFO] [WS-8001][TID:a5075ccf-878e-41b7-94de-fbe2189db86f] ChatWS Client connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1}
[api] [2026-02-03T12:42:46.637Z] [INFO] [WS-8001][TID:a5075ccf-878e-41b7-94de-fbe2189db86f] ChatWS: User connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl2...","tokenExp":1770126165}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   userIdLength: 35,
[api]   userIdPrefix: 'did:privy:cmj0a3j3f0',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] [CopyTrade] GET /configs - Fetching configs for user did:privy:cmj0a3j3f005fl20c4xkl7195
[api] [CopyTrade] GET /positions - Fetching positions for did:privy:cmj0a3j3f005fl20c4xkl7195
[api] [CopyTrade] GET /positions - Fetching positions for did:privy:cmj0a3j3f005fl20c4xkl7195
[api] {"level":30,"time":1770122566646,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","res":{"statusCode":200},"responseTime":1158.9189579971135,"msg":"request completed"}
[api] {"level":30,"time":1770122566648,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","req":{"method":"GET","url":"/api/copy-trade/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50253},"msg":"incoming request"}
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1770122566660,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","res":{"statusCode":200},"responseTime":307.4589579999447,"msg":"request completed"}
[api] [CopyTrade] GET /configs - Fetching configs for user did:privy:cmj0a3j3f005fl20c4xkl7195
[api] {"level":30,"time":1770122566661,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","res":{"statusCode":200},"responseTime":307.1385000012815,"msg":"request completed"}
[api] {"level":30,"time":1770122566661,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","res":{"statusCode":200},"responseTime":306.58387500047684,"msg":"request completed"}
[api] {"level":30,"time":1770122566661,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","res":{"statusCode":200},"responseTime":306.31095899641514,"msg":"request completed"}
[api] {"level":30,"time":1770122566662,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","req":{"method":"GET","url":"/api/polymarket/copy/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50262},"msg":"incoming request"}
[api] {"level":30,"time":1770122566664,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","res":{"statusCode":200},"responseTime":15.953250002115965,"msg":"request completed"}
[api] {"level":30,"time":1770122566666,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","res":{"statusCode":200},"responseTime":4.124874997884035,"msg":"request completed"}
[api] [2026-02-03T12:42:48.261Z] [INFO] [API-5001][TID:aed1cf0c-56a6-467f-a561-13af3ae32bbf] Processed DexScreener trending candidates | DATA: {"candidates":23,"limit":200}
[api] [2026-02-03T12:42:48.263Z] [ERROR] [API-5002][TID:aed1cf0c-56a6-467f-a561-13af3ae32bbf] Error fetching trending tokens | DATA: {"network":"polygon","error":"GeckoTerminal backoff active (53s remaining)"}
[api] [2026-02-03T12:42:48.264Z] [INFO] [API-5001][TID:aed1cf0c-56a6-467f-a561-13af3ae32bbf][5939ms] Premium trending tokens fetch complete | DATA: {"count":22,"chain":"polygon"}
[api] [TokenJob] Got 22 trending tokens for Polygon
[api] Saved 22 trending tokens for polygon to database and memory cache
[api] [TokenJob] Saved 22 tokens for Polygon to DB + cache
[api] [TokenJob] Refreshed 7 chains in 143.6s
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:42:49.862Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:42:50.596Z] [ERROR] [API-5002][TID:5a6f741c-7e2c-46eb-81b9-1b86b4d448ab] Alchemy Portfolio EVM API error | DATA: {}
[api] {"level":30,"time":1770122571655,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","res":{"statusCode":200},"responseTime":6165.16787500307,"msg":"request completed"}
[api] {"level":30,"time":1770122571662,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50257},"msg":"incoming request"}
[api] {"level":30,"time":1770122571663,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","res":{"statusCode":204},"responseTime":0.37537499889731407,"msg":"request completed"}
[api] {"level":30,"time":1770122571665,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50263},"msg":"incoming request"}
[api] [2026-02-03T12:42:53.079Z] [ERROR] [API-5002][TID:c65ae4e5-e868-4cf2-8924-aba57f27da8b] Alchemy Portfolio EVM API error | DATA: {}
[api] {"level":30,"time":1770122573080,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","res":{"statusCode":200},"responseTime":1415.228958003223,"msg":"request completed"}
[api] [2026-02-03T12:42:54.717Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://api.developer.coinbase.com/rpc/v1/base/***","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://rpc.ankr.com/base/***","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:42:59.868Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Tokens for Polygon are fresh, skipping API call
[api] [TokenJob] Refreshed 7 chains in 180.3s
[api] [2026-02-03T12:43:05.060Z] [INFO] [SOC-7001][TID:aed1cf0c-56a6-467f-a561-13af3ae32bbf][150ms] Timer finished: get_trending_casts_trending | DATA: {"timeRange":"trending","limit":500,"offset":0,"count":500,"fromCache":false,"timerLabel":"get_trending_casts_trending"}
[api] [2026-02-03T12:43:05.116Z] [INFO] [SOC-7003][TID:aed1cf0c-56a6-467f-a561-13af3ae32bbf] SocialRepo: Updated cache with 500 merged casts
[api] [2026-02-03T12:43:05.116Z] [INFO] [SOC-7003][TID:aed1cf0c-56a6-467f-a561-13af3ae32bbf] SocialRepo: Saved 92 trending casts to database
[api] [2026-02-03T12:43:05.116Z] [INFO] [SOC-7003][TID:aed1cf0c-56a6-467f-a561-13af3ae32bbf][391ms] Timer finished: save_trending_casts | DATA: {"count":92,"timerLabel":"save_trending_casts"}
[api] [SocialJob] Casts refreshed: 92 saved
[api] [SocialJob] 🚀 Triggering OGP Prefetch for top 50 casts...
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:43:09.876Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:43:19.889Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:43:29.899Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:43:39.910Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:43:49.917Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:43:54.719Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://api.developer.coinbase.com/rpc/v1/base/***","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://rpc.ankr.com/base/***","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:43:59.926Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:44:09.933Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:44:19.940Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:44:29.946Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:44:39.952Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:44:49.956Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:44:54.718Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://api.developer.coinbase.com/rpc/v1/base/***","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://rpc.ankr.com/base/***","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:44:59.965Z] [INFO] [SYS-1001] No open positions to monitor
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
[api] [2026-02-03T12:45:00.075Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"ethereum","limit":100}
[api] [2026-02-03T12:45:00.086Z] [INFO] [SYS-1007] SocialRepo: Recalculated heat scores for 708 casts
[api] [2026-02-03T12:45:00.086Z] [INFO] [SYS-1007][31ms] Timer finished: recalc_heat_scores | DATA: {"count":708,"timerLabel":"recalc_heat_scores"}
[api] [2026-02-03T12:45:01.555Z] [INFO] [WTC-2002] Found addresses via WebSocket | DATA: {"count":183,"chain":"ethereum"}
[api] [2026-02-03T12:45:05.808Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":28,"limit":200}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:45:09.976Z] [INFO] [SYS-1001] No open positions to monitor
[api] [REPEATED x3] PREVIOUS LOG API-5001:Skipping low liquidity token
[api] [2026-02-03T12:45:11.669Z] [INFO] [API-5001] Skipping low liquidity token | DATA: {"symbol":"REQ","liquidity":551.2121}
[api] [2026-02-03T12:45:15.390Z] [INFO] [API-5001] Trending tokens fetch complete | DATA: {"network":"eth","count":113,"limit":200}
[api] [2026-02-03T12:45:15.391Z] [INFO] [API-5001][15316ms] Premium trending tokens fetch complete | DATA: {"count":100,"chain":"ethereum"}
[api] [TokenJob] Got 100 trending tokens for Ethereum
[api] Saved 100 trending tokens for eth to database and memory cache
[api] [TokenJob] Saved 100 tokens for Ethereum to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:45:19.984Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:45:29.991Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
[api] [2026-02-03T12:45:35.476Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"solana","limit":100}
[api] [2026-02-03T12:45:37.098Z] [INFO] [WTC-2002] Found addresses via WebSocket | DATA: {"count":282,"chain":"solana"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:45:39.998Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:45:43.593Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":124,"limit":200}
[api] [2026-02-03T12:45:43.594Z] [INFO] [API-5001][8118ms] Premium trending tokens fetch complete | DATA: {"count":100,"chain":"solana"}
[api] [TokenJob] Got 100 trending tokens for Solana
[api] Saved 100 trending tokens for solana to database and memory cache
[api] [TokenJob] Saved 100 tokens for Solana to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:45:50.005Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:45:54.719Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://api.developer.coinbase.com/rpc/v1/base/***","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://rpc.ankr.com/base/***","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:46:00.011Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
[api] [2026-02-03T12:46:03.664Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"base","limit":100}
[api] [2026-02-03T12:46:05.311Z] [INFO] [WTC-2002] Found addresses via WebSocket | DATA: {"count":184,"chain":"base"}
[api] [2026-02-03T12:46:09.608Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":48,"limit":200}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:46:10.016Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:46:11.779Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-03T12:46:13.648Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"base","error":"GeckoTerminal backoff active (59s remaining)"}
[api] [2026-02-03T12:46:13.648Z] [INFO] [API-5001][9984ms] Premium trending tokens fetch complete | DATA: {"count":71,"chain":"base"}
[api] [TokenJob] Got 71 trending tokens for Base
[api] Saved 71 trending tokens for base to database and memory cache
[api] [TokenJob] Saved 71 tokens for Base to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:46:20.022Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:46:30.031Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
[api] [2026-02-03T12:46:33.711Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"bsc","limit":100}
[api] [2026-02-03T12:46:35.310Z] [INFO] [WTC-2002] Found addresses via WebSocket | DATA: {"count":197,"chain":"bsc"}
[api] [2026-02-03T12:46:39.849Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":32,"limit":200}
[api] [2026-02-03T12:46:39.850Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"bsc","error":"GeckoTerminal backoff active (32s remaining)"}
[api] [2026-02-03T12:46:39.850Z] [INFO] [API-5001][6139ms] Premium trending tokens fetch complete | DATA: {"count":78,"chain":"bsc"}
[api] [TokenJob] Got 78 trending tokens for BSC
[api] Saved 78 trending tokens for bsc to database and memory cache
[api] [TokenJob] Saved 78 tokens for BSC to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:46:40.036Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:46:50.043Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:46:54.720Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://api.developer.coinbase.com/rpc/v1/base/***","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://rpc.ankr.com/base/***","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
[api] [2026-02-03T12:46:59.925Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"arbitrum","limit":100}
[api] [2026-02-03T12:46:59.925Z] [INFO] [API-5001] Using fallback discovery (Boosts + Organic search) | DATA: {"wsAddressCount":0}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:47:00.050Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:47:02.966Z] [INFO] [API-5001] Merged addresses | DATA: {"wsCount":0,"fallbackCount":2,"totalUnique":2}
[api] [2026-02-03T12:47:04.745Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":7,"limit":200}
[api] [2026-02-03T12:47:04.746Z] [INFO] [API-5001][4821ms] Premium trending tokens fetch complete | DATA: {"count":7,"chain":"arbitrum"}
[api] [TokenJob] DexScreener returned 7 tokens, trying GeckoTerminal fallback...
[api] [TokenJob] Got 7 trending tokens for Arbitrum
[api] [2026-02-03T12:47:04.746Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"arbitrum","error":"GeckoTerminal backoff active (8s remaining)"}
[api] [2026-02-03T12:47:04.746Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"arbitrum","error":"GeckoTerminal backoff active (8s remaining)"}
[api] Saved 7 trending tokens for arbitrum to database and memory cache
[api] [TokenJob] Saved 7 tokens for Arbitrum to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:47:10.064Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:47:20.071Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Fetching trending tokens for Optimism via DexScreener Premium...
[api] [2026-02-03T12:47:24.783Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"optimism","limit":100}
[api] [2026-02-03T12:47:24.783Z] [INFO] [API-5001] Using fallback discovery (Boosts + Organic search) | DATA: {"wsAddressCount":0}
[api] [2026-02-03T12:47:27.738Z] [INFO] [API-5001] Merged addresses | DATA: {"wsCount":0,"fallbackCount":4,"totalUnique":4}
[api] [2026-02-03T12:47:29.515Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":13,"limit":200}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:47:30.078Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770122851141,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","req":{"method":"OPTIONS","url":"/api/social/trending/cursor?limit=30&timeRange=trending&sortBy=trending","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51499},"msg":"incoming request"}
[api] {"level":30,"time":1770122851142,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","res":{"statusCode":204},"responseTime":0.49275000020861626,"msg":"request completed"}
[api] {"level":30,"time":1770122851144,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","req":{"method":"GET","url":"/api/social/trending/cursor?limit=30&timeRange=trending&sortBy=trending","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51499},"msg":"incoming request"}
[api] {"level":30,"time":1770122851166,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","res":{"statusCode":200},"responseTime":22.507709000259638,"msg":"request completed"}
[api] {"level":30,"time":1770122851366,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","req":{"method":"OPTIONS","url":"/api/social/ogp?url=https%3A%2F%2Fwww.ucritter.com%2F","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51499},"msg":"incoming request"}
[api] {"level":30,"time":1770122851368,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","res":{"statusCode":204},"responseTime":0.9647919982671738,"msg":"request completed"}
[api] {"level":30,"time":1770122851369,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","req":{"method":"GET","url":"/api/social/ogp?url=https%3A%2F%2Fwww.ucritter.com%2F","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51499},"msg":"incoming request"}
[api] [2026-02-03T12:47:31.639Z] [INFO] [API-5001] Skipping low liquidity token | DATA: {"symbol":"sUSD","liquidity":200.2671}
[api] {"level":30,"time":1770122853337,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","res":{"statusCode":200},"responseTime":1968.3022080026567,"msg":"request completed"}
[api] [REPEATED x13] PREVIOUS LOG API-5001:Skipping low liquidity token
[api] [2026-02-03T12:47:37.345Z] [INFO] [API-5001] Skipping low liquidity token | DATA: {"symbol":"USDC","liquidity":110.7562}
[api] [2026-02-03T12:47:37.792Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-03T12:47:39.043Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:47:40.083Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770122860513,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","req":{"method":"OPTIONS","url":"/api/copy-trade/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51499},"msg":"incoming request"}
[api] {"level":30,"time":1770122860514,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","res":{"statusCode":204},"responseTime":0.9189999997615814,"msg":"request completed"}
[api] {"level":30,"time":1770122860516,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","req":{"method":"OPTIONS","url":"/api/polymarket/copy/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51570},"msg":"incoming request"}
[api] {"level":30,"time":1770122860516,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","res":{"statusCode":204},"responseTime":0.28095800057053566,"msg":"request completed"}
[api] {"level":30,"time":1770122860516,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51499},"msg":"incoming request"}
[api] {"level":30,"time":1770122860516,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","res":{"statusCode":204},"responseTime":0.1505410000681877,"msg":"request completed"}
[api] {"level":30,"time":1770122860517,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","req":{"method":"OPTIONS","url":"/api/copy-trade/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51571},"msg":"incoming request"}
[api] {"level":30,"time":1770122860517,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","res":{"statusCode":204},"responseTime":0.12091599777340889,"msg":"request completed"}
[api] {"level":30,"time":1770122860517,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-u","req":{"method":"OPTIONS","url":"/api/polymarket/copy/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51572},"msg":"incoming request"}
[api] {"level":30,"time":1770122860517,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-u","res":{"statusCode":204},"responseTime":0.05591600015759468,"msg":"request completed"}
[api] {"level":30,"time":1770122860517,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-v","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51570},"msg":"incoming request"}
[api] {"level":30,"time":1770122860517,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-v","res":{"statusCode":204},"responseTime":0.0682080015540123,"msg":"request completed"}
[api] {"level":30,"time":1770122860518,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","req":{"method":"GET","url":"/api/copy-trade/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51499},"msg":"incoming request"}
[api] {"level":30,"time":1770122860519,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-x","req":{"method":"OPTIONS","url":"/api/copy-trade/positions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51573},"msg":"incoming request"}
[api] {"level":30,"time":1770122860519,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-x","res":{"statusCode":204},"responseTime":0.21550000086426735,"msg":"request completed"}
[api] {"level":30,"time":1770122860520,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","req":{"method":"GET","url":"/api/copy-trade/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51570},"msg":"incoming request"}
[api] [CopyTrade] GET /configs - Fetching configs for user did:privy:cmj0a3j3f005fl20c4xkl7195
[api] {"level":30,"time":1770122860522,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-z","req":{"method":"GET","url":"/api/polymarket/copy/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51571},"msg":"incoming request"}
[api] {"level":30,"time":1770122860523,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-10","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51572},"msg":"incoming request"}
[api] {"level":30,"time":1770122860524,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-11","req":{"method":"OPTIONS","url":"/api/copy-trade/positions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51574},"msg":"incoming request"}
[api] {"level":30,"time":1770122860525,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-11","res":{"statusCode":204},"responseTime":0.17912499979138374,"msg":"request completed"}
[api] {"level":30,"time":1770122860525,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-12","req":{"method":"GET","url":"/api/polymarket/copy/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51573},"msg":"incoming request"}
[api] [CopyTrade] GET /configs - Fetching configs for user did:privy:cmj0a3j3f005fl20c4xkl7195
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   userIdLength: 35,
[api]   userIdPrefix: 'did:privy:cmj0a3j3f0',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] {"level":30,"time":1770122860530,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","res":{"statusCode":200},"responseTime":12.192625001072884,"msg":"request completed"}
[api] {"level":30,"time":1770122860530,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-13","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51574},"msg":"incoming request"}
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1770122860532,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","res":{"statusCode":200},"responseTime":12.376499999314547,"msg":"request completed"}
[api] {"level":30,"time":1770122860542,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-z","res":{"statusCode":200},"responseTime":19.942624997347593,"msg":"request completed"}
[api] {"level":30,"time":1770122860542,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-14","req":{"method":"GET","url":"/api/copy-trade/positions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51499},"msg":"incoming request"}
[api] {"level":30,"time":1770122860543,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-15","req":{"method":"GET","url":"/api/copy-trade/positions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51570},"msg":"incoming request"}
[api] [CopyTrade] GET /positions - Fetching positions for did:privy:cmj0a3j3f005fl20c4xkl7195
[api] {"level":30,"time":1770122860544,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-12","res":{"statusCode":200},"responseTime":18.79066599905491,"msg":"request completed"}
[api] [CopyTrade] GET /positions - Fetching positions for did:privy:cmj0a3j3f005fl20c4xkl7195
[api] {"level":30,"time":1770122860546,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-15","res":{"statusCode":200},"responseTime":3.2109999991953373,"msg":"request completed"}
[api] {"level":30,"time":1770122860546,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-14","res":{"statusCode":200},"responseTime":3.6880839988589287,"msg":"request completed"}
[api] {"level":30,"time":1770122861635,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-16","req":{"method":"OPTIONS","url":"/api/users/settings","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51571},"msg":"incoming request"}
[api] {"level":30,"time":1770122861636,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-16","res":{"statusCode":204},"responseTime":0.4823330007493496,"msg":"request completed"}
[api] {"level":30,"time":1770122861637,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-17","req":{"method":"GET","url":"/api/users/settings","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51573},"msg":"incoming request"}
[api] {"level":30,"time":1770122861649,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-17","res":{"statusCode":200},"responseTime":11.568250000476837,"msg":"request completed"}
[api] [2026-02-03T12:47:41.912Z] [INFO] [API-5001] Trending tokens fetch complete | DATA: {"network":"optimism","count":33,"limit":200}
[api] [2026-02-03T12:47:41.912Z] [INFO] [API-5001][17129ms] Premium trending tokens fetch complete | DATA: {"count":36,"chain":"optimism"}
[api] [TokenJob] Got 36 trending tokens for Optimism
[api] Saved 36 trending tokens for optimism to database and memory cache
[api] [TokenJob] Saved 36 tokens for Optimism to DB + cache
[api] {"level":30,"time":1770122862437,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-18","req":{"method":"OPTIONS","url":"/api/users/settings","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51570},"msg":"incoming request"}
[api] {"level":30,"time":1770122862438,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-18","res":{"statusCode":204},"responseTime":0.43229199945926666,"msg":"request completed"}
[api] {"level":30,"time":1770122862439,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-19","req":{"method":"PUT","url":"/api/users/settings","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51499},"msg":"incoming request"}
[api] [UserSettings] PUT /api/users/settings for user did:privy:cmj0a3j3f005fl20c4xkl7195: {
[api]   "userRole": "default",
[api]   "defaultSwapAmount": 100,
[api]   "defaultSwapUnit": "native",
[api]   "checkTokenBeforeSwap": true,
[api]   "swapMethod": "allowance_trade",
[api]   "slippageMode": "auto",
[api]   "customSlippage": 0.5,
[api]   "mevProtection": true,
[api]   "priceDeviationCheck": true,
[api]   "fastSwapMode": false,
[api]   "copyTradeTokenCooldownMinutes": 60,
[api]   "minMarketCapUsd": null,
[api]   "minLiquidityUsd": null,
[api]   "minTargetValueUsd": null
[api] }
[api] [Prisma-Error] 
[api] Invalid `prisma.userSettings.upsert()` invocation in
[api] /Users/almurat/KiKo/kiko-api/src/routes/users.ts:113:60
[api] 
[api]   110 }
[api]   111 
[api]   112 // Upsert settings
[api] → 113 const settings = await prisma.userSettings.upsert(
[api] Foreign key constraint violated: `UserSettings_userId_fkey (index)` { target: 'userSettings.upsert', timestamp: 2026-02-03T12:47:42.474Z }
[api] [UserSettings] Error updating settings: PrismaClientKnownRequestError: 
[api] Invalid `prisma.userSettings.upsert()` invocation in
[api] /Users/almurat/KiKo/kiko-api/src/routes/users.ts:113:60
[api] 
[api]   110 }
[api]   111 
[api]   112 // Upsert settings
[api] → 113 const settings = await prisma.userSettings.upsert(
[api] Foreign key constraint violated: `UserSettings_userId_fkey (index)`
[api]     at $n.handleRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:7315)
[api]     at $n.handleAndLogRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6623)
[api]     at $n.request (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6307)
[api]     at async l (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:130:9633)
[api]     at async Object.<anonymous> (/Users/almurat/KiKo/kiko-api/src/routes/users.ts:113:34) {
[api]   code: 'P2003',
[api]   clientVersion: '5.22.0',
[api]   meta: {
[api]     modelName: 'UserSettings',
[api]     field_name: 'UserSettings_userId_fkey (index)'
[api]   }
[api] }
[api] {"level":30,"time":1770122862476,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-19","res":{"statusCode":500},"responseTime":36.84629100188613,"msg":"request completed"}
[api] [2026-02-03T12:47:43.244Z] [ERROR] [API-5002][TID:4280a8ea-9cfe-440d-9afc-498585df041d] Alchemy Portfolio EVM API error | DATA: {}
[api] [2026-02-03T12:47:43.247Z] [ERROR] [API-5002][TID:ac4f95cf-bbfe-4d39-9f3f-797ed6c10a74] Alchemy Portfolio EVM API error | DATA: {}
[api] {"level":30,"time":1770122864298,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-10","res":{"statusCode":200},"responseTime":3774.876334000379,"msg":"request completed"}
[api] {"level":30,"time":1770122864306,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1a","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51571},"msg":"incoming request"}
[api] {"level":30,"time":1770122864307,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1a","res":{"statusCode":204},"responseTime":0.3846669979393482,"msg":"request completed"}
[api] {"level":30,"time":1770122864308,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-13","res":{"statusCode":200},"responseTime":3777.73079200089,"msg":"request completed"}
[api] {"level":30,"time":1770122864310,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1b","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51573},"msg":"incoming request"}
[api] {"level":30,"time":1770122864315,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1c","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51570},"msg":"incoming request"}
[api] [2026-02-03T12:47:45.217Z] [ERROR] [API-5002][TID:af996882-b9d3-4d2f-9675-db9bbece1d9d] Alchemy Portfolio EVM API error | DATA: {}
[api] {"level":30,"time":1770122865218,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1c","res":{"statusCode":200},"responseTime":903.2670000009239,"msg":"request completed"}
[api] [2026-02-03T12:47:45.231Z] [ERROR] [API-5002][TID:0fe240e0-f838-4cc1-8692-ae9d05df0c7a] Alchemy Portfolio EVM API error | DATA: {}
[api] {"level":30,"time":1770122865232,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1b","res":{"statusCode":200},"responseTime":922.5464579984546,"msg":"request completed"}
[api] {"level":30,"time":1770122867646,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1d","req":{"method":"OPTIONS","url":"/api/users/settings","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51499},"msg":"incoming request"}
[api] {"level":30,"time":1770122867647,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1d","res":{"statusCode":204},"responseTime":0.5297919996082783,"msg":"request completed"}
[api] {"level":30,"time":1770122867649,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1e","req":{"method":"PUT","url":"/api/users/settings","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51572},"msg":"incoming request"}
[api] [UserSettings] PUT /api/users/settings for user did:privy:cmj0a3j3f005fl20c4xkl7195: {
[api]   "userRole": "default",
[api]   "defaultSwapAmount": 100,
[api]   "defaultSwapUnit": "native",
[api]   "checkTokenBeforeSwap": true,
[api]   "swapMethod": "allowance_trade",
[api]   "slippageMode": "auto",
[api]   "customSlippage": 0.5,
[api]   "mevProtection": true,
[api]   "priceDeviationCheck": true,
[api]   "fastSwapMode": false,
[api]   "copyTradeTokenCooldownMinutes": 60,
[api]   "minMarketCapUsd": null,
[api]   "minLiquidityUsd": null,
[api]   "minTargetValueUsd": null
[api] }
[api] [Prisma-Error] 
[api] Invalid `prisma.userSettings.upsert()` invocation in
[api] /Users/almurat/KiKo/kiko-api/src/routes/users.ts:113:60
[api] 
[api]   110 }
[api]   111 
[api]   112 // Upsert settings
[api] → 113 const settings = await prisma.userSettings.upsert(
[api] Foreign key constraint violated: `UserSettings_userId_fkey (index)` { target: 'userSettings.upsert', timestamp: 2026-02-03T12:47:47.662Z }
[api] [UserSettings] Error updating settings: PrismaClientKnownRequestError: 
[api] Invalid `prisma.userSettings.upsert()` invocation in
[api] /Users/almurat/KiKo/kiko-api/src/routes/users.ts:113:60
[api] 
[api]   110 }
[api]   111 
[api]   112 // Upsert settings
[api] → 113 const settings = await prisma.userSettings.upsert(
[api] Foreign key constraint violated: `UserSettings_userId_fkey (index)`
[api]     at $n.handleRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:7315)
[api]     at $n.handleAndLogRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6623)
[api]     at $n.request (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6307)
[api]     at async l (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:130:9633)
[api]     at async Object.<anonymous> (/Users/almurat/KiKo/kiko-api/src/routes/users.ts:113:34) {
[api]   code: 'P2003',
[api]   clientVersion: '5.22.0',
[api]   meta: {
[api]     modelName: 'UserSettings',
[api]     field_name: 'UserSettings_userId_fkey (index)'
[api]   }
[api] }
[api] {"level":30,"time":1770122867664,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1e","res":{"statusCode":500},"responseTime":15.329041000455618,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:47:50.090Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:47:54.721Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://base-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://rpc.ankr.com/base/***","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:48:00.096Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Fetching trending tokens for Polygon via DexScreener Premium...
[api] [2026-02-03T12:48:01.976Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"polygon","limit":100}
[api] [2026-02-03T12:48:01.976Z] [INFO] [API-5001] Using fallback discovery (Boosts + Organic search) | DATA: {"wsAddressCount":0}
[api] [2026-02-03T12:48:05.918Z] [INFO] [API-5001] Merged addresses | DATA: {"wsCount":0,"fallbackCount":4,"totalUnique":4}
[api] [2026-02-03T12:48:07.821Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":23,"limit":200}
[api] [2026-02-03T12:48:07.822Z] [INFO] [API-5001][5846ms] Premium trending tokens fetch complete | DATA: {"count":22,"chain":"polygon"}
[api] [TokenJob] Got 22 trending tokens for Polygon
[api] [2026-02-03T12:48:07.822Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"polygon","error":"GeckoTerminal backoff active (32s remaining)"}
[api] Saved 22 trending tokens for polygon to database and memory cache
[api] [TokenJob] Saved 22 tokens for Polygon to DB + cache
[api] [TokenJob] Refreshed 7 chains in 187.8s
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:48:10.109Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:48:20.117Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:48:30.125Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:48:40.130Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:48:50.137Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:48:54.720Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://base-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://rpc.ankr.com/base/***","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:49:00.142Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:49:10.149Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:49:20.156Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:49:30.161Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:49:40.167Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:49:50.174Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770122990638,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1f","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=eth&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52369},"msg":"incoming request"}
[api] {"level":30,"time":1770122990639,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1f","res":{"statusCode":204},"responseTime":0.6609590016305447,"msg":"request completed"}
[api] {"level":30,"time":1770122990640,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1g","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=polygon&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52369},"msg":"incoming request"}
[api] {"level":30,"time":1770122990640,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1g","res":{"statusCode":204},"responseTime":0.22974999994039536,"msg":"request completed"}
[api] {"level":30,"time":1770122990640,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1h","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=solana&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52370},"msg":"incoming request"}
[api] {"level":30,"time":1770122990641,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1h","res":{"statusCode":204},"responseTime":0.12275000289082527,"msg":"request completed"}
[api] {"level":30,"time":1770122990641,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1i","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=eth&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52369},"msg":"incoming request"}
[api] {"level":30,"time":1770122990642,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1i","res":{"statusCode":204},"responseTime":0.641415998339653,"msg":"request completed"}
[api] {"level":30,"time":1770122990642,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1j","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=bsc&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52371},"msg":"incoming request"}
[api] {"level":30,"time":1770122990642,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1j","res":{"statusCode":204},"responseTime":0.17787499725818634,"msg":"request completed"}
[api] {"level":30,"time":1770122990642,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1k","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=bsc&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52369},"msg":"incoming request"}
[api] {"level":30,"time":1770122990643,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1k","res":{"statusCode":204},"responseTime":0.12370800226926804,"msg":"request completed"}
[api] {"level":30,"time":1770122990643,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1l","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=solana&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52370},"msg":"incoming request"}
[api] {"level":30,"time":1770122990643,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1l","res":{"statusCode":204},"responseTime":0.1262500025331974,"msg":"request completed"}
[api] {"level":30,"time":1770122990643,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1m","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=base&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52372},"msg":"incoming request"}
[api] {"level":30,"time":1770122990643,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1m","res":{"statusCode":204},"responseTime":0.10599999874830246,"msg":"request completed"}
[api] {"level":30,"time":1770122990643,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1n","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=arbitrum&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52369},"msg":"incoming request"}
[api] {"level":30,"time":1770122990644,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1n","res":{"statusCode":204},"responseTime":0.10474999994039536,"msg":"request completed"}
[api] {"level":30,"time":1770122990644,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1o","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=optimism&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52370},"msg":"incoming request"}
[api] {"level":30,"time":1770122990644,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1o","res":{"statusCode":204},"responseTime":0.09187500178813934,"msg":"request completed"}
[api] {"level":30,"time":1770122990644,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1p","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=base&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52371},"msg":"incoming request"}
[api] {"level":30,"time":1770122990644,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1p","res":{"statusCode":204},"responseTime":0.0742499977350235,"msg":"request completed"}
[api] {"level":30,"time":1770122990644,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1q","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=arbitrum&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52373},"msg":"incoming request"}
[api] {"level":30,"time":1770122990644,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1q","res":{"statusCode":204},"responseTime":0.08270899951457977,"msg":"request completed"}
[api] {"level":30,"time":1770122990644,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1r","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=eth&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52369},"msg":"incoming request"}
[api] {"level":30,"time":1770122990645,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1r","res":{"statusCode":204},"responseTime":0.07800000160932541,"msg":"request completed"}
[api] {"level":30,"time":1770122990645,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1s","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=solana&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52370},"msg":"incoming request"}
[api] {"level":30,"time":1770122990645,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1s","res":{"statusCode":204},"responseTime":0.06670799851417542,"msg":"request completed"}
[api] {"level":30,"time":1770122990645,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1t","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=polygon&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52372},"msg":"incoming request"}
[api] {"level":30,"time":1770122990645,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1t","res":{"statusCode":204},"responseTime":0.0541669987142086,"msg":"request completed"}
[api] {"level":30,"time":1770122990645,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1u","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=optimism&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52374},"msg":"incoming request"}
[api] {"level":30,"time":1770122990645,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1u","res":{"statusCode":204},"responseTime":0.07041700184345245,"msg":"request completed"}
[api] {"level":30,"time":1770122990645,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1v","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=bsc&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52371},"msg":"incoming request"}
[api] {"level":30,"time":1770122990645,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1v","res":{"statusCode":204},"responseTime":0.058958999812603,"msg":"request completed"}
[api] {"level":30,"time":1770122990645,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1w","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=base&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52373},"msg":"incoming request"}
[api] {"level":30,"time":1770122990645,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1w","res":{"statusCode":204},"responseTime":0.051708001643419266,"msg":"request completed"}
[api] {"level":30,"time":1770122990645,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1x","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=arbitrum&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52369},"msg":"incoming request"}
[api] {"level":30,"time":1770122990646,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1x","res":{"statusCode":204},"responseTime":0.05866700038313866,"msg":"request completed"}
[api] {"level":30,"time":1770122990646,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1y","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=optimism&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52370},"msg":"incoming request"}
[api] {"level":30,"time":1770122990646,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1y","res":{"statusCode":204},"responseTime":0.1368749998509884,"msg":"request completed"}
[api] {"level":30,"time":1770122990646,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1z","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=polygon&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52372},"msg":"incoming request"}
[api] {"level":30,"time":1770122990646,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1z","res":{"statusCode":204},"responseTime":0.11366700008511543,"msg":"request completed"}
[api] {"level":30,"time":1770122990646,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-20","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=eth&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52374},"msg":"incoming request"}
[api] {"level":30,"time":1770122990647,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-20","res":{"statusCode":204},"responseTime":0.10712500289082527,"msg":"request completed"}
[api] {"level":30,"time":1770122990647,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-21","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=solana&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52371},"msg":"incoming request"}
[api] {"level":30,"time":1770122990647,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-21","res":{"statusCode":204},"responseTime":0.2846670001745224,"msg":"request completed"}
[api] {"level":30,"time":1770122990647,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-22","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=bsc&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52373},"msg":"incoming request"}
[api] {"level":30,"time":1770122990647,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-22","res":{"statusCode":204},"responseTime":0.1576249971985817,"msg":"request completed"}
[api] {"level":30,"time":1770122990648,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-23","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=base&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52369},"msg":"incoming request"}
[api] {"level":30,"time":1770122990648,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-23","res":{"statusCode":204},"responseTime":0.1015000008046627,"msg":"request completed"}
[api] {"level":30,"time":1770122990648,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-24","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=arbitrum&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52370},"msg":"incoming request"}
[api] {"level":30,"time":1770122990648,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-24","res":{"statusCode":204},"responseTime":0.08191699907183647,"msg":"request completed"}
[api] {"level":30,"time":1770122990648,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-25","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=optimism&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52372},"msg":"incoming request"}
[api] {"level":30,"time":1770122990648,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-25","res":{"statusCode":204},"responseTime":0.09449999779462814,"msg":"request completed"}
[api] {"level":30,"time":1770122990648,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-26","req":{"method":"OPTIONS","url":"/api/tokens/trending/live?chain=polygon&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52374},"msg":"incoming request"}
[api] {"level":30,"time":1770122990649,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-26","res":{"statusCode":204},"responseTime":0.0661659985780716,"msg":"request completed"}
[api] {"level":30,"time":1770122990649,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-27","req":{"method":"OPTIONS","url":"/api/favorites","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52371},"msg":"incoming request"}
[api] {"level":30,"time":1770122990649,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-27","res":{"statusCode":204},"responseTime":0.09179200232028961,"msg":"request completed"}
[api] {"level":30,"time":1770122990649,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-28","req":{"method":"OPTIONS","url":"/api/favorites","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52373},"msg":"incoming request"}
[api] {"level":30,"time":1770122990649,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-28","res":{"statusCode":204},"responseTime":0.06970799714326859,"msg":"request completed"}
[api] {"level":30,"time":1770122990650,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-29","req":{"method":"GET","url":"/api/tokens/trending/live?chain=eth&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52369},"msg":"incoming request"}
[api] {"level":30,"time":1770122990652,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2a","req":{"method":"GET","url":"/api/tokens/trending/live?chain=polygon&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52370},"msg":"incoming request"}
[api] {"level":30,"time":1770122990653,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2b","req":{"method":"GET","url":"/api/tokens/trending/live?chain=solana&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52372},"msg":"incoming request"}
[api] {"level":30,"time":1770122990653,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2c","req":{"method":"GET","url":"/api/tokens/trending/live?chain=eth&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52374},"msg":"incoming request"}
[api] {"level":30,"time":1770122990653,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2d","req":{"method":"GET","url":"/api/tokens/trending/live?chain=bsc&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52371},"msg":"incoming request"}
[api] {"level":30,"time":1770122990653,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2e","req":{"method":"GET","url":"/api/tokens/trending/live?chain=bsc&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52373},"msg":"incoming request"}
[api] {"level":30,"time":1770122990658,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-29","res":{"statusCode":200},"responseTime":7.792707998305559,"msg":"request completed"}
[api] {"level":30,"time":1770122990658,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2a","res":{"statusCode":200},"responseTime":6.077583998441696,"msg":"request completed"}
[api] {"level":30,"time":1770122990659,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2f","req":{"method":"GET","url":"/api/tokens/trending/live?chain=solana&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52369},"msg":"incoming request"}
[api] {"level":30,"time":1770122990660,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2g","req":{"method":"GET","url":"/api/tokens/trending/live?chain=base&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52370},"msg":"incoming request"}
[api] {"level":30,"time":1770122990664,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2g","res":{"statusCode":200},"responseTime":3.8841250017285347,"msg":"request completed"}
[api] {"level":30,"time":1770122990665,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2f","res":{"statusCode":200},"responseTime":5.973709002137184,"msg":"request completed"}
[api] {"level":30,"time":1770122990666,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2h","req":{"method":"GET","url":"/api/tokens/trending/live?chain=arbitrum&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52370},"msg":"incoming request"}
[api] {"level":30,"time":1770122990666,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2i","req":{"method":"GET","url":"/api/tokens/trending/live?chain=optimism&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52369},"msg":"incoming request"}
[api] {"level":30,"time":1770122990668,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2h","res":{"statusCode":200},"responseTime":1.9638749994337559,"msg":"request completed"}
[api] {"level":30,"time":1770122990668,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2i","res":{"statusCode":200},"responseTime":1.7219999991357327,"msg":"request completed"}
[api] {"level":30,"time":1770122990669,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2j","req":{"method":"GET","url":"/api/tokens/trending/live?chain=base&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52370},"msg":"incoming request"}
[api] {"level":30,"time":1770122990670,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2k","req":{"method":"GET","url":"/api/tokens/trending/live?chain=arbitrum&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52369},"msg":"incoming request"}
[api] {"level":30,"time":1770122990671,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2k","res":{"statusCode":200},"responseTime":1.0144159980118275,"msg":"request completed"}
[api] {"level":30,"time":1770122990671,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2j","res":{"statusCode":200},"responseTime":1.9815419986844063,"msg":"request completed"}
[api] {"level":30,"time":1770122990672,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2l","req":{"method":"GET","url":"/api/tokens/trending/live?chain=eth&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52369},"msg":"incoming request"}
[api] {"level":30,"time":1770122990672,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2m","req":{"method":"GET","url":"/api/tokens/trending/live?chain=solana&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52370},"msg":"incoming request"}
[api] {"level":30,"time":1770122990674,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2l","res":{"statusCode":200},"responseTime":2.6432080008089542,"msg":"request completed"}
[api] {"level":30,"time":1770122990676,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2m","res":{"statusCode":200},"responseTime":3.4703750014305115,"msg":"request completed"}
[api] {"level":30,"time":1770122990677,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2b","res":{"statusCode":200},"responseTime":24.591832999140024,"msg":"request completed"}
[api] {"level":30,"time":1770122990678,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2c","res":{"statusCode":200},"responseTime":25.23166699707508,"msg":"request completed"}
[api] {"level":30,"time":1770122990679,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2d","res":{"statusCode":200},"responseTime":26.134040996432304,"msg":"request completed"}
[api] {"level":30,"time":1770122990680,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2e","res":{"statusCode":200},"responseTime":26.896583002060652,"msg":"request completed"}
[api] {"level":30,"time":1770122990680,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2n","req":{"method":"GET","url":"/api/tokens/trending/live?chain=polygon&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52369},"msg":"incoming request"}
[api] {"level":30,"time":1770122990681,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2o","req":{"method":"GET","url":"/api/tokens/trending/live?chain=optimism&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52370},"msg":"incoming request"}
[api] {"level":30,"time":1770122990681,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2p","req":{"method":"GET","url":"/api/tokens/trending/live?chain=bsc&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52372},"msg":"incoming request"}
[api] {"level":30,"time":1770122990681,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2q","req":{"method":"GET","url":"/api/tokens/trending/live?chain=base&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52374},"msg":"incoming request"}
[api] {"level":30,"time":1770122990681,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2r","req":{"method":"GET","url":"/api/tokens/trending/live?chain=arbitrum&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52371},"msg":"incoming request"}
[api] {"level":30,"time":1770122990681,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2s","req":{"method":"GET","url":"/api/tokens/trending/live?chain=optimism&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52373},"msg":"incoming request"}
[api] {"level":30,"time":1770122990682,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2n","res":{"statusCode":200},"responseTime":1.77004100009799,"msg":"request completed"}
[api] {"level":30,"time":1770122990682,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2o","res":{"statusCode":200},"responseTime":1.4648749977350235,"msg":"request completed"}
[api] {"level":30,"time":1770122990683,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2p","res":{"statusCode":200},"responseTime":1.9731249995529652,"msg":"request completed"}
[api] {"level":30,"time":1770122990684,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2q","res":{"statusCode":200},"responseTime":2.6253750026226044,"msg":"request completed"}
[api] {"level":30,"time":1770122990684,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2r","res":{"statusCode":200},"responseTime":2.719541996717453,"msg":"request completed"}
[api] {"level":30,"time":1770122990685,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2s","res":{"statusCode":200},"responseTime":3.0555830001831055,"msg":"request completed"}
[api] {"level":30,"time":1770122990685,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2t","req":{"method":"GET","url":"/api/tokens/trending/live?chain=polygon&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52369},"msg":"incoming request"}
[api] {"level":30,"time":1770122990686,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2u","req":{"method":"GET","url":"/api/tokens/trending/live?chain=eth&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52370},"msg":"incoming request"}
[api] {"level":30,"time":1770122990686,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2v","req":{"method":"GET","url":"/api/tokens/trending/live?chain=solana&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52372},"msg":"incoming request"}
[api] {"level":30,"time":1770122990686,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2w","req":{"method":"GET","url":"/api/tokens/trending/live?chain=bsc&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52374},"msg":"incoming request"}
[api] {"level":30,"time":1770122990686,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2x","req":{"method":"GET","url":"/api/tokens/trending/live?chain=base&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52371},"msg":"incoming request"}
[api] {"level":30,"time":1770122990687,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2y","req":{"method":"GET","url":"/api/tokens/trending/live?chain=arbitrum&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52373},"msg":"incoming request"}
[api] {"level":30,"time":1770122990688,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2w","res":{"statusCode":200},"responseTime":2.3591660000383854,"msg":"request completed"}
[api] {"level":30,"time":1770122990690,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2x","res":{"statusCode":200},"responseTime":4.073416996747255,"msg":"request completed"}
[api] {"level":30,"time":1770122990690,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2y","res":{"statusCode":200},"responseTime":3.7997499965131283,"msg":"request completed"}
[api] {"level":30,"time":1770122990691,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2t","res":{"statusCode":200},"responseTime":5.9421669989824295,"msg":"request completed"}
[api] {"level":30,"time":1770122990692,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2u","res":{"statusCode":200},"responseTime":6.153208997100592,"msg":"request completed"}
[api] {"level":30,"time":1770122990693,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2v","res":{"statusCode":200},"responseTime":7.462458997964859,"msg":"request completed"}
[api] {"level":30,"time":1770122990693,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2z","req":{"method":"GET","url":"/api/tokens/trending/live?chain=optimism&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52374},"msg":"incoming request"}
[api] {"level":30,"time":1770122990694,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-30","req":{"method":"GET","url":"/api/tokens/trending/live?chain=polygon&duration=5m&limit=100","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52371},"msg":"incoming request"}
[api] {"level":30,"time":1770122990694,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-31","req":{"method":"GET","url":"/api/favorites","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52373},"msg":"incoming request"}
[api] {"level":30,"time":1770122990695,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-32","req":{"method":"GET","url":"/api/favorites","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52369},"msg":"incoming request"}
[api] {"level":30,"time":1770122990696,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2z","res":{"statusCode":200},"responseTime":2.119708999991417,"msg":"request completed"}
[api] {"level":30,"time":1770122990696,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-30","res":{"statusCode":200},"responseTime":1.8918750025331974,"msg":"request completed"}
[api] {"level":30,"time":1770122990701,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-32","res":{"statusCode":200},"responseTime":5.937959000468254,"msg":"request completed"}
[api] {"level":30,"time":1770122990701,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-31","res":{"statusCode":200},"responseTime":6.56920799985528,"msg":"request completed"}
[api] {"level":30,"time":1770122990719,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-33","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2Ff15eceac2ad5e7de22560a00349e5dd3177d9968f77c1af64113633203e945fe%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52370},"msg":"incoming request"}
[api] {"level":30,"time":1770122990722,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-34","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F7f049b32633d783ee0d1993a850ee35bf3f40288b138163cc53f1ca885c84077%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52372},"msg":"incoming request"}
[api] {"level":30,"time":1770122990722,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-35","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F7f262aca8e4f5b81890c5f312a6ef97478c39d256aec0f1926876af1cf4f9cbd%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52374},"msg":"incoming request"}
[api] {"level":30,"time":1770122990722,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-36","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F9f7d88ac84681dbc95793d1094aa2b5c20bd4b64d50187e01a545f03723c1ab3%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52371},"msg":"incoming request"}
[api] {"level":30,"time":1770122990722,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-37","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F7680887c680187bf4dc86d0fd8c23f4e3db7a8304bdac81eeb8191800cc9e1d4%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52369},"msg":"incoming request"}
[api] {"level":30,"time":1770122990723,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-38","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F8e0c56ffaebc0a2c035e5de523e5992a1c5eb1c54dc273476e640389a432c203%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52373},"msg":"incoming request"}
[api] {"level":30,"time":1770122992137,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-33","res":{"statusCode":200},"responseTime":1418.266292002052,"msg":"request completed"}
[api] {"level":30,"time":1770122992140,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-39","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F378df9880f5c1318406420f9d6e6d5c7258468a58d252e3ad3de6b1864742946%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52370},"msg":"incoming request"}
[api] {"level":30,"time":1770122992145,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-37","res":{"statusCode":200},"responseTime":1422.508124999702,"msg":"request completed"}
[api] {"level":30,"time":1770122992147,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3a","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F73173de09de46c5cacd7b9b76042dca8f3722ba2287827c50fd354db86059f87%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52369},"msg":"incoming request"}
[api] {"level":30,"time":1770122992246,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-34","res":{"statusCode":200},"responseTime":1524.4547500014305,"msg":"request completed"}
[api] {"level":30,"time":1770122992250,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3b","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2Fdd5ec8e89aa3ca8677ff7ae62fe7ccc5360e1502454f5dc78b998ca91440e293%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52372},"msg":"incoming request"}
[api] {"level":30,"time":1770122992458,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-36","res":{"statusCode":200},"responseTime":1735.8023749999702,"msg":"request completed"}
[api] {"level":30,"time":1770122992460,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3c","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F536987ef7b3b26861867c1e12fec31665dba19542a736337309fb1f85175bf05%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52371},"msg":"incoming request"}
[api] {"level":30,"time":1770122992470,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3a","res":{"statusCode":200},"responseTime":322.883166000247,"msg":"request completed"}
[api] {"level":30,"time":1770122992472,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3d","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2Fbc35dd852b7fcef80b45ef44ae61192693461eefdba15ce7e9dcb1aaa4aabbc8%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52369},"msg":"incoming request"}
[api] {"level":30,"time":1770122992508,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-38","res":{"statusCode":200},"responseTime":1785.8295830003917,"msg":"request completed"}
[api] {"level":30,"time":1770122992510,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3e","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F8ef8f6198ae26fcba18709deef69575818537cf6d1d513c66ca32ffb05a06d28%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52373},"msg":"incoming request"}
[api] {"level":30,"time":1770122992513,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-35","res":{"statusCode":200},"responseTime":1791.3627500012517,"msg":"request completed"}
[api] {"level":30,"time":1770122992515,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3f","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2Fbb0ccb9258951848179caa2b58463c4184072694c0819936f24bfa90bf47d7b1%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52374},"msg":"incoming request"}
[api] {"level":30,"time":1770122992848,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3c","res":{"statusCode":200},"responseTime":388.0131659992039,"msg":"request completed"}
[api] {"level":30,"time":1770122992850,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3g","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F197956c3c7f76a361b048febe656a19eaa416b02db69c45663a658d1a6cdc762%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52371},"msg":"incoming request"}
[api] {"level":30,"time":1770122992884,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-39","res":{"statusCode":200},"responseTime":743.4779170006514,"msg":"request completed"}
[api] {"level":30,"time":1770122992884,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3h","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F06c4d3a53735c30b86b651b2b63b148ac90b6b740a123410c44dff54e233264a%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52370},"msg":"incoming request"}
[api] {"level":30,"time":1770122992931,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3f","res":{"statusCode":200},"responseTime":415.943208001554,"msg":"request completed"}
[api] {"level":30,"time":1770122992932,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3i","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F4f95c7dbcae5f8f06a1ed4bf1a62ec6b0da67f520f84071bd64f0448840689e1%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52374},"msg":"incoming request"}
[api] {"level":30,"time":1770122993118,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3e","res":{"statusCode":200},"responseTime":607.8352500014007,"msg":"request completed"}
[api] {"level":30,"time":1770122993119,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3j","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F183a2cb23225b8f339b357449c9bc44d588a2f785768491c89eedf0b5d05e19c%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52373},"msg":"incoming request"}
[api] {"level":30,"time":1770122993147,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3g","res":{"statusCode":200},"responseTime":296.50166599825025,"msg":"request completed"}
[api] {"level":30,"time":1770122993148,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3k","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F952af474a4ef4e6f37ac2f3acde25fa582bdba9607c3d0f636682fe70eb5fd46%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52371},"msg":"incoming request"}
[api] {"level":30,"time":1770122993333,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3d","res":{"statusCode":200},"responseTime":860.4618339985609,"msg":"request completed"}
[api] {"level":30,"time":1770122993334,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3l","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F10a69979845ab081f7a37fcaba5e2eb772cd5fe2fa92f7920209e7bb8225997c%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52369},"msg":"incoming request"}
[api] {"level":30,"time":1770122993356,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3h","res":{"statusCode":200},"responseTime":471.5898750014603,"msg":"request completed"}
[api] {"level":30,"time":1770122993357,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3m","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2Fd1bf83006d5c95c3359dce6995fed6d0df18ab3f637f04854b47cb33e31ae757%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52370},"msg":"incoming request"}
[api] {"level":30,"time":1770122993384,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3b","res":{"statusCode":200},"responseTime":1134.6715420000255,"msg":"request completed"}
[api] {"level":30,"time":1770122993385,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3n","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2Fe1f9a3aaf17ca5c02a0568d639dded470a11e6911ba170e52bc9e0efe79246ca%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52372},"msg":"incoming request"}
[api] {"level":30,"time":1770122993611,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3k","res":{"statusCode":200},"responseTime":462.8776660002768,"msg":"request completed"}
[api] {"level":30,"time":1770122993613,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3o","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F895146cf143125149400f3b196e1f09e3b6ab71f75aaafbb70d5312594d84772%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52371},"msg":"incoming request"}
[api] {"level":30,"time":1770122993635,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3m","res":{"statusCode":200},"responseTime":277.6200419999659,"msg":"request completed"}
[api] {"level":30,"time":1770122993694,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3n","res":{"statusCode":200},"responseTime":308.6363339982927,"msg":"request completed"}
[api] {"level":30,"time":1770122993721,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3j","res":{"statusCode":200},"responseTime":601.8981669992208,"msg":"request completed"}
[api] {"level":30,"time":1770122994036,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3p","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F8b061fc9847e13a3754e1d37c78c25ae1feb97f01c8b5e47c478d6bc81d650ab%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52370},"msg":"incoming request"}
[api] {"level":30,"time":1770122994052,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3q","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F80d34de269b7547184b85767354fe77cce031ba2195bb0be3eb0f7f01d91ba46%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52372},"msg":"incoming request"}
[api] {"level":30,"time":1770122994066,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3i","res":{"statusCode":200},"responseTime":1133.9876659996808,"msg":"request completed"}
[api] {"level":30,"time":1770122994085,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3r","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F09d504dd6c2e0a087c678f04feb1dfa8e0c229237965cded3d3b15de924d3c54%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52373},"msg":"incoming request"}
[api] {"level":30,"time":1770122994120,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3s","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F1530f47899efd13bb79f0463a90a92de85d71df8d8511e2d51ff44d6fc0d79c5%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52374},"msg":"incoming request"}
[api] {"level":30,"time":1770122994237,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3o","res":{"statusCode":200},"responseTime":624.1039169989526,"msg":"request completed"}
[api] {"level":30,"time":1770122994239,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3l","res":{"statusCode":200},"responseTime":905.1283749975264,"msg":"request completed"}
[api] {"level":30,"time":1770122994341,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3q","res":{"statusCode":200},"responseTime":288.83370899781585,"msg":"request completed"}
[api] {"level":30,"time":1770122994402,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3r","res":{"statusCode":200},"responseTime":317.3036250025034,"msg":"request completed"}
[api] {"level":30,"time":1770122994635,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3s","res":{"statusCode":200},"responseTime":513.95504200086,"msg":"request completed"}
[api] [2026-02-03T12:49:54.721Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://base-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://rpc.ankr.com/base/***","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] {"level":30,"time":1770122994760,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3t","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F289da688bbfc34818af3177efbe9c8ea283809ae5c3335a959980aa270a8a8b1%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52371},"msg":"incoming request"}
[api] {"level":30,"time":1770122994780,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3u","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2Ff27da343059301a228fe991dc88ffadd89dd31e02a82f621312ca088293b73f8%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52369},"msg":"incoming request"}
[api] {"level":30,"time":1770122994782,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3v","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2Ff76c04df0f12af1dd1825a35de4c28372865f73bb38b7b5efeb971c4c52fed51%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52372},"msg":"incoming request"}
[api] {"level":30,"time":1770122994819,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3w","req":{"method":"GET","url":"/api/images/token?url=https%3A%2F%2Fcdn.dexscreener.com%2Fcms%2Fimages%2F3b7b56655acddda3d97734a2382ac81fdc5da02298f8671ffdfbb905ea24fc9b%3Fwidth%3D800%26height%3D800%26quality%3D90","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52373},"msg":"incoming request"}
[api] {"level":30,"time":1770122994968,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3p","res":{"statusCode":200},"responseTime":931.6070830002427,"msg":"request completed"}
[api] {"level":30,"time":1770122995090,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3u","res":{"statusCode":200},"responseTime":309.1647920012474,"msg":"request completed"}
[api] {"level":30,"time":1770122995102,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3v","res":{"statusCode":200},"responseTime":320.40741700306535,"msg":"request completed"}
[api] {"level":30,"time":1770122995184,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3w","res":{"statusCode":200},"responseTime":364.4719589985907,"msg":"request completed"}
[api] {"level":30,"time":1770122995518,"pid":32061,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3t","res":{"statusCode":200},"responseTime":757.407542001456,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:50:00.181Z] [INFO] [SYS-1001] No open positions to monitor
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
[api] [2026-02-03T12:50:00.397Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"ethereum","limit":100}
[api] [2026-02-03T12:50:00.405Z] [INFO] [SYS-1007] SocialRepo: Recalculated heat scores for 708 casts
[api] [2026-02-03T12:50:00.405Z] [INFO] [SYS-1007][18ms] Timer finished: recalc_heat_scores | DATA: {"count":708,"timerLabel":"recalc_heat_scores"}
[api] [2026-02-03T12:50:01.931Z] [INFO] [WTC-2002] Found addresses via WebSocket | DATA: {"count":189,"chain":"ethereum"}
[api] [2026-02-03T12:50:06.197Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":28,"limit":200}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:50:10.201Z] [INFO] [SYS-1001] No open positions to monitor
[api] [REPEATED x11] PREVIOUS LOG API-5001:Skipping low liquidity token
[api] [2026-02-03T12:50:11.006Z] [INFO] [API-5001] Skipping low liquidity token | DATA: {"symbol":"REQ","liquidity":551.2121}
[api] [2026-02-03T12:50:16.041Z] [INFO] [API-5001] Trending tokens fetch complete | DATA: {"network":"eth","count":114,"limit":200}
[api] [2026-02-03T12:50:16.041Z] [INFO] [API-5001][15644ms] Premium trending tokens fetch complete | DATA: {"count":100,"chain":"ethereum"}
[api] [TokenJob] Got 100 trending tokens for Ethereum
[api] Saved 100 trending tokens for eth to database and memory cache
[api] [TokenJob] Saved 100 tokens for Ethereum to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:50:20.205Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:50:30.213Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
[api] [2026-02-03T12:50:36.111Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"solana","limit":100}
[api] [2026-02-03T12:50:37.651Z] [INFO] [WTC-2002] Found addresses via WebSocket | DATA: {"count":275,"chain":"solana"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:50:40.221Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:50:44.056Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":123,"limit":200}
[api] [2026-02-03T12:50:44.057Z] [INFO] [API-5001][7946ms] Premium trending tokens fetch complete | DATA: {"count":100,"chain":"solana"}
[api] [TokenJob] Got 100 trending tokens for Solana
[api] Saved 100 trending tokens for solana to database and memory cache
[api] [TokenJob] Saved 100 tokens for Solana to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:50:50.236Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:50:54.722Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://base-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://rpc.ankr.com/base/***","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:51:00.244Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
[api] [2026-02-03T12:51:04.123Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"base","limit":100}
[api] [2026-02-03T12:51:05.653Z] [INFO] [WTC-2002] Found addresses via WebSocket | DATA: {"count":180,"chain":"base"}
[api] [2026-02-03T12:51:10.050Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":49,"limit":200}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:51:10.250Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:51:12.194Z] [INFO] [API-5001] Skipping low liquidity token | DATA: {"symbol":"FUEF","liquidity":0}
[api] [2026-02-03T12:51:13.502Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-03T12:51:14.752Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-03T12:51:17.002Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:51:20.258Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:51:21.753Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"base","error":"GeckoTerminal backoff active (56s remaining)"}
[api] [2026-02-03T12:51:21.754Z] [INFO] [API-5001][17631ms] Premium trending tokens fetch complete | DATA: {"count":76,"chain":"base"}
[api] [TokenJob] Got 76 trending tokens for Base
[api] Saved 76 trending tokens for base to database and memory cache
[api] [TokenJob] Saved 76 tokens for Base to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:51:30.263Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:51:40.269Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
[api] [2026-02-03T12:51:41.813Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"bsc","limit":100}
[api] [2026-02-03T12:51:43.345Z] [INFO] [WTC-2002] Found addresses via WebSocket | DATA: {"count":192,"chain":"bsc"}
[api] [2026-02-03T12:51:47.703Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":32,"limit":200}
[api] [2026-02-03T12:51:47.704Z] [INFO] [API-5001][5891ms] Premium trending tokens fetch complete | DATA: {"count":76,"chain":"bsc"}
[api] [TokenJob] Got 76 trending tokens for BSC
[api] [2026-02-03T12:51:47.704Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"bsc","error":"GeckoTerminal backoff active (30s remaining)"}
[api] Saved 76 trending tokens for bsc to database and memory cache
[api] [TokenJob] Saved 76 tokens for BSC to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:51:50.274Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:51:54.723Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://base-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://base-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://rpc.ankr.com/base/***","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:52:00.280Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
[api] [2026-02-03T12:52:07.769Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"arbitrum","limit":100}
[api] [2026-02-03T12:52:07.770Z] [INFO] [API-5001] Using fallback discovery (Boosts + Organic search) | DATA: {"wsAddressCount":0}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:52:10.287Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-03T12:52:10.743Z] [INFO] [API-5001] Merged addresses | DATA: {"wsCount":0,"fallbackCount":2,"totalUnique":2}
[api] [2026-02-03T12:52:12.423Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":7,"limit":200}
[api] [2026-02-03T12:52:12.424Z] [INFO] [API-5001][4655ms] Premium trending tokens fetch complete | DATA: {"count":7,"chain":"arbitrum"}
[api] [TokenJob] DexScreener returned 7 tokens, trying GeckoTerminal fallback...
[api] [TokenJob] Got 7 trending tokens for Arbitrum
[api] [2026-02-03T12:52:12.424Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"arbitrum","error":"GeckoTerminal backoff active (5s remaining)"}
[api] [2026-02-03T12:52:12.424Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"arbitrum","error":"GeckoTerminal backoff active (5s remaining)"}
[api] Saved 7 trending tokens for arbitrum to database and memory cache
[api] [TokenJob] Saved 7 tokens for Arbitrum to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:52:20.292Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:52:30.296Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Fetching trending tokens for Optimism via DexScreener Premium...
[api] [2026-02-03T12:52:32.443Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"optimism","limit":100}
[api] [2026-02-03T12:52:32.443Z] [INFO] [API-5001] Using fallback discovery (Boosts + Organic search) | DATA: {"wsAddressCount":0}
[api] [2026-02-03T12:52:35.218Z] [INFO] [API-5001] Merged addresses | DATA: {"wsCount":0,"fallbackCount":4,"totalUnique":4}
[api] [2026-02-03T12:52:37.034Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":13,"limit":200}
[api] [2026-02-03T12:52:38.371Z] [INFO] [API-5001] Skipping low liquidity token | DATA: {"symbol":"sUSD","liquidity":199.5289}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-03T12:52:40.301Z] [INFO] [SYS-1001] No open positions to monitor
[api] [REPEATED x7] PREVIOUS LOG API-5001:Skipping low liquidity token
[api] [2026-02-03T12:52:43.930Z] [INFO] [API-5001] Skipping low liquidity token | DATA: {"symbol":"WETH","liquidity":309.761}

