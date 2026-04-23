import prisma from '../db/prisma.js';
import { getEmbeddedWalletAddress } from './privyWallet.js';

export type UserWalletBindingSyncStatus = 'synced' | 'missing_evm_wallet' | 'conflict';

export interface SyncedUserWalletBinding {
    status: UserWalletBindingSyncStatus;
    user: {
        id: string;
        privyDid: string;
        walletAddress: string;
        solanaWalletAddress: string | null;
    } | null;
    evmWalletAddress: string | null;
    solanaWalletAddress: string | null;
}

const AUTO_SYNC_COOLDOWN_MS = Number(process.env.PRIVY_WALLET_BINDING_SYNC_COOLDOWN_MS || '60000');
const AUTO_SYNC_MISSING_WALLET_RETRY_MS = Number(process.env.PRIVY_WALLET_BINDING_MISSING_WALLET_RETRY_MS || '2000');
const autoSyncCooldown = new Map<string, { lastAttemptAt: number; status: UserWalletBindingSyncStatus }>();

function normalizeEvmAddress(address: string | null | undefined): string | null {
    const value = String(address || '').trim();
    return /^0x[a-fA-F0-9]{40}$/.test(value) ? value.toLowerCase() : null;
}

function normalizeSolanaAddress(address: string | null | undefined): string | null {
    const value = String(address || '').trim();
    if (!value || value.startsWith('0x')) return null;
    return value.length >= 32 && value.length <= 44 ? value : null;
}

async function findUserForPrivyDid(userId: string) {
    return prisma.user.findFirst({
        where: {
            OR: [
                { privyDid: userId },
                { id: userId },
            ],
        },
        select: {
            id: true,
            privyDid: true,
            walletAddress: true,
            solanaWalletAddress: true,
        },
    });
}

/**
 * Synchronize local wallet bindings from Privy server-side state.
 *
 * The local User row must never be created or repaired from a client-supplied
 * wallet address. Client addresses are request hints; Privy embedded wallets
 * are the source of truth for auth-owned wallet binding.
 */
