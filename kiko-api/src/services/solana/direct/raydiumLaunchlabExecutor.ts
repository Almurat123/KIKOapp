import { SolanaLaunchpadSwapService } from '../../solanaLaunchpadSwapService.js';
import type { SolDirectExecutionRequest, SolDirectExecutionResult } from './types.js';

export async function executeRaydiumLaunchlabDirect(
  request: SolDirectExecutionRequest
): Promise<SolDirectExecutionResult> {
  try {
    const service = new SolanaLaunchpadSwapService();
    const txHash = await service.fastSwap({
      userId: request.userId,
      mint: request.mint,
      amount: request.amountAtomic,
      isBuy: request.isBuy,
      slippageBps: request.slippageBps,
      provider: 'bonkfun',
      feeContext: request.feeContext,
    });

    return {
      ok: true,
      txHash,
      provider: 'raydium_launchlab',
      route: 'direct',
      metadata: {
        family: 'raydium_launchlab',
      },
    };
  } catch (error: any) {
    return {
      ok: false,
      provider: 'raydium_launchlab',
      reasonCode: 'build_failed',
      message: error?.message || String(error),
    };
  }
}
