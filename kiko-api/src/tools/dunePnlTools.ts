import { Tool } from './registry.js';
import * as dunePnlService from '../services/dunePnlService.js';

/**
 * Dune PNL Tool
 * Allows the AI to analyze wallet trading profitability using Dune Analytics data.
 */
export const AnalyzeWalletPnlTool: Tool = {
    definition: {
        name: 'analyze_wallet_pnl',
        description: 'Analyze wallet trading performance (PNL, win rate, top tokens) using Dune Analytics. Provides real-time realized PNL data for EVM chains.',
        parameters: {
            type: 'object',
            properties: {
                address: {
                    type: 'string',
                    description: 'The wallet address to analyze (EVM only).',
                },
                chain: {
                    type: 'string',
                    description: 'Blockchain network (ethereum, base, bnb, polygon, arbitrum, optimism). If not provided, will check Ethereum or the current context chain.',
                },
                days: {
                    type: 'number',
                    description: 'Time range for analysis in days (e.g., 7, 30, 90). Default is 30.',
                    enum: [7, 30, 90],
                    default: 30
                }
            },
            required: ['address']
        }
    },
    handler: async (args, context) => {
        try {
            const address = args.address;
            const chain = args.chain || 'ethereum';
            const days = args.days || 30;

            console.log(`[AnalyzeWalletPnlTool] Analyzing ${address} on ${chain} for ${days} days`);

            const result = await dunePnlService.getWalletPnlFromDune(address, chain, days);

            if (!result) {
                return {
                    error: `Failed to fetch PNL data from Dune for address ${address} on ${chain}.`
                };
            }

            return {
                address: result.walletAddress,
                chain: result.chain,
                timeRange: `${days} days`,
                summary: {
                    totalRealizedPnlUsd: result.totalRealizedPnlUsd,
                    totalBoughtUsd: result.totalBoughtUsd,
                    totalSoldUsd: result.totalSoldUsd,
                    winRate: result.winRate,
                    totalTrades: result.totalTrades,
                    profitableTrades: result.profitableTrades
                },
                topTokens: result.tokens.map(t => ({
                    token: t.tokenSymbol || t.tokenAddress,
                    address: t.tokenAddress,
                    pnlUsd: t.pnlUsd,
                    profitPercentage: t.profitPct !== null ? `${t.profitPct.toFixed(2)}%` : 'N/A',
                    boughtUsd: t.boughtUsd,
                    soldUsd: t.soldUsd
                }))
            };

        } catch (error: any) {
            console.error('[AnalyzeWalletPnlTool] Error:', error);
            return { error: `Failed to analyze wallet PNL: ${error.message}` };
        }
    }
};
