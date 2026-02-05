[api] [2026-02-05T16:21:06.643Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
[api] [2026-02-05T16:21:06.677Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"solana","limit":100}
[api] [2026-02-05T16:21:06.748Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:21:06.749Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:21:06.749Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: what's my balance ?...
[api] {"level":30,"time":1770308467456,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","res":{"statusCode":200},"responseTime":1639.7077080011368,"msg":"request completed"}
[api] [2026-02-05T16:21:08.175Z] [INFO] [WTC-2002] WS addresses discovered | DATA: {"wsCount":287,"chain":"solana"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:53688 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-05T16:21:08.538Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T16:21:08.544Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml9ny7ub0008bek74acf5mik
[api] [2026-02-05T16:21:08.545Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":137,"tokenCount":7,"hasNativeBalance":true}
[api] [ChatWorker] Base filtered to 46 tools for message: "what's my balance ?..."
[api] [ChatWorker] 🔍 RAG check for: "what's my balance ?..."
[api] [ChatWorker] 🎯 RAG: Match found! Query looks informational.
[api] [2026-02-05T16:21:08.546Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/embeddings "HTTP/1.1 200 OK"
[python] ERROR:rag.router:Query failed: Collection expecting embedding with dimension of 384, got 1536
[python] INFO:     127.0.0.1:53709 - "POST /rag/query HTTP/1.1" 500 Internal Server Error
[api] [2026-02-05T16:21:09.885Z] [ERROR] [API-5002] api failed after 1 attempts | DATA: {"error":"HTTP 500: {\"detail\":\"Collection expecting embedding with dimension of 384, got 1536\"}","url":"http://localhost:8000/rag/query"}
[api] [2026-02-05T16:21:09.885Z] [WARN] [API-5002] RAGClient: Query failed (skipping RAG) | DATA: {"error":"HTTP 500: {\"detail\":\"Collection expecting embedding with dimension of 384, got 1536\"}"}
[api] [ChatWorker] ℹ️ RAG: No relevant knowledge found in local base.
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml9nyagm000abek7n7dmdsx2
[api] [2026-02-05T16:21:09.886Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:21:09.889Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:21:09.898Z] [INFO] [AI-6001][9ms] Timer finished: intent_parsing_2e51c799 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"wallet_balance","highLevelIntent":"MARKET_ANALYSIS","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"MARKET_ANALYSIS","slotsComplete":false,"labels":[{"label":"MARKET_ANALYSIS","confidence":0.95},{"label":"PREDICTION_MARKETS","confidence":0.1414213562373095},{"label":"GENERAL_CHAT","confidence":0.1414213562373095}],"timerLabel":"intent_parsing_2e51c799"}
[api] [2026-02-05T16:21:09.904Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:21:09.904Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml9nyagm000abek7n7dmdsx2","sessionId":"cml9ny7tb0001bek72v4vdjop","model":"deepseek-chat","intent":"MARKET_ANALYSIS","routingMode":"thinking","hardRule":{"label":"MARKET_ANALYSIS","reason":"question intent"},"confidence":0.95}
[api] [ChatWorker] Skill-gated to 26 tools for intent=MARKET_ANALYSIS skills=polymarket_prediction, token_analysis, wallet_portfolio, welcome_onboarding
[api] [2026-02-05T16:21:09.904Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml9nyagm000abek7n7dmdsx2","sessionId":"cml9ny7tb0001bek72v4vdjop","model":"deepseek-chat","intent":"MARKET_ANALYSIS","routingMode":"thinking","skillVersion":"clean","skills":["polymarket_prediction","token_analysis","wallet_portfolio","welcome_onboarding"],"toolCount":26}
[api] [2026-02-05T16:21:09.905Z] [INFO] [AI-6007] ChatWorker: early pre-fetch used client context | DATA: {"tool":"get_wallet_info"}
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
[api] [2026-02-05T16:21:09.907Z] [INFO] [AI-6003] Timer finished: prompt_gen_MARKET_ANALYSIS_deepseek | DATA: {"model":"deepseek","intent":"MARKET_ANALYSIS","length":2676,"timerLabel":"prompt_gen_MARKET_ANALYSIS_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (2 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T16:21:09.909Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T16:21:09.910Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1238}
[api] [2026-02-05T16:21:09.910Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":2,"sample":[{"symbol":"MATIC","balance":"50.99815531307703"},{"symbol":"USDC","balance":"0"}],"spotlight":[{"symbol":"USDC","balance":"0"}]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9ny7ub0008bek74acf5mik. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T16:21:09.910Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T16:21:11.734Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T16:21:13.681Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":131,"limit":200}
[api] [2026-02-05T16:21:13.682Z] [INFO] [API-5001][7005ms] Premium trending tokens fetch complete | DATA: {"count":100,"chain":"solana","source":"WebSocket","wsOriginal":287}
[api] [TokenJob] Got 100 trending tokens for Solana
[api] Saved 100 trending tokens for solana to database and memory cache
[api] [TokenJob] Saved 100 tokens for Solana to DB + cache
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-02-05T16:21:15.199Z] [INFO] [SYS-1007][TID:39ee6194-2992-4578-b4fa-6fa2d03c875f] Alpha Detector: Checking new coin | DATA: {"symbol":"gankh","creator":"0xfab68c3b358be68fd0bd9a547d161f2f95d53562"}
[api] [2026-02-05T16:21:16.695Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T16:21:16.699Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9ny7tb0001bek72v4vdjop","messageId":"cml9ny7ub0008bek74acf5mik","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T16:21:16.700Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"get_wallet_info","sessionId":"cml9ny7tb0001bek72v4vdjop","messageId":"cml9ny7ub0008bek74acf5mik","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T16:21:16.700Z] [INFO] [AI-6007] ChatWorker: get_wallet_info short-circuited to client context | DATA: {"chainId":137}
[api] [ChatWorker] DeepSeek iteration 2/10 for task cml9nyagm000abek7n7dmdsx2
[api] [2026-02-05T16:21:16.703Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:21:16.705Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:21:16.710Z] [INFO] [AI-6001][4ms] Timer finished: intent_parsing_bb77ecba | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"wallet_balance","highLevelIntent":"MARKET_ANALYSIS","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"MARKET_ANALYSIS","slotsComplete":false,"labels":[{"label":"MARKET_ANALYSIS","confidence":0.95},{"label":"PREDICTION_MARKETS","confidence":0.1414213562373095},{"label":"GENERAL_CHAT","confidence":0.1414213562373095}],"timerLabel":"intent_parsing_bb77ecba"}
[api] [2026-02-05T16:21:16.710Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
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
[api] [2026-02-05T16:21:16.711Z] [INFO] [AI-6003] Timer finished: prompt_gen_MARKET_ANALYSIS_deepseek | DATA: {"model":"deepseek","intent":"MARKET_ANALYSIS","length":2676,"timerLabel":"prompt_gen_MARKET_ANALYSIS_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (2 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T16:21:16.711Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T16:21:16.711Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1238}
[api] [2026-02-05T16:21:16.712Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":2,"sample":[{"symbol":"MATIC","balance":"50.99815531307703"},{"symbol":"USDC","balance":"0"}],"spotlight":[{"symbol":"USDC","balance":"0"}]}
[api] [ChatWorker] Added client context to system prompt
[api] [ChatWorker] Broadcasting Thinking status for cml9ny7ub0008bek74acf5mik. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T16:21:16.712Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:21:19.077Z] [INFO] [SYS-1007][TID:39ee6194-2992-4578-b4fa-6fa2d03c875f] Alpha Detector: Checking new coin | DATA: {"symbol":"uvfn","creator":"0xf16b18f6358c83f2dd74289d4368493cd2a01a65"}
[api] [2026-02-05T16:21:19.607Z] [INFO] [SYS-1007][TID:39ee6194-2992-4578-b4fa-6fa2d03c875f] Alpha Detector: Checking new coin | DATA: {"symbol":"ttzm","creator":"0xe980b59fcee82764337623f08282804c78095256"}
[api] [2026-02-05T16:21:21.048Z] [INFO] [SYS-1007][TID:39ee6194-2992-4578-b4fa-6fa2d03c875f] Alpha Detector: Checking new coin | DATA: {"symbol":"slate0x45","creator":"0xd1b21007cc9c652e4ee0da8a0142b4aa97a9f42c"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T16:21:21.743Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T16:21:25.942Z] [INFO] [SYS-1007][TID:39ee6194-2992-4578-b4fa-6fa2d03c875f] Alpha Detector: Checking new coin | DATA: {"symbol":"jexle","creator":"0xd00cfb4dd963ec2d40dad57a30d769b1f3abaf4f"}
[api] [2026-02-05T16:21:27.109Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[python] INFO:moderation.router:Moderating output: I'll check your current wallet balance and holding...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:53932 - "POST /moderation/output HTTP/1.1" 200 OK
[api] [2026-02-05T16:21:28.231Z] [INFO] [SYS-1007] Moderation Output check result | DATA: {"safe":true,"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] Broadcasting message_complete for cml9ny7ub0008bek74acf5mik
[api] [2026-02-05T16:21:28.249Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] [2026-02-05T16:21:28.251Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:21:28.251Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] {"level":30,"time":1770308488265,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9ny7tb0001bek72v4vdjop","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53575},"msg":"incoming request"}
[api] {"level":30,"time":1770308488266,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","res":{"statusCode":204},"responseTime":1.0119170024991035,"msg":"request completed"}
[api] {"level":30,"time":1770308488267,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9ny7tb0001bek72v4vdjop","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53571},"msg":"incoming request"}
[api] {"level":30,"time":1770308488268,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","res":{"statusCode":204},"responseTime":0.34049999713897705,"msg":"request completed"}
[api] {"level":30,"time":1770308488269,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","req":{"method":"GET","url":"/api/chat/sessions/cml9ny7tb0001bek72v4vdjop","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53574},"msg":"incoming request"}
[api] {"level":30,"time":1770308488270,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","req":{"method":"GET","url":"/api/chat/sessions/cml9ny7tb0001bek72v4vdjop","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53600},"msg":"incoming request"}
[api] {"level":30,"time":1770308488278,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","res":{"statusCode":200},"responseTime":9.520541995763779,"msg":"request completed"}
[api] {"level":30,"time":1770308488279,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","res":{"statusCode":200},"responseTime":9.028459005057812,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T16:21:31.746Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770308500316,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53575},"msg":"incoming request"}
[api] {"level":30,"time":1770308500317,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","res":{"statusCode":204},"responseTime":0.8877499997615814,"msg":"request completed"}
[api] {"level":30,"time":1770308500318,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9ny7tb0001bek72v4vdjop/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53571},"msg":"incoming request"}
[api] {"level":30,"time":1770308500318,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","res":{"statusCode":204},"responseTime":0.23991700261831284,"msg":"request completed"}
[api] {"level":30,"time":1770308500318,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-u","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53574},"msg":"incoming request"}
[api] {"level":30,"time":1770308500319,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-u","res":{"statusCode":204},"responseTime":0.17433300614356995,"msg":"request completed"}
[api] {"level":30,"time":1770308500320,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-v","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53600},"msg":"incoming request"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=Swap 30 matic to USD...
[api] {"level":30,"time":1770308500326,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","req":{"method":"POST","url":"/api/chat/sessions/cml9ny7tb0001bek72v4vdjop/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53575},"msg":"incoming request"}
[api] {"level":30,"time":1770308500327,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-x","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53571},"msg":"incoming request"}
[api] {"level":30,"time":1770308500336,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-v","res":{"statusCode":200},"responseTime":15.705875001847744,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T16:21:41.755Z] [INFO] [SYS-1001] No open positions to monitor
[api] [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
[api] [2026-02-05T16:21:43.758Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"base","limit":100}
[api] [2026-02-05T16:21:45.168Z] [INFO] [WTC-2002] WS addresses discovered | DATA: {"wsCount":172,"chain":"base"}
[api] {"level":30,"time":1770308505761,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-x","res":{"statusCode":200},"responseTime":5433.11249999702,"msg":"request completed"}
[api] {"level":30,"time":1770308505768,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53574},"msg":"incoming request"}
[api] {"level":30,"time":1770308505769,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","res":{"statusCode":204},"responseTime":0.5073750019073486,"msg":"request completed"}
[api] {"level":30,"time":1770308505771,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-z","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53600},"msg":"incoming request"}
[api] {"level":30,"time":1770308506124,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","res":{"statusCode":200},"responseTime":5797.70787499845,"msg":"request completed"}
[api] {"level":30,"time":1770308506129,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-10","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53571},"msg":"incoming request"}
[api] {"level":30,"time":1770308506130,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-10","res":{"statusCode":204},"responseTime":0.6614999994635582,"msg":"request completed"}
[api] {"level":30,"time":1770308506132,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-11","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53574},"msg":"incoming request"}
[api] {"level":30,"time":1770308506137,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-11","res":{"statusCode":200},"responseTime":4.3582499995827675,"msg":"request completed"}
[api] {"level":30,"time":1770308506157,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-12","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53575},"msg":"incoming request"}
[api] {"level":30,"time":1770308507922,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-z","res":{"statusCode":200},"responseTime":2150.8739999979734,"msg":"request completed"}
[api] {"level":30,"time":1770308508313,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-12","res":{"statusCode":200},"responseTime":2154.964500002563,"msg":"request completed"}
[api] [2026-02-05T16:21:48.583Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":42,"limit":200}
[api] [ChatWorker] Sanitizing orphaned tool_calls from message 1 (missing 1 tool results)
[api] [2026-02-05T16:21:48.793Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:21:48.794Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:21:48.794Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: Swap 30 matic to USDC...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:54395 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-05T16:21:49.877Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T16:21:49.878Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml9nz14w003cbek7vtm966pw
[api] [2026-02-05T16:21:49.878Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":137,"tokenCount":3,"hasNativeBalance":true}
[api] [ChatWorker] Base filtered to 46 tools for message: "Swap 30 matic to USDC..."
[api] [ChatWorker] 🔍 RAG check for: "Swap 30 matic to USDC..."
[api] [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml9nz5l4003ebek7ix1pqt1f
[api] [2026-02-05T16:21:49.879Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:21:49.880Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:21:49.885Z] [INFO] [AI-6001][5ms] Timer finished: intent_parsing_e2138f4b | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.44999999999999996},{"label":"SOCIAL_SENSING","confidence":0.1414213562373095}],"timerLabel":"intent_parsing_e2138f4b"}
[api] [2026-02-05T16:21:49.888Z] [INFO] [AI-6001] Intent follow-up recorded | DATA: {"previousIntent":"MARKET_ANALYSIS","nextIntent":"TRADING","sessionId":"cml9ny7tb0001bek72v4vdjop"}
[api] [2026-02-05T16:21:49.888Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:21:49.889Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml9nz5l4003ebek7ix1pqt1f","sessionId":"cml9ny7tb0001bek72v4vdjop","model":"deepseek-chat","intent":"TRADING","routingMode":"execution","hardRule":{"label":"TRADING","reason":"action + slots complete"},"confidence":0.95}
[api] [ChatWorker] Skill-gated to 13 tools for intent=TRADING skills=cross_chain_swap, swap, token_alert, wallet_portfolio
[api] [2026-02-05T16:21:49.889Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml9nz5l4003ebek7ix1pqt1f","sessionId":"cml9ny7tb0001bek72v4vdjop","model":"deepseek-chat","intent":"TRADING","routingMode":"execution","skillVersion":"exec","skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"],"toolCount":13}
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
[api] [2026-02-05T16:21:49.891Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":4,"skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"]}
[api] [2026-02-05T16:21:49.891Z] [INFO] [AI-6003][1ms] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":13368,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (2 tokens cached)
[api] [2026-02-05T16:21:49.891Z] [INFO] [AI-6007] ChatWorker: requested token balance resolved | DATA: {"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":137,"requested":["MATIC","USDC"],"matched":["MATIC","USDC"],"missing":[],"resolvedBalances":{"MATIC":"50.99815531307703","USDC":"2.926982"}}
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T16:21:49.891Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T16:21:49.891Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1036}
[api] [2026-02-05T16:21:49.891Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":2,"sample":[{"symbol":"MATIC","balance":"50.99815531307703"},{"symbol":"USDC","balance":"2.926982"}],"spotlight":[{"symbol":"USDC","balance":"2.926982"}]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-02-05T16:21:49.891Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":186}
[api] [ChatWorker] Broadcasting Thinking status for cml9nz14w003cbek7vtm966pw. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T16:21:49.892Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T16:21:51.760Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T16:21:52.478Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T16:21:53.733Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-02-05T16:21:55.641Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T16:21:55.647Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9ny7tb0001bek72v4vdjop","messageId":"cml9nz14w003cbek7vtm966pw","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T16:21:55.647Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"get_token_info","sessionId":"cml9ny7tb0001bek72v4vdjop","messageId":"cml9nz14w003cbek7vtm966pw","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T16:21:55.647Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:21:55.648Z] [INFO] [AI-6005] Timer finished: launchpad_det_0x3c499c542cef5e3811e1192ce70d8cc03d5c3359 | DATA: {"address":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","chainId":137,"found":false,"timerLabel":"launchpad_det_0x3c499c542cef5e3811e1192ce70d8cc03d5c3359"}
[api] [GetTokenInfo] Attempting DexScreener fallback...
[api] [2026-02-05T16:21:55.958Z] [WARN] [API-5004] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [2026-02-05T16:21:56.603Z] [INFO] [AI-6007][956ms] ChatWorker: tool success | DATA: {"tool":"get_token_info","sessionId":"cml9ny7tb0001bek72v4vdjop","messageId":"cml9nz14w003cbek7vtm966pw","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] DeepSeek iteration 2/10 for task cml9nz5l4003ebek7ix1pqt1f
[api] [2026-02-05T16:21:56.609Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:21:56.612Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:21:56.614Z] [INFO] [AI-6001][2ms] Timer finished: intent_parsing_29ecd78d | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.44999999999999996},{"label":"SOCIAL_SENSING","confidence":0.1414213562373095}],"timerLabel":"intent_parsing_29ecd78d"}
[api] [2026-02-05T16:21:56.615Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
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
[api] [2026-02-05T16:21:56.615Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":4,"skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"]}
[api] [2026-02-05T16:21:56.615Z] [INFO] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":13368,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (2 tokens cached)
[api] [2026-02-05T16:21:56.615Z] [INFO] [AI-6007] ChatWorker: requested token balance resolved | DATA: {"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":137,"requested":["MATIC","USDC"],"matched":["MATIC","USDC"],"missing":[],"resolvedBalances":{"MATIC":"50.99815531307703","USDC":"2.926982"}}
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T16:21:56.616Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T16:21:56.616Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1036}
[api] [2026-02-05T16:21:56.616Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":2,"sample":[{"symbol":"MATIC","balance":"50.99815531307703"},{"symbol":"USDC","balance":"2.926982"}],"spotlight":[{"symbol":"USDC","balance":"2.926982"}]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-02-05T16:21:56.616Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":186}
[api] [ChatWorker] Broadcasting Thinking status for cml9nz14w003cbek7vtm966pw. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T16:21:56.616Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-02-05T16:22:01.565Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"base","error":"GeckoTerminal backoff active (55s remaining)"}
[api] [2026-02-05T16:22:01.565Z] [INFO] [API-5001][17807ms] Premium trending tokens fetch complete | DATA: {"count":67,"chain":"base","source":"WebSocket","wsOriginal":172}
[api] [TokenJob] Got 67 trending tokens for Base
[api] Saved 67 trending tokens for base to database and memory cache
[api] [TokenJob] Saved 67 tokens for Base to DB + cache
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T16:22:01.766Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T16:22:02.522Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T16:22:02.542Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9ny7tb0001bek72v4vdjop","messageId":"cml9nz14w003cbek7vtm966pw","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T16:22:02.542Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"simulate_swap","sessionId":"cml9ny7tb0001bek72v4vdjop","messageId":"cml9nz14w003cbek7vtm966pw","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T16:22:02.542Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] {"level":30,"time":1770308522546,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-13","req":{"method":"POST","url":"/api/swap/quote","hostname":"127.0.0.1:3001","remoteAddress":"127.0.0.1","remotePort":54580},"msg":"incoming request"}
[api] [Swap Quote] Fetching metadata for: {
[api]   tokenInForMetadata: '0x0d500B1d8E',
[api]   tokenOutForMetadata: '0x3c499c542c',
[api]   actualTokenIn: '0xEeeeeEeeeE',
[api]   actualTokenOut: '0x3c499c542c',
[api]   isTokenOutNative: false
[api] }
[api] [2026-02-05T16:22:03.639Z] [INFO] [API-5001][TID:e58a0a9e-defa-4b97-862e-f29b26a3cb6c] No token metadata available, trying RPC fallback... | DATA: {"tokenAddress":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","chainId":137}
[api] [2026-02-05T16:22:03.642Z] [INFO] [API-5001][TID:e58a0a9e-defa-4b97-862e-f29b26a3cb6c] Using 0x API fallback token metadata | DATA: {"symbol":"WMATIC","chainId":137}
[api] [Swap Quote] Overriding tokenOut decimals to known value: 6
[api] [Swap Quote] Token decimals: {
[api]   tokenIn: '0xEeeeeEee',
[api]   tokenOut: '0x3c499c54',
[api]   tokenInDecimals: 18,
[api]   tokenOutDecimals: 6,
[api]   tokenOutMetadataDecimals: 6
[api] }
[api] [2026-02-05T16:22:04.829Z] [INFO] [API-5001][TID:e58a0a9e-defa-4b97-862e-f29b26a3cb6c] Using 0x API fallback token metadata | DATA: {"symbol":"USDC","chainId":137}
[api] [2026-02-05T16:22:05.358Z] [INFO] [API-5001][TID:e58a0a9e-defa-4b97-862e-f29b26a3cb6c] 0x API price received successfully | DATA: {"sellToken":"0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270","buyToken":"0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174","chainId":137,"liquidityAvailable":true}
[api] [PlatformFee] Fees DISABLED, returning 0 bps
[api] [Kyber] GET routes {
[api]   routesUrl: 'https://aggregator-api.kyberswap.com/polygon/api/v1/routes?tokenIn=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&tokenOut=0x3c499c542cef5e3811e1192ce70d8cc03d5c3359&amountIn=30000000000000000000&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] [2026-02-05T16:22:05.993Z] [INFO] [API-5001][TID:e58a0a9e-defa-4b97-862e-f29b26a3cb6c] 0x API Quote received successfully | DATA: {"sellToken":"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE","buyToken":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","buyAmount":"2940588","usedEndpoint":"allowance-holder"}
[api] [2026-02-05T16:22:05.994Z] [INFO] [API-5001][TID:e58a0a9e-defa-4b97-862e-f29b26a3cb6c] 0x API Quote successful | DATA: {"sellToken":"0xEeeeeEeeeE","buyToken":"0x3c499c542c","buyAmount":"2940588","hasAllowanceIssue":false,"usedEndpoint":"allowance-holder"}
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 30,
[api]   amountOut: 2.940588,
[api]   quotePrice: 0.0980196,
[api]   refPrice: 0.098109,
[api]   tokenInUsd: 'available',
[api]   impact: -0.09112313854998355,
[api]   formula: '((0.0980196 - 0.098109) / 0.098109) * 100 = -0.09112313854998355'
[api] }
[api] [QuoteService] 0x API estimatedPriceImpact: {
[api]   raw: undefined,
[api]   parsed: 0,
[api]   multipliedBy100: 0,
[api]   impactVsMkt: -0.09112313854998355,
[api]   willUse: -0.09112313854998355
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
[api]   deadline: 1770309126,
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
[api] [2026-02-05T16:22:06.643Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 30,
[api]   amountOut: 2.984267,
[api]   quotePrice: 0.09947556666666667,
[api]   refPrice: 0.098109,
[api]   tokenInUsd: 'available',
[api]   impact: 1.3929065291325626,
[api]   formula: '((0.09947556666666667 - 0.098109) / 0.098109) * 100 = 1.3929065291325626'
[api] }
[api] [QuoteService] Quote comparison: {
[api]   '0x_amount': '2.940588',
[api]   kyber_amount: '2.984267',
[api]   kyber_advantage_pct: '1.00',
[api]   chainId: 137
[api] }
[api] [QuoteService] Preferring 0x for reliability { reason: 'prices within 2%', percentDiff: '1.00' }
[api] {"level":30,"time":1770308527017,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-13","res":{"statusCode":200},"responseTime":4470.46562500298,"msg":"request completed"}
[api] [2026-02-05T16:22:07.017Z] [INFO] [AI-6007][4475ms] ChatWorker: tool success | DATA: {"tool":"simulate_swap","sessionId":"cml9ny7tb0001bek72v4vdjop","messageId":"cml9nz14w003cbek7vtm966pw","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] DeepSeek iteration 3/10 for task cml9nz5l4003ebek7ix1pqt1f
[api] [2026-02-05T16:22:07.021Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:22:07.024Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:22:07.025Z] [INFO] [AI-6001][1ms] Timer finished: intent_parsing_c3853459 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.44999999999999996},{"label":"SOCIAL_SENSING","confidence":0.1414213562373095}],"timerLabel":"intent_parsing_c3853459"}
[api] [2026-02-05T16:22:07.025Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
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
[api] [2026-02-05T16:22:07.028Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":4,"skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"]}
[api] [2026-02-05T16:22:07.028Z] [INFO] [AI-6003][1ms] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":13368,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (2 tokens cached)
[api] [2026-02-05T16:22:07.029Z] [INFO] [AI-6007] ChatWorker: requested token balance resolved | DATA: {"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":137,"requested":["MATIC","USDC"],"matched":["MATIC","USDC"],"missing":[],"resolvedBalances":{"MATIC":"50.99815531307703","USDC":"2.926982"}}
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T16:22:07.030Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T16:22:07.030Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1036}
[api] [2026-02-05T16:22:07.030Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":2,"sample":[{"symbol":"MATIC","balance":"50.99815531307703"},{"symbol":"USDC","balance":"2.926982"}],"spotlight":[{"symbol":"USDC","balance":"2.926982"}]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-02-05T16:22:07.031Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":186}
[api] [ChatWorker] Broadcasting Thinking status for cml9nz14w003cbek7vtm966pw. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T16:22:07.031Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T16:22:11.771Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T16:22:13.673Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[python] INFO:moderation.router:Moderating output: I'll help you swap 30 MATIC to USDC on Polygon. Fi...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:54714 - "POST /moderation/output HTTP/1.1" 200 OK
[api] [2026-02-05T16:22:15.910Z] [INFO] [SYS-1007] Moderation Output check result | DATA: {"safe":true,"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [ChatWorker] Broadcasting message_complete for cml9nz14w003cbek7vtm966pw
[api] [2026-02-05T16:22:15.923Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] [2026-02-05T16:22:15.925Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:22:15.925Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] {"level":30,"time":1770308535933,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-14","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9ny7tb0001bek72v4vdjop","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53600},"msg":"incoming request"}
[api] {"level":30,"time":1770308535934,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-14","res":{"statusCode":204},"responseTime":0.6342080011963844,"msg":"request completed"}
[api] {"level":30,"time":1770308535934,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-15","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9ny7tb0001bek72v4vdjop","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53575},"msg":"incoming request"}
[api] {"level":30,"time":1770308535934,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-15","res":{"statusCode":204},"responseTime":0.14087499678134918,"msg":"request completed"}
[api] {"level":30,"time":1770308535936,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-16","req":{"method":"GET","url":"/api/chat/sessions/cml9ny7tb0001bek72v4vdjop","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53600},"msg":"incoming request"}
[api] {"level":30,"time":1770308535937,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-17","req":{"method":"GET","url":"/api/chat/sessions/cml9ny7tb0001bek72v4vdjop","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53575},"msg":"incoming request"}
[api] {"level":30,"time":1770308535944,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-17","res":{"statusCode":200},"responseTime":7.6536659970879555,"msg":"request completed"}
[api] {"level":30,"time":1770308535945,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-16","res":{"statusCode":200},"responseTime":9.212750002741814,"msg":"request completed"}
[api] {"level":30,"time":1770308536865,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-18","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53575},"msg":"incoming request"}
[api] {"level":30,"time":1770308536866,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-18","res":{"statusCode":204},"responseTime":0.4729579985141754,"msg":"request completed"}
[api] {"level":30,"time":1770308536867,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-19","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9ny7tb0001bek72v4vdjop/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53600},"msg":"incoming request"}
[api] {"level":30,"time":1770308536867,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-19","res":{"statusCode":204},"responseTime":0.23679199814796448,"msg":"request completed"}
[api] {"level":30,"time":1770308536869,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1a","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54727},"msg":"incoming request"}
[api] {"level":30,"time":1770308536869,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1a","res":{"statusCode":204},"responseTime":0.27104199677705765,"msg":"request completed"}
[api] {"level":30,"time":1770308536870,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1b","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53575},"msg":"incoming request"}
[api] {"level":30,"time":1770308536871,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1c","req":{"method":"POST","url":"/api/chat/sessions/cml9ny7tb0001bek72v4vdjop/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53600},"msg":"incoming request"}
[api] {"level":30,"time":1770308536873,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1d","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54727},"msg":"incoming request"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=proceed...
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   userIdLength: 35,
[api]   userIdPrefix: 'did:privy:cmj0a3j3f0',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] {"level":30,"time":1770308536877,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1b","res":{"statusCode":200},"responseTime":7.124707996845245,"msg":"request completed"}
[api] [verifyAccess] ✅ Access granted
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T16:22:21.780Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770308542656,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1c","res":{"statusCode":200},"responseTime":5784.194375000894,"msg":"request completed"}
[api] {"level":30,"time":1770308542662,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1e","req":{"method":"OPTIONS","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53575},"msg":"incoming request"}
[api] {"level":30,"time":1770308542663,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1e","res":{"statusCode":204},"responseTime":0.3407920002937317,"msg":"request completed"}
[api] {"level":30,"time":1770308542665,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1f","req":{"method":"GET","url":"/api/billing/usage-summary","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53600},"msg":"incoming request"}
[api] {"level":30,"time":1770308542670,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1f","res":{"statusCode":200},"responseTime":4.1913750022649765,"msg":"request completed"}
[api] {"level":30,"time":1770308542686,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1g","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53575},"msg":"incoming request"}
[api] {"level":30,"time":1770308542686,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1g","res":{"statusCode":204},"responseTime":0.4060420021414757,"msg":"request completed"}
[api] {"level":30,"time":1770308542688,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1h","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53600},"msg":"incoming request"}
[api] {"level":30,"time":1770308542826,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1d","res":{"statusCode":200},"responseTime":5952.6428750008345,"msg":"request completed"}
[api] {"level":30,"time":1770308542831,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1i","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53575},"msg":"incoming request"}
[api] {"level":30,"time":1770308542832,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1i","res":{"statusCode":204},"responseTime":0.39329100400209427,"msg":"request completed"}
[api] {"level":30,"time":1770308542833,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1j","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54727},"msg":"incoming request"}
[api] [ChatWorker] Sanitizing orphaned tool_calls from message 1 (missing 1 tool results)
[api] [ChatWorker] Sanitizing orphaned tool_calls from message 3 (missing 1 tool results)
[api] [2026-02-05T16:22:24.828Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:22:24.828Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:22:24.828Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: proceed...
[api] {"level":30,"time":1770308544853,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1h","res":{"statusCode":200},"responseTime":2164.767499998212,"msg":"request completed"}
[api] {"level":30,"time":1770308544855,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1k","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53575},"msg":"incoming request"}
[api] {"level":30,"time":1770308544908,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1j","res":{"statusCode":200},"responseTime":2074.5597499981523,"msg":"request completed"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:54854 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-05T16:22:26.201Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T16:22:26.201Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml9nztbv005jbek7idscypou
[api] [2026-02-05T16:22:26.201Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":137,"tokenCount":5,"hasNativeBalance":true}
[api] [ChatWorker] Base filtered to 46 tools for message: "proceed..."
[api] [ChatWorker] 🔍 RAG check for: "proceed..."
[api] [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml9nzxru005lbek7zikxcuk2
[api] [2026-02-05T16:22:26.202Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:22:26.204Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:22:26.207Z] [INFO] [AI-6001][2ms] Timer finished: intent_parsing_a4f9fb33 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"general_query","highLevelIntent":"GENERAL_CHAT","hasAI":false,"confidence":0.7,"routingStage":"hybrid","slotsComplete":false,"labels":[{"label":"GENERAL_CHAT","confidence":0.7},{"label":"TRADING","confidence":0.2},{"label":"MARKET_ANALYSIS","confidence":0.2}],"timerLabel":"intent_parsing_a4f9fb33"}
[api] [2026-02-05T16:22:26.213Z] [INFO] [AI-6001] Intent follow-up recorded | DATA: {"previousIntent":"TRADING","nextIntent":"TRADING","sessionId":"cml9ny7tb0001bek72v4vdjop"}
[api] [2026-02-05T16:22:26.213Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:22:26.213Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml9nzxru005lbek7zikxcuk2","sessionId":"cml9ny7tb0001bek72v4vdjop","model":"deepseek-chat","intent":"TRADING","routingMode":"execution","hardRule":{"label":"TRADING","reason":"user_confirmation_after_simulation"},"confidence":1}
[api] [ChatWorker] Skill-gated to 13 tools for intent=TRADING skills=cross_chain_swap, swap, token_alert, wallet_portfolio
[api] [2026-02-05T16:22:26.213Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml9nzxru005lbek7zikxcuk2","sessionId":"cml9ny7tb0001bek72v4vdjop","model":"deepseek-chat","intent":"TRADING","routingMode":"execution","skillVersion":"exec","skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"],"toolCount":13}
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
[api] [2026-02-05T16:22:26.215Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":4,"skills":["cross_chain_swap","swap","token_alert","wallet_portfolio"]}
[api] [2026-02-05T16:22:26.215Z] [INFO] [AI-6003][1ms] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":13368,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (2 tokens cached)
[api] [2026-02-05T16:22:26.215Z] [INFO] [AI-6007] ChatWorker: requested token balance resolved | DATA: {"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":137,"requested":["MATIC","0x3c499c542cef5e3811e1192ce70d8cc03d5c3359"],"matched":["MATIC","0x3c499c542cef5e3811e1192ce70d8cc03d5c3359"],"missing":[],"resolvedBalances":{"MATIC":"50.99815531307703","0x3c499c542cef5e3811e1192ce70d8cc03d5c3359":"2.926982"}}
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-05T16:22:26.216Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-05T16:22:26.216Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1146}
[api] [2026-02-05T16:22:26.216Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":2,"sample":[{"symbol":"MATIC","balance":"50.99815531307703"},{"symbol":"USDC","balance":"2.926982"}],"spotlight":[{"symbol":"USDC","balance":"2.926982"}]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-02-05T16:22:26.216Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":224}
[api] [ChatWorker] Broadcasting Thinking status for cml9nztbv005jbek7idscypou. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-05T16:22:26.216Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] {"level":30,"time":1770308546480,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1k","res":{"statusCode":200},"responseTime":1624.902999997139,"msg":"request completed"}
[api] [2026-02-05T16:22:28.072Z] [INFO] [SYS-1007][TID:39ee6194-2992-4578-b4fa-6fa2d03c875f] Alpha Detector: Checking new coin | DATA: {"symbol":"baseapi","creator":"0x5fe387adc70a042d8f6699ec78aed343e692f608"}
[api] [2026-02-05T16:22:28.601Z] [INFO] [SYS-1007][TID:39ee6194-2992-4578-b4fa-6fa2d03c875f] Alpha Detector: Checking new coin | DATA: {"symbol":"oxfords","creator":"0xf299a92e8ce234eaa0cd4e734d9bdcc0d6155835"}
[api] [2026-02-05T16:22:29.034Z] [INFO] [SYS-1007][TID:39ee6194-2992-4578-b4fa-6fa2d03c875f] Alpha Detector: Checking new coin | DATA: {"symbol":"uzsus","creator":"0x5f25645bfd37651b617cadf238b051a02d0cd3ee"}
[api] [2026-02-05T16:22:29.502Z] [INFO] [SYS-1007][TID:39ee6194-2992-4578-b4fa-6fa2d03c875f] Alpha Detector: Checking new coin | DATA: {"symbol":"akyat","creator":"0x5e680240b6e9f79db5c31d965a68565589351cd1"}
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
[api] [2026-02-05T16:22:31.614Z] [INFO] [API-5001] Fetching premium trending tokens | DATA: {"chain":"bsc","limit":100}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T16:22:31.790Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T16:22:33.084Z] [INFO] [WTC-2002] WS addresses discovered | DATA: {"wsCount":194,"chain":"bsc"}
[api] [2026-02-05T16:22:34.289Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-05T16:22:34.294Z] [INFO] [AI-6011] ChatWorker: executing tools batch | DATA: {"sessionId":"cml9ny7tb0001bek72v4vdjop","messageId":"cml9nztbv005jbek7idscypou","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","toolCount":1}
[api] [2026-02-05T16:22:34.294Z] [INFO] [AI-6007] ChatWorker: tool start | DATA: {"tool":"prepare_swap_transaction","sessionId":"cml9ny7tb0001bek72v4vdjop","messageId":"cml9nztbv005jbek7idscypou","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T16:22:34.294Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PrepareSwapTransaction] Preparing swap: {
[api]   token_in: 'MATIC',
[api]   token_out: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
[api]   amount_in: '30',
[api]   chain_id: 137,
[api]   slippage: 0.5,
[api]   execute: true
[api] }
[api] [PrepareSwapTransaction] Using TradeContext: ctx_1770308554297_fj6rr1dim
[api] [2026-02-05T16:22:34.299Z] [INFO] [SYS-1007] PrivyWallet Authorization Key config | DATA: {"keyFormat":"wallet-auth","keyLength":196,"keyIdConfigured":true,"keyId":"crdgro3bw0..."}
[api] [PrepareSwapTransaction] User wallet address: 0xA386bc9D...
[api] [PrepareSwapTransaction] ⚡ PRE-WARMING: Quote fetch started (performance optimization, non-critical)
[api] [PrepareSwapTransaction] Non-safe token detected, running MANDATORY Market Structure check...
[api] {"level":30,"time":1770308555583,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1l","req":{"method":"POST","url":"/api/swap/quote","hostname":"127.0.0.1:3001","remoteAddress":"127.0.0.1","remotePort":54580},"msg":"incoming request"}
[api] [Swap Quote] Fetching metadata for: {
[api]   tokenInForMetadata: '0x0d500B1d8E',
[api]   tokenOutForMetadata: '0x3c499c542c',
[api]   actualTokenIn: '0xEeeeeEeeeE',
[api]   actualTokenOut: '0x3c499c542c',
[api]   isTokenOutNative: false
[api] }
[api] [Swap Quote] Overriding tokenOut decimals to known value: 6
[api] [Swap Quote] Token decimals: {
[api]   tokenIn: '0xEeeeeEee',
[api]   tokenOut: '0x3c499c54',
[api]   tokenInDecimals: 18,
[api]   tokenOutDecimals: 6,
[api]   tokenOutMetadataDecimals: undefined
[api] }
[api] [2026-02-05T16:22:36.958Z] [INFO] [API-5001][TID:d108541c-6c9b-400d-90d4-aec1d4c2f3b7] 0x API price received successfully | DATA: {"sellToken":"0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270","buyToken":"0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174","chainId":137,"liquidityAvailable":true}
[api] [PlatformFee] Fees DISABLED, returning 0 bps
[api] [Kyber] GET routes {
[api]   routesUrl: 'https://aggregator-api.kyberswap.com/polygon/api/v1/routes?tokenIn=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&tokenOut=0x3c499c542cef5e3811e1192ce70d8cc03d5c3359&amountIn=30000000000000000000&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] [2026-02-05T16:22:37.474Z] [INFO] [API-5001] Processed DexScreener trending candidates | DATA: {"candidates":32,"limit":200}
[api] [2026-02-05T16:22:37.474Z] [ERROR] [API-5002] Error fetching trending tokens | DATA: {"network":"bsc","error":"GeckoTerminal backoff active (19s remaining)"}
[api] [2026-02-05T16:22:37.475Z] [INFO] [API-5001][5861ms] Premium trending tokens fetch complete | DATA: {"count":74,"chain":"bsc","source":"WebSocket","wsOriginal":194}
[api] [TokenJob] Got 74 trending tokens for BSC
[api] Saved 74 trending tokens for bsc to database and memory cache
[api] [TokenJob] Saved 74 tokens for BSC to DB + cache
[api] [TokenJob] Refreshed 4 primary chains in 120.9s
[api] [2026-02-05T16:22:37.683Z] [INFO] [API-5001][TID:d108541c-6c9b-400d-90d4-aec1d4c2f3b7] 0x API Quote received successfully | DATA: {"sellToken":"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE","buyToken":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","buyAmount":"2947050","usedEndpoint":"allowance-holder"}
[api] [2026-02-05T16:22:37.684Z] [INFO] [API-5001][TID:d108541c-6c9b-400d-90d4-aec1d4c2f3b7] 0x API Quote successful | DATA: {"sellToken":"0xEeeeeEeeeE","buyToken":"0x3c499c542c","buyAmount":"2947050","hasAllowanceIssue":false,"usedEndpoint":"allowance-holder"}
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 30,
[api]   amountOut: 2.94705,
[api]   quotePrice: 0.098235,
[api]   refPrice: 0.098109,
[api]   tokenInUsd: 'available',
[api]   impact: 0.12842858453353015,
[api]   formula: '((0.098235 - 0.098109) / 0.098109) * 100 = 0.12842858453353015'
[api] }
[api] [QuoteService] 0x API estimatedPriceImpact: {
[api]   raw: undefined,
[api]   parsed: 0,
[api]   multipliedBy100: 0,
[api]   impactVsMkt: 0.12842858453353015,
[api]   willUse: 0.12842858453353015
[api] }
[api] [2026-02-05T16:22:37.861Z] [INFO] [API-5001] On-chain price fetched from Uniswap V3 | DATA: {"token":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","price":2.15e-16,"marketCap":1.2864566273035698e-7,"quote":"USDC"}
[api] [2026-02-05T16:22:37.861Z] [INFO] [API-5001] ✅ Hybrid fetch complete | DATA: {"symbol":"USDC","price":2.15e-16,"liquidity":1384107.32,"provider":"rpc+api"}
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
[api]   deadline: 1770309158,
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
[api] [SocialJob] Checking Zora coin status for 48 casts...
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 30,
[api]   amountOut: 3.008423,
[api]   quotePrice: 0.10028076666666667,
[api]   refPrice: 0.098109,
[api]   tokenInUsd: 'available',
[api]   impact: 2.2136263407706447,
[api]   formula: '((0.10028076666666667 - 0.098109) / 0.098109) * 100 = 2.2136263407706447'
[api] }
[api] [QuoteService] Quote comparison: {
[api]   '0x_amount': '2.94705',
[api]   kyber_amount: '3.008423',
[api]   kyber_advantage_pct: '2.00',
[api]   chainId: 137
[api] }
[api] [QuoteService] Using Kyber due to significant price advantage { advantage: '2.00%' }
[api] {"level":30,"time":1770308559329,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1l","res":{"statusCode":200},"responseTime":3745.201250001788,"msg":"request completed"}
[api] [PrepareSwapTransaction] ⚡ PRE-WARMED quote ready (3774ms): { dex: 'KyberSwap', priceImpact: 2.2136263407706447 }
[api] [PrepareSwapTransaction] ✅ Using pre-warmed quote for safety check
[api] [PrepareSwapTransaction] Execution Decision: {
[api]   argsExecute: true,
[api]   swapMethod: 'allowance_trade',
[api]   fastSwapMode: false,
[api]   finalDecision: true
[api] }
[api] [PrepareSwapTransaction] Executing backend swap via internal API...
[api] [PrepareSwapTransaction] Created transaction message: cml9o0and007rbek77unq2zvz
[api] {"level":30,"time":1770308559344,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1m","req":{"method":"POST","url":"/api/swap/execute-instant","hostname":"127.0.0.1:3001","remoteAddress":"127.0.0.1","remotePort":54580},"msg":"incoming request"}
[api] {"level":30,"time":1770308559366,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1n","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53600},"msg":"incoming request"}
[api] {"level":30,"time":1770308559367,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1n","res":{"statusCode":204},"responseTime":0.32895900309085846,"msg":"request completed"}
[api] {"level":30,"time":1770308559368,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1o","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=polygon","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54727},"msg":"incoming request"}
[api] [Swap Execute Instant] Starting swap: {
[api]   userId: 'did:privy:',
[api]   wallet: '0xA386bc9D',
[api]   tokenIn: 'MATIC',
[api]   tokenOut: '0x3c499c54',
[api]   amountIn: '30',
[api]   chainId: 137
[api] }
[api] [2026-02-05T16:22:40.134Z] [INFO] [API-5001][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] 0x API price received successfully | DATA: {"sellToken":"0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270","buyToken":"0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174","chainId":137,"liquidityAvailable":true}
[api] [Swap Execute Instant] Judge engine skipped - only runs for copy trade
[api] [2026-02-05T16:22:40.135Z] [INFO] [EXE-4002][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] [MainSwapService][1770308560135_e0lvqr] Starting unified swap execution | DATA: {"mode":"swap-card","tokenIn":"0xEeeeeEeeeE","tokenOut":"0x3c499c542c","amount":"30","chainId":137,"tradeContextId":"ctx_1770308560135_vsx9ota1c"}
[api] [2026-02-05T16:22:40.136Z] [INFO] [AI-6005][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] Timer finished: launchpad_det_0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE | DATA: {"address":"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE","chainId":137,"found":false,"timerLabel":"launchpad_det_0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"}
[api] [2026-02-05T16:22:40.136Z] [INFO] [EXE-4002][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] [MainSwapService][1770308560135_e0lvqr] Executing EVM swap | DATA: {"chainId":137,"tokenIn":"0xEeeeeEeeeE","tokenOut":"0x3c499c542c"}
[api] [2026-02-05T16:22:40.136Z] [INFO] [EXE-4002][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] Initiating Unified Swap Execution | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","chainId":137,"tokenIn":"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE","tokenOut":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","amount":"30"}
[api] [2026-02-05T16:22:40.495Z] [WARN] [API-5002][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] All API liquidity sources failed | DATA: {"token":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"}
[api] [2026-02-05T16:22:40.495Z] [INFO] [API-5001][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] ✅ Hybrid fetch complete | DATA: {"symbol":"MATIC","price":0.098051,"liquidity":0,"provider":"rpc+api"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T16:22:41.797Z] [INFO] [SYS-1001] No open positions to monitor
[api] {"level":30,"time":1770308564628,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1o","res":{"statusCode":200},"responseTime":5258.934166997671,"msg":"request completed"}
[api] [PlatformFee] Fees DISABLED, returning 0 bps
[api] [2026-02-05T16:22:45.153Z] [INFO] [SOC-7001][184ms] Timer finished: get_trending_casts_trending | DATA: {"timeRange":"trending","limit":500,"offset":0,"count":500,"fromCache":false,"timerLabel":"get_trending_casts_trending"}
[api] [2026-02-05T16:22:45.193Z] [INFO] [SOC-7003] SocialRepo: Updated cache with 500 merged casts
[api] [2026-02-05T16:22:45.193Z] [INFO] [SOC-7003] SocialRepo: Saved 48 trending casts to database
[api] [2026-02-05T16:22:45.193Z] [INFO] [SOC-7003][428ms] Timer finished: save_trending_casts | DATA: {"count":48,"timerLabel":"save_trending_casts"}
[api] [SocialJob] Casts refreshed: 48 saved
[api] [SocialJob] 🚀 Triggering OGP Prefetch for top 48 casts...
[api] [2026-02-05T16:22:46.334Z] [INFO] [API-5001][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] 0x API price received successfully | DATA: {"sellToken":"0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270","buyToken":"0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174","chainId":137,"liquidityAvailable":true}
[api] [PlatformFee] Fees DISABLED, returning 0 bps
[api] [Kyber] GET routes {
[api]   routesUrl: 'https://aggregator-api.kyberswap.com/polygon/api/v1/routes?tokenIn=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&tokenOut=0x3c499c542cef5e3811e1192ce70d8cc03d5c3359&amountIn=30000000000000000000&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] [2026-02-05T16:22:47.019Z] [INFO] [API-5001][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] 0x API Quote received successfully | DATA: {"sellToken":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","buyToken":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","buyAmount":"2949115","usedEndpoint":"allowance-holder"}
[api] [2026-02-05T16:22:47.020Z] [INFO] [API-5001][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] 0x API Quote successful | DATA: {"sellToken":"0xEeeeeEeeeE","buyToken":"0x3c499c542c","buyAmount":"2949115","hasAllowanceIssue":false,"usedEndpoint":"allowance-holder"}
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 30,
[api]   amountOut: 2.949115,
[api]   quotePrice: 0.09830383333333333,
[api]   refPrice: 0.098109,
[api]   tokenInUsd: 'available',
[api]   impact: 0.1985886446027629,
[api]   formula: '((0.09830383333333333 - 0.098109) / 0.098109) * 100 = 0.1985886446027629'
[api] }
[api] [QuoteService] 0x API estimatedPriceImpact: {
[api]   raw: undefined,
[api]   parsed: 0,
[api]   multipliedBy100: 0,
[api]   impactVsMkt: 0.1985886446027629,
[api]   willUse: 0.1985886446027629
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
[api]   deadline: 1770309167,
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
[api]   amountIn: 30,
[api]   amountOut: 3.009092,
[api]   quotePrice: 0.10030306666666666,
[api]   refPrice: 0.098109,
[api]   tokenInUsd: 'available',
[api]   impact: 2.2363561616841072,
[api]   formula: '((0.10030306666666666 - 0.098109) / 0.098109) * 100 = 2.2363561616841072'
[api] }
[api] [QuoteService] Quote comparison: {
[api]   '0x_amount': '2.949115',
[api]   kyber_amount: '3.009092',
[api]   kyber_advantage_pct: '2.00',
[api]   chainId: 137
[api] }
[api] [QuoteService] Using Kyber due to significant price advantage { advantage: '2.00%' }
[api] [2026-02-05T16:22:47.920Z] [INFO] [EXE-4002][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] Checking approval for swap | DATA: {"token":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","spender":"0x6131B5fae19EA4f9D964eAc0408E4408b66337b5","amount":"30000000000000000000","isNative":true}
[api] [2026-02-05T16:22:47.920Z] [INFO] [EXE-4002][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] Approval not needed or already set | DATA: {"token":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","spender":"0x6131B5fae19EA4f9D964eAc0408E4408b66337b5"}
[api] [SwapExecutor] Executing KyberSwap swap on chain 137
[api] [SwapExecutor] ========== TRANSACTION EXECUTION ==========
[api] [SwapExecutor] DEX: KyberSwap
[api] [SwapExecutor] Transaction params: {
[api]   to: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
[api]   dataLength: 7754,
[api]   dataPrefix: '0xe21fd0e900000000000000000000000000000000000000000000000000000000',
[api]   value: '30000000000000000000',
[api]   router: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
[api]   allowanceTarget: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5'
[api] }
[api] [SwapExecutor] Swap details: {
[api]   tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
[api]   tokenOut: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
[api]   amountInBase: '30000000000000000000',
[api]   amountInHuman: '30',
[api]   amountOut: '3.009092',
[api]   slippageBps: 50,
[api]   priceImpact: 2.2363561616841072,
[api]   gasEstimate: 594700
[api] }
[api] [SwapExecutor] =============================================
[api] [SwapExecutor] ===== KYBER ULTRA DEBUG =====
[api] [SwapExecutor] Full calldata: 0xe21fd0e9000000000000000000000000000000000000000000000000000000000000002000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000a600000000000000000000000000000000000000000000000000000000000000c6000000000000000000000000000000000000000000000000000000000000009a00000000000000001a055690d9db800000000000000000001a055690d9db80000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000041be5c989360d04b3f760a642daaf2723953a6cd830cb396e2584e5ba4c4a3e6725d5a0a274f4ec3875afc204d0e7ab4f5a8d648c2761f41072c5027a39eb25ebd1c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008a0000000000000000000000000a386bc9d8f26ab170a847d73226e3e0bceb0fe8e0000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000018000000000000000018b84570022a200000000000000000001b5267b1b18ce00000000000000000001a055690d9db80000000000000000000000000000002dea4400000000000000000000000000000000000000000000030000000f42400000000000000000000000000000004f82e73edb06d29ff62c91ec8f5ff06571bdeb290000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006984c62f0000000000000000000000000000000000000000000000000000000000000880000000000000000000000000000000000000000000000000000000000000000161f598cd0000000000000000768d1c7ba0a48f026a8d35ba2cb86c7ef562e39d000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001e0000000000000000000000000000000000000000000000000000000000000036000000000000000000000000000000000000000000000000000000000000004e00000000000000000000000000000000000000000000000000000000000000660000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee800000000000000000001b48eb57e0000000000000000001a055690d9db80000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000001a055690d9db8000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d500b1d8e8ef31e21c99d1db9a6444d3adf1270800000000000000000001b48eb57e0000000000000000001a055690d9db80000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000001a055690d9db800003b9d6e0900000000000000025455c918e405a2831fbff8595c0aae35ee3db9d1000000000000000000000000000000000000000000000000000000000000008000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000a374094527e1673a86de625aa59517c5de346d32000000000000000000000000000000000000000000000000000000010009046d0000000000000000000000002791bca1f2de4661ed88a30c99a7a9449aa8417480000000000000000000000000000002000000000000000000000000002d13a700000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000002d13a76d2472ce00000000000000035455c918e405a2831fbff8595c0aae35ee3db9d1000000000000000000000000000000000000000000000000000000000000008000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000ba12222222228d8ba445958a75a0704d566bf2c810f21c9bd8128a29aa785ab2de0d044dcdd794360002000000000000000000590000000000000000000000007ceb23fd6bc0add59e62ac25578270cff1b9f6198000000000000000000000005ad815c0000000000000000000056a2bb1ea2c4000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000056a2bb1ea2c403b9d6e0900000000000000045455c918e405a2831fbff8595c0aae35ee3db9d1000000000000000000000000000000000000000000000000000000000000008000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000a4d8c89f0c20efbe54cba9e7e7a7e509056228d9000000000000000000000000fff6fbe64b68d618d47c209fe40b0d8ee6e23c900000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c33598000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c33590000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000001c0000000000000000000000000a386bc9d8f26ab170a847d73226e3e0bceb0fe8e000000000000000000000000000000000000000000000001a055690d9db8000000000000000000000000000000000000000000000000000000000000002daf7e000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000027b7b22536f75726365223a226b696b6f2d617070222c22416d6f756e74496e555344223a22322e39353031373335363532313732333536222c22416d6f756e744f7574555344223a22332e303039373430393335343438303233222c22526566657272616c223a22222c22466c616773223a302c22416d6f756e744f7574223a2233303039303932222c2254696d657374616d70223a313737303330383536372c22526f7574654944223a2239316136316166392d613431302d346634612d393637652d3666313536633730333866613a62626263613766662d373334612d343266622d616638612d656266653464636331393730222c22496e74656772697479496e666f223a7b224b65794944223a2231222c225369676e6174757265223a22572f674c727954574c58576836724e37365976397473754b2b4b41756d64432f4f417841774747692f4863505175704e5666414455446b7a6950794e57694233513354376d4f6f6e705252633675437a6d4b3433362f70642f364752646b4153434c2b446f6637564a796e4e5842665a51644f716a2f6c796b445a6675533768367a4e3461696d726f4742476b6355323138735a4e5961754b76386350646769347a727867315652677663466c4330754c714d4c30766d70354139493432665a704275747948464d483831375a63704c346779664465326655315664543036726c642f6b676d596c454f4946475a5537774f716b48757033543347337962545a334e46632b52696a69314a6e346f554f386d755559456a7365447a3032384c7953326e64634d2b655046704f63462f5232565a6e73325a4b395a323247754a765965566c795a39494d4b724b7959542f6235413531413d3d227d7d0000000000
[api] [SwapExecutor] Calldata length: 7754
[api] [SwapExecutor] Build response (full best): {
[api]   dex: 'kyber',
[api]   dexName: 'KyberSwap',
[api]   amountOut: '3.009092',
[api]   amountOutBase: '3009092',
[api]   gasEstimate: 594700,
[api]   priceImpact: 2.2363561616841072,
[api]   priceImpactVsMkt: 2.2363561616841072,
[api]   path: [
[api]     '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
[api]     '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359'
[api]   ],
[api]   router: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
[api]   data: '0xe21fd0e9000000000000000000000000000000000000000000000000000000000000002000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000a600000000000000000000000000000000000000000000000000000000000000c6000000000000000000000000000000000000000000000000000000000000009a00000000000000001a055690d9db800000000000000000001a055690d9db80000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000041be5c989360d04b3f760a642daaf2723953a6cd830cb396e2584e5ba4c4a3e6725d5a0a274f4ec3875afc204d0e7ab4f5a8d648c2761f41072c5027a39eb25ebd1c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008a0000000000000000000000000a386bc9d8f26ab170a847d73226e3e0bceb0fe8e0000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000018000000000000000018b84570022a200000000000000000001b5267b1b18ce00000000000000000001a055690d9db80000000000000000000000000000002dea4400000000000000000000000000000000000000000000030000000f42400000000000000000000000000000004f82e73edb06d29ff62c91ec8f5ff06571bdeb290000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006984c62f0000000000000000000000000000000000000000000000000000000000000880000000000000000000000000000000000000000000000000000000000000000161f598cd0000000000000000768d1c7ba0a48f026a8d35ba2cb86c7ef562e39d000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001e0000000000000000000000000000000000000000000000000000000000000036000000000000000000000000000000000000000000000000000000000000004e00000000000000000000000000000000000000000000000000000000000000660000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee800000000000000000001b48eb57e0000000000000000001a055690d9db80000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000001a055690d9db8000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d500b1d8e8ef31e21c99d1db9a6444d3adf1270800000000000000000001b48eb57e0000000000000000001a055690d9db80000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000001a055690d9db800003b9d6e0900000000000000025455c918e405a2831fbff8595c0aae35ee3db9d1000000000000000000000000000000000000000000000000000000000000008000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000a374094527e1673a86de625aa59517c5de346d32000000000000000000000000000000000000000000000000000000010009046d0000000000000000000000002791bca1f2de4661ed88a30c99a7a9449aa8417480000000000000000000000000000002000000000000000000000000002d13a700000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000002d13a76d2472ce00000000000000035455c918e405a2831fbff8595c0aae35ee3db9d1000000000000000000000000000000000000000000000000000000000000008000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000ba12222222228d8ba445958a75a0704d566bf2c810f21c9bd8128a29aa785ab2de0d044dcdd794360002000000000000000000590000000000000000000000007ceb23fd6bc0add59e62ac25578270cff1b9f6198000000000000000000000005ad815c0000000000000000000056a2bb1ea2c4000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000056a2bb1ea2c403b9d6e0900000000000000045455c918e405a2831fbff8595c0aae35ee3db9d1000000000000000000000000000000000000000000000000000000000000008000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000a4d8c89f0c20efbe54cba9e7e7a7e509056228d9000000000000000000000000fff6fbe64b68d618d47c209fe40b0d8ee6e23c900000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c33598000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c33590000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000001c0000000000000000000000000a386bc9d8f26ab170a847d73226e3e0bceb0fe8e000000000000000000000000000000000000000000000001a055690d9db8000000000000000000000000000000000000000000000000000000000000002daf7e000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000027b7b22536f75726365223a226b696b6f2d617070222c22416d6f756e74496e555344223a22322e39353031373335363532313732333536222c22416d6f756e744f7574555344223a22332e303039373430393335343438303233222c22526566657272616c223a22222c22466c616773223a302c22416d6f756e744f7574223a2233303039303932222c2254696d657374616d70223a313737303330383536372c22526f7574654944223a2239316136316166392d613431302d346634612d393637652d3666313536633730333866613a62626263613766662d373334612d343266622d616638612d656266653464636331393730222c22496e74656772697479496e666f223a7b224b65794944223a2231222c225369676e6174757265223a22572f674c727954574c58576836724e37365976397473754b2b4b41756d64432f4f417841774747692f4863505175704e5666414455446b7a6950794e57694233513354376d4f6f6e705252633675437a6d4b3433362f70642f364752646b4153434c2b446f6637564a796e4e5842665a51644f716a2f6c796b445a6675533768367a4e3461696d726f4742476b6355323138735a4e5961754b76386350646769347a727867315652677663466c4330754c714d4c30766d70354139493432665a704275747948464d483831375a63704c346779664465326655315664543036726c642f6b676d596c454f4946475a5537774f716b48757033543347337962545a334e46632b52696a69314a6e346f554f386d755559456a7365447a3032384c7953326e64634d2b655046704f63462f5232565a6e73325a4b395a323247754a765965566c795a39494d4b724b7959542f6235413531413d3d227d7d0000000000',
[api]   to: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
[api]   value: '30000000000000000000',
[api]   allowanceTarget: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
[api]   deadline: 1770309167,
[api]   tokenInDecimals: 18,
[api]   tokenOutDecimals: 6
[api] }
[api] [SwapExecutor] ===========================
[api] [SwapExecutor] Execution params prepared: {
[api]   dex: 'KyberSwap',
[api]   gasEstimate: 594700,
[api]   gasLimit: '892050',
[api]   maxFeePerGas: '1147505623691',
[api]   maxPriorityFeePerGas: '26000100203'
[api] }
[api] [sendTransaction] ========== PRIVY TX PARAMS ==========
[api] [sendTransaction] From: 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [sendTransaction] To: 0x6131B5fae19EA4f9D964eAc0408E4408b66337b5
[api] [sendTransaction] Value: 30000000000000000000
[api] [sendTransaction] ValueHex: 0x1a055690d9db80000
[api] [sendTransaction] Data length: 7754
[api] [sendTransaction] Data (full): 0xe21fd0e9000000000000000000000000000000000000000000000000000000000000002000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000a600000000000000000000000000000000000000000000000000000000000000c6000000000000000000000000000000000000000000000000000000000000009a00000000000000001a055690d9db800000000000000000001a055690d9db80000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000041be5c989360d04b3f760a642daaf2723953a6cd830cb396e2584e5ba4c4a3e6725d5a0a274f4ec3875afc204d0e7ab4f5a8d648c2761f41072c5027a39eb25ebd1c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008a0000000000000000000000000a386bc9d8f26ab170a847d73226e3e0bceb0fe8e0000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000018000000000000000018b84570022a200000000000000000001b5267b1b18ce00000000000000000001a055690d9db80000000000000000000000000000002dea4400000000000000000000000000000000000000000000030000000f42400000000000000000000000000000004f82e73edb06d29ff62c91ec8f5ff06571bdeb290000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006984c62f0000000000000000000000000000000000000000000000000000000000000880000000000000000000000000000000000000000000000000000000000000000161f598cd0000000000000000768d1c7ba0a48f026a8d35ba2cb86c7ef562e39d000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001e0000000000000000000000000000000000000000000000000000000000000036000000000000000000000000000000000000000000000000000000000000004e00000000000000000000000000000000000000000000000000000000000000660000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee800000000000000000001b48eb57e0000000000000000001a055690d9db80000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000001a055690d9db8000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d500b1d8e8ef31e21c99d1db9a6444d3adf1270800000000000000000001b48eb57e0000000000000000001a055690d9db80000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000001a055690d9db800003b9d6e0900000000000000025455c918e405a2831fbff8595c0aae35ee3db9d1000000000000000000000000000000000000000000000000000000000000008000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000a374094527e1673a86de625aa59517c5de346d32000000000000000000000000000000000000000000000000000000010009046d0000000000000000000000002791bca1f2de4661ed88a30c99a7a9449aa8417480000000000000000000000000000002000000000000000000000000002d13a700000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000002d13a76d2472ce00000000000000035455c918e405a2831fbff8595c0aae35ee3db9d1000000000000000000000000000000000000000000000000000000000000008000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000ba12222222228d8ba445958a75a0704d566bf2c810f21c9bd8128a29aa785ab2de0d044dcdd794360002000000000000000000590000000000000000000000007ceb23fd6bc0add59e62ac25578270cff1b9f6198000000000000000000000005ad815c0000000000000000000056a2bb1ea2c4000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000056a2bb1ea2c403b9d6e0900000000000000045455c918e405a2831fbff8595c0aae35ee3db9d1000000000000000000000000000000000000000000000000000000000000008000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000a4d8c89f0c20efbe54cba9e7e7a7e509056228d9000000000000000000000000fff6fbe64b68d618d47c209fe40b0d8ee6e23c900000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c33598000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c33590000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000001c0000000000000000000000000a386bc9d8f26ab170a847d73226e3e0bceb0fe8e000000000000000000000000000000000000000000000001a055690d9db8000000000000000000000000000000000000000000000000000000000000002daf7e000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000027b7b22536f75726365223a226b696b6f2d617070222c22416d6f756e74496e555344223a22322e39353031373335363532313732333536222c22416d6f756e744f7574555344223a22332e303039373430393335343438303233222c22526566657272616c223a22222c22466c616773223a302c22416d6f756e744f7574223a2233303039303932222c2254696d657374616d70223a313737303330383536372c22526f7574654944223a2239316136316166392d613431302d346634612d393637652d3666313536633730333866613a62626263613766662d373334612d343266622d616638612d656266653464636331393730222c22496e74656772697479496e666f223a7b224b65794944223a2231222c225369676e6174757265223a22572f674c727954574c58576836724e37365976397473754b2b4b41756d64432f4f417841774747692f4863505175704e5666414455446b7a6950794e57694233513354376d4f6f6e705252633675437a6d4b3433362f70642f364752646b4153434c2b446f6637564a796e4e5842665a51644f716a2f6c796b445a6675533768367a4e3461696d726f4742476b6355323138735a4e5961754b76386350646769347a727867315652677663466c4330754c714d4c30766d70354139493432665a704275747948464d483831375a63704c346779664465326655315664543036726c642f6b676d596c454f4946475a5537774f716b48757033543347337962545a334e46632b52696a69314a6e346f554f386d755559456a7365447a3032384c7953326e64634d2b655046704f63462f5232565a6e73325a4b395a323247754a765965566c795a39494d4b724b7959542f6235413531413d3d227d7d0000000000
[api] [sendTransaction] ChainId: 137
[api] [sendTransaction] Gas: 892050
[api] [sendTransaction] MaxFeePerGas: 1147505623691
[api] [sendTransaction] MaxPriorityFeePerGas: 26000100203
[api] [sendTransaction] Full TX object: {
[api]   to: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
[api]   data: '0xe21fd0e9000000000000000000000000000000000000000000000000000000000000002000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000a600000000000000000000000000000000000000000000000000000000000000c6000000000000000000000000000000000000000000000000000000000000009a00000000000000001a055690d9db800000000000000000001a055690d9db80000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000041be5c989360d04b3f760a642daaf2723953a6cd830cb396e2584e5ba4c4a3e6725d5a0a274f4ec3875afc204d0e7ab4f5a8d648c2761f41072c5027a39eb25ebd1c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008a0000000000000000000000000a386bc9d8f26ab170a847d73226e3e0bceb0fe8e0000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000018000000000000000018b84570022a200000000000000000001b5267b1b18ce00000000000000000001a055690d9db80000000000000000000000000000002dea4400000000000000000000000000000000000000000000030000000f42400000000000000000000000000000004f82e73edb06d29ff62c91ec8f5ff06571bdeb290000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006984c62f0000000000000000000000000000000000000000000000000000000000000880000000000000000000000000000000000000000000000000000000000000000161f598cd0000000000000000768d1c7ba0a48f026a8d35ba2cb86c7ef562e39d000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001e0000000000000000000000000000000000000000000000000000000000000036000000000000000000000000000000000000000000000000000000000000004e00000000000000000000000000000000000000000000000000000000000000660000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee800000000000000000001b48eb57e0000000000000000001a055690d9db80000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000001a055690d9db8000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d500b1d8e8ef31e21c99d1db9a6444d3adf1270800000000000000000001b48eb57e0000000000000000001a055690d9db80000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000001a055690d9db800003b9d6e0900000000000000025455c918e405a2831fbff8595c0aae35ee3db9d1000000000000000000000000000000000000000000000000000000000000008000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000a374094527e1673a86de625aa59517c5de346d32000000000000000000000000000000000000000000000000000000010009046d0000000000000000000000002791bca1f2de4661ed88a30c99a7a9449aa8417480000000000000000000000000000002000000000000000000000000002d13a700000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000002d13a76d2472ce00000000000000035455c918e405a2831fbff8595c0aae35ee3db9d1000000000000000000000000000000000000000000000000000000000000008000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000ba12222222228d8ba445958a75a0704d566bf2c810f21c9bd8128a29aa785ab2de0d044dcdd794360002000000000000000000590000000000000000000000007ceb23fd6bc0add59e62ac25578270cff1b9f6198000000000000000000000005ad815c0000000000000000000056a2bb1ea2c4000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000056a2bb1ea2c403b9d6e0900000000000000045455c918e405a2831fbff8595c0aae35ee3db9d1000000000000000000000000000000000000000000000000000000000000008000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000a4d8c89f0c20efbe54cba9e7e7a7e509056228d9000000000000000000000000fff6fbe64b68d618d47c209fe40b0d8ee6e23c900000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c33598000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c33590000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000001c0000000000000000000000000a386bc9d8f26ab170a847d73226e3e0bceb0fe8e000000000000000000000000000000000000000000000001a055690d9db8000000000000000000000000000000000000000000000000000000000000002daf7e000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000027b7b22536f75726365223a226b696b6f2d617070222c22416d6f756e74496e555344223a22322e39353031373335363532313732333536222c22416d6f756e744f7574555344223a22332e303039373430393335343438303233222c22526566657272616c223a22222c22466c616773223a302c22416d6f756e744f7574223a2233303039303932222c2254696d657374616d70223a313737303330383536372c22526f7574654944223a2239316136316166392d613431302d346634612d393637652d3666313536633730333866613a62626263613766662d373334612d343266622d616638612d656266653464636331393730222c22496e74656772697479496e666f223a7b224b65794944223a2231222c225369676e6174757265223a22572f674c727954574c58576836724e37365976397473754b2b4b41756d64432f4f417841774747692f4863505175704e5666414455446b7a6950794e57694233513354376d4f6f6e705252633675437a6d4b3433362f70642f364752646b4153434c2b446f6637564a796e4e5842665a51644f716a2f6c796b445a6675533768367a4e3461696d726f4742476b6355323138735a4e5961754b76386350646769347a727867315652677663466c4330754c714d4c30766d70354139493432665a704275747948464d483831375a63704c346779664465326655315664543036726c642f6b676d596c454f4946475a5537774f716b48757033543347337962545a334e46632b52696a69314a6e346f554f386d755559456a7365447a3032384c7953326e64634d2b655046704f63462f5232565a6e73325a4b395a323247754a765965566c795a39494d4b724b7959542f6235413531413d3d227d7d0000000000',
[api]   value: '30000000000000000000',
[api]   chainId: 137,
[api]   gas: '892050',
[api]   maxFeePerGas: '1147505623691',
[api]   maxPriorityFeePerGas: '26000100203'
[api] }
[api] [sendTransaction] ===========================================
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T16:22:51.805Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-05T16:22:52.552Z] [INFO] [EXE-4002][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] Ethereum transaction sent via Privy | DATA: {"txHash":"0x40f218daf1509a0a9197de9e60ce403942e59a743287ebe86f1ab4c57b701d34","chainId":137}
[api] [2026-02-05T16:22:53.554Z] [INFO] [EXE-4002][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] Swap Broadcast | DATA: {"txHash":"0x40f218daf1509a0a9197de9e60ce403942e59a743287ebe86f1ab4c57b701d34","method":"KyberSwap"}
[api] [2026-02-05T16:22:53.555Z] [INFO] [SYS-1007][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] [ConfirmWait] Waiting for confirmation: 0x40f218daf1509a0a9197de9e60ce403942e59a743287ebe86f1ab4c57b701d34 on 137
[api] [2026-02-05T16:22:57.288Z] [ERROR] [EXE-4004][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] [ConfirmWait] Transaction REVERTED: 0x40f218daf1509a0a9197de9e60ce403942e59a743287ebe86f1ab4c57b701d34 | DATA: {"reason":"Return amount is not enough"}
[api] [2026-02-05T16:22:57.288Z] [ERROR] [EXE-4004][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] Transaction REVERTED on-chain | DATA: {"txHash":"0x40f218daf1509a0a9197de9e60ce403942e59a743287ebe86f1ab4c57b701d34","reason":"Return amount is not enough"}
[api] [2026-02-05T16:22:57.288Z] [WARN] [EXE-4004][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] Fast failover: switching DEX after on-chain revert | DATA: {"failedDex":"KyberSwap","failedDexId":"kyber","slippageBps":50}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T16:23:01.815Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PlatformFee] Fees DISABLED, returning 0 bps
[api] [2026-02-05T16:23:03.589Z] [INFO] [API-5001][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] 0x API price received successfully | DATA: {"sellToken":"0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270","buyToken":"0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174","chainId":137,"liquidityAvailable":true}
[api] [PlatformFee] Fees DISABLED, returning 0 bps
[api] [Kyber] GET routes {
[api]   routesUrl: 'https://aggregator-api.kyberswap.com/polygon/api/v1/routes?tokenIn=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&tokenOut=0x3c499c542cef5e3811e1192ce70d8cc03d5c3359&amountIn=30000000000000000000&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] [2026-02-05T16:23:04.415Z] [INFO] [API-5001][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] 0x API Quote received successfully | DATA: {"sellToken":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","buyToken":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","buyAmount":"2945575","usedEndpoint":"allowance-holder"}
[api] [2026-02-05T16:23:04.415Z] [INFO] [API-5001][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] 0x API Quote successful | DATA: {"sellToken":"0xEeeeeEeeeE","buyToken":"0x3c499c542c","buyAmount":"2945575","hasAllowanceIssue":false,"usedEndpoint":"allowance-holder"}
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 30,
[api]   amountOut: 2.945575,
[api]   quotePrice: 0.09818583333333333,
[api]   refPrice: 0.09819,
[api]   tokenInUsd: 'available',
[api]   impact: -0.004243473537698552,
[api]   formula: '((0.09818583333333333 - 0.09819) / 0.09819) * 100 = -0.004243473537698552'
[api] }
[api] [QuoteService] 0x API estimatedPriceImpact: {
[api]   raw: undefined,
[api]   parsed: 0,
[api]   multipliedBy100: 0,
[api]   impactVsMkt: -0.004243473537698552,
[api]   willUse: -0.004243473537698552
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
[api]   deadline: 1770309184,
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
[api]   amountIn: 30,
[api]   amountOut: 3.003358,
[api]   quotePrice: 0.10011193333333333,
[api]   refPrice: 0.09819,
[api]   tokenInUsd: 'available',
[api]   impact: 1.9573615778932008,
[api]   formula: '((0.10011193333333333 - 0.09819) / 0.09819) * 100 = 1.9573615778932008'
[api] }
[api] [QuoteService] Excluding DEX on retry: { excluded: 'kyber', available: '0x' }
[api] [2026-02-05T16:23:05.939Z] [INFO] [EXE-4002][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] Checking approval for swap | DATA: {"token":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","spender":"0x0000000000001ff3684f28c67538d4d072c22734","amount":"30000000000000000000","isNative":true}
[api] [2026-02-05T16:23:05.939Z] [INFO] [EXE-4002][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] Approval not needed or already set | DATA: {"token":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","spender":"0x0000000000001ff3684f28c67538d4d072c22734"}
[api] [SwapExecutor] Executing 0x Aggregator swap on chain 137
[api] [SwapExecutor] ========== TRANSACTION EXECUTION ==========
[api] [SwapExecutor] DEX: 0x Aggregator
[api] [SwapExecutor] Transaction params: {
[api]   to: '0x0000000000001ff3684f28c67538d4d072c22734',
[api]   dataLength: 3722,
[api]   dataPrefix: '0x2213bc0b000000000000000000000000b0873c46937d34e98615e8c868bd3580',
[api]   value: '30000000000000000000',
[api]   router: '0x0000000000001ff3684f28c67538d4d072c22734',
[api]   allowanceTarget: '0x0000000000001ff3684f28c67538d4d072c22734'
[api] }
[api] [SwapExecutor] Swap details: {
[api]   tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
[api]   tokenOut: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
[api]   amountInBase: '30000000000000000000',
[api]   amountInHuman: '30',
[api]   amountOut: '2.945575',
[api]   slippageBps: 50,
[api]   priceImpact: -0.004243473537698552,
[api]   gasEstimate: 278692
[api] }
[api] [SwapExecutor] =============================================
[api] [2026-02-05T16:23:06.645Z] [WARN] [SYS-1006] RPC health degraded | DATA: {"endpoints":[{"url":"https://solana-rpc.publicnode.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana.drpc.org","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://api.mainnet-beta.solana.com","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://solana-mainnet.g.alchemy.com/v2/Cmrwi0FonoT_sPwZhJXou","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0},{"url":"https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b","successRate":0,"avgResponseTime":0,"circuitOpen":false,"consecutiveFailures":0}]}
[api] [SwapExecutor] Execution params prepared: {
[api]   dex: '0x Aggregator',
[api]   gasEstimate: 278692,
[api]   gasLimit: '418038',
[api]   maxFeePerGas: '1147505623691',
[api]   maxPriorityFeePerGas: '26000100203'
[api] }
[api] [sendTransaction] ========== PRIVY TX PARAMS ==========
[api] [sendTransaction] From: 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [sendTransaction] To: 0x0000000000001ff3684f28c67538d4d072c22734
[api] [sendTransaction] Value: 30000000000000000000
[api] [sendTransaction] ValueHex: 0x1a055690d9db80000
[api] [sendTransaction] Data length: 3722
[api] [sendTransaction] Data (full): 0x2213bc0b000000000000000000000000b0873c46937d34e98615e8c868bd3580bc6dcd470000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001a055690d9db80000000000000000000000000000b0873c46937d34e98615e8c868bd3580bc6dcd4700000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000006641fff991f000000000000000000000000a386bc9d8f26ab170a847d73226e3e0bceb0fe8e0000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c335900000000000000000000000000000000000000000000000000000000002cb88900000000000000000000000000000000000000000000000000000000000000a02692f64ab022b47d70c9107b0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000260000000000000000000000000000000000000000000000000000000000000038000000000000000000000000000000000000000000000000000000000000004400000000000000000000000000000000000000000000000000000000000000044bd01c226000000000000000000000000000000000000000000000000000000006984c513000000000000000000000000000000000000000000000001a055690d9db8000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000000000000000000000000000000000000000027100000000000000000000000000d500b1d8e8ef31e21c99d1db9a6444d3adf1270000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000024d0e30db00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e48d68a156000000000000000000000000b0873c46937d34e98615e8c868bd3580bc6dcd4700000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400d500b1d8e8ef31e21c99d1db9a6444d3adf1270000001f400000000000000000000000000000001000276a43c499c542cef5e3811e1192ce70d8cc03d5c335900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008434ee90ca000000000000000000000000f5c4f3dc02c3fb9279495a8fef7b0741da9561570000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c335900000000000000000000000000000000000000000000000000000000002d06f2000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012438c9c1470000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c3359000000000000000000000000000000000000000000000000000000000000000f0000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c3359000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000ad01c20d5886137e056775af56915de824c8fce50000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
[api] [sendTransaction] ChainId: 137
[api] [sendTransaction] Gas: 418038
[api] [sendTransaction] MaxFeePerGas: 1147505623691
[api] [sendTransaction] MaxPriorityFeePerGas: 26000100203
[api] [sendTransaction] Full TX object: {
[api]   to: '0x0000000000001ff3684f28c67538d4d072c22734',
[api]   data: '0x2213bc0b000000000000000000000000b0873c46937d34e98615e8c868bd3580bc6dcd470000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001a055690d9db80000000000000000000000000000b0873c46937d34e98615e8c868bd3580bc6dcd4700000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000006641fff991f000000000000000000000000a386bc9d8f26ab170a847d73226e3e0bceb0fe8e0000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c335900000000000000000000000000000000000000000000000000000000002cb88900000000000000000000000000000000000000000000000000000000000000a02692f64ab022b47d70c9107b0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000260000000000000000000000000000000000000000000000000000000000000038000000000000000000000000000000000000000000000000000000000000004400000000000000000000000000000000000000000000000000000000000000044bd01c226000000000000000000000000000000000000000000000000000000006984c513000000000000000000000000000000000000000000000001a055690d9db8000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000000000000000000000000000000000000000027100000000000000000000000000d500b1d8e8ef31e21c99d1db9a6444d3adf1270000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000024d0e30db00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e48d68a156000000000000000000000000b0873c46937d34e98615e8c868bd3580bc6dcd4700000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400d500b1d8e8ef31e21c99d1db9a6444d3adf1270000001f400000000000000000000000000000001000276a43c499c542cef5e3811e1192ce70d8cc03d5c335900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008434ee90ca000000000000000000000000f5c4f3dc02c3fb9279495a8fef7b0741da9561570000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c335900000000000000000000000000000000000000000000000000000000002d06f2000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012438c9c1470000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c3359000000000000000000000000000000000000000000000000000000000000000f0000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c3359000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000ad01c20d5886137e056775af56915de824c8fce50000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
[api]   value: '30000000000000000000',
[api]   chainId: 137,
[api]   gas: '418038',
[api]   maxFeePerGas: '1147505623691',
[api]   maxPriorityFeePerGas: '26000100203'
[api] }
[api] [sendTransaction] ===========================================
[api] [PrepareSwapTransaction] Socket error - waiting for backend to complete transaction...
[api] [2026-02-05T16:23:10.057Z] [INFO] [EXE-4002][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] Ethereum transaction sent via Privy | DATA: {"txHash":"0x5defe9125ef5229a6182a48b39f9b5e68b041761ca48c77bc967999d0c995e6a","chainId":137}
[api] [2026-02-05T16:23:11.058Z] [INFO] [EXE-4002][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] Swap Broadcast | DATA: {"txHash":"0x5defe9125ef5229a6182a48b39f9b5e68b041761ca48c77bc967999d0c995e6a","method":"0x Aggregator"}
[api] [2026-02-05T16:23:11.058Z] [INFO] [SYS-1007][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] [ConfirmWait] Waiting for confirmation: 0x5defe9125ef5229a6182a48b39f9b5e68b041761ca48c77bc967999d0c995e6a on 137
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T16:23:11.824Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PrepareSwapTransaction] Polling... 3s elapsed (5 attempts)
[api] [2026-02-05T16:23:14.950Z] [INFO] [EXE-4003][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] [ConfirmWait] Transaction confirmed: 0x5defe9125ef5229a6182a48b39f9b5e68b041761ca48c77bc967999d0c995e6a
[api] [2026-02-05T16:23:14.951Z] [INFO] [EXE-4003][TID:2854d84b-b358-4ad1-97a2-268ee3a2b921] Transaction confirmed on-chain | DATA: {"txHash":"0x5defe9125ef5229a6182a48b39f9b5e68b041761ca48c77bc967999d0c995e6a"}
[api] [PrepareSwapTransaction] ✅ Found transaction after 6s (8 polls): 0x5defe9125ef5229a6182a48b39f9b5e68b041761ca48c77bc967999d0c995e6a
[api] [2026-02-05T16:23:15.848Z] [INFO] [AI-6007][41554ms] ChatWorker: tool success | DATA: {"tool":"prepare_swap_transaction","sessionId":"cml9ny7tb0001bek72v4vdjop","messageId":"cml9nztbv005jbek7idscypou","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-05T16:23:15.848Z] [INFO] [AI-6011] Tool returned _final flag - swap execution complete | DATA: {"tool":"prepare_swap_transaction","success":true}
[api] [2026-02-05T16:23:15.854Z] [INFO] [AI-6011] Tool final flag detected - completing task immediately | DATA: {"stopReasons":["tool_final:prepare_swap_transaction"],"immediateExit":true}
[api] [ChatWorker] Broadcasting message_complete for cml9nztbv005jbek7idscypou
[api] [2026-02-05T16:23:15.863Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] [2026-02-05T16:23:15.865Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-05T16:23:15.865Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] {"level":30,"time":1770308595878,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1p","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9ny7tb0001bek72v4vdjop","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55342},"msg":"incoming request"}
[api] {"level":30,"time":1770308595878,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1p","res":{"statusCode":204},"responseTime":0.5590420067310333,"msg":"request completed"}
[api] {"level":30,"time":1770308595879,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1q","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml9ny7tb0001bek72v4vdjop","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55343},"msg":"incoming request"}
[api] {"level":30,"time":1770308595879,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1q","res":{"statusCode":204},"responseTime":0.13441699743270874,"msg":"request completed"}
[api] {"level":30,"time":1770308595880,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1r","req":{"method":"GET","url":"/api/chat/sessions/cml9ny7tb0001bek72v4vdjop","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55342},"msg":"incoming request"}
[api] {"level":30,"time":1770308595881,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1s","req":{"method":"GET","url":"/api/chat/sessions/cml9ny7tb0001bek72v4vdjop","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55343},"msg":"incoming request"}
[api] {"level":30,"time":1770308595886,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1r","res":{"statusCode":200},"responseTime":6.54712500423193,"msg":"request completed"}
[api] {"level":30,"time":1770308595887,"pid":2946,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1s","res":{"statusCode":200},"responseTime":5.952541001141071,"msg":"request completed"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-05T16:23:21.829Z] [INFO] [SYS-1001] No open positions to monitor
