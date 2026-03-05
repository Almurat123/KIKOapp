import { detectLaunchpadToken } from '../../ai/launchpadDetector.js';
import { getNativeTokenPriceUsd } from '../../onChainPriceService.js';
import { getSolanaConnection } from '../../../config/solanaConfig.js';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '../../../utils/solanaToken.js';
import type { SolDirectLiquiditySnapshot } from './types.js';
import { getPumpSwapLiquidityUsd } from './pumpswapExecutor.js';
import { SOLANA_CONFIG } from '../../../config/solanaConfig.js';
import { SolanaLaunchpadSwapService } from '../../solanaLaunchpadSwapService.js';

const RAYDIUM_LAUNCHPAD_PROGRAM_ID = new PublicKey('LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj');
const RAYDIUM_POOL_SEED = Buffer.from('pool', 'utf8');
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const RAYDIUM_CLMM_PROGRAM_ID = 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK';
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

const PROGRAM_LABELS: Record<string, string> = {
  [SOLANA_CONFIG.PROGRAMS.PUMP_FUN]: 'Pump.fun',
  [SOLANA_CONFIG.PROGRAMS.PUMP_SWAP]: 'Pump.fun Amm',
  [SOLANA_CONFIG.PROGRAMS.RAYDIUM_V4]: 'Raydium',
  [RAYDIUM_CLMM_PROGRAM_ID]: 'Raydium CLMM',
  [RAYDIUM_LAUNCHPAD_PROGRAM_ID.toBase58()]: 'Raydium Launchlab',
  'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C': 'Raydium CP',
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo': 'Meteora DLMM',
  'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB': 'Meteora',
  'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG': 'Meteora DAMM v2',
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'Orca Whirlpool',
  '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': 'Orca V2',
  'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1': 'Orca V1',
};

