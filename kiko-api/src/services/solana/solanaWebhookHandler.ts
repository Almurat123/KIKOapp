import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import { normalizeAddress } from '../../utils/address.js';
import { getSolanaConnection } from '../../config/solanaConfig.js';

export async function fetchParsedSolanaTransaction(txHash: string): Promise<ParsedTransactionWithMeta | null> {
    const strategies: Array<'fast' | 'cheap'> = ['fast', 'cheap'];

    for (const strategy of strategies) {
        try {
            const connection = getSolanaConnection(strategy, 'critical');
            const tx = await connection.getParsedTransaction(txHash, {
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed'
            });
            if (tx) return tx;
        } catch {
            // Try next endpoint strategy.
        }
    }

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
    const tx = params.parsedTx || await fetchParsedSolanaTransaction(params.txHash);
    if (!tx) {
        console.error(`[Webhook] Failed to fetch Solana tx details after trying all RPCs: ${params.txHash}`);
        return 0;
    }

    const { decodeSolanaSwap } = await import('../solanaDecoder.js');
    const { handleSwapDetected } = await import('../autoTradeService.js');

    const results = await Promise.allSettled(
        params.trackedWallets.map(async (walletRecord) => {
            const trackedTarget = walletRecord.address;
            const swap = await decodeSolanaSwap(tx, trackedTarget);
            if (!swap) return false;
            await handleSwapDetected(trackedTarget, swap, params.chainId);
            return true;
        })
    );

    return results.filter((result) => result.status === 'fulfilled' && result.value).length;
}
