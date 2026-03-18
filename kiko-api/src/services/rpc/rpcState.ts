import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import type { RpcExecutionLane as EndpointExecutionLane } from '../../config/apiEndpoints.js';
import type { TxLifecycleResult } from '../txLifecycle.js';
import type { RpcImportance, RpcLane } from './types.js';
import {
  reportReceiptSeen,
  reportRpcUncertain,
  reportSendAccepted,
  reportTxByHashSeen
} from '../order-runtime/adjudicator/service.js';
import { resolveTxFinalState, toLifecycleResultFromFinalState } from '../order-runtime/adjudicator/finalState.js';
import { estimateUpcomingRpcBurstSize } from './prediction.js';
import { reserveProjectedEndpointUsage, getProjectedEndpointUsage } from './reservation.js';
import { sortRpcEndpointsByScore } from './score.js';
import type { RpcEndpointConfig } from '../../config/apiEndpoints.js';

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_TIME = 30000;
const RPC_METHOD_COOLDOWN_BASE_MS = Math.max(0, Number(process.env.RPC_METHOD_COOLDOWN_BASE_MS || '250'));
const RPC_METHOD_COOLDOWN_MAX_MS = Math.max(RPC_METHOD_COOLDOWN_BASE_MS, Number(process.env.RPC_METHOD_COOLDOWN_MAX_MS || '4000'));
const RPC_METHOD_COOLDOWN_ATTEMPT_CAP = Math.max(1, Number(process.env.RPC_METHOD_COOLDOWN_ATTEMPT_CAP || '1'));
const ENDPOINT_METHOD_TIMEOUT_WINDOW_MS = Math.max(5_000, Number(process.env.RPC_ENDPOINT_METHOD_TIMEOUT_WINDOW_MS || '60000'));
const ENDPOINT_METHOD_TIMEOUT_MIN_ATTEMPTS = Math.max(3, Number(process.env.RPC_ENDPOINT_METHOD_TIMEOUT_MIN_ATTEMPTS || '8'));
const ENDPOINT_METHOD_TIMEOUT_RATE_THRESHOLD = Math.min(1, Math.max(0, Number(process.env.RPC_ENDPOINT_METHOD_TIMEOUT_RATE_THRESHOLD || '0.3')));
const ENDPOINT_METHOD_TIMEOUT_COOLDOWN_MS = Math.max(1_000, Number(process.env.RPC_ENDPOINT_METHOD_TIMEOUT_COOLDOWN_MS || '60000'));
const TX_LIFECYCLE_STATE_TTL_MS = Math.max(5_000, Number(process.env.TX_LIFECYCLE_STATE_TTL_MS || '180000'));
const TX_LIFECYCLE_STATE_MAX = Math.max(256, Number(process.env.TX_LIFECYCLE_STATE_MAX || '20000'));
const RPC_CHAIN_DEGRADED_TTL_MS = Math.max(500, Number(process.env.RPC_CHAIN_DEGRADED_TTL_MS || '4000'));
const RPC_ALL_FAILED_LOG_COOLDOWN_MS = Number(process.env.RPC_ALL_FAILED_LOG_COOLDOWN_MS || 5000);
const RPC_EXPLAIN_ENABLED = (process.env.RPC_EXPLAIN_ENABLED || 'true').toLowerCase() === 'true';

export type RpcClass = 'critical_tx' | 'best_effort_read';

export interface EndpointHealth {
  url: string;
  consecutiveFailures: number;
  lastFailureTime: number;
  circuitOpen: boolean;
  avgResponseTime: number;
  successCount: number;
  totalAttempts: number;
  lastBenchmarkTime?: number;
}

export interface EndpointUsage {
  url: string;
  inFlight: number;
  lastSecondStart: number;
  secondCount: number;
  lastMinuteStart: number;
  minuteCount: number;
  lastUsedAt: number;
}

export interface RpcMethodUsage {
  chainId: number;
  executionLane: EndpointExecutionLane;
  method: string;
  importance: RpcImportance;
  rpcClass: RpcClass;
  path: string;
  requests: number;
  endpointAttempts: number;
  successes: number;
  endpointFailures: number;
  allFailed: number;
  timeoutErrors: number;
  latencyMsTotal: number;
  lastLatencyMs: number;
  updatedAt: number;
}

