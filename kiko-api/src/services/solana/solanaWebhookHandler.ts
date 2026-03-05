import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import { normalizeAddress } from '../../utils/address.js';
import { processResolvedSolanaWebhookTx } from './solanaWebhookProcessor.js';
import { fetchSolanaTxDetails } from './txDetailsFetcher.js';

export async function fetchParsedSolanaTransaction(txHash: string): Promise<ParsedTransactionWithMeta | null> {
    const result = await fetchSolanaTxDetails(txHash, 900);
    return result.ok ? result.tx : null;
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
        .map((key: any) => extractAddressFromSolanaKey(key))
        .filter(Boolean);

    return Array.from(new Set(candidates));
}

export function extractSignerAddressesFromParsedSolanaTransaction(
    tx: ParsedTransactionWithMeta | null
): string[] {
    if (!tx?.transaction?.message) return [];

    const message: any = tx.transaction.message as any;
    const staticAccountKeys = Array.isArray(message.staticAccountKeys) ? message.staticAccountKeys : [];
    const accountKeys = Array.isArray(message.accountKeys) ? message.accountKeys : [];
    let signers = accountKeys
        .map((key: any) => {
            const isSigner = key?.signer === true || key?.isSigner === true;
            if (!isSigner) return '';
            return extractAddressFromSolanaKey(key);
        })
        .filter(Boolean);

    // Fallback: for some parsed responses signer flags are absent.
    // Use Solana message header semantics where the first N keys are signers.
    if (signers.length === 0) {
        const requiredSignatures = Number(message?.header?.numRequiredSignatures || 0);
        if (requiredSignatures > 0) {
            const signerKeyPool = staticAccountKeys.length > 0 ? staticAccountKeys : accountKeys;
            signers = signerKeyPool
                .slice(0, requiredSignatures)
                .map((key: any) => extractAddressFromSolanaKey(key))
                .filter(Boolean);
        }
    }
    return Array.from(new Set(signers));
}

function extractAddressFromSolanaKey(key: any): string {
    if (typeof key === 'string') return normalizeAddress(key);
    if (!key || typeof key !== 'object') return normalizeAddress(String(key || ''));
    if (typeof key.pubkey === 'string') return normalizeAddress(key.pubkey);
    if (key?.pubkey?.toBase58) return normalizeAddress(key.pubkey.toBase58());
    if (key?.pubkey?.toString) return normalizeAddress(key.pubkey.toString());
    if (key?.toBase58) return normalizeAddress(key.toBase58());
    if (key?.toString) return normalizeAddress(key.toString());
    return normalizeAddress(String(key || ''));
}

export async function processSolanaWebhookTx(params: {
    txHash: string;
    trackedWallets: Array<{ address: string }>;
    parsedTx?: ParsedTransactionWithMeta | null;
    chainId: number;
    detectedAt?: number;
}): Promise<number> {
    return processResolvedSolanaWebhookTx(params);
}
