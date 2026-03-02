import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import { decodeSolanaSwap } from '../solanaDecoder.js';
import { enqueueCopyTradeTask } from '../copyTradeQueue.js';
import { fetchSolanaTxDetails } from './txDetailsFetcher.js';

export async function processResolvedSolanaWebhookTx(params: {
    txHash: string;
    trackedWallets: Array<{ address: string }>;
    parsedTx?: ParsedTransactionWithMeta | null;
    chainId: number;
    detectedAt?: number;
}): Promise<number> {
    let tx = params.parsedTx || null;

    if (!tx) {
        const fetched = await fetchSolanaTxDetails(params.txHash, params.chainId);
        if (!fetched.ok) {
            const suffix = fetched.error ? ` (${fetched.error})` : '';
            throw new Error(`sol_tx_details_${fetched.reasonCode}${suffix}`);
        }
        tx = fetched.tx;
    }

    const results = await Promise.allSettled(
        params.trackedWallets.map(async (walletRecord) => {
            const swap = await decodeSolanaSwap(tx!, walletRecord.address);
            if (!swap) return false;
            enqueueCopyTradeTask(walletRecord.address, swap, params.chainId, {
                detectedAt: params.detectedAt || Date.now()
            });
            return true;
        })
    );

    return results.filter((result) => result.status === 'fulfilled' && result.value).length;
}
