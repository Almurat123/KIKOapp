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
import { buyTokenAMAP, sellToken } from './fourMemeService.js';
import { SolanaLaunchpadSwapService } from './solanaLaunchpadSwapService.js';
import { getTokenInfo } from './tokenService.js';
import { getPlatformFee, isValidEvmAddress, type FeeContext } from './platformFeeService.js';
import { NATIVE_TOKEN_ADDRESS, SOLANA_NATIVE_MINT, isNativeToken } from '../config/tokenRegistry.js';
import { toWei } from './zeroEx.js';
import { ethers } from 'ethers';

/**
 * Swap execution mode to determine behavior and fee structure
 */
export type SwapMode = 'fast-swap' | 'swap-card' | 'allowance' | 'copytrade' | 'launchpad';

/**
 * Unified swap request accepted by MainSwapService
 */
export interface MainSwapRequest {
  // Identity
  userId: string;
  walletAddress: string;

  // Tokens
  tokenIn: string; // Address or symbol (e.g., "ETH", "0x...")
  tokenOut: string;
  amountIn: string; // Human readable (e.g., "0.1")

  // Chain & Context
  chainId: number; // 900/101 = Solana, others = EVM
  slippageBps?: number; // Default: user setting or 50 (0.5%)

  // Execution Mode (determines fee structure and behavior)
  mode: SwapMode; // 'fast-swap' | 'swap-card' | 'allowance' | 'copytrade' | 'launchpad'

  // Transaction tracking (for WebSocket updates)
  messageId?: string; // Chat message ID for real-time progress updates

  // User Settings
  userSettings?: {
    swapMethod?: 'allowance_trade' | 'wallet_sign';
    fastSwapMode?: boolean;
    quickSwapMode?: boolean;
    mevProtection?: boolean;
  };

  // Launchpad-specific
  launchpadProvider?: 'pumpfun' | 'bonkfun' | 'zora' | 'fourmeme' | 'clanker';
}

/**
 * Unified swap result returned by MainSwapService
 */
export interface MainSwapResult {
  success: boolean;
  txHash?: string;
  amountOut?: string;
  error?: string;
  metadata: {
    provider: string; // '0x', 'kyber', 'jupiter', 'clanker', 'zora', etc.
    mode: SwapMode;
    priceImpact?: number;
    gasUsed?: string;
    launchpad?: string; // Set if launchpad swap
  };
}

/**
 * Launchpad token detection result
 */
interface LaunchpadDetection {
  provider: 'pumpfun' | 'bonkfun' | 'zora' | 'fourmeme' | 'clanker';
  data: any;
  chainId: number;
}

/**
 * Main Swap Service - Core unified swap execution
 */
export class MainSwapService {
  private static readonly TRACE_PREFIX = '[MainSwapService]';

