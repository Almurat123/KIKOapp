[api] [QualityUsersRepo] Error updating coin status for FID 472680: PrismaClientKnownRequestError: 
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
[api] prisma:error 
[api] Invalid `prisma.trendingCast.upsert()` invocation:
[api] 
[api] {
[api]   where: {
[api]     hash: "0x16e83fde3b0b2e5f45884f7919b62497de929de2"
[api]   },
[api]   update: {
[api]     fid: 1566681,
[api]     authorUsername: "pixybase",
[api]     authorDisplayName: "PIXY",
[api]     authorAvatar: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/dd345b57-eca4-4a43-694b-3cc49c072100/original",
[api]     authorVerified: false,
[api]     text: "🎉 PIXY Discord Invite Event 🎉\n\nWe’re running a Discord invite event for the PIXY community.\n\nInvite 5 real & active friends to the PIXY Discord server and earn a special community role 🟦\n\n⏱ Duration: 1 Day\n\nJoin the Discord, get your invite link, and start inviting 🚀\n\n➡️ Discord Server: https://discord.gg/v2hZ8AZnwq",
[api]     timestamp: 1767778294000,
[api]     embeds: [
[api]       {
[api]         url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/26421ab0-ddfa-41d0-43ce-5f66fad0e700/original"
[api]       }
[api]     ],
[api]     parentCastFid: null,
[api]     parentCastHash: null,
[api]     likes: 2000,
[api]     recasts: 2000,
[api]     replies: 2000,
[api]     heatScore: new Prisma.Decimal("999.99"),
[api]     rank: 1,
[api]     isBaseAppCoin: false,
[api]     baseAppCoinMetadata: null,
[api]     coinValue: null,
[api]     authorBio: "PIXY PIXY PIXY on Base ◽◽",
[api]     mentions: [],
[api]     authorCreatorCoin: null,
[api]     authorTwitter: null,
[api]     updatedAt: new Date("2026-01-07T17:47:41.603Z")
[api]   },
[api]   create: {
[api]     hash: "0x16e83fde3b0b2e5f45884f7919b62497de929de2",
[api]     fid: 1566681,
[api]     authorUsername: "pixybase",
[api]     authorDisplayName: "PIXY",
[api]     authorAvatar: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/dd345b57-eca4-4a43-694b-3cc49c072100/original",
[api]     authorVerified: false,
[api]     text: "🎉 PIXY Discord Invite Event 🎉\n\nWe’re running a Discord invite event for the PIXY community.\n\nInvite 5 real & active friends to the PIXY Discord server and earn a special community role 🟦\n\n⏱ Duration: 1 Day\n\nJoin the Discord, get your invite link, and start inviting 🚀\n\n➡️ Discord Server: https://discord.gg/v2hZ8AZnwq",
[api]     timestamp: 1767778294000,
[api]                ~~~~~~~~~~~~~
[api]     embeds: [
[api]       {
[api]         url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/26421ab0-ddfa-41d0-43ce-5f66fad0e700/original"
[api]       }
[api]     ],
[api]     parentCastFid: null,
[api]     parentCastHash: null,
[api]     likes: 2000,
[api]     recasts: 2000,
[api]     replies: 2000,
[api]     heatScore: new Prisma.Decimal("999.99"),
[api]     rank: 1,
[api]     isBaseAppCoin: false,
[api]     baseAppCoinMetadata: null,
[api]     coinValue: null,
[api]     authorBio: "PIXY PIXY PIXY on Base ◽◽",
[api]     mentions: [],
[api]     authorCreatorCoin: null,
[api]     authorTwitter: null
[api]   }
[api] }
[api] 
[api] Argument `timestamp`: Invalid value provided. Expected DateTime, provided Int.
[api] Error saving trending casts: PrismaClientValidationError: 
[api] Invalid `prisma.trendingCast.upsert()` invocation:
[api] 
[api] {
[api]   where: {
[api]     hash: "0x16e83fde3b0b2e5f45884f7919b62497de929de2"
[api]   },
[api]   update: {
[api]     fid: 1566681,
[api]     authorUsername: "pixybase",
[api]     authorDisplayName: "PIXY",
[api]     authorAvatar: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/dd345b57-eca4-4a43-694b-3cc49c072100/original",
[api]     authorVerified: false,
[api]     text: "🎉 PIXY Discord Invite Event 🎉\n\nWe’re running a Discord invite event for the PIXY community.\n\nInvite 5 real & active friends to the PIXY Discord server and earn a special community role 🟦\n\n⏱ Duration: 1 Day\n\nJoin the Discord, get your invite link, and start inviting 🚀\n\n➡️ Discord Server: https://discord.gg/v2hZ8AZnwq",
[api]     timestamp: 1767778294000,
[api]     embeds: [
[api]       {
[api]         url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/26421ab0-ddfa-41d0-43ce-5f66fad0e700/original"
[api]       }
[api]     ],
[api]     parentCastFid: null,
[api]     parentCastHash: null,
[api]     likes: 2000,
[api]     recasts: 2000,
[api]     replies: 2000,
[api]     heatScore: new Prisma.Decimal("999.99"),
[api]     rank: 1,
[api]     isBaseAppCoin: false,
[api]     baseAppCoinMetadata: null,
[api]     coinValue: null,
[api]     authorBio: "PIXY PIXY PIXY on Base ◽◽",
[api]     mentions: [],
[api]     authorCreatorCoin: null,
[api]     authorTwitter: null,
[api]     updatedAt: new Date("2026-01-07T17:47:41.603Z")
[api]   },
[api]   create: {
[api]     hash: "0x16e83fde3b0b2e5f45884f7919b62497de929de2",
[api]     fid: 1566681,
[api]     authorUsername: "pixybase",
[api]     authorDisplayName: "PIXY",
[api]     authorAvatar: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/dd345b57-eca4-4a43-694b-3cc49c072100/original",
[api]     authorVerified: false,
[api]     text: "🎉 PIXY Discord Invite Event 🎉\n\nWe’re running a Discord invite event for the PIXY community.\n\nInvite 5 real & active friends to the PIXY Discord server and earn a special community role 🟦\n\n⏱ Duration: 1 Day\n\nJoin the Discord, get your invite link, and start inviting 🚀\n\n➡️ Discord Server: https://discord.gg/v2hZ8AZnwq",
[api]     timestamp: 1767778294000,
[api]                ~~~~~~~~~~~~~
[api]     embeds: [
[api]       {
[api]         url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/26421ab0-ddfa-41d0-43ce-5f66fad0e700/original"
[api]       }
[api]     ],
[api]     parentCastFid: null,
[api]     parentCastHash: null,
[api]     likes: 2000,
[api]     recasts: 2000,
[api]     replies: 2000,
[api]     heatScore: new Prisma.Decimal("999.99"),
[api]     rank: 1,
[api]     isBaseAppCoin: false,
[api]     baseAppCoinMetadata: null,
[api]     coinValue: null,
[api]     authorBio: "PIXY PIXY PIXY on Base ◽◽",
[api]     mentions: [],
[api]     authorCreatorCoin: null,
[api]     authorTwitter: null
[api]   }
[api] }
[api] 
[api] Argument `timestamp`: Invalid value provided. Expected DateTime, provided Int.
[api]     at wn (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:29:1363)
[api]     at $n.handleRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6958)
[api]     at $n.handleAndLogRequestError (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6623)
[api]     at $n.request (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:121:6307)
[api]     at async l (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:130:9633)
[api]     at async file:///Users/almurat/KiKo/kiko-api/src/repositories/socialRepository.ts:1:1537
[api]     at async Proxy._transactionWithCallback (/Users/almurat/KiKo/kiko-api/node_modules/@prisma/client/runtime/library.js:130:8000)
[api]     at async file:///Users/almurat/KiKo/kiko-api/src/repositories/socialRepository.ts:1:977
[api]     at async withRetry (file:///Users/almurat/KiKo/kiko-api/src/db/prisma.ts:1:1299)
[api]     at async saveTrendingCasts (file:///Users/almurat/KiKo/kiko-api/src/repositories/socialRepository.ts:1:951) {
[api]   clientVersion: '5.22.0'
[api] }
[api] [SocialJob] Error: 
[api] Invalid `prisma.trendingCast.upsert()` invocation:
[api] 
[api] {
[api]   where: {
[api]     hash: "0x16e83fde3b0b2e5f45884f7919b62497de929de2"
[api]   },
[api]   update: {
[api]     fid: 1566681,
[api]     authorUsername: "pixybase",
[api]     authorDisplayName: "PIXY",
[api]     authorAvatar: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/dd345b57-eca4-4a43-694b-3cc49c072100/original",
[api]     authorVerified: false,
[api]     text: "🎉 PIXY Discord Invite Event 🎉\n\nWe’re running a Discord invite event for the PIXY community.\n\nInvite 5 real & active friends to the PIXY Discord server and earn a special community role 🟦\n\n⏱ Duration: 1 Day\n\nJoin the Discord, get your invite link, and start inviting 🚀\n\n➡️ Discord Server: https://discord.gg/v2hZ8AZnwq",
[api]     timestamp: 1767778294000,
[api]     embeds: [
[api]       {
[api]         url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/26421ab0-ddfa-41d0-43ce-5f66fad0e700/original"
[api]       }
[api]     ],
[api]     parentCastFid: null,
[api]     parentCastHash: null,
[api]     likes: 2000,
[api]     recasts: 2000,
[api]     replies: 2000,
[api]     heatScore: new Prisma.Decimal("999.99"),
[api]     rank: 1,
[api]     isBaseAppCoin: false,
[api]     baseAppCoinMetadata: null,
[api]     coinValue: null,
[api]     authorBio: "PIXY PIXY PIXY on Base ◽◽",
[api]     mentions: [],
[api]     authorCreatorCoin: null,
[api]     authorTwitter: null,
[api]     updatedAt: new Date("2026-01-07T17:47:41.603Z")
[api]   },
[api]   create: {
[api]     hash: "0x16e83fde3b0b2e5f45884f7919b62497de929de2",
[api]     fid: 1566681,
[api]     authorUsername: "pixybase",
[api]     authorDisplayName: "PIXY",
[api]     authorAvatar: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/dd345b57-eca4-4a43-694b-3cc49c072100/original",
[api]     authorVerified: false,
[api]     text: "🎉 PIXY Discord Invite Event 🎉\n\nWe’re running a Discord invite event for the PIXY community.\n\nInvite 5 real & active friends to the PIXY Discord server and earn a special community role 🟦\n\n⏱ Duration: 1 Day\n\nJoin the Discord, get your invite link, and start inviting 🚀\n\n➡️ Discord Server: https://discord.gg/v2hZ8AZnwq",
[api]     timestamp: 1767778294000,
[api]                ~~~~~~~~~~~~~
[api]     embeds: [
[api]       {
[api]         url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/26421ab0-ddfa-41d0-43ce-5f66fad0e700/original"
[api]       }
[api]     ],
[api]     parentCastFid: null,
[api]     parentCastHash: null,
[api]     likes: 2000,
[api]     recasts: 2000,
[api]     replies: 2000,
[api]     heatScore: new Prisma.Decimal("999.99"),
[api]     rank: 1,
[api]     isBaseAppCoin: false,
[api]     baseAppCoinMetadata: null,
[api]     coinValue: null,
[api]     authorBio: "PIXY PIXY PIXY on Base ◽◽",
[api]     mentions: [],
[api]     authorCreatorCoin: null,
[api]     authorTwitter: null
[api]   }
[api] }
[api] 
[api] Argument `timestamp`: Invalid value provided. Expected DateTime, provided Int.