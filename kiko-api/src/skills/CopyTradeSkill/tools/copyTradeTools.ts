import { Tool } from '../../../tooling/registry.js';
import prisma from '../../../db/prisma.js';
import { normalizeAddress } from '../../../utils/address.js';
import { validateAddress } from '../../../utils/validation.js';
import { resolveExecutionModeFromConfig } from '../../../services/copyTradeExecutionMode.js';
import { syncCopyTradeWebhookChain } from '../../../services/copyTradeWebhookSync.js';

export const CreateCopyTradeConfigTool: Tool = {
    definition: {
        name: 'create_copy_trade_config',
        description: 'Create a new copy trading configuration to automatically mirror trades from a target wallet',
        parameters: {
            type: 'object',
            properties: {
                target_wallet: {
                    type: 'string',
                    description: 'The target wallet address to copy trades from'
                },
                buy_amount_usd: {
                    type: 'number',
                    description: 'The amount in USD to use for each buy order'
                },
                max_slippage_bps: {
                    type: 'number',
                    description: 'Maximum slippage in basis points (e.g., 300 = 3%) [Default: 300]'
                },
                min_market_cap_usd: {
                    type: 'number',
                    description: 'Minimum market cap in USD to filter tokens'
                },
                min_liquidity_usd: {
                    type: 'number',
                    description: 'Minimum liquidity in USD to filter tokens'
                },
                min_target_value_usd: {
                    type: 'number',
                    description: 'Minimum value of the target\'s trade in USD to trigger a copy'
                },
                take_profit_pct: {
                    type: 'number',
                    description: 'Take profit percentage (e.g., 50 for 50%)'
                },
                stop_loss_pct: {
                    type: 'number',
                    description: 'Stop loss percentage (e.g., 20 for 20%)'
                },
                mirror_sell: {
                    type: 'boolean',
                    description: 'Whether to automatically sell when the target sells [Default: true]'
                },
                chain_id: {
                    type: 'number',
                    description: 'The Chain ID of the target wallet (8453: Base, 56: BNB, 900: Solana). [Default: Auto-detect]'
                }
            },
            required: ['target_wallet', 'buy_amount_usd']
        }
    },
    handler: async (args, context) => {
        const userId = context?.userId;
        if (!userId) throw new Error('User not authenticated');

        const normalizedTarget = normalizeAddress(String(args.target_wallet || ''));
        const chainId = Number.isInteger(Number(args.chain_id)) ? Number(args.chain_id) : 8453;
        const buyAmountUsd = Number(args.buy_amount_usd);

        if (!validateAddress(normalizedTarget)) {
            throw new Error('Invalid target wallet address');
        }
        if (!Number.isFinite(buyAmountUsd) || buyAmountUsd <= 0) {
            throw new Error('buy_amount_usd must be a positive number');
        }

        const resolvedMode = resolveExecutionModeFromConfig({
            requested: args.execution_mode,
            legacyDisableTokenInfo: args.disable_token_info,
            fallback: 'normal',
        });

        const user = await prisma.user.findUnique({ where: { privyDid: userId } });
        if (!user) {
            const userAddress = normalizeAddress(String(context?.userAddress || ''));
            if (!userAddress || !validateAddress(userAddress)) {
                throw new Error('No user wallet found. Please connect wallet first.');
            }
            await prisma.user.create({
                data: {
                    privyDid: userId,
                    walletAddress: userAddress,
                },
            });
        }

        const config = await prisma.copyTradeConfig.create({
            data: {
                userId,
                targetWallet: normalizedTarget,
                chainId,
                buyAmountUsd,
                maxSlippageBps: Number.isFinite(Number(args.max_slippage_bps)) ? Number(args.max_slippage_bps) : 300,
                minMarketCapUsd: Number.isFinite(Number(args.min_market_cap_usd)) ? Number(args.min_market_cap_usd) : null,
                minLiquidityUsd: Number.isFinite(Number(args.min_liquidity_usd)) ? Number(args.min_liquidity_usd) : null,
                minTargetValueUsd: Number.isFinite(Number(args.min_target_value_usd)) ? Number(args.min_target_value_usd) : null,
                takeProfitPct: Number.isFinite(Number(args.take_profit_pct)) ? Number(args.take_profit_pct) : null,
                stopLossPct: Number.isFinite(Number(args.stop_loss_pct)) ? Number(args.stop_loss_pct) : null,
                mirrorSell: typeof args.mirror_sell === 'boolean' ? args.mirror_sell : true,
                aiAnalysisMode: 'disabled',
                enableDynamicTP: false,
                dynamicTPMinProfitPct: 100,
                executionMode: resolvedMode.mode,
                disableTokenInfo: resolvedMode.mode === 'turbo',
                signatureScheme: 'legacy_unsigned',
                requiresResign: false,
            },
        });

        await prisma.trackedWallet.upsert({
            where: {
                address_chainId: {
                    address: normalizedTarget,
                    chainId,
                },
            },
            create: {
                address: normalizedTarget,
                chainId,
                activeConfigs: 1,
            },
            update: {
                activeConfigs: { increment: 1 },
            },
        });

        const syncResult = await syncCopyTradeWebhookChain(chainId, 'tool_create');
        if (!syncResult.ok) {
            console.warn('[CopyTradeTool] webhook reconcile incomplete after tool create', syncResult);
        }

        return {
            id: config.id,
            summary: `Copy trade created for ${normalizedTarget} with $${buyAmountUsd} per trade on chain ${chainId}.`,
            targetWallet: config.targetWallet,
            chainId: config.chainId,
            buyAmountUsd: config.buyAmountUsd,
            status: config.status,
            createdAt: config.createdAt,
        };
    }
};

