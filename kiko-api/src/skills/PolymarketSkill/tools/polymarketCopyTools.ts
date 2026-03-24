/**
 * Polymarket Copy Trade AI Tools
 * Tools for AI to create and manage Polymarket copy trade configurations
 */

import { Tool } from '../../../tooling/registry.js';
import prisma from '../../../db/prisma.js';
import { getWalletPositions, getWalletStats } from '../../../services/polymarketDataService.js';
import { checkTradingReadiness } from '../../../services/polymarketApprovalService.js';

async function ensurePolymarketUser(params: {
    userId: string;
    walletAddress?: string;
}) {
    let user = await prisma.user.findUnique({
        where: { privyDid: params.userId },
    });

    if (user) return user;

    console.log(`[Tool] User ${params.userId} not found, creating new user record...`);
    let resolvedWalletAddress = params.walletAddress || `simulated-${Date.now()}`;
    if (params.walletAddress) {
        const existingByWallet = await prisma.user.findUnique({ where: { walletAddress: params.walletAddress } });
        if (existingByWallet) {
            console.warn('[Tool] walletAddress already belongs to another user; using synthetic walletAddress', {
                walletAddress: params.walletAddress.slice(0, 10) + '...',
            });
            resolvedWalletAddress = `simulated-${Date.now()}`;
        }
    }

    user = await prisma.user.create({
        data: {
            privyDid: params.userId,
            walletAddress: resolvedWalletAddress,
        },
    });

    return user;
}

async function resolveUserCopyConfig(params: {
    userId: string;
    configId?: string;
    targetWallet?: string;
}) {
    const targetWallet = params.targetWallet?.toLowerCase();
    return prisma.polymarketCopyConfig.findFirst({
        where: {
            userId: params.userId,
            ...(params.configId ? { id: params.configId } : {}),
            ...(targetWallet ? { targetWallet } : {}),
        },
        include: {
            positions: {
                select: {
                    status: true,
                    createdAt: true,
                    closedAt: true,
                }
            }
        }
    });
}

function summarizeCopyConfig(config: {
    id: string;
    targetWallet: string;
    betSizeUsd: number;
    maxOpenBets: number;
    mirrorSell: boolean;
    status: string;
    positions?: Array<{ status: string; createdAt: Date; closedAt: Date | null }>;
}) {
    const positions = config.positions || [];
    const latestPosition = positions
        .slice()
        .sort((a, b) => {
            const aTime = new Date(a.closedAt || a.createdAt).getTime();
            const bTime = new Date(b.closedAt || b.createdAt).getTime();
            return bTime - aTime;
        })[0];

    return {
        id: config.id,
        target_wallet: config.targetWallet,
        bet_size_usd: config.betSizeUsd,
        max_open_bets: config.maxOpenBets,
        mirror_sell: config.mirrorSell,
        status: config.status,
        execution_stats: {
            executed_trades: positions.length,
            open_positions: positions.filter((position) => position.status === 'open').length,
            closed_positions: positions.filter((position) => position.status === 'closed').length,
            failed_positions: positions.filter((position) => position.status === 'failed').length,
            last_copied_at: latestPosition ? (latestPosition.closedAt || latestPosition.createdAt).toISOString() : null,
        }
    };
}

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

        const user = await ensurePolymarketUser({ userId, walletAddress });

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

        let readiness: Awaited<ReturnType<typeof checkTradingReadiness>> | null = null;
        try {
            readiness = await checkTradingReadiness(user.privyDid);
        } catch (e) {
            console.warn('Failed to check Polymarket readiness before creating copy config:', e);
        }

        const initialStatus = readiness && !readiness.isReady ? 'paused' : 'active';

        // Create config
        const config = await prisma.polymarketCopyConfig.create({
            data: {
                userId: user.privyDid,
                targetWallet,
                betSizeUsd,
                mirrorSell,
                status: initialStatus
            }
        });

        return {
            success: true,
            message: initialStatus === 'active'
                ? `Now following Polymarket trader ${targetWallet.slice(0, 8)}...`
                : `Copy config created for ${targetWallet.slice(0, 8)}..., but it is paused until your Polymarket account is ready.`,
            config: {
                id: config.id,
                target_wallet: targetWallet.slice(0, 10) + '...',
                bet_size: `$${betSizeUsd}`,
                mirror_sell: mirrorSell,
                status: initialStatus
            },
            target_info: {
                current_positions: positions.length,
                sample_positions: positions.slice(0, 3).map(p => ({
                    market: p.title.slice(0, 50),
                    outcome: p.outcome,
                    size: p.size.toLocaleString() + ' shares'
                }))
            },
            readiness: readiness ? {
                ready: readiness.isReady,
                missing_steps: readiness.missingSteps,
                conversion_required: readiness.conversionRequired,
            } : null,
            note: initialStatus === 'active'
                ? 'You will automatically copy new bets from this trader.'
                : 'Finish the missing Polymarket setup steps, then resume this copy config.'
        };
    },
    permissions: 'authenticated'
};

