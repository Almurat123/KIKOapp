import { Tool } from '../../../tooling/registry.js';
import prisma from '../../../db/prisma.js';
import { addAddressToWebhook, removeAddressFromWebhook } from '../../../services/alchemyWebhookService.js';
import { normalizeAddress, isSolanaAddress } from '../../../utils/address.js';
import { validateAddress } from '../../../utils/validation.js';
import { getSolanaConnection } from '../../../config/solanaConfig.js';
import { TOKEN_PROGRAM_ID } from '../../../utils/solanaToken.js';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { isErc20ContractAddress } from '../../../utils/evmTokenCheck.js';

// --- Tool Definitions ---

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
        const walletAddress = context?.walletAddress;
        const MAX_COPY_TRADE_USD = 1_000_000;

        if (!userId || !walletAddress) {
            throw new Error('User not authenticated');
        }

        try {
            console.log('[Tool] create_copy_trade_config called:', { userId, ...args });

            // Validate address format early
            if (!validateAddress(args.target_wallet)) {
                throw new Error('Invalid target wallet address');
            }
            if (!Number.isFinite(args.buy_amount_usd) || args.buy_amount_usd <= 0 || args.buy_amount_usd > MAX_COPY_TRADE_USD) {
                throw new Error(`buy_amount_usd must be between 0 and ${MAX_COPY_TRADE_USD}`);
            }

            // Determine Chain ID
            let chainId = args.chain_id;
            if (!chainId) {
                // Auto-detect based on address format
                const isSolana = isSolanaAddress(args.target_wallet);
                const isEVM = args.target_wallet.startsWith('0x');

                if (isSolana) {
                    chainId = 900;
                } else if (isEVM) {
                    chainId = 8453; // Default to Base for EVM if unspecified
                } else {
                    // Fallback or Error? Default to Base usually safe or throw.
                    chainId = 8453;
                }
                console.log(`[Tool] Auto-detected Chain ID: ${chainId} for target ${args.target_wallet}`);
            }

            // Ensure user exists
            let user = await prisma.user.findUnique({
                where: { privyDid: userId },
            });

            if (!user) {
                user = await prisma.user.create({
                    data: {
                        privyDid: userId,
                        walletAddress: walletAddress.toLowerCase(),
                    },
                });
            }

            const normalizedWallet = normalizeAddress(args.target_wallet);

            // Prevent token/contract addresses from being used as copytrade targets
            if (chainId === 900) {
                const connection = getSolanaConnection();
                const pubkey = new PublicKey(normalizedWallet);
                const info = await connection.getAccountInfo(pubkey, 'confirmed');
                if (!info) {
                    throw new Error('Solana address not found on-chain.');
                }
                if (info.owner.equals(TOKEN_PROGRAM_ID)) {
                    throw new Error('Solana address is a token mint/account. Please provide a wallet address.');
                }
                if (!info.owner.equals(SystemProgram.programId)) {
                    throw new Error('Solana address is a program address. Please provide a wallet address.');
                }
            } else if (normalizedWallet.startsWith('0x')) {
                if (await isErc20ContractAddress(chainId, normalizedWallet)) {
                    throw new Error('Target address appears to be an ERC-20 token contract. Please provide a wallet address.');
                }
            }

            // --- Check for existing configuration to prevent duplication ---
            const existingConfig = await prisma.copyTradeConfig.findFirst({
                where: {
                    userId: user.privyDid,
                    targetWallet: normalizedWallet,
                    chainId: chainId,
                }
            });

            if (existingConfig) {
                console.log(`[Tool] Duplicate config found for user ${userId} and target ${normalizedWallet}`);

                // Format existing config for StrategyCard
                const existingStrategyData = {
                    id: existingConfig.id,
                    name: `Follow ${args.target_wallet.slice(0, 6)}...${args.target_wallet.slice(-4)}`,
                    type: 'copy_trade',
                    tokenIn: chainId === 900 ? 'SOL' : (chainId === 56 ? 'BNB' : 'ETH'),
                    tokenOut: 'ANY',
                    chain: chainId === 8453 ? 'base' : (chainId === 56 ? 'bsc' : (chainId === 900 ? 'solana' : 'eth')),
                    chainId: chainId,
                    triggerCondition: 'Target buys token',
                    executionAmount: existingConfig.buyAmountUsd.toString(),
                    amountAsset: 'USD',
                    status: existingConfig.status,
                    createdAt: existingConfig.createdAt.getTime(),
                    updatedAt: existingConfig.updatedAt.getTime(),
                    trigger: {
                        type: 'wallet_action',
                        wallet_address: normalizedWallet
                    },
                    copyTradeConfig: existingConfig
                };

                return {
                    summary: `⚠️ You are already following this wallet (\`${args.target_wallet}\`). \n\nDuplication is not allowed to prevent overlapping orders. You can see your existing configuration below.`,
                    config_id: existingConfig.id,
                    is_duplicate: true,
                    __client_action: {
                        type: 'show_strategy_card',
                        data: existingStrategyData
                    }
                };
            }
            // --- End duplication check ---

            const config = await prisma.copyTradeConfig.create({
                data: {
                    userId: user.privyDid,
                    targetWallet: normalizedWallet,
                    chainId: chainId,
                    buyAmountUsd: args.buy_amount_usd,
                    maxSlippageBps: args.max_slippage_bps ?? 300,
                    minMarketCapUsd: args.min_market_cap_usd,
                    minLiquidityUsd: args.min_liquidity_usd,
                    minTargetValueUsd: args.min_target_value_usd,
                    takeProfitPct: args.take_profit_pct,
                    stopLossPct: args.stop_loss_pct,
                    mirrorSell: args.mirror_sell ?? true,
                },
            });

            // Update tracked wallet stats (using composite key: address + chainId)
            await prisma.trackedWallet.upsert({
                where: {
                    address_chainId: {
                        address: normalizedWallet,
                        chainId: chainId
                    }
                },
                create: {
                    address: normalizedWallet,
                    chainId: chainId,
                    activeConfigs: 1,
                },
                update: {
                    activeConfigs: { increment: 1 },
                },
            });

            // Register with Alchemy Webhook
            console.log(`[Tool] Attempting to add ${normalizedWallet} to Alchemy webhook for chain ${chainId}`);
            addAddressToWebhook(normalizedWallet, chainId).catch(err => {
                console.warn('[Tool] Failed to add to Alchemy webhook (will use polling fallback):', err.message);
            });

            // Format for Frontend StrategyCard
            const strategyData = {
                id: config.id,
                name: `Follow ${args.target_wallet.slice(0, 6)}...${args.target_wallet.slice(-4)}`,
                type: 'copy_trade',
                tokenIn: chainId === 900 ? 'SOL' : (chainId === 56 ? 'BNB' : 'ETH'),
                tokenOut: 'ANY',
                chain: chainId === 8453 ? 'base' : (chainId === 56 ? 'bsc' : (chainId === 900 ? 'solana' : 'eth')),
                chainId: chainId,
                triggerCondition: 'Target buys token',
                executionAmount: args.buy_amount_usd.toString(),
                amountAsset: 'USD',
                status: config.status,
                createdAt: config.createdAt.getTime(),
                updatedAt: config.updatedAt.getTime(),
                trigger: {
                    type: 'wallet_action',
                    wallet_address: normalizedWallet
                },
                copyTradeConfig: config
            };

            return {
                summary: `✅ Copy trade config created successfully!\n\nTarget: \`${args.target_wallet}\`\nBuy Amount: $${args.buy_amount_usd}\n\nI will now automatically copy trades from this wallet.`,
                config_id: config.id,
                __client_action: {
                    type: 'show_strategy_card',
                    data: strategyData
                }
            };
        } catch (error: any) {
            console.error('[Tool] create_copy_trade_config error:', error);
            throw new Error(`Failed to create config: ${error.message}`);
        }
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
            console.log('[Tool] list_copy_trade_configs called:', { userId });

            const user = await prisma.user.findUnique({
                where: { privyDid: userId },
                include: { configs: true },
            });

            if (!user || user.configs.length === 0) {
                return { summary: "You don't have any active copy trade configurations." };
            }

            // Format for AI
            const configs = user.configs.map(c => ({
                id: c.id,
                target: c.targetWallet,
                buy_amount: `$${c.buyAmountUsd}`,
                status: c.status,
                // pnl: '0%' // Placeholder
            }));

            return configs;
        } catch (error: any) {
            console.error('[Tool] list_copy_trade_configs error:', error);
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
    handler: async (args, context) => {
        const userId = context?.userId;
        if (!userId) throw new Error('User not authenticated');

        try {
            console.log('[Tool] delete_copy_trade_config called:', { userId, target: args.target_wallet });

            const user = await prisma.user.findUnique({
                where: { privyDid: userId },
                include: { configs: true } // Need to fetch configs to know Chain ID before deleting
            });

            if (!user) throw new Error('User not found');

            // Find config to get chainId and normalized address
            // Try explicit match first, then lenient
            const normalizedTarget = normalizeAddress(args.target_wallet);
            let configToDelete = user.configs.find(c => normalizeAddress(c.targetWallet) === normalizedTarget);

            if (!configToDelete) {
                return { summary: `No active configuration found for target \`${args.target_wallet}\`.` };
            }

            const activeChainId = configToDelete.chainId;
            const targetToProcess = configToDelete.targetWallet;

            // Delete config
            const result = await prisma.copyTradeConfig.delete({
                where: {
                    id: configToDelete.id
                }
            });

            // Decrement tracked wallet counts
            await prisma.trackedWallet.update({
                where: {
                    address_chainId: {
                        address: targetToProcess,
                        chainId: activeChainId
                    }
                },
                data: {
                    activeConfigs: { decrement: 1 }
                },
            }).catch(e => console.warn('Failed to update tracked wallet count', e));

            // Remove from Alchemy Webhook
            // Check if any other configs use this wallet/chain combo
            const remainingConfigs = await prisma.copyTradeConfig.count({
                where: { targetWallet: targetToProcess, chainId: activeChainId },
            });

            if (remainingConfigs === 0) {
                console.log(`[Tool] Attempting to remove ${targetToProcess} from Alchemy webhook`);
                removeAddressFromWebhook(targetToProcess, activeChainId).catch(err => {
                    console.warn('[Tool] Failed to remove from Alchemy webhook:', err.message);
                });
            }

            return { summary: `✅ Stopped copy trading for target \`${activeChainId === 900 ? 'Solana' : 'EVM'} Wallet ${targetToProcess}\`.` };
        } catch (error: any) {
            console.error('[Tool] delete_copy_trade_config error:', error);
            throw new Error(`Failed to delete config: ${error.message}`);
        }
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
    handler: async (args, context) => {
        const userId = context?.userId;
        if (!userId) throw new Error('User not authenticated');

        try {
            const status = args.action === 'pause' ? 'paused' : 'active';
            console.log('[Tool] pause_copy_trade_config called:', { userId, ...args });

            const user = await prisma.user.findUnique({
                where: { privyDid: userId },
            });

            if (!user) throw new Error('User not found');

            const result = await prisma.copyTradeConfig.updateMany({
                where: {
                    userId: user.privyDid,
                    targetWallet: normalizeAddress(args.target_wallet)
                },
                data: { status }
            });

            if (result.count === 0) {
                return { summary: `No configuration found for target \`${args.target_wallet}\`.` };
            }

            return { summary: `✅ Configuration for \`${args.target_wallet}\` has been ${status === 'active' ? 'resumed' : 'paused'}.` };

        } catch (error: any) {
            console.error('[Tool] pause_copy_trade_config error:', error);
            throw new Error(`Failed to update config: ${error.message}`);
        }
    }
};
