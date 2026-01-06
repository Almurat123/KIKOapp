import { prisma } from '../../lib/prisma.js';
import { collectTrendingTokens } from './trendingCollector.js';
import { generateCoverImage } from './coverImageGenerator.js';
import { reviewContent } from './contentReviewer.js';
import { publishToParagraph } from './paragraphPublisher.js';
import fetch from 'node-fetch';

const GROK_SERVICE_URL = process.env.GROK_SERVICE_URL || 'http://localhost:8001';

export async function generateNewsArticle(manualTrigger = false) {
    console.log('[NewsGen] Starting news generation cycle...');

    try {
        // 1. Build Exclusion List (Cooldown Logic)
        // Fetch tokens covered in the last 3 days to avoid repetition
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const recentArticles = await prisma.newsArticle.findMany({
            where: {
                createdAt: { gt: threeDaysAgo },
                status: { not: 'rejected' } // Only count approved/published articles
            },
            select: { tokens: true }
        });

        const exclusionList = new Set<string>();
        recentArticles.forEach(article => {
            try {
                // tokens is stored as JSON string in DB
                const tokens = JSON.parse(article.tokens as string);
                if (Array.isArray(tokens)) {
                    tokens.forEach((t: any) => {
                        if (t.symbol) exclusionList.add(t.symbol.toUpperCase());
                    });
                }
            } catch (e) {
                // Ignore parsing errors
            }
        });

        // 2. Collect Data with filtering
        const data = await collectTrendingTokens(exclusionList);
        if (data.tokens.length === 0) {
            console.log('[NewsGen] No tokens found, aborting.');
            return;
        }

        // 2. Generate Content via Grok Service (Internal API Call)
        // Note: Using node-fetch to call Python service
        console.log('[NewsGen] Requesting content from Grok...');
        const grokResponse = await fetch(`${GROK_SERVICE_URL}/chat/write_news`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokens: data.tokens })
        });

        if (!grokResponse.ok) {
            throw new Error(`Grok service failed: ${grokResponse.statusText}`);
        }

        const grokResult = await grokResponse.json() as { content: string };
        const markdownContent = grokResult.content;

        // Extract title - Try multiple patterns:
        // 1. Bold quoted title: **"Today's trending token..."** (new format)
        // 2. H1 header: # Title (traditional markdown)
        // 3. First non-empty line (fallback)
        let title = `KIKO Market Watch - ${new Date().toLocaleDateString()}`;

        // Try bold quoted format first (new AI output format)
        const boldTitleMatch = markdownContent.match(/\*\*[""]([^""]+)[""]\.?\*\*/);
        if (boldTitleMatch) {
            title = boldTitleMatch[1].trim();
        } else {
            // Try H1 header format
            const h1Match = markdownContent.match(/^#\s+(.+)$/m);
            if (h1Match) {
                title = h1Match[1].replace(/[*"]/g, '').trim();
            } else {
                // Fallback to first non-empty line
                const firstLine = markdownContent.split('\n').find(line => line.trim());
                if (firstLine) {
                    title = firstLine.replace(/[*#"]/g, '').trim();
                }
            }
        }
        console.log(`[NewsGen] Extracted title: "${title}"`);

        // 3. Generate Cover Image
        let coverImageUrl = '';
        try {
            coverImageUrl = await generateCoverImage(data);
        } catch (e) {
            console.error('[NewsGen] Cover image generation failed, continuing without it.', e);
        }

        // 4. Content Review
        const review = reviewContent(markdownContent);
        let status = review.approved ? 'approved' : 'rejected';

        // 5. Save to Database
        const article = await prisma.newsArticle.create({
            data: {
                title,
                content: markdownContent,
                coverImage: coverImageUrl,
                status: status,
                rejectionReason: review.reason,
                tokens: JSON.stringify(data.tokens),
                chains: JSON.stringify(data.chains),
                slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now()
            }
        });

        console.log(`[NewsGen] Article saved to DB: ${article.id} (${status})`);

        // 6. Publish to Paragraph (if approved)
        if (status === 'approved') {
            console.log('[NewsGen] Publishing to Paragraph...');
            // IMPORTANT: For Paragraph to see the image, it needs to be a public URL.
            // If we are running locally, we can't really pass the localhost URL.
            // We might need to upload it or just publish without image for dev.
            // Or if we have a public URL for Kiko API (like ngrok), we use that.
            // For now, we pass the local path string? No, Paragraph SDK needs URL.
            // We will skip image in Paragraph for local dev, or pass valid URL if we had S3.
            // Current implementation of paragraphPublisher handles logic/errors.

            // To make it work in dev:
            // We'll just pass null for image if it's local file path
            const publicImageUrl = coverImageUrl.startsWith('http') ? coverImageUrl : undefined;

            const pubResult = await publishToParagraph(title, markdownContent, publicImageUrl);

            if (pubResult) {
                await prisma.newsArticle.update({
                    where: { id: article.id },
                    data: {
                        status: 'published',
                        publishedAt: new Date(),
                        paragraphId: pubResult.id,
                        paragraphUrl: pubResult.url
                    }
                });
                console.log(`[NewsGen] Published successfully: ${pubResult.url}`);
            }
        }

        return article;

    } catch (error) {
        console.error('[NewsGen] Critical error in generation cycle:', error);
        throw error;
    }
}
