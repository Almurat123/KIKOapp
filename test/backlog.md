Last login: Tue Jan 27 16:34:26 on ttys008
almurat@almuratdeMacBook-Pro ~ % cd kiko/kiko-api && npm run dev

> kiko-api@1.0.0 dev
> concurrently -k -n api,python "tsx watch src/index.ts" "cd ../kiko-python && python3 main.py"

[python] INFO:__main__:✅ Grok service mounted at /grok
[python] INFO:moderation.models:✅ OpenAI Moderation API initialized (lightweight mode)
[python] INFO:__main__:✅ Moderation service mounted at /moderation
[api] [Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] {"timestamp":"2026-01-27T08:34:38.184Z","level":"INFO","code":"SYS-1001","message":"Zora SDK initialized with API Key","metadata":{},"service":"kiko-api","env":"production"}
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
[api] {"timestamp":"2026-01-27T08:34:38.674Z","level":"WARN","code":"SYS-1001","message":"Public folder not found - skipping static file serving","metadata":{"path":"/Users/almurat/KiKo/kiko-api/public"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:38.676Z","level":"INFO","code":"SYS-1001","message":"Initializing services...","metadata":{"env":"production","port":3001,"database":"configured","privy":"✅ Configured"},"service":"kiko-api","env":"production"}
[api] [Prisma] DB connection is healthy
[api] {"timestamp":"2026-01-27T08:34:39.098Z","level":"INFO","code":"SYS-1004","message":"Database connection successful","metadata":{},"service":"kiko-api","env":"production"}
[api] [DataRetention] Checking retention policies...
[api] [DataRetention] Starting cleanup job...
[api] [Redis] Connected successfully
[api] {"timestamp":"2026-01-27T08:34:39.120Z","level":"INFO","code":"SYS-1005","message":"Redis initialized","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:39.120Z","level":"INFO","code":"SYS-1001","message":"Starting server on port 3001...","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1769502879142,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","msg":"Server listening at http://0.0.0.0:3001"}
[api] {"timestamp":"2026-01-27T08:34:39.142Z","level":"INFO","code":"SYS-1001","message":"Server listening","metadata":{"url":"http://localhost:3001","health":"http://localhost:3001/health"},"service":"kiko-api","env":"production"}
[api] [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
[api] [TokenJob] Scheduled: Every 5min (Ethereum, Solana, Base, BSC, Arbitrum, Optimism, Polygon)
[api] [SocialJob] Scheduled: Every 10min
[api] {"timestamp":"2026-01-27T08:34:39.167Z","level":"INFO","code":"SYS-1001","message":"Background jobs started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:39.167Z","level":"INFO","code":"SYS-1001","message":"Initializing auto trade service...","metadata":{},"service":"kiko-api","env":"production"}
[api] [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
[api] {"timestamp":"2026-01-27T08:34:39.167Z","level":"INFO","code":"SYS-1001","message":"Auto trade service initialized (Solana watcher + EVM webhook enabled)","metadata":{"mode":"hybrid"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:39.167Z","level":"INFO","code":"SYS-1001","message":"Auto trade service started","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] Starting position monitor (every 30s)...
[api] {"timestamp":"2026-01-27T08:34:39.167Z","level":"INFO","code":"SYS-1001","message":"Position monitor started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:39.167Z","level":"INFO","code":"SYS-1001","message":"Token Alert Service started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:39.167Z","level":"INFO","code":"SYS-1001","message":"Token alert service started","metadata":{},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Started polling for AI tasks (interval: 3000ms)
[api] {"timestamp":"2026-01-27T08:34:39.167Z","level":"INFO","code":"SYS-1001","message":"Chat worker started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:39.167Z","level":"INFO","code":"SYS-1001","message":"Starting Global Zora Alpha Detector (API Polling)","metadata":{"threshold":1000000,"interval":60000},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:39.167Z","level":"INFO","code":"SYS-1001","message":"🎉 All services initialized!","metadata":{},"service":"kiko-api","env":"production"}
[api] [DataRetention] Cleaned 1 records from TrendingCast
[api] [DataRetention] Cleanup job completed.
[python] INFO:chromadb.telemetry.product.posthog:Anonymized telemetry enabled. See                     https://docs.trychroma.com/telemetry for more information.
[python] INFO:__main__:✅ RAG service mounted at /rag
[python] INFO:     Started server process [2111]
[python] INFO:     Waiting for application startup.
[python] INFO:     Application startup complete.
[python] INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
[api] [MarketJob] Running startup staleness check...
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:34:44.182Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [Job] ✅ Loaded 436 real hot users from /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Job] ✅ Using 436 real hot users from analysis
[api] [SocialJob] fetchCastsFromUsers starting with 436 FIDs, target: 500
[api] DeFiLlama Derivatives Open Interest: $33.52B
[api] Market overview saved to database and memory cache
[api] [MarketJob] ✅ Overview refreshed successfully
[api] Saved batch 1/350
[api] Saved batch 2/350
[api] Saved batch 3/350
[api] Saved batch 4/350
[api] Saved batch 5/350
[api] Saved batch 6/350
[api] Saved batch 7/350
[api] Saved batch 8/350
[api] Saved batch 9/350
[api] Saved batch 10/350
[api] Saved batch 11/350
[api] Saved batch 12/350
[api] Saved batch 13/350
[api] Saved batch 14/350
[api] Saved batch 15/350
[api] Saved batch 16/350
[api] Saved batch 17/350
[api] Saved batch 18/350
[api] Saved batch 19/350
[api] Saved batch 20/350
[api] Saved batch 21/350
[api] Saved batch 22/350
[api] Saved batch 23/350
[api] Saved batch 24/350
[api] Saved batch 25/350
[api] Saved batch 26/350
[api] Saved batch 27/350
[api] Saved batch 28/350
[api] Saved batch 29/350
[api] Saved batch 30/350
[api] Saved batch 31/350
[api] Saved batch 32/350
[api] Saved batch 33/350
[api] Saved batch 34/350
[api] Saved batch 35/350
[api] Saved batch 36/350
[api] Saved batch 37/350
[api] Saved batch 38/350
[api] Saved batch 39/350
[api] Saved batch 40/350
[api] Saved batch 41/350
[api] Saved batch 42/350
[api] Saved batch 43/350
[api] Saved batch 44/350
[api] Saved batch 45/350
[api] Saved batch 46/350
[api] Saved batch 47/350
[api] Saved batch 48/350
[api] Saved batch 49/350
[api] Saved batch 50/350
[api] Saved batch 51/350
[api] Saved batch 52/350
[api] Saved batch 53/350
[api] Saved batch 54/350
[api] Saved batch 55/350
[api] Saved batch 56/350
[api] Saved batch 57/350
[api] Saved batch 58/350
[api] Saved batch 59/350
[api] Saved batch 60/350
[api] Saved batch 61/350
[api] Saved batch 62/350
[api] Saved batch 63/350
[api] Saved batch 64/350
[api] Saved batch 65/350
[api] Saved batch 66/350
[api] Saved batch 67/350
[api] Saved batch 68/350
[api] Saved batch 69/350
[api] Saved batch 70/350
[api] Saved batch 71/350
[api] Saved batch 72/350
[api] Saved batch 73/350
[api] Saved batch 74/350
[api] Saved batch 75/350
[api] Saved batch 76/350
[api] Saved batch 77/350
[api] Saved batch 78/350
[api] Saved batch 79/350
[api] Saved batch 80/350
[api] Saved batch 81/350
[api] Saved batch 82/350
[api] Saved batch 83/350
[api] Saved batch 84/350
[api] Saved batch 85/350
[api] Saved batch 86/350
[api] Saved batch 87/350
[api] Saved batch 88/350
[api] Saved batch 89/350
[api] Saved batch 90/350
[api] Saved batch 91/350
[api] Saved batch 92/350
[api] Saved batch 93/350
[api] Saved batch 94/350
[api] Saved batch 95/350
[api] Saved batch 96/350
[api] Saved batch 97/350
[api] Saved batch 98/350
[api] Saved batch 99/350
[api] Saved batch 100/350
[api] Saved batch 101/350
[api] Saved batch 102/350
[api] Saved batch 103/350
[api] Saved batch 104/350
[api] Saved batch 105/350
[api] Saved batch 106/350
[api] Saved batch 107/350
[api] Saved batch 108/350
[api] Saved batch 109/350
[api] Saved batch 110/350
[api] Saved batch 111/350
[api] Saved batch 112/350
[api] Saved batch 113/350
[api] Saved batch 114/350
[api] Saved batch 115/350
[api] Saved batch 116/350
[api] Saved batch 117/350
[api] Saved batch 118/350
[api] Saved batch 119/350
[api] Saved batch 120/350
[api] Saved batch 121/350
[api] Saved batch 122/350
[api] Saved batch 123/350
[api] Saved batch 124/350
[api] Saved batch 125/350
[api] Saved batch 126/350
[api] Saved batch 127/350
[api] Saved batch 128/350
[api] Saved batch 129/350
[api] Saved batch 130/350
[api] Saved batch 131/350
[api] Saved batch 132/350
[api] Saved batch 133/350
[api] Saved batch 134/350
[api] Saved batch 135/350
[api] Saved batch 136/350
[api] Saved batch 137/350
[api] Saved batch 138/350
[api] Saved batch 139/350
[api] Saved batch 140/350
[api] Saved batch 141/350
[api] Saved batch 142/350
[api] Saved batch 143/350
[api] Saved batch 144/350
[api] Saved batch 145/350
[api] Saved batch 146/350
[api] Saved batch 147/350
[api] Saved batch 148/350
[api] Saved batch 149/350
[api] Saved batch 150/350
[api] Saved batch 151/350
[api] Saved batch 152/350
[api] Saved batch 153/350
[api] Saved batch 154/350
[api] Saved batch 155/350
[api] Saved batch 156/350
[api] Saved batch 157/350
[api] Saved batch 158/350
[api] Saved batch 159/350
[api] Saved batch 160/350
[api] Saved batch 161/350
[api] Saved batch 162/350
[api] Saved batch 163/350
[api] Saved batch 164/350
[api] Saved batch 165/350
[api] Saved batch 166/350
[api] Saved batch 167/350
[api] Saved batch 168/350
[api] Saved batch 169/350
[api] Saved batch 170/350
[api] Saved batch 171/350
[api] Saved batch 172/350
[api] Saved batch 173/350
[api] Saved batch 174/350
[api] Saved batch 175/350
[api] Saved batch 176/350
[api] Saved batch 177/350
[api] Saved batch 178/350
[api] Saved batch 179/350
[api] Saved batch 180/350
[api] Saved batch 181/350
[api] Saved batch 182/350
[api] Saved batch 183/350
[api] Saved batch 184/350
[api] Saved batch 185/350
[api] Saved batch 186/350
[api] Saved batch 187/350
[api] Saved batch 188/350
[api] Saved batch 189/350
[api] Saved batch 190/350
[api] Saved batch 191/350
[api] Saved batch 192/350
[api] Saved batch 193/350
[api] Saved batch 194/350
[api] Saved batch 195/350
[api] Saved batch 196/350
[api] Saved batch 197/350
[api] Saved batch 198/350
[api] Saved batch 199/350
[api] Saved batch 200/350
[api] Saved batch 201/350
[api] Saved batch 202/350
[api] Saved batch 203/350
[api] Saved batch 204/350
[api] Saved batch 205/350
[api] Saved batch 206/350
[api] Saved batch 207/350
[api] Saved batch 208/350
[api] Saved batch 209/350
[api] Saved batch 210/350
[api] Saved batch 211/350
[api] Saved batch 212/350
[api] Saved batch 213/350
[api] Saved batch 214/350
[api] Saved batch 215/350
[api] Saved batch 216/350
[api] Saved batch 217/350
[api] Saved batch 218/350
[api] Saved batch 219/350
[api] Saved batch 220/350
[api] Saved batch 221/350
[api] Saved batch 222/350
[api] Saved batch 223/350
[api] Saved batch 224/350
[api] Saved batch 225/350
[api] Saved batch 226/350
[api] Saved batch 227/350
[api] Saved batch 228/350
[api] Saved batch 229/350
[api] Saved batch 230/350
[api] Saved batch 231/350
[api] Saved batch 232/350
[api] Saved batch 233/350
[api] Saved batch 234/350
[api] Saved batch 235/350
[api] Saved batch 236/350
[api] Saved batch 237/350
[api] Saved batch 238/350
[api] Saved batch 239/350
[api] Saved batch 240/350
[api] Saved batch 241/350
[api] Saved batch 242/350
[api] Saved batch 243/350
[api] Saved batch 244/350
[api] Saved batch 245/350
[api] Saved batch 246/350
[api] Saved batch 247/350
[api] Saved batch 248/350
[api] Saved batch 249/350
[api] Saved batch 250/350
[api] Saved batch 251/350
[api] Saved batch 252/350
[api] Saved batch 253/350
[api] Saved batch 254/350
[api] Saved batch 255/350
[api] Saved batch 256/350
[api] Saved batch 257/350
[api] Saved batch 258/350
[api] Saved batch 259/350
[api] Saved batch 260/350
[api] Saved batch 261/350
[api] Saved batch 262/350
[api] Saved batch 263/350
[api] Saved batch 264/350
[api] Saved batch 265/350
[api] Saved batch 266/350
[api] Saved batch 267/350
[api] Saved batch 268/350
[api] Saved batch 269/350
[api] Saved batch 270/350
[api] Saved batch 271/350
[api] Saved batch 272/350
[api] Saved batch 273/350
[api] Saved batch 274/350
[api] Saved batch 275/350
[api] Saved batch 276/350
[api] Saved batch 277/350
[api] Saved batch 278/350
[api] Saved batch 279/350
[api] Saved batch 280/350
[api] Saved batch 281/350
[api] Saved batch 282/350
[api] Saved batch 283/350
[api] Saved batch 284/350
[api] Saved batch 285/350
[api] Saved batch 286/350
[api] Saved batch 287/350
[api] Saved batch 288/350
[api] Saved batch 289/350
[api] Saved batch 290/350
[api] Saved batch 291/350
[api] Saved batch 292/350
[api] Saved batch 293/350
[api] Saved batch 294/350
[api] Saved batch 295/350
[api] Saved batch 296/350
[api] Saved batch 297/350
[api] Saved batch 298/350
[api] Saved batch 299/350
[api] Saved batch 300/350
[api] Saved batch 301/350
[api] Saved batch 302/350
[api] Saved batch 303/350
[api] Saved batch 304/350
[api] Saved batch 305/350
[api] Saved batch 306/350
[api] Saved batch 307/350
[api] Saved batch 308/350
[api] Saved batch 309/350
[api] Saved batch 310/350
[api] Saved batch 311/350
[api] Saved batch 312/350
[api] Saved batch 313/350
[api] Saved batch 314/350
[api] Saved batch 315/350
[api] Saved batch 316/350
[api] Saved batch 317/350
[api] Saved batch 318/350
[api] Saved batch 319/350
[api] Saved batch 320/350
[api] Saved batch 321/350
[api] Saved batch 322/350
[api] Saved batch 323/350
[api] Saved batch 324/350
[api] Saved batch 325/350
[api] Saved batch 326/350
[api] Saved batch 327/350
[api] Saved batch 328/350
[api] Saved batch 329/350
[api] Saved batch 330/350
[api] Saved batch 331/350
[api] Saved batch 332/350
[api] Saved batch 333/350
[api] Saved batch 334/350
[api] Saved batch 335/350
[api] Saved batch 336/350
[api] Saved batch 337/350
[api] Saved batch 338/350
[api] Saved batch 339/350
[api] Saved batch 340/350
[api] Saved batch 341/350
[api] Saved batch 342/350
[api] Saved batch 343/350
[api] Saved batch 344/350
[api] Saved batch 345/350
[api] Saved batch 346/350
[api] Saved batch 347/350
[api] Saved batch 348/350
[api] Saved batch 349/350
[api] Saved batch 350/350
[api] Saved 6994 protocols to database and memory cache
[api] [MarketJob] ✅ Protocols refreshed successfully: 6994 protocols
[api] Saved 15 trending tokens to database via Prisma with retry protection
[api] [MarketJob] Trending tokens refreshed: 15 tokens
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:34:54.190Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.195Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":8939,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.197Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":279528,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.199Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":3},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.199Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1443396,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.200Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":4},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.200Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":204214,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.200Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":5},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.200Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1020251,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.204Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":6},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.204Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":617,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.205Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":7},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.205Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047800,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.205Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":8},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.205Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1606759,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.206Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":9},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.206Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042372,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.206Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":10},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.206Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046836,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.210Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":11},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.211Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047653,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.211Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":12},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.211Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047863,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.211Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":13},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.211Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":279246,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.211Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":14},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.211Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":850271,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.211Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":15},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.211Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":375831,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.211Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":16},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.211Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046878,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.212Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":17},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.212Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":251596,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.212Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":18},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.212Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1048126,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.212Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":19},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.212Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":535179,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.212Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":20},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.212Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046867,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.212Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":21},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.212Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046861,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.212Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":22},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.212Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047353,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.213Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":23},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.213Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046439,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.213Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":24},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.213Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1041982,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.213Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":25},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.213Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042925,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.213Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":26},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.213Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":4482,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.219Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":27},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.220Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":475488,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.220Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":28},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.220Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046574,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.220Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":29},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.220Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1041585,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.220Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"hub.merv.fun","failures":30},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.220Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1477667,"error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":270504,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047132,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":206,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1103648,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":548932,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":369,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046566,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":8942,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":15732,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1426445,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":4327,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":430484,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":20264,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":2007,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046864,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":196957,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":299712,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":18085,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":243300,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":2341,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":5818,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.240Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":14890,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.241Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":239,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.241Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":528,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.241Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1048194,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.241Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047032,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.241Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":17635,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.241Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":263574,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.241Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1371361,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.241Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1048291,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1689,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":457339,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":348569,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047519,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042953,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1559934,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":4373,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1043099,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":309857,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1048117,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042364,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":5774,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047044,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":385736,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":789995,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1025567,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1043673,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047050,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046519,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":12224,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":248665,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1439819,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1015735,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046655,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":602,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1594462,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046652,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":2433,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":9933,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.262Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":10420,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":2802,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047432,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":534,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1251798,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047950,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":260090,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":4163,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1725,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1041974,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":11241,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1566681,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":238425,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":20286,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046827,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":8152,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":372614,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":4167,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":20919,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":129,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1531904,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1050528,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1078524,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1386932,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":300833,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1045817,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042306,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":3189,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":9135,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":675150,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.284Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042041,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1575,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":844615,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":2904,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046639,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1049120,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":18069,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":7732,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1325,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047435,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1606,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1043108,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":5698,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1395961,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":301815,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":315654,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":378813,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042350,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":733,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1041894,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":5643,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":217248,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1048128,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":473,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1077510,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":12239,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1118370,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":516359,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":864405,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":544859,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.306Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1050528,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":267104,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":303,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":621261,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046569,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046571,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1188162,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047656,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":214447,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":302168,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":199866,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046823,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1574,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":310124,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":99,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":822718,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":440747,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":447786,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042252,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":339009,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":899923,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042542,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1108951,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1084543,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":315558,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":17360,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":535036,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046660,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047806,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1436662,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.328Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":194519,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046538,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":976,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1071795,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":738574,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1351067,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":359,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":814451,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1587853,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":277644,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":12,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1106125,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1110131,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047623,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1098768,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1591373,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":10174,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1098769,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":15351,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":14890,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1467344,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.349Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":247143,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.350Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1045817,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.350Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":373904,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.350Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":537378,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.350Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047629,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.350Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1192389,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.350Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046451,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.350Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":19343,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.350Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":9218,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.372Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1041753,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.372Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":3449,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.372Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047628,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.372Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046430,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.372Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042549,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.372Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047811,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.372Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":616,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.372Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1356,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.372Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046394,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.372Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":225,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.373Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":9856,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.373Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1600217,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.373Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1125364,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.373Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042827,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.373Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":758919,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.373Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":7418,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.373Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":190096,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.373Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042055,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.373Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":3,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.373Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":203751,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.373Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1107243,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.373Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":16333,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.373Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1040937,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.373Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":347050,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.373Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":270504,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.373Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":239965,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.373Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":11244,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.373Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":194,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.373Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1268915,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.373Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1049461,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.394Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":633,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.394Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":943967,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.394Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":2,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.394Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":232855,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.394Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":684627,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.394Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":816839,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.394Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1125364,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.394Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":251285,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.394Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047427,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.394Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1020,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.394Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":245497,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.394Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":801019,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.394Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047779,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.394Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046877,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.394Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047027,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.394Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":15211,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.394Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":190218,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.394Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":369863,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.394Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":506,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.394Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1106125,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.395Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":482872,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.395Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":213222,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.395Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047048,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.395Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":375,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.395Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046523,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.395Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":4528,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.395Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":8004,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.395Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":487460,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.395Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":9816,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.395Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047791,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.416Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":169,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.416Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1134,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.416Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":427204,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.416Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":15776,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.416Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":963478,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":15983,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1104918,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1322716,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":221578,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1048127,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":539,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":306689,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":513816,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":347,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":427349,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":20910,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":421661,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1611628,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1041845,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1078524,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042547,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":15549,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":3621,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1353274,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":3642,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046658,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1323461,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042266,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":12921,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.417Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":272109,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.440Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":472680,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.440Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":16342,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.440Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1287,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.440Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":4031,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.440Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1613354,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.440Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":3973,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.440Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":326306,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.440Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1043085,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.440Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1071216,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.440Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1048190,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.440Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":557,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.440Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1118023,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.440Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1547128,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.440Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":431,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.440Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":473136,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.440Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":233390,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.440Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1078524,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.440Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":2210,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.440Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":548932,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.441Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1371361,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.441Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1251798,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.441Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":6373,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.441Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":844637,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.441Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":12,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.441Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":296687,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.441Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":371981,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.441Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":606589,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.441Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1045847,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.441Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":12142,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.441Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046592,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.463Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042510,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.463Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1057350,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.463Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":309710,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.463Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":378,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.463Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":20,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":473,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":17714,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042715,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":8942,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047259,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":742,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047663,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":415872,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046668,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":4407,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046538,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047264,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046832,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":403455,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1041988,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1005654,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1041749,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":2689,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":299923,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":252549,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":533,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":336103,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":517425,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":233390,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.464Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":5650,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.486Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":517994,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.486Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":490435,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.486Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":312,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.486Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042823,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.486Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":217261,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.487Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":190218,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.487Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":13901,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.487Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":675268,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.487Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":282672,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.487Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":12239,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.487Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046537,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.487Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":844637,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.487Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1389562,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.488Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1041955,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.488Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1377953,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.488Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":441956,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.488Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1023760,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.488Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":312,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.488Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":342433,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.488Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042316,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.488Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":187888,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.488Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":472,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.488Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":8,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.488Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1048,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.488Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":15549,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.488Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":8004,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.488Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":15776,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.488Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":357897,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.488Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":8152,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.488Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":14890,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.510Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":892902,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.510Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":292642,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.510Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":393855,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.510Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1552715,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.510Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":7237,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.510Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1406368,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.510Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046829,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.510Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1098794,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.510Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1610165,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.510Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042891,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.510Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":5406,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.510Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":718134,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.510Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1566860,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.510Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":329645,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.511Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042406,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.511Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1403593,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.511Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":439610,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.511Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":375747,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.511Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":503338,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.511Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":780900,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.511Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":319141,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.511Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1188162,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.511Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042319,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.511Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":522467,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.511Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":8685,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.511Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":481945,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.511Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":922,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.511Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":507194,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.511Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":592677,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.511Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":2417,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.532Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":349030,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.533Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1214,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.533Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1042034,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.533Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1047227,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.533Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046627,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.533Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1041878,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.533Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":273384,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.533Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1605445,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.533Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":295484,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.533Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":248665,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.533Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046542,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.533Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1046667,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.533Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":20384,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.533Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":72,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.533Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":6806,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:34:54.533Z","level":"WARN","code":"API-5002","message":"Failed to fetch casts from Snapchain Hub","metadata":{"fid":1526706,"error":"Circuit breaker open for hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] [SocialJob] No new casts fetched, preserving existing database data
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [TokenJob] Tokens for Ethereum are fresh, skipping API call
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:35:04.197Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [TokenJob] Starting initial token refresh...
[api] [TokenJob] Tokens for Ethereum are fresh, skipping API call
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:35:14.206Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
[api] {"timestamp":"2026-01-27T08:35:15.206Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"solana","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:35:15.206Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] [TokenJob] Skipping refresh for Solana - update already in progress
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:35:24.211Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:35:24.353Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":133,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:35:24.354Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"solana","durationMs":9148},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for Solana
[api] [TokenJob] Filtered out 5 invalid tokens for Solana
[api] Saved 95 trending tokens for solana to database and memory cache
[api] [TokenJob] Saved 95 tokens for Solana to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:35:34.219Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
[api] {"timestamp":"2026-01-27T08:35:39.179Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"base","limit":100},"service":"kiko-api","env":"production"}
[api] [TokenJob] Skipping refresh for Base - update already in progress
[api] {"timestamp":"2026-01-27T08:35:41.282Z","level":"INFO","code":"WTC-2002","message":"Found addresses via WebSocket","metadata":{"count":172,"chain":"base"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:35:44.224Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:35:44.674Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"STRIVEWITH","creator":"0x7b81729121aecd235c34f18f6a1fcb1b0e0a939f"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:35:45.032Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"NeuroGraf","creator":"0xd6b92839883b6737fba44711cadbd3f9fe4b7867"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:35:45.406Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"THIS","creator":"0xbd5de8ffb928a0257801dcbc8f2ebb4fb9de497f"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:35:45.627Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":36,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:35:45.772Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"每天一下班就来圈里看看币友们。","creator":"0xd98010fa74a3f2f9f4bf5f41a7a485a3be16cd34"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:35:46.152Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"我们的AIX要走向巅峰啦✌✌✌✌✌✌✌✌✌✌✌✌✌✌✌✌","creator":"0xfc3d96cce74e5b6334ce1a4995ae261ba9c482ad"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:35:46.526Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"FUEL","creator":"0xb18a3c09d2ca527ef8e956c37cff2622f9e1376c"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:35:46.878Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"SEA","creator":"0x7e57b5d42a37cc332cc54712db977f43baf2ff28"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:35:47.249Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"CYBER20","creator":"0xc63d46a0cd97afe57ac54b1bb1a73dc5b003f2a9"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:35:47.624Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"CRITICAL","creator":"0xa67e7bf89713bed71d090d646571e0f72fb4ee8a"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:35:47.700Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"AI 2026","liquidity":59.8938},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:35:54.340Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
[api] {"timestamp":"2026-01-27T08:35:54.411Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"bsc","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:35:56.098Z","level":"INFO","code":"WTC-2002","message":"Found addresses via WebSocket","metadata":{"count":197,"chain":"bsc"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:35:56.425Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"base","count":95,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:35:56.425Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"base","durationMs":17246},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for Base
[api] Saved 100 trending tokens for base to database and memory cache
[api] [TokenJob] Saved 100 tokens for Base to DB + cache
[api] {"timestamp":"2026-01-27T08:36:00.473Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":35,"limit":200},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x2: API-5001:Skipping low liquidity token","timestamp":"2026-01-27T08:36:02.308Z","metadata":{}}
[api] {"timestamp":"2026-01-27T08:36:02.308Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"ELONMARS","liquidity":15.1879},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:36:04.348Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x2: API-5001:Skipping low liquidity token","timestamp":"2026-01-27T08:36:09.347Z","metadata":{}}
[api] {"timestamp":"2026-01-27T08:36:09.347Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"你瞅啥","liquidity":16.2525},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:09.795Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:10.810Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:11.064Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:11.065Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"api.geckoterminal.com","failures":3},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:11.065Z","level":"ERROR","code":"API-5002","message":"API error on trending page","metadata":{"page":8,"error":"HTTP 429: Too Many Requests"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:11.065Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"bsc","count":90,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:11.065Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"bsc","durationMs":16654},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for BSC
[api] Saved 100 trending tokens for bsc to database and memory cache
[api] [TokenJob] Saved 100 tokens for BSC to DB + cache
[api] [TokenJob] Tokens for BSC are fresh, skipping API call
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:36:14.357Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:36:24.364Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
[api] {"timestamp":"2026-01-27T08:36:26.111Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"arbitrum","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:26.111Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] [TokenJob] Skipping refresh for Arbitrum - update already in progress
[api] {"timestamp":"2026-01-27T08:36:31.324Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":7,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:31.324Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"arbitrum","count":0,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:31.324Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":7,"chain":"arbitrum","durationMs":5213},"service":"kiko-api","env":"production"}
[api] [TokenJob] DexScreener returned 7 tokens, trying GeckoTerminal fallback...
[api] {"timestamp":"2026-01-27T08:36:31.324Z","level":"ERROR","code":"API-5002","message":"API error on trending page","metadata":{"page":1,"error":"Circuit breaker open for api.geckoterminal.com"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:31.325Z","level":"ERROR","code":"API-5002","message":"API error on trending page","metadata":{"page":1,"error":"Circuit breaker open for api.geckoterminal.com"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:31.325Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"arbitrum","count":0,"limit":100},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 7 trending tokens for Arbitrum
[api] Saved 7 trending tokens for arbitrum to database and memory cache
[api] [TokenJob] Saved 7 tokens for Arbitrum to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:36:34.371Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1769502994575,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1","req":{"method":"GET","url":"/api/config/auth-key-id","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50143},"msg":"incoming request"}
[api] {"level":30,"time":1769502994586,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1","res":{"statusCode":200},"responseTime":9.691500000015367,"msg":"request completed"}
[api] {"timestamp":"2026-01-27T08:36:34.590Z","level":"INFO","code":"WS-8001","message":"ChatWS Client connected","metadata":{"traceId":"6e3d8e1a-c319-4463-91a6-0974fd93cfc3","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1769502994588,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWt0Zm5oa3gwMGNka3kwYzN0M2xtMzZpIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3Njk1MDI5OTQsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc2OTUwNjU5NH0.sCiaHtgUQMShZyw_-QonN5cN0MWgdQAP3G2k3KTd19Ys0WJFSwe3BYdCNQj3RFr0aHNsQmJ9yzgVCzHO4nTy_Q","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50145},"msg":"incoming request"}
[api] {"level":30,"time":1769502994591,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","req":{"method":"OPTIONS","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50146},"msg":"incoming request"}
[api] {"level":30,"time":1769502994592,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","res":{"statusCode":204},"responseTime":0.8699580000247806,"msg":"request completed"}
[api] {"level":30,"time":1769502994593,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50147},"msg":"incoming request"}
[api] {"level":30,"time":1769502994593,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","res":{"statusCode":204},"responseTime":0.3195829999749549,"msg":"request completed"}
[api] {"level":30,"time":1769502994594,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","req":{"method":"GET","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50143},"msg":"incoming request"}
[api] {"level":30,"time":1769502994599,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50146},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] {"level":30,"time":1769502995704,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","res":{"statusCode":200},"responseTime":1109.9701249999925,"msg":"request completed"}
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1769502996515,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50147},"msg":"incoming request"}
[api] [TokenJob] Fetching trending tokens for Optimism via DexScreener Premium...
[api] {"timestamp":"2026-01-27T08:36:41.482Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"traceId":"ff5c6ac6-f3b3-4e15-ba12-19f7344cca94","chain":"optimism","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:41.482Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{"traceId":"ff5c6ac6-f3b3-4e15-ba12-19f7344cca94"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:36:44.379Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:46.301Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"traceId":"ff5c6ac6-f3b3-4e15-ba12-19f7344cca94","candidates":11,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:46.302Z","level":"INFO","code":"SYS-1007","message":"Circuit breaker reset for endpoint","metadata":{"traceId":"ff5c6ac6-f3b3-4e15-ba12-19f7344cca94","url":"api.geckoterminal.com"},"service":"kiko-api","env":"production"}
[api] [TokenJob] Skipping refresh for Optimism - update already in progress
[api] {"timestamp":"2026-01-27T08:36:49.099Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"traceId":"ff5c6ac6-f3b3-4e15-ba12-19f7344cca94","symbol":"WETH","liquidity":332.1871},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:49.670Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"CRYPTO","creator":"0xaeaac2d3b7523a97c73bc11b31fbaa97082cc6e7"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:51.532Z","level":"WARN","code":"API-5002","message":"RPC endpoint failed","metadata":{"traceId":"d0c650e6-6f7c-4bc4-bdf2-d0887f359c5f","chain":"Base","endpoint":1,"total":4,"error":"fetch failed","duration":6023},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:52.767Z","level":"INFO","code":"API-5001","message":"RPC failover success","metadata":{"traceId":"d0c650e6-6f7c-4bc4-bdf2-d0887f359c5f","chain":"Base","endpoint":2,"total":4,"responseTime":1133},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:53.126Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"ff5c6ac6-f3b3-4e15-ba12-19f7344cca94"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:53.344Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"8e3308b4-a5c0-4142-9849-77814f279dcf"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:53.596Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"8e3308b4-a5c0-4142-9849-77814f279dcf"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:53.596Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"8e3308b4-a5c0-4142-9849-77814f279dcf","url":"api.geckoterminal.com","failures":3},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:53.868Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"8e3308b4-a5c0-4142-9849-77814f279dcf"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:53.868Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"8e3308b4-a5c0-4142-9849-77814f279dcf","url":"api.geckoterminal.com","failures":4},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:53.869Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"8e3308b4-a5c0-4142-9849-77814f279dcf","error":"HTTP 429: Too Many Requests","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x82466795fbdfbcfad6cfca2257540d7c47ba3dc5/pools?include=base_token,quote_token","address":"0x82466795fbdfbcfad6cfca2257540d7c47ba3dc5","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:54.239Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"8e3308b4-a5c0-4142-9849-77814f279dcf","error":"Circuit breaker open for api.geckoterminal.com","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x3504981b34862a39a7d7297ab2559bc15b744ab1/pools?include=base_token,quote_token","address":"0x3504981b34862a39a7d7297ab2559bc15b744ab1","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:54.271Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"8e3308b4-a5c0-4142-9849-77814f279dcf","error":"Circuit breaker open for api.geckoterminal.com","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x745e91e6db835646f790799e46afb73c459f5af7/pools?include=base_token,quote_token","address":"0x745e91e6db835646f790799e46afb73c459f5af7","network":"base"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:36:54.384Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x11: API-5001:Skipping low liquidity token","timestamp":"2026-01-27T08:36:54.407Z","metadata":{"traceId":"ff5c6ac6-f3b3-4e15-ba12-19f7344cca94"}}
[api] {"timestamp":"2026-01-27T08:36:54.407Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"traceId":"ff5c6ac6-f3b3-4e15-ba12-19f7344cca94","symbol":"WETH","liquidity":460.3799},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1769503014748,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","res":{"statusCode":200},"responseTime":18232.47320899996,"msg":"request completed"}
[api] {"timestamp":"2026-01-27T08:36:54.866Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"ff5c6ac6-f3b3-4e15-ba12-19f7344cca94"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:55.119Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"ff5c6ac6-f3b3-4e15-ba12-19f7344cca94"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:55.424Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"d0c650e6-6f7c-4bc4-bdf2-d0887f359c5f"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:55.425Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"d0c650e6-6f7c-4bc4-bdf2-d0887f359c5f","url":"api.geckoterminal.com","failures":3},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:55.425Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"ff5c6ac6-f3b3-4e15-ba12-19f7344cca94"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:55.425Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"ff5c6ac6-f3b3-4e15-ba12-19f7344cca94","url":"api.geckoterminal.com","failures":4},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:55.425Z","level":"ERROR","code":"API-5002","message":"API error on trending page","metadata":{"traceId":"ff5c6ac6-f3b3-4e15-ba12-19f7344cca94","page":8,"error":"HTTP 429: Too Many Requests"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:55.425Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"traceId":"ff5c6ac6-f3b3-4e15-ba12-19f7344cca94","network":"optimism","count":32,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:55.425Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"traceId":"ff5c6ac6-f3b3-4e15-ba12-19f7344cca94","count":36,"chain":"optimism","durationMs":13943},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 36 trending tokens for Optimism
[api] Saved 36 trending tokens for optimism to database and memory cache
[api] [TokenJob] Saved 36 tokens for Optimism to DB + cache
[api] {"timestamp":"2026-01-27T08:36:55.681Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"d0c650e6-6f7c-4bc4-bdf2-d0887f359c5f"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:55.681Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"d0c650e6-6f7c-4bc4-bdf2-d0887f359c5f","url":"api.geckoterminal.com","failures":5},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:55.930Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"d0c650e6-6f7c-4bc4-bdf2-d0887f359c5f"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:55.931Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"d0c650e6-6f7c-4bc4-bdf2-d0887f359c5f","url":"api.geckoterminal.com","failures":6},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:55.931Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"d0c650e6-6f7c-4bc4-bdf2-d0887f359c5f","error":"HTTP 429: Too Many Requests","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x82466795fbdfbcfad6cfca2257540d7c47ba3dc5/pools?include=base_token,quote_token","address":"0x82466795fbdfbcfad6cfca2257540d7c47ba3dc5","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:56.249Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"d0c650e6-6f7c-4bc4-bdf2-d0887f359c5f","error":"Circuit breaker open for api.geckoterminal.com","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x3504981b34862a39a7d7297ab2559bc15b744ab1/pools?include=base_token,quote_token","address":"0x3504981b34862a39a7d7297ab2559bc15b744ab1","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:56.250Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"d0c650e6-6f7c-4bc4-bdf2-d0887f359c5f","error":"Circuit breaker open for api.geckoterminal.com","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x745e91e6db835646f790799e46afb73c459f5af7/pools?include=base_token,quote_token","address":"0x745e91e6db835646f790799e46afb73c459f5af7","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:56.973Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"d0c650e6-6f7c-4bc4-bdf2-d0887f359c5f","error":"Circuit breaker open for api.geckoterminal.com","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x4d1aa95f03042718cf489415b999bffb28b3d376/pools?include=base_token,quote_token","address":"0x4d1aa95f03042718cf489415b999bffb28b3d376","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:36:57.042Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"d0c650e6-6f7c-4bc4-bdf2-d0887f359c5f","error":"Circuit breaker open for api.geckoterminal.com","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x07d3eab4cb4e030722cfa848f6059cff839b7d61/pools?include=base_token,quote_token","address":"0x07d3eab4cb4e030722cfa848f6059cff839b7d61","network":"base"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1769503017064,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","res":{"statusCode":200},"responseTime":22465.548624999996,"msg":"request completed"}
[api] [TokenJob] Fetching trending tokens for Polygon via DexScreener Premium...
[api] {"timestamp":"2026-01-27T08:37:01.336Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"traceId":"ff5c6ac6-f3b3-4e15-ba12-19f7344cca94","chain":"polygon","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:37:01.336Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{"traceId":"ff5c6ac6-f3b3-4e15-ba12-19f7344cca94"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:37:04.391Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:37:06.891Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"traceId":"ff5c6ac6-f3b3-4e15-ba12-19f7344cca94","candidates":24,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:37:06.892Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"traceId":"ff5c6ac6-f3b3-4e15-ba12-19f7344cca94","network":"polygon","count":0,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:37:06.892Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"traceId":"ff5c6ac6-f3b3-4e15-ba12-19f7344cca94","count":22,"chain":"polygon","durationMs":5556},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 22 trending tokens for Polygon
[api] {"timestamp":"2026-01-27T08:37:06.892Z","level":"ERROR","code":"API-5002","message":"API error on trending page","metadata":{"traceId":"ff5c6ac6-f3b3-4e15-ba12-19f7344cca94","page":1,"error":"Circuit breaker open for api.geckoterminal.com"},"service":"kiko-api","env":"production"}
[api] Saved 22 trending tokens for polygon to database and memory cache
[api] [TokenJob] Saved 22 tokens for Polygon to DB + cache
[api] [TokenJob] Refreshed 7 chains in 126.7s
[api] [TokenJob] Tokens for Polygon are fresh, skipping API call
[api] [TokenJob] Refreshed 7 chains in 121.3s
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:37:14.397Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:37:24.405Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1769503045626,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50146},"msg":"incoming request"}
[api] {"level":30,"time":1769503045627,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","res":{"statusCode":204},"responseTime":0.7751250000437722,"msg":"request completed"}
[api] {"level":30,"time":1769503045632,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50146},"msg":"incoming request"}
[api] {"level":30,"time":1769503045639,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","req":{"method":"OPTIONS","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50559},"msg":"incoming request"}
[api] {"level":30,"time":1769503045639,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","res":{"statusCode":204},"responseTime":0.41129199997521937,"msg":"request completed"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=HI...
[api] {"level":30,"time":1769503045642,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","req":{"method":"POST","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50559},"msg":"incoming request"}
[api] {"level":30,"time":1769503045648,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","res":{"statusCode":200},"responseTime":6.301084000035189,"msg":"request completed"}
[api] {"level":30,"time":1769503045649,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","res":{"statusCode":200},"responseTime":17.618458000011742,"msg":"request completed"}
[api] {"level":30,"time":1769503045650,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkwcfcb100amkmok3wh72vc8","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50559},"msg":"incoming request"}
[api] {"level":30,"time":1769503045650,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","res":{"statusCode":204},"responseTime":0.2076660000020638,"msg":"request completed"}
[api] {"level":30,"time":1769503045651,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","req":{"method":"GET","url":"/api/chat/sessions/cmkwcfcb100amkmok3wh72vc8","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50146},"msg":"incoming request"}
[api] {"level":30,"time":1769503045661,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","res":{"statusCode":200},"responseTime":9.877458000089973,"msg":"request completed"}
[api] {"level":30,"time":1769503045664,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkwcfcb100amkmok3wh72vc8/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50559},"msg":"incoming request"}
[api] {"level":30,"time":1769503045665,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","res":{"statusCode":204},"responseTime":0.3318329999456182,"msg":"request completed"}
[api] {"level":30,"time":1769503045666,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","req":{"method":"POST","url":"/api/chat/sessions/cmkwcfcb100amkmok3wh72vc8/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50146},"msg":"incoming request"}
[api] {"level":30,"time":1769503045761,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","res":{"statusCode":200},"responseTime":95.0987080000341,"msg":"request completed"}
[api] {"timestamp":"2026-01-27T08:37:27.448Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:37:27.449Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:37:27.451Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[python] INFO:moderation.router:Moderating input: HI...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] DEBUG: Loading .env from /Users/almurat/KiKo/kiko-python/kiko-api/.env
[python] DEBUG: OPENAI_API_KEY present: True
[python] INFO:     127.0.0.1:50561 - "POST /moderation/input HTTP/1.1" 200 OK
[api] {"timestamp":"2026-01-27T08:37:29.982Z","level":"INFO","code":"SYS-1007","message":"Moderation Input check result","metadata":{"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:37:29.987Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Sent message_start for cmkwcfcdr00askmok0cfkoq4g
[api] {"timestamp":"2026-01-27T08:37:29.988Z","level":"INFO","code":"AI-6007","message":"ChatWorker: seeded get_wallet_info from client context","metadata":{"chainId":8453,"tokenCount":151,"hasNativeBalance":false},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Base filtered to 44 tools for message: "HI..."
[api] [ChatWorker] 🔍 RAG check for: "HI..."
[api] [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cmkwcfcdw00aukmokfnoi0ooi
[api] {"timestamp":"2026-01-27T08:37:29.990Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
[api] {"timestamp":"2026-01-27T08:37:29.993Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:37:33.805Z","level":"INFO","code":"AI-6001","message":"Timer finished: intent_parsing_d16e0751","metadata":{"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"general_query","highLevelIntent":"GENERAL_CHAT","hasAI":true,"confidence":0.3,"routingStage":"hybrid","conflict":"multi","slotsComplete":false,"labels":[{"label":"GENERAL_CHAT","confidence":0.3},{"label":"PREDICTION_MARKETS","confidence":0.23094010767585035},{"label":"TRADING","confidence":0}],"durationMs":3812,"timerLabel":"intent_parsing_d16e0751"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:37:33.810Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:37:33.810Z","level":"INFO","code":"AI-6009","message":"DeepSeek: routed to mode","metadata":{"taskId":"cmkwcfcdw00aukmokfnoi0ooi","sessionId":"cmkwcfcb100amkmok3wh72vc8","model":"deepseek-v3-fast","intent":"GENERAL_CHAT","routingMode":"thinking","confidence":0.3},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Skill-gated to 26 tools for intent=GENERAL_CHAT skills=polymarket_prediction, token_analysis, wallet_portfolio, welcome_onboarding
[api] {"timestamp":"2026-01-27T08:37:33.811Z","level":"INFO","code":"AI-6010","message":"DeepSeek: skills attached","metadata":{"taskId":"cmkwcfcdw00aukmokfnoi0ooi","sessionId":"cmkwcfcb100amkmok3wh72vc8","model":"deepseek-v3-fast","intent":"GENERAL_CHAT","routingMode":"thinking","skillVersion":"clean","skills":["polymarket_prediction","token_analysis","wallet_portfolio","welcome_onboarding"],"toolCount":26},"service":"kiko-api","env":"production"}
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: false,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
[api]     'userRole',
[api]     'defaultSwapAmount',
[api]     'defaultSwapUnit',
[api]     'checkTokenBeforeSwap',
[api]     'quickSwapMode',
[api]     'swapMethod',
[api]     'slippageMode',
[api]     'customSlippage',
[api]     'mevProtection',
[api]     'priceDeviationCheck',
[api]     'fastSwapMode',
[api]     'copyTradeTokenCooldownMinutes',
[api]     'minMarketCapUsd',
[api]     'minLiquidityUsd',
[api]     'minTargetValueUsd',
[api]     'id',
[api]     'userId',
[api]     'copyTradeAIMode',
[api]     'zoraNotificationThreshold',
[api]     'updatedAt',
[api]     'createdAt'
[api]   ],
[api]   walletConnected: true,
[api]   chainId: 8453
[api] }
[api] [ChatWorker] Waiting for early pre-fetch to complete
[api] {"timestamp":"2026-01-27T08:37:33.815Z","level":"INFO","code":"AI-6003","message":"Timer finished: prompt_gen_GENERAL_CHAT_deepseek","metadata":{"model":"deepseek","intent":"GENERAL_CHAT","length":10151,"durationMs":0,"timerLabel":"prompt_gen_GENERAL_CHAT_deepseek"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (151 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] {"timestamp":"2026-01-27T08:37:33.817Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] {"timestamp":"2026-01-27T08:37:33.819Z","level":"INFO","code":"AI-6007","message":"ChatWorker: client context injected","metadata":{"hasBalance":true,"hasNativeBalance":false,"hasPageContext":false,"hasToolConfig":true,"contextBytes":4003},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:37:33.819Z","level":"INFO","code":"AI-6007","message":"ChatWorker: client balance snapshot summary","metadata":{"tokenCount":151,"sample":[{"symbol":"2026","balance":"111"},{"symbol":"QRYPT","balance":"25"},{"symbol":"0x00256d36db44e37db453206c383d59f6bf23c82a","balance":"25"},{"symbol":"BTW","balance":"9"},{"symbol":"0x0077ae08200c05af9741b38366e26f7b1e7bfe2d","balance":"9"}],"spotlight":[{"symbol":"USDC","balance":"0"}]},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Added client context to system prompt
[api] {"timestamp":"2026-01-27T08:37:33.819Z","level":"INFO","code":"AI-6007","message":"ChatWorker: removed get_wallet_info tool (balance context present)","metadata":{"before":26,"after":25},"service":"kiko-api","env":"production"}
[api] [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
[api] [ChatWorker] Broadcasting Thinking status for cmkwcfcdr00askmok0cfkoq4g. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] {"timestamp":"2026-01-27T08:37:33.820Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:37:34.410Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:37:44.415Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:37:45.376Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"},"service":"kiko-api","env":"production"}
[python] INFO:moderation.router:Moderating output: Hi! I see you're connected with wallet **0xA386bc9...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:50575 - "POST /moderation/output HTTP/1.1" 200 OK
[api] {"timestamp":"2026-01-27T08:37:47.189Z","level":"INFO","code":"SYS-1007","message":"Moderation Output check result","metadata":{"safe":true,"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Broadcasting message_complete for cmkwcfcdr00askmok0cfkoq4g
[api] {"timestamp":"2026-01-27T08:37:47.201Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:37:47.203Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:37:47.203Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1769503067215,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkwcfcb100amkmok3wh72vc8","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50559},"msg":"incoming request"}
[api] {"level":30,"time":1769503067215,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","res":{"statusCode":204},"responseTime":0.4003329999977723,"msg":"request completed"}
[api] {"level":30,"time":1769503067218,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","req":{"method":"GET","url":"/api/chat/sessions/cmkwcfcb100amkmok3wh72vc8","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50146},"msg":"incoming request"}
[api] {"level":30,"time":1769503067227,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","res":{"statusCode":200},"responseTime":9.367790999938734,"msg":"request completed"}
[api] {"timestamp":"2026-01-27T08:37:52.119Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"CHÀO CẢ NHÀ","creator":"0x3633d7e24c27282740703b8e57c1e79a29907afb"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:37:52.479Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"BE LIKE PENGUINS@BASE.BASE.ETH","creator":"0xa62f0e030a427c277a411c3a62aa4190ccf522b6"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:37:52.838Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"HOPE","creator":"0xd0a1ce332b2448a33cf6e2b3d472838ac5254bc8"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:37:53.226Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"VoxNovus","creator":"0x3a850557bad0df79090642e31b07060c11fd61c6"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:37:53.591Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"BASE MERGE","creator":"0x6b14fc2acf7c06bf91ceb339e7d54ccab20b11e3"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:37:54.422Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:38:04.429Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:38:14.436Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:38:24.442Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:38:34.449Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1769503115068,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50627},"msg":"incoming request"}
[api] {"level":30,"time":1769503115068,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","res":{"statusCode":204},"responseTime":0.5418749999953434,"msg":"request completed"}
[api] {"level":30,"time":1769503115070,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkwcfcb100amkmok3wh72vc8/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50628},"msg":"incoming request"}
[api] {"level":30,"time":1769503115070,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","res":{"statusCode":204},"responseTime":0.17312500008847564,"msg":"request completed"}
[api] {"level":30,"time":1769503115070,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50627},"msg":"incoming request"}
[api] {"level":30,"time":1769503115072,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50629},"msg":"incoming request"}
[api] {"level":30,"time":1769503115072,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","res":{"statusCode":204},"responseTime":0.3642499999841675,"msg":"request completed"}
[api] {"level":30,"time":1769503115073,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","req":{"method":"POST","url":"/api/chat/sessions/cmkwcfcb100amkmok3wh72vc8/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50628},"msg":"incoming request"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=Buy 0.0005 ETH to 0x...
[api] {"level":30,"time":1769503115077,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50629},"msg":"incoming request"}
[api] {"level":30,"time":1769503115079,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","res":{"statusCode":200},"responseTime":8.788540999987163,"msg":"request completed"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1769503115104,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","res":{"statusCode":200},"responseTime":30.897915999987163,"msg":"request completed"}
[api] {"level":30,"time":1769503115121,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50627},"msg":"incoming request"}
[api] {"timestamp":"2026-01-27T08:38:36.519Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:36.520Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:36.523Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[python] INFO:moderation.router:Moderating input: Buy 0.0005 ETH to 0xd2686179d72ff875e35b6775e76124...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:50654 - "POST /moderation/input HTTP/1.1" 200 OK
[api] {"timestamp":"2026-01-27T08:38:38.693Z","level":"INFO","code":"SYS-1007","message":"Moderation Input check result","metadata":{"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:38.694Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Sent message_start for cmkwcgtw900b3kmokuk3x1hly
[api] {"timestamp":"2026-01-27T08:38:38.695Z","level":"INFO","code":"AI-6007","message":"ChatWorker: seeded get_wallet_info from client context","metadata":{"chainId":8453,"tokenCount":152,"hasNativeBalance":false},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:38.696Z","level":"INFO","code":"SYS-1007","message":"ToolPreRouter: Category matched","metadata":{"category":"\\b(swap|buy|sell|trade|exchange|convert|购买|卖出|兑换)\\b","tools":["get_token_info","external_web_search","prepare_swap_transaction","get_wallet_info","check_token_risk","create_copy_trade_config"]},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Base filtered to 6 tools for message: "Buy 0.0005 ETH to 0xd2686179d72ff875e35b6775e76124..."
[api] [ChatWorker] 🔍 RAG check for: "Buy 0.0005 ETH to 0xd2686179d72ff875e35b6775e76124..."
[api] [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cmkwcgtwa00b5kmokl1n95n2k
[api] {"timestamp":"2026-01-27T08:38:38.698Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
[api] {"timestamp":"2026-01-27T08:38:38.701Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:38.707Z","level":"INFO","code":"AI-6001","message":"Timer finished: intent_parsing_90099def","metadata":{"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.10327955589886445},{"label":"RISK_SCAN","confidence":0}],"durationMs":5,"timerLabel":"intent_parsing_90099def"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:38.713Z","level":"INFO","code":"AI-6001","message":"Intent follow-up recorded","metadata":{"previousIntent":"GENERAL_CHAT","nextIntent":"TRADING","sessionId":"cmkwcfcb100amkmok3wh72vc8"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:38.713Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:38.714Z","level":"INFO","code":"AI-6009","message":"DeepSeek: routed to mode","metadata":{"taskId":"cmkwcgtwa00b5kmokl1n95n2k","sessionId":"cmkwcfcb100amkmok3wh72vc8","model":"deepseek-v3-fast","intent":"TRADING","routingMode":"execution","hardRule":{"label":"TRADING","reason":"action + slots complete"},"confidence":0.95},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Skill-gated to 5 tools for intent=TRADING skills=swap, token_alert, wallet_portfolio
[api] {"timestamp":"2026-01-27T08:38:38.714Z","level":"INFO","code":"AI-6010","message":"DeepSeek: skills attached","metadata":{"taskId":"cmkwcgtwa00b5kmokl1n95n2k","sessionId":"cmkwcfcb100amkmok3wh72vc8","model":"deepseek-v3-fast","intent":"TRADING","routingMode":"execution","skillVersion":"exec","skills":["swap","token_alert","wallet_portfolio"],"toolCount":5},"service":"kiko-api","env":"production"}
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: false,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
[api]     'userRole',
[api]     'defaultSwapAmount',
[api]     'defaultSwapUnit',
[api]     'checkTokenBeforeSwap',
[api]     'quickSwapMode',
[api]     'swapMethod',
[api]     'slippageMode',
[api]     'customSlippage',
[api]     'mevProtection',
[api]     'priceDeviationCheck',
[api]     'fastSwapMode',
[api]     'copyTradeTokenCooldownMinutes',
[api]     'minMarketCapUsd',
[api]     'minLiquidityUsd',
[api]     'minTargetValueUsd',
[api]     'id',
[api]     'userId',
[api]     'copyTradeAIMode',
[api]     'zoraNotificationThreshold',
[api]     'updatedAt',
[api]     'createdAt'
[api]   ],
[api]   walletConnected: true,
[api]   chainId: 8453
[api] }
[api] [ChatWorker] 🚀 Fast Swap Decision: {
[api]   fastSwapModeEnabled: false,
[api]   isAllowanceTradeMode: true,
[api]   willFastSwap: true,
[api]   reason: 'swapMethod=allowance_trade'
[api] }
[api] {"timestamp":"2026-01-27T08:38:38.718Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] 🚀 Fast swap: Sent message_start for cmkwcgtw900b3kmokuk3x1hly
[api] [ChatWorker] Fast swap parameters: {
[api]   tokenIn: 'ETH',
[api]   tokenOut: '0xd2686179...',
[api]   amountIn: '0.0005',
[api]   chainId: 8453,
[api]   swapIntent: {
[api]     tokenIn: 'ETH',
[api]     tokenOut: '0xd2686179d72ff875e35b6775e761240bff749b07',
[api]     amount: '0.0005'
[api]   }
[api] }
[api] [ChatWorker] Chain detection: tokenIn=ETH..., actualChain=base
[api] {"timestamp":"2026-01-27T08:38:38.725Z","level":"INFO","code":"AI-6011","message":"Created transaction card for fast swap","metadata":{"messageId":"cmkwcgwoz00b8kmokb9w0e33z","taskId":"cmkwcgtwa00b5kmokl1n95n2k"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:38.727Z","level":"INFO","code":"EXE-4002","message":"[MainSwapService][1769503118726_ri4ala] Starting unified swap execution","metadata":{"mode":"fast-swap","tokenIn":"ETH","tokenOut":"0xd2686179d7","amount":"0.0005","chainId":8453,"tradeContextId":"ctx_1769503118726_gcbh4yvcu"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:42.149Z","level":"ERROR","code":"API-5002","message":"LaunchpadDetector: Clanker check failed","metadata":{"address":"0xd2686179d72ff875e35b6775e761240bff749b07","error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:42.734Z","level":"INFO","code":"AI-6005","message":"Timer finished: launchpad_det_0xd2686179d72ff875e35b6775e761240bff749b07","metadata":{"address":"0xd2686179d72ff875e35b6775e761240bff749b07","chainId":8453,"found":false,"durationMs":4007,"timerLabel":"launchpad_det_0xd2686179d72ff875e35b6775e761240bff749b07"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:42.734Z","level":"INFO","code":"AI-6005","message":"Timer finished: launchpad_det_ETH","metadata":{"address":"ETH","chainId":8453,"found":false,"durationMs":0,"timerLabel":"launchpad_det_ETH"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:42.734Z","level":"INFO","code":"EXE-4002","message":"[MainSwapService][1769503118726_ri4ala] Executing EVM swap via SwapExecutor","metadata":{"chainId":8453,"tokenIn":"ETH","tokenOut":"0xd2686179d7"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:42.734Z","level":"INFO","code":"EXE-4002","message":"Initiating Unified Swap Execution","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","chainId":8453,"tokenIn":"ETH","tokenOut":"0xd2686179d72ff875e35b6775e761240bff749b07","amount":"0.0005"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:38:44.454Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:45.541Z","level":"INFO","code":"SYS-1007","message":"Circuit breaker reset for endpoint","metadata":{"url":"api.geckoterminal.com"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:50.195Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9","error":"HTTP 404: Not Found","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x82466795fbdfbcfad6cfca2257540d7c47ba3dc5/pools?include=base_token,quote_token","address":"0x82466795fbdfbcfad6cfca2257540d7c47ba3dc5","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:52.985Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:52.991Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.024Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.025Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9","url":"api.geckoterminal.com","failures":3},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.033Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.033Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9","url":"api.geckoterminal.com","failures":4},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.253Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.253Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9","url":"api.geckoterminal.com","failures":5},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.257Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.257Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9","url":"api.geckoterminal.com","failures":6},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.275Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.275Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9","url":"api.geckoterminal.com","failures":7},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.291Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.291Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9","url":"api.geckoterminal.com","failures":8},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.552Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.552Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9","url":"api.geckoterminal.com","failures":9},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.552Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9","error":"HTTP 429: Too Many Requests","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x279e8f331033e26476f22a93e009b7111a75601c/pools?include=base_token,quote_token","address":"0x279e8f331033e26476f22a93e009b7111a75601c","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.577Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.577Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9","url":"api.geckoterminal.com","failures":10},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.577Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9","error":"HTTP 429: Too Many Requests","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x2a23eabf2cf678745e73a36a8545e5025504f9b2/pools?include=base_token,quote_token","address":"0x2a23eabf2cf678745e73a36a8545e5025504f9b2","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.578Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.578Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9","url":"api.geckoterminal.com","failures":11},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.578Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9","error":"HTTP 429: Too Many Requests","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x0f689993a73351104ae69465a77759555e48bf2c/pools?include=base_token,quote_token","address":"0x0f689993a73351104ae69465a77759555e48bf2c","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.585Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.586Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9","url":"api.geckoterminal.com","failures":12},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:53.586Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"93ade06a-929e-4d58-8e4d-10a44f98b4b9","error":"HTTP 429: Too Many Requests","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x35ce2d60f6d569afb0666a54bc4c7f9d0a333036/pools?include=base_token,quote_token","address":"0x35ce2d60f6d569afb0666a54bc4c7f9d0a333036","network":"base"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1769503133586,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","res":{"statusCode":200},"responseTime":18464.899250000017,"msg":"request completed"}
[api] {"level":30,"time":1769503133586,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","res":{"statusCode":200},"responseTime":18509.494582999963,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:38:54.461Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:56.411Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"rustloop","creator":"0x26cbab1dd6de928b663e26db31884f1cf80c7a8c"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:56.810Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"secondary_world","creator":"0x9d070d061d96ceffabf3e9aa546bc48c3099d888"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:57.062Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"error":"Circuit breaker open for api.geckoterminal.com","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x50c75903a5fe9acc87cce2706c43625e59076b57/pools?include=base_token,quote_token","address":"0x50c75903a5fe9acc87cce2706c43625e59076b57","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:57.207Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"🌟 Get ready for the ultimate adventure! 🌟 Dive into a world of endless possibilities and join the fun with us today! 🎉✨ This is the moment you've been waiting for, and we can't wait to share it with you. 🙌🔥 🚀 Tap into the excitement and feel the energy that's taking over! 🤩📈 Let's make memories that will last a","creator":"0x959d3d73315c323643f4d0722d91b77f250a3c7d"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:57.485Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"error":"Circuit breaker open for api.geckoterminal.com","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x82466795fbdfbcfad6cfca2257540d7c47ba3dc5/pools?include=base_token,quote_token","address":"0x82466795fbdfbcfad6cfca2257540d7c47ba3dc5","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:58.466Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"error":"Circuit breaker open for api.geckoterminal.com","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x279e8f331033e26476f22a93e009b7111a75601c/pools?include=base_token,quote_token","address":"0x279e8f331033e26476f22a93e009b7111a75601c","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:38:58.475Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"error":"Circuit breaker open for api.geckoterminal.com","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x0f689993a73351104ae69465a77759555e48bf2c/pools?include=base_token,quote_token","address":"0x0f689993a73351104ae69465a77759555e48bf2c","network":"base"},"service":"kiko-api","env":"production"}
[api] [PlatformFee] Fees DISABLED, returning 0 bps
[api] {"timestamp":"2026-01-27T08:39:00.565Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching token metadata","metadata":{"error":"HTTP 404: Not Found"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:00.565Z","level":"INFO","code":"API-5001","message":"No token metadata available, trying RPC fallback...","metadata":{"tokenAddress":"0xd2686179d72ff875e35b6775e761240bff749b07","chainId":8453},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:00.569Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching token metadata","metadata":{"error":"HTTP 404: Not Found"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:00.569Z","level":"INFO","code":"API-5001","message":"Using 0x API fallback token metadata","metadata":{"symbol":"ETH","chainId":8453},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:00.879Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"zeroex-token-metadata","failures":3},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:00.879Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching token metadata","metadata":{"error":"HTTP 404: Not Found"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:00.879Z","level":"INFO","code":"API-5001","message":"Using 0x API fallback token metadata","metadata":{"symbol":"USDC","chainId":8453},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:01.346Z","level":"INFO","code":"API-5001","message":"0x API price received successfully","metadata":{"sellToken":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","buyToken":"0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913","chainId":8453,"liquidityAvailable":true},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:01.612Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching token metadata","metadata":{"error":"Circuit breaker open for zeroex-token-metadata"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:01.613Z","level":"INFO","code":"API-5001","message":"Using 0x API fallback token metadata","metadata":{"symbol":"USDC","chainId":8453},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:02.073Z","level":"INFO","code":"API-5001","message":"0x API price received successfully","metadata":{"sellToken":"0xd2686179d72ff875e35b6775e761240bff749b07","buyToken":"0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913","chainId":8453,"liquidityAvailable":true},"service":"kiko-api","env":"production"}
[api] [Kyber] GET routes {
[api]   routesUrl: 'https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&tokenOut=0xd2686179d72ff875e35b6775e761240bff749b07&amountIn=500000000000000&saveGas=true&gasInclude=true&clientId=kiko-app'
[api] }
[api] {"timestamp":"2026-01-27T08:39:02.680Z","level":"INFO","code":"API-5001","message":"0x API Quote received successfully","metadata":{"sellToken":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","buyToken":"0xd2686179d72ff875e35b6775e761240bff749b07","buyAmount":"1071449358843371886034943","usedEndpoint":"allowance-holder"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:02.681Z","level":"INFO","code":"API-5001","message":"0x API Quote successful","metadata":{"sellToken":"0xEeeeeEeeeE","buyToken":"0xd2686179d7","buyAmount":"1071449358843371886034943","hasAllowanceIssue":false,"usedEndpoint":"allowance-holder"},"service":"kiko-api","env":"production"}
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 0.0005,
[api]   amountOut: 1071449.358843372,
[api]   quotePrice: 2142898717.686744,
[api]   refPrice: 2917157690,
[api]   tokenInUsd: 'available',
[api]   impact: -26.54155361458215,
[api]   formula: '((2142898717.686744 - 2917157690) / 2917157690) * 100 = -26.54155361458215'
[api] }
[api] [QuoteService] Price impact > 10%, refPrice likely unreliable. Returning null. {
[api]   impact: -26.54155361458215,
[api]   refPrice: 2917157690,
[api]   quotePrice: 2142898717.686744
[api] }
[api] [QuoteService] 0x API estimatedPriceImpact: {
[api]   raw: undefined,
[api]   parsed: 0,
[api]   multipliedBy100: 0,
[api]   impactVsMkt: null,
[api]   willUse: 0
[api] }
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:39:04.467Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [Kyber] routes response {
[api]   status: 200,
[api]   hasData: true,
[api]   keys: [ 'code', 'message', 'data', 'requestId' ]
[api] }
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 0.0005,
[api]   amountOut: 1074032.263856932,
[api]   quotePrice: 2148064527.713864,
[api]   refPrice: 2917157690,
[api]   tokenInUsd: 'available',
[api]   impact: -26.364469940126416,
[api]   formula: '((2148064527.713864 - 2917157690) / 2917157690) * 100 = -26.364469940126416'
[api] }
[api] [QuoteService] Quote comparison: {
[api]   '0x_amount': '1071449.358843371886034943',
[api]   kyber_amount: '1074032.263856932148740096',
[api]   kyber_advantage_pct: '0.00',
[api]   chainId: 8453
[api] }
[api] [QuoteService] Preferring 0x for reliability { reason: 'prices within 2%', percentDiff: '0.00' }
[api] [QuoteService] Price impact > 10%, refPrice likely unreliable. Returning null. {
[api]   impact: -26.364469940126416,
[api]   refPrice: 2917157690,
[api]   quotePrice: 2148064527.713864
[api] }
[api] {"timestamp":"2026-01-27T08:39:08.962Z","level":"INFO","code":"EXE-4002","message":"Checking approval for swap","metadata":{"token":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","spender":"0x0000000000001ff3684f28c67538d4d072c22734","amount":"500000000000000","isNative":true},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:08.962Z","level":"INFO","code":"EXE-4002","message":"Approval not needed or already set","metadata":{"token":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","spender":"0x0000000000001ff3684f28c67538d4d072c22734"},"service":"kiko-api","env":"production"}
[api] [SwapExecutor] Executing 0x Aggregator swap on chain 8453
[api] [SwapExecutor] ========== TRANSACTION EXECUTION ==========
[api] [SwapExecutor] DEX: 0x Aggregator
[api] [SwapExecutor] Transaction params: {
[api]   to: '0x0000000000001ff3684f28c67538d4d072c22734',
[api]   dataLength: 3850,
[api]   dataPrefix: '0x2213bc0b00000000000000000000000049fb9c16b9b2a19452633573603c8376',
[api]   value: '500000000000000',
[api]   router: '0x0000000000001ff3684f28c67538d4d072c22734',
[api]   allowanceTarget: '0x0000000000001ff3684f28c67538d4d072c22734'
[api] }
[api] [SwapExecutor] Swap details: {
[api]   tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
[api]   tokenOut: '0xd2686179d72ff875e35b6775e761240bff749b07',
[api]   amountInBase: '500000000000000',
[api]   amountInHuman: '0.0005',
[api]   amountOut: '1071449.358843371886034943',
[api]   slippageBps: 300,
[api]   priceImpact: 0,
[api]   gasEstimate: 766657
[api] }
[api] [SwapExecutor] =============================================
[api] [SwapExecutor] Execution params prepared: {
[api]   dex: '0x Aggregator',
[api]   gasEstimate: 766657,
[api]   gasLimit: '1149985',
[api]   maxFeePerGas: '6659282',
[api]   maxPriorityFeePerGas: '1000000'
[api] }
[api] {"timestamp":"2026-01-27T08:39:10.629Z","level":"INFO","code":"SYS-1007","message":"PrivyWallet Authorization Key config","metadata":{"keyFormat":"wallet-auth","keyLength":196,"keyIdConfigured":true,"keyId":"crdgro3bw0..."},"service":"kiko-api","env":"production"}
[api] [sendTransaction] ========== PRIVY TX PARAMS ==========
[api] [sendTransaction] From: 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [sendTransaction] To: 0x0000000000001ff3684f28c67538d4d072c22734
[api] [sendTransaction] Value: 500000000000000
[api] [sendTransaction] ValueHex: 0x1c6bf52634000
[api] [sendTransaction] Data length: 3850
[api] [sendTransaction] Data (full): 0x2213bc0b00000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e0400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001c6bf5263400000000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e0400000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000006a41fff991f000000000000000000000000a386bc9d8f26ab170a847d73226e3e0bceb0fe8e000000000000000000000000d2686179d72ff875e35b6775e761240bff749b0700000000000000000000000000000000000000000000dc14e27181775c679e8c00000000000000000000000000000000000000000000000000000000000000a0b4629305f8f276940939d7950000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000220000000000000000000000000000000000000000000000000000000000000036000000000000000000000000000000000000000000000000000000000000005200000000000000000000000000000000000000000000000000000000000000044bd01c2260000000000000000000000000000000000000000000000000000000069787ad20000000000000000000000000000000000000000000000000001c6bf526340000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee000000000000000000000000000000000000000000000000000000000000000f000000000000000000000000ad01c20d5886137e056775af56915de824c8fce5000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000000000000000000000000000000000000000027100000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000024d0e30db0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000184af72634f00000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e040000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000ffffffffffffffc5000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000048271000000000000000000000000000000001000276a401d2686179d72ff875e35b6775e761240bff749b078000000000c8b429d62f8f3bffb98cdb9569533ea23bf0ba28cc00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008434ee90ca000000000000000000000000f5c4f3dc02c3fb9279495a8fef7b0741da956157000000000000000000000000d2686179d72ff875e35b6775e761240bff749b0700000000000000000000000000000000000000000000e2f3e638f8eabdb33fff00000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
[api] [sendTransaction] ChainId: 8453
[api] [sendTransaction] Gas: 1149985
[api] [sendTransaction] MaxFeePerGas: 6659282
[api] [sendTransaction] MaxPriorityFeePerGas: 1000000
[api] [sendTransaction] Full TX object: {
[api]   to: '0x0000000000001ff3684f28c67538d4d072c22734',
[api]   data: '0x2213bc0b00000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e0400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001c6bf5263400000000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e0400000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000006a41fff991f000000000000000000000000a386bc9d8f26ab170a847d73226e3e0bceb0fe8e000000000000000000000000d2686179d72ff875e35b6775e761240bff749b0700000000000000000000000000000000000000000000dc14e27181775c679e8c00000000000000000000000000000000000000000000000000000000000000a0b4629305f8f276940939d7950000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000220000000000000000000000000000000000000000000000000000000000000036000000000000000000000000000000000000000000000000000000000000005200000000000000000000000000000000000000000000000000000000000000044bd01c2260000000000000000000000000000000000000000000000000000000069787ad20000000000000000000000000000000000000000000000000001c6bf526340000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee000000000000000000000000000000000000000000000000000000000000000f000000000000000000000000ad01c20d5886137e056775af56915de824c8fce5000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000000000000000000000000000000000000000027100000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000024d0e30db0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000184af72634f00000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e040000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000ffffffffffffffc5000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000048271000000000000000000000000000000001000276a401d2686179d72ff875e35b6775e761240bff749b078000000000c8b429d62f8f3bffb98cdb9569533ea23bf0ba28cc00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008434ee90ca000000000000000000000000f5c4f3dc02c3fb9279495a8fef7b0741da956157000000000000000000000000d2686179d72ff875e35b6775e761240bff749b0700000000000000000000000000000000000000000000e2f3e638f8eabdb33fff00000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
[api]   value: '500000000000000',
[api]   chainId: 8453,
[api]   gas: '1149985',
[api]   maxFeePerGas: '6659282',
[api]   maxPriorityFeePerGas: '1000000'
[api] }
[api] [sendTransaction] ===========================================
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:39:14.471Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:14.691Z","level":"INFO","code":"EXE-4002","message":"Ethereum transaction sent via Privy","metadata":{"txHash":"0xa97b723df27ec3f88b7353458e6675bea46f6755ebd6d41fb5c5f6b3bd99fb30","chainId":8453},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:15.692Z","level":"INFO","code":"EXE-4002","message":"Swap Broadcast","metadata":{"txHash":"0xa97b723df27ec3f88b7353458e6675bea46f6755ebd6d41fb5c5f6b3bd99fb30","method":"0x Aggregator"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:15.693Z","level":"INFO","code":"SYS-1007","message":"[Monitor] Started tracking 0xa97b723df27ec3f88b7353458e6675bea46f6755ebd6d41fb5c5f6b3bd99fb30 on 8453 (0x Aggregator)","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:17.036Z","level":"INFO","code":"AI-6004","message":"Timer finished: find_token_any_0xd2686179d72ff875e35b6775e761240bff749b07","metadata":{"address":"0xd2686179d72ff875e35b6775e761240bff749b07","symbol":"MOLTY","chain":"Base","durationMs":1333,"timerLabel":"find_token_any_0xd2686179d72ff875e35b6775e761240bff749b07"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] ✅ Created transaction card message: cmkwchq9m00bakmokz1b07t6a
[api] {"timestamp":"2026-01-27T08:39:17.052Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_client_action","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"client_action","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_client_action"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:17.052Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:17.057Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:17.057Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1769503157073,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkwcfcb100amkmok3wh72vc8","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50627},"msg":"incoming request"}
[api] {"level":30,"time":1769503157075,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","res":{"statusCode":204},"responseTime":1.0146250000689179,"msg":"request completed"}
[api] {"level":30,"time":1769503157076,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","req":{"method":"GET","url":"/api/chat/sessions/cmkwcfcb100amkmok3wh72vc8","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50629},"msg":"incoming request"}
[api] {"level":30,"time":1769503157088,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","res":{"statusCode":200},"responseTime":11.926458999980241,"msg":"request completed"}
[api] {"timestamp":"2026-01-27T08:39:20.322Z","level":"INFO","code":"EXE-4003","message":"[Monitor] Transaction confirmed: 0xa97b723df27ec3f88b7353458e6675bea46f6755ebd6d41fb5c5f6b3bd99fb30","metadata":{"gasUsed":"0x97def"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:39:24.479Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:39:34.485Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1769503180339,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50627},"msg":"incoming request"}
[api] {"level":30,"time":1769503180340,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","res":{"statusCode":204},"responseTime":0.8480829999316484,"msg":"request completed"}
[api] {"level":30,"time":1769503180341,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkwcfcb100amkmok3wh72vc8/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50629},"msg":"incoming request"}
[api] {"level":30,"time":1769503180341,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","res":{"statusCode":204},"responseTime":0.693792000063695,"msg":"request completed"}
[api] {"level":30,"time":1769503180344,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","req":{"method":"POST","url":"/api/chat/sessions/cmkwcfcb100amkmok3wh72vc8/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50629},"msg":"incoming request"}
[api] {"level":30,"time":1769503180348,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-u","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50627},"msg":"incoming request"}
[api] {"level":30,"time":1769503180350,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-v","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51228},"msg":"incoming request"}
[api] {"level":30,"time":1769503180351,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-v","res":{"statusCode":204},"responseTime":0.4497079999418929,"msg":"request completed"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=Sell all 0xd2686179d...
[api] {"level":30,"time":1769503180354,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51228},"msg":"incoming request"}
[api] {"level":30,"time":1769503180355,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-u","res":{"statusCode":200},"responseTime":7.155457999906503,"msg":"request completed"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1769503180375,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","res":{"statusCode":200},"responseTime":31.20299999997951,"msg":"request completed"}
[api] {"level":30,"time":1769503180385,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-x","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50627},"msg":"incoming request"}
[api] {"timestamp":"2026-01-27T08:39:42.587Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:42.587Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:42.590Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[python] INFO:moderation.router:Moderating input: Sell all 0xd2686179d72ff875e35b6775e761240bff749b0...
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:39:44.489Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:51254 - "POST /moderation/input HTTP/1.1" 200 OK
[api] {"timestamp":"2026-01-27T08:39:45.274Z","level":"INFO","code":"SYS-1007","message":"Moderation Input check result","metadata":{"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:45.275Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Sent message_start for cmkwci89d00bhkmokogl624ix
[api] {"timestamp":"2026-01-27T08:39:45.277Z","level":"INFO","code":"AI-6007","message":"ChatWorker: seeded get_wallet_info from client context","metadata":{"chainId":8453,"tokenCount":155,"hasNativeBalance":false},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:45.277Z","level":"INFO","code":"SYS-1007","message":"ToolPreRouter: Category matched","metadata":{"category":"\\b(swap|buy|sell|trade|exchange|convert|购买|卖出|兑换)\\b","tools":["get_token_info","external_web_search","prepare_swap_transaction","get_wallet_info","check_token_risk","create_copy_trade_config"]},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Base filtered to 6 tools for message: "Sell all 0xd2686179d72ff875e35b6775e761240bff749b0..."
[api] [ChatWorker] 🔍 RAG check for: "Sell all 0xd2686179d72ff875e35b6775e761240bff749b0..."
[api] [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cmkwci89f00bjkmokvunvj6l5
[api] {"timestamp":"2026-01-27T08:39:45.279Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
[api] {"timestamp":"2026-01-27T08:39:45.282Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:45.291Z","level":"INFO","code":"AI-6001","message":"Timer finished: intent_parsing_4b75f49a","metadata":{"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"GENERAL_CHAT","confidence":0.2},{"label":"MARKET_ANALYSIS","confidence":0.1}],"durationMs":9,"timerLabel":"intent_parsing_4b75f49a"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:45.297Z","level":"INFO","code":"AI-6001","message":"Intent follow-up recorded","metadata":{"previousIntent":"TRADING","nextIntent":"TRADING","sessionId":"cmkwcfcb100amkmok3wh72vc8"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:45.297Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:45.297Z","level":"INFO","code":"AI-6009","message":"DeepSeek: routed to mode","metadata":{"taskId":"cmkwci89f00bjkmokvunvj6l5","sessionId":"cmkwcfcb100amkmok3wh72vc8","model":"deepseek-v3-fast","intent":"TRADING","routingMode":"execution","hardRule":{"label":"TRADING","reason":"action + slots complete"},"confidence":0.95},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Skill-gated to 5 tools for intent=TRADING skills=swap, token_alert, wallet_portfolio
[api] {"timestamp":"2026-01-27T08:39:45.297Z","level":"INFO","code":"AI-6010","message":"DeepSeek: skills attached","metadata":{"taskId":"cmkwci89f00bjkmokvunvj6l5","sessionId":"cmkwcfcb100amkmok3wh72vc8","model":"deepseek-v3-fast","intent":"TRADING","routingMode":"execution","skillVersion":"exec","skills":["swap","token_alert","wallet_portfolio"],"toolCount":5},"service":"kiko-api","env":"production"}
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: false,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
[api]     'userRole',
[api]     'defaultSwapAmount',
[api]     'defaultSwapUnit',
[api]     'checkTokenBeforeSwap',
[api]     'quickSwapMode',
[api]     'swapMethod',
[api]     'slippageMode',
[api]     'customSlippage',
[api]     'mevProtection',
[api]     'priceDeviationCheck',
[api]     'fastSwapMode',
[api]     'copyTradeTokenCooldownMinutes',
[api]     'minMarketCapUsd',
[api]     'minLiquidityUsd',
[api]     'minTargetValueUsd',
[api]     'id',
[api]     'userId',
[api]     'copyTradeAIMode',
[api]     'zoraNotificationThreshold',
[api]     'updatedAt',
[api]     'createdAt'
[api]   ],
[api]   walletConnected: true,
[api]   chainId: 8453
[api] }
[api] [ChatWorker] 🚀 Fast Swap Decision: {
[api]   fastSwapModeEnabled: false,
[api]   isAllowanceTradeMode: true,
[api]   willFastSwap: true,
[api]   reason: 'swapMethod=allowance_trade'
[api] }
[api] {"timestamp":"2026-01-27T08:39:45.299Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] 🚀 Fast swap: Sent message_start for cmkwci89d00bhkmokogl624ix
[api] [ChatWorker] Fast swap parameters: {
[api]   tokenIn: '0xd2686179...',
[api]   tokenOut: 'ETH',
[api]   amountIn: 'all',
[api]   chainId: 8453,
[api]   swapIntent: {
[api]     tokenIn: '0xd2686179d72ff875e35b6775e761240bff749b07',
[api]     tokenOut: 'ETH',
[api]     amount: 'all'
[api]   }
[api] }
[api] [ChatWorker] Chain detection: tokenIn=0xd2686179..., actualChain=base
[api] [ChatWorker] 🧮 Calculating all amount for 0xd2686179d72ff875e35b6775e761240bff749b07
[api] [ChatWorker] 🔷 Using EVM wallet for balance check: 0xA386bc9D...
[api] {"timestamp":"2026-01-27T08:39:51.732Z","level":"INFO","code":"SYS-1007","message":"Circuit breaker reset for endpoint","metadata":{"traceId":"40417b0e-4047-4d7a-86c1-116d017cca76","url":"api.geckoterminal.com"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:54.342Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"40417b0e-4047-4d7a-86c1-116d017cca76","error":"HTTP 404: Not Found","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x82466795fbdfbcfad6cfca2257540d7c47ba3dc5/pools?include=base_token,quote_token","address":"0x82466795fbdfbcfad6cfca2257540d7c47ba3dc5","network":"base"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"level":30,"time":1769503194495,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","req":{"method":"OPTIONS","url":"/api/users/settings","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50629},"msg":"incoming request"}
[api] {"level":30,"time":1769503194495,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","res":{"statusCode":204},"responseTime":0.4357499999459833,"msg":"request completed"}
[api] {"timestamp":"2026-01-27T08:39:54.498Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1769503194499,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-z","req":{"method":"GET","url":"/api/users/settings","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50629},"msg":"incoming request"}
[api] {"level":30,"time":1769503194513,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-z","res":{"statusCode":200},"responseTime":14.122040999936871,"msg":"request completed"}
[api] {"level":30,"time":1769503195322,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-10","req":{"method":"OPTIONS","url":"/api/users/settings","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50629},"msg":"incoming request"}
[api] {"level":30,"time":1769503195323,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-10","res":{"statusCode":204},"responseTime":0.5649589999811724,"msg":"request completed"}
[api] {"level":30,"time":1769503195327,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-11","req":{"method":"PUT","url":"/api/users/settings","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50629},"msg":"incoming request"}
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
[api]   "minTargetValueUsd": null,
[api]   "id": "cmktxdpx900he63ac0pvlkplq",
[api]   "userId": "cmktfmib9008gs7ophbza8jh3",
[api]   "quickSwapMode": false,
[api]   "copyTradeAIMode": "disabled",
[api]   "zoraNotificationThreshold": 5000,
[api]   "updatedAt": "2026-01-26T04:04:54.476Z",
[api]   "createdAt": "2026-01-25T16:00:43.389Z"
[api] }
[api] {"level":30,"time":1769503195335,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-11","res":{"statusCode":200},"responseTime":8.209917000029236,"msg":"request completed"}
[api] {"level":30,"time":1769503196607,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-12","req":{"method":"PUT","url":"/api/users/settings","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50629},"msg":"incoming request"}
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
[api]   "minTargetValueUsd": null,
[api]   "id": "cmktxdpx900he63ac0pvlkplq",
[api]   "userId": "cmktfmib9008gs7ophbza8jh3",
[api]   "quickSwapMode": false,
[api]   "copyTradeAIMode": "disabled",
[api]   "zoraNotificationThreshold": 5000,
[api]   "updatedAt": "2026-01-26T04:04:54.476Z",
[api]   "createdAt": "2026-01-25T16:00:43.389Z"
[api] }
[api] {"level":30,"time":1769503196616,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-12","res":{"statusCode":200},"responseTime":9.378832999966107,"msg":"request completed"}
[api] [ChatWorker] SELL all: using exact balance 0
[api] [ChatWorker] Resolved amount: 0 0xd2686179d72ff875e35b6775e761240bff749b07 (Balance: 0)
[api] [ChatWorker] Could not resolve valid amount, using LLM fallback
[api] [ChatWorker] Waiting for early pre-fetch to complete
[api] [ChatWorker] Detected contract address: 0xd2686179d72ff875e35b6775e761240bff749b07
[api] [ChatWorker] ⚡ [CACHE HIT]: get_token_info for 0xd2686179d72ff875e35b6775e761240bff749b07
[api] [ChatWorker] ⚡ Fixed and updated cached tokenInfo with address
[api] {"timestamp":"2026-01-27T08:39:58.314Z","level":"INFO","code":"AI-6006","message":"PromptOrchestrator: Intent matched skills","metadata":{"intent":"TRADING","count":3,"skills":["swap","token_alert","wallet_portfolio"]},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:58.315Z","level":"INFO","code":"AI-6003","message":"Timer finished: prompt_gen_TRADING_deepseek","metadata":{"model":"deepseek","intent":"TRADING","length":11440,"durationMs":1,"timerLabel":"prompt_gen_TRADING_deepseek"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (155 tokens cached)
[api] {"timestamp":"2026-01-27T08:39:58.317Z","level":"INFO","code":"AI-6007","message":"ChatWorker: requested token balance resolved","metadata":{"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":8453,"requested":["0xd2686179d72ff875e35b6775e761240bff749b07","ETH"],"matched":["0xd2686179d72ff875e35b6775e761240bff749b07","ETH"],"missing":[],"resolvedBalances":{"0xd2686179d72ff875e35b6775e761240bff749b07":"0","ETH":"0.0018"}},"service":"kiko-api","env":"production"}
[api] [ChatWorker] 🔍 Token not in portfolio, querying direct balance... {
[api]   symbol: undefined,
[api]   address: '0xd2686179d72ff875e35b6775e761240bff749b07',
[api]   chainId: 8453,
[api]   chainName: undefined
[api] }
[api] [ChatWorker] Querying balance on chain: base
[api] {"level":30,"time":1769503198321,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-x","res":{"statusCode":200},"responseTime":17935.54112499999,"msg":"request completed"}
[api] {"level":30,"time":1769503198321,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","res":{"statusCode":200},"responseTime":17967.454374999972,"msg":"request completed"}
[api] {"timestamp":"2026-01-27T08:39:59.144Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"GNOVA","creator":"0xde604d3896e7ac37c347131e618de5cdc04aa94a"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:59.519Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"Beach","creator":"0x11348d5270b627e3c72c141de6d5552237eda070"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:39:59.886Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"RedLipStory","creator":"0x1c3d5261b9c3f8f120fc266f4b9f9314eb60feb1"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:00.291Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"MOVEMENT","creator":"0x4fef97bbf8bb21bd2a640ceb660ac1a7f58df8fa"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:00.646Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"PinUpStyle","creator":"0x6065b3ca4ab6cfc123cac21dbc748125304a4739"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Direct balance result: {
[api]   raw: '1071753973221365747236863',
[api]   decimals: 18,
[api]   formatted: '1071753.973221365747236863'
[api] }
[api] [ChatWorker] Parsed balance: 1071753.9732213658
[api] [ChatWorker] ✅ Added direct balance for undefined: 1071753.973221365747236863
[api] {"timestamp":"2026-01-27T08:40:00.825Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] {"timestamp":"2026-01-27T08:40:00.827Z","level":"INFO","code":"AI-6007","message":"ChatWorker: client context injected","metadata":{"hasBalance":true,"hasNativeBalance":false,"hasPageContext":false,"hasToolConfig":true,"contextBytes":4003},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:00.827Z","level":"INFO","code":"AI-6007","message":"ChatWorker: client balance snapshot summary","metadata":{"tokenCount":155,"sample":[{"symbol":"2026","balance":"111"},{"symbol":"ETH","balance":"0.0018"},{"symbol":"QRYPT","balance":"25"},{"symbol":"0x00256d36db44e37db453206c383d59f6bf23c82a","balance":"25"},{"symbol":"BTW","balance":"9"}],"spotlight":[{"symbol":"ETH","balance":"0.0018"},{"symbol":"USDC","balance":"0"}]},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Added client context to system prompt
[api] {"timestamp":"2026-01-27T08:40:00.827Z","level":"INFO","code":"AI-6007","message":"ChatWorker: balance context attached to system prompt","metadata":{"bytes":204},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:00.827Z","level":"INFO","code":"AI-6007","message":"ChatWorker: balance system rule injected","metadata":{},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Applied system injection: ⚠️ BALANCE AUTO-RESOLUTION ISSUE:
[api] Token: 0xd2686179d72ff875e35b6775e761240bff749b07
[api] Chain: base
[api] Status: Not found in cached portfolio snapshot
[api] 
[api] NEXT STEPS:
[api] 1. Check if token balance appears in [USER_BALANCE_CONTEXT] or [REQUESTED_TOKEN_BALANCE] sections
[api] 2. If balance shows as "not present" but user owns it, the swap can still proceed (they'll confirm amount)
[api] 3. If balance is truly 0, inform user they don't hold this token
[api] 4. DO NOT hallucinate or guess the balance - use only data from context blocks above
[api] {"timestamp":"2026-01-27T08:40:00.827Z","level":"INFO","code":"AI-6007","message":"ChatWorker: removed get_wallet_info tool (balance context present)","metadata":{"before":5,"after":4},"service":"kiko-api","env":"production"}
[api] [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
[api] [ChatWorker] Broadcasting Thinking status for cmkwci89d00bhkmokogl624ix. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] {"timestamp":"2026-01-27T08:40:00.827Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
[api] {"timestamp":"2026-01-27T08:40:00.844Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"ethereum","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:00.844Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] [Job] ✅ Loaded 436 real hot users from /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Job] ✅ Using 436 real hot users from analysis
[api] [SocialJob] fetchCastsFromUsers starting with 436 FIDs, target: 500
[api] {"timestamp":"2026-01-27T08:40:00.848Z","level":"INFO","code":"SYS-1007","message":"Circuit breaker reset for endpoint","metadata":{"url":"hub.merv.fun"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:03.104Z","level":"WARN","code":"API-5002","message":"No trending tokens discovered for chain","metadata":{"chain":"ethereum"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:40:04.506Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:04.637Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":27,"limit":100},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 27 trending tokens for Ethereum
[api] [TokenJob] New list too small (27) for Ethereum; keeping existing (100)
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] {"timestamp":"2026-01-27T08:40:08.947Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:08.969Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [GetTokenInfo] Attempting DexScreener fallback...
[api] [ChatWorker] DeepSeek iteration 2/10 for task cmkwci89f00bjkmokvunvj6l5
[api] {"timestamp":"2026-01-27T08:40:11.349Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
[api] {"timestamp":"2026-01-27T08:40:11.352Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:11.360Z","level":"INFO","code":"AI-6001","message":"Timer finished: intent_parsing_403ad296","metadata":{"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"GENERAL_CHAT","confidence":0.2},{"label":"MARKET_ANALYSIS","confidence":0.1}],"durationMs":7,"timerLabel":"intent_parsing_403ad296"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:11.361Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: false,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
[api]     'userRole',
[api]     'defaultSwapAmount',
[api]     'defaultSwapUnit',
[api]     'checkTokenBeforeSwap',
[api]     'quickSwapMode',
[api]     'swapMethod',
[api]     'slippageMode',
[api]     'customSlippage',
[api]     'mevProtection',
[api]     'priceDeviationCheck',
[api]     'fastSwapMode',
[api]     'copyTradeTokenCooldownMinutes',
[api]     'minMarketCapUsd',
[api]     'minLiquidityUsd',
[api]     'minTargetValueUsd',
[api]     'id',
[api]     'userId',
[api]     'copyTradeAIMode',
[api]     'zoraNotificationThreshold',
[api]     'updatedAt',
[api]     'createdAt'
[api]   ],
[api]   walletConnected: true,
[api]   chainId: 8453
[api] }
[api] [ChatWorker] 🚀 Fast Swap Decision: {
[api]   fastSwapModeEnabled: false,
[api]   isAllowanceTradeMode: true,
[api]   willFastSwap: true,
[api]   reason: 'swapMethod=allowance_trade'
[api] }
[api] [ChatWorker] Detected contract address: 0xd2686179d72ff875e35b6775e761240bff749b07
[api] [ChatWorker] ⚡ [CACHE HIT]: get_token_info for 0xd2686179d72ff875e35b6775e761240bff749b07
[api] {"timestamp":"2026-01-27T08:40:11.362Z","level":"INFO","code":"AI-6006","message":"PromptOrchestrator: Intent matched skills","metadata":{"intent":"TRADING","count":3,"skills":["swap","token_alert","wallet_portfolio"]},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:11.362Z","level":"INFO","code":"AI-6003","message":"Timer finished: prompt_gen_TRADING_deepseek","metadata":{"model":"deepseek","intent":"TRADING","length":11440,"durationMs":0,"timerLabel":"prompt_gen_TRADING_deepseek"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (155 tokens cached)
[api] {"timestamp":"2026-01-27T08:40:11.363Z","level":"INFO","code":"AI-6007","message":"ChatWorker: requested token balance resolved","metadata":{"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":8453,"requested":["0xd2686179d72ff875e35b6775e761240bff749b07","ETH"],"matched":["0xd2686179d72ff875e35b6775e761240bff749b07","ETH"],"missing":[],"resolvedBalances":{"0xd2686179d72ff875e35b6775e761240bff749b07":"0","ETH":"0.0018"}},"service":"kiko-api","env":"production"}
[api] [ChatWorker] 🔍 Token not in portfolio, querying direct balance... {
[api]   symbol: undefined,
[api]   address: '0xd2686179d72ff875e35b6775e761240bff749b07',
[api]   chainId: 8453,
[api]   chainName: undefined
[api] }
[api] [ChatWorker] Querying balance on chain: base
[api] [ChatWorker] Direct balance result: {
[api]   raw: '1071753973221365747236863',
[api]   decimals: 18,
[api]   formatted: '1071753.973221365747236863'
[api] }
[api] [ChatWorker] Parsed balance: 1071753.9732213658
[api] [ChatWorker] ✅ Added direct balance for undefined: 1071753.973221365747236863
[api] {"timestamp":"2026-01-27T08:40:14.132Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] {"timestamp":"2026-01-27T08:40:14.133Z","level":"INFO","code":"AI-6007","message":"ChatWorker: client context injected","metadata":{"hasBalance":true,"hasNativeBalance":false,"hasPageContext":false,"hasToolConfig":true,"contextBytes":4003},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:14.133Z","level":"INFO","code":"AI-6007","message":"ChatWorker: client balance snapshot summary","metadata":{"tokenCount":155,"sample":[{"symbol":"2026","balance":"111"},{"symbol":"ETH","balance":"0.0018"},{"symbol":"QRYPT","balance":"25"},{"symbol":"0x00256d36db44e37db453206c383d59f6bf23c82a","balance":"25"},{"symbol":"BTW","balance":"9"}],"spotlight":[{"symbol":"ETH","balance":"0.0018"},{"symbol":"USDC","balance":"0"}]},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Added client context to system prompt
[api] {"timestamp":"2026-01-27T08:40:14.134Z","level":"INFO","code":"AI-6007","message":"ChatWorker: balance context attached to system prompt","metadata":{"bytes":204},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:14.134Z","level":"INFO","code":"AI-6007","message":"ChatWorker: balance system rule injected","metadata":{},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Applied system injection: ⚠️ BALANCE AUTO-RESOLUTION ISSUE:
[api] Token: 0xd2686179d72ff875e35b6775e761240bff749b07
[api] Chain: base
[api] Status: Not found in cached portfolio snapshot
[api] 
[api] NEXT STEPS:
[api] 1. Check if token balance appears in [USER_BALANCE_CONTEXT] or [REQUESTED_TOKEN_BALANCE] sections
[api] 2. If balance shows as "not present" but user owns it, the swap can still proceed (they'll confirm amount)
[api] 3. If balance is truly 0, inform user they don't hold this token
[api] 4. DO NOT hallucinate or guess the balance - use only data from context blocks above
[api] [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
[api] [ChatWorker] Broadcasting Thinking status for cmkwci89d00bhkmokogl624ix. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] {"timestamp":"2026-01-27T08:40:14.134Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:40:14.515Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
[api] {"timestamp":"2026-01-27T08:40:19.653Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"solana","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:19.653Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:19.800Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:19.875Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [CheckTokenRisk] Scanning 0xd2686179d72ff875e35b6775e761240bff749b07 on base (chainId: 8453)
[api] [CheckTokenRisk] Fetching from GoPlus: https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=0xd2686179d72ff875e35b6775e761240bff749b07
[api] [CheckTokenRisk] Attempting local scan/verification for 0xd2686179d72ff875e35b6775e761240bff749b07 on base
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:40:24.521Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [ChatWorker] DeepSeek iteration 3/10 for task cmkwci89f00bjkmokvunvj6l5
[api] {"timestamp":"2026-01-27T08:40:27.708Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
[api] {"timestamp":"2026-01-27T08:40:27.713Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:27.716Z","level":"INFO","code":"AI-6001","message":"Timer finished: intent_parsing_8a7e395a","metadata":{"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"GENERAL_CHAT","confidence":0.2},{"label":"MARKET_ANALYSIS","confidence":0.1}],"durationMs":3,"timerLabel":"intent_parsing_8a7e395a"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:27.716Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: false,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
[api]     'userRole',
[api]     'defaultSwapAmount',
[api]     'defaultSwapUnit',
[api]     'checkTokenBeforeSwap',
[api]     'quickSwapMode',
[api]     'swapMethod',
[api]     'slippageMode',
[api]     'customSlippage',
[api]     'mevProtection',
[api]     'priceDeviationCheck',
[api]     'fastSwapMode',
[api]     'copyTradeTokenCooldownMinutes',
[api]     'minMarketCapUsd',
[api]     'minLiquidityUsd',
[api]     'minTargetValueUsd',
[api]     'id',
[api]     'userId',
[api]     'copyTradeAIMode',
[api]     'zoraNotificationThreshold',
[api]     'updatedAt',
[api]     'createdAt'
[api]   ],
[api]   walletConnected: true,
[api]   chainId: 8453
[api] }
[api] [ChatWorker] 🚀 Fast Swap Decision: {
[api]   fastSwapModeEnabled: false,
[api]   isAllowanceTradeMode: true,
[api]   willFastSwap: true,
[api]   reason: 'swapMethod=allowance_trade'
[api] }
[api] [ChatWorker] Detected contract address: 0xd2686179d72ff875e35b6775e761240bff749b07
[api] [ChatWorker] ⚡ [CACHE HIT]: get_token_info for 0xd2686179d72ff875e35b6775e761240bff749b07
[api] {"timestamp":"2026-01-27T08:40:27.717Z","level":"INFO","code":"AI-6006","message":"PromptOrchestrator: Intent matched skills","metadata":{"intent":"TRADING","count":3,"skills":["swap","token_alert","wallet_portfolio"]},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:27.717Z","level":"INFO","code":"AI-6003","message":"Timer finished: prompt_gen_TRADING_deepseek","metadata":{"model":"deepseek","intent":"TRADING","length":11440,"durationMs":0,"timerLabel":"prompt_gen_TRADING_deepseek"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (155 tokens cached)
[api] {"timestamp":"2026-01-27T08:40:27.717Z","level":"INFO","code":"AI-6007","message":"ChatWorker: requested token balance resolved","metadata":{"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":8453,"requested":["0xd2686179d72ff875e35b6775e761240bff749b07","ETH"],"matched":["0xd2686179d72ff875e35b6775e761240bff749b07","ETH"],"missing":[],"resolvedBalances":{"0xd2686179d72ff875e35b6775e761240bff749b07":"0","ETH":"0.0018"}},"service":"kiko-api","env":"production"}
[api] [ChatWorker] 🔍 Token not in portfolio, querying direct balance... {
[api]   symbol: undefined,
[api]   address: '0xd2686179d72ff875e35b6775e761240bff749b07',
[api]   chainId: 8453,
[api]   chainName: undefined
[api] }
[api] [ChatWorker] Querying balance on chain: base
[api] {"timestamp":"2026-01-27T08:40:27.817Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":132,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:27.817Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"solana","durationMs":8164},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for Solana
[api] [TokenJob] Filtered out 5 invalid tokens for Solana
[api] Saved 95 trending tokens for solana to database and memory cache
[api] [TokenJob] Saved 95 tokens for Solana to DB + cache
[api] [ChatWorker] Direct balance result: {
[api]   raw: '1071753973221365747236863',
[api]   decimals: 18,
[api]   formatted: '1071753.973221365747236863'
[api] }
[api] [ChatWorker] Parsed balance: 1071753.9732213658
[api] [ChatWorker] ✅ Added direct balance for undefined: 1071753.973221365747236863
[api] {"timestamp":"2026-01-27T08:40:30.392Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] {"timestamp":"2026-01-27T08:40:30.393Z","level":"INFO","code":"AI-6007","message":"ChatWorker: client context injected","metadata":{"hasBalance":true,"hasNativeBalance":false,"hasPageContext":false,"hasToolConfig":true,"contextBytes":4003},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:30.393Z","level":"INFO","code":"AI-6007","message":"ChatWorker: client balance snapshot summary","metadata":{"tokenCount":155,"sample":[{"symbol":"2026","balance":"111"},{"symbol":"ETH","balance":"0.0018"},{"symbol":"QRYPT","balance":"25"},{"symbol":"0x00256d36db44e37db453206c383d59f6bf23c82a","balance":"25"},{"symbol":"BTW","balance":"9"}],"spotlight":[{"symbol":"ETH","balance":"0.0018"},{"symbol":"USDC","balance":"0"}]},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Added client context to system prompt
[api] {"timestamp":"2026-01-27T08:40:30.393Z","level":"INFO","code":"AI-6007","message":"ChatWorker: balance context attached to system prompt","metadata":{"bytes":204},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:30.393Z","level":"INFO","code":"AI-6007","message":"ChatWorker: balance system rule injected","metadata":{},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Applied system injection: ⚠️ BALANCE AUTO-RESOLUTION ISSUE:
[api] Token: 0xd2686179d72ff875e35b6775e761240bff749b07
[api] Chain: base
[api] Status: Not found in cached portfolio snapshot
[api] 
[api] NEXT STEPS:
[api] 1. Check if token balance appears in [USER_BALANCE_CONTEXT] or [REQUESTED_TOKEN_BALANCE] sections
[api] 2. If balance shows as "not present" but user owns it, the swap can still proceed (they'll confirm amount)
[api] 3. If balance is truly 0, inform user they don't hold this token
[api] 4. DO NOT hallucinate or guess the balance - use only data from context blocks above
[api] [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
[api] [ChatWorker] Broadcasting Thinking status for cmkwci89d00bhkmokogl624ix. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] {"timestamp":"2026-01-27T08:40:30.394Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:40:34.528Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] {"timestamp":"2026-01-27T08:40:40.005Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:40.010Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [PrepareSwapTransaction] Preparing swap: {
[api]   token_in: '0xd2686179d72ff875e35b6775e761240bff749b07',
[api]   token_out: 'ETH',
[api]   amount_in: '1071753.973221365747236863',
[api]   chain_id: 8453,
[api]   token_symbol_in: 'MOLTY',
[api]   token_symbol_out: 'ETH',
[api]   execute: true
[api] }
[api] [PrepareSwapTransaction] ⚡ PRE-WARMING: Quote fetch started (performance optimization, non-critical)
[api] [PrepareSwapTransaction] Execution Decision: {
[api]   argsExecute: true,
[api]   swapMethod: 'allowance_trade',
[api]   fastSwapMode: false,
[api]   finalDecision: true
[api] }
[api] [PrepareSwapTransaction] Executing backend swap via internal API...
[api] {"level":30,"time":1769503240016,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-13","req":{"method":"POST","url":"/api/swap/quote","hostname":"127.0.0.1:3001","remoteAddress":"127.0.0.1","remotePort":52281},"msg":"incoming request"}
[api] [Swap Quote] Fetching metadata for: {
[api]   tokenInForMetadata: '0xd2686179d7',
[api]   tokenOutForMetadata: '0x4200000000',
[api]   actualTokenIn: '0xd2686179d7',
[api]   actualTokenOut: '0xEeeeeEeeeE',
[api]   isTokenOutNative: true
[api] }
[api] {"timestamp":"2026-01-27T08:40:40.019Z","level":"INFO","code":"SYS-1007","message":"Circuit breaker reset for endpoint","metadata":{"traceId":"a5c1c87b-2cec-40dc-a815-340a78ef1c2c","url":"zeroex-token-metadata"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:41.724Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching token metadata","metadata":{"traceId":"a5c1c87b-2cec-40dc-a815-340a78ef1c2c","error":"HTTP 404: Not Found"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:41.724Z","level":"INFO","code":"API-5001","message":"Using 0x API fallback token metadata","metadata":{"traceId":"a5c1c87b-2cec-40dc-a815-340a78ef1c2c","symbol":"WETH","chainId":8453},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:41.729Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching token metadata","metadata":{"traceId":"a5c1c87b-2cec-40dc-a815-340a78ef1c2c","error":"HTTP 404: Not Found"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:41.729Z","level":"INFO","code":"API-5001","message":"No token metadata available, trying RPC fallback...","metadata":{"traceId":"a5c1c87b-2cec-40dc-a815-340a78ef1c2c","tokenAddress":"0xd2686179d72ff875e35b6775e761240bff749b07","chainId":8453},"service":"kiko-api","env":"production"}
[api] [Swap Quote] Token decimals: {
[api]   tokenIn: '0xd2686179',
[api]   tokenOut: '0xEeeeeEee',
[api]   tokenInDecimals: 18,
[api]   tokenOutDecimals: 18,
[api]   tokenOutMetadataDecimals: 18
[api] }
[api] [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
[api] {"timestamp":"2026-01-27T08:40:42.859Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"base","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:43.131Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"a5c1c87b-2cec-40dc-a815-340a78ef1c2c","url":"zeroex-token-metadata","failures":3},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:43.132Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching token metadata","metadata":{"traceId":"a5c1c87b-2cec-40dc-a815-340a78ef1c2c","error":"HTTP 404: Not Found"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:43.132Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching token metadata","metadata":{"traceId":"a5c1c87b-2cec-40dc-a815-340a78ef1c2c","error":"Circuit breaker open for zeroex-token-metadata"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:43.132Z","level":"INFO","code":"API-5001","message":"Using 0x API fallback token metadata","metadata":{"traceId":"a5c1c87b-2cec-40dc-a815-340a78ef1c2c","symbol":"ETH","chainId":8453},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:43.132Z","level":"INFO","code":"API-5001","message":"Using 0x API fallback token metadata","metadata":{"traceId":"a5c1c87b-2cec-40dc-a815-340a78ef1c2c","symbol":"USDC","chainId":8453},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:43.137Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"a5c1c87b-2cec-40dc-a815-340a78ef1c2c","url":"zeroex-token-metadata","failures":4},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:43.137Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching token metadata","metadata":{"traceId":"a5c1c87b-2cec-40dc-a815-340a78ef1c2c","error":"HTTP 404: Not Found"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:43.137Z","level":"INFO","code":"API-5001","message":"No token metadata available, trying RPC fallback...","metadata":{"traceId":"a5c1c87b-2cec-40dc-a815-340a78ef1c2c","tokenAddress":"0xd2686179d72ff875e35b6775e761240bff749b07","chainId":8453},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:43.459Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching token metadata","metadata":{"traceId":"a5c1c87b-2cec-40dc-a815-340a78ef1c2c","error":"Circuit breaker open for zeroex-token-metadata"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:43.459Z","level":"INFO","code":"API-5001","message":"Using 0x API fallback token metadata","metadata":{"traceId":"a5c1c87b-2cec-40dc-a815-340a78ef1c2c","symbol":"USDC","chainId":8453},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:43.916Z","level":"INFO","code":"API-5001","message":"0x API price received successfully","metadata":{"traceId":"a5c1c87b-2cec-40dc-a815-340a78ef1c2c","sellToken":"0xd2686179d72ff875e35b6775e761240bff749b07","buyToken":"0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913","chainId":8453,"liquidityAvailable":true},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:44.407Z","level":"INFO","code":"WTC-2002","message":"Found addresses via WebSocket","metadata":{"count":170,"chain":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:44.510Z","level":"INFO","code":"API-5001","message":"0x API price received successfully","metadata":{"traceId":"a5c1c87b-2cec-40dc-a815-340a78ef1c2c","sellToken":"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE","buyToken":"0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913","chainId":8453,"liquidityAvailable":true},"service":"kiko-api","env":"production"}
[api] [PlatformFee] Fees DISABLED, returning 0 bps
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:40:44.537Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:44.839Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching quote","metadata":{"traceId":"a5c1c87b-2cec-40dc-a815-340a78ef1c2c","error":"response is not defined"},"service":"kiko-api","env":"production"}
[api] [QuoteService] 0x failed ReferenceError: response is not defined
[api]     at getZeroExQuote (/Users/almurat/KiKo/kiko-api/src/services/zeroEx.ts:582:17)
[api]     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
[api]     at async fetchZeroEx (/Users/almurat/KiKo/kiko-api/src/services/quoteService.ts:135:23)
[api]     at async Promise.all (index 0)
[api]     at async getBestQuoteInternal (/Users/almurat/KiKo/kiko-api/src/services/quoteService.ts:236:5)
[api]     at async getBestQuote (/Users/almurat/KiKo/kiko-api/src/services/quoteService.ts:74:20)
[api]     at async Object.<anonymous> (/Users/almurat/KiKo/kiko-api/src/routes/swap.ts:349:38)
[api] [Error Handler] {
[api]   "requestId": "req-13",
[api]   "method": "POST",
[api]   "url": "/api/swap/quote",
[api]   "ip": "127.0.0.1",
[api]   "error": {
[api]     "message": "No quotes available for 0xd2686179d72ff875e35b6775e761240bff749b07 -> ETH on chain 8453",
[api]     "name": "Error",
[api]     "code": "QUOTE_ERROR",
[api]     "statusCode": 400
[api]   }
[api] }
[api] {"level":30,"time":1769503244854,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-13","res":{"statusCode":400},"responseTime":4837.464875000063,"msg":"request completed"}
[api] [PrepareSwapTransaction] Pre-warm failed (expected for new/illiquid tokens, will retry): HTTP 400: Bad Request
[api] [PrepareSwapTransaction] Created transaction message: cmkwcjm0t00egkmokb6zmc5ew
[api] {"level":30,"time":1769503244866,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-14","req":{"method":"POST","url":"/api/swap/execute-instant","hostname":"127.0.0.1:3001","remoteAddress":"127.0.0.1","remotePort":52281},"msg":"incoming request"}
[api] {"level":30,"time":1769503244893,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-15","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52335},"msg":"incoming request"}
[api] {"level":30,"time":1769503244893,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-15","res":{"statusCode":204},"responseTime":0.4808750000083819,"msg":"request completed"}
[api] {"level":30,"time":1769503244895,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-16","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52335},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] [verifyAccess] ✅ Access granted
[api] [Swap Execute Instant] Starting swap: {
[api]   userId: 'did:privy:',
[api]   wallet: '0xA386bc9D',
[api]   tokenIn: '0xd2686179',
[api]   tokenOut: 'ETH',
[api]   amountIn: '1071753.973221365747236863',
[api]   chainId: 8453
[api] }
[api] {"timestamp":"2026-01-27T08:40:46.072Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching token metadata","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","error":"Circuit breaker open for zeroex-token-metadata"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:46.072Z","level":"INFO","code":"API-5001","message":"No token metadata available, trying RPC fallback...","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","tokenAddress":"0xd2686179d72ff875e35b6775e761240bff749b07","chainId":8453},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:46.073Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching token metadata","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","error":"Circuit breaker open for zeroex-token-metadata"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:46.073Z","level":"INFO","code":"API-5001","message":"Using 0x API fallback token metadata","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","symbol":"WETH","chainId":8453},"service":"kiko-api","env":"production"}
[api] [Swap Execute Instant] On-chain balance verification: {
[api]   token: '0xd2686179',
[api]   onChainBalance: '1071753973221365747236863',
[api]   requestedAmount: '1071753973221365747236863',
[api]   decimals: 18
[api] }
[api] {"timestamp":"2026-01-27T08:40:46.768Z","level":"INFO","code":"API-5001","message":"No token metadata available, trying RPC fallback...","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","tokenAddress":"0xd2686179d72ff875e35b6775e761240bff749b07","chainId":8453},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:46.767Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching token metadata","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","error":"Circuit breaker open for zeroex-token-metadata"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:46.768Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching token metadata","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","error":"Circuit breaker open for zeroex-token-metadata"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:46.768Z","level":"INFO","code":"API-5001","message":"Using 0x API fallback token metadata","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","symbol":"ETH","chainId":8453},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:46.768Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching token metadata","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","error":"Circuit breaker open for zeroex-token-metadata"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:46.768Z","level":"INFO","code":"API-5001","message":"Using 0x API fallback token metadata","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","symbol":"USDC","chainId":8453},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:47.174Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching token metadata","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","error":"Circuit breaker open for zeroex-token-metadata"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:47.174Z","level":"INFO","code":"API-5001","message":"Using 0x API fallback token metadata","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","symbol":"USDC","chainId":8453},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:47.245Z","level":"INFO","code":"API-5001","message":"0x API price received successfully","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","sellToken":"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE","buyToken":"0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913","chainId":8453,"liquidityAvailable":true},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:48.450Z","level":"INFO","code":"API-5001","message":"0x API price received successfully","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","sellToken":"0xd2686179d72ff875e35b6775e761240bff749b07","buyToken":"0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913","chainId":8453,"liquidityAvailable":true},"service":"kiko-api","env":"production"}
[api] [Swap Execute Instant] Judge engine skipped - only runs for copy trade
[api] {"timestamp":"2026-01-27T08:40:48.456Z","level":"INFO","code":"EXE-4002","message":"[MainSwapService][1769503248455_1g5ya] Starting unified swap execution","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","mode":"swap-card","tokenIn":"0xd2686179d7","tokenOut":"0xEeeeeEeeeE","amount":"1071753.973221365747236863","chainId":8453,"tradeContextId":"ctx_1769503248455_ufgfb878z"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:51.586Z","level":"ERROR","code":"API-5002","message":"LaunchpadDetector: Clanker check failed","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","address":"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE","error":"This operation was aborted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:51.586Z","level":"INFO","code":"AI-6005","message":"Timer finished: launchpad_det_0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","address":"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE","chainId":8453,"found":false,"durationMs":3130,"timerLabel":"launchpad_det_0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:51.586Z","level":"INFO","code":"EXE-4002","message":"[MainSwapService][1769503248455_1g5ya] Executing EVM swap via SwapExecutor","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","chainId":8453,"tokenIn":"0xd2686179d7","tokenOut":"0xEeeeeEeeeE"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:51.587Z","level":"INFO","code":"EXE-4002","message":"Initiating Unified Swap Execution","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","chainId":8453,"tokenIn":"0xd2686179d72ff875e35b6775e761240bff749b07","tokenOut":"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE","amount":"1071753.973221365747236863"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:52.613Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":36,"limit":200},"service":"kiko-api","env":"production"}
[api] [SocialJob] Checking Zora coin status for 476 casts...
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x5: API-5001:Skipping low liquidity token","timestamp":"2026-01-27T08:40:54.173Z","metadata":{}}
[api] {"timestamp":"2026-01-27T08:40:54.173Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"AI 2026","liquidity":59.893},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:40:54.543Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [PlatformFee] Fees DISABLED, returning 0 bps
[api] {"timestamp":"2026-01-27T08:40:57.769Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching token metadata","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","error":"Circuit breaker open for zeroex-token-metadata"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:57.769Z","level":"INFO","code":"API-5001","message":"No token metadata available, trying RPC fallback...","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","tokenAddress":"0xd2686179d72ff875e35b6775e761240bff749b07","chainId":8453},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:57.770Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching token metadata","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","error":"Circuit breaker open for zeroex-token-metadata"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:57.770Z","level":"INFO","code":"API-5001","message":"Using 0x API fallback token metadata","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","symbol":"ETH","chainId":8453},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:57.772Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching token metadata","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","error":"Circuit breaker open for zeroex-token-metadata"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:57.772Z","level":"INFO","code":"API-5001","message":"Using 0x API fallback token metadata","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","symbol":"USDC","chainId":8453},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:57.977Z","level":"WARN","code":"API-5002","message":"RPC endpoint failed","metadata":{"traceId":"dd6a0832-0bc5-4faf-aa39-082902edee9b","chain":"Base","endpoint":1,"total":4,"error":"fetch failed","duration":5053},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:58.866Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching token metadata","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","error":"Circuit breaker open for zeroex-token-metadata"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:58.867Z","level":"INFO","code":"API-5001","message":"Using 0x API fallback token metadata","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","symbol":"USDC","chainId":8453},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:59.090Z","level":"INFO","code":"API-5001","message":"0x API price received successfully","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","sellToken":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","buyToken":"0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913","chainId":8453,"liquidityAvailable":true},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:40:59.110Z","level":"INFO","code":"API-5001","message":"RPC failover success","metadata":{"traceId":"dd6a0832-0bc5-4faf-aa39-082902edee9b","chain":"Base","endpoint":2,"total":4,"responseTime":1033},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:00.155Z","level":"INFO","code":"API-5001","message":"0x API price received successfully","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","sellToken":"0xd2686179d72ff875e35b6775e761240bff749b07","buyToken":"0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913","chainId":8453,"liquidityAvailable":true},"service":"kiko-api","env":"production"}
[api] [Kyber] GET routes {
[api]   routesUrl: 'https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=0xd2686179d72ff875e35b6775e761240bff749b07&tokenOut=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&amountIn=1071753973221365747236863&saveGas=true&gasInclude=true&clientId=kiko-app'
[api] }
[api] {"timestamp":"2026-01-27T08:41:00.761Z","level":"INFO","code":"API-5001","message":"0x API Quote received successfully","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","sellToken":"0xd2686179d72ff875e35b6775e761240bff749b07","buyToken":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","buyAmount":"495003087378840","usedEndpoint":"allowance-holder"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:00.761Z","level":"INFO","code":"API-5001","message":"0x API Quote successful","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","sellToken":"0xd2686179d7","buyToken":"0xEeeeeEeeeE","buyAmount":"495003087378840","hasAllowanceIssue":true,"usedEndpoint":"allowance-holder"},"service":"kiko-api","env":"production"}
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 1071753.9732213658,
[api]   amountOut: 0.00049500308737884,
[api]   quotePrice: 4.618626100270117e-10,
[api]   refPrice: 3.43080092965442e-10,
[api]   tokenInUsd: 'available',
[api]   impact: 34.622386870326075,
[api]   formula: '((4.618626100270117e-10 - 3.43080092965442e-10) / 3.43080092965442e-10) * 100 = 34.622386870326075'
[api] }
[api] [QuoteService] 0x API estimatedPriceImpact: {
[api]   raw: undefined,
[api]   parsed: 0,
[api]   multipliedBy100: 0,
[api]   impactVsMkt: null,
[api]   willUse: 0
[api] }
[api] [QuoteService] Price impact > 10%, refPrice likely unreliable. Returning null. {
[api]   impact: 34.622386870326075,
[api]   refPrice: 3.43080092965442e-10,
[api]   quotePrice: 4.618626100270117e-10
[api] }
[api] {"timestamp":"2026-01-27T08:41:01.760Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"MacroMind","creator":"0x3dddf15c98ce3a446801baf2331dc552ae2b36ca"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:02.090Z","level":"INFO","code":"API-5001","message":"Pre-warming quote cache","metadata":{"count":2},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:02.135Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"JitterJet","creator":"0x1cdf7b7d804f13b0695bee362be1a55a571dae88"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:02.404Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching quote","metadata":{"error":"response is not defined"},"service":"kiko-api","env":"production"}
[api] [QuoteService] 0x failed ReferenceError: response is not defined
[api]     at getZeroExQuote (/Users/almurat/KiKo/kiko-api/src/services/zeroEx.ts:582:17)
[api]     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
[api]     at async fetchZeroEx (/Users/almurat/KiKo/kiko-api/src/services/quoteService.ts:135:23)
[api]     at async Promise.all (index 0)
[api]     at async getBestQuoteInternal (/Users/almurat/KiKo/kiko-api/src/services/quoteService.ts:236:5)
[api]     at async getBestQuote (/Users/almurat/KiKo/kiko-api/src/services/quoteService.ts:74:20)
[api]     at async <anonymous> (/Users/almurat/KiKo/kiko-api/src/services/QuoteCache.ts:94:38)
[api]     at async Promise.allSettled (index 0)
[api]     at async QuoteCacheClass.preWarm (/Users/almurat/KiKo/kiko-api/src/services/QuoteCache.ts:91:25)
[api] {"timestamp":"2026-01-27T08:41:02.408Z","level":"ERROR","code":"API-5002","message":"0x API Error fetching quote","metadata":{"error":"response is not defined"},"service":"kiko-api","env":"production"}
[api] [QuoteService] 0x failed ReferenceError: response is not defined
[api]     at getZeroExQuote (/Users/almurat/KiKo/kiko-api/src/services/zeroEx.ts:582:17)
[api]     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
[api]     at async fetchZeroEx (/Users/almurat/KiKo/kiko-api/src/services/quoteService.ts:135:23)
[api]     at async Promise.all (index 0)
[api]     at async getBestQuoteInternal (/Users/almurat/KiKo/kiko-api/src/services/quoteService.ts:236:5)
[api]     at async getBestQuote (/Users/almurat/KiKo/kiko-api/src/services/quoteService.ts:74:20)
[api]     at async <anonymous> (/Users/almurat/KiKo/kiko-api/src/services/QuoteCache.ts:94:38)
[api]     at async Promise.allSettled (index 1)
[api]     at async QuoteCacheClass.preWarm (/Users/almurat/KiKo/kiko-api/src/services/QuoteCache.ts:91:25)
[api] {"timestamp":"2026-01-27T08:41:02.409Z","level":"INFO","code":"API-5001","message":"Quote cache pre-warmed","metadata":{"total":2,"succeeded":2,"failed":0},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:02.527Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"DimensionX","creator":"0x5694adb5e9fb99beb52cc2b1b49b41c0a7ce8a3f"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:02.923Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"light_sculpt","creator":"0x870cdbcf0e55482c3aa45580c1b3cb4b66d3d4d8"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:03.285Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"UptownVamp","creator":"0x4092e2ee327c2bb6d1eddf29d0e0d52b4a182a22"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:03.661Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"Strokesmith","creator":"0xcea4ffe0c332d5840f0f3f23e3c306f559e62d13"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:03.664Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"base","count":101,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:03.665Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"base","durationMs":20806},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for Base
[api] Saved 100 trending tokens for base to database and memory cache
[api] [TokenJob] Saved 100 tokens for Base to DB + cache
[api] {"timestamp":"2026-01-27T08:41:04.298Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"MANAGEMENT","creator":"0xda181433f2fa74ea5f7aa25963401a7c083b362f"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:41:04.550Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:04.672Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"CHINA IS NOW ONLY 4,012 BITCOINS","creator":"0xc87031d05c8ceb9ba4da01906e9129bfcd28199e"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:04.700Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"dd6a0832-0bc5-4faf-aa39-082902edee9b","error":"HTTP 404: Not Found","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x82466795fbdfbcfad6cfca2257540d7c47ba3dc5/pools?include=base_token,quote_token","address":"0x82466795fbdfbcfad6cfca2257540d7c47ba3dc5","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:05.075Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"JayDogg","creator":"0xfa53915b43f2ab83350d5f9e0fd32e85b46cf00e"},"service":"kiko-api","env":"production"}
[api] [Kyber] routes response {
[api]   status: 200,
[api]   hasData: true,
[api]   keys: [ 'code', 'message', 'data', 'requestId' ]
[api] }
[api] {"timestamp":"2026-01-27T08:41:05.352Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"dd6a0832-0bc5-4faf-aa39-082902edee9b"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:05.352Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"dd6a0832-0bc5-4faf-aa39-082902edee9b","url":"api.geckoterminal.com","failures":3},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:05.442Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"unposed_truth","creator":"0xbee590a3b9381ec86e2bcffdc43a7f1ed95c749b"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:05.608Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"dd6a0832-0bc5-4faf-aa39-082902edee9b"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:05.799Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"REAL","creator":"0x716044bdfcdffd916445cc3a9eecc3f528027502"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:05.858Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"dd6a0832-0bc5-4faf-aa39-082902edee9b"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:05.858Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"dd6a0832-0bc5-4faf-aa39-082902edee9b","error":"HTTP 429: Too Many Requests","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x745e91e6db835646f790799e46afb73c459f5af7/pools?include=base_token,quote_token","address":"0x745e91e6db835646f790799e46afb73c459f5af7","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:06.166Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"GM！ ☀️新的一周。同一个星球。仍在@BASE基础上。 🟦如","creator":"0xf35dbd9732436a7c128e514b80c067fd14dbfc9f"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:06.453Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"dd6a0832-0bc5-4faf-aa39-082902edee9b"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:06.453Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"dd6a0832-0bc5-4faf-aa39-082902edee9b","url":"api.geckoterminal.com","failures":3},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:06.519Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"SimpleSoul","creator":"0x1702e2713a972986f04732e7926121b51af9ea1e"},"service":"kiko-api","env":"production"}
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 1071753.9732213658,
[api]   amountOut: 0.000495752220317253,
[api]   quotePrice: 4.6256158848394364e-10,
[api]   refPrice: 3.43080092965442e-10,
[api]   tokenInUsd: 'available',
[api]   impact: 34.82612310313699,
[api]   formula: '((4.6256158848394364e-10 - 3.43080092965442e-10) / 3.43080092965442e-10) * 100 = 34.82612310313699'
[api] }
[api] [QuoteService] Price impact > 10%, refPrice likely unreliable. Returning null. {
[api]   impact: 34.82612310313699,
[api]   refPrice: 3.43080092965442e-10,
[api]   quotePrice: 4.6256158848394364e-10
[api] }
[api] [QuoteService] Quote comparison: {
[api]   '0x_amount': '0.00049500308737884',
[api]   kyber_amount: '0.000495752220317253',
[api]   kyber_advantage_pct: '0.00',
[api]   chainId: 8453
[api] }
[api] [QuoteService] Preferring 0x for reliability { reason: 'prices within 2%', percentDiff: '0.00' }
[api] {"timestamp":"2026-01-27T08:41:06.651Z","level":"INFO","code":"EXE-4002","message":"Checking approval for swap","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","token":"0xd2686179d72ff875e35b6775e761240bff749b07","spender":"0x0000000000001ff3684f28c67538d4d072c22734","amount":"1071753973221365747236863","isNative":false},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:06.706Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"dd6a0832-0bc5-4faf-aa39-082902edee9b"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:06.707Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"dd6a0832-0bc5-4faf-aa39-082902edee9b","url":"api.geckoterminal.com","failures":4},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:06.880Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"symbol":"fivefold_mind","creator":"0xba848e5552bc9f73ae106ed50e8ad6abb40cc49b"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:06.962Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{"traceId":"dd6a0832-0bc5-4faf-aa39-082902edee9b"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:06.963Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"traceId":"dd6a0832-0bc5-4faf-aa39-082902edee9b","url":"api.geckoterminal.com","failures":5},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:06.963Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"dd6a0832-0bc5-4faf-aa39-082902edee9b","error":"HTTP 429: Too Many Requests","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x4d1aa95f03042718cf489415b999bffb28b3d376/pools?include=base_token,quote_token","address":"0x4d1aa95f03042718cf489415b999bffb28b3d376","network":"base"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1769503266965,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-16","res":{"statusCode":200},"responseTime":22069.694000000018,"msg":"request completed"}
[api] {"timestamp":"2026-01-27T08:41:07.756Z","level":"INFO","code":"EXE-4002","message":"Approval required","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","token":"0xd2686179","spender":"0x00000000","currentAllowance":"0","requiredAmount":"1071753973221365747236863","needsApproval":true},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:07.756Z","level":"INFO","code":"EXE-4002","message":"Approval required, auto-executing","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","token":"0xd2686179d72ff875e35b6775e761240bff749b07","spender":"0x0000000000001ff3684f28c67538d4d072c22734","amount":"1071753973221365747236863"},"service":"kiko-api","env":"production"}
[api] [sendTransaction] ========== PRIVY TX PARAMS ==========
[api] [sendTransaction] From: 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [sendTransaction] To: 0xd2686179d72ff875e35b6775e761240bff749b07
[api] [sendTransaction] Value: 0
[api] [sendTransaction] ValueHex: 0x0
[api] [sendTransaction] Data length: 138
[api] [sendTransaction] Data (full): 0x095ea7b30000000000000000000000000000000000001ff3684f28c67538d4d072c22734ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
[api] [sendTransaction] ChainId: 8453
[api] [sendTransaction] Gas: undefined
[api] [sendTransaction] MaxFeePerGas: undefined
[api] [sendTransaction] MaxPriorityFeePerGas: undefined
[api] [sendTransaction] Full TX object: {
[api]   to: '0xd2686179d72ff875e35b6775e761240bff749b07',
[api]   data: '0x095ea7b30000000000000000000000000000000000001ff3684f28c67538d4d072c22734ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
[api]   value: '0',
[api]   chainId: 8453
[api] }
[api] [sendTransaction] ===========================================
[api] {"timestamp":"2026-01-27T08:41:11.106Z","level":"INFO","code":"EXE-4002","message":"Ethereum transaction sent via Privy","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","txHash":"0xbed84c2b677f0ec52b1604b908e2185981be4a7867a9e6d0203c154cac25993e","chainId":8453},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:12.108Z","level":"INFO","code":"EXE-4002","message":"Approval transaction sent","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","txHash":"0xbed84c2b677f0ec52b1604b908e2185981be4a7867a9e6d0203c154cac25993e"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:12.108Z","level":"INFO","code":"EXE-4002","message":"Waiting for approval confirmation...","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","txHash":"0xbed84c2b677f0ec52b1604b908e2185981be4a7867a9e6d0203c154cac25993e"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:41:14.557Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [PrepareSwapTransaction] Socket error - waiting for backend to complete transaction...
[api] {"timestamp":"2026-01-27T08:41:17.508Z","level":"INFO","code":"EXE-4002","message":"Approval confirmed on-chain, proceeding with swap","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","txHash":"0xbed84c2b677f0ec52b1604b908e2185981be4a7867a9e6d0203c154cac25993e","blockNumber":41356963},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:17.508Z","level":"INFO","code":"EXE-4002","message":"Re-fetching quote after approval confirmation","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","originalDex":"0x Aggregator"},"service":"kiko-api","env":"production"}
[api] [Kyber] GET routes {
[api]   routesUrl: 'https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=0xd2686179d72ff875e35b6775e761240bff749b07&tokenOut=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&amountIn=1071753973221365747236863&saveGas=true&gasInclude=true&clientId=kiko-app'
[api] }
[api] [PrepareSwapTransaction] Polling... 3s elapsed (5 attempts)
[api] [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
[api] {"timestamp":"2026-01-27T08:41:18.721Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"bsc","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:19.005Z","level":"INFO","code":"API-5001","message":"0x API Quote received successfully","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","sellToken":"0xd2686179d72ff875e35b6775e761240bff749b07","buyToken":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","buyAmount":"498537546885100","usedEndpoint":"allowance-holder"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:19.005Z","level":"INFO","code":"API-5001","message":"0x API Quote successful","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","sellToken":"0xd2686179d7","buyToken":"0xEeeeeEeeeE","buyAmount":"498537546885100","hasAllowanceIssue":false,"usedEndpoint":"allowance-holder"},"service":"kiko-api","env":"production"}
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 1071753.9732213658,
[api]   amountOut: 0.0004985375468851,
[api]   quotePrice: 4.6516043732186785e-10,
[api]   refPrice: 3.43080092965442e-10,
[api]   tokenInUsd: 'available',
[api]   impact: 35.583628097221855,
[api]   formula: '((4.6516043732186785e-10 - 3.43080092965442e-10) / 3.43080092965442e-10) * 100 = 35.583628097221855'
[api] }
[api] [QuoteService] Price impact > 10%, refPrice likely unreliable. Returning null. {
[api]   impact: 35.583628097221855,
[api]   refPrice: 3.43080092965442e-10,
[api]   quotePrice: 4.6516043732186785e-10
[api] }
[api] [QuoteService] 0x API estimatedPriceImpact: {
[api]   raw: undefined,
[api]   parsed: 0,
[api]   multipliedBy100: 0,
[api]   impactVsMkt: null,
[api]   willUse: 0
[api] }
[api] {"timestamp":"2026-01-27T08:41:19.206Z","level":"INFO","code":"SOC-7001","message":"Timer finished: get_trending_casts_trending","metadata":{"timeRange":"trending","limit":500,"offset":0,"count":500,"fromCache":false,"durationMs":33,"timerLabel":"get_trending_casts_trending"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:19.211Z","level":"INFO","code":"SOC-7003","message":"SocialRepo: Updated cache with 500 merged casts","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:19.211Z","level":"INFO","code":"SOC-7003","message":"SocialRepo: Saved 476 trending casts to database","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:19.211Z","level":"INFO","code":"SOC-7003","message":"Timer finished: save_trending_casts","metadata":{"count":476,"durationMs":564,"timerLabel":"save_trending_casts"},"service":"kiko-api","env":"production"}
[api] [SocialJob] Casts refreshed: 476 saved
[api] {"timestamp":"2026-01-27T08:41:20.381Z","level":"INFO","code":"WTC-2002","message":"Found addresses via WebSocket","metadata":{"count":198,"chain":"bsc"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:41:24.563Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:24.708Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":35,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:24.709Z","level":"ERROR","code":"API-5002","message":"API error on trending page","metadata":{"page":1,"error":"Circuit breaker open for api.geckoterminal.com"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:24.709Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"bsc","count":0,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:24.709Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":77,"chain":"bsc","durationMs":5988},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 77 trending tokens for BSC
[api] Saved 77 trending tokens for bsc to database and memory cache
[api] [TokenJob] Saved 77 tokens for BSC to DB + cache
[api] [PrepareSwapTransaction] Polling... 10s elapsed (10 attempts)
[api] [Kyber] routes response {
[api]   status: 200,
[api]   hasData: true,
[api]   keys: [ 'code', 'message', 'data', 'requestId' ]
[api] }
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 1071753.9732213658,
[api]   amountOut: 0.000497343062488934,
[api]   quotePrice: 4.6404592370585976e-10,
[api]   refPrice: 3.43080092965442e-10,
[api]   tokenInUsd: 'available',
[api]   impact: 35.258772869868174,
[api]   formula: '((4.6404592370585976e-10 - 3.43080092965442e-10) / 3.43080092965442e-10) * 100 = 35.258772869868174'
[api] }
[api] [QuoteService] Price impact > 10%, refPrice likely unreliable. Returning null. {
[api]   impact: 35.258772869868174,
[api]   refPrice: 3.43080092965442e-10,
[api]   quotePrice: 4.6404592370585976e-10
[api] }
[api] [QuoteService] Quote comparison: {
[api]   '0x_amount': '0.0004985375468851',
[api]   kyber_amount: '0.000497343062488934',
[api]   kyber_advantage_pct: '0.00',
[api]   chainId: 8453
[api] }
[api] [QuoteService] Preferring 0x for reliability { reason: '0x has better price', percentDiff: '0.00' }
[api] {"timestamp":"2026-01-27T08:41:29.519Z","level":"INFO","code":"EXE-4002","message":"Using fresh quote after approval","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","oldDex":"0x Aggregator","newDex":"0x Aggregator","oldAmountOut":"0.00049500308737884","newAmountOut":"0.0004985375468851"},"service":"kiko-api","env":"production"}
[api] [SwapExecutor] Executing 0x Aggregator swap on chain 8453
[api] [SwapExecutor] ========== TRANSACTION EXECUTION ==========
[api] [SwapExecutor] DEX: 0x Aggregator
[api] [SwapExecutor] Transaction params: {
[api]   to: '0x0000000000001ff3684f28c67538d4d072c22734',
[api]   dataLength: 4170,
[api]   dataPrefix: '0x2213bc0b00000000000000000000000049fb9c16b9b2a19452633573603c8376',
[api]   value: '0',
[api]   router: '0x0000000000001ff3684f28c67538d4d072c22734',
[api]   allowanceTarget: '0x0000000000001ff3684f28c67538d4d072c22734'
[api] }
[api] [SwapExecutor] Swap details: {
[api]   tokenIn: '0xd2686179d72ff875e35b6775e761240bff749b07',
[api]   tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
[api]   amountInBase: '1071753973221365747236863',
[api]   amountInHuman: '1071753.973221365747236863',
[api]   amountOut: '0.0004985375468851',
[api]   slippageBps: 50,
[api]   priceImpact: 0,
[api]   gasEstimate: 747005
[api] }
[api] [SwapExecutor] =============================================
[api] [SwapExecutor] Execution params prepared: {
[api]   dex: '0x Aggregator',
[api]   gasEstimate: 747005,
[api]   gasLimit: '1120507',
[api]   maxFeePerGas: '6284820',
[api]   maxPriorityFeePerGas: '1000000'
[api] }
[api] [sendTransaction] ========== PRIVY TX PARAMS ==========
[api] [sendTransaction] From: 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [sendTransaction] To: 0x0000000000001ff3684f28c67538d4d072c22734
[api] [sendTransaction] Value: 0
[api] [sendTransaction] ValueHex: 0x0
[api] [sendTransaction] Data length: 4170
[api] [sendTransaction] Data (full): 0x2213bc0b00000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e04000000000000000000000000d2686179d72ff875e35b6775e761240bff749b0700000000000000000000000000000000000000000000e2f3e638f8eabdb33fff00000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e0400000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000007441fff991f000000000000000000000000a386bc9d8f26ab170a847d73226e3e0bceb0fe8e000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000000000000000000000000000000001c325926c83d400000000000000000000000000000000000000000000000000000000000000a0be7187dd52f7c1b5bae564670000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001c0000000000000000000000000000000000000000000000000000000000000038000000000000000000000000000000000000000000000000000000000000004c0000000000000000000000000000000000000000000000000000000000000058000000000000000000000000000000000000000000000000000000000000000e4c1fb425e00000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e04000000000000000000000000d2686179d72ff875e35b6775e761240bff749b0700000000000000000000000000000000000000000000e2f3e638f8eabdb33fff00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000069787b5a00000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000184af72634f00000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e04000000000000000000000000d2686179d72ff875e35b6775e761240bff749b07000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000ffffffffffffffc50000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000482710fffd8963efd1fc6a506488495d951d5263988d250142000000000000000000000000000000000000068000000000c8b429d62f8f3bffb98cdb9569533ea23bf0ba28cc00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010438c9c147000000000000000000000000420000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000027100000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000242e1a7d4d00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008434ee90ca000000000000000000000000f5c4f3dc02c3fb9279495a8fef7b0741da956157000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000000000000000000000000000000001c625014c6fba00000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee000000000000000000000000000000000000000000000000000000000000000f000000000000000000000000ad01c20d5886137e056775af56915de824c8fce5000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
[api] [sendTransaction] ChainId: 8453
[api] [sendTransaction] Gas: 1120507
[api] [sendTransaction] MaxFeePerGas: 6284820
[api] [sendTransaction] MaxPriorityFeePerGas: 1000000
[api] [sendTransaction] Full TX object: {
[api]   to: '0x0000000000001ff3684f28c67538d4d072c22734',
[api]   data: '0x2213bc0b00000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e04000000000000000000000000d2686179d72ff875e35b6775e761240bff749b0700000000000000000000000000000000000000000000e2f3e638f8eabdb33fff00000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e0400000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000007441fff991f000000000000000000000000a386bc9d8f26ab170a847d73226e3e0bceb0fe8e000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000000000000000000000000000000001c325926c83d400000000000000000000000000000000000000000000000000000000000000a0be7187dd52f7c1b5bae564670000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001c0000000000000000000000000000000000000000000000000000000000000038000000000000000000000000000000000000000000000000000000000000004c0000000000000000000000000000000000000000000000000000000000000058000000000000000000000000000000000000000000000000000000000000000e4c1fb425e00000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e04000000000000000000000000d2686179d72ff875e35b6775e761240bff749b0700000000000000000000000000000000000000000000e2f3e638f8eabdb33fff00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000069787b5a00000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000184af72634f00000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e04000000000000000000000000d2686179d72ff875e35b6775e761240bff749b07000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000ffffffffffffffc50000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000482710fffd8963efd1fc6a506488495d951d5263988d250142000000000000000000000000000000000000068000000000c8b429d62f8f3bffb98cdb9569533ea23bf0ba28cc00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010438c9c147000000000000000000000000420000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000027100000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000242e1a7d4d00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008434ee90ca000000000000000000000000f5c4f3dc02c3fb9279495a8fef7b0741da956157000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000000000000000000000000000000001c625014c6fba00000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee000000000000000000000000000000000000000000000000000000000000000f000000000000000000000000ad01c20d5886137e056775af56915de824c8fce5000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
[api]   value: '0',
[api]   chainId: 8453,
[api]   gas: '1120507',
[api]   maxFeePerGas: '6284820',
[api]   maxPriorityFeePerGas: '1000000'
[api] }
[api] [sendTransaction] ===========================================
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:41:34.570Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:34.889Z","level":"INFO","code":"EXE-4002","message":"Ethereum transaction sent via Privy","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","txHash":"0xf6c7446c4672fa58c1e63a29f22f6c0d4c6bddf621eaee4d8be7824f158686f0","chainId":8453},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:35.890Z","level":"INFO","code":"EXE-4002","message":"Swap Broadcast","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","txHash":"0xf6c7446c4672fa58c1e63a29f22f6c0d4c6bddf621eaee4d8be7824f158686f0","method":"0x Aggregator"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:35.890Z","level":"INFO","code":"SYS-1007","message":"[Monitor] Started tracking 0xf6c7446c4672fa58c1e63a29f22f6c0d4c6bddf621eaee4d8be7824f158686f0 on 8453 (0x Aggregator)","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2"},"service":"kiko-api","env":"production"}
[api] [PrepareSwapTransaction] ✅ Found transaction after 22s (14 polls): 0xf6c7446c4672fa58c1e63a29f22f6c0d4c6bddf621eaee4d8be7824f158686f0
[api] {"timestamp":"2026-01-27T08:41:36.912Z","level":"INFO","code":"AI-6011","message":"Tool returned _final flag - swap execution complete","metadata":{"tool":"prepare_swap_transaction","success":true},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:36.919Z","level":"INFO","code":"AI-6011","message":"Tool final flag detected - completing task immediately","metadata":{"stopReasons":["tool_final:prepare_swap_transaction"],"immediateExit":true},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Broadcasting message_complete for cmkwci89d00bhkmokogl624ix
[api] {"timestamp":"2026-01-27T08:41:36.926Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:36.929Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:36.929Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1769503296939,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-17","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkwcfcb100amkmok3wh72vc8","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52624},"msg":"incoming request"}
[api] {"level":30,"time":1769503296940,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-17","res":{"statusCode":204},"responseTime":0.9198750000214204,"msg":"request completed"}
[api] {"level":30,"time":1769503296942,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-18","req":{"method":"GET","url":"/api/chat/sessions/cmkwcfcb100amkmok3wh72vc8","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52624},"msg":"incoming request"}
[api] {"level":30,"time":1769503296954,"pid":2112,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-18","res":{"statusCode":200},"responseTime":11.948749999981374,"msg":"request completed"}
[api] [Swap Background] Trade cmkwckpec00jhkmokgljebyvd updated to failed
[api] [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
[api] {"timestamp":"2026-01-27T08:41:39.748Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"arbitrum","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:39.748Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:41.073Z","level":"WARN","code":"API-5002","message":"RPC endpoint failed","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","chain":"Base","endpoint":1,"total":4,"error":"RPC Error: execution reverted","duration":323},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:42.214Z","level":"WARN","code":"API-5002","message":"RPC endpoint failed","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","chain":"Base","endpoint":2,"total":4,"error":"RPC Error: execution reverted","duration":1041},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:41:44.577Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:44.585Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":7,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:44.585Z","level":"INFO","code":"SYS-1007","message":"Circuit breaker reset for endpoint","metadata":{"url":"api.geckoterminal.com"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:45.462Z","level":"ERROR","code":"API-5002","message":"All RPC endpoints failed","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","chain":"Base","totalEndpoints":4,"lastError":"RPC Error: execution reverted"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:45.463Z","level":"ERROR","code":"EXE-4004","message":"[Monitor] Transaction REVERTED: 0xf6c7446c4672fa58c1e63a29f22f6c0d4c6bddf621eaee4d8be7824f158686f0","metadata":{"traceId":"96d3e9d1-eda9-4d79-a88e-151a4147e1c2","reason":"All RPC endpoints failed for Base. Last error: execution reverted","gasUsed":"0x932b4","dex":"0x Aggregator"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x2: API-5001:Skipping low liquidity token","timestamp":"2026-01-27T08:41:46.865Z","metadata":{}}
[api] {"timestamp":"2026-01-27T08:41:46.865Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"VSN","liquidity":358.4815},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:51.102Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:52.079Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:52.336Z","level":"WARN","code":"API-5004","message":"[UnifiedAPI] 429 Rate Limit on api.geckoterminal.com","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:52.336Z","level":"WARN","code":"SYS-1006","message":"Circuit breaker opened for endpoint","metadata":{"url":"api.geckoterminal.com","failures":3},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:52.336Z","level":"ERROR","code":"API-5002","message":"API error on trending page","metadata":{"page":7,"error":"HTTP 429: Too Many Requests"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:52.336Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"arbitrum","count":38,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-27T08:41:52.336Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":42,"chain":"arbitrum","durationMs":12588},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 42 trending tokens for Arbitrum
[api] Saved 42 trending tokens for arbitrum to database and memory cache
[api] [TokenJob] Saved 42 tokens for Arbitrum to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-27T08:41:54.583Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}

