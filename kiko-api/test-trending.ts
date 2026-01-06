import { collectTrendingTokens } from './src/services/news/trendingCollector.js';
import { prisma } from './src/lib/prisma.js';

async function main() {
    console.log('=== Testing Trending Token Collection ===\n');

    // Simulate the cooldown logic from newsGenerator
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const recentArticles = await prisma.newsArticle.findMany({
        where: {
            createdAt: { gt: threeDaysAgo },
            status: { not: 'rejected' }
        },
        select: { tokens: true }
    });

    const exclusionList = new Set<string>();
    recentArticles.forEach(article => {
        try {
            const tokens = JSON.parse(article.tokens as string);
            if (Array.isArray(tokens)) {
                tokens.forEach((t: any) => {
                    if (t.symbol) exclusionList.add(t.symbol.toUpperCase());
                });
            }
        } catch (e) { }
    });

    console.log(`📋 Cooldown Exclusion List (${exclusionList.size} tokens):`);
    console.log([...exclusionList].join(', '));
    console.log('\n---\n');

    // Collect trending tokens
    const data = await collectTrendingTokens(exclusionList);

    console.log(`\n✅ Final Collected Tokens (${data.tokens.length}):\n`);
    data.tokens.forEach((t, i) => {
        const mcapM = (t.marketCap / 1e6).toFixed(1);
        const change = t.priceChange > 0 ? `+${t.priceChange.toFixed(1)}%` : `${t.priceChange.toFixed(1)}%`;
        console.log(`${i + 1}. ${t.symbol} (${t.chain.toUpperCase()}) - $${mcapM}M - ${change}`);
    });

    console.log('\n=== Test Complete ===');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