function parseExtraProgramIds(): string[] {
  return String(process.env.SOLANA_EXTRA_LIQUIDITY_PROGRAM_IDS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function getSupportedLiquidityProgramIds(): Set<string> {
  const ids = new Set<string>([
    SOLANA_CONFIG.PROGRAMS.PUMP_FUN,
    SOLANA_CONFIG.PROGRAMS.PUMP_SWAP,
    SOLANA_CONFIG.PROGRAMS.RAYDIUM_V4,
    RAYDIUM_CLMM_PROGRAM_ID,
    RAYDIUM_LAUNCHPAD_PROGRAM_ID.toBase58(),
    'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C',
    'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
    'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB',
    'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG',
    'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
    '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP',
    'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1',
  ]);
  for (const id of parseExtraProgramIds()) ids.add(id);
  return ids;
}

const METEORA_PROGRAM_IDS = new Set([
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
  'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB',
  'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG',
]);

function mapProgramToProvider(programId: string): 'pumpswap' | 'pumpfun' | 'raydium_launchlab' | 'meteora' {
  if (programId === SOLANA_CONFIG.PROGRAMS.PUMP_SWAP) return 'pumpswap';
  if (programId === SOLANA_CONFIG.PROGRAMS.PUMP_FUN) return 'pumpfun';
  if (METEORA_PROGRAM_IDS.has(programId)) return 'meteora';
  return 'raydium_launchlab';
}

async function getPumpFunBondingCurveLiquidityUsd(tokenAddress: string): Promise<number | null> {
  try {
    const connection = getSolanaConnection('cheap', 'normal');
    const mint = new PublicKey(tokenAddress);
    const service = new SolanaLaunchpadSwapService();
    const state = await service.getBondingCurveState(connection, mint);
    const nativePrice = await getNativeTokenPriceUsd(900).catch(() => 0);
    if (!(nativePrice > 0)) return null;
    const depthSolLamports = state.virtualSolReserves > 0n
      ? state.virtualSolReserves
      : state.realSolReserves;
    if (depthSolLamports <= 0n) return null;
    const solSideUsd = (Number(depthSolLamports) / 1e9) * nativePrice;
    if (!(solSideUsd > 0)) return null;
    return solSideUsd * 2;
  } catch {
    return null;
  }
}

async function resolveProgramVaultLiquidityByMint(tokenAddress: string, tokenPriceUsd: number): Promise<{
  liquidityUsd: number;
  poolCount: number;
  provider: 'pumpswap' | 'pumpfun' | 'raydium_launchlab' | 'meteora';
  metadata: Record<string, unknown>;
} | null> {
  if (!(tokenPriceUsd > 0)) return null;
  try {
    const connection = getSolanaConnection('cheap', 'normal');
    const baseFilters = [
      { dataSize: 165 },
      { memcmp: { offset: 0, bytes: tokenAddress } },
    ];
    const [tokenKegAccounts, token2022Accounts] = await Promise.all([
      connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
        filters: baseFilters,
        commitment: 'confirmed',
      }),
      connection.getParsedProgramAccounts(TOKEN_2022_PROGRAM_ID, {
        filters: baseFilters,
        commitment: 'confirmed',
      }),
    ]);
    const parsedAccounts = [...tokenKegAccounts, ...token2022Accounts];

    if (!parsedAccounts.length) return null;

    const vaultCandidates = parsedAccounts
      .map((acc) => {
        const info = (acc.account.data as any)?.parsed?.info;
        const owner = String(info?.owner || '');
        const amountRaw = BigInt(String(info?.tokenAmount?.amount || '0'));
        const decimals = Number(info?.tokenAmount?.decimals || 0);
        return { owner, amountRaw, decimals };
      })
      .filter((row) => row.owner && row.amountRaw > 0n);

    if (!vaultCandidates.length) return null;

    const uniqueOwners = [...new Set(vaultCandidates.map((v) => v.owner))];
    const ownerPubkeys = uniqueOwners.map((o) => new PublicKey(o));
    const ownerInfos = await connection.getMultipleAccountsInfo(ownerPubkeys, 'confirmed');
    const ownerProgramMap = new Map<string, string>();
    for (let i = 0; i < uniqueOwners.length; i++) {
      const info = ownerInfos[i];
      if (info?.owner) {
        ownerProgramMap.set(uniqueOwners[i], info.owner.toBase58());
      }
    }

    const supportedPrograms = getSupportedLiquidityProgramIds();
    const accepted = vaultCandidates.filter((row) => {
      const programId = ownerProgramMap.get(row.owner);
      return !!programId && supportedPrograms.has(programId);
    });
    if (!accepted.length) return null;

    let tokenSideUsd = 0;
    const programBucket = new Map<string, number>();
    const uniquePoolAuthorities = new Set<string>();

    for (const row of accepted) {
      const amount = Number(row.amountRaw) / Math.pow(10, row.decimals || 0);
      const usd = amount * tokenPriceUsd;
      tokenSideUsd += usd;
      uniquePoolAuthorities.add(row.owner);
      const programId = ownerProgramMap.get(row.owner) || 'unknown';
      programBucket.set(programId, (programBucket.get(programId) || 0) + usd);
    }

    if (!(tokenSideUsd > 0)) return null;

    const liquidityUsd = tokenSideUsd * 2;
    const dominantProgram = [...programBucket.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    const provider = mapProgramToProvider(dominantProgram);

    return {
      liquidityUsd,
      poolCount: uniquePoolAuthorities.size,
      provider,
      metadata: {
        source: 'program_vault_scan',
        dominantProgram,
        dominantProgramLabel: PROGRAM_LABELS[dominantProgram] || 'Unknown Program',
        tokenPriceUsd,
        acceptedProgramIds: [...new Set([...accepted.map((row) => ownerProgramMap.get(row.owner) || 'unknown')])],
        programBreakdownTokenUsd: Object.fromEntries(programBucket.entries()),
      },
    };
  } catch {
    return null;
  }
}

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

export async function resolveSolanaDirectLiquidity(
  tokenAddress: string,
  tokenPriceUsd: number = 0,
  options?: { includeProgramScan?: boolean }
): Promise<SolDirectLiquiditySnapshot | null> {
  const detection = await detectLaunchpadToken(tokenAddress, 900, { mode: 'cheap' }).catch(() => null);
  const detectionProvider = detection?.provider || null;
  const creatorAddress = pickCreatorAddress(detection?.data);
  const hintedPoolId = pickPoolId(detection?.data);

  const [pumpSwapLiquidity, pumpFunBondingLiquidity, raydiumLaunchlab] = await Promise.all([
    getPumpSwapLiquidityUsd(tokenAddress, creatorAddress).catch(() => null),
    getPumpFunBondingCurveLiquidityUsd(tokenAddress).catch(() => null),
    (async () => {
      try {
        const connection = getSolanaConnection('cheap', 'normal');
        const mint = new PublicKey(tokenAddress);
        const pool = hintedPoolId ? new PublicKey(hintedPoolId) : deriveRaydiumPoolPda(mint, WSOL_MINT);
        const poolAccount = await connection.getAccountInfo(pool, 'confirmed');
        if (!poolAccount) {
          return { liquidityUsd: 0, poolCount: 0, source: 'raydium_pool_missing', pool: pool.toBase58() };
        }
        const data = poolAccount.data;
        const mintB = new PublicKey(data.subarray(237, 269));
        const vaultB = new PublicKey(data.subarray(301, 333));
        if (!mintB.equals(WSOL_MINT)) {
          return { liquidityUsd: 0, poolCount: 1, source: 'raydium_non_wsol_quote', pool: pool.toBase58() };
        }
        const quoteBalResp = await connection.getTokenAccountBalance(vaultB, 'confirmed');
        const quoteReserves = BigInt(quoteBalResp.value.amount);
        const nativePrice = await getNativeTokenPriceUsd(900).catch(() => 0);
        const liquidityUsd = quoteReserves > 0n && nativePrice > 0 ? (Number(quoteReserves) / 1e9) * nativePrice * 2 : 0;
        return {
          liquidityUsd,
          poolCount: 1,
          source: liquidityUsd > 0 ? 'raydium_launchlab_pool' : 'raydium_launchlab_unpriced',
          pool: pool.toBase58(),
        };
      } catch {
        return { liquidityUsd: 0, poolCount: 0, source: 'raydium_launchlab_error' };
      }
    })(),
  ]);

  const effectiveTokenPriceUsd = normalizePositive(tokenPriceUsd);
  const includeProgramScan = options?.includeProgramScan === true;
  const scanned = includeProgramScan && effectiveTokenPriceUsd > 0
    ? await resolveProgramVaultLiquidityByMint(tokenAddress, effectiveTokenPriceUsd)
    : null;

  const pumpLiquidityUsd = normalizePositive(pumpSwapLiquidity);
  const pumpFunLiquidityUsd = normalizePositive(pumpFunBondingLiquidity);
  const rayLiquidityUsd = normalizePositive(raydiumLaunchlab?.liquidityUsd);
  const scannedLiquidityUsd = normalizePositive(scanned?.liquidityUsd);
  const totalLiquidityUsd = pumpLiquidityUsd + pumpFunLiquidityUsd + rayLiquidityUsd + scannedLiquidityUsd;
  const poolCount = (pumpLiquidityUsd > 0 ? 1 : 0)
    + (pumpFunLiquidityUsd > 0 ? 1 : 0)
    + Number(raydiumLaunchlab?.poolCount || 0)
    + Number(scanned?.poolCount || 0);

  if (totalLiquidityUsd > 0) {
    const dominantProvider = scannedLiquidityUsd >= Math.max(pumpLiquidityUsd, pumpFunLiquidityUsd, rayLiquidityUsd)
      ? (scanned?.provider || 'raydium_launchlab')
      : (pumpLiquidityUsd >= Math.max(pumpFunLiquidityUsd, rayLiquidityUsd)
        ? 'pumpswap'
        : (pumpFunLiquidityUsd >= rayLiquidityUsd ? 'pumpfun' : 'raydium_launchlab'));
    return {
      liquidityUsd: totalLiquidityUsd,
      provider: dominantProvider,
      reliable: true,
      poolCount,
      metadata: {
        source: 'multi_program_direct_pool',
        detectionProvider,
        pumpSwapLiquidityUsd: pumpLiquidityUsd,
        pumpFunBondingLiquidityUsd: pumpFunLiquidityUsd,
        raydiumLaunchlabLiquidityUsd: rayLiquidityUsd,
        scannedProgramLiquidityUsd: scannedLiquidityUsd,
        raydiumSource: raydiumLaunchlab?.source,
        raydiumPool: raydiumLaunchlab?.pool,
        scanned: scanned?.metadata,
      },
    };
  }

  if (detectionProvider === 'pumpswap') {
    return {
      liquidityUsd: 0,
      provider: 'pumpswap',
      reliable: false,
      poolCount: 1,
      metadata: { source: 'pumpswap_direct_unpriced', detectionProvider },
    };
  }

  if (detectionProvider === 'pumpfun') {
    return {
      liquidityUsd: 0,
      provider: 'pumpfun',
      reliable: false,
      poolCount: 1,
      metadata: { source: 'pumpfun_direct_unpriced', detectionProvider },
    };
  }

  if (detectionProvider === 'bonkfun') {
    return {
      liquidityUsd: 0,
      provider: 'raydium_launchlab',
      reliable: false,
      poolCount: Number(raydiumLaunchlab?.poolCount || 0),
      metadata: {
        source: raydiumLaunchlab?.source || 'raydium_launchlab_unpriced',
        detectionProvider,
        raydiumPool: raydiumLaunchlab?.pool,
      },
    };
  }

  return null;
}
