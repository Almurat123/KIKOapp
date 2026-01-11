[DEBUG] onRequest: POST /api/webhook/alchemy
[Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_x75ry4u6ogblzmnl","createdAt":"2026-01-11T16:43:58.027Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241","toAddress":"0x240a09663420dbac4f9fdece5d5a55ecd3d4e6a0","blockNum":"0x26cbb35","hash":"0xd9d720a3faa9aefe13543603905c98ad4802da18be683ef7a229bde4800de7e3","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x6963d34d"}],"source":"chainlake-kafka"}}
[Webhook] Processing as EVM activity (1 items)
[DEBUG] onResponse: POST /api/webhook/alchemy -> 200
request completed
[Webhook] 🎯 Found 1 tracked wallets for tx 0xd9d720
[TxDecoder] Decoding swap from 31 logs, from: 0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241, nativeValue: 0x0
[TxDecoder] Found 9 Transfer events
  - Token: 0x11111111, from: 0xd1aa4aed, to: 0x240a0966, amount: 6500000000000000000000
  - Token: 0x11111111, from: 0x498581ff, to: 0xc8d07744, amount: 51999999999999999996
  - Token: 0x11111111, from: 0xc8d07744, to: 0x7bf90111, amount: 12999999999999999999
  - Token: 0x11111111, from: 0xc8d07744, to: 0xe03ce9eb, amount: 32499999999999999997
  - Token: 0x11111111, from: 0xc8d07744, to: 0x21e2ce70, amount: 649999999999999999
  - Token: 0x11111111, from: 0xc8d07744, to: 0x7bf90111, amount: 5850000000000000001
  - Token: 0x11111111, from: 0x240a0966, to: 0x498581ff, amount: 6500000000000000000000
  - Token: 0x1d248161, from: 0x498581ff, to: 0x240a0966, amount: 8435550201884855279679584
  - Token: 0x1d248161, from: 0x240a0966, to: 0xd1aa4aed, amount: 8435550201884855279679584
[TxDecoder] Incoming transfers (to 0xd1aa4aed): 1
[TxDecoder] Analysis - Received: 0x1d248161, Sent: 0x11111111
[TxDecoder] ✅ Valid swap detected: 0x11111111 -> 0x1d248161
[TxDecoder] RETURNING: {
  tokenIn: '0x1111111111166b7fe7bd91427724b487980afc69',
  tokenOut: '0x1d24816191d86b2750b6c875dc9459c416b15adf',
  amountIn: '6500000000000000000000',
  amountOut: '8435550201884855279679584'
}
[Webhook] ✅ Swap detected for tracked wallet 0xd1aa4aed: {
  tokenIn: '0x1111111111166b7fe7bd91427724b487980afc69',
  tokenOut: '0x1d24816191d86b2750b6c875dc9459c416b15adf',
  dex: 'Unknown DEX'
}
[AutoTrade] ========== SWAP DETECTED ==========
[AutoTrade] Processing swap from target: {
  wallet: '0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241',
  tokenIn: '0x1111111111166b7fe7bd91427724b487980afc69',
  tokenOut: '0x1d24816191d86b2750b6c875dc9459c416b15adf',
  amountIn: '6500000000000000000000',
  amountOut: '8435550201884855279679584'
}
[AutoTrade] Detection result: {
  isBuy: true,
  isSell: false,
  isTokenToToken: false,
  tokenInIsCash: true,
  tokenOutIsCash: false
}
[AutoTrade] 🟢 TARGET IS BUYING - triggering copy trade
[AutoTrade] ⚡ Fast path start for 0x1d24816191d86b2750b6c875dc9459c416b15adf from 0xd1aa4a...
incoming request
[DEBUG] onRequest: POST /api/webhook/alchemy
[Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_idhx8bikcn4d2rl3","createdAt":"2026-01-11T16:43:58.150Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x240a09663420dbac4f9fdece5d5a55ecd3d4e6a0","toAddress":"0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241","blockNum":"0x26cbb35","hash":"0xd9d720a3faa9aefe13543603905c98ad4802da18be683ef7a229bde4800de7e3","value":8435550.201884855,"asset":"berkozer","category":"token","rawContract":{"rawValue":"0x00000000000000000000000000000000000000000006fa4c17be71d4bf31f860","address":"0x1d24816191d86b2750b6c875dc9459c416b15adf","decimals":18},"log":{"address":"0x1d24816191d86b2750b6c875dc9459c416b15adf","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000240a09663420dbac4f9fdece5d5a55ecd3d4e6a0","0x000000000000000000000000d1aa4aed47a5453dc917f2b30eb0ecca8ecbf241"],"data":"0x00000000000000000000000000000000000000000006fa4c17be71d4bf31f860","blockHash":"0x4200bc7070f13937d1106ebbb6cfc36435e1186b0e552f7916e0ac08ba0f2168","blockNumber":"0x26cbb35","blockTimestamp":"0x6963d34d","transactionHash":"0xd9d720a3faa9aefe13543603905c98ad4802da18be683ef7a229bde4800de7e3","transactionIndex":"0x3d","logIndex":"0x38f","removed":false},"blockTimestamp":"0x6963d34d"},{"fromAddress":"0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241","toAddress":"0x240a09663420dbac4f9fdece5d5a55ecd3d4e6a0","blockNum":"0x26cbb35","hash":"0xd9d720a3faa9aefe13543603905c98ad4802da18be683ef7a229bde4800de7e3","value":6500,"asset":"ZORA","category":"token","rawContract":{"rawValue":"0x0000000000000000000000000000000000000000000001605d9ee98627100000","address":"0x1111111111166b7fe7bd91427724b487980afc69","decimals":18},"log":{"address":"0x1111111111166b7fe7bd91427724b487980afc69","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000d1aa4aed47a5453dc917f2b30eb0ecca8ecbf241","0x000000000000000000000000240a09663420dbac4f9fdece5d5a55ecd3d4e6a0"],"data":"0x0000000000000000000000000000000000000000000001605d9ee98627100000","blockHash":"0x4200bc7070f13937d1106ebbb6cfc36435e1186b0e552f7916e0ac08ba0f2168","blockNumber":"0x26cbb35","blockTimestamp":"0x6963d34d","transactionHash":"0xd9d720a3faa9aefe13543603905c98ad4802da18be683ef7a229bde4800de7e3","transactionIndex":"0x3d","logIndex":"0x372","removed":false},"blockTimestamp":"0x6963d34d"}],"source":"chainlake-kafka"}}
[AutoTrade] ⚠️ 0x1d24816191d86b2750b6c875dc9459c416b15adf missing DexScreener info, but is valid ZORA launchpad token. Using fallback info.
[Webhook] Processing as EVM activity (2 items)
[Webhook] Tx already in processedTxs cache: 0xd9d720a3faa9ae
[Webhook] Tx already in processedTxs cache: 0xd9d720a3faa9ae
[DEBUG] onResponse: POST /api/webhook/alchemy -> 200
request completed
[AutoTrade] getTokenInfo: Fetching 0x1d24816191d86b2750b6c875dc9459c416b15adf (Chain: 8453, Jitter: 399ms)
[AutoTrade] getTokenInfo: DexScreener failed or limited. Falling back to GeckoTerminal for 0x1d24816191d86b2750b6c875dc9459c416b15adf...
[AutoTrade] DexScreener: No pairs for 0x1d24816191d86b2750b6c875dc9459c416b15adf
[AutoTrade] getTokenInfo: Trying ZORA API fallback for Base token 0x1d24816191d86b2750b6c875dc9459c416b15adf...
[getTokenDetails] GeckoTerminal API error: {
  status: 404,
  statusText: 'Not Found',
  error: '{"errors":[{"status":"404","title":"Not Found"}],"meta":{"ref_id":"d2153480-9c73-434c-b3d2-17337fbfc167"}}',
  url: 'https://api.geckoterminal.com/api/v2/networks/base/tokens/0x1d24816191d86b2750b6c875dc9459c416b15adf/pools?include=base_token,quote_token'
}
[AutoTrade] getTokenInfo: All providers failed for 0x1d24816191d86b2750b6c875dc9459c416b15adf. Last DS Error: undefined
[AutoTrade] Found 1 config(s) for BUY. Price: $0 (Fallback: true)
[AutoTrade] Calculated value from tokenOut (0x1d24816191d86b2750b6c875dc9459c416b15adf): $0.00
[AutoTrade] ⏭️ Skipping for user cmjqr6yqq00003svdazw3v6xx: Target buy value $0.00 < min $1
[Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_qxqor52ogc9k3t8x","createdAt":"2026-01-11T16:44:30.171Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241","toAddress":"0x1d24816191d86b2750b6c875dc9459c416b15adf","blockNum":"0x26cbb45","hash":"0x55435aaa952b5d7fa542b12c5921444b783f4b8caa1bc0f2d9380764265a8910","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x6963d36d"}],"source":"chainlake-kafka"}}
[Webhook] Processing as EVM activity (1 items)
[DEBUG] onResponse: POST /api/webhook/alchemy -> 200
request completed
[Webhook] 🎯 Found 1 tracked wallets for tx 0x55435a
[TxDecoder] Decoding swap from 1 logs, from: 0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241, nativeValue: 0x0
[TxDecoder] Found 0 Transfer events
[TxDecoder] No transfers found, returning null
[Webhook] Not a swap tx for 0xd1aa4aed: 0x55435aaa952b5d
incoming request
[DEBUG] onRequest: POST /api/webhook/alchemy
[Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_8s90ktpvjk4i0bp1","createdAt":"2026-01-11T16:44:36.077Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241","blockNum":"0x26cbb48","hash":"0x3003f1741d48544139a2600eea2fd482862da0f5caf68541837b790edafc7c87","value":1859.5016696953269,"asset":"ZORA","category":"token","rawContract":{"rawValue":"0x000000000000000000000000000000000000000000000064cdc504869bb6b636","address":"0x1111111111166b7fe7bd91427724b487980afc69","decimals":18},"log":{"address":"0x1111111111166b7fe7bd91427724b487980afc69","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x000000000000000000000000d1aa4aed47a5453dc917f2b30eb0ecca8ecbf241"],"data":"0x000000000000000000000000000000000000000000000064cdc504869bb6b636","blockHash":"0x77385818e2f9c35cc3b5cf212c2483f7b6d5376d8763bca3fe4fae0d4fffed81","blockNumber":"0x26cbb48","blockTimestamp":"0x6963d373","transactionHash":"0x3003f1741d48544139a2600eea2fd482862da0f5caf68541837b790edafc7c87","transactionIndex":"0xaa","logIndex":"0x4da","removed":false},"blockTimestamp":"0x6963d373"},{"fromAddress":"0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241","toAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","blockNum":"0x26cbb48","hash":"0x3003f1741d48544139a2600eea2fd482862da0f5caf68541837b790edafc7c87","value":4217775.100942427,"asset":"berkozer","category":"token","rawContract":{"rawValue":"0x000000000000000000000000000000000000000000037d260bdf38ea60000000","address":"0x1d24816191d86b2750b6c875dc9459c416b15adf","decimals":18},"log":{"address":"0x1d24816191d86b2750b6c875dc9459c416b15adf","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000d1aa4aed47a5453dc917f2b30eb0ecca8ecbf241","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b"],"data":"0x000000000000000000000000000000000000000000037d260bdf38ea60000000","blockHash":"0x77385818e2f9c35cc3b5cf212c2483f7b6d5376d8763bca3fe4fae0d4fffed81","blockNumber":"0x26cbb48","blockTimestamp":"0x6963d373","transactionHash":"0x3003f1741d48544139a2600eea2fd482862da0f5caf68541837b790edafc7c87","transactionIndex":"0xaa","logIndex":"0x4db","removed":false},"blockTimestamp":"0x6963d373"}],"source":"chainlake-kafka"}}
[Webhook] Processing as EVM activity (2 items)
[DEBUG] onResponse: POST /api/webhook/alchemy -> 200
request completed
[Webhook] 🎯 Found 1 tracked wallets for tx 0x3003f1
incoming request
[DEBUG] onRequest: POST /api/webhook/alchemy
[Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_ik99jh841e227x74","createdAt":"2026-01-11T16:44:36.063Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x000000000022d473030f116ddee9f6b43ac78ba3","toAddress":"0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241","blockNum":"0x26cbb48","hash":"0x3003f1741d48544139a2600eea2fd482862da0f5caf68541837b790edafc7c87","value":0,"typeTraceAddress":"STATICCALL_0_0","asset":"ETH","category":"internal","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x6963d373"},{"fromAddress":"0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241","toAddress":"0x0000000000000000000000000000000000000001","blockNum":"0x26cbb48","hash":"0x3003f1741d48544139a2600eea2fd482862da0f5caf68541837b790edafc7c87","value":0,"typeTraceAddress":"STATICCALL_0_0_0","asset":"ETH","category":"internal","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x6963d373"}]}}
[Webhook] Processing as EVM activity (2 items)
[Webhook] Tx already in processedTxs cache: 0x3003f1741d4854
[Webhook] Tx already in processedTxs cache: 0x3003f1741d4854
[DEBUG] onResponse: POST /api/webhook/alchemy -> 200
request completed
[TxDecoder] Decoding swap from 23 logs, from: 0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241, nativeValue: 0x0
[TxDecoder] Found 7 Transfer events
  - Token: 0x11111111, from: 0x498581ff, to: 0xc8d07744, amount: 13433828043979598121
  - Token: 0x11111111, from: 0xc8d07744, to: 0x7bf90111, amount: 3358457010994899530
  - Token: 0x11111111, from: 0xc8d07744, to: 0xe03ce9eb, amount: 8396142527487248825
  - Token: 0x11111111, from: 0xc8d07744, to: 0x21e2ce70, amount: 167922850549744976
  - Token: 0x11111111, from: 0xc8d07744, to: 0x7bf90111, amount: 1511305654947704790
  - Token: 0x11111111, from: 0x498581ff, to: 0xd1aa4aed, amount: 1859501669695326959158
  - Token: 0x1d248161, from: 0xd1aa4aed, to: 0x498581ff, amount: 4217775100942427646590976
[TxDecoder] Incoming transfers (to 0xd1aa4aed): 1
[TxDecoder] Analysis - Received: 0x11111111, Sent: 0x1d248161
[TxDecoder] ✅ Valid swap detected: 0x1d248161 -> 0x11111111
[TxDecoder] RETURNING: {
  tokenIn: '0x1d24816191d86b2750b6c875dc9459c416b15adf',
  tokenOut: '0x1111111111166b7fe7bd91427724b487980afc69',
[AutoTrade] Detection result: {
  isBuy: false,
  isSell: true,
  isTokenToToken: false,
  tokenInIsCash: false,
  amountIn: '4217775100942427646590976',
  tokenOutIsCash: true
}
  amountOut: '1859501669695326959158'
[AutoTrade] 🔴 TARGET IS SELLING - triggering mirror sell
}
[AutoTrade] ⚡ Fast path sell: Found 1 config(s) for SELL of 0x1d24816191d86b2750b6c875dc9459c416b15adf
incoming request
[Webhook] ✅ Swap detected for tracked wallet 0xd1aa4aed: {
  tokenIn: '0x1d24816191d86b2750b6c875dc9459c416b15adf',
  tokenOut: '0x1111111111166b7fe7bd91427724b487980afc69',
  dex: 'Unknown DEX'
}
[AutoTrade] ========== SWAP DETECTED ==========
[AutoTrade] Processing swap from target: {
  wallet: '0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241',
  tokenIn: '0x1d24816191d86b2750b6c875dc9459c416b15adf',
  tokenOut: '0x1111111111166b7fe7bd91427724b487980afc69',
  amountIn: '4217775100942427646590976',
  amountOut: '1859501669695326959158'
}
[DEBUG] onRequest: POST /api/webhook/alchemy
[Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_gukhp2kwrtfqn9xe","createdAt":"2026-01-11T16:44:36.020Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241","toAddress":"0x6ff5693b99212da76ad316178a184ab56d299b43","blockNum":"0x26cbb48","hash":"0x3003f1741d48544139a2600eea2fd482862da0f5caf68541837b790edafc7c87","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x6963d373"}],"source":"chainlake-kafka"}}
[Webhook] Processing as EVM activity (1 items)
[Webhook] Tx already in processedTxs cache: 0x3003f1741d4854
[DEBUG] onResponse: POST /api/webhook/alchemy -> 200
request completed
[AutoTrade] getTokenInfo: Fetching 0x1d24816191d86b2750b6c875dc9459c416b15adf (Chain: 8453, Jitter: 317ms)
[AutoTrade] getTokenInfo: Success (DexScreener) - berkozer $0.00001897
[AutoTrade] ⏭️ No open positions found for user cmjqr6yqq00003svdazw3v6xx and token 0x1d24816191d86b2750b6c875dc9459c416b15adf. Skipping mirror sell.