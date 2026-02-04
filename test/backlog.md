2026-02-04T15:14:47.000000000Z [inf]  Starting Container
2026-02-04T15:14:48.738138248Z [inf]  
2026-02-04T15:14:48.738142172Z [inf]  > kiko-api@1.0.0 start
2026-02-04T15:14:48.738145278Z [inf]  > node dist/index.js
2026-02-04T15:14:48.738148681Z [inf]  
2026-02-04T15:14:50.748675263Z [inf]  [Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
2026-02-04T15:14:50.822806401Z [inf]  Zora SDK initialized with API Key
2026-02-04T15:14:51.132360838Z [err]  [SocialJob] Could not find real_hot_users.json in any candidate path
2026-02-04T15:14:51.598342067Z [inf]  [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
2026-02-04T15:14:51.819823386Z [inf]  [SkillRegistry:exec] Loading skills from /app/dist/skills...
2026-02-04T15:14:51.819828814Z [inf]  [SkillRegistry:clean] Loading skills from /app/dist/skills...
2026-02-04T15:14:51.959199917Z [inf]  Serving static files from:
2026-02-04T15:14:51.959202956Z [inf]  Initializing services...
2026-02-04T15:14:52.099487898Z [inf]  [DataRetention] Checking retention policies...
2026-02-04T15:14:52.099493527Z [inf]  [DataRetention] Starting cleanup job...
2026-02-04T15:14:52.099496972Z [inf]  Redis initialized
2026-02-04T15:14:52.099500193Z [inf]  Starting server on port 8080...
2026-02-04T15:14:52.099540817Z [inf]  [Prisma] DB connection is healthy
2026-02-04T15:14:52.099544421Z [inf]  Database connection successful
2026-02-04T15:14:52.211368801Z [inf]  Server listening at http://0.0.0.0:8080
2026-02-04T15:14:52.211375615Z [inf]  Server listening
2026-02-04T15:14:52.211380010Z [inf]  RPC health monitor started
2026-02-04T15:14:52.211384028Z [inf]  RPC benchmark sampling started
2026-02-04T15:14:52.216484511Z [inf]  [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
2026-02-04T15:14:52.216489202Z [inf]  [TokenJob] Scheduled: Primary chains every 5min (Ethereum, Solana, Base, BSC)
2026-02-04T15:14:52.216492975Z [inf]  [TokenJob] Scheduled: Secondary chains every 4h (Arbitrum, Optimism, Polygon)
2026-02-04T15:14:52.217441223Z [inf]  Position monitor started
2026-02-04T15:14:52.217444160Z [inf]  [SocialJob] Scheduled: Discovery (30m), Refresh (4h), Scoring (5m)
2026-02-04T15:14:52.217446614Z [inf]  Token Alert Service started
2026-02-04T15:14:52.217451700Z [inf]  Token alert service started
2026-02-04T15:14:52.217451984Z [inf]  Background jobs started
2026-02-04T15:14:52.217457307Z [inf]  [ChatWorker] Started polling for AI tasks (interval: 3000ms)
2026-02-04T15:14:52.217458074Z [inf]  Initializing auto trade service...
2026-02-04T15:14:52.217461938Z [inf]  Chat worker started
2026-02-04T15:14:52.217464372Z [inf]  [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
2026-02-04T15:14:52.217467768Z [inf]  Auto trade service initialized (Solana watcher + EVM webhook enabled)
2026-02-04T15:14:52.217470529Z [inf]  Auto trade service started
2026-02-04T15:14:52.217474183Z [inf]  [PositionMonitor] Starting position monitor (every 30s)...
2026-02-04T15:14:52.217906929Z [inf]  Starting Global Zora Alpha Detector (API Polling)
2026-02-04T15:14:52.217910654Z [inf]  🎉 All services initialized!
2026-02-04T15:14:52.338495751Z [err]  [DataRetention] No cleanup handler for table: SuggestionEvent
2026-02-04T15:14:52.358877001Z [inf]  [DataRetention] Cleanup job completed.
2026-02-04T15:14:57.230213040Z [inf]  [MarketJob] Overview is fresh, skipping API call
2026-02-04T15:14:57.230229092Z [inf]  [MarketJob] Protocols are fresh, skipping API call
2026-02-04T15:14:57.230242188Z [inf]  [MarketJob] Running startup staleness check...
2026-02-04T15:14:57.230246928Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:14:57.300023622Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-04T15:14:57.300029020Z [inf]  [Job] ✅ Got 612 quality users from database
2026-02-04T15:14:57.300034046Z [inf]  [SocialJob] fetchCastsFromUsers starting with 612 FIDs, target: 1000
2026-02-04T15:14:57.300037697Z [err]  [Job] Real hot users file not found: 
2026-02-04T15:14:57.605543740Z [inf]  0x API price received successfully
2026-02-04T15:14:57.834525603Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:14:57.834528401Z [inf]  ⚡ Uniswap V4 price fetched
2026-02-04T15:14:57.834531052Z [inf]  ⚡ Uniswap V4 price fetched
2026-02-04T15:14:57.985034475Z [wrn]  RPC endpoint failed
2026-02-04T15:14:57.990045374Z [wrn]  RPC endpoint failed
2026-02-04T15:14:58.050898289Z [inf]  RPC failover success
2026-02-04T15:14:58.085625769Z [inf]  RPC failover success
2026-02-04T15:14:58.862015876Z [wrn]  RPC endpoint failed
2026-02-04T15:14:58.862020020Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:14:58.960165790Z [inf]  RPC failover success
2026-02-04T15:14:59.017157440Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:15:00.544334590Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-04T15:15:00.544361560Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-04T15:15:00.544365581Z [inf]  Fetching premium trending tokens
2026-02-04T15:15:00.544396792Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-04T15:15:00.544401174Z [inf]  Timer finished: recalc_heat_scores
2026-02-04T15:15:00.544404929Z [err]  DexScreener WS: Connection error
2026-02-04T15:15:09.099507891Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:15:28.957032257Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:15:28.957036304Z [inf]  [TokenJob] Starting initial token refresh...
2026-02-04T15:15:28.957040340Z [inf]  [TokenJob] Skipping refresh for Ethereum - update already in progress
2026-02-04T15:15:28.957050574Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:15:28.957054337Z [wrn]  WS returned 0 addresses
2026-02-04T15:15:28.957058063Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:15:28.957061980Z [inf]  Merged addresses
2026-02-04T15:15:28.957067752Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:15:28.957071351Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:15:28.957074761Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:15:29.614273200Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:15:30.036735894Z [inf]  0x API price received successfully
2026-02-04T15:15:30.219796680Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:15:30.219799942Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:15:31.398848095Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:15:31.398850892Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:15:34.213603288Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:15:34.213606121Z [err]  GeckoTerminal API error after retries
2026-02-04T15:15:34.213609669Z [err]  Error fetching trending tokens
2026-02-04T15:15:34.213612414Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:15:34.213615008Z [inf]  [TokenJob] Got 27 trending tokens for Ethereum
2026-02-04T15:15:34.213617752Z [err]  [TokenJob] New list too small (27) for Ethereum; keeping existing (100)
2026-02-04T15:15:41.493904765Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:16:01.547772970Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:16:01.547776076Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-04T15:16:01.547779355Z [inf]  Fetching premium trending tokens
2026-02-04T15:16:01.547782388Z [err]  DexScreener WS: Connection error
2026-02-04T15:16:01.547785644Z [err]  DexScreener WS: Connection error
2026-02-04T15:16:01.547788973Z [err]  DexScreener WS: Connection error
2026-02-04T15:16:01.547792725Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:16:01.547796156Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:16:01.547799299Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:16:01.548512751Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:16:01.548517479Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:16:01.548520365Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:16:01.548524734Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:16:01.548527909Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:16:01.548530870Z [wrn]  WS returned 0 addresses
2026-02-04T15:16:01.548533471Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:16:01.548536131Z [inf]  Merged addresses
2026-02-04T15:16:01.851766150Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:16:02.098875760Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:16:02.098879963Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:16:02.098884198Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-04T15:16:02.098888334Z [inf]  [TokenJob] Filtered out 2 invalid tokens for Solana
2026-02-04T15:16:02.159863361Z [inf]  Saved 98 trending tokens for solana to database and memory cache
2026-02-04T15:16:02.199587054Z [inf]  [TokenJob] Saved 98 tokens for Solana to DB + cache
2026-02-04T15:16:02.278397248Z [inf]  0x API price received successfully
2026-02-04T15:16:02.278399897Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:16:03.569709990Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:16:03.590145404Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:16:04.223616230Z [inf]  [TokenJob] Tokens for Solana are fresh, skipping API call
2026-02-04T15:16:13.817786820Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:16:13.948971876Z [inf]  📊 Position P/L check
2026-02-04T15:16:33.953819678Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:16:33.953823293Z [inf]  📊 Position P/L check
2026-02-04T15:16:33.953827254Z [inf]  [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
2026-02-04T15:16:33.953830973Z [inf]  Fetching premium trending tokens
2026-02-04T15:16:33.953834255Z [err]  DexScreener WS: Connection error
2026-02-04T15:16:33.953837238Z [err]  DexScreener WS: Connection error
2026-02-04T15:16:34.298362910Z [inf]  [TokenJob] Skipping refresh for Base - update already in progress
2026-02-04T15:16:34.342982295Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:16:34.717916760Z [inf]  0x API price received successfully
2026-02-04T15:16:34.945635543Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:16:35.518310570Z [wrn]  RPC endpoint failed
2026-02-04T15:16:35.591402602Z [inf]  RPC failover success
2026-02-04T15:16:35.979020042Z [wrn]  RPC endpoint failed
2026-02-04T15:16:35.979023245Z [inf]  RPC failover success
2026-02-04T15:16:35.979027050Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:16:35.984193539Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:16:36.102054156Z [inf]  📊 Position P/L check
2026-02-04T15:16:42.405923161Z [err]  DexScreener WS: Connection error
2026-02-04T15:16:42.405928561Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:16:42.405932392Z [wrn]  WS returned 0 addresses
2026-02-04T15:16:42.405935189Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:16:42.696130088Z [inf]  Merged addresses
2026-02-04T15:16:43.096226921Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:16:43.512583687Z [inf]  Skipping low liquidity token
2026-02-04T15:16:44.412809078Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:16:45.432421004Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:16:46.114407398Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:16:46.211883439Z [inf]  📊 Position P/L check
2026-02-04T15:16:47.446654967Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:16:51.677619045Z [err]  Error fetching trending tokens
2026-02-04T15:16:51.677623786Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:16:51.677628103Z [inf]  [TokenJob] Got 45 trending tokens for Base
2026-02-04T15:16:51.677633808Z [err]  [TokenJob] New list too small (45) for Base; keeping existing (71)
2026-02-04T15:16:56.208948417Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:16:56.249194772Z [inf]  📊 Position P/L check
2026-02-04T15:16:57.588792081Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:16:57.743260869Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:16:58.494745217Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:16:58.614878964Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:16:58.740450353Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:16:59.340052480Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:16:59.493721780Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:16:59.621566685Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:16:59.728203568Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:17:04.311237018Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-04T15:17:04.311241609Z [inf]  Fetching premium trending tokens
2026-02-04T15:17:04.350956188Z [err]  DexScreener WS: Connection error
2026-02-04T15:17:04.520927059Z [err]  DexScreener WS: Connection error
2026-02-04T15:17:05.609698216Z [err]  DexScreener WS: Connection error
2026-02-04T15:17:06.772416458Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:17:07.021075395Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:17:07.021078905Z [inf]  0x API price received successfully
2026-02-04T15:17:07.512730361Z [wrn]  RPC endpoint failed
2026-02-04T15:17:07.934232136Z [wrn]  RPC endpoint failed
2026-02-04T15:17:07.975744940Z [inf]  RPC failover success
2026-02-04T15:17:08.343563693Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:17:08.343567264Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:17:08.343571820Z [inf]  📊 Position P/L check
2026-02-04T15:17:13.593369382Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:17:13.593373942Z [wrn]  WS returned 0 addresses
2026-02-04T15:17:13.593376999Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:17:14.419016588Z [inf]  Merged addresses
2026-02-04T15:17:14.683947870Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:17:14.683950790Z [err]  Error fetching trending tokens
2026-02-04T15:17:14.683953984Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:17:14.683957699Z [inf]  [TokenJob] Got 31 trending tokens for BSC
2026-02-04T15:17:14.683961111Z [err]  [TokenJob] New list too small (31) for BSC; keeping existing (100)
2026-02-04T15:17:14.694687079Z [inf]  [TokenJob] Refreshed 4 primary chains in 134.5s
2026-02-04T15:17:18.424821791Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:17:21.699947129Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-04T15:17:21.699951101Z [inf]  Fetching premium trending tokens
2026-02-04T15:17:21.722155348Z [err]  DexScreener WS: Connection error
2026-02-04T15:17:21.924056345Z [err]  DexScreener WS: Connection error
2026-02-04T15:17:22.627809136Z [err]  DexScreener WS: Connection error
2026-02-04T15:17:23.588485053Z [inf]  [SocialJob] Checking Zora coin status for 366 casts...
2026-02-04T15:17:28.528683318Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:17:30.611364930Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:17:30.611369835Z [wrn]  WS returned 0 addresses
2026-02-04T15:17:30.611373351Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:17:30.714572648Z [inf]  Merged addresses
2026-02-04T15:17:30.808110491Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:17:30.808113773Z [err]  Error fetching trending tokens
2026-02-04T15:17:30.808117175Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:17:30.808120772Z [inf]  [TokenJob] Got 31 trending tokens for BSC
2026-02-04T15:17:30.808123931Z [err]  [TokenJob] New list too small (31) for BSC; keeping existing (100)
2026-02-04T15:17:30.813264841Z [inf]  [TokenJob] Refreshed 4 primary chains in 128.6s
2026-02-04T15:17:31.703657072Z [inf]  [SocialRepo] Cleaned up 160 old casts (cap: 1000)
2026-02-04T15:17:32.574209779Z [inf]  Timer finished: get_trending_casts_trending
2026-02-04T15:17:32.851718080Z [inf]  SocialRepo: Updated cache with 500 merged casts
2026-02-04T15:17:32.851722360Z [inf]  SocialRepo: Saved 366 trending casts to database
2026-02-04T15:17:32.851726913Z [inf]  Timer finished: save_trending_casts
2026-02-04T15:17:32.851731187Z [inf]  [SocialJob] Casts refreshed: 366 saved
2026-02-04T15:17:32.851735751Z [inf]  [SocialJob] 🚀 Triggering OGP Prefetch for top 50 casts...
2026-02-04T15:17:38.467385965Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:17:38.848635112Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:17:38.848637865Z [inf]  0x API price received successfully
2026-02-04T15:17:39.983517934Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:17:40.071763844Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:18:00.079988022Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:18:00.294806103Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:18:00.425318450Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:18:00.487795326Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:18:00.555928529Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:18:00.875783937Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:18:00.875788548Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:18:00.989777079Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:18:01.093242272Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:18:01.213511173Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:18:10.609979541Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:18:11.008249010Z [inf]  0x API price received successfully
2026-02-04T15:18:11.008251933Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:18:12.201422033Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:18:12.230953769Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:18:32.199658229Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:18:32.279746654Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:18:52.223046350Z [inf]  0x API price received successfully
2026-02-04T15:18:52.223056643Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:18:52.223062610Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:18:52.223119784Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:18:52.223122872Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:18:54.514894681Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:18:54.514901992Z [inf]  📊 Position P/L check
2026-02-04T15:19:01.731315818Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:19:01.933302975Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:19:02.074063656Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:19:02.271174398Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:19:02.407187978Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:19:02.563307302Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:19:02.652483631Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:19:02.835343414Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:19:02.966527789Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:19:04.572398456Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:19:04.572403207Z [inf]  📊 Position P/L check
2026-02-04T15:19:24.457367639Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:19:24.457370957Z [inf]  0x API price received successfully
2026-02-04T15:19:24.457374308Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:19:24.457377193Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:19:24.457380057Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:19:24.457382822Z [inf]  📊 Position P/L check
2026-02-04T15:19:26.278284016Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:19:26.374673976Z [inf]  📊 Position P/L check
2026-02-04T15:19:36.371688857Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:19:36.480858773Z [inf]  📊 Position P/L check
2026-02-04T15:19:46.452370485Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:19:46.891944658Z [inf]  0x API price received successfully
2026-02-04T15:19:46.891951819Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:19:47.610054458Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:19:47.931559825Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:19:57.822378275Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:20:00.059324298Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-04T15:20:00.059329335Z [inf]  Timer finished: recalc_heat_scores
2026-02-04T15:20:00.840258838Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-04T15:20:01.017023104Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-04T15:20:01.017025829Z [inf]  Fetching premium trending tokens
2026-02-04T15:20:01.017028958Z [err]  DexScreener WS: Connection error
2026-02-04T15:20:03.490784148Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:20:03.643764419Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:20:06.235572497Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:20:06.352976186Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:20:06.491030183Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:20:06.616633916Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:20:06.736911280Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:20:06.859899133Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:20:07.085282657Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:20:08.112908614Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:20:27.981538105Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:20:27.981542165Z [inf]  0x API price received successfully
2026-02-04T15:20:27.981545626Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:20:27.981550255Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:20:27.981554100Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:20:27.981557501Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:20:27.981561117Z [wrn]  WS returned 0 addresses
2026-02-04T15:20:27.981565204Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:20:27.982374856Z [inf]  Merged addresses
2026-02-04T15:20:27.982380327Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:20:28.363377701Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:20:29.347244975Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:20:29.718051856Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:20:31.346786743Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:20:35.361335544Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:20:35.361340290Z [err]  GeckoTerminal API error after retries
2026-02-04T15:20:35.361343324Z [err]  Error fetching trending tokens
2026-02-04T15:20:35.361345981Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:20:35.361348653Z [inf]  [TokenJob] Got 27 trending tokens for Ethereum
2026-02-04T15:20:35.376557293Z [err]  [TokenJob] New list too small (27) for Ethereum; keeping existing (100)
2026-02-04T15:20:39.902561723Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:20:59.912064004Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:20:59.912068892Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:20:59.912072260Z [inf]  0x API price received successfully
2026-02-04T15:20:59.912075186Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:20:59.912078082Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:21:01.990012951Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:21:05.448433796Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-04T15:21:05.448438570Z [inf]  Fetching premium trending tokens
2026-02-04T15:21:05.448442335Z [err]  DexScreener WS: Connection error
2026-02-04T15:21:05.448445646Z [err]  DexScreener WS: Connection error
2026-02-04T15:21:07.690609039Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:21:08.131262250Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:21:08.277369789Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:21:08.738891925Z [err]  DexScreener WS: Connection error
2026-02-04T15:21:08.826751038Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:21:08.959519538Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:21:09.083639127Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:21:09.115163487Z [err]  DexScreener WS: Connection error
2026-02-04T15:21:09.115168775Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:21:09.115172801Z [wrn]  WS returned 0 addresses
2026-02-04T15:21:09.115177099Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:21:09.232937497Z [inf]  Merged addresses
2026-02-04T15:21:09.232940460Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:21:09.924075575Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:21:09.924080296Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:21:09.924083230Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-04T15:21:09.924086356Z [inf]  [TokenJob] Filtered out 2 invalid tokens for Solana
2026-02-04T15:21:09.988077875Z [inf]  Saved 98 trending tokens for solana to database and memory cache
2026-02-04T15:21:10.012837843Z [inf]  [TokenJob] Saved 98 tokens for Solana to DB + cache
2026-02-04T15:21:12.132468069Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:21:12.296227780Z [inf]  📊 Position P/L check
2026-02-04T15:21:32.337478033Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:21:32.337482105Z [inf]  0x API price received successfully
2026-02-04T15:21:32.337485242Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:21:32.337488559Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:21:32.337492276Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:21:32.337495467Z [inf]  📊 Position P/L check
2026-02-04T15:21:32.337498617Z [inf]  incoming request
2026-02-04T15:21:32.337999351Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_mgufiarkladsgt15","createdAt":"2026-02-04T15:21:30.053Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0xd422c883527d5f48a63949395074f92f473a1602","blockNum":"0x27c838b","hash":"0x93833ff8eaef1a2fb1811d7773a13c00426cbe59cbd910c65b5f3c070f39c1bf","value":0.5,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x6f05b59d3b20000","decimals":18},"blockTimestamp":"0x698363f9"}],"source":"chainlake-kafka"}}
2026-02-04T15:21:32.338004265Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:21:32.338007442Z [inf]  request completed
2026-02-04T15:21:32.338010494Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x93833f
2026-02-04T15:21:32.338013800Z [inf]  [Profile] fetchReceipt
2026-02-04T15:21:32.338017903Z [inf]  [Profile] fetchTransaction
2026-02-04T15:21:32.338021556Z [inf]  [Profile] parseSwapTransaction
2026-02-04T15:21:32.338024175Z [inf]  [Webhook] Not a swap tx for 0xb4beddf1: 0x93833ff8eaef1a
2026-02-04T15:21:32.338836522Z [inf]  incoming request
2026-02-04T15:21:32.338840635Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_1575o1dl1f39jrh7","createdAt":"2026-02-04T15:21:31.955Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0xd422c883527d5f48a63949395074f92f473a1602","blockNum":"0x27c838c","hash":"0xbd898f451a3dd11e89b33fbd7b3f36a6684b20f5ed9afd1c1a31a70bab3874ab","value":0.5,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x6f05b59d3b20000","decimals":18},"blockTimestamp":"0x698363fb"}],"source":"chainlake-kafka"}}
2026-02-04T15:21:32.338844870Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:21:32.338848564Z [inf]  request completed
2026-02-04T15:21:32.338851444Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0xbd898f
2026-02-04T15:21:32.338854696Z [inf]  [Profile] fetchReceipt
2026-02-04T15:21:32.338859212Z [inf]  [Profile] fetchTransaction
2026-02-04T15:21:32.338873190Z [inf]  Swap successfully decoded from logs
2026-02-04T15:21:32.339754975Z [inf]  [Profile] parseSwapTransaction
2026-02-04T15:21:32.339758494Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0xb4beddf1: {
2026-02-04T15:21:32.339761371Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-04T15:21:32.339763975Z [inf]    tokenOut: '0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07',
2026-02-04T15:21:32.339766634Z [inf]    dex: 'Uniswap v4'
2026-02-04T15:21:32.339769393Z [inf]  }
2026-02-04T15:21:32.339772121Z [inf]  Swap detected on target wallet
2026-02-04T15:21:32.339774608Z [inf]  Target is buying - triggering copy trade
2026-02-04T15:21:32.422277909Z [wrn]  All API liquidity sources failed
2026-02-04T15:21:32.454734274Z [inf]  Timer finished: launchpad_det_0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07
2026-02-04T15:21:32.466463862Z [wrn]  All API liquidity sources failed
2026-02-04T15:21:32.466471927Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:21:32.506109616Z [wrn]  All API liquidity sources failed
2026-02-04T15:21:32.840949434Z [inf]  incoming request
2026-02-04T15:21:32.840952050Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_krovbpj1sni7lrx3","createdAt":"2026-02-04T15:21:32.378Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","blockNum":"0x27c838c","hash":"0xbd898f451a3dd11e89b33fbd7b3f36a6684b20f5ed9afd1c1a31a70bab3874ab","value":2762528640.997859,"asset":"CLAWIAI","category":"token","rawContract":{"rawValue":"0x000000000000000000000000000000000000000008ed1c31b4c7408f0044afb2","address":"0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07","decimals":18},"log":{"address":"0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x000000000000000000000000b4beddf1b828aaed9638601f7145b0f6093f2d3f"],"data":"0x000000000000000000000000000000000000000008ed1c31b4c7408f0044afb2","blockHash":"0x74e56f484b45261101fec2c767d9f9b46264b4c0c5cf29f37cac9aee8610d7fd","blockNumber":"0x27c838c","blockTimestamp":"0x698363fb","transactionHash":"0xbd898f451a3dd11e89b33fbd7b3f36a6684b20f5ed9afd1c1a31a70bab3874ab","transactionIndex":"0x37","logIndex":"0x147","removed":false},"blockTimestamp":"0x698363fb"}],"source":"chainlake-kafka"}}
2026-02-04T15:21:32.840955826Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:21:32.840958615Z [inf]  [Webhook] Tx already in processedTxs cache: 0xbd898f451a3dd1
2026-02-04T15:21:32.840961478Z [inf]  request completed
2026-02-04T15:21:33.395576401Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:21:33.395580508Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:21:33.417740287Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:21:33.417746109Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:21:33.831173260Z [inf]  Derived missing token price from swap data
2026-02-04T15:21:33.831253208Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:21:33.831256494Z [err]  Critical: No valid price data available
2026-02-04T15:21:33.831259522Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:21:33.831262517Z [err]  Critical: No valid price data available
2026-02-04T15:21:33.831265723Z [wrn]  RPC price missing - proceeding with metadata-only fallback (fast mode)
2026-02-04T15:21:33.831268960Z [inf]  🔥 Warming up 1 user settings
2026-02-04T15:21:33.831272358Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-04T15:21:33.831275473Z [inf]  📊 Mass Copy Trade Analysis
2026-02-04T15:21:33.831278222Z [inf]  📦 Processing batch 1/1
2026-02-04T15:21:34.144567631Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:21:34.200395343Z [inf]  Created PENDING position lock
2026-02-04T15:21:34.200402602Z [inf]  Buy Step 1: 100% amount, 5% slippage
2026-02-04T15:21:34.200407681Z [inf]  [MainSwapService][1770218494198_pm84k9] Starting unified swap execution
2026-02-04T15:21:34.200411914Z [inf]  Timer finished: launchpad_det_ETH
2026-02-04T15:21:34.200417691Z [inf]  [MainSwapService][1770218494198_pm84k9] Executing EVM swap
2026-02-04T15:21:34.200422284Z [inf]  [MainSwapService][1770218494198_pm84k9] FastSwapMode enabled - attempting direct swap (BUY with native)
2026-02-04T15:21:34.201188594Z [inf]  [DirectSwap] Starting direct swap
2026-02-04T15:21:34.212233849Z [inf]  [PlatformFee] Fees ENABLED: { context: 'copyTrade', bps: 100, evmRecipient: '0xc5377e6329' }
2026-02-04T15:21:34.212242570Z [inf]  [Kyber] GET routes {
2026-02-04T15:21:34.212245793Z [inf]    routesUrl: 'https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&tokenOut=0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07&amountIn=4592349121853444&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B&feeReceiver=0xc5377e6329770Be29Ef938d8aCC11f22398D7E54&feeAmount=100&isInBps=true&chargeFeeBy=currency_in'
2026-02-04T15:21:34.212248816Z [inf]  }
2026-02-04T15:21:34.239596345Z [inf]  📊 Position P/L check
2026-02-04T15:21:34.561734784Z [inf]  0x API price received successfully
2026-02-04T15:21:36.214482398Z [wrn]  [DirectSwap] Reference quote timeout
2026-02-04T15:21:36.592585788Z [wrn]  [DirectSwap] No reference quote available
2026-02-04T15:21:36.592590335Z [inf]  [DirectSwap] V4 fast path quote check
2026-02-04T15:21:36.592593986Z [inf]  [DirectSwap] V4 fast path fallback
2026-02-04T15:21:36.990080763Z [inf]  [DirectSwap] Pool discovery complete
2026-02-04T15:21:36.990086432Z [inf]  [PlatformFee] Fees ENABLED: { context: 'copyTrade', bps: 100, evmRecipient: '0xc5377e6329' }
2026-02-04T15:21:36.990089977Z [inf]  [Kyber] GET routes {
2026-02-04T15:21:36.990092966Z [inf]    routesUrl: 'https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&tokenOut=0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07&amountIn=4592349121853444&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B&feeReceiver=0xc5377e6329770Be29Ef938d8aCC11f22398D7E54&feeAmount=100&isInBps=true&chargeFeeBy=currency_in'
2026-02-04T15:21:36.990097584Z [inf]  }
2026-02-04T15:21:37.329532486Z [err]  api failed after 1 attempts
2026-02-04T15:21:37.329535734Z [err]  0x API price fetch error
2026-02-04T15:21:37.867859147Z [inf]    recipient: '0xFB64Ce8d',
2026-02-04T15:21:37.867866755Z [inf]    slippageTolerance: 1500,
2026-02-04T15:21:37.867870589Z [inf]    slippageToleranceType: 'number',
2026-02-04T15:21:37.867875209Z [inf]    deadline: 1770219097,
2026-02-04T15:21:37.867879141Z [inf]    deadlineType: 'number',
2026-02-04T15:21:37.867887183Z [inf]    allBodyKeys: [
2026-02-04T15:21:37.867890766Z [inf]      'routeSummary',
2026-02-04T15:21:37.867894037Z [inf]      'sender',
2026-02-04T15:21:37.867897060Z [inf]      'recipient',
2026-02-04T15:21:37.867900240Z [inf]      'origin',
2026-02-04T15:21:37.867903439Z [inf]      'slippageTolerance',
2026-02-04T15:21:37.867909083Z [inf]      'deadline'
2026-02-04T15:21:37.867914977Z [inf]    ]
2026-02-04T15:21:37.867915077Z [inf]  [Kyber] routes response {
2026-02-04T15:21:37.867920181Z [inf]  }
2026-02-04T15:21:37.867920293Z [inf]    status: 200,
2026-02-04T15:21:37.867924178Z [inf]    hasData: true,
2026-02-04T15:21:37.867926995Z [inf]    keys: [ 'code', 'message', 'data', 'requestId' ]
2026-02-04T15:21:37.867929737Z [inf]  }
2026-02-04T15:21:37.867932567Z [inf]  [Kyber] Building route/build request body: {
2026-02-04T15:21:37.867935415Z [inf]    hasRouteSummary: true,
2026-02-04T15:21:37.867938129Z [inf]    routeSummaryKeys: [
2026-02-04T15:21:37.867940995Z [inf]      'tokenIn',
2026-02-04T15:21:37.867943930Z [inf]      'amountIn',
2026-02-04T15:21:37.867946687Z [inf]      'amountInUsd',
2026-02-04T15:21:37.867949367Z [inf]      'tokenOut',
2026-02-04T15:21:37.867952102Z [inf]      'amountOut',
2026-02-04T15:21:37.867955630Z [inf]      'amountOutUsd',
2026-02-04T15:21:37.867958630Z [inf]      'gas',
2026-02-04T15:21:37.867961340Z [inf]      'gasPrice'
2026-02-04T15:21:37.867964041Z [inf]    ],
2026-02-04T15:21:37.867967341Z [inf]    sender: '0xFB64Ce8d',
2026-02-04T15:21:38.995733148Z [wrn]  [DirectSwap] Reference quote timeout
2026-02-04T15:21:39.019525714Z [wrn]  [DirectSwap] No reference quote available
2026-02-04T15:21:39.019530436Z [inf]  [DirectSwap] Finished
2026-02-04T15:21:39.019534115Z [wrn]  [MainSwapService][1770218494198_pm84k9] Direct swap failed, falling back to 0x/Kyber: No valid reference price (0x/Kyber/Gecko)
2026-02-04T15:21:39.019537099Z [inf]  Initiating Unified Swap Execution
2026-02-04T15:21:39.055079490Z [wrn]  All API liquidity sources failed
2026-02-04T15:21:40.031948234Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:21:40.031951950Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:21:40.031954924Z [err]  Critical: No valid price data available
2026-02-04T15:21:40.054814841Z [wrn]  All API liquidity sources failed
2026-02-04T15:21:40.059989018Z [inf]  [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
2026-02-04T15:21:40.059994820Z [inf]  Fetching premium trending tokens
2026-02-04T15:21:40.087907274Z [err]  DexScreener WS: Connection error
2026-02-04T15:21:40.556208751Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:21:40.556214393Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:21:40.556217893Z [err]  Critical: No valid price data available
2026-02-04T15:21:41.523684415Z [err]  Alchemy Portfolio EVM API error
2026-02-04T15:21:41.916200324Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T15:21:41.916206072Z [inf]  [PlatformFee] Fees ENABLED: { context: 'copyTrade', bps: 100, evmRecipient: '0xc5377e6329' }
2026-02-04T15:21:42.006034426Z [inf]  No token metadata available, trying RPC fallback...
2026-02-04T15:21:42.006038639Z [inf]  Using 0x API fallback token metadata
2026-02-04T15:21:42.088192064Z [inf]  Using 0x API fallback token metadata
2026-02-04T15:21:42.230691858Z [inf]  Using 0x API fallback token metadata
2026-02-04T15:21:42.291418644Z [inf]  0x API price received successfully
2026-02-04T15:21:42.471634231Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:21:42.472838103Z [inf]  [PlatformFee] Fees ENABLED: { context: 'copyTrade', bps: 100, evmRecipient: '0xc5377e6329' }
2026-02-04T15:21:42.472842795Z [inf]  [Kyber] GET routes {
2026-02-04T15:21:42.472847010Z [inf]    routesUrl: 'https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&tokenOut=0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07&amountIn=4592349121853444&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B&feeReceiver=0xc5377e6329770Be29Ef938d8aCC11f22398D7E54&feeAmount=100&isInBps=true&chargeFeeBy=currency_in'
2026-02-04T15:21:42.472851138Z [inf]  }
2026-02-04T15:21:42.951370355Z [inf]  [QuoteService] 0x API estimatedPriceImpact: {
2026-02-04T15:21:42.951370497Z [inf]      'amountInUsd',
2026-02-04T15:21:42.951377396Z [inf]      'tokenOut',
2026-02-04T15:21:42.951383469Z [inf]    status: 200,
2026-02-04T15:21:42.951387509Z [inf]    keys: [ 'code', 'message', 'data', 'requestId' ]
2026-02-04T15:21:42.951389837Z [inf]    raw: undefined,
2026-02-04T15:21:42.951392163Z [inf]    hasData: true,
2026-02-04T15:21:42.951394838Z [inf]  }
2026-02-04T15:21:42.951404851Z [inf]  0x API Quote received successfully
2026-02-04T15:21:42.951410729Z [inf]  [Kyber] Building route/build request body: {
2026-02-04T15:21:42.951412048Z [inf]    willUse: 0
2026-02-04T15:21:42.951414700Z [inf]  [Kyber] routes response {
2026-02-04T15:21:42.951417176Z [inf]    hasRouteSummary: true,
2026-02-04T15:21:42.951420700Z [inf]  }
2026-02-04T15:21:42.951423478Z [inf]  0x API Quote successful
2026-02-04T15:21:42.951425994Z [inf]    parsed: 0,
2026-02-04T15:21:42.951426389Z [inf]    routeSummaryKeys: [
2026-02-04T15:21:42.951432563Z [inf]      'tokenIn',
2026-02-04T15:21:42.951434418Z [inf]    multipliedBy100: 0,
2026-02-04T15:21:42.951437603Z [inf]      'amountIn',
2026-02-04T15:21:42.951442267Z [inf]    impactVsMkt: null,
2026-02-04T15:21:42.951890406Z [inf]      'amountOut',
2026-02-04T15:21:42.951890809Z [inf]      'slippageTolerance',
2026-02-04T15:21:42.951894406Z [inf]      'amountOutUsd',
2026-02-04T15:21:42.951899619Z [inf]      'gas',
2026-02-04T15:21:42.951899871Z [inf]      'deadline'
2026-02-04T15:21:42.951903688Z [inf]      'gasPrice'
2026-02-04T15:21:42.951907275Z [inf]    ]
2026-02-04T15:21:42.951908833Z [inf]    ],
2026-02-04T15:21:42.951914076Z [inf]    sender: '0xFB64Ce8d',
2026-02-04T15:21:42.951916101Z [inf]  }
2026-02-04T15:21:42.951918749Z [inf]    recipient: '0xFB64Ce8d',
2026-02-04T15:21:42.951923629Z [inf]    slippageTolerance: 1500,
2026-02-04T15:21:42.951927672Z [inf]    slippageToleranceType: 'number',
2026-02-04T15:21:42.951930715Z [inf]    deadline: 1770219102,
2026-02-04T15:21:42.951944256Z [inf]    deadlineType: 'number',
2026-02-04T15:21:42.951947975Z [inf]    allBodyKeys: [
2026-02-04T15:21:42.951951865Z [inf]      'routeSummary',
2026-02-04T15:21:42.951956161Z [inf]      'sender',
2026-02-04T15:21:42.951961415Z [inf]      'recipient',
2026-02-04T15:21:42.951964871Z [inf]      'origin',
2026-02-04T15:21:43.574062025Z [err]  DexScreener WS: Connection error
2026-02-04T15:21:43.785276415Z [err]  DexScreener WS: Connection error
2026-02-04T15:21:44.252104374Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:21:44.274130360Z [inf]  📊 Position P/L check
2026-02-04T15:21:46.490267091Z [inf]  incoming request
2026-02-04T15:21:46.490271268Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_7vidubxginq2zmuf","createdAt":"2026-02-04T15:21:46.312Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07","blockNum":"0x27c8393","hash":"0x1a94b6e969d6f917cd52bbbc088a5ae297cabd694d4e558a02f00b37f85fdb47","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x69836409"}],"source":"chainlake-kafka"}}
2026-02-04T15:21:46.490274479Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:21:46.490278026Z [inf]  request completed
2026-02-04T15:21:46.490282067Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x1a94b6
2026-02-04T15:21:46.506542485Z [inf]  [Profile] fetchReceipt
2026-02-04T15:21:46.603404396Z [inf]  [Profile] fetchTransaction
2026-02-04T15:21:47.021165937Z [inf]  [Profile] fetchReceipt
2026-02-04T15:21:47.130765447Z [inf]  [Profile] fetchTransaction
2026-02-04T15:21:47.952911577Z [inf]  [Profile] fetchReceipt
2026-02-04T15:21:48.052681307Z [inf]  [Profile] fetchTransaction
2026-02-04T15:21:48.052685480Z [err]  [Webhook] Could not fetch tx/receipt after retries: 0x1a94b6e969d6f9 { txMissing: true, receiptMissing: false, attempts: 3 }
2026-02-04T15:21:49.402350600Z [inf]      'recipient',
2026-02-04T15:21:49.402351378Z [inf]  }
2026-02-04T15:21:49.402358930Z [inf]      'origin',
2026-02-04T15:21:49.402363396Z [inf]      'slippageTolerance',
2026-02-04T15:21:49.402369824Z [inf]      'deadline'
2026-02-04T15:21:49.402372524Z [inf]      'amountInUsd',
2026-02-04T15:21:49.402376479Z [inf]    ]
2026-02-04T15:21:49.402380274Z [inf]      'tokenOut',
2026-02-04T15:21:49.402384677Z [inf]      'amountOut',
2026-02-04T15:21:49.402390398Z [inf]  [Kyber] routes response {
2026-02-04T15:21:49.402390657Z [inf]      'amountOutUsd',
2026-02-04T15:21:49.402397420Z [inf]    status: 200,
2026-02-04T15:21:49.402400032Z [inf]      'gas',
2026-02-04T15:21:49.402401302Z [inf]    hasData: true,
2026-02-04T15:21:49.402405992Z [inf]      'gasPrice'
2026-02-04T15:21:49.402406904Z [inf]    keys: [ 'code', 'message', 'data', 'requestId' ]
2026-02-04T15:21:49.402411848Z [inf]    ],
2026-02-04T15:21:49.402411982Z [inf]  }
2026-02-04T15:21:49.402418552Z [inf]  [Kyber] Building route/build request body: {
2026-02-04T15:21:49.402418713Z [inf]    sender: '0xFB64Ce8d',
2026-02-04T15:21:49.402425840Z [inf]    hasRouteSummary: true,
2026-02-04T15:21:49.402426152Z [inf]    recipient: '0xFB64Ce8d',
2026-02-04T15:21:49.402431926Z [inf]    routeSummaryKeys: [
2026-02-04T15:21:49.402432067Z [inf]    slippageTolerance: 1500,
2026-02-04T15:21:49.402438588Z [inf]      'tokenIn',
2026-02-04T15:21:49.402438702Z [inf]    slippageToleranceType: 'number',
2026-02-04T15:21:49.402444643Z [inf]    deadline: 1770219109,
2026-02-04T15:21:49.402444780Z [inf]      'amountIn',
2026-02-04T15:21:49.402449265Z [inf]    deadlineType: 'number',
2026-02-04T15:21:49.402454498Z [inf]    allBodyKeys: [
2026-02-04T15:21:49.402457811Z [inf]      'routeSummary',
2026-02-04T15:21:49.402461099Z [inf]      'sender',
2026-02-04T15:21:49.731680116Z [inf]  [QuoteService] Quote comparison: {
2026-02-04T15:21:49.731683039Z [inf]    '0x_amount': '20494904.043400602176493',
2026-02-04T15:21:49.731686569Z [inf]    kyber_amount: '16097704.604559239068778496',
2026-02-04T15:21:49.731689465Z [inf]    kyber_advantage_pct: '21.00',
2026-02-04T15:21:49.731692543Z [inf]    chainId: 8453
2026-02-04T15:21:49.731695201Z [inf]  }
2026-02-04T15:21:49.731698112Z [inf]  [QuoteService] Preferring 0x for reliability { reason: '0x has better price', percentDiff: '21.00' }
2026-02-04T15:21:49.731701281Z [inf]  Checking approval for swap
2026-02-04T15:21:49.731704006Z [inf]  Approval not needed or already set
2026-02-04T15:21:49.731707913Z [inf]  [SwapExecutor] Executing 0x Aggregator swap on chain 8453
2026-02-04T15:21:49.731710652Z [inf]  [SwapExecutor] ========== TRANSACTION EXECUTION ==========
2026-02-04T15:21:49.731714710Z [inf]  [SwapExecutor] DEX: 0x Aggregator
2026-02-04T15:21:49.731717660Z [inf]  [SwapExecutor] Transaction params: {
2026-02-04T15:21:49.731720564Z [inf]    to: '0x0000000000001ff3684f28c67538d4d072c22734',
2026-02-04T15:21:49.731723576Z [inf]    dataLength: 4618,
2026-02-04T15:21:49.731726265Z [inf]    dataPrefix: '0x2213bc0b000000000000000000000000dc5d8200a030798bc6227240f68b4dd9',
2026-02-04T15:21:49.731729118Z [inf]    value: '4592349121853444',
2026-02-04T15:21:49.732661811Z [inf]    router: '0x0000000000001ff3684f28c67538d4d072c22734',
2026-02-04T15:21:49.732671838Z [inf]    allowanceTarget: '0x0000000000001ff3684f28c67538d4d072c22734'
2026-02-04T15:21:49.732675453Z [inf]  }
2026-02-04T15:21:49.732678678Z [inf]  [SwapExecutor] Swap details: {
2026-02-04T15:21:49.732682060Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-04T15:21:49.732685647Z [inf]    tokenOut: '0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07',
2026-02-04T15:21:49.732689218Z [inf]    amountInBase: '4592349121853444',
2026-02-04T15:21:49.732692488Z [inf]    amountInHuman: '0.004592349121853444',
2026-02-04T15:21:49.732697514Z [inf]    amountOut: '20494904.043400602176493',
2026-02-04T15:21:49.732700666Z [inf]    slippageBps: 1500,
2026-02-04T15:21:49.732703607Z [inf]    priceImpact: 0,
2026-02-04T15:21:49.732706538Z [inf]    gasEstimate: 753663
2026-02-04T15:21:49.732709574Z [inf]  }
2026-02-04T15:21:49.732712679Z [inf]  [SwapExecutor] =============================================
2026-02-04T15:21:50.072471469Z [inf]  [SwapExecutor] Execution params prepared: {
2026-02-04T15:21:50.072476194Z [inf]    dex: '0x Aggregator',
2026-02-04T15:21:50.072481068Z [inf]    gasEstimate: 753663,
2026-02-04T15:21:50.072484353Z [inf]    gasLimit: '1130494',
2026-02-04T15:21:50.072488097Z [inf]    maxFeePerGas: '44504728',
2026-02-04T15:21:50.072491426Z [inf]    maxPriorityFeePerGas: '1000000'
2026-02-04T15:21:50.072494115Z [inf]  }
2026-02-04T15:21:50.072497153Z [inf]  🚀 CopyTrade Aggressive Gas
2026-02-04T15:21:50.072500025Z [inf]  PrivyWallet Authorization Key config
2026-02-04T15:21:50.306429926Z [inf]  [sendTransaction] ========== PRIVY TX PARAMS ==========
2026-02-04T15:21:50.306433293Z [inf]  [sendTransaction] From: 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T15:21:50.306436330Z [inf]  [sendTransaction] To: 0x0000000000001ff3684f28c67538d4d072c22734
2026-02-04T15:21:50.306439169Z [inf]  [sendTransaction] Value: 4592349121853444
2026-02-04T15:21:50.306441977Z [inf]  [sendTransaction] ValueHex: 0x1050b79a17b804
2026-02-04T15:21:50.306445026Z [inf]  [sendTransaction] Data length: 4618
2026-02-04T15:21:50.306447675Z [inf]  [sendTransaction] Data (full): 0x2213bc0b000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001050b79a17b804000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef00000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000008241fff991f000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b0000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b070000000000000000000000000000000000000000000e68f8540996ccccff18ea00000000000000000000000000000000000000000000000000000000000000a0264b1216bade97ce3cc9cbea0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000000000000000000000000000000000380000000000000000000000000000000000000000000000000000000000000054000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000044bd01c2260000000000000000000000000000000000000000000000000000000069836532000000000000000000000000000000000000000000000000001050b79a17b8040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee000000000000000000000000000000000000000000000000000000000000000f000000000000000000000000ad01c20d5886137e056775af56915de824c8fce5000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000000000000000000000000000000000000000027100000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000024d0e30db0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000184af72634f000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef0000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000ffffffffffffffc50000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000482710fffd8963efd1fc6a506488495d951d5263988d25012fc3dd4dacfd1b2fabac157de8727b54bade4b078000000000c8b429d62f8f3bffb98cdb9569533ea23bf0ba28cc00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008434ee90ca000000000000000000000000f5c4f3dc02c3fb9279495a8fef7b0741da9561570000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b0700000000000000000000000000000000000000000011209f24f1422d5c4e4742000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012438c9c1470000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b0700000000000000000000000000000000000000000000000000000000000000640000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b07000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000c5377e6329770be29ef938d8acc11f22398d7e540000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
2026-02-04T15:21:50.307265685Z [inf]  [sendTransaction] ChainId: 8453
2026-02-04T15:21:50.307275051Z [inf]  [sendTransaction] Gas: 1130494
2026-02-04T15:21:50.307280207Z [inf]  [sendTransaction] MaxFeePerGas: 53504728
2026-02-04T15:21:50.307285214Z [inf]  [sendTransaction] MaxPriorityFeePerGas: 10000000
2026-02-04T15:21:50.307289872Z [inf]  [sendTransaction] Full TX object: {
2026-02-04T15:21:50.307294643Z [inf]    to: '0x0000000000001ff3684f28c67538d4d072c22734',
2026-02-04T15:21:50.307298685Z [inf]    data: '0x2213bc0b000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001050b79a17b804000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef00000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000008241fff991f000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b0000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b070000000000000000000000000000000000000000000e68f8540996ccccff18ea00000000000000000000000000000000000000000000000000000000000000a0264b1216bade97ce3cc9cbea0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000000000000000000000000000000000380000000000000000000000000000000000000000000000000000000000000054000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000044bd01c2260000000000000000000000000000000000000000000000000000000069836532000000000000000000000000000000000000000000000000001050b79a17b8040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee000000000000000000000000000000000000000000000000000000000000000f000000000000000000000000ad01c20d5886137e056775af56915de824c8fce5000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000000000000000000000000000000000000000027100000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000024d0e30db0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000184af72634f000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef0000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000ffffffffffffffc50000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000482710fffd8963efd1fc6a506488495d951d5263988d25012fc3dd4dacfd1b2fabac157de8727b54bade4b078000000000c8b429d62f8f3bffb98cdb9569533ea23bf0ba28cc00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008434ee90ca000000000000000000000000f5c4f3dc02c3fb9279495a8fef7b0741da9561570000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b0700000000000000000000000000000000000000000011209f24f1422d5c4e4742000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012438c9c1470000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b0700000000000000000000000000000000000000000000000000000000000000640000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b07000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000c5377e6329770be29ef938d8acc11f22398d7e540000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
2026-02-04T15:21:50.307611246Z [inf]    value: '4592349121853444',
2026-02-04T15:21:50.307615896Z [inf]    chainId: 8453,
2026-02-04T15:21:50.307619002Z [inf]    gas: '1130494',
2026-02-04T15:21:50.307621898Z [inf]    maxFeePerGas: '53504728',
2026-02-04T15:21:50.307624590Z [inf]    maxPriorityFeePerGas: '10000000'
2026-02-04T15:21:50.307628312Z [inf]  }
2026-02-04T15:21:50.307631518Z [inf]  [sendTransaction] ===========================================
2026-02-04T15:21:51.581748173Z [inf]  Ethereum transaction sent via Privy
2026-02-04T15:21:51.786822361Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:21:51.786827536Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:21:51.786834236Z [wrn]  WS returned 0 addresses
2026-02-04T15:21:52.141509313Z [inf]  Merged addresses
2026-02-04T15:21:52.582896236Z [inf]  Swap Broadcast
2026-02-04T15:21:52.582901586Z [inf]  [ConfirmWait] Waiting for confirmation: 0x752cf2bcf3f1413d6799a3545caf969728356b479ce589206ef75802d047aade on 8453
2026-02-04T15:21:52.642565017Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:21:52.785593694Z [inf]  Skipping low liquidity token
2026-02-04T15:21:54.358178487Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:21:54.492711983Z [inf]  incoming request
2026-02-04T15:21:54.492715332Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_nj3xnplkr1icq9dx","createdAt":"2026-02-04T15:21:54.163Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","toAddress":"0x0000000000001ff3684f28c67538d4d072c22734","blockNum":"0x27c8397","hash":"0x752cf2bcf3f1413d6799a3545caf969728356b479ce589206ef75802d047aade","value":0.004592349121853444,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x1050b79a17b804","decimals":18},"blockTimestamp":"0x69836411"}],"source":"chainlake-kafka"}}
2026-02-04T15:21:54.492719816Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:21:54.492724264Z [inf]  request completed
2026-02-04T15:21:54.497688478Z [inf]  [Webhook] ⚠️ Ignoring tx 0x752cf2: No matched tracked wallets in [0xfb64, 0x0000]
2026-02-04T15:21:54.749695394Z [inf]  0x API price received successfully
2026-02-04T15:21:54.792582344Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:21:55.183610588Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:21:55.631692702Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:21:56.053416044Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:21:56.075125686Z [inf]  📊 Position P/L check
2026-02-04T15:21:56.207108762Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:21:57.069141330Z [err]  [ConfirmWait] Transaction REVERTED: 0x752cf2bcf3f1413d6799a3545caf969728356b479ce589206ef75802d047aade
2026-02-04T15:21:57.069144185Z [err]  Transaction REVERTED on-chain
2026-02-04T15:21:57.069147112Z [wrn]  Fast failover: switching DEX after on-chain revert
2026-02-04T15:21:57.073991716Z [wrn]  All API liquidity sources failed
2026-02-04T15:21:57.479929939Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:21:57.479935223Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:21:57.479939268Z [err]  Critical: No valid price data available
2026-02-04T15:21:57.502292512Z [wrn]  All API liquidity sources failed
2026-02-04T15:21:57.818060385Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:21:57.818066042Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:21:57.818071994Z [err]  Critical: No valid price data available
2026-02-04T15:21:58.172598389Z [err]  Alchemy Portfolio EVM API error
2026-02-04T15:21:58.223767614Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:21:58.292720848Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T15:21:58.292724052Z [inf]  [PlatformFee] Fees ENABLED: { context: 'copyTrade', bps: 100, evmRecipient: '0xc5377e6329' }
2026-02-04T15:21:58.524427932Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:21:58.554051149Z [inf]  0x API price received successfully
2026-02-04T15:21:58.554054234Z [inf]  [PlatformFee] Fees ENABLED: { context: 'copyTrade', bps: 100, evmRecipient: '0xc5377e6329' }
2026-02-04T15:21:58.554057149Z [inf]  [Kyber] GET routes {
2026-02-04T15:21:58.554059849Z [inf]    routesUrl: 'https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&tokenOut=0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07&amountIn=4592349121853444&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B&feeReceiver=0xc5377e6329770Be29Ef938d8aCC11f22398D7E54&feeAmount=100&isInBps=true&chargeFeeBy=currency_in'
2026-02-04T15:21:58.554062884Z [inf]  }
2026-02-04T15:21:59.017256678Z [inf]    impactVsMkt: null,
2026-02-04T15:21:59.017263597Z [inf]    willUse: 0
2026-02-04T15:21:59.017267571Z [inf]  }
2026-02-04T15:21:59.017332103Z [inf]  0x API Quote received successfully
2026-02-04T15:21:59.017335336Z [inf]  0x API Quote successful
2026-02-04T15:21:59.017338789Z [inf]  [QuoteService] 0x API estimatedPriceImpact: {
2026-02-04T15:21:59.017341969Z [inf]    raw: undefined,
2026-02-04T15:21:59.017345783Z [inf]    parsed: 0,
2026-02-04T15:21:59.017349129Z [inf]    multipliedBy100: 0,
2026-02-04T15:22:02.229866233Z [inf]  }
2026-02-04T15:22:02.229869034Z [inf]      'gas',
2026-02-04T15:22:02.229872545Z [inf]      'deadline'
2026-02-04T15:22:02.229877442Z [inf]      'gasPrice'
2026-02-04T15:22:02.229880115Z [inf]  [Kyber] routes response {
2026-02-04T15:22:02.229883619Z [inf]    ]
2026-02-04T15:22:02.229885618Z [inf]    ],
2026-02-04T15:22:02.229888408Z [inf]    status: 200,
2026-02-04T15:22:02.229891731Z [inf]    sender: '0xFB64Ce8d',
2026-02-04T15:22:02.229895553Z [inf]    hasData: true,
2026-02-04T15:22:02.229899074Z [inf]    recipient: '0xFB64Ce8d',
2026-02-04T15:22:02.229902288Z [inf]      'routeSummary',
2026-02-04T15:22:02.229902730Z [inf]    keys: [ 'code', 'message', 'data', 'requestId' ]
2026-02-04T15:22:02.229906079Z [inf]    slippageTolerance: 1500,
2026-02-04T15:22:02.229910439Z [inf]  }
2026-02-04T15:22:02.229913108Z [inf]      'sender',
2026-02-04T15:22:02.229914323Z [inf]    slippageToleranceType: 'number',
2026-02-04T15:22:02.229920058Z [inf]  [Kyber] Building route/build request body: {
2026-02-04T15:22:02.229921793Z [inf]    deadline: 1770219122,
2026-02-04T15:22:02.229924560Z [inf]    hasRouteSummary: true,
2026-02-04T15:22:02.229927216Z [inf]      'recipient',
2026-02-04T15:22:02.229928733Z [inf]    deadlineType: 'number',
2026-02-04T15:22:02.229931330Z [inf]    routeSummaryKeys: [
2026-02-04T15:22:02.229936255Z [inf]    allBodyKeys: [
2026-02-04T15:22:02.229937808Z [inf]      'tokenIn',
2026-02-04T15:22:02.229938390Z [inf]      'origin',
2026-02-04T15:22:02.229944479Z [inf]      'amountIn',
2026-02-04T15:22:02.229945010Z [inf]      'slippageTolerance',
2026-02-04T15:22:02.229948421Z [inf]      'amountInUsd',
2026-02-04T15:22:02.229952620Z [inf]      'tokenOut',
2026-02-04T15:22:02.229956482Z [inf]      'amountOut',
2026-02-04T15:22:02.229960278Z [inf]      'amountOutUsd',
2026-02-04T15:22:02.722889643Z [err]  Error fetching trending tokens
2026-02-04T15:22:02.722894140Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:22:02.722897283Z [inf]  [TokenJob] Got 45 trending tokens for Base
2026-02-04T15:22:02.744970170Z [err]  [TokenJob] New list too small (45) for Base; keeping existing (71)
2026-02-04T15:22:03.781090145Z [inf]  [QuoteService] Excluding DEX on retry: { excluded: '0x', available: 'kyber' }
2026-02-04T15:22:03.781094516Z [inf]  Checking approval for swap
2026-02-04T15:22:03.781099353Z [inf]  Approval not needed or already set
2026-02-04T15:22:03.781102819Z [inf]  [SwapExecutor] Executing KyberSwap swap on chain 8453
2026-02-04T15:22:03.781107915Z [inf]  [SwapExecutor] ========== TRANSACTION EXECUTION ==========
2026-02-04T15:22:03.781110844Z [inf]  [SwapExecutor] DEX: KyberSwap
2026-02-04T15:22:03.781114024Z [inf]  [SwapExecutor] Transaction params: {
2026-02-04T15:22:03.781117181Z [inf]    to: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
2026-02-04T15:22:03.781120450Z [inf]    dataLength: 7306,
2026-02-04T15:22:03.781125131Z [inf]    dataPrefix: '0xe21fd0e900000000000000000000000000000000000000000000000000000000',
2026-02-04T15:22:03.781130127Z [inf]    value: '4592349121853444',
2026-02-04T15:22:03.781134852Z [inf]    router: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
2026-02-04T15:22:03.781139107Z [inf]    allowanceTarget: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5'
2026-02-04T15:22:03.781143624Z [inf]  }
2026-02-04T15:22:03.781148308Z [inf]  [SwapExecutor] Swap details: {
2026-02-04T15:22:03.781151898Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-04T15:22:03.784882456Z [inf]    tokenOut: '0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07',
2026-02-04T15:22:03.784890478Z [inf]    amountInBase: '4592349121853444',
2026-02-04T15:22:03.784920524Z [inf]    amountInHuman: '0.004592349121853444',
2026-02-04T15:22:03.784925197Z [inf]    amountOut: '14147560.121575065243353088',
2026-02-04T15:22:03.784930058Z [inf]    slippageBps: 1500,
2026-02-04T15:22:03.784935933Z [inf]    priceImpact: 0,
2026-02-04T15:22:03.784940330Z [inf]    gasEstimate: 356167
2026-02-04T15:22:03.784944081Z [inf]  }
2026-02-04T15:22:03.784948932Z [inf]  [SwapExecutor] =============================================
2026-02-04T15:22:03.784952918Z [inf]  [SwapExecutor] ===== KYBER ULTRA DEBUG =====
2026-02-04T15:22:03.784957181Z [inf]  [SwapExecutor] Full calldata: 0xe21fd0e9000000000000000000000000000000000000000000000000000000000000002000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000009200000000000000000000000000000000000000000000000000000000000000b6000000000000000000000000000000000000000000000000000000000000008600000000000000000001026f334b6339e0000000000000000001026f334b6339e000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000041fc35de35e51b4ca2cdc182ab9217e1c3f829df023d8e75dc1871af5786fea69e40292bb91427a8855e59f3349f8ccea1114c02baad5e12ac8e1f28f73502ea7e1b000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000760000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001a00000000000000000000f5833d879e43c00000000000000000010f5b290f283000000000000000000001026f334b6339e00000000000bb3dcc55d927c80000000000000000000000000000000000000c4563af93cf6c69b0000000f42400000000000000000000000000000004f82e73edb06d29ff62c91ec8f5ff06571bdeb29000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000698366720000000000000000000000000000000000000000000000000000000000000740000000000000000000000000000000000000000000000000000000000000000261f598cd0000000000000000768d1c7ba0a48f026a8d35ba2cb86c7ef562e39d91dd73460000000000000000768d1c7ba0a48f026a8d35ba2cb86c7ef562e39d0000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000500000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee8000000000000000000000010efcf31e0000000000000000001026f334b6339e000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000001026f334b6339e000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000042000000000000000000000000000000000000068000000000000000000000010efcf31e0000000000000000001026f334b6339e000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000001026f334b6339e736e774d0000000000000002d1877a31a73c7cb31c02b9e7d7c336531562b21e000000000000000000000000000000000000000000000000000000000000008000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb00000000000000000000000000000000000000000000000000000000000000220000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000001026f334b6339e0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b07000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000c8000000000000000000000000b429d62f8f3bffb98cdb9569533ea23bf0ba28cc00000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000a27f09a5ceadaf553b3ca500000000000000000000000000000000000000000000000000000000000000000000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b078000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b070000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000001e0000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b000000000000000000000000000000000000000000000000001050b79a17b80400000000000000000000000000000000000000000009f27ba7c2bc836ccccccb00000000000000000000000000000000000000000000000000000000000002800000000000000000000000000000000000000000000000000000000000000220000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000c5377e6329770be29ef938d8acc11f22398d7e54000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000028e7b22536f75726365223a226b696b6f2d617070222c22416d6f756e74496e555344223a22392e393334383036323534323739383534222c22416d6f756e744f7574555344223a2231332e313532353430313030363432353032222c22526566657272616c223a22222c22466c616773223a302c22416d6f756e744f7574223a223134313437353630313231353735303635323433333533303837222c2254696d657374616d70223a313737303231383532332c22526f7574654944223a2262396362316434392d363061652d343736342d623863392d6661373434653639643639303a30616161376537352d306539662d343330632d386639312d343131616164366337316434222c22496e74656772697479496e666f223a7b224b65794944223a2231222c225369676e6174757265223a2256667273784d614632773450587a38496e69426a6c774f2b3952495079337254787861386a4c78614161513479364d467649527062766d78626c41386a5033567a644c7438327658466762374952745770536e5679686d733370514277526243662b47724e2b35717a534955644e74647753336645435935655a3249737579652b596a4e3654363959486c512f614f42336a6b786b7259706f58734c674c674246456873767a364e56375379353476676a704339772b476a767a676b6b334c2f3769634458387a522b745347545663365633496455495737753156783372684267586d6566774145535a50592b3974746a41506d314b53626f6b54325a677678474a5a435141643467773075666a37616e46446e63386f4e6f72656550774b4e6465746c6247303865735979526e3055524344453754684275674633313341776958593664327a4a5a54774d684d57656141327667413d3d227d7d000000000000000000000000000000000000
2026-02-04T15:22:03.784961562Z [inf]  [SwapExecutor] Calldata length: 7306
2026-02-04T15:22:03.784965733Z [inf]  [SwapExecutor] Build response (full best): {
2026-02-04T15:22:03.784970403Z [inf]    dex: 'kyber',
2026-02-04T15:22:03.784974698Z [inf]    dexName: 'KyberSwap',
2026-02-04T15:22:03.784979578Z [inf]    amountOut: '14147560.121575065243353088',
2026-02-04T15:22:03.784983381Z [inf]    amountOutBase: '14147560121575065243353088',
2026-02-04T15:22:03.784987172Z [inf]    gasEstimate: 356167,
2026-02-04T15:22:03.784991210Z [inf]    priceImpact: 0,
2026-02-04T15:22:03.784995632Z [inf]    priceImpactVsMkt: null,
2026-02-04T15:22:03.785000024Z [inf]    path: [
2026-02-04T15:22:03.785003875Z [inf]      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-04T15:22:03.785008006Z [inf]      '0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07'
2026-02-04T15:22:03.785015450Z [inf]    ],
2026-02-04T15:22:03.785018927Z [inf]    router: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
2026-02-04T15:22:03.785023034Z [inf]    data: '0xe21fd0e9000000000000000000000000000000000000000000000000000000000000002000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000009200000000000000000000000000000000000000000000000000000000000000b6000000000000000000000000000000000000000000000000000000000000008600000000000000000001026f334b6339e0000000000000000001026f334b6339e000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000041fc35de35e51b4ca2cdc182ab9217e1c3f829df023d8e75dc1871af5786fea69e40292bb91427a8855e59f3349f8ccea1114c02baad5e12ac8e1f28f73502ea7e1b000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000760000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001a00000000000000000000f5833d879e43c00000000000000000010f5b290f283000000000000000000001026f334b6339e00000000000bb3dcc55d927c80000000000000000000000000000000000000c4563af93cf6c69b0000000f42400000000000000000000000000000004f82e73edb06d29ff62c91ec8f5ff06571bdeb29000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000698366720000000000000000000000000000000000000000000000000000000000000740000000000000000000000000000000000000000000000000000000000000000261f598cd0000000000000000768d1c7ba0a48f026a8d35ba2cb86c7ef562e39d91dd73460000000000000000768d1c7ba0a48f026a8d35ba2cb86c7ef562e39d0000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000500000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee8000000000000000000000010efcf31e0000000000000000001026f334b6339e000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000001026f334b6339e000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000042000000000000000000000000000000000000068000000000000000000000010efcf31e0000000000000000001026f334b6339e000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000001026f334b6339e736e774d0000000000000002d1877a31a73c7cb31c02b9e7d7c336531562b21e000000000000000000000000000000000000000000000000000000000000008000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb00000000000000000000000000000000000000000000000000000000000000220000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000001026f334b6339e0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b07000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000c8000000000000000000000000b429d62f8f3bffb98cdb9569533ea23bf0ba28cc00000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000a27f09a5ceadaf553b3ca500000000000000000000000000000000000000000000000000000000000000000000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b078000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b070000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000001e0000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b000000000000000000000000000000000000000000000000001050b79a17b80400000000000000000000000000000000000000000009f27ba7c2bc836ccccccb00000000000000000000000000000000000000000000000000000000000002800000000000000000000000000000000000000000000000000000000000000220000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000c5377e6329770be29ef938d8acc11f22398d7e54000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000028e7b22536f75726365223a226b696b6f2d617070222c22416d6f756e74496e555344223a22392e393334383036323534323739383534222c22416d6f756e744f7574555344223a2231332e313532353430313030363432353032222c22526566657272616c223a22222c22466c616773223a302c22416d6f756e744f7574223a223134313437353630313231353735303635323433333533303837222c2254696d657374616d70223a313737303231383532332c22526f7574654944223a2262396362316434392d363061652d343736342d623863392d6661373434653639643639303a30616161376537352d306539662d343330632d386639312d343131616164366337316434222c22496e74656772697479496e666f223a7b224b65794944223a2231222c225369676e6174757265223a2256667273784d614632773450587a38496e69426a6c774f2b3952495079337254787861386a4c78614161513479364d467649527062766d78626c41386a5033567a644c7438327658466762374952745770536e5679686d733370514277526243662b47724e2b35717a534955644e74647753336645435935655a3249737579652b596a4e3654363959486c512f614f42336a6b786b7259706f58734c674c674246456873767a364e56375379353476676a704339772b476a767a676b6b334c2f3769634458387a522b745347545663365633496455495737753156783372684267586d6566774145535a50592b3974746a41506d314b53626f6b54325a677678474a5a435141643467773075666a37616e46446e63386f4e6f72656550774b4e6465746c6247303865735979526e3055524344453754684275674633313341776958593664327a4a5a54774d684d57656141327667413d3d227d7d000000000000000000000000000000000000',
2026-02-04T15:22:03.785026968Z [inf]    to: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
2026-02-04T15:22:03.785030861Z [inf]    value: '4592349121853444',
2026-02-04T15:22:03.785034736Z [inf]    allowanceTarget: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
2026-02-04T15:22:03.785039305Z [inf]    deadline: 1770219123,
2026-02-04T15:22:03.785043064Z [inf]    tokenInDecimals: 18,
2026-02-04T15:22:03.785047287Z [inf]    tokenOutDecimals: 18
2026-02-04T15:22:03.785050852Z [inf]  }
2026-02-04T15:22:03.785054982Z [inf]  [SwapExecutor] ===========================
2026-02-04T15:22:04.039153335Z [inf]  [SwapExecutor] Execution params prepared: {
2026-02-04T15:22:04.039156412Z [inf]    dex: 'KyberSwap',
2026-02-04T15:22:04.039159266Z [inf]    gasEstimate: 356167,
2026-02-04T15:22:04.039162537Z [inf]    gasLimit: '534250',
2026-02-04T15:22:04.039165628Z [inf]    maxFeePerGas: '44504728',
2026-02-04T15:22:04.039168597Z [inf]    maxPriorityFeePerGas: '1000000'
2026-02-04T15:22:04.039171567Z [inf]  }
2026-02-04T15:22:04.039174519Z [inf]  🚀 CopyTrade Aggressive Gas
2026-02-04T15:22:04.133264204Z [inf]  [sendTransaction] ========== PRIVY TX PARAMS ==========
2026-02-04T15:22:04.133271647Z [inf]  [sendTransaction] From: 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T15:22:04.133277677Z [inf]  [sendTransaction] To: 0x6131B5fae19EA4f9D964eAc0408E4408b66337b5
2026-02-04T15:22:04.133284579Z [inf]  [sendTransaction] Value: 4592349121853444
2026-02-04T15:22:04.133292665Z [inf]  [sendTransaction] ValueHex: 0x1050b79a17b804
2026-02-04T15:22:04.133299165Z [inf]  [sendTransaction] Data length: 7306
2026-02-04T15:22:04.133303869Z [inf]  [sendTransaction] Data (full): 0xe21fd0e9000000000000000000000000000000000000000000000000000000000000002000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000009200000000000000000000000000000000000000000000000000000000000000b6000000000000000000000000000000000000000000000000000000000000008600000000000000000001026f334b6339e0000000000000000001026f334b6339e000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000041fc35de35e51b4ca2cdc182ab9217e1c3f829df023d8e75dc1871af5786fea69e40292bb91427a8855e59f3349f8ccea1114c02baad5e12ac8e1f28f73502ea7e1b000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000760000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001a00000000000000000000f5833d879e43c00000000000000000010f5b290f283000000000000000000001026f334b6339e00000000000bb3dcc55d927c80000000000000000000000000000000000000c4563af93cf6c69b0000000f42400000000000000000000000000000004f82e73edb06d29ff62c91ec8f5ff06571bdeb29000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000698366720000000000000000000000000000000000000000000000000000000000000740000000000000000000000000000000000000000000000000000000000000000261f598cd0000000000000000768d1c7ba0a48f026a8d35ba2cb86c7ef562e39d91dd73460000000000000000768d1c7ba0a48f026a8d35ba2cb86c7ef562e39d0000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000500000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee8000000000000000000000010efcf31e0000000000000000001026f334b6339e000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000001026f334b6339e000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000042000000000000000000000000000000000000068000000000000000000000010efcf31e0000000000000000001026f334b6339e000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000001026f334b6339e736e774d0000000000000002d1877a31a73c7cb31c02b9e7d7c336531562b21e000000000000000000000000000000000000000000000000000000000000008000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb00000000000000000000000000000000000000000000000000000000000000220000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000001026f334b6339e0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b07000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000c8000000000000000000000000b429d62f8f3bffb98cdb9569533ea23bf0ba28cc00000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000a27f09a5ceadaf553b3ca500000000000000000000000000000000000000000000000000000000000000000000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b078000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b070000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000001e0000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b000000000000000000000000000000000000000000000000001050b79a17b80400000000000000000000000000000000000000000009f27ba7c2bc836ccccccb00000000000000000000000000000000000000000000000000000000000002800000000000000000000000000000000000000000000000000000000000000220000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000c5377e6329770be29ef938d8acc11f22398d7e54000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000028e7b22536f75726365223a226b696b6f2d617070222c22416d6f756e74496e555344223a22392e393334383036323534323739383534222c22416d6f756e744f7574555344223a2231332e313532353430313030363432353032222c22526566657272616c223a22222c22466c616773223a302c22416d6f756e744f7574223a223134313437353630313231353735303635323433333533303837222c2254696d657374616d70223a313737303231383532332c22526f7574654944223a2262396362316434392d363061652d343736342d623863392d6661373434653639643639303a30616161376537352d306539662d343330632d386639312d343131616164366337316434222c22496e74656772697479496e666f223a7b224b65794944223a2231222c225369676e6174757265223a2256667273784d614632773450587a38496e69426a6c774f2b3952495079337254787861386a4c78614161513479364d467649527062766d78626c41386a5033567a644c7438327658466762374952745770536e5679686d733370514277526243662b47724e2b35717a534955644e74647753336645435935655a3249737579652b596a4e3654363959486c512f614f42336a6b786b7259706f58734c674c674246456873767a364e56375379353476676a704339772b476a767a676b6b334c2f3769634458387a522b745347545663365633496455495737753156783372684267586d6566774145535a50592b3974746a41506d314b53626f6b54325a677678474a5a435141643467773075666a37616e46446e63386f4e6f72656550774b4e6465746c6247303865735979526e3055524344453754684275674633313341776958593664327a4a5a54774d684d57656141327667413d3d227d7d000000000000000000000000000000000000
2026-02-04T15:22:04.140287194Z [inf]  [sendTransaction] ChainId: 8453
2026-02-04T15:22:04.140334449Z [inf]  [sendTransaction] Gas: 534250
2026-02-04T15:22:04.140339931Z [inf]  [sendTransaction] MaxFeePerGas: 53504728
2026-02-04T15:22:04.140345795Z [inf]  [sendTransaction] MaxPriorityFeePerGas: 10000000
2026-02-04T15:22:04.140349886Z [inf]  [sendTransaction] Full TX object: {
2026-02-04T15:22:04.140354791Z [inf]    to: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
2026-02-04T15:22:04.140358889Z [inf]    data: '0xe21fd0e9000000000000000000000000000000000000000000000000000000000000002000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000009200000000000000000000000000000000000000000000000000000000000000b6000000000000000000000000000000000000000000000000000000000000008600000000000000000001026f334b6339e0000000000000000001026f334b6339e000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000041fc35de35e51b4ca2cdc182ab9217e1c3f829df023d8e75dc1871af5786fea69e40292bb91427a8855e59f3349f8ccea1114c02baad5e12ac8e1f28f73502ea7e1b000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000760000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001a00000000000000000000f5833d879e43c00000000000000000010f5b290f283000000000000000000001026f334b6339e00000000000bb3dcc55d927c80000000000000000000000000000000000000c4563af93cf6c69b0000000f42400000000000000000000000000000004f82e73edb06d29ff62c91ec8f5ff06571bdeb29000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000698366720000000000000000000000000000000000000000000000000000000000000740000000000000000000000000000000000000000000000000000000000000000261f598cd0000000000000000768d1c7ba0a48f026a8d35ba2cb86c7ef562e39d91dd73460000000000000000768d1c7ba0a48f026a8d35ba2cb86c7ef562e39d0000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000500000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee8000000000000000000000010efcf31e0000000000000000001026f334b6339e000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000001026f334b6339e000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000042000000000000000000000000000000000000068000000000000000000000010efcf31e0000000000000000001026f334b6339e000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000001026f334b6339e736e774d0000000000000002d1877a31a73c7cb31c02b9e7d7c336531562b21e000000000000000000000000000000000000000000000000000000000000008000000000000000000000000063242a4ea82847b20e506b63b0e2e2eff0cc6cb00000000000000000000000000000000000000000000000000000000000000220000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000001026f334b6339e0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b07000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000c8000000000000000000000000b429d62f8f3bffb98cdb9569533ea23bf0ba28cc00000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000a27f09a5ceadaf553b3ca500000000000000000000000000000000000000000000000000000000000000000000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b078000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b070000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000001e0000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b000000000000000000000000000000000000000000000000001050b79a17b80400000000000000000000000000000000000000000009f27ba7c2bc836ccccccb00000000000000000000000000000000000000000000000000000000000002800000000000000000000000000000000000000000000000000000000000000220000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000c5377e6329770be29ef938d8acc11f22398d7e54000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000028e7b22536f75726365223a226b696b6f2d617070222c22416d6f756e74496e555344223a22392e393334383036323534323739383534222c22416d6f756e744f7574555344223a2231332e313532353430313030363432353032222c22526566657272616c223a22222c22466c616773223a302c22416d6f756e744f7574223a223134313437353630313231353735303635323433333533303837222c2254696d657374616d70223a313737303231383532332c22526f7574654944223a2262396362316434392d363061652d343736342d623863392d6661373434653639643639303a30616161376537352d306539662d343330632d386639312d343131616164366337316434222c22496e74656772697479496e666f223a7b224b65794944223a2231222c225369676e6174757265223a2256667273784d614632773450587a38496e69426a6c774f2b3952495079337254787861386a4c78614161513479364d467649527062766d78626c41386a5033567a644c7438327658466762374952745770536e5679686d733370514277526243662b47724e2b35717a534955644e74647753336645435935655a3249737579652b596a4e3654363959486c512f614f42336a6b786b7259706f58734c674c674246456873767a364e56375379353476676a704339772b476a767a676b6b334c2f3769634458387a522b745347545663365633496455495737753156783372684267586d6566774145535a50592b3974746a41506d314b53626f6b54325a677678474a5a435141643467773075666a37616e46446e63386f4e6f72656550774b4e6465746c6247303865735979526e3055524344453754684275674633313341776958593664327a4a5a54774d684d57656141327667413d3d227d7d000000000000000000000000000000000000',
2026-02-04T15:22:04.141084295Z [inf]    value: '4592349121853444',
2026-02-04T15:22:04.141089131Z [inf]    chainId: 8453,
2026-02-04T15:22:04.141092312Z [inf]    gas: '534250',
2026-02-04T15:22:04.141095604Z [inf]    maxFeePerGas: '53504728',
2026-02-04T15:22:04.141099923Z [inf]    maxPriorityFeePerGas: '10000000'
2026-02-04T15:22:04.141103240Z [inf]  }
2026-02-04T15:22:04.141106519Z [inf]  [sendTransaction] ===========================================
2026-02-04T15:22:05.132219315Z [inf]  Ethereum transaction sent via Privy
2026-02-04T15:22:06.086246840Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:22:06.131898889Z [inf]  📊 Position P/L check
2026-02-04T15:22:06.131904336Z [inf]  Swap Broadcast
2026-02-04T15:22:06.131908376Z [inf]  [ConfirmWait] Waiting for confirmation: 0x024310bccdc8788803319492255b97daf22d80e05a930095a105323b9fc352a7 on 8453
2026-02-04T15:22:06.172823812Z [err]  [ConfirmWait] Transaction REVERTED: 0x024310bccdc8788803319492255b97daf22d80e05a930095a105323b9fc352a7
2026-02-04T15:22:06.172828685Z [err]  Transaction REVERTED on-chain
2026-02-04T15:22:06.172832188Z [err]  [MainSwapService][1770218494198_pm84k9] Swap execution failed: Transaction reverted: Return amount is not enough
2026-02-04T15:22:06.172836664Z [wrn]  Buy Step 1 failed
2026-02-04T15:22:06.172842211Z [inf]  Conservative Mode: Checking price stability before retry...
2026-02-04T15:22:06.292182225Z [wrn]  All API liquidity sources failed
2026-02-04T15:22:06.325672355Z [inf]  incoming request
2026-02-04T15:22:06.325678725Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_hukzhskhq4w1ct75","createdAt":"2026-02-04T15:22:06.001Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","toAddress":"0x6131b5fae19ea4f9d964eac0408e4408b66337b5","blockNum":"0x27c839d","hash":"0x024310bccdc8788803319492255b97daf22d80e05a930095a105323b9fc352a7","value":0.004592349121853444,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x1050b79a17b804","decimals":18},"blockTimestamp":"0x6983641d"}],"source":"chainlake-kafka"}}
2026-02-04T15:22:06.325683065Z [inf]  request completed
2026-02-04T15:22:06.325686686Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:22:06.325690267Z [inf]  [Webhook] ⚠️ Ignoring tx 0x024310: No matched tracked wallets in [0xfb64, 0x6131]
2026-02-04T15:22:07.363074423Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:22:07.363078775Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:22:07.884687283Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:22:07.884690726Z [inf]  Aggressive Mode: Initiating retry sequence...
2026-02-04T15:22:07.884694506Z [err]  Critical: No valid price data available
2026-02-04T15:22:08.355503961Z [inf]  Buy Step 2: 99% amount, 20% slippage
2026-02-04T15:22:08.355514790Z [inf]  [MainSwapService][1770218528241_z05mad] Starting unified swap execution
2026-02-04T15:22:08.355523418Z [inf]  Timer finished: launchpad_det_ETH
2026-02-04T15:22:08.355526684Z [inf]  [MainSwapService][1770218528241_z05mad] Executing EVM swap
2026-02-04T15:22:08.355530390Z [inf]  [MainSwapService][1770218528241_z05mad] FastSwapMode enabled - attempting direct swap (BUY with native)
2026-02-04T15:22:08.355534821Z [inf]  [DirectSwap] Starting direct swap
2026-02-04T15:22:08.355552049Z [inf]  [PlatformFee] Fees ENABLED: { context: 'copyTrade', bps: 100, evmRecipient: '0xc5377e6329' }
2026-02-04T15:22:08.355555464Z [inf]  [Kyber] GET routes {
2026-02-04T15:22:08.355558904Z [inf]    routesUrl: 'https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&tokenOut=0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07&amountIn=4546425630634910&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B&feeReceiver=0xc5377e6329770Be29Ef938d8aCC11f22398D7E54&feeAmount=100&isInBps=true&chargeFeeBy=currency_in'
2026-02-04T15:22:08.355564165Z [inf]  }
2026-02-04T15:22:08.582090305Z [inf]  0x API price received successfully
2026-02-04T15:22:10.107727390Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:22:10.162934900Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:22:10.358881453Z [wrn]  [DirectSwap] Reference quote timeout
2026-02-04T15:22:10.358937323Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:22:10.358940798Z [wrn]  [DirectSwap] No reference quote available
2026-02-04T15:22:10.358943941Z [inf]  [DirectSwap] V4 fast path quote check
2026-02-04T15:22:10.358946820Z [inf]  [DirectSwap] V4 fast path fallback
2026-02-04T15:22:10.409947134Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:22:10.527627398Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:22:10.608622152Z [inf]  [DirectSwap] Pool discovery complete
2026-02-04T15:22:10.608626797Z [inf]  [PlatformFee] Fees ENABLED: { context: 'copyTrade', bps: 100, evmRecipient: '0xc5377e6329' }
2026-02-04T15:22:10.608629736Z [inf]  [Kyber] GET routes {
2026-02-04T15:22:10.608632616Z [inf]    routesUrl: 'https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&tokenOut=0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07&amountIn=4546425630634910&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B&feeReceiver=0xc5377e6329770Be29Ef938d8aCC11f22398D7E54&feeAmount=100&isInBps=true&chargeFeeBy=currency_in'
2026-02-04T15:22:10.608635112Z [inf]  }
2026-02-04T15:22:10.683389136Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:22:10.804577324Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:22:11.200588934Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:22:11.200592184Z [inf]  0x API price received successfully
2026-02-04T15:22:12.630891427Z [wrn]  [DirectSwap] Reference quote timeout
2026-02-04T15:22:12.636776863Z [wrn]  [DirectSwap] No reference quote available
2026-02-04T15:22:12.636781471Z [inf]  [DirectSwap] Finished
2026-02-04T15:22:12.636784591Z [wrn]  [MainSwapService][1770218528241_z05mad] Direct swap failed, falling back to 0x/Kyber: No valid reference price (0x/Kyber/Gecko)
2026-02-04T15:22:12.636787699Z [inf]  Initiating Unified Swap Execution
2026-02-04T15:22:12.665161255Z [wrn]  All API liquidity sources failed
2026-02-04T15:22:13.357380625Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:22:13.357386076Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:22:13.357389361Z [err]  Critical: No valid price data available
2026-02-04T15:22:13.509560247Z [wrn]  All API liquidity sources failed
2026-02-04T15:22:13.509564646Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:22:13.537458425Z [wrn]  All API liquidity sources failed
2026-02-04T15:22:13.623743477Z [inf]  }
2026-02-04T15:22:13.623744627Z [inf]  [Kyber] routes response {
2026-02-04T15:22:13.623748432Z [inf]      'origin',
2026-02-04T15:22:13.623753742Z [inf]    status: 200,
2026-02-04T15:22:13.623756331Z [inf]    allBodyKeys: [
2026-02-04T15:22:13.623757918Z [inf]      'slippageTolerance',
2026-02-04T15:22:13.623760784Z [inf]    hasData: true,
2026-02-04T15:22:13.623763598Z [inf]    deadline: 1770219133,
2026-02-04T15:22:13.623764092Z [inf]      'routeSummary',
2026-02-04T15:22:13.623767211Z [inf]    keys: [ 'code', 'message', 'data', 'requestId' ]
2026-02-04T15:22:13.623772557Z [inf]      'sender',
2026-02-04T15:22:13.623773485Z [inf]      'recipient',
2026-02-04T15:22:13.623775298Z [inf]  }
2026-02-04T15:22:13.623777178Z [inf]    deadlineType: 'number',
2026-02-04T15:22:13.623779079Z [inf]      'deadline'
2026-02-04T15:22:13.623781472Z [inf]  [Kyber] Building route/build request body: {
2026-02-04T15:22:13.623784105Z [inf]    sender: '0xFB64Ce8d',
2026-02-04T15:22:13.623790925Z [inf]      'tokenOut',
2026-02-04T15:22:13.623791219Z [inf]    recipient: '0xFB64Ce8d',
2026-02-04T15:22:13.623791756Z [inf]    hasRouteSummary: true,
2026-02-04T15:22:13.623794880Z [inf]    ]
2026-02-04T15:22:13.623799613Z [inf]    slippageTolerance: 2000,
2026-02-04T15:22:13.623799814Z [inf]    routeSummaryKeys: [
2026-02-04T15:22:13.623803140Z [inf]      'amountOut',
2026-02-04T15:22:13.623806773Z [inf]    slippageToleranceType: 'number',
2026-02-04T15:22:13.623809587Z [inf]      'tokenIn',
2026-02-04T15:22:13.623810719Z [inf]      'amountOutUsd',
2026-02-04T15:22:13.623814799Z [inf]      'amountIn',
2026-02-04T15:22:13.623817262Z [inf]      'gas',
2026-02-04T15:22:13.623819930Z [inf]      'amountInUsd',
2026-02-04T15:22:13.623823451Z [inf]      'gasPrice'
2026-02-04T15:22:13.623828514Z [inf]    ],
2026-02-04T15:22:13.991063169Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:22:13.991066466Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:22:13.991069062Z [err]  Critical: No valid price data available
2026-02-04T15:22:14.254903469Z [inf]      'slippageTolerance',
2026-02-04T15:22:14.254911818Z [inf]    status: 200,
2026-02-04T15:22:14.254911993Z [inf]      'deadline'
2026-02-04T15:22:14.254917852Z [inf]    ]
2026-02-04T15:22:14.254922411Z [inf]    hasData: true,
2026-02-04T15:22:14.254923870Z [inf]  }
2026-02-04T15:22:14.254928198Z [inf]    keys: [ 'code', 'message', 'data', 'requestId' ]
2026-02-04T15:22:14.254931846Z [inf]  }
2026-02-04T15:22:14.254935409Z [inf]  [Kyber] Building route/build request body: {
2026-02-04T15:22:14.254939161Z [inf]    hasRouteSummary: true,
2026-02-04T15:22:14.254942587Z [inf]    routeSummaryKeys: [
2026-02-04T15:22:14.254946613Z [inf]      'tokenIn',
2026-02-04T15:22:14.254950294Z [inf]      'amountIn',
2026-02-04T15:22:14.254954286Z [inf]  [Kyber] routes response {
2026-02-04T15:22:14.254955891Z [inf]      'amountInUsd',
2026-02-04T15:22:14.254958967Z [inf]      'tokenOut',
2026-02-04T15:22:14.254961990Z [inf]      'amountOut',
2026-02-04T15:22:14.254965175Z [inf]      'amountOutUsd',
2026-02-04T15:22:14.254968104Z [inf]      'gas',
2026-02-04T15:22:14.254971133Z [inf]      'gasPrice'
2026-02-04T15:22:14.254975811Z [inf]    ],
2026-02-04T15:22:14.254978732Z [inf]    sender: '0xFB64Ce8d',
2026-02-04T15:22:14.254981782Z [inf]    recipient: '0xFB64Ce8d',
2026-02-04T15:22:14.254984756Z [inf]    slippageTolerance: 2000,
2026-02-04T15:22:14.254987676Z [inf]    slippageToleranceType: 'number',
2026-02-04T15:22:14.254990516Z [inf]    deadline: 1770219134,
2026-02-04T15:22:14.254993701Z [inf]    deadlineType: 'number',
2026-02-04T15:22:14.254996798Z [inf]    allBodyKeys: [
2026-02-04T15:22:14.254999819Z [inf]      'routeSummary',
2026-02-04T15:22:14.255002823Z [inf]      'sender',
2026-02-04T15:22:14.255005656Z [inf]      'recipient',
2026-02-04T15:22:14.255008406Z [inf]      'origin',
2026-02-04T15:22:14.351022166Z [inf]  incoming request
2026-02-04T15:22:14.351029031Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_u9ace5wq1nwynrqo","createdAt":"2026-02-04T15:22:14.142Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x8d0d118070b728e104294471fbe93c2e3affd694","toAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","blockNum":"0x27c83a1","hash":"0x60e6d3bc675209a02f561daab2b867848db9fa6de7786acd14bfd7d7d9184506","value":0.4768098707769237,"typeTraceAddress":"CALL_9","asset":"ETH","category":"internal","rawContract":{"rawValue":"0x69df80d1d0ef643","decimals":18},"blockTimestamp":"0x69836425"}]}}
2026-02-04T15:22:14.351035506Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:22:14.351040192Z [inf]  request completed
2026-02-04T15:22:14.351044372Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x60e6d3
2026-02-04T15:22:14.362002457Z [inf]  [Profile] fetchTransaction
2026-02-04T15:22:14.413266074Z [inf]  incoming request
2026-02-04T15:22:14.413271900Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_mxkm0zj96mkqc1t4","createdAt":"2026-02-04T15:22:14.114Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0x8d0d118070b728e104294471fbe93c2e3affd694","blockNum":"0x27c83a1","hash":"0x60e6d3bc675209a02f561daab2b867848db9fa6de7786acd14bfd7d7d9184506","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x69836425"}],"source":"chainlake-kafka"}}
2026-02-04T15:22:14.413277491Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:22:14.413281652Z [inf]  request completed
2026-02-04T15:22:14.418538735Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x60e6d3
2026-02-04T15:22:14.424032927Z [inf]  [Profile] fetchTransaction
2026-02-04T15:22:14.463648299Z [inf]  [Profile] fetchReceipt
2026-02-04T15:22:14.463672345Z [inf]  [Profile] fetchReceipt
2026-02-04T15:22:14.463677293Z [inf]  [Profile] parseSwapTransaction
2026-02-04T15:22:14.463681524Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0xb4beddf1: {
2026-02-04T15:22:14.463685820Z [inf]    tokenIn: '0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07',
2026-02-04T15:22:14.463689920Z [inf]    tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-04T15:22:14.463694319Z [inf]    dex: 'Uniswap v4'
2026-02-04T15:22:14.463699115Z [inf]  }
2026-02-04T15:22:14.463703655Z [inf]  Swap detected on target wallet
2026-02-04T15:22:14.463707909Z [inf]  Target is selling - triggering mirror sell
2026-02-04T15:22:14.464480258Z [inf]  [Profile] parseSwapTransaction
2026-02-04T15:22:14.464483991Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0xb4beddf1: {
2026-02-04T15:22:14.464486787Z [inf]    tokenIn: '0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07',
2026-02-04T15:22:14.464489710Z [inf]    tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-04T15:22:14.464492428Z [inf]    dex: 'Uniswap v4'
2026-02-04T15:22:14.464494970Z [inf]  }
2026-02-04T15:22:14.464497517Z [inf]  Swap detected on target wallet
2026-02-04T15:22:14.490769790Z [wrn]  All API liquidity sources failed
2026-02-04T15:22:14.539680549Z [inf]  incoming request
2026-02-04T15:22:14.539687378Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_t6pjjwt16zu63miz","createdAt":"2026-02-04T15:22:14.243Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0x6ff5693b99212da76ad316178a184ab56d299b43","blockNum":"0x27c83a1","hash":"0x60e6d3bc675209a02f561daab2b867848db9fa6de7786acd14bfd7d7d9184506","value":1381264320.4989295,"asset":"CLAWIAI","category":"token","rawContract":{"rawValue":"0x000000000000000000000000000000000000000004768e18da63a047802257d9","address":"0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07","decimals":18},"log":{"address":"0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000b4beddf1b828aaed9638601f7145b0f6093f2d3f","0x0000000000000000000000006ff5693b99212da76ad316178a184ab56d299b43"],"data":"0x000000000000000000000000000000000000000004768e18da63a047802257d9","blockHash":"0xe269e4b5ea5987e358e337b09f26365a3b4c4faf684e39ae71b4eb2379f80251","blockNumber":"0x27c83a1","blockTimestamp":"0x69836425","transactionHash":"0x60e6d3bc675209a02f561daab2b867848db9fa6de7786acd14bfd7d7d9184506","transactionIndex":"0xf1","logIndex":"0x2ff","removed":false},"blockTimestamp":"0x69836425"}],"source":"chainlake-kafka"}}
2026-02-04T15:22:14.539693056Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:22:14.539697047Z [inf]  [Webhook] Tx already in processedTxs cache: 0x60e6d3bc675209
2026-02-04T15:22:14.539700774Z [inf]  request completed
2026-02-04T15:22:14.712820728Z [inf]  Timer finished: launchpad_det_0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
2026-02-04T15:22:14.876229731Z [err]  Alchemy Portfolio EVM API error
2026-02-04T15:22:14.917891357Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T15:22:14.917894227Z [inf]  [PlatformFee] Fees ENABLED: { context: 'copyTrade', bps: 100, evmRecipient: '0xc5377e6329' }
2026-02-04T15:22:15.052401458Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:22:15.052405894Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:22:15.052408932Z [err]  Critical: No valid price data available
2026-02-04T15:22:15.258699689Z [inf]  0x API price received successfully
2026-02-04T15:22:15.341664776Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:22:15.341668178Z [inf]  [PlatformFee] Fees ENABLED: { context: 'copyTrade', bps: 100, evmRecipient: '0xc5377e6329' }
2026-02-04T15:22:15.341671034Z [inf]  [Kyber] GET routes {
2026-02-04T15:22:15.341674158Z [inf]    routesUrl: 'https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&tokenOut=0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07&amountIn=4546425630634910&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B&feeReceiver=0xc5377e6329770Be29Ef938d8aCC11f22398D7E54&feeAmount=100&isInBps=true&chargeFeeBy=currency_in'
2026-02-04T15:22:15.341677321Z [inf]  }
2026-02-04T15:22:15.663216478Z [inf]  0x API Quote received successfully
2026-02-04T15:22:15.663222899Z [inf]  0x API Quote successful
2026-02-04T15:22:15.663226644Z [inf]  [QuoteService] 0x API estimatedPriceImpact: {
2026-02-04T15:22:15.663229959Z [inf]    raw: undefined,
2026-02-04T15:22:15.663233820Z [inf]    parsed: 0,
2026-02-04T15:22:15.663237101Z [inf]    multipliedBy100: 0,
2026-02-04T15:22:15.663240145Z [inf]    impactVsMkt: null,
2026-02-04T15:22:15.663243049Z [inf]    willUse: 0
2026-02-04T15:22:15.663245910Z [inf]  }
2026-02-04T15:22:16.261851071Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:22:17.103945459Z [inf]    slippageTolerance: 2000,
2026-02-04T15:22:17.103953907Z [inf]  [Kyber] routes response {
2026-02-04T15:22:17.103957968Z [inf]    status: 200,
2026-02-04T15:22:17.103961540Z [inf]    slippageToleranceType: 'number',
2026-02-04T15:22:17.103963362Z [inf]    hasData: true,
2026-02-04T15:22:17.103966702Z [inf]    deadline: 1770219137,
2026-02-04T15:22:17.103968650Z [inf]    keys: [ 'code', 'message', 'data', 'requestId' ]
2026-02-04T15:22:17.103970831Z [inf]    deadlineType: 'number',
2026-02-04T15:22:17.103975601Z [inf]    allBodyKeys: [
2026-02-04T15:22:17.103979546Z [inf]  }
2026-02-04T15:22:17.103981620Z [inf]      'routeSummary',
2026-02-04T15:22:17.103984939Z [inf]  [Kyber] Building route/build request body: {
2026-02-04T15:22:17.103986705Z [inf]      'sender',
2026-02-04T15:22:17.103989743Z [inf]    hasRouteSummary: true,
2026-02-04T15:22:17.103994019Z [inf]      'recipient',
2026-02-04T15:22:17.103994510Z [inf]    routeSummaryKeys: [
2026-02-04T15:22:17.103999157Z [inf]      'origin',
2026-02-04T15:22:17.103999786Z [inf]      'tokenIn',
2026-02-04T15:22:17.104004549Z [inf]      'amountIn',
2026-02-04T15:22:17.104004780Z [inf]      'slippageTolerance',
2026-02-04T15:22:17.104010122Z [inf]      'amountInUsd',
2026-02-04T15:22:17.104010251Z [inf]      'deadline'
2026-02-04T15:22:17.104015350Z [inf]      'tokenOut',
2026-02-04T15:22:17.104016344Z [inf]    ]
2026-02-04T15:22:17.104020025Z [inf]      'amountOut',
2026-02-04T15:22:17.104021963Z [inf]  }
2026-02-04T15:22:17.104024579Z [inf]      'amountOutUsd',
2026-02-04T15:22:17.104027452Z [inf]      'gas',
2026-02-04T15:22:17.104030344Z [inf]      'gasPrice'
2026-02-04T15:22:17.104033037Z [inf]    ],
2026-02-04T15:22:17.104036249Z [inf]    sender: '0xFB64Ce8d',
2026-02-04T15:22:17.104039929Z [inf]    recipient: '0xFB64Ce8d',
2026-02-04T15:22:18.472716531Z [inf]    chainId: 8453
2026-02-04T15:22:18.472717030Z [inf]    dataPrefix: '0x2213bc0b000000000000000000000000dc5d8200a030798bc6227240f68b4dd9',
2026-02-04T15:22:18.472725577Z [inf]  }
2026-02-04T15:22:18.472728001Z [inf]    value: '4546425630634910',
2026-02-04T15:22:18.472732239Z [inf]  [QuoteService] Preferring 0x for reliability { reason: '0x has better price', percentDiff: '12.00' }
2026-02-04T15:22:18.472739026Z [inf]  Checking approval for swap
2026-02-04T15:22:18.472745600Z [inf]  Approval not needed or already set
2026-02-04T15:22:18.472750938Z [inf]  [SwapExecutor] Executing 0x Aggregator swap on chain 8453
2026-02-04T15:22:18.472755840Z [inf]  [SwapExecutor] ========== TRANSACTION EXECUTION ==========
2026-02-04T15:22:18.472760660Z [inf]  [SwapExecutor] DEX: 0x Aggregator
2026-02-04T15:22:18.472765481Z [inf]  [SwapExecutor] Transaction params: {
2026-02-04T15:22:18.472771021Z [inf]  [QuoteService] Quote comparison: {
2026-02-04T15:22:18.472773679Z [inf]    to: '0x0000000000001ff3684f28c67538d4d072c22734',
2026-02-04T15:22:18.472776303Z [inf]    '0x_amount': '12634023.4406702050784841',
2026-02-04T15:22:18.472781513Z [inf]    kyber_amount: '11074285.331741957005770752',
2026-02-04T15:22:18.472782070Z [inf]    dataLength: 4618,
2026-02-04T15:22:18.472785671Z [inf]    kyber_advantage_pct: '12.00',
2026-02-04T15:22:18.473538548Z [inf]    router: '0x0000000000001ff3684f28c67538d4d072c22734',
2026-02-04T15:22:18.473548348Z [inf]    allowanceTarget: '0x0000000000001ff3684f28c67538d4d072c22734'
2026-02-04T15:22:18.473552717Z [inf]  }
2026-02-04T15:22:18.473556668Z [inf]  [SwapExecutor] Swap details: {
2026-02-04T15:22:18.473561224Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-04T15:22:18.473566077Z [inf]    tokenOut: '0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07',
2026-02-04T15:22:18.473570279Z [inf]    amountInBase: '4546425630634910',
2026-02-04T15:22:18.473574309Z [inf]    amountInHuman: '0.004546425630634910',
2026-02-04T15:22:18.473578960Z [inf]    amountOut: '12634023.4406702050784841',
2026-02-04T15:22:18.473584146Z [inf]    slippageBps: 2000,
2026-02-04T15:22:18.473589056Z [inf]    priceImpact: 0,
2026-02-04T15:22:18.473592837Z [inf]    gasEstimate: 851876
2026-02-04T15:22:18.473596709Z [inf]  }
2026-02-04T15:22:18.473600338Z [inf]  [SwapExecutor] =============================================
2026-02-04T15:22:18.490117042Z [inf]    gasEstimate: 851876,
2026-02-04T15:22:18.490122580Z [inf]    gasLimit: '1277814',
2026-02-04T15:22:18.490126085Z [inf]    maxFeePerGas: '44504728',
2026-02-04T15:22:18.490130447Z [inf]    maxPriorityFeePerGas: '1000000'
2026-02-04T15:22:18.490134916Z [inf]  }
2026-02-04T15:22:18.490139541Z [inf]  🚀 CopyTrade Aggressive Gas
2026-02-04T15:22:18.490177861Z [inf]  [SwapExecutor] Execution params prepared: {
2026-02-04T15:22:18.490182007Z [inf]    dex: '0x Aggregator',
2026-02-04T15:22:18.733184009Z [inf]  [sendTransaction] To: 0x0000000000001ff3684f28c67538d4d072c22734
2026-02-04T15:22:18.733192172Z [inf]  [sendTransaction] Value: 4546425630634910
2026-02-04T15:22:18.733197471Z [inf]  [sendTransaction] ValueHex: 0x1026f334b6339e
2026-02-04T15:22:18.733201246Z [inf]  [sendTransaction] Data length: 4618
2026-02-04T15:22:18.733205118Z [inf]  [sendTransaction] Data (full): 0x2213bc0b000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001026f334b6339e000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef00000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000008241fff991f000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b0000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b07000000000000000000000000000000000000000000085c496d2cc3a055a0f6d000000000000000000000000000000000000000000000000000000000000000a0630590b6cb36424d6473ca360000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000000000000000000000000000000000380000000000000000000000000000000000000000000000000000000000000054000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000044bd01c2260000000000000000000000000000000000000000000000000000000069836553000000000000000000000000000000000000000000000000001026f334b6339e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee000000000000000000000000000000000000000000000000000000000000000f000000000000000000000000ad01c20d5886137e056775af56915de824c8fce5000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000000000000000000000000000000000000000027100000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000024d0e30db0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000184af72634f000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef0000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000ffffffffffffffc50000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000482710fffd8963efd1fc6a506488495d951d5263988d25012fc3dd4dacfd1b2fabac157de8727b54bade4b078000000000c8b429d62f8f3bffb98cdb9569533ea23bf0ba28cc00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008434ee90ca000000000000000000000000f5c4f3dc02c3fb9279495a8fef7b0741da9561570000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b070000000000000000000000000000000000000000000a8ef1aee8ac2221e222d3000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012438c9c1470000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b0700000000000000000000000000000000000000000000000000000000000000640000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b07000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000c5377e6329770be29ef938d8acc11f22398d7e540000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
2026-02-04T15:22:18.733239214Z [inf]  [sendTransaction] ========== PRIVY TX PARAMS ==========
2026-02-04T15:22:18.733243191Z [inf]  [sendTransaction] From: 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T15:22:18.733886415Z [inf]  [sendTransaction] ChainId: 8453
2026-02-04T15:22:18.733891179Z [inf]  [sendTransaction] Gas: 1277814
2026-02-04T15:22:18.733895388Z [inf]  [sendTransaction] MaxFeePerGas: 53504728
2026-02-04T15:22:18.733900184Z [inf]  [sendTransaction] MaxPriorityFeePerGas: 10000000
2026-02-04T15:22:18.733905857Z [inf]  [sendTransaction] Full TX object: {
2026-02-04T15:22:18.733909381Z [inf]    to: '0x0000000000001ff3684f28c67538d4d072c22734',
2026-02-04T15:22:18.733912443Z [inf]    data: '0x2213bc0b000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001026f334b6339e000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef00000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000008241fff991f000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b0000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b07000000000000000000000000000000000000000000085c496d2cc3a055a0f6d000000000000000000000000000000000000000000000000000000000000000a0630590b6cb36424d6473ca360000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000000000000000000000000000000000380000000000000000000000000000000000000000000000000000000000000054000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000044bd01c2260000000000000000000000000000000000000000000000000000000069836553000000000000000000000000000000000000000000000000001026f334b6339e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee000000000000000000000000000000000000000000000000000000000000000f000000000000000000000000ad01c20d5886137e056775af56915de824c8fce5000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000000000000000000000000000000000000000027100000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000024d0e30db0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000184af72634f000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef0000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000ffffffffffffffc50000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000482710fffd8963efd1fc6a506488495d951d5263988d25012fc3dd4dacfd1b2fabac157de8727b54bade4b078000000000c8b429d62f8f3bffb98cdb9569533ea23bf0ba28cc00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008434ee90ca000000000000000000000000f5c4f3dc02c3fb9279495a8fef7b0741da9561570000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b070000000000000000000000000000000000000000000a8ef1aee8ac2221e222d3000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012438c9c1470000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b0700000000000000000000000000000000000000000000000000000000000000640000000000000000000000002fc3dd4dacfd1b2fabac157de8727b54bade4b07000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000c5377e6329770be29ef938d8acc11f22398d7e540000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
2026-02-04T15:22:18.734534884Z [inf]    value: '4546425630634910',
2026-02-04T15:22:18.734539494Z [inf]    chainId: 8453,
2026-02-04T15:22:18.734542655Z [inf]    gas: '1277814',
2026-02-04T15:22:18.734545738Z [inf]    maxFeePerGas: '53504728',
2026-02-04T15:22:18.734548547Z [inf]    maxPriorityFeePerGas: '10000000'
2026-02-04T15:22:18.734551578Z [inf]  }
2026-02-04T15:22:18.734554416Z [inf]  [sendTransaction] ===========================================
2026-02-04T15:22:19.512173251Z [inf]  Ethereum transaction sent via Privy
2026-02-04T15:22:20.519334843Z [inf]  Swap Broadcast
2026-02-04T15:22:20.519339004Z [inf]  [ConfirmWait] Waiting for confirmation: 0xe805f14586f82c8d29f82db68f404874b77c12301be5a8cc0d461936ded76919 on 8453
2026-02-04T15:22:22.292925990Z [inf]  incoming request
2026-02-04T15:22:22.292932370Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_3if8ozzjgfop7elr","createdAt":"2026-02-04T15:22:21.925Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","toAddress":"0x0000000000001ff3684f28c67538d4d072c22734","blockNum":"0x27c83a5","hash":"0xe805f14586f82c8d29f82db68f404874b77c12301be5a8cc0d461936ded76919","value":0.00454642563063491,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x1026f334b6339e","decimals":18},"blockTimestamp":"0x6983642d"}],"source":"chainlake-kafka"}}
2026-02-04T15:22:22.292935547Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:22:22.292938497Z [inf]  request completed
2026-02-04T15:22:22.292942169Z [inf]  [Webhook] ⚠️ Ignoring tx 0xe805f1: No matched tracked wallets in [0xfb64, 0x0000]
2026-02-04T15:22:22.365041504Z [inf]  incoming request
2026-02-04T15:22:22.365646226Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_bja23w3cjde636dl","createdAt":"2026-02-04T15:22:22.050Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xdc5d8200a030798bc6227240f68b4dd9542686ef","toAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","blockNum":"0x27c83a5","hash":"0xe805f14586f82c8d29f82db68f404874b77c12301be5a8cc0d461936ded76919","value":12636649.580492882,"asset":"CLAWIAI","category":"token","rawContract":{"rawValue":"0x0000000000000000000000000000000000000000000a73ea257ad35f3b24fea3","address":"0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07","decimals":18},"log":{"address":"0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef","0x000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b"],"data":"0x0000000000000000000000000000000000000000000a73ea257ad35f3b24fea3","blockHash":"0x29dcb71d64af6b899649b8e8eca80a90b868b0eb648d82dd4f07604abdf25081","blockNumber":"0x27c83a5","blockTimestamp":"0x6983642d","transactionHash":"0xe805f14586f82c8d29f82db68f404874b77c12301be5a8cc0d461936ded76919","transactionIndex":"0xe","logIndex":"0x46","removed":false},"blockTimestamp":"0x6983642d"}],"source":"chainlake-kafka"}}
2026-02-04T15:22:22.366378560Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:22:22.366383193Z [inf]  request completed
2026-02-04T15:22:22.370893576Z [inf]  [Webhook] ⚠️ Ignoring tx 0xe805f1: No matched tracked wallets in [0xdc5d, 0xfb64]
2026-02-04T15:22:22.571522186Z [inf]  [ConfirmWait] Transaction confirmed: 0xe805f14586f82c8d29f82db68f404874b77c12301be5a8cc0d461936ded76919
2026-02-04T15:22:22.571525021Z [inf]  Transaction confirmed on-chain
2026-02-04T15:22:22.571527841Z [inf]  [MainSwapService][1770218528241_z05mad] Initiating Post-Buy Pre-Approval
2026-02-04T15:22:22.593973584Z [inf]  Copy trade completed and position created
2026-02-04T15:22:22.593980096Z [inf]  [Warpcast] Sending DM to FID 877398: "🚀 Bought $CLAWIAI @ $10.00
2026-02-04T15:22:22.593983946Z [inf]  
2026-02-04T15:22:22.593988510Z [inf]  🟢 **BOUGHT $CLAWIAI*..."
2026-02-04T15:22:22.593993041Z [inf]  [sendTransaction] ========== PRIVY TX PARAMS ==========
2026-02-04T15:22:22.593997582Z [inf]  [sendTransaction] From: 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T15:22:22.594001079Z [inf]  [sendTransaction] To: 0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07
2026-02-04T15:22:22.594004713Z [inf]  [sendTransaction] Value: 0
2026-02-04T15:22:22.594009393Z [inf]  [sendTransaction] ValueHex: 0x0
2026-02-04T15:22:22.594013739Z [inf]  [sendTransaction] Data length: 138
2026-02-04T15:22:22.594017135Z [inf]  [sendTransaction] Data (full): 0x095ea7b30000000000000000000000000000000000001ff3684f28c67538d4d072c22734ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
2026-02-04T15:22:22.594020733Z [inf]  [sendTransaction] ChainId: 8453
2026-02-04T15:22:22.594025456Z [inf]  [sendTransaction] Gas: undefined
2026-02-04T15:22:22.594029734Z [inf]  [sendTransaction] MaxFeePerGas: undefined
2026-02-04T15:22:22.594033132Z [inf]  [sendTransaction] MaxPriorityFeePerGas: undefined
2026-02-04T15:22:22.594036768Z [inf]  [sendTransaction] Full TX object: {
2026-02-04T15:22:22.594040047Z [inf]    to: '0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07',
2026-02-04T15:22:22.594044081Z [inf]    data: '0x095ea7b30000000000000000000000000000000000001ff3684f28c67538d4d072c22734ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
2026-02-04T15:22:22.594742973Z [inf]    value: '0',
2026-02-04T15:22:22.594748645Z [inf]    chainId: 8453
2026-02-04T15:22:22.594752613Z [inf]  }
2026-02-04T15:22:22.594755459Z [inf]  [sendTransaction] ===========================================
2026-02-04T15:22:23.086651208Z [inf]  [Warpcast] DM sent successfully. Daily usage: 1/50000
2026-02-04T15:22:23.086656969Z [inf]  ✅ Smart batch execution complete
2026-02-04T15:22:23.391440046Z [inf]  Ethereum transaction sent via Privy
2026-02-04T15:22:24.387367436Z [inf]  [MainSwapService][1770218528241_z05mad] Post-Buy Pre-Approval Sent
2026-02-04T15:22:26.368845738Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:22:26.368853404Z [wrn]  All API liquidity sources failed
2026-02-04T15:22:26.593291509Z [inf]  incoming request
2026-02-04T15:22:26.593296238Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_ho9znceq6pexirxb","createdAt":"2026-02-04T15:22:26.386Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","toAddress":"0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07","blockNum":"0x27c83a7","hash":"0x0950c0b65409cbae9890726362b3c705e3b0483af662094e668b7fbbb86aa14e","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x69836431"}],"source":"chainlake-kafka"}}
2026-02-04T15:22:26.593299233Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:22:26.593302278Z [inf]  request completed
2026-02-04T15:22:26.598618720Z [inf]  [Webhook] ⚠️ Ignoring tx 0x0950c0: No matched tracked wallets in [0xfb64, 0x2fc3]
2026-02-04T15:22:26.639420937Z [inf]  0x API price received successfully
2026-02-04T15:22:26.689116307Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:22:27.372763543Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:22:27.372766144Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:22:27.372770280Z [err]  Critical: No valid price data available
2026-02-04T15:22:27.693842669Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:22:28.054950128Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:22:28.054953045Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T15:22:32.816116894Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-04T15:22:32.816122844Z [inf]  Fetching premium trending tokens
2026-02-04T15:22:32.838893755Z [err]  DexScreener WS: Connection error
2026-02-04T15:22:32.861070865Z [err]  DexScreener WS: Connection error
2026-02-04T15:22:38.347715328Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:22:38.675594995Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:22:38.991258129Z [wrn]  All API liquidity sources failed
2026-02-04T15:22:40.930614888Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:22:40.930619529Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:22:40.930622652Z [err]  Critical: No valid price data available
2026-02-04T15:22:40.935817939Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T15:22:44.129315284Z [err]  DexScreener WS: Connection error
2026-02-04T15:22:44.129319327Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:22:44.129323375Z [wrn]  WS returned 0 addresses
2026-02-04T15:22:44.129327397Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:22:45.108268110Z [inf]  Merged addresses
2026-02-04T15:22:45.625327059Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:22:45.625329902Z [err]  Error fetching trending tokens
2026-02-04T15:22:45.625334154Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:22:45.625336906Z [inf]  [TokenJob] Got 31 trending tokens for BSC
2026-02-04T15:22:45.625340133Z [err]  [TokenJob] New list too small (31) for BSC; keeping existing (100)
2026-02-04T15:22:45.636726278Z [inf]  [TokenJob] Refreshed 4 primary chains in 164.8s
2026-02-04T15:22:51.072705387Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:22:51.072708179Z [wrn]  All API liquidity sources failed
2026-02-04T15:22:52.185724070Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:22:52.185728898Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:22:52.185731927Z [err]  Critical: No valid price data available
2026-02-04T15:22:52.371308688Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T15:23:02.358203506Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:23:02.408036123Z [wrn]  All API liquidity sources failed
2026-02-04T15:23:02.767466147Z [inf]  0x API price received successfully
2026-02-04T15:23:02.767470967Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:23:03.073111044Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:23:03.073115957Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:23:03.073119089Z [err]  Critical: No valid price data available
2026-02-04T15:23:04.301054844Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:23:04.772720461Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:23:04.958628388Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T15:23:11.854457874Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:23:11.968396212Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:23:12.098140218Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:23:12.244363715Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:23:12.362722338Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:23:12.491178565Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:23:12.620354806Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:23:15.004564644Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:23:15.337246064Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:23:15.369596322Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:23:15.522352330Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:23:16.633602725Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:23:16.633607502Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:23:16.633613081Z [err]  Critical: No valid price data available
2026-02-04T15:23:16.654194997Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T15:23:36.655909597Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:23:36.655914644Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:23:36.655917972Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:23:36.655920584Z [err]  Critical: No valid price data available
2026-02-04T15:23:36.655923470Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T15:23:38.161904294Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:23:38.517702127Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:23:38.517706873Z [inf]  0x API price received successfully
2026-02-04T15:23:39.312868386Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:23:39.312872766Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:23:39.312876000Z [err]  Critical: No valid price data available
2026-02-04T15:23:39.594820153Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:23:39.654751676Z [wrn]  RPC endpoint failed
2026-02-04T15:23:40.277088689Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:23:40.288856795Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T15:23:44.628536649Z [inf]  incoming request
2026-02-04T15:23:44.628540878Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_madivuxfjib7fl84","createdAt":"2026-02-04T15:23:44.397Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","toAddress":"0x1111111111111111111111111111111111111111","blockNum":"0x27c83ce","hash":"0xb848164cfd45cb98f5208f7d354f51113634bfb1b7ba09ad51a2441a56eb544e","value":500,"asset":"(t.me/s/US_POOL) *claim until 05.02.26","category":"token","rawContract":{"rawValue":"0x00000000000000000000000000000000000000000000000000000000000001f4","address":"0x9765eaa10b7416da46a5f3de7f3f55ccfa12ce91","decimals":0},"log":{"address":"0x9765eaa10b7416da46a5f3de7f3f55ccfa12ce91","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913","0x0000000000000000000000001111111111111111111111111111111111111111"],"data":"0x00000000000000000000000000000000000000000000000000000000000001f4","blockHash":"0x5819063cfdb5bd83779f5e17e6efd3ab8dd2817cedc6efc35cbc91e8dc886aef","blockNumber":"0x27c83ce","blockTimestamp":"0x6983647f","transactionHash":"0xb848164cfd45cb98f5208f7d354f51113634bfb1b7ba09ad51a2441a56eb544e","transactionIndex":"0x71","logIndex":"0x26b","removed":false},"blockTimestamp":"0x6983647f"}],"source":"chainlake-kafka"}}
2026-02-04T15:23:44.628544285Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:23:44.628547731Z [inf]  request completed
2026-02-04T15:23:44.628550469Z [inf]  [Webhook] ⚠️ Ignoring tx 0xb84816: No matched tracked wallets in [0x8335, 0x1111]
2026-02-04T15:23:50.301083438Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:23:50.644832133Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:23:51.577883928Z [wrn]  RPC endpoint failed
2026-02-04T15:23:51.662629310Z [inf]  RPC failover success
2026-02-04T15:23:52.298852591Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T15:23:52.298915649Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:23:52.298918519Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:23:52.298921061Z [err]  Critical: No valid price data available
2026-02-04T15:23:52.298923729Z [inf]  📊 Position P/L check
2026-02-04T15:24:12.199985566Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:24:12.199989076Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:24:12.199993081Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:24:12.199996662Z [err]  Critical: No valid price data available
2026-02-04T15:24:12.200003602Z [inf]  📊 Position P/L check
2026-02-04T15:24:12.200007569Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T15:24:13.486213211Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:24:13.715050588Z [inf]  0x API price received successfully
2026-02-04T15:24:13.786059058Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:24:14.510327436Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:24:14.510331157Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:24:14.510334542Z [err]  Critical: No valid price data available
2026-02-04T15:24:14.894513793Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:24:15.197308788Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:24:15.197316117Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T15:24:15.353190190Z [inf]  📊 Position P/L check
2026-02-04T15:24:16.521951945Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:24:16.609548999Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:24:16.851001498Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:24:16.979929240Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:24:17.122158750Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:24:17.251844813Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:24:17.516873470Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:24:25.576583091Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:24:25.876758040Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:24:28.980502922Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:24:28.980507749Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:24:28.980511167Z [err]  Critical: No valid price data available
2026-02-04T15:24:28.992119521Z [inf]  📊 Position P/L check
2026-02-04T15:24:29.073941567Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T15:24:49.060098343Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:24:49.060102986Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:24:49.060106946Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:24:49.060110794Z [err]  Critical: No valid price data available
2026-02-04T15:24:49.060116267Z [inf]  📊 Position P/L check
2026-02-04T15:24:49.060119413Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T15:24:50.983391151Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:24:51.388149665Z [inf]  0x API price received successfully
2026-02-04T15:24:51.388154395Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:24:51.910566862Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:24:51.910571273Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:24:51.910575351Z [err]  Critical: No valid price data available
2026-02-04T15:24:52.466977161Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:24:52.817276165Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:24:52.817279767Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T15:25:00.374391990Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-04T15:25:00.374394882Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-04T15:25:00.374398418Z [inf]  Fetching premium trending tokens
2026-02-04T15:25:00.397701127Z [err]  DexScreener WS: Connection error
2026-02-04T15:25:00.432392603Z [err]  DexScreener WS: Connection error
2026-02-04T15:25:00.471118814Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-04T15:25:00.471124900Z [inf]  Timer finished: recalc_heat_scores
2026-02-04T15:25:02.913420954Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:25:03.123748664Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:25:03.354742058Z [inf]  ⚡ Uniswap V4 price fetched
2026-02-04T15:25:03.598717592Z [wrn]  RPC endpoint failed
2026-02-04T15:25:03.662701796Z [inf]  RPC failover success
2026-02-04T15:25:04.527978161Z [wrn]  RPC endpoint failed
2026-02-04T15:25:04.608724009Z [inf]  RPC failover success
2026-02-04T15:25:04.636463316Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:25:04.636468139Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:25:04.636471408Z [err]  Critical: No valid price data available
2026-02-04T15:25:04.658727607Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T15:25:24.646084529Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:25:24.646090218Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:25:24.646093098Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:25:24.646096786Z [err]  Critical: No valid price data available
2026-02-04T15:25:24.646099626Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T15:25:24.646102314Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:25:24.646105898Z [wrn]  WS returned 0 addresses
2026-02-04T15:25:24.646108359Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:25:24.647111878Z [inf]  Merged addresses
2026-02-04T15:25:24.647116084Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:25:24.647120087Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:25:24.647123337Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:25:24.647126361Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:25:24.647129191Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:25:24.647132121Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:25:24.647135058Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:25:24.648107545Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:25:24.648114107Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:25:24.648117734Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:25:24.648121214Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:25:25.354271910Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:25:25.691847137Z [inf]  0x API price received successfully
2026-02-04T15:25:25.788889261Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:25:26.344073998Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:25:26.344079731Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:25:26.344083195Z [err]  Critical: No valid price data available
2026-02-04T15:25:26.503295451Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:25:26.798968752Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:25:27.201682517Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:25:27.201685076Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T15:25:30.462952404Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:25:30.462954997Z [err]  GeckoTerminal API error after retries
2026-02-04T15:25:30.462957763Z [err]  Error fetching trending tokens
2026-02-04T15:25:30.462960341Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:25:30.462962947Z [inf]  [TokenJob] Got 27 trending tokens for Ethereum
2026-02-04T15:25:30.462965643Z [err]  [TokenJob] New list too small (27) for Ethereum; keeping existing (100)
2026-02-04T15:25:37.269532767Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:25:37.617062573Z [inf]  0x API price received successfully
2026-02-04T15:25:39.589190696Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:25:39.589195015Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:25:39.589199868Z [err]  Critical: No valid price data available
2026-02-04T15:25:39.589202645Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T15:25:59.777225643Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:25:59.777230058Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:25:59.777235479Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:25:59.777239446Z [err]  Critical: No valid price data available
2026-02-04T15:25:59.777243725Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T15:26:00.880438900Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-04T15:26:00.880442624Z [inf]  Fetching premium trending tokens
2026-02-04T15:26:00.913353392Z [err]  DexScreener WS: Connection error
2026-02-04T15:26:01.113647858Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:26:01.569263658Z [inf]  0x API price received successfully
2026-02-04T15:26:01.569267738Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:26:01.579899745Z [err]  DexScreener WS: Connection error
2026-02-04T15:26:02.115613361Z [err]  DexScreener WS: Connection error
2026-02-04T15:26:02.266550848Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:26:02.266553783Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:26:02.266556555Z [err]  Critical: No valid price data available
2026-02-04T15:26:02.306496016Z [err]  DexScreener WS: Connection error
2026-02-04T15:26:02.306498963Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:26:02.306501719Z [wrn]  WS returned 0 addresses
2026-02-04T15:26:02.306504599Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:26:02.563432955Z [inf]  Merged addresses
2026-02-04T15:26:02.563435534Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:26:02.734901751Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:26:02.756974883Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T15:26:03.254823237Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:26:03.254828548Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:26:03.254832267Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-04T15:26:03.254835330Z [inf]  [TokenJob] Filtered out 2 invalid tokens for Solana
2026-02-04T15:26:03.297385703Z [inf]  Saved 98 trending tokens for solana to database and memory cache
2026-02-04T15:26:03.323025460Z [inf]  [TokenJob] Saved 98 tokens for Solana to DB + cache
2026-02-04T15:26:12.862877598Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:26:13.157771199Z [inf]  0x API price received successfully
2026-02-04T15:26:14.930703732Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:26:14.930708349Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:26:14.930711624Z [err]  Critical: No valid price data available
2026-02-04T15:26:14.953717485Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T15:26:14.954988740Z [inf]  📊 Position P/L check
2026-02-04T15:26:20.385800301Z [inf]  incoming request
2026-02-04T15:26:20.385806742Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_uzoiz5e5in7y644h","createdAt":"2026-02-04T15:26:20.160Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","toAddress":"0x4409921ae43a39a11d90f7b7f96cfd0b8093d9fc","blockNum":"0x27c841c","hash":"0x8545aa639454aa7151724702b2c48b100f30fe6e3b822418cb36544f558f0548","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x6983651b"},{"fromAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","toAddress":"0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07","blockNum":"0x27c841c","hash":"0x12e0e583635bec6ac556107d14c9bfc87c135d8801a232d158c4f0cec2c7d1d8","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x6983651b"}],"source":"chainlake-kafka"}}
2026-02-04T15:26:20.385810890Z [inf]  [Webhook] Processing as EVM activity (2 items)
2026-02-04T15:26:20.385814911Z [inf]  request completed
2026-02-04T15:26:20.390870396Z [inf]  [Webhook] ⚠️ Ignoring tx 0x8545aa: No matched tracked wallets in [0xfb64, 0x4409]
2026-02-04T15:26:20.431351426Z [inf]  incoming request
2026-02-04T15:26:20.431355951Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_zypqdjjj8keptnbi","createdAt":"2026-02-04T15:26:20.226Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4409921ae43a39a11d90f7b7f96cfd0b8093d9fc","toAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","blockNum":"0x27c841c","hash":"0x8545aa639454aa7151724702b2c48b100f30fe6e3b822418cb36544f558f0548","value":0.006300778085636084,"typeTraceAddress":"CALL_6","asset":"ETH","category":"internal","rawContract":{"rawValue":"0x166286379a57f4","decimals":18},"blockTimestamp":"0x6983651b"}]}}
2026-02-04T15:26:20.431359203Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:26:20.431363289Z [inf]  request completed
2026-02-04T15:26:20.431365940Z [inf]  [Webhook] ⚠️ Ignoring tx 0x8545aa: No matched tracked wallets in [0x4409, 0xfb64]
2026-02-04T15:26:20.450110735Z [inf]  [Webhook] ⚠️ Ignoring tx 0x12e0e5: No matched tracked wallets in [0xfb64, 0x2fc3]
2026-02-04T15:26:20.581924401Z [inf]  incoming request
2026-02-04T15:26:20.581931606Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_s9co6rw0lv6nloj4","createdAt":"2026-02-04T15:26:20.349Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","toAddress":"0xd87b6f1b9fcb9deb0baf5661ffd9775ab5e94a55","blockNum":"0x27c841c","hash":"0x8545aa639454aa7151724702b2c48b100f30fe6e3b822418cb36544f558f0548","value":12636649.580492882,"asset":"CLAWIAI","category":"token","rawContract":{"rawValue":"0x0000000000000000000000000000000000000000000a73ea257ad35f3b24fea3","address":"0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07","decimals":18},"log":{"address":"0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b","0x000000000000000000000000d87b6f1b9fcb9deb0baf5661ffd9775ab5e94a55"],"data":"0x0000000000000000000000000000000000000000000a73ea257ad35f3b24fea3","blockHash":"0x2fc7383221ad0b4bf56b75c9da99a61f14b887dbdf4cd32de144822968e747f4","blockNumber":"0x27c841c","blockTimestamp":"0x6983651b","transactionHash":"0x8545aa639454aa7151724702b2c48b100f30fe6e3b822418cb36544f558f0548","transactionIndex":"0x117","logIndex":"0x6bd","removed":false},"blockTimestamp":"0x6983651b"}],"source":"chainlake-kafka"}}
2026-02-04T15:26:20.581935677Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:26:20.581939213Z [inf]  request completed
2026-02-04T15:26:20.588105730Z [inf]  [Webhook] ⚠️ Ignoring tx 0x8545aa: No matched tracked wallets in [0xfb64, 0xd87b]
2026-02-04T15:26:21.473711286Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:26:21.610970479Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:26:21.789804642Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:26:21.873527043Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:26:22.013139349Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:26:22.147299705Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:26:22.268445637Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:26:22.402210738Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:26:22.548932470Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:26:24.965202018Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:26:26.032573997Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:26:26.032578157Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:26:26.032581845Z [err]  Critical: No valid price data available
2026-02-04T15:26:26.038364636Z [inf]  Auto-closing position: 0 balance found on-chain (likely manual sell)
2026-02-04T15:26:26.050349690Z [inf]  [Warpcast] Sending DM to FID 877398: "🔴 Sold $CLAWIAI
2026-02-04T15:26:26.050354413Z [inf]  
2026-02-04T15:26:26.050357576Z [inf]  🔴 **SOLD $CLAWIAI**
2026-02-04T15:26:26.050360624Z [inf]  💰 **Value*..."
2026-02-04T15:26:26.191607827Z [inf]  📊 Position P/L check
2026-02-04T15:26:26.396394821Z [inf]  [Warpcast] DM sent successfully. Daily usage: 2/50000
2026-02-04T15:26:33.394000502Z [inf]  [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
2026-02-04T15:26:33.394006582Z [inf]  Fetching premium trending tokens
2026-02-04T15:26:33.415968570Z [err]  DexScreener WS: Connection error
2026-02-04T15:26:36.405958488Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:26:36.742900811Z [inf]  0x API price received successfully
2026-02-04T15:26:36.912547099Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:26:38.035226581Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:26:38.316808910Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:26:38.316811810Z [inf]  📊 Position P/L check
2026-02-04T15:26:41.566034748Z [err]  DexScreener WS: Connection error
2026-02-04T15:26:41.717885981Z [err]  DexScreener WS: Connection error
2026-02-04T15:26:41.717891024Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:26:41.717894238Z [wrn]  WS returned 0 addresses
2026-02-04T15:26:41.717897598Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:26:42.069148873Z [inf]  Merged addresses
2026-02-04T15:26:42.699304548Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:26:42.944988211Z [inf]  Skipping low liquidity token
2026-02-04T15:26:47.352428701Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:26:48.378513960Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:26:48.458602673Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:26:48.500594571Z [inf]  📊 Position P/L check
2026-02-04T15:26:50.397887872Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:26:54.733674550Z [inf]  Trending tokens fetch complete
2026-02-04T15:26:54.733677166Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:26:54.733679854Z [inf]  [TokenJob] Got 100 trending tokens for Base
2026-02-04T15:26:54.781276103Z [inf]  Saved 100 trending tokens for base to database and memory cache
2026-02-04T15:26:54.803966767Z [inf]  [TokenJob] Saved 100 tokens for Base to DB + cache
2026-02-04T15:26:58.701468491Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:26:58.776557208Z [inf]  📊 Position P/L check
2026-02-04T15:27:18.777092357Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:27:18.777097804Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:27:18.777100768Z [inf]  0x API price received successfully
2026-02-04T15:27:18.777104117Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:27:18.777107793Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:27:20.984958827Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:27:23.174140602Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:27:23.323121850Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:27:23.328225758Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:27:23.462092427Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:27:23.582521087Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:27:23.710425449Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:27:23.868362103Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:27:24.866473241Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-04T15:27:24.866476132Z [inf]  Fetching premium trending tokens
2026-02-04T15:27:24.866480075Z [err]  DexScreener WS: Connection error
2026-02-04T15:27:30.949159952Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:27:33.396322480Z [err]  DexScreener WS: Connection error
2026-02-04T15:27:33.396326915Z [err]  DexScreener WS: Connection error
2026-02-04T15:27:33.396330112Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:27:33.396333127Z [wrn]  WS returned 0 addresses
2026-02-04T15:27:33.396336282Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:27:33.998566625Z [inf]  Merged addresses
2026-02-04T15:27:34.404309319Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:27:34.404314210Z [err]  Error fetching trending tokens
2026-02-04T15:27:34.404317152Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:27:34.404320207Z [inf]  [TokenJob] Got 31 trending tokens for BSC
2026-02-04T15:27:34.404323606Z [err]  [TokenJob] New list too small (31) for BSC; keeping existing (100)
2026-02-04T15:27:34.404326807Z [inf]  [TokenJob] Refreshed 4 primary chains in 154.0s
2026-02-04T15:27:41.009910305Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:27:41.439862019Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:27:41.439865564Z [inf]  0x API price received successfully
2026-02-04T15:27:42.460753974Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:27:42.554050263Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:28:02.693881215Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:28:02.693883955Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:28:22.603082610Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:28:22.603086048Z [inf]  0x API price received successfully
2026-02-04T15:28:22.603089765Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:28:22.603093865Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:28:22.603099037Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:28:24.305913810Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:28:24.451173472Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:28:24.564083142Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:28:24.872004418Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:28:24.872010618Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:28:24.973898612Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:28:25.101636702Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:28:25.263088427Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:28:34.494302668Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:28:54.486309726Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:28:54.486312534Z [inf]  0x API price received successfully
2026-02-04T15:28:54.486315923Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:28:54.486318800Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:28:54.486321648Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:28:56.553028748Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:28:56.553031714Z [inf]  📊 Position P/L check
2026-02-04T15:29:16.545005447Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:29:16.545009572Z [inf]  📊 Position P/L check
2026-02-04T15:29:16.666212322Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:29:17.058160134Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:29:17.064224824Z [inf]  0x API price received successfully
2026-02-04T15:29:17.732789026Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:29:18.115982774Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:29:18.116046883Z [inf]  📊 Position P/L check
2026-02-04T15:29:25.774013573Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:29:26.188389599Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:29:26.337771816Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:29:26.540120357Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:29:26.587564585Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:29:26.724160653Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:29:26.849056296Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:29:28.183470883Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:29:28.222945674Z [inf]  📊 Position P/L check
2026-02-04T15:29:38.208873051Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:29:38.288472145Z [inf]  📊 Position P/L check
2026-02-04T15:29:58.321383118Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:29:58.321387242Z [inf]  0x API price received successfully
2026-02-04T15:29:58.321391338Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:29:58.321394968Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:29:58.321398505Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:29:59.863758472Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:30:00.617098925Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-04T15:30:00.690477923Z [err]  [Job] Real hot users file not found: 
2026-02-04T15:30:00.690480577Z [inf]  [Job] ✅ Got 612 quality users from database
2026-02-04T15:30:00.690483257Z [inf]  [SocialJob] fetchCastsFromUsers starting with 612 FIDs, target: 1000
2026-02-04T15:30:00.712394780Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-04T15:30:00.712399384Z [inf]  Timer finished: recalc_heat_scores
2026-02-04T15:30:00.853648914Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-04T15:30:00.853651711Z [inf]  Fetching premium trending tokens
2026-02-04T15:30:00.853654730Z [err]  DexScreener WS: Connection error
2026-02-04T15:30:09.927336525Z [err]  DexScreener WS: Connection error
2026-02-04T15:30:10.028992095Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:30:16.130905520Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x489f33
2026-02-04T15:30:16.130953331Z [inf]  incoming request
2026-02-04T15:30:16.130956681Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_owq8nv2xyrepvnqu","createdAt":"2026-02-04T15:30:15.928Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0x8d0d118070b728e104294471fbe93c2e3affd694","blockNum":"0x27c8492","hash":"0x489f33ff3f5932e6dd9fc366839385fcda0315e8da3cf1d602bfec6aec208b0b","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x69836607"}],"source":"chainlake-kafka"}}
2026-02-04T15:30:16.130961044Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:30:16.130965059Z [inf]  request completed
2026-02-04T15:30:16.190845692Z [inf]  incoming request
2026-02-04T15:30:16.190851109Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_bac27xvk3x3we0ko","createdAt":"2026-02-04T15:30:15.974Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x8d0d118070b728e104294471fbe93c2e3affd694","toAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","blockNum":"0x27c8492","hash":"0x489f33ff3f5932e6dd9fc366839385fcda0315e8da3cf1d602bfec6aec208b0b","value":0.30396516553041864,"typeTraceAddress":"CALL_9","asset":"ETH","category":"internal","rawContract":{"rawValue":"0x437e6b523888db2","decimals":18},"blockTimestamp":"0x69836607"}]}}
2026-02-04T15:30:16.190855549Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:30:16.190858808Z [inf]  request completed
2026-02-04T15:30:16.190861794Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x489f33
2026-02-04T15:30:16.190864505Z [inf]  [Profile] fetchReceipt
2026-02-04T15:30:16.259647836Z [inf]  [Profile] fetchReceipt
2026-02-04T15:30:16.267429896Z [inf]  incoming request
2026-02-04T15:30:16.267433709Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_rof37h7cqwsstrvx","createdAt":"2026-02-04T15:30:15.984Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0x6ff5693b99212da76ad316178a184ab56d299b43","blockNum":"0x27c8492","hash":"0x489f33ff3f5932e6dd9fc366839385fcda0315e8da3cf1d602bfec6aec208b0b","value":455817225.76464677,"asset":"CLAWIAI","category":"token","rawContract":{"rawValue":"0x000000000000000000000000000000000000000001790b0d524ef4e4652a0da1","address":"0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07","decimals":18},"log":{"address":"0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000b4beddf1b828aaed9638601f7145b0f6093f2d3f","0x0000000000000000000000006ff5693b99212da76ad316178a184ab56d299b43"],"data":"0x000000000000000000000000000000000000000001790b0d524ef4e4652a0da1","blockHash":"0x9dc60439e2ef8d5ebfe37e8e38c18ae639c5a24e4477d4f5485dffbcd02d4004","blockNumber":"0x27c8492","blockTimestamp":"0x69836607","transactionHash":"0x489f33ff3f5932e6dd9fc366839385fcda0315e8da3cf1d602bfec6aec208b0b","transactionIndex":"0x83","logIndex":"0x27b","removed":false},"blockTimestamp":"0x69836607"}],"source":"chainlake-kafka"}}
2026-02-04T15:30:16.267437153Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:30:16.267444328Z [inf]  request completed
2026-02-04T15:30:16.267447512Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x489f33
2026-02-04T15:30:16.268287784Z [inf]  [Profile] fetchTransaction
2026-02-04T15:30:16.307696302Z [inf]  [Profile] fetchReceipt
2026-02-04T15:30:16.307700950Z [inf]  [Profile] parseSwapTransaction
2026-02-04T15:30:16.307703892Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0xb4beddf1: {
2026-02-04T15:30:16.307706914Z [inf]    tokenIn: '0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07',
2026-02-04T15:30:16.307709779Z [inf]    tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-04T15:30:16.307712445Z [inf]    dex: 'Uniswap v4'
2026-02-04T15:30:16.307715309Z [inf]  }
2026-02-04T15:30:16.307721170Z [inf]  Swap detected on target wallet
2026-02-04T15:30:16.307723896Z [inf]  Target is selling - triggering mirror sell
2026-02-04T15:30:16.389293868Z [inf]    tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-04T15:30:16.389300093Z [inf]    dex: 'Uniswap v4'
2026-02-04T15:30:16.389304313Z [inf]  }
2026-02-04T15:30:16.389309418Z [inf]  Swap detected on target wallet
2026-02-04T15:30:16.389329121Z [inf]  [Profile] fetchTransaction
2026-02-04T15:30:16.389333885Z [inf]  [Profile] parseSwapTransaction
2026-02-04T15:30:16.389337871Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0xb4beddf1: {
2026-02-04T15:30:16.389341008Z [inf]    tokenIn: '0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07',
2026-02-04T15:30:16.437619902Z [inf]  [Profile] fetchTransaction
2026-02-04T15:30:16.437625219Z [inf]  [Profile] parseSwapTransaction
2026-02-04T15:30:16.437629771Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0xb4beddf1: {
2026-02-04T15:30:16.437632782Z [inf]    tokenIn: '0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07',
2026-02-04T15:30:16.437635811Z [inf]    tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-04T15:30:16.437638979Z [inf]    dex: 'Uniswap v4'
2026-02-04T15:30:16.437641860Z [inf]  }
2026-02-04T15:30:16.437644673Z [inf]  Swap detected on target wallet
2026-02-04T15:30:16.516816178Z [inf]  Timer finished: launchpad_det_0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
2026-02-04T15:30:16.516819756Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:30:16.516824585Z [wrn]  All API liquidity sources failed
2026-02-04T15:30:17.616992940Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:30:17.616996735Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:30:17.824882328Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:30:17.824888836Z [wrn]  WS returned 0 addresses
2026-02-04T15:30:17.824892752Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:30:18.016358534Z [inf]  0x API price received successfully
2026-02-04T15:30:18.016362007Z [err]  Critical: No valid price data available
2026-02-04T15:30:18.147377192Z [inf]  Merged addresses
2026-02-04T15:30:18.473182450Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:30:20.306582502Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:30:20.547678846Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:30:20.685224785Z [inf]  0x API price received successfully
2026-02-04T15:30:21.050301608Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:30:21.373391201Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:30:23.106039119Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:30:24.121595716Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:30:26.149603032Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:30:27.348272881Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:30:27.526742500Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:30:27.656545505Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:30:27.846271046Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:30:28.210019304Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:30:28.331373715Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:30:30.161343752Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:30:30.161350687Z [err]  GeckoTerminal API error after retries
2026-02-04T15:30:30.161357244Z [err]  Error fetching trending tokens
2026-02-04T15:30:30.161361694Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:30:30.161365868Z [inf]  [TokenJob] Got 27 trending tokens for Ethereum
2026-02-04T15:30:30.171715146Z [err]  [TokenJob] New list too small (27) for Ethereum; keeping existing (100)
2026-02-04T15:30:31.414604350Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:30:51.414097151Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:30:51.543918427Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:30:51.843297741Z [inf]  0x API price received successfully
2026-02-04T15:30:51.921167480Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:30:53.120659584Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:30:53.212555175Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:31:00.319217524Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-04T15:31:00.319221430Z [inf]  Fetching premium trending tokens
2026-02-04T15:31:00.324484506Z [err]  DexScreener WS: Connection error
2026-02-04T15:31:03.227729768Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:31:23.268715800Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:31:23.268734104Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:31:23.268737109Z [inf]  📊 Position P/L check
2026-02-04T15:31:23.268740132Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:31:23.268744324Z [err]  DexScreener WS: Connection error
2026-02-04T15:31:23.268748006Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:31:23.268751042Z [wrn]  WS returned 0 addresses
2026-02-04T15:31:23.268754259Z [inf]  Merged addresses
2026-02-04T15:31:23.268757295Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:31:23.275981485Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-04T15:31:23.275985550Z [inf]  [TokenJob] Filtered out 2 invalid tokens for Solana
2026-02-04T15:31:23.275989632Z [inf]  Saved 98 trending tokens for solana to database and memory cache
2026-02-04T15:31:23.275993140Z [inf]  [TokenJob] Saved 98 tokens for Solana to DB + cache
2026-02-04T15:31:23.348892638Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:31:23.734813489Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:31:23.734818038Z [inf]  0x API price received successfully
2026-02-04T15:31:24.431681394Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:31:24.464705255Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:31:24.486597328Z [inf]  📊 Position P/L check
2026-02-04T15:31:28.907535381Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:31:29.091854427Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:31:29.234977022Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:31:29.426333715Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:31:29.550628311Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:31:29.784604408Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:31:29.862238936Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:31:29.946478995Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:31:30.089489340Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:31:34.581712280Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:31:34.645995514Z [inf]  📊 Position P/L check
2026-02-04T15:31:54.645692579Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:31:54.645695441Z [inf]  📊 Position P/L check
2026-02-04T15:31:54.645701168Z [inf]  [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
2026-02-04T15:31:54.645704934Z [inf]  Fetching premium trending tokens
2026-02-04T15:31:54.645707926Z [err]  DexScreener WS: Connection error
2026-02-04T15:31:54.742332074Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:31:55.273304043Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:31:55.273306997Z [inf]  0x API price received successfully
2026-02-04T15:31:56.286210325Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:31:56.623059594Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:31:56.658882112Z [inf]  📊 Position P/L check
2026-02-04T15:32:16.648250280Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:32:16.648256683Z [inf]  📊 Position P/L check
2026-02-04T15:32:16.648260465Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:32:16.648264875Z [wrn]  WS returned 0 addresses
2026-02-04T15:32:16.648270112Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:32:16.648274166Z [inf]  Merged addresses
2026-02-04T15:32:16.648277622Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:32:16.648281547Z [inf]  Repeated x3: API-5001:Skipping low liquidity token
2026-02-04T15:32:16.648284630Z [inf]  Skipping low liquidity token
2026-02-04T15:32:16.869609832Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:32:17.192336285Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:32:18.193058283Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:32:20.663369373Z [inf]  Skipping low liquidity token
2026-02-04T15:32:20.912500263Z [err]  Error fetching trending tokens
2026-02-04T15:32:20.912502834Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:32:20.912505368Z [inf]  [TokenJob] Got 45 trending tokens for Base
2026-02-04T15:32:20.912508051Z [err]  [TokenJob] New list too small (45) for Base; keeping existing (100)
2026-02-04T15:32:23.266537536Z [inf]  [SocialJob] Checking Zora coin status for 258 casts...
2026-02-04T15:32:26.997169433Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:32:27.427657562Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:32:27.449789126Z [inf]  0x API price received successfully
2026-02-04T15:32:28.452845999Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:32:28.644980129Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:32:30.574242602Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:32:30.786265786Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:32:30.905490145Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:32:31.026449081Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:32:31.275958282Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:32:31.280730497Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:32:31.421915374Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:32:34.968000232Z [inf]  [SocialRepo] Cleaned up 95 old casts (cap: 1000)
2026-02-04T15:32:35.643876971Z [inf]  Timer finished: get_trending_casts_trending
2026-02-04T15:32:36.065928868Z [inf]  SocialRepo: Updated cache with 500 merged casts
2026-02-04T15:32:36.065934000Z [inf]  SocialRepo: Saved 258 trending casts to database
2026-02-04T15:32:36.065937135Z [inf]  Timer finished: save_trending_casts
2026-02-04T15:32:36.065940097Z [inf]  [SocialJob] Casts refreshed: 258 saved
2026-02-04T15:32:36.065942863Z [inf]  [SocialJob] 🚀 Triggering OGP Prefetch for top 50 casts...
2026-02-04T15:32:38.680421935Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:32:58.666374342Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:32:58.666380485Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-04T15:32:58.666384169Z [inf]  Fetching premium trending tokens
2026-02-04T15:32:58.666390961Z [err]  DexScreener WS: Connection error
2026-02-04T15:32:58.666394589Z [err]  DexScreener WS: Connection error
2026-02-04T15:32:58.666399025Z [err]  DexScreener WS: Connection error
2026-02-04T15:32:58.666402583Z [err]  DexScreener WS: Connection error
2026-02-04T15:32:58.666406326Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:32:58.666409679Z [wrn]  WS returned 0 addresses
2026-02-04T15:32:58.666413296Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:32:58.667488463Z [inf]  Merged addresses
2026-02-04T15:32:58.667493610Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:32:58.667497321Z [err]  Error fetching trending tokens
2026-02-04T15:32:58.667500650Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:32:58.667504674Z [inf]  [TokenJob] Got 31 trending tokens for BSC
2026-02-04T15:32:58.667508868Z [err]  [TokenJob] New list too small (31) for BSC; keeping existing (100)
2026-02-04T15:32:58.667514209Z [inf]  [TokenJob] Refreshed 4 primary chains in 175.3s
2026-02-04T15:32:58.806135674Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:32:59.198696493Z [inf]  0x API price received successfully
2026-02-04T15:32:59.198700259Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:33:00.669251047Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:33:01.113031595Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:33:21.143593446Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:33:21.464738576Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:33:41.471283880Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:33:41.471288274Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:33:41.471291090Z [inf]  0x API price received successfully
2026-02-04T15:33:41.471293820Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:33:41.471296759Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:33:41.471299654Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:33:41.471302452Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:33:41.471305194Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:33:41.472123766Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:33:41.472130174Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:33:41.472133471Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:33:41.472137511Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:33:43.002703437Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:34:02.829338422Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:34:02.829342728Z [inf]  📊 Position P/L check
2026-02-04T15:34:03.179503038Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:34:03.586186047Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:34:03.586190664Z [inf]  0x API price received successfully
2026-02-04T15:34:04.134539046Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:34:04.636956492Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:34:04.658909257Z [inf]  📊 Position P/L check
2026-02-04T15:34:24.650977303Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:34:24.650984890Z [inf]  📊 Position P/L check
2026-02-04T15:34:24.724952009Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:34:24.745889226Z [inf]  📊 Position P/L check
2026-02-04T15:34:34.001959149Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:34:34.144534896Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:34:34.356022849Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:34:34.489614069Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:34:34.625505793Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:34:34.766041096Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:34:34.766043894Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:34:35.097767297Z [inf]  0x API price received successfully
2026-02-04T15:34:35.125739637Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:34:35.843552049Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:34:36.363300542Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:34:36.363304200Z [inf]  📊 Position P/L check
2026-02-04T15:34:46.290492806Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:34:46.619279017Z [inf]  📊 Position P/L check
2026-02-04T15:35:06.673744672Z [err]  DexScreener WS: Connection error
2026-02-04T15:35:06.673745667Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:35:06.673751566Z [err]  DexScreener WS: Connection error
2026-02-04T15:35:06.673757455Z [err]  DexScreener WS: Connection error
2026-02-04T15:35:06.673757833Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:35:06.673762804Z [err]  DexScreener WS: Connection error
2026-02-04T15:35:06.673766658Z [inf]  Merged addresses
2026-02-04T15:35:06.673773125Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:35:06.673778654Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:35:06.673782607Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:35:06.673784884Z [wrn]  WS returned 0 addresses
2026-02-04T15:35:06.673791571Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-04T15:35:06.673797839Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-04T15:35:06.673802548Z [inf]  Fetching premium trending tokens
2026-02-04T15:35:06.673809056Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-04T15:35:06.673814285Z [inf]  Timer finished: recalc_heat_scores
2026-02-04T15:35:06.754942861Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:35:07.178274148Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:35:07.184087753Z [inf]  0x API price received successfully
2026-02-04T15:35:07.248029993Z [inf]  ⚡ Uniswap V4 price fetched
2026-02-04T15:35:07.248036257Z [inf]  ⚡ Uniswap V4 price fetched
2026-02-04T15:35:07.692544394Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:35:08.769695110Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:35:08.769698997Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:35:09.787214933Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:35:13.773126353Z [err]  Error fetching trending tokens
2026-02-04T15:35:13.773133270Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:35:13.773137638Z [inf]  [TokenJob] Got 27 trending tokens for Ethereum
2026-02-04T15:35:13.773141202Z [err]  [TokenJob] New list too small (27) for Ethereum; keeping existing (100)
2026-02-04T15:35:13.773172464Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:35:13.773176858Z [err]  GeckoTerminal API error after retries
2026-02-04T15:35:18.789468804Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:35:38.655220300Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:35:38.655223253Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:35:38.655226238Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:35:38.655229035Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:35:38.655231873Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:35:38.655234953Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:35:38.655238286Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:35:38.655241094Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:35:38.656203374Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:35:38.911587702Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:35:39.234654696Z [inf]  0x API price received successfully
2026-02-04T15:35:39.337521365Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:35:40.050279877Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:35:40.088823596Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:35:45.407561254Z [inf]  [TokenJob] Tokens for Solana are fresh, skipping API call
2026-02-04T15:35:50.118275411Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:36:10.115356389Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:36:10.225867516Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:36:10.545625578Z [inf]  0x API price received successfully
2026-02-04T15:36:10.566660460Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:36:11.388068961Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:36:11.754452287Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:36:11.772522221Z [inf]  📊 Position P/L check
2026-02-04T15:36:15.605867253Z [inf]  [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
2026-02-04T15:36:15.605872100Z [inf]  Fetching premium trending tokens
2026-02-04T15:36:15.622477676Z [err]  DexScreener WS: Connection error
2026-02-04T15:36:17.745101376Z [err]  DexScreener WS: Connection error
2026-02-04T15:36:21.930419860Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:36:21.981638714Z [inf]  📊 Position P/L check
2026-02-04T15:36:26.514444075Z [err]  DexScreener WS: Connection error
2026-02-04T15:36:26.514448925Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:36:26.514454813Z [wrn]  WS returned 0 addresses
2026-02-04T15:36:26.514459004Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:36:26.821832063Z [inf]  Merged addresses
2026-02-04T15:36:27.383709388Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:36:27.881033515Z [inf]  Repeated x2: API-5001:Skipping low liquidity token
2026-02-04T15:36:27.881039649Z [inf]  Skipping low liquidity token
2026-02-04T15:36:28.661683420Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:36:29.649544945Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:36:32.186251717Z [err]  Error fetching trending tokens
2026-02-04T15:36:32.186255806Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:36:32.186260907Z [inf]  [TokenJob] Got 45 trending tokens for Base
2026-02-04T15:36:32.186265242Z [err]  [TokenJob] New list too small (45) for Base; keeping existing (100)
2026-02-04T15:36:32.267266350Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:36:32.289075474Z [inf]  📊 Position P/L check
2026-02-04T15:36:33.253107172Z [inf]  incoming request
2026-02-04T15:36:33.259142847Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_d6coh7qn0rjjwjg2","createdAt":"2026-02-04T15:36:28.735Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0x6ff5693b99212da76ad316178a184ab56d299b43","blockNum":"0x27c854c","hash":"0x26c26434ecd3dc60a66eb4b9dcfd60a741d38272177185ce93883550fad8276e","value":305397541.2623133,"asset":"CLAWIAI","category":"token","rawContract":{"rawValue":"0x000000000000000000000000000000000000000000fc9e71e2aaa9329ff0a7da","address":"0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07","decimals":18},"log":{"address":"0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000b4beddf1b828aaed9638601f7145b0f6093f2d3f","0x0000000000000000000000006ff5693b99212da76ad316178a184ab56d299b43"],"data":"0x000000000000000000000000000000000000000000fc9e71e2aaa9329ff0a7da","blockHash":"0xad8b050b14bee680bac3eb768993766198e20280d577e3f14d7ac6d269574119","blockNumber":"0x27c854c","blockTimestamp":"0x6983677b","transactionHash":"0x26c26434ecd3dc60a66eb4b9dcfd60a741d38272177185ce93883550fad8276e","transactionIndex":"0x23a","logIndex":"0x446","removed":false},"blockTimestamp":"0x6983677b"}],"source":"chainlake-kafka"}}
2026-02-04T15:36:33.259149104Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:36:33.259155030Z [inf]  request completed
2026-02-04T15:36:33.262367204Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x26c264
2026-02-04T15:36:33.284999623Z [inf]  [Profile] fetchReceipt
2026-02-04T15:36:33.354162219Z [inf]  [Profile] fetchTransaction
2026-02-04T15:36:33.354167608Z [inf]  [Profile] parseSwapTransaction
2026-02-04T15:36:33.354170912Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0xb4beddf1: {
2026-02-04T15:36:33.354173621Z [inf]    tokenIn: '0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07',
2026-02-04T15:36:33.354177434Z [inf]    tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-04T15:36:33.354180447Z [inf]    dex: 'Uniswap v4'
2026-02-04T15:36:33.354183121Z [inf]  }
2026-02-04T15:36:33.354185789Z [inf]  Swap detected on target wallet
2026-02-04T15:36:33.359401978Z [inf]  Timer finished: launchpad_det_0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
2026-02-04T15:36:33.359407270Z [inf]  Target is selling - triggering mirror sell
2026-02-04T15:36:33.551089149Z [wrn]  All API liquidity sources failed
2026-02-04T15:36:33.551093825Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:36:33.573380910Z [inf]  incoming request
2026-02-04T15:36:33.573385289Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_lfu7qyp608oqzyp7","createdAt":"2026-02-04T15:36:28.702Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x8d0d118070b728e104294471fbe93c2e3affd694","toAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","blockNum":"0x27c854c","hash":"0x26c26434ecd3dc60a66eb4b9dcfd60a741d38272177185ce93883550fad8276e","value":0.30152811016185976,"typeTraceAddress":"CALL_9","asset":"ETH","category":"internal","rawContract":{"rawValue":"0x42f3e37f7fe14b6","decimals":18},"blockTimestamp":"0x6983677b"}]}}
2026-02-04T15:36:33.573388314Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:36:33.573391340Z [inf]  [Webhook] Tx already in processedTxs cache: 0x26c26434ecd3dc
2026-02-04T15:36:33.573395818Z [inf]  request completed
2026-02-04T15:36:33.595549308Z [inf]  incoming request
2026-02-04T15:36:33.595553641Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_bi0tt341xb82cv10","createdAt":"2026-02-04T15:36:28.658Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0x8d0d118070b728e104294471fbe93c2e3affd694","blockNum":"0x27c854c","hash":"0x26c26434ecd3dc60a66eb4b9dcfd60a741d38272177185ce93883550fad8276e","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x6983677b"}],"source":"chainlake-kafka"}}
2026-02-04T15:36:33.595556550Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:36:33.595559284Z [inf]  [Webhook] Tx already in processedTxs cache: 0x26c26434ecd3dc
2026-02-04T15:36:33.595563224Z [inf]  request completed
2026-02-04T15:36:34.559863341Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:36:34.559868047Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:36:34.888467404Z [inf]  0x API price received successfully
2026-02-04T15:36:34.888470175Z [err]  Critical: No valid price data available
2026-02-04T15:36:38.215476718Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:36:38.308581120Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:36:38.488596253Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:36:38.563836635Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:36:38.687226935Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:36:38.873230915Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:36:39.014620585Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:36:42.432193021Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:36:42.767739237Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:36:42.976950457Z [inf]  0x API price received successfully
2026-02-04T15:36:43.325110846Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:36:43.615883258Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:36:43.626804037Z [inf]  📊 Position P/L check
2026-02-04T15:37:03.715382738Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:37:03.715385831Z [inf]  📊 Position P/L check
2026-02-04T15:37:03.715389023Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-04T15:37:03.715392199Z [inf]  Fetching premium trending tokens
2026-02-04T15:37:03.715395883Z [err]  DexScreener WS: Connection error
2026-02-04T15:37:03.715398843Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:37:03.884073855Z [inf]  📊 Position P/L check
2026-02-04T15:37:10.927408071Z [err]  DexScreener WS: Connection error
2026-02-04T15:37:13.777675523Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:37:14.046420185Z [inf]  0x API price received successfully
2026-02-04T15:37:14.064507643Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:37:14.815748286Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:37:14.839179111Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:37:18.910545813Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:37:18.910549704Z [wrn]  WS returned 0 addresses
2026-02-04T15:37:18.910553019Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:37:19.843791010Z [inf]  Merged addresses
2026-02-04T15:37:20.169088389Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:37:20.169094954Z [err]  Error fetching trending tokens
2026-02-04T15:37:20.169098147Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:37:20.169101216Z [inf]  [TokenJob] Got 31 trending tokens for BSC
2026-02-04T15:37:20.170096592Z [err]  [TokenJob] New list too small (31) for BSC; keeping existing (100)
2026-02-04T15:37:20.193662119Z [inf]  [TokenJob] Refreshed 4 primary chains in 139.6s
2026-02-04T15:37:24.869256764Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:37:44.813557784Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:37:44.813565788Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:37:44.813570435Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:37:44.813574401Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:37:44.813578522Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:37:44.813583209Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:37:44.813587600Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:37:44.813591890Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:37:44.814465783Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:37:44.814470065Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:37:44.814473995Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:37:45.042875930Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:37:45.264890680Z [inf]  0x API price received successfully
2026-02-04T15:37:45.304551511Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:37:45.644957831Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:37:46.393858338Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:38:06.506647314Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:38:06.506653127Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:38:26.561945225Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:38:26.561952328Z [inf]  0x API price received successfully
2026-02-04T15:38:26.561956520Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:38:26.561960794Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:38:26.561964509Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:38:27.733623208Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:38:47.802694185Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:38:47.802698213Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:38:47.802701703Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:38:47.802705273Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:38:47.802709149Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:38:47.802713429Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:38:47.834785373Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:38:48.156958601Z [inf]  0x API price received successfully
2026-02-04T15:38:48.205432874Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:38:49.110105837Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:38:49.264981582Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:38:49.264984429Z [inf]  📊 Position P/L check
2026-02-04T15:39:09.316337239Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:39:09.316340253Z [inf]  📊 Position P/L check
2026-02-04T15:39:09.522530181Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:39:09.575419177Z [inf]  📊 Position P/L check
2026-02-04T15:39:19.654264755Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:39:19.895018360Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:39:19.896056087Z [inf]  0x API price received successfully
2026-02-04T15:39:20.729842846Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:39:21.222057133Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:39:21.290389368Z [inf]  📊 Position P/L check
2026-02-04T15:39:41.366366380Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:39:41.366369010Z [inf]  📊 Position P/L check
2026-02-04T15:39:41.368117257Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:39:41.688706031Z [inf]  📊 Position P/L check
2026-02-04T15:39:43.411637948Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:39:43.539235460Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:39:43.686920734Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:39:44.140110576Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:39:44.140113720Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:39:44.140118949Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:39:46.154203714Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:39:46.391632097Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:39:46.479409290Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:39:51.592497891Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:39:52.057995324Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:39:52.057999666Z [inf]  0x API price received successfully
2026-02-04T15:39:52.787364782Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:39:53.089447096Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:40:00.900867654Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-04T15:40:00.900872161Z [inf]  Fetching premium trending tokens
2026-02-04T15:40:00.956198235Z [err]  DexScreener WS: Connection error
2026-02-04T15:40:00.956204016Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-04T15:40:00.956208946Z [inf]  Timer finished: recalc_heat_scores
2026-02-04T15:40:01.226383951Z [err]  DexScreener WS: Connection error
2026-02-04T15:40:01.226387039Z [inf]  Saved 15 trending tokens to database via Prisma with retry protection
2026-02-04T15:40:01.226389792Z [inf]  [MarketJob] Trending tokens refreshed: 15 tokens
2026-02-04T15:40:01.865866375Z [err]  DexScreener WS: Connection error
2026-02-04T15:40:02.989083504Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:40:05.232106240Z [err]  DexScreener WS: Connection error
2026-02-04T15:40:05.232110467Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:40:05.232113633Z [wrn]  WS returned 0 addresses
2026-02-04T15:40:05.232116260Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:40:05.574247095Z [inf]  Merged addresses
2026-02-04T15:40:05.793278549Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:40:11.523570157Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:40:12.472049715Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:40:13.298650397Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:40:14.492459623Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:40:18.521793723Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:40:18.521797775Z [err]  GeckoTerminal API error after retries
2026-02-04T15:40:18.521801371Z [err]  Error fetching trending tokens
2026-02-04T15:40:18.521805018Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:40:18.521808607Z [inf]  [TokenJob] Got 27 trending tokens for Ethereum
2026-02-04T15:40:18.521811859Z [err]  [TokenJob] New list too small (27) for Ethereum; keeping existing (100)
2026-02-04T15:40:23.323734205Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:40:23.685092462Z [inf]  0x API price received successfully
2026-02-04T15:40:23.707098159Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:40:24.727016326Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:40:24.805118119Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:40:44.769158429Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:40:45.042251710Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:40:47.822425470Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:40:47.931743595Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:40:48.070152741Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:40:48.194439401Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:40:48.327528243Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:40:48.448721194Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:40:48.654815730Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-04T15:40:48.654819756Z [inf]  Fetching premium trending tokens
2026-02-04T15:40:48.654822936Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:40:48.654826778Z [err]  DexScreener WS: Connection error
2026-02-04T15:40:50.281919359Z [err]  DexScreener WS: Connection error
2026-02-04T15:40:55.153714738Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:40:55.540438916Z [inf]  0x API price received successfully
2026-02-04T15:40:55.784570760Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:40:56.865119351Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:40:56.865126004Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:40:58.472635692Z [err]  DexScreener WS: Connection error
2026-02-04T15:40:58.472640299Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:40:58.472643297Z [wrn]  WS returned 0 addresses
2026-02-04T15:40:58.472646073Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:40:58.848732013Z [inf]  Merged addresses
2026-02-04T15:40:59.526268953Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:40:59.526271824Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:40:59.526275487Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-04T15:40:59.526279017Z [inf]  [TokenJob] Filtered out 2 invalid tokens for Solana
2026-02-04T15:41:00.025200454Z [inf]  Saved 98 trending tokens for solana to database and memory cache
2026-02-04T15:41:00.025204071Z [inf]  [TokenJob] Saved 98 tokens for Solana to DB + cache
2026-02-04T15:41:06.902958205Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:41:26.797990982Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:41:26.797995458Z [inf]  📊 Position P/L check
2026-02-04T15:41:27.013168999Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:41:27.284463824Z [inf]  0x API price received successfully
2026-02-04T15:41:27.317646202Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:41:28.185786240Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:41:28.367989668Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:41:28.375093397Z [inf]  📊 Position P/L check
2026-02-04T15:41:29.799386815Z [inf]  [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
2026-02-04T15:41:29.799390071Z [inf]  Fetching premium trending tokens
2026-02-04T15:41:29.816711537Z [err]  DexScreener WS: Connection error
2026-02-04T15:41:31.053618070Z [err]  DexScreener WS: Connection error
2026-02-04T15:41:34.335589057Z [err]  DexScreener WS: Connection error
2026-02-04T15:41:38.398750183Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:41:38.455921364Z [inf]  📊 Position P/L check
2026-02-04T15:41:42.335379138Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:41:42.335385346Z [wrn]  WS returned 0 addresses
2026-02-04T15:41:42.335388254Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:41:42.674508767Z [inf]  Merged addresses
2026-02-04T15:41:43.248637243Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:41:43.573495088Z [inf]  Skipping low liquidity token
2026-02-04T15:41:47.621627203Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:41:48.465631593Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:41:48.547110387Z [inf]  📊 Position P/L check
2026-02-04T15:41:48.654599256Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:41:49.251060611Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:41:49.367349703Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:41:49.506010045Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:41:49.642778087Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:41:49.817956524Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:41:49.947507009Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:41:50.103330493Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:41:50.240777005Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:41:50.403340337Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:41:50.537229564Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:41:50.652797594Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:41:55.173002040Z [inf]  Trending tokens fetch complete
2026-02-04T15:41:55.173005111Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:41:55.173008306Z [inf]  [TokenJob] Got 100 trending tokens for Base
2026-02-04T15:41:55.183795554Z [inf]  Saved 100 trending tokens for base to database and memory cache
2026-02-04T15:41:55.313038938Z [inf]  [TokenJob] Saved 100 tokens for Base to DB + cache
2026-02-04T15:41:58.536550452Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:41:58.914449252Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:41:58.941765153Z [inf]  0x API price received successfully
2026-02-04T15:41:59.792152208Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:41:59.797265230Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:41:59.808521662Z [inf]  📊 Position P/L check
2026-02-04T15:42:19.813039746Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:42:19.899744325Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:42:25.230851806Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-04T15:42:25.230855202Z [inf]  Fetching premium trending tokens
2026-02-04T15:42:25.271309463Z [err]  DexScreener WS: Connection error
2026-02-04T15:42:29.982679490Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:42:30.344202967Z [inf]  0x API price received successfully
2026-02-04T15:42:30.604377638Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:42:30.969695263Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:42:31.620874388Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:42:34.616756806Z [err]  DexScreener WS: Connection error
2026-02-04T15:42:34.622985091Z [err]  DexScreener WS: Connection error
2026-02-04T15:42:34.622988772Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:42:34.622991666Z [wrn]  WS returned 0 addresses
2026-02-04T15:42:34.622994388Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:42:35.430847572Z [inf]  Merged addresses
2026-02-04T15:42:35.745960706Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:42:35.745964898Z [err]  Error fetching trending tokens
2026-02-04T15:42:35.745967916Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:42:35.745970526Z [inf]  [TokenJob] Got 31 trending tokens for BSC
2026-02-04T15:42:35.767685127Z [err]  [TokenJob] New list too small (31) for BSC; keeping existing (100)
2026-02-04T15:42:35.768859663Z [inf]  [TokenJob] Refreshed 4 primary chains in 154.9s
2026-02-04T15:42:41.655648854Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:43:01.618489528Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:43:01.618494289Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:43:01.618497551Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:43:01.618500934Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:43:01.618504401Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:43:01.618518145Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:43:01.618523626Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:43:01.618526554Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:43:01.619307550Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:43:01.619311179Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:43:01.880622833Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:43:02.157120704Z [inf]  0x API price received successfully
2026-02-04T15:43:02.319021918Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:43:02.870664236Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:43:03.650474157Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:43:23.650564087Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:43:23.786390295Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:43:43.780193086Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:43:43.780197822Z [inf]  0x API price received successfully
2026-02-04T15:43:43.780200830Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:43:43.780203923Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:43:43.780207111Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:43:45.157143571Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:43:53.700472037Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:43:53.856539320Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:43:54.000039409Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:43:54.203933828Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:43:54.245421805Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:43:54.366690698Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:43:55.009978914Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:43:55.202290795Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:43:55.225475375Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:43:55.306833202Z [inf]  📊 Position P/L check
2026-02-04T15:44:15.175558405Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:44:15.175564620Z [inf]  0x API price received successfully
2026-02-04T15:44:15.175568478Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:44:15.175576026Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:44:15.175579519Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:44:15.175584257Z [inf]  📊 Position P/L check
2026-02-04T15:44:16.890300906Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:44:16.962152428Z [inf]  📊 Position P/L check
2026-02-04T15:44:36.956139823Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:44:36.956143953Z [inf]  📊 Position P/L check
2026-02-04T15:44:37.053090460Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:44:37.420206238Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:44:37.425311591Z [inf]  0x API price received successfully
2026-02-04T15:44:38.625940758Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:44:38.625943330Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:44:38.625947328Z [inf]  📊 Position P/L check
2026-02-04T15:44:58.512746077Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:44:58.512750988Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:44:58.512754240Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:44:58.512756791Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:44:58.512759576Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:44:58.512762306Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:44:58.512764979Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:44:58.512767565Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:44:58.513544339Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:44:58.513548758Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:44:58.619712709Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:45:00.107927559Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-04T15:45:00.186298391Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-04T15:45:00.186301648Z [inf]  Fetching premium trending tokens
2026-02-04T15:45:00.196385414Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-04T15:45:00.196392220Z [inf]  Timer finished: recalc_heat_scores
2026-02-04T15:45:00.234770425Z [err]  DexScreener WS: Connection error
2026-02-04T15:45:02.471059873Z [inf]  incoming request
2026-02-04T15:45:02.471064748Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_6c5xcec7n12ozrj7","createdAt":"2026-02-04T15:45:02.261Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4d9000a7ea4e1fc3ae174425db931fc76cd2ba5e","toAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","blockNum":"0x27c864d","hash":"0x9043768970f3796d8536b0913ae7a52f66eb37510b24238697b9ecdfd78fdd6e","value":250,"asset":"FUEF","category":"token","rawContract":{"rawValue":"0x00000000000000000000000000000000000000000000000d8d726b7177a80000","address":"0xaae9a22c965f969371cc3da1fa17d5ac7be82096","decimals":18},"log":{"address":"0xaae9a22c965f969371cc3da1fa17d5ac7be82096","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000004d9000a7ea4e1fc3ae174425db931fc76cd2ba5e","0x000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b"],"data":"0x00000000000000000000000000000000000000000000000d8d726b7177a80000","blockHash":"0x8a8f92088e44a5c596792c66bc6e796b51458946560f39d0c91863028fb14e93","blockNumber":"0x27c864d","blockTimestamp":"0x6983697d","transactionHash":"0x9043768970f3796d8536b0913ae7a52f66eb37510b24238697b9ecdfd78fdd6e","transactionIndex":"0x20","logIndex":"0x179","removed":false},"blockTimestamp":"0x6983697d"}],"source":"chainlake-kafka"}}
2026-02-04T15:45:02.471894970Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:45:02.471902627Z [inf]  request completed
2026-02-04T15:45:02.484611788Z [inf]  [Webhook] ⚠️ Ignoring tx 0x904376: No matched tracked wallets in [0x4d90, 0xfb64]
2026-02-04T15:45:04.574720472Z [err]  DexScreener WS: Connection error
2026-02-04T15:45:04.869643751Z [err]  DexScreener WS: Connection error
2026-02-04T15:45:08.686291067Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:45:09.030141457Z [inf]  0x API price received successfully
2026-02-04T15:45:09.043000209Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:45:09.077818486Z [inf]  ⚡ Uniswap V4 price fetched
2026-02-04T15:45:09.083821011Z [inf]  ⚡ Uniswap V4 price fetched
2026-02-04T15:45:09.904694383Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:45:09.976719597Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:45:12.928681052Z [wrn]  WS returned 0 addresses
2026-02-04T15:45:12.928689620Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:45:12.928752521Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:45:13.040239794Z [inf]  Merged addresses
2026-02-04T15:45:13.260529451Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:45:17.372101834Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:45:18.241412998Z [inf]  incoming request
2026-02-04T15:45:18.241419872Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_vm4xjva7g6xri7qa","createdAt":"2026-02-04T15:45:18.042Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27c8655","hash":"0x19473764aab529946da642aafca871726fe216871b3db6b07c340531a6ab3eab","value":0.5,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x6f05b59d3b20000","decimals":18},"blockTimestamp":"0x6983698d"}],"source":"chainlake-kafka"}}
2026-02-04T15:45:18.241424452Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:45:18.241427901Z [inf]  request completed
2026-02-04T15:45:18.241615065Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x194737
2026-02-04T15:45:18.282157061Z [inf]  [Profile] fetchTransaction
2026-02-04T15:45:18.282159965Z [inf]  [Profile] fetchReceipt
2026-02-04T15:45:18.283259333Z [inf]  Swap successfully decoded from logs
2026-02-04T15:45:18.283262131Z [inf]  [Profile] parseSwapTransaction
2026-02-04T15:45:18.283265618Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0xb4beddf1: {
2026-02-04T15:45:18.283268798Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-04T15:45:18.283271547Z [inf]    tokenOut: '0x62456f94fb5f840aa8a791d7bb9230ba51b50d9f',
2026-02-04T15:45:18.283274253Z [inf]    dex: 'Uniswap v4'
2026-02-04T15:45:18.283276953Z [inf]  }
2026-02-04T15:45:18.283279804Z [inf]  Swap detected on target wallet
2026-02-04T15:45:18.289945854Z [inf]  Target is buying - triggering copy trade
2026-02-04T15:45:18.393413562Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:45:18.395858780Z [wrn]  All API liquidity sources failed
2026-02-04T15:45:18.418676458Z [inf]  incoming request
2026-02-04T15:45:18.418681968Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_kltfqwdn112gkw2c","createdAt":"2026-02-04T15:45:18.182Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4d9000a7ea4e1fc3ae174425db931fc76cd2ba5e","toAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","blockNum":"0x27c8655","hash":"0x650b26f900d5425f245b5da12b81b4bd2e6dd6c6ba144848e48ffa110c7c2e54","value":250,"asset":"FUEF","category":"token","rawContract":{"rawValue":"0x00000000000000000000000000000000000000000000000d8d726b7177a80000","address":"0xaae9a22c965f969371cc3da1fa17d5ac7be82096","decimals":18},"log":{"address":"0xaae9a22c965f969371cc3da1fa17d5ac7be82096","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000004d9000a7ea4e1fc3ae174425db931fc76cd2ba5e","0x000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b"],"data":"0x00000000000000000000000000000000000000000000000d8d726b7177a80000","blockHash":"0xfd2ae6b07a812550194cc39119cbd12beacd60da16702b972bf83409eea28cac","blockNumber":"0x27c8655","blockTimestamp":"0x6983698d","transactionHash":"0x650b26f900d5425f245b5da12b81b4bd2e6dd6c6ba144848e48ffa110c7c2e54","transactionIndex":"0x1a","logIndex":"0xae","removed":false},"blockTimestamp":"0x6983698d"},{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","blockNum":"0x27c8655","hash":"0x19473764aab529946da642aafca871726fe216871b3db6b07c340531a6ab3eab","value":3373743487.949109,"asset":"SUPERKY","category":"token","rawContract":{"rawValue":"0x00000000000000000000000000000000000000000ae6b1f8f3c0e9e1e2a2e2dc","address":"0x62456f94fb5f840aa8a791d7bb9230ba51b50d9f","decimals":18},"log":{"address":"0x62456f94fb5f840aa8a791d7bb9230ba51b50d9f","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x000000000000000000000000b4beddf1b828aaed9638601f7145b0f6093f2d3f"],"data":"0x00000000000000000000000000000000000000000ae6b1f8f3c0e9e1e2a2e2dc","blockHash":"0xfd2ae6b07a812550194cc39119cbd12beacd60da16702b972bf83409eea28cac","blockNumber":"0x27c8655","blockTimestamp":"0x6983698d","transactionHash":"0x19473764aab529946da642aafca871726fe216871b3db6b07c340531a6ab3eab","transactionIndex":"0x72","logIndex":"0x44e","removed":false},"blockTimestamp":"0x6983698d"}],"source":"chainlake-kafka"}}
2026-02-04T15:45:18.419926735Z [inf]  [Webhook] Processing as EVM activity (2 items)
2026-02-04T15:45:18.419934407Z [inf]  [Webhook] Tx already in processedTxs cache: 0x19473764aab529
2026-02-04T15:45:18.419938963Z [inf]  request completed
2026-02-04T15:45:18.422376840Z [inf]  [Webhook] ⚠️ Ignoring tx 0x650b26: No matched tracked wallets in [0x4d90, 0xfb64]
2026-02-04T15:45:18.439880801Z [inf]  Timer finished: launchpad_det_0x62456f94fb5f840aa8a791d7bb9230ba51b50d9f
2026-02-04T15:45:18.474658094Z [wrn]  All API liquidity sources failed
2026-02-04T15:45:18.474661714Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:45:18.475294775Z [wrn]  All API liquidity sources failed
2026-02-04T15:45:18.973504039Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:45:18.973506673Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:45:18.973509304Z [inf]  🔥 Warming up 1 user settings
2026-02-04T15:45:19.028239465Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-04T15:45:19.028242520Z [inf]  No eligible users after batch filter
2026-02-04T15:45:19.029401513Z [inf]  [Warpcast] Sending DM to FID 877398: "⏭️ Copy Trade Skipped: $SUPERKY
2026-02-04T15:45:19.029406354Z [inf]  
2026-02-04T15:45:19.029409753Z [inf]  ⏭️ **COPY TRADE S..."
2026-02-04T15:45:19.380418892Z [inf]  [Warpcast] DM sent successfully. Daily usage: 3/50000
2026-02-04T15:45:19.982765318Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:45:20.047403581Z [inf]  incoming request
2026-02-04T15:45:20.047410144Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_dgkprkh6pxm2xmap","createdAt":"2026-02-04T15:45:19.834Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0x62456f94fb5f840aa8a791d7bb9230ba51b50d9f","blockNum":"0x27c8656","hash":"0xe1abb070be9850c23c76378a68dcc916bde728e5b4f952ca7d3acc4ea581109f","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x6983698f"}],"source":"chainlake-kafka"}}
2026-02-04T15:45:20.047413844Z [inf]  request completed
2026-02-04T15:45:20.047417297Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:45:20.053293984Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0xe1abb0
2026-02-04T15:45:20.066173987Z [inf]  [Profile] fetchTransaction
2026-02-04T15:45:20.147988615Z [inf]  [Profile] fetchReceipt
2026-02-04T15:45:20.147993160Z [inf]  [Profile] parseSwapTransaction
2026-02-04T15:45:20.147996326Z [inf]  [Webhook] Not a swap tx for 0xb4beddf1: 0xe1abb070be9850
2026-02-04T15:45:20.417193833Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:45:24.436637654Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:45:24.436641210Z [err]  GeckoTerminal API error after retries
2026-02-04T15:45:24.436644437Z [err]  Error fetching trending tokens
2026-02-04T15:45:24.436648268Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:45:24.436651129Z [inf]  [TokenJob] Got 25 trending tokens for Ethereum
2026-02-04T15:45:24.453713672Z [err]  [TokenJob] New list too small (25) for Ethereum; keeping existing (100)
2026-02-04T15:45:30.098634934Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:45:50.049193819Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x382844
2026-02-04T15:45:50.049200563Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:45:50.049204448Z [inf]  incoming request
2026-02-04T15:45:50.049208426Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_xh8q15pkdwq6yp4r","createdAt":"2026-02-04T15:45:40.017Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","toAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","blockNum":"0x27c8660","hash":"0x3828440c06d8309c244b390b67756f94cc15a82c2016730687ec74b2c87e9860","value":0.518043731709351,"typeTraceAddress":"CALL_0_0_2","asset":"ETH","category":"internal","rawContract":{"rawValue":"0x73076077ea75446","decimals":18},"blockTimestamp":"0x698369a3"}]}}
2026-02-04T15:45:50.049227125Z [inf]  incoming request
2026-02-04T15:45:50.049230180Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_bn2i8rvjqpsd4zb1","createdAt":"2026-02-04T15:45:39.959Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27c8660","hash":"0x3828440c06d8309c244b390b67756f94cc15a82c2016730687ec74b2c87e9860","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x698369a3"}],"source":"chainlake-kafka"}}
2026-02-04T15:45:50.049233458Z [inf]  request completed
2026-02-04T15:45:50.049236554Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:45:50.050133316Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:45:50.050138154Z [inf]  request completed
2026-02-04T15:45:50.050142208Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x382844
2026-02-04T15:45:50.050145380Z [inf]  [Profile] fetchTransaction
2026-02-04T15:45:50.050149838Z [inf]  [Profile] fetchTransaction
2026-02-04T15:45:50.050152957Z [inf]  [Profile] fetchReceipt
2026-02-04T15:45:50.050156043Z [inf]  [Profile] parseSwapTransaction
2026-02-04T15:45:50.050159625Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0xb4beddf1: {
2026-02-04T15:45:50.050162968Z [inf]    tokenIn: '0x62456f94fb5f840aa8a791d7bb9230ba51b50d9f',
2026-02-04T15:45:50.050167557Z [inf]    tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-04T15:45:50.050171477Z [inf]    dex: 'Uniswap v4'
2026-02-04T15:45:50.050174698Z [inf]  }
2026-02-04T15:45:50.051020374Z [inf]  Swap detected on target wallet
2026-02-04T15:45:50.051023873Z [inf]  Timer finished: launchpad_det_0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
2026-02-04T15:45:50.051026714Z [inf]  Target is selling - triggering mirror sell
2026-02-04T15:45:50.051029575Z [inf]  incoming request
2026-02-04T15:45:50.051032607Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_h3wkhoca9qdukl7o","createdAt":"2026-02-04T15:45:40.243Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0x6ff5693b99212da76ad316178a184ab56d299b43","blockNum":"0x27c8660","hash":"0x3828440c06d8309c244b390b67756f94cc15a82c2016730687ec74b2c87e9860","value":3373743487.949109,"asset":"SUPERKY","category":"token","rawContract":{"rawValue":"0x00000000000000000000000000000000000000000ae6b1f8f3c0e9e1e2a2e2dc","address":"0x62456f94fb5f840aa8a791d7bb9230ba51b50d9f","decimals":18},"log":{"address":"0x62456f94fb5f840aa8a791d7bb9230ba51b50d9f","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000b4beddf1b828aaed9638601f7145b0f6093f2d3f","0x0000000000000000000000006ff5693b99212da76ad316178a184ab56d299b43"],"data":"0x00000000000000000000000000000000000000000ae6b1f8f3c0e9e1e2a2e2dc","blockHash":"0xd3a031f5fcc0cb97b40051c39205ab92aecbf584958ff04dd1b7da173dd8e0fa","blockNumber":"0x27c8660","blockTimestamp":"0x698369a3","transactionHash":"0x3828440c06d8309c244b390b67756f94cc15a82c2016730687ec74b2c87e9860","transactionIndex":"0x1","logIndex":"0x0","removed":false},"blockTimestamp":"0x698369a3"}],"source":"chainlake-kafka"}}
2026-02-04T15:45:50.052218296Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:45:50.052222167Z [inf]  [Webhook] Tx already in processedTxs cache: 0x3828440c06d830
2026-02-04T15:45:50.052226570Z [inf]  request completed
2026-02-04T15:45:50.052230533Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:45:50.052234096Z [inf]  [Profile] fetchReceipt
2026-02-04T15:45:50.052238085Z [inf]  [Profile] parseSwapTransaction
2026-02-04T15:45:50.052241896Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0xb4beddf1: {
2026-02-04T15:45:50.052245558Z [inf]    tokenIn: '0x62456f94fb5f840aa8a791d7bb9230ba51b50d9f',
2026-02-04T15:45:50.052249307Z [inf]    tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-04T15:45:50.052253556Z [inf]    dex: 'Uniswap v4'
2026-02-04T15:45:50.052257942Z [inf]  }
2026-02-04T15:45:50.052261239Z [inf]  Swap detected on target wallet
2026-02-04T15:45:50.053076755Z [inf]  0x API price received successfully
2026-02-04T15:45:50.053080709Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:45:50.053084101Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:45:51.664868004Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:45:54.517880985Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-04T15:45:54.517886063Z [inf]  Fetching premium trending tokens
2026-02-04T15:45:54.533907239Z [err]  DexScreener WS: Connection error
2026-02-04T15:45:54.781430287Z [err]  DexScreener WS: Connection error
2026-02-04T15:45:54.809606459Z [err]  DexScreener WS: Connection error
2026-02-04T15:45:55.508746377Z [err]  DexScreener WS: Connection error
2026-02-04T15:45:55.508752207Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:45:55.508755238Z [wrn]  WS returned 0 addresses
2026-02-04T15:45:55.508758044Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:45:55.678216724Z [inf]  Merged addresses
2026-02-04T15:45:56.192836628Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:45:56.192841319Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:45:56.192844732Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-04T15:45:56.192847992Z [inf]  [TokenJob] Filtered out 2 invalid tokens for Solana
2026-02-04T15:45:56.225664580Z [inf]  Saved 98 trending tokens for solana to database and memory cache
2026-02-04T15:45:56.245672869Z [inf]  [TokenJob] Saved 98 tokens for Solana to DB + cache
2026-02-04T15:45:58.175835784Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:45:58.261472464Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:45:59.016987987Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:45:59.184837521Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:45:59.457360131Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:45:59.457363194Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:46:01.758689397Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:46:21.749873107Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:46:21.749876021Z [inf]  0x API price received successfully
2026-02-04T15:46:21.749879752Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:46:21.749883278Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:46:21.749886872Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:46:21.749889406Z [inf]  📊 Position P/L check
2026-02-04T15:46:23.404678793Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:46:23.438238921Z [inf]  📊 Position P/L check
2026-02-04T15:46:26.289218193Z [inf]  [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
2026-02-04T15:46:26.289222281Z [inf]  Fetching premium trending tokens
2026-02-04T15:46:26.310753254Z [err]  DexScreener WS: Connection error
2026-02-04T15:46:33.434665666Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:46:33.496691618Z [inf]  📊 Position P/L check
2026-02-04T15:46:34.926320332Z [err]  DexScreener WS: Connection error
2026-02-04T15:46:42.966852917Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:46:42.966856109Z [wrn]  WS returned 0 addresses
2026-02-04T15:46:42.966860832Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:46:43.271175006Z [inf]  Merged addresses
2026-02-04T15:46:43.494853821Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:46:43.976807008Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:46:43.976810510Z [inf]  0x API price received successfully
2026-02-04T15:46:43.976814205Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:46:44.386089529Z [inf]  Repeated x2: API-5001:Skipping low liquidity token
2026-02-04T15:46:44.386092948Z [inf]  Skipping low liquidity token
2026-02-04T15:46:44.966468971Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:46:44.966471964Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:46:44.966474916Z [inf]  📊 Position P/L check
2026-02-04T15:46:46.158288398Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:46:47.163430440Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T15:46:49.703367100Z [err]  Error fetching trending tokens
2026-02-04T15:46:49.703370446Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:46:49.703374268Z [inf]  [TokenJob] Got 45 trending tokens for Base
2026-02-04T15:46:49.703377716Z [err]  [TokenJob] New list too small (45) for Base; keeping existing (100)
2026-02-04T15:46:54.854004930Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:46:54.895307462Z [inf]  📊 Position P/L check
2026-02-04T15:46:59.932700615Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:47:00.210568450Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:47:00.244682931Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:47:00.426630788Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:47:00.543619927Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:47:00.822632095Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:47:00.943444395Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:47:04.898240422Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:47:04.940471782Z [inf]  📊 Position P/L check
2026-02-04T15:47:24.966447155Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:47:24.966450823Z [inf]  0x API price received successfully
2026-02-04T15:47:24.966454389Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:47:24.966458267Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:47:24.966462194Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:47:24.966465911Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-04T15:47:24.966470401Z [inf]  Fetching premium trending tokens
2026-02-04T15:47:24.966473875Z [err]  DexScreener WS: Connection error
2026-02-04T15:47:24.972341961Z [err]  DexScreener WS: Connection error
2026-02-04T15:47:24.972350423Z [err]  DexScreener WS: Connection error
2026-02-04T15:47:24.972355752Z [err]  DexScreener WS: Connection error
2026-02-04T15:47:24.972360152Z [wrn]  DexScreener WS: All connection attempts failed
2026-02-04T15:47:24.972364704Z [wrn]  WS returned 0 addresses
2026-02-04T15:47:24.972369263Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T15:47:24.972373366Z [inf]  Merged addresses
2026-02-04T15:47:24.972377329Z [inf]  Processed DexScreener trending candidates
2026-02-04T15:47:24.972381789Z [err]  Error fetching trending tokens
2026-02-04T15:47:24.972388423Z [inf]  Premium trending tokens fetch complete
2026-02-04T15:47:24.972392818Z [inf]  [TokenJob] Got 31 trending tokens for BSC
2026-02-04T15:47:24.972397547Z [err]  [TokenJob] New list too small (31) for BSC; keeping existing (100)
2026-02-04T15:47:24.972402325Z [inf]  [TokenJob] Refreshed 4 primary chains in 140.9s
2026-02-04T15:47:26.123627306Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:47:46.109018915Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:47:46.281963227Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:47:46.684784117Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:47:46.686216070Z [inf]  0x API price received successfully
2026-02-04T15:47:47.442531512Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:47:47.707616288Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:47:57.677449802Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:48:02.957819316Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:48:03.093333856Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:48:03.235751155Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:48:03.376260801Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:48:03.765282178Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:48:03.923442189Z [inf]  Alpha Detector: Checking new coin
2026-02-04T15:48:07.727923968Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:48:14.288344939Z [inf]  incoming request
2026-02-04T15:48:14.288349146Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_wmn0loc5ayy0a9la","createdAt":"2026-02-04T15:48:14.105Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0x8d0d118070b728e104294471fbe93c2e3affd694","blockNum":"0x27c86ad","hash":"0x87c95f33ef6ab0fd8e1368fcd37cf298e104fc30210af251561969fb4cff86b6","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x69836a3d"}],"source":"chainlake-kafka"}}
2026-02-04T15:48:14.288352571Z [inf]  request completed
2026-02-04T15:48:14.288355327Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:48:14.294461233Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x87c95f
2026-02-04T15:48:14.327645712Z [inf]  [Profile] fetchTransaction
2026-02-04T15:48:14.333214137Z [inf]  [Profile] fetchReceipt
2026-02-04T15:48:14.333219946Z [inf]  [Profile] parseSwapTransaction
2026-02-04T15:48:14.333223879Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0xb4beddf1: {
2026-02-04T15:48:14.333227454Z [inf]    tokenIn: '0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07',
2026-02-04T15:48:14.333230616Z [inf]    tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-04T15:48:14.333233828Z [inf]    dex: 'Uniswap v4'
2026-02-04T15:48:14.333237348Z [inf]  }
2026-02-04T15:48:14.333240593Z [inf]  Swap detected on target wallet
2026-02-04T15:48:14.338092010Z [inf]  Target is selling - triggering mirror sell
2026-02-04T15:48:14.362135739Z [inf]  incoming request
2026-02-04T15:48:14.362141610Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_yvieqor3zjcyeptn","createdAt":"2026-02-04T15:48:14.184Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x8d0d118070b728e104294471fbe93c2e3affd694","toAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","blockNum":"0x27c86ad","hash":"0x87c95f33ef6ab0fd8e1368fcd37cf298e104fc30210af251561969fb4cff86b6","value":0.3457370110503736,"typeTraceAddress":"CALL_9","asset":"ETH","category":"internal","rawContract":{"rawValue":"0x4cc4dfad15ce1da","decimals":18},"blockTimestamp":"0x69836a3d"}]}}
2026-02-04T15:48:14.362145223Z [inf]  request completed
2026-02-04T15:48:14.362149003Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:48:14.362151853Z [inf]  [Webhook] Tx already in processedTxs cache: 0x87c95f33ef6ab0
2026-02-04T15:48:14.477477012Z [wrn]  All API liquidity sources failed
2026-02-04T15:48:14.477482738Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:48:14.570843842Z [inf]  incoming request
2026-02-04T15:48:14.570848571Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_jfxkoje2anfdz4ca","createdAt":"2026-02-04T15:48:14.292Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0x6ff5693b99212da76ad316178a184ab56d299b43","blockNum":"0x27c86ad","hash":"0x87c95f33ef6ab0fd8e1368fcd37cf298e104fc30210af251561969fb4cff86b6","value":204616352.64574993,"asset":"CLAWIAI","category":"token","rawContract":{"rawValue":"0x000000000000000000000000000000000000000000a94132b406d2a47a85144d","address":"0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07","decimals":18},"log":{"address":"0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000b4beddf1b828aaed9638601f7145b0f6093f2d3f","0x0000000000000000000000006ff5693b99212da76ad316178a184ab56d299b43"],"data":"0x000000000000000000000000000000000000000000a94132b406d2a47a85144d","blockHash":"0xf595e7aab2322847aab38815866c90070bac826e407a66841c82faa3ac65d5e3","blockNumber":"0x27c86ad","blockTimestamp":"0x69836a3d","transactionHash":"0x87c95f33ef6ab0fd8e1368fcd37cf298e104fc30210af251561969fb4cff86b6","transactionIndex":"0x97","logIndex":"0x41f","removed":false},"blockTimestamp":"0x69836a3d"}],"source":"chainlake-kafka"}}
2026-02-04T15:48:14.570851921Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T15:48:14.570854901Z [inf]  request completed
2026-02-04T15:48:14.570857777Z [inf]  [Webhook] Tx already in processedTxs cache: 0x87c95f33ef6ab0
2026-02-04T15:48:15.249265960Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T15:48:15.249269522Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T15:48:15.595043919Z [inf]  0x API price received successfully
2026-02-04T15:48:15.595046834Z [err]  Critical: No valid price data available
2026-02-04T15:48:17.227869442Z [inf]  incoming request
2026-02-04T15:48:17.227872041Z [inf]  request completed
2026-02-04T15:48:17.227875548Z [inf]  incoming request
2026-02-04T15:48:17.227878109Z [inf]  request completed
2026-02-04T15:48:17.227880889Z [inf]  incoming request
2026-02-04T15:48:17.227883459Z [inf]  request completed
2026-02-04T15:48:17.227886188Z [inf]  incoming request
2026-02-04T15:48:17.227888905Z [inf]  request completed
2026-02-04T15:48:17.228738229Z [inf]  incoming request
2026-02-04T15:48:17.228742899Z [inf]  request completed
2026-02-04T15:48:17.228746009Z [inf]  incoming request
2026-02-04T15:48:17.228749547Z [inf]  request completed
2026-02-04T15:48:17.228752388Z [inf]  incoming request
2026-02-04T15:48:17.228756773Z [inf]  request completed
2026-02-04T15:48:17.228759360Z [inf]  incoming request
2026-02-04T15:48:17.228762277Z [inf]  request completed
2026-02-04T15:48:17.229787608Z [inf]  incoming request
2026-02-04T15:48:17.229791105Z [inf]  request completed
2026-02-04T15:48:17.229793877Z [inf]  incoming request
2026-02-04T15:48:17.229796570Z [inf]  request completed
2026-02-04T15:48:17.229799217Z [inf]  incoming request
2026-02-04T15:48:17.229801989Z [inf]  request completed
2026-02-04T15:48:17.229804707Z [inf]  incoming request
2026-02-04T15:48:17.229807449Z [inf]  request completed
2026-02-04T15:48:17.230919660Z [inf]  incoming request
2026-02-04T15:48:17.230923137Z [inf]  request completed
2026-02-04T15:48:17.230927274Z [inf]  incoming request
2026-02-04T15:48:17.230930189Z [inf]  request completed
2026-02-04T15:48:17.480380602Z [inf]  incoming request
2026-02-04T15:48:17.480383591Z [inf]  incoming request
2026-02-04T15:48:17.480386792Z [inf]  incoming request
2026-02-04T15:48:17.481305518Z [inf]  incoming request
2026-02-04T15:48:17.481312700Z [inf]  incoming request
2026-02-04T15:48:17.481317694Z [inf]  incoming request
2026-02-04T15:48:17.481323805Z [inf]  incoming request
2026-02-04T15:48:17.481328774Z [inf]  incoming request
2026-02-04T15:48:17.481333561Z [inf]  incoming request
2026-02-04T15:48:17.481908911Z [inf]  incoming request
2026-02-04T15:48:17.487057285Z [inf]  incoming request
2026-02-04T15:48:17.487062750Z [inf]  incoming request
2026-02-04T15:48:17.487660693Z [inf]  incoming request
2026-02-04T15:48:17.488395418Z [inf]  incoming request
2026-02-04T15:48:17.629897264Z [inf]  request completed
2026-02-04T15:48:17.715679215Z [inf]  request completed
2026-02-04T15:48:17.783150603Z [inf]  request completed
2026-02-04T15:48:17.810976577Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T15:48:17.822517099Z [inf]  request completed
2026-02-04T15:48:17.822521582Z [inf]  request completed
2026-02-04T15:48:18.003891722Z [inf]  request completed
2026-02-04T15:48:18.003899866Z [inf]  request completed
2026-02-04T15:48:18.003905268Z [inf]  request completed
2026-02-04T15:48:18.003909683Z [inf]  request completed
2026-02-04T15:48:18.003954901Z [inf]  request completed
2026-02-04T15:48:18.003958713Z [inf]  request completed
2026-02-04T15:48:18.003961878Z [inf]  request completed
2026-02-04T15:48:18.003965092Z [inf]  request completed
2026-02-04T15:48:18.003968525Z [inf]  request completed
2026-02-04T15:48:18.124337820Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T15:48:18.228516377Z [inf]  0x API price received successfully
2026-02-04T15:48:19.013862543Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:48:19.330269700Z [inf]  ✅ Hybrid fetch complete
2026-02-04T15:48:19.806357469Z [inf]  incoming request
2026-02-04T15:48:19.806362991Z [inf]  incoming request
2026-02-04T15:48:19.806366508Z [inf]  incoming request
2026-02-04T15:48:19.806369361Z [inf]  incoming request
2026-02-04T15:48:19.806372017Z [inf]  incoming request
2026-02-04T15:48:20.006545357Z [err]  [ImageProxy] Upstream fetch failed for raw.githubusercontent.com: Upstream returned 404
2026-02-04T15:48:20.006550057Z [inf]  request completed
2026-02-04T15:48:20.006554225Z [err]  [ImageProxy] Upstream fetch failed for raw.githubusercontent.com: Upstream returned 404
2026-02-04T15:48:20.006559323Z [inf]  request completed
2026-02-04T15:48:20.006563937Z [err]  [ImageProxy] Upstream fetch failed for raw.githubusercontent.com: Upstream returned 404
2026-02-04T15:48:20.006569614Z [inf]  request completed
2026-02-04T15:48:20.006573577Z [err]  [ImageProxy] Upstream fetch failed for raw.githubusercontent.com: Upstream returned 404
2026-02-04T15:48:20.006578594Z [inf]  request completed
2026-02-04T15:48:20.006581970Z [err]  [ImageProxy] Upstream fetch failed for raw.githubusercontent.com: Upstream returned 404
2026-02-04T15:48:20.006587420Z [inf]  request completed
2026-02-04T15:48:20.182879692Z [inf]  incoming request
2026-02-04T15:48:20.187968046Z [inf]  incoming request
2026-02-04T15:48:20.187975031Z [inf]  incoming request
2026-02-04T15:48:20.193446553Z [inf]  incoming request
2026-02-04T15:48:20.195316512Z [inf]  incoming request
2026-02-04T15:48:20.200877126Z [inf]  incoming request
2026-02-04T15:48:20.251398682Z [inf]  request completed
2026-02-04T15:48:20.286348471Z [inf]  request completed
2026-02-04T15:48:20.286366996Z [err]  [ImageProxy] Upstream fetch failed for raw.githubusercontent.com: Upstream returned 404
2026-02-04T15:48:20.286370189Z [inf]  request completed
2026-02-04T15:48:20.286373437Z [err]  [ImageProxy] Upstream fetch failed for raw.githubusercontent.com: Upstream returned 404
2026-02-04T15:48:20.286376257Z [inf]  request completed
2026-02-04T15:48:20.286379240Z [err]  [ImageProxy] Upstream fetch failed for raw.githubusercontent.com: Upstream returned 404
2026-02-04T15:48:20.303174639Z [inf]  request completed
2026-02-04T15:48:20.396163489Z [inf]  request completed
2026-02-04T15:48:24.000000000Z [inf]  Stopping Container
2026-02-04T15:48:24.119473058Z [err]  npm error path /app
2026-02-04T15:48:24.119478128Z [err]  npm error command failed
2026-02-04T15:48:24.119485854Z [err]  npm error signal SIGTERM
2026-02-04T15:48:24.119490367Z [err]  npm error command sh -c node dist/index.js
2026-02-04T15:48:24.119494150Z [err]  npm error A complete log of this run can be found in: /root/.npm/_logs/2026-02-04T15_14_47_883Z-debug-0.log