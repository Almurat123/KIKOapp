Last login: Wed Feb 11 00:19:34 on ttys002
almurat@almuratdeMacBook-Pro ~ % cd kiko/kiko-api && npm run dev

> kiko-api@1.0.0 dev
> concurrently -k -n api,python "tsx watch src/index.ts" "cd ../kiko-python && python3 main.py"

[python] INFO:__main__:✅ Grok service mounted at /grok
[python] INFO:moderation.models:✅ OpenAI Moderation API initialized (lightweight mode)
[python] INFO:__main__:✅ Moderation service mounted at /moderation
[api] [Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] [16:23:34] [inf] [EVENT] [SYS-1001] Zora SDK initialized with API Key
[api] [SocialJob] Found user list at: /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
[api] [SkillRegistry:exec] Loading skills from /Users/almurat/KiKo/kiko-api/src/skills_exec...
[api] [SkillRegistry:exec] Loaded skill: copy_trade
[api] [SkillRegistry:exec] Loaded skill: cross_chain_swap
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
[api] [SkillRegistry:clean] Loading skills from /Users/almurat/KiKo/kiko-api/src/skills_clean...
[api] [SkillRegistry:clean] Loaded skill: polymarket_prediction
[api] [SkillRegistry:clean] Loaded skill: risk_security
[api] [SkillRegistry:clean] Loaded skill: social_farcaster
[api] [SkillRegistry:clean] Loaded skill: token_alert
[api] [SkillRegistry:clean] Loaded skill: token_analysis
[api] [SkillRegistry:clean] Loaded skill: wallet_portfolio
[api] [SkillRegistry:clean] Loaded skill: welcome_onboarding
[api] [16:23:35] [inf] [EVENT] [SYS-1001] Build SHA | buildSha=unknown
[api] [16:23:35] [wrn] [EVENT] [SYS-1001] Public folder not found - skipping static file serving | path=/Users/almurat/KiKo/kiko-api/public
[api] [16:23:35] [inf] [EVENT] [SYS-1001] Initializing services... | env=development port=3001 database=configured privy=✅ Configured webhookSecurity={Obj}
[api] [16:23:35] [inf] [EVENT] [SYS-1004] Database connection successful
[api] [DataRetention] Checking retention policies...
[api] [Prisma] DB connection is healthy
[api] [DataRetention] Starting cleanup job...
[api] [DataRetention] Scheduler started (every 60 minutes)
[api] [16:23:35] [inf] [EVENT] [SYS-1005] Redis initialized
[api] [16:23:35] [inf] [EVENT] [SYS-1001] Starting server on port 3001...
[api] {"level":30,"time":1770740615442,"pid":37091,"hostname":"almuratdeMacBook-Pro.local","msg":"Server listening at http://0.0.0.0:3001"}
[api] [16:23:35] [inf] [EVENT] [SYS-1001] Server listening | url=http://localhost:3001 health=http://localhost:3001/health
[api] [16:23:35] [inf] [EVENT] [SYS-1001] RPC health monitor started
[api] [16:23:35] [inf] [EVENT] [SYS-1001] RPC benchmark sampling started
[api] [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
[api] [16:23:35] [inf] [EVENT] [SYS-1007] Scheduled: Primary chains every 5min (Ethereum, Solana, Base, BSC)
[api] [16:23:35] [inf] [EVENT] [SYS-1007] Scheduled: Secondary chains every 4h (Arbitrum, Optimism, Polygon)
[api] [SocialJob] Scheduled: Discovery (30m), Refresh (4h), Scoring (5m)
[api] [16:23:35] [inf] [EVENT] [SYS-1001] Background jobs started
[api] [16:23:35] [inf] [EVENT] [SYS-1001] Initializing auto trade service...
[api] [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
[api] [16:23:35] [inf] [EVENT] [SYS-1001] Auto trade service initialized (Solana watcher + EVM webhook enabled) | mode=hybrid
[api] [16:23:35] [inf] [EVENT] [SYS-1001] Auto trade service started
[api] [PositionMonitor] Starting position monitor (every 30s)...
[api] [16:23:35] [inf] [EVENT] [SYS-1001] Position monitor started
[api] [16:23:35] [inf] [EVENT] [SYS-1001] Token Alert Service started
[api] [16:23:35] [inf] [EVENT] [SYS-1001] Token alert service started
[api] [ChatWorker] Started polling for AI tasks (interval: 3000ms)
[api] [16:23:35] [inf] [EVENT] [SYS-1001] Chat worker started
[api] [16:23:35] [inf] [EVENT] [SYS-1001] Starting Global Zora Alpha Detector (API Polling) | thresholds={Obj} interval=60000
[api] [16:23:35] [inf] [EVENT] [SYS-1001] 🎉 All services initialized!
[api] [DataRetention] Cleanup job completed.
[python] INFO:chromadb.telemetry.product.posthog:Anonymized telemetry enabled. See                     https://docs.trychroma.com/telemetry for more information.
[python] INFO:__main__:✅ RAG service mounted at /rag
[python] INFO:     Started server process [37090]
[python] INFO:     Waiting for application startup.
[python] INFO:     Application startup complete.
[python] INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
[api] [16:23:38] [inf] [TRACE] [WS-8001] ChatWS Client connected | tid=e6fb3e37-5d04-48aa-a6c0-d0358d7e71d6 userId=did:privy:cmj0a3j3f005fl20c4xkl7195 totalConnections=1
[api] [16:23:38] [inf] [TRACE] [WS-8001] ChatWS: User connected | tid=e6fb3e37-5d04-48aa-a6c0-d0358d7e71d6 userId=did:privy:cmj0a3j3f005fl2... tokenExp=1770740923
[api] [MarketJob] Running startup staleness check...
[api] [Job] ✅ Loaded 436 real hot users from /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Job] ✅ Using 436 real hot users from analysis
[api] [SocialJob] fetchCastsFromUsers starting with 436 FIDs, target: 1000
[api] [16:23:40] [inf] [EVENT] [SYS-1001] No open positions to monitor
[api] Saved 15 trending tokens to database via Prisma with retry protection
[api] [16:23:41] [inf] [METRIC] [API-5001] Trending tokens refreshed: 15 tokens
[api] [16:24:05] [inf] [EVENT] [SYS-1007] Starting initial token refresh...
[api] [16:24:10] [inf] [EVENT] [SYS-1001] No open positions to monitor
[api] [16:24:35] [wrn] [EVENT] [SYS-1006] RPC health degraded | endpoints=[5]
[api] [16:24:35] [inf] [METRIC] [API-5001] Fetching premium trending tokens | chain=solana limit=100
[api] [16:24:36] [inf] [AUDIT] [WTC-2002] WS addresses discovered | wsCount=259 chain=solana
[api] [16:24:39] [inf] [EVENT] [SYS-1007] Alpha Detector: Checking new coin | symbol=storm_e29b creator=0xa49f2c499a61890fc56bb62729bb1f1ac2f905d8
[api] [16:24:40] [inf] [EVENT] [SYS-1001] No open positions to monitor
[api] [16:24:43] [inf] [METRIC] [API-5001] Processed DexScreener trending candidates | candidates=132 limit=200
[api] [16:24:43] [inf] [METRIC] [API-5001] Premium trending tokens fetch complete | count=100 chain=solana source=WebSocket wsOriginal=259 dur=7643ms
[api] [16:24:43] [inf] [METRIC] [API-5001] Got 100 trending tokens for Solana
[api] [16:24:44] [inf] [TRACE] [AI-6005] Timer finished: launchpad_det_CvTMSEB9RzHPhB1CgE7PAkszomozDv3JJNz28sDbpump | address=CvTMSEB9RzHPhB1CgE7PAkszomozDv3JJNz28sDbpump found=true timerLabel=launchpad_det_CvTMSEB9RzHPhB1CgE7PAkszomozDv3JJNz28sDbpump dur=1020ms
[api] [16:25:00] [inf] [EVENT] [SYS-1007] SocialRepo: Recalculated heat scores for 0 casts
[api] [16:25:00] [inf] [EVENT] [SYS-1007] Timer finished: recalc_heat_scores | count=0 timerLabel=recalc_heat_scores dur=4ms
[api] [16:25:10] [inf] [EVENT] [SYS-1001] No open positions to monitor
[api] [16:25:35] [wrn] [EVENT] [SYS-1006] RPC health degraded | endpoints=[5]
[api] [16:25:40] [inf] [EVENT] [SYS-1001] No open positions to monitor
[api] [16:25:42] [inf] [EVENT] [SYS-1007] Alpha Detector: Checking new coin | symbol=clay_a2f4 creator=0x18d9538c110de6c944998db6d3fcfb59542cb449
[api] [16:25:42] [inf] [EVENT] [SYS-1007] Alpha Detector: Checking new coin | symbol=sfror creator=0xea7cac3a70cb036ce1394dbe89f0c95d6f83a412
[api] [16:25:57] [inf] [METRIC] [API-5001] Fetching premium trending tokens | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee chain=base limit=100
[api] [16:25:58] [inf] [TRACE] [WS-8001] ChatWS Client connected | tid=60d0a507-2981-417d-be15-1f5afcc81f30 userId=did:privy:cmj0a3j3f005fl20c4xkl7195 totalConnections=1
[api] [16:25:58] [inf] [TRACE] [WS-8001] ChatWS: User connected | tid=60d0a507-2981-417d-be15-1f5afcc81f30 userId=did:privy:cmj0a3j3f005fl2... tokenExp=1770744358
[api] [16:25:59] [inf] [AUDIT] [WTC-2002] WS addresses discovered | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee wsCount=179 chain=base
[api] [16:26:03] [inf] [METRIC] [API-5001] Processed DexScreener trending candidates | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee candidates=49 limit=200
[api] [originRestriction] Request blocked {
[api]   origin: '',
[api]   referer: '',
[api]   effectiveOrigin: '',
[api]   userAgent: 'curl/8.7.1',
[api]   allowedOrigins: [
[api]     'http://localhost:5173',
[api]     'http://localhost:3000',
[api]     'http://127.0.0.1:5173',
[api]     'http://127.0.0.1:3000',
[api]     'capacitor://localhost'
[api]   ]
[api] }
[api] [originRestriction] DEV MODE: Allowing request despite origin mismatch
[api] [16:26:08] [wrn] [METRIC] [API-5004] GeckoTerminal 429 triggered backoff | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee backoffMs=60000
[api] [16:26:09] [wrn] [METRIC] [API-5004] GeckoTerminal 429 triggered backoff | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee backoffMs=60000
[api] [16:26:10] [inf] [EVENT] [SYS-1001] No open positions to monitor
[api] [16:26:11] [wrn] [METRIC] [API-5004] GeckoTerminal 429 triggered backoff | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee backoffMs=60000
[api] [16:26:16] [wrn] [METRIC] [API-5004] GeckoTerminal 429 triggered backoff | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee backoffMs=60000
[api] [16:26:16] [err] [METRIC] [API-5002] GeckoTerminal API error after retries | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee endpoint=/networks/base/trending_pools?page=6&include=base_token&duration=5m error=Rate limit hit, backing off for 60000ms
[api] [16:26:16] [err] [METRIC] [API-5002] Error fetching trending tokens | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee network=base error=Rate limit hit, backing off for 60000ms
[api] [16:26:16] [inf] [METRIC] [API-5001] Premium trending tokens fetch complete | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee count=79 chain=base source=WebSocket wsOriginal=179 dur=18648ms
[api] [16:26:16] [inf] [METRIC] [API-5001] Got 79 trending tokens for Base | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee
[api] [16:26:16] [inf] [METRIC] [API-5001] Filtered out 1 invalid tokens for Base | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee
[api] [16:26:22] [inf] [METRIC] [API-5003] LaunchpadDetector: Global timeout reached | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee address=0x9Cb41FD9dC6891BAe8187029461bfAADF6CC0C69
[api] [16:26:22] [inf] [METRIC] [API-5003] LaunchpadDetector: Global timeout reached | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee address=0x290f057A2C59b95D8027aa4Abf31782676502071
[api] [16:26:22] [inf] [TRACE] [AI-6005] Timer finished: launchpad_det_0x9Cb41FD9dC6891BAe8187029461bfAADF6CC0C69 | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee address=0x9Cb41FD9dC6891BAe8187029461bfAADF6CC0C69 chainId=8453 found=false timerLabel=launchpad_det_0x9Cb41FD9dC6891BAe8187029461bfAADF6CC0C69 dur=6003ms
[api] [16:26:22] [inf] [TRACE] [AI-6005] Timer finished: launchpad_det_0x290f057A2C59b95D8027aa4Abf31782676502071 | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee address=0x290f057A2C59b95D8027aa4Abf31782676502071 chainId=8453 found=false timerLabel=launchpad_det_0x290f057A2C59b95D8027aa4Abf31782676502071 dur=6001ms
[api] [16:26:23] [inf] [TRACE] [WS-8001] ChatWS Client connected | tid=c4c18cbb-b33d-41ef-acda-fae888a4c3ae userId=did:privy:cmj0a3j3f005fl20c4xkl7195 totalConnections=1
[api] [16:26:23] [inf] [TRACE] [WS-8001] ChatWS: User connected | tid=c4c18cbb-b33d-41ef-acda-fae888a4c3ae userId=did:privy:cmj0a3j3f005fl2... tokenExp=1770744358
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   userIdLength: 35,
[api]   userIdPrefix: 'did:privy:cmj0a3j3f0',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] [verifyAccess] ✅ Access granted
[api] [16:26:24] [inf] [TRACE] [AI-6005] Timer finished: launchpad_det_0x1B5E07d4d2f753fA2f7f1940A00e2273C19ecB07 | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee address=0x1B5E07d4d2f753fA2f7f1940A00e2273C19ecB07 chainId=8453 found=true timerLabel=launchpad_det_0x1B5E07d4d2f753fA2f7f1940A00e2273C19ecB07 dur=2153ms
[api] [16:26:24] [inf] [METRIC] [API-5001] Alchemy Portfolio response received | tid=2f53c86c-8c45-4f9a-94f9-5639deb7f3c3 duration=1490
[api] [16:26:25] [inf] [METRIC] [API-5001] Fetching candlestick data from DexScreener | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee network=base pairAddress=0x76c0106bBa123E9b32770b2b34B6d13bf4CfA933 timeframe=d1 limit=180
[api] [DexScreener] Request URL: https://api.dexscreener.com/latest/dex/pairs/base/0x76c0106bBa123E9b32770b2b34B6d13bf4CfA933
[api] [16:26:25] [inf] [METRIC] [API-5001] Fetching candlestick data from DexScreener | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee network=base pairAddress=0xb1bdb8d056a753d39aa35bbf7d250f512ff88c4b9098265f8ba3013ea1feda82 timeframe=h1 limit=240
[api] [DexScreener] Request URL: https://api.dexscreener.com/latest/dex/pairs/base/0xb1bdb8d056a753d39aa35bbf7d250f512ff88c4b9098265f8ba3013ea1feda82
[api] [16:26:25] [inf] [METRIC] [API-5001] Fetching candlestick data from DexScreener | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee network=base pairAddress=0xF91E0Dfe1265B914182De54E08C9CA2068bedDDE timeframe=d1 limit=180
[api] [DexScreener] Request URL: https://api.dexscreener.com/latest/dex/pairs/base/0xF91E0Dfe1265B914182De54E08C9CA2068bedDDE
[api] [16:26:26] [inf] [METRIC] [API-5001] No price history on DexScreener, using current price | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee currentPrice=0.0002652
[api] [16:26:26] [inf] [METRIC] [API-5001] Generated candles from price points | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee count=1 sourcePoints=1 requested=180 dur=338ms
[api] [16:26:26] [inf] [METRIC] [API-5001] No price history on DexScreener, using current price | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee currentPrice=0.00000152
[api] [16:26:26] [inf] [METRIC] [API-5001] Generated candles from price points | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee count=1 sourcePoints=1 requested=240 dur=352ms
[api] [16:26:26] [inf] [METRIC] [API-5001] No price history on DexScreener, using current price | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee currentPrice=0.5674
[api] [16:26:26] [inf] [METRIC] [API-5001] Generated candles from price points | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee count=1 sourcePoints=1 requested=180 dur=381ms
[api] [16:26:28] [inf] [METRIC] [API-5001] Hybrid Fetch recovered missing token | tid=2f53c86c-8c45-4f9a-94f9-5639deb7f3c3 chain=base token=USDC amount=0.181557
[api] [16:26:28] [inf] [METRIC] [API-5001] Fetching candlestick data from DexScreener | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee network=base pairAddress=0xa12ced238024723126e64d9a9b75456b040842054ef69bd426656f1fcb58857f timeframe=h1 limit=240
[api] [DexScreener] Request URL: https://api.dexscreener.com/latest/dex/pairs/base/0xa12ced238024723126e64d9a9b75456b040842054ef69bd426656f1fcb58857f
[api] [16:26:29] [inf] [METRIC] [API-5001] No price history on DexScreener, using current price | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee currentPrice=0.000001746
[api] [16:26:29] [inf] [METRIC] [API-5001] Generated candles from price points | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee count=1 sourcePoints=1 requested=240 dur=386ms
[api] [16:26:29] [inf] [METRIC] [API-5001] Alchemy Portfolio response received | tid=dc268d58-24c3-4389-8edc-fe05a4fe2b16 duration=961
[api] [16:26:30] [inf] [METRIC] [API-5001] Hybrid Fetch recovered missing token | tid=dc268d58-24c3-4389-8edc-fe05a4fe2b16 chain=base token=USDC amount=0.181557
[api] [16:26:30] [inf] [METRIC] [API-5001] Fetching premium trending tokens | chain=bsc limit=100
[api] [16:26:32] [inf] [AUDIT] [WTC-2002] WS addresses discovered | wsCount=194 chain=bsc
[api] [16:26:35] [err] [METRIC] [API-5002] api failed after 1 attempts | tid=416c2d6b-3ab8-43d8-ac60-30baaec098ee error=This operation was aborted url=https://api2.virtuals.io/api/virtuals?filters%5BmigrateToken
[api] [16:26:35] [inf] [METRIC] [API-5001] Processed DexScreener trending candidates | candidates=31 limit=200
[api] [16:26:35] [err] [METRIC] [API-5002] Error fetching trending tokens | network=bsc error=GeckoTerminal backoff active (42s remaining)
[api] [16:26:35] [inf] [METRIC] [API-5001] Premium trending tokens fetch complete | count=76 chain=bsc source=WebSocket wsOriginal=194 dur=4882ms
[api] [16:26:35] [inf] [METRIC] [API-5001] Got 76 trending tokens for BSC
[api] [16:26:35] [wrn] [EVENT] [SYS-1006] RPC health degraded | endpoints=[5]
[api] [LaunchMultiple] Suspicious multiple x767018.4 (max allowed x200000 for age 6410.2h) chain=bsc addr=0xe6DF05CE source=gecko_launch_window — suppressed
[api] [16:26:35] [inf] [METRIC] [API-5001] Fetching candlestick data from DexScreener | network=bsc pairAddress=0xf0750c373EbBB3BaEEF7e03D8300cAaD1983d67c timeframe=d1 limit=180
[api] [DexScreener] Request URL: https://api.dexscreener.com/latest/dex/pairs/bsc/0xf0750c373EbBB3BaEEF7e03D8300cAaD1983d67c
[api] [16:26:35] [inf] [METRIC] [API-5001] Fetching candlestick data from DexScreener | network=bsc pairAddress=0x92A99fd66B4dfAaE5AF10da8AE30d06E27209dDB timeframe=d1 limit=180
[api] [DexScreener] Request URL: https://api.dexscreener.com/latest/dex/pairs/bsc/0x92A99fd66B4dfAaE5AF10da8AE30d06E27209dDB
[api] [16:26:35] [inf] [METRIC] [API-5001] Fetching candlestick data from DexScreener | network=bsc pairAddress=0x80a02B0ec051DE98c56212b30f22c5718928efDD timeframe=d1 limit=180
[api] [DexScreener] Request URL: https://api.dexscreener.com/latest/dex/pairs/bsc/0x80a02B0ec051DE98c56212b30f22c5718928efDD
[api] [16:26:35] [inf] [METRIC] [API-5001] Fetching candlestick data from DexScreener | network=bsc pairAddress=0x3d7C319090edf2293608a0f9a786317c66D320F8 timeframe=d1 limit=180
[api] [DexScreener] Request URL: https://api.dexscreener.com/latest/dex/pairs/bsc/0x3d7C319090edf2293608a0f9a786317c66D320F8
[api] [16:26:36] [inf] [METRIC] [API-5001] No price history on DexScreener, using current price | currentPrice=0.0003097
[api] [16:26:36] [inf] [METRIC] [API-5001] Generated candles from price points | count=1 sourcePoints=1 requested=180 dur=322ms
[api] [16:26:36] [inf] [METRIC] [API-5001] No price history on DexScreener, using current price | currentPrice=0.2399
[api] [16:26:36] [inf] [METRIC] [API-5001] Generated candles from price points | count=1 sourcePoints=1 requested=180 dur=367ms
[api] [16:26:36] [inf] [METRIC] [API-5001] No price history on DexScreener, using current price | currentPrice=1.00089
[api] [16:26:36] [inf] [METRIC] [API-5001] Generated candles from price points | count=1 sourcePoints=1 requested=180 dur=337ms
[api] [16:26:36] [inf] [METRIC] [API-5001] No price history on DexScreener, using current price | currentPrice=0.006132
[api] [16:26:36] [inf] [METRIC] [API-5001] Generated candles from price points | count=1 sourcePoints=1 requested=180 dur=378ms
[api] [16:26:40] [inf] [EVENT] [SYS-1001] No open positions to monitor

