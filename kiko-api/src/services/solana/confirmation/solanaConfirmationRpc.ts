import { getSolanaConnection } from '../../../config/solanaConfig.js';

export interface SolanaSignatureObservation {
    found: boolean;
    confirmed: boolean;
    finalized: boolean;
    failed: boolean;
    reason?: string;
    slot?: number | null;
}

export async function getSolanaSignatureObservation(signature: string): Promise<SolanaSignatureObservation> {
    const connection = getSolanaConnection();
    const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
    const value = status?.value;
    if (!value) {
        return {
            found: false,
            confirmed: false,
            finalized: false,
            failed: false,
            slot: null
        };
    }

    const confirmationStatus = value.confirmationStatus || null;
    const failed = Boolean(value.err);
    const reason = failed
        ? (typeof value.err === 'string' ? value.err : JSON.stringify(value.err))
        : undefined;

    return {
        found: true,
        confirmed: confirmationStatus === 'confirmed' || confirmationStatus === 'finalized',
        finalized: confirmationStatus === 'finalized',
        failed,
        reason,
        slot: value.slot ?? null
    };
}
