/**
 * Main Swap Service - Unified Swap Execution
 * 
 * Single source of truth for all swap operations across:
 * - Chat Fast Swaps (chatWorker.ts)
 * - Swap Card UI (prepareSwap.ts)
 * - Allowance Trades
 * - Copy Trading (autoTradeService.ts, tradeExecutor.ts)
 * - Launchpad Swaps (Clanker, Zora, FourMeme, PumpFun, BonkFun)
 * 
 * Architecture:
 * 1. Normalize inputs (token resolution, chain detection)
 * 2. Detect launchpad platform (if applicable)
 * 3. Route to appropriate executor (launchpad-specific or standard DEX)
 * 4. Execute swap with retry logic and error handling
 * 5. Return unified result format
 */

// CONTEXT MEMORY
// Updated: 2026-04-15
// Author: Rowan
// Reason: BSC four.meme pre-launch mirror sells were allowed to share the same
//         fallback vocabulary as buy-side launchpad routing. That made the sell
//         owner boundary ambiguous: a direct bonding-curve sell failure could
//         still drift toward standard aggregator routing even when the token had
//         not graduated to DEX liquidity. Later runtime logs showed the opposite
//         failure after graduation: direct-only TP exits kept retrying the
//         bonding-curve path after Four.Meme explicitly said to use an aggregator.
//         A later buy-side incident showed pre-graduation four.meme launches
//         could still fall through to standard EVM routing after a bonding-curve
//         slippage revert, even though no DEX pool existed yet.
//         A follow-up runtime gap then showed `main-swap-finish` still logging
//         `executionProvider=null` because the resolved result provider was not
//         being written back into the main runtime owner.
// Goal: preserve launchpad-aware routing so four.meme sell flows stay on the
//       launchpad path until graduation is explicitly proven, four.meme buy
//       flows also stay launchpad-owned before graduation, then switch to
//       the single supported EVM aggregator path, with runtime logs preserving
//       the actual provider that won.
// Owns: unified swap route selection, launchpad specialization, and launchpad
//       fallback eligibility for EVM and Solana swaps.
// Does Not Own: copytrade exit attempt sequencing, token launchpad detection
//               storage, or aggregator quote policy outside the chosen route.
// Design Language:
// - four.meme buy-side pre-graduation failures must not fall through to 0x
// - four.meme sell-side pre-graduation failures must not fall through to 0x
// - four.meme fallback to standard EVM routing requires explicit graduation proof (`Liquidity already added`, `Use aggregator`, `graduated`)
// - launchpad fallback rules must distinguish buy and sell semantics
// - main runtime snapshots must carry the winning provider from the finalized result
// Document Provenance:
// - Source: production log `logs.1776101245961.json`
// - Kind: runtime observation
// - Retrieved: 2026-04-14
// - Applied To: forbidding four.meme sell fallback to standard EVM swap after launchpad revert
// - Verification: verified in runtime and targeted tests
// - Source: /Users/almurat/Downloads/logs.1776169106790.json
// - Kind: runtime observation
// - Retrieved: 2026-04-14
// - Applied To: allowing four.meme sell fallback only after explicit graduated/liquidity-added evidence
// - Verification: verified in logs and targeted tests
// - Source: /Users/almurat/Downloads/logs.1776170065564.json
// - Kind: runtime observation
// - Retrieved: 2026-04-14
// - Applied To: persisting fallback provider into `main-swap-finish` executionProvider
// - Verification: verified in logs and targeted tests
// - Source: /Users/almurat/Downloads/logs.1776245404831.json
// - Kind: runtime observation
// - Retrieved: 2026-04-15
// - Applied To: forbidding four.meme buy fallback to standard EVM routing after pre-graduation slippage revert
// - Verification: verified in runtime logs, local quote/pool repro, and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/copytrade-race-recovery.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-14-copytrade-bsc-fourmeme-direct-only-exit.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-fourmeme-buy-pregraduation-fallback-prohibition.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { SOLANA_CONFIG } from '../config/solanaConfig.js';
import { getChainConfig } from '../config/chainConfig.js';
import { SwapExecutor, SwapParams, SwapResult } from './swap/SwapExecutor.js';
import { detectLaunchpadToken } from './ai/launchpadDetector.js';

import { zoraSniperService, ZoraSniperService } from './zoraSniperService.js';
import { fourMemeSwapService } from './fourMemeSwapService.js';
import { SolanaLaunchpadSwapService } from './solanaLaunchpadSwapService.js';
import { buildSolanaDirectRequest, executeSolanaDirectLaunchpad } from './solana/direct/router.js';
import { getTokenInfo } from './tokenService.js';
import { getPlatformFee, isValidEvmAddress, type FeeContext } from './platformFeeService.js';
import {
  getUsableNativeBalanceEvidence,
  nativeBalanceEvidenceToBigInt,
  type NativeBalanceEvidence
} from './swap/nativeBalanceEvidence.js';
import {
  buildDirectSwapFeeSettlement,
  collectDirectSwapFeeFromSettlement,
  type DirectSwapFeeSettlement
} from './swap/fee/directSwapFeeCollector.js';
import {
  buildBuyFeeApplicationFromDirectSettlement,
  buildInlineAggregatorBuyFeeApplication,
  type BuyFeeApplication,
} from './swap/fee/buyFeeApplication.js';
import { NATIVE_TOKEN_ADDRESS, SOLANA_NATIVE_MINT, isNativeToken } from '../config/tokenRegistry.js';
import { toWei } from './zeroEx.js';
import { ethers } from 'ethers';
import { TradeContext, getTradeContext } from './TradeContext.js';
import { getTokenData } from './UnifiedDataLayer.js';
import { executeDirectSwap, isDirectSwapSupported } from './dex/directSwapService.js';
import { callRpc, diffRpcMethodUsageSnapshots, getChainRpcDegradeState, getNativeBalance, getRpcMethodUsageSnapshot, getTxLifecycleState, waitForReceiptStateMachine } from './rpcManager.js';
import { resolveTokenAddress, normalizeTokenAddress } from './tokens.js';
import { sendTransaction } from './privyWallet.js';
import { isPostBuyPreApprovalEnabled } from './swapPreApprovalPolicy.js';
import type { CopyTradeExecutionMode } from './copyTradeExecutionMode.js';
import type { TxLifecycleResult } from './txLifecycle.js';
import type { OrderRuntimeContext } from './order-runtime/types.js';
import {
  createOrderRuntimeContext,
  attachOrderTxHash,
  markOrderFallbackResult,
  markOrderFallbackStarted,
  markOrderFailure,
  setOrderMetadata
} from './order-runtime/context.js';
import { logOrderRuntimeSnapshot } from './order-runtime/sinks/logger.js';
import { inferOrderReasonCode } from './order-runtime/reasonCodes.js';
import { resolveTxFinalState } from './order-runtime/adjudicator/finalState.js';
import { describeVisibilityFailure, shouldPassVisibilityGate } from './rpc/visibilityPolicy.js';

function hasFourMemeGraduationProof(error: unknown): boolean {
  const message = String(error || '').toLowerCase();
  if (!message) return false;
  return (
    message.includes('liquidity already added to dex')
    || message.includes('use aggregator instead')
    || message.includes('graduated')
  );
}
import { evaluateCopytradeBuyAcceptedInflight } from './copytrade-v2/buy/copytradeBuyAcceptedInflight.js';
import { evaluateCopytradeBuyAdmission } from './copytrade-v2/buy/buyAdmissionGuard.js';
import { evaluateCopytradeBuySendState } from './copytrade-v2/buy/copytradeBuySendState.js';
import type { ExecutionPlanV1, ReplayDriftDiagnosis, ReplayPrecheckResult } from './copytrade-v2/planner/types.js';
import { isP2ExecutorEnabled, isP2SampleLearningEnabled, isP2ShadowRunEnabled } from './copytrade-v2/planner/featureFlags.js';
import {
  buildPlanCalldata,
  buildPlanValue,
  diagnoseReplayDrift,
  isSourceReplayPlan,
  precheckReplaySell,
  simulatePlan
} from './copytrade-v2/planner/shadowRunner.js';
import { recordPlanRun, recordSuccessSample } from './copytrade-v2/planner/sampleLibrary.js';
import type { SwapExecutionContextV1 } from './copytrade-v2/context/types.js';
import { buildDirectSwapHintFromContext } from './copytrade-v2/context/contextStore.js';
import { TRADE_VISIBILITY_PROFILE } from './rpc/profile.js';

/**
 * Swap execution mode to determine behavior and fee structure
 */
export type SwapMode = 'fast-swap' | 'swap-card' | 'allowance' | 'copytrade' | 'launchpad';
export type ExecutionSource = 'chat' | 'wallet_page' | 'copytrade' | 'system';
export type RoutePolicy = 'external_only' | 'legacy_allowed';

export interface DirectSwapRouteHop {
  kind: 'v4' | 'v3' | 'v2' | 'aerodrome' | 'infinity';
  dex?: 'uniswap' | 'pancake' | 'aerodrome' | 'pancake-infinity';
  poolAddress?: string;
  tokenIn?: string;
  tokenOut?: string;
  fee?: number;
}

export interface DirectSwapHint {
  sourceDexName?: string;
  sourceRouter?: string;
  sourceTxHash?: string;
  sourceTokenIn?: string;
  sourceTokenOut?: string;
  sourceAmountIn?: string;
  sourceAmountOut?: string;
  routeHopCount?: number;
  routeHops?: DirectSwapRouteHop[];
  canUseResolvedPoolFastPath?: boolean;
  resolvedPoolHint?: {
    kind: 'v4' | 'v3' | 'v2' | 'aerodrome';
    dex?: 'uniswap' | 'pancake' | 'aerodrome' | 'pancake-infinity';
    poolAddress?: string;
    fee?: number;
    v4PoolKey?: {
      currency0: string;
      currency1: string;
      hooks: string;
      poolManager: string;
      fee: number;
      tickSpacing: number;
    };
  };
  preferredStrategy?: 'v4' | 'v3' | 'v2' | 'aerodrome' | 'infinity' | 'zora-sdk' | 'virtual-bridge';
  preferredDex?: 'uniswap' | 'pancake' | 'aerodrome' | 'pancake-infinity';
  bypassReferencePrice?: boolean;
}

export type QuoteDex = '0x';

export interface CopytradeFallbackPricingGuardContext {
  stage: '0x_fallback';
  targetExecutionPrice?: number;
  referencePrice?: number;
  referencePriceSource?: 'market_oracle_price' | 'local_quote_price' | 'reference_unavailable';
  maxEntryDeviationBps?: number;
  thresholdSource?: string;
  thresholdReasonCode?: string;
  thresholdPolicy?: string;
  modeFloorBps?: number | null;
  inputValueUsd?: number;
  allowUnreliablePriceBypass?: boolean;
}

export type { NativeBalanceEvidence };

/**
 * Unified swap request accepted by MainSwapService
 */
export interface MainSwapRequest {
  // Identity
  userId: string;
  walletAddress: string;
  accessToken?: string;

  // Tokens
  tokenIn: string; // Address or symbol (e.g., "ETH", "0x...")
  tokenOut: string;
  amountIn: string; // Human readable (e.g., "0.1")

  // Chain & Context
  chainId: number; // 900 = Solana, others = EVM
  slippageBps?: number; // Default: user setting or 50 (0.5%)

  // Execution Mode (determines fee structure and behavior)
  mode: SwapMode; // 'fast-swap' | 'swap-card' | 'allowance' | 'copytrade' | 'launchpad'
  executionSource?: ExecutionSource;
  routePolicy?: RoutePolicy;

  // Optional fee override (bps). Used for per-order copytrade fee tiering.
  feeBpsOverride?: number;

  // Transaction tracking (for WebSocket updates)
  messageId?: string; // Chat message ID for real-time progress updates

  // User Settings
  userSettings?: {
    swapMethod?: 'allowance_trade' | 'wallet_sign';
    fastSwapMode?: boolean;
    copyTradeExecutionMode?: CopyTradeExecutionMode;
    disableTokenInfo?: boolean;
    quickSwapMode?: boolean;
    mevProtection?: boolean;
  };

  // Launchpad-specific
  launchpadProvider?: 'pumpfun' | 'pumpswap' | 'bonkfun' | 'zora' | 'fourmeme' | 'flap' | 'clanker' | 'virtuals' | 'doppler' | 'flaunch' | 'creatorbid';

  // Copytrade execution hint from target wallet decoded tx
  directSwapHint?: DirectSwapHint;
  allowedDexes?: QuoteDex[];
  zeroExQuoteTimeoutMs?: number;
  preferredDexes?: QuoteDex[];
  // CONTEXT MEMORY
  // Updated: 2026-04-13
  // Author: Mira Chen
  // Reason: Copytrade request normalization must preserve upstream hot-path ownership signals instead of re-expanding them into duplicate slow reads or token-info hydration.
  // Goal: Carry validated native balance evidence and disable-token-info intent into swap execution while preserving MainSwap as the request-normalization boundary.
  // Owns: Passing execution-context evidence and user execution hints to precheck and SwapExecutor.
  // Does Not Own: Fetching wallet portfolio balances, deciding gas-buffer thresholds, or resolving heavy token metadata on behalf of turbo copytrade buy.
  // Design Language:
  // - Reuse upstream guard evidence when it is fresh and wallet/chain scoped.
  // - Treat portfolio hydration and token-info hydration as optional outer-layer context, not as mandatory hot-path execution dependencies.
  // - QuoteDex and dex allowlists are 0x-only; removed aggregators must fail fast.
  // - Forbidden local patch patterns: adding timeout-only wrappers around duplicate reads instead of passing evidence and mode intent.
  // Document Provenance:
  // - Source: /Users/almurat/Downloads/logs.1775999977570.json
  // - Kind: runtime observation
  // - Retrieved: 2026-04-13
  // - Applied To: copytrade MainSwap request evidence propagation and disable-token-info handoff
  // - Verification: verified in runtime logs and local reproduction
  // See also:
  // - system-journal/INDEX.md
  // - system-journal/design-language/copytrade-race-recovery.md
  // - system-journal/owner-map/backend-swap-validation.md
  // - system-journal/fix-log/2026-04-13-copytrade-native-balance-evidence.md
  // - system-journal/fix-log/2026-04-13-copytrade-turbo-tokeninfo-bypass.md
  executionContext?: {
    sourceTxHash?: string;
    sourceRouter?: string;
    sourceTxInput?: string;
    sourceTxValue?: string;
    executionStep?: string;
    sellRoutePolicy?: 'external_primary' | 'direct_primary' | 'direct_only';
    sourceTokenIn?: string;
    sourceTokenOut?: string;
    sourceAmountIn?: string;
    sourceAmountOut?: string;
    contextId?: string;
    contextSnapshot?: SwapExecutionContextV1;
    contextHitSource?: 'redis' | 'db' | 'inline' | 'miss';
    strictReplica?: boolean;
    copytradeFallbackPricingGuard?: CopytradeFallbackPricingGuardContext;
    nativeBalanceEvidence?: NativeBalanceEvidence;
    copytradePendingPositionId?: string;
    copytradeUserId?: string;
  };
  executionPlan?: ExecutionPlanV1;
  runtimeContext?: OrderRuntimeContext;

