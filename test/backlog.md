2026-02-04T17:26:04.000000000Z [inf]  Starting Container
2026-02-04T17:26:05.676387832Z [inf]  
2026-02-04T17:26:05.676400012Z [inf]  > kiko-api@1.0.0 start
2026-02-04T17:26:05.676405262Z [inf]  > node dist/index.js
2026-02-04T17:26:05.676409702Z [inf]  
2026-02-04T17:26:07.652214939Z [inf]  [Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
2026-02-04T17:26:07.685589557Z [inf]  Zora SDK initialized with API Key
2026-02-04T17:26:08.079820064Z [err]  [SocialJob] Could not find real_hot_users.json in any candidate path
2026-02-04T17:26:08.378891319Z [inf]  [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
2026-02-04T17:26:08.784666816Z [inf]  [SkillRegistry:exec] Loading skills from /app/dist/skills...
2026-02-04T17:26:08.784671776Z [inf]  [SkillRegistry:clean] Loading skills from /app/dist/skills...
2026-02-04T17:26:08.857798791Z [inf]  Serving static files from:
2026-02-04T17:26:08.857804451Z [inf]  Initializing services...
2026-02-04T17:26:08.934972213Z [inf]  [Prisma] DB connection is healthy
2026-02-04T17:26:08.946141185Z [inf]  Database connection successful
2026-02-04T17:26:08.946144875Z [inf]  [DataRetention] Checking retention policies...
2026-02-04T17:26:08.956809500Z [inf]  [DataRetention] Starting cleanup job...
2026-02-04T17:26:08.956815240Z [inf]  Redis initialized
2026-02-04T17:26:08.956818580Z [inf]  Starting server on port 8080...
2026-02-04T17:26:09.082737287Z [inf]  Server listening at http://0.0.0.0:8080
2026-02-04T17:26:09.082741917Z [inf]  Server listening
2026-02-04T17:26:09.082745257Z [inf]  RPC health monitor started
2026-02-04T17:26:09.088343182Z [inf]  RPC benchmark sampling started
2026-02-04T17:26:09.162541512Z [inf]  [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
2026-02-04T17:26:09.162545292Z [inf]  [TokenJob] Scheduled: Primary chains every 5min (Ethereum, Solana, Base, BSC)
2026-02-04T17:26:09.162551042Z [inf]  [TokenJob] Scheduled: Secondary chains every 4h (Arbitrum, Optimism, Polygon)
2026-02-04T17:26:09.162554452Z [inf]  [SocialJob] Scheduled: Discovery (30m), Refresh (4h), Scoring (5m)
2026-02-04T17:26:09.162558002Z [inf]  Background jobs started
2026-02-04T17:26:09.162561442Z [inf]  Initializing auto trade service...
2026-02-04T17:26:09.162565192Z [inf]  [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
2026-02-04T17:26:09.162568992Z [inf]  Auto trade service initialized (Solana watcher + EVM webhook enabled)
2026-02-04T17:26:09.162572982Z [inf]  Auto trade service started
2026-02-04T17:26:09.162576292Z [inf]  [PositionMonitor] Starting position monitor (every 30s)...
2026-02-04T17:26:09.162580012Z [inf]  Position monitor started
2026-02-04T17:26:09.162583132Z [inf]  Token Alert Service started
2026-02-04T17:26:09.163176898Z [inf]  Token alert service started
2026-02-04T17:26:09.163180388Z [inf]  [ChatWorker] Started polling for AI tasks (interval: 3000ms)
2026-02-04T17:26:09.163183058Z [inf]  Chat worker started
2026-02-04T17:26:09.163185828Z [inf]  Starting Global Zora Alpha Detector (API Polling)
2026-02-04T17:26:09.163188278Z [inf]  🎉 All services initialized!
2026-02-04T17:26:09.219219537Z [err]  [DataRetention] No cleanup handler for table: SuggestionEvent
2026-02-04T17:26:09.219222007Z [inf]  [DataRetention] Cleanup job completed.
2026-02-04T17:26:14.157913601Z [inf]  [MarketJob] Running startup staleness check...
2026-02-04T17:26:14.157916201Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:26:14.162580423Z [inf]  [MarketJob] Overview is fresh, skipping API call
2026-02-04T17:26:14.163345308Z [inf]  [MarketJob] Protocols are fresh, skipping API call
2026-02-04T17:26:14.168030289Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-04T17:26:14.168035039Z [inf]  [SocialJob] Trending casts are fresh, skipping Snapchain API call
2026-02-04T17:26:14.693029502Z [inf]  ⚡ Uniswap V4 price fetched
2026-02-04T17:26:14.693088592Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:26:14.693094362Z [inf]  0x API price received successfully
2026-02-04T17:26:14.693098482Z [inf]  ⚡ Uniswap V4 price fetched
2026-02-04T17:26:15.295879304Z [wrn]  RPC endpoint failed
2026-02-04T17:26:15.297196435Z [wrn]  RPC endpoint failed
2026-02-04T17:26:15.414661683Z [inf]  RPC failover success
2026-02-04T17:26:15.414667073Z [inf]  RPC failover success
2026-02-04T17:26:15.784877676Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:26:15.862453075Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:26:15.889955567Z [inf]  📊 Position P/L check
2026-02-04T17:26:16.303100720Z [inf]  incoming request
2026-02-04T17:26:16.655382271Z [inf]  ChatWS Client connected
2026-02-04T17:26:16.655385131Z [inf]  ChatWS: User connected
2026-02-04T17:26:16.667655688Z [inf]  Sync request
2026-02-04T17:26:23.430452030Z [inf]  incoming request
2026-02-04T17:26:23.430457000Z [inf]  request completed
2026-02-04T17:26:23.831980512Z [inf]  incoming request
2026-02-04T17:26:23.863715590Z [inf]  request completed
2026-02-04T17:26:25.898813398Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:26:25.920083138Z [inf]  📊 Position P/L check
2026-02-04T17:26:45.906031638Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:26:45.906034548Z [inf]  📊 Position P/L check
2026-02-04T17:26:45.906037458Z [inf]  [TokenJob] Starting initial token refresh...
2026-02-04T17:26:45.906040188Z [inf]  [TokenJob] Tokens for Ethereum are fresh, skipping API call
2026-02-04T17:26:45.906042628Z [inf]  incoming request
2026-02-04T17:26:45.906045088Z [inf]  request completed
2026-02-04T17:26:45.906047518Z [inf]  incoming request
2026-02-04T17:26:45.906050968Z [inf]  request completed
2026-02-04T17:26:45.946239075Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:26:46.315874811Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:26:46.342131021Z [inf]  0x API price received successfully
2026-02-04T17:26:47.184814807Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:26:47.378058255Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:26:47.398632739Z [inf]  📊 Position P/L check
2026-02-04T17:26:51.292044521Z [inf]  incoming request
2026-02-04T17:26:51.292048181Z [inf]  request completed
2026-02-04T17:26:51.292050791Z [inf]  incoming request
2026-02-04T17:26:51.292053641Z [inf]  request completed
2026-02-04T17:26:51.292056051Z [inf]  incoming request
2026-02-04T17:26:51.292058611Z [inf]  request completed
2026-02-04T17:26:51.538985672Z [inf]  incoming request
2026-02-04T17:26:51.538990392Z [inf]  incoming request
2026-02-04T17:26:51.538993862Z [inf]  incoming request
2026-02-04T17:26:51.538997162Z [inf]  [verifyAccess] Checking access: {
2026-02-04T17:26:51.539001422Z [inf]    userId: 'did:privy:cmk74yj4r03jcl70b8hwyuh2c',
2026-02-04T17:26:51.539004682Z [inf]    userIdLength: 35,
2026-02-04T17:26:51.539007662Z [inf]    userIdPrefix: 'did:privy:cmk74yj4r0',
2026-02-04T17:26:51.539010882Z [inf]    requestedAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B'
2026-02-04T17:26:51.539014552Z [inf]  }
2026-02-04T17:26:51.539017882Z [inf]  [verifyAccess] ✅ Access granted
2026-02-04T17:26:51.539020922Z [inf]  request completed
2026-02-04T17:26:51.543011067Z [inf]  PrivyWallet Authorization Key config
2026-02-04T17:26:52.012889276Z [inf]  request completed
2026-02-04T17:26:52.527809691Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:26:52.870939649Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:26:52.870943119Z [inf]  request completed
2026-02-04T17:26:53.027256970Z [inf]  incoming request
2026-02-04T17:26:53.027259799Z [inf]  request completed
2026-02-04T17:26:53.267754250Z [inf]  incoming request
2026-02-04T17:26:53.649956390Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:26:53.649959470Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:26:53.649962000Z [inf]  request completed
2026-02-04T17:26:55.087467586Z [inf]  incoming request
2026-02-04T17:26:55.088313201Z [inf]  ChatWS Client connected
2026-02-04T17:26:55.088318271Z [inf]  ChatWS: User connected
2026-02-04T17:26:56.022313963Z [inf]  incoming request
2026-02-04T17:26:56.022319223Z [inf]  request completed
2026-02-04T17:26:56.392107978Z [inf]  incoming request
2026-02-04T17:26:56.392114029Z [inf]  [verifyAccess] Checking access: {
2026-02-04T17:26:56.392116969Z [inf]    userId: 'did:privy:cmk9grlpm001wkz0dm9eeb6jl',
2026-02-04T17:26:56.392119499Z [inf]    userIdLength: 35,
2026-02-04T17:26:56.392122299Z [inf]    userIdPrefix: 'did:privy:cmk9grlpm0',
2026-02-04T17:26:56.392126409Z [inf]    requestedAddress: '0x552ecD151743E8E63e7F487fa07A7996ABB21958'
2026-02-04T17:26:56.392128669Z [inf]  }
2026-02-04T17:26:56.396470643Z [inf]  [verifyAccess] ✅ Access granted
2026-02-04T17:26:56.671365414Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:26:57.060940989Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:26:57.060943579Z [inf]  request completed
2026-02-04T17:26:57.423663369Z [inf]  incoming request
2026-02-04T17:26:57.423666079Z [inf]  request completed
2026-02-04T17:26:57.447763783Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:26:57.467664802Z [inf]  📊 Position P/L check
2026-02-04T17:26:57.881946588Z [inf]  incoming request
2026-02-04T17:26:57.982739546Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:26:57.982747796Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:26:57.982752066Z [inf]  request completed
2026-02-04T17:26:58.070566902Z [inf]  incoming request
2026-02-04T17:26:58.070572662Z [inf]  request completed
2026-02-04T17:26:58.102746637Z [inf]  incoming request
2026-02-04T17:26:58.366468417Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:26:58.366472057Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:26:58.366476097Z [inf]  request completed
2026-02-04T17:26:58.428881468Z [inf]  incoming request
2026-02-04T17:26:58.438893027Z [inf]  request completed
2026-02-04T17:27:00.021892460Z [inf]  incoming request
2026-02-04T17:27:00.021902120Z [inf]  request completed
2026-02-04T17:27:00.323410631Z [inf]  incoming request
2026-02-04T17:27:00.323413641Z [inf]  request completed
2026-02-04T17:27:00.629660462Z [inf]  incoming request
2026-02-04T17:27:00.629663242Z [inf]  request completed
2026-02-04T17:27:00.893583081Z [inf]  incoming request
2026-02-04T17:27:01.324265216Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:27:01.598951649Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:27:01.598954179Z [inf]  request completed
2026-02-04T17:27:07.536755525Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:27:07.737008270Z [inf]  📊 Position P/L check
2026-02-04T17:27:09.210792946Z [inf]  [TokenJob] Tokens for Solana are fresh, skipping API call
2026-02-04T17:27:12.547023900Z [inf]  incoming request
2026-02-04T17:27:12.547027500Z [inf]  request completed
2026-02-04T17:27:12.547031450Z [inf]  incoming request
2026-02-04T17:27:12.547036650Z [inf]  request completed
2026-02-04T17:27:12.547040620Z [inf]  incoming request
2026-02-04T17:27:12.547044160Z [inf]  request completed
2026-02-04T17:27:12.964698646Z [inf]  incoming request
2026-02-04T17:27:12.964705885Z [inf]  [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmk74yj4r03jcl70b8hwyuh2c, content=你可以引导我使用kiko吗...
2026-02-04T17:27:12.964710875Z [inf]  request completed
2026-02-04T17:27:12.964732235Z [inf]  incoming request
2026-02-04T17:27:12.964736705Z [inf]  incoming request
2026-02-04T17:27:13.083197206Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:27:13.451228553Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:27:13.451233642Z [inf]  request completed
2026-02-04T17:27:13.557288409Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:27:13.557296818Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:27:13.572833564Z [inf]  request completed
2026-02-04T17:27:13.935021456Z [inf]  incoming request
2026-02-04T17:27:13.935023836Z [inf]  request completed
2026-02-04T17:27:13.935026436Z [inf]  incoming request
2026-02-04T17:27:14.025792246Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:27:14.025795556Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:27:14.025798496Z [inf]  request completed
2026-02-04T17:27:14.090030196Z [inf]  incoming request
2026-02-04T17:27:14.115594801Z [inf]  request completed
2026-02-04T17:27:15.282999547Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:27:15.283002787Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:27:15.283006657Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:27:15.610384229Z [inf]  Moderation Input check result
2026-02-04T17:27:15.610389569Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_start
2026-02-04T17:27:15.610392309Z [inf]  [ChatWorker] Sent message_start for cml8avh4m00068poejtfh7odv
2026-02-04T17:27:15.610394759Z [inf]  ChatWorker: seeded get_wallet_info from client context
2026-02-04T17:27:15.611332625Z [inf]  [ChatWorker] Base filtered to 44 tools for message: "你可以引导我使用kiko吗..."
2026-02-04T17:27:15.611337425Z [inf]  [ChatWorker] 🔍 RAG check for: "你可以引导我使用kiko吗..."
2026-02-04T17:27:15.611340945Z [inf]  [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
2026-02-04T17:27:15.611344075Z [inf]  [ChatWorker] DeepSeek iteration 1/10 for task cml8avhcl00088poeiib3b717
2026-02-04T17:27:15.612643096Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:27:15.617299478Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:27:17.757965517Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:27:18.106253974Z [inf]  0x API price received successfully
2026-02-04T17:27:18.166974225Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:27:19.298012942Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:27:19.429988181Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:27:23.191232557Z [inf]  Timer finished: intent_parsing_f23a1873
2026-02-04T17:27:23.196020197Z [inf]  Intent follow-up recorded
2026-02-04T17:27:23.196024227Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:27:23.196026957Z [inf]  DeepSeek: routed to mode
2026-02-04T17:27:23.196029477Z [inf]  [ChatWorker] Free intent mode: using 26 thinking tools
2026-02-04T17:27:23.196032487Z [inf]  DeepSeek: thinking mode without skills injection
2026-02-04T17:27:23.196035007Z [inf]  [ChatWorker] User Settings: {
2026-02-04T17:27:23.196037237Z [inf]    fastSwapMode: true,
2026-02-04T17:27:23.196039617Z [inf]    swapMethod: 'allowance_trade',
2026-02-04T17:27:23.196041957Z [inf]    toolConfig: [
2026-02-04T17:27:23.196045517Z [inf]      'userRole',
2026-02-04T17:27:23.196049747Z [inf]      'defaultSwapAmount',
2026-02-04T17:27:23.200226542Z [inf]      'defaultSwapUnit',
2026-02-04T17:27:23.200230902Z [inf]      'checkTokenBeforeSwap',
2026-02-04T17:27:23.200233502Z [inf]      'showQuoteBeforeSwap',
2026-02-04T17:27:23.200236502Z [inf]      'swapMethod',
2026-02-04T17:27:23.200239502Z [inf]      'slippageMode',
2026-02-04T17:27:23.200242412Z [inf]      'customSlippage',
2026-02-04T17:27:23.200244922Z [inf]      'mevProtection',
2026-02-04T17:27:23.200247642Z [inf]      'priceDeviationCheck',
2026-02-04T17:27:23.200250512Z [inf]      'fastSwapMode',
2026-02-04T17:27:23.200253172Z [inf]      'copyTradeTokenCooldownMinutes',
2026-02-04T17:27:23.200255732Z [inf]      'minMarketCapUsd',
2026-02-04T17:27:23.200258562Z [inf]      'minLiquidityUsd',
2026-02-04T17:27:23.200261152Z [inf]      'minTargetValueUsd',
2026-02-04T17:27:23.200263202Z [inf]      'id',
2026-02-04T17:27:23.200266032Z [inf]      'userId',
2026-02-04T17:27:23.200268792Z [inf]      'quickSwapMode',
2026-02-04T17:27:23.200271672Z [inf]      'copyTradeAIMode',
2026-02-04T17:27:23.200275702Z [inf]      'updatedAt',
2026-02-04T17:27:23.200278522Z [inf]      'createdAt',
2026-02-04T17:27:23.200280992Z [inf]      'zoraNotificationThreshold'
2026-02-04T17:27:23.200283762Z [inf]    ],
2026-02-04T17:27:23.200285972Z [inf]    walletConnected: true,
2026-02-04T17:27:23.200288512Z [inf]    chainId: 8453
2026-02-04T17:27:23.200291322Z [inf]  }
2026-02-04T17:27:23.200294322Z [inf]  [ChatWorker] Waiting for early pre-fetch to complete
2026-02-04T17:27:23.200296862Z [inf]  Timer finished: prompt_gen_GENERAL_CHAT_deepseek
2026-02-04T17:27:23.200299102Z [inf]  [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (7 tokens cached)
2026-02-04T17:27:23.200301712Z [inf]  [ChatWorker] No tokenInfo available
2026-02-04T17:27:23.200304882Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:27:23.200307591Z [inf]  [ChatWorker] Enriched user prompt with context for 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T17:27:23.200310111Z [inf]  ChatWorker: client context injected
2026-02-04T17:27:23.200312751Z [inf]  ChatWorker: client balance snapshot summary
2026-02-04T17:27:23.200315901Z [inf]  [ChatWorker] Added client context to system prompt
2026-02-04T17:27:23.200318151Z [inf]  ChatWorker: removed get_wallet_info tool (balance context present)
2026-02-04T17:27:23.200321351Z [inf]  [ChatWorker] Broadcasting Thinking status for cml8avh4m00068poejtfh7odv. Message order: message_start → launchpad_card → Thinking → content_chunks
2026-02-04T17:27:23.200324181Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:27:29.509957673Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:27:39.216697131Z [err]  [DBLock] Lock already held (valid) {
2026-02-04T17:27:39.216701911Z [err]    key: 'lock:tokenJob:refresh:base',
2026-02-04T17:27:39.216705661Z [err]    expiresAt: '2026-02-04T17:30:11.058Z',
2026-02-04T17:27:39.216709301Z [err]    ageMs: 88156
2026-02-04T17:27:39.216713741Z [err]  }
2026-02-04T17:27:39.216717131Z [inf]  [TokenJob] Skipping refresh for Base - another instance holds the lock
2026-02-04T17:27:39.723397992Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:27:40.816444154Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_usage
2026-02-04T17:27:41.442451818Z [inf]  Moderation Output check result
2026-02-04T17:27:41.462944509Z [inf]  [ChatWorker] Broadcasting message_complete for cml8avh4m00068poejtfh7odv
2026-02-04T17:27:41.462948029Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
2026-02-04T17:27:41.462951629Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:27:41.462955119Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
2026-02-04T17:27:41.725772591Z [inf]  incoming request
2026-02-04T17:27:41.725776351Z [inf]  request completed
2026-02-04T17:27:41.725800350Z [inf]  incoming request
2026-02-04T17:27:41.725804570Z [inf]  request completed
2026-02-04T17:27:42.015142024Z [inf]  request completed
2026-02-04T17:27:42.015183964Z [inf]  incoming request
2026-02-04T17:27:42.015189125Z [inf]  incoming request
2026-02-04T17:27:42.015193605Z [inf]  request completed
2026-02-04T17:27:45.520155598Z [inf]  incoming request
2026-02-04T17:27:45.520158678Z [inf]  request completed
2026-02-04T17:27:45.974769546Z [inf]  incoming request
2026-02-04T17:27:46.741415249Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:27:47.171881430Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:27:47.171886140Z [inf]  request completed
2026-02-04T17:27:47.448078207Z [inf]  incoming request
2026-02-04T17:27:47.448081907Z [inf]  request completed
2026-02-04T17:27:47.683754049Z [inf]  incoming request
2026-02-04T17:27:47.956181850Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:27:47.956195161Z [inf]  request completed
2026-02-04T17:27:47.956278670Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:27:50.038794012Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:27:50.315117378Z [inf]  0x API price received successfully
2026-02-04T17:27:50.315120428Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:27:51.279889330Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:27:51.301855022Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:27:52.305508020Z [inf]  incoming request
2026-02-04T17:27:52.306306525Z [inf]  request completed
2026-02-04T17:27:52.307041000Z [inf]  incoming request
2026-02-04T17:27:52.307044520Z [inf]  request completed
2026-02-04T17:27:52.308433371Z [inf]  incoming request
2026-02-04T17:27:52.308440611Z [inf]  request completed
2026-02-04T17:27:52.308444690Z [inf]  incoming request
2026-02-04T17:27:52.308448280Z [inf]  request completed
2026-02-04T17:27:52.308453220Z [inf]  incoming request
2026-02-04T17:27:52.308456910Z [inf]  request completed
2026-02-04T17:27:52.308460110Z [inf]  incoming request
2026-02-04T17:27:52.308462950Z [inf]  request completed
2026-02-04T17:27:52.308903578Z [inf]  incoming request
2026-02-04T17:27:52.308909138Z [inf]  request completed
2026-02-04T17:27:52.308912158Z [inf]  incoming request
2026-02-04T17:27:52.308915288Z [inf]  request completed
2026-02-04T17:27:52.308919038Z [inf]  incoming request
2026-02-04T17:27:52.308923028Z [inf]  request completed
2026-02-04T17:27:52.309728903Z [inf]  incoming request
2026-02-04T17:27:52.309732143Z [inf]  request completed
2026-02-04T17:27:52.309736143Z [inf]  incoming request
2026-02-04T17:27:52.309738753Z [inf]  request completed
2026-02-04T17:27:52.309741563Z [inf]  incoming request
2026-02-04T17:27:52.309744193Z [inf]  request completed
2026-02-04T17:27:52.310498828Z [inf]  incoming request
2026-02-04T17:27:52.310502228Z [inf]  request completed
2026-02-04T17:27:52.310505008Z [inf]  incoming request
2026-02-04T17:27:52.310507738Z [inf]  request completed
2026-02-04T17:27:52.311313873Z [inf]  incoming request
2026-02-04T17:27:52.311317973Z [inf]  request completed
2026-02-04T17:27:52.593051417Z [inf]  incoming request
2026-02-04T17:27:52.593054727Z [inf]  incoming request
2026-02-04T17:27:52.593057187Z [inf]  incoming request
2026-02-04T17:27:52.593059647Z [inf]  incoming request
2026-02-04T17:27:52.593062177Z [inf]  incoming request
2026-02-04T17:27:52.593065887Z [inf]  incoming request
2026-02-04T17:27:52.597146630Z [inf]  incoming request
2026-02-04T17:27:52.597150190Z [inf]  incoming request
2026-02-04T17:27:52.597152890Z [inf]  incoming request
2026-02-04T17:27:52.597156660Z [inf]  incoming request
2026-02-04T17:27:52.607512416Z [inf]  request completed
2026-02-04T17:27:52.607514906Z [inf]  request completed
2026-02-04T17:27:52.651590129Z [inf]  request completed
2026-02-04T17:27:52.661767706Z [inf]  request completed
2026-02-04T17:27:52.661772086Z [inf]  request completed
2026-02-04T17:27:52.661775056Z [inf]  request completed
2026-02-04T17:27:52.682234538Z [inf]  request completed
2026-02-04T17:27:52.686055763Z [inf]  request completed
2026-02-04T17:27:52.690429496Z [inf]  request completed
2026-02-04T17:27:52.712378048Z [inf]  request completed
2026-02-04T17:27:52.716774670Z [inf]  incoming request
2026-02-04T17:27:52.721420872Z [inf]  incoming request
2026-02-04T17:27:52.721424382Z [inf]  incoming request
2026-02-04T17:27:52.721428032Z [inf]  incoming request
2026-02-04T17:27:52.721431582Z [inf]  request completed
2026-02-04T17:27:52.721442062Z [inf]  request completed
2026-02-04T17:27:52.721445022Z [inf]  incoming request
2026-02-04T17:27:52.724480972Z [inf]  request completed
2026-02-04T17:27:52.724485602Z [inf]  request completed
2026-02-04T17:27:52.724488912Z [inf]  request completed
2026-02-04T17:27:53.428968746Z [inf]  incoming request
2026-02-04T17:27:53.494896133Z [inf]  request completed
2026-02-04T17:28:01.431018033Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:28:09.235791969Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-04T17:28:09.235795789Z [inf]  Fetching premium trending tokens
2026-02-04T17:28:09.488390276Z [inf]  WS addresses discovered
2026-02-04T17:28:10.626955935Z [inf]  Processed DexScreener trending candidates
2026-02-04T17:28:11.675976955Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:28:13.298978082Z [inf]  incoming request
2026-02-04T17:28:13.298983492Z [inf]  request completed
2026-02-04T17:28:13.298986612Z [inf]  incoming request
2026-02-04T17:28:13.298990172Z [inf]  request completed
2026-02-04T17:28:13.298993012Z [inf]  incoming request
2026-02-04T17:28:13.298996992Z [inf]  request completed
2026-02-04T17:28:13.298999902Z [inf]  incoming request
2026-02-04T17:28:13.299002402Z [inf]  request completed
2026-02-04T17:28:13.590922794Z [inf]  incoming request
2026-02-04T17:28:13.596278601Z [inf]  incoming request
2026-02-04T17:28:13.596283811Z [inf]  incoming request
2026-02-04T17:28:13.596286801Z [inf]  incoming request
2026-02-04T17:28:13.596289491Z [inf]  [CopyTrade] GET /configs - Fetching configs for user did:privy:cmk74yj4r03jcl70b8hwyuh2c
2026-02-04T17:28:13.596293221Z [inf]  [verifyAccess] Checking access: {
2026-02-04T17:28:13.596295870Z [inf]    userId: 'did:privy:cmk74yj4r03jcl70b8hwyuh2c',
2026-02-04T17:28:13.596298140Z [inf]    userIdLength: 35,
2026-02-04T17:28:13.596301630Z [inf]    userIdPrefix: 'did:privy:cmk74yj4r0',
2026-02-04T17:28:13.596305340Z [inf]    requestedAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B'
2026-02-04T17:28:13.596316530Z [inf]  }
2026-02-04T17:28:13.596319860Z [inf]  [CopyTrade] GET /positions - Fetching positions for did:privy:cmk74yj4r03jcl70b8hwyuh2c
2026-02-04T17:28:13.601094821Z [inf]  [verifyAccess] ✅ Access granted
2026-02-04T17:28:13.606149160Z [inf]  request completed
2026-02-04T17:28:13.606154070Z [inf]  request completed
2026-02-04T17:28:13.606156860Z [inf]  request completed
2026-02-04T17:28:14.115075462Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:28:14.178090228Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:28:14.178095318Z [inf]  request completed
2026-02-04T17:28:14.704491392Z [inf]  incoming request
2026-02-04T17:28:14.705641544Z [inf]  request completed
2026-02-04T17:28:14.946269018Z [inf]  incoming request
2026-02-04T17:28:14.951243777Z [inf]  request completed
2026-02-04T17:28:16.099286268Z [inf]  incoming request
2026-02-04T17:28:16.099289748Z [inf]  request completed
2026-02-04T17:28:16.267972413Z [inf]    "copyTradeAIMode": "disabled",
2026-02-04T17:28:16.267978153Z [inf]    "updatedAt": "2026-02-04T17:05:58.076Z",
2026-02-04T17:28:16.267982203Z [inf]    "createdAt": "2026-02-02T18:26:51.351Z",
2026-02-04T17:28:16.267986803Z [inf]    "zoraNotificationThreshold": 5000
2026-02-04T17:28:16.268000132Z [inf]  incoming request
2026-02-04T17:28:16.268002972Z [inf]  [UserSettings] PUT /api/users/settings for user did:privy:cmk74yj4r03jcl70b8hwyuh2c: {
2026-02-04T17:28:16.268005622Z [inf]    "userRole": "default",
2026-02-04T17:28:16.268008252Z [inf]    "defaultSwapAmount": 0.01,
2026-02-04T17:28:16.268012272Z [inf]    "defaultSwapUnit": "native",
2026-02-04T17:28:16.268014762Z [inf]    "checkTokenBeforeSwap": true,
2026-02-04T17:28:16.268017282Z [inf]    "showQuoteBeforeSwap": true,
2026-02-04T17:28:16.268019902Z [inf]    "swapMethod": "allowance_trade",
2026-02-04T17:28:16.268022682Z [inf]    "slippageMode": "custom",
2026-02-04T17:28:16.268025232Z [inf]    "customSlippage": 5,
2026-02-04T17:28:16.268027952Z [inf]    "mevProtection": true,
2026-02-04T17:28:16.268030802Z [inf]    "priceDeviationCheck": true,
2026-02-04T17:28:16.268033482Z [inf]    "fastSwapMode": true,
2026-02-04T17:28:16.268036032Z [inf]    "copyTradeTokenCooldownMinutes": 60,
2026-02-04T17:28:16.268038432Z [inf]    "minMarketCapUsd": 35000,
2026-02-04T17:28:16.268041512Z [inf]    "minLiquidityUsd": null,
2026-02-04T17:28:16.268044072Z [inf]    "minTargetValueUsd": null,
2026-02-04T17:28:16.268047042Z [inf]    "id": "cml5i4gnq00cem112g8f6v08w",
2026-02-04T17:28:16.268050242Z [inf]    "userId": "did:privy:cmk74yj4r03jcl70b8hwyuh2c",
2026-02-04T17:28:16.268053402Z [inf]    "quickSwapMode": false,
2026-02-04T17:28:16.268962516Z [inf]  }
2026-02-04T17:28:16.281383078Z [inf]  request completed
2026-02-04T17:28:19.144022917Z [inf]  Skipping low liquidity token
2026-02-04T17:28:20.148724599Z [inf]  Trending tokens fetch complete
2026-02-04T17:28:20.148727889Z [inf]  Premium trending tokens fetch complete
2026-02-04T17:28:20.148731769Z [inf]  [TokenJob] Got 100 trending tokens for BSC
2026-02-04T17:28:20.148735459Z [inf]  Saved 100 trending tokens for bsc to database and memory cache
2026-02-04T17:28:20.148738759Z [inf]  [TokenJob] Saved 100 tokens for BSC to DB + cache
2026-02-04T17:28:20.148742839Z [inf]  [TokenJob] Refreshed 4 primary chains in 100.9s
2026-02-04T17:28:20.608972328Z [inf]  incoming request
2026-02-04T17:28:20.608973848Z [inf]    "showQuoteBeforeSwap": true,
2026-02-04T17:28:20.608977338Z [inf]  [UserSettings] PUT /api/users/settings for user did:privy:cmk74yj4r03jcl70b8hwyuh2c: {
2026-02-04T17:28:20.608980428Z [inf]    "swapMethod": "allowance_trade",
2026-02-04T17:28:20.608981998Z [inf]    "userRole": "default",
2026-02-04T17:28:20.608986088Z [inf]    "slippageMode": "custom",
2026-02-04T17:28:20.608987708Z [inf]    "defaultSwapAmount": 0.01,
2026-02-04T17:28:20.608990888Z [inf]    "customSlippage": 5,
2026-02-04T17:28:20.608998737Z [inf]    "defaultSwapUnit": "native",
2026-02-04T17:28:20.609007057Z [inf]    "checkTokenBeforeSwap": true,
2026-02-04T17:28:20.609041537Z [inf]    "id": "cml5i4gnq00cem112g8f6v08w",
2026-02-04T17:28:20.609049137Z [inf]    "userId": "did:privy:cmk74yj4r03jcl70b8hwyuh2c",
2026-02-04T17:28:20.609057997Z [inf]    "mevProtection": true,
2026-02-04T17:28:20.609065967Z [inf]    "quickSwapMode": false,
2026-02-04T17:28:20.609071787Z [inf]    "priceDeviationCheck": true,
2026-02-04T17:28:20.609082747Z [inf]    "fastSwapMode": true,
2026-02-04T17:28:20.609083797Z [inf]    "copyTradeAIMode": "disabled",
2026-02-04T17:28:20.609090307Z [inf]    "copyTradeTokenCooldownMinutes": 60,
2026-02-04T17:28:20.609095567Z [inf]    "minMarketCapUsd": null,
2026-02-04T17:28:20.609106327Z [inf]    "minLiquidityUsd": null,
2026-02-04T17:28:20.609111327Z [inf]    "minTargetValueUsd": null,
2026-02-04T17:28:20.609138396Z [inf]    "updatedAt": "2026-02-04T17:05:58.076Z",
2026-02-04T17:28:20.609145176Z [inf]    "createdAt": "2026-02-02T18:26:51.351Z",
2026-02-04T17:28:20.609149586Z [inf]    "zoraNotificationThreshold": 5000
2026-02-04T17:28:20.609319755Z [inf]  }
2026-02-04T17:28:20.631555216Z [inf]  request completed
2026-02-04T17:28:22.022323742Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:28:22.273412399Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:28:22.279303733Z [inf]  0x API price received successfully
2026-02-04T17:28:22.784196853Z [wrn]  RPC endpoint failed
2026-02-04T17:28:22.884459015Z [inf]  RPC failover success
2026-02-04T17:28:22.979626659Z [wrn]  RPC endpoint failed
2026-02-04T17:28:22.989197780Z [wrn]  RPC endpoint failed
2026-02-04T17:28:23.123407210Z [inf]  RPC failover success
2026-02-04T17:28:23.181776814Z [wrn]  RPC endpoint failed
2026-02-04T17:28:23.182461760Z [wrn]  RPC endpoint failed
2026-02-04T17:28:23.276042474Z [inf]  RPC failover success
2026-02-04T17:28:23.276050154Z [inf]  RPC failover success
2026-02-04T17:28:23.328480517Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:28:23.339747796Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:28:24.637854582Z [inf]  incoming request
2026-02-04T17:28:24.637857102Z [inf]  request completed
2026-02-04T17:28:24.880264435Z [inf]    "updatedAt": "2026-02-04T17:05:58.076Z",
2026-02-04T17:28:24.880267625Z [inf]  incoming request
2026-02-04T17:28:24.880278625Z [inf]  [UserSettings] PUT /api/users/settings for user did:privy:cmk74yj4r03jcl70b8hwyuh2c: {
2026-02-04T17:28:24.880279995Z [inf]    "createdAt": "2026-02-02T18:26:51.351Z",
2026-02-04T17:28:24.880288715Z [inf]    "userRole": "default",
2026-02-04T17:28:24.880291845Z [inf]    "zoraNotificationThreshold": 5000
2026-02-04T17:28:24.880296315Z [inf]    "defaultSwapAmount": 0.01,
2026-02-04T17:28:24.880302145Z [inf]    "defaultSwapUnit": "native",
2026-02-04T17:28:24.880306965Z [inf]    "checkTokenBeforeSwap": true,
2026-02-04T17:28:24.880311655Z [inf]    "showQuoteBeforeSwap": true,
2026-02-04T17:28:24.880316095Z [inf]    "swapMethod": "allowance_trade",
2026-02-04T17:28:24.880320515Z [inf]    "slippageMode": "custom",
2026-02-04T17:28:24.880326255Z [inf]    "customSlippage": 5,
2026-02-04T17:28:24.880330115Z [inf]    "mevProtection": true,
2026-02-04T17:28:24.880334445Z [inf]    "priceDeviationCheck": true,
2026-02-04T17:28:24.880338605Z [inf]    "fastSwapMode": true,
2026-02-04T17:28:24.880343185Z [inf]    "copyTradeTokenCooldownMinutes": 60,
2026-02-04T17:28:24.880347025Z [inf]    "minMarketCapUsd": 22000,
2026-02-04T17:28:24.880350895Z [inf]    "minLiquidityUsd": null,
2026-02-04T17:28:24.880355415Z [inf]    "minTargetValueUsd": null,
2026-02-04T17:28:24.880359825Z [inf]    "id": "cml5i4gnq00cem112g8f6v08w",
2026-02-04T17:28:24.880364654Z [inf]    "userId": "did:privy:cmk74yj4r03jcl70b8hwyuh2c",
2026-02-04T17:28:24.880369294Z [inf]    "quickSwapMode": false,
2026-02-04T17:28:24.880373874Z [inf]    "copyTradeAIMode": "disabled",
2026-02-04T17:28:24.880865292Z [inf]  }
2026-02-04T17:28:24.890596350Z [inf]  request completed
2026-02-04T17:28:33.382302383Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:28:33.585120214Z [inf]  incoming request
2026-02-04T17:28:33.585123434Z [inf]  request completed
2026-02-04T17:28:33.835761866Z [inf]  incoming request
2026-02-04T17:28:33.835766426Z [inf]  [UserSettings] PUT /api/users/settings for user did:privy:cmk74yj4r03jcl70b8hwyuh2c: {
2026-02-04T17:28:33.835773026Z [inf]    "userRole": "default",
2026-02-04T17:28:33.835776516Z [inf]    "defaultSwapAmount": 0.01,
2026-02-04T17:28:33.835782196Z [inf]    "defaultSwapUnit": "native",
2026-02-04T17:28:33.835786596Z [inf]    "checkTokenBeforeSwap": true,
2026-02-04T17:28:33.835790236Z [inf]    "showQuoteBeforeSwap": true,
2026-02-04T17:28:33.835793847Z [inf]    "swapMethod": "allowance_trade",
2026-02-04T17:28:33.835797497Z [inf]    "slippageMode": "custom",
2026-02-04T17:28:33.835801257Z [inf]    "customSlippage": "",
2026-02-04T17:28:33.835804857Z [inf]    "mevProtection": true,
2026-02-04T17:28:33.835807867Z [inf]    "priceDeviationCheck": true,
2026-02-04T17:28:33.835811507Z [inf]    "fastSwapMode": true,
2026-02-04T17:28:33.835820107Z [inf]    "copyTradeTokenCooldownMinutes": 60,
2026-02-04T17:28:33.835823147Z [inf]    "minMarketCapUsd": 22000,
2026-02-04T17:28:33.835826287Z [inf]    "minLiquidityUsd": null,
2026-02-04T17:28:33.835830087Z [inf]    "minTargetValueUsd": null,
2026-02-04T17:28:33.835833367Z [inf]    "id": "cml5i4gnq00cem112g8f6v08w",
2026-02-04T17:28:33.835836367Z [inf]    "userId": "did:privy:cmk74yj4r03jcl70b8hwyuh2c",
2026-02-04T17:28:33.835839637Z [inf]    "quickSwapMode": false,
2026-02-04T17:28:33.835843147Z [inf]    "copyTradeAIMode": "disabled",
2026-02-04T17:28:33.835846577Z [inf]    "updatedAt": "2026-02-04T17:05:58.076Z",
2026-02-04T17:28:33.835850197Z [inf]    "createdAt": "2026-02-02T18:26:51.351Z",
2026-02-04T17:28:33.835853177Z [inf]    "zoraNotificationThreshold": 5000
2026-02-04T17:28:33.836790761Z [inf]  }
2026-02-04T17:28:33.841920569Z [inf]  request completed
2026-02-04T17:28:36.989825631Z [inf]  incoming request
2026-02-04T17:28:36.989830540Z [inf]  [UserSettings] PUT /api/users/settings for user did:privy:cmk74yj4r03jcl70b8hwyuh2c: {
2026-02-04T17:28:36.989833790Z [inf]    "userRole": "default",
2026-02-04T17:28:36.989836380Z [inf]    "defaultSwapAmount": 0.01,
2026-02-04T17:28:36.989838990Z [inf]    "defaultSwapUnit": "native",
2026-02-04T17:28:36.989841740Z [inf]    "checkTokenBeforeSwap": true,
2026-02-04T17:28:36.989844890Z [inf]    "showQuoteBeforeSwap": true,
2026-02-04T17:28:36.989847290Z [inf]    "swapMethod": "allowance_trade",
2026-02-04T17:28:36.989849860Z [inf]    "slippageMode": "custom",
2026-02-04T17:28:36.989852330Z [inf]    "customSlippage": 10,
2026-02-04T17:28:36.989855580Z [inf]    "mevProtection": true,
2026-02-04T17:28:36.989857820Z [inf]    "priceDeviationCheck": true,
2026-02-04T17:28:36.989859930Z [inf]    "fastSwapMode": true,
2026-02-04T17:28:36.989862330Z [inf]    "copyTradeTokenCooldownMinutes": 60,
2026-02-04T17:28:36.989864580Z [inf]    "minMarketCapUsd": 22000,
2026-02-04T17:28:36.989867080Z [inf]    "minLiquidityUsd": null,
2026-02-04T17:28:36.989869370Z [inf]    "minTargetValueUsd": null,
2026-02-04T17:28:36.989871530Z [inf]    "id": "cml5i4gnq00cem112g8f6v08w",
2026-02-04T17:28:36.989873630Z [inf]    "userId": "did:privy:cmk74yj4r03jcl70b8hwyuh2c",
2026-02-04T17:28:36.989876230Z [inf]    "quickSwapMode": false,
2026-02-04T17:28:36.989878540Z [inf]    "copyTradeAIMode": "disabled",
2026-02-04T17:28:36.989880590Z [inf]    "updatedAt": "2026-02-04T17:05:58.076Z",
2026-02-04T17:28:36.989882740Z [inf]    "createdAt": "2026-02-02T18:26:51.351Z",
2026-02-04T17:28:36.989885040Z [inf]    "zoraNotificationThreshold": 5000
2026-02-04T17:28:36.990260787Z [inf]  }
2026-02-04T17:28:36.995120987Z [inf]  request completed
2026-02-04T17:28:37.585753443Z [inf]  incoming request
2026-02-04T17:28:37.591074671Z [inf]  [UserSettings] PUT /api/users/settings for user did:privy:cmk74yj4r03jcl70b8hwyuh2c: {
2026-02-04T17:28:37.591078671Z [inf]    "userRole": "default",
2026-02-04T17:28:37.591082651Z [inf]    "defaultSwapAmount": 0.01,
2026-02-04T17:28:37.591086651Z [inf]    "defaultSwapUnit": "native",
2026-02-04T17:28:37.591091191Z [inf]    "checkTokenBeforeSwap": true,
2026-02-04T17:28:37.591095091Z [inf]    "showQuoteBeforeSwap": true,
2026-02-04T17:28:37.591099381Z [inf]    "swapMethod": "allowance_trade",
2026-02-04T17:28:37.591103051Z [inf]    "slippageMode": "custom",
2026-02-04T17:28:37.591106881Z [inf]    "customSlippage": 10,
2026-02-04T17:28:37.591110841Z [inf]    "mevProtection": true,
2026-02-04T17:28:37.591114821Z [inf]    "priceDeviationCheck": true,
2026-02-04T17:28:37.591118231Z [inf]    "fastSwapMode": true,
2026-02-04T17:28:37.591124501Z [inf]    "copyTradeTokenCooldownMinutes": 60,
2026-02-04T17:28:37.591128221Z [inf]    "minMarketCapUsd": 22000,
2026-02-04T17:28:37.591132951Z [inf]    "minLiquidityUsd": null,
2026-02-04T17:28:37.591136461Z [inf]    "minTargetValueUsd": null,
2026-02-04T17:28:37.591140711Z [inf]    "id": "cml5i4gnq00cem112g8f6v08w",
2026-02-04T17:28:37.591144431Z [inf]    "userId": "did:privy:cmk74yj4r03jcl70b8hwyuh2c",
2026-02-04T17:28:37.591151871Z [inf]    "quickSwapMode": false,
2026-02-04T17:28:37.591154741Z [inf]    "copyTradeAIMode": "disabled",
2026-02-04T17:28:37.591158171Z [inf]    "updatedAt": "2026-02-04T17:05:58.076Z",
2026-02-04T17:28:37.591162081Z [inf]    "createdAt": "2026-02-02T18:26:51.351Z",
2026-02-04T17:28:37.591165660Z [inf]    "zoraNotificationThreshold": 5000
2026-02-04T17:28:37.591168990Z [inf]  }
2026-02-04T17:28:37.600662741Z [inf]  request completed
2026-02-04T17:28:43.440371828Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:29:03.439544037Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:29:03.439550106Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:29:03.439553936Z [inf]  0x API price received successfully
2026-02-04T17:29:03.439557626Z [wrn]  RPC endpoint failed
2026-02-04T17:29:03.439564836Z [inf]  RPC failover success
2026-02-04T17:29:03.439568006Z [wrn]  RPC endpoint failed
2026-02-04T17:29:03.439571126Z [wrn]  RPC endpoint failed
2026-02-04T17:29:03.439574346Z [inf]  RPC failover success
2026-02-04T17:29:03.440479701Z [inf]  RPC failover success
2026-02-04T17:29:03.440485951Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:29:03.440489681Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:29:03.440493330Z [inf]  📊 Position P/L check
2026-02-04T17:29:05.039286246Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:29:05.061017961Z [inf]  📊 Position P/L check
2026-02-04T17:29:08.092804090Z [inf]  incoming request
2026-02-04T17:29:08.094320721Z [inf]  ChatWS Client connected
2026-02-04T17:29:08.094325640Z [inf]  ChatWS: User connected
2026-02-04T17:29:08.432804676Z [inf]  Sync request
2026-02-04T17:29:15.098649825Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:29:15.138918234Z [inf]  📊 Position P/L check
2026-02-04T17:29:20.458802964Z [inf]  request completed
2026-02-04T17:29:20.458812324Z [inf]  incoming request
2026-02-04T17:29:20.458818084Z [inf]  request completed
2026-02-04T17:29:20.458823174Z [inf]  incoming request
2026-02-04T17:29:20.458828564Z [inf]  request completed
2026-02-04T17:29:20.458917124Z [inf]  incoming request
2026-02-04T17:29:20.597745018Z [inf]  [verifyAccess] ✅ Access granted
2026-02-04T17:29:20.597794268Z [inf]  incoming request
2026-02-04T17:29:20.597800878Z [inf]  incoming request
2026-02-04T17:29:20.597804388Z [inf]  incoming request
2026-02-04T17:29:20.597808048Z [inf]  [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmk74yj4r03jcl70b8hwyuh2c, content=这个代币为什么在涨0x2fc3dd4da...
2026-02-04T17:29:20.597811418Z [inf]  [verifyAccess] Checking access: {
2026-02-04T17:29:20.597814508Z [inf]    userId: 'did:privy:cmk74yj4r03jcl70b8hwyuh2c',
2026-02-04T17:29:20.597817318Z [inf]    userIdLength: 35,
2026-02-04T17:29:20.597823217Z [inf]    userIdPrefix: 'did:privy:cmk74yj4r0',
2026-02-04T17:29:20.597826417Z [inf]    requestedAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B'
2026-02-04T17:29:20.597829177Z [inf]  }
2026-02-04T17:29:20.602495258Z [inf]  request completed
2026-02-04T17:29:20.602498928Z [inf]  request completed
2026-02-04T17:29:20.868536478Z [inf]  incoming request
2026-02-04T17:29:20.868540178Z [inf]  request completed
2026-02-04T17:29:21.106232995Z [inf]  incoming request
2026-02-04T17:29:21.117661073Z [inf]  request completed
2026-02-04T17:29:21.445601498Z [inf]  incoming request
2026-02-04T17:29:21.445603978Z [inf]  request completed
2026-02-04T17:29:21.628914803Z [inf]  incoming request
2026-02-04T17:29:22.166845717Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:29:22.216694587Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:29:22.221724015Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:29:22.221726595Z [inf]  request completed
2026-02-04T17:29:22.228062076Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:29:22.250517886Z [inf]  request completed
2026-02-04T17:29:22.479684025Z [inf]  incoming request
2026-02-04T17:29:22.479686285Z [inf]  request completed
2026-02-04T17:29:22.519068200Z [inf]  incoming request
2026-02-04T17:29:22.519071080Z [inf]  request completed
2026-02-04T17:29:22.519074000Z [inf]  incoming request
2026-02-04T17:29:22.519076560Z [inf]  request completed
2026-02-04T17:29:22.707092947Z [inf]  incoming request
2026-02-04T17:29:22.761702685Z [inf]  incoming request
2026-02-04T17:29:22.761705865Z [inf]  incoming request
2026-02-04T17:29:22.782116019Z [inf]  request completed
2026-02-04T17:29:23.102271221Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:29:23.102278281Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:29:23.102284251Z [inf]  request completed
2026-02-04T17:29:23.104364838Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:29:23.104369218Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:29:23.104372358Z [inf]  request completed
2026-02-04T17:29:24.544991610Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:29:24.544994880Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:29:24.544997930Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:29:25.492293431Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:29:25.492296761Z [inf]  Moderation Input check result
2026-02-04T17:29:25.492299871Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_start
2026-02-04T17:29:25.492303121Z [inf]  Grok: message_start sent
2026-02-04T17:29:25.492306711Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:29:25.492309891Z [inf]  ToolPreRouter: Category matched
2026-02-04T17:29:25.492313351Z [inf]  Timer finished: intent_parsing_9d2ba19f
2026-02-04T17:29:25.501365395Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:29:25.501369655Z [inf]  Grok: routed to mode
2026-02-04T17:29:25.501372495Z [inf]  Grok: thinking mode without skills injection
2026-02-04T17:29:25.501375245Z [inf]  ChatWorker: seeded get_wallet_info from client context
2026-02-04T17:29:25.501377775Z [inf]  Timer finished: prompt_gen_MARKET_ANALYSIS_grok
2026-02-04T17:29:25.501380145Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:29:25.501382455Z [inf]  Grok: contract address detected
2026-02-04T17:29:25.838781679Z [inf]  0x API price received successfully
2026-02-04T17:29:25.849740331Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:29:26.078561974Z [inf]  Timer finished: launchpad_det_0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07
2026-02-04T17:29:26.078566134Z [inf]  Timer finished: find_token_any_0x2fc3dd4dacfd1b2fabac157de8727b54bade4b07
2026-02-04T17:29:26.078570194Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:29:26.078574444Z [inf]  Grok: removed get_token_info tool (token context present)
2026-02-04T17:29:26.078577974Z [inf]  ChatWorker: client context injected
2026-02-04T17:29:26.078581324Z [inf]  ChatWorker: client balance snapshot summary
2026-02-04T17:29:26.079541658Z [inf]  [ChatWorker] Added client context to Grok system prompt
2026-02-04T17:29:26.079547888Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:29:26.800346681Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:29:26.926883171Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:29:26.947222505Z [inf]  📊 Position P/L check
2026-02-04T17:29:30.711873785Z [inf]  incoming request
2026-02-04T17:29:30.711878375Z [inf]  [originRestriction] Internal service call authenticated
2026-02-04T17:29:30.711881425Z [err]  [apiKey] Request blocked {
2026-02-04T17:29:30.711884215Z [err]    hasAppKey: false,
2026-02-04T17:29:30.711887045Z [err]    appKeyPrefix: 'none',
2026-02-04T17:29:30.711889825Z [err]    url: '/api/ai/tools/execute',
2026-02-04T17:29:30.711892875Z [err]    method: 'POST',
2026-02-04T17:29:30.711895325Z [err]    userAgent: 'python-httpx/0.28.1',
2026-02-04T17:29:30.711897855Z [err]    origin: 'none'
2026-02-04T17:29:30.711900305Z [err]  }
2026-02-04T17:29:30.711903784Z [err]  [Error Handler] {
2026-02-04T17:29:30.711906884Z [err]    "requestId": "req-32",
2026-02-04T17:29:30.711910544Z [err]    "method": "POST",
2026-02-04T17:29:30.711914204Z [err]    "url": "/api/ai/tools/execute",
2026-02-04T17:29:30.711917734Z [err]    "ip": "100.64.0.6",
2026-02-04T17:29:30.711921074Z [err]    "error": {
2026-02-04T17:29:30.711925044Z [err]      "message": "Invalid or missing App Key",
2026-02-04T17:29:30.711928304Z [err]      "name": "Error",
2026-02-04T17:29:30.711931554Z [err]      "code": "INVALID_APP_KEY",
2026-02-04T17:29:30.711934774Z [err]      "statusCode": 401
2026-02-04T17:29:30.711937954Z [err]    }
2026-02-04T17:29:30.711940974Z [err]  }
2026-02-04T17:29:30.711944864Z [inf]  request completed
2026-02-04T17:29:30.722328439Z [inf]  incoming request
2026-02-04T17:29:30.722333959Z [inf]  [originRestriction] Internal service call authenticated
2026-02-04T17:29:30.722336709Z [err]  [apiKey] Request blocked {
2026-02-04T17:29:30.722339749Z [err]    hasAppKey: false,
2026-02-04T17:29:30.722511718Z [err]    appKeyPrefix: 'none',
2026-02-04T17:29:30.722521388Z [err]    url: '/api/social/search?q=CLAWIAI+OR+0x2FC3Dd4DacFd1b2FABac157de8727b54bADE4B07&limit=10',
2026-02-04T17:29:30.722526348Z [err]    method: 'GET',
2026-02-04T17:29:30.722531098Z [err]    userAgent: 'python-httpx/0.28.1',
2026-02-04T17:29:30.722535478Z [err]    origin: 'none'
2026-02-04T17:29:30.722539908Z [err]  }
2026-02-04T17:29:30.722545258Z [err]  [Error Handler] {
2026-02-04T17:29:30.722549938Z [err]    "method": "GET",
2026-02-04T17:29:30.722552318Z [err]    "requestId": "req-33",
2026-02-04T17:29:30.722555168Z [err]    "url": "/api/social/search?q=CLAWIAI+OR+0x2FC3Dd4DacFd1b2FABac157de8727b54bADE4B07&limit=10",
2026-02-04T17:29:30.722558828Z [err]    "ip": "100.64.0.6",
2026-02-04T17:29:30.722561928Z [err]    "error": {
2026-02-04T17:29:30.722564568Z [err]      "message": "Invalid or missing App Key",
2026-02-04T17:29:30.722568248Z [err]      "name": "Error",
2026-02-04T17:29:30.722571118Z [err]      "code": "INVALID_APP_KEY",
2026-02-04T17:29:30.722612397Z [err]      "statusCode": 401
2026-02-04T17:29:30.722616717Z [err]    }
2026-02-04T17:29:30.722619847Z [err]  }
2026-02-04T17:29:30.722622467Z [inf]  request completed
2026-02-04T17:29:31.006222499Z [err]      "statusCode": 401
2026-02-04T17:29:31.006223719Z [err]    userAgent: 'python-httpx/0.28.1',
2026-02-04T17:29:31.006229139Z [err]    }
2026-02-04T17:29:31.006229939Z [err]    origin: 'none'
2026-02-04T17:29:31.006233149Z [err]  }
2026-02-04T17:29:31.006235329Z [err]  }
2026-02-04T17:29:31.006238129Z [inf]  request completed
2026-02-04T17:29:31.006239409Z [err]  [Error Handler] {
2026-02-04T17:29:31.006245258Z [err]    "requestId": "req-34",
2026-02-04T17:29:31.006246408Z [inf]  incoming request
2026-02-04T17:29:31.006251158Z [err]    "method": "POST",
2026-02-04T17:29:31.006257458Z [err]    "url": "/api/ai/tools/execute",
2026-02-04T17:29:31.006259948Z [inf]  [originRestriction] Internal service call authenticated
2026-02-04T17:29:31.006265088Z [err]  [apiKey] Request blocked {
2026-02-04T17:29:31.006269448Z [err]    hasAppKey: false,
2026-02-04T17:29:31.006275248Z [err]    appKeyPrefix: 'none',
2026-02-04T17:29:31.006279988Z [err]    url: '/api/ai/tools/execute',
2026-02-04T17:29:31.006284138Z [err]    method: 'POST',
2026-02-04T17:29:31.006298248Z [err]    "ip": "100.64.0.7",
2026-02-04T17:29:31.006313098Z [err]    "error": {
2026-02-04T17:29:31.006330198Z [err]      "message": "Invalid or missing App Key",
2026-02-04T17:29:31.006338579Z [err]      "name": "Error",
2026-02-04T17:29:31.006346299Z [err]      "code": "INVALID_APP_KEY",
2026-02-04T17:29:31.010416333Z [inf]  incoming request
2026-02-04T17:29:31.010422423Z [inf]  [originRestriction] Internal service call authenticated
2026-02-04T17:29:31.010425703Z [err]  [apiKey] Request blocked {
2026-02-04T17:29:31.010428283Z [err]    hasAppKey: false,
2026-02-04T17:29:31.010430783Z [err]    appKeyPrefix: 'none',
2026-02-04T17:29:31.010435083Z [err]    url: '/api/ai/tools/execute',
2026-02-04T17:29:31.010437882Z [err]    method: 'POST',
2026-02-04T17:29:31.010440942Z [err]    userAgent: 'python-httpx/0.28.1',
2026-02-04T17:29:31.010443922Z [err]    origin: 'none'
2026-02-04T17:29:31.010447722Z [err]  }
2026-02-04T17:29:31.010450362Z [err]  [Error Handler] {
2026-02-04T17:29:31.010452822Z [err]    "requestId": "req-35",
2026-02-04T17:29:31.010455242Z [err]    "method": "POST",
2026-02-04T17:29:31.010457592Z [err]    "url": "/api/ai/tools/execute",
2026-02-04T17:29:31.010460142Z [err]    "ip": "100.64.0.7",
2026-02-04T17:29:31.010462512Z [err]    "error": {
2026-02-04T17:29:31.010465272Z [err]      "message": "Invalid or missing App Key",
2026-02-04T17:29:31.010467752Z [err]      "name": "Error",
2026-02-04T17:29:31.010470422Z [err]      "code": "INVALID_APP_KEY",
2026-02-04T17:29:31.010472502Z [err]      "statusCode": 401
2026-02-04T17:29:31.010474582Z [err]    }
2026-02-04T17:29:31.010476812Z [err]  }
2026-02-04T17:29:31.010479552Z [inf]  request completed
2026-02-04T17:29:34.203020973Z [inf]  incoming request
2026-02-04T17:29:34.203031303Z [inf]  [originRestriction] Internal service call authenticated
2026-02-04T17:29:34.203036733Z [err]  [apiKey] Request blocked {
2026-02-04T17:29:34.203043773Z [err]    hasAppKey: false,
2026-02-04T17:29:34.203053433Z [err]    appKeyPrefix: 'none',
2026-02-04T17:29:34.203058513Z [err]    url: '/api/ai/tools/execute',
2026-02-04T17:29:34.203062723Z [err]    method: 'POST',
2026-02-04T17:29:34.203066403Z [err]    userAgent: 'python-httpx/0.28.1',
2026-02-04T17:29:34.203070083Z [err]    origin: 'none'
2026-02-04T17:29:34.203073353Z [err]  }
2026-02-04T17:29:34.203077133Z [err]  [Error Handler] {
2026-02-04T17:29:34.203080743Z [err]    "requestId": "req-36",
2026-02-04T17:29:34.203084313Z [err]    "method": "POST",
2026-02-04T17:29:34.203090223Z [err]    "url": "/api/ai/tools/execute",
2026-02-04T17:29:34.203093493Z [err]    "ip": "100.64.0.7",
2026-02-04T17:29:34.203097423Z [err]    "error": {
2026-02-04T17:29:34.203102143Z [err]      "message": "Invalid or missing App Key",
2026-02-04T17:29:34.203105693Z [err]      "name": "Error",
2026-02-04T17:29:34.203108983Z [err]      "code": "INVALID_APP_KEY",
2026-02-04T17:29:34.203111973Z [err]      "statusCode": 401
2026-02-04T17:29:34.203115213Z [err]    }
2026-02-04T17:29:34.203119133Z [err]  }
2026-02-04T17:29:34.203122643Z [inf]  request completed
2026-02-04T17:29:34.207838234Z [err]    "error": {
2026-02-04T17:29:34.207843984Z [err]      "message": "Invalid or missing App Key",
2026-02-04T17:29:34.207849064Z [err]      "name": "Error",
2026-02-04T17:29:34.207857474Z [err]      "code": "INVALID_APP_KEY",
2026-02-04T17:29:34.207857864Z [inf]  incoming request
2026-02-04T17:29:34.207864484Z [inf]  [originRestriction] Internal service call authenticated
2026-02-04T17:29:34.207868864Z [err]      "statusCode": 401
2026-02-04T17:29:34.207871633Z [err]  [apiKey] Request blocked {
2026-02-04T17:29:34.207878263Z [err]    }
2026-02-04T17:29:34.207878453Z [err]    hasAppKey: false,
2026-02-04T17:29:34.207886033Z [err]    appKeyPrefix: 'none',
2026-02-04T17:29:34.207886933Z [err]  }
2026-02-04T17:29:34.207892323Z [err]    url: '/api/security/scan?address=0x2FC3Dd4DacFd1b2FABac157de8727b54bADE4B07&chain=base',
2026-02-04T17:29:34.207894593Z [inf]  request completed
2026-02-04T17:29:34.207897563Z [err]    method: 'GET',
2026-02-04T17:29:34.207900883Z [err]    userAgent: 'python-httpx/0.28.1',
2026-02-04T17:29:34.207904383Z [err]    origin: 'none'
2026-02-04T17:29:34.207907443Z [err]  }
2026-02-04T17:29:34.207910493Z [err]  [Error Handler] {
2026-02-04T17:29:34.207913193Z [err]    "requestId": "req-37",
2026-02-04T17:29:34.207916403Z [err]    "method": "GET",
2026-02-04T17:29:34.207919123Z [err]    "url": "/api/security/scan?address=0x2FC3Dd4DacFd1b2FABac157de8727b54bADE4B07&chain=base",
2026-02-04T17:29:34.207922043Z [err]    "ip": "100.64.0.7",
2026-02-04T17:29:36.946246259Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:29:36.984664700Z [inf]  📊 Position P/L check
2026-02-04T17:29:46.953921238Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_usage
2026-02-04T17:29:46.984205490Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:29:47.004959290Z [inf]  📊 Position P/L check
2026-02-04T17:29:47.149854948Z [inf]  Moderation Output check result
2026-02-04T17:29:47.161914173Z [inf]  Grok: task completed
2026-02-04T17:29:47.167033080Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:29:47.167038280Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
2026-02-04T17:29:47.431446433Z [inf]  incoming request
2026-02-04T17:29:47.431449213Z [inf]  request completed
2026-02-04T17:29:47.666659027Z [inf]  incoming request
2026-02-04T17:29:47.673539594Z [inf]  request completed
2026-02-04T17:29:57.019765825Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:29:57.383606588Z [inf]  0x API price received successfully
2026-02-04T17:29:57.394020213Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:29:58.141857316Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:29:58.248506381Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:30:00.374012282Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-04T17:30:00.379028841Z [inf]  [SocialJob] Trending casts are fresh, skipping Snapchain API call
2026-02-04T17:30:00.397979724Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-04T17:30:00.397984154Z [inf]  Fetching premium trending tokens
2026-02-04T17:30:00.417887380Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-04T17:30:00.417891049Z [inf]  Timer finished: recalc_heat_scores
2026-02-04T17:30:00.683137907Z [inf]  WS addresses discovered
2026-02-04T17:30:01.712330618Z [inf]  Processed DexScreener trending candidates
2026-02-04T17:30:07.742904067Z [inf]  Trending tokens fetch complete
2026-02-04T17:30:07.742906357Z [inf]  Premium trending tokens fetch complete
2026-02-04T17:30:07.742908927Z [inf]  [TokenJob] Got 100 trending tokens for Ethereum
2026-02-04T17:30:07.933834879Z [inf]  Saved 100 trending tokens for eth to database and memory cache
2026-02-04T17:30:07.934824562Z [inf]  [TokenJob] Saved 100 tokens for Ethereum to DB + cache
2026-02-04T17:30:08.255125629Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:30:28.252934503Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:30:28.328453443Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:30:28.714570232Z [inf]  0x API price received successfully
2026-02-04T17:30:28.719256552Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:30:29.498896534Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:30:29.616748260Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:30:29.642433961Z [inf]  Stop Loss triggered
2026-02-04T17:30:29.642437181Z [inf]  Executing position exit
2026-02-04T17:30:29.642440631Z [inf]  Negligible EVM balance, closing database records
2026-02-04T17:30:37.972835696Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-04T17:30:37.972840786Z [inf]  Fetching premium trending tokens
2026-02-04T17:30:38.208046704Z [inf]  WS addresses discovered
2026-02-04T17:30:39.215328311Z [inf]  Processed DexScreener trending candidates
2026-02-04T17:30:39.215334291Z [inf]  Premium trending tokens fetch complete
2026-02-04T17:30:39.215337861Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-04T17:30:39.254236219Z [inf]  Saved 100 trending tokens for solana to database and memory cache
2026-02-04T17:30:39.269113096Z [inf]  [TokenJob] Saved 100 tokens for Solana to DB + cache
2026-02-04T17:30:39.655773682Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:30:43.675521344Z [inf]  incoming request
2026-02-04T17:30:43.675525984Z [inf]  request completed
2026-02-04T17:30:43.675530304Z [inf]  incoming request
2026-02-04T17:30:43.675533674Z [inf]  request completed
2026-02-04T17:30:43.675536204Z [inf]  incoming request
2026-02-04T17:30:43.675539454Z [inf]  request completed
2026-02-04T17:30:43.907053564Z [inf]  incoming request
2026-02-04T17:30:43.907058664Z [inf]  [verifyAccess] Checking access: {
2026-02-04T17:30:43.907061994Z [inf]    userId: 'did:privy:cmk74yj4r03jcl70b8hwyuh2c',
2026-02-04T17:30:43.907064584Z [inf]    userIdLength: 35,
2026-02-04T17:30:43.907067044Z [inf]    userIdPrefix: 'did:privy:cmk74yj4r0',
2026-02-04T17:30:43.907070504Z [inf]    requestedAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B'
2026-02-04T17:30:43.907073304Z [inf]  }
2026-02-04T17:30:43.907076954Z [inf]  [verifyAccess] ✅ Access granted
2026-02-04T17:30:43.922097020Z [inf]  incoming request
2026-02-04T17:30:43.922103180Z [inf]  incoming request
2026-02-04T17:30:43.922107670Z [inf]  [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmk74yj4r03jcl70b8hwyuh2c, content=如果是clanker发布的还能🈶什么风...
2026-02-04T17:30:43.936416472Z [inf]  request completed
2026-02-04T17:30:44.784006103Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:30:44.965275867Z [inf]  request completed
2026-02-04T17:30:44.965354176Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:30:44.998363621Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:30:44.998366531Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:30:45.008793296Z [inf]  request completed
2026-02-04T17:30:45.073379684Z [inf]  incoming request
2026-02-04T17:30:45.073383114Z [inf]  request completed
2026-02-04T17:30:45.267591508Z [inf]  request completed
2026-02-04T17:30:45.267613137Z [inf]  incoming request
2026-02-04T17:30:45.276732930Z [inf]  incoming request
2026-02-04T17:30:45.276736930Z [inf]  request completed
2026-02-04T17:30:45.326414501Z [inf]  incoming request
2026-02-04T17:30:45.499714034Z [inf]  incoming request
2026-02-04T17:30:45.525113037Z [inf]  incoming request
2026-02-04T17:30:45.534840516Z [inf]  request completed
2026-02-04T17:30:45.546119166Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:30:45.546123976Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:30:45.546127056Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:30:45.736422034Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:30:45.736425414Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:30:45.736427884Z [inf]  request completed
2026-02-04T17:30:45.751552209Z [inf]  Moderation Input check result
2026-02-04T17:30:45.752159665Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_start
2026-02-04T17:30:45.752162865Z [inf]  Grok: message_start sent
2026-02-04T17:30:45.752165555Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:30:45.963539792Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:30:45.963542082Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:30:45.963544462Z [inf]  request completed
2026-02-04T17:30:49.696655490Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:30:52.043477286Z [inf]  Timer finished: intent_parsing_4dc7a882
2026-02-04T17:30:52.071991879Z [inf]  Intent follow-up recorded
2026-02-04T17:30:52.071995299Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:30:52.071998359Z [inf]  Grok: routed to mode
2026-02-04T17:30:52.072001239Z [inf]  Grok: thinking mode without skills injection
2026-02-04T17:30:52.072004629Z [inf]  ChatWorker: seeded get_wallet_info from client context
2026-02-04T17:30:52.072008269Z [inf]  Timer finished: prompt_gen_GENERAL_CHAT_grok
2026-02-04T17:30:52.074721092Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:30:52.074727472Z [inf]  ChatWorker: client context injected
2026-02-04T17:30:52.074731182Z [inf]  ChatWorker: client balance snapshot summary
2026-02-04T17:30:52.074734992Z [inf]  [ChatWorker] Added client context to Grok system prompt
2026-02-04T17:30:52.074738522Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:30:59.716482704Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:31:00.179147070Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:31:00.997051449Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:31:03.646882910Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_usage
2026-02-04T17:31:04.064874595Z [inf]  Moderation Output check result
2026-02-04T17:31:04.064878595Z [inf]  Grok: task completed
2026-02-04T17:31:04.064882665Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:31:04.064887135Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
2026-02-04T17:31:04.217078659Z [inf]  incoming request
2026-02-04T17:31:04.217082319Z [inf]  request completed
2026-02-04T17:31:04.456602162Z [inf]  incoming request
2026-02-04T17:31:04.460799286Z [inf]  request completed
2026-02-04T17:31:09.282181244Z [err]  [DBLock] Cleaning expired/stale lock {
2026-02-04T17:31:09.282188954Z [err]    key: 'lock:tokenJob:refresh:base',
2026-02-04T17:31:09.282193714Z [err]    expiresAt: '2026-02-04T17:30:11.058Z',
2026-02-04T17:31:09.282198074Z [err]    ageMs: 298217,
2026-02-04T17:31:09.282203874Z [err]    isExpired: true,
2026-02-04T17:31:09.282208044Z [err]    isVeryStale: false
2026-02-04T17:31:09.282211914Z [err]  }
2026-02-04T17:31:09.297033972Z [inf]  [DBLock] Acquired lock after cleaning stale entry { key: 'lock:tokenJob:refresh:base' }
2026-02-04T17:31:09.297038572Z [inf]  [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
2026-02-04T17:31:09.297042962Z [inf]  Fetching premium trending tokens
2026-02-04T17:31:09.523663764Z [inf]  WS addresses discovered
2026-02-04T17:31:10.453870609Z [inf]  Processed DexScreener trending candidates
2026-02-04T17:31:10.920148633Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:31:11.189928528Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T17:31:12.693149264Z [err]  Error fetching trending tokens
2026-02-04T17:31:12.693161474Z [inf]  Premium trending tokens fetch complete
2026-02-04T17:31:12.693168594Z [inf]  [TokenJob] Got 68 trending tokens for Base
2026-02-04T17:31:12.737613129Z [inf]  Saved 68 trending tokens for base to database and memory cache
2026-02-04T17:31:12.758699647Z [inf]  [TokenJob] Saved 68 tokens for Base to DB + cache
2026-02-04T17:31:20.912987128Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:31:40.910564417Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:31:40.910569297Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:31:40.910572237Z [wrn]  RPC endpoint failed
2026-02-04T17:31:40.910574697Z [inf]  RPC failover success
2026-02-04T17:31:40.910578157Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:31:40.910580627Z [inf]  incoming request
2026-02-04T17:31:40.910583277Z [inf]  request completed
2026-02-04T17:31:40.910585697Z [inf]  incoming request
2026-02-04T17:31:40.911480861Z [inf]  request completed
2026-02-04T17:31:40.911489711Z [inf]  incoming request
2026-02-04T17:31:40.911495901Z [inf]  request completed
2026-02-04T17:31:40.911501021Z [inf]  incoming request
2026-02-04T17:31:40.911504841Z [inf]  incoming request
2026-02-04T17:31:40.911509371Z [inf]  incoming request
2026-02-04T17:31:40.911513681Z [inf]  [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmk74yj4r03jcl70b8hwyuh2c, content=我是说它的智能合约会有什么危险...
2026-02-04T17:31:40.911516921Z [inf]  request completed
2026-02-04T17:31:40.911855429Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:31:40.911858389Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:31:40.911861319Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:31:40.911864059Z [inf]  request completed
2026-02-04T17:31:40.911866529Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:31:40.911868839Z [inf]  request completed
2026-02-04T17:31:40.911871789Z [inf]  incoming request
2026-02-04T17:31:40.911874448Z [inf]  request completed
2026-02-04T17:31:40.912811864Z [inf]  incoming request
2026-02-04T17:31:40.912817144Z [inf]  request completed
2026-02-04T17:31:40.912820364Z [inf]  incoming request
2026-02-04T17:31:40.912823234Z [inf]  request completed
2026-02-04T17:31:40.912826234Z [inf]  incoming request
2026-02-04T17:31:40.912828794Z [inf]  incoming request
2026-02-04T17:31:40.912831434Z [inf]  request completed
2026-02-04T17:31:40.912834054Z [inf]  incoming request
2026-02-04T17:31:40.913146591Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:31:40.913152161Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:31:40.913157751Z [inf]  request completed
2026-02-04T17:31:40.913161861Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:31:40.913165191Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:31:40.913168651Z [inf]  request completed
2026-02-04T17:31:40.913172551Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:31:40.913623859Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:31:40.913627659Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:31:40.913630229Z [inf]  Moderation Input check result
2026-02-04T17:31:40.913632589Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_start
2026-02-04T17:31:40.913635109Z [inf]  Grok: message_start sent
2026-02-04T17:31:40.913638149Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:31:42.300322769Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:31:42.772324211Z [inf]  [TokenJob] Tokens for BSC are fresh, skipping API call
2026-02-04T17:31:42.784520655Z [inf]  [TokenJob] Refreshed 4 primary chains in 102.4s
2026-02-04T17:31:45.005353224Z [inf]  Timer finished: intent_parsing_af7b0a6d
2026-02-04T17:31:45.027482136Z [inf]  Intent follow-up recorded
2026-02-04T17:31:45.027484816Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:31:45.027487436Z [inf]  Grok: routed to mode
2026-02-04T17:31:45.027489836Z [inf]  Grok: thinking mode without skills injection
2026-02-04T17:31:45.027492176Z [inf]  ChatWorker: seeded get_wallet_info from client context
2026-02-04T17:31:45.027494636Z [inf]  Timer finished: prompt_gen_GENERAL_CHAT_grok
2026-02-04T17:31:45.030831725Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:31:45.030834735Z [inf]  ChatWorker: client context injected
2026-02-04T17:31:45.030837075Z [inf]  ChatWorker: client balance snapshot summary
2026-02-04T17:31:45.030840225Z [inf]  [ChatWorker] Added client context to Grok system prompt
2026-02-04T17:31:45.030842915Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:31:47.801440736Z [inf]  incoming request
2026-02-04T17:31:47.801444486Z [inf]  [originRestriction] Internal service call authenticated
2026-02-04T17:31:47.801448316Z [err]  [apiKey] Request blocked {
2026-02-04T17:31:47.801451736Z [inf]  request completed
2026-02-04T17:31:47.801452566Z [err]    hasAppKey: false,
2026-02-04T17:31:47.801456476Z [err]    appKeyPrefix: 'none',
2026-02-04T17:31:47.801459936Z [err]    url: '/api/ai/tools/execute',
2026-02-04T17:31:47.801465305Z [err]    method: 'POST',
2026-02-04T17:31:47.801466315Z [inf]  incoming request
2026-02-04T17:31:47.801468205Z [err]  [Error Handler] {
2026-02-04T17:31:47.801471535Z [err]    userAgent: 'python-httpx/0.28.1',
2026-02-04T17:31:47.801475765Z [err]    origin: 'none'
2026-02-04T17:31:47.801483145Z [err]    "requestId": "req-40",
2026-02-04T17:31:47.801487675Z [err]  }
2026-02-04T17:31:47.801490845Z [err]    "method": "POST",
2026-02-04T17:31:47.801495415Z [err]    "url": "/api/ai/tools/execute",
2026-02-04T17:31:47.801499035Z [err]    "ip": "100.64.0.8",
2026-02-04T17:31:47.801503195Z [err]    "error": {
2026-02-04T17:31:47.801509895Z [err]      "message": "Invalid or missing App Key",
2026-02-04T17:31:47.801513935Z [err]      "name": "Error",
2026-02-04T17:31:47.801517915Z [err]      "code": "INVALID_APP_KEY",
2026-02-04T17:31:47.801523325Z [err]      "statusCode": 401
2026-02-04T17:31:47.801529705Z [err]    }
2026-02-04T17:31:47.801536265Z [err]  }
2026-02-04T17:31:47.802465989Z [inf]  [originRestriction] Internal service call authenticated
2026-02-04T17:31:47.802473389Z [err]      "name": "Error",
2026-02-04T17:31:47.802473899Z [err]  [apiKey] Request blocked {
2026-02-04T17:31:47.802480399Z [err]    hasAppKey: false,
2026-02-04T17:31:47.802485939Z [err]      "code": "INVALID_APP_KEY",
2026-02-04T17:31:47.802487839Z [err]    appKeyPrefix: 'none',
2026-02-04T17:31:47.802494659Z [err]    url: '/api/security/scan?address=0x2FC3Dd4DacFd1b2FABac157de8727b54bADE4B07&chain=base',
2026-02-04T17:31:47.802495949Z [err]      "statusCode": 401
2026-02-04T17:31:47.802503419Z [err]    }
2026-02-04T17:31:47.802504539Z [err]    method: 'GET',
2026-02-04T17:31:47.802511559Z [err]    userAgent: 'python-httpx/0.28.1',
2026-02-04T17:31:47.802512219Z [err]  }
2026-02-04T17:31:47.802515579Z [err]    origin: 'none'
2026-02-04T17:31:47.802520839Z [inf]  request completed
2026-02-04T17:31:47.802522719Z [err]  }
2026-02-04T17:31:47.802527009Z [err]  [Error Handler] {
2026-02-04T17:31:47.802530219Z [err]    "requestId": "req-41",
2026-02-04T17:31:47.802533289Z [err]    "method": "GET",
2026-02-04T17:31:47.802536339Z [err]    "url": "/api/security/scan?address=0x2FC3Dd4DacFd1b2FABac157de8727b54bADE4B07&chain=base",
2026-02-04T17:31:47.802539499Z [err]    "ip": "100.64.0.8",
2026-02-04T17:31:47.802542379Z [err]    "error": {
2026-02-04T17:31:47.802545389Z [err]      "message": "Invalid or missing App Key",
2026-02-04T17:31:48.212768046Z [inf]  incoming request
2026-02-04T17:31:48.212771666Z [inf]  [originRestriction] Internal service call authenticated
2026-02-04T17:31:48.212774556Z [err]  [apiKey] Request blocked {
2026-02-04T17:31:48.212777376Z [err]    hasAppKey: false,
2026-02-04T17:31:48.212780346Z [err]    appKeyPrefix: 'none',
2026-02-04T17:31:48.212782926Z [err]    url: '/api/ai/tools/execute',
2026-02-04T17:31:48.212785586Z [err]    method: 'POST',
2026-02-04T17:31:48.212790426Z [err]    userAgent: 'python-httpx/0.28.1',
2026-02-04T17:31:48.212793536Z [err]    origin: 'none'
2026-02-04T17:31:48.212796326Z [err]  }
2026-02-04T17:31:48.212799066Z [err]  [Error Handler] {
2026-02-04T17:31:48.212801856Z [err]    "requestId": "req-42",
2026-02-04T17:31:48.212804546Z [err]    "method": "POST",
2026-02-04T17:31:48.212807706Z [err]    "url": "/api/ai/tools/execute",
2026-02-04T17:31:48.212813155Z [err]    "ip": "100.64.0.6",
2026-02-04T17:31:48.212816155Z [err]    "error": {
2026-02-04T17:31:48.212819155Z [err]      "message": "Invalid or missing App Key",
2026-02-04T17:31:48.212822715Z [err]      "name": "Error",
2026-02-04T17:31:48.212825925Z [err]      "code": "INVALID_APP_KEY",
2026-02-04T17:31:48.212828575Z [err]      "statusCode": 401
2026-02-04T17:31:48.212831375Z [err]    }
2026-02-04T17:31:48.212835025Z [err]  }
2026-02-04T17:31:48.212837955Z [inf]  request completed
2026-02-04T17:31:48.212840995Z [inf]  incoming request
2026-02-04T17:31:48.213602311Z [inf]  [originRestriction] Internal service call authenticated
2026-02-04T17:31:48.213605381Z [err]  [apiKey] Request blocked {
2026-02-04T17:31:48.213609001Z [err]    hasAppKey: false,
2026-02-04T17:31:48.213611801Z [err]    appKeyPrefix: 'none',
2026-02-04T17:31:48.213614861Z [err]    url: '/api/tokens/base/0x2FC3Dd4DacFd1b2FABac157de8727b54bADE4B07',
2026-02-04T17:31:48.213617831Z [err]    method: 'GET',
2026-02-04T17:31:48.213620610Z [err]    userAgent: 'python-httpx/0.28.1',
2026-02-04T17:31:48.213623820Z [err]    origin: 'none'
2026-02-04T17:31:48.213626830Z [err]  }
2026-02-04T17:31:48.213629210Z [err]  [Error Handler] {
2026-02-04T17:31:48.213631670Z [err]    "requestId": "req-43",
2026-02-04T17:31:48.213634740Z [err]    "method": "GET",
2026-02-04T17:31:48.213637630Z [err]    "url": "/api/tokens/base/0x2FC3Dd4DacFd1b2FABac157de8727b54bADE4B07",
2026-02-04T17:31:48.213640360Z [err]    "ip": "100.64.0.6",
2026-02-04T17:31:48.213643800Z [err]    "error": {
2026-02-04T17:31:48.213646490Z [err]      "message": "Invalid or missing App Key",
2026-02-04T17:31:48.213649990Z [err]      "name": "Error",
2026-02-04T17:31:48.213652930Z [err]      "code": "INVALID_APP_KEY",
2026-02-04T17:31:48.213655770Z [err]      "statusCode": 401
2026-02-04T17:31:48.213658680Z [err]    }
2026-02-04T17:31:48.213661730Z [err]  }
2026-02-04T17:31:48.213664730Z [inf]  request completed
2026-02-04T17:31:48.406441345Z [inf]  incoming request
2026-02-04T17:31:48.406453404Z [inf]  [originRestriction] Internal service call authenticated
2026-02-04T17:31:48.406458974Z [err]  [apiKey] Request blocked {
2026-02-04T17:31:48.406464444Z [err]    hasAppKey: false,
2026-02-04T17:31:48.406474444Z [err]    appKeyPrefix: 'none',
2026-02-04T17:31:48.406483294Z [err]    url: '/api/ai/tools/execute',
2026-02-04T17:31:48.406488464Z [err]    method: 'POST',
2026-02-04T17:31:48.406493004Z [err]    userAgent: 'python-httpx/0.28.1',
2026-02-04T17:31:48.406497454Z [err]    origin: 'none'
2026-02-04T17:31:48.406501944Z [err]  }
2026-02-04T17:31:48.406506414Z [err]  [Error Handler] {
2026-02-04T17:31:48.406510974Z [err]    "requestId": "req-44",
2026-02-04T17:31:48.406517594Z [err]    "method": "POST",
2026-02-04T17:31:48.406522304Z [err]    "url": "/api/ai/tools/execute",
2026-02-04T17:31:48.406526784Z [err]    "ip": "100.64.0.7",
2026-02-04T17:31:48.406531074Z [err]    "error": {
2026-02-04T17:31:48.406535514Z [err]      "message": "Invalid or missing App Key",
2026-02-04T17:31:48.406539764Z [err]      "name": "Error",
2026-02-04T17:31:48.406544294Z [err]      "code": "INVALID_APP_KEY",
2026-02-04T17:31:48.406549704Z [err]      "statusCode": 401
2026-02-04T17:31:48.406554224Z [err]    }
2026-02-04T17:31:48.406558874Z [err]  }
2026-02-04T17:31:48.406563144Z [inf]  request completed
2026-02-04T17:31:48.406567974Z [inf]  incoming request
2026-02-04T17:31:48.407664416Z [err]      "statusCode": 401
2026-02-04T17:31:48.407670286Z [err]    }
2026-02-04T17:31:48.407674286Z [err]  }
2026-02-04T17:31:48.407679116Z [inf]  request completed
2026-02-04T17:31:48.407686777Z [inf]  [originRestriction] Internal service call authenticated
2026-02-04T17:31:48.407690827Z [err]  [apiKey] Request blocked {
2026-02-04T17:31:48.407694257Z [err]    hasAppKey: false,
2026-02-04T17:31:48.407697497Z [err]    appKeyPrefix: 'none',
2026-02-04T17:31:48.407700537Z [err]    url: '/api/ai/tools/execute',
2026-02-04T17:31:48.407703037Z [err]    method: 'POST',
2026-02-04T17:31:48.407706077Z [err]    userAgent: 'python-httpx/0.28.1',
2026-02-04T17:31:48.407709577Z [err]    origin: 'none'
2026-02-04T17:31:48.407712407Z [err]  }
2026-02-04T17:31:48.407715737Z [err]  [Error Handler] {
2026-02-04T17:31:48.407719007Z [err]    "requestId": "req-45",
2026-02-04T17:31:48.407722117Z [err]    "method": "POST",
2026-02-04T17:31:48.407725267Z [err]    "url": "/api/ai/tools/execute",
2026-02-04T17:31:48.407729017Z [err]    "ip": "100.64.0.7",
2026-02-04T17:31:48.407734007Z [err]    "error": {
2026-02-04T17:31:48.407737197Z [err]      "message": "Invalid or missing App Key",
2026-02-04T17:31:48.407740147Z [err]      "name": "Error",
2026-02-04T17:31:48.407743567Z [err]      "code": "INVALID_APP_KEY",
2026-02-04T17:31:52.370363959Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:32:12.370425919Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:32:12.370431269Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:32:12.370434319Z [wrn]  RPC endpoint failed
2026-02-04T17:32:12.370436739Z [inf]  RPC failover success
2026-02-04T17:32:12.370439579Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:32:13.750502379Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:32:33.738424097Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:32:33.738429707Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_usage
2026-02-04T17:32:33.738432947Z [inf]  Moderation Output check result
2026-02-04T17:32:33.738435887Z [inf]  Grok: task completed
2026-02-04T17:32:33.738438237Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:32:33.738441347Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
2026-02-04T17:32:33.738444087Z [inf]  incoming request
2026-02-04T17:32:33.740426716Z [inf]  request completed
2026-02-04T17:32:33.740430906Z [inf]  incoming request
2026-02-04T17:32:33.740434005Z [inf]  request completed
2026-02-04T17:32:33.866244606Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:32:34.421855447Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:32:35.078999799Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:32:55.077046155Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:32:55.077051255Z [inf]  incoming request
2026-02-04T17:32:55.077054605Z [inf]  request completed
2026-02-04T17:32:55.077057425Z [inf]  incoming request
2026-02-04T17:32:55.077060125Z [inf]  request completed
2026-02-04T17:32:55.077063355Z [inf]  incoming request
2026-02-04T17:32:55.077065955Z [inf]  request completed
2026-02-04T17:32:55.077068385Z [inf]  incoming request
2026-02-04T17:32:55.077542721Z [inf]  incoming request
2026-02-04T17:32:55.077549951Z [inf]  incoming request
2026-02-04T17:32:55.077554831Z [inf]  [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmk74yj4r03jcl70b8hwyuh2c, content=那就是没啥问题啊...
2026-02-04T17:32:55.077559321Z [inf]  [verifyAccess] Checking access: {
2026-02-04T17:32:55.077563701Z [inf]    userId: 'did:privy:cmk74yj4r03jcl70b8hwyuh2c',
2026-02-04T17:32:55.077568361Z [inf]    userIdLength: 35,
2026-02-04T17:32:55.077572781Z [inf]    userIdPrefix: 'did:privy:cmk74yj4r0',
2026-02-04T17:32:55.077577081Z [inf]    requestedAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B'
2026-02-04T17:32:55.077580941Z [inf]  }
2026-02-04T17:32:55.077585431Z [inf]  [verifyAccess] ✅ Access granted
2026-02-04T17:32:55.077589841Z [inf]  request completed
2026-02-04T17:32:55.114467483Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:32:55.312922796Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:32:55.312928516Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:32:55.344078003Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:32:55.344084343Z [inf]  request completed
2026-02-04T17:32:55.348850333Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:32:55.543229821Z [inf]  request completed
2026-02-04T17:32:55.586766492Z [inf]  incoming request
2026-02-04T17:32:55.586771002Z [inf]  request completed
2026-02-04T17:32:55.608846245Z [inf]  incoming request
2026-02-04T17:32:55.608851445Z [inf]  request completed
2026-02-04T17:32:55.667706401Z [inf]  incoming request
2026-02-04T17:32:55.670259845Z [inf]  request completed
2026-02-04T17:32:55.835889320Z [inf]  incoming request
2026-02-04T17:32:55.857135800Z [inf]  incoming request
2026-02-04T17:32:55.889415700Z [inf]  request completed
2026-02-04T17:32:55.907920845Z [inf]  incoming request
2026-02-04T17:32:56.255477685Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:32:56.255481775Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:32:56.255485365Z [inf]  request completed
2026-02-04T17:32:56.288685790Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:32:56.288688820Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:32:56.288691610Z [inf]  request completed
2026-02-04T17:32:57.632908826Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:32:57.632911576Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:32:57.632914586Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:32:57.863695198Z [inf]  Moderation Input check result
2026-02-04T17:32:57.863698508Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_start
2026-02-04T17:32:57.863702398Z [inf]  Grok: message_start sent
2026-02-04T17:32:57.863705498Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:33:00.910317784Z [inf]  Timer finished: intent_parsing_91b0eab8
2026-02-04T17:33:00.931355335Z [inf]  Intent follow-up recorded
2026-02-04T17:33:00.931360025Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:33:00.931363795Z [inf]  Grok: routed to mode
2026-02-04T17:33:00.931367085Z [inf]  Grok: thinking mode without skills injection
2026-02-04T17:33:00.931370215Z [inf]  ChatWorker: seeded get_wallet_info from client context
2026-02-04T17:33:00.931373945Z [inf]  Timer finished: prompt_gen_GENERAL_CHAT_grok
2026-02-04T17:33:00.932036740Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:33:00.932039480Z [inf]  ChatWorker: client context injected
2026-02-04T17:33:00.932042180Z [inf]  ChatWorker: client balance snapshot summary
2026-02-04T17:33:00.932046000Z [inf]  [ChatWorker] Added client context to Grok system prompt
2026-02-04T17:33:00.932048480Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:33:05.135429066Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:33:05.551064306Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:33:06.720244156Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:33:08.985123481Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_usage
2026-02-04T17:33:09.265040031Z [inf]  Moderation Output check result
2026-02-04T17:33:09.287601711Z [inf]  Grok: task completed
2026-02-04T17:33:09.287604271Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:33:09.287607741Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
2026-02-04T17:33:09.611253951Z [inf]  incoming request
2026-02-04T17:33:09.611256451Z [inf]  request completed
2026-02-04T17:33:09.788206386Z [inf]  incoming request
2026-02-04T17:33:09.798517603Z [inf]  request completed
2026-02-04T17:33:16.067315177Z [inf]  incoming request
2026-02-04T17:33:16.067320557Z [inf]  request completed
2026-02-04T17:33:16.305726973Z [inf]  incoming request
2026-02-04T17:33:16.310618324Z [inf]  request completed
2026-02-04T17:33:16.804594470Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:33:17.364344770Z [inf]  incoming request
2026-02-04T17:33:17.364349320Z [inf]  request completed
2026-02-04T17:33:17.607721636Z [inf]  incoming request
2026-02-04T17:33:17.607723776Z [inf]  request completed
2026-02-04T17:33:17.612316677Z [inf]  incoming request
2026-02-04T17:33:17.612326937Z [inf]  [UserSettings] PUT /api/users/settings for user did:privy:cmk74yj4r03jcl70b8hwyuh2c: {
2026-02-04T17:33:17.612334427Z [inf]    "userRole": "default",
2026-02-04T17:33:17.612339097Z [inf]    "defaultSwapAmount": 0.01,
2026-02-04T17:33:17.612342627Z [inf]    "defaultSwapUnit": "native",
2026-02-04T17:33:17.612347057Z [inf]    "checkTokenBeforeSwap": true,
2026-02-04T17:33:17.612351947Z [inf]    "showQuoteBeforeSwap": true,
2026-02-04T17:33:17.612355787Z [inf]    "swapMethod": "allowance_trade",
2026-02-04T17:33:17.612359727Z [inf]    "slippageMode": "custom",
2026-02-04T17:33:17.612369247Z [inf]    "customSlippage": 10,
2026-02-04T17:33:17.612373137Z [inf]    "mevProtection": true,
2026-02-04T17:33:17.612376857Z [inf]    "priceDeviationCheck": true,
2026-02-04T17:33:17.612380307Z [inf]    "fastSwapMode": true,
2026-02-04T17:33:17.612388047Z [inf]    "copyTradeTokenCooldownMinutes": 60,
2026-02-04T17:33:17.612391327Z [inf]    "minMarketCapUsd": 22000,
2026-02-04T17:33:17.612395017Z [inf]    "minLiquidityUsd": null,
2026-02-04T17:33:17.612398777Z [inf]    "minTargetValueUsd": null,
2026-02-04T17:33:17.612403037Z [inf]    "id": "cml5i4gnq00cem112g8f6v08w",
2026-02-04T17:33:17.612406347Z [inf]    "userId": "did:privy:cmk74yj4r03jcl70b8hwyuh2c",
2026-02-04T17:33:17.612410417Z [inf]    "quickSwapMode": false,
2026-02-04T17:33:17.612414487Z [inf]    "copyTradeAIMode": "disabled",
2026-02-04T17:33:17.612418167Z [inf]    "updatedAt": "2026-02-04T17:28:37.592Z",
2026-02-04T17:33:17.612422937Z [inf]    "createdAt": "2026-02-02T18:26:51.351Z",
2026-02-04T17:33:17.612427597Z [inf]    "zoraNotificationThreshold": 5000
2026-02-04T17:33:17.612562616Z [inf]  }
2026-02-04T17:33:17.621408331Z [inf]  request completed
2026-02-04T17:33:17.837902062Z [inf]    "zoraNotificationThreshold": 5000
2026-02-04T17:33:17.837916122Z [inf]    "minMarketCapUsd": 22000,
2026-02-04T17:33:17.837916372Z [inf]    "showQuoteBeforeSwap": true,
2026-02-04T17:33:17.837921632Z [inf]    "swapMethod": "allowance_trade",
2026-02-04T17:33:17.837927042Z [inf]    "minLiquidityUsd": null,
2026-02-04T17:33:17.837929452Z [inf]    "slippageMode": "custom",
2026-02-04T17:33:17.837934972Z [inf]    "minTargetValueUsd": null,
2026-02-04T17:33:17.837937222Z [inf]    "customSlippage": 10,
2026-02-04T17:33:17.837944142Z [inf]    "id": "cml5i4gnq00cem112g8f6v08w",
2026-02-04T17:33:17.837946592Z [inf]    "mevProtection": true,
2026-02-04T17:33:17.837952922Z [inf]    "userId": "did:privy:cmk74yj4r03jcl70b8hwyuh2c",
2026-02-04T17:33:17.837958262Z [inf]  incoming request
2026-02-04T17:33:17.837958642Z [inf]    "priceDeviationCheck": true,
2026-02-04T17:33:17.837964592Z [inf]    "quickSwapMode": false,
2026-02-04T17:33:17.837966542Z [inf]    "copyTradeAIMode": "disabled",
2026-02-04T17:33:17.837971802Z [inf]    "fastSwapMode": true,
2026-02-04T17:33:17.837972152Z [inf]  [UserSettings] PUT /api/users/settings for user did:privy:cmk74yj4r03jcl70b8hwyuh2c: {
2026-02-04T17:33:17.837979072Z [inf]    "copyTradeTokenCooldownMinutes": 60,
2026-02-04T17:33:17.837980222Z [inf]    "userRole": "default",
2026-02-04T17:33:17.837988112Z [inf]    "defaultSwapAmount": 0.01,
2026-02-04T17:33:17.837991002Z [inf]    "updatedAt": "2026-02-04T17:28:37.592Z",
2026-02-04T17:33:17.837995022Z [inf]    "defaultSwapUnit": "native",
2026-02-04T17:33:17.838002022Z [inf]    "checkTokenBeforeSwap": true,
2026-02-04T17:33:17.838004192Z [inf]    "createdAt": "2026-02-02T18:26:51.351Z",
2026-02-04T17:33:17.838342510Z [inf]  }
2026-02-04T17:33:17.839723371Z [inf]  request completed
2026-02-04T17:33:26.997020655Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:33:46.986856016Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:33:46.986861166Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:33:46.986864886Z [wrn]  RPC endpoint failed
2026-02-04T17:33:46.986868286Z [wrn]  RPC endpoint failed
2026-02-04T17:33:46.986871366Z [inf]  RPC failover success
2026-02-04T17:33:46.986874306Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:33:48.736332931Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:33:48.783626060Z [inf]  📊 Position P/L check
2026-02-04T17:33:58.779866778Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:33:58.846290028Z [inf]  📊 Position P/L check
2026-02-04T17:34:08.843882204Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:34:09.237089788Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:34:10.024359559Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:34:10.050101860Z [inf]  📊 Position P/L check
2026-02-04T17:34:11.349727540Z [inf]  incoming request
2026-02-04T17:34:11.349731490Z [inf]  request completed
2026-02-04T17:34:11.349735300Z [inf]  incoming request
2026-02-04T17:34:11.349738829Z [inf]  request completed
2026-02-04T17:34:11.349742659Z [inf]  incoming request
2026-02-04T17:34:11.349746009Z [inf]  request completed
2026-02-04T17:34:11.594420929Z [inf]  incoming request
2026-02-04T17:34:11.594424959Z [inf]  incoming request
2026-02-04T17:34:11.594429869Z [inf]  incoming request
2026-02-04T17:34:11.594433469Z [inf]  [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmk74yj4r03jcl70b8hwyuh2c, content=Copy Trade 0xffed8b8...
2026-02-04T17:34:11.594436619Z [inf]  [verifyAccess] Checking access: {
2026-02-04T17:34:11.594441449Z [inf]    userId: 'did:privy:cmk74yj4r03jcl70b8hwyuh2c',
2026-02-04T17:34:11.594445129Z [inf]    userIdLength: 35,
2026-02-04T17:34:11.594448569Z [inf]    userIdPrefix: 'did:privy:cmk74yj4r0',
2026-02-04T17:34:11.594451539Z [inf]    requestedAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B'
2026-02-04T17:34:11.594454809Z [inf]  }
2026-02-04T17:34:11.598888752Z [inf]  [verifyAccess] ✅ Access granted
2026-02-04T17:34:11.603733562Z [inf]  request completed
2026-02-04T17:34:12.842038189Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:34:12.886767634Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:34:12.886770154Z [inf]  request completed
2026-02-04T17:34:12.998622313Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:34:12.998625873Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:34:13.008277684Z [inf]  request completed
2026-02-04T17:34:13.123469213Z [inf]  incoming request
2026-02-04T17:34:13.123478073Z [inf]  request completed
2026-02-04T17:34:13.270012589Z [inf]  incoming request
2026-02-04T17:34:13.270016038Z [inf]  request completed
2026-02-04T17:34:13.283569805Z [inf]  incoming request
2026-02-04T17:34:13.283574375Z [inf]  request completed
2026-02-04T17:34:13.369684834Z [inf]  incoming request
2026-02-04T17:34:13.509874118Z [inf]  incoming request
2026-02-04T17:34:13.515437924Z [inf]  incoming request
2026-02-04T17:34:13.545756807Z [inf]  request completed
2026-02-04T17:34:13.582884548Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:34:13.582888118Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:34:13.582915557Z [inf]  request completed
2026-02-04T17:34:13.830389301Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:34:13.830393701Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:34:13.830398390Z [inf]  request completed
2026-02-04T17:34:15.803428355Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:34:15.803439335Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:34:15.803475185Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:34:16.845863863Z [inf]  Moderation Input check result
2026-02-04T17:34:16.845866383Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_start
2026-02-04T17:34:16.845869283Z [inf]  Grok: message_start sent
2026-02-04T17:34:16.845871713Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:34:16.845874113Z [inf]  ToolPreRouter: Category matched
2026-02-04T17:34:20.051058087Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:34:20.120627297Z [inf]  📊 Position P/L check
2026-02-04T17:34:21.720620605Z [inf]  Timer finished: intent_parsing_39f7fa8c
2026-02-04T17:34:21.856994004Z [inf]  Intent follow-up recorded
2026-02-04T17:34:21.856997213Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:34:21.857000393Z [inf]  Grok: routed to mode
2026-02-04T17:34:21.857003753Z [inf]  ChatWorker: seeded get_wallet_info from client context
2026-02-04T17:34:21.857007333Z [inf]  Timer finished: prompt_gen_COPY_TRADING_grok
2026-02-04T17:34:21.857010473Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:34:21.858390235Z [inf]  Grok: contract address detected
2026-02-04T17:34:21.988539482Z [inf]  Timer finished: launchpad_det_0xffed8b8c0dc8d2b378a75542b0a077263990f8ca
2026-02-04T17:34:22.096557806Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:34:22.096562336Z [inf]  ChatWorker: client context injected
2026-02-04T17:34:22.096565836Z [inf]  ChatWorker: client balance snapshot summary
2026-02-04T17:34:22.096568676Z [inf]  [ChatWorker] Added client context to Grok system prompt
2026-02-04T17:34:22.096571826Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:34:25.285434913Z [inf]  incoming request
2026-02-04T17:34:25.285437632Z [inf]  [originRestriction] Internal service call authenticated
2026-02-04T17:34:25.287656139Z [inf]  request completed
2026-02-04T17:34:25.287657589Z [err]  [apiKey] Request blocked {
2026-02-04T17:34:25.287665849Z [err]    hasAppKey: false,
2026-02-04T17:34:25.287670089Z [err]    appKeyPrefix: 'none',
2026-02-04T17:34:25.287673529Z [err]    url: '/api/ai/tools/execute',
2026-02-04T17:34:25.287676989Z [err]    method: 'POST',
2026-02-04T17:34:25.287680209Z [err]    userAgent: 'python-httpx/0.28.1',
2026-02-04T17:34:25.287683229Z [err]    origin: 'none'
2026-02-04T17:34:25.287686599Z [err]  }
2026-02-04T17:34:25.287690189Z [err]  [Error Handler] {
2026-02-04T17:34:25.287693189Z [err]    "requestId": "req-54",
2026-02-04T17:34:25.287695819Z [err]    "method": "POST",
2026-02-04T17:34:25.287698779Z [err]    "url": "/api/ai/tools/execute",
2026-02-04T17:34:25.287702169Z [err]    "ip": "100.64.0.9",
2026-02-04T17:34:25.287705139Z [err]    "error": {
2026-02-04T17:34:25.287708639Z [err]      "message": "Invalid or missing App Key",
2026-02-04T17:34:25.287711699Z [err]      "name": "Error",
2026-02-04T17:34:25.287714079Z [err]      "code": "INVALID_APP_KEY",
2026-02-04T17:34:25.287716689Z [err]      "statusCode": 401
2026-02-04T17:34:25.287719219Z [err]    }
2026-02-04T17:34:25.287721949Z [err]  }
2026-02-04T17:34:25.293710912Z [err]      "code": "INVALID_APP_KEY",
2026-02-04T17:34:25.293715092Z [inf]  incoming request
2026-02-04T17:34:25.293721102Z [err]      "statusCode": 401
2026-02-04T17:34:25.293724912Z [inf]  [originRestriction] Internal service call authenticated
2026-02-04T17:34:25.293727852Z [err]    }
2026-02-04T17:34:25.293731622Z [err]  [apiKey] Request blocked {
2026-02-04T17:34:25.293734112Z [err]  }
2026-02-04T17:34:25.293737102Z [err]    hasAppKey: false,
2026-02-04T17:34:25.293741292Z [inf]  request completed
2026-02-04T17:34:25.293743312Z [err]    appKeyPrefix: 'none',
2026-02-04T17:34:25.293746542Z [err]    url: '/api/ai/tools/execute',
2026-02-04T17:34:25.293749202Z [err]    method: 'POST',
2026-02-04T17:34:25.293751632Z [err]    userAgent: 'python-httpx/0.28.1',
2026-02-04T17:34:25.293754451Z [err]    origin: 'none'
2026-02-04T17:34:25.293757081Z [err]  }
2026-02-04T17:34:25.293760011Z [err]  [Error Handler] {
2026-02-04T17:34:25.293764061Z [err]    "requestId": "req-55",
2026-02-04T17:34:25.293767031Z [err]    "method": "POST",
2026-02-04T17:34:25.293769981Z [err]    "url": "/api/ai/tools/execute",
2026-02-04T17:34:25.293772701Z [err]    "ip": "100.64.0.9",
2026-02-04T17:34:25.293775431Z [err]    "error": {
2026-02-04T17:34:25.293777921Z [err]      "message": "Invalid or missing App Key",
2026-02-04T17:34:25.293792111Z [err]      "name": "Error",
2026-02-04T17:34:25.345858900Z [inf]  incoming request
2026-02-04T17:34:25.345883760Z [inf]  [originRestriction] Internal service call authenticated
2026-02-04T17:34:25.345892070Z [err]  [apiKey] Request blocked {
2026-02-04T17:34:25.345897070Z [err]    hasAppKey: false,
2026-02-04T17:34:25.345901070Z [err]    appKeyPrefix: 'none',
2026-02-04T17:34:25.345905200Z [err]    url: '/api/ai/tools/execute',
2026-02-04T17:34:25.345909050Z [err]    method: 'POST',
2026-02-04T17:34:25.345912610Z [err]    userAgent: 'python-httpx/0.28.1',
2026-02-04T17:34:25.345916170Z [err]    origin: 'none'
2026-02-04T17:34:25.345920700Z [err]  }
2026-02-04T17:34:25.345925220Z [err]  [Error Handler] {
2026-02-04T17:34:25.345928900Z [err]    "requestId": "req-56",
2026-02-04T17:34:25.345935820Z [err]    "method": "POST",
2026-02-04T17:34:25.345939180Z [err]    "url": "/api/ai/tools/execute",
2026-02-04T17:34:25.345942750Z [err]    "ip": "100.64.0.10",
2026-02-04T17:34:25.345946160Z [err]    "error": {
2026-02-04T17:34:25.345949780Z [err]      "message": "Invalid or missing App Key",
2026-02-04T17:34:25.345954120Z [err]      "name": "Error",
2026-02-04T17:34:25.345957389Z [err]      "code": "INVALID_APP_KEY",
2026-02-04T17:34:25.345961179Z [err]      "statusCode": 401
2026-02-04T17:34:25.345965109Z [err]    }
2026-02-04T17:34:25.345969649Z [err]  }
2026-02-04T17:34:25.345973449Z [inf]  request completed
2026-02-04T17:34:25.351238507Z [err]    "requestId": "req-57",
2026-02-04T17:34:25.351250087Z [err]    "method": "POST",
2026-02-04T17:34:25.351286716Z [err]    "url": "/api/ai/tools/execute",
2026-02-04T17:34:25.351291896Z [err]    "ip": "100.64.0.10",
2026-02-04T17:34:25.351296856Z [inf]  incoming request
2026-02-04T17:34:25.351299526Z [err]    "error": {
2026-02-04T17:34:25.351306686Z [err]      "message": "Invalid or missing App Key",
2026-02-04T17:34:25.351308536Z [inf]  [originRestriction] Internal service call authenticated
2026-02-04T17:34:25.351315246Z [err]      "name": "Error",
2026-02-04T17:34:25.351321496Z [err]      "code": "INVALID_APP_KEY",
2026-02-04T17:34:25.351323906Z [err]  [apiKey] Request blocked {
2026-02-04T17:34:25.351327186Z [err]      "statusCode": 401
2026-02-04T17:34:25.351332356Z [err]    hasAppKey: false,
2026-02-04T17:34:25.351335336Z [err]    }
2026-02-04T17:34:25.351341506Z [err]    appKeyPrefix: 'none',
2026-02-04T17:34:25.351343466Z [err]  }
2026-02-04T17:34:25.351349886Z [inf]  request completed
2026-02-04T17:34:25.351352126Z [err]    url: '/api/ai/tools/execute',
2026-02-04T17:34:25.351356516Z [err]    method: 'POST',
2026-02-04T17:34:25.351360626Z [err]    userAgent: 'python-httpx/0.28.1',
2026-02-04T17:34:25.351364606Z [err]    origin: 'none'
2026-02-04T17:34:25.351368096Z [err]  }
2026-02-04T17:34:25.351373466Z [err]  [Error Handler] {
2026-02-04T17:34:30.123548218Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:34:30.190293077Z [inf]  📊 Position P/L check
2026-02-04T17:34:33.692710014Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_usage
2026-02-04T17:34:33.976994971Z [inf]  Moderation Output check result
2026-02-04T17:34:33.976997701Z [inf]  Grok: task completed
2026-02-04T17:34:33.977000641Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:34:33.977003661Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
2026-02-04T17:34:34.152114660Z [inf]  incoming request
2026-02-04T17:34:34.152118850Z [inf]  request completed
2026-02-04T17:34:34.411687820Z [inf]  incoming request
2026-02-04T17:34:34.416693278Z [inf]  request completed
2026-02-04T17:34:40.194724365Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:34:40.578238011Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:34:41.475845415Z [wrn]  RPC endpoint failed
2026-02-04T17:34:41.541024104Z [inf]  RPC failover success
2026-02-04T17:34:41.561963395Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:34:41.572908317Z [inf]  📊 Position P/L check
2026-02-04T17:35:01.571068824Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:35:01.571072764Z [inf]  incoming request
2026-02-04T17:35:01.571077264Z [inf]  request completed
2026-02-04T17:35:01.571081134Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-04T17:35:01.571084824Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-04T17:35:01.571088104Z [inf]  Fetching premium trending tokens
2026-02-04T17:35:01.571091254Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-04T17:35:01.571094304Z [inf]  Timer finished: recalc_heat_scores
2026-02-04T17:35:01.571097474Z [inf]  incoming request
2026-02-04T17:35:01.571103254Z [inf]  WS addresses discovered
2026-02-04T17:35:01.591392900Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:35:01.886347152Z [inf]  Processed DexScreener trending candidates
2026-02-04T17:35:02.054480815Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:35:02.105684070Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:35:02.105686540Z [inf]  request completed
2026-02-04T17:35:02.348135116Z [inf]  incoming request
2026-02-04T17:35:02.348138446Z [inf]  request completed
2026-02-04T17:35:02.591345847Z [inf]  incoming request
2026-02-04T17:35:02.754734270Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:35:02.755368736Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:35:02.755373466Z [inf]  request completed
2026-02-04T17:35:08.384739965Z [inf]  Trending tokens fetch complete
2026-02-04T17:35:08.384744035Z [inf]  Premium trending tokens fetch complete
2026-02-04T17:35:08.384747195Z [inf]  [TokenJob] Got 100 trending tokens for Ethereum
2026-02-04T17:35:08.419634549Z [inf]  Saved 100 trending tokens for eth to database and memory cache
2026-02-04T17:35:08.434880596Z [inf]  [TokenJob] Saved 100 tokens for Ethereum to DB + cache
2026-02-04T17:35:09.060921978Z [inf]  incoming request
2026-02-04T17:35:09.060926668Z [inf]  request completed
2026-02-04T17:35:09.060930558Z [inf]  incoming request
2026-02-04T17:35:09.060934758Z [inf]  request completed
2026-02-04T17:35:09.060939228Z [inf]  incoming request
2026-02-04T17:35:09.060943258Z [inf]  request completed
2026-02-04T17:35:09.350412764Z [inf]  incoming request
2026-02-04T17:35:09.351487918Z [inf]  incoming request
2026-02-04T17:35:09.351491428Z [inf]  incoming request
2026-02-04T17:35:09.351494188Z [inf]  [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmk74yj4r03jcl70b8hwyuh2c, content=Copy Trade 0xffed8b8...
2026-02-04T17:35:09.364141690Z [inf]  request completed
2026-02-04T17:35:09.369572757Z [inf]  request completed
2026-02-04T17:35:09.622314069Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:35:09.623047214Z [inf]  incoming request
2026-02-04T17:35:09.623981709Z [inf]  request completed
2026-02-04T17:35:09.808858729Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:35:09.808861579Z [inf]  request completed
2026-02-04T17:35:09.877238268Z [inf]  incoming request
2026-02-04T17:35:09.882832974Z [inf]  request completed
2026-02-04T17:35:10.176079357Z [inf]  incoming request
2026-02-04T17:35:10.176082967Z [inf]  request completed
2026-02-04T17:35:10.430817987Z [inf]  incoming request
2026-02-04T17:35:10.845533432Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:35:10.845536762Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:35:10.887995211Z [inf]  request completed
2026-02-04T17:35:11.171897851Z [inf]  incoming request
2026-02-04T17:35:11.176288504Z [inf]  request completed
2026-02-04T17:35:11.176292274Z [inf]  incoming request
2026-02-04T17:35:11.428361751Z [inf]  incoming request
2026-02-04T17:35:11.458987262Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:35:11.458991672Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:35:11.458994192Z [inf]  request completed
2026-02-04T17:35:11.459535029Z [inf]  request completed
2026-02-04T17:35:11.620717665Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:35:12.100302700Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:35:12.764825646Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:35:12.764833976Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:35:12.764839566Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:35:12.891330877Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:35:13.067997458Z [inf]  [ChatWorker] DeepSeek iteration 1/10 for task cml8b5pmj00fv8poe4qnmnadn
2026-02-04T17:35:13.068002278Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:35:13.068006078Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:35:13.068163617Z [inf]  Moderation Input check result
2026-02-04T17:35:13.068167457Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_start
2026-02-04T17:35:13.068171277Z [inf]  [ChatWorker] Sent message_start for cml8b5phj00ft8poevl6o6087
2026-02-04T17:35:13.068174437Z [inf]  ChatWorker: seeded get_wallet_info from client context
2026-02-04T17:35:13.068177667Z [inf]  ToolPreRouter: Category matched
2026-02-04T17:35:13.068180967Z [inf]  [ChatWorker] Base filtered to 5 tools for message: "Copy Trade 0xffed8b8c0dc8d2b378a75542b0a077263990f..."
2026-02-04T17:35:13.068184397Z [inf]  [ChatWorker] 🔍 RAG check for: "Copy Trade 0xffed8b8c0dc8d2b378a75542b0a077263990f..."
2026-02-04T17:35:13.068188217Z [inf]  [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
2026-02-04T17:35:17.914481220Z [inf]  Timer finished: intent_parsing_2d48976f
2026-02-04T17:35:17.925446532Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:35:17.925451902Z [inf]  DeepSeek: routed to mode
2026-02-04T17:35:17.925458082Z [inf]  [ChatWorker] User Settings: {
2026-02-04T17:35:17.925461612Z [inf]    fastSwapMode: true,
2026-02-04T17:35:17.925464142Z [inf]    swapMethod: 'allowance_trade',
2026-02-04T17:35:17.925468222Z [inf]    toolConfig: [
2026-02-04T17:35:17.925470872Z [inf]      'userRole',
2026-02-04T17:35:17.925473582Z [inf]      'defaultSwapAmount',
2026-02-04T17:35:17.925476122Z [inf]      'defaultSwapUnit',
2026-02-04T17:35:17.925479092Z [inf]      'checkTokenBeforeSwap',
2026-02-04T17:35:17.925481642Z [inf]      'showQuoteBeforeSwap',
2026-02-04T17:35:17.925484492Z [inf]      'swapMethod',
2026-02-04T17:35:17.925487072Z [inf]      'slippageMode',
2026-02-04T17:35:17.925489422Z [inf]      'customSlippage',
2026-02-04T17:35:17.925492052Z [inf]      'mevProtection',
2026-02-04T17:35:17.925494862Z [inf]      'priceDeviationCheck',
2026-02-04T17:35:17.925497382Z [inf]      'fastSwapMode',
2026-02-04T17:35:17.925500122Z [inf]      'copyTradeTokenCooldownMinutes',
2026-02-04T17:35:17.925502612Z [inf]      'minMarketCapUsd',
2026-02-04T17:35:17.925505332Z [inf]      'minLiquidityUsd',
2026-02-04T17:35:17.926762224Z [inf]      'minTargetValueUsd',
2026-02-04T17:35:17.926769364Z [inf]      'id',
2026-02-04T17:35:17.926774374Z [inf]      'userId',
2026-02-04T17:35:17.926779273Z [inf]      'quickSwapMode',
2026-02-04T17:35:17.926784033Z [inf]      'copyTradeAIMode',
2026-02-04T17:35:17.926788543Z [inf]      'updatedAt',
2026-02-04T17:35:17.926792473Z [inf]      'createdAt',
2026-02-04T17:35:17.926796123Z [inf]      'zoraNotificationThreshold'
2026-02-04T17:35:17.926799893Z [inf]    ],
2026-02-04T17:35:17.926803933Z [inf]    walletConnected: true,
2026-02-04T17:35:17.926807973Z [inf]    chainId: 8453
2026-02-04T17:35:17.926811313Z [inf]  }
2026-02-04T17:35:17.926815163Z [inf]  [ChatWorker] Waiting for early pre-fetch to complete
2026-02-04T17:35:17.926818673Z [inf]  [ChatWorker] Detected contract address: 0xffed8b8c0dc8d2b378a75542b0a077263990f8ca
2026-02-04T17:35:17.926822703Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:35:18.144060545Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T17:35:19.117057452Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T17:35:21.141096122Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T17:35:22.888153341Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:35:25.187067751Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T17:35:25.187071881Z [err]  GeckoTerminal API error after retries
2026-02-04T17:35:25.261317543Z [inf]  Timer finished: get_token_info_0xffed8b8c0dc8d2b378a75542b0a077263990f8ca_8453
2026-02-04T17:35:25.261320443Z [inf]  Timer finished: prompt_gen_COPY_TRADING_deepseek
2026-02-04T17:35:25.261323053Z [inf]  [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (7 tokens cached)
2026-02-04T17:35:25.261325423Z [inf]  [ChatWorker] No tokenInfo available
2026-02-04T17:35:25.261327833Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:35:25.261330943Z [inf]  [ChatWorker] Enriched user prompt with context for 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T17:35:25.261333733Z [inf]  ChatWorker: client context injected
2026-02-04T17:35:25.261336283Z [inf]  ChatWorker: client balance snapshot summary
2026-02-04T17:35:25.264471064Z [inf]  [ChatWorker] Added client context to system prompt
2026-02-04T17:35:25.264482864Z [inf]  [ChatWorker] Broadcasting Thinking status for cml8b5phj00ft8poevl6o6087. Message order: message_start → launchpad_card → Thinking → content_chunks
2026-02-04T17:35:25.264486894Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:35:32.378490529Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_usage
2026-02-04T17:35:32.612336519Z [inf]  Moderation Output check result
2026-02-04T17:35:32.637821593Z [inf]  [ChatWorker] Broadcasting message_complete for cml8b5phj00ft8poevl6o6087
2026-02-04T17:35:32.637825783Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
2026-02-04T17:35:32.648258748Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:35:32.648263378Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
2026-02-04T17:35:32.914659007Z [inf]  incoming request
2026-02-04T17:35:32.914668767Z [inf]  request completed
2026-02-04T17:35:32.914674717Z [inf]  incoming request
2026-02-04T17:35:32.914678217Z [inf]  request completed
2026-02-04T17:35:32.927724917Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:35:33.203512408Z [inf]  incoming request
2026-02-04T17:35:33.203514558Z [inf]  incoming request
2026-02-04T17:35:33.203516758Z [inf]  request completed
2026-02-04T17:35:33.203519398Z [inf]  request completed
2026-02-04T17:35:38.477475443Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-04T17:35:38.477479253Z [inf]  Fetching premium trending tokens
2026-02-04T17:35:38.714998460Z [inf]  WS addresses discovered
2026-02-04T17:35:40.043478760Z [inf]  Processed DexScreener trending candidates
2026-02-04T17:35:40.043482720Z [inf]  Premium trending tokens fetch complete
2026-02-04T17:35:40.043493040Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-04T17:35:40.081524685Z [inf]  Saved 100 trending tokens for solana to database and memory cache
2026-02-04T17:35:40.262595670Z [inf]  [TokenJob] Saved 100 tokens for Solana to DB + cache
2026-02-04T17:35:42.953630441Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:35:43.331469825Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:35:44.052340097Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:36:04.042529134Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:36:04.146081386Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:36:10.384049952Z [inf]  [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
2026-02-04T17:36:10.384053722Z [inf]  Fetching premium trending tokens
2026-02-04T17:36:10.510192095Z [inf]  WS addresses discovered
2026-02-04T17:36:11.416359520Z [inf]  Processed DexScreener trending candidates
2026-02-04T17:36:11.416362500Z [err]  Error fetching trending tokens
2026-02-04T17:36:11.416364960Z [inf]  Premium trending tokens fetch complete
2026-02-04T17:36:11.416367680Z [inf]  [TokenJob] Got 73 trending tokens for Base
2026-02-04T17:36:11.416370000Z [inf]  Saved 73 trending tokens for base to database and memory cache
2026-02-04T17:36:11.423568316Z [inf]  [TokenJob] Saved 73 tokens for Base to DB + cache
2026-02-04T17:36:14.210335000Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:36:14.645617572Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:36:14.686073294Z [inf]  ⚡ Uniswap V4 price fetched
2026-02-04T17:36:15.999617042Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:36:18.636216742Z [inf]  incoming request
2026-02-04T17:36:18.636220582Z [inf]  request completed
2026-02-04T17:36:18.636223422Z [inf]  incoming request
2026-02-04T17:36:18.636227202Z [inf]  request completed
2026-02-04T17:36:18.637184606Z [inf]  incoming request
2026-02-04T17:36:18.637187676Z [inf]  request completed
2026-02-04T17:36:18.900793814Z [inf]  incoming request
2026-02-04T17:36:18.904931999Z [inf]  incoming request
2026-02-04T17:36:18.904935379Z [inf]  incoming request
2026-02-04T17:36:19.061060448Z [inf]  [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmk74yj4r03jcl70b8hwyuh2c, content=I want per $20...
2026-02-04T17:36:19.061064138Z [inf]  [verifyAccess] Checking access: {
2026-02-04T17:36:19.061067298Z [inf]    userId: 'did:privy:cmk74yj4r03jcl70b8hwyuh2c',
2026-02-04T17:36:19.061075028Z [inf]    userIdLength: 35,
2026-02-04T17:36:19.061078438Z [inf]    userIdPrefix: 'did:privy:cmk74yj4r0',
2026-02-04T17:36:19.061082168Z [inf]    requestedAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B'
2026-02-04T17:36:19.061085018Z [inf]  }
2026-02-04T17:36:19.061088828Z [inf]  [verifyAccess] ✅ Access granted
2026-02-04T17:36:19.061091958Z [inf]  request completed
2026-02-04T17:36:19.873721958Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:36:19.953000931Z [inf]  request completed
2026-02-04T17:36:19.953024561Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:36:20.218638527Z [inf]  incoming request
2026-02-04T17:36:20.218641927Z [inf]  request completed
2026-02-04T17:36:20.518337003Z [inf]  incoming request
2026-02-04T17:36:20.519101449Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:36:20.519105189Z [inf]  request completed
2026-02-04T17:36:20.519109139Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:36:20.672589175Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:36:20.672593445Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:36:20.672598524Z [inf]  request completed
2026-02-04T17:36:20.744626271Z [inf]  incoming request
2026-02-04T17:36:20.745185168Z [inf]  request completed
2026-02-04T17:36:20.778596413Z [inf]  incoming request
2026-02-04T17:36:20.933031163Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:36:20.933034233Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:36:20.933037343Z [inf]  request completed
2026-02-04T17:36:20.986224805Z [inf]  incoming request
2026-02-04T17:36:21.012590184Z [inf]  request completed
2026-02-04T17:36:21.463415180Z [inf]  incoming request
2026-02-04T17:36:21.467855303Z [inf]  ChatWS Client connected
2026-02-04T17:36:21.467858793Z [inf]  ChatWS: User connected
2026-02-04T17:36:21.707864156Z [inf]  Sync request
2026-02-04T17:36:21.707869386Z [inf]  Sync request
2026-02-04T17:36:21.707872416Z [inf]  Sync request
2026-02-04T17:36:21.987973693Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:21.987976113Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:21.987979603Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:22.733685875Z [inf]  Moderation Input check result
2026-02-04T17:36:22.733689695Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_start
2026-02-04T17:36:22.733693865Z [inf]  [ChatWorker] Sent message_start for cml8b76jv00kz8poeqrnuymn0
2026-02-04T17:36:22.733697195Z [inf]  ChatWorker: seeded get_wallet_info from client context
2026-02-04T17:36:22.733700735Z [inf]  [ChatWorker] Base filtered to 44 tools for message: "I want per $20..."
2026-02-04T17:36:22.733705595Z [inf]  [ChatWorker] 🔍 RAG check for: "I want per $20..."
2026-02-04T17:36:22.733710705Z [inf]  [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
2026-02-04T17:36:22.733714995Z [inf]  [ChatWorker] DeepSeek iteration 1/10 for task cml8b77cc00l18poe785cyod8
2026-02-04T17:36:22.733718115Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:22.733721485Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:26.024081587Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:36:26.746014086Z [inf]  Timer finished: intent_parsing_064c28b6
2026-02-04T17:36:26.764075336Z [inf]  Intent follow-up recorded
2026-02-04T17:36:26.764080346Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:26.764083776Z [inf]  DeepSeek: routed to mode
2026-02-04T17:36:26.764086446Z [inf]  [ChatWorker] Free intent mode: using 26 thinking tools
2026-02-04T17:36:26.764123295Z [inf]  DeepSeek: thinking mode without skills injection
2026-02-04T17:36:26.765386607Z [inf]      'quickSwapMode',
2026-02-04T17:36:26.765391187Z [inf]      'copyTradeAIMode',
2026-02-04T17:36:26.765395097Z [inf]      'updatedAt',
2026-02-04T17:36:26.765399977Z [inf]      'createdAt',
2026-02-04T17:36:26.765406957Z [inf]  [ChatWorker] User Settings: {
2026-02-04T17:36:26.765409977Z [inf]    chainId: 8453
2026-02-04T17:36:26.765415407Z [inf]      'zoraNotificationThreshold'
2026-02-04T17:36:26.765417427Z [inf]    fastSwapMode: true,
2026-02-04T17:36:26.765419087Z [inf]  }
2026-02-04T17:36:26.765425377Z [inf]    ],
2026-02-04T17:36:26.765426517Z [inf]    swapMethod: 'allowance_trade',
2026-02-04T17:36:26.765429467Z [inf]  [ChatWorker] Waiting for early pre-fetch to complete
2026-02-04T17:36:26.765433537Z [inf]    toolConfig: [
2026-02-04T17:36:26.765436577Z [inf]    walletConnected: true,
2026-02-04T17:36:26.765439597Z [inf]      'userRole',
2026-02-04T17:36:26.765444697Z [inf]      'defaultSwapAmount',
2026-02-04T17:36:26.765448727Z [inf]      'defaultSwapUnit',
2026-02-04T17:36:26.765453297Z [inf]      'checkTokenBeforeSwap',
2026-02-04T17:36:26.765456607Z [inf]      'showQuoteBeforeSwap',
2026-02-04T17:36:26.765462197Z [inf]      'swapMethod',
2026-02-04T17:36:26.765465857Z [inf]      'slippageMode',
2026-02-04T17:36:26.765469108Z [inf]      'customSlippage',
2026-02-04T17:36:26.765472287Z [inf]      'mevProtection',
2026-02-04T17:36:26.765475817Z [inf]      'priceDeviationCheck',
2026-02-04T17:36:26.765479267Z [inf]      'fastSwapMode',
2026-02-04T17:36:26.765482657Z [inf]      'copyTradeTokenCooldownMinutes',
2026-02-04T17:36:26.765485677Z [inf]      'minMarketCapUsd',
2026-02-04T17:36:26.765488607Z [inf]      'minLiquidityUsd',
2026-02-04T17:36:26.765491997Z [inf]      'minTargetValueUsd',
2026-02-04T17:36:26.765495017Z [inf]      'id',
2026-02-04T17:36:26.765497997Z [inf]      'userId',
2026-02-04T17:36:26.766400842Z [inf]  Timer finished: prompt_gen_GENERAL_CHAT_deepseek
2026-02-04T17:36:26.766404122Z [inf]  [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (8 tokens cached)
2026-02-04T17:36:26.766407052Z [inf]  [ChatWorker] No tokenInfo available
2026-02-04T17:36:26.766409542Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:26.766412132Z [inf]  [ChatWorker] Enriched user prompt with context for 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T17:36:26.766415032Z [inf]  ChatWorker: client context injected
2026-02-04T17:36:26.766418492Z [inf]  ChatWorker: client balance snapshot summary
2026-02-04T17:36:26.767561104Z [inf]  [ChatWorker] Added client context to system prompt
2026-02-04T17:36:26.767565734Z [inf]  ChatWorker: removed get_wallet_info tool (balance context present)
2026-02-04T17:36:26.767568374Z [inf]  [ChatWorker] Broadcasting Thinking status for cml8b76jv00kz8poeqrnuymn0. Message order: message_start → launchpad_card → Thinking → content_chunks
2026-02-04T17:36:26.767571094Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:30.183171616Z [inf]  [ChatWorker] Detected tool calls in stream, starting pre-fetch...
2026-02-04T17:36:30.918150996Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_usage
2026-02-04T17:36:30.932904735Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:30.932907135Z [inf]  [GetTokenPrice] Fetching price for ETH (isAddress: false)...
2026-02-04T17:36:30.967454463Z [inf]  [ChatWorker] DeepSeek iteration 2/10 for task cml8b77cc00l18poe785cyod8
2026-02-04T17:36:30.967457903Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:30.967461613Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:36.086737560Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:36:37.268970350Z [inf]  Timer finished: intent_parsing_72e66433
2026-02-04T17:36:37.268975060Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:37.268979080Z [inf]  [ChatWorker] User Settings: {
2026-02-04T17:36:37.268982880Z [inf]    fastSwapMode: true,
2026-02-04T17:36:37.268986410Z [inf]    swapMethod: 'allowance_trade',
2026-02-04T17:36:37.268989660Z [inf]    toolConfig: [
2026-02-04T17:36:37.268993560Z [inf]      'userRole',
2026-02-04T17:36:37.268997600Z [inf]      'defaultSwapAmount',
2026-02-04T17:36:37.269000970Z [inf]      'defaultSwapUnit',
2026-02-04T17:36:37.269004580Z [inf]      'checkTokenBeforeSwap',
2026-02-04T17:36:37.269008150Z [inf]      'showQuoteBeforeSwap',
2026-02-04T17:36:37.269011910Z [inf]      'swapMethod',
2026-02-04T17:36:37.269015950Z [inf]      'slippageMode',
2026-02-04T17:36:37.269020150Z [inf]      'customSlippage',
2026-02-04T17:36:37.269024760Z [inf]      'mevProtection',
2026-02-04T17:36:37.269028060Z [inf]      'priceDeviationCheck',
2026-02-04T17:36:37.269031770Z [inf]      'fastSwapMode',
2026-02-04T17:36:37.269282108Z [inf]      'copyTradeTokenCooldownMinutes',
2026-02-04T17:36:37.269286868Z [inf]      'minMarketCapUsd',
2026-02-04T17:36:37.269289588Z [inf]      'minLiquidityUsd',
2026-02-04T17:36:37.269295838Z [inf]      'minTargetValueUsd',
2026-02-04T17:36:37.269298408Z [inf]      'id',
2026-02-04T17:36:37.269301408Z [inf]      'userId',
2026-02-04T17:36:37.269303738Z [inf]      'quickSwapMode',
2026-02-04T17:36:37.269306008Z [inf]      'copyTradeAIMode',
2026-02-04T17:36:37.269308308Z [inf]      'updatedAt',
2026-02-04T17:36:37.269311718Z [inf]      'createdAt',
2026-02-04T17:36:37.269314228Z [inf]      'zoraNotificationThreshold'
2026-02-04T17:36:37.269317578Z [inf]    ],
2026-02-04T17:36:37.269320088Z [inf]    walletConnected: true,
2026-02-04T17:36:37.269322998Z [inf]    chainId: 8453
2026-02-04T17:36:37.269325578Z [inf]  }
2026-02-04T17:36:37.269328018Z [inf]  Timer finished: prompt_gen_GENERAL_CHAT_deepseek
2026-02-04T17:36:37.269330558Z [inf]  [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (8 tokens cached)
2026-02-04T17:36:37.269334728Z [inf]  [ChatWorker] No tokenInfo available
2026-02-04T17:36:37.269338308Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:37.269340998Z [inf]  [ChatWorker] Enriched user prompt with context for 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T17:36:37.269847635Z [inf]  ChatWorker: client context injected
2026-02-04T17:36:37.269853625Z [inf]  ChatWorker: client balance snapshot summary
2026-02-04T17:36:37.269856575Z [inf]  [ChatWorker] Added client context to system prompt
2026-02-04T17:36:37.269860675Z [inf]  [ChatWorker] Broadcasting Thinking status for cml8b76jv00kz8poeqrnuymn0. Message order: message_start → launchpad_card → Thinking → content_chunks
2026-02-04T17:36:37.269863735Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:40.582995492Z [inf]  [ChatWorker] Detected tool calls in stream, starting pre-fetch...
2026-02-04T17:36:41.490129264Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-04T17:36:41.490133004Z [inf]  Fetching premium trending tokens
2026-02-04T17:36:41.696521456Z [inf]  WS addresses discovered
2026-02-04T17:36:42.491516487Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_usage
2026-02-04T17:36:42.491519927Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:42.491535717Z [inf]  [CheckTokenRisk] Scanning 0xffed8b8c0dc8d2b378a75542b0a077263990f8ca on base (chainId: 8453)
2026-02-04T17:36:42.491539127Z [inf]  [CheckTokenRisk] Fetching from GoPlus: https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=0xffed8b8c0dc8d2b378a75542b0a077263990f8ca
2026-02-04T17:36:42.491542267Z [inf]  [CheckTokenRisk] Attempting local scan/verification for 0xffed8b8c0dc8d2b378a75542b0a077263990f8ca on base
2026-02-04T17:36:42.491545977Z [inf]  [HolderAnalysis] Fetching from GeckoTerminal: https://api.geckoterminal.com/api/v2/networks/base/tokens/0xffed8b8c0dc8d2b378a75542b0a077263990f8ca/info
2026-02-04T17:36:42.692247633Z [err]  sourcify.dev failed after 1 attempts
2026-02-04T17:36:42.692252553Z [err]  [CheckTokenRisk] Token 0xffed8b8c0dc8d2b378a75542b0a077263990f8ca not found in GoPlus result for chain 8453
2026-02-04T17:36:42.766502886Z [inf]  [SniperAnalysis] API response status: 0, result type: string, is array: false
2026-02-04T17:36:42.766506206Z [inf]  [SniperAnalysis] No transfer data available { status: '0', hasResult: true, message: 'NOTOK' }
2026-02-04T17:36:42.766509036Z [err]  geckoterminal_holders failed after 1 attempts
2026-02-04T17:36:42.766513466Z [err]  [HolderAnalysis] Error: Error: HTTP 404: {"errors":[{"status":"404","title":"Not Found"}],"meta":{"ref_id":"4191f217-2b1b-4ce9-97b3-db531736c2bb"}}
2026-02-04T17:36:42.766516166Z [err]      at fetchJson (file:///app/dist/config/unifiedApiService.js:97:23)
2026-02-04T17:36:42.766519326Z [err]      at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
2026-02-04T17:36:42.766523596Z [err]      at async analyzeHolderDistribution (file:///app/dist/services/sniperAnalysis.js:231:26)
2026-02-04T17:36:42.766526556Z [err]      at async Promise.all (index 4)
2026-02-04T17:36:42.766529516Z [err]      at async Object.handler (file:///app/dist/skills/RiskSkill/tools/tokenRisk.js:640:94)
2026-02-04T17:36:42.766532556Z [err]      at async ChatWorker.executeTools (file:///app/dist/jobs/chatWorker.js:2814:32)
2026-02-04T17:36:42.766535686Z [err]      at async ChatWorker.processDeepSeekTask (file:///app/dist/jobs/chatWorker.js:2248:76)
2026-02-04T17:36:42.766539076Z [err]      at async ChatWorker.runTask (file:///app/dist/jobs/chatWorker.js:719:17)
2026-02-04T17:36:42.766541736Z [inf]  [TransferNetwork] API response status: 0
2026-02-04T17:36:42.766562546Z [inf]  [TransferNetwork] No transfer data { status: '0', message: 'No transactions found' }
2026-02-04T17:36:42.928565300Z [err]      at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
2026-02-04T17:36:42.928570490Z [err]      at async ChatWorker.executeTools (file:///app/dist/jobs/chatWorker.js:2814:32)
2026-02-04T17:36:42.928574080Z [err]      at async ChatWorker.processDeepSeekTask (file:///app/dist/jobs/chatWorker.js:2248:76)
2026-02-04T17:36:42.928577340Z [err]      at async ChatWorker.runTask (file:///app/dist/jobs/chatWorker.js:719:17)
2026-02-04T17:36:42.928623699Z [err]  sourcify.dev failed after 1 attempts
2026-02-04T17:36:42.928627579Z [err]  [CheckTokenRisk] Error: Error: Failed to fetch security data from GoPlus
2026-02-04T17:36:42.928630929Z [err]      at Object.handler (file:///app/dist/skills/RiskSkill/tools/tokenRisk.js:660:23)
2026-02-04T17:36:42.939294825Z [inf]  [ChatWorker] DeepSeek iteration 3/10 for task cml8b77cc00l18poe785cyod8
2026-02-04T17:36:42.939304934Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:42.939308924Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:42.971857953Z [inf]  Processed DexScreener trending candidates
2026-02-04T17:36:46.157600847Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:36:46.556427814Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:36:46.693610202Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T17:36:47.793297310Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T17:36:47.873121169Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:36:48.023909582Z [inf]      'fastSwapMode',
2026-02-04T17:36:48.023936862Z [inf]  Timer finished: intent_parsing_07ed1903
2026-02-04T17:36:48.023943343Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:48.023946893Z [inf]  [ChatWorker] User Settings: {
2026-02-04T17:36:48.023949883Z [inf]    fastSwapMode: true,
2026-02-04T17:36:48.023952473Z [inf]    swapMethod: 'allowance_trade',
2026-02-04T17:36:48.023955353Z [inf]    toolConfig: [
2026-02-04T17:36:48.023959243Z [inf]      'userRole',
2026-02-04T17:36:48.023962413Z [inf]      'defaultSwapAmount',
2026-02-04T17:36:48.023964963Z [inf]      'defaultSwapUnit',
2026-02-04T17:36:48.023967673Z [inf]      'checkTokenBeforeSwap',
2026-02-04T17:36:48.023970373Z [inf]      'showQuoteBeforeSwap',
2026-02-04T17:36:48.023972743Z [inf]      'swapMethod',
2026-02-04T17:36:48.023975693Z [inf]      'slippageMode',
2026-02-04T17:36:48.023978303Z [inf]      'customSlippage',
2026-02-04T17:36:48.023992103Z [inf]      'mevProtection',
2026-02-04T17:36:48.023994793Z [inf]      'priceDeviationCheck',
2026-02-04T17:36:48.024718927Z [inf]    ],
2026-02-04T17:36:48.024723417Z [inf]    walletConnected: true,
2026-02-04T17:36:48.024727527Z [inf]    chainId: 8453
2026-02-04T17:36:48.024732257Z [inf]  }
2026-02-04T17:36:48.024737217Z [inf]  Timer finished: prompt_gen_GENERAL_CHAT_deepseek
2026-02-04T17:36:48.024742647Z [inf]  [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (8 tokens cached)
2026-02-04T17:36:48.024743027Z [inf]      'copyTradeTokenCooldownMinutes',
2026-02-04T17:36:48.024748407Z [inf]  [ChatWorker] No tokenInfo available
2026-02-04T17:36:48.024756707Z [inf]      'minMarketCapUsd',
2026-02-04T17:36:48.024756827Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:48.024765487Z [inf]  [ChatWorker] Enriched user prompt with context for 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T17:36:48.024765757Z [inf]      'minLiquidityUsd',
2026-02-04T17:36:48.024771377Z [inf]      'minTargetValueUsd',
2026-02-04T17:36:48.024774677Z [inf]      'id',
2026-02-04T17:36:48.024779727Z [inf]      'userId',
2026-02-04T17:36:48.024782697Z [inf]      'quickSwapMode',
2026-02-04T17:36:48.024786057Z [inf]      'copyTradeAIMode',
2026-02-04T17:36:48.024788747Z [inf]      'updatedAt',
2026-02-04T17:36:48.024792687Z [inf]      'createdAt',
2026-02-04T17:36:48.024795767Z [inf]      'zoraNotificationThreshold'
2026-02-04T17:36:48.025248175Z [inf]  ChatWorker: client context injected
2026-02-04T17:36:48.025251525Z [inf]  ChatWorker: client balance snapshot summary
2026-02-04T17:36:48.025253935Z [inf]  [ChatWorker] Added client context to system prompt
2026-02-04T17:36:48.025256824Z [inf]  [ChatWorker] Broadcasting Thinking status for cml8b76jv00kz8poeqrnuymn0. Message order: message_start → launchpad_card → Thinking → content_chunks
2026-02-04T17:36:48.025259174Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:49.917979478Z [inf]  [ChatWorker] Detected tool calls in stream, starting pre-fetch...
2026-02-04T17:36:50.543687092Z [err]  Error fetching trending tokens
2026-02-04T17:36:50.543689942Z [inf]  Premium trending tokens fetch complete
2026-02-04T17:36:50.543693042Z [inf]  [TokenJob] Got 79 trending tokens for BSC
2026-02-04T17:36:50.543695972Z [inf]  Saved 79 trending tokens for bsc to database and memory cache
2026-02-04T17:36:50.543698861Z [inf]  [TokenJob] Saved 79 tokens for BSC to DB + cache
2026-02-04T17:36:50.543701581Z [inf]  [TokenJob] Refreshed 4 primary chains in 110.0s
2026-02-04T17:36:51.735912233Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_usage
2026-02-04T17:36:51.741572247Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:51.741577457Z [inf]  [GetTokenInfo] Attempting DexScreener fallback...
2026-02-04T17:36:51.876127010Z [inf]  [ChatWorker] DeepSeek iteration 4/10 for task cml8b77cc00l18poe785cyod8
2026-02-04T17:36:51.876135950Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:51.877064424Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:57.359890322Z [inf]  Timer finished: intent_parsing_5f756fba
2026-02-04T17:36:57.361145053Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:57.361153273Z [inf]  [ChatWorker] User Settings: {
2026-02-04T17:36:57.361157833Z [inf]    fastSwapMode: true,
2026-02-04T17:36:57.361162633Z [inf]    swapMethod: 'allowance_trade',
2026-02-04T17:36:57.361167783Z [inf]    toolConfig: [
2026-02-04T17:36:57.361172713Z [inf]      'userRole',
2026-02-04T17:36:57.361178083Z [inf]      'defaultSwapAmount',
2026-02-04T17:36:57.361183733Z [inf]      'defaultSwapUnit',
2026-02-04T17:36:57.361188353Z [inf]      'checkTokenBeforeSwap',
2026-02-04T17:36:57.361195853Z [inf]      'minTargetValueUsd',
2026-02-04T17:36:57.361196433Z [inf]      'showQuoteBeforeSwap',
2026-02-04T17:36:57.361211483Z [inf]      'id',
2026-02-04T17:36:57.361215463Z [inf]      'userId',
2026-02-04T17:36:57.361221123Z [inf]      'quickSwapMode',
2026-02-04T17:36:57.361227203Z [inf]      'copyTradeAIMode',
2026-02-04T17:36:57.361234373Z [inf]      'updatedAt',
2026-02-04T17:36:57.361239263Z [inf]      'swapMethod',
2026-02-04T17:36:57.361240963Z [inf]      'createdAt',
2026-02-04T17:36:57.361272833Z [inf]      'slippageMode',
2026-02-04T17:36:57.361300792Z [inf]      'customSlippage',
2026-02-04T17:36:57.361306572Z [inf]      'mevProtection',
2026-02-04T17:36:57.361310792Z [inf]      'priceDeviationCheck',
2026-02-04T17:36:57.361321572Z [inf]      'fastSwapMode',
2026-02-04T17:36:57.361342832Z [inf]      'copyTradeTokenCooldownMinutes',
2026-02-04T17:36:57.361346602Z [inf]      'minMarketCapUsd',
2026-02-04T17:36:57.361350382Z [inf]      'minLiquidityUsd',
2026-02-04T17:36:57.361850219Z [inf]      'zoraNotificationThreshold'
2026-02-04T17:36:57.361853759Z [inf]    ],
2026-02-04T17:36:57.361856189Z [inf]    walletConnected: true,
2026-02-04T17:36:57.361861799Z [inf]    chainId: 8453
2026-02-04T17:36:57.361864869Z [inf]  }
2026-02-04T17:36:57.361867529Z [inf]  Timer finished: prompt_gen_GENERAL_CHAT_deepseek
2026-02-04T17:36:57.361870639Z [inf]  [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (8 tokens cached)
2026-02-04T17:36:57.361874089Z [inf]  [ChatWorker] No tokenInfo available
2026-02-04T17:36:57.361877239Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:57.361879779Z [inf]  [ChatWorker] Enriched user prompt with context for 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T17:36:57.361883119Z [inf]  ChatWorker: client context injected
2026-02-04T17:36:57.361885989Z [inf]  ChatWorker: client balance snapshot summary
2026-02-04T17:36:57.362182177Z [inf]  [ChatWorker] Added client context to system prompt
2026-02-04T17:36:57.362185017Z [inf]  [ChatWorker] Broadcasting Thinking status for cml8b76jv00kz8poeqrnuymn0. Message order: message_start → launchpad_card → Thinking → content_chunks
2026-02-04T17:36:57.362187427Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:36:57.907422567Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:36:59.432909510Z [inf]  [ChatWorker] Detected tool calls in stream, starting pre-fetch...
2026-02-04T17:37:01.207202364Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_usage
2026-02-04T17:37:01.217689810Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:37:01.237370179Z [inf]  [ChatWorker] DeepSeek iteration 5/10 for task cml8b77cc00l18poe785cyod8
2026-02-04T17:37:01.237373419Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:37:01.237984055Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:37:06.490787301Z [inf]  Timer finished: intent_parsing_51e915e6
2026-02-04T17:37:06.490790861Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:37:06.490795041Z [inf]  [ChatWorker] User Settings: {
2026-02-04T17:37:06.490799481Z [inf]    fastSwapMode: true,
2026-02-04T17:37:06.490802941Z [inf]    swapMethod: 'allowance_trade',
2026-02-04T17:37:06.490806771Z [inf]    toolConfig: [
2026-02-04T17:37:06.490811611Z [inf]      'userRole',
2026-02-04T17:37:06.490814871Z [inf]      'defaultSwapAmount',
2026-02-04T17:37:06.490818921Z [inf]      'defaultSwapUnit',
2026-02-04T17:37:06.490821651Z [inf]      'checkTokenBeforeSwap',
2026-02-04T17:37:06.490825051Z [inf]      'showQuoteBeforeSwap',
2026-02-04T17:37:06.490828361Z [inf]      'swapMethod',
2026-02-04T17:37:06.490831351Z [inf]      'slippageMode',
2026-02-04T17:37:06.490834921Z [inf]      'customSlippage',
2026-02-04T17:37:06.490839471Z [inf]      'mevProtection',
2026-02-04T17:37:06.490842931Z [inf]      'priceDeviationCheck',
2026-02-04T17:37:06.490846541Z [inf]      'fastSwapMode',
2026-02-04T17:37:06.491343438Z [inf]      'copyTradeTokenCooldownMinutes',
2026-02-04T17:37:06.491360048Z [inf]      'minMarketCapUsd',
2026-02-04T17:37:06.491366178Z [inf]      'minLiquidityUsd',
2026-02-04T17:37:06.491370028Z [inf]      'minTargetValueUsd',
2026-02-04T17:37:06.491373688Z [inf]      'id',
2026-02-04T17:37:06.491377688Z [inf]      'userId',
2026-02-04T17:37:06.491380748Z [inf]      'quickSwapMode',
2026-02-04T17:37:06.491383778Z [inf]      'copyTradeAIMode',
2026-02-04T17:37:06.491389178Z [inf]      'updatedAt',
2026-02-04T17:37:06.491392678Z [inf]      'createdAt',
2026-02-04T17:37:06.491395748Z [inf]      'zoraNotificationThreshold'
2026-02-04T17:37:06.491399518Z [inf]    ],
2026-02-04T17:37:06.491402788Z [inf]    walletConnected: true,
2026-02-04T17:37:06.491406078Z [inf]    chainId: 8453
2026-02-04T17:37:06.491410098Z [inf]  }
2026-02-04T17:37:06.491415788Z [inf]  Timer finished: prompt_gen_GENERAL_CHAT_deepseek
2026-02-04T17:37:06.491420448Z [inf]  [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (8 tokens cached)
2026-02-04T17:37:06.491425648Z [inf]  [ChatWorker] No tokenInfo available
2026-02-04T17:37:06.491430448Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:37:06.491434428Z [inf]  [ChatWorker] Enriched user prompt with context for 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T17:37:06.491650536Z [inf]  ChatWorker: client context injected
2026-02-04T17:37:06.491655876Z [inf]  ChatWorker: client balance snapshot summary
2026-02-04T17:37:06.491659196Z [inf]  [ChatWorker] Added client context to system prompt
2026-02-04T17:37:06.491662406Z [inf]  [ChatWorker] Broadcasting Thinking status for cml8b76jv00kz8poeqrnuymn0. Message order: message_start → launchpad_card → Thinking → content_chunks
2026-02-04T17:37:06.491665486Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:37:07.955433570Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:37:09.098919724Z [inf]  [ChatWorker] Detected tool calls in stream, starting pre-fetch...
2026-02-04T17:37:11.276336373Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_usage
2026-02-04T17:37:11.283502299Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:37:11.283505599Z [inf]  Analyzing PNL via Dune
2026-02-04T17:37:11.283508639Z [inf]  [Dune PNL] Fetching PNL for 0xffed8b8c... on base (30 days)
2026-02-04T17:37:18.004958759Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:37:18.363248237Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:37:19.393512077Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:37:28.367132368Z [inf]  incoming request
2026-02-04T17:37:28.367137698Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_xmdxmfft3oo7db9d","createdAt":"2026-02-04T17:37:28.055Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27c937a","hash":"0x249b1428f82a0841f51b9860741050628c3c87daa2153c2c0ae8af0cce03d546","value":0.5,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x6f05b59d3b20000","decimals":18},"blockTimestamp":"0x698383d7"}],"source":"chainlake-kafka"}}
2026-02-04T17:37:28.367141328Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T17:37:28.367144058Z [inf]  request completed
2026-02-04T17:37:28.367147238Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x249b14
2026-02-04T17:37:28.427559917Z [inf]  [Profile] fetchReceipt
2026-02-04T17:37:28.522999201Z [inf]  incoming request
2026-02-04T17:37:28.523004281Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_12vj96toaajimhli","createdAt":"2026-02-04T17:37:28.133Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","blockNum":"0x27c937a","hash":"0x249b1428f82a0841f51b9860741050628c3c87daa2153c2c0ae8af0cce03d546","value":1297171945.2923784,"asset":"MOLTEN","category":"token","rawContract":{"rawValue":"0x00000000000000000000000000000000000000000430fed80f047cd4ca3919f1","address":"0xeec3eb913a9dd96b34efc4fa43a3836bea402b07","decimals":18},"log":{"address":"0xeec3eb913a9dd96b34efc4fa43a3836bea402b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x000000000000000000000000b4beddf1b828aaed9638601f7145b0f6093f2d3f"],"data":"0x00000000000000000000000000000000000000000430fed80f047cd4ca3919f1","blockHash":"0x748502eade6445013815834605332cd8b0af4c9aaa909433c454a79f8a631cf0","blockNumber":"0x27c937a","blockTimestamp":"0x698383d7","transactionHash":"0x249b1428f82a0841f51b9860741050628c3c87daa2153c2c0ae8af0cce03d546","transactionIndex":"0xa3","logIndex":"0x15b","removed":false},"blockTimestamp":"0x698383d7"}],"source":"chainlake-kafka"}}
2026-02-04T17:37:28.523007761Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T17:37:28.523011341Z [inf]  request completed
2026-02-04T17:37:28.523014620Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x249b14
2026-02-04T17:37:28.554660627Z [inf]  [Profile] fetchTransaction
2026-02-04T17:37:28.588852926Z [inf]  [Profile] fetchTransaction
2026-02-04T17:37:28.588857996Z [inf]  Swap successfully decoded from logs
2026-02-04T17:37:28.588861806Z [inf]  [Profile] parseSwapTransaction
2026-02-04T17:37:28.588865856Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0xb4beddf1: {
2026-02-04T17:37:28.588869896Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-04T17:37:28.588873456Z [inf]    tokenOut: '0xeec3eb913a9dd96b34efc4fa43a3836bea402b07',
2026-02-04T17:37:28.588883176Z [inf]    dex: 'Uniswap v4'
2026-02-04T17:37:28.588888436Z [inf]  }
2026-02-04T17:37:28.588892036Z [inf]  Swap detected on target wallet
2026-02-04T17:37:28.593081301Z [inf]  Target is buying - triggering copy trade
2026-02-04T17:37:28.771608224Z [inf]    tokenOut: '0xeec3eb913a9dd96b34efc4fa43a3836bea402b07',
2026-02-04T17:37:28.771612774Z [inf]    dex: 'Uniswap v4'
2026-02-04T17:37:28.771615814Z [inf]  }
2026-02-04T17:37:28.771656353Z [wrn]  All API liquidity sources failed
2026-02-04T17:37:28.771659473Z [wrn]  All API liquidity sources failed
2026-02-04T17:37:28.771662093Z [inf]  [Profile] fetchReceipt
2026-02-04T17:37:28.771665123Z [inf]  Swap successfully decoded from logs
2026-02-04T17:37:28.771667893Z [inf]  [Profile] parseSwapTransaction
2026-02-04T17:37:28.771670803Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0xb4beddf1: {
2026-02-04T17:37:28.771673953Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-04T17:37:28.773309043Z [inf]  Swap detected on target wallet
2026-02-04T17:37:28.773311453Z [wrn]  All API liquidity sources failed
2026-02-04T17:37:28.773313843Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:37:28.773316283Z [inf]  Timer finished: launchpad_det_0xeec3eb913a9dd96b34efc4fa43a3836bea402b07
2026-02-04T17:37:29.440738083Z [wrn]  RPC endpoint failed
2026-02-04T17:37:29.457261462Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:37:29.500341857Z [inf]  RPC failover success
2026-02-04T17:37:29.535525691Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:37:29.536891753Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:37:29.536895603Z [inf]  🔥 Warming up 1 user settings
2026-02-04T17:37:29.543111474Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-04T17:37:29.543115054Z [inf]  📊 Mass Copy Trade Analysis
2026-02-04T17:37:29.543117654Z [inf]  📦 Processing batch 1/1
2026-02-04T17:37:29.596001489Z [inf]  Created PENDING position lock
2026-02-04T17:37:29.596004889Z [inf]  Buy Step 1: 100% amount, 10% slippage
2026-02-04T17:37:29.596008309Z [inf]  [MainSwapService][1770226649590_j4a32l] Starting unified swap execution
2026-02-04T17:37:29.596011599Z [inf]  Timer finished: launchpad_det_ETH
2026-02-04T17:37:29.596015019Z [inf]  [MainSwapService][1770226649590_j4a32l] Executing EVM swap
2026-02-04T17:37:29.596018629Z [inf]  [MainSwapService][1770226649590_j4a32l] FastSwapMode enabled - attempting direct swap (BUY with native)
2026-02-04T17:37:29.596652655Z [inf]  [DirectSwap] Starting direct swap
2026-02-04T17:37:29.602712088Z [inf]  [PlatformFee] Fees ENABLED: { context: 'copyTrade', bps: 100, evmRecipient: '0xc5377e6329' }
2026-02-04T17:37:29.602714808Z [inf]  [Kyber] GET routes {
2026-02-04T17:37:29.602717378Z [inf]    routesUrl: 'https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&tokenOut=0xeec3eb913a9dd96b34efc4fa43a3836bea402b07&amountIn=4721211227315549&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B&feeReceiver=0xc5377e6329770Be29Ef938d8aCC11f22398D7E54&feeAmount=100&isInBps=true&chargeFeeBy=currency_in'
2026-02-04T17:37:29.602720058Z [inf]  }
2026-02-04T17:37:30.109122217Z [inf]  0x API price received successfully
2026-02-04T17:37:30.439646228Z [inf]  incoming request
2026-02-04T17:37:30.440474723Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_roeghpil2ybxlsfq","createdAt":"2026-02-04T17:37:30.092Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0xeec3eb913a9dd96b34efc4fa43a3836bea402b07","blockNum":"0x27c937b","hash":"0xbee10525c480c062653d2808221284fccff733a07f65a00f8a63998a85e58734","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x698383d9"}],"source":"chainlake-kafka"}}
2026-02-04T17:37:30.440945769Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T17:37:30.441705434Z [inf]  request completed
2026-02-04T17:37:30.442473650Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0xbee105
2026-02-04T17:37:30.452858406Z [inf]  [Profile] fetchTransaction
2026-02-04T17:37:30.462789235Z [inf]  [Profile] fetchReceipt
2026-02-04T17:37:30.462792785Z [inf]  [Profile] parseSwapTransaction
2026-02-04T17:37:30.462796315Z [inf]  [Webhook] Not a swap tx for 0xb4beddf1: 0xbee10525c480c0
2026-02-04T17:37:30.484595392Z [inf]    ],
2026-02-04T17:37:30.484605892Z [inf]    sender: '0xFB64Ce8d',
2026-02-04T17:37:30.484610161Z [inf]    recipient: '0xFB64Ce8d',
2026-02-04T17:37:30.484613401Z [inf]    slippageTolerance: 1500,
2026-02-04T17:37:30.484617111Z [inf]    slippageToleranceType: 'number',
2026-02-04T17:37:30.484621031Z [inf]    deadline: 1770227250,
2026-02-04T17:37:30.484625401Z [inf]    deadlineType: 'number',
2026-02-04T17:37:30.484628561Z [inf]    allBodyKeys: [
2026-02-04T17:37:30.484631471Z [inf]      'routeSummary',
2026-02-04T17:37:30.484635341Z [inf]      'sender',
2026-02-04T17:37:30.484638351Z [inf]      'recipient',
2026-02-04T17:37:30.484641371Z [inf]      'origin',
2026-02-04T17:37:30.484644091Z [inf]      'slippageTolerance',
2026-02-04T17:37:30.484647591Z [inf]      'deadline'
2026-02-04T17:37:30.484650691Z [inf]    ]
2026-02-04T17:37:30.484654621Z [inf]  }
2026-02-04T17:37:30.484689081Z [inf]  [Kyber] routes response {
2026-02-04T17:37:30.484692851Z [inf]    status: 200,
2026-02-04T17:37:30.484696061Z [inf]    hasData: true,
2026-02-04T17:37:30.484699151Z [inf]    keys: [ 'code', 'message', 'data', 'requestId' ]
2026-02-04T17:37:30.484702581Z [inf]  }
2026-02-04T17:37:30.484705591Z [inf]  [Kyber] Building route/build request body: {
2026-02-04T17:37:30.484708991Z [inf]    hasRouteSummary: true,
2026-02-04T17:37:30.484712391Z [inf]    routeSummaryKeys: [
2026-02-04T17:37:30.484715661Z [inf]      'tokenIn',
2026-02-04T17:37:30.484718901Z [inf]      'amountIn',
2026-02-04T17:37:30.484722011Z [inf]      'amountInUsd',
2026-02-04T17:37:30.484725251Z [inf]      'tokenOut',
2026-02-04T17:37:30.484728991Z [inf]      'amountOut',
2026-02-04T17:37:30.484731791Z [inf]      'amountOutUsd',
2026-02-04T17:37:30.484734611Z [inf]      'gas',
2026-02-04T17:37:30.484737651Z [inf]      'gasPrice'
2026-02-04T17:37:31.164188377Z [inf]  [DirectSwap] Reference quote ready
2026-02-04T17:37:31.164192677Z [inf]  [DirectSwap] V4 fast path quote check
2026-02-04T17:37:31.164196057Z [inf]  [DirectSwap] V4 fast path accepted
2026-02-04T17:37:31.968046679Z [inf]  [DirectSwap] V4 minAmountOut calculated
2026-02-04T17:37:31.968048979Z [wrn]  [DirectSwap] V4 pre-simulation failed
2026-02-04T17:37:31.968051289Z [inf]  [DirectSwap] Finished
2026-02-04T17:37:31.968053829Z [wrn]  [MainSwapService][1770226649590_j4a32l] Direct swap failed, falling back to 0x/Kyber: V4 pre-simulation failed
2026-02-04T17:37:31.968057789Z [inf]  Initiating Unified Swap Execution
2026-02-04T17:37:32.940278947Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:37:32.980520870Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:37:32.980525450Z [inf]  [PlatformFee] Fees ENABLED: { context: 'copyTrade', bps: 100, evmRecipient: '0xc5377e6329' }
2026-02-04T17:37:33.095742222Z [inf]  Using 0x API fallback token metadata
2026-02-04T17:37:33.150467567Z [inf]  No token metadata available, trying RPC fallback...
2026-02-04T17:37:33.207488615Z [inf]  Using 0x API fallback token metadata
2026-02-04T17:37:33.212409516Z [inf]  Using 0x API fallback token metadata
2026-02-04T17:37:33.417728594Z [inf]  0x API price received successfully
2026-02-04T17:37:33.445555684Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:37:33.445560184Z [inf]  [PlatformFee] Fees ENABLED: { context: 'copyTrade', bps: 100, evmRecipient: '0xc5377e6329' }
2026-02-04T17:37:33.445563103Z [inf]  [Kyber] GET routes {
2026-02-04T17:37:33.445565613Z [inf]    routesUrl: 'https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&tokenOut=0xeec3eb913a9dd96b34efc4fa43a3836bea402b07&amountIn=4721211227315549&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B&feeReceiver=0xc5377e6329770Be29Ef938d8aCC11f22398D7E54&feeAmount=100&isInBps=true&chargeFeeBy=currency_in'
2026-02-04T17:37:33.445568703Z [inf]  }
2026-02-04T17:37:33.785068249Z [inf]  0x API Quote received successfully
2026-02-04T17:37:33.785071859Z [inf]  0x API Quote successful
2026-02-04T17:37:33.785076199Z [inf]  [QuoteService] 0x API estimatedPriceImpact: {
2026-02-04T17:37:33.785079898Z [inf]    raw: undefined,
2026-02-04T17:37:33.785084048Z [inf]    parsed: 0,
2026-02-04T17:37:33.785087688Z [inf]    multipliedBy100: 0,
2026-02-04T17:37:33.785091618Z [inf]    impactVsMkt: null,
2026-02-04T17:37:33.785095118Z [inf]    willUse: 0
2026-02-04T17:37:33.785099688Z [inf]  }
2026-02-04T17:37:34.946775483Z [inf]    allBodyKeys: [
2026-02-04T17:37:34.946787282Z [inf]      'routeSummary',
2026-02-04T17:37:34.946792512Z [inf]      'sender',
2026-02-04T17:37:34.946797302Z [inf]      'recipient',
2026-02-04T17:37:34.946801832Z [inf]      'origin',
2026-02-04T17:37:34.946807112Z [inf]      'slippageTolerance',
2026-02-04T17:37:34.946811812Z [inf]      'deadline'
2026-02-04T17:37:34.946816432Z [inf]    ]
2026-02-04T17:37:34.946820272Z [inf]  }
2026-02-04T17:37:34.946841402Z [inf]  [Kyber] routes response {
2026-02-04T17:37:34.946845142Z [inf]    status: 200,
2026-02-04T17:37:34.946849112Z [inf]    hasData: true,
2026-02-04T17:37:34.946855122Z [inf]    keys: [ 'code', 'message', 'data', 'requestId' ]
2026-02-04T17:37:34.946859012Z [inf]  }
2026-02-04T17:37:34.946862862Z [inf]  [Kyber] Building route/build request body: {
2026-02-04T17:37:34.946866982Z [inf]    hasRouteSummary: true,
2026-02-04T17:37:34.946871122Z [inf]    routeSummaryKeys: [
2026-02-04T17:37:34.946874872Z [inf]      'tokenIn',
2026-02-04T17:37:34.946878622Z [inf]      'amountIn',
2026-02-04T17:37:34.946883082Z [inf]      'amountInUsd',
2026-02-04T17:37:34.946886962Z [inf]      'tokenOut',
2026-02-04T17:37:34.946891602Z [inf]      'amountOut',
2026-02-04T17:37:34.946896902Z [inf]      'amountOutUsd',
2026-02-04T17:37:34.946901772Z [inf]      'gas',
2026-02-04T17:37:34.946906862Z [inf]      'gasPrice'
2026-02-04T17:37:34.946911392Z [inf]    ],
2026-02-04T17:37:34.946916242Z [inf]    sender: '0xFB64Ce8d',
2026-02-04T17:37:34.946920752Z [inf]    recipient: '0xFB64Ce8d',
2026-02-04T17:37:34.946924981Z [inf]    slippageTolerance: 1500,
2026-02-04T17:37:34.946928691Z [inf]    slippageToleranceType: 'number',
2026-02-04T17:37:34.946932841Z [inf]    deadline: 1770227254,
2026-02-04T17:37:34.946936961Z [inf]    deadlineType: 'number',
2026-02-04T17:37:35.199415501Z [inf]  [QuoteService] Quote comparison: {
2026-02-04T17:37:35.199418371Z [inf]    '0x_amount': '11808956.3747818505165532',
2026-02-04T17:37:35.199421851Z [inf]    kyber_amount: '11826895.921229395277119488',
2026-02-04T17:37:35.199425321Z [inf]    kyber_advantage_pct: '0.00',
2026-02-04T17:37:35.199427771Z [inf]    chainId: 8453
2026-02-04T17:37:35.199430131Z [inf]  }
2026-02-04T17:37:35.199432541Z [inf]  [QuoteService] Preferring 0x for reliability { reason: 'prices within 2%', percentDiff: '0.00' }
2026-02-04T17:37:35.199434811Z [inf]  Checking approval for swap
2026-02-04T17:37:35.199439071Z [inf]  Approval not needed or already set
2026-02-04T17:37:35.199441881Z [inf]  [SwapExecutor] Executing 0x Aggregator swap on chain 8453
2026-02-04T17:37:35.199444441Z [inf]  [SwapExecutor] ========== TRANSACTION EXECUTION ==========
2026-02-04T17:37:35.199446721Z [inf]  [SwapExecutor] DEX: 0x Aggregator
2026-02-04T17:37:35.199449181Z [inf]  [SwapExecutor] Transaction params: {
2026-02-04T17:37:35.199451501Z [inf]    to: '0x0000000000001ff3684f28c67538d4d072c22734',
2026-02-04T17:37:35.199454131Z [inf]    dataLength: 4618,
2026-02-04T17:37:35.199457521Z [inf]    dataPrefix: '0x2213bc0b000000000000000000000000dc5d8200a030798bc6227240f68b4dd9',
2026-02-04T17:37:35.199459991Z [inf]    value: '4721211227315549',
2026-02-04T17:37:35.200171367Z [inf]    router: '0x0000000000001ff3684f28c67538d4d072c22734',
2026-02-04T17:37:35.200176697Z [inf]    allowanceTarget: '0x0000000000001ff3684f28c67538d4d072c22734'
2026-02-04T17:37:35.200177847Z [inf]    priceImpact: 0,
2026-02-04T17:37:35.200179567Z [inf]  }
2026-02-04T17:37:35.200180447Z [inf]    gasEstimate: 854862
2026-02-04T17:37:35.200182277Z [inf]  [SwapExecutor] Swap details: {
2026-02-04T17:37:35.200183137Z [inf]  }
2026-02-04T17:37:35.200185057Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-04T17:37:35.200185657Z [inf]  [SwapExecutor] =============================================
2026-02-04T17:37:35.200187447Z [inf]    tokenOut: '0xeec3eb913a9dd96b34efc4fa43a3836bea402b07',
2026-02-04T17:37:35.200189707Z [inf]    amountInBase: '4721211227315549',
2026-02-04T17:37:35.200192137Z [inf]    amountInHuman: '0.004721211227315549',
2026-02-04T17:37:35.200194337Z [inf]    amountOut: '11808956.3747818505165532',
2026-02-04T17:37:35.200196657Z [inf]    slippageBps: 1500,
2026-02-04T17:37:35.218313085Z [inf]  [SwapExecutor] Execution params prepared: {
2026-02-04T17:37:35.218316785Z [inf]    dex: '0x Aggregator',
2026-02-04T17:37:35.218320355Z [inf]    gasEstimate: 854862,
2026-02-04T17:37:35.218323405Z [inf]    gasLimit: '1282293',
2026-02-04T17:37:35.218326265Z [inf]    maxFeePerGas: '473754156',
2026-02-04T17:37:35.218329355Z [inf]    maxPriorityFeePerGas: '1000000'
2026-02-04T17:37:35.218331985Z [inf]  }
2026-02-04T17:37:35.218334715Z [inf]  🚀 CopyTrade Aggressive Gas
2026-02-04T17:37:35.407206714Z [inf]  [sendTransaction] ========== PRIVY TX PARAMS ==========
2026-02-04T17:37:35.407209704Z [inf]  [sendTransaction] From: 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T17:37:35.407212364Z [inf]  [sendTransaction] To: 0x0000000000001ff3684f28c67538d4d072c22734
2026-02-04T17:37:35.407214974Z [inf]  [sendTransaction] Value: 4721211227315549
2026-02-04T17:37:35.407217285Z [inf]  [sendTransaction] ValueHex: 0x10c5eaa61d1d5d
2026-02-04T17:37:35.407219805Z [inf]  [sendTransaction] Data length: 4618
2026-02-04T17:37:35.407222045Z [inf]  [sendTransaction] Data (full): 0x2213bc0b000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010c5eaa61d1d5d000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef00000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000008241fff991f000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b000000000000000000000000eec3eb913a9dd96b34efc4fa43a3836bea402b07000000000000000000000000000000000000000000084d8c162e49fa637aab0c00000000000000000000000000000000000000000000000000000000000000a0e7caba98aa3b784ad6310c090000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000000000000000000000000000000000380000000000000000000000000000000000000000000000000000000000000054000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000044bd01c22600000000000000000000000000000000000000000000000000000000698385090000000000000000000000000000000000000000000000000010c5eaa61d1d5d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee000000000000000000000000000000000000000000000000000000000000000f000000000000000000000000ad01c20d5886137e056775af56915de824c8fce5000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000000000000000000000000000000000000000027100000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000024d0e30db0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000184af72634f000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef0000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000ffffffffffffffc5000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000048271000000000000000000000000000000001000276a401eec3eb913a9dd96b34efc4fa43a3836bea402b078000000000c8b429d62f8f3bffb98cdb9569533ea23bf0ba28cc00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008434ee90ca000000000000000000000000f5c4f3dc02c3fb9279495a8fef7b0741da956157000000000000000000000000eec3eb913a9dd96b34efc4fa43a3836bea402b0700000000000000000000000000000000000000000009e3562823e54ba997739d000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012438c9c147000000000000000000000000eec3eb913a9dd96b34efc4fa43a3836bea402b070000000000000000000000000000000000000000000000000000000000000064000000000000000000000000eec3eb913a9dd96b34efc4fa43a3836bea402b07000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000c5377e6329770be29ef938d8acc11f22398d7e540000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
2026-02-04T17:37:35.408058439Z [inf]  [sendTransaction] ChainId: 8453
2026-02-04T17:37:35.408063969Z [inf]  [sendTransaction] Gas: 1282293
2026-02-04T17:37:35.408067369Z [inf]  [sendTransaction] MaxFeePerGas: 482754156
2026-02-04T17:37:35.408069969Z [inf]  [sendTransaction] MaxPriorityFeePerGas: 10000000
2026-02-04T17:37:35.408072769Z [inf]  [sendTransaction] Full TX object: {
2026-02-04T17:37:35.408075449Z [inf]    to: '0x0000000000001ff3684f28c67538d4d072c22734',
2026-02-04T17:37:35.408077919Z [inf]    data: '0x2213bc0b000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010c5eaa61d1d5d000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef00000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000008241fff991f000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b000000000000000000000000eec3eb913a9dd96b34efc4fa43a3836bea402b07000000000000000000000000000000000000000000084d8c162e49fa637aab0c00000000000000000000000000000000000000000000000000000000000000a0e7caba98aa3b784ad6310c090000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000000000000000000000000000000000380000000000000000000000000000000000000000000000000000000000000054000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000044bd01c22600000000000000000000000000000000000000000000000000000000698385090000000000000000000000000000000000000000000000000010c5eaa61d1d5d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee000000000000000000000000000000000000000000000000000000000000000f000000000000000000000000ad01c20d5886137e056775af56915de824c8fce5000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000000000000000000000000000000000000000027100000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000024d0e30db0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000184af72634f000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef0000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000ffffffffffffffc5000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000048271000000000000000000000000000000001000276a401eec3eb913a9dd96b34efc4fa43a3836bea402b078000000000c8b429d62f8f3bffb98cdb9569533ea23bf0ba28cc00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008434ee90ca000000000000000000000000f5c4f3dc02c3fb9279495a8fef7b0741da956157000000000000000000000000eec3eb913a9dd96b34efc4fa43a3836bea402b0700000000000000000000000000000000000000000009e3562823e54ba997739d000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012438c9c147000000000000000000000000eec3eb913a9dd96b34efc4fa43a3836bea402b070000000000000000000000000000000000000000000000000000000000000064000000000000000000000000eec3eb913a9dd96b34efc4fa43a3836bea402b07000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000c5377e6329770be29ef938d8acc11f22398d7e540000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
2026-02-04T17:37:35.408389927Z [inf]    value: '4721211227315549',
2026-02-04T17:37:35.408392667Z [inf]    chainId: 8453,
2026-02-04T17:37:35.408395437Z [inf]    gas: '1282293',
2026-02-04T17:37:35.408397987Z [inf]    maxFeePerGas: '482754156',
2026-02-04T17:37:35.408401627Z [inf]    maxPriorityFeePerGas: '10000000'
2026-02-04T17:37:35.408404767Z [inf]  }
2026-02-04T17:37:35.408406977Z [inf]  [sendTransaction] ===========================================
2026-02-04T17:37:36.570571220Z [inf]  Ethereum transaction sent via Privy
2026-02-04T17:37:37.572447506Z [inf]  Swap Broadcast
2026-02-04T17:37:37.572450516Z [inf]  [ConfirmWait] Waiting for confirmation: 0x43e5ec57e64fef5437379626c8eccbd8e2a21bbde75bea7df51c0926f178e0a1 on 8453
2026-02-04T17:37:37.805009277Z [inf]  [ConfirmWait] Transaction confirmed: 0x43e5ec57e64fef5437379626c8eccbd8e2a21bbde75bea7df51c0926f178e0a1
2026-02-04T17:37:37.805012397Z [inf]  Transaction confirmed on-chain
2026-02-04T17:37:37.805014567Z [inf]  [MainSwapService][1770226649590_j4a32l] Initiating Post-Buy Pre-Approval
2026-02-04T17:37:37.805017837Z [inf]  Copy trade completed and position created
2026-02-04T17:37:37.805020417Z [inf]  [Warpcast] Sending DM to FID 877398: "🚀 Bought $MOLTEN @ $10.00
2026-02-04T17:37:37.805022907Z [inf]  
2026-02-04T17:37:37.805025237Z [inf]  🟢 **BOUGHT $MOLTEN**
2026-02-04T17:37:37.805028297Z [inf]  ..."
2026-02-04T17:37:37.805032707Z [inf]  [sendTransaction] ========== PRIVY TX PARAMS ==========
2026-02-04T17:37:37.805036097Z [inf]  [sendTransaction] From: 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T17:37:37.805040027Z [inf]  [sendTransaction] To: 0xeec3eb913a9dd96b34efc4fa43a3836bea402b07
2026-02-04T17:37:37.805576064Z [inf]  [sendTransaction] Value: 0
2026-02-04T17:37:37.805580684Z [inf]  [sendTransaction] ValueHex: 0x0
2026-02-04T17:37:37.805584934Z [inf]  [sendTransaction] MaxPriorityFeePerGas: undefined
2026-02-04T17:37:37.805585944Z [inf]  [sendTransaction] Data length: 138
2026-02-04T17:37:37.805590514Z [inf]  [sendTransaction] Data (full): 0x095ea7b30000000000000000000000000000000000001ff3684f28c67538d4d072c22734ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
2026-02-04T17:37:37.805594924Z [inf]  [sendTransaction] ChainId: 8453
2026-02-04T17:37:37.805597774Z [inf]  [sendTransaction] Full TX object: {
2026-02-04T17:37:37.805600754Z [inf]  [sendTransaction] Gas: undefined
2026-02-04T17:37:37.805606084Z [inf]    to: '0xeec3eb913a9dd96b34efc4fa43a3836bea402b07',
2026-02-04T17:37:37.805608264Z [inf]  [sendTransaction] MaxFeePerGas: undefined
2026-02-04T17:37:37.805611334Z [inf]    data: '0x095ea7b30000000000000000000000000000000000001ff3684f28c67538d4d072c22734ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
2026-02-04T17:37:37.805615234Z [inf]    value: '0',
2026-02-04T17:37:37.805619414Z [inf]    chainId: 8453
2026-02-04T17:37:37.805625724Z [inf]  }
2026-02-04T17:37:37.805629304Z [inf]  [sendTransaction] ===========================================
2026-02-04T17:37:38.063613250Z [inf]  [Warpcast] DM sent successfully. Daily usage: 1/50000
2026-02-04T17:37:38.063619080Z [inf]  ✅ Smart batch execution complete
2026-02-04T17:37:38.168302786Z [inf]  incoming request
2026-02-04T17:37:38.169100371Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_54ns6dt69uikqtdq","createdAt":"2026-02-04T17:37:37.921Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","toAddress":"0x0000000000001ff3684f28c67538d4d072c22734","blockNum":"0x27c937f","hash":"0x43e5ec57e64fef5437379626c8eccbd8e2a21bbde75bea7df51c0926f178e0a1","value":0.004721211227315549,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x10c5eaa61d1d5d","decimals":18},"blockTimestamp":"0x698383e1"}],"source":"chainlake-kafka"}}
2026-02-04T17:37:38.169103061Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T17:37:38.169708998Z [inf]  request completed
2026-02-04T17:37:38.174418458Z [inf]  [Webhook] ⚠️ Ignoring tx 0x43e5ec: No matched tracked wallets in [0xfb64, 0x0000]
2026-02-04T17:37:38.237605440Z [inf]  incoming request
2026-02-04T17:37:38.238350646Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_r1v0pu4qtfdl3pw8","createdAt":"2026-02-04T17:37:37.999Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xdc5d8200a030798bc6227240f68b4dd9542686ef","toAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","blockNum":"0x27c937f","hash":"0x43e5ec57e64fef5437379626c8eccbd8e2a21bbde75bea7df51c0926f178e0a1","value":11834359.891735502,"asset":"MOLTEN","category":"token","rawContract":{"rawValue":"0x00000000000000000000000000000000000000000009ca05ef6b377b8bbc564d","address":"0xeec3eb913a9dd96b34efc4fa43a3836bea402b07","decimals":18},"log":{"address":"0xeec3eb913a9dd96b34efc4fa43a3836bea402b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef","0x000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b"],"data":"0x00000000000000000000000000000000000000000009ca05ef6b377b8bbc564d","blockHash":"0xf071f097d043b7d9cfb5aea7762ebe2c4a8b845c4bc6faba7e18d70593e84edf","blockNumber":"0x27c937f","blockTimestamp":"0x698383e1","transactionHash":"0x43e5ec57e64fef5437379626c8eccbd8e2a21bbde75bea7df51c0926f178e0a1","transactionIndex":"0x1ce","logIndex":"0x2b9","removed":false},"blockTimestamp":"0x698383e1"}],"source":"chainlake-kafka"}}
2026-02-04T17:37:38.238354816Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T17:37:38.238357426Z [inf]  request completed
2026-02-04T17:37:38.243203847Z [inf]  [Webhook] ⚠️ Ignoring tx 0x43e5ec: No matched tracked wallets in [0xdc5d, 0xfb64]
2026-02-04T17:37:38.396930872Z [inf]  Ethereum transaction sent via Privy
2026-02-04T17:37:39.398832538Z [inf]  [MainSwapService][1770226649590_j4a32l] Post-Buy Pre-Approval Sent
2026-02-04T17:37:39.490636385Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:37:39.849700959Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:37:40.150165654Z [inf]  incoming request
2026-02-04T17:37:40.150169564Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_80y3q0mgx00o421u","createdAt":"2026-02-04T17:37:39.945Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","toAddress":"0xeec3eb913a9dd96b34efc4fa43a3836bea402b07","blockNum":"0x27c9380","hash":"0x97dfda868b7b00cba07ed897f1d3f7c9b4204f96c10d1c7ac8a840e652006cde","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x698383e3"}],"source":"chainlake-kafka"}}
2026-02-04T17:37:40.150175454Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T17:37:40.150178624Z [inf]  request completed
2026-02-04T17:37:40.150181694Z [inf]  [Webhook] ⚠️ Ignoring tx 0x97dfda: No matched tracked wallets in [0xfb64, 0xeec3]
2026-02-04T17:37:42.171797659Z [inf]  incoming request
2026-02-04T17:37:42.171803399Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_k16pp98oel9p5sz6","createdAt":"2026-02-04T17:37:41.905Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0xeec3eb913a9dd96b34efc4fa43a3836bea402b07","blockNum":"0x27c9381","hash":"0x5094e2ff01e31d6b47f92a565da98f1331f1ed1e9b95eecd62e042448c46f321","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x698383e5"}],"source":"chainlake-kafka"}}
2026-02-04T17:37:42.171807509Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T17:37:42.171810439Z [inf]  request completed
2026-02-04T17:37:42.172452365Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x5094e2
2026-02-04T17:37:42.181822487Z [inf]  [Profile] fetchTransaction
2026-02-04T17:37:42.250687724Z [inf]  [Profile] fetchReceipt
2026-02-04T17:37:42.250690564Z [inf]  [Profile] parseSwapTransaction
2026-02-04T17:37:42.250692874Z [inf]  [Webhook] Not a swap tx for 0xb4beddf1: 0x5094e2ff01e31d
2026-02-04T17:37:48.301419837Z [inf]  incoming request
2026-02-04T17:37:48.306727515Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_p7xtn5s5wcg74ich","createdAt":"2026-02-04T17:37:48.101Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0x8d0d118070b728e104294471fbe93c2e3affd694","blockNum":"0x27c9384","hash":"0x318eae58c926bb7872afa8005c85132fec0979f4660312a7c0820e41f906969a","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x698383eb"}],"source":"chainlake-kafka"}}
2026-02-04T17:37:48.306731675Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T17:37:48.306734435Z [inf]  request completed
2026-02-04T17:37:48.306737005Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x318eae
2026-02-04T17:37:48.331122635Z [inf]  [Profile] fetchTransaction
2026-02-04T17:37:48.342086797Z [inf]  [Profile] fetchReceipt
2026-02-04T17:37:48.342091437Z [inf]  [Profile] parseSwapTransaction
2026-02-04T17:37:48.342094247Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0xb4beddf1: {
2026-02-04T17:37:48.342097997Z [inf]    tokenIn: '0xeec3eb913a9dd96b34efc4fa43a3836bea402b07',
2026-02-04T17:37:48.342100817Z [inf]    tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-04T17:37:48.342103457Z [inf]    dex: 'Uniswap v4'
2026-02-04T17:37:48.342113447Z [inf]  }
2026-02-04T17:37:48.342116767Z [inf]  Swap detected on target wallet
2026-02-04T17:37:48.343837506Z [inf]  Target is selling - triggering mirror sell
2026-02-04T17:37:48.482710854Z [inf]  incoming request
2026-02-04T17:37:48.482713324Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_k2btwyo1yss09llj","createdAt":"2026-02-04T17:37:48.163Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0x6ff5693b99212da76ad316178a184ab56d299b43","blockNum":"0x27c9384","hash":"0x318eae58c926bb7872afa8005c85132fec0979f4660312a7c0820e41f906969a","value":1297171945.2923784,"asset":"MOLTEN","category":"token","rawContract":{"rawValue":"0x00000000000000000000000000000000000000000430fed80f047cd4ca3919f1","address":"0xeec3eb913a9dd96b34efc4fa43a3836bea402b07","decimals":18},"log":{"address":"0xeec3eb913a9dd96b34efc4fa43a3836bea402b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000b4beddf1b828aaed9638601f7145b0f6093f2d3f","0x0000000000000000000000006ff5693b99212da76ad316178a184ab56d299b43"],"data":"0x00000000000000000000000000000000000000000430fed80f047cd4ca3919f1","blockHash":"0xe4f613d8b7bdaf2aaf866e8aa417b3d9bbe58d14dce4fd8143b9cd5e4c66f4e4","blockNumber":"0x27c9384","blockTimestamp":"0x698383eb","transactionHash":"0x318eae58c926bb7872afa8005c85132fec0979f4660312a7c0820e41f906969a","transactionIndex":"0xce","logIndex":"0xc1","removed":false},"blockTimestamp":"0x698383eb"}],"source":"chainlake-kafka"}}
2026-02-04T17:37:48.482717284Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T17:37:48.482719724Z [inf]  [Webhook] Tx already in processedTxs cache: 0x318eae58c926bb
2026-02-04T17:37:48.482722224Z [inf]  request completed
2026-02-04T17:37:48.559222064Z [inf]  incoming request
2026-02-04T17:37:48.559225564Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_3l6yincthhp75yqw","createdAt":"2026-02-04T17:37:48.182Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x8d0d118070b728e104294471fbe93c2e3affd694","toAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","blockNum":"0x27c9384","hash":"0x318eae58c926bb7872afa8005c85132fec0979f4660312a7c0820e41f906969a","value":0.47029962726714736,"typeTraceAddress":"CALL_9","asset":"ETH","category":"internal","rawContract":{"rawValue":"0x686d704ed41c650","decimals":18},"blockTimestamp":"0x698383eb"}]}}
2026-02-04T17:37:48.559229134Z [inf]  request completed
2026-02-04T17:37:48.559232164Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T17:37:48.559235424Z [inf]  [Webhook] Tx already in processedTxs cache: 0x318eae58c926bb
2026-02-04T17:37:48.906100604Z [inf]  Timer finished: launchpad_det_0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
2026-02-04T17:37:49.874822006Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:37:50.254041396Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:37:50.660800459Z [wrn]  RPC endpoint failed
2026-02-04T17:37:50.814093808Z [inf]  RPC failover success
2026-02-04T17:37:50.814096598Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:38:10.719997492Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:38:10.720001642Z [wrn]  All API liquidity sources failed
2026-02-04T17:38:10.720004892Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:38:11.486487777Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:38:11.986261829Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:38:31.851571499Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:38:31.851575579Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:38:31.851578659Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:38:33.072344148Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:38:33.726198706Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:38:42.088080074Z [inf]  incoming request
2026-02-04T17:38:42.088084214Z [inf]  ChatWS Client connected
2026-02-04T17:38:42.088088374Z [inf]  ChatWS: User connected
2026-02-04T17:38:42.206714697Z [inf]  Sync request
2026-02-04T17:38:42.206718247Z [inf]  Sync request
2026-02-04T17:38:42.206721687Z [inf]  Sync request
2026-02-04T17:38:43.686179101Z [inf]  incoming request
2026-02-04T17:38:43.686182010Z [inf]  request completed
2026-02-04T17:38:43.745220148Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:38:43.925989790Z [inf]  incoming request
2026-02-04T17:38:43.925994750Z [inf]  [verifyAccess] Checking access: {
2026-02-04T17:38:43.925997520Z [inf]    userId: 'did:privy:cmk74yj4r03jcl70b8hwyuh2c',
2026-02-04T17:38:43.926000030Z [inf]    userIdLength: 35,
2026-02-04T17:38:43.926002660Z [inf]    userIdPrefix: 'did:privy:cmk74yj4r0',
2026-02-04T17:38:43.926005360Z [inf]    requestedAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B'
2026-02-04T17:38:43.926007990Z [inf]  }
2026-02-04T17:38:43.937116890Z [inf]  [verifyAccess] ✅ Access granted
2026-02-04T17:38:44.116521020Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:38:45.117493059Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:38:45.117496519Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:38:45.117499759Z [inf]  request completed
2026-02-04T17:38:45.287217149Z [inf]  incoming request
2026-02-04T17:38:45.287220709Z [inf]  request completed
2026-02-04T17:38:45.565737951Z [inf]  incoming request
2026-02-04T17:38:45.734967982Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:38:45.734971552Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:38:45.734975092Z [inf]  request completed
2026-02-04T17:38:47.181408350Z [inf]  incoming request
2026-02-04T17:38:47.181412640Z [inf]  request completed
2026-02-04T17:38:47.181417070Z [inf]  incoming request
2026-02-04T17:38:47.441743762Z [inf]  incoming request
2026-02-04T17:38:47.450664198Z [inf]  request completed
2026-02-04T17:38:47.637155864Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:38:47.637158994Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:38:47.637161414Z [inf]  request completed
2026-02-04T17:38:54.165261241Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:38:54.508718044Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:38:54.957247844Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:38:55.084565022Z [inf]  📊 Position P/L check
2026-02-04T17:39:02.366873670Z [inf]  incoming request
2026-02-04T17:39:02.366877610Z [inf]  request completed
2026-02-04T17:39:02.366881700Z [inf]  incoming request
2026-02-04T17:39:02.366885030Z [inf]  request completed
2026-02-04T17:39:02.366888640Z [inf]  incoming request
2026-02-04T17:39:02.366891840Z [inf]  request completed
2026-02-04T17:39:02.637433710Z [inf]  incoming request
2026-02-04T17:39:02.638235685Z [inf]  incoming request
2026-02-04T17:39:02.639567727Z [inf]  incoming request
2026-02-04T17:39:02.676412911Z [inf]  request completed
2026-02-04T17:39:02.935212474Z [inf]  request completed
2026-02-04T17:39:03.130537556Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:39:03.151317209Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:39:03.151332619Z [inf]  request completed
2026-02-04T17:39:03.193210762Z [inf]  incoming request
2026-02-04T17:39:03.194230645Z [inf]  ChatWS Client connected
2026-02-04T17:39:03.194235375Z [inf]  ChatWS: User connected
2026-02-04T17:39:03.392677748Z [inf]  incoming request
2026-02-04T17:39:03.392683508Z [inf]  request completed
2026-02-04T17:39:03.656718089Z [inf]  incoming request
2026-02-04T17:39:03.977231984Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:39:03.977234764Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:39:03.977237214Z [inf]  request completed
2026-02-04T17:39:04.689684095Z [inf]  incoming request
2026-02-04T17:39:04.689688865Z [inf]  request completed
2026-02-04T17:39:04.965277695Z [inf]  incoming request
2026-02-04T17:39:04.965280265Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:39:04.969651178Z [inf]  request completed
2026-02-04T17:39:05.378391571Z [inf]  incoming request
2026-02-04T17:39:05.599395006Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:39:05.608176122Z [inf]  📊 Position P/L check
2026-02-04T17:39:05.759465394Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:39:05.759467984Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:39:05.759470564Z [inf]  request completed
2026-02-04T17:39:08.361844016Z [inf]  incoming request
2026-02-04T17:39:08.648814566Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:39:08.679275199Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:39:08.680103034Z [inf]  request completed
2026-02-04T17:39:10.150840385Z [inf]  incoming request
2026-02-04T17:39:10.150844695Z [inf]  request completed
2026-02-04T17:39:10.150849265Z [inf]  incoming request
2026-02-04T17:39:10.150853935Z [inf]  request completed
2026-02-04T17:39:10.317517663Z [inf]  incoming request
2026-02-04T17:39:10.318883025Z [inf]  incoming request
2026-02-04T17:39:10.325657354Z [inf]  request completed
2026-02-04T17:39:10.675279170Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:39:10.675284580Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:39:10.675288600Z [inf]  request completed
2026-02-04T17:39:15.626005484Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:39:15.967698869Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:39:15.995284970Z [inf]  📊 Position P/L check
2026-02-04T17:39:22.674401808Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_xxejnoh6gaee211t","createdAt":"2026-02-04T17:39:22.397Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x1b49e23c977ceb8bea8806fff6df1a942ca9a984","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27c93b1","hash":"0xa20a895d4672812a1b41634a788e317aead44ce391245b1d8354364761d33f78","value":0.1,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x16345785d8a0000","decimals":18},"blockTimestamp":"0x69838445"}],"source":"chainlake-kafka"}}
2026-02-04T17:39:22.674405588Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T17:39:22.674408918Z [inf]  incoming request
2026-02-04T17:39:22.674901316Z [inf]  request completed
2026-02-04T17:39:22.674907836Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0xa20a89
2026-02-04T17:39:22.695161842Z [inf]  [Profile] fetchTransaction
2026-02-04T17:39:22.737658721Z [inf]  [Profile] fetchReceipt
2026-02-04T17:39:22.737664751Z [inf]  Swap successfully decoded from logs
2026-02-04T17:39:22.737668201Z [inf]  [Profile] parseSwapTransaction
2026-02-04T17:39:22.737671561Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x1b49e23c: {
2026-02-04T17:39:22.737674801Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-04T17:39:22.737678651Z [inf]    tokenOut: '0x59c0d5c34c301ac0600147924d6c9be22a2f0b07',
2026-02-04T17:39:22.737683871Z [inf]    dex: 'Uniswap v4'
2026-02-04T17:39:22.737688621Z [inf]  }
2026-02-04T17:39:22.737692991Z [inf]  Swap detected on target wallet
2026-02-04T17:39:22.742669740Z [inf]  Target is buying - triggering copy trade
2026-02-04T17:39:22.882151035Z [inf]  Timer finished: launchpad_det_0x59c0d5c34c301ac0600147924d6c9be22a2f0b07
2026-02-04T17:39:22.882156905Z [wrn]  All API liquidity sources failed
2026-02-04T17:39:22.882159815Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:39:22.992399919Z [inf]  incoming request
2026-02-04T17:39:22.992403359Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_onnp42l9umpmrreu","createdAt":"2026-02-04T17:39:22.748Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0x1b49e23c977ceb8bea8806fff6df1a942ca9a984","blockNum":"0x27c93b1","hash":"0xa20a895d4672812a1b41634a788e317aead44ce391245b1d8354364761d33f78","value":271834570.33194596,"asset":"Molten","category":"token","rawContract":{"rawValue":"0x000000000000000000000000000000000000000000e0db3595e529482aa2357b","address":"0x59c0d5c34c301ac0600147924d6c9be22a2f0b07","decimals":18},"log":{"address":"0x59c0d5c34c301ac0600147924d6c9be22a2f0b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x0000000000000000000000001b49e23c977ceb8bea8806fff6df1a942ca9a984"],"data":"0x000000000000000000000000000000000000000000e0db3595e529482aa2357b","blockHash":"0x20ad25d9a2be5c0fe5dc20ae54662d1159698a9509582aebf9bbbf0440572407","blockNumber":"0x27c93b1","blockTimestamp":"0x69838445","transactionHash":"0xa20a895d4672812a1b41634a788e317aead44ce391245b1d8354364761d33f78","transactionIndex":"0xa8","logIndex":"0x1cc","removed":false},"blockTimestamp":"0x69838445"}],"source":"chainlake-kafka"}}
2026-02-04T17:39:22.992405949Z [inf]  request completed
2026-02-04T17:39:22.992408809Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T17:39:22.992411249Z [inf]  [Webhook] Tx already in processedTxs cache: 0xa20a895d467281
2026-02-04T17:39:23.273997283Z [inf]  [Dune PNL] Query 6506445 completed in 131991ms
2026-02-04T17:39:23.274009733Z [inf]  [Dune PNL] ✅ Processed. Net Trader PNL: $-116.19 (Reflects User Reality)
2026-02-04T17:39:23.377026042Z [inf]  [ChatWorker] DeepSeek iteration 6/10 for task cml8b77cc00l18poe785cyod8
2026-02-04T17:39:23.377033852Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:39:23.377772187Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:39:23.476032024Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:39:23.476034444Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:39:23.476037554Z [inf]  🔥 Warming up 1 user settings
2026-02-04T17:39:23.480066610Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-04T17:39:23.480071300Z [inf]  No eligible users after batch filter
2026-02-04T17:39:23.480075670Z [inf]  [Warpcast] Sending DM to FID 877398: "⏭️ Copy Trade Skipped: $Molten
2026-02-04T17:39:23.480079080Z [inf]  
2026-02-04T17:39:23.480082950Z [inf]  ⏭️ **COPY TRADE SK..."
2026-02-04T17:39:23.748646143Z [inf]  [Warpcast] DM sent successfully. Daily usage: 2/50000
2026-02-04T17:39:26.021716178Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:39:26.440945868Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:39:27.014903010Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:39:27.035657352Z [inf]  📊 Position P/L check
2026-02-04T17:39:27.878771723Z [inf]  Timer finished: intent_parsing_52a9a4f2
2026-02-04T17:39:27.879575998Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:39:27.882017073Z [inf]    chainId: 8453
2026-02-04T17:39:27.882020123Z [inf]  [ChatWorker] User Settings: {
2026-02-04T17:39:27.882028353Z [inf]    fastSwapMode: true,
2026-02-04T17:39:27.882036083Z [inf]    swapMethod: 'allowance_trade',
2026-02-04T17:39:27.882036703Z [inf]  }
2026-02-04T17:39:27.882043563Z [inf]    toolConfig: [
2026-02-04T17:39:27.882049013Z [inf]  Timer finished: prompt_gen_GENERAL_CHAT_deepseek
2026-02-04T17:39:27.882051613Z [inf]      'userRole',
2026-02-04T17:39:27.882055993Z [inf]      'defaultSwapAmount',
2026-02-04T17:39:27.882059393Z [inf]      'defaultSwapUnit',
2026-02-04T17:39:27.882063213Z [inf]      'checkTokenBeforeSwap',
2026-02-04T17:39:27.882067393Z [inf]      'showQuoteBeforeSwap',
2026-02-04T17:39:27.882074383Z [inf]      'swapMethod',
2026-02-04T17:39:27.882077823Z [inf]      'slippageMode',
2026-02-04T17:39:27.882080973Z [inf]      'customSlippage',
2026-02-04T17:39:27.882084643Z [inf]      'mevProtection',
2026-02-04T17:39:27.882088373Z [inf]      'priceDeviationCheck',
2026-02-04T17:39:27.882091553Z [inf]      'fastSwapMode',
2026-02-04T17:39:27.882095063Z [inf]      'copyTradeTokenCooldownMinutes',
2026-02-04T17:39:27.882099823Z [inf]      'minMarketCapUsd',
2026-02-04T17:39:27.882104423Z [inf]      'minLiquidityUsd',
2026-02-04T17:39:27.882108413Z [inf]      'minTargetValueUsd',
2026-02-04T17:39:27.882112003Z [inf]      'id',
2026-02-04T17:39:27.882115593Z [inf]      'userId',
2026-02-04T17:39:27.882118813Z [inf]      'quickSwapMode',
2026-02-04T17:39:27.882122123Z [inf]      'copyTradeAIMode',
2026-02-04T17:39:27.882125643Z [inf]      'updatedAt',
2026-02-04T17:39:27.882129563Z [inf]      'createdAt',
2026-02-04T17:39:27.882132772Z [inf]      'zoraNotificationThreshold'
2026-02-04T17:39:27.882136102Z [inf]    ],
2026-02-04T17:39:27.882139812Z [inf]    walletConnected: true,
2026-02-04T17:39:27.882727419Z [inf]  [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (8 tokens cached)
2026-02-04T17:39:27.882739119Z [inf]  [ChatWorker] No tokenInfo available
2026-02-04T17:39:27.882744209Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:39:27.882748039Z [inf]  [ChatWorker] Enriched user prompt with context for 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T17:39:27.882752919Z [inf]  ChatWorker: client context injected
2026-02-04T17:39:27.882757169Z [inf]  ChatWorker: client balance snapshot summary
2026-02-04T17:39:27.882760829Z [inf]  [ChatWorker] Added client context to system prompt
2026-02-04T17:39:27.882766689Z [inf]  [ChatWorker] Broadcasting Thinking status for cml8b76jv00kz8poeqrnuymn0. Message order: message_start → launchpad_card → Thinking → content_chunks
2026-02-04T17:39:27.882770779Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:39:29.346977803Z [inf]  incoming request
2026-02-04T17:39:29.347727618Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_cjgihpa4ouk2kro2","createdAt":"2026-02-04T17:39:29.149Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x1b49e23c977ceb8bea8806fff6df1a942ca9a984","toAddress":"0x59c0d5c34c301ac0600147924d6c9be22a2f0b07","blockNum":"0x27c93b6","hash":"0xe40072b9b6c677b4fa0a41338a855636e35dc4c9cf9874fa11376450f9f9a44b","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x6983844f"}],"source":"chainlake-kafka"}}
2026-02-04T17:39:29.348469404Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T17:39:29.348472384Z [inf]  request completed
2026-02-04T17:39:29.353208605Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0xe40072
2026-02-04T17:39:29.378823808Z [inf]  [Profile] fetchTransaction
2026-02-04T17:39:29.389149175Z [inf]  [Profile] fetchReceipt
2026-02-04T17:39:29.389155025Z [inf]  [Profile] parseSwapTransaction
2026-02-04T17:39:29.389158995Z [inf]  [Webhook] Not a swap tx for 0x1b49e23c: 0xe40072b9b6c677
2026-02-04T17:39:37.049642637Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:39:37.948204800Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:39:37.948207110Z [inf]  📊 Position P/L check
2026-02-04T17:39:39.211310948Z [inf]  incoming request
2026-02-04T17:39:39.211313958Z [inf]  ChatWS Client connected
2026-02-04T17:39:39.211317298Z [inf]  ChatWS: User connected
2026-02-04T17:39:39.519168942Z [inf]  Sync request
2026-02-04T17:39:39.519180492Z [inf]  Sending buffered messages
2026-02-04T17:39:46.234270165Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_usage
2026-02-04T17:39:46.582375981Z [inf]  Moderation Output check result
2026-02-04T17:39:46.613746020Z [inf]  [ChatWorker] Broadcasting message_complete for cml8b76jv00kz8poeqrnuymn0
2026-02-04T17:39:46.613749890Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
2026-02-04T17:39:46.613752770Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:39:46.613824999Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
2026-02-04T17:39:47.884356993Z [inf]  incoming request
2026-02-04T17:39:47.884361523Z [inf]  request completed
2026-02-04T17:39:47.884365503Z [inf]  incoming request
2026-02-04T17:39:47.884368063Z [inf]  request completed
2026-02-04T17:39:47.948102481Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:39:48.239216668Z [inf]  incoming request
2026-02-04T17:39:48.239219228Z [inf]  incoming request
2026-02-04T17:39:48.239221428Z [inf]  request completed
2026-02-04T17:39:48.239223998Z [inf]  request completed
2026-02-04T17:39:48.327269778Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:40:08.317523108Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:40:08.317527818Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:40:08.317531038Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:40:08.317534538Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-04T17:40:08.317537538Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-04T17:40:08.317539948Z [inf]  Fetching premium trending tokens
2026-02-04T17:40:08.317543787Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-04T17:40:08.317547087Z [inf]  Timer finished: recalc_heat_scores
2026-02-04T17:40:08.317549497Z [inf]  WS addresses discovered
2026-02-04T17:40:08.317551877Z [inf]  Processed DexScreener trending candidates
2026-02-04T17:40:08.318407752Z [inf]  Trending tokens fetch complete
2026-02-04T17:40:08.318413852Z [inf]  Premium trending tokens fetch complete
2026-02-04T17:40:08.318417762Z [inf]  [TokenJob] Got 100 trending tokens for Ethereum
2026-02-04T17:40:08.318420772Z [inf]  Saved 100 trending tokens for eth to database and memory cache
2026-02-04T17:40:08.318423602Z [inf]  [TokenJob] Saved 100 tokens for Ethereum to DB + cache
2026-02-04T17:40:09.632182033Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:40:10.274682938Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:40:15.879476022Z [inf]  incoming request
2026-02-04T17:40:15.880441296Z [inf]  ChatWS Client connected
2026-02-04T17:40:15.880444595Z [inf]  ChatWS: User connected
2026-02-04T17:40:16.120660114Z [inf]  Sync request
2026-02-04T17:40:20.372684676Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:40:20.634974270Z [inf]  0x API price received successfully
2026-02-04T17:40:40.633981932Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:40:40.633985532Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:40:40.633989892Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:40:40.633993782Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-04T17:40:40.633997212Z [inf]  Fetching premium trending tokens
2026-02-04T17:40:40.634001252Z [inf]  WS addresses discovered
2026-02-04T17:40:40.634007052Z [inf]  Processed DexScreener trending candidates
2026-02-04T17:40:40.634011092Z [inf]  Premium trending tokens fetch complete
2026-02-04T17:40:40.634014822Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-04T17:40:40.634018442Z [inf]  Saved 100 trending tokens for solana to database and memory cache
2026-02-04T17:40:40.634650277Z [inf]  [TokenJob] Saved 100 tokens for Solana to DB + cache
2026-02-04T17:40:41.910417194Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:40:42.689867112Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:41:02.689200847Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:41:02.689204337Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:41:02.689208097Z [inf]  incoming request
2026-02-04T17:41:02.689211397Z [inf]  request completed
2026-02-04T17:41:02.689214887Z [inf]  incoming request
2026-02-04T17:41:02.689218117Z [inf]  request completed
2026-02-04T17:41:02.689221327Z [inf]  incoming request
2026-02-04T17:41:02.689224987Z [inf]  request completed
2026-02-04T17:41:02.690749898Z [inf]  incoming request
2026-02-04T17:41:02.690760378Z [inf]  incoming request
2026-02-04T17:41:02.690764958Z [inf]  incoming request
2026-02-04T17:41:02.690768758Z [inf]  [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmk74yj4r03jcl70b8hwyuh2c, content=Copy Trade 0xffed8b8...
2026-02-04T17:41:02.690772468Z [inf]  [verifyAccess] Checking access: {
2026-02-04T17:41:02.690776538Z [inf]    userId: 'did:privy:cmk74yj4r03jcl70b8hwyuh2c',
2026-02-04T17:41:02.690780018Z [inf]    userIdLength: 35,
2026-02-04T17:41:02.690785508Z [inf]    userIdPrefix: 'did:privy:cmk74yj4r0',
2026-02-04T17:41:02.690789178Z [inf]    requestedAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B'
2026-02-04T17:41:02.690793468Z [inf]  }
2026-02-04T17:41:02.690797258Z [inf]  [verifyAccess] ✅ Access granted
2026-02-04T17:41:02.690800578Z [inf]  request completed
2026-02-04T17:41:02.690803848Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:41:02.691750862Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:41:02.691756362Z [inf]  request completed
2026-02-04T17:41:02.691795572Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:41:02.691798842Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:41:02.691802431Z [inf]  request completed
2026-02-04T17:41:02.691807041Z [inf]  incoming request
2026-02-04T17:41:02.691810751Z [inf]  request completed
2026-02-04T17:41:02.691814351Z [inf]  incoming request
2026-02-04T17:41:02.692485268Z [inf]  request completed
2026-02-04T17:41:02.692489477Z [inf]  incoming request
2026-02-04T17:41:02.692492467Z [inf]  request completed
2026-02-04T17:41:02.692495547Z [inf]  incoming request
2026-02-04T17:41:02.692498707Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:41:02.692502007Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:41:02.692504757Z [inf]  request completed
2026-02-04T17:41:02.692508107Z [inf]  incoming request
2026-02-04T17:41:02.693352602Z [inf]  request completed
2026-02-04T17:41:02.693357282Z [inf]  incoming request
2026-02-04T17:41:02.693359852Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:41:02.693362372Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:41:02.693367092Z [inf]  request completed
2026-02-04T17:41:02.693370022Z [err]  [ChatWorker] Sanitizing orphaned tool_calls from message 3 (missing 1 tool results)
2026-02-04T17:41:02.693373342Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:41:02.693376072Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:41:02.693797519Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:41:02.693801349Z [inf]  Moderation Input check result
2026-02-04T17:41:02.693804129Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_start
2026-02-04T17:41:02.693806949Z [inf]  [ChatWorker] Sent message_start for cml8bd6og00tb8poe9l9eri6e
2026-02-04T17:41:02.693809499Z [inf]  ChatWorker: seeded get_wallet_info from client context
2026-02-04T17:41:02.693811909Z [inf]  ToolPreRouter: Category matched
2026-02-04T17:41:02.694712583Z [inf]  [ChatWorker] Base filtered to 5 tools for message: "Copy Trade 0xffed8b8c0dc8d2b378a75542b0a077263990f..."
2026-02-04T17:41:02.694715273Z [inf]  [ChatWorker] 🔍 RAG check for: "Copy Trade 0xffed8b8c0dc8d2b378a75542b0a077263990f..."
2026-02-04T17:41:02.694717743Z [inf]  [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
2026-02-04T17:41:02.694720443Z [inf]  [ChatWorker] DeepSeek iteration 1/10 for task cml8bd7al00td8poedjrphcsk
2026-02-04T17:41:02.694722753Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:41:02.694725693Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:41:03.090398251Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:41:03.506366895Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:41:04.098594009Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:41:07.287650426Z [inf]  Timer finished: intent_parsing_2c43ca70
2026-02-04T17:41:07.297198757Z [inf]      'mevProtection',
2026-02-04T17:41:07.297201367Z [inf]  Intent follow-up recorded
2026-02-04T17:41:07.297204497Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:41:07.297207117Z [inf]  DeepSeek: routed to mode
2026-02-04T17:41:07.297209957Z [inf]  [ChatWorker] User Settings: {
2026-02-04T17:41:07.297212447Z [inf]    fastSwapMode: true,
2026-02-04T17:41:07.297214757Z [inf]    swapMethod: 'allowance_trade',
2026-02-04T17:41:07.297217887Z [inf]    toolConfig: [
2026-02-04T17:41:07.297223737Z [inf]      'userRole',
2026-02-04T17:41:07.297226527Z [inf]      'defaultSwapAmount',
2026-02-04T17:41:07.297229127Z [inf]      'defaultSwapUnit',
2026-02-04T17:41:07.297231857Z [inf]      'checkTokenBeforeSwap',
2026-02-04T17:41:07.297234487Z [inf]      'showQuoteBeforeSwap',
2026-02-04T17:41:07.297237057Z [inf]      'swapMethod',
2026-02-04T17:41:07.297239697Z [inf]      'slippageMode',
2026-02-04T17:41:07.297242967Z [inf]      'customSlippage',
2026-02-04T17:41:07.297942343Z [inf]      'priceDeviationCheck',
2026-02-04T17:41:07.297947673Z [inf]      'fastSwapMode',
2026-02-04T17:41:07.297951503Z [inf]      'copyTradeTokenCooldownMinutes',
2026-02-04T17:41:07.297956513Z [inf]      'minMarketCapUsd',
2026-02-04T17:41:07.297962033Z [inf]  }
2026-02-04T17:41:07.297962493Z [inf]      'minLiquidityUsd',
2026-02-04T17:41:07.297967903Z [inf]      'minTargetValueUsd',
2026-02-04T17:41:07.297972043Z [inf]  [ChatWorker] Waiting for early pre-fetch to complete
2026-02-04T17:41:07.297975483Z [inf]      'id',
2026-02-04T17:41:07.297978483Z [inf]  [ChatWorker] Detected contract address: 0xffed8b8c0dc8d2b378a75542b0a077263990f8ca
2026-02-04T17:41:07.297984743Z [inf]      'userId',
2026-02-04T17:41:07.297984873Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:41:07.297990363Z [inf]      'quickSwapMode',
2026-02-04T17:41:07.297994003Z [inf]      'copyTradeAIMode',
2026-02-04T17:41:07.297997092Z [inf]      'updatedAt',
2026-02-04T17:41:07.298000782Z [inf]      'createdAt',
2026-02-04T17:41:07.298004112Z [inf]      'zoraNotificationThreshold'
2026-02-04T17:41:07.298007422Z [inf]    ],
2026-02-04T17:41:07.298011042Z [inf]    walletConnected: true,
2026-02-04T17:41:07.298014462Z [inf]    chainId: 8453
2026-02-04T17:41:07.519269147Z [inf]  Timer finished: launchpad_det_0xffed8b8c0dc8d2b378a75542b0a077263990f8ca
2026-02-04T17:41:10.011812969Z [inf]  [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
2026-02-04T17:41:10.011816539Z [inf]  Fetching premium trending tokens
2026-02-04T17:41:10.218717083Z [inf]  WS addresses discovered
2026-02-04T17:41:10.750030401Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T17:41:11.262161135Z [inf]  Processed DexScreener trending candidates
2026-02-04T17:41:11.262166425Z [err]  Error fetching trending tokens
2026-02-04T17:41:11.262169805Z [inf]  Premium trending tokens fetch complete
2026-02-04T17:41:11.262173795Z [inf]  [TokenJob] Got 70 trending tokens for Base
2026-02-04T17:41:11.323636949Z [inf]  Saved 70 trending tokens for base to database and memory cache
2026-02-04T17:41:11.356902095Z [inf]  [TokenJob] Saved 70 tokens for Base to DB + cache
2026-02-04T17:41:14.116746562Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:41:14.788488930Z [err]  GeckoTerminal API error after retries
2026-02-04T17:41:14.891276510Z [inf]  Timer finished: get_token_info_0xffed8b8c0dc8d2b378a75542b0a077263990f8ca_8453
2026-02-04T17:41:14.891283280Z [inf]  Timer finished: prompt_gen_COPY_TRADING_deepseek
2026-02-04T17:41:14.891287880Z [inf]  [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (8 tokens cached)
2026-02-04T17:41:14.891291610Z [inf]  [ChatWorker] No tokenInfo available
2026-02-04T17:41:14.891298650Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:41:14.891302670Z [inf]  [ChatWorker] Enriched user prompt with context for 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T17:41:14.891306900Z [inf]  ChatWorker: client context injected
2026-02-04T17:41:14.891311040Z [inf]  ChatWorker: client balance snapshot summary
2026-02-04T17:41:14.892267344Z [inf]  [ChatWorker] Added client context to system prompt
2026-02-04T17:41:14.892271304Z [inf]  [ChatWorker] Broadcasting Thinking status for cml8bd6og00tb8poe9l9eri6e. Message order: message_start → launchpad_card → Thinking → content_chunks
2026-02-04T17:41:14.892274474Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:41:15.392384722Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:41:17.730351312Z [inf]  [ChatWorker] Detected tool calls in stream, starting pre-fetch...
2026-02-04T17:41:22.510707632Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_usage
2026-02-04T17:41:22.533727191Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:41:22.533730681Z [inf]  [Tool] create_copy_trade_config called: {
2026-02-04T17:41:22.533733541Z [inf]    userId: 'did:privy:cmk74yj4r03jcl70b8hwyuh2c',
2026-02-04T17:41:22.533736922Z [inf]    target_wallet: '0xffed8b8c0dc8d2b378a75542b0a077263990f8ca',
2026-02-04T17:41:22.533740232Z [inf]    buy_amount_usd: 20,
2026-02-04T17:41:22.533743342Z [inf]    take_profit_pct: 300,
2026-02-04T17:41:22.533746782Z [inf]    stop_loss_pct: 40,
2026-02-04T17:41:22.533750102Z [inf]    mirror_sell: true,
2026-02-04T17:41:22.533753652Z [inf]    chain_id: 8453,
2026-02-04T17:41:22.533757082Z [inf]    max_slippage_bps: 300
2026-02-04T17:41:22.533760322Z [inf]  }
2026-02-04T17:41:22.694038520Z [inf]  [Tool] Attempting to add 0xffed8b8c0dc8d2b378a75542b0a077263990f8ca to Alchemy webhook for chain 8453
2026-02-04T17:41:22.694042900Z [inf]  [AlchemyWebhook] addAddressToWebhook called: address=0xffed8b8c0d, chainId=8453
2026-02-04T17:41:22.694048890Z [inf]  [AlchemyWebhook] Using webhook ID: wh_lb0gbao... for chain 8453
2026-02-04T17:41:22.694052120Z [inf]  [AlchemyWebhook] Raw Request Body to Alchemy: {"webhook_id":"wh_lb0gbaogh5ek413o","addresses_to_add":["0xffed8b8c0dc8d2b378a75542b0a077263990f8ca"],"addresses_to_remove":[]}
2026-02-04T17:41:22.694054560Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_client_action
2026-02-04T17:41:22.694056970Z [inf]  [ChatWorker] Broadcasted client action for tool create_copy_trade_config
2026-02-04T17:41:22.716121345Z [inf]  [ChatWorker] DeepSeek iteration 2/10 for task cml8bd7al00td8poedjrphcsk
2026-02-04T17:41:22.716125145Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:41:22.716129415Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:41:22.965197800Z [inf]  incoming request
2026-02-04T17:41:22.965202490Z [inf]  request completed
2026-02-04T17:41:22.965205740Z [inf]  incoming request
2026-02-04T17:41:22.965209190Z [inf]  request completed
2026-02-04T17:41:22.965212330Z [inf]  incoming request
2026-02-04T17:41:22.965215130Z [inf]  request completed
2026-02-04T17:41:23.088947073Z [inf]  [AlchemyWebhook] Added address 0xffed8b8c... to chain 8453 webhook
2026-02-04T17:41:23.237385044Z [inf]  incoming request
2026-02-04T17:41:23.237388384Z [inf]  incoming request
2026-02-04T17:41:23.237391654Z [inf]  incoming request
2026-02-04T17:41:23.237394064Z [inf]  [CopyTrade] GET /positions - Fetching positions for did:privy:cmk74yj4r03jcl70b8hwyuh2c
2026-02-04T17:41:23.237397424Z [inf]  [CopyTrade] GET /configs - Fetching configs for user did:privy:cmk74yj4r03jcl70b8hwyuh2c
2026-02-04T17:41:23.237399934Z [inf]  request completed
2026-02-04T17:41:23.237402324Z [inf]  request completed
2026-02-04T17:41:23.237405094Z [inf]  request completed
2026-02-04T17:41:25.594683417Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:41:25.790496338Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:41:31.086837483Z [inf]  Timer finished: intent_parsing_c496a7e5
2026-02-04T17:41:31.086841423Z [inf]      'checkTokenBeforeSwap',
2026-02-04T17:41:31.086842553Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:41:31.086845533Z [inf]  [ChatWorker] User Settings: {
2026-02-04T17:41:31.086848433Z [inf]    fastSwapMode: true,
2026-02-04T17:41:31.086851083Z [inf]    swapMethod: 'allowance_trade',
2026-02-04T17:41:31.086853083Z [inf]      'showQuoteBeforeSwap',
2026-02-04T17:41:31.086854163Z [inf]    toolConfig: [
2026-02-04T17:41:31.086856513Z [inf]      'userRole',
2026-02-04T17:41:31.086859203Z [inf]      'defaultSwapAmount',
2026-02-04T17:41:31.086860353Z [inf]      'swapMethod',
2026-02-04T17:41:31.086862153Z [inf]      'defaultSwapUnit',
2026-02-04T17:41:31.086863363Z [inf]      'slippageMode',
2026-02-04T17:41:31.086866463Z [inf]      'customSlippage',
2026-02-04T17:41:31.086869344Z [inf]      'mevProtection',
2026-02-04T17:41:31.086872544Z [inf]      'priceDeviationCheck',
2026-02-04T17:41:31.086875234Z [inf]      'fastSwapMode',
2026-02-04T17:41:31.087553529Z [inf]      'copyTradeTokenCooldownMinutes',
2026-02-04T17:41:31.087555989Z [inf]      'minMarketCapUsd',
2026-02-04T17:41:31.087558309Z [inf]      'minLiquidityUsd',
2026-02-04T17:41:31.087560579Z [inf]      'minTargetValueUsd',
2026-02-04T17:41:31.087563249Z [inf]      'id',
2026-02-04T17:41:31.087565929Z [inf]      'userId',
2026-02-04T17:41:31.087569309Z [inf]      'quickSwapMode',
2026-02-04T17:41:31.087571659Z [inf]      'copyTradeAIMode',
2026-02-04T17:41:31.087574129Z [inf]      'updatedAt',
2026-02-04T17:41:31.087576389Z [inf]      'createdAt',
2026-02-04T17:41:31.087578669Z [inf]      'zoraNotificationThreshold'
2026-02-04T17:41:31.087581809Z [inf]    ],
2026-02-04T17:41:31.087584089Z [inf]    walletConnected: true,
2026-02-04T17:41:31.087586229Z [inf]    chainId: 8453
2026-02-04T17:41:31.087588309Z [inf]  }
2026-02-04T17:41:31.087593199Z [inf]  [ChatWorker] Detected contract address: 0xffed8b8c0dc8d2b378a75542b0a077263990f8ca
2026-02-04T17:41:31.087595549Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:41:31.202152839Z [inf]  Timer finished: get_token_info_0xffed8b8c0dc8d2b378a75542b0a077263990f8ca_8453
2026-02-04T17:41:31.202156409Z [inf]  Timer finished: prompt_gen_COPY_TRADING_deepseek
2026-02-04T17:41:31.202163889Z [inf]  [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (8 tokens cached)
2026-02-04T17:41:31.202167449Z [inf]  ChatWorker: requested token balance resolved
2026-02-04T17:41:31.202170918Z [inf]  [ChatWorker] No tokenInfo available
2026-02-04T17:41:31.202174858Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:41:31.202179048Z [inf]  [ChatWorker] Enriched user prompt with context for 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T17:41:31.202524086Z [inf]  ChatWorker: client context injected
2026-02-04T17:41:31.202528836Z [inf]  ChatWorker: client balance snapshot summary
2026-02-04T17:41:31.202531336Z [inf]  [ChatWorker] Added client context to system prompt
2026-02-04T17:41:31.202533766Z [inf]  ChatWorker: balance context attached to system prompt
2026-02-04T17:41:31.202536366Z [inf]  ChatWorker: balance system rule injected
2026-02-04T17:41:31.202539326Z [inf]  [ChatWorker] Broadcasting Thinking status for cml8bd6og00tb8poe9l9eri6e. Message order: message_start → launchpad_card → Thinking → content_chunks
2026-02-04T17:41:31.202541966Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:41:35.906217860Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:41:36.245095346Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:41:37.609582637Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:41:41.417221616Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-04T17:41:41.417225076Z [inf]  Fetching premium trending tokens
2026-02-04T17:41:41.691318708Z [inf]  WS addresses discovered
2026-02-04T17:41:41.929510931Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_usage
2026-02-04T17:41:42.734672624Z [inf]  Processed DexScreener trending candidates
2026-02-04T17:41:42.734675764Z [err]  Error fetching trending tokens
2026-02-04T17:41:42.734678204Z [inf]  Premium trending tokens fetch complete
2026-02-04T17:41:42.734680664Z [inf]  [TokenJob] Got 81 trending tokens for BSC
2026-02-04T17:41:42.780398315Z [inf]  Saved 81 trending tokens for bsc to database and memory cache
2026-02-04T17:41:42.784030592Z [inf]  [TokenJob] Saved 81 tokens for BSC to DB + cache
2026-02-04T17:41:42.794228730Z [inf]  [TokenJob] Refreshed 4 primary chains in 102.0s
2026-02-04T17:41:43.043045697Z [inf]  Moderation Output check result
2026-02-04T17:41:43.090687396Z [inf]  [ChatWorker] Broadcasting message_complete for cml8bd6og00tb8poe9l9eri6e
2026-02-04T17:41:43.091268003Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
2026-02-04T17:41:43.102486824Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:41:43.102490684Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
2026-02-04T17:41:43.354161923Z [inf]  incoming request
2026-02-04T17:41:43.354164963Z [inf]  request completed
2026-02-04T17:41:43.354168133Z [inf]  incoming request
2026-02-04T17:41:43.354173773Z [inf]  request completed
2026-02-04T17:41:43.645932488Z [inf]  incoming request
2026-02-04T17:41:43.645936448Z [inf]  incoming request
2026-02-04T17:41:43.645938848Z [inf]  request completed
2026-02-04T17:41:43.645941298Z [inf]  request completed
2026-02-04T17:41:47.697566127Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:41:48.289880292Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:42:08.293119292Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:42:08.293123952Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:42:08.293128192Z [inf]  incoming request
2026-02-04T17:42:08.293132272Z [inf]  request completed
2026-02-04T17:42:08.293137052Z [inf]  incoming request
2026-02-04T17:42:08.293140922Z [inf]  request completed
2026-02-04T17:42:08.293144482Z [inf]  incoming request
2026-02-04T17:42:08.293148422Z [inf]  request completed
2026-02-04T17:42:08.294274605Z [inf]  incoming request
2026-02-04T17:42:08.294280355Z [inf]  incoming request
2026-02-04T17:42:08.294283995Z [inf]  incoming request
2026-02-04T17:42:08.294287675Z [inf]  [verifyAccess] Checking access: {
2026-02-04T17:42:08.294291145Z [inf]    userId: 'did:privy:cmk74yj4r03jcl70b8hwyuh2c',
2026-02-04T17:42:08.294294955Z [inf]    userIdLength: 35,
2026-02-04T17:42:08.294298235Z [inf]    userIdPrefix: 'did:privy:cmk74yj4r0',
2026-02-04T17:42:08.294301835Z [inf]    requestedAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B'
2026-02-04T17:42:08.294304965Z [inf]  }
2026-02-04T17:42:08.294308245Z [inf]  [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmk74yj4r03jcl70b8hwyuh2c, content=Slippage why is 3 ?...
2026-02-04T17:42:08.294311835Z [inf]  [verifyAccess] ✅ Access granted
2026-02-04T17:42:08.294315315Z [inf]  request completed
2026-02-04T17:42:08.294318875Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:42:08.294869022Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:42:08.294873762Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:42:08.294876722Z [inf]  request completed
2026-02-04T17:42:08.294879242Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:42:08.294882112Z [inf]  request completed
2026-02-04T17:42:08.294885182Z [inf]  incoming request
2026-02-04T17:42:08.294888112Z [inf]  request completed
2026-02-04T17:42:08.294890692Z [inf]  incoming request
2026-02-04T17:42:08.295777956Z [inf]  request completed
2026-02-04T17:42:08.295784256Z [inf]  incoming request
2026-02-04T17:42:08.295788636Z [inf]  request completed
2026-02-04T17:42:08.295793056Z [inf]  incoming request
2026-02-04T17:42:08.295796926Z [inf]  incoming request
2026-02-04T17:42:08.295800366Z [inf]  incoming request
2026-02-04T17:42:08.295803756Z [inf]  request completed
2026-02-04T17:42:08.295807436Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:42:08.296550692Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:42:08.296554852Z [inf]  request completed
2026-02-04T17:42:08.296558721Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:42:08.296562291Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:42:08.296565521Z [inf]  request completed
2026-02-04T17:42:08.296569021Z [err]  [ChatWorker] Sanitizing orphaned tool_calls from message 3 (missing 1 tool results)
2026-02-04T17:42:08.296571811Z [err]  [ChatWorker] Sanitizing orphaned tool_calls from message 5 (missing 1 tool results)
2026-02-04T17:42:08.296574891Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:08.297359677Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:08.297363647Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:08.297366467Z [inf]  Moderation Input check result
2026-02-04T17:42:08.297369727Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_start
2026-02-04T17:42:08.297372567Z [inf]  [ChatWorker] Sent message_start for cml8bel7100xx8poevm9lpvdg
2026-02-04T17:42:08.297375587Z [inf]  ChatWorker: seeded get_wallet_info from client context
2026-02-04T17:42:08.297378387Z [inf]  ToolPreRouter: Category matched
2026-02-04T17:42:08.297854793Z [inf]  [ChatWorker] Base filtered to 4 tools for message: "Slippage why is 3 ?..."
2026-02-04T17:42:08.297857703Z [inf]  [ChatWorker] 🔍 RAG check for: "Slippage why is 3 ?..."
2026-02-04T17:42:08.297860403Z [inf]  [ChatWorker] 🎯 RAG: Match found! Query looks informational.
2026-02-04T17:42:08.297862523Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:08.342615720Z [inf]  [ChatWorker] ℹ️ RAG: No relevant knowledge found in local base.
2026-02-04T17:42:08.342621730Z [inf]  [ChatWorker] DeepSeek iteration 1/10 for task cml8bem1000xz8poegiwz7a6u
2026-02-04T17:42:08.342625409Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:08.347439099Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:08.347450589Z [inf]  Timer finished: intent_parsing_16f79899
2026-02-04T17:42:08.388778637Z [inf]  Intent follow-up recorded
2026-02-04T17:42:08.389873790Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:08.389878970Z [inf]  DeepSeek: routed to mode
2026-02-04T17:42:08.389882460Z [inf]  [ChatWorker] Free intent mode: using 26 thinking tools
2026-02-04T17:42:08.389886110Z [inf]  DeepSeek: thinking mode without skills injection
2026-02-04T17:42:08.389890640Z [inf]  [ChatWorker] User Settings: {
2026-02-04T17:42:08.389893780Z [inf]    fastSwapMode: true,
2026-02-04T17:42:08.389897200Z [inf]    swapMethod: 'allowance_trade',
2026-02-04T17:42:08.389900010Z [inf]    toolConfig: [
2026-02-04T17:42:08.389936829Z [inf]      'userRole',
2026-02-04T17:42:08.389939579Z [inf]      'defaultSwapAmount',
2026-02-04T17:42:08.389942109Z [inf]      'defaultSwapUnit',
2026-02-04T17:42:08.389945610Z [inf]      'checkTokenBeforeSwap',
2026-02-04T17:42:08.389948390Z [inf]      'showQuoteBeforeSwap',
2026-02-04T17:42:08.389951320Z [inf]      'swapMethod',
2026-02-04T17:42:08.390500916Z [inf]  }
2026-02-04T17:42:08.390506186Z [inf]  [ChatWorker] Waiting for early pre-fetch to complete
2026-02-04T17:42:08.390512046Z [inf]  Timer finished: prompt_gen_MARKET_ANALYSIS_deepseek
2026-02-04T17:42:08.390512486Z [inf]      'slippageMode',
2026-02-04T17:42:08.390518606Z [inf]  [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (8 tokens cached)
2026-02-04T17:42:08.390521496Z [inf]      'customSlippage',
2026-02-04T17:42:08.390525226Z [inf]  [ChatWorker] No tokenInfo available
2026-02-04T17:42:08.390528196Z [inf]      'mevProtection',
2026-02-04T17:42:08.390533236Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:08.390534496Z [inf]      'priceDeviationCheck',
2026-02-04T17:42:08.390539696Z [inf]      'fastSwapMode',
2026-02-04T17:42:08.390542906Z [inf]      'copyTradeTokenCooldownMinutes',
2026-02-04T17:42:08.390545746Z [inf]      'minMarketCapUsd',
2026-02-04T17:42:08.390548576Z [inf]      'minLiquidityUsd',
2026-02-04T17:42:08.390551456Z [inf]      'minTargetValueUsd',
2026-02-04T17:42:08.390554786Z [inf]      'id',
2026-02-04T17:42:08.390557956Z [inf]      'userId',
2026-02-04T17:42:08.390562796Z [inf]      'quickSwapMode',
2026-02-04T17:42:08.390566466Z [inf]      'copyTradeAIMode',
2026-02-04T17:42:08.390569536Z [inf]      'updatedAt',
2026-02-04T17:42:08.390572766Z [inf]      'createdAt',
2026-02-04T17:42:08.390576056Z [inf]      'zoraNotificationThreshold'
2026-02-04T17:42:08.390579056Z [inf]    ],
2026-02-04T17:42:08.390582016Z [inf]    walletConnected: true,
2026-02-04T17:42:08.390585616Z [inf]    chainId: 8453
2026-02-04T17:42:08.390917024Z [inf]  [ChatWorker] Enriched user prompt with context for 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T17:42:08.390921294Z [inf]  ChatWorker: client context injected
2026-02-04T17:42:08.390924054Z [inf]  ChatWorker: client balance snapshot summary
2026-02-04T17:42:08.390927574Z [inf]  [ChatWorker] Added client context to system prompt
2026-02-04T17:42:08.390930594Z [inf]  ChatWorker: removed get_wallet_info tool (balance context present)
2026-02-04T17:42:08.390933814Z [inf]  [ChatWorker] Broadcasting Thinking status for cml8bel7100xx8poevm9lpvdg. Message order: message_start → launchpad_card → Thinking → content_chunks
2026-02-04T17:42:08.390936984Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:08.870674239Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:42:09.199007001Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:42:09.748322640Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:42:29.592225084Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:42:29.592230254Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:42:29.592233364Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_usage
2026-02-04T17:42:29.592236584Z [inf]  Moderation Output check result
2026-02-04T17:42:29.592239844Z [inf]  [ChatWorker] Broadcasting message_complete for cml8bel7100xx8poevm9lpvdg
2026-02-04T17:42:29.592242944Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
2026-02-04T17:42:29.592245774Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:29.594168142Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
2026-02-04T17:42:29.594172692Z [inf]  incoming request
2026-02-04T17:42:29.594175692Z [inf]  request completed
2026-02-04T17:42:29.594178562Z [inf]  incoming request
2026-02-04T17:42:29.594181542Z [inf]  request completed
2026-02-04T17:42:29.594185872Z [inf]  incoming request
2026-02-04T17:42:29.594188862Z [inf]  incoming request
2026-02-04T17:42:29.595465604Z [inf]  request completed
2026-02-04T17:42:29.595471464Z [inf]  request completed
2026-02-04T17:42:30.750779878Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:42:31.046550160Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:42:31.106186535Z [inf]  📊 Position P/L check
2026-02-04T17:42:34.783425966Z [inf]  incoming request
2026-02-04T17:42:34.783432196Z [inf]  request completed
2026-02-04T17:42:34.783437346Z [inf]  incoming request
2026-02-04T17:42:34.783442576Z [inf]  request completed
2026-02-04T17:42:34.783447356Z [inf]  incoming request
2026-02-04T17:42:34.783451976Z [inf]  request completed
2026-02-04T17:42:34.906778942Z [inf]  incoming request
2026-02-04T17:42:34.906784852Z [inf]  incoming request
2026-02-04T17:42:34.906788272Z [inf]  incoming request
2026-02-04T17:42:34.911923690Z [inf]  [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmk74yj4r03jcl70b8hwyuh2c, content=Change to 15...
2026-02-04T17:42:34.922921002Z [inf]  request completed
2026-02-04T17:42:35.341539612Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:42:35.615972624Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:42:35.755503221Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:42:35.755507231Z [inf]  request completed
2026-02-04T17:42:35.755511721Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:42:35.755515941Z [inf]  request completed
2026-02-04T17:42:35.920580822Z [inf]  incoming request
2026-02-04T17:42:35.920583502Z [inf]  request completed
2026-02-04T17:42:35.925035895Z [inf]  incoming request
2026-02-04T17:42:36.079744228Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:42:36.079748288Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:42:36.079752158Z [inf]  request completed
2026-02-04T17:42:36.167815900Z [inf]  incoming request
2026-02-04T17:42:36.192700788Z [inf]  request completed
2026-02-04T17:42:37.312999146Z [err]  [ChatWorker] Sanitizing orphaned tool_calls from message 3 (missing 1 tool results)
2026-02-04T17:42:37.313001696Z [err]  [ChatWorker] Sanitizing orphaned tool_calls from message 5 (missing 1 tool results)
2026-02-04T17:42:37.313004226Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:37.313006656Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:37.313009386Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:37.503258863Z [inf]  Moderation Input check result
2026-02-04T17:42:37.503261373Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_start
2026-02-04T17:42:37.503263883Z [inf]  [ChatWorker] Sent message_start for cml8bf8hc00y88poekbu2wrqe
2026-02-04T17:42:37.503266713Z [inf]  ChatWorker: seeded get_wallet_info from client context
2026-02-04T17:42:37.503268923Z [inf]  [ChatWorker] Base filtered to 44 tools for message: "Change to 15..."
2026-02-04T17:42:37.503271103Z [inf]  [ChatWorker] 🔍 RAG check for: "Change to 15..."
2026-02-04T17:42:37.503273733Z [inf]  [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
2026-02-04T17:42:37.503275943Z [inf]  [ChatWorker] DeepSeek iteration 1/10 for task cml8bf8ty00ya8poem1lyupt8
2026-02-04T17:42:37.503278553Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:37.503935009Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:40.800215381Z [inf]  Timer finished: intent_parsing_017670a8
2026-02-04T17:42:40.801092336Z [inf]  Intent follow-up recorded
2026-02-04T17:42:40.801096136Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:40.801099476Z [inf]  DeepSeek: routed to mode
2026-02-04T17:42:40.801102986Z [inf]  [ChatWorker] Free intent mode: using 26 thinking tools
2026-02-04T17:42:40.801106716Z [inf]  DeepSeek: thinking mode without skills injection
2026-02-04T17:42:40.801110346Z [inf]  [ChatWorker] User Settings: {
2026-02-04T17:42:40.801114065Z [inf]    fastSwapMode: true,
2026-02-04T17:42:40.801117395Z [inf]    swapMethod: 'allowance_trade',
2026-02-04T17:42:40.801120355Z [inf]    toolConfig: [
2026-02-04T17:42:40.801123195Z [inf]      'userRole',
2026-02-04T17:42:40.801126515Z [inf]      'defaultSwapAmount',
2026-02-04T17:42:40.802083179Z [inf]  [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (8 tokens cached)
2026-02-04T17:42:40.802093699Z [inf]      'defaultSwapUnit',
2026-02-04T17:42:40.802101009Z [inf]      'checkTokenBeforeSwap',
2026-02-04T17:42:40.802105429Z [inf]      'showQuoteBeforeSwap',
2026-02-04T17:42:40.802108609Z [inf]      'createdAt',
2026-02-04T17:42:40.802110369Z [inf]      'swapMethod',
2026-02-04T17:42:40.802115819Z [inf]      'slippageMode',
2026-02-04T17:42:40.802118739Z [inf]      'zoraNotificationThreshold'
2026-02-04T17:42:40.802123359Z [inf]      'customSlippage',
2026-02-04T17:42:40.802126189Z [inf]    ],
2026-02-04T17:42:40.802130509Z [inf]      'mevProtection',
2026-02-04T17:42:40.802133249Z [inf]    walletConnected: true,
2026-02-04T17:42:40.802137069Z [inf]      'priceDeviationCheck',
2026-02-04T17:42:40.802139659Z [inf]      'fastSwapMode',
2026-02-04T17:42:40.802142649Z [inf]      'copyTradeTokenCooldownMinutes',
2026-02-04T17:42:40.802145279Z [inf]      'minMarketCapUsd',
2026-02-04T17:42:40.802148369Z [inf]    chainId: 8453
2026-02-04T17:42:40.802151919Z [inf]      'minLiquidityUsd',
2026-02-04T17:42:40.802156749Z [inf]  }
2026-02-04T17:42:40.802159689Z [inf]      'minTargetValueUsd',
2026-02-04T17:42:40.802163599Z [inf]  [ChatWorker] Waiting for early pre-fetch to complete
2026-02-04T17:42:40.802166389Z [inf]      'id',
2026-02-04T17:42:40.802172819Z [inf]      'userId',
2026-02-04T17:42:40.802173519Z [inf]  Timer finished: prompt_gen_GENERAL_CHAT_deepseek
2026-02-04T17:42:40.802177809Z [inf]      'quickSwapMode',
2026-02-04T17:42:40.802180699Z [inf]      'copyTradeAIMode',
2026-02-04T17:42:40.802184039Z [inf]      'updatedAt',
2026-02-04T17:42:40.802934644Z [inf]  [ChatWorker] No tokenInfo available
2026-02-04T17:42:40.802938684Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:40.802941984Z [inf]  [ChatWorker] Enriched user prompt with context for 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T17:42:40.802945484Z [inf]  ChatWorker: client context injected
2026-02-04T17:42:40.802948624Z [inf]  ChatWorker: client balance snapshot summary
2026-02-04T17:42:40.802952964Z [inf]  [ChatWorker] Added client context to system prompt
2026-02-04T17:42:40.802956094Z [inf]  ChatWorker: removed get_wallet_info tool (balance context present)
2026-02-04T17:42:40.802959054Z [inf]  [ChatWorker] Broadcasting Thinking status for cml8bf8hc00y88poekbu2wrqe. Message order: message_start → launchpad_card → Thinking → content_chunks
2026-02-04T17:42:40.803616810Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:41.238702290Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:42:41.556832364Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:42:42.402003536Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:42:42.408790575Z [inf]  📊 Position P/L check
2026-02-04T17:42:42.481421210Z [inf]  [ChatWorker] Detected tool calls in stream, starting pre-fetch...
2026-02-04T17:42:43.228746920Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_usage
2026-02-04T17:42:43.238991898Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:43.238995358Z [inf]  [GetTokenPrice] Fetching price for ETH (isAddress: false)...
2026-02-04T17:42:43.272495993Z [inf]  [ChatWorker] DeepSeek iteration 2/10 for task cml8bf8ty00ya8poem1lyupt8
2026-02-04T17:42:43.272498683Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:43.273316248Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:46.641121864Z [inf]  Timer finished: intent_parsing_7528444e
2026-02-04T17:42:46.641126204Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:46.641129904Z [inf]  [ChatWorker] User Settings: {
2026-02-04T17:42:46.641134154Z [inf]    fastSwapMode: true,
2026-02-04T17:42:46.641138544Z [inf]    swapMethod: 'allowance_trade',
2026-02-04T17:42:46.641142474Z [inf]    toolConfig: [
2026-02-04T17:42:46.641145873Z [inf]      'userRole',
2026-02-04T17:42:46.641149223Z [inf]      'defaultSwapAmount',
2026-02-04T17:42:46.641152433Z [inf]      'defaultSwapUnit',
2026-02-04T17:42:46.641156274Z [inf]      'checkTokenBeforeSwap',
2026-02-04T17:42:46.641159564Z [inf]      'showQuoteBeforeSwap',
2026-02-04T17:42:46.641162484Z [inf]      'swapMethod',
2026-02-04T17:42:46.641166124Z [inf]      'slippageMode',
2026-02-04T17:42:46.641169134Z [inf]      'customSlippage',
2026-02-04T17:42:46.641172504Z [inf]      'mevProtection',
2026-02-04T17:42:46.641175614Z [inf]      'priceDeviationCheck',
2026-02-04T17:42:46.642025179Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:46.642028999Z [inf]  [ChatWorker] Enriched user prompt with context for 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T17:42:46.642035439Z [inf]      'fastSwapMode',
2026-02-04T17:42:46.642040109Z [inf]      'copyTradeTokenCooldownMinutes',
2026-02-04T17:42:46.642043109Z [inf]      'minMarketCapUsd',
2026-02-04T17:42:46.642045609Z [inf]      'minLiquidityUsd',
2026-02-04T17:42:46.642048419Z [inf]      'minTargetValueUsd',
2026-02-04T17:42:46.642050899Z [inf]      'id',
2026-02-04T17:42:46.642053579Z [inf]      'userId',
2026-02-04T17:42:46.642056309Z [inf]      'quickSwapMode',
2026-02-04T17:42:46.642059189Z [inf]      'copyTradeAIMode',
2026-02-04T17:42:46.642061669Z [inf]      'updatedAt',
2026-02-04T17:42:46.642064299Z [inf]      'createdAt',
2026-02-04T17:42:46.642066789Z [inf]      'zoraNotificationThreshold'
2026-02-04T17:42:46.642069759Z [inf]    ],
2026-02-04T17:42:46.642072349Z [inf]    walletConnected: true,
2026-02-04T17:42:46.642074609Z [inf]    chainId: 8453
2026-02-04T17:42:46.642077859Z [inf]  }
2026-02-04T17:42:46.642080399Z [inf]  Timer finished: prompt_gen_GENERAL_CHAT_deepseek
2026-02-04T17:42:46.642083069Z [inf]  [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (8 tokens cached)
2026-02-04T17:42:46.642086009Z [inf]  [ChatWorker] No tokenInfo available
2026-02-04T17:42:46.642833033Z [inf]  ChatWorker: client context injected
2026-02-04T17:42:46.642838953Z [inf]  ChatWorker: client balance snapshot summary
2026-02-04T17:42:46.642842623Z [inf]  [ChatWorker] Added client context to system prompt
2026-02-04T17:42:46.642846493Z [inf]  [ChatWorker] Broadcasting Thinking status for cml8bf8hc00y88poekbu2wrqe. Message order: message_start → launchpad_card → Thinking → content_chunks
2026-02-04T17:42:46.642849623Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:52.460676539Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:42:53.156946313Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:42:53.172886115Z [inf]  📊 Position P/L check
2026-02-04T17:42:59.473364463Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_usage
2026-02-04T17:42:59.842878763Z [inf]  Moderation Output check result
2026-02-04T17:42:59.842882263Z [inf]  [ChatWorker] Broadcasting message_complete for cml8bf8hc00y88poekbu2wrqe
2026-02-04T17:42:59.842885673Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
2026-02-04T17:42:59.842889323Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:42:59.842893163Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
2026-02-04T17:43:00.026769588Z [inf]  incoming request
2026-02-04T17:43:00.026776628Z [inf]  request completed
2026-02-04T17:43:00.026780048Z [inf]  incoming request
2026-02-04T17:43:00.026784988Z [inf]  request completed
2026-02-04T17:43:00.264605145Z [inf]  incoming request
2026-02-04T17:43:00.264609585Z [inf]  incoming request
2026-02-04T17:43:00.275906686Z [inf]  request completed
2026-02-04T17:43:00.275911426Z [inf]  request completed
2026-02-04T17:43:03.178241262Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:43:03.488173906Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:43:03.510569430Z [inf]  📊 Position P/L check
2026-02-04T17:43:11.427818497Z [inf]  incoming request
2026-02-04T17:43:11.427821397Z [inf]  request completed
2026-02-04T17:43:11.427824267Z [inf]  incoming request
2026-02-04T17:43:11.427827848Z [inf]  request completed
2026-02-04T17:43:11.427830738Z [inf]  incoming request
2026-02-04T17:43:11.427833298Z [inf]  request completed
2026-02-04T17:43:11.667310473Z [inf]  incoming request
2026-02-04T17:43:11.668374967Z [inf]  incoming request
2026-02-04T17:43:11.668377597Z [inf]  incoming request
2026-02-04T17:43:11.670000577Z [inf]  [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmk74yj4r03jcl70b8hwyuh2c, content=Sure continue...
2026-02-04T17:43:11.670004877Z [inf]  [verifyAccess] Checking access: {
2026-02-04T17:43:11.670007407Z [inf]    userId: 'did:privy:cmk74yj4r03jcl70b8hwyuh2c',
2026-02-04T17:43:11.670009737Z [inf]    userIdLength: 35,
2026-02-04T17:43:11.670013867Z [inf]    userIdPrefix: 'did:privy:cmk74yj4r0',
2026-02-04T17:43:11.670017127Z [inf]    requestedAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B'
2026-02-04T17:43:11.670020907Z [inf]  }
2026-02-04T17:43:11.670730103Z [inf]  [verifyAccess] ✅ Access granted
2026-02-04T17:43:11.681676335Z [inf]  request completed
2026-02-04T17:43:12.871134294Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:43:12.895944342Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:43:12.895946682Z [inf]  request completed
2026-02-04T17:43:12.918219166Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:43:12.918223196Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:43:12.932798857Z [inf]  request completed
2026-02-04T17:43:13.142209337Z [inf]  incoming request
2026-02-04T17:43:13.142213397Z [inf]  request completed
2026-02-04T17:43:13.186976163Z [inf]  incoming request
2026-02-04T17:43:13.186980913Z [inf]  request completed
2026-02-04T17:43:13.210383640Z [inf]  incoming request
2026-02-04T17:43:13.210387480Z [inf]  request completed
2026-02-04T17:43:13.374564137Z [err]  [ChatWorker] Sanitizing orphaned tool_calls from message 3 (missing 1 tool results)
2026-02-04T17:43:13.374568917Z [err]  [ChatWorker] Sanitizing orphaned tool_calls from message 5 (missing 1 tool results)
2026-02-04T17:43:13.374572987Z [err]  [ChatWorker] Sanitizing orphaned tool_calls from message 9 (missing 1 tool results)
2026-02-04T17:43:13.374576617Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:43:13.374580337Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:43:13.374584517Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:43:13.390135752Z [inf]  incoming request
2026-02-04T17:43:13.426736608Z [inf]  incoming request
2026-02-04T17:43:13.442833390Z [inf]  incoming request
2026-02-04T17:43:13.464075719Z [inf]  request completed
2026-02-04T17:43:13.518753705Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:43:13.585526857Z [inf]  Moderation Input check result
2026-02-04T17:43:13.585537297Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_start
2026-02-04T17:43:13.585542407Z [inf]  [ChatWorker] Sent message_start for cml8bg0un00yj8poe0f0lg0mt
2026-02-04T17:43:13.585546167Z [inf]  ChatWorker: seeded get_wallet_info from client context
2026-02-04T17:43:13.585549947Z [inf]  [ChatWorker] Base filtered to 44 tools for message: "Sure continue..."
2026-02-04T17:43:13.585554047Z [inf]  [ChatWorker] 🔍 RAG check for: "Sure continue..."
2026-02-04T17:43:13.585557297Z [inf]  [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
2026-02-04T17:43:13.585560667Z [inf]  [ChatWorker] DeepSeek iteration 1/10 for task cml8bg1lj00yl8poebd7eicca
2026-02-04T17:43:13.585565447Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:43:13.656715001Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:43:13.759606843Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:43:13.759611993Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:43:13.921083835Z [inf]  request completed
2026-02-04T17:43:13.921087615Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:43:13.921090825Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:43:13.921093735Z [inf]  request completed
2026-02-04T17:43:13.954465082Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:43:14.019933731Z [inf]  incoming request
2026-02-04T17:43:14.019936241Z [inf]  request completed
2026-02-04T17:43:14.265444471Z [inf]  incoming request
2026-02-04T17:43:14.553626968Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:43:14.629777703Z [inf]  📊 Position P/L check
2026-02-04T17:43:14.630730927Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:43:14.630734597Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:43:14.632346228Z [inf]  request completed
2026-02-04T17:43:16.514259033Z [inf]  Timer finished: intent_parsing_a408e2bb
2026-02-04T17:43:16.531374969Z [inf]  Intent follow-up recorded
2026-02-04T17:43:16.531380849Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:43:16.531385899Z [inf]  DeepSeek: routed to mode
2026-02-04T17:43:16.531390829Z [inf]  [ChatWorker] Free intent mode: using 26 thinking tools
2026-02-04T17:43:16.531395819Z [inf]  DeepSeek: thinking mode without skills injection
2026-02-04T17:43:16.531400388Z [inf]  [ChatWorker] User Settings: {
2026-02-04T17:43:16.531404208Z [inf]    fastSwapMode: true,
2026-02-04T17:43:16.531408608Z [inf]    swapMethod: 'allowance_trade',
2026-02-04T17:43:16.531412848Z [inf]    toolConfig: [
2026-02-04T17:43:16.531417058Z [inf]      'userRole',
2026-02-04T17:43:16.531421128Z [inf]      'defaultSwapAmount',
2026-02-04T17:43:16.532101834Z [inf]      'defaultSwapUnit',
2026-02-04T17:43:16.532107264Z [inf]      'checkTokenBeforeSwap',
2026-02-04T17:43:16.532112454Z [inf]      'showQuoteBeforeSwap',
2026-02-04T17:43:16.532117424Z [inf]      'swapMethod',
2026-02-04T17:43:16.532122844Z [inf]      'slippageMode',
2026-02-04T17:43:16.532128014Z [inf]      'customSlippage',
2026-02-04T17:43:16.532133194Z [inf]      'mevProtection',
2026-02-04T17:43:16.532137914Z [inf]      'priceDeviationCheck',
2026-02-04T17:43:16.532143244Z [inf]      'fastSwapMode',
2026-02-04T17:43:16.532147774Z [inf]      'copyTradeTokenCooldownMinutes',
2026-02-04T17:43:16.532152184Z [inf]      'minMarketCapUsd',
2026-02-04T17:43:16.532156734Z [inf]      'minLiquidityUsd',
2026-02-04T17:43:16.532161064Z [inf]      'minTargetValueUsd',
2026-02-04T17:43:16.532165744Z [inf]      'id',
2026-02-04T17:43:16.532170164Z [inf]      'userId',
2026-02-04T17:43:16.532175184Z [inf]      'quickSwapMode',
2026-02-04T17:43:16.532179954Z [inf]      'copyTradeAIMode',
2026-02-04T17:43:16.532185274Z [inf]      'updatedAt',
2026-02-04T17:43:16.532190344Z [inf]      'createdAt',
2026-02-04T17:43:16.532195034Z [inf]      'zoraNotificationThreshold'
2026-02-04T17:43:16.532199634Z [inf]    ],
2026-02-04T17:43:16.532204264Z [inf]    walletConnected: true,
2026-02-04T17:43:16.532209094Z [inf]    chainId: 8453
2026-02-04T17:43:16.532213734Z [inf]  }
2026-02-04T17:43:16.532218314Z [inf]  [ChatWorker] Waiting for early pre-fetch to complete
2026-02-04T17:43:16.532222634Z [inf]  Timer finished: prompt_gen_GENERAL_CHAT_deepseek
2026-02-04T17:43:16.532227173Z [inf]  [ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (8 tokens cached)
2026-02-04T17:43:16.532676321Z [inf]  [ChatWorker] No tokenInfo available
2026-02-04T17:43:16.532680771Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:43:16.532684781Z [inf]  [ChatWorker] Enriched user prompt with context for 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T17:43:16.532687161Z [inf]  ChatWorker: client context injected
2026-02-04T17:43:16.532689741Z [inf]  ChatWorker: client balance snapshot summary
2026-02-04T17:43:16.532692971Z [inf]  [ChatWorker] Added client context to system prompt
2026-02-04T17:43:16.532696201Z [inf]  ChatWorker: removed get_wallet_info tool (balance context present)
2026-02-04T17:43:16.532698721Z [inf]  [ChatWorker] Broadcasting Thinking status for cml8bg0un00yj8poe0f0lg0mt. Message order: message_start → launchpad_card → Thinking → content_chunks
2026-02-04T17:43:16.533059568Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:43:24.625962609Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:43:25.546647961Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:43:25.556718880Z [inf]  📊 Position P/L check
2026-02-04T17:43:28.082720430Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_usage
2026-02-04T17:43:28.367587868Z [inf]  Moderation Output check result
2026-02-04T17:43:28.413455858Z [inf]  [ChatWorker] Broadcasting message_complete for cml8bg0un00yj8poe0f0lg0mt
2026-02-04T17:43:28.413462348Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
2026-02-04T17:43:28.424499781Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-04T17:43:28.424502771Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
2026-02-04T17:43:28.690004988Z [inf]  incoming request
2026-02-04T17:43:28.690505815Z [inf]  request completed
2026-02-04T17:43:28.690508745Z [inf]  incoming request
2026-02-04T17:43:28.690511145Z [inf]  request completed
2026-02-04T17:43:28.956429690Z [inf]  incoming request
2026-02-04T17:43:28.956434020Z [inf]  incoming request
2026-02-04T17:43:28.956437970Z [inf]  request completed
2026-02-04T17:43:28.956441820Z [inf]  request completed
2026-02-04T17:43:35.616760602Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:43:35.978990528Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:43:41.418380804Z [inf]  incoming request
2026-02-04T17:43:41.418384334Z [inf]  request completed
2026-02-04T17:43:41.694709255Z [inf]  incoming request
2026-02-04T17:43:41.982927033Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:43:42.322242210Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:43:42.322967256Z [inf]  request completed
2026-02-04T17:43:46.258583484Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:43:46.520216185Z [inf]  incoming request
2026-02-04T17:43:46.520219195Z [inf]  request completed
2026-02-04T17:43:46.520222865Z [inf]  incoming request
2026-02-04T17:43:46.520226125Z [inf]  request completed
2026-02-04T17:43:46.520229725Z [inf]  incoming request
2026-02-04T17:43:46.520233095Z [inf]  request completed
2026-02-04T17:43:46.607765540Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:43:46.771617039Z [inf]  incoming request
2026-02-04T17:43:46.777000356Z [inf]  incoming request
2026-02-04T17:43:46.777005546Z [inf]  incoming request
2026-02-04T17:43:46.777008286Z [inf]  [CopyTrade] GET /positions - Fetching positions for did:privy:cmk74yj4r03jcl70b8hwyuh2c
2026-02-04T17:43:46.777010686Z [inf]  [CopyTrade] GET /configs - Fetching configs for user did:privy:cmk74yj4r03jcl70b8hwyuh2c
2026-02-04T17:43:46.777819251Z [inf]  request completed
2026-02-04T17:43:46.778585036Z [inf]  request completed
2026-02-04T17:43:46.779282342Z [inf]  request completed
2026-02-04T17:43:47.438931701Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:44:07.435622399Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:44:07.435627399Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:44:07.435631349Z [inf]  📊 Position P/L check
2026-02-04T17:44:07.435634999Z [inf]  incoming request
2026-02-04T17:44:07.435638669Z [inf]  request completed
2026-02-04T17:44:07.435642729Z [inf]  incoming request
2026-02-04T17:44:07.435645879Z [inf]  [CopyTrade] DELETE /config/cmkinx90s06e2xvtcl92w5it2 - Request from did:privy:cmk74yj4r03jcl70b8hwyuh2c
2026-02-04T17:44:07.435648989Z [inf]  [CopyTrade] Deleted config: cmkinx90s06e2xvtcl92w5it2
2026-02-04T17:44:07.435652229Z [inf]  request completed
2026-02-04T17:44:07.436236526Z [inf]  [AlchemyWebhook] Removed address 0x1b49e23c... from chain 8453 webhook
2026-02-04T17:44:08.397044074Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:44:08.719899363Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:44:08.746170912Z [inf]  📊 Position P/L check
2026-02-04T17:44:28.743166111Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:44:28.743169841Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:44:28.743172341Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:44:28.743174831Z [inf]  📊 Position P/L check
2026-02-04T17:44:28.743177531Z [inf]  incoming request
2026-02-04T17:44:28.743180092Z [inf]  request completed
2026-02-04T17:44:28.743182892Z [inf]  incoming request
2026-02-04T17:44:28.743185782Z [inf]  request completed
2026-02-04T17:44:28.743801577Z [inf]  incoming request
2026-02-04T17:44:28.743805867Z [inf]  request completed
2026-02-04T17:44:28.743809197Z [inf]  incoming request
2026-02-04T17:44:28.743813477Z [inf]  request completed
2026-02-04T17:44:28.743817047Z [inf]  incoming request
2026-02-04T17:44:28.743821117Z [inf]  request completed
2026-02-04T17:44:28.743824607Z [inf]  incoming request
2026-02-04T17:44:28.743827727Z [inf]  request completed
2026-02-04T17:44:28.744376464Z [inf]  incoming request
2026-02-04T17:44:28.744379234Z [inf]  request completed
2026-02-04T17:44:28.744381984Z [inf]  incoming request
2026-02-04T17:44:28.744385384Z [inf]  request completed
2026-02-04T17:44:28.744387834Z [inf]  incoming request
2026-02-04T17:44:28.744390254Z [inf]  request completed
2026-02-04T17:44:28.744393134Z [inf]  incoming request
2026-02-04T17:44:28.744395844Z [inf]  request completed
2026-02-04T17:44:28.745204689Z [inf]  incoming request
2026-02-04T17:44:28.745209209Z [inf]  request completed
2026-02-04T17:44:28.745212319Z [inf]  incoming request
2026-02-04T17:44:28.745214819Z [inf]  request completed
2026-02-04T17:44:28.745217489Z [inf]  incoming request
2026-02-04T17:44:28.745220109Z [inf]  request completed
2026-02-04T17:44:28.745223009Z [inf]  incoming request
2026-02-04T17:44:28.745225419Z [inf]  request completed
2026-02-04T17:44:28.745747965Z [inf]  incoming request
2026-02-04T17:44:28.745750765Z [inf]  request completed
2026-02-04T17:44:28.745753885Z [inf]  incoming request
2026-02-04T17:44:28.745756235Z [inf]  incoming request
2026-02-04T17:44:28.745759255Z [inf]  incoming request
2026-02-04T17:44:28.745762465Z [inf]  incoming request
2026-02-04T17:44:28.745764815Z [inf]  incoming request
2026-02-04T17:44:28.746330552Z [inf]  incoming request
2026-02-04T17:44:28.746334242Z [inf]  incoming request
2026-02-04T17:44:28.746337772Z [inf]  incoming request
2026-02-04T17:44:28.746340552Z [inf]  incoming request
2026-02-04T17:44:28.746342832Z [inf]  incoming request
2026-02-04T17:44:28.746345212Z [inf]  incoming request
2026-02-04T17:44:28.747012558Z [inf]  request completed
2026-02-04T17:44:28.747017548Z [inf]  request completed
2026-02-04T17:44:28.747020878Z [inf]  incoming request
2026-02-04T17:44:28.747024398Z [inf]  incoming request
2026-02-04T17:44:28.747027858Z [inf]  request completed
2026-02-04T17:44:28.747031358Z [inf]  incoming request
2026-02-04T17:44:28.747035678Z [inf]  request completed
2026-02-04T17:44:28.747039338Z [inf]  incoming request
2026-02-04T17:44:28.747728324Z [inf]  request completed
2026-02-04T17:44:28.747732814Z [inf]  request completed
2026-02-04T17:44:28.747736353Z [inf]  request completed
2026-02-04T17:44:28.747740323Z [inf]  request completed
2026-02-04T17:44:28.747743873Z [inf]  request completed
2026-02-04T17:44:28.747747583Z [inf]  request completed
2026-02-04T17:44:28.747751123Z [inf]  request completed
2026-02-04T17:44:28.747755973Z [inf]  request completed
2026-02-04T17:44:28.747759533Z [inf]  request completed
2026-02-04T17:44:28.747763713Z [inf]  request completed
2026-02-04T17:44:28.748397310Z [inf]  request completed
2026-02-04T17:44:29.685866282Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:44:30.487634954Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:44:30.489017246Z [inf]  📊 Position P/L check
2026-02-04T17:44:31.272455821Z [inf]  incoming request
2026-02-04T17:44:31.486533313Z [inf]  request completed
2026-02-04T17:44:33.525675716Z [inf]  incoming request
2026-02-04T17:44:33.659263720Z [inf]  request completed
2026-02-04T17:44:34.484692067Z [inf]  incoming request
2026-02-04T17:44:34.484697907Z [inf]  incoming request
2026-02-04T17:44:34.485298074Z [inf]  incoming request
2026-02-04T17:44:34.486994174Z [inf]  incoming request
2026-02-04T17:44:34.673753362Z [inf]  request completed
2026-02-04T17:44:34.694068779Z [inf]  request completed
2026-02-04T17:44:34.778583152Z [inf]  request completed
2026-02-04T17:44:34.780048733Z [inf]  request completed
2026-02-04T17:44:40.514151857Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:44:40.897752754Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:44:40.913693486Z [inf]  📊 Position P/L check
2026-02-04T17:44:41.229097500Z [inf]  incoming request
2026-02-04T17:44:41.229100340Z [inf]  incoming request
2026-02-04T17:44:41.229103170Z [inf]  incoming request
2026-02-04T17:44:41.481824006Z [inf]  request completed
2026-02-04T17:44:41.486646916Z [inf]  request completed
2026-02-04T17:44:41.491367518Z [inf]  request completed
2026-02-04T17:44:49.539996777Z [inf]  incoming request
2026-02-04T17:44:49.540000577Z [inf]  request completed
2026-02-04T17:44:49.540005877Z [inf]  incoming request
2026-02-04T17:44:49.540008957Z [inf]  request completed
2026-02-04T17:44:49.756754403Z [inf]  incoming request
2026-02-04T17:44:49.756759063Z [inf]  incoming request
2026-02-04T17:44:49.756763793Z [inf]  request completed
2026-02-04T17:44:50.191102640Z [inf]  [TokenDetails] Fetching holder count for 3xRtfzaCpbQYZPkXvZCwtDq88kYKkmqP1hAhqGtCpump on solana...
2026-02-04T17:44:50.339991120Z [inf]  [TokenDetails] No holder count returned for 3xRtfzaCpbQYZPkXvZCwtDq88kYKkmqP1hAhqGtCpump
2026-02-04T17:44:50.346066693Z [inf]  request completed
2026-02-04T17:44:50.927877460Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:44:51.328280594Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:44:52.188142562Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:45:00.915105242Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-04T17:45:00.919347917Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-04T17:45:00.919351587Z [inf]  Fetching premium trending tokens
2026-02-04T17:45:00.955488766Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-04T17:45:00.955494426Z [inf]  Timer finished: recalc_heat_scores
2026-02-04T17:45:01.184080489Z [inf]  WS addresses discovered
2026-02-04T17:45:02.225383390Z [inf]  Processed DexScreener trending candidates
2026-02-04T17:45:02.225397900Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:45:02.884204257Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:45:08.596045075Z [inf]  Trending tokens fetch complete
2026-02-04T17:45:08.596049985Z [inf]  Premium trending tokens fetch complete
2026-02-04T17:45:08.596054935Z [inf]  [TokenJob] Got 100 trending tokens for Ethereum
2026-02-04T17:45:08.635796501Z [inf]  Saved 100 trending tokens for eth to database and memory cache
2026-02-04T17:45:08.658639972Z [inf]  [TokenJob] Saved 100 tokens for Ethereum to DB + cache
2026-02-04T17:45:12.323127054Z [inf]  incoming request
2026-02-04T17:45:12.324039308Z [inf]  request completed
2026-02-04T17:45:12.576174788Z [inf]  incoming request
2026-02-04T17:45:12.592373850Z [inf]  request completed
2026-02-04T17:45:12.949741717Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:45:12.987800115Z [inf]  incoming request
2026-02-04T17:45:12.987805135Z [inf]  request completed
2026-02-04T17:45:13.288772707Z [inf]  incoming request
2026-02-04T17:45:13.289871941Z [inf]  request completed
2026-02-04T17:45:13.353710120Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:45:33.358902984Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:45:33.358907524Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:45:33.358910524Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:45:33.358913174Z [inf]  incoming request
2026-02-04T17:45:33.358916354Z [inf]  request completed
2026-02-04T17:45:33.358920424Z [inf]  incoming request
2026-02-04T17:45:33.358922734Z [inf]  request completed
2026-02-04T17:45:33.358926014Z [inf]  incoming request
2026-02-04T17:45:33.360063847Z [inf]  request completed
2026-02-04T17:45:33.360069367Z [inf]  incoming request
2026-02-04T17:45:33.360074847Z [inf]  request completed
2026-02-04T17:45:34.719734535Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:45:35.348932673Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:45:38.694124989Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-04T17:45:38.694128959Z [inf]  Fetching premium trending tokens
2026-02-04T17:45:38.943706876Z [inf]  WS addresses discovered
2026-02-04T17:45:40.283657964Z [inf]  Processed DexScreener trending candidates
2026-02-04T17:45:40.283661234Z [inf]  Premium trending tokens fetch complete
2026-02-04T17:45:40.283663784Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-04T17:45:40.283666364Z [inf]  Saved 100 trending tokens for solana to database and memory cache
2026-02-04T17:45:40.283668734Z [inf]  [TokenJob] Saved 100 tokens for Solana to DB + cache
2026-02-04T17:45:42.014385088Z [inf]  incoming request
2026-02-04T17:45:42.015089234Z [inf]  request completed
2026-02-04T17:45:42.015093524Z [inf]  incoming request
2026-02-04T17:45:42.015096474Z [inf]  request completed
2026-02-04T17:45:42.015100524Z [inf]  incoming request
2026-02-04T17:45:42.015103904Z [inf]  request completed
2026-02-04T17:45:42.015766660Z [inf]  incoming request
2026-02-04T17:45:42.015771820Z [inf]  request completed
2026-02-04T17:45:42.262810301Z [inf]  incoming request
2026-02-04T17:45:42.264261892Z [inf]  incoming request
2026-02-04T17:45:42.264266363Z [inf]  incoming request
2026-02-04T17:45:42.264270473Z [inf]  incoming request
2026-02-04T17:45:42.264275003Z [inf]  [CopyTrade] GET /positions - Fetching positions for did:privy:cmk74yj4r03jcl70b8hwyuh2c
2026-02-04T17:45:42.264278803Z [inf]  [verifyAccess] Checking access: {
2026-02-04T17:45:42.264282703Z [inf]    userId: 'did:privy:cmk74yj4r03jcl70b8hwyuh2c',
2026-02-04T17:45:42.264286332Z [inf]    userIdLength: 35,
2026-02-04T17:45:42.264291262Z [inf]    userIdPrefix: 'did:privy:cmk74yj4r0',
2026-02-04T17:45:42.264295222Z [inf]    requestedAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B'
2026-02-04T17:45:42.264299462Z [inf]  }
2026-02-04T17:45:42.264302962Z [inf]  [CopyTrade] GET /configs - Fetching configs for user did:privy:cmk74yj4r03jcl70b8hwyuh2c
2026-02-04T17:45:42.268902224Z [inf]  [verifyAccess] ✅ Access granted
2026-02-04T17:45:42.269591050Z [inf]  request completed
2026-02-04T17:45:42.274354051Z [inf]  request completed
2026-02-04T17:45:42.274357201Z [inf]  request completed
2026-02-04T17:45:43.437557929Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:45:43.875601835Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:45:43.875605765Z [inf]  request completed
2026-02-04T17:45:44.107337850Z [inf]  incoming request
2026-02-04T17:45:44.107342659Z [inf]  request completed
2026-02-04T17:45:44.350564115Z [inf]  incoming request
2026-02-04T17:45:44.651786546Z [err]  Alchemy Portfolio EVM API error
2026-02-04T17:45:44.651790125Z [inf]  Fallback stablecoin balances fetched via RPC
2026-02-04T17:45:44.652019175Z [inf]  request completed
2026-02-04T17:45:45.418553824Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:45:45.852101587Z [inf]  0x API price received successfully
2026-02-04T17:45:45.929597555Z [inf]  incoming request
2026-02-04T17:45:45.929600955Z [inf]  request completed
2026-02-04T17:45:45.929604205Z [inf]  incoming request
2026-02-04T17:45:45.929609115Z [inf]  request completed
2026-02-04T17:45:46.232797134Z [inf]  incoming request
2026-02-04T17:45:46.232800024Z [inf]  incoming request
2026-02-04T17:45:46.232803094Z [inf]  [UserSettings] PUT /api/users/settings for user did:privy:cmk74yj4r03jcl70b8hwyuh2c: {
2026-02-04T17:45:46.232805844Z [inf]    "userRole": "default",
2026-02-04T17:45:46.232808994Z [inf]    "defaultSwapAmount": 100,
2026-02-04T17:45:46.232811954Z [inf]    "defaultSwapUnit": "native",
2026-02-04T17:45:46.232815344Z [inf]    "checkTokenBeforeSwap": true,
2026-02-04T17:45:46.232818714Z [inf]    "showQuoteBeforeSwap": true,
2026-02-04T17:45:46.232822144Z [inf]    "swapMethod": "allowance_trade",
2026-02-04T17:45:46.232825074Z [inf]    "slippageMode": "auto",
2026-02-04T17:45:46.232828743Z [inf]    "customSlippage": 0.5,
2026-02-04T17:45:46.232831923Z [inf]    "mevProtection": true,
2026-02-04T17:45:46.232835083Z [inf]    "priceDeviationCheck": true,
2026-02-04T17:45:46.232837973Z [inf]    "fastSwapMode": false,
2026-02-04T17:45:46.232841963Z [inf]    "copyTradeTokenCooldownMinutes": 60,
2026-02-04T17:45:46.232845363Z [inf]    "minMarketCapUsd": null,
2026-02-04T17:45:46.232848083Z [inf]    "minLiquidityUsd": null,
2026-02-04T17:45:46.232850823Z [inf]    "minTargetValueUsd": null
2026-02-04T17:45:46.232853973Z [inf]  }
2026-02-04T17:45:46.232857623Z [inf]  request completed
2026-02-04T17:45:46.232934023Z [inf]  request completed
2026-02-04T17:45:47.293068720Z [inf]    "checkTokenBeforeSwap": true,
2026-02-04T17:45:47.293079030Z [inf]    "showQuoteBeforeSwap": true,
2026-02-04T17:45:47.293084540Z [inf]    "swapMethod": "allowance_trade",
2026-02-04T17:45:47.293088320Z [inf]    "slippageMode": "custom",
2026-02-04T17:45:47.293092550Z [inf]    "customSlippage": 10,
2026-02-04T17:45:47.293096740Z [inf]    "mevProtection": true,
2026-02-04T17:45:47.293100570Z [inf]    "priceDeviationCheck": true,
2026-02-04T17:45:47.293104040Z [inf]    "fastSwapMode": true,
2026-02-04T17:45:47.293107110Z [inf]    "copyTradeTokenCooldownMinutes": 60,
2026-02-04T17:45:47.293110920Z [inf]    "minMarketCapUsd": 22000,
2026-02-04T17:45:47.293113930Z [inf]    "minLiquidityUsd": null,
2026-02-04T17:45:47.293117540Z [inf]    "minTargetValueUsd": null,
2026-02-04T17:45:47.293120950Z [inf]    "id": "cml5i4gnq00cem112g8f6v08w",
2026-02-04T17:45:47.293125530Z [inf]    "userId": "did:privy:cmk74yj4r03jcl70b8hwyuh2c",
2026-02-04T17:45:47.293129910Z [inf]    "quickSwapMode": false,
2026-02-04T17:45:47.293133230Z [inf]    "copyTradeAIMode": "disabled",
2026-02-04T17:45:47.293137510Z [inf]    "updatedAt": "2026-02-04T17:33:17.835Z",
2026-02-04T17:45:47.293141410Z [inf]    "createdAt": "2026-02-02T18:26:51.351Z",
2026-02-04T17:45:47.293145290Z [inf]    "zoraNotificationThreshold": 5000
2026-02-04T17:45:47.293161160Z [inf]  incoming request
2026-02-04T17:45:47.293164240Z [inf]  [UserSettings] PUT /api/users/settings for user did:privy:cmk74yj4r03jcl70b8hwyuh2c: {
2026-02-04T17:45:47.293167990Z [inf]    "userRole": "default",
2026-02-04T17:45:47.293171900Z [inf]    "defaultSwapAmount": 0.01,
2026-02-04T17:45:47.293174930Z [inf]    "defaultSwapUnit": "native",
2026-02-04T17:45:47.293715087Z [inf]  }
2026-02-04T17:45:47.293717747Z [inf]  request completed
2026-02-04T17:45:55.915906788Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:45:56.341273582Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:45:57.340934830Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:46:01.306794500Z [inf]  incoming request
2026-02-04T17:46:01.306797430Z [inf]  request completed
2026-02-04T17:46:01.546054399Z [inf]  incoming request
2026-02-04T17:46:01.551332857Z [inf]  [UserSettings] PUT /api/users/settings for user did:privy:cmk74yj4r03jcl70b8hwyuh2c: {
2026-02-04T17:46:01.551343307Z [inf]    "userRole": "default",
2026-02-04T17:46:01.551347917Z [inf]    "defaultSwapAmount": 0.01,
2026-02-04T17:46:01.551352127Z [inf]    "defaultSwapUnit": "native",
2026-02-04T17:46:01.551355957Z [inf]    "checkTokenBeforeSwap": true,
2026-02-04T17:46:01.551359707Z [inf]    "showQuoteBeforeSwap": true,
2026-02-04T17:46:01.551365317Z [inf]    "swapMethod": "allowance_trade",
2026-02-04T17:46:01.551368727Z [inf]    "slippageMode": "custom",
2026-02-04T17:46:01.551371947Z [inf]    "customSlippage": 10,
2026-02-04T17:46:01.551376056Z [inf]    "mevProtection": true,
2026-02-04T17:46:01.551380306Z [inf]    "priceDeviationCheck": true,
2026-02-04T17:46:01.551383306Z [inf]    "fastSwapMode": true,
2026-02-04T17:46:01.551386086Z [inf]    "copyTradeTokenCooldownMinutes": 60,
2026-02-04T17:46:01.551389156Z [inf]    "minMarketCapUsd": 22000,
2026-02-04T17:46:01.551392466Z [inf]    "minLiquidityUsd": null,
2026-02-04T17:46:01.551397636Z [inf]    "minTargetValueUsd": null,
2026-02-04T17:46:01.551401196Z [inf]    "id": "cml5i4gnq00cem112g8f6v08w",
2026-02-04T17:46:01.551405086Z [inf]    "userId": "did:privy:cmk74yj4r03jcl70b8hwyuh2c",
2026-02-04T17:46:01.551408646Z [inf]    "quickSwapMode": false,
2026-02-04T17:46:01.551411866Z [inf]    "copyTradeAIMode": "disabled",
2026-02-04T17:46:01.551415636Z [inf]    "updatedAt": "2026-02-04T17:33:17.835Z",
2026-02-04T17:46:01.551418856Z [inf]    "createdAt": "2026-02-02T18:26:51.351Z",
2026-02-04T17:46:01.551421546Z [inf]    "zoraNotificationThreshold": 5000
2026-02-04T17:46:01.551425406Z [inf]  }
2026-02-04T17:46:01.562319369Z [inf]  request completed
2026-02-04T17:46:07.356854057Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:46:07.781614505Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:46:10.362941398Z [inf]  [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
2026-02-04T17:46:10.362945668Z [inf]  Fetching premium trending tokens
2026-02-04T17:46:10.582077070Z [inf]  WS addresses discovered
2026-02-04T17:46:11.498600955Z [inf]  Processed DexScreener trending candidates
2026-02-04T17:46:13.102021939Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T17:46:14.124819116Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T17:46:16.138558324Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T17:46:17.808568910Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:46:18.175205372Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:46:20.657814770Z [err]  Error fetching trending tokens
2026-02-04T17:46:20.657823439Z [inf]  Premium trending tokens fetch complete
2026-02-04T17:46:20.657829389Z [inf]  [TokenJob] Got 73 trending tokens for Base
2026-02-04T17:46:20.697482818Z [inf]  Saved 73 trending tokens for base to database and memory cache
2026-02-04T17:46:20.719736071Z [inf]  [TokenJob] Saved 73 tokens for Base to DB + cache
2026-02-04T17:46:28.428818389Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:46:28.687930727Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:46:28.738863517Z [inf]  ⚡ Uniswap V4 price fetched
2026-02-04T17:46:29.437243564Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:46:49.463518756Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:46:49.463522336Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:46:50.247995009Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:46:50.611498211Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:46:50.734383620Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-04T17:46:50.734388090Z [inf]  Fetching premium trending tokens
2026-02-04T17:46:50.983842388Z [inf]  WS addresses discovered
2026-02-04T17:46:52.090450755Z [inf]  Processed DexScreener trending candidates
2026-02-04T17:46:52.090457005Z [err]  Error fetching trending tokens
2026-02-04T17:46:52.090465905Z [inf]  Premium trending tokens fetch complete
2026-02-04T17:46:52.090469345Z [inf]  [TokenJob] Got 81 trending tokens for BSC
2026-02-04T17:46:52.129734816Z [inf]  Saved 81 trending tokens for bsc to database and memory cache
2026-02-04T17:46:52.141003477Z [inf]  [TokenJob] Saved 81 tokens for BSC to DB + cache
2026-02-04T17:46:52.146218376Z [inf]  [TokenJob] Refreshed 4 primary chains in 111.2s
2026-02-04T17:47:00.668780349Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:47:01.021913534Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:47:01.737051780Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:47:21.733712008Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:47:21.733715378Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:47:22.951639147Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:47:23.350152466Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:47:43.345579877Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:47:43.345584387Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:47:43.345588527Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:47:43.345591537Z [inf]  📊 Position P/L check
2026-02-04T17:47:44.947887822Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:47:45.954881389Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:47:45.955044469Z [inf]  📊 Position P/L check
2026-02-04T17:47:55.821479801Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:47:56.174608947Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:47:56.194108788Z [inf]  📊 Position P/L check
2026-02-04T17:48:16.185904585Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:48:16.185921495Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:48:16.185934154Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:48:16.185937784Z [inf]  📊 Position P/L check
2026-02-04T17:48:17.329695498Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:48:18.443696623Z [inf]  ✅ Hybrid fetch complete
2026-02-04T17:48:18.470549050Z [inf]  📊 Position P/L check
2026-02-04T17:48:38.462634790Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:48:38.462640580Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:48:38.462644400Z [inf]  📊 Position P/L check
2026-02-04T17:48:39.110355570Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T17:48:39.500769239Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T17:48:40.354221394Z [inf]  ✅ Hybrid fetch complete