export interface RpcMethodUsageSnapshotRow {
  chainId: number;
  method: string;
  importance: RpcImportance;
  rpcClass: RpcClass;
  path: string;
  requests: number;
  endpointAttempts: number;
  successes: number;
  endpointFailures: number;
  allFailed: number;
  timeoutErrors: number;
  latencyMsTotal: number;
  lastLatencyMs: number;
  updatedAt: number;
}

export interface RpcUsageSnapshot {
  timestamp: number;
  methods: Record<string, RpcMethodUsageSnapshotRow>;
  inflightPools: Record<RpcClass, number>;
  endpoints: Array<{
    url: string;
    inFlight: number;
    secondCount: number;
    minuteCount: number;
    lastUsedAt: number;
  }>;
}

type TxObservedStatus = TxLifecycleResult['status'] | 'send_failed';

export interface TxLifecycleSnapshot {
  chainId: number;
  txHash: string;
  status: TxObservedStatus;
  updatedAt?: number;
  firstSeenAt?: number;
  confirmedAt?: number;
  attempts?: number;
  lastRpcError?: string;
  source?: string;
}

interface MethodBackoffState {
  failures: number;
  cooldownUntil: number;
}

interface EndpointMethodTimeoutHealth {
  windowStart: number;
  attempts: number;
  timeouts: number;
  cooldownUntil: number;
}

const endpointHealth = new Map<string, EndpointHealth>();
const endpointUsage = new Map<string, EndpointUsage>();
const methodBackoff = new Map<string, MethodBackoffState>();
const rpcMethodUsage = new Map<string, RpcMethodUsage>();
const endpointMethodTimeoutHealth = new Map<string, EndpointMethodTimeoutHealth>();
const txLifecycleStateCache = new Map<string, TxLifecycleSnapshot>();
const rpcChainDegradedState = new Map<number, { until: number; updatedAt: number; lastError?: string; method?: string }>();
const rpcPoolInflight: Record<RpcClass, number> = {
  critical_tx: 0,
  best_effort_read: 0
};
const allRpcFailedLogGate = new Map<string, number>();

export function maskEndpoint(url: string): string {
  return String(url || '').replace(/[a-zA-Z0-9]{32,}/g, '***');
}

export function shouldLogAllRpcFailed(key: string): boolean {
  const now = Date.now();
  const last = allRpcFailedLogGate.get(key) || 0;
  if (now - last < RPC_ALL_FAILED_LOG_COOLDOWN_MS) return false;
  allRpcFailedLogGate.set(key, now);
  return true;
}

export function forceOpenEndpointCircuit(url: string, cooldownMs: number): void {
  const health = getOrCreateHealth(url);
  health.circuitOpen = true;
  health.lastFailureTime = Date.now() - Math.max(0, CIRCUIT_BREAKER_RESET_TIME - Math.max(0, cooldownMs));
  health.consecutiveFailures = Math.max(health.consecutiveFailures, CIRCUIT_BREAKER_THRESHOLD);
}

function getOrCreateHealth(url: string): EndpointHealth {
  if (!endpointHealth.has(url)) {
    endpointHealth.set(url, {
      url,
      consecutiveFailures: 0,
      lastFailureTime: 0,
      circuitOpen: false,
      avgResponseTime: 0,
      successCount: 0,
      totalAttempts: 0
    });
  }
  return endpointHealth.get(url)!;
}

export function isCircuitOpen(url: string): boolean {
  const health = getOrCreateHealth(url);
  if (!health.circuitOpen) return false;
  if (Date.now() - health.lastFailureTime > CIRCUIT_BREAKER_RESET_TIME) {
    health.circuitOpen = false;
    health.consecutiveFailures = 0;
    logger.debug(LogCode.API_FETCH_SUCCESS, 'RPC circuit breaker reset', { endpoint: maskEndpoint(url) });
    return false;
  }
  return true;
}

export function recordAttempt(url: string): void {
  const health = getOrCreateHealth(url);
  health.totalAttempts++;
}

