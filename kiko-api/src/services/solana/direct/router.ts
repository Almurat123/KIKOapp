import { detectLaunchpadToken } from '../../ai/launchpadDetector.js';
import { SolanaLaunchpadSwapService } from '../../solanaLaunchpadSwapService.js';
import type { SolDirectExecutionRequest, SolDirectExecutionResult, SolDirectProvider } from './types.js';
import { executePumpSwapDirect, extractPumpSwapCreatorAddress } from './pumpswapExecutor.js';
import { executeRaydiumLaunchlabDirect } from './raydiumLaunchlabExecutor.js';

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
      return {
        ok: false,
        provider: 'pumpfun',
        reasonCode: 'build_failed',
        message: error?.message || String(error),
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
