
import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

async function cleanBadSocialData() {
    console.log('🧹 Starting Social Data Cleanup...');

    try {
        // 1. Delete casts from "User 111" style placeholders
        const result1 = await prisma.trendingCast.deleteMany({
            where: {
                OR: [
                    { authorDisplayName: { startsWith: 'User ' } },
                    { authorUsername: { startsWith: 'fid' } },
                    // Also clear placeholder avatars if username is also suspicious
                    {
                        AND: [
                            { authorAvatar: { contains: 'placehold.co' } },
                            { authorUsername: { startsWith: 'fid' } }
                        ]
                    }
                ]
            }
        });

        console.log(`✅ Deleted ${result1.count} corrupted casts (Mock Data)`);

        // 2. Clear bad cache entries if any
        // (Optional: if you have a separate cache table for profiles)
        // await prisma.cache.deleteMany({ ... })

        console.log('✨ Cleanup complete!');
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanBadSocialData();
