/**
 * User Settings Routes
 * API endpoints for managing user custom AI settings and wallet exports
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { trackLogin } from '../services/userActivityService.js';

// Types
interface UserSettingsBody {
    // userRole removed 
    defaultSwapAmount?: number;
    defaultSwapUnit?: string;
    checkTokenBeforeSwap?: boolean;
    quickSwapMode?: boolean;
    swapMethod?: string;
    slippageMode?: string;
    customSlippage?: number;
    mevProtection?: boolean;
    priceDeviationCheck?: boolean;
    copyTradeAIMode?: string;
    fastSwapMode?: boolean;
    copyTradeTokenCooldownMinutes?: number | null;
}

interface WalletExportBody {
    walletAddress: string;
    chainType: string;
}

interface WalletExportQuery {
    walletAddress: string;
}

function serializeUserSettings(settings: any) {
    if (!settings) return settings;
    const {
        minMarketCapUsd: _minMarketCapUsd,
        minLiquidityUsd: _minLiquidityUsd,
        minTargetValueUsd: _minTargetValueUsd,
        ...safeSettings
    } = settings;
    return safeSettings;
}

export async function registerUserRoutes(app: FastifyInstance) {
    // =============================================
    // User Settings
    // =============================================

    /**
     * GET /api/users/settings
     * Get current user's settings
     */
    app.get(
        '/api/users/settings',
        { preHandler: requireAuth },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                if (!userId) {
                    return reply.status(401).send({ success: false, error: 'Unauthorized' });
                }

                // Find user by privyDid
                const user = await prisma.user.findUnique({
                    where: { privyDid: userId },
                    include: { settings: true }
                });

                if (!user) {
                    return reply.status(404).send({ success: false, error: 'User not found' });
                }

                // Track daily login activity
                trackLogin(user.privyDid);

                // Return settings or null if not set
                return {
                    success: true,
                    data: serializeUserSettings(user.settings || null)
                };
            } catch (error: any) {
                console.error('[UserSettings] Error getting settings:', error);
                return reply.status(500).send({ success: false, error: error.message });
            }
        }
    );

    /**
     * PUT /api/users/settings
     * Update current user's settings (upsert)
     */
    app.put<{ Body: UserSettingsBody }>(
        '/api/users/settings',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Body: UserSettingsBody }>, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                if (!userId) {
                    return reply.status(401).send({ success: false, error: 'Unauthorized' });
                }

                const body = request.body;

                // 🔧 DEBUG: Log setting changes
                console.log(`[UserSettings] PUT /api/users/settings for user ${userId}:`, JSON.stringify(body, null, 2));

                // Find user by privyDid
                const user = await prisma.user.findUnique({
                    where: { privyDid: userId }
                });

                if (!user) {
                    return reply.status(404).send({ success: false, error: 'User not found' });
                }

                // Upsert settings
                const settings = await prisma.userSettings.upsert({
                    where: { userId: user.privyDid },
                    update: {
                        // userRole removed
                        defaultSwapAmount: body.defaultSwapAmount,
                        defaultSwapUnit: body.defaultSwapUnit,
                        checkTokenBeforeSwap: body.checkTokenBeforeSwap,
                        quickSwapMode: body.quickSwapMode,
                        swapMethod: 'allowance_trade', // FORCED: Ignore frontend value, always use allowance_trade
                        slippageMode: body.slippageMode,
                        customSlippage: (body.customSlippage != null && (body.customSlippage as unknown) !== '')
                            ? parseFloat(String(body.customSlippage)) || undefined
                            : undefined,
                        mevProtection: body.mevProtection,
                        priceDeviationCheck: body.priceDeviationCheck,
                        copyTradeAIMode: body.copyTradeAIMode,
                        fastSwapMode: body.fastSwapMode,
                        copyTradeTokenCooldownMinutes: body.copyTradeTokenCooldownMinutes ?? undefined,
                    },
                    create: {
                        userId: user.privyDid,
                        // userRole removed
                        defaultSwapAmount: body.defaultSwapAmount || 100,
                        defaultSwapUnit: body.defaultSwapUnit || 'native',
                        checkTokenBeforeSwap: body.checkTokenBeforeSwap ?? true,
                        quickSwapMode: body.quickSwapMode ?? false,
                        swapMethod: 'allowance_trade', // FORCED: All users use allowance_trade mode
                        slippageMode: body.slippageMode || 'auto',
                        customSlippage: body.customSlippage || 0.5,
                        mevProtection: body.mevProtection ?? true,
                        priceDeviationCheck: body.priceDeviationCheck ?? true,
                        copyTradeAIMode: body.copyTradeAIMode || 'disabled',
                        fastSwapMode: body.fastSwapMode ?? false,
                        copyTradeTokenCooldownMinutes: body.copyTradeTokenCooldownMinutes ?? 60,
                    }
                });

                return {
                    success: true,
                    data: serializeUserSettings(settings)
                };
            } catch (error: any) {
                console.error('[UserSettings] Error updating settings:', error);
                return reply.status(500).send({ success: false, error: error.message });
            }
        }
    );

    // =============================================
    // Farcaster Profile Sync
    // =============================================

    interface FarcasterSyncBody {
        fid: number;
        username?: string;
    }

    /**
     * POST /api/users/farcaster
     * Sync Farcaster profile from Privy login
     * Called by frontend after Farcaster login to save FID for direct messaging
     */
    app.post<{ Body: FarcasterSyncBody }>(
        '/api/users/farcaster',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Body: FarcasterSyncBody }>, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                if (!userId) {
                    return reply.status(401).send({ success: false, error: 'Unauthorized' });
                }

                const { fid, username } = request.body;
                if (!fid) {
                    return reply.status(400).send({ success: false, error: 'fid is required' });
                }

                console.log(`[Farcaster] Syncing FID ${fid} for user ${userId}`);

                // Update user with Farcaster info
                const user = await prisma.user.update({
                    where: { privyDid: userId },
                    data: {
                        farcasterFid: fid,
                        farcasterUsername: username || null
                    }
                });

                console.log(`[Farcaster] ✅ Synced FID ${fid} (${username}) for user ${user.id}`);

                return {
                    success: true,
                    data: {
                        fid: user.farcasterFid,
                        username: user.farcasterUsername
                    }
                };
            } catch (error: any) {
                console.error('[Farcaster] Error syncing profile:', error);
                return reply.status(500).send({ success: false, error: error.message });
            }
        }
    );

    // =============================================
    // Wallet Export Tracking
    // ==============================================

    /**
     * GET /api/users/wallet-exports
     * Get list of wallets that user has exported keys for
     */
    app.get(
        '/api/users/wallet-exports',
        { preHandler: requireAuth },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                if (!userId) {
                    return reply.status(401).send({ success: false, error: 'Unauthorized' });
                }

                const user = await prisma.user.findUnique({
                    where: { privyDid: userId },
                    include: { walletExports: true }
                });

                if (!user) {
                    // Return empty array for new users instead of 404
                    return {
                        success: true,
                        data: []
                    };
                }

                return {
                    success: true,
                    data: user.walletExports.map((e: any) => ({
                        walletAddress: e.walletAddress,
                        chainType: e.chainType,
                        exportedAt: e.exportedAt
                    }))
                };
            } catch (error: any) {
                console.error('[WalletExport] Error getting exports:', error);
                return reply.status(500).send({ success: false, error: error.message });
            }
        }
    );

    /**
     * POST /api/users/wallet-exports
     * Record a wallet key export
     */
    app.post<{ Body: WalletExportBody }>(
        '/api/users/wallet-exports',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Body: WalletExportBody }>, reply: FastifyReply) => {
            console.log('[WalletExport] POST /api/users/wallet-exports called');
            try {
                const userId = (request as any).user?.sub; // This is the Privy DID from the token
                console.log('[WalletExport] userId from token:', userId);
                if (!userId) {
                    return reply.status(401).send({ success: false, error: 'Unauthorized' });
                }

                const { walletAddress, chainType } = request.body;
                console.log('[WalletExport] Request body:', { walletAddress, chainType });
                if (!walletAddress || !chainType) {
                    return reply.status(400).send({ success: false, error: 'walletAddress and chainType are required' });
                }

                // Ensure user exists, create if not (using the exported wallet as their address if new)
                // This handles the case where a new user is created via embedded wallet and hasn't been synced yet
                let user = await prisma.user.findUnique({
                    where: { privyDid: userId }
                });

                if (!user) {
                    console.log(`[WalletExport] User ${userId} not found, creating new user record`);
                    try {
                        user = await prisma.user.create({
                            data: {
                                privyDid: userId,
                                walletAddress: walletAddress, // Use this wallet as their primary for now
                            }
                        });
                    } catch (createError: any) {
                        // Handle race condition or unique constraint violation on walletAddress
                        console.error('[WalletExport] Error creating user:', createError);
                        // Try to find by wallet address if it's a unique constraint violation
                        if (createError.code === 'P2002') {
                            // If a user with this walletAddress already exists
                            user = await prisma.user.findUnique({
                                where: { walletAddress }
                            });

                            // SECURITY FIX: Only associate the DID if the user doesn't already have one
                            // or if it's the exact same DID (no-op).
                            // This prevents an attacker from hijacking an existing user's record
                            // simply by claiming their wallet address.
                            if (user && (!user.privyDid || user.privyDid === userId)) {
                                user = await prisma.user.update({
                                    where: { id: user.id },
                                    data: { privyDid: userId }
                                });
                            } else if (user && user.privyDid !== userId) {
                                console.error(`[WalletExport] SECURITY ALERT: User ${userId} tried to claim wallet ${walletAddress} which is already owned by DID ${user.privyDid}`);
                                return reply.status(403).send({ success: false, error: 'Wallet address owned by another account' });
                            }
                        }
                        if (!user) {
                            return reply.status(500).send({ success: false, error: 'Failed to create user record' });
                        }
                    }
                }

                // Upsert the export record
                const exportRecord = await prisma.walletExport.upsert({
                    where: {
                        userId_walletAddress: {
                            userId: user.privyDid,
                            walletAddress
                        }
                    },
                    update: {
                        exportedAt: new Date()
                    },
                    create: {
                        userId: user.privyDid,
                        walletAddress,
                        chainType
                    }
                });

                console.log('[WalletExport] ✅ Successfully saved export record:', exportRecord.id);

                return {
                    success: true,
                    data: {
                        walletAddress: exportRecord.walletAddress,
                        chainType: exportRecord.chainType,
                        exportedAt: exportRecord.exportedAt
                    }
                };
            } catch (error: any) {
                console.error('[WalletExport] Error recording export:', error);
                return reply.status(500).send({ success: false, error: error.message });
            }
        }
    );

    /**
     * GET /api/users/wallet-exports/check
     * Check if a specific wallet has been exported
     */
    app.get<{ Querystring: WalletExportQuery }>(
        '/api/users/wallet-exports/check',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Querystring: WalletExportQuery }>, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                if (!userId) {
                    return reply.status(401).send({ success: false, error: 'Unauthorized' });
                }

                const { walletAddress } = request.query;
                if (!walletAddress) {
                    return reply.status(400).send({ success: false, error: 'walletAddress is required' });
                }

                const user = await prisma.user.findUnique({
                    where: { privyDid: userId }
                });

                if (!user) {
                    // New user, nothing exported yet
                    return {
                        success: true,
                        data: {
                            exported: false,
                            exportedAt: null
                        }
                    };
                }

                const exportRecord = await prisma.walletExport.findUnique({
                    where: {
                        userId_walletAddress: {
                            userId: user.privyDid,
                            walletAddress
                        }
                    }
                });

                return {
                    success: true,
                    data: {
                        exported: !!exportRecord,
                        exportedAt: exportRecord?.exportedAt || null
                    }
                };
            } catch (error: any) {
                console.error('[WalletExport] Error checking export:', error);
                return reply.status(500).send({ success: false, error: error.message });
            }
        }
    );
}
