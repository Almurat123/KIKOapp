[AutoTrade] Processing swap from target: {
  wallet: '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed',
  tokenIn: '0x1111111111166b7fe7bd91427724b487980afc69',
  tokenOut: '0xde34ce6768a045929bd50fc18dec2bcf3eab2e6f',
  amountIn: '292280901192405497',
  amountOut: '447111581006771024426'
}
[AutoTrade] Detection result: {
2026-01-10 03:46:54.665 UTC [57677] ERROR:  relation "public.LeaderWalletStats" does not exist at character 13
2026-01-10 03:46:54.665 UTC [57677] STATEMENT:  INSERT INTO "public"."LeaderWalletStats" ("id","address","chainId","totalTrades","buyTrades","sellTrades","totalVolumeUsd","realizedPnlUsd","unrealizedPnlUsd","totalPnlUsd","winCount","lossCount","winRate","bestTradePnl","worstTradePnl","avgTradePnl","firstTradeAt","lastTradeAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) ON CONFLICT ("address","chainId") DO UPDATE SET "totalTrades" = ("public"."LeaderWalletStats"."totalTrades" + $21), "buyTrades" = ("public"."LeaderWalletStats"."buyTrades" + $22), "totalVolumeUsd" = ("public"."LeaderWalletStats"."totalVolumeUsd" + $23), "lastTradeAt" = $24, "updatedAt" = $25 WHERE (("public"."LeaderWalletStats"."address" = $26 AND "public"."LeaderWalletStats"."chainId" = $27) AND 1=1) RETURNING "public"."LeaderWalletStats"."id", "public"."LeaderWalletStats"."address", "public"."LeaderWalletStats"."chainId", "public"."LeaderWalletStats"."totalTrades", "public"."LeaderWalletStats"."buyTrades", "public"."LeaderWalletStats"."sellTrades", "public"."LeaderWalletStats"."totalVolumeUsd", "public"."LeaderWalletStats"."realizedPnlUsd", "public"."LeaderWalletStats"."unrealizedPnlUsd", "public"."LeaderWalletStats"."totalPnlUsd", "public"."LeaderWalletStats"."winCount", "public"."LeaderWalletStats"."lossCount", "public"."LeaderWalletStats"."winRate", "public"."LeaderWalletStats"."bestTradePnl", "public"."LeaderWalletStats"."worstTradePnl", "public"."LeaderWalletStats"."avgTradePnl", "public"."LeaderWalletStats"."firstTradeAt", "public"."LeaderWalletStats"."lastTradeAt", "public"."LeaderWalletStats"."createdAt", "public"."LeaderWalletStats"."updatedAt"
  isBuy: true,
  isSell: false,
  isTokenToToken: false,
  tokenInIsCash: true,
  tokenOutIsCash: false
}
[AutoTrade] 🟢 TARGET IS BUYING - triggering copy trade
[AutoTrade] ⚡ Fast path start for 0xde34ce6768a045929bd50fc18dec2bcf3eab2e6f from 0x2cd32f...
[AutoTrade] getTokenInfo: Fetching 0xde34ce6768a045929bd50fc18dec2bcf3eab2e6f on base (chainId: 8453)
[AutoTrade] getTokenInfo: Found 16 pairs for 0xde34ce6768a045929bd50fc18dec2bcf3eab2e6f
[AutoTrade] getTokenInfo: Success - realgarrytan price: $0.002909, liq: $460075.24
[AutoTrade] Found 1 config(s) for BUY. Price: $0.002909 (Fallback: false)
[AutoTrade] Calculated value from tokenOut (0xde34ce6768a045929bd50fc18dec2bcf3eab2e6f): $1.30
[AutoTrade] Would execute BUY: { user: '0xA386bc9D', tokenIn: 'ETH' }
[AutoTrade] getTokenInfo: Fetching 0x4200000000000000000000000000000000000006 on base (chainId: 8453)
prisma:error 
Invalid `prisma.leaderWalletStats.upsert()` invocation:
The table `public.LeaderWalletStats` does not exist in the current database.
[LeaderStats] Failed to record new trade for 0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed: PrismaClientKnownRequestError: 
Invalid `prisma.leaderWalletStats.upsert()` invocation:
The table `public.LeaderWalletStats` does not exist in the current database.
    at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
    at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
    at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
    at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
    at async recordNewTrade (file:///app/dist/services/leaderWalletStatsService.js:8:23) {
  code: 'P2021',
  clientVersion: '5.22.0',
  meta: { modelName: 'LeaderWalletStats', table: 'public.LeaderWalletStats' }
}
[AutoTrade] getTokenInfo: Found 30 pairs for 0x4200000000000000000000000000000000000006
[AutoTrade] getTokenInfo: Success - WETH price: $3082.45, liq: $9236782.11
[AutoTrade] ⚡ Zora token detected and Fast Execution ON for user cmjqr6yqq00003svdazw3v6xx. Using specialized Zora interaction.
[ZoraSniper] ⚡ Executing FastSwap for 0xde34ce6768a045929bd50fc18dec2bcf3eab2e6f...
[ZoraSniper] 📊 Market Info for realgarrytan: Price: $0.0029147876093368391844231799339118005956, MarketCap: $2.9M
[ZoraSniper] 🔍 Quote Details:
   - Input: 0.000324 ETH
   - Expected: 327.886426411386805858 realgarrytan
   - Minimum: N/A realgarrytan (after 3% slippage)
[ZoraSniper] 🛡️ Price Check: Market: $0.002915, Quote: $0.003045, Deviation: 4.47%
[PrivyWallet] Sending transaction: {
  attempt: 1,
  from: '0xA386bc9D',
  walletId: 'grm2l872vfuim33',
  to: '0x6ff5693b',
  chainId: 8453,
  valueWei: '324000000000000'
}
[PrivyWallet] Transaction sent: 0xc7ddbbd86ed65139f7c012f1ee547663e736c560ee56d44def54670fbf4ae108
[AutoTrade] Position created for user cmjqr6yqq00003svdazw3v6xx
[AutoTrade] Fetching email from Privy for user cmjqr6yqq00003svdazw3v6xx...




[AutoTrade] ⚡ Fast path sell: Found 1 config(s) for SELL of 0x14fcfdaecd7aae4ee883ba010017009d2728ffdc
[AutoTrade] getTokenInfo: Fetching 0x14fcfdaecd7aae4ee883ba010017009d2728ffdc on base (chainId: 8453)
[AutoTrade] getTokenInfo attempt 1/3 failed: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] getTokenInfo attempt 2/3 failed: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] getTokenInfo attempt 3/3 failed: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] getTokenInfo failed after retries: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] ⏭️ No open positions found for user cmjqr6yqq00003svdazw3v6xx and token 0x14fcfdaecd7aae4ee883ba010017009d2728ffdc. Skipping mirror sell.
[AutoTrade] ========== SWAP DETECTED ==========
[AutoTrade] Processing swap from target: {
[AutoTrade] Detection result: {
[AutoTrade] 🔴 TARGET IS SELLING - triggering mirror sell
[AutoTrade] ⚡ Fast path sell: Found 1 config(s) for SELL of 0x14fcfdaecd7aae4ee883ba010017009d2728ffdc
[AutoTrade] getTokenInfo: Fetching 0x14fcfdaecd7aae4ee883ba010017009d2728ffdc on base (chainId: 8453)
[AutoTrade] getTokenInfo attempt 1/3 failed: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] getTokenInfo: Found 1 pairs for 0x14fcfdaecd7aae4ee883ba010017009d2728ffdc
[AutoTrade] getTokenInfo: Success - thedominancebros price: $0.00003585, liq: $17650.88
[AutoTrade] ⏭️ No open positions found for user cmjqr6yqq00003svdazw3v6xx and token 0x14fcfdaecd7aae4ee883ba010017009d2728ffdc. Skipping mirror sell.
[AutoTrade] Detection result: {
[AutoTrade] 🔴 TARGET IS SELLING - triggering mirror sell
[AutoTrade] ⚡ Fast path sell: Found 1 config(s) for SELL of 0x14fcfdaecd7aae4ee883ba010017009d2728ffdc
[AutoTrade] ========== SWAP DETECTED ==========
[AutoTrade] Processing swap from target: {
[AutoTrade] getTokenInfo: Fetching 0x14fcfdaecd7aae4ee883ba010017009d2728ffdc on base (chainId: 8453)
[AutoTrade] getTokenInfo attempt 1/3 failed: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] getTokenInfo attempt 2/3 failed: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] ⏭️ No open positions found for user cmjqr6yqq00003svdazw3v6xx and token 0x14fcfdaecd7aae4ee883ba010017009d2728ffdc. Skipping mirror sell.
[AutoTrade] getTokenInfo attempt 3/3 failed: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] getTokenInfo failed after retries: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] ========== SWAP DETECTED ==========
[AutoTrade] Processing swap from target: {
[AutoTrade] Detection result: {
[AutoTrade] 🟢 TARGET IS BUYING - triggering copy trade
[AutoTrade] ⚡ Fast path start for 0x1aaf979732408bda89b87b70895c3fc1a0b1aed6 from 0xd1aa4a...
[AutoTrade] getTokenInfo: Fetching 0x1aaf979732408bda89b87b70895c3fc1a0b1aed6 on base (chainId: 8453)
[AutoTrade] getTokenInfo attempt 1/3 failed: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] ⏭️ Skipping for user cmjqr6yqq00003svdazw3v6xx: Target buy value $0.00 < min $1
[AutoTrade] getTokenInfo attempt 2/3 failed: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] getTokenInfo attempt 3/3 failed: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] getTokenInfo failed after retries: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] ⚠️ 0x1aaf979732408bda89b87b70895c3fc1a0b1aed6 missing DexScreener info, but is valid ZORA launchpad token. Using fallback info.
[AutoTrade] Found 1 config(s) for BUY. Price: $0 (Fallback: true)
[AutoTrade] Calculated value from tokenOut (0x1aaf979732408bda89b87b70895c3fc1a0b1aed6): $0.00
[AutoTrade] ========== SWAP DETECTED ==========
[AutoTrade] Processing swap from target: {
[AutoTrade] Detection result: {
[AutoTrade] 🔴 TARGET IS SELLING - triggering mirror sell
[AutoTrade] ⚡ Fast path sell: Found 1 config(s) for SELL of 0x1aaf979732408bda89b87b70895c3fc1a0b1aed6
[AutoTrade] getTokenInfo: Fetching 0x1aaf979732408bda89b87b70895c3fc1a0b1aed6 on base (chainId: 8453)
[AutoTrade] getTokenInfo attempt 1/3 failed: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] getTokenInfo attempt 2/3 failed: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] ⏭️ No open positions found for user cmjqr6yqq00003svdazw3v6xx and token 0x1aaf979732408bda89b87b70895c3fc1a0b1aed6. Skipping mirror sell.
[AutoTrade] getTokenInfo attempt 3/3 failed: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] getTokenInfo failed after retries: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] ========== SWAP DETECTED ==========
[AutoTrade] Processing swap from target: {
[AutoTrade] Detection result: {
[AutoTrade] 🔴 TARGET IS SELLING - triggering mirror sell
[AutoTrade] ⚡ Fast path sell: Found 1 config(s) for SELL of 0x1aaf979732408bda89b87b70895c3fc1a0b1aed6
[AutoTrade] getTokenInfo: Fetching 0x1aaf979732408bda89b87b70895c3fc1a0b1aed6 on base (chainId: 8453)
[AutoTrade] getTokenInfo attempt 1/3 failed: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] getTokenInfo: Found 1 pairs for 0x1aaf979732408bda89b87b70895c3fc1a0b1aed6
[AutoTrade] getTokenInfo: Success - guineenews price: $0.00004459, liq: $0
[AutoTrade] ⏭️ No open positions found for user cmjqr6yqq00003svdazw3v6xx and token 0x1aaf979732408bda89b87b70895c3fc1a0b1aed6. Skipping mirror sell.
[AutoTrade] ========== SWAP DETECTED ==========
[AutoTrade] Processing swap from target: {
[AutoTrade] Detection result: {
[AutoTrade] 🔴 TARGET IS SELLING - triggering mirror sell
[AutoTrade] ⚡ Fast path sell: Found 1 config(s) for SELL of 0x1aaf979732408bda89b87b70895c3fc1a0b1aed6
[AutoTrade] getTokenInfo: Fetching 0x1aaf979732408bda89b87b70895c3fc1a0b1aed6 on base (chainId: 8453)
[AutoTrade] getTokenInfo attempt 1/3 failed: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] getTokenInfo: Found 1 pairs for 0x1aaf979732408bda89b87b70895c3fc1a0b1aed6
[AutoTrade] getTokenInfo: Success - guineenews price: $0.00004459, liq: $0
[AutoTrade] ⏭️ No open positions found for user cmjqr6yqq00003svdazw3v6xx and token 0x1aaf979732408bda89b87b70895c3fc1a0b1aed6. Skipping mirror sell.
[AutoTrade] ========== SWAP DETECTED ==========
[AutoTrade] Processing swap from target: {
[AutoTrade] Detection result: {
[AutoTrade] 🟢 TARGET IS BUYING - triggering copy trade
[AutoTrade] ⚡ Fast path start for 0x2d477a4afc02c7b50426e95691c4e05601fb64c0 from 0xd1aa4a...
[AutoTrade] getTokenInfo: Fetching 0x2d477a4afc02c7b50426e95691c4e05601fb64c0 on base (chainId: 8453)
[AutoTrade] getTokenInfo: No pairs returned for 0x2d477a4afc02c7b50426e95691c4e05601fb64c0
[AutoTrade] ⚠️ 0x2d477a4afc02c7b50426e95691c4e05601fb64c0 missing DexScreener info, but is valid ZORA launchpad token. Using fallback info.
[AutoTrade] Found 1 config(s) for BUY. Price: $0 (Fallback: true)
[AutoTrade] Calculated value from tokenOut (0x2d477a4afc02c7b50426e95691c4e05601fb64c0): $0.00
[AutoTrade] ⏭️ Skipping for user cmjqr6yqq00003svdazw3v6xx: Target buy value $0.00 < min $1
[AutoTrade] ========== SWAP DETECTED ==========
[AutoTrade] Processing swap from target: {
[AutoTrade] Detection result: {
[AutoTrade] 🔴 TARGET IS SELLING - triggering mirror sell
[AutoTrade] ⚡ Fast path sell: Found 1 config(s) for SELL of 0x2d477a4afc02c7b50426e95691c4e05601fb64c0
[AutoTrade] getTokenInfo: Fetching 0x2d477a4afc02c7b50426e95691c4e05601fb64c0 on base (chainId: 8453)
[AutoTrade] getTokenInfo: No pairs returned for 0x2d477a4afc02c7b50426e95691c4e05601fb64c0
[AutoTrade] ⏭️ No open positions found for user cmjqr6yqq00003svdazw3v6xx and token 0x2d477a4afc02c7b50426e95691c4e05601fb64c0. Skipping mirror sell.
[AutoTrade] ========== SWAP DETECTED ==========
[AutoTrade] Processing swap from target: {
[AutoTrade] Detection result: {
[AutoTrade] getTokenInfo attempt 3/3 failed: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] getTokenInfo failed after retries: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] 🔴 TARGET IS SELLING - triggering mirror sell
[AutoTrade] ⚡ Fast path sell: Found 1 config(s) for SELL of 0x2d477a4afc02c7b50426e95691c4e05601fb64c0
[AutoTrade] getTokenInfo: Fetching 0x2d477a4afc02c7b50426e95691c4e05601fb64c0 on base (chainId: 8453)
[AutoTrade] getTokenInfo attempt 1/3 failed: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] getTokenInfo attempt 2/3 failed: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
[AutoTrade] ⏭️ No open positions found for user cmjqr6yqq00003svdazw3v6xx and token 0x2d477a4afc02c7b50426e95691c4e05601fb64c0. Skipping mirror sell.
[AutoTrade] ========== SWAP DETECTED ==========
[AutoTrade] Processing swap from target: {
[AutoTrade] Detection result: {
[AutoTrade] 🟢 TARGET IS BUYING - triggering copy trade
[AutoTrade] ⚡ Fast path start for 0xde34ce6768a045929bd50fc18dec2bcf3eab2e6f from 0x2cd32f...
[AutoTrade] getTokenInfo: Fetching 0xde34ce6768a045929bd50fc18dec2bcf3eab2e6f on base (chainId: 8453)
[AutoTrade] getTokenInfo: Found 16 pairs for 0xde34ce6768a045929bd50fc18dec2bcf3eab2e6f
[AutoTrade] getTokenInfo: Success - realgarrytan price: $0.002909, liq: $460075.24
[AutoTrade] Found 1 config(s) for BUY. Price: $0.002909 (Fallback: false)
[AutoTrade] Calculated value from tokenOut (0xde34ce6768a045929bd50fc18dec2bcf3eab2e6f): $1.30
[AutoTrade] Would execute BUY: { user: '0xA386bc9D', tokenIn: 'ETH' }
[AutoTrade] getTokenInfo: Fetching 0x4200000000000000000000000000000000000006 on base (chainId: 8453)
[AutoTrade] getTokenInfo: Found 30 pairs for 0x4200000000000000000000000000000000000006
[AutoTrade] getTokenInfo: Success - WETH price: $3082.45, liq: $9236782.11
[AutoTrade] ⚡ Zora token detected and Fast Execution ON for user cmjqr6yqq00003svdazw3v6xx. Using specialized Zora interaction.
[AutoTrade] Position created for user cmjqr6yqq00003svdazw3v6xx
[AutoTrade] Fetching email from Privy for user cmjqr6yqq00003svdazw3v6xx...
[AutoTrade] getTokenInfo: Fetching 0xde34ce6768a045929bd50fc18dec2bcf3eab2e6f on base (chainId: 8453)
[AutoTrade] getTokenInfo: Found 16 pairs for 0xde34ce6768a045929bd50fc18dec2bcf3eab2e6f
[AutoTrade] getTokenInfo: Success - realgarrytan price: $0.002909, liq: $460075.24
[AutoTrade] getTokenInfo: Fetching 0xde34ce6768a045929bd50fc18dec2bcf3eab2e6f on base (chainId: 8453)
[AutoTrade] getTokenInfo: Found 16 pairs for 0xde34ce6768a045929bd50fc18dec2bcf3eab2e6f
[AutoTrade] getTokenInfo: Success - realgarrytan price: $0.002907, liq: $459717.12