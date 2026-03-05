import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import prisma from '../../db/prisma.js';
import { normalizeAddress } from '../../utils/address.js';
import {
    extractCandidateAddressesFromParsedSolanaTransaction,
    extractSignerAddressesFromParsedSolanaTransaction,
    fetchParsedSolanaTransaction
} from './solanaWebhookHandler.js';

export type ResolveSolanaTrackedWalletsResult = {
    trackedWallets: Array<{ address: string }>;
    parsedTx: ParsedTransactionWithMeta | null;
    candidateAddresses: string[];
    reasonCode:
    | 'raw_candidates'
    | 'raw_signer_candidates'
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
    rawSignerCandidates?: string[];
    pendingTargetWallet?: string | null;
    preResolvedTrackedWallets?: Array<{ address: string }>;
}): Promise<ResolveSolanaTrackedWalletsResult> {
    const rawCandidates = Array.from(new Set(params.rawCandidates.map((address) => normalizeAddress(address)).filter(Boolean)));
    const rawSignerCandidates = Array.from(new Set((params.rawSignerCandidates || []).map((address) => normalizeAddress(address)).filter(Boolean)));
    const preResolvedTrackedWallets = params.preResolvedTrackedWallets || [];
    if (preResolvedTrackedWallets.length > 0) {
        if (rawSignerCandidates.length > 0) {
            const signerSet = new Set(rawSignerCandidates.map((address) => address.toLowerCase()));
            const signerMatched = preResolvedTrackedWallets.filter((wallet) => signerSet.has(normalizeAddress(wallet.address).toLowerCase()));
            if (signerMatched.length > 0) {
                return {
                    trackedWallets: signerMatched,
                    parsedTx: null,
                    candidateAddresses: rawSignerCandidates,
                    reasonCode: 'raw_signer_candidates'
                };
            }

            return {
                trackedWallets: [],
                parsedTx: null,
                candidateAddresses: rawSignerCandidates,
                reasonCode: 'no_tracked_wallets'
            };
        }
        // Safety-first: raw account candidates without signer evidence are not authoritative.
        // Continue to parsed-transaction signer resolution to avoid false target binding.
    }

    const rawTrackedWallets = await findTrackedWallets(params.chainId, rawCandidates);
    if (rawTrackedWallets.length > 0) {
        if (rawSignerCandidates.length > 0) {
            const signerSet = new Set(rawSignerCandidates.map((address) => address.toLowerCase()));
            const signerMatched = rawTrackedWallets.filter((wallet) => signerSet.has(normalizeAddress(wallet.address).toLowerCase()));
            if (signerMatched.length > 0) {
                return {
                    trackedWallets: signerMatched,
                    parsedTx: null,
                    candidateAddresses: rawSignerCandidates,
                    reasonCode: 'raw_signer_candidates'
                };
            }

            return {
                trackedWallets: [],
                parsedTx: null,
                candidateAddresses: rawSignerCandidates,
                reasonCode: 'no_tracked_wallets'
            };
        }
        // Safety-first: do not accept raw non-signer matches; require parsed signer binding below.
    }

    const parsedTx = await fetchParsedSolanaTransaction(params.txHash);
    if (!parsedTx) {
        return {
            trackedWallets: [],
            parsedTx: null,
            candidateAddresses: rawCandidates,
            reasonCode: 'parsed_tx_unavailable'
        };
    }

    const parsedCandidates = extractCandidateAddressesFromParsedSolanaTransaction(parsedTx);
    const parsedSignerCandidates = extractSignerAddressesFromParsedSolanaTransaction(parsedTx);
    if (parsedSignerCandidates.length === 0) {
        return {
            trackedWallets: [],
            parsedTx,
            candidateAddresses: parsedCandidates,
            reasonCode: 'no_tracked_wallets'
        };
    }

    const parsedTrackedWallets = await findTrackedWallets(params.chainId, parsedSignerCandidates);
    if (parsedTrackedWallets.length > 0) {
        return {
            trackedWallets: parsedTrackedWallets,
            parsedTx,
            candidateAddresses: parsedSignerCandidates,
            reasonCode: 'raw_signer_candidates'
        };
    }

    return {
        trackedWallets: [],
        parsedTx,
        candidateAddresses: parsedSignerCandidates,
        reasonCode: 'no_tracked_wallets'
    };
}
