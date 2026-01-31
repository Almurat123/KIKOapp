/**
 * Test script to check castId embeds and Hub API
 */
import { PrismaClient } from '@prisma/client';
import { getCastById, getUserDataByFid } from '../services/snapchainService.js';
const prisma = new PrismaClient();

async function main() {
    console.log('=== Checking castId embeds in database ===\n');

    const rows = await prisma.trendingCast.findMany({
        take: 20,
        orderBy: { heatScore: 'desc' }
    });

    let foundCount = 0;
    for (const row of rows) {
        try {
            const embeds = typeof row.embeds === 'string' ? JSON.parse(row.embeds) : row.embeds;
            if (!Array.isArray(embeds)) continue;

            const castEmbed = embeds.find((e: any) => e.castId);
            if (castEmbed) {
                foundCount++;
                const fid = castEmbed.castId?.fid;
                const hash = castEmbed.castId?.hash;

                console.log('=== Cast with castId embed ===');
                console.log('Author:', row.authorUsername);
                console.log('castId.fid:', fid);
                console.log('castId.hash:', hash);

                // Test Hub API
                console.log('\nTesting Hub API...');
                const quotedCast = await getCastById(fid, hash);
                console.log('getCastById result:', quotedCast ? 'SUCCESS' : 'FAILED');
                if (quotedCast) {
                    console.log('Quoted text:', quotedCast.text?.substring(0, 80) || '(empty)');
                }

                const userData = await getUserDataByFid(fid);
                console.log('getUserDataByFid result:', userData ? 'SUCCESS' : 'FAILED');
                if (userData) {
                    console.log('Quoted author:', userData.username);
                }
                console.log('');
            }
        } catch (e: any) {
            console.log('Error:', e.message);
        }
    }

    console.log(`Found ${foundCount} casts with castId embeds`);
    await prisma.$disconnect();
}

main().catch(console.error);