export function recordSuccess(url: string, responseTime: number): void {
  const health = getOrCreateHealth(url);
  health.successCount++;
  health.consecutiveFailures = 0;
  health.circuitOpen = false;
  if (health.avgResponseTime === 0) {
    health.avgResponseTime = responseTime;
  } else {
    health.avgResponseTime = health.avgResponseTime * 0.7 + responseTime * 0.3;
  }
}

export function recordFailure(url: string): void {
  const health = getOrCreateHealth(url);
  health.consecutiveFailures++;
  health.lastFailureTime = Date.now();
  if (health.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    health.circuitOpen = true;
    logger.aggregate(LogCode.API_FETCH_FAILED, 'RPC circuit breaker opened', {
      endpoint: maskEndpoint(url),
      failures: health.consecutiveFailures
    });
  }
}

function getOrCreateUsage(url: string): EndpointUsage {
  if (!endpointUsage.has(url)) {
    endpointUsage.set(url, {
      url,
      inFlight: 0,
      lastSecondStart: Date.now(),
      secondCount: 0,
      lastMinuteStart: Date.now(),
      minuteCount: 0,
      lastUsedAt: 0
    });
  }
  return endpointUsage.get(url)!;
}

export function recordUsageStart(url: string): void {
  const usage = getOrCreateUsage(url);
  const now = Date.now();
  if (now - usage.lastSecondStart >= 1000) {
    usage.lastSecondStart = now;
    usage.secondCount = 0;
  }
  if (now - usage.lastMinuteStart >= 60000) {
    usage.lastMinuteStart = now;
    usage.minuteCount = 0;
  }
  usage.secondCount += 1;
  usage.minuteCount += 1;
  usage.inFlight += 1;
  usage.lastUsedAt = now;
}

export function recordUsageEnd(url: string): void {
  const usage = getOrCreateUsage(url);
  usage.inFlight = Math.max(0, usage.inFlight - 1);
}

export function checkAndReserveCapacity(endpoint: RpcEndpointConfig, importance: RpcImportance): { ok: boolean; reason?: string } {
  const limits = endpoint.limits;
  if (!limits) return { ok: true };
  const usage = getOrCreateUsage(endpoint.url);
  const now = Date.now();
  const criticalPremiumBypass = importance === 'critical' && endpoint.type === 'premium';

  if (now - usage.lastSecondStart >= 1000) {
    usage.lastSecondStart = now;
    usage.secondCount = 0;
  }
  if (now - usage.lastMinuteStart >= 60000) {
    usage.lastMinuteStart = now;
    usage.minuteCount = 0;
  }

  if (limits.maxInFlight && usage.inFlight >= limits.maxInFlight) {
    if (!criticalPremiumBypass || usage.inFlight >= (limits.maxInFlight + 2)) {
      return { ok: false, reason: 'maxInFlight' };
    }
  }
  if (limits.rps && usage.secondCount >= limits.rps) {
    if (!criticalPremiumBypass) {
      return { ok: false, reason: 'rps' };
    }
  }
  if (limits.rpm && usage.minuteCount >= limits.rpm) {
    if (!criticalPremiumBypass) {
      return { ok: false, reason: 'rpm' };
    }
  }

  usage.secondCount += 1;
  usage.minuteCount += 1;
  usage.inFlight += 1;
  usage.lastUsedAt = now;
  return { ok: true };
}

export function checkEndpointCapacity(endpoint: RpcEndpointConfig, importance: RpcImportance): { ok: boolean; reason?: string } {
  const limits = endpoint.limits;
  if (!limits) return { ok: true };
  const usage = getOrCreateUsage(endpoint.url);
  const now = Date.now();
  const criticalPremiumBypass = importance === 'critical' && endpoint.type === 'premium';

  if (now - usage.lastSecondStart >= 1000) {
    usage.lastSecondStart = now;
    usage.secondCount = 0;
  }
  if (now - usage.lastMinuteStart >= 60000) {
    usage.lastMinuteStart = now;
    usage.minuteCount = 0;
  }

  if (limits.maxInFlight && usage.inFlight >= limits.maxInFlight) {
    if (!criticalPremiumBypass || usage.inFlight >= (limits.maxInFlight + 2)) {
      return { ok: false, reason: 'maxInFlight' };
    }
  }
  if (limits.rps && usage.secondCount >= limits.rps) {
    if (criticalPremiumBypass) {
      return { ok: true };
    }
    return { ok: false, reason: 'rps' };
  }
  if (limits.rpm && usage.minuteCount >= limits.rpm) {
    if (criticalPremiumBypass) {
      return { ok: true };
    }
    return { ok: false, reason: 'rpm' };
  }
  return { ok: true };
}

