Last login: Sun Jan  4 20:41:59 on ttys008
almurat@almuratdeMacBook-Pro ~ % cd /Users/almurat/KiKo/kiko-api && npm run dev

> kiko-api@1.0.0 dev
> concurrently -k -n api,python "tsx watch src/index.ts" "cd ../kiko-python && python3 main.py"

[api] [Prisma] Initializing client (Pool: 30, Timeout: 60s, Connect: 20s)
[api] [SocialJob] Found user list at: /Users/almurat/KiKo/test/Farcaste/real_hot_users.json
[api] [ToolRegistry] Registered tool: get_token_info
[api] [ToolRegistry] Registered tool: get_trending_tokens
[api] [ToolRegistry] Registered tool: web_search
[api] [ToolRegistry] Registered tool: prepare_swap_transaction
[api] [ToolRegistry] Registered tool: get_market_overview
[api] [ToolRegistry] Registered tool: get_wallet_info
[api] [ToolRegistry] Registered tool: get_gas_price
[api] [ToolRegistry] Registered tool: get_token_price
[api] [ToolRegistry] Registered tool: get_historical_price
[api] [ToolRegistry] Registered tool: check_token_risk
[api] [ToolRegistry] Registered tool: get_trending_casts
[api] [ToolRegistry] Registered tool: get_farcaster_user
[api] [ToolRegistry] Registered tool: search_farcaster_casts
[api] [ToolRegistry] Registered tool: get_user_favorites
[api] [ToolRegistry] Registered tool: create_copy_trade_config
[api] [ToolRegistry] Registered tool: list_copy_trade_configs
[api] [ToolRegistry] Registered tool: delete_copy_trade_config
[api] [ToolRegistry] Registered tool: pause_copy_trade_config
[api] [ToolRegistry] Registered tool: get_polymarket_trending
[api] [ToolRegistry] Registered tool: get_polymarket_event
[api] [ToolRegistry] Registered tool: search_polymarket
[api] [ToolRegistry] Registered tool: get_token_early_buyers
[api] Initializing services...
[api] Environment: development
[api] Port: 3001
[api] Database URL: configured
[api] Privy Server Auth: ✅ Configured
[api] Testing database connection...
[python] INFO:sentence_transformers.SentenceTransformer:Use pytorch device_name: mps
[python] INFO:sentence_transformers.SentenceTransformer:Load pretrained SentenceTransformer: all-MiniLM-L12-v2
[api] ✅ Database connection successful
[api] Initializing Redis...
[api] [Cache] Initializing PostgreSQL Cache adapter...
[api] [DBCache] Initializing PostgreSQL Cache...
[api] [DBCache] Cleaned 0 expired items.
[api] ✅ Redis initialized
[api] Starting background jobs...
[api] [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
[api] [TokenJob] Scheduled: Every 5min (Ethereum, Solana, Base, BSC, Arbitrum)
[api] [SocialJob] Scheduled: Every 10min
[api] ✅ Background jobs started
[api] Starting auto trade service...
[api] [AutoTrade] Initializing auto trade service...
[api] [Watcher] Starting wallet watcher service...
[api] [SolanaWatcher] Starting polling service...
[api] [AutoTrade] Auto trade service initialized (EVM + Solana)
[api] ✅ Auto trade service started
[api] Starting position monitor...
[api] [PositionMonitor] Starting position monitor (every 30s)...
[api] ✅ Position monitor started
[api] Starting chat worker...
[api] [ChatWorker] Started polling for AI tasks (interval: 3000ms)
[api] ✅ Chat worker started
[api] Starting news scheduler...
[api] [NewsScheduler] Initializing news generation schedule (0 0 * * * - Daily)...
[api] ✅ News scheduler started
[api] Starting server on port 3001...
[api] {"level":30,"time":1767531293168,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","msg":"Server listening at http://0.0.0.0:3001"}
[api] 🚀 Server listening on http://localhost:3001
[api] 📊 API endpoints available at http://localhost:3001/api
[api] 🏥 Health check: http://localhost:3001/health
[api] [Watcher] Pre-populating cache for 0 wallet(s)...
[api] [Watcher] Cache initialized with 0 transactions
[api] [Prisma] DB connection is healthy
[api] {"level":30,"time":1767531295037,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWp1YXBjazkwMTVkanUwY3AzcWl0OXptIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3Njc1Mjg4ODcsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc2NzUzMjQ4N30.Wi1x0mDdBDSmG9EtKd6dpUs0jK2C3JROReczHuz5KimrUFe5UFFuDRy1cXLXFKYtAQ_PCfoQSimzj-L8LQ9UGQ","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51377},"msg":"incoming request"}
[api] [ChatWS] Client connected for user did:privy:cmj0a3j3f005fl20c4xkl7195. Total connections for user: 1
[api] [SolanaWatcher] Loaded 0 checkpoint(s) from database
[api] [MarketJob] Running startup staleness check...
[api] [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
[api] [DexScreener Premium] Fetching trending tokens for chain: ethereum, limit: 100
[api] [DexScreener WS] Connecting to: wss://io.dexscreener.com/dex/screener/v5/pairs/m5/1?rankBy[key]=trendingScoreM5&rankBy[order]=desc&filters[chainIds][0]=ethereum
[api] [MarketJob] Overview is fresh, skipping API call
[api] [QualityUsersRepo] Returning 2000 cached FIDs
[api] [SocialJob] Trending casts are fresh, skipping Snapchain API call
[api] [MarketJob] Protocols are fresh, skipping API call
[api] [DexScreener WS] Connected to ethereum
[python] /Users/almurat/KiKo/kiko-python/rag/vectorstore.py:17: LangChainDeprecationWarning: The class `Chroma` was deprecated in LangChain 0.2.9 and will be removed in 1.0. An updated version of the class exists in the `langchain-chroma package and should be used instead. To use it run `pip install -U `langchain-chroma` and import as `from `langchain_chroma import Chroma``.
[python]   self.vectorstore = Chroma(
[api] [DexScreener WS] Received 199 unique addresses for ethereum in 1458ms
[api] [DexScreener Premium] Found 199 addresses via WebSocket for ethereum
[python] INFO:chromadb.telemetry.product.posthog:Anonymized telemetry enabled. See                     https://docs.trychroma.com/telemetry for more information.
[python] INFO:__main__:✅ Grok service mounted at /grok
[python] INFO:moderation.models:Using device: cpu
[python] INFO:moderation.models:Loading input model: distilbert-base-uncased-finetuned-sst-2-english
[api] [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
[api] [DexScreener Premium] Fetching trending tokens for chain: ethereum, limit: 100
[api] [DexScreener WS] Connecting to: wss://io.dexscreener.com/dex/screener/v5/pairs/m5/1?rankBy[key]=trendingScoreM5&rankBy[order]=desc&filters[chainIds][0]=ethereum
[api] [DexScreener WS] Connected to ethereum
[api] [DexScreener WS] Received 199 unique addresses for ethereum in 1386ms
[api] [DexScreener Premium] Found 199 addresses via WebSocket for ethereum
[python] Device set to use cpu
[python] INFO:moderation.models:Loading output model: gpt2
[api] [DexScreener Premium] Only 69 tokens from WebSocket, filling to 100...
[api] [DexScreener] Fetching trending tokens for chain: eth, duration: 6h
[api] {"level":30,"time":1767531302840,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-2","req":{"method":"GET","url":"/api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWp1YXBjazkwMTVkanUwY3AzcWl0OXptIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3Njc1Mjg4ODcsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21qMGEzajNmMDA1ZmwyMGM0eGtsNzE5NSIsImV4cCI6MTc2NzUzMjQ4N30.Wi1x0mDdBDSmG9EtKd6dpUs0jK2C3JROReczHuz5KimrUFe5UFFuDRy1cXLXFKYtAQ_PCfoQSimzj-L8LQ9UGQ","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51462},"msg":"incoming request"}
[api] [ChatWS] Client connected for user did:privy:cmj0a3j3f005fl20c4xkl7195. Total connections for user: 1
[api] {"level":30,"time":1767531302842,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","req":{"method":"OPTIONS","url":"/api/users/wallet-exports","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51464},"msg":"incoming request"}
[api] {"level":30,"time":1767531302844,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-3","res":{"statusCode":204},"responseTime":1.4723749980330467,"msg":"request completed"}
[api] {"level":30,"time":1767531302844,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","req":{"method":"GET","url":"/api/users/wallet-exports","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51464},"msg":"incoming request"}
[api] {"level":30,"time":1767531302850,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","req":{"method":"OPTIONS","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51465},"msg":"incoming request"}
[api] {"level":30,"time":1767531302853,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-5","res":{"statusCode":204},"responseTime":1.9291660003364086,"msg":"request completed"}
[api] {"level":30,"time":1767531302855,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","req":{"method":"GET","url":"/api/chat/sessions?limit=50&offset=0","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51465},"msg":"incoming request"}
[api] {"level":30,"time":1767531302861,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","req":{"method":"OPTIONS","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51467},"msg":"incoming request"}
[api] {"level":30,"time":1767531302862,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-7","res":{"statusCode":204},"responseTime":0.4263329990208149,"msg":"request completed"}
[api] {"level":30,"time":1767531302863,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51467},"msg":"incoming request"}
[api] [DexScreener Premium] Only 69 tokens from WebSocket, filling to 100...
[api] [DexScreener] Fetching trending tokens for chain: eth, duration: 6h
[api] [DexScreener] Processed 32 candidates, returning top 100
[api] [DexScreener Premium] Filled to 95 tokens with fallback
[api] [DexScreener Premium] ✓ Found 95 trending tokens for ethereum in 5315ms
[api] [TokenJob] Got 95 trending tokens for Ethereum
[api] Saved 95 trending tokens for eth to database and memory cache
[api] [CoinbaseCDP] Fetching EVM token balances for chain 8453 (base): https://api.cdp.coinbase.com/platform/v2/evm/token-balances/base/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [DexScreener] Processed 32 candidates, returning top 100
[api] [DexScreener Premium] Filled to 95 tokens with fallback
[api] [DexScreener Premium] ✓ Found 95 trending tokens for ethereum in 3728ms
[api] [TokenJob] Got 95 trending tokens for Ethereum
[api] Saved 95 trending tokens for eth to database and memory cache
[api] Saved 15 trending tokens to database via Prisma
[api] [MarketJob] Trending tokens refreshed: 15 tokens
[api] {"level":30,"time":1767531304822,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4","res":{"statusCode":200},"responseTime":1978.001791998744,"msg":"request completed"}
[api] [CoinbaseCDP] EVM token balances response for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E on chain 8453 (base): {
[api]   balancesCount: 20,
[api]   balances: [
[api]     { amount: [Object], token: [Object] },
[api]     { amount: [Object], token: [Object] },
[api]     { amount: [Object], token: [Object] },
[api]     { amount: [Object], token: [Object] },
[api]     { amount: [Object], token: [Object] }
[api]   ]
[api] }
[api] [CoinbaseCDP] Filtered EVM token balances: 20 out of 20
[api] [Wallets] Coinbase CDP returned 20 tokens for chain base
[api] {"level":30,"time":1767531304857,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-8","res":{"statusCode":200},"responseTime":1994.3337500020862,"msg":"request completed"}
[api] {"level":30,"time":1767531304859,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","req":{"method":"GET","url":"/api/wallets/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E/balance?chain=base","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51467},"msg":"incoming request"}
[api] [TokenJob] Saved 95 tokens for Ethereum to DB + cache
[api] Saved 15 trending tokens to database via Prisma
[api] [MarketJob] Trending tokens refreshed: 15 tokens
[api] [CoinbaseCDP] Fetching EVM token balances for chain 8453 (base): https://api.cdp.coinbase.com/platform/v2/evm/token-balances/base/0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[python] INFO:moderation.models:Moderation models initialized successfully
[python] INFO:__main__:✅ Moderation service mounted at /moderation
[python] WARNING:langchain_community.utils.user_agent:USER_AGENT environment variable not set, consider setting it to identify your requests.
[python] INFO:sentence_transformers.SentenceTransformer:Use pytorch device_name: mps
[python] INFO:sentence_transformers.SentenceTransformer:Load pretrained SentenceTransformer: all-MiniLM-L12-v2
[api] [CoinbaseCDP] EVM token balances response for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E on chain 8453 (base): {
[api]   balancesCount: 20,
[api]   balances: [
[api]     { amount: [Object], token: [Object] },
[api]     { amount: [Object], token: [Object] },
[api]     { amount: [Object], token: [Object] },
[api]     { amount: [Object], token: [Object] },
[api]     { amount: [Object], token: [Object] }
[api]   ]
[api] }
[api] [CoinbaseCDP] Filtered EVM token balances: 20 out of 20
[api] [Wallets] Coinbase CDP returned 20 tokens for chain base
[api] {"level":30,"time":1767531305735,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-9","res":{"statusCode":200},"responseTime":875.929915998131,"msg":"request completed"}
[api] {"level":30,"time":1767531306311,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-6","res":{"statusCode":200},"responseTime":3456.47108399868,"msg":"request completed"}
[api] [TokenJob] Saved 95 tokens for Ethereum to DB + cache
[api] {"level":30,"time":1767531309142,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","req":{"method":"OPTIONS","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51465},"msg":"incoming request"}
[api] {"level":30,"time":1767531309142,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-a","res":{"statusCode":204},"responseTime":0.6189590021967888,"msg":"request completed"}
[api] {"level":30,"time":1767531309143,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","req":{"method":"POST","url":"/api/chat/moderation/log","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51465},"msg":"incoming request"}
[api] {"level":30,"time":1767531309148,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","req":{"method":"OPTIONS","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51467},"msg":"incoming request"}
[api] [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmj0a3j3f005fl20c4xkl7195, content=Copy trade when 0x2c...
[api] {"level":30,"time":1767531309149,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-c","res":{"statusCode":204},"responseTime":0.7600830011069775,"msg":"request completed"}
[api] {"level":30,"time":1767531309151,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","req":{"method":"POST","url":"/api/chat/sessions","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51467},"msg":"incoming request"}
[api] {"level":30,"time":1767531309596,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-b","res":{"statusCode":200},"responseTime":452.84937500208616,"msg":"request completed"}
[api] {"level":30,"time":1767531309606,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-d","res":{"statusCode":200},"responseTime":455.23304199799895,"msg":"request completed"}
[api] {"level":30,"time":1767531309608,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmjzqi6oz000v11rzioq0zd46","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51467},"msg":"incoming request"}
[api] {"level":30,"time":1767531309609,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-e","res":{"statusCode":204},"responseTime":0.5740829966962337,"msg":"request completed"}
[api] {"level":30,"time":1767531309610,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","req":{"method":"GET","url":"/api/chat/sessions/cmjzqi6oz000v11rzioq0zd46","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51467},"msg":"incoming request"}
[api] [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
[api] [DexScreener Premium] Fetching trending tokens for chain: solana, limit: 100
[api] [DexScreener Premium] Using fallback discovery (Boosts + Organic search)
[api] {"level":30,"time":1767531310930,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-f","res":{"statusCode":200},"responseTime":1320.5660420022905,"msg":"request completed"}
[api] {"level":30,"time":1767531310937,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmjzqi6oz000v11rzioq0zd46/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51467},"msg":"incoming request"}
[api] {"level":30,"time":1767531310938,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-g","res":{"statusCode":204},"responseTime":0.6886250004172325,"msg":"request completed"}
[api] {"level":30,"time":1767531310940,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","req":{"method":"POST","url":"/api/chat/sessions/cmjzqi6oz000v11rzioq0zd46/messages","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":51467},"msg":"incoming request"}
[api] [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
[api] [DexScreener Premium] Fetching trending tokens for chain: solana, limit: 100
[api] [DexScreener Premium] Using fallback discovery (Boosts + Organic search)
[api] [DexScreener Premium] Only 57 tokens from WebSocket, filling to 100...
[api] [DexScreener] Fetching trending tokens for chain: solana, duration: 6h
[python] INFO:__main__:✅ RAG service mounted at /rag
[python] INFO:     Started server process [35723]
[python] INFO:     Waiting for application startup.
[python] INFO:     Application startup complete.
[python] INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
[api] {"level":30,"time":1767531314515,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-h","res":{"statusCode":200},"responseTime":3574.3309169970453,"msg":"request completed"}
[api] [DexScreener Premium] Only 57 tokens from WebSocket, filling to 100...
[api] [DexScreener] Fetching trending tokens for chain: solana, duration: 6h
[api] [ChatWorker] Running task cmjzqi9g2001111rz6rxnmeo4 for session cmjzqi6oz000v11rzioq0zd46
[python] INFO:moderation.router:Moderating input: Copy trade when 0x2cd32fb42748774fafde72d8607f16cc...
[python] DEBUG: Loading .env from /Users/almurat/KiKo/kiko-python/kiko-api/.env
[python] DEBUG: OPENAI_API_KEY present: False
[python] INFO:     127.0.0.1:51595 - "POST /moderation/moderate/input HTTP/1.1" 200 OK
[api] [ModerationClient] Logging input check to DB for userId=did:privy:cmj0a3j3f005fl20c4xkl7195
[api] [ModerationClient] Input check result: safe=true, action=allow
[api] [ChatWorker] Sent message_start for cmjzqi99u000z11rzh8gm2jqg
[api] [ToolPreRouter] Category matched: \b(swap|buy|sell|trade|exchange|convert|购买|卖出|兑换)\b
[api] [ToolPreRouter] Filtered tools: get_token_info, web_search, prepare_swap_transaction, get_wallet_info, check_token_risk
[api] [ChatWorker] Filtered to 5 tools for message: "Copy trade when 0x2cd32fb42748774fafde72d8607f16cc..."
[api] [ChatWorker] 🔍 RAG check for: "Copy trade when 0x2cd32fb42748774fafde72d8607f16cc..."
[api] [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
[api] [ChatWorker] DeepSeek iteration 1/10 for task cmjzqi9g2001111rz6rxnmeo4
[api] [DexScreener] Processed 121 candidates, returning top 100
[api] [DexScreener Premium] Filled to 100 tokens with fallback
[api] [DexScreener Premium] ✓ Found 100 trending tokens for solana in 6931ms
[api] [TokenJob] Got 100 trending tokens for Solana
[api] Saved 100 trending tokens for solana to database and memory cache
[api] [ChatWorker] DeepSeek model: deepseek-v3-thinking -> deepseek-reasoner
[api] [IntentParser] Using AI for detailed intent parsing
[api] [DexScreener] Processed 121 candidates, returning top 100
[api] [DexScreener Premium] Filled to 100 tokens with fallback
[api] [DexScreener Premium] ✓ Found 100 trending tokens for solana in 5550ms
[api] [TokenJob] Got 100 trending tokens for Solana
[api] Saved 100 trending tokens for solana to database and memory cache
[api] [TokenJob] Saved 100 tokens for Solana to DB + cache
[api] [TokenJob] Saved 100 tokens for Solana to DB + cache
[api] [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
[api] [DexScreener Premium] Fetching trending tokens for chain: base, limit: 100
[api] [DexScreener WS] Connecting to: wss://io.dexscreener.com/dex/screener/v5/pairs/m5/1?rankBy[key]=trendingScoreM5&rankBy[order]=desc&filters[chainIds][0]=base
[api] [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
[api] [DexScreener Premium] Fetching trending tokens for chain: base, limit: 100
[api] [DexScreener WS] Connecting to: wss://io.dexscreener.com/dex/screener/v5/pairs/m5/1?rankBy[key]=trendingScoreM5&rankBy[order]=desc&filters[chainIds][0]=base
[api] [DexScreener WS] Connected to base
[api] [DexScreener WS] Received 177 unique addresses for base in 1354ms
[api] [DexScreener Premium] Found 177 addresses via WebSocket for base
[api] [DexScreener WS] Connected to base
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: false,
[api]   swapMethod: 'swap_card',
[api]   toolConfig: [
[api]     'userRole',
[api]     'defaultSwapAmount',
[api]     'defaultSwapUnit',
[api]     'checkTokenBeforeSwap',
[api]     'quickSwapMode',
[api]     'swapMethod',
[api]     'slippageMode',
[api]     'customSlippage',
[api]     'mevProtection',
[api]     'priceDeviationCheck',
[api]     'copyTradeAIMode',
[api]     'fastSwapMode',
[api]     'id',
[api]     'userId',
[api]     'updatedAt'
[api]   ],
[api]   walletConnected: true,
[api]   chainId: 8453
[api] }
[api] [ChatWorker] Detected contract address: 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed
[api] [TokenDetector] Searching for token globally: 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed
[api] [DexScreener WS] Received 177 unique addresses for base in 1340ms
[api] [DexScreener Premium] Found 177 addresses via WebSocket for base
[api] [TokenDetector] No pairs found for 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed, checking launchpad...
[api] [LaunchpadDetector] Checking EVM launchpads for 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed...
[api] [DexScreener Premium] Only 58 tokens from WebSocket, filling to 100...
[api] [DexScreener] Fetching trending tokens for chain: base, duration: 6h
[api] [LaunchpadDetector] Paragraph fetch failed for 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed: { message: 'Request failed with status code 500', status: 500 }
[api] [LaunchpadDetector] Clanker API missed 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed, checking on-chain...
[api] [DexScreener Premium] Only 58 tokens from WebSocket, filling to 100...
[api] [DexScreener] Fetching trending tokens for chain: base, duration: 6h
[api] [DexScreener] Processed 42 candidates, returning top 100
[api] [DexScreener Premium] Filled to 77 tokens with fallback
[api] [DexScreener Premium] ✓ Found 77 trending tokens for base in 4928ms
[api] [TokenJob] Got 77 trending tokens for Base
[api] Saved 77 trending tokens for base to database and memory cache
[api] [DexScreener] Processed 42 candidates, returning top 100
[api] [DexScreener Premium] Filled to 77 tokens with fallback
[api] [DexScreener Premium] ✓ Found 77 trending tokens for base in 4311ms
[api] [TokenJob] Got 77 trending tokens for Base
[api] Saved 77 trending tokens for base to database and memory cache
[api] [TokenJob] Saved 77 tokens for Base to DB + cache
[api] [TokenJob] Saved 77 tokens for Base to DB + cache
[api] [LaunchpadDetector] Clanker check failed for 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed: HTTP request failed.
[api] 
[api] Status: 503
[api] URL: https://mainnet.base.org
[api] Request body: {"method":"eth_getLogs","params":[{"address":"0xE85A59c628F7d27878ACeB4bf3b35733630083a9","topics":[],"fromBlock":"earliest"}]}
[api] 
[api] Details: {"code":-32011,"message":"no backend is currently healthy to serve traffic"}
[api] Version: viem@2.43.3
[api] [LaunchpadDetector] ❌ No EVM launchpad found for 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed
[api] [getTokenDetails] GeckoTerminal API error: {
[api]   status: 404,
[api]   statusText: 'Not Found',
[api]   error: '{"errors":[{"status":"404","title":"Not Found"}],"meta":{"ref_id":"115652b6-a45d-4319-ba80-1e387b9d6ce8"}}',
[api]   url: 'https://api.geckoterminal.com/api/v2/networks/base/tokens/0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed/pools'
[api] }
[api] [DexScreener] Fetching token details: https://api.dexscreener.com/latest/dex/tokens/0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed
[api] [DexScreener] No pairs found for 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed
[api] [LaunchpadDetector] Checking EVM launchpads for 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed...
[api] [LaunchpadDetector] Paragraph fetch failed for 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed: { message: 'Request failed with status code 500', status: 500 }
[api] [LaunchpadDetector] Clanker API missed 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed, checking on-chain...
[api] [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
[api] [DexScreener Premium] Fetching trending tokens for chain: bsc, limit: 100
[api] [DexScreener WS] Connecting to: wss://io.dexscreener.com/dex/screener/v5/pairs/m5/1?rankBy[key]=trendingScoreM5&rankBy[order]=desc&filters[chainIds][0]=bsc
[api] [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
[api] [DexScreener Premium] Fetching trending tokens for chain: bsc, limit: 100
[api] [DexScreener WS] Connecting to: wss://io.dexscreener.com/dex/screener/v5/pairs/m5/1?rankBy[key]=trendingScoreM5&rankBy[order]=desc&filters[chainIds][0]=bsc
[api] [LaunchpadDetector] Clanker check failed for 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed: HTTP request failed.
[api] 
[api] Status: 503
[api] URL: https://mainnet.base.org
[api] Request body: {"method":"eth_getLogs","params":[{"address":"0xE85A59c628F7d27878ACeB4bf3b35733630083a9","topics":[],"fromBlock":"earliest"}]}
[api] 
[api] Details: {"code":-32011,"message":"no backend is currently healthy to serve traffic"}
[api] Version: viem@2.43.3
[api] [LaunchpadDetector] ❌ No EVM launchpad found for 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [ChatWorker] DeepSeek model: deepseek-v3-thinking -> deepseek-reasoner
[api] [DexScreener WS] Connected to bsc
[api] [DexScreener WS] Connected to bsc
[api] [DexScreener WS] Received 196 unique addresses for bsc in 1364ms
[api] [DexScreener Premium] Found 196 addresses via WebSocket for bsc
[api] [DexScreener WS] Received 195 unique addresses for bsc in 1325ms
[api] [DexScreener Premium] Found 195 addresses via WebSocket for bsc
[api] [DexScreener Premium] Only 69 tokens from WebSocket, filling to 100...
[api] [DexScreener] Fetching trending tokens for chain: bsc, duration: 6h
[api] [DexScreener Premium] Only 69 tokens from WebSocket, filling to 100...
[api] [DexScreener] Fetching trending tokens for chain: bsc, duration: 6h
[api] [DexScreener] Processed 36 candidates, returning top 100
[api] [DexScreener Premium] Filled to 78 tokens with fallback
[api] [DexScreener Premium] ✓ Found 78 trending tokens for bsc in 4665ms
[api] [TokenJob] Got 78 trending tokens for BSC
[api] Saved 78 trending tokens for bsc to database and memory cache
[api] [DexScreener] Processed 36 candidates, returning top 100
[api] [DexScreener Premium] Filled to 78 tokens with fallback
[api] [DexScreener Premium] ✓ Found 78 trending tokens for bsc in 4934ms
[api] [TokenJob] Got 78 trending tokens for BSC
[api] [TokenJob] Saved 78 tokens for BSC to DB + cache
[api] Saved 78 trending tokens for bsc to database and memory cache
[api] [TokenJob] Saved 78 tokens for BSC to DB + cache
[api] [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
[api] [DexScreener Premium] Fetching trending tokens for chain: arbitrum, limit: 100
[api] [DexScreener Premium] Using fallback discovery (Boosts + Organic search)
[api] [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
[api] [DexScreener Premium] Fetching trending tokens for chain: arbitrum, limit: 100
[api] [DexScreener Premium] Using fallback discovery (Boosts + Organic search)
[api] [DexScreener Premium] Only 1 tokens from WebSocket, filling to 100...
[api] [DexScreener] Fetching trending tokens for chain: arbitrum, duration: 6h
[api] [DexScreener Premium] Only 1 tokens from WebSocket, filling to 100...
[api] [DexScreener] Fetching trending tokens for chain: arbitrum, duration: 6h
[api] [DexScreener] Processed 7 candidates, returning top 100
[api] [DexScreener Premium] Filled to 5 tokens with fallback
[api] [DexScreener Premium] ✓ Found 5 trending tokens for arbitrum in 4448ms
[api] [TokenJob] DexScreener returned 5 tokens, trying GeckoTerminal fallback...
[api] [GeckoTerminal] Fetching TRENDING tokens for network: arbitrum, limit: 100, duration: 5m
[api] [GeckoTerminal] Requesting trending page 1 (5m): https://api.geckoterminal.com/api/v2/networks/arbitrum/trending_pools?page=1&include=base_token&duration=5m
[api] [DexScreener] Processed 7 candidates, returning top 100
[api] [DexScreener Premium] Filled to 5 tokens with fallback
[api] [DexScreener Premium] ✓ Found 5 trending tokens for arbitrum in 4109ms
[api] [TokenJob] DexScreener returned 5 tokens, trying GeckoTerminal fallback...
[api] [GeckoTerminal] Fetching TRENDING tokens for network: arbitrum, limit: 100, duration: 5m
[api] [GeckoTerminal] Requesting trending page 1 (5m): https://api.geckoterminal.com/api/v2/networks/arbitrum/trending_pools?page=1&include=base_token&duration=5m
[api] [GeckoTerminal] Page 1: Found 20 pools, 8 unique tokens so far
[api] [GeckoTerminal] Page 1: Found 20 pools, 8 unique tokens so far
[api] [GeckoTerminal] Requesting trending page 2 (5m): https://api.geckoterminal.com/api/v2/networks/arbitrum/trending_pools?page=2&include=base_token&duration=5m
[api] [GeckoTerminal] Requesting trending page 2 (5m): https://api.geckoterminal.com/api/v2/networks/arbitrum/trending_pools?page=2&include=base_token&duration=5m
[api] prisma:error Error in PostgreSQL connection: Error { kind: Closed, cause: None }
[api] [GeckoTerminal] Page 2: Found 20 pools, 16 unique tokens so far
[api] [GeckoTerminal] Page 2: Found 20 pools, 16 unique tokens so far
[api] [GeckoTerminal] Requesting trending page 3 (5m): https://api.geckoterminal.com/api/v2/networks/arbitrum/trending_pools?page=3&include=base_token&duration=5m
[api] [GeckoTerminal] Requesting trending page 3 (5m): https://api.geckoterminal.com/api/v2/networks/arbitrum/trending_pools?page=3&include=base_token&duration=5m
[api] [GeckoTerminal] Skipping USDC - low liquidity: $5915.14
[api] [GeckoTerminal] Page 3: Found 20 pools, 22 unique tokens so far
[api] [ChatWorker] Detected tool calls in stream, starting pre-fetch...
[api] [GeckoTerminal] Skipping USDC - low liquidity: $5915.14
[api] [GeckoTerminal] Page 3: Found 20 pools, 22 unique tokens so far
[api] [GeckoTerminal] Requesting trending page 4 (5m): https://api.geckoterminal.com/api/v2/networks/arbitrum/trending_pools?page=4&include=base_token&duration=5m
[api] [GeckoTerminal] Requesting trending page 4 (5m): https://api.geckoterminal.com/api/v2/networks/arbitrum/trending_pools?page=4&include=base_token&duration=5m
[api] [GeckoTerminal] Page 4: Found 20 pools, 27 unique tokens so far
[api] [GeckoTerminal] Page 4: Found 20 pools, 27 unique tokens so far
[api] prisma:error Error in PostgreSQL connection: Error { kind: Closed, cause: None }
[api] [GeckoTerminal] Requesting trending page 5 (5m): https://api.geckoterminal.com/api/v2/networks/arbitrum/trending_pools?page=5&include=base_token&duration=5m
[api] [GeckoTerminal] Requesting trending page 5 (5m): https://api.geckoterminal.com/api/v2/networks/arbitrum/trending_pools?page=5&include=base_token&duration=5m
[api] [GeckoTerminal] Skipping CARV - low liquidity: $5120.67
[api] [GeckoTerminal] Skipping ERN - low liquidity: $115.35
[api] [GeckoTerminal] Skipping USDT - low liquidity: $8238.72
[api] [GeckoTerminal] Skipping USDe - low liquidity: $4047.39
[api] [GeckoTerminal] Page 5: Found 20 pools, 35 unique tokens so far
[api] [GeckoTerminal] Extracted 35 trending tokens (filtered by liquidity >= $10000)
[api] [GeckoTerminal] Returning 35 tokens (requested: 100)
[api] [TokenJob] Using GeckoTerminal fallback: 35 tokens
[api] [TokenJob] Got 35 trending tokens for Arbitrum
[api] Saved 35 trending tokens for arbitrum to database and memory cache
[api] prisma:error Error in PostgreSQL connection: Error { kind: Closed, cause: None }
[api] prisma:error Error in PostgreSQL connection: Error { kind: Closed, cause: None }
[api] [GeckoTerminal] Skipping CARV - low liquidity: $5120.67
[api] [GeckoTerminal] Skipping ERN - low liquidity: $115.35
[api] [GeckoTerminal] Skipping USDT - low liquidity: $8238.72
[api] [GeckoTerminal] Skipping USDe - low liquidity: $4047.39
[api] [GeckoTerminal] Page 5: Found 20 pools, 35 unique tokens so far
[api] [GeckoTerminal] Extracted 35 trending tokens (filtered by liquidity >= $10000)
[api] [GeckoTerminal] Returning 35 tokens (requested: 100)
[api] [TokenJob] Using GeckoTerminal fallback: 35 tokens
[api] [TokenJob] Got 35 trending tokens for Arbitrum
[api] Saved 35 trending tokens for arbitrum to database and memory cache
[api] [TokenJob] Saved 35 tokens for Arbitrum to DB + cache
[api] [TokenJob] Refreshed 5 chains in 55.8s
[api] [GetWalletInfo] Attempting Alchemy...
[api] [Alchemy] API Key loaded: jNbkJ...
[api] [TokenJob] Saved 35 tokens for Arbitrum to DB + cache
[api] [TokenJob] Refreshed 5 chains in 54.1s
[api] [Alchemy] API Key loaded: jNbkJ...
[api] [Alchemy] API Key loaded: jNbkJ...
[api] [Alchemy] API Key loaded: jNbkJ...
[api] [Alchemy] API Key loaded: jNbkJ...
[api] [Alchemy] API Key loaded: jNbkJ...
[api] [Alchemy] API Key loaded: jNbkJ...
[api] [Alchemy] API Key loaded: jNbkJ...
[api] [Alchemy] API Key loaded: jNbkJ...
[api] [Alchemy] API Key loaded: jNbkJ...
[api] [Alchemy] API Key loaded: jNbkJ...
[api] [Alchemy] API Key loaded: jNbkJ...
[api] [Alchemy] API Key loaded: jNbkJ...
[api] [Alchemy] API Key loaded: jNbkJ...
[api] [Alchemy] API Key loaded: jNbkJ...
[api] [Alchemy] API Key loaded: jNbkJ...
[api] [Alchemy] API Key loaded: jNbkJ...
[api] [Alchemy] API Key loaded: jNbkJ...
[api] [Alchemy] API Key loaded: jNbkJ...
[api] [Alchemy] API Key loaded: jNbkJ...
[api] [Alchemy] API Key loaded: jNbkJ...
[api] [ChatWorker] DeepSeek iteration 2/10 for task cmjzqi9g2001111rz6rxnmeo4
[api] [ChatWorker] DeepSeek model: deepseek-v3-thinking -> deepseek-reasoner
[api] [IntentParser] Using AI for detailed intent parsing
[api] prisma:error Error in PostgreSQL connection: Error { kind: Closed, cause: None }
[api] prisma:error Error in PostgreSQL connection: Error { kind: Closed, cause: None }
[api] prisma:error 
[api] Invalid `prisma.aITask.findMany()` invocation in
[api] /Users/almurat/KiKo/kiko-api/src/repositories/chatRepository.ts:287:30
[api] 
[api]   284 // We'll stick to raw query for the queue fetch to ensure concurrency safety.
[api]   285 export async function getQueuedTasks(limit = 10): Promise<AITask[]> {
[api]   286     const tasks = await withRetry(async () => {
[api] → 287         return prisma.aITask.findMany(
[api] Server has closed the connection.
[api] [ChatRepo] DB connection error (P1017), retrying in 100ms... (3 attempts left)
[api] prisma:error Error in PostgreSQL connection: Error { kind: Closed, cause: None }
[api] [ChatWorker] User Settings: {
[api]   fastSwapMode: false,
[api]   swapMethod: 'swap_card',
[api]   toolConfig: [
[api]     'userRole',
[api]     'defaultSwapAmount',
[api]     'defaultSwapUnit',
[api]     'checkTokenBeforeSwap',
[api]     'quickSwapMode',
[api]     'swapMethod',
[api]     'slippageMode',
[api]     'customSlippage',
[api]     'mevProtection',
[api]     'priceDeviationCheck',
[api]     'copyTradeAIMode',
[api]     'fastSwapMode',
[api]     'id',
[api]     'userId',
[api]     'updatedAt'
[api]   ],
[api]   walletConnected: true,
[api]   chainId: 8453
[api] }
[api] [ChatWorker] Detected contract address: 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed
[api] [TokenDetector] Searching for token globally: 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed
[api] prisma:error 
[api] Invalid `prisma.trackedWallet.findMany()` invocation in
[api] /Users/almurat/KiKo/kiko-api/src/services/solanaWatcher.ts:52:52
[api] 
[api]   49 const connection = getSolanaConnection();
[api]   50 
[api]   51 // fetch active tracked wallets
[api] → 52 const wallets = await prisma.trackedWallet.findMany(
[api] Server has closed the connection.
[api] [SolanaWatcher] Error polling wallets: PrismaClientKnownRequestError: 
[api] Invalid `prisma.trackedWallet.findMany()` invocation in
[api] /Users/almurat/KiKo/kiko-api/src/services/solanaWatcher.ts:52:52
[api] 
[api]   49 const connection = getSolanaConnection();
[api]   50 
[api]   51 // fetch active tracked wallets
[api] → 52 const wallets = await prisma.trackedWallet.findMany(
[api] Server has closed the connection.
[api]     at $n.handleRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:7315)
[api]     at $n.handleAndLogRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6623)
[api]     at $n.request (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6307)
[api]     at async l (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:130:9633)
[api]     at async Timeout.pollWallets (/Users/almurat/KiKo/kiko-api/src/services/solanaWatcher.ts:52:25) {
[api]   code: 'P1017',
[api]   clientVersion: '5.22.0',
[api]   meta: { modelName: 'TrackedWallet' }
[api] }
[api] [TokenDetector] No pairs found for 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed, checking launchpad...
[api] [LaunchpadDetector] Checking EVM launchpads for 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed...
[api] [LaunchpadDetector] Paragraph fetch failed for 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed: { message: 'Request failed with status code 500', status: 500 }
[api] [LaunchpadDetector] Clanker API missed 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed, checking on-chain...
[api] [LaunchpadDetector] Clanker check failed for 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed: HTTP request failed.
[api] 
[api] Status: 503
[api] URL: https://mainnet.base.org
[api] Request body: {"method":"eth_getLogs","params":[{"address":"0xE85A59c628F7d27878ACeB4bf3b35733630083a9","topics":[],"fromBlock":"earliest"}]}
[api] 
[api] Details: {"code":-32011,"message":"no backend is currently healthy to serve traffic"}
[api] Version: viem@2.43.3
[api] [LaunchpadDetector] ❌ No EVM launchpad found for 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed
[api] [getTokenDetails] GeckoTerminal API error: {
[api]   status: 404,
[api]   statusText: 'Not Found',
[api]   error: '{"errors":[{"status":"404","title":"Not Found"}],"meta":{"ref_id":"115652b6-a45d-4319-ba80-1e387b9d6ce8"}}',
[api]   url: 'https://api.geckoterminal.com/api/v2/networks/base/tokens/0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed/pools'
[api] }
[api] [DexScreener] Fetching token details: https://api.dexscreener.com/latest/dex/tokens/0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed
[api] [DexScreener] No pairs found for 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed
[api] [LaunchpadDetector] Checking EVM launchpads for 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed...
[api] [LaunchpadDetector] Paragraph fetch failed for 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed: { message: 'Request failed with status code 500', status: 500 }
[api] [LaunchpadDetector] Clanker API missed 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed, checking on-chain...
[api] [LaunchpadDetector] Clanker check failed for 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed: HTTP request failed.
[api] 
[api] Status: 503
[api] URL: https://mainnet.base.org
[api] Request body: {"method":"eth_getLogs","params":[{"address":"0xE85A59c628F7d27878ACeB4bf3b35733630083a9","topics":[],"fromBlock":"earliest"}]}
[api] 
[api] Details: {"code":-32011,"message":"no backend is currently healthy to serve traffic"}
[api] Version: viem@2.43.3
[api] [LaunchpadDetector] ❌ No EVM launchpad found for 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed
[api] [ChatWorker] Enriched user prompt with context for 0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[api] [ChatWorker] DeepSeek model: deepseek-v3-thinking -> deepseek-reasoner
[python] INFO:moderation.router:Moderating output: I understand you want to set up copy trading for w...
[python] `loss_type=None` was set in the config but it is unrecognized. Using the default loss: `ForCausalLMLoss`.
[python] INFO:     127.0.0.1:52217 - "POST /moderation/moderate/output HTTP/1.1" 200 OK
[api] [ModerationClient] Logging output check to DB for userId=did:privy:cmj0a3j3f005fl20c4xkl7195
[api] [ModerationClient] Output check result: safe=false
[api] [ChatWorker] Task cmjzqi9g2001111rz6rxnmeo4 completed successfully
[api] {"level":30,"time":1767531394457,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","req":{"method":"OPTIONS","url":"/api/chat/sessions/cmjzqi6oz000v11rzioq0zd46","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52225},"msg":"incoming request"}
[api] {"level":30,"time":1767531394458,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","res":{"statusCode":204},"responseTime":0.6948750019073486,"msg":"request completed"}
[api] {"level":30,"time":1767531394459,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","req":{"method":"GET","url":"/api/chat/sessions/cmjzqi6oz000v11rzioq0zd46","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":52225},"msg":"incoming request"}
[api] {"level":30,"time":1767531395789,"pid":35724,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-j","res":{"statusCode":200},"responseTime":1329.6353330016136,"msg":"request completed"}

