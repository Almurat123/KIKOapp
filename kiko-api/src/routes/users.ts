/**
 * User Settings Routes
 * API endpoints for managing user custom AI settings and wallet exports
 */

// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Almurat
// Reason: user identity sync now spans Privy, Farcaster, X, wallet flows, and
//         persisted per-user model policy. X mention replies must follow the
//         same saved default model a user selected on the website. Farcaster
//         linkage now also has to come from verified Privy identity instead of
//         accepting client-supplied FIDs.
// Goal: preserve one stable owner for user-profile persistence, including the
//       canonical in-app username field, verified social-account linkage state,
//       and the user's saved default chat model for cross-channel replies.
// Owns: authenticated user settings routes, social identity sync endpoints, and
//       persistence rules for the shared User row.
// Does Not Own: Privy token verification, wallet custody, or X webhook ingress.
// Design Language:
// - Persist canonical user profile fields from authenticated identity sources.
// - Prefer stable normalization over ad hoc per-route formatting.
// - Do not let social-link sync silently drift from the User schema.
// - Existing authenticated users must not need a second wallet gate just to
//   persist a verified X linkage that Privy already knows.
// - Verified Farcaster linkage must be server-derived from Privy, not trusted
//   from frontend request bodies.
// - Persist the user's default reply model in one backend setting row, not
//   only in frontend localStorage.
// Document Provenance:
// - Source: current repo model catalog + website/X model binding requirement
// - Kind: repo doc
// - Retrieved: 2026-04-10
// - Applied To: adding UserSettings.defaultChatModel and exposing it through authenticated settings routes
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/owner-map/backend-swap-validation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-user-default-chat-model-for-x-mentions.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-09-user-username-foundation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-09-x-oauth-official-account-flow.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-x-user-auto-sync.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-farcaster-verified-identity-sync.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { trackLogin } from '../services/userActivityService.js';
import { syncVerifiedPrivyFarcasterUser } from '../services/farcaster-agent/farcasterIdentityService.js';
import { getCachedKikoFollowState, resolveKikoFollowState } from '../services/farcasterRelationshipService.js';
import { buildXLinkUrl, getXContextForUser, serializeXContext, syncVerifiedPrivyXUser } from '../services/x/xIdentityService.js';
import { normalizeSupportedChatModel } from '../config/chatModels.js';

// Types
interface UserSettingsBody {
    // userRole removed 
    defaultChatModel?: string;
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

function normalizeCanonicalUsername(value: string | null | undefined): string | null {
    const normalized = String(value || '').trim().replace(/^@+/, '').toLowerCase();
    return normalized || null;
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
                        ...(body.defaultChatModel !== undefined
                            ? { defaultChatModel: normalizeSupportedChatModel(body.defaultChatModel) }
                            : {}),
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
                        defaultChatModel: normalizeSupportedChatModel(body.defaultChatModel),
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
        fid?: number;
        username?: string;
    }

interface XSyncBody {
        dmOptIn?: boolean;
        accessTokenRef?: string;
        refreshTokenRef?: string;
    }

    /**
     * POST /api/users/farcaster
     * Sync Farcaster profile from verified Privy linkage.
     * Request body is ignored for identity; the server derives the linked
     * Farcaster account from Privy for the authenticated user.
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

                const result = await syncVerifiedPrivyFarcasterUser({ userId });

                if (result.status === 'no_farcaster_account') {
                    return reply.status(400).send({ success: false, error: 'No verified Farcaster account is linked to this Privy user' });
                }

                if (result.status === 'missing_wallet' || !result.user) {
                    return reply.status(400).send({ success: false, error: 'Embedded wallet not available for this account' });
                }

                const user = result.user;

                console.log(`[Farcaster] ✅ Synced verified FID ${user.farcasterFid} (${user.farcasterUsername || 'unknown'}) for user ${user.id}`);

                return {
                    success: true,
                    data: {
                        fid: user.farcasterFid,
                        username: user.farcasterUsername
                    }
                };
            } catch (error: any) {
                console.error('[Farcaster] Error syncing profile:', error);
                if (String(error?.message || '').includes('already linked to another user')) {
                    return reply.status(409).send({ success: false, error: 'Farcaster account already linked to another user' });
                }
                return reply.status(500).send({ success: false, error: error.message });
            }
        }
    );

    /**
     * GET /api/users/farcaster/context
     * Return the authenticated user's normalized Farcaster context for global UI + chat use.
     */
    app.get<{ Querystring: { refresh?: string } }>(
        '/api/users/farcaster/context',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Querystring: { refresh?: string } }>, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                if (!userId) {
                    return reply.status(401).send({ success: false, error: 'Unauthorized' });
                }