function rpcMethodUsageKey(chainId: number, executionLane: EndpointExecutionLane, method: string, importance: RpcImportance, rpcClass: RpcClass, path: string): string {
  return `${chainId}:${executionLane}:${method}:${importance}:${rpcClass}:${path}`;
}

function getOrCreateRpcMethodUsage(
  chainId: number,
  executionLane: EndpointExecutionLane,
  method: string,
  importance: RpcImportance,
  rpcClass: RpcClass,
  path: string
): RpcMethodUsage {
  const key = rpcMethodUsageKey(chainId, executionLane, method, importance, rpcClass, path);
  let row = rpcMethodUsage.get(key);
  if (!row) {
    row = {
      chainId,
      executionLane,
      method,
      importance,
      rpcClass,
      path,
      requests: 0,
      endpointAttempts: 0,
      successes: 0,
      endpointFailures: 0,
      allFailed: 0,
      timeoutErrors: 0,
      latencyMsTotal: 0,
      lastLatencyMs: 0,
      updatedAt: Date.now()
    };
    rpcMethodUsage.set(key, row);
  }
  return row;
}

export function markRpcMethodUsage(
  chainId: number,
  executionLane: EndpointExecutionLane,
  method: string,
  importance: RpcImportance,
  rpcClass: RpcClass,
  path: string,
  field: 'requests' | 'endpointAttempts' | 'successes' | 'endpointFailures' | 'allFailed' | 'timeoutErrors'
): void {
  const row = getOrCreateRpcMethodUsage(chainId, executionLane, method, importance, rpcClass, path);
  row[field] += 1;
  row.updatedAt = Date.now();
}

export function markRpcMethodLatency(
  chainId: number,
  executionLane: EndpointExecutionLane,
  method: string,
  importance: RpcImportance,
  rpcClass: RpcClass,
  path: string,
  latencyMs: number
): void {
  const row = getOrCreateRpcMethodUsage(chainId, executionLane, method, importance, rpcClass, path);
  const bounded = Math.max(0, Math.floor(latencyMs));
  row.latencyMsTotal += bounded;
  row.lastLatencyMs = bounded;
  row.updatedAt = Date.now();
}

function endpointMethodHealthKey(endpointUrl: string, method: string): string {
  return `${endpointUrl}::${method}`;
}

function getEndpointMethodTimeoutHealth(key: string): EndpointMethodTimeoutHealth {
  const now = Date.now();
  let state = endpointMethodTimeoutHealth.get(key);
  if (!state) {
    state = { windowStart: now, attempts: 0, timeouts: 0, cooldownUntil: 0 };
    endpointMethodTimeoutHealth.set(key, state);
    return state;
  }
  if (now - state.windowStart >= ENDPOINT_METHOD_TIMEOUT_WINDOW_MS) {
    state.windowStart = now;
    state.attempts = 0;
    state.timeouts = 0;
  }
  if (state.cooldownUntil > 0 && now >= state.cooldownUntil) {
    state.cooldownUntil = 0;
  }
  return state;
}

export function isEndpointMethodTimeoutCooling(key: string): boolean {
  const state = getEndpointMethodTimeoutHealth(key);
  return state.cooldownUntil > Date.now();
}

export function markEndpointMethodAttempt(key: string): void {
  const state = getEndpointMethodTimeoutHealth(key);
  state.attempts += 1;
}

function maybeOpenEndpointMethodTimeoutCooldown(key: string): void {
  const state = getEndpointMethodTimeoutHealth(key);
  if (state.attempts < ENDPOINT_METHOD_TIMEOUT_MIN_ATTEMPTS) return;
  const timeoutRate = state.timeouts / Math.max(1, state.attempts);
  if (timeoutRate < ENDPOINT_METHOD_TIMEOUT_RATE_THRESHOLD) return;
  state.cooldownUntil = Date.now() + ENDPOINT_METHOD_TIMEOUT_COOLDOWN_MS;
  state.windowStart = Date.now();
  state.attempts = 0;
  state.timeouts = 0;
}

