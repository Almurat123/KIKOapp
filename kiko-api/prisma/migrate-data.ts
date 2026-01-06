/**
 * SQLite to PostgreSQL Data Migration Script
 * 
 * Run with: DATABASE_URL="postgresql://..." npx ts-node prisma/migrate-data.ts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    console.log('[Migration] Starting data import to PostgreSQL...');

    // Read backup files
    const users = JSON.parse(fs.readFileSync('/tmp/sqlite_backup_user.json', 'utf8'));
    const userSettings = JSON.parse(fs.readFileSync('/tmp/sqlite_backup_usersettings.json', 'utf8') || '[]');
    const chatSessions = JSON.parse(fs.readFileSync('/tmp/sqlite_backup_chatsession.json', 'utf8'));
    const chatMessages = JSON.parse(fs.readFileSync('/tmp/sqlite_backup_chatmessage.json', 'utf8'));
    const newsArticles = JSON.parse(fs.readFileSync('/tmp/sqlite_backup_newsarticle.json', 'utf8'));

    // Import Users
    console.log(`[Migration] Importing ${users.length} users...`);
    for (const user of users) {
        await prisma.user.upsert({
            where: { id: user.id },
            update: {},
            create: {
                id: user.id,
                privyDid: user.privyDid,
                walletAddress: user.walletAddress,
                solanaWalletAddress: user.solanaWalletAddress,
                createdAt: new Date(user.createdAt),
            }
        });
    }

    // Import UserSettings
    console.log(`[Migration] Importing ${userSettings.length} user settings...`);
    for (const settings of userSettings) {
        await prisma.userSettings.upsert({
            where: { userId: settings.userId },
            update: {},
            create: {
                id: settings.id,
                userId: settings.userId,
                userRole: settings.userRole || 'default',
                defaultSwapAmount: settings.defaultSwapAmount || 100,
                defaultSwapUnit: settings.defaultSwapUnit || 'native',
                checkTokenBeforeSwap: Boolean(settings.checkTokenBeforeSwap ?? true),
                quickSwapMode: Boolean(settings.quickSwapMode ?? false),
                swapMethod: settings.swapMethod || 'swap_card',
                slippageMode: settings.slippageMode || 'auto',
                customSlippage: settings.customSlippage || 0.5,
                mevProtection: Boolean(settings.mevProtection ?? true),
                priceDeviationCheck: Boolean(settings.priceDeviationCheck ?? true),
                copyTradeAIMode: settings.copyTradeAIMode || 'disabled',
                fastSwapMode: Boolean(settings.fastSwapMode ?? false),
            }
        });
    }

    // Import ChatSessions
    console.log(`[Migration] Importing ${chatSessions.length} chat sessions...`);
    for (const session of chatSessions) {
        await prisma.chatSession.upsert({
            where: { id: session.id },
            update: {},
            create: {
                id: session.id,
                userId: session.userId,
                title: session.title,
                model: session.model || 'grok-2-1212',
                status: session.status || 'active',
                createdAt: new Date(session.createdAt),
                updatedAt: new Date(session.updatedAt),
            }
        });
    }

    // Import ChatMessages
    console.log(`[Migration] Importing ${chatMessages.length} chat messages...`);
    for (const msg of chatMessages) {
        await prisma.chatMessage.upsert({
            where: { id: msg.id },
            update: {},
            create: {
                id: msg.id,
                sessionId: msg.sessionId,
                role: msg.role,
                content: msg.content,
                reasoningContent: msg.reasoningContent,
                citations: msg.citations,
                usage: msg.usage,
                toolCalls: msg.toolCalls,
                toolCallId: msg.toolCallId,
                messageIndex: msg.messageIndex,
                status: msg.status || 'complete',
                createdAt: new Date(msg.createdAt),
            }
        });
    }

    // Import NewsArticles
    console.log(`[Migration] Importing ${newsArticles.length} news articles...`);
    for (const article of newsArticles) {
        await prisma.newsArticle.upsert({
            where: { id: article.id },
            update: {},
            create: {
                id: article.id,
                title: article.title,
                slug: article.slug,
                summary: article.summary,
                content: article.content,
                coverImage: article.coverImage,
                tokens: article.tokens,
                chains: article.chains,
                status: article.status || 'pending',
                rejectionReason: article.rejectionReason,
                paragraphId: article.paragraphId,
                paragraphUrl: article.paragraphUrl,
                publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
                createdAt: new Date(article.createdAt),
                updatedAt: new Date(article.updatedAt),
            }
        });
    }

    console.log('[Migration] ✅ Data import completed successfully!');
}

main()
    .catch((e) => {
        console.error('[Migration] ❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
