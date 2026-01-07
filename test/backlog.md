[api] prisma:error Error in PostgreSQL connection: Error { kind: Closed, cause: None }
[api] prisma:error Error in PostgreSQL connection: Error { kind: Closed, cause: None }
[api] {"level":30,"time":1767790025995,"pid":17456,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-gv","req":{"method":"OPTIONS","url":"/api/copy-trade/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55386},"msg":"incoming request"}
[api] {"level":30,"time":1767790025996,"pid":17456,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-gv","res":{"statusCode":204},"responseTime":0.47220899909734726,"msg":"request completed"}
[api] {"level":30,"time":1767790025997,"pid":17456,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-gw","req":{"method":"GET","url":"/api/copy-trade/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55386},"msg":"incoming request"}
[api] [CopyTrade] GET /configs - Fetching configs for user did:privy:cmj0a3j3f005fl20c4xkl7195
[api] prisma:error 
[api] Invalid `prisma.aITask.findMany()` invocation:
[api] 
[api] 
[api] Server has closed the connection.
[api] [Prisma] Connection issue detected (P1017), retry 1/3...
[api] prisma:error 
[api] Invalid `prisma.aITask.findMany()` invocation:
[api] 
[api] 
[api] Server has closed the connection.
[api] [Prisma] Connection issue detected (P1017), retry 2/3...
[api] prisma:error 
[api] Invalid `prisma.qualityFarcasterUser.update()` invocation:
[api] 
[api] 
[api] An operation failed because it depends on one or more records that were required but not found. Record to update not found.
[api] [QualityUsersRepo] Error updating coin status for FID 9218: PrismaClientKnownRequestError: 
[api] Invalid `prisma.qualityFarcasterUser.update()` invocation:
[api] 
[api] 
[api] An operation failed because it depends on one or more records that were required but not found. Record to update not found.
[api]     at $n.handleRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:7315)
[api]     at $n.handleAndLogRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6623)
[api]     at $n.request (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6307)
[api]     at async l (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:130:9633)
[api]     at async withRetry (file:///Users/almurat/KiKo/kiko-api/src/db/prisma.ts:1:1299)
[api]     at async Object.updateUserCoinStatus (file:///Users/almurat/KiKo/kiko-api/src/repositories/qualityUsersRepository.ts:1:2616)
[api]     at async file:///Users/almurat/KiKo/kiko-api/src/jobs/socialDataJob.ts:1:5854
[api]     at async Promise.all (index 9)
[api]     at async refreshTrendingCasts (file:///Users/almurat/KiKo/kiko-api/src/jobs/socialDataJob.ts:1:4964) {
[api]   code: 'P2025',
[api]   clientVersion: '5.22.0',
[api]   meta: {
[api]     modelName: 'QualityFarcasterUser',
[api]     cause: 'Record to update not found.'
[api]   }
[api] }
[api] {"level":30,"time":1767790030385,"pid":17456,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-gw","res":{"statusCode":200},"responseTime":4388.273208998144,"msg":"request completed"}
[api] {"level":30,"time":1767790030387,"pid":17456,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-gx","req":{"method":"GET","url":"/api/copy-trade/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55386},"msg":"incoming request"}
[api] [CopyTrade] GET /configs - Fetching configs for user did:privy:cmj0a3j3f005fl20c4xkl7195
[api] prisma:error 
[api] Invalid `prisma.qualityFarcasterUser.update()` invocation:
[api] 
[api] 
[api] An operation failed because it depends on one or more records that were required but not found. Record to update not found.
[api] [QualityUsersRepo] Error updating coin status for FID 2341: PrismaClientKnownRequestError: 
[api] Invalid `prisma.qualityFarcasterUser.update()` invocation:
[api] 
[api] 
[api] An operation failed because it depends on one or more records that were required but not found. Record to update not found.
[api]     at $n.handleRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:7315)
[api]     at $n.handleAndLogRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6623)
[api]     at $n.request (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6307)
[api]     at async l (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:130:9633)
[api]     at async withRetry (file:///Users/almurat/KiKo/kiko-api/src/db/prisma.ts:1:1299)
[api]     at async Object.updateUserCoinStatus (file:///Users/almurat/KiKo/kiko-api/src/repositories/qualityUsersRepository.ts:1:2616)
[api]     at async file:///Users/almurat/KiKo/kiko-api/src/jobs/socialDataJob.ts:1:5854
[api]     at async Promise.all (index 8)
[api]     at async refreshTrendingCasts (file:///Users/almurat/KiKo/kiko-api/src/jobs/socialDataJob.ts:1:4964) {
[api]   code: 'P2025',
[api]   clientVersion: '5.22.0',
[api]   meta: {
[api]     modelName: 'QualityFarcasterUser',
[api]     cause: 'Record to update not found.'
[api]   }
[api] }
[api] prisma:error 
[api] Invalid `prisma.qualityFarcasterUser.update()` invocation:
[api] 
[api] 
[api] An operation failed because it depends on one or more records that were required but not found. Record to update not found.
[api] [QualityUsersRepo] Error updating coin status for FID 15732: PrismaClientKnownRequestError: 
[api] Invalid `prisma.qualityFarcasterUser.update()` invocation:
[api] 
[api] 
[api] An operation failed because it depends on one or more records that were required but not found. Record to update not found.
[api]     at $n.handleRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:7315)
[api]     at $n.handleAndLogRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6623)
[api]     at $n.request (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6307)
[api]     at async l (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:130:9633)
[api]     at async withRetry (file:///Users/almurat/KiKo/kiko-api/src/db/prisma.ts:1:1299)
[api]     at async Object.updateUserCoinStatus (file:///Users/almurat/KiKo/kiko-api/src/repositories/qualityUsersRepository.ts:1:2616)
[api]     at async file:///Users/almurat/KiKo/kiko-api/src/jobs/socialDataJob.ts:1:5854
[api]     at async Promise.all (index 2)
[api]     at async refreshTrendingCasts (file:///Users/almurat/KiKo/kiko-api/src/jobs/socialDataJob.ts:1:4964) {
[api]   code: 'P2025',
[api]   clientVersion: '5.22.0',
[api]   meta: {
[api]     modelName: 'QualityFarcasterUser',
[api]     cause: 'Record to update not found.'
[api]   }
[api] }
[api] {"level":30,"time":1767790032547,"pid":17456,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-gx","res":{"statusCode":200},"responseTime":2159.8204580023885,"msg":"request completed"}
[api] {"level":30,"time":1767790032550,"pid":17456,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-gy","req":{"method":"GET","url":"/api/copy-trade/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55386},"msg":"incoming request"}
[api] [CopyTrade] GET /configs - Fetching configs for user did:privy:cmj0a3j3f005fl20c4xkl7195
[api] {"level":30,"time":1767790034836,"pid":17456,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-gy","res":{"statusCode":200},"responseTime":2285.389957997948,"msg":"request completed"}
[api] {"level":30,"time":1767790034840,"pid":17456,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-gz","req":{"method":"GET","url":"/api/copy-trade/configs","hostname":"localhost:3001","remoteAddress":"127.0.0.1","remotePort":55386},"msg":"incoming request"}
[api] [CopyTrade] GET /configs - Fetching configs for user did:privy:cmj0a3j3f005fl20c4xkl7195
[api] prisma:error 
[api] Invalid `prisma.qualityFarcasterUser.update()` invocation:
[api] 
[api] 
[api] An operation failed because it depends on one or more records that were required but not found. Record to update not found.
[api] [QualityUsersRepo] Error updating coin status for FID 1574: PrismaClientKnownRequestError: 
[api] Invalid `prisma.qualityFarcasterUser.update()` invocation:
[api] 
[api] 
[api] An operation failed because it depends on one or more records that were required but not found. Record to update not found.
[api]     at $n.handleRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:7315)
[api]     at $n.handleAndLogRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6623)
[api]     at $n.request (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6307)
[api]     at async l (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:130:9633)
[api]     at async withRetry (file:///Users/almurat/KiKo/kiko-api/src/db/prisma.ts:1:1299)
[api]     at async Object.updateUserCoinStatus (file:///Users/almurat/KiKo/kiko-api/src/repositories/qualityUsersRepository.ts:1:2616)
[api]     at async file:///Users/almurat/KiKo/kiko-api/src/jobs/socialDataJob.ts:1:5854
[api]     at async Promise.all (index 4)
[api]     at async refreshTrendingCasts (file:///Users/almurat/KiKo/kiko-api/src/jobs/socialDataJob.ts:1:4964) {
[api]   code: 'P2025',
[api]   clientVersion: '5.22.0',
[api]   meta: {
[api]     modelName: 'QualityFarcasterUser',
[api]     cause: 'Record to update not found.'
[api]   }
[api] }
[api] prisma:error 
[api] Invalid `prisma.qualityFarcasterUser.update()` invocation:
[api] 
[api] 
[api] An operation failed because it depends on one or more records that were required but not found. Record to update not found.
[api] [QualityUsersRepo] Error updating coin status for FID 1613354: PrismaClientKnownRequestError: 
[api] Invalid `prisma.qualityFarcasterUser.update()` invocation:
[api] 
[api] 
[api] An operation failed because it depends on one or more records that were required but not found. Record to update not found.
[api]     at $n.handleRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:7315)
[api]     at $n.handleAndLogRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6623)
[api]     at $n.request (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6307)
[api]     at async l (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:130:9633)
[api]     at async withRetry (file:///Users/almurat/KiKo/kiko-api/src/db/prisma.ts:1:1299)
[api]     at async Object.updateUserCoinStatus (file:///Users/almurat/KiKo/kiko-api/src/repositories/qualityUsersRepository.ts:1:2616)
[api]     at async file:///Users/almurat/KiKo/kiko-api/src/jobs/socialDataJob.ts:1:5854
[api]     at async Promise.all (index 7)
[api]     at async refreshTrendingCasts (file:///Users/almurat/KiKo/kiko-api/src/jobs/socialDataJob.ts:1:4964) {
[api]   code: 'P2025',
[api]   clientVersion: '5.22.0',
[api]   meta: {
[api]     modelName: 'QualityFarcasterUser',
[api]     cause: 'Record to update not found.'
[api]   }
[api] }
[api] prisma:error 
[api] Invalid `prisma.qualityFarcasterUser.update()` invocation:
[api] 
[api] 
[api] An operation failed because it depends on one or more records that were required but not found. Record to update not found.
[api] [QualityUsersRepo] Error updating coin status for FID 539: PrismaClientKnownRequestError: 
[api] Invalid `prisma.qualityFarcasterUser.update()` invocation:
[api] 
[api] 
[api] An operation failed because it depends on one or more records that were required but not found. Record to update not found.
[api]     at $n.handleRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:7315)
[api]     at $n.handleAndLogRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6623)
[api]     at $n.request (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6307)
[api]     at async l (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:130:9633)
[api]     at async withRetry (file:///Users/almurat/KiKo/kiko-api/src/db/prisma.ts:1:1299)
[api]     at async Object.updateUserCoinStatus (file:///Users/almurat/KiKo/kiko-api/src/repositories/qualityUsersRepository.ts:1:2616)
[api]     at async file:///Users/almurat/KiKo/kiko-api/src/jobs/socialDataJob.ts:1:5854
[api]     at async Promise.all (index 5)
[api]     at async refreshTrendingCasts (file:///Users/almurat/KiKo/kiko-api/src/jobs/socialDataJob.ts:1:4964) {
[api]   code: 'P2025',
[api]   clientVersion: '5.22.0',
[api]   meta: {
[api]     modelName: 'QualityFarcasterUser',
[api]     cause: 'Record to update not found.'
[api]   }
[api] }
[api] {"level":30,"time":1767790037065,"pid":17456,"hostname":"almuratdeMacBook-Pro.local","reqId":"req-gz","res":{"statusCode":200},"responseTime":2225.2340420000255,"msg":"request completed"}
[api] prisma:error 
[api] Invalid `prisma.qualityFarcasterUser.update()` invocation:
[api] 
[api] 
[api] An operation failed because it depends on one or more records that were required but not found. Record to update not found.
[api] [QualityUsersRepo] Error updating coin status for FID 8152: PrismaClientKnownRequestError: 
[api] Invalid `prisma.qualityFarcasterUser.update()` invocation:
[api] 
[api] 
[api] An operation failed because it depends on one or more records that were required but not found. Record to update not found.
[api]     at $n.handleRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:7315)
[api]     at $n.handleAndLogRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6623)
[api]     at $n.request (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6307)
[api]     at async l (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:130:9633)
[api]     at async withRetry (file:///Users/almurat/KiKo/kiko-api/src/db/prisma.ts:1:1299)
[api]     at async Object.updateUserCoinStatus (file:///Users/almurat/KiKo/kiko-api/src/repositories/qualityUsersRepository.ts:1:2616)
[api]     at async file:///Users/almurat/KiKo/kiko-api/src/jobs/socialDataJob.ts:1:5854
[api]     at async Promise.all (index 3)
[api]     at async refreshTrendingCasts (file:///Users/almurat/KiKo/kiko-api/src/jobs/socialDataJob.ts:1:4964) {
[api]   code: 'P2025',
[api]   clientVersion: '5.22.0',
[api]   meta: {
[api]     modelName: 'QualityFarcasterUser',
[api]     cause: 'Record to update not found.'
[api]   }
[api] }
[api] prisma:error 
[api] Invalid `prisma.qualityFarcasterUser.update()` invocation:
[api] 
[api] 
[api] An operation failed because it depends on one or more records that were required but not found. Record to update not found.
[api] [QualityUsersRepo] Error updating coin status for FID 533: PrismaClientKnownRequestError: 
[api] Invalid `prisma.qualityFarcasterUser.update()` invocation:
[api] 
[api] 
[api] An operation failed because it depends on one or more records that were required but not found. Record to update not found.
[api]     at $n.handleRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:7315)
[api]     at $n.handleAndLogRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6623)
[api]     at $n.request (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6307)
[api]     at async l (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:130:9633)
[api]     at async withRetry (file:///Users/almurat/KiKo/kiko-api/src/db/prisma.ts:1:1299)
[api]     at async Object.updateUserCoinStatus (file:///Users/almurat/KiKo/kiko-api/src/repositories/qualityUsersRepository.ts:1:2616)
[api]     at async file:///Users/almurat/KiKo/kiko-api/src/jobs/socialDataJob.ts:1:5854
[api]     at async Promise.all (index 2)
[api]     at async refreshTrendingCasts (file:///Users/almurat/KiKo/kiko-api/src/jobs/socialDataJob.ts:1:4964) {
[api]   code: 'P2025',
[api]   clientVersion: '5.22.0',
[api]   meta: {
[api]     modelName: 'QualityFarcasterUser',
[api]     cause: 'Record to update not found.'
[api]   }
