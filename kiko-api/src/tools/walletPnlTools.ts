import { Tool } from './registry.js';
import * as walletPnl from '../services/walletPnl.js';
import * as tokenAnalysis from '../services/tokenAnalysis.js';

/**
 * Tool to analyze wallet PnL (EVM and Solana)
 */
export const AnalyzeWalletPnlTool: Tool = {
    definition: {
        name: 'analyze_wallet_pnl',
        description: 'Analyze a wallet\'s trading performance, profit and loss (PnL), and win rate. Supports EVM chains (eth, base, bsc, arbitrum, etc.) and Solana. Use this when a user asks "How is this wallet performing?" or "What is the PnL of 0x...?"',
        parameters: {
            type: 'object',
            properties: {
                address: {
                    type: 'string',
                    description: 'The wallet address to analyze.'
                },
                chain: {
                    type: 'string',
                    description: 'The blockchain network (e.g., eth, base, solana, bsc). Default is base.'
                }
            },
            required: ['address']
        }
    },
    handler: async (args) => {
        try {
            const { address, chain = 'base' } = args;
            const result = await walletPnl.analyzeWalletPnL(address, chain);

            // Format for AI readability
            return {
                address: result.address,
                chain: result.chain,
                summary: {
                    totalRealizedPnl: `$${result.summary.totalRealizedPnl.toFixed(2)}`,
                    totalUnrealizedPnl: `$${result.summary.totalUnrealizedPnl.toFixed(2)}`,
                    winRate: `${result.summary.winRate.toFixed(1)}%`,
                    tradesCount: result.summary.tradesCount
                },
                topTokens: result.tokens
                    .sort((a, b) => (b.realizedPnl + b.unrealizedPnl) - (a.realizedPnl + a.unrealizedPnl))
                    .slice(0, 5)
                    .map(t => ({
                        symbol: t.symbol,
                        address: t.address,
                        totalPnl: `$${(t.realizedPnl + t.unrealizedPnl).toFixed(2)}`,
                        realizedPnl: `$${t.realizedPnl.toFixed(2)}`,
                        unrealizedPnl: `$${t.unrealizedPnl.toFixed(2)}`,
                        balance: t.holdingBalance.toFixed(4)
                    }))
            };
        } catch (error: any) {
            console.error('[AnalyzeWalletPnlTool] Error:', error);
            return { error: `Failed to analyze wallet: ${error.message}` };
        }
    }
};

/**
 * Tool to get early buyers of a token
 */
export const GetTokenEarlyBuyersTool: Tool = {
    definition: {
        name: 'get_token_early_buyers',
        description: 'Get the earliest buyers of a specific token. Use this to identify "smart money" or early adopters of a new coin.',
        parameters: {
            type: 'object',
            properties: {
                tokenAddress: {
                    type: 'string',
                    description: 'The contract address of the token.'
                },
                chain: {
                    type: 'string',
                    description: 'The blockchain network (e.g., eth, base, solana).'
                },
                limit: {
                    type: 'number',
                    description: 'Number of buyers to return (default 10).'
                }
            },
            required: ['tokenAddress', 'chain']
        }
    },
    handler: async (args) => {
        try {
            const { tokenAddress, chain, limit = 10 } = args;
            const buyers = await tokenAnalysis.getEarlyBuyers(tokenAddress, chain, limit);

            return {
                tokenAddress,
                chain,
                buyers: buyers.map(b => ({
                    address: b.address,
                    timestamp: b.timestamp.toISOString(),
                    amount: b.amount,
                    txHash: b.txHash
                }))
            };
        } catch (error: any) {
            console.error('[GetTokenEarlyBuyersTool] Error:', error);
            return { error: `Failed to get early buyers: ${error.message}` };
        }
    }
};

/**
 * Tool to get top traders of a token by PnL
 */
export const GetTokenTopTradersTool: Tool = {
    definition: {
        name: 'get_token_top_traders',
        description: 'Get the top traders (highest PnL) for a specific token. Use this to see who made the most profit on a coin.',
        parameters: {
            type: 'object',
            properties: {
                tokenAddress: {
                    type: 'string',
                    description: 'The contract address of the token.'
                },
                chain: {
                    type: 'string',
                    description: 'The blockchain network (e.g., eth, base, solana).'
                },
                limit: {
                    type: 'number',
                    description: 'Number of traders to return (default 10).'
                }
            },
            required: ['tokenAddress', 'chain']
        }
    },
    handler: async (args) => {
        try {
            const { tokenAddress, chain, limit = 10 } = args;
            const traders = await tokenAnalysis.getTopTraders(tokenAddress, chain, limit);

            return {
                tokenAddress,
                chain,
                traders: traders.map(t => ({
                    address: t.address,
                    pnlUsd: `$${t.pnlUsd.toFixed(2)}`,
                    volumeUsd: `$${t.volumeUsd.toFixed(2)}`,
                    tradesCount: t.tradesCount
                }))
            };
        } catch (error: any) {
            console.error('[GetTokenTopTradersTool] Error:', error);
            return { error: `Failed to get top traders: ${error.message}` };
        }
    }
};