  /**
   * Execute a swap with full routing and error handling
   * This is the single entry point for all swap operations
   */
  static async executeSwap(request: MainSwapRequest): Promise<MainSwapResult> {
    const traceId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const trace = (msg: string) => `${this.TRACE_PREFIX}[${traceId}] ${msg}`;

    logger.info(LogCode.EXE_TX_BROADCAST, trace('Starting unified swap execution'), {
      mode: request.mode,
      tokenIn: request.tokenIn.slice(0, 12),
      tokenOut: request.tokenOut.slice(0, 12),
      amount: request.amountIn,
      chainId: request.chainId
    });

    try {
      // 1. INPUT VALIDATION
      this.validateRequest(request);

      // 2. DETERMINE FEE CONTEXT based on mode
      const feeContext = this.determineFeeContext(request.mode);

      // 3. CHAIN DETECTION
      const isSolana = request.chainId === SOLANA_CONFIG.CHAIN_ID || request.chainId === 101;
      const isEvm = !isSolana;

      // 4. LAUNCHPAD DETECTION (EVM only)
      // DISABLED: ClankerService not ready - use standard DEX (0x/Kyber) for all tokens
      if (isEvm && !request.launchpadProvider) {
        try {
          // Check both tokenOut (for BUY) and tokenIn (for SELL)
          const launchpadDetection = await this.detectLaunchpad(request.tokenOut, request.chainId)
            || await this.detectLaunchpad(request.tokenIn, request.chainId);

          if (launchpadDetection && launchpadDetection.provider !== 'clanker') {
            // Use launchpad routing for non-Clanker tokens only
            logger.info(LogCode.SYS_INFO, trace(`Launchpad detected: ${launchpadDetection.provider}`), {
              provider: launchpadDetection.provider,
              chainId: launchpadDetection.chainId
            });
            request.launchpadProvider = launchpadDetection.provider as any;
          } else if (launchpadDetection?.provider === 'clanker') {
            // DISABLED: ClankerService - use standard 0x/Kyber instead
            logger.info(LogCode.SYS_INFO, trace(`Clanker token detected - routing to standard DEX (0x/Kyber)`));
          }
        } catch (detectErr: any) {
          logger.warn(LogCode.SYS_ERROR, trace(`Launchpad detection failed: ${detectErr.message}`), {
            error: detectErr.message
          });
          // Continue with standard routing if detection fails
        }
      }

      // 5. ROUTE TO APPROPRIATE EXECUTOR
      if (request.launchpadProvider) {
        return await this.executeLaunchpadSwap(request, feeContext, trace);
      } else if (isSolana) {
        return await this.executeSolanaSwap(request, feeContext, trace);
      } else {
        return await this.executeEvmSwap(request, feeContext, trace);
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
        return 'copyTrade'; // 1% fee
      case 'launchpad':
        return 'swap'; // 0.5% fee (launchpad not in FeeContext yet, use swap)
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
    trace: (msg: string) => string
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
          return await this.executeEvmSwap(request, feeContext, trace);
        }

        case 'zora': {
          // EVM - Zora on Base
          // Note: Zora sniper is for notifications, not direct execution
          // For swap execution, we'd use standard DEX routing with Zora token detection
          logger.warn(LogCode.SYS_INFO, trace('Zora swap: using standard EVM routing'), {
            reason: 'Zora sniper handles notifications; swaps via standard DEX'
          });
          return await this.executeEvmSwap(request, feeContext, trace);
        }

        case 'fourmeme': {
          // BSC - Four.meme using TokenManager2
          const tokenInfo = await getTokenInfo(request.tokenIn, request.chainId);
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
        case 'bonkfun': {
          // Solana - Pump.fun or Bonk.fun (LaunchLab)
          const service = new SolanaLaunchpadSwapService();
          const tokenInInfo = await getTokenInfo(request.tokenIn, SOLANA_CONFIG.CHAIN_ID);
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
    trace: (msg: string) => string
  ): Promise<MainSwapResult> {
    logger.info(LogCode.EXE_TX_BROADCAST, trace('Executing EVM swap via SwapExecutor'), {
      chainId: request.chainId,
      tokenIn: request.tokenIn.slice(0, 12),
      tokenOut: request.tokenOut.slice(0, 12)
    });

    const swapParams: SwapParams = {
      userId: request.userId,
      walletAddress: request.walletAddress,
      tokenIn: request.tokenIn,
      tokenOut: request.tokenOut,
      amountIn: request.amountIn,
      chainId: request.chainId,
      slippageBps: request.slippageBps || 50,
      feeContext,
      isSell: false, // Determined automatically by SwapExecutor
      messageId: request.messageId // For WebSocket progress updates
    };

    const result = await SwapExecutor.execute(swapParams);

    if (!result.success) {
      throw new Error(result.error || 'EVM swap execution failed');
    }

    return {
      success: true,
      txHash: result.txHash,
      amountOut: result.amountOut,
      metadata: {
        provider: result.method,
        mode: request.mode,
        gasUsed: result.approvalTx?.value
      }
    };
  }

  /**
   * Execute Solana swap (Jupiter aggregator)
   */
  private static async executeSolanaSwap(
    request: MainSwapRequest,
    feeContext: FeeContext,
    trace: (msg: string) => string
  ): Promise<MainSwapResult> {
    logger.info(LogCode.EXE_TX_BROADCAST, trace('Executing Solana swap via Jupiter'), {
      chainId: request.chainId,
      tokenIn: request.tokenIn.slice(0, 12),
      tokenOut: request.tokenOut.slice(0, 12)
    });

    const swapParams: SwapParams = {
      userId: request.userId,
      walletAddress: request.walletAddress,
      tokenIn: request.tokenIn,
      tokenOut: request.tokenOut,
      amountIn: request.amountIn,
      chainId: request.chainId,
      slippageBps: request.slippageBps || 100, // Jupiter default
      feeContext,
      isSell: false
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
