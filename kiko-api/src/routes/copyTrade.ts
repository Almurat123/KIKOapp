import { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { addAddressToWebhook, removeAddressFromWebhook } from '../services/alchemyWebhookService.js';
import { sendTradeNotification } from '../services/emailService.js';
import { PrivyClient } from '@privy-io/server-auth';

// Helper to normalize wallet address
// EVM addresses (0x...) are case-insensitive, so lowercase them
// Solana addresses are case-sensitive (Base58), keep as-is
function normalizeAddress(address: string): string {
    if (!address) return address;
    if (address.startsWith('0x')) return address.toLowerCase();
    // Simple heuristic for Solana: 32-44 base58 chars
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return address;
    return address; // Default to as-is if unsure
}

/**
 * POST /api/copy-trade/config
 * Create a new copy trade configuration
 */
fastify.post<{ Body: CreateConfigBody }>('/config', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const walletAddress = (request as any).walletAddress;

    if (!userId || !walletAddress) {
        console.warn('[CopyTrade] POST /config - Unauthorized request');
        return reply.status(401).send({ error: 'Unauthorized' });
    }

    let {
        targetWallet,
        buyAmountUsd,
        chainId, // Will default logic below
        maxSlippageBps = 300,
        minMarketCapUsd,
        minLiquidityUsd,
        minTargetValueUsd,
        takeProfitPct,
        stopLossPct,
        mirrorSell = true,
    } = request.body;

    if (!targetWallet || !buyAmountUsd) {
        return reply.status(400).send({ error: 'targetWallet and buyAmountUsd are required' });
    }

    // --- INTELLIGENT CHAIN DETECTION ---
    // If chainId is missing, trying to infer from address
    if (!chainId) {
        if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(targetWallet)) {
            chainId = 900; // Solana
        } else if (targetWallet.startsWith('0x')) {
            chainId = 8453; // Default Base for EVM
        } else {
            chainId = 8453;
        }
    }

    // Normalize target wallet based on chain
    const normalizedTarget = chainId === 900 ? targetWallet : targetWallet.toLowerCase();

    console.log(`[CopyTrade] POST /config - User ${userId}`, {
        target: normalizedTarget,
        chainId: chainId,
        rawTarget: targetWallet
    });

    try {
        // Find or create user
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

            // Determine user wallet normalization
            const isSolanaUser = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress);
            const normalizedUserWallet = isSolanaUser ? walletAddress : walletAddress.toLowerCase();

            user = await prisma.user.create({
                data: {
                    privyDid: userId,
                    walletAddress: normalizedUserWallet,
                    email: email, // Cache email if found
                },
            });
            console.log('[CopyTrade] Created new user:', user.id, email ? `with email ${email}` : 'without email');

            // 📧 Send Welcome Email
            if (email) {
                sendTradeNotification(email, {
                    type: 'welcome',
                    userName: 'KIKO Trader' // Or try to get display name from Privy
                }).catch(e => console.error('[CopyTrade] Failed to send welcome email:', e));
            }
        }

        // Create config
        const config = await prisma.copyTradeConfig.create({
            data: {
                userId: user.id,
                targetWallet: normalizedTarget,
                chainId,
                buyAmountUsd,
                maxSlippageBps,
                minMarketCapUsd,
                minLiquidityUsd,
                minTargetValueUsd,
                takeProfitPct,
                stopLossPct,
                mirrorSell,
            },
        });

        // Update or create tracked wallet (using composite key: address + chainId)
        await prisma.trackedWallet.upsert({
            where: {
                address_chainId: {
                    address: normalizeAddress(targetWallet),
                    chainId
                }
            },
            create: {
                address: normalizeAddress(targetWallet),
                chainId,
                activeConfigs: 1,
            },
            update: {
                activeConfigs: { increment: 1 },
            },
        });

        console.log('[CopyTrade] Created config:', config.id, 'for target:', targetWallet);

        // Register address with Alchemy webhook for real-time notifications
        console.log(`[CopyTrade] Attempting to add ${targetWallet} to Alchemy webhook for chain ${chainId}`);
        addAddressToWebhook(targetWallet, chainId)
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

        return reply.send({
            success: true,
            config,
        });
    } catch (error) {
        console.error('[CopyTrade] Error creating config:', error);
        return reply.status(500).send({ error: 'Failed to create config' });
    }
});

/**
 * DELETE /api/copy-trade/config/:id
 * Delete a copy trade configuration
 */
fastify.delete<{ Params: { id: string } }>('/config/:id', { preHandler: requireAuth }, async (request, reply) => {
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
            where: { id, userId: user.id },
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
 * PATCH /api/copy-trade/config/:id
 * Update a copy trade configuration
 */
fastify.patch<{ Params: { id: string }; Body: Partial<CreateConfigBody> }>('/config/:id', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
        console.warn('[CopyTrade] PATCH /config - Unauthorized request');
        return reply.status(401).send({ error: 'Unauthorized' });
    }

    console.log(`[CopyTrade] PATCH /config/${request.params.id} - User ${userId}`, request.body);

    const { id } = request.params;
    const updates = request.body;

    try {
        const user = await prisma.user.findUnique({
            where: { privyDid: userId },
        });

        if (!user) {
            return reply.status(404).send({ error: 'User not found' });
        }

        // Verify ownership
        const existing = await prisma.copyTradeConfig.findFirst({
            where: { id, userId: user.id },
        });

        if (!existing) {
            return reply.status(404).send({ error: 'Config not found' });
        }

        // Update
        const config = await prisma.copyTradeConfig.update({
            where: { id },
            data: {
                ...updates,
                // If target wallet changed, we need complex logic to update TrackedWallet counts
                // For MVP simplicity, let's assume targetWallet update is allowed but we handle tracking count locally or lazily
                // Ideally we should decrement old and increment new.
                targetWallet: updates.targetWallet ? normalizeAddress(updates.targetWallet) : undefined,
            },
        });

        if (updates.targetWallet && normalizeAddress(updates.targetWallet) !== existing.targetWallet) {
            // Update tracking: decrement old (composite key)
            await prisma.trackedWallet.update({
                where: { address_chainId: { address: existing.targetWallet, chainId: config.chainId } },
                data: { activeConfigs: { decrement: 1 } },
            }).catch(e => console.warn('[CopyTrade] Could not decrement old tracked:', e.message));
            // increment new
            await prisma.trackedWallet.upsert({
                where: { address_chainId: { address: normalizeAddress(updates.targetWallet), chainId: config.chainId } },
                create: { address: normalizeAddress(updates.targetWallet), chainId: config.chainId, activeConfigs: 1 },
                update: { activeConfigs: { increment: 1 } },
            });
        }

        return reply.send({ success: true, config });
    } catch (error) {
        console.error('[CopyTrade] Error updating config:', error);
        return reply.status(500).send({ error: 'Failed to update config' });
    }
});

/**
 * PATCH /api/copy-trade/config/:id/status
 * Pause or resume a copy trade config
 */
fastify.patch<{ Params: { id: string }; Body: { status: 'active' | 'paused' } }>(
    '/config/:id/status',
    { preHandler: requireAuth },
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
                where: { id, userId: user.id },
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