export function markEndpointMethodTimeout(key: string): void {
  const state = getEndpointMethodTimeoutHealth(key);
  state.timeouts += 1;
  maybeOpenEndpointMethodTimeoutCooldown(key);
}

export function getMethodBackoffState(backoffKey: string): MethodBackoffState | null {
  const state = methodBackoff.get(backoffKey);
  if (!state) return null;
  if (Date.now() > state.cooldownUntil) {
    methodBackoff.delete(backoffKey);
    return null;
  }
  return state;
}

export function markMethodSuccess(backoffKey: string): void {
  methodBackoff.delete(backoffKey);
}

export function markMethodFailure(backoffKey: string): MethodBackoffState {
  const current = methodBackoff.get(backoffKey);
  const failures = Math.min(8, (current?.failures || 0) + 1);
  const cooldownMs = Math.min(RPC_METHOD_COOLDOWN_MAX_MS, RPC_METHOD_COOLDOWN_BASE_MS * (2 ** (failures - 1)));
  const next: MethodBackoffState = {
    failures,
    cooldownUntil: Date.now() + cooldownMs
  };
  methodBackoff.set(backoffKey, next);
  return next;
}

function pruneTxLifecycleStateCache(): void {
  if (txLifecycleStateCache.size < TX_LIFECYCLE_STATE_MAX) return;
  const now = Date.now();
  for (const [key, row] of txLifecycleStateCache.entries()) {
    const updatedAt = row.updatedAt || 0;
    if (now - updatedAt > TX_LIFECYCLE_STATE_TTL_MS) {
      txLifecycleStateCache.delete(key);
    }
  }
  if (txLifecycleStateCache.size <= TX_LIFECYCLE_STATE_MAX) return;
  const drop = Math.max(1, Math.floor(TX_LIFECYCLE_STATE_MAX * 0.2));
  const oldest = Array.from(txLifecycleStateCache.entries())
    .sort((a, b) => (a[1].updatedAt || 0) - (b[1].updatedAt || 0))
    .slice(0, drop);
  for (const [key] of oldest) txLifecycleStateCache.delete(key);
}

function txLifecycleKey(chainId: number, txHash: string): string {
  return `${chainId}:${String(txHash || '').toLowerCase()}`;
}

export function recordTxLifecycleState(snapshot: TxLifecycleSnapshot): void {
  if (!snapshot?.chainId || !snapshot?.txHash) return;
  pruneTxLifecycleStateCache();
  const key = txLifecycleKey(snapshot.chainId, snapshot.txHash);
  const prev = txLifecycleStateCache.get(key);
  txLifecycleStateCache.set(key, {
    ...(prev || {}),
    ...snapshot,
    txHash: String(snapshot.txHash).toLowerCase(),
    updatedAt: Date.now()
  });
  if (snapshot.status === 'confirmed_success' || snapshot.status === 'confirmed_failed') {
    reportReceiptSeen({
      chainId: snapshot.chainId,
      txHash: snapshot.txHash,
      success: snapshot.status === 'confirmed_success',
      rpcError: snapshot.lastRpcError,
      source: 'rpc_receipt'
    });
  } else if (snapshot.status === 'visible_pending') {
    reportTxByHashSeen({
      chainId: snapshot.chainId,
      txHash: snapshot.txHash,
      rpcError: snapshot.lastRpcError,
      source: 'rpc_tx'
    });
  } else if (snapshot.status === 'broadcasted_unseen' || snapshot.status === 'dropped_timeout' || snapshot.status === 'send_failed') {
    reportRpcUncertain({
      chainId: snapshot.chainId,
      txHash: snapshot.txHash,
      error: snapshot.lastRpcError || snapshot.status
    });
  }
}

export function getTxLifecycleState(chainId: number, txHash: string): TxLifecycleSnapshot | null {
  const key = txLifecycleKey(chainId, txHash);
  const row = txLifecycleStateCache.get(key);
  if (!row) return null;
  const updatedAt = row.updatedAt || 0;
  if (Date.now() - updatedAt > TX_LIFECYCLE_STATE_TTL_MS) {
    txLifecycleStateCache.delete(key);
    return null;
  }
  return row;
}

