export type CopytradeMode = 'turbo' | 'normal' | 'safety';

export interface CopytradeModePolicy {
  mode: CopytradeMode;
  requireConfirmedTx: boolean;
  minSignalConfidence: number;
  maxRetries: number;
  retryDelayMs: number;
  allowAggressiveFallback: boolean;
  strictRiskChecks: boolean;
}

export interface CopytradeModeResolver {
  resolve(mode: CopytradeMode): CopytradeModePolicy;
}
