import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import { getTransactionByHash } from '../rpcManager.js';

export type SolanaTxDetailsResult =
  | { ok: true; tx: ParsedTransactionWithMeta; source: 'rpc_manager_confirmed' }
  | { ok: false; reasonCode: 'tx_details_unavailable' | 'rpc_failed'; error?: string };

export async function fetchSolanaTxDetails(txHash: string, chainId = 900): Promise<SolanaTxDetailsResult> {
    try {
        const tx = await getTransactionByHash(chainId, txHash);
        if (!tx) {
            return { ok: false, reasonCode: 'tx_details_unavailable' };
        }
        return {
            ok: true,
            tx: tx as ParsedTransactionWithMeta,
            source: 'rpc_manager_confirmed',
        };
    } catch (error) {
        return {
            ok: false,
            reasonCode: 'rpc_failed',
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
