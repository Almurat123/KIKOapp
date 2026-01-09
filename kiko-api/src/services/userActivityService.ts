import prisma from '../db/prisma.js';

type ActivityType = 'login' | 'chat' | 'swap' | 'copyTrade';

/**
 * Track user activity for the current day
 */
export async function trackActivity(
    userId: string,
    type: ActivityType,
    data?: { volumeUsd?: number }
) {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Prepare update data based on type
        const updateData: any = {};

        // Always update lastSeenAt (if we added that field, but currently schema doesn't have it)
        // Re-checking schema: UserActivity has standard fields but I don't see lastSeenAt in schema.prisma I pushed.
        // I will stick to the defined fields: logins, chatMessages, swapsCount, swapVolumeUsd, copyTrades.

        switch (type) {
            case 'login':
                updateData.logins = { increment: 1 };
                break;
            case 'chat':
                updateData.chatMessages = { increment: 1 };
                break;
            case 'swap':
                updateData.swapsCount = { increment: 1 };
                if (data?.volumeUsd) {
                    updateData.swapVolumeUsd = { increment: data.volumeUsd };
                }
                break;
            case 'copyTrade':
                updateData.copyTrades = { increment: 1 };
                break;
        }

        await prisma.userActivity.upsert({
            where: {
                userId_date: {
                    userId,
                    date: today
                }
            },
            update: updateData,
            create: {
                userId,
                date: today,
                logins: type === 'login' ? 1 : 0,
                chatMessages: type === 'chat' ? 1 : 0,
                swapsCount: type === 'swap' ? 1 : 0,
                swapVolumeUsd: type === 'swap' ? (data?.volumeUsd || 0) : 0,
                copyTrades: type === 'copyTrade' ? 1 : 0
            }
        });

    } catch (error) {
        console.error(`[UserActivity] Failed to track ${type} for ${userId}:`, error);
        // Don't throw, tracking shouldn't block main flow
    }
}

// Convenience wrappers
export const trackLogin = (userId: string) => trackActivity(userId, 'login');
export const trackChatMessage = (userId: string) => trackActivity(userId, 'chat');
export const trackSwap = (userId: string, volumeUsd: number) => trackActivity(userId, 'swap', { volumeUsd });
export const trackCopyTrade = (userId: string) => trackActivity(userId, 'copyTrade');

/**
 * Get activity summary for a user
 */
export async function getActivitySummary(userId: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await prisma.userActivity.findMany({
        where: {
            userId,
            date: { gte: startDate }
        },
        orderBy: { date: 'asc' }
    });
}
