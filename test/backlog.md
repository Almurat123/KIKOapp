[api] [ChatWorker] Sent message_start for cmlgnwsey003yfmrz9qz148bc
[api] [ChatWorker] Base filtered to 46 tools for message: "Swap 1 USDC to base ETH..."
[api] [ChatWorker] 🔍 RAG check for: "Swap 1 USDC to base ETH..."
[api] [ChatWorker] ⏭️ RAG: Skipped (RAG disabled or query not informational).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cmlgnwsez0040fmrz0gz94gla
[api] [13:54:21] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status dur=1ms
[api] [13:54:21] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status dur=1ms
[api] [13:54:21] [inf] [TRACE] [AI-6001] Timer finished: intent_parsing_a45c0782 | userAddress=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E intent=swap highLevelIntent=TRADING hasAI=false confidence=0.95 routingStage=rule hardRule=TRADING slotsComplete=true labels=[3] timerLabel=intent_parsing_a45c0782 dur=9ms
[api] [13:54:21] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [13:54:21] [inf] [TRACE] [AI-6009] DeepSeek: routed to mode | taskId=cmlgnwsez0040fmrz0gz94gla sessionId=cmlgnwsdy003sfmrza7lnvxwi model=deepseek-chat intent=TRADING routingMode=execution hardRule={Obj} confidence=0.95
[api] [ChatWorker] Skill-gated to 13 tools for intent=TRADING skills=cross_chain_swap, swap, token_alert, wallet_portfolio
[api] [13:54:21] [inf] [TRACE] [AI-6010] DeepSeek: skills attached | taskId=cmlgnwsez0040fmrz0gz94gla sessionId=cmlgnwsdy003sfmrza7lnvxwi model=deepseek-chat intent=TRADING routingMode=execution skillVersion=exec skills=[4] toolCount=13
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
[api] [13:54:21] [inf] [TRACE] [AI-6006] PromptOrchestrator: Intent matched skills | intent=TRADING count=4 skills=[4]
[api] [13:54:21] [inf] [TRACE] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | model=deepseek intent=TRADING length=13727 timerLabel=prompt_gen_TRADING_deepseek dur=1ms
[api] [ChatWorker] No tokenInfo available
[api] [13:54:21] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [ChatWorker] Broadcasting Thinking status for cmlgnwsey003yfmrz9qz148bc. Message order: message_start → Thinking → content_chunks
[api] [13:54:21] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [13:54:21] [inf] [METRIC] [API-5001] Alchemy Portfolio response received | duration=471
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [13:54:30] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=usage connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage
[api] [13:54:30] [inf] [TRACE] [AI-6011] ChatWorker: executing tools batch | sessionId=cmlgnwsdy003sfmrza7lnvxwi messageId=cmlgnwsey003yfmrz9qz148bc userId=did:privy:cmj0a3j3f005fl20c4xkl7195 toolCount=1
[api] [13:54:30] [inf] [TRACE] [AI-6007] ChatWorker: tool start | tool=get_cross_chain_quote sessionId=cmlgnwsdy003sfmrza7lnvxwi messageId=cmlgnwsey003yfmrz9qz148bc userId=did:privy:cmj0a3j3f005fl20c4xkl7195
[api] [13:54:30] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [13:54:30] [inf] [EVENT] [SYS-1007] PrivyWallet Authorization Key config | keyFormat=wallet-auth keyLength=196 keyIdConfigured=true keyId=crdgro3bw0...
[api] [13:54:31] [inf] [EVENT] [SYS-1007] Parsed amount 1 -> 1000000 (6 decimals)
[api] [13:54:35] [inf] [TRACE] [AI-6007] ChatWorker: tool success | tool=get_cross_chain_quote sessionId=cmlgnwsdy003sfmrza7lnvxwi messageId=cmlgnwsey003yfmrz9qz148bc userId=did:privy:cmj0a3j3f005fl20c4xkl7195 dur=5061ms
[api] [ChatWorker] DeepSeek iteration 2/10 for task cmlgnwsez0040fmrz0gz94gla
[api] [13:54:35] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [13:54:35] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [13:54:35] [inf] [TRACE] [AI-6001] Timer finished: intent_parsing_af7d8a3d | userAddress=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E intent=swap highLevelIntent=TRADING hasAI=false confidence=0.95 routingStage=rule hardRule=TRADING slotsComplete=true labels=[3] timerLabel=intent_parsing_af7d8a3d dur=3ms
[api] [13:54:35] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status dur=1ms
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
[api] [13:54:35] [inf] [TRACE] [AI-6006] PromptOrchestrator: Intent matched skills | intent=TRADING count=4 skills=[4]
[api] [13:54:35] [inf] [TRACE] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | model=deepseek intent=TRADING length=13727 timerLabel=prompt_gen_TRADING_deepseek dur=1ms
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (2 tokens cached)
[api] [13:54:35] [inf] [TRACE] [AI-6007] ChatWorker: requested token balance resolved | walletAddress=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E chainId=137 requested=[2] matched=[1] missing=[1] resolvedBalances={"USDC":"3.869828"}
[api] [ChatWorker] No tokenInfo available
[api] [13:54:35] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [ChatWorker] Broadcasting Thinking status for cmlgnwsey003yfmrz9qz148bc. Message order: message_start → Thinking → content_chunks
[api] [13:54:35] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [13:54:37] [wrn] [EVENT] [SYS-1006] RPC health degraded | endpoints=[5]
[api] [13:54:42] [inf] [EVENT] [SYS-1001] No open positions to monitor
[api] [13:54:45] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=usage connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage dur=1ms
[python] INFO:moderation.router:Moderating output: I'll help you swap 1 USDC on Polygon to ETH on Bas...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:61935 - "POST /moderation/output HTTP/1.1" 200 OK
[api] [13:54:46] [inf] [EVENT] [SYS-1007] Moderation Output check result | safe=true userId=did:privy:cmj0a3j3f005fl20c4xkl7195
[api] [ChatWorker] Broadcasting message_complete for cmlgnwsey003yfmrz9qz148bc
[api] [13:54:46] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=message_complete connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete
[api] [13:54:46] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [13:54:46] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=message_complete connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete
[api] [13:54:47] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | tid=4f5cb5ca-0297-4720-9cbd-f3144d913ed8 userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status dur=1ms
[api] [13:54:47] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | tid=4f5cb5ca-0297-4720-9cbd-f3144d913ed8 userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=message_start connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start
[api] [13:54:49] [inf] [METRIC] [API-5001] Alchemy Portfolio response received | tid=64c4bb49-7fd2-4d92-a089-660a6fd5d5c3 duration=1478
[api] [13:54:49] [inf] [METRIC] [API-5001] Alchemy Portfolio response received | tid=aae0544f-305c-43ef-b0b9-8be9f9afaa91 duration=1462
[api] [13:54:49] [inf] [METRIC] [API-5001] Alchemy Portfolio response received | tid=4f5cb5ca-0297-4720-9cbd-f3144d913ed8 duration=1596
[api] [ChatWorker] Sanitizing orphaned tool_calls from message 1 (missing 1 tool results)
[api] [13:54:49] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [13:54:49] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [13:54:49] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[python] INFO:moderation.router:Moderating input: proceed...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:61935 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [13:54:50] [inf] [EVENT] [SYS-1007] Moderation Input check result | safe=true action=allow userId=did:privy:cmj0a3j3f005fl20c4xkl7195
[api] [13:54:50] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [13:54:50] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=message_start connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start
[api] [ChatWorker] Sent message_start for cmlgnxesl0046fmrzmm4dx4x5
[api] [13:54:50] [inf] [TRACE] [AI-6007] ChatWorker: seeded get_wallet_info from client context | chainId=137 tokenCount=3 hasNativeBalance=false
[api] [ChatWorker] Base filtered to 46 tools for message: "proceed..."
[api] [ChatWorker] 🔍 RAG check for: "proceed..."
[api] [ChatWorker] ⏭️ RAG: Skipped (RAG disabled or query not informational).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cmlgnxesn0048fmrzbj8z6gfq
[api] [13:54:50] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [13:54:50] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [13:54:50] [inf] [TRACE] [AI-6001] Timer finished: intent_parsing_3ede7e59 | userAddress=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E intent=general_query highLevelIntent=TRADING hasAI=false confidence=0.95 routingStage=rule hardRule=TRADING slotsComplete=false labels=[3] timerLabel=intent_parsing_3ede7e59 dur=4ms
[api] [13:54:50] [inf] [TRACE] [AI-6001] Intent follow-up recorded | previousIntent=TRADING nextIntent=TRADING sessionId=cmlgnwsdy003sfmrza7lnvxwi
[api] [13:54:50] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [13:54:50] [inf] [TRACE] [AI-6009] DeepSeek: routed to mode | taskId=cmlgnxesn0048fmrzbj8z6gfq sessionId=cmlgnwsdy003sfmrza7lnvxwi model=deepseek-chat intent=TRADING routingMode=execution hardRule={Obj} confidence=0.95
[api] [ChatWorker] Skill-gated to 13 tools for intent=TRADING skills=cross_chain_swap, swap, token_alert, wallet_portfolio
[api] [13:54:50] [inf] [TRACE] [AI-6010] DeepSeek: skills attached | taskId=cmlgnxesn0048fmrzbj8z6gfq sessionId=cmlgnwsdy003sfmrza7lnvxwi model=deepseek-chat intent=TRADING routingMode=execution skillVersion=exec skills=[4] toolCount=13
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
[api] [ChatWorker] Waiting for early pre-fetch to complete
[api] [13:54:50] [inf] [TRACE] [AI-6006] PromptOrchestrator: Intent matched skills | intent=TRADING count=4 skills=[4]
[api] [13:54:50] [inf] [TRACE] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | model=deepseek intent=TRADING length=13727 timerLabel=prompt_gen_TRADING_deepseek
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (2 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [13:54:50] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [ChatWorker] Broadcasting Thinking status for cmlgnxesl0046fmrzmm4dx4x5. Message order: message_start → Thinking → content_chunks
[api] [13:54:50] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [13:54:52] [inf] [METRIC] [API-5001] Alchemy Portfolio response received | tid=696a8bc8-6da6-47e5-914a-5bc469bfe304 duration=374
[api] [13:54:52] [inf] [METRIC] [API-5001] Alchemy Portfolio response received | tid=e411e2c9-a39a-47bd-aaac-72e7d5935a0f duration=326
[api] [13:54:53] [inf] [EVENT] [SYS-1007] Alpha Detector: Checking new coin | tid=62d4d666-36ae-44b0-8c8d-0b440288e375 symbol=lyric_dbdf creator=0x1fdedea9173b3c9a23a723f9e57b99e874832752
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [13:54:57] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=usage connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage
[api] [13:54:57] [inf] [TRACE] [AI-6011] ChatWorker: executing tools batch | sessionId=cmlgnwsdy003sfmrza7lnvxwi messageId=cmlgnxesl0046fmrzmm4dx4x5 userId=did:privy:cmj0a3j3f005fl20c4xkl7195 toolCount=1
[api] [13:54:57] [inf] [TRACE] [AI-6007] ChatWorker: tool start | tool=prepare_cross_chain_tx sessionId=cmlgnwsdy003sfmrza7lnvxwi messageId=cmlgnxesl0046fmrzmm4dx4x5 userId=did:privy:cmj0a3j3f005fl20c4xkl7195
[api] [13:54:57] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [13:55:00] [inf] [EVENT] [SYS-1007] SocialRepo: Recalculated heat scores for 396 casts
[api] [13:55:00] [inf] [EVENT] [SYS-1007] Timer finished: recalc_heat_scores | count=396 timerLabel=recalc_heat_scores dur=18ms
[api] [13:55:02] [inf] [EVENT] [SYS-1007] [CrossChain] Checking allowance for USDC on 137...
[api] [13:55:03] [inf] [EVENT] [SYS-1007] [CrossChain] Allowance insufficient. Auto-approving...
[api] [13:55:03] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_client_action | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=client_action connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_client_action
[api] [sendTransaction] ========== PRIVY TX PARAMS ==========
[api] [sendTransaction] From: 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [sendTransaction] To: 0x3c499c542cef5e3811e1192ce70d8cc03d5c3359
[api] [sendTransaction] Value: undefined
[api] [sendTransaction] ValueHex: undefined
[api] [sendTransaction] Data length: 138
[api] [sendTransaction] Data (full): 0x095ea7b30000000000000000000000001231deb6f5749ef6ce6943a275a1d3e7486f4eae00000000000000000000000000000000000000000000000000000000000f4240
[api] [sendTransaction] ChainId: 137
[api] [sendTransaction] Gas: 0x186A0
[api] [sendTransaction] MaxFeePerGas: undefined
[api] [sendTransaction] MaxPriorityFeePerGas: undefined
[api] [sendTransaction] Full TX object: {
[api]   to: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
[api]   data: '0x095ea7b30000000000000000000000001231deb6f5749ef6ce6943a275a1d3e7486f4eae00000000000000000000000000000000000000000000000000000000000f4240',
[api]   chainId: 137,
[api]   gas: '0x186A0'
[api] }
[api] [sendTransaction] ===========================================
[api] [13:55:05] [inf] [AUDIT] [EXE-4002] Ethereum transaction sent via Privy | txHash=0xb1e8ff1891534052107a186b6291726334c4b50485dd68d9a3d4de3e5aa8758e chainId=137
[api] [13:55:06] [inf] [AUDIT] [EXE-4002] [CrossChain] Approval Sent: 0xb1e8ff1891534052107a186b6291726334c4b50485dd68d9a3d4de3e5aa8758e. Waiting for confirmation...
[api] [13:55:12] [inf] [EVENT] [SYS-1001] No open positions to monitor
[api] [13:55:37] [wrn] [EVENT] [SYS-1006] RPC health degraded | endpoints=[5]
[api] [13:55:42] [inf] [EVENT] [SYS-1001] No open positions to monitor
[api] [13:56:50] [wrn] [METRIC] [API-5004] GeckoTerminal 429 triggered backoff | backoffMs=60000
[api] [13:56:50] [err] [METRIC] [API-5002] GeckoTerminal API error after retries | endpoint=/networks/bsc/trending_pools?page=6&include=base_token&duration=5m error=Rate limit hit, backing off for 60000ms
[api] [13:56:50] [err] [METRIC] [API-5002] Error fetching trending tokens | network=bsc error=Rate limit hit, backing off for 60000ms
[api] [13:56:50] [inf] [METRIC] [API-5001] Premium trending tokens fetch complete | count=78 chain=bsc source=WebSocket wsOriginal=200 dur=19726ms
[api] [13:56:50] [inf] [METRIC] [API-5001] Got 78 trending tokens for BSC
[api] [13:56:56] [inf] [TRACE] [AI-6005] Timer finished: launchpad_det_0x4D52562386c7AA854C7E9331843c5Aa2e5e07777 | address=0x4D52562386c7AA854C7E9331843c5Aa2e5e07777 chainId=56 found=true timerLabel=launchpad_det_0x4D52562386c7AA854C7E9331843c5Aa2e5e07777 dur=5527ms
[api] [13:56:56] [inf] [EVENT] [SYS-1007] Alpha Detector: Checking new coin | tid=62d4d666-36ae-44b0-8c8d-0b440288e375 symbol=fern_sun411 creator=0xe94e3186af1b6b1023326cd48d2aa0cd3469c3bc
[api] [13:56:57] [inf] [METRIC] [API-5001] Fetching candlestick data from DexScreener | network=bsc pairAddress=0x3d7C319090edf2293608a0f9a786317c66D320F8 timeframe=d1 limit=180
[api] [DexScreener] Request URL: https://api.dexscreener.com/latest/dex/pairs/bsc/0x3d7C319090edf2293608a0f9a786317c66D320F8
[api] [13:56:57] [inf] [METRIC] [API-5001] Fetching candlestick data from DexScreener | network=bsc pairAddress=0xfACE7E44321FB7D68Ab0B8f7B072AE24E47C621C timeframe=d1 limit=180
[api] [DexScreener] Request URL: https://api.dexscreener.com/latest/dex/pairs/bsc/0xfACE7E44321FB7D68Ab0B8f7B072AE24E47C621C
[api] [13:56:57] [inf] [METRIC] [API-5001] Fetching candlestick data from DexScreener | network=bsc pairAddress=0x92A99fd66B4dfAaE5AF10da8AE30d06E27209dDB timeframe=d1 limit=180
[api] [DexScreener] Request URL: https://api.dexscreener.com/latest/dex/pairs/bsc/0x92A99fd66B4dfAaE5AF10da8AE30d06E27209dDB
[api] [13:56:57] [inf] [METRIC] [API-5001] Fetching candlestick data from DexScreener | network=bsc pairAddress=0xf0750c373EbBB3BaEEF7e03D8300cAaD1983d67c timeframe=d1 limit=180
[api] [DexScreener] Request URL: https://api.dexscreener.com/latest/dex/pairs/bsc/0xf0750c373EbBB3BaEEF7e03D8300cAaD1983d67c
[api] [13:56:57] [inf] [METRIC] [API-5001] No price history on DexScreener, using current price | currentPrice=0.0003111
[api] [13:56:57] [inf] [METRIC] [API-5001] Generated candles from price points | count=1 sourcePoints=1 requested=180 dur=260ms
[api] [13:56:57] [inf] [METRIC] [API-5001] No price history on DexScreener, using current price | currentPrice=1.000051
[api] [13:56:57] [inf] [METRIC] [API-5001] Generated candles from price points | count=1 sourcePoints=1 requested=180 dur=339ms
[api] [13:56:57] [inf] [METRIC] [API-5001] No price history on DexScreener, using current price | currentPrice=0.2466
[api] [13:56:57] [inf] [METRIC] [API-5001] Generated candles from price points | count=1 sourcePoints=1 requested=180 dur=370ms
[api] [13:56:57] [inf] [METRIC] [API-5001] No price history on DexScreener, using current price | currentPrice=0.005747
[api] [13:56:57] [inf] [METRIC] [API-5001] Generated candles from price points | count=1 sourcePoints=1 requested=180 dur=499ms
[api] [13:57:12] [inf] [EVENT] [SYS-1001] No open positions to monitor
[api] [13:57:24] [wrn] [EVENT] [SYS-1007] [CrossChain] Approval polling timed out. Verifying allowance directly...
[api] [13:57:25] [inf] [EVENT] [SYS-1007] [CrossChain] Allowance verification passed! Proceeding.
[api] [13:57:25] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_client_action | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=client_action connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_client_action
[api] [sendTransaction] ========== PRIVY TX PARAMS ==========
[api] [sendTransaction] From: 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [sendTransaction] To: 0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE
[api] [sendTransaction] Value: 0x0
[api] [sendTransaction] ValueHex: 0x0
[api] [sendTransaction] Data length: 2122
[api] [sendTransaction] Data (full): 0xa3443faa00000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000240b3f69e9225e2c082d33f280a06f19716b66d99e0fcea115cc18c33caa062ca5e000000000000000000000000a386bc9d8f26ab170a847d73226e3e0bceb0fe8ec08fbe12f8a7bc185b63e0b10eb9add18d8f49e3b48c64b2cc54a250405c88690000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c3359000000000000000000000000a386bc9d8f26ab170a847d73226e3e0bceb0fe8e00000000000000000000000000000000000000000000000000000000000f387c000000000000000000000000000000000000000000000000000000000000210500000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f72656c61796465706f7369746f7279000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000086c6966692d61706900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000bd6c7b0d2f68c2b7805d88388319cfb6ecb50ea9000000000000000000000000bd6c7b0d2f68c2b7805d88388319cfb6ecb50ea90000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c33590000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c335900000000000000000000000000000000000000000000000000000000000f424000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000084eedd56e10000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c3359000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000009c4000000000000000000000000b9c0de368bece5e76b52545a8e377a4c118f597b00000000000000000000000000000000000000000000000000000000
[api] [sendTransaction] ChainId: 137
[api] [sendTransaction] Gas: 0x4a052
[api] [sendTransaction] MaxFeePerGas: undefined
[api] [sendTransaction] MaxPriorityFeePerGas: undefined
[api] [sendTransaction] Full TX object: {
[api]   to: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
[api]   data: '0xa3443faa00000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000240b3f69e9225e2c082d33f280a06f19716b66d99e0fcea115cc18c33caa062ca5e000000000000000000000000a386bc9d8f26ab170a847d73226e3e0bceb0fe8ec08fbe12f8a7bc185b63e0b10eb9add18d8f49e3b48c64b2cc54a250405c88690000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c3359000000000000000000000000a386bc9d8f26ab170a847d73226e3e0bceb0fe8e00000000000000000000000000000000000000000000000000000000000f387c000000000000000000000000000000000000000000000000000000000000210500000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f72656c61796465706f7369746f7279000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000086c6966692d61706900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000bd6c7b0d2f68c2b7805d88388319cfb6ecb50ea9000000000000000000000000bd6c7b0d2f68c2b7805d88388319cfb6ecb50ea90000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c33590000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c335900000000000000000000000000000000000000000000000000000000000f424000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000084eedd56e10000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c3359000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000009c4000000000000000000000000b9c0de368bece5e76b52545a8e377a4c118f597b00000000000000000000000000000000000000000000000000000000',
[api]   value: '0x0',
[api]   chainId: 137,
[api]   gas: '0x4a052'
[api] }
[api] [sendTransaction] ===========================================
[api] [13:57:29] [inf] [AUDIT] [EXE-4002] Ethereum transaction sent via Privy | txHash=0x2f2a821d8fbb29f76b4af2197d86e8a9983da51a9838ca101e5f12ed08276afb chainId=137
[api] [13:57:30] [inf] [TRACE] [AI-6007] ChatWorker: tool success | tool=prepare_cross_chain_tx sessionId=cmlgnwsdy003sfmrza7lnvxwi messageId=cmlgnxesl0046fmrzmm4dx4x5 userId=did:privy:cmj0a3j3f005fl20c4xkl7195 dur=152029ms
[api] [13:57:30] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_client_action | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=client_action connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_client_action
[api] [ChatWorker] Broadcasted client action for tool prepare_cross_chain_tx
[api] [ChatWorker] DeepSeek iteration 2/10 for task cmlgnxesn0048fmrzbj8z6gfq
[api] [13:57:30] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [13:57:30] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [13:57:30] [inf] [TRACE] [AI-6001] Timer finished: intent_parsing_512e36eb | userAddress=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E intent=general_query highLevelIntent=TRADING hasAI=false confidence=0.95 routingStage=rule hardRule=TRADING slotsComplete=false labels=[3] timerLabel=intent_parsing_512e36eb dur=5ms
[api] [13:57:30] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
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
[api] [13:57:30] [inf] [TRACE] [AI-6006] PromptOrchestrator: Intent matched skills | intent=TRADING count=4 skills=[4]
[api] [13:57:30] [inf] [TRACE] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | model=deepseek intent=TRADING length=13727 timerLabel=prompt_gen_TRADING_deepseek
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (2 tokens cached)
[api] [ChatWorker] No tokenInfo available
[api] [13:57:30] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [ChatWorker] Broadcasting Thinking status for cmlgnxesl0046fmrzmm4dx4x5. Message order: message_start → Thinking → content_chunks
[api] [13:57:30] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [13:57:37] [wrn] [EVENT] [SYS-1006] RPC health degraded | endpoints=[5]
[api] [13:57:39] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=usage connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage
[python] INFO:moderation.router:Moderating output: I'll proceed with the cross-chain swap from 1 USDC...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:62962 - "POST /moderation/output HTTP/1.1" 200 OK
[api] [13:57:40] [inf] [EVENT] [SYS-1007] Moderation Output check result | safe=true userId=did:privy:cmj0a3j3f005fl20c4xkl7195
[api] [ChatWorker] Broadcasting message_complete for cmlgnxesl0046fmrzmm4dx4x5
[api] [13:57:40] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=message_complete connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete
[api] [13:57:40] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=task_status connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status
[api] [13:57:40] [inf] [TRACE] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | userId=did:privy:cmj0a3j3f005fl20c4xkl7195 eventType=message_complete connectionCount=1 timerLabel=ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete
[api] [13:57:42] [inf] [EVENT] [SYS-1001] No open positions to monitor
[api] [13:57:52] [err] [METRIC] [API-5002] etherscan failed after 1 attempts | error=This operation was aborted url=https://api.etherscan.io/v2/api?chainid=8453&apikey=H1I4BKY3
[api] [13:57:52] [err] [METRIC] [API-5002] Etherscan API error | error=This operation was aborted chainId=8453
[api] [13:57:58] [inf] [EVENT] [SYS-1007] Alpha Detector: Checking new coin | tid=62d4d666-36ae-44b0-8c8d-0b440288e375 symbol=ironsun987 creator=0xff7bf698d7c4f47171a4fbef65ffe37dbf4e8081
[api] [13:57:59] [inf] [EVENT] [SYS-1007] Alpha Detector: Checking new coin | tid=62d4d666-36ae-44b0-8c8d-0b440288e375 symbol=nijbq creator=0x90718f9cadaee2749e88d2c36cdedc2878c64322
[api] [13:57:59] [inf] [EVENT] [SYS-1007] Alpha Detector: Checking new coin | tid=62d4d666-36ae-44b0-8c8d-0b440288e375 symbol=clayflip creator=0xd274510e1b755a5ad6640896f61b7218f4385704
[api] [13:58:00] [err] [METRIC] [API-5002] etherscan failed after 1 attempts | error=This operation was aborted url=https://api.etherscan.io/v2/api?chainid=8453&apikey=H1I4BKY3
[api] [13:58:00] [err] [METRIC] [API-5002] Etherscan API error | error=This operation was aborted chainId=8453
[api] [13:58:02] [err] [METRIC] [API-5002] etherscan failed after 1 attempts | error=This operation was aborted url=https://api.etherscan.io/v2/api?chainid=8453&apikey=H1I4BKY3
[api] [13:58:02] [err] [METRIC] [API-5002] Etherscan API error | error=This operation was aborted chainId=8453
[api] [13:58:04] [inf] [METRIC] [API-5001] Fetching candlestick data from DexScreener | network=base pairAddress=0xC7254Af5152F875651790667eC65E760461Db3D5 timeframe=d1 limit=180
[api] [DexScreener] Request URL: https://api.dexscreener.com/latest/dex/pairs/base/0xC7254Af5152F875651790667eC65E760461Db3D5
[api] [13:58:05] [inf] [METRIC] [API-5001] No price history on DexScreener, using current price | currentPrice=0.00157
[api] [13:58:05] [inf] [METRIC] [API-5001] Generated candles from price points | count=1 sourcePoints=1 requested=180 dur=1043ms
[api] [13:58:06] [err] [METRIC] [API-5002] etherscan failed after 1 attempts | error=This operation was aborted url=https://api.etherscan.io/v2/api?chainid=8453&apikey=H1I4BKY3
[api] [13:58:06] [err] [METRIC] [API-5002] Etherscan API error | error=This operation was aborted chainId=8453
[api] [13:58:12] [err] [METRIC] [API-5002] etherscan failed after 1 attempts | error=This operation was aborted url=https://api.etherscan.io/v2/api?chainid=8453&apikey=H1I4BKY3
[api] [13:58:12] [err] [METRIC] [API-5002] Etherscan API error | error=This operation was aborted chainId=8453
[api] [13:58:12] [inf] [EVENT] [SYS-1001] No open positions to monitor
[api] [13:58:23] [err] [METRIC] [API-5002] etherscan failed after 1 attempts | error=This operation was aborted url=https://api.etherscan.io/v2/api?chainid=8453&apikey=H1I4BKY3
[api] [13:58:23] [err] [METRIC] [API-5002] Etherscan API error | error=This operation was aborted chainId=8453

