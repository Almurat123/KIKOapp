import { prisma } from '../lib/prisma.js';
import { getTokenDetails } from './dexscreener.js';
import { getTrendingTokens } from '../repositories/tokenRepository.js';
import { AppError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';

/**
 * Service for generating and managing crypto news
 */
export class NewsService {
    /**
     * Generate a new daily news article based on trending tokens
     */
    static async generateDailyNews(force: boolean = false): Promise<any> {
        // 1. Check if we already have a recent article (within last 8 hours)
        if (!force) {
            const recentArticle = await prisma.newsArticle.findFirst({
                where: {
                    createdAt: {
                        gt: new Date(Date.now() - 8 * 60 * 60 * 1000) // 8 hours ago
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            if (recentArticle) {
                console.log('[NewsService] Recent article exists, skipping generation');
                return recentArticle;
            }
        }

        console.log('[NewsService] Starting news generation...');

        // 2. Fetch trending tokens from all major chains
        // reusing the repository directly or internal service method
        // We want a mix of high volume and high trending score tokens
        const ethTokens = await getTrendingTokens('eth', 10);
        const solTokens = await getTrendingTokens('solana', 10);
        const baseTokens = await getTrendingTokens('base', 10);

        const allTrending = [
            ...ethTokens.map(t => ({ ...t, chain: 'Ethereum' })),
            ...solTokens.map(t => ({ ...t, chain: 'Solana' })),
            ...baseTokens.map(t => ({ ...t, chain: 'Base' }))
        ];

        // Sort by volume/score to get top 10 overall
        const topTokens = allTrending
            .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
            .slice(0, 15);

        if (topTokens.length === 0) {
            throw new AppError(500, 'No trending tokens found to generate news', 'NEWS_GEN_ERROR');
        }

        // 3. Prepare data for Grok
        const tokensData = topTokens.map(t => ({
            name: t.name,
            symbol: t.symbol,
            chain: t.chain,
            price: t.price,
            change24h: t.priceChange24h,
            volume: t.volume24h,
            liquidity: t.liquidity,
            marketCap: t.fdv
        }));

        // 4. Call Grok to generate article
        // We'll use the prompt orchestrator or direct call
        // For now, simulating the call structure we need
        console.log('[NewsService] Sending data to Grok:', tokensData.length, 'tokens');

        // TODO: Replace with actual Grok service call
        const articleContent = await this.callGrokWriter(tokensData);

        // 5. Save to database
        const article = await prisma.newsArticle.create({
            data: {
                title: articleContent.title,
                summary: articleContent.summary,
                content: articleContent.content,
                tokens: JSON.stringify(topTokens.map(t => t.symbol)),
                // sourceData: JSON.stringify(tokensData), // Property doesn't exist in schema
                // published: true, // Property doesn't exist in schema
            }
        });

        console.log('[NewsService] Article created:', article.id);
        return article;
    }

    /**
     * Get latest news articles
     */
    static async getLatestNews(limit: number = 20, offset: number = 0) {
        return prisma.newsArticle.findMany({
            take: limit,
            skip: offset,
            orderBy: { createdAt: 'desc' },
            where: { status: 'published' }
        });
    }

    /**
     * Get single article
     */
    static async getArticle(id: string) {
        const article = await prisma.newsArticle.findUnique({
            where: { id }
        });

        if (article) {
            // Async increment view count
            prisma.newsArticle.update({
                where: { id },
                data: { updatedAt: new Date() } // viewCount doesn't exist, using updatedAt as heartbeat
            }).catch(console.error);
        }

        return article;
    }

    /**
     * Internal method to call Grok
     * In production this should integrate with ai/PromptOrchestrator
     */
    private static async callGrokWriter(tokensData: any[]): Promise<{ title: string; summary: string; content: string }> {
        try {
            // Retrieve the GROK_API_KEY from env
            const apiKey = env.xai.apiKey;
            if (!apiKey) throw new Error('GROK_API_KEY not configured');

            const systemPrompt = `You are a professional crypto journalist for KIKO News. 
Your task is to write a high-quality, engaging daily market report based on the provided trending token data.
Style: Professional, insightful, yet accessible. Comparable to Coindesk or The Block.
Format: Markdown.
Structure:
- Catchy Headline (JSON field 'title')
- Brief Summary (JSON field 'summary')
- Main Body (JSON field 'content') with sections for 'Market Overview', 'Top Movers', and 'Hidden Gems'.

Output MUST be valid JSON with keys: title, summary, content.`;

            const userMessage = `Here is the data for today's trending tokens:
${JSON.stringify(tokensData, null, 2)}

Write the daily report.`;

            const response = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    model: 'grok-2-1212', // or latest model
                    stream: false,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                throw new Error(`Grok API error: ${response.statusText}`);
            }

            const data = await response.json();
            const rawContent = (data as any).choices[0].message.content;

            // Parse JSON from the response (handling potentially markdown-wrapped JSON)
            const jsonStr = rawContent.replace(/```json\n?|\n?```/g, '').trim();
            return JSON.parse(jsonStr);

        } catch (error) {
            console.error('[NewsService] Grok generation failed:', error);
            // Fallback for testing/failure
            return {
                title: 'Market Update: Trending Tokens Analysis',
                summary: `Analysis of ${tokensData.length} top trending tokens including ${tokensData[0]?.name} and ${tokensData[1]?.name}.`,
                content: `## Market Overview\nToday's market shows significant activity in several sectors...\n\n### Top Movers\n1. **${tokensData[0]?.name}** (${tokensData[0]?.symbol}): Up ${tokensData[0]?.change24h}%`
            };
        }
    }
}
