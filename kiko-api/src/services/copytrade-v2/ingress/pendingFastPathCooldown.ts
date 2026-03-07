import { del as cacheDel, get as cacheGet, incrBy as cacheIncrBy, setJson as cacheSetJson } from '../../../cache/cacheClient.js';
import { normalizeWallet } from '../runtime/chainIdentityNormalizer.js';

type PendingFastPathCooldownState = {
  chainId: number;
  targetWallet: string;
  activeUntilMs: number;
  activatedAtMs: number;
  failureCount: number;
  threshold: number;
  reasonCode: string;
  lastFailureTxHash?: string | null;
};

type PendingFastPathDecision = {
  active: boolean;
  failureCount: number;
  activeUntilMs: number | null;
  reasonCode?: string | null;
};

const FAILURE_THRESHOLD = Math.max(1, Number(process.env.COPYTRADE_PENDING_FAILSAFE_THRESHOLD || 4));
const FAILURE_WINDOW_SEC = Math.max(60, Number(process.env.COPYTRADE_PENDING_FAILSAFE_WINDOW_SEC || 3600));
const COOLDOWN_TTL_SEC = Math.max(60, Number(process.env.COPYTRADE_PENDING_FAILSAFE_COOLDOWN_SEC || 3600));

const deps = {
  cacheDel,
  cacheGet,
  cacheIncrBy,
  cacheSetJson,
  nowMs: () => Date.now(),
};

function isPendingFastPathEligibleChain(chainId: number): boolean {
  return chainId !== 900;
}

function buildFailureCountKey(chainId: number, targetWallet: string): string {
  return `copytrade:pending_fast_path:failures:${chainId}:${targetWallet}`;
}

function buildCooldownKey(chainId: number, targetWallet: string): string {
  return `copytrade:pending_fast_path:cooldown:${chainId}:${targetWallet}`;
}

async function clearFailureCount(chainId: number, targetWallet: string): Promise<void> {
  await deps.cacheDel(buildFailureCountKey(chainId, targetWallet)).catch(() => { });
}

export async function getPendingFastPathDecision(params: {
  chainId: number;
  targetWallet: string | null | undefined;
}): Promise<PendingFastPathDecision> {
  const normalizedWallet = normalizeWallet(params.chainId, params.targetWallet);
  if (!normalizedWallet || !isPendingFastPathEligibleChain(params.chainId)) {
    return { active: false, failureCount: 0, activeUntilMs: null, reasonCode: null };
  }

  const countRaw = await deps.cacheGet(buildFailureCountKey(params.chainId, normalizedWallet)).catch(() => null);
  const failureCount = Number.parseInt(String(countRaw || '0'), 10) || 0;
  const cooldownRaw = await deps.cacheGet(buildCooldownKey(params.chainId, normalizedWallet)).catch(() => null);
  if (!cooldownRaw) {
    return { active: false, failureCount, activeUntilMs: null, reasonCode: null };
  }

  try {
    const parsed = JSON.parse(cooldownRaw) as PendingFastPathCooldownState;
    if ((parsed.activeUntilMs || 0) <= deps.nowMs()) {
      await deps.cacheDel(buildCooldownKey(params.chainId, normalizedWallet)).catch(() => { });
      return { active: false, failureCount, activeUntilMs: null, reasonCode: null };
    }
    return {
      active: true,
      failureCount: parsed.failureCount || failureCount,
      activeUntilMs: parsed.activeUntilMs || null,
      reasonCode: parsed.reasonCode || null,
    };
  } catch {
    await deps.cacheDel(buildCooldownKey(params.chainId, normalizedWallet)).catch(() => { });
    return { active: false, failureCount, activeUntilMs: null, reasonCode: null };
  }
}

export async function recordPendingFastPathFailure(params: {
  chainId: number;
  targetWallet: string | null | undefined;
  txHash?: string | null;
  reasonCode: string;
}): Promise<PendingFastPathDecision> {
  const normalizedWallet = normalizeWallet(params.chainId, params.targetWallet);
  if (!normalizedWallet || !isPendingFastPathEligibleChain(params.chainId)) {
    return { active: false, failureCount: 0, activeUntilMs: null, reasonCode: null };
  }

  const failureCount = await deps.cacheIncrBy(
    buildFailureCountKey(params.chainId, normalizedWallet),
    1,
    FAILURE_WINDOW_SEC
  ).catch(() => 0);

  if (failureCount < FAILURE_THRESHOLD) {
    return {
      active: false,
      failureCount,
      activeUntilMs: null,
      reasonCode: params.reasonCode,
    };
  }

  const activatedAtMs = deps.nowMs();
  const cooldownState: PendingFastPathCooldownState = {
    chainId: params.chainId,
    targetWallet: normalizedWallet,
    activeUntilMs: activatedAtMs + COOLDOWN_TTL_SEC * 1000,
    activatedAtMs,
    failureCount,
    threshold: FAILURE_THRESHOLD,
    reasonCode: params.reasonCode,
    lastFailureTxHash: params.txHash || null,
  };
  await deps.cacheSetJson(buildCooldownKey(params.chainId, normalizedWallet), cooldownState, COOLDOWN_TTL_SEC).catch(() => { });
  return {
    active: true,
    failureCount,
    activeUntilMs: cooldownState.activeUntilMs,
    reasonCode: params.reasonCode,
  };
}

export async function recordPendingFastPathSuccess(params: {
  chainId: number;
  targetWallet: string | null | undefined;
}): Promise<void> {
  const normalizedWallet = normalizeWallet(params.chainId, params.targetWallet);
  if (!normalizedWallet || !isPendingFastPathEligibleChain(params.chainId)) return;
  const decision = await getPendingFastPathDecision({
    chainId: params.chainId,
    targetWallet: normalizedWallet,
  });
  if (decision.active) return;
  await clearFailureCount(params.chainId, normalizedWallet);
}

export const __pendingFastPathCooldownTest = {
  setHooks(hooks: Partial<typeof deps>): void {
    Object.assign(deps, hooks);
  },
  resetHooks(): void {
    deps.cacheDel = cacheDel;
    deps.cacheGet = cacheGet;
    deps.cacheIncrBy = cacheIncrBy;
    deps.cacheSetJson = cacheSetJson;
    deps.nowMs = () => Date.now();
  }
};
