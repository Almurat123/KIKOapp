2026-02-03T02:56:24.941612214Z [err]  2026-02-03 02:56:19.104 UTC [27] LOG:  checkpoint starting: time
2026-02-03T02:56:26.274166386Z [err]  Error fetching trending tokens
2026-02-03T02:56:26.274171636Z [inf]  Premium trending tokens fetch complete
2026-02-03T02:56:26.274175346Z [inf]  [TokenJob] Got 31 trending tokens for BSC
2026-02-03T02:56:26.274178476Z [err]  [TokenJob] New list too small (31) for BSC; keeping existing (100)
2026-02-03T02:56:28.792784989Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T02:56:48.790215242Z [err]  Error fetching trending tokens
2026-02-03T02:56:48.790215512Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T02:56:48.790221262Z [inf]  Saved 5 trending tokens for arbitrum to database and memory cache
2026-02-03T02:56:48.790226642Z [inf]  [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
2026-02-03T02:56:48.790232602Z [inf]  Fetching premium trending tokens
2026-02-03T02:56:48.790237212Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T02:56:48.790250772Z [inf]  Processed DexScreener trending candidates
2026-02-03T02:56:48.790255102Z [err]  Error fetching trending tokens
2026-02-03T02:56:48.790260262Z [inf]  Premium trending tokens fetch complete
2026-02-03T02:56:48.790264112Z [inf]  [TokenJob] DexScreener returned 5 tokens, trying GeckoTerminal fallback...
2026-02-03T02:56:48.790268172Z [inf]  [TokenJob] Got 5 trending tokens for Arbitrum
2026-02-03T02:56:48.790749916Z [inf]  [TokenJob] Saved 5 tokens for Arbitrum to DB + cache
2026-02-03T02:56:49.034748408Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T02:56:49.680119692Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T02:56:49.680123882Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T02:56:49.680135942Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T02:56:49.680139062Z [inf]  ✅ Hybrid fetch complete
2026-02-03T02:56:49.845844104Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T02:56:49.845850274Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T02:56:49.845854384Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T02:56:49.845858444Z [inf]  ✅ Hybrid fetch complete
2026-02-03T02:57:05.473402584Z [err]  2026-02-03 02:56:59.596 UTC [27] LOG:  checkpoint complete: wrote 404 buffers (2.5%); 0 WAL file(s) added, 0 removed, 0 recycled; write=40.393 s, sync=0.030 s, total=40.492 s; sync files=42, longest=0.015 s, average=0.001 s; distance=2343 kB, estimate=3522 kB; lsn=3/3BD6F9D0, redo lsn=3/3BD51898
2026-02-03T02:57:09.830097544Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T02:57:09.830102264Z [inf]  📊 Position P/L check
2026-02-03T02:57:09.830106474Z [err]  [DBLock] Lock already held {
2026-02-03T02:57:09.830110434Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T02:57:09.830114294Z [err]    expiresAt: '2026-01-29T11:00:40.912Z',
2026-02-03T02:57:09.830119724Z [err]    ageMs: 403226417
2026-02-03T02:57:09.830123564Z [err]  }
2026-02-03T02:57:09.830127754Z [err]  [DBLock] Potential stale lock detected {
2026-02-03T02:57:09.830131614Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T02:57:09.830134814Z [err]    ageMs: 403226417,
2026-02-03T02:57:09.830138543Z [err]    ttlSeconds: 240
2026-02-03T02:57:09.830141833Z [err]  }
2026-02-03T02:57:09.830145483Z [inf]  [TokenJob] Skipping refresh for Optimism - another instance holds the lock
2026-02-03T02:57:10.084174871Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T02:57:10.281025230Z [inf]  📊 Position P/L check
2026-02-03T02:57:20.214772739Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T02:57:21.438939722Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T02:57:21.438944082Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T02:57:21.564555417Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T02:57:21.564559777Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T02:57:21.908808527Z [inf]  0x API price received successfully
2026-02-03T02:57:21.908814788Z [err]  Critical: No valid price data available
2026-02-03T02:57:21.983406079Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T02:57:21.983408979Z [err]  Critical: No valid price data available
2026-02-03T02:57:22.106626269Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T02:57:22.106632679Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T02:57:27.407933669Z [err]  [DBLock] Lock already held {
2026-02-03T02:57:27.407947719Z [err]    key: 'lock:tokenJob:refresh:polygon',
2026-02-03T02:57:27.407953859Z [err]    expiresAt: '2026-01-29T04:35:55.102Z',
2026-02-03T02:57:27.407958979Z [err]    ageMs: 426332228
2026-02-03T02:57:27.407963659Z [err]  }
2026-02-03T02:57:27.407968529Z [err]  [DBLock] Potential stale lock detected {
2026-02-03T02:57:27.407973829Z [err]    key: 'lock:tokenJob:refresh:polygon',
2026-02-03T02:57:27.407978389Z [err]    ageMs: 426332228,
2026-02-03T02:57:27.407989679Z [err]    ttlSeconds: 240
2026-02-03T02:57:27.407995019Z [err]  }
2026-02-03T02:57:27.408000038Z [inf]  [TokenJob] Skipping refresh for Polygon - another instance holds the lock
2026-02-03T02:57:27.408004998Z [inf]  [TokenJob] Refreshed 7 chains in 146.9s
2026-02-03T02:57:32.098019009Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T02:57:33.131226356Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T02:57:33.131231816Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T02:57:33.388647739Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T02:57:33.388654789Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T02:57:33.420275360Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T02:57:33.420281590Z [inf]  ✅ Hybrid fetch complete
2026-02-03T02:57:33.544391512Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T02:57:33.544397022Z [inf]  ✅ Hybrid fetch complete
2026-02-03T02:57:33.658700568Z [inf]  📊 Position P/L check
2026-02-03T02:57:53.659233906Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T02:57:53.659237796Z [inf]  📊 Position P/L check
2026-02-03T02:57:53.850580579Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T02:57:53.985336688Z [inf]  📊 Position P/L check
2026-02-03T02:58:13.998601577Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T02:58:13.998608197Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T02:58:13.998611957Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T02:58:13.998615517Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T02:58:13.998618777Z [inf]  ✅ Hybrid fetch complete
2026-02-03T02:58:13.998622337Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T02:58:13.998625757Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T02:58:13.998628907Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T02:58:13.998954363Z [inf]  ✅ Hybrid fetch complete
2026-02-03T02:58:15.110731670Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T02:58:20.598680684Z [inf]  incoming request
2026-02-03T02:58:20.598685554Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_4uop2elzs2cg7j0b","createdAt":"2026-02-03T02:58:20.080Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","blockNum":"0x27b83b4","hash":"0x8d6da069b34bc1b44d386cd868ea2136d2e6430f5901d085364f700316009d4e","value":1163993224.4885056,"asset":"PLAYER","category":"token","rawContract":{"rawValue":"0x000000000000000000000000000000000000000003c2d527232f6a8cf6b89499","address":"0xcf6457a92da63cca3f9a50f4d4c601a98f633b07","decimals":18},"log":{"address":"0xcf6457a92da63cca3f9a50f4d4c601a98f633b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x0000000000000000000000004f67f52147c6bc03563772fa3d7af3adffb92110"],"data":"0x000000000000000000000000000000000000000003c2d527232f6a8cf6b89499","blockHash":"0xbc4f908bcbe00e443a3bb68b46ef849b2a610b4489fd8987b63fbc409fe8225b","blockNumber":"0x27b83b4","blockTimestamp":"0x6981644b","transactionHash":"0x8d6da069b34bc1b44d386cd868ea2136d2e6430f5901d085364f700316009d4e","transactionIndex":"0xa6","logIndex":"0x2ba","removed":false},"blockTimestamp":"0x6981644b"}],"source":"chainlake-kafka"}}
2026-02-03T02:58:20.598691434Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T02:58:20.598695374Z [inf]  request completed
2026-02-03T02:58:20.605880708Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x8d6da0
2026-02-03T02:58:20.703465775Z [inf]  incoming request
2026-02-03T02:58:20.703469915Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_emuhgmh540ax0hvc","createdAt":"2026-02-03T02:58:19.985Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27b83b4","hash":"0x8d6da069b34bc1b44d386cd868ea2136d2e6430f5901d085364f700316009d4e","value":0.3,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x429d069189e0000","decimals":18},"blockTimestamp":"0x6981644b"}],"source":"chainlake-kafka"}}
2026-02-03T02:58:20.703473395Z [inf]  request completed
2026-02-03T02:58:20.703476525Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T02:58:20.703479935Z [inf]  [Webhook] Tx already in processedTxs cache: 0x8d6da069b34bc1
2026-02-03T02:58:20.728726044Z [inf]  Swap successfully decoded from logs
2026-02-03T02:58:20.728729654Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x4f67f521: {
2026-02-03T02:58:20.728733244Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-03T02:58:20.728736314Z [inf]    tokenOut: '0xcf6457a92da63cca3f9a50f4d4c601a98f633b07',
2026-02-03T02:58:20.728739674Z [inf]    dex: 'Unknown DEX'
2026-02-03T02:58:20.728742374Z [inf]  }
2026-02-03T02:58:20.728745144Z [inf]  Swap detected on target wallet
2026-02-03T02:58:20.728747724Z [inf]  Target is buying - triggering copy trade
2026-02-03T02:58:20.857220872Z [err]  LaunchpadDetector: Failed to load Paragraph SDK
2026-02-03T02:58:21.056332914Z [inf]  Timer finished: launchpad_det_0xcf6457a92da63cca3f9a50f4d4c601a98f633b07
2026-02-03T02:58:21.549676793Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T02:58:21.549679803Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T02:58:21.918991397Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T02:58:21.918993907Z [inf]  ✅ Hybrid fetch complete
2026-02-03T02:58:21.918996807Z [inf]  🔥 Warming up 1 user settings
2026-02-03T02:58:21.946081818Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-03T02:58:21.946092898Z [inf]  📊 Mass Copy Trade Analysis
2026-02-03T02:58:21.946098538Z [inf]  📦 Processing batch 1/1
2026-02-03T02:58:22.035608540Z [inf]  Skipping trade: Insufficient gas buffer
2026-02-03T02:58:22.035614970Z [inf]  [Warpcast] Sending DM to FID 877398: "⏭️ Copy Trade Skipped: $PLAYER
2026-02-03T02:58:22.035618960Z [inf]  
2026-02-03T02:58:22.035622510Z [inf]  ⏭️ **COPY TRADE SK..."
2026-02-03T02:58:22.138777239Z [inf]  incoming request
2026-02-03T02:58:22.138781629Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_kv40yr8qf1ciy2ov","createdAt":"2026-02-03T02:58:21.950Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0xcf6457a92da63cca3f9a50f4d4c601a98f633b07","blockNum":"0x27b83b5","hash":"0x9ce893bcd3fb26cd7c67fdbe1fb776e2a05bdad862aeb432e76835ee1fcf87e8","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x6981644d"}],"source":"chainlake-kafka"}}
2026-02-03T02:58:22.138784759Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T02:58:22.138787289Z [inf]  request completed
2026-02-03T02:58:22.143127202Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x9ce893
2026-02-03T02:58:22.249986030Z [inf]  [Webhook] Not a swap tx for 0x4f67f521: 0x9ce893bcd3fb26
2026-02-03T02:58:22.533994936Z [inf]  [Warpcast] DM sent successfully. Daily usage: 25/50000
2026-02-03T02:58:22.534009886Z [inf]  ✅ Smart batch execution complete
2026-02-03T02:58:25.230437508Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T02:58:45.228924454Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T02:58:45.228930584Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T02:58:45.228934774Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T02:58:45.228938814Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T02:58:45.228942704Z [inf]  ✅ Hybrid fetch complete
2026-02-03T02:58:45.228946344Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T02:58:45.228950084Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T02:58:45.228954004Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T02:58:45.229838285Z [inf]  ✅ Hybrid fetch complete
2026-02-03T02:58:47.096647539Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T02:59:07.092245716Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T02:59:07.092248356Z [inf]  📊 Position P/L check
2026-02-03T02:59:07.363066159Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T02:59:08.641408056Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T02:59:08.641412356Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T02:59:08.641416336Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T02:59:08.641420336Z [inf]  ✅ Hybrid fetch complete
2026-02-03T02:59:08.706791939Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T02:59:08.706796099Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T02:59:08.706799179Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T02:59:08.706801959Z [inf]  ✅ Hybrid fetch complete
2026-02-03T02:59:08.847689037Z [inf]  📊 Position P/L check
2026-02-03T02:59:18.837530015Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T02:59:18.960038139Z [inf]  📊 Position P/L check
2026-02-03T02:59:38.959433072Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T02:59:38.959437252Z [inf]  📊 Position P/L check
2026-02-03T02:59:39.088732054Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T02:59:40.160548029Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T02:59:40.160550779Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T02:59:40.464446931Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T02:59:40.464453041Z [inf]  ✅ Hybrid fetch complete
2026-02-03T02:59:40.490462534Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T02:59:40.490468694Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T02:59:40.806045563Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T02:59:40.806050193Z [inf]  ✅ Hybrid fetch complete
2026-02-03T02:59:40.887487976Z [inf]  📊 Position P/L check
2026-02-03T02:59:44.785776538Z [inf]  incoming request
2026-02-03T02:59:44.785779368Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_ha7qsnbjtwxpzgyy","createdAt":"2026-02-03T02:59:43.970Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27b83de","hash":"0x3a4f3cd2ce38cbe46aff164831664d34687af6a34087958302b5e87565a899a8","value":0.3,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x429d069189e0000","decimals":18},"blockTimestamp":"0x6981649f"}],"source":"chainlake-kafka"}}
2026-02-03T02:59:44.785782638Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T02:59:44.785785308Z [inf]  request completed
2026-02-03T02:59:44.785787708Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x3a4f3c
2026-02-03T02:59:44.785790528Z [inf]  Swap successfully decoded from logs
2026-02-03T02:59:44.785793978Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x4f67f521: {
2026-02-03T02:59:44.785796598Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-03T02:59:44.785799478Z [inf]    tokenOut: '0xa9fee7b2f54781a14c85a1b8815345aefbe1eb07',
2026-02-03T02:59:44.785802418Z [inf]    dex: 'Unknown DEX'
2026-02-03T02:59:44.787196993Z [inf]  }
2026-02-03T02:59:44.787202363Z [inf]  Swap detected on target wallet
2026-02-03T02:59:44.787206663Z [inf]  Target is buying - triggering copy trade
2026-02-03T02:59:44.813466223Z [inf]  incoming request
2026-02-03T02:59:44.813478652Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_jfrd2vgce0vvz6dr","createdAt":"2026-02-03T02:59:44.072Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","blockNum":"0x27b83de","hash":"0x3a4f3cd2ce38cbe46aff164831664d34687af6a34087958302b5e87565a899a8","value":1633166532.1988263,"asset":"Lumen","category":"token","rawContract":{"rawValue":"0x00000000000000000000000000000000000000000546ec771cadf30134ff9be6","address":"0xa9fee7b2f54781a14c85a1b8815345aefbe1eb07","decimals":18},"log":{"address":"0xa9fee7b2f54781a14c85a1b8815345aefbe1eb07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x0000000000000000000000004f67f52147c6bc03563772fa3d7af3adffb92110"],"data":"0x00000000000000000000000000000000000000000546ec771cadf30134ff9be6","blockHash":"0x015e13925cede9e0b8b24c3110e34e556cfaa03bcb51489a64a0c409198d08e0","blockNumber":"0x27b83de","blockTimestamp":"0x6981649f","transactionHash":"0x3a4f3cd2ce38cbe46aff164831664d34687af6a34087958302b5e87565a899a8","transactionIndex":"0xc8","logIndex":"0x2c3","removed":false},"blockTimestamp":"0x6981649f"}],"source":"chainlake-kafka"}}
2026-02-03T02:59:44.813483732Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T02:59:44.813518332Z [inf]  [Webhook] Tx already in processedTxs cache: 0x3a4f3cd2ce38cb
2026-02-03T02:59:44.813523672Z [inf]  request completed
2026-02-03T02:59:44.981086888Z [err]  LaunchpadDetector: Failed to load Paragraph SDK
2026-02-03T02:59:45.137786360Z [inf]  Timer finished: launchpad_det_0xa9fee7b2f54781a14c85a1b8815345aefbe1eb07
2026-02-03T02:59:45.459317445Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T02:59:45.459322785Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T02:59:45.836815745Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T02:59:45.836818605Z [inf]  ✅ Hybrid fetch complete
2026-02-03T02:59:45.836822075Z [inf]  🔥 Warming up 1 user settings
2026-02-03T02:59:45.836825415Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-03T02:59:45.836828215Z [inf]  📊 Mass Copy Trade Analysis
2026-02-03T02:59:45.836830885Z [inf]  📦 Processing batch 1/1
2026-02-03T02:59:45.940510780Z [inf]  Skipping trade: Insufficient gas buffer
2026-02-03T02:59:45.940514360Z [inf]  [Warpcast] Sending DM to FID 877398: "⏭️ Copy Trade Skipped: $Lumen
2026-02-03T02:59:45.940517390Z [inf]  
2026-02-03T02:59:45.940520830Z [inf]  ⏭️ **COPY TRADE SKI..."
2026-02-03T02:59:46.383921799Z [inf]  [Warpcast] DM sent successfully. Daily usage: 26/50000
2026-02-03T02:59:46.383924529Z [inf]  ✅ Smart batch execution complete
2026-02-03T02:59:46.443117969Z [inf]  incoming request
2026-02-03T02:59:46.443123289Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_m2b35uoevfh1b9oa","createdAt":"2026-02-03T02:59:45.932Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0xa9fee7b2f54781a14c85a1b8815345aefbe1eb07","blockNum":"0x27b83df","hash":"0x71edc5635e22805e302038376334e4cbd400bf8ce8f6b837aa05980fdba33f01","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x698164a1"}],"source":"chainlake-kafka"}}
2026-02-03T02:59:46.443127239Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T02:59:46.443656013Z [inf]  request completed
2026-02-03T02:59:46.448833497Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x71edc5
2026-02-03T02:59:46.556169385Z [inf]  [Webhook] Not a swap tx for 0x4f67f521: 0x71edc5635e2280
2026-02-03T02:59:50.885086351Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:00:00.823700582Z [inf]  [MarketJob] Fetching chain metrics from Dune...
2026-02-03T03:00:00.823706152Z [inf]  Fetching chain metrics from 3 Dune queries: 6250722, 6240250, 6254391
2026-02-03T03:00:00.823710312Z [err]  [Job] Real hot users file not found: 
2026-02-03T03:00:00.823714872Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-03T03:00:00.823721402Z [inf]  [Job] ✅ Got 562 quality users from database
2026-02-03T03:00:00.823726372Z [inf]  [SocialJob] fetchCastsFromUsers starting with 562 FIDs, target: 1000
2026-02-03T03:00:00.823730222Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-03T03:00:00.823734642Z [inf]  Timer finished: recalc_heat_scores
2026-02-03T03:00:00.823738752Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-03T03:00:00.823742602Z [inf]  Fetching premium trending tokens
2026-02-03T03:00:00.823746852Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:00:01.015052786Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:00:01.349303839Z [inf]  All Dune chain queries completed in 661ms
2026-02-03T03:00:01.349318919Z [inf]  Processing 46 rows from query 6250722
2026-02-03T03:00:01.349328899Z [inf]  Processing 5 rows from query 6240250
2026-02-03T03:00:01.349334139Z [inf]  Processing 1 rows from query 6254391
2026-02-03T03:00:01.349339929Z [inf]  Fetching contracts data from query 6256459
2026-02-03T03:00:01.614733024Z [inf]  Processing 32 contract rows
2026-02-03T03:00:01.614740884Z [inf]  Successfully fetched metrics for 52 chains from 52 total rows
2026-02-03T03:00:01.614745044Z [inf]  [MarketJob] Fetched metrics for 52 chains from Dune
2026-02-03T03:00:01.668771878Z [inf]  [DeFiLlama] Starting with 52 Dune chains
2026-02-03T03:00:01.668774718Z [inf]  [DeFiLlama] Enriched Dune chain "mantle" (Display: "Mantle") -> "Mantle" with TVL: $0.27B
2026-02-03T03:00:01.668778348Z [inf]  [DeFiLlama] Enriched Dune chain "bnb" (Display: "BSC") -> "BSC" with TVL: $6.18B
2026-02-03T03:00:01.668782668Z [inf]  [DeFiLlama] Enriched Dune chain "ethereum" (Display: "Ethereum") -> "Ethereum" with TVL: $60.33B
2026-02-03T03:00:01.668786318Z [inf]  [DeFiLlama] Enriched Dune chain "base" (Display: "Base") -> "Base" with TVL: $4.28B
2026-02-03T03:00:01.668790618Z [inf]  [DeFiLlama] Enriched Dune chain "arbitrum" (Display: "Arbitrum") -> "Arbitrum" with TVL: $2.48B
2026-02-03T03:00:01.668795028Z [inf]  [DeFiLlama] Enriched Dune chain "avalanche_c" (Display: "Avalanche") -> "Avalanche" with TVL: $0.97B
2026-02-03T03:00:01.668798908Z [inf]  [DeFiLlama] Enriched Dune chain "hyperevm" (Display: "Hyperliquid L1") -> "Hyperliquid L1" with TVL: $1.55B
2026-02-03T03:00:01.668802748Z [inf]  [DeFiLlama] Enriched Dune chain "polygon" (Display: "Polygon") -> "Polygon" with TVL: $1.19B
2026-02-03T03:00:01.668806358Z [inf]  [DeFiLlama] Enriched Dune chain "celo" (Display: "Celo") -> "Celo" with TVL: $0.04B
2026-02-03T03:00:01.668810238Z [inf]  [DeFiLlama] Enriched Dune chain "unichain" (Display: "Unichain") -> "Unichain" with TVL: $0.07B
2026-02-03T03:00:01.668814888Z [inf]  [DeFiLlama] Enriched Dune chain "optimism" (Display: "OP Mainnet") -> "OP Mainnet" with TVL: $0.25B
2026-02-03T03:00:01.668818437Z [inf]  [DeFiLlama] Enriched Dune chain "linea" (Display: "Linea") -> "Linea" with TVL: $0.13B
2026-02-03T03:00:01.668822287Z [inf]  [DeFiLlama] Enriched Dune chain "plasma" (Display: "Plasma") -> "Plasma" with TVL: $2.98B
2026-02-03T03:00:01.668826127Z [inf]  [DeFiLlama] Enriched Dune chain "berachain" (Display: "Berachain") -> "Berachain" with TVL: $0.10B
2026-02-03T03:00:01.668829687Z [inf]  [DeFiLlama] Enriched Dune chain "katana" (Display: "Katana") -> "Katana" with TVL: $0.34B
2026-02-03T03:00:01.669404052Z [inf]  [DeFiLlama] Enriched Dune chain "sei" (Display: "Sei") -> "Sei" with TVL: $0.12B
2026-02-03T03:00:01.669410412Z [inf]  [DeFiLlama] Enriched Dune chain "gnosis" (Display: "Gnosis") -> "Gnosis" with TVL: $0.12B
2026-02-03T03:00:01.669415742Z [inf]  [DeFiLlama] Enriched Dune chain "sonic" (Display: "Sonic") -> "Sonic" with TVL: $0.05B
2026-02-03T03:00:01.669421422Z [inf]  [DeFiLlama] Enriched Dune chain "ink" (Display: "Ink") -> "Ink" with TVL: $0.46B
2026-02-03T03:00:01.669426052Z [inf]  [DeFiLlama] Enriched Dune chain "plume" (Display: "Plume Mainnet") -> "Plume Mainnet" with TVL: $0.02B
2026-02-03T03:00:01.669431111Z [inf]  [DeFiLlama] Enriched Dune chain "abstract" (Display: "Abstract") -> "Abstract" with TVL: $0.02B
2026-02-03T03:00:01.669437521Z [inf]  [DeFiLlama] Enriched Dune chain "zksync" (Display: "ZKsync Era") -> "ZKsync Era" with TVL: $0.03B
2026-02-03T03:00:01.669442701Z [inf]  [DeFiLlama] Enriched Dune chain "story" (Display: "Story") -> "Story" with TVL: $0.00B
2026-02-03T03:00:01.669447211Z [inf]  [DeFiLlama] Enriched Dune chain "ronin" (Display: "Ronin") -> "Ronin" with TVL: $0.02B
2026-02-03T03:00:01.669451591Z [inf]  [DeFiLlama] Enriched Dune chain "ton" (Display: "TON") -> "TON" with TVL: $0.07B
2026-02-03T03:00:01.669455731Z [inf]  [DeFiLlama] Enriched Dune chain "flare" (Display: "Flare") -> "Flare" with TVL: $0.16B
2026-02-03T03:00:01.669460071Z [inf]  [DeFiLlama] Enriched Dune chain "monad" (Display: "Monad") -> "Monad" with TVL: $0.22B
2026-02-03T03:00:01.669464561Z [inf]  [DeFiLlama] Enriched Dune chain "kaia" (Display: "Kaia") -> "Kaia" with TVL: $0.01B
2026-02-03T03:00:01.669468981Z [inf]  [DeFiLlama] Enriched Dune chain "worldchain" (Display: "World Chain") -> "World Chain" with TVL: $0.03B
2026-02-03T03:00:01.669473421Z [inf]  [DeFiLlama] Enriched Dune chain "hemi" (Display: "Hemi") -> "Hemi" with TVL: $0.01B
2026-02-03T03:00:01.669479141Z [inf]  [DeFiLlama] Enriched Dune chain "opbnb" (Display: "opBNB") -> "opBNB" with TVL: $0.02B
2026-02-03T03:00:01.670107714Z [inf]  [DeFiLlama] Enriched Dune chain "scroll" (Display: "Scroll") -> "Scroll" with TVL: $0.21B
2026-02-03T03:00:01.670112204Z [inf]  [DeFiLlama] Enriched Dune chain "fantom" (Display: "Fantom") -> "Fantom" with TVL: $0.00B
2026-02-03T03:00:01.670115464Z [inf]  [DeFiLlama] Enriched Dune chain "flow" (Display: "Flow") -> "Flow" with TVL: $0.04B
2026-02-03T03:00:01.670119064Z [inf]  [DeFiLlama] Enriched Dune chain "peaq" (Display: "Peaq") -> "Peaq" with TVL: $0.00B
2026-02-03T03:00:01.670123014Z [inf]  [DeFiLlama] Enriched Dune chain "somnia" (Display: "Somnia") -> "Somnia" with TVL: $0.00B
2026-02-03T03:00:01.670126953Z [inf]  [DeFiLlama] Enriched Dune chain "corn" (Display: "Corn") -> "Corn" with TVL: $0.00B
2026-02-03T03:00:01.670130373Z [inf]  [DeFiLlama] Enriched Dune chain "zkevm" (Display: "Polygon zkEVM") -> "Polygon zkEVM" with TVL: $0.00B
2026-02-03T03:00:01.670134803Z [inf]  [DeFiLlama] Enriched Dune chain "taiko" (Display: "Taiko") -> "Taiko" with TVL: $0.01B
2026-02-03T03:00:01.670138723Z [inf]  [DeFiLlama] Enriched Dune chain "tac" (Display: "TAC") -> "TAC" with TVL: $0.00B
2026-02-03T03:00:01.670142663Z [inf]  [DeFiLlama] Enriched Dune chain "nova" (Display: "Arbitrum Nova") -> "Arbitrum Nova" with TVL: $0.00B
2026-02-03T03:00:01.670146333Z [inf]  [DeFiLlama] Enriched Dune chain "mezo" (Display: "Mezo") -> "Mezo" with TVL: $0.03B
2026-02-03T03:00:01.670150073Z [inf]  [DeFiLlama] Enriched Dune chain "shape" (Display: "Shape") -> "Shape" with TVL: $0.00B
2026-02-03T03:00:01.670153723Z [inf]  [DeFiLlama] Enriched Dune chain "boba" (Display: "Boba") -> "Boba" with TVL: $0.00B
2026-02-03T03:00:01.670157723Z [inf]  [DeFiLlama] Enriched Dune chain "superseed" (Display: "Superseed") -> "Superseed" with TVL: $0.00B
2026-02-03T03:00:01.670165224Z [inf]  [DeFiLlama] Enriched Dune chain "sophon" (Display: "Sophon") -> "Sophon" with TVL: $0.01B
2026-02-03T03:00:01.670168624Z [inf]  [DeFiLlama] Enriched Dune chain "aptos" (Display: "Aptos") -> "Aptos" with TVL: $0.36B
2026-02-03T03:00:01.671477550Z [inf]  [DeFiLlama] Enriched Dune chain "bitcoin" (Display: "Bitcoin") -> "Bitcoin" with TVL: $5.88B
2026-02-03T03:00:01.671482890Z [inf]  [DeFiLlama] Enriched Dune chain "near" (Display: "Near") -> "Near" with TVL: $0.11B
2026-02-03T03:00:01.671486490Z [inf]  [DeFiLlama] Enriched Dune chain "starknet" (Display: "Starknet") -> "Starknet" with TVL: $0.30B
2026-02-03T03:00:01.671490240Z [inf]  [DeFiLlama] Enriched Dune chain "tron" (Display: "Tron") -> "Tron" with TVL: $4.22B
2026-02-03T03:00:01.671493500Z [inf]  [DeFiLlama] Enriched Dune chain "solana" (Display: "Solana") -> "Solana" with TVL: $8.11B
2026-02-03T03:00:01.671496460Z [inf]  [DeFiLlama] Created 52 chains with Dune metrics
2026-02-03T03:00:03.868655386Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:00:08.512130584Z [inf]  Saved 52 chains to database
2026-02-03T03:00:08.512134204Z [inf]  [MarketJob] ✅ Chains refreshed successfully: 52 chains
2026-02-03T03:00:11.152040015Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:00:12.066354718Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:00:12.066358728Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:00:12.066361748Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:00:12.066364668Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:00:12.240567725Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:00:12.240572274Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:00:12.240574944Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:00:12.240577514Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:00:12.422539069Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:00:13.436942166Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:00:15.452577013Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:00:19.473943468Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:00:19.474115966Z [err]  GeckoTerminal API error after retries
2026-02-03T03:00:19.474122606Z [err]  Error fetching trending tokens
2026-02-03T03:00:19.474126886Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:00:19.474130396Z [inf]  [TokenJob] Got 28 trending tokens for Ethereum
2026-02-03T03:00:19.484171869Z [err]  [TokenJob] New list too small (28) for Ethereum; keeping existing (100)
2026-02-03T03:00:22.371186314Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:00:42.374835330Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:00:42.374843140Z [inf]  incoming request
2026-02-03T03:00:42.374847040Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_budti4068zicsfo0","createdAt":"2026-02-03T03:00:32.468Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27b83f6","hash":"0x458128eb044b3d49e7256ba856e191d68fbe59729a1ca3476c3dbbc1cda348e6","value":0.5,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x6f05b59d3b20000","decimals":18},"blockTimestamp":"0x698164cf"}],"source":"chainlake-kafka"}}
2026-02-03T03:00:42.374851010Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:00:42.374854620Z [inf]  request completed
2026-02-03T03:00:42.374858630Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x458128
2026-02-03T03:00:42.374862390Z [inf]  Swap successfully decoded from logs
2026-02-03T03:00:42.374865740Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x4f67f521: {
2026-02-03T03:00:42.374869750Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-03T03:00:42.374874770Z [inf]    tokenOut: '0x2e2050ba5422eea926a34624a145ea3905379b07',
2026-02-03T03:00:42.375114817Z [inf]    dex: 'Unknown DEX'
2026-02-03T03:00:42.375119417Z [inf]  }
2026-02-03T03:00:42.375122847Z [inf]  Swap detected on target wallet
2026-02-03T03:00:42.375125367Z [inf]  Target is buying - triggering copy trade
2026-02-03T03:00:42.375127957Z [inf]  incoming request
2026-02-03T03:00:42.375130447Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_ae0gorkgmwassykc","createdAt":"2026-02-03T03:00:32.735Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","blockNum":"0x27b83f6","hash":"0x458128eb044b3d49e7256ba856e191d68fbe59729a1ca3476c3dbbc1cda348e6","value":980146078.910896,"asset":"CLAWNET","category":"token","rawContract":{"rawValue":"0x0000000000000000000000000000000000000000032ac20167c96a50c15c9d02","address":"0x2e2050ba5422eea926a34624a145ea3905379b07","decimals":18},"log":{"address":"0x2e2050ba5422eea926a34624a145ea3905379b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x0000000000000000000000004f67f52147c6bc03563772fa3d7af3adffb92110"],"data":"0x0000000000000000000000000000000000000000032ac20167c96a50c15c9d02","blockHash":"0x785460387aad3d200917fea0c2cb6ca2099a63e38f6c71978640dad6b0917141","blockNumber":"0x27b83f6","blockTimestamp":"0x698164cf","transactionHash":"0x458128eb044b3d49e7256ba856e191d68fbe59729a1ca3476c3dbbc1cda348e6","transactionIndex":"0xc2","logIndex":"0x589","removed":false},"blockTimestamp":"0x698164cf"}],"source":"chainlake-kafka"}}
2026-02-03T03:00:42.376422323Z [inf]  request completed
2026-02-03T03:00:42.376428683Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:00:42.376432463Z [inf]  [Webhook] Tx already in processedTxs cache: 0x458128eb044b3d
2026-02-03T03:00:42.376435383Z [err]  LaunchpadDetector: Failed to load Paragraph SDK
2026-02-03T03:00:42.376438383Z [inf]  Timer finished: launchpad_det_0x2e2050ba5422eea926a34624a145ea3905379b07
2026-02-03T03:00:42.376442373Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:00:42.376445423Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:00:42.376448463Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:00:42.377105846Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:00:42.377109536Z [inf]  🔥 Warming up 1 user settings
2026-02-03T03:00:42.377113796Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-03T03:00:42.377117756Z [inf]  📊 Mass Copy Trade Analysis
2026-02-03T03:00:42.377122366Z [inf]  📦 Processing batch 1/1
2026-02-03T03:00:42.377127176Z [inf]  Skipping trade: Insufficient gas buffer
2026-02-03T03:00:42.377131876Z [inf]  [Warpcast] Sending DM to FID 877398: "⏭️ Copy Trade Skipped: $CLAWNET
2026-02-03T03:00:42.377688710Z [inf]  
2026-02-03T03:00:42.377694130Z [inf]  ⏭️ **COPY TRADE S..."
2026-02-03T03:00:42.377699200Z [inf]  [Warpcast] DM sent successfully. Daily usage: 27/50000
2026-02-03T03:00:42.377703650Z [inf]  ✅ Smart batch execution complete
2026-02-03T03:00:42.377708200Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-03T03:00:42.377712650Z [inf]  Fetching premium trending tokens
2026-02-03T03:00:42.377717159Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:00:42.377721959Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:00:42.377725989Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:00:42.377730329Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-03T03:00:42.377735039Z [inf]  [TokenJob] Filtered out 2 invalid tokens for Solana
2026-02-03T03:00:42.377739839Z [inf]  Saved 98 trending tokens for solana to database and memory cache
2026-02-03T03:00:42.378004587Z [inf]  [TokenJob] Saved 98 tokens for Solana to DB + cache
2026-02-03T03:00:42.629806490Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:00:43.745737271Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:00:43.745742151Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:00:43.962047422Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:00:43.962050722Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:00:44.099803618Z [inf]  0x API price received successfully
2026-02-03T03:00:44.099809898Z [err]  Critical: No valid price data available
2026-02-03T03:00:44.250909492Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:00:44.250915362Z [err]  Critical: No valid price data available
2026-02-03T03:00:44.363738843Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:00:44.363743953Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:00:54.361933204Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:00:55.121665693Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:00:55.121670323Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:00:55.121684632Z [err]  Critical: No valid price data available
2026-02-03T03:00:55.181131041Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:00:55.181135831Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:00:55.181139521Z [err]  Critical: No valid price data available
2026-02-03T03:00:55.291885824Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:00:55.291888774Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:01:00.720636596Z [inf]  [TokenJob] Skipping refresh for Base - another instance holds the lock
2026-02-03T03:01:00.720645546Z [err]  [DBLock] Lock already held {
2026-02-03T03:01:00.720649436Z [err]    key: 'lock:tokenJob:refresh:base',
2026-02-03T03:01:00.720652356Z [err]    expiresAt: '2026-02-02T05:44:42.169Z',
2026-02-03T03:01:00.720655336Z [err]    ageMs: 76818545
2026-02-03T03:01:00.720659456Z [err]  }
2026-02-03T03:01:00.720662366Z [err]  [DBLock] Potential stale lock detected { key: 'lock:tokenJob:refresh:base', ageMs: 76818545, ttlSeconds: 240 }
2026-02-03T03:01:05.291006624Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:01:05.988951061Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:01:05.988958391Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:01:05.988968531Z [err]  Critical: No valid price data available
2026-02-03T03:01:06.461405704Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:01:06.461412654Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:01:06.461417434Z [err]  Critical: No valid price data available
2026-02-03T03:01:06.572922180Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:01:06.572929930Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:01:23.453895722Z [err]  2026-02-03 03:01:19.694 UTC [27] LOG:  checkpoint starting: time
2026-02-03T03:01:26.573537060Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:01:26.573542470Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:01:26.573545519Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:01:26.573548569Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:01:26.573551349Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:01:26.573554929Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:01:26.573557779Z [err]  Critical: No valid price data available
2026-02-03T03:01:26.573561039Z [inf]  0x API price received successfully
2026-02-03T03:01:26.575142552Z [err]  Critical: No valid price data available
2026-02-03T03:01:26.575153302Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:01:26.575159032Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:01:26.575163882Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-03T03:01:26.575168832Z [inf]  Fetching premium trending tokens
2026-02-03T03:01:26.575175372Z [err]  DexScreener WS: Connection error
2026-02-03T03:01:26.575184092Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:01:26.575188642Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:01:26.577423839Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:01:27.227061744Z [inf]  Skipping low liquidity token
2026-02-03T03:01:27.421982275Z [err]  Error fetching trending tokens
2026-02-03T03:01:27.421990955Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:01:27.421996185Z [inf]  [TokenJob] Got 31 trending tokens for BSC
2026-02-03T03:01:27.433007028Z [err]  [TokenJob] New list too small (31) for BSC; keeping existing (100)
2026-02-03T03:01:27.900978391Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:01:28.559962248Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:01:28.559967528Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:01:28.559976638Z [err]  Critical: No valid price data available
2026-02-03T03:01:28.654111928Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:01:28.654119868Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:01:28.654124038Z [err]  Critical: No valid price data available
2026-02-03T03:01:28.774051076Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:01:28.774055366Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:01:48.772376081Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:01:48.772380901Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:01:48.772383841Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:01:48.772386441Z [err]  Critical: No valid price data available
2026-02-03T03:01:48.772389481Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:01:48.772392601Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:01:48.772395181Z [err]  Critical: No valid price data available
2026-02-03T03:01:48.772398101Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:01:48.773500220Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:01:48.773508399Z [inf]  [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
2026-02-03T03:01:48.773515439Z [inf]  Fetching premium trending tokens
2026-02-03T03:01:48.773520399Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:01:48.950268835Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:01:48.950274845Z [err]  Error fetching trending tokens
2026-02-03T03:01:48.950279874Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:01:48.950283794Z [inf]  [TokenJob] DexScreener returned 5 tokens, trying GeckoTerminal fallback...
2026-02-03T03:01:48.950288034Z [inf]  [TokenJob] Got 5 trending tokens for Arbitrum
2026-02-03T03:01:48.950292544Z [err]  Error fetching trending tokens
2026-02-03T03:01:48.971589428Z [inf]  Saved 5 trending tokens for arbitrum to database and memory cache
2026-02-03T03:01:48.982859259Z [inf]  [TokenJob] Saved 5 tokens for Arbitrum to DB + cache
2026-02-03T03:01:49.783645476Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:01:50.675058912Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:01:50.675064522Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:01:50.675069582Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:01:50.675074112Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:01:51.015660200Z [inf]  0x API price received successfully
2026-02-03T03:01:51.015664409Z [err]  Critical: No valid price data available
2026-02-03T03:01:51.506176347Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:01:51.506180037Z [err]  Critical: No valid price data available
2026-02-03T03:01:51.601737373Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:01:51.601740453Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:02:01.599504424Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:02:02.863121467Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:02:02.863125737Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:02:02.863129037Z [err]  Critical: No valid price data available
2026-02-03T03:02:02.888145991Z [err]  Critical: No valid price data available
2026-02-03T03:02:02.888173681Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:02:02.888183551Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:02:03.005601416Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:02:03.005607266Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:02:04.286806125Z [err]  2026-02-03 03:02:01.857 UTC [27] LOG:  checkpoint complete: wrote 422 buffers (2.6%); 0 WAL file(s) added, 0 removed, 0 recycled; write=42.087 s, sync=0.054 s, total=42.163 s; sync files=40, longest=0.039 s, average=0.002 s; distance=2370 kB, estimate=3407 kB; lsn=3/3BFC0C28, redo lsn=3/3BFA2358
2026-02-03T03:02:07.527596806Z [inf]  [SocialJob] Checking Zora coin status for 213 casts...
2026-02-03T03:02:08.993541866Z [err]  [DBLock] Lock already held {
2026-02-03T03:02:08.993549416Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T03:02:08.993553036Z [err]    expiresAt: '2026-01-29T11:00:40.912Z',
2026-02-03T03:02:08.993556946Z [err]    ageMs: 403528078
2026-02-03T03:02:08.993560796Z [err]  }
2026-02-03T03:02:08.993564856Z [inf]  [TokenJob] Skipping refresh for Optimism - another instance holds the lock
2026-02-03T03:02:08.993568596Z [err]  [DBLock] Potential stale lock detected {
2026-02-03T03:02:08.993572746Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T03:02:08.993577016Z [err]    ageMs: 403528078,
2026-02-03T03:02:08.993580196Z [err]    ttlSeconds: 240
2026-02-03T03:02:08.993583106Z [err]  }
2026-02-03T03:02:10.721233343Z [inf]  [SocialRepo] Cleaned up 69 old casts (cap: 1000)
2026-02-03T03:02:11.346108959Z [inf]  Timer finished: get_trending_casts_trending
2026-02-03T03:02:11.542248139Z [inf]  SocialRepo: Updated cache with 500 merged casts
2026-02-03T03:02:11.542251909Z [inf]  SocialRepo: Saved 213 trending casts to database
2026-02-03T03:02:11.542256209Z [inf]  Timer finished: save_trending_casts
2026-02-03T03:02:11.542259969Z [inf]  [SocialJob] Casts refreshed: 213 saved
2026-02-03T03:02:11.542263709Z [inf]  [SocialJob] 🚀 Triggering OGP Prefetch for top 50 casts...
2026-02-03T03:02:13.005748147Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:02:14.197257889Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:02:14.197263669Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:02:14.197267799Z [err]  Critical: No valid price data available
2026-02-03T03:02:14.294275830Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:02:14.294282950Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:02:14.294289390Z [err]  Critical: No valid price data available
2026-02-03T03:02:14.566743693Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:02:14.566746603Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:02:34.443393052Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:02:34.443395812Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:02:34.443398392Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:02:34.443401412Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:02:34.443403722Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:02:34.443406442Z [inf]  0x API price received successfully
2026-02-03T03:02:34.443409222Z [err]  Critical: No valid price data available
2026-02-03T03:02:34.443411912Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:02:34.444162863Z [err]  Critical: No valid price data available
2026-02-03T03:02:34.444167683Z [err]    ttlSeconds: 240
2026-02-03T03:02:34.444172863Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:02:34.444179123Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:02:34.444180243Z [err]  }
2026-02-03T03:02:34.444184643Z [err]  [DBLock] Lock already held {
2026-02-03T03:02:34.444188133Z [inf]  [TokenJob] Refreshed 7 chains in 148.3s
2026-02-03T03:02:34.444191063Z [err]    key: 'lock:tokenJob:refresh:polygon',
2026-02-03T03:02:34.444195003Z [err]    expiresAt: '2026-01-29T04:35:55.102Z',
2026-02-03T03:02:34.444198773Z [err]    ageMs: 426633891
2026-02-03T03:02:34.444202853Z [err]  }
2026-02-03T03:02:34.444206263Z [inf]  [TokenJob] Skipping refresh for Polygon - another instance holds the lock
2026-02-03T03:02:34.444209673Z [err]  [DBLock] Potential stale lock detected {
2026-02-03T03:02:34.444212883Z [err]    key: 'lock:tokenJob:refresh:polygon',
2026-02-03T03:02:34.444216073Z [err]    ageMs: 426633891,
2026-02-03T03:02:36.395565152Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:02:37.678408384Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:02:37.678413274Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:02:37.678420944Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:02:37.678426434Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:02:37.802737577Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:02:37.802741827Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:02:37.991756115Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:02:37.991760655Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:02:38.113012231Z [inf]  📊 Position P/L check
2026-02-03T03:02:48.112753177Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:02:48.239895430Z [inf]  📊 Position P/L check
2026-02-03T03:03:08.238948029Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:03:08.238953159Z [inf]  📊 Position P/L check
2026-02-03T03:03:08.386836714Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:03:09.113472713Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:03:09.113478423Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:03:09.113483383Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:03:09.113487643Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:03:09.201020686Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:03:09.201024316Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:03:09.201027866Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:03:09.201031326Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:03:29.187879504Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:03:29.478329931Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:03:36.230328202Z [inf]  incoming request
2026-02-03T03:03:36.231136843Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_3v6mjeictpkxyzau","createdAt":"2026-02-03T03:03:35.907Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27b8452","hash":"0x4226628ad1c71356d6e08323eb8fda7ebbc31cd51dea64ba3df8f0f72d2bc7d8","value":0.5,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x6f05b59d3b20000","decimals":18},"blockTimestamp":"0x69816587"}],"source":"chainlake-kafka"}}
2026-02-03T03:03:36.231800116Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:03:36.232594127Z [inf]  request completed
2026-02-03T03:03:36.237419876Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x422662
2026-02-03T03:03:36.348076056Z [inf]  Swap successfully decoded from logs
2026-02-03T03:03:36.349170114Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x4f67f521: {
2026-02-03T03:03:36.349175594Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-03T03:03:36.349179064Z [inf]    tokenOut: '0x78f4545ff13a7a98c4808cf48e7720b26e94bb07',
2026-02-03T03:03:36.349182254Z [inf]    dex: 'Unknown DEX'
2026-02-03T03:03:36.349185274Z [inf]  }
2026-02-03T03:03:36.349200914Z [inf]  Swap detected on target wallet
2026-02-03T03:03:36.349203744Z [inf]  Target is buying - triggering copy trade
2026-02-03T03:03:36.360892790Z [inf]  incoming request
2026-02-03T03:03:36.361890440Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_keke76vpddnpewur","createdAt":"2026-02-03T03:03:35.991Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","blockNum":"0x27b8452","hash":"0x4226628ad1c71356d6e08323eb8fda7ebbc31cd51dea64ba3df8f0f72d2bc7d8","value":2201372686.5845866,"asset":"TRIER","category":"token","rawContract":{"rawValue":"0x0000000000000000000000000000000000000000071ceecc7656de909c95d7a0","address":"0x78f4545ff13a7a98c4808cf48e7720b26e94bb07","decimals":18},"log":{"address":"0x78f4545ff13a7a98c4808cf48e7720b26e94bb07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x0000000000000000000000004f67f52147c6bc03563772fa3d7af3adffb92110"],"data":"0x0000000000000000000000000000000000000000071ceecc7656de909c95d7a0","blockHash":"0x3a4fe04d32a0a2ae567679cd66dd0000d223ae265f8ffa9ee6ff75c8cc42c8ca","blockNumber":"0x27b8452","blockTimestamp":"0x69816587","transactionHash":"0x4226628ad1c71356d6e08323eb8fda7ebbc31cd51dea64ba3df8f0f72d2bc7d8","transactionIndex":"0xdb","logIndex":"0x3d0","removed":false},"blockTimestamp":"0x69816587"}],"source":"chainlake-kafka"}}
2026-02-03T03:03:36.364615401Z [inf]  request completed
2026-02-03T03:03:36.364619391Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:03:36.364622861Z [inf]  [Webhook] Tx already in processedTxs cache: 0x4226628ad1c713
2026-02-03T03:03:36.514137290Z [err]  LaunchpadDetector: Failed to load Paragraph SDK
2026-02-03T03:03:36.660939167Z [inf]  Timer finished: launchpad_det_0x78f4545ff13a7a98c4808cf48e7720b26e94bb07
2026-02-03T03:03:38.074822543Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:03:38.074827273Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:03:38.440888841Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:03:38.440893421Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:03:38.440896511Z [inf]  🔥 Warming up 1 user settings
2026-02-03T03:03:38.445736019Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-03T03:03:38.445741459Z [inf]  📊 Mass Copy Trade Analysis
2026-02-03T03:03:38.445745649Z [inf]  📦 Processing batch 1/1
2026-02-03T03:03:38.555638588Z [inf]  Skipping trade: Insufficient gas buffer
2026-02-03T03:03:38.556117842Z [inf]  [Warpcast] Sending DM to FID 877398: "⏭️ Copy Trade Skipped: $TRIER
2026-02-03T03:03:38.556122062Z [inf]  
2026-02-03T03:03:38.556124842Z [inf]  ⏭️ **COPY TRADE SKI..."
2026-02-03T03:03:38.869695946Z [inf]  [Warpcast] DM sent successfully. Daily usage: 28/50000
2026-02-03T03:03:38.869712466Z [inf]  ✅ Smart batch execution complete
2026-02-03T03:03:39.595561249Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:03:40.541669524Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:03:40.541680164Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:03:40.542254327Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:03:40.542259207Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:03:40.911119576Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:03:40.911125136Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:03:40.911129216Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:03:40.911132806Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:03:50.904532132Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:03:51.025125537Z [inf]  📊 Position P/L check
2026-02-03T03:04:11.025052792Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:04:11.025057152Z [inf]  📊 Position P/L check
2026-02-03T03:04:11.172815920Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:04:11.977659414Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:04:11.977664724Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:04:11.977667634Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:04:11.977671944Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:04:12.333510284Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:04:12.333515704Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:04:12.333518694Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:04:12.333521394Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:04:12.433970632Z [inf]  📊 Position P/L check
2026-02-03T03:04:32.437422289Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:04:32.437427129Z [inf]  📊 Position P/L check
2026-02-03T03:04:32.558072454Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:04:32.679427353Z [inf]  📊 Position P/L check
2026-02-03T03:04:42.673101655Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:04:43.358631616Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:04:43.358636766Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:04:43.637897786Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:04:43.637902035Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:04:43.642298750Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:04:43.642303020Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:04:43.853823555Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:04:43.853829345Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:04:44.126564555Z [inf]  📊 Position P/L check
2026-02-03T03:04:54.085160943Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:05:00.238317066Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-03T03:05:00.246186414Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-03T03:05:00.246190324Z [inf]  Fetching premium trending tokens
2026-02-03T03:05:00.246203244Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:05:00.261339124Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-03T03:05:00.261345154Z [inf]  Timer finished: recalc_heat_scores
2026-02-03T03:05:02.303243127Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:05:04.234783475Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:05:08.302775103Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:05:09.328461596Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:05:11.361154191Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:05:14.249230047Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:05:15.253725734Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:05:15.253732624Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:05:15.253738224Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:05:15.253743194Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:05:15.253748084Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:05:15.253754094Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:05:15.253759704Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:05:15.253766204Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:05:15.375233313Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:05:15.375238643Z [err]  GeckoTerminal API error after retries
2026-02-03T03:05:15.375242043Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:05:15.375245023Z [inf]  [TokenJob] Got 28 trending tokens for Ethereum
2026-02-03T03:05:15.375248133Z [err]  Error fetching trending tokens
2026-02-03T03:05:15.375251102Z [err]  [TokenJob] New list too small (28) for Ethereum; keeping existing (100)
2026-02-03T03:05:25.337925932Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:05:45.429311430Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:05:45.429316010Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-03T03:05:45.429320210Z [inf]  Fetching premium trending tokens
2026-02-03T03:05:45.429324360Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:05:45.429328810Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:05:45.429333370Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:05:45.429337690Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-03T03:05:45.429341660Z [inf]  [TokenJob] Filtered out 2 invalid tokens for Solana
2026-02-03T03:05:45.429345540Z [inf]  Saved 98 trending tokens for solana to database and memory cache
2026-02-03T03:05:45.429349020Z [inf]  [TokenJob] Saved 98 tokens for Solana to DB + cache
2026-02-03T03:05:45.765772301Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:05:46.726465097Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:05:46.726473637Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:05:46.738069704Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:05:46.738074804Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:05:47.079354345Z [inf]  0x API price received successfully
2026-02-03T03:05:47.079358565Z [err]  Critical: No valid price data available
2026-02-03T03:05:47.109947242Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:05:47.109951832Z [err]  Critical: No valid price data available
2026-02-03T03:05:47.232436070Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:05:47.232440610Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:05:57.011754736Z [err]  [DBLock] Lock already held {
2026-02-03T03:05:57.011760606Z [err]    key: 'lock:tokenJob:refresh:base',
2026-02-03T03:05:57.011784695Z [err]    expiresAt: '2026-02-02T05:44:42.169Z',
2026-02-03T03:05:57.011830165Z [err]    ageMs: 77114838
2026-02-03T03:05:57.011859595Z [err]  }
2026-02-03T03:05:57.011863345Z [err]  [DBLock] Potential stale lock detected { key: 'lock:tokenJob:refresh:base', ageMs: 77114838, ttlSeconds: 240 }
2026-02-03T03:05:57.011866855Z [inf]  [TokenJob] Skipping refresh for Base - another instance holds the lock
2026-02-03T03:05:57.236792913Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:05:58.422740965Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:05:58.422745166Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:05:58.422748466Z [err]  Critical: No valid price data available
2026-02-03T03:05:58.422752156Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:05:58.422755986Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:05:58.422759266Z [err]  Critical: No valid price data available
2026-02-03T03:05:58.422762716Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:05:58.423331110Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:06:18.303978546Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:06:18.303987436Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:06:18.303992535Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:06:18.303996765Z [err]  Critical: No valid price data available
2026-02-03T03:06:18.304002565Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:06:18.304006365Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:06:18.304009395Z [err]  Critical: No valid price data available
2026-02-03T03:06:18.304012585Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:06:18.304705108Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:06:18.304709948Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-03T03:06:18.304713218Z [inf]  Fetching premium trending tokens
2026-02-03T03:06:18.304716518Z [err]  DexScreener WS: Connection error
2026-02-03T03:06:18.304719338Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:06:19.277044487Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:06:19.918320437Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:06:20.613005733Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:06:20.613010573Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:06:20.716790290Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:06:20.716795230Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:06:21.019214161Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:06:21.019219661Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:06:21.070417082Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:06:21.070421642Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:06:21.214960418Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:06:21.825705958Z [err]  2026-02-03 03:06:19.957 UTC [27] LOG:  checkpoint starting: time
2026-02-03T03:06:22.239546217Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:06:24.298301354Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:06:29.232368145Z [err]  Error fetching trending tokens
2026-02-03T03:06:29.232374085Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:06:29.232377435Z [inf]  [TokenJob] Got 31 trending tokens for BSC
2026-02-03T03:06:29.244788925Z [err]  [TokenJob] New list too small (31) for BSC; keeping existing (100)
2026-02-03T03:06:31.188165462Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:06:51.188757210Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:06:51.188763610Z [inf]  [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
2026-02-03T03:06:51.188767140Z [inf]  Fetching premium trending tokens
2026-02-03T03:06:51.188770110Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:06:51.188773050Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:06:51.188776580Z [err]  Error fetching trending tokens
2026-02-03T03:06:51.188779940Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:06:51.188782410Z [inf]  [TokenJob] DexScreener returned 5 tokens, trying GeckoTerminal fallback...
2026-02-03T03:06:51.188785520Z [inf]  [TokenJob] Got 5 trending tokens for Arbitrum
2026-02-03T03:06:51.188788550Z [err]  Error fetching trending tokens
2026-02-03T03:06:51.188791129Z [inf]  Saved 5 trending tokens for arbitrum to database and memory cache
2026-02-03T03:06:51.189281154Z [inf]  [TokenJob] Saved 5 tokens for Arbitrum to DB + cache
2026-02-03T03:06:51.523211586Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:06:52.302643804Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:06:52.302651524Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:06:52.302655814Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:06:52.302659534Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:06:52.550769230Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:06:52.550773810Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:06:52.550777350Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:06:52.550780920Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:07:12.594285588Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:07:12.594289448Z [inf]  📊 Position P/L check
2026-02-03T03:07:12.594293158Z [err]  [DBLock] Lock already held {
2026-02-03T03:07:12.594296768Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T03:07:12.594300368Z [err]    expiresAt: '2026-01-29T11:00:40.912Z',
2026-02-03T03:07:12.594303828Z [err]    ageMs: 403829767
2026-02-03T03:07:12.594307018Z [err]  }
2026-02-03T03:07:12.594310948Z [err]  [DBLock] Potential stale lock detected {
2026-02-03T03:07:12.594314138Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T03:07:12.594317478Z [err]    ageMs: 403829767,
2026-02-03T03:07:12.594321258Z [err]    ttlSeconds: 240
2026-02-03T03:07:12.594325478Z [err]  }
2026-02-03T03:07:12.594329058Z [inf]  [TokenJob] Skipping refresh for Optimism - another instance holds the lock
2026-02-03T03:07:12.680456760Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:07:12.806715020Z [inf]  📊 Position P/L check
2026-02-03T03:07:23.208931626Z [err]  2026-02-03 03:07:20.471 UTC [27] LOG:  checkpoint complete: wrote 606 buffers (3.7%); 0 WAL file(s) added, 0 removed, 1 recycled; write=60.431 s, sync=0.022 s, total=60.515 s; sync files=40, longest=0.016 s, average=0.001 s; distance=3994 kB, estimate=3994 kB; lsn=3/3C3A6A78, redo lsn=3/3C388F40
2026-02-03T03:07:32.808129368Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:07:32.808137608Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:07:32.808144588Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:07:32.808149448Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:07:32.808154258Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:07:32.808159188Z [inf]  0x API price received successfully
2026-02-03T03:07:32.808163588Z [err]  Critical: No valid price data available
2026-02-03T03:07:32.808168918Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:07:32.809020879Z [inf]  [TokenJob] Refreshed 7 chains in 150.4s
2026-02-03T03:07:32.809042179Z [err]  Critical: No valid price data available
2026-02-03T03:07:32.809048849Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:07:32.809052729Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:07:32.809056409Z [err]  [DBLock] Lock already held {
2026-02-03T03:07:32.809060609Z [err]    key: 'lock:tokenJob:refresh:polygon',
2026-02-03T03:07:32.809066839Z [err]    expiresAt: '2026-01-29T04:35:55.102Z',
2026-02-03T03:07:32.809070379Z [err]    ageMs: 426935579
2026-02-03T03:07:32.809075489Z [err]  }
2026-02-03T03:07:32.809079639Z [inf]  [TokenJob] Skipping refresh for Polygon - another instance holds the lock
2026-02-03T03:07:32.809083259Z [err]  [DBLock] Potential stale lock detected {
2026-02-03T03:07:32.809086369Z [err]    key: 'lock:tokenJob:refresh:polygon',
2026-02-03T03:07:32.809089669Z [err]    ageMs: 426935579,
2026-02-03T03:07:32.809093399Z [err]    ttlSeconds: 240
2026-02-03T03:07:32.809098939Z [err]  }
2026-02-03T03:07:34.761542650Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:07:35.721836948Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:07:35.721849208Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:07:36.029404090Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:07:36.029408160Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:07:36.074037650Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:07:36.074042980Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:07:36.335434188Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:07:36.335446068Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:07:36.448005063Z [inf]  📊 Position P/L check
2026-02-03T03:07:56.445900093Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:07:56.445906513Z [inf]  📊 Position P/L check
2026-02-03T03:07:56.718189856Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:07:56.781259523Z [inf]  📊 Position P/L check
2026-02-03T03:08:02.595374526Z [inf]  incoming request
2026-02-03T03:08:02.595914799Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_deo6hrgejm2z7w8p","createdAt":"2026-02-03T03:08:02.252Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27b84d7","hash":"0x34d4ff814652e9c5bbef0eb3ac3999ad954255aa820b36488b7f392c91f3d71b","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x69816691"}],"source":"chainlake-kafka"}}
2026-02-03T03:08:02.596969048Z [inf]  request completed
2026-02-03T03:08:02.596973658Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:08:02.601528550Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x34d4ff
2026-02-03T03:08:02.701450049Z [inf]  incoming request
2026-02-03T03:08:02.701455168Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_r7o150o8ihfcp3z1","createdAt":"2026-02-03T03:08:02.365Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","toAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","blockNum":"0x27b84d7","hash":"0x34d4ff814652e9c5bbef0eb3ac3999ad954255aa820b36488b7f392c91f3d71b","value":0.1548314119009982,"typeTraceAddress":"CALL_0_0_2","asset":"ETH","category":"internal","rawContract":{"rawValue":"0x22612594a6e623d","decimals":18},"blockTimestamp":"0x69816691"}]}}
2026-02-03T03:08:02.702095412Z [inf]  request completed
2026-02-03T03:08:02.702100222Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:08:02.702104622Z [inf]  [Webhook] Tx already in processedTxs cache: 0x34d4ff814652e9
2026-02-03T03:08:02.712147357Z [inf]  incoming request
2026-02-03T03:08:02.712155217Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_ltd0wi7629krxzgs","createdAt":"2026-02-03T03:08:02.395Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0x6ff5693b99212da76ad316178a184ab56d299b43","blockNum":"0x27b84d7","hash":"0x34d4ff814652e9c5bbef0eb3ac3999ad954255aa820b36488b7f392c91f3d71b","value":1163993224.4885056,"asset":"PLAYER","category":"token","rawContract":{"rawValue":"0x000000000000000000000000000000000000000003c2d527232f6a8cf6b89499","address":"0xcf6457a92da63cca3f9a50f4d4c601a98f633b07","decimals":18},"log":{"address":"0xcf6457a92da63cca3f9a50f4d4c601a98f633b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000004f67f52147c6bc03563772fa3d7af3adffb92110","0x0000000000000000000000006ff5693b99212da76ad316178a184ab56d299b43"],"data":"0x000000000000000000000000000000000000000003c2d527232f6a8cf6b89499","blockHash":"0xdca3cba57ae26100670ea59fa72c8964f1fd04e5f398aafa6d7f660d291c7d8e","blockNumber":"0x27b84d7","blockTimestamp":"0x69816691","transactionHash":"0x34d4ff814652e9c5bbef0eb3ac3999ad954255aa820b36488b7f392c91f3d71b","transactionIndex":"0x8b","logIndex":"0x330","removed":false},"blockTimestamp":"0x69816691"}],"source":"chainlake-kafka"}}
2026-02-03T03:08:02.712161037Z [inf]  request completed
2026-02-03T03:08:02.712166547Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:08:02.712170927Z [inf]  [Webhook] Tx already in processedTxs cache: 0x34d4ff814652e9
2026-02-03T03:08:02.795149552Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x4f67f521: {
2026-02-03T03:08:02.795153902Z [inf]    tokenIn: '0xcf6457a92da63cca3f9a50f4d4c601a98f633b07',
2026-02-03T03:08:02.795156682Z [inf]    tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-03T03:08:02.795159562Z [inf]    dex: 'Unknown DEX'
2026-02-03T03:08:02.795162362Z [inf]  }
2026-02-03T03:08:02.795164842Z [inf]  Swap detected on target wallet
2026-02-03T03:08:02.795167392Z [inf]  Target is selling - triggering mirror sell
2026-02-03T03:08:02.795169952Z [inf]  Mirror sell: Processing open positions for token
2026-02-03T03:08:03.809698025Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:08:03.809705424Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:08:04.005973149Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:08:04.005979159Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:08:06.784845591Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:08:07.550589732Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:08:07.550596852Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:08:07.550601982Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:08:07.550606192Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:08:07.816974509Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:08:07.816980679Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:08:07.816986289Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:08:07.816990819Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:08:17.789328662Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:08:24.550942353Z [inf]  incoming request
2026-02-03T03:08:24.551423128Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_q4gw2xaabtbr3tlj","createdAt":"2026-02-03T03:08:24.235Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27b84e2","hash":"0x1e615dcdf44f29b3639f9b5c252b5126632afaa726397a59d85d3a65ffac934f","value":0.15,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x214e8348c4f0000","decimals":18},"blockTimestamp":"0x698166a7"}],"source":"chainlake-kafka"}}
2026-02-03T03:08:24.551428298Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:08:24.554298057Z [inf]  request completed
2026-02-03T03:08:24.560016108Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x1e615d
2026-02-03T03:08:24.688974621Z [inf]  Swap successfully decoded from logs
2026-02-03T03:08:24.688981531Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x4f67f521: {
2026-02-03T03:08:24.688986040Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-03T03:08:24.688990690Z [inf]    tokenOut: '0xda15854df692c0c4415315909e69d44e54f76b07',
2026-02-03T03:08:24.688995070Z [inf]    dex: 'Unknown DEX'
2026-02-03T03:08:24.689000260Z [inf]  }
2026-02-03T03:08:24.689004500Z [inf]  Swap detected on target wallet
2026-02-03T03:08:24.689008220Z [inf]  Target is buying - triggering copy trade
2026-02-03T03:08:24.693795650Z [inf]  incoming request
2026-02-03T03:08:24.693800720Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_q64lj722505d2wj1","createdAt":"2026-02-03T03:08:24.350Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","blockNum":"0x27b84e2","hash":"0x1e615dcdf44f29b3639f9b5c252b5126632afaa726397a59d85d3a65ffac934f","value":414464694.4595523,"asset":"BAZAAR","category":"token","rawContract":{"rawValue":"0x00000000000000000000000000000000000000000156d6501b8a52509c5913a8","address":"0xda15854df692c0c4415315909e69d44e54f76b07","decimals":18},"log":{"address":"0xda15854df692c0c4415315909e69d44e54f76b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x0000000000000000000000004f67f52147c6bc03563772fa3d7af3adffb92110"],"data":"0x00000000000000000000000000000000000000000156d6501b8a52509c5913a8","blockHash":"0x6b7d688764db0a60e9a651b5bf01ff22ca14d4230581faf58c07789fbc618e48","blockNumber":"0x27b84e2","blockTimestamp":"0x698166a7","transactionHash":"0x1e615dcdf44f29b3639f9b5c252b5126632afaa726397a59d85d3a65ffac934f","transactionIndex":"0xd6","logIndex":"0x46d","removed":false},"blockTimestamp":"0x698166a7"}],"source":"chainlake-kafka"}}
2026-02-03T03:08:24.693803730Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:08:24.693806600Z [inf]  [Webhook] Tx already in processedTxs cache: 0x1e615dcdf44f29
2026-02-03T03:08:24.693809610Z [inf]  request completed
2026-02-03T03:08:24.922678662Z [err]  LaunchpadDetector: Failed to load Paragraph SDK
2026-02-03T03:08:25.089632375Z [inf]  Timer finished: launchpad_det_0xda15854df692c0c4415315909e69d44e54f76b07
2026-02-03T03:08:25.832466648Z [inf]  On-chain price fetched from Uniswap V3
2026-02-03T03:08:25.832474868Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:08:25.832479388Z [inf]  🔥 Warming up 1 user settings
2026-02-03T03:08:26.828671487Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:08:26.828675117Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:08:27.175638206Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:08:27.175645745Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:08:27.175650645Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-03T03:08:27.175654375Z [inf]  📊 Mass Copy Trade Analysis
2026-02-03T03:08:27.175658275Z [inf]  📦 Processing batch 1/1
2026-02-03T03:08:27.282542762Z [inf]  Skipping trade: Insufficient gas buffer
2026-02-03T03:08:27.282548212Z [inf]  [Warpcast] Sending DM to FID 877398: "⏭️ Copy Trade Skipped: $BAZAAR
2026-02-03T03:08:27.282551472Z [inf]  
2026-02-03T03:08:27.282554912Z [inf]  ⏭️ **COPY TRADE SK..."
2026-02-03T03:08:27.611763187Z [inf]  [Warpcast] DM sent successfully. Daily usage: 29/50000
2026-02-03T03:08:27.611770627Z [inf]  ✅ Smart batch execution complete
2026-02-03T03:08:27.914485502Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:08:47.732082876Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:08:47.732088516Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:08:47.732091626Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:08:47.732094106Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:08:47.732096946Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:08:47.732099686Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:08:47.732102686Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:08:47.732105766Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:08:47.733387782Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:08:50.666403451Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:08:50.876185144Z [inf]  📊 Position P/L check
2026-02-03T03:09:00.798500764Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:09:00.939710989Z [inf]  📊 Position P/L check
2026-02-03T03:09:20.851856126Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:09:20.851861026Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:09:20.851864056Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:09:20.851867486Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:09:20.851869976Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:09:20.851872336Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:09:20.851874686Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:09:20.851877586Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:09:20.852229282Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:09:20.852232232Z [inf]  📊 Position P/L check
2026-02-03T03:09:21.826656227Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:09:22.028375556Z [inf]  📊 Position P/L check
2026-02-03T03:09:41.907423955Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:09:41.907433675Z [inf]  📊 Position P/L check
2026-02-03T03:09:42.100678563Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:09:42.782640734Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:09:42.782648024Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:09:43.053511817Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:09:43.053574826Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:09:43.053578976Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:09:43.053583516Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:09:43.213075350Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:09:43.213082870Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:09:43.395945428Z [inf]  📊 Position P/L check
2026-02-03T03:10:03.394712189Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:10:03.394717379Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-03T03:10:03.394720289Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-03T03:10:03.394723299Z [inf]  Fetching premium trending tokens
2026-02-03T03:10:03.394725789Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:10:03.394728879Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-03T03:10:03.394732119Z [inf]  Timer finished: recalc_heat_scores
2026-02-03T03:10:03.394734888Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:10:03.513044105Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:10:09.487381112Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:10:10.510384500Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:10:12.527419865Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:10:13.643553616Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:10:14.535905920Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:10:14.535910460Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:10:14.535915270Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:10:14.535919779Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:10:14.858868126Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:10:14.858879315Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:10:14.858887755Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:10:14.858894225Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:10:16.547666770Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:10:16.547672020Z [err]  GeckoTerminal API error after retries
2026-02-03T03:10:16.547675030Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:10:16.547678330Z [inf]  [TokenJob] Got 28 trending tokens for Ethereum
2026-02-03T03:10:16.547681910Z [err]  Error fetching trending tokens
2026-02-03T03:10:16.559486416Z [err]  [TokenJob] New list too small (28) for Ethereum; keeping existing (100)
2026-02-03T03:10:24.991303649Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:10:44.994970504Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:10:44.994974404Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-03T03:10:44.994977494Z [inf]  Fetching premium trending tokens
2026-02-03T03:10:44.994980064Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:10:44.994982844Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:10:44.994985214Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:10:44.994987444Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-03T03:10:44.994989824Z [inf]  [TokenJob] Filtered out 2 invalid tokens for Solana
2026-02-03T03:10:44.994992034Z [inf]  Saved 98 trending tokens for solana to database and memory cache
2026-02-03T03:10:44.994994584Z [inf]  [TokenJob] Saved 98 tokens for Solana to DB + cache
2026-02-03T03:10:45.264790040Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:10:46.051470777Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:10:46.051475987Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:10:46.215696681Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:10:46.251499525Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:10:46.411306756Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:10:46.411310686Z [err]  Critical: No valid price data available
2026-02-03T03:10:46.596804478Z [inf]  0x API price received successfully
2026-02-03T03:10:46.596809268Z [err]  Critical: No valid price data available
2026-02-03T03:10:46.727488225Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:10:46.727497964Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:10:56.721050533Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:10:57.427646601Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:10:57.427651960Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:10:57.427655560Z [err]  Critical: No valid price data available
2026-02-03T03:10:57.678911832Z [err]  [DBLock] Lock already held {
2026-02-03T03:10:57.678916342Z [err]    key: 'lock:tokenJob:refresh:base',
2026-02-03T03:10:57.678919572Z [err]    expiresAt: '2026-02-02T05:44:42.169Z',
2026-02-03T03:10:57.678922692Z [err]    ageMs: 77415505
2026-02-03T03:10:57.678925702Z [err]  }
2026-02-03T03:10:57.678928842Z [inf]  [TokenJob] Skipping refresh for Base - another instance holds the lock
2026-02-03T03:10:57.678945452Z [err]  [DBLock] Potential stale lock detected { key: 'lock:tokenJob:refresh:base', ageMs: 77415505, ttlSeconds: 240 }
2026-02-03T03:10:57.723586852Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:10:57.723592492Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:10:57.723595432Z [err]  Critical: No valid price data available
2026-02-03T03:10:57.858764753Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:10:57.858770383Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:11:17.858012844Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:11:17.858017314Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:11:17.858019984Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:11:17.858022464Z [err]  Critical: No valid price data available
2026-02-03T03:11:17.858025154Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:11:17.858028323Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:11:17.858030913Z [err]  Critical: No valid price data available
2026-02-03T03:11:17.858033873Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:11:17.858570338Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:11:17.858580658Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-03T03:11:17.858584358Z [inf]  Fetching premium trending tokens
2026-02-03T03:11:17.858587288Z [err]  DexScreener WS: Connection error
2026-02-03T03:11:17.858590288Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:11:18.935627348Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:11:19.576101529Z [err]  2026-02-03 03:11:19.567 UTC [27] LOG:  checkpoint starting: time
2026-02-03T03:11:20.333800325Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:11:20.333803195Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:11:20.403488404Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:11:20.483275565Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:11:20.483282285Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:11:20.559234228Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:11:20.559239808Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:11:20.713421978Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:11:20.713427828Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:11:22.084690949Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:11:23.109660526Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:11:25.124936874Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:11:29.703688266Z [err]  Error fetching trending tokens
2026-02-03T03:11:29.703691806Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:11:29.703694526Z [inf]  [TokenJob] Got 31 trending tokens for BSC
2026-02-03T03:11:29.713280006Z [err]  [TokenJob] New list too small (31) for BSC; keeping existing (100)
2026-02-03T03:11:30.837437071Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:11:50.836757148Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:11:50.836762528Z [inf]  [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
2026-02-03T03:11:50.836766178Z [inf]  Fetching premium trending tokens
2026-02-03T03:11:50.836769648Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:11:51.075313883Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:11:51.118280842Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:11:51.118287322Z [err]  Error fetching trending tokens
2026-02-03T03:11:51.118291882Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:11:51.118295882Z [inf]  [TokenJob] DexScreener returned 5 tokens, trying GeckoTerminal fallback...
2026-02-03T03:11:51.118299762Z [inf]  [TokenJob] Got 5 trending tokens for Arbitrum
2026-02-03T03:11:51.118303992Z [err]  Error fetching trending tokens
2026-02-03T03:11:51.127614694Z [inf]  Saved 5 trending tokens for arbitrum to database and memory cache
2026-02-03T03:11:51.127620364Z [inf]  [TokenJob] Saved 5 tokens for Arbitrum to DB + cache
2026-02-03T03:11:51.817243795Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:11:51.817247035Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:11:51.817250545Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:11:51.817253685Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:11:51.817286064Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:11:51.817289294Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:11:51.817292374Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:11:51.817295184Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:12:10.489452590Z [err]  2026-02-03 03:12:00.414 UTC [27] LOG:  checkpoint complete: wrote 408 buffers (2.5%); 0 WAL file(s) added, 0 removed, 0 recycled; write=40.800 s, sync=0.014 s, total=40.848 s; sync files=32, longest=0.005 s, average=0.001 s; distance=2092 kB, estimate=3804 kB; lsn=3/3C5B27F8, redo lsn=3/3C5940F8
2026-02-03T03:12:11.796119725Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:12:11.796124565Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T03:12:11.796130825Z [inf]  📊 Position P/L check
2026-02-03T03:12:11.796138804Z [err]    ageMs: 404130221,
2026-02-03T03:12:11.796138924Z [err]  [DBLock] Lock already held {
2026-02-03T03:12:11.796146864Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T03:12:11.796150174Z [err]    ttlSeconds: 240
2026-02-03T03:12:11.796154274Z [err]    expiresAt: '2026-01-29T11:00:40.912Z',
2026-02-03T03:12:11.796159814Z [err]  }
2026-02-03T03:12:11.796162764Z [err]    ageMs: 404130221
2026-02-03T03:12:11.796167174Z [err]  }
2026-02-03T03:12:11.796173674Z [inf]  [TokenJob] Skipping refresh for Optimism - another instance holds the lock
2026-02-03T03:12:11.796179884Z [err]  [DBLock] Potential stale lock detected {
2026-02-03T03:12:12.099019405Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:12:12.230652073Z [inf]  📊 Position P/L check
2026-02-03T03:12:32.238259080Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:12:32.238264099Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:12:32.238267389Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:12:32.238270739Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:12:32.238273759Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:12:32.238276549Z [inf]  0x API price received successfully
2026-02-03T03:12:32.238279389Z [err]  Critical: No valid price data available
2026-02-03T03:12:32.238282059Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:12:32.239220640Z [inf]  [TokenJob] Refreshed 7 chains in 150.6s
2026-02-03T03:12:32.239221230Z [err]  Critical: No valid price data available
2026-02-03T03:12:32.239227210Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:12:32.239230680Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:12:32.239234869Z [err]  [DBLock] Lock already held {
2026-02-03T03:12:32.239237849Z [err]    key: 'lock:tokenJob:refresh:polygon',
2026-02-03T03:12:32.239243059Z [err]    expiresAt: '2026-01-29T04:35:55.102Z',
2026-02-03T03:12:32.239245679Z [err]    ageMs: 427236033
2026-02-03T03:12:32.239248399Z [err]  }
2026-02-03T03:12:32.239251099Z [err]  [DBLock] Potential stale lock detected {
2026-02-03T03:12:32.239254409Z [err]    key: 'lock:tokenJob:refresh:polygon',
2026-02-03T03:12:32.239257149Z [err]    ageMs: 427236033,
2026-02-03T03:12:32.239259959Z [err]    ttlSeconds: 240
2026-02-03T03:12:32.239263429Z [err]  }
2026-02-03T03:12:32.239267689Z [inf]  [TokenJob] Skipping refresh for Polygon - another instance holds the lock
2026-02-03T03:12:33.674494907Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:12:34.559401641Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:12:34.559405391Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:12:34.559420300Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:12:34.559435170Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:12:34.780465501Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:12:34.780468741Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:12:35.529252513Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:12:35.529255983Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:12:35.560427896Z [inf]  📊 Position P/L check
2026-02-03T03:12:55.457855578Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:12:55.457858128Z [inf]  📊 Position P/L check
2026-02-03T03:12:55.690637056Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:12:55.812116442Z [inf]  📊 Position P/L check
2026-02-03T03:13:00.631323717Z [inf]  incoming request
2026-02-03T03:13:00.631329817Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_th2i9hl24ga9v252","createdAt":"2026-02-03T03:13:00.251Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27b856c","hash":"0xe84c9e7af980c13c72f0a96d4268859864107b1a4516112e1c75db253821d248","value":0.1,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x16345785d8a0000","decimals":18},"blockTimestamp":"0x698167bb"}],"source":"chainlake-kafka"}}
2026-02-03T03:13:00.631333337Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:13:00.631336097Z [inf]  request completed
2026-02-03T03:13:00.631338607Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0xe84c9e
2026-02-03T03:13:00.699397884Z [inf]  Swap successfully decoded from logs
2026-02-03T03:13:00.699400844Z [inf]  }
2026-02-03T03:13:00.699401334Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x4f67f521: {
2026-02-03T03:13:00.699404114Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-03T03:13:00.699406854Z [inf]  Swap detected on target wallet
2026-02-03T03:13:00.699407284Z [inf]    tokenOut: '0x9a880d57c41a83855b054770eadb49f66cce3b07',
2026-02-03T03:13:00.699410804Z [inf]    dex: 'Unknown DEX'
2026-02-03T03:13:00.699411484Z [inf]  Target is buying - triggering copy trade
2026-02-03T03:13:00.920315396Z [err]  LaunchpadDetector: Failed to load Paragraph SDK
2026-02-03T03:13:00.985651010Z [inf]  incoming request
2026-02-03T03:13:00.985654970Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_d70uwzptmv4fzio0","createdAt":"2026-02-03T03:13:00.550Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","blockNum":"0x27b856c","hash":"0xe84c9e7af980c13c72f0a96d4268859864107b1a4516112e1c75db253821d248","value":555266441.1799548,"asset":"m00n","category":"token","rawContract":{"rawValue":"0x000000000000000000000000000000000000000001cb4e3e177ee62aca8259a4","address":"0x9a880d57c41a83855b054770eadb49f66cce3b07","decimals":18},"log":{"address":"0x9a880d57c41a83855b054770eadb49f66cce3b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x0000000000000000000000004f67f52147c6bc03563772fa3d7af3adffb92110"],"data":"0x000000000000000000000000000000000000000001cb4e3e177ee62aca8259a4","blockHash":"0x30bb6311ca3eb74bceca57a85d61586a2754f1a4e5b1d1553db9bd30cefd0bca","blockNumber":"0x27b856c","blockTimestamp":"0x698167bb","transactionHash":"0xe84c9e7af980c13c72f0a96d4268859864107b1a4516112e1c75db253821d248","transactionIndex":"0x4","logIndex":"0x37","removed":false},"blockTimestamp":"0x698167bb"}],"source":"chainlake-kafka"}}
2026-02-03T03:13:00.985657650Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:13:00.985660350Z [inf]  [Webhook] Tx already in processedTxs cache: 0xe84c9e7af980c1
2026-02-03T03:13:00.985663420Z [inf]  request completed
2026-02-03T03:13:01.112678028Z [inf]  Timer finished: launchpad_det_0x9a880d57c41a83855b054770eadb49f66cce3b07
2026-02-03T03:13:01.621516779Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:13:01.621519949Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:13:01.971232720Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:13:01.971238140Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:13:01.971242149Z [inf]  🔥 Warming up 1 user settings
2026-02-03T03:13:01.975772751Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-03T03:13:01.975776301Z [inf]  📊 Mass Copy Trade Analysis
2026-02-03T03:13:01.975779181Z [inf]  📦 Processing batch 1/1
2026-02-03T03:13:02.094098990Z [inf]  Skipping trade: Insufficient gas buffer
2026-02-03T03:13:02.094108430Z [inf]  [Warpcast] Sending DM to FID 877398: "⏭️ Copy Trade Skipped: $m00n
2026-02-03T03:13:02.094115150Z [inf]  
2026-02-03T03:13:02.094119900Z [inf]  ⏭️ **COPY TRADE SKIP..."
2026-02-03T03:13:02.195228449Z [inf]  incoming request
2026-02-03T03:13:02.195231619Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_pmn0vqjxppsd0e9a","createdAt":"2026-02-03T03:13:01.921Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0x9a880d57c41a83855b054770eadb49f66cce3b07","blockNum":"0x27b856d","hash":"0x3852cb59700b9dbdc5bf334fa5eba7863806922f9698cdb7df3bcf5d743ac318","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x698167bd"}],"source":"chainlake-kafka"}}
2026-02-03T03:13:02.195234329Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:13:02.195236999Z [inf]  request completed
2026-02-03T03:13:02.195240379Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x3852cb
2026-02-03T03:13:02.297484017Z [inf]  [Warpcast] DM sent successfully. Daily usage: 30/50000
2026-02-03T03:13:02.297487957Z [inf]  ✅ Smart batch execution complete
2026-02-03T03:13:02.297490997Z [inf]  [Webhook] Not a swap tx for 0x4f67f521: 0x3852cb59700b9d
2026-02-03T03:13:05.810335771Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:13:07.056762974Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:13:07.056769043Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:13:07.056773413Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:13:07.056777003Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:13:07.228802310Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:13:07.228807780Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:13:07.228811780Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:13:07.228815659Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:13:27.225789739Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:13:27.474882266Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:13:47.473562899Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:13:47.473567559Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:13:47.473570409Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:13:47.473573389Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:13:47.473576769Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:13:47.473579359Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:13:47.473582549Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:13:47.473585619Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:13:47.474356240Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:13:49.509691103Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:13:49.635036408Z [inf]  📊 Position P/L check
2026-02-03T03:14:09.661672602Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:14:09.661686532Z [inf]  📊 Position P/L check
2026-02-03T03:14:09.923380268Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:14:10.874156498Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:14:10.874160768Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:14:10.874166067Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:14:10.874170977Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:14:10.874175897Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:14:10.874180287Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:14:10.874184037Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:14:10.874187717Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:14:10.921437751Z [inf]  📊 Position P/L check
2026-02-03T03:14:30.918041561Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:14:30.918046831Z [inf]  📊 Position P/L check
2026-02-03T03:14:31.041831643Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:14:31.177501950Z [inf]  📊 Position P/L check
2026-02-03T03:14:41.172693134Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:14:42.726486173Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:14:42.726492373Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:14:43.031397856Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:14:43.031402986Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:14:43.059709459Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:14:43.059715549Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:14:44.649827228Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:14:44.649830758Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:14:44.759335149Z [inf]  📊 Position P/L check
2026-02-03T03:15:04.755665158Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:15:04.755669988Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-03T03:15:04.755673078Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-03T03:15:04.755676088Z [inf]  Fetching premium trending tokens
2026-02-03T03:15:04.755679938Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:15:04.755683098Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-03T03:15:04.755686158Z [inf]  Timer finished: recalc_heat_scores
2026-02-03T03:15:04.755689418Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:15:04.868247298Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:15:10.124872654Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:15:11.145987801Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:15:13.155213159Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:15:15.097362981Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:15:15.770793902Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:15:15.770798242Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:15:15.770801422Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:15:15.770804592Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:15:15.931404438Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:15:15.931408798Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:15:15.931411938Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:15:15.931415968Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:15:17.179640064Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:15:17.179645344Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:15:17.179649164Z [inf]  [TokenJob] Got 28 trending tokens for Ethereum
2026-02-03T03:15:17.179652154Z [err]  GeckoTerminal API error after retries
2026-02-03T03:15:17.179655314Z [err]  Error fetching trending tokens
2026-02-03T03:15:17.184659832Z [err]  [TokenJob] New list too small (28) for Ethereum; keeping existing (100)
2026-02-03T03:15:26.085438245Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:15:46.030900649Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:15:46.030908149Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-03T03:15:46.030911959Z [inf]  Fetching premium trending tokens
2026-02-03T03:15:46.030914979Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:15:46.030917949Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:15:46.030920889Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:15:46.030924079Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-03T03:15:46.030927479Z [inf]  [TokenJob] Filtered out 2 invalid tokens for Solana
2026-02-03T03:15:46.030930369Z [inf]  Saved 98 trending tokens for solana to database and memory cache
2026-02-03T03:15:46.030933079Z [inf]  [TokenJob] Saved 98 tokens for Solana to DB + cache
2026-02-03T03:15:46.345902618Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:15:47.223192854Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:15:47.223197524Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:15:47.223201814Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:15:47.223205824Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:15:47.562943423Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:15:47.562948683Z [err]  Critical: No valid price data available
2026-02-03T03:15:47.604604296Z [inf]  0x API price received successfully
2026-02-03T03:15:47.604609016Z [err]  Critical: No valid price data available
2026-02-03T03:15:47.738130717Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:15:47.738135717Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:15:57.730650187Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:15:58.429493393Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:15:58.429498363Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:15:58.429501303Z [err]  Critical: No valid price data available
2026-02-03T03:15:58.653053890Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:15:58.653059260Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:15:58.653101510Z [err]  Critical: No valid price data available
2026-02-03T03:15:58.812856035Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:15:58.812863415Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:15:59.544543748Z [err]  [DBLock] Lock already held {
2026-02-03T03:15:59.544547858Z [err]    key: 'lock:tokenJob:refresh:base',
2026-02-03T03:15:59.544551958Z [err]    expiresAt: '2026-02-02T05:44:42.169Z',
2026-02-03T03:15:59.544555338Z [err]    ageMs: 77717367
2026-02-03T03:15:59.544558748Z [err]  }
2026-02-03T03:15:59.544561808Z [inf]  [TokenJob] Skipping refresh for Base - another instance holds the lock
2026-02-03T03:15:59.544565868Z [err]  [DBLock] Potential stale lock detected { key: 'lock:tokenJob:refresh:base', ageMs: 77717367, ttlSeconds: 240 }
2026-02-03T03:16:08.807306661Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:16:09.466998219Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:16:09.467004748Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:16:09.467008948Z [err]  Critical: No valid price data available
2026-02-03T03:16:09.492325413Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:16:09.492330143Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:16:09.492333603Z [err]  Critical: No valid price data available
2026-02-03T03:16:09.686452748Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:16:09.686455908Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:16:19.565287832Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-03T03:16:19.565292902Z [inf]  Fetching premium trending tokens
2026-02-03T03:16:19.611030303Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:16:19.611037653Z [err]  DexScreener WS: Connection error
2026-02-03T03:16:19.668789237Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:16:20.464499789Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:16:20.464505149Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:16:20.889243759Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:16:20.889250299Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:16:21.190236855Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:16:21.190245975Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:16:21.375291346Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:16:21.375294906Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:16:21.533660257Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:16:23.376408578Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:16:24.359894793Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:16:26.379502841Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:16:29.205789814Z [err]  2026-02-03 03:16:19.513 UTC [27] LOG:  checkpoint starting: time
2026-02-03T03:16:31.079485186Z [err]  Error fetching trending tokens
2026-02-03T03:16:31.079489736Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:16:31.079492776Z [inf]  [TokenJob] Got 31 trending tokens for BSC
2026-02-03T03:16:31.090157084Z [err]  [TokenJob] New list too small (31) for BSC; keeping existing (100)
2026-02-03T03:16:31.457139888Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:16:51.459079235Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:16:51.459085484Z [inf]  [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
2026-02-03T03:16:51.459090134Z [inf]  Fetching premium trending tokens
2026-02-03T03:16:51.459094774Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:16:51.703707502Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:16:52.769508486Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:16:52.769511956Z [err]  Error fetching trending tokens
2026-02-03T03:16:52.769514776Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:16:52.769518196Z [inf]  [TokenJob] DexScreener returned 5 tokens, trying GeckoTerminal fallback...
2026-02-03T03:16:52.769520566Z [err]  Error fetching trending tokens
2026-02-03T03:16:52.769523526Z [inf]  [TokenJob] Got 5 trending tokens for Arbitrum
2026-02-03T03:16:52.800150995Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:16:52.800156315Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:16:52.800160965Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:16:52.800165025Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:16:52.806711836Z [inf]  Saved 5 trending tokens for arbitrum to database and memory cache
2026-02-03T03:16:52.823711158Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:16:52.823717388Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:16:52.824493930Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:16:52.824499630Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:16:52.827294431Z [inf]  [TokenJob] Saved 5 tokens for Arbitrum to DB + cache
2026-02-03T03:16:59.150092575Z [err]  2026-02-03 03:16:57.963 UTC [27] LOG:  checkpoint complete: wrote 382 buffers (2.3%); 0 WAL file(s) added, 0 removed, 0 recycled; write=38.194 s, sync=0.058 s, total=38.451 s; sync files=32, longest=0.028 s, average=0.002 s; distance=2343 kB, estimate=3658 kB; lsn=3/3C7FFBD8, redo lsn=3/3C7DDEF8
2026-02-03T03:17:12.828629016Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:17:12.828637356Z [inf]  📊 Position P/L check
2026-02-03T03:17:12.852284808Z [inf]  [TokenJob] Skipping refresh for Optimism - another instance holds the lock
2026-02-03T03:17:12.852289918Z [err]  [DBLock] Lock already held {
2026-02-03T03:17:12.852293818Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T03:17:12.852297798Z [err]    expiresAt: '2026-01-29T11:00:40.912Z',
2026-02-03T03:17:12.852302178Z [err]    ageMs: 404431937
2026-02-03T03:17:12.852306038Z [err]  }
2026-02-03T03:17:12.852310878Z [err]  [DBLock] Potential stale lock detected {
2026-02-03T03:17:12.852314408Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T03:17:12.852318308Z [err]    ageMs: 404431937,
2026-02-03T03:17:12.852322188Z [err]    ttlSeconds: 240
2026-02-03T03:17:12.852325788Z [err]  }
2026-02-03T03:17:13.092064436Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:17:13.224017064Z [inf]  📊 Position P/L check
2026-02-03T03:17:20.497354303Z [inf]  incoming request
2026-02-03T03:17:20.498645860Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_t14skymkkg6qribo","createdAt":"2026-02-03T03:17:20.173Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27b85ee","hash":"0xdf3c73766fb38b2813a5b35b38ece3c2c9092d76c66e18b9d5d5b9f10391a3fd","value":0.2,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x2c68af0bb140000","decimals":18},"blockTimestamp":"0x698168bf"}],"source":"chainlake-kafka"}}
2026-02-03T03:17:20.498651620Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:17:20.498773798Z [inf]  request completed
2026-02-03T03:17:20.503737496Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0xdf3c73
2026-02-03T03:17:20.545718466Z [inf]  incoming request
2026-02-03T03:17:20.545722316Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_2jpv01o2xju1tmf6","createdAt":"2026-02-03T03:17:20.276Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","blockNum":"0x27b85ee","hash":"0xdf3c73766fb38b2813a5b35b38ece3c2c9092d76c66e18b9d5d5b9f10391a3fd","value":104060343.9365918,"asset":"TCRUST","category":"token","rawContract":{"rawValue":"0x0000000000000000000000000000000000000000005613a28c5c36e6375950b5","address":"0x383283f086365fa8da4fa3fecc6402479e8eb3bc","decimals":18},"log":{"address":"0x383283f086365fa8da4fa3fecc6402479e8eb3bc","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x0000000000000000000000004f67f52147c6bc03563772fa3d7af3adffb92110"],"data":"0x0000000000000000000000000000000000000000005613a28c5c36e6375950b5","blockHash":"0x4394c6f2cddaeef97562c29bb2a030ef7e40b500a4a38d36a4bc137099b5b7d7","blockNumber":"0x27b85ee","blockTimestamp":"0x698168bf","transactionHash":"0xdf3c73766fb38b2813a5b35b38ece3c2c9092d76c66e18b9d5d5b9f10391a3fd","transactionIndex":"0xa6","logIndex":"0x38a","removed":false},"blockTimestamp":"0x698168bf"}],"source":"chainlake-kafka"}}
2026-02-03T03:17:20.545726916Z [inf]  request completed
2026-02-03T03:17:20.545731116Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:17:20.545734696Z [inf]  [Webhook] Tx already in processedTxs cache: 0xdf3c73766fb38b
2026-02-03T03:17:20.710116315Z [inf]  Swap successfully decoded from logs
2026-02-03T03:17:20.710121205Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x4f67f521: {
2026-02-03T03:17:20.710125145Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-03T03:17:20.710129015Z [inf]    tokenOut: '0x383283f086365fa8da4fa3fecc6402479e8eb3bc',
2026-02-03T03:17:20.710132485Z [inf]    dex: 'Unknown DEX'
2026-02-03T03:17:20.710137605Z [inf]  }
2026-02-03T03:17:20.710140995Z [inf]  Swap detected on target wallet
2026-02-03T03:17:20.710145705Z [inf]  Target is buying - triggering copy trade
2026-02-03T03:17:23.223501577Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:17:24.164388670Z [err]  LaunchpadDetector: Failed to load Paragraph SDK
2026-02-03T03:17:24.194986480Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:17:24.194997670Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:17:24.341146229Z [inf]  Timer finished: launchpad_det_0x383283f086365fa8da4fa3fecc6402479e8eb3bc
2026-02-03T03:17:24.341153779Z [inf]  🔥 Warming up 1 user settings
2026-02-03T03:17:24.346349184Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-03T03:17:24.346353244Z [inf]  📊 Mass Copy Trade Analysis
2026-02-03T03:17:24.346355954Z [inf]  📦 Processing batch 1/1
2026-02-03T03:17:24.536151456Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:17:24.536154536Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:17:24.536158256Z [inf]  Skipping trade: Insufficient gas buffer
2026-02-03T03:17:24.536161396Z [inf]  [Warpcast] Sending DM to FID 877398: "⏭️ Copy Trade Skipped: $TCRUST
2026-02-03T03:17:24.536164466Z [inf]  
2026-02-03T03:17:24.536167646Z [inf]  ⏭️ **COPY TRADE SK..."
2026-02-03T03:17:24.536438764Z [inf]  0x API price received successfully
2026-02-03T03:17:24.536442994Z [err]  Critical: No valid price data available
2026-02-03T03:17:24.783651574Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:17:24.783658454Z [err]  Critical: No valid price data available
2026-02-03T03:17:24.798744385Z [inf]  [Warpcast] DM sent successfully. Daily usage: 31/50000
2026-02-03T03:17:24.798751265Z [inf]  ✅ Smart batch execution complete
2026-02-03T03:17:24.891467365Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:17:24.891471715Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:17:32.857807549Z [err]  [DBLock] Lock already held {
2026-02-03T03:17:32.857812979Z [err]    key: 'lock:tokenJob:refresh:polygon',
2026-02-03T03:17:32.857816479Z [err]    expiresAt: '2026-01-29T04:35:55.102Z',
2026-02-03T03:17:32.857820679Z [err]    ageMs: 427537749
2026-02-03T03:17:32.857823909Z [err]  }
2026-02-03T03:17:32.857827359Z [inf]  [TokenJob] Skipping refresh for Polygon - another instance holds the lock
2026-02-03T03:17:32.857831189Z [inf]  [TokenJob] Refreshed 7 chains in 152.1s
2026-02-03T03:17:32.857835949Z [err]  [DBLock] Potential stale lock detected {
2026-02-03T03:17:32.857839459Z [err]    key: 'lock:tokenJob:refresh:polygon',
2026-02-03T03:17:32.857843209Z [err]    ageMs: 427537749,
2026-02-03T03:17:32.857847199Z [err]    ttlSeconds: 240
2026-02-03T03:17:32.857850769Z [err]  }
2026-02-03T03:17:34.889172101Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:17:35.802469886Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:17:35.802474726Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:17:36.174838565Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:17:36.174844055Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:17:36.330828081Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:17:36.330832351Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:17:36.581856181Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:17:36.581860111Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:17:36.778082556Z [inf]  📊 Position P/L check
2026-02-03T03:17:56.775920701Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:17:56.775925661Z [inf]  📊 Position P/L check
2026-02-03T03:17:56.775928731Z [inf]  incoming request
2026-02-03T03:17:56.775932121Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_tcx5lk8s7q6c2yn8","createdAt":"2026-02-03T03:17:54.105Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27b85ff","hash":"0xc2481dc789d2093bb00fbaa51c24d64631d1f3d67db5e54a2bd350e25f5bcd2b","value":0.3,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x429d069189e0000","decimals":18},"blockTimestamp":"0x698168e1"}],"source":"chainlake-kafka"}}
2026-02-03T03:17:56.775935291Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:17:56.775938581Z [inf]  request completed
2026-02-03T03:17:56.775941571Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0xc2481d
2026-02-03T03:17:56.775944421Z [inf]  Swap successfully decoded from logs
2026-02-03T03:17:56.776686973Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x4f67f521: {
2026-02-03T03:17:56.776690213Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-03T03:17:56.776692943Z [inf]    tokenOut: '0x383283f086365fa8da4fa3fecc6402479e8eb3bc',
2026-02-03T03:17:56.776696063Z [inf]    dex: 'Unknown DEX'
2026-02-03T03:17:56.776701573Z [inf]  }
2026-02-03T03:17:56.776705223Z [inf]  Swap detected on target wallet
2026-02-03T03:17:56.776819352Z [inf]  Target is buying - triggering copy trade
2026-02-03T03:17:56.776822732Z [inf]  🔥 Warming up 1 user settings
2026-02-03T03:17:56.776825392Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-03T03:17:56.776828112Z [inf]  📊 Mass Copy Trade Analysis
2026-02-03T03:17:56.778083999Z [inf]  📦 Processing batch 1/1
2026-02-03T03:17:56.778089408Z [inf]  incoming request
2026-02-03T03:17:56.778092778Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_lwwtx9wmi206heb9","createdAt":"2026-02-03T03:17:54.235Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","blockNum":"0x27b85ff","hash":"0xc2481dc789d2093bb00fbaa51c24d64631d1f3d67db5e54a2bd350e25f5bcd2b","value":143354727.7041045,"asset":"TCRUST","category":"token","rawContract":{"rawValue":"0x00000000000000000000000000000000000000000076948b5c5317dccc7eaaf1","address":"0x383283f086365fa8da4fa3fecc6402479e8eb3bc","decimals":18},"log":{"address":"0x383283f086365fa8da4fa3fecc6402479e8eb3bc","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x0000000000000000000000004f67f52147c6bc03563772fa3d7af3adffb92110"],"data":"0x00000000000000000000000000000000000000000076948b5c5317dccc7eaaf1","blockHash":"0x87ee777693ef1ba2e0d57e2b1dfd4633bdf370393097c133b6f070717911906d","blockNumber":"0x27b85ff","blockTimestamp":"0x698168e1","transactionHash":"0xc2481dc789d2093bb00fbaa51c24d64631d1f3d67db5e54a2bd350e25f5bcd2b","transactionIndex":"0x1","logIndex":"0x10","removed":false},"blockTimestamp":"0x698168e1"}],"source":"chainlake-kafka"}}
2026-02-03T03:17:56.778095908Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:17:56.779093558Z [inf]  [Webhook] Tx already in processedTxs cache: 0xc2481dc789d209
2026-02-03T03:17:56.779097208Z [inf]  request completed
2026-02-03T03:17:56.779099798Z [inf]  Skipping trade: Insufficient gas buffer
2026-02-03T03:17:56.779102528Z [inf]  [Warpcast] Sending DM to FID 877398: "⏭️ Copy Trade Skipped: $TCRUST
2026-02-03T03:17:56.779106678Z [inf]  
2026-02-03T03:17:56.779109938Z [inf]  ⏭️ **COPY TRADE SK..."
2026-02-03T03:17:56.779112448Z [inf]  [Warpcast] DM sent successfully. Daily usage: 32/50000
2026-02-03T03:17:56.779114868Z [inf]  ✅ Smart batch execution complete
2026-02-03T03:17:56.888022317Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:17:57.009555284Z [inf]  📊 Position P/L check
2026-02-03T03:18:17.005883034Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:18:17.005887884Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:18:17.005891333Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:18:17.005894193Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:18:17.005896643Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:18:17.005898883Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:18:17.005901113Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:18:17.005903523Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:18:17.006319879Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0xab9bb3
2026-02-03T03:18:17.006323039Z [inf]  Swap successfully decoded from logs
2026-02-03T03:18:17.006327039Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x1b49e23c: {
2026-02-03T03:18:17.006335818Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:18:17.006342778Z [inf]  incoming request
2026-02-03T03:18:17.006346988Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_on71xvol4mrq87jp","createdAt":"2026-02-03T03:18:08.079Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x1b49e23c977ceb8bea8806fff6df1a942ca9a984","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27b8606","hash":"0xab9bb3755d71b5f99afdab16aa2d12b6fa30b2464fed066b066846983aa55af6","value":0.1,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x16345785d8a0000","decimals":18},"blockTimestamp":"0x698168ef"}],"source":"chainlake-kafka"}}
2026-02-03T03:18:17.006350848Z [inf]  request completed
2026-02-03T03:18:17.006354358Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:18:17.006868574Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-03T03:18:17.006872273Z [inf]    tokenOut: '0xda15854df692c0c4415315909e69d44e54f76b07',
2026-02-03T03:18:17.006875333Z [inf]    dex: 'Unknown DEX'
2026-02-03T03:18:17.006878513Z [inf]  }
2026-02-03T03:18:17.006882323Z [inf]  Swap detected on target wallet
2026-02-03T03:18:17.006885523Z [inf]  Target is buying - triggering copy trade
2026-02-03T03:18:17.006889223Z [err]  LaunchpadDetector: Failed to load Paragraph SDK
2026-02-03T03:18:17.006898953Z [inf]  incoming request
2026-02-03T03:18:17.006903063Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_au2mtl5hlge9ce6b","createdAt":"2026-02-03T03:18:08.187Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0x1b49e23c977ceb8bea8806fff6df1a942ca9a984","blockNum":"0x27b8606","hash":"0xab9bb3755d71b5f99afdab16aa2d12b6fa30b2464fed066b066846983aa55af6","value":212179851.6043694,"asset":"BAZAAR","category":"token","rawContract":{"rawValue":"0x000000000000000000000000000000000000000000af82d4cda8b42106a935e7","address":"0xda15854df692c0c4415315909e69d44e54f76b07","decimals":18},"log":{"address":"0xda15854df692c0c4415315909e69d44e54f76b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x0000000000000000000000001b49e23c977ceb8bea8806fff6df1a942ca9a984"],"data":"0x000000000000000000000000000000000000000000af82d4cda8b42106a935e7","blockHash":"0x00020c06cbd3c607a8d8ac6ddb1e0d55527caa7c0df0587177ec26cb5906f971","blockNumber":"0x27b8606","blockTimestamp":"0x698168ef","transactionHash":"0xab9bb3755d71b5f99afdab16aa2d12b6fa30b2464fed066b066846983aa55af6","transactionIndex":"0x96","logIndex":"0x33e","removed":false},"blockTimestamp":"0x698168ef"}],"source":"chainlake-kafka"}}
2026-02-03T03:18:17.007442347Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:18:17.007448047Z [inf]  [Webhook] Tx already in processedTxs cache: 0xab9bb3755d71b5
2026-02-03T03:18:17.007452407Z [inf]  request completed
2026-02-03T03:18:17.007457387Z [inf]  Timer finished: launchpad_det_0xda15854df692c0c4415315909e69d44e54f76b07
2026-02-03T03:18:17.007461227Z [inf]  On-chain price fetched from Uniswap V3
2026-02-03T03:18:17.007465017Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:18:17.007468697Z [inf]  🔥 Warming up 1 user settings
2026-02-03T03:18:17.007472087Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-03T03:18:17.008256649Z [inf]  No eligible users after batch filter
2026-02-03T03:18:17.008257159Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:18:17.008260129Z [inf]  request completed
2026-02-03T03:18:17.008260659Z [inf]  [Warpcast] Sending DM to FID 877398: "⏭️ Copy Trade Skipped: $BAZAAR
2026-02-03T03:18:17.008263659Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0xa01b28
2026-02-03T03:18:17.008264259Z [inf]  
2026-02-03T03:18:17.008267509Z [inf]  ⏭️ **COPY TRADE SK..."
2026-02-03T03:18:17.008270429Z [inf]  [Warpcast] DM sent successfully. Daily usage: 33/50000
2026-02-03T03:18:17.008273339Z [inf]  incoming request
2026-02-03T03:18:17.008276579Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_6fraylgsm2z8v3p5","createdAt":"2026-02-03T03:18:10.177Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x1b49e23c977ceb8bea8806fff6df1a942ca9a984","toAddress":"0xda15854df692c0c4415315909e69d44e54f76b07","blockNum":"0x27b8607","hash":"0xa01b28d486a244c5bec512efc5d8f15ae5d68bfdadd1811fd0b9e7e90dbe2e5e","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x698168f1"}],"source":"chainlake-kafka"}}
2026-02-03T03:18:17.008666644Z [inf]  [Webhook] Not a swap tx for 0x1b49e23c: 0xa01b28d486a244
2026-02-03T03:18:18.307042798Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:18:38.306904338Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:18:38.738993204Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:18:40.030106694Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:18:40.030111064Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:18:40.230177119Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:18:40.230183709Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:18:40.507309797Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:18:40.507315387Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:18:41.111894276Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:18:41.111897976Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:19:01.112587128Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:19:01.112590617Z [inf]  📊 Position P/L check
2026-02-03T03:19:01.513566370Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:19:01.630932471Z [inf]  📊 Position P/L check
2026-02-03T03:19:21.624588893Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:19:21.624594273Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:19:21.624598173Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:19:21.624601203Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:19:21.624604293Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:19:21.624607743Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:19:21.624611353Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:19:21.624614263Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:19:21.625415834Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:19:21.625421354Z [inf]  📊 Position P/L check
2026-02-03T03:19:22.941611564Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:19:22.995693517Z [inf]  📊 Position P/L check
2026-02-03T03:19:32.993804331Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:19:33.112787016Z [inf]  📊 Position P/L check
2026-02-03T03:19:43.104655781Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:19:44.080710013Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:19:44.080714083Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:19:44.247804203Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:19:44.247813503Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:19:44.509072428Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:19:44.509076488Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:19:44.525093870Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:19:44.525098300Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:19:44.641693889Z [inf]  📊 Position P/L check
2026-02-03T03:20:04.638956177Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:20:04.638961607Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-03T03:20:04.638965267Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-03T03:20:04.638968457Z [inf]  Fetching premium trending tokens
2026-02-03T03:20:04.638971737Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:20:04.638975167Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-03T03:20:04.638977967Z [inf]  Timer finished: recalc_heat_scores
2026-02-03T03:20:04.638981697Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:20:04.777640385Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:20:08.192845154Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:20:09.200443276Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:20:11.225614697Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:20:15.061329545Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:20:15.260913546Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:20:15.260918536Z [err]  GeckoTerminal API error after retries
2026-02-03T03:20:15.260921616Z [err]  Error fetching trending tokens
2026-02-03T03:20:15.260924126Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:20:15.260927916Z [inf]  [TokenJob] Got 28 trending tokens for Ethereum
2026-02-03T03:20:15.260931626Z [err]  [TokenJob] New list too small (28) for Ethereum; keeping existing (100)
2026-02-03T03:20:16.078239090Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:20:16.078242590Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:20:16.078245810Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:20:16.078249640Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:20:16.888522489Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:20:16.888526659Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:20:16.888529589Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:20:16.888532209Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:20:36.888231203Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:20:36.888235763Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-03T03:20:36.888239783Z [inf]  Fetching premium trending tokens
2026-02-03T03:20:36.888243393Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:20:36.888247073Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:20:36.888250643Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:20:36.888254963Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-03T03:20:36.888258443Z [inf]  [TokenJob] Filtered out 2 invalid tokens for Solana
2026-02-03T03:20:36.895545677Z [inf]  Saved 98 trending tokens for solana to database and memory cache
2026-02-03T03:20:36.909897366Z [inf]  [TokenJob] Saved 98 tokens for Solana to DB + cache
2026-02-03T03:20:37.157801222Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:20:57.197925957Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:20:57.197935847Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:20:57.197940687Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:20:57.197944677Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:20:57.197949247Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:20:57.197955877Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:20:57.197959777Z [err]  Critical: No valid price data available
2026-02-03T03:20:57.197963566Z [inf]  0x API price received successfully
2026-02-03T03:20:57.198640800Z [err]  Critical: No valid price data available
2026-02-03T03:20:57.198648530Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:20:57.198653120Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:20:57.198658190Z [err]  [DBLock] Lock already held {
2026-02-03T03:20:57.198662150Z [err]    key: 'lock:tokenJob:refresh:base',
2026-02-03T03:20:57.198666590Z [err]    expiresAt: '2026-02-02T05:44:42.169Z',
2026-02-03T03:20:57.198670769Z [err]    ageMs: 78014752
2026-02-03T03:20:57.198676589Z [err]  }
2026-02-03T03:20:57.198681629Z [err]  [DBLock] Potential stale lock detected { key: 'lock:tokenJob:refresh:base', ageMs: 78014752, ttlSeconds: 240 }
2026-02-03T03:20:57.198685839Z [inf]  [TokenJob] Skipping refresh for Base - another instance holds the lock
2026-02-03T03:20:58.858261099Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:20:59.692733725Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:20:59.692738375Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:20:59.692740855Z [err]  Critical: No valid price data available
2026-02-03T03:20:59.792917377Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:20:59.792921247Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:20:59.792924077Z [err]  Critical: No valid price data available
2026-02-03T03:20:59.907813124Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:20:59.907817974Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:21:19.897533662Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:21:19.897540032Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:21:19.897544062Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:21:19.897549441Z [err]  Critical: No valid price data available
2026-02-03T03:21:19.897553031Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:21:19.897556361Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:21:19.897559311Z [err]  Critical: No valid price data available
2026-02-03T03:21:19.897562271Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:21:19.898196705Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:21:19.898201695Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-03T03:21:19.898204795Z [inf]  Fetching premium trending tokens
2026-02-03T03:21:19.898210855Z [err]  DexScreener WS: Connection error
2026-02-03T03:21:19.898214995Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:21:19.898217545Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:21:20.882209687Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:21:21.563345168Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:21:21.563354348Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:21:21.568724882Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:21:21.568730572Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:21:21.590045849Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:21:21.590050149Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:21:21.825493884Z [err]  Error fetching trending tokens
2026-02-03T03:21:21.825498554Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:21:21.825502404Z [inf]  [TokenJob] Got 31 trending tokens for BSC
2026-02-03T03:21:21.825507314Z [err]  [TokenJob] New list too small (31) for BSC; keeping existing (100)
2026-02-03T03:21:22.605027156Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:21:22.606186454Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:21:24.621388534Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:21:24.625815028Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:21:28.900485521Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:21:28.900489711Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:21:29.572736670Z [err]  2026-02-03 03:21:20.062 UTC [27] LOG:  checkpoint starting: time
2026-02-03T03:21:30.320964605Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:21:30.320973035Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:21:50.378162745Z [inf]  [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
2026-02-03T03:21:50.378171085Z [inf]  Fetching premium trending tokens
2026-02-03T03:21:50.378183215Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:21:50.378188235Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:21:50.378192855Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:21:50.378197915Z [inf]  [TokenJob] DexScreener returned 6 tokens, trying GeckoTerminal fallback...
2026-02-03T03:21:50.378202495Z [inf]  [TokenJob] Got 6 trending tokens for Arbitrum
2026-02-03T03:21:50.378206615Z [err]  Error fetching trending tokens
2026-02-03T03:21:50.378213055Z [err]  Error fetching trending tokens
2026-02-03T03:21:50.378219395Z [inf]  Saved 6 trending tokens for arbitrum to database and memory cache
2026-02-03T03:21:50.378224244Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:21:50.378913148Z [inf]  [TokenJob] Saved 6 tokens for Arbitrum to DB + cache
2026-02-03T03:21:50.584473557Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:21:59.687230231Z [err]  2026-02-03 03:21:59.011 UTC [27] LOG:  checkpoint complete: wrote 389 buffers (2.4%); 0 WAL file(s) added, 0 removed, 0 recycled; write=38.895 s, sync=0.017 s, total=38.949 s; sync files=32, longest=0.007 s, average=0.001 s; distance=2143 kB, estimate=3507 kB; lsn=3/3CA0CFC0, redo lsn=3/3C9F5CE0
2026-02-03T03:22:10.584822813Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:22:10.584829373Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:22:10.584832863Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:22:10.584835673Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:22:10.584838263Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:22:10.584841653Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:22:10.584844273Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:22:10.584847213Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:22:10.585959191Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:22:10.585966131Z [inf]  📊 Position P/L check
2026-02-03T03:22:10.585970711Z [err]  [DBLock] Lock already held {
2026-02-03T03:22:10.585975731Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T03:22:10.585979831Z [err]    expiresAt: '2026-01-29T11:00:40.912Z',
2026-02-03T03:22:10.585984651Z [err]    ageMs: 404721926
2026-02-03T03:22:10.585989311Z [err]  }
2026-02-03T03:22:10.585993671Z [inf]  [TokenJob] Skipping refresh for Optimism - another instance holds the lock
2026-02-03T03:22:10.585997521Z [err]  [DBLock] Potential stale lock detected {
2026-02-03T03:22:10.586001991Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T03:22:10.586006211Z [err]    ageMs: 404721926,
2026-02-03T03:22:10.586010311Z [err]    ttlSeconds: 240
2026-02-03T03:22:10.586014681Z [err]  }
2026-02-03T03:22:11.939672046Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:22:12.057438094Z [inf]  📊 Position P/L check
2026-02-03T03:22:22.055273466Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:22:22.184018078Z [inf]  📊 Position P/L check
2026-02-03T03:22:22.855177596Z [err]  [DBLock] Lock already held {
2026-02-03T03:22:22.855182616Z [err]    key: 'lock:tokenJob:refresh:polygon',
2026-02-03T03:22:22.855186626Z [err]    expiresAt: '2026-01-29T04:35:55.102Z',
2026-02-03T03:22:22.855190416Z [err]    ageMs: 427827738
2026-02-03T03:22:22.855194936Z [err]  }
2026-02-03T03:22:22.855198146Z [err]  [DBLock] Potential stale lock detected {
2026-02-03T03:22:22.855201806Z [err]    key: 'lock:tokenJob:refresh:polygon',
2026-02-03T03:22:22.855205146Z [err]    ageMs: 427827738,
2026-02-03T03:22:22.855208686Z [err]    ttlSeconds: 240
2026-02-03T03:22:22.855212056Z [err]  }
2026-02-03T03:22:22.855215216Z [inf]  [TokenJob] Skipping refresh for Polygon - another instance holds the lock
2026-02-03T03:22:22.855218666Z [inf]  [TokenJob] Refreshed 7 chains in 142.8s
2026-02-03T03:22:32.179643197Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:22:32.863267984Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:22:32.863275444Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:22:33.030156958Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:22:33.030162688Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:22:33.100235615Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:22:33.100241445Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:22:33.236309481Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:22:33.236315341Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:22:33.348214020Z [inf]  📊 Position P/L check
2026-02-03T03:22:53.454312764Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:22:53.454320464Z [inf]  📊 Position P/L check
2026-02-03T03:22:53.595730264Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:22:53.606450353Z [inf]  📊 Position P/L check
2026-02-03T03:23:13.610759152Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:23:13.610769912Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:23:13.610774312Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:23:13.610774902Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:23:13.610779672Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:23:13.610780892Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:23:13.610783422Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:23:13.610786252Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:23:13.611089488Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:23:14.629971449Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:23:34.691920735Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:23:34.890253480Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:23:35.819284140Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:23:35.819295690Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:23:35.900423982Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:23:35.900429232Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:23:36.087310376Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:23:36.087315786Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:23:36.323330077Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:23:36.323338087Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:23:56.333404878Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:23:56.593987371Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:23:56.751609302Z [inf]  📊 Position P/L check
2026-02-03T03:24:16.657073055Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:24:16.657077605Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:24:16.657080935Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:24:16.657084205Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:24:16.657087115Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:24:16.657090175Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:24:16.657093165Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:24:16.657096875Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:24:16.657819528Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:24:16.657824428Z [inf]  📊 Position P/L check
2026-02-03T03:24:17.993960691Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:24:18.144710804Z [inf]  📊 Position P/L check
2026-02-03T03:24:28.139643898Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:24:28.263787489Z [inf]  📊 Position P/L check
2026-02-03T03:24:38.258992522Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:24:39.090226977Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:24:39.090232207Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:24:39.250139075Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:24:39.250143355Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:24:39.349700123Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:24:39.349708302Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:24:39.648190941Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:24:39.648194361Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:24:39.904348651Z [inf]  📊 Position P/L check
2026-02-03T03:24:49.784901655Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:25:09.783965782Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:25:09.783970372Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-03T03:25:09.783973892Z [inf]  Fetching premium trending tokens
2026-02-03T03:25:09.783976822Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:25:09.783979692Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-03T03:25:09.783982672Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-03T03:25:09.783985272Z [inf]  Timer finished: recalc_heat_scores
2026-02-03T03:25:09.783987962Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:25:09.783990562Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:25:10.029429395Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:25:10.168637089Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:25:11.195613827Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:25:11.195619147Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:25:11.195623327Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:25:11.195627507Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:25:11.412916924Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:25:11.412921694Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:25:11.412924584Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:25:11.412927244Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:25:12.192157504Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:25:16.207489564Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:25:16.207494534Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:25:16.207497914Z [inf]  [TokenJob] Got 28 trending tokens for Ethereum
2026-02-03T03:25:16.207500934Z [err]  GeckoTerminal API error after retries
2026-02-03T03:25:16.207503983Z [err]  Error fetching trending tokens
2026-02-03T03:25:16.217077223Z [err]  [TokenJob] New list too small (28) for Ethereum; keeping existing (100)
2026-02-03T03:25:21.530123230Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:25:41.533293247Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:25:41.533299277Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-03T03:25:41.533304557Z [inf]  Fetching premium trending tokens
2026-02-03T03:25:41.533312577Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:25:41.533319157Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:25:41.533324757Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:25:41.533329287Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-03T03:25:41.533334367Z [inf]  [TokenJob] Filtered out 2 invalid tokens for Solana
2026-02-03T03:25:41.533339907Z [inf]  Saved 98 trending tokens for solana to database and memory cache
2026-02-03T03:25:41.533345747Z [inf]  [TokenJob] Saved 98 tokens for Solana to DB + cache
2026-02-03T03:25:41.774698943Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:25:42.462952064Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:25:42.462956554Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:25:42.571260540Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:25:42.571265210Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:25:42.908098838Z [inf]  0x API price received successfully
2026-02-03T03:25:42.908104498Z [err]  Critical: No valid price data available
2026-02-03T03:25:43.077180860Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:25:43.077184970Z [err]  Critical: No valid price data available
2026-02-03T03:25:43.112086524Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:25:43.112090564Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:26:03.036662810Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:26:03.036667620Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:26:03.036672130Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:26:03.036674980Z [err]  Critical: No valid price data available
2026-02-03T03:26:03.036677670Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:26:03.036680480Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:26:03.036683260Z [err]  Critical: No valid price data available
2026-02-03T03:26:03.036685770Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:26:03.037668020Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:26:03.037672860Z [err]  [DBLock] Lock already held {
2026-02-03T03:26:03.037676870Z [err]    key: 'lock:tokenJob:refresh:base',
2026-02-03T03:26:03.037681090Z [err]    expiresAt: '2026-02-02T05:44:42.169Z',
2026-02-03T03:26:03.037684630Z [err]    ageMs: 78316184
2026-02-03T03:26:03.037688750Z [err]  }
2026-02-03T03:26:03.037692590Z [err]  [DBLock] Potential stale lock detected { key: 'lock:tokenJob:refresh:base', ageMs: 78316184, ttlSeconds: 240 }
2026-02-03T03:26:03.037696340Z [inf]  [TokenJob] Skipping refresh for Base - another instance holds the lock
2026-02-03T03:26:04.041982626Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:26:04.860873411Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:26:04.860878681Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:26:04.860881961Z [err]  Critical: No valid price data available
2026-02-03T03:26:04.913811478Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:26:04.913815728Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:26:04.913819498Z [err]  Critical: No valid price data available
2026-02-03T03:26:05.031052341Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:26:05.031056281Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:26:15.030020334Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:26:15.874975267Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:26:15.874980457Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:26:15.879587699Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:26:15.879598178Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:26:16.225393092Z [inf]  0x API price received successfully
2026-02-03T03:26:16.225404302Z [err]  Critical: No valid price data available
2026-02-03T03:26:16.236374008Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:26:16.236381908Z [err]  Critical: No valid price data available
2026-02-03T03:26:16.338468039Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:26:16.338474639Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:26:18.378449104Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-03T03:26:18.378453454Z [inf]  Fetching premium trending tokens
2026-02-03T03:26:18.418865511Z [err]  DexScreener WS: Connection error
2026-02-03T03:26:18.418872311Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:26:21.484662327Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:26:24.879963667Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:26:25.898151419Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:26:26.336750161Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:26:27.258414682Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:26:27.258420972Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:26:27.258425552Z [err]  Critical: No valid price data available
2026-02-03T03:26:27.278738170Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:26:27.278749399Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:26:27.278754759Z [err]  Critical: No valid price data available
2026-02-03T03:26:27.285617796Z [err]  2026-02-03 03:26:20.110 UTC [27] LOG:  checkpoint starting: time
2026-02-03T03:26:27.402154109Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:26:27.402166809Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:26:28.419708366Z [err]  Error fetching trending tokens
2026-02-03T03:26:28.419717396Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:26:28.419722456Z [inf]  [TokenJob] Got 31 trending tokens for BSC
2026-02-03T03:26:28.420312951Z [err]  [TokenJob] New list too small (31) for BSC; keeping existing (100)
2026-02-03T03:26:37.403608869Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:26:38.324384059Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:26:38.324390479Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:26:38.324395379Z [err]  Critical: No valid price data available
2026-02-03T03:26:38.538230183Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:26:38.538234953Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:26:38.538238393Z [err]  Critical: No valid price data available
2026-02-03T03:26:38.672074873Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:26:38.672081843Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:26:48.439690292Z [inf]  [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
2026-02-03T03:26:48.439693591Z [inf]  Fetching premium trending tokens
2026-02-03T03:26:48.439697071Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:26:48.663374412Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:26:49.421581043Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:26:49.421589873Z [err]  Error fetching trending tokens
2026-02-03T03:26:49.421594563Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:26:49.421598372Z [inf]  [TokenJob] DexScreener returned 6 tokens, trying GeckoTerminal fallback...
2026-02-03T03:26:49.421601692Z [inf]  [TokenJob] Got 6 trending tokens for Arbitrum
2026-02-03T03:26:49.421605992Z [err]  Error fetching trending tokens
2026-02-03T03:26:49.425918227Z [inf]  Saved 6 trending tokens for arbitrum to database and memory cache
2026-02-03T03:26:49.430610848Z [inf]  [TokenJob] Saved 6 tokens for Arbitrum to DB + cache
2026-02-03T03:26:50.107944325Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:26:50.107948655Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:26:50.452567450Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:26:50.452570520Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:26:50.457310040Z [inf]  0x API price received successfully
2026-02-03T03:26:50.457314270Z [err]  Critical: No valid price data available
2026-02-03T03:26:50.809014702Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:26:50.809018652Z [err]  Critical: No valid price data available
2026-02-03T03:26:50.943877352Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:26:50.943881562Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:27:07.108419645Z [err]  2026-02-03 03:26:59.244 UTC [27] LOG:  checkpoint complete: wrote 390 buffers (2.4%); 0 WAL file(s) added, 0 removed, 0 recycled; write=38.999 s, sync=0.058 s, total=39.134 s; sync files=32, longest=0.034 s, average=0.002 s; distance=2224 kB, estimate=3378 kB; lsn=3/3CC42460, redo lsn=3/3CC21CF0
2026-02-03T03:27:10.942291269Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:27:10.942298049Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:27:10.942301969Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:27:10.942305029Z [err]  Critical: No valid price data available
2026-02-03T03:27:10.942308559Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:27:10.942311629Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:27:10.942314719Z [err]  Critical: No valid price data available
2026-02-03T03:27:10.942318069Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:27:10.943415508Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:27:10.943420418Z [err]  [DBLock] Lock already held {
2026-02-03T03:27:10.943423878Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T03:27:10.943426607Z [err]    expiresAt: '2026-01-29T11:00:40.912Z',
2026-02-03T03:27:10.943429367Z [err]    ageMs: 405028517
2026-02-03T03:27:10.943431937Z [err]  }
2026-02-03T03:27:10.943434627Z [err]  [DBLock] Potential stale lock detected {
2026-02-03T03:27:10.943437897Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T03:27:10.943441527Z [err]    ageMs: 405028517,
2026-02-03T03:27:10.943444247Z [err]    ttlSeconds: 240
2026-02-03T03:27:10.943446917Z [err]  }
2026-02-03T03:27:10.943449767Z [inf]  [TokenJob] Skipping refresh for Optimism - another instance holds the lock
2026-02-03T03:27:12.465057644Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:27:13.419910369Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:27:13.419914129Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:27:13.419918249Z [err]  Critical: No valid price data available
2026-02-03T03:27:13.483406145Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:27:13.483411115Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:27:13.483414475Z [err]  Critical: No valid price data available
2026-02-03T03:27:13.591749612Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:27:13.591754512Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:27:33.588043549Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:27:33.588049248Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:27:33.588053408Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:27:33.588057048Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:27:33.588060768Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:27:33.588064488Z [inf]  0x API price received successfully
2026-02-03T03:27:33.588068458Z [err]  Critical: No valid price data available
2026-02-03T03:27:33.588071898Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:27:33.588972429Z [err]  Critical: No valid price data available
2026-02-03T03:27:33.588985059Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:27:33.588990579Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:27:33.588995859Z [err]  [DBLock] Lock already held {
2026-02-03T03:27:33.589000189Z [err]    key: 'lock:tokenJob:refresh:polygon',
2026-02-03T03:27:33.589005919Z [err]    expiresAt: '2026-01-29T04:35:55.102Z',
2026-02-03T03:27:33.589010709Z [err]    ageMs: 428134329
2026-02-03T03:27:33.589015829Z [err]  }
2026-02-03T03:27:33.589021279Z [inf]  [TokenJob] Skipping refresh for Polygon - another instance holds the lock
2026-02-03T03:27:33.589026848Z [inf]  [TokenJob] Refreshed 7 chains in 149.2s
2026-02-03T03:27:33.589031298Z [err]  [DBLock] Potential stale lock detected {
2026-02-03T03:27:33.589036108Z [err]    key: 'lock:tokenJob:refresh:polygon',
2026-02-03T03:27:33.589041058Z [err]    ageMs: 428134329,
2026-02-03T03:27:33.589046218Z [err]    ttlSeconds: 240
2026-02-03T03:27:33.589050868Z [err]  }
2026-02-03T03:27:34.868386620Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:27:35.550465386Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:27:35.550472586Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:27:35.676892775Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:27:35.676897205Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:27:35.827893265Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:27:35.827896915Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:27:36.011722203Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:27:36.011726953Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:27:36.137508888Z [inf]  📊 Position P/L check
2026-02-03T03:27:46.127755346Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:27:46.244912741Z [inf]  📊 Position P/L check
2026-02-03T03:27:56.244448324Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:27:56.379182315Z [inf]  📊 Position P/L check
2026-02-03T03:28:16.373475035Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:28:16.373478835Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:28:16.373482145Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:28:16.373485745Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:28:16.373488955Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:28:16.373492475Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:28:16.373495995Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:28:16.373499195Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:28:16.374332636Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:28:17.182690963Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:28:37.185160493Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:28:37.468102255Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:28:38.460715915Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:28:38.460720575Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:28:38.722402889Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:28:38.722405839Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:28:38.722408809Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:28:38.722411489Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:28:38.831092262Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:28:38.831102272Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:28:46.229429911Z [inf]  incoming request
2026-02-03T03:28:46.229434561Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_di5592k5eu5q2r4u","createdAt":"2026-02-03T03:28:46.036Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27b8745","hash":"0xfe94daafd13f10fae5d40ad91801c564c3095b0bae43ff0fcc6a6f5450fdd716","value":0.001,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x38d7ea4c68000","decimals":18},"blockTimestamp":"0x69816b6d"}],"source":"chainlake-kafka"}}
2026-02-03T03:28:46.230717478Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:28:46.230723558Z [inf]  request completed
2026-02-03T03:28:46.235281401Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0xfe94da
2026-02-03T03:28:46.337114796Z [inf]  Swap successfully decoded from logs
2026-02-03T03:28:46.337119456Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x4f67f521: {
2026-02-03T03:28:46.337122206Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-03T03:28:46.337125216Z [inf]    tokenOut: '0xe66a18e3c577c7b531efc65fade284b0a88f8831',
2026-02-03T03:28:46.337128106Z [inf]    dex: 'Unknown DEX'
2026-02-03T03:28:46.337131636Z [inf]  }
2026-02-03T03:28:46.337133925Z [inf]  Swap detected on target wallet
2026-02-03T03:28:46.338519311Z [inf]  Target is buying - triggering copy trade
2026-02-03T03:28:46.421154857Z [inf]  incoming request
2026-02-03T03:28:46.421159727Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_5nm0du8x0rl15oih","createdAt":"2026-02-03T03:28:46.136Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x5f8a102c72d26fb48dfbae7d6c2f2c0d022b79e4","toAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","blockNum":"0x27b8745","hash":"0xfe94daafd13f10fae5d40ad91801c564c3095b0bae43ff0fcc6a6f5450fdd716","value":968.584284364609,"asset":"Tombot","category":"token","rawContract":{"rawValue":"0x00000000000000000000000000000000000000000000003481cea2d9a273ede2","address":"0xe66a18e3c577c7b531efc65fade284b0a88f8831","decimals":18},"log":{"address":"0xe66a18e3c577c7b531efc65fade284b0a88f8831","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000005f8a102c72d26fb48dfbae7d6c2f2c0d022b79e4","0x0000000000000000000000004f67f52147c6bc03563772fa3d7af3adffb92110"],"data":"0x00000000000000000000000000000000000000000000003481cea2d9a273ede2","blockHash":"0x23c794b481b271239dc4ce4712affdc3fc269452aa99ebe58ea77e6f2aa9fccd","blockNumber":"0x27b8745","blockTimestamp":"0x69816b6d","transactionHash":"0xfe94daafd13f10fae5d40ad91801c564c3095b0bae43ff0fcc6a6f5450fdd716","transactionIndex":"0xb5","logIndex":"0x310","removed":false},"blockTimestamp":"0x69816b6d"}],"source":"chainlake-kafka"}}
2026-02-03T03:28:46.421163597Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:28:46.421166457Z [inf]  [Webhook] Tx already in processedTxs cache: 0xfe94daafd13f10
2026-02-03T03:28:46.421170307Z [inf]  request completed
2026-02-03T03:28:46.487322635Z [err]  LaunchpadDetector: Failed to load Paragraph SDK
2026-02-03T03:28:46.747048090Z [inf]  Timer finished: launchpad_det_0xe66a18e3c577c7b531efc65fade284b0a88f8831
2026-02-03T03:28:47.178065302Z [inf]  On-chain price fetched from Uniswap V3
2026-02-03T03:28:47.178069582Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:28:47.178074812Z [inf]  🔥 Warming up 1 user settings
2026-02-03T03:28:47.178079282Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-03T03:28:47.178083902Z [inf]  📊 Mass Copy Trade Analysis
2026-02-03T03:28:47.178088452Z [inf]  📦 Processing batch 1/1
2026-02-03T03:28:47.296523354Z [inf]  Skipping trade: Insufficient gas buffer
2026-02-03T03:28:47.296527474Z [inf]  [Warpcast] Sending DM to FID 877398: "⏭️ Copy Trade Skipped: $Tombot
2026-02-03T03:28:47.296532354Z [inf]  
2026-02-03T03:28:47.296535144Z [inf]  ⏭️ **COPY TRADE SK..."
2026-02-03T03:28:47.731573545Z [inf]  [Warpcast] DM sent successfully. Daily usage: 34/50000
2026-02-03T03:28:47.731576975Z [inf]  ✅ Smart batch execution complete
2026-02-03T03:28:48.550424003Z [inf]  incoming request
2026-02-03T03:28:48.550428593Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_g5mh8ktqtudkuyve","createdAt":"2026-02-03T03:28:48.266Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0xe66a18e3c577c7b531efc65fade284b0a88f8831","blockNum":"0x27b8746","hash":"0x1a75e19e1646b6aabf2f50d9b871aa5ef83a2b0afe0e6426051f54ee3f33469c","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x69816b6f"}],"source":"chainlake-kafka"}}
2026-02-03T03:28:48.550431713Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:28:48.550434523Z [inf]  request completed
2026-02-03T03:28:48.551427772Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x1a75e1
2026-02-03T03:28:48.710926114Z [inf]  [Webhook] Not a swap tx for 0x4f67f521: 0x1a75e19e1646b6
2026-02-03T03:28:48.964341105Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:28:49.086549527Z [inf]  📊 Position P/L check
2026-02-03T03:28:54.280610326Z [inf]  incoming request
2026-02-03T03:28:54.280617816Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_tbticn13v42u73he","createdAt":"2026-02-03T03:28:54.053Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27b8749","hash":"0x45a8619cfd80cca45c620722fea1c559851fadb307b41a7727de6ac9fa611e63","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x69816b75"}],"source":"chainlake-kafka"}}
2026-02-03T03:28:54.280622685Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:28:54.281049021Z [inf]  request completed
2026-02-03T03:28:54.281841003Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x45a861
2026-02-03T03:28:54.332471514Z [inf]  incoming request
2026-02-03T03:28:54.332474953Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_zhzerrrd5y6e7pqx","createdAt":"2026-02-03T03:28:54.137Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","toAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","blockNum":"0x27b8749","hash":"0x45a8619cfd80cca45c620722fea1c559851fadb307b41a7727de6ac9fa611e63","value":0.000974996520040747,"typeTraceAddress":"CALL_0_4","asset":"ETH","category":"internal","rawContract":{"rawValue":"0x376c1113bf92b","decimals":18},"blockTimestamp":"0x69816b75"}]}}
2026-02-03T03:28:54.332477663Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:28:54.332481123Z [inf]  [Webhook] Tx already in processedTxs cache: 0x45a8619cfd80cc
2026-02-03T03:28:54.332483893Z [inf]  request completed
2026-02-03T03:28:54.395967840Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x4f67f521: {
2026-02-03T03:28:54.395973759Z [inf]    tokenIn: '0xe66a18e3c577c7b531efc65fade284b0a88f8831',
2026-02-03T03:28:54.395977529Z [inf]    tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-03T03:28:54.395980889Z [inf]    dex: 'Unknown DEX'
2026-02-03T03:28:54.395984349Z [inf]  }
2026-02-03T03:28:54.395988349Z [inf]  Swap detected on target wallet
2026-02-03T03:28:54.395992239Z [inf]  Target is selling - triggering mirror sell
2026-02-03T03:28:54.400539451Z [inf]  Mirror sell: Processing open positions for token
2026-02-03T03:28:54.405380161Z [inf]  incoming request
2026-02-03T03:28:54.405385631Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_qfujzdilrh978l41","createdAt":"2026-02-03T03:28:54.168Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0x5f8a102c72d26fb48dfbae7d6c2f2c0d022b79e4","blockNum":"0x27b8749","hash":"0x45a8619cfd80cca45c620722fea1c559851fadb307b41a7727de6ac9fa611e63","value":968.584284364609,"asset":"Tombot","category":"token","rawContract":{"rawValue":"0x00000000000000000000000000000000000000000000003481cea2d9a273ede2","address":"0xe66a18e3c577c7b531efc65fade284b0a88f8831","decimals":18},"log":{"address":"0xe66a18e3c577c7b531efc65fade284b0a88f8831","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000004f67f52147c6bc03563772fa3d7af3adffb92110","0x0000000000000000000000005f8a102c72d26fb48dfbae7d6c2f2c0d022b79e4"],"data":"0x00000000000000000000000000000000000000000000003481cea2d9a273ede2","blockHash":"0xf936c1182206b966315dff89791bcff12ba7f946010c9d04d066e74f6959333a","blockNumber":"0x27b8749","blockTimestamp":"0x69816b75","transactionHash":"0x45a8619cfd80cca45c620722fea1c559851fadb307b41a7727de6ac9fa611e63","transactionIndex":"0x1","logIndex":"0x1","removed":false},"blockTimestamp":"0x69816b75"}],"source":"chainlake-kafka"}}
2026-02-03T03:28:54.405389471Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:28:54.405392691Z [inf]  [Webhook] Tx already in processedTxs cache: 0x45a8619cfd80cc
2026-02-03T03:28:54.405396351Z [inf]  request completed
2026-02-03T03:28:59.087744660Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:28:59.204392861Z [inf]  📊 Position P/L check
2026-02-03T03:29:06.338452445Z [inf]  incoming request
2026-02-03T03:29:06.338455875Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_eyekspwsaat9u7bk","createdAt":"2026-02-03T03:29:06.129Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x1b49e23c977ceb8bea8806fff6df1a942ca9a984","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27b874f","hash":"0x94b219ce15647af069c8b5bce1564c04eabc47fbcbe2998022ec480e645470fd","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x69816b81"}],"source":"chainlake-kafka"}}
2026-02-03T03:29:06.338458625Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:29:06.338461315Z [inf]  request completed
2026-02-03T03:29:06.344120996Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x94b219
2026-02-03T03:29:06.444920832Z [inf]  incoming request
2026-02-03T03:29:06.444928102Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_juk3eb6m5b0ucmy2","createdAt":"2026-02-03T03:29:06.218Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x1b49e23c977ceb8bea8806fff6df1a942ca9a984","toAddress":"0x6ff5693b99212da76ad316178a184ab56d299b43","blockNum":"0x27b874f","hash":"0x94b219ce15647af069c8b5bce1564c04eabc47fbcbe2998022ec480e645470fd","value":212179851.6043694,"asset":"BAZAAR","category":"token","rawContract":{"rawValue":"0x000000000000000000000000000000000000000000af82d4cda8b42106a935e7","address":"0xda15854df692c0c4415315909e69d44e54f76b07","decimals":18},"log":{"address":"0xda15854df692c0c4415315909e69d44e54f76b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000001b49e23c977ceb8bea8806fff6df1a942ca9a984","0x0000000000000000000000006ff5693b99212da76ad316178a184ab56d299b43"],"data":"0x000000000000000000000000000000000000000000af82d4cda8b42106a935e7","blockHash":"0x19c270f07c158d5692fcff23bbd876bdcc43697f162a5a347eefb40c1c3d1ae6","blockNumber":"0x27b874f","blockTimestamp":"0x69816b81","transactionHash":"0x94b219ce15647af069c8b5bce1564c04eabc47fbcbe2998022ec480e645470fd","transactionIndex":"0x104","logIndex":"0x28e","removed":false},"blockTimestamp":"0x69816b81"}],"source":"chainlake-kafka"}}
2026-02-03T03:29:06.444932092Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:29:06.444935812Z [inf]  [Webhook] Tx already in processedTxs cache: 0x94b219ce15647a
2026-02-03T03:29:06.444939282Z [inf]  request completed
2026-02-03T03:29:06.459045655Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x1b49e23c: {
2026-02-03T03:29:06.459050185Z [inf]    tokenIn: '0xda15854df692c0c4415315909e69d44e54f76b07',
2026-02-03T03:29:06.459053995Z [inf]    tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-03T03:29:06.459057974Z [inf]    dex: 'Unknown DEX'
2026-02-03T03:29:06.459062294Z [inf]  }
2026-02-03T03:29:06.459065914Z [inf]  Swap detected on target wallet
2026-02-03T03:29:06.459069414Z [inf]  Target is selling - triggering mirror sell
2026-02-03T03:29:06.464703695Z [inf]  Mirror sell: Processing open positions for token
2026-02-03T03:29:06.572191862Z [inf]  incoming request
2026-02-03T03:29:06.573358400Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_k2mguc92a7ajtcgl","createdAt":"2026-02-03T03:29:06.194Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","toAddress":"0x1b49e23c977ceb8bea8806fff6df1a942ca9a984","blockNum":"0x27b874f","hash":"0x94b219ce15647af069c8b5bce1564c04eabc47fbcbe2998022ec480e645470fd","value":0.10601171760303048,"typeTraceAddress":"CALL_0_0_2","asset":"ETH","category":"internal","rawContract":{"rawValue":"0x178a11871c1f5ca","decimals":18},"blockTimestamp":"0x69816b81"}]}}
2026-02-03T03:29:06.573364410Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:29:06.573368680Z [inf]  [Webhook] Tx already in processedTxs cache: 0x94b219ce15647a
2026-02-03T03:29:06.573372960Z [inf]  request completed
2026-02-03T03:29:07.135134165Z [inf]  On-chain price fetched from Uniswap V3
2026-02-03T03:29:07.135139695Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:29:09.204353169Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:29:10.012057274Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:29:10.013118072Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:29:10.013123702Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:29:10.013127202Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:29:10.232984894Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:29:10.232991884Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:29:10.232995904Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:29:10.232999234Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:29:10.345181481Z [inf]  📊 Position P/L check
2026-02-03T03:29:18.119199944Z [inf]  incoming request
2026-02-03T03:29:18.119208004Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_4batm3tque0sfct3","createdAt":"2026-02-03T03:29:17.947Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x1b49e23c977ceb8bea8806fff6df1a942ca9a984","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27b8755","hash":"0x40bd4f885b62900b03f03cb26cec599e217a5715b420fbd519b79580ada98f23","value":0.1,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x16345785d8a0000","decimals":18},"blockTimestamp":"0x69816b8d"}],"source":"chainlake-kafka"}}
2026-02-03T03:29:18.120097145Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:29:18.120099975Z [inf]  request completed
2026-02-03T03:29:18.126777445Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x40bd4f
2026-02-03T03:29:18.232858877Z [inf]  Swap successfully decoded from logs
2026-02-03T03:29:18.232864737Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x1b49e23c: {
2026-02-03T03:29:18.232869767Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-03T03:29:18.232873577Z [inf]    tokenOut: '0xd2a7055317d0c7b316319cdadae592d0644a0b07',
2026-02-03T03:29:18.232878557Z [inf]    dex: 'Unknown DEX'
2026-02-03T03:29:18.232882836Z [inf]  }
2026-02-03T03:29:18.232887226Z [inf]  Swap detected on target wallet
2026-02-03T03:29:18.234345851Z [inf]  Target is buying - triggering copy trade
2026-02-03T03:29:18.281899153Z [inf]  incoming request
2026-02-03T03:29:18.281905243Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_6gwzhjyarw1jwu8u","createdAt":"2026-02-03T03:29:18.070Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0x1b49e23c977ceb8bea8806fff6df1a942ca9a984","blockNum":"0x27b8755","hash":"0x40bd4f885b62900b03f03cb26cec599e217a5715b420fbd519b79580ada98f23","value":187181583.81317502,"asset":"TEO","category":"token","rawContract":{"rawValue":"0x0000000000000000000000000000000000000000009ad53dfdb09bf9c3900559","address":"0xd2a7055317d0c7b316319cdadae592d0644a0b07","decimals":18},"log":{"address":"0xd2a7055317d0c7b316319cdadae592d0644a0b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x0000000000000000000000001b49e23c977ceb8bea8806fff6df1a942ca9a984"],"data":"0x0000000000000000000000000000000000000000009ad53dfdb09bf9c3900559","blockHash":"0x97b2b862207b145947e95698901a8c7b1a8e43202722051ee6385c194ea4d783","blockNumber":"0x27b8755","blockTimestamp":"0x69816b8d","transactionHash":"0x40bd4f885b62900b03f03cb26cec599e217a5715b420fbd519b79580ada98f23","transactionIndex":"0x3","logIndex":"0x29","removed":false},"blockTimestamp":"0x69816b8d"}],"source":"chainlake-kafka"}}
2026-02-03T03:29:18.281909843Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:29:18.281913123Z [inf]  [Webhook] Tx already in processedTxs cache: 0x40bd4f885b6290
2026-02-03T03:29:18.281918073Z [inf]  request completed
2026-02-03T03:29:18.460251278Z [err]  LaunchpadDetector: Failed to load Paragraph SDK
2026-02-03T03:29:18.605606069Z [inf]  Timer finished: launchpad_det_0xd2a7055317d0c7b316319cdadae592d0644a0b07
2026-02-03T03:29:18.891242562Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:29:20.233308389Z [inf]  incoming request
2026-02-03T03:29:20.233319559Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_5u6ckapexgk790n2","createdAt":"2026-02-03T03:29:19.989Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x1b49e23c977ceb8bea8806fff6df1a942ca9a984","toAddress":"0xd2a7055317d0c7b316319cdadae592d0644a0b07","blockNum":"0x27b8756","hash":"0x0bfa53bae7109f6b78578044f76c22ddc981e970fbf379e6d73936607efe8968","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x69816b8f"}],"source":"chainlake-kafka"}}
2026-02-03T03:29:20.233325729Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:29:20.233334099Z [inf]  request completed
2026-02-03T03:29:20.237398976Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x0bfa53
2026-02-03T03:29:20.346060631Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:29:20.346065461Z [inf]  [Webhook] Not a swap tx for 0x1b49e23c: 0x0bfa53bae7109f
2026-02-03T03:29:20.468838936Z [inf]  📊 Position P/L check
2026-02-03T03:29:21.605883388Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:29:21.605889608Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:29:21.605894728Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:29:21.605898308Z [inf]  🔥 Warming up 1 user settings
2026-02-03T03:29:21.606801679Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-03T03:29:21.606807209Z [inf]  No eligible users after batch filter
2026-02-03T03:29:21.606811229Z [inf]  [Warpcast] Sending DM to FID 877398: "⏭️ Copy Trade Skipped: $TEO
2026-02-03T03:29:21.606815669Z [inf]  
2026-02-03T03:29:21.606819758Z [inf]  ⏭️ **COPY TRADE SKIPP..."
2026-02-03T03:29:22.232035391Z [inf]  [Warpcast] DM sent successfully. Daily usage: 35/50000
2026-02-03T03:29:30.469111104Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:29:30.586389038Z [inf]  📊 Position P/L check
2026-02-03T03:29:50.585239745Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:29:50.585255684Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:29:50.585261774Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:29:50.585267084Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:29:50.585274084Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:29:50.585279414Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:29:50.585284264Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:29:50.585289404Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:29:50.585817289Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:29:50.585820839Z [inf]  📊 Position P/L check
2026-02-03T03:29:52.122533041Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:29:54.284237969Z [inf]  incoming request
2026-02-03T03:29:54.284243169Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_k2pm6ufm7cx286wf","createdAt":"2026-02-03T03:29:54.085Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27b8767","hash":"0x093398281585a725e1e672ca41c04f20dc3252089f761956bd5828cc3a7ff08a","value":0.35,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x4db732547630000","decimals":18},"blockTimestamp":"0x69816bb1"}],"source":"chainlake-kafka"}}
2026-02-03T03:29:54.284246139Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:29:54.284249049Z [inf]  request completed
2026-02-03T03:29:54.289367595Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x093398
2026-02-03T03:29:54.398850311Z [inf]  Swap successfully decoded from logs
2026-02-03T03:29:54.398854531Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x4f67f521: {
2026-02-03T03:29:54.398857400Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-03T03:29:54.398861370Z [inf]    tokenOut: '0xd2a7055317d0c7b316319cdadae592d0644a0b07',
2026-02-03T03:29:54.398863980Z [inf]    dex: 'Unknown DEX'
2026-02-03T03:29:54.398876510Z [inf]  }
2026-02-03T03:29:54.398880280Z [inf]  Swap detected on target wallet
2026-02-03T03:29:54.398883040Z [inf]  Target is buying - triggering copy trade
2026-02-03T03:29:54.595479375Z [inf]  incoming request
2026-02-03T03:29:54.595482555Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_bl9q5mp2507mhwxi","createdAt":"2026-02-03T03:29:54.394Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","blockNum":"0x27b8767","hash":"0x093398281585a725e1e672ca41c04f20dc3252089f761956bd5828cc3a7ff08a","value":486042135.3902045,"asset":"TEO","category":"token","rawContract":{"rawValue":"0x000000000000000000000000000000000000000001920b6cf49a2f3e47cbfd13","address":"0xd2a7055317d0c7b316319cdadae592d0644a0b07","decimals":18},"log":{"address":"0xd2a7055317d0c7b316319cdadae592d0644a0b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x0000000000000000000000004f67f52147c6bc03563772fa3d7af3adffb92110"],"data":"0x000000000000000000000000000000000000000001920b6cf49a2f3e47cbfd13","blockHash":"0xff33ca28294054025243786be5704504a782f785223e7e6c6729fa47db13635f","blockNumber":"0x27b8767","blockTimestamp":"0x69816bb1","transactionHash":"0x093398281585a725e1e672ca41c04f20dc3252089f761956bd5828cc3a7ff08a","transactionIndex":"0x1","logIndex":"0x15","removed":false},"blockTimestamp":"0x69816bb1"}],"source":"chainlake-kafka"}}
2026-02-03T03:29:54.595485785Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:29:54.595488795Z [inf]  [Webhook] Tx already in processedTxs cache: 0x093398281585a7
2026-02-03T03:29:54.595491825Z [inf]  request completed
2026-02-03T03:29:55.360689304Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:29:55.360695504Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:29:55.360698754Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:29:55.360702074Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:29:55.360705474Z [inf]  🔥 Warming up 1 user settings
2026-02-03T03:29:55.360708414Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-03T03:29:55.360710914Z [inf]  📊 Mass Copy Trade Analysis
2026-02-03T03:29:55.361393677Z [inf]  📦 Processing batch 1/1
2026-02-03T03:29:55.468637185Z [inf]  Skipping trade: Insufficient gas buffer
2026-02-03T03:29:55.468643015Z [inf]  [Warpcast] Sending DM to FID 877398: "⏭️ Copy Trade Skipped: $TEO
2026-02-03T03:29:55.468647645Z [inf]  
2026-02-03T03:29:55.468652255Z [inf]  ⏭️ **COPY TRADE SKIPP..."
2026-02-03T03:29:56.022367556Z [inf]  [Warpcast] DM sent successfully. Daily usage: 36/50000
2026-02-03T03:29:56.022373996Z [inf]  ✅ Smart batch execution complete
2026-02-03T03:29:56.259150000Z [inf]  incoming request
2026-02-03T03:29:56.259157040Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_t81h4zilm8q6kw23","createdAt":"2026-02-03T03:29:56.068Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0xd2a7055317d0c7b316319cdadae592d0644a0b07","blockNum":"0x27b8768","hash":"0x0cc9da59998d6a4b7bb506cb91ea030e50b3eeda0ac39956bcd481b65013f20c","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x69816bb3"}],"source":"chainlake-kafka"}}
2026-02-03T03:29:56.259161090Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:29:56.259164680Z [inf]  request completed
2026-02-03T03:29:56.259168950Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x0cc9da
2026-02-03T03:29:56.364437259Z [inf]  [Webhook] Not a swap tx for 0x4f67f521: 0x0cc9da59998d6a
2026-02-03T03:30:00.550337354Z [err]  [Job] Real hot users file not found: 
2026-02-03T03:30:00.552643749Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-03T03:30:00.552647539Z [inf]  [Job] ✅ Got 562 quality users from database
2026-02-03T03:30:00.552652699Z [inf]  [SocialJob] fetchCastsFromUsers starting with 562 FIDs, target: 1000
2026-02-03T03:30:00.564334127Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-03T03:30:00.564338227Z [inf]  Fetching premium trending tokens
2026-02-03T03:30:00.564341606Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:30:00.575103295Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-03T03:30:00.575106655Z [inf]  Timer finished: recalc_heat_scores
2026-02-03T03:30:02.243670069Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:30:02.756210909Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:30:10.782298394Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:30:11.787963179Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:30:12.388612558Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:30:13.305413973Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:30:13.305419693Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:30:13.305423203Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:30:13.305426243Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:30:13.411316026Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:30:13.411320796Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:30:13.411323756Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:30:13.411326166Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:30:13.808449303Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:30:17.847559874Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:30:17.847569323Z [err]  GeckoTerminal API error after retries
2026-02-03T03:30:17.847574633Z [err]  Error fetching trending tokens
2026-02-03T03:30:17.847579683Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:30:17.847584603Z [inf]  [TokenJob] Got 28 trending tokens for Ethereum
2026-02-03T03:30:17.847597463Z [err]  [TokenJob] New list too small (28) for Ethereum; keeping existing (100)
2026-02-03T03:30:23.539003597Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:30:31.771522224Z [inf]  incoming request
2026-02-03T03:30:31.771525604Z [inf]  request completed
2026-02-03T03:30:31.771528754Z [inf]  incoming request
2026-02-03T03:30:31.771531814Z [inf]  request completed
2026-02-03T03:30:31.771534804Z [inf]  incoming request
2026-02-03T03:30:31.771538054Z [inf]  request completed
2026-02-03T03:30:32.067845596Z [inf]  incoming request
2026-02-03T03:30:32.067853196Z [err]  [Error Handler] {
2026-02-03T03:30:32.067857646Z [err]    "requestId": "req-dp",
2026-02-03T03:30:32.067861256Z [err]    "method": "GET",
2026-02-03T03:30:32.067864956Z [err]    "url": "/api/billing/usage-summary",
2026-02-03T03:30:32.067869146Z [err]    "ip": "100.64.0.15",
2026-02-03T03:30:32.067872886Z [err]    "error": {
2026-02-03T03:30:32.067876246Z [err]      "message": "Missing Authorization Bearer token",
2026-02-03T03:30:32.067879435Z [err]      "name": "Error",
2026-02-03T03:30:32.067883635Z [err]      "code": "UNAUTHORIZED",
2026-02-03T03:30:32.067887265Z [err]      "statusCode": 401
2026-02-03T03:30:32.067890665Z [err]    }
2026-02-03T03:30:32.067894335Z [err]  }
2026-02-03T03:30:32.067897375Z [inf]  incoming request
2026-02-03T03:30:32.067900905Z [inf]  request completed
2026-02-03T03:30:32.067903975Z [inf]  incoming request
2026-02-03T03:30:32.128032596Z [inf]  incoming request
2026-02-03T03:30:32.128037246Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_020gfudelk9g5igy","createdAt":"2026-02-03T03:30:31.908Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27b877a","hash":"0xbfe6dd0dd6a78d3be78e0187371784fb215b563aa7f8ab1bb34b6235cc219259","value":0.3,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x429d069189e0000","decimals":18},"blockTimestamp":"0x69816bd7"}],"source":"chainlake-kafka"}}
2026-02-03T03:30:32.128040326Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:30:32.128043616Z [inf]  request completed
2026-02-03T03:30:32.132430101Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0xbfe6dd
2026-02-03T03:30:32.235811530Z [inf]  Swap successfully decoded from logs
2026-02-03T03:30:32.235815270Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x4f67f521: {
2026-02-03T03:30:32.235818320Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-03T03:30:32.235821130Z [inf]    tokenOut: '0xd2a7055317d0c7b316319cdadae592d0644a0b07',
2026-02-03T03:30:32.235824050Z [inf]    dex: 'Unknown DEX'
2026-02-03T03:30:32.235826589Z [inf]  }
2026-02-03T03:30:32.235829099Z [inf]  Swap detected on target wallet
2026-02-03T03:30:32.235831469Z [inf]  Target is buying - triggering copy trade
2026-02-03T03:30:32.249251580Z [inf]  [verifyAccess] Checking access: {
2026-02-03T03:30:32.249259039Z [inf]    userId: 'did:privy:cmk74yj4r03jcl70b8hwyuh2c',
2026-02-03T03:30:32.249263319Z [inf]    userIdLength: 35,
2026-02-03T03:30:32.249266769Z [inf]    userIdPrefix: 'did:privy:cmk74yj4r0',
2026-02-03T03:30:32.249277829Z [inf]    requestedAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B'
2026-02-03T03:30:32.249282249Z [inf]  }
2026-02-03T03:30:32.254124458Z [inf]  request completed
2026-02-03T03:30:32.254129758Z [inf]  [verifyAccess] ✅ Access granted
2026-02-03T03:30:32.290299170Z [inf]  incoming request
2026-02-03T03:30:32.290304690Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_8qsdzphg550ih8kc","createdAt":"2026-02-03T03:30:32.007Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","blockNum":"0x27b877a","hash":"0xbfe6dd0dd6a78d3be78e0187371784fb215b563aa7f8ab1bb34b6235cc219259","value":254848094.5877421,"asset":"TEO","category":"token","rawContract":{"rawValue":"0x000000000000000000000000000000000000000000d2ce2ee3ea1d7e0b52aae2","address":"0xd2a7055317d0c7b316319cdadae592d0644a0b07","decimals":18},"log":{"address":"0xd2a7055317d0c7b316319cdadae592d0644a0b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x0000000000000000000000004f67f52147c6bc03563772fa3d7af3adffb92110"],"data":"0x000000000000000000000000000000000000000000d2ce2ee3ea1d7e0b52aae2","blockHash":"0xe6070b5bf0f8f777d17b9ffd1680d80fbaca534881284db8e0fc39246715710d","blockNumber":"0x27b877a","blockTimestamp":"0x69816bd7","transactionHash":"0xbfe6dd0dd6a78d3be78e0187371784fb215b563aa7f8ab1bb34b6235cc219259","transactionIndex":"0x6b","logIndex":"0x238","removed":false},"blockTimestamp":"0x69816bd7"}],"source":"chainlake-kafka"}}
2026-02-03T03:30:32.290310840Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:30:32.290314560Z [inf]  [Webhook] Tx already in processedTxs cache: 0xbfe6dd0dd6a78d
2026-02-03T03:30:32.290318200Z [inf]  request completed
2026-02-03T03:30:33.198824661Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:30:33.198829291Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:30:33.407583839Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:30:33.407588479Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:30:33.407591689Z [inf]  🔥 Warming up 1 user settings
2026-02-03T03:30:33.408324741Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-03T03:30:33.408330041Z [inf]  📊 Mass Copy Trade Analysis
2026-02-03T03:30:33.408333751Z [inf]  📦 Processing batch 1/1
2026-02-03T03:30:33.532436734Z [inf]  Skipping trade: Insufficient gas buffer
2026-02-03T03:30:33.532442344Z [inf]  [Warpcast] Sending DM to FID 877398: "⏭️ Copy Trade Skipped: $TEO
2026-02-03T03:30:33.532446224Z [inf]  
2026-02-03T03:30:33.532450214Z [inf]  ⏭️ **COPY TRADE SKIPP..."
2026-02-03T03:30:33.606015034Z [err]  Alchemy Portfolio EVM API error
2026-02-03T03:30:33.675867164Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:30:33.733057406Z [inf]  request completed
2026-02-03T03:30:33.831215679Z [inf]  [Warpcast] DM sent successfully. Daily usage: 37/50000
2026-02-03T03:30:33.831222369Z [inf]  ✅ Smart batch execution complete
2026-02-03T03:30:34.072856553Z [inf]  incoming request
2026-02-03T03:30:34.072860813Z [inf]  request completed
2026-02-03T03:30:34.294820403Z [inf]  incoming request
2026-02-03T03:30:34.674108037Z [err]  Alchemy Portfolio EVM API error
2026-02-03T03:30:34.675180535Z [inf]  request completed
2026-02-03T03:30:35.329166479Z [inf]  incoming request
2026-02-03T03:30:35.329171529Z [inf]  ChatWS Client connected
2026-02-03T03:30:35.329177009Z [inf]  ChatWS: User connected
2026-02-03T03:30:37.867237433Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-03T03:30:37.867241783Z [inf]  Fetching premium trending tokens
2026-02-03T03:30:37.867245113Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:30:38.705130332Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:30:38.705135282Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:30:38.705138122Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-03T03:30:38.705140772Z [inf]  [TokenJob] Filtered out 2 invalid tokens for Solana
2026-02-03T03:30:38.743356562Z [inf]  Saved 98 trending tokens for solana to database and memory cache
2026-02-03T03:30:38.752318068Z [inf]  [TokenJob] Saved 98 tokens for Solana to DB + cache
2026-02-03T03:30:41.363667087Z [inf]  incoming request
2026-02-03T03:30:41.363670627Z [inf]  request completed
2026-02-03T03:30:41.364495999Z [inf]  incoming request
2026-02-03T03:30:41.364499919Z [inf]  request completed
2026-02-03T03:30:41.365443018Z [inf]  incoming request
2026-02-03T03:30:41.365447518Z [inf]  request completed
2026-02-03T03:30:41.651644906Z [inf]  incoming request
2026-02-03T03:30:41.651648576Z [inf]  incoming request
2026-02-03T03:30:41.651651386Z [inf]  incoming request
2026-02-03T03:30:41.651654436Z [inf]  [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmk74yj4r03jcl70b8hwyuh2c, content=Sell all 0x4f39a047a...
2026-02-03T03:30:41.668444920Z [inf]  request completed
2026-02-03T03:30:41.677982571Z [inf]  request completed
2026-02-03T03:30:41.955939324Z [inf]  incoming request
2026-02-03T03:30:41.955943124Z [inf]  request completed
2026-02-03T03:30:42.133507838Z [err]  Alchemy Portfolio EVM API error
2026-02-03T03:30:42.242527228Z [inf]  incoming request
2026-02-03T03:30:42.253369214Z [inf]  request completed
2026-02-03T03:30:42.433648450Z [inf]  request completed
2026-02-03T03:30:42.552127241Z [inf]  incoming request
2026-02-03T03:30:42.553095602Z [inf]  request completed
2026-02-03T03:30:42.841490157Z [inf]  incoming request
2026-02-03T03:30:42.874499991Z [err]  [Prisma-Error] 
2026-02-03T03:30:42.874509861Z [err]  Invalid `prisma.userActivity.upsert()` invocation:
2026-02-03T03:30:42.874515231Z [err]  
2026-02-03T03:30:42.874519580Z [err]  
2026-02-03T03:30:42.874523280Z [err]  Foreign key constraint violated: `UserActivity_userId_fkey (index)` { target: 'userActivity.upsert', timestamp: 2026-02-03T03:30:42.865Z }
2026-02-03T03:30:42.874526900Z [err]  [UserActivity] Failed to track chat for cmk74yz4200qwab4gftg65b07: PrismaClientKnownRequestError: 
2026-02-03T03:30:42.874531340Z [err]  Invalid `prisma.userActivity.upsert()` invocation:
2026-02-03T03:30:42.874535330Z [err]  
2026-02-03T03:30:42.874538810Z [err]  
2026-02-03T03:30:42.874542530Z [err]  Foreign key constraint violated: `UserActivity_userId_fkey (index)`
2026-02-03T03:30:42.874546050Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-03T03:30:42.874549410Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-03T03:30:42.874552480Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-03T03:30:42.874555720Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-03T03:30:42.874560240Z [err]      at async trackActivity (file:///app/dist/services/userActivityService.js:31:9) {
2026-02-03T03:30:42.874564250Z [err]    code: 'P2003',
2026-02-03T03:30:42.874567560Z [err]    clientVersion: '5.22.0',
2026-02-03T03:30:42.874571180Z [err]    meta: {
2026-02-03T03:30:42.874574720Z [err]      modelName: 'UserActivity',
2026-02-03T03:30:42.874578170Z [err]      field_name: 'UserActivity_userId_fkey (index)'
2026-02-03T03:30:42.874581370Z [err]    }
2026-02-03T03:30:42.874585050Z [err]  }
2026-02-03T03:30:43.133236726Z [err]  Alchemy Portfolio EVM API error
2026-02-03T03:30:43.133239926Z [inf]  request completed
2026-02-03T03:30:43.376874298Z [inf]  incoming request
2026-02-03T03:30:43.648192712Z [err]  Alchemy Portfolio EVM API error
2026-02-03T03:30:43.648202032Z [inf]  request completed
2026-02-03T03:30:43.789040129Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:30:44.781346045Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:30:44.781351665Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:30:44.952602504Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:30:44.952610184Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:30:45.200953975Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:30:45.200959175Z [err]  Critical: No valid price data available
2026-02-03T03:30:45.246880442Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-03T03:30:45.246885621Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-03T03:30:45.246888491Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-03T03:30:45.290441992Z [inf]  0x API price received successfully
2026-02-03T03:30:45.290448322Z [err]  Critical: No valid price data available
2026-02-03T03:30:45.372512610Z [err]  INFO:moderation.router:Moderating input: Sell all 0x4f39a047a8419adf49723ed8ba3565d5916f8b0...
2026-02-03T03:30:45.410799664Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:30:45.410805534Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:30:46.383320809Z [err]  INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
2026-02-03T03:30:46.384560078Z [inf]  INFO:     10.178.21.21:47580 - "POST /moderation/input HTTP/1.1" 200 OK
2026-02-03T03:30:46.398702861Z [inf]  Moderation Input check result
2026-02-03T03:30:46.398704961Z [inf]  [ChatWorker] DeepSeek iteration 1/10 for task cml61jvfq09tb8gym46gl8qat
2026-02-03T03:30:46.398709671Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_start
2026-02-03T03:30:46.398713581Z [inf]  [ChatWorker] Sent message_start for cml61jvan09t98gymw7nk89tu
2026-02-03T03:30:46.398718331Z [inf]  ChatWorker: seeded get_wallet_info from client context
2026-02-03T03:30:46.398722421Z [inf]  ToolPreRouter: Category matched
2026-02-03T03:30:46.398725881Z [inf]  [ChatWorker] Base filtered to 6 tools for message: "Sell all 0x4f39a047a8419adf49723ed8ba3565d5916f8b0..."
2026-02-03T03:30:46.398730351Z [inf]  [ChatWorker] 🔍 RAG check for: "Sell all 0x4f39a047a8419adf49723ed8ba3565d5916f8b0..."
2026-02-03T03:30:46.398733841Z [inf]  [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
2026-02-03T03:30:46.399105297Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-03T03:30:46.399109837Z [inf]  [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
2026-02-03T03:30:46.399113667Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-03T03:30:46.403856803Z [inf]  Timer finished: intent_parsing_6a2a67d3
2026-02-03T03:30:46.412814113Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-03T03:30:46.412820483Z [inf]  DeepSeek: routed to mode
2026-02-03T03:30:46.413661044Z [inf]  [ChatWorker] User Settings: {
2026-02-03T03:30:46.413665204Z [inf]    fastSwapMode: true,
2026-02-03T03:30:46.413668574Z [inf]    swapMethod: 'allowance_trade',
2026-02-03T03:30:46.413671484Z [inf]    toolConfig: [
2026-02-03T03:30:46.413674324Z [inf]      'userRole',
2026-02-03T03:30:46.413677414Z [inf]      'defaultSwapAmount',
2026-02-03T03:30:46.413679874Z [inf]    ],
2026-02-03T03:30:46.413679954Z [inf]      'checkTokenBeforeSwap',
2026-02-03T03:30:46.413681064Z [inf]      'defaultSwapUnit',
2026-02-03T03:30:46.413682904Z [inf]      'quickSwapMode',
2026-02-03T03:30:46.413685354Z [inf]    walletConnected: true,
2026-02-03T03:30:46.413685744Z [inf]      'swapMethod',
2026-02-03T03:30:46.413687854Z [inf]      'copyTradeTokenCooldownMinutes',
2026-02-03T03:30:46.413690514Z [inf]    chainId: 8453
2026-02-03T03:30:46.413690914Z [inf]      'copyTradeAIMode',
2026-02-03T03:30:46.413691304Z [inf]      'slippageMode',
2026-02-03T03:30:46.413692234Z [inf]      'minMarketCapUsd',
2026-02-03T03:30:46.413695554Z [inf]      'minLiquidityUsd',
2026-02-03T03:30:46.413695694Z [inf]  }
2026-02-03T03:30:46.413695994Z [inf]      'updatedAt',
2026-02-03T03:30:46.413696174Z [inf]      'customSlippage',
2026-02-03T03:30:46.413699234Z [inf]      'minTargetValueUsd',
2026-02-03T03:30:46.413700954Z [inf]      'createdAt',
2026-02-03T03:30:46.413701344Z [inf]      'mevProtection',
2026-02-03T03:30:46.413702654Z [inf]      'id',
2026-02-03T03:30:46.413705544Z [inf]      'zoraNotificationThreshold'
2026-02-03T03:30:46.413705944Z [inf]      'userId',
2026-02-03T03:30:46.413707464Z [inf]      'priceDeviationCheck',
2026-02-03T03:30:46.413711224Z [inf]      'fastSwapMode',
2026-02-03T03:30:46.414552804Z [inf]  [ChatWorker] 🚀 Fast Swap Decision: {
2026-02-03T03:30:46.414558684Z [inf]    fastSwapModeEnabled: true,
2026-02-03T03:30:46.414587894Z [inf]    isAllowanceTradeMode: true,
2026-02-03T03:30:46.414591754Z [inf]    willFastSwap: true,
2026-02-03T03:30:46.414602224Z [inf]    reason: 'fastSwapMode=true'
2026-02-03T03:30:46.414626964Z [inf]  }
2026-02-03T03:30:46.414630604Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_start
2026-02-03T03:30:46.414633924Z [inf]  [ChatWorker] 🚀 Fast swap: Sent message_start for cml61jvan09t98gymw7nk89tu
2026-02-03T03:30:46.414637813Z [inf]  [ChatWorker] Fast swap parameters: {
2026-02-03T03:30:46.414651773Z [inf]    tokenIn: '0x4f39a047...',
2026-02-03T03:30:46.414654603Z [inf]    tokenOut: 'ETH',
2026-02-03T03:30:46.414658423Z [inf]    amountIn: 'all',
2026-02-03T03:30:46.414661263Z [inf]    chainId: 8453,
2026-02-03T03:30:46.414664573Z [inf]    swapIntent: {
2026-02-03T03:30:46.414667243Z [inf]      tokenIn: '0x4f39a047a8419adf49723ed8ba3565d5916f8b07',
2026-02-03T03:30:46.414671333Z [inf]      tokenOut: 'ETH',
2026-02-03T03:30:46.414674353Z [inf]      amount: 'all'
2026-02-03T03:30:46.414677833Z [inf]    }
2026-02-03T03:30:46.414681443Z [inf]  }
2026-02-03T03:30:46.414684933Z [inf]  [ChatWorker] Chain detection: tokenIn=0x4f39a047..., actualChain=base
2026-02-03T03:30:46.414687633Z [inf]  [ChatWorker] 🧮 Calculating all amount for 0x4f39a047a8419adf49723ed8ba3565d5916f8b07
2026-02-03T03:30:46.414690393Z [inf]  [ChatWorker] 🔷 Using EVM wallet for balance check: 0xFB64Ce8d...
2026-02-03T03:30:46.747369081Z [err]  Alchemy Portfolio EVM API error
2026-02-03T03:30:47.329449904Z [inf]  [ChatWorker] SELL all: using exact balance 22673728.56360912
2026-02-03T03:30:47.329461354Z [inf]  [ChatWorker] Resolved amount: 22673728.56360912 0x4f39a047a8419adf49723ed8ba3565d5916f8b07 (Balance: 22673728.56360912)
2026-02-03T03:30:47.824132125Z [err]  LaunchpadDetector: Failed to load Paragraph SDK
2026-02-03T03:30:47.974028752Z [inf]  Timer finished: launchpad_det_0x4f39a047a8419adf49723ed8ba3565d5916f8b07
2026-02-03T03:30:47.974033982Z [inf]  TokenDetector: Found launchpad token
2026-02-03T03:30:47.974037852Z [inf]  Timer finished: find_token_any_0x4f39a047a8419adf49723ed8ba3565d5916f8b07
2026-02-03T03:30:47.974040772Z [inf]  Created transaction card for fast swap
2026-02-03T03:30:47.975140490Z [inf]  [MainSwapService][1770089447973_24y91p] Starting unified swap execution
2026-02-03T03:30:47.975146550Z [inf]  Timer finished: launchpad_det_ETH
2026-02-03T03:30:47.975150510Z [inf]  [MainSwapService][1770089447973_24y91p] Clanker token detected - routing to standard DEX (0x/Kyber)
2026-02-03T03:30:47.975153989Z [inf]  [MainSwapService][1770089447973_24y91p] Executing EVM swap
2026-02-03T03:30:47.975159389Z [inf]  Initiating Unified Swap Execution
2026-02-03T03:30:47.979606699Z [inf]  incoming request
2026-02-03T03:30:47.979612099Z [err]  [originRestriction] Request blocked {
2026-02-03T03:30:47.979616049Z [err]    origin: '',
2026-02-03T03:30:47.979619559Z [err]    referer: '',
2026-02-03T03:30:47.979624379Z [err]    effectiveOrigin: '',
2026-02-03T03:30:47.979628599Z [err]    userAgent: 'node',
2026-02-03T03:30:47.979633029Z [err]    allowedOrigins: [
2026-02-03T03:30:47.979636749Z [err]      'https://kikoapp.app',
2026-02-03T03:30:47.979640809Z [err]      'https://kikoapp.pages.dev',
2026-02-03T03:30:47.979644930Z [err]      'https://www.kikoapp.app',
2026-02-03T03:30:47.979652250Z [err]      'capacitor://localhost'
2026-02-03T03:30:47.979655720Z [err]    ]
2026-02-03T03:30:47.979662210Z [err]  }
2026-02-03T03:30:47.979666780Z [err]  [Error Handler] {
2026-02-03T03:30:47.979670940Z [err]    "requestId": "req-e7",
2026-02-03T03:30:47.979674130Z [err]    "method": "POST",
2026-02-03T03:30:47.979678320Z [err]    "url": "/api/swap/quote",
2026-02-03T03:30:47.979682059Z [err]    "ip": "127.0.0.1",
2026-02-03T03:30:47.979685219Z [err]    "error": {
2026-02-03T03:30:47.979688679Z [err]      "message": "Request origin not allowed",
2026-02-03T03:30:47.979692159Z [err]      "name": "Error",
2026-02-03T03:30:47.979695799Z [err]      "code": "ORIGIN_NOT_ALLOWED",
2026-02-03T03:30:47.979699479Z [err]      "statusCode": 403
2026-02-03T03:30:47.979702599Z [err]    }
2026-02-03T03:30:47.979706199Z [err]  }
2026-02-03T03:30:47.979709679Z [inf]  request completed
2026-02-03T03:30:48.436812269Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:30:48.436816939Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:30:48.436820139Z [err]  Critical: No valid price data available
2026-02-03T03:30:48.893316245Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:30:48.893326345Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:30:48.893333075Z [err]  Critical: No valid price data available
2026-02-03T03:30:49.154645719Z [wrn]  All API liquidity sources failed
2026-02-03T03:30:49.555351259Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:30:49.555362989Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:30:49.932533462Z [inf]  0x API price received successfully
2026-02-03T03:30:49.932539722Z [inf]  Fallback: Got price from DEX aggregator
2026-02-03T03:30:49.932543422Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:30:50.137150409Z [inf]  Fetched missing decimals on-chain
2026-02-03T03:30:50.144510247Z [inf]  [PlatformFee] Fees ENABLED: { context: 'swap', bps: 50, evmRecipient: '0xc5377e6329' }
2026-02-03T03:30:50.290635007Z [inf]  No token metadata available, trying RPC fallback...
2026-02-03T03:30:50.363155568Z [inf]  Using 0x API fallback token metadata
2026-02-03T03:30:50.443199825Z [inf]  Using 0x API fallback token metadata
2026-02-03T03:30:50.453328382Z [inf]  Using 0x API fallback token metadata
2026-02-03T03:30:50.708321048Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:30:50.816251274Z [inf]  0x API price received successfully
2026-02-03T03:30:50.816256194Z [inf]  [PlatformFee] Fees ENABLED: { context: 'swap', bps: 50, evmRecipient: '0xc5377e6329' }
2026-02-03T03:30:50.816259484Z [inf]  [Kyber] GET routes {
2026-02-03T03:30:50.816262313Z [inf]    routesUrl: 'https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=0x4f39a047a8419adf49723ed8ba3565d5916f8b07&tokenOut=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&amountIn=22673728563609120000000000&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B&feeReceiver=0xc5377e6329770Be29Ef938d8aCC11f22398D7E54&feeAmount=50&isInBps=true&chargeFeeBy=currency_in'
2026-02-03T03:30:50.816265263Z [inf]  }
2026-02-03T03:30:51.126873339Z [inf]  0x API Quote received successfully
2026-02-03T03:30:51.126877429Z [inf]  0x API Quote successful
2026-02-03T03:30:51.126880289Z [inf]  [QuoteService] 0x API estimatedPriceImpact: {
2026-02-03T03:30:51.126883279Z [inf]    raw: undefined,
2026-02-03T03:30:51.126886289Z [inf]    parsed: 0,
2026-02-03T03:30:51.126888829Z [inf]    multipliedBy100: 0,
2026-02-03T03:30:51.126892849Z [inf]    impactVsMkt: null,
2026-02-03T03:30:51.126895719Z [inf]    willUse: 0
2026-02-03T03:30:51.126912829Z [inf]  }
2026-02-03T03:30:51.126916019Z [inf]  [Kyber] routes response {
2026-02-03T03:30:51.126918959Z [inf]    status: 200,
2026-02-03T03:30:51.126922219Z [inf]    hasData: true,
2026-02-03T03:30:51.126925919Z [inf]    keys: [ 'code', 'message', 'data', 'requestId' ]
2026-02-03T03:30:51.126929039Z [inf]  }
2026-02-03T03:30:51.126931499Z [inf]  [Kyber] Building route/build request body: {
2026-02-03T03:30:51.126934088Z [inf]    hasRouteSummary: true,
2026-02-03T03:30:51.126936808Z [inf]    routeSummaryKeys: [
2026-02-03T03:30:51.126939318Z [inf]      'tokenIn',
2026-02-03T03:30:51.126941738Z [inf]      'amountIn',
2026-02-03T03:30:51.126944238Z [inf]      'amountInUsd',
2026-02-03T03:30:51.126947168Z [inf]      'tokenOut',
2026-02-03T03:30:51.126949798Z [inf]      'amountOut',
2026-02-03T03:30:51.126952168Z [inf]      'amountOutUsd',
2026-02-03T03:30:51.128299983Z [inf]      'gas',
2026-02-03T03:30:51.128308493Z [inf]      'gasPrice'
2026-02-03T03:30:51.128313753Z [inf]    ],
2026-02-03T03:30:51.128318323Z [inf]    sender: '0xFB64Ce8d',
2026-02-03T03:30:51.128322533Z [inf]    recipient: '0xFB64Ce8d',
2026-02-03T03:30:51.128326833Z [inf]    slippageTolerance: 300,
2026-02-03T03:30:51.128330413Z [inf]    slippageToleranceType: 'number',
2026-02-03T03:30:51.128334313Z [inf]    deadline: 1770090051,
2026-02-03T03:30:51.128337413Z [inf]    deadlineType: 'number',
2026-02-03T03:30:51.128341623Z [inf]    allBodyKeys: [
2026-02-03T03:30:51.128345853Z [inf]      'routeSummary',
2026-02-03T03:30:51.128351043Z [inf]      'sender',
2026-02-03T03:30:51.128355663Z [inf]      'recipient',
2026-02-03T03:30:51.128359942Z [inf]      'origin',
2026-02-03T03:30:51.128366252Z [inf]      'slippageTolerance',
2026-02-03T03:30:51.128370722Z [inf]      'deadline'
2026-02-03T03:30:51.128375452Z [inf]    ]
2026-02-03T03:30:51.128380352Z [inf]  }
2026-02-03T03:30:51.662878500Z [inf]  [QuoteService] Quote comparison: {
2026-02-03T03:30:51.662884570Z [inf]    '0x_amount': '0.00220939782243061',
2026-02-03T03:30:51.662889910Z [inf]    kyber_amount: '0.002212834580562026',
2026-02-03T03:30:51.662893520Z [inf]    kyber_advantage_pct: '0.00',
2026-02-03T03:30:51.662896860Z [inf]    chainId: 8453
2026-02-03T03:30:51.662900200Z [inf]  }
2026-02-03T03:30:51.662904480Z [inf]  [QuoteService] Preferring 0x for reliability { reason: 'prices within 2%', percentDiff: '0.00' }
2026-02-03T03:30:51.662907690Z [inf]  Checking approval for swap
2026-02-03T03:30:51.742260512Z [err]  2026-02-03 03:30:42.864 UTC [39244] ERROR:  insert or update on table "UserActivity" violates foreign key constraint "UserActivity_userId_fkey"
2026-02-03T03:30:51.742267729Z [err]  2026-02-03 03:30:42.864 UTC [39244] DETAIL:  Key (userId)=(cmk74yz4200qwab4gftg65b07) is not present in table "User".
2026-02-03T03:30:51.742277047Z [err]  2026-02-03 03:30:42.864 UTC [39244] STATEMENT:  INSERT INTO "public"."UserActivity" ("id","userId","date","logins","chatMessages","swapsCount","swapVolumeUsd","copyTrades","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT ("userId","date") DO UPDATE SET "chatMessages" = ("public"."UserActivity"."chatMessages" + $11), "updatedAt" = $12 WHERE (("public"."UserActivity"."userId" = $13 AND "public"."UserActivity"."date" = $14) AND 1=1) RETURNING "public"."UserActivity"."id", "public"."UserActivity"."userId", "public"."UserActivity"."date", "public"."UserActivity"."logins", "public"."UserActivity"."chatMessages", "public"."UserActivity"."swapsCount", "public"."UserActivity"."swapVolumeUsd", "public"."UserActivity"."copyTrades", "public"."UserActivity"."createdAt", "public"."UserActivity"."updatedAt"
2026-02-03T03:30:51.783537715Z [inf]  }
2026-02-03T03:30:51.783548495Z [inf]  Approval not needed or already set
2026-02-03T03:30:51.783551225Z [inf]  [SwapExecutor] Swap details: {
2026-02-03T03:30:51.783555465Z [inf]  Approval not needed or already set
2026-02-03T03:30:51.783558995Z [inf]    tokenIn: '0x4f39a047a8419adf49723ed8ba3565d5916f8b07',
2026-02-03T03:30:51.783562535Z [inf]  [SwapExecutor] Executing 0x Aggregator swap on chain 8453
2026-02-03T03:30:51.783566305Z [inf]    tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-03T03:30:51.783569885Z [inf]  [SwapExecutor] ========== TRANSACTION EXECUTION ==========
2026-02-03T03:30:51.783574295Z [inf]    amountInBase: '22673728563609120000000000',
2026-02-03T03:30:51.783576945Z [inf]  [SwapExecutor] DEX: 0x Aggregator
2026-02-03T03:30:51.783581205Z [inf]  [SwapExecutor] Transaction params: {
2026-02-03T03:30:51.783585185Z [inf]    to: '0x0000000000001ff3684f28c67538d4d072c22734',
2026-02-03T03:30:51.783588904Z [inf]    dataLength: 4746,
2026-02-03T03:30:51.783594204Z [inf]    dataPrefix: '0x2213bc0b000000000000000000000000dc5d8200a030798bc6227240f68b4dd9',
2026-02-03T03:30:51.783597564Z [inf]    value: '0',
2026-02-03T03:30:51.783600234Z [inf]    router: '0x0000000000001ff3684f28c67538d4d072c22734',
2026-02-03T03:30:51.783603064Z [inf]    allowanceTarget: '0x0000000000001ff3684f28c67538d4d072c22734'
2026-02-03T03:30:51.783996811Z [inf]    amountInHuman: '22673728.56360912',
2026-02-03T03:30:51.783999721Z [inf]  }
2026-02-03T03:30:51.784006081Z [inf]  [SwapExecutor] =============================================
2026-02-03T03:30:51.784169369Z [inf]    amountOut: '0.00220939782243061',
2026-02-03T03:30:51.784172909Z [inf]    slippageBps: 300,
2026-02-03T03:30:51.784176768Z [inf]    priceImpact: 0,
2026-02-03T03:30:51.784181338Z [inf]    gasEstimate: 740237
2026-02-03T03:30:51.994085217Z [inf]  [SwapExecutor] Execution params prepared: {
2026-02-03T03:30:51.994093937Z [inf]    dex: '0x Aggregator',
2026-02-03T03:30:51.994100756Z [inf]    gasEstimate: 740237,
2026-02-03T03:30:51.994107256Z [inf]    gasLimit: '1110355',
2026-02-03T03:30:51.994113326Z [inf]    maxFeePerGas: '15537264',
2026-02-03T03:30:51.994119426Z [inf]    maxPriorityFeePerGas: '1000000'
2026-02-03T03:30:51.994125456Z [inf]  }
2026-02-03T03:30:52.210762981Z [inf]  [sendTransaction] ========== PRIVY TX PARAMS ==========
2026-02-03T03:30:52.210767011Z [inf]  [sendTransaction] From: 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-03T03:30:52.210771081Z [inf]  [sendTransaction] To: 0x0000000000001ff3684f28c67538d4d072c22734
2026-02-03T03:30:52.210777530Z [inf]  [sendTransaction] Value: 0
2026-02-03T03:30:52.210782340Z [inf]  [sendTransaction] ValueHex: 0x0
2026-02-03T03:30:52.210786450Z [inf]  [sendTransaction] Data length: 4746
2026-02-03T03:30:52.210790770Z [inf]  [sendTransaction] Data (full): 0x2213bc0b000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef0000000000000000000000004f39a047a8419adf49723ed8ba3565d5916f8b0700000000000000000000000000000000000000000012c15949d158004ac54000000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef00000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000008641fff991f000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000000000000000000000000000000079d29a3f64bc600000000000000000000000000000000000000000000000000000000000000a049d66bf6ea7ca5dd8363134d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001e000000000000000000000000000000000000000000000000000000000000003a000000000000000000000000000000000000000000000000000000000000004e000000000000000000000000000000000000000000000000000000000000005a000000000000000000000000000000000000000000000000000000000000006a000000000000000000000000000000000000000000000000000000000000000e4c1fb425e000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef0000000000000000000000004f39a047a8419adf49723ed8ba3565d5916f8b0700000000000000000000000000000000000000000012c15949d158004ac5400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000069816d1600000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000184af72634f000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef0000000000000000000000004f39a047a8419adf49723ed8ba3565d5916f8b07000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000ffffffffffffffc50000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000482710fffd8963efd1fc6a506488495d951d5263988d250142000000000000000000000000000000000000068000000000c8b429d62f8f3bffb98cdb9569533ea23bf0ba28cc00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010438c9c147000000000000000000000000420000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000027100000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000242e1a7d4d00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008434ee90ca000000000000000000000000f5c4f3dc02c3fb9279495a8fef7b0741da956157000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000000000000000000000000000000007e6b2ed92528f00000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000000000000000000000000000000000000000000032000000000000000000000000c5377e6329770be29ef938d8acc11f22398d7e54000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee000000000000000000000000000000000000000000000000000000000000000f000000000000000000000000ad01c20d5886137e056775af56915de824c8fce5000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
2026-02-03T03:30:52.211849249Z [inf]  [sendTransaction] ChainId: 8453
2026-02-03T03:30:52.211855969Z [inf]  [sendTransaction] Gas: 1110355
2026-02-03T03:30:52.211859809Z [inf]  [sendTransaction] MaxFeePerGas: 15537264
2026-02-03T03:30:52.211862879Z [inf]  [sendTransaction] MaxPriorityFeePerGas: 1000000
2026-02-03T03:30:52.211866118Z [inf]  [sendTransaction] Full TX object: {
2026-02-03T03:30:52.211869498Z [inf]    to: '0x0000000000001ff3684f28c67538d4d072c22734',
2026-02-03T03:30:52.211873908Z [inf]    data: '0x2213bc0b000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef0000000000000000000000004f39a047a8419adf49723ed8ba3565d5916f8b0700000000000000000000000000000000000000000012c15949d158004ac54000000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef00000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000008641fff991f000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000000000000000000000000000000079d29a3f64bc600000000000000000000000000000000000000000000000000000000000000a049d66bf6ea7ca5dd8363134d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001e000000000000000000000000000000000000000000000000000000000000003a000000000000000000000000000000000000000000000000000000000000004e000000000000000000000000000000000000000000000000000000000000005a000000000000000000000000000000000000000000000000000000000000006a000000000000000000000000000000000000000000000000000000000000000e4c1fb425e000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef0000000000000000000000004f39a047a8419adf49723ed8ba3565d5916f8b0700000000000000000000000000000000000000000012c15949d158004ac5400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000069816d1600000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000184af72634f000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef0000000000000000000000004f39a047a8419adf49723ed8ba3565d5916f8b07000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000ffffffffffffffc50000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000482710fffd8963efd1fc6a506488495d951d5263988d250142000000000000000000000000000000000000068000000000c8b429d62f8f3bffb98cdb9569533ea23bf0ba28cc00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010438c9c147000000000000000000000000420000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000027100000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000242e1a7d4d00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008434ee90ca000000000000000000000000f5c4f3dc02c3fb9279495a8fef7b0741da956157000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000000000000000000000000000000007e6b2ed92528f00000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000000000000000000000000000000000000000000032000000000000000000000000c5377e6329770be29ef938d8acc11f22398d7e54000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c438c9c147000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee000000000000000000000000000000000000000000000000000000000000000f000000000000000000000000ad01c20d5886137e056775af56915de824c8fce5000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
2026-02-03T03:30:52.212057056Z [inf]    value: '0',
2026-02-03T03:30:52.212061956Z [inf]    chainId: 8453,
2026-02-03T03:30:52.212065456Z [inf]    gas: '1110355',
2026-02-03T03:30:52.212068876Z [inf]    maxFeePerGas: '15537264',
2026-02-03T03:30:52.212072336Z [inf]    maxPriorityFeePerGas: '1000000'
2026-02-03T03:30:52.212076126Z [inf]  }
2026-02-03T03:30:52.212079756Z [inf]  [sendTransaction] ===========================================
2026-02-03T03:30:53.365440444Z [inf]  Ethereum transaction sent via Privy
2026-02-03T03:30:54.365676500Z [inf]  Swap Broadcast
2026-02-03T03:30:54.365682560Z [inf]  [ConfirmWait] Waiting for confirmation: 0x5c57baa94108f1b39773580d0ecee1e13ffc36c0fa5c154b66b19c0fe92f326e on 8453
2026-02-03T03:30:55.412398330Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:30:56.131294785Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:30:56.131303445Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:30:56.131309445Z [err]  Critical: No valid price data available
2026-02-03T03:30:56.131314355Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:30:56.131319375Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:30:56.131324905Z [err]  Critical: No valid price data available
2026-02-03T03:30:56.206916552Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:30:56.206920972Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:30:56.244689561Z [inf]  incoming request
2026-02-03T03:30:56.244693731Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_ksysn706izv6bh48","createdAt":"2026-02-03T03:30:56.051Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","toAddress":"0x0000000000001ff3684f28c67538d4d072c22734","blockNum":"0x27b8786","hash":"0x5c57baa94108f1b39773580d0ecee1e13ffc36c0fa5c154b66b19c0fe92f326e","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x69816bef"}],"source":"chainlake-kafka"}}
2026-02-03T03:30:56.245834418Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:30:56.246757778Z [inf]  request completed
2026-02-03T03:30:56.247380552Z [inf]  [Webhook] ⚠️ Ignoring tx 0x5c57ba: No matched tracked wallets in [0xfb64, 0x0000]
2026-02-03T03:30:56.287146838Z [inf]  incoming request
2026-02-03T03:30:56.287152088Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_iut93ol84sep20lx","createdAt":"2026-02-03T03:30:56.099Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xdc5d8200a030798bc6227240f68b4dd9542686ef","toAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","blockNum":"0x27b8786","hash":"0x5c57baa94108f1b39773580d0ecee1e13ffc36c0fa5c154b66b19c0fe92f326e","value":0.00220941450133046,"typeTraceAddress":"CALL_1_6","asset":"ETH","category":"internal","rawContract":{"rawValue":"0x7d97366836e1c","decimals":18},"blockTimestamp":"0x69816bef"}]}}
2026-02-03T03:30:56.287155668Z [inf]  request completed
2026-02-03T03:30:56.287158428Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:30:56.287637774Z [inf]  [Webhook] ⚠️ Ignoring tx 0x5c57ba: No matched tracked wallets in [0xdc5d, 0xfb64]
2026-02-03T03:30:56.414768676Z [inf]  incoming request
2026-02-03T03:30:56.414773445Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_jyoo1ct4jwsmywwv","createdAt":"2026-02-03T03:30:56.148Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","toAddress":"0xdc5d8200a030798bc6227240f68b4dd9542686ef","blockNum":"0x27b8786","hash":"0x5c57baa94108f1b39773580d0ecee1e13ffc36c0fa5c154b66b19c0fe92f326e","value":22673728.56360912,"asset":"Wintermolt","category":"token","rawContract":{"rawValue":"0x00000000000000000000000000000000000000000012c15949d158004ac54000","address":"0x4f39a047a8419adf49723ed8ba3565d5916f8b07","decimals":18},"log":{"address":"0x4f39a047a8419adf49723ed8ba3565d5916f8b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b","0x000000000000000000000000dc5d8200a030798bc6227240f68b4dd9542686ef"],"data":"0x00000000000000000000000000000000000000000012c15949d158004ac54000","blockHash":"0xbd87f60362288c65e573e5510bbdc447286157e3130008b1372c5511dad32ecf","blockNumber":"0x27b8786","blockTimestamp":"0x69816bef","transactionHash":"0x5c57baa94108f1b39773580d0ecee1e13ffc36c0fa5c154b66b19c0fe92f326e","transactionIndex":"0x3d","logIndex":"0x113","removed":false},"blockTimestamp":"0x69816bef"}],"source":"chainlake-kafka"}}
2026-02-03T03:30:56.414776265Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:30:56.414779225Z [inf]  request completed
2026-02-03T03:30:56.414781825Z [inf]  [Webhook] ⚠️ Ignoring tx 0x5c57ba: No matched tracked wallets in [0xfb64, 0xdc5d]
2026-02-03T03:30:56.551027917Z [inf]  [ConfirmWait] Transaction confirmed: 0x5c57baa94108f1b39773580d0ecee1e13ffc36c0fa5c154b66b19c0fe92f326e
2026-02-03T03:30:56.551036037Z [inf]  Transaction confirmed on-chain
2026-02-03T03:30:58.761921354Z [err]  [DBLock] Lock already held {
2026-02-03T03:30:58.761929104Z [err]    key: 'lock:tokenJob:refresh:base',
2026-02-03T03:30:58.761933924Z [err]    expiresAt: '2026-02-02T05:44:42.169Z',
2026-02-03T03:30:58.761939244Z [err]    ageMs: 78616590
2026-02-03T03:30:58.761944754Z [err]  }
2026-02-03T03:30:58.761950014Z [err]  [DBLock] Potential stale lock detected { key: 'lock:tokenJob:refresh:base', ageMs: 78616590, ttlSeconds: 240 }
2026-02-03T03:30:58.761955574Z [inf]  [TokenJob] Skipping refresh for Base - another instance holds the lock
2026-02-03T03:31:06.259962134Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:31:06.878096951Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:31:06.878102380Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:31:06.878106490Z [err]  Critical: No valid price data available
2026-02-03T03:31:06.913932072Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:31:06.913936032Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:31:06.913958402Z [err]  Critical: No valid price data available
2026-02-03T03:31:07.102229944Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:31:07.102240074Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:31:14.805016951Z [inf]  incoming request
2026-02-03T03:31:14.805023681Z [inf]  request completed
2026-02-03T03:31:15.066256805Z [inf]  incoming request
2026-02-03T03:31:16.285198904Z [inf]  incoming request
2026-02-03T03:31:16.285203594Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_q8nlr76uorxp489w","createdAt":"2026-02-03T03:31:16.046Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27b8790","hash":"0xae05edbc539c6fa334dd1f88a7e0c22a81cb2891b6d80a7973db369f18a7317d","value":0.5,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x6f05b59d3b20000","decimals":18},"blockTimestamp":"0x69816c03"}],"source":"chainlake-kafka"}}
2026-02-03T03:31:16.285207454Z [inf]  request completed
2026-02-03T03:31:16.285211284Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:31:16.285215684Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0xae05ed
2026-02-03T03:31:16.359005293Z [inf]  Swap successfully decoded from logs
2026-02-03T03:31:16.359018483Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x4f67f521: {
2026-02-03T03:31:16.359024903Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-03T03:31:16.359030643Z [inf]    tokenOut: '0xd2a7055317d0c7b316319cdadae592d0644a0b07',
2026-02-03T03:31:16.359035943Z [inf]    dex: 'Unknown DEX'
2026-02-03T03:31:16.359044433Z [inf]  }
2026-02-03T03:31:16.359055512Z [inf]  Swap detected on target wallet
2026-02-03T03:31:16.359060922Z [inf]  Target is buying - triggering copy trade
2026-02-03T03:31:16.386806415Z [inf]  incoming request
2026-02-03T03:31:16.386811915Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_37srjsl3xg2vx09j","createdAt":"2026-02-03T03:31:16.145Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","blockNum":"0x27b8790","hash":"0xae05edbc539c6fa334dd1f88a7e0c22a81cb2891b6d80a7973db369f18a7317d","value":328262557.3719424,"asset":"TEO","category":"token","rawContract":{"rawValue":"0x0000000000000000000000000000000000000000010f884ce47555793fef8a01","address":"0xd2a7055317d0c7b316319cdadae592d0644a0b07","decimals":18},"log":{"address":"0xd2a7055317d0c7b316319cdadae592d0644a0b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x0000000000000000000000004f67f52147c6bc03563772fa3d7af3adffb92110"],"data":"0x0000000000000000000000000000000000000000010f884ce47555793fef8a01","blockHash":"0x29bcfb04bcc09303bfcad92c237f031882680d5612a72161c08130082565d139","blockNumber":"0x27b8790","blockTimestamp":"0x69816c03","transactionHash":"0xae05edbc539c6fa334dd1f88a7e0c22a81cb2891b6d80a7973db369f18a7317d","transactionIndex":"0xad","logIndex":"0x2c1","removed":false},"blockTimestamp":"0x69816c03"}],"source":"chainlake-kafka"}}
2026-02-03T03:31:16.386815265Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:31:16.386818414Z [inf]  [Webhook] Tx already in processedTxs cache: 0xae05edbc539c6f
2026-02-03T03:31:16.386821224Z [inf]  request completed
2026-02-03T03:31:16.564384838Z [err]  Alchemy Portfolio EVM API error
2026-02-03T03:31:16.654456217Z [inf]  request completed
2026-02-03T03:31:16.992511926Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:31:16.992523337Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:31:16.992527487Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:31:16.992531347Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:31:16.992534687Z [inf]  🔥 Warming up 1 user settings
2026-02-03T03:31:16.992538517Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-03T03:31:16.992542777Z [inf]  📊 Mass Copy Trade Analysis
2026-02-03T03:31:16.992878673Z [inf]  📦 Processing batch 1/1
2026-02-03T03:31:17.031815320Z [inf]  incoming request
2026-02-03T03:31:17.031820179Z [inf]  request completed
2026-02-03T03:31:17.093540373Z [inf]  Skipping trade: Insufficient gas buffer
2026-02-03T03:31:17.093547453Z [inf]  [Warpcast] Sending DM to FID 877398: "⏭️ Copy Trade Skipped: $TEO
2026-02-03T03:31:17.093550593Z [inf]  
2026-02-03T03:31:17.093553962Z [inf]  ⏭️ **COPY TRADE SKIPP..."
2026-02-03T03:31:17.104354643Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:31:17.295575286Z [inf]  incoming request
2026-02-03T03:31:17.578707476Z [inf]  [Warpcast] DM sent successfully. Daily usage: 38/50000
2026-02-03T03:31:17.578713396Z [inf]  ✅ Smart batch execution complete
2026-02-03T03:31:17.744087847Z [err]  Alchemy Portfolio EVM API error
2026-02-03T03:31:17.744091897Z [inf]  request completed
2026-02-03T03:31:17.750731143Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:31:17.750736193Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:31:17.762950207Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:31:17.762956617Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:31:17.856362418Z [inf]  incoming request
2026-02-03T03:31:17.856367518Z [inf]  ChatWS Client connected
2026-02-03T03:31:17.856370648Z [inf]  ChatWS: User connected
2026-02-03T03:31:18.103880475Z [inf]  0x API price received successfully
2026-02-03T03:31:18.103883675Z [err]  Critical: No valid price data available
2026-02-03T03:31:18.344418680Z [inf]  Sync request
2026-02-03T03:31:18.344431420Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:31:18.344439100Z [err]  Critical: No valid price data available
2026-02-03T03:31:18.344444840Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:31:18.344449950Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:31:18.922746898Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-03T03:31:18.922753088Z [inf]  Fetching premium trending tokens
2026-02-03T03:31:18.961702515Z [err]  DexScreener WS: Connection error
2026-02-03T03:31:18.961707825Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:31:21.328923847Z [err]  2026-02-03 03:31:20.342 UTC [27] LOG:  checkpoint starting: time
2026-02-03T03:31:21.391343489Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:31:24.098814071Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:31:25.117593368Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:31:27.652806138Z [err]  Error fetching trending tokens
2026-02-03T03:31:27.652811168Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:31:27.652814108Z [inf]  [TokenJob] Got 31 trending tokens for BSC
2026-02-03T03:31:27.652816668Z [err]  [TokenJob] New list too small (31) for BSC; keeping existing (100)
2026-02-03T03:31:28.338900994Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:31:29.309481742Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:31:29.309489622Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:31:29.309495212Z [err]  Critical: No valid price data available
2026-02-03T03:31:29.309500312Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:31:29.309503942Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:31:29.309507712Z [err]  Critical: No valid price data available
2026-02-03T03:31:29.409630270Z [inf]  incoming request
2026-02-03T03:31:29.409637889Z [inf]  request completed
2026-02-03T03:31:29.448537387Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:31:29.448541937Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:31:29.873577896Z [inf]  incoming request
2026-02-03T03:31:29.873697684Z [inf]  request completed
2026-02-03T03:31:31.346965380Z [inf]  incoming request
2026-02-03T03:31:31.346969600Z [inf]  request completed
2026-02-03T03:31:31.346973770Z [inf]  incoming request
2026-02-03T03:31:31.346977240Z [inf]  request completed
2026-02-03T03:31:31.346980990Z [inf]  incoming request
2026-02-03T03:31:31.346984810Z [inf]  request completed
2026-02-03T03:31:31.484332954Z [inf]  incoming request
2026-02-03T03:31:31.488573397Z [inf]  incoming request
2026-02-03T03:31:31.488577027Z [inf]  incoming request
2026-02-03T03:31:31.488579787Z [inf]  [ModerationLog] Received backend request: channel=frontend_local, userId=did:privy:cmk74yj4r03jcl70b8hwyuh2c, content=Sell 0x383283f086365...
2026-02-03T03:31:31.501071319Z [inf]  request completed
2026-02-03T03:31:31.508239558Z [err]  [Prisma-Error] 
2026-02-03T03:31:31.508246558Z [err]  Invalid `prisma.userActivity.upsert()` invocation:
2026-02-03T03:31:31.508251558Z [err]  
2026-02-03T03:31:31.508257268Z [err]  
2026-02-03T03:31:31.508262438Z [err]  Foreign key constraint violated: `UserActivity_userId_fkey (index)` { target: 'userActivity.upsert', timestamp: 2026-02-03T03:31:31.506Z }
2026-02-03T03:31:31.508269998Z [err]  [UserActivity] Failed to track chat for cmk74yz4200qwab4gftg65b07: PrismaClientKnownRequestError: 
2026-02-03T03:31:31.508274578Z [err]      field_name: 'UserActivity_userId_fkey (index)'
2026-02-03T03:31:31.508278728Z [err]  Invalid `prisma.userActivity.upsert()` invocation:
2026-02-03T03:31:31.508285528Z [err]    }
2026-02-03T03:31:31.508287768Z [err]  
2026-02-03T03:31:31.508295148Z [err]  }
2026-02-03T03:31:31.508296958Z [err]  
2026-02-03T03:31:31.508302508Z [err]  Foreign key constraint violated: `UserActivity_userId_fkey (index)`
2026-02-03T03:31:31.508307538Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-03T03:31:31.508312688Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-03T03:31:31.508316847Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-03T03:31:31.508321997Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-03T03:31:31.508326937Z [err]      at async trackActivity (file:///app/dist/services/userActivityService.js:31:9) {
2026-02-03T03:31:31.508331717Z [err]    code: 'P2003',
2026-02-03T03:31:31.508336427Z [err]    clientVersion: '5.22.0',
2026-02-03T03:31:31.508343547Z [err]    meta: {
2026-02-03T03:31:31.508347987Z [err]      modelName: 'UserActivity',
2026-02-03T03:31:32.012767295Z [err]  Alchemy Portfolio EVM API error
2026-02-03T03:31:32.014388937Z [err]  Alchemy Portfolio EVM API error
2026-02-03T03:31:32.105821092Z [inf]  request completed
2026-02-03T03:31:32.106353916Z [inf]  request completed
2026-02-03T03:31:32.396679251Z [inf]  incoming request
2026-02-03T03:31:32.396685961Z [inf]  [verifyAccess] Checking access: {
2026-02-03T03:31:32.396689321Z [inf]    userId: 'did:privy:cmk74yj4r03jcl70b8hwyuh2c',
2026-02-03T03:31:32.396692701Z [inf]    userIdLength: 35,
2026-02-03T03:31:32.396695751Z [inf]    userIdPrefix: 'did:privy:cmk74yj4r0',
2026-02-03T03:31:32.396699451Z [inf]    requestedAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B'
2026-02-03T03:31:32.396702731Z [inf]  }
2026-02-03T03:31:32.401655226Z [inf]  [verifyAccess] ✅ Access granted
2026-02-03T03:31:32.578551791Z [err]  Alchemy Portfolio EVM API error
2026-02-03T03:31:32.579200045Z [inf]  request completed
2026-02-03T03:31:33.340703489Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-03T03:31:33.340708609Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-03T03:31:33.340711369Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-03T03:31:34.486850362Z [inf]  Moderation Input check result
2026-02-03T03:31:34.486854352Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_start
2026-02-03T03:31:34.486857761Z [inf]  [ChatWorker] Sent message_start for cml61kwtv09tl8gymq6lxrgzw
2026-02-03T03:31:34.486861231Z [inf]  ChatWorker: seeded get_wallet_info from client context
2026-02-03T03:31:34.486865631Z [inf]  ToolPreRouter: Category matched
2026-02-03T03:31:34.486869541Z [inf]  [ChatWorker] Base filtered to 6 tools for message: "Sell 0x383283f086365fa8da4fa3fecc6402479e8eb3bc to..."
2026-02-03T03:31:34.486873681Z [inf]  [ChatWorker] 🔍 RAG check for: "Sell 0x383283f086365fa8da4fa3fecc6402479e8eb3bc to..."
2026-02-03T03:31:34.486876101Z [inf]  [ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).
2026-02-03T03:31:34.486878431Z [inf]  [ChatWorker] DeepSeek iteration 1/10 for task cml61kxa309tn8gym4apkz3ay
2026-02-03T03:31:34.486892611Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-03T03:31:34.486895221Z [inf]  [ChatWorker] DeepSeek model: deepseek-v3-fast -> deepseek-chat
2026-02-03T03:31:34.486897791Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-03T03:31:36.404515044Z [err]  INFO:moderation.router:Moderating input: Sell 0x383283f086365fa8da4fa3fecc6402479e8eb3bc to...
2026-02-03T03:31:36.404521544Z [err]  INFO:httpx:HTTP Request: POST https://api.openai.com/v1/moderations "HTTP/1.1 200 OK"
2026-02-03T03:31:36.404526199Z [inf]  INFO:     10.178.21.21:49394 - "POST /moderation/input HTTP/1.1" 200 OK
2026-02-03T03:31:39.442574851Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:31:39.699927505Z [inf]  Timer finished: intent_parsing_31e6c9b1
2026-02-03T03:31:39.721997371Z [inf]  Intent follow-up recorded
2026-02-03T03:31:39.722003451Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-03T03:31:39.722006611Z [inf]  DeepSeek: routed to mode
2026-02-03T03:31:39.722009241Z [inf]  [ChatWorker] Free intent mode: using 26 thinking tools
2026-02-03T03:31:39.722012210Z [inf]  DeepSeek: thinking mode without skills injection
2026-02-03T03:31:39.722015540Z [inf]  [ChatWorker] User Settings: {
2026-02-03T03:31:39.722018690Z [inf]    fastSwapMode: true,
2026-02-03T03:31:39.722021130Z [inf]    swapMethod: 'allowance_trade',
2026-02-03T03:31:39.722023440Z [inf]    toolConfig: [
2026-02-03T03:31:39.722025990Z [inf]      'userRole',
2026-02-03T03:31:39.722028400Z [inf]      'defaultSwapAmount',
2026-02-03T03:31:39.722030900Z [inf]      'defaultSwapUnit',
2026-02-03T03:31:39.723514084Z [inf]      'checkTokenBeforeSwap',
2026-02-03T03:31:39.723520293Z [inf]      'swapMethod',
2026-02-03T03:31:39.723524463Z [inf]      'slippageMode',
2026-02-03T03:31:39.723527943Z [inf]      'customSlippage',
2026-02-03T03:31:39.723531893Z [inf]      'mevProtection',
2026-02-03T03:31:39.723535603Z [inf]      'priceDeviationCheck',
2026-02-03T03:31:39.723539893Z [inf]      'fastSwapMode',
2026-02-03T03:31:39.723542733Z [inf]    chainId: 8453
2026-02-03T03:31:39.723544813Z [inf]      'copyTradeTokenCooldownMinutes',
2026-02-03T03:31:39.723549033Z [inf]      'minMarketCapUsd',
2026-02-03T03:31:39.723552953Z [inf]  }
2026-02-03T03:31:39.723554523Z [inf]      'minLiquidityUsd',
2026-02-03T03:31:39.723561143Z [inf]      'minTargetValueUsd',
2026-02-03T03:31:39.723561873Z [inf]  [ChatWorker] 🚀 Fast Swap Decision: {
2026-02-03T03:31:39.723566443Z [inf]      'id',
2026-02-03T03:31:39.723569333Z [inf]    fastSwapModeEnabled: true,
2026-02-03T03:31:39.723572123Z [inf]      'userId',
2026-02-03T03:31:39.723576413Z [inf]    isAllowanceTradeMode: true,
2026-02-03T03:31:39.723578733Z [inf]      'quickSwapMode',
2026-02-03T03:31:39.723584783Z [inf]    willFastSwap: true,
2026-02-03T03:31:39.723585063Z [inf]      'copyTradeAIMode',
2026-02-03T03:31:39.723591603Z [inf]      'updatedAt',
2026-02-03T03:31:39.723592023Z [inf]    reason: 'fastSwapMode=true'
2026-02-03T03:31:39.723598883Z [inf]      'createdAt',
2026-02-03T03:31:39.723599063Z [inf]  }
2026-02-03T03:31:39.723605622Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_start
2026-02-03T03:31:39.723605942Z [inf]      'zoraNotificationThreshold'
2026-02-03T03:31:39.723610362Z [inf]    ],
2026-02-03T03:31:39.723613972Z [inf]    walletConnected: true,
2026-02-03T03:31:39.724951997Z [inf]  [ChatWorker] 🚀 Fast swap: Sent message_start for cml61kwtv09tl8gymq6lxrgzw
2026-02-03T03:31:39.724959867Z [inf]  [ChatWorker] Fast swap parameters: {
2026-02-03T03:31:39.724966387Z [inf]    tokenIn: 'ETH',
2026-02-03T03:31:39.724971897Z [inf]    tokenOut: 'USDC',
2026-02-03T03:31:39.724976817Z [inf]    amountIn: '0.001',
2026-02-03T03:31:39.724981897Z [inf]    chainId: 1,
2026-02-03T03:31:39.724986727Z [inf]    swapIntent: { tokenIn: 'ETH', tokenOut: 'USDC', amount: null }
2026-02-03T03:31:39.724991557Z [inf]  }
2026-02-03T03:31:39.724996627Z [inf]  [ChatWorker] Chain detection: tokenIn=ETH..., actualChain=eth
2026-02-03T03:31:39.725001947Z [inf]  Created transaction card for fast swap
2026-02-03T03:31:39.725007027Z [inf]  [MainSwapService][1770089499717_b9v2ov] Starting unified swap execution
2026-02-03T03:31:39.725011617Z [inf]  Timer finished: launchpad_det_USDC
2026-02-03T03:31:39.725017427Z [inf]  Timer finished: launchpad_det_ETH
2026-02-03T03:31:39.725022337Z [inf]  [MainSwapService][1770089499717_b9v2ov] Executing EVM swap
2026-02-03T03:31:39.726029026Z [inf]  [MainSwapService][1770089499717_b9v2ov] FastSwapMode enabled - attempting direct swap (BUY with native)
2026-02-03T03:31:39.726034146Z [inf]  [DirectSwap] Starting direct swap
2026-02-03T03:31:39.726038316Z [err]  [DirectSwap] Direct swap failed
2026-02-03T03:31:39.726046515Z [wrn]  [MainSwapService][1770089499717_b9v2ov] Direct swap failed, falling back to 0x/Kyber
2026-02-03T03:31:39.726049925Z [inf]  Initiating Unified Swap Execution
2026-02-03T03:31:39.726054405Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:31:39.726865836Z [inf]  incoming request
2026-02-03T03:31:39.727973214Z [err]  [originRestriction] Request blocked {
2026-02-03T03:31:39.727978954Z [err]    origin: '',
2026-02-03T03:31:39.727984614Z [err]    referer: '',
2026-02-03T03:31:39.727986514Z [err]  }
2026-02-03T03:31:39.727990724Z [err]    effectiveOrigin: '',
2026-02-03T03:31:39.727991584Z [err]    "requestId": "req-er",
2026-02-03T03:31:39.727995263Z [err]    userAgent: 'node',
2026-02-03T03:31:39.727996693Z [err]    "method": "POST",
2026-02-03T03:31:39.727999403Z [err]    allowedOrigins: [
2026-02-03T03:31:39.728002113Z [err]    "url": "/api/swap/quote",
2026-02-03T03:31:39.728003863Z [err]      'https://kikoapp.app',
2026-02-03T03:31:39.728006463Z [err]    "ip": "127.0.0.1",
2026-02-03T03:31:39.728007893Z [err]      'https://kikoapp.pages.dev',
2026-02-03T03:31:39.728010653Z [err]    "error": {
2026-02-03T03:31:39.728012263Z [err]      'https://www.kikoapp.app',
2026-02-03T03:31:39.728015293Z [err]      "message": "Request origin not allowed",
2026-02-03T03:31:39.728016163Z [err]      'capacitor://localhost'
2026-02-03T03:31:39.728019693Z [err]      "name": "Error",
2026-02-03T03:31:39.728019923Z [err]    ]
2026-02-03T03:31:39.728023703Z [err]      "code": "ORIGIN_NOT_ALLOWED",
2026-02-03T03:31:39.728023983Z [err]  }
2026-02-03T03:31:39.728027683Z [err]      "statusCode": 403
2026-02-03T03:31:39.728031473Z [err]    }
2026-02-03T03:31:39.729011552Z [inf]  request completed
2026-02-03T03:31:39.768298256Z [wrn]  RPC endpoint failed
2026-02-03T03:31:39.812888402Z [wrn]  RPC endpoint failed
2026-02-03T03:31:39.854542940Z [wrn]  RPC endpoint failed
2026-02-03T03:31:39.870690910Z [wrn]  All API liquidity sources failed
2026-02-03T03:31:39.973800005Z [wrn]  RPC endpoint failed
2026-02-03T03:31:40.175838594Z [wrn]  RPC endpoint failed
2026-02-03T03:31:40.175843634Z [wrn]  RPC endpoint failed
2026-02-03T03:31:40.374464240Z [inf]  incoming request
2026-02-03T03:31:40.374467890Z [inf]  request completed
2026-02-03T03:31:40.508206605Z [err]  All RPC endpoints failed
2026-02-03T03:31:40.519138525Z [err]  All RPC endpoints failed
2026-02-03T03:31:40.547321211Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:31:40.547326201Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:31:40.547329591Z [err]  Critical: No valid price data available
2026-02-03T03:31:40.572916998Z [inf]  incoming request
2026-02-03T03:31:40.642013666Z [err]  2026-02-03 03:31:31.506 UTC [39244] ERROR:  insert or update on table "UserActivity" violates foreign key constraint "UserActivity_userId_fkey"
2026-02-03T03:31:40.642023734Z [err]  2026-02-03 03:31:31.506 UTC [39244] DETAIL:  Key (userId)=(cmk74yz4200qwab4gftg65b07) is not present in table "User".
2026-02-03T03:31:40.642031213Z [err]  2026-02-03 03:31:31.506 UTC [39244] STATEMENT:  INSERT INTO "public"."UserActivity" ("id","userId","date","logins","chatMessages","swapsCount","swapVolumeUsd","copyTrades","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT ("userId","date") DO UPDATE SET "chatMessages" = ("public"."UserActivity"."chatMessages" + $11), "updatedAt" = $12 WHERE (("public"."UserActivity"."userId" = $13 AND "public"."UserActivity"."date" = $14) AND 1=1) RETURNING "public"."UserActivity"."id", "public"."UserActivity"."userId", "public"."UserActivity"."date", "public"."UserActivity"."logins", "public"."UserActivity"."chatMessages", "public"."UserActivity"."swapsCount", "public"."UserActivity"."swapVolumeUsd", "public"."UserActivity"."copyTrades", "public"."UserActivity"."createdAt", "public"."UserActivity"."updatedAt"
2026-02-03T03:31:40.675464200Z [err]  All RPC endpoints failed
2026-02-03T03:31:40.675470890Z [err]  [RpcService] Failed to fetch decimals for USDC on chain 1
2026-02-03T03:31:40.675474180Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:31:40.695960033Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:31:40.695964393Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:31:40.695967713Z [err]  Critical: No valid price data available
2026-02-03T03:31:40.801119966Z [err]  Alchemy Portfolio EVM API error
2026-02-03T03:31:40.812718857Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:31:40.812725487Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:31:40.889125829Z [inf]  request completed
2026-02-03T03:31:40.900537102Z [err]  api failed after 1 attempts
2026-02-03T03:31:40.900544282Z [err]  0x API price fetch error
2026-02-03T03:31:40.900550032Z [err]  Critical: No valid price data available
2026-02-03T03:31:41.872446379Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:31:41.872452099Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:31:42.085088989Z [inf]  0x API price received successfully
2026-02-03T03:31:42.085096319Z [inf]  Fallback: Got price from DEX aggregator
2026-02-03T03:31:42.085101019Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:31:42.085105529Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:31:42.107715119Z [wrn]  All API liquidity sources failed
2026-02-03T03:31:42.373760797Z [wrn]  RPC endpoint failed
2026-02-03T03:31:42.373766506Z [wrn]  RPC endpoint failed
2026-02-03T03:31:42.373769126Z [wrn]  RPC endpoint failed
2026-02-03T03:31:42.373771796Z [wrn]  RPC endpoint failed
2026-02-03T03:31:42.373774326Z [wrn]  RPC circuit breaker opened
2026-02-03T03:31:42.373777286Z [wrn]  RPC endpoint failed
2026-02-03T03:31:42.447905284Z [wrn]  RPC circuit breaker opened
2026-02-03T03:31:42.455116394Z [wrn]  RPC circuit breaker opened
2026-02-03T03:31:42.679445695Z [err]  All RPC endpoints failed
2026-02-03T03:31:42.731731696Z [wrn]  RPC circuit breaker opened
2026-02-03T03:31:42.731736486Z [err]  All RPC endpoints failed
2026-02-03T03:31:42.755663980Z [wrn]  RPC circuit breaker opened
2026-02-03T03:31:42.755668340Z [err]  All RPC endpoints failed
2026-02-03T03:31:42.755671550Z [err]  [RpcService] Failed to fetch decimals for USDC on chain 1
2026-02-03T03:31:42.755674840Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:31:42.755677920Z [err]  Critical: No valid price data available
2026-02-03T03:31:42.854209867Z [wrn]  RPC native balance failed
2026-02-03T03:31:42.854214787Z [wrn]  Gas reserve check failed
2026-02-03T03:31:42.854217977Z [inf]  [PlatformFee] Fees ENABLED: { context: 'swap', bps: 50, evmRecipient: '0xc5377e6329' }
2026-02-03T03:31:42.919896457Z [inf]  No token metadata available, trying RPC fallback...
2026-02-03T03:31:43.070848493Z [inf]  No token metadata available, trying RPC fallback...
2026-02-03T03:31:43.086535589Z [inf]  Using 0x API fallback token metadata
2026-02-03T03:31:43.379958594Z [wrn]  RPC endpoint failed
2026-02-03T03:31:43.379963754Z [err]  All RPC endpoints failed
2026-02-03T03:31:43.379968194Z [err]  Error fetching decimals from RPC
2026-02-03T03:31:43.379972694Z [err]  api failed after 1 attempts
2026-02-03T03:31:43.379977554Z [err]  0x API price fetch error
2026-02-03T03:31:43.380434769Z [inf]  0x API price received successfully
2026-02-03T03:31:43.380439279Z [inf]  [PlatformFee] Fees ENABLED: { context: 'swap', bps: 50, evmRecipient: '0xc5377e6329' }
2026-02-03T03:31:43.380443799Z [inf]  [Kyber] GET routes {
2026-02-03T03:31:43.380447689Z [inf]    routesUrl: 'https://aggregator-api.kyberswap.com/ethereum/api/v1/routes?tokenIn=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&tokenOut=USDC&amountIn=1000000000000000&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B&feeReceiver=0xc5377e6329770Be29Ef938d8aCC11f22398D7E54&feeAmount=50&isInBps=true&chargeFeeBy=currency_in'
2026-02-03T03:31:43.380450779Z [inf]  }
2026-02-03T03:31:43.451729007Z [err]  api failed after 1 attempts
2026-02-03T03:31:43.451732987Z [err]  0x API Quote request failed
2026-02-03T03:31:43.451735947Z [err]  0x API Error fetching quote
2026-02-03T03:31:43.451743197Z [err]  [QuoteService] 0x failed Error: 0x API error (400): {"name":"INPUT_INVALID","message":"The input is invalid","data":{"zid":"0xfa1452993f44b8a1dd33a2f4","details":[{"field":"buyToken","reason":"Invalid ethereum address"},{"field":"swapFeeToken","reason":"Must be a single non-zero address or comma-separated non-zero addresses"}]}}
2026-02-03T03:31:43.452440610Z [err]      at getZeroExQuote (file:///app/dist/services/zeroEx.js:552:19)
2026-02-03T03:31:43.452443270Z [err]      at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
2026-02-03T03:31:43.452445460Z [err]      at async fetchZeroEx (file:///app/dist/services/quoteService.js:53:23)
2026-02-03T03:31:43.452447870Z [err]      at async Promise.all (index 0)
2026-02-03T03:31:43.452450000Z [err]      at async getBestQuoteInternal (file:///app/dist/services/quoteService.js:130:5)
2026-02-03T03:31:43.452452330Z [err]      at async SwapExecutor.executeEvm (file:///app/dist/services/swap/SwapExecutor.js:215:26)
2026-02-03T03:31:43.452455580Z [err]      at async SwapExecutor.execute (file:///app/dist/services/swap/SwapExecutor.js:42:24)
2026-02-03T03:31:43.452458660Z [err]      at async MainSwapService.executeEvmSwap (file:///app/dist/services/MainSwapService.js:344:33)
2026-02-03T03:31:43.452461090Z [err]      at async MainSwapService.executeSwap (file:///app/dist/services/MainSwapService.js:100:24)
2026-02-03T03:31:43.452463700Z [err]      at async ChatWorker.processDeepSeekTask (file:///app/dist/jobs/chatWorker.js:1375:38)
2026-02-03T03:31:43.642615120Z [err]  api failed after 2 attempts
2026-02-03T03:31:43.642624210Z [err]  [QuoteService] Kyber failed Error: HTTP 400: {"code":4000,"message":"bad request","details":[{"fieldViolations":[{"field":"tokenOut","description":"invalid"}]}],"requestId":"cc8a7a50-d01a-430b-b16a-ebc5dcf02ff0"}
2026-02-03T03:31:43.642629150Z [err]      at fetchJson (file:///app/dist/config/unifiedApiService.js:97:23)
2026-02-03T03:31:43.642634090Z [err]      at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
2026-02-03T03:31:43.642639030Z [err]      at async getKyberQuote (file:///app/dist/services/kyberAggregator.js:63:24)
2026-02-03T03:31:43.642642940Z [err]      at async fetchKyber (file:///app/dist/services/quoteService.js:99:32)
2026-02-03T03:31:43.642646800Z [err]      at async Promise.all (index 1)
2026-02-03T03:31:43.642650960Z [err]      at async getBestQuoteInternal (file:///app/dist/services/quoteService.js:130:5)
2026-02-03T03:31:43.642654610Z [err]      at async SwapExecutor.executeEvm (file:///app/dist/services/swap/SwapExecutor.js:215:26)
2026-02-03T03:31:43.642658860Z [err]      at async SwapExecutor.execute (file:///app/dist/services/swap/SwapExecutor.js:42:24)
2026-02-03T03:31:43.642662620Z [err]      at async MainSwapService.executeEvmSwap (file:///app/dist/services/MainSwapService.js:344:33)
2026-02-03T03:31:43.642666499Z [err]      at async MainSwapService.executeSwap (file:///app/dist/services/MainSwapService.js:100:24)
2026-02-03T03:31:43.642670259Z [err]  Swap Execution Failed
2026-02-03T03:31:43.643311533Z [err]  Raw Swap Error Captured
2026-02-03T03:31:43.643317283Z [err]  [MainSwapService][1770089499717_b9v2ov] Swap execution failed: Swap failed: No valid quotes found
2026-02-03T03:31:43.653922485Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
2026-02-03T03:31:43.665658525Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-03T03:31:43.678470563Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_task_status
2026-02-03T03:31:43.678475403Z [inf]  Timer finished: ws_broadcast_did:privy:cmk74yj4r03jcl70b8hwyuh2c_message_complete
2026-02-03T03:31:44.083057545Z [inf]  incoming request
2026-02-03T03:31:44.083065274Z [inf]  request completed
2026-02-03T03:31:44.083070314Z [inf]  incoming request
2026-02-03T03:31:44.083074354Z [inf]  request completed
2026-02-03T03:31:44.380029460Z [inf]  incoming request
2026-02-03T03:31:44.380034120Z [inf]  incoming request
2026-02-03T03:31:44.380042520Z [inf]  request completed
2026-02-03T03:31:44.380046790Z [inf]  request completed
2026-02-03T03:31:47.672500096Z [inf]  [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
2026-02-03T03:31:47.672506056Z [inf]  Fetching premium trending tokens
2026-02-03T03:31:47.672511626Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:31:50.720891008Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:31:50.720894588Z [err]  Error fetching trending tokens
2026-02-03T03:31:50.720897618Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:31:50.720900228Z [inf]  [TokenJob] DexScreener returned 6 tokens, trying GeckoTerminal fallback...
2026-02-03T03:31:50.720903478Z [inf]  [TokenJob] Got 6 trending tokens for Arbitrum
2026-02-03T03:31:50.720906378Z [err]  Error fetching trending tokens
2026-02-03T03:31:50.723835336Z [inf]  Saved 6 trending tokens for arbitrum to database and memory cache
2026-02-03T03:31:50.733459519Z [inf]  [TokenJob] Saved 6 tokens for Arbitrum to DB + cache
2026-02-03T03:31:50.813658501Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:31:51.503577392Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:31:51.503582462Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:31:51.510882552Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:31:51.510889062Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:31:51.898196249Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:31:51.898200249Z [err]  Critical: No valid price data available
2026-02-03T03:31:51.937513493Z [inf]  0x API price received successfully
2026-02-03T03:31:51.937517513Z [err]  Critical: No valid price data available
2026-02-03T03:31:52.050588440Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:31:52.050597439Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:32:00.431974281Z [inf]  incoming request
2026-02-03T03:32:00.431979861Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_3pxy7t59d4flre4h","createdAt":"2026-02-03T03:32:00.133Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","toAddress":"0x383283f086365fa8da4fa3fecc6402479e8eb3bc","blockNum":"0x27b87a6","hash":"0x21df296d16569f2b58836b7b06b92e8d0f52567b69769407b69c99aaf2e0f0a2","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x69816c2f"}],"source":"chainlake-kafka"}}
2026-02-03T03:32:00.431983710Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:32:00.431987260Z [inf]  request completed
2026-02-03T03:32:00.431990520Z [inf]  [Webhook] ⚠️ Ignoring tx 0x21df29: No matched tracked wallets in [0xfb64, 0x3832]
2026-02-03T03:32:02.055176865Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:32:03.278397651Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:32:03.278404261Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:32:03.278408481Z [err]  Critical: No valid price data available
2026-02-03T03:32:03.448373279Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:32:03.448384279Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:32:03.448390479Z [err]  Critical: No valid price data available
2026-02-03T03:32:03.582101708Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:32:03.582107908Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:32:08.042651634Z [inf]  [SocialJob] Checking Zora coin status for 268 casts...
2026-02-03T03:32:10.209211819Z [err]  2026-02-03 03:32:05.272 UTC [27] LOG:  checkpoint complete: wrote 449 buffers (2.7%); 0 WAL file(s) added, 0 removed, 0 recycled; write=44.893 s, sync=0.015 s, total=44.930 s; sync files=61, longest=0.009 s, average=0.001 s; distance=2514 kB, estimate=3292 kB; lsn=3/3CED3648, redo lsn=3/3CE966F8
2026-02-03T03:32:10.741080146Z [err]  [DBLock] Lock already held {
2026-02-03T03:32:10.741089166Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T03:32:10.741095456Z [err]    expiresAt: '2026-01-29T11:00:40.912Z',
2026-02-03T03:32:10.741101476Z [err]    ageMs: 405329824
2026-02-03T03:32:10.741107235Z [err]  }
2026-02-03T03:32:10.741112865Z [err]  [DBLock] Potential stale lock detected {
2026-02-03T03:32:10.741118225Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T03:32:10.741130965Z [err]    ageMs: 405329824,
2026-02-03T03:32:10.741136775Z [err]    ttlSeconds: 240
2026-02-03T03:32:10.741144095Z [err]  }
2026-02-03T03:32:10.741149605Z [inf]  [TokenJob] Skipping refresh for Optimism - another instance holds the lock
2026-02-03T03:32:13.673494506Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:32:14.548718676Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:32:14.548724295Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:32:14.548728165Z [err]  Critical: No valid price data available
2026-02-03T03:32:14.672207020Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:32:14.672212530Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:32:14.672216420Z [err]  Critical: No valid price data available
2026-02-03T03:32:14.800510001Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:32:14.800516041Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:32:16.195934719Z [inf]  incoming request
2026-02-03T03:32:16.195939489Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_bw4qsmtdpqcw26u2","createdAt":"2026-02-03T03:32:15.996Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","toAddress":"0x4409921ae43a39a11d90f7b7f96cfd0b8093d9fc","blockNum":"0x27b87ae","hash":"0xaa5225202935c00cb550d982d9141bbd9130bf06139e25373cbe02806661cb23","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x69816c3f"}],"source":"chainlake-kafka"}}
2026-02-03T03:32:16.195942629Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:32:16.195945779Z [inf]  request completed
2026-02-03T03:32:16.199882535Z [inf]  [Webhook] ⚠️ Ignoring tx 0xaa5225: No matched tracked wallets in [0xfb64, 0x4409]
2026-02-03T03:32:16.215818200Z [inf]  incoming request
2026-02-03T03:32:16.215830910Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_0h21tjxrlceoc7jc","createdAt":"2026-02-03T03:32:16.030Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4409921ae43a39a11d90f7b7f96cfd0b8093d9fc","toAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","blockNum":"0x27b87ae","hash":"0xaa5225202935c00cb550d982d9141bbd9130bf06139e25373cbe02806661cb23","value":0.005713548627382912,"typeTraceAddress":"CALL_6","asset":"ETH","category":"internal","rawContract":{"rawValue":"0x144c7134579280","decimals":18},"blockTimestamp":"0x69816c3f"}]}}
2026-02-03T03:32:16.215835690Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:32:16.215839309Z [inf]  request completed
2026-02-03T03:32:16.217264884Z [inf]  [Webhook] ⚠️ Ignoring tx 0xaa5225: No matched tracked wallets in [0x4409, 0xfb64]
2026-02-03T03:32:16.451396875Z [inf]  incoming request
2026-02-03T03:32:16.451400135Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_auq8najiffbttsaf","createdAt":"2026-02-03T03:32:16.062Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","toAddress":"0xd87b6f1b9fcb9deb0baf5661ffd9775ab5e94a55","blockNum":"0x27b87ae","hash":"0xaa5225202935c00cb550d982d9141bbd9130bf06139e25373cbe02806661cb23","value":2723567.518978611,"asset":"TCRUST","category":"token","rawContract":{"rawValue":"0x0000000000000000000000000000000000000000000240bce41bcfe2c3a1f701","address":"0x383283f086365fa8da4fa3fecc6402479e8eb3bc","decimals":18},"log":{"address":"0x383283f086365fa8da4fa3fecc6402479e8eb3bc","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b","0x000000000000000000000000d87b6f1b9fcb9deb0baf5661ffd9775ab5e94a55"],"data":"0x0000000000000000000000000000000000000000000240bce41bcfe2c3a1f701","blockHash":"0x31f1d428329faf4dc584cbe8e8166b1c34803184c7e62192dd0d5c6f90f8f4fa","blockNumber":"0x27b87ae","blockTimestamp":"0x69816c3f","transactionHash":"0xaa5225202935c00cb550d982d9141bbd9130bf06139e25373cbe02806661cb23","transactionIndex":"0x8d","logIndex":"0x29a","removed":false},"blockTimestamp":"0x69816c3f"}],"source":"chainlake-kafka"}}
2026-02-03T03:32:16.451403005Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:32:16.451406065Z [inf]  request completed
2026-02-03T03:32:16.451411995Z [inf]  [Webhook] ⚠️ Ignoring tx 0xaa5225: No matched tracked wallets in [0xfb64, 0xd87b]
2026-02-03T03:32:24.799788995Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:32:25.698331506Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:32:25.698337836Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:32:25.778644440Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:32:25.778653919Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:32:25.862218256Z [inf]  [SocialRepo] Cleaned up 106 old casts (cap: 1000)
2026-02-03T03:32:26.210543958Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:32:26.210549828Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:32:26.301033138Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:32:26.301037968Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:32:26.511248215Z [inf]  Timer finished: get_trending_casts_trending
2026-02-03T03:32:26.526370379Z [inf]  Auto-closing position: 0 balance found on-chain (likely manual sell)
2026-02-03T03:32:26.549351245Z [inf]  [Warpcast] Sending DM to FID 877398: "🔴 Sold $TCRUST
2026-02-03T03:32:26.549355965Z [inf]  
2026-02-03T03:32:26.549358595Z [inf]  🔴 **SOLD $TCRUST**
2026-02-03T03:32:26.549361315Z [inf]  💰 **Value**:..."
2026-02-03T03:32:26.598203185Z [inf]  SocialRepo: Updated cache with 500 merged casts
2026-02-03T03:32:26.598208415Z [inf]  SocialRepo: Saved 268 trending casts to database
2026-02-03T03:32:26.598212365Z [inf]  Timer finished: save_trending_casts
2026-02-03T03:32:26.598215965Z [inf]  [SocialJob] Casts refreshed: 268 saved
2026-02-03T03:32:26.598219315Z [inf]  [SocialJob] 🚀 Triggering OGP Prefetch for top 50 casts...
2026-02-03T03:32:27.148924561Z [inf]  [Warpcast] DM sent successfully. Daily usage: 39/50000
2026-02-03T03:32:33.613744735Z [err]  
2026-02-03T03:32:33.613751395Z [err]  FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
2026-02-03T03:32:33.613755845Z [err]  ----- Native stack trace -----
2026-02-03T03:32:33.613760415Z [err]  
2026-02-03T03:32:33.613766365Z [err]   1: 0xb76db1 node::OOMErrorHandler(char const*, v8::OOMDetails const&) [node]
2026-02-03T03:32:33.613767585Z [err]  
2026-02-03T03:32:33.613771395Z [err]   2: 0xee62f0 v8::Utils::ReportOOMFailure(v8::internal::Isolate*, char const*, v8::OOMDetails const&) [node]
2026-02-03T03:32:33.613782055Z [err]  <--- Last few GCs --->
2026-02-03T03:32:33.613787025Z [err]  
2026-02-03T03:32:33.613790585Z [err]  [13:0x10903ad0] 31842013 ms: Scavenge 251.1 (258.0) -> 251.0 (259.0) MB, 1.55 / 0.00 ms  (average mu = 0.476, current mu = 0.354) allocation failure; 
2026-02-03T03:32:33.613793775Z [err]  [13:0x10903ad0] 31843008 ms: Mark-Compact 252.0 (259.0) -> 251.9 (259.7) MB, 994.62 / 0.00 ms  (average mu = 0.236, current mu = 0.004) allocation failure; scavenge might not succeed
2026-02-03T03:32:33.613797375Z [err]  
2026-02-03T03:32:33.613800325Z [err]  
2026-02-03T03:32:33.613803615Z [err]  <--- JS stacktrace --->
2026-02-03T03:32:33.614463528Z [err]   3: 0xee65d7 v8::internal::V8::FatalProcessOutOfMemory(v8::internal::Isolate*, char const*, v8::OOMDetails const&) [node]
2026-02-03T03:32:33.614469918Z [err]   4: 0x10f82d5  [node]
2026-02-03T03:32:33.615201499Z [err]   5: 0x1110158 v8::internal::Heap::CollectGarbage(v8::internal::AllocationSpace, v8::internal::GarbageCollectionReason, v8::GCCallbackFlags) [node]
2026-02-03T03:32:33.615205589Z [err]   6: 0x10e6271 v8::internal::HeapAllocator::AllocateRawWithLightRetrySlowPath(int, v8::internal::AllocationType, v8::internal::AllocationOrigin, v8::internal::AllocationAlignment) [node]
2026-02-03T03:32:33.615829623Z [err]   7: 0x10e7405 v8::internal::HeapAllocator::AllocateRawWithRetryOrFailSlowPath(int, v8::internal::AllocationType, v8::internal::AllocationOrigin, v8::internal::AllocationAlignment) [node]
2026-02-03T03:32:33.615833333Z [err]   8: 0x10c4a56 v8::internal::Factory::NewFillerObject(int, v8::internal::AllocationAlignment, v8::internal::AllocationType, v8::internal::AllocationOrigin) [node]
2026-02-03T03:32:33.616434286Z [err]   9: 0x1520596 v8::internal::Runtime_AllocateInYoungGeneration(int, unsigned long*, v8::internal::Isolate*) [node]
2026-02-03T03:32:33.617478194Z [err]  10: 0x1959ef6  [node]
2026-02-03T03:32:33.647678620Z [err]  Aborted
2026-02-03T03:32:34.316899083Z [inf]  
2026-02-03T03:32:34.316902622Z [inf]  > kiko-api@1.0.0 start
2026-02-03T03:32:34.316905842Z [inf]  > node dist/index.js
2026-02-03T03:32:34.316917232Z [inf]  
2026-02-03T03:32:37.146775325Z [inf]  [Prisma] Initializing client (Pool: 20, Timeout: 45s, Connect: 20s)
2026-02-03T03:32:37.245515345Z [inf]  Zora SDK initialized with API Key
2026-02-03T03:32:37.708523536Z [err]  [SocialJob] Could not find real_hot_users.json in any candidate path
2026-02-03T03:32:38.125722741Z [inf]  [Warpcast] Loaded 10 API keys. Daily capacity: 50000 messages.
2026-02-03T03:32:38.230934250Z [err]  [Encryption] ⚠️ ENCRYPTION_KEY not set! Sensitive data will be stored in plaintext.
2026-02-03T03:32:38.526236301Z [inf]  [SkillRegistry:exec] Loading skills from /app/dist/skills...
2026-02-03T03:32:38.526241610Z [inf]  [SkillRegistry:clean] Loading skills from /app/dist/skills...
2026-02-03T03:32:38.548027590Z [inf]  Serving static files from:
2026-02-03T03:32:38.548033310Z [inf]  Initializing services...
2026-02-03T03:32:38.657164146Z [inf]  [Prisma] DB connection is healthy
2026-02-03T03:32:38.670240332Z [inf]  Database connection successful
2026-02-03T03:32:38.670244302Z [inf]  [DataRetention] Checking retention policies...
2026-02-03T03:32:38.680626757Z [inf]  [DataRetention] Starting cleanup job...
2026-02-03T03:32:38.680632527Z [inf]  Redis initialized
2026-02-03T03:32:38.680636107Z [inf]  Starting server on port 8080...
2026-02-03T03:32:38.818925111Z [inf]  Server listening at http://0.0.0.0:8080
2026-02-03T03:32:38.818933461Z [inf]  Server listening
2026-02-03T03:32:38.829385836Z [inf]  [MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)
2026-02-03T03:32:38.875656035Z [inf]  [TokenJob] Scheduled: Every 5min (Ethereum, Solana, Base, BSC, Arbitrum, Optimism, Polygon)
2026-02-03T03:32:38.880723459Z [inf]  [SocialJob] Scheduled: Discovery (30m), Refresh (4h), Scoring (5m)
2026-02-03T03:32:38.880733209Z [inf]  Background jobs started
2026-02-03T03:32:38.880738999Z [inf]  Initializing auto trade service...
2026-02-03T03:32:38.880745239Z [inf]  [SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.
2026-02-03T03:32:38.880750849Z [inf]  Auto trade service initialized (Solana watcher + EVM webhook enabled)
2026-02-03T03:32:38.880758679Z [inf]  Auto trade service started
2026-02-03T03:32:38.880763649Z [inf]  [PositionMonitor] Starting position monitor (every 30s)...
2026-02-03T03:32:38.880770148Z [inf]  Position monitor started
2026-02-03T03:32:38.880774458Z [inf]  Token Alert Service started
2026-02-03T03:32:38.880780018Z [inf]  Token alert service started
2026-02-03T03:32:38.880784748Z [inf]  [ChatWorker] Started polling for AI tasks (interval: 3000ms)
2026-02-03T03:32:38.880789568Z [inf]  Chat worker started
2026-02-03T03:32:38.881637869Z [inf]  Starting Global Zora Alpha Detector (API Polling)
2026-02-03T03:32:38.881643789Z [inf]  🎉 All services initialized!
2026-02-03T03:32:38.951664397Z [err]  [DataRetention] No cleanup handler for table: SuggestionEvent
2026-02-03T03:32:38.951670967Z [inf]  [DataRetention] Cleanup job completed.
2026-02-03T03:32:40.589277751Z [err]  2026-02-03 03:32:33.646 UTC [39244] LOG:  could not receive data from client: Connection reset by peer
2026-02-03T03:32:40.589288111Z [err]  2026-02-03 03:32:33.646 UTC [39245] LOG:  could not receive data from client: Connection reset by peer
2026-02-03T03:32:40.589294412Z [err]  2026-02-03 03:32:33.646 UTC [39246] LOG:  could not receive data from client: Connection reset by peer
2026-02-03T03:32:40.589301204Z [err]  2026-02-03 03:32:33.646 UTC [39110] LOG:  could not receive data from client: Connection reset by peer
2026-02-03T03:32:40.589306994Z [err]  2026-02-03 03:32:33.646 UTC [39243] LOG:  could not receive data from client: Connection reset by peer
2026-02-03T03:32:43.838657900Z [inf]  [MarketJob] Running startup staleness check...
2026-02-03T03:32:43.838663870Z [inf]  [MarketJob] Overview is fresh, skipping API call
2026-02-03T03:32:43.880256011Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:32:43.988749584Z [inf]  [SocialJob] Trending casts are fresh, skipping Snapchain API call
2026-02-03T03:32:45.207290334Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:32:45.207295874Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:32:45.254714392Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:32:45.254718892Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:32:45.294889028Z [inf]  Saved batch 1/351
2026-02-03T03:32:45.313953828Z [inf]  Saved batch 2/351
2026-02-03T03:32:45.378798413Z [inf]  Saved batch 3/351
2026-02-03T03:32:45.399156739Z [inf]  Saved batch 4/351
2026-02-03T03:32:45.409864470Z [inf]  Saved batch 5/351
2026-02-03T03:32:45.558952056Z [inf]  Saved batch 6/351
2026-02-03T03:32:45.558957956Z [inf]  Saved batch 7/351
2026-02-03T03:32:45.558958506Z [inf]  Saved batch 9/351
2026-02-03T03:32:45.558963786Z [inf]  Saved batch 8/351
2026-02-03T03:32:45.558972626Z [inf]  Saved batch 10/351
2026-02-03T03:32:45.599746446Z [inf]  Saved batch 11/351
2026-02-03T03:32:45.620126112Z [inf]  Saved batch 12/351
2026-02-03T03:32:45.630449498Z [inf]  Saved batch 13/351
2026-02-03T03:32:45.683247785Z [inf]  Saved batch 14/351
2026-02-03T03:32:45.697254940Z [inf]  Saved batch 15/351
2026-02-03T03:32:45.718927612Z [inf]  Saved batch 16/351
2026-02-03T03:32:45.735282881Z [inf]  Saved batch 17/351
2026-02-03T03:32:45.777316868Z [inf]  Saved batch 18/351
2026-02-03T03:32:45.793570218Z [inf]  Saved batch 19/351
2026-02-03T03:32:45.826983550Z [inf]  Saved batch 20/351
2026-02-03T03:32:45.838324245Z [inf]  Saved batch 21/351
2026-02-03T03:32:45.878414992Z [inf]  Saved batch 22/351
2026-02-03T03:32:45.889688448Z [inf]  Saved batch 23/351
2026-02-03T03:32:45.910725346Z [inf]  Saved batch 24/351
2026-02-03T03:32:45.928090285Z [inf]  Saved batch 25/351
2026-02-03T03:32:45.938467631Z [inf]  Saved batch 26/351
2026-02-03T03:32:45.949071724Z [inf]  Saved batch 27/351
2026-02-03T03:32:45.986829137Z [inf]  Saved batch 28/351
2026-02-03T03:32:45.997748336Z [inf]  Saved batch 29/351
2026-02-03T03:32:46.017968244Z [inf]  Saved batch 30/351
2026-02-03T03:32:46.038993872Z [inf]  Saved batch 31/351
2026-02-03T03:32:46.065598038Z [inf]  Saved batch 32/351
2026-02-03T03:32:46.087896972Z [inf]  Saved batch 33/351
2026-02-03T03:32:46.107321038Z [inf]  Saved batch 34/351
2026-02-03T03:32:46.117837592Z [inf]  Saved batch 35/351
2026-02-03T03:32:46.129331095Z [inf]  Saved batch 36/351
2026-02-03T03:32:46.214926801Z [inf]  Saved batch 37/351
2026-02-03T03:32:46.222968152Z [inf]  Saved batch 38/351
2026-02-03T03:32:46.233643745Z [inf]  Saved batch 39/351
2026-02-03T03:32:46.285271096Z [inf]  Saved batch 40/351
2026-02-03T03:32:46.300600227Z [inf]  Saved batch 41/351
2026-02-03T03:32:46.320399538Z [inf]  Saved batch 42/351
2026-02-03T03:32:46.330104621Z [inf]  Saved batch 43/351
2026-02-03T03:32:46.380729754Z [inf]  Saved batch 44/351
2026-02-03T03:32:46.391184738Z [inf]  Saved batch 45/351
2026-02-03T03:32:46.417783644Z [inf]  Saved batch 46/351
2026-02-03T03:32:46.553140612Z [inf]  Saved batch 47/351
2026-02-03T03:32:46.553147282Z [inf]  Saved batch 48/351
2026-02-03T03:32:46.553150622Z [inf]  Saved batch 49/351
2026-02-03T03:32:46.575714403Z [inf]  Saved batch 50/351
2026-02-03T03:32:46.591795475Z [inf]  Saved batch 51/351
2026-02-03T03:32:46.596429125Z [inf]  Saved batch 52/351
2026-02-03T03:32:46.617597221Z [inf]  Saved batch 53/351
2026-02-03T03:32:46.629045555Z [inf]  Saved batch 54/351
2026-02-03T03:32:46.633853102Z [inf]  Saved batch 55/351
2026-02-03T03:32:46.683681673Z [inf]  Saved batch 56/351
2026-02-03T03:32:46.691679734Z [inf]  Saved batch 57/351
2026-02-03T03:32:46.713946378Z [inf]  Saved batch 58/351
2026-02-03T03:32:46.726173684Z [inf]  Saved batch 59/351
2026-02-03T03:32:46.735050196Z [inf]  Saved batch 60/351
2026-02-03T03:32:46.782671541Z [inf]  Saved batch 61/351
2026-02-03T03:32:46.810261116Z [inf]  Saved batch 62/351
2026-02-03T03:32:46.821212415Z [inf]  Saved batch 63/351
2026-02-03T03:32:46.826049302Z [inf]  Saved batch 64/351
2026-02-03T03:32:46.836620926Z [inf]  Saved batch 65/351
2026-02-03T03:32:46.888614912Z [inf]  Saved batch 66/351
2026-02-03T03:32:46.897920779Z [inf]  Saved batch 67/351
2026-02-03T03:32:46.919079207Z [inf]  Saved batch 68/351
2026-02-03T03:32:46.929927997Z [inf]  Saved batch 69/351
2026-02-03T03:32:46.938511713Z [inf]  Saved batch 70/351
2026-02-03T03:32:46.985669052Z [inf]  Saved batch 71/351
2026-02-03T03:32:46.994536554Z [inf]  Saved batch 72/351
2026-02-03T03:32:47.011993972Z [inf]  Saved batch 73/351
2026-02-03T03:32:47.024343456Z [inf]  Saved batch 74/351
2026-02-03T03:32:47.035000038Z [inf]  Saved batch 75/351
2026-02-03T03:32:47.081102409Z [inf]  Saved batch 76/351
2026-02-03T03:32:47.111361147Z [inf]  Saved batch 77/351
2026-02-03T03:32:47.123791119Z [inf]  Saved batch 78/351
2026-02-03T03:32:47.168183449Z [inf]  Saved batch 79/351
2026-02-03T03:32:47.187992622Z [inf]  Saved batch 80/351
2026-02-03T03:32:47.202919866Z [inf]  Saved batch 81/351
2026-02-03T03:32:47.213322642Z [inf]  Saved batch 82/351
2026-02-03T03:32:47.223120704Z [inf]  Saved batch 83/351
2026-02-03T03:32:47.233695477Z [inf]  Saved batch 84/351
2026-02-03T03:32:47.241823767Z [inf]  Saved batch 85/351
2026-02-03T03:32:47.246364387Z [inf]  Saved batch 86/351
2026-02-03T03:32:47.288219166Z [inf]  Saved batch 87/351
2026-02-03T03:32:47.305305458Z [inf]  Saved batch 88/351
2026-02-03T03:32:47.325375636Z [inf]  Saved batch 89/351
2026-02-03T03:32:47.335645983Z [inf]  Saved batch 90/351
2026-02-03T03:32:47.381425098Z [inf]  Saved batch 91/351
2026-02-03T03:32:47.386067967Z [inf]  Saved batch 92/351
2026-02-03T03:32:47.413046840Z [inf]  Saved batch 93/351
2026-02-03T03:32:47.531170087Z [inf]  Saved batch 94/351
2026-02-03T03:32:47.531176687Z [inf]  Saved batch 95/351
2026-02-03T03:32:47.531181137Z [inf]  Saved batch 96/351
2026-02-03T03:32:47.531184767Z [inf]  Saved batch 97/351
2026-02-03T03:32:47.531188897Z [inf]  Saved batch 98/351
2026-02-03T03:32:47.531192607Z [inf]  Saved batch 99/351
2026-02-03T03:32:47.533790498Z [inf]  Saved batch 100/351
2026-02-03T03:32:47.582508421Z [inf]  Saved batch 101/351
2026-02-03T03:32:47.602200964Z [inf]  Saved batch 102/351
2026-02-03T03:32:47.613138623Z [inf]  Saved batch 103/351
2026-02-03T03:32:47.623962924Z [inf]  Saved batch 104/351
2026-02-03T03:32:47.644028932Z [inf]  Saved batch 105/351
2026-02-03T03:32:47.687483124Z [inf]  Saved batch 106/351
2026-02-03T03:32:47.713720304Z [inf]  Saved batch 107/351
2026-02-03T03:32:47.733897981Z [inf]  Saved batch 108/351
2026-02-03T03:32:47.743862082Z [inf]  Saved batch 109/351
2026-02-03T03:32:47.783025869Z [inf]  Saved batch 110/351
2026-02-03T03:32:47.791749873Z [inf]  Saved batch 111/351
2026-02-03T03:32:47.808488389Z [inf]  Saved batch 112/351
2026-02-03T03:32:47.820314879Z [inf]  Saved batch 113/351
2026-02-03T03:32:47.836364131Z [inf]  Saved batch 114/351
2026-02-03T03:32:47.876741436Z [inf]  Saved batch 115/351
2026-02-03T03:32:47.887444009Z [inf]  Saved batch 116/351
2026-02-03T03:32:47.896935624Z [inf]  Saved batch 117/351
2026-02-03T03:32:47.929667903Z [inf]  Saved batch 118/351
2026-02-03T03:32:47.936171911Z [inf]  Saved batch 119/351
2026-02-03T03:32:47.946676355Z [inf]  Saved batch 120/351
2026-02-03T03:32:47.990169706Z [inf]  Saved batch 121/351
2026-02-03T03:32:47.999936718Z [inf]  Saved batch 122/351
2026-02-03T03:32:48.009932498Z [inf]  Saved batch 123/351
2026-02-03T03:32:48.019469192Z [inf]  Saved batch 124/351
2026-02-03T03:32:48.024253370Z [inf]  Saved batch 125/351
2026-02-03T03:32:48.034568076Z [inf]  Saved batch 126/351
2026-02-03T03:32:48.078503761Z [inf]  Saved batch 127/351
2026-02-03T03:32:48.096241416Z [inf]  Saved batch 128/351
2026-02-03T03:32:48.107046737Z [inf]  Saved batch 129/351
2026-02-03T03:32:48.119422851Z [inf]  Saved batch 130/351
2026-02-03T03:32:48.124213858Z [inf]  Saved batch 131/351
2026-02-03T03:32:48.132307959Z [inf]  Saved batch 132/351
2026-02-03T03:32:48.184399844Z [inf]  Saved batch 133/351
2026-02-03T03:32:48.194601602Z [inf]  Saved batch 134/351
2026-02-03T03:32:48.200257089Z [inf]  Saved batch 135/351
2026-02-03T03:32:48.225657299Z [inf]  Saved batch 136/351
2026-02-03T03:32:48.242594253Z [inf]  Saved batch 137/351
2026-02-03T03:32:48.268981002Z [inf]  Saved batch 138/351
2026-02-03T03:32:48.302966107Z [inf]  Saved batch 139/351
2026-02-03T03:32:48.309526524Z [inf]  Saved batch 140/351
2026-02-03T03:32:48.330552692Z [inf]  Saved batch 141/351
2026-02-03T03:32:48.353767426Z [inf]  Saved batch 142/351
2026-02-03T03:32:48.392808226Z [inf]  Saved batch 143/351
2026-02-03T03:32:48.420325662Z [inf]  Saved batch 144/351
2026-02-03T03:32:48.546940987Z [inf]  Saved batch 145/351
2026-02-03T03:32:48.546943587Z [inf]  Saved batch 146/351
2026-02-03T03:32:48.546946287Z [inf]  Saved batch 147/351
2026-02-03T03:32:48.546949367Z [inf]  Saved batch 148/351
2026-02-03T03:32:48.546952527Z [inf]  Saved batch 149/351
2026-02-03T03:32:48.546955037Z [inf]  Saved batch 150/351
2026-02-03T03:32:48.546957827Z [inf]  Saved batch 151/351
2026-02-03T03:32:48.572269477Z [inf]  Saved batch 152/351
2026-02-03T03:32:48.593280416Z [inf]  Saved batch 153/351
2026-02-03T03:32:48.604142356Z [inf]  Saved batch 154/351
2026-02-03T03:32:48.627931874Z [inf]  Saved batch 155/351
2026-02-03T03:32:48.645104064Z [inf]  Saved batch 156/351
2026-02-03T03:32:48.678940681Z [inf]  Saved batch 157/351
2026-02-03T03:32:48.721989786Z [inf]  Saved batch 158/351
2026-02-03T03:32:48.747854491Z [inf]  Saved batch 159/351
2026-02-03T03:32:48.768394595Z [inf]  Saved batch 160/351
2026-02-03T03:32:48.788753281Z [inf]  Saved batch 161/351
2026-02-03T03:32:48.831003425Z [inf]  Saved batch 162/351
2026-02-03T03:32:48.871370630Z [inf]  Saved batch 163/351
2026-02-03T03:32:48.897010857Z [inf]  Saved batch 164/351
2026-02-03T03:32:48.936122206Z [inf]  Saved batch 165/351
2026-02-03T03:32:48.985527311Z [inf]  Saved batch 166/351
2026-02-03T03:32:49.018970723Z [inf]  Saved batch 167/351
2026-02-03T03:32:49.039832602Z [inf]  Saved batch 168/351
2026-02-03T03:32:49.060900290Z [inf]  Saved batch 169/351
2026-02-03T03:32:49.091650561Z [inf]  Saved batch 170/351
2026-02-03T03:32:49.108441576Z [inf]  Saved batch 171/351
2026-02-03T03:32:49.125796725Z [inf]  Saved batch 172/351
2026-02-03T03:32:49.156992381Z [inf]  Saved batch 173/351
2026-02-03T03:32:49.205536975Z [inf]  Saved batch 174/351
2026-02-03T03:32:49.263203560Z [inf]  Saved batch 175/351
2026-02-03T03:32:49.288915486Z [inf]  Saved batch 176/351
2026-02-03T03:32:49.303289488Z [inf]  Saved batch 177/351
2026-02-03T03:32:49.314118379Z [inf]  Saved batch 178/351
2026-02-03T03:32:49.341303019Z [inf]  Saved batch 179/351
2026-02-03T03:32:49.366118025Z [inf]  Saved batch 180/351
2026-02-03T03:32:49.377576239Z [inf]  Saved batch 181/351
2026-02-03T03:32:49.394895578Z [inf]  Saved batch 182/351
2026-02-03T03:32:49.406617838Z [inf]  Saved batch 183/351
2026-02-03T03:32:49.592413550Z [inf]  Saved batch 184/351
2026-02-03T03:32:49.592447270Z [inf]  Saved batch 185/351
2026-02-03T03:32:49.592450700Z [inf]  Saved batch 186/351
2026-02-03T03:32:49.592454360Z [inf]  Saved batch 187/351
2026-02-03T03:32:49.592458070Z [inf]  Saved batch 188/351
2026-02-03T03:32:49.592462430Z [inf]  Saved batch 189/351
2026-02-03T03:32:49.592466230Z [inf]  Saved batch 190/351
2026-02-03T03:32:49.592469970Z [inf]  Saved batch 191/351
2026-02-03T03:32:49.592479359Z [inf]  Saved batch 192/351
2026-02-03T03:32:49.594567907Z [inf]  Saved batch 193/351
2026-02-03T03:32:49.608682661Z [inf]  Saved batch 194/351
2026-02-03T03:32:49.620101705Z [inf]  Saved batch 195/351
2026-02-03T03:32:49.635189989Z [inf]  Saved batch 196/351
2026-02-03T03:32:49.681308690Z [inf]  Saved batch 197/351
2026-02-03T03:32:49.693009891Z [inf]  Saved batch 198/351
2026-02-03T03:32:49.717109385Z [inf]  Saved batch 199/351
2026-02-03T03:32:49.728563280Z [inf]  Saved batch 200/351
2026-02-03T03:32:49.777700817Z [inf]  Saved batch 201/351
2026-02-03T03:32:49.790741483Z [inf]  Saved batch 202/351
2026-02-03T03:32:49.805963126Z [inf]  Saved batch 203/351
2026-02-03T03:32:49.815672939Z [inf]  Saved batch 204/351
2026-02-03T03:32:49.825054805Z [inf]  Saved batch 205/351
2026-02-03T03:32:49.833630970Z [inf]  Saved batch 206/351
2026-02-03T03:32:49.880816911Z [inf]  Saved batch 207/351
2026-02-03T03:32:49.890233717Z [inf]  Saved batch 208/351
2026-02-03T03:32:49.899082079Z [inf]  Saved batch 209/351
2026-02-03T03:32:49.913943455Z [inf]  Saved batch 210/351
2026-02-03T03:32:49.925412419Z [inf]  Saved batch 211/351
2026-02-03T03:32:49.997036099Z [inf]  Saved batch 212/351
2026-02-03T03:32:50.008464483Z [inf]  Saved batch 213/351
2026-02-03T03:32:50.020552760Z [inf]  Saved batch 214/351
2026-02-03T03:32:50.035673384Z [inf]  Saved batch 215/351
2026-02-03T03:32:50.051542978Z [inf]  Saved batch 216/351
2026-02-03T03:32:50.083234229Z [inf]  Saved batch 217/351
2026-02-03T03:32:50.112486987Z [inf]  Saved batch 218/351
2026-02-03T03:32:50.129708656Z [inf]  Saved batch 219/351
2026-02-03T03:32:50.147921736Z [inf]  Saved batch 220/351
2026-02-03T03:32:50.163113319Z [inf]  Saved batch 221/351
2026-02-03T03:32:50.172064120Z [inf]  Saved batch 222/351
2026-02-03T03:32:50.182182499Z [inf]  Saved batch 223/351
2026-02-03T03:32:50.207937924Z [inf]  Saved batch 224/351
2026-02-03T03:32:50.217950654Z [inf]  Saved batch 225/351
2026-02-03T03:32:50.232428604Z [inf]  Saved batch 226/351
2026-02-03T03:32:50.244088006Z [inf]  Saved batch 227/351
2026-02-03T03:32:50.281736471Z [inf]  Saved batch 228/351
2026-02-03T03:32:50.317205319Z [inf]  Saved batch 229/351
2026-02-03T03:32:50.342560040Z [inf]  Saved batch 230/351
2026-02-03T03:32:50.353499410Z [inf]  Saved batch 231/351
2026-02-03T03:32:50.369704791Z [inf]  Saved batch 232/351
2026-02-03T03:32:50.384755315Z [inf]  Saved batch 233/351
2026-02-03T03:32:50.416962470Z [inf]  Saved batch 234/351
2026-02-03T03:32:50.525363445Z [inf]  Saved batch 235/351
2026-02-03T03:32:50.525368495Z [inf]  Saved batch 236/351
2026-02-03T03:32:50.525375755Z [inf]  Saved batch 237/351
2026-02-03T03:32:50.525381205Z [inf]  Saved batch 238/351
2026-02-03T03:32:50.525387194Z [inf]  Saved batch 239/351
2026-02-03T03:32:50.536036468Z [inf]  Saved batch 240/351
2026-02-03T03:32:50.559004774Z [inf]  Saved batch 241/351
2026-02-03T03:32:50.571282239Z [inf]  Saved batch 242/351
2026-02-03T03:32:50.584378345Z [inf]  Saved batch 243/351
2026-02-03T03:32:50.612255937Z [inf]  Saved batch 244/351
2026-02-03T03:32:50.626210514Z [inf]  Saved batch 245/351
2026-02-03T03:32:50.637720427Z [inf]  Saved batch 246/351
2026-02-03T03:32:50.681466655Z [inf]  Saved batch 247/351
2026-02-03T03:32:50.713435462Z [inf]  Saved batch 248/351
2026-02-03T03:32:50.723778308Z [inf]  Saved batch 249/351
2026-02-03T03:32:50.739887810Z [inf]  Saved batch 250/351
2026-02-03T03:32:50.752061466Z [inf]  Saved batch 251/351
2026-02-03T03:32:50.784600848Z [inf]  Saved batch 252/351
2026-02-03T03:32:50.815112931Z [inf]  Saved batch 253/351
2026-02-03T03:32:50.833598688Z [inf]  Saved batch 254/351
2026-02-03T03:32:50.845536766Z [inf]  Saved batch 255/351
2026-02-03T03:32:50.858478443Z [inf]  Saved batch 256/351
2026-02-03T03:32:50.877986698Z [inf]  Saved batch 257/351
2026-02-03T03:32:50.907470303Z [inf]  Saved batch 258/351
2026-02-03T03:32:50.925311716Z [inf]  Saved batch 259/351
2026-02-03T03:32:50.940734296Z [inf]  Saved batch 260/351
2026-02-03T03:32:50.953928941Z [inf]  Saved batch 261/351
2026-02-03T03:32:50.976871218Z [inf]  Saved batch 262/351
2026-02-03T03:32:50.987129125Z [inf]  Saved batch 263/351
2026-02-03T03:32:51.013457165Z [inf]  Saved batch 264/351
2026-02-03T03:32:51.024698301Z [inf]  Saved batch 265/351
2026-02-03T03:32:51.034966497Z [inf]  Saved batch 266/351
2026-02-03T03:32:51.052408915Z [inf]  Saved batch 267/351
2026-02-03T03:32:51.086239032Z [inf]  Saved batch 268/351
2026-02-03T03:32:51.121470594Z [inf]  Saved batch 269/351
2026-02-03T03:32:51.131622372Z [inf]  Saved batch 270/351
2026-02-03T03:32:51.144705688Z [inf]  Saved batch 271/351
2026-02-03T03:32:51.176030302Z [inf]  Saved batch 272/351
2026-02-03T03:32:51.187069811Z [inf]  Saved batch 273/351
2026-02-03T03:32:51.213465520Z [inf]  Saved batch 274/351
2026-02-03T03:32:51.221375653Z [inf]  Saved batch 275/351
2026-02-03T03:32:51.234838674Z [inf]  Saved batch 276/351
2026-02-03T03:32:51.255011402Z [inf]  Saved batch 277/351
2026-02-03T03:32:51.272644947Z [inf]  Saved batch 278/351
2026-02-03T03:32:51.292196342Z [inf]  Saved batch 279/351
2026-02-03T03:32:51.304913472Z [inf]  Saved batch 280/351
2026-02-03T03:32:51.314773063Z [inf]  Saved batch 281/351
2026-02-03T03:32:51.326143527Z [inf]  Saved batch 282/351
2026-02-03T03:32:51.335790092Z [inf]  Saved batch 283/351
2026-02-03T03:32:51.346105878Z [inf]  Saved batch 284/351
2026-02-03T03:32:51.356920448Z [inf]  Saved batch 285/351
2026-02-03T03:32:51.401859234Z [inf]  Saved batch 286/351
2026-02-03T03:32:51.418256592Z [inf]  Saved batch 287/351
2026-02-03T03:32:51.535733538Z [inf]  Saved batch 288/351
2026-02-03T03:32:51.535737078Z [inf]  Saved batch 289/351
2026-02-03T03:32:51.535740628Z [inf]  Saved batch 290/351
2026-02-03T03:32:51.535743818Z [inf]  Saved batch 291/351
2026-02-03T03:32:51.535746978Z [inf]  Saved batch 292/351
2026-02-03T03:32:51.535750028Z [inf]  Saved batch 293/351
2026-02-03T03:32:51.535757458Z [inf]  Saved batch 294/351
2026-02-03T03:32:51.545024235Z [inf]  Saved batch 295/351
2026-02-03T03:32:51.555041054Z [inf]  Saved batch 296/351
2026-02-03T03:32:51.576272301Z [inf]  Saved batch 297/351
2026-02-03T03:32:51.607753664Z [inf]  Saved batch 298/351
2026-02-03T03:32:51.617674105Z [inf]  Saved batch 299/351
2026-02-03T03:32:51.627084631Z [inf]  Saved batch 300/351
2026-02-03T03:32:51.636143791Z [inf]  Saved batch 301/351
2026-02-03T03:32:51.645608206Z [inf]  Saved batch 302/351
2026-02-03T03:32:51.676430007Z [inf]  Saved batch 303/351
2026-02-03T03:32:51.687059610Z [inf]  Saved batch 304/351
2026-02-03T03:32:51.717711542Z [inf]  Saved batch 305/351
2026-02-03T03:32:51.727002700Z [inf]  Saved batch 306/351
2026-02-03T03:32:51.743242510Z [inf]  Saved batch 307/351
2026-02-03T03:32:51.751924804Z [inf]  Saved batch 308/351
2026-02-03T03:32:51.775226178Z [inf]  Saved batch 309/351
2026-02-03T03:32:51.809500869Z [inf]  Saved batch 310/351
2026-02-03T03:32:51.828816727Z [inf]  Saved batch 311/351
2026-02-03T03:32:51.842275258Z [inf]  Saved batch 312/351
2026-02-03T03:32:51.856289854Z [inf]  Saved batch 313/351
2026-02-03T03:32:51.890106541Z [inf]  Saved batch 314/351
2026-02-03T03:32:51.916486660Z [inf]  Saved batch 315/351
2026-02-03T03:32:51.926483830Z [inf]  Saved batch 316/351
2026-02-03T03:32:51.936441301Z [inf]  Saved batch 317/351
2026-02-03T03:32:51.945968505Z [inf]  Saved batch 318/351
2026-02-03T03:32:51.955518170Z [inf]  Saved batch 319/351
2026-02-03T03:32:52.008425707Z [inf]  Saved batch 320/351
2026-02-03T03:32:52.017999642Z [inf]  Saved batch 321/351
2026-02-03T03:32:52.028200879Z [inf]  Saved batch 322/351
2026-02-03T03:32:52.040943258Z [inf]  Saved batch 323/351
2026-02-03T03:32:52.050582583Z [inf]  Saved batch 324/351
2026-02-03T03:32:52.076092771Z [inf]  Saved batch 325/351
2026-02-03T03:32:52.107943581Z [inf]  Saved batch 326/351
2026-02-03T03:32:52.118026849Z [inf]  Saved batch 327/351
2026-02-03T03:32:52.126228209Z [inf]  Saved batch 328/351
2026-02-03T03:32:52.135986781Z [inf]  Saved batch 329/351
2026-02-03T03:32:52.145307208Z [inf]  Saved batch 330/351
2026-02-03T03:32:52.154023402Z [inf]  Saved batch 331/351
2026-02-03T03:32:52.176648353Z [inf]  Saved batch 332/351
2026-02-03T03:32:52.208411433Z [inf]  Saved batch 333/351
2026-02-03T03:32:52.223293188Z [inf]  Saved batch 334/351
2026-02-03T03:32:52.231859595Z [inf]  Saved batch 335/351
2026-02-03T03:32:52.240955194Z [inf]  Saved batch 336/351
2026-02-03T03:32:52.248373953Z [inf]  Saved batch 337/351
2026-02-03T03:32:52.255499804Z [inf]  Saved batch 338/351
2026-02-03T03:32:52.275722091Z [inf]  Saved batch 339/351
2026-02-03T03:32:52.307739778Z [inf]  Saved batch 340/351
2026-02-03T03:32:52.336421132Z [inf]  Saved batch 341/351
2026-02-03T03:32:52.344988227Z [inf]  Saved batch 342/351
2026-02-03T03:32:52.358346600Z [inf]  Saved batch 343/351
2026-02-03T03:32:52.369747835Z [inf]  Saved batch 344/351
2026-02-03T03:32:52.378714346Z [inf]  Saved batch 345/351
2026-02-03T03:32:52.388594027Z [inf]  Saved batch 346/351
2026-02-03T03:32:52.412062029Z [inf]  Saved batch 347/351
2026-02-03T03:32:52.420668483Z [inf]  Saved batch 348/351
2026-02-03T03:32:52.537107280Z [inf]  Saved batch 349/351
2026-02-03T03:32:52.537124540Z [inf]  Saved batch 350/351
2026-02-03T03:32:52.537131850Z [inf]  Saved batch 351/351
2026-02-03T03:32:52.537139440Z [inf]  Saved 7016 protocols to database and memory cache
2026-02-03T03:32:52.537145060Z [inf]  [MarketJob] ✅ Protocols refreshed successfully: 7016 protocols
2026-02-03T03:32:52.537150870Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-03T03:32:55.420824540Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:33:15.424189240Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:33:15.424194590Z [inf]  [TokenJob] Starting initial token refresh...
2026-02-03T03:33:15.424198420Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-03T03:33:15.424201840Z [inf]  Fetching premium trending tokens
2026-02-03T03:33:15.424205060Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:33:15.424207950Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:33:15.717656282Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:33:15.994824673Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:33:15.994829413Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:33:15.994832593Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:33:15.994835863Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:33:17.820572302Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:33:18.827220122Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:33:21.525053356Z [err]  Error fetching trending tokens
2026-02-03T03:33:21.525058986Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:33:21.525061856Z [inf]  [TokenJob] Got 28 trending tokens for Ethereum
2026-02-03T03:33:21.534758749Z [err]  [TokenJob] New list too small (28) for Ethereum; keeping existing (100)
2026-02-03T03:33:26.099178435Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:33:46.098496369Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:33:46.098501719Z [inf]  [TokenJob] Tokens for Solana are fresh, skipping API call
2026-02-03T03:33:46.360557644Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:33:46.538381322Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:33:46.538388062Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:33:46.934653254Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:33:46.934658454Z [err]  Critical: No valid price data available
2026-02-03T03:33:47.039482404Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:33:57.037551338Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:33:57.277255450Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:33:57.277262260Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:33:57.277266650Z [err]  Critical: No valid price data available
2026-02-03T03:33:57.382260119Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:34:01.572246001Z [err]  [DBLock] Lock already held {
2026-02-03T03:34:01.572251691Z [err]    key: 'lock:tokenJob:refresh:base',
2026-02-03T03:34:01.572254921Z [err]    expiresAt: '2026-02-02T05:44:42.169Z',
2026-02-03T03:34:01.572257801Z [err]    ageMs: 78799384
2026-02-03T03:34:01.572261471Z [err]  }
2026-02-03T03:34:01.572264761Z [err]  [DBLock] Potential stale lock detected { key: 'lock:tokenJob:refresh:base', ageMs: 78799384, ttlSeconds: 240 }
2026-02-03T03:34:01.572268821Z [inf]  [TokenJob] Skipping refresh for Base - another instance holds the lock
2026-02-03T03:34:07.387000948Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:34:07.549714815Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:34:07.549718345Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:34:07.549721625Z [err]  Critical: No valid price data available
2026-02-03T03:34:07.668287326Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:34:08.010313829Z [inf]  incoming request
2026-02-03T03:34:08.010323959Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_sb6rvoz73ntgugos","createdAt":"2026-02-03T03:34:07.806Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27b87e6","hash":"0xbb79b60e1b781c65f3542b8ed13c882cb4a5133ef6353fe81c6ab97cfa41504e","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x69816caf"}],"source":"chainlake-kafka"}}
2026-02-03T03:34:08.011198920Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:34:08.011913923Z [inf]  request completed
2026-02-03T03:34:08.017591630Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0xbb79b6
2026-02-03T03:34:08.031733025Z [inf]  incoming request
2026-02-03T03:34:08.034135979Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_0xo2bckwsi5ou5o3","createdAt":"2026-02-03T03:34:07.851Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","toAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","blockNum":"0x27b87e6","hash":"0xbb79b60e1b781c65f3542b8ed13c882cb4a5133ef6353fe81c6ab97cfa41504e","value":0.753947836413639,"typeTraceAddress":"CALL_0_0_2","asset":"ETH","category":"internal","rawContract":{"rawValue":"0xa768f90089bf979","decimals":18},"blockTimestamp":"0x69816caf"}]}}
2026-02-03T03:34:08.034153499Z [inf]  request completed
2026-02-03T03:34:08.034156819Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:34:08.034167289Z [inf]  [Webhook] Tx already in processedTxs cache: 0xbb79b60e1b781c
2026-02-03T03:34:08.129307036Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x4f67f521: {
2026-02-03T03:34:08.129320246Z [inf]    tokenIn: '0xd2a7055317d0c7b316319cdadae592d0644a0b07',
2026-02-03T03:34:08.129324886Z [inf]    tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-03T03:34:08.129330026Z [inf]    dex: 'Unknown DEX'
2026-02-03T03:34:08.129334336Z [inf]  }
2026-02-03T03:34:08.129338276Z [inf]  Swap detected on target wallet
2026-02-03T03:34:08.129342416Z [inf]  Target is selling - triggering mirror sell
2026-02-03T03:34:08.135133172Z [inf]  Mirror sell: Processing open positions for token
2026-02-03T03:34:08.223552243Z [inf]  incoming request
2026-02-03T03:34:08.223558023Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_aw7hw6giro9dk6sb","createdAt":"2026-02-03T03:34:07.904Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0x6ff5693b99212da76ad316178a184ab56d299b43","blockNum":"0x27b87e6","hash":"0xbb79b60e1b781c65f3542b8ed13c882cb4a5133ef6353fe81c6ab97cfa41504e","value":1069152787.3498889,"asset":"TEO","category":"token","rawContract":{"rawValue":"0x0000000000000000000000000000000000000000037461e8bcf9a235930e31f6","address":"0xd2a7055317d0c7b316319cdadae592d0644a0b07","decimals":18},"log":{"address":"0xd2a7055317d0c7b316319cdadae592d0644a0b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000004f67f52147c6bc03563772fa3d7af3adffb92110","0x0000000000000000000000006ff5693b99212da76ad316178a184ab56d299b43"],"data":"0x0000000000000000000000000000000000000000037461e8bcf9a235930e31f6","blockHash":"0x850504bda0732695b045630646681d529c00251bf854b134a8c902542dcc93b8","blockNumber":"0x27b87e6","blockTimestamp":"0x69816caf","transactionHash":"0xbb79b60e1b781c65f3542b8ed13c882cb4a5133ef6353fe81c6ab97cfa41504e","transactionIndex":"0x2","logIndex":"0x3","removed":false},"blockTimestamp":"0x69816caf"}],"source":"chainlake-kafka"}}
2026-02-03T03:34:08.223561333Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:34:08.223564123Z [inf]  [Webhook] Tx already in processedTxs cache: 0xbb79b60e1b781c
2026-02-03T03:34:08.223566753Z [inf]  request completed
2026-02-03T03:34:08.566309789Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:34:08.566312729Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:34:09.125973868Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:34:09.125977148Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:34:17.662888422Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:34:17.880308482Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:34:17.880314682Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:34:18.138240488Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:34:18.138244638Z [err]  Critical: No valid price data available
2026-02-03T03:34:18.268447413Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:34:21.570252117Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-03T03:34:21.570255377Z [inf]  Fetching premium trending tokens
2026-02-03T03:34:21.604238085Z [err]  DexScreener WS: Connection error
2026-02-03T03:34:21.604243245Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:34:27.459501985Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:34:28.271228936Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:34:28.370621788Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:34:28.370626748Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:34:28.551421511Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:34:28.551427211Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:34:28.697467014Z [inf]  📊 Position P/L check
2026-02-03T03:34:28.889231436Z [inf]  Skipping low liquidity token
2026-02-03T03:34:31.460358648Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:34:32.471617480Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:34:34.969052824Z [err]  Error fetching trending tokens
2026-02-03T03:34:34.969055314Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:34:34.969057634Z [inf]  [TokenJob] Got 31 trending tokens for BSC
2026-02-03T03:34:34.978904377Z [err]  [TokenJob] New list too small (31) for BSC; keeping existing (100)
2026-02-03T03:34:38.127847185Z [inf]  incoming request
2026-02-03T03:34:38.128504108Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_p0518sqf1oj5wbvk","createdAt":"2026-02-03T03:34:37.878Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27b87f5","hash":"0xc4dd8496c7d3315c6a4d2ff82ad00d157bb77920a821470b4ec77868c97b5689","value":1,"asset":"ETH","category":"external","rawContract":{"rawValue":"0xde0b6b3a7640000","decimals":18},"blockTimestamp":"0x69816ccd"}],"source":"chainlake-kafka"}}
2026-02-03T03:34:38.129840144Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:34:38.129844574Z [inf]  request completed
2026-02-03T03:34:38.135589581Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0xc4dd84
2026-02-03T03:34:38.231116696Z [inf]  incoming request
2026-02-03T03:34:38.231122266Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_nn06lnkgozet37yr","createdAt":"2026-02-03T03:34:37.940Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","blockNum":"0x27b87f5","hash":"0xc4dd8496c7d3315c6a4d2ff82ad00d157bb77920a821470b4ec77868c97b5689","value":1092942232.179362,"asset":"TEO","category":"token","rawContract":{"rawValue":"0x000000000000000000000000000000000000000003880f8520625f4e312fbece","address":"0xd2a7055317d0c7b316319cdadae592d0644a0b07","decimals":18},"log":{"address":"0xd2a7055317d0c7b316319cdadae592d0644a0b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x0000000000000000000000004f67f52147c6bc03563772fa3d7af3adffb92110"],"data":"0x000000000000000000000000000000000000000003880f8520625f4e312fbece","blockHash":"0x193b07208cdf467a63bbab7543458951764cf04d2eaf5ef431191720d72bf354","blockNumber":"0x27b87f5","blockTimestamp":"0x69816ccd","transactionHash":"0xc4dd8496c7d3315c6a4d2ff82ad00d157bb77920a821470b4ec77868c97b5689","transactionIndex":"0x4e","logIndex":"0x18b","removed":false},"blockTimestamp":"0x69816ccd"}],"source":"chainlake-kafka"}}
2026-02-03T03:34:38.231125416Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:34:38.231128376Z [inf]  [Webhook] Tx already in processedTxs cache: 0xc4dd8496c7d331
2026-02-03T03:34:38.231131236Z [inf]  request completed
2026-02-03T03:34:38.246058773Z [inf]  Swap successfully decoded from logs
2026-02-03T03:34:38.246067603Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x4f67f521: {
2026-02-03T03:34:38.246073033Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-03T03:34:38.246078043Z [inf]    tokenOut: '0xd2a7055317d0c7b316319cdadae592d0644a0b07',
2026-02-03T03:34:38.246082943Z [inf]    dex: 'Unknown DEX'
2026-02-03T03:34:38.246088013Z [inf]  }
2026-02-03T03:34:38.246092293Z [inf]  Swap detected on target wallet
2026-02-03T03:34:38.246097043Z [inf]  Target is buying - triggering copy trade
2026-02-03T03:34:39.226730235Z [err]  LaunchpadDetector: Failed to load Paragraph SDK
2026-02-03T03:34:39.226737095Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:34:39.351818418Z [inf]  📊 Position P/L check
2026-02-03T03:34:39.368610534Z [inf]  Timer finished: launchpad_det_0xd2a7055317d0c7b316319cdadae592d0644a0b07
2026-02-03T03:34:39.368614754Z [inf]  🔥 Warming up 1 user settings
2026-02-03T03:34:39.471077125Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:34:39.471081685Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:34:39.824777269Z [inf]  0x API price received successfully
2026-02-03T03:34:39.824781509Z [inf]  Fallback: Got price from DEX aggregator
2026-02-03T03:34:39.824784489Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:34:39.824787709Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-03T03:34:39.824790429Z [inf]  📊 Mass Copy Trade Analysis
2026-02-03T03:34:39.824793999Z [inf]  📦 Processing batch 1/1
2026-02-03T03:34:39.965155025Z [inf]  Skipping trade: Insufficient gas buffer
2026-02-03T03:34:39.965159515Z [inf]  [Warpcast] Sending DM to FID 877398: "⏭️ Copy Trade Skipped: $TEO
2026-02-03T03:34:39.965164495Z [inf]  
2026-02-03T03:34:39.965168375Z [inf]  ⏭️ **COPY TRADE SKIPP..."
2026-02-03T03:34:40.348431217Z [inf]  [Warpcast] DM sent successfully. Daily usage: 1/50000
2026-02-03T03:34:40.348436177Z [inf]  ✅ Smart batch execution complete
2026-02-03T03:34:49.348596003Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:34:55.063276805Z [inf]  [TokenJob] Tokens for Arbitrum are fresh, skipping API call
2026-02-03T03:34:59.468791278Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:34:59.597312276Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:34:59.597316665Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:34:59.597320135Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:34:59.597323265Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:35:00.241635164Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-03T03:35:00.253637863Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-03T03:35:00.253642123Z [inf]  Fetching premium trending tokens
2026-02-03T03:35:00.253644993Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:35:00.281249671Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-03T03:35:00.281252931Z [inf]  Timer finished: recalc_heat_scores
2026-02-03T03:35:01.605695779Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:35:01.605705279Z [err]  Error fetching trending tokens
2026-02-03T03:35:01.605712039Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:35:01.605718918Z [inf]  [TokenJob] Got 28 trending tokens for Ethereum
2026-02-03T03:35:01.605725228Z [err]  [TokenJob] New list too small (28) for Ethereum; keeping existing (100)
2026-02-03T03:35:09.791982736Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:35:15.002076665Z [err]  [DBLock] Lock already held {
2026-02-03T03:35:15.002080585Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T03:35:15.002083765Z [err]    expiresAt: '2026-01-29T11:00:40.912Z',
2026-02-03T03:35:15.002086565Z [err]    ageMs: 405514083
2026-02-03T03:35:15.002088995Z [err]  }
2026-02-03T03:35:15.002091335Z [inf]  [TokenJob] Skipping refresh for Optimism - another instance holds the lock
2026-02-03T03:35:15.002093785Z [err]  [DBLock] Potential stale lock detected {
2026-02-03T03:35:15.002096415Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T03:35:15.002098795Z [err]    ageMs: 405514083,
2026-02-03T03:35:15.002101285Z [err]    ttlSeconds: 240
2026-02-03T03:35:15.002103935Z [err]  }
2026-02-03T03:35:19.890938116Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:35:21.625048857Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-03T03:35:21.625055597Z [inf]  Fetching premium trending tokens
2026-02-03T03:35:21.625060877Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:35:22.577668577Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:35:22.577673537Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:35:22.577677717Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-03T03:35:22.577680917Z [inf]  [TokenJob] Filtered out 2 invalid tokens for Solana
2026-02-03T03:35:22.625397777Z [inf]  Saved 98 trending tokens for solana to database and memory cache
2026-02-03T03:35:22.648235768Z [inf]  [TokenJob] Saved 98 tokens for Solana to DB + cache
2026-02-03T03:35:29.995844385Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:35:30.138350373Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:35:30.138356642Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:35:30.548727253Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:35:30.548736633Z [err]  Critical: No valid price data available
2026-02-03T03:35:30.650436015Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:35:35.023982381Z [err]    ttlSeconds: 240
2026-02-03T03:35:35.023991841Z [err]  }
2026-02-03T03:35:35.024014161Z [err]  [DBLock] Lock already held {
2026-02-03T03:35:35.024017541Z [err]    key: 'lock:tokenJob:refresh:polygon',
2026-02-03T03:35:35.024033961Z [err]    expiresAt: '2026-01-29T04:35:55.102Z',
2026-02-03T03:35:35.024037861Z [err]    ageMs: 428619895
2026-02-03T03:35:35.024041990Z [err]  }
2026-02-03T03:35:35.024046460Z [inf]  [TokenJob] Skipping refresh for Polygon - another instance holds the lock
2026-02-03T03:35:35.024050240Z [inf]  [TokenJob] Refreshed 7 chains in 146.1s
2026-02-03T03:35:35.024053440Z [err]  [DBLock] Potential stale lock detected {
2026-02-03T03:35:35.024057710Z [err]    key: 'lock:tokenJob:refresh:polygon',
2026-02-03T03:35:35.024064300Z [err]    ageMs: 428619895,
2026-02-03T03:35:40.398818592Z [inf]  incoming request
2026-02-03T03:35:40.398823322Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_f7jdur8wtiuxmrxc","createdAt":"2026-02-03T03:35:40.220Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","toAddress":"0x743f2f29cdd66242fb27d292ab2cc92f45674635","blockNum":"0x27b8814","hash":"0x0a20d566c5c45a7096996ad7541ee35ecd87dc331ce3f856be34a6924d9e653a","value":0.5,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x6f05b59d3b20000","decimals":18},"blockTimestamp":"0x69816d0b"}],"source":"chainlake-kafka"}}
2026-02-03T03:35:40.399179428Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:35:40.399183548Z [inf]  request completed
2026-02-03T03:35:40.404612719Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x0a20d5
2026-02-03T03:35:40.509149551Z [inf]  Swap successfully decoded from logs
2026-02-03T03:35:40.509154061Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x4f67f521: {
2026-02-03T03:35:40.509157451Z [inf]    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
2026-02-03T03:35:40.509160441Z [inf]    tokenOut: '0xd2a7055317d0c7b316319cdadae592d0644a0b07',
2026-02-03T03:35:40.509164251Z [inf]    dex: 'Unknown DEX'
2026-02-03T03:35:40.509167281Z [inf]  }
2026-02-03T03:35:40.509170211Z [inf]  Swap detected on target wallet
2026-02-03T03:35:40.509173301Z [inf]  Target is buying - triggering copy trade
2026-02-03T03:35:40.683226297Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:35:40.815374119Z [inf]  incoming request
2026-02-03T03:35:40.815379619Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_3a0vz7krjzlyggky","createdAt":"2026-02-03T03:35:40.482Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","blockNum":"0x27b8814","hash":"0x0a20d566c5c45a7096996ad7541ee35ecd87dc331ce3f856be34a6924d9e653a","value":404688764.6928936,"asset":"TEO","category":"token","rawContract":{"rawValue":"0x0000000000000000000000000000000000000000014ec02de49d52008a645b11","address":"0xd2a7055317d0c7b316319cdadae592d0644a0b07","decimals":18},"log":{"address":"0xd2a7055317d0c7b316319cdadae592d0644a0b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x0000000000000000000000004f67f52147c6bc03563772fa3d7af3adffb92110"],"data":"0x0000000000000000000000000000000000000000014ec02de49d52008a645b11","blockHash":"0x3d8cfed216fb3102d68dcd1c7a7f7fbe40691fbf53f67878a9cff78465637d2c","blockNumber":"0x27b8814","blockTimestamp":"0x69816d0b","transactionHash":"0x0a20d566c5c45a7096996ad7541ee35ecd87dc331ce3f856be34a6924d9e653a","transactionIndex":"0x72","logIndex":"0x436","removed":false},"blockTimestamp":"0x69816d0b"}],"source":"chainlake-kafka"}}
2026-02-03T03:35:40.815383199Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:35:40.815386769Z [inf]  [Webhook] Tx already in processedTxs cache: 0x0a20d566c5c45a
2026-02-03T03:35:40.815390349Z [inf]  request completed
2026-02-03T03:35:40.994998894Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:35:40.995003484Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:35:41.222116001Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:35:41.222121231Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:35:41.298805457Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:35:41.298809247Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:35:42.230015193Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:35:42.230026453Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:35:42.230031183Z [inf]  🔥 Warming up 1 user settings
2026-02-03T03:35:42.230035383Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-03T03:35:42.230039063Z [inf]  📊 Mass Copy Trade Analysis
2026-02-03T03:35:42.230043293Z [inf]  📦 Processing batch 1/1
2026-02-03T03:35:42.230047053Z [inf]  Skipping trade: Insufficient gas buffer
2026-02-03T03:35:42.230440488Z [inf]  [Warpcast] Sending DM to FID 877398: "⏭️ Copy Trade Skipped: $TEO
2026-02-03T03:35:42.230442918Z [inf]  
2026-02-03T03:35:42.230445208Z [inf]  ⏭️ **COPY TRADE SKIPP..."
2026-02-03T03:35:42.668600790Z [err]  [DBLock] Lock already held {
2026-02-03T03:35:42.668614040Z [err]    key: 'lock:tokenJob:refresh:base',
2026-02-03T03:35:42.668620210Z [err]    expiresAt: '2026-02-02T05:44:42.169Z',
2026-02-03T03:35:42.668625770Z [err]    ageMs: 78900490
2026-02-03T03:35:42.668630650Z [err]  }
2026-02-03T03:35:42.668636330Z [inf]  [TokenJob] Skipping refresh for Base - another instance holds the lock
2026-02-03T03:35:42.668641260Z [err]  [DBLock] Potential stale lock detected { key: 'lock:tokenJob:refresh:base', ageMs: 78900490, ttlSeconds: 240 }
2026-02-03T03:35:42.842222030Z [inf]  [Warpcast] DM sent successfully. Daily usage: 2/50000
2026-02-03T03:35:42.842226490Z [inf]  ✅ Smart batch execution complete
2026-02-03T03:35:51.411045048Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:36:11.408675221Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:36:11.408677901Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:36:11.408681181Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:36:11.408688051Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-03T03:36:11.408699401Z [inf]  Fetching premium trending tokens
2026-02-03T03:36:11.408704061Z [err]  DexScreener WS: Connection error
2026-02-03T03:36:11.408709451Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:36:11.752251099Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:36:11.775507186Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:36:11.956377691Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:36:11.956380961Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:36:11.956384901Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:36:11.956387751Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:36:13.765420292Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:36:17.782792633Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:36:17.782807712Z [err]  GeckoTerminal API error after retries
2026-02-03T03:36:17.782812602Z [err]  Error fetching trending tokens
2026-02-03T03:36:17.782819342Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:36:17.782823052Z [inf]  [TokenJob] Got 31 trending tokens for BSC
2026-02-03T03:36:17.782826872Z [err]  [TokenJob] New list too small (31) for BSC; keeping existing (100)
2026-02-03T03:36:22.083966663Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:36:27.808897942Z [err]  2026-02-03 03:36:20.369 UTC [27] LOG:  checkpoint starting: time
2026-02-03T03:36:42.093314685Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:36:42.093318605Z [inf]  [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
2026-02-03T03:36:42.093323515Z [inf]  Fetching premium trending tokens
2026-02-03T03:36:42.093327095Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:36:42.093330895Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:36:42.093334855Z [err]  Error fetching trending tokens
2026-02-03T03:36:42.093339045Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:36:42.093342605Z [inf]  [TokenJob] DexScreener returned 6 tokens, trying GeckoTerminal fallback...
2026-02-03T03:36:42.093346075Z [err]  Error fetching trending tokens
2026-02-03T03:36:42.093349615Z [inf]  [TokenJob] Got 6 trending tokens for Arbitrum
2026-02-03T03:36:42.093352685Z [inf]  Saved 6 trending tokens for arbitrum to database and memory cache
2026-02-03T03:36:42.093860479Z [inf]  [TokenJob] Saved 6 tokens for Arbitrum to DB + cache
2026-02-03T03:36:42.375489866Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:36:42.501824346Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:36:42.501837456Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:36:42.884297538Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:36:42.884301488Z [err]  Critical: No valid price data available
2026-02-03T03:36:43.000322601Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:36:52.999314152Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:36:53.112861981Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:36:53.112868782Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:36:53.112872822Z [err]  Critical: No valid price data available
2026-02-03T03:36:53.227697087Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:36:58.841680550Z [err]  [DBLock] Lock already held {
2026-02-03T03:36:58.841683760Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T03:36:58.841686490Z [err]    expiresAt: '2026-01-29T11:00:40.912Z',
2026-02-03T03:36:58.841689029Z [err]    ageMs: 405617924
2026-02-03T03:36:58.841691999Z [err]  }
2026-02-03T03:36:58.841694699Z [err]  [DBLock] Potential stale lock detected {
2026-02-03T03:36:58.841697199Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T03:36:58.841699489Z [err]    ageMs: 405617924,
2026-02-03T03:36:58.841701739Z [err]    ttlSeconds: 240
2026-02-03T03:36:58.841704759Z [err]  }
2026-02-03T03:36:58.841707159Z [inf]  [TokenJob] Skipping refresh for Optimism - another instance holds the lock
2026-02-03T03:37:03.224473605Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:37:03.442687862Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:37:03.442693942Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:37:03.442697821Z [err]  Critical: No valid price data available
2026-02-03T03:37:03.479513472Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:37:13.473000925Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:37:13.582968325Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:37:13.706772404Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:37:14.073106909Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:37:14.073112429Z [err]  Critical: No valid price data available
2026-02-03T03:37:14.198982437Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:37:18.842353841Z [err]  [DBLock] Lock already held {
2026-02-03T03:37:18.842365371Z [err]    ageMs: 428723736,
2026-02-03T03:37:18.842368461Z [err]    key: 'lock:tokenJob:refresh:polygon',
2026-02-03T03:37:18.842373941Z [err]    ttlSeconds: 240
2026-02-03T03:37:18.842376621Z [err]    expiresAt: '2026-01-29T04:35:55.102Z',
2026-02-03T03:37:18.842383271Z [err]  }
2026-02-03T03:37:18.842387611Z [err]    ageMs: 428723736
2026-02-03T03:37:18.842390600Z [inf]  [TokenJob] Refreshed 7 chains in 138.6s
2026-02-03T03:37:18.842395270Z [err]  }
2026-02-03T03:37:18.842401500Z [inf]  [TokenJob] Skipping refresh for Polygon - another instance holds the lock
2026-02-03T03:37:18.842406800Z [err]  [DBLock] Potential stale lock detected {
2026-02-03T03:37:18.842414880Z [err]    key: 'lock:tokenJob:refresh:polygon',
2026-02-03T03:37:24.217734709Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:37:24.521443863Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:37:24.521461933Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:37:25.058315585Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:37:25.058320945Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:37:45.058670089Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:37:45.305987716Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:38:05.310666755Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:38:05.310673475Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:38:05.310678235Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:38:05.310682605Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:38:05.310687055Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:38:05.726616175Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:38:10.798367652Z [err]  2026-02-03 03:38:02.048 UTC [27] LOG:  checkpoint complete: wrote 1020 buffers (6.2%); 0 WAL file(s) added, 0 removed, 1 recycled; write=101.628 s, sync=0.013 s, total=101.680 s; sync files=78, longest=0.005 s, average=0.001 s; distance=10522 kB, estimate=10522 kB; lsn=3/3D8FCB20, redo lsn=3/3D8DD248
2026-02-03T03:38:25.725282331Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:38:26.019970123Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:38:26.147175781Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:38:26.250453616Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:38:26.833985913Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:38:26.833991913Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:38:46.826051503Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:38:47.155412834Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:39:07.154898370Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:39:07.154903680Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:39:07.154907410Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:39:07.154910610Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:39:07.154913710Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:39:07.154916960Z [inf]  📊 Position P/L check
2026-02-03T03:39:07.541562287Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:39:07.688597084Z [inf]  📊 Position P/L check
2026-02-03T03:39:17.678135735Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:39:17.915903315Z [inf]  📊 Position P/L check
2026-02-03T03:39:27.798635521Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:39:27.942013829Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:39:27.942023539Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:39:29.089146680Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:39:29.089150370Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:39:29.220786735Z [inf]  📊 Position P/L check
2026-02-03T03:39:49.213626943Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:39:49.213633273Z [inf]  📊 Position P/L check
2026-02-03T03:39:49.328680897Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:40:09.338022650Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:40:09.338035120Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:40:09.338045000Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:40:09.338052050Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:40:09.338057720Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:40:09.338063119Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-03T03:40:09.338068029Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-03T03:40:09.338076079Z [inf]  Fetching premium trending tokens
2026-02-03T03:40:09.338081009Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:40:09.338087049Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-03T03:40:09.338356077Z [inf]  Timer finished: recalc_heat_scores
2026-02-03T03:40:09.338363037Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:40:09.736104686Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:40:29.748179178Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:40:30.032975052Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:40:30.415433397Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:40:30.415439677Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:40:30.930398432Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:40:30.930403232Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:40:33.745051302Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:40:34.761162470Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:40:36.776215153Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:40:40.792275553Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:40:40.792284623Z [err]  GeckoTerminal API error after retries
2026-02-03T03:40:40.792290323Z [err]  Error fetching trending tokens
2026-02-03T03:40:40.792296763Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:40:40.792302543Z [inf]  [TokenJob] Got 28 trending tokens for Ethereum
2026-02-03T03:40:40.796513997Z [err]  [TokenJob] New list too small (28) for Ethereum; keeping existing (100)
2026-02-03T03:40:41.046906312Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:41:01.052958002Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:41:01.052970362Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-03T03:41:01.052975562Z [inf]  Fetching premium trending tokens
2026-02-03T03:41:01.052980612Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:41:01.333528645Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:41:01.427735056Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:41:01.449314004Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:41:01.449318574Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:41:01.449323254Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:41:02.286483621Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:41:02.286489891Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:41:02.286495741Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-03T03:41:02.286500681Z [inf]  [TokenJob] Filtered out 2 invalid tokens for Solana
2026-02-03T03:41:02.309748782Z [inf]  Saved 98 trending tokens for solana to database and memory cache
2026-02-03T03:41:02.330540299Z [inf]  [TokenJob] Saved 98 tokens for Solana to DB + cache
2026-02-03T03:41:11.570447032Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:41:25.522043763Z [err]  2026-02-03 03:41:20.148 UTC [27] LOG:  checkpoint starting: time
2026-02-03T03:41:31.565724642Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:41:31.565729372Z [err]  [DBLock] Lock already held {
2026-02-03T03:41:31.565732352Z [err]    key: 'lock:tokenJob:refresh:base',
2026-02-03T03:41:31.565735082Z [err]    expiresAt: '2026-02-02T05:44:42.169Z',
2026-02-03T03:41:31.565738472Z [err]    ageMs: 79240170
2026-02-03T03:41:31.565740952Z [err]  }
2026-02-03T03:41:31.565743412Z [err]  [DBLock] Potential stale lock detected { key: 'lock:tokenJob:refresh:base', ageMs: 79240170, ttlSeconds: 240 }
2026-02-03T03:41:31.565745742Z [inf]  [TokenJob] Skipping refresh for Base - another instance holds the lock
2026-02-03T03:41:31.833120589Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:41:32.050774728Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:41:32.107697009Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:41:32.591979953Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:41:32.591988083Z [err]  Critical: No valid price data available
2026-02-03T03:41:32.703544519Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:41:42.395745230Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-03T03:41:42.395750360Z [inf]  Fetching premium trending tokens
2026-02-03T03:41:42.406810401Z [err]  DexScreener WS: Connection error
2026-02-03T03:41:42.406814991Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:41:42.699073063Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:41:42.911360501Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:41:42.911365191Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:41:43.210333341Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:41:43.210337331Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:41:44.871135026Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:41:45.261587896Z [inf]  Skipping low liquidity token
2026-02-03T03:41:52.251208456Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:41:53.260059622Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:41:53.432056191Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:41:55.794610592Z [err]  Error fetching trending tokens
2026-02-03T03:41:55.794615592Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:41:55.794618482Z [inf]  [TokenJob] Got 31 trending tokens for BSC
2026-02-03T03:41:55.802573388Z [err]  [TokenJob] New list too small (31) for BSC; keeping existing (100)
2026-02-03T03:42:03.471948181Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:42:06.438377789Z [err]  2026-02-03 03:41:59.091 UTC [27] LOG:  checkpoint complete: wrote 389 buffers (2.4%); 0 WAL file(s) added, 0 removed, 0 recycled; write=38.890 s, sync=0.020 s, total=38.944 s; sync files=30, longest=0.013 s, average=0.001 s; distance=2122 kB, estimate=9682 kB; lsn=3/3DAFFA70, redo lsn=3/3DAEFCF8
2026-02-03T03:42:23.377050917Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:42:23.377053707Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:42:23.377057417Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:42:23.377060167Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:42:23.377062797Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:42:23.377065837Z [inf]  [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
2026-02-03T03:42:23.377068227Z [inf]  Fetching premium trending tokens
2026-02-03T03:42:23.377070747Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:42:23.377073167Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:42:23.378901868Z [err]  Error fetching trending tokens
2026-02-03T03:42:23.378908118Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:42:23.378911268Z [inf]  [TokenJob] DexScreener returned 6 tokens, trying GeckoTerminal fallback...
2026-02-03T03:42:23.378914368Z [inf]  [TokenJob] Got 6 trending tokens for Arbitrum
2026-02-03T03:42:23.378917898Z [err]  Error fetching trending tokens
2026-02-03T03:42:23.378921467Z [inf]  Saved 6 trending tokens for arbitrum to database and memory cache
2026-02-03T03:42:23.378924497Z [inf]  [TokenJob] Saved 6 tokens for Arbitrum to DB + cache
2026-02-03T03:42:23.931383272Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:42:43.930668190Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:42:43.930681060Z [err]  [DBLock] Lock already held {
2026-02-03T03:42:43.930688840Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T03:42:43.930694400Z [err]    expiresAt: '2026-01-29T11:00:40.912Z',
2026-02-03T03:42:43.930698900Z [err]    ageMs: 405956105
2026-02-03T03:42:43.930705380Z [err]  }
2026-02-03T03:42:43.930710190Z [err]  [DBLock] Potential stale lock detected {
2026-02-03T03:42:43.930715340Z [err]    key: 'lock:tokenJob:refresh:optimism',
2026-02-03T03:42:43.930720220Z [err]    ageMs: 405956105,
2026-02-03T03:42:43.930726549Z [err]    ttlSeconds: 240
2026-02-03T03:42:43.930731839Z [err]  }
2026-02-03T03:42:43.930737109Z [inf]  [TokenJob] Skipping refresh for Optimism - another instance holds the lock
2026-02-03T03:42:44.199397169Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:42:44.286809405Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:42:44.322550963Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:42:44.699537025Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-03T03:42:44.699552985Z [err]  Critical: No valid price data available
2026-02-03T03:42:44.816283688Z [wrn]  TP/SL check skipped: Price not available
2026-02-03T03:43:04.816118738Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:43:04.816122668Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:43:04.816125228Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:43:04.816128698Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:43:04.816131798Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:43:04.816134578Z [err]  [DBLock] Lock already held {
2026-02-03T03:43:04.816137088Z [err]    key: 'lock:tokenJob:refresh:polygon',
2026-02-03T03:43:04.816139758Z [err]    expiresAt: '2026-01-29T04:35:55.102Z',
2026-02-03T03:43:04.816142038Z [err]    ageMs: 429061918
2026-02-03T03:43:04.816144238Z [err]  }
2026-02-03T03:43:04.816146578Z [err]  [DBLock] Potential stale lock detected {
2026-02-03T03:43:04.816148788Z [err]    key: 'lock:tokenJob:refresh:polygon',
2026-02-03T03:43:04.816150978Z [err]    ageMs: 429061918,
2026-02-03T03:43:04.816153358Z [err]    ttlSeconds: 240
2026-02-03T03:43:04.816156298Z [err]  }
2026-02-03T03:43:04.816158908Z [inf]  [TokenJob] Skipping refresh for Polygon - another instance holds the lock
2026-02-03T03:43:04.816538033Z [inf]  [TokenJob] Refreshed 7 chains in 176.5s
2026-02-03T03:43:06.163425232Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:43:26.161715862Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:43:26.407879776Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:43:26.545908122Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:43:26.545912962Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:43:26.545915932Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:43:26.545918322Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:43:46.546897048Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:43:46.812832371Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:44:06.698412315Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:44:06.698417395Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:44:06.698421605Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:44:06.698425245Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:44:06.698429475Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:44:06.698432925Z [inf]  📊 Position P/L check
2026-02-03T03:44:08.996173060Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:44:09.106623862Z [inf]  📊 Position P/L check
2026-02-03T03:44:19.105955092Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:44:19.223407160Z [inf]  📊 Position P/L check
2026-02-03T03:44:39.221785527Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:44:39.221793267Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:44:39.221798647Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:44:39.221803347Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:44:39.221807777Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:44:39.221812887Z [inf]  📊 Position P/L check
2026-02-03T03:44:39.477078507Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:44:39.592526397Z [inf]  📊 Position P/L check
2026-02-03T03:44:49.586790056Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:45:09.589436083Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:45:09.589441113Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:45:09.589444133Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:45:09.589447183Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:45:09.589449763Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:45:09.589452473Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-03T03:45:09.589455483Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-03T03:45:09.589457843Z [inf]  Fetching premium trending tokens
2026-02-03T03:45:09.589460193Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:45:09.589463063Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-03T03:45:09.589967727Z [inf]  Timer finished: recalc_heat_scores
2026-02-03T03:45:09.589971317Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:45:10.399036605Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:45:10.581332434Z [inf]  Trending tokens fetch complete
2026-02-03T03:45:10.581335894Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:45:10.581339154Z [inf]  [TokenJob] Got 100 trending tokens for Ethereum
2026-02-03T03:45:10.615054045Z [inf]  Saved 100 trending tokens for eth to database and memory cache
2026-02-03T03:45:10.652629125Z [inf]  [TokenJob] Saved 100 tokens for Ethereum to DB + cache
2026-02-03T03:45:20.569699117Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:45:22.673755915Z [inf]  incoming request
2026-02-03T03:45:22.673760095Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_bs2ki07g7yt330gx","createdAt":"2026-02-03T03:45:22.382Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x8f7d66186efc5c999c5b0cda40be74bf90eba655","toAddress":"0x4f67f52147c6bc03563772fa3d7af3adffb92110","blockNum":"0x27b8937","hash":"0x1946b1ee7b7b4472b71ac038a708ebb76db1ebe0e6d4a1b0f97c241c4342846a","category":"token","rawContract":{"rawValue":"0x0000000000000000000000000000000000000000000000015af1d78b58c40000","address":"0x7397cde406636b3dbca3f6250238241deb959d0b"},"log":{"address":"0x7397cde406636b3dbca3f6250238241deb959d0b","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000008f7d66186efc5c999c5b0cda40be74bf90eba655","0x0000000000000000000000004f67f52147c6bc03563772fa3d7af3adffb92110"],"data":"0x0000000000000000000000000000000000000000000000015af1d78b58c40000","blockHash":"0x52b5a6796bee5f9018aa659639b665099075db5c3607b75beb84aaaa81a67789","blockNumber":"0x27b8937","blockTimestamp":"0x69816f51","transactionHash":"0x1946b1ee7b7b4472b71ac038a708ebb76db1ebe0e6d4a1b0f97c241c4342846a","transactionIndex":"0x57","logIndex":"0x1ec","removed":false},"blockTimestamp":"0x69816f51"}],"source":"chainlake-kafka"}}
2026-02-03T03:45:22.673763235Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-03T03:45:22.673766825Z [inf]  request completed
2026-02-03T03:45:22.674620865Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x1946b1
2026-02-03T03:45:22.871128083Z [inf]  [Webhook] Not a swap tx for 0x4f67f521: 0x1946b1ee7b7b44
2026-02-03T03:45:30.681970754Z [inf]  [TokenJob] Tokens for Solana are fresh, skipping API call
2026-02-03T03:45:30.701917701Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:45:30.905467106Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:45:30.905471066Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:45:30.905473946Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:45:30.905476866Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:45:50.898181273Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:45:50.898187743Z [err]  [DBLock] Lock already held {
2026-02-03T03:45:50.898195373Z [err]    key: 'lock:tokenJob:refresh:base',
2026-02-03T03:45:50.898201653Z [err]    expiresAt: '2026-02-02T05:44:42.169Z',
2026-02-03T03:45:50.898207343Z [err]    ageMs: 79508515
2026-02-03T03:45:50.898212583Z [err]  }
2026-02-03T03:45:50.898218073Z [inf]  [TokenJob] Skipping refresh for Base - another instance holds the lock
2026-02-03T03:45:50.898223353Z [err]  [DBLock] Potential stale lock detected { key: 'lock:tokenJob:refresh:base', ageMs: 79508515, ttlSeconds: 240 }
2026-02-03T03:45:51.257292143Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:46:11.160258271Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:46:11.160261881Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:46:11.160265501Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:46:11.160269001Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:46:11.160272781Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:46:11.160275991Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-03T03:46:11.160279511Z [inf]  Fetching premium trending tokens
2026-02-03T03:46:11.160282701Z [err]  DexScreener WS: Connection error
2026-02-03T03:46:11.160286571Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:46:12.696830344Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:46:13.396844262Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:46:23.355956359Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:46:23.698864392Z [err]  2026-02-03 03:46:20.191 UTC [27] LOG:  checkpoint starting: time
2026-02-03T03:46:27.878710435Z [inf]  Repeated x2: API-5001:Skipping low liquidity token
2026-02-03T03:46:27.878716865Z [inf]  Skipping low liquidity token
2026-02-03T03:46:29.209808037Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-03T03:46:30.763815431Z [err]  Error fetching trending tokens
2026-02-03T03:46:30.763821881Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:46:30.763827241Z [inf]  [TokenJob] Got 31 trending tokens for BSC
2026-02-03T03:46:30.763830791Z [err]  [TokenJob] New list too small (31) for BSC; keeping existing (100)
2026-02-03T03:46:33.472871829Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:46:33.621525920Z [wrn]  All on-chain DEX queries failed (Factory + Router)
2026-02-03T03:46:33.621533549Z [wrn]  RPC price failed, falling back to full API fetch
2026-02-03T03:46:33.621539279Z [inf]  Fallback: Got price from GeckoTerminal
2026-02-03T03:46:33.621544719Z [inf]  ✅ Hybrid fetch complete
2026-02-03T03:46:53.622424983Z [inf]  Saved 6 trending tokens for arbitrum to database and memory cache
2026-02-03T03:46:53.622433113Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-03T03:46:53.622439563Z [inf]  [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
2026-02-03T03:46:53.622443613Z [inf]  Fetching premium trending tokens
2026-02-03T03:46:53.622447143Z [inf]  Using fallback discovery (Boosts + Organic search)
2026-02-03T03:46:53.622451083Z [inf]  Processed DexScreener trending candidates
2026-02-03T03:46:53.622454573Z [inf]  Premium trending tokens fetch complete
2026-02-03T03:46:53.622458183Z [inf]  [TokenJob] DexScreener returned 6 tokens, trying GeckoTerminal fallback...
2026-02-03T03:46:53.622461533Z [inf]  [TokenJob] Got 6 trending tokens for Arbitrum
2026-02-03T03:46:53.622464863Z [err]  Error fetching trending tokens
2026-02-03T03:46:53.622468363Z [err]  Error fetching trending tokens
2026-02-03T03:46:53.623274364Z [inf]  [TokenJob] Saved 6 tokens for Arbitrum to DB + cache
2026-02-03T03:46:53.880884267Z [inf]  [PositionMonitor] 🔄 Running position check...