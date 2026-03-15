import { buildScopedCacheKey, withScopedCache } from '../../rpc/cacheStore.js';
import { resolveMirrorSellRatioContext } from './mirrorSellRatioContext.js';
import { resolveTargetSellLink } from '../reconcile/copytradeTargetSellLinkResolver.js';
import { verifyTargetFullExit } from '../reconcile/targetSellFullExitVerifier.js';
import { normalizeAddress } from '../../../utils/address.js';

const MIRROR_SELL_TARGET_CONTEXT_TTL_MS = Math.max(
  1000,
  Number(process.env.COPYTRADE_MIRROR_SELL_TARGET_CONTEXT_TTL_MS || '4000')
);

export interface MirrorSellTargetContext {
  latestTargetSellTxHash: string | null;
  targetFullExitVerified: boolean;
  targetFullExitReasonCode: string | null;
  targetSellRatioBps: number | null;
  targetSellRatioReasonCode: string | null;
}

interface MirrorSellTargetContextDeps {
  withScopedCache: typeof withScopedCache;
  verifyTargetFullExit: typeof verifyTargetFullExit;
  resolveTargetSellLink: typeof resolveTargetSellLink;
  resolveMirrorSellRatioContext: typeof resolveMirrorSellRatioContext;
}

const defaultDeps: MirrorSellTargetContextDeps = {
  withScopedCache,
  verifyTargetFullExit,
  resolveTargetSellLink,
  resolveMirrorSellRatioContext,
};

function buildMirrorSellTargetContextKey(params: {
  targetWallet: string;
  chainId: number;
  tokenAddress: string;
  leaderBuyTxHash?: string | null;
  anchorTimestampMs?: number | null;
}): string {
  return buildScopedCacheKey('copytrade_mirror_sell_target_context', [
    params.chainId,
    normalizeAddress(params.targetWallet),
    normalizeAddress(params.tokenAddress),
    String(params.leaderBuyTxHash || '').trim() || 'none',
    Number.isFinite(params.anchorTimestampMs) ? Number(params.anchorTimestampMs) : 'none',
  ]);
}

function resolveLeaderBuyTxHash(input: {
  leaderBuyTxHash?: string | null;
  positionLeaderBuyTxHash?: string | null;
}): string | null {
  const direct = String(input.leaderBuyTxHash || '').trim();
  if (direct) return direct;
  const fromPosition = String(input.positionLeaderBuyTxHash || '').trim();
  return fromPosition || null;
}

export async function resolveMirrorSellTargetContext(params: {
  targetWallet: string;
  chainId: number;
  tokenAddress: string;
  leaderBuyTxHash?: string | null;
  positionLeaderBuyTxHash?: string | null;
  positionCreatedAt?: Date | null;
  pendingCreatedAt?: Date | null;
  latestTargetSellTxHash?: string | null;
}, deps: Partial<MirrorSellTargetContextDeps> = {}): Promise<MirrorSellTargetContext> {
  const runtime = { ...defaultDeps, ...deps };
  const leaderBuyTxHash = resolveLeaderBuyTxHash(params);
  const anchorTimestampMs = Math.min(
    ...[params.positionCreatedAt, params.pendingCreatedAt]
      .filter((value): value is Date => value instanceof Date)
      .map((value) => value.getTime())
  );
  const key = buildMirrorSellTargetContextKey({
    targetWallet: params.targetWallet,
    chainId: params.chainId,
    tokenAddress: params.tokenAddress,
    leaderBuyTxHash,
    anchorTimestampMs: Number.isFinite(anchorTimestampMs) ? anchorTimestampMs : null,
  });

  return await runtime.withScopedCache({
    key,
    ttlMs: MIRROR_SELL_TARGET_CONTEXT_TTL_MS,
    producer: async () => {
      const verification = await runtime.verifyTargetFullExit({
        targetWallet: params.targetWallet,
        chainId: params.chainId,
        tokenAddress: params.tokenAddress,
      }).catch(() => null);

      let latestTargetSellTxHash = String(params.latestTargetSellTxHash || '').trim() || null;
      let targetFullExitVerified = Boolean(verification?.isFullExit);
      let targetFullExitReasonCode: string | null = verification?.reasonCode || null;

      if (!latestTargetSellTxHash || !targetFullExitVerified) {
        const linkedSell = await runtime.resolveTargetSellLink({
          targetWallet: params.targetWallet,
          chainId: params.chainId,
          tokenAddress: params.tokenAddress,
          leaderBuyTxHash,
          positionCreatedAt: params.positionCreatedAt || null,
          pendingCreatedAt: params.pendingCreatedAt || null,
          allowUnanchoredVerifiedFallback: true,
          targetFullExitVerified: true,
        }).catch(() => null);

        if (linkedSell?.txHash) {
          latestTargetSellTxHash = linkedSell.txHash;
          if (!targetFullExitReasonCode) {
            targetFullExitReasonCode = linkedSell.reasonCode;
          }
        }
      }

      const ratioContext = await runtime.resolveMirrorSellRatioContext({
        targetWallet: params.targetWallet,
        chainId: params.chainId,
        tokenAddress: params.tokenAddress,
        decimals: Number(verification?.decimals || 18),
        latestTargetSellTxHash,
        leaderBuyTxHash,
      }).catch(() => null);

      return {
        latestTargetSellTxHash,
        targetFullExitVerified,
        targetFullExitReasonCode,
        targetSellRatioBps: ratioContext?.ratioBps ?? null,
        targetSellRatioReasonCode: ratioContext?.reasonCode ?? null,
      };
    },
  });
}

export const __mirrorSellTargetContextTest = {
  buildMirrorSellTargetContextKey,
};
