import { SolanaLaunchpadSwapService } from '../../solanaLaunchpadSwapService.js';
import { detectLaunchpadToken } from '../../ai/launchpadDetector.js';
import { getSolanaConnection } from '../../../config/solanaConfig.js';
import type { SolDirectExecutionRequest, SolDirectExecutionResult, SolDirectProvider } from './types.js';
import { executePumpSwapDirect } from './pumpswapExecutor.js';
import { executeRaydiumLaunchlabDirect } from './raydiumLaunchlabExecutor.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';

const PUMP_SWAP_PROGRAM_ID = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';

async function extractPumpSwapPoolIdFromSourceTx(sourceTxHash?: string | null): Promise<string | null> {
  if (!sourceTxHash) return null;
  try {
    const connection = getSolanaConnection('fast', 'critical');
    const tx = await connection.getParsedTransaction(sourceTxHash, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    if (!tx) return null;

    const pickPoolFromInstruction = (instruction: any): string | null => {
      const programId = instruction?.programId?.toBase58?.() || instruction?.programId?.toString?.() || String(instruction?.programId || '');
      if (programId !== PUMP_SWAP_PROGRAM_ID) return null;
      const accounts = instruction?.accounts;
      if (!Array.isArray(accounts) || accounts.length === 0) return null;
      const first = accounts[0];
      if (typeof first === 'string' && first) return first;
      if (first?.pubkey) return String(first.pubkey);
      if (first?.toBase58) return first.toBase58();
      return null;
    };

    for (const instruction of tx.transaction.message.instructions || []) {
      const poolId = pickPoolFromInstruction(instruction);
      if (poolId) return poolId;
    }

    for (const inner of tx.meta?.innerInstructions || []) {
      for (const instruction of inner.instructions || []) {
        const poolId = pickPoolFromInstruction(instruction);
        if (poolId) return poolId;
      }
    }
  } catch {
    // ignore and let other hints/fallbacks handle routing
  }
  return null;
}

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
      // Re-route to pumpswap direct. executePumpSwapDirect will parse the creator
      // from the on-chain pool account data (offset 40), no external API needed.
      if (msg.includes('PUMPFUN_GRADUATED')) {
        logger.info(LogCode.SYS_INFO, `[SolDirectRouter] pumpfun token graduated, auto-routing to pumpswap direct (creator resolved on-chain)`, {
          mint: request.mint,
          isBuy: request.isBuy
        });
        try {
          const detection = await detectLaunchpadToken(request.mint, 900, { mode: 'cheap', requireCreator: false }).catch(() => null);
          const detectionData = detection?.data as Record<string, unknown> | undefined;
          let poolId = detectionData
            ? String(detectionData.poolId || detectionData.pool_id || detectionData.pool || detectionData.poolAddress || '') || null
            : null;
          if (!poolId && request.sourceTxHash) {
            poolId = await extractPumpSwapPoolIdFromSourceTx(request.sourceTxHash);
            if (poolId) {
              logger.info(LogCode.SYS_INFO, '[SolDirectRouter] resolved pumpswap pool from source tx', {
                mint: request.mint,
                sourceTxHash: request.sourceTxHash,
                poolId,
              });
            }
          }
          return await executePumpSwapDirect({ ...request, provider: 'pumpswap', creatorAddress: null, poolId });
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
  sourceTxHash?: string | null;
}): Promise<SolDirectExecutionRequest> {
  const mapped = mapProvider(input.provider);
  if (!mapped) {
    throw new Error(`unsupported sol direct provider ${input.provider}`);
  }

  // creatorAddress for pumpswap is resolved on-chain inside executePumpSwapDirect.
  return {
    ...input,
    provider: mapped,
    creatorAddress: null,
    poolId: null,
  };
}
