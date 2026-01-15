[TxDecoder] ✅ Valid swap detected: 0xeeeeeeee -> 0xd9159ad2
incoming request
[Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_2zkfajmplluxb7ew","createdAt":"2026-01-15T11:06:16.222Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed","toAddress":"0x4409921ae43a39a11d90f7b7f96cfd0b8093d9fc","blockNum":"0x26f36a2","hash":"0x21c4007493399f7113f7a802d3d4fe05fadd8e51711e082e41f6e9eaf9ec2f27","value":0.0004,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x16bcc41e90000","decimals":18},"blockTimestamp":"0x6968ca27"}],"source":"chainlake-kafka"}}
[Webhook] Processing as EVM activity (1 items)
[Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_0an6qqhvrfuqangf","createdAt":"2026-01-15T11:06:16.300Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x53932cbd6cddbb907ce1bb108496c7bd8aaa5dce","toAddress":"0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed","blockNum":"0x26f36a2","hash":"0x21c4007493399f7113f7a802d3d4fe05fadd8e51711e082e41f6e9eaf9ec2f27","value":303766.67954713333,"asset":"WARP","category":"token","rawContract":{"rawValue":"0x00000000000000000000000000000000000000000000405339859745ce17e6a3","address":"0xd9159ad2d5fe625cd1f54f4d328fb19cb5262b07","decimals":18},"log":{"address":"0xd9159ad2d5fe625cd1f54f4d328fb19cb5262b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x00000000000000000000000053932cbd6cddbb907ce1bb108496c7bd8aaa5dce","0x0000000000000000000000002cd32fb42748774fafde72d8607f16ccc5f5c0ed"],"data":"0x00000000000000000000000000000000000000000000405339859745ce17e6a3","blockHash":"0x260bedc5ca3aece38180128993ad860ac6a10b7d49c634678941f86ce1020ccf","blockNumber":"0x26f36a2","blockTimestamp":"0x6968ca27","transactionHash":"0x21c4007493399f7113f7a802d3d4fe05fadd8e51711e082e41f6e9eaf9ec2f27","transactionIndex":"0x93","logIndex":"0x462","removed":false},"blockTimestamp":"0x6968ca27"}],"source":"chainlake-kafka"}}
[Webhook] Processing as EVM activity (1 items)
request completed
incoming request
request completed
[Webhook] 🎯 Found 1 tracked wallets for tx 0x21c400
[Webhook] 🎯 Found 1 tracked wallets for tx 0x21c400
[TxDecoder] Decoding swap from 9 logs, from: 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed, nativeValue: 0x16bcc41e90000
[TxDecoder] Found 3 Transfer events
  - Token: 0x42000000, from: 0x4409921a, to: 0x411d2c09, amount: 396600000000000
  - Token: 0xd9159ad2, from: 0x53932cbd, to: 0x2cd32fb4, amount: 303766679547133317080739
  - Token: 0x42000000, from: 0x411d2c09, to: 0x53932cbd, amount: 396600000000000
[TxDecoder] Incoming transfers (to 0x2cd32fb4): 1
[TxDecoder] Analysis - Received: 0xd9159ad2, Sent: null
[TxDecoder] No tokenSent found but nativeValue > 0, assuming User SENT ETH/BNB
[TxDecoder] RETURNING: {
  tokenOut: '0xd9159ad2d5fe625cd1f54f4d328fb19cb5262b07',
  tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  amountIn: '0x16bcc41e90000',
  amountOut: '303766679547133317080739'
}
}
  tokenInIsCash: true,
[AutoTrade] ========== SWAP DETECTED ==========
[Webhook] ✅ Swap detected for tracked wallet 0x2cd32fb4: {
  tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  tokenOutIsCash: false
[TxDecoder] Incoming transfers (to 0x2cd32fb4): 1
[AutoTrade] Processing swap from target: {
}
  tokenOut: '0xd9159ad2d5fe625cd1f54f4d328fb19cb5262b07',
[TxDecoder] Analysis - Received: 0xd9159ad2, Sent: null
}
  dex: 'Unknown DEX'
  wallet: '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed',
