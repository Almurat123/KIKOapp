import { resolveTxFinalState } from '../order-runtime/adjudicator/finalState.js';
import { waitForTransactionConfirmation } from '../swap/confirmationCoordinator.js';

export async function waitForPreheatConfirmation(params: {
    chainId: number;
    txHash: string;
    timeoutMs: number;
    pollMs: number;
}): Promise<boolean> {
    const initialState = resolveTxFinalState({
        chainId: params.chainId,
        txHash: params.txHash
    });
    if (initialState.success) return true;
    if (initialState.failed) return false;

    const outcome = await waitForTransactionConfirmation({
        txHash: params.txHash,
        chainId: params.chainId,
        dexName: 'copytrade_preheat',
        timeoutMs: params.timeoutMs,
        pollMs: params.pollMs
    }).catch(() => null);

    return outcome?.kind === 'confirmed_success';
}
