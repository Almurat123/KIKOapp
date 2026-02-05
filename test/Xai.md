[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T13:46:11.750Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T13:46:16.665Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] {"level":30,"time":1770299179085,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-v","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58742},"msg":"incoming request"}
[api] {"level":30,"time":1770299179085,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-v","res":{"statusCode":204},"responseTime":0.2104169949889183,"msg":"request completed"}
[api] {"level":30,"time":1770299179085,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","req":{"method":"OPTIONS","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58741},"msg":"incoming request"}
[api] {"level":30,"time":1770299179086,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","res":{"statusCode":204},"responseTime":0.03974999487400055,"msg":"request completed"}
[api] {"level":30,"time":1770299179088,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-x","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58742},"msg":"incoming request"}
[api] {"level":30,"time":1770299179088,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","req":{"method":"GET","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58741},"msg":"incoming request"}
[api] {"level":30,"time":1770299179089,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-z","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58847},"msg":"incoming request"}
[api] {"level":30,"time":1770299179089,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-z","res":{"statusCode":204},"responseTime":0.2205829992890358,"msg":"request completed"}
[api] {"level":30,"time":1770299179090,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","res":{"statusCode":200},"responseTime":1.9099159985780716,"msg":"request completed"}
[api] {"level":30,"time":1770299179090,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-10","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58847},"msg":"incoming request"}
[api] {"level":30,"time":1770299179094,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-x","res":{"statusCode":200},"responseTime":6.675165995955467,"msg":"request completed"}
[api] {"level":30,"time":1770299179095,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-11","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWt0Zm5oa3gwMGNka3kwYzN0M2xtMzZpIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzAyOTg0MDEsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc3MDMwMjAwMX0.9256aXGbqkZr2ut5-gdTeZbiaJllM6vezsNM7gSDRbSRR__bXPZz7i4PaBhhQFUqtCI6UywPsuHZtNp3mOQ_CA","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58849},"msg":"incoming request"}
[api] [2026-02-05T13:46:19.096Z] [INFO] [WS-8001][TID:d05b432f-c318-4b66-aaff-ab85197193c6] ChatWS Client connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1}
[api] [2026-02-05T13:46:19.096Z] [INFO] [WS-8001][TID:d05b432f-c318-4b66-aaff-ab85197193c6] ChatWS: User connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl2...","tokenExp":1770302001}
[api] [2026-02-05T13:46:19.825Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"bsuha","creator":"0xe5fba030c079bbd78549b1517f3b755a0d080560"}
[api] [2026-02-05T13:46:20.216Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"daxb","creator":"0x9cd064551d16314cd7af3e62eaa7d0f6c74914da"}
[api] [2026-02-05T13:46:20.702Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"chord_f78d","creator":"0xe63f0ef5a09c11e59f021be04317fa538bf06dc3"}
[api] [2026-02-05T13:46:21.106Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"cruzp","creator":"0xaa13b6decade9a499857d3d7b4e3aad947db7853"}
[api] [2026-02-05T13:46:21.749Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"tpuk","creator":"0x998b4303d96910f9b54ff90ddd0bee1fbd1e6cae"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T13:46:21.753Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T13:46:22.222Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"ghhr","creator":"0x566b8504b6eb66d8108d18480630b01dc76908aa"}
[api] [2026-02-05T13:46:22.733Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"lkhz","creator":"0x725ff0eaad85ea9df5b170ab0e0edadefdb105c6"}
[api] [2026-02-05T13:46:23.210Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"cebsg","creator":"0xf8ad433bd205b2d20364fbd50d92629947769ff5"}
[api] {"level":30,"time":1770299184371,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-10","res":{"statusCode":200},"responseTime":5280.292415998876,"msg":"request completed"}
[api] {"level":30,"time":1770299184376,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-12","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58741},"msg":"incoming request"}
[api] {"level":30,"time":1770299184376,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-12","res":{"statusCode":204},"responseTime":0.1707499995827675,"msg":"request completed"}
[api] {"level":30,"time":1770299184379,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-13","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58742},"msg":"incoming request"}
[api] {"level":30,"time":1770299187122,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-13","res":{"statusCode":200},"responseTime":2743.3069999963045,"msg":"request completed"}
[api] {"level":30,"time":1770299190309,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-14","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58847},"msg":"incoming request"}
[api] {"level":30,"time":1770299190309,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-14","res":{"statusCode":204},"responseTime":0.3382909968495369,"msg":"request completed"}
[api] {"level":30,"time":1770299190309,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-15","req":{"method":"OPTIONS","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58741},"msg":"incoming request"}
[api] {"level":30,"time":1770299190309,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-15","res":{"statusCode":204},"responseTime":0.12616600096225739,"msg":"request completed"}
[api] {"level":30,"time":1770299190310,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-16","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58742},"msg":"incoming request"}
[api] {"level":30,"time":1770299190310,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-16","res":{"statusCode":204},"responseTime":0.17737500369548798,"msg":"request completed"}
[api] {"level":30,"time":1770299190310,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-17","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58847},"msg":"incoming request"}
[api] {"level":30,"time":1770299190312,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-18","req":{"method":"POST","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58741},"msg":"incoming request"}
[api] {"level":30,"time":1770299190313,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-19","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58742},"msg":"incoming request"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=what's my balance ?...
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   userIdLength: 35,
[api]   userIdPrefix: 'did:privy:cmj0a3j3f0',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] {"level":30,"time":1770299190316,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-17","res":{"statusCode":200},"responseTime":5.377540998160839,"msg":"request completed"}
[api] {"level":30,"time":1770299190316,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-18","res":{"statusCode":200},"responseTime":4.485832996666431,"msg":"request completed"}
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1770299190323,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1a","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9ifhgr002z12y5ozypz623","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58847},"msg":"incoming request"}
[api] {"level":30,"time":1770299190323,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1a","res":{"statusCode":204},"responseTime":0.26099999994039536,"msg":"request completed"}
[api] {"level":30,"time":1770299190326,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1b","req":{"method":"GET","url":"/api/chat/sessions/cml9ifhgr002z12y5ozypz623","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58741},"msg":"incoming request"}
[api] {"level":30,"time":1770299190334,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1b","res":{"statusCode":200},"responseTime":7.334042005240917,"msg":"request completed"}
[api] {"level":30,"time":1770299190337,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1c","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9ifhgr002z12y5ozypz623/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58847},"msg":"incoming request"}
[api] {"level":30,"time":1770299190337,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1c","res":{"statusCode":204},"responseTime":0.252082996070385,"msg":"request completed"}
[api] {"level":30,"time":1770299190338,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1d","req":{"method":"POST","url":"/api/chat/sessions/cml9ifhgr002z12y5ozypz623/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58741},"msg":"incoming request"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T13:46:31.763Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
[api] [2026-02-05T13:46:33.833Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"solana","limit":100}
[api] {"level":30,"time":1770299195028,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-19","res":{"statusCode":200},"responseTime":4714.907540999353,"msg":"request completed"}
[api] {"level":30,"time":1770299195206,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1d","res":{"statusCode":200},"responseTime":4867.93554200232,"msg":"request completed"}
[api] {"level":30,"time":1770299195217,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1e","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58847},"msg":"incoming request"}
[api] {"level":30,"time":1770299195217,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1e","res":{"statusCode":204},"responseTime":0.49983300268650055,"msg":"request completed"}
[api] {"level":30,"time":1770299195220,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1f","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58742},"msg":"incoming request"}
[api] {"level":30,"time":1770299195227,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1f","res":{"statusCode":200},"responseTime":6.8023329973220825,"msg":"request completed"}
[api] {"level":30,"time":1770299195230,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1g","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58741},"msg":"incoming request"}
[api] [2026-02-05T13:46:35.576Z] [INFO] [WTC-2002] WS addresses discovered | DATA: {"wsCount":286,"chain":"solana"}
[api] {"level":30,"time":1770299196746,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1g","res":{"statusCode":200},"responseTime":1515.5603340044618,"msg":"request completed"}
[api] [2026-02-05T13:46:37.783Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:46:37.783Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:46:37.783Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: what's my balance ?...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:59043 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-05T13:46:39.144Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T13:46:39.144Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml9ifhhs003512y5ebkffxsj
[api] [2026-02-05T13:46:39.145Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":137,"tokenCount":3,"hasNativeBalance":true}
[api] [ChatWorker] Base filtered to 46 tools for message: "what's my balance ?..."
[api] [ChatWorker] 🔍 RAG check for: "what's my balance ?..."
[api] [ChatWorker] 🎯 RAG: Match found! Query looks informational.
[api] [2026-02-05T13:46:39.145Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/embeddings "HTTP/1.1 200 OK"
[python] ERROR:rag.router:Query failed: Collection expecting embedding with dimension of 384, got 1536
[python] INFO:     127.0.0.1:59066 - "POST /rag/query HTTP/1.1" 500 Internal Server Error
[api] [2026-02-05T13:46:40.371Z] [ERROR] [API-5002] api failed after 1 attempts | DATA: {"error":"HTTP 500: {\"detail\":\"Collection expecting embedding with dimension of 384, got 1536\"}","url":"http://localhost:8000/rag/query"}
[api] [2026-02-05T13:46:40.371Z] [WARN] [API-5002] RAGClient: Query failed (skipping RAG) | DATA: {"error":"HTTP 500: {\"detail\":\"Collection expecting embedding with dimension of 384, got 1536\"}"}
[api] [ChatWorker] ℹ️ RAG: No relevant knowledge found in local base.
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml9ifl8c003712y5qgx9pksc
[api] [2026-02-05T13:46:40.371Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:46:40.374Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:46:40.380Z] [INFO] [AI-6001][6ms] Timer finished: intent_parsing_772c0106 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"wallet_balance","highLevelIntent":"MARKET_ANALYSIS","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"MARKET_ANALYSIS","slotsComplete":false,"labels":[{"label":"MARKET_ANALYSIS","confidence":0.95},{"label":"PREDICTION_MARKETS","confidence":0.1414213562373095},{"label":"GENERAL_CHAT","confidence":0.1414213562373095}],"timerLabel":"intent_parsing_772c0106"}
[api] [2026-02-05T13:46:40.384Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:46:40.384Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml9ifl8c003712y5qgx9pksc","sessionId":"cml9ifhgr002z12y5ozypz623","model":"deepseek-chat","intent":"MARKET_ANALYSIS","routingMode":"thinking","hardRule":{"label":"MARKET_ANALYSIS","reason":"question intent"},"confidence":0.95}
[api] [ChatWorker] Skill-gated to 26 tools for intent=MARKET_ANALYSIS skills=polymarket_prediction, token_analysis, wallet_portfolio, welcome_onboarding
[api] [2026-02-05T13:46:40.384Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml9ifl8c003712y5qgx9pksc","sessionId":"cml9ifhgr002z12y5ozypz623","model":"deepseek-chat","intent":"MARKET_ANALYSIS","routingMode":"thinking","skillVersion":"clean","skills":["polymarket_prediction","token_analysis","wallet_portfolio","welcome_onboarding"],"toolCount":26}
[api] [2026-02-05T13:46:40.384Z] [INFO] [AI-6007] ChatWorker: early pre-fetch used client context | DATA: {"tool":"get_wallet_info"}
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
[api] [2026-02-05T13:46:40.385Z] [INFO] [AI-6003] Timer finished: prompt_gen_MARKET_ANALYSIS_deepseek | DATA: {"model":"deepseek","intent":"MARKET_ANALYSIS","length":2676,"timerLabel":"prompt_gen_MARKET_ANALYSIS_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (3 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T13:46:40.385Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T13:46:40.385Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1034}
[api] [2026-02-05T13:46:40.385Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":3,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"},{"symbol":"USDC","balance":"5.926982"},{"symbol":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","balance":"5.926982"}],"spotlight":[{"symbol":"USDC","balance":"5.926982"}]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9ifhhs003512y5ebkffxsj. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T13:46:40.385Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T13:46:41.773Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T13:46:42.930Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":131,"limit":200}
[api] [2026-02-05T13:46:42.930Z] [INFO] [API-5001][9097ms] Premium trending tokens fetch complete | DATA: {"count":100,"chain":"solana","source":"WebSocket","wsOriginal":286}
[api] [TokenJob] Got 100 trending tokens for Solana
[api] Saved 100 trending tokens for solana to database and memory cache
[api] [TokenJob] Saved 100 tokens for Solana to DB + cache
[api] [2026-02-05T13:46:48.495Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[python] INFO:moderation.router:Moderating output: I can see your current wallet balance on Polygon (...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:59126 - "POST /moderation/output HTTP/1.1" 200 OK
[api] [2026-02-05T13:46:49.649Z] [INFO] [SYS-1007] Moderation Output check result | DATA: {"safe":true,"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] Broadcasting message_complete for cml9ifhhs003512y5ebkffxsj
[api] [2026-02-05T13:46:49.662Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] [2026-02-05T13:46:49.664Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:46:49.664Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] {"level":30,"time":1770299209674,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1h","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9ifhgr002z12y5ozypz623","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58847},"msg":"incoming request"}
[api] {"level":30,"time":1770299209675,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1h","res":{"statusCode":204},"responseTime":0.7466249987483025,"msg":"request completed"}
[api] {"level":30,"time":1770299209675,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1i","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9ifhgr002z12y5ozypz623","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58742},"msg":"incoming request"}
[api] {"level":30,"time":1770299209676,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1i","res":{"statusCode":204},"responseTime":0.21620800346136093,"msg":"request completed"}
[api] {"level":30,"time":1770299209677,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1j","req":{"method":"GET","url":"/api/chat/sessions/cml9ifhgr002z12y5ozypz623","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58741},"msg":"incoming request"}
[api] {"level":30,"time":1770299209678,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1k","req":{"method":"GET","url":"/api/chat/sessions/cml9ifhgr002z12y5ozypz623","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58847},"msg":"incoming request"}
[api] {"level":30,"time":1770299209684,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1k","res":{"statusCode":200},"responseTime":6.315124996006489,"msg":"request completed"}
[api] {"level":30,"time":1770299209685,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1j","res":{"statusCode":200},"responseTime":8.27487500011921,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T13:46:51.780Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T13:47:01.790Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T13:47:11.799Z] [INFO] [SYS-1001] No open positions to monitor
[api] [DBLock] Cleaning expired/stale lock {
[api]   key: 'lock:tokenJob:refresh:base',
[api]   expiresAt: '2026-02-05T13:45:29.797Z',
[api]   ageMs: 343194,
[api]   isExpired: true,
[api]   isVeryStale: false
[api] }
[api] [DBLock] Acquired lock after cleaning stale entry { key: 'lock:tokenJob:refresh:base' }
[api] [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
[api] [2026-02-05T13:47:13.002Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"base","limit":100}
[api] {"level":30,"time":1770299233175,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1l","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58742},"msg":"incoming request"}
[api] {"level":30,"time":1770299233176,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1l","res":{"statusCode":204},"responseTime":0.5464590042829514,"msg":"request completed"}
[api] {"level":30,"time":1770299233177,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1m","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9ifhgr002z12y5ozypz623/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58847},"msg":"incoming request"}
[api] {"level":30,"time":1770299233177,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1m","res":{"statusCode":204},"responseTime":0.32704200595617294,"msg":"request completed"}
[api] {"level":30,"time":1770299233177,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1n","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58741},"msg":"incoming request"}
[api] {"level":30,"time":1770299233178,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1n","res":{"statusCode":204},"responseTime":0.19208300113677979,"msg":"request completed"}
[api] {"level":30,"time":1770299233178,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1o","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58742},"msg":"incoming request"}
[api] {"level":30,"time":1770299233180,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1p","req":{"method":"POST","url":"/api/chat/sessions/cml9ifhgr002z12y5ozypz623/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58847},"msg":"incoming request"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=Sell 3 USDC to Matic...
[api] {"level":30,"time":1770299233184,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1q","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58741},"msg":"incoming request"}
[api] {"level":30,"time":1770299233191,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1o","res":{"statusCode":200},"responseTime":12.459541998803616,"msg":"request completed"}
[api] [2026-02-05T13:47:14.584Z] [INFO] [WTC-2002] WS addresses discovered | DATA: {"wsCount":179,"chain":"base"}
[api] [2026-02-05T13:47:16.666Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] {"level":30,"time":1770299238760,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1q","res":{"statusCode":200},"responseTime":5575.786665998399,"msg":"request completed"}
[api] {"level":30,"time":1770299238761,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1p","res":{"statusCode":200},"responseTime":5581.048624999821,"msg":"request completed"}
[api] {"level":30,"time":1770299238766,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1r","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58742},"msg":"incoming request"}
[api] {"level":30,"time":1770299238767,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1r","res":{"statusCode":204},"responseTime":0.43870799988508224,"msg":"request completed"}
[api] {"level":30,"time":1770299238768,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1s","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58741},"msg":"incoming request"}
[api] {"level":30,"time":1770299238768,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1s","res":{"statusCode":204},"responseTime":0.17025000602006912,"msg":"request completed"}
[api] {"level":30,"time":1770299238769,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1t","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58847},"msg":"incoming request"}
[api] {"level":30,"time":1770299238774,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1u","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58742},"msg":"incoming request"}
[api] {"level":30,"time":1770299238781,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1u","res":{"statusCode":200},"responseTime":6.084290996193886,"msg":"request completed"}
[api] {"level":30,"time":1770299238789,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1v","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":58741},"msg":"incoming request"}
[api] [2026-02-05T13:47:19.073Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":41,"limit":200}
[api] [2026-02-05T13:47:19.832Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:47:19.833Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:47:19.833Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: Sell 3 USDC to Matic...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:59286 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-05T13:47:20.994Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T13:47:20.995Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml9igek3006912y5mo3vt0ju
[api] [2026-02-05T13:47:20.995Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":137,"tokenCount":3,"hasNativeBalance":true}
[api] [ChatWorker] Base filtered to 46 tools for message: "Sell 3 USDC to Matic..."
[api] [ChatWorker] 🔍 RAG check for: "Sell 3 USDC to Matic..."
[api] [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml9igiua006b12y5vdm993uh
[api] [2026-02-05T13:47:20.995Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:47:21.000Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:47:21.004Z] [INFO] [AI-6001][4ms] Timer finished: intent_parsing_1be4b1dc | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.5499999999999999},{"label":"GENERAL_CHAT","confidence":0.2}],"timerLabel":"intent_parsing_1be4b1dc"}
[api] [2026-02-05T13:47:21.008Z] [INFO] [AI-6001] Intent follow-up recorded | DATA: {"previousIntent":"MARKET_ANALYSIS","nextIntent":"TRADING","sessionId":"cml9ifhgr002z12y5ozypz623"}
[api] [2026-02-05T13:47:21.009Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:47:21.009Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml9igiua006b12y5vdm993uh","sessionId":"cml9ifhgr002z12y5ozypz623","model":"deepseek-chat","intent":"TRADING","routingMode":"execution","hardRule":{"label":"TRADING","reason":"action + slots complete"},"confidence":0.95}
[api] [ChatWorker] Skill-gated to 13 tools for intent=TRADING skills=cross_chain_swap, swap, token_alert, wallet_portfolio
[api] [2026-02-05T13:47:21.009Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml9igiua006b12y5vdm993uh","sessionId":"cml9ifhgr002z12y5ozypz623","model":"deepseek-chat","intent":"TRADING","routingMode":"execution","skillVersion":"exec","skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"],"toolCount":13}
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
[api] [2026-02-05T13:47:21.010Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":4,"skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"]}
[api] [2026-02-05T13:47:21.010Z] [INFO] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":13949,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (3 tokens cached)
[api] [2026-02-05T13:47:21.010Z] [INFO] [AI-6007] ChatWorker: requested token balance resolved | DATA: {"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":137,"requested":["USDC","MATIC"],"matched":["USDC","MATIC"],"missing":[],"resolvedBalances":{"USDC":"5.926982","MATIC":"20.6044348920309"}}
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T13:47:21.010Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T13:47:21.010Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1034}
[api] [2026-02-05T13:47:21.010Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":3,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"},{"symbol":"USDC","balance":"5.926982"},{"symbol":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","balance":"5.926982"}],"spotlight":[{"symbol":"USDC","balance":"5.926982"}]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-02-05T13:47:21.011Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":185}
[api] [2026-02-05T13:47:21.011Z] [INFO] [AI-6007] ChatWorker: balance system rule injected
[api] [ChatWorker] Broadcasting Thinking status for cml9igek3006912y5mo3vt0ju. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T13:47:21.011Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] {"level":30,"time":1770299241163,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1t","res":{"statusCode":200},"responseTime":2393.5635000020266,"msg":"request completed"}
[api] {"level":30,"time":1770299241166,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1v","res":{"statusCode":200},"responseTime":2376.442374996841,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T13:47:21.805Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T13:47:24.392Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T13:47:25.636Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T13:47:25.814Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"wolf_99c3","creator":"0xc482d8355eb47c6c93fac77b1c45cb394b872d7d"}
[api] [2026-02-05T13:47:26.205Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"qyww","creator":"0x2b21dda900e80e80832d3e99b879a0111d5efb01"}
[api] [2026-02-05T13:47:26.673Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"zeszd","creator":"0xf2078e11543afd7434aff2a5ff9c4773bb1b25ce"}
[api] [2026-02-05T13:47:27.212Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"yalg","creator":"0xa49e16018cb2455aeb35c711421ee3342b4057b0"}
[api] [2026-02-05T13:47:27.604Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"file_epstein","creator":"0xc4b2f1d30631db5822473d673612ce32e4977cda"}
[api] [2026-02-05T13:47:27.881Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-02-05T13:47:28.037Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"wrvfc","creator":"0x137efbdb3b7c7e16684092d34dafb4f8f7d40579"}
[api] [2026-02-05T13:47:28.410Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"fyvgc","creator":"0xfa2a21004ab226ade1523223e1f6d5f2624d5840"}
[api] [2026-02-05T13:47:28.802Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"kjgkn","creator":"0x93d9f45a05a166debe6506fb706039182d771164"}
[api] [2026-02-05T13:47:31.731Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T13:47:31.738Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9ifhgr002z12y5ozypz623","messageId":"cml9igek3006912y5mo3vt0ju","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T13:47:31.739Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"simulate_swap","sessionId":"cml9ifhgr002z12y5ozypz623","messageId":"cml9igek3006912y5mo3vt0ju","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T13:47:31.739Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] {"level":30,"time":1770299251743,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1w","req":{"method":"POST","url":"/api/swap/quote","hostname":"127.0.0.1:3001","remoteAddress":"127.0.0.1","remotePort":59515},"msg":"incoming request"}
[api] [Swap Quote] Fetching metadata for: {
[api]   tokenInForMetadata: '0x3c499c542c',
[api]   tokenOutForMetadata: '0x0d500B1d8E',
[api]   actualTokenIn: '0x3c499c542c',
[api]   actualTokenOut: '0xEeeeeEeeeE',
[api]   isTokenOutNative: true
[api] }
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T13:47:31.810Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T13:47:32.848Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T13:47:32.850Z] [ERROR] [API-5002] GeckoTerminal API error after retries | DATA: {"endpoint":"/networks/base/trending_pools?page=6&include=base_token&duration=5m","error":"Rate limit hit, backing off for 60000ms"}
[api] [2026-02-05T13:47:32.851Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"base","error":"Rate limit hit, backing off for 60000ms"}
[api] [2026-02-05T13:47:32.851Z] [INFO] [API-5001][19849ms] Premium trending tokens fetch complete | DATA: {"count":73,"chain":"base","source":"WebSocket","wsOriginal":179}
[api] [TokenJob] Got 73 trending tokens for Base
[api] [2026-02-05T13:47:32.859Z] [INFO] [API-5001][TID:4f08e643-6642-4d4a-8ad8-8d5ec6c9c5a9] Using 0x API fallback token metadata | DATA: {"symbol":"WMATIC","chainId":137}
[api] Saved 73 trending tokens for base to database and memory cache
[api] [TokenJob] Saved 73 tokens for Base to DB + cache
[api] [2026-02-05T13:47:37.059Z] [INFO] [API-5001][TID:4f08e643-6642-4d4a-8ad8-8d5ec6c9c5a9] No token metadata available, trying RPC fallback... | DATA: {"tokenAddress":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","chainId":137}
[api] [Swap Quote] Overriding tokenIn decimals to known value: 6
[api] [Swap Quote] Token decimals: {
[api]   tokenIn: '0x3c499c54',
[api]   tokenOut: '0xEeeeeEee',
[api]   tokenInDecimals: 6,
[api]   tokenOutDecimals: 18,
[api]   tokenOutMetadataDecimals: 18
[api] }
[api] [2026-02-05T13:47:38.608Z] [INFO] [API-5001][TID:4f08e643-6642-4d4a-8ad8-8d5ec6c9c5a9] Using 0x API fallback token metadata | DATA: {"symbol":"USDC","chainId":137}
[api] [2026-02-05T13:47:39.982Z] [INFO] [API-5001][TID:4f08e643-6642-4d4a-8ad8-8d5ec6c9c5a9] 0x API price received successfully | DATA: {"sellToken":"0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270","buyToken":"0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174","chainId":137,"liquidityAvailable":true}
[api] [2026-02-05T13:47:40.521Z] [INFO] [API-5001][TID:4f08e643-6642-4d4a-8ad8-8d5ec6c9c5a9] 0x API price received successfully | DATA: {"sellToken":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","buyToken":"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE","chainId":137,"liquidityAvailable":true}
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 3,
[api]   amountOut: 29.102666078234762,
[api]   quotePrice: 9.70088869274492,
[api]   refPrice: 9.733307377846993,
[api]   tokenInUsd: 'available',
[api]   impact: -0.33306957073869475,
[api]   formula: '((9.70088869274492 - 9.733307377846993) / 9.733307377846993) * 100 = -0.33306957073869475'
[api] }
[api] [QuoteService] 0x API estimatedPriceImpact: {
[api]   raw: undefined,
[api]   parsed: 0,
[api]   multipliedBy100: 0,
[api]   impactVsMkt: -0.33306957073869475,
[api]   willUse: -0.33306957073869475
[api] }
[api] {"level":30,"time":1770299260526,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1w","res":{"statusCode":200},"responseTime":8782.58066599816,"msg":"request completed"}
[api] [2026-02-05T13:47:40.527Z] [INFO] [AI-6007][8789ms] ChatWorker: tool success | DATA: {"tool":"simulate_swap","sessionId":"cml9ifhgr002z12y5ozypz623","messageId":"cml9igek3006912y5mo3vt0ju","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] DeepSeek iteration 2/10 for task cml9igiua006b12y5vdm993uh
[api] [2026-02-05T13:47:40.532Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:47:40.534Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:47:40.539Z] [INFO] [AI-6001][4ms] Timer finished: intent_parsing_0c86f341 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.5499999999999999},{"label":"GENERAL_CHAT","confidence":0.2}],"timerLabel":"intent_parsing_0c86f341"}
[api] [2026-02-05T13:47:40.539Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
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
[api] [2026-02-05T13:47:40.540Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":4,"skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"]}
[api] [2026-02-05T13:47:40.540Z] [INFO] [AI-6003][1ms] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":13949,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (3 tokens cached)
[api] [2026-02-05T13:47:40.540Z] [INFO] [AI-6007] ChatWorker: requested token balance resolved | DATA: {"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":137,"requested":["USDC","MATIC"],"matched":["USDC","MATIC"],"missing":[],"resolvedBalances":{"USDC":"5.926982","MATIC":"20.6044348920309"}}
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T13:47:40.541Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T13:47:40.541Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1034}
[api] [2026-02-05T13:47:40.541Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":3,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"},{"symbol":"USDC","balance":"5.926982"},{"symbol":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","balance":"5.926982"}],"spotlight":[{"symbol":"USDC","balance":"5.926982"}]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-02-05T13:47:40.541Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":185}
[api] [2026-02-05T13:47:40.541Z] [INFO] [AI-6007] ChatWorker: balance system rule injected
[api] [ChatWorker] Broadcasting Thinking status for cml9igek3006912y5mo3vt0ju. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T13:47:40.541Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T13:47:41.818Z] [INFO] [SYS-1001] No open positions to monitor
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-02-05T13:47:47.771Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T13:47:47.775Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9ifhgr002z12y5ozypz623","messageId":"cml9igek3006912y5mo3vt0ju","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T13:47:47.775Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"get_token_info","sessionId":"cml9ifhgr002z12y5ozypz623","messageId":"cml9igek3006912y5mo3vt0ju","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T13:47:47.775Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [GetTokenInfo] Attempting DexScreener fallback...
[api] [2026-02-05T13:47:48.888Z] [INFO] [AI-6007][1113ms] ChatWorker: tool success | DATA: {"tool":"get_token_info","sessionId":"cml9ifhgr002z12y5ozypz623","messageId":"cml9igek3006912y5mo3vt0ju","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] DeepSeek iteration 3/10 for task cml9igiua006b12y5vdm993uh
[api] [2026-02-05T13:47:48.892Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:47:48.894Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:47:48.896Z] [INFO] [AI-6001][2ms] Timer finished: intent_parsing_a3649cd1 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.5499999999999999},{"label":"GENERAL_CHAT","confidence":0.2}],"timerLabel":"intent_parsing_a3649cd1"}
[api] [2026-02-05T13:47:48.896Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
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
[api] [2026-02-05T13:47:48.897Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":4,"skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"]}
[api] [2026-02-05T13:47:48.897Z] [INFO] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":13949,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (3 tokens cached)
[api] [2026-02-05T13:47:48.897Z] [INFO] [AI-6007] ChatWorker: requested token balance resolved | DATA: {"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":137,"requested":["USDC","MATIC"],"matched":["USDC","MATIC"],"missing":[],"resolvedBalances":{"USDC":"5.926982","MATIC":"20.6044348920309"}}
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T13:47:48.898Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T13:47:48.898Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1034}
[api] [2026-02-05T13:47:48.898Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":3,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"},{"symbol":"USDC","balance":"5.926982"},{"symbol":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","balance":"5.926982"}],"spotlight":[{"symbol":"USDC","balance":"5.926982"}]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-02-05T13:47:48.898Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":185}
[api] [2026-02-05T13:47:48.898Z] [INFO] [AI-6007] ChatWorker: balance system rule injected
[api] [ChatWorker] Broadcasting Thinking status for cml9igek3006912y5mo3vt0ju. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T13:47:48.898Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T13:47:51.825Z] [INFO] [SYS-1001] No open positions to monitor
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [SocialJob] Checking Zora coin status for 55 casts...
[api] [2026-02-05T13:47:55.824Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T13:47:55.828Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9ifhgr002z12y5ozypz623","messageId":"cml9igek3006912y5mo3vt0ju","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T13:47:55.828Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"simulate_swap","sessionId":"cml9ifhgr002z12y5ozypz623","messageId":"cml9igek3006912y5mo3vt0ju","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T13:47:55.828Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] {"level":30,"time":1770299275830,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1x","req":{"method":"POST","url":"/api/swap/quote","hostname":"127.0.0.1:3001","remoteAddress":"127.0.0.1","remotePort":59515},"msg":"incoming request"}
[api] [Swap Quote] Fetching metadata for: {
[api]   tokenInForMetadata: '0x3c499c542c',
[api]   tokenOutForMetadata: '0x0d500B1d8E',
[api]   actualTokenIn: '0x3c499c542c',
[api]   actualTokenOut: '0xEeeeeEeeeE',
[api]   isTokenOutNative: true
[api] }
[api] [Swap Quote] Overriding tokenIn decimals to known value: 6
[api] [Swap Quote] Token decimals: {
[api]   tokenIn: '0x3c499c54',
[api]   tokenOut: '0xEeeeeEee',
[api]   tokenInDecimals: 6,
[api]   tokenOutDecimals: 18,
[api]   tokenOutMetadataDecimals: undefined
[api] }
[api] [2026-02-05T13:47:57.153Z] [INFO] [API-5001][TID:ab0f25cb-bb4c-49aa-baa0-acc01ada5e6b] 0x API price received successfully | DATA: {"sellToken":"0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270","buyToken":"0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174","chainId":137,"liquidityAvailable":true}
[api] [2026-02-05T13:47:57.680Z] [INFO] [API-5001][TID:ab0f25cb-bb4c-49aa-baa0-acc01ada5e6b] 0x API price received successfully | DATA: {"sellToken":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","buyToken":"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE","chainId":137,"liquidityAvailable":true}
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 1,
[api]   amountOut: 9.699800795378996,
[api]   quotePrice: 9.699800795378996,
[api]   refPrice: 9.733307377846993,
[api]   tokenInUsd: 'available',
[api]   impact: -0.3442466282761964,
[api]   formula: '((9.699800795378996 - 9.733307377846993) / 9.733307377846993) * 100 = -0.3442466282761964'
[api] }
[api] [QuoteService] 0x API estimatedPriceImpact: {
[api]   raw: undefined,
[api]   parsed: 0,
[api]   multipliedBy100: 0,
[api]   impactVsMkt: -0.3442466282761964,
[api]   willUse: -0.3442466282761964
[api] }
[api] {"level":30,"time":1770299277682,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1x","res":{"statusCode":200},"responseTime":1851.534500002861,"msg":"request completed"}
[api] [2026-02-05T13:47:57.683Z] [INFO] [AI-6007][1855ms] ChatWorker: tool success | DATA: {"tool":"simulate_swap","sessionId":"cml9ifhgr002z12y5ozypz623","messageId":"cml9igek3006912y5mo3vt0ju","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] DeepSeek iteration 4/10 for task cml9igiua006b12y5vdm993uh
[api] [2026-02-05T13:47:57.688Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:47:57.690Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:47:57.690Z] [INFO] [AI-6001] Timer finished: intent_parsing_9a9f4a5b | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.5499999999999999},{"label":"GENERAL_CHAT","confidence":0.2}],"timerLabel":"intent_parsing_9a9f4a5b"}
[api] [2026-02-05T13:47:57.691Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
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
[api] [2026-02-05T13:47:57.691Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":4,"skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"]}
[api] [2026-02-05T13:47:57.691Z] [INFO] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":13949,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (3 tokens cached)
[api] [2026-02-05T13:47:57.691Z] [INFO] [AI-6007] ChatWorker: requested token balance resolved | DATA: {"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":137,"requested":["USDC","MATIC"],"matched":["USDC","MATIC"],"missing":[],"resolvedBalances":{"USDC":"5.926982","MATIC":"20.6044348920309"}}
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T13:47:57.691Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T13:47:57.691Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1034}
[api] [2026-02-05T13:47:57.691Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":3,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"},{"symbol":"USDC","balance":"5.926982"},{"symbol":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","balance":"5.926982"}],"spotlight":[{"symbol":"USDC","balance":"5.926982"}]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-02-05T13:47:57.692Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":185}
[api] [2026-02-05T13:47:57.692Z] [INFO] [AI-6007] ChatWorker: balance system rule injected
[api] [ChatWorker] Broadcasting Thinking status for cml9igek3006912y5mo3vt0ju. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T13:47:57.692Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:47:59.669Z] [INFO] [SOC-7001][146ms] Timer finished: get_trending_casts_trending | DATA: {"timeRange":"trending","limit":500,"offset":0,"count":500,"fromCache":false,"timerLabel":"get_trending_casts_trending"}
[api] [2026-02-05T13:47:59.714Z] [INFO] [SOC-7003] SocialRepo: Updated cache with 500 merged casts
[api] [2026-02-05T13:47:59.714Z] [INFO] [SOC-7003] SocialRepo: Saved 55 trending casts to database
[api] [2026-02-05T13:47:59.714Z] [INFO] [SOC-7003][336ms] Timer finished: save_trending_casts | DATA: {"count":55,"timerLabel":"save_trending_casts"}
[api] [SocialJob] Casts refreshed: 55 saved
[api] [SocialJob] 🚀 Triggering OGP Prefetch for top 50 casts...
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T13:48:01.832Z] [INFO] [SYS-1001] No open positions to monitor
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [TokenJob] Tokens for BSC are fresh, skipping API call
[api] [TokenJob] Refreshed 4 primary chains in 136.2s
[api] [2026-02-05T13:48:03.944Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T13:48:03.948Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9ifhgr002z12y5ozypz623","messageId":"cml9igek3006912y5mo3vt0ju","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T13:48:03.948Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"external_web_search","sessionId":"cml9ifhgr002z12y5ozypz623","messageId":"cml9igek3006912y5mo3vt0ju","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T13:48:03.949Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:48:06.574Z] [INFO] [SYS-1007] Tavily search completed | DATA: {"query":"USDC MATIC swap Polygon liquidity current 2026","count":3}
[api] [2026-02-05T13:48:06.575Z] [INFO] [AI-6007][2627ms] ChatWorker: tool success | DATA: {"tool":"external_web_search","sessionId":"cml9ifhgr002z12y5ozypz623","messageId":"cml9igek3006912y5mo3vt0ju","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T13:48:06.575Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_citations | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"citations","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_citations"}
[api] [ChatWorker] DeepSeek iteration 5/10 for task cml9igiua006b12y5vdm993uh
[api] [2026-02-05T13:48:06.580Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:48:06.582Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:48:06.583Z] [INFO] [AI-6001][1ms] Timer finished: intent_parsing_e06b51c4 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.5499999999999999},{"label":"GENERAL_CHAT","confidence":0.2}],"timerLabel":"intent_parsing_e06b51c4"}
[api] [2026-02-05T13:48:06.584Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
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
[api] [2026-02-05T13:48:06.584Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":4,"skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"]}
[api] [2026-02-05T13:48:06.584Z] [INFO] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":13949,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (3 tokens cached)
[api] [2026-02-05T13:48:06.584Z] [INFO] [AI-6007] ChatWorker: requested token balance resolved | DATA: {"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":137,"requested":["USDC","MATIC"],"matched":["USDC","MATIC"],"missing":[],"resolvedBalances":{"USDC":"5.926982","MATIC":"20.6044348920309"}}
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T13:48:06.585Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T13:48:06.585Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1034}
[api] [2026-02-05T13:48:06.586Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":3,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"},{"symbol":"USDC","balance":"5.926982"},{"symbol":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","balance":"5.926982"}],"spotlight":[{"symbol":"USDC","balance":"5.926982"}]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-02-05T13:48:06.586Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":185}
[api] [2026-02-05T13:48:06.586Z] [INFO] [AI-6007] ChatWorker: balance system rule injected
[api] [ChatWorker] Broadcasting Thinking status for cml9igek3006912y5mo3vt0ju. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T13:48:06.586Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T13:48:11.839Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T13:48:14.802Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[python] INFO:moderation.router:Moderating output: I'll help you sell 3 USDC for MATIC on Polygon. Le...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:59731 - "POST /moderation/output HTTP/1.1" 200 OK
[api] [2026-02-05T13:48:16.109Z] [INFO] [SYS-1007] Moderation Output check result | DATA: {"safe":true,"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] Broadcasting message_complete for cml9igek3006912y5mo3vt0ju
[api] [2026-02-05T13:48:16.120Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] [2026-02-05T13:48:16.122Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T13:48:16.123Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] {"level":30,"time":1770299296137,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1y","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9ifhgr002z12y5ozypz623","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":59744},"msg":"incoming request"}
[api] {"level":30,"time":1770299296138,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1y","res":{"statusCode":204},"responseTime":0.6616669967770576,"msg":"request completed"}
[api] {"level":30,"time":1770299296139,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1z","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9ifhgr002z12y5ozypz623","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":59745},"msg":"incoming request"}
[api] {"level":30,"time":1770299296139,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1z","res":{"statusCode":204},"responseTime":0.15183299779891968,"msg":"request completed"}
[api] {"level":30,"time":1770299296141,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-20","req":{"method":"GET","url":"/api/chat/sessions/cml9ifhgr002z12y5ozypz623","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":59744},"msg":"incoming request"}
[api] {"level":30,"time":1770299296142,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-21","req":{"method":"GET","url":"/api/chat/sessions/cml9ifhgr002z12y5ozypz623","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":59745},"msg":"incoming request"}
[api] {"level":30,"time":1770299296149,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-21","res":{"statusCode":200},"responseTime":6.9207499995827675,"msg":"request completed"}
[api] {"level":30,"time":1770299296149,"pid":78341,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-20","res":{"statusCode":200},"responseTime":8.471540994942188,"msg":"request completed"}
[api] [2026-02-05T13:48:16.667Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T13:48:21.848Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T13:48:30.601Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"fluxport","creator":"0x7f152f581f05e52d5c127c9211b5448092881882"}
[api] [2026-02-05T13:48:31.083Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"xbxda","creator":"0x2e0854141df8bdc2fabde7095b87af2929b51f5d"}
[api] [2026-02-05T13:48:31.486Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"kcfh","creator":"0x1fc238a157ec64cb5f53964fbf2bd86fe44986ef"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T13:48:31.853Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T13:48:31.887Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"zjeuq","creator":"0xe8bb58609b52275cf97bee3a34279ac4b2b1e72a"}
[api] [2026-02-05T13:48:32.296Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"czsfa","creator":"0x4f8bd27de310284b0be426a52c57cf63160f2945"}
[api] [2026-02-05T13:48:32.835Z] [INFO] [SYS-1007][TID:7fb48cb3-912e-476a-8760-c382eac75313] Alpha Detector: Checking new coin | DATA: {"symbol":"lktpv","creator":"0xd936bcf40eb234dd626232d9949c5a78bc7fe2ee"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T13:48:41.860Z] [INFO] [SYS-1001] No open positions to monitor

