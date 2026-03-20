import type { PositionExitReason } from './types.js';

export type ExitExecutionState =
  | 'EXIT_INTENT_CREATED'
  | 'EXIT_PRECHECK_READY'
  | 'EXIT_SUBMITTING'
  | 'EXIT_ACCEPTED'
  | 'EXIT_PENDING_FINALITY'
  | 'EXIT_CONFIRMED'
  | 'EXIT_RETRYABLE_UNRESOLVED'
  | 'EXIT_FAILED_TERMINAL'
  | 'EXIT_CLOSED_DUST';

export type ExitIntentLane = 'evm-exit' | 'solana-exit' | 'confirmation-reconcile';

export interface TargetSellEventPayload {
  chainId: number;
  targetWallet: string;
  tokenAddress: string;
  targetSellTxHash: string;
  targetSellRatioBps?: number | null;
  targetFullExitVerified?: boolean;
  targetRemainingBalanceRaw?: string | null;
  detectedAt?: Date;
  source: 'webhook' | 'monitor' | 'buy_confirmation';
  metadata?: Record<string, unknown>;
}

export interface PositionExitIntentPayload {
  positionId: string;
  userId: string;
  configId: string;
  chainId: number;
  tokenAddress: string;
  exitReason: PositionExitReason;
  sourceEventId?: string | null;
  targetSellTxHash?: string | null;
  desiredSellRaw?: string | null;
  intentVersion?: number;
  priority?: number;
  lane?: ExitIntentLane;
  notBefore?: Date | null;
  metadata?: Record<string, unknown>;
}

export function resolveExitIntentLane(chainId: number): ExitIntentLane {
  return chainId === 900 ? 'solana-exit' : 'evm-exit';
}

export function buildExitIntentIdentityKey(input: {
  positionId: string;
  exitReason: PositionExitReason;
  targetSellTxHash?: string | null;
  intentVersion?: number | null;
}): string {
  const positionId = String(input.positionId || '').trim();
  const txHash = String(input.targetSellTxHash || '').trim().toLowerCase();
  if (input.exitReason === 'mirror_sell' && txHash) {
    return `${positionId}:mirror_sell:${txHash}`;
  }
  const version = Math.max(1, Number(input.intentVersion || 1));
  return `${positionId}:${input.exitReason}:${version}`;
}

export function computeDesiredMirrorSellRaw(params: {
  trackedRemainingRaw: bigint;
  ratioBps: number;
}): bigint {
  const tracked = params.trackedRemainingRaw > 0n ? params.trackedRemainingRaw : 0n;
  const ratioBps = Number.isFinite(params.ratioBps)
    ? Math.max(0, Math.min(10_000, Math.floor(params.ratioBps)))
    : 0;
  if (tracked <= 0n || ratioBps <= 0) return 0n;
  if (ratioBps >= 10_000) return tracked;
  const raw = (tracked * BigInt(ratioBps)) / 10_000n;
  return raw > 0n ? raw : 1n;
}

export function clampDesiredExitRaw(params: {
  desiredSellRaw: bigint;
  onChainVisibleBalanceRaw: bigint;
  trackedRemainingRaw: bigint;
}): bigint {
  const desired = params.desiredSellRaw > 0n ? params.desiredSellRaw : 0n;
  const onChain = params.onChainVisibleBalanceRaw > 0n ? params.onChainVisibleBalanceRaw : 0n;
  const tracked = params.trackedRemainingRaw > 0n ? params.trackedRemainingRaw : 0n;
  if (desired <= 0n || onChain <= 0n || tracked <= 0n) return 0n;
  let next = desired;
  if (next > onChain) next = onChain;
  if (next > tracked) next = tracked;
  return next;
}
