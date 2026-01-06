/**
 * Regenerate cover image for the last article
 * Uses the updated code that fetches token images from DexScreener
 */

import { prisma } from './src/lib/prisma.js';
import { generateCoverImage } from './src/services/news/coverImageGenerator.js';
import * as dexScreener from './src/services/dexscreener.js';

async function main() {
    console.log('🔄 Fetching last article...\n');

    // Get the last article
    const article = await prisma.newsArticle.findFirst({
        orderBy: { createdAt: 'desc' }
    });

    if (!article) {
        console.log('❌ No articles found');
        process.exit(1);
    }

    console.log(`📄 Article: ${article.title}`);
    console.log(`   ID: ${article.id}`);
    console.log(`   Old Cover: ${article.coverImage}`);

    // Parse tokens from article
    const rawTokens = JSON.parse(article.tokens as string);
    console.log(`\n🔍 Re-fetching token data for ${rawTokens.length} tokens...\n`);

    // Re-fetch each token to get the latest imageUrl
    const enrichedTokens = [];
    for (const t of rawTokens) {
        if (t.address) {
            console.log(`   📊 Fetching ${t.symbol || t.chain} ${t.address.substring(0, 10)}...`);
            const data = await dexScreener.getTokenDetails(t.chain, t.address);
            if (data) {
                enrichedTokens.push({
                    name: data.name || t.name,
                    symbol: data.symbol || t.symbol,
                    chain: t.chain,
                    address: t.address,
                    price: data.price || t.price || 0,
                    priceChange: data.priceChange24h || t.priceChange || 0,
                    volume: data.volume24h || t.volume || 0,
                    marketCap: data.fdv || t.marketCap || 0,
                    imageUrl: data.imageUrl // Get fresh image URL!
                });
                console.log(`      ✅ ${data.name} - Image: ${data.imageUrl ? 'Found' : 'None'}`);
            } else {
                enrichedTokens.push(t);
                console.log(`      ⚠️ No data, using cached`);
            }
        } else {
            enrichedTokens.push(t);
        }
    }

    // Generate new cover image
    console.log('\n🎨 Generating new cover image...\n');
    const chains = JSON.parse(article.chains as string);
    const newCoverUrl = await generateCoverImage({
        tokens: enrichedTokens,
        chains,
        timestamp: Date.now()
    });

    console.log(`   ✅ New cover: ${newCoverUrl}`);

    // Update article in database
    await prisma.newsArticle.update({
        where: { id: article.id },
        data: {
            coverImage: newCoverUrl,
            tokens: JSON.stringify(enrichedTokens)
        }
    });

    console.log('\n✅ Article updated with new cover image!');

    await prisma.$disconnect();
}

main().catch(console.error);