[TxDecoder] No tokenSent found but nativeValue > 0, assuming User SENT ETH/BNB
[AutoTrade] Detection result: {
  tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
[AutoTrade] 🟢 TARGET IS BUYING - triggering copy trade
[TxDecoder] ✅ Valid swap detected: 0xeeeeeeee -> 0xd9159ad2
  tokenOut: '0xd9159ad2d5fe625cd1f54f4d328fb19cb5262b07',
  isBuy: true,
[TxDecoder] RETURNING: {
[AutoTrade] ⚡ Fast path start for 0xd9159ad2d5fe625cd1f54f4d328fb19cb5262b07 from 0x2cd32f...
  amountIn: '0x16bcc41e90000',
  tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  isSell: false,
[TxDecoder] Decoding swap from 9 logs, from: 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed, nativeValue: 0x16bcc41e90000
  tokenOut: '0xd9159ad2d5fe625cd1f54f4d328fb19cb5262b07',
  amountOut: '303766679547133317080739'
  amountIn: '0x16bcc41e90000',
  isTokenToToken: false,
[TxDecoder] Found 3 Transfer events
  - Token: 0x42000000, from: 0x4409921a, to: 0x411d2c09, amount: 396600000000000
  - Token: 0xd9159ad2, from: 0x53932cbd, to: 0x2cd32fb4, amount: 303766679547133317080739
  - Token: 0x42000000, from: 0x411d2c09, to: 0x53932cbd, amount: 396600000000000
  amountOut: '303766679547133317080739'
}
[Webhook] ✅ Swap detected for tracked wallet 0x2cd32fb4: {
  tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
[AutoTrade] ========== SWAP DETECTED ==========
  tokenOut: '0xd9159ad2d5fe625cd1f54f4d328fb19cb5262b07',
[AutoTrade] Processing swap from target: {
  dex: 'Unknown DEX'
  wallet: '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed',
}
  tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  tokenOut: '0xd9159ad2d5fe625cd1f54f4d328fb19cb5262b07',
  amountIn: '0x16bcc41e90000',
  amountOut: '303766679547133317080739'
}
[AutoTrade] ⏭️ Skipping duplicate swap (last seen 23ms ago)
[Prisma-Error] 
Invalid `prisma.copyTradeConfig.findMany()` invocation:
The column `User.farcasterFid` does not exist in the current database. {
  target: 'copyTradeConfig.findMany',
  timestamp: 2026-01-15T11:06:16.710Z
}
[Webhook] Error processing Alchemy webhook: PrismaClientKnownRequestError: 
Invalid `prisma.copyTradeConfig.findMany()` invocation:
The column `User.farcasterFid` does not exist in the current database.
    at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
    at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
    at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
    at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
    at async withRetry (file:///app/dist/db/prisma.js:60:20)
    at async handleTargetBuy (file:///app/dist/services/autoTradeService.js:175:21)
    at async handleSwapDetected (file:///app/dist/services/autoTradeService.js:150:9)
    at async Object.<anonymous> (file:///app/dist/routes/webhook.js:367:21) {
  code: 'P2022',
  clientVersion: '5.22.0',
  meta: { modelName: 'CopyTradeConfig', column: 'User.farcasterFid' }
}
[PositionMonitor] 🔄 Running position check...
[PositionMonitor] No open positions to check
2026-01-15 11:06:16.698 UTC [84959] ERROR:  column User.farcasterFid does not exist at character 130
2026-01-15 11:06:16.698 UTC [84959] STATEMENT:  SELECT "public"."User"."id", "public"."User"."privyDid", "public"."User"."walletAddress", "public"."User"."solanaWalletAddress", "public"."User"."farcasterFid", "public"."User"."farcasterUsername", "public"."User"."createdAt", "public"."User"."email", "public"."User"."referralCode", "public"."User"."referredBy" FROM "public"."User" WHERE "public"."User"."id" IN ($1) OFFSET $2