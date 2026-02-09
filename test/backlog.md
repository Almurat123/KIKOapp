[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   userIdLength: 35,
[api]   userIdPrefix: 'did:privy:cmj0a3j3f0',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] [verifyAccess] ✅ Access granted
[api] [16:48:13] [inf] [METRIC] [API-5001] Alchemy Portfolio response received | tid=e8c4305d-90a5-4f7a-a577-5cb9154db5b7 duration=1673
[api] [16:48:14] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | tid=157bf051-38e8-43af-bb6f-d40002143ac7 userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status dur=1ms
[api] [16:48:14] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | tid=157bf051-38e8-43af-bb6f-d40002143ac7 userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=message_start connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start
[api] [16:48:15] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [16:48:15] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [16:48:15] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[python] INFO:moderation.router:Moderating input: Sell 1 USDC to POL...
[api] [16:48:15] [inf] [METRIC] [API-5001] Alchemy Portfolio response received | tid=d41ec4b2-b532-4eba-a612-dad115db76e6 duration=753
[api] [16:48:16] [inf] [METRIC] [API-5001] Alchemy Portfolio response received | tid=157bf051-38e8-43af-bb6f-d40002143ac7 duration=1153
[api] [16:48:16] [inf] [METRIC] [API-5001] Alchemy Portfolio response received | tid=c1464955-2095-4320-ae04-e3c1abb6bf46 duration=1188
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:56263 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [16:48:16] [inf] [EVENT] [SYS-1007] Moderation Input check result | safe=true action=allow userId=did:privy:cmj0a3j3f005fl20c4xkl7195
[api] [16:48:16] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status dur=1ms
[api] [16:48:16] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=message_start connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start
[api] [ChatWorker] Sent message_start for cmlfeom61000b2277up1fmds4
[api] [ChatWorker] Base filtered to 46 tools for message: "Sell 1 USDC to POL..."
[api] [ChatWorker] 🔍 RAG check for: "Sell 1 USDC to POL..."
[api] [ChatWorker] ⏭️ RAG: Skipped (RAG disabled or query not informational).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cmlfeom62000d2277nteqjybo
[api] [16:48:16] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status dur=1ms
[api] [16:48:16] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status dur=1ms
[api] [16:48:16] [inf] [TRACE] [AI-6001] Timer finished: intent_parsing_c8ecadb1 | userAddress=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E intent=swap highLevelIntent=TRADING hasAI=false confidence=0.95 routingStage=rule hardRule=TRADING slotsComplete=true labels=[3] timerLabel=intent_parsing_c8ecadb1 dur=7ms
[api] [16:48:16] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status dur=1ms
[api] [16:48:16] [inf] [TRACE] [AI-6009] DeepSeek: routed to mode | taskId=cmlfeom62000d2277nteqjybo sessionId=cmlfeom4r00052277zp43ikaw model=deepseek-chat intent=TRADING routingMode=execution hardRule={Obj} confidence=0.95
[api] [ChatWorker] Skill-gated to 13 tools for intent=TRADING skills=cross_chain_swap, swap, token_alert, wallet_portfolio
[api] [16:48:16] [inf] [TRACE] [AI-6010] DeepSeek: skills attached | taskId=cmlfeom62000d2277nteqjybo sessionId=cmlfeom4r00052277zp43ikaw model=deepseek-chat intent=TRADING routingMode=execution skillVersion=exec skills=[4] toolCount=13
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: false,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
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
[api]     'id',
[api]     'userId',
[api]     'quickSwapMode',
[api]     'copyTradeAIMode',
[api]     'updatedAt',
[api]     'createdAt',
[api]     'copyTradeTokenCooldownMinutes',
[api]     'minLiquidityUsd',
[api]     'minMarketCapUsd',
[api]     'minTargetValueUsd',
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
[api] [GetWalletInfo] Attempting Alchemy...
[api] [16:48:16] [inf] [TRACE] [AI-6006] PromptOrchestrator: Intent matched skills | intent=TRADING count=4 skills=[4]
[api] [16:48:16] [inf] [TRACE] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | model=deepseek intent=TRADING length=13479 timerLabel=prompt_gen_TRADING_deepseek
[api] [ChatWorker] No tokenInfo available
[api] [16:48:16] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [ChatWorker] Broadcasting Thinking status for cmlfeom61000b2277up1fmds4. Message order: message_start → Thinking → content_chunks
[api] [16:48:16] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [16:48:16] [inf] [METRIC] [API-5001] Alchemy Portfolio response received | duration=325
[api] [16:48:17] [inf] [METRIC] [API-5001] Alchemy Portfolio response received | tid=0a42c98f-b231-4d50-ae05-d11b8fb5cf01 duration=448
[api] [16:48:17] [inf] [METRIC] [API-5001] Alchemy Portfolio response received | tid=32d544ba-1c54-44eb-ae78-1c96488e33dd duration=400
[api] [16:48:18] [inf] [METRIC] [API-5001] Alchemy Portfolio response received | tid=df391cdc-2b99-4bd3-b694-20b13b055721 duration=331
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [16:48:21] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=usage connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage
[api] [16:48:21] [inf] [TRACE] [AI-6011] ChatWorker: executing tools batch | sessionId=cmlfeom4r00052277zp43ikaw messageId=cmlfeom61000b2277up1fmds4 userId=did:privy:cmj0a3j3f005fl20c4xkl7195 toolCount=1
[api] [16:48:21] [inf] [TRACE] [AI-6007] ChatWorker: tool start | tool=get_wallet_info sessionId=cmlfeom4r00052277zp43ikaw messageId=cmlfeom61000b2277up1fmds4 userId=did:privy:cmj0a3j3f005fl20c4xkl7195
[api] [16:48:21] [inf] [TRACE] [AI-6007] ChatWorker: get_wallet_info short-circuited to client context | chainId=137
[api] [ChatWorker] DeepSeek iteration 2/10 for task cmlfeom62000d2277nteqjybo
[api] [16:48:21] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [16:48:21] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [16:48:21] [inf] [TRACE] [AI-6001] Timer finished: intent_parsing_10f254c6 | userAddress=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E intent=swap highLevelIntent=TRADING hasAI=false confidence=0.95 routingStage=rule hardRule=TRADING slotsComplete=true labels=[3] timerLabel=intent_parsing_10f254c6 dur=3ms
[api] [16:48:21] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: false,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
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
[api]     'id',
[api]     'userId',
[api]     'quickSwapMode',
[api]     'copyTradeAIMode',
[api]     'updatedAt',
[api]     'createdAt',
[api]     'copyTradeTokenCooldownMinutes',
[api]     'minLiquidityUsd',
[api]     'minMarketCapUsd',
[api]     'minTargetValueUsd',
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
[api] [16:48:21] [inf] [TRACE] [AI-6006] PromptOrchestrator: Intent matched skills | intent=TRADING count=4 skills=[4]
[api] [16:48:21] [inf] [TRACE] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | model=deepseek intent=TRADING length=13479 timerLabel=prompt_gen_TRADING_deepseek
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (2 tokens cached)
[api] [16:48:21] [inf] [TRACE] [AI-6007] ChatWorker: requested token balance resolved | walletAddress=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E chainId=137 requested=[2] matched=[1] missing=[1] resolvedBalances={"USDC":"4.869828"}
[api] [ChatWorker] No tokenInfo available
[api] [16:48:21] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [ChatWorker] Broadcasting Thinking status for cmlfeom61000b2277up1fmds4. Message order: message_start → Thinking → content_chunks
[api] [16:48:21] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [16:48:26] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=usage connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage dur=1ms
[api] [16:48:26] [inf] [TRACE] [AI-6011] ChatWorker: executing tools batch | sessionId=cmlfeom4r00052277zp43ikaw messageId=cmlfeom61000b2277up1fmds4 userId=did:privy:cmj0a3j3f005fl20c4xkl7195 toolCount=1
[api] [16:48:26] [inf] [TRACE] [AI-6007] ChatWorker: tool start | tool=external_web_search sessionId=cmlfeom4r00052277zp43ikaw messageId=cmlfeom61000b2277up1fmds4 userId=did:privy:cmj0a3j3f005fl20c4xkl7195
[api] [16:48:26] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [16:48:28] [inf] [EVENT] [SYS-1007] Tavily search completed | query=POL token contract address Polygon MATIC token count=3
[api] [16:48:28] [inf] [TRACE] [AI-6007] ChatWorker: tool success | tool=external_web_search sessionId=cmlfeom4r00052277zp43ikaw messageId=cmlfeom61000b2277up1fmds4 userId=did:privy:cmj0a3j3f005fl20c4xkl7195 dur=2368ms
[api] [16:48:28] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_citations | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=citations connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_citations
[api] [ChatWorker] DeepSeek iteration 3/10 for task cmlfeom62000d2277nteqjybo
[api] [16:48:28] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [16:48:28] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [16:48:28] [inf] [TRACE] [AI-6001] Timer finished: intent_parsing_2fe3cb07 | userAddress=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E intent=swap highLevelIntent=TRADING hasAI=false confidence=0.95 routingStage=rule hardRule=TRADING slotsComplete=true labels=[3] timerLabel=intent_parsing_2fe3cb07 dur=5ms
[api] [16:48:28] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: false,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
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
[api]     'id',
[api]     'userId',
[api]     'quickSwapMode',
[api]     'copyTradeAIMode',
[api]     'updatedAt',
[api]     'createdAt',
[api]     'copyTradeTokenCooldownMinutes',
[api]     'minLiquidityUsd',
[api]     'minMarketCapUsd',
[api]     'minTargetValueUsd',
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
[api] [16:48:28] [inf] [TRACE] [AI-6006] PromptOrchestrator: Intent matched skills | intent=TRADING count=4 skills=[4]
[api] [16:48:28] [inf] [TRACE] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | model=deepseek intent=TRADING length=13479 timerLabel=prompt_gen_TRADING_deepseek
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (2 tokens cached)
[api] [16:48:28] [inf] [TRACE] [AI-6007] ChatWorker: requested token balance resolved | walletAddress=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E chainId=137 requested=[2] matched=[1] missing=[1] resolvedBalances={"USDC":"4.869828"}
[api] [ChatWorker] No tokenInfo available
[api] [16:48:28] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [ChatWorker] Broadcasting Thinking status for cmlfeom61000b2277up1fmds4. Message order: message_start → Thinking → content_chunks
[api] [16:48:28] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [16:48:34] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=usage connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage
[api] [16:48:34] [inf] [TRACE] [AI-6011] ChatWorker: executing tools batch | sessionId=cmlfeom4r00052277zp43ikaw messageId=cmlfeom61000b2277up1fmds4 userId=did:privy:cmj0a3j3f005fl20c4xkl7195 toolCount=1
[api] [16:48:34] [inf] [TRACE] [AI-6007] ChatWorker: tool start | tool=simulate_swap sessionId=cmlfeom4r00052277zp43ikaw messageId=cmlfeom61000b2277up1fmds4 userId=did:privy:cmj0a3j3f005fl20c4xkl7195
[api] [16:48:34] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [Swap Quote] Fetching metadata for: {
[api]   tokenInForMetadata: '0x3c499c542c',
[api]   tokenOutForMetadata: '0x455e53CBB8',
[api]   actualTokenIn: '0x3c499c542c',
[api]   actualTokenOut: '0x455e53CBB8',
[api]   isTokenOutNative: false
[api] }
[api] [16:48:36] [inf] [METRIC] [API-5001] No token metadata available, trying RPC fallback... | tid=c2be8394-3559-4592-bbbd-991539e39989 tokenAddress=0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6 chainId=137
[api] [16:48:36] [inf] [METRIC] [API-5001] No token metadata available, trying RPC fallback... | tid=c2be8394-3559-4592-bbbd-991539e39989 tokenAddress=0x3c499c542cef5e3811e1192ce70d8cc03d5c3359 chainId=137
[api] [16:48:36] [inf] [EVENT] [SYS-1007] Starting initial token refresh...
[api] [16:48:36] [wrn] [METRIC] [API-5002] Invalid decimals response from RPC | tid=c2be8394-3559-4592-bbbd-991539e39989 tokenAddress=0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6 result=0x
[api] [Swap Quote] Overriding tokenIn decimals to known value: 6
[api] [Swap Quote] Token decimals: {
[api]   tokenIn: '0x3c499c54',
[api]   tokenOut: '0x455e53CB',
[api]   tokenInDecimals: 6,
[api]   tokenOutDecimals: 18,
[api]   tokenOutMetadataDecimals: 18
[api] }
[api] [16:48:37] [inf] [METRIC] [API-5001] Using 0x API fallback token metadata | tid=c2be8394-3559-4592-bbbd-991539e39989 symbol=USDC chainId=137
[api] [16:48:37] [wrn] [METRIC] [API-5002] 0x API price returned liquidityAvailable=false | tid=c2be8394-3559-4592-bbbd-991539e39989 sellToken=0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6 buyToken=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 chainId=137
[api] [PlatformFee] Fees DISABLED, returning 0 bps
[api] [Kyber] GET routes {
[api]   routesUrl: 'https://aggregator-api.kyberswap.com/polygon/api/v1/routes?tokenIn=0x3c499c542cef5e3811e1192ce70d8cc03d5c3359&tokenOut=0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6&amountIn=1000000&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] [16:48:38] [wrn] [METRIC] [API-5002] 0x API allowance-holder endpoint returned error, attempting v1 fallback | tid=c2be8394-3559-4592-bbbd-991539e39989 status=200 chainId=137 attemptedEndpoint=allowance-holder sellToken=0x3c499c54... buyToken=0x455e53CB... reason=Invalid response data error=Empty response: {"liquidityAvailable":false,"zid":"0x04806bdd38222a893527ce9c"}
[api] [16:48:39] [err] [METRIC] [API-5002] api failed after 2 attempts | tid=c2be8394-3559-4592-bbbd-991539e39989 error=HTTP 400: {"code":4008,"message":"route not found","details":null,"requestId":"4573384a-549f-4761-8952-c90b0a040230"} url=https://aggregator-api.kyberswap.com/polygon/api/v1/routes?t
[api] [QuoteService] Kyber failed Error: HTTP 400: {"code":4008,"message":"route not found","details":null,"requestId":"4573384a-549f-4761-8952-c90b0a040230"}
[api]     at fetchJson (/Users/almurat/KiKo/kiko-api/src/config/unifiedApiService.ts:181:15)
[api]     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
[api]     at async getKyberQuote (/Users/almurat/KiKo/kiko-api/src/services/kyberAggregator.ts:82:24)
[api]     at async fetchKyber (/Users/almurat/KiKo/kiko-api/src/services/quoteService.ts:167:32)
[api]     at async Promise.all (index 1)
[api]     at async getBestQuoteInternal (/Users/almurat/KiKo/kiko-api/src/services/quoteService.ts:209:5)
[api]     at async Object.<anonymous> (/Users/almurat/KiKo/kiko-api/src/routes/swap.ts:350:38)
[api] [16:48:39] [err] [METRIC] [API-5002] api failed after 1 attempts | tid=c2be8394-3559-4592-bbbd-991539e39989 error=HTTP 404: {
[api]   "message":"no Route matched with those values",
[api]   "request_id":"a7e287292127fe416cf2136d91db9d00"
[api] } url=https://polygon.api.0x.org/swap/v1/quote?sellToken=0x3c499c5
[api] [16:48:39] [wrn] [METRIC] [API-5002] 0x API v1 fallback fetch failed | tid=c2be8394-3559-4592-bbbd-991539e39989 error=HTTP 404: {
[api]   "message":"no Route matched with those values",
[api]   "request_id":"a7e287292127fe416cf2136d91db9d00"
[api] } originalError=Empty response: {"liquidityAvailable":false,"zid":"0x04806bdd38222a893527ce9c"}
[api] [16:48:39] [err] [METRIC] [API-5002] 0x API Quote request failed | tid=c2be8394-3559-4592-bbbd-991539e39989 status=502 statusText=Invalid Data from Primary, Fallback Failed: HTTP 404: {
[api]   "message":"no Route matched with those values",
[api]   "request_id":"a7e287292127fe416cf2136d91db9d00"
[api] } chainId=137 sellToken=0x3c499c542cef5e3811e1192ce70d8cc03d5c3359 buyToken=0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6
[api] [16:48:39] [err] [METRIC] [API-5002] 0x API Error fetching quote | tid=c2be8394-3559-4592-bbbd-991539e39989 error=0x API error (502): Invalid Data from Primary, Fallback Failed: HTTP 404: {
[api]   "message":"no Route matched with those values",
[api]   "request_id":"a7e287292127fe416cf2136d91db9d00"
[api] }
[api] [QuoteService] 0x failed Error: 0x API error (502): Invalid Data from Primary, Fallback Failed: HTTP 404: {
[api]   "message":"no Route matched with those values",
[api]   "request_id":"a7e287292127fe416cf2136d91db9d00"
[api] }
[api]     at getZeroExQuote (/Users/almurat/KiKo/kiko-api/src/services/zeroEx.ts:710:13)
[api]     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
[api]     at async fetchZeroEx (/Users/almurat/KiKo/kiko-api/src/services/quoteService.ts:110:23)
[api]     at async Promise.all (index 0)
[api]     at async getBestQuoteInternal (/Users/almurat/KiKo/kiko-api/src/services/quoteService.ts:209:5)
[api]     at async Object.<anonymous> (/Users/almurat/KiKo/kiko-api/src/routes/swap.ts:350:38)
[api] [Error Handler] {
[api]   "requestId": "req-o",
[api]   "method": "POST",
[api]   "url": "/api/swap/quote",
[api]   "ip": "127.0.0.1",
[api]   "error": {
[api]     "message": "No quotes available for 0x3c499c542cef5e3811e1192ce70d8cc03d5c3359 -> 0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6 on chain 137",
[api]     "name": "Error",
[api]     "code": "QUOTE_ERROR",
[api]     "statusCode": 400,
[api]     "stack": "Error: No quotes available for 0x3c499c542cef5e3811e1192ce70d8cc03d5c3359 -> 0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6 on chain 137\n    at Object.<anonymous> ([REDACTED_PATH]\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)"
[api]   }
[api] }
[api] [16:48:39] [err] [METRIC] [API-5002] swap-api failed after 1 attempts | error=HTTP 400: {"success":false,"error":"No quotes available for 0x3c499c542cef5e3811e1192ce70d8cc03d5c3359 -> 0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6 on chain 137","code":"QUOTE_ERROR","requestId":"req-o","timestamp":"2026-02-09T16:48:39.358Z","stack":"Error: No quotes available for 0x3c499c542cef5e3811e1192ce70d8cc03d5c3359 -> 0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6 on chain 137\n    at Object.<anonymous> (/Users/almurat/KiKo/kiko-api/src/routes/swap.ts:366:23)\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)"} url=http://127.0.0.1:3001/api/swap/quote
[api] [16:48:39] [inf] [TRACE] [AI-6007] ChatWorker: tool success | tool=simulate_swap sessionId=cmlfeom4r00052277zp43ikaw messageId=cmlfeom61000b2277up1fmds4 userId=did:privy:cmj0a3j3f005fl20c4xkl7195 dur=4371ms
[api] [ChatWorker] DeepSeek iteration 4/10 for task cmlfeom62000d2277nteqjybo
[api] [16:48:39] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [16:48:39] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [16:48:39] [inf] [TRACE] [AI-6001] Timer finished: intent_parsing_2480d0bf | userAddress=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E intent=swap highLevelIntent=TRADING hasAI=false confidence=0.95 routingStage=rule hardRule=TRADING slotsComplete=true labels=[3] timerLabel=intent_parsing_2480d0bf dur=2ms
[api] [16:48:39] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: false,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
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
[api]     'id',
[api]     'userId',
[api]     'quickSwapMode',
[api]     'copyTradeAIMode',
[api]     'updatedAt',
[api]     'createdAt',
[api]     'copyTradeTokenCooldownMinutes',
[api]     'minLiquidityUsd',
[api]     'minMarketCapUsd',
[api]     'minTargetValueUsd',
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
[api] [16:48:39] [inf] [TRACE] [AI-6006] PromptOrchestrator: Intent matched skills | intent=TRADING count=4 skills=[4]
[api] [16:48:39] [inf] [TRACE] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | model=deepseek intent=TRADING length=13479 timerLabel=prompt_gen_TRADING_deepseek dur=1ms
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (2 tokens cached)
[api] [16:48:39] [inf] [TRACE] [AI-6007] ChatWorker: requested token balance resolved | walletAddress=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E chainId=137 requested=[2] matched=[1] missing=[1] resolvedBalances={"USDC":"4.869828"}
[api] [ChatWorker] No tokenInfo available
[api] [16:48:39] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status dur=1ms
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [ChatWorker] Broadcasting Thinking status for cmlfeom61000b2277up1fmds4. Message order: message_start → Thinking → content_chunks
[api] [16:48:39] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [16:48:41] [inf] [EVENT] [SYS-1001] No open positions to monitor
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [16:48:47] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=usage connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage
[api] [16:48:47] [inf] [TRACE] [AI-6011] ChatWorker: executing tools batch | sessionId=cmlfeom4r00052277zp43ikaw messageId=cmlfeom61000b2277up1fmds4 userId=did:privy:cmj0a3j3f005fl20c4xkl7195 toolCount=1
[api] [16:48:47] [inf] [TRACE] [AI-6007] ChatWorker: tool start | tool=simulate_swap sessionId=cmlfeom4r00052277zp43ikaw messageId=cmlfeom61000b2277up1fmds4 userId=did:privy:cmj0a3j3f005fl20c4xkl7195
[api] [16:48:47] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status dur=1ms
[api] [Swap Quote] Fetching metadata for: {
[api]   tokenInForMetadata: '0x3c499c542c',
[api]   tokenOutForMetadata: '0x0d500B1d8E',
[api]   actualTokenIn: '0x3c499c542c',
[api]   actualTokenOut: '0xEeeeeEeeeE',
[api]   isTokenOutNative: true
[api] }
[api] [16:48:48] [inf] [METRIC] [API-5001] Using 0x API fallback token metadata | tid=55fa7f22-5f09-4934-bdd8-a112014b6a29 symbol=WMATIC chainId=137
[api] [Swap Quote] Overriding tokenIn decimals to known value: 6
[api] [Swap Quote] Token decimals: {
[api]   tokenIn: '0x3c499c54',
[api]   tokenOut: '0xEeeeeEee',
[api]   tokenInDecimals: 6,
[api]   tokenOutDecimals: 18,
[api]   tokenOutMetadataDecimals: 18
[api] }
[api] [16:48:49] [inf] [METRIC] [API-5001] 0x API price received successfully | tid=55fa7f22-5f09-4934-bdd8-a112014b6a29 sellToken=0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270 buyToken=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 chainId=137 liquidityAvailable=true
[api] [PlatformFee] Fees DISABLED, returning 0 bps
[api] [Kyber] GET routes {
[api]   routesUrl: 'https://aggregator-api.kyberswap.com/polygon/api/v1/routes?tokenIn=0x3c499c542cef5e3811e1192ce70d8cc03d5c3359&tokenOut=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&amountIn=1000000&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] [16:48:50] [inf] [METRIC] [API-5001] 0x API Quote received successfully | tid=55fa7f22-5f09-4934-bdd8-a112014b6a29 sellToken=0x3c499c542cef5e3811e1192ce70d8cc03d5c3359 buyToken=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE buyAmount=10611716181423964293 usedEndpoint=allowance-holder
[api] [16:48:50] [inf] [METRIC] [API-5001] 0x API Quote successful | tid=55fa7f22-5f09-4934-bdd8-a112014b6a29 sellToken=0x3c499c542c buyToken=0xEeeeeEeeeE buyAmount=10611716181423964293 hasAllowanceIssue=false usedEndpoint=allowance-holder
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 1,
[api]   amountOut: 10.611716181423965,
[api]   quotePrice: 10.611716181423965,
[api]   refPrice: 10.615373183444264,
[api]   tokenInUsd: 'available',
[api]   impact: -0.03445005613182324,
[api]   formula: '((10.611716181423965 - 10.615373183444264) / 10.615373183444264) * 100 = -0.03445005613182324'
[api] }
[api] [QuoteService] 0x API estimatedPriceImpact: {
[api]   raw: undefined,
[api]   parsed: 0,
[api]   multipliedBy100: 0,
[api]   impactVsMkt: -0.03445005613182324,
[api]   willUse: -0.03445005613182324
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
[api]   slippageTolerance: 100,
[api]   slippageToleranceType: 'number',
[api]   deadline: 1770656330,
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
[api]   amountIn: 1,
[api]   amountOut: 10.642013128218167,
[api]   quotePrice: 10.642013128218167,
[api]   refPrice: 10.615373183444264,
[api]   tokenInUsd: 'available',
[api]   impact: 0.2509562717535981,
[api]   formula: '((10.642013128218167 - 10.615373183444264) / 10.615373183444264) * 100 = 0.2509562717535981'
[api] }
[api] [QuoteService] Quote comparison: {
[api]   '0x_amount': '10.611716181423964293',
[api]   kyber_amount: '10.642013128218167296',
[api]   kyber_advantage_pct: '0.00',
[api]   chainId: 137
[api] }
[api] [QuoteService] Preferring 0x for reliability { reason: 'prices within 2%', percentDiff: '0.00' }
[api] [16:48:51] [inf] [TRACE] [AI-6007] ChatWorker: tool success | tool=simulate_swap sessionId=cmlfeom4r00052277zp43ikaw messageId=cmlfeom61000b2277up1fmds4 userId=did:privy:cmj0a3j3f005fl20c4xkl7195 dur=4142ms
[api] [ChatWorker] DeepSeek iteration 5/10 for task cmlfeom62000d2277nteqjybo
[api] [16:48:51] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [16:48:51] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [16:48:51] [inf] [TRACE] [AI-6001] Timer finished: intent_parsing_3f4b7e86 | userAddress=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E intent=swap highLevelIntent=TRADING hasAI=false confidence=0.95 routingStage=rule hardRule=TRADING slotsComplete=true labels=[3] timerLabel=intent_parsing_3f4b7e86 dur=1ms
[api] [16:48:51] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: false,
[api]   swapMethod: 'allowance_trade',
[api]   toolConfig: [
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
[api]     'id',
[api]     'userId',
[api]     'quickSwapMode',
[api]     'copyTradeAIMode',
[api]     'updatedAt',
[api]     'createdAt',
[api]     'copyTradeTokenCooldownMinutes',
[api]     'minLiquidityUsd',
[api]     'minMarketCapUsd',
[api]     'minTargetValueUsd',
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
[api] [16:48:51] [inf] [TRACE] [AI-6006] PromptOrchestrator: Intent matched skills | intent=TRADING count=4 skills=[4]
[api] [16:48:51] [inf] [TRACE] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | model=deepseek intent=TRADING length=13479 timerLabel=prompt_gen_TRADING_deepseek
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (2 tokens cached)
[api] [16:48:51] [inf] [TRACE] [AI-6007] ChatWorker: requested token balance resolved | walletAddress=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E chainId=137 requested=[2] matched=[1] missing=[1] resolvedBalances={"USDC":"4.869828"}
[api] [ChatWorker] No tokenInfo available
[api] [16:48:51] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [ChatWorker] Broadcasting Thinking status for cmlfeom61000b2277up1fmds4. Message order: message_start → Thinking → content_chunks
[api] [16:48:51] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [16:48:56] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=usage connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage
[python] INFO:moderation.router:Moderating output: I'll help you sell 1 USDC for POL on Polygon. Let ...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:56633 - "POST /moderation/output HTTP/1.1" 200 OK
[api] [16:48:58] [inf] [EVENT] [SYS-1007] Moderation Output check result | safe=true userId=did:privy:cmj0a3j3f005fl20c4xkl7195
[api] [ChatWorker] Broadcasting message_complete for cmlfeom61000b2277up1fmds4
[api] [16:48:58] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=message_complete connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete
[api] [16:48:58] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [16:48:58] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=message_complete connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete

