/**
 * User Settings Routes
 * API endpoints for managing user custom AI settings and wallet exports
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

// Types
interface UserSettingsBody {
    userRole?: string;
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
}

interface WalletExportBody {
    walletAddress: string;
    chainType: string;
}

interface WalletExportQuery {
    walletAddress: string;
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

                // Return settings or null if not set
                return {
                    success: true,
                    data: user.settings || null
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
                    where: { userId: user.id },
                    update: {
                        userRole: body.userRole,
                        defaultSwapAmount: body.defaultSwapAmount,
                        defaultSwapUnit: body.defaultSwapUnit,
                        checkTokenBeforeSwap: body.checkTokenBeforeSwap,
                        quickSwapMode: body.quickSwapMode,
                        swapMethod: body.swapMethod,
                        slippageMode: body.slippageMode,
                        customSlippage: body.customSlippage,
                        mevProtection: body.mevProtection,
                        priceDeviationCheck: body.priceDeviationCheck,
                        copyTradeAIMode: body.copyTradeAIMode,
                        fastSwapMode: body.fastSwapMode,
                    },
                    create: {
                        userId: user.id,
                        userRole: body.userRole || 'default',
                        defaultSwapAmount: body.defaultSwapAmount || 100,
                        defaultSwapUnit: body.defaultSwapUnit || 'native',
                        checkTokenBeforeSwap: body.checkTokenBeforeSwap ?? true,
                        quickSwapMode: body.quickSwapMode ?? false,
                        swapMethod: body.swapMethod || 'swap_card',
                        slippageMode: body.slippageMode || 'auto',
                        customSlippage: body.customSlippage || 0.5,
                        mevProtection: body.mevProtection ?? true,
                        priceDeviationCheck: body.priceDeviationCheck ?? true,
                        copyTradeAIMode: body.copyTradeAIMode || 'disabled',
                        fastSwapMode: body.fastSwapMode ?? false,
                    }
                });

                return {
                    success: true,
                    data: settings
                };
            } catch (error: any) {
                console.error('[UserSettings] Error updating settings:', error);
                return reply.status(500).send({ success: false, error: error.message });
            }
        }
    );

    // =============================================
    // Wallet Export Tracking
    // =============================================

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
                            user = await prisma.user.findUnique({
                                where: { walletAddress }
                            });
                            if (user) {
                                // Update the privyDid if needed
                                user = await prisma.user.update({
                                    where: { id: user.id },
                                    data: { privyDid: userId }
                                });
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
                            userId: user.id,
                            walletAddress
                        }
                    },
                    update: {
                        exportedAt: new Date()
                    },
                    create: {
                        userId: user.id,
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
                            userId: user.id,
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
