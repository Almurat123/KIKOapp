/**
 * Polymarket Copy Trade AI Tools
 * Tools for AI to create and manage Polymarket copy trade configurations
 */

import { Tool } from '../../../tools/registry.js';
import prisma from '../../../db/prisma.js';
import { getWalletPositions, getWalletStats } from '../../../services/polymarketDataService.js';

/**
 * Create Polymarket Copy Config Tool
 */
export const CreatePolymarketCopyConfigTool: Tool = {
    definition: {
        name: 'create_polymarket_copy_config',
        description: 'Create a copy trade configuration to follow a Polymarket trader. Use when user says "copy this trader on Polymarket", "follow this prediction market whale", or provides a Polymarket profile URL/wallet.',
        parameters: {
            type: 'object',
            properties: {
                target_wallet: {
                    type: 'string',
                    description: 'The wallet address of the trader to copy (0x... format).'
                },
                bet_size_usd: {
                    type: 'number',
                    description: 'Amount in USD to bet per copied trade. Default is 10.'
                },
                mirror_sell: {
                    type: 'boolean',
                    description: 'Whether to also sell when the target sells. Default true.'
                }
            },
            required: ['target_wallet']
        }
    },
    handler: async (args: { target_wallet: string; bet_size_usd?: number; mirror_sell?: boolean }, context) => {
        const userId = context?.userId;
        const walletAddress = context?.walletAddress;

        if (!userId) {
            throw new Error('User authentication required');
        }

        const targetWallet = args.target_wallet.toLowerCase();
        const betSizeUsd = args.bet_size_usd || 10;
        const mirrorSell = args.mirror_sell !== false;

        // Ensure user exists and get internal ID
        let user = await prisma.user.findUnique({
            where: { privyDid: userId },
        });

        if (!user) {
            console.log(`[Tool] User ${userId} not found, creating new user record...`);
            // NOTE: In our Prisma schema, `walletAddress` is required and unique.
            // If the incoming walletAddress is already associated with a different privyDid,
            // we must avoid violating the unique constraint by using a synthetic placeholder.
            let resolvedWalletAddress = walletAddress || `simulated-${Date.now()}`;
            if (walletAddress) {
                const existingByWallet = await prisma.user.findUnique({ where: { walletAddress } });
                if (existingByWallet) {
                    console.warn('[Tool] walletAddress already belongs to another user; using synthetic walletAddress', {
                        walletAddress: walletAddress.slice(0, 10) + '...',
                    });
                    resolvedWalletAddress = `simulated-${Date.now()}`;
                }
            }

            user = await prisma.user.create({
                data: {
                    privyDid: userId,
                    walletAddress: resolvedWalletAddress,
                },
            });
        }

        // Check if config already exists
        const existingConfig = await prisma.polymarketCopyConfig.findFirst({
            where: { userId: user.privyDid, targetWallet }
        });

        if (existingConfig) {
            return {
                success: false,
                message: 'You are already following this trader.',
                existing_config: {
                    id: existingConfig.id,
                    target: existingConfig.targetWallet.slice(0, 10) + '...',
                    bet_size: `$${existingConfig.betSizeUsd}`,
                    status: existingConfig.status
                }
            };
        }

        // Get target's current positions for display
        let positions: any[] = [];
        try {
            positions = await getWalletPositions(targetWallet);
        } catch (e) {
            console.warn('Failed to fetch target positions:', e);
        }

        // Create config
        const config = await prisma.polymarketCopyConfig.create({
            data: {
                userId: user.privyDid,
                targetWallet,
                betSizeUsd,
                mirrorSell,
                status: 'active'
            }
        });

        return {
            success: true,
            message: `Now following Polymarket trader ${targetWallet.slice(0, 8)}...`,
            config: {
                id: config.id,
                target_wallet: targetWallet.slice(0, 10) + '...',
                bet_size: `$${betSizeUsd}`,
                mirror_sell: mirrorSell
            },
            target_info: {
                current_positions: positions.length,
                sample_positions: positions.slice(0, 3).map(p => ({
                    market: p.title.slice(0, 50),
                    outcome: p.outcome,
                    size: p.size.toLocaleString() + ' shares'
                }))
            },
            note: 'You will automatically copy new bets from this trader.'
        };
    },
    permissions: 'authenticated'
};

