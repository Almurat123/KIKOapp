/**
 * Manual Trending Token Input for News Generation
 * 
 * Usage: 
 *   npx tsx manual-news.ts
 * 
 * Input format (CONTRACT ADDRESS REQUIRED):
 *   SYMBOL CHAIN CONTRACT_ADDRESS
 * 
 * Examples:
 *   4DOG bsc 0x1234567890abcdef...
 *   PEPE ethereum 0xabcdef...
 *   WIF solana 9XysH...
 */

import { prisma } from './src/lib/prisma.js';
import { generateCoverImage } from './src/services/news/coverImageGenerator.js';
import { reviewContent } from './src/services/news/contentReviewer.js';
import * as dexScreener from './src/services/dexscreener.js';
import fetch from 'node-fetch';
import readline from 'readline';

const GROK_SERVICE_URL = process.env.GROK_SERVICE_URL || 'http://localhost:8001';

interface EnrichedToken {
    name: string;
    symbol: string;
    chain: string;
    address: string;
    price: number;
    priceChange: number;
    volume: number;
    marketCap: number;
    imageUrl?: string;
}

async function promptUser(): Promise<{ symbol: string; chain: string; address: string }[]> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log('\n📝 Enter trending tokens (CONTRACT ADDRESS REQUIRED)');
    console.log('   Format: SYMBOL CHAIN CONTRACT_ADDRESS');
    console.log('   Example: 4DOG bsc 0x1234567890abcdef1234567890abcdef12345678');
    console.log('   Example: PEPE ethereum 0x6982508145454ce325ddbe47a25d4ec3d2311933');
    console.log('   Type "done" when finished.\n');

    const inputs: { symbol: string; chain: string; address: string }[] = [];

    return new Promise((resolve) => {
        const askForToken = () => {
            rl.question(`Token ${inputs.length + 1}: `, (answer) => {
                if (answer.toLowerCase() === 'done' || answer === '') {
                    rl.close();
                    resolve(inputs);
                    return;
                }

                const parts = answer.trim().split(/\s+/);
                if (parts.length >= 3) {
                    const symbol = parts[0];
                    const chain = parts[1].toLowerCase();
                    const address = parts[2];

                    inputs.push({ symbol, chain, address });
                    console.log(`   ✅ Added: ${symbol} on ${chain} (${address.substring(0, 10)}...)`);
                } else {
                    console.log('   ❌ Invalid format. Use: SYMBOL CHAIN CONTRACT_ADDRESS');
                }
                askForToken();
            });
        };
        askForToken();
    });
}

async function enrichTokenData(inputs: { symbol: string; chain: string; address: string }[]): Promise<EnrichedToken[]> {
    console.log('\n🔍 Fetching real token data from DexScreener...\n');

    const enrichedTokens: EnrichedToken[] = [];

    for (const input of inputs) {
        console.log(`   📊 Fetching ${input.symbol} (${input.address.substring(0, 10)}...)...`);

        try {
            const tokenData = await dexScreener.getTokenDetails(input.chain, input.address);

            if (tokenData) {
                enrichedTokens.push({
                    name: tokenData.name || input.symbol,
                    symbol: tokenData.symbol || input.symbol,
                    chain: input.chain,
                    address: input.address,
                    price: tokenData.price || 0,
                    priceChange: tokenData.priceChange24h || 0,
                    volume: tokenData.volume24h || 0,
                    marketCap: tokenData.fdv || 0,
                    imageUrl: undefined // DexScreener doesn't always return image
                });

                console.log(`      ✅ ${tokenData.name} ($${tokenData.symbol})`);
                console.log(`         Price: $${tokenData.price?.toFixed(8) || 'N/A'}`);
                console.log(`         24h Change: ${tokenData.priceChange24h?.toFixed(2) || 'N/A'}%`);
                console.log(`         Volume: $${(tokenData.volume24h || 0).toLocaleString()}`);
                console.log(`         Market Cap: $${(tokenData.fdv || 0).toLocaleString()}`);
            } else {
                console.log(`      ⚠️ No data found, using symbol only`);
                enrichedTokens.push({
                    name: input.symbol,
                    symbol: input.symbol,
                    chain: input.chain,
                    address: input.address,
                    price: 0,
                    priceChange: 0,
                    volume: 0,
                    marketCap: 0
                });
            }
        } catch (error: any) {
            console.log(`      ❌ Error: ${error.message}`);
            enrichedTokens.push({
                name: input.symbol,
                symbol: input.symbol,
                chain: input.chain,
                address: input.address,
                price: 0,
                priceChange: 0,
                volume: 0,
                marketCap: 0
            });
        }
    }

    return enrichedTokens;
}

async function generateNews(tokens: EnrichedToken[]) {
    console.log('\n🚀 Generating news article...\n');

    // Call Grok service
    const grokResponse = await fetch(`${GROK_SERVICE_URL}/chat/write_news`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens })
    });

    if (!grokResponse.ok) {
        throw new Error(`Grok service failed: ${grokResponse.statusText}`);
    }

    const grokResult = await grokResponse.json() as { content: string };
    const markdownContent = grokResult.content;

    // Extract title
    const titleMatch = markdownContent.match(/^#\s+(.+)$/m) || markdownContent.match(/^\*\*(.+?)\*\*/m);
    const title = titleMatch ? titleMatch[1].replace(/[*"]/g, '').trim() : `KIKO Market Watch - ${new Date().toLocaleDateString()}`;

    // Generate cover image with real data
    let coverImageUrl = '';
    try {
        coverImageUrl = await generateCoverImage({
            tokens,
            chains: [...new Set(tokens.map(t => t.chain))],
            timestamp: Date.now()
        });
        console.log(`   ✅ Cover image generated: ${coverImageUrl}`);
    } catch (e) {
        console.error('[NewsGen] Cover image generation failed');
    }

    // Review content
    const review = reviewContent(markdownContent);
    const status = review.approved ? 'approved' : 'rejected';

    // Save to database
    const article = await prisma.newsArticle.create({
        data: {
            title,
            content: markdownContent,
            coverImage: coverImageUrl,
            status,
            rejectionReason: review.reason,
            tokens: JSON.stringify(tokens),
            chains: JSON.stringify([...new Set(tokens.map(t => t.chain))]),
            slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now()
        }
    });

    console.log(`\n✅ Article saved!`);
    console.log(`   ID: ${article.id}`);
    console.log(`   Title: ${title}`);
    console.log(`   Status: ${status}`);
    console.log(`\n📄 Content Preview:\n`);
    console.log(markdownContent.substring(0, 1500) + '...\n');
}

async function main() {
    console.log('===================================');
    console.log('  KIKO Manual News Generator');
    console.log('  (With Real Token Data)');
    console.log('===================================');

    const userInputs = await promptUser();

    if (userInputs.length === 0) {
        console.log('\n❌ No tokens provided. Exiting.');
        process.exit(0);
    }

    console.log(`\n📊 You provided ${userInputs.length} tokens:`);
    userInputs.forEach((t, i) => console.log(`   ${i + 1}. ${t.symbol} on ${t.chain}`));

    // Enrich with real data from DexScreener
    const enrichedTokens = await enrichTokenData(userInputs);

    // Generate news with enriched data
    await generateNews(enrichedTokens);

    await prisma.$disconnect();
}

main().catch(console.error);