  // When true, do not report success until a confirmed successful receipt is observed.
  // Used by position exits to prevent false "sold" states on later reverts.
  requireConfirmedTx?: boolean;

  // Optional pre-warmed nonce promise (copy-trade: start fetch in parallel with quoting).
  preWarmedNonce?: Promise<string | undefined>;
}

/**
 * Unified swap result returned by MainSwapService
 */
export interface MainSwapResult {
  success: boolean;
  txHash?: string;
  amountOut?: string;
  error?: string;
  reasonCode?: string;
  userMessage?: string;
  routePolicy?: RoutePolicy;
  txLifecycle?: TxLifecycleResult;
  runtimeContext?: OrderRuntimeContext;
  metadata: {
    provider: string; // '0x', 'jupiter', 'clanker', 'zora', etc.
    mode: SwapMode;
    priceImpact?: number;
    gasUsed?: string;
    launchpad?: string; // Set if launchpad swap
    txLifecycleStatus?: TxLifecycleResult['status'];
    directFeeSettlement?: DirectSwapFeeSettlement;
    buyFeeApplication?: BuyFeeApplication;
  };
}

export function txLifecycleFromExecutionFinality(params: {
  finalityState?: SwapResult['finalityState'];
  txHash?: string;
  chainId: number;
}): TxLifecycleResult | undefined {
  if (params.finalityState === 'confirmed_success') {
    return {
      status: 'confirmed_success',
      txHash: params.txHash,
      confirmedAt: Date.now(),
      attempts: 1,
      chainId: params.chainId,
    };
  }
  if (params.finalityState === 'confirmed_failed') {
    return {
      status: 'confirmed_failed',
      txHash: params.txHash,
      confirmedAt: Date.now(),
      attempts: 1,
      chainId: params.chainId,
    };
  }
  return undefined;
}

export function shouldDeferAcceptedCopytradeBuyFeeCollection(params: {
  isTurboCopytrade: boolean;
  mode: SwapMode;
  isBuyDirection: boolean;
  chainId: number;
  txHash?: string | null;
  runtimeContext?: OrderRuntimeContext | null;
  lifecycle?: TxLifecycleResult | null;
}): boolean {
  if (!params.isTurboCopytrade || params.mode !== 'copytrade' || !params.isBuyDirection) {
    return false;
  }

  const runtimeState = String(params.runtimeContext?.state || '').trim().toLowerCase();
  const lifecycleStatus = String(params.lifecycle?.status || '').trim().toLowerCase();
  if (
    lifecycleStatus === 'broadcasted_unseen'
    || runtimeState === 'send_started'
    || runtimeState === 'hash_accepted'
    || runtimeState === 'rpc_uncertain'
  ) {
    return true;
  }

  const resolution = resolveTxFinalState({
    runtimeContext: params.runtimeContext || undefined,
    lifecycle: params.lifecycle || undefined,
    chainId: params.chainId,
    txHash: params.txHash || params.runtimeContext?.canonicalTxHash,
  });

  return resolution.accepted && !resolution.visible && !resolution.success;
}

export function inferSwapReasonCode(message?: string): string {
  const normalized = String(message || '').toLowerCase();
  if (!normalized) return 'swap_failed';
  if (
    normalized.includes('permit2 quote is missing the required typed signature')
    || normalized.includes('required typed signature')
    || normalized.includes('invalid_permit2_signature')
    || normalized.includes('invalid_calldata_for_permit2')
    || normalized.includes('permit2_deadline_')
  ) return 'approval_signature_missing';
  if (
    normalized.includes('approved spender no longer matches')
    || normalized.includes('quote changed after approval')
    || normalized.includes('explicit approval quote')
  ) return 'approval_quote_mismatch';
  if (
    normalized.includes('access-control-allow-origin')
    || normalized.includes('cors')
    || normalized.includes('bad gateway')
    || normalized.includes('gateway')
    || normalized.includes('load failed')
    || normalized.includes('failed to fetch')
    || normalized.includes('502')
  ) return 'gateway_unavailable';
  if (normalized.includes('transaction reverted') || normalized.includes(' reverted')) return 'execution_reverted';
  if (
    normalized.includes('all rpc endpoints failed')
    || normalized.includes('http 401')
    || normalized.includes('http 403')
    || normalized.includes('unauthorized')
    || normalized.includes('forbidden')
  ) return 'rpc_unavailable';
  if (normalized.includes('route policy')) return 'fallback_blocked';
  if (normalized.includes('no route') || normalized.includes('no liquidity') || normalized.includes('liquidity')) return 'quote_unavailable';
  if (normalized.includes('unsupported')) return 'unsupported_token_or_chain';
  if (normalized.includes('invalid evm token') || normalized.includes('invalid address')) return 'invalid_token';
  if (
    (normalized.includes('allowance') || normalized.includes('approval'))
    && !normalized.includes('approval quote')
  ) return 'approval_required';
  if (normalized.includes('insufficient')) return 'insufficient_balance';
  if (normalized.includes('slippage')) return 'slippage_exceeded';
  return 'execution_rejected';
}

export function buildUserFacingSwapError(message?: string, routePolicy?: RoutePolicy): string {
  const reasonCode = inferSwapReasonCode(message);
  switch (reasonCode) {
    case 'approval_signature_missing':
      return 'The quote required a Permit2 signature, but that authorization payload was incomplete. No swap transaction was sent.';
    case 'approval_quote_mismatch':
      return 'The swap route changed after token approval, so no swap transaction was sent. Please retry with a fresh quote.';
    case 'approval_required':
      return 'Token approval did not complete, so the swap transaction was not sent.';
    case 'gateway_unavailable':
      return 'The swap request was blocked by the API gateway or CORS layer before execution status could be read. Please retry shortly.';
    case 'execution_reverted':
      return 'The swap transaction reverted on-chain before settlement.';
    case 'rpc_unavailable':
      return 'Trade execution RPC is temporarily unavailable on this chain. Please retry shortly.';
    case 'fallback_blocked':
      return 'The external aggregator could not execute this trade, and internal fallback is disabled for chat trades.';
    case 'quote_unavailable':
      return routePolicy === 'external_only'
        ? 'No executable route is available from the external aggregator for this trade.'
        : 'No executable route is available for this trade.';
    case 'unsupported_token_or_chain':
      return 'This token or chain is not supported for this trade path.';
    case 'invalid_token':
      return 'One of the swap tokens could not be resolved into a valid tradable address.';
    case 'insufficient_balance':
      return 'Insufficient balance to complete this trade.';
    case 'slippage_exceeded':
      return 'The trade failed because price movement exceeded the allowed slippage.';
    default:
      return 'The trade could not be executed.';
  }
}

export async function verifyNativeBalancePrecheck(params: {
  chainId: number;
  walletAddress: string;
  amountIn: string;
  gasReserve: string;
  getNativeBalanceFn?: typeof getNativeBalance;
  nativeBalanceEvidence?: NativeBalanceEvidence;
  onBypass?: (error: unknown) => void;
}): Promise<void> {
  const readNativeBalance = params.getNativeBalanceFn || getNativeBalance;
  try {
    const amountInWei = ethers.parseUnits(params.amountIn, 18);
    const reserveWei = ethers.parseUnits(params.gasReserve || '0', 18);
    const evidence = getUsableNativeBalanceEvidence({
      evidence: params.nativeBalanceEvidence,
      chainId: params.chainId,
      walletAddress: params.walletAddress,
    });
    const balanceWei = evidence
      ? nativeBalanceEvidenceToBigInt(evidence)
      : BigInt(await readNativeBalance(params.walletAddress, params.chainId, 'latest', { lane: 'cheap' }));
    const requiredWei = amountInWei + reserveWei;
    if (balanceWei < requiredWei) {
      throw new Error(
        `insufficient_native_balance_precheck: have=${ethers.formatEther(balanceWei)} required=${ethers.formatEther(requiredWei)}`
      );
    }
  } catch (error) {
    if (String((error as Error)?.message || '').includes('insufficient_native_balance_precheck')) {
      throw error;
    }
    params.onBypass?.(error);
  }
}

type TurboDirectFailureReason = 'budget_timeout' | 'visibility_timeout' | 'send_failure' | 'route_failure' | null;

function isTurboCopytradeNonRecoverableValidationFailure(message?: string | null): boolean {
  const normalized = String(message || '').toLowerCase();
  if (!normalized) return false;
  return [
    'clanker_gate:',
    'clanker_force_v4_failed',
    'unsupported_v4_hook',
    'invalid evm token',
    'invalid address',
    'amountin must be > 0',
    'route policy',
    'chain_not_supported',
    'unsupported_direction',
    'missing wallet',
    'missing auth',
    'missing context',
    'insufficient balance',
    'insufficient funds',
    'approval',
    'allowance',
  ].some((pattern) => normalized.includes(pattern));
}

function resolveTurboCopytrade0xFallbackPlan(params: {
  isTurboCopytrade: boolean;
  isBuyDirection: boolean;
  directFailureReason: TurboDirectFailureReason;
  directFailureMessage?: string | null;
  acceptedDirectEvidence: boolean;
  hasGuardContext: boolean;
  skipExternalFallback: boolean;
  skipNoLiquidity: boolean;
}): {
  shouldFallback: boolean;
  reasonCode: string;
  fallbackBudgetMs?: number;
  quoteTimeoutMs?: number;
  providerTag?: 'aggregator_fallback_0x_turbo';
} {
  if (!params.isTurboCopytrade || !params.isBuyDirection) {
    return { shouldFallback: false, reasonCode: 'not_turbo_copytrade_buy' };
  }
  if (params.acceptedDirectEvidence) {
    return { shouldFallback: false, reasonCode: 'accepted_direct_tx' };
  }
  if (params.skipExternalFallback) {
    return { shouldFallback: false, reasonCode: 'external_fallback_disabled' };
  }
  if (params.skipNoLiquidity) {
    return { shouldFallback: false, reasonCode: 'liquidity_guard_reject_all' };
  }
  if (!params.hasGuardContext) {
    return { shouldFallback: false, reasonCode: 'missing_copytrade_guard_context' };
  }
  if (isTurboCopytradeNonRecoverableValidationFailure(params.directFailureMessage)) {
    return { shouldFallback: false, reasonCode: 'non_recoverable_validation' };
  }

  const recoverableReasons = new Set<TurboDirectFailureReason>([
    'budget_timeout',
    'visibility_timeout',
    'send_failure',
    'route_failure',
  ]);
  if (!recoverableReasons.has(params.directFailureReason)) {
    return { shouldFallback: false, reasonCode: 'direct_failure_not_recoverable' };
  }

  const fallbackBudgetMs = Math.max(250, Number(process.env.COPYTRADE_TURBO_0X_FALLBACK_BUDGET_MS || 2500));
  const configuredQuoteTimeoutMs = Math.max(150, Number(process.env.COPYTRADE_TURBO_0X_FALLBACK_QUOTE_TIMEOUT_MS || 1800));
  const quoteTimeoutMs = Math.max(150, Math.min(configuredQuoteTimeoutMs, fallbackBudgetMs));

  return {
    shouldFallback: true,
    reasonCode: params.directFailureReason || 'recoverable_direct_failure',
    fallbackBudgetMs,
    quoteTimeoutMs,
    providerTag: 'aggregator_fallback_0x_turbo',
  };
}

export const __testOnly = {
  resolveTurboCopytrade0xFallbackPlan,
};

/**
 * Launchpad token detection result
 */
interface LaunchpadDetection {
  provider: 'pumpfun' | 'pumpswap' | 'bonkfun' | 'zora' | 'fourmeme' | 'flap' | 'clanker' | 'virtuals' | 'doppler' | 'flaunch' | 'creatorbid';
  data: any;
  chainId: number;
}

function isCashLikeToken(token: string, chainId: number): boolean {
  const normalized = String(token || '').trim().toLowerCase();
  if (!normalized) return false;

  if (isNativeToken(normalized, chainId)) return true;

  const chainConfig = getChainConfig(chainId);
  const cashAddresses = [
    chainConfig.wrappedNativeAddress,
    ...(chainConfig.stablecoins || [])
  ]
    .map((a) => String(a || '').toLowerCase())
    .filter(Boolean);

  if (cashAddresses.includes(normalized)) return true;

  // Accept common symbols when callers pass symbol form instead of address.
  return normalized === 'weth' || normalized === 'usdc' || normalized === 'usdt';
}

/**
 * Main Swap Service - Core unified swap execution
 */
export class MainSwapService {
  private static readonly TRACE_PREFIX = '[MainSwapService]';
  private static readonly directSwapInflight = new Map<string, Promise<Awaited<ReturnType<typeof executeDirectSwap>>>>();

  private static buildDirectSwapInflightKey(
    request: MainSwapRequest,
    tokenIn: string,
    tokenOut: string,
    amountOverride?: string
  ): string {
    const amount = amountOverride ?? request.amountIn;
    return [
      request.userId,
      request.chainId,
      tokenIn.toLowerCase(),
      tokenOut.toLowerCase(),
      amount,
      request.mode
    ].join(':');
  }

  private static getOrCreateDirectSwapInflight(
    key: string,
    producer: () => Promise<Awaited<ReturnType<typeof executeDirectSwap>>>
  ): Promise<Awaited<ReturnType<typeof executeDirectSwap>>> {
    const existing = this.directSwapInflight.get(key);
    if (existing) {
      logger.info(LogCode.SYS_INFO, '[MainSwapService] Reusing in-flight direct swap', {
        inflightKey: key.slice(0, 48)
      });
      return existing;
    }

    const task = producer().finally(() => {
      const current = this.directSwapInflight.get(key);
      if (current === task) this.directSwapInflight.delete(key);
    });
    this.directSwapInflight.set(key, task);
    return task;
  }

  private static normalizeEvmTokenInput(token: string, chainId: number): string {
    const resolved = resolveTokenAddress(token, chainId);
    const normalized = normalizeTokenAddress(resolved);

    if (isNativeToken(normalized, chainId)) return NATIVE_TOKEN_ADDRESS;

    if (/^0x[0-9a-fA-F]{40}$/.test(normalized)) {
      try {
        return ethers.getAddress(normalized);
      } catch {
        return normalized.toLowerCase();
      }
    }

    return normalized;
  }

  private static async collectDirectSwapFeeSettlement(
    settlement: DirectSwapFeeSettlement,
    request: MainSwapRequest,
    trace: (msg: string) => string
  ): Promise<void> {
    await collectDirectSwapFeeFromSettlement({
      userId: request.userId,
      settlement,
      trace
    });
  }