export function markChainRpcDegraded(chainId: number, method: string, errorMessage?: string): void {
  rpcChainDegradedState.set(chainId, {
    until: Date.now() + RPC_CHAIN_DEGRADED_TTL_MS,
    updatedAt: Date.now(),
    method,
    lastError: errorMessage ? String(errorMessage).slice(0, 180) : undefined
  });
}

export function getChainRpcDegradeState(chainId: number): { degraded: boolean; until: number; updatedAt: number; method?: string; lastError?: string } {
  const row = rpcChainDegradedState.get(chainId);
  if (!row) return { degraded: false, until: 0, updatedAt: 0 };
  if (Date.now() > row.until) {
    rpcChainDegradedState.delete(chainId);
    return { degraded: false, until: 0, updatedAt: 0 };
  }
  return { degraded: true, ...row };
}

export function getEndpointHealthView(url: string) {
  const health = getOrCreateHealth(url);
  return {
    successRate: health.totalAttempts > 0 ? health.successCount / health.totalAttempts : 0.7,
    avgResponseTime: health.avgResponseTime,
    circuitOpen: health.circuitOpen,
    consecutiveFailures: health.consecutiveFailures,
    totalAttempts: health.totalAttempts
  };
}

export function getEndpointUsageView(url: string) {
  const usage = getOrCreateUsage(url);
  const reserved = getProjectedEndpointUsage(url);
  return {
    inFlight: usage.inFlight,
    secondCount: usage.secondCount,
    minuteCount: usage.minuteCount,
    lastUsedAt: usage.lastUsedAt,
    reservedSecondCount: reserved.reservedSecondCount,
    reservedMinuteCount: reserved.reservedMinuteCount
  };
}

export function reserveProjectedSelection(endpoints: RpcEndpointConfig[], method: string, importance: RpcImportance, purpose: string): void {
  if (endpoints.length === 0) return;
  const lane: RpcLane = importance === 'critical' ? 'route_read' : 'background';
  const burstSize = estimateUpcomingRpcBurstSize({ method, lane, importance, purpose: purpose as any });
  reserveProjectedEndpointUsage({
    url: endpoints[0]!.url,
    lane,
    secondUnits: burstSize,
    minuteUnits: burstSize
  });
  if (endpoints.length > 1 && (importance === 'critical' || method === 'eth_call')) {
    reserveProjectedEndpointUsage({
      url: endpoints[1]!.url,
      lane,
      secondUnits: 1,
      minuteUnits: 1
    });
  }
}

export function endpointCapacityPressure(endpoint: RpcEndpointConfig): number {
  const usage = getEndpointUsageView(endpoint.url);
  const limits = endpoint.limits || {};
  const rpsPressure = limits.rps ? (usage.secondCount + (usage.reservedSecondCount || 0)) / Math.max(1, limits.rps) : 0;
  const rpmPressure = limits.rpm ? (usage.minuteCount + (usage.reservedMinuteCount || 0)) / Math.max(1, limits.rpm) : 0;
  const inFlightPressure = limits.maxInFlight ? usage.inFlight / Math.max(1, limits.maxInFlight) : 0;
  return Math.max(rpsPressure, rpmPressure, inFlightPressure);
}

export function getRpcMethodUsageSnapshot(chainId?: number): Record<string, RpcMethodUsageSnapshotRow> {
  const out: Record<string, RpcMethodUsageSnapshotRow> = {};
  for (const [key, row] of rpcMethodUsage.entries()) {
    if (typeof chainId === 'number' && row.chainId !== chainId) continue;
    out[key] = { ...row };
  }
  return out;
}

