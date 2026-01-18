import prisma from '../db/prisma.js';
import { normalizeAddress } from '../utils/address.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

/**
 * Record a new trade execution for a leader wallet
 * Updates volume and trade counts
 */
export async function recordNewTrade(
    rawAddress: string,
    chainId: number,
    type: 'buy' | 'sell',
    volumeUsd: number
) {
    const address = normalizeAddress(rawAddress);
    try {
        // Manual upsert to avoid issues with unique constraint mapping in Prisma
        const existing = await prisma.leaderWalletStats.findUnique({
            where: {
                address_chainId: { address, chainId }
            }
        });

        if (existing) {
            return await prisma.leaderWalletStats.update({
                where: {
                    address_chainId: { address, chainId }
                },
                data: {
                    totalTrades: { increment: 1 },
                    buyTrades: type === 'buy' ? { increment: 1 } : undefined,
                    sellTrades: type === 'sell' ? { increment: 1 } : undefined,
                    totalVolumeUsd: { increment: volumeUsd },
                    lastTradeAt: new Date()
                }
            });
        } else {
            return await prisma.leaderWalletStats.create({
                data: {
                    address,
                    chainId,
                    totalTrades: 1,
                    buyTrades: type === 'buy' ? 1 : 0,
                    sellTrades: type === 'sell' ? 1 : 0,
                    totalVolumeUsd: volumeUsd,
                    firstTradeAt: new Date(),
                    lastTradeAt: new Date()
                }
            });
        }
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'LeaderStats: Failed to record new trade', { address, error: error.message });
    }
}

/**
 * Record the result of a closed trade (PnL update)
 * Updates PnL, Win/Loss counts, and Win Rate
 */
export async function recordTradeResult(
    rawAddress: string,
    chainId: number,
    pnlUsd: number
) {
    const address = normalizeAddress(rawAddress);
    try {
        // First get current stats to calculate new min/max/avg
        const current = await prisma.leaderWalletStats.findUnique({
            where: { address_chainId: { address, chainId } }
        });

        if (!current) {
            logger.warn(LogCode.SYS_INFO, 'LeaderStats: No stats found to update PnL', { address });
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

    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'LeaderStats: Failed to record trade result', { address, error: error.message });
    }
}
