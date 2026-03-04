import type { CopytradeModePolicy } from '../../contracts/modePolicy.js';

export const safetyPolicy: CopytradeModePolicy = {
  mode: 'safety',
  requireConfirmedTx: true,
  minSignalConfidence: 0.75,
  maxRetries: 1,
  retryDelayMs: 2500,
  allowAggressiveFallback: false,
  strictRiskChecks: true,
};