  /**
   * Execute a swap with full routing and error handling
   * This is the single entry point for all swap operations
   */
  static async executeSwap(request: MainSwapRequest, tradeContext?: TradeContext): Promise<MainSwapResult> {
    const traceId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const trace = (msg: string) => `${this.TRACE_PREFIX}[${traceId}] ${msg}`;
    const routePolicy: RoutePolicy = request.routePolicy || 'legacy_allowed';
    request.routePolicy = routePolicy;

    // ⚡ Get or create TradeContext for cached data access
    const ctx = tradeContext || TradeContext.create({
      userId: request.userId,
      walletAddress: request.walletAddress,
      chainId: request.chainId,
    });

    logger.info(LogCode.EXE_TX_BROADCAST, trace('Starting unified swap execution'), {
      mode: request.mode,
      executionSource: request.executionSource || 'system',
      routePolicy,
      tokenIn: request.tokenIn.slice(0, 12),
      tokenOut: request.tokenOut.slice(0, 12),
      amount: request.amountIn,
      chainId: request.chainId,
      tradeContextId: ctx.id
    });

    try {
      // 1. INPUT VALIDATION
      this.validateRequest(request);
      const runtimeContext = request.runtimeContext || createOrderRuntimeContext({
        userId: request.userId,
        chainId: request.chainId,
        walletAddress: request.walletAddress,
        mode: request.mode,
        side: isCashLikeToken(request.tokenIn, request.chainId)
          ? 'buy'
          : isCashLikeToken(request.tokenOut, request.chainId)
            ? 'sell'
            : 'unknown',
        sourceTxHash: request.executionContext?.sourceTxHash || request.executionContext?.contextSnapshot?.sourceTxHash,
        tokenIn: request.tokenIn,
        tokenOut: request.tokenOut,
        metadata: {
          traceId
        }
      });
      request.runtimeContext = runtimeContext;
      setOrderMetadata(runtimeContext, {
        slippageBps: request.slippageBps ?? null,
        mode: request.mode,
        copytradePendingPositionId: request.executionContext?.copytradePendingPositionId || null,
      });
      const finalizeResult = (result: MainSwapResult): MainSwapResult => {
        const resolvedRuntime = result.runtimeContext || runtimeContext;
        if (result.metadata?.provider) {
          resolvedRuntime.route = {
            ...resolvedRuntime.route,
            provider: result.metadata.provider,
          };
        }
        if (result.txHash) {
          attachOrderTxHash(resolvedRuntime, result.txHash, { canonical: true });
        }
        const enriched: MainSwapResult = {
          ...result,
          runtimeContext: resolvedRuntime
        };
        if (!enriched.success && enriched.error) {
          markOrderFailure(runtimeContext, enriched.error);
        }
        logOrderRuntimeSnapshot(runtimeContext, '[OrderRuntime] main-swap-finish');
        return enriched;
      };

      // 2. DETERMINE FEE CONTEXT based on mode
      const feeContext = this.determineFeeContext(request.mode);

      // 3. CHAIN DETECTION
      const isSolana = request.chainId === SOLANA_CONFIG.CHAIN_ID;
      const isEvm = !isSolana;

      const isCopytrade = request.mode === 'copytrade';
      const isTurboCopytrade = isCopytrade && request.userSettings?.copyTradeExecutionMode === 'turbo';

      // 4. LAUNCHPAD DETECTION (EVM only)
      // DISABLED: ClankerService not ready - use standard DEX (0x) for all tokens
      if (isEvm && !request.launchpadProvider && !isCopytrade && routePolicy !== 'external_only') {
        try {
          // Check both tokenOut (for BUY) and tokenIn (for SELL)
          const launchpadDetection = await this.detectLaunchpad(request.tokenOut, request.chainId)
            || await this.detectLaunchpad(request.tokenIn, request.chainId);

          if (
            launchpadDetection &&
            launchpadDetection.provider !== 'clanker' &&
            launchpadDetection.provider !== 'flap' &&
            launchpadDetection.provider !== 'doppler' &&
            launchpadDetection.provider !== 'flaunch' &&
            launchpadDetection.provider !== 'creatorbid'
          ) {
            // Use launchpad routing only for providers that still require
            // specialized execution. Four.meme now routes through standard DEX
            // paths for both pre- and post-graduation tokens.
            logger.info(LogCode.SYS_INFO, trace(`Launchpad detected: ${launchpadDetection.provider}`), {
              provider: launchpadDetection.provider,
              chainId: launchpadDetection.chainId
            });
            request.launchpadProvider = launchpadDetection.provider as any;
          } else if (
            launchpadDetection?.provider === 'clanker' ||
            launchpadDetection?.provider === 'flap' ||
            launchpadDetection?.provider === 'doppler' ||
            launchpadDetection?.provider === 'flaunch' ||
            launchpadDetection?.provider === 'creatorbid'
          ) {
            // These platforms are currently detected-only and route through standard DEX path.
            logger.info(LogCode.SYS_INFO, trace(`${launchpadDetection.provider} token detected - routing to standard DEX (0x)`));
          }
        } catch (detectErr: any) {
          logger.warn(LogCode.SYS_ERROR, trace(`Launchpad detection failed: ${detectErr.message}`), {
            error: detectErr.message
          });
          // Continue with standard routing if detection fails
        }
      } else if (isEvm && isCopytrade) {
        logger.debug(LogCode.SYS_INFO, trace('Copytrade: skip launchpad detection on critical path'), {
          chainId: request.chainId,
          tokenIn: request.tokenIn,
          tokenOut: request.tokenOut
        });
      } else if (isEvm && routePolicy === 'external_only') {
        logger.info(LogCode.SYS_INFO, trace('Skipping launchpad detection due to external-only route policy'), {
          executionSource: request.executionSource || 'system',
          routePolicy,
          chainId: request.chainId,
          tokenIn: request.tokenIn,
          tokenOut: request.tokenOut
        });
      }

      // 5. ROUTE TO APPROPRIATE EXECUTOR
      if (request.mode === 'copytrade' && request.executionPlan) {
        return finalizeResult(await this.executePlannedSwap(request, feeContext, trace, ctx));
      }
      if (request.launchpadProvider) {
        return finalizeResult(await this.executeLaunchpadSwap(request, feeContext, trace, ctx));
      } else if (isSolana) {
        return finalizeResult(await this.executeSolanaSwap(request, feeContext, trace, ctx));
      } else {
        return finalizeResult(await this.executeEvmSwap(request, feeContext, trace, ctx));
      }

    } catch (error: any) {
      logger.error(LogCode.EXE_TX_REVERTED, trace(`Swap execution failed: ${error.message}`), {
        error: error.message,
        stack: error.stack?.split('\n')[0]
      });

      if (request.runtimeContext) {
        markOrderFailure(request.runtimeContext, error.message || 'Unknown error during swap execution');
        logOrderRuntimeSnapshot(request.runtimeContext, '[OrderRuntime] main-swap-error');
      }
      return {
        success: false,
        error: error.message || 'Unknown error during swap execution',
        reasonCode: inferSwapReasonCode(error.message),
        userMessage: buildUserFacingSwapError(error.message, routePolicy),
        routePolicy,
        runtimeContext: request.runtimeContext,
        metadata: {
          provider: 'unknown',
          mode: request.mode
        }
      };
    }
  }

  private static async executePlannedSwap(
    request: MainSwapRequest,
    feeContext: FeeContext,
    trace: (msg: string) => string,
    ctx: TradeContext
  ): Promise<MainSwapResult> {
    const plan = request.executionPlan!;
    const t0 = Date.now();
    const isTurboCopytrade = request.mode === 'copytrade' && request.userSettings?.copyTradeExecutionMode === 'turbo';
    const p2Mode = isP2ExecutorEnabled() ? 'canary' : 'shadow';
    const sourceTxHash = request.executionContext?.sourceTxHash
      || request.executionContext?.contextSnapshot?.sourceTxHash
      || undefined;
    const isReplay = isSourceReplayPlan(plan);
    const replaySimulationTimeoutMs = Math.max(
      300,
      Number.parseInt(
        String(
          isTurboCopytrade
            ? (process.env.P2_SIM_TIMEOUT_TURBO_MS || '1100')
            : (process.env.P2_SIM_TIMEOUT_MS || '2200')
        ),
        10
      ) || (isTurboCopytrade ? 1100 : 2200)
    );
    const fallbackViaCurrentPath = async (reason: string): Promise<MainSwapResult> => {
      const shouldForceDirectFastPath =
        request.mode === 'copytrade'
        && plan.side === 'buy'
        && isDirectSwapSupported(request.chainId)
        && request.userSettings?.fastSwapMode !== true;
      if (!shouldForceDirectFastPath) {
        return await this.executeEvmSwap(request, feeContext, trace, ctx);
      }
      logger.info(LogCode.SYS_INFO, trace('[P2] Replay fallback enabling direct fast-path probe before external quote'), {
        chainId: request.chainId,
        reason,
        sourceTxHash: sourceTxHash || null
      });
      const patchedRequest: MainSwapRequest = {
        ...request,
        userSettings: {
          ...(request.userSettings || {}),
          fastSwapMode: true
        }
      };
      return await this.executeEvmSwap(patchedRequest, feeContext, trace, ctx);
    };

    let replayPrecheck: ReplayPrecheckResult | undefined;
    let driftDiagnosis: ReplayDriftDiagnosis | undefined;
    let simulation: Awaited<ReturnType<typeof simulatePlan>> | null = null;

    if (isReplay && plan.side === 'sell') {
      replayPrecheck = await precheckReplaySell({
        plan,
        chainId: request.chainId,
        walletAddress: request.walletAddress,
        tokenIn: request.tokenIn,
        amountIn: request.amountIn
      });
      if (!replayPrecheck.ok) {
        await recordPlanRun({
          mode: p2Mode,
          chainId: request.chainId,
          inputJson: JSON.stringify({
            tokenIn: request.tokenIn,
            tokenOut: request.tokenOut,
            amountIn: request.amountIn,
            sourceTxHash: sourceTxHash || null
          }),
          planJson: JSON.stringify(plan),
          scoreJson: JSON.stringify({
            plannerScore: plan.trace?.plannerScore || 0,
            replayPrecheck
          }),
          selectedTemplateId: plan.templateRef?.templateId,
          resultStatus: `replay_precheck_blocked:${replayPrecheck.reason || 'unknown'}`,
          latencyMs: Date.now() - t0
        });
        logger.warn(LogCode.SYS_INFO, trace('[P2] Replay sell precheck blocked planned replay path'), {
          chainId: request.chainId,
          sourceTxHash: sourceTxHash || null,
          reason: replayPrecheck.reason || 'unknown',
          spender: replayPrecheck.spender || null,
          tokenBalance: replayPrecheck.tokenBalance || null,
          requiredAmount: replayPrecheck.requiredAmount || null,
          allowance: replayPrecheck.allowance || null,
          requiredAllowance: replayPrecheck.requiredAllowance || null
        });
        return await fallbackViaCurrentPath(`replay_precheck_blocked:${replayPrecheck.reason || 'unknown'}`);
      }
    }

    if (isP2ShadowRunEnabled()) {
      simulation = await simulatePlan(plan, request.walletAddress, undefined, 'latest', replaySimulationTimeoutMs);
      if (isReplay && !simulation.success) {
        driftDiagnosis = await diagnoseReplayDrift({
          plan,
          walletAddress: request.walletAddress,
          sourceTxHash,
          latestSimulation: simulation,
          simulationTimeoutMs: replaySimulationTimeoutMs
        });
      }
      await recordPlanRun({
        mode: p2Mode,
        chainId: request.chainId,
        inputJson: JSON.stringify({
          tokenIn: request.tokenIn,
          tokenOut: request.tokenOut,
          amountIn: request.amountIn,
          sourceTxHash: sourceTxHash || null
        }),
        planJson: JSON.stringify(plan),
        simulationJson: JSON.stringify(simulation),
        scoreJson: JSON.stringify({
          plannerScore: plan.trace?.plannerScore || 0,
          replayPrecheck,
          driftDiagnosis,
          adapterName: plan.trace?.adapterName || null,
          adapterVersion: plan.trace?.adapterVersion || null
        }),
        selectedTemplateId: plan.templateRef?.templateId,
        resultStatus: simulation.success
          ? 'shadow_sim_pass'
          : `shadow_sim_fail:${driftDiagnosis?.classification || simulation.classificationCode || 'unknown'}`,
        latencyMs: Date.now() - t0
      });
    }

    if (!isP2ExecutorEnabled()) {
      const sourceReplaySimulationPassed = simulation?.success === true;
      const sourceReplaySimulationSkipped = simulation === null;
      const turboBypassSourceReplay = isTurboCopytrade;
      const shouldTrySourceReplay =
        !turboBypassSourceReplay
        &&
        isReplay
        && (sourceReplaySimulationPassed || sourceReplaySimulationSkipped)
        && /^0x[a-fA-F0-9]{40}$/.test(String(plan.templateRef?.router || ''));
      if (turboBypassSourceReplay && isReplay) {
        logger.info(LogCode.SYS_INFO, trace('[P2] Turbo bypass source replay send; fallback to direct/external path immediately'), {
          chainId: request.chainId,
          sourceTxHash: sourceTxHash || null,
          simulationSuccess: simulation?.success ?? null
        });
      }
      if (shouldTrySourceReplay) {
        try {
          const replayValue = buildPlanValue(plan);
          const nativeValue = replayValue !== '0'
            ? replayValue
            : (isNativeToken(request.tokenIn, request.chainId)
              ? ethers.parseUnits(request.amountIn, 18).toString()
              : '0');
          const replayTxHash = await sendTransaction(request.userId, request.accessToken || '', {
            to: plan.templateRef.router,
            data: buildPlanCalldata(plan),
            value: nativeValue,
            chainId: request.chainId,
            nonce: await request.preWarmedNonce,
            txPurpose: 'trade',
            runtimeContext: request.runtimeContext,
            ...(isTurboCopytrade ? { executionProfile: request.chainId === 8453 ? 'base-sniper' : request.chainId === 56 ? 'bsc-sniper' : undefined } : {})
          });
          await recordPlanRun({
            mode: 'canary',
            chainId: request.chainId,
            inputJson: JSON.stringify({
              tokenIn: request.tokenIn,
              tokenOut: request.tokenOut,
              amountIn: request.amountIn,
              sourceTxHash: sourceTxHash || null
            }),
            planJson: JSON.stringify(plan),
            simulationJson: JSON.stringify(simulation),
            scoreJson: JSON.stringify({
              plannerScore: plan.trace?.plannerScore || 0,
              replayPrecheck,
              driftDiagnosis,
              adapterName: plan.trace?.adapterName || null,
              adapterVersion: plan.trace?.adapterVersion || null
            }),
            selectedTemplateId: plan.templateRef?.templateId,
            resultStatus: 'source_replay_tx_sent',
            txHash: replayTxHash,
            latencyMs: Date.now() - t0
          });
          logger.info(LogCode.SYS_INFO, trace('[P2] Source replay sent before external quote fallback'), {
            chainId: request.chainId,
            sourceTxHash: sourceTxHash || null,
            replayTxHash,
            simulationStatus: sourceReplaySimulationPassed ? 'passed' : 'skipped'
          });
          return {
            success: true,
            txHash: replayTxHash,
            runtimeContext: request.runtimeContext,
            metadata: {
              provider: 'p2-source-replay',
              mode: request.mode
            }
          };
        } catch (replayError: any) {
          const finalizeReplayFailureTelemetry = async () => {
            if (isReplay) {
              driftDiagnosis = await diagnoseReplayDrift({
                plan,
                walletAddress: request.walletAddress,
                sourceTxHash,
                latestSimulation: simulation,
                sendFailed: true,
                simulationTimeoutMs: replaySimulationTimeoutMs
              });
            }
            await recordPlanRun({
              mode: 'canary',
              chainId: request.chainId,
              inputJson: JSON.stringify({
                tokenIn: request.tokenIn,
                tokenOut: request.tokenOut,
                amountIn: request.amountIn,
                sourceTxHash: sourceTxHash || null
              }),
              planJson: JSON.stringify(plan),
              simulationJson: JSON.stringify(simulation),
              scoreJson: JSON.stringify({
                plannerScore: plan.trace?.plannerScore || 0,
                replayPrecheck,
                driftDiagnosis,
                adapterName: plan.trace?.adapterName || null,
                adapterVersion: plan.trace?.adapterVersion || null
              }),
              selectedTemplateId: plan.templateRef?.templateId,
              resultStatus: `source_replay_send_fail:${driftDiagnosis?.classification || 'unknown'}`,
              latencyMs: Date.now() - t0
            });
          };
          if (isTurboCopytrade) {
            void finalizeReplayFailureTelemetry().catch(() => { });
          } else {
            await finalizeReplayFailureTelemetry();
          }
          logger.warn(LogCode.SYS_INFO, trace('[P2] Source replay failed, falling back to external quote path'), {
            chainId: request.chainId,
            error: replayError?.message || String(replayError),
            sourceTxHash: sourceTxHash || null,
            driftClassification: driftDiagnosis?.classification || null,
            driftReasonCode: driftDiagnosis?.reasonCode || null
          });
        }
      }
      logger.info(LogCode.SYS_INFO, trace('[P2] Planned swap shadow mode, fallback to current execution path'), {
        chainId: request.chainId,
        templateId: plan.templateRef?.templateId,
        simulationSuccess: simulation?.success ?? null
      });
      return await fallbackViaCurrentPath('planned_shadow_fallback');
    }

    logger.info(LogCode.SYS_INFO, trace('[P2] Planned swap executor mode enabled'), {
      chainId: request.chainId,
      templateId: plan.templateRef?.templateId
    });

    const routerAddress = String(plan.templateRef?.router || '').trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(routerAddress)) {
      logger.warn(LogCode.SYS_INFO, trace('[P2] Planned router missing, fallback to legacy path'), {
        chainId: request.chainId
      });
      return await fallbackViaCurrentPath('planned_router_missing');
    }

