[api] [TokenJob] Skipping refresh for Ethereum - update already in progress
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [2026-02-05T14:05:00.178Z] [INFO] [SYS-1007] SocialRepo: Recalculated heat scores for 914 casts
[api] [2026-02-05T14:05:00.178Z] [INFO] [SYS-1007][20ms] Timer finished: recalc_heat_scores | DATA: {"count":914,"timerLabel":"recalc_heat_scores"}
[api] [2026-02-05T14:05:05.010Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:05:06.253Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:05:08.502Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:05:09.163Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770300310909,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65122},"msg":"incoming request"}
[api] {"level":30,"time":1770300310911,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","res":{"statusCode":204},"responseTime":1.5327499955892563,"msg":"request completed"}
[api] {"level":30,"time":1770300310911,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWt0Zm5oa3gwMGNka3kwYzN0M2xtMzZpIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzAyOTg0MDEsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc3MDMwMjAwMX0.9256aXGbqkZr2ut5-gdTeZbiaJllM6vezsNM7gSDRbSRR__bXPZz7i4PaBhhQFUqtCI6UywPsuHZtNp3mOQ_CA","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65124},"msg":"incoming request"}
[api] [2026-02-05T14:05:10.913Z] [INFO] [WS-8001][TID:f6c610af-478b-4a86-ae3c-2498cad8859f] ChatWS Client connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1}
[api] [2026-02-05T14:05:10.913Z] [INFO] [WS-8001][TID:f6c610af-478b-4a86-ae3c-2498cad8859f] ChatWS: User connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl2...","tokenExp":1770302001}
[api] {"level":30,"time":1770300310914,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","req":{"method":"OPTIONS","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65125},"msg":"incoming request"}
[api] {"level":30,"time":1770300310914,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","res":{"statusCode":204},"responseTime":0.12870800495147705,"msg":"request completed"}
[api] {"level":30,"time":1770300310914,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65122},"msg":"incoming request"}
[api] {"level":30,"time":1770300310916,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65126},"msg":"incoming request"}
[api] {"level":30,"time":1770300310916,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","res":{"statusCode":204},"responseTime":0.1588749960064888,"msg":"request completed"}
[api] {"level":30,"time":1770300310916,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","req":{"method":"GET","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65125},"msg":"incoming request"}
[api] {"level":30,"time":1770300310918,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65126},"msg":"incoming request"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   userIdLength: 35,
[api]   userIdPrefix: 'did:privy:cmj0a3j3f0',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] {"level":30,"time":1770300310921,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","res":{"statusCode":200},"responseTime":5.188458003103733,"msg":"request completed"}
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1770300310926,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","res":{"statusCode":200},"responseTime":12.054625004529953,"msg":"request completed"}
[api] [2026-02-05T14:05:13.409Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:05:13.411Z] [ERROR] [API-5002] GeckoTerminal API error after retries | DATA: {"endpoint":"/networks/eth/trending_pools?page=6&include=base_token&duration=5m","error":"Rate limit hit, backing off for 60000ms"}
[api] [2026-02-05T14:05:13.411Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"eth","error":"Rate limit hit, backing off for 60000ms"}
[api] [2026-02-05T14:05:13.411Z] [INFO] [API-5001][19283ms] Premium trending tokens fetch complete | DATA: {"count":91,"chain":"ethereum","source":"WebSocket","wsOriginal":189}
[api] [TokenJob] Got 91 trending tokens for Ethereum
[api] Saved 91 trending tokens for eth to database and memory cache
[api] [TokenJob] Saved 91 tokens for Ethereum to DB + cache
[api] {"level":30,"time":1770300316790,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","res":{"statusCode":200},"responseTime":5872.322458006442,"msg":"request completed"}
[api] {"level":30,"time":1770300316798,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65125},"msg":"incoming request"}
[api] {"level":30,"time":1770300316801,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","res":{"statusCode":204},"responseTime":2.1249159947037697,"msg":"request completed"}
[api] {"level":30,"time":1770300316802,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65122},"msg":"incoming request"}
[api] {"level":30,"time":1770300319068,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","res":{"statusCode":200},"responseTime":2266.4421250000596,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:05:19.173Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770300322261,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65126},"msg":"incoming request"}
[api] {"level":30,"time":1770300322263,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","res":{"statusCode":204},"responseTime":1.2504159957170486,"msg":"request completed"}
[api] {"level":30,"time":1770300322263,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65126},"msg":"incoming request"}
[api] {"level":30,"time":1770300322266,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","req":{"method":"OPTIONS","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65125},"msg":"incoming request"}
[api] {"level":30,"time":1770300322267,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","res":{"statusCode":204},"responseTime":0.5288750007748604,"msg":"request completed"}
[api] {"level":30,"time":1770300322267,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65122},"msg":"incoming request"}
[api] {"level":30,"time":1770300322267,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","res":{"statusCode":204},"responseTime":0.10266599804162979,"msg":"request completed"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=what's my balance ?...
[api] {"level":30,"time":1770300322270,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","req":{"method":"POST","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65125},"msg":"incoming request"}
[api] {"level":30,"time":1770300322273,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65122},"msg":"incoming request"}
[api] {"level":30,"time":1770300322278,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","res":{"statusCode":200},"responseTime":14.550250001251698,"msg":"request completed"}
[api] {"level":30,"time":1770300322288,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","res":{"statusCode":200},"responseTime":17.613833002746105,"msg":"request completed"}
[api] {"level":30,"time":1770300322290,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65126},"msg":"incoming request"}
[api] {"level":30,"time":1770300322290,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","res":{"statusCode":204},"responseTime":0.3016669973731041,"msg":"request completed"}
[api] {"level":30,"time":1770300322293,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","req":{"method":"GET","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65125},"msg":"incoming request"}
[api] {"level":30,"time":1770300322299,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","res":{"statusCode":200},"responseTime":5.980125002563,"msg":"request completed"}
[api] {"level":30,"time":1770300322301,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65126},"msg":"incoming request"}
[api] {"level":30,"time":1770300322301,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","res":{"statusCode":204},"responseTime":0.19349999725818634,"msg":"request completed"}
[api] {"level":30,"time":1770300322303,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","req":{"method":"POST","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65125},"msg":"incoming request"}
[api] [2026-02-05T14:05:24.093Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] {"level":30,"time":1770300327080,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","res":{"statusCode":200},"responseTime":4807.1314999982715,"msg":"request completed"}
[api] [2026-02-05T14:05:27.140Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"pyjba","creator":"0xa9f03ed1227468ee84a006f0512da17cd9d928ed"}
[api] {"level":30,"time":1770300327374,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","res":{"statusCode":200},"responseTime":5071.1347500011325,"msg":"request completed"}
[api] {"level":30,"time":1770300327384,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65126},"msg":"incoming request"}
[api] {"level":30,"time":1770300327384,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","res":{"statusCode":204},"responseTime":0.44083400070667267,"msg":"request completed"}
[api] {"level":30,"time":1770300327388,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65122},"msg":"incoming request"}
[api] {"level":30,"time":1770300327394,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","res":{"statusCode":200},"responseTime":5.955000005662441,"msg":"request completed"}
[api] {"level":30,"time":1770300327401,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65125},"msg":"incoming request"}
[api] {"level":30,"time":1770300327401,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","res":{"statusCode":204},"responseTime":0.22404199838638306,"msg":"request completed"}
[api] {"level":30,"time":1770300327403,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65126},"msg":"incoming request"}
[api] [2026-02-05T14:05:27.594Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"wkriz","creator":"0x6c0ab73fa1e09f2febca7123d7589ba4a52f4e25"}
[api] [2026-02-05T14:05:28.106Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"xeksa","creator":"0x060c9da68256b7114e52f2d440d6314fa080e06c"}
[api] [2026-02-05T14:05:28.527Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"rfcsf","creator":"0x0e0dbe0bdb69354bdbf81f886955d1a6da8d5749"}
[api] [2026-02-05T14:05:29.038Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"gunu","creator":"0x670cbce365f41498e8f243b957a8554dab250675"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:05:29.179Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:05:29.549Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"worldlibertyficoin","creator":"0xe6542f0ed5ccd80292d64875c5d885bd4d8214f3"}
[api] {"level":30,"time":1770300329592,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","res":{"statusCode":200},"responseTime":2189.030042000115,"msg":"request completed"}
[api] [2026-02-05T14:05:29.933Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"dthy","creator":"0xd2a12a244cfe216100b6a6a4b2970e2e5e1b3970"}
[api] [TokenJob] Tokens for Solana are fresh, skipping API call
[api] [2026-02-05T14:05:30.203Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:05:30.204Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:05:30.204Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: what's my balance ?...
[api] [2026-02-05T14:05:30.344Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"xqdiv","creator":"0x6e8fb84a4cef76df74a22eaa1dc6756ec5dfd51d"}
[api] [2026-02-05T14:05:30.751Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"crowwave","creator":"0xe9299059878b00fe6c9dead2f0b6ea242f5a9621"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:65415 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-05T14:05:31.662Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:05:31.667Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml9j3qx3002st6ya8od1bhxs
[api] [2026-02-05T14:05:31.668Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":137,"tokenCount":3,"hasNativeBalance":true}
[api] [ChatWorker] Base filtered to 46 tools for message: "what's my balance ?..."
[api] [ChatWorker] 🔍 RAG check for: "what's my balance ?..."
[api] [ChatWorker] 🎯 RAG: Match found! Query looks informational.
[api] [2026-02-05T14:05:31.669Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/embeddings "HTTP/1.1 200 OK"
[python] ERROR:rag.router:Query failed: Collection expecting embedding with dimension of 384, got 1536
[python] INFO:     127.0.0.1:65422 - "POST /rag/query HTTP/1.1" 500 Internal Server Error
[api] [2026-02-05T14:05:33.489Z] [ERROR] [API-5002] api failed after 1 attempts | DATA: {"error":"HTTP 500: {\"detail\":\"Collection expecting embedding with dimension of 384, got 1536\"}","url":"http://localhost:8000/rag/query"}
[api] [2026-02-05T14:05:33.490Z] [WARN] [API-5002] RAGClient: Query failed (skipping RAG) | DATA: {"error":"HTTP 500: {\"detail\":\"Collection expecting embedding with dimension of 384, got 1536\"}"}
[api] [ChatWorker] ℹ️ RAG: No relevant knowledge found in local base.
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml9j3ute002ut6yabc0oqzcr
[api] [2026-02-05T14:05:33.490Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:05:33.493Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:05:33.501Z] [INFO] [AI-6001][8ms] Timer finished: intent_parsing_25ca23d7 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"wallet_balance","highLevelIntent":"MARKET_ANALYSIS","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"MARKET_ANALYSIS","slotsComplete":false,"labels":[{"label":"MARKET_ANALYSIS","confidence":0.95},{"label":"PREDICTION_MARKETS","confidence":0.1414213562373095},{"label":"GENERAL_CHAT","confidence":0.1414213562373095}],"timerLabel":"intent_parsing_25ca23d7"}
[api] [2026-02-05T14:05:33.506Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:05:33.506Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml9j3ute002ut6yabc0oqzcr","sessionId":"cml9j3qw5002mt6yapggjr6tj","model":"deepseek-chat","intent":"MARKET_ANALYSIS","routingMode":"thinking","hardRule":{"label":"MARKET_ANALYSIS","reason":"question intent"},"confidence":0.95}
[api] [ChatWorker] Skill-gated to 26 tools for intent=MARKET_ANALYSIS skills=polymarket_prediction, token_analysis, wallet_portfolio, welcome_onboarding
[api] [2026-02-05T14:05:33.506Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml9j3ute002ut6yabc0oqzcr","sessionId":"cml9j3qw5002mt6yapggjr6tj","model":"deepseek-chat","intent":"MARKET_ANALYSIS","routingMode":"thinking","skillVersion":"clean","skills":["polymarket_prediction","token_analysis","wallet_portfolio","welcome_onboarding"],"toolCount":26}
[api] [2026-02-05T14:05:33.507Z] [INFO] [AI-6007] ChatWorker: early pre-fetch used client context | DATA: {"tool":"get_wallet_info"}
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
[api] [2026-02-05T14:05:33.509Z] [INFO] [AI-6003][1ms] Timer finished: prompt_gen_MARKET_ANALYSIS_deepseek | DATA: {"model":"deepseek","intent":"MARKET_ANALYSIS","length":2676,"timerLabel":"prompt_gen_MARKET_ANALYSIS_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (3 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:05:33.509Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:05:33.510Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1034}
[api] [2026-02-05T14:05:33.510Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9j3qx3002st6ya8od1bhxs. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:05:33.511Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:05:39.189Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Tokens for Solana are fresh, skipping API call
[api] [2026-02-05T14:05:45.288Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[python] INFO:moderation.router:Moderating output: Based on your connected wallet, here's your curren...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:65462 - "POST /moderation/output HTTP/1.1" 200 OK
[api] [2026-02-05T14:05:46.404Z] [INFO] [SYS-1007] Moderation Output check result | DATA: {"safe":true,"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] Broadcasting message_complete for cml9j3qx3002st6ya8od1bhxs
[api] [2026-02-05T14:05:46.420Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] [2026-02-05T14:05:46.427Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:05:46.428Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] {"level":30,"time":1770300346436,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65122},"msg":"incoming request"}
[api] {"level":30,"time":1770300346438,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","res":{"statusCode":204},"responseTime":0.7891250029206276,"msg":"request completed"}
[api] {"level":30,"time":1770300346439,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65125},"msg":"incoming request"}
[api] {"level":30,"time":1770300346439,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","res":{"statusCode":204},"responseTime":0.2486250028014183,"msg":"request completed"}
[api] {"level":30,"time":1770300346440,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","req":{"method":"GET","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65126},"msg":"incoming request"}
[api] {"level":30,"time":1770300346442,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","req":{"method":"GET","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65122},"msg":"incoming request"}
[api] {"level":30,"time":1770300346448,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","res":{"statusCode":200},"responseTime":6.1984580010175705,"msg":"request completed"}
[api] {"level":30,"time":1770300346448,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","res":{"statusCode":200},"responseTime":8.212167002260685,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:05:49.197Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770300357231,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65125},"msg":"incoming request"}
[api] {"level":30,"time":1770300357232,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","res":{"statusCode":204},"responseTime":0.5747499987483025,"msg":"request completed"}
[api] {"level":30,"time":1770300357233,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-u","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65122},"msg":"incoming request"}
[api] {"level":30,"time":1770300357233,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-u","res":{"statusCode":204},"responseTime":0.2397499978542328,"msg":"request completed"}
[api] {"level":30,"time":1770300357233,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-v","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65126},"msg":"incoming request"}
[api] {"level":30,"time":1770300357234,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-v","res":{"statusCode":204},"responseTime":0.18779200315475464,"msg":"request completed"}
[api] {"level":30,"time":1770300357234,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65125},"msg":"incoming request"}
[api] {"level":30,"time":1770300357236,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-x","req":{"method":"POST","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65122},"msg":"incoming request"}
[api] {"level":30,"time":1770300357237,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65126},"msg":"incoming request"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=Swap 3 usdc to matic...
[api] {"level":30,"time":1770300357253,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","res":{"statusCode":200},"responseTime":18.721957996487617,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:05:59.206Z] [INFO] [SYS-1001] No open positions to monitor
[api] [DBLock] Lock already held (valid) {
[api]   key: 'lock:tokenJob:refresh:base',
[api]   expiresAt: '2026-02-05T14:06:34.637Z',
[api]   ageMs: 205533
[api] }
[api] [TokenJob] Skipping refresh for Base - another instance holds the lock
[api] {"level":30,"time":1770300362570,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","res":{"statusCode":200},"responseTime":5332.437082998455,"msg":"request completed"}
[api] {"level":30,"time":1770300362575,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-z","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65125},"msg":"incoming request"}
[api] {"level":30,"time":1770300362576,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-z","res":{"statusCode":204},"responseTime":0.6397080048918724,"msg":"request completed"}
[api] {"level":30,"time":1770300362578,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-10","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65126},"msg":"incoming request"}
[api] {"level":30,"time":1770300362786,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-x","res":{"statusCode":200},"responseTime":5549.63991600275,"msg":"request completed"}
[api] {"level":30,"time":1770300362794,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-11","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65125},"msg":"incoming request"}
[api] {"level":30,"time":1770300362795,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-11","res":{"statusCode":204},"responseTime":0.41075000166893005,"msg":"request completed"}
[api] {"level":30,"time":1770300362797,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-12","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65122},"msg":"incoming request"}
[api] {"level":30,"time":1770300362802,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-12","res":{"statusCode":200},"responseTime":4.962999999523163,"msg":"request completed"}
[api] {"level":30,"time":1770300362822,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-13","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65125},"msg":"incoming request"}
[api] [2026-02-05T14:06:03.237Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:06:03.237Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:06:03.237Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: Swap 3 usdc to matic...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:49334 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-05T14:06:04.666Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:06:04.667Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml9j4hw10033t6yai1wd59fm
[api] [2026-02-05T14:06:04.667Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":137,"tokenCount":3,"hasNativeBalance":true}
[api] [ChatWorker] Base filtered to 46 tools for message: "Swap 3 usdc to matic..."
[api] [ChatWorker] 🔍 RAG check for: "Swap 3 usdc to matic..."
[api] [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml9j4m570035t6ya0jwq5gif
[api] [2026-02-05T14:06:04.667Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:06:04.670Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:06:04.672Z] [INFO] [AI-6001][2ms] Timer finished: intent_parsing_7c1426ac | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.44999999999999996},{"label":"PREDICTION_MARKETS","confidence":0.1414213562373095}],"timerLabel":"intent_parsing_7c1426ac"}
[api] [2026-02-05T14:06:04.678Z] [INFO] [AI-6001] Intent follow-up recorded | DATA: {"previousIntent":"MARKET_ANALYSIS","nextIntent":"TRADING","sessionId":"cml9j3qw5002mt6yapggjr6tj"}
[api] [2026-02-05T14:06:04.678Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:06:04.679Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml9j4m570035t6ya0jwq5gif","sessionId":"cml9j3qw5002mt6yapggjr6tj","model":"deepseek-chat","intent":"TRADING","routingMode":"execution","hardRule":{"label":"TRADING","reason":"action + slots complete"},"confidence":0.95}
[api] [ChatWorker] Skill-gated to 13 tools for intent=TRADING skills=cross_chain_swap, swap, token_alert, wallet_portfolio
[api] [2026-02-05T14:06:04.679Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml9j4m570035t6ya0jwq5gif","sessionId":"cml9j3qw5002mt6yapggjr6tj","model":"deepseek-chat","intent":"TRADING","routingMode":"execution","skillVersion":"exec","skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"],"toolCount":13}
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
[api] [2026-02-05T14:06:04.681Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":4,"skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"]}
[api] [2026-02-05T14:06:04.682Z] [INFO] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":13949,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (3 tokens cached)
[api] [2026-02-05T14:06:04.682Z] [INFO] [AI-6007] ChatWorker: requested token balance resolved | DATA: {"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":137,"requested":["USDC","MATIC"],"matched":["USDC","MATIC"],"missing":[],"resolvedBalances":{"USDC":"5.926982","MATIC":"20.6044348920309"}}
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:06:04.682Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:06:04.682Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1034}
[api] [2026-02-05T14:06:04.683Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-02-05T14:06:04.683Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":185}
[api] [2026-02-05T14:06:04.683Z] [INFO] [AI-6007] ChatWorker: balance system rule injected
[api] [ChatWorker] Broadcasting Thinking status for cml9j4hw10033t6yai1wd59fm. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:06:04.683Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] {"level":30,"time":1770300364755,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-10","res":{"statusCode":200},"responseTime":2176.745582997799,"msg":"request completed"}
[api] {"level":30,"time":1770300364918,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-13","res":{"statusCode":200},"responseTime":2095.4171250015497,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:06:09.216Z] [INFO] [SYS-1001] No open positions to monitor
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-02-05T14:06:13.486Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [DBLock] Lock already held (valid) {
[api]   key: 'lock:tokenJob:refresh:base',
[api]   expiresAt: '2026-02-05T14:06:34.637Z',
[api]   ageMs: 218849
[api] }
[api] [TokenJob] Skipping refresh for Base - another instance holds the lock
[api] [2026-02-05T14:06:13.493Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9j3qw5002mt6yapggjr6tj","messageId":"cml9j4hw10033t6yai1wd59fm","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T14:06:13.493Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"simulate_swap","sessionId":"cml9j3qw5002mt6yapggjr6tj","messageId":"cml9j4hw10033t6yai1wd59fm","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:06:13.494Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] {"level":30,"time":1770300373500,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-14","req":{"method":"POST","url":"/api/swap/quote","hostname":"127.0.0.1:3001","remoteAddress":"127.0.0.1","remotePort":49381},"msg":"incoming request"}
[api] [Swap Quote] Fetching metadata for: {
[api]   tokenInForMetadata: '0x3c499c542c',
[api]   tokenOutForMetadata: '0x0d500B1d8E',
[api]   actualTokenIn: '0x3c499c542c',
[api]   actualTokenOut: '0xEeeeeEeeeE',
[api]   isTokenOutNative: true
[api] }
[api] [2026-02-05T14:06:14.730Z] [INFO] [API-5001][TID:c450acfd-ddfd-4486-98b6-45b4aa57f5ff] Using 0x API fallback token metadata | DATA: {"symbol":"WMATIC","chainId":137}
[api] [2026-02-05T14:06:14.731Z] [INFO] [API-5001][TID:c450acfd-ddfd-4486-98b6-45b4aa57f5ff] No token metadata available, trying RPC fallback... | DATA: {"tokenAddress":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","chainId":137}
[api] [Swap Quote] Overriding tokenIn decimals to known value: 6
[api] [Swap Quote] Token decimals: {
[api]   tokenIn: '0x3c499c54',
[api]   tokenOut: '0xEeeeeEee',
[api]   tokenInDecimals: 6,
[api]   tokenOutDecimals: 18,
[api]   tokenOutMetadataDecimals: 18
[api] }
[api] [2026-02-05T14:06:15.961Z] [INFO] [API-5001][TID:c450acfd-ddfd-4486-98b6-45b4aa57f5ff] Using 0x API fallback token metadata | DATA: {"symbol":"USDC","chainId":137}
[api] [2026-02-05T14:06:16.469Z] [INFO] [API-5001][TID:c450acfd-ddfd-4486-98b6-45b4aa57f5ff] 0x API price received successfully | DATA: {"sellToken":"0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270","buyToken":"0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174","chainId":137,"liquidityAvailable":true}
[api] [PlatformFee] Fees DISABLED, returning 0 bps
[api] [Kyber] GET routes {
[api]   routesUrl: 'https://aggregator-api.kyberswap.com/polygon/api/v1/routes?tokenIn=0x3c499c542cef5e3811e1192ce70d8cc03d5c3359&tokenOut=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&amountIn=3000000&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] [2026-02-05T14:06:16.996Z] [INFO] [API-5001][TID:c450acfd-ddfd-4486-98b6-45b4aa57f5ff] 0x API Quote received successfully | DATA: {"sellToken":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","buyToken":"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE","buyAmount":"29216914554693180364","usedEndpoint":"allowance-holder"}
[api] [2026-02-05T14:06:16.997Z] [INFO] [API-5001][TID:c450acfd-ddfd-4486-98b6-45b4aa57f5ff] 0x API Quote successful | DATA: {"sellToken":"0x3c499c542c","buyToken":"0xEeeeeEeeeE","buyAmount":"29216914554693180364","hasAllowanceIssue":true,"usedEndpoint":"allowance-holder"}
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 3,
[api]   amountOut: 29.21691455469318,
[api]   quotePrice: 9.73897151823106,
[api]   refPrice: 9.753242953281967,
[api]   tokenInUsd: 'available',
[api]   impact: -0.14632502357696084,
[api]   formula: '((9.73897151823106 - 9.753242953281967) / 9.753242953281967) * 100 = -0.14632502357696084'
[api] }
[api] [QuoteService] 0x API estimatedPriceImpact: {
[api]   raw: undefined,
[api]   parsed: 0,
[api]   multipliedBy100: 0,
[api]   impactVsMkt: -0.14632502357696084,
[api]   willUse: -0.14632502357696084
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
[api]   deadline: 1770300978,
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
[api]   amountOut: 29.26118158400596,
[api]   quotePrice: 9.753727194668654,
[api]   refPrice: 9.753242953281967,
[api]   tokenInUsd: 'available',
[api]   impact: 0.004964926937699658,
[api]   formula: '((9.753727194668654 - 9.753242953281967) / 9.753242953281967) * 100 = 0.004964926937699658'
[api] }
[api] [QuoteService] Quote comparison: {
[api]   '0x_amount': '29.216914554693180364',
[api]   kyber_amount: '29.26118158400595968',
[api]   kyber_advantage_pct: '0.00',
[api]   chainId: 137
[api] }
[api] [QuoteService] Preferring 0x for reliability { reason: 'prices within 2%', percentDiff: '0.00' }
[api] {"level":30,"time":1770300378993,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-14","res":{"statusCode":200},"responseTime":5493.425750002265,"msg":"request completed"}
[api] [2026-02-05T14:06:18.995Z] [INFO] [AI-6007][5502ms] ChatWorker: tool success | DATA: {"tool":"simulate_swap","sessionId":"cml9j3qw5002mt6yapggjr6tj","messageId":"cml9j4hw10033t6yai1wd59fm","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] DeepSeek iteration 2/10 for task cml9j4m570035t6ya0jwq5gif
[api] [2026-02-05T14:06:19.001Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:06:19.004Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:06:19.006Z] [INFO] [AI-6001][2ms] Timer finished: intent_parsing_9625ed15 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.44999999999999996},{"label":"PREDICTION_MARKETS","confidence":0.1414213562373095}],"timerLabel":"intent_parsing_9625ed15"}
[api] [2026-02-05T14:06:19.007Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
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
[api] [2026-02-05T14:06:19.008Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":4,"skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"]}
[api] [2026-02-05T14:06:19.008Z] [INFO] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":13949,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (3 tokens cached)
[api] [2026-02-05T14:06:19.009Z] [INFO] [AI-6007] ChatWorker: requested token balance resolved | DATA: {"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":137,"requested":["USDC","MATIC"],"matched":["USDC","MATIC"],"missing":[],"resolvedBalances":{"USDC":"5.926982","MATIC":"20.6044348920309"}}
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:06:19.009Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:06:19.009Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1034}
[api] [2026-02-05T14:06:19.010Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-02-05T14:06:19.010Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":185}
[api] [2026-02-05T14:06:19.010Z] [INFO] [AI-6007] ChatWorker: balance system rule injected
[api] [ChatWorker] Broadcasting Thinking status for cml9j4hw10033t6yai1wd59fm. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:06:19.010Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:06:19.223Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:06:24.093Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [2026-02-05T14:06:26.607Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[python] INFO:moderation.router:Moderating output: I'll help you swap 3 USDC to MATIC on Polygon. Let...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:49627 - "POST /moderation/output HTTP/1.1" 200 OK
[api] [2026-02-05T14:06:27.955Z] [INFO] [SYS-1007] Moderation Output check result | DATA: {"safe":true,"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] Broadcasting message_complete for cml9j4hw10033t6yai1wd59fm
[api] [2026-02-05T14:06:27.967Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] [2026-02-05T14:06:27.971Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:06:27.972Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] {"level":30,"time":1770300387982,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-15","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65122},"msg":"incoming request"}
[api] {"level":30,"time":1770300387983,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-15","res":{"statusCode":204},"responseTime":0.5055830031633377,"msg":"request completed"}
[api] {"level":30,"time":1770300387983,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-16","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65126},"msg":"incoming request"}
[api] {"level":30,"time":1770300387983,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-16","res":{"statusCode":204},"responseTime":0.15983299911022186,"msg":"request completed"}
[api] {"level":30,"time":1770300387986,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-17","req":{"method":"GET","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65125},"msg":"incoming request"}
[api] {"level":30,"time":1770300387987,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-18","req":{"method":"GET","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65122},"msg":"incoming request"}
[api] {"level":30,"time":1770300387994,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-18","res":{"statusCode":200},"responseTime":6.682540997862816,"msg":"request completed"}
[api] {"level":30,"time":1770300387994,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-17","res":{"statusCode":200},"responseTime":8.479083001613617,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:06:29.231Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
[api] [2026-02-05T14:06:30.184Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"bsc","limit":100}
[api] [2026-02-05T14:06:31.696Z] [INFO] [WTC-2002] WS addresses discovered | DATA: {"wsCount":196,"chain":"bsc"}
[api] [2026-02-05T14:06:32.958Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"ihuk","creator":"0xe9d14876e8281bc6a4772adbcfc47f3c35aac1f4"}
[api] [2026-02-05T14:06:33.343Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"biscc","creator":"0x94cd85d73abcff32c8b283cca84c205d2fd6161c"}
[api] [2026-02-05T14:06:33.706Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"gitq","creator":"0xf755a93a00bc69acd22c08a77e55479dfb02a217"}
[api] [2026-02-05T14:06:34.082Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"kbln","creator":"0x0e284a0872bba9b82c7a8a9d354afd80a4892057"}
[api] [2026-02-05T14:06:34.502Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"zpuj","creator":"0xad9dc0eb8b0bda4afeb5b5febd194e1f3ff10eed"}
[api] [2026-02-05T14:06:34.880Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"aero_d2f9","creator":"0x0d9a0fe1d4513e149eaf2663d27a629983856587"}
[api] [2026-02-05T14:06:35.254Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"lcqq","creator":"0xd384e4bfb3b583cd8a186c4435e4175be0474e66"}
[api] [2026-02-05T14:06:35.674Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"okqaq","creator":"0xb694277ce46009941d7324b8da10c0e658d1a3e9"}
[api] [2026-02-05T14:06:35.971Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":33,"limit":200}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:06:39.238Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770300399278,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-19","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65126},"msg":"incoming request"}
[api] {"level":30,"time":1770300399279,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-19","res":{"statusCode":204},"responseTime":0.6205419972538948,"msg":"request completed"}
[api] {"level":30,"time":1770300399279,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1a","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65122},"msg":"incoming request"}
[api] {"level":30,"time":1770300399279,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1a","res":{"statusCode":204},"responseTime":0.13324999809265137,"msg":"request completed"}
[api] {"level":30,"time":1770300399279,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1b","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65125},"msg":"incoming request"}
[api] {"level":30,"time":1770300399280,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1b","res":{"statusCode":204},"responseTime":0.11908300220966339,"msg":"request completed"}
[api] {"level":30,"time":1770300399280,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1c","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65126},"msg":"incoming request"}
[api] {"level":30,"time":1770300399282,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1d","req":{"method":"POST","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65122},"msg":"incoming request"}
[api] {"level":30,"time":1770300399283,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1e","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65125},"msg":"incoming request"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=Proceed...
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   userIdLength: 35,
[api]   userIdPrefix: 'did:privy:cmj0a3j3f0',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] {"level":30,"time":1770300399286,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1c","res":{"statusCode":200},"responseTime":5.977333001792431,"msg":"request completed"}
[api] [verifyAccess] ✅ Access granted
[api] [2026-02-05T14:06:40.921Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T14:06:42.162Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [TokenJob] Skipping refresh for BSC - update already in progress
[api] [TokenJob] Refreshed 4 primary chains in 109.4s
[api] {"level":30,"time":1770300404291,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1d","res":{"statusCode":200},"responseTime":5009.234999999404,"msg":"request completed"}
[api] {"level":30,"time":1770300404298,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1f","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65126},"msg":"incoming request"}
[api] {"level":30,"time":1770300404299,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1f","res":{"statusCode":204},"responseTime":0.2844169959425926,"msg":"request completed"}
[api] {"level":30,"time":1770300404301,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1g","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65122},"msg":"incoming request"}
[api] {"level":30,"time":1770300404307,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1g","res":{"statusCode":200},"responseTime":6.34850000590086,"msg":"request completed"}
[api] {"level":30,"time":1770300404323,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1h","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65126},"msg":"incoming request"}
[api] {"level":30,"time":1770300404323,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1h","res":{"statusCode":204},"responseTime":0.23925000429153442,"msg":"request completed"}
[api] {"level":30,"time":1770300404324,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1i","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65122},"msg":"incoming request"}
[api] [2026-02-05T14:06:44.402Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] {"level":30,"time":1770300404448,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1e","res":{"statusCode":200},"responseTime":5164.664875000715,"msg":"request completed"}
[api] {"level":30,"time":1770300404455,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1j","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65126},"msg":"incoming request"}
[api] {"level":30,"time":1770300404455,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1j","res":{"statusCode":204},"responseTime":0.26316700130701065,"msg":"request completed"}
[api] {"level":30,"time":1770300404457,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1k","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65125},"msg":"incoming request"}
[api] [ChatWorker] Sanitizing orphaned tool_calls from message 3 (missing 1 tool results)
[api] [2026-02-05T14:06:45.285Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:06:45.285Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:06:45.285Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: Proceed...
[api] {"level":30,"time":1770300406581,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1i","res":{"statusCode":200},"responseTime":2255.906874999404,"msg":"request completed"}
[api] {"level":30,"time":1770300406584,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1k","res":{"statusCode":200},"responseTime":2126.38287499547,"msg":"request completed"}
[api] {"level":30,"time":1770300406586,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1l","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":65126},"msg":"incoming request"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:49844 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-05T14:06:46.677Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:06:46.679Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml9j5ebn003et6yaxufaaoty
[api] [2026-02-05T14:06:46.679Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":137,"tokenCount":4,"hasNativeBalance":true}
[api] [ChatWorker] Base filtered to 46 tools for message: "Proceed..."
[api] [ChatWorker] 🔍 RAG check for: "Proceed..."
[api] [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml9j5i64003gt6yakm5ncwdc
[api] [2026-02-05T14:06:46.679Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:06:46.682Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:06:46.690Z] [INFO] [AI-6001][7ms] Timer finished: intent_parsing_88b7a854 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"general_query","highLevelIntent":"GENERAL_CHAT","hasAI":false,"confidence":0.7,"routingStage":"hybrid","slotsComplete":false,"labels":[{"label":"GENERAL_CHAT","confidence":0.7},{"label":"TRADING","confidence":0.2},{"label":"MARKET_ANALYSIS","confidence":0.2}],"timerLabel":"intent_parsing_88b7a854"}
[api] [2026-02-05T14:06:46.696Z] [INFO] [AI-6001] Intent follow-up recorded | DATA: {"previousIntent":"TRADING","nextIntent":"GENERAL_CHAT","sessionId":"cml9j3qw5002mt6yapggjr6tj"}
[api] [2026-02-05T14:06:46.696Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:06:46.696Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml9j5i64003gt6yakm5ncwdc","sessionId":"cml9j3qw5002mt6yapggjr6tj","model":"deepseek-chat","intent":"GENERAL_CHAT","routingMode":"thinking","confidence":0.7}
[api] [ChatWorker] Skill-gated to 26 tools for intent=GENERAL_CHAT skills=polymarket_prediction, token_analysis, wallet_portfolio, welcome_onboarding
[api] [2026-02-05T14:06:46.696Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml9j5i64003gt6yakm5ncwdc","sessionId":"cml9j3qw5002mt6yapggjr6tj","model":"deepseek-chat","intent":"GENERAL_CHAT","routingMode":"thinking","skillVersion":"clean","skills":["polymarket_prediction","token_analysis","wallet_portfolio","welcome_onboarding"],"toolCount":26}
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
[api] [2026-02-05T14:06:46.697Z] [INFO] [AI-6003] Timer finished: prompt_gen_GENERAL_CHAT_deepseek | DATA: {"model":"deepseek","intent":"GENERAL_CHAT","length":2676,"timerLabel":"prompt_gen_GENERAL_CHAT_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (4 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:06:46.697Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:06:46.697Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1089}
[api] [2026-02-05T14:06:46.697Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9j5ebn003et6yaxufaaoty. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:06:46.697Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] {"level":30,"time":1770300408103,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1l","res":{"statusCode":200},"responseTime":1516.9013329967856,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:06:49.244Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:06:50.090Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"bsc","error":"GeckoTerminal backoff active (55s remaining)"}
[api] [2026-02-05T14:06:50.091Z] [INFO] [API-5001][19907ms] Premium trending tokens fetch complete | DATA: {"count":75,"chain":"bsc","source":"WebSocket","wsOriginal":196}
[api] [TokenJob] Got 75 trending tokens for BSC
[api] Saved 75 trending tokens for bsc to database and memory cache
[api] [TokenJob] Saved 75 tokens for BSC to DB + cache
[api] [TokenJob] Refreshed 4 primary chains in 110.0s
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [SocialJob] Checking Zora coin status for 45 casts...
[api] [2026-02-05T14:06:54.338Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T14:06:54.341Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9j3qw5002mt6yapggjr6tj","messageId":"cml9j5ebn003et6yaxufaaoty","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T14:06:54.341Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"external_web_search","sessionId":"cml9j3qw5002mt6yapggjr6tj","messageId":"cml9j5ebn003et6yaxufaaoty","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:06:54.342Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:06:56.806Z] [INFO] [SYS-1007] Tavily search completed | DATA: {"query":"USDC Polygon contract address 0x3c499c542cef5e3811e1192ce70d8cc03d5c3359 swap router approval","count":3}
[api] [2026-02-05T14:06:56.807Z] [INFO] [AI-6007][2466ms] ChatWorker: tool success | DATA: {"tool":"external_web_search","sessionId":"cml9j3qw5002mt6yapggjr6tj","messageId":"cml9j5ebn003et6yaxufaaoty","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:06:56.807Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_citations | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"citations","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_citations"}
[api] [ChatWorker] DeepSeek iteration 2/10 for task cml9j5i64003gt6yakm5ncwdc
[api] [2026-02-05T14:06:56.812Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:06:56.815Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:06:56.817Z] [INFO] [AI-6001][2ms] Timer finished: intent_parsing_aa2c97ee | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"general_query","highLevelIntent":"GENERAL_CHAT","hasAI":false,"confidence":0.7,"routingStage":"hybrid","slotsComplete":false,"labels":[{"label":"GENERAL_CHAT","confidence":0.7},{"label":"TRADING","confidence":0.2},{"label":"MARKET_ANALYSIS","confidence":0.2}],"timerLabel":"intent_parsing_aa2c97ee"}
[api] [2026-02-05T14:06:56.817Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
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
[api] [2026-02-05T14:06:56.818Z] [INFO] [AI-6003] Timer finished: prompt_gen_GENERAL_CHAT_deepseek | DATA: {"model":"deepseek","intent":"GENERAL_CHAT","length":2676,"timerLabel":"prompt_gen_GENERAL_CHAT_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (4 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:06:56.819Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:06:56.819Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1089}
[api] [2026-02-05T14:06:56.820Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9j5ebn003et6yaxufaaoty. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:06:56.821Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:06:59.036Z] [INFO] [SOC-7001][157ms] Timer finished: get_trending_casts_trending | DATA: {"timeRange":"trending","limit":500,"offset":0,"count":500,"fromCache":false,"timerLabel":"get_trending_casts_trending"}
[api] [2026-02-05T14:06:59.077Z] [INFO] [SOC-7003] SocialRepo: Updated cache with 500 merged casts
[api] [2026-02-05T14:06:59.077Z] [INFO] [SOC-7003] SocialRepo: Saved 45 trending casts to database
[api] [2026-02-05T14:06:59.077Z] [INFO] [SOC-7003][403ms] Timer finished: save_trending_casts | DATA: {"count":45,"timerLabel":"save_trending_casts"}
[api] [SocialJob] Casts refreshed: 45 saved
[api] [SocialJob] 🚀 Triggering OGP Prefetch for top 45 casts...
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:06:59.249Z] [INFO] [SYS-1001] No open positions to monitor
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-02-05T14:07:01.162Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T14:07:01.172Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9j3qw5002mt6yapggjr6tj","messageId":"cml9j5ebn003et6yaxufaaoty","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T14:07:01.173Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"get_token_price","sessionId":"cml9j3qw5002mt6yapggjr6tj","messageId":"cml9j5ebn003et6yaxufaaoty","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:07:01.173Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [GetTokenPrice] Fetching price for MATIC (isAddress: false)...
[api] [2026-02-05T14:07:02.321Z] [INFO] [AI-6007][1147ms] ChatWorker: tool success | DATA: {"tool":"get_token_price","sessionId":"cml9j3qw5002mt6yapggjr6tj","messageId":"cml9j5ebn003et6yaxufaaoty","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] DeepSeek iteration 3/10 for task cml9j5i64003gt6yakm5ncwdc
[api] [2026-02-05T14:07:02.324Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:07:02.326Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:07:02.327Z] [INFO] [AI-6001][1ms] Timer finished: intent_parsing_c2b17d88 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"general_query","highLevelIntent":"GENERAL_CHAT","hasAI":false,"confidence":0.7,"routingStage":"hybrid","slotsComplete":false,"labels":[{"label":"GENERAL_CHAT","confidence":0.7},{"label":"TRADING","confidence":0.2},{"label":"MARKET_ANALYSIS","confidence":0.2}],"timerLabel":"intent_parsing_c2b17d88"}
[api] [2026-02-05T14:07:02.327Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
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
[api] [2026-02-05T14:07:02.328Z] [INFO] [AI-6003] Timer finished: prompt_gen_GENERAL_CHAT_deepseek | DATA: {"model":"deepseek","intent":"GENERAL_CHAT","length":2676,"timerLabel":"prompt_gen_GENERAL_CHAT_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (4 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:07:02.328Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:07:02.328Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1089}
[api] [2026-02-05T14:07:02.329Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9j5ebn003et6yaxufaaoty. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:07:02.329Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-02-05T14:07:06.388Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T14:07:06.393Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9j3qw5002mt6yapggjr6tj","messageId":"cml9j5ebn003et6yaxufaaoty","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T14:07:06.393Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"get_token_price","sessionId":"cml9j3qw5002mt6yapggjr6tj","messageId":"cml9j5ebn003et6yaxufaaoty","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:07:06.393Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [GetTokenPrice] Fetching price for USDC (isAddress: false)...
[api] [2026-02-05T14:07:07.555Z] [INFO] [AI-6007][1162ms] ChatWorker: tool success | DATA: {"tool":"get_token_price","sessionId":"cml9j3qw5002mt6yapggjr6tj","messageId":"cml9j5ebn003et6yaxufaaoty","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] DeepSeek iteration 4/10 for task cml9j5i64003gt6yakm5ncwdc
[api] [2026-02-05T14:07:07.559Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:07:07.563Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:07:07.564Z] [INFO] [AI-6001] Timer finished: intent_parsing_35eb5ae8 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"general_query","highLevelIntent":"GENERAL_CHAT","hasAI":false,"confidence":0.7,"routingStage":"hybrid","slotsComplete":false,"labels":[{"label":"GENERAL_CHAT","confidence":0.7},{"label":"TRADING","confidence":0.2},{"label":"MARKET_ANALYSIS","confidence":0.2}],"timerLabel":"intent_parsing_35eb5ae8"}
[api] [2026-02-05T14:07:07.565Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
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
[api] [2026-02-05T14:07:07.565Z] [INFO] [AI-6003] Timer finished: prompt_gen_GENERAL_CHAT_deepseek | DATA: {"model":"deepseek","intent":"GENERAL_CHAT","length":2676,"timerLabel":"prompt_gen_GENERAL_CHAT_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (4 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:07:07.566Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:07:07.566Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1089}
[api] [2026-02-05T14:07:07.566Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9j5ebn003et6yaxufaaoty. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:07:07.567Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:07:09.258Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:07:17.466Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[python] INFO:moderation.router:Moderating output: I'll help you proceed with the swap. Let me first ...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:50011 - "POST /moderation/output HTTP/1.1" 200 OK
[api] [2026-02-05T14:07:18.804Z] [INFO] [SYS-1007] Moderation Output check result | DATA: {"safe":true,"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] Broadcasting message_complete for cml9j5ebn003et6yaxufaaoty
[api] [2026-02-05T14:07:18.818Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] [2026-02-05T14:07:18.821Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:07:18.821Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] {"level":30,"time":1770300438837,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1m","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50023},"msg":"incoming request"}
[api] {"level":30,"time":1770300438838,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1m","res":{"statusCode":204},"responseTime":0.3801250010728836,"msg":"request completed"}
[api] {"level":30,"time":1770300438838,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1n","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50024},"msg":"incoming request"}
[api] {"level":30,"time":1770300438838,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1n","res":{"statusCode":204},"responseTime":0.11970799416303635,"msg":"request completed"}
[api] {"level":30,"time":1770300438840,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1o","req":{"method":"GET","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50023},"msg":"incoming request"}
[api] {"level":30,"time":1770300438841,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1p","req":{"method":"GET","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50024},"msg":"incoming request"}
[api] {"level":30,"time":1770300438847,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1p","res":{"statusCode":200},"responseTime":6.191208004951477,"msg":"request completed"}
[api] {"level":30,"time":1770300438848,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1o","res":{"statusCode":200},"responseTime":8.13612499833107,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:07:19.268Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:07:24.094Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] {"level":30,"time":1770300444937,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1q","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50024},"msg":"incoming request"}
[api] {"level":30,"time":1770300444938,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1q","res":{"statusCode":204},"responseTime":0.5574589967727661,"msg":"request completed"}
[api] {"level":30,"time":1770300444938,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1r","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50023},"msg":"incoming request"}
[api] {"level":30,"time":1770300444939,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1r","res":{"statusCode":204},"responseTime":0.35062500089406967,"msg":"request completed"}
[api] {"level":30,"time":1770300444939,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1s","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50043},"msg":"incoming request"}
[api] {"level":30,"time":1770300444940,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1s","res":{"statusCode":204},"responseTime":0.30079200118780136,"msg":"request completed"}
[api] {"level":30,"time":1770300444941,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1t","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50024},"msg":"incoming request"}
[api] {"level":30,"time":1770300444945,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1u","req":{"method":"POST","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50023},"msg":"incoming request"}
[api] {"level":30,"time":1770300444946,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1v","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50043},"msg":"incoming request"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=Confirm...
[api] {"level":30,"time":1770300444952,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1t","res":{"statusCode":200},"responseTime":11.326040998101234,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:07:29.276Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770300450637,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1u","res":{"statusCode":200},"responseTime":5691.904458999634,"msg":"request completed"}
[api] {"level":30,"time":1770300450644,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1w","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50024},"msg":"incoming request"}
[api] {"level":30,"time":1770300450644,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1w","res":{"statusCode":204},"responseTime":0.3708749935030937,"msg":"request completed"}
[api] {"level":30,"time":1770300450647,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1x","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50023},"msg":"incoming request"}
[api] {"level":30,"time":1770300450652,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1v","res":{"statusCode":200},"responseTime":5705.575583003461,"msg":"request completed"}
[api] {"level":30,"time":1770300450654,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1x","res":{"statusCode":200},"responseTime":6.702124997973442,"msg":"request completed"}
[api] {"level":30,"time":1770300450663,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1y","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50024},"msg":"incoming request"}
[api] {"level":30,"time":1770300450664,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1y","res":{"statusCode":204},"responseTime":0.3391660004854202,"msg":"request completed"}
[api] {"level":30,"time":1770300450665,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1z","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50043},"msg":"incoming request"}
[api] {"level":30,"time":1770300450672,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-20","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50023},"msg":"incoming request"}
[api] {"level":30,"time":1770300452961,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1z","res":{"statusCode":200},"responseTime":2295.875416994095,"msg":"request completed"}
[api] {"level":30,"time":1770300453008,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-20","res":{"statusCode":200},"responseTime":2336.477582998574,"msg":"request completed"}
[api] [ChatWorker] Sanitizing orphaned tool_calls from message 3 (missing 1 tool results)
[api] [ChatWorker] Sanitizing orphaned tool_calls from message 5 (missing 1 tool results)
[api] [2026-02-05T14:07:33.330Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:07:33.331Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:07:33.331Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: Confirm...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:50110 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-05T14:07:34.430Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:07:34.431Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml9j6dk3005ut6yala9wr064
[api] [2026-02-05T14:07:34.431Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":137,"tokenCount":4,"hasNativeBalance":true}
[api] [ChatWorker] Base filtered to 46 tools for message: "Confirm..."
[api] [ChatWorker] 🔍 RAG check for: "Confirm..."
[api] [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml9j6hxk005wt6yaopibjysx
[api] [2026-02-05T14:07:34.431Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:07:34.433Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:07:37.405Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"bitcoinreserve","creator":"0x00c5c88b46815fe06f4e80d4fe1a8a87371d7cc6"}
[api] [2026-02-05T14:07:37.831Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"lwtz","creator":"0xfee07eb185ad44bc967e2e6d52e08591c679ba84"}
[api] [2026-02-05T14:07:38.223Z] [INFO] [AI-6001][3789ms] Timer finished: intent_parsing_4752a1d7 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"general_query","highLevelIntent":"GENERAL_CHAT","hasAI":true,"confidence":0.3,"routingStage":"hybrid","conflict":"multi","slotsComplete":false,"labels":[{"label":"GENERAL_CHAT","confidence":0.3},{"label":"RISK_SCAN","confidence":0.23094010767585035},{"label":"TRADING","confidence":0}],"timerLabel":"intent_parsing_4752a1d7"}
[api] [2026-02-05T14:07:38.230Z] [INFO] [AI-6001] Intent follow-up recorded | DATA: {"previousIntent":"GENERAL_CHAT","nextIntent":"GENERAL_CHAT","sessionId":"cml9j3qw5002mt6yapggjr6tj"}
[api] [2026-02-05T14:07:38.230Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:07:38.230Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml9j6hxk005wt6yaopibjysx","sessionId":"cml9j3qw5002mt6yapggjr6tj","model":"deepseek-chat","intent":"GENERAL_CHAT","routingMode":"thinking","confidence":0.3}
[api] [ChatWorker] Skill-gated to 26 tools for intent=GENERAL_CHAT skills=polymarket_prediction, token_analysis, wallet_portfolio, welcome_onboarding
[api] [2026-02-05T14:07:38.230Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml9j6hxk005wt6yaopibjysx","sessionId":"cml9j3qw5002mt6yapggjr6tj","model":"deepseek-chat","intent":"GENERAL_CHAT","routingMode":"thinking","skillVersion":"clean","skills":["polymarket_prediction","token_analysis","wallet_portfolio","welcome_onboarding"],"toolCount":26}
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
[api] [2026-02-05T14:07:38.231Z] [INFO] [AI-6003] Timer finished: prompt_gen_GENERAL_CHAT_deepseek | DATA: {"model":"deepseek","intent":"GENERAL_CHAT","length":2676,"timerLabel":"prompt_gen_GENERAL_CHAT_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (4 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:07:38.231Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:07:38.231Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1089}
[api] [2026-02-05T14:07:38.231Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9j6dk3005ut6yala9wr064. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:07:38.232Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:07:38.318Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"nbtrl","creator":"0x3e54e17136f06a07e133159b44a6f26447ef22f9"}
[api] [2026-02-05T14:07:38.748Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"lapisquartz","creator":"0xad91455439519828e40609b3a4f1ad356cc89be4"}
[api] [2026-02-05T14:07:39.158Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"lgjva","creator":"0xe305286e0584875935cfde05c13bfeb55c15e19b"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:07:39.282Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:07:39.621Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"wlhlm","creator":"0x41e3f1e14d49b3066ca729d4eb7d95e650fb8c98"}
[api] [2026-02-05T14:07:40.116Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"iwtd","creator":"0xa599e11ae9debb53f0d463f27f6106618a72c97d"}
[api] [2026-02-05T14:07:40.652Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"ibotw","creator":"0xdd552c1b98d7344692f701c33ce96c42a90c9a74"}
[api] [2026-02-05T14:07:41.057Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"gdizu","creator":"0xfde9f7c80a3234ff15381dd325a1e4e79fa7f2bf"}
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-02-05T14:07:45.177Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T14:07:45.183Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9j3qw5002mt6yapggjr6tj","messageId":"cml9j6dk3005ut6yala9wr064","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T14:07:45.183Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"external_web_search","sessionId":"cml9j3qw5002mt6yapggjr6tj","messageId":"cml9j6dk3005ut6yala9wr064","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:07:45.183Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:07:47.654Z] [INFO] [SYS-1007] Tavily search completed | DATA: {"query":"Polygon USDC to MATIC swap rate current price 2026 February","count":3}
[api] [2026-02-05T14:07:47.654Z] [INFO] [AI-6007][2471ms] ChatWorker: tool success | DATA: {"tool":"external_web_search","sessionId":"cml9j3qw5002mt6yapggjr6tj","messageId":"cml9j6dk3005ut6yala9wr064","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:07:47.655Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_citations | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"citations","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_citations"}
[api] [ChatWorker] DeepSeek iteration 2/10 for task cml9j6hxk005wt6yaopibjysx
[api] [2026-02-05T14:07:47.662Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:07:47.664Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:07:49.292Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:07:52.592Z] [INFO] [AI-6001][4927ms] Timer finished: intent_parsing_942912d4 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"general_query","highLevelIntent":"GENERAL_CHAT","hasAI":true,"confidence":0.3,"routingStage":"hybrid","conflict":"multi","slotsComplete":false,"labels":[{"label":"GENERAL_CHAT","confidence":0.3},{"label":"RISK_SCAN","confidence":0.23094010767585035},{"label":"TRADING","confidence":0}],"timerLabel":"intent_parsing_942912d4"}
[api] [2026-02-05T14:07:52.593Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
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
[api] [2026-02-05T14:07:52.593Z] [INFO] [AI-6003] Timer finished: prompt_gen_GENERAL_CHAT_deepseek | DATA: {"model":"deepseek","intent":"GENERAL_CHAT","length":2676,"timerLabel":"prompt_gen_GENERAL_CHAT_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (4 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:07:52.594Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:07:52.594Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1089}
[api] [2026-02-05T14:07:52.594Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9j6dk3005ut6yala9wr064. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:07:52.595Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-02-05T14:07:57.375Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T14:07:57.391Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9j3qw5002mt6yapggjr6tj","messageId":"cml9j6dk3005ut6yala9wr064","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T14:07:57.391Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"get_token_price","sessionId":"cml9j3qw5002mt6yapggjr6tj","messageId":"cml9j6dk3005ut6yala9wr064","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:07:57.391Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [GetTokenPrice] Fetching price for MATIC (isAddress: false)...
[api] [2026-02-05T14:07:58.543Z] [INFO] [AI-6007][1152ms] ChatWorker: tool success | DATA: {"tool":"get_token_price","sessionId":"cml9j3qw5002mt6yapggjr6tj","messageId":"cml9j6dk3005ut6yala9wr064","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] DeepSeek iteration 3/10 for task cml9j6hxk005wt6yaopibjysx
[api] [2026-02-05T14:07:58.549Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:07:58.551Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:07:59.300Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:08:01.179Z] [INFO] [AI-6001][2628ms] Timer finished: intent_parsing_d8bf9191 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"general_query","highLevelIntent":"GENERAL_CHAT","hasAI":true,"confidence":0.3,"routingStage":"hybrid","conflict":"multi","slotsComplete":false,"labels":[{"label":"GENERAL_CHAT","confidence":0.3},{"label":"RISK_SCAN","confidence":0.23094010767585035},{"label":"TRADING","confidence":0}],"timerLabel":"intent_parsing_d8bf9191"}
[api] [2026-02-05T14:08:01.179Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
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
[api] [2026-02-05T14:08:01.180Z] [INFO] [AI-6003] Timer finished: prompt_gen_GENERAL_CHAT_deepseek | DATA: {"model":"deepseek","intent":"GENERAL_CHAT","length":2676,"timerLabel":"prompt_gen_GENERAL_CHAT_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (4 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:08:01.180Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:08:01.181Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1089}
[api] [2026-02-05T14:08:01.181Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9j6dk3005ut6yala9wr064. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:08:01.181Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-02-05T14:08:05.544Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T14:08:05.550Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9j3qw5002mt6yapggjr6tj","messageId":"cml9j6dk3005ut6yala9wr064","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T14:08:05.551Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"get_token_price","sessionId":"cml9j3qw5002mt6yapggjr6tj","messageId":"cml9j6dk3005ut6yala9wr064","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T14:08:05.551Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [GetTokenPrice] Fetching price for USDC (isAddress: false)...
[api] [2026-02-05T14:08:06.776Z] [INFO] [AI-6007][1225ms] ChatWorker: tool success | DATA: {"tool":"get_token_price","sessionId":"cml9j3qw5002mt6yapggjr6tj","messageId":"cml9j6dk3005ut6yala9wr064","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] DeepSeek iteration 4/10 for task cml9j6hxk005wt6yaopibjysx
[api] [2026-02-05T14:08:06.781Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:08:06.783Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:08:09.309Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:08:09.946Z] [INFO] [AI-6001][3163ms] Timer finished: intent_parsing_26444096 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"general_query","highLevelIntent":"GENERAL_CHAT","hasAI":true,"confidence":0.3,"routingStage":"hybrid","conflict":"multi","slotsComplete":false,"labels":[{"label":"GENERAL_CHAT","confidence":0.3},{"label":"RISK_SCAN","confidence":0.23094010767585035},{"label":"TRADING","confidence":0}],"timerLabel":"intent_parsing_26444096"}
[api] [2026-02-05T14:08:09.947Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
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
[api] [2026-02-05T14:08:09.947Z] [INFO] [AI-6003] Timer finished: prompt_gen_GENERAL_CHAT_deepseek | DATA: {"model":"deepseek","intent":"GENERAL_CHAT","length":2676,"timerLabel":"prompt_gen_GENERAL_CHAT_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (4 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T14:08:09.948Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T14:08:09.948Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1089}
[api] [2026-02-05T14:08:09.948Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":1,"sample":[{"symbol":"MATIC","balance":"20.6044348920309"}],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9j6dk3005ut6yala9wr064. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T14:08:09.948Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:08:19.318Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:08:21.305Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[python] INFO:moderation.router:Moderating output: I understand you want to confirm the swap. However...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:50303 - "POST /moderation/output HTTP/1.1" 200 OK
[api] [2026-02-05T14:08:22.726Z] [INFO] [SYS-1007] Moderation Output check result | DATA: {"safe":true,"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] Broadcasting message_complete for cml9j6dk3005ut6yala9wr064
[api] [2026-02-05T14:08:22.736Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] [2026-02-05T14:08:22.738Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T14:08:22.739Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] {"level":30,"time":1770300502755,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-21","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50309},"msg":"incoming request"}
[api] {"level":30,"time":1770300502756,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-21","res":{"statusCode":204},"responseTime":0.5031669959425926,"msg":"request completed"}
[api] {"level":30,"time":1770300502757,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-22","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50310},"msg":"incoming request"}
[api] {"level":30,"time":1770300502758,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-22","res":{"statusCode":204},"responseTime":0.31254200637340546,"msg":"request completed"}
[api] {"level":30,"time":1770300502758,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-23","req":{"method":"GET","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50309},"msg":"incoming request"}
[api] {"level":30,"time":1770300502760,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-24","req":{"method":"GET","url":"/api/chat/sessions/cml9j3qw5002mt6yapggjr6tj","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50310},"msg":"incoming request"}
[api] {"level":30,"time":1770300502767,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-24","res":{"statusCode":200},"responseTime":7.076250001788139,"msg":"request completed"}
[api] {"level":30,"time":1770300502768,"pid":83963,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-23","res":{"statusCode":200},"responseTime":9.788708999752998,"msg":"request completed"}
[api] [2026-02-05T14:08:24.095Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:08:29.323Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:08:39.330Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:08:43.383Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"vqhtx","creator":"0xc02867fa78abf7fb5e55fa3854261ae1acf2961b"}
[api] [2026-02-05T14:08:43.963Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"dadofwar","creator":"0x6c585883d04fc7fb292b2ba12ac2301abae99425"}
[api] [2026-02-05T14:08:44.469Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"colt_06fe","creator":"0x4c14655fbc3325b2721900338165dcbd20a09916"}
[api] [2026-02-05T14:08:44.835Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"zdqxe","creator":"0x939ccad4add0bf9eff6900ca01cfdc9849bb8768"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:08:49.335Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T14:08:49.892Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"ftlht","creator":"0x9e95adeede42266b8791432890863d20fe464ceb"}
[api] [2026-02-05T14:08:50.485Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"hdes","creator":"0x98f983189fda8f18035b66f87cd702b453365dcd"}
[api] [2026-02-05T14:08:51.871Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"jgmvp","creator":"0x05e3b26b187367c22571cb4ed9f6446c57f2863a"}
[api] [2026-02-05T14:08:54.440Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"velv","creator":"0x2af0b9751210b4f589b07339df59024c6c6a6e30"}
[api] [2026-02-05T14:08:55.195Z] [INFO] [SYS-1007][TID:d161a2ad-1b23-4648-9b1a-67d40d6b7d95] Alpha Detector: Checking new coin | DATA: {"symbol":"biwig","creator":"0x99b7bee8b0d75eaea059844e1a944f599bf21e5c"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T14:08:59.342Z] [INFO] [SYS-1001] No open positions to monitor

