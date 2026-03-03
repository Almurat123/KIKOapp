import { detectLaunchpadToken } from '../../ai/launchpadDetector.js';
import { SolanaLaunchpadSwapService } from '../../solanaLaunchpadSwapService.js';
import type { SolDirectExecutionRequest, SolDirectExecutionResult, SolDirectProvider } from './types.js';
import { executePumpSwapDirect, extractPumpSwapCreatorAddress } from './pumpswapExecutor.js';
import { executeRaydiumLaunchlabDirect } from './raydiumLaunchlabExecutor.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';

function mapProvider(provider: string): SolDirectProvider | null {
  if (provider === 'pumpfun') return 'pumpfun';
  if (provider === 'pumpswap') return 'pumpswap';
  if (provider === 'bonkfun') return 'raydium_launchlab';
  return null;
}

export async function executeSolanaDirectLaunchpad(request: SolDirectExecutionRequest): Promise<SolDirectExecutionResult> {
  if (request.provider === 'pumpswap') {
    return executePumpSwapDirect(request);
  }

  if (request.provider === 'raydium_launchlab') {
    return executeRaydiumLaunchlabDirect(request);
  }

  if (request.provider === 'pumpfun') {
    try {
      const service = new SolanaLaunchpadSwapService();
      const txHash = await service.fastSwap({
        userId: request.userId,
        mint: request.mint,
        amount: request.amountAtomic,
        isBuy: request.isBuy,
        slippageBps: request.slippageBps,
        provider: 'pumpfun',
        feeContext: request.feeContext,
      });
      return {
        ok: true,
        txHash,
        provider: 'pumpfun',
        route: 'direct',
      };
    } catch (error: any) {
      const msg = error?.message || String(error);

      // Token graduated to PumpSwap AMM — bonding curve is closed.
      // Auto-reroute: detect creator on-chain and execute via pumpswap direct.
      if (msg.includes('PUMPFUN_GRADUATED')) {
        logger.info(LogCode.SYS_INFO, `[SolDirectRouter] pumpfun token graduated, auto-routing to pumpswap direct`, {
          mint: request.mint,
          isBuy: request.isBuy
        });
        try {
          const detection = await detectLaunchpadToken(request.mint, 900, { mode: 'cheap', requireCreator: true }).catch(() => null);
          const detectionData = detection?.provider === 'pumpswap' ? detection.data : null;
          const creatorAddress = extractPumpSwapCreatorAddress(detectionData);
          if (!creatorAddress) {
            logger.warn(LogCode.SYS_ERROR, `[SolDirectRouter] graduated pumpfun: could not detect pumpswap creator, giving up`, { mint: request.mint });
            return { ok: false, provider: 'pumpswap', reasonCode: 'missing_creator', message: 'graduated pumpfun: pumpswap creator not found' };
          }
          logger.info(LogCode.SYS_INFO, `[SolDirectRouter] graduated pumpfun: executing via pumpswap direct`, {
            mint: request.mint,
            creatorAddress
          });
          return await executePumpSwapDirect({ ...request, provider: 'pumpswap', creatorAddress, poolId: null });
        } catch (psErr: any) {
          return { ok: false, provider: 'pumpswap', reasonCode: 'build_failed', message: psErr?.message || String(psErr) };
        }
      }

      return {
        ok: false,
        provider: 'pumpfun',
        reasonCode: 'build_failed',
        message: msg,
      };
    }
  }

  return {
    ok: false,
    provider: request.provider,
    reasonCode: 'unsupported_provider',
    message: `unsupported provider ${request.provider}`,
  };
}

export async function buildSolanaDirectRequest(input: {
  userId: string;
  mint: string;
  amountAtomic: string;
  isBuy: boolean;
  slippageBps: number;
  provider: 'pumpfun' | 'pumpswap' | 'bonkfun';
  feeContext?: 'swap' | 'copyTrade';
}): Promise<SolDirectExecutionRequest> {
  const mapped = mapProvider(input.provider);
  if (!mapped) {
    throw new Error(`unsupported sol direct provider ${input.provider}`);
  }

  if (input.provider !== 'pumpswap') {
    return {
      ...input,
      provider: mapped,
      creatorAddress: null,
      poolId: null,
    };
  }

  const detection = await detectLaunchpadToken(input.mint, 900, { mode: 'cheap', requireCreator: true }).catch(() => null);
  const detectionData = detection?.provider === 'pumpswap' ? detection.data : null;
  const creatorAddress = extractPumpSwapCreatorAddress(detectionData);
  const poolId = detectionData && typeof detectionData === 'object'
    ? String((detectionData as Record<string, unknown>).poolId || (detectionData as Record<string, unknown>).pool_id || (detectionData as Record<string, unknown>).pool || '') || null
    : null;

  return {
    ...input,
    provider: mapped,
    creatorAddress,
    poolId,
  };
}
