import { detectLaunchpadToken } from '../../ai/launchpadDetector.js';
import { getNativeTokenPriceUsd } from '../../onChainPriceService.js';
import { getSolanaConnection } from '../../../config/solanaConfig.js';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '../../../utils/solanaToken.js';
import type { SolDirectLiquiditySnapshot } from './types.js';
import { getPumpSwapLiquidityUsd } from './pumpswapExecutor.js';

const RAYDIUM_LAUNCHPAD_PROGRAM_ID = new PublicKey('LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj');
const RAYDIUM_POOL_SEED = Buffer.from('pool', 'utf8');
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

function normalizePositive(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function pickCreatorAddress(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  for (const candidate of [data.creatorAddress, data.creator_address, data.creator, data.userAddress, data.owner]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

function pickPoolId(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  for (const candidate of [data.poolId, data.pool_id, data.pool, data.poolAddress, data.amm_pool, data.ammPool]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

function deriveRaydiumPoolPda(mintA: PublicKey, mintB: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([RAYDIUM_POOL_SEED, mintA.toBuffer(), mintB.toBuffer()], RAYDIUM_LAUNCHPAD_PROGRAM_ID)[0];
}

export async function resolveSolanaDirectLiquidity(tokenAddress: string): Promise<SolDirectLiquiditySnapshot | null> {
  const detection = await detectLaunchpadToken(tokenAddress, 900, { mode: 'cheap' }).catch(() => null);
  if (!detection) return null;

  if (detection.provider === 'pumpswap') {
    const liquidityUsd = normalizePositive(await getPumpSwapLiquidityUsd(tokenAddress, pickCreatorAddress(detection.data)));
    if (liquidityUsd > 0) {
      return {
        liquidityUsd,
        provider: 'pumpswap',
        reliable: true,
        poolCount: 1,
        metadata: { source: 'pumpswap_direct_pool' },
      };
    }
    return {
      liquidityUsd: 0,
      provider: 'pumpswap',
      reliable: false,
      poolCount: 1,
      metadata: { source: 'pumpswap_direct_unpriced' },
    };
  }

  if (detection.provider === 'bonkfun') {
    try {
      const connection = getSolanaConnection('cheap', 'normal');
      const mint = new PublicKey(tokenAddress);
      const poolId = pickPoolId(detection.data);
      const pool = poolId ? new PublicKey(poolId) : deriveRaydiumPoolPda(mint, WSOL_MINT);
      const poolAccount = await connection.getAccountInfo(pool, 'confirmed');
      if (!poolAccount) {
        return {
          liquidityUsd: 0,
          provider: 'raydium_launchlab',
          reliable: false,
          poolCount: 0,
          metadata: { source: 'raydium_pool_missing' },
        };
      }
      const data = poolAccount.data;
      const mintB = new PublicKey(data.subarray(237, 269));
      const vaultB = new PublicKey(data.subarray(301, 333));
      if (!mintB.equals(WSOL_MINT)) {
        return {
          liquidityUsd: 0,
          provider: 'raydium_launchlab',
          reliable: false,
          poolCount: 1,
          metadata: { source: 'raydium_non_wsol_quote' },
        };
      }
      const quoteBalResp = await connection.getTokenAccountBalance(vaultB, 'confirmed');
      const quoteReserves = BigInt(quoteBalResp.value.amount);
      const nativePrice = await getNativeTokenPriceUsd(900).catch(() => 0);
      const liquidityUsd = quoteReserves > 0n && nativePrice > 0 ? (Number(quoteReserves) / 1e9) * nativePrice * 2 : 0;
      return {
        liquidityUsd,
        provider: 'raydium_launchlab',
        reliable: liquidityUsd > 0,
        poolCount: 1,
        metadata: { source: liquidityUsd > 0 ? 'raydium_launchlab_pool' : 'raydium_launchlab_unpriced', pool: pool.toBase58() },
      };
    } catch {
      return {
        liquidityUsd: 0,
        provider: 'raydium_launchlab',
        reliable: false,
        poolCount: 0,
        metadata: { source: 'raydium_launchlab_error' },
      };
    }
  }

  return null;
}
