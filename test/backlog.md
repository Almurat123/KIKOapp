perfect-curiosity


production
Architecture
Observability
Logs
Settings




Filter and search logs

Last hour


    at async handleTargetSell (file:///app/dist/services/autoTradeService.js:509:5)
    at async handleSwapDetected (file:///app/dist/services/autoTradeService.js:77:9)
[QuoteService] 0x failed Error: 0x API error: No valid swap route found for token 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee. This token may only be tradeable via its native platform (e.g., Four.meme, Pump.fun).
    at getZeroExQuote (file:///app/dist/services/zeroEx.js:522:19)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async fetchZeroEx (file:///app/dist/services/quoteService.js:24:23)
    at async Promise.all (index 0)
    at async getBestQuote (file:///app/dist/services/quoteService.js:87:5)
    at async executeSellInstant (file:///app/dist/services/tradeExecutor.js:98:22)
    at async file:///app/dist/services/autoTradeService.js:664:30
    at async Promise.all (index 0)
    at async handleTargetSell (file:///app/dist/services/autoTradeService.js:509:5)
    at async handleSwapDetected (file:///app/dist/services/autoTradeService.js:77:9)
[AutoTrade] Step 1 (100%) failed: Failed to get sell quote from any aggregator. Trying Step 2 (99.9%)...
[TradeExecutor] Executing SELL: {
  user: '0xFB64Ce8d',
  tokenToSell: '0xa079903f',
  amountToSell: '1321125936028844742000000',
  chainId: 56
}
[0x API] URL construction: {
  baseUrl: 'https://api.0x.org',
  ZEROX_BASE_URL: 'https://api.0x.org',
  isChainSpecificBaseUrl: false,
  endpoint: '/swap/permit2/quote',
  chainId: 56,
  url: 'https://api.0x.org/swap/permit2/quote?chainId=56&sellToken=0xa079903fe4703376a3b1667bb0ec6ca0121b4444&buyToken=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&sellAmount=1321125936028844742000000&slippageBps=450&taker=0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B',
  params: {
    sellToken: '0xa079903fe4703376a3b1667bb0ec6ca0121b4444',
    buyToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    sellAmount: '1321125936028844742000000',
    slippageBps: '450',
    taker: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B'
  }
}
[0x API] Requesting quote from: https://api.0x.org/swap/permit2/quote?chainId=56&sellToken=0xa079903fe4703376a3b1667bb0ec6ca0121b4444&buyToken=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&sellAmount=1321125936028844742000000&slippageBps=450&taker=0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
[0x API] Quote request details: {
  sellToken: '0xa079903fe4703376a3b1667bb0ec6ca0121b4444',
  buyToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  sellAmount: '1321125936028844742000000',
  slippageBps: 450,
  chainId: 56,
  takerAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B',
  providedTakerAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B',
  endpoint: 'permit2'
}
[Kyber] GET routes {
  routesUrl: 'https://aggregator-api.kyberswap.com/bsc/api/v1/routes?tokenIn=0xa079903fe4703376a3b1667bb0ec6ca0121b4444&tokenOut=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&amountIn=1321125936028844742000000&saveGas=true&gasInclude=true&clientId=kiko-app'
}
[0x API] Quote received successfully
[0x API] Quote response structure: {
  hasTransaction: false,
  hasTo: false,
  hasData: false,
  hasValue: false,
    at async file:///app/dist/services/autoTradeService.js:679:34
  transactionValue: undefined,
    at async Promise.all (index 0)
  usedEndpoint: 'permit2'
    at async handleTargetSell (file:///app/dist/services/autoTradeService.js:509:5)
}
    at async handleSwapDetected (file:///app/dist/services/autoTradeService.js:77:9)
[0x API] Flattened quote data: {
  to: undefined,
  dataLength: undefined,
  value: '0',
  buyAmount: undefined
}
[0x API] ❌ Quote has invalid/missing transaction data: {
  to: undefined,
  dataLength: undefined,
  buyToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  sellToken: '0xa079903fe4703376a3b1667bb0ec6ca0121b4444',
  chainId: 56
}
[0x API] Error fetching quote: Error: 0x API error: No valid swap route found for token 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee. This token may only be tradeable via its native platform (e.g., Four.meme, Pump.fun).
    at getZeroExQuote (file:///app/dist/services/zeroEx.js:522:19)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async fetchZeroEx (file:///app/dist/services/quoteService.js:24:23)
    at async Promise.all (index 0)
    at async getBestQuote (file:///app/dist/services/quoteService.js:87:5)
    at async executeSellInstant (file:///app/dist/services/tradeExecutor.js:98:22)
    at async file:///app/dist/services/autoTradeService.js:679:34
    at async Promise.all (index 0)
    at async handleTargetSell (file:///app/dist/services/autoTradeService.js:509:5)
    at async handleSwapDetected (file:///app/dist/services/autoTradeService.js:77:9)
[QuoteService] 0x failed Error: 0x API error: No valid swap route found for token 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee. This token may only be tradeable via its native platform (e.g., Four.meme, Pump.fun).
    at getZeroExQuote (file:///app/dist/services/zeroEx.js:522:19)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async fetchZeroEx (file:///app/dist/services/quoteService.js:24:23)
    at async Promise.all (index 0)
    at async getBestQuote (file:///app/dist/services/quoteService.js:87:5)
    at async executeSellInstant (file:///app/dist/services/tradeExecutor.js:98:22)
[0x API] URL construction: {
[Kyber] routes error 400 {
  body: {
  baseUrl: 'https://api.0x.org',
    code: 4011,
  ZEROX_BASE_URL: 'https://api.0x.org',
    message: 'token not found',
    details: null,
  isChainSpecificBaseUrl: false,
    requestId: '316c6def-204f-4e0d-beda-50b8903f00a0'
  endpoint: '/swap/permit2/quote',
  }
}
  chainId: 56,
[AutoTrade] Step 2 (99.9%) failed: Failed to get sell quote from any aggregator. Trying Step 3 (fallback 99.5%)...
[TradeExecutor] Executing SELL: {
  url: 'https://api.0x.org/swap/permit2/quote?chainId=56&sellToken=0xa079903fe4703376a3b1667bb0ec6ca0121b4444&buyToken=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&sellAmount=1315836142491191710000000&slippageBps=600&taker=0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B',
  user: '0xFB64Ce8d',
  tokenToSell: '0xa079903f',
  params: {
  amountToSell: '1315836142491191710000000',
    sellToken: '0xa079903fe4703376a3b1667bb0ec6ca0121b4444',
  chainId: 56
    buyToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
}
    sellAmount: '1315836142491191710000000',
    slippageBps: '600',
    taker: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B'
  }
}
[0x API] Requesting quote from: https://api.0x.org/swap/permit2/quote?chainId=56&sellToken=0xa079903fe4703376a3b1667bb0ec6ca0121b4444&buyToken=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&sellAmount=1315836142491191710000000&slippageBps=600&taker=0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
[0x API] Quote request details: {
  sellToken: '0xa079903fe4703376a3b1667bb0ec6ca0121b4444',
  buyToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  sellAmount: '1315836142491191710000000',
  slippageBps: 600,
  chainId: 56,
  takerAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B',
  providedTakerAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B',
  endpoint: 'permit2'
}
[Kyber] GET routes {
  routesUrl: 'https://aggregator-api.kyberswap.com/bsc/api/v1/routes?tokenIn=0xa079903fe4703376a3b1667bb0ec6ca0121b4444&tokenOut=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&amountIn=1315836142491191710000000&saveGas=true&gasInclude=true&clientId=kiko-app'
}
  sellToken: '0xa079903fe4703376a3b1667bb0ec6ca0121b4444',
[0x API] Quote received successfully
  chainId: 56
}
[0x API] Quote response structure: {
[0x API] Error fetching quote: Error: 0x API error: No valid swap route found for token 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee. This token may only be tradeable via its native platform (e.g., Four.meme, Pump.fun).
  hasTransaction: false,
    at getZeroExQuote (file:///app/dist/services/zeroEx.js:522:19)
  hasTo: false,
  hasData: false,
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
  hasValue: false,
    at async fetchZeroEx (file:///app/dist/services/quoteService.js:24:23)
  transactionValue: undefined,
  usedEndpoint: 'permit2'
}
[0x API] Flattened quote data: {
  to: undefined,
  dataLength: undefined,
  value: '0',
  buyAmount: undefined
}
[0x API] ❌ Quote has invalid/missing transaction data: {
  to: undefined,
  dataLength: undefined,
  buyToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    at async Promise.all (index 0)
    at async getBestQuote (file:///app/dist/services/quoteService.js:87:5)
    at async executeSellInstant (file:///app/dist/services/tradeExecutor.js:98:22)
    at async file:///app/dist/services/autoTradeService.js:694:38
    at async Promise.all (index 0)
    at async handleTargetSell (file:///app/dist/services/autoTradeService.js:509:5)
    at async handleSwapDetected (file:///app/dist/services/autoTradeService.js:77:9)
[QuoteService] 0x failed Error: 0x API error: No valid swap route found for token 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee. This token may only be tradeable via its native platform (e.g., Four.meme, Pump.fun).
    at getZeroExQuote (file:///app/dist/services/zeroEx.js:522:19)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async fetchZeroEx (file:///app/dist/services/quoteService.js:24:23)
    at async Promise.all (index 0)
    at async getBestQuote (file:///app/dist/services/quoteService.js:87:5)
    at async executeSellInstant (file:///app/dist/services/tradeExecutor.js:98:22)
    at async file:///app/dist/services/autoTradeService.js:694:38
    at async Promise.all (index 0)
    at async handleTargetSell (file:///app/dist/services/autoTradeService.js:509:5)
    at async handleSwapDetected (file:///app/dist/services/autoTradeService.js:77:9)
[Kyber] routes error 400 {
  body: {
    code: 4011,
    message: 'token not found',
    details: null,
    requestId: '8012d359-126d-41ee-98ff-2b7230460a85'
  }
}
[AutoTrade] All sell steps failed for EVM: Failed to get sell quote from any aggregator
incoming request
[DEBUG] onResponse: OPTIONS /api/wallets/0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B/balance?chain=bsc -> 204
request completed
[DEBUG] onResponse: OPTIONS /api/copy-trade/configs -> 204
incoming request
request completed
incoming request
[DEBUG] onRequest: GET /api/wallets/0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B/balance?chain=bsc
[DEBUG] onRequest: GET /api/copy-trade/configs
incoming request
[Alchemy] API Key loaded: Cmrwi...
[CopyTrade] GET /configs - Fetching configs for user did:privy:cmk74yj4r03jcl70b8hwyuh2c
[DEBUG] onResponse: GET /api/copy-trade/configs -> 200
request completed
incoming request
[DEBUG] onRequest: GET /api/chat/ws?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwUEFsR2FodWVyZEVTbWZjX01aOFltc2twWWlRZHJrRTQ5MENUbnJTVnMifQ.eyJzaWQiOiJjbWs3eDhlMHcwMDN4ankwY21ocXBzZjVnIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NjgxMTcwODcsImF1ZCI6ImNtaTJzcGwwdzAydzBsNzBjcmVjd3Y3bDMiLCJzdWIiOiJkaWQ6cHJpdnk6Y21rNzR5ajRyMDNqY2w3MGI4aHd5dWgyYyIsImV4cCI6MTc2ODEyMDY4N30.vF9RFKb2kDQkFlo7HnolsaxBqFj5onewgQzWgWbQ0P9ijRKHmGSDk4YEkc9CkVsVMMqDx9aQYwXK3E8uMr6pEw
[ChatWS] Client connected for user did:privy:cmk74yj4r03jcl70b8hwyuh2c. Total connections for user: 1
[AutoTrade] getTokenInfo: Fetching 0xadb3401cb081b82c2e8a79658c91d7c8e2084444 (Chain: 56, Jitter: 457ms)
[AutoTrade] getTokenInfo: Success (DexScreener) - 二妈 $0.000005239
[DexScreener] Fetching token details: https://api.dexscreener.com/latest/dex/tokens/0x063ce89785d06fb7eed0c07c1a28ee9ed43d4444
[DexScreener] Fetching token details: https://api.dexscreener.com/latest/dex/tokens/0x1756c3091201800ae7b820e5faddf3fc2ab676be
[DexScreener] Fetching token details: https://api.dexscreener.com/latest/dex/tokens/0x4bbaea77f00ac844033775d791f893158e154444
[DexScreener] Fetching token details: https://api.dexscreener.com/latest/dex/tokens/0x581466363fe17a02ac89f354cb0f4ec3186574df
[DexScreener] Fetching token details: https://api.dexscreener.com/latest/dex/tokens/0x6513e79162379943ae168ae84cbca16e75c354a4
[DexScreener] Fetching token details: https://api.dexscreener.com/latest/dex/tokens/0x72d69ceb0c045974d46bf1206959a0e9ef98b021
[DexScreener] Fetching token details: https://api.dexscreener.com/latest/dex/tokens/0x856f36cc386573c4ac5f52d6c908cc11f0314444
[DexScreener] Fetching token details: https://api.dexscreener.com/latest/dex/tokens/0x8b8db113d58009510c298d73ea0d3fa144e74444
[DexScreener] Fetching token details: https://api.dexscreener.com/latest/dex/tokens/0xa079903fe4703376a3b1667bb0ec6ca0121b4444
[DexScreener] Fetching token details: https://api.dexscreener.com/latest/dex/tokens/0xb9d60d405aa31d513861eaf98cbe0b724116a5df
[DexScreener] Found 1 pairs for 0x4bbaea77f00ac844033775d791f893158e154444
[AutoTrade] getTokenInfo: Fetching 0x22574f4ffb69755f820d37abe3074439ad484444 (Chain: 56, Jitter: 268ms)
[DexScreener] Found 1 pairs for 0x6513e79162379943ae168ae84cbca16e75c354a4
[DexScreener] Found 1 pairs for 0xa079903fe4703376a3b1667bb0ec6ca0121b4444
[DexScreener] Found 1 pairs for 0xb9d60d405aa31d513861eaf98cbe0b724116a5df
[DexScreener] Found 1 pairs for 0x581466363fe17a02ac89f354cb0f4ec3186574df


Log Explorer | Railway