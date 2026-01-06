import { pool } from '../db/connection.js';
import prisma from '../lib/prisma.js';

export const query = (text: string, params?: any[]) => pool.query(text, params);

export interface MonitoredWallet {
    id: number;
    userId: string;
    address: string;
    alias?: string | null;
    labels: string[];
    chain: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface WalletStats {
    address: string;
    win_rate: number;
    total_pnl: number;
    total_value: number;
    sharpe_ratio: number;
    max_drawdown: number;
    last_updated: Date;
}

export interface WalletTransaction {
    id: number;
    wallet_address: string;
    tx_hash: string;
    token_symbol: string;
    token_address: string;
    action: string;
    amount: number;
    price: number;
    value_usd: number;
    timestamp: Date;
}

/**
 * Add a wallet to be monitored
 */
export async function addWatchedWallet(wallet: {
    userId: string;
    address: string;
    alias?: string;
    labels?: string[];
    chain?: string;
}): Promise<MonitoredWallet> {
    const { userId, address, alias, labels = [], chain = 'eth' } = wallet;

    return await (prisma as any).watchedWallet.upsert({
        where: {
            userId_address: {
                userId,
                address: address.toLowerCase()
            }
        },
        update: {
            alias,
            labels,
            chain
        },
        create: {
            userId,
            address: address.toLowerCase(),
            alias,
            labels,
            chain
        }
    });
}

/**
 * Get all monitored wallets for a user
 */
export async function getWatchedWallets(userId: string): Promise<MonitoredWallet[]> {
    try {
        return await (prisma as any).watchedWallet.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
    } catch (error) {
        console.error('[WalletRepository] Error getting watched wallets:', error);
        return [];
    }
}

/**
 * Legacy compatibility: alias for getWatchedWallets
 */
export async function getWallets(userId: string): Promise<MonitoredWallet[]> {
    return getWatchedWallets(userId);
}

/**
 * Get transaction feed for user's watched wallets
 */
export async function getTransactionFeed(userId: string, options: { limit?: number; offset?: number } = {}) {
    try {
        const { limit = 50, offset = 0 } = options;

        const wallets = await getWatchedWallets(userId);
        const addresses = wallets.map(w => w.address.toLowerCase());

        if (addresses.length === 0) return [];

        const result = await query(
            `SELECT * FROM wallet_transactions 
             WHERE LOWER(wallet_address) = ANY($1)
             ORDER BY timestamp DESC 
             LIMIT $2 OFFSET $3`,
            [addresses, limit, offset]
        );

        return result.rows;
    } catch (error) {
        console.error('[WalletRepository] Error getting transaction feed:', error);
        return [];
    }
}

/**
 * Update a watched wallet
 */
export async function updateWatchedWallet(id: number, data: { alias?: string; labels?: string[]; chain?: string }) {
    try {
        return await (prisma as any).watchedWallet.update({
            where: { id },
            data
        });
    } catch (error) {
        console.error('[WalletRepository] Error updating watched wallet:', error);
        return null;
    }
}

/**
 * Remove a watched wallet
 */
export async function removeWatchedWallet(id: number, userId: string) {
    try {
        const result = await (prisma as any).watchedWallet.deleteMany({
            where: { id, userId }
        });
        return result.count > 0;
    } catch (error) {
        console.error('[WalletRepository] Error removing watched wallet:', error);
        return false;
    }
}

/**
 * Save wallet performance stats
 */
export async function saveWalletStats(stats: WalletStats) {
    try {
        const { address, win_rate, total_pnl, total_value, sharpe_ratio, max_drawdown } = stats;

        await query(
            `INSERT INTO wallet_stats(address, win_rate, total_pnl, total_value, sharpe_ratio, max_drawdown, last_updated)
             VALUES($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT(address) DO UPDATE SET
             win_rate = EXCLUDED.win_rate,
             total_pnl = EXCLUDED.total_pnl,
             total_value = EXCLUDED.total_value,
             sharpe_ratio = EXCLUDED.sharpe_ratio,
             max_drawdown = EXCLUDED.max_drawdown,
             last_updated = NOW()`,
            [address.toLowerCase(), win_rate, total_pnl, total_value, sharpe_ratio, max_drawdown]
        );
    } catch (error) {
        console.error('[WalletRepository] Error saving wallet stats:', error);
    }
}

/**
 * Save detailed wallet transactions
 */
export async function saveWalletTransactions(transactions: Partial<WalletTransaction>[]) {
    try {
        for (const tx of transactions) {
            await query(
                `INSERT INTO wallet_transactions
                 (wallet_address, tx_hash, token_symbol, token_address, action, amount, price, value_usd, timestamp)
                 VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT(wallet_address, tx_hash) DO NOTHING`,
                [
                    tx.wallet_address?.toLowerCase(),
                    tx.tx_hash,
                    tx.token_symbol,
                    tx.token_address,
                    tx.action,
                    tx.amount,
                    tx.price,
                    tx.value_usd,
                    tx.timestamp
                ]
            );
        }
    } catch (error) {
        console.error('[WalletRepository] Error saving wallet transactions:', error);
    }
}

export const walletRepository = {
    addWatchedWallet,
    getWatchedWallets,
    getWallets,
    getTransactionFeed,
    updateWatchedWallet,
    removeWatchedWallet,
    saveWalletStats,
    saveWalletTransactions
};
