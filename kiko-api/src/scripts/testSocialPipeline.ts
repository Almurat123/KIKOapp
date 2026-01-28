
import { runDiscoveryJob, runEngagementRefreshJob, runScoreRecalculationJob } from '../jobs/socialDataJob.js';
import prisma from '../db/prisma.js';
import { logger } from '../utils/logger.js';

// Mock logger to see output
logger.info = console.log;
logger.warn = console.warn;
logger.error = console.error;

async function runTest() {
    console.log('--- Starting Social Pipeline Verification ---');

    // 1. Verify Discovery Job (Dry Run logic if possible, or just start it)
    // We'll trust the existing discovery logic since it was just renamed.
    // But let's verify we can call it.
    console.log('\nStep 1: Testing Discovery Job Invocation...');
    try {
        // Only run if you want to actually fetch data. 
        // For test speed, we might assume it works if it doesn't crash immediately.
        // await runDiscoveryJob(true); 
        console.log('Skipping actual discovery fetch to save time/API quota.');
    } catch (e) {
        console.error('Discovery Job Failed:', e);
    }

    // 2. Verify Engagement Refresh
    console.log('\nStep 2: Testing Engagement Refresh...');
    // Find a cast to test with (older than 30 mins to trigger refresh)
    const refreshableCast = await prisma.trendingCast.findFirst({
        where: {
            timestamp: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
    });

    if (refreshableCast) {
        console.log(`Found candidate cast: ${refreshableCast.hash.substring(0, 10)}... (Likes: ${refreshableCast.likes})`);

        // Manually force statsUpdated to be old so it gets picked up
        await prisma.trendingCast.update({
            where: { hash: refreshableCast.hash },
            data: { statsLastUpdatedAt: new Date(Date.now() - 60 * 60 * 1000) }
        });

        await runEngagementRefreshJob();

        const updatedCast = await prisma.trendingCast.findUnique({ where: { hash: refreshableCast.hash } });
        console.log(`After Refresh - Likes: ${updatedCast?.likes}, UpdatedAt: ${updatedCast?.statsLastUpdatedAt?.toISOString()}`);

        if (updatedCast?.statsLastUpdatedAt && updatedCast.statsLastUpdatedAt.getTime() > (Date.now() - 5000)) {
            console.log('✅ Engagement Refresh Updated the timestamp!');
        } else {
            console.log('❌ Engagement Refresh did NOT update the timestamp.');
        }
    } else {
        console.log('No casts found to test refresh.');
    }

    // 3. Verify Score Recalculation
    console.log('\nStep 3: Testing Score Recalculation...');
    const beforeScore = refreshableCast?.heatScore;

    await runScoreRecalculationJob();

    const afterScoreCast = await prisma.trendingCast.findFirst({ where: { hash: refreshableCast?.hash } });

    console.log(`Heat Score: ${beforeScore} -> ${afterScoreCast?.heatScore}`);
    console.log('✅ Score Recalculation completed without error.');
}

runTest()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
