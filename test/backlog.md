  endpoint: '/swap/permit2/quote',
  chainId: 56,
  url: 'https://api.0x.org/swap/permit2/quote?chainId=56&sellToken=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&buyToken=0xf9c6e80e9a5807a1214a79449009b48104f94444&sellAmount=2203000000000000&slippageBps=300&taker=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
  params: {
    sellToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  endpoint: 'permit2'
}
[0x API] Quote received successfully
    buyToken: '0xf9c6e80e9a5807a1214a79449009b48104f94444',
[0x API] Quote response structure: {
  hasTransaction: true,
  hasTo: true,
    sellAmount: '2203000000000000',
  hasData: true,
  hasValue: true,
    slippageBps: '300',
  transactionValue: '2203000000000000',
    taker: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E'
  }
}
[0x API] Requesting quote from: https://api.0x.org/swap/permit2/quote?chainId=56&sellToken=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&buyToken=0xf9c6e80e9a5807a1214a79449009b48104f94444&sellAmount=2203000000000000&slippageBps=300&taker=0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E
[0x API] Quote request details: {
  sellToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  buyToken: '0xf9c6e80e9a5807a1214a79449009b48104f94444',
  sellAmount: '2203000000000000',
  slippageBps: 300,
  chainId: 56,
  takerAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
  providedTakerAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
  keyFormat: 'wallet-auth',
  usedEndpoint: 'permit2'
  keyLength: 196,
}
[0x API] Flattened quote data: {
  keyIdConfigured: true,
  to: '0xf5647a35',
  keyId: 'crdgro3bw0...'
  dataLength: 3018,
}
  value: '2203000000000000',
[PrivyWallet] Sending transaction: {
  buyAmount: '2786528070194482726086'
}
  attempt: 1,
  from: '0xA386bc9D',
[TradeExecutor] Got quote: sell 0.002203 -> buy 2786528070194482726086 (min: 2702932228088648238400)
  walletId: 'grm2l872vfuim33',
[PrivyWallet] Authorization Key config: {
  to: '0xf5647a35',
  chainId: 56,
  valueWei: '2203000000000000'
}
[PrivyWallet] Transaction sent: 0x188684e39d681b13142256356f619d117845b7d55ae030df1a92ec2a61b3a5ac
[TradeExecutor] Swap executed successfully: 0x188684e39d681b13142256356f619d117845b7d55ae030df1a92ec2a61b3a5ac
[TradeExecutor] Waiting for buy tx 0x188684e39d681b13142256356f619d117845b7d55ae030df1a92ec2a61b3a5ac to confirm before approving...
2026-01-10 05:16:47.107 UTC [58004] ERROR:  there is no unique or exclusion constraint matching the ON CONFLICT specification
2026-01-10 05:16:47.107 UTC [58004] STATEMENT:  INSERT INTO "public"."LeaderWalletStats" ("id","address","chainId","totalTrades","buyTrades","sellTrades","totalVolumeUsd","realizedPnlUsd","unrealizedPnlUsd","totalPnlUsd","winCount","lossCount","winRate","bestTradePnl","worstTradePnl","avgTradePnl","firstTradeAt","lastTradeAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) ON CONFLICT ("address","chainId") DO UPDATE SET "totalTrades" = ("public"."LeaderWalletStats"."totalTrades" + $21), "buyTrades" = ("public"."LeaderWalletStats"."buyTrades" + $22), "totalVolumeUsd" = ("public"."LeaderWalletStats"."totalVolumeUsd" + $23), "lastTradeAt" = $24, "updatedAt" = $25 WHERE (("public"."LeaderWalletStats"."address" = $26 AND "public"."LeaderWalletStats"."chainId" = $27) AND 1=1) RETURNING "public"."LeaderWalletStats"."id", "public"."LeaderWalletStats"."address", "public"."LeaderWalletStats"."chainId", "public"."LeaderWalletStats"."totalTrades", "public"."LeaderWalletStats"."buyTrades", "public"."LeaderWalletStats"."sellTrades", "public"."LeaderWalletStats"."totalVolumeUsd", "public"."LeaderWalletStats"."realizedPnlUsd", "public"."LeaderWalletStats"."unrealizedPnlUsd", "public"."LeaderWalletStats"."totalPnlUsd", "public"."LeaderWalletStats"."winCount", "public"."LeaderWalletStats"."lossCount", "public"."LeaderWalletStats"."winRate", "public"."LeaderWalletStats"."bestTradePnl", "public"."LeaderWalletStats"."worstTradePnl", "public"."LeaderWalletStats"."avgTradePnl", "public"."LeaderWalletStats"."firstTradeAt", "public"."LeaderWalletStats"."lastTradeAt", "public"."LeaderWalletStats"."createdAt", "public"."LeaderWalletStats"."updatedAt"
[TradeExecutor] Buy confirmed. Auto-approving 0xf9c6e80e9a5807a1214a79449009b48104f94444 for Permit2...
[TradeExecutor] Checking allowance for 0xf9c6e80e9a5807a1214a79449009b48104f94444 -> 0x000000000022d473030f116ddee9dad608d18000
[TradeExecutor] Current allowance: 0, required: 115792089237316195423570985008687907853269984665640564039457584007913129639935
[TradeExecutor] Allowance insufficient. Approving MaxUint256...
[PrivyWallet] Sending transaction: {
  attempt: 1,
  from: '0xA386bc9D',
  walletId: 'grm2l872vfuim33',
  to: '0xf9c6e80e',
  chainId: 56,
  valueWei: '0'
}
[PrivyWallet] Transaction sent: 0x8b1d90994e6238cf880303c417ea3245cda5e7dba7c32862929ee89f74b28119
[TradeExecutor] Approval sent: 0x8b1d90994e6238cf880303c417ea3245cda5e7dba7c32862929ee89f74b28119. Waiting for confirmation...
[TradeExecutor] Auto-approving 0xf9c6e80e9a5807a1214a79449009b48104f94444 for KyberSwap...
[TradeExecutor] Checking allowance for 0xf9c6e80e9a5807a1214a79449009b48104f94444 -> 0x6131B5fae19EA4f9D964eAc0408E4408b66337b5
[TradeExecutor] Approval confirmed.
[TradeExecutor] Permit2 approved.
[TradeExecutor] Current allowance: 0, required: 115792089237316195423570985008687907853269984665640564039457584007913129639935
[TradeExecutor] Allowance insufficient. Approving MaxUint256...
[PrivyWallet] Sending transaction: {
  attempt: 1,
  from: '0xA386bc9D',
  walletId: 'grm2l872vfuim33',
  to: '0xf9c6e80e',
  chainId: 56,
  valueWei: '0'
}
[PrivyWallet] Transaction sent: 0x19922567c4261680d366ec68e582a8254b2dd8a0b753514d345432c24ba0f46f
[TradeExecutor] Approval sent: 0x19922567c4261680d366ec68e582a8254b2dd8a0b753514d345432c24ba0f46f. Waiting for confirmation...
[TradeExecutor] Approval confirmed.
[TradeExecutor] Auto-approval complete.
[AutoTrade] Position created for user cmjqr6yqq00003svdazw3v6xx
[AutoTrade] Fetching email from Privy for user cmjqr6yqq00003svdazw3v6xx...