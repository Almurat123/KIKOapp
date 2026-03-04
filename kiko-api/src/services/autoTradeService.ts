import type { DecodedSwap } from './txDecoder.js';
import type { CopyTradeTimingSnapshot } from './copytrade-v2/timing/copyTradeTimingModel.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { copytradeV2Runtime } from './copytrade-v2/runtime/index.js';
import {
  initCopytradeV2Bootstrap,
  isCopytradeRuntimeShuttingDown,
  stopCopytradeV2Bootstrap,
} from './copytrade-v2/runtime/bootstrap.js';
import { checkPositionsForExits as checkPositionsForExitsV2 } from './copytrade-v2/runtime/positionMonitor.js';
import {
  getMinTargetEffectiveFloorUsd,
  isBelowMinTargetValue,
  resolveEffectiveMinTargetValueUsd,
} from './copytrade-v2/guards/targetValueGuard.js';
import { evaluateStaticBuyGuards } from './copytrade-v2/guards/evaluator.js';
import { resolveBuyGuardPolicy } from './copytrade-v2/guards/policy.js';

export { getTokenInfo } from './tokenService.js';

function normalizeFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function resolveEffectivePositiveThreshold(configValue: unknown, userSettingValue: unknown): number | null {
  const c = normalizeFiniteNumber(configValue);
  const u = normalizeFiniteNumber(userSettingValue);
  const candidates: number[] = [];
  if (c !== null && c > 0) candidates.push(c);
  if (u !== null && u > 0) candidates.push(u);
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

function dedupeConfigsByUser(configs: any[]): any[] {
  const picked = new Map<string, any>();
  for (const config of configs) {
    const userId = String(config?.userId || '');
    if (!userId) continue;

    const existing = picked.get(userId);
    if (!existing) {
      picked.set(userId, config);
      continue;
    }

    const existingTs = new Date(existing?.updatedAt || existing?.createdAt || 0).getTime();
    const nextTs = new Date(config?.updatedAt || config?.createdAt || 0).getTime();
    const shouldReplace = Number.isFinite(nextTs) && nextTs >= existingTs;
    if (shouldReplace) picked.set(userId, config);
  }

  return Array.from(picked.values());
}

/**
 * CopyTrade v2 ingress adapter.
 * Queue/webhook entry keeps this stable API.
 */
export async function handleSwapDetected(
  targetWallet: string,
  swap: DecodedSwap,
  chainId: number,
  context?: { detectedAt?: number; timing?: CopyTradeTimingSnapshot },
): Promise<void> {
  if (isCopytradeRuntimeShuttingDown()) {
    logger.warn(LogCode.SYS_SHUTDOWN, '[CopyTradeV2] service shutting down, rejecting new swap webhook', {
      wallet: targetWallet,
      chainId,
      txHash: swap?.txHash || undefined,
    });
    return;
  }

  await copytradeV2Runtime.handleSwapDetected(targetWallet, swap, chainId, {
    detectedAt: context?.timing?.dispatchEligibleAt || context?.detectedAt,
  });
}

export function initAutoTradeService(): void {
  initCopytradeV2Bootstrap({
    solanaHandler: async (targetWallet, swap, chainId, context) => {
      await handleSwapDetected(targetWallet, swap, chainId, context);
    },
  });
}

export async function stopAutoTradeService(): Promise<void> {
  await stopCopytradeV2Bootstrap();
}

export async function checkPositionsForExits(): Promise<void> {
  await checkPositionsForExitsV2();
}

export async function passesFilters(
  tokenInfo: any,
  config: any,
  targetSwapValueUsd: number,
  policy = resolveBuyGuardPolicy('normal'),
  options?: Parameters<typeof evaluateStaticBuyGuards>[4],
): Promise<{ passed: boolean; reason?: string }> {
  if (!tokenInfo) return { passed: false, reason: 'No token info' };
  return await evaluateStaticBuyGuards(tokenInfo, config, targetSwapValueUsd, policy, options);
}

// Test-only hooks used by deterministic stress scripts.
export const __copyTradeGuardTestHelpers = {
  getMinTargetEffectiveFloorUsd,
  isBelowMinTargetValue,
  resolveEffectivePositiveThreshold,
  resolveEffectiveMinTargetValueUsd,
  dedupeConfigsByUser,
};
