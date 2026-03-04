import { emitCopytradeSummaryAudit } from './copytradeSummaryAudit.js';

type EntryDeviationSummaryParams = {
  userId: string;
  configId?: string | null;
  tokenAddress: string;
  targetWallet: string;
  chainId: number;
  executionMode: string;
  targetExecutionPrice: number;
  currentPrice: number;
  deviationBps: number;
  limitBps: number;
  thresholdSource: string;
  thresholdReasonCode: string;
  thresholdPolicy: string;
  action: 'entry_deviation_skip' | 'entry_deviation_pass';
};

function roundMaybe(value: number, digits: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function emitEntryDeviationSummary(params: EntryDeviationSummaryParams): void {
  emitCopytradeSummaryAudit('BUY_FLOW_SUMMARY', {
    action: params.action,
    userId: params.userId,
    configId: params.configId || null,
    tokenAddress: params.tokenAddress,
    targetWallet: params.targetWallet,
    chainId: params.chainId,
    executionMode: params.executionMode,
    targetExecutionPrice: roundMaybe(params.targetExecutionPrice, 10),
    currentPrice: roundMaybe(params.currentPrice, 10),
    deviationBps: roundMaybe(params.deviationBps, 2),
    limitBps: params.limitBps,
    thresholdSource: params.thresholdSource,
    thresholdReasonCode: params.thresholdReasonCode,
    thresholdPolicy: params.thresholdPolicy,
  });
}
