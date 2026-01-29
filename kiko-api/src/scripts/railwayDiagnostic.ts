/**
 * Railway Database & Social Job Diagnostic Script
 * Run this on Railway to diagnose social data issues
 */
import prisma from '../db/prisma.js';
import neynarService from '../services/neynarService.js';

async function diagnose() {
    console.log('\n=== RAILWAY SOCIAL DIAGNOSTIC ===\n');

    // 1. Test Database Connection
    console.log('1. Testing Database Connection...');
    try {
        const result = await prisma.$queryRaw`SELECT 1 as test`;
        console.log('   ✅ Database connected successfully');
    } catch (err: any) {
        console.error('   ❌ Database connection FAILED:', err.message);
        return;
    }

    // 2. Check TrendingCasts table
    console.log('\n2. Checking trending_casts table...');
    const castCount = await prisma.trendingCast.count();
    console.log(`   Total casts: ${castCount}`);

    if (castCount > 0) {
        const latest = await prisma.trendingCast.findFirst({
            orderBy: { updatedAt: 'desc' },
            select: { hash: true, authorUsername: true, updatedAt: true }
        });
        console.log(`   Latest: ${latest?.authorUsername} @ ${latest?.updatedAt}`);
    } else {
        console.log('   ⚠️  No casts in database!');
    }

    // 3. Check QualityUsers table
    console.log('\n3. Checking quality_farcaster_users table...');
    const userCount = await prisma.qualityFarcasterUser.count();
    console.log(`   Total quality users: ${userCount}`);

    // 4. Check Neynar API Key
    console.log('\n4. Checking Neynar API configuration...');
    const neynarConfigured = await neynarService.isNeynarConfigured();
    if (neynarConfigured) {
        console.log('   ✅ Neynar API Key configured');

        // Test Neynar API
        console.log('   Testing Neynar trending feed...');
        try {
            const feed = await neynarService.getTrendingFeed(5);
            console.log(`   ✅ Neynar returned ${feed.length} casts`);
        } catch (err: any) {
            console.error('   ❌ Neynar API failed:', err.message);
        }
    } else {
        console.log('   ⚠️  NEYNAR_API_KEY not configured! Fallback will not work.');
    }

    // 5. Check Environment Variables
    console.log('\n5. Checking environment variables...');
    console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`   SNAPCHAIN_HUB_URL: ${process.env.SNAPCHAIN_HUB_URL || 'default (snapchain-api.neynar.com)'}`);
    console.log(`   NEYNAR_API_KEY: ${process.env.NEYNAR_API_KEY ? 'present' : 'MISSING!'}`);
    console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'present' : 'MISSING!'}`);

    // 6. Test Hub connectivity (with API key for Neynar Hub)
    console.log('\n6. Testing Snapchain Hub connectivity...');
    const hubUrl = process.env.SNAPCHAIN_HUB_URL || 'https://snapchain-api.neynar.com';
    const apiKey = process.env.NEYNAR_API_KEY;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        // Add API key for Neynar Hub
        if (apiKey && hubUrl.includes('neynar.com')) {
            headers['x-api-key'] = apiKey;
        }
        const response = await fetch(`${hubUrl}/v1/info`, {
            signal: controller.signal,
            headers
        });
        clearTimeout(timeout);
        if (response.ok) {
            const data = await response.json();
            console.log(`   ✅ Hub reachable: ${hubUrl}`);
            console.log(`   Hub version: ${data.version}, Messages: ${data.dbStats?.numMessages?.toLocaleString()}`);
        } else {
            console.log(`   ⚠️  Hub returned status ${response.status}`);
        }
    } catch (err: any) {
        console.error(`   ❌ Hub unreachable: ${err.message}`);
    }

    console.log('\n=== DIAGNOSTIC COMPLETE ===\n');
}

diagnose().catch(console.error).finally(() => prisma.$disconnect());
