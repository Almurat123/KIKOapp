import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import { normalizeAddress } from '../../utils/address.js';
import { processResolvedSolanaWebhookTx } from './solanaWebhookProcessor.js';

export async function fetchParsedSolanaTransaction(txHash: string): Promise<ParsedTransactionWithMeta | null> {
    return null;
}

export function extractCandidateAddressesFromParsedSolanaTransaction(
    tx: ParsedTransactionWithMeta | null
): string[] {
    if (!tx?.transaction?.message) return [];

    const message: any = tx.transaction.message as any;
    const staticAccountKeys = Array.isArray(message.staticAccountKeys) ? message.staticAccountKeys : [];
    const accountKeys = Array.isArray(message.accountKeys) ? message.accountKeys : [];
    const loadedWritable = Array.isArray(tx.meta?.loadedAddresses?.writable) ? tx.meta?.loadedAddresses?.writable : [];
    const loadedReadonly = Array.isArray(tx.meta?.loadedAddresses?.readonly) ? tx.meta?.loadedAddresses?.readonly : [];

    const candidates = [...staticAccountKeys, ...accountKeys, ...loadedWritable, ...loadedReadonly]
        .map((key: any) => {
            if (typeof key === 'string') return normalizeAddress(key);
            if (key?.pubkey?.toBase58) return normalizeAddress(key.pubkey.toBase58());
            if (key?.toBase58) return normalizeAddress(key.toBase58());
            return normalizeAddress(String(key || ''));
        })
        .filter(Boolean);

    return Array.from(new Set(candidates));
}

export async function processSolanaWebhookTx(params: {
    txHash: string;
    trackedWallets: Array<{ address: string }>;
    parsedTx?: ParsedTransactionWithMeta | null;
    chainId: number;
}): Promise<number> {
    return processResolvedSolanaWebhookTx(params);
}
