2026-02-04T05:11:09.000000000Z [inf]  Starting Container
2026-02-04T05:11:10.282091786Z [inf]  
2026-02-04T05:11:10.282095665Z [inf]  > kiko-api@1.0.0 start
2026-02-04T05:11:10.282098968Z [inf]  > node dist/index.js
2026-02-04T05:11:10.282102619Z [inf]  
2026-02-04T05:11:12.308763644Z [inf]  [Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
2026-02-04T05:11:12.444490686Z [inf]  Zora SDK initialized with API Key
2026-02-04T05:11:12.815214487Z [err]  [SocialJob] Could not find real_hot_users.json in any candidate path
2026-02-04T05:11:13.294518686Z [inf]  [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
2026-02-04T05:11:13.439110231Z [inf]  [SkillRegistry:exec] Loading skills from /app/dist/skills...
2026-02-04T05:11:13.439114900Z [inf]  [SkillRegistry:clean] Loading skills from /app/dist/skills...
2026-02-04T05:11:13.554556239Z [inf]  Serving static files from:
2026-02-04T05:11:13.554559841Z [inf]  Initializing services...
2026-02-04T05:11:13.673602303Z [inf]  [Prisma] DB connection is healthy
2026-02-04T05:11:13.701791938Z [inf]  Database connection successful
2026-02-04T05:11:13.701796672Z [inf]  [DataRetention] Checking retention policies...
2026-02-04T05:11:13.713679149Z [inf]  [DataRetention] Starting cleanup job...
2026-02-04T05:11:13.713684102Z [inf]  Redis initialized
2026-02-04T05:11:13.713687217Z [inf]  Starting server on port 8080...
2026-02-04T05:11:13.833792523Z [inf]  Server listening at http://0.0.0.0:8080
2026-02-04T05:11:13.833797351Z [inf]  Server listening
2026-02-04T05:11:13.833800369Z [inf]  RPC health monitor started
2026-02-04T05:11:13.833803165Z [inf]  RPC benchmark sampling started
2026-02-04T05:11:13.855929864Z [inf]  [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
2026-02-04T05:11:13.855932806Z [inf]  [TokenJob] Scheduled: Primary chains every 5min (Ethereum, Solana, Base, BSC)
2026-02-04T05:11:13.855935759Z [inf]  [TokenJob] Scheduled: Secondary chains every 4h (Arbitrum, Optimism, Polygon)
2026-02-04T05:11:13.855938624Z [inf]  [SocialJob] Scheduled: Discovery (30m), Refresh (4h), Scoring (5m)
2026-02-04T05:11:13.855941724Z [inf]  Background jobs started
2026-02-04T05:11:13.855944516Z [inf]  Initializing auto trade service...
2026-02-04T05:11:13.855947225Z [inf]  [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
2026-02-04T05:11:13.855949916Z [inf]  Auto trade service initialized (Solana watcher + EVM webhook enabled)
2026-02-04T05:11:13.855952638Z [inf]  Auto trade service started
2026-02-04T05:11:13.855955254Z [inf]  [PositionMonitor] Starting position monitor (every 30s)...
2026-02-04T05:11:13.855957957Z [inf]  Position monitor started
2026-02-04T05:11:13.855960550Z [inf]  Token Alert Service started
2026-02-04T05:11:13.856956734Z [inf]  Token alert service started
2026-02-04T05:11:13.856962155Z [inf]  [ChatWorker] Started polling for AI tasks (interval: 3000ms)
2026-02-04T05:11:13.856967402Z [inf]  Chat worker started
2026-02-04T05:11:13.856971864Z [inf]  Starting Global Zora Alpha Detector (API Polling)
2026-02-04T05:11:13.856978058Z [inf]  🎉 All services initialized!
2026-02-04T05:11:13.960086219Z [err]  [DataRetention] No cleanup handler for table: SuggestionEvent
2026-02-04T05:11:13.971151172Z [inf]  [DataRetention] Cleanup job completed.
2026-02-04T05:11:18.846083391Z [inf]  [MarketJob] Running startup staleness check...
2026-02-04T05:11:18.851247224Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:11:18.856774767Z [inf]  [MarketJob] Overview is fresh, skipping API call
2026-02-04T05:11:18.857233564Z [inf]  [MarketJob] Protocols are fresh, skipping API call
2026-02-04T05:11:18.868002404Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-04T05:11:18.889508287Z [inf]  [SocialJob] Trending casts are fresh, skipping Snapchain API call
2026-02-04T05:11:19.330918234Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T05:11:19.330922188Z [inf]  0x API price received successfully
2026-02-04T05:11:19.410019687Z [wrn]  RPC endpoint failed
2026-02-04T05:11:19.542810354Z [wrn]  RPC endpoint failed
2026-02-04T05:11:19.941205928Z [inf]  RPC failover success
2026-02-04T05:11:20.368835993Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:11:20.368839621Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:11:20.368842648Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:11:20.368846705Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:11:20.473459467Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:11:20.473466854Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:11:20.484715442Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:11:20.484720135Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:11:40.532621902Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:11:40.931762032Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:11:43.904792539Z [inf]  [TokenJob] Starting initial token refresh...
2026-02-04T05:11:43.904795309Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-04T05:11:43.904798543Z [inf]  Fetching premium trending tokens
2026-02-04T05:11:43.904801408Z [err]  DexScreener WS: Connection error
2026-02-04T05:11:43.904804395Z [wrn]  WS returned 0 addresses
2026-02-04T05:11:43.904807123Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T05:11:44.340601466Z [inf]  Merged addresses
2026-02-04T05:11:44.787463936Z [inf]  Processed DexScreener trending candidates
2026-02-04T05:11:49.796377814Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T05:11:50.811247830Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T05:11:51.163592633Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:11:51.537365390Z [inf]  0x API price received successfully
2026-02-04T05:11:51.666104517Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T05:11:51.720342065Z [wrn]  RPC endpoint failed
2026-02-04T05:11:51.889088027Z [wrn]  RPC endpoint failed
2026-02-04T05:11:52.323094792Z [wrn]  RPC endpoint failed
2026-02-04T05:11:52.384196331Z [inf]  RPC failover success
2026-02-04T05:11:52.466365548Z [wrn]  RPC endpoint failed
2026-02-04T05:11:52.685127631Z [wrn]  RPC endpoint failed
2026-02-04T05:11:52.817708449Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T05:11:53.012452509Z [inf]  RPC failover success
2026-02-04T05:11:53.093806604Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:11:53.093813476Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:11:53.093817590Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:11:53.093820647Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:11:53.094690969Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:11:53.094695376Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:11:53.094699035Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:11:53.094702052Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:11:53.122677389Z [inf]  📊 Position P/L check
2026-02-04T05:11:56.837621301Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T05:11:56.837626533Z [err]  GeckoTerminal API error after retries
2026-02-04T05:11:56.837629720Z [err]  Error fetching trending tokens
2026-02-04T05:11:56.837632534Z [inf]  Premium trending tokens fetch complete
2026-02-04T05:11:56.837635703Z [inf]  [TokenJob] Got 27 trending tokens for Ethereum
2026-02-04T05:11:56.853535052Z [err]  [TokenJob] New list too small (27) for Ethereum; keeping existing (100)
2026-02-04T05:12:03.155185305Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:12:03.200031053Z [inf]  📊 Position P/L check
2026-02-04T05:12:23.178133068Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:12:23.178137825Z [inf]  📊 Position P/L check
2026-02-04T05:12:23.178140895Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:12:23.178144002Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:12:23.178146718Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:12:23.178149698Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:12:23.178152740Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:12:23.457795383Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:12:23.670131640Z [inf]  0x API price received successfully
2026-02-04T05:12:23.739381239Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T05:12:23.899853178Z [wrn]  RPC endpoint failed
2026-02-04T05:12:23.920794207Z [wrn]  RPC endpoint failed
2026-02-04T05:12:24.137980891Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:12:24.137989320Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:12:24.138047968Z [err]  Critical: No valid price data available
2026-02-04T05:12:24.676658870Z [inf]  RPC failover success
2026-02-04T05:12:25.202755955Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:12:25.202760429Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:12:25.202765628Z [err]  Critical: No valid price data available
2026-02-04T05:12:25.202771058Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T05:12:25.203188456Z [wrn]  RPC endpoint failed
2026-02-04T05:12:25.275940113Z [inf]  RPC failover success
2026-02-04T05:12:25.275942980Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T05:12:26.932087170Z [inf]  [TokenJob] Tokens for Solana are fresh, skipping API call
2026-02-04T05:12:35.246493967Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:12:35.396441979Z [wrn]  RPC endpoint failed
2026-02-04T05:12:35.596430605Z [inf]  RPC failover success
2026-02-04T05:12:35.867615940Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:12:35.867619288Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:12:35.867622690Z [err]  Critical: No valid price data available
2026-02-04T05:12:36.703349597Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:12:36.703353763Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:12:36.703357236Z [err]  Critical: No valid price data available
2026-02-04T05:12:36.703360594Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T05:12:36.848194597Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T05:12:56.832532849Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:12:56.832537522Z [wrn]  RPC endpoint failed
2026-02-04T05:12:56.832542098Z [wrn]  RPC endpoint failed
2026-02-04T05:12:56.832544822Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:12:56.832547604Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:12:56.832550397Z [err]  Critical: No valid price data available
2026-02-04T05:12:56.832553187Z [inf]  RPC failover success
2026-02-04T05:12:56.832555861Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:12:56.833048089Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:12:56.833052814Z [err]  Critical: No valid price data available
2026-02-04T05:12:56.833056134Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T05:12:56.833060524Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T05:12:56.833063249Z [inf]  incoming request
2026-02-04T05:12:56.833066206Z [inf]  request completed
2026-02-04T05:12:56.833069053Z [inf]  incoming request
2026-02-04T05:12:56.833864885Z [inf]  request completed
2026-02-04T05:12:56.833868467Z [inf]  incoming request
2026-02-04T05:12:56.833871444Z [inf]  request completed
2026-02-04T05:12:56.833875069Z [inf]  incoming request
2026-02-04T05:12:56.833877949Z [inf]  request completed
2026-02-04T05:12:56.833880614Z [inf]  incoming request
2026-02-04T05:12:56.833883283Z [inf]  request completed
2026-02-04T05:12:56.833886113Z [inf]  incoming request
2026-02-04T05:12:56.834769606Z [inf]  request completed
2026-02-04T05:12:56.834773565Z [inf]  incoming request
2026-02-04T05:12:56.834777272Z [inf]  request completed
2026-02-04T05:12:56.834780792Z [inf]  incoming request
2026-02-04T05:12:56.834784251Z [inf]  incoming request
2026-02-04T05:12:56.834787472Z [inf]  incoming request
2026-02-04T05:12:56.834790417Z [inf]  incoming request
2026-02-04T05:12:56.835672961Z [inf]  request completed
2026-02-04T05:12:56.835677441Z [inf]  request completed
2026-02-04T05:12:56.835680561Z [inf]  request completed
2026-02-04T05:12:56.835683438Z [inf]  request completed
2026-02-04T05:12:56.835687337Z [inf]  incoming request
2026-02-04T05:12:56.835690498Z [inf]  incoming request
2026-02-04T05:12:56.835693142Z [inf]  incoming request
2026-02-04T05:12:56.835695827Z [inf]  request completed
2026-02-04T05:12:56.836541080Z [inf]  request completed
2026-02-04T05:12:56.836545534Z [inf]  request completed
2026-02-04T05:12:56.836548760Z [inf]  incoming request
2026-02-04T05:12:56.836551502Z [inf]  ChatWS Client connected
2026-02-04T05:12:56.836554275Z [inf]  ChatWS: User connected
2026-02-04T05:12:56.910958964Z [err]  [DBLock] Lock already held (valid) {
2026-02-04T05:12:56.910962897Z [err]    key: 'lock:tokenJob:refresh:base',
2026-02-04T05:12:56.910966167Z [err]    expiresAt: '2026-02-04T05:15:13.390Z',
2026-02-04T05:12:56.910969202Z [err]    ageMs: 103497
2026-02-04T05:12:56.910972118Z [err]  }
2026-02-04T05:12:56.910975014Z [inf]  [TokenJob] Skipping refresh for Base - another instance holds the lock
2026-02-04T05:12:57.462712584Z [inf]  incoming request
2026-02-04T05:12:57.462716980Z [inf]  request completed
2026-02-04T05:12:57.462720667Z [inf]  incoming request
2026-02-04T05:12:57.462725224Z [inf]  request completed
2026-02-04T05:12:57.462729874Z [inf]  incoming request
2026-02-04T05:12:57.462733625Z [inf]  request completed
2026-02-04T05:12:57.799243513Z [inf]  incoming request
2026-02-04T05:12:57.799248326Z [inf]  incoming request
2026-02-04T05:12:57.799252093Z [inf]  incoming request
2026-02-04T05:12:57.799255057Z [inf]  [CopyTrade] GET /configs - Fetching configs for user did:privy:cmk74yj4r03jcl70b8hwyuh2c
2026-02-04T05:12:57.799258043Z [inf]  [CopyTrade] GET /positions - Fetching positions for did:privy:cmk74yj4r03jcl70b8hwyuh2c
2026-02-04T05:12:57.804144588Z [inf]  request completed
2026-02-04T05:12:57.804152902Z [inf]  request completed
2026-02-04T05:12:57.804158042Z [inf]  request completed
2026-02-04T05:12:58.071517251Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:12:58.468572856Z [inf]  0x API price received successfully
2026-02-04T05:12:58.548466916Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T05:12:58.552952381Z [wrn]  RPC endpoint failed
2026-02-04T05:12:58.652838808Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:12:58.652843659Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:12:58.826117408Z [inf]  RPC failover success
2026-02-04T05:12:58.899846807Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:12:58.899850686Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:12:58.939445588Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:12:58.939448872Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:12:59.321070270Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:12:59.321073265Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:13:04.931692662Z [inf]  incoming request
2026-02-04T05:13:04.931696836Z [inf]  incoming request
2026-02-04T05:13:04.931699557Z [inf]  request completed
2026-02-04T05:13:05.003720883Z [inf]  request completed
2026-02-04T05:13:05.332610986Z [inf]  incoming request
2026-02-04T05:13:05.337100764Z [inf]  request completed
2026-02-04T05:13:09.354073708Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:13:11.143277990Z [inf]  incoming request
2026-02-04T05:13:11.144268651Z [inf]  request completed
2026-02-04T05:13:11.145441224Z [inf]  incoming request
2026-02-04T05:13:11.145445722Z [inf]  request completed
2026-02-04T05:13:11.145448799Z [inf]  incoming request
2026-02-04T05:13:11.145451448Z [inf]  request completed
2026-02-04T05:13:11.146448584Z [inf]  incoming request
2026-02-04T05:13:11.146452743Z [inf]  request completed
2026-02-04T05:13:11.147344709Z [inf]  incoming request
2026-02-04T05:13:11.147350177Z [inf]  request completed
2026-02-04T05:13:11.147980015Z [inf]  incoming request
2026-02-04T05:13:11.147984440Z [inf]  request completed
2026-02-04T05:13:11.148583780Z [inf]  incoming request
2026-02-04T05:13:11.148587162Z [inf]  request completed
2026-02-04T05:13:11.149320871Z [inf]  incoming request
2026-02-04T05:13:11.149325476Z [inf]  request completed
2026-02-04T05:13:11.150310337Z [inf]  incoming request
2026-02-04T05:13:11.150313199Z [inf]  request completed
2026-02-04T05:13:11.151239044Z [inf]  incoming request
2026-02-04T05:13:11.151242624Z [inf]  request completed
2026-02-04T05:13:11.152309160Z [inf]  incoming request
2026-02-04T05:13:11.152312852Z [inf]  request completed
2026-02-04T05:13:11.152315781Z [inf]  incoming request
2026-02-04T05:13:11.152318477Z [inf]  request completed
2026-02-04T05:13:11.153237529Z [inf]  incoming request
2026-02-04T05:13:11.153241814Z [inf]  request completed
2026-02-04T05:13:11.154111303Z [inf]  incoming request
2026-02-04T05:13:11.154118956Z [inf]  request completed
2026-02-04T05:13:11.431917746Z [inf]  incoming request
2026-02-04T05:13:11.436624911Z [inf]  incoming request
2026-02-04T05:13:11.436629479Z [inf]  incoming request
2026-02-04T05:13:11.436633089Z [inf]  incoming request
2026-02-04T05:13:11.436635965Z [inf]  incoming request
2026-02-04T05:13:11.436638723Z [inf]  incoming request
2026-02-04T05:13:11.436641710Z [inf]  incoming request
2026-02-04T05:13:11.437415587Z [inf]  incoming request
2026-02-04T05:13:11.438453718Z [inf]  incoming request
2026-02-04T05:13:11.438461874Z [inf]  incoming request
2026-02-04T05:13:11.443457807Z [inf]  incoming request
2026-02-04T05:13:11.448551533Z [inf]  incoming request
2026-02-04T05:13:11.448557792Z [inf]  incoming request
2026-02-04T05:13:11.448562131Z [inf]  incoming request
2026-02-04T05:13:11.510142038Z [inf]  request completed
2026-02-04T05:13:11.510153096Z [inf]  request completed
2026-02-04T05:13:11.521069088Z [inf]  request completed
2026-02-04T05:13:11.521073801Z [inf]  request completed
2026-02-04T05:13:11.607838848Z [inf]  request completed
2026-02-04T05:13:11.618096938Z [inf]  request completed
2026-02-04T05:13:11.619182853Z [inf]  request completed
2026-02-04T05:13:11.619188304Z [inf]  request completed
2026-02-04T05:13:11.619192030Z [inf]  request completed
2026-02-04T05:13:11.619195539Z [inf]  request completed
2026-02-04T05:13:11.640350422Z [inf]  request completed
2026-02-04T05:13:11.640358217Z [inf]  request completed
2026-02-04T05:13:11.640366090Z [inf]  request completed
2026-02-04T05:13:11.640370667Z [inf]  request completed
2026-02-04T05:13:16.630196527Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:13:16.748146970Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:13:16.875893917Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:13:16.911028472Z [inf]  incoming request
2026-02-04T05:13:16.912134109Z [inf]  request completed
2026-02-04T05:13:16.912142711Z [inf]  incoming request
2026-02-04T05:13:16.912148733Z [inf]  request completed
2026-02-04T05:13:16.912152612Z [inf]  incoming request
2026-02-04T05:13:16.912155818Z [inf]  request completed
2026-02-04T05:13:16.912159734Z [inf]  incoming request
2026-02-04T05:13:16.912163176Z [inf]  request completed
2026-02-04T05:13:17.027243405Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:13:17.147004488Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:13:17.265161894Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:13:17.265165013Z [inf]  incoming request
2026-02-04T05:13:17.265168378Z [inf]  incoming request
2026-02-04T05:13:17.265171402Z [inf]  incoming request
2026-02-04T05:13:17.265176193Z [inf]  incoming request
2026-02-04T05:13:17.265179210Z [inf]  [CopyTrade] GET /positions - Fetching positions for did:privy:cmk74yj4r03jcl70b8hwyuh2c
2026-02-04T05:13:17.265182160Z [inf]  [verifyAccess] Checking access: {
2026-02-04T05:13:17.265185139Z [inf]    userId: 'did:privy:cmk74yj4r03jcl70b8hwyuh2c',
2026-02-04T05:13:17.265188793Z [inf]    userIdLength: 35,
2026-02-04T05:13:17.265191543Z [inf]    userIdPrefix: 'did:privy:cmk74yj4r0',
2026-02-04T05:13:17.265194334Z [inf]    requestedAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B'
2026-02-04T05:13:17.265784392Z [inf]  }
2026-02-04T05:13:17.265791938Z [inf]  [CopyTrade] GET /configs - Fetching configs for user did:privy:cmk74yj4r03jcl70b8hwyuh2c
2026-02-04T05:13:17.270696506Z [inf]  [verifyAccess] ✅ Access granted
2026-02-04T05:13:17.275918406Z [inf]  request completed
2026-02-04T05:13:17.275923875Z [inf]  request completed
2026-02-04T05:13:17.276818532Z [inf]  request completed
2026-02-04T05:13:17.428745393Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:13:17.487366098Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:13:17.609277837Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:13:18.265360943Z [err]  Alchemy Portfolio EVM API error
2026-02-04T05:13:18.441124448Z [inf]  request completed
2026-02-04T05:13:18.806024150Z [inf]  incoming request
2026-02-04T05:13:18.806029403Z [inf]  request completed
2026-02-04T05:13:19.077448375Z [inf]  incoming request
2026-02-04T05:13:19.422104187Z [err]  Alchemy Portfolio EVM API error
2026-02-04T05:13:19.422108752Z [inf]  request completed
2026-02-04T05:13:19.422112952Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:13:26.930378817Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-04T05:13:26.930385331Z [inf]  Fetching premium trending tokens
2026-02-04T05:13:26.943613866Z [err]  DexScreener WS: Connection error
2026-02-04T05:13:26.943620923Z [wrn]  WS returned 0 addresses
2026-02-04T05:13:26.943624274Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T05:13:27.515986474Z [inf]  Merged addresses
2026-02-04T05:13:27.954131364Z [inf]  Processed DexScreener trending candidates
2026-02-04T05:13:29.604034735Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:13:29.990950682Z [inf]  0x API price received successfully
2026-02-04T05:13:30.103722976Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T05:13:30.538489221Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:13:30.538492822Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:13:30.538496319Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:13:30.538500105Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:13:30.538504904Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:13:30.538508304Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:13:30.538511392Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:13:30.538514611Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:13:30.755409267Z [inf]  Skipping low liquidity token
2026-02-04T05:13:34.321405249Z [inf]  Trending tokens fetch complete
2026-02-04T05:13:34.321410287Z [inf]  Premium trending tokens fetch complete
2026-02-04T05:13:34.321413617Z [inf]  [TokenJob] Got 100 trending tokens for BSC
2026-02-04T05:13:34.366074823Z [inf]  Saved 100 trending tokens for bsc to database and memory cache
2026-02-04T05:13:34.380938393Z [inf]  [TokenJob] Saved 100 tokens for BSC to DB + cache
2026-02-04T05:13:34.390429004Z [inf]  [TokenJob] Refreshed 4 primary chains in 110.5s
2026-02-04T05:13:40.612556548Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:14:00.618504742Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:14:00.618508864Z [inf]  📊 Position P/L check
2026-02-04T05:14:00.685417673Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:14:01.089555528Z [inf]  0x API price received successfully
2026-02-04T05:14:01.113393487Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T05:14:01.323062213Z [wrn]  RPC endpoint failed
2026-02-04T05:14:01.569204341Z [inf]  RPC failover success
2026-02-04T05:14:01.876698340Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:14:01.876700920Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:14:01.876703829Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:14:01.876706625Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:14:01.938985056Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:14:01.938989223Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:14:01.938992312Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:14:01.938995091Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:14:01.977598708Z [inf]  📊 Position P/L check
2026-02-04T05:14:22.020895053Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:14:22.020897953Z [inf]  📊 Position P/L check
2026-02-04T05:14:22.020900798Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:14:22.020903749Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:14:22.020906550Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:14:22.020909335Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:14:22.020912087Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:14:22.020914926Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:14:22.021464904Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:14:22.052776418Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:14:22.117444478Z [inf]  📊 Position P/L check
2026-02-04T05:14:42.113884829Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:14:42.113888904Z [inf]  0x API price received successfully
2026-02-04T05:14:42.113891933Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T05:14:42.113897578Z [wrn]  RPC endpoint failed
2026-02-04T05:14:42.113900278Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:14:42.113902979Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:14:42.113905750Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:14:42.113908782Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:14:42.114869798Z [inf]  RPC failover success
2026-02-04T05:14:42.114873174Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:14:42.114875869Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:14:42.114878500Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:14:42.114881094Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:14:42.114883996Z [inf]  📊 Position P/L check
2026-02-04T05:14:43.071329435Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:14:43.110720729Z [inf]  📊 Position P/L check
2026-02-04T05:15:03.125479661Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:15:03.125482760Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-04T05:15:03.125485754Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-04T05:15:03.125489058Z [inf]  Fetching premium trending tokens
2026-02-04T05:15:03.125493435Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-04T05:15:03.125496438Z [inf]  Timer finished: recalc_heat_scores
2026-02-04T05:15:03.125499166Z [err]  DexScreener WS: Connection error
2026-02-04T05:15:03.125502076Z [wrn]  WS returned 0 addresses
2026-02-04T05:15:03.125509490Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T05:15:03.125512131Z [inf]  Merged addresses
2026-02-04T05:15:03.126102147Z [inf]  Processed DexScreener trending candidates
2026-02-04T05:15:03.204785694Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:15:03.599178065Z [inf]  0x API price received successfully
2026-02-04T05:15:03.706083323Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T05:15:04.077052237Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:15:04.077056844Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:15:04.088052773Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:15:04.088057568Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:15:04.397218962Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:15:04.397224568Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:15:04.397227555Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:15:04.397230508Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:15:04.900933712Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T05:15:05.913818949Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T05:15:07.926628530Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T05:15:11.937593052Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T05:15:11.937596262Z [err]  GeckoTerminal API error after retries
2026-02-04T05:15:11.937601413Z [err]  Error fetching trending tokens
2026-02-04T05:15:11.937604241Z [inf]  Premium trending tokens fetch complete
2026-02-04T05:15:11.937607184Z [inf]  [TokenJob] Got 27 trending tokens for Ethereum
2026-02-04T05:15:11.937610181Z [err]  [TokenJob] New list too small (27) for Ethereum; keeping existing (100)
2026-02-04T05:15:14.469732739Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:15:19.317115550Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:15:19.477589390Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:15:19.629210504Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:15:19.753298398Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:15:19.871356402Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:15:19.997532366Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:15:20.094772751Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:15:20.222522465Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:15:20.492955976Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:15:24.530846297Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:15:44.499263992Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:15:44.499268582Z [inf]  0x API price received successfully
2026-02-04T05:15:44.499273157Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T05:15:44.499277208Z [wrn]  RPC endpoint failed
2026-02-04T05:15:44.499281443Z [wrn]  RPC endpoint failed
2026-02-04T05:15:44.499285794Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:15:44.499289582Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:15:44.499294461Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:15:44.499959094Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:15:44.499962706Z [inf]  RPC failover success
2026-02-04T05:15:44.499965483Z [inf]  RPC failover success
2026-02-04T05:15:44.499968673Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:15:44.499971626Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:15:44.499974477Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:15:44.499977928Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:15:44.499980592Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-04T05:15:44.500706496Z [inf]  Fetching premium trending tokens
2026-02-04T05:15:44.500710810Z [err]  DexScreener WS: Connection error
2026-02-04T05:15:44.500715106Z [wrn]  WS returned 0 addresses
2026-02-04T05:15:44.500718440Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T05:15:44.500721625Z [inf]  Merged addresses
2026-02-04T05:15:44.500724830Z [inf]  Processed DexScreener trending candidates
2026-02-04T05:15:44.500727631Z [inf]  Premium trending tokens fetch complete
2026-02-04T05:15:44.500731488Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-04T05:15:44.500734427Z [inf]  [TokenJob] Filtered out 3 invalid tokens for Solana
2026-02-04T05:15:44.500738028Z [inf]  Saved 97 trending tokens for solana to database and memory cache
2026-02-04T05:15:44.501390133Z [inf]  [TokenJob] Saved 97 tokens for Solana to DB + cache
2026-02-04T05:15:45.499718082Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:16:05.494518719Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:16:05.702478206Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:16:06.069036143Z [inf]  0x API price received successfully
2026-02-04T05:16:06.114318743Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T05:16:06.148927079Z [wrn]  RPC endpoint failed
2026-02-04T05:16:06.357118811Z [inf]  RPC failover success
2026-02-04T05:16:06.397671383Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:16:06.397684299Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:16:06.397688545Z [err]  Critical: No valid price data available
2026-02-04T05:16:06.496760109Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:16:06.496763350Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:16:06.496767590Z [err]  Critical: No valid price data available
2026-02-04T05:16:06.509321197Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T05:16:06.510329427Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T05:16:13.120533271Z [err]  [DBLock] Cleaning expired/stale lock {
2026-02-04T05:16:13.120537900Z [err]    key: 'lock:tokenJob:refresh:base',
2026-02-04T05:16:13.120540858Z [err]    expiresAt: '2026-02-04T05:15:13.390Z',
2026-02-04T05:16:13.120547872Z [err]    ageMs: 299725,
2026-02-04T05:16:13.120551232Z [err]    isExpired: true,
2026-02-04T05:16:13.120554204Z [err]    isVeryStale: false
2026-02-04T05:16:13.120557223Z [err]  }
2026-02-04T05:16:13.142451972Z [inf]  [DBLock] Acquired lock after cleaning stale entry { key: 'lock:tokenJob:refresh:base' }
2026-02-04T05:16:13.143388303Z [inf]  [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
2026-02-04T05:16:13.143393560Z [inf]  Fetching premium trending tokens
2026-02-04T05:16:13.166183468Z [err]  DexScreener WS: Connection error
2026-02-04T05:16:13.166190318Z [wrn]  WS returned 0 addresses
2026-02-04T05:16:13.166193742Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T05:16:13.554157349Z [inf]  Merged addresses
2026-02-04T05:16:14.101377554Z [inf]  Processed DexScreener trending candidates
2026-02-04T05:16:14.876676270Z [inf]  Skipping low liquidity token
2026-02-04T05:16:16.227307739Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T05:16:16.513026654Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:16:16.715666315Z [wrn]  RPC endpoint failed
2026-02-04T05:16:16.715674600Z [wrn]  RPC endpoint failed
2026-02-04T05:16:16.887433799Z [wrn]  RPC endpoint failed
2026-02-04T05:16:16.897482556Z [wrn]  RPC endpoint failed
2026-02-04T05:16:17.105675026Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:16:17.105678724Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:16:17.105684069Z [err]  Critical: No valid price data available
2026-02-04T05:16:17.105687712Z [inf]  RPC failover success
2026-02-04T05:16:17.241017363Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T05:16:17.272833709Z [inf]  RPC failover success
2026-02-04T05:16:17.575659571Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:16:17.575663486Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:16:17.575667398Z [err]  Critical: No valid price data available
2026-02-04T05:16:17.615475958Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T05:16:17.615480881Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T05:16:19.267178586Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T05:16:20.949135745Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:16:21.113991527Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:16:21.134757924Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:16:21.286546015Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:16:21.388126601Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:16:21.499825856Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:16:21.648997147Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:16:23.877655121Z [err]  Error fetching trending tokens
2026-02-04T05:16:23.877657896Z [inf]  Premium trending tokens fetch complete
2026-02-04T05:16:23.877660575Z [inf]  [TokenJob] Got 45 trending tokens for Base
2026-02-04T05:16:23.898459567Z [inf]  Saved 45 trending tokens for base to database and memory cache
2026-02-04T05:16:23.903605099Z [inf]  [TokenJob] Saved 45 tokens for Base to DB + cache
2026-02-04T05:16:27.634058061Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:16:27.673775086Z [wrn]  RPC endpoint failed
2026-02-04T05:16:27.878202752Z [inf]  RPC failover success
2026-02-04T05:16:27.878209751Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:16:27.878212665Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:16:27.878215637Z [err]  Critical: No valid price data available
2026-02-04T05:16:28.024973348Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:16:28.024978058Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:16:28.024981297Z [err]  Critical: No valid price data available
2026-02-04T05:16:28.148365298Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T05:16:28.148370083Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T05:16:38.062414924Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:16:38.471446140Z [inf]  0x API price received successfully
2026-02-04T05:16:38.525441046Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T05:16:38.563839974Z [wrn]  RPC endpoint failed
2026-02-04T05:16:38.608113875Z [wrn]  RPC endpoint failed
2026-02-04T05:16:38.721930555Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:16:38.721935360Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:16:38.721938455Z [err]  Critical: No valid price data available
2026-02-04T05:16:38.780172362Z [inf]  RPC failover success
2026-02-04T05:16:38.910804436Z [inf]  RPC failover success
2026-02-04T05:16:39.106273854Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:16:39.106286435Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:16:39.106291259Z [err]  Critical: No valid price data available
2026-02-04T05:16:39.106295093Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T05:16:39.233197955Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T05:16:49.124186363Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:16:49.183751239Z [wrn]  RPC endpoint failed
2026-02-04T05:16:49.385875726Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:16:49.385880882Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:16:49.385885931Z [err]  Critical: No valid price data available
2026-02-04T05:16:49.478992219Z [inf]  RPC failover success
2026-02-04T05:16:49.857786059Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:16:49.857790562Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:16:49.857794393Z [err]  Critical: No valid price data available
2026-02-04T05:16:49.864217139Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T05:16:49.864222239Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T05:16:53.926639813Z [inf]  [TokenJob] Tokens for BSC are fresh, skipping API call
2026-02-04T05:16:53.931469293Z [inf]  [TokenJob] Refreshed 4 primary chains in 113.9s
2026-02-04T05:16:59.862267813Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:16:59.937121725Z [wrn]  RPC endpoint failed
2026-02-04T05:16:59.937126648Z [wrn]  RPC endpoint failed
2026-02-04T05:17:00.011034154Z [wrn]  RPC endpoint failed
2026-02-04T05:17:00.125996577Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:17:00.126001279Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:17:00.126005671Z [err]  Critical: No valid price data available
2026-02-04T05:17:00.156748725Z [inf]  RPC failover success
2026-02-04T05:17:00.217611679Z [inf]  RPC failover success
2026-02-04T05:17:00.438094341Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:17:00.438099076Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:17:00.438103591Z [err]  Critical: No valid price data available
2026-02-04T05:17:00.438108465Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T05:17:00.438112802Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T05:17:10.379870102Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:17:10.740041531Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T05:17:10.745881461Z [inf]  0x API price received successfully
2026-02-04T05:17:10.832830555Z [wrn]  RPC endpoint failed
2026-02-04T05:17:11.124856766Z [inf]  RPC failover success
2026-02-04T05:17:11.240935091Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:17:11.240938312Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:17:11.240941175Z [err]  Critical: No valid price data available
2026-02-04T05:17:11.296265374Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:17:11.296270297Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:17:11.296273630Z [err]  Critical: No valid price data available
2026-02-04T05:17:11.308461845Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T05:17:11.321078513Z [wrn]  TP/SL check skipped: Price not available
2026-02-04T05:17:31.291181132Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:17:31.291184884Z [wrn]  RPC endpoint failed
2026-02-04T05:17:31.291189313Z [inf]  RPC failover success
2026-02-04T05:17:31.291194214Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:17:31.291200070Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:17:31.291204299Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:17:31.291208247Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:17:31.291222492Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:17:31.291709910Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:17:31.291714904Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:17:31.291718850Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:17:31.291722445Z [inf]  📊 Position P/L check
2026-02-04T05:17:31.291725161Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:17:31.291728436Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:17:31.291731298Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:17:31.292471237Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:17:31.292476563Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:17:31.292479654Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:17:31.292482963Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:17:32.149471936Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:17:32.212307867Z [inf]  📊 Position P/L check
2026-02-04T05:17:52.239762889Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:17:52.239767386Z [inf]  0x API price received successfully
2026-02-04T05:17:52.239771011Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T05:17:52.239774667Z [inf]  📊 Position P/L check
2026-02-04T05:17:52.678953298Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:17:52.752254714Z [wrn]  RPC endpoint failed
2026-02-04T05:17:52.987556655Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:17:52.987591656Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:17:52.987595362Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:17:52.987598590Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:17:52.987601913Z [inf]  RPC failover success
2026-02-04T05:17:53.115230582Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:17:53.115235707Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:17:53.115238742Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:17:53.115241517Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:18:12.991853770Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:18:13.211817635Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:18:13.608059902Z [inf]  0x API price received successfully
2026-02-04T05:18:13.641699410Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T05:18:33.652100360Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:18:33.652106139Z [wrn]  RPC endpoint failed
2026-02-04T05:18:33.652109549Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:18:33.652112616Z [inf]  RPC failover success
2026-02-04T05:18:33.652115604Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:18:33.652118862Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:18:33.652121876Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:18:33.652125612Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:18:33.655522553Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:18:33.655530712Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:18:33.655535919Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:18:33.655539341Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:18:33.655543022Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:18:33.655546515Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:18:33.655550474Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:18:33.655554425Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:18:33.655572819Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:18:33.655577948Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:18:34.362980181Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:18:54.264305718Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:18:54.264310422Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T05:18:54.264314891Z [inf]  0x API price received successfully
2026-02-04T05:18:55.092777356Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:18:55.170537490Z [wrn]  RPC endpoint failed
2026-02-04T05:18:55.500443505Z [inf]  RPC failover success
2026-02-04T05:18:55.636632721Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:18:55.636635332Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:18:55.636637989Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:18:55.636640480Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:18:55.722016828Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:18:55.722023955Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:18:55.722029007Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:18:55.722034722Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:18:55.743783868Z [inf]  📊 Position P/L check
2026-02-04T05:19:15.746793324Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:19:15.746800323Z [inf]  📊 Position P/L check
2026-02-04T05:19:15.746804368Z [inf]  incoming request
2026-02-04T05:19:15.746808228Z [inf]  request completed
2026-02-04T05:19:15.746811419Z [inf]  incoming request
2026-02-04T05:19:15.746814308Z [inf]  request completed
2026-02-04T05:19:15.746817528Z [inf]  incoming request
2026-02-04T05:19:15.746820684Z [inf]  request completed
2026-02-04T05:19:15.747722926Z [inf]  request completed
2026-02-04T05:19:15.747727205Z [inf]  incoming request
2026-02-04T05:19:15.747730537Z [inf]  incoming request
2026-02-04T05:19:15.747733603Z [inf]  [verifyAccess] Checking access: {
2026-02-04T05:19:15.747750808Z [inf]  incoming request
2026-02-04T05:19:15.747758681Z [err]  [Error Handler] {
2026-02-04T05:19:15.747762877Z [err]    "requestId": "req-1u",
2026-02-04T05:19:15.747767308Z [err]    "method": "GET",
2026-02-04T05:19:15.747770932Z [err]    "url": "/api/billing/usage-summary",
2026-02-04T05:19:15.747775083Z [err]    "ip": "100.64.0.3",
2026-02-04T05:19:15.747778459Z [err]    "error": {
2026-02-04T05:19:15.747782964Z [err]      "message": "Missing Authorization Bearer token",
2026-02-04T05:19:15.747786027Z [err]      "name": "Error",
2026-02-04T05:19:15.747789045Z [err]      "code": "UNAUTHORIZED",
2026-02-04T05:19:15.747792487Z [err]      "statusCode": 401
2026-02-04T05:19:15.747795782Z [err]    }
2026-02-04T05:19:15.747798830Z [err]  }
2026-02-04T05:19:15.748324169Z [inf]    userId: 'did:privy:cmk74yj4r03jcl70b8hwyuh2c',
2026-02-04T05:19:15.748328428Z [inf]    userIdLength: 35,
2026-02-04T05:19:15.748331490Z [inf]    userIdPrefix: 'did:privy:cmk74yj4r0',
2026-02-04T05:19:15.748334445Z [inf]    requestedAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B'
2026-02-04T05:19:15.748337502Z [inf]  }
2026-02-04T05:19:15.748340079Z [inf]  request completed
2026-02-04T05:19:15.748342719Z [inf]  [verifyAccess] ✅ Access granted
2026-02-04T05:19:15.748345706Z [err]  Alchemy Portfolio EVM API error
2026-02-04T05:19:15.748348349Z [inf]  request completed
2026-02-04T05:19:15.748351066Z [inf]  incoming request
2026-02-04T05:19:15.748353636Z [inf]  request completed
2026-02-04T05:19:15.748356600Z [inf]  incoming request
2026-02-04T05:19:15.749337160Z [err]  Alchemy Portfolio EVM API error
2026-02-04T05:19:15.749342147Z [inf]  request completed
2026-02-04T05:19:15.749345761Z [inf]  incoming request
2026-02-04T05:19:15.749349998Z [inf]  request completed
2026-02-04T05:19:15.749353569Z [inf]  incoming request
2026-02-04T05:19:15.749357330Z [inf]  request completed
2026-02-04T05:19:15.749359940Z [inf]  incoming request
2026-02-04T05:19:15.749362586Z [inf]  request completed
2026-02-04T05:19:15.750229397Z [inf]  incoming request
2026-02-04T05:19:15.750234932Z [inf]  request completed
2026-02-04T05:19:15.750238665Z [inf]  incoming request
2026-02-04T05:19:15.750241925Z [inf]  request completed
2026-02-04T05:19:15.750244770Z [inf]  incoming request
2026-02-04T05:19:15.750247329Z [inf]  request completed
2026-02-04T05:19:15.750250192Z [inf]  incoming request
2026-02-04T05:19:15.750253037Z [inf]  request completed
2026-02-04T05:19:15.750874289Z [inf]  incoming request
2026-02-04T05:19:15.750878000Z [inf]  request completed
2026-02-04T05:19:15.750882760Z [inf]  incoming request
2026-02-04T05:19:15.750885801Z [inf]  request completed
2026-02-04T05:19:15.750889195Z [inf]  incoming request
2026-02-04T05:19:15.750892115Z [inf]  request completed
2026-02-04T05:19:15.750894721Z [inf]  incoming request
2026-02-04T05:19:15.750897235Z [inf]  request completed
2026-02-04T05:19:15.751773821Z [inf]  incoming request
2026-02-04T05:19:15.751779140Z [inf]  request completed
2026-02-04T05:19:15.751785334Z [inf]  incoming request
2026-02-04T05:19:15.751789480Z [inf]  request completed
2026-02-04T05:19:15.751793567Z [inf]  incoming request
2026-02-04T05:19:15.751797640Z [inf]  request completed
2026-02-04T05:19:15.751801410Z [inf]  incoming request
2026-02-04T05:19:15.751805422Z [inf]  request completed
2026-02-04T05:19:15.752471240Z [inf]  incoming request
2026-02-04T05:19:15.752474852Z [inf]  incoming request
2026-02-04T05:19:15.752477417Z [inf]  incoming request
2026-02-04T05:19:15.752480781Z [inf]  incoming request
2026-02-04T05:19:15.752483824Z [inf]  incoming request
2026-02-04T05:19:15.752486512Z [inf]  incoming request
2026-02-04T05:19:15.753305200Z [inf]  incoming request
2026-02-04T05:19:15.753309709Z [inf]  incoming request
2026-02-04T05:19:15.753312601Z [inf]  incoming request
2026-02-04T05:19:15.753315759Z [inf]  incoming request
2026-02-04T05:19:15.753318679Z [inf]  incoming request
2026-02-04T05:19:15.753321909Z [inf]  incoming request
2026-02-04T05:19:15.754149859Z [inf]  incoming request
2026-02-04T05:19:15.754156114Z [inf]  incoming request
2026-02-04T05:19:15.754159522Z [inf]  request completed
2026-02-04T05:19:15.754164366Z [inf]  request completed
2026-02-04T05:19:15.754167425Z [inf]  request completed
2026-02-04T05:19:15.754170494Z [inf]  request completed
2026-02-04T05:19:15.754173959Z [inf]  request completed
2026-02-04T05:19:15.754177609Z [inf]  request completed
2026-02-04T05:19:15.754181043Z [inf]  request completed
2026-02-04T05:19:15.754846047Z [inf]  request completed
2026-02-04T05:19:15.754849935Z [inf]  request completed
2026-02-04T05:19:15.754852983Z [inf]  incoming request
2026-02-04T05:19:15.754855831Z [inf]  request completed
2026-02-04T05:19:15.754858582Z [inf]  request completed
2026-02-04T05:19:15.754861244Z [inf]  request completed
2026-02-04T05:19:15.754863849Z [inf]  request completed
2026-02-04T05:19:15.754866729Z [inf]  request completed
2026-02-04T05:19:15.754869500Z [inf]  request completed
2026-02-04T05:19:15.755461889Z [inf]  incoming request
2026-02-04T05:19:15.755465977Z [inf]  ChatWS Client connected
2026-02-04T05:19:15.755468934Z [inf]  ChatWS: User connected
2026-02-04T05:19:15.829837728Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:19:16.151130966Z [inf]  0x API price received successfully
2026-02-04T05:19:16.184373329Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T05:19:16.236820013Z [inf]  📊 Position P/L check
2026-02-04T05:19:18.007392598Z [inf]  incoming request
2026-02-04T05:19:18.007395601Z [inf]  request completed
2026-02-04T05:19:18.007398741Z [inf]  incoming request
2026-02-04T05:19:18.007401745Z [inf]  request completed
2026-02-04T05:19:18.374786969Z [inf]  incoming request
2026-02-04T05:19:18.374791485Z [inf]  incoming request
2026-02-04T05:19:18.374795461Z [inf]  request completed
2026-02-04T05:19:18.826138625Z [inf]  [TokenDetails] Fetching holder count for 0x5eB0D124178617c693c3D6aD7cAf0646DB586b07 on base...
2026-02-04T05:19:19.083052436Z [inf]  [TokenDetails] Got 790 holders for 0x5eB0D124178617c693c3D6aD7cAf0646DB586b07
2026-02-04T05:19:19.083055521Z [inf]  request completed
2026-02-04T05:19:25.080213064Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:19:25.203934944Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:19:25.343234361Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:19:25.455046346Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:19:25.718505071Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:19:25.718507817Z [inf]  Alpha Detector: Checking new coin
2026-02-04T05:19:26.244706595Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:19:26.321804377Z [wrn]  RPC endpoint failed
2026-02-04T05:19:26.721988695Z [inf]  RPC failover success
2026-02-04T05:19:26.721991609Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:19:26.721994312Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:19:26.872707495Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:19:26.872714537Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:19:26.964849500Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:19:26.964854912Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:19:27.074812707Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:19:27.074818751Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:19:27.097174221Z [inf]  📊 Position P/L check
2026-02-04T05:19:32.368765021Z [inf]  incoming request
2026-02-04T05:19:32.368770897Z [inf]  request completed
2026-02-04T05:19:32.368776065Z [inf]  incoming request
2026-02-04T05:19:32.368780483Z [inf]  request completed
2026-02-04T05:19:32.368785499Z [inf]  incoming request
2026-02-04T05:19:32.368789636Z [inf]  request completed
2026-02-04T05:19:32.921577928Z [inf]  incoming request
2026-02-04T05:19:32.921580764Z [inf]  incoming request
2026-02-04T05:19:32.921583521Z [inf]  incoming request
2026-02-04T05:19:32.921586174Z [inf]  [CopyTrade] GET /configs - Fetching configs for user did:privy:cmk74yj4r03jcl70b8hwyuh2c
2026-02-04T05:19:32.921589071Z [inf]  [CopyTrade] GET /positions - Fetching positions for did:privy:cmk74yj4r03jcl70b8hwyuh2c
2026-02-04T05:19:32.921592269Z [inf]  request completed
2026-02-04T05:19:32.921595368Z [inf]  request completed
2026-02-04T05:19:32.921598590Z [inf]  request completed
2026-02-04T05:19:37.160086737Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:19:37.160090021Z [inf]  📊 Position P/L check
2026-02-04T05:19:37.710525039Z [inf]  incoming request
2026-02-04T05:19:37.710529456Z [inf]  request completed
2026-02-04T05:19:38.031237557Z [inf]  incoming request
2026-02-04T05:19:38.031240875Z [inf]  [CopyTrade] PATCH /config/cml5i3w0800c3m112bpaat30r/status - User did:privy:cmk74yj4r03jcl70b8hwyuh2c -> active
2026-02-04T05:19:38.031244208Z [inf]  request completed
2026-02-04T05:19:39.192756927Z [inf]  incoming request
2026-02-04T05:19:39.192761818Z [inf]  request completed
2026-02-04T05:19:39.479970166Z [inf]  incoming request
2026-02-04T05:19:39.479975189Z [inf]  [CopyTrade] PATCH /config/cmkxp905g05luhvquw27rf3su/status - User did:privy:cmk74yj4r03jcl70b8hwyuh2c -> active
2026-02-04T05:19:39.485232084Z [inf]  request completed
2026-02-04T05:19:41.233159026Z [inf]  incoming request
2026-02-04T05:19:41.233167043Z [inf]  request completed
2026-02-04T05:19:41.671007734Z [inf]  incoming request
2026-02-04T05:19:41.671869940Z [inf]  [CopyTrade] PATCH /config/cmkinx90s06e2xvtcl92w5it2/status - User did:privy:cmk74yj4r03jcl70b8hwyuh2c -> active
2026-02-04T05:19:41.684484416Z [inf]  request completed
2026-02-04T05:19:45.708698620Z [inf]  incoming request
2026-02-04T05:19:45.708701515Z [inf]  request completed
2026-02-04T05:19:46.005985192Z [inf]  incoming request
2026-02-04T05:19:46.005987868Z [inf]  request completed
2026-02-04T05:19:47.181770309Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:19:47.550019136Z [inf]  0x API price received successfully
2026-02-04T05:19:47.550023409Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T05:19:52.158909104Z [inf]  incoming request
2026-02-04T05:19:52.158912297Z [inf]  request completed
2026-02-04T05:19:52.374564548Z [inf]  incoming request
2026-02-04T05:19:52.374569105Z [inf]  request completed
2026-02-04T05:19:54.436993682Z [inf]  incoming request
2026-02-04T05:19:54.436996404Z [inf]  request completed
2026-02-04T05:19:54.436998964Z [inf]  incoming request
2026-02-04T05:19:54.437001695Z [inf]  request completed
2026-02-04T05:19:54.437004416Z [inf]  incoming request
2026-02-04T05:19:55.414415686Z [inf]  request completed
2026-02-04T05:19:56.011516677Z [inf]  incoming request
2026-02-04T05:19:56.012249103Z [inf]  request completed
2026-02-04T05:19:56.017136895Z [inf]  incoming request
2026-02-04T05:19:56.017142188Z [inf]  request completed
2026-02-04T05:19:56.017146083Z [inf]  incoming request
2026-02-04T05:19:56.017149646Z [inf]  request completed
2026-02-04T05:19:56.017152456Z [inf]  incoming request
2026-02-04T05:19:56.017155310Z [inf]  request completed
2026-02-04T05:19:56.428508004Z [inf]  incoming request
2026-02-04T05:19:56.428513686Z [inf]  incoming request
2026-02-04T05:19:56.428516695Z [inf]  incoming request
2026-02-04T05:19:56.428519798Z [inf]  incoming request
2026-02-04T05:19:56.428522552Z [inf]  [CopyTrade] GET /configs - Fetching configs for user did:privy:cmk74yj4r03jcl70b8hwyuh2c
2026-02-04T05:19:56.428525232Z [inf]  [CopyTrade] GET /positions - Fetching positions for did:privy:cmk74yj4r03jcl70b8hwyuh2c
2026-02-04T05:19:56.428528451Z [inf]  request completed
2026-02-04T05:19:56.428531369Z [inf]  request completed
2026-02-04T05:19:56.428534148Z [inf]  request completed
2026-02-04T05:19:57.192539458Z [err]  Alchemy Portfolio EVM API error
2026-02-04T05:19:57.231628317Z [inf]  request completed
2026-02-04T05:19:57.503304577Z [inf]  incoming request
2026-02-04T05:19:57.503314644Z [inf]  request completed
2026-02-04T05:19:57.642803545Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:19:57.662919006Z [wrn]  RPC endpoint failed
2026-02-04T05:19:57.777592428Z [inf]  incoming request
2026-02-04T05:19:57.918680620Z [inf]  RPC failover success
2026-02-04T05:19:57.918683722Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:19:57.918686922Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:19:57.918689805Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:19:57.918693196Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:19:58.577587167Z [err]  Alchemy Portfolio EVM API error
2026-02-04T05:19:58.577589900Z [inf]  request completed
2026-02-04T05:19:58.577592699Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-04T05:19:58.577595390Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-04T05:19:58.577598178Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-04T05:19:58.577601090Z [inf]  ✅ Hybrid fetch complete
2026-02-04T05:20:00.634759836Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-04T05:20:00.634762779Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-04T05:20:00.634765668Z [inf]  Fetching premium trending tokens
2026-02-04T05:20:00.634768751Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-04T05:20:00.634771481Z [inf]  Timer finished: recalc_heat_scores
2026-02-04T05:20:00.634774178Z [err]  DexScreener WS: Connection error
2026-02-04T05:20:00.634777110Z [wrn]  WS returned 0 addresses
2026-02-04T05:20:00.634779953Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-04T05:20:00.930052646Z [inf]  Merged addresses
2026-02-04T05:20:01.281608067Z [inf]  Processed DexScreener trending candidates
2026-02-04T05:20:06.181708961Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T05:20:07.182642490Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T05:20:08.822020807Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T05:20:09.189225458Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T05:20:13.220473246Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T05:20:13.220476928Z [err]  GeckoTerminal API error after retries
2026-02-04T05:20:13.220481457Z [err]  Error fetching trending tokens
2026-02-04T05:20:13.220484638Z [inf]  Premium trending tokens fetch complete
2026-02-04T05:20:13.220487549Z [inf]  [TokenJob] Got 27 trending tokens for Ethereum
2026-02-04T05:20:13.220490995Z [err]  [TokenJob] New list too small (27) for Ethereum; keeping existing (100)