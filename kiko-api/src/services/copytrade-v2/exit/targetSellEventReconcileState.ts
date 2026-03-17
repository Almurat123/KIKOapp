const TARGET_SELL_EVENT_RETRY_DELAYS_MS = String(
  process.env.COPYTRADE_TARGET_SELL_EVENT_RETRY_DELAYS_MS || '60000,300000,900000',
)
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0)
  .map((value) => Math.floor(value));

export type TargetSellEventConfigReconcileStatus =
  | 'pending'
  | 'retry_wait'
  | 'resolved'
  | 'exhausted';

export interface TargetSellEventConfigReconcileState {
  status: TargetSellEventConfigReconcileStatus;
  attemptCount: number;
  nextRetryAtIso: string | null;
  lastAttemptAtIso: string | null;
  lastBlockedReason: string | null;
  lastReasonCode: string | null;
  resolvedAtIso: string | null;
  exhaustedAtIso: string | null;
}

export interface TargetSellEventReconcileMetadata extends Record<string, unknown> {
  reconcileByConfig?: Record<string, TargetSellEventConfigReconcileState>;
}

export interface TargetSellEventRetryResult {
  attemptCount: number;
  exhausted: boolean;
  nextRetryAt: Date | null;
  shouldAudit: boolean;
}

function parseDate(value: string | null | undefined): Date | null {
  const parsed = value ? new Date(value) : null;
  return parsed && Number.isFinite(parsed.getTime()) ? parsed : null;
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function normalizeState(input: Partial<TargetSellEventConfigReconcileState> | null | undefined): TargetSellEventConfigReconcileState {
  return {
    status: input?.status || 'pending',
    attemptCount: Number.isFinite(Number(input?.attemptCount))
      ? Math.max(0, Math.floor(Number(input?.attemptCount)))
      : 0,
    nextRetryAtIso: typeof input?.nextRetryAtIso === 'string' ? input.nextRetryAtIso : null,
    lastAttemptAtIso: typeof input?.lastAttemptAtIso === 'string' ? input.lastAttemptAtIso : null,
    lastBlockedReason: typeof input?.lastBlockedReason === 'string' ? input.lastBlockedReason : null,
    lastReasonCode: typeof input?.lastReasonCode === 'string' ? input.lastReasonCode : null,
    resolvedAtIso: typeof input?.resolvedAtIso === 'string' ? input.resolvedAtIso : null,
    exhaustedAtIso: typeof input?.exhaustedAtIso === 'string' ? input.exhaustedAtIso : null,
  };
}

export function cloneTargetSellEventReconcileMetadata(
  input: Record<string, unknown> | null | undefined,
): TargetSellEventReconcileMetadata {
  const metadata: TargetSellEventReconcileMetadata = input && typeof input === 'object'
    ? { ...input }
    : {};
  const reconcileByConfig = metadata.reconcileByConfig;
  if (!reconcileByConfig || typeof reconcileByConfig !== 'object' || Array.isArray(reconcileByConfig)) {
    metadata.reconcileByConfig = {};
    return metadata;
  }

  const cloned: Record<string, TargetSellEventConfigReconcileState> = {};
  for (const [configId, state] of Object.entries(reconcileByConfig)) {
    cloned[configId] = normalizeState(state as Partial<TargetSellEventConfigReconcileState>);
  }
  metadata.reconcileByConfig = cloned;
  return metadata;
}

export function getTargetSellEventConfigReconcileState(
  metadata: TargetSellEventReconcileMetadata,
  configId: string,
): TargetSellEventConfigReconcileState {
  const states = metadata.reconcileByConfig || {};
  return normalizeState(states[configId]);
}

function setTargetSellEventConfigReconcileState(
  metadata: TargetSellEventReconcileMetadata,
  configId: string,
  state: TargetSellEventConfigReconcileState,
): void {
  const states = metadata.reconcileByConfig || {};
  states[configId] = state;
  metadata.reconcileByConfig = states;
}

export function isTargetSellEventConfigDue(
  metadata: TargetSellEventReconcileMetadata,
  configId: string,
  now = Date.now(),
): boolean {
  const state = getTargetSellEventConfigReconcileState(metadata, configId);
  if (state.status === 'resolved' || state.status === 'exhausted') return false;
  const nextRetryAt = parseDate(state.nextRetryAtIso);
  return !nextRetryAt || nextRetryAt.getTime() <= now;
}

export function markTargetSellEventConfigResolved(params: {
  metadata: TargetSellEventReconcileMetadata;
  configId: string;
  blockedReason: string;
  reasonCode: string;
  now?: Date;
}): void {
  const now = params.now || new Date();
  const current = getTargetSellEventConfigReconcileState(params.metadata, params.configId);
  setTargetSellEventConfigReconcileState(params.metadata, params.configId, {
    ...current,
    status: 'resolved',
    nextRetryAtIso: null,
    lastAttemptAtIso: toIso(now),
    lastBlockedReason: params.blockedReason,
    lastReasonCode: params.reasonCode,
    resolvedAtIso: toIso(now),
    exhaustedAtIso: null,
  });
}

export function markTargetSellEventConfigRetry(params: {
  metadata: TargetSellEventReconcileMetadata;
  configId: string;
  blockedReason: string;
  reasonCode: string;
  now?: Date;
}): TargetSellEventRetryResult {
  const now = params.now || new Date();
  const current = getTargetSellEventConfigReconcileState(params.metadata, params.configId);
  const attemptCount = current.attemptCount + 1;
  const maxAttempts = TARGET_SELL_EVENT_RETRY_DELAYS_MS.length + 1;
  const exhausted = attemptCount >= maxAttempts;

  if (exhausted) {
    setTargetSellEventConfigReconcileState(params.metadata, params.configId, {
      ...current,
      status: 'exhausted',
      attemptCount,
      nextRetryAtIso: null,
      lastAttemptAtIso: toIso(now),
      lastBlockedReason: params.blockedReason,
      lastReasonCode: params.reasonCode,
      resolvedAtIso: current.resolvedAtIso,
      exhaustedAtIso: toIso(now),
    });
    return {
      attemptCount,
      exhausted: true,
      nextRetryAt: null,
      shouldAudit: true,
    };
  }

  const delayMs = TARGET_SELL_EVENT_RETRY_DELAYS_MS[Math.max(0, attemptCount - 1)] || 60_000;
  const nextRetryAt = new Date(now.getTime() + delayMs);
  setTargetSellEventConfigReconcileState(params.metadata, params.configId, {
    ...current,
    status: 'retry_wait',
    attemptCount,
    nextRetryAtIso: toIso(nextRetryAt),
    lastAttemptAtIso: toIso(now),
    lastBlockedReason: params.blockedReason,
    lastReasonCode: params.reasonCode,
    resolvedAtIso: current.resolvedAtIso,
    exhaustedAtIso: null,
  });
  return {
    attemptCount,
    exhausted: false,
    nextRetryAt,
    shouldAudit: attemptCount === 1,
  };
}