export const ListCopyTradeConfigsTool: Tool = {
    definition: {
        name: 'list_copy_trade_configs',
        description: 'List all active copy trading configurations',
        parameters: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    handler: async (_args, context) => {
        const userId = context?.userId;
        if (!userId) throw new Error('User not authenticated');

        try {
            const user = await prisma.user.findUnique({
                where: { privyDid: userId },
                include: { configs: true },
            });

            if (!user || user.configs.length === 0) {
                return { summary: "You don't have any active copy trade configurations." };
            }

            return user.configs.map(c => ({
                id: c.id,
                target: c.targetWallet,
                buy_amount: `$${c.buyAmountUsd}`,
                status: c.status,
            }));
        } catch (error: any) {
            throw new Error(`Failed to list configs: ${error.message}`);
        }
    }
};

export const DeleteCopyTradeConfigTool: Tool = {
    definition: {
        name: 'delete_copy_trade_config',
        description: 'Delete/Stop a copy trading configuration',
        parameters: {
            type: 'object',
            properties: {
                target_wallet: {
                    type: 'string',
                    description: 'The target wallet address of the config to delete'
                }
            },
            required: ['target_wallet']
        }
    },
    handler: async (args, _context) => {
        return {
            summary: 'For security reasons, deleting copy-trade configs now requires user-signed action in the Trade page.',
            requires_user_signature: true,
            __client_action: {
                type: 'open_trade_page_for_signed_copytrade',
                data: {
                    targetWallet: args.target_wallet,
                    action: 'delete'
                }
            }
        };
    }
};

export const PauseCopyTradeConfigTool: Tool = {
    definition: {
        name: 'pause_copy_trade_config',
        description: 'Pause or resume a copy trading configuration',
        parameters: {
            type: 'object',
            properties: {
                target_wallet: {
                    type: 'string',
                    description: 'The target wallet address'
                },
                action: {
                    type: 'string',
                    description: 'Action to take: pause or resume',
                    enum: ['pause', 'resume']
                }
            },
            required: ['target_wallet', 'action']
        }
    },
    handler: async (args, _context) => {
        return {
            summary: 'For security reasons, pause/resume now requires user-signed action in the Trade page.',
            requires_user_signature: true,
            __client_action: {
                type: 'open_trade_page_for_signed_copytrade',
                data: {
                    targetWallet: args.target_wallet,
                    action: args.action
                }
            }
        };
    }
};
