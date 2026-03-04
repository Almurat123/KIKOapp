import { get as cacheGet, set as cacheSet } from '../../../cache/cacheClient.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';

type ReliabilityState = {
  scoreBps: number;
  sampleCount: number;
  updatedAt: number;
};

const DEFAULT_SCORE_BPS = 10000;
const MIN_SCORE_BPS = 2000;
const MAX_SCORE_BPS = 12000;
const CACHE_TTL_SEC = Math.max(300, Number(process.env.COPYTRADE_PROVIDER_RELIABILITY_TTL_SEC || 86400));
const BASE_ALPHA = Math.min(0.8, Math.max(0.05, Number(process.env.COPYTRADE_PROVIDER_RELIABILITY_ALPHA || 0.25)));

/**
 * Adaptive EMA weight: conservative with few samples, full weight after ~30.
 * Prevents a single network blip from tanking a provider's score when we have
 * very little history to average against.
 */
export function adaptiveAlpha(sampleCount: number): number {
  if (sampleCount < 5) return BASE_ALPHA * 0.3;
  if (sampleCount < 15) return BASE_ALPHA * 0.5;
  if (sampleCount < 30) return BASE_ALPHA * 0.75;
  return BASE_ALPHA;
}

function keyFor(chainId: number, tokenIn: string, tokenOut: string, provider: string): string {
  return `copytrade:reliability:${chainId}:${String(tokenIn || '').toLowerCase()}:${String(tokenOut || '').toLowerCase()}:${String(provider || '').toLowerCase()}`;
}

async function readState(key: string): Promise<ReliabilityState | null> {
  const raw = await cacheGet(key).catch(() => null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ReliabilityState;
    if (!Number.isFinite(parsed.scoreBps) || !Number.isFinite(parsed.sampleCount)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getProviderReliability(params: {
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  provider: string;
}): Promise<ReliabilityState> {
  const key = keyFor(params.chainId, params.tokenIn, params.tokenOut, params.provider);
  const existing = await readState(key);
  if (existing) return existing;
  return {
    scoreBps: DEFAULT_SCORE_BPS,
    sampleCount: 0,
    updatedAt: Date.now()
  };
}

export async function recordProviderReliabilityOutcome(params: {
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  provider: string;
  anchorRatioBps: number;
  accepted: boolean;
}): Promise<void> {
  const key = keyFor(params.chainId, params.tokenIn, params.tokenOut, params.provider);
  const state = await getProviderReliability(params);

  const observedBps = params.accepted
    ? Math.max(6000, Math.min(12000, params.anchorRatioBps))
    : Math.max(1000, Math.min(7000, params.anchorRatioBps));
  const alpha = adaptiveAlpha(state.sampleCount);
  const nextScore = Math.round((1 - alpha) * state.scoreBps + alpha * observedBps);
  const clamped = Math.max(MIN_SCORE_BPS, Math.min(MAX_SCORE_BPS, nextScore));
  const next: ReliabilityState = {
    scoreBps: clamped,
    sampleCount: state.sampleCount + 1,
    updatedAt: Date.now()
  };

  await cacheSet(key, JSON.stringify(next), CACHE_TTL_SEC).catch((error: any) => {
    logger.warn(LogCode.SYS_ERROR, '[Reliability] Failed to persist provider reliability', {
      key,
      error: error?.message || String(error)
    });
  });
}
