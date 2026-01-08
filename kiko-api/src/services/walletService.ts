import { walletRepository, MonitoredWallet, WalletStats, WalletTransaction } from '../repositories/walletRepository.js';
import { getWalletTransactions as fetchAlchemyTransactions, WalletBalance, getPortfolio } from './alchemy.js';

// Mock data generator for simulation
const generateMockStats = (address: string): WalletStats => ({
    address,
    win_rate: 0.65,
    total_pnl: 1250.50,
    total_value: 5000.00,
    sharpe_ratio: 1.85,
    max_drawdown: 0.12,
    last_updated: new Date()
});

export const walletService = {
    /**
     * Get all monitored wallets for a user (public for UI)
     */
    async getMonitoredWallets(userId: string): Promise<MonitoredWallet[]> {
        return await walletRepository.getWatchedWallets(userId);
    },

    /**
     * Add a wallet to monitor
     */
    async monitorWallet(params: {
        userId: string;
        address: string;
        alias?: string;
        labels?: string[];
        chain?: string;
    }): Promise<MonitoredWallet> {
        return await walletRepository.addWatchedWallet(params);
    },

    /**
     * Unmonitor a wallet
     */
    async stopMonitoring(id: number, userId: string): Promise<boolean> {
        return await walletRepository.removeWatchedWallet(id, userId);
    },

    /**
     * Update wallet performance stats from processing
     */
    async updatePerformanceStats(address: string, stats: Partial<WalletStats>): Promise<void> {
        const fullStats: WalletStats = {
            address,
            win_rate: stats.win_rate || 0,
            total_pnl: stats.total_pnl || 0,
            total_value: stats.total_value || 0,
            sharpe_ratio: stats.sharpe_ratio || 0,
            max_drawdown: stats.max_drawdown || 0,
            last_updated: new Date()
        };
        await walletRepository.saveWalletStats(fullStats);
    },

    /**
     * Sync transactions from on-chain to DB
     */
    async syncTransactions(txs: Partial<WalletTransaction>[]): Promise<void> {
        await walletRepository.saveWalletTransactions(txs);
    },

    /**
     * Get detailed wallet report (Monitored + Stats)
     */
    async getWalletDetails(userId: string, address: string): Promise<{ wallet: MonitoredWallet | null, stats: WalletStats | null }> {
        const wallets = await walletRepository.getWatchedWallets(userId);
        const wallet = wallets.find((w: any) => w.address.toLowerCase() === address.toLowerCase()) || null;

        // In a real app, this would query the wallet_stats table
        // For now, we return mock stats or null
        return {
            wallet,
            stats: wallet ? generateMockStats(address) : null
        };
    },

    /**
     * Get transaction history for address
     */
    async getHistory(userId: string, limit: number = 50): Promise<any[]> {
        return await walletRepository.getTransactionFeed(userId, { limit });
    },

    /**
     * Get real-time balance for an address
     */
    async getWalletBalance(address: string, chain: string = 'eth'): Promise<WalletBalance> {
        const results = await getPortfolio(address, [chain]);
        return results[chain] || { ethBalance: '0', ethBalanceFormatted: 0, tokens: [] };
    },

    /**
     * Get real-time balance for all supported chains
     */
    async getAllChainBalances(address: string, solanaAddress?: string): Promise<Record<string, WalletBalance>> {
        const chains = ['eth', 'base', 'arbitrum', 'optimism', 'polygon', 'bsc', 'solana'];
        return await getPortfolio(address, chains, solanaAddress);
    },

    /**
     * Get real-time transactions for an address
     */
    async getWalletTransactions(address: string, options: { chain?: string; limit?: number } = {}): Promise<any[]> {
        return await fetchAlchemyTransactions(address, options.chain || 'eth', options.limit);
    }
};
