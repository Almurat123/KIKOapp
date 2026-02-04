2026-02-04T13:43:32.000000000Z [inf]  Starting Container
2026-02-04T13:43:33.281777306Z [inf]  > node dist/index.js
2026-02-04T13:43:33.281790646Z [inf]  
2026-02-04T13:43:33.281966064Z [inf]  
2026-02-04T13:43:33.281969434Z [inf]  > kiko-api@1.0.0 start
2026-02-04T13:43:36.193334698Z [inf]  [Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
2026-02-04T13:43:36.374057525Z [inf]  Zora SDK initialized with API Key
2026-02-04T13:43:36.795542211Z [err]  [SocialJob] Could not find real_hot_users.json in any candidate path
2026-02-04T13:43:37.264308717Z [inf]  [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
2026-02-04T13:43:37.657649013Z [inf]  [SkillRegistry:exec] Loading skills from /app/dist/skills...
2026-02-04T13:43:37.657652333Z [inf]  [SkillRegistry:clean] Loading skills from /app/dist/skills...
2026-02-04T13:43:37.687157771Z [inf]  Serving static files from:
2026-02-04T13:43:37.690235350Z [inf]  Initializing services...
2026-02-04T13:43:37.820114750Z [inf]  [Prisma] DB connection is healthy
2026-02-04T13:43:37.827943563Z [inf]  Database connection successful
2026-02-04T13:43:37.827949253Z [inf]  [DataRetention] Checking retention policies...
2026-02-04T13:43:37.846875235Z [inf]  [DataRetention] Starting cleanup job...
2026-02-04T13:43:37.846880765Z [inf]  Redis initialized
2026-02-04T13:43:37.846884485Z [inf]  Starting server on port 8080...
2026-02-04T13:43:38.398583848Z [inf]  [TokenJob] Scheduled: Secondary chains every 4h (Arbitrum, Optimism, Polygon)
2026-02-04T13:43:38.398596718Z [inf]  [SocialJob] Scheduled: Discovery (30m), Refresh (4h), Scoring (5m)
2026-02-04T13:43:38.398603098Z [inf]  Background jobs started
2026-02-04T13:43:38.398609177Z [inf]  Initializing auto trade service...
2026-02-04T13:43:38.398618327Z [inf]  [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
2026-02-04T13:43:38.398618657Z [inf]  Server listening at http://0.0.0.0:8080
2026-02-04T13:43:38.398624767Z [inf]  Server listening
2026-02-04T13:43:38.398630857Z [inf]  Auto trade service initialized (Solana watcher + EVM webhook enabled)
2026-02-04T13:43:38.398631127Z [inf]  RPC health monitor started
2026-02-04T13:43:38.398636757Z [inf]  RPC benchmark sampling started
2026-02-04T13:43:38.398640847Z [inf]  [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
2026-02-04T13:43:38.398644447Z [inf]  [TokenJob] Scheduled: Primary chains every 5min (Ethereum, Solana, Base, BSC)
2026-02-04T13:43:38.400596948Z [inf]  Auto trade service started
2026-02-04T13:43:38.400599838Z [inf]  [PositionMonitor] Starting position monitor (every 30s)...
2026-02-04T13:43:38.400602628Z [inf]  Position monitor started
2026-02-04T13:43:38.400605438Z [inf]  Token Alert Service started
2026-02-04T13:43:38.400608738Z [inf]  Token alert service started
2026-02-04T13:43:38.400612068Z [inf]  [ChatWorker] Started polling for AI tasks (interval: 3000ms)
2026-02-04T13:43:38.400614868Z [inf]  Chat worker started
2026-02-04T13:43:38.400617548Z [inf]  Starting Global Zora Alpha Detector (API Polling)
2026-02-04T13:43:38.400620618Z [inf]  🎉 All services initialized!
2026-02-04T13:43:38.400623528Z [err]  [DataRetention] No cleanup handler for table: SuggestionEvent
2026-02-04T13:43:38.400626338Z [inf]  [DataRetention] Cleanup job completed.
2026-02-04T13:43:43.341813072Z [inf]  [MarketJob] Running startup staleness check...
2026-02-04T13:43:43.341820091Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:43:43.341824141Z [inf]  [MarketJob] Overview is fresh, skipping API call
2026-02-04T13:43:43.341828091Z [inf]  [MarketJob] Protocols are fresh, skipping API call
2026-02-04T13:43:43.341832141Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-04T13:43:43.341836821Z [err]  [Job] Real hot users file not found: 
2026-02-04T13:43:43.341840842Z [inf]  [Job] ✅ Got 609 quality users from database
2026-02-04T13:43:43.341844492Z [inf]  [SocialJob] fetchCastsFromUsers starting with 609 FIDs, target: 1000
2026-02-04T13:43:43.662027263Z [inf]  0x API price received successfully
2026-02-04T13:43:43.676171102Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T13:43:43.887125328Z [inf]  ⚡ Uniswap V4 price fetched
2026-02-04T13:43:43.887130078Z [inf]  ⚡ Uniswap V4 price fetched
2026-02-04T13:43:44.182230498Z [wrn]  RPC endpoint failed
2026-02-04T13:43:44.237105033Z [wrn]  RPC endpoint failed
2026-02-04T13:43:44.256593839Z [wrn]  RPC endpoint failed
2026-02-04T13:43:44.263814038Z [wrn]  RPC endpoint failed
2026-02-04T13:43:44.356848424Z [wrn]  RPC endpoint failed
2026-02-04T13:43:44.356854734Z [wrn]  RPC endpoint failed
2026-02-04T13:43:44.356859464Z [wrn]  RPC circuit breaker opened
2026-02-04T13:43:44.356863544Z [wrn]  RPC endpoint failed
2026-02-04T13:43:44.465356376Z [wrn]  RPC circuit breaker opened
2026-02-04T13:43:44.465360876Z [wrn]  RPC endpoint failed
2026-02-04T13:43:44.562505462Z [inf]  RPC failover success
2026-02-04T13:43:44.562508282Z [inf]  RPC failover success
2026-02-04T13:43:44.568427303Z [inf]  RPC failover success
2026-02-04T13:43:44.569740571Z [inf]  RPC failover success
2026-02-04T13:43:44.574353354Z [inf]  RPC failover success
2026-02-04T13:43:44.653637197Z [inf]  RPC failover success
2026-02-04T13:43:44.693733779Z [inf]  RPC failover success
2026-02-04T13:43:44.755061200Z [inf]  RPC failover success
2026-02-04T13:43:45.663244192Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:43:45.672819867Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:44:05.677720930Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:44:05.677724230Z [inf]  📊 Position P/L check
2026-02-04T13:44:05.677735320Z [inf]  incoming request
2026-02-04T13:44:05.677738800Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_f9pl0fbd7z5urcs8","createdAt":"2026-02-04T13:44:00.114Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27c781e","hash":"0x6f776b14e4aad5627f14fa8a712c5208072f0335a71f5892278772a5967fdf57","value":0.5,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x6f05b59d3b20000","decimals":18},"blockTimestamp":"0x69834d1f"}],"source":"chainlake-kafka"}}
2026-02-04T13:44:05.677752770Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T13:44:05.677756510Z [inf]  request completed
2026-02-04T13:44:05.677833599Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x6f776b
2026-02-04T13:44:05.677837879Z [inf]  [Profile] fetchReceipt
2026-02-04T13:44:05.678977388Z [inf]  [Profile] fetchTransaction
2026-02-04T13:44:05.678981268Z [err]  [Webhook] Could not fetch tx/receipt: 0x6f776b14e4aad5
2026-02-04T13:44:05.678984558Z [inf]  incoming request
2026-02-04T13:44:05.678987518Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_n0l9y9n2pqyek46r","createdAt":"2026-02-04T13:44:00.162Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","blockNum":"0x27c781e","hash":"0x6f776b14e4aad5627f14fa8a712c5208072f0335a71f5892278772a5967fdf57","value":4297537051.291166,"asset":"stapler","category":"token","rawContract":{"rawValue":"0x00000000000000000000000000000000000000000de2d6de5e0a191c416427f5","address":"0xdf609a199f64af6b286716c33807deda2dfe7b07","decimals":18},"log":{"address":"0xdf609a199f64af6b286716c33807deda2dfe7b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x000000000000000000000000b4beddf1b828aaed9638601f7145b0f6093f2d3f"],"data":"0x00000000000000000000000000000000000000000de2d6de5e0a191c416427f5","blockHash":"0x075de10e30ac7c00d228fe28fa41e81fde672a753de83df5f0df56fd7b416483","blockNumber":"0x27c781e","blockTimestamp":"0x69834d1f","transactionHash":"0x6f776b14e4aad5627f14fa8a712c5208072f0335a71f5892278772a5967fdf57","transactionIndex":"0xd6","logIndex":"0x3bd","removed":false},"blockTimestamp":"0x69834d1f"}],"source":"chainlake-kafka"}}
2026-02-04T13:44:05.680877318Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T13:44:05.680882428Z [inf]  [Webhook] Tx already in processedTxs cache: 0x6f776b14e4aad5
2026-02-04T13:44:05.680886448Z [inf]  request completed
2026-02-04T13:44:05.680889608Z [inf]  incoming request
2026-02-04T13:44:05.680892268Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_hfc3c0jt3z209ejp","createdAt":"2026-02-04T13:44:01.886Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xb4beddf1b828aaed9638601f7145b0f6093f2d3f","toAddress":"0xdf609a199f64af6b286716c33807deda2dfe7b07","blockNum":"0x27c781f","hash":"0xd7d07d29257e3b518b47755e878efc15e2e656aef28ccdcc714dc2c9a0e8f23e","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x69834d21"}],"source":"chainlake-kafka"}}
2026-02-04T13:44:05.680895458Z [inf]  request completed
2026-02-04T13:44:05.680898678Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T13:44:05.680901628Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0xd7d07d
2026-02-04T13:44:05.680904358Z [inf]  [Profile] fetchReceipt
2026-02-04T13:44:05.680907218Z [inf]  [Profile] fetchTransaction
2026-02-04T13:44:05.683018377Z [err]  [Webhook] Could not fetch tx/receipt: 0xd7d07d29257e3b
2026-02-04T13:44:06.360345566Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:44:06.378451015Z [inf]  📊 Position P/L check
2026-02-04T13:44:08.351645752Z [inf]  [TokenJob] Starting initial token refresh...
2026-02-04T13:44:08.351649392Z [inf]  [TokenJob] Tokens for Ethereum are fresh, skipping API call
2026-02-04T13:44:16.379659108Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:44:16.955139106Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T13:44:16.979159227Z [inf]  0x API price received successfully
2026-02-04T13:44:19.339556354Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:44:19.349192478Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:44:19.457099935Z [inf]  📊 Position P/L check
2026-02-04T13:44:39.052010569Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:44:39.052014349Z [inf]  📊 Position P/L check
2026-02-04T13:44:39.052029978Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:44:39.392663218Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:44:39.392667458Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:44:39.581500559Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:44:39.581504369Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:44:39.714952000Z [inf]  📊 Position P/L check
2026-02-04T13:44:39.793358510Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:44:39.924155507Z [inf]  Alpha Detector: Checking new coin