export async function syncPrivyEmbeddedWalletBindings(userId: string): Promise<SyncedUserWalletBinding> {
    const [evmWalletAddressRaw, solanaWalletAddressRaw] = await Promise.all([
        getEmbeddedWalletAddress(userId, 'ethereum').catch((error: any) => {
            console.warn('[syncPrivyEmbeddedWalletBindings] Failed to resolve Privy EVM wallet', {
                userIdPrefix: userId?.substring(0, 20),
                error: error?.message || String(error),
            });
            return null;
        }),
        getEmbeddedWalletAddress(userId, 'solana').catch((error: any) => {
            console.warn('[syncPrivyEmbeddedWalletBindings] Failed to resolve Privy Solana wallet', {
                userIdPrefix: userId?.substring(0, 20),
                error: error?.message || String(error),
            });
            return null;
        }),
    ]);

    const evmWalletAddress = normalizeEvmAddress(evmWalletAddressRaw);
    const solanaWalletAddress = normalizeSolanaAddress(solanaWalletAddressRaw);
    const existingUser = await findUserForPrivyDid(userId);

    if (!evmWalletAddress) {
        const effectiveSolanaWalletAddress = solanaWalletAddress || existingUser?.solanaWalletAddress || null;
        if (existingUser && solanaWalletAddress && existingUser.solanaWalletAddress !== solanaWalletAddress) {
            const updated = await prisma.user.update({
                where: { id: existingUser.id },
                data: { solanaWalletAddress },
                select: {
                    id: true,
                    privyDid: true,
                    walletAddress: true,
                    solanaWalletAddress: true,
                },
            });
            return {
                status: 'missing_evm_wallet',
                user: updated,
                evmWalletAddress: null,
                solanaWalletAddress: effectiveSolanaWalletAddress,
            };
        }

        return {
            status: 'missing_evm_wallet',
            user: existingUser,
            evmWalletAddress: null,
            solanaWalletAddress: effectiveSolanaWalletAddress,
        };
    }

    if (existingUser) {
        const currentEvmAddress = normalizeEvmAddress(existingUser.walletAddress);
        const nextSolanaWalletAddress = solanaWalletAddress || existingUser.solanaWalletAddress;
        if (currentEvmAddress !== evmWalletAddress) {
            const existingOwner = await prisma.user.findFirst({
                where: {
                    walletAddress: {
                        equals: evmWalletAddress,
                        mode: 'insensitive',
                    },
                    NOT: { id: existingUser.id },
                },
                select: { id: true, privyDid: true },
            });

            if (existingOwner) {
                console.error('[syncPrivyEmbeddedWalletBindings] EVM wallet sync conflict', {
                    userIdPrefix: userId?.substring(0, 20),
                    evmWalletAddress,
                    existingOwnerId: existingOwner.id,
                    existingOwnerPrivyDid: existingOwner.privyDid,
                });
                return {
                    status: 'conflict',
                    user: existingUser,
                    evmWalletAddress,
                    solanaWalletAddress: nextSolanaWalletAddress,
                };
            }
        }

        if (currentEvmAddress !== evmWalletAddress || existingUser.solanaWalletAddress !== nextSolanaWalletAddress) {
            const updated = await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    walletAddress: evmWalletAddress,
                    solanaWalletAddress: nextSolanaWalletAddress,
                },
                select: {
                    id: true,
                    privyDid: true,
                    walletAddress: true,
                    solanaWalletAddress: true,
                },
            });
            console.log('[syncPrivyEmbeddedWalletBindings] Synced Privy wallet bindings', {
                userId: updated.id,
                evmWalletAddress,
                solanaWalletAddress: nextSolanaWalletAddress,
            });
            return {
                status: 'synced',
                user: updated,
                evmWalletAddress,
                solanaWalletAddress: nextSolanaWalletAddress,
            };
        }

        return {
            status: 'synced',
            user: existingUser,
            evmWalletAddress,
            solanaWalletAddress: nextSolanaWalletAddress,
        };
    }

    const walletOwner = await prisma.user.findFirst({
        where: {
            walletAddress: {
                equals: evmWalletAddress,
                mode: 'insensitive',
            },
        },
        select: {
            id: true,
            privyDid: true,
            walletAddress: true,
            solanaWalletAddress: true,
        },
    });

    if (walletOwner) {
        console.error('[syncPrivyEmbeddedWalletBindings] EVM wallet already belongs to another Privy user', {
            userIdPrefix: userId?.substring(0, 20),
            evmWalletAddress,
            existingOwnerId: walletOwner.id,
            existingOwnerPrivyDid: walletOwner.privyDid,
        });
        return {
            status: 'conflict',
            user: null,
            evmWalletAddress,
            solanaWalletAddress,
        };
    }

    const created = await prisma.user.create({
        data: {
            privyDid: userId,
            walletAddress: evmWalletAddress,
            solanaWalletAddress,
        },
        select: {
            id: true,
            privyDid: true,
            walletAddress: true,
            solanaWalletAddress: true,
        },
    });

    console.log('[syncPrivyEmbeddedWalletBindings] Created user from Privy wallet bindings', {
        userId: created.id,
        evmWalletAddress,
        solanaWalletAddress,
    });

    return {
        status: 'synced',
        user: created,
        evmWalletAddress,
        solanaWalletAddress,
    };
}

export async function maybeAutoSyncPrivyWalletBindings(userId: string): Promise<SyncedUserWalletBinding | null> {
    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId) return null;

    const now = Date.now();
    const previous = autoSyncCooldown.get(normalizedUserId);
    const cooldownMs = previous?.status === 'missing_evm_wallet'
        ? AUTO_SYNC_MISSING_WALLET_RETRY_MS
        : AUTO_SYNC_COOLDOWN_MS;
    if (previous && (now - previous.lastAttemptAt) < cooldownMs) {
        return null;
    }

    autoSyncCooldown.set(normalizedUserId, {
        lastAttemptAt: now,
        status: previous?.status || 'missing_evm_wallet',
    });

    const result = await syncPrivyEmbeddedWalletBindings(normalizedUserId);
    autoSyncCooldown.set(normalizedUserId, {
        lastAttemptAt: Date.now(),
        status: result.status,
    });
    return result;
}
