Last login: Wed Feb  4 13:44:32 on ttys015
almurat@almuratdeMacBook-Pro ~ % cd /Users/almurat/KiKo/kiko-api && npm run dev

> kiko-api@1.0.0 dev
> concurrently -k -n api,python "tsx watch src/index.ts" "cd ../kiko-python && python3 main.py"

[python] INFO:__main__:✅ Grok service mounted at /grok
[python] INFO:moderation.models:✅ OpenAI Moderation API initialized (lightweight mode)
[python] INFO:__main__:✅ Moderation service mounted at /moderation
[api] [Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
[api] [2026-02-04T12:03:03.010Z] [INFO] [SYS-1001] Zora SDK initialized with API Key
[api] [SocialJob] Found user list at: /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
[api] [SkillRegistry:exec] Loading skills from /Users/almurat/KiKo/kiko-api/src/skills...
[api] [SkillRegistry:exec] Loaded skill: copy_trade
[api] [SkillRegistry:exec] Loaded skill: market_macro
[api] [SkillRegistry:exec] Loaded skill: polymarket_prediction
[api] [SkillRegistry:exec] Loaded skill: risk_security
[api] [SkillRegistry:exec] Loaded skill: social_farcaster
[api] [SkillRegistry:exec] Loaded skill: swap
[api] [SkillRegistry:exec] Loaded skill: token_alert
[api] [SkillRegistry:exec] Loaded skill: token_analysis
[api] [SkillRegistry:exec] Loaded skill: wallet_portfolio
[api] [SkillRegistry:exec] Loaded skill: welcome_onboarding
[api] [SkillRegistry:exec] Loaded skill: zora_nfts
[api] [SkillRegistry:clean] Loading skills from /Users/almurat/KiKo/kiko-api/src/skills...
[api] [SkillRegistry:clean] Loaded skill: copy_trade
[api] [SkillRegistry:clean] Loaded skill: market_macro
[api] [SkillRegistry:clean] Loaded skill: polymarket_prediction
[api] [SkillRegistry:clean] Loaded skill: risk_security
[api] [SkillRegistry:clean] Loaded skill: social_farcaster
[api] [SkillRegistry:clean] Loaded skill: swap
[api] [SkillRegistry:clean] Loaded skill: token_alert
[api] [SkillRegistry:clean] Loaded skill: token_analysis
[api] [SkillRegistry:clean] Loaded skill: wallet_portfolio
[api] [SkillRegistry:clean] Loaded skill: welcome_onboarding
[api] [SkillRegistry:clean] Loaded skill: zora_nfts
[api] [2026-02-04T12:03:03.517Z] [WARN] [SYS-1001] Public folder not found - skipping static file serving | DATA: {"path":"/Users/almurat/KiKo/kiko-api/public"}
[api] [2026-02-04T12:03:03.518Z] [INFO] [SYS-1001] Initializing services... | DATA: {"env":"development","port":3001,"database":"configured","privy":"✅ Configured"}
[api] [Prisma] DB connection is healthy
[api] [2026-02-04T12:03:03.565Z] [INFO] [SYS-1004] Database connection successful
[api] [DataRetention] Checking retention policies...
[api] [DataRetention] Starting cleanup job...
[api] [2026-02-04T12:03:03.569Z] [INFO] [SYS-1005] Redis initialized
[api] [2026-02-04T12:03:03.569Z] [INFO] [SYS-1001] Starting server on port 3001...
[api] {"level":30,"time":1770206583594,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","msg":"Server listening at http://0.0.0.0:3001"}
[api] [2026-02-04T12:03:03.595Z] [INFO] [SYS-1001] Server listening | DATA: {"url":"http://localhost:3001","health":"http://localhost:3001/health"}
[api] [2026-02-04T12:03:03.595Z] [INFO] [SYS-1001] RPC health monitor started
[api] [2026-02-04T12:03:03.597Z] [INFO] [SYS-1001] RPC benchmark sampling started
[api] [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
[api] [TokenJob] Scheduled: Primary chains every 5min (Ethereum, Solana, Base, BSC)
[api] [TokenJob] Scheduled: Secondary chains every 4h (Arbitrum, Optimism, Polygon)
[api] [SocialJob] Scheduled: Discovery (30m), Refresh (4h), Scoring (5m)
[api] [2026-02-04T12:03:03.610Z] [INFO] [SYS-1001] Background jobs started
[api] [2026-02-04T12:03:03.610Z] [INFO] [SYS-1001] Initializing auto trade service...
[api] [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
[api] [2026-02-04T12:03:03.610Z] [INFO] [SYS-1001] Auto trade service initialized (Solana watcher + EVM webhook enabled) | DATA: {"mode":"hybrid"}
[api] [2026-02-04T12:03:03.610Z] [INFO] [SYS-1001] Auto trade service started
[api] [PositionMonitor] Starting position monitor (every 30s)...
[api] [2026-02-04T12:03:03.610Z] [INFO] [SYS-1001] Position monitor started
[api] [2026-02-04T12:03:03.610Z] [INFO] [SYS-1001] Token Alert Service started
[api] [2026-02-04T12:03:03.611Z] [INFO] [SYS-1001] Token alert service started
[api] [ChatWorker] Started polling for AI tasks (interval: 3000ms)
[api] [2026-02-04T12:03:03.611Z] [INFO] [SYS-1001] Chat worker started
[api] [2026-02-04T12:03:03.611Z] [INFO] [SYS-1001] Starting Global Zora Alpha Detector (API Polling) | DATA: {"thresholds":{"farcaster":50000,"twitter":500000,"instagram":500000,"tiktok":500000},"interval":60000}
[api] [2026-02-04T12:03:03.611Z] [INFO] [SYS-1001] 🎉 All services initialized!
[api] [DataRetention] Cleanup job completed.
[api] {"level":30,"time":1770206585439,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWt0Zm5oa3gwMGNka3kwYzN0M2xtMzZpIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzAyMDUwMjUsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc3MDIwODYyNX0.ryfklQ0WG71ywzks2RQKg-gL5LzgskECwb7J5-djS-KSGkneHN-5JX2_UNZxHn1oP-OJkbR4hMhlTof_2imw8w","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54530},"msg":"incoming request"}
[python] INFO:chromadb.telemetry.product.posthog:Anonymized telemetry enabled. See                     https://docs.trychroma.com/telemetry for more information.
[python] INFO:__main__:✅ RAG service mounted at /rag
[python] INFO:     Started server process [60651]
[python] INFO:     Waiting for application startup.
[python] INFO:     Application startup complete.
[python] INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
[api] [2026-02-04T12:03:06.447Z] [INFO] [WS-8001][TID:e8fd2230-e0fb-428e-8d1d-706f67f45214] ChatWS Client connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","totalConnections":1}
[api] [2026-02-04T12:03:06.448Z] [INFO] [WS-8001][TID:e8fd2230-e0fb-428e-8d1d-706f67f45214] ChatWS: User connected | DATA: {"userId":"did:privy:cmj0a3j3f005fl2...","tokenExp":1770208625}
[api] {"level":30,"time":1770206588441,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54554},"msg":"incoming request"}
[api] {"level":30,"time":1770206588445,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","res":{"statusCode":204},"responseTime":3.5198749974370003,"msg":"request completed"}
[api] {"level":30,"time":1770206588446,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","req":{"method":"OPTIONS","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54555},"msg":"incoming request"}
[api] {"level":30,"time":1770206588447,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","res":{"statusCode":204},"responseTime":0.39750000089406967,"msg":"request completed"}
[api] {"level":30,"time":1770206588447,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54554},"msg":"incoming request"}
[api] {"level":30,"time":1770206588451,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54556},"msg":"incoming request"}
[api] {"level":30,"time":1770206588451,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","res":{"statusCode":204},"responseTime":0.3644159995019436,"msg":"request completed"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=Swap 0.1 USDC to ETH...
[api] {"level":30,"time":1770206588454,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","req":{"method":"POST","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54555},"msg":"incoming request"}
[api] {"level":30,"time":1770206588456,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54556},"msg":"incoming request"}
[api] {"level":30,"time":1770206588459,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","res":{"statusCode":200},"responseTime":12.13375000283122,"msg":"request completed"}
[api] [verifyAccess] Checking access: {
[api]   userId: 'did:privy:cmj0a3j3f005fl20c4xkl7195',
[api]   userIdLength: 35,
[api]   userIdPrefix: 'did:privy:cmj0a3j3f0',
[api]   requestedAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
[api] }
[api] {"level":30,"time":1770206588464,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","res":{"statusCode":200},"responseTime":9.575791999697685,"msg":"request completed"}
[api] [verifyAccess] ✅ Access granted
[api] {"level":30,"time":1770206588470,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml7zapez0002s3equlrozj00","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54554},"msg":"incoming request"}
[api] {"level":30,"time":1770206588470,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","res":{"statusCode":204},"responseTime":0.20291699841618538,"msg":"request completed"}
[api] {"level":30,"time":1770206588472,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","req":{"method":"GET","url":"/api/chat/sessions/cml7zapez0002s3equlrozj00","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54555},"msg":"incoming request"}
[api] {"level":30,"time":1770206588481,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","res":{"statusCode":200},"responseTime":8.664333000779152,"msg":"request completed"}
[api] {"level":30,"time":1770206588485,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","req":{"method":"OPTIONS","url":"/api/chat/sessions/cml7zapez0002s3equlrozj00/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54554},"msg":"incoming request"}
[api] {"level":30,"time":1770206588486,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","res":{"statusCode":204},"responseTime":0.5607089996337891,"msg":"request completed"}
[api] {"level":30,"time":1770206588487,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","req":{"method":"POST","url":"/api/chat/sessions/cml7zapez0002s3equlrozj00/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54555},"msg":"incoming request"}
[api] [MarketJob] Running startup staleness check...
[api] [PositionMonitor] 🔄 Running position check...
[api] [MarketJob] Overview is fresh, skipping API call
[api] [MarketJob] Protocols are fresh, skipping API call
[api] [MarketJob] Trending tokens are fresh, skipping API call
[api] [Job] ✅ Loaded 436 real hot users from /Users/almurat/KiKo/kiko-api/data/real_hot_users.json
[api] [Job] ✅ Using 436 real hot users from analysis
[api] [SocialJob] fetchCastsFromUsers starting with 436 FIDs, target: 1000
[api] [2026-02-04T12:03:08.633Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-04T12:03:10.926Z] [ERROR] [API-5002][TID:0a6c23ba-0e5e-4b36-9565-ba644816173c] Alchemy Portfolio EVM API error | DATA: {}
[api] [2026-02-04T12:03:10.940Z] [ERROR] [API-5002][TID:82e5e1db-d844-4b5b-8d3d-0f3e3846658f] Alchemy Portfolio EVM API error | DATA: {}
[api] [2026-02-04T12:03:12.079Z] [INFO] [API-5001][TID:82e5e1db-d844-4b5b-8d3d-0f3e3846658f] Fallback stablecoin balances fetched via RPC | DATA: {"chain":"base","address":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","tokenCount":2}
[api] {"level":30,"time":1770206592089,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","res":{"statusCode":200},"responseTime":3601.7239169999957,"msg":"request completed"}
[api] {"level":30,"time":1770206592112,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54554},"msg":"incoming request"}
[api] [2026-02-04T12:03:12.234Z] [INFO] [API-5001][TID:0a6c23ba-0e5e-4b36-9565-ba644816173c] Fallback stablecoin balances fetched via RPC | DATA: {"chain":"base","address":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","tokenCount":2}
[api] {"level":30,"time":1770206592236,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","res":{"statusCode":200},"responseTime":3779.525708001107,"msg":"request completed"}
[api] {"level":30,"time":1770206592240,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54555},"msg":"incoming request"}
[api] {"level":30,"time":1770206592242,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","res":{"statusCode":204},"responseTime":0.7770420014858246,"msg":"request completed"}
[api] {"level":30,"time":1770206592243,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54556},"msg":"incoming request"}
[api] [2026-02-04T12:03:12.651Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-04T12:03:12.651Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-04T12:03:12.651Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[python] INFO:moderation.router:Moderating input: Swap 0.1 USDC to ETH...
[api] [2026-02-04T12:03:12.858Z] [ERROR] [API-5002][TID:6624bcd9-0352-4161-bcb5-16b76b70c8fd] Alchemy Portfolio EVM API error | DATA: {}
[api] [2026-02-04T12:03:12.858Z] [INFO] [API-5001][TID:6624bcd9-0352-4161-bcb5-16b76b70c8fd] Fallback stablecoin balances fetched via RPC | DATA: {"chain":"base","address":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","tokenCount":2}
[api] {"level":30,"time":1770206592859,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","res":{"statusCode":200},"responseTime":746.8682080022991,"msg":"request completed"}
[api] [2026-02-04T12:03:12.862Z] [ERROR] [API-5002][TID:6a0a0663-7ab1-45ea-90ae-5b06d4c94941] Alchemy Portfolio EVM API error | DATA: {}
[api] [2026-02-04T12:03:12.862Z] [INFO] [API-5001][TID:6a0a0663-7ab1-45ea-90ae-5b06d4c94941] Fallback stablecoin balances fetched via RPC | DATA: {"chain":"base","address":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","tokenCount":2}
[api] {"level":30,"time":1770206592863,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","res":{"statusCode":200},"responseTime":619.4930830001831,"msg":"request completed"}
[api] {"level":30,"time":1770206592864,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":54555},"msg":"incoming request"}
[api] [2026-02-04T12:03:13.516Z] [ERROR] [API-5002][TID:225551cc-4ee9-47ae-8ced-9aefcd46800e] Alchemy Portfolio EVM API error | DATA: {}
[api] [2026-02-04T12:03:13.517Z] [INFO] [API-5001][TID:225551cc-4ee9-47ae-8ced-9aefcd46800e] Fallback stablecoin balances fetched via RPC | DATA: {"chain":"base","address":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","tokenCount":2}
[api] {"level":30,"time":1770206593517,"pid":60652,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","res":{"statusCode":200},"responseTime":653.5726669989526,"msg":"request completed"}
[python] INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
[python] DEBUG: Loading .env from /Users/almurat/KiKo/kiko-python/kiko-api/.env
[python] DEBUG: OPENAI_API_KEY present: True
[python] INFO:     127.0.0.1:54622 - "POST /moderation/input HTTP/1.1" 200 OK
[api] [2026-02-04T12:03:13.762Z] [INFO] [SYS-1007] Moderation Input check result | DATA: {"safe":true,"action":"allow","userId":"did:privy:cmj0a3j3f005fl20c4xkl7195"}
[api] [2026-02-04T12:03:13.766Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"message_start","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_message_start"}
[api] [ChatWorker] Sent message_start for cml7zapig0008s3eqc8ynewwc
[api] [2026-02-04T12:03:13.767Z] [INFO] [AI-6007] ChatWorker: seeded get_wallet_info from client context | DATA: {"chainId":8453,"tokenCount":7,"hasNativeBalance":true}
[api] [2026-02-04T12:03:13.768Z] [INFO] [SYS-1007] ToolPreRouter: Category matched | DATA: {"category":"\\b(swap|buy|sell|trade|exchange|convert|购买|卖出|兑换)\\b","tools":["get_token_info","external_web_search","prepare_swap_transaction","get_wallet_info","check_token_risk","create_copy_trade_config"]}
[api] [ChatWorker] Base filtered to 6 tools for message: "Swap 0.1 USDC to ETH..."
[api] [ChatWorker] 🔍 RAG check for: "Swap 0.1 USDC to ETH..."
[api] [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cml7zas7k000as3equcu1zkfb
[api] [2026-02-04T12:03:13.769Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
[api] [2026-02-04T12:03:13.772Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-04T12:03:13.778Z] [INFO] [AI-6001][6ms] Timer finished: intent_parsing_203b9cb5 | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.44999999999999996},{"label":"SOCIAL_SENSING","confidence":0.1264911064067352}],"timerLabel":"intent_parsing_203b9cb5"}
[api] [2026-02-04T12:03:13.782Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-04T12:03:13.782Z] [INFO] [AI-6009] DeepSeek: routed to mode | DATA: {"taskId":"cml7zas7k000as3equcu1zkfb","sessionId":"cml7zapez0002s3equlrozj00","model":"deepseek-v3-fast","intent":"TRADING","routingMode":"execution","hardRule":{"label":"TRADING","reason":"action + slots complete"},"confidence":0.95}
[api] [ChatWorker] Skill-gated to 5 tools for intent=TRADING skills=swap, token_alert, wallet_portfolio
[api] [2026-02-04T12:03:13.782Z] [INFO] [AI-6010] DeepSeek: skills attached | DATA: {"taskId":"cml7zas7k000as3equcu1zkfb","sessionId":"cml7zapez0002s3equlrozj00","model":"deepseek-v3-fast","intent":"TRADING","routingMode":"execution","skillVersion":"exec","skills":["swap","token_alert","wallet_portfolio"],"toolCount":5}
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
[api]   chainId: 8453
[api] }
[api] [ChatWorker] 🚀 Fast Swap Decision: {
[api]   fastSwapModeEnabled: false,
[api]   willFastSwap: false,
[api]   reason: 'Normal LLM flow (AI will call tools)'
[api] }
[api] [ChatWorker] Waiting for early pre-fetch to complete
[api] [2026-02-04T12:03:13.784Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":3,"skills":["swap","token_alert","wallet_portfolio"]}
[api] [2026-02-04T12:03:13.784Z] [INFO] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":13821,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (7 tokens cached)
[api] [2026-02-04T12:03:13.784Z] [INFO] [AI-6007] ChatWorker: requested token balance resolved | DATA: {"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":8453,"requested":["USDC","ETH"],"matched":["USDC","ETH"],"missing":[],"resolvedBalances":{"USDC":"0","ETH":"0.00044870299058801"}}
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-04T12:03:13.785Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-04T12:03:13.785Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1170}
[api] [2026-02-04T12:03:13.785Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":7,"sample":[{"symbol":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","balance":"0"},{"symbol":"USDC","balance":"0"},{"symbol":"0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca","balance":"0"},{"symbol":"USDbC","balance":"0"},{"symbol":"0x4200000000000000000000000000000000000006","balance":"0"}],"spotlight":[{"symbol":"USDC","balance":"0"},{"symbol":"ETH","balance":"0.00044870299058801"}]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-02-04T12:03:13.785Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":179}
[api] [2026-02-04T12:03:13.785Z] [INFO] [AI-6007] ChatWorker: balance system rule injected
[api] [2026-02-04T12:03:13.785Z] [INFO] [AI-6007] ChatWorker: removed get_wallet_info tool (balance context present) | DATA: {"before":5,"after":4}
[api] [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
[api] [ChatWorker] Broadcasting Thinking status for cml7zapig0008s3eqc8ynewwc. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-04T12:03:13.786Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-04T12:03:18.644Z] [INFO] [SYS-1001] No open positions to monitor
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [2026-02-04T12:03:20.783Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[api] [2026-02-04T12:03:20.791Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-04T12:03:21.842Z] [INFO] [AI-6005][1046ms] Timer finished: launchpad_det_0x833589fcd6edb6e08f4c7c32d4f71b54bda02913 | DATA: {"address":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","chainId":8453,"found":false,"timerLabel":"launchpad_det_0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"}
[api] [GetTokenInfo] Attempting DexScreener fallback...
[api] [ChatWorker] DeepSeek iteration 2/10 for task cml7zas7k000as3equcu1zkfb
[api] [2026-02-04T12:03:24.257Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
[api] [2026-02-04T12:03:24.258Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [2026-02-04T12:03:24.259Z] [INFO] [AI-6001][1ms] Timer finished: intent_parsing_d7cbe22e | DATA: {"userAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","intent":"swap","highLevelIntent":"TRADING","hasAI":false,"confidence":0.95,"routingStage":"rule","hardRule":"TRADING","slotsComplete":true,"labels":[{"label":"TRADING","confidence":0.95},{"label":"MARKET_ANALYSIS","confidence":0.44999999999999996},{"label":"SOCIAL_SENSING","confidence":0.1264911064067352}],"timerLabel":"intent_parsing_d7cbe22e"}
[api] [2026-02-04T12:03:24.259Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
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
[api]   chainId: 8453
[api] }
[api] [ChatWorker] 🚀 Fast Swap Decision: {
[api]   fastSwapModeEnabled: false,
[api]   willFastSwap: false,
[api]   reason: 'Normal LLM flow (AI will call tools)'
[api] }
[api] [2026-02-04T12:03:24.259Z] [INFO] [AI-6006] PromptOrchestrator: Intent matched skills | DATA: {"intent":"TRADING","count":3,"skills":["swap","token_alert","wallet_portfolio"]}
[api] [2026-02-04T12:03:24.259Z] [INFO] [AI-6003] Timer finished: prompt_gen_TRADING_deepseek | DATA: {"model":"deepseek","intent":"TRADING","length":13821,"timerLabel":"prompt_gen_TRADING_deepseek"}
[api] [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (7 tokens cached)
[api] [2026-02-04T12:03:24.259Z] [INFO] [AI-6007] ChatWorker: requested token balance resolved | DATA: {"walletAddress":"0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E","chainId":8453,"requested":["USDC","ETH"],"matched":["USDC","ETH"],"missing":[],"resolvedBalances":{"USDC":"0","ETH":"0.00044870299058801"}}
[api] [ChatWorker] No tokenInfo available
[api] [2026-02-04T12:03:24.260Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [2026-02-04T12:03:24.260Z] [INFO] [AI-6007] ChatWorker: client context injected | DATA: {"hasBalance":true,"hasNativeBalance":true,"hasPageContext":false,"hasToolConfig":true,"contextBytes":1170}
[api] [2026-02-04T12:03:24.260Z] [INFO] [AI-6007] ChatWorker: client balance snapshot summary | DATA: {"tokenCount":7,"sample":[{"symbol":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","balance":"0"},{"symbol":"USDC","balance":"0"},{"symbol":"0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca","balance":"0"},{"symbol":"USDbC","balance":"0"},{"symbol":"0x4200000000000000000000000000000000000006","balance":"0"}],"spotlight":[{"symbol":"USDC","balance":"0"},{"symbol":"ETH","balance":"0.00044870299058801"}]}
[api] [ChatWorker] Added client context to system prompt
[api] [2026-02-04T12:03:24.260Z] [INFO] [AI-6007] ChatWorker: balance context attached to system prompt | DATA: {"bytes":179}
[api] [2026-02-04T12:03:24.260Z] [INFO] [AI-6007] ChatWorker: balance system rule injected
[api] [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
[api] [ChatWorker] Broadcasting Thinking status for cml7zapig0008s3eqc8ynewwc. Message order: message_start → launchpad_card → Thinking → content_chunks
[api] [2026-02-04T12:03:24.260Z] [INFO] [WS-8004] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"task_status","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_task_status"}
[api] [PositionMonitor] 🔄 Running position check...
[api] [2026-02-04T12:03:28.651Z] [INFO] [SYS-1001] No open positions to monitor
[api] [2026-02-04T12:03:31.139Z] [INFO] [WS-8004][1ms] Timer finished: ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage | DATA: {"userId":"did:privy:cmj0a3j3f005fl20c4xkl7195","eventType":"usage","connectionCount":1,"timerLabel":"ws_broadcast_did:privy:cmj0a3j3f005fl20c4xkl7195_usage"}
[python] INFO:moderation.router:Moderating output: 我看到您想用0.1 USDC兑换ETH。不过根据您的钱包数据显示，您的USDC余额为0，无法进行这笔...
[