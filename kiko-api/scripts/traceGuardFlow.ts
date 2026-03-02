import 'dotenv/config';
import prisma from '../src/db/prisma.js';
import { callRpc } from '../src/services/rpcManager.js';
import { decodeSolanaSwap } from '../src/services/solanaDecoder.js';
import { determineCopyTradeDirection } from '../src/services/copyTradeDirection.js';
import { getTokenInfo } from '../src/services/tokenService.js';
import { getTokenMetadata } from '../src/services/rpcService.js';
import { computeBuyTargetValueSnapshot } from '../src/services/copytrade/guards/targetValueGuard.js';
import { resolveBuyLiquidityGuardSnapshot } from '../src/services/copytrade/guards/liquidityGuard.js';
import { evaluateStaticBuyGuards } from '../src/services/copytrade/guards/evaluator.js';
import { resolveBuyGuardPolicy } from '../src/services/copytrade/guards/policy.js';
import { resolveExecutionModeFromConfig } from '../src/services/copyTradeExecutionMode.js';
import { evaluateBuyPriceDeviationGuard } from '../src/services/copytrade/buy/buyGuardPriceDeviation.js';
import { buildDuplicateTradeWhere } from '../src/services/copytrade/guards/cooldownPolicy.js';

const TX_HASH = process.env.TRACE_TX_HASH || '3cr2mMe4nFMCTTTiGtY2M1uBP65hryPysZkpJF8wz32kybg1nG2kxKA16HSKkxsUSYVxB9P7PjSpVJhPQpK8hDmu';
const TARGET_WALLET = process.env.TRACE_TARGET_WALLET || 'CWk2NqZwy3Fo9cumJcWwt45j4D6FnboS5h3vHZWtKyvV';
const CHAIN_ID = 900;

function now() { return Date.now(); }

async function timed<T>(name: string, fn: () => Promise<T> | T) {
  const start = now();
  const value = await fn();
  const ms = now() - start;
  return { name, ms, value };
}