                const user = await prisma.user.findUnique({
                    where: { privyDid: userId },
                    select: {
                        farcasterFid: true,
                        farcasterUsername: true,
                    }
                });

                if (!user) {
                    return reply.status(404).send({ success: false, error: 'User not found' });
                }

                const fid = user.farcasterFid ?? null;
                const shouldRefresh = request.query?.refresh === '1';
                const followState = fid
                    ? (shouldRefresh
                        ? await resolveKikoFollowState(fid, { forceRefresh: true })
                        : await getCachedKikoFollowState(fid))
                    : null;
                const username = user.farcasterUsername || null;

                return {
                    success: true,
                    data: {
                        fid,
                        username,
                        profileUrl: username ? `https://warpcast.com/${String(username).replace(/^@/, '')}` : null,
                        kikoHandle: 'kikoapp',
                        followsKiko: followState?.followsKiko ?? null,
                        followStatus: followState?.status ?? 'unknown',
                        checkedAt: followState?.checkedAt ?? null,
                    }
                };
            } catch (error: any) {
                console.error('[Farcaster] Error loading context:', error);
                return reply.status(500).send({ success: false, error: error.message });
            }
        }
    );

    // =============================================
    // X Profile Sync
    // =============================================

    app.post<{ Body: XSyncBody }>(
        '/api/users/x/sync',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Body: XSyncBody }>, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                if (!userId) {
                    return reply.status(401).send({ success: false, error: 'Unauthorized' });
                }

                const result = await syncVerifiedPrivyXUser({
                    userId,
                    dmOptIn: request.body?.dmOptIn !== false,
                    accessTokenRef: request.body?.accessTokenRef,
                    refreshTokenRef: request.body?.refreshTokenRef,
                });

                if (result.status === 'no_x_account') {
                    return reply.status(400).send({ success: false, error: 'No verified X account is linked to this Privy user' });
                }

                if (result.status === 'missing_wallet' || !result.user) {
                    return reply.status(400).send({ success: false, error: 'Embedded wallet not available for this account' });
                }

                return {
                    success: true,
                    data: serializeXContext(result.user)
                };
            } catch (error: any) {
                console.error('[X] Error syncing profile:', error);
                if (String(error?.message || '').includes('already linked to another user')) {
                    return reply.status(409).send({ success: false, error: 'X account already linked to another user' });
                }
                return reply.status(500).send({ success: false, error: error.message });
            }
        }
    );

    app.get(
        '/api/users/x/context',
        { preHandler: requireAuth },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                if (!userId) {
                    return reply.status(401).send({ success: false, error: 'Unauthorized' });
                }

                const context = await getXContextForUser(userId);
                if (!context) {
                    return reply.status(404).send({ success: false, error: 'User not found' });
                }

                return {
                    success: true,
                    data: context
                };
            } catch (error: any) {
                console.error('[X] Error loading context:', error);
                return reply.status(500).send({ success: false, error: error.message });
            }
        }
    );

    app.delete(
        '/api/users/x',
        { preHandler: requireAuth },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                if (!userId) {
                    return reply.status(401).send({ success: false, error: 'Unauthorized' });
                }

                const user = await prisma.user.update({
                    where: { privyDid: userId },
                    data: {
                        xUserId: null,
                        xUsername: null,
                        xLinkedAt: null,
                        xDmOptInAt: null,
                        xAccessTokenRef: null,
                        xRefreshTokenRef: null,
                        xNotificationsMutedAt: null,
                    }
                });

                return {
                    success: true,
                    data: {
                        ...serializeXContext(user),
                        linkUrl: buildXLinkUrl(),
                    }
                };
            } catch (error: any) {
                console.error('[X] Error unlinking profile:', error);
                return reply.status(500).send({ success: false, error: error.message });
            }
        }
    );

    app.put<{ Body: { notificationsMuted?: boolean; dmOptIn?: boolean } }>(
        '/api/users/x/preferences',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Body: { notificationsMuted?: boolean; dmOptIn?: boolean } }>, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                if (!userId) {
                    return reply.status(401).send({ success: false, error: 'Unauthorized' });
                }

                const notificationsMuted = request.body?.notificationsMuted === true;
                const dmOptIn = request.body?.dmOptIn !== false;

                const user = await prisma.user.update({
                    where: { privyDid: userId },
                    data: {
                        xNotificationsMutedAt: notificationsMuted ? new Date() : null,
                        xDmOptInAt: dmOptIn ? (new Date()) : null,
                    }
                });

                return {
                    success: true,
                    data: serializeXContext(user)
                };
            } catch (error: any) {
                console.error('[X] Error updating preferences:', error);
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