/**
 * Update Polymarket Copy Config Tool
 */
export const UpdatePolymarketCopyConfigTool: Tool = {
    definition: {
        name: 'update_polymarket_copy_config',
        description: 'Update a Polymarket copy-trade configuration. Use when the user wants to pause/resume following, change the bet size, change max open bets, or toggle mirror sells.',
        parameters: {
            type: 'object',
            properties: {
                config_id: {
                    type: 'string',
                    description: 'Optional config id to update.'
                },
                target_wallet: {
                    type: 'string',
                    description: 'Optional target wallet to locate the config when the id is unknown.'
                },
                bet_size_usd: {
                    type: 'number',
                    description: 'New per-trade USD amount.'
                },
                max_open_bets: {
                    type: 'number',
                    description: 'New cap for simultaneously open copied positions.'
                },
                mirror_sell: {
                    type: 'boolean',
                    description: 'Whether copied exits should mirror the target wallet.'
                },
                status: {
                    type: 'string',
                    enum: ['active', 'paused'],
                    description: 'Whether the config should be active or paused.'
                }
            },
            required: []
        }
    },
    handler: async (args: {
        config_id?: string;
        target_wallet?: string;
        bet_size_usd?: number;
        max_open_bets?: number;
        mirror_sell?: boolean;
        status?: 'active' | 'paused';
    }, context) => {
        const userId = context?.userId;
        if (!userId) {
            throw new Error('User authentication required');
        }

        if (!args.config_id && !args.target_wallet) {
            throw new Error('config_id or target_wallet is required');
        }

        const existing = await resolveUserCopyConfig({
            userId,
            configId: args.config_id,
            targetWallet: args.target_wallet,
        });

        if (!existing) {
            return {
                success: false,
                error: 'Polymarket copy config not found for this user.'
            };
        }

        const updateData: Record<string, unknown> = {};
        if (typeof args.bet_size_usd === 'number' && Number.isFinite(args.bet_size_usd) && args.bet_size_usd > 0) {
            updateData.betSizeUsd = args.bet_size_usd;
        }
        if (typeof args.max_open_bets === 'number' && Number.isFinite(args.max_open_bets) && args.max_open_bets > 0) {
            updateData.maxOpenBets = Math.floor(args.max_open_bets);
        }
        if (typeof args.mirror_sell === 'boolean') {
            updateData.mirrorSell = args.mirror_sell;
        }
        if (args.status === 'active' || args.status === 'paused') {
            updateData.status = args.status;
        }

        if (Object.keys(updateData).length === 0) {
            return {
                success: false,
                error: 'No valid updates were provided.'
            };
        }

        const updated = await prisma.polymarketCopyConfig.update({
            where: { id: existing.id },
            data: updateData,
            include: {
                positions: {
                    select: {
                        status: true,
                        createdAt: true,
                        closedAt: true,
                    }
                }
            }
        });

        return {
            success: true,
            message: `Updated Polymarket copy config for ${updated.targetWallet.slice(0, 8)}...`,
            config: summarizeCopyConfig(updated)
        };
    },
    permissions: 'authenticated'
};

/**
 * Delete Polymarket Copy Config Tool
 */
export const DeletePolymarketCopyConfigTool: Tool = {
    definition: {
        name: 'delete_polymarket_copy_config',
        description: 'Delete a Polymarket copy-trade configuration. Use when the user wants to stop following a trader entirely.',
        parameters: {
            type: 'object',
            properties: {
                config_id: {
                    type: 'string',
                    description: 'Optional config id to delete.'
                },
                target_wallet: {
                    type: 'string',
                    description: 'Optional target wallet to locate the config when the id is unknown.'
                }
            },
            required: []
        }
    },
    handler: async (args: { config_id?: string; target_wallet?: string }, context) => {
        const userId = context?.userId;
        if (!userId) {
            throw new Error('User authentication required');
        }

        if (!args.config_id && !args.target_wallet) {
            throw new Error('config_id or target_wallet is required');
        }

        const existing = await resolveUserCopyConfig({
            userId,
            configId: args.config_id,
            targetWallet: args.target_wallet,
        });

        if (!existing) {
            return {
                success: false,
                error: 'Polymarket copy config not found for this user.'
            };
        }

        await prisma.polymarketCopyConfig.delete({
            where: { id: existing.id }
        });

        return {
            success: true,
            message: `Stopped following Polymarket trader ${existing.targetWallet.slice(0, 8)}...`,
            deleted_config: summarizeCopyConfig(existing)
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
    handler: async (args: { status?: 'open' | 'closed' | 'all' }, context) => {
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

        const statusFilter: 'open' | 'closed' | 'all' = args.status || 'open';

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