    const replayValue = buildPlanValue(plan);
    const nativeValue = replayValue !== '0'
      ? replayValue
      : (isNativeToken(request.tokenIn, request.chainId)
        ? ethers.parseUnits(request.amountIn, 18).toString()
        : '0');
    const txHash = await sendTransaction(request.userId, request.accessToken || '', {
      to: routerAddress,
      data: buildPlanCalldata(plan),
      value: nativeValue,
      chainId: request.chainId,
      nonce: await request.preWarmedNonce,
      txPurpose: 'trade',
      runtimeContext: request.runtimeContext,
      ...(isTurboCopytrade ? { executionProfile: request.chainId === 8453 ? 'base-sniper' : request.chainId === 56 ? 'bsc-sniper' : undefined } : {})
    });
    const result: MainSwapResult = {
      success: true,
      txHash,
      amountOut: undefined,
      runtimeContext: request.runtimeContext,
      metadata: {
        provider: 'p2-planned-router',
        mode: request.mode
      }
    };

    await recordPlanRun({
      mode: 'live',
      chainId: request.chainId,
      inputJson: JSON.stringify({
        tokenIn: request.tokenIn,
        tokenOut: request.tokenOut,
        amountIn: request.amountIn,
        sourceTxHash: sourceTxHash || null
      }),
      planJson: JSON.stringify(plan),
      scoreJson: JSON.stringify({
        plannerScore: plan.trace?.plannerScore || 0,
        replayPrecheck,
        driftDiagnosis,
        adapterName: plan.trace?.adapterName || null,
        adapterVersion: plan.trace?.adapterVersion || null
      }),
      selectedTemplateId: plan.templateRef?.templateId,
      resultStatus: 'executor_tx_sent',
      txHash,
      latencyMs: Date.now() - t0
    });

