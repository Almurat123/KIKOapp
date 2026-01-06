import { prisma } from '../db/prisma.js';

/**
 * Get reconst PORT = (process as any).env.PORT || 3001;
 */
export async function getRecentNews(limit: number = 20) {
    return prisma.newsArticle.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' }
    });
}

export async function saveFlashNews(data: any) { return; }
export async function saveNewsArticles(data: any) { return; }
export async function cleanupOldFlashNews() { return 0; }
