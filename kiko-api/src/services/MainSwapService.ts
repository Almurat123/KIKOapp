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

import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { SOLANA_CONFIG } from '../config/solanaConfig.js';
import { getChainConfig } from '../config/chainConfig.js';
import { SwapExecutor, SwapParams, SwapResult } from './swap/SwapExecutor.js';
import { detectLaunchpadToken } from './ai/launchpadDetector.js';

import { zoraSniperService, ZoraSniperService } from './zoraSniperService.js';
import { buyTokenAMAP } from './fourMemeService.js';
import { SolanaLaunchpadSwapService } from './solanaLaunchpadSwapService.js';
import { getTokenInfo } from './tokenService.js';
import { getPlatformFee, isValidEvmAddress, type FeeContext } from './platformFeeService.js';
import { NATIVE_TOKEN_ADDRESS, SOLANA_NATIVE_MINT, isNativeToken } from '../config/tokenRegistry.js';
import { toWei } from './zeroEx.js';
import { ethers } from 'ethers';
import { TradeContext, getTradeContext } from './TradeContext.js';
import { getTokenData } from './UnifiedDataLayer.js';
import { executeDirectSwap, isDirectSwapSupported } from './dex/directSwapService.js';
import { callRpc, diffRpcMethodUsageSnapshots, getRpcMethodUsageSnapshot, waitForReceiptStateMachine } from './rpcManager.js';
import { resolveTokenAddress, normalizeTokenAddress } from './tokens.js';
import { sendTransaction } from './privyWallet.js';
import { isPostBuyPreApprovalEnabled } from './swapPreApprovalPolicy.js';
import type { CopyTradeExecutionMode } from './copyTradeExecutionMode.js';
import type { TxLifecycleResult } from './txLifecycle.js';
import type { ExecutionPlanV1 } from './copytrade/planner/types.js';
import { isP2ExecutorEnabled, isP2SampleLearningEnabled, isP2ShadowRunEnabled } from './copytrade/planner/featureFlags.js';
import { buildPlanCalldata, buildPlanValue, simulatePlan } from './copytrade/planner/shadowRunner.js';
import { recordPlanRun, recordSuccessSample } from './copytrade/planner/sampleLibrary.js';
import type { SwapExecutionContextV1 } from './copytrade/context/types.js';
import { buildDirectSwapHintFromContext } from './copytrade/context/contextStore.js';

/**
 * Swap execution mode to determine behavior and fee structure
 */