/**
 * List Polymarket Positions Tool
 */
export const ListPolymarketPositionsTool: Tool = {
    definition: {
        name: 'list_polymarket_positions',
        description: 'List all Polymarket prediction market positions from copy trading. Shows current bets, P/L, and market status.',
        parameters: {
            type: 'object',
            properties: {
                status: {
                    type: 'string',
                    description: 'Filter by status: "open", "closed", or "all". Default is "open".',
                    enum: ['open', 'closed', 'all']
                }
            },
            required: []
        }
    },
    handler: async (args: { status?: string }, context) => {
        const userId = context?.userId;
        if (!userId) {
            throw new Error('User authentication required');
        }

        const user = await prisma.user.findUnique({
            where: { privyDid: userId },
        });

        if (!user) {
            return { message: "User not found within system." };
        }

        const statusFilter = args.status || 'open';

        const positions = await prisma.polymarketPosition.findMany({
            where: {
                userId: user.privyDid, // Use internal ID
                ...(statusFilter !== 'all' ? { status: statusFilter } : {})
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        if (positions.length === 0) {
            return {
                message: `No ${statusFilter} Polymarket positions found.`,
                tip: 'Use create_polymarket_copy_config to start following a trader.'
            };
        }

        return {
            count: positions.length,
            positions: positions.map(p => ({
                id: p.id.slice(-6),
                question: p.question.slice(0, 60),
                outcome: p.outcome,
                entry_price: `$${p.entryPrice.toFixed(2)}`,
                shares: p.shares.toFixed(1),
                cost: `$${p.costBasis.toFixed(2)}`,
                status: p.status,
                pnl: p.profitLossPct ? `${p.profitLossPct > 0 ? '+' : ''}${p.profitLossPct.toFixed(1)}%` : 'N/A'
            }))
        };
    },
    permissions: 'authenticated'
};

/**
 * Get Trader Stats Tool
 */
export const GetPolymarketTraderStatsTool: Tool = {
    definition: {
        name: 'get_polymarket_trader_stats',
        description: 'Get statistics for a Polymarket trader (positions, volume, etc.). Use to evaluate a trader before copying.',
        parameters: {
            type: 'object',
            properties: {
                wallet: {
                    type: 'string',
                    description: 'The wallet address of the trader (0x... format).'
                }
            },
            required: ['wallet']
        }
    },
    handler: async (args: { wallet: string }) => {
        const wallet = args.wallet.toLowerCase();

        try {
            const [positions, stats] = await Promise.all([
                getWalletPositions(wallet),
                getWalletStats(wallet)
            ]);

            // Calculate some derived stats from positions
            const openPositions = positions.filter(p => p.size > 0);
            const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
            const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);

            return {
                wallet: wallet.slice(0, 10) + '...',
                open_positions: openPositions.length,
                total_value: `$${totalValue.toLocaleString()}`,
                total_pnl: `$${totalPnl.toLocaleString()}`,
                top_positions: openPositions.slice(0, 5).map(p => ({
                    market: p.title.slice(0, 50),
                    outcome: p.outcome,
                    size: Math.floor(p.size).toLocaleString(),
                    entry: `$${p.avgPrice.toFixed(2)}`,
                    pnl: `$${p.pnl.toFixed(0)}`
                }))
            };
        } catch (error: any) {
            console.warn('[GetPolymarketTraderStats] Error:', error.message);
            // Return empty/warning instead of throwing hard error for tool usage
            return {
                wallet: wallet,
                note: 'Could not fetch detailed stats (API limit or invalid wallet).',
                error: error.message
            };
        }
    },
    permissions: 'public'
};
