import type { CopytradeModePolicy } from '../../contracts/modePolicy.js';

export const normalPolicy: CopytradeModePolicy = {
  mode: 'normal',
  requireConfirmedTx: true,
  minSignalConfidence: 0.5,
  maxRetries: 3,
  retryDelayMs: 1000,
  allowAggressiveFallback: true,
  strictRiskChecks: true,
};
