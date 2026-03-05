import { SolanaLaunchpadSwapService } from '../../solanaLaunchpadSwapService.js';
import { detectLaunchpadToken } from '../../ai/launchpadDetector.js';
import { getSolanaConnection } from '../../../config/solanaConfig.js';
import { PublicKey } from '@solana/web3.js';
import type { SolDirectExecutionRequest, SolDirectExecutionResult, SolDirectProvider } from './types.js';
import { executePumpSwapDirect } from './pumpswapExecutor.js';
import { executeRaydiumLaunchlabDirect } from './raydiumLaunchlabExecutor.js';
import { executeMeteoraDirect } from './meteoraExecutor.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';

const PUMP_SWAP_PROGRAM_ID = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';

async function extractPumpSwapPoolIdFromSourceTx(sourceTxHash: string | null | undefined, targetMint: string): Promise<string | null> {
  if (!sourceTxHash) return null;
  try {
    const connection = getSolanaConnection('fast', 'critical');
    const tx = await connection.getParsedTransaction(sourceTxHash, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    if (!tx) return null;

    const targetMintNormalized = targetMint.trim();
    const wsolMint = 'So11111111111111111111111111111111111111112';

    const collectInstructionAccounts = (instruction: any): string[] => {
      const accs: string[] = [];
      const accounts = instruction?.accounts;
      if (!Array.isArray(accounts)) return accs;
      for (const a of accounts) {
        if (typeof a === 'string' && a) {
          accs.push(a);
          continue;
        }
        if (a?.pubkey) {
          accs.push(String(a.pubkey));
          continue;
        }
        if (a?.toBase58) {
          accs.push(a.toBase58());
        }
      }
      return accs;
    };

    const pickPoolFromInstruction = async (instruction: any): Promise<string | null> => {
      const programId = instruction?.programId?.toBase58?.() || instruction?.programId?.toString?.() || String(instruction?.programId || '');
      if (programId !== PUMP_SWAP_PROGRAM_ID) return null;

      const accountCandidates = collectInstructionAccounts(instruction);
      for (const account of accountCandidates) {
        try {
          const info = await connection.getAccountInfo(new PublicKey(account), 'confirmed');
          if (!info) continue;
          if (info.owner.toBase58() !== PUMP_SWAP_PROGRAM_ID) continue;
          if (info.data.length < 232) continue;

          const baseMint = new PublicKey(info.data.slice(72, 104)).toBase58();
          const quoteMint = new PublicKey(info.data.slice(104, 136)).toBase58();
          const isTargetWsolPair =
            (baseMint === targetMintNormalized && quoteMint === wsolMint) ||
            (quoteMint === targetMintNormalized && baseMint === wsolMint);

          if (isTargetWsolPair) {
            return account;
          }
        } catch {
          // ignore malformed account candidates
        }
      }
      return null;
    };

    for (const instruction of tx.transaction.message.instructions || []) {
      const poolId = await pickPoolFromInstruction(instruction);
      if (poolId) return poolId;
    }

    for (const inner of tx.meta?.innerInstructions || []) {
      for (const instruction of inner.instructions || []) {
        const poolId = await pickPoolFromInstruction(instruction);
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
  if (provider === 'meteora') return 'meteora';
  return null;
}

export async function executeSolanaDirectLaunchpad(request: SolDirectExecutionRequest): Promise<SolDirectExecutionResult> {
  if (request.provider === 'pumpswap') {
    return executePumpSwapDirect(request);
  }

  if (request.provider === 'raydium_launchlab') {
    return executeRaydiumLaunchlabDirect(request);
  }

  if (request.provider === 'meteora') {
    return executeMeteoraDirect(request);
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
            poolId = await extractPumpSwapPoolIdFromSourceTx(request.sourceTxHash, request.mint);
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
  provider: 'pumpfun' | 'pumpswap' | 'bonkfun' | 'meteora';
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
