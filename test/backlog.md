[api] [Solana Token Metadata] ✓ Found token SOL via https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json
[api] [Solana Token Metadata] ✓ Found token USDC via https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json
[api] [handleSolanaQuote] Token metadata: {
[api]   tokenIn: 'So11111111111111111111111111111111111111112',
[api]   tokenInSymbol: 'SOL',
[api]   tokenInDecimals: 9,
[api]   tokenOut: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
[api]   tokenOutSymbol: 'USDC',
[api]   tokenOutDecimals: 6
[api] }
[api] {"level":30,"time":1768584937566,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-l","res":{"statusCode":200},"responseTime":253.1621249988675,"msg":"request completed"}
[api] [handleSolanaQuote] Error checking on-chain balance: Error: failed to get balance of account BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg: TypeError: fetch failed
[api]     at e (/Users/almurat/KiKo/kiko-api/node_modules/@solana/web3.js/src/connection.ts:3330:15)
[api]     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
[api]     at async Connection.getBalance (/Users/almurat/KiKo/kiko-api/node_modules/@solana/web3.js/src/connection.ts:3327:12)
[api]     at async handleSolanaQuote (/Users/almurat/KiKo/kiko-api/src/routes/swap.ts:1626:37)
[api] [handleSolanaQuote] Request body userAddress: BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg
[api] [handleSolanaQuote] userAddress type: string
[api] [handleSolanaQuote] userAddress length: 44
[api] [Solana Swap] Fetching multiple quotes in parallel (Price-First strategy)...
[api] [Jupiter Ultra] Fetching order/quote...
[api] [TokenJob] Tokens for Optimism are fresh, skipping API call
[api] [Jupiter API] Quote took 1414ms
[api] [TokenJob] Tokens for Polygon are fresh, skipping API call
[api] [TokenJob] Refreshed 7 chains in 39.8s
[api] [TokenJob] Tokens for Polygon are fresh, skipping API call
[api] [TokenJob] Refreshed 7 chains in 39.9s
[api] [Raydium API] Quote took 7595ms
[api] [Solana Swap] Selected raydium as best route (7598ms)
[api] [Solana Swap] Building transaction for best quote (raydium)...
[api] [Raydium API] Transaction response: {
[api]   success: true,
[api]   hasData: true,
[api]   dataLength: 1,
[api]   fullResponse: '{"id":"f17d4f58-3fa6-435c-b63b-2eda71ab551a-tx","version":"V1","success":true,"data":[{"transaction":"AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAQADHJ6rH+MB0IPE9giy0W73t6CrXbbR+8sZbbBDTzGx0bAPpur3kjWajn1FTxzZd1mZamKwV98lmAeY6xeOWhoxQi8Gm4hX/quBhPtof2NGGMA12sQ53BrrO1WYoPAAAAAAASBP9b0sllbEBYZ+8YzKuGg4nvaWXo4O+LBi+pQV1k/NNC/9nVaxi+uEXqp3p1FoPwQSoa0yIbevLxkcg9GGOYql2im0Npk/3StXce4hKvHkz47/1EyTizeo+f3+znRUx4XEs508VZ4LmiCcYmZAJ7qw5p9zFkdDwthi4IadiiahSATeS0'
[api] }
[api] [Solana Swap] Best quote with transaction complete (7993ms)
[api] [handleSolanaQuote] Final calculation: {
[api]   outAmountBase: '142663',
[api]   tokenOutDecimals: 6,
[api]   outAmountHuman: 0.142663,
[api]   calculation: '142663 / 10^6 = 0.142663'
[api] }
[api] {"level":30,"time":1768584946152,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-i","res":{"statusCode":200},"responseTime":11094.91224999912,"msg":"request completed"}
[api] {"level":30,"time":1768584946332,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","req":{"method":"OPTIONS","url":"/api/rpc/solana","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50163},"msg":"incoming request"}
[api] {"level":30,"time":1768584946333,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-m","res":{"statusCode":204},"responseTime":0.7159160003066063,"msg":"request completed"}
[api] {"level":30,"time":1768584946335,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","req":{"method":"POST","url":"/api/rpc/solana","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50186},"msg":"incoming request"}
[api] {"level":30,"time":1768584946898,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","req":{"method":"OPTIONS","url":"/api/swap/execute-instant","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50185},"msg":"incoming request"}
[api] {"level":30,"time":1768584946899,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-o","res":{"statusCode":204},"responseTime":1.0775419995188713,"msg":"request completed"}
[api] {"level":30,"time":1768584946902,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-p","req":{"method":"POST","url":"/api/swap/execute-instant","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50163},"msg":"incoming request"}
[api] [PrivyWallet] Authorization Key config: {
[api]   keyFormat: 'wallet-auth',
[api]   keyLength: 196,
[api]   keyIdConfigured: true,
[api]   keyId: 'crdgro3bw0...'
[api] }
[api] {"level":30,"time":1768584947371,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-n","res":{"statusCode":200},"responseTime":1036.1064580008388,"msg":"request completed"}
[api] {"level":30,"time":1768584947382,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","req":{"method":"POST","url":"/api/rpc/solana","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50185},"msg":"incoming request"}
[api] {"level":30,"time":1768584947638,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-q","res":{"statusCode":200},"responseTime":256.3740839995444,"msg":"request completed"}
[api] [Swap Execute Instant] Starting swap: {
[api]   userId: 'did:privy:',
[api]   wallet: '0xA386bc9D',
[api]   tokenIn: 'So11111111',
[api]   tokenOut: 'EPjFWdd5Au',
[api]   amountIn: '0.001',
[api]   chainId: 900
[api] }
[api] [TokenDetector] Searching for token globally: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
[api] [LaunchpadDetector] Token EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v missing API indicators. Checking on-chain metadata...
[api] [LaunchpadDetector] Token EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v found on Raydium but missing LaunchLab indicators and on-chain Auth mismatch. Ignoring.
[api] [LaunchpadDetector] PumpPortal fallback failed with status 404
[api] [LaunchpadDetector] Raydium fallback found token EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v but Program ID TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA mismatch (expected Pump.fun). Ignoring.
[api] [TokenDetector] Found token: USDC on Solana (900)
[api] [Swap Execute Instant] Solana token launchpad: null
[api] [Swap Execute Instant] Standard Solana token, using Jupiter aggregator...
[api] [Solana Token Metadata] ✓ Found token SOL via https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json
[api] [Solana Token Metadata] ✓ Found token USDC via https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json
[api] [Swap Execute Instant] Token metadata: {
[api]   tokenIn: 'So11111111111111111111111111111111111111112',
[api]   tokenInDecimals: 9,
[api]   tokenOut: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
[api]   tokenOutDecimals: 6
[api] }
[api] {"level":30,"time":1768584956333,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","req":{"method":"OPTIONS","url":"/api/rpc/solana","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50186},"msg":"incoming request"}
[api] {"level":30,"time":1768584956334,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-r","res":{"statusCode":204},"responseTime":0.8436670005321503,"msg":"request completed"}
[api] {"level":30,"time":1768584956336,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","req":{"method":"POST","url":"/api/rpc/solana","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50185},"msg":"incoming request"}
[api] [PrivyWallet] Found delegated Solana wallet for user: { address: 'BgNm4YDzxb...', id: 'g12d93bd9p...' }
[api] [SolanaExecutor] Using user's delegated wallet: BgNm4YDzxb...
[api] [SolanaExecutor] Executing Swap: 1000000 of So11111111111111111111111111111111111111112 -> EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v using auto-router...
[api] [Solana Swap] Fetching multiple quotes in parallel (Price-First strategy)...
[api] [Jupiter Ultra] Fetching order/quote...
[api] {"level":30,"time":1768584957392,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-s","res":{"statusCode":200},"responseTime":1055.256875000894,"msg":"request completed"}
[api] {"level":30,"time":1768584957402,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","req":{"method":"POST","url":"/api/rpc/solana","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50186},"msg":"incoming request"}
[api] {"level":30,"time":1768584957678,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-t","res":{"statusCode":200},"responseTime":275.48429099842906,"msg":"request completed"}
[api] [Jupiter API] Quote took 1387ms
[api] [PositionMonitor] 🔄 Running position check...
[api] [PositionMonitor] No open positions to check
[api] [Raydium API] Quote took 7652ms
[api] [Solana Swap] Selected jupiter as best route (7656ms)
[api] [Solana Swap] Building transaction for best quote (jupiter)...
[api] [Solana Swap] Best quote with transaction complete (8775ms)
[api] [SolanaExecutor] Swap prepared via jupiter (Out: 142657)
[api] [SolanaExecutor] Refreshing blockhash before sending...
[api] [SolanaExecutor] Fresh blockhash: 4RSXnG6VCxvT1pHanrA2eMxZHUCDN9nZrKbvdXajECSn
[api] {"level":30,"time":1768584966334,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-u","req":{"method":"OPTIONS","url":"/api/rpc/solana","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50185},"msg":"incoming request"}
[api] {"level":30,"time":1768584966335,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-u","res":{"statusCode":204},"responseTime":0.6296249981969595,"msg":"request completed"}
[api] {"level":30,"time":1768584966339,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-v","req":{"method":"POST","url":"/api/rpc/solana","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50186},"msg":"incoming request"}
[api] {"level":30,"time":1768584967383,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-v","res":{"statusCode":200},"responseTime":1044.7465830016881,"msg":"request completed"}
[api] {"level":30,"time":1768584967393,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","req":{"method":"POST","url":"/api/rpc/solana","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50185},"msg":"incoming request"}
[api] [PrivyWallet] Found delegated Solana wallet for user: { address: 'BgNm4YDzxb...', id: 'g12d93bd9p...' }
[api] [PrivyWallet] Sending Solana transaction: {
[api]   walletSource: 'delegated',
[api]   walletId: 'g12d93bd9p...',
[api]   walletAddress: 'BgNm4YDzxb...',
[api]   userId: 'did:privy:...'
[api] }
[api] {"level":30,"time":1768584967690,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-w","res":{"statusCode":200},"responseTime":296.79012499935925,"msg":"request completed"}
[api] [PrivyWallet] Solana transaction sent: 29GjHJnZx3Dpm7DxPKUdPLGiEAYK2766C95yfiLs7yFCMcEQcnN5fXTxrWFmwzoYV9c1WSr9VmpwtNFUxErp7JZg
[api] [SolanaExecutor] Transaction sent: 29GjHJnZx3Dpm7DxPKUdPLGiEAYK2766C95yfiLs7yFCMcEQcnN5fXTxrWFmwzoYV9c1WSr9VmpwtNFUxErp7JZg. Confirming...
[api] [SolanaExecutor] Polling for confirmation (max 30s)...
[api] [SolanaExecutor] ✅ Swap confirmed: https://solscan.io/tx/29GjHJnZx3Dpm7DxPKUdPLGiEAYK2766C95yfiLs7yFCMcEQcnN5fXTxrWFmwzoYV9c1WSr9VmpwtNFUxErp7JZg
[api] [Solana Token Metadata] ✓ Found token SOL via https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json
[api] [Solana Token Metadata] ✓ Found token USDC via https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json
[api] [handleSolanaQuote] Token metadata: {
[api]   tokenIn: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
[api]   tokenInSymbol: 'USDC',
[api]   tokenInDecimals: 6,
[api]   tokenOut: 'So11111111111111111111111111111111111111112',
[api]   tokenOutSymbol: 'SOL',
[api]   tokenOutDecimals: 9
[api] }
[api] [handleSolanaQuote] Error checking on-chain balance: Error: failed to get balance of account BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg: TypeError: fetch failed
[api]     at e (/Users/almurat/KiKo/kiko-api/node_modules/@solana/web3.js/src/connection.ts:3330:15)
[api]     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
[api]     at async Connection.getBalance (/Users/almurat/KiKo/kiko-api/node_modules/@solana/web3.js/src/connection.ts:3327:12)
[api]     at async handleSolanaQuote (/Users/almurat/KiKo/kiko-api/src/routes/swap.ts:1626:37)
[api] [handleSolanaQuote] Request body userAddress: BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg
[api] [handleSolanaQuote] userAddress type: string
[api] [handleSolanaQuote] userAddress length: 44
[api] [Solana Swap] Fetching multiple quotes in parallel (Price-First strategy)...
[api] [Jupiter Ultra] Fetching order/quote...
[api] [PositionMonitor] 🔄 Running position check...
[api] [PositionMonitor] No open positions to check
[api] [Jupiter API] Quote took 1412ms
[api] {"level":30,"time":1768584997043,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-17","req":{"method":"OPTIONS","url":"/api/rpc/solana","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50185},"msg":"incoming request"}
[api] {"level":30,"time":1768584997043,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-17","res":{"statusCode":204},"responseTime":0.38416700065135956,"msg":"request completed"}
[api] {"level":30,"time":1768584997045,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-18","req":{"method":"POST","url":"/api/rpc/solana","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50186},"msg":"incoming request"}
[api] {"level":30,"time":1768584998061,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-18","res":{"statusCode":200},"responseTime":1016.4425000008196,"msg":"request completed"}
[api] {"level":30,"time":1768584998072,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-19","req":{"method":"POST","url":"/api/rpc/solana","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50185},"msg":"incoming request"}
[api] {"level":30,"time":1768584998332,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-19","res":{"statusCode":200},"responseTime":260.2635420002043,"msg":"request completed"}
[api] [Raydium API] Quote took 6777ms
[api] [Solana Swap] Selected raydium as best route (6780ms)
[api] [Solana Swap] Building transaction for best quote (raydium)...
[api] [Raydium API] Transaction response: {
[api]   success: true,
[api]   hasData: true,
[api]   dataLength: 1,
[api]   fullResponse: '{"id":"7687e619-44ce-4bf9-84a7-a64c858c4fa9-tx","version":"V1","success":true,"data":[{"transaction":"AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAQAEGZ6rH+MB0IPE9giy0W73t6CrXbbR+8sZbbBDTzGx0bAPIE/1vSyWVsQFhn7xjMq4aDie9pZejg74sGL6lBXWT82m6veSNZqOfUVPHNl3WZlqYrBX3yWYB5jrF45aGjFCLw1ETyYmkDLFnbceWX9j1AcvTjCp0R3JmS7eDNzT7Xvexvp6877brTo9ZfNqq8l0MbG75MLS9uDkfKYCA0UvXWH2w9QHWArxhadRhsCPeyRTrnkPzcRYUdW5LWxvx73JOIFuZmMMO7ck3Fnkn2zEMG5gOmqsygb6PjTitArVl52NvghH06'
[api] }
[api] [Solana Swap] Best quote with transaction complete (7220ms)
[api] [handleSolanaQuote] Final calculation: {
[api]   outAmountBase: '1023926',
[api]   tokenOutDecimals: 9,
[api]   outAmountHuman: 0.001023926,
[api]   calculation: '1023926 / 10^9 = 0.001023926'
[api] }
[api] {"level":30,"time":1768585000109,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-16","res":{"statusCode":200},"responseTime":10347.941666999832,"msg":"request completed"}
[api] {"level":30,"time":1768585000868,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1a","req":{"method":"OPTIONS","url":"/api/swap/execute-instant","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50186},"msg":"incoming request"}
[api] {"level":30,"time":1768585000868,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1a","res":{"statusCode":204},"responseTime":0.3655830007046461,"msg":"request completed"}
[api] {"level":30,"time":1768585000870,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1b","req":{"method":"POST","url":"/api/swap/execute-instant","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50185},"msg":"incoming request"}
[api] [Swap Execute Instant] Starting swap: {
[api]   userId: 'did:privy:',
[api]   wallet: '0xA386bc9D',
[api]   tokenIn: 'EPjFWdd5Au',
[api]   tokenOut: 'So11111111',
[api]   amountIn: '0.144613',
[api]   chainId: 900
[api] }
[api] [TokenDetector] Searching for token globally: So11111111111111111111111111111111111111112
[api] [LaunchpadDetector] Token So11111111111111111111111111111111111111112 missing API indicators. Checking on-chain metadata...
[api] [LaunchpadDetector] Token So11111111111111111111111111111111111111112 found on Raydium but missing LaunchLab indicators and on-chain Auth mismatch. Ignoring.
[api] [LaunchpadDetector] PumpPortal fallback failed with status 404
[api] [LaunchpadDetector] Raydium fallback found token So11111111111111111111111111111111111111112 but Program ID TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA mismatch (expected Pump.fun). Ignoring.
[api] [TokenDetector] Found token: SOL on Solana (900)
[api] [Swap Execute Instant] Solana token launchpad: null
[api] [Swap Execute Instant] Standard Solana token, using Jupiter aggregator...
[api] {"level":30,"time":1768585007047,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1c","req":{"method":"OPTIONS","url":"/api/rpc/solana","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50163},"msg":"incoming request"}
[api] {"level":30,"time":1768585007048,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1c","res":{"statusCode":204},"responseTime":0.4585839994251728,"msg":"request completed"}
[api] {"level":30,"time":1768585007050,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1d","req":{"method":"POST","url":"/api/rpc/solana","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50186},"msg":"incoming request"}
[api] {"level":30,"time":1768585008051,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1d","res":{"statusCode":200},"responseTime":1000.2582079991698,"msg":"request completed"}
[api] {"level":30,"time":1768585008058,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1e","req":{"method":"POST","url":"/api/rpc/solana","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50163},"msg":"incoming request"}
[api] {"level":30,"time":1768585008333,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1e","res":{"statusCode":200},"responseTime":274.681583000347,"msg":"request completed"}
[api] [Solana Token Metadata] ✓ Found token USDC via https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json
[api] [Solana Token Metadata] ✓ Found token SOL via https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json
[api] [Swap Execute Instant] Token metadata: {
[api]   tokenIn: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
[api]   tokenInDecimals: 6,
[api]   tokenOut: 'So11111111111111111111111111111111111111112',
[api]   tokenOutDecimals: 9
[api] }
[api] [PrivyWallet] Found delegated Solana wallet for user: { address: 'BgNm4YDzxb...', id: 'g12d93bd9p...' }
[api] [SolanaExecutor] Using user's delegated wallet: BgNm4YDzxb...
[api] [SolanaExecutor] Executing Swap: 144613 of EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v -> So11111111111111111111111111111111111111112 using auto-router...
[api] [Solana Swap] Fetching multiple quotes in parallel (Price-First strategy)...
[api] [Jupiter Ultra] Fetching order/quote...
[api] [Jupiter API] Quote took 1409ms
[api] [Raydium API] Quote took 6675ms
[api] [Solana Swap] Selected raydium as best route (6679ms)
[api] [Solana Swap] Building transaction for best quote (raydium)...
[api] {"level":30,"time":1768585017049,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1f","req":{"method":"OPTIONS","url":"/api/rpc/solana","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50186},"msg":"incoming request"}
[api] {"level":30,"time":1768585017049,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1f","res":{"statusCode":204},"responseTime":0.4175840001553297,"msg":"request completed"}
[api] {"level":30,"time":1768585017052,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1g","req":{"method":"POST","url":"/api/rpc/solana","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50163},"msg":"incoming request"}
[api] [Raydium API] Transaction response: {
[api]   success: true,
[api]   hasData: true,
[api]   dataLength: 1,
[api]   fullResponse: '{"id":"6da3c8e1-a1bc-47f5-8320-b2b2f5729af5-tx","version":"V1","success":true,"data":[{"transaction":"AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAQAEGZ6rH+MB0IPE9giy0W73t6CrXbbR+8sZbbBDTzGx0bAPIE/1vSyWVsQFhn7xjMq4aDie9pZejg74sGL6lBXWT82m6veSNZqOfUVPHNl3WZlqYrBX3yWYB5jrF45aGjFCLw1ETyYmkDLFnbceWX9j1AcvTjCp0R3JmS7eDNzT7Xvexvp6877brTo9ZfNqq8l0MbG75MLS9uDkfKYCA0UvXWH2w9QHWArxhadRhsCPeyRTrnkPzcRYUdW5LWxvx73JOIFuZmMMO7ck3Fnkn2zEMG5gOmqsygb6PjTitArVl52NvghH06'
[api] }
[api] [Solana Swap] Best quote with transaction complete (7065ms)
[api] [SolanaExecutor] Swap prepared via raydium (Out: 1023926)
[api] [SolanaExecutor] Refreshing blockhash before sending...
[api] {"level":30,"time":1768585018042,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1g","res":{"statusCode":200},"responseTime":989.830957999453,"msg":"request completed"}
[api] {"level":30,"time":1768585018053,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1h","req":{"method":"POST","url":"/api/rpc/solana","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":50186},"msg":"incoming request"}
[api] {"level":30,"time":1768585018322,"pid":7640,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-1h","res":{"statusCode":200},"responseTime":268.43412500061095,"msg":"request completed"}
[api] [SolanaExecutor] Fresh blockhash: 5x34EoZc5gViqJMjMM39DWUhs6Lzx17BQbjNhswM52Gb
[api] [PrivyWallet] Found delegated Solana wallet for user: { address: 'BgNm4YDzxb...', id: 'g12d93bd9p...' }
[api] [PrivyWallet] Sending Solana transaction: {
[api]   walletSource: 'delegated',
[api]   walletId: 'g12d93bd9p...',
[api]   walletAddress: 'BgNm4YDzxb...',
[api]   userId: 'did:privy:...'
[api] }
[api] [PrivyWallet] Solana transaction sent: 2sp8G6qbFTENSTiLFEvcFAkgXRQXefFP3c2rW4s92jmn27N6BKFAFAaT8s6Ec9Pdtog81yirq39LNmp7jp72wB3j
[api] [SolanaExecutor] Transaction sent: 2sp8G6qbFTENSTiLFEvcFAkgXRQXefFP3c2rW4s92jmn27N6BKFAFAaT8s6Ec9Pdtog81yirq39LNmp7jp72wB3j. Confirming...
[api] [SolanaExecutor] Polling for confirmation (max 30s)...
[api] [SolanaExecutor] ✅ Swap confirmed: https://solscan.io/tx/2sp8G6qbFTENSTiLFEvcFAkgXRQXefFP3c2rW4s92jmn27N6BKFAFAaT8s6Ec9Pdtog81yirq39LNmp7jp72wB3j
