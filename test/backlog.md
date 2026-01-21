[api] [ChatWorker] Running task cmko89zxb000odjq3fo6h85q3 for session cmko89zw3000gdjq3vadp13aa
[api] {"timestamp":"2026-01-21T16:19:09.769Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:19:09.769Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:19:09.770Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[python] INFO:moderation.router:Moderating input: X上最热门 的话题是什么？...
[api] {"timestamp":"2026-01-21T16:19:10.823Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":25,"limit":200},"service":"kiko-api","env":"production"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] DEBUG: Loading .env from /Users/almurat/KiKo/kiko-python/kiko-api/.env
[python] DEBUG: OPENAI_API_KEY present: True
[python] INFO:     127.0.0.1:56217 - "POST /moderation/input HTTP/1.1" 200 OK
[api] {"timestamp":"2026-01-21T16:19:11.274Z","level":"INFO","code":"SYS-1007","message":"Moderation Input check result","metadata":{"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:19:11.276Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok: Sent message_start for cmko89zxb000mdjq3oohl879j
[api] {"timestamp":"2026-01-21T16:19:11.276Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok base filtered to 44 tools for message: "X上最热门 的话题是什么？..."
[api] {"timestamp":"2026-01-21T16:19:12.146Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"XOR","liquidity":250.5707},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:19:13.574Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"e0b40688-d92c-4b88-a2d8-0310ad68fb3d","address":"0x7e9a49bd6bf29348453eab3d57ad1d3d7bb8fa96"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:19:13.581Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"e0b40688-d92c-4b88-a2d8-0310ad68fb3d","address":"0x82898bd7d368aad3ad0de3c18f7d559ebd6c5eef"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:19:13.582Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"e0b40688-d92c-4b88-a2d8-0310ad68fb3d","address":"0xc4bbdd0802bb284820230f6883071b71061b4f49"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:19:13.586Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"e0b40688-d92c-4b88-a2d8-0310ad68fb3d","address":"0x596116dccd760fe9160111e274ae22a6b5966d0e"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:19:14.996Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"e0b40688-d92c-4b88-a2d8-0310ad68fb3d","address":"0x581466363fe17a02ac89f354cb0f4ec3186574df"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:19:15.077Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"e0b40688-d92c-4b88-a2d8-0310ad68fb3d","address":"0xb9d60d405aa31d513861eaf98cbe0b724116a5df"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:19:15.177Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"e0b40688-d92c-4b88-a2d8-0310ad68fb3d","address":"0xf1930d3b95198815eb48751835c0cabcf6649fad"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:19:15.211Z","level":"INFO","code":"API-5001","message":"No pairs found for token on DexScreener","metadata":{"traceId":"e0b40688-d92c-4b88-a2d8-0310ad68fb3d","address":"0xdabd0d5d4af14ee3e7ddd92fca731bf5b069e673"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:19:16.246Z","level":"INFO","code":"AI-6001","message":"Timer finished: intent_parsing_9330b1cf","metadata":{"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"social_trending","highLevelIntent":"SOCIAL_SENSING","hasAI":true,"confidence":0.75,"routingStage":"llm","labels":[{"label":"SOCIAL_SENSING","confidence":0.75},{"label":"GENERAL_CHAT","confidence":0.3},{"label":"MARKET_ANALYSIS","confidence":0.1632993161855452}],"durationMs":4968,"timerLabel":"intent_parsing_9330b1cf"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:19:16.252Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok free intent mode: using all 43 tools (no gating, exclude external_web_search)
[api] [ChatWorker] 🚀 Phase 5: Early pre-fetching get_trending_casts for action social_trending
[api] {"timestamp":"2026-01-21T16:19:16.254Z","level":"INFO","code":"AI-6003","message":"Timer finished: prompt_gen_SOCIAL_SENSING_grok","metadata":{"model":"grok","intent":"SOCIAL_SENSING","length":11295,"durationMs":1,"timerLabel":"prompt_gen_SOCIAL_SENSING_grok"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok: Waiting for early pre-fetch to complete
[api] {"timestamp":"2026-01-21T16:19:16.318Z","level":"INFO","code":"SOC-7001","message":"Timer finished: get_trending_casts_trending","metadata":{"timeRange":"trending","limit":30,"offset":0,"count":30,"fromCache":false,"durationMs":65,"timerLabel":"get_trending_casts_trending"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] ✅ Early pre-fetch stored for get_trending_casts
[api] {"timestamp":"2026-01-21T16:19:16.318Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Farcaster: Pre-fetching trending casts for social_trending intent
[api] {"timestamp":"2026-01-21T16:19:16.322Z","level":"INFO","code":"SOC-7001","message":"Timer finished: get_trending_casts_24h","metadata":{"timeRange":"24h","limit":20,"offset":0,"count":20,"fromCache":false,"durationMs":4,"timerLabel":"get_trending_casts_24h"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] ⚡ [CACHE HIT]: Grok get_trending_casts
[api] {"timestamp":"2026-01-21T16:19:16.323Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"level":30,"time":1769012356460,"pid":39905,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","res":{"statusCode":200},"responseTime":9067.605250000954,"msg":"request completed"}
[api] {"level":30,"time":1769012356460,"pid":39905,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","res":{"statusCode":200},"responseTime":7995.735208004713,"msg":"request completed"}
[api] {"timestamp":"2026-01-21T16:19:19.679Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"eth","count":108,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:19:19.680Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"ethereum","durationMs":13928},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for Ethereum
[api] Saved 100 trending tokens for eth to database and memory cache
[api] [TokenJob] Saved 100 tokens for Ethereum to DB + cache
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/embeddings "HTTP/1.1 200 OK"
[python] [Model] Original: grok-4-non-reasoning -> Normalized: grok-4-1-fast-non-reasoning
[python] [RAG] 🔍 Informational query detected: '[CONTEXT]
[python] - Current Time: 2026-01-21T16:19:16.318Z...'
[python] [RAG] ⚠️ Error retrieving from KnowledgeBase: Collection expecting embedding with dimension of 384, got 1536
[python] INFO:     127.0.0.1:56353 - "POST /grok/v1/chat/completions HTTP/1.1" 200 OK
[api] [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
[api] {"timestamp":"2026-01-21T16:19:34.734Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"solana","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:19:34.734Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-21T16:19:35.752Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:19:41.526Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":122,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:19:41.526Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"solana","durationMs":6792},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 100 trending tokens for Solana
[api] [TokenJob] Filtered out 3 invalid tokens for Solana
[api] Saved 97 trending tokens for solana to database and memory cache
[api] [TokenJob] Saved 97 tokens for Solana to DB + cache
[api] {"timestamp":"2026-01-21T16:19:55.687Z","level":"WARN","code":"API-5002","message":"Snapchain Hub failed after retries, trying DB fallback","metadata":{"fid":421661},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:19:55.690Z","level":"INFO","code":"SYS-1007","message":"Using DB cached data for FID from Snapchain","metadata":{"fid":421661,"username":"primenode.eth"},"service":"kiko-api","env":"production"}
[api] [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
[api] {"timestamp":"2026-01-21T16:19:56.574Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"base","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:19:57.971Z","level":"INFO","code":"WTC-2002","message":"Found addresses via WebSocket","metadata":{"count":171,"chain":"base"},"service":"kiko-api","env":"production"}
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [TokenJob] Tokens for Ethereum are fresh, skipping API call
[api] [Job] ✅ Loaded 436 real hot users from /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Job] ✅ Using 436 real hot users from analysis
[api] [SocialJob] fetchCastsFromUsers starting with 436 FIDs, target: 500
[api] {"timestamp":"2026-01-21T16:20:01.822Z","level":"INFO","code":"API-5001","message":"Processed DexScreener trending candidates","metadata":{"candidates":37,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:20:05.181Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"traceId":"cc77a1be-f38d-4eba-8af0-bee76b63868a","symbol":"OmegaOracle","creator":"0x0a071274a471ffc6a2990d5a4038a7484c2fd6b3"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:20:05.551Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"traceId":"cc77a1be-f38d-4eba-8af0-bee76b63868a","symbol":"TIME","creator":"0x32f03bda7c401993706b963451df842388687243"},"service":"kiko-api","env":"production"}
[api] [PositionMonitor] 🔄 Running position check...
[api] {"timestamp":"2026-01-21T16:20:05.755Z","level":"INFO","code":"SYS-1001","message":"No open positions to monitor","metadata":{},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:20:05.919Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"traceId":"cc77a1be-f38d-4eba-8af0-bee76b63868a","symbol":"trinal_code","creator":"0x565211dd1e35b45183e7900f2b6fc4444ba19f2c"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:20:06.290Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"traceId":"cc77a1be-f38d-4eba-8af0-bee76b63868a","symbol":"Semiosis","creator":"0x09bb97f437d151c3ff2246795fd03a436225cf00"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:20:06.344Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/trending_pools"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:20:06.691Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"traceId":"cc77a1be-f38d-4eba-8af0-bee76b63868a","symbol":"boost","creator":"0xa7244665f8a5c4d1ecf572826a226abdee54d35b"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:20:07.202Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"traceId":"cc77a1be-f38d-4eba-8af0-bee76b63868a","symbol":"primum_mirum","creator":"0xec20b4ffc62c849abe1c43fc176242269c211ce4"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:20:07.766Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"traceId":"cc77a1be-f38d-4eba-8af0-bee76b63868a","symbol":"NeonGhost","creator":"0x04a2753b62737983a83df9668b626e960805f803"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:20:08.176Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"traceId":"cc77a1be-f38d-4eba-8af0-bee76b63868a","symbol":"EldritchInk","creator":"0xa83f9d4668583f55a7e20308f0bd8cc5529f4678"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:20:11.179Z","level":"INFO","code":"SYS-1007","message":"Alpha Detector: Checking new coin","metadata":{"traceId":"cc77a1be-f38d-4eba-8af0-bee76b63868a","symbol":"🇺🇸 PRESIDENT TRUMP JUST SAID H","creator":"0x26e4df834fdc71a653d9eea363da0281ba27a219"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x3: API-5004:External API requested retry","timestamp":"2026-01-21T16:20:11.930Z","metadata":{}}
[api] {"timestamp":"2026-01-21T16:20:11.931Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/trending_pools"},"service":"kiko-api","env":"production"}
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x2: API-5001:Skipping low liquidity token","timestamp":"2026-01-21T16:20:14.857Z","metadata":{}}
[api] {"timestamp":"2026-01-21T16:20:14.857Z","level":"INFO","code":"API-5001","message":"Skipping low liquidity token","metadata":{"symbol":"WETH","liquidity":344.2395},"service":"kiko-api","env":"production"}
[api] [TokenJob] Tokens for Solana are fresh, skipping API call
[api] {"timestamp":"2026-01-21T16:20:17.728Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:20:17.729Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_citations","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"citations","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_citations"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:20:17.732Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_citations","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"citations","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_citations"},"service":"kiko-api","env":"production"}
[python] INFO:moderation.router:Moderating output: **X (Twitter) 当前最热门话题（基于实时高互动帖子，过去24-48小时）**
[python] 
[python] | 排名...
[api] {"level":"INFO","code":"SYS-THROTTLE","message":"Repeated x4: API-5004:External API requested retry","timestamp":"2026-01-21T16:20:18.656Z","metadata":{}}
[api] {"timestamp":"2026-01-21T16:20:18.656Z","level":"INFO","code":"API-5004","message":"External API requested retry","metadata":{"status":429,"attempt":1,"delayMs":1000,"url":"https://api.geckoterminal.com/api/v2/networks/base/trending_pools"},"service":"kiko-api","env":"production"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] [Tool Turn] Tool call detected, continuing to turn 2
[python]   [1] ✓ Valid dict, URL: https://x.com/i/status/2013618277998588296..., Avatar: https://unavatar.io/twitter/I_amMukhtar...
[python]   [2] ✓ Valid dict, URL: https://x.com/i/status/2013586556804632738..., Avatar: https://unavatar.io/twitter/unusual_whales...
[python]   [3] ✓ Valid dict, URL: https://x.com/i/status/2013599973636554894..., Avatar: https://unavatar.io/twitter/erichustls...
[python]   [4] ✓ Valid dict, URL: https://x.com/i/status/1900563222190600613..., Avatar: https://unavatar.io/twitter/NewsWeeknd...
[python]   [5] ✓ Valid dict, URL: https://x.com/i/status/2012013672357601531..., Avatar: https://unavatar.io/twitter/itsnotoveryet33...
[python]   [6] ✓ Valid dict, URL: https://x.com/i/status/2013835867224154434..., Avatar: https://unavatar.io/twitter/EgsoncleCrypto...
[python]   [7] ✓ Valid dict, URL: https://x.com/i/status/2013929622719578125..., Avatar: https://unavatar.io/twitter/LNGSHOT4sho...
[python]   [8] ✓ Valid dict, URL: https://x.com/i/status/2013915195584782695..., Avatar: https://unavatar.io/twitter/JimFergusonUK...
[python]   [9] ✓ Valid dict, URL: https://x.com/i/status/2013689335921418363..., Avatar: https://unavatar.io/twitter/AveryDaye...
[python]   [10] ✓ Valid dict, URL: https://x.com/i/status/2013612063038259619..., Avatar: https://unavatar.io/twitter/XFreeze...
[python]   [11] ✓ Valid dict, URL: https://x.com/i/status/2012843085961839012..., Avatar: https://unavatar.io/twitter/Aranea569385122...
[python]   [12] ✓ Valid dict, URL: https://x.com/i/status/2013994784969339210..., Avatar: https://unavatar.io/twitter/nampingnapat...
[python]   [13] ✓ Valid dict, URL: https://x.com/i/status/2013968603880542437..., Avatar: https://unavatar.io/twitter/NCTsmtown...
[python]   [14] ✓ Valid dict, URL: https://x.com/i/status/2013907910879797578..., Avatar: https://unavatar.io/twitter/bostonwriter...
[python]   [15] ✓ Valid dict, URL: https://x.com/i/status/1895461341407629662..., Avatar: https://unavatar.io/twitter/bonchieredstate...
[python]   [16] ✓ Valid dict, URL: https://x.com/i/status/2013634186754642216..., Avatar: https://unavatar.io/twitter/jimmyfailla...
[python]   [17] ✓ Valid dict, URL: https://x.com/i/status/1940418720746402278..., Avatar: https://unavatar.io/twitter/4_Uu_0...
[python]   [18] ✓ Valid dict, URL: https://x.com/i/status/2013814658885656649..., Avatar: https://unavatar.io/twitter/spencerpratt...
[python]   [19] ✓ Valid dict, URL: https://x.com/i/status/1854227899995353303..., Avatar: https://unavatar.io/twitter/neontaster...
[python]   [20] ✓ Valid dict, URL: https://x.com/i/status/2013838971604767207..., Avatar: https://unavatar.io/twitter/pledis_17...
[python]   [21] ✓ Valid dict, URL: https://x.com/i/status/1956151769043497030..., Avatar: https://unavatar.io/twitter/AAnon55...
[python]   [22] ✓ Valid dict, URL: https://x.com/i/status/1918463897494835671..., Avatar: https://unavatar.io/twitter/warDaniel47...
[python]   [23] ✓ Valid dict, URL: https://x.com/i/status/2013673627099566570..., Avatar: https://unavatar.io/twitter/yourlovesupreme...
[python]   [24] ✓ Valid dict, URL: https://x.com/i/status/1992191881313149410..., Avatar: https://unavatar.io/twitter/animenews_news...
[python]   [25] ✓ Valid dict, URL: https://x.com/i/status/2013886616356729001..., Avatar: https://unavatar.io/twitter/NCTsmtown...
[python]   [26] ✓ Valid dict, URL: https://x.com/i/status/2013841545859080700..., Avatar: https://unavatar.io/twitter/RobSchneider...
[python]   [27] ✓ Valid dict, URL: https://x.com/i/status/2013871897465819540..., Avatar: https://unavatar.io/twitter/CrimeWatchMpls...
[python]   [28] ✓ Valid dict, URL: https://x.com/i/status/2011939203018309657..., Avatar: https://unavatar.io/twitter/yizeli19...
[python]   [29] ✓ Valid dict, URL: https://x.com/i/status/2013412600583794839..., Avatar: https://unavatar.io/twitter/ohanxiety...
[python]   [30] ✓ Valid dict, URL: https://x.com/i/status/2013857612471599611..., Avatar: https://unavatar.io/twitter/abazwhyllzz...
[python]   [31] ✓ Valid dict, URL: https://x.com/i/status/2013630844829569310..., Avatar: https://unavatar.io/twitter/neet_sol...
[python]   [32] ✓ Valid dict, URL: https://x.com/i/status/1107786497909030915..., Avatar: https://unavatar.io/twitter/PalmerReport...
[python]   [33] ✓ Valid dict, URL: https://x.com/i/status/2013598172355219485..., Avatar: https://unavatar.io/twitter/TrollFootball...
[python]   [34] ✓ Valid dict, URL: https://x.com/i/status/2013990001680216486..., Avatar: https://unavatar.io/twitter/ATEEZofficial...
[python]   [35] ✓ Valid dict, URL: https://x.com/i/status/2013449194271645708..., Avatar: https://unavatar.io/twitter/CynArts...
[python]   [36] ✓ Valid dict, URL: https://x.com/i/status/2013915109458931944..., Avatar: https://unavatar.io/twitter/josemamayoral...
[python]   [37] ✓ Valid dict, URL: https://x.com/i/status/2013989973393846531..., Avatar: https://unavatar.io/twitter/ATEEZofficial...
[python]   [38] ✓ Valid dict, URL: https://x.com/i/status/2012225689106481547..., Avatar: https://unavatar.io/twitter/ira_yaar...
[python]   [39] ✓ Valid dict, URL: https://x.com/i/status/2013521907241623817..., Avatar: https://unavatar.io/twitter/weareoneEXO...
[python] INFO:     127.0.0.1:57386 - "POST /moderation/output HTTP/1.1" 200 OK
[api] {"timestamp":"2026-01-21T16:20:19.405Z","level":"INFO","code":"SYS-1007","message":"Moderation Output check result","metadata":{"safe":true,"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Grok task cmko89zxb000odjq3fo6h85q3 completed, 731 chunks
[api] {"timestamp":"2026-01-21T16:20:19.418Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"durationMs":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:20:19.418Z","level":"INFO","code":"WS-8004","message":"Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete","metadata":{"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_complete","connectionCount":1,"durationMs":0,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_complete"},"service":"kiko-api","env":"production"}
[api] [ChatWorker] Task cmko89zxb000odjq3fo6h85q3 completed successfully
[api] {"level":30,"time":1769012419427,"pid":39905,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmko89zw3000gdjq3vadp13aa","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57399},"msg":"incoming request"}
[api] {"level":30,"time":1769012419429,"pid":39905,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","res":{"statusCode":204},"responseTime":1.7561250030994415,"msg":"request completed"}
[api] {"level":30,"time":1769012419432,"pid":39905,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","req":{"method":"GET","url":"/api/chat/sessions/cmko89zw3000gdjq3vadp13aa","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":57399},"msg":"incoming request"}
[api] {"level":30,"time":1769012419445,"pid":39905,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","res":{"statusCode":200},"responseTime":12.216499999165535,"msg":"request completed"}
[api] {"timestamp":"2026-01-21T16:20:24.855Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"base","count":72,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-21T16:20:24.855Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":100,"chain":"base","durationMs":28281},"service":"kiko-api","env":"production"}


[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [DEBUG] – "Restoring UI state for active task:" – "cmko89zxb000odjq3fo6h85q3" – "running" (logger.ts, line 61)
[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [DEBUG] – "Restoring UI state for active task:" – "cmko89zxb000odjq3fo6h85q3" – "running" (logger.ts, line 61)
[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [DEBUG] – "Restoring UI state for active task:" – "cmko89zxb000odjq3fo6h85q3" – "running" (logger.ts, line 61)
[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [DEBUG] – "Restoring UI state for active task:" – "cmko89zxb000odjq3fo6h85q3" – "running" (logger.ts, line 61)
[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [DEBUG] – "Restoring UI state for active task:" – "cmko89zxb000odjq3fo6h85q3" – "running" (logger.ts, line 61)
[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [DEBUG] – "Restoring UI state for active task:" – "cmko89zxb000odjq3fo6h85q3" – "running" (logger.ts, line 61)
[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [DEBUG] – "Restoring UI state for active task:" – "cmko89zxb000odjq3fo6h85q3" – "running" (logger.ts, line 61)
[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [DEBUG] – "Restoring UI state for active task:" – "cmko89zxb000odjq3fo6h85q3" – "running" (logger.ts, line 61)
[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [DEBUG] – "Restoring UI state for active task:" – "cmko89zxb000odjq3fo6h85q3" – "running" (logger.ts, line 61)
[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [DEBUG] – "Restoring UI state for active task:" – "cmko89zxb000odjq3fo6h85q3" – "running" (logger.ts, line 61)
[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [DEBUG] – "Restoring UI state for active task:" – "cmko89zxb000odjq3fo6h85q3" – "running" (logger.ts, line 61)
[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [DEBUG] – "Restoring UI state for active task:" – "cmko89zxb000odjq3fo6h85q3" – "running" (logger.ts, line 61)
[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [DEBUG] – "Restoring UI state for active task:" – "cmko89zxb000odjq3fo6h85q3" – "running" (logger.ts, line 61)
[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [DEBUG] – "Restoring UI state for active task:" – "cmko89zxb000odjq3fo6h85q3" – "running" (logger.ts, line 61)
[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [DEBUG] – "Restoring UI state for active task:" – "cmko89zxb000odjq3fo6h85q3" – "running" (logger.ts, line 61)
[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [DEBUG] – "Restoring UI state for active task:" – "cmko89zxb000odjq3fo6h85q3" – "running" (logger.ts, line 61)
[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [DEBUG] – "Restoring UI state for active task:" – "cmko89zxb000odjq3fo6h85q3" – "running" (logger.ts, line 61)
[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [DEBUG] – "Restoring UI state for active task:" – "cmko89zxb000odjq3fo6h85q3" – "running" (logger.ts, line 61)
[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [DEBUG] – "Restoring UI state for active task:" – "cmko89zxb000odjq3fo6h85q3" – "running" (logger.ts, line 61)
[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [DEBUG] – "Received usage event:" – Object (logger.ts, line 61)
Object
[Log] [DEBUG] – "Received citations event:" – Object (logger.ts, line 61)
Object
[Log] [DEBUG] – "Received citations event:" – Object (logger.ts, line 61)
Object
[Log] [DEBUG] – "Restoring UI state for active task:" – "cmko89zxb000odjq3fo6h85q3" – "running" (logger.ts, line 61)
[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [DEBUG] – "Restoring UI state for active task:" – "cmko89zxb000odjq3fo6h85q3" – "running" (logger.ts, line 61)
[Log] [DEBUG] – "Task is streaming (message status is streaming)" (logger.ts, line 61)
[Log] [App] Global WS: message_complete for session cmko89zw3000gdjq3vadp13aa (App.tsx, line 182, x2)
[Log] [ChatWS] Already connecting/connected to user WebSocket (chatWebSocket.ts, line 21)
> 所选元素
< <div class="_chatContainer_fddot_1 _dark_fddot_15">…</div>