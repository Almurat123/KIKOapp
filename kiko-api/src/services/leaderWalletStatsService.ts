import prisma from '../db/prisma.js';

/**
 * Record a new trade execution for a leader wallet
 * Updates volume and trade counts
 */
export async function recordNewTrade(
    address: string,
    chainId: number,
    type: 'buy' | 'sell',
    volumeUsd: number
) {
    try {
        const stats = await prisma.leaderWalletStats.upsert({
            where: {
                address_chainId: { address, chainId }
            },
            create: {
                address,
                chainId,
                totalTrades: 1,
                buyTrades: type === 'buy' ? 1 : 0,
                sellTrades: type === 'sell' ? 1 : 0,
                totalVolumeUsd: volumeUsd,
                firstTradeAt: new Date(),
                lastTradeAt: new Date()
            },
            update: {
                totalTrades: { increment: 1 },
                buyTrades: type === 'buy' ? { increment: 1 } : undefined,
                sellTrades: type === 'sell' ? { increment: 1 } : undefined,
                totalVolumeUsd: { increment: volumeUsd },
                lastTradeAt: new Date()
            }
        });
        return stats;
    } catch (error) {
        console.error(`[LeaderStats] Failed to record new trade for ${address}:`, error);
    }
}

/**
 * Record the result of a closed trade (PnL update)
 * Updates PnL, Win/Loss counts, and Win Rate
 */
export async function recordTradeResult(
    address: string,
    chainId: number,
    pnlUsd: number
) {
    try {
        // First get current stats to calculate new min/max/avg
        const current = await prisma.leaderWalletStats.findUnique({
            where: { address_chainId: { address, chainId } }
        });

        if (!current) {
            console.warn(`[LeaderStats] No stats found to update PnL for ${address}`);
            return;
        }

        // Determine if win or loss
        const isWin = pnlUsd > 0;
        const isLoss = pnlUsd < 0; // Neutral (0) doesn't count as win or loss typically, or maybe loss? keeping strictly < 0 for loss.

        // Update PnL and Counts
        const updated = await prisma.leaderWalletStats.update({
            where: { address_chainId: { address, chainId } },
            data: {
                realizedPnlUsd: { increment: pnlUsd },
                totalPnlUsd: { increment: pnlUsd }, // Assuming total = realized + unrealized, update realized increases total

                winCount: isWin ? { increment: 1 } : undefined,
                lossCount: isLoss ? { increment: 1 } : undefined,

                bestTradePnl: pnlUsd > current.bestTradePnl ? pnlUsd : undefined,
                worstTradePnl: pnlUsd < current.worstTradePnl ? pnlUsd : undefined
            }
        });

        // Recalculate derived metrics (WinRate, AvgPnl)
        // We need to fetch again or use the returned 'updated' values if Prisma supported computed updates well, 
        // but simple math here is safer manually after update or using raw query.
        // Let's doing it in a second pass to ensure accuracy with latest data.

        const winRate = updated.totalTrades > 0
            ? updated.winCount / updated.totalTrades
            : 0;

        const avgTradePnl = updated.totalTrades > 0
            ? updated.totalPnlUsd / updated.totalTrades
            : 0;

        await prisma.leaderWalletStats.update({
            where: { address_chainId: { address, chainId } },
            data: {
                winRate,
                avgTradePnl
            }
        });

    } catch (error) {
        console.error(`[LeaderStats] Failed to record trade result for ${address}:`, error);
    }
}
