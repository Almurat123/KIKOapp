[api] [TokenJob] Scheduled: Primary chains every 5min (Ethereum, Solana, Base, BSC)
[api] [TokenJob] Scheduled: Secondary chains every 4h (Arbitrum, Optimism, Polygon)
[api] [SocialJob] Scheduled: Discovery (30m), Refresh (4h), Scoring (5m)
[api] [2026-02-05T14:36:26.439Z] [INFO] [SYS-1001] Background jobs started
[api] [2026-02-05T14:36:26.439Z] [INFO] [SYS-1001] Initializing auto trade service...
[api] [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
[api] [2026-02-05T14:36:26.439Z] [INFO] [SYS-1001] Auto trade service initialized (Solana watcher + EVM webhook enabled) | DATA: {"mode":"hybrid"}
[api] [2026-02-05T14:36:26.439Z] [INFO] [SYS-1001] Auto trade service started
[api] [PositionMonitor] Starting position monitor (every 30s)...
[api] [2026-02-05T14:36:26.439Z] [INFO] [SYS-1001] Position monitor started
[api] [2026-02-05T14:36:26.439Z] [INFO] [SYS-1001] Token Alert Service started
[api] [2026-02-05T14:36:26.439Z] [INFO] [SYS-1001] Token alert service started
[api] [ChatWorker] Started polling for AI tasks (interval: 3000ms)
[api] [2026-02-05T14:36:26.439Z] [INFO] [SYS-1001] Chat worker started
[api] [2026-02-05T14:36:26.439Z] [INFO] [SYS-1001] Starting Global Zora Alpha Detector (API Polling) | DATA: {"thresholds":{"farcaster":50000,"twitter":500000,"instagram":500000,"tiktok":500000},"interval":60000}
[api] [2026-02-05T14:36:26.440Z] [INFO] [SYS-1001] 🎉 All services initialized!
[api] [DataRetention] Cleaned 1 records from TrendingCast
[api] [DataRetention] Cleanup job completed.
[api] {"level":30,"time":1770302187738,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWt0Zm5oa3gwMGNka3kwYzN0M2xtMzZpIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzAzMDE5MzEsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc3MDMwNTUzMX0.Hd9AyHJYKhg3ksL7SR2p72FA5fLSwvNDuxIdGWhHEABEKfETpYIDGm1G22igZ2EjUBhFvSp273oY5A0KYSzNPA","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60109},"msg":"incoming request"}
[api] [2026-02-05T14:36:28.812Z] [INFO] [WS-8001][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] ChatWS Client connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1}
[api] [2026-02-05T14:36:28.813Z] [INFO] [WS-8001][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] ChatWS: User connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl2...","tokenExp":1770305531}
[api] [MarketJob] Running startup staleness check...
[api] [PositionMonitor] 🔄 Running position check...
[api] [MarketJob] Overview is fresh, skipping API call
[api] [MarketJob] Protocols are fresh, skipping API call
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [2026-02-05T14:36:31.447Z] [INFO] [SYS-1001] No open positions to monitor
[api] [Job] ✅ Loaded 436 real hot users from /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Job] ✅ Using 436 real hot users from analysis
[api] [SocialJob] fetchCastsFromUsers starting with 436 FIDs, target: 1000
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:36:41.509Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770302209304,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60628},"msg":"incoming request"}
[api] {"level":30,"time":1770302209306,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","res":{"statusCode":204},"responseTime":2.041042000055313,"msg":"request completed"}
[api] {"level":30,"time":1770302209307,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","req":{"method":"OPTIONS","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60630},"msg":"incoming request"}
[api] {"level":30,"time":1770302209308,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","res":{"statusCode":204},"responseTime":0.3255000039935112,"msg":"request completed"}
[api] {"level":30,"time":1770302209309,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60631},"msg":"incoming request"}
[api] {"level":30,"time":1770302209309,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","res":{"statusCode":204},"responseTime":0.2692909985780716,"msg":"request completed"}
[api] {"level":30,"time":1770302209310,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWt0Zm5oa3gwMGNka3kwYzN0M2xtMzZpIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzAzMDE5MzEsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc3MDMwNTUzMX0.Hd9AyHJYKhg3ksL7SR2p72FA5fLSwvNDuxIdGWhHEABEKfETpYIDGm1G22igZ2EjUBhFvSp273oY5A0KYSzNPA","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60632},"msg":"incoming request"}
[api] {"level":30,"time":1770302209312,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60628},"msg":"incoming request"}
[api] [2026-02-05T14:36:49.319Z] [INFO] [WS-8001][TID:03e5bde7-1571-41f1-8a98-4b149bd24414] ChatWS Client connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1}
[api] [2026-02-05T14:36:49.319Z] [INFO] [WS-8001][TID:03e5bde7-1571-41f1-8a98-4b149bd24414] ChatWS: User connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl2...","tokenExp":1770305531}
[api] {"level":30,"time":1770302209319,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","req":{"method":"GET","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60630},"msg":"incoming request"}
[api] {"level":30,"time":1770302209331,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60631},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   userIdLength: 35,
[api]   userIdPrefix: 'did:privy:cmj0a3j3f0',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] {"level":30,"time":1770302209338,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","res":{"statusCode":200},"responseTime":17.996458001434803,"msg":"request completed"}
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1770302209342,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","res":{"statusCode":200},"responseTime":30.616209000349045,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:36:51.515Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770302215110,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","res":{"statusCode":200},"responseTime":5777.948374994099,"msg":"request completed"}
[api] {"level":30,"time":1770302215115,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60630},"msg":"incoming request"}
[api] {"level":30,"time":1770302215115,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","res":{"statusCode":204},"responseTime":0.7861250042915344,"msg":"request completed"}
[api] {"level":30,"time":1770302215117,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60628},"msg":"incoming request"}
[api] [TokenJob] Starting initial token refresh...
[api] [TokenJob] Tokens for Ethereum are fresh, skipping API call
[api] {"level":30,"time":1770302216760,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60631},"msg":"incoming request"}
[api] {"level":30,"time":1770302216761,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","res":{"statusCode":204},"responseTime":0.6828749999403954,"msg":"request completed"}
[api] {"level":30,"time":1770302216761,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","req":{"method":"OPTIONS","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60630},"msg":"incoming request"}
[api] {"level":30,"time":1770302216762,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","res":{"statusCode":204},"responseTime":0.6252079978585243,"msg":"request completed"}
[api] {"level":30,"time":1770302216764,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","req":{"method":"POST","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60630},"msg":"incoming request"}
[api] {"level":30,"time":1770302216769,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60631},"msg":"incoming request"}
[api] {"level":30,"time":1770302216773,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60671},"msg":"incoming request"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=what's my balance ?...
[api] {"level":30,"time":1770302216781,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","res":{"statusCode":200},"responseTime":17.6480830013752,"msg":"request completed"}
[api] {"level":30,"time":1770302216782,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","res":{"statusCode":200},"responseTime":13.244125001132488,"msg":"request completed"}
[api] {"level":30,"time":1770302216783,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60630},"msg":"incoming request"}
[api] {"level":30,"time":1770302216784,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","res":{"statusCode":204},"responseTime":0.284791998565197,"msg":"request completed"}
[api] {"level":30,"time":1770302216785,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","req":{"method":"GET","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60631},"msg":"incoming request"}
[api] {"level":30,"time":1770302216793,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","res":{"statusCode":200},"responseTime":8.063375003635883,"msg":"request completed"}
[api] {"level":30,"time":1770302216795,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60630},"msg":"incoming request"}
[api] {"level":30,"time":1770302216796,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","res":{"statusCode":204},"responseTime":0.41737499833106995,"msg":"request completed"}
[api] {"level":30,"time":1770302216797,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","req":{"method":"POST","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60631},"msg":"incoming request"}
[api] {"level":30,"time":1770302217508,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","res":{"statusCode":200},"responseTime":2390.4286250025034,"msg":"request completed"}
[api] {"level":30,"time":1770302219087,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","res":{"statusCode":200},"responseTime":2289.7892090007663,"msg":"request completed"}
[api] {"level":30,"time":1770302219090,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60630},"msg":"incoming request"}
[api] {"level":30,"time":1770302219091,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","res":{"statusCode":204},"responseTime":0.7660830020904541,"msg":"request completed"}
[api] {"level":30,"time":1770302219093,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60628},"msg":"incoming request"}
[api] {"level":30,"time":1770302219097,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60631},"msg":"incoming request"}
[api] {"level":30,"time":1770302219103,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","res":{"statusCode":200},"responseTime":9.203249998390675,"msg":"request completed"}
[api] [2026-02-05T14:36:59.537Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:36:59.537Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:36:59.537Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: what's my balance ?...
[api] {"level":30,"time":1770302220931,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","res":{"statusCode":200},"responseTime":4157.6465409994125,"msg":"request completed"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:60697 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-05T14:37:00.950Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:37:00.955Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml9k8crv000810vdsoe7tc1e
[api] [2026-02-05T14:37:00.956Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":137,"tokenCount":7,"hasNativeBalance":true}
[api] [ChatWorker] Base filtered to 46 tools for message: "what's my balance ?..."
[api] [ChatWorker] 🔍 RAG check for: "what's my balance ?..."
[api] [ChatWorker] 🎯 RAG: Match found! Query looks informational.
[api] [2026-02-05T14:37:00.958Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] {"level":30,"time":1770302221225,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","res":{"statusCode":200},"responseTime":2127.225916005671,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:37:01.526Z] [INFO] [SYS-1001] No open positions to monitor
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/embeddings "HTTP/1.1 200 OK"
[python] ERROR:rag.router:Query failed: Collection expecting embedding with dimension of 384, got 1536
[python] INFO:     127.0.0.1:60712 - "POST /rag/query HTTP/1.1" 500 Internal Server Error
[api] [2026-02-05T14:37:02.585Z] [ERROR] [API-5002] api failed after 1 attempts | DATA: {"error":"HTTP 500: {\"detail\":\"Collection expecting embedding with dimension of 384, got 1536\"}","url":"http://localhost:8000/rag/query"}
[api] [2026-02-05T14:37:02.586Z] [WARN] [API-5002] RAGClient: Query failed (skipping RAG) | DATA: {"error":"HTTP 500: {\"detail\":\"Collection expecting embedding with dimension of 384, got 1536\"}"}
[api] [ChatWorker] ℹ️ RAG: No relevant knowledge found in local base.
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml9k8eh1000a10vdp6v1evr9
[api] [2026-02-05T14:37:02.586Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:37:02.588Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:37:02.591Z] [INFO] [AI-6001][3ms] Timer finished: intent_parsing_a50dd289 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"wallet_balance","highLevelIntent":"MARKET_ANALYSIS","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"MARKET_ANALYSIS","slotsComplete":false,"labels":[{"label":"MARKET_ANALYSIS","confidence":0.95},{"label":"PREDICTION_MARKETS","confidence":0.1414213562373095},{"label":"GENERAL_CHAT","confidence":0.1414213562373095}],"timerLabel":"intent_parsing_a50dd289"}
[api] [2026-02-05T14:37:02.596Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:37:02.596Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml9k8eh1000a10vdp6v1evr9","sessionId":"cml9k8cp1000110vdxdj9hcm4","model":"deepseek-chat","intent":"MARKET_ANALYSIS","routingMode":"thinking","hardRule":{"label":"MARKET_ANALYSIS","reason":"question intent"},"confidence":0.95}
[api] [ChatWorker] Skill-gated to 26 tools for intent=MARKET_ANALYSIS skills=polymarket_prediction, token_analysis, wallet_portfolio, welcome_onboarding
[api] [2026-02-05T14:37:02.596Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml9k8eh1000a10vdp6v1evr9","sessionId":"cml9k8cp1000110vdxdj9hcm4","model":"deepseek-chat","intent":"MARKET_ANALYSIS","routingMode":"thinking","skillVersion":"clean","skills":["polymarket_prediction","token_analysis","wallet_portfolio","welcome_onboarding"],"toolCount":26}
[api] [2026-02-05T14:37:02.596Z] [INFO] [AI-6007] ChatWorker: early pre-fetch used client context | DATA: {"tool":"get_wallet_info"}
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
[api] [2026-02-05T14:37:02.597Z] [INFO] [AI-6003] Timer finished: prompt_gen_MARKET_ANALYSIS_deepseek | DATA: {"model":"deepseek","intent":"MARKET_ANALYSIS","length":2676,"timerLabel":"prompt_gen_MARKET_ANALYSIS_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (7 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:37:02.597Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:37:02.598Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1236}
[api] [2026-02-05T14:37:02.598Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9k8crv000810vdsoe7tc1e. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:37:02.598Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:37:11.532Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:37:16.957Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[python] INFO:moderation.router:Moderating output: I can see your current wallet balance on Polygon (...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:60806 - "POST /moderation/output HTTP/1.1" 200 OK
[api] [2026-02-05T14:37:18.665Z] [INFO] [SYS-1007] Moderation Output check result | DATA: {"safe":true,"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] Broadcasting message_complete for cml9k8crv000810vdsoe7tc1e
[api] [2026-02-05T14:37:18.684Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] [2026-02-05T14:37:18.688Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:37:18.688Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] {"level":30,"time":1770302238692,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60630},"msg":"incoming request"}
[api] {"level":30,"time":1770302238693,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","res":{"statusCode":204},"responseTime":0.373417004942894,"msg":"request completed"}
[api] {"level":30,"time":1770302238693,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60628},"msg":"incoming request"}
[api] {"level":30,"time":1770302238693,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","res":{"statusCode":204},"responseTime":0.16245900094509125,"msg":"request completed"}
[api] {"level":30,"time":1770302238694,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","req":{"method":"GET","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60671},"msg":"incoming request"}
[api] {"level":30,"time":1770302238695,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","req":{"method":"GET","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60631},"msg":"incoming request"}
[api] {"level":30,"time":1770302238701,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","res":{"statusCode":200},"responseTime":5.495916999876499,"msg":"request completed"}
[api] {"level":30,"time":1770302238702,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","res":{"statusCode":200},"responseTime":7.692542001605034,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:37:21.538Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770302243895,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60630},"msg":"incoming request"}
[api] {"level":30,"time":1770302243897,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","res":{"statusCode":204},"responseTime":0.7326669991016388,"msg":"request completed"}
[api] {"level":30,"time":1770302243899,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60628},"msg":"incoming request"}
[api] {"level":30,"time":1770302243899,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","res":{"statusCode":204},"responseTime":0.25824999809265137,"msg":"request completed"}
[api] {"level":30,"time":1770302243900,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60631},"msg":"incoming request"}
[api] {"level":30,"time":1770302243900,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","res":{"statusCode":204},"responseTime":0.11616700142621994,"msg":"request completed"}
[api] {"level":30,"time":1770302243900,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-u","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60671},"msg":"incoming request"}
[api] {"level":30,"time":1770302243901,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-v","req":{"method":"POST","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60630},"msg":"incoming request"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=What about USDC ?...
[api] {"level":30,"time":1770302243903,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60628},"msg":"incoming request"}
[api] {"level":30,"time":1770302243911,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-u","res":{"statusCode":200},"responseTime":11.089458003640175,"msg":"request completed"}
[api] [2026-02-05T14:37:26.427Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [TokenJob] Tokens for Solana are fresh, skipping API call
[api] {"level":30,"time":1770302249772,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","res":{"statusCode":200},"responseTime":5868.661749996245,"msg":"request completed"}
[api] {"level":30,"time":1770302249777,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-x","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60631},"msg":"incoming request"}
[api] {"level":30,"time":1770302249778,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-x","res":{"statusCode":204},"responseTime":0.24683299660682678,"msg":"request completed"}
[api] {"level":30,"time":1770302249780,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60671},"msg":"incoming request"}
[api] {"level":30,"time":1770302249783,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-v","res":{"statusCode":200},"responseTime":5881.307707995176,"msg":"request completed"}
[api] {"level":30,"time":1770302249788,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-z","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60628},"msg":"incoming request"}
[api] {"level":30,"time":1770302249789,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-z","res":{"statusCode":204},"responseTime":0.4622499942779541,"msg":"request completed"}
[api] {"level":30,"time":1770302249792,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-10","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60631},"msg":"incoming request"}
[api] {"level":30,"time":1770302249796,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-10","res":{"statusCode":200},"responseTime":4.391457997262478,"msg":"request completed"}
[api] {"level":30,"time":1770302249807,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-11","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60630},"msg":"incoming request"}
[api] [2026-02-05T14:37:30.442Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"kkur","creator":"0xeaffe20795097a0bb12496a9f66262c786af81dd"}
[api] [2026-02-05T14:37:31.271Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"akdt","creator":"0x90ad0fb1de14300227860bec1d2026c5892b8fa4"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:37:31.543Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:37:32.038Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"chordvex","creator":"0x1c08e6a9bf28b5e2793d34a3d6381b3c8617e451"}
[api] {"level":30,"time":1770302252201,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-11","res":{"statusCode":200},"responseTime":2393.4359590038657,"msg":"request completed"}
[api] {"level":30,"time":1770302252204,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","res":{"statusCode":200},"responseTime":2423.7498749941587,"msg":"request completed"}
[api] {"level":30,"time":1770302252205,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-12","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60628},"msg":"incoming request"}
[api] [2026-02-05T14:37:32.571Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:37:32.571Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:37:32.571Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: What about USDC ?...
[api] [2026-02-05T14:37:32.818Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"captainamerika","creator":"0x85562db4d3131b964bb5661b18faab8c6739b563"}
[api] [2026-02-05T14:37:33.389Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"xunjp","creator":"0xde0103e3f67523ddf3e4d45c4a26a9f6679acaaa"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:60973 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-05T14:37:33.629Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:37:33.629Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml9k8xn6000j10vdhlpu0xsu
[api] [2026-02-05T14:37:33.629Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":137,"tokenCount":3,"hasNativeBalance":true}
[api] [ChatWorker] Base filtered to 46 tools for message: "What about USDC ?..."
[api] [ChatWorker] 🔍 RAG check for: "What about USDC ?..."
[api] [ChatWorker] 🎯 RAG: Match found! Query looks informational.
[api] [2026-02-05T14:37:33.630Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] {"level":30,"time":1770302253764,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-12","res":{"statusCode":200},"responseTime":1559.701834000647,"msg":"request completed"}
[api] [2026-02-05T14:37:34.042Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"tajoi","creator":"0x2204c32dfa91a3e9a2a44f45e1eaebf8b89b590e"}
[api] [2026-02-05T14:37:34.786Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"rglbh","creator":"0xaf39df4da7837491a066dd7249b8891ebb891eb0"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/embeddings "HTTP/1.1 200 OK"
[python] ERROR:rag.router:Query failed: Collection expecting embedding with dimension of 384, got 1536
[python] INFO:     127.0.0.1:60978 - "POST /rag/query HTTP/1.1" 500 Internal Server Error
[api] [2026-02-05T14:37:34.926Z] [ERROR] [API-5002] api failed after 1 attempts | DATA: {"error":"HTTP 500: {\"detail\":\"Collection expecting embedding with dimension of 384, got 1536\"}","url":"http://localhost:8000/rag/query"}
[api] [2026-02-05T14:37:34.926Z] [WARN] [API-5002] RAGClient: Query failed (skipping RAG) | DATA: {"error":"HTTP 500: {\"detail\":\"Collection expecting embedding with dimension of 384, got 1536\"}"}
[api] [ChatWorker] ℹ️ RAG: No relevant knowledge found in local base.
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml9k925t000l10vd42gdghyb
[api] [2026-02-05T14:37:34.927Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:37:34.929Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:37:34.932Z] [INFO] [AI-6001][3ms] Timer finished: intent_parsing_4f56ca23 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"token_info","highLevelIntent":"MARKET_ANALYSIS","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"MARKET_ANALYSIS","slotsComplete":false,"labels":[{"label":"MARKET_ANALYSIS","confidence":0.95},{"label":"SOCIAL_SENSING","confidence":0.23094010767585035},{"label":"RISK_SCAN","confidence":0.1632993161855452}],"timerLabel":"intent_parsing_4f56ca23"}
[api] [2026-02-05T14:37:34.937Z] [INFO] [AI-6001] Intent follow-up recorded | DATA: {"previousIntent":"MARKET_ANALYSIS","nextIntent":"MARKET_ANALYSIS","sessionId":"cml9k8cp1000110vdxdj9hcm4"}
[api] [2026-02-05T14:37:34.937Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:37:34.937Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml9k925t000l10vd42gdghyb","sessionId":"cml9k8cp1000110vdxdj9hcm4","model":"deepseek-chat","intent":"MARKET_ANALYSIS","routingMode":"thinking","hardRule":{"label":"MARKET_ANALYSIS","reason":"question intent"},"confidence":0.95}
[api] [ChatWorker] Skill-gated to 26 tools for intent=MARKET_ANALYSIS skills=polymarket_prediction, token_analysis, wallet_portfolio, welcome_onboarding
[api] [2026-02-05T14:37:34.937Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml9k925t000l10vd42gdghyb","sessionId":"cml9k8cp1000110vdxdj9hcm4","model":"deepseek-chat","intent":"MARKET_ANALYSIS","routingMode":"thinking","skillVersion":"clean","skills":["polymarket_prediction","token_analysis","wallet_portfolio","welcome_onboarding"],"toolCount":26}
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
[api] [2026-02-05T14:37:34.942Z] [INFO] [AI-6003] Timer finished: prompt_gen_MARKET_ANALYSIS_deepseek | DATA: {"model":"deepseek","intent":"MARKET_ANALYSIS","length":2676,"timerLabel":"prompt_gen_MARKET_ANALYSIS_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (3 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:37:34.943Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:37:34.944Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1034}
[api] [2026-02-05T14:37:34.945Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9k8xn6000j10vdhlpu0xsu. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:37:34.945Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-02-05T14:37:41.388Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T14:37:41.393Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9k8cp1000110vdxdj9hcm4","messageId":"cml9k8xn6000j10vdhlpu0xsu","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T14:37:41.394Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"get_token_price","sessionId":"cml9k8cp1000110vdxdj9hcm4","messageId":"cml9k8xn6000j10vdhlpu0xsu","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:37:41.394Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [GetTokenPrice] Fetching price for USDC (isAddress: false)...
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:37:41.549Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:37:42.413Z] [INFO] [AI-6007][1018ms] ChatWorker: tool success | DATA: {"tool":"get_token_price","sessionId":"cml9k8cp1000110vdxdj9hcm4","messageId":"cml9k8xn6000j10vdhlpu0xsu","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] DeepSeek iteration 2/10 for task cml9k925t000l10vd42gdghyb
[api] [2026-02-05T14:37:42.417Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:37:42.419Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:37:42.420Z] [INFO] [AI-6001][1ms] Timer finished: intent_parsing_136fffd1 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"token_info","highLevelIntent":"MARKET_ANALYSIS","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"MARKET_ANALYSIS","slotsComplete":false,"labels":[{"label":"MARKET_ANALYSIS","confidence":0.95},{"label":"SOCIAL_SENSING","confidence":0.23094010767585035},{"label":"RISK_SCAN","confidence":0.1632993161855452}],"timerLabel":"intent_parsing_136fffd1"}
[api] [2026-02-05T14:37:42.421Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
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
[api] [2026-02-05T14:37:42.422Z] [INFO] [AI-6003] Timer finished: prompt_gen_MARKET_ANALYSIS_deepseek | DATA: {"model":"deepseek","intent":"MARKET_ANALYSIS","length":2676,"timerLabel":"prompt_gen_MARKET_ANALYSIS_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (3 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:37:42.422Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:37:42.423Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1034}
[api] [2026-02-05T14:37:42.423Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9k8xn6000j10vdhlpu0xsu. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:37:42.423Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:37:51.554Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:37:52.767Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[python] INFO:moderation.router:Moderating output: Looking at your wallet data, I can see you have **...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:61145 - "POST /moderation/output HTTP/1.1" 200 OK
[api] [2026-02-05T14:37:53.858Z] [INFO] [SYS-1007] Moderation Output check result | DATA: {"safe":true,"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] Broadcasting message_complete for cml9k8xn6000j10vdhlpu0xsu
[api] [2026-02-05T14:37:53.873Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] [2026-02-05T14:37:53.877Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:37:53.877Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] {"level":30,"time":1770302273885,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-13","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60631},"msg":"incoming request"}
[api] {"level":30,"time":1770302273886,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-13","res":{"statusCode":204},"responseTime":0.49254199862480164,"msg":"request completed"}
[api] {"level":30,"time":1770302273886,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-14","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60630},"msg":"incoming request"}
[api] {"level":30,"time":1770302273886,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-14","res":{"statusCode":204},"responseTime":0.15995799750089645,"msg":"request completed"}
[api] {"level":30,"time":1770302273888,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-15","req":{"method":"GET","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60671},"msg":"incoming request"}
[api] {"level":30,"time":1770302273892,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-16","req":{"method":"GET","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60628},"msg":"incoming request"}
[api] {"level":30,"time":1770302273898,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-15","res":{"statusCode":200},"responseTime":9.348833002150059,"msg":"request completed"}
[api] {"level":30,"time":1770302273901,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-16","res":{"statusCode":200},"responseTime":9.170209005475044,"msg":"request completed"}
[api] [DBLock] Lock already held (valid) {
[api]   key: 'lock:tokenJob:refresh:base',
[api]   expiresAt: '2026-02-05T14:40:19.805Z',
[api]   ageMs: 96673
[api] }
[api] [TokenJob] Skipping refresh for Base - another instance holds the lock
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:38:01.566Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:38:11.573Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770302293132,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-17","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60631},"msg":"incoming request"}
[api] {"level":30,"time":1770302293134,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-17","res":{"statusCode":204},"responseTime":0.7378339990973473,"msg":"request completed"}
[api] {"level":30,"time":1770302293134,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-18","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60630},"msg":"incoming request"}
[api] {"level":30,"time":1770302293134,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-18","res":{"statusCode":204},"responseTime":0.1275000050663948,"msg":"request completed"}
[api] {"level":30,"time":1770302293134,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-19","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60671},"msg":"incoming request"}
[api] {"level":30,"time":1770302293136,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-19","res":{"statusCode":204},"responseTime":0.3258330002427101,"msg":"request completed"}
[api] {"level":30,"time":1770302293136,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1a","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60628},"msg":"incoming request"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=swap 3 usdc to matic...
[api] {"level":30,"time":1770302293139,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1b","req":{"method":"POST","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60631},"msg":"incoming request"}
[api] {"level":30,"time":1770302293140,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1c","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60630},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   userIdLength: 35,
[api]   userIdPrefix: 'did:privy:cmj0a3j3f0',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] {"level":30,"time":1770302293154,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1a","res":{"statusCode":200},"responseTime":17.752167001366615,"msg":"request completed"}
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1770302298698,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1b","res":{"statusCode":200},"responseTime":5559.716208003461,"msg":"request completed"}
[api] {"level":30,"time":1770302298705,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1c","res":{"statusCode":200},"responseTime":5564.909708999097,"msg":"request completed"}
[api] {"level":30,"time":1770302298708,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1d","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60671},"msg":"incoming request"}
[api] {"level":30,"time":1770302298709,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1d","res":{"statusCode":204},"responseTime":0.38329100608825684,"msg":"request completed"}
[api] {"level":30,"time":1770302298712,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1e","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60628},"msg":"incoming request"}
[api] {"level":30,"time":1770302298717,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1e","res":{"statusCode":200},"responseTime":5.133417002856731,"msg":"request completed"}
[api] {"level":30,"time":1770302298729,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1f","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60631},"msg":"incoming request"}
[api] {"level":30,"time":1770302298730,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1f","res":{"statusCode":204},"responseTime":0.5392079949378967,"msg":"request completed"}
[api] {"level":30,"time":1770302298732,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1g","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60630},"msg":"incoming request"}
[api] {"level":30,"time":1770302298741,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1h","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":60671},"msg":"incoming request"}
[api] [ChatWorker] Sanitizing orphaned tool_calls from message 3 (missing 1 tool results)
[api] [2026-02-05T14:38:20.628Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:38:20.628Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:38:20.628Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: swap 3 usdc to matic...
[api] {"level":30,"time":1770302300990,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1g","res":{"statusCode":200},"responseTime":2257.456458002329,"msg":"request completed"}
[api] {"level":30,"time":1770302300992,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1h","res":{"statusCode":200},"responseTime":2250.430291995406,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:38:21.582Z] [INFO] [SYS-1001] No open positions to monitor
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:61427 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-05T14:38:21.742Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:38:21.743Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml9k9zn9000u10vdm0lz94nh
[api] [2026-02-05T14:38:21.743Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":137,"tokenCount":5,"hasNativeBalance":true}
[api] [ChatWorker] Base filtered to 46 tools for message: "swap 3 usdc to matic..."
[api] [ChatWorker] 🔍 RAG check for: "swap 3 usdc to matic..."
[api] [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml9ka3wk000w10vdlqi3esvt
[api] [2026-02-05T14:38:21.743Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:38:21.746Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:38:21.750Z] [INFO] [AI-6001][4ms] Timer finished: intent_parsing_16d2d8b5 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.44999999999999996},{"label":"PREDICTION_MARKETS","confidence":0.1414213562373095}],"timerLabel":"intent_parsing_16d2d8b5"}
[api] [2026-02-05T14:38:21.755Z] [INFO] [AI-6001] Intent follow-up recorded | DATA: {"previousIntent":"MARKET_ANALYSIS","nextIntent":"TRADING","sessionId":"cml9k8cp1000110vdxdj9hcm4"}
[api] [2026-02-05T14:38:21.755Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:38:21.755Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml9ka3wk000w10vdlqi3esvt","sessionId":"cml9k8cp1000110vdxdj9hcm4","model":"deepseek-chat","intent":"TRADING","routingMode":"execution","hardRule":{"label":"TRADING","reason":"action + slots complete"},"confidence":0.95}
[api] [ChatWorker] Skill-gated to 13 tools for intent=TRADING skills=cross_chain_swap, swap, token_alert, wallet_portfolio
[api] [2026-02-05T14:38:21.756Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml9ka3wk000w10vdlqi3esvt","sessionId":"cml9k8cp1000110vdxdj9hcm4","model":"deepseek-chat","intent":"TRADING","routingMode":"execution","skillVersion":"exec","skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"],"toolCount":13}
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
[api] [2026-02-05T14:38:21.757Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":4,"skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"]}
[api] [2026-02-05T14:38:21.757Z] [INFO] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":13368,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (5 tokens cached)
[api] [2026-02-05T14:38:21.757Z] [INFO] [AI-6007] ChatWorker: requested token balance resolved | DATA: {"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":137,"requested":["USDC","MATIC"],"matched":["USDC","MATIC"],"missing":[],"resolvedBalances":{"USDC":"5.926982","MATIC":"20.6044348920309"}}
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:38:21.758Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:38:21.758Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1144}
[api] [2026-02-05T14:38:21.758Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-02-05T14:38:21.758Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":185}
[api] [2026-02-05T14:38:21.758Z] [INFO] [AI-6007] ChatWorker: balance system rule injected
[api] [ChatWorker] Broadcasting Thinking status for cml9k9zn9000u10vdm0lz94nh. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:38:21.758Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:38:26.428Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
[api] [2026-02-05T14:38:26.492Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"bsc","limit":100}
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-02-05T14:38:28.046Z] [INFO] [WTC-2002] WS addresses discovered | DATA: {"wsCount":193,"chain":"bsc"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:38:31.587Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:38:33.622Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T14:38:33.628Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9k8cp1000110vdxdj9hcm4","messageId":"cml9k9zn9000u10vdm0lz94nh","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T14:38:33.628Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"simulate_swap","sessionId":"cml9k8cp1000110vdxdj9hcm4","messageId":"cml9k9zn9000u10vdm0lz94nh","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:38:33.629Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] {"level":30,"time":1770302313635,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1i","req":{"method":"POST","url":"/api/swap/quote","hostname":"127.0.0.1:3001","remoteAddress":"127.0.0.1","remotePort":61536},"msg":"incoming request"}
[api] [Swap Quote] Fetching metadata for: {
[api]   tokenInForMetadata: '0x3c499c542c',
[api]   tokenOutForMetadata: '0x0d500B1d8E',
[api]   actualTokenIn: '0x3c499c542c',
[api]   actualTokenOut: '0xEeeeeEeeeE',
[api]   isTokenOutNative: true
[api] }
[api] [2026-02-05T14:38:35.295Z] [INFO] [API-5001][TID:54e27e53-30fa-4d8b-8580-9bd51a57b38d] Using 0x API fallback token metadata | DATA: {"symbol":"WMATIC","chainId":137}
[api] [2026-02-05T14:38:35.305Z] [INFO] [API-5001][TID:54e27e53-30fa-4d8b-8580-9bd51a57b38d] No token metadata available, trying RPC fallback... | DATA: {"tokenAddress":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","chainId":137}
[api] [Swap Quote] Overriding tokenIn decimals to known value: 6
[api] [Swap Quote] Token decimals: {
[api]   tokenIn: '0x3c499c54',
[api]   tokenOut: '0xEeeeeEee',
[api]   tokenInDecimals: 6,
[api]   tokenOutDecimals: 18,
[api]   tokenOutMetadataDecimals: 18
[api] }
[api] [2026-02-05T14:38:36.688Z] [INFO] [API-5001][TID:54e27e53-30fa-4d8b-8580-9bd51a57b38d] Using 0x API fallback token metadata | DATA: {"symbol":"USDC","chainId":137}
[api] [2026-02-05T14:38:37.045Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":33,"limit":200}
[api] [2026-02-05T14:38:37.223Z] [INFO] [API-5001][TID:54e27e53-30fa-4d8b-8580-9bd51a57b38d] 0x API price received successfully | DATA: {"sellToken":"0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270","buyToken":"0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174","chainId":137,"liquidityAvailable":true}
[api] [PlatformFee] Fees DISABLED, returning 0 bps
[api] [Kyber] GET routes {
[api]   routesUrl: 'https://aggregator-api.kyberswap.com/polygon/api/v1/routes?tokenIn=0x3c499c542cef5e3811e1192ce70d8cc03d5c3359&tokenOut=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&amountIn=3000000&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] [2026-02-05T14:38:37.772Z] [INFO] [API-5001][TID:54e27e53-30fa-4d8b-8580-9bd51a57b38d] 0x API Quote received successfully | DATA: {"sellToken":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","buyToken":"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE","buyAmount":"28873295640165806523","usedEndpoint":"allowance-holder"}
[api] [2026-02-05T14:38:37.773Z] [INFO] [API-5001][TID:54e27e53-30fa-4d8b-8580-9bd51a57b38d] 0x API Quote successful | DATA: {"sellToken":"0x3c499c542c","buyToken":"0xEeeeeEeeeE","buyAmount":"28873295640165806523","hasAllowanceIssue":true,"usedEndpoint":"allowance-holder"}
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 3,
[api]   amountOut: 28.873295640165807,
[api]   quotePrice: 9.624431880055269,
[api]   refPrice: 9.671179883945841,
[api]   tokenInUsd: 'available',
[api]   impact: -0.4833743602285178,
[api]   formula: '((9.624431880055269 - 9.671179883945841) / 9.671179883945841) * 100 = -0.4833743602285178'
[api] }
[api] [QuoteService] 0x API estimatedPriceImpact: {
[api]   raw: undefined,
[api]   parsed: 0,
[api]   multipliedBy100: 0,
[api]   impactVsMkt: -0.4833743602285178,
[api]   willUse: -0.4833743602285178
[api] }
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
[api]   deadline: 1770302919,
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
[api]   amountOut: 29.007444510978928,
[api]   quotePrice: 9.66914817032631,
[api]   refPrice: 9.671179883945841,
[api]   tokenInUsd: 'available',
[api]   impact: -0.02100791882596116,
[api]   formula: '((9.66914817032631 - 9.671179883945841) / 9.671179883945841) * 100 = -0.02100791882596116'
[api] }
[api] [QuoteService] Quote comparison: {
[api]   '0x_amount': '28.873295640165806523',
[api]   kyber_amount: '29.00744451097892864',
[api]   kyber_advantage_pct: '0.00',
[api]   chainId: 137
[api] }
[api] [QuoteService] Preferring 0x for reliability { reason: 'prices within 2%', percentDiff: '0.00' }
[api] {"level":30,"time":1770302319819,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1i","res":{"statusCode":200},"responseTime":6183.172958001494,"msg":"request completed"}
[api] [2026-02-05T14:38:39.821Z] [INFO] [AI-6007][6193ms] ChatWorker: tool success | DATA: {"tool":"simulate_swap","sessionId":"cml9k8cp1000110vdxdj9hcm4","messageId":"cml9k9zn9000u10vdm0lz94nh","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] DeepSeek iteration 2/10 for task cml9ka3wk000w10vdlqi3esvt
[api] [2026-02-05T14:38:39.826Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:38:39.828Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:38:39.831Z] [INFO] [AI-6001][2ms] Timer finished: intent_parsing_a62b498e | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.44999999999999996},{"label":"PREDICTION_MARKETS","confidence":0.1414213562373095}],"timerLabel":"intent_parsing_a62b498e"}
[api] [2026-02-05T14:38:39.831Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
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
[api] [2026-02-05T14:38:39.832Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":4,"skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"]}
[api] [2026-02-05T14:38:39.833Z] [INFO] [AI-6003][1ms] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":13368,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (5 tokens cached)
[api] [2026-02-05T14:38:39.833Z] [INFO] [AI-6007] ChatWorker: requested token balance resolved | DATA: {"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":137,"requested":["USDC","MATIC"],"matched":["USDC","MATIC"],"missing":[],"resolvedBalances":{"USDC":"5.926982","MATIC":"20.6044348920309"}}
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:38:39.833Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:38:39.833Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1144}
[api] [2026-02-05T14:38:39.833Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-02-05T14:38:39.833Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":185}
[api] [2026-02-05T14:38:39.833Z] [INFO] [AI-6007] ChatWorker: balance system rule injected
[api] [ChatWorker] Broadcasting Thinking status for cml9k9zn9000u10vdm0lz94nh. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:38:39.834Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:38:40.065Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"itui","creator":"0x4f18d4dbb6c6e9082ad8780125b448aac2f08eb6"}
[api] [2026-02-05T14:38:40.689Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"oudn","creator":"0x9afc4cc0d9a68e9d8ba0d84dfb249e4c3e1c343c"}
[api] [2026-02-05T14:38:41.064Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"dusk_fbf1","creator":"0x97db5a8f2c0feb571085f0fba61c69c007f8ea9b"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:38:41.595Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:38:43.093Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:38:44.367Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:38:44.590Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"txdmc","creator":"0x0c8e45e7664bb479cb3dca2a6144562c41e4af53"}
[api] [2026-02-05T14:38:45.080Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"pxixd","creator":"0xf032d287080d0e27c8958766e6679525e03394c1"}
[api] [2026-02-05T14:38:45.555Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"laywl","creator":"0x3079b2a0f73f1d35083b7d38acb211bd6fc689ba"}
[api] [2026-02-05T14:38:46.157Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[python] INFO:moderation.router:Moderating output: I'll help you swap 3 USDC to MATIC on Polygon. Let...
[api] [2026-02-05T14:38:46.190Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"gudi","creator":"0x7d3129678a2bbb6781229ce755c248c84b9c7474"}
[api] [2026-02-05T14:38:46.607Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:38:46.649Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"bhkol","creator":"0x519e078f28bbfcde942ed5cbf4dd28c86fa6909a"}
[api] [2026-02-05T14:38:47.114Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"tkotm","creator":"0xba7f6cbf02d7eddb9ad669128fa8a15ba22c9d77"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:61783 - "POST /moderation/output HTTP/1.1" 200 OK
[api] [2026-02-05T14:38:47.279Z] [INFO] [SYS-1007] Moderation Output check result | DATA: {"safe":true,"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] Broadcasting message_complete for cml9k9zn9000u10vdm0lz94nh
[api] [2026-02-05T14:38:47.287Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] [2026-02-05T14:38:47.289Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:38:47.289Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] {"level":30,"time":1770302330483,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1j","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":61875},"msg":"incoming request"}
[api] {"level":30,"time":1770302330484,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1j","res":{"statusCode":204},"responseTime":0.2366669997572899,"msg":"request completed"}
[api] {"level":30,"time":1770302330484,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1k","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":61876},"msg":"incoming request"}
[api] {"level":30,"time":1770302330484,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1k","res":{"statusCode":204},"responseTime":0.21404200047254562,"msg":"request completed"}
[api] {"level":30,"time":1770302330485,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1l","req":{"method":"GET","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":61875},"msg":"incoming request"}
[api] {"level":30,"time":1770302330486,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1m","req":{"method":"GET","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":61876},"msg":"incoming request"}
[api] {"level":30,"time":1770302330496,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1m","res":{"statusCode":200},"responseTime":9.377582997083664,"msg":"request completed"}
[api] {"level":30,"time":1770302330497,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1l","res":{"statusCode":200},"responseTime":12.049625001847744,"msg":"request completed"}
[api] [2026-02-05T14:38:51.572Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:38:51.573Z] [ERROR] [API-5002] GeckoTerminal API error after retries | DATA: {"endpoint":"/networks/bsc/trending_pools?page=6&include=base_token&duration=5m","error":"Rate limit hit, backing off for 60000ms"}
[api] [2026-02-05T14:38:51.573Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"bsc","error":"Rate limit hit, backing off for 60000ms"}
[api] [2026-02-05T14:38:51.573Z] [INFO] [API-5001][25081ms] Premium trending tokens fetch complete | DATA: {"count":74,"chain":"bsc","source":"WebSocket","wsOriginal":193}
[api] [TokenJob] Got 74 trending tokens for BSC
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:38:51.604Z] [INFO] [SYS-1001] No open positions to monitor
[api] Saved 74 trending tokens for bsc to database and memory cache
[api] [TokenJob] Saved 74 tokens for BSC to DB + cache
[api] [TokenJob] Refreshed 4 primary chains in 115.2s
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:39:01.609Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:39:11.615Z] [INFO] [SYS-1001] No open positions to monitor
[api] [SocialJob] Checking Zora coin status for 42 casts...
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:39:21.624Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:39:26.430Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:39:31.631Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:39:41.638Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770302387994,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1n","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62335},"msg":"incoming request"}
[api] {"level":30,"time":1770302387995,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1n","res":{"statusCode":204},"responseTime":0.5827500000596046,"msg":"request completed"}
[api] {"level":30,"time":1770302387995,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1o","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62336},"msg":"incoming request"}
[api] {"level":30,"time":1770302387996,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1o","res":{"statusCode":204},"responseTime":0.14645899832248688,"msg":"request completed"}
[api] {"level":30,"time":1770302387996,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1p","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62337},"msg":"incoming request"}
[api] {"level":30,"time":1770302387996,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1p","res":{"statusCode":204},"responseTime":0.08708400279283524,"msg":"request completed"}
[api] {"level":30,"time":1770302387997,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1q","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62335},"msg":"incoming request"}
[api] {"level":30,"time":1770302388000,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1r","req":{"method":"POST","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62336},"msg":"incoming request"}
[api] {"level":30,"time":1770302388001,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1s","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62337},"msg":"incoming request"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=proceed...
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   userIdLength: 35,
[api]   userIdPrefix: 'did:privy:cmj0a3j3f0',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] {"level":30,"time":1770302388004,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1q","res":{"statusCode":200},"responseTime":7.052583999931812,"msg":"request completed"}
[api] [verifyAccess] ✅ Access granted
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:39:51.647Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:39:52.995Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"yznch","creator":"0x2ed9df683579cced3c199d6f6dc128ee684e3121"}
[api] [2026-02-05T14:39:58.163Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"rdmgq","creator":"0x02b67479cf5f0fedf1f79d04faec3905b0b2cdee"}
[api] [2026-02-05T14:39:58.594Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"qriez","creator":"0xe968a12db4d74f362ea26117f86c6ea6c94b353f"}
[api] [2026-02-05T14:39:58.988Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"vfcao","creator":"0xaeb88438fd67d8b162dec15511aa39382600f5f6"}
[api] [2026-02-05T14:39:59.548Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"ylvoj","creator":"0x55f5e96ea9a2291d8f876b389df542407b404713"}
[api] [2026-02-05T14:40:00.227Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"fgykk","creator":"0x2370bf1c4556143a5b9fd038583e085bf7ab87d7"}
[api] [2026-02-05T14:40:00.630Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"xrjzf","creator":"0x7f85062eaba8dad63900385af4ca2e9a6ccab126"}
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
[api] [2026-02-05T14:40:00.761Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"ethereum","limit":100}
[api] [2026-02-05T14:40:00.793Z] [INFO] [SYS-1007] SocialRepo: Recalculated heat scores for 920 casts
[api] [2026-02-05T14:40:00.794Z] [INFO] [SYS-1007][52ms] Timer finished: recalc_heat_scores | DATA: {"count":920,"timerLabel":"recalc_heat_scores"}
[api] [2026-02-05T14:40:01.139Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"ouwsf","creator":"0x1159ebb63fbebacb8301d0069a7080b2495c0f28"}
[api] [2026-02-05T14:40:01.500Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"bwps","creator":"0xdacfebe69faeefe485e341c2def7e25b2d0116f2"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:40:01.681Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:40:01.712Z] [INFO] [SOC-7001][392ms] Timer finished: get_trending_casts_trending | DATA: {"timeRange":"trending","limit":500,"offset":0,"count":500,"fromCache":false,"timerLabel":"get_trending_casts_trending"}
[api] [2026-02-05T14:40:01.760Z] [INFO] [SOC-7003] SocialRepo: Updated cache with 500 merged casts
[api] [2026-02-05T14:40:01.760Z] [INFO] [SOC-7003] SocialRepo: Saved 42 trending casts to database
[api] [2026-02-05T14:40:01.760Z] [INFO] [SOC-7003][655ms] Timer finished: save_trending_casts | DATA: {"count":42,"timerLabel":"save_trending_casts"}
[api] [SocialJob] Casts refreshed: 42 saved
[api] [SocialJob] 🚀 Triggering OGP Prefetch for top 42 casts...
[api] [2026-02-05T14:40:01.891Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"qpxbt","creator":"0xec2604924b93680d129c943afcb151ef37a4f30b"}
[api] [2026-02-05T14:40:02.334Z] [INFO] [WTC-2002] WS addresses discovered | DATA: {"wsCount":196,"chain":"ethereum"}
[api] [2026-02-05T14:40:02.369Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"mjvos","creator":"0x9c67ccda69e099f72b29bec4f25d088037106f65"}
[api] {"level":30,"time":1770302403004,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1t","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62335},"msg":"incoming request"}
[api] {"level":30,"time":1770302403005,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1t","res":{"statusCode":204},"responseTime":0.44725000113248825,"msg":"request completed"}
[api] {"level":30,"time":1770302403008,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1u","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62335},"msg":"incoming request"}
[api] {"level":30,"time":1770302405395,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1u","res":{"statusCode":200},"responseTime":2386.685499995947,"msg":"request completed"}
[api] {"level":30,"time":1770302406042,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1r","res":{"statusCode":200},"responseTime":18042.524582996964,"msg":"request completed"}
[api] {"level":30,"time":1770302406047,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1v","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62335},"msg":"incoming request"}
[api] {"level":30,"time":1770302406047,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1v","res":{"statusCode":204},"responseTime":0.33629199862480164,"msg":"request completed"}
[api] {"level":30,"time":1770302406050,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1w","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62336},"msg":"incoming request"}
[api] {"level":30,"time":1770302406056,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1w","res":{"statusCode":200},"responseTime":5.662458002567291,"msg":"request completed"}
[api] {"level":30,"time":1770302406065,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1x","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62335},"msg":"incoming request"}
[api] [2026-02-05T14:40:06.124Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":27,"limit":200}
[api] {"level":30,"time":1770302408668,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1x","res":{"statusCode":200},"responseTime":2602.568583995104,"msg":"request completed"}
[api] [ChatWorker] Sanitizing orphaned tool_calls from message 3 (missing 1 tool results)
[api] [ChatWorker] Sanitizing orphaned tool_calls from message 5 (missing 1 tool results)
[api] [2026-02-05T14:40:08.749Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:40:08.749Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:40:08.749Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: proceed...
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:40:11.690Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:40:11.753Z] [ERROR] [API-5002] api failed after 1 attempts | DATA: {"error":"This operation was aborted","url":"http://localhost:8000/moderation/input"}
[api] [2026-02-05T14:40:11.753Z] [WARN] [API-5002] Input moderation request failed, defaulting to safe | DATA: {"error":"This operation was aborted"}
[api] [2026-02-05T14:40:11.753Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml9kc0tt003810vdfcz657aq
[api] [2026-02-05T14:40:11.754Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":137,"tokenCount":5,"hasNativeBalance":true}
[api] [ChatWorker] Base filtered to 46 tools for message: "proceed..."
[api] [ChatWorker] 🔍 RAG check for: "proceed..."
[api] [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml9kceqc003b10vdb7h7nmap
[api] [2026-02-05T14:40:11.755Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:40:11.758Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:40:11.770Z] [INFO] [AI-6001][12ms] Timer finished: intent_parsing_21ebf50f | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"general_query","highLevelIntent":"GENERAL_CHAT","hasAI":false,"confidence":0.7,"routingStage":"hybrid","slotsComplete":false,"labels":[{"label":"GENERAL_CHAT","confidence":0.7},{"label":"TRADING","confidence":0.2},{"label":"MARKET_ANALYSIS","confidence":0.2}],"timerLabel":"intent_parsing_21ebf50f"}
[api] [2026-02-05T14:40:11.775Z] [INFO] [AI-6001] Intent follow-up recorded | DATA: {"previousIntent":"TRADING","nextIntent":"GENERAL_CHAT","sessionId":"cml9k8cp1000110vdxdj9hcm4"}
[api] [2026-02-05T14:40:11.776Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:40:11.776Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml9kceqc003b10vdb7h7nmap","sessionId":"cml9k8cp1000110vdxdj9hcm4","model":"deepseek-chat","intent":"GENERAL_CHAT","routingMode":"thinking","confidence":0.7}
[api] [ChatWorker] Skill-gated to 26 tools for intent=GENERAL_CHAT skills=polymarket_prediction, token_analysis, wallet_portfolio, welcome_onboarding
[api] [2026-02-05T14:40:11.776Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml9kceqc003b10vdb7h7nmap","sessionId":"cml9k8cp1000110vdxdj9hcm4","model":"deepseek-chat","intent":"GENERAL_CHAT","routingMode":"thinking","skillVersion":"clean","skills":["polymarket_prediction","token_analysis","wallet_portfolio","welcome_onboarding"],"toolCount":26}
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
[api] [2026-02-05T14:40:11.777Z] [INFO] [AI-6003][1ms] Timer finished: prompt_gen_GENERAL_CHAT_deepseek | DATA: {"model":"deepseek","intent":"GENERAL_CHAT","length":2676,"timerLabel":"prompt_gen_GENERAL_CHAT_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (5 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:40:11.777Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:40:11.777Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1144}
[api] [2026-02-05T14:40:11.777Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9kc0tt003810vdfcz657aq. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:40:11.777Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:62640 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-05T14:40:15.317Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:40:16.565Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-02-05T14:40:18.805Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:40:19.269Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T14:40:19.274Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9k8cp1000110vdxdj9hcm4","messageId":"cml9kc0tt003810vdfcz657aq","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T14:40:19.274Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"external_web_search","sessionId":"cml9k8cp1000110vdxdj9hcm4","messageId":"cml9kc0tt003810vdfcz657aq","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:40:19.275Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:40:21.699Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:40:21.871Z] [INFO] [SYS-1007] Tavily search completed | DATA: {"query":"USDC MATIC swap polygon 1inch paraswap current price 2026 February","count":3}
[api] [2026-02-05T14:40:21.872Z] [INFO] [AI-6007][2598ms] ChatWorker: tool success | DATA: {"tool":"external_web_search","sessionId":"cml9k8cp1000110vdxdj9hcm4","messageId":"cml9kc0tt003810vdfcz657aq","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:40:21.872Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_citations | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"citations","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_citations"}
[api] [ChatWorker] DeepSeek iteration 2/10 for task cml9kceqc003b10vdb7h7nmap
[api] [2026-02-05T14:40:21.881Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:40:21.884Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:40:21.887Z] [INFO] [AI-6001][3ms] Timer finished: intent_parsing_8354e569 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"general_query","highLevelIntent":"GENERAL_CHAT","hasAI":false,"confidence":0.7,"routingStage":"hybrid","slotsComplete":false,"labels":[{"label":"GENERAL_CHAT","confidence":0.7},{"label":"TRADING","confidence":0.2},{"label":"MARKET_ANALYSIS","confidence":0.2}],"timerLabel":"intent_parsing_8354e569"}
[api] [2026-02-05T14:40:21.888Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
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
[api] [2026-02-05T14:40:21.889Z] [INFO] [AI-6003] Timer finished: prompt_gen_GENERAL_CHAT_deepseek | DATA: {"model":"deepseek","intent":"GENERAL_CHAT","length":2676,"timerLabel":"prompt_gen_GENERAL_CHAT_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (5 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:40:21.890Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:40:21.890Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1144}
[api] [2026-02-05T14:40:21.890Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9kc0tt003810vdfcz657aq. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:40:21.890Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:40:23.752Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:40:23.753Z] [ERROR] [API-5002] GeckoTerminal API error after retries | DATA: {"endpoint":"/networks/eth/trending_pools?page=6&include=base_token&duration=5m","error":"Rate limit hit, backing off for 60000ms"}
[api] [2026-02-05T14:40:23.753Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"eth","error":"Rate limit hit, backing off for 60000ms"}
[api] [2026-02-05T14:40:23.753Z] [INFO] [API-5001][22992ms] Premium trending tokens fetch complete | DATA: {"count":93,"chain":"ethereum","source":"WebSocket","wsOriginal":196}
[api] [TokenJob] Got 93 trending tokens for Ethereum
[api] Saved 93 trending tokens for eth to database and memory cache
[api] [TokenJob] Saved 93 tokens for Ethereum to DB + cache
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-02-05T14:40:25.605Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T14:40:25.610Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9k8cp1000110vdxdj9hcm4","messageId":"cml9kc0tt003810vdfcz657aq","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T14:40:25.610Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"get_token_price","sessionId":"cml9k8cp1000110vdxdj9hcm4","messageId":"cml9kc0tt003810vdfcz657aq","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:40:25.611Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [GetTokenPrice] Fetching price for MATIC (isAddress: false)...
[api] [2026-02-05T14:40:26.430Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [2026-02-05T14:40:26.672Z] [INFO] [AI-6007][1062ms] ChatWorker: tool success | DATA: {"tool":"get_token_price","sessionId":"cml9k8cp1000110vdxdj9hcm4","messageId":"cml9kc0tt003810vdfcz657aq","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] DeepSeek iteration 3/10 for task cml9kceqc003b10vdb7h7nmap
[api] [2026-02-05T14:40:26.677Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:40:26.678Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:40:26.679Z] [INFO] [AI-6001] Timer finished: intent_parsing_32470571 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"general_query","highLevelIntent":"GENERAL_CHAT","hasAI":false,"confidence":0.7,"routingStage":"hybrid","slotsComplete":false,"labels":[{"label":"GENERAL_CHAT","confidence":0.7},{"label":"TRADING","confidence":0.2},{"label":"MARKET_ANALYSIS","confidence":0.2}],"timerLabel":"intent_parsing_32470571"}
[api] [2026-02-05T14:40:26.679Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
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
[api] [2026-02-05T14:40:26.680Z] [INFO] [AI-6003] Timer finished: prompt_gen_GENERAL_CHAT_deepseek | DATA: {"model":"deepseek","intent":"GENERAL_CHAT","length":2676,"timerLabel":"prompt_gen_GENERAL_CHAT_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (5 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:40:26.680Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:40:26.680Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1144}
[api] [2026-02-05T14:40:26.681Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9kc0tt003810vdfcz657aq. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:40:26.681Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:40:31.708Z] [INFO] [SYS-1001] No open positions to monitor
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-02-05T14:40:35.815Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T14:40:35.820Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9k8cp1000110vdxdj9hcm4","messageId":"cml9kc0tt003810vdfcz657aq","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T14:40:35.820Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"get_token_info","sessionId":"cml9k8cp1000110vdxdj9hcm4","messageId":"cml9kc0tt003810vdfcz657aq","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:40:35.820Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:40:35.823Z] [INFO] [AI-6005][1ms] Timer finished: launchpad_det_0x3c499c542cef5e3811e1192ce70d8cc03d5c3359 | DATA: {"address":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","chainId":137,"found":false,"timerLabel":"launchpad_det_0x3c499c542cef5e3811e1192ce70d8cc03d5c3359"}
[api] [GetTokenInfo] Attempting DexScreener fallback...
[api] [2026-02-05T14:40:36.857Z] [INFO] [AI-6007][1037ms] ChatWorker: tool success | DATA: {"tool":"get_token_info","sessionId":"cml9k8cp1000110vdxdj9hcm4","messageId":"cml9kc0tt003810vdfcz657aq","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] DeepSeek iteration 4/10 for task cml9kceqc003b10vdb7h7nmap
[api] [2026-02-05T14:40:36.863Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:40:36.865Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:40:36.866Z] [INFO] [AI-6001][1ms] Timer finished: intent_parsing_bfa61180 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"general_query","highLevelIntent":"GENERAL_CHAT","hasAI":false,"confidence":0.7,"routingStage":"hybrid","slotsComplete":false,"labels":[{"label":"GENERAL_CHAT","confidence":0.7},{"label":"TRADING","confidence":0.2},{"label":"MARKET_ANALYSIS","confidence":0.2}],"timerLabel":"intent_parsing_bfa61180"}
[api] [2026-02-05T14:40:36.867Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
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
[api] [2026-02-05T14:40:36.867Z] [INFO] [AI-6003] Timer finished: prompt_gen_GENERAL_CHAT_deepseek | DATA: {"model":"deepseek","intent":"GENERAL_CHAT","length":2676,"timerLabel":"prompt_gen_GENERAL_CHAT_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (5 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:40:36.867Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:40:36.868Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1144}
[api] [2026-02-05T14:40:36.868Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9kc0tt003810vdfcz657aq. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:40:36.869Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:40:41.716Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:40:48.498Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[python] INFO:moderation.router:Moderating output: I notice there's a discrepancy in the MATIC price....
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:62806 - "POST /moderation/output HTTP/1.1" 200 OK
[api] [2026-02-05T14:40:49.818Z] [INFO] [SYS-1007] Moderation Output check result | DATA: {"safe":true,"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] Broadcasting message_complete for cml9kc0tt003810vdfcz657aq
[api] [2026-02-05T14:40:49.835Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] [2026-02-05T14:40:49.837Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:40:49.837Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] {"level":30,"time":1770302449853,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1y","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62818},"msg":"incoming request"}
[api] {"level":30,"time":1770302449854,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1y","res":{"statusCode":204},"responseTime":0.5028750002384186,"msg":"request completed"}
[api] {"level":30,"time":1770302449855,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1z","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62819},"msg":"incoming request"}
[api] {"level":30,"time":1770302449855,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1z","res":{"statusCode":204},"responseTime":0.10958299785852432,"msg":"request completed"}
[api] {"level":30,"time":1770302449857,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-20","req":{"method":"GET","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62818},"msg":"incoming request"}
[api] {"level":30,"time":1770302449858,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-21","req":{"method":"GET","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62819},"msg":"incoming request"}
[api] {"level":30,"time":1770302449865,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-20","res":{"statusCode":200},"responseTime":7.7483749985694885,"msg":"request completed"}
[api] {"level":30,"time":1770302449865,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-21","res":{"statusCode":200},"responseTime":6.932374998927116,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:40:51.726Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
[api] [2026-02-05T14:40:53.833Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"solana","limit":100}
[api] {"level":30,"time":1770302454192,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-22","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62818},"msg":"incoming request"}
[api] {"level":30,"time":1770302454192,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-22","res":{"statusCode":204},"responseTime":0.49400000274181366,"msg":"request completed"}
[api] {"level":30,"time":1770302454193,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-23","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62819},"msg":"incoming request"}
[api] {"level":30,"time":1770302454193,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-23","res":{"statusCode":204},"responseTime":0.24483300000429153,"msg":"request completed"}
[api] {"level":30,"time":1770302454195,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-24","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62818},"msg":"incoming request"}
[api] {"level":30,"time":1770302454197,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-25","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62830},"msg":"incoming request"}
[api] {"level":30,"time":1770302454198,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-25","res":{"statusCode":204},"responseTime":0.31424999982118607,"msg":"request completed"}
[api] {"level":30,"time":1770302454199,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-26","req":{"method":"POST","url":"/api/chat/sessions/cml9k8cp1000110vdxdj9hcm4/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62819},"msg":"incoming request"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=Yes...
[api] {"level":30,"time":1770302454203,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-27","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62830},"msg":"incoming request"}
[api] {"level":30,"time":1770302454204,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-24","res":{"statusCode":200},"responseTime":9.112041004002094,"msg":"request completed"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   userIdLength: 35,
[api]   userIdPrefix: 'did:privy:cmj0a3j3f0',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] [verifyAccess] ✅ Access granted
[api] [2026-02-05T14:40:55.394Z] [INFO] [WTC-2002] WS addresses discovered | DATA: {"wsCount":281,"chain":"solana"}
[api] [2026-02-05T14:40:58.946Z] [ERROR] [API-5002] api failed after 1 attempts | DATA: {"error":"terminated","url":"https://api.dexscreener.com/latest/dex/search?q=pumpswap"}
[api] {"level":30,"time":1770302459501,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-26","res":{"statusCode":200},"responseTime":5302.11249999702,"msg":"request completed"}
[api] {"level":30,"time":1770302459505,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-28","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62818},"msg":"incoming request"}
[api] {"level":30,"time":1770302459505,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-28","res":{"statusCode":204},"responseTime":0.23429200053215027,"msg":"request completed"}
[api] {"level":30,"time":1770302459506,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-29","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62819},"msg":"incoming request"}
[api] {"level":30,"time":1770302459510,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-29","res":{"statusCode":200},"responseTime":4.179375000298023,"msg":"request completed"}
[api] {"level":30,"time":1770302459523,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2a","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62818},"msg":"incoming request"}
[api] {"level":30,"time":1770302459523,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2a","res":{"statusCode":204},"responseTime":0.31287500262260437,"msg":"request completed"}
[api] {"level":30,"time":1770302459526,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2b","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62819},"msg":"incoming request"}
[api] {"level":30,"time":1770302459667,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-27","res":{"statusCode":200},"responseTime":5464.230374999344,"msg":"request completed"}
[api] {"level":30,"time":1770302459670,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2c","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62818},"msg":"incoming request"}
[api] {"level":30,"time":1770302459670,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2c","res":{"statusCode":204},"responseTime":0.31312499940395355,"msg":"request completed"}
[api] {"level":30,"time":1770302459671,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2d","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62830},"msg":"incoming request"}
[api] [ChatWorker] Sanitizing orphaned tool_calls from message 3 (missing 1 tool results)
[api] [ChatWorker] Sanitizing orphaned tool_calls from message 5 (missing 1 tool results)
[api] [ChatWorker] Sanitizing orphaned tool_calls from message 7 (missing 1 tool results)
[api] [2026-02-05T14:40:59.814Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:40:59.814Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:40:59.814Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: Yes...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:62917 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-05T14:41:00.902Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:41:00.902Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml9kdfwt006510vdg1yjhai0
[api] [2026-02-05T14:41:00.903Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":137,"tokenCount":5,"hasNativeBalance":true}
[api] [ChatWorker] Base filtered to 46 tools for message: "Yes..."
[api] [ChatWorker] 🔍 RAG check for: "Yes..."
[api] [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml9kdjzb006710vdnwnyvdu9
[api] [2026-02-05T14:41:00.903Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:41:00.905Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:41:01.732Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770302461963,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2b","res":{"statusCode":200},"responseTime":2437.3637909963727,"msg":"request completed"}
[api] {"level":30,"time":1770302461968,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2e","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62818},"msg":"incoming request"}
[api] {"level":30,"time":1770302462065,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2d","res":{"statusCode":200},"responseTime":2393.307583004236,"msg":"request completed"}
[api] [2026-02-05T14:41:03.182Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":113,"limit":200}
[api] [2026-02-05T14:41:03.182Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"solana","error":"GeckoTerminal backoff active (21s remaining)"}
[api] [2026-02-05T14:41:03.182Z] [INFO] [API-5001][9349ms] Premium trending tokens fetch complete | DATA: {"count":96,"chain":"solana","source":"WebSocket","wsOriginal":281}
[api] [TokenJob] Got 96 trending tokens for Solana
[api] Saved 96 trending tokens for solana to database and memory cache
[api] [TokenJob] Saved 96 tokens for Solana to DB + cache
[api] {"level":30,"time":1770302463672,"pid":89814,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2e","res":{"statusCode":200},"responseTime":1703.7065000012517,"msg":"request completed"}
[api] [2026-02-05T14:41:06.250Z] [INFO] [AI-6001][5345ms] Timer finished: intent_parsing_967f8a70 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"general_query","highLevelIntent":"GENERAL_CHAT","hasAI":true,"confidence":0.3,"routingStage":"hybrid","conflict":"multi","slotsComplete":false,"labels":[{"label":"GENERAL_CHAT","confidence":0.3},{"label":"PREDICTION_MARKETS","confidence":0.2},{"label":"TRADING","confidence":0}],"timerLabel":"intent_parsing_967f8a70"}
[api] [2026-02-05T14:41:06.255Z] [INFO] [AI-6001] Intent follow-up recorded | DATA: {"previousIntent":"GENERAL_CHAT","nextIntent":"GENERAL_CHAT","sessionId":"cml9k8cp1000110vdxdj9hcm4"}
[api] [2026-02-05T14:41:06.256Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:41:06.256Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml9kdjzb006710vdnwnyvdu9","sessionId":"cml9k8cp1000110vdxdj9hcm4","model":"deepseek-chat","intent":"GENERAL_CHAT","routingMode":"thinking","confidence":0.3}
[api] [ChatWorker] Skill-gated to 26 tools for intent=GENERAL_CHAT skills=polymarket_prediction, token_analysis, wallet_portfolio, welcome_onboarding
[api] [2026-02-05T14:41:06.256Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml9kdjzb006710vdnwnyvdu9","sessionId":"cml9k8cp1000110vdxdj9hcm4","model":"deepseek-chat","intent":"GENERAL_CHAT","routingMode":"thinking","skillVersion":"clean","skills":["polymarket_prediction","token_analysis","wallet_portfolio","welcome_onboarding"],"toolCount":26}
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
[api] [2026-02-05T14:41:06.257Z] [INFO] [AI-6003] Timer finished: prompt_gen_GENERAL_CHAT_deepseek | DATA: {"model":"deepseek","intent":"GENERAL_CHAT","length":2676,"timerLabel":"prompt_gen_GENERAL_CHAT_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (5 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:41:06.257Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:41:06.257Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1144}
[api] [2026-02-05T14:41:06.257Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9kdfwt006510vdg1yjhai0. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:41:06.257Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:41:07.511Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"knkjh","creator":"0x0c24abaf61bc2942a054bc5f974c1925d019a8e7"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:41:11.741Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:41:13.993Z] [INFO] [SYS-1007][TID:1f08e355-c3d1-4b75-9ac3-1e8f334ada73] Alpha Detector: Checking new coin | DATA: {"symbol":"lfbi","creator":"0xa4fcb267bbfd371dad685b9b706cc426fbed77f3"}
[