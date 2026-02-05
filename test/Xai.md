[api] [2026-02-05T14:18:24.896Z] [INFO] [SYS-1001] RPC health monitor started
[api] [2026-02-05T14:18:24.898Z] [INFO] [SYS-1001] RPC benchmark sampling started
[api] [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
[api] [TokenJob] Scheduled: Primary chains every 5min (Ethereum, Solana, Base, BSC)
[api] [TokenJob] Scheduled: Secondary chains every 4h (Arbitrum, Optimism, Polygon)
[api] [SocialJob] Scheduled: Discovery (30m), Refresh (4h), Scoring (5m)
[api] [2026-02-05T14:18:24.910Z] [INFO] [SYS-1001] Background jobs started
[api] [2026-02-05T14:18:24.910Z] [INFO] [SYS-1001] Initializing auto trade service...
[api] [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
[api] [2026-02-05T14:18:24.910Z] [INFO] [SYS-1001] Auto trade service initialized (Solana watcher + EVM webhook enabled) | DATA: {"mode":"hybrid"}
[api] [2026-02-05T14:18:24.910Z] [INFO] [SYS-1001] Auto trade service started
[api] [PositionMonitor] Starting position monitor (every 30s)...
[api] [2026-02-05T14:18:24.910Z] [INFO] [SYS-1001] Position monitor started
[api] [2026-02-05T14:18:24.910Z] [INFO] [SYS-1001] Token Alert Service started
[api] [2026-02-05T14:18:24.910Z] [INFO] [SYS-1001] Token alert service started
[api] [ChatWorker] Started polling for AI tasks (interval: 3000ms)
[api] [2026-02-05T14:18:24.910Z] [INFO] [SYS-1001] Chat worker started
[api] [2026-02-05T14:18:24.911Z] [INFO] [SYS-1001] Starting Global Zora Alpha Detector (API Polling) | DATA: {"thresholds":{"farcaster":50000,"twitter":500000,"instagram":500000,"tiktok":500000},"interval":60000}
[api] [2026-02-05T14:18:24.911Z] [INFO] [SYS-1001] 🎉 All services initialized!
[api] [DataRetention] Cleanup job completed.
[api] {"level":30,"time":1770301106222,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWt0Zm5oa3gwMGNka3kwYzN0M2xtMzZpIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzAyOTg0MDEsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc3MDMwMjAwMX0.9256aXGbqkZr2ut5-gdTeZbiaJllM6vezsNM7gSDRbSRR__bXPZz7i4PaBhhQFUqtCI6UywPsuHZtNp3mOQ_CA","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53498},"msg":"incoming request"}
[api] [2026-02-05T14:18:27.348Z] [INFO] [WS-8001][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] ChatWS Client connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1}
[api] [2026-02-05T14:18:27.348Z] [INFO] [WS-8001][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] ChatWS: User connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl2...","tokenExp":1770302001}
[api] [MarketJob] Running startup staleness check...
[api] [PositionMonitor] 🔄 Running position check...
[api] [MarketJob] Overview is fresh, skipping API call
[api] [MarketJob] Protocols are fresh, skipping API call
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [Job] ✅ Loaded 436 real hot users from /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Job] ✅ Using 436 real hot users from analysis
[api] [SocialJob] fetchCastsFromUsers starting with 436 FIDs, target: 1000
[api] [2026-02-05T14:18:29.941Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770301118953,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53741},"msg":"incoming request"}
[api] {"level":30,"time":1770301118956,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","res":{"statusCode":204},"responseTime":3.235416002571583,"msg":"request completed"}
[api] {"level":30,"time":1770301118957,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53741},"msg":"incoming request"}
[api] {"level":30,"time":1770301118961,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","req":{"method":"OPTIONS","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53743},"msg":"incoming request"}
[api] {"level":30,"time":1770301118962,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","res":{"statusCode":204},"responseTime":0.2969999983906746,"msg":"request completed"}
[api] {"level":30,"time":1770301118964,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53744},"msg":"incoming request"}
[api] {"level":30,"time":1770301118964,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","res":{"statusCode":204},"responseTime":0.22766699641942978,"msg":"request completed"}
[api] {"level":30,"time":1770301118965,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","req":{"method":"GET","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53743},"msg":"incoming request"}
[api] {"level":30,"time":1770301118966,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWt0Zm5oa3gwMGNka3kwYzN0M2xtMzZpIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzAyOTg0MDEsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc3MDMwMjAwMX0.9256aXGbqkZr2ut5-gdTeZbiaJllM6vezsNM7gSDRbSRR__bXPZz7i4PaBhhQFUqtCI6UywPsuHZtNp3mOQ_CA","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53745},"msg":"incoming request"}
[api] [2026-02-05T14:18:38.969Z] [INFO] [WS-8001][TID:04e1be8b-7745-42cc-adc8-e99eb41e70cf] ChatWS Client connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1}
[api] [2026-02-05T14:18:38.969Z] [INFO] [WS-8001][TID:04e1be8b-7745-42cc-adc8-e99eb41e70cf] ChatWS: User connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl2...","tokenExp":1770302001}
[api] {"level":30,"time":1770301118968,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53744},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   userIdLength: 35,
[api]   userIdPrefix: 'did:privy:cmj0a3j3f0',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] {"level":30,"time":1770301118970,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","res":{"statusCode":200},"responseTime":5.09595799446106,"msg":"request completed"}
[api] {"level":30,"time":1770301118973,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","res":{"statusCode":200},"responseTime":16.463500000536442,"msg":"request completed"}
[api] [verifyAccess] ✅ Access granted
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:18:39.946Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770301124263,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","res":{"statusCode":200},"responseTime":5294.489334002137,"msg":"request completed"}
[api] {"level":30,"time":1770301124267,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53743},"msg":"incoming request"}
[api] {"level":30,"time":1770301124268,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","res":{"statusCode":204},"responseTime":1.2439169958233833,"msg":"request completed"}
[api] {"level":30,"time":1770301124269,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53741},"msg":"incoming request"}
[api] {"level":30,"time":1770301126662,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","res":{"statusCode":200},"responseTime":2393.2967080026865,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:18:49.958Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770301130429,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53744},"msg":"incoming request"}
[api] {"level":30,"time":1770301130431,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","res":{"statusCode":204},"responseTime":1.1697919964790344,"msg":"request completed"}
[api] {"level":30,"time":1770301130432,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53744},"msg":"incoming request"}
[api] {"level":30,"time":1770301130438,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","req":{"method":"OPTIONS","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53743},"msg":"incoming request"}
[api] {"level":30,"time":1770301130439,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","res":{"statusCode":204},"responseTime":0.8957919999957085,"msg":"request completed"}
[api] {"level":30,"time":1770301130439,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53741},"msg":"incoming request"}
[api] {"level":30,"time":1770301130440,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","res":{"statusCode":204},"responseTime":0.18041599541902542,"msg":"request completed"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=what's my balance ?...
[api] {"level":30,"time":1770301130442,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","req":{"method":"POST","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53743},"msg":"incoming request"}
[api] {"level":30,"time":1770301130444,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53741},"msg":"incoming request"}
[api] {"level":30,"time":1770301130448,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","res":{"statusCode":200},"responseTime":15.899500004947186,"msg":"request completed"}
[api] {"level":30,"time":1770301130454,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","res":{"statusCode":200},"responseTime":11.82354199886322,"msg":"request completed"}
[api] {"level":30,"time":1770301130457,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9jl2hc00026bas9qpal9v7","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53744},"msg":"incoming request"}
[api] {"level":30,"time":1770301130458,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","res":{"statusCode":204},"responseTime":0.2332499995827675,"msg":"request completed"}
[api] {"level":30,"time":1770301130459,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","req":{"method":"GET","url":"/api/chat/sessions/cml9jl2hc00026bas9qpal9v7","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53743},"msg":"incoming request"}
[api] {"level":30,"time":1770301130464,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","res":{"statusCode":200},"responseTime":5.165624998509884,"msg":"request completed"}
[api] {"level":30,"time":1770301130469,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9jl2hc00026bas9qpal9v7/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53744},"msg":"incoming request"}
[api] {"level":30,"time":1770301130469,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","res":{"statusCode":204},"responseTime":0.1716660037636757,"msg":"request completed"}
[api] {"level":30,"time":1770301130470,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","req":{"method":"POST","url":"/api/chat/sessions/cml9jl2hc00026bas9qpal9v7/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53743},"msg":"incoming request"}
[api] [TokenJob] Starting initial token refresh...
[api] [TokenJob] Tokens for Ethereum are fresh, skipping API call
[api] {"level":30,"time":1770301135268,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","res":{"statusCode":200},"responseTime":4823.331832997501,"msg":"request completed"}
[api] {"level":30,"time":1770301135441,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","res":{"statusCode":200},"responseTime":4970.92141700536,"msg":"request completed"}
[api] {"level":30,"time":1770301135449,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53744},"msg":"incoming request"}
[api] {"level":30,"time":1770301135450,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","res":{"statusCode":204},"responseTime":0.4284159988164902,"msg":"request completed"}
[api] {"level":30,"time":1770301135453,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53741},"msg":"incoming request"}
[api] {"level":30,"time":1770301135460,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","res":{"statusCode":200},"responseTime":6.471917003393173,"msg":"request completed"}
[api] {"level":30,"time":1770301135469,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53743},"msg":"incoming request"}
[api] {"level":30,"time":1770301135470,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","res":{"statusCode":204},"responseTime":0.3252919986844063,"msg":"request completed"}
[api] {"level":30,"time":1770301135472,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53744},"msg":"incoming request"}
[api] {"level":30,"time":1770301137772,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","res":{"statusCode":200},"responseTime":2299.787624999881,"msg":"request completed"}
[api] [2026-02-05T14:18:57.970Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:18:57.970Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:18:57.970Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: what's my balance ?...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:53953 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-05T14:18:59.065Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:18:59.070Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml9jl2i900086basceycyt6x
[api] [2026-02-05T14:18:59.071Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":137,"tokenCount":3,"hasNativeBalance":true}
[api] [ChatWorker] Base filtered to 46 tools for message: "what's my balance ?..."
[api] [ChatWorker] 🔍 RAG check for: "what's my balance ?..."
[api] [ChatWorker] 🎯 RAG: Match found! Query looks informational.
[api] [2026-02-05T14:18:59.072Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:18:59.964Z] [INFO] [SYS-1001] No open positions to monitor
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/embeddings "HTTP/1.1 200 OK"
[python] ERROR:rag.router:Query failed: Collection expecting embedding with dimension of 384, got 1536
[python] INFO:     127.0.0.1:53961 - "POST /rag/query HTTP/1.1" 500 Internal Server Error
[api] [2026-02-05T14:19:01.065Z] [ERROR] [API-5002] api failed after 1 attempts | DATA: {"error":"HTTP 500: {\"detail\":\"Collection expecting embedding with dimension of 384, got 1536\"}","url":"http://localhost:8000/rag/query"}
[api] [2026-02-05T14:19:01.065Z] [WARN] [API-5002] RAGClient: Query failed (skipping RAG) | DATA: {"error":"HTTP 500: {\"detail\":\"Collection expecting embedding with dimension of 384, got 1536\"}"}
[api] [ChatWorker] ℹ️ RAG: No relevant knowledge found in local base.
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml9jl6bs000a6basxaslom2g
[api] [2026-02-05T14:19:01.066Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:19:01.069Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:19:01.080Z] [INFO] [AI-6001][10ms] Timer finished: intent_parsing_e01f614a | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"wallet_balance","highLevelIntent":"MARKET_ANALYSIS","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"MARKET_ANALYSIS","slotsComplete":false,"labels":[{"label":"MARKET_ANALYSIS","confidence":0.95},{"label":"PREDICTION_MARKETS","confidence":0.1414213562373095},{"label":"GENERAL_CHAT","confidence":0.1414213562373095}],"timerLabel":"intent_parsing_e01f614a"}
[api] [2026-02-05T14:19:01.084Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:19:01.084Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml9jl6bs000a6basxaslom2g","sessionId":"cml9jl2hc00026bas9qpal9v7","model":"deepseek-chat","intent":"MARKET_ANALYSIS","routingMode":"thinking","hardRule":{"label":"MARKET_ANALYSIS","reason":"question intent"},"confidence":0.95}
[api] [ChatWorker] Skill-gated to 26 tools for intent=MARKET_ANALYSIS skills=polymarket_prediction, token_analysis, wallet_portfolio, welcome_onboarding
[api] [2026-02-05T14:19:01.084Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml9jl6bs000a6basxaslom2g","sessionId":"cml9jl2hc00026bas9qpal9v7","model":"deepseek-chat","intent":"MARKET_ANALYSIS","routingMode":"thinking","skillVersion":"clean","skills":["polymarket_prediction","token_analysis","wallet_portfolio","welcome_onboarding"],"toolCount":26}
[api] [2026-02-05T14:19:01.084Z] [INFO] [AI-6007] ChatWorker: early pre-fetch used client context | DATA: {"tool":"get_wallet_info"}
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: false,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
[api]     'userRole',
[api]     'defaultSwapAmount',
[api]     'defaultSwapUnit',
[api]     'checkTokenBeforeSwap',
[api]     'showQuoteBeforeSwap',
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
[api]     'quickSwapMode',
[api]     'copyTradeAIMode',
[api]     'updatedAt',
[api]     'createdAt',
[api]     'zoraNotificationThreshold'
[api]   ],
[api]   walletConnected: true,
[api]   chainId: 137
[api] }
[api] [ChatWorker] Waiting for early pre-fetch to complete
[api] [2026-02-05T14:19:01.086Z] [INFO] [AI-6003] Timer finished: prompt_gen_MARKET_ANALYSIS_deepseek | DATA: {"model":"deepseek","intent":"MARKET_ANALYSIS","length":2676,"timerLabel":"prompt_gen_MARKET_ANALYSIS_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (3 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:19:01.087Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:19:01.087Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1034}
[api] [2026-02-05T14:19:01.088Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9jl2i900086basceycyt6x. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:19:01.088Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:19:08.834Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[python] INFO:moderation.router:Moderating output: Based on your connected wallet, here's your curren...
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:19:09.970Z] [INFO] [SYS-1001] No open positions to monitor
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:54008 - "POST /moderation/output HTTP/1.1" 200 OK
[api] [2026-02-05T14:19:10.313Z] [INFO] [SYS-1007] Moderation Output check result | DATA: {"safe":true,"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] Broadcasting message_complete for cml9jl2i900086basceycyt6x
[api] [2026-02-05T14:19:10.328Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] [2026-02-05T14:19:10.330Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:19:10.330Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] {"level":30,"time":1770301150339,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9jl2hc00026bas9qpal9v7","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53741},"msg":"incoming request"}
[api] {"level":30,"time":1770301150340,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","res":{"statusCode":204},"responseTime":0.5443750023841858,"msg":"request completed"}
[api] {"level":30,"time":1770301150340,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9jl2hc00026bas9qpal9v7","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53743},"msg":"incoming request"}
[api] {"level":30,"time":1770301150340,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","res":{"statusCode":204},"responseTime":0.22941600531339645,"msg":"request completed"}
[api] {"level":30,"time":1770301150342,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","req":{"method":"GET","url":"/api/chat/sessions/cml9jl2hc00026bas9qpal9v7","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53744},"msg":"incoming request"}
[api] {"level":30,"time":1770301150345,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","req":{"method":"GET","url":"/api/chat/sessions/cml9jl2hc00026bas9qpal9v7","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53741},"msg":"incoming request"}
[api] {"level":30,"time":1770301150352,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","res":{"statusCode":200},"responseTime":9.385625004768372,"msg":"request completed"}
[api] {"level":30,"time":1770301150352,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","res":{"statusCode":200},"responseTime":6.8464579954743385,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:19:19.977Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:19:24.897Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
[api] [2026-02-05T14:19:24.953Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"solana","limit":100}
[api] [2026-02-05T14:19:26.397Z] [INFO] [WTC-2002] WS addresses discovered | DATA: {"wsCount":285,"chain":"solana"}
[api] [2026-02-05T14:19:29.494Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"federal_uranium","creator":"0x407dc0e15bc45a9e7d06f7ad3ee643a6cb85272d"}
[api] [2026-02-05T14:19:29.902Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"yemo","creator":"0xf039d80504a711852d6b86e96e99cff686bec121"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:19:29.988Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:19:30.591Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"kqpzq","creator":"0x339dd0a2e80fb70be2a135893b860d85e4fd16c4"}
[api] {"level":30,"time":1770301170990,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53743},"msg":"incoming request"}
[api] {"level":30,"time":1770301170991,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","res":{"statusCode":204},"responseTime":0.9580000042915344,"msg":"request completed"}
[api] {"level":30,"time":1770301170992,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-u","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9jl2hc00026bas9qpal9v7/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53744},"msg":"incoming request"}
[api] {"level":30,"time":1770301170992,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-u","res":{"statusCode":204},"responseTime":0.11704099923372269,"msg":"request completed"}
[api] {"level":30,"time":1770301170992,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-v","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53741},"msg":"incoming request"}
[api] {"level":30,"time":1770301170994,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-v","res":{"statusCode":204},"responseTime":0.2056250050663948,"msg":"request completed"}
[api] {"level":30,"time":1770301170994,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53743},"msg":"incoming request"}
[api] {"level":30,"time":1770301170997,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-x","req":{"method":"POST","url":"/api/chat/sessions/cml9jl2hc00026bas9qpal9v7/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53744},"msg":"incoming request"}
[api] {"level":30,"time":1770301170998,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53741},"msg":"incoming request"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=swap 3 usdc to matic...
[api] {"level":30,"time":1770301171004,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","res":{"statusCode":200},"responseTime":9.315415993332863,"msg":"request completed"}
[api] [2026-02-05T14:19:31.023Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"whopy","creator":"0x8b9cbd84de5ec506931b478f3ba342e6caccba24"}
[api] [2026-02-05T14:19:31.557Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"dunef","creator":"0xa9dd0092d128fb4976390db2a9779e43df5da1e9"}
[api] [2026-02-05T14:19:31.974Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"prismchord","creator":"0xa27ba32848aa3e099ecb54befa34b35abac6bac1"}
[api] [2026-02-05T14:19:32.393Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"xqbk","creator":"0xbd796d7f85b0f1ce3e618b6e27989fd7c0af8a48"}
[api] [2026-02-05T14:19:32.589Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":128,"limit":200}
[api] [2026-02-05T14:19:32.589Z] [INFO] [API-5001][7636ms] Premium trending tokens fetch complete | DATA: {"count":100,"chain":"solana","source":"WebSocket","wsOriginal":285}
[api] [TokenJob] Got 100 trending tokens for Solana
[api] Saved 100 trending tokens for solana to database and memory cache
[api] [TokenJob] Saved 100 tokens for Solana to DB + cache
[api] [2026-02-05T14:19:32.805Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"ivuqm","creator":"0x96a62c3ca60fbfc33f6cb6d358f6edd7f2630786"}
[api] {"level":30,"time":1770301175829,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","res":{"statusCode":200},"responseTime":4831.378958001733,"msg":"request completed"}
[api] {"level":30,"time":1770301175835,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-z","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53743},"msg":"incoming request"}
[api] {"level":30,"time":1770301175836,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-z","res":{"statusCode":204},"responseTime":0.5742909982800484,"msg":"request completed"}
[api] {"level":30,"time":1770301175838,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-10","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53741},"msg":"incoming request"}
[api] {"level":30,"time":1770301176130,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-x","res":{"statusCode":200},"responseTime":5133.637000001967,"msg":"request completed"}
[api] {"level":30,"time":1770301176138,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-11","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53743},"msg":"incoming request"}
[api] {"level":30,"time":1770301176139,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-11","res":{"statusCode":204},"responseTime":0.3669999986886978,"msg":"request completed"}
[api] {"level":30,"time":1770301176142,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-12","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53744},"msg":"incoming request"}
[api] {"level":30,"time":1770301176146,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-12","res":{"statusCode":200},"responseTime":4.381750002503395,"msg":"request completed"}
[api] {"level":30,"time":1770301176161,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-13","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53743},"msg":"incoming request"}
[api] [2026-02-05T14:19:37.007Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:19:37.008Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:19:37.008Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: swap 3 usdc to matic...
[api] {"level":30,"time":1770301177477,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-10","res":{"statusCode":200},"responseTime":1638.116875000298,"msg":"request completed"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:54298 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-05T14:19:38.138Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:19:38.138Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml9jlxs7000j6basiz3v47s7
[api] [2026-02-05T14:19:38.139Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":137,"tokenCount":3,"hasNativeBalance":true}
[api] [ChatWorker] Base filtered to 46 tools for message: "swap 3 usdc to matic..."
[api] [ChatWorker] 🔍 RAG check for: "swap 3 usdc to matic..."
[api] [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml9jm1q4003e6basqwh22w5h
[api] [2026-02-05T14:19:38.140Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:19:38.142Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:19:38.148Z] [INFO] [AI-6001][6ms] Timer finished: intent_parsing_d67ab2b7 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.44999999999999996},{"label":"PREDICTION_MARKETS","confidence":0.1414213562373095}],"timerLabel":"intent_parsing_d67ab2b7"}
[api] [2026-02-05T14:19:38.154Z] [INFO] [AI-6001] Intent follow-up recorded | DATA: {"previousIntent":"MARKET_ANALYSIS","nextIntent":"TRADING","sessionId":"cml9jl2hc00026bas9qpal9v7"}
[api] [2026-02-05T14:19:38.154Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:19:38.154Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml9jm1q4003e6basqwh22w5h","sessionId":"cml9jl2hc00026bas9qpal9v7","model":"deepseek-chat","intent":"TRADING","routingMode":"execution","hardRule":{"label":"TRADING","reason":"action + slots complete"},"confidence":0.95}
[api] [ChatWorker] Skill-gated to 13 tools for intent=TRADING skills=cross_chain_swap, swap, token_alert, wallet_portfolio
[api] [2026-02-05T14:19:38.155Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml9jm1q4003e6basqwh22w5h","sessionId":"cml9jl2hc00026bas9qpal9v7","model":"deepseek-chat","intent":"TRADING","routingMode":"execution","skillVersion":"exec","skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"],"toolCount":13}
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: false,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
[api]     'userRole',
[api]     'defaultSwapAmount',
[api]     'defaultSwapUnit',
[api]     'checkTokenBeforeSwap',
[api]     'showQuoteBeforeSwap',
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
[api]     'quickSwapMode',
[api]     'copyTradeAIMode',
[api]     'updatedAt',
[api]     'createdAt',
[api]     'zoraNotificationThreshold'
[api]   ],
[api]   walletConnected: true,
[api]   chainId: 137
[api] }
[api] [ChatWorker] 🚀 Fast Swap Decision: {
[api]   fastSwapModeEnabled: false,
[api]   willFastSwap: false,
[api]   reason: 'Normal LLM flow (AI will call tools)'
[api] }
[api] [ChatWorker] Waiting for early pre-fetch to complete
[api] [2026-02-05T14:19:38.156Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":4,"skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"]}
[api] [2026-02-05T14:19:38.157Z] [INFO] [AI-6003][1ms] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":13016,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (3 tokens cached)
[api] [2026-02-05T14:19:38.157Z] [INFO] [AI-6007] ChatWorker: requested token balance resolved | DATA: {"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":137,"requested":["USDC","MATIC"],"matched":["USDC","MATIC"],"missing":[],"resolvedBalances":{"USDC":"5.926982","MATIC":"20.6044348920309"}}
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:19:38.157Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:19:38.157Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1034}
[api] [2026-02-05T14:19:38.157Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-02-05T14:19:38.157Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":185}
[api] [2026-02-05T14:19:38.158Z] [INFO] [AI-6007] ChatWorker: balance system rule injected
[api] [ChatWorker] Broadcasting Thinking status for cml9jlxs7000j6basiz3v47s7. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:19:38.158Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] {"level":30,"time":1770301178249,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-13","res":{"statusCode":200},"responseTime":2087.491875000298,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:19:39.998Z] [INFO] [SYS-1001] No open positions to monitor
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-02-05T14:19:45.889Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T14:19:45.896Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9jl2hc00026bas9qpal9v7","messageId":"cml9jlxs7000j6basiz3v47s7","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T14:19:45.896Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"simulate_swap","sessionId":"cml9jl2hc00026bas9qpal9v7","messageId":"cml9jlxs7000j6basiz3v47s7","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:19:45.896Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] {"level":30,"time":1770301185901,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-14","req":{"method":"POST","url":"/api/swap/quote","hostname":"127.0.0.1:3001","remoteAddress":"127.0.0.1","remotePort":54445},"msg":"incoming request"}
[api] [Swap Quote] Fetching metadata for: {
[api]   tokenInForMetadata: '0x3c499c542c',
[api]   tokenOutForMetadata: '0x0d500B1d8E',
[api]   actualTokenIn: '0x3c499c542c',
[api]   actualTokenOut: '0xEeeeeEeeeE',
[api]   isTokenOutNative: true
[api] }
[api] [2026-02-05T14:19:46.999Z] [INFO] [API-5001][TID:12facd43-3bfe-482d-86c6-6561b2bf9b6b] No token metadata available, trying RPC fallback... | DATA: {"tokenAddress":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","chainId":137}
[api] [2026-02-05T14:19:47.008Z] [INFO] [API-5001][TID:12facd43-3bfe-482d-86c6-6561b2bf9b6b] Using 0x API fallback token metadata | DATA: {"symbol":"WMATIC","chainId":137}
[api] [Swap Quote] Overriding tokenIn decimals to known value: 6
[api] [Swap Quote] Token decimals: {
[api]   tokenIn: '0x3c499c54',
[api]   tokenOut: '0xEeeeeEee',
[api]   tokenInDecimals: 6,
[api]   tokenOutDecimals: 18,
[api]   tokenOutMetadataDecimals: 18
[api] }
[api] [2026-02-05T14:19:48.220Z] [INFO] [API-5001][TID:12facd43-3bfe-482d-86c6-6561b2bf9b6b] Using 0x API fallback token metadata | DATA: {"symbol":"USDC","chainId":137}
[api] [2026-02-05T14:19:48.735Z] [INFO] [API-5001][TID:12facd43-3bfe-482d-86c6-6561b2bf9b6b] 0x API price received successfully | DATA: {"sellToken":"0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270","buyToken":"0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174","chainId":137,"liquidityAvailable":true}
[api] [PlatformFee] Fees DISABLED, returning 0 bps
[api] [Kyber] GET routes {
[api]   routesUrl: 'https://aggregator-api.kyberswap.com/polygon/api/v1/routes?tokenIn=0x3c499c542cef5e3811e1192ce70d8cc03d5c3359&tokenOut=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&amountIn=3000000&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] [2026-02-05T14:19:49.385Z] [INFO] [API-5001][TID:12facd43-3bfe-482d-86c6-6561b2bf9b6b] 0x API Quote received successfully | DATA: {"sellToken":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","buyToken":"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE","buyAmount":"29188133949193929659","usedEndpoint":"allowance-holder"}
[api] [2026-02-05T14:19:49.385Z] [INFO] [API-5001][TID:12facd43-3bfe-482d-86c6-6561b2bf9b6b] 0x API Quote successful | DATA: {"sellToken":"0x3c499c542c","buyToken":"0xEeeeeEeeeE","buyAmount":"29188133949193929659","hasAllowanceIssue":true,"usedEndpoint":"allowance-holder"}
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 3,
[api]   amountOut: 29.18813394919393,
[api]   quotePrice: 9.729377983064643,
[api]   refPrice: 9.77230528681716,
[api]   tokenInUsd: 'available',
[api]   impact: -0.43927509929950725,
[api]   formula: '((9.729377983064643 - 9.77230528681716) / 9.77230528681716) * 100 = -0.43927509929950725'
[api] }
[api] [QuoteService] 0x API estimatedPriceImpact: {
[api]   raw: undefined,
[api]   parsed: 0,
[api]   multipliedBy100: 0,
[api]   impactVsMkt: -0.43927509929950725,
[api]   willUse: -0.43927509929950725
[api] }
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:19:50.004Z] [INFO] [SYS-1001] No open positions to monitor
[api] [Kyber] routes response {
[api]   status: 200,
[api]   hasData: true,
[api]   keys: [ 'code', 'message', 'data', 'requestId' ]
[api] }
[api] [Kyber] Building route/build request body: {
[api]   hasRouteSummary: true,
[api]   routeSummaryKeys: [
[api]     'tokenIn',
[api]     'amountIn',
[api]     'amountInUsd',
[api]     'tokenOut',
[api]     'amountOut',
[api]     'amountOutUsd',
[api]     'gas',
[api]     'gasPrice'
[api]   ],
[api]   sender: '0xA386bc9D',
[api]   recipient: '0xA386bc9D',
[api]   slippageTolerance: 50,
[api]   slippageToleranceType: 'number',
[api]   deadline: 1770301790,
[api]   deadlineType: 'number',
[api]   allBodyKeys: [
[api]     'routeSummary',
[api]     'sender',
[api]     'recipient',
[api]     'origin',
[api]     'slippageTolerance',
[api]     'deadline'
[api]   ]
[api] }
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 3,
[api]   amountOut: 29.411278833994206,
[api]   quotePrice: 9.803759611331403,
[api]   refPrice: 9.77230528681716,
[api]   tokenInUsd: 'available',
[api]   impact: 0.32187210275424993,
[api]   formula: '((9.803759611331403 - 9.77230528681716) / 9.77230528681716) * 100 = 0.32187210275424993'
[api] }
[api] [QuoteService] Quote comparison: {
[api]   '0x_amount': '29.188133949193929659',
[api]   kyber_amount: '29.411278833994207232',
[api]   kyber_advantage_pct: '0.00',
[api]   chainId: 137
[api] }
[api] [QuoteService] Preferring 0x for reliability { reason: 'prices within 2%', percentDiff: '0.00' }
[api] {"level":30,"time":1770301191068,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-14","res":{"statusCode":200},"responseTime":5166.665749996901,"msg":"request completed"}
[api] [2026-02-05T14:19:51.069Z] [INFO] [AI-6007][5173ms] ChatWorker: tool success | DATA: {"tool":"simulate_swap","sessionId":"cml9jl2hc00026bas9qpal9v7","messageId":"cml9jlxs7000j6basiz3v47s7","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] DeepSeek iteration 2/10 for task cml9jm1q4003e6basqwh22w5h
[api] [2026-02-05T14:19:51.087Z] [INFO] [WS-8004][6ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:19:51.091Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:19:51.098Z] [INFO] [AI-6001][6ms] Timer finished: intent_parsing_34e4ee76 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.44999999999999996},{"label":"PREDICTION_MARKETS","confidence":0.1414213562373095}],"timerLabel":"intent_parsing_34e4ee76"}
[api] [2026-02-05T14:19:51.098Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: false,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
[api]     'userRole',
[api]     'defaultSwapAmount',
[api]     'defaultSwapUnit',
[api]     'checkTokenBeforeSwap',
[api]     'showQuoteBeforeSwap',
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
[api]     'quickSwapMode',
[api]     'copyTradeAIMode',
[api]     'updatedAt',
[api]     'createdAt',
[api]     'zoraNotificationThreshold'
[api]   ],
[api]   walletConnected: true,
[api]   chainId: 137
[api] }
[api] [ChatWorker] 🚀 Fast Swap Decision: {
[api]   fastSwapModeEnabled: false,
[api]   willFastSwap: false,
[api]   reason: 'Normal LLM flow (AI will call tools)'
[api] }
[api] [2026-02-05T14:19:51.099Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":4,"skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"]}
[api] [2026-02-05T14:19:51.099Z] [INFO] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":13016,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (3 tokens cached)
[api] [2026-02-05T14:19:51.099Z] [INFO] [AI-6007] ChatWorker: requested token balance resolved | DATA: {"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":137,"requested":["USDC","MATIC"],"matched":["USDC","MATIC"],"missing":[],"resolvedBalances":{"USDC":"5.926982","MATIC":"20.6044348920309"}}
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:19:51.099Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:19:51.100Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1034}
[api] [2026-02-05T14:19:51.100Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-02-05T14:19:51.100Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":185}
[api] [2026-02-05T14:19:51.100Z] [INFO] [AI-6007] ChatWorker: balance system rule injected
[api] [ChatWorker] Broadcasting Thinking status for cml9jlxs7000j6basiz3v47s7. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:19:51.100Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [2026-02-05T14:20:00.012Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
[api] [2026-02-05T14:20:00.072Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"ethereum","limit":100}
[api] [2026-02-05T14:20:00.090Z] [INFO] [SYS-1007] SocialRepo: Recalculated heat scores for 915 casts
[api] [2026-02-05T14:20:00.090Z] [INFO] [SYS-1007][22ms] Timer finished: recalc_heat_scores | DATA: {"count":915,"timerLabel":"recalc_heat_scores"}
[api] [2026-02-05T14:20:01.514Z] [INFO] [WTC-2002] WS addresses discovered | DATA: {"wsCount":185,"chain":"ethereum"}
[api] [DBLock] Cleaning expired/stale lock {
[api]   key: 'lock:tokenJob:refresh:base',
[api]   expiresAt: '2026-02-05T14:16:20.420Z',
[api]   ageMs: 462238,
[api]   isExpired: true,
[api]   isVeryStale: false
[api] }
[api] [DBLock] Acquired lock after cleaning stale entry { key: 'lock:tokenJob:refresh:base' }
[api] [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
[api] [2026-02-05T14:20:02.665Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"base","limit":100}
[api] [2026-02-05T14:20:04.158Z] [INFO] [WTC-2002] WS addresses discovered | DATA: {"wsCount":180,"chain":"base"}
[api] [2026-02-05T14:20:05.819Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":28,"limit":200}
[api] [2026-02-05T14:20:07.726Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":41,"limit":200}
[api] [2026-02-05T14:20:09.407Z] [INFO] [API-5001] Skipping low liquidity token | DATA: {"symbol":"CLAWIAI","liquidity":8.21532e-15}
[api] [2026-02-05T14:20:09.637Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:20:09.849Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:20:10.020Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:20:10.886Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:20:11.088Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:20:13.135Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:20:13.349Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:20:18.079Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:20:18.081Z] [ERROR] [API-5002] GeckoTerminal API error after retries | DATA: {"endpoint":"/networks/eth/trending_pools?page=4&include=base_token&duration=5m","error":"Rate limit hit, backing off for 60000ms"}
[api] [2026-02-05T14:20:18.081Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"eth","error":"Rate limit hit, backing off for 60000ms"}
[api] [2026-02-05T14:20:18.081Z] [INFO] [API-5001][18009ms] Premium trending tokens fetch complete | DATA: {"count":88,"chain":"ethereum","source":"WebSocket","wsOriginal":185}
[api] [TokenJob] Got 88 trending tokens for Ethereum
[api] Saved 88 trending tokens for eth to database and memory cache
[api] [TokenJob] Saved 88 tokens for Ethereum to DB + cache
[api] [2026-02-05T14:20:18.318Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:20:18.319Z] [ERROR] [API-5002] GeckoTerminal API error after retries | DATA: {"endpoint":"/networks/base/trending_pools?page=3&include=base_token&duration=5m","error":"Rate limit hit, backing off for 60000ms"}
[api] [2026-02-05T14:20:18.319Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"base","error":"Rate limit hit, backing off for 60000ms"}
[api] [2026-02-05T14:20:18.319Z] [INFO] [API-5001][15654ms] Premium trending tokens fetch complete | DATA: {"count":71,"chain":"base","source":"WebSocket","wsOriginal":180}
[api] [TokenJob] Got 71 trending tokens for Base
[api] Saved 71 trending tokens for base to database and memory cache
[api] [TokenJob] Saved 71 tokens for Base to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:20:20.027Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:20:24.897Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:20:30.043Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770301233961,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-15","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54782},"msg":"incoming request"}
[api] {"level":30,"time":1770301233963,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-15","res":{"statusCode":204},"responseTime":0.44612500071525574,"msg":"request completed"}
[api] {"level":30,"time":1770301233964,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-16","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54782},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   userIdLength: 35,
[api]   userIdPrefix: 'did:privy:cmj0a3j3f0',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1770301235046,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-17","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9jl2hc00026bas9qpal9v7","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54797},"msg":"incoming request"}
[api] {"level":30,"time":1770301235047,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-17","res":{"statusCode":204},"responseTime":0.22191699594259262,"msg":"request completed"}
[api] {"level":30,"time":1770301235049,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-18","req":{"method":"GET","url":"/api/chat/sessions/cml9jl2hc00026bas9qpal9v7","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54797},"msg":"incoming request"}
[api] {"level":30,"time":1770301235061,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-18","res":{"statusCode":200},"responseTime":11.473290994763374,"msg":"request completed"}
[api] {"level":30,"time":1770301235070,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-19","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54797},"msg":"incoming request"}
[api] [2026-02-05T14:20:35.204Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"efcqw","creator":"0xe46ce9afb30c2f1c2cec7c5561f6a7883a79202a"}
[api] [2026-02-05T14:20:35.868Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"shade_22f2","creator":"0xd58375e2d4bddcf475c0238b2776e53a8e08a563"}
[api] {"level":30,"time":1770301235963,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1a","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54804},"msg":"incoming request"}
[api] {"level":30,"time":1770301235964,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1a","res":{"statusCode":204},"responseTime":0.37812499701976776,"msg":"request completed"}
[api] {"level":30,"time":1770301235966,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1b","req":{"method":"DELETE","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54804},"msg":"incoming request"}
[api] {"level":30,"time":1770301235971,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1b","res":{"statusCode":200},"responseTime":4.820332996547222,"msg":"request completed"}
[api] [2026-02-05T14:20:36.303Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"olvo","creator":"0xe49b1a0e645e3a90feff8d8ec6a339bcc293f51c"}
[api] {"level":30,"time":1770301236445,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1c","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9ifhgr002z12y5ozypz623","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54804},"msg":"incoming request"}
[api] {"level":30,"time":1770301236445,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1c","res":{"statusCode":204},"responseTime":0.25916700065135956,"msg":"request completed"}
[api] {"level":30,"time":1770301236447,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1d","req":{"method":"DELETE","url":"/api/chat/sessions/cml9ifhgr002z12y5ozypz623","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54804},"msg":"incoming request"}
[api] {"level":30,"time":1770301236451,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1d","res":{"statusCode":200},"responseTime":4.487624995410442,"msg":"request completed"}
[api] [2026-02-05T14:20:36.775Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"rfowx","creator":"0xd0ff8885c79a8e8818d57a1f6ffd2cd2ee890554"}
[api] {"level":30,"time":1770301236913,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1e","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9iby220001kl89s2ny5n8c","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54804},"msg":"incoming request"}
[api] {"level":30,"time":1770301236914,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1e","res":{"statusCode":204},"responseTime":0.5074160024523735,"msg":"request completed"}
[api] {"level":30,"time":1770301236917,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1f","req":{"method":"DELETE","url":"/api/chat/sessions/cml9iby220001kl89s2ny5n8c","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54804},"msg":"incoming request"}
[api] {"level":30,"time":1770301236921,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1f","res":{"statusCode":200},"responseTime":4.66754200309515,"msg":"request completed"}
[api] {"level":30,"time":1770301237252,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1g","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9hywl4007213e3azjk3bgw","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54804},"msg":"incoming request"}
[api] {"level":30,"time":1770301237252,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1g","res":{"statusCode":204},"responseTime":0.516915999352932,"msg":"request completed"}
[api] {"level":30,"time":1770301237254,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1h","req":{"method":"DELETE","url":"/api/chat/sessions/cml9hywl4007213e3azjk3bgw","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54804},"msg":"incoming request"}
[api] {"level":30,"time":1770301237261,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1h","res":{"statusCode":200},"responseTime":6.8901670053601265,"msg":"request completed"}
[api] [2026-02-05T14:20:37.362Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"zouho","creator":"0xfc09e51c635972d5503b056fcb3ffa8013db32f0"}
[api] {"level":30,"time":1770301237605,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1i","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9hhy7h002512ozllri310n","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54804},"msg":"incoming request"}
[api] {"level":30,"time":1770301237606,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1i","res":{"statusCode":204},"responseTime":0.38395899534225464,"msg":"request completed"}
[api] {"level":30,"time":1770301237607,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1j","req":{"method":"DELETE","url":"/api/chat/sessions/cml9hhy7h002512ozllri310n","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54804},"msg":"incoming request"}
[api] {"level":30,"time":1770301237615,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1j","res":{"statusCode":200},"responseTime":7.337790995836258,"msg":"request completed"}
[api] [2026-02-05T14:20:37.804Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"vugoy","creator":"0x30a86ce11b04b756d62281242d027cf46ff5f86b"}
[api] {"level":30,"time":1770301239490,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-16","res":{"statusCode":200},"responseTime":5525.793124996126,"msg":"request completed"}
[api] {"level":30,"time":1770301239495,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1k","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54804},"msg":"incoming request"}
[api] {"level":30,"time":1770301239496,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1k","res":{"statusCode":204},"responseTime":0.6814579963684082,"msg":"request completed"}
[api] {"level":30,"time":1770301239498,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1l","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54782},"msg":"incoming request"}
[api] {"level":30,"time":1770301239798,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-19","res":{"statusCode":200},"responseTime":4727.594209000468,"msg":"request completed"}
[api] {"level":30,"time":1770301239804,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1m","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54804},"msg":"incoming request"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:20:40.046Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770301241722,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1l","res":{"statusCode":200},"responseTime":2223.1365839987993,"msg":"request completed"}
[api] {"level":30,"time":1770301241915,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1m","res":{"statusCode":200},"responseTime":2111.1475839987397,"msg":"request completed"}
[api] [TokenJob] Tokens for Solana are fresh, skipping API call
[api] [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
[api] [2026-02-05T14:20:48.369Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"bsc","limit":100}
[api] [2026-02-05T14:20:49.828Z] [INFO] [WTC-2002] WS addresses discovered | DATA: {"wsCount":195,"chain":"bsc"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:20:50.053Z] [INFO] [SYS-1001] No open positions to monitor
[api] [ChatWorker] Stream interrupted for task cml9jm1q4003e6basqwh22w5h: terminated
[python] INFO:moderation.router:Moderating output: I'll help you swap 3 USDC to MATIC on Polygon. Let...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:54914 - "POST /moderation/output HTTP/1.1" 200 OK
[api] [2026-02-05T14:20:52.903Z] [INFO] [SYS-1007] Moderation Output check result | DATA: {"safe":true,"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] Broadcasting message_complete for cml9jlxs7000j6basiz3v47s7
[api] [2026-02-05T14:20:52.917Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] [2026-02-05T14:20:52.918Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:20:52.919Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] {"level":30,"time":1770301252930,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1n","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9jl2hc00026bas9qpal9v7","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54797},"msg":"incoming request"}
[api] {"level":30,"time":1770301252930,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1n","res":{"statusCode":204},"responseTime":0.3356659933924675,"msg":"request completed"}
[api] {"level":30,"time":1770301252931,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1o","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9jl2hc00026bas9qpal9v7","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54782},"msg":"incoming request"}
[api] {"level":30,"time":1770301252931,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1o","res":{"statusCode":204},"responseTime":0.11341699957847595,"msg":"request completed"}
[api] {"level":30,"time":1770301252933,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1p","req":{"method":"GET","url":"/api/chat/sessions/cml9jl2hc00026bas9qpal9v7","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54804},"msg":"incoming request"}
[api] {"level":30,"time":1770301252937,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1q","req":{"method":"GET","url":"/api/chat/sessions/cml9jl2hc00026bas9qpal9v7","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54797},"msg":"incoming request"}
[api] {"level":30,"time":1770301252940,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1p","res":{"statusCode":200},"responseTime":7.05562499910593,"msg":"request completed"}
[api] {"level":30,"time":1770301252941,"pid":86252,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1q","res":{"statusCode":200},"responseTime":3.5555830001831055,"msg":"request completed"}
[api] [2026-02-05T14:20:54.171Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":33,"limit":200}
[api] [2026-02-05T14:20:54.172Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"bsc","error":"GeckoTerminal backoff active (25s remaining)"}
[api] [2026-02-05T14:20:54.172Z] [INFO] [API-5001][5803ms] Premium trending tokens fetch complete | DATA: {"count":77,"chain":"bsc","source":"WebSocket","wsOriginal":195}
[api] [TokenJob] Got 77 trending tokens for BSC
[api] Saved 77 trending tokens for bsc to database and memory cache
[api] [TokenJob] Saved 77 tokens for BSC to DB + cache
[api] [TokenJob] Refreshed 4 primary chains in 119.3s
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:21:00.059Z] [INFO] [SYS-1001] No open positions to monitor
[api] [SocialJob] Checking Zora coin status for 47 casts...
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:21:10.065Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Tokens for Base are fresh, skipping API call
[api] [2026-02-05T14:21:18.748Z] [INFO] [SOC-7001][167ms] Timer finished: get_trending_casts_trending | DATA: {"timeRange":"trending","limit":500,"offset":0,"count":500,"fromCache":false,"timerLabel":"get_trending_casts_trending"}
[api] [2026-02-05T14:21:18.792Z] [INFO] [SOC-7003] SocialRepo: Updated cache with 500 merged casts
[api] [2026-02-05T14:21:18.792Z] [INFO] [SOC-7003] SocialRepo: Saved 47 trending casts to database
[api] [2026-02-05T14:21:18.792Z] [INFO] [SOC-7003][422ms] Timer finished: save_trending_casts | DATA: {"count":47,"timerLabel":"save_trending_casts"}
[api] [SocialJob] Casts refreshed: 47 saved
[api] [SocialJob] 🚀 Triggering OGP Prefetch for top 47 casts...
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:21:20.072Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:21:24.898Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:21:30.079Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:21:40.085Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:21:46.994Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"ggnpy","creator":"0xce5f960245717df18e0ea68046ceb25bd3423b04"}
[api] [2026-02-05T14:21:47.412Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"mynqc","creator":"0x5797f780f4e9509c55244442e39f77973ec1682d"}
[api] [2026-02-05T14:21:47.813Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"zinc5268","creator":"0x6415035a4328e565d93580ae143cd17038f2e95b"}
[api] [TokenJob] Tokens for BSC are fresh, skipping API call
[api] [TokenJob] Refreshed 4 primary chains in 108.1s
[api] [2026-02-05T14:21:48.178Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"rpwyv","creator":"0xf3ea7ca5f15fae5f036b2333d1b09140cf66f99d"}
[api] [2026-02-05T14:21:48.747Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"mtdgd","creator":"0x80eb23242428969ad841b74ae4e2f8b76d1d8571"}
[api] [2026-02-05T14:21:49.148Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"ilaok","creator":"0x76d99eb49a575468d2046d3ccaefc772c679f3a3"}
[api] [2026-02-05T14:21:49.562Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"qgaex","creator":"0x8d2e9af71fef9f3832531455d9294f9fe78d6a36"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:21:50.093Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:22:00.103Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:22:10.108Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:22:20.115Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:22:24.900Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:22:30.119Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:22:40.126Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:22:50.131Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:22:53.327Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"isonk","creator":"0x451a108b5da8aae6d720b763ad05593999b0d4c5"}
[api] [2026-02-05T14:22:53.767Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"kwtms","creator":"0x56f274fc2ceeff236d98635e486792c45d9c0acc"}
[api] [2026-02-05T14:22:54.205Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"uqjfg","creator":"0xce032319aa4877527d80dbf07656d5e7221e417a"}
[api] [2026-02-05T14:22:54.591Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"imgot","creator":"0x5261e2ebb4236a73430fabb4ae51ff50ddf9caae"}
[api] [2026-02-05T14:22:55.069Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"hehbt","creator":"0x3f3e070c03d35b80fb3d288216717b9cba59549e"}
[api] [2026-02-05T14:22:55.458Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"fluxcalm","creator":"0x31c6f7c19583452ce696e9244468729a73818009"}
[api] [2026-02-05T14:22:55.978Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"desperatedip","creator":"0x798622cbfa00e08a3b927c8c1ca35c7dbf71947a"}
[api] [2026-02-05T14:22:56.358Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"lztjk","creator":"0x13a72af27692ac6271d687d19f4ed8d08a0cab62"}
[api] [2026-02-05T14:22:56.793Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"jztq","creator":"0x1ce217c19ab0ff342f54f2b557c1aa03f9fc2129"}
[api] [2026-02-05T14:22:57.197Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"lghup","creator":"0xd5348da8d833c00dca0f1ba25edc4805fde5f306"}
[api] [2026-02-05T14:22:57.648Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"znbvo","creator":"0x1db1cbbb844d31824f3c0b9408d12aa33e48764a"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:23:00.136Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:23:10.144Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:23:20.154Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:23:24.901Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:23:30.164Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:23:40.169Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:23:50.178Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:23:59.666Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"epno","creator":"0x07c84cc7068b2906939ad7b00ecfdceab0732374"}
[api] [2026-02-05T14:24:00.159Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"hzjhj","creator":"0x5e92c7cdd7e83e29e5eb6e667533958769d8a1bf"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:24:00.184Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:24:07.579Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"coda_cc42","creator":"0xa265c3afc06d77f03160133e6f159f57c6b06306"}
[api] [2026-02-05T14:24:07.960Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"ndiei","creator":"0x9be9cafdeb41d977b0902c22991b00542c1ba362"}
[api] [2026-02-05T14:24:09.083Z] [INFO] [SYS-1007][TID:bc831229-0f0e-4ee7-9cb0-7329d538fe7d] Alpha Detector: Checking new coin | DATA: {"symbol":"oqfex","creator":"0xaceb8cafcdca5d63c597292f2495de57aa6e4065"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:24:10.193Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:24:20.202Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:24:24.902Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:24:30.207Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:24:40.215Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:24:50.224Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:25:00.228Z] [INFO] [SYS-1001] No open positions to monitor
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
[Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] [2026-02-05T14:26:30.736Z] [INFO] [SYS-1001] Zora SDK initialized with API Key
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
[Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] [2026-02-05T14:26:44.160Z] [INFO] [SYS-1001] Zora SDK initialized with API Key
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
[api] [SkillRegistry:clean] Loaded skill: copy_trade
[api] [SkillRegistry:clean] Loaded skill: cross_chain_swap
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
[api] [2026-02-05T14:26:44.456Z] [INFO] [SYS-1001] Build SHA | DATA: {"buildSha":"unknown"}
[api] [2026-02-05T14:26:44.456Z] [WARN] [SYS-1001] Public folder not found - skipping static file serving | DATA: {"path":"/Users/almurat/KiKo/kiko-api/public"}
[api] [2026-02-05T14:26:44.457Z] [INFO] [SYS-1001] Initializing services... | DATA: {"env":"development","port":3001,"database":"configured","privy":"✅ Configured"}
[api] [2026-02-05T14:26:44.470Z] [INFO] [SYS-1004] Database connection successful
[api] [DataRetention] Checking retention policies...
[api] [Prisma] DB connection is healthy
[Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] [2026-02-05T14:28:01.703Z] [INFO] [SYS-1001] Zora SDK initialized with API Key
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
[Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] [2026-02-05T14:28:31.971Z] [INFO] [SYS-1001] Zora SDK initialized with API Key
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
[api] [SkillRegistry:clean] Loaded skill: copy_trade
[api] [SkillRegistry:clean] Loaded skill: cross_chain_swap
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
[api] [2026-02-05T14:28:32.455Z] [INFO] [SYS-1001] Build SHA | DATA: {"buildSha":"unknown"}
[api] [2026-02-05T14:28:32.455Z] [WARN] [SYS-1001] Public folder not found - skipping static file serving | DATA: {"path":"/Users/almurat/KiKo/kiko-api/public"}
[api] [2026-02-05T14:28:32.456Z] [INFO] [SYS-1001] Initializing services... | DATA: {"env":"development","port":3001,"database":"configured","privy":"✅ Configured"}
[api] [2026-02-05T14:28:32.468Z] [INFO] [SYS-1004] Database connection successful
[api] [DataRetention] Checking retention policies...
[api] [Prisma] DB connection is healthy
[api] [DataRetention] Starting cleanup job...
[api] [2026-02-05T14:28:32.473Z] [INFO] [SYS-1005] Redis initialized
[api] [2026-02-05T14:28:32.473Z] [INFO] [SYS-1001] Starting server on port 3001...
[api] {"level":30,"time":1770301712501,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","msg":"Server listening at http://0.0.0.0:3001"}
[api] [2026-02-05T14:28:32.501Z] [INFO] [SYS-1001] Server listening | DATA: {"url":"http://localhost:3001","health":"http://localhost:3001/health"}
[api] [2026-02-05T14:28:32.502Z] [INFO] [SYS-1001] RPC health monitor started
[api] [2026-02-05T14:28:32.504Z] [INFO] [SYS-1001] RPC benchmark sampling started
[api] [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
[api] [TokenJob] Scheduled: Primary chains every 5min (Ethereum, Solana, Base, BSC)
[api] [TokenJob] Scheduled: Secondary chains every 4h (Arbitrum, Optimism, Polygon)
[api] [SocialJob] Scheduled: Discovery (30m), Refresh (4h), Scoring (5m)
[api] [2026-02-05T14:28:32.518Z] [INFO] [SYS-1001] Background jobs started
[api] [2026-02-05T14:28:32.518Z] [INFO] [SYS-1001] Initializing auto trade service...
[api] [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
[api] [2026-02-05T14:28:32.518Z] [INFO] [SYS-1001] Auto trade service initialized (Solana watcher + EVM webhook enabled) | DATA: {"mode":"hybrid"}
[api] [2026-02-05T14:28:32.518Z] [INFO] [SYS-1001] Auto trade service started
[api] [PositionMonitor] Starting position monitor (every 30s)...
[api] [2026-02-05T14:28:32.518Z] [INFO] [SYS-1001] Position monitor started
[api] [2026-02-05T14:28:32.518Z] [INFO] [SYS-1001] Token Alert Service started
[api] [2026-02-05T14:28:32.518Z] [INFO] [SYS-1001] Token alert service started
[api] [ChatWorker] Started polling for AI tasks (interval: 3000ms)
[api] [2026-02-05T14:28:32.518Z] [INFO] [SYS-1001] Chat worker started
[api] [2026-02-05T14:28:32.518Z] [INFO] [SYS-1001] Starting Global Zora Alpha Detector (API Polling) | DATA: {"thresholds":{"farcaster":50000,"twitter":500000,"instagram":500000,"tiktok":500000},"interval":60000}
[api] [2026-02-05T14:28:32.519Z] [INFO] [SYS-1001] 🎉 All services initialized!
[api] [DataRetention] Cleanup job completed.
[api] {"level":30,"time":1770301713932,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWt0Zm5oa3gwMGNka3kwYzN0M2xtMzZpIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzAyOTg0MDEsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc3MDMwMjAwMX0.9256aXGbqkZr2ut5-gdTeZbiaJllM6vezsNM7gSDRbSRR__bXPZz7i4PaBhhQFUqtCI6UywPsuHZtNp3mOQ_CA","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57009},"msg":"incoming request"}
[api] [2026-02-05T14:28:34.981Z] [INFO] [WS-8001][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] ChatWS Client connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1}
[api] [2026-02-05T14:28:34.981Z] [INFO] [WS-8001][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] ChatWS: User connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl2...","tokenExp":1770302001}
[api] [MarketJob] Running startup staleness check...
[api] [PositionMonitor] 🔄 Running position check...
[api] [MarketJob] Overview is fresh, skipping API call
[api] [MarketJob] Protocols are fresh, skipping API call
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [2026-02-05T14:28:37.532Z] [INFO] [SYS-1001] No open positions to monitor
[api] [SocialJob] Trending casts are fresh, skipping Snapchain API call
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:28:47.540Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:28:57.548Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Starting initial token refresh...
[api] [TokenJob] Tokens for Ethereum are fresh, skipping API call
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:29:07.553Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:29:17.562Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:29:27.567Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:29:32.504Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [TokenJob] Tokens for Solana are fresh, skipping API call
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:29:37.577Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:29:39.839Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"gridweld","creator":"0xf0ede0bca4b743c058b9dbfc28cf4a90dc9fd372"}
[api] [2026-02-05T14:29:40.232Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"azfs","creator":"0x6d4e720a62f0fc816bc2197b3baa094b427ba0ae"}
[api] [2026-02-05T14:29:40.644Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"upasg","creator":"0xc95d8c3cb8962d0fded4a08759fd7dd328a1f5dc"}
[api] [2026-02-05T14:29:41.520Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"sfvqp","creator":"0xa4cb1a7f4a1a25d2e385f56f34d8dfbf3ffb897f"}
[api] [2026-02-05T14:29:41.953Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"rodvm","creator":"0xe65325039d4d3c94cd658e1a1f71bfbeb32d0f75"}
[api] [2026-02-05T14:29:42.407Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"dwtpm","creator":"0xe12fd92fa5cfb37fc67f55b46659879fdcbffec5"}
[api] [2026-02-05T14:29:42.812Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"qhnw","creator":"0x8c95e434cd7dddc306ad9d14a479c4a077f180d0"}
[api] [2026-02-05T14:29:43.230Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"ydtr","creator":"0x9aa484123e9089c75f189517bfa8b34bd3298215"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:29:47.585Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:29:57.592Z] [INFO] [SYS-1001] No open positions to monitor
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [SocialJob] Trending casts are fresh, skipping Snapchain API call
[api] [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
[api] [2026-02-05T14:30:00.643Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"ethereum","limit":100}
[api] [2026-02-05T14:30:00.654Z] [INFO] [SYS-1007] SocialRepo: Recalculated heat scores for 924 casts
[api] [2026-02-05T14:30:00.654Z] [INFO] [SYS-1007][22ms] Timer finished: recalc_heat_scores | DATA: {"count":924,"timerLabel":"recalc_heat_scores"}
[api] [2026-02-05T14:30:02.083Z] [INFO] [WTC-2002] WS addresses discovered | DATA: {"wsCount":194,"chain":"ethereum"}
[api] [DBLock] Lock already held (valid) {
[api]   key: 'lock:tokenJob:refresh:base',
[api]   expiresAt: '2026-02-05T14:30:26.205Z',
[api]   ageMs: 216345
[api] }
[api] [TokenJob] Skipping refresh for Base - another instance holds the lock
[api] [2026-02-05T14:30:06.479Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":28,"limit":200}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:30:07.611Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:30:12.657Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:30:13.897Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:30:16.142Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:30:17.621Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:30:21.095Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:30:21.097Z] [ERROR] [API-5002] GeckoTerminal API error after retries | DATA: {"endpoint":"/networks/eth/trending_pools?page=5&include=base_token&duration=5m","error":"Rate limit hit, backing off for 60000ms"}
[api] [2026-02-05T14:30:21.097Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"eth","error":"Rate limit hit, backing off for 60000ms"}
[api] [2026-02-05T14:30:21.097Z] [INFO] [API-5001][20454ms] Premium trending tokens fetch complete | DATA: {"count":94,"chain":"ethereum","source":"WebSocket","wsOriginal":194}
[api] [TokenJob] Got 94 trending tokens for Ethereum
[api] Saved 94 trending tokens for eth to database and memory cache
[api] [TokenJob] Saved 94 tokens for Ethereum to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:30:27.628Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:30:32.503Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
[api] [2026-02-05T14:30:32.562Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"bsc","limit":100}
[api] [2026-02-05T14:30:34.078Z] [INFO] [WTC-2002] WS addresses discovered | DATA: {"wsCount":194,"chain":"bsc"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:30:37.633Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:30:38.353Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":33,"limit":200}
[api] [2026-02-05T14:30:38.353Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"bsc","error":"GeckoTerminal backoff active (43s remaining)"}
[api] [2026-02-05T14:30:38.353Z] [INFO] [API-5001][5791ms] Premium trending tokens fetch complete | DATA: {"count":74,"chain":"bsc","source":"WebSocket","wsOriginal":194}
[api] [TokenJob] Got 74 trending tokens for BSC
[api] Saved 74 trending tokens for bsc to database and memory cache
[api] [TokenJob] Saved 74 tokens for BSC to DB + cache
[api] [TokenJob] Refreshed 4 primary chains in 95.9s
[api] [2026-02-05T14:30:46.323Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"dpfgo","creator":"0x2331a3ca2407201faf8902732daf480c2fdddef0"}
[api] [2026-02-05T14:30:46.756Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"naas","creator":"0x38ed3ecd2423e4cf774c8c5c2a8ce849d5fa94a5"}
[api] [2026-02-05T14:30:47.408Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"mddca","creator":"0x707a71d5e86c6deacb172af83b017ec00226c6ac"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:30:47.638Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:30:48.394Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"crest6471","creator":"0xaa7dc8eed06c551eadc8e7a7fbce7f6223ebee12"}
[api] [2026-02-05T14:30:48.977Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"rotv","creator":"0x62b335e07632d64c4c95f6045aa806bf3f4dd3e9"}
[api] [2026-02-05T14:30:49.482Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"nmuu","creator":"0x6b3906fe70af451382114cedb5afde7775b72a41"}
[api] [2026-02-05T14:30:50.714Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"wtqts","creator":"0x2a72c216940e4e66e2df82c30a2bcaad00377bc9"}
[api] [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
[api] [2026-02-05T14:30:51.166Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"solana","limit":100}
[api] [2026-02-05T14:30:51.371Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"ilesc","creator":"0x145df503dea67143a0204a7a1e7140dc6361a1ba"}
[api] [2026-02-05T14:30:52.604Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"kissmex","creator":"0xfb477458fb5bf26f20f4198ce6099ebb168333ba"}
[api] [2026-02-05T14:30:52.625Z] [INFO] [WTC-2002] WS addresses discovered | DATA: {"wsCount":282,"chain":"solana"}
[api] [2026-02-05T14:30:53.016Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"nqixi","creator":"0x83d2dc2b6709997be1f81a80a44d6b42bf0ce783"}
[api] [2026-02-05T14:30:55.004Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"qoffv","creator":"0x4aa6052f2667aec584c687aef265d8de6af64ef5"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:30:57.647Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:30:59.091Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":130,"limit":200}
[api] [2026-02-05T14:30:59.092Z] [INFO] [API-5001][7926ms] Premium trending tokens fetch complete | DATA: {"count":100,"chain":"solana","source":"WebSocket","wsOriginal":282}
[api] [TokenJob] Got 100 trending tokens for Solana
[api] Saved 100 trending tokens for solana to database and memory cache
[api] [TokenJob] Saved 100 tokens for Solana to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:31:07.649Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:31:17.658Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:31:27.663Z] [INFO] [SYS-1001] No open positions to monitor
[api] [DBLock] Cleaning expired/stale lock {
[api]   key: 'lock:tokenJob:refresh:base',
[api]   expiresAt: '2026-02-05T14:30:26.205Z',
[api]   ageMs: 302949,
[api]   isExpired: true,
[api]   isVeryStale: false
[api] }
[api] [DBLock] Acquired lock after cleaning stale entry { key: 'lock:tokenJob:refresh:base' }
[api] [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
[api] [2026-02-05T14:31:29.163Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"base","limit":100}
[api] [2026-02-05T14:31:30.651Z] [INFO] [WTC-2002] WS addresses discovered | DATA: {"wsCount":178,"chain":"base"}
[api] [2026-02-05T14:31:32.504Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [2026-02-05T14:31:34.713Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":42,"limit":200}
[api] [2026-02-05T14:31:36.574Z] [INFO] [API-5001] Skipping low liquidity token | DATA: {"symbol":"CLAWIAI","liquidity":8.21532e-15}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:31:37.671Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:31:38.818Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:31:40.065Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:31:42.332Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:31:47.323Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:31:47.324Z] [ERROR] [API-5002] GeckoTerminal API error after retries | DATA: {"endpoint":"/networks/base/trending_pools?page=5&include=base_token&duration=5m","error":"Rate limit hit, backing off for 60000ms"}
[api] [2026-02-05T14:31:47.324Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"base","error":"Rate limit hit, backing off for 60000ms"}
[api] [2026-02-05T14:31:47.324Z] [INFO] [API-5001][18161ms] Premium trending tokens fetch complete | DATA: {"count":69,"chain":"base","source":"WebSocket","wsOriginal":178}
[api] [TokenJob] Got 69 trending tokens for Base
[api] Saved 69 trending tokens for base to database and memory cache
[api] [TokenJob] Saved 69 tokens for Base to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:31:47.677Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:31:57.437Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"isygi","creator":"0x7bbb2764daf012ea88864469f3f554f5950d6d01"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:31:57.685Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:31:57.951Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"wren_e043","creator":"0x7d97827b9ab5a15a6528090c7ba9da3dde3ad0c1"}
[api] [2026-02-05T14:31:58.471Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"itac","creator":"0x01e064946031824b6d295e14cf898611c8704040"}
[api] [2026-02-05T14:31:59.515Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"idfwb","creator":"0xe73b8b68adaccfa0badeb8309671f85a974bfff1"}
[api] [2026-02-05T14:32:00.465Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"zsfzi","creator":"0xda05bd5ad744e128bded63a0696fa6a47e8f3915"}
[api] [2026-02-05T14:32:00.937Z] [INFO] [SYS-1007][TID:ff60b741-0cd3-4d28-96c2-fc84162fe7c0] Alpha Detector: Checking new coin | DATA: {"symbol":"kbhaz","creator":"0x026586b63b0bafb3983b747342abc4abc4143dc3"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:32:07.691Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770301932042,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58023},"msg":"incoming request"}
[api] {"level":30,"time":1770301932047,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","res":{"statusCode":204},"responseTime":4.012041002511978,"msg":"request completed"}
[api] {"level":30,"time":1770301932048,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58023},"msg":"incoming request"}
[api] {"level":30,"time":1770301932056,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWt0Zm5oa3gwMGNka3kwYzN0M2xtMzZpIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzAzMDE5MzEsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc3MDMwNTUzMX0.Hd9AyHJYKhg3ksL7SR2p72FA5fLSwvNDuxIdGWhHEABEKfETpYIDGm1G22igZ2EjUBhFvSp273oY5A0KYSzNPA","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58024},"msg":"incoming request"}
[api] [2026-02-05T14:32:12.058Z] [INFO] [WS-8001][TID:17799e55-6766-49b3-9da8-9dfd4cd88626] ChatWS Client connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1}
[api] [2026-02-05T14:32:12.059Z] [INFO] [WS-8001][TID:17799e55-6766-49b3-9da8-9dfd4cd88626] ChatWS: User connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl2...","tokenExp":1770305531}
[api] {"level":30,"time":1770301932060,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","req":{"method":"OPTIONS","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58025},"msg":"incoming request"}
[api] {"level":30,"time":1770301932060,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","res":{"statusCode":204},"responseTime":0.2568330019712448,"msg":"request completed"}
[api] {"level":30,"time":1770301932061,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58026},"msg":"incoming request"}
[api] {"level":30,"time":1770301932061,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","res":{"statusCode":204},"responseTime":0.23675000667572021,"msg":"request completed"}
[api] {"level":30,"time":1770301932064,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","res":{"statusCode":200},"responseTime":15.549625001847744,"msg":"request completed"}
[api] {"level":30,"time":1770301932064,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","req":{"method":"GET","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58025},"msg":"incoming request"}
[api] {"level":30,"time":1770301932066,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58026},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   userIdLength: 35,
[api]   userIdPrefix: 'did:privy:cmj0a3j3f0',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] {"level":30,"time":1770301932071,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","res":{"statusCode":200},"responseTime":6.518207997083664,"msg":"request completed"}
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1770301932081,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58023},"msg":"incoming request"}
[api] {"level":30,"time":1770301932082,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","res":{"statusCode":204},"responseTime":1.2682919949293137,"msg":"request completed"}
[api] {"level":30,"time":1770301932082,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","req":{"method":"OPTIONS","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58025},"msg":"incoming request"}
[api] {"level":30,"time":1770301932083,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","res":{"statusCode":204},"responseTime":0.2884170040488243,"msg":"request completed"}
[api] {"level":30,"time":1770301932083,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58023},"msg":"incoming request"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=what's my balance ?...
[api] {"level":30,"time":1770301932088,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","req":{"method":"POST","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58025},"msg":"incoming request"}
[api] {"level":30,"time":1770301932089,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58027},"msg":"incoming request"}
[api] {"level":30,"time":1770301932210,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","res":{"statusCode":200},"responseTime":121.47062500566244,"msg":"request completed"}
[api] {"level":30,"time":1770301932212,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","res":{"statusCode":200},"responseTime":128.85695800185204,"msg":"request completed"}
[api] {"level":30,"time":1770301932214,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k291m009jcc0hj9gog7hp","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58025},"msg":"incoming request"}
[api] {"level":30,"time":1770301932215,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","res":{"statusCode":204},"responseTime":0.7878750041127205,"msg":"request completed"}
[api] {"level":30,"time":1770301932217,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","req":{"method":"GET","url":"/api/chat/sessions/cml9k291m009jcc0hj9gog7hp","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58023},"msg":"incoming request"}
[api] {"level":30,"time":1770301932262,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","res":{"statusCode":200},"responseTime":44.912832997739315,"msg":"request completed"}
[api] {"level":30,"time":1770301932268,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k291m009jcc0hj9gog7hp/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58025},"msg":"incoming request"}
[api] {"level":30,"time":1770301932268,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","res":{"statusCode":204},"responseTime":0.5257500037550926,"msg":"request completed"}
[api] {"level":30,"time":1770301932270,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","req":{"method":"POST","url":"/api/chat/sessions/cml9k291m009jcc0hj9gog7hp/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58023},"msg":"incoming request"}
[api] {"level":30,"time":1770301934632,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9jl2hc00026bas9qpal9v7","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58025},"msg":"incoming request"}
[api] {"level":30,"time":1770301934633,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","res":{"statusCode":204},"responseTime":0.6843749955296516,"msg":"request completed"}
[api] {"level":30,"time":1770301934635,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","req":{"method":"DELETE","url":"/api/chat/sessions/cml9jl2hc00026bas9qpal9v7","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58025},"msg":"incoming request"}
[api] {"level":30,"time":1770301934645,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","res":{"statusCode":200},"responseTime":10.531458996236324,"msg":"request completed"}
[api] [2026-02-05T14:32:17.107Z] [WARN] [API-5002][TID:0da960d1-0065-4d66-9edc-b25cb7fad753] Failed to fetch Coinbase price | DATA: {"symbol":"BNB","error":"fetch failed"}
[api] [TokenJob] Tokens for BSC are fresh, skipping API call
[api] [TokenJob] Refreshed 4 primary chains in 136.7s
[api] {"level":30,"time":1770301937468,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","res":{"statusCode":200},"responseTime":5377.886875003576,"msg":"request completed"}
[api] {"level":30,"time":1770301937472,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58025},"msg":"incoming request"}
[api] {"level":30,"time":1770301937473,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","res":{"statusCode":204},"responseTime":0.2889169976115227,"msg":"request completed"}
[api] {"level":30,"time":1770301937476,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58027},"msg":"incoming request"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:32:17.700Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770301938212,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","res":{"statusCode":200},"responseTime":5941.533584006131,"msg":"request completed"}
[api] {"level":30,"time":1770301938220,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58025},"msg":"incoming request"}
[api] {"level":30,"time":1770301938221,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","res":{"statusCode":204},"responseTime":0.624209001660347,"msg":"request completed"}
[api] {"level":30,"time":1770301938224,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58023},"msg":"incoming request"}
[api] {"level":30,"time":1770301938232,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","res":{"statusCode":200},"responseTime":8.394083999097347,"msg":"request completed"}
[api] {"level":30,"time":1770301938234,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58025},"msg":"incoming request"}
[api] {"level":30,"time":1770301938364,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","res":{"statusCode":200},"responseTime":6297.60462500155,"msg":"request completed"}
[api] {"level":30,"time":1770301938369,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58023},"msg":"incoming request"}
[api] {"level":30,"time":1770301940522,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","res":{"statusCode":200},"responseTime":3045.3746659979224,"msg":"request completed"}
[api] {"level":30,"time":1770301940523,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","res":{"statusCode":200},"responseTime":2288.852291993797,"msg":"request completed"}
[api] {"level":30,"time":1770301940632,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","res":{"statusCode":200},"responseTime":2262.0922500044107,"msg":"request completed"}
[api] [2026-02-05T14:32:20.806Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:32:20.807Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:32:20.807Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: what's my balance ?...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:58114 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-05T14:32:22.267Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:32:22.272Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml9k296v009pcc0haicsqceg
[api] [2026-02-05T14:32:22.273Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":137,"tokenCount":7,"hasNativeBalance":true}
[api] [ChatWorker] Base filtered to 46 tools for message: "what's my balance ?..."
[api] [ChatWorker] 🔍 RAG check for: "what's my balance ?..."
[api] [ChatWorker] 🎯 RAG: Match found! Query looks informational.
[api] [2026-02-05T14:32:22.274Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/embeddings "HTTP/1.1 200 OK"
[python] ERROR:rag.router:Query failed: Collection expecting embedding with dimension of 384, got 1536
[python] INFO:     127.0.0.1:58119 - "POST /rag/query HTTP/1.1" 500 Internal Server Error
[api] [2026-02-05T14:32:23.640Z] [ERROR] [API-5002] api failed after 1 attempts | DATA: {"error":"HTTP 500: {\"detail\":\"Collection expecting embedding with dimension of 384, got 1536\"}","url":"http://localhost:8000/rag/query"}
[api] [2026-02-05T14:32:23.641Z] [WARN] [API-5002] RAGClient: Query failed (skipping RAG) | DATA: {"error":"HTTP 500: {\"detail\":\"Collection expecting embedding with dimension of 384, got 1536\"}"}
[api] [ChatWorker] ℹ️ RAG: No relevant knowledge found in local base.
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml9k2dqz009rcc0h1p80aox3
[api] [2026-02-05T14:32:23.641Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:32:23.645Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:32:23.652Z] [INFO] [AI-6001][7ms] Timer finished: intent_parsing_96589beb | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"wallet_balance","highLevelIntent":"MARKET_ANALYSIS","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"MARKET_ANALYSIS","slotsComplete":false,"labels":[{"label":"MARKET_ANALYSIS","confidence":0.95},{"label":"PREDICTION_MARKETS","confidence":0.1414213562373095},{"label":"GENERAL_CHAT","confidence":0.1414213562373095}],"timerLabel":"intent_parsing_96589beb"}
[api] [2026-02-05T14:32:23.656Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:32:23.656Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml9k2dqz009rcc0h1p80aox3","sessionId":"cml9k291m009jcc0hj9gog7hp","model":"deepseek-chat","intent":"MARKET_ANALYSIS","routingMode":"thinking","hardRule":{"label":"MARKET_ANALYSIS","reason":"question intent"},"confidence":0.95}
[api] [ChatWorker] Skill-gated to 26 tools for intent=MARKET_ANALYSIS skills=polymarket_prediction, token_analysis, wallet_portfolio, welcome_onboarding
[api] [2026-02-05T14:32:23.656Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml9k2dqz009rcc0h1p80aox3","sessionId":"cml9k291m009jcc0hj9gog7hp","model":"deepseek-chat","intent":"MARKET_ANALYSIS","routingMode":"thinking","skillVersion":"clean","skills":["polymarket_prediction","token_analysis","wallet_portfolio","welcome_onboarding"],"toolCount":26}
[api] [2026-02-05T14:32:23.657Z] [INFO] [AI-6007] ChatWorker: early pre-fetch used client context | DATA: {"tool":"get_wallet_info"}
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: false,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
[api]     'userRole',
[api]     'defaultSwapAmount',
[api]     'defaultSwapUnit',
[api]     'checkTokenBeforeSwap',
[api]     'showQuoteBeforeSwap',
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
[api]     'quickSwapMode',
[api]     'copyTradeAIMode',
[api]     'updatedAt',
[api]     'createdAt',
[api]     'zoraNotificationThreshold'
[api]   ],
[api]   walletConnected: true,
[api]   chainId: 137
[api] }
[api] [ChatWorker] Waiting for early pre-fetch to complete
[api] [2026-02-05T14:32:23.658Z] [INFO] [AI-6003] Timer finished: prompt_gen_MARKET_ANALYSIS_deepseek | DATA: {"model":"deepseek","intent":"MARKET_ANALYSIS","length":2676,"timerLabel":"prompt_gen_MARKET_ANALYSIS_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (7 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:32:23.659Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:32:23.660Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1236}
[api] [2026-02-05T14:32:23.660Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9k296v009pcc0haicsqceg. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:32:23.660Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:32:27.707Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:32:32.505Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:32:37.715Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:32:38.289Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[python] INFO:moderation.router:Moderating output: Based on your connected wallet, here's your curren...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:58220 - "POST /moderation/output HTTP/1.1" 200 OK
[api] [2026-02-05T14:32:39.695Z] [INFO] [SYS-1007] Moderation Output check result | DATA: {"safe":true,"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] Broadcasting message_complete for cml9k296v009pcc0haicsqceg
[api] [2026-02-05T14:32:39.712Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] [2026-02-05T14:32:39.722Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:32:39.723Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] {"level":30,"time":1770301959727,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k291m009jcc0hj9gog7hp","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58026},"msg":"incoming request"}
[api] {"level":30,"time":1770301959733,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","res":{"statusCode":204},"responseTime":5.58024999499321,"msg":"request completed"}
[api] {"level":30,"time":1770301959733,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k291m009jcc0hj9gog7hp","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58027},"msg":"incoming request"}
[api] {"level":30,"time":1770301959734,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","res":{"statusCode":204},"responseTime":0.4975000023841858,"msg":"request completed"}
[api] {"level":30,"time":1770301959735,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","req":{"method":"GET","url":"/api/chat/sessions/cml9k291m009jcc0hj9gog7hp","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58025},"msg":"incoming request"}
[api] {"level":30,"time":1770301959738,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","req":{"method":"GET","url":"/api/chat/sessions/cml9k291m009jcc0hj9gog7hp","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58023},"msg":"incoming request"}
[api] {"level":30,"time":1770301959743,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","res":{"statusCode":200},"responseTime":7.568708002567291,"msg":"request completed"}
[api] {"level":30,"time":1770301959744,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","res":{"statusCode":200},"responseTime":5.697749994695187,"msg":"request completed"}
[api] {"level":30,"time":1770301966448,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-u","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58026},"msg":"incoming request"}
[api] {"level":30,"time":1770301966450,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-u","res":{"statusCode":204},"responseTime":0.7124169990420341,"msg":"request completed"}
[api] {"level":30,"time":1770301966450,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-v","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k291m009jcc0hj9gog7hp/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58027},"msg":"incoming request"}
[api] {"level":30,"time":1770301966450,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-v","res":{"statusCode":204},"responseTime":0.29612499475479126,"msg":"request completed"}
[api] {"level":30,"time":1770301966451,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58025},"msg":"incoming request"}
[api] {"level":30,"time":1770301966451,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","res":{"statusCode":204},"responseTime":0.11779199540615082,"msg":"request completed"}
[api] {"level":30,"time":1770301966451,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-x","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58023},"msg":"incoming request"}
[api] {"level":30,"time":1770301966455,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","req":{"method":"POST","url":"/api/chat/sessions/cml9k291m009jcc0hj9gog7hp/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58026},"msg":"incoming request"}
[api] {"level":30,"time":1770301966457,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-z","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58027},"msg":"incoming request"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=What about USDC ?...
[api] {"level":30,"time":1770301966466,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-x","res":{"statusCode":200},"responseTime":14.630208998918533,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:32:47.723Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770301972147,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-z","res":{"statusCode":200},"responseTime":5690.501374997199,"msg":"request completed"}
[api] {"level":30,"time":1770301972151,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-10","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58025},"msg":"incoming request"}
[api] {"level":30,"time":1770301972152,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-10","res":{"statusCode":204},"responseTime":0.45262499898672104,"msg":"request completed"}
[api] {"level":30,"time":1770301972153,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-11","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58023},"msg":"incoming request"}
[api] {"level":30,"time":1770301972222,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","res":{"statusCode":200},"responseTime":5767.194499999285,"msg":"request completed"}
[api] {"level":30,"time":1770301972238,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-12","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58027},"msg":"incoming request"}
[api] {"level":30,"time":1770301972238,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-12","res":{"statusCode":204},"responseTime":0.14483299851417542,"msg":"request completed"}
[api] {"level":30,"time":1770301972240,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-13","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58025},"msg":"incoming request"}
[api] {"level":30,"time":1770301972254,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-14","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58026},"msg":"incoming request"}
[api] {"level":30,"time":1770301972320,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-13","res":{"statusCode":200},"responseTime":78.98937500268221,"msg":"request completed"}
[api] [2026-02-05T14:32:53.842Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:32:53.843Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:32:53.843Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: What about USDC ?...
[api] {"level":30,"time":1770301974679,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-14","res":{"statusCode":200},"responseTime":2425.2646249979734,"msg":"request completed"}
[api] {"level":30,"time":1770301974684,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-15","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58027},"msg":"incoming request"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:58337 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-05T14:32:54.930Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:32:54.931Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml9k2zkf00a0cc0hnuawoapa
[api] [2026-02-05T14:32:54.931Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":137,"tokenCount":3,"hasNativeBalance":true}
[api] [ChatWorker] Base filtered to 46 tools for message: "What about USDC ?..."
[api] [ChatWorker] 🔍 RAG check for: "What about USDC ?..."
[api] [ChatWorker] 🎯 RAG: Match found! Query looks informational.
[api] [2026-02-05T14:32:54.932Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] {"level":30,"time":1770301975408,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-11","res":{"statusCode":200},"responseTime":3254.8875409960747,"msg":"request completed"}
[api] {"level":30,"time":1770301976203,"pid":88386,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-15","res":{"statusCode":200},"responseTime":1518.3149159997702,"msg":"request completed"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/embeddings "HTTP/1.1 200 OK"
[python] ERROR:rag.router:Query failed: Collection expecting embedding with dimension of 384, got 1536
[python] INFO:     127.0.0.1:58342 - "POST /rag/query HTTP/1.1" 500 Internal Server Error
[api] [2026-02-05T14:32:56.415Z] [ERROR] [API-5002] api failed after 1 attempts | DATA: {"error":"HTTP 500: {\"detail\":\"Collection expecting embedding with dimension of 384, got 1536\"}","url":"http://localhost:8000/rag/query"}
[api] [2026-02-05T14:32:56.415Z] [WARN] [API-5002] RAGClient: Query failed (skipping RAG) | DATA: {"error":"HTTP 500: {\"detail\":\"Collection expecting embedding with dimension of 384, got 1536\"}"}
[api] [ChatWorker] ℹ️ RAG: No relevant knowledge found in local base.
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml9k33wk00a2cc0hx7c7d32h
[api] [2026-02-05T14:32:56.415Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:32:56.417Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:32:56.420Z] [INFO] [AI-6001][2ms] Timer finished: intent_parsing_35cdb050 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"token_info","highLevelIntent":"MARKET_ANALYSIS","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"MARKET_ANALYSIS","slotsComplete":false,"labels":[{"label":"MARKET_ANALYSIS","confidence":0.95},{"label":"SOCIAL_SENSING","confidence":0.23094010767585035},{"label":"RISK_SCAN","confidence":0.1632993161855452}],"timerLabel":"intent_parsing_35cdb050"}
[api] [2026-02-05T14:32:56.426Z] [INFO] [AI-6001] Intent follow-up recorded | DATA: {"previousIntent":"MARKET_ANALYSIS","nextIntent":"MARKET_ANALYSIS","sessionId":"cml9k291m009jcc0hj9gog7hp"}
[api] [2026-02-05T14:32:56.426Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:32:56.426Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml9k33wk00a2cc0hx7c7d32h","sessionId":"cml9k291m009jcc0hj9gog7hp","model":"deepseek-chat","intent":"MARKET_ANALYSIS","routingMode":"thinking","hardRule":{"label":"MARKET_ANALYSIS","reason":"question intent"},"confidence":0.95}
[api] [ChatWorker] Skill-gated to 26 tools for intent=MARKET_ANALYSIS skills=polymarket_prediction, token_analysis, wallet_portfolio, welcome_onboarding
[api] [2026-02-05T14:32:56.426Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml9k33wk00a2cc0hx7c7d32h","sessionId":"cml9k291m009jcc0hj9gog7hp","model":"deepseek-chat","intent":"MARKET_ANALYSIS","routingMode":"thinking","skillVersion":"clean","skills":["polymarket_prediction","token_analysis","wallet_portfolio","welcome_onboarding"],"toolCount":26}
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: false,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
[api]     'userRole',
[api]     'defaultSwapAmount',
[api]     'defaultSwapUnit',
[api]     'checkTokenBeforeSwap',
[api]     'showQuoteBeforeSwap',
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
[api]     'quickSwapMode',
[api]     'copyTradeAIMode',
[api]     'updatedAt',
[api]     'createdAt',
[api]     'zoraNotificationThreshold'
[api]   ],
[api]   walletConnected: true,
[api]   chainId: 137
[api] }
[api] [ChatWorker] Waiting for early pre-fetch to complete
[api] [2026-02-05T14:32:56.431Z] [INFO] [AI-6003] Timer finished: prompt_gen_MARKET_ANALYSIS_deepseek | DATA: {"model":"deepseek","intent":"MARKET_ANALYSIS","length":2676,"timerLabel":"prompt_gen_MARKET_ANALYSIS_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (3 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:32:56.432Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:32:56.432Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1034}
[api] [2026-02-05T14:32:56.432Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9k2zkf00a0cc0hnuawoapa. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:32:56.432Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:32:57.731Z] [INFO] [SYS-1001] No open positions to monitor
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-02-05T14:33:01.703Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T14:33:01.709Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9k291m009jcc0hj9gog7hp","messageId":"cml9k2zkf00a0cc0hnuawoapa","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T14:33:01.710Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"get_token_price","sessionId":"cml9k291m009jcc0hj9gog7hp","messageId":"cml9k2zkf00a0cc0hnuawoapa","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:33:01.711Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [GetTokenPrice] Fetching price for USDC (isAddress: false)...
[api] [2026-02-05T14:33:02.735Z] [INFO] [AI-6007][1025ms] ChatWorker: tool success | DATA: {"tool":"get_token_price","sessionId":"cml9k291m009jcc0hj9gog7hp","messageId":"cml9k2zkf00a0cc0hnuawoapa","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] DeepSeek iteration 2/10 for task cml9k33wk00a2cc0hx7c7d32h
[api] [2026-02-05T14:33:02.741Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:33:02.744Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:33:02.744Z] [INFO] [AI-6001] Timer finished: intent_parsing_a52d3ef0 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"token_info","highLevelIntent":"MARKET_ANALYSIS","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"MARKET_ANALYSIS","slotsComplete":false,"labels":[{"label":"MARKET_ANALYSIS","confidence":0.95},{"label":"SOCIAL_SENSING","confidence":0.23094010767585035},{"label":"RISK_SCAN","confidence":0.1632993161855452}],"timerLabel":"intent_parsing_a52d3ef0"}
[api] [2026-02-05T14:33:02.745Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: false,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
[api]     'userRole',
[api]     'defaultSwapAmount',
[api]     'defaultSwapUnit',
[api]     'checkTokenBeforeSwap',
[api]     'showQuoteBeforeSwap',
[api]     'swapMethod',
[api]     'slippageMode',
[api]     'customSlippage',
[api]     'mevProtection',
[api]     'priceDeviationCheck',
[api]     'fastSwapMode',
[Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] [2026-02-05T14:33:15.052Z] [INFO] [SYS-1001] Zora SDK initialized with API Key
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
[Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] [2026-02-05T14:33:26.895Z] [INFO] [SYS-1001] Zora SDK initialized with API Key
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
[api] [SkillRegistry:clean] Loaded skill: copy_trade
[api] [SkillRegistry:clean] Loaded skill: cross_chain_swap
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
[api] [2026-02-05T14:33:27.371Z] [INFO] [SYS-1001] Build SHA | DATA: {"buildSha":"unknown"}
[api] [2026-02-05T14:33:27.371Z] [WARN] [SYS-1001] Public folder not found - skipping static file serving | DATA: {"path":"/Users/almurat/KiKo/kiko-api/public"}
[api] [2026-02-05T14:33:27.373Z] [INFO] [SYS-1001] Initializing services... | DATA: {"env":"development","port":3001,"database":"configured","privy":"✅ Configured"}
[api] [Prisma] DB connection is healthy
[api] [2026-02-05T14:33:27.395Z] [INFO] [SYS-1004] Database connection successful
[api] [DataRetention] Checking retention policies...
[api] [DataRetention] Starting cleanup job...
[api] [2026-02-05T14:33:27.400Z] [INFO] [SYS-1005] Redis initialized
[api] [2026-02-05T14:33:27.400Z] [INFO] [SYS-1001] Starting server on port 3001...
[api] {"level":30,"time":1770302007430,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","msg":"Server listening at http://0.0.0.0:3001"}
[api] [2026-02-05T14:33:27.431Z] [INFO] [SYS-1001] Server listening | DATA: {"url":"http://localhost:3001","health":"http://localhost:3001/health"}
[api] [2026-02-05T14:33:27.431Z] [INFO] [SYS-1001] RPC health monitor started
[api] [2026-02-05T14:33:27.433Z] [INFO] [SYS-1001] RPC benchmark sampling started
[api] [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
[api] [TokenJob] Scheduled: Primary chains every 5min (Ethereum, Solana, Base, BSC)
[api] [TokenJob] Scheduled: Secondary chains every 4h (Arbitrum, Optimism, Polygon)
[api] [SocialJob] Scheduled: Discovery (30m), Refresh (4h), Scoring (5m)
[api] [2026-02-05T14:33:27.448Z] [INFO] [SYS-1001] Background jobs started
[api] [2026-02-05T14:33:27.448Z] [INFO] [SYS-1001] Initializing auto trade service...
[api] [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
[api] [2026-02-05T14:33:27.448Z] [INFO] [SYS-1001] Auto trade service initialized (Solana watcher + EVM webhook enabled) | DATA: {"mode":"hybrid"}
[api] [2026-02-05T14:33:27.448Z] [INFO] [SYS-1001] Auto trade service started
[api] [PositionMonitor] Starting position monitor (every 30s)...
[api] [2026-02-05T14:33:27.448Z] [INFO] [SYS-1001] Position monitor started
[api] [2026-02-05T14:33:27.448Z] [INFO] [SYS-1001] Token Alert Service started
[api] [2026-02-05T14:33:27.448Z] [INFO] [SYS-1001] Token alert service started
[api] [ChatWorker] Started polling for AI tasks (interval: 3000ms)
[api] [2026-02-05T14:33:27.448Z] [INFO] [SYS-1001] Chat worker started
[api] [2026-02-05T14:33:27.448Z] [INFO] [SYS-1001] Starting Global Zora Alpha Detector (API Polling) | DATA: {"thresholds":{"farcaster":50000,"twitter":500000,"instagram":500000,"tiktok":500000},"interval":60000}
[api] [2026-02-05T14:33:27.449Z] [INFO] [SYS-1001] 🎉 All services initialized!
[api] [DataRetention] Cleanup job completed.
[api] {"level":30,"time":1770302009035,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWt0Zm5oa3gwMGNka3kwYzN0M2xtMzZpIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzAzMDE5MzEsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc3MDMwNTUzMX0.Hd9AyHJYKhg3ksL7SR2p72FA5fLSwvNDuxIdGWhHEABEKfETpYIDGm1G22igZ2EjUBhFvSp273oY5A0KYSzNPA","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58527},"msg":"incoming request"}
[api] [2026-02-05T14:33:30.088Z] [INFO] [WS-8001][TID:8891453e-4890-48b1-a64e-430e85a36860] ChatWS Client connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1}
[api] [2026-02-05T14:33:30.088Z] [INFO] [WS-8001][TID:8891453e-4890-48b1-a64e-430e85a36860] ChatWS: User connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl2...","tokenExp":1770305531}
[api] [MarketJob] Running startup staleness check...
[api] [PositionMonitor] 🔄 Running position check...
[api] [MarketJob] Overview is fresh, skipping API call
[api] [MarketJob] Protocols are fresh, skipping API call
[api] [Job] ✅ Loaded 436 real hot users from /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Job] ✅ Using 436 real hot users from analysis
[api] [SocialJob] fetchCastsFromUsers starting with 436 FIDs, target: 1000
[api] [2026-02-05T14:33:32.476Z] [INFO] [SYS-1001] No open positions to monitor
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:33:42.491Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770302025576,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58648},"msg":"incoming request"}
[api] {"level":30,"time":1770302025581,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","res":{"statusCode":204},"responseTime":4.192832998931408,"msg":"request completed"}
[api] {"level":30,"time":1770302025582,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58648},"msg":"incoming request"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=Swap 3 usdc to matic...
[api] {"level":30,"time":1770302025589,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k291m009jcc0hj9gog7hp/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58649},"msg":"incoming request"}
[api] {"level":30,"time":1770302025590,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","res":{"statusCode":204},"responseTime":0.41029199957847595,"msg":"request completed"}
[api] {"level":30,"time":1770302025590,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58650},"msg":"incoming request"}
[api] {"level":30,"time":1770302025591,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","res":{"statusCode":204},"responseTime":0.5225410014390945,"msg":"request completed"}
[api] {"level":30,"time":1770302025592,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","req":{"method":"POST","url":"/api/chat/sessions/cml9k291m009jcc0hj9gog7hp/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58649},"msg":"incoming request"}
[api] {"level":30,"time":1770302025595,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","res":{"statusCode":200},"responseTime":12.850665993988514,"msg":"request completed"}
[api] {"level":30,"time":1770302025595,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58650},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   userIdLength: 35,
[api]   userIdPrefix: 'did:privy:cmj0a3j3f0',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1770302030981,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","res":{"statusCode":200},"responseTime":5389.256416000426,"msg":"request completed"}
[api] {"level":30,"time":1770302030989,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58648},"msg":"incoming request"}
[api] {"level":30,"time":1770302030990,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","res":{"statusCode":204},"responseTime":0.7760419994592667,"msg":"request completed"}
[api] {"level":30,"time":1770302030993,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58649},"msg":"incoming request"}
[api] {"level":30,"time":1770302031000,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","res":{"statusCode":200},"responseTime":6.831790998578072,"msg":"request completed"}
[api] {"level":30,"time":1770302031012,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58648},"msg":"incoming request"}
[api] {"level":30,"time":1770302031014,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","res":{"statusCode":204},"responseTime":0.9353749975562096,"msg":"request completed"}
[api] {"level":30,"time":1770302031014,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58649},"msg":"incoming request"}
[api] [ChatWorker] Sanitizing orphaned tool_calls from message 3 (missing 1 tool results)
[api] [2026-02-05T14:33:51.508Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:33:51.508Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:33:51.508Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: Swap 3 usdc to matic...
[api] {"level":30,"time":1770302031912,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","res":{"statusCode":200},"responseTime":6317.032917000353,"msg":"request completed"}
[api] {"level":30,"time":1770302031918,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58648},"msg":"incoming request"}
[api] {"level":30,"time":1770302031919,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","res":{"statusCode":204},"responseTime":0.7225409969687462,"msg":"request completed"}
[api] {"level":30,"time":1770302031920,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58650},"msg":"incoming request"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:33:52.497Z] [INFO] [SYS-1001] No open positions to monitor
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:58711 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-05T14:33:52.966Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:33:52.970Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml9k497600066jmxe0b6b9l7
[api] [2026-02-05T14:33:52.971Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":137,"tokenCount":6,"hasNativeBalance":true}
[api] [ChatWorker] Base filtered to 46 tools for message: "Swap 3 usdc to matic..."
[api] [ChatWorker] 🔍 RAG check for: "Swap 3 usdc to matic..."
[api] [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml9k4dbu00086jmxp9q05twy
[api] [2026-02-05T14:33:52.972Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:33:52.976Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:33:52.984Z] [INFO] [AI-6001][8ms] Timer finished: intent_parsing_2e64fff6 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.44999999999999996},{"label":"PREDICTION_MARKETS","confidence":0.1414213562373095}],"timerLabel":"intent_parsing_2e64fff6"}
[api] [2026-02-05T14:33:52.988Z] [INFO] [AI-6001] Intent follow-up recorded | DATA: {"previousIntent":"MARKET_ANALYSIS","nextIntent":"TRADING","sessionId":"cml9k291m009jcc0hj9gog7hp"}
[api] [2026-02-05T14:33:52.988Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:33:52.988Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml9k4dbu00086jmxp9q05twy","sessionId":"cml9k291m009jcc0hj9gog7hp","model":"deepseek-chat","intent":"TRADING","routingMode":"execution","hardRule":{"label":"TRADING","reason":"action + slots complete"},"confidence":0.95}
[api] [ChatWorker] Skill-gated to 13 tools for intent=TRADING skills=cross_chain_swap, swap, token_alert, wallet_portfolio
[api] [2026-02-05T14:33:52.989Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml9k4dbu00086jmxp9q05twy","sessionId":"cml9k291m009jcc0hj9gog7hp","model":"deepseek-chat","intent":"TRADING","routingMode":"execution","skillVersion":"exec","skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"],"toolCount":13}
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: false,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
[api]     'userRole',
[api]     'defaultSwapAmount',
[api]     'defaultSwapUnit',
[api]     'checkTokenBeforeSwap',
[api]     'showQuoteBeforeSwap',
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
[api]     'quickSwapMode',
[api]     'copyTradeAIMode',
[api]     'updatedAt',
[api]     'createdAt',
[api]     'zoraNotificationThreshold'
[api]   ],
[api]   walletConnected: true,
[api]   chainId: 137
[api] }
[api] [ChatWorker] 🚀 Fast Swap Decision: {
[api]   fastSwapModeEnabled: false,
[api]   willFastSwap: false,
[api]   reason: 'Normal LLM flow (AI will call tools)'
[api] }
[api] [ChatWorker] Waiting for early pre-fetch to complete
[api] [2026-02-05T14:33:52.990Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":4,"skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"]}
[api] [2026-02-05T14:33:52.990Z] [INFO] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":13016,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (6 tokens cached)
[api] [2026-02-05T14:33:52.991Z] [INFO] [AI-6007] ChatWorker: requested token balance resolved | DATA: {"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":137,"requested":["USDC","MATIC"],"matched":["USDC","MATIC"],"missing":[],"resolvedBalances":{"USDC":"5.926982","MATIC":"20.6044348920309"}}
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:33:52.991Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:33:52.991Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1199}
[api] [2026-02-05T14:33:52.991Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-02-05T14:33:52.991Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":185}
[api] [2026-02-05T14:33:52.991Z] [INFO] [AI-6007] ChatWorker: balance system rule injected
[api] [ChatWorker] Broadcasting Thinking status for cml9k497600066jmxe0b6b9l7. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:33:52.991Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] {"level":30,"time":1770302033925,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","res":{"statusCode":200},"responseTime":2910.9647080004215,"msg":"request completed"}
[api] {"level":30,"time":1770302033930,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58648},"msg":"incoming request"}
[api] {"level":30,"time":1770302034548,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","res":{"statusCode":200},"responseTime":2627.188292004168,"msg":"request completed"}
[api] {"level":30,"time":1770302036636,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","res":{"statusCode":200},"responseTime":2705.0782500058413,"msg":"request completed"}
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [TokenJob] Starting initial token refresh...
[api] [TokenJob] Tokens for Ethereum are fresh, skipping API call
[api] [2026-02-05T14:33:59.160Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T14:33:59.171Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9k291m009jcc0hj9gog7hp","messageId":"cml9k497600066jmxe0b6b9l7","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T14:33:59.172Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"simulate_swap","sessionId":"cml9k291m009jcc0hj9gog7hp","messageId":"cml9k497600066jmxe0b6b9l7","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:33:59.173Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] {"level":30,"time":1770302039195,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","req":{"method":"POST","url":"/api/swap/quote","hostname":"127.0.0.1:3001","remoteAddress":"127.0.0.1","remotePort":58773},"msg":"incoming request"}
[api] [Swap Quote] Fetching metadata for: {
[api]   tokenInForMetadata: '0x3c499c542c',
[api]   tokenOutForMetadata: '0x0d500B1d8E',
[api]   actualTokenIn: '0x3c499c542c',
[api]   actualTokenOut: '0xEeeeeEeeeE',
[api]   isTokenOutNative: true
[api] }
[api] [2026-02-05T14:34:00.299Z] [INFO] [API-5001][TID:36278a62-c16b-4584-b740-e58b1dcc4d9e] No token metadata available, trying RPC fallback... | DATA: {"tokenAddress":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","chainId":137}
[api] [2026-02-05T14:34:00.316Z] [INFO] [API-5001][TID:36278a62-c16b-4584-b740-e58b1dcc4d9e] Using 0x API fallback token metadata | DATA: {"symbol":"WMATIC","chainId":137}
[api] [Swap Quote] Overriding tokenIn decimals to known value: 6
[api] [Swap Quote] Token decimals: {
[api]   tokenIn: '0x3c499c54',
[api]   tokenOut: '0xEeeeeEee',
[api]   tokenInDecimals: 6,
[api]   tokenOutDecimals: 18,
[api]   tokenOutMetadataDecimals: 18
[api] }
[api] [2026-02-05T14:34:00.857Z] [INFO] [API-5001][TID:36278a62-c16b-4584-b740-e58b1dcc4d9e] Using 0x API fallback token metadata | DATA: {"symbol":"USDC","chainId":137}
[api] [2026-02-05T14:34:01.353Z] [INFO] [API-5001][TID:36278a62-c16b-4584-b740-e58b1dcc4d9e] 0x API price received successfully | DATA: {"sellToken":"0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270","buyToken":"0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174","chainId":137,"liquidityAvailable":true}
[api] [PlatformFee] Fees DISABLED, returning 0 bps
[api] [Kyber] GET routes {
[api]   routesUrl: 'https://aggregator-api.kyberswap.com/polygon/api/v1/routes?tokenIn=0x3c499c542cef5e3811e1192ce70d8cc03d5c3359&tokenOut=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&amountIn=3000000&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] [2026-02-05T14:34:01.882Z] [INFO] [API-5001][TID:36278a62-c16b-4584-b740-e58b1dcc4d9e] 0x API Quote received successfully | DATA: {"sellToken":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","buyToken":"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE","buyAmount":"29041847075253869386","usedEndpoint":"allowance-holder"}
[api] [2026-02-05T14:34:01.882Z] [INFO] [API-5001][TID:36278a62-c16b-4584-b740-e58b1dcc4d9e] 0x API Quote successful | DATA: {"sellToken":"0x3c499c542c","buyToken":"0xEeeeeEeeeE","buyAmount":"29041847075253869386","hasAllowanceIssue":true,"usedEndpoint":"allowance-holder"}
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 3,
[api]   amountOut: 29.04184707525387,
[api]   quotePrice: 9.68061569175129,
[api]   refPrice: 9.706853038245,
[api]   tokenInUsd: 'available',
[api]   impact: -0.27029714357820284,
[api]   formula: '((9.68061569175129 - 9.706853038245) / 9.706853038245) * 100 = -0.27029714357820284'
[api] }
[api] [QuoteService] 0x API estimatedPriceImpact: {
[api]   raw: undefined,
[api]   parsed: 0,
[api]   multipliedBy100: 0,
[api]   impactVsMkt: -0.27029714357820284,
[api]   willUse: -0.27029714357820284
[api] }
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:34:02.501Z] [INFO] [SYS-1001] No open positions to monitor
[api] [Kyber] routes response {
[api]   status: 200,
[api]   hasData: true,
[api]   keys: [ 'code', 'message', 'data', 'requestId' ]
[api] }
[api] [Kyber] Building route/build request body: {
[api]   hasRouteSummary: true,
[api]   routeSummaryKeys: [
[api]     'tokenIn',
[api]     'amountIn',
[api]     'amountInUsd',
[api]     'tokenOut',
[api]     'amountOut',
[api]     'amountOutUsd',
[api]     'gas',
[api]     'gasPrice'
[api]   ],
[api]   sender: '0xA386bc9D',
[api]   recipient: '0xA386bc9D',
[api]   slippageTolerance: 50,
[api]   slippageToleranceType: 'number',
[api]   deadline: 1770302642,
[api]   deadlineType: 'number',
[api]   allBodyKeys: [
[api]     'routeSummary',
[api]     'sender',
[api]     'recipient',
[api]     'origin',
[api]     'slippageTolerance',
[api]     'deadline'
[api]   ]
[api] }
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 3,
[api]   amountOut: 29.077500442690912,
[api]   quotePrice: 9.692500147563637,
[api]   refPrice: 9.706853038245,
[api]   tokenInUsd: 'available',
[api]   impact: -0.14786347979941108,
[api]   formula: '((9.692500147563637 - 9.706853038245) / 9.706853038245) * 100 = -0.14786347979941108'
[api] }
[api] [QuoteService] Quote comparison: {
[api]   '0x_amount': '29.041847075253869386',
[api]   kyber_amount: '29.077500442690912256',
[api]   kyber_advantage_pct: '0.00',
[api]   chainId: 137
[api] }
[api] [QuoteService] Preferring 0x for reliability { reason: 'prices within 2%', percentDiff: '0.00' }
[api] {"level":30,"time":1770302043097,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","res":{"statusCode":200},"responseTime":3902.128958001733,"msg":"request completed"}
[api] [2026-02-05T14:34:03.099Z] [INFO] [AI-6007][3927ms] ChatWorker: tool success | DATA: {"tool":"simulate_swap","sessionId":"cml9k291m009jcc0hj9gog7hp","messageId":"cml9k497600066jmxe0b6b9l7","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] DeepSeek iteration 2/10 for task cml9k4dbu00086jmxp9q05twy
[api] [2026-02-05T14:34:03.106Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:34:03.107Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:34:03.109Z] [INFO] [AI-6001][2ms] Timer finished: intent_parsing_0c7c9fbe | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.44999999999999996},{"label":"PREDICTION_MARKETS","confidence":0.1414213562373095}],"timerLabel":"intent_parsing_0c7c9fbe"}
[api] [2026-02-05T14:34:03.109Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: false,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
[api]     'userRole',
[api]     'defaultSwapAmount',
[api]     'defaultSwapUnit',
[api]     'checkTokenBeforeSwap',
[api]     'showQuoteBeforeSwap',
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
[api]     'quickSwapMode',
[api]     'copyTradeAIMode',
[api]     'updatedAt',
[api]     'createdAt',
[api]     'zoraNotificationThreshold'
[api]   ],
[api]   walletConnected: true,
[api]   chainId: 137
[api] }
[api] [ChatWorker] 🚀 Fast Swap Decision: {
[api]   fastSwapModeEnabled: false,
[api]   willFastSwap: false,
[api]   reason: 'Normal LLM flow (AI will call tools)'
[api] }
[api] [2026-02-05T14:34:03.110Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":4,"skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"]}
[api] [2026-02-05T14:34:03.110Z] [INFO] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":13016,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (6 tokens cached)
[api] [2026-02-05T14:34:03.110Z] [INFO] [AI-6007] ChatWorker: requested token balance resolved | DATA: {"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":137,"requested":["USDC","MATIC"],"matched":["USDC","MATIC"],"missing":[],"resolvedBalances":{"USDC":"5.926982","MATIC":"20.6044348920309"}}
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:34:03.110Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:34:03.110Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1199}
[api] [2026-02-05T14:34:03.110Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-02-05T14:34:03.111Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":185}
[api] [2026-02-05T14:34:03.111Z] [INFO] [AI-6007] ChatWorker: balance system rule injected
[api] [ChatWorker] Broadcasting Thinking status for cml9k497600066jmxe0b6b9l7. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:34:03.111Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:34:09.800Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[python] INFO:moderation.router:Moderating output: I'll help you swap 3 USDC to MATIC on Polygon. Let...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:58832 - "POST /moderation/output HTTP/1.1" 200 OK
[api] [2026-02-05T14:34:10.937Z] [INFO] [SYS-1007] Moderation Output check result | DATA: {"safe":true,"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] Broadcasting message_complete for cml9k497600066jmxe0b6b9l7
[api] [2026-02-05T14:34:10.954Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] [2026-02-05T14:34:10.958Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:34:10.959Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] {"level":30,"time":1770302050970,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k291m009jcc0hj9gog7hp","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58649},"msg":"incoming request"}
[api] {"level":30,"time":1770302050971,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","res":{"statusCode":204},"responseTime":0.6039580032229424,"msg":"request completed"}
[api] {"level":30,"time":1770302050972,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k291m009jcc0hj9gog7hp","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58650},"msg":"incoming request"}
[api] {"level":30,"time":1770302050972,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","res":{"statusCode":204},"responseTime":0.2702919989824295,"msg":"request completed"}
[api] {"level":30,"time":1770302050974,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","req":{"method":"GET","url":"/api/chat/sessions/cml9k291m009jcc0hj9gog7hp","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58648},"msg":"incoming request"}
[api] {"level":30,"time":1770302050977,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","req":{"method":"GET","url":"/api/chat/sessions/cml9k291m009jcc0hj9gog7hp","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58649},"msg":"incoming request"}
[api] {"level":30,"time":1770302050984,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","res":{"statusCode":200},"responseTime":9.413957998156548,"msg":"request completed"}
[api] {"level":30,"time":1770302050984,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","res":{"statusCode":200},"responseTime":7.501249998807907,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:34:12.509Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770302055220,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58650},"msg":"incoming request"}
[api] {"level":30,"time":1770302055222,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","res":{"statusCode":204},"responseTime":0.8769589960575104,"msg":"request completed"}
[api] {"level":30,"time":1770302055222,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k291m009jcc0hj9gog7hp/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58648},"msg":"incoming request"}
[api] {"level":30,"time":1770302055223,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","res":{"statusCode":204},"responseTime":0.35279200226068497,"msg":"request completed"}
[api] {"level":30,"time":1770302055223,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58649},"msg":"incoming request"}
[api] {"level":30,"time":1770302055223,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","res":{"statusCode":204},"responseTime":0.2352909967303276,"msg":"request completed"}
[api] {"level":30,"time":1770302055224,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58650},"msg":"incoming request"}
[api] {"level":30,"time":1770302055226,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","req":{"method":"POST","url":"/api/chat/sessions/cml9k291m009jcc0hj9gog7hp/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58648},"msg":"incoming request"}
[api] {"level":30,"time":1770302055228,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58649},"msg":"incoming request"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=Proceed...
[api] {"level":30,"time":1770302055237,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","res":{"statusCode":200},"responseTime":13.024041004478931,"msg":"request completed"}
[api] {"level":30,"time":1770302060177,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","res":{"statusCode":200},"responseTime":4948.675875000656,"msg":"request completed"}
[api] {"level":30,"time":1770302060569,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","res":{"statusCode":200},"responseTime":5342.786541998386,"msg":"request completed"}
[api] {"level":30,"time":1770302060576,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58650},"msg":"incoming request"}
[api] {"level":30,"time":1770302060577,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","res":{"statusCode":204},"responseTime":0.49479199945926666,"msg":"request completed"}
[api] {"level":30,"time":1770302060579,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58649},"msg":"incoming request"}
[api] {"level":30,"time":1770302060585,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","res":{"statusCode":200},"responseTime":5.118749998509884,"msg":"request completed"}
[api] {"level":30,"time":1770302060602,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58648},"msg":"incoming request"}
[api] {"level":30,"time":1770302060602,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","res":{"statusCode":204},"responseTime":0.23262500017881393,"msg":"request completed"}
[api] {"level":30,"time":1770302060603,"pid":89299,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58650},"msg":"incoming request"}
[api] [ChatWorker] Sanitizing orphaned tool_calls from message 3 (missing 1 tool results)
[api] [ChatWorker] Sanitizing orphaned tool_calls from message 5 (missing 1 tool results)
[api] [2026-02-05T14:34:21.576Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:34:21.576Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:34:21.576Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: Proceed...
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:34:22.515Z] [INFO] [SYS-1001] No open positions to monitor
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:58968 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-05T14:34:23.236Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:34:23.237Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml9k4w2a000h6jmx8jko9r3o
[api] [2026-02-05T14:34:23.238Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":137,"tokenCount":6,"hasNativeBalance":true}
[api] [ChatWorker] Base filtered to 46 tools for message: "Proceed..."
[api] [ChatWorker] 🔍 RAG check for: "Proceed..."
[api] [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml9k505u000j6jmx1v8orpkr
[api] [2026-02-05T14:34:23.238Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:34:23.241Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:34:23.248Z] [INFO] [AI-6001][7ms] Timer finished: intent_parsing_a08c27d5 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"general_query","highLevelIntent":"GENERAL_CHAT","hasAI":false,"confidence":0.7,"routingStage":"hybrid","slotsComplete":false,"labels":[{"label":"GENERAL_CHAT","confidence":0.7},{"label":"TRADING","confidence":0.2},{"label":"MARKET_ANALYSIS","confidence":0.2}],"timerLabel":"intent_parsing_a08c27d5"}
[api] [2026-02-05T14:34:23.253Z] [INFO] [AI-6001] Intent follow-up recorded | DATA: {"previousIntent":"TRADING","nextIntent":"GENERAL_CHAT","sessionId":"cml9k291m009jcc0hj9gog7hp"}
[api] [2026-02-05T14:34:23.254Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:34:23.254Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml9k505u000j6jmx1v8orpkr","sessionId":"cml9k291m009jcc0hj9gog7hp","model":"deepseek-chat","intent":"GENERAL_CHAT","routingMode":"thinking","confidence":0.7}
[api] [ChatWorker] Skill-gated to 26 tools for intent=GENERAL_CHAT skills=polymarket_prediction, token_analysis, wallet_portfolio, welcome_onboarding
[api] [2026-02-05T14:34:23.254Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml9k505u000j6jmx1v8orpkr","sessionId":"cml9k291m009jcc0hj9gog7hp","model":"deepseek-chat","intent":"GENERAL_CHAT","routingMode":"thinking","skillVersion":"clean","skills":["polymarket_prediction","token_analysis","wallet_portfolio","welcome_onboarding"],"toolCount":26}
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: false,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
[api]     'userRole',
[api]     'defaultSwapAmount',
[api]     'defaultSwapUnit',
[api]     'checkTokenBeforeSwap',
[api]     'showQuoteBeforeSwap',
[api]     'swapMethod',
[api]     'slippageMode',
[api]     'customSlippage',
[api]     'mevProtection',
[api]     'priceDeviationCheck',
[Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] [2026-02-05T14:34:36.831Z] [INFO] [SYS-1001] Zora SDK initialized with API Key
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
[api] [SkillRegistry:clean] Loaded skill: copy_trade
[api] [SkillRegistry:clean] Loaded skill: cross_chain_swap
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
[api] [2026-02-05T14:34:37.338Z] [INFO] [SYS-1001] Build SHA | DATA: {"buildSha":"unknown"}
[api] [2026-02-05T14:34:37.338Z] [WARN] [SYS-1001] Public folder not found - skipping static file serving | DATA: {"path":"/Users/almurat/KiKo/kiko-api/public"}
[api] [2026-02-05T14:34:37.339Z] [INFO] [SYS-1001] Initializing services... | DATA: {"env":"development","port":3001,"database":"configured","privy":"✅ Configured"}
[api] [Prisma] DB connection is healthy
[api] [2026-02-05T14:34:37.378Z] [INFO] [SYS-1004] Database connection successful
[api] [DataRetention] Checking retention policies...
[api] [DataRetention] Starting cleanup job...
[api] [2026-02-05T14:34:37.384Z] [INFO] [SYS-1005] Redis initialized
[api] [2026-02-05T14:34:37.384Z] [INFO] [SYS-1001] Starting server on port 3001...
[api] {"level":30,"time":1770302077410,"pid":89494,"hostname":"almuratdeMacBook-Pro.local","msg":"Server listening at http://0.0.0.0:3001"}
[api] [2026-02-05T14:34:37.411Z] [INFO] [SYS-1001] Server listening | DATA: {"url":"http://localhost:3001","health":"http://localhost:3001/health"}
[api] [2026-02-05T14:34:37.411Z] [INFO] [SYS-1001] RPC health monitor started
[api] [2026-02-05T14:34:37.413Z] [INFO] [SYS-1001] RPC benchmark sampling started
[api] [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
[api] [TokenJob] Scheduled: Primary chains every 5min (Ethereum, Solana, Base, BSC)
[api] [TokenJob] Scheduled: Secondary chains every 4h (Arbitrum, Optimism, Polygon)
[api] [SocialJob] Scheduled: Discovery (30m), Refresh (4h), Scoring (5m)
[api] [2026-02-05T14:34:37.427Z] [INFO] [SYS-1001] Background jobs started
[api] [2026-02-05T14:34:37.427Z] [INFO] [SYS-1001] Initializing auto trade service...
[api] [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
[api] [2026-02-05T14:34:37.428Z] [INFO] [SYS-1001] Auto trade service initialized (Solana watcher + EVM webhook enabled) | DATA: {"mode":"hybrid"}
[api] [2026-02-05T14:34:37.428Z] [INFO] [SYS-1001] Auto trade service started
[api] [PositionMonitor] Starting position monitor (every 30s)...
[api] [2026-02-05T14:34:37.428Z] [INFO] [SYS-1001] Position monitor started
[api] [2026-02-05T14:34:37.428Z] [INFO] [SYS-1001] Token Alert Service started
[api] [2026-02-05T14:34:37.428Z] [INFO] [SYS-1001] Token alert service started
[api] [ChatWorker] Started polling for AI tasks (interval: 3000ms)
[api] [2026-02-05T14:34:37.428Z] [INFO] [SYS-1001] Chat worker started
[api] [2026-02-05T14:34:37.428Z] [INFO] [SYS-1001] Starting Global Zora Alpha Detector (API Polling) | DATA: {"thresholds":{"farcaster":50000,"twitter":500000,"instagram":500000,"tiktok":500000},"interval":60000}
[api] [2026-02-05T14:34:37.428Z] [INFO] [SYS-1001] 🎉 All services initialized!
[api] [DataRetention] Cleaned 1 records from TrendingCast
[api] [DataRetention] Cleanup job completed.
[api] {"level":30,"time":1770302078461,"pid":89494,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWt0Zm5oa3gwMGNka3kwYzN0M2xtMzZpIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzAzMDE5MzEsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc3MDMwNTUzMX0.Hd9AyHJYKhg3ksL7SR2p72FA5fLSwvNDuxIdGWhHEABEKfETpYIDGm1G22igZ2EjUBhFvSp273oY5A0KYSzNPA","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":59087},"msg":"incoming request"}
[api] [2026-02-05T14:34:39.516Z] [INFO] [WS-8001][TID:68b3ebc2-1e74-4d1e-845b-c47c62f5022a] ChatWS Client connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1}
[api] [2026-02-05T14:34:39.516Z] [INFO] [WS-8001][TID:68b3ebc2-1e74-4d1e-845b-c47c62f5022a] ChatWS: User connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl2...","tokenExp":1770305531}
[api] [MarketJob] Running startup staleness check...
[api] [PositionMonitor] 🔄 Running position check...
[api] [MarketJob] Overview is fresh, skipping API call
[api] [MarketJob] Protocols are fresh, skipping API call
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [Job] ✅ Loaded 436 real hot users from /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Job] ✅ Using 436 real hot users from analysis
[api] [SocialJob] fetchCastsFromUsers starting with 436 FIDs, target: 1000
[api] [2026-02-05T14:34:42.448Z] [INFO] [SYS-1001] No open positions to monitor

