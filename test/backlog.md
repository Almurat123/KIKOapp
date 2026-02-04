2026-02-04T13:51:33.000000000Z [inf]  Starting Container
2026-02-04T13:51:34.275934973Z [inf]  
2026-02-04T13:51:34.275946477Z [inf]  > kiko-api@1.0.0 start
2026-02-04T13:51:34.275954654Z [inf]  > node dist/index.js
2026-02-04T13:51:34.275961453Z [inf]  
2026-02-04T13:51:39.149694323Z [inf]  [Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
2026-02-04T13:51:39.149700041Z [inf]  Zora SDK initialized with API Key
2026-02-04T13:51:39.593091256Z [err]  [SocialJob] Could not find real_hot_users.json in any candidate path
2026-02-04T13:51:40.233433705Z [inf]  [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
2026-02-04T13:51:41.258861976Z [inf]  [SkillRegistry:exec] Loading skills from /app/dist/skills...
2026-02-04T13:51:41.258868385Z [inf]  [SkillRegistry:clean] Loading skills from /app/dist/skills...
2026-02-04T13:51:41.258872711Z [inf]  Serving static files from:
2026-02-04T13:51:41.258877687Z [inf]  Initializing services...
2026-02-04T13:51:41.258883210Z [inf]  [Prisma] DB connection is healthy
2026-02-04T13:51:41.258887725Z [inf]  Database connection successful
2026-02-04T13:51:41.258893096Z [inf]  [DataRetention] Checking retention policies...
2026-02-04T13:51:41.258897688Z [inf]  [DataRetention] Starting cleanup job...
2026-02-04T13:51:41.258902384Z [inf]  Redis initialized
2026-02-04T13:51:41.258906528Z [inf]  Starting server on port 8080...
2026-02-04T13:51:41.478999175Z [inf]  Server listening at http://0.0.0.0:8080
2026-02-04T13:51:41.479010830Z [inf]  Server listening
2026-02-04T13:51:41.479016535Z [inf]  RPC health monitor started
2026-02-04T13:51:41.491805591Z [inf]  RPC benchmark sampling started
2026-02-04T13:51:41.577554145Z [inf]  [TokenJob] Scheduled: Primary chains every 5min (Ethereum, Solana, Base, BSC)
2026-02-04T13:51:41.577565245Z [inf]  [TokenJob] Scheduled: Secondary chains every 4h (Arbitrum, Optimism, Polygon)
2026-02-04T13:51:41.577640862Z [inf]  [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
2026-02-04T13:51:41.580109996Z [inf]  [SocialJob] Scheduled: Discovery (30m), Refresh (4h), Scoring (5m)
2026-02-04T13:51:41.580117765Z [inf]  Background jobs started
2026-02-04T13:51:41.580124219Z [inf]  Initializing auto trade service...
2026-02-04T13:51:41.580133034Z [inf]  [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
2026-02-04T13:51:41.580140774Z [inf]  Auto trade service initialized (Solana watcher + EVM webhook enabled)
2026-02-04T13:51:41.580145974Z [inf]  Auto trade service started
2026-02-04T13:51:41.580150689Z [inf]  [PositionMonitor] Starting position monitor (every 30s)...
2026-02-04T13:51:41.580155349Z [inf]  Position monitor started
2026-02-04T13:51:41.580160298Z [inf]  Token Alert Service started
2026-02-04T13:51:41.580165111Z [inf]  Token alert service started
2026-02-04T13:51:41.580170013Z [inf]  [ChatWorker] Started polling for AI tasks (interval: 3000ms)
2026-02-04T13:51:41.580175437Z [inf]  Chat worker started
2026-02-04T13:51:41.583082569Z [inf]  Starting Global Zora Alpha Detector (API Polling)
2026-02-04T13:51:41.583094028Z [inf]  🎉 All services initialized!
2026-02-04T13:51:42.236597493Z [err]  [DataRetention] No cleanup handler for table: SuggestionEvent
2026-02-04T13:51:42.236603709Z [inf]  [DataRetention] Cleanup job completed.
2026-02-04T13:51:46.575238627Z [inf]  [MarketJob] Running startup staleness check...
2026-02-04T13:51:46.581404155Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:51:46.584802225Z [inf]  [MarketJob] Overview is fresh, skipping API call
2026-02-04T13:51:46.587500728Z [inf]  [MarketJob] Protocols are fresh, skipping API call
2026-02-04T13:51:46.590340347Z [inf]  [SocialJob] Trending casts are fresh, skipping Snapchain API call
2026-02-04T13:51:46.590352890Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-04T13:51:47.453032807Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T13:51:47.453040275Z [inf]  0x API price received successfully
2026-02-04T13:51:47.453048042Z [inf]  ⚡ Uniswap V4 price fetched
2026-02-04T13:51:47.453055024Z [inf]  ⚡ Uniswap V4 price fetched
2026-02-04T13:51:47.453062152Z [wrn]  RPC endpoint failed
2026-02-04T13:51:47.589589618Z [wrn]  RPC endpoint failed
2026-02-04T13:51:47.601511235Z [wrn]  RPC endpoint failed
2026-02-04T13:51:48.461579399Z [inf]  RPC failover success
2026-02-04T13:51:48.461591127Z [inf]  RPC failover success
2026-02-04T13:51:49.149183319Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:51:49.155294571Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:51:49.223902944Z [inf]  📊 Position P/L check
2026-02-04T13:52:08.688145800Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:52:08.688155668Z [inf]  📊 Position P/L check
2026-02-04T13:52:09.473157324Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:52:11.578481964Z [inf]  [TokenJob] Starting initial token refresh...
2026-02-04T13:52:11.599100698Z [inf]  [TokenJob] Tokens for Ethereum are fresh, skipping API call
2026-02-04T13:52:19.605226684Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:52:20.331379026Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T13:52:20.331383235Z [inf]  0x API price received successfully
2026-02-04T13:52:21.544543733Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:52:22.371792310Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:52:32.290276632Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:52:41.625752824Z [inf]  [TokenJob] Tokens for Solana are fresh, skipping API call
2026-02-04T13:52:42.535403238Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:52:42.535415017Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:52:42.535573075Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:52:42.599784366Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:52:42.740413070Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:52:42.854819803Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:52:43.457843935Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:52:43.457852234Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:52:52.690591178Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:52:53.546796208Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T13:52:53.546802146Z [inf]  0x API price received successfully
2026-02-04T13:52:55.499355539Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:52:55.499361476Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:53:15.105655750Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:53:15.105661766Z [inf]  [TokenJob] Tokens for Base are fresh, skipping API call
2026-02-04T13:53:15.905532131Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:53:25.792630436Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:53:26.076374018Z [inf]  0x API price received successfully
2026-02-04T13:53:26.106727616Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T13:53:28.003533791Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:53:28.803997414Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:53:38.651396917Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:53:41.834741597Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-04T13:53:41.834747773Z [inf]  Fetching premium trending tokens
2026-02-04T13:53:41.945826963Z [inf]  WS addresses discovered
2026-02-04T13:53:43.052074422Z [inf]  Processed DexScreener trending candidates
2026-02-04T13:53:43.740752171Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:53:43.845213522Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:53:44.023371015Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:53:44.143338159Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:53:44.897787476Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:53:44.897922654Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:53:44.897936394Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:53:44.897946020Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:53:44.897954424Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:53:47.992695272Z [inf]  Skipping low liquidity token
2026-02-04T13:53:48.771057903Z [inf]  Trending tokens fetch complete
2026-02-04T13:53:48.771061914Z [inf]  Premium trending tokens fetch complete
2026-02-04T13:53:48.771065998Z [inf]  [TokenJob] Got 100 trending tokens for BSC
2026-02-04T13:53:48.771069880Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:53:48.775042503Z [inf]  Saved 100 trending tokens for bsc to database and memory cache
2026-02-04T13:53:48.801662851Z [inf]  [TokenJob] Saved 100 tokens for BSC to DB + cache
2026-02-04T13:53:48.805203105Z [inf]  [TokenJob] Refreshed 4 primary chains in 97.2s
2026-02-04T13:53:49.025968601Z [inf]  📊 Position P/L check
2026-02-04T13:54:09.022679398Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:54:09.022692852Z [inf]  0x API price received successfully
2026-02-04T13:54:09.022700342Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T13:54:09.022706621Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:54:09.022711692Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:54:09.022717818Z [inf]  📊 Position P/L check
2026-02-04T13:54:12.088022631Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:54:12.088029956Z [inf]  📊 Position P/L check
2026-02-04T13:54:22.005120566Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:54:22.005127494Z [inf]  📊 Position P/L check
2026-02-04T13:54:41.299620018Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:54:41.299628762Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T13:54:41.299635974Z [inf]  0x API price received successfully
2026-02-04T13:54:41.299640875Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:54:41.299645289Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:54:41.299650504Z [inf]  📊 Position P/L check
2026-02-04T13:54:44.325574247Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:54:44.969984621Z [inf]  📊 Position P/L check
2026-02-04T13:54:45.277745879Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:54:45.944842544Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:54:45.944848529Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:54:45.944854316Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:54:45.944862104Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:54:45.944869734Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:54:54.906515593Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:55:01.024623461Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-04T13:55:01.041974990Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-04T13:55:01.041982240Z [inf]  Fetching premium trending tokens
2026-02-04T13:55:01.042108737Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-04T13:55:01.042250761Z [inf]  Timer finished: recalc_heat_scores
2026-02-04T13:55:01.260902173Z [inf]  WS addresses discovered
2026-02-04T13:55:02.898315636Z [inf]  Processed DexScreener trending candidates
2026-02-04T13:55:04.914759662Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:55:04.919738177Z [inf]  0x API price received successfully
2026-02-04T13:55:04.930033683Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T13:55:07.084330999Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:55:07.225871798Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:55:10.018022818Z [inf]  Trending tokens fetch complete
2026-02-04T13:55:10.018028617Z [inf]  Premium trending tokens fetch complete
2026-02-04T13:55:10.018033623Z [inf]  [TokenJob] Got 100 trending tokens for Ethereum
2026-02-04T13:55:10.018038366Z [inf]  Saved 100 trending tokens for eth to database and memory cache
2026-02-04T13:55:10.018043961Z [inf]  [TokenJob] Saved 100 tokens for Ethereum to DB + cache
2026-02-04T13:55:17.329030059Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:55:37.327769601Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:55:38.210366118Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:55:38.210375808Z [inf]  0x API price received successfully
2026-02-04T13:55:38.210383598Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T13:55:40.036916836Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:55:40.036920936Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:55:40.036925288Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-04T13:55:40.036929478Z [inf]  Fetching premium trending tokens
2026-02-04T13:55:40.036933604Z [inf]  WS addresses discovered
2026-02-04T13:55:41.028826050Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-04T13:55:41.028828968Z [inf]  Processed DexScreener trending candidates
2026-02-04T13:55:41.028835771Z [inf]  Premium trending tokens fetch complete
2026-02-04T13:55:41.028837733Z [inf]  Saved 100 trending tokens for solana to database and memory cache
2026-02-04T13:55:41.028856882Z [inf]  [TokenJob] Saved 100 tokens for Solana to DB + cache
2026-02-04T13:55:47.165526616Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:55:47.227156017Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:55:47.388819290Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:55:48.103922558Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:55:49.064833950Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:55:49.064838551Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:55:49.250184614Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:55:50.115911635Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:56:09.520549396Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:56:10.094269855Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:56:10.299046888Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T13:56:10.359322936Z [inf]  0x API price received successfully
2026-02-04T13:56:11.259439203Z [inf]  [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
2026-02-04T13:56:11.259444841Z [inf]  Fetching premium trending tokens
2026-02-04T13:56:11.259450294Z [inf]  WS addresses discovered
2026-02-04T13:56:12.041146385Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:56:12.117294193Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:56:12.136837220Z [inf]  📊 Position P/L check
2026-02-04T13:56:12.262375012Z [inf]  Processed DexScreener trending candidates
2026-02-04T13:56:14.194956590Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T13:56:15.150724132Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T13:56:17.229228396Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T13:56:21.224464878Z [err]  Error fetching trending tokens
2026-02-04T13:56:21.224474422Z [inf]  Premium trending tokens fetch complete
2026-02-04T13:56:21.224480589Z [inf]  [TokenJob] Got 71 trending tokens for Base
2026-02-04T13:56:21.271594013Z [inf]  Saved 71 trending tokens for base to database and memory cache
2026-02-04T13:56:21.287908600Z [inf]  [TokenJob] Saved 71 tokens for Base to DB + cache
2026-02-04T13:56:22.177115105Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:56:22.193385655Z [inf]  📊 Position P/L check
2026-02-04T13:56:42.193293101Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:56:42.193307394Z [inf]  📊 Position P/L check
2026-02-04T13:56:42.193315667Z [inf]  incoming request
2026-02-04T13:56:42.193325388Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_z6lwmponpngp4wd2","createdAt":"2026-02-04T13:56:32.050Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27c7996","hash":"0xbf2efab7bc625a7b2fb7a4d2bac36a466b958269b95f6b6b7e1d0b3a207a22b2","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x6983500f"}],"source":"chainlake-kafka"}}
2026-02-04T13:56:42.193331939Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T13:56:42.193341693Z [inf]  request completed
2026-02-04T13:56:42.193349677Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0xbf2efa
2026-02-04T13:56:42.193360288Z [inf]  [Profile] fetchTransaction
2026-02-04T13:56:42.197367861Z [inf]  [Profile] fetchReceipt
2026-02-04T13:56:42.197377054Z [wrn]  RPC endpoint failed
2026-02-04T13:56:42.197383042Z [inf]  incoming request
2026-02-04T13:56:42.197391339Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_3gozbc4ssgmqfe9l","createdAt":"2026-02-04T13:56:32.126Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","toAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","blockNum":"0x27c7996","hash":"0xbf2efab7bc625a7b2fb7a4d2bac36a466b958269b95f6b6b7e1d0b3a207a22b2","value":0.5268259163881263,"typeTraceAddress":"CALL_0_0_2","asset":"ETH","category":"internal","rawContract":{"rawValue":"0x74fa96134c8ae4a","decimals":18},"blockTimestamp":"0x6983500f"}]}}
2026-02-04T13:56:42.197396474Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T13:56:42.197402198Z [inf]  [Webhook] Tx already in processedTxs cache: 0xbf2efab7bc625a
2026-02-04T13:56:42.197408933Z [inf]  request completed
2026-02-04T13:56:42.197414902Z [wrn]  RPC endpoint failed
2026-02-04T13:56:42.200797035Z [inf]  incoming request
2026-02-04T13:56:42.200807977Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_rf8q0gi2c231lcys","createdAt":"2026-02-04T13:56:32.245Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0x6ff5693b99212da76ad316178a184ab56d299b43","blockNum":"0x27c7996","hash":"0xbf2efab7bc625a7b2fb7a4d2bac36a466b958269b95f6b6b7e1d0b3a207a22b2","value":1681669223.5407465,"asset":"stapler","category":"token","rawContract":{"rawValue":"0x0000000000000000000000000000000000000000056f0b4f473b06fe9ccb19e8","address":"0xdf609a199f64af6b286716c33807deda2dfe7b07","decimals":18},"log":{"address":"0xdf609a199f64af6b286716c33807deda2dfe7b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000b4beddf1b828aaed9638601f7145b0f6093f2d3f","0x0000000000000000000000006ff5693b99212da76ad316178a184ab56d299b43"],"data":"0x0000000000000000000000000000000000000000056f0b4f473b06fe9ccb19e8","blockHash":"0x2f9c7e8d72f9516b19f8ba547ababf44abb56d550e9a0f8df8bdd4a7b295b0ba","blockNumber":"0x27c7996","blockTimestamp":"0x6983500f","transactionHash":"0xbf2efab7bc625a7b2fb7a4d2bac36a466b958269b95f6b6b7e1d0b3a207a22b2","transactionIndex":"0xbe","logIndex":"0x294","removed":false},"blockTimestamp":"0x6983500f"}],"source":"chainlake-kafka"}}
2026-02-04T13:56:42.200814484Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T13:56:42.200819995Z [inf]  [Webhook] Tx already in processedTxs cache: 0xbf2efab7bc625a
2026-02-04T13:56:42.200825050Z [inf]  request completed
2026-02-04T13:56:42.202615796Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:56:42.202632570Z [inf]  RPC failover success
2026-02-04T13:56:42.202641031Z [inf]  [Profile] parseSwapTransaction
2026-02-04T13:56:42.202646019Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0xb4beddf1: {
2026-02-04T13:56:42.202651237Z [inf]    tokenIn: '0x4200000000000000000000000000000000000006',
2026-02-04T13:56:42.202660166Z [inf]    tokenOut: '0xdf609a199f64af6b286716c33807deda2dfe7b07',
2026-02-04T13:56:42.202665200Z [inf]    dex: 'Uniswap v4'
2026-02-04T13:56:42.202670471Z [inf]  }
2026-02-04T13:56:42.202674691Z [inf]  Swap detected on target wallet
2026-02-04T13:56:42.202679152Z [inf]  Target is buying - triggering copy trade
2026-02-04T13:56:42.205862102Z [inf]  Timer finished: launchpad_det_0xdf609a199f64af6b286716c33807deda2dfe7b07
2026-02-04T13:56:42.205869590Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:56:42.205876204Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:56:42.205886422Z [inf]  🔥 Warming up 1 user settings
2026-02-04T13:56:42.205893788Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-04T13:56:42.205899571Z [inf]  📊 Mass Copy Trade Analysis
2026-02-04T13:56:42.207968404Z [inf]  📦 Processing batch 1/1
2026-02-04T13:56:42.207975404Z [inf]  Created PENDING position lock
2026-02-04T13:56:42.207983757Z [inf]  Buy Step 1: 100% amount, 5% slippage
2026-02-04T13:56:42.207988291Z [inf]  [MainSwapService][1770213394955_xdkiwn] Starting unified swap execution
2026-02-04T13:56:42.207993068Z [inf]  Timer finished: launchpad_det_ETH
2026-02-04T13:56:42.207997462Z [inf]  [MainSwapService][1770213394955_xdkiwn] Executing EVM swap
2026-02-04T13:56:42.211349506Z [inf]  [MainSwapService][1770213394955_xdkiwn] FastSwapMode enabled - attempting direct swap (BUY with native)
2026-02-04T13:56:42.211359582Z [inf]  [DirectSwap] Starting direct swap
2026-02-04T13:56:42.211364841Z [inf]  [PlatformFee] Fees ENABLED: { context: 'copyTrade', bps: 100, evmRecipient: '0xc5377e6329' }
2026-02-04T13:56:42.211370317Z [inf]  [Kyber] GET routes {
2026-02-04T13:56:42.211375288Z [inf]    routesUrl: 'https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&tokenOut=0xdf609a199f64af6b286716c33807deda2dfe7b07&amountIn=4536478105998881&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B&feeReceiver=0xc5377e6329770Be29Ef938d8aCC11f22398D7E54&feeAmount=100&isInBps=true&chargeFeeBy=currency_in'
2026-02-04T13:56:42.211381218Z [inf]  }
2026-02-04T13:56:42.211385973Z [inf]  0x API price received successfully
2026-02-04T13:56:42.211391170Z [inf]  [Kyber] routes response {
2026-02-04T13:56:42.211395832Z [inf]    status: 200,
2026-02-04T13:56:42.211400947Z [inf]    hasData: true,
2026-02-04T13:56:42.211405481Z [inf]    keys: [ 'code', 'message', 'data', 'requestId' ]
2026-02-04T13:56:42.214635274Z [inf]    allBodyKeys: [
2026-02-04T13:56:42.214646053Z [inf]      'routeSummary',
2026-02-04T13:56:42.214652320Z [inf]      'sender',
2026-02-04T13:56:42.214653826Z [inf]  }
2026-02-04T13:56:42.214657694Z [inf]      'recipient',
2026-02-04T13:56:42.214662555Z [inf]      'origin',
2026-02-04T13:56:42.214669065Z [inf]      'slippageTolerance',
2026-02-04T13:56:42.214670159Z [inf]  [Kyber] Building route/build request body: {
2026-02-04T13:56:42.214676480Z [inf]      'deadline'
2026-02-04T13:56:42.214679708Z [inf]    hasRouteSummary: true,
2026-02-04T13:56:42.214683760Z [inf]    ]
2026-02-04T13:56:42.214689224Z [inf]    routeSummaryKeys: [
2026-02-04T13:56:42.214695459Z [inf]  }
2026-02-04T13:56:42.214697569Z [inf]      'tokenIn',
2026-02-04T13:56:42.214703256Z [wrn]  [DirectSwap] Reference quote timeout
2026-02-04T13:56:42.214706103Z [inf]      'amountIn',
2026-02-04T13:56:42.214709823Z [inf]  [DirectSwap] Reference quote from Gecko
2026-02-04T13:56:42.214715822Z [inf]      'amountInUsd',
2026-02-04T13:56:42.214722422Z [inf]      'tokenOut',
2026-02-04T13:56:42.214736433Z [inf]      'amountOut',
2026-02-04T13:56:42.214743626Z [inf]      'amountOutUsd',
2026-02-04T13:56:42.214750913Z [inf]      'gas',
2026-02-04T13:56:42.214757996Z [inf]      'gasPrice'
2026-02-04T13:56:42.214764155Z [inf]    ],
2026-02-04T13:56:42.214770570Z [inf]    sender: '0xFB64Ce8d',
2026-02-04T13:56:42.214777275Z [inf]    recipient: '0xFB64Ce8d',
2026-02-04T13:56:42.214786166Z [inf]    slippageTolerance: 1500,
2026-02-04T13:56:42.214793072Z [inf]    slippageToleranceType: 'number',
2026-02-04T13:56:42.214802777Z [inf]    deadline: 1770213996,
2026-02-04T13:56:42.214809461Z [inf]    deadlineType: 'number',
2026-02-04T13:56:42.216031949Z [inf]  [DirectSwap] V4 fast path quote check
2026-02-04T13:56:42.216040449Z [inf]  [DirectSwap] V4 fast path accepted
2026-02-04T13:56:42.216047196Z [inf]  [DirectSwap] V4 minAmountOut calculated
2026-02-04T13:56:42.216051828Z [inf]  [DirectSwap] V4 gas estimated
2026-02-04T13:56:42.216056757Z [inf]  PrivyWallet Authorization Key config
2026-02-04T13:56:42.216061517Z [inf]  [sendTransaction] ========== PRIVY TX PARAMS ==========
2026-02-04T13:56:42.216065827Z [inf]  [sendTransaction] From: 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T13:56:42.216069979Z [inf]  [sendTransaction] To: 0x6ff5693b99212da76ad316178a184ab56d299b43
2026-02-04T13:56:42.216074511Z [inf]  [sendTransaction] Value: 4536478105998881
2026-02-04T13:56:42.218365901Z [inf]  [sendTransaction] ValueHex: 0x101de71e0a1621
2026-02-04T13:56:42.218374610Z [inf]  [sendTransaction] Data length: 2506
2026-02-04T13:56:42.218381190Z [inf]  [sendTransaction] Data (full): 0x3593564c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000006983514100000000000000000000000000000000000000000000000000000000000000020b100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000400000000000000000000000006ff5693b99212da76ad316178a184ab56d299b4380000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000360000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000003060b0f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001e00000000000000000000000000000000000000000000000000000000000000260000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000200000000000000000000000004200000000000000000000000000000000000006000000000000000000000000df609a199f64af6b286716c33807deda2dfe7b07000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000c8000000000000000000000000b429d62f8f3bffb98cdb9569533ea23bf0ba28cc000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000101de71e0a16210000000000000000000000000000000000000000000a5d8ebc8d8069133333330000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000df609a199f64af6b286716c33807deda2dfe7b070000000000000000000000000000000000000000000a5d8ebc8d806913333333
2026-02-04T13:56:42.222578918Z [inf]  [sendTransaction] ChainId: 8453
2026-02-04T13:56:42.222589884Z [inf]  [sendTransaction] Gas: 1085874
2026-02-04T13:56:42.222600320Z [inf]  [sendTransaction] MaxFeePerGas: undefined
2026-02-04T13:56:42.222607581Z [inf]  [sendTransaction] MaxPriorityFeePerGas: undefined
2026-02-04T13:56:42.222636635Z [inf]  [sendTransaction] Full TX object: {
2026-02-04T13:56:42.222644236Z [inf]    to: '0x6ff5693b99212da76ad316178a184ab56d299b43',
2026-02-04T13:56:42.222651113Z [inf]    data: '0x3593564c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000006983514100000000000000000000000000000000000000000000000000000000000000020b100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000400000000000000000000000006ff5693b99212da76ad316178a184ab56d299b4380000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000360000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000003060b0f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001e00000000000000000000000000000000000000000000000000000000000000260000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000200000000000000000000000004200000000000000000000000000000000000006000000000000000000000000df609a199f64af6b286716c33807deda2dfe7b07000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000c8000000000000000000000000b429d62f8f3bffb98cdb9569533ea23bf0ba28cc000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000101de71e0a16210000000000000000000000000000000000000000000a5d8ebc8d8069133333330000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000df609a199f64af6b286716c33807deda2dfe7b070000000000000000000000000000000000000000000a5d8ebc8d806913333333',
2026-02-04T13:56:42.228629452Z [inf]    value: '4536478105998881',
2026-02-04T13:56:42.228643553Z [inf]    chainId: 8453,
2026-02-04T13:56:42.228651091Z [inf]    gas: '1085874'
2026-02-04T13:56:42.228658058Z [inf]  }
2026-02-04T13:56:42.228665270Z [inf]  [sendTransaction] ===========================================
2026-02-04T13:56:42.228673574Z [inf]  Ethereum transaction sent via Privy
2026-02-04T13:56:42.228680902Z [inf]  [DirectSwap] V4 swap executed
2026-02-04T13:56:42.228688172Z [inf]  [DirectSwap] Finished
2026-02-04T13:56:42.228695287Z [inf]  [MainSwapService][1770213394955_xdkiwn] Direct swap successful
2026-02-04T13:56:42.228703532Z [inf]  Copy trade completed and position created
2026-02-04T13:56:42.232554300Z [inf]  [Warpcast] Sending DM to FID 877398: "🚀 Bought $stapler @ $10.00
2026-02-04T13:56:42.232562216Z [inf]  
2026-02-04T13:56:42.232566430Z [inf]  🟢 **BOUGHT $stapler*..."
2026-02-04T13:56:42.232570496Z [inf]  [Warpcast] DM sent successfully. Daily usage: 1/50000
2026-02-04T13:56:42.232574286Z [inf]  ✅ Smart batch execution complete
2026-02-04T13:56:42.249428972Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:56:42.270930973Z [inf]  incoming request
2026-02-04T13:56:42.274226800Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_dvqtj3z1mmxhae5x","createdAt":"2026-02-04T13:56:42.023Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","toAddress":"0x6ff5693b99212da76ad316178a184ab56d299b43","blockNum":"0x27c799b","hash":"0x8d0daa3833efb416fbc7c92a7c738b2ede481ed33af08ca59a449c2fed125826","value":0.004536478105998881,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x101de71e0a1621","decimals":18},"blockTimestamp":"0x69835019"}],"source":"chainlake-kafka"}}
2026-02-04T13:56:42.274237182Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T13:56:42.274243756Z [inf]  request completed
2026-02-04T13:56:42.276805040Z [inf]  [Webhook] ⚠️ Ignoring tx 0x8d0daa: No matched tracked wallets in [0xfb64, 0x6ff5]
2026-02-04T13:56:42.582723393Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T13:56:43.267483471Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T13:56:43.267489156Z [inf]  incoming request
2026-02-04T13:56:43.267496532Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_m85c83ibf36shwss","createdAt":"2026-02-04T13:56:42.321Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","blockNum":"0x27c799b","hash":"0x8d0daa3833efb416fbc7c92a7c738b2ede481ed33af08ca59a449c2fed125826","value":14562227.15478317,"asset":"stapler","category":"token","rawContract":{"rawValue":"0x0000000000000000000000000000000000000000000c0babea769928194919c8","address":"0xdf609a199f64af6b286716c33807deda2dfe7b07","decimals":18},"log":{"address":"0xdf609a199f64af6b286716c33807deda2dfe7b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b"],"data":"0x0000000000000000000000000000000000000000000c0babea769928194919c8","blockHash":"0xdfaf8116081147415788436bc79f7b1fecf7140b9b0dfa4fd93ad229f6c3c594","blockNumber":"0x27c799b","blockTimestamp":"0x69835019","transactionHash":"0x8d0daa3833efb416fbc7c92a7c738b2ede481ed33af08ca59a449c2fed125826","transactionIndex":"0x2e","logIndex":"0xe1","removed":false},"blockTimestamp":"0x69835019"}],"source":"chainlake-kafka"}}
2026-02-04T13:56:43.270751416Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T13:56:43.270758538Z [inf]  request completed
2026-02-04T13:56:43.270765348Z [inf]  [Webhook] ⚠️ Ignoring tx 0x8d0daa: No matched tracked wallets in [0x4985, 0xfb64]
2026-02-04T13:56:43.270769685Z [inf]  0x API price received successfully
2026-02-04T13:56:43.270774512Z [wrn]  RPC endpoint failed
2026-02-04T13:56:43.270779287Z [inf]  RPC failover success
2026-02-04T13:56:43.421605546Z [wrn]  RPC endpoint failed
2026-02-04T13:56:43.570115583Z [inf]  RPC failover success
2026-02-04T13:56:44.254913212Z [wrn]  RPC endpoint failed
2026-02-04T13:56:44.254923707Z [inf]  RPC failover success
2026-02-04T13:56:44.254930293Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:56:44.473223401Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:56:44.534804182Z [inf]  📊 Position P/L check
2026-02-04T13:56:51.218620760Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:56:51.322199308Z [inf]  [TokenJob] Tokens for BSC are fresh, skipping API call
2026-02-04T13:56:51.334334897Z [inf]  [TokenJob] Refreshed 4 primary chains in 110.3s
2026-02-04T13:56:54.575396052Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:56:55.210807395Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:56:55.210819301Z [inf]  📊 Position P/L check
2026-02-04T13:56:55.210826642Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:56:55.210833328Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:56:55.210840833Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:56:55.257069911Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:56:55.386480352Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:57:05.170397104Z [inf]  📊 Position P/L check
2026-02-04T13:57:05.170587252Z [inf]  [PositionMonitor] 🔄 Running position check...