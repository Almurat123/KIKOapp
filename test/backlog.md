[AutoTrade] EVM sell failed: Sell transaction reverted on-chain: 0x6a200e0a2b23e6c7504d42e78a51e4ac2f4e4c09ac10aa57454fecbf0b3e3326. Retrying partial...
  isChainSpecificBaseUrl: false,
  endpoint: '/swap/permit2/quote',
[AutoTrade] Retrying with 1500 bps (15.0%) slippage...
  chainId: 8453,
[TradeExecutor] Executing SELL: {
  url: 'https://api.0x.org/swap/permit2/quote?chainId=8453&sellToken=0x3ec2156d4c0a9cbdab4a016633b7bcf6a8d68ea2&buyToken=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&sellAmount=4885586111103388490408&slippageBps=1500&taker=0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B',
  params: {
  user: '0xFB64Ce8d',
    sellToken: '0x3ec2156d4c0a9cbdab4a016633b7bcf6a8d68ea2',
  tokenToSell: '0x3ec2156d',
    buyToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    sellAmount: '4885586111103388490408',
  amountToSell: '4885586111103388490408',
    slippageBps: '1500',
  chainId: 8453
}
[0x API] URL construction: {
    taker: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B'
  }
}
[0x API] Requesting quote from: https://api.0x.org/swap/permit2/quote?chainId=8453&sellToken=0x3ec2156d4c0a9cbdab4a016633b7bcf6a8d68ea2&buyToken=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&sellAmount=4885586111103388490408&slippageBps=1500&taker=0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
[0x API] Quote request details: {
  sellToken: '0x3ec2156d4c0a9cbdab4a016633b7bcf6a8d68ea2',
  buyToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  sellAmount: '4885586111103388490408',
  slippageBps: 1500,
  chainId: 8453,
  takerAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B',
  providedTakerAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B',
  endpoint: 'permit2'
}
[Kyber] GET routes {
  routesUrl: 'https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=0x3ec2156d4c0a9cbdab4a016633b7bcf6a8d68ea2&tokenOut=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&amountIn=4885586111103388490408&saveGas=true&gasInclude=true&clientId=kiko-app'
}
[Kyber] routes response {
  status: 200,
  hasData: true,
  keys: [ 'code', 'message', 'data', 'requestId' ]
}
[Kyber] POST build {
  buildUrl: 'https://aggregator-api.kyberswap.com/base/api/v1/route/build',
  hasRouteSummary: true,
  hasRoute: false
}
[0x API] Quote received successfully
[0x API] Quote response structure: {
  hasTransaction: true,
  hasTo: true,
  to: '0x78564866',
  hasData: true,
  dataLength: 2962,
  hasValue: true,
  value: '0',
  transactionValue: '0',
  buyAmount: '300239166637090'
}
  usedEndpoint: 'permit2'
}
[0x API] Flattened quote data: {
  rootKeys: [ 'code', 'message', 'data', 'requestId' ]
[Kyber] build response {
}
  status: 200,
[TradeExecutor] Got best quote from KyberSwap: sell 4885586111103388490408 -> receive 300693442522693 (Wei)
  dataKeys: [
    'amountIn',
[TradeExecutor] Checking allowance for 0x3ec2156d4c0a9cbdab4a016633b7bcf6a8d68ea2 -> 0x6131B5fae19EA4f9D964eAc0408E4408b66337b5
    'amountInUsd',
    'amountOut',
    'amountOutUsd',
    'gas',
    'gasUsd',
    'additionalCostUsd',
    'additionalCostMessage',
    'outputChange',
    'data',
    'routerAddress',
    'transactionValue'
  ],
[TradeExecutor] Current allowance: 115792089237316195423570985008687907853269984665640564039457584007913129639935, required: 4885586111103388490408
[TradeExecutor] Allowance sufficient.
[PrivyWallet] Sending transaction: {
  attempt: 1,
  from: '0xFB64Ce8d',
  walletId: 'v235w98i01e60aq',
  to: '0x6131B5fa',
  chainId: 8453,
  valueWei: '0'
}
[PrivyWallet] Transaction sent: 0x69e2a68066ea3207c373510499b92ee6618703afdc1f2f0f62523e5cb7c2b880
[TradeExecutor] Sell broadcasted, waiting for confirmation: 0x69e2a68066ea3207c373510499b92ee6618703afdc1f2f0f62523e5cb7c2b880
[TradeExecutor] Sell transaction reverted on-chain: 0x69e2a68066ea3207c373510499b92ee6618703afdc1f2f0f62523e5cb7c2b880
[PositionMonitor] 🔄 Running position check...
[PositionMonitor] Checking 1 open position(s)...
[PositionMonitor] 🔄 Running position check...
[PositionMonitor] Checking 1 open position(s)...
2026-01-17 09:48:03.291 UTC [27] LOG:  checkpoint starting: time
[PositionMonitor] 🔄 Running position check...
[PositionMonitor] Checking 1 open position(s)...
2026-01-17 09:48:13.276 UTC [27] LOG:  checkpoint complete: wrote 99 buffers (0.6%); 0 WAL file(s) added, 0 removed, 0 recycled; write=9.860 s, sync=0.022 s, total=9.986 s; sync files=24, longest=0.017 s, average=0.001 s; distance=654 kB, estimate=4359 kB; lsn=0/D9FD9C88, redo lsn=0/D9FD83C8
[PositionMonitor] 🔄 Running position check...
[PositionMonitor] Checking 1 open position(s)...
[PositionMonitor] 🔄 Running position check...
[PositionMonitor] Checking 1 open position(s)...
[PositionMonitor] 🔄 Running position check...
[PositionMonitor] Checking 1 open position(s)...