    if (isP2SampleLearningEnabled() && result.success && result.txHash) {
      await recordSuccessSample({
        chainId: request.chainId,
        side: plan.side,
        txHash,
        wallet: request.walletAddress,
        tokenIn: request.tokenIn,
        tokenOut: request.tokenOut,
        amountIn: request.amountIn,
        amountOut: result.amountOut,
        router: plan.templateRef.router,
        selector: (plan.execData?.sourceCalldata || '').slice(0, 10) || plan.execData?.commands?.slice?.(0, 10),
        commandMetaJson: JSON.stringify({
          commandType: plan.templateRef.commandType,
          templateId: plan.templateRef.templateId,
          sourceTxHash: sourceTxHash || null,
          sourceTxInput: request.executionContext?.sourceTxInput || null,
          sourceTxValue: request.executionContext?.sourceTxValue || null
        }),
      });
    }
    return result;
  }

  /**
   * Validate request parameters
   */
  private static validateRequest(request: MainSwapRequest): void {
    if (!request.userId || !request.walletAddress) {
      throw new Error('userId and walletAddress are required');
    }

    if (!request.tokenIn || !request.tokenOut) {
      throw new Error('tokenIn and tokenOut are required');
    }

    if (request.tokenIn.toLowerCase() === request.tokenOut.toLowerCase()) {
      throw new Error('tokenIn and tokenOut must be different');
    }

    if (!request.amountIn || parseFloat(request.amountIn) <= 0) {
      throw new Error('amountIn must be a positive number');
    }

    if (!request.chainId) {
      throw new Error('chainId is required');
    }

    if (!request.mode) {
      throw new Error('mode is required');
    }
  }

  /**
   * Determine fee context based on swap mode
   * Fee structure:
   * - 'swap' (default): 0.5% platform fee
   * - 'copy_trade': 1% platform fee
   * - 'launchpad': 0.5% platform fee
   */
  private static determineFeeContext(mode: SwapMode): FeeContext {
    switch (mode) {
      case 'copytrade':
        return 'copyTrade'; // 1% fee (fixed typo)
      case 'launchpad':
      case 'fast-swap':
      case 'swap-card':
      case 'allowance':
      default:
        return 'swap'; // 0.5% fee
    }
  }

  /**
   * Detect if token is a launchpad token (Clanker, Zora, etc.)
   */
  private static async detectLaunchpad(
    tokenAddress: string,
    chainId: number
  ): Promise<LaunchpadDetection | null> {
    try {
      const detection = await detectLaunchpadToken(tokenAddress, chainId);
      if (detection && detection.provider) {
        return detection as LaunchpadDetection;
      }
    } catch (error: any) {
      logger.debug(LogCode.SYS_INFO, 'Launchpad detection error (non-fatal)', {
        token: tokenAddress.slice(0, 12),
        error: error.message
      });
    }
    return null;
  }

  /**
   * Execute launchpad-specific swap
   */
  private static async executeLaunchpadSwap(
    request: MainSwapRequest,
    feeContext: FeeContext,
    trace: (msg: string) => string,
    ctx: TradeContext
  ): Promise<MainSwapResult> {
    const provider = request.launchpadProvider!;
    logger.info(LogCode.EXE_TX_BROADCAST, trace(`Executing ${provider} launchpad swap`), {
      provider,
      tokenOut: request.tokenOut.slice(0, 12)
    });

    try {
      let txHash: string;
      let providerName = provider;

      switch (provider) {
        case 'clanker': {
          // DISABLED: ClankerService not ready - fall through to standard EVM swap
          logger.info(LogCode.SYS_INFO, trace('Clanker disabled - routing to standard EVM swap'));
          return await this.executeEvmSwap(request, feeContext, trace, ctx);
        }

        case 'zora': {
          // EVM - Zora on Base
          // Note: Zora sniper is for notifications, not direct execution
          // For swap execution, we'd use standard DEX routing with Zora token detection
          logger.warn(LogCode.SYS_INFO, trace('Zora swap: using standard EVM routing'), {
            reason: 'Zora sniper handles notifications; swaps via standard DEX'
          });
          return await this.executeEvmSwap(request, feeContext, trace, ctx);
        }

        case 'virtuals': {
          logger.info(LogCode.SYS_INFO, trace('Virtuals token detected: routing to standard EVM swap with virtual bridge strategy support'));
          return await this.executeEvmSwap(request, feeContext, trace, ctx);
        }

        case 'doppler': {
          logger.info(LogCode.SYS_INFO, trace('Doppler token detected: routing to standard EVM swap'));
          return await this.executeEvmSwap(request, feeContext, trace, ctx);
        }

        case 'fourmeme': {
          try {
            txHash = await fourMemeSwapService.fastSwap({
              userId: request.userId,
              accessToken: request.accessToken || '',
              walletAddress: request.walletAddress,
              tokenIn: request.tokenIn,
              tokenOut: request.tokenOut,
              amountIn: request.amountIn,
              chainId: request.chainId,
              slippage: Math.max(1, (request.slippageBps || 300) / 100),
              feeContext,
            });
            providerName = 'fourmeme';
            break;
          } catch (fourMemeErr: any) {
            const message = String(fourMemeErr?.message || fourMemeErr || '');
            if (!hasFourMemeGraduationProof(message)) {
              throw fourMemeErr;
            }
            logger.warn(
              LogCode.EXE_TX_REVERTED,
              trace(`fourmeme launchpad path unavailable; falling back to standard EVM swap (${message.slice(0, 180)})`),
              { provider, error: message }
            );
            const fallbackResult = await this.executeEvmSwap(request, feeContext, trace, ctx);
            fallbackResult.metadata = {
              ...(fallbackResult.metadata || {}),
              launchpad: provider,
              provider: `${fallbackResult.metadata?.provider || 'evm'}:fourmeme:fallback`,
            };
            return fallbackResult;
          }
        }

        case 'pumpfun':
        case 'pumpswap':
        case 'bonkfun': {
          // ⚡ Use TradeContext-aware data fetching (auto-caches)
          const tokenInInfo = await getTokenData(request.tokenIn, SOLANA_CONFIG.CHAIN_ID, ctx);
          const decimals = tokenInInfo?.decimals || (provider === 'bonkfun' ? 6 : 9);
          const amountAtomic = Math.floor(
            parseFloat(request.amountIn) * Math.pow(10, decimals)
          ).toString();
          const directRequest = await buildSolanaDirectRequest({
            userId: request.userId,
            mint: request.tokenOut,
            amountAtomic,
            isBuy: true,
            slippageBps: request.slippageBps || 300,
            provider: provider as 'pumpfun' | 'pumpswap' | 'bonkfun',
            feeContext,
            sourceTxHash: request.executionContext?.sourceTxHash || request.executionContext?.contextSnapshot?.sourceTxHash || null
          });
          const directResult = await executeSolanaDirectLaunchpad(directRequest);

          if (directResult.ok) {
            txHash = directResult.txHash;
            providerName = provider;
            break;
          }

          logger.warn(
            LogCode.EXE_TX_REVERTED,
            trace(`${provider} direct launchpad path failed; falling back to aggregator path (reasonCode=${directResult.reasonCode}, message=${String(directResult.message || '').slice(0, 180)})`),
            {
              provider,
              reasonCode: directResult.reasonCode,
              message: directResult.message
            }
          );

          try {
            const result = await this.executeSolanaSwap(request, feeContext, trace, ctx);
            result.metadata = {
              ...(result.metadata || {}),
              launchpad: provider,
              provider: `${result.metadata?.provider || 'solana'}:${provider}:fallback`
            };
            return result;
          } catch (fallbackErr: any) {
            const msg = String(fallbackErr?.message || fallbackErr || '');
            const isSlippageFailure =
              msg.includes('0x1771')
              || msg.includes('custom error: 6001')
              || msg.toLowerCase().includes('slippage');

            if (isSlippageFailure) {
              const baseSlippage = Number(request.slippageBps || 100);
              const retrySlippage = Math.max(150, Math.min(1200, Math.floor(baseSlippage * 3)));
              logger.warn(LogCode.EXE_TX_REVERTED, trace(`launchpad fallback swap hit slippage, retrying with widened slippage`), {
                launchpad: provider,
                baseSlippage,
                retrySlippage,
                error: msg.slice(0, 240)
              });

              const retryResult = await this.executeSolanaSwap(
                { ...request, slippageBps: retrySlippage },
                feeContext,
                trace,
                ctx
              );
              retryResult.metadata = {
                ...(retryResult.metadata || {}),
                launchpad: provider,
                provider: `${retryResult.metadata?.provider || 'solana'}:${provider}:fallback_retry:${retrySlippage}bps`
              };
              return retryResult;
            }

            throw fallbackErr;
          }
        }

        default:
          throw new Error(`Unknown launchpad provider: ${provider}`);
      }

      logger.info(LogCode.EXE_TX_CONFIRMED, trace(`${provider} swap successful`), {
        txHash,
        provider
      });

      return {
        success: true,
        txHash,
        metadata: {
          provider: providerName,
          mode: request.mode,
          launchpad: provider
        }
      };

    } catch (error: any) {
      logger.error(LogCode.EXE_TX_REVERTED, trace(`${provider} launchpad swap failed`), {
        error: error.message,
        provider
      });
      throw error;
    }
  }

  /**
   * Execute EVM swap (0x, etc.)
   */
  private static async executeEvmSwap(
    request: MainSwapRequest,
    feeContext: FeeContext,
    trace: (msg: string) => string,
    ctx: TradeContext
  ): Promise<MainSwapResult> {
    const routePolicy: RoutePolicy = request.routePolicy || 'legacy_allowed';
    const shouldEnableMevProtection = request.mode === 'copytrade'
      ? request.userSettings?.copyTradeExecutionMode !== 'turbo'
      : request.mode === 'fast-swap';
    const TURBO_TOTAL_BUDGET_MS = 6500;
    const TURBO_DIRECT_ATTEMPT_TIMEOUT_MS = 4200;
    const TURBO_DIRECT_MAX_ATTEMPTS = 2;
    const BALANCED_DIRECT_MAX_ATTEMPTS = 2;
    const TURBO_ADAPTIVE_RETRY_AMOUNT = false;
    const TURBO_SKIP_FALLBACK_ON_TIMEOUT = true;
    const TURBO_DIRECT_LATE_SETTLE_MS = 2000;
    const TURBO_DIRECT_FINAL_SETTLE_MS = 4500;
    const TURBO_FINAL_SETTLE_MS = Math.max(300, Math.min(5000, Number(process.env.COPYTRADE_TURBO_FINAL_SETTLE_MS || 1400)));
    const DIRECT_SWAP_VISIBILITY_GATE_MS_TURBO = 5200;
    const DIRECT_SWAP_VISIBILITY_GATE_MS_NORMAL = 4200;
    const DIRECT_SWAP_VISIBILITY_GATE_POLL_MS = 320;
    // 0x API is typically 10s+; skip fallback in turbo so we fail fast instead of waiting.
    const TURBO_SKIP_0X_FALLBACK = (process.env.COPYTRADE_TURBO_SKIP_EXTERNAL_FALLBACK || 'false').toLowerCase() === 'true';
    const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timeout_${label}_${ms}ms`)), ms);
        promise.then((v) => {
          clearTimeout(timer);
          resolve(v);
        }).catch((e) => {
          clearTimeout(timer);
          reject(e);
        });
      });
    };
    const isTimeoutError = (err: unknown): boolean => {
      const msg = String((err as any)?.message || '').toLowerCase();
      return msg.startsWith('timeout_direct_swap_') || msg.startsWith('timeout_turbo_budget_');
    };
    const extractFailureCode = (message?: string | null): string | null => {
      const msg = String(message || '').trim();
      if (!msg) return null;
      const idx = msg.indexOf(':');
      if (idx <= 0) return msg;
      return msg.slice(0, idx);
    };
    const settleWithin = async <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
      Promise.race([
        promise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
      ]);
    const enforceVisibilityGate = async (
      directResult: Awaited<ReturnType<typeof executeDirectSwap>>,
      stage: string
    ): Promise<Awaited<ReturnType<typeof executeDirectSwap>>> => {
      if (!directResult.success) return directResult;
      if (!directResult.txHash) return directResult;
      const lifecycleStatus = directResult.txLifecycle?.status;
      const needsVisibilityGate = lifecycleStatus === 'broadcasted_unseen' || lifecycleStatus === 'visible_pending';
      if (!needsVisibilityGate) return directResult;

      const visibilityMaxWaitMs = isTurboCopytrade
        ? DIRECT_SWAP_VISIBILITY_GATE_MS_TURBO
        : DIRECT_SWAP_VISIBILITY_GATE_MS_NORMAL;
      logger.warn(LogCode.SYS_INFO, trace('Direct swap tx unseen after broadcast; waiting visibility gate'), {
        stage,
        txHash: directResult.txHash,
        mode: request.mode,
        executionMode: request.userSettings?.copyTradeExecutionMode || 'normal',
        visibilityMaxWaitMs
      });

      const lifecycle = await waitForReceiptStateMachine({
        chainId: request.chainId,
        txHash: directResult.txHash,
        expectedFrom: request.walletAddress,
        maxWaitMs: visibilityMaxWaitMs,
        pollMs: DIRECT_SWAP_VISIBILITY_GATE_POLL_MS
      }).catch((error: any) => ({
        ...directResult.txLifecycle,
        lastRpcError: error?.message || String(error)
      } as TxLifecycleResult));

      if (shouldPassVisibilityGate({
        chainId: request.chainId,
        txHash: directResult.txHash,
        runtimeContext: request.runtimeContext,
        lifecycle
      })) {
        logger.info(LogCode.SYS_INFO, trace('Direct swap tx passed visibility gate'), {
          stage,
          txHash: directResult.txHash,
          visibilityStatus: lifecycle?.status,
          attempts: lifecycle.attempts
        });
        return {
          ...directResult,
          txLifecycle: lifecycle
        };
      }

      const { failure: visibilityFailure, reason: visibilityReason } = describeVisibilityFailure({
        chainId: request.chainId,
        txHash: directResult.txHash,
        runtimeContext: request.runtimeContext,
        lifecycle: lifecycle || directResult.txLifecycle || undefined
      });
      logger.warn(LogCode.SYS_INFO, trace('Direct swap tx failed visibility gate'), {
        stage,
        txHash: directResult.txHash,
        visibilityFailure,
        visibilityReason
      });
      return {
        ...directResult,
        success: false,
        error: `failed_to_send_transaction:tx_not_visible_after_broadcast:${visibilityFailure}:${visibilityReason}`,
        provider: 'failed',
        txLifecycle: lifecycle
      };
      };

    const runtimeHasAcceptedDirectState = (): boolean => {
      return resolveTxFinalState({
        runtimeContext: request.runtimeContext,
        chainId: request.chainId
      }).accepted;
    };
    const runtimeAcceptedDirectTxHash = (): string | undefined =>
      request.runtimeContext?.canonicalTxHash || undefined;
    const evaluateTurboCopytradeSendState = (lifecycle?: TxLifecycleResult | null) => evaluateCopytradeBuySendState({
      mode: request.mode,
      isBuyDirection,
      chainId: request.chainId,
      txHash: runtimeAcceptedDirectTxHash(),
      runtimeContext: request.runtimeContext,
      lifecycle: lifecycle || request.runtimeContext?.lastLifecycle || null,
    });

    const normalizedTokenIn = this.normalizeEvmTokenInput(request.tokenIn, request.chainId);
    const normalizedTokenOut = this.normalizeEvmTokenInput(request.tokenOut, request.chainId);
    const rawTokenIn = String(request.tokenIn || '').trim().toLowerCase();
    const isTurboCopytrade = request.mode === 'copytrade' && request.userSettings?.copyTradeExecutionMode === 'turbo';
    if (!isNativeToken(normalizedTokenIn, request.chainId) && !/^0x[0-9a-fA-F]{40}$/.test(normalizedTokenIn)) {
      throw new Error(`Invalid EVM tokenIn: ${request.tokenIn}`);
    }
    if (!isNativeToken(normalizedTokenOut, request.chainId) && !/^0x[0-9a-fA-F]{40}$/.test(normalizedTokenOut)) {
      throw new Error(`Invalid EVM tokenOut: ${request.tokenOut}`);
    }

    // Guard against intent/parser mismatch (e.g. user asked USDC, but tokenIn resolved to native ETH).
    const expectsStableInput = rawTokenIn.includes('usdc') || rawTokenIn.includes('usdt') || rawTokenIn.includes('dai');
    if (expectsStableInput && isNativeToken(normalizedTokenIn, request.chainId)) {
      throw new Error('token_input_mismatch: requested stablecoin input but resolved to native token');
    }

    // Balance precheck: turbo skips (let on-chain revert handle; saves 50–300ms). Non-turbo runs in parallel with DirectSwap.
    const checkNativeBalancePromise: Promise<void> | null =
      isNativeToken(normalizedTokenIn, request.chainId) && !isTurboCopytrade
        ? verifyNativeBalancePrecheck({
            chainId: request.chainId,
            walletAddress: request.walletAddress,
            amountIn: request.amountIn,
            gasReserve: getChainConfig(request.chainId).gasReserve || '0.003',
            nativeBalanceEvidence: request.executionContext?.nativeBalanceEvidence,
            onBypass: (error) => {
              logger.warn(LogCode.API_FETCH_FAILED, trace('Native balance precheck unavailable; continuing without precheck'), {
                chainId: request.chainId,
                walletAddress: request.walletAddress,
                error: String((error as Error)?.message || error || 'unknown'),
                tokenIn: normalizedTokenIn,
                tokenOut: normalizedTokenOut,
              });
            }
          })
        : null;

    logger.info(LogCode.EXE_TX_BROADCAST, trace('Executing EVM swap'), {
      chainId: request.chainId,
      tokenIn: normalizedTokenIn.slice(0, 12),
      tokenOut: normalizedTokenOut.slice(0, 12),
      fastSwapMode: request.userSettings?.fastSwapMode,
      contextHitSource: request.executionContext?.contextHitSource || 'miss',
      contextId: request.executionContext?.contextId || null
    });

    // [Logic]: FastSwapMode 使用直接交易 (V3/V4)，跳过 0x
    // [Logic]: 买入方向判定基于 cash -> token（支持 ETH/WETH/USDC/USDT）
    // [Logic]: cash -> cash（例如 ETH -> USDC）不应触发买入直连
    const isCashIn = isCashLikeToken(normalizedTokenIn, request.chainId);
    const isCashOut = isCashLikeToken(normalizedTokenOut, request.chainId);
    const isBuyDirection = isCashIn && !isCashOut;
    const isSellDirection = !isCashIn && isCashOut;
    const contextSnapshot = request.executionContext?.contextSnapshot;
    const sourceTxInput = request.executionContext?.sourceTxInput || contextSnapshot?.sourceTxInput || '';
    const sourceSelector = /^0x[0-9a-fA-F]{8}/.test(sourceTxInput)
      ? sourceTxInput.slice(0, 10).toLowerCase()
      : (contextSnapshot?.sourceSelector || null);
    const sourceRouter = request.executionContext?.sourceRouter || contextSnapshot?.sourceRouter || null;
    const sourceTokenIn = request.executionContext?.sourceTokenIn || contextSnapshot?.tokenIn || null;
    const sourceTokenOut = request.executionContext?.sourceTokenOut || contextSnapshot?.tokenOut || null;
    const sourceAmountIn = request.executionContext?.sourceAmountIn || contextSnapshot?.amountIn || null;
    const sourceAmountOut = request.executionContext?.sourceAmountOut || contextSnapshot?.amountOut || null;
    const sampleSide: 'buy' | 'sell' = isSellDirection ? 'sell' : 'buy';
    const pickRouterAddress = (...candidates: Array<string | null | undefined>): string => {
      for (const candidate of candidates) {
        const normalized = String(candidate || '').trim().toLowerCase();
        if (/^0x[a-f0-9]{40}$/.test(normalized)) return normalized;
      }
      return ethers.ZeroAddress;
    };
    const persistLiveSuccessSample = (params: {
      txHash?: string;
      amountOut?: string;
      router?: string;
      poolMetaJson?: string;
      commandMetaJson?: string;
      selector?: string | null;
    }): void => {
      if (!isP2SampleLearningEnabled()) return;
      if (!params.txHash) return;
      void recordSuccessSample({
        chainId: request.chainId,
        side: sampleSide,
        txHash: params.txHash,
        wallet: request.walletAddress,
        tokenIn: normalizedTokenIn,
        tokenOut: normalizedTokenOut,
        amountIn: request.amountIn,
        amountOut: params.amountOut,
        router: pickRouterAddress(params.router, sourceRouter),
        selector: params.selector || sourceSelector || undefined,
        poolMetaJson: params.poolMetaJson,
        commandMetaJson: params.commandMetaJson
      });
    };
    const configuredCopytradeSellDirect = (process.env.COPYTRADE_SELL_DIRECT_ENABLED || 'false').toLowerCase() === 'true';
    const copytradeSellRoutePolicy = request.mode === 'copytrade' && isSellDirection
      ? (request.executionContext?.sellRoutePolicy || (configuredCopytradeSellDirect ? 'direct_primary' : 'external_primary'))
      : null;
    const copytradeSellUsesExternalPath = request.mode === 'copytrade' && isSellDirection && copytradeSellRoutePolicy !== 'direct_primary';
    const allowDirectSell = request.mode === 'copytrade' && isSellDirection && copytradeSellRoutePolicy === 'direct_primary';
    const turboBuyForceDirect = isTurboCopytrade && isBuyDirection;
    const turboSkipFallbackOnTimeout = isTurboCopytrade && isSellDirection && TURBO_SKIP_FALLBACK_ON_TIMEOUT;
    const turboSkip0xFallback = isTurboCopytrade && isSellDirection && TURBO_SKIP_0X_FALLBACK;
    const enforcedSlippageBps = request.mode === 'copytrade'
      ? (request.slippageBps ?? 1500)
      : (request.slippageBps ?? 1000);
    const fastSwapEnabled = routePolicy !== 'external_only'
      && !copytradeSellUsesExternalPath
      && (request.userSettings?.fastSwapMode === true || turboBuyForceDirect);
    if (!fastSwapEnabled || !isDirectSwapSupported(request.chainId) || (!isBuyDirection && !allowDirectSell)) {
      const reasons: string[] = [];
      if (routePolicy === 'external_only') reasons.push('route_policy_external_only');
      if (!fastSwapEnabled && routePolicy !== 'external_only') reasons.push('fastSwapMode=false');
      if (!isDirectSwapSupported(request.chainId)) reasons.push('chain_not_supported');
      if (!isBuyDirection && !allowDirectSell) reasons.push('unsupported_direction');
      logger.debug(LogCode.SYS_INFO, trace('Direct swap not attempted'), {
        reasons,
        fastSwapEnabled,
        isDirectSwapSupported: isDirectSwapSupported(request.chainId),
        isBuyDirection,
        isSellDirection,
        allowDirectSell,
        copytradeSellUsesExternalPath,
        copytradeSellRoutePolicy,
        isCashIn,
        isCashOut,
        chainId: request.chainId,
        tokenIn: request.tokenIn,
        tokenOut: request.tokenOut,
        mode: request.mode
      });
    }

    if (fastSwapEnabled && isDirectSwapSupported(request.chainId) && (isBuyDirection || allowDirectSell)) {
      const rpcUsageBefore = getRpcMethodUsageSnapshot(request.chainId);
      const baseDirectSwapHint = request.directSwapHint || buildDirectSwapHintFromContext(request.executionContext?.contextSnapshot);
      const directSwapHint = baseDirectSwapHint
        ? {
          ...baseDirectSwapHint,
          sourceTxHash: baseDirectSwapHint.sourceTxHash || request.executionContext?.sourceTxHash || contextSnapshot?.sourceTxHash,
          sourceRouter: baseDirectSwapHint.sourceRouter || request.executionContext?.sourceRouter || contextSnapshot?.sourceRouter,
          sourceTokenIn: baseDirectSwapHint.sourceTokenIn || sourceTokenIn || undefined,
          sourceTokenOut: baseDirectSwapHint.sourceTokenOut || sourceTokenOut || undefined,
          sourceAmountIn: baseDirectSwapHint.sourceAmountIn || sourceAmountIn || undefined,
          sourceAmountOut: baseDirectSwapHint.sourceAmountOut || sourceAmountOut || undefined
        }
        : undefined;
      try {
      // Turbo buy path keeps a single direct attempt to avoid internal retries blocking first-send.
      const DIRECT_SWAP_MAX_ATTEMPTS = isTurboCopytrade ? 1 : BALANCED_DIRECT_MAX_ATTEMPTS;
      const turboBudgetStart = Date.now();
      logger.info(LogCode.SYS_INFO, trace('FastSwapMode enabled - attempting direct swap'), {
        mode: request.mode,
        direction: isBuyDirection ? 'buy' : 'sell',
        chainId: request.chainId,
        tokenIn: normalizedTokenIn,
        tokenOut: normalizedTokenOut,
        amountIn: request.amountIn,
        slippageBps: enforcedSlippageBps,
        maxAttempts: DIRECT_SWAP_MAX_ATTEMPTS
      });
      let lastDirectResult: Awaited<ReturnType<typeof executeDirectSwap>> | null = null;
      let lastDirectError: any = null;
      let inflightDirectPromise: Promise<Awaited<ReturnType<typeof executeDirectSwap>>> | null = null;
      let directTimeoutReason: TurboDirectFailureReason = null;
      const directTraceState: {
        direct_start_at: number;
        first_send_at?: number;
        fanout_done_at?: number;
        turbo_timeout_at?: number;
        fallback_start_at?: number;
        final_result_at?: number;
      } = {
        direct_start_at: Date.now()
      };
	      const toDirectSuccessResult = (result: Awaited<ReturnType<typeof executeDirectSwap>>): MainSwapResult => {
	        const shouldDeferFeeCollection = shouldDeferAcceptedCopytradeBuyFeeCollection({
	          isTurboCopytrade,
	          mode: request.mode,
	          isBuyDirection,
	          chainId: request.chainId,
	          txHash: result.txHash,
	          runtimeContext: result.runtimeContext || request.runtimeContext,
	          lifecycle: result.txLifecycle || null
	        });
	        const directFeeSettlement = buildDirectSwapFeeSettlement({
	          request: {
	            userId: request.userId,
	            accessToken: request.accessToken,
            amountIn: request.amountIn,
            chainId: request.chainId,
            feeBpsOverride: request.feeBpsOverride,
            mode: request.mode,
            sourceTxHash: result.txHash
          },
	          normalizedTokenIn,
	          normalizedTokenOut,
	          amountOutBase: result.amountOut,
	          feeContext,
	          deferred: shouldDeferFeeCollection,
	          reasonCode: result.txLifecycle?.status || 'direct_swap_result'
	        });
        return {
          success: true,
          txHash: result.txHash,
          amountOut: result.amountOut,
          txLifecycle: result.txLifecycle,
          runtimeContext: result.runtimeContext || request.runtimeContext,
          metadata: {
            provider: result.provider,
            mode: request.mode,
            txLifecycleStatus: result.txLifecycle?.status,
            directFeeSettlement: directFeeSettlement || undefined,
            buyFeeApplication: buildBuyFeeApplicationFromDirectSettlement(directFeeSettlement) || undefined,
          }
        };
      };
      try {
        for (let attempt = 1; attempt <= DIRECT_SWAP_MAX_ATTEMPTS; attempt++) {
          const remainingTurboBudget = TURBO_TOTAL_BUDGET_MS - (Date.now() - turboBudgetStart);
          if (isTurboCopytrade && remainingTurboBudget <= 0) {
            lastDirectError = new Error(`timeout_turbo_budget_${TURBO_TOTAL_BUDGET_MS}ms`);
            directTimeoutReason = 'budget_timeout';
            directTraceState.turbo_timeout_at = Date.now();
            break;
          }
          // Retry profile: turbo keeps amount stable by default to maximize cache/inflight reuse.
          const amountMult = (!isTurboCopytrade || TURBO_ADAPTIVE_RETRY_AMOUNT)
            ? (attempt === 1 ? 1 : attempt === 2 ? 0.998 : 0.996)
            : 1;
          const slippageMult = attempt === 1 ? 1 : attempt === 2 ? 1.2 : 1.5;
          const attemptAmountIn = attempt === 1
            ? request.amountIn
            : (Number(request.amountIn) * amountMult).toFixed(18);
          const attemptSlippageBps = Math.min(Math.floor(enforcedSlippageBps * slippageMult), 2500);
          const directSwapInflightKeyBase = this.buildDirectSwapInflightKey(
            request,
            normalizedTokenIn,
            normalizedTokenOut,
            attemptAmountIn
          );
          const directSwapInflightKey = isTurboCopytrade
            ? `${directSwapInflightKeyBase}:attempt_${attempt}`
            : directSwapInflightKeyBase;
          if (attempt >= 2 && isTurboCopytrade) {
            logger.info(LogCode.SYS_INFO, trace(`Turbo 光速 retry - immediate direct attempt ${attempt} (no sleep, cache hot)`), {
              attempt,
              maxAttempts: DIRECT_SWAP_MAX_ATTEMPTS,
              amountIn: attemptAmountIn,
              slippageBps: attemptSlippageBps
            });
          }
          inflightDirectPromise = this.getOrCreateDirectSwapInflight(
            directSwapInflightKey,
            () => executeDirectSwap({
              userId: request.userId,
              accessToken: request.accessToken || '',
              walletAddress: request.walletAddress,
              tokenIn: normalizedTokenIn,
              tokenOut: normalizedTokenOut,
              amountIn: attemptAmountIn,
              chainId: request.chainId,
              slippageBps: attemptSlippageBps,
              hint: directSwapHint,
              executionMode: request.userSettings?.copyTradeExecutionMode,
              mevProtection: shouldEnableMevProtection,
              runtimeContext: request.runtimeContext
            })
          );
          if (!directTraceState.first_send_at) {
            directTraceState.first_send_at = Date.now();
          }
          let directResult: Awaited<ReturnType<typeof executeDirectSwap>>;
          if (isTurboCopytrade) {
            const timeoutMs = Math.max(200, Math.min(TURBO_DIRECT_ATTEMPT_TIMEOUT_MS, remainingTurboBudget));
            try {
              directResult = await withTimeout(
                inflightDirectPromise,
                timeoutMs,
                'direct_swap'
              );
            } catch (timeoutErr: any) {
              if (!isTimeoutError(timeoutErr)) {
                throw timeoutErr;
              }
              if (!turboSkipFallbackOnTimeout) {
                throw timeoutErr;
              }

              logger.warn(LogCode.SYS_INFO, trace('Turbo direct timeout; stop waiting in direct stage'), {
                attempt,
                timeoutMs
              });
              directTraceState.turbo_timeout_at = Date.now();
              directTimeoutReason = 'send_failure';
              lastDirectError = timeoutErr;
              break;
            }
          } else {
            directResult = await inflightDirectPromise;
            directTraceState.fanout_done_at = Date.now();
          }
          lastDirectResult = directResult;
          directTraceState.fanout_done_at = Date.now();

          if (directResult.success) {
            const acceptedResult = isTurboCopytrade
              ? directResult
              : await enforceVisibilityGate(directResult, `attempt_${attempt}`);
            lastDirectResult = acceptedResult;
            if (!acceptedResult.success) {
              const acceptedInflight = evaluateCopytradeBuyAcceptedInflight({
                mode: request.mode,
                isBuyDirection,
                chainId: request.chainId,
                txHash: acceptedResult.txHash,
                runtimeContext: request.runtimeContext,
                lifecycle: acceptedResult.txLifecycle || null
              });
                if (acceptedInflight.adoptAcceptedTx) {
                  const adoptedResult = {
                    ...directResult,
                    txHash: acceptedInflight.txHash || directResult.txHash,
                    txLifecycle: acceptedResult.txLifecycle || directResult.txLifecycle
                  };
                  const shouldDeferFeeCollection = acceptedInflight.shouldDeferFeeCollection
                    || shouldDeferAcceptedCopytradeBuyFeeCollection({
                      isTurboCopytrade,
                      mode: request.mode,
                      isBuyDirection,
                      chainId: request.chainId,
                      txHash: adoptedResult.txHash,
                      runtimeContext: adoptedResult.runtimeContext || request.runtimeContext,
                      lifecycle: adoptedResult.txLifecycle || null
                    });
                  const directFeeSettlement = buildDirectSwapFeeSettlement({
                    request: {
                      userId: request.userId,
                      accessToken: request.accessToken,
                      amountIn: request.amountIn,
                    chainId: request.chainId,
                    feeBpsOverride: request.feeBpsOverride,
                    mode: request.mode,
                    sourceTxHash: adoptedResult.txHash
                  },
                      normalizedTokenIn,
                      normalizedTokenOut,
                      amountOutBase: adoptedResult.amountOut,
                      feeContext,
                      deferred: shouldDeferFeeCollection,
                      reasonCode: acceptedInflight.reasonCode
                  });
                  logger.warn(LogCode.SYS_INFO, trace('Direct swap accepted but still unseen; locking inflight tx and stopping buy retries'), {
                    attempt,
                    txHash: adoptedResult.txHash,
                    reasonCode: acceptedInflight.reasonCode,
                    deferFeeCollection: shouldDeferFeeCollection
                  });
                  if (!shouldDeferFeeCollection) {
                    const runFeeCollection = async () => {
                      try {
                        if (!directFeeSettlement) return;
                        await this.collectDirectSwapFeeSettlement(directFeeSettlement, request, trace);
                    } catch (feeErr: any) {
                      logger.warn(LogCode.SYS_ERROR, trace('Direct swap fee transfer failed (non-fatal)'), {
                        error: feeErr?.message || String(feeErr)
                      });
                    }
                  };

                  // 🔥 FIX (Deduplication): Only trigger immediate fee collection if NOT deferred.
                  // If deferred, the fee will be collected later in buyConfirmationTransition.ts
                  // when the transaction is actually confirmed and becomes 'visible'.
                  if (isTurboCopytrade) {
                    void runFeeCollection();
                  } else {
                    await runFeeCollection();
                  }
                } else {
                  logger.warn(LogCode.SYS_INFO, trace('Direct swap fee deferred until tx visibility improves'), {
                    txHash: adoptedResult.txHash,
                    reasonCode: acceptedInflight.reasonCode
                  });
                }
                  const successResult = toDirectSuccessResult(adoptedResult);
                  // Ensure the settlement object matches the deferral decision
                  if (successResult.metadata.directFeeSettlement) {
                    successResult.metadata.directFeeSettlement.deferred = shouldDeferFeeCollection;
                  }
                  return successResult;
                }
              directTimeoutReason = 'visibility_timeout';
              if (attempt < DIRECT_SWAP_MAX_ATTEMPTS) {
                logger.warn(LogCode.SYS_INFO, trace('Direct swap visibility gate failed, retrying next attempt'), {
                  attempt,
                  maxAttempts: DIRECT_SWAP_MAX_ATTEMPTS,
                  error: acceptedResult.error
                });
              }
              continue;
            }
            if (!isTurboCopytrade && checkNativeBalancePromise) await checkNativeBalancePromise;
            const shouldDeferFeeCollection = shouldDeferAcceptedCopytradeBuyFeeCollection({
              isTurboCopytrade,
              mode: request.mode,
              isBuyDirection,
              chainId: request.chainId,
              txHash: acceptedResult.txHash,
              runtimeContext: acceptedResult.runtimeContext || request.runtimeContext,
              lifecycle: acceptedResult.txLifecycle || null
            });
            const runFeeCollection = async () => {
              try {
                const directFeeSettlement = buildDirectSwapFeeSettlement({
                  request: {
                    userId: request.userId,
                    accessToken: request.accessToken,
                    amountIn: request.amountIn,
                    chainId: request.chainId,
                    feeBpsOverride: request.feeBpsOverride,
                    mode: request.mode,
                    sourceTxHash: acceptedResult.txHash
                  },
                  normalizedTokenIn,
                  normalizedTokenOut,
                  amountOutBase: acceptedResult.amountOut,
                  feeContext,
                  deferred: shouldDeferFeeCollection,
                  reasonCode: acceptedResult.txLifecycle?.status || 'direct_swap_result'
                });
                if (!directFeeSettlement) return;
                if (shouldDeferFeeCollection) {
                  logger.warn(LogCode.SYS_INFO, trace('Direct swap fee deferred until tx visibility improves'), {
                    txHash: acceptedResult.txHash,
                    reasonCode: directFeeSettlement.reasonCode
                  });
                  return;
                }
                await this.collectDirectSwapFeeSettlement(directFeeSettlement, request, trace);
              } catch (feeErr: any) {
                logger.warn(LogCode.SYS_ERROR, trace('Direct swap fee transfer failed (non-fatal)'), {
                  error: feeErr?.message || String(feeErr)
                });
              }
            };
            if (isTurboCopytrade) {
              void runFeeCollection();
            } else {
              await runFeeCollection();
            }
            logger.info(LogCode.EXE_TX_CONFIRMED, trace(`Direct swap successful txHash=${acceptedResult.txHash ?? 'null'}`), {
              txHash: acceptedResult.txHash,
              provider: acceptedResult.provider,
              poolInfo: acceptedResult.poolInfo,
              attempt
            });
            const routeMs = directTraceState.first_send_at
              ? directTraceState.first_send_at - directTraceState.direct_start_at
              : null;
            const sendMs = (directTraceState.first_send_at && directTraceState.fanout_done_at)
              ? directTraceState.fanout_done_at - directTraceState.first_send_at
              : null;
            logger.info(LogCode.SYS_INFO, trace('Turbo diagnostic'), {
              route_ms: routeMs,
              send_ms: sendMs,
              txHash: acceptedResult.txHash || undefined,
              fallback_used: false,
              fail_reason: undefined
            });
            persistLiveSuccessSample({
              txHash: acceptedResult.txHash,
              amountOut: acceptedResult.amountOut,
              router: (acceptedResult as any)?.poolInfo?.poolAddress,
              poolMetaJson: acceptedResult.poolInfo ? JSON.stringify(acceptedResult.poolInfo) : undefined,
              commandMetaJson: JSON.stringify({
                source: 'direct_swap',
                provider: acceptedResult.provider,
                txLifecycleStatus: acceptedResult.txLifecycle?.status || undefined
              })
            });
            return toDirectSuccessResult(acceptedResult);
          }

          const isClankerBlocked = directResult.error?.startsWith('clanker_gate:')
            || directResult.error === 'clanker_force_v4_failed';
          if (isClankerBlocked) {
            logger.warn(LogCode.SYS_INFO, trace(`Direct swap blocked by clanker gate: ${directResult.error}`), {
              error: directResult.error,
              attempt
            });
            return {
              success: false,
              error: directResult.error,
              metadata: {
                provider: directResult.provider,
                mode: request.mode
              }
            };
          }

          if (attempt < DIRECT_SWAP_MAX_ATTEMPTS) {
            logger.warn(LogCode.SYS_INFO, trace('Direct swap failed, retrying next attempt'), {
              attempt,
              maxAttempts: DIRECT_SWAP_MAX_ATTEMPTS,
              error: directResult.error,
              directProvider: directResult.provider
            });
          }
          directTimeoutReason = 'route_failure';
        }
      } catch (directErr: any) {
        lastDirectError = directErr;
        if (!directTimeoutReason) {
          directTimeoutReason = isTimeoutError(directErr) ? 'send_failure' : 'route_failure';
        }
      }

      let skipDirectFallbackProbe = false;
      if (isTurboCopytrade && isTimeoutError(lastDirectError)) {
        const chainDegraded = getChainRpcDegradeState(request.chainId);
        const runtimeTxHash = runtimeAcceptedDirectTxHash();
        const timeoutSendState = evaluateTurboCopytradeSendState(lastDirectResult?.txLifecycle || null);
        const observedTxStates = runtimeTxHash
          ? [{ hash: runtimeTxHash, state: getTxLifecycleState(request.chainId, runtimeTxHash) }]
              .filter((item) => Boolean(item.state))
          : [];
        if (timeoutSendState.sendState === 'no_send_evidence') {
          skipDirectFallbackProbe = true;
          logger.warn(LogCode.SYS_INFO, trace('Turbo timeout without any direct send evidence; admit immediate fallback'), {
            error: lastDirectError?.message,
            order_runtime_state: request.runtimeContext?.state || null,
            direct_timeout_reason: directTimeoutReason || 'send_failure',
            chain_rpc_degraded: chainDegraded.degraded,
            chain_rpc_error: chainDegraded.lastError || null,
            sendState: timeoutSendState.sendState,
            sendReasonCode: timeoutSendState.reasonCode,
            observed_tx_states: observedTxStates.map((item) => ({
              txHash: item.hash,
              status: item.state?.status || null,
              updatedAt: item.state?.updatedAt || null
            }))
          });
        } else {
          if (inflightDirectPromise) {
            const lateSettled = await settleWithin(inflightDirectPromise, TURBO_DIRECT_LATE_SETTLE_MS);
            if (lateSettled) {
              lastDirectResult = lateSettled;
              if (lateSettled.success && lateSettled.txHash) {
                logger.warn(LogCode.SYS_INFO, trace('Turbo timeout recovered by late direct settle; lock direct and skip fallback'), {
                  txHash: lateSettled.txHash,
                  provider: lateSettled.provider,
                  late_settle_ms: TURBO_DIRECT_LATE_SETTLE_MS,
                  direct_timeout_reason: directTimeoutReason || 'send_failure',
                  chain_rpc_degraded: chainDegraded.degraded,
                  observed_tx_states: observedTxStates.map((item) => ({
                    txHash: item.hash,
                    status: item.state?.status || null,
                    updatedAt: item.state?.updatedAt || null
                  }))
                });
                return toDirectSuccessResult(lateSettled);
              }
            }
          }
          const txHash = runtimeAcceptedDirectTxHash();
          if (txHash && runtimeHasAcceptedDirectState()) {
            logger.warn(LogCode.SYS_INFO, trace('Turbo timeout but direct state already accepted by order runtime; lock direct and skip fallback'), {
              txHash,
              provider: lastDirectResult?.provider || 'direct-swap',
              order_runtime_state: request.runtimeContext?.state || null,
              direct_timeout_reason: directTimeoutReason || 'send_failure',
              chain_rpc_degraded: chainDegraded.degraded,
              chain_rpc_error: chainDegraded.lastError || null,
              observed_tx_states: observedTxStates.map((item) => ({
                txHash: item.hash,
                status: item.state?.status || null,
                updatedAt: item.state?.updatedAt || null
              }))
            });
            return {
              success: true,
              txHash,
              amountOut: lastDirectResult?.amountOut,
              txLifecycle: lastDirectResult?.txLifecycle,
              runtimeContext: request.runtimeContext,
              metadata: {
                provider: lastDirectResult?.provider || 'direct-swap',
                mode: request.mode,
                txLifecycleStatus: lastDirectResult?.txLifecycle?.status
              }
            };
          }
          logger.warn(LogCode.SYS_INFO, trace('Turbo timeout with direct send evidence still unresolved; lock further sends and evaluate ownership'), {
            error: lastDirectError?.message,
            order_runtime_state: request.runtimeContext?.state || null,
            direct_timeout_reason: directTimeoutReason || 'send_failure',
            chain_rpc_degraded: chainDegraded.degraded,
            chain_rpc_error: chainDegraded.lastError || null,
            sendState: timeoutSendState.sendState,
            sendReasonCode: timeoutSendState.reasonCode,
            observed_tx_states: observedTxStates.map((item) => ({
              txHash: item.hash,
              status: item.state?.status || null,
              updatedAt: item.state?.updatedAt || null
            }))
          });
        }
      }

      if (inflightDirectPromise && !skipDirectFallbackProbe) {
        const fallbackProbeMs = isTurboCopytrade ? 1800 : 1200;
        const settledBeforeFallback = await settleWithin(inflightDirectPromise, fallbackProbeMs);
        if (settledBeforeFallback) {
          lastDirectResult = settledBeforeFallback;
          if (settledBeforeFallback.success) {
            const acceptedBeforeVisibility = evaluateCopytradeBuyAcceptedInflight({
              mode: request.mode,
              isBuyDirection,
              chainId: request.chainId,
              txHash: settledBeforeFallback.txHash,
              runtimeContext: request.runtimeContext,
              lifecycle: settledBeforeFallback.txLifecycle || null
            });
            if (acceptedBeforeVisibility.adoptAcceptedTx) {
              logger.warn(LogCode.SYS_INFO, trace('Direct swap accepted before fallback visibility probe; locking tx and skipping fallback path'), {
                txHash: acceptedBeforeVisibility.txHash || settledBeforeFallback.txHash,
                reasonCode: acceptedBeforeVisibility.reasonCode,
                deferFeeCollection: acceptedBeforeVisibility.shouldDeferFeeCollection,
                probeMs: fallbackProbeMs,
              });
              return {
                success: true,
                txHash: acceptedBeforeVisibility.txHash || settledBeforeFallback.txHash,
                amountOut: settledBeforeFallback.amountOut,
                txLifecycle: settledBeforeFallback.txLifecycle,
                runtimeContext: request.runtimeContext,
                metadata: {
                  provider: settledBeforeFallback.provider || 'direct-swap',
                  mode: request.mode,
                  txLifecycleStatus: settledBeforeFallback.txLifecycle?.status
                }
              };
            }
            const visibleSettled = await enforceVisibilityGate(settledBeforeFallback, 'fallback_probe');
            lastDirectResult = visibleSettled;
            if (visibleSettled.success) {
              logger.warn(LogCode.SYS_INFO, trace('Direct swap settled before fallback send; adopting direct tx'), {
                txHash: visibleSettled.txHash,
                provider: visibleSettled.provider
              });
              return toDirectSuccessResult(visibleSettled);
            }
          }
        }
      }

      const sendStateBeforeFallback = evaluateTurboCopytradeSendState(lastDirectResult?.txLifecycle || null);
      if (sendStateBeforeFallback.adoptAcceptedTx && sendStateBeforeFallback.txHash) {
        logger.warn(LogCode.SYS_INFO, trace('Direct swap has accepted buy evidence before fallback; locking tx and skipping fallback path'), {
          txHash: sendStateBeforeFallback.txHash,
          reasonCode: sendStateBeforeFallback.reasonCode,
          deferFeeCollection: sendStateBeforeFallback.shouldDeferFeeCollection
        });
        return {
          success: true,
          txHash: sendStateBeforeFallback.txHash,
          amountOut: lastDirectResult?.amountOut,
          txLifecycle: lastDirectResult?.txLifecycle,
          runtimeContext: request.runtimeContext,
          metadata: {
            provider: lastDirectResult?.provider || 'direct-swap',
            mode: request.mode,
            txLifecycleStatus: lastDirectResult?.txLifecycle?.status
          }
        };
      }
      if (sendStateBeforeFallback.blockAdditionalSend) {
        logger.warn(LogCode.SYS_INFO, trace('Direct swap send already started; blocking fallback resend for copytrade buy'), {
          txHash: sendStateBeforeFallback.txHash || undefined,
          reasonCode: sendStateBeforeFallback.reasonCode,
          runtimeState: request.runtimeContext?.state || null,
          lifecycleStatus: lastDirectResult?.txLifecycle?.status || request.runtimeContext?.lastLifecycle?.status || null,
        });
        return {
          success: false,
          error: 'copytrade_buy_send_inflight',
          reasonCode: 'copytrade_buy_send_inflight',
          txLifecycle: lastDirectResult?.txLifecycle || request.runtimeContext?.lastLifecycle,
          runtimeContext: request.runtimeContext,
          metadata: {
            provider: lastDirectResult?.provider || 'direct-swap',
            mode: request.mode,
            txLifecycleStatus: lastDirectResult?.txLifecycle?.status || request.runtimeContext?.lastLifecycle?.status,
          }
        };
      }

      const routeMs = directTraceState.first_send_at
        ? directTraceState.first_send_at - directTraceState.direct_start_at
        : null;
      const sendMs = (directTraceState.first_send_at && directTraceState.fanout_done_at)
        ? directTraceState.fanout_done_at - directTraceState.first_send_at
        : null;
      const directFailureMessage = String(lastDirectResult?.error || lastDirectError?.message || '');
      const turboSkip0xBuyNoLiq = isTurboCopytrade
        && isBuyDirection
        && directFailureMessage.includes('liquidity_guard_reject_all');
      const turboCopytradeFallbackPlan = resolveTurboCopytrade0xFallbackPlan({
        isTurboCopytrade,
        isBuyDirection,
        directFailureReason: directTimeoutReason,
        directFailureMessage,
        acceptedDirectEvidence: Boolean(sendStateBeforeFallback.adoptAcceptedTx && sendStateBeforeFallback.txHash),
        hasGuardContext: Boolean(request.executionContext?.copytradeFallbackPricingGuard),
        skipExternalFallback: turboSkip0xFallback,
        skipNoLiquidity: turboSkip0xBuyNoLiq,
      });
      const turboHardFailure = /revert|execution reverted|rpc_failed|all rpc endpoints failed|eth_sendrawtransaction|nonce|insufficient|replacement transaction|network failure|temporarily unavailable|service unavailable|http 50[234]/i.test(directFailureMessage);

      if (isTurboCopytrade && isBuyDirection) {
        const admission = await evaluateCopytradeBuyAdmission({
          pendingPositionId: request.executionContext?.copytradePendingPositionId,
          userId: request.executionContext?.copytradeUserId,
          chainId: request.chainId,
          tokenAddress: request.tokenOut,
          leaderBuyTxHash: request.executionContext?.sourceTxHash,
        });
        if (admission.blocked) {
          logger.warn(LogCode.SYS_INFO, trace('Turbo copytrade buy blocked before fallback due to sell preemption or closed pending position'), {
            reasonCode: admission.reasonCode,
            pendingPositionId: request.executionContext?.copytradePendingPositionId || null,
            targetSellTxHash: admission.targetSellTxHash || null,
            acceptedTxHash: admission.acceptedTxHash || null,
            direct_timeout_reason: directTimeoutReason || undefined,
            fallback_used: false,
          });
          return {
            success: false,
            error: admission.reasonCode,
            txLifecycle: lastDirectResult?.txLifecycle || request.runtimeContext?.lastLifecycle,
            runtimeContext: request.runtimeContext,
            metadata: {
              provider: lastDirectResult?.provider || 'blocked',
              mode: request.mode,
              txLifecycleStatus: lastDirectResult?.txLifecycle?.status || request.runtimeContext?.lastLifecycle?.status,
            }
          };
        }
      }

      if (isTurboCopytrade && isBuyDirection) {
        if (!turboCopytradeFallbackPlan.shouldFallback) {
          logger.warn(LogCode.SYS_INFO, trace('Turbo copytrade buy direct failure; 0x fallback suppressed'), {
            error: directFailureMessage || null,
            fallback_used: false,
            reasonCode: turboCopytradeFallbackPlan.reasonCode,
            route_ms: routeMs,
            send_ms: sendMs,
            direct_timeout_reason: directTimeoutReason || undefined
          });
          return {
            success: false,
            error: directFailureMessage || turboCopytradeFallbackPlan.reasonCode || 'direct_swap_failed',
            txLifecycle: lastDirectResult?.txLifecycle || request.runtimeContext?.lastLifecycle,
            runtimeContext: request.runtimeContext,
            metadata: {
              provider: lastDirectResult?.provider || 'failed',
              mode: request.mode,
              txLifecycleStatus: lastDirectResult?.txLifecycle?.status || request.runtimeContext?.lastLifecycle?.status
            }
          };
        }
        request.allowedDexes = ['0x'];
        request.zeroExQuoteTimeoutMs = turboCopytradeFallbackPlan.quoteTimeoutMs;
      } else if (isTurboCopytrade && !turboHardFailure) {
        logger.warn(LogCode.SYS_INFO, trace('Turbo direct failed without hard-failure signal; skip fallback'), {
          error: directFailureMessage || null,
          fallback_used: false,
          route_ms: routeMs,
          send_ms: sendMs
        });
        return {
          success: false,
          error: directFailureMessage || 'direct_swap_failed_non_hard',
          metadata: {
            provider: lastDirectResult?.provider || 'failed',
            mode: request.mode
          }
        };
      }

      logger.warn(LogCode.SYS_INFO, trace('Turbo diagnostic'), {
        route_ms: routeMs,
        send_ms: sendMs,
        txHash: undefined,
        fallback_used: true,
        fail_reason: directFailureMessage || undefined
      });
      if (request.runtimeContext) {
        markOrderFallbackStarted(request.runtimeContext, inferOrderReasonCode(directFailureMessage || undefined));
      }

      if (lastDirectResult) {
        directTraceState.fallback_start_at = Date.now();
        const failureCode = extractFailureCode(lastDirectResult.error);
        logger.warn(LogCode.SYS_INFO, trace(`${isTurboCopytrade && isBuyDirection ? 'Turbo copytrade buy recoverable direct failure; entering 0x-only fallback' : `Direct swap failed, falling back to 0x: ${lastDirectResult.error || 'unknown'}`}`), {
          error: lastDirectResult.error,
          failureCode,
          directProvider: lastDirectResult.provider,
          poolInfo: lastDirectResult.poolInfo,
          chainId: request.chainId,
          mode: request.mode,
          tokenIn: normalizedTokenIn,
          tokenOut: normalizedTokenOut,
          attempts: DIRECT_SWAP_MAX_ATTEMPTS,
          direct_timeout_reason: directTimeoutReason || undefined,
          fallbackProvider: turboCopytradeFallbackPlan.providerTag || 'aggregator_fallback',
          fallbackBudgetMs: turboCopytradeFallbackPlan.fallbackBudgetMs,
          quoteTimeoutMs: turboCopytradeFallbackPlan.quoteTimeoutMs,
          ...directTraceState
        });
      } else if (lastDirectError) {
        directTraceState.fallback_start_at = Date.now();
        logger.warn(LogCode.SYS_ERROR, trace(isTurboCopytrade && isBuyDirection ? 'Turbo copytrade buy direct error; entering 0x-only fallback' : 'Direct swap error, falling back to 0x'), {
          error: lastDirectError.message,
          chainId: request.chainId,
          mode: request.mode,
          tokenIn: normalizedTokenIn,
          tokenOut: normalizedTokenOut,
          attempts: DIRECT_SWAP_MAX_ATTEMPTS,
          direct_timeout_reason: directTimeoutReason || undefined,
          fallbackProvider: turboCopytradeFallbackPlan.providerTag || 'aggregator_fallback',
          fallbackBudgetMs: turboCopytradeFallbackPlan.fallbackBudgetMs,
          quoteTimeoutMs: turboCopytradeFallbackPlan.quoteTimeoutMs,
          ...directTraceState
        });
      }

      if (turboSkip0xFallback || turboSkip0xBuyNoLiq) {
        const error = lastDirectResult?.error || lastDirectError?.message;
        const skipReason = turboSkip0xFallback
          ? '0x API too slow for turbo sell'
          : 'rescue liquidity guard rejected all pools (0x has no route)';
        logger.warn(LogCode.SYS_INFO, trace('Turbo: skipping 0x fallback'), {
          error,
          skipReason,
          failureCode: extractFailureCode(error),
          chainId: request.chainId
        });
        return {
          success: false,
          error: error || 'Direct swap failed',
          metadata: {
            provider: lastDirectResult?.provider || 'failed',
            mode: request.mode
          }
        };
      }
      } finally {
        const rpcUsageAfter = getRpcMethodUsageSnapshot(request.chainId);
        const delta = diffRpcMethodUsageSnapshots(rpcUsageBefore, rpcUsageAfter);
        if (delta.length > 0) {
          const totals = delta.reduce((acc, row) => {
            acc.requests += row.requests;
            acc.endpointAttempts += row.endpointAttempts;
            acc.successes += row.successes;
            acc.endpointFailures += row.endpointFailures;
            acc.allFailed += row.allFailed;
            acc.timeoutErrors += row.timeoutErrors;
            return acc;
          }, {
            requests: 0,
            endpointAttempts: 0,
            successes: 0,
            endpointFailures: 0,
            allFailed: 0,
            timeoutErrors: 0
          });
          logger.info(LogCode.SYS_INFO, trace('Direct swap RPC usage delta'), {
            chainId: request.chainId,
            mode: request.mode,
            executionMode: request.userSettings?.copyTradeExecutionMode || 'normal',
            tokenIn: normalizedTokenIn.slice(0, 12),
            tokenOut: normalizedTokenOut.slice(0, 12),
            totals,
            topMethods: delta.slice(0, 8).map((row) => ({
              method: row.method,
              requests: row.requests,
              endpointAttempts: row.endpointAttempts,
              successes: row.successes,
              endpointFailures: row.endpointFailures,
              allFailed: row.allFailed,
              timeoutErrors: row.timeoutErrors
            }))
          });
        }
      }
    }

    const requireConfirmedTx = request.requireConfirmedTx === true;
    // CONTEXT MEMORY
    // Updated: 2026-04-23
    // Status: verified
    // Why: wallet-page swap-card execution was returning before on-chain finality, so
    // a sell could finish approval, broadcast the real swap, then revert while the UI
    // still treated the attempt as a completed swap.
    // Debug Goal: swap-card must only report success after the actual swap tx confirms.
    // Search Tags: wallet swap approval only no swap swap-card revert reported success
    // Invariants:
    // - swap-card waits for the real swap tx confirmation before returning success.
    // - allowance mode remains the only EVM mode that can intentionally skip confirmation.
    // Failure Modes:
    // - approval tx succeeds but the swap tx reverts after the API already returned success.
    // - wallet history shows a completed swap even though chain receipt status is failed.
    const shouldWaitForConfirmation = requireConfirmedTx
      ? true
      : request.mode === 'allowance'
        ? false
        : !isTurboCopytrade;
    const confirmationTimeoutMs = requireConfirmedTx
      ? 15000
      : (request.mode === 'allowance' || request.mode === 'copytrade' ? (isTurboCopytrade ? 3000 : 12000) : 60000);
    const useTurboCopytrade0xFallback =
      isTurboCopytrade
      && isBuyDirection
      && Array.isArray(request.allowedDexes)
      && request.allowedDexes.length === 1
      && request.allowedDexes[0] === '0x'
      && request.executionContext?.copytradeFallbackPricingGuard?.stage === '0x_fallback';

    const swapParams: SwapParams = {
      userId: request.userId,
      walletAddress: request.walletAddress,
      tokenIn: normalizedTokenIn,
      tokenOut: normalizedTokenOut,
      amountIn: request.amountIn,
      chainId: request.chainId,
      slippageBps: enforcedSlippageBps,
      feeContext,
      feeBpsOverride: request.feeBpsOverride,
      isSell: isSellDirection,
      messageId: request.messageId, // For WebSocket progress updates
      accessToken: request.accessToken,
      allowPostBroadcastRetry: request.mode !== 'swap-card',
      // CRITICAL: Wait for on-chain confirmation to ensure accurate status reporting
      // - fast-swap: AI-driven chat swaps need accurate status for user feedback
      // - swap-card: API/UI swaps need real confirmation before reporting success
      // - copytrade: Copy trading requires verified confirmation before notifications
      // Only 'allowance' mode skips confirmation (handles separately via allowance trade flow)
      waitForConfirmation: shouldWaitForConfirmation,
      confirmationTimeoutMs,
      returnOnConfirmTimeout: requireConfirmedTx ? false : (request.mode === 'allowance' || request.mode === 'copytrade'),
      speedUpAfterMs: request.mode === 'allowance' || request.mode === 'copytrade' ? (isTurboCopytrade ? 1200 : 6000) : undefined,
      speedUpBumpBps: request.mode === 'copytrade' ? (isTurboCopytrade ? 22000 : 15000) : request.mode === 'allowance' ? 13000 : undefined,
      executionMode: request.userSettings?.copyTradeExecutionMode,
      disableTokenInfo: request.userSettings?.disableTokenInfo === true,
      mevProtection: shouldEnableMevProtection,
      preWarmedNonce: request.preWarmedNonce,
      allowedDexes: request.allowedDexes,
      zeroExQuoteTimeoutMs: request.zeroExQuoteTimeoutMs,
      preferredDexes: request.preferredDexes,
      sourceAnchor: {
        sourceTxHash: request.executionContext?.sourceTxHash || contextSnapshot?.sourceTxHash,
        sourceTokenIn,
        sourceTokenOut,
        sourceAmountIn,
        sourceAmountOut
      },
      nativeBalanceEvidence: request.executionContext?.nativeBalanceEvidence,
      runtimeContext: request.runtimeContext
    };

    if (useTurboCopytrade0xFallback) {
      swapParams.allowedDexes = ['0x'];
      swapParams.zeroExQuoteTimeoutMs = request.zeroExQuoteTimeoutMs;
      swapParams.copytradeFallbackPricingGuard = request.executionContext?.copytradeFallbackPricingGuard;
    }

    if (checkNativeBalancePromise) await checkNativeBalancePromise;
    const executionResult = await SwapExecutor.execute(swapParams);

    if (!executionResult.success) {
      if (useTurboCopytrade0xFallback) {
        const errorText = String(executionResult.error || '');
        const fallbackReasonCode = errorText.includes('quote_anchor_guard_reject')
          ? 'source_anchor_guard_reject'
          : errorText.includes('copytrade_fallback_guard_reject')
            ? 'entry_deviation_guard_reject'
            : errorText.toLowerCase().includes('timeout')
              ? 'quote_timeout'
              : 'send_failure';
        logger.warn(LogCode.SYS_INFO, trace('Turbo copytrade 0x fallback failed'), {
          error: executionResult.error || null,
          reasonCode: fallbackReasonCode,
          provider: executionResult.method || '0x',
          fallbackProvider: request.allowedDexes?.join(',') || '0x',
          quoteTimeoutMs: swapParams.zeroExQuoteTimeoutMs || null
        });
      }
      if (request.runtimeContext) {
        markOrderFallbackResult(request.runtimeContext, false, 'send_rejected');
      }
      throw new Error(executionResult.error || 'EVM swap execution failed');
    }

    if (request.runtimeContext) {
      markOrderFallbackResult(request.runtimeContext, true);
    }

    logger.info(LogCode.EXE_TX_CONFIRMED, trace(useTurboCopytrade0xFallback ? 'Turbo copytrade 0x fallback send succeeded' : 'Fallback swap execution succeeded'), {
      method: executionResult.method,
      txHash: executionResult.txHash,
      amountOut: executionResult.amountOut,
      chainId: request.chainId,
      mode: request.mode,
      fallbackProvider: useTurboCopytrade0xFallback ? 'aggregator_fallback_0x_turbo' : 'aggregator_fallback'
    });

    const result = {
      success: true,
      txHash: executionResult.txHash,
      amountOut: executionResult.amountOut,
      txLifecycle: txLifecycleFromExecutionFinality({
        finalityState: executionResult.finalityState,
        txHash: executionResult.txHash,
        chainId: request.chainId,
      }),
      metadata: {
        provider: useTurboCopytrade0xFallback ? 'aggregator_fallback_0x_turbo' : executionResult.method,
        mode: request.mode,
        gasUsed: undefined,
        launchpad: undefined,
        txLifecycleStatus: txLifecycleFromExecutionFinality({
          finalityState: executionResult.finalityState,
          txHash: executionResult.txHash,
          chainId: request.chainId,
        })?.status,
        buyFeeApplication: !isSellDirection
          ? (
            buildInlineAggregatorBuyFeeApplication({
              feeContext,
              feeBpsOverride: request.feeBpsOverride,
              feeToken: normalizedTokenIn,
              sourceTxHash: executionResult.txHash,
              provider: useTurboCopytrade0xFallback ? 'aggregator_fallback_0x_turbo' : executionResult.method,
            }) || undefined
          )
          : undefined,
      }
    };
    persistLiveSuccessSample({
      txHash: executionResult.txHash,
      amountOut: executionResult.amountOut,
      router: executionResult.metadata?.allowanceTarget,
      selector: sourceSelector,
      commandMetaJson: JSON.stringify({
        source: useTurboCopytrade0xFallback ? 'aggregator_fallback_0x_turbo' : 'aggregator_fallback',
        provider: executionResult.method,
        allowanceTarget: executionResult.metadata?.allowanceTarget || null
      })
    });

    // ⚡ OPTIMIZATION: Post-Buy Pre-Approval
    // If we just BOUGHT a token, valid logic dictates we might sell it later.
    // To save 20s+ on the sell, we approve the router immediately after buying.
    // This is "fire-and-forget" - we do not block the buy response.
    /* [DANGER_ZONE_UNVERIFIED]
    * Logic: Auto-approve newly bought tokens for 0x
    * Risk: User pays gas for approval immediately (even if holding).
    * Mitigation: Only for fast-swap/swap-card modes where speed is priority.
    */
    const isBuy = !swapParams.isSell; // SwapExecutor determines isSell=false for buys
    const targetSpender = executionResult.metadata?.allowanceTarget;
    const outTokenLower = normalizedTokenOut.toLowerCase();
    const isNativeOut =
      outTokenLower === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
      outTokenLower === '0x0000000000000000000000000000000000000000' ||
      outTokenLower === 'eth' ||
      outTokenLower === 'bnb' ||
      outTokenLower === 'sol' ||
      outTokenLower === 'matic' ||
      outTokenLower === 'pol' ||
      outTokenLower === 'avax' ||
      outTokenLower === 'base';

    if (result.success && isBuy && targetSpender && !isNativeOut &&
      (request.mode === 'fast-swap' || request.mode === 'allowance') &&
      isPostBuyPreApprovalEnabled(request.mode, 'fallback')) {

      logger.info(LogCode.EXE_TX_BROADCAST, trace('Initiating Post-Buy Pre-Approval'), {
        token: normalizedTokenOut,
        spender: targetSpender
      });

      // Async execution to not block response
      (async () => {
        try {
          // Import privy service dynamically to avoid circular deps if any nearby
          const { sendTransaction } = await import('./privyWallet.js');

          const iface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
          const approvalData = iface.encodeFunctionData('approve', [targetSpender, ethers.MaxUint256]);

          // Use a deterministic nonce when possible to avoid post-buy nonce conflicts.
          let nextNonce: string | undefined;
          try {
            if (executionResult.txHash) {
              const buyTx = await callRpc<any>(request.chainId, 'eth_getTransactionByHash', [executionResult.txHash], {
                strategy: TRADE_VISIBILITY_PROFILE.strategy,
                purpose: TRADE_VISIBILITY_PROFILE.purpose,
                importance: TRADE_VISIBILITY_PROFILE.importance,
              });
              const buyNonceHex = buyTx?.nonce as string | undefined;
              if (buyNonceHex) {
                const buyNonce = BigInt(buyNonceHex);
                nextNonce = (buyNonce + 1n).toString();
              }
            }
          } catch (nonceErr: any) {
            logger.warn(LogCode.SYS_INFO, trace('Post-Buy nonce prefetch failed, fallback to pending nonce'), {
              error: nonceErr?.message?.slice?.(0, 120)
            });
          }

          const approveTxHash = await sendTransaction(request.userId, request.accessToken || '', {
            to: normalizedTokenOut,
            data: approvalData,
            value: '0',
            chainId: request.chainId,
            nonce: nextNonce,
            txPurpose: 'approval'
          });

          logger.info(LogCode.EXE_TX_CONFIRMED, trace('Post-Buy Pre-Approval Sent'), {
            txHash: approveTxHash,
            token: normalizedTokenOut
          });
        } catch (approvalErr: any) {
          // Non-fatal error, just log it
          logger.warn(LogCode.SYS_ERROR, trace('Failed to execute Post-Buy Pre-Approval'), {
            error: approvalErr.message
          });
        }
      })().catch(err => logger.error(LogCode.SYS_ERROR, 'Uncaught error in pre-approve async', { error: err.message }));
    }

    return result;
  }

  /**
   * Execute Solana swap (Jupiter aggregator)
   */
  private static async executeSolanaSwap(
    request: MainSwapRequest,
    feeContext: FeeContext,
    trace: (msg: string) => string,
    ctx: TradeContext
  ): Promise<MainSwapResult> {
    logger.info(LogCode.EXE_TX_BROADCAST, trace('Executing Solana swap via Jupiter'), {
      chainId: request.chainId,
      tokenIn: request.tokenIn.slice(0, 12),
      tokenOut: request.tokenOut.slice(0, 12)
    });

    const executionMode: CopyTradeExecutionMode = request.userSettings?.copyTradeExecutionMode || 'normal';
    const shouldWaitForConfirmation = request.requireConfirmedTx === true;
    const swapParams: SwapParams = {
      userId: request.userId,
      walletAddress: request.walletAddress,
      tokenIn: request.tokenIn,
      tokenOut: request.tokenOut,
      amountIn: request.amountIn,
      chainId: request.chainId,
      slippageBps: request.slippageBps || 100, // Jupiter default
      feeContext,
      isSell: false,
      accessToken: request.accessToken,
      // OPTIMIZATION: Copytrade fires immediately for speed (confirmation tracked separately)
      waitForConfirmation: shouldWaitForConfirmation,
      executionMode,
      launchpadProvider: request.launchpadProvider,
      runtimeContext: request.runtimeContext
    };

    const result = await SwapExecutor.execute(swapParams);

    if (!result.success) {
      throw new Error(result.error || 'Solana swap execution failed');
    }

    return {
      success: true,
      txHash: result.txHash,
      amountOut: result.amountOut,
      metadata: {
        provider: result.method || 'jupiter',
        mode: request.mode
      }
    };
  }
}
