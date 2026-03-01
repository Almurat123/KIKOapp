export type SolanaConfirmationKind = 'confirmed_success' | 'confirmed_failed' | 'timeout' | 'uncertain';

export interface SolanaConfirmationOutcome {
    success: boolean;
    kind: SolanaConfirmationKind;
    reason?: string;
    visible?: boolean;
    slot?: number | null;
}
