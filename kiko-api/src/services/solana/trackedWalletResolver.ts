import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import prisma from '../../db/prisma.js';
import { normalizeAddress } from '../../utils/address.js';
import {
    extractCandidateAddressesFromParsedSolanaTransaction,
    fetchParsedSolanaTransaction
} from './solanaWebhookHandler.js';

export type ResolveSolanaTrackedWalletsResult = {
    trackedWallets: Array<{ address: string }>;
    parsedTx: ParsedTransactionWithMeta | null;
    candidateAddresses: string[];
    reasonCode:
    | 'raw_candidates'
    | 'parsed_tx_candidates'
    | 'pending_hint_fallback'
    | 'parsed_tx_unavailable'
    | 'no_tracked_wallets';
};

async function findTrackedWallets(chainId: number, addresses: string[]): Promise<Array<{ address: string }>> {
    if (!addresses.length) return [];

    return prisma.trackedWallet.findMany({
        where: {
            address: { in: addresses, mode: 'insensitive' },
            chainId,
            activeConfigs: { gt: 0 }
        },
        select: { address: true }
    });
}

export async function resolveSolanaTrackedWallets(params: {
    chainId: number;
    txHash: string;
    rawCandidates: string[];
    pendingTargetWallet?: string | null;
    preResolvedTrackedWallets?: Array<{ address: string }>;
}): Promise<ResolveSolanaTrackedWalletsResult> {
    const rawCandidates = Array.from(new Set(params.rawCandidates.map((address) => normalizeAddress(address)).filter(Boolean)));
    const preResolvedTrackedWallets = params.preResolvedTrackedWallets || [];
    if (preResolvedTrackedWallets.length > 0) {
        return {
            trackedWallets: preResolvedTrackedWallets,
            parsedTx: null,
            candidateAddresses: rawCandidates,
            reasonCode: 'raw_candidates'
        };
    }

    const rawTrackedWallets = await findTrackedWallets(params.chainId, rawCandidates);
    if (rawTrackedWallets.length > 0) {
        return {
            trackedWallets: rawTrackedWallets,
            parsedTx: null,
            candidateAddresses: rawCandidates,
            reasonCode: 'raw_candidates'
        };
    }

    const parsedTx = await fetchParsedSolanaTransaction(params.txHash);
    if (!parsedTx) {
        const pendingTargetWallet = normalizeAddress(params.pendingTargetWallet || '');
        if (pendingTargetWallet) {
            return {
                trackedWallets: [{ address: pendingTargetWallet }],
                parsedTx: null,
                candidateAddresses: rawCandidates,
                reasonCode: 'pending_hint_fallback'
            };
        }
        return {
            trackedWallets: [],
            parsedTx: null,
            candidateAddresses: rawCandidates,
            reasonCode: 'parsed_tx_unavailable'
        };
    }

    const parsedCandidates = extractCandidateAddressesFromParsedSolanaTransaction(parsedTx);
    const parsedTrackedWallets = await findTrackedWallets(params.chainId, parsedCandidates);
    if (parsedTrackedWallets.length > 0) {
        return {
            trackedWallets: parsedTrackedWallets,
            parsedTx,
            candidateAddresses: parsedCandidates,
            reasonCode: 'parsed_tx_candidates'
        };
    }

    const pendingTargetWallet = normalizeAddress(params.pendingTargetWallet || '');
    if (pendingTargetWallet) {
        return {
            trackedWallets: [{ address: pendingTargetWallet }],
            parsedTx,
            candidateAddresses: parsedCandidates,
            reasonCode: 'pending_hint_fallback'
        };
    }

    return {
        trackedWallets: [],
        parsedTx,
        candidateAddresses: parsedCandidates,
        reasonCode: 'no_tracked_wallets'
    };
}
