// CONTEXT MEMORY
// Updated: 2026-04-14
// Author: Rowan
// Reason: copy-trade tool creation accepted duplicated active configs for the
//         same user, chain, and target wallet after malformed chat wallet args
//         created multiple BSC rows. Database-level active uniqueness now also
//         means concurrent create races must be converted into idempotent reads.
//         The buy hot path now also uses a config index, so tool writes must
//         invalidate that read model immediately.
// Goal: make copy-trade config creation idempotent for active user+chain+target
//       tuples, reject malformed wallet args before persistence, and keep the
//       active-config index coherent after tool writes.
// Owns: local copy-trade tool persistence, tracked-wallet count maintenance,
//       and config-index invalidation after create.
// Does Not Own: signed Trade page config updates, chat wallet entity extraction,
//               or historical production row cleanup.
// Design Language:
// - same user + same chain + same target wallet must not create multiple active configs
// - malformed target_wallet values fail closed before persistence
// - idempotent create returns the existing active config instead of incrementing tracked-wallet counts
// - database unique conflicts are safe races and must not increment tracked-wallet counts
// - every create/existing-create outcome should emit wallet provenance audit evidence
// - successful tool writes must invalidate the target-wallet config index
// Document Provenance:
// - Source: chat transcript + runtime logs + production database inspection for BSC copy-trade target wallets
// - Kind: runtime observation
// - Retrieved: 2026-04-13
// - Applied To: idempotent create semantics and strict wallet persistence guard
// - Verification: verified in code review and unit tests
// - Source: /Users/almurat/KiKo/system-journal/design-language/copytrade-buy-hot-path-refactor-todo.md
// - Kind: repo doc
// - Retrieved: 2026-04-14
// - Applied To: config index invalidation after tool-side create
// - Verification: verified in code design review
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/copytrade-buy-hot-path-refactor-todo.md
// - /Users/almurat/KiKo/system-journal/design-language/copytrade-race-recovery.md
// - /Users/almurat/KiKo/system-journal/owner-map/copytrade-buy-confirmation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-copytrade-wallet-entity-hardening.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-copytrade-duplicate-config-hardening.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-copytrade-wallet-deterministic-extraction.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-14-copytrade-wallet-audit-provenance.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import { Tool } from '../../../tooling/registry.js';
import prisma from '../../../db/prisma.js';
import { normalizeAddress } from '../../../utils/address.js';
import { validateAddress } from '../../../utils/validation.js';
import { resolveExecutionModeFromConfig } from '../../../services/copyTradeExecutionMode.js';
import { syncCopyTradeWebhookChain } from '../../../services/copyTradeWebhookSync.js';
import { DEFAULT_COPYTRADE_ENTRY_DEVIATION_BPS, resolveMaxEntryDeviationBps } from '../../../services/copytrade-v2/config/entryDeviationPolicy.js';
import {
    assertCopyTradeAutoTradingAuthorized,
    buildCopyTradeAuthorizationStopResult,
} from '../../../services/copyTradeAuthorization.js';
import { safeRecordCopyTradeWalletAudit } from '../../../services/copyTradeWalletAuditService.js';
import { invalidateActiveCopyTradeConfigIndex } from '../../../services/copytrade-v2/config/copyTradeConfigIndex.js';

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
                max_entry_deviation_bps: {
                    type: 'number',
                    description: `Maximum allowed entry price deviation in basis points for copytrade gating [Default: ${DEFAULT_COPYTRADE_ENTRY_DEVIATION_BPS}]`
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

        const existingConfig = await prisma.copyTradeConfig.findFirst({
            where: {
                userId,
                chainId,
                targetWallet: { equals: normalizedTarget, mode: 'insensitive' },
                status: 'active',
            },
            orderBy: { createdAt: 'desc' },
        });
        if (existingConfig) {
            await safeRecordCopyTradeWalletAudit({
                userId,
                configId: existingConfig.id,
                action: 'tool_create_existing_active',
                chainId: existingConfig.chainId,
                binding: context?.__copyTradeWalletBindingAudit || null,
                finalTargetWallet: normalizedTarget,
                writtenTargetWallet: existingConfig.targetWallet,
                source: 'chat_tool',
                reasonCode: 'ALREADY_EXISTS',
            });
            return {
                id: existingConfig.id,
                summary: `Copy trade already active for ${existingConfig.targetWallet} on chain ${existingConfig.chainId}.`,
                targetWallet: existingConfig.targetWallet,
                chainId: existingConfig.chainId,
                buyAmountUsd: existingConfig.buyAmountUsd,
                maxEntryDeviationBps: resolveMaxEntryDeviationBps(existingConfig).maxEntryDeviationBps,
                status: existingConfig.status,
                createdAt: existingConfig.createdAt,
                alreadyExists: true,
            };
        }

        try {
            await assertCopyTradeAutoTradingAuthorized(userId, chainId);
        } catch (error: any) {
            if (error?.code === 'AUTO_TRADING_AUTH_REQUIRED') {
                return buildCopyTradeAuthorizationStopResult();
            }
            throw error;
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

        let config;
        try {
            config = await prisma.copyTradeConfig.create({
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
                    configPayload: {
                        maxEntryDeviationBps: Number.isFinite(Number(args.max_entry_deviation_bps))
                            ? Number(args.max_entry_deviation_bps)
                            : DEFAULT_COPYTRADE_ENTRY_DEVIATION_BPS,
                    } as any,
                    signatureScheme: 'legacy_unsigned',
                    requiresResign: false,
                },
            });
        } catch (error: any) {
            if (error?.code !== 'P2002') {
                throw error;
            }
            const racedConfig = await prisma.copyTradeConfig.findFirst({
                where: {
                    userId,
                    chainId,
                    targetWallet: { equals: normalizedTarget, mode: 'insensitive' },
                    status: 'active',
                },
                orderBy: { createdAt: 'desc' },
            });
            if (!racedConfig) {
                throw error;
            }
            await safeRecordCopyTradeWalletAudit({
                userId,
                configId: racedConfig.id,
                action: 'tool_create_unique_race_existing_active',
                chainId: racedConfig.chainId,
                binding: context?.__copyTradeWalletBindingAudit || null,
                finalTargetWallet: normalizedTarget,
                writtenTargetWallet: racedConfig.targetWallet,
                source: 'chat_tool',
                reasonCode: 'P2002',
            });
            return {
                id: racedConfig.id,
                summary: `Copy trade already active for ${racedConfig.targetWallet} on chain ${racedConfig.chainId}.`,
                targetWallet: racedConfig.targetWallet,
                chainId: racedConfig.chainId,
                buyAmountUsd: racedConfig.buyAmountUsd,
                maxEntryDeviationBps: resolveMaxEntryDeviationBps(racedConfig).maxEntryDeviationBps,
                status: racedConfig.status,
                createdAt: racedConfig.createdAt,
                alreadyExists: true,
            };
        }

        await safeRecordCopyTradeWalletAudit({
            userId,
            configId: config.id,
            action: 'tool_create_created',
            chainId: config.chainId,
            binding: context?.__copyTradeWalletBindingAudit || null,
            finalTargetWallet: normalizedTarget,
            writtenTargetWallet: config.targetWallet,
            source: 'chat_tool',
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
        invalidateActiveCopyTradeConfigIndex(normalizedTarget, chainId);

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
            maxEntryDeviationBps: resolveMaxEntryDeviationBps(config).maxEntryDeviationBps,
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
                max_entry_deviation_bps: resolveMaxEntryDeviationBps(c).maxEntryDeviationBps,
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
