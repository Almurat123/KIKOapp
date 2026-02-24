import type { DecodedSwap } from '../../txDecoder.js';
import type { SwapExecutionContextV1 } from './types.js';

const SWAP_TOPICS = new Set([
  '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',
  '0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b',
  '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
  '0x19b47279256b2a23a1665c810c8d55a1758940ee09377d4f8d26497a3577dc83',
  '0x40e9cecb9f1f0538856d2d6db3d3aa23f205aa7d8e4a11f4326a6e2f7f6df6ea'
]);

const KNOWN_SWAP_SELECTORS = new Set([
  '0x3593564c',
  '0x24856bc3',
  '0xcae6a6b3',
  '0xc04b8d59',
  '0x414bf389',
  '0xb858183f',
  '0x04e45aaf',
  '0x7ff36ab5',
  '0x18cbafe5',
  '0x38ed1739',
  '0x12aa3caf',
  '0xe21fd0e9'
]);

function normalizeAddress(value?: string): string | undefined {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return undefined;
  return /^0x[0-9a-f]{40}$/.test(raw) ? raw : undefined;
}

function selectorFromInput(input?: string): string | undefined {
  const raw = String(input || '');
  if (!raw.startsWith('0x') || raw.length < 10) return undefined;
  return raw.slice(0, 10).toLowerCase();
}

export function buildSwapExecutionContext(params: {
  tx: { hash: string; to?: string; input?: string; value?: string };
  receipt?: { logs?: Array<{ topics?: string[] }> };
  decodedSwap: DecodedSwap;
  chainId: number;
  targetWallet?: string;
  webhookId?: string;
  detectedAt?: number;
}): SwapExecutionContextV1 {
  const selector = selectorFromInput(params.tx.input || params.decodedSwap.sourceTxInput);
  const hasSwapTopic = Array.isArray(params.receipt?.logs)
    ? params.receipt!.logs!.some((log) => SWAP_TOPICS.has(String(log?.topics?.[0] || '').toLowerCase()))
    : false;

  return {
    version: 1,
    chainId: params.chainId,
    sourceTxHash: String(params.tx.hash || params.decodedSwap.txHash || '').toLowerCase(),
    sourceRouter: normalizeAddress(params.tx.to || params.decodedSwap.router),
    sourceSelector: selector,
    sourceTxInput: String(params.tx.input || params.decodedSwap.sourceTxInput || ''),
    sourceTxValue: String(params.tx.value || params.decodedSwap.sourceTxValue || '0'),
    tokenIn: String(params.decodedSwap.tokenIn || '').toLowerCase(),
    tokenOut: String(params.decodedSwap.tokenOut || '').toLowerCase(),
    amountIn: String(params.decodedSwap.amountIn || '0'),
    amountOut: String(params.decodedSwap.amountOut || '0'),
    routeHops: params.decodedSwap.routeHops?.map((hop) => ({
      kind: hop.kind,
      dex: hop.dex,
      poolAddress: normalizeAddress(hop.poolAddress),
      tokenIn: String(hop.tokenIn || '').toLowerCase() || undefined,
      tokenOut: String(hop.tokenOut || '').toLowerCase() || undefined,
      fee: hop.fee
    })),
    resolvedPoolHint: params.decodedSwap.resolvedPoolHint
      ? {
          kind: params.decodedSwap.resolvedPoolHint.kind,
          dex: params.decodedSwap.resolvedPoolHint.dex,
          poolAddress: normalizeAddress(params.decodedSwap.resolvedPoolHint.poolAddress),
          fee: params.decodedSwap.resolvedPoolHint.fee,
          v4PoolKey: params.decodedSwap.resolvedPoolHint.v4PoolKey
            ? {
                currency0: String(params.decodedSwap.resolvedPoolHint.v4PoolKey.currency0 || '').toLowerCase(),
                currency1: String(params.decodedSwap.resolvedPoolHint.v4PoolKey.currency1 || '').toLowerCase(),
                hooks: String(params.decodedSwap.resolvedPoolHint.v4PoolKey.hooks || '').toLowerCase(),
                poolManager: String(params.decodedSwap.resolvedPoolHint.v4PoolKey.poolManager || '').toLowerCase(),
                fee: params.decodedSwap.resolvedPoolHint.v4PoolKey.fee,
                tickSpacing: params.decodedSwap.resolvedPoolHint.v4PoolKey.tickSpacing
              }
            : undefined
        }
      : undefined,
    decodeEvidence: {
      hasSwapTopic,
      knownRouter: Boolean(normalizeAddress(params.decodedSwap.router)),
      knownSelector: Boolean(selector && KNOWN_SWAP_SELECTORS.has(selector))
    },
    trace: {
      webhookId: params.webhookId,
      targetWallet: normalizeAddress(params.targetWallet),
      detectedAt: Number(params.detectedAt || Date.now())
    }
  };
}
