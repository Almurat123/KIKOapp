import { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth, requireEndUserAuth } from '../middleware/auth.js';
import { addAddressToWebhook, removeAddressFromWebhook } from '../services/alchemyWebhookService.js';
import { PrivyClient } from '@privy-io/server-auth';
import { normalizeAddress, isSolanaAddress } from '../utils/address.js';
import { validateAddress } from '../utils/validation.js';
import { getSolanaConnection } from '../config/solanaConfig.js';
import { TOKEN_PROGRAM_ID } from '../utils/solanaToken.js';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { notificationService } from '../services/notificationService.js';
import { isErc20ContractAddress } from '../utils/evmTokenCheck.js';
import { getTargetWalletStatus } from '../services/targetWalletTrackingService.js';
import {
    COPYTRADE_SIGNATURE_SCHEME,
    verifyCopyTradeConfigSignature,
    type CopyTradeSignedPayload,
} from '../services/copyTradeConfigSignatureService.js';
import { resolveExecutionModeFromConfig } from '../services/copyTradeExecutionMode.js';
import { getEmbeddedWalletAddress } from '../services/privyWallet.js';
import { AppError } from '../middleware/errorHandler.js';

interface CreateConfigBody {
    signedPayload: Record<string, unknown> | string;
    signature: string;
    signerAddress: string;
    nonce: number;
    expiresAt: string | number;
}

const MAX_COPY_TRADE_USD = 1_000_000;
const SUPPORTED_COPYTRADE_CHAINS = new Set([1, 10, 56, 137, 8453, 42161, 900]);

function chainIdToWalletTxChain(chainId: number): string {
    if (chainId === 8453) return 'base';
    if (chainId === 56) return 'bsc';
    if (chainId === 900) return 'solana';
    if (chainId === 42161) return 'arbitrum';
    if (chainId === 10) return 'optimism';
    if (chainId === 137) return 'polygon';
    return 'eth';
}

function toConfigDataFromSignedPayload(payload: CopyTradeSignedPayload) {
    return {
        targetWallet: normalizeAddress(payload.targetWallet),
        chainId: Number(payload.chainId),
        buyAmountUsd: Number(payload.buyAmountUsd),
        maxSlippageBps: Number(payload.maxSlippageBps),
        minMarketCapUsd: Number(payload.minMarketCapUsd) === 0 ? null : Number(payload.minMarketCapUsd),
        minLiquidityUsd: Number(payload.minLiquidityUsd) === 0 ? null : Number(payload.minLiquidityUsd),
        minTargetValueUsd: Number(payload.minTargetValueUsd) === 0 ? null : Number(payload.minTargetValueUsd),
        copyTradeTokenCooldownMinutes: Number(payload.copyTradeTokenCooldownMinutes) === 0 ? null : Number(payload.copyTradeTokenCooldownMinutes),
        executionMode: payload.executionMode,
        disableTokenInfo: payload.disableTokenInfo,
        takeProfitPct: Number(payload.takeProfitPct) === 0 ? null : Number(payload.takeProfitPct),
        stopLossPct: Number(payload.stopLossPct) === 0 ? null : Number(payload.stopLossPct),
        mirrorSell: payload.mirrorSell,
        aiAnalysisMode: payload.aiAnalysisMode,
        enableDynamicTP: payload.enableDynamicTP,
        dynamicTPMinProfitPct: Number(payload.dynamicTPMinProfitPct),
    };
}