async function main() {
  const report: any = { txHash: TX_HASH, targetWallet: TARGET_WALLET, chainId: CHAIN_ID, steps: [] as any[] };

  const txStep = await timed('fetch_tx', async () => {
    return callRpc<any>('solana', 'getTransaction', [
      TX_HASH,
      { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
    ], { rpcClass: 'best_effort_read', path: 'sol_tx_decode' });
  });
  report.steps.push({ step: txStep.name, ms: txStep.ms });

  const decodeStep = await timed('decode_swap', async () => decodeSolanaSwap(txStep.value, TARGET_WALLET));
  report.steps.push({ step: decodeStep.name, ms: decodeStep.ms, ok: !!decodeStep.value });
  const swap = decodeStep.value;
  if (!swap) {
    report.error = 'swap_not_decoded';
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const directionStep = await timed('direction_guard', async () => determineCopyTradeDirection({
    chainId: CHAIN_ID,
    tokenIn: swap.tokenIn,
    tokenOut: swap.tokenOut,
    cashLegHint: swap.cashLegHint,
  }));
  report.steps.push({ step: directionStep.name, ms: directionStep.ms, result: directionStep.value });

  const cfgStep = await timed('load_config', async () => prisma.copyTradeConfig.findFirst({
    where: {
      targetWallet: { equals: TARGET_WALLET, mode: 'insensitive' },
      chainId: CHAIN_ID,
      status: 'active',
    },
    include: { user: true },
    orderBy: { updatedAt: 'desc' },
  }));
  report.steps.push({ step: cfgStep.name, ms: cfgStep.ms, found: !!cfgStep.value });

  const config = cfgStep.value || {
    userId: 'trace-user',
    chainId: CHAIN_ID,
    buyAmountUsd: 5,
    minMarketCapUsd: 0,
    minLiquidityUsd: 0,
    minTargetValueUsd: 0,
    executionMode: 'normal',
    user: { farcasterFid: null },
  } as any;

  const tokenStep = await timed('token_info', async () => {
    const info = await getTokenInfo(swap.tokenOut, CHAIN_ID, { priority: 'high', rpcStrategy: 'fast', fastMode: true });
    if (info) return info;
    const meta = await getTokenMetadata(CHAIN_ID, swap.tokenOut, { rpcStrategy: 'fast' });
    return {
      price: 0,
      symbol: meta?.symbol || 'UNKNOWN',
      name: meta?.name || 'Unknown Token',
      decimals: meta?.decimals || 6,
      liquidity: 0,
      volume24h: 0,
      fdv: 0,
      marketCap: 0,
      provider: 'metadata_fallback',
    };
  });
  report.steps.push({ step: tokenStep.name, ms: tokenStep.ms, symbol: tokenStep.value?.symbol, price: tokenStep.value?.price || 0 });
  const tokenInfo = tokenStep.value;

  const targetValueStep = await timed('target_value_guard', async () => computeBuyTargetValueSnapshot(swap, CHAIN_ID, tokenInfo));
  report.steps.push({ step: targetValueStep.name, ms: targetValueStep.ms, snapshot: targetValueStep.value });

  const liquidityStep = await timed('liquidity_guard', async () => resolveBuyLiquidityGuardSnapshot(swap.tokenOut, CHAIN_ID, tokenInfo));
  report.steps.push({ step: liquidityStep.name, ms: liquidityStep.ms, snapshot: liquidityStep.value });

  tokenInfo.guardLiquidityUsd = liquidityStep.value.liquidityUsd;
  tokenInfo.guardLiquiditySource = liquidityStep.value.source;
  tokenInfo.guardLiquidityReliable = liquidityStep.value.reliable;
  tokenInfo.guardLiquidityPoolCount = liquidityStep.value.poolCount;
  if (liquidityStep.value.liquidityUsd > 0) tokenInfo.liquidity = liquidityStep.value.liquidityUsd;

  const policy = resolveBuyGuardPolicy(resolveExecutionModeFromConfig(config));

  const staticStep = await timed('static_buy_guards', async () => evaluateStaticBuyGuards(
    tokenInfo,
    config,
    targetValueStep.value.targetSwapValueUsd,
    policy,
    {
      targetValueSnapshot: targetValueStep.value,
      liquidityGuardSnapshot: liquidityStep.value,
    }
  ));
  report.steps.push({ step: staticStep.name, ms: staticStep.ms, result: staticStep.value });

  const priceDevStep = await timed('price_deviation_guard', async () => {
    const estimatedOut = Number(swap.amountOut || 0n) / Math.pow(10, Number(tokenInfo.decimals || 6));
    return evaluateBuyPriceDeviationGuard({
      chainId: CHAIN_ID,
      oraclePrice: Number(tokenInfo.price || 0),
      oracleProvider: tokenInfo.provider,
      oracleDexName: tokenInfo.rpcDexName,
      oracleValidationReason: tokenInfo.priceValidationReason,
      referencePrice: tokenInfo.referencePrice,
      referenceProvider: tokenInfo.referenceProvider,
      oracleFallbackUsed: Boolean(tokenInfo.priceFallbackUsed),
      estimatedOut,
      targetSwapValueUsd: targetValueStep.value.targetSwapValueUsd,
      strictTargetSwapValueUsd: targetValueStep.value.strictTargetSwapValueUsd,
      strictTargetSwapValueReliable: targetValueStep.value.strictTargetSwapValueReliable,
      strictTargetSwapValueSource: targetValueStep.value.strictTargetSwapValueSource,
      policy,
      maxRatio: 3,
    });
  });
  report.steps.push({ step: priceDevStep.name, ms: priceDevStep.ms, result: priceDevStep.value });

  const cooldownStep = await timed('cooldown_guard_lookup', async () => {
    const where = buildDuplicateTradeWhere({
      userId: config.userId,
      tokenAddress: swap.tokenOut,
      cooldownMinutes: Number(config.copyTradeTokenCooldownMinutes || 60),
      positionStatusCompat: {
        lockStatuses: ['pending'],
        activeOrLockedStatuses: ['open', 'pending'],
        pendingCreateStatus: 'pending',
        failedFinalStatus: 'failed',
      },
    });
    const existing = await prisma.position.findFirst({ where, select: { id: true, createdAt: true } });
    return { exists: !!existing };
  });
  report.steps.push({ step: cooldownStep.name, ms: cooldownStep.ms, result: cooldownStep.value });

  report.totalMs = report.steps.reduce((sum: number, s: any) => sum + Number(s.ms || 0), 0);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error('traceGuardFlow failed:', e?.message || e);
  process.exit(1);
});
