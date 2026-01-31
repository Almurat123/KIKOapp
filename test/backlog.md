[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=buy 1 usdc...
[api] {"level":30,"time":1769858635615,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","res":{"statusCode":200},"responseTime":14.584332999773324,"msg":"request completed"}
[api] {"level":30,"time":1769858635616,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","res":{"statusCode":200},"responseTime":8.134999999776483,"msg":"request completed"}
[api] {"level":30,"time":1769858635617,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml284va3000010kz3n5p9k15","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":56492},"msg":"incoming request"}
[api] {"level":30,"time":1769858635618,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","res":{"statusCode":204},"responseTime":0.6065419996157289,"msg":"request completed"}
[api] {"level":30,"time":1769858635619,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","req":{"method":"GET","url":"/api/chat/sessions/cml284va3000010kz3n5p9k15","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":56491},"msg":"incoming request"}
[api] {"level":30,"time":1769858635628,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","res":{"statusCode":200},"responseTime":8.599584000185132,"msg":"request completed"}
[api] {"level":30,"time":1769858635631,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml284va3000010kz3n5p9k15/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":56492},"msg":"incoming request"}
[api] {"level":30,"time":1769858635631,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","res":{"statusCode":204},"responseTime":0.4651659997180104,"msg":"request completed"}
[api] {"level":30,"time":1769858635633,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","req":{"method":"POST","url":"/api/chat/sessions/cml284va3000010kz3n5p9k15/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":56491},"msg":"incoming request"}
[api] {"level":30,"time":1769858635765,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","res":{"statusCode":200},"responseTime":131.85033299960196,"msg":"request completed"}
[api] {"level":30,"time":1769858635773,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":56492},"msg":"incoming request"}
[api] [2026-01-31T11:23:55.860Z] [ERROR] [API-5002][TID:d8d0c08a-71f3-4f11-a01c-1b07d96bbb06] Alchemy Portfolio EVM API error | DATA: {}
[api] {"level":30,"time":1769858636117,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","res":{"statusCode":200},"responseTime":1148.252749999985,"msg":"request completed"}
[api] [2026-01-31T11:23:56.249Z] [ERROR] [API-5002][TID:2dc9af29-1bca-4968-ac92-239a91d7eac0] Alchemy Portfolio EVM API error | DATA: {}
[api] {"level":30,"time":1769858636506,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","res":{"statusCode":200},"responseTime":896.3677500002086,"msg":"request completed"}
[api] [2026-01-31T11:23:57.185Z] [ERROR] [API-5002][TID:348e399e-ade0-411a-a74a-cbf3ea4c3e37] Alchemy Portfolio EVM API error | DATA: {}
[api] {"level":30,"time":1769858637447,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","res":{"statusCode":200},"responseTime":1673.8861250001937,"msg":"request completed"}
[api] [2026-01-31T11:23:58.710Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-01-31T11:23:58.710Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-01-31T11:23:58.722Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: buy 1 usdc...
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-01-31T11:23:59.679Z] [INFO] [SYS-1001] No open positions to monitor
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:56576 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-01-31T11:24:00.832Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-01-31T11:24:00.836Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml284vdy000710kzqn99m9ce
[api] [2026-01-31T11:24:00.838Z] [INFO] [SYS-1007] ToolPreRouter: Category matched | DATA: {"category":"\\b(swap|buy|sell|trade|exchange|convert|购买|卖出|兑换)\\b","tools":["get_token_info","external_web_search","prepare_swap_transaction","get_wallet_info","check_token_risk","create_copy_trade_config"]}
[api] [ChatWorker] Base filtered to 6 tools for message: "buy 1 usdc..."
[api] [ChatWorker] 🔍 RAG check for: "buy 1 usdc..."
[api] [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml284ve0000910kzlu3fn12x
[api] [2026-01-31T11:24:00.838Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
[api] [2026-01-31T11:24:00.841Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-01-31T11:24:00.849Z] [INFO] [AI-6001][8ms] Timer finished: intent_parsing_99edd0ea | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.13333333333333336},{"label":"RISK_SCAN","confidence":0}],"timerLabel":"intent_parsing_99edd0ea"}
[api] [2026-01-31T11:24:00.852Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-01-31T11:24:00.852Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml284ve0000910kzlu3fn12x","sessionId":"cml284va3000010kz3n5p9k15","model":"deepseek-v3-fast","intent":"TRADING","routingMode":"execution","hardRule":{"label":"TRADING","reason":"action + slots complete"},"confidence":0.95}
[api] [ChatWorker] Skill-gated to 5 tools for intent=TRADING skills=swap, token_alert, wallet_portfolio
[api] [2026-01-31T11:24:00.853Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml284ve0000910kzlu3fn12x","sessionId":"cml284va3000010kz3n5p9k15","model":"deepseek-v3-fast","intent":"TRADING","routingMode":"execution","skillVersion":"exec","skills":["swap","token_alert","wallet_portfolio"],"toolCount":5}
[api] [GetWalletInfo] Attempting Alchemy...
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: true,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
[api]     'userRole',
[api]     'defaultSwapAmount',
[api]     'defaultSwapUnit',
[api]     'checkTokenBeforeSwap',
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
[api]   chainId: 8453
[api] }
[api] [ChatWorker] Waiting for early pre-fetch to complete
[api] [2026-01-31T11:24:00.860Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":3,"skills":["swap","token_alert","wallet_portfolio"]}
[api] [2026-01-31T11:24:00.860Z] [INFO] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":12046,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] No tokenInfo available
[api] [2026-01-31T11:24:00.861Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-01-31T11:24:00.862Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":false,"hasPageContext":false,"hasToolConfig":true,"contextBytes":831}
[api] [2026-01-31T11:24:00.862Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":0,"sample":[],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-01-31T11:24:00.862Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":141}
[api] [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
[api] [ChatWorker] Broadcasting Thinking status for cml284vdy000710kzqn99m9ce. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-01-31T11:24:00.862Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-01-31T11:24:03.248Z] [ERROR] [API-5002] Alchemy Portfolio EVM API error | DATA: {}
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-01-31T11:24:06.444Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-01-31T11:24:06.452Z] [INFO] [AI-6007] ChatWorker: get_wallet_info short-circuited to client context | DATA: {"chainId":8453}
[api] [ChatWorker] DeepSeek iteration 2/10 for task cml284ve0000910kzlu3fn12x
[api] [2026-01-31T11:24:06.458Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
[api] [2026-01-31T11:24:06.460Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-01-31T11:24:06.466Z] [INFO] [AI-6001][5ms] Timer finished: intent_parsing_e436d21c | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.13333333333333336},{"label":"RISK_SCAN","confidence":0}],"timerLabel":"intent_parsing_e436d21c"}
[api] [2026-01-31T11:24:06.466Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: true,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
[api]     'userRole',
[api]     'defaultSwapAmount',
[api]     'defaultSwapUnit',
[api]     'checkTokenBeforeSwap',
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
[api]   chainId: 8453
[api] }
[api] [2026-01-31T11:24:06.468Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":3,"skills":["swap","token_alert","wallet_portfolio"]}
[api] [2026-01-31T11:24:06.469Z] [INFO] [AI-6003][1ms] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":12046,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (0 tokens cached)
[api] [2026-01-31T11:24:06.469Z] [INFO] [AI-6007] ChatWorker: requested token balance resolved | DATA: {"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":8453,"requested":["ETH"],"matched":[],"missing":["ETH"],"resolvedBalances":{}}
[api] [ChatWorker] No tokenInfo available
[api] [2026-01-31T11:24:06.469Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-01-31T11:24:06.469Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":false,"hasPageContext":false,"hasToolConfig":true,"contextBytes":831}
[api] [2026-01-31T11:24:06.469Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":0,"sample":[],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-01-31T11:24:06.470Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":190}
[api] [2026-01-31T11:24:06.470Z] [INFO] [AI-6007] ChatWorker: balance system rule injected
[api] [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
[api] [ChatWorker] Broadcasting Thinking status for cml284vdy000710kzqn99m9ce. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-01-31T11:24:06.470Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-01-31T11:24:09.687Z] [INFO] [SYS-1001] No open positions to monitor
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-01-31T11:24:13.925Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-01-31T11:24:13.931Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [DBLock] Lock already held {
[api]   key: 'lock:tokenJob:refresh:base',
[api]   expiresAt: '2026-01-27T13:09:38.108Z',
[api]   ageMs: 339516542
[api] }
[api] [DBLock] Potential stale lock detected {
[api]   key: 'lock:tokenJob:refresh:base',
[api]   ageMs: 339516542,
[api]   ttlSeconds: 240
[api] }
[api] [TokenJob] Skipping refresh for Base - another instance holds the lock
[api] [2026-01-31T11:24:16.572Z] [INFO] [AI-6005][2638ms] Timer finished: launchpad_det_0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 | DATA: {"address":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","chainId":8453,"found":false,"timerLabel":"launchpad_det_0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"}
[api] [GetTokenInfo] Attempting DexScreener fallback...
[api] [ChatWorker] DeepSeek iteration 3/10 for task cml284ve0000910kzlu3fn12x
[api] [2026-01-31T11:24:18.813Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
[api] [2026-01-31T11:24:18.814Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-01-31T11:24:18.816Z] [INFO] [AI-6001][1ms] Timer finished: intent_parsing_b0c40c31 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.13333333333333336},{"label":"RISK_SCAN","confidence":0}],"timerLabel":"intent_parsing_b0c40c31"}
[api] [2026-01-31T11:24:18.817Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: true,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
[api]     'userRole',
[api]     'defaultSwapAmount',
[api]     'defaultSwapUnit',
[api]     'checkTokenBeforeSwap',
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
[api]   chainId: 8453
[api] }
[api] [2026-01-31T11:24:18.818Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":3,"skills":["swap","token_alert","wallet_portfolio"]}
[api] [2026-01-31T11:24:18.818Z] [INFO] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":12046,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (0 tokens cached)
[api] [2026-01-31T11:24:18.819Z] [INFO] [AI-6007] ChatWorker: requested token balance resolved | DATA: {"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":8453,"requested":["ETH"],"matched":[],"missing":["ETH"],"resolvedBalances":{}}
[api] [ChatWorker] No tokenInfo available
[api] [2026-01-31T11:24:18.819Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-01-31T11:24:18.819Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":false,"hasPageContext":false,"hasToolConfig":true,"contextBytes":831}
[api] [2026-01-31T11:24:18.819Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":0,"sample":[],"spotlight":[]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-01-31T11:24:18.819Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":190}
[api] [2026-01-31T11:24:18.820Z] [INFO] [AI-6007] ChatWorker: balance system rule injected
[api] [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
[api] [ChatWorker] Broadcasting Thinking status for cml284vdy000710kzqn99m9ce. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-01-31T11:24:18.820Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-01-31T11:24:19.693Z] [INFO] [SYS-1001] No open positions to monitor
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-01-31T11:24:27.104Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-01-31T11:24:27.108Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PrepareSwapTransaction] Preparing swap: {
[api]   token_in: 'BASE',
[api]   token_out: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
[api]   amount_in: '0.000378',
[api]   chain_id: 8453,
[api]   execute: true
[api] }
[api] [PrepareSwapTransaction] Using TradeContext: ctx_1769858667111_301kkjxpq
[api] [2026-01-31T11:24:27.112Z] [INFO] [SYS-1007] PrivyWallet Authorization Key config | DATA: {"keyFormat":"wallet-auth","keyLength":196,"keyIdConfigured":true,"keyId":"crdgro3bw0..."}
[api] [PrepareSwapTransaction] User wallet address: 0xA386bc9D...
[api] [PrepareSwapTransaction] ⚡ PRE-WARMING: Quote fetch started (performance optimization, non-critical)
[api] [PrepareSwapTransaction] Non-safe token detected, running MANDATORY Market Structure check...
[api] {"level":30,"time":1769858668405,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","req":{"method":"POST","url":"/api/swap/quote","hostname":"127.0.0.1:3001","remoteAddress":"127.0.0.1","remotePort":56777},"msg":"incoming request"}
[api] [originRestriction] Request blocked {
[api]   origin: '',
[api]   referer: '',
[api]   effectiveOrigin: '',
[api]   userAgent: 'node',
[api]   allowedOrigins: [
[api]     'http://localhost:5173',
[api]     'http://localhost:3000',
[api]     'http://127.0.0.1:5173',
[api]     'http://127.0.0.1:3000',
[api]     'capacitor://localhost'
[api]   ]
[api] }
[api] [originRestriction] DEV MODE: Allowing request despite origin mismatch
[api] [Swap Quote] Fetching metadata for: {
[api]   tokenInForMetadata: 'BASE',
[api]   tokenOutForMetadata: '0x833589fCD6',
[api]   actualTokenIn: 'BASE',
[api]   actualTokenOut: '0x833589fCD6',
[api]   isTokenOutNative: false
[api] }
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-01-31T11:24:29.697Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-01-31T11:24:30.056Z] [INFO] [API-5001][TID:e8c9ad2d-a2a0-407d-a941-4fc60b40512c] No token metadata available, trying RPC fallback... | DATA: {"tokenAddress":"BASE","chainId":8453}
[api] [2026-01-31T11:24:30.058Z] [INFO] [API-5001] On-chain price fetched from Uniswap V3 | DATA: {"token":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","price":0.9997306747772514,"marketCap":4159292376.322364}
[api] [2026-01-31T11:24:30.058Z] [INFO] [API-5001] ✅ Hybrid fetch complete | DATA: {"symbol":"USDC","price":0.9997306747772514,"liquidity":907348.37,"provider":"rpc+api"}
[api] [2026-01-31T11:24:30.084Z] [INFO] [API-5001][TID:e8c9ad2d-a2a0-407d-a941-4fc60b40512c] Using 0x API fallback token metadata | DATA: {"symbol":"USDC","chainId":8453}
[api] [2026-01-31T11:24:30.328Z] [WARN] [API-5002][TID:e8c9ad2d-a2a0-407d-a941-4fc60b40512c] RPC endpoint failed | DATA: {"chain":"Base","endpoint":1,"total":4,"error":"RPC Error: Invalid params","duration":271}
[api] [2026-01-31T11:24:31.297Z] [WARN] [API-5002][TID:e8c9ad2d-a2a0-407d-a941-4fc60b40512c] RPC endpoint failed | DATA: {"chain":"Base","endpoint":2,"total":4,"error":"HTTP 400: Bad Request","duration":918}
[api] [2026-01-31T11:24:32.968Z] [ERROR] [API-5002][TID:e8c9ad2d-a2a0-407d-a941-4fc60b40512c] All RPC endpoints failed | DATA: {"chain":"Base","totalEndpoints":4,"lastError":"RPC Error: Invalid params"}
[api] [2026-01-31T11:24:32.968Z] [ERROR] [API-5002][TID:e8c9ad2d-a2a0-407d-a941-4fc60b40512c] Error fetching decimals from RPC | DATA: {"tokenAddress":"BASE","error":"All RPC endpoints failed for Base. Last error: RPC Error: Invalid params"}
[api] [Swap Quote] Overriding tokenOut decimals to known value: 6
[api] [Swap Quote] Token decimals: {
[api]   tokenIn: 'BASE',
[api]   tokenOut: '0x833589fC',
[api]   tokenInDecimals: 18,
[api]   tokenOutDecimals: 6,
[api]   tokenOutMetadataDecimals: 6
[api] }
[api] [2026-01-31T11:24:33.255Z] [ERROR] [API-5002][TID:e8c9ad2d-a2a0-407d-a941-4fc60b40512c] api failed after 1 attempts | DATA: {"error":"HTTP 400: {\"name\":\"INPUT_INVALID\",\"message\":\"The input is invalid\",\"data\":{\"zid\":\"0x2feba7de01d98d12ddc795b1\",\"details\":[{\"field\":\"sellToken\",\"reason\":\"Invalid ethereum address\"}]}}","url":"https://api.0x.org/swap/allowance-holder/price?chainId=8453&"}
[api] [2026-01-31T11:24:33.256Z] [ERROR] [API-5002][TID:e8c9ad2d-a2a0-407d-a941-4fc60b40512c] 0x API price fetch error | DATA: {"error":"HTTP 400: {\"name\":\"INPUT_INVALID\",\"message\":\"The input is invalid\",\"data\":{\"zid\":\"0x2feba7de01d98d12ddc795b1\",\"details\":[{\"field\":\"sellToken\",\"reason\":\"Invalid ethereum address\"}]}}"}
[api] [PlatformFee] Fees DISABLED, returning 0 bps
[api] [Kyber] GET routes {
[api]   routesUrl: 'https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=BASE&tokenOut=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&amountIn=378000000000000&saveGas=true&gasInclude=true&clientId=kiko-app'
[api] }
[api] [2026-01-31T11:24:33.556Z] [ERROR] [API-5002][TID:e8c9ad2d-a2a0-407d-a941-4fc60b40512c] api failed after 1 attempts | DATA: {"error":"HTTP 400: {\"name\":\"INPUT_INVALID\",\"message\":\"The input is invalid\",\"data\":{\"zid\":\"0x116c5a8056b409419ded01ec\",\"details\":[{\"field\":\"sellToken\",\"reason\":\"Invalid ethereum address\"}]}}","url":"https://api.0x.org/swap/allowance-holder/quote?chainId=8453&"}
[api] [2026-01-31T11:24:33.556Z] [WARN] [API-5002][TID:e8c9ad2d-a2a0-407d-a941-4fc60b40512c] 0x API allowance-holder endpoint returned error, attempting v1 fallback | DATA: {"status":400,"chainId":8453,"hasValidData":null,"attemptedEndpoint":"allowance-holder","sellToken":"BASE...","buyToken":"0x833589fC...","reason":"HTTP error","error":"{\"name\":\"INPUT_INVALID\",\"message\":\"The input is invalid\",\"data\":{\"zid\":\"0x116c5a8056b409419ded01ec\","}
[api] [2026-01-31T11:24:33.846Z] [ERROR] [API-5002][TID:e8c9ad2d-a2a0-407d-a941-4fc60b40512c] api failed after 1 attempts | DATA: {"error":"HTTP 404: {\n  \"message\":\"no Route matched with those values\",\n  \"request_id\":\"16d26334ffa246103f2b3d5f9ffb506e\"\n}","url":"https://api.0x.org/swap/v1/quote?chainId=8453&sellToken=BASE"}
[api] [2026-01-31T11:24:33.847Z] [WARN] [API-5002][TID:e8c9ad2d-a2a0-407d-a941-4fc60b40512c] 0x API v1 fallback fetch failed | DATA: {"error":"HTTP 404: {\n  \"message\":\"no Route matched with those values\",\n  \"request_id\":\"16d26334ffa246103f2b3d5f9ffb506e\"\n}","originalError":"{\"name\":\"INPUT_INVALID\",\"message\":\"The input is invalid\",\"data\":{\"zid\":\"0x116c5a8056b409419ded01ec\",\"details\":[{\"field\":\"sellToken\",\"reason\":\"Invalid ethereum address\"}]}}"}
[api] [2026-01-31T11:24:33.847Z] [ERROR] [API-5002][TID:e8c9ad2d-a2a0-407d-a941-4fc60b40512c] 0x API Quote request failed | DATA: {"status":400,"statusText":"{\"name\":\"INPUT_INVALID\",\"message\":\"The input is invalid\",\"data\":{\"zid\":\"0x116c5a8056b409419ded01ec\",\"details\":[{\"field\":\"sellToken\",\"reason\":\"Invalid ethereum address\"}]}}","chainId":8453,"sellToken":"BASE","buyToken":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"}
[api] [2026-01-31T11:24:33.847Z] [ERROR] [API-5002][TID:e8c9ad2d-a2a0-407d-a941-4fc60b40512c] 0x API Error fetching quote | DATA: {"error":"0x API error (400): {\"name\":\"INPUT_INVALID\",\"message\":\"The input is invalid\",\"data\":{\"zid\":\"0x116c5a8056b409419ded01ec\",\"details\":[{\"field\":\"sellToken\",\"reason\":\"Invalid ethereum address\"}]}}"}
[api] [QuoteService] 0x failed Error: 0x API error (400): {"name":"INPUT_INVALID","message":"The input is invalid","data":{"zid":"0x116c5a8056b409419ded01ec","details":[{"field":"sellToken","reason":"Invalid ethereum address"}]}}
[api]     at getZeroExQuote (/Users/almurat/KiKo/kiko-api/src/services/zeroEx.ts:707:13)
[api]     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
[api]     at async fetchZeroEx (/Users/almurat/KiKo/kiko-api/src/services/quoteService.ts:110:23)
[api]     at async Promise.all (index 0)
[api]     at async getBestQuoteInternal (/Users/almurat/KiKo/kiko-api/src/services/quoteService.ts:209:5)
[api]     at async Object.<anonymous> (/Users/almurat/KiKo/kiko-api/src/routes/swap.ts:343:38)
[api] [DBLock] Lock already held {
[api]   key: 'lock:tokenJob:refresh:bsc',
[api]   expiresAt: '2026-01-27T12:25:43.423Z',
[api]   ageMs: 342171230
[api] }
[api] [DBLock] Potential stale lock detected { key: 'lock:tokenJob:refresh:bsc', ageMs: 342171230, ttlSeconds: 240 }
[api] [TokenJob] Skipping refresh for BSC - another instance holds the lock
[api] [2026-01-31T11:24:35.086Z] [ERROR] [API-5002][TID:e8c9ad2d-a2a0-407d-a941-4fc60b40512c] api failed after 1 attempts | DATA: {"error":"HTTP 400: {\"code\":4000,\"message\":\"bad request\",\"details\":[{\"fieldViolations\":[{\"field\":\"tokenIn\",\"description\":\"invalid\"}]}],\"requestId\":\"c166e613-e5a8-40b4-b64f-6737ceb70ea2\"}","url":"https://aggregator-api.kyberswap.com/base/api/v1/routes?toke"}
[api] [QuoteService] Kyber failed Error: HTTP 400: {"code":4000,"message":"bad request","details":[{"fieldViolations":[{"field":"tokenIn","description":"invalid"}]}],"requestId":"c166e613-e5a8-40b4-b64f-6737ceb70ea2"}
[api]     at fetchJson (/Users/almurat/KiKo/kiko-api/src/config/unifiedApiService.ts:169:15)
[api]     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
[api]     at async getKyberQuote (/Users/almurat/KiKo/kiko-api/src/services/kyberAggregator.ts:80:24)
[api]     at async fetchKyber (/Users/almurat/KiKo/kiko-api/src/services/quoteService.ts:167:32)
[api]     at async Promise.all (index 1)
[api]     at async getBestQuoteInternal (/Users/almurat/KiKo/kiko-api/src/services/quoteService.ts:209:5)
[api]     at async Object.<anonymous> (/Users/almurat/KiKo/kiko-api/src/routes/swap.ts:343:38)
[api] [Error Handler] {
[api]   "requestId": "req-l",
[api]   "method": "POST",
[api]   "url": "/api/swap/quote",
[api]   "ip": "127.0.0.1",
[api]   "error": {
[api]     "message": "No quotes available for BASE -> 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 on chain 8453",
[api]     "name": "Error",
[api]     "code": "QUOTE_ERROR",
[api]     "statusCode": 400,
[api]     "stack": "Error: No quotes available for BASE -> 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 on chain 8453\n    at Object.<anonymous> ([REDACTED_PATH]\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)"
[api]   }
[api] }
[api] {"level":30,"time":1769858675092,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","res":{"statusCode":400},"responseTime":6686.0371659994125,"msg":"request completed"}
[api] [PrepareSwapTransaction] Pre-warm unavailable (trying fresh quote for safety check)
[api] {"level":30,"time":1769858675096,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","req":{"method":"POST","url":"/api/swap/quote","hostname":"127.0.0.1:3001","remoteAddress":"127.0.0.1","remotePort":56923},"msg":"incoming request"}
[api] [originRestriction] Request blocked {
[api]   origin: '',
[api]   referer: '',
[api]   effectiveOrigin: '',
[api]   userAgent: 'node',
[api]   allowedOrigins: [
[api]     'http://localhost:5173',
[api]     'http://localhost:3000',
[api]     'http://127.0.0.1:5173',
[api]     'http://127.0.0.1:3000',
[api]     'capacitor://localhost'
[api]   ]
[api] }
[api] [originRestriction] DEV MODE: Allowing request despite origin mismatch
[api] [Swap Quote] Fetching metadata for: {
[api]   tokenInForMetadata: 'BASE',
[api]   tokenOutForMetadata: '0x833589fCD6',
[api]   actualTokenIn: 'BASE',
[api]   actualTokenOut: '0x833589fCD6',
[api]   isTokenOutNative: false
[api] }
[api] [Swap Quote] Overriding tokenOut decimals to known value: 6
[api] [Swap Quote] Token decimals: {
[api]   tokenIn: 'BASE',
[api]   tokenOut: '0x833589fC',
[api]   tokenInDecimals: 18,
[api]   tokenOutDecimals: 6,
[api]   tokenOutMetadataDecimals: undefined
[api] }
[api] [2026-01-31T11:24:35.385Z] [ERROR] [API-5002][TID:a8075f22-275b-4ddf-b961-5203a669bced] api failed after 1 attempts | DATA: {"error":"HTTP 400: {\"name\":\"INPUT_INVALID\",\"message\":\"The input is invalid\",\"data\":{\"zid\":\"0x71eb40df68d04ba0687c9090\",\"details\":[{\"field\":\"sellToken\",\"reason\":\"Invalid ethereum address\"}]}}","url":"https://api.0x.org/swap/allowance-holder/price?chainId=8453&"}
[api] [2026-01-31T11:24:35.385Z] [ERROR] [API-5002][TID:a8075f22-275b-4ddf-b961-5203a669bced] 0x API price fetch error | DATA: {"error":"HTTP 400: {\"name\":\"INPUT_INVALID\",\"message\":\"The input is invalid\",\"data\":{\"zid\":\"0x71eb40df68d04ba0687c9090\",\"details\":[{\"field\":\"sellToken\",\"reason\":\"Invalid ethereum address\"}]}}"}
[api] [2026-01-31T11:24:35.675Z] [ERROR] [API-5002][TID:a8075f22-275b-4ddf-b961-5203a669bced] api failed after 1 attempts | DATA: {"error":"HTTP 400: {\"name\":\"INPUT_INVALID\",\"message\":\"The input is invalid\",\"data\":{\"zid\":\"0x59cf07acf21841cb1d644969\",\"details\":[{\"field\":\"sellToken\",\"reason\":\"Invalid ethereum address\"}]}}","url":"https://api.0x.org/swap/allowance-holder/price?chainId=8453&"}
[api] [2026-01-31T11:24:35.675Z] [ERROR] [API-5002][TID:a8075f22-275b-4ddf-b961-5203a669bced] 0x API price fetch error | DATA: {"error":"HTTP 400: {\"name\":\"INPUT_INVALID\",\"message\":\"The input is invalid\",\"data\":{\"zid\":\"0x59cf07acf21841cb1d644969\",\"details\":[{\"field\":\"sellToken\",\"reason\":\"Invalid ethereum address\"}]}}"}
[api] [Error Handler] {
[api]   "requestId": "req-m",
[api]   "method": "POST",
[api]   "url": "/api/swap/quote",
[api]   "ip": "127.0.0.1",
[api]   "error": {
[api]     "message": "No quotes available for BASE -> 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 on chain 8453",
[api]     "name": "Error",
[api]     "code": "QUOTE_ERROR",
[api]     "statusCode": 400,
[api]     "stack": "Error: No quotes available for BASE -> 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 on chain 8453\n    at Object.<anonymous> ([REDACTED_PATH]\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)"
[api]   }
[api] }
[api] {"level":30,"time":1769858675676,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","res":{"statusCode":400},"responseTime":579.4678750000894,"msg":"request completed"}
[api] [PrepareSwapTransaction] Execution Decision: {
[api]   argsExecute: true,
[api]   swapMethod: 'allowance_trade',
[api]   fastSwapMode: true,
[api]   finalDecision: true
[api] }
[api] [PrepareSwapTransaction] Executing backend swap via internal API...
[api] [PrepareSwapTransaction] Created transaction message: cml285q77000c10kzfgebf0xv
[api] {"level":30,"time":1769858675690,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","req":{"method":"POST","url":"/api/swap/execute-instant","hostname":"127.0.0.1:3001","remoteAddress":"127.0.0.1","remotePort":56777},"msg":"incoming request"}
[api] [originRestriction] Request blocked {
[api]   origin: '',
[api]   referer: '',
[api]   effectiveOrigin: '',
[api]   userAgent: 'node',
[api]   allowedOrigins: [
[api]     'http://localhost:5173',
[api]     'http://localhost:3000',
[api]     'http://127.0.0.1:5173',
[api]     'http://127.0.0.1:3000',
[api]     'capacitor://localhost'
[api]   ]
[api] }
[api] [originRestriction] DEV MODE: Allowing request despite origin mismatch
[api] {"level":30,"time":1769858675722,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":56933},"msg":"incoming request"}
[api] {"level":30,"time":1769858675725,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","res":{"statusCode":204},"responseTime":1.491249999962747,"msg":"request completed"}
[api] {"level":30,"time":1769858675728,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":56933},"msg":"incoming request"}
[api] [Swap Execute Instant] Starting swap: {
[api]   userId: 'did:privy:',
[api]   wallet: '0xA386bc9D',
[api]   tokenIn: 'BASE',
[api]   tokenOut: '0x833589fc',
[api]   amountIn: '0.000378',
[api]   chainId: 8453
[api] }
[api] [2026-01-31T11:24:37.617Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] RPC endpoint failed | DATA: {"chain":"Base","endpoint":1,"total":4,"error":"RPC Error: Invalid params","duration":988}
[api] [2026-01-31T11:24:38.598Z] [ERROR] [API-5002][TID:301b7961-ac29-4a88-888b-a0f5b1464469] Alchemy Portfolio EVM API error | DATA: {}
[api] {"level":30,"time":1769858678859,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","res":{"statusCode":200},"responseTime":3131.2198329996318,"msg":"request completed"}
[api] {"level":30,"time":1769858678866,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":56933},"msg":"incoming request"}
[api] {"level":30,"time":1769858678866,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","res":{"statusCode":204},"responseTime":0.347957999445498,"msg":"request completed"}
[api] {"level":30,"time":1769858678870,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":56933},"msg":"incoming request"}
[api] [2026-01-31T11:24:39.016Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] RPC endpoint failed | DATA: {"chain":"Base","endpoint":2,"total":4,"error":"RPC Error: Invalid params","duration":1348}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-01-31T11:24:39.704Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-01-31T11:24:39.756Z] [ERROR] [API-5002][TID:f4c283a2-2517-4b5f-a1fc-e0175f9b0535] Alchemy Portfolio EVM API error | DATA: {}
[api] {"level":30,"time":1769858680026,"pid":9503,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","res":{"statusCode":200},"responseTime":1156.4939580000937,"msg":"request completed"}
[api] [2026-01-31T11:24:41.045Z] [ERROR] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] All RPC endpoints failed | DATA: {"chain":"Base","totalEndpoints":4,"lastError":"RPC Error: invalid argument 0: json: cannot unmarshal hex string without 0x prefix into Go struct field TransactionArgs.to of type common.Address"}
[api] [Swap Execute Instant] RPC balance check failed, proceeding with original amount: Error: All RPC endpoints failed for Base. Last error: RPC Error: invalid argument 0: json: cannot unmarshal hex string without 0x prefix into Go struct field TransactionArgs.to of type common.Address
[api]     at callRpc (/Users/almurat/KiKo/kiko-api/src/services/rpcManager.ts:215:11)
[api]     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
[api]     at async Object.<anonymous> (/Users/almurat/KiKo/kiko-api/src/routes/swap.ts:1005:47)
[api] [2026-01-31T11:24:42.135Z] [ERROR] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] api failed after 1 attempts | DATA: {"error":"HTTP 400: {\"name\":\"INPUT_INVALID\",\"message\":\"The input is invalid\",\"data\":{\"zid\":\"0x88940635192de699eac90bfe\",\"details\":[{\"field\":\"sellToken\",\"reason\":\"Invalid ethereum address\"}]}}","url":"https://api.0x.org/swap/allowance-holder/price?chainId=8453&"}
[api] [2026-01-31T11:24:42.135Z] [ERROR] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] 0x API price fetch error | DATA: {"error":"HTTP 400: {\"name\":\"INPUT_INVALID\",\"message\":\"The input is invalid\",\"data\":{\"zid\":\"0x88940635192de699eac90bfe\",\"details\":[{\"field\":\"sellToken\",\"reason\":\"Invalid ethereum address\"}]}}"}
[api] [Swap Execute Instant] Judge engine skipped - only runs for copy trade
[api] [2026-01-31T11:24:42.138Z] [INFO] [EXE-4002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] [MainSwapService][1769858682137_hccpma] Starting unified swap execution | DATA: {"mode":"swap-card","tokenIn":"BASE","tokenOut":"0x833589fcd6","amount":"0.000378","chainId":8453,"tradeContextId":"ctx_1769858682137_xacqonf1v"}
[api] [2026-01-31T11:24:42.138Z] [INFO] [AI-6005][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] Timer finished: launchpad_det_BASE | DATA: {"address":"BASE","chainId":8453,"found":false,"timerLabel":"launchpad_det_BASE"}
[api] [2026-01-31T11:24:42.139Z] [INFO] [EXE-4002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] [MainSwapService][1769858682137_hccpma] Executing EVM swap via SwapExecutor | DATA: {"chainId":8453,"tokenIn":"BASE","tokenOut":"0x833589fcd6"}
[api] [2026-01-31T11:24:42.139Z] [INFO] [EXE-4002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] Initiating Unified Swap Execution | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","chainId":8453,"tokenIn":"BASE","tokenOut":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","amount":"0.000378"}
[api] [2026-01-31T11:24:42.150Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] All on-chain DEX queries failed | DATA: {"token":"BASE","chainId":8453}
[api] [2026-01-31T11:24:42.406Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] RPC endpoint failed | DATA: {"chain":"Base","endpoint":1,"total":4,"error":"RPC Error: Invalid params","duration":264}
[api] [2026-01-31T11:24:43.005Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] RPC endpoint failed | DATA: {"chain":"Base","endpoint":2,"total":4,"error":"RPC Error: Invalid params","duration":548}
[api] [2026-01-31T11:24:43.126Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] RPC endpoint failed | DATA: {"chain":"Base","endpoint":1,"total":4,"error":"RPC Error: Invalid params","duration":982}
[api] [2026-01-31T11:24:43.137Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] RPC endpoint failed | DATA: {"chain":"Base","endpoint":1,"total":4,"error":"RPC Error: Invalid params","duration":993}
[api] [2026-01-31T11:24:43.666Z] [ERROR] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] All RPC endpoints failed | DATA: {"chain":"Base","totalEndpoints":4,"lastError":"RPC Error: invalid argument 0: json: cannot unmarshal hex string without 0x prefix into Go struct field TransactionArgs.to of type common.Address"}
[api] [2026-01-31T11:24:43.957Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] RPC endpoint failed | DATA: {"chain":"Base","endpoint":2,"total":4,"error":"RPC Error: Invalid params","duration":780}
[api] [2026-01-31T11:24:44.605Z] [ERROR] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] All RPC endpoints failed | DATA: {"chain":"Base","totalEndpoints":4,"lastError":"RPC Error: invalid argument 0: json: cannot unmarshal hex string without 0x prefix into Go struct field TransactionArgs.to of type common.Address"}
[api] [2026-01-31T11:24:44.827Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] RPC circuit breaker opened | DATA: {"endpoint":"https://rpc.ankr.com/base/***","failures":5}
[api] [2026-01-31T11:24:44.827Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] RPC endpoint failed | DATA: {"chain":"Base","endpoint":2,"total":4,"error":"RPC Error: Invalid params","duration":1639}
[api] [2026-01-31T11:24:45.155Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] RPC circuit breaker opened | DATA: {"endpoint":"https://base.drpc.org","failures":5}
[api] [2026-01-31T11:24:45.536Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] RPC circuit breaker opened | DATA: {"endpoint":"https://base-rpc.publicnode.com","failures":5}
[api] [2026-01-31T11:24:45.536Z] [ERROR] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] All RPC endpoints failed | DATA: {"chain":"Base","totalEndpoints":4,"lastError":"RPC Error: invalid argument 0: json: cannot unmarshal hex string without 0x prefix into Go struct field TransactionArgs.to of type common.Address"}
[api] [RpcService] Failed to fetch decimals for BASE on chain 8453
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-01-31T11:24:49.709Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-01-31T11:24:51.645Z] [ERROR] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] GeckoTerminal API error after retries | DATA: {"endpoint":"/networks/base/tokens/BASE/pools?include=base_token,quote_token","error":"HTTP 404: Not Found"}
[api] [2026-01-31T11:24:51.645Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] All API liquidity sources failed | DATA: {"token":"BASE"}
[api] [2026-01-31T11:24:51.645Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] RPC price failed, falling back to full API fetch | DATA: {"token":"BASE"}
[api] [DBLock] Lock already held {
[api]   key: 'lock:tokenJob:refresh:arbitrum',
[api]   expiresAt: '2026-01-27T14:10:39.713Z',
[api]   ageMs: 335894945
[api] }
[api] [DBLock] Potential stale lock detected {
[api]   key: 'lock:tokenJob:refresh:arbitrum',
[api]   ageMs: 335894945,
[api]   ttlSeconds: 240
[api] }
[api] [TokenJob] Skipping refresh for Arbitrum - another instance holds the lock
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-01-31T11:24:59.712Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-01-31T11:25:00.284Z] [ERROR] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] GeckoTerminal API error after retries | DATA: {"endpoint":"/networks/base/tokens/BASE/pools?include=base_token,quote_token","error":"HTTP 404: Not Found"}
[api] [2026-01-31T11:25:00.285Z] [ERROR] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] Critical: No valid price data available | DATA: {"token":"BASE","rpcResult":null,"liquidityResult":null}
[api] [DBLock] Lock already held {
[api]   key: 'lock:tokenJob:refresh:eth',
[api]   expiresAt: '2026-01-27T12:24:00.148Z',
[api]   ageMs: 342300613
[api] }
[api] [DBLock] Potential stale lock detected { key: 'lock:tokenJob:refresh:eth', ageMs: 342300613, ttlSeconds: 240 }
[api] [TokenJob] Skipping refresh for Ethereum - another instance holds the lock
[api] [2026-01-31T11:25:00.790Z] [INFO] [SYS-1007] SocialRepo: Recalculated heat scores for 811 casts
[api] [2026-01-31T11:25:00.790Z] [INFO] [SYS-1007][30ms] Timer finished: recalc_heat_scores | DATA: {"count":811,"timerLabel":"recalc_heat_scores"}
[api] [2026-01-31T11:25:01.485Z] [INFO] [API-5001][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] On-chain price fetched from Uniswap V3 | DATA: {"token":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","price":0.9997306747772514,"marketCap":4159284088.648402}
[api] [2026-01-31T11:25:01.485Z] [INFO] [API-5001][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] ✅ Hybrid fetch complete | DATA: {"symbol":"USDC","price":0.9997306747772514,"liquidity":907348.37,"provider":"rpc+api"}
[api] [2026-01-31T11:25:01.487Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] All on-chain DEX queries failed | DATA: {"token":"BASE","chainId":8453}
[api] [2026-01-31T11:25:01.736Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] RPC endpoint failed | DATA: {"chain":"Base","endpoint":1,"total":4,"error":"RPC Error: Invalid params","duration":250}
[api] [2026-01-31T11:25:01.744Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] RPC endpoint failed | DATA: {"chain":"Base","endpoint":1,"total":4,"error":"RPC Error: Invalid params","duration":258}
[api] [2026-01-31T11:25:01.745Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] RPC endpoint failed | DATA: {"chain":"Base","endpoint":1,"total":4,"error":"RPC Error: Invalid params","duration":259}
[api] [2026-01-31T11:25:01.787Z] [ERROR] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] All RPC endpoints failed | DATA: {"chain":"Base","totalEndpoints":4,"lastError":"RPC Error: Invalid params"}
[api] [2026-01-31T11:25:01.794Z] [ERROR] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] All RPC endpoints failed | DATA: {"chain":"Base","totalEndpoints":4,"lastError":"RPC Error: Invalid params"}
[api] [2026-01-31T11:25:01.795Z] [ERROR] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] All RPC endpoints failed | DATA: {"chain":"Base","totalEndpoints":4,"lastError":"RPC Error: Invalid params"}
[api] [RpcService] Failed to fetch decimals for BASE on chain 8453
[api] Saved 15 trending tokens to database via Prisma with retry protection
[api] [MarketJob] Trending tokens refreshed: 15 tokens
[api] [PrepareSwapTransaction] Socket error - waiting for backend to complete transaction...
[api] [2026-01-31T11:25:06.187Z] [WARN] [API-5004][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] GeckoTerminal 429 triggered backoff | DATA: {"backoffMs":60000}
[api] [PrepareSwapTransaction] Polling... 3s elapsed (5 attempts)
[api] [2026-01-31T11:25:08.639Z] [INFO] [SYS-1007] Alpha Detector: Checking new coin | DATA: {"symbol":"hyperliquidized","creator":"0xb1820293a86850e07a504a80f4d105ab7ec15306"}
[api] [2026-01-31T11:25:09.005Z] [INFO] [SYS-1007] Alpha Detector: Checking new coin | DATA: {"symbol":"xaihub","creator":"0xa73f7f298fee3b1565d94b50df097c07373c23b7"}
[api] [2026-01-31T11:25:09.396Z] [INFO] [SYS-1007] Alpha Detector: Checking new coin | DATA: {"symbol":"trendbase","creator":"0x0fd07f355e26882bc3cd5c0ec75a1f50542e4e58"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-01-31T11:25:09.718Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-01-31T11:25:09.758Z] [INFO] [SYS-1007] Alpha Detector: Checking new coin | DATA: {"symbol":"pepsodent","creator":"0x35064036c1586e1db71f832b4aa107c0de6f930d"}
[api] [2026-01-31T11:25:10.455Z] [ERROR] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] GeckoTerminal API error after retries | DATA: {"endpoint":"/networks/base/tokens/BASE/pools?include=base_token,quote_token","error":"HTTP 404: Not Found"}
[api] [2026-01-31T11:25:10.455Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] All API liquidity sources failed | DATA: {"token":"BASE"}
[api] [2026-01-31T11:25:10.456Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] RPC price failed, falling back to full API fetch | DATA: {"token":"BASE"}
[api] [2026-01-31T11:25:10.456Z] [ERROR] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] Critical: No valid price data available | DATA: {"token":"BASE","rpcResult":null,"liquidityResult":null}
[api] [2026-01-31T11:25:11.856Z] [WARN] [SYS-1006][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] Failed to fetch decimals, defaulting to 18 | DATA: {"token":"BASE"}
[api] [PlatformFee] Fees DISABLED, returning 0 bps
[api] [2026-01-31T11:25:12.960Z] [ERROR] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] api failed after 1 attempts | DATA: {"error":"HTTP 400: {\"name\":\"INPUT_INVALID\",\"message\":\"The input is invalid\",\"data\":{\"zid\":\"0x35892c232f0a72d3fa864d0b\",\"details\":[{\"field\":\"sellToken\",\"reason\":\"Invalid ethereum address\"}]}}","url":"https://api.0x.org/swap/allowance-holder/price?chainId=8453&"}
[api] [2026-01-31T11:25:12.960Z] [ERROR] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] 0x API price fetch error | DATA: {"error":"HTTP 400: {\"name\":\"INPUT_INVALID\",\"message\":\"The input is invalid\",\"data\":{\"zid\":\"0x35892c232f0a72d3fa864d0b\",\"details\":[{\"field\":\"sellToken\",\"reason\":\"Invalid ethereum address\"}]}}"}
[api] [PlatformFee] Fees DISABLED, returning 0 bps
[api] [Kyber] GET routes {
[api]   routesUrl: 'https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=BASE&tokenOut=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&amountIn=378000000000000&saveGas=true&gasInclude=true&clientId=kiko-app'
[api] }
[api] [2026-01-31T11:25:14.096Z] [ERROR] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] api failed after 1 attempts | DATA: {"error":"HTTP 400: {\"name\":\"INPUT_INVALID\",\"message\":\"The input is invalid\",\"data\":{\"zid\":\"0x46471a29235c27650cc87d43\",\"details\":[{\"field\":\"sellToken\",\"reason\":\"Invalid ethereum address\"}]}}","url":"https://api.0x.org/swap/allowance-holder/quote?chainId=8453&"}
[api] [2026-01-31T11:25:14.097Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] 0x API allowance-holder endpoint returned error, attempting v1 fallback | DATA: {"status":400,"chainId":8453,"hasValidData":null,"attemptedEndpoint":"allowance-holder","sellToken":"BASE...","buyToken":"0x833589fc...","reason":"HTTP error","error":"{\"name\":\"INPUT_INVALID\",\"message\":\"The input is invalid\",\"data\":{\"zid\":\"0x46471a29235c27650cc87d43\","}
[api] [2026-01-31T11:25:14.167Z] [ERROR] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] api failed after 1 attempts | DATA: {"error":"HTTP 400: {\"code\":4000,\"message\":\"bad request\",\"details\":[{\"fieldViolations\":[{\"field\":\"tokenIn\",\"description\":\"invalid\"}]}],\"requestId\":\"cc6bd41b-bf7f-4da9-b438-f10c654222bc\"}","url":"https://aggregator-api.kyberswap.com/base/api/v1/routes?toke"}
[api] [QuoteService] Kyber failed Error: HTTP 400: {"code":4000,"message":"bad request","details":[{"fieldViolations":[{"field":"tokenIn","description":"invalid"}]}],"requestId":"cc6bd41b-bf7f-4da9-b438-f10c654222bc"}
[api]     at fetchJson (/Users/almurat/KiKo/kiko-api/src/config/unifiedApiService.ts:169:15)
[api]     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
[api]     at async getKyberQuote (/Users/almurat/KiKo/kiko-api/src/services/kyberAggregator.ts:80:24)
[api]     at async fetchKyber (/Users/almurat/KiKo/kiko-api/src/services/quoteService.ts:167:32)
[api]     at async Promise.all (index 1)
[api]     at async getBestQuoteInternal (/Users/almurat/KiKo/kiko-api/src/services/quoteService.ts:209:5)
[api]     at async Function.executeEvm (/Users/almurat/KiKo/kiko-api/src/services/swap/SwapExecutor.ts:232:26)
[api]     at async Function.execute (/Users/almurat/KiKo/kiko-api/src/services/swap/SwapExecutor.ts:88:24)
[api]     at async Function.executeEvmSwap (/Users/almurat/KiKo/kiko-api/src/services/MainSwapService.ts:419:29)
[api]     at async Function.executeSwap (/Users/almurat/KiKo/kiko-api/src/services/MainSwapService.ts:181:16)
[api] [2026-01-31T11:25:14.387Z] [ERROR] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] api failed after 1 attempts | DATA: {"error":"HTTP 404: {\n  \"message\":\"no Route matched with those values\",\n  \"request_id\":\"05a32b26d5d67e14f0f97c7f6c418c05\"\n}","url":"https://api.0x.org/swap/v1/quote?chainId=8453&sellToken=BASE"}
[api] [2026-01-31T11:25:14.388Z] [WARN] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] 0x API v1 fallback fetch failed | DATA: {"error":"HTTP 404: {\n  \"message\":\"no Route matched with those values\",\n  \"request_id\":\"05a32b26d5d67e14f0f97c7f6c418c05\"\n}","originalError":"{\"name\":\"INPUT_INVALID\",\"message\":\"The input is invalid\",\"data\":{\"zid\":\"0x46471a29235c27650cc87d43\",\"details\":[{\"field\":\"sellToken\",\"reason\":\"Invalid ethereum address\"}]}}"}
[api] [2026-01-31T11:25:14.388Z] [ERROR] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] 0x API Quote request failed | DATA: {"status":400,"statusText":"{\"name\":\"INPUT_INVALID\",\"message\":\"The input is invalid\",\"data\":{\"zid\":\"0x46471a29235c27650cc87d43\",\"details\":[{\"field\":\"sellToken\",\"reason\":\"Invalid ethereum address\"}]}}","chainId":8453,"sellToken":"BASE","buyToken":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"}
[api] [2026-01-31T11:25:14.388Z] [ERROR] [API-5002][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] 0x API Error fetching quote | DATA: {"error":"0x API error (400): {\"name\":\"INPUT_INVALID\",\"message\":\"The input is invalid\",\"data\":{\"zid\":\"0x46471a29235c27650cc87d43\",\"details\":[{\"field\":\"sellToken\",\"reason\":\"Invalid ethereum address\"}]}}"}
[api] [QuoteService] 0x failed Error: 0x API error (400): {"name":"INPUT_INVALID","message":"The input is invalid","data":{"zid":"0x46471a29235c27650cc87d43","details":[{"field":"sellToken","reason":"Invalid ethereum address"}]}}
[api]     at getZeroExQuote (/Users/almurat/KiKo/kiko-api/src/services/zeroEx.ts:707:13)
[api]     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
[api]     at async fetchZeroEx (/Users/almurat/KiKo/kiko-api/src/services/quoteService.ts:110:23)
[api]     at async Promise.all (index 0)
[api]     at async getBestQuoteInternal (/Users/almurat/KiKo/kiko-api/src/services/quoteService.ts:209:5)
[api]     at async Function.executeEvm (/Users/almurat/KiKo/kiko-api/src/services/swap/SwapExecutor.ts:232:26)
[api]     at async Function.execute (/Users/almurat/KiKo/kiko-api/src/services/swap/SwapExecutor.ts:88:24)
[api]     at async Function.executeEvmSwap (/Users/almurat/KiKo/kiko-api/src/services/MainSwapService.ts:419:29)
[api]     at async Function.executeSwap (/Users/almurat/KiKo/kiko-api/src/services/MainSwapService.ts:181:16)
[api]     at async Object.<anonymous> (/Users/almurat/KiKo/kiko-api/src/routes/swap.ts:1077:36)
[api] [2026-01-31T11:25:14.388Z] [ERROR] [EXE-4004][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] Swap Execution Failed | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","chainId":8453,"tokenIn":"BASE","tokenOut":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","amount":"0.000378","error":"No valid quotes found"}
[api] [2026-01-31T11:25:14.389Z] [ERROR] [EXE-4004][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] Raw Swap Error Captured | DATA: {"msg":"No valid quotes found","errorData":{}}
[api] [2026-01-31T11:25:14.389Z] [ERROR] [EXE-4004][TID:a94882bb-b141-4e52-bb4f-95afd5162aec] [MainSwapService][1769858682137_hccpma] Swap execution failed: Swap failed: No valid quotes found | DATA: {"error":"Swap failed: No valid quotes found","stack":"Error: Swap failed: No valid quotes found"}
[api] [Swap Execute Instant] Error: AppError: Swap failed: No valid quotes found
[api]     at Object.<anonymous> (/Users/almurat/KiKo/kiko-api/src/routes/swap.ts:1095:27)
[api]     at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {
[api]   statusCode: 500,
[api]   code: 'SWAP_FAILED',
[api]   logCode: 'SYS-1001',
[api]   isOperational: true
[api] }
[api] [Error Handler] {
[api]   "requestId": "req-n",
[api]   "method": "POST",
[api]   "url": "/api/swap/execute-instant",
[api]   "ip": "127.0.0.1",
[api]   "error": {
[api]     "message": "Swap failed: No valid quotes found",
[api]     "name": "Error",
[api]     "code": "SWAP_FAILED",
[api]     "statusCode": 500,
[api]     "stack": "Error: Swap failed: No valid quotes found\n    at Object.<anonymous> ([REDACTED_PATH]\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)"
[api]   }
[api] }
[api] [DBLock] Lock already held {
[api]   key: 'lock:tokenJob:refresh:optimism',
[api]   expiresAt: '2026-01-27T12:16:11.225Z',
[api]   ageMs: 342783436
[api] }
[api] [DBLock] Potential stale lock detected {
[api]   key: 'lock:tokenJob:refresh:optimism',
[api]   ageMs: 342783436,
[api]   ttlSeconds: 240
[api] }
[api] [TokenJob] Skipping refresh for Optimism - another instance holds the lock
[api] [PrepareSwapTransaction] Polling... 10s elapsed (10 attempts)
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-01-31T11:25:19.728Z] [INFO] [SYS-1001] No open positions to monitor
[api] [DBLock] Lock already held {
[api]   key: 'lock:tokenJob:refresh:solana',
[api]   expiresAt: '2026-01-28T08:14:15.060Z',
[api]   ageMs: 270905703
[api] }
[api] [DBLock] Potential stale lock detected {
[api]   key: 'lock:tokenJob:refresh:solana',
[api]   ageMs: 270905703,
[api]   ttlSeconds: 240
[api] }
[api] [TokenJob] Skipping refresh for Solana - another instance holds the lock
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-01-31T11:25:29.732Z] [INFO] [SYS-1001] No open positions to monitor
[api] [PrepareSwapTransaction] Polling... 25s elapsed (15 attempts)
[api] [DBLock] Lock already held {
[api]   key: 'lock:tokenJob:refresh:polygon',
[api]   expiresAt: '2026-01-27T16:45:37.443Z',
[api]   ageMs: 326637221
[api] }
[api] [DBLock] Potential stale lock detected {
[api]   key: 'lock:tokenJob:refresh:polygon',
[api]   ageMs: 326637221,
[api]   ttlSeconds: 240
[api] }
[api] [TokenJob] Skipping refresh for Polygon - another instance holds the lock
[api] [TokenJob] Refreshed 7 chains in 120.0s

