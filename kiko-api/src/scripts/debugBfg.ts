/**
 * Debug @bfg cast embeds structure
 */
import prisma from '../db/prisma.js';

async function debug() {
    // Find all @bfg casts
    const casts = await prisma.trendingCast.findMany({
        where: { authorUsername: 'bfg' },
        select: { hash: true, embeds: true, authorUsername: true, text: true }
    });

    console.log(`Found ${casts.length} casts by @bfg\n`);

    casts.forEach((c, i) => {
        console.log(`${i + 1}. Cast: ${c.hash.slice(0, 12)}...`);
        console.log(`   Text: ${c.text.slice(0, 50)}...`);
        console.log(`   Embeds raw:`, JSON.stringify(c.embeds, null, 2));
        console.log('');
    });
}

debug().finally(() => prisma.$disconnect());