export default async function copyTradeRoutes(fastify: FastifyInstance) {
    function handleCopyTradeError(reply: any, error: unknown, fallbackMessage: string) {
        if (error instanceof AppError) {
            return reply.status(error.statusCode).send({ error: error.message, code: error.code });
        }
        return reply.status(500).send({ error: fallbackMessage, code: 'INTERNAL_ERROR' });
    }

    async function assertEoaTarget(chainId: number, address: string): Promise<void> {
        if (!address || !address.startsWith('0x')) return;
        // Solana uses non-0x addresses; skip
        if (chainId === 900) return;
        if (await isErc20ContractAddress(chainId, address)) {
            throw new Error('Target address appears to be an ERC-20 token contract. Please use a wallet address.');
        }
    }

    async function assertSolanaWalletTarget(address: string): Promise<void> {
        try {
            const connection = getSolanaConnection();
            const pubkey = new PublicKey(address);
            const info = await connection.getAccountInfo(pubkey, 'confirmed');
            if (!info) {
                throw new Error('Solana address not found on-chain.');
            }
            if (info.owner.equals(TOKEN_PROGRAM_ID)) {
                throw new Error('Solana address is a token mint/account. Please use a wallet address.');
            }
            if (!info.owner.equals(SystemProgram.programId)) {
                throw new Error('Solana address is a program address. Please use a wallet address.');
            }
        } catch (err: any) {
            if (err instanceof Error) throw err;
            throw new Error('Invalid Solana address');
        }
    }

    /**
     * GET /api/copy-trade/configs
     * List all copy trade configs for the authenticated user
     */
    fastify.get('/configs', { preHandler: requireAuth }, async (request, reply) => {
        const userId = (request as any).user?.sub;
        if (!userId) {
            console.warn('[CopyTrade] GET /configs - Unauthorized request');
            return reply.status(401).send({ error: 'Unauthorized' });
        }

        console.log(`[CopyTrade] GET /configs - Fetching configs for user ${userId}`);

        try {
            // Find or create user
            let user = await prisma.user.findUnique({
                where: { privyDid: userId },
                include: { configs: true },
            });

            if (!user) {
                return reply.send({ configs: [] });
            }

            return reply.send({ configs: user.configs });
        } catch (error) {
            console.error('[CopyTrade] Error fetching configs:', error);
            return reply.status(500).send({ error: 'Failed to fetch configs' });
        }
    });

    /**
     * POST /api/copy-trade/config
     * Create a new copy trade configuration
     */
    fastify.post<{ Body: CreateConfigBody }>('/config', { preHandler: requireEndUserAuth }, async (request, reply) => {
        const userId = (request as any).user?.sub;
        if (!userId) {
            console.warn('[CopyTrade] POST /config - Unauthorized request');
            return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { signedPayload, signature, signerAddress, nonce, expiresAt } = request.body || ({} as CreateConfigBody);
        if (!signedPayload || !signature || !signerAddress || !Number.isInteger(Number(nonce))) {
            return reply.status(400).send({ error: 'signedPayload, signature, signerAddress, nonce are required' });
        }
        if (expiresAt === undefined || expiresAt === null) {
            return reply.status(400).send({ error: 'expiresAt is required' });
        }

        try {
            let user = await prisma.user.findUnique({
                where: { privyDid: userId },
            });

            if (!user) {
                // Try to fetch email from Privy first
                let email: string | undefined;
                try {
                    const privyClient = new PrivyClient(process.env.PRIVY_APP_ID || '', process.env.PRIVY_APP_SECRET || '');
                    const privyUser = await privyClient.getUser(userId);
                    email = privyUser.linkedAccounts?.find(a => a.type === 'email')?.address;
                } catch (privyError) {
                    console.error('[CopyTrade] Failed to fetch email from Privy for new user:', privyError);
                }

                // Resolve user wallet from Privy if user record does not exist.
                const embeddedWalletAddress = await getEmbeddedWalletAddress(userId);
                if (!embeddedWalletAddress) {
                    return reply.status(400).send({ error: 'No embedded EVM wallet found for this user' });
                }
                const normalizedUserWallet = normalizeAddress(embeddedWalletAddress);

                user = await prisma.user.create({
                    data: {
                        privyDid: userId,
                        walletAddress: normalizedUserWallet,
                        email: email, // Cache email if found
                    },
                });
                console.log('[CopyTrade] Created new user:', user.id, email ? `with email ${email}` : 'without email');
            }

            const verifyResult = verifyCopyTradeConfigSignature({
                signedPayload,
                signature,
                signerAddress,
                userId,
                expectedAction: 'create',
                currentNonce: 0,
                userWalletAddress: user.walletAddress,
            });
            const payload = verifyResult.payload;
            if (Number(nonce) !== payload.nonce) {
                return reply.status(400).send({ error: 'nonce mismatch with signedPayload', code: 'SIGNATURE_INVALID' });
            }
            if (Number(expiresAt) !== payload.expiresAtMs) {
                return reply.status(400).send({ error: 'expiresAt mismatch with signedPayload', code: 'SIGNATURE_INVALID' });
            }
            const configData = toConfigDataFromSignedPayload(payload);
            const normalizedTarget = normalizeAddress(configData.targetWallet);
            const chainId = Number(configData.chainId);

            if (!validateAddress(normalizedTarget)) {
                return reply.status(400).send({ error: 'Invalid targetWallet address' });
            }
            if (!Number.isInteger(chainId) || !SUPPORTED_COPYTRADE_CHAINS.has(chainId)) {
                return reply.status(400).send({ error: 'Unsupported chainId for copy trade' });
            }
            if (!Number.isFinite(configData.buyAmountUsd) || configData.buyAmountUsd <= 0 || configData.buyAmountUsd > MAX_COPY_TRADE_USD) {
                return reply.status(400).send({ error: `buyAmountUsd must be between 0 and ${MAX_COPY_TRADE_USD}` });
            }

            if (chainId === 900) {
                await assertSolanaWalletTarget(normalizedTarget);
            } else {
                await assertEoaTarget(chainId, normalizedTarget);
            }

            const resolvedMode = resolveExecutionModeFromConfig({
                requested: configData.executionMode,
                legacyDisableTokenInfo: configData.disableTokenInfo,
                fallback: 'normal',
            });
            if (!resolvedMode.valid) {
                return reply.status(400).send({ error: 'executionMode must be one of: safe, normal, turbo' });
            }

            // Create config
            const config = await prisma.copyTradeConfig.create({
                data: {
                    userId: user.privyDid,
                    targetWallet: normalizedTarget,
                    chainId: configData.chainId,
                    buyAmountUsd: configData.buyAmountUsd,
                    maxSlippageBps: configData.maxSlippageBps,
                    minMarketCapUsd: configData.minMarketCapUsd,
                    minLiquidityUsd: configData.minLiquidityUsd,
                    minTargetValueUsd: configData.minTargetValueUsd,
                    copyTradeTokenCooldownMinutes: configData.copyTradeTokenCooldownMinutes,
                    executionMode: resolvedMode.mode,
                    disableTokenInfo: resolvedMode.mode === 'turbo',
                    takeProfitPct: configData.takeProfitPct,
                    stopLossPct: configData.stopLossPct,
                    mirrorSell: configData.mirrorSell,
                    aiAnalysisMode: configData.aiAnalysisMode,
                    enableDynamicTP: configData.enableDynamicTP,
                    dynamicTPMinProfitPct: configData.dynamicTPMinProfitPct ?? 100,
                    configPayload: payload as any,
                    configHash: verifyResult.configHash,
                    configSignature: signature,
                    signerAddress: normalizeAddress(signerAddress),
                    signedNonce: payload.nonce,
                    signatureScheme: COPYTRADE_SIGNATURE_SCHEME,
                    signatureVerifiedAt: new Date(),
                    requiresResign: false,
                },
            });

            // Update or create tracked wallet (using composite key: address + chainId)
            await prisma.trackedWallet.upsert({
                where: {
                    address_chainId: {
                        address: normalizedTarget,
                        chainId
                    }
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

            console.log('[CopyTrade] Created config:', config.id, 'for target:', normalizedTarget);

            // Register address with Alchemy webhook for real-time notifications
            console.log(`[CopyTrade] Attempting to add ${normalizedTarget} to Alchemy webhook for chain ${chainId}`);
            addAddressToWebhook(normalizedTarget, chainId)
                .then(success => {
                    if (success) {
                        console.log(`[CopyTrade] ✅ Successfully added to Alchemy webhook`);
                    } else {
                        console.warn(`[CopyTrade] ⚠️ Failed to add to Alchemy webhook (using polling fallback)`);
                    }
                })
                .catch(err => {
                    console.warn('[CopyTrade] ❌ Alchemy webhook error:', err.message);
                });

            // Notify user that copy trade is active
            if (user.farcasterFid) {
                await notificationService.sendNotification({
                    type: 'SYSTEM_ALERT',
                    farcasterFid: user.farcasterFid,
                    userId: user.privyDid,
                    data: {
                        alertTitle: 'Copy Trade Activated! 🚀',
                        alertMessage: `I'm now monitoring ${normalizedTarget.slice(0, 6)}... ${normalizedTarget.slice(-4)} for you. I'll notify you here whenever I execute a trade!`,
                    }
                });
            }

            return reply.send({
                success: true,
                config,
            });
        } catch (error) {
            console.error('[CopyTrade] Error creating config:', error);
            return handleCopyTradeError(reply, error, 'Failed to create config');
        }
    });

    /**
     * DELETE /api/copy-trade/config/:id
     * Delete a copy trade configuration
     */
    fastify.delete<{ Params: { id: string } }>('/config/:id', { preHandler: requireEndUserAuth }, async (request, reply) => {
        const userId = (request as any).user?.sub;
        if (!userId) {
            console.warn('[CopyTrade] DELETE /config - Unauthorized request');
            return reply.status(401).send({ error: 'Unauthorized' });
        }

        console.log(`[CopyTrade] DELETE /config/${request.params.id} - Request from ${userId}`);

        const { id } = request.params;

        try {
            // Find user
            const user = await prisma.user.findUnique({
                where: { privyDid: userId },
            });

            if (!user) {
                return reply.status(404).send({ error: 'User not found' });
            }

            // Find config
            const config = await prisma.copyTradeConfig.findFirst({
                where: { id, userId: user.privyDid },
            });

            if (!config) {
                return reply.status(404).send({ error: 'Config not found' });
            }

            // Delete config
            await prisma.copyTradeConfig.delete({
                where: { id },
            });

            // Decrement tracked wallet counter (composite key)
            await prisma.trackedWallet.update({
                where: {
                    address_chainId: {
                        address: config.targetWallet,
                        chainId: config.chainId
                    }
                },
                data: {
                    activeConfigs: { decrement: 1 },
                },
            }).catch(e => console.warn('[CopyTrade] Could not decrement tracked wallet:', e.message));

            console.log('[CopyTrade] Deleted config:', id);

            // Remove from Alchemy webhook (if no other configs tracking this wallet)
            const remainingConfigs = await prisma.copyTradeConfig.count({
                where: { targetWallet: config.targetWallet, chainId: config.chainId },
            });
            if (remainingConfigs === 0) {
                removeAddressFromWebhook(config.targetWallet, config.chainId).catch(err => {
                    console.warn('[CopyTrade] Failed to remove from Alchemy webhook:', err.message);
                });
                const chain = chainIdToWalletTxChain(config.chainId);
                const txDeleteResult = await prisma.walletTransaction.deleteMany({
                    where: {
                        walletAddress: normalizeAddress(config.targetWallet),
                        OR: [
                            { chainId: config.chainId },
                            { chainId: null, chain },
                        ],
                    },
                });
                console.log('[CopyTrade] Removed wallet tx history for deleted target', {
                    targetWallet: config.targetWallet,
                    chainId: config.chainId,
                    deletedRows: txDeleteResult.count,
                });
            }

            return reply.send({ success: true });
        } catch (error) {
            console.error('[CopyTrade] Error deleting config:', error);
            return reply.status(500).send({ error: 'Failed to delete config' });
        }
    });

    /**
     * GET /api/copy-trade/positions
     * List all positions for the authenticated user
     */
    fastify.get('/positions', { preHandler: requireAuth }, async (request, reply) => {
        const userId = (request as any).user?.sub;
        if (!userId) {
            console.warn('[CopyTrade] GET /positions - Unauthorized request');
            return reply.status(401).send({ error: 'Unauthorized' });
        }

        console.log(`[CopyTrade] GET /positions - Fetching positions for ${userId}`);

        try {
            const user = await prisma.user.findUnique({
                where: { privyDid: userId },
                include: {
                    positions: {
                        where: {
                            status: { in: ['open', 'closing', 'closed'] }
                        },
                        orderBy: { createdAt: 'desc' },
                    },
                },
            });

            if (!user) {
                return reply.send({ positions: [] });
            }

            return reply.send({ positions: user.positions });
        } catch (error) {
            console.error('[CopyTrade] Error fetching positions:', error);
            return reply.status(500).send({ error: 'Failed to fetch positions' });
        }
    });

    /**
     * GET /api/copy-trade/config/:id/target-status
     * Returns full tracked target status from config creation time to now.
     */
    fastify.get('/config/:id/target-status', { preHandler: requireAuth }, async (request, reply) => {
        const userId = (request as any).user?.sub;
        const { id } = request.params as { id: string };
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
        try {
            const data = await getTargetWalletStatus({ userId, configId: id, recentLimit: 120 });
            if (!data) return reply.status(404).send({ error: 'Config not found' });
            console.log('[CopyTrade] GET /config/:id/target-status', {
                userId,
                configId: id,
                trackedTxCount: data.aggregate?.trackedTxCount ?? 0,
                walletTxCount: data.aggregate?.walletTxCount ?? 0,
                buyCount: data.aggregate?.buyCount ?? 0,
                sellCount: data.aggregate?.sellCount ?? 0,
                tokenSwapCount: data.aggregate?.tokenSwapCount ?? 0,
                targetProfitUsd: data.aggregate?.targetProfitUsd ?? 0,
                targetLossUsd: data.aggregate?.targetLossUsd ?? 0,
            });
            return reply.send({ success: true, ...data });
        } catch (error: any) {
            console.error('[CopyTrade] Error fetching target status:', error);
            return reply.status(500).send({ error: 'Failed to fetch target status' });
        }
    });

    /**
     * PATCH /api/copy-trade/config/:id
     * Update a copy trade configuration
     */
    fastify.patch<{ Params: { id: string }; Body: CreateConfigBody }>('/config/:id', { preHandler: requireEndUserAuth }, async (request, reply) => {
        const userId = (request as any).user?.sub;
        if (!userId) {
            console.warn('[CopyTrade] PATCH /config - Unauthorized request');
            return reply.status(401).send({ error: 'Unauthorized' });
        }

        console.log(`[CopyTrade] PATCH /config/${request.params.id} - User ${userId}`, request.body);

        const { id } = request.params;
        const { signedPayload, signature, signerAddress, nonce, expiresAt } = request.body || ({} as CreateConfigBody);
        if (!signedPayload || !signature || !signerAddress || !Number.isInteger(Number(nonce))) {
            return reply.status(400).send({ error: 'signedPayload, signature, signerAddress, nonce are required' });
        }
        if (expiresAt === undefined || expiresAt === null) {
            return reply.status(400).send({ error: 'expiresAt is required' });
        }

        try {
            const user = await prisma.user.findUnique({
                where: { privyDid: userId },
            });

            if (!user) {
                return reply.status(404).send({ error: 'User not found' });
            }

            // Verify ownership
            const existing = await prisma.copyTradeConfig.findFirst({
                where: { id, userId: user.privyDid },
            });

            if (!existing) {
                return reply.status(404).send({ error: 'Config not found' });
            }

            const verifyResult = verifyCopyTradeConfigSignature({
                signedPayload,
                signature,
                signerAddress,
                userId,
                expectedAction: 'update',
                expectedConfigId: id,
                currentNonce: Number(existing.signedNonce || 0),
                userWalletAddress: user.walletAddress,
            });
            const payload = verifyResult.payload;
            if (Number(nonce) !== payload.nonce) {
                return reply.status(400).send({ error: 'nonce mismatch with signedPayload', code: 'SIGNATURE_INVALID' });
            }
            if (Number(expiresAt) !== payload.expiresAtMs) {
                return reply.status(400).send({ error: 'expiresAt mismatch with signedPayload', code: 'SIGNATURE_INVALID' });
            }
            const configData = toConfigDataFromSignedPayload(payload);
            const normalizedNextTarget = normalizeAddress(configData.targetWallet);
            const chainId = Number(configData.chainId);

            if (!validateAddress(normalizedNextTarget)) {
                return reply.status(400).send({ error: 'Invalid targetWallet address' });
            }
            if (!Number.isInteger(chainId) || !SUPPORTED_COPYTRADE_CHAINS.has(chainId)) {
                return reply.status(400).send({ error: 'Unsupported chainId for copy trade' });
            }
            if (!Number.isFinite(configData.buyAmountUsd) || configData.buyAmountUsd <= 0 || configData.buyAmountUsd > MAX_COPY_TRADE_USD) {
                return reply.status(400).send({ error: `buyAmountUsd must be between 0 and ${MAX_COPY_TRADE_USD}` });
            }

            if (chainId === 900) {
                await assertSolanaWalletTarget(normalizedNextTarget);
            } else {
                await assertEoaTarget(chainId, normalizedNextTarget);
            }

            const resolvedMode = resolveExecutionModeFromConfig({
                requested: configData.executionMode,
                legacyDisableTokenInfo: configData.disableTokenInfo,
                fallback: 'normal',
            });
            if (!resolvedMode.valid) {
                return reply.status(400).send({ error: 'executionMode must be one of: safe, normal, turbo' });
            }

            const dataToUpdate: Record<string, unknown> = {
                executionMode: resolvedMode.mode,
                disableTokenInfo: resolvedMode.mode === 'turbo',
                targetWallet: normalizedNextTarget,
                chainId: configData.chainId,
                buyAmountUsd: configData.buyAmountUsd,
                maxSlippageBps: configData.maxSlippageBps,
                minMarketCapUsd: configData.minMarketCapUsd,
                minLiquidityUsd: configData.minLiquidityUsd,
                minTargetValueUsd: configData.minTargetValueUsd,
                copyTradeTokenCooldownMinutes: configData.copyTradeTokenCooldownMinutes,
                takeProfitPct: configData.takeProfitPct,
                stopLossPct: configData.stopLossPct,
                mirrorSell: configData.mirrorSell,
                aiAnalysisMode: configData.aiAnalysisMode,
                enableDynamicTP: configData.enableDynamicTP,
                dynamicTPMinProfitPct: configData.dynamicTPMinProfitPct ?? 100,
                configPayload: payload as any,
                configHash: verifyResult.configHash,
                configSignature: signature,
                signerAddress: normalizeAddress(signerAddress),
                signedNonce: payload.nonce,
                signatureScheme: COPYTRADE_SIGNATURE_SCHEME,
                signatureVerifiedAt: new Date(),
                requiresResign: false,
            };

            const config = await prisma.copyTradeConfig.update({
                where: { id },
                data: dataToUpdate as any,
            });

            if (normalizedNextTarget !== existing.targetWallet || chainId !== existing.chainId) {
                // Update tracking: decrement old (composite key)
                await prisma.trackedWallet.update({
                    where: { address_chainId: { address: existing.targetWallet, chainId: existing.chainId } },
                    data: { activeConfigs: { decrement: 1 } },
                }).catch(e => console.warn('[CopyTrade] Could not decrement old tracked:', e.message));
                // increment new
                await prisma.trackedWallet.upsert({
                    where: { address_chainId: { address: normalizedNextTarget, chainId } },
                    create: { address: normalizedNextTarget, chainId, activeConfigs: 1 },
                    update: { activeConfigs: { increment: 1 } },
                });

                removeAddressFromWebhook(existing.targetWallet, existing.chainId).catch(err => {
                    console.warn('[CopyTrade] Failed to remove old webhook address on update:', err.message);
                });
                addAddressToWebhook(normalizedNextTarget, chainId).catch(err => {
                    console.warn('[CopyTrade] Failed to add new webhook address on update:', err.message);
                });
            }

            return reply.send({ success: true, config });
        } catch (error) {
            console.error('[CopyTrade] Error updating config:', error);
            return handleCopyTradeError(reply, error, 'Failed to update config');
        }
    });

    /**
     * PATCH /api/copy-trade/config/:id/status
     * Pause or resume a copy trade config
     */
    fastify.patch<{ Params: { id: string }; Body: { status: 'active' | 'paused' } }>(
        '/config/:id/status',
        { preHandler: requireEndUserAuth },
        async (request, reply) => {
            const userId = (request as any).user?.sub;
            if (!userId) {
                console.warn('[CopyTrade] PATCH /status - Unauthorized request');
                return reply.status(401).send({ error: 'Unauthorized' });
            }

            console.log(`[CopyTrade] PATCH /config/${request.params.id}/status - User ${userId} -> ${request.body.status}`);

            const { id } = request.params;
            const { status } = request.body;

            if (!['active', 'paused'].includes(status)) {
                return reply.status(400).send({ error: 'Invalid status' });
            }

            try {
                const user = await prisma.user.findUnique({
                    where: { privyDid: userId },
                });

                if (!user) {
                    return reply.status(404).send({ error: 'User not found' });
                }

                const config = await prisma.copyTradeConfig.updateMany({
                    where: { id, userId: user.privyDid },
                    data: { status },
                });

                if (config.count === 0) {
                    return reply.status(404).send({ error: 'Config not found' });
                }

                return reply.send({ success: true, status });
            } catch (error) {
                console.error('[CopyTrade] Error updating config status:', error);
                return reply.status(500).send({ error: 'Failed to update config' });
            }
        }
    );
}