export type SwapMode = 'fast-swap' | 'swap-card' | 'allowance' | 'copytrade' | 'launchpad';

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

  // Optional fee override (bps). Used for per-order copytrade fee tiering.
  feeBpsOverride?: number;

  // Transaction tracking (for WebSocket updates)
  messageId?: string; // Chat message ID for real-time progress updates

  // User Settings
  userSettings?: {
    swapMethod?: 'allowance_trade' | 'wallet_sign';
    fastSwapMode?: boolean;
    copyTradeExecutionMode?: CopyTradeExecutionMode;
    quickSwapMode?: boolean;
    mevProtection?: boolean;
  };

  // Launchpad-specific
  launchpadProvider?: 'pumpfun' | 'pumpswap' | 'bonkfun' | 'zora' | 'fourmeme' | 'flap' | 'clanker' | 'virtuals' | 'doppler' | 'flaunch' | 'creatorbid';

  // Copytrade execution hint from target wallet decoded tx
  directSwapHint?: DirectSwapHint;
  executionContext?: {
    sourceTxHash?: string;
    sourceRouter?: string;
    sourceTxInput?: string;
    sourceTxValue?: string;
    sourceTokenIn?: string;
    sourceTokenOut?: string;
    sourceAmountIn?: string;
    sourceAmountOut?: string;
    contextId?: string;
    contextSnapshot?: SwapExecutionContextV1;
    contextHitSource?: 'redis' | 'db' | 'inline' | 'miss';
    strictReplica?: boolean;
  };
  executionPlan?: ExecutionPlanV1;

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
  txLifecycle?: TxLifecycleResult;
  metadata: {
    provider: string; // '0x', 'kyber', 'jupiter', 'clanker', 'zora', etc.
    mode: SwapMode;
    priceImpact?: number;
    gasUsed?: string;
    launchpad?: string; // Set if launchpad swap
    txLifecycleStatus?: TxLifecycleResult['status'];
  };
}

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

  private static async collectDirectSwapFee(
    request: MainSwapRequest,
    normalizedTokenIn: string,
    normalizedTokenOut: string,
    amountOutBase: string | undefined,
    feeContext: FeeContext,
    trace: (msg: string) => string
  ): Promise<void> {
    const fee = getPlatformFee(feeContext, request.feeBpsOverride);
    if (fee.bps <= 0 || !isValidEvmAddress(fee.evmRecipient)) return;
    if (!request.accessToken) {
      logger.warn(LogCode.SYS_INFO, trace('Direct swap fee skipped: missing access token'));
      return;
    }
    let feeToken = normalizedTokenOut;
    let feeBaseAmount = amountOutBase;
    let feeBaseSource: 'amountOut' | 'amountInFallback' = 'amountOut';

    // Some direct-swap executors don't return amountOut. Fall back to amountIn to avoid fee leaks.
    if (!feeBaseAmount) {
      feeBaseSource = 'amountInFallback';
      feeToken = normalizedTokenIn;
      try {
        if (isNativeToken(feeToken, request.chainId)) {
          feeBaseAmount = ethers.parseUnits(request.amountIn, 18).toString();
        } else {
          const tokenInfo = await getTokenInfo(feeToken, request.chainId);
          const decimals = tokenInfo?.decimals ?? 18;
          feeBaseAmount = ethers.parseUnits(request.amountIn, decimals).toString();
        }
        logger.warn(LogCode.SYS_INFO, trace('Direct swap fee fallback: amountOut missing, using amountIn'));
      } catch (fallbackErr: any) {
        logger.warn(LogCode.SYS_INFO, trace('Direct swap fee skipped: missing amountOut and amountIn fallback failed'), {
          error: fallbackErr?.message || String(fallbackErr)
        });
        return;
      }
    }

    let rawOut: bigint;
    try {
      rawOut = BigInt(feeBaseAmount);
    } catch {
      logger.warn(LogCode.SYS_INFO, trace('Direct swap fee skipped: invalid fee base amount format'), {
        feeBaseAmount
      });
      return;
    }
    if (rawOut <= 0n) return;

    const feeAmount = rawOut * BigInt(fee.bps) / 10000n;
    if (feeAmount <= 0n) return;

    if (isNativeToken(feeToken, request.chainId)) {
      const feeTxHash = await sendTransaction(request.userId, request.accessToken, {
        to: fee.evmRecipient!,
        data: '0x',
        value: feeAmount.toString(),
        chainId: request.chainId,
        txPurpose: 'fee'
      });
      logger.info(LogCode.EXE_TX_CONFIRMED, trace('Direct swap native fee sent'), {
        feeTxHash,
        feeBaseSource,
        feeAmount: feeAmount.toString(),
        feeRecipient: fee.evmRecipient
      });
      return;
    }

    const erc20 = new ethers.Interface(['function transfer(address to, uint256 value)']);
    const feeTxHash = await sendTransaction(request.userId, request.accessToken, {
      to: feeToken,
      data: erc20.encodeFunctionData('transfer', [fee.evmRecipient!, feeAmount]),
      value: '0',
      chainId: request.chainId,
      txPurpose: 'fee'
    });
    logger.info(LogCode.EXE_TX_CONFIRMED, trace('Direct swap token fee sent'), {
      feeTxHash,
      token: feeToken,
      feeBaseSource,
      feeAmount: feeAmount.toString(),
      feeRecipient: fee.evmRecipient
    });
  }

  /**
   * Execute a swap with full routing and error handling
   * This is the single entry point for all swap operations
   */
  static async executeSwap(request: MainSwapRequest, tradeContext?: TradeContext): Promise<MainSwapResult> {
    const traceId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const trace = (msg: string) => `${this.TRACE_PREFIX}[${traceId}] ${msg}`;

    // ⚡ Get or create TradeContext for cached data access
    const ctx = tradeContext || TradeContext.create({
      userId: request.userId,
      walletAddress: request.walletAddress,
      chainId: request.chainId,
    });

    logger.info(LogCode.EXE_TX_BROADCAST, trace('Starting unified swap execution'), {
      mode: request.mode,
      tokenIn: request.tokenIn.slice(0, 12),
      tokenOut: request.tokenOut.slice(0, 12),
      amount: request.amountIn,
      chainId: request.chainId,
      tradeContextId: ctx.id
    });

    try {
      // 1. INPUT VALIDATION
      this.validateRequest(request);

      // 2. DETERMINE FEE CONTEXT based on mode
      const feeContext = this.determineFeeContext(request.mode);

      // 3. CHAIN DETECTION
      const isSolana = request.chainId === SOLANA_CONFIG.CHAIN_ID;
      const isEvm = !isSolana;

      const isCopytrade = request.mode === 'copytrade';
      const isTurboCopytrade = isCopytrade && request.userSettings?.copyTradeExecutionMode === 'turbo';

      // 4. LAUNCHPAD DETECTION (EVM only)
      // DISABLED: ClankerService not ready - use standard DEX (0x/Kyber) for all tokens
      if (isEvm && !request.launchpadProvider && !isCopytrade) {
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
            // Use launchpad routing for non-Clanker tokens only
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
            logger.info(LogCode.SYS_INFO, trace(`${launchpadDetection.provider} token detected - routing to standard DEX (0x/Kyber)`));
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
      }

      // 5. ROUTE TO APPROPRIATE EXECUTOR
      if (request.mode === 'copytrade' && request.executionPlan) {
        return await this.executePlannedSwap(request, feeContext, trace, ctx);
      }
      if (request.launchpadProvider) {
        return await this.executeLaunchpadSwap(request, feeContext, trace, ctx);
      } else if (isSolana) {
        return await this.executeSolanaSwap(request, feeContext, trace, ctx);
      } else {
        return await this.executeEvmSwap(request, feeContext, trace, ctx);
      }

    } catch (error: any) {
      logger.error(LogCode.EXE_TX_REVERTED, trace(`Swap execution failed: ${error.message}`), {
        error: error.message,
        stack: error.stack?.split('\n')[0]
      });

      return {
        success: false,
        error: error.message || 'Unknown error during swap execution',
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
    const strictTurboSourceReplay = (process.env.COPYTRADE_TURBO_SOURCE_REPLAY_STRICT || 'true').toLowerCase() === 'true';
    const isTurboCopytrade = request.mode === 'copytrade' && request.userSettings?.copyTradeExecutionMode === 'turbo';
    const p2Mode = isP2ExecutorEnabled() ? 'canary' : 'shadow';
    let simulation: Awaited<ReturnType<typeof simulatePlan>> | null = null;

    if (isP2ShadowRunEnabled()) {
      simulation = await simulatePlan(plan, request.walletAddress);
      await recordPlanRun({
        mode: p2Mode,
        chainId: request.chainId,
        inputJson: JSON.stringify({
          tokenIn: request.tokenIn,
          tokenOut: request.tokenOut,
          amountIn: request.amountIn,
          sourceTxHash: request.executionContext?.sourceTxHash || null
        }),
        planJson: JSON.stringify(plan),
        simulationJson: JSON.stringify(simulation),
        scoreJson: JSON.stringify({ plannerScore: plan.trace?.plannerScore || 0 }),
        selectedTemplateId: plan.templateRef?.templateId,
        resultStatus: simulation.success ? 'shadow_sim_pass' : 'shadow_sim_fail',
        latencyMs: Date.now() - t0
      });
    }

    if (!isP2ExecutorEnabled()) {
      const shouldTrySourceReplay =
        (plan.templateRef?.commandType === 'source_calldata_replay'
          || plan.templateRef?.commandType === 'source_raw_calldata_replay')
        && simulation?.success === true
        && /^0x[a-fA-F0-9]{40}$/.test(String(plan.templateRef?.router || ''));
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
            ...(isTurboCopytrade ? { executionProfile: request.chainId === 8453 ? 'base-sniper' : request.chainId === 56 ? 'bsc-sniper' : undefined } : {})
          });
          await recordPlanRun({
            mode: 'canary',
            chainId: request.chainId,
            inputJson: JSON.stringify({
              tokenIn: request.tokenIn,
              tokenOut: request.tokenOut,
              amountIn: request.amountIn,
              sourceTxHash: request.executionContext?.sourceTxHash || null
            }),
            planJson: JSON.stringify(plan),
            simulationJson: JSON.stringify(simulation),
            scoreJson: JSON.stringify({ plannerScore: plan.trace?.plannerScore || 0 }),
            selectedTemplateId: plan.templateRef?.templateId,
            resultStatus: 'source_replay_tx_sent',
            txHash: replayTxHash,
            latencyMs: Date.now() - t0
          });
          logger.info(LogCode.SYS_INFO, trace('[P2] Source replay sent before external quote fallback'), {
            chainId: request.chainId,
            sourceTxHash: request.executionContext?.sourceTxHash || null,
            replayTxHash
          });
          return {
            success: true,
            txHash: replayTxHash,
            metadata: {
              provider: 'p2-source-replay',
              mode: request.mode
            }
          };
        } catch (replayError: any) {
          if (
            strictTurboSourceReplay
            && isTurboCopytrade
            && (plan.templateRef?.commandType === 'source_calldata_replay'
              || plan.templateRef?.commandType === 'source_raw_calldata_replay')
          ) {
            logger.error(LogCode.EXE_TX_REVERTED, trace('[P2] Source replay failed in strict turbo mode; aborting without external fallback'), {
              chainId: request.chainId,
              error: replayError?.message || String(replayError),
              sourceTxHash: request.executionContext?.sourceTxHash || null
            });
            return {
              success: false,
              error: `source_replay_failed_strict_turbo:${replayError?.message || String(replayError)}`,
              metadata: {
                provider: 'p2-source-replay',
                mode: request.mode
              }
            };
          }
          logger.warn(LogCode.SYS_INFO, trace('[P2] Source replay failed, falling back to external quote path'), {
            chainId: request.chainId,
            error: replayError?.message || String(replayError),
            sourceTxHash: request.executionContext?.sourceTxHash || null
          });
        }
      }
      logger.info(LogCode.SYS_INFO, trace('[P2] Planned swap shadow mode, fallback to current execution path'), {
        chainId: request.chainId,
        templateId: plan.templateRef?.templateId,
        simulationSuccess: simulation?.success ?? null
      });
      return await this.executeEvmSwap(request, feeContext, trace, ctx);
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
      return await this.executeEvmSwap(request, feeContext, trace, ctx);
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
      ...(isTurboCopytrade ? { executionProfile: request.chainId === 8453 ? 'base-sniper' : request.chainId === 56 ? 'bsc-sniper' : undefined } : {})
    });
    const result: MainSwapResult = {
      success: true,
      txHash,
      amountOut: undefined,
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
        sourceTxHash: request.executionContext?.sourceTxHash || null
      }),
      planJson: JSON.stringify(plan),
      scoreJson: JSON.stringify({ plannerScore: plan.trace?.plannerScore || 0 }),
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
          sourceTxHash: request.executionContext?.sourceTxHash || null,
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
          // BSC - Four.meme using TokenManager2
          // ⚡ Use TradeContext-aware data fetching (auto-caches)
          const tokenInfo = await getTokenData(request.tokenIn, request.chainId, ctx);
          const decimals = tokenInfo?.decimals || 18;
          const amountInWei = toWei(request.amountIn, decimals);

          txHash = await buyTokenAMAP({
            userId: request.userId,
            walletAddress: request.walletAddress,
            tokenAddress: request.tokenOut,
            bnbAmount: request.amountIn,
            slippageBps: request.slippageBps || 300,
            feeContext
          });
          providerName = 'fourmeme';
          break;
        }

        case 'pumpfun':
        case 'pumpswap':
        case 'bonkfun': {
          // Solana launchpads:
          // - pumpfun/bonkfun: native launchpad program path
          // - pumpswap: treat as post-bonding AMM and route via fast Solana swap path
          if (provider === 'pumpswap') {
            const result = await this.executeSolanaSwap(request, feeContext, trace, ctx);
            result.metadata = {
              ...(result.metadata || {}),
              launchpad: 'pumpswap'
            };
            return result;
          }

          // Solana - Pump.fun or Bonk.fun (LaunchLab)
          const service = new SolanaLaunchpadSwapService();
          // ⚡ Use TradeContext-aware data fetching (auto-caches)
          const tokenInInfo = await getTokenData(request.tokenIn, SOLANA_CONFIG.CHAIN_ID, ctx);
          const decimals = tokenInInfo?.decimals || (provider === 'bonkfun' ? 6 : 9);

          const amountAtomic = Math.floor(
            parseFloat(request.amountIn) * Math.pow(10, decimals)
          ).toString();

          txHash = await service.fastSwap({
            userId: request.userId,
            mint: request.tokenOut,
            amount: amountAtomic,
            isBuy: true,
            slippageBps: request.slippageBps || 300,
            provider: provider as 'pumpfun' | 'bonkfun',
            feeContext
          });
          providerName = provider;
          break;
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
   * Execute EVM swap (0x, Kyber, etc.)
   */
  private static async executeEvmSwap(
    request: MainSwapRequest,
    feeContext: FeeContext,
    trace: (msg: string) => string,
    ctx: TradeContext
  ): Promise<MainSwapResult> {
    const TURBO_TOTAL_BUDGET_MS = 6500;
    const TURBO_DIRECT_ATTEMPT_TIMEOUT_MS = 4200;
    const TURBO_DIRECT_MAX_ATTEMPTS = 2;
    const BALANCED_DIRECT_MAX_ATTEMPTS = 2;
    const TURBO_ADAPTIVE_RETRY_AMOUNT = false;
    const TURBO_SKIP_FALLBACK_ON_TIMEOUT = true;
    const TURBO_DIRECT_LATE_SETTLE_MS = 2000;
    const TURBO_DIRECT_FINAL_SETTLE_MS = 4500;
    const DIRECT_SWAP_VISIBILITY_GATE_MS_TURBO = 5200;
    const DIRECT_SWAP_VISIBILITY_GATE_MS_NORMAL = 4200;
    const DIRECT_SWAP_VISIBILITY_GATE_POLL_MS = 320;
    // 0x API is typically 10s+; skip fallback in turbo so we fail fast instead of waiting.
    const TURBO_SKIP_0X_FALLBACK = true;
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

      // ⚡ TURBO TRUSTED BROADCAST: In turbo copytrade the tx was successfully broadcast
      // to the network via eth_sendRawTransaction fanout. RPC degradation should NOT cause
      // us to declare the tx "failed" — the fanout already relayed it to block builders.
      // Accept broadcasted_unseen as success; position monitor will track confirmation.
      if (isTurboCopytrade && lifecycleStatus === 'broadcasted_unseen') {
        logger.info(LogCode.SYS_INFO, trace('Direct swap tx broadcasted — skipping visibility gate in turbo (RPC may be degraded)'), {
          stage,
          txHash: directResult.txHash,
          mode: request.mode
        });
        return directResult; // success: true, txHash set — good enough
      }

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

      if (lifecycle?.status === 'visible_pending' || lifecycle?.status === 'confirmed_success') {
        logger.info(LogCode.SYS_INFO, trace('Direct swap tx passed visibility gate'), {
          stage,
          txHash: directResult.txHash,
          visibilityStatus: lifecycle.status,
          attempts: lifecycle.attempts
        });
        return {
          ...directResult,
          txLifecycle: lifecycle
        };
      }

      const visibilityFailure = lifecycle?.status || directResult.txLifecycle?.status || 'broadcasted_unseen';
      const visibilityReason = lifecycle?.lastRpcError
        || directResult.txLifecycle?.lastRpcError
        || 'not_found_by_rpc';
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
        ? (async () => {
            const amountInWei = ethers.parseUnits(request.amountIn, 18);
            const chainCfg = getChainConfig(request.chainId);
            const reserveWei = ethers.parseUnits(chainCfg.gasReserve || '0.003', 18);
            const balanceHex = await callRpc<string>(
              request.chainId,
              'eth_getBalance',
              [request.walletAddress, 'latest'],
              { importance: 'critical', strategy: 'fast' }
            );
            const balanceWei = BigInt(balanceHex);
            const requiredWei = amountInWei + reserveWei;
            if (balanceWei < requiredWei) {
              throw new Error(
                `insufficient_native_balance_precheck: have=${ethers.formatEther(balanceWei)} required=${ethers.formatEther(requiredWei)}`
              );
            }
          })()
        : null;

    logger.info(LogCode.EXE_TX_BROADCAST, trace('Executing EVM swap'), {
      chainId: request.chainId,
      tokenIn: normalizedTokenIn.slice(0, 12),
      tokenOut: normalizedTokenOut.slice(0, 12),
      fastSwapMode: request.userSettings?.fastSwapMode,
      contextHitSource: request.executionContext?.contextHitSource || 'miss',
      contextId: request.executionContext?.contextId || null
    });

    // [Logic]: FastSwapMode 使用直接交易 (V3/V4)，跳过 0x/Kyber
    // [Logic]: 买入方向判定基于 cash -> token（支持 ETH/WETH/USDC/USDT）
    // [Logic]: cash -> cash（例如 ETH -> USDC）不应触发买入直连
    const isCashIn = isCashLikeToken(normalizedTokenIn, request.chainId);
    const isCashOut = isCashLikeToken(normalizedTokenOut, request.chainId);
    const isBuyDirection = isCashIn && !isCashOut;
    const isSellDirection = !isCashIn && isCashOut;
    const sampleSide: 'buy' | 'sell' = isSellDirection ? 'sell' : 'buy';
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
    const copytradeAggregatorOnly = request.mode === 'copytrade'
      && isSellDirection
      && (process.env.COPYTRADE_AGGREGATOR_ONLY || 'true').toLowerCase() === 'true';
    const allowDirectSell = !copytradeAggregatorOnly && request.mode === 'copytrade' && isSellDirection;
    const turboBuyForceDirect = isTurboCopytrade && isBuyDirection;
    const turboSkipFallbackOnTimeout = isTurboCopytrade && isSellDirection && TURBO_SKIP_FALLBACK_ON_TIMEOUT;
    const turboSkip0xFallback = isTurboCopytrade && isSellDirection && TURBO_SKIP_0X_FALLBACK;
    const enforcedSlippageBps = request.mode === 'copytrade'
      ? (request.slippageBps ?? 1500)
      : (request.slippageBps ?? 50);
    const fastSwapEnabled = !copytradeAggregatorOnly
      && (request.userSettings?.fastSwapMode === true || turboBuyForceDirect);
    if (!fastSwapEnabled || !isDirectSwapSupported(request.chainId) || (!isBuyDirection && !allowDirectSell)) {
      const reasons: string[] = [];
      if (!fastSwapEnabled) reasons.push('fastSwapMode=false');
      if (!isDirectSwapSupported(request.chainId)) reasons.push('chain_not_supported');
      if (!isBuyDirection && !allowDirectSell) reasons.push('unsupported_direction');
      logger.debug(LogCode.SYS_INFO, trace('Direct swap not attempted'), {
        reasons,
        fastSwapEnabled,
        isDirectSwapSupported: isDirectSwapSupported(request.chainId),
        isBuyDirection,
        isSellDirection,
        allowDirectSell,
        copytradeAggregatorOnly,
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
      // Default: turbo uses 2 direct attempts to avoid bursting RPC under degraded conditions.
      const DIRECT_SWAP_MAX_ATTEMPTS = isTurboCopytrade ? TURBO_DIRECT_MAX_ATTEMPTS : BALANCED_DIRECT_MAX_ATTEMPTS;
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
      try {
        for (let attempt = 1; attempt <= DIRECT_SWAP_MAX_ATTEMPTS; attempt++) {
          const remainingTurboBudget = TURBO_TOTAL_BUDGET_MS - (Date.now() - turboBudgetStart);
          if (isTurboCopytrade && remainingTurboBudget <= 0) {
            lastDirectError = new Error(`timeout_turbo_budget_${TURBO_TOTAL_BUDGET_MS}ms`);
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
              executionMode: request.userSettings?.copyTradeExecutionMode
            })
          );
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

              logger.warn(LogCode.SYS_INFO, trace('Turbo direct timeout; waiting late-settle window'), {
                attempt,
                timeoutMs,
                lateSettleMs: TURBO_DIRECT_LATE_SETTLE_MS
              });

              const lateResult = await settleWithin(inflightDirectPromise, TURBO_DIRECT_LATE_SETTLE_MS);

              if (lateResult) {
                directResult = lateResult;
                if (directResult.success) {
                  logger.info(LogCode.SYS_INFO, trace('Turbo direct late-settle succeeded'), {
                    attempt,
                    provider: directResult.provider,
                    txHash: directResult.txHash
                  });
                } else {
                  logger.warn(LogCode.SYS_INFO, trace('Turbo direct late-settle resolved with failure'), {
                    attempt,
                    error: directResult.error,
                    provider: directResult.provider
                  });
                }
              } else {
                lastDirectError = timeoutErr;
                if (attempt < DIRECT_SWAP_MAX_ATTEMPTS) {
                  logger.warn(LogCode.SYS_INFO, trace('Turbo direct late-settle unavailable; keep inflight exclusive and await final settle'), {
                    attempt,
                    maxAttempts: DIRECT_SWAP_MAX_ATTEMPTS
                  });
                }
                break;
              }
            }
          } else {
            directResult = await inflightDirectPromise;
          }
          lastDirectResult = directResult;

          if (directResult.success) {
            const visibleResult = await enforceVisibilityGate(directResult, `attempt_${attempt}`);
            lastDirectResult = visibleResult;
            if (!visibleResult.success) {
              if (attempt < DIRECT_SWAP_MAX_ATTEMPTS) {
                logger.warn(LogCode.SYS_INFO, trace('Direct swap visibility gate failed, retrying next attempt'), {
                  attempt,
                  maxAttempts: DIRECT_SWAP_MAX_ATTEMPTS,
                  error: visibleResult.error
                });
              }
              continue;
            }
            if (checkNativeBalancePromise) await checkNativeBalancePromise;
            try {
              await this.collectDirectSwapFee(
                request,
                normalizedTokenIn,
                normalizedTokenOut,
                visibleResult.amountOut,
                feeContext,
                trace
              );
            } catch (feeErr: any) {
              logger.warn(LogCode.SYS_ERROR, trace('Direct swap fee transfer failed (non-fatal)'), {
                error: feeErr?.message || String(feeErr)
              });
            }
            logger.info(LogCode.EXE_TX_CONFIRMED, trace(`Direct swap successful txHash=${visibleResult.txHash ?? 'null'}`), {
              txHash: visibleResult.txHash,
              provider: visibleResult.provider,
              poolInfo: visibleResult.poolInfo,
              attempt
            });
            persistLiveSuccessSample({
              txHash: visibleResult.txHash,
              amountOut: visibleResult.amountOut,
              router: (visibleResult as any)?.poolInfo?.poolAddress,
              poolMetaJson: visibleResult.poolInfo ? JSON.stringify(visibleResult.poolInfo) : undefined,
              commandMetaJson: JSON.stringify({
                source: 'direct_swap',
                provider: visibleResult.provider,
                txLifecycleStatus: visibleResult.txLifecycle?.status || null
              })
            });
            return {
              success: true,
              txHash: visibleResult.txHash,
              amountOut: visibleResult.amountOut,
              txLifecycle: visibleResult.txLifecycle,
              metadata: {
                provider: visibleResult.provider,
                mode: request.mode,
                txLifecycleStatus: visibleResult.txLifecycle?.status
              }
            };
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
        }
      } catch (directErr: any) {
        lastDirectError = directErr;
      }

      if (
        isTurboCopytrade &&
        isTimeoutError(lastDirectError) &&
        inflightDirectPromise
      ) {
        const remainingBudgetForFinalSettle = Math.max(200, TURBO_TOTAL_BUDGET_MS - (Date.now() - turboBudgetStart));
        const finalSettleMs = Math.max(TURBO_DIRECT_FINAL_SETTLE_MS, remainingBudgetForFinalSettle);
        logger.warn(LogCode.SYS_INFO, trace('Turbo direct timed out; awaiting final settle window'), {
          finalSettleMs,
          remainingBudgetForFinalSettle,
          error: lastDirectError?.message
        });
        try {
          const finalResult = await settleWithin(inflightDirectPromise, finalSettleMs);
          if (finalResult) {
            lastDirectResult = finalResult;
            if (finalResult.success) {
              const visibleFinalResult = await enforceVisibilityGate(finalResult, 'final_settle');
              lastDirectResult = visibleFinalResult;
              if (!visibleFinalResult.success) {
                lastDirectError = new Error(visibleFinalResult.error || 'direct_swap_visibility_gate_failed');
              } else {
                if (checkNativeBalancePromise) await checkNativeBalancePromise;
                try {
                  await this.collectDirectSwapFee(
                    request,
                    normalizedTokenIn,
                    normalizedTokenOut,
                    visibleFinalResult.amountOut,
                    feeContext,
                    trace
                  );
                } catch (feeErr: any) {
                  logger.warn(LogCode.SYS_ERROR, trace('Direct swap fee transfer failed (non-fatal)'), {
                    error: feeErr?.message || String(feeErr)
                  });
                }
                logger.info(LogCode.EXE_TX_CONFIRMED, trace(`Direct swap successful after final settle txHash=${visibleFinalResult.txHash ?? 'null'}`), {
                  txHash: visibleFinalResult.txHash,
                  provider: visibleFinalResult.provider,
                  poolInfo: visibleFinalResult.poolInfo
                });
                persistLiveSuccessSample({
                  txHash: visibleFinalResult.txHash,
                  amountOut: visibleFinalResult.amountOut,
                  router: (visibleFinalResult as any)?.poolInfo?.poolAddress,
                  poolMetaJson: visibleFinalResult.poolInfo ? JSON.stringify(visibleFinalResult.poolInfo) : undefined,
                  commandMetaJson: JSON.stringify({
                    source: 'direct_swap',
                    provider: visibleFinalResult.provider,
                    stage: 'final_settle',
                    txLifecycleStatus: visibleFinalResult.txLifecycle?.status || null
                  })
                });
                return {
                  success: true,
                  txHash: visibleFinalResult.txHash,
                  amountOut: visibleFinalResult.amountOut,
                  txLifecycle: visibleFinalResult.txLifecycle,
                  metadata: {
                    provider: visibleFinalResult.provider,
                    mode: request.mode,
                    txLifecycleStatus: visibleFinalResult.txLifecycle?.status
                  }
                };
              }
            } else {
              lastDirectError = new Error(finalResult.error || 'direct_swap_final_settle_failed');
            }
          }
        } catch (finalSettleError: any) {
          lastDirectError = finalSettleError;
        }
      }

      if (
        isTurboCopytrade &&
        turboSkipFallbackOnTimeout &&
        isTimeoutError(lastDirectError)
      ) {
        if (inflightDirectPromise) {
          const finalFlushMs = Math.max(TURBO_DIRECT_FINAL_SETTLE_MS + 2500, 6500);
          logger.warn(LogCode.SYS_INFO, trace('Turbo direct timeout before fallback; forcing final settle flush'), {
            finalFlushMs,
            error: lastDirectError?.message
          });
          try {
            const flushedResult = await settleWithin(inflightDirectPromise, finalFlushMs);
            if (flushedResult) {
              lastDirectResult = flushedResult;
              if (flushedResult.success) {
                const visibleFlushed = await enforceVisibilityGate(flushedResult, 'timeout_flush');
                lastDirectResult = visibleFlushed;
                if (visibleFlushed.success) {
                  if (checkNativeBalancePromise) await checkNativeBalancePromise;
                  try {
                    await this.collectDirectSwapFee(
                      request,
                      normalizedTokenIn,
                      normalizedTokenOut,
                      visibleFlushed.amountOut,
                      feeContext,
                      trace
                    );
                  } catch (feeErr: any) {
                    logger.warn(LogCode.SYS_ERROR, trace('Direct swap fee transfer failed (non-fatal)'), {
                      error: feeErr?.message || String(feeErr)
                    });
                  }
                  logger.info(LogCode.EXE_TX_CONFIRMED, trace(`Direct swap successful after timeout flush txHash=${visibleFlushed.txHash ?? 'null'}`), {
                    txHash: visibleFlushed.txHash,
                    provider: visibleFlushed.provider,
                    poolInfo: visibleFlushed.poolInfo
                  });
                  persistLiveSuccessSample({
                    txHash: visibleFlushed.txHash,
                    amountOut: visibleFlushed.amountOut,
                    router: (visibleFlushed as any)?.poolInfo?.poolAddress,
                    poolMetaJson: visibleFlushed.poolInfo ? JSON.stringify(visibleFlushed.poolInfo) : undefined,
                    commandMetaJson: JSON.stringify({
                      source: 'direct_swap',
                      provider: visibleFlushed.provider,
                      stage: 'timeout_flush',
                      txLifecycleStatus: visibleFlushed.txLifecycle?.status || null
                    })
                  });
                  return {
                    success: true,
                    txHash: visibleFlushed.txHash,
                    amountOut: visibleFlushed.amountOut,
                    txLifecycle: visibleFlushed.txLifecycle,
                    metadata: {
                      provider: visibleFlushed.provider,
                      mode: request.mode,
                      txLifecycleStatus: visibleFlushed.txLifecycle?.status
                    }
                  };
                }
                lastDirectError = new Error(visibleFlushed.error || 'direct_swap_visibility_gate_failed');
              } else {
                lastDirectError = new Error(flushedResult.error || 'direct_swap_timeout_flush_failed');
              }
            }
          } catch (flushError: any) {
            lastDirectError = flushError;
          }
        }

        logger.warn(LogCode.SYS_INFO, trace('Turbo direct path timed out, skipping fallback by policy'), {
          error: lastDirectError?.message,
          budgetMs: TURBO_TOTAL_BUDGET_MS,
          attemptTimeoutMs: TURBO_DIRECT_ATTEMPT_TIMEOUT_MS,
          lateSettleMs: TURBO_DIRECT_LATE_SETTLE_MS
        });
        return {
          success: false,
          error: lastDirectError?.message || 'Turbo direct timeout',
          metadata: {
            provider: lastDirectResult?.provider || 'failed',
            mode: request.mode
          }
        };
      }

      if (lastDirectResult) {
        const failureCode = extractFailureCode(lastDirectResult.error);
        logger.warn(LogCode.SYS_INFO, trace(`Direct swap failed, falling back to 0x/Kyber: ${lastDirectResult.error || 'unknown'}`), {
          error: lastDirectResult.error,
          failureCode,
          directProvider: lastDirectResult.provider,
          poolInfo: lastDirectResult.poolInfo,
          chainId: request.chainId,
          mode: request.mode,
          tokenIn: normalizedTokenIn,
          tokenOut: normalizedTokenOut,
          attempts: DIRECT_SWAP_MAX_ATTEMPTS
        });
      } else if (lastDirectError) {
        logger.warn(LogCode.SYS_ERROR, trace('Direct swap error, falling back to 0x/Kyber'), {
          error: lastDirectError.message,
          chainId: request.chainId,
          mode: request.mode,
          tokenIn: normalizedTokenIn,
          tokenOut: normalizedTokenOut,
          attempts: DIRECT_SWAP_MAX_ATTEMPTS
        });
      }

      // For turbo BUY: also skip 0x when rescue already called getZeroExPrice and got
      // liquidityAvailable=false for every candidate pool (= liquidity_guard_reject_all).
      // In that case 0x quote will also return no-liquidity — don't waste 3-15s on it.
      const directErrorCode = lastDirectResult?.error || lastDirectError?.message || '';
      const turboSkip0xBuyNoLiq = isTurboCopytrade
        && isBuyDirection
        && directErrorCode.includes('liquidity_guard_reject_all');

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
    const shouldWaitForConfirmation = requireConfirmedTx ? true : !isTurboCopytrade;
    const confirmationTimeoutMs = requireConfirmedTx
      ? 15000
      : (request.mode === 'allowance' || request.mode === 'copytrade' ? (isTurboCopytrade ? 3000 : 12000) : 60000);

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
      preWarmedNonce: request.preWarmedNonce,
      sourceAnchor: {
        sourceTxHash: request.executionContext?.sourceTxHash || contextSnapshot?.sourceTxHash,
        sourceTokenIn,
        sourceTokenOut,
        sourceAmountIn,
        sourceAmountOut
      }
    };

    if (checkNativeBalancePromise) await checkNativeBalancePromise;
    const executionResult = await SwapExecutor.execute(swapParams);

    if (!executionResult.success) {
      throw new Error(executionResult.error || 'EVM swap execution failed');
    }

    logger.info(LogCode.EXE_TX_CONFIRMED, trace('Fallback swap execution succeeded'), {
      method: executionResult.method,
      txHash: executionResult.txHash,
      amountOut: executionResult.amountOut,
      chainId: request.chainId,
      mode: request.mode
    });

    const result = {
      success: true,
      txHash: executionResult.txHash,
      amountOut: executionResult.amountOut,
      metadata: {
        provider: executionResult.method,
        mode: request.mode,
        gasUsed: undefined,
        launchpad: undefined
      }
    };
    persistLiveSuccessSample({
      txHash: executionResult.txHash,
      amountOut: executionResult.amountOut,
      router: executionResult.metadata?.allowanceTarget,
      selector: sourceSelector,
      commandMetaJson: JSON.stringify({
        source: 'aggregator_fallback',
        provider: executionResult.method,
        allowanceTarget: executionResult.metadata?.allowanceTarget || null
      })
    });

    // ⚡ OPTIMIZATION: Post-Buy Pre-Approval
    // If we just BOUGHT a token, valid logic dictates we might sell it later.
    // To save 20s+ on the sell, we approve the router immediately after buying.
    // This is "fire-and-forget" - we do not block the buy response.
    /* [DANGER_ZONE_UNVERIFIED]
    * Logic: Auto-approve newly bought tokens for 0x/Kyber
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
                strategy: 'fast',
                importance: 'critical'
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
      launchpadProvider: request.launchpadProvider
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
