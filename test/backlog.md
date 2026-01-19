[api] {"level":30,"time":1768808146079,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":61892},"msg":"incoming request"}
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
[api] [ChatWorker] Running task cmkkup8cp003hgi2c26jo5r4z for session cmkkup8bu0039gi2cjn7gtfqp
[api] {"timestamp":"2026-01-19T07:35:46.135Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:46.135Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:46.137Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[python] INFO:moderation.router:Moderating input: hey what's the trending token at base?...
[api] {"timestamp":"2026-01-19T07:35:46.602Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1cf7b0a3-a183-4cdc-b2aa-caf918fdac56","address":"0x01af27cd29eaab7392039c9fae18a5c86938b96a"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:46.604Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1cf7b0a3-a183-4cdc-b2aa-caf918fdac56","address":"0x0077ae08200c05af9741b38366e26f7b1e7bfe2d"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:46.667Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1cf7b0a3-a183-4cdc-b2aa-caf918fdac56","address":"0x04acf03e000f1e982d619c7f40c75ffa32303c77"},"service":"kiko-api","env":"production"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] DEBUG: Loading .env from /Users/almurat/KiKo/kiko-python/kiko-api/.env
[python] DEBUG: OPENAI_API_KEY present: True
[python] INFO:     127.0.0.1:61995 - "POST /moderation/input HTTP/1.1" 200 OK
[api] {"timestamp":"2026-01-19T07:35:47.614Z","level":"INFO","code":"SYS-1007","message":"Moderation Input check result","metadata":{"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:47.616Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok: Sent message_start for cmkkup8cn003fgi2cx86k8pvt
[api] {"timestamp":"2026-01-19T07:35:47.616Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:47.618Z","level":"INFO","code":"SYS-1007","message":"ToolPreRouter: Category matched","metadata":{"category":"\\b(trending|hot\\s+tokens?|gainers|movers|top\\s+tokens?)\\b","tools":["get_trending_tokens","web_search"]},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok base filtered to 2 tools for message: "hey what's the trending token at base?..."
[api] [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
[api] {"timestamp":"2026-01-19T07:35:48.132Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818","chain":"solana","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:48.133Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:48.208Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1cf7b0a3-a183-4cdc-b2aa-caf918fdac56","address":"0x06943fe338e9e6d9df904b42ee0bc1d212e2c955"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:48.250Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1cf7b0a3-a183-4cdc-b2aa-caf918fdac56","address":"0x07d3eab4cb4e030722cfa848f6059cff839b7d61"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:49.158Z","level":"WARN","code":"API-5002","message":"Snapchain Hub failed after retries, trying DB fallback","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818","fid":4167},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:49.160Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1cf7b0a3-a183-4cdc-b2aa-caf918fdac56","address":"0x1596d5e13ff436897ffe83c12e955b4f4f11c47f"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:49.165Z","level":"INFO","code":"SYS-1007","message":"Using DB cached data for FID from Snapchain","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818","fid":4167,"username":"nounishprof"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:49.201Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1cf7b0a3-a183-4cdc-b2aa-caf918fdac56","address":"0x0f689993a73351104ae69465a77759555e48bf2c"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:49.275Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1cf7b0a3-a183-4cdc-b2aa-caf918fdac56","address":"0x18a1c2f95ff8e7b87804067d3aa6f7e125ba1ad9"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:50.134Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1cf7b0a3-a183-4cdc-b2aa-caf918fdac56","address":"0x1e358596f48420fe4cd147dcc850661632125e21"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:50.144Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1cf7b0a3-a183-4cdc-b2aa-caf918fdac56","address":"0x2107bdfb49d6812d791bd5d3de583db4eb8be02e"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:50.145Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1cf7b0a3-a183-4cdc-b2aa-caf918fdac56","address":"0x279e8f331033e26476f22a93e009b7111a75601c"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:50.504Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"1cf7b0a3-a183-4cdc-b2aa-caf918fdac56","status":404,"statusText":"Not Found","error":"{\"errors\":[{\"status\":\"404\",\"title\":\"Not Found\"}],\"meta\":{\"ref_id\":\"8b855096-a454-4eb8-a450-3f1f1b122a8b\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1e358596f48420fe4cd147dcc850661632125e21/pools?include=base_token,quote_token","address":"0x1e358596f48420fe4cd147dcc850661632125e21","network":"base"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768808150693,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","res":{"statusCode":200},"responseTime":15920.48512500152,"msg":"request completed"}
[api] {"level":30,"time":1768808150693,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","res":{"statusCode":200},"responseTime":17162.11304199882,"msg":"request completed"}
[api] {"timestamp":"2026-01-19T07:35:51.334Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"fd9b1b57-c8c2-4892-8eac-f8a33872c450","address":"0x1e358596f48420fe4cd147dcc850661632125e21"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:51.569Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"fd9b1b57-c8c2-4892-8eac-f8a33872c450","status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1e358596f48420fe4cd147dcc850661632125e21/pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:52.460Z","level":"INFO","code":"AI-6001","message":"Timer finished: intent_parsing_9797ba2f","metadata":{"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"token_trending","highLevelIntent":"MARKET_ANALYSIS","hasAI":true,"confidence":0.6809401076758503,"routingStage":"hybrid","conflict":"multi","labels":[{"label":"MARKET_ANALYSIS","confidence":0.6809401076758503},{"label":"SOCIAL_SENSING","confidence":0.5954700538379252},{"label":"TRADING","confidence":0.11547005383792518}],"durationMs":4842,"timerLabel":"intent_parsing_9797ba2f"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:52.464Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok skill-gated to 2 tools for intent=MARKET_ANALYSIS skills=market_macro, token_analysis, zora_nfts
[api] [ChatWorker] 🚀 Phase 5: Early pre-fetching get_trending_tokens for action token_trending
[api] [GetTrendingTokens] Fetching trending tokens for eth (5m) from DexScreener (Enhanced Algorithm)...
[api] {"timestamp":"2026-01-19T07:35:52.465Z","level":"INFO","code":"AI-6006","message":"PromptOrchestrator: Intent matched skills","metadata":{"intent":"MARKET_ANALYSIS","count":3,"skills":["market_macro","token_analysis","zora_nfts"]},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:52.465Z","level":"INFO","code":"AI-6003","message":"Timer finished: prompt_gen_MARKET_ANALYSIS_grok","metadata":{"model":"grok","intent":"MARKET_ANALYSIS","length":16088,"durationMs":0,"timerLabel":"prompt_gen_MARKET_ANALYSIS_grok"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok: Waiting for early pre-fetch to complete
[api] {"timestamp":"2026-01-19T07:35:53.019Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":24,"limit":10},"service":"kiko-api","env":"production"}
[api] [ChatWorker] ✅ Early pre-fetch stored for get_trending_tokens
[api] {"timestamp":"2026-01-19T07:35:53.030Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:53.031Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:53.819Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1444a3f6-7964-44c0-90fb-09c90fc073be","address":"0x2c85854a16a5400e002e16ce7a0d4d733a0b7faa"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:54.407Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1444a3f6-7964-44c0-90fb-09c90fc073be","address":"0x2c12fabe87b10dfdf9674d2e409130b5a79ad88c"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:55.366Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"fd9b1b57-c8c2-4892-8eac-f8a33872c450","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1e358596f48420fe4cd147dcc850661632125e21/pools?include=base_token,quote_token","address":"0x1e358596f48420fe4cd147dcc850661632125e21","network":"base"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x8: API-5004:External API requested retry","timestamp":"2026-01-19T07:35:57.107Z","metadata":{"traceId":"1444a3f6-7964-44c0-90fb-09c90fc073be"}}
[api] {"timestamp":"2026-01-19T07:35:57.108Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"1444a3f6-7964-44c0-90fb-09c90fc073be","status":429,"attempt":3,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x2c12fabe87b10dfdf9674d2e409130b5a79ad88c/pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:57.752Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"1444a3f6-7964-44c0-90fb-09c90fc073be","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x2c85854a16a5400e002e16ce7a0d4d733a0b7faa/pools?include=base_token,quote_token","address":"0x2c85854a16a5400e002e16ce7a0d4d733a0b7faa","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:58.339Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"1444a3f6-7964-44c0-90fb-09c90fc073be","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x2c12fabe87b10dfdf9674d2e409130b5a79ad88c/pools?include=base_token,quote_token","address":"0x2c12fabe87b10dfdf9674d2e409130b5a79ad88c","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:58.773Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818","candidates":124,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:58.774Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818","count":100,"chain":"solana","durationMs":10642},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for Solana
[api] Saved 100 trending tokens for solana to database and memory cache
[api] [TokenJob] Saved 100 tokens for Solana to DB + cache
[api] {"timestamp":"2026-01-19T07:35:59.310Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1444a3f6-7964-44c0-90fb-09c90fc073be","address":"0x3d0232cf421d75425923130cd7ce55109b75afd7"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:59.350Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1444a3f6-7964-44c0-90fb-09c90fc073be","address":"0x35ce2d60f6d569afb0666a54bc4c7f9d0a333036"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:35:59.387Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"fd9b1b57-c8c2-4892-8eac-f8a33872c450","address":"0x3fc63cb55dd2f2d14bb9a581ebee1a43ea668b76"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T07:36:00.086Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x8: API-5004:External API requested retry","timestamp":"2026-01-19T07:36:02.821Z","metadata":{"traceId":"1444a3f6-7964-44c0-90fb-09c90fc073be"}}
[api] {"timestamp":"2026-01-19T07:36:02.822Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"1444a3f6-7964-44c0-90fb-09c90fc073be","status":429,"attempt":3,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x35ce2d60f6d569afb0666a54bc4c7f9d0a333036/pools"},"service":"kiko-api","env":"production"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/embeddings "HTTP/1.1 200 OK"
[python] [Model] Original: grok-4-non-reasoning -> Normalized: grok-4-1-fast-non-reasoning
[python] [RAG] 🔍 Informational query detected: '[CONTEXT]
[python] - Current Time: 2026-01-19T07:35:53.030Z...'
[python] [RAG] ⚠️ Error retrieving from KnowledgeBase: Collection expecting embedding with dimension of 384, got 1536
[python] [Tools] Dynamic tool set from Node: 2 tool(s) (1 custom)
[python] [Chat] Creating chat with model: grok-4-1-fast-non-reasoning (original: grok-4-non-reasoning)
[python] [Chat] Creating chat with 2 tool(s): get_trending_tokens, 
[python] [Chat] Chat created
[python] [Messages] Adding 3 message(s) to chat
[python] [Messages] [1] System prompt from Node.js (length=16088 chars)
[python] [Messages] [2] User: [CONTEXT]
[python] - Current Time: 2026-01-19T07:35:53.030Z...
[python] [Messages] [3] Assistant: (skipped)
[python] [Chat] Starting streaming response generation
[python] [Tools] Custom tool allowlist size: 1
[python] INFO:     127.0.0.1:62047 - "POST /grok/v1/chat/completions HTTP/1.1" 200 OK
[api] [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
[api] {"timestamp":"2026-01-19T07:36:03.820Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818","chain":"base","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:36:04.068Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"fd9b1b57-c8c2-4892-8eac-f8a33872c450","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x3fc63cb55dd2f2d14bb9a581ebee1a43ea668b76/pools?include=base_token,quote_token","address":"0x3fc63cb55dd2f2d14bb9a581ebee1a43ea668b76","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:36:04.071Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"1444a3f6-7964-44c0-90fb-09c90fc073be","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x35ce2d60f6d569afb0666a54bc4c7f9d0a333036/pools?include=base_token,quote_token","address":"0x35ce2d60f6d569afb0666a54bc4c7f9d0a333036","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:36:05.002Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1444a3f6-7964-44c0-90fb-09c90fc073be","address":"0x3fc63cb55dd2f2d14bb9a581ebee1a43ea668b76"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:36:05.142Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1444a3f6-7964-44c0-90fb-09c90fc073be","address":"0x4709ac37a7e3f97aec93796db2a214339b03c7c7"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:36:05.278Z","level":"INFO","code":"WTC-2002","message":"Found addresses via WebSocket","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818","count":178,"chain":"base"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768808167201,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","req":{"method":"POST","url":"/api/ai/tools/execute","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":62316},"msg":"incoming request"}
[api] [GetTrendingTokens] Fetching trending tokens for base (5m) from DexScreener (Enhanced Algorithm)...
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x5: API-5004:External API requested retry","timestamp":"2026-01-19T07:36:07.834Z","metadata":{"traceId":"1444a3f6-7964-44c0-90fb-09c90fc073be"}}
[api] {"timestamp":"2026-01-19T07:36:07.834Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"1444a3f6-7964-44c0-90fb-09c90fc073be","status":429,"attempt":3,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x4709ac37a7e3f97aec93796db2a214339b03c7c7/pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:36:07.889Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818","candidates":40,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:36:08.400Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"traceId":"be0524a4-eeb2-425e-bb74-d9c4198f371a","candidates":40,"limit":10},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768808168401,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","res":{"statusCode":200},"responseTime":1199.609375,"msg":"request completed"}
[python] INFO:httpx:HTTP Request: POST http://localhost:3001/api/ai/tools/execute "HTTP/1.1 200 OK"
[api] {"level":30,"time":1768808169234,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","res":{"statusCode":200},"responseTime":23208.68508299999,"msg":"request completed"}
[api] {"timestamp":"2026-01-19T07:36:09.562Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1444a3f6-7964-44c0-90fb-09c90fc073be","address":"0x4d1aa95f03042718cf489415b999bffb28b3d376"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:36:09.588Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"1444a3f6-7964-44c0-90fb-09c90fc073be","address":"0x4f38ce38be7c33cc693f8ae3aa7e24f33a493721"},"service":"kiko-api","env":"production"}
[api] [ChatWorker DEBUG] Stream line with valid data: data: {"id": "chatcmpl--5429400389787688146", "object": "chat.completion.chunk", "created": 1768808172, "model": "grok-4-non-reasoning", "choices": [{"index": 0, "delta": {}, "message": {"citations": []}, "finish_reason": "stop"}], "usage": {"prompt_tokens": 5898, "completion_tokens": 326, "total_tokens": 6224}}
[api] {"timestamp":"2026-01-19T07:36:12.039Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:36:12.039Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_citations","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"citations","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_citations"},"service":"kiko-api","env":"production"}
[python] INFO:moderation.router:Moderating input: **Top trending on Base right now (last 5m by volum...
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x10: API-5004:External API requested retry","timestamp":"2026-01-19T07:36:13.023Z","metadata":{"traceId":"1444a3f6-7964-44c0-90fb-09c90fc073be"}}
[api] {"timestamp":"2026-01-19T07:36:13.023Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"1444a3f6-7964-44c0-90fb-09c90fc073be","status":429,"attempt":3,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x4f38ce38be7c33cc693f8ae3aa7e24f33a493721/pools"},"service":"kiko-api","env":"production"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] [Generate] Starting generator
[python] [Tool Call] Detected in chunk: 1 tool(s)
[python] [Tool Call] get_trending_tokens: {"chain":"base","limit":10,"duration":"5m"}...
[python] [Tool Call] Custom tool detected - buffered content will be discarded
[python] [Tool Call Event] Sending tool call event for get_trending_tokens (ID: call_1768808167156516_-3081935633024219538)
[python] [Custom Tool] Executing get_trending_tokens...
[python] [Tool Execution] Executing tool: get_trending_tokens with args: {'chain': 'base', 'limit': 10, 'duration': '5m'}
[python] [Custom Tool] get_trending_tokens returned: 2328 chars
[python] [Custom Tool] Appending tool result to chat: [
[python]   {
[python]     "rank": 1,
[python]     "name": "Roll",
[python]     "symbol": "ROLL",
[python]     "address": "0xAb6363dA0C80cEF3Ae1...
[python] [Custom Tool] Added tool result to chat, will call Grok again
[python] [Tool Call] Detected in response (fallback): 1 tool(s)
[python] [Tool Call] Skipping duplicate: get_trending_tokens (already processed)
[python] [Tool Turn] Tool call detected, continuing to turn 2
[python] [Citations] No final response available
[python] [Citations] Final: No citations collected
[python] [Usage] Prompt: 5898, Completion: 326, Total: 6224
[python] INFO:     127.0.0.1:62353 - "POST /moderation/input HTTP/1.1" 200 OK
[api] {"timestamp":"2026-01-19T07:36:13.391Z","level":"INFO","code":"SYS-1007","message":"Moderation Output check result","metadata":{"safe":true,"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok task cmkkup8cp003hgi2c26jo5r4z completed, 326 chunks
[api] {"timestamp":"2026-01-19T07:36:13.396Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:36:13.396Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Task cmkkup8cp003hgi2c26jo5r4z completed successfully
[api] {"level":30,"time":1768808173402,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkup8bu0039gi2cjn7gtfqp","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":61988},"msg":"incoming request"}
[api] {"level":30,"time":1768808173405,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-k","res":{"statusCode":204},"responseTime":2.4145840015262365,"msg":"request completed"}
[api] {"level":30,"time":1768808173407,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","req":{"method":"GET","url":"/api/chat/sessions/cmkkup8bu0039gi2cjn7gtfqp","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":61896},"msg":"incoming request"}
[api] {"level":30,"time":1768808173414,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","res":{"statusCode":200},"responseTime":6.961582999676466,"msg":"request completed"}
[api] {"timestamp":"2026-01-19T07:36:13.500Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"1444a3f6-7964-44c0-90fb-09c90fc073be","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x4d1aa95f03042718cf489415b999bffb28b3d376/pools?include=base_token,quote_token","address":"0x4d1aa95f03042718cf489415b999bffb28b3d376","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:36:14.254Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"1444a3f6-7964-44c0-90fb-09c90fc073be","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x4f38ce38be7c33cc693f8ae3aa7e24f33a493721/pools?include=base_token,quote_token","address":"0x4f38ce38be7c33cc693f8ae3aa7e24f33a493721","network":"base"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768808174256,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","res":{"statusCode":200},"responseTime":28176.78095900081,"msg":"request completed"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x3: API-5004:External API requested retry","timestamp":"2026-01-19T07:36:18.325Z","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818"}}
[api] {"timestamp":"2026-01-19T07:36:18.325Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818","status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/trending_pools"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x3: API-5004:External API requested retry","timestamp":"2026-01-19T07:36:23.782Z","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/embeddings "HTTP/1.1 200 OK"
[python] [Model] Original: grok-4-non-reasoning -> Normalized: grok-4-1-fast-non-reasoning
[python] [RAG] 🔍 Informational query detected: '[CONTEXT]
[python] - Current Time: 2026-01-19T07:37:05.708Z...'
[python] [RAG] ⚠️ Error retrieving from KnowledgeBase: Collection expecting embedding with dimension of 384, got 1536
[python] [Tools] Dynamic tool set from Node: 4 tool(s) (3 custom)
[python] [Chat] Creating chat with model: grok-4-1-fast-non-reasoning (original: grok-4-non-reasoning)
[python] [Chat] Creating chat with 4 tool(s): get_token_info, , prepare_swap_transaction, check_token_risk
[python] [Chat] Chat created
[python] [Messages] Adding 5 message(s) to chat
[python] [Messages] [1] System prompt from Node.js (length=21426 chars)
[python] [Messages] [2] User: hey what's the trending token at base?...
[python] [Messages] [3] Assistant: (skipped)
[python] [Messages] [4] User: [CONTEXT]
[python] - Current Time: 2026-01-19T07:37:05.708Z...
[python] [Messages] [5] Assistant: (skipped)
[python] [Chat] Starting streaming response generation
[python] [Tools] Custom tool allowlist size: 3
[python] INFO:     127.0.0.1:63544 - "POST /grok/v1/chat/completions HTTP/1.1" 200 OK
[api] {"timestamp":"2026-01-19T07:37:08.024Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818","candidates":7,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:37:08.066Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"cee42aae-d6ad-470c-8bbe-247194ca8821","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x581632b90ab75c871641fef5ce51dfd528e45aee/pools?include=base_token,quote_token","address":"0x581632b90ab75c871641fef5ce51dfd528e45aee","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:37:08.466Z","level":"ERROR","code":"API-5002","message":"GeckoTerminal API error fetching token pools","metadata":{"traceId":"cee42aae-d6ad-470c-8bbe-247194ca8821","status":429,"statusText":"Too Many Requests","error":"{\"status\":{\"error_code\":429,\"error_message\":\"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits and use the onchain endpoints: https://docs.coingecko.com/reference/endpoint-overview\"}}","url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x598b6297eeb4988d65ca883fecab6b9e01e7fff7/pools?include=base_token,quote_token","address":"0x598b6297eeb4988d65ca883fecab6b9e01e7fff7","network":"base"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:37:08.783Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"cee42aae-d6ad-470c-8bbe-247194ca8821","address":"0x6553290cbb449aae8f020a71d867911845f6b3e2"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:37:08.790Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"cee42aae-d6ad-470c-8bbe-247194ca8821","address":"0x67159b4b3311f05647d8f70e09660e270af8d223"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x9: API-5004:External API requested retry","timestamp":"2026-01-19T07:37:10.259Z","metadata":{"traceId":"cee42aae-d6ad-470c-8bbe-247194ca8821"}}
[api] {"timestamp":"2026-01-19T07:37:10.259Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"cee42aae-d6ad-470c-8bbe-247194ca8821","status":429,"attempt":2,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/tokens/0x67159b4b3311f05647d8f70e09660e270af8d223/pools"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768808230535,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-x","req":{"method":"POST","url":"/api/ai/tools/execute","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":63586},"msg":"incoming request"}
[api] {"level":30,"time":1768808231657,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","res":{"statusCode":200},"responseTime":24586.496750000864,"msg":"request completed"}
[api] {"level":30,"time":1768808231657,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","res":{"statusCode":200},"responseTime":21254.299416000023,"msg":"request completed"}
[api] {"level":30,"time":1768808231657,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","res":{"statusCode":200},"responseTime":22913.081957999617,"msg":"request completed"}
[api] {"level":30,"time":1768808231657,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","res":{"statusCode":200},"responseTime":21211.57379199937,"msg":"request completed"}
[api] {"timestamp":"2026-01-19T07:37:11.958Z","level":"ERROR","code":"API-5002","message":"API error on trending page","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818","page":1,"status":429,"statusText":"Too Many Requests"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:37:11.958Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818","network":"arbitrum","count":0,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:37:11.959Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818","count":7,"chain":"arbitrum","durationMs":7668},"service":"kiko-api","env":"production"}
[api] [TokenJob] DexScreener returned 7 tokens, trying GeckoTerminal fallback...
[api] [GetTokenInfo] Attempting DexScreener fallback...
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x7: API-5004:External API requested retry","timestamp":"2026-01-19T07:37:15.326Z","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818"}}
[api] {"timestamp":"2026-01-19T07:37:15.326Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818","status":429,"attempt":3,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/arbitrum/trending_pools"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1768808235695,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-x","res":{"statusCode":200},"responseTime":5159.233207998797,"msg":"request completed"}
[python] INFO:httpx:HTTP Request: POST http://localhost:3001/api/ai/tools/execute "HTTP/1.1 200 OK"
[api] {"level":30,"time":1768808235728,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","req":{"method":"POST","url":"/api/ai/tools/execute","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":63826},"msg":"incoming request"}
[api] [CheckTokenRisk] Scanning 0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525 on base (chainId: 8453)
[api] [CheckTokenRisk] Fetching from GoPlus: https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=0x3da7ad8101bc1fc0c80e2860be9a531385258525
[api] [CheckTokenRisk] Attempting local scan/verification for 0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525 on base
[api] {"timestamp":"2026-01-19T07:37:16.571Z","level":"ERROR","code":"API-5002","message":"API error on trending page","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818","page":1,"status":429,"statusText":"Too Many Requests"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:37:16.571Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818","network":"arbitrum","count":0,"limit":100},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 7 trending tokens for Arbitrum
[api] Saved 7 trending tokens for arbitrum to database and memory cache
[api] [TokenJob] Saved 7 tokens for Arbitrum to DB + cache
[api] {"level":30,"time":1768808241441,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-y","res":{"statusCode":200},"responseTime":5712.515250001103,"msg":"request completed"}
[python] INFO:httpx:HTTP Request: POST http://localhost:3001/api/ai/tools/execute "HTTP/1.1 200 OK"
[api] [TokenJob] Fetching trending tokens for Optimism via DexScreener Premium...
[api] {"timestamp":"2026-01-19T07:37:21.584Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818","chain":"optimism","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:37:21.584Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:37:25.925Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818","candidates":11,"limit":200},"service":"kiko-api","env":"production"}
[api] [ChatWorker DEBUG] Stream line with valid data: data: {"id": "chatcmpl--3604804600007413834", "object": "chat.completion.chunk", "created": 1768808246, "model": "grok-4-non-reasoning", "choices": [{"index": 0, "delta": {}, "message": {"citations": []}, "finish_reason": "stop"}], "usage": {"prompt_tokens": 10570, "completion_tokens": 204, "total_tokens": 10774}}
[api] {"timestamp":"2026-01-19T07:37:26.565Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:37:26.565Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_citations","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"citations","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_citations"},"service":"kiko-api","env":"production"}
[python] INFO:moderation.router:Moderating input: **$SXS (SessionX) on Base** - Up 37% in 24h, $3.2M...
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] [Generate] Starting generator
[python] [Tool Call] Detected in chunk: 1 tool(s)
[python] [Tool Call] get_token_info: {"address":"0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525","chain":"base"}...
[python] [Tool Call] Custom tool detected - buffered content will be discarded
[python] [Tool Call Event] Sending tool call event for get_token_info (ID: call_1768808230492848_-3625318390816071490)
[python] [Custom Tool] Executing get_token_info...
[python] [Tool Execution] Executing tool: get_token_info with args: {'address': '0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525', 'chain': 'base'}
[python] [Custom Tool] get_token_info returned: 1141 chars
[python] [Custom Tool] Appending tool result to chat: {
[python]   "source": "DexScreener",
[python]   "address": "0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525",
[python]   "name": "S...
[python] [Custom Tool] Added tool result to chat, will call Grok again
[python] [Tool Call] Detected in chunk: 1 tool(s)
[python] [Tool Call] check_token_risk: {"address":"0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525","chain":"base"}...
[python] [Tool Call] Custom tool detected - buffered content will be discarded
[python] [Tool Call Event] Sending tool call event for check_token_risk (ID: call_1768808235697850_8722209639435885954)
[python] [Custom Tool] Executing check_token_risk...
[python] [Tool Execution] Executing tool: check_token_risk with args: {'address': '0x3dA7Ad8101bc1fc0C80E2860Be9A531385258525', 'chain': 'base'}
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
[python] [Tool Call] Skipping duplicate: get_token_info (already processed)
[python] [Tool Call] Detected in response (fallback): 3 tool(s)
[python] [Tool Call] Skipping duplicate: get_token_info (already processed)
[python] [Tool Call] Skipping duplicate: check_token_risk (already processed)
[python] [Tool Call] Skipping duplicate: get_token_info (already processed)
[python] [Tool Turn] Tool call detected, continuing to turn 2
[python] [Citations] No final response available
[python] [Citations] Final: No citations collected
[python] [Usage] Prompt: 10570, Completion: 204, Total: 10774
[python] INFO:     127.0.0.1:64093 - "POST /moderation/input HTTP/1.1" 200 OK
[api] {"timestamp":"2026-01-19T07:37:27.660Z","level":"INFO","code":"SYS-1007","message":"Moderation Output check result","metadata":{"safe":true,"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok task cmkkuqm0t008ngi2cot59niz3 completed, 204 chunks
[api] {"timestamp":"2026-01-19T07:37:27.669Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:37:27.669Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Task cmkkuqm0t008ngi2cot59niz3 completed successfully
[api] {"level":30,"time":1768808247676,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-z","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmkkup8bu0039gi2cjn7gtfqp","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":63068},"msg":"incoming request"}
[api] {"level":30,"time":1768808247677,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-z","res":{"statusCode":204},"responseTime":0.8715000003576279,"msg":"request completed"}
[api] {"level":30,"time":1768808247680,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-10","req":{"method":"GET","url":"/api/chat/sessions/cmkkup8bu0039gi2cjn7gtfqp","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":63160},"msg":"incoming request"}
[api] {"level":30,"time":1768808247690,"pid":14585,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-10","res":{"statusCode":200},"responseTime":10.092125000432134,"msg":"request completed"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x2: API-5001:Skipping low liquidity token","timestamp":"2026-01-19T07:37:28.784Z","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818"}}
[api] {"timestamp":"2026-01-19T07:37:28.784Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818","symbol":"OP","liquidity":218.4698},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-19T07:37:30.100Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-19T07:37:30.781Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"traceId":"f23e45b8-5b60-4c21-ac8f-8ac9b63d2818","status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/optimism/trending_pools"},"service":"kiko-api","env":"production"}