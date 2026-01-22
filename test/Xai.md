Last login: Mon Jan 19 17:22:40 on ttys011
almurat@almuratdeMacBook-Pro ~ % cd kiko/kiko-api && npm run dev

> kiko-api@1.0.0 dev
> concurrently -k -n api,python "tsx watch src/index.ts" "cd ../kiko-python && python3 main.py"

[python] INFO:__main__:✅ Grok service mounted at /grok
[python] INFO:moderation.models:✅ OpenAI Moderation API initialized (lightweight mode)
[python] INFO:__main__:✅ Moderation service mounted at /moderation
[api] [Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] {"timestamp":"2026-01-19T09:36:46.671Z","level":"INFO","code":"SYS-1001","message":"Zora SDK initialized with API Key","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Found user list at: /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
[api] [SkillRegistry] Loading skills...
[api] [SkillRegistry] Loaded skill: copy_trade
[api] [SkillRegistry] Loaded skill: market_macro
[api] [SkillRegistry] Loaded skill: polymarket_prediction
[api] [SkillRegistry] Loaded skill: risk_security
[api] [SkillRegistry] Loaded skill: social_farcaster
[api] [SkillRegistry] Loaded skill: swap
[api] [SkillRegistry] Loaded skill: token_analysis
[api] [SkillRegistry] Loaded skill: wallet_portfolio
[api] [SkillRegistry] Loaded skill: zora_nfts
[api] {"timestamp":"2026-01-19T09:36:47.066Z","level":"WARN","code":"SYS-1001","message":"Public folder not found - skipping static file serving","metadata":{"path":"/Users/almurat/KiKo/kiko-api/public"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:36:47.068Z","level":"INFO","code":"SYS-1001","message":"Initializing services...","metadata":{"env":"production","port":3001,"database":"configured","privy":"✅ Configured"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:36:47.215Z","level":"INFO","code":"SYS-1004","message":"Database connection successful","metadata":{},"service":"kiko-api","env":"production"}
[api] [DataRetention] Checking retention policies...
[api] [Prisma] DB connection is healthy
[api] [DataRetention] Starting cleanup job...
[api] [Redis] Connected successfully
[api] {"timestamp":"2026-01-19T09:36:47.228Z","level":"INFO","code":"SYS-1005","message":"Redis initialized","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:36:47.228Z","level":"INFO","code":"SYS-1001","message":"Starting server on port 3001...","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768815407251,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","msg":"Server listening at http://0.0.0.0:3001"}
[api] {"timestamp":"2026-01-19T09:36:47.251Z","level":"INFO","code":"SYS-1001","message":"Server listening","metadata":{"url":"http://localhost:3001","health":"http://localhost:3001/health"},"service":"kiko-api","env":"production"}
[api] [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
[api] [TokenJob] Scheduled: Every 5min (Ethereum, Solana, Base, BSC, Arbitrum, Optimism, Polygon)
[api] [SocialJob] Scheduled: Every 10min
[api] {"timestamp":"2026-01-19T09:36:47.264Z","level":"INFO","code":"SYS-1001","message":"Background jobs started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:36:47.264Z","level":"INFO","code":"SYS-1001","message":"Initializing auto trade service...","metadata":{},"service":"kiko-api","env":"production"}
[api] [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
[api] {"timestamp":"2026-01-19T09:36:47.264Z","level":"INFO","code":"SYS-1001","message":"Auto trade service initialized (Solana watcher + EVM webhook enabled)","metadata":{"mode":"hybrid"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:36:47.264Z","level":"INFO","code":"SYS-1001","message":"Auto trade service started","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] Starting position monitor (every 30s)...
[api] {"timestamp":"2026-01-19T09:36:47.264Z","level":"INFO","code":"SYS-1001","message":"Position monitor started","metadata":{},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Started polling for AI tasks (interval: 3000ms)
[api] {"timestamp":"2026-01-19T09:36:47.265Z","level":"INFO","code":"SYS-1001","message":"Chat worker started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:36:47.265Z","level":"INFO","code":"SYS-1001","message":"🎉 All services initialized!","metadata":{},"service":"kiko-api","env":"production"}
[api] [DataRetention] Cleaned 85 records from TrendingCast
[api] [DataRetention] Cleanup job completed.
[api] {"level":30,"time":1768815409089,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWtoenc0aGMwMXJpZ3EwY3Zwc3ppZGQ2IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3Njg4MTIxMTAsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc2ODgxNTcxMH0.Mtp9-9UnLzxi19hd20o_cU5b0IkT_UE_uFE1SlBwcPrLsSL2Al72zpXQXFCaJfUVlRT7NdugiidiP88Vm5DhxQ","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52753},"msg":"incoming request"}
[api] {"timestamp":"2026-01-19T09:36:49.092Z","level":"INFO","code":"WS-8001","message":"ChatWS Client connected","metadata":{"traceId":"c9b8fb5a-b2da-4b43-96be-6bc7fed47324","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1},"service":"kiko-api","env":"production"}
[python] INFO:chromadb.telemetry.product.posthog:Anonymized telemetry enabled. See                     https://docs.trychroma.com/telemetry for more information.
[python] INFO:__main__:✅ RAG service mounted at /rag
[python] INFO:     Started server process [19500]
[python] INFO:     Waiting for application startup.
[python] INFO:     Application startup complete.
[python] INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
[api] [MarketJob] Running startup staleness check...
[api] [PositionMonitor] 🔄 Running position check...
[api] [MarketJob] Overview is fresh, skipping API call
[api] [TokenJob] Tokens for Ethereum are fresh, skipping API call
[api] {"timestamp":"2026-01-19T09:36:52.276Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Trending casts are fresh, skipping Snapchain API call
[api] [MarketJob] Protocols are fresh, skipping API call
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] {"level":30,"time":1768815414775,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","req":{"method":"GET","url":"/api/config/auth-key-id","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52788},"msg":"incoming request"}
[api] {"level":30,"time":1768815414781,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","res":{"statusCode":200},"responseTime":6.421333998441696,"msg":"request completed"}
[api] {"level":30,"time":1768815414784,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","req":{"method":"OPTIONS","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52791},"msg":"incoming request"}
[api] {"level":30,"time":1768815414785,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","res":{"statusCode":204},"responseTime":1.4365000016987324,"msg":"request completed"}
[api] {"level":30,"time":1768815414786,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52792},"msg":"incoming request"}
[api] {"level":30,"time":1768815414787,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","res":{"statusCode":204},"responseTime":0.44520800188183784,"msg":"request completed"}
[api] {"level":30,"time":1768815414787,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","req":{"method":"GET","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52788},"msg":"incoming request"}
[api] {"level":30,"time":1768815414810,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52791},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] {"level":30,"time":1768815415891,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","res":{"statusCode":200},"responseTime":1103.4000419974327,"msg":"request completed"}
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1768815416001,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52792},"msg":"incoming request"}
[api] {"level":30,"time":1768815416002,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","res":{"statusCode":204},"responseTime":1.0233749970793724,"msg":"request completed"}
[api] {"level":30,"time":1768815416002,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","req":{"method":"OPTIONS","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52788},"msg":"incoming request"}
[api] {"level":30,"time":1768815416003,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","res":{"statusCode":204},"responseTime":0.4193750023841858,"msg":"request completed"}
[api] {"level":30,"time":1768815416005,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52792},"msg":"incoming request"}
[api] {"level":30,"time":1768815416012,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52801},"msg":"incoming request"}
[api] {"level":30,"time":1768815416013,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","req":{"method":"POST","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52788},"msg":"incoming request"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=What’s that token 0x...
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1768815416022,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","res":{"statusCode":200},"responseTime":8.842125002294779,"msg":"request completed"}
[api] {"level":30,"time":1768815416023,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","res":{"statusCode":200},"responseTime":18.103749997913837,"msg":"request completed"}
[api] {"level":30,"time":1768815416024,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkz11w20001rh37e5rkpi5k","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52788},"msg":"incoming request"}
[api] {"level":30,"time":1768815416025,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","res":{"statusCode":204},"responseTime":0.3597079999744892,"msg":"request completed"}
[api] {"level":30,"time":1768815416026,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","req":{"method":"GET","url":"/api/chat/sessions/cmkkz11w20001rh37e5rkpi5k","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52792},"msg":"incoming request"}
[api] {"level":30,"time":1768815416056,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","res":{"statusCode":200},"responseTime":30.27429099753499,"msg":"request completed"}
[api] {"level":30,"time":1768815416057,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkz11w20001rh37e5rkpi5k/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52788},"msg":"incoming request"}
[api] {"level":30,"time":1768815416058,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","res":{"statusCode":204},"responseTime":0.1758750006556511,"msg":"request completed"}
[api] {"level":30,"time":1768815416058,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","req":{"method":"POST","url":"/api/chat/sessions/cmkkz11w20001rh37e5rkpi5k/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52792},"msg":"incoming request"}
[api] {"level":30,"time":1768815416079,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","res":{"statusCode":200},"responseTime":20.970833998173475,"msg":"request completed"}
[api] {"level":30,"time":1768815416087,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52788},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] {"level":30,"time":1768815416089,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWtoenc0aGMwMXJpZ3EwY3Zwc3ppZGQ2IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3Njg4MTU0MTQsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc2ODgxOTAxNH0.PX3csR9tJ_vMna3q7x9SzNjY9IpWK7chhp2IhnkKK5EEXEbxePpeefrwbOFaw34V5Y1Ly4UHex--m3BBlSmI2A","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52804},"msg":"incoming request"}
[api] {"timestamp":"2026-01-19T09:36:56.091Z","level":"INFO","code":"WS-8001","message":"ChatWS Client connected","metadata":{"traceId":"28133644-9ff0-4928-a42a-8fad92086b17","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1},"service":"kiko-api","env":"production"}
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1768815416128,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52792},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] [ChatWorker] Running task cmkkz11xm0009rh376zzzu90y for session cmkkz11w20001rh37e5rkpi5k
[api] {"timestamp":"2026-01-19T09:36:56.282Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:36:56.282Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:36:56.284Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[python] INFO:moderation.router:Moderating input: What’s that token 0x3dA7Ad8101bc1fc0C80E2860Be9A53...
[api] [TokenJob] Tokens for Solana are fresh, skipping API call
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] DEBUG: Loading .env from /Users/almurat/KiKo/kiko-python/kiko-api/.env
[python] DEBUG: OPENAI_API_KEY present: True
[python] INFO:     127.0.0.1:52810 - "POST /moderation/input HTTP/1.1" 200 OK
[api] {"timestamp":"2026-01-19T09:36:57.695Z","level":"INFO","code":"SYS-1007","message":"Moderation Input check result","metadata":{"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:36:57.697Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok: Sent message_start for cmkkz11xj0007rh37lwacnqms
[api] {"timestamp":"2026-01-19T09:36:57.697Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:36:57.700Z","level":"INFO","code":"SYS-1007","message":"ToolPreRouter: Category matched","metadata":{"category":"0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}","tools":["get_token_info","web_search","prepare_swap_transaction","check_token_risk","get_early_buyers","analyze_creator"]},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok base filtered to 6 tools for message: "What’s that token 0x3dA7Ad8101bc1fc0C80E2860Be9A53..."
[api] [TokenJob] Tokens for Base are fresh, skipping API call
[api] {"timestamp":"2026-01-19T09:37:04.342Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5139bfc0-b882-4c0e-824b-4b04bcbaa276","address":"0x0077ae08200c05af9741b38366e26f7b1e7bfe2d"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:04.391Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5139bfc0-b882-4c0e-824b-4b04bcbaa276","address":"0x0129614474d4b1df7053cc18c4e1cb646c563332"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:04.397Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5139bfc0-b882-4c0e-824b-4b04bcbaa276","address":"0x01af27cd29eaab7392039c9fae18a5c86938b96a"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:04.441Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5139bfc0-b882-4c0e-824b-4b04bcbaa276","address":"0x04acf03e000f1e982d619c7f40c75ffa32303c77"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:05.082Z","level":"INFO","code":"AI-6001","message":"Timer finished: intent_parsing_dcc370b1","metadata":{"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":true,"confidence":0.6214213562373094,"routingStage":"hybrid","labels":[{"label":"TRADING","confidence":0.6214213562373094},{"label":"MARKET_ANALYSIS","confidence":0.282842712474619},{"label":"RISK_SCAN","confidence":0.1414213562373095}],"durationMs":7382,"timerLabel":"intent_parsing_dcc370b1"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:05.089Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok skill-gated to 4 tools for intent=TRADING skills=swap, wallet_portfolio
[api] {"timestamp":"2026-01-19T09:37:05.091Z","level":"INFO","code":"AI-6006","message":"PromptOrchestrator: Intent matched skills","metadata":{"intent":"TRADING","count":2,"skills":["swap","wallet_portfolio"]},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:05.091Z","level":"INFO","code":"AI-6003","message":"Timer finished: prompt_gen_TRADING_grok","metadata":{"model":"grok","intent":"TRADING","length":23796,"durationMs":0,"timerLabel":"prompt_gen_TRADING_grok"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:05.092Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok: Detected contract address: 0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525
[api] {"timestamp":"2026-01-19T09:37:06.120Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5139bfc0-b882-4c0e-824b-4b04bcbaa276","address":"0x07d3eab4cb4e030722cfa848f6059cff839b7d61"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:06.126Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5139bfc0-b882-4c0e-824b-4b04bcbaa276","address":"0x06943fe338e9e6d9df904b42ee0bc1d212e2c955"},"service":"kiko-api","env":"production"}
[api] [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:37:07.504Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"bsc","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:07.505Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"65ad8e95-fc87-4e57-92bb-d7d907caad5f","address":"0x1e358596f48420fe4cd147dcc850661632125e21"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:07.505Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5139bfc0-b882-4c0e-824b-4b04bcbaa276","address":"0x18a1c2f95ff8e7b87804067d3aa6f7e125ba1ad9"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:07.506Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5139bfc0-b882-4c0e-824b-4b04bcbaa276","address":"0x1596d5e13ff436897ffe83c12e955b4f4f11c47f"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:07.506Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5139bfc0-b882-4c0e-824b-4b04bcbaa276","address":"0x0f689993a73351104ae69465a77759555e48bf2c"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:07.884Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"65ad8e95-fc87-4e57-92bb-d7d907caad5f","status":404,"statusText":"Not Found","error":"{\"errors\":[{\"status\":\"404\",\"title\":\"Not Found\"}],\"meta\":{\"ref_id\":\"83560d35-617e-48b8-a8f8-9f13f58237c7\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1e358596f48420fe4cd147dcc850661632125e21/pools?include=base_token,quote_token","address":"0x1e358596f48420fe4cd147dcc850661632125e21","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:08.221Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5139bfc0-b882-4c0e-824b-4b04bcbaa276","address":"0x1e358596f48420fe4cd147dcc850661632125e21"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:08.337Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5139bfc0-b882-4c0e-824b-4b04bcbaa276","address":"0x2107bdfb49d6812d791bd5d3de583db4eb8be02e"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:08.489Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"5139bfc0-b882-4c0e-824b-4b04bcbaa276","status":404,"statusText":"Not Found","error":"{\"errors\":[{\"status\":\"404\",\"title\":\"Not Found\"}],\"meta\":{\"ref_id\":\"83560d35-617e-48b8-a8f8-9f13f58237c7\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1e358596f48420fe4cd147dcc850661632125e21/pools?include=base_token,quote_token","address":"0x1e358596f48420fe4cd147dcc850661632125e21","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:08.563Z","level":"INFO","code":"AI-6005","message":"Timer finished: launchpad_det_0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525","metadata":{"address":"0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525","chainId":8453,"found":false,"durationMs":3056,"timerLabel":"launchpad_det_0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:08.563Z","level":"INFO","code":"AI-6004","message":"Timer finished: find_token_any_0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525","metadata":{"address":"0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525","symbol":"$SXS","chain":"Base","durationMs":3471,"timerLabel":"find_token_any_0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok: Waiting for early pre-fetch to complete
[api] {"timestamp":"2026-01-19T09:37:08.563Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:08.570Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768815428746,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","res":{"statusCode":200},"responseTime":12658.635874997824,"msg":"request completed"}
[api] {"level":30,"time":1768815428746,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","res":{"statusCode":200},"responseTime":13936.602416999638,"msg":"request completed"}
[api] {"level":30,"time":1768815428746,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","res":{"statusCode":200},"responseTime":12618.265875000507,"msg":"request completed"}
[api] {"timestamp":"2026-01-19T09:37:08.988Z","level":"INFO","code":"WTC-2002","message":"Found addresses via WebSocket","metadata":{"count":195,"chain":"bsc"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768815429038,"pid":19501,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","res":{"statusCode":200},"responseTime":13026.401124998927,"msg":"request completed"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/embeddings "HTTP/1.1 200 OK"
[python] [Model] Original: grok-4-non-reasoning -> Normalized: grok-4-1-fast-non-reasoning
[python] [RAG] 🔍 Informational query detected: '[CONTEXT]
[python] - Current Time: 2026-01-19T09:37:08.569Z...'

[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] [Generate] Starting generator
[python] [Tool Call] Detected in chunk: 1 tool(s)
[python] [Tool Call] get_token_info: {"address":"0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525","chain":"base"}...
[python] [Tool Call] Custom tool detected - buffered content will be discarded
[python] [Tool Call Event] Sending tool call event for get_token_info (ID: call_1768815434752091_-6300357276198198698)
[python] [Custom Tool] Executing get_token_info...
[python] [Tool Execution] Executing tool: get_token_info with args: {'address': '0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525', 'chain': 'base'}
[python] [Tool Execution] 🔍 KIKO_API_BASE = http://localhost:3001
[python] [Tool Execution] 🔍 Calling unified executor at: http://localhost:3001/api/ai/tools/execute
[python] [Custom Tool] get_token_info returned: 1141 chars
[python] [Custom Tool] Appending tool result to chat: {
[python]   "source": "DexScreener",
[python]   "address": "0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525",
[python]   "name": "S...
[python] [Custom Tool] Added tool result to chat, will call Grok again
[python] [Tool Call] Detected in chunk: 1 tool(s)
[python] [Tool Call] check_token_risk: {"address":"0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525","chain":"base"}...
[python] [Tool Call] Custom tool detected - buffered content will be discarded
[python] [Tool Call Event] Sending tool call event for check_token_risk (ID: call_1768815437079695_6922543186814825949)
[python] [Custom Tool] Executing check_token_risk...
[python] [Tool Execution] Executing tool: check_token_risk with args: {'address': '0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525', 'chain': 'base'}
[python] [Tool Execution] 🔍 KIKO_API_BASE = http://localhost:3001
[python] [Tool Execution] 🔍 Calling unified executor at: http://localhost:3001/api/ai/tools/execute
[python] [Custom Tool] check_token_risk returned: 974 chars
[python] [Custom Tool] Appending tool result to chat: {
[python]   "status": "Safe",
[python]   "riskScore": 10,
[python]   "isHoneypot": false,
[python]   "buyTax": 0,
[python]   "sellTax": 0,
[python]   "wa...
[python] [Custom Tool] Added tool result to chat, will call Grok again
[python] [Tool Call] Detected in chunk: 1 tool(s)
[python] [Tool Call] web_search_with_snippets: {"query":"\"0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525\" OR \"$SXS\" OR \"SessionX\" base token site...
[python] [Tool Call] Built-in tool detected (web_search_with_snippets) - continuing stream
[python] [Tool Call Event] Sending tool call event for web_search_with_snippets (ID: call_1768815442439298_-8119742467209596191)
[python] [Tool Call] web_search_with_snippets is a built-in tool, handled by xai-sdk
[python] [Tool Call] Detected in chunk: 1 tool(s)
[python] [Tool Call] web_search_with_snippets: {"query":"\"SessionX\" $SXS token base official website OR announcement OR launch","num_results":10}...
[python] [Tool Call] Built-in tool detected (web_search_with_snippets) - continuing stream
[python] [Tool Call Event] Sending tool call event for web_search_with_snippets (ID: call_1768815442440513_1334402823211337392)
[python] [Tool Call] web_search_with_snippets is a built-in tool, handled by xai-sdk
[python] [Tool Call] Detected in response (fallback): 4 tool(s)
[python] [Tool Call] Skipping duplicate: get_token_info (already processed)
[python] [Tool Call] Skipping duplicate: check_token_risk (already processed)
[python] [Tool Call] Skipping duplicate: web_search_with_snippets (already processed)
[python] [Tool Call] Skipping duplicate: web_search_with_snippets (already processed)
[python] [Tool Call] Detected in response (fallback): 4 tool(s)
[python] [Tool Call] Skipping duplicate: get_token_info (already processed)
[python] [Tool Call] Skipping duplicate: check_token_risk (already processed)
[python] [Tool Call] Skipping duplicate: web_search_with_snippets (already processed)
[python] [Tool Call] Skipping duplicate: web_search_with_snippets (already processed)
[python] [Tool Call] Detected in response (fallback): 4 tool(s)
[python] [Tool Call] Skipping duplicate: get_token_info (already processed)
[python] [Tool Call] Skipping duplicate: check_token_risk (already processed)
[python] [Tool Call] Skipping duplicate: web_search_with_snippets (already processed)
[python] [Tool Call] Skipping duplicate: web_search_with_snippets (already processed)
[python] [Tool Turn] Tool call detected, continuing to turn 2
[python] [Citations] No final response available
[python] [Citations] Final: No citations collected
[python] [Usage] Prompt: 8266, Completion: 270, Total: 8536
[python] INFO:     127.0.0.1:53037 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] {"timestamp":"2026-01-19T09:37:28.331Z","level":"INFO","code":"SYS-1001","message":"Zora SDK initialized with API Key","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Found user list at: /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
[api] [SkillRegistry] Loading skills...
[api] [SkillRegistry] Loaded skill: copy_trade
[api] [SkillRegistry] Loaded skill: market_macro
[api] [SkillRegistry] Loaded skill: polymarket_prediction
[api] [SkillRegistry] Loaded skill: risk_security
[api] [SkillRegistry] Loaded skill: social_farcaster
[api] [SkillRegistry] Loaded skill: swap
[api] [SkillRegistry] Loaded skill: token_analysis
[api] [SkillRegistry] Loaded skill: wallet_portfolio
[api] [SkillRegistry] Loaded skill: zora_nfts
[api] {"timestamp":"2026-01-19T09:37:28.649Z","level":"WARN","code":"SYS-1001","message":"Public folder not found - skipping static file serving","metadata":{"path":"/Users/almurat/KiKo/kiko-api/public"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:28.651Z","level":"INFO","code":"SYS-1001","message":"Initializing services...","metadata":{"env":"production","port":3001,"database":"configured","privy":"✅ Configured"},"service":"kiko-api","env":"production"}
[api] [Prisma] DB connection is healthy
[api] {"timestamp":"2026-01-19T09:37:28.671Z","level":"INFO","code":"SYS-1004","message":"Database connection successful","metadata":{},"service":"kiko-api","env":"production"}
[api] [DataRetention] Checking retention policies...
[api] [DataRetention] Starting cleanup job...
[api] [Redis] Connected successfully
[api] {"timestamp":"2026-01-19T09:37:28.681Z","level":"INFO","code":"SYS-1005","message":"Redis initialized","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:28.681Z","level":"INFO","code":"SYS-1001","message":"Starting server on port 3001...","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768815448701,"pid":19517,"hostname":"almuratdeMacBook-Pro.local","msg":"Server listening at http://0.0.0.0:3001"}
[api] {"timestamp":"2026-01-19T09:37:28.701Z","level":"INFO","code":"SYS-1001","message":"Server listening","metadata":{"url":"http://localhost:3001","health":"http://localhost:3001/health"},"service":"kiko-api","env":"production"}
[api] [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
[api] [TokenJob] Scheduled: Every 5min (Ethereum, Solana, Base, BSC, Arbitrum, Optimism, Polygon)
[api] [SocialJob] Scheduled: Every 10min
[api] {"timestamp":"2026-01-19T09:37:28.713Z","level":"INFO","code":"SYS-1001","message":"Background jobs started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:28.713Z","level":"INFO","code":"SYS-1001","message":"Initializing auto trade service...","metadata":{},"service":"kiko-api","env":"production"}
[api] [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
[api] {"timestamp":"2026-01-19T09:37:28.713Z","level":"INFO","code":"SYS-1001","message":"Auto trade service initialized (Solana watcher + EVM webhook enabled)","metadata":{"mode":"hybrid"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:28.713Z","level":"INFO","code":"SYS-1001","message":"Auto trade service started","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] Starting position monitor (every 30s)...
[api] {"timestamp":"2026-01-19T09:37:28.713Z","level":"INFO","code":"SYS-1001","message":"Position monitor started","metadata":{},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Started polling for AI tasks (interval: 3000ms)
[api] {"timestamp":"2026-01-19T09:37:28.713Z","level":"INFO","code":"SYS-1001","message":"Chat worker started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:28.713Z","level":"INFO","code":"SYS-1001","message":"🎉 All services initialized!","metadata":{},"service":"kiko-api","env":"production"}
[api] [DataRetention] Cleanup job completed.
[api] {"level":30,"time":1768815450108,"pid":19517,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWtoenc0aGMwMXJpZ3EwY3Zwc3ppZGQ2IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3Njg4MTU0MTQsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc2ODgxOTAxNH0.PX3csR9tJ_vMna3q7x9SzNjY9IpWK7chhp2IhnkKK5EEXEbxePpeefrwbOFaw34V5Y1Ly4UHex--m3BBlSmI2A","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53059},"msg":"incoming request"}
[api] {"timestamp":"2026-01-19T09:37:30.119Z","level":"INFO","code":"WS-8001","message":"ChatWS Client connected","metadata":{"traceId":"c4b5613e-59ce-4ecb-bb39-c126839b01d6","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1},"service":"kiko-api","env":"production"}
[api] [MarketJob] Running startup staleness check...
[api] [PositionMonitor] 🔄 Running position check...
[api] [MarketJob] Overview is fresh, skipping API call
[api] [TokenJob] Tokens for Ethereum are fresh, skipping API call
[api] [SocialJob] Trending casts are fresh, skipping Snapchain API call
[api] {"timestamp":"2026-01-19T09:37:33.736Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [MarketJob] Protocols are fresh, skipping API call
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [TokenJob] Tokens for Solana are fresh, skipping API call
[api] [TokenJob] Tokens for Base are fresh, skipping API call
[api] [TokenJob] Tokens for BSC are fresh, skipping API call
[api] [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:37:53.742Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"arbitrum","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:53.743Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:58.506Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":7,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:37:59.455Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/arbitrum/trending_pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:38:00.969Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"ETH","liquidity":1.9254},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768815483568,"pid":19517,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","req":{"method":"OPTIONS","url":"/api/chat/tasks/cmkkz11xm0009rh376zzzu90y/stop","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53189},"msg":"incoming request"}
[api] {"level":30,"time":1768815483572,"pid":19517,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","res":{"statusCode":204},"responseTime":2.8292089998722076,"msg":"request completed"}
[api] {"level":30,"time":1768815483573,"pid":19517,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","req":{"method":"POST","url":"/api/chat/tasks/cmkkz11xm0009rh376zzzu90y/stop","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53189},"msg":"incoming request"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:38:03.743Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768815484686,"pid":19517,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","res":{"statusCode":200},"responseTime":1113.033834002912,"msg":"request completed"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x3: API-5004:External API requested retry","timestamp":"2026-01-19T09:38:04.778Z","metadata":{}}
[api] {"timestamp":"2026-01-19T09:38:04.778Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/arbitrum/trending_pools"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x3: API-5004:External API requested retry","timestamp":"2026-01-19T09:38:10.180Z","metadata":{}}
[api] {"timestamp":"2026-01-19T09:38:10.180Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/arbitrum/trending_pools"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768815491938,"pid":19517,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","req":{"method":"OPTIONS","url":"/api/chat/tasks/cmkkz11xm0009rh376zzzu90y/stop","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53189},"msg":"incoming request"}
[api] {"level":30,"time":1768815491939,"pid":19517,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","res":{"statusCode":204},"responseTime":0.7511250004172325,"msg":"request completed"}
[api] {"level":30,"time":1768815491941,"pid":19517,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","req":{"method":"POST","url":"/api/chat/tasks/cmkkz11xm0009rh376zzzu90y/stop","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53189},"msg":"incoming request"}
[api] {"level":30,"time":1768815491953,"pid":19517,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","res":{"statusCode":400},"responseTime":10.443125002086163,"msg":"request completed"}
[api] {"level":30,"time":1768815494355,"pid":19517,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","req":{"method":"GET","url":"/api/config/auth-key-id","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53189},"msg":"incoming request"}
[api] {"level":30,"time":1768815494356,"pid":19517,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","res":{"statusCode":200},"responseTime":1.1815409995615482,"msg":"request completed"}
[api] {"level":30,"time":1768815494359,"pid":19517,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWtoenc0aGMwMXJpZ3EwY3Zwc3ppZGQ2IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3Njg4MTU0MTQsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc2ODgxOTAxNH0.PX3csR9tJ_vMna3q7x9SzNjY9IpWK7chhp2IhnkKK5EEXEbxePpeefrwbOFaw34V5Y1Ly4UHex--m3BBlSmI2A","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53251},"msg":"incoming request"}
[api] {"timestamp":"2026-01-19T09:38:14.360Z","level":"INFO","code":"WS-8001","message":"ChatWS Client connected","metadata":{"traceId":"afd2b3b6-90a2-4f7a-8589-713b4b099fc7","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768815494361,"pid":19517,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","req":{"method":"OPTIONS","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53189},"msg":"incoming request"}
[api] {"level":30,"time":1768815494361,"pid":19517,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","res":{"statusCode":204},"responseTime":0.22666699811816216,"msg":"request completed"}
[api] {"level":30,"time":1768815494362,"pid":19517,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53254},"msg":"incoming request"}
[api] {"level":30,"time":1768815494363,"pid":19517,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","res":{"statusCode":204},"responseTime":0.9468340016901493,"msg":"request completed"}
[api] {"level":30,"time":1768815494364,"pid":19517,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53254},"msg":"incoming request"}
[api] {"level":30,"time":1768815494366,"pid":19517,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","req":{"method":"GET","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53189},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1768815494379,"pid":19517,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","res":{"statusCode":200},"responseTime":13.300666999071836,"msg":"request completed"}
[api] {"level":30,"time":1768815495671,"pid":19517,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53189},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x4: API-5004:External API requested retry","timestamp":"2026-01-19T09:38:16.831Z","metadata":{}}
[api] {"timestamp":"2026-01-19T09:38:16.831Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/arbitrum/trending_pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:38:22.076Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"00494b2c-45dc-45b8-9457-b5ddf4dbebfa","address":"0x0129614474d4b1df7053cc18c4e1cb646c563332"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:38:22.124Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"00494b2c-45dc-45b8-9457-b5ddf4dbebfa","address":"0x04acf03e000f1e982d619c7f40c75ffa32303c77"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:38:22.129Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"00494b2c-45dc-45b8-9457-b5ddf4dbebfa","address":"0x01af27cd29eaab7392039c9fae18a5c86938b96a"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:38:22.149Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"00494b2c-45dc-45b8-9457-b5ddf4dbebfa","address":"0x0077ae08200c05af9741b38366e26f7b1e7bfe2d"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x3: API-5004:External API requested retry","timestamp":"2026-01-19T09:38:22.160Z","metadata":{}}
[api] {"timestamp":"2026-01-19T09:38:22.160Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/arbitrum/trending_pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:38:25.896Z","level":"ERROR","code":"API-5002","message":"API error on trending page","metadata":{"page":9,"status":429,"statusText":"Too Many Requests"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:38:25.896Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"arbitrum","count":56,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:38:25.896Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":60,"chain":"arbitrum","durationMs":32154},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 60 trending tokens for Arbitrum
[api] Saved 60 trending tokens for arbitrum to database and memory cache
[api] [TokenJob] Saved 60 tokens for Arbitrum to DB + cache
[api] {"timestamp":"2026-01-19T09:38:26.791Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"00494b2c-45dc-45b8-9457-b5ddf4dbebfa","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x04acf03e000f1e982d619c7f40c75ffa32303c77/pools?include=base_token,quote_token","address":"0x04acf03e000f1e982d619c7f40c75ffa32303c77","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:38:26.804Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"00494b2c-45dc-45b8-9457-b5ddf4dbebfa","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x01af27cd29eaab7392039c9fae18a5c86938b96a/pools?include=base_token,quote_token","address":"0x01af27cd29eaab7392039c9fae18a5c86938b96a","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:38:26.822Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"00494b2c-45dc-45b8-9457-b5ddf4dbebfa","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x0077ae08200c05af9741b38366e26f7b1e7bfe2d/pools?include=base_token,quote_token","address":"0x0077ae08200c05af9741b38366e26f7b1e7bfe2d","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:38:27.841Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"00494b2c-45dc-45b8-9457-b5ddf4dbebfa","address":"0x06943fe338e9e6d9df904b42ee0bc1d212e2c955"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:38:27.900Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"00494b2c-45dc-45b8-9457-b5ddf4dbebfa","address":"0x07d3eab4cb4e030722cfa848f6059cff839b7d61"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x13: API-5004:External API requested retry","timestamp":"2026-01-19T09:38:28.143Z","metadata":{"traceId":"00494b2c-45dc-45b8-9457-b5ddf4dbebfa"}}
[api] {"timestamp":"2026-01-19T09:38:28.143Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"00494b2c-45dc-45b8-9457-b5ddf4dbebfa","status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x07d3eab4cb4e030722cfa848f6059cff839b7d61/pools"},"service":"kiko-api","env":"production"}
[api] [TokenJob] Fetching trending tokens for Optimism via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:38:30.934Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"optimism","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:38:30.934Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:38:31.255Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"00494b2c-45dc-45b8-9457-b5ddf4dbebfa","address":"0x18a1c2f95ff8e7b87804067d3aa6f7e125ba1ad9"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:38:31.258Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"00494b2c-45dc-45b8-9457-b5ddf4dbebfa","address":"0x1596d5e13ff436897ffe83c12e955b4f4f11c47f"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:38:31.273Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"00494b2c-45dc-45b8-9457-b5ddf4dbebfa","address":"0x0f689993a73351104ae69465a77759555e48bf2c"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:38:33.747Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x7: API-5004:External API requested retry","timestamp":"2026-01-19T09:38:33.975Z","metadata":{"traceId":"00494b2c-45dc-45b8-9457-b5ddf4dbebfa"}}
[api] {"timestamp":"2026-01-19T09:38:33.975Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"00494b2c-45dc-45b8-9457-b5ddf4dbebfa","status":429,"attempt":3,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1596d5e13ff436897ffe83c12e955b4f4f11c47f/pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:38:34.780Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":12,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:38:35.218Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"00494b2c-45dc-45b8-9457-b5ddf4dbebfa","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1596d5e13ff436897ffe83c12e955b4f4f11c47f/pools?include=base_token,quote_token","address":"0x1596d5e13ff436897ffe83c12e955b4f4f11c47f","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:38:35.239Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"00494b2c-45dc-45b8-9457-b5ddf4dbebfa","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing[Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] {"timestamp":"2026-01-19T09:39:16.606Z","level":"INFO","code":"SYS-1001","message":"Zora SDK initialized with API Key","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Found user list at: /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
[api] [SkillRegistry] Loading skills...
[api] [SkillRegistry] Loaded skill: copy_trade
[api] [SkillRegistry] Loaded skill: market_macro
[api] [SkillRegistry] Loaded skill: polymarket_prediction
[api] [SkillRegistry] Loaded skill: risk_security
[api] [SkillRegistry] Loaded skill: social_farcaster
[api] [SkillRegistry] Loaded skill: swap
[api] [SkillRegistry] Loaded skill: token_analysis
[api] [SkillRegistry] Loaded skill: wallet_portfolio
[api] [SkillRegistry] Loaded skill: zora_nfts
[api] {"timestamp":"2026-01-19T09:39:16.974Z","level":"WARN","code":"SYS-1001","message":"Public folder not found - skipping static file serving","metadata":{"path":"/Users/almurat/KiKo/kiko-api/public"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:39:16.975Z","level":"INFO","code":"SYS-1001","message":"Initializing services...","metadata":{"env":"production","port":3001,"database":"configured","privy":"✅ Configured"},"service":"kiko-api","env":"production"}
[api] [Prisma] DB connection is healthy
[api] {"timestamp":"2026-01-19T09:39:16.994Z","level":"INFO","code":"SYS-1004","message":"Database connection successful","metadata":{},"service":"kiko-api","env":"production"}
[api] [DataRetention] Checking retention policies...
[api] [DataRetention] Starting cleanup job...
[api] [Redis] Connected successfully
[api] {"timestamp":"2026-01-19T09:39:17.003Z","level":"INFO","code":"SYS-1005","message":"Redis initialized","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:39:17.003Z","level":"INFO","code":"SYS-1001","message":"Starting server on port 3001...","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768815557025,"pid":19948,"hostname":"almuratdeMacBook-Pro.local","msg":"Server listening at http://0.0.0.0:3001"}
[api] {"timestamp":"2026-01-19T09:39:17.025Z","level":"INFO","code":"SYS-1001","message":"Server listening","metadata":{"url":"http://localhost:3001","health":"http://localhost:3001/health"},"service":"kiko-api","env":"production"}
[api] [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
[api] [TokenJob] Scheduled: Every 5min (Ethereum, Solana, Base, BSC, Arbitrum, Optimism, Polygon)
[api] [SocialJob] Scheduled: Every 10min
[api] {"timestamp":"2026-01-19T09:39:17.038Z","level":"INFO","code":"SYS-1001","message":"Background jobs started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:39:17.038Z","level":"INFO","code":"SYS-1001","message":"Initializing auto trade service...","metadata":{},"service":"kiko-api","env":"production"}
[api] [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
[api] {"timestamp":"2026-01-19T09:39:17.038Z","level":"INFO","code":"SYS-1001","message":"Auto trade service initialized (Solana watcher + EVM webhook enabled)","metadata":{"mode":"hybrid"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:39:17.038Z","level":"INFO","code":"SYS-1001","message":"Auto trade service started","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] Starting position monitor (every 30s)...
[api] {"timestamp":"2026-01-19T09:39:17.038Z","level":"INFO","code":"SYS-1001","message":"Position monitor started","metadata":{},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Started polling for AI tasks (interval: 3000ms)
[api] {"timestamp":"2026-01-19T09:39:17.038Z","level":"INFO","code":"SYS-1001","message":"Chat worker started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:39:17.038Z","level":"INFO","code":"SYS-1001","message":"🎉 All services initialized!","metadata":{},"service":"kiko-api","env":"production"}
[api] [DataRetention] Cleanup job completed.
[api] {"level":30,"time":1768815558307,"pid":19948,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWtoenc0aGMwMXJpZ3EwY3Zwc3ppZGQ2IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3Njg4MTU0MTQsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc2ODgxOTAxNH0.PX3csR9tJ_vMna3q7x9SzNjY9IpWK7chhp2IhnkKK5EEXEbxePpeefrwbOFaw34V5Y1Ly4UHex--m3BBlSmI2A","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53660},"msg":"incoming request"}
[api] {"timestamp":"2026-01-19T09:39:18.319Z","level":"INFO","code":"WS-8001","message":"ChatWS Client connected","metadata":{"traceId":"3900eb37-527c-418f-8d1d-dd149d04ea35","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1},"service":"kiko-api","env":"production"}
[api] [MarketJob] Running startup staleness check...
[api] [PositionMonitor] 🔄 Running position check...
[api] [MarketJob] Overview is fresh, skipping API call
[api] {"timestamp":"2026-01-19T09:39:22.050Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [TokenJob] Tokens for Ethereum are fresh, skipping API call
[api] [MarketJob] Protocols are fresh, skipping API call
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [SocialJob] Trending casts are fresh, skipping Snapchain API call
[api] [TokenJob] Tokens for Solana are fresh, skipping API call
[api] [TokenJob] Tokens for Base are fresh, skipping API call
[api] [TokenJob] Tokens for BSC are fresh, skipping API call
[api] [TokenJob] Tokens for Arbitrum are fresh, skipping API call
[api] [TokenJob] Tokens for Optimism are fresh, skipping API call
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:39:52.058Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [TokenJob] Tokens for Polygon are fresh, skipping API call
[api] [TokenJob] Refreshed 7 chains in 30.0s
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:40:00.102Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"ethereum","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:40:00.102Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Trending casts are fresh, skipping Snapchain API call
[api] {"timestamp":"2026-01-19T09:40:04.181Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":23,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:40:05.681Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"XOR","liquidity":339.4842},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:40:09.861Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"eth","count":120,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:40:09.862Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"ethereum","durationMs":9760},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for Ethereum
[api] Saved 100 trending tokens for eth to database and memory cache
[api] [TokenJob] Saved 100 tokens for Ethereum to DB + cache
[api] [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:40:14.902Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"solana","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:40:14.902Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:40:21.973Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":127,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:40:21.974Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"solana","durationMs":7072},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for Solana
[api] Saved 100 trending tokens for solana to database and memory cache
[api] [TokenJob] Saved 100 tokens for Solana to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:40:22.063Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:40:27.039Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"base","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:40:28.521Z","level":"INFO","code":"WTC-2002","message":"Found addresses via WebSocket","metadata":{"count":172,"chain":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:40:32.383Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":39,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:40:36.447Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"GSD","liquidity":1.042932023e-12},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:40:38.001Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"base","count":100,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:40:38.002Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"base","durationMs":10963},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for Base
[api] Saved 100 trending tokens for base to database and memory cache
[api] [TokenJob] Saved 100 tokens for Base to DB + cache
[api] [TokenJob] Tokens for BSC are fresh, skipping API call
[api] [TokenJob] Tokens for Arbitrum are fresh, skipping API call
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:40:52.065Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [TokenJob] Tokens for Optimism are fresh, skipping API call
[api] [TokenJob] Tokens for Polygon are fresh, skipping API call
[api] [TokenJob] Refreshed 7 chains in 58.0s
[api] {"level":30,"time":1768815661450,"pid":19948,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkz11w20001rh37e5rkpi5k","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54212},"msg":"incoming request"}
[api] {"level":30,"time":1768815661453,"pid":19948,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","res":{"statusCode":204},"responseTime":2.6377499997615814,"msg":"request completed"}
[api] {"level":30,"time":1768815661454,"pid":19948,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","req":{"method":"GET","url":"/api/chat/sessions/cmkkz11w20001rh37e5rkpi5k","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54212},"msg":"incoming request"}
[api] {"level":30,"time":1768815662546,"pid":19948,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","res":{"statusCode":200},"responseTime":1092.0372499972582,"msg":"request completed"}
[api] {"level":30,"time":1768815662567,"pid":19948,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54212},"msg":"incoming request"}
[api] {"level":30,"time":1768815662568,"pid":19948,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","res":{"statusCode":204},"responseTime":0.8698330000042915,"msg":"request completed"}
[api] {"level":30,"time":1768815662569,"pid":19948,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54212},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1768815664689,"pid":19948,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54237},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1768815666677,"pid":19948,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkz11w20001rh37e5rkpi5k","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54260},"msg":"incoming request"}
[api] {"level":30,"time":1768815666680,"pid":19948,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","res":{"statusCode":204},"responseTime":1.7497499994933605,"msg":"request completed"}
[api] {"level":30,"time":1768815666682,"pid":19948,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","req":{"method":"DELETE","url":"/api/chat/sessions/cmkkz11w20001rh37e5rkpi5k","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54260}[Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] {"timestamp":"2026-01-19T09:41:19.305Z","level":"INFO","code":"SYS-1001","message":"Zora SDK initialized with API Key","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Found user list at: /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
[api] [SkillRegistry] Loading skills...
[api] [SkillRegistry] Loaded skill: copy_trade
[api] [SkillRegistry] Loaded skill: market_macro
[api] [SkillRegistry] Loaded skill: polymarket_prediction
[api] [SkillRegistry] Loaded skill: risk_security
[api] [SkillRegistry] Loaded skill: social_farcaster
[api] [SkillRegistry] Loaded skill: swap
[api] [SkillRegistry] Loaded skill: token_analysis
[api] [SkillRegistry] Loaded skill: wallet_portfolio
[api] [SkillRegistry] Loaded skill: zora_nfts
[api] {"timestamp":"2026-01-19T09:41:19.696Z","level":"WARN","code":"SYS-1001","message":"Public folder not found - skipping static file serving","metadata":{"path":"/Users/almurat/KiKo/kiko-api/public"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:41:19.699Z","level":"INFO","code":"SYS-1001","message":"Initializing services...","metadata":{"env":"production","port":3001,"database":"configured","privy":"✅ Configured"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:41:19.715Z","level":"INFO","code":"SYS-1004","message":"Database connection successful","metadata":{},"service":"kiko-api","env":"production"}
[api] [DataRetention] Checking retention policies...
[api] [DataRetention] Starting cleanup job...
[api] [Prisma] DB connection is healthy
[api] [Redis] Connected successfully
[api] {"timestamp":"2026-01-19T09:41:19.728Z","level":"INFO","code":"SYS-1005","message":"Redis initialized","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:41:19.728Z","level":"INFO","code":"SYS-1001","message":"Starting server on port 3001...","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768815679753,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","msg":"Server listening at http://0.0.0.0:3001"}
[api] {"timestamp":"2026-01-19T09:41:19.753Z","level":"INFO","code":"SYS-1001","message":"Server listening","metadata":{"url":"http://localhost:3001","health":"http://localhost:3001/health"},"service":"kiko-api","env":"production"}
[api] [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
[api] [TokenJob] Scheduled: Every 5min (Ethereum, Solana, Base, BSC, Arbitrum, Optimism, Polygon)
[api] [SocialJob] Scheduled: Every 10min
[api] {"timestamp":"2026-01-19T09:41:19.766Z","level":"INFO","code":"SYS-1001","message":"Background jobs started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:41:19.766Z","level":"INFO","code":"SYS-1001","message":"Initializing auto trade service...","metadata":{},"service":"kiko-api","env":"production"}
[api] [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
[api] {"timestamp":"2026-01-19T09:41:19.767Z","level":"INFO","code":"SYS-1001","message":"Auto trade service initialized (Solana watcher + EVM webhook enabled)","metadata":{"mode":"hybrid"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:41:19.767Z","level":"INFO","code":"SYS-1001","message":"Auto trade service started","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] Starting position monitor (every 30s)...
[api] {"timestamp":"2026-01-19T09:41:19.767Z","level":"INFO","code":"SYS-1001","message":"Position monitor started","metadata":{},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Started polling for AI tasks (interval: 3000ms)
[api] {"timestamp":"2026-01-19T09:41:19.767Z","level":"INFO","code":"SYS-1001","message":"Chat worker started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:41:19.767Z","level":"INFO","code":"SYS-1001","message":"🎉 All services initialized!","metadata":{},"service":"kiko-api","env":"production"}
[api] [DataRetention] Cleanup job completed.
[api] {"level":30,"time":1768815682153,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWtoenc0aGMwMXJpZ3EwY3Zwc3ppZGQ2IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3Njg4MTU0MTQsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc2ODgxOTAxNH0.PX3csR9tJ_vMna3q7x9SzNjY9IpWK7chhp2IhnkKK5EEXEbxePpeefrwbOFaw34V5Y1Ly4UHex--m3BBlSmI2A","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54427},"msg":"incoming request"}
[api] {"timestamp":"2026-01-19T09:41:22.160Z","level":"INFO","code":"WS-8001","message":"ChatWS Client connected","metadata":{"traceId":"b31621ff-b2e8-43c0-ae0c-bb3667f99af1","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1},"service":"kiko-api","env":"production"}
[api] [MarketJob] Running startup staleness check...
[api] [PositionMonitor] 🔄 Running position check...
[api] [MarketJob] Overview is fresh, skipping API call
[api] [TokenJob] Tokens for Ethereum are fresh, skipping API call
[api] {"timestamp":"2026-01-19T09:41:24.780Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Trending casts are fresh, skipping Snapchain API call
[api] [MarketJob] Protocols are fresh, skipping API call
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [TokenJob] Tokens for Solana are fresh, skipping API call
[api] {"level":30,"time":1768815692566,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54482},"msg":"incoming request"}
[api] {"level":30,"time":1768815692573,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","res":{"statusCode":204},"responseTime":6.26349999755621,"msg":"request completed"}
[api] {"level":30,"time":1768815692576,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54482},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] [TokenJob] Tokens for Base are fresh, skipping API call
[api] [TokenJob] Tokens for BSC are fresh, skipping API call
[api] {"timestamp":"2026-01-19T09:41:40.965Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"86bc0309-82d5-4911-b357-460fb1f54cf0","address":"0x0129614474d4b1df7053cc18c4e1cb646c563332"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:41:40.978Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"86bc0309-82d5-4911-b357-460fb1f54cf0","address":"0x01af27cd29eaab7392039c9fae18a5c86938b96a"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:41:40.980Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"86bc0309-82d5-4911-b357-460fb1f54cf0","address":"0x0077ae08200c05af9741b38366e26f7b1e7bfe2d"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:41:40.986Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"86bc0309-82d5-4911-b357-460fb1f54cf0","address":"0x04acf03e000f1e982d619c7f40c75ffa32303c77"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:41:42.201Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"86bc0309-82d5-4911-b357-460fb1f54cf0","address":"0x07d3eab4cb4e030722cfa848f6059cff839b7d61"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:41:42.207Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"86bc0309-82d5-4911-b357-460fb1f54cf0","address":"0x06943fe338e9e6d9df904b42ee0bc1d212e2c955"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:41:42.699Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"86bc0309-82d5-4911-b357-460fb1f54cf0","address":"0x1596d5e13ff436897ffe83c12e955b4f4f11c47f"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:41:42.708Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"86bc0309-82d5-4911-b357-460fb1f54cf0","address":"0x18a1c2f95ff8e7b87804067d3aa6f7e125ba1ad9"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:41:42.711Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"86bc0309-82d5-4911-b357-460fb1f54cf0","address":"0x0f689993a73351104ae69465a77759555e48bf2c"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:41:43.486Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"86bc0309-82d5-4911-b357-460fb1f54cf0","address":"0x2107bdfb49d6812d791bd5d3de583db4eb8be02e"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:41:43.490Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"86bc0309-82d5-4911-b357-460fb1f54cf0","address":"0x1e358596f48420fe4cd147dcc850661632125e21"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:41:43.739Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"86bc0309-82d5-4911-b357-460fb1f54cf0","status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x2107bdfb49d6812d791bd5d3de583db4eb8be02e/pools"},"service":"kiko-api","env":"production"}
[api] [TokenJob] Tokens for Arbitrum are fresh, skipping API call
[api] {"timestamp":"2026-01-19T09:41:46.353Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"86bc0309-82d5-4911-b357-460fb1f54cf0","status":404,"statusText":"Not Found","error":"{\"errors\":[{\"status\":\"404\",\"title\":\"Not Found\"}],\"meta\":{\"ref_id\":\"c35e9ba0-d6bb-4fd2-8d3c-2f3575fc9ffc\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1e358596f48420fe4cd147dcc850661632125e21/pools?include=base_token,quote_token","address":"0x1e358596f48420fe4cd147dcc850661632125e21","network":"base"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768815706409,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","res":{"statusCode":200},"responseTime":13833.578042000532,"msg":"request completed"}
[api] [TokenJob] Tokens for Optimism are fresh, skipping API call
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:41:54.787Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [TokenJob] Tokens for Polygon are fresh, skipping API call
[api] [TokenJob] Refreshed 7 chains in 30.0s
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:42:24.792Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:42:54.806Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768815798791,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkyj4t2000110ulai381exs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55005},"msg":"incoming request"}
[api] {"level":30,"time":1768815798792,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","res":{"statusCode":204},"responseTime":0.6292499974370003,"msg":"request completed"}
[api] {"level":30,"time":1768815798795,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","req":{"method":"GET","url":"/api/chat/sessions/cmkkyj4t2000110ulai381exs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55005},"msg":"incoming request"}
[api] {"level":30,"time":1768815798814,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","res":{"statusCode":200},"responseTime":19.52666600048542,"msg":"request completed"}
[api] {"level":30,"time":1768815798832,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55005},"msg":"incoming request"}
[api] {"level":30,"time":1768815798833,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","res":{"statusCode":204},"responseTime":0.46595900133252144,"msg":"request completed"}
[api] {"level":30,"time":1768815798836,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55005},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1768815800412,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55014},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1768815804333,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55055},"msg":"incoming request"}
[api] {"level":30,"time":1768815804335,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","res":{"statusCode":204},"responseTime":1.927207998931408,"msg":"request completed"}
[api] {"level":30,"time":1768815804336,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55055},"msg":"incoming request"}
[api] {"level":30,"time":1768815804342,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","req":{"method":"OPTIONS","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55056},"msg":"incoming request"}
[api] {"level":30,"time":1768815804343,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","res":{"statusCode":204},"responseTime":0.37141599878668785,"msg":"request completed"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=What’s that token 0x...
[api] {"level":30,"time":1768815804345,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55057},"msg":"incoming request"}
[api] {"level":30,"time":1768815804346,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","res":{"statusCode":204},"responseTime":0.4861669987440109,"msg":"request completed"}
[api] {"level":30,"time":1768815804346,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","req":{"method":"POST","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55056},"msg":"incoming request"}
[api] {"level":30,"time":1768815804347,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55057},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] {"level":30,"time":1768815804350,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","res":{"statusCode":200},"responseTime":13.869167000055313,"msg":"request completed"}
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1768815804354,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","res":{"statusCode":200},"responseTime":7.7242919988930225,"msg":"request completed"}
[api] {"level":30,"time":1768815804356,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkz9dj1000111ji0fqbr2gk","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55055},"msg":"incoming request"}
[api] {"level":30,"time":1768815804356,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","res":{"statusCode":204},"responseTime":0.24974999949336052,"msg":"request completed"}
[api] {"level":30,"time":1768815804357,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","req":{"method":"GET","url":"/api/chat/sessions/cmkkz9dj1000111ji0fqbr2gk","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55056},"msg":"incoming request"}
[api] {"level":30,"time":1768815804367,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","res":{"statusCode":200},"responseTime":9.673041000962257,"msg":"request completed"}
[api] {"level":30,"time":1768815804370,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkz9dj1000111ji0fqbr2gk/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55055},"msg":"incoming request"}
[api] {"level":30,"time":1768815804370,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","res":{"statusCode":204},"responseTime":0.34429099783301353,"msg":"request completed"}
[api] {"level":30,"time":1768815804371,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","req":{"method":"POST","url":"/api/chat/sessions/cmkkz9dj1000111ji0fqbr2gk/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55056},"msg":"incoming request"}
[api] {"level":30,"time":1768815804418,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","res":{"statusCode":200},"responseTime":46.907999999821186,"msg":"request completed"}
[api] {"level":30,"time":1768815804428,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55055},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:43:24.810Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Running task cmkkz9dkq000911ji082djknp for session cmkkz9dj1000111ji0fqbr2gk
[api] {"timestamp":"2026-01-19T09:43:25.929Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:43:25.930Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:43:25.932Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[python] INFO:moderation.router:Moderating input: What’s that token 0x3dA7Ad8101bc1fc0C80E2860Be9A53...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:55071 - "POST /moderation/input HTTP/1.1" 200 OK
[api] {"timestamp":"2026-01-19T09:43:27.397Z","level":"INFO","code":"SYS-1007","message":"Moderation Input check result","metadata":{"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:43:27.399Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok: Sent message_start for cmkkz9dkp000711jiuesti4nn
[api] {"timestamp":"2026-01-19T09:43:27.399Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:43:27.403Z","level":"INFO","code":"SYS-1007","message":"ToolPreRouter: Category matched","metadata":{"category":"0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}","tools":["get_token_info","web_search","prepare_swap_transaction","check_token_risk","get_early_buyers","analyze_creator"]},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok base filtered to 6 tools for message: "What’s that token 0x3dA7Ad8101bc1fc0C80E2860Be9A53..."
[api] {"timestamp":"2026-01-19T09:43:28.461Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"ac380902-ab2d-4c25-9103-2c0395a20d54","address":"0x1e358596f48420fe4cd147dcc850661632125e21"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:43:29.175Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"ac380902-ab2d-4c25-9103-2c0395a20d54","address":"0x2c12fabe87b10dfdf9674d2e409130b5a79ad88c"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:43:29.183Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"ac380902-ab2d-4c25-9103-2c0395a20d54","address":"0x2c85854a16a5400e002e16ce7a0d4d733a0b7faa"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:43:29.563Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"ac380902-ab2d-4c25-9103-2c0395a20d54","status":404,"statusText":"Not Found","error":"{\"errors\":[{\"status\":\"404\",\"title\":\"Not Found\"}],\"meta\":{\"ref_id\":\"8cf2816d-a1b7-4191-b431-9d77b5e6b197\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1e358596f48420fe4cd147dcc850661632125e21/pools?include=base_token,quote_token","address":"0x1e358596f48420fe4cd147dcc850661632125e21","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:43:30.667Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"ac380902-ab2d-4c25-9103-2c0395a20d54","address":"0x35ce2d60f6d569afb0666a54bc4c7f9d0a333036"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:43:31.457Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"ac380902-ab2d-4c25-9103-2c0395a20d54","address":"0x3fc63cb55dd2f2d14bb9a581ebee1a43ea668b76"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:43:31.506Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"ac380902-ab2d-4c25-9103-2c0395a20d54","address":"0x4709ac37a7e3f97aec93796db2a214339b03c7c7"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:43:31.785Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"c92b0c0a-443d-40f1-98cf-ae725db416c4","address":"0x1e358596f48420fe4cd147dcc850661632125e21"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:43:32.041Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"c92b0c0a-443d-40f1-98cf-ae725db416c4","status":404,"statusText":"Not Found","error":"{\"errors\":[{\"status\":\"404\",\"title\":\"Not Found\"}],\"meta\":{\"ref_id\":\"8cf2816d-a1b7-4191-b431-9d77b5e6b197\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1e358596f48420fe4cd147dcc850661632125e21/pools?include=base_token,quote_token","address":"0x1e358596f48420fe4cd147dcc850661632125e21","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:43:32.375Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"ac380902-ab2d-4c25-9103-2c0395a20d54","address":"0x4d1aa95f03042718cf489415b999bffb28b3d376"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:43:32.415Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"ac380902-ab2d-4c25-9103-2c0395a20d54","address":"0x4f38ce38be7c33cc693f8ae3aa7e24f33a493721"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768815812879,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","res":{"statusCode":200},"responseTime":8531.250250000507,"msg":"request completed"}
[api] {"level":30,"time":1768815812879,"pid":20128,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","res":{"statusCode":200},"responseTime":8450.418917000294,"msg":"request completed"}
[Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] {"timestamp":"2026-01-19T09:43:56.921Z","level":"INFO","code":"SYS-1001","message":"Zora SDK initialized with API Key","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Found user list at: /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
[api] [SkillRegistry] Loading skills...
[api] [SkillRegistry] Loaded skill: copy_trade
[api] [SkillRegistry] Loaded skill: market_macro
[api] [SkillRegistry] Loaded skill: polymarket_prediction
[api] [SkillRegistry] Loaded skill: risk_security
[api] [SkillRegistry] Loaded skill: social_farcaster
[api] [SkillRegistry] Loaded skill: swap
[api] [SkillRegistry] Loaded skill: token_analysis
[api] [SkillRegistry] Loaded skill: wallet_portfolio
[api] [SkillRegistry] Loaded skill: zora_nfts
[api] {"timestamp":"2026-01-19T09:43:57.326Z","level":"WARN","code":"SYS-1001","message":"Public folder not found - skipping static file serving","metadata":{"path":"/Users/almurat/KiKo/kiko-api/public"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:43:57.328Z","level":"INFO","code":"SYS-1001","message":"Initializing services...","metadata":{"env":"production","port":3001,"database":"configured","privy":"✅ Configured"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:43:57.340Z","level":"INFO","code":"SYS-1004","message":"Database connection successful","metadata":{},"service":"kiko-api","env":"production"}
[api] [DataRetention] Checking retention policies...
[api] [Prisma] DB connection is healthy
[api] [DataRetention] Starting cleanup job...
[api] [Redis] Connected successfully
[api] {"timestamp":"2026-01-19T09:43:57.362Z","level":"INFO","code":"SYS-1005","message":"Redis initialized","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:43:57.362Z","level":"INFO","code":"SYS-1001","message":"Starting server on port 3001...","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768815837384,"pid":20161,"hostname":"almuratdeMacBook-Pro.local","msg":"Server listening at http://0.0.0.0:3001"}
[api] {"timestamp":"2026-01-19T09:43:57.384Z","level":"INFO","code":"SYS-1001","message":"Server listening","metadata":{"url":"http://localhost:3001","health":"http://localhost:3001/health"},"service":"kiko-api","env":"production"}
[api] [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
[api] [TokenJob] Scheduled: Every 5min (Ethereum, Solana, Base, BSC, Arbitrum, Optimism, Polygon)
[api] [SocialJob] Scheduled: Every 10min
[api] {"timestamp":"2026-01-19T09:43:57.397Z","level":"INFO","code":"SYS-1001","message":"Background jobs started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:43:57.397Z","level":"INFO","code":"SYS-1001","message":"Initializing auto trade service...","metadata":{},"service":"kiko-api","env":"production"}
[api] [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
[api] {"timestamp":"2026-01-19T09:43:57.397Z","level":"INFO","code":"SYS-1001","message":"Auto trade service initialized (Solana watcher + EVM webhook enabled)","metadata":{"mode":"hybrid"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:43:57.397Z","level":"INFO","code":"SYS-1001","message":"Auto trade service started","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] Starting position monitor (every 30s)...
[api] {"timestamp":"2026-01-19T09:43:57.397Z","level":"INFO","code":"SYS-1001","message":"Position monitor started","metadata":{},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Started polling for AI tasks (interval: 3000ms)
[api] {"timestamp":"2026-01-19T09:43:57.397Z","level":"INFO","code":"SYS-1001","message":"Chat worker started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:43:57.397Z","level":"INFO","code":"SYS-1001","message":"🎉 All services initialized!","metadata":{},"service":"kiko-api","env":"production"}
[api] [DataRetention] Cleanup job completed.
[api] {"level":30,"time":1768815838554,"pid":20161,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWtoenc0aGMwMXJpZ3EwY3Zwc3ppZGQ2IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3Njg4MTU0MTQsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc2ODgxOTAxNH0.PX3csR9tJ_vMna3q7x9SzNjY9IpWK7chhp2IhnkKK5EEXEbxePpeefrwbOFaw34V5Y1Ly4UHex--m3BBlSmI2A","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55241},"msg":"incoming request"}
[api] {"timestamp":"2026-01-19T09:43:58.567Z","level":"INFO","code":"WS-8001","message":"ChatWS Client connected","metadata":{"traceId":"687959c5-668e-4180-a8ed-198a50f53fe0","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1},"service":"kiko-api","env":"production"}
[api] [MarketJob] Running startup staleness check...
[api] [PositionMonitor] 🔄 Running position check...
[api] [MarketJob] Overview is fresh, skipping API call
[api] [TokenJob] Tokens for Ethereum are fresh, skipping API call
[api] {"timestamp":"2026-01-19T09:44:02.409Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Trending casts are fresh, skipping Snapchain API call
[api] [MarketJob] Protocols are fresh, skipping API call
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [TokenJob] Tokens for Solana are fresh, skipping API call
[api] [TokenJob] Tokens for Base are fresh, skipping API call
[api] [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:44:17.421Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"bsc","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:44:18.914Z","level":"INFO","code":"WTC-2002","message":"Found addresses via WebSocket","metadata":{"count":194,"chain":"bsc"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:44:23.235Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":33,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:44:25.800Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"选择大于努力","liquidity":0},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:44:32.415Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x2: API-5001:Skipping low liquidity token","timestamp":"2026-01-19T09:44:33.456Z","metadata":{}}
[api] {"timestamp":"2026-01-19T09:44:33.456Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"WoD","liquidity":571.6691},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:44:33.456Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"bsc","count":123,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:44:33.456Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"bsc","durationMs":16035},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for BSC
[api] Saved 100 trending tokens for bsc to database and memory cache
[api] [TokenJob] Saved 100 tokens for BSC to DB + cache
[api] [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:44:38.489Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"arbitrum","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:44:38.489Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:44:43.689Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":7,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:44:44.941Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"ETH","liquidity":1.9254},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768815889499,"pid":20161,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55511},"msg":"incoming request"}
[api] {"level":30,"time":1768815889503,"pid":20161,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","res":{"statusCode":204},"responseTime":3.0722500011324883,"msg":"request completed"}
[api] {"level":30,"time":1768815889504,"pid":20161,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55511},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x3: API-5001:Skipping low liquidity token","timestamp":"2026-01-19T09:44:50.673Z","metadata":{}}
[api] {"timestamp":"2026-01-19T09:44:50.673Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"STG","liquidity":258.3738},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:44:51.983Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/arbitrum/trending_pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:44:54.886Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"arbitrum","count":62,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:44:54.886Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":66,"chain":"arbitrum","durationMs":16397},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 66 trending tokens for Arbitrum
[api] Saved 66 trending tokens for arbitrum to database and memory cache
[api] [TokenJob] Saved 66 tokens for Arbitrum to DB + cache
[api] [TokenJob] Fetching trending tokens for Optimism via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:44:59.916Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"optimism","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:44:59.916Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:45:00.510Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"ethereum","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:00.510Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:01.776Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e","address":"0x0129614474d4b1df7053cc18c4e1cb646c563332"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:01.791Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e","address":"0x01af27cd29eaab7392039c9fae18a5c86938b96a"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:01.828Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e","address":"0x0077ae08200c05af9741b38366e26f7b1e7bfe2d"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:01.844Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e","address":"0x04acf03e000f1e982d619c7f40c75ffa32303c77"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:45:02.420Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x2: API-5004:External API requested retry","timestamp":"2026-01-19T09:45:02.743Z","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e"}}
[api] {"timestamp":"2026-01-19T09:45:02.743Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e","status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x01af27cd29eaab7392039c9fae18a5c86938b96a/pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:03.675Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":12,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:04.428Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":23,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:06.543Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x04acf03e000f1e982d619c7f40c75ffa32303c77/pools?include=base_token,quote_token","address":"0x04acf03e000f1e982d619c7f40c75ffa32303c77","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:06.547Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x0077ae08200c05af9741b38366e26f7b1e7bfe2d/pools?include=base_token,quote_token","address":"0x0077ae08200c05af9741b38366e26f7b1e7bfe2d","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:07.025Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e","address":"0x07d3eab4cb4e030722cfa848f6059cff839b7d61"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:07.027Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e","address":"0x06943fe338e9e6d9df904b42ee0bc1d212e2c955"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:08.463Z","level":"ERROR","code":"API-5002","message":"API error on trending page","metadata":{"page":2,"status":429,"statusText":"Too Many Requests"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:08.464Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"optimism","count":6,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:08.464Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":16,"chain":"optimism","durationMs":8548},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 16 trending tokens for Optimism
[api] {"timestamp":"2026-01-19T09:45:08.468Z","level":"ERROR","code":"API-5002","message":"API error on trending page","metadata":{"page":1,"status":429,"statusText":"Too Many Requests"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:08.468Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"eth","count":0,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:08.468Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":23,"chain":"ethereum","durationMs":7958},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 23 trending tokens for Ethereum
[api] Saved 16 trending tokens for optimism to database and memory cache
[api] [TokenJob] Saved 16 tokens for Optimism to DB + cache
[api] Saved 23 trending tokens for eth to database and memory cache
[api] [TokenJob] Saved 23 tokens for Ethereum to DB + cache
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x17: API-5004:External API requested retry","timestamp":"2026-01-19T09:45:08.517Z","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e"}}
[api] {"timestamp":"2026-01-19T09:45:08.517Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e","status":429,"attempt":2,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x06943fe338e9e6d9df904b42ee0bc1d212e2c955/pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:11.012Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x06943fe338e9e6d9df904b42ee0bc1d212e2c955/pools?include=base_token,quote_token","address":"0x06943fe338e9e6d9df904b42ee0bc1d212e2c955","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:11.341Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e","address":"0x1596d5e13ff436897ffe83c12e955b4f4f11c47f"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:11.344Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e","address":"0x18a1c2f95ff8e7b87804067d3aa6f7e125ba1ad9"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:11.384Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e","address":"0x0f689993a73351104ae69465a77759555e48bf2c"},"service":"kiko-api","env":"production"}
[api] [TokenJob] Fetching trending tokens for Polygon via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:45:13.479Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"polygon","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:13.479Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:45:13.481Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"solana","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:13.481Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x7: API-5004:External API requested retry","timestamp":"2026-01-19T09:45:14.126Z","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e"}}
[api] {"timestamp":"2026-01-19T09:45:14.126Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e","status":429,"attempt":3,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x0f689993a73351104ae69465a77759555e48bf2c/pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:15.386Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x0f689993a73351104ae69465a77759555e48bf2c/pools?include=base_token,quote_token","address":"0x0f689993a73351104ae69465a77759555e48bf2c","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:15.728Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e","address":"0x2107bdfb49d6812d791bd5d3de583db4eb8be02e"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:16.424Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e","address":"0x1e358596f48420fe4cd147dcc850661632125e21"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:16.958Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":20,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:18.628Z","level":"ERROR","code":"API-5002","message":"API error on trending page","metadata":{"page":1,"status":404,"statusText":"Not Found"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:18.628Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"polygon","count":0,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:18.628Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":18,"chain":"polygon","durationMs":5149},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 18 trending tokens for Polygon
[api] Saved 18 trending tokens for polygon to database and memory cache
[api] [TokenJob] Saved 18 tokens for Polygon to DB + cache
[api] [TokenJob] Refreshed 7 chains in 76.2s
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x6: API-5004:External API requested retry","timestamp":"2026-01-19T09:45:19.176Z","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e"}}
[api] {"timestamp":"2026-01-19T09:45:19.177Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e","status":429,"attempt":3,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1e358596f48420fe4cd147dcc850661632125e21/pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:19.871Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":127,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:45:19.871Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"solana","durationMs":6390},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for Solana
[api] Saved 100 trending tokens for solana to database and memory cache
[api] [TokenJob] Saved 100 tokens for Solana to DB + cache
[api] {"timestamp":"2026-01-19T09:45:20.428Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"7449043e-e5c2-4279-9892-242f90faea5e","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing[Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] {"timestamp":"2026-01-19T09:47:34.767Z","level":"INFO","code":"SYS-1001","message":"Zora SDK initialized with API Key","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Found user list at: /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
[api] [SkillRegistry] Loading skills...
[api] [SkillRegistry] Loaded skill: copy_trade
[api] [SkillRegistry] Loaded skill: market_macro
[api] [SkillRegistry] Loaded skill: polymarket_prediction
[api] [SkillRegistry] Loaded skill: risk_security
[api] [SkillRegistry] Loaded skill: social_farcaster
[api] [SkillRegistry] Loaded skill: swap
[api] [SkillRegistry] Loaded skill: token_analysis
[api] [SkillRegistry] Loaded skill: wallet_portfolio
[api] [SkillRegistry] Loaded skill: zora_nfts
[api] {"timestamp":"2026-01-19T09:47:35.117Z","level":"WARN","code":"SYS-1001","message":"Public folder not found - skipping static file serving","metadata":{"path":"/Users/almurat/KiKo/kiko-api/public"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:47:35.119Z","level":"INFO","code":"SYS-1001","message":"Initializing services...","metadata":{"env":"production","port":3001,"database":"configured","privy":"✅ Configured"},"service":"kiko-api","env":"production"}
[api] [Prisma] DB connection is healthy
[api] {"timestamp":"2026-01-19T09:47:35.138Z","level":"INFO","code":"SYS-1004","message":"Database connection successful","metadata":{},"service":"kiko-api","env":"production"}
[api] [DataRetention] Checking retention policies...
[api] [DataRetention] Starting cleanup job...
[api] [Redis] Connected successfully
[api] {"timestamp":"2026-01-19T09:47:35.147Z","level":"INFO","code":"SYS-1005","message":"Redis initialized","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:47:35.147Z","level":"INFO","code":"SYS-1001","message":"Starting server on port 3001...","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816055166,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","msg":"Server listening at http://0.0.0.0:3001"}
[api] {"timestamp":"2026-01-19T09:47:35.167Z","level":"INFO","code":"SYS-1001","message":"Server listening","metadata":{"url":"http://localhost:3001","health":"http://localhost:3001/health"},"service":"kiko-api","env":"production"}
[api] [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
[api] [TokenJob] Scheduled: Every 5min (Ethereum, Solana, Base, BSC, Arbitrum, Optimism, Polygon)
[api] [SocialJob] Scheduled: Every 10min
[api] {"timestamp":"2026-01-19T09:47:35.178Z","level":"INFO","code":"SYS-1001","message":"Background jobs started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:47:35.178Z","level":"INFO","code":"SYS-1001","message":"Initializing auto trade service...","metadata":{},"service":"kiko-api","env":"production"}
[api] [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
[api] {"timestamp":"2026-01-19T09:47:35.178Z","level":"INFO","code":"SYS-1001","message":"Auto trade service initialized (Solana watcher + EVM webhook enabled)","metadata":{"mode":"hybrid"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:47:35.178Z","level":"INFO","code":"SYS-1001","message":"Auto trade service started","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] Starting position monitor (every 30s)...
[api] {"timestamp":"2026-01-19T09:47:35.178Z","level":"INFO","code":"SYS-1001","message":"Position monitor started","metadata":{},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Started polling for AI tasks (interval: 3000ms)
[api] {"timestamp":"2026-01-19T09:47:35.178Z","level":"INFO","code":"SYS-1001","message":"Chat worker started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:47:35.178Z","level":"INFO","code":"SYS-1001","message":"🎉 All services initialized!","metadata":{},"service":"kiko-api","env":"production"}
[api] [DataRetention] Cleanup job completed.
[api] {"level":30,"time":1768816056421,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWtoenc0aGMwMXJpZ3EwY3Zwc3ppZGQ2IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3Njg4MTU0MTQsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc2ODgxOTAxNH0.PX3csR9tJ_vMna3q7x9SzNjY9IpWK7chhp2IhnkKK5EEXEbxePpeefrwbOFaw34V5Y1Ly4UHex--m3BBlSmI2A","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":56345},"msg":"incoming request"}
[api] {"timestamp":"2026-01-19T09:47:36.432Z","level":"INFO","code":"WS-8001","message":"ChatWS Client connected","metadata":{"traceId":"b4fd16c4-72cd-4b01-9eba-535b300c2db4","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1},"service":"kiko-api","env":"production"}
[api] [MarketJob] Running startup staleness check...
[api] [PositionMonitor] 🔄 Running position check...
[api] [MarketJob] Overview is fresh, skipping API call
[api] [TokenJob] Tokens for Ethereum are fresh, skipping API call
[api] [Job] ✅ Loaded 436 real hot users from /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Job] ✅ Using 436 real hot users from analysis
[api] [SocialJob] fetchCastsFromUsers starting with 436 FIDs, target: 500
[api] [MarketJob] Protocols are fresh, skipping API call
[api] {"timestamp":"2026-01-19T09:47:40.244Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [TokenJob] Tokens for Solana are fresh, skipping API call
[api] [TokenJob] Tokens for Base are fresh, skipping API call
[api] [TokenJob] Tokens for BSC are fresh, skipping API call
[api] [TokenJob] Tokens for Arbitrum are fresh, skipping API call
[api] [TokenJob] Tokens for Optimism are fresh, skipping API call
[api] [TokenJob] Tokens for Polygon are fresh, skipping API call
[api] [TokenJob] Refreshed 7 chains in 30.1s
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:48:10.248Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816115235,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkz9dj1000111ji0fqbr2gk","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57573},"msg":"incoming request"}
[api] {"level":30,"time":1768816115239,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","res":{"statusCode":204},"responseTime":3.108042001724243,"msg":"request completed"}
[api] {"level":30,"time":1768816115241,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","req":{"method":"GET","url":"/api/chat/sessions/cmkkz9dj1000111ji0fqbr2gk","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57573},"msg":"incoming request"}
[api] {"level":30,"time":1768816115252,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57574},"msg":"incoming request"}
[api] {"level":30,"time":1768816115252,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","res":{"statusCode":204},"responseTime":0.6675000004470348,"msg":"request completed"}
[api] {"level":30,"time":1768816115256,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57574},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1768816116332,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","res":{"statusCode":200},"responseTime":1090.4695420004427,"msg":"request completed"}
[api] {"level":30,"time":1768816120205,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","req":{"method":"GET","url":"/api/config/auth-key-id","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57573},"msg":"incoming request"}
[api] {"level":30,"time":1768816120208,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","res":{"statusCode":200},"responseTime":2.2577909976243973,"msg":"request completed"}
[api] {"level":30,"time":1768816120209,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWtoenc0aGMwMXJpZ3EwY3Zwc3ppZGQ2IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3Njg4MTU0MTQsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc2ODgxOTAxNH0.PX3csR9tJ_vMna3q7x9SzNjY9IpWK7chhp2IhnkKK5EEXEbxePpeefrwbOFaw34V5Y1Ly4UHex--m3BBlSmI2A","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57617},"msg":"incoming request"}
[api] {"timestamp":"2026-01-19T09:48:40.212Z","level":"INFO","code":"WS-8001","message":"ChatWS Client connected","metadata":{"traceId":"359e372c-8c4f-464c-aaa7-db284a8378cd","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816120214,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","req":{"method":"OPTIONS","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57573},"msg":"incoming request"}
[api] {"level":30,"time":1768816120214,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","res":{"statusCode":204},"responseTime":0.4812909997999668,"msg":"request completed"}
[api] {"level":30,"time":1768816120215,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57620},"msg":"incoming request"}
[api] {"level":30,"time":1768816120217,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","req":{"method":"GET","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57573},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] {"level":30,"time":1768816120223,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","res":{"statusCode":200},"responseTime":5.439332999289036,"msg":"request completed"}
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:48:40.253Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816121166,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkz9dj1000111ji0fqbr2gk","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57573},"msg":"incoming request"}
[api] {"level":30,"time":1768816121167,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","res":{"statusCode":204},"responseTime":1.2600839994847775,"msg":"request completed"}
[api] {"level":30,"time":1768816121169,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","req":{"method":"DELETE","url":"/api/chat/sessions/cmkkz9dj1000111ji0fqbr2gk","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57573},"msg":"incoming request"}
[api] {"level":30,"time":1768816121181,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","res":{"statusCode":200},"responseTime":11.501082997769117,"msg":"request completed"}
[api] {"level":30,"time":1768816121515,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57573},"msg":"incoming request"}
[api] {"level":30,"time":1768816121517,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","res":{"statusCode":204},"responseTime":0.9296669997274876,"msg":"request completed"}
[api] {"level":30,"time":1768816121519,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57573},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"timestamp":"2026-01-19T09:48:45.038Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"701c7c94-5009-4f91-ab38-9303b5c41a05","address":"0x0129614474d4b1df7053cc18c4e1cb646c563332"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:48:45.057Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"701c7c94-5009-4f91-ab38-9303b5c41a05","address":"0x01af27cd29eaab7392039c9fae18a5c86938b96a"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:48:45.083Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"701c7c94-5009-4f91-ab38-9303b5c41a05","address":"0x04acf03e000f1e982d619c7f40c75ffa32303c77"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:48:45.092Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"701c7c94-5009-4f91-ab38-9303b5c41a05","address":"0x0077ae08200c05af9741b38366e26f7b1e7bfe2d"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:48:46.604Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"701c7c94-5009-4f91-ab38-9303b5c41a05","address":"0x06943fe338e9e6d9df904b42ee0bc1d212e2c955"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:48:46.606Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"701c7c94-5009-4f91-ab38-9303b5c41a05","address":"0x07d3eab4cb4e030722cfa848f6059cff839b7d61"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816127365,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57667},"msg":"incoming request"}
[api] {"level":30,"time":1768816127367,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","res":{"statusCode":204},"responseTime":1.909000001847744,"msg":"request completed"}
[api] {"level":30,"time":1768816127368,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57667},"msg":"incoming request"}
[api] {"level":30,"time":1768816127375,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","req":{"method":"OPTIONS","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57668},"msg":"incoming request"}
[api] {"level":30,"time":1768816127376,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","res":{"statusCode":204},"responseTime":0.6382080018520355,"msg":"request completed"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=What’s that token 0x...
[api] {"level":30,"time":1768816127379,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57669},"msg":"incoming request"}
[api] {"level":30,"time":1768816127379,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","res":{"statusCode":204},"responseTime":0.3315420001745224,"msg":"request completed"}
[api] {"level":30,"time":1768816127380,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","req":{"method":"POST","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57668},"msg":"incoming request"}
[api] {"level":30,"time":1768816127382,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57669},"msg":"incoming request"}
[api] {"level":30,"time":1768816127385,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","res":{"statusCode":200},"responseTime":16.26750000193715,"msg":"request completed"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] {"level":30,"time":1768816127387,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","res":{"statusCode":200},"responseTime":6.972291000187397,"msg":"request completed"}
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"timestamp":"2026-01-19T09:48:47.390Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"701c7c94-5009-4f91-ab38-9303b5c41a05","address":"0x18a1c2f95ff8e7b87804067d3aa6f7e125ba1ad9"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816127391,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkzgas80001aydx1myq35f1","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57667},"msg":"incoming request"}
[api] {"level":30,"time":1768816127392,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","res":{"statusCode":204},"responseTime":0.7086660005152225,"msg":"request completed"}
[api] {"level":30,"time":1768816127400,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","req":{"method":"GET","url":"/api/chat/sessions/cmkkzgas80001aydx1myq35f1","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57668},"msg":"incoming request"}
[api] {"timestamp":"2026-01-19T09:48:47.407Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"701c7c94-5009-4f91-ab38-9303b5c41a05","address":"0x0f689993a73351104ae69465a77759555e48bf2c"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816127409,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","res":{"statusCode":200},"responseTime":8.570333000272512,"msg":"request completed"}
[api] {"level":30,"time":1768816127411,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkzgas80001aydx1myq35f1/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57667},"msg":"incoming request"}
[api] {"level":30,"time":1768816127412,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","res":{"statusCode":204},"responseTime":0.12629200145602226,"msg":"request completed"}
[api] {"level":30,"time":1768816127416,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","req":{"method":"POST","url":"/api/chat/sessions/cmkkzgas80001aydx1myq35f1/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57668},"msg":"incoming request"}
[api] {"timestamp":"2026-01-19T09:48:47.453Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"701c7c94-5009-4f91-ab38-9303b5c41a05","address":"0x1596d5e13ff436897ffe83c12e955b4f4f11c47f"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816127457,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","res":{"statusCode":200},"responseTime":41.643125001341105,"msg":"request completed"}
[api] {"level":30,"time":1768816127464,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57667},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"timestamp":"2026-01-19T09:48:48.170Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"701c7c94-5009-4f91-ab38-9303b5c41a05","address":"0x1e358596f48420fe4cd147dcc850661632125e21"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:48:48.224Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"701c7c94-5009-4f91-ab38-9303b5c41a05","address":"0x2107bdfb49d6812d791bd5d3de583db4eb8be02e"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:48:48.537Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"701c7c94-5009-4f91-ab38-9303b5c41a05","status":404,"statusText":"Not Found","error":"{\"errors\":[{\"status\":\"404\",\"title\":\"Not Found\"}],\"meta\":{\"ref_id\":\"a4b55d90-0a37-4a0a-860d-d665e399dbf9\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1e358596f48420fe4cd147dcc850661632125e21/pools?include=base_token,quote_token","address":"0x1e358596f48420fe4cd147dcc850661632125e21","network":"base"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816128616,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","res":{"statusCode":200},"responseTime":7097.346249997616,"msg":"request completed"}
[api] {"level":30,"time":1768816128617,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","res":{"statusCode":200},"responseTime":8401.543625000864,"msg":"request completed"}
[api] [ChatWorker] Running task cmkkzgau20009aydxa19d6vsh for session cmkkzgas80001aydx1myq35f1
[api] {"timestamp":"2026-01-19T09:48:50.299Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:48:50.300Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:48:50.303Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[python] INFO:moderation.router:Moderating input: What’s that token 0x3dA7Ad8101bc1fc0C80E2860Be9A53...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] [Generate] Starting generator
[python] INFO:     127.0.0.1:57745 - "POST /moderation/input HTTP/1.1" 200 OK
[api] {"timestamp":"2026-01-19T09:48:52.157Z","level":"INFO","code":"SYS-1007","message":"Moderation Input check result","metadata":{"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:48:52.159Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok: Sent message_start for cmkkzgatu0007aydxbi46j17m
[api] {"timestamp":"2026-01-19T09:48:52.159Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:48:52.162Z","level":"INFO","code":"SYS-1007","message":"ToolPreRouter: Category matched","metadata":{"category":"0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}","tools":["get_token_info","web_search","prepare_swap_transaction","check_token_risk","get_early_buyers","analyze_creator"]},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok base filtered to 6 tools for message: "What’s that token 0x3dA7Ad8101bc1fc0C80E2860Be9A53..."
[api] {"timestamp":"2026-01-19T09:48:53.275Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5089a048-9906-488b-8883-3dee0c1cbb3a","address":"0x1e358596f48420fe4cd147dcc850661632125e21"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:48:53.371Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5089a048-9906-488b-8883-3dee0c1cbb3a","address":"0x2c12fabe87b10dfdf9674d2e409130b5a79ad88c"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:48:53.372Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5089a048-9906-488b-8883-3dee0c1cbb3a","address":"0x2c85854a16a5400e002e16ce7a0d4d733a0b7faa"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:48:54.260Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"5089a048-9906-488b-8883-3dee0c1cbb3a","status":404,"statusText":"Not Found","error":"{\"errors\":[{\"status\":\"404\",\"title\":\"Not Found\"}],\"meta\":{\"ref_id\":\"a4b55d90-0a37-4a0a-860d-d665e399dbf9\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1e358596f48420fe4cd147dcc850661632125e21/pools?include=base_token,quote_token","address":"0x1e358596f48420fe4cd147dcc850661632125e21","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:48:54.824Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5089a048-9906-488b-8883-3dee0c1cbb3a","address":"0x35ce2d60f6d569afb0666a54bc4c7f9d0a333036"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:48:55.640Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5089a048-9906-488b-8883-3dee0c1cbb3a","address":"0x3fc63cb55dd2f2d14bb9a581ebee1a43ea668b76"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:48:55.658Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5089a048-9906-488b-8883-3dee0c1cbb3a","address":"0x4709ac37a7e3f97aec93796db2a214339b03c7c7"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:48:56.451Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5089a048-9906-488b-8883-3dee0c1cbb3a","address":"0x4d1aa95f03042718cf489415b999bffb28b3d376"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:48:56.501Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5089a048-9906-488b-8883-3dee0c1cbb3a","address":"0x4f38ce38be7c33cc693f8ae3aa7e24f33a493721"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816136917,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","res":{"statusCode":200},"responseTime":9453.363000001758,"msg":"request completed"}
[api] {"level":30,"time":1768816136918,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","res":{"statusCode":200},"responseTime":9535.630208998919,"msg":"request completed"}
[api] {"timestamp":"2026-01-19T09:49:00.668Z","level":"INFO","code":"AI-6001","message":"Timer finished: intent_parsing_067197d6","metadata":{"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":true,"confidence":0.6214213562373094,"routingStage":"hybrid","labels":[{"label":"TRADING","confidence":0.6214213562373094},{"label":"MARKET_ANALYSIS","confidence":0.282842712474619},{"label":"RISK_SCAN","confidence":0.1414213562373095}],"durationMs":8505,"timerLabel":"intent_parsing_067197d6"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:49:00.674Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok skill-gated to 4 tools for intent=TRADING skills=swap, wallet_portfolio
[api] {"timestamp":"2026-01-19T09:49:00.675Z","level":"INFO","code":"AI-6006","message":"PromptOrchestrator: Intent matched skills","metadata":{"intent":"TRADING","count":2,"skills":["swap","wallet_portfolio"]},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:49:00.676Z","level":"INFO","code":"AI-6003","message":"Timer finished: prompt_gen_TRADING_grok","metadata":{"model":"grok","intent":"TRADING","length":24245,"durationMs":1,"timerLabel":"prompt_gen_TRADING_grok"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:49:00.676Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok: Detected contract address: 0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525
[api] {"timestamp":"2026-01-19T09:49:04.705Z","level":"INFO","code":"AI-6005","message":"Timer finished: launchpad_det_0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525","metadata":{"address":"0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525","chainId":8453,"found":false,"durationMs":2902,"timerLabel":"launchpad_det_0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:49:04.705Z","level":"INFO","code":"AI-6004","message":"Timer finished: find_token_any_0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525","metadata":{"address":"0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525","symbol":"$SXS","chain":"Base","durationMs":4028,"timerLabel":"find_token_any_0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok: Waiting for early pre-fetch to complete
[api] {"timestamp":"2026-01-19T09:49:04.705Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:49:04.711Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/embeddings "HTTP/1.1 200 OK"
[python] [Model] Original: grok-4-reasoning -> Normalized: grok-4-1-fast-reasoning
[python] [RAG] 🔍 Informational query detected: '[CONTEXT]
[python] - Current Time: 2026-01-19T09:49:04.711Z...'
[python] [RAG] ⚠️ Error retrieving from KnowledgeBase: Collection expecting embedding with dimension of 384, got 1536
[python] [Tools] Dynamic tool set from Node: 4 tool(s) (3 custom)
[python] [Chat] Creating chat with model: grok-4-1-fast-reasoning (original: grok-4-reasoning)
[python] [Chat] Creating chat with 4 tool(s): get_token_info, , prepare_swap_transaction, check_token_risk
[python] [Chat] Chat created
[python] [Messages] Adding 3 message(s) to chat
[python] [Messages] [1] System prompt from Node.js (length=24245 chars)
[python] [Messages] [2] User: [CONTEXT]
[python] - Current Time: 2026-01-19T09:49:04.711Z...
[python] [Messages] [3] Assistant: (skipped)
[python] [Chat] Starting streaming response generation
[python] [Tools] Custom tool allowlist size: 3
[python] INFO:     127.0.0.1:58022 - "POST /grok/v1/chat/completions HTTP/1.1" 200 OK
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:49:10.256Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816179089,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","req":{"method":"POST","url":"/api/ai/tools/execute","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58795},"msg":"incoming request"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:49:40.261Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [GetTokenInfo] Attempting DexScreener fallback...
[api] {"level":30,"time":1768816181322,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","res":{"statusCode":200},"responseTime":2232.031292002648,"msg":"request completed"}
[python] INFO:httpx:HTTP Request: POST http://localhost:3001/api/ai/tools/execute "HTTP/1.1 200 OK"
[api] [ChatWorker DEBUG] Stream line with valid data: data: {"id": "chatcmpl--1483708802102435087", "object": "chat.completion.chunk", "created": 1768816193, "model": "grok-4-reasoning", "choices": [{"index": 0, "delta": {}, "message": {"citations": []}, "finish_reason": "stop"}], "usage": {"prompt_tokens": 8076, "completion_tokens": 326, "total_tokens": 9237}}
[api] {"timestamp":"2026-01-19T09:49:53.666Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:49:53.666Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_citations","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"citations","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_citations"},"service":"kiko-api","env":"production"}
[python] INFO:moderation.router:Moderating input: $SXS (SessionX) on Base: Mid-cap meme-ish token at...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] [Generate] Starting generator
[python] [Tool Call] Detected in chunk: 1 tool(s)
[python] [Tool Call] get_token_info: {"address":"0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525","chain":"base"}...
[python] [Tool Call] Custom tool detected - buffered content will be discarded
[python] [Tool Call Event] Sending tool call event for get_token_info (ID: call_1768816179047585_-6300357276198198698)
[python] [Custom Tool] Executing get_token_info...
[python] [Tool Execution] Executing tool: get_token_info with args: {'address': '0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525', 'chain': 'base'}
[python] [Tool Execution] 🔍 KIKO_API_BASE = http://localhost:3001
[python] [Tool Execution] 🔍 Calling unified executor at: http://localhost:3001/api/ai/tools/execute
[python] [Custom Tool] get_token_info returned: 1141 chars
[python] [Custom Tool] Appending tool result to chat: {
[python]   "source": "DexScreener",
[python]   "address": "0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525",
[python]   "name": "S...
[python] [Custom Tool] Added tool result to chat, will call Grok again
[python] [Tool Call] Detected in chunk: 1 tool(s)
[python] [Tool Call] web_search: {"query":"0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525 base token","num_results":20}...
[python] [Tool Call] Built-in tool detected (web_search) - continuing stream
[python] [Tool Call Event] Sending tool call event for web_search (ID: call_1768816181325792_4206435976997118913)
[python] [Tool Call] web_search is a built-in tool, handled by xai-sdk
[python] [Tool Call] Detected in chunk: 1 tool(s)
[python] [Tool Call] web_search: {"query":"\"0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525\" OR $SXS OR \"SessionX\" site:x.com OR site:...
[python] [Tool Call] Built-in tool detected (web_search) - continuing stream
[python] [Tool Call Event] Sending tool call event for web_search (ID: call_1768816181326810_1419377923858751344)
[python] [Tool Call] web_search is a built-in tool, handled by xai-sdk
[python] [Tool Call] Detected in chunk: 1 tool(s)
[python] [Tool Call] web_search: {"query":"SessionX $SXS base crypto official website OR telegram OR discord","num_results":10}...
[python] [Tool Call] Built-in tool detected (web_search) - continuing stream
[python] [Tool Call Event] Sending tool call event for web_search (ID: call_1768816181778209_-866926719280468358)
[python] [Tool Call] web_search is a built-in tool, handled by xai-sdk
[python] [Tool Call] Detected in response (fallback): 4 tool(s)
[python] [Tool Call] Skipping duplicate: get_token_info (already processed)
[python] [Tool Call] Skipping duplicate: web_search (already processed)
[python] [Tool Call] Skipping duplicate: web_search (already processed)
[python] [Tool Call] Skipping duplicate: web_search (already processed)
[python] [Tool Call] Detected in response (fallback): 4 tool(s)
[python] [Tool Call] Skipping duplicate: get_token_info (already processed)
[python] [Tool Call] Skipping duplicate: web_search (already processed)
[python] [Tool Call] Skipping duplicate: web_search (already processed)
[python] [Tool Call] Skipping duplicate: web_search (already processed)
[python] [Tool Call] Detected in response (fallback): 4 tool(s)
[python] [Tool Call] Skipping duplicate: get_token_info (already processed)
[python] [Tool Call] Skipping duplicate: web_search (already processed)
[python] [Tool Call] Skipping duplicate: web_search (already processed)
[python] [Tool Call] Skipping duplicate: web_search (already processed)
[python] [Tool Call] Detected in response (fallback): 4 tool(s)
[python] [Tool Call] Skipping duplicate: get_token_info (already processed)
[python] [Tool Call] Skipping duplicate: web_search (already processed)
[python] [Tool Call] Skipping duplicate: web_search (already processed)
[python] [Tool Call] Skipping duplicate: web_search (already processed)
[python] [Tool Turn] Tool call detected, continuing to turn 2
[python] [Citations] No final response available
[python] [Citations] Final: No citations collected
[python] [Usage] Prompt: 8076, Completion: 326, Total: 9237
[python] INFO:     127.0.0.1:58883 - "POST /moderation/input HTTP/1.1" 200 OK
[api] {"timestamp":"2026-01-19T09:49:55.570Z","level":"INFO","code":"SYS-1007","message":"Moderation Output check result","metadata":{"safe":false,"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok task cmkkzgau20009aydxa19d6vsh completed, 326 chunks
[api] {"timestamp":"2026-01-19T09:49:55.578Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:49:55.579Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Task cmkkzgau20009aydxa19d6vsh completed successfully
[api] {"level":30,"time":1768816195584,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkzgas80001aydx1myq35f1","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58898},"msg":"incoming request"}
[api] {"level":30,"time":1768816195585,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","res":{"statusCode":204},"responseTime":0.7608340010046959,"msg":"request completed"}
[api] {"level":30,"time":1768816195587,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","req":{"method":"GET","url":"/api/chat/sessions/cmkkzgas80001aydx1myq35f1","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58898},"msg":"incoming request"}
[api] {"level":30,"time":1768816195595,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","res":{"statusCode":200},"responseTime":8.144666999578476,"msg":"request completed"}
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:50:00.772Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"ethereum","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:50:00.772Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] [Job] ✅ Loaded 436 real hot users from /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Job] ✅ Using 436 real hot users from analysis
[api] [SocialJob] fetchCastsFromUsers starting with 436 FIDs, target: 500
[api] {"timestamp":"2026-01-19T09:50:04.835Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":23,"limit":200},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:50:10.269Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:50:10.453Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"eth","count":129,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:50:10.454Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"ethereum","durationMs":9682},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for Ethereum
[api] Saved 100 trending tokens for eth to database and memory cache
[api] [TokenJob] Saved 100 tokens for Ethereum to DB + cache
[api] [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:50:15.492Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"solana","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:50:15.492Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:50:22.567Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":126,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:50:22.567Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"solana","durationMs":7075},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for Solana
[api] Saved 100 trending tokens for solana to database and memory cache
[api] [TokenJob] Saved 100 tokens for Solana to DB + cache
[api] [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:50:27.613Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"base","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:50:29.096Z","level":"INFO","code":"WTC-2002","message":"Found addresses via WebSocket","metadata":{"count":177,"chain":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:50:32.958Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":39,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:50:35.179Z","level":"WARN","code":"API-5002","message":"Snapchain Hub failed after retries, trying DB fallback","metadata":{"fid":1104918},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:50:35.185Z","level":"INFO","code":"SYS-1007","message":"Using DB cached data for FID from Snapchain","metadata":{"fid":1104918,"username":"drdeeks"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:50:35.380Z","level":"WARN","code":"API-5002","message":"Snapchain Hub failed after retries, trying DB fallback","metadata":{"fid":482872},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:50:35.385Z","level":"WARN","code":"SYS-1007","message":"No cached data for FID in Snapchain, returning mock","metadata":{"fid":482872},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:50:36.578Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"WETH","liquidity":128.644},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:50:38.627Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"base","count":97,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:50:38.628Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"base","durationMs":11014},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for Base
[api] Saved 100 trending tokens for base to database and memory cache
[api] [TokenJob] Saved 100 tokens for Base to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:50:40.282Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:50:43.666Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"bsc","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:50:45.206Z","level":"INFO","code":"WTC-2002","message":"Found addresses via WebSocket","metadata":{"count":193,"chain":"bsc"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:50:49.377Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":32,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:50:50.343Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/bsc/trending_pools"},"service":"kiko-api","env":"production"}
[api] [SocialJob] Checking Zora coin status for 486 casts...
[api] {"timestamp":"2026-01-19T09:50:54.107Z","level":"ERROR","code":"API-5002","message":"API error on trending page","metadata":{"page":1,"status":429,"statusText":"Too Many Requests"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:50:54.107Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"bsc","count":0,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:50:54.107Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":75,"chain":"bsc","durationMs":10441},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 75 trending tokens for BSC
[api] Saved 75 trending tokens for bsc to database and memory cache
[api] [TokenJob] Saved 75 tokens for BSC to DB + cache
[api] [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:50:59.131Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"arbitrum","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:50:59.131Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:51:03.212Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":7,"limit":200},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x2: API-5001:Skipping low liquidity token","timestamp":"2026-01-19T09:51:04.501Z","metadata":{}}
[api] {"timestamp":"2026-01-19T09:51:04.501Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"ETH","liquidity":1.9254},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x3: API-5004:External API requested retry","timestamp":"2026-01-19T09:51:05.751Z","metadata":{}}
[api] {"timestamp":"2026-01-19T09:51:05.751Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/arbitrum/trending_pools"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:51:10.287Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x3: API-5004:External API requested retry","timestamp":"2026-01-19T09:51:11.121Z","metadata":{}}
[api] {"timestamp":"2026-01-19T09:51:11.121Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":2,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/arbitrum/trending_pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:51:12.738Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"USDC","liquidity":428.5982},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x3: API-5004:External API requested retry","timestamp":"2026-01-19T09:51:16.479Z","metadata":{}}
[api] {"timestamp":"2026-01-19T09:51:16.480Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/arbitrum/trending_pools"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x4: API-5004:External API requested retry","timestamp":"2026-01-19T09:51:23.022Z","metadata":{}}
[api] {"timestamp":"2026-01-19T09:51:23.022Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/arbitrum/trending_pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:51:27.855Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"arbitrum","count":61,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:51:27.855Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":65,"chain":"arbitrum","durationMs":28724},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 65 trending tokens for Arbitrum
[api] Saved 65 trending tokens for arbitrum to database and memory cache
[api] [TokenJob] Saved 65 tokens for Arbitrum to DB + cache
[api] [TokenJob] Fetching trending tokens for Optimism via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:51:32.890Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"optimism","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:51:32.890Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:51:37.659Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":12,"limit":200},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:51:40.292Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:51:41.232Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"OP","liquidity":835.6444},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x3: API-5004:External API requested retry","timestamp":"2026-01-19T09:51:41.676Z","metadata":{}}
[api] {"timestamp":"2026-01-19T09:51:41.676Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/optimism/trending_pools"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x13: API-5001:Skipping low liquidity token","timestamp":"2026-01-19T09:51:46.452Z","metadata":{}}
[api] {"timestamp":"2026-01-19T09:51:46.452Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"OP","liquidity":127.4005},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x3: API-5004:External API requested retry","timestamp":"2026-01-19T09:51:46.898Z","metadata":{}}
[api] {"timestamp":"2026-01-19T09:51:46.898Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/optimism/trending_pools"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x4: API-5001:Skipping low liquidity token","timestamp":"2026-01-19T09:51:51.742Z","metadata":{}}
[api] {"timestamp":"2026-01-19T09:51:51.742Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"OP","liquidity":17.0081},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x3: API-5004:External API requested retry","timestamp":"2026-01-19T09:51:52.185Z","metadata":{}}
[api] {"timestamp":"2026-01-19T09:51:52.185Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/optimism/trending_pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:51:54.174Z","level":"INFO","code":"SOC-7001","message":"Timer finished: get_trending_casts_trending","metadata":{"timeRange":"trending","limit":500,"offset":0,"count":500,"fromCache":false,"durationMs":35,"timerLabel":"get_trending_casts_trending"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:51:54.179Z","level":"INFO","code":"SOC-7003","message":"SocialRepo: Updated cache with 500 merged casts","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:51:54.179Z","level":"INFO","code":"SOC-7003","message":"SocialRepo: Saved 486 trending casts to database","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:51:54.179Z","level":"INFO","code":"SOC-7003","message":"Timer finished: save_trending_casts","metadata":{"count":486,"durationMs":1583,"timerLabel":"save_trending_casts"},"service":"kiko-api","env":"production"}
[api] [SocialJob] Casts refreshed: 486 saved
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x4: API-5001:Skipping low liquidity token","timestamp":"2026-01-19T09:51:58.370Z","metadata":{}}
[api] {"timestamp":"2026-01-19T09:51:58.370Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"SNX","liquidity":74.4314},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:51:58.370Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"optimism","count":41,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:51:58.370Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":45,"chain":"optimism","durationMs":25480},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 45 trending tokens for Optimism
[api] Saved 45 trending tokens for optimism to database and memory cache
[api] [TokenJob] Saved 45 tokens for Optimism to DB + cache
[api] [TokenJob] Fetching trending tokens for Polygon via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:52:03.393Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"polygon","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:52:03.393Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:52:08.301Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":20,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:52:09.360Z","level":"ERROR","code":"API-5002","message":"API error on trending page","metadata":{"page":1,"status":404,"statusText":"Not Found"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:52:09.360Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"polygon","count":0,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:52:09.361Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":18,"chain":"polygon","durationMs":5968},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 18 trending tokens for Polygon
[api] Saved 18 trending tokens for polygon to database and memory cache
[api] [TokenJob] Saved 18 tokens for Polygon to DB + cache
[api] [TokenJob] Refreshed 7 chains in 128.6s
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:52:10.295Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Checking Zora coin status for 487 casts...
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:52:40.301Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:52:42.964Z","level":"INFO","code":"SOC-7001","message":"Timer finished: get_trending_casts_trending","metadata":{"timeRange":"trending","limit":500,"offset":0,"count":500,"fromCache":false,"durationMs":46,"timerLabel":"get_trending_casts_trending"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:52:42.970Z","level":"INFO","code":"SOC-7003","message":"SocialRepo: Updated cache with 500 merged casts","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:52:42.970Z","level":"INFO","code":"SOC-7003","message":"SocialRepo: Saved 487 trending casts to database","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:52:42.970Z","level":"INFO","code":"SOC-7003","message":"Timer finished: save_trending_casts","metadata":{"count":487,"durationMs":1905,"timerLabel":"save_trending_casts"},"service":"kiko-api","env":"production"}
[api] [SocialJob] Casts refreshed: 487 saved
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:53:10.305Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:53:40.309Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:54:10.315Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:54:40.319Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:55:00.096Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"ethereum","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:55:00.096Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:55:04.150Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":23,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:55:09.605Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"eth","count":121,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:55:09.605Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"ethereum","durationMs":9510},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for Ethereum
[api] Saved 100 trending tokens for eth to database and memory cache
[api] [TokenJob] Saved 100 tokens for Ethereum to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:55:10.326Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:55:14.648Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"solana","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:55:14.648Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:55:21.503Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":127,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:55:21.503Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"solana","durationMs":6855},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for Solana
[api] Saved 100 trending tokens for solana to database and memory cache
[api] [TokenJob] Saved 100 tokens for Solana to DB + cache
[api] [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:55:26.543Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"base","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:55:27.986Z","level":"INFO","code":"WTC-2002","message":"Found addresses via WebSocket","metadata":{"count":169,"chain":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:55:31.966Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":39,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:55:35.005Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"WETH","liquidity":128.6496},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:55:37.575Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"base","count":98,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:55:37.575Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"base","durationMs":11032},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for Base
[api] Saved 100 trending tokens for base to database and memory cache
[api] [TokenJob] Saved 100 tokens for Base to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:55:40.331Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:55:42.628Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"bsc","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:55:44.130Z","level":"INFO","code":"WTC-2002","message":"Found addresses via WebSocket","metadata":{"count":192,"chain":"bsc"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:55:48.009Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":32,"limit":200},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x4: API-5004:External API requested retry","timestamp":"2026-01-19T09:55:48.939Z","metadata":{}}
[api] {"timestamp":"2026-01-19T09:55:48.939Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/bsc/trending_pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:55:52.654Z","level":"ERROR","code":"API-5002","message":"API error on trending page","metadata":{"page":1,"status":429,"statusText":"Too Many Requests"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:55:52.654Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"bsc","count":0,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:55:52.654Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":75,"chain":"bsc","durationMs":10026},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 75 trending tokens for BSC
[api] Saved 75 trending tokens for bsc to database and memory cache
[api] [TokenJob] Saved 75 tokens for BSC to DB + cache
[api] {"level":30,"time":1768816554287,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","req":{"method":"OPTIONS","url":"/api/copy-trade/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62861},"msg":"incoming request"}
[api] {"level":30,"time":1768816554287,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","res":{"statusCode":204},"responseTime":0.36787499859929085,"msg":"request completed"}
[api] {"level":30,"time":1768816554289,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-u","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62863},"msg":"incoming request"}
[api] {"level":30,"time":1768816554289,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-u","res":{"statusCode":204},"responseTime":0.11420799791812897,"msg":"request completed"}
[api] {"level":30,"time":1768816554289,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-v","req":{"method":"OPTIONS","url":"/api/copy-trade/positions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62864},"msg":"incoming request"}
[api] {"level":30,"time":1768816554289,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-v","res":{"statusCode":204},"responseTime":0.10962500050663948,"msg":"request completed"}
[api] {"level":30,"time":1768816554290,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","req":{"method":"GET","url":"/api/copy-trade/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62861},"msg":"incoming request"}
[api] [CopyTrade] GET /configs - Fetching configs for user did:privy:cmj0a3j3f005fl20c4xkl7195
[api] {"level":30,"time":1768816554292,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-x","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62863},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] {"level":30,"time":1768816554293,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","req":{"method":"GET","url":"/api/copy-trade/positions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62864},"msg":"incoming request"}
[api] [CopyTrade] GET /positions - Fetching positions for did:privy:cmj0a3j3f005fl20c4xkl7195
[api] {"level":30,"time":1768816554297,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","res":{"statusCode":200},"responseTime":6.5569580011069775,"msg":"request completed"}
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1768816554350,"pid":20395,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","res":{"statusCode":200},"responseTime":56.89425000175834,"msg":"request completed"}
[api] [TokenJob] Tokens for Arbitrum are fresh, skipping API call
[api] {"timestamp":"2026-01-19T09:56:02.438Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"be33624f-ff00-4d96-9be3-ffac865ff052","address":"0x0129614474d4b1df7053cc18c4e1cb646c563332"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:56:02.463Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"be33624f-ff00-4d96-9be3-ffac865ff052","address":"0x04acf03e000f1e982d619c7f40c75ffa32303c77"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:56:02.466Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"be33624f-ff00-4d96-9be3-ffac865ff052","address":"0x01af27cd29eaab7392039c9fae18a5c86938b96a"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:56:02.472Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"be33624f-ff00-4d96-9be3-ffac865ff052","address":"0x0077ae08200c05af9741b38366e26f7b1e7bfe2d"},"service":"kiko-api","env":"production"}
[api] [TokenJob] Tokens for Optimism are fresh, skipping API call
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x3: API-5004:External API requested retry","timestamp":"2026-01-19T09:56:03.425Z","metadata":{"traceId":"be33624f-ff00-4d96-9be3-ffac865ff052"}}
[api] {"timestamp":"2026-01-19T09:56:03.425Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"be33624f-ff00-4d96-9be3-ffac865ff052","status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x01af27cd29eaab7392039c9fae18a5c86938b96a/pools"},"service":"kiko-api","env":"production"}
[Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] {"timestamp":"2026-01-19T09:56:29.489Z","level":"INFO","code":"SYS-1001","message":"Zora SDK initialized with API Key","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Found user list at: /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
[api] [SkillRegistry] Loading skills...
[api] [SkillRegistry] Loaded skill: copy_trade
[api] [SkillRegistry] Loaded skill: market_macro
[api] [SkillRegistry] Loaded skill: polymarket_prediction
[api] [SkillRegistry] Loaded skill: risk_security
[api] [SkillRegistry] Loaded skill: social_farcaster
[api] [SkillRegistry] Loaded skill: swap
[api] [SkillRegistry] Loaded skill: token_analysis
[Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] {"timestamp":"2026-01-19T09:56:37.577Z","level":"INFO","code":"SYS-1001","message":"Zora SDK initialized with API Key","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Found user list at: /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
[api] [SkillRegistry] Loading skills...
[api] [SkillRegistry] Loaded skill: copy_trade
[api] [SkillRegistry] Loaded skill: market_macro
[api] [SkillRegistry] Loaded skill: polymarket_prediction
[api] [SkillRegistry] Loaded skill: risk_security
[api] [SkillRegistry] Loaded skill: social_farcaster
[api] [SkillRegistry] Loaded skill: swap
[api] [SkillRegistry] Loaded skill: token_analysis
[api] [SkillRegistry] Loaded skill: wallet_portfolio
[api] [SkillRegistry] Loaded skill: zora_nfts
[api] {"timestamp":"2026-01-19T09:56:37.910Z","level":"WARN","code":"SYS-1001","message":"Public folder not found - skipping static file serving","metadata":{"path":"/Users/almurat/KiKo/kiko-api/public"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:56:37.912Z","level":"INFO","code":"SYS-1001","message":"Initializing services...","metadata":{"env":"production","port":3001,"database":"configured","privy":"✅ Configured"},"service":"kiko-api","env":"production"}
[api] [Prisma] DB connection is healthy
[api] {"timestamp":"2026-01-19T09:56:37.933Z","level":"INFO","code":"SYS-1004","message":"Database connection successful","metadata":{},"service":"kiko-api","env":"production"}
[api] [DataRetention] Checking retention policies...
[api] [DataRetention] Starting cleanup job...
[api] [Redis] Connected successfully
[api] {"timestamp":"2026-01-19T09:56:37.942Z","level":"INFO","code":"SYS-1005","message":"Redis initialized","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:56:37.942Z","level":"INFO","code":"SYS-1001","message":"Starting server on port 3001...","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816597965,"pid":21246,"hostname":"almuratdeMacBook-Pro.local","msg":"Server listening at http://0.0.0.0:3001"}
[api] {"timestamp":"2026-01-19T09:56:37.965Z","level":"INFO","code":"SYS-1001","message":"Server listening","metadata":{"url":"http://localhost:3001","health":"http://localhost:3001/health"},"service":"kiko-api","env":"production"}
[api] [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
[api] [TokenJob] Scheduled: Every 5min (Ethereum, Solana, Base, BSC, Arbitrum, Optimism, Polygon)
[api] [SocialJob] Scheduled: Every 10min
[api] {"timestamp":"2026-01-19T09:56:37.977Z","level":"INFO","code":"SYS-1001","message":"Background jobs started","metadata":{},"service":"kiko-api","env":"production"}
[Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] {"timestamp":"2026-01-19T09:57:19.084Z","level":"INFO","code":"SYS-1001","message":"Zora SDK initialized with API Key","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Found user list at: /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
[api] [SkillRegistry] Loading skills...
[api] [SkillRegistry] Loaded skill: copy_trade
[api] [SkillRegistry] Loaded skill: market_macro
[api] [SkillRegistry] Loaded skill: polymarket_prediction
[api] [SkillRegistry] Loaded skill: risk_security
[api] [SkillRegistry] Loaded skill: social_farcaster
[api] [SkillRegistry] Loaded skill: swap
[api] [SkillRegistry] Loaded skill: token_analysis
[api] [SkillRegistry] Loaded skill: wallet_portfolio
[api] [SkillRegistry] Loaded skill: zora_nfts
[api] {"timestamp":"2026-01-19T09:57:19.271Z","level":"WARN","code":"SYS-1001","message":"Public folder not found - skipping static file serving","metadata":{"path":"/Users/almurat/KiKo/kiko-api/public"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:57:19.273Z","level":"INFO","code":"SYS-1001","message":"Initializing services...","metadata":{"env":"production","port":3001,"database":"configured","privy":"✅ Configured"},"service":"kiko-api","env":"production"}
[Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] {"timestamp":"2026-01-19T09:57:44.818Z","level":"INFO","code":"SYS-1001","message":"Zora SDK initialized with API Key","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Found user list at: /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
[api] [SkillRegistry] Loading skills...
[api] [SkillRegistry] Loaded skill: copy_trade
[api] [SkillRegistry] Loaded skill: market_macro
[api] [SkillRegistry] Loaded skill: polymarket_prediction
[api] [SkillRegistry] Loaded skill: risk_security
[api] [SkillRegistry] Loaded skill: social_farcaster
[api] [SkillRegistry] Loaded skill: swap
[api] [SkillRegistry] Loaded skill: undefined
[api] [SkillRegistry] Loaded skill: token_analysis
[api] [SkillRegistry] Loaded skill: wallet_portfolio
[api] [SkillRegistry] Loaded skill: zora_nfts
[api] {"timestamp":"2026-01-19T09:57:45.006Z","level":"WARN","code":"SYS-1001","message":"Public folder not found - skipping static file serving","metadata":{"path":"/Users/almurat/KiKo/kiko-api/public"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:57:45.008Z","level":"INFO","code":"SYS-1001","message":"Initializing services...","metadata":{"e[Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] {"timestamp":"2026-01-19T09:58:03.856Z","level":"INFO","code":"SYS-1001","message":"Zora SDK initialized with API Key","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Found user list at: /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
[api] [SkillRegistry] Loading skills...
[api] [SkillRegistry] Loaded skill: copy_trade
[api] [SkillRegistry] Loaded skill: market_macro
[api] [SkillRegistry] Loaded skill: polymarket_prediction
[api] [SkillRegistry] Loaded skill: risk_security
[api] [SkillRegistry] Loaded skill: social_farcaster
[api] [SkillRegistry] Loaded skill: swap
[api] [SkillRegistry] Loaded skill: undefined
[api] [SkillRegistry] Loaded skill: token_analysis
[api] [SkillRegistry] Loaded skill: wallet_portfolio
[api] [SkillRegistry] Loaded skill: zora_nfts
[api] {"timestamp":"2026-01-19T09:58:04.057Z","level":"WARN","code":"SYS-1001","message":"Public folder not found - skipping static file serving","metadata":{"path":"/Users/almurat/KiKo/kiko-api/public"},"service":"kiko-api","env":"production"}
[Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] {"timestamp":"2026-01-19T09:58:17.673Z","level":"INFO","code":"SYS-1001","message":"Zora SDK initialized with API Key","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Found user list at: /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
[api] [SkillRegistry] Loading skills...
[api] [SkillRegistry] Loaded skill: copy_trade
[api] [SkillRegistry] Loaded skill: market_macro
[api] [SkillRegistry] Loaded skill: polymarket_prediction
[api] [SkillRegistry] Loaded skill: risk_security
[api] [SkillRegistry] Loaded skill: social_farcaster
[api] [SkillRegistry] Loaded skill: swap
[api] [SkillRegistry] Loaded skill: undefined
[api] [SkillRegistry] Loaded skill: token_analysis
[api] [SkillRegistry] Loaded skill: wallet_portfolio
[api] [SkillRegistry] Loaded skill: zora_nfts
[api] {"timestamp":"2026-01-19T09:58:17.986Z","level":"WARN","code":"SYS-1001","message":"Public folder not found - skipping static file serving","metadata":{"path":"/Users/almurat/KiKo/kiko-api/public"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:58:17.987Z","level":"INFO","code":"SYS-1001","message":"Initializing services...","metadata":{"env":"production","port":3001,"database":"configured","privy":"✅ Configured"},"service":"kiko-api","env":"production"}
[api] [Prisma] DB connection is healthy
[api] {"timestamp":"2026-01-19T09:58:18.007Z","level":"INFO","code":"SYS-1004","message":"Database connection successful","metadata":{},"service":"kiko-api","env":"production"}
[api] [DataRetention] Checking retention policies...
[api] [DataRetention] Starting cleanup job...
[api] [Redis] Connected successfully
[api] {"timestamp":"2026-01-19T09:58:18.016Z","level":"INFO","code":"SYS-1005","message":"Redis initialized","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:58:18.016Z","level":"INFO","code":"SYS-1001","message":"Starting server on port 3001...","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816698036,"pid":21404,"hostname":"almuratdeMacBook-Pro.local","msg":"Server listening at http://0.0.0.0:3001"}
[api] {"timestamp":"2026-01-19T09:58:18.036Z","level":"INFO","code":"SYS-1001","message":"Server listening","metadata":{"url":"http://localhost:3001","health":"http://localhost:3001/health"},"service":"kiko-api","env":"production"}
[api] [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
[api] [TokenJob] Scheduled: Every 5min (Ethereum, Solana, Base, BSC, Arbitrum, Optimism, Polygon)
[api] [SocialJob] Scheduled: Every 10min
[api] {"timestamp":"2026-01-19T09:58:18.048Z","level":"INFO","code":"SYS-1001","message":"Background jobs started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:58:18.048Z","level":"INFO","code":"SYS-1001","message":"Initializing auto trade service...","metadata":{},"service":"kiko-api","env":"production"}
[api] [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
[api] {"timestamp":"2026-01-19T09:58:18.049Z","level":"INFO","code":"SYS-1001","message":"Auto trade service initialized (Solana watcher + EVM webhook enabled)","metadata":{"mode":"hybrid"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:58:18.049Z","level":"INFO","code":"SYS-1001","message":"Auto trade service started","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] Starting position monitor (every 30s)...
[api] {"timestamp":"2026-01-19T09:58:18.049Z","level":"INFO","code":"SYS-1001","message":"Position monitor started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:58:18.049Z","level":"INFO","code":"SYS-1001","message":"Token Alert Service started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:58:18.049Z","level":"INFO","code":"SYS-1001","message":"Token alert service started","metadata":{},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Started polling for AI tasks (interval: 3000ms)
[api] {"timestamp":"2026-01-19T09:58:18.049Z","level":"INFO","code":"SYS-1001","message":"Chat worker started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:58:18.049Z","level":"INFO","code":"SYS-1001","message":"🎉 All services initialized!","metadata":{},"service":"kiko-api","env":"production"}
[api] [DataRetention] Cleanup job completed.
[api] {"level":30,"time":1768816699673,"pid":21404,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWtoenc0aGMwMXJpZ3EwY3Zwc3ppZGQ2IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3Njg4MTU0MTQsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc2ODgxOTAxNH0.PX3csR9tJ_vMna3q7x9SzNjY9IpWK7chhp2IhnkKK5EEXEbxePpeefrwbOFaw34V5Y1Ly4UHex--m3BBlSmI2A","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":63660},"msg":"incoming request"}
[api] {"timestamp":"2026-01-19T09:58:19.686Z","level":"INFO","code":"WS-8001","message":"ChatWS Client connected","metadata":{"traceId":"9c823a79-f6f7-4810-ae08-0b7bdd367097","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1},"service":"kiko-api","env":"production"}
[api] [MarketJob] Running startup staleness check...
[api] [PositionMonitor] 🔄 Running position check...
[api] [MarketJob] Overview is fresh, skipping API call
[api] [TokenJob] Tokens for Ethereum are fresh, skipping API call
[api] {"timestamp":"2026-01-19T09:58:23.059Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [MarketJob] Protocols are fresh, skipping API call
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [SocialJob] Trending casts are fresh, skipping Snapchain API call
[api] [TokenJob] Tokens for Solana are fresh, skipping API call
[api] [TokenJob] Tokens for Base are fresh, skipping API call
[api] [TokenJob] Tokens for BSC are fresh, skipping API call
[api] [TokenJob] Tokens for Arbitrum are fresh, skipping API call
[api] [TokenJob] Fetching trending tokens for Optimism via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:58:48.087Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"optimism","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:58:48.087Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:58:52.785Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":12,"limit":200},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:58:53.066Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:58:54.787Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"STG","liquidity":594.3479},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x15: API-5001:Skipping low liquidity token","timestamp":"2026-01-19T09:59:00.374Z","metadata":{}}
[api] {"timestamp":"2026-01-19T09:59:00.374Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"FRAX","liquidity":70.8937},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:59:01.309Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"optimism","count":42,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:59:01.310Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":46,"chain":"optimism","durationMs":13223},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 46 trending tokens for Optimism
[api] Saved 46 trending tokens for optimism to database and memory cache
[api] [TokenJob] Saved 46 tokens for Optimism to DB + cache
[api] [TokenJob] Fetching trending tokens for Polygon via DexScreener Premium...
[api] {"timestamp":"2026-01-19T09:59:06.341Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"polygon","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:59:06.341Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:59:11.224Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":20,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:59:12.325Z","level":"ERROR","code":"API-5002","message":"API error on trending page","metadata":{"page":1,"status":404,"statusText":"Not Found"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:59:12.325Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"polygon","count":0,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T09:59:12.325Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":18,"chain":"polygon","durationMs":5984},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 18 trending tokens for Polygon
[api] Saved 18 trending tokens for polygon to database and memory cache
[api] [TokenJob] Saved 18 tokens for Polygon to DB + cache
[api] [TokenJob] Refreshed 7 chains in 49.3s
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:59:23.071Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T09:59:53.074Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
[api] {"timestamp":"2026-01-19T10:00:00.175Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"ethereum","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:00:00.175Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Trending casts are fresh, skipping Snapchain API call
[api] {"timestamp":"2026-01-19T10:00:04.378Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":23,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:00:09.834Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"eth","count":123,"limit":200},"service":"kiko-api","env":"production"}
[Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] {"timestamp":"2026-01-19T10:01:08.951Z","level":"INFO","code":"SYS-1001","message":"Zora SDK initialized with API Key","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Found user list at: /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
[api] [SkillRegistry] Loading skills...
[api] [SkillRegistry] Loaded skill: copy_trade
[api] [SkillRegistry] Loaded skill: market_macro
[api] [SkillRegistry] Loaded skill: polymarket_prediction
[api] [SkillRegistry] Loaded skill: risk_security
[api] [SkillRegistry] Loaded skill: social_farcaster
[api] [SkillRegistry] Loaded skill: swap
[api] [SkillRegistry] Loaded skill: undefined
[api] [SkillRegistry] Loaded skill: token_analysis
[api] [SkillRegistry] Loaded skill: wallet_portfolio
[api] [SkillRegistry] Loaded skill: zora_nfts
[api] {"timestamp":"2026-01-19T10:01:09.315Z","level":"WARN","code":"SYS-1001","message":"Public folder not found - skipping static file serving","metadata":{"path":"/Users/almurat/KiKo/kiko-api/public"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:01:09.317Z","level":"INFO","code":"SYS-1001","message":"Initializing services...","metadata":{"env":"production","port":3001,"database":"configured","privy":"✅ Configured"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:01:09.328Z","level":"INFO","code":"SYS-1004","message":"Database connection successful","metadat[Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] {"timestamp":"2026-01-19T10:01:39.839Z","level":"INFO","code":"SYS-1001","message":"Zora SDK initialized with API Key","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Found user list at: /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
[api] [SkillRegistry] Loading skills...
[api] [SkillRegistry] Loaded skill: copy_trade
[api] [SkillRegistry] Loaded skill: market_macro
[api] [SkillRegistry] Loaded skill: polymarket_prediction
[api] [SkillRegistry] Loaded skill: risk_security
[api] [SkillRegistry] Loaded skill: social_farcaster
[api] [SkillRegistry] Loaded skill: swap
[api] [SkillRegistry] Loaded skill: undefined
[api] [SkillRegistry] Loaded skill: token_analysis
[api] [SkillRegistry] Loaded skill: wallet_portfolio
[api] [SkillRegistry] Loaded skill: zora_nfts
[api] {"timestamp":"2026-01-19T10:01:40.223Z","level":"WARN","code":"SYS-1001","message":"Public folder not found - skipping stati[Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] {"timestamp":"2026-01-19T10:01:49.345Z","level":"INFO","code":"SYS-1001","message":"Zora SDK initialized with API Key","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Found user list at: /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
[api] [SkillRegistry] Loading skills...
[api] [SkillRegistry] Loaded skill: copy_trade
[api] [SkillRegistry] Loaded skill: market_macro
[api] [SkillRegistry] Loaded skill: polymarket_prediction
[api] [SkillRegistry] Loaded skill: risk_security
[api] [SkillRegistry] Loaded skill: social_farcaster
[api] [SkillRegistry] Loaded skill: swap
[api] [SkillRegistry] Loaded skill: undefined
[api] [SkillRegistry] Loaded skill: token_analysis
[api] [SkillRegistry] Loaded skill: wallet_portfolio
[api] [SkillRegistry] Loaded skill: zora_nfts
[api] {"timestamp":"2026-01-19T10:01:49.710Z","level":"WARN","code":"SYS-1001","message":"Public folder not found - skipping stati[Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] {"timestamp":"2026-01-19T10:01:58.434Z","level":"INFO","code":"SYS-1001","message":"Zora SDK initialized with API Key","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Found user list at: /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
[api] [SkillRegistry] Loading skills...
[api] [SkillRegistry] Loaded skill: copy_trade
[api] [SkillRegistry] Loaded skill: market_macro
[api] [SkillRegistry] Loaded skill: polymarket_prediction
[api] [SkillRegistry] Loaded skill: risk_security
[api] [SkillRegistry] Loaded skill: social_farcaster
[api] [SkillRegistry] Loaded skill: swap
[api] [SkillRegistry] Loaded skill: undefined
[api] [SkillRegistry] Loaded skill: token_analysis
[api] [SkillRegistry] Loaded skill: wallet_portfolio
[api] [SkillRegistry] Loaded skill: zora_nfts
[api] {"timestamp":"2026-01-19T10:01:58.913Z","level":"WARN","code":"SYS-1001","message":"Public folder not found - skipping static file serving","metadata":{"path":"/Users/almurat/KiKo/kiko-api/public"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:01:58.914Z","level":"INFO","code":"SYS-1001","message":"Initializing services...","metadata":{"env":"production","port":3001,"database":"configured","privy":"✅ Configured"},"service":"kiko-api","env":"production"}
[api] [Prisma] DB connection is healthy
[api] {"timestamp":"2026-01-19T10:01:58.933Z","level":"INFO","code":"SYS-1004","message":"Database connection successful","metadata":{},"service":"kiko-api","env":"production"}
[api] [DataRetention] Checking retention policies...
[api] [DataRetention] Starting cleanup job...
[api] [Redis] Connected successfully
[api] {"timestamp":"2026-01-19T10:01:58.949Z","level":"INFO","code":"SYS-1005","message":"Redis initialized","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:01:58.949Z","level":"INFO","code":"SYS-1001","message":"Starting server on port 3001...","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816918975,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","msg":"Server listening at http://0.0.0.0:3001"}
[api] {"timestamp":"2026-01-19T10:01:58.975Z","level":"INFO","code":"SYS-1001","message":"Server listening","metadata":{"url":"http://localhost:3001","health":"http://localhost:3001/health"},"service":"kiko-api","env":"production"}
[api] [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
[api] [TokenJob] Scheduled: Every 5min (Ethereum, Solana, Base, BSC, Arbitrum, Optimism, Polygon)
[api] [SocialJob] Scheduled: Every 10min
[api] {"timestamp":"2026-01-19T10:01:58.991Z","level":"INFO","code":"SYS-1001","message":"Background jobs started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:01:58.991Z","level":"INFO","code":"SYS-1001","message":"Initializing auto trade service...","metadata":{},"service":"kiko-api","env":"production"}
[api] [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
[api] {"timestamp":"2026-01-19T10:01:58.991Z","level":"INFO","code":"SYS-1001","message":"Auto trade service initialized (Solana watcher + EVM webhook enabled)","metadata":{"mode":"hybrid"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:01:58.991Z","level":"INFO","code":"SYS-1001","message":"Auto trade service started","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] Starting position monitor (every 30s)...
[api] {"timestamp":"2026-01-19T10:01:58.991Z","level":"INFO","code":"SYS-1001","message":"Position monitor started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:01:58.991Z","level":"INFO","code":"SYS-1001","message":"Token Alert Service started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:01:58.991Z","level":"INFO","code":"SYS-1001","message":"Token alert service started","metadata":{},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Started polling for AI tasks (interval: 3000ms)
[api] {"timestamp":"2026-01-19T10:01:58.992Z","level":"INFO","code":"SYS-1001","message":"Chat worker started","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:01:58.992Z","level":"INFO","code":"SYS-1001","message":"🎉 All services initialized!","metadata":{},"service":"kiko-api","env":"production"}
[api] [DataRetention] Cleanup job completed.
[api] {"level":30,"time":1768816920043,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWtoenc0aGMwMXJpZ3EwY3Zwc3ppZGQ2IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3Njg4MTU0MTQsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc2ODgxOTAxNH0.PX3csR9tJ_vMna3q7x9SzNjY9IpWK7chhp2IhnkKK5EEXEbxePpeefrwbOFaw34V5Y1Ly4UHex--m3BBlSmI2A","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64551},"msg":"incoming request"}
[api] {"timestamp":"2026-01-19T10:02:00.055Z","level":"INFO","code":"WS-8001","message":"ChatWS Client connected","metadata":{"traceId":"eeb2b822-4e91-4437-b8c2-db6ac14736b1","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816920452,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","req":{"method":"OPTIONS","url":"/api/copy-trade/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64557},"msg":"incoming request"}
[api] {"level":30,"time":1768816920454,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","res":{"statusCode":204},"responseTime":2.3038330003619194,"msg":"request completed"}
[api] {"level":30,"time":1768816920460,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","req":{"method":"GET","url":"/api/copy-trade/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64557},"msg":"incoming request"}
[api] {"level":30,"time":1768816920478,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","req":{"method":"OPTIONS","url":"/api/copy-trade/positions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64559},"msg":"incoming request"}
[api] {"level":30,"time":1768816920480,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","res":{"statusCode":204},"responseTime":1.1564160026609898,"msg":"request completed"}
[api] {"level":30,"time":1768816920482,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","req":{"method":"GET","url":"/api/copy-trade/positions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64559},"msg":"incoming request"}
[api] [CopyTrade] GET /configs - Fetching configs for user did:privy:cmj0a3j3f005fl20c4xkl7195
[api] [CopyTrade] GET /positions - Fetching positions for did:privy:cmj0a3j3f005fl20c4xkl7195
[api] {"level":30,"time":1768816921547,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","res":{"statusCode":200},"responseTime":1065.5052080005407,"msg":"request completed"}
[api] {"level":30,"time":1768816921549,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","res":{"statusCode":200},"responseTime":1088.5874999985099,"msg":"request completed"}
[api] [MarketJob] Running startup staleness check...
[api] [PositionMonitor] 🔄 Running position check...
[api] [MarketJob] Overview is fresh, skipping API call
[api] [TokenJob] Tokens for Ethereum are fresh, skipping API call
[api] {"timestamp":"2026-01-19T10:02:04.017Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [SocialJob] Trending casts are fresh, skipping Snapchain API call
[api] [MarketJob] Protocols are fresh, skipping API call
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] {"level":30,"time":1768816927126,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","req":{"method":"OPTIONS","url":"/api/copy-trade/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64559},"msg":"incoming request"}
[api] {"level":30,"time":1768816927126,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","res":{"statusCode":204},"responseTime":0.20979199931025505,"msg":"request completed"}
[api] {"level":30,"time":1768816927128,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","req":{"method":"OPTIONS","url":"/api/copy-trade/positions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64557},"msg":"incoming request"}
[api] {"level":30,"time":1768816927128,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","res":{"statusCode":204},"responseTime":0.21799999848008156,"msg":"request completed"}
[api] {"level":30,"time":1768816927130,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","req":{"method":"GET","url":"/api/copy-trade/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64559},"msg":"incoming request"}
[api] {"level":30,"time":1768816927131,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","req":{"method":"GET","url":"/api/copy-trade/positions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64557},"msg":"incoming request"}
[api] [CopyTrade] GET /configs - Fetching configs for user did:privy:cmj0a3j3f005fl20c4xkl7195
[api] [CopyTrade] GET /positions - Fetching positions for did:privy:cmj0a3j3f005fl20c4xkl7195
[api] {"level":30,"time":1768816927134,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","res":{"statusCode":200},"responseTime":3.1440420001745224,"msg":"request completed"}
[api] {"level":30,"time":1768816927148,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","res":{"statusCode":200},"responseTime":17.928959000855684,"msg":"request completed"}
[api] [TokenJob] Tokens for Solana are fresh, skipping API call
[api] [TokenJob] Tokens for Base are fresh, skipping API call
[api] [TokenJob] Tokens for BSC are fresh, skipping API call
[api] [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
[api] {"timestamp":"2026-01-19T10:02:24.033Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"arbitrum","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:24.033Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:29.153Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":7,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:30.409Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"ETH","liquidity":1.924},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T10:02:34.025Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816956733,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","req":{"method":"GET","url":"/api/config/auth-key-id","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64702},"msg":"incoming request"}
[api] {"level":30,"time":1768816956735,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","res":{"statusCode":200},"responseTime":2.22308299690485,"msg":"request completed"}
[api] {"level":30,"time":1768816956738,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","req":{"method":"OPTIONS","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64703},"msg":"incoming request"}
[api] {"level":30,"time":1768816956739,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","res":{"statusCode":204},"responseTime":1.1761670000851154,"msg":"request completed"}
[api] {"level":30,"time":1768816956740,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64704},"msg":"incoming request"}
[api] {"level":30,"time":1768816956740,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","res":{"statusCode":204},"responseTime":0.28791600093245506,"msg":"request completed"}
[api] {"level":30,"time":1768816956741,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","req":{"method":"GET","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64702},"msg":"incoming request"}
[api] {"level":30,"time":1768816956743,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64703},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] {"level":30,"time":1768816956748,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","res":{"statusCode":200},"responseTime":7.170708999037743,"msg":"request completed"}
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x2: API-5001:Skipping low liquidity token","timestamp":"2026-01-19T10:02:36.975Z","metadata":{}}
[api] {"timestamp":"2026-01-19T10:02:36.975Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"WETH","liquidity":389.8204},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816957375,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64704},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"timestamp":"2026-01-19T10:02:37.776Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"arbitrum","count":61,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:37.776Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":65,"chain":"arbitrum","durationMs":13743},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 65 trending tokens for Arbitrum
[api] Saved 65 trending tokens for arbitrum to database and memory cache
[api] [TokenJob] Saved 65 tokens for Arbitrum to DB + cache
[api] {"level":30,"time":1768816959425,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64702},"msg":"incoming request"}
[api] {"level":30,"time":1768816959426,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","res":{"statusCode":204},"responseTime":0.7825840003788471,"msg":"request completed"}
[api] {"level":30,"time":1768816959428,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","req":{"method":"OPTIONS","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64731},"msg":"incoming request"}
[api] {"level":30,"time":1768816959429,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","res":{"statusCode":204},"responseTime":0.5765840001404285,"msg":"request completed"}
[api] {"level":30,"time":1768816959429,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64702},"msg":"incoming request"}
[api] {"level":30,"time":1768816959434,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64732},"msg":"incoming request"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=hi...
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] {"level":30,"time":1768816959438,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","req":{"method":"POST","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64731},"msg":"incoming request"}
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] {"level":30,"time":1768816959442,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","res":{"statusCode":200},"responseTime":13.17408400028944,"msg":"request completed"}
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1768816959450,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","res":{"statusCode":200},"responseTime":11.8240419998765,"msg":"request completed"}
[api] {"level":30,"time":1768816959452,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkzy4t1001vfq8q411l1gap","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64702},"msg":"incoming request"}
[api] {"level":30,"time":1768816959453,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","res":{"statusCode":204},"responseTime":0.34549999982118607,"msg":"request completed"}
[api] {"level":30,"time":1768816959454,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","req":{"method":"GET","url":"/api/chat/sessions/cmkkzy4t1001vfq8q411l1gap","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64731},"msg":"incoming request"}
[api] {"level":30,"time":1768816959464,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","res":{"statusCode":200},"responseTime":10.228250000625849,"msg":"request completed"}
[api] {"level":30,"time":1768816959468,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkzy4t1001vfq8q411l1gap/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64702},"msg":"incoming request"}
[api] {"level":30,"time":1768816959469,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","res":{"statusCode":204},"responseTime":0.6140829995274544,"msg":"request completed"}
[api] {"level":30,"time":1768816959471,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","req":{"method":"POST","url":"/api/chat/sessions/cmkkzy4t1001vfq8q411l1gap/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64731},"msg":"incoming request"}
[api] {"level":30,"time":1768816959492,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","res":{"statusCode":200},"responseTime":21.17374999821186,"msg":"request completed"}
[api] {"level":30,"time":1768816959505,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64702},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] {"level":30,"time":1768816959508,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWtoenc0aGMwMXJpZ3EwY3Zwc3ppZGQ2IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3Njg4MTU0MTQsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc2ODgxOTAxNH0.PX3csR9tJ_vMna3q7x9SzNjY9IpWK7chhp2IhnkKK5EEXEbxePpeefrwbOFaw34V5Y1Ly4UHex--m3BBlSmI2A","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64733},"msg":"incoming request"}
[api] {"timestamp":"2026-01-19T10:02:39.509Z","level":"INFO","code":"WS-8001","message":"ChatWS Client connected","metadata":{"traceId":"5c33344a-522d-467a-95c7-1bed4e123de3","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1},"service":"kiko-api","env":"production"}
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] [ChatWorker] Running task cmkkzy4u40023fq8qt1eaz406 for session cmkkzy4t1001vfq8q411l1gap
[api] {"timestamp":"2026-01-19T10:02:41.054Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:41.055Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:41.059Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[python] INFO:moderation.router:Moderating input: hi...
[api] [TokenJob] Tokens for Optimism are fresh, skipping API call
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:64755 - "POST /moderation/input HTTP/1.1" 200 OK
[api] {"timestamp":"2026-01-19T10:02:43.199Z","level":"INFO","code":"SYS-1007","message":"Moderation Input check result","metadata":{"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:43.203Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Sent message_start for cmkkzy4u20021fq8quh2dkqe5
[api] [ChatWorker] Base filtered to 41 tools for message: "hi..."
[api] [ChatWorker] 🔍 RAG check for: "hi..."
[api] [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cmkkzy4u40023fq8qt1eaz406
[api] {"timestamp":"2026-01-19T10:02:43.205Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
[api] {"timestamp":"2026-01-19T10:02:43.208Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816963251,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64731},"msg":"incoming request"}
[api] {"level":30,"time":1768816963251,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","res":{"statusCode":204},"responseTime":0.46458400040864944,"msg":"request completed"}
[api] {"level":30,"time":1768816963253,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64731},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"timestamp":"2026-01-19T10:02:44.879Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"b74ef198-b156-4e5b-aafa-a50b1b760d48","address":"0x0129614474d4b1df7053cc18c4e1cb646c563332"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:44.892Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"b74ef198-b156-4e5b-aafa-a50b1b760d48","address":"0x01af27cd29eaab7392039c9fae18a5c86938b96a"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:44.900Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"b74ef198-b156-4e5b-aafa-a50b1b760d48","address":"0x0077ae08200c05af9741b38366e26f7b1e7bfe2d"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:44.941Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"b74ef198-b156-4e5b-aafa-a50b1b760d48","address":"0x04acf03e000f1e982d619c7f40c75ffa32303c77"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816966114,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkzy4t1001vfq8q411l1gap","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64802},"msg":"incoming request"}
[api] {"level":30,"time":1768816966115,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","res":{"statusCode":204},"responseTime":0.557667002081871,"msg":"request completed"}
[api] {"level":30,"time":1768816966118,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-u","req":{"method":"GET","url":"/api/chat/sessions/cmkkzy4t1001vfq8q411l1gap","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64802},"msg":"incoming request"}
[api] {"level":30,"time":1768816966127,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-u","res":{"statusCode":200},"responseTime":8.624000001698732,"msg":"request completed"}
[api] {"level":30,"time":1768816966129,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-v","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64802},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"timestamp":"2026-01-19T10:02:46.404Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"b74ef198-b156-4e5b-aafa-a50b1b760d48","address":"0x06943fe338e9e6d9df904b42ee0bc1d212e2c955"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:46.435Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"b74ef198-b156-4e5b-aafa-a50b1b760d48","address":"0x07d3eab4cb4e030722cfa848f6059cff839b7d61"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:47.313Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"b74ef198-b156-4e5b-aafa-a50b1b760d48","address":"0x18a1c2f95ff8e7b87804067d3aa6f7e125ba1ad9"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:47.331Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"b74ef198-b156-4e5b-aafa-a50b1b760d48","address":"0x1596d5e13ff436897ffe83c12e955b4f4f11c47f"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:47.334Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"b74ef198-b156-4e5b-aafa-a50b1b760d48","address":"0x0f689993a73351104ae69465a77759555e48bf2c"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:47.444Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"de3c6322-173f-4bbf-8cc4-3ee9f13bdabf","address":"0x1e358596f48420fe4cd147dcc850661632125e21"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:47.797Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"de3c6322-173f-4bbf-8cc4-3ee9f13bdabf","status":404,"statusText":"Not Found","error":"{\"errors\":[{\"status\":\"404\",\"title\":\"Not Found\"}],\"meta\":{\"ref_id\":\"400f5a28-add2-4d64-919c-a7451700b7d0\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1e358596f48420fe4cd147dcc850661632125e21/pools?include=base_token,quote_token","address":"0x1e358596f48420fe4cd147dcc850661632125e21","network":"base"},"service":"kiko-api","env":"production"}
[api] [TokenJob] Tokens for Polygon are fresh, skipping API call
[api] [TokenJob] Refreshed 7 chains in 43.8s
[api] {"timestamp":"2026-01-19T10:02:48.272Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"b74ef198-b156-4e5b-aafa-a50b1b760d48","address":"0x1e358596f48420fe4cd147dcc850661632125e21"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:48.289Z","level":"INFO","code":"AI-6001","message":"Timer finished: intent_parsing_496857cf","metadata":{"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"general_query","highLevelIntent":"GENERAL_CHAT","hasAI":true,"confidence":0.3,"routingStage":"hybrid","conflict":"multi","labels":[{"label":"GENERAL_CHAT","confidence":0.3},{"label":"PREDICTION_MARKETS","confidence":0.23094010767585035},{"label":"TRADING","confidence":0}],"durationMs":5080,"timerLabel":"intent_parsing_496857cf"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:48.296Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Task cmkkzy4u40023fq8qt1eaz406 failed: TypeError: Cannot read properties of undefined (reading 'includes')
[api]     at <anonymous> (/Users/almurat/KiKo/kiko-api/src/skills/registry.ts:129:36)
[api]     at Array.filter (<anonymous>)
[api]     at Registry.getSkillsByIntent (/Users/almurat/KiKo/kiko-api/src/skills/registry.ts:128:49)
[api]     at ChatWorker.processDeepSeekTask (/Users/almurat/KiKo/kiko-api/src/jobs/chatWorker.ts:493:53)
[api]     at async ChatWorker.runTask (/Users/almurat/KiKo/kiko-api/src/jobs/chatWorker.ts:299:17)
[api] {"timestamp":"2026-01-19T10:02:48.311Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:48.412Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"b74ef198-b156-4e5b-aafa-a50b1b760d48","address":"0x2107bdfb49d6812d791bd5d3de583db4eb8be02e"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:48.517Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"b74ef198-b156-4e5b-aafa-a50b1b760d48","status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1e358596f48420fe4cd147dcc850661632125e21/pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:49.986Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"e843fce0-e2ab-4202-a7e7-959ff7a024c9","address":"0x2c12fabe87b10dfdf9674d2e409130b5a79ad88c"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:49.990Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"e843fce0-e2ab-4202-a7e7-959ff7a024c9","address":"0x2c85854a16a5400e002e16ce7a0d4d733a0b7faa"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:52.265Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"b74ef198-b156-4e5b-aafa-a50b1b760d48","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1e358596f48420fe4cd147dcc850661632125e21/pools?include=base_token,quote_token","address":"0x1e358596f48420fe4cd147dcc850661632125e21","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:52.411Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"b74ef198-b156-4e5b-aafa-a50b1b760d48","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x2107bdfb49d6812d791bd5d3de583db4eb8be02e/pools?include=base_token,quote_token","address":"0x2107bdfb49d6812d791bd5d3de583db4eb8be02e","network":"base"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816972413,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","res":{"statusCode":200},"responseTime":15670.266417000443,"msg":"request completed"}
[api] {"level":30,"time":1768816972413,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","res":{"statusCode":200},"responseTime":15037.359417002648,"msg":"request completed"}
[api] {"level":30,"time":1768816972413,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","res":{"statusCode":200},"responseTime":12907.992791999131,"msg":"request completed"}
[api] {"level":30,"time":1768816972413,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","res":{"statusCode":200},"responseTime":12978.969459000975,"msg":"request completed"}
[api] {"level":30,"time":1768816972413,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","res":{"statusCode":200},"responseTime":9159.76000000164,"msg":"request completed"}
[api] {"level":30,"time":1768816972414,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64703},"msg":"incoming request"}
[api] {"level":30,"time":1768816972415,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-x","req":{"method":"GET","url":"/api/chat/sessions/cmkkzy4t1001vfq8q411l1gap","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64704},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] {"level":30,"time":1768816972415,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64702},"msg":"incoming request"}
[api] {"level":30,"time":1768816972416,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","res":{"statusCode":204},"responseTime":0.1724580004811287,"msg":"request completed"}
[api] {"level":30,"time":1768816972416,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-z","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64732},"msg":"incoming request"}
[api] {"level":30,"time":1768816972416,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-z","res":{"statusCode":204},"responseTime":0.04975000023841858,"msg":"request completed"}
[api] {"level":30,"time":1768816972417,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-10","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64731},"msg":"incoming request"}
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] {"level":30,"time":1768816972419,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-11","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64702},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1768816972421,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-x","res":{"statusCode":200},"responseTime":5.979833997786045,"msg":"request completed"}
[api] {"level":30,"time":1768816973816,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-12","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkzy4t1001vfq8q411l1gap","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64732},"msg":"incoming request"}
[api] {"level":30,"time":1768816973817,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-12","res":{"statusCode":204},"responseTime":0.6886250004172325,"msg":"request completed"}
[api] {"level":30,"time":1768816973820,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-13","req":{"method":"GET","url":"/api/chat/sessions/cmkkzy4t1001vfq8q411l1gap","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64704},"msg":"incoming request"}
[api] {"level":30,"time":1768816973828,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-13","res":{"statusCode":200},"responseTime":7.649250000715256,"msg":"request completed"}
[api] {"timestamp":"2026-01-19T10:02:53.973Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"e843fce0-e2ab-4202-a7e7-959ff7a024c9","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x2c12fabe87b10dfdf9674d2e409130b5a79ad88c/pools?include=base_token,quote_token","address":"0x2c12fabe87b10dfdf9674d2e409130b5a79ad88c","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:53.980Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"e843fce0-e2ab-4202-a7e7-959ff7a024c9","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x2c85854a16a5400e002e16ce7a0d4d733a0b7faa/pools?include=base_token,quote_token","address":"0x2c85854a16a5400e002e16ce7a0d4d733a0b7faa","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:54.309Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"e843fce0-e2ab-4202-a7e7-959ff7a024c9","address":"0x35ce2d60f6d569afb0666a54bc4c7f9d0a333036"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x12: API-5004:External API requested retry","timestamp":"2026-01-19T10:02:54.558Z","metadata":{"traceId":"e843fce0-e2ab-4202-a7e7-959ff7a024c9"}}
[api] {"timestamp":"2026-01-19T10:02:54.558Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"e843fce0-e2ab-4202-a7e7-959ff7a024c9","status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x35ce2d60f6d569afb0666a54bc4c7f9d0a333036/pools"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816977203,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-14","req":{"method":"GET","url":"/api/config/auth-key-id","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64732},"msg":"incoming request"}
[api] {"level":30,"time":1768816977204,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-14","res":{"statusCode":200},"responseTime":1.0718749985098839,"msg":"request completed"}
[api] {"level":30,"time":1768816977207,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-15","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWtoenc0aGMwMXJpZ3EwY3Zwc3ppZGQ2IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3Njg4MTU0MTQsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc2ODgxOTAxNH0.PX3csR9tJ_vMna3q7x9SzNjY9IpWK7chhp2IhnkKK5EEXEbxePpeefrwbOFaw34V5Y1Ly4UHex--m3BBlSmI2A","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64884},"msg":"incoming request"}
[api] {"timestamp":"2026-01-19T10:02:57.209Z","level":"INFO","code":"WS-8001","message":"ChatWS Client connected","metadata":{"traceId":"14c55d96-b438-4a2b-b59d-215d74f6ef9a","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816977209,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-16","req":{"method":"OPTIONS","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64704},"msg":"incoming request"}
[api] {"level":30,"time":1768816977209,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-16","res":{"statusCode":204},"responseTime":0.3365419991314411,"msg":"request completed"}
[api] {"level":30,"time":1768816977210,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-17","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64732},"msg":"incoming request"}
[api] {"level":30,"time":1768816977212,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-18","req":{"method":"GET","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64704},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] {"level":30,"time":1768816977216,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-18","res":{"statusCode":200},"responseTime":4.401250001043081,"msg":"request completed"}
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"timestamp":"2026-01-19T10:02:57.510Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5b32e41b-ac65-4932-8a03-8665e5c5b94d","address":"0x2107bdfb49d6812d791bd5d3de583db4eb8be02e"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:57.517Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5b32e41b-ac65-4932-8a03-8665e5c5b94d","address":"0x2c85854a16a5400e002e16ce7a0d4d733a0b7faa"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:57.519Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5b32e41b-ac65-4932-8a03-8665e5c5b94d","address":"0x1e358596f48420fe4cd147dcc850661632125e21"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:57.537Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5b32e41b-ac65-4932-8a03-8665e5c5b94d","address":"0x2c12fabe87b10dfdf9674d2e409130b5a79ad88c"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816977827,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-19","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64704},"msg":"incoming request"}
[api] {"level":30,"time":1768816977828,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-19","res":{"statusCode":204},"responseTime":0.4255409985780716,"msg":"request completed"}
[api] {"level":30,"time":1768816977830,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1a","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64704},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1768816978121,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1b","req":{"method":"GET","url":"/api/chat/sessions/cmkkzy4t1001vfq8q411l1gap","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64891},"msg":"incoming request"}
[api] {"level":30,"time":1768816978126,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1b","res":{"statusCode":200},"responseTime":5.526457998901606,"msg":"request completed"}
[api] {"level":30,"time":1768816978145,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1c","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64891},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"timestamp":"2026-01-19T10:02:58.296Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"e843fce0-e2ab-4202-a7e7-959ff7a024c9","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x35ce2d60f6d569afb0666a54bc4c7f9d0a333036/pools?include=base_token,quote_token","address":"0x35ce2d60f6d569afb0666a54bc4c7f9d0a333036","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:58.638Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"e843fce0-e2ab-4202-a7e7-959ff7a024c9","address":"0x3fc63cb55dd2f2d14bb9a581ebee1a43ea668b76"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:02:58.656Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"e843fce0-e2ab-4202-a7e7-959ff7a024c9","address":"0x4709ac37a7e3f97aec93796db2a214339b03c7c7"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816979250,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1d","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64900},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x11: API-5004:External API requested retry","timestamp":"2026-01-19T10:02:59.699Z","metadata":{"traceId":"5b32e41b-ac65-4932-8a03-8665e5c5b94d"}}
[api] {"timestamp":"2026-01-19T10:02:59.699Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"5b32e41b-ac65-4932-8a03-8665e5c5b94d","status":429,"attempt":2,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1e358596f48420fe4cd147dcc850661632125e21/pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:00.168Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"9d95892e-5507-4e63-8b23-dc09ff97293d","address":"0x35ce2d60f6d569afb0666a54bc4c7f9d0a333036"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816981180,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1e","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkzy4t1001vfq8q411l1gap","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64909},"msg":"incoming request"}
[api] {"level":30,"time":1768816981180,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1e","res":{"statusCode":204},"responseTime":0.36524999886751175,"msg":"request completed"}
[api] {"level":30,"time":1768816981182,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1f","req":{"method":"DELETE","url":"/api/chat/sessions/cmkkzy4t1001vfq8q411l1gap","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":64909},"msg":"incoming request"}
[api] {"level":30,"time":1768816981191,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1f","res":{"statusCode":200},"responseTime":8.373082999140024,"msg":"request completed"}
[api] {"timestamp":"2026-01-19T10:03:01.477Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"5b32e41b-ac65-4932-8a03-8665e5c5b94d","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x2c85854a16a5400e002e16ce7a0d4d733a0b7faa/pools?include=base_token,quote_token","address":"0x2c85854a16a5400e002e16ce7a0d4d733a0b7faa","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:01.491Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"5b32e41b-ac65-4932-8a03-8665e5c5b94d","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x2107bdfb49d6812d791bd5d3de583db4eb8be02e/pools?include=base_token,quote_token","address":"0x2107bdfb49d6812d791bd5d3de583db4eb8be02e","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:02.127Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"4bdca875-62d3-482d-83bd-11c97ecc08be","address":"0x2107bdfb49d6812d791bd5d3de583db4eb8be02e"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:02.136Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"4bdca875-62d3-482d-83bd-11c97ecc08be","address":"0x2c85854a16a5400e002e16ce7a0d4d733a0b7faa"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:02.199Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"5b32e41b-ac65-4932-8a03-8665e5c5b94d","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1e358596f48420fe4cd147dcc850661632125e21/pools?include=base_token,quote_token","address":"0x1e358596f48420fe4cd147dcc850661632125e21","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:02.210Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"5b32e41b-ac65-4932-8a03-8665e5c5b94d","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x2c12fabe87b10dfdf9674d2e409130b5a79ad88c/pools?include=base_token,quote_token","address":"0x2c12fabe87b10dfdf9674d2e409130b5a79ad88c","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:02.646Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"e843fce0-e2ab-4202-a7e7-959ff7a024c9","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x4709ac37a7e3f97aec93796db2a214339b03c7c7/pools?include=base_token,quote_token","address":"0x4709ac37a7e3f97aec93796db2a214339b03c7c7","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:02.974Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"e843fce0-e2ab-4202-a7e7-959ff7a024c9","address":"0x4d1aa95f03042718cf489415b999bffb28b3d376"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:03.027Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"e843fce0-e2ab-4202-a7e7-959ff7a024c9","address":"0x4f38ce38be7c33cc693f8ae3aa7e24f33a493721"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T10:03:04.032Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:04.147Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"9d95892e-5507-4e63-8b23-dc09ff97293d","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x35ce2d60f6d569afb0666a54bc4c7f9d0a333036/pools?include=base_token,quote_token","address":"0x35ce2d60f6d569afb0666a54bc4c7f9d0a333036","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:04.401Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"9d95892e-5507-4e63-8b23-dc09ff97293d","address":"0x4709ac37a7e3f97aec93796db2a214339b03c7c7"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x18: API-5004:External API requested retry","timestamp":"2026-01-19T10:03:04.843Z","metadata":{"traceId":"4bdca875-62d3-482d-83bd-11c97ecc08be"}}
[api] {"timestamp":"2026-01-19T10:03:04.843Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"4bdca875-62d3-482d-83bd-11c97ecc08be","status":429,"attempt":3,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x2107bdfb49d6812d791bd5d3de583db4eb8be02e/pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:07.016Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"e843fce0-e2ab-4202-a7e7-959ff7a024c9","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x4f38ce38be7c33cc693f8ae3aa7e24f33a493721/pools?include=base_token,quote_token","address":"0x4f38ce38be7c33cc693f8ae3aa7e24f33a493721","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:07.342Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5b32e41b-ac65-4932-8a03-8665e5c5b94d","address":"0x50b630d4fe4c601cfd38123f996478b2f825ce14"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:07.347Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5b32e41b-ac65-4932-8a03-8665e5c5b94d","address":"0x581632b90ab75c871641fef5ce51dfd528e45aee"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:07.392Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"5b32e41b-ac65-4932-8a03-8665e5c5b94d","address":"0x50c75903a5fe9acc87cce2706c43625e59076b57"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:08.372Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"9d95892e-5507-4e63-8b23-dc09ff97293d","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x4709ac37a7e3f97aec93796db2a214339b03c7c7/pools?include=base_token,quote_token","address":"0x4709ac37a7e3f97aec93796db2a214339b03c7c7","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:08.621Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"9d95892e-5507-4e63-8b23-dc09ff97293d","address":"0x4f38ce38be7c33cc693f8ae3aa7e24f33a493721"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x12: API-5004:External API requested retry","timestamp":"2026-01-19T10:03:10.076Z","metadata":{"traceId":"5b32e41b-ac65-4932-8a03-8665e5c5b94d"}}
[api] {"timestamp":"2026-01-19T10:03:10.076Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"5b32e41b-ac65-4932-8a03-8665e5c5b94d","status":429,"attempt":3,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x50b630d4fe4c601cfd38123f996478b2f825ce14/pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:11.316Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"5b32e41b-ac65-4932-8a03-8665e5c5b94d","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x50b630d4fe4c601cfd38123f996478b2f825ce14/pools?include=base_token,quote_token","address":"0x50b630d4fe4c601cfd38123f996478b2f825ce14","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:11.318Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"5b32e41b-ac65-4932-8a03-8665e5c5b94d","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x581632b90ab75c871641fef5ce51dfd528e45aee/pools?include=base_token,quote_token","address":"0x581632b90ab75c871641fef5ce51dfd528e45aee","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:12.585Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"9d95892e-5507-4e63-8b23-dc09ff97293d","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x4f38ce38be7c33cc693f8ae3aa7e24f33a493721/pools?include=base_token,quote_token","address":"0x4f38ce38be7c33cc693f8ae3aa7e24f33a493721","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:12.833Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"9d95892e-5507-4e63-8b23-dc09ff97293d","address":"0x581632b90ab75c871641fef5ce51dfd528e45aee"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:13.633Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"9d95892e-5507-4e63-8b23-dc09ff97293d","address":"0x598b6297eeb4988d65ca883fecab6b9e01e7fff7"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x8: API-5004:External API requested retry","timestamp":"2026-01-19T10:03:15.567Z","metadata":{"traceId":"9d95892e-5507-4e63-8b23-dc09ff97293d"}}
[api] {"timestamp":"2026-01-19T10:03:15.567Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"9d95892e-5507-4e63-8b23-dc09ff97293d","status":429,"attempt":3,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x581632b90ab75c871641fef5ce51dfd528e45aee/pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:03:16.816Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"9d95892e-5507-4e63-8b23-dc09ff97293d","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x581632b90ab75c871641fef5ce51dfd528e45aee/pools?include=base_token,quote_token","address":"0x581632b90ab75c871641fef5ce51dfd528e45aee","network":"base"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768816996818,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-17","res":{"statusCode":200},"responseTime":19608.435166999698,"msg":"request completed"}
[api] {"level":30,"time":1768816996818,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1a","res":{"statusCode":200},"responseTime":18988.626250002533,"msg":"request completed"}
[api] {"level":30,"time":1768816996818,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1c","res":{"statusCode":200},"responseTime":18673.852791998535,"msg":"request completed"}
[api] {"level":30,"time":1768816996819,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1d","res":{"statusCode":200},"responseTime":17568.629292000085,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T10:03:34.115Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T10:04:04.120Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T10:04:34.125Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
[api] {"timestamp":"2026-01-19T10:05:00.201Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"ethereum","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:05:00.202Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T10:05:04.129Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:05:04.216Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":23,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:05:09.771Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"XCAD","liquidity":701.2957},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:05:09.771Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"eth","count":125,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:05:09.772Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"ethereum","durationMs":9571},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for Ethereum
[api] Saved 100 trending tokens for eth to database and memory cache
[api] [TokenJob] Saved 100 tokens for Ethereum to DB + cache
[api] [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
[api] {"timestamp":"2026-01-19T10:05:14.830Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"solana","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:05:14.830Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:05:22.209Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":127,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:05:22.210Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"solana","durationMs":7380},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for Solana
[api] Saved 100 trending tokens for solana to database and memory cache
[api] [TokenJob] Saved 100 tokens for Solana to DB + cache
[api] [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
[api] {"timestamp":"2026-01-19T10:05:27.257Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"base","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:05:28.751Z","level":"INFO","code":"WTC-2002","message":"Found addresses via WebSocket","metadata":{"count":174,"chain":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:05:32.600Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":40,"limit":200},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T10:05:34.133Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x3: API-5001:Skipping low liquidity token","timestamp":"2026-01-19T10:05:35.153Z","metadata":{}}
[api] {"timestamp":"2026-01-19T10:05:35.153Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"WETH","liquidity":128.5574},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:05:38.226Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"base","count":98,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:05:38.227Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"base","durationMs":10970},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for Base
[api] Saved 100 trending tokens for base to database and memory cache
[api] [TokenJob] Saved 100 tokens for Base to DB + cache
[api] [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
[api] {"timestamp":"2026-01-19T10:05:43.273Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"bsc","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:05:44.828Z","level":"INFO","code":"WTC-2002","message":"Found addresses via WebSocket","metadata":{"count":195,"chain":"bsc"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:05:48.813Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":33,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:05:49.772Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/bsc/trending_pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:05:53.520Z","level":"ERROR","code":"API-5002","message":"API error on trending page","metadata":{"page":1,"status":429,"statusText":"Too Many Requests"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:05:53.520Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"bsc","count":0,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:05:53.520Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":75,"chain":"bsc","durationMs":10247},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 75 trending tokens for BSC
[api] Saved 75 trending tokens for bsc to database and memory cache
[api] [TokenJob] Saved 75 tokens for BSC to DB + cache
[api] [TokenJob] Tokens for Arbitrum are fresh, skipping API call
[api] [TokenJob] Fetching trending tokens for Optimism via DexScreener Premium...
[api] {"timestamp":"2026-01-19T10:06:03.553Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"optimism","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:03.553Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T10:06:04.136Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:07.539Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":12,"limit":200},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x2: API-5001:Skipping low liquidity token","timestamp":"2026-01-19T10:06:10.275Z","metadata":{}}
[api] {"timestamp":"2026-01-19T10:06:10.275Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"OP","liquidity":834.9856},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x3: API-5004:External API requested retry","timestamp":"2026-01-19T10:06:11.445Z","metadata":{}}
[api] {"timestamp":"2026-01-19T10:06:11.446Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/optimism/trending_pools"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x11: API-5001:Skipping low liquidity token","timestamp":"2026-01-19T10:06:16.311Z","metadata":{}}
[api] {"timestamp":"2026-01-19T10:06:16.311Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"VELO","liquidity":581.9888},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x3: API-5004:External API requested retry","timestamp":"2026-01-19T10:06:16.759Z","metadata":{}}
[api] {"timestamp":"2026-01-19T10:06:16.759Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/optimism/trending_pools"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x2: API-5001:Skipping low liquidity token","timestamp":"2026-01-19T10:06:21.624Z","metadata":{}}
[api] {"timestamp":"2026-01-19T10:06:21.624Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"USDC","liquidity":671.7554},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x3: API-5004:External API requested retry","timestamp":"2026-01-19T10:06:22.081Z","metadata":{}}
[api] {"timestamp":"2026-01-19T10:06:22.081Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/optimism/trending_pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:28.287Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"optimism","count":41,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:28.287Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":44,"chain":"optimism","durationMs":24734},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 44 trending tokens for Optimism
[api] Saved 44 trending tokens for optimism to database and memory cache
[api] [TokenJob] Saved 44 tokens for Optimism to DB + cache
[api] [TokenJob] Fetching trending tokens for Polygon via DexScreener Premium...
[api] {"timestamp":"2026-01-19T10:06:33.314Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"polygon","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:33.314Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T10:06:34.141Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768817197686,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1g","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkzgas80001aydx1myq35f1","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":49394},"msg":"incoming request"}
[api] {"level":30,"time":1768817197687,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1g","res":{"statusCode":204},"responseTime":0.8393750004470348,"msg":"request completed"}
[api] {"level":30,"time":1768817197689,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1h","req":{"method":"GET","url":"/api/chat/sessions/cmkkzgas80001aydx1myq35f1","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":49394},"msg":"incoming request"}
[api] {"level":30,"time":1768817197698,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1h","res":{"statusCode":200},"responseTime":8.33712500333786,"msg":"request completed"}
[api] {"level":30,"time":1768817197739,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1i","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":49394},"msg":"incoming request"}
[api] {"level":30,"time":1768817197739,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1i","res":{"statusCode":204},"responseTime":0.3277920000255108,"msg":"request completed"}
[api] {"level":30,"time":1768817197741,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1j","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":49394},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"timestamp":"2026-01-19T10:06:38.184Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":20,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:39.149Z","level":"ERROR","code":"API-5002","message":"API error on trending page","metadata":{"page":1,"status":404,"statusText":"Not Found"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:39.149Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"polygon","count":0,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:39.149Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":18,"chain":"polygon","durationMs":5835},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 18 trending tokens for Polygon
[api] Saved 18 trending tokens for polygon to database and memory cache
[api] [TokenJob] Saved 18 tokens for Polygon to DB + cache
[api] [TokenJob] Refreshed 7 chains in 99.0s
[api] {"timestamp":"2026-01-19T10:06:45.127Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"53011f89-80b2-4a3b-a2de-4606635260f1","address":"0x04acf03e000f1e982d619c7f40c75ffa32303c77"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:45.152Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"53011f89-80b2-4a3b-a2de-4606635260f1","address":"0x0077ae08200c05af9741b38366e26f7b1e7bfe2d"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:45.154Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"53011f89-80b2-4a3b-a2de-4606635260f1","address":"0x01af27cd29eaab7392039c9fae18a5c86938b96a"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:45.193Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"53011f89-80b2-4a3b-a2de-4606635260f1","address":"0x0129614474d4b1df7053cc18c4e1cb646c563332"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:46.717Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"53011f89-80b2-4a3b-a2de-4606635260f1","address":"0x06943fe338e9e6d9df904b42ee0bc1d212e2c955"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:46.730Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"53011f89-80b2-4a3b-a2de-4606635260f1","address":"0x07d3eab4cb4e030722cfa848f6059cff839b7d61"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x4: API-5004:External API requested retry","timestamp":"2026-01-19T10:06:46.987Z","metadata":{"traceId":"53011f89-80b2-4a3b-a2de-4606635260f1"}}
[api] {"timestamp":"2026-01-19T10:06:46.987Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"53011f89-80b2-4a3b-a2de-4606635260f1","status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x07d3eab4cb4e030722cfa848f6059cff839b7d61/pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:48.743Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"53011f89-80b2-4a3b-a2de-4606635260f1","address":"0x18a1c2f95ff8e7b87804067d3aa6f7e125ba1ad9"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:48.748Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"53011f89-80b2-4a3b-a2de-4606635260f1","address":"0x1596d5e13ff436897ffe83c12e955b4f4f11c47f"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:48.780Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"53011f89-80b2-4a3b-a2de-4606635260f1","address":"0x0f689993a73351104ae69465a77759555e48bf2c"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768817209321,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1k","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":49465},"msg":"incoming request"}
[api] {"level":30,"time":1768817209321,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1k","res":{"statusCode":204},"responseTime":0.3102080002427101,"msg":"request completed"}
[api] {"level":30,"time":1768817209322,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1l","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":49465},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1768817210829,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1m","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkzgas80001aydx1myq35f1","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":49484},"msg":"incoming request"}
[api] {"level":30,"time":1768817210830,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1m","res":{"statusCode":204},"responseTime":0.5072080008685589,"msg":"request completed"}
[api] {"level":30,"time":1768817210832,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1n","req":{"method":"GET","url":"/api/chat/sessions/cmkkzgas80001aydx1myq35f1","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":49484},"msg":"incoming request"}
[api] {"level":30,"time":1768817210836,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1o","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":49485},"msg":"incoming request"}
[api] {"level":30,"time":1768817210837,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1n","res":{"statusCode":200},"responseTime":5.210083000361919,"msg":"request completed"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1768817211723,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1p","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":49484},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"timestamp":"2026-01-19T10:06:52.719Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"53011f89-80b2-4a3b-a2de-4606635260f1","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1596d5e13ff436897ffe83c12e955b4f4f11c47f/pools?include=base_token,quote_token","address":"0x1596d5e13ff436897ffe83c12e955b4f4f11c47f","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:52.768Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"53011f89-80b2-4a3b-a2de-4606635260f1","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x0f689993a73351104ae69465a77759555e48bf2c/pools?include=base_token,quote_token","address":"0x0f689993a73351104ae69465a77759555e48bf2c","network":"base"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768817213076,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1q","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkyj4t2000110ulai381exs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":49502},"msg":"incoming request"}
[api] {"level":30,"time":1768817213076,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1q","res":{"statusCode":204},"responseTime":0.28254200145602226,"msg":"request completed"}
[api] {"level":30,"time":1768817213078,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1r","req":{"method":"GET","url":"/api/chat/sessions/cmkkyj4t2000110ulai381exs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":49502},"msg":"incoming request"}
[api] {"level":30,"time":1768817213083,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1r","res":{"statusCode":200},"responseTime":4.3103750012815,"msg":"request completed"}
[api] {"timestamp":"2026-01-19T10:06:53.096Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"53011f89-80b2-4a3b-a2de-4606635260f1","address":"0x1e358596f48420fe4cd147dcc850661632125e21"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768817213098,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1s","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":49502},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x9: API-5004:External API requested retry","timestamp":"2026-01-19T10:06:53.329Z","metadata":{"traceId":"53011f89-80b2-4a3b-a2de-4606635260f1"}}
[api] {"timestamp":"2026-01-19T10:06:53.329Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"53011f89-80b2-4a3b-a2de-4606635260f1","status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1e358596f48420fe4cd147dcc850661632125e21/pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:53.783Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"53011f89-80b2-4a3b-a2de-4606635260f1","address":"0x2107bdfb49d6812d791bd5d3de583db4eb8be02e"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:54.596Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"c0c90986-e9bf-4871-bc15-ee22e0105639","address":"0x1596d5e13ff436897ffe83c12e955b4f4f11c47f"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:54.606Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"c0c90986-e9bf-4871-bc15-ee22e0105639","address":"0x0f689993a73351104ae69465a77759555e48bf2c"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768817215762,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1t","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":49520},"msg":"incoming request"}
[api] {"level":30,"time":1768817215763,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1t","res":{"statusCode":204},"responseTime":1.0408749990165234,"msg":"request completed"}
[api] {"level":30,"time":1768817215764,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1u","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":49520},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   normalizedAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e'
[api] }
[api] [verifyAccess] Found user: {
[api]   userId: 'cmkgzne160000i6s0wl26q9xe',
[api]   walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
[api]   solanaWalletAddress: 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg',
[api]   walletMatch: true,
[api]   solanaMatch: false
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"timestamp":"2026-01-19T10:06:55.949Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1419c981-7cba-440a-bfe3-18dc991f4913","address":"0x2c12fabe87b10dfdf9674d2e409130b5a79ad88c"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:57.166Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"53011f89-80b2-4a3b-a2de-4606635260f1","status":404,"statusText":"Not Found","error":"{\"errors\":[{\"status\":\"404\",\"title\":\"Not Found\"}],\"meta\":{\"ref_id\":\"bc7e293c-6131-4064-ab3e-acbdf931e186\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1e358596f48420fe4cd147dcc850661632125e21/pools?include=base_token,quote_token","address":"0x1e358596f48420fe4cd147dcc850661632125e21","network":"base"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768817217168,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1j","res":{"statusCode":200},"responseTime":19426.51475000009,"msg":"request completed"}
[api] {"level":30,"time":1768817217616,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1v","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkzgas80001aydx1myq35f1","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":49394},"msg":"incoming request"}
[api] {"level":30,"time":1768817217616,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1v","res":{"statusCode":204},"responseTime":0.2701670005917549,"msg":"request completed"}
[api] {"level":30,"time":1768817217618,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1w","req":{"method":"GET","url":"/api/chat/sessions/cmkkzgas80001aydx1myq35f1","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":49394},"msg":"incoming request"}
[api] {"level":30,"time":1768817217624,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1w","res":{"statusCode":200},"responseTime":5.515957999974489,"msg":"request completed"}
[api] {"timestamp":"2026-01-19T10:06:58.542Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"c0c90986-e9bf-4871-bc15-ee22e0105639","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1596d5e13ff436897ffe83c12e955b4f4f11c47f/pools?include=base_token,quote_token","address":"0x1596d5e13ff436897ffe83c12e955b4f4f11c47f","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:58.614Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"c0c90986-e9bf-4871-bc15-ee22e0105639","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x0f689993a73351104ae69465a77759555e48bf2c/pools?include=base_token,quote_token","address":"0x0f689993a73351104ae69465a77759555e48bf2c","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:06:58.939Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"c0c90986-e9bf-4871-bc15-ee22e0105639","address":"0x2c85854a16a5400e002e16ce7a0d4d733a0b7faa"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x11: API-5004:External API requested retry","timestamp":"2026-01-19T10:06:59.171Z","metadata":{"traceId":"c0c90986-e9bf-4871-bc15-ee22e0105639"}}
[api] {"timestamp":"2026-01-19T10:06:59.172Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"c0c90986-e9bf-4871-bc15-ee22e0105639","status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x2c85854a16a5400e002e16ce7a0d4d733a0b7faa/pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:00.643Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"1419c981-7cba-440a-bfe3-18dc991f4913","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x2c12fabe87b10dfdf9674d2e409130b5a79ad88c/pools?include=base_token,quote_token","address":"0x2c12fabe87b10dfdf9674d2e409130b5a79ad88c","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:00.969Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1419c981-7cba-440a-bfe3-18dc991f4913","address":"0x35ce2d60f6d569afb0666a54bc4c7f9d0a333036"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:00.983Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"c0c90986-e9bf-4871-bc15-ee22e0105639","address":"0x3fc63cb55dd2f2d14bb9a581ebee1a43ea668b76"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:03.786Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18","address":"0x0f689993a73351104ae69465a77759555e48bf2c"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:03.793Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18","address":"0x1e358596f48420fe4cd147dcc850661632125e21"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:03.798Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18","address":"0x1596d5e13ff436897ffe83c12e955b4f4f11c47f"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:03.801Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18","address":"0x2c12fabe87b10dfdf9674d2e409130b5a79ad88c"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T10:07:04.164Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:04.236Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1419c981-7cba-440a-bfe3-18dc991f4913","address":"0x4709ac37a7e3f97aec93796db2a214339b03c7c7"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x8: API-5004:External API requested retry","timestamp":"2026-01-19T10:07:04.475Z","metadata":{"traceId":"1419c981-7cba-440a-bfe3-18dc991f4913"}}
[api] {"timestamp":"2026-01-19T10:07:04.476Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"1419c981-7cba-440a-bfe3-18dc991f4913","status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x4709ac37a7e3f97aec93796db2a214339b03c7c7/pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:04.966Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"c0c90986-e9bf-4871-bc15-ee22e0105639","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x3fc63cb55dd2f2d14bb9a581ebee1a43ea668b76/pools?include=base_token,quote_token","address":"0x3fc63cb55dd2f2d14bb9a581ebee1a43ea668b76","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:06.028Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18","status":404,"statusText":"Not Found","error":"{\"errors\":[{\"status\":\"404\",\"title\":\"Not Found\"}],\"meta\":{\"ref_id\":\"bc7e293c-6131-4064-ab3e-acbdf931e186\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1e358596f48420fe4cd147dcc850661632125e21/pools?include=base_token,quote_token","address":"0x1e358596f48420fe4cd147dcc850661632125e21","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:07.751Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x0f689993a73351104ae69465a77759555e48bf2c/pools?include=base_token,quote_token","address":"0x0f689993a73351104ae69465a77759555e48bf2c","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:08.196Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"1419c981-7cba-440a-bfe3-18dc991f4913","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x4709ac37a7e3f97aec93796db2a214339b03c7c7/pools?include=base_token,quote_token","address":"0x4709ac37a7e3f97aec93796db2a214339b03c7c7","network":"base"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768817228199,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1l","res":{"statusCode":200},"responseTime":18876.359333999455,"msg":"request completed"}
[api] {"level":30,"time":1768817228199,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1o","res":{"statusCode":200},"responseTime":17363.094124998897,"msg":"request completed"}
[api] {"timestamp":"2026-01-19T10:07:08.458Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1596d5e13ff436897ffe83c12e955b4f4f11c47f/pools?include=base_token,quote_token","address":"0x1596d5e13ff436897ffe83c12e955b4f4f11c47f","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:08.506Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x2c12fabe87b10dfdf9674d2e409130b5a79ad88c/pools?include=base_token,quote_token","address":"0x2c12fabe87b10dfdf9674d2e409130b5a79ad88c","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:08.758Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18","address":"0x4709ac37a7e3f97aec93796db2a214339b03c7c7"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:08.760Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18","address":"0x3fc63cb55dd2f2d14bb9a581ebee1a43ea668b76"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:09.300Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1419c981-7cba-440a-bfe3-18dc991f4913","address":"0x4d1aa95f03042718cf489415b999bffb28b3d376"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768817229779,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1s","res":{"statusCode":200},"responseTime":16680.936666000634,"msg":"request completed"}
[api] {"level":30,"time":1768817229779,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1p","res":{"statusCode":200},"responseTime":18056.230374999344,"msg":"request completed"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x14: API-5004:External API requested retry","timestamp":"2026-01-19T10:07:10.228Z","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18"}}
[api] {"timestamp":"2026-01-19T10:07:10.228Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18","status":429,"attempt":2,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x4709ac37a7e3f97aec93796db2a214339b03c7c7/pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:12.728Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x3fc63cb55dd2f2d14bb9a581ebee1a43ea668b76/pools?include=base_token,quote_token","address":"0x3fc63cb55dd2f2d14bb9a581ebee1a43ea668b76","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:13.922Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18","address":"0x50b630d4fe4c601cfd38123f996478b2f825ce14"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:13.968Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18","address":"0x4f38ce38be7c33cc693f8ae3aa7e24f33a493721"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x6: API-5004:External API requested retry","timestamp":"2026-01-19T10:07:15.455Z","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18"}}
[api] {"timestamp":"2026-01-19T10:07:15.455Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18","status":429,"attempt":2,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x4f38ce38be7c33cc693f8ae3aa7e24f33a493721/pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:17.925Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x4f38ce38be7c33cc693f8ae3aa7e24f33a493721/pools?include=base_token,quote_token","address":"0x4f38ce38be7c33cc693f8ae3aa7e24f33a493721","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:18.996Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18","address":"0x581632b90ab75c871641fef5ce51dfd528e45aee"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:18.998Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18","address":"0x598b6297eeb4988d65ca883fecab6b9e01e7fff7"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:19.037Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18","address":"0x50c75903a5fe9acc87cce2706c43625e59076b57"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x3: API-5004:External API requested retry","timestamp":"2026-01-19T10:07:21.208Z","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18"}}
[api] {"timestamp":"2026-01-19T10:07:21.208Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18","status":429,"attempt":2,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x50c75903a5fe9acc87cce2706c43625e59076b57/pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T10:07:23.690Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"0e848590-637e-4d94-9b7e-62c84102fc18","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x50c75903a5fe9acc87cce2706c43625e59076b57/pools?include=base_token,quote_token","address":"0x50c75903a5fe9acc87cce2706c43625e59076b57","network":"base"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768817243692,"pid":21755,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1u","res":{"statusCode":200},"responseTime":27927.615833003074,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T10:07:34.168Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T10:08:04.173Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}

