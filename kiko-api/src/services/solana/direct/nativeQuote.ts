import { PublicKey } from '@solana/web3.js';
import { getSolanaConnection } from '../../../config/solanaConfig.js';
import { getNativeTokenPriceUsd } from '../../onChainPriceService.js';
import { SolanaLaunchpadSwapService } from '../../solanaLaunchpadSwapService.js';
import { __pumpSwapExecutorTest } from './pumpswapExecutor.js';

const WSOL_MINT = __pumpSwapExecutorTest.WSOL_MINT;
const RAYDIUM_LAUNCHPAD_PROGRAM_ID = new PublicKey('LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj');
const RAYDIUM_POOL_SEED = Buffer.from('pool', 'utf8');

export type SolanaNativeQuoteResult = {
  provider: 'pumpswap-native' | 'pumpfun-native' | 'raydium-launchlab-native';
  priceUsd: number;
  amountInAtomic?: string;
  amountOutAtomic?: string;
  poolId?: string;
  reliable: boolean;
};

function deriveRaydiumPoolPda(mintA: PublicKey, mintB: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([RAYDIUM_POOL_SEED, mintA.toBuffer(), mintB.toBuffer()], RAYDIUM_LAUNCHPAD_PROGRAM_ID)[0];
}

async function getMintDecimals(connection: ReturnType<typeof getSolanaConnection>, mint: PublicKey): Promise<number> {
  const parsed = await connection.getParsedAccountInfo(mint, 'confirmed');
  const value = parsed.value as any;
  const decimals = Number(value?.data?.parsed?.info?.decimals ?? 6);
  return Number.isFinite(decimals) ? decimals : 6;
}

async function quotePumpSwapNative(mintAddress: string, amountAtomic?: string): Promise<SolanaNativeQuoteResult | null> {
  try {
    const connection = getSolanaConnection('cheap', 'normal');
    const mint = new PublicKey(mintAddress);
    const resolved = await __pumpSwapExecutorTest.resolvePumpSwapPoolForMint(connection, mint, null);
    if (!resolved) return null;
    if (!resolved.layout.quoteMint.equals(WSOL_MINT)) return null;

    const { baseReserves, quoteReserves } = await __pumpSwapExecutorTest.resolveReserves(
      connection,
      resolved.layout.baseVault,
      resolved.layout.quoteVault,
    );
    if (baseReserves <= 0n || quoteReserves <= 0n) return null;

    const solUsd = await getNativeTokenPriceUsd(900).catch(() => 0);
    if (!(solUsd > 0)) return null;

    const tokenDecimals = await getMintDecimals(connection, mint);
    const tokenSpotPriceInSol = (Number(quoteReserves) / 1e9) / (Number(baseReserves) / Math.pow(10, tokenDecimals));
    const spotPriceUsd = tokenSpotPriceInSol * solUsd;
    if (!(spotPriceUsd > 0)) return null;

    if (!amountAtomic) {
      return {
        provider: 'pumpswap-native',
        priceUsd: spotPriceUsd,
        poolId: resolved.pool.toBase58(),
        reliable: true,
      };
    }

    const fee = await __pumpSwapExecutorTest.resolvePumpSwapFeeBps(
      connection,
      __pumpSwapExecutorTest.deriveGlobalConfig(),
      __pumpSwapExecutorTest.deriveFeeConfig(),
    ).catch(() => ({ totalFeeBps: 30n }));
    const quoteIn = BigInt(amountAtomic);
    const buy = __pumpSwapExecutorTest.computeBuyAmounts(
      quoteIn,
      baseReserves,
      quoteReserves,
      100,
      fee.totalFeeBps,
      0,
    );

    return {
      provider: 'pumpswap-native',
      priceUsd: spotPriceUsd,
      amountInAtomic: quoteIn.toString(),
      amountOutAtomic: buy.tokenOut.toString(),
      poolId: resolved.pool.toBase58(),
      reliable: true,
    };
  } catch {
    return null;
  }
}

async function quotePumpFunNative(mintAddress: string, amountAtomic?: string): Promise<SolanaNativeQuoteResult | null> {
  try {
    const connection = getSolanaConnection('cheap', 'normal');
    const mint = new PublicKey(mintAddress);
    const service = new SolanaLaunchpadSwapService();
    const state = await service.getBondingCurveState(connection, mint);
    if (state.complete || state.virtualTokenReserves <= 0n || state.virtualSolReserves <= 0n) return null;

    const solUsd = await getNativeTokenPriceUsd(900).catch(() => 0);
    if (!(solUsd > 0)) return null;

    const spotPriceInSol = Number(state.virtualSolReserves) / (Number(state.virtualTokenReserves) * 1e3);
    const spotPriceUsd = spotPriceInSol * solUsd;
    if (!(spotPriceUsd > 0)) return null;

    if (!amountAtomic) {
      return {
        provider: 'pumpfun-native',
        priceUsd: spotPriceUsd,
        reliable: true,
      };
    }

    const solIn = BigInt(amountAtomic);
    const tokenOut = service.calculateTokensOut(state, solIn);
    if (tokenOut <= 0n) return null;

    return {
      provider: 'pumpfun-native',
      priceUsd: spotPriceUsd,
      amountInAtomic: solIn.toString(),
      amountOutAtomic: tokenOut.toString(),
      reliable: true,
    };
  } catch {
    return null;
  }
}

async function quoteRaydiumLaunchlabNative(mintAddress: string): Promise<SolanaNativeQuoteResult | null> {
  try {
    const connection = getSolanaConnection('cheap', 'normal');
    const mint = new PublicKey(mintAddress);
    const pool = deriveRaydiumPoolPda(mint, WSOL_MINT);
    const poolAccount = await connection.getAccountInfo(pool, 'confirmed');
    if (!poolAccount) return null;
    const data = poolAccount.data;
    const mintB = new PublicKey(data.subarray(237, 269));
    if (!mintB.equals(WSOL_MINT)) return null;
    const vaultA = new PublicKey(data.subarray(269, 301));
    const vaultB = new PublicKey(data.subarray(301, 333));
    const [baseBalResp, quoteBalResp] = await Promise.all([
      connection.getTokenAccountBalance(vaultA, 'confirmed'),
      connection.getTokenAccountBalance(vaultB, 'confirmed'),
    ]);
    const baseReserves = BigInt(baseBalResp.value.amount);
    const quoteReserves = BigInt(quoteBalResp.value.amount);
    if (baseReserves <= 0n || quoteReserves <= 0n) return null;

    const solUsd = await getNativeTokenPriceUsd(900).catch(() => 0);
    if (!(solUsd > 0)) return null;

    const tokenDecimals = await getMintDecimals(connection, mint);
    const priceSol = (Number(quoteReserves) / 1e9) / (Number(baseReserves) / Math.pow(10, tokenDecimals));
    const priceUsd = priceSol * solUsd;
    if (!(priceUsd > 0)) return null;

    return {
      provider: 'raydium-launchlab-native',
      priceUsd,
      poolId: pool.toBase58(),
      reliable: true,
    };
  } catch {
    return null;
  }
}

export async function getSolanaNativeQuotePrice(tokenMint: string, amountAtomic?: string): Promise<SolanaNativeQuoteResult | null> {
  const pumpswap = await quotePumpSwapNative(tokenMint, amountAtomic);
  if (pumpswap) return pumpswap;

  const pumpfun = await quotePumpFunNative(tokenMint, amountAtomic);
  if (pumpfun) return pumpfun;

  const raydium = await quoteRaydiumLaunchlabNative(tokenMint);
  if (raydium) return raydium;

  return null;
}