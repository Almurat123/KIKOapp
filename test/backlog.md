[api] [2026-02-02T12:35:52.304Z] [ERROR] [API-5002][TID:083b259b-5de7-4c07-bb5f-5b9de26443b1] Alchemy Portfolio EVM API error | DATA: {}
[api] [2026-02-02T12:35:53.102Z] [ERROR] [API-5002][TID:437b7e4f-124c-4bd4-a9f1-ec203c248cae] Alchemy Portfolio EVM API error | DATA: {}
[api] [2026-02-02T12:35:53.241Z] [ERROR] [API-5002][TID:aca4e5bf-4298-4f43-9105-a15a67cb8c75] Alchemy Portfolio EVM API error | DATA: {}
[api] {"level":30,"time":1770035753370,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","res":{"statusCode":200},"responseTime":4051.0434999987483,"msg":"request completed"}
[api] {"level":30,"time":1770035753378,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54840},"msg":"incoming request"}
[api] {"level":30,"time":1770035753379,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","res":{"statusCode":204},"responseTime":0.730333000421524,"msg":"request completed"}
[api] {"level":30,"time":1770035753381,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54823},"msg":"incoming request"}
[api] [2026-02-02T12:35:54.093Z] [ERROR] [API-5002][TID:c0bf4a0a-2953-4527-8012-d3a848373604] Alchemy Portfolio EVM API error | DATA: {}
[api] {"level":30,"time":1770035754094,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","res":{"statusCode":200},"responseTime":712.917625002563,"msg":"request completed"}
[api] {"level":30,"time":1770035754175,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","res":{"statusCode":200},"responseTime":2667.543207999319,"msg":"request completed"}
[api] {"level":30,"time":1770035754458,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","res":{"statusCode":200},"responseTime":2920.21875,"msg":"request completed"}
[api] {"level":30,"time":1770035754477,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54840},"msg":"incoming request"}
[api] [2026-02-02T12:35:55.342Z] [ERROR] [API-5002][TID:4a8f5fb9-6ef5-4753-b5be-920970e3576f] Alchemy Portfolio EVM API error | DATA: {}
[api] {"level":30,"time":1770035755343,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","res":{"statusCode":200},"responseTime":865.4090420007706,"msg":"request completed"}
[api] [2026-02-02T12:35:56.714Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-02T12:35:56.714Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-02T12:35:56.715Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: Buy 0.0005 ETH to 0xf7b0dd0b642a6ccc2fc4d8ffe2bffb...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] INFO:     127.0.0.1:54869 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-02T12:35:58.173Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-02T12:35:58.176Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml55l2tc000710ula1lrgmny
[api] [2026-02-02T12:35:58.177Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":8453,"tokenCount":8,"hasNativeBalance":true}
[api] [2026-02-02T12:35:58.179Z] [INFO] [SYS-1007] ToolPreRouter: Category matched | DATA: {"category":"\\b(swap|buy|sell|trade|exchange|convert|购买|卖出|兑换)\\b","tools":["get_token_info","external_web_search","prepare_swap_transaction","get_wallet_info","check_token_risk","create_copy_trade_config"]}
[api] [ChatWorker] Base filtered to 6 tools for message: "Buy 0.0005 ETH to 0xf7b0dd0b642a6ccc2fc4d8ffe2bffb..."
[api] [ChatWorker] 🔍 RAG check for: "Buy 0.0005 ETH to 0xf7b0dd0b642a6ccc2fc4d8ffe2bffb..."
[api] [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml55l51m000910ulx2o6bpjt
[api] [2026-02-02T12:35:58.180Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
[api] [2026-02-02T12:35:58.183Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-02T12:35:58.189Z] [INFO] [AI-6001][6ms] Timer finished: intent_parsing_ac5c9229 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"SOCIAL_SENSING","confidence":0.1264911064067352},{"label":"MARKET_ANALYSIS","confidence":0.10327955589886445}],"timerLabel":"intent_parsing_ac5c9229"}
[api] [2026-02-02T12:35:58.193Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-02T12:35:58.193Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml55l51m000910ulx2o6bpjt","sessionId":"cml55l2sg000110ulba5pr7n2","model":"deepseek-v3-fast","intent":"TRADING","routingMode":"execution","hardRule":{"label":"TRADING","reason":"action + slots complete"},"confidence":0.95}
[api] [ChatWorker] Skill-gated to 5 tools for intent=TRADING skills=swap, token_alert, wallet_portfolio
[api] [2026-02-02T12:35:58.193Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml55l51m000910ulx2o6bpjt","sessionId":"cml55l2sg000110ulba5pr7n2","model":"deepseek-v3-fast","intent":"TRADING","routingMode":"execution","skillVersion":"exec","skills":["swap","token_alert","wallet_portfolio"],"toolCount":5}
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
[api] [ChatWorker] 🚀 Fast Swap Decision: {
[api]   fastSwapModeEnabled: true,
[api]   isAllowanceTradeMode: true,
[api]   willFastSwap: true,
[api]   reason: 'fastSwapMode=true'
[api] }
[api] [2026-02-02T12:35:58.196Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] 🚀 Fast swap: Sent message_start for cml55l2tc000710ula1lrgmny
[api] [ChatWorker] Fast swap parameters: {
[api]   tokenIn: 'ETH',
[api]   tokenOut: '0xf7b0dd0b...',
[api]   amountIn: '0.0005',
[api]   chainId: 8453,
[api]   swapIntent: {
[api]     tokenIn: 'ETH',
[api]     tokenOut: '0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8',
[api]     amount: '0.0005'
[api]   }
[api] }
[api] [ChatWorker] Chain detection: tokenIn=ETH..., actualChain=base
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-02T12:35:59.675Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-02T12:36:01.390Z] [INFO] [AI-6005][2791ms] Timer finished: launchpad_det_0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8 | DATA: {"address":"0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8","chainId":8453,"found":false,"timerLabel":"launchpad_det_0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8"}
[api] [2026-02-02T12:36:01.391Z] [INFO] [AI-6004][3193ms] Timer finished: find_token_any_0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8 | DATA: {"address":"0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8","symbol":"GEKKO","chain":"Base","timerLabel":"find_token_any_0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8"}
[api] [2026-02-02T12:36:01.394Z] [INFO] [AI-6011] Created transaction card for fast swap | DATA: {"messageId":"cml55laep000c10ul6sq8teht","taskId":"cml55l51m000910ulx2o6bpjt"}
[api] [2026-02-02T12:36:01.396Z] [INFO] [EXE-4002] [MainSwapService][1770035761396_trmwsn] Starting unified swap execution | DATA: {"mode":"fast-swap","tokenIn":"ETH","tokenOut":"0xf7b0dd0b64","amount":"0.0005","chainId":8453,"tradeContextId":"ctx_1770035761396_dhqnnk3u2"}
[api] [2026-02-02T12:36:01.397Z] [INFO] [AI-6005] Timer finished: launchpad_det_ETH | DATA: {"address":"ETH","chainId":8453,"found":false,"timerLabel":"launchpad_det_ETH"}
[api] [2026-02-02T12:36:01.397Z] [INFO] [EXE-4002] [MainSwapService][1770035761396_trmwsn] Executing EVM swap | DATA: {"chainId":8453,"tokenIn":"ETH","tokenOut":"0xf7b0dd0b64","fastSwapMode":true}
[api] [2026-02-02T12:36:01.397Z] [INFO] [SYS-1007] [MainSwapService][1770035761396_trmwsn] FastSwapMode enabled - attempting direct swap (BUY with native)
[api] [2026-02-02T12:36:01.397Z] [INFO] [EXE-4002] [DirectSwap] Starting direct swap | DATA: {"tokenIn":"0xeeeeeeeeee","tokenOut":"0xf7b0dd0b64","amount":"0.0005","chainId":8453}
[api] {"level":30,"time":1770035761408,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54823},"msg":"incoming request"}
[api] {"level":30,"time":1770035761409,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","res":{"statusCode":204},"responseTime":0.35204100236296654,"msg":"request completed"}
[api] {"level":30,"time":1770035761410,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54842},"msg":"incoming request"}
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
[api]   tokenInForMetadata: '0x4200000000',
[api]   tokenOutForMetadata: '0xf7b0dd0b64',
[api]   actualTokenIn: '0xEeeeeEeeeE',
[api]   actualTokenOut: '0xf7b0dd0b64',
[api]   isTokenOutNative: false
[api] }
[api] {"level":30,"time":1770035761411,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","req":{"method":"POST","url":"/api/swap/quote","hostname":"127.0.0.1:3001","remoteAddress":"127.0.0.1","remotePort":54882},"msg":"incoming request"}
[api] [2026-02-02T12:36:02.596Z] [INFO] [API-5001][TID:1b72010e-b0cf-4462-97d2-9c03415b3715] Using 0x API fallback token metadata | DATA: {"symbol":"WETH","chainId":8453}
[api] [2026-02-02T12:36:02.602Z] [INFO] [API-5001][TID:1b72010e-b0cf-4462-97d2-9c03415b3715] No token metadata available, trying RPC fallback... | DATA: {"tokenAddress":"0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8","chainId":8453}
[api] [Swap Quote] Token decimals: {
[api]   tokenIn: '0xEeeeeEee',
[api]   tokenOut: '0xf7b0dd0b',
[api]   tokenInDecimals: 18,
[api]   tokenOutDecimals: 18,
[api]   tokenOutMetadataDecimals: 18
[api] }
[api] [2026-02-02T12:36:03.812Z] [ERROR] [API-5002][TID:8b8a5342-ff3f-47a3-9405-56ad44f61b23] Alchemy Portfolio EVM API error | DATA: {}
[api] [2026-02-02T12:36:03.988Z] [INFO] [API-5001][TID:1b72010e-b0cf-4462-97d2-9c03415b3715] Using 0x API fallback token metadata | DATA: {"symbol":"USDC","chainId":8453}
[api] [2026-02-02T12:36:04.005Z] [INFO] [API-5001][TID:1b72010e-b0cf-4462-97d2-9c03415b3715] Using 0x API fallback token metadata | DATA: {"symbol":"USDC","chainId":8453}
[api] {"level":30,"time":1770035764079,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","res":{"statusCode":200},"responseTime":2668.4703329987824,"msg":"request completed"}
[api] [2026-02-02T12:36:04.645Z] [INFO] [API-5001][TID:1b72010e-b0cf-4462-97d2-9c03415b3715] 0x API price received successfully | DATA: {"sellToken":"0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8","buyToken":"0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913","chainId":8453,"liquidityAvailable":true}
[api] [2026-02-02T12:36:05.329Z] [INFO] [API-5001][TID:1b72010e-b0cf-4462-97d2-9c03415b3715] 0x API price received successfully | DATA: {"sellToken":"0x4200000000000000000000000000000000000006","buyToken":"0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913","chainId":8453,"liquidityAvailable":true}
[api] [PlatformFee] Fees DISABLED, returning 0 bps
[api] [Kyber] GET routes {
[api]   routesUrl: 'https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&tokenOut=0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8&amountIn=500000000000000&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] [2026-02-02T12:36:05.623Z] [INFO] [EXE-4001] [DirectSwap] Found best pool | DATA: {"version":"v3","fee":10000,"liquidity":"211517791410799"}
[api] [2026-02-02T12:36:06.078Z] [INFO] [API-5001][TID:1b72010e-b0cf-4462-97d2-9c03415b3715] 0x API Quote received successfully | DATA: {"sellToken":"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE","buyToken":"0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8","buyAmount":"3621355149102399809580","usedEndpoint":"allowance-holder"}
[api] [2026-02-02T12:36:06.079Z] [INFO] [API-5001][TID:1b72010e-b0cf-4462-97d2-9c03415b3715] 0x API Quote successful | DATA: {"sellToken":"0xEeeeeEeeeE","buyToken":"0xf7b0dd0b64","buyAmount":"3621355149102399809580","hasAllowanceIssue":false,"usedEndpoint":"allowance-holder"}
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 0.0005,
[api]   amountOut: 3621.3551491024,
[api]   quotePrice: 7242710.2982048,
[api]   refPrice: 7057029.323076923,
[api]   tokenInUsd: 'available',
[api]   impact: 2.631149264474337,
[api]   formula: '((7242710.2982048 - 7057029.323076923) / 7057029.323076923) * 100 = 2.631149264474337'
[api] }
[api] [QuoteService] 0x API estimatedPriceImpact: {
[api]   raw: undefined,
[api]   parsed: 0,
[api]   multipliedBy100: 0,
[api]   impactVsMkt: 2.631149264474337,
[api]   willUse: 2.631149264474337
[api] }
[api] [2026-02-02T12:36:06.550Z] [INFO] [API-5001] 0x API price received successfully | DATA: {"sellToken":"0x4200000000000000000000000000000000000006","buyToken":"0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8","chainId":8453,"liquidityAvailable":true}
[api] [2026-02-02T12:36:06.552Z] [ERROR] [EXE-4004] [DirectSwap] Swap failed | DATA: {"error":"V3 quote deviates too much from on-chain quoter","stack":"Error: V3 quote deviates too much from on-chain quoter\n    at executeV3Swap (/Users/almurat/KiKo/kiko-api/src/services/dex/directSwapService.ts:525:19)\n    at process.processTicksAndRejections (node:i","tokenIn":"ETH","tokenOut":"0xf7b0dd0b64"}
[api] [2026-02-02T12:36:06.552Z] [WARN] [SYS-1007] [MainSwapService][1770035761396_trmwsn] Direct swap failed, falling back to 0x/Kyber | DATA: {"error":"V3 quote deviates too much from on-chain quoter"}
[api] [2026-02-02T12:36:06.552Z] [INFO] [EXE-4002] Initiating Unified Swap Execution | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","chainId":8453,"tokenIn":"ETH","tokenOut":"0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8","amount":"0.0005"}
[api] [2026-02-02T12:36:08.944Z] [INFO] [API-5001] On-chain price fetched from Uniswap V3 | DATA: {"token":"0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8","price":0.0003255297660967507,"marketCap":325529.7660967507}
[api] [2026-02-02T12:36:08.944Z] [INFO] [API-5001] ✅ Hybrid fetch complete | DATA: {"symbol":"GEKKO","price":0.0003255297660967507,"liquidity":90763.01,"provider":"rpc+api"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-02T12:36:09.683Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-02T12:36:11.503Z] [WARN] [API-5002] All on-chain DEX queries failed (Factory + Router) | DATA: {"token":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","chainId":8453}
[api] [2026-02-02T12:36:12.101Z] [WARN] [API-5002] RPC price failed, falling back to full API fetch | DATA: {"token":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"}
[api] [2026-02-02T12:36:12.101Z] [INFO] [API-5001] Fallback: Got price from GeckoTerminal | DATA: {"symbol":"ETH","price":2303.93}
[api] [2026-02-02T12:36:12.102Z] [INFO] [API-5001] ✅ Hybrid fetch complete | DATA: {"symbol":"ETH","price":2303.93,"liquidity":2616152.6265,"provider":"geckoterminal"}
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
[api]   deadline: 1770036372,
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
[api]   amountIn: 0.0005,
[api]   amountOut: 3668.651402831136,
[api]   quotePrice: 7337302.805662272,
[api]   refPrice: 7057029.323076923,
[api]   tokenInUsd: 'available',
[api]   impact: 3.9715504889406725,
[api]   formula: '((7337302.805662272 - 7057029.323076923) / 7057029.323076923) * 100 = 3.9715504889406725'
[api] }
[api] [QuoteService] Quote comparison: {
[api]   '0x_amount': '3621.35514910239980958',
[api]   kyber_amount: '3668.651402831135768576',
[api]   kyber_advantage_pct: '1.00',
[api]   chainId: 8453
[api] }
[api] [QuoteService] Preferring 0x for reliability { reason: 'prices within 2%', percentDiff: '1.00' }
[api] {"level":30,"time":1770035773597,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","res":{"statusCode":200},"responseTime":12185.848166998476,"msg":"request completed"}
[api] [2026-02-02T12:36:14.639Z] [ERROR] [API-5002] Alchemy Portfolio EVM API error | DATA: {}
[api] [TokenJob] Starting initial token refresh...
[api] [DBLock] Lock already held {
[api]   key: 'lock:tokenJob:refresh:eth',
[api]   expiresAt: '2026-01-27T12:24:00.148Z',
[api]   ageMs: 519374506
[api] }
[api] [DBLock] Potential stale lock detected { key: 'lock:tokenJob:refresh:eth', ageMs: 519374506, ttlSeconds: 240 }
[api] [TokenJob] Skipping refresh for Ethereum - another instance holds the lock
[api] [PlatformFee] Fees DISABLED, returning 0 bps
[api] [2026-02-02T12:36:17.286Z] [INFO] [API-5001] 0x API price received successfully | DATA: {"sellToken":"0x4200000000000000000000000000000000000006","buyToken":"0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913","chainId":8453,"liquidityAvailable":true}
[api] [2026-02-02T12:36:17.487Z] [INFO] [API-5001] 0x API price received successfully | DATA: {"sellToken":"0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8","buyToken":"0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913","chainId":8453,"liquidityAvailable":true}
[api] [PlatformFee] Fees DISABLED, returning 0 bps
[api] [Kyber] GET routes {
[api]   routesUrl: 'https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&tokenOut=0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8&amountIn=500000000000000&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] [2026-02-02T12:36:18.212Z] [INFO] [API-5001] 0x API Quote received successfully | DATA: {"sellToken":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","buyToken":"0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8","buyAmount":"3621855153870295026921","usedEndpoint":"allowance-holder"}
[api] [2026-02-02T12:36:18.213Z] [INFO] [API-5001] 0x API Quote successful | DATA: {"sellToken":"0xEeeeeEeeeE","buyToken":"0xf7b0dd0b64","buyAmount":"3621855153870295026921","hasAllowanceIssue":false,"usedEndpoint":"allowance-holder"}
[api] [QuoteService] calcImpactVsMkt: {
[api]   amountIn: 0.0005,
[api]   amountOut: 3621.855153870295,
[api]   quotePrice: 7243710.30774059,
[api]   refPrice: 7060163.076923077,
[api]   tokenInUsd: 'available',
[api]   impact: 2.5997590823001953,
[api]   formula: '((7243710.30774059 - 7060163.076923077) / 7060163.076923077) * 100 = 2.5997590823001953'
[api] }
[api] [QuoteService] 0x API estimatedPriceImpact: {
[api]   raw: undefined,
[api]   parsed: 0,
[api]   multipliedBy100: 0,
[api]   impactVsMkt: 2.5997590823001953,
[api]   willUse: 2.5997590823001953
[api] }
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-02T12:36:19.694Z] [INFO] [SYS-1001] No open positions to monitor
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
[api]   slippageTolerance: 300,
[api]   slippageToleranceType: 'number',
[api]   deadline: 1770036386,
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
[api]   amountIn: 0.0005,
[api]   amountOut: 3667.6634055056215,
[api]   quotePrice: 7335326.811011243,
[api]   refPrice: 7060163.076923077,
[api]   tokenInUsd: 'available',
[api]   impact: 3.8974132904602268,
[api]   formula: '((7335326.811011243 - 7060163.076923077) / 7060163.076923077) * 100 = 3.8974132904602268'
[api] }
[api] [QuoteService] Quote comparison: {
[api]   '0x_amount': '3621.855153870295026921',
[api]   kyber_amount: '3667.66340550562152448',
[api]   kyber_advantage_pct: '1.00',
[api]   chainId: 8453
[api] }
[api] [QuoteService] Preferring 0x for reliability { reason: 'prices within 2%', percentDiff: '1.00' }
[api] [2026-02-02T12:36:27.868Z] [INFO] [EXE-4002] Checking approval for swap | DATA: {"token":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","spender":"0x0000000000001ff3684f28c67538d4d072c22734","amount":"500000000000000","isNative":true}
[api] [2026-02-02T12:36:27.869Z] [INFO] [EXE-4002] Approval not needed or already set | DATA: {"token":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","spender":"0x0000000000001ff3684f28c67538d4d072c22734"}
[api] [SwapExecutor] Executing 0x Aggregator swap on chain 8453
[api] [SwapExecutor] ========== TRANSACTION EXECUTION ==========
[api] [SwapExecutor] DEX: 0x Aggregator
[api] [SwapExecutor] Transaction params: {
[api]   to: '0x0000000000001ff3684f28c67538d4d072c22734',
[api]   dataLength: 4106,
[api]   dataPrefix: '0x2213bc0b00000000000000000000000049fb9c16b9b2a19452633573603c8376',
[api]   value: '500000000000000',
[api]   router: '0x0000000000001ff3684f28c67538d4d072c22734',
[api]   allowanceTarget: '0x0000000000001ff3684f28c67538d4d072c22734'
[api] }
[api] [SwapExecutor] Swap details: {
[api]   tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
[api]   tokenOut: '0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8',
[api]   amountInBase: '500000000000000',
[api]   amountInHuman: '0.0005',
[api]   amountOut: '3621.855153870295026921',
[api]   slippageBps: 300,
[api]   priceImpact: 2.5997590823001953,
[api]   gasEstimate: 465628
[api] }
[api] [SwapExecutor] =============================================
[api] [SwapExecutor] Execution params prepared: {
[api]   dex: '0x Aggregator',
[api]   gasEstimate: 465628,
[api]   gasLimit: '698442',
[api]   maxFeePerGas: '3931504',
[api]   maxPriorityFeePerGas: '1000000'
[api] }
[api] [2026-02-02T12:36:29.375Z] [INFO] [SYS-1007] PrivyWallet Authorization Key config | DATA: {"keyFormat":"wallet-auth","keyLength":196,"keyIdConfigured":true,"keyId":"crdgro3bw0..."}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-02T12:36:29.701Z] [INFO] [SYS-1001] No open positions to monitor
[api] [sendTransaction] ========== PRIVY TX PARAMS ==========
[api] [sendTransaction] From: 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [sendTransaction] To: 0x0000000000001ff3684f28c67538d4d072c22734
[api] [sendTransaction] Value: 500000000000000
[api] [sendTransaction] ValueHex: 0x1c6bf52634000
[api] [sendTransaction] Data length: 4106
[api] [sendTransaction] Data (full): 0x2213bc0b00000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e0400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001c6bf5263400000000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e0400000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000007241fff991f000000000000000000000000a386bc9d8f26ab170a847d73226e3e0bceb0fe8e000000000000000000000000f7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c80000000000000000000000000000000000000000000000be736fead7cdfcd43800000000000000000000000000000000000000000000000000000000000000a0ee2dd9d4e0768d6f7cef34af0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000240000000000000000000000000000000000000000000000000000000000000038000000000000000000000000000000000000000000000000000000000000004a000000000000000000000000000000000000000000000000000000000000005a00000000000000000000000000000000000000000000000000000000000000044bd01c2260000000000000000000000000000000000000000000000000000000069809b6d0000000000000000000000000000000000000000000000000001c6bf526340000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee000000000000000000000000000000000000000000000000000000000000000f000000000000000000000000ad01c20d5886137e056775af56915de824c8fce5000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000000000000000000000000000000000000000027100000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000024d0e30db00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e48d68a15600000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e040000000000000000000000000000000000000000000000000000000000002710000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040420000000000000000000000000000000000000601000064fffd8963efd1fc6a506488495d951d5263988d250b3e328455c4059eeb9e3f84b5543f74e24e7e1b0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c4103b48be00000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e040000000000000000000000000b3e328455c4059eeb9e3f84b5543f74e24e7e1b0000000000000000000000000000000000000000000000000000000000002710000000000000000000000000f9e91661c101196146cb2bf62f803d8ea6880a2e0000000000000000000000000000000000000000000000000000000000001e01000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008434ee90ca000000000000000000000000f5c4f3dc02c3fb9279495a8fef7b0741da956157000000000000000000000000f7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c80000000000000000000000000000000000000000000000c457bc6d7b784a73b500000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
[api] [sendTransaction] ChainId: 8453
[api] [sendTransaction] Gas: 698442
[api] [sendTransaction] MaxFeePerGas: 3931504
[api] [sendTransaction] MaxPriorityFeePerGas: 1000000
[api] [sendTransaction] Full TX object: {
[api]   to: '0x0000000000001ff3684f28c67538d4d072c22734',
[api]   data: '0x2213bc0b00000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e0400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001c6bf5263400000000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e0400000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000007241fff991f000000000000000000000000a386bc9d8f26ab170a847d73226e3e0bceb0fe8e000000000000000000000000f7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c80000000000000000000000000000000000000000000000be736fead7cdfcd43800000000000000000000000000000000000000000000000000000000000000a0ee2dd9d4e0768d6f7cef34af0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000240000000000000000000000000000000000000000000000000000000000000038000000000000000000000000000000000000000000000000000000000000004a000000000000000000000000000000000000000000000000000000000000005a00000000000000000000000000000000000000000000000000000000000000044bd01c2260000000000000000000000000000000000000000000000000000000069809b6d0000000000000000000000000000000000000000000000000001c6bf526340000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee000000000000000000000000000000000000000000000000000000000000000f000000000000000000000000ad01c20d5886137e056775af56915de824c8fce5000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000000000000000000000000000000000000000027100000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000024d0e30db00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e48d68a15600000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e040000000000000000000000000000000000000000000000000000000000002710000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040420000000000000000000000000000000000000601000064fffd8963efd1fc6a506488495d951d5263988d250b3e328455c4059eeb9e3f84b5543f74e24e7e1b0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c4103b48be00000000000000000000000049fb9c16b9b2a19452633573603c837673fd7e040000000000000000000000000b3e328455c4059eeb9e3f84b5543f74e24e7e1b0000000000000000000000000000000000000000000000000000000000002710000000000000000000000000f9e91661c101196146cb2bf62f803d8ea6880a2e0000000000000000000000000000000000000000000000000000000000001e01000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008434ee90ca000000000000000000000000f5c4f3dc02c3fb9279495a8fef7b0741da956157000000000000000000000000f7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c80000000000000000000000000000000000000000000000c457bc6d7b784a73b500000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
[api]   value: '500000000000000',
[api]   chainId: 8453,
[api]   gas: '698442',
[api]   maxFeePerGas: '3931504',
[api]   maxPriorityFeePerGas: '1000000'
[api] }
[api] [sendTransaction] ===========================================
[api] [2026-02-02T12:36:32.893Z] [INFO] [EXE-4002] Ethereum transaction sent via Privy | DATA: {"txHash":"0x6d06d055f0716a875e0ead4a19e9ef7db09a241bd4a9c1854acc1acfc4c049a5","chainId":8453}
[api] [2026-02-02T12:36:33.895Z] [INFO] [EXE-4002] Swap Broadcast | DATA: {"txHash":"0x6d06d055f0716a875e0ead4a19e9ef7db09a241bd4a9c1854acc1acfc4c049a5","method":"0x Aggregator"}
[api] [2026-02-02T12:36:33.896Z] [INFO] [SYS-1007] [ConfirmWait] Waiting for confirmation: 0x6d06d055f0716a875e0ead4a19e9ef7db09a241bd4a9c1854acc1acfc4c049a5 on 8453
[api] [DBLock] Lock already held {
[api]   key: 'lock:tokenJob:refresh:solana',
[api]   expiresAt: '2026-01-28T08:14:15.060Z',
[api]   ageMs: 447979597
[api] }
[api] [DBLock] Potential stale lock detected {
[api]   key: 'lock:tokenJob:refresh:solana',
[api]   ageMs: 447979597,
[api]   ttlSeconds: 240
[api] }
[api] [TokenJob] Skipping refresh for Solana - another instance holds the lock
[api] [2026-02-02T12:36:37.373Z] [INFO] [EXE-4003] [ConfirmWait] Transaction confirmed: 0x6d06d055f0716a875e0ead4a19e9ef7db09a241bd4a9c1854acc1acfc4c049a5
[api] [2026-02-02T12:36:37.373Z] [INFO] [EXE-4003] Transaction confirmed on-chain | DATA: {"txHash":"0x6d06d055f0716a875e0ead4a19e9ef7db09a241bd4a9c1854acc1acfc4c049a5"}
[api] [2026-02-02T12:36:37.373Z] [INFO] [EXE-4002] [MainSwapService][1770035761396_trmwsn] Initiating Post-Buy Pre-Approval | DATA: {"token":"0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8","spender":"0x0000000000001ff3684f28c67538d4d072c22734"}
[api] [2026-02-02T12:36:37.388Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] [2026-02-02T12:36:37.392Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-02T12:36:37.394Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-02T12:36:37.394Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"}
[api] {"level":30,"time":1770035797405,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml55l2sg000110ulba5pr7n2","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55000},"msg":"incoming request"}
[api] {"level":30,"time":1770035797406,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","res":{"statusCode":204},"responseTime":0.7350829988718033,"msg":"request completed"}
[api] {"level":30,"time":1770035797407,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml55l2sg000110ulba5pr7n2","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55001},"msg":"incoming request"}
[api] {"level":30,"time":1770035797407,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","res":{"statusCode":204},"responseTime":0.26558299735188484,"msg":"request completed"}
[api] {"level":30,"time":1770035797408,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","req":{"method":"GET","url":"/api/chat/sessions/cml55l2sg000110ulba5pr7n2","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55000},"msg":"incoming request"}
[api] {"level":30,"time":1770035797409,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","req":{"method":"GET","url":"/api/chat/sessions/cml55l2sg000110ulba5pr7n2","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55001},"msg":"incoming request"}
[api] {"level":30,"time":1770035797414,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","res":{"statusCode":200},"responseTime":6.200167000293732,"msg":"request completed"}
[api] {"level":30,"time":1770035797414,"pid":91843,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","res":{"statusCode":200},"responseTime":5.46875,"msg":"request completed"}
[api] [sendTransaction] ========== PRIVY TX PARAMS ==========
[api] [sendTransaction] From: 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [sendTransaction] To: 0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8
[api] [sendTransaction] Value: 0
[api] [sendTransaction] ValueHex: 0x0
[api] [sendTransaction] Data length: 138
[api] [sendTransaction] Data (full): 0x095ea7b30000000000000000000000000000000000001ff3684f28c67538d4d072c22734ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
[api] [sendTransaction] ChainId: 8453
[api] [sendTransaction] Gas: undefined
[api] [sendTransaction] MaxFeePerGas: undefined
[api] [sendTransaction] MaxPriorityFeePerGas: undefined
[api] [sendTransaction] Full TX object: {
[api]   to: '0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8',
[api]   data: '0x095ea7b30000000000000000000000000000000000001ff3684f28c67538d4d072c22734ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
[api]   value: '0',
[api]   chainId: 8453
[api] }
[api] [sendTransaction] ===========================================
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-02T12:36:39.707Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-02T12:36:40.665Z] [INFO] [EXE-4002] Ethereum transaction sent via Privy | DATA: {"txHash":"0x6764b64438f706ca58a3fac311b5a4248e456387a7b13b3090f0f990a2486ffd","chainId":8453}
[api] [2026-02-02T12:36:41.667Z] [INFO] [EXE-4003] [MainSwapService][1770035761396_trmwsn] Post-Buy Pre-Approval Sent | DATA: {"txHash":"0x6764b64438f706ca58a3fac311b5a4248e456387a7b13b3090f0f990a2486ffd","token":"0xf7b0dd0b642a6ccc2fc4d8ffe2bffb0cac8c43c8"}