export function diffRpcMethodUsageSnapshots(
  before: Record<string, RpcMethodUsageSnapshotRow>,
  after: Record<string, RpcMethodUsageSnapshotRow>
): Array<RpcMethodUsageSnapshotRow> {
  const deltas: Array<RpcMethodUsageSnapshotRow> = [];
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const b = before[key];
    const a = after[key];
    if (!a && !b) continue;
    const chain = a?.chainId ?? b!.chainId;
    const method = a?.method ?? b!.method;
    const row: RpcMethodUsageSnapshotRow = {
      chainId: chain,
      method,
      importance: a?.importance ?? b!.importance,
      rpcClass: a?.rpcClass ?? b!.rpcClass,
      path: a?.path ?? b!.path,
      requests: (a?.requests || 0) - (b?.requests || 0),
      endpointAttempts: (a?.endpointAttempts || 0) - (b?.endpointAttempts || 0),
      successes: (a?.successes || 0) - (b?.successes || 0),
      endpointFailures: (a?.endpointFailures || 0) - (b?.endpointFailures || 0),
      allFailed: (a?.allFailed || 0) - (b?.allFailed || 0),
      timeoutErrors: (a?.timeoutErrors || 0) - (b?.timeoutErrors || 0),
      latencyMsTotal: (a?.latencyMsTotal || 0) - (b?.latencyMsTotal || 0),
      lastLatencyMs: a?.lastLatencyMs || b?.lastLatencyMs || 0,
      updatedAt: a?.updatedAt || b!.updatedAt
    };
    if (
      row.requests <= 0 &&
      row.endpointAttempts <= 0 &&
      row.successes <= 0 &&
      row.endpointFailures <= 0 &&
      row.allFailed <= 0 &&
      row.timeoutErrors <= 0 &&
      row.latencyMsTotal <= 0
    ) {
      continue;
    }
    deltas.push(row);
  }
  deltas.sort((x, y) => y.endpointAttempts - x.endpointAttempts);
  return deltas;
}

export function getUsageSnapshot(chainId?: number): RpcUsageSnapshot {
  const methods = getRpcMethodUsageSnapshot(chainId);
  const endpoints = Array.from(endpointUsage.values()).map((usage) => ({
    url: maskEndpoint(usage.url),
    inFlight: usage.inFlight,
    secondCount: usage.secondCount,
    minuteCount: usage.minuteCount,
    lastUsedAt: usage.lastUsedAt
  }));
  return {
    timestamp: Date.now(),
    methods,
    inflightPools: {
      critical_tx: rpcPoolInflight.critical_tx,
      best_effort_read: rpcPoolInflight.best_effort_read
    },
    endpoints
  };
}

export function getRpcHealthStats(): Array<{
  url: string;
  successRate: number;
  avgResponseTime: number;
  circuitOpen: boolean;
  consecutiveFailures: number;
}> {
  const stats: Array<any> = [];
  for (const [url, health] of endpointHealth.entries()) {
    const successRate = health.totalAttempts > 0
      ? (health.successCount / health.totalAttempts) * 100
      : 0;
    stats.push({
      url: maskEndpoint(url),
      successRate: Math.round(successRate * 100) / 100,
      avgResponseTime: Math.round(health.avgResponseTime),
      circuitOpen: health.circuitOpen,
      consecutiveFailures: health.consecutiveFailures
    });
  }
  return stats.sort((a, b) => b.successRate - a.successRate);
}

export function markRpcPoolInflight(rpcClass: RpcClass, delta: number): void {
  rpcPoolInflight[rpcClass] = Math.max(0, rpcPoolInflight[rpcClass] + delta);
}

export function getRpcPoolInflight(): Record<RpcClass, number> {
  return { ...rpcPoolInflight };
}

export function resetRpcRuntimeStateForTest(): void {
  endpointHealth.clear();
  endpointUsage.clear();
  methodBackoff.clear();
  rpcMethodUsage.clear();
  endpointMethodTimeoutHealth.clear();
  txLifecycleStateCache.clear();
  rpcChainDegradedState.clear();
  allRpcFailedLogGate.clear();
  rpcPoolInflight.critical_tx = 0;
  rpcPoolInflight.best_effort_read = 0;
}

export function shouldLogRpcExplain(): boolean {
  return RPC_EXPLAIN_ENABLED;
}

export function shouldLogAllRpcFailedGate(key: string): boolean {
  return shouldLogAllRpcFailed(key);
}

export function getEndpointMethodTimeoutHealthView(key: string) {
  const state = getEndpointMethodTimeoutHealth(key);
  return { ...state };
}

export function endpointMethodTimeoutKey(endpointUrl: string, method: string): string {
  return endpointMethodHealthKey(endpointUrl, method);
}
