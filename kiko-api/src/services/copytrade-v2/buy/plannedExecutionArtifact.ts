import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import type { DecodedSwap } from '../../txDecoder.js';
import { buildSwapExecutionContext } from '../context/contextBuilder.js';
import { getContextByTxHash, putContext } from '../context/contextStore.js';
import type { ContextStoreHit } from '../context/types.js';
import { buildExecutionPlan } from '../planner/pathPlanner.js';
import { getP2AllowedChains, isP2PlannerEnabled } from '../planner/featureFlags.js';
import type { ExecutionPlanV1, PlannerInput } from '../planner/types.js';

function inferExecutionSideFromTokens(tokenIn: string, tokenOut: string, chainId: number): 'buy' | 'sell' {
  const nativeLike = new Set([
    'eth',
    'bnb',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  ]);
  return nativeLike.has(String(tokenIn || '').toLowerCase()) && !nativeLike.has(String(tokenOut || '').toLowerCase())
    ? 'buy'
    : 'sell';
}

function isSourceReplayEligibleInput(sourceTxInput?: string): boolean {
  const selector = String(sourceTxInput || '').slice(0, 10).toLowerCase();
  if (!/^0x[0-9a-f]{8}$/.test(selector)) return false;
  const knownReplaySelectors = new Set([
    '0x3593564c',
    '0x24856bc3',
    '0xcae6a6b3',
    '0x0f27c5c1',
    '0xd1ee211d',
    '0x2213bc0b',
    '0x784e2685',
    '0x12aa3caf',
    '0x1fff991f',
    '0x414bf389',
    '0xc04b8d59',
    '0x7ff36ab5',
    '0x18cbafe5',
    '0x38ed1739',
    '0x04e45aaf'
  ]);
  return knownReplaySelectors.has(selector);
}

export interface CopytradeBuyPlannedArtifact {
  executionContextBase: {
    sourceTxHash?: string;
    sourceRouter?: string;
    sourceTxInput?: string;
    sourceTxValue?: string;
    sourceTokenIn?: string;
    sourceTokenOut?: string;
    sourceAmountIn?: string;
    sourceAmountOut?: string;
    contextId?: string;
    contextSnapshot?: any;
    contextHitSource: 'redis' | 'db' | 'inline' | 'miss';
    strictReplica: false;
  };
  getExecutionPlan: (amountIn: string) => Promise<ExecutionPlanV1 | undefined>;
}

export async function buildCopytradeBuyPlannedArtifact(args: {
  chainId: number;
  walletAddress: string;
  tokenIn: string;
  tokenOut: string;
  swap?: DecodedSwap;
}): Promise<CopytradeBuyPlannedArtifact> {
  const sourceTxHash = args.chainId === 900
    ? String(args.swap?.txHash || '')
    : String(args.swap?.txHash || '').toLowerCase();
  let contextStoreHit: ContextStoreHit = { context: null, source: 'miss' };
  if (sourceTxHash) {
    contextStoreHit = await getContextByTxHash(args.chainId, sourceTxHash).catch(() => ({ context: null, source: 'miss' }));
  }

  const inlineContext = args.swap?.txHash
    ? buildSwapExecutionContext({
      tx: {
        hash: String(args.swap.txHash),
        to: String(args.swap.router || ''),
        input: String(args.swap.sourceTxInput || ''),
        value: String(args.swap.sourceTxValue || '0')
      },
      decodedSwap: args.swap,
      chainId: args.chainId,
      targetWallet: undefined
    })
    : null;

  const context = contextStoreHit.context || inlineContext;
  if (inlineContext && !contextStoreHit.context) {
    await putContext(inlineContext).catch(() => { });
  }

  const contextHitSource: 'redis' | 'db' | 'inline' | 'miss' = contextStoreHit.context
    ? contextStoreHit.source
    : (inlineContext ? 'inline' : 'miss');

  const executionContextBase = {
    sourceTxHash: context?.sourceTxHash || args.swap?.txHash,
    sourceRouter: context?.sourceRouter || args.swap?.router,
    sourceTxInput: context?.sourceTxInput || args.swap?.sourceTxInput,
    sourceTxValue: context?.sourceTxValue || args.swap?.sourceTxValue,
    sourceTokenIn: context?.tokenIn || args.swap?.tokenIn,
    sourceTokenOut: context?.tokenOut || args.swap?.tokenOut,
    sourceAmountIn: context?.amountIn || args.swap?.amountIn,
    sourceAmountOut: context?.amountOut || args.swap?.amountOut,
    contextId: contextStoreHit.contextId,
    contextSnapshot: context || undefined,
    contextHitSource,
    strictReplica: false as const
  };

  const sourceInput = context?.sourceTxInput || args.swap?.sourceTxInput;
  const sourceRouter = context?.sourceRouter || args.swap?.router;
  const sourceSelector = context?.sourceSelector
    || (/^0x[0-9a-fA-F]{8}/.test(String(sourceInput || '')) ? String(sourceInput).slice(0, 10).toLowerCase() : undefined);
  const hasSourceReplayContext = !!sourceInput && !!sourceRouter && isSourceReplayEligibleInput(sourceInput);
  const plannerCache = new Map<string, Promise<ExecutionPlanV1 | undefined>>();

  return {
    executionContextBase,
    getExecutionPlan(amountIn: string) {
      const key = String(amountIn);
      const existing = plannerCache.get(key);
      if (existing) return existing;

      const task = (async () => {
        if (!isP2PlannerEnabled() && !hasSourceReplayContext) {
          return undefined;
        }
        if (!getP2AllowedChains().includes(args.chainId) && !hasSourceReplayContext) {
          return undefined;
        }
        try {
          const plannerInput: PlannerInput = {
            chainId: args.chainId,
            side: inferExecutionSideFromTokens(args.tokenIn, args.tokenOut, args.chainId),
            tokenIn: args.tokenIn,
            tokenOut: args.tokenOut,
            amountIn,
            walletAddress: args.walletAddress,
            sourceWallet: context?.trace?.targetWallet,
            sourceTxHash: context?.sourceTxHash || args.swap?.txHash,
            sourceRouter,
            sourceSelector,
            sourceTxInput: sourceInput,
            sourceTxValue: context?.sourceTxValue || args.swap?.sourceTxValue
          };
          return await buildExecutionPlan(plannerInput);
        } catch (error: any) {
          logger.warn(LogCode.SYS_ERROR, '[P2] Planner build failed in buy planned artifact', {
            error: error?.message || String(error),
            chainId: args.chainId,
            tokenIn: args.tokenIn,
            tokenOut: args.tokenOut
          });
          return undefined;
        }
      })();

      plannerCache.set(key, task);
      return task;
    }
  };
}
