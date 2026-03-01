import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import { fetchSolanaTransactionDetails } from './solanaTxDetailsRpc.js';

export type SolanaTxDetailsResult =
  | { ok: true; tx: ParsedTransactionWithMeta; source: 'solana_tx_details_rpc' }
  | { ok: false; reasonCode: 'tx_details_unavailable' | 'rpc_failed'; error?: string };

export async function fetchSolanaTxDetails(txHash: string, chainId = 900): Promise<SolanaTxDetailsResult> {
    void chainId;
    const result = await fetchSolanaTransactionDetails(txHash);
    if (!result.ok) {
        return {
            ok: false,
            reasonCode: result.reasonCode,
            error: result.error,
        };
    }
    return {
        ok: true,
        tx: result.tx as ParsedTransactionWithMeta,
        source: 'solana_tx_details_rpc',
    };
}
