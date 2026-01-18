[api] [PrepareSwapTransaction] Preparing swap: {
[api]   token_in: 'SOL',
[api]   token_out: 'USDC',
[api]   amount_in: '0.01',
[api]   chain_id: 900,
[api]   execute: true
[api] }
[api] [PrepareSwapTransaction] Execution Decision: {
[api]   argsExecute: true,
[api]   swapMethod: 'allowance_trade',
[api]   fastSwapMode: false,
[api]   finalDecision: true
[api] }
[api] [PrepareSwapTransaction] Executing backend swap via internal API...
[api] {"level":30,"time":1768733754828,"pid":21719,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4b","req":{"method":"POST","url":"/api/swap/execute-instant","hostname":"127.0.0.1:3001","remoteAddress":"127.0.0.1","remotePort":53667},"msg":"incoming request"}
[api] {"timestamp":"2026-01-18T10:55:55.977Z","level":"ERROR","code":"API-5002","message":"API error on trending page","metadata":{"page":2,"status":429,"statusText":"Too Many Requests"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-18T10:55:55.977Z","level":"INFO","code":"API-5001","message":"Trending tokens fetch complete","metadata":{"network":"bsc","count":14,"limit":200},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-18T10:55:55.978Z","level":"INFO","code":"API-5001","message":"Premium trending tokens fetch complete","metadata":{"count":87,"chain":"bsc","durationMs":10732},"service":"kiko-api","env":"production"}
[api] [TokenJob] Got 87 trending tokens for BSC
[api] [Swap Execute Instant] Starting swap: {
[api]   userId: 'did:privy:',
[api]   wallet: '0xA386bc9D',
[api]   tokenIn: 'SOL',
[api]   tokenOut: 'USDC',
[api]   amountIn: '0.01',
[api]   chainId: 900
[api] }
[api] Saved 87 trending tokens for bsc to database and memory cache
[api] [TokenJob] Saved 87 tokens for BSC to DB + cache
[api] [Swap Execute Instant] Solana token launchpad: null
[api] [Swap Execute Instant] Standard Solana token, using Jupiter aggregator...
[api] {"level":30,"time":1768733758785,"pid":21719,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4c","req":{"method":"POST","url":"/api/swap/quote","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":53678},"msg":"incoming request"}
[api] [Solana Token Metadata] Token not in list https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json: SOL
[api] [Solana Token Metadata] Source failed, trying next: https://tokens.jup.ag/tokens?tags=verified TypeError: fetch failed
[api]     at node:internal/deps/undici/undici:14900:13
[api]     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
[api]     at async getSolanaTokenMetadata (/Users/almurat/KiKo/kiko-api/src/utils/solanaToken.ts:55:24)
[api]     at async Object.<anonymous> (/Users/almurat/KiKo/kiko-api/src/routes/swap.ts:860:45) {
[api]   [cause]: Error: getaddrinfo ENOTFOUND tokens.jup.ag
[api]       at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)
[api]       at GetAddrInfoReqWrap.callbackTrampoline (node:internal/async_hooks:130:17) {
[api]     errno: -3008,
[api]     code: 'ENOTFOUND',
[api]     syscall: 'getaddrinfo',
[api]     hostname: 'tokens.jup.ag'
[api]   }
[api] }
[api] [Solana Token Metadata] Token not in list https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json: SOL
[api] [Solana Token Metadata] Token not in list https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json: 7ZxtHYVm1PPq5s161ExQ6gN5zvrabXEHwtWSYwBWpump
[api] [Solana Token Metadata] ✓ Found token SOL via https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json
[api] [Solana Token Metadata] Source failed, trying next: https://tokens.jup.ag/tokens?tags=verified TypeError: fetch failed
[api]     at node:internal/deps/undici/undici:14900:13
[api]     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
[api]     at async getSolanaTokenMetadata (/Users/almurat/KiKo/kiko-api/src/utils/solanaToken.ts:55:24)
[api]     at async Promise.all (index 1)
[api]     at async handleSolanaQuote (/Users/almurat/KiKo/kiko-api/src/routes/swap.ts:1582:53) {
[api]   [cause]: Error: getaddrinfo ENOTFOUND tokens.jup.ag
[api]       at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)
[api]       at GetAddrInfoReqWrap.callbackTrampoline (node:internal/async_hooks:130:17) {
[api]     errno: -3008,
[api]     code: 'ENOTFOUND',
[api]     syscall: 'getaddrinfo',
[api]     hostname: 'tokens.jup.ag'
[api]   }
[api] }
[api] [TokenJob] Fetching trending tokens for Arbitrum via DexScreener Premium...
[api] {"timestamp":"2026-01-18T10:56:01.031Z","level":"INFO","code":"API-5001","message":"Fetching premium trending tokens","metadata":{"chain":"arbitrum","limit":100},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-18T10:56:01.031Z","level":"INFO","code":"API-5001","message":"Using fallback discovery (Boosts + Organic search)","metadata":{},"service":"kiko-api","env":"production"}
[api] [Solana Token Metadata] Token not in list https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json: 7ZxtHYVm1PPq5s161ExQ6gN5zvrabXEHwtWSYwBWpump
[api] [Solana Token Metadata] Token not in list https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json: SOL
[api] [Solana Token Metadata] No metadata found for token: SOL
[api] [Solana Token Metadata] Token not in list https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json: USDC
[api] [Solana Token Metadata] Source failed, trying next: https://tokens.jup.ag/tokens?tags=verified TypeError: fetch failed
[api]     at node:internal/deps/undici/undici:14900:13
[api]     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
[api]     at async getSolanaTokenMetadata (/Users/almurat/KiKo/kiko-api/src/utils/solanaToken.ts:55:24)
[api]     at async Object.<anonymous> (/Users/almurat/KiKo/kiko-api/src/routes/swap.ts:861:46) {
[api]   [cause]: Error: getaddrinfo ENOTFOUND tokens.jup.ag
[api]       at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)
[api]       at GetAddrInfoReqWrap.callbackTrampoline (node:internal/async_hooks:130:17) {
[api]     errno: -3008,
[api]     code: 'ENOTFOUND',
[api]     syscall: 'getaddrinfo',
[api]     hostname: 'tokens.jup.ag'
[api]   }
[api] }
[api] [Solana Token Metadata] Token not in list https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json: USDC
[api] [Solana Token Metadata] Token not in list https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json: USDC
[api] [Solana Token Metadata] No metadata found for token: USDC
[api] [Swap Execute Instant] Token metadata: {
[api]   tokenIn: 'SOL',
[api]   tokenInDecimals: 6,
[api]   tokenOut: 'USDC',
[api]   tokenOutDecimals: 6
[api] }
[api] {"timestamp":"2026-01-18T10:56:03.677Z","level":"INFO","code":"EXE-4002","message":"SolanaExecutor: Executing Swap","metadata":{"traceId":"15883334-869b-4a70-8896-6c2325df9be9","tokenInMint":"SOL","tokenOutMint":"USDC","amountIn":"10000"},"service":"kiko-api","env":"production"}
[api] [Solana Token Metadata] Token not in list https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json: 7ZxtHYVm1PPq5s161ExQ6gN5zvrabXEHwtWSYwBWpump
[api] [Solana Token Metadata] No metadata found for token: 7ZxtHYVm1PPq5s161ExQ6gN5zvrabXEHwtWSYwBWpump
[api] [handleSolanaQuote] Token metadata: {
[api]   tokenIn: 'So11111111111111111111111111111111111111112',
[api]   tokenInSymbol: 'SOL',
[api]   tokenInDecimals: 9,
[api]   tokenOut: '7ZxtHYVm1PPq5s161ExQ6gN5zvrabXEHwtWSYwBWpump',
[api]   tokenOutSymbol: 'UNKNOWN',
[api]   tokenOutDecimals: 6
[api] }
[api] [handleSolanaQuote] Request body userAddress: undefined
[api] [handleSolanaQuote] userAddress type: undefined
[api] [handleSolanaQuote] userAddress length: undefined
[api] {"timestamp":"2026-01-18T10:56:04.657Z","level":"ERROR","code":"API-5002","message":"Jupiter API request failed","metadata":{"traceId":"15883334-869b-4a70-8896-6c2325df9be9","status":400,"error":"{\"error\":\"Invalid inputMint\"}"},"service":"kiko-api","env":"production"}
[api] {"timestamp":"2026-01-18T10:56:04.667Z","level":"ERROR","code":"API-5002","message":"Solana Swap: No valid quotes found from any aggregator","metadata":{"traceId":"15883334-869b-4a70-8896-6c2325df9be9"},"service":"kiko-api","env":"production"}
[api] [Swap Execute Instant] Error: AppError: Solana Swap Failed: No valid quotes found from Jupiter or Raydium
[api]     at executeSolanaSwap (/Users/almurat/KiKo/kiko-api/src/services/solanaExecutor.ts:52:15)
[api]     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
[api]     at async Object.<anonymous> (/Users/almurat/KiKo/kiko-api/src/routes/swap.ts:876:36) {
[api]   statusCode: 400,
[api]   code: 'QUOTE_FAILED',
[api]   logCode: 'SYS-1001',
[api]   isOperational: true
[api] }
[api] [Error Handler] {
[api]   "requestId": "req-4b",
[api]   "method": "POST",
[api]   "url": "/api/swap/execute-instant",
[api]   "ip": "127.0.0.1",
[api]   "error": {
[api]     "message": "Solana Swap Failed: No valid quotes found from Jupiter or Raydium",
[api]     "name": "Error",
[api]     "code": "QUOTE_FAILED",
[api]     "statusCode": 400
[api]   }
[api] }
[api] {"level":30,"time":1768733764669,"pid":21719,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-4b","res":{"statusCode":400},"responseTime":9840.83912499994,"msg":"request completed"}
[api] [PrepareSwapTransaction] Backend swap failed: Solana Swap Failed: No valid quotes found from Jupiter or Raydium
