import type { CopytradeModePolicy } from '../../contracts/modePolicy.js';

export const turboPolicy: CopytradeModePolicy = {
  mode: 'turbo',
  requireConfirmedTx: false,
  minSignalConfidence: 0.2,
  maxRetries: 2,
  retryDelayMs: 250,
  allowAggressiveFallback: true,
  strictRiskChecks: false,
};
