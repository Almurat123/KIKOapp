import 'dotenv/config';
import { ethers } from 'ethers';
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
import { evaluateBuyPriceDeviationGuard } from '../src/services/copytrade/buy/buyGuardPriceDeviation.js';
import { buildDuplicateTradeWhere, describeCooldownMode } from '../src/services/copytrade/guards/cooldownPolicy.js';
import { isCopyTradeDelayExceeded } from '../src/services/autoTradeService.js';

const TX_HASH = process.env.GUARD_TRACE_TX_HASH || '3czaNHexkUhzfk4CvnEXpiHspaCfyiuw8EQvothS62BsXWkqc6tK72Ue9LzXhnwPqb1GS2pACYXReqLsDyyNqJft';
const TARGET_WALLET = process.env.GUARD_TRACE_TARGET_WALLET || 'CWk2NqZwy3Fo9cumJcWwt45j4D6FnboS5h3vHZWtKyvV';
const CHAIN_ID = 900;
process.env.COPYTRADE_SOL_LIQUIDITY_SCAN_ALL_POOLS = process.env.COPYTRADE_SOL_LIQUIDITY_SCAN_ALL_POOLS || 'false';

async function timed<T>(
  name: string,
  fn: () => Promise<T>,
  timeoutMs: number = 8000
): Promise<{ name: string; ms: number; result: T }> {
  const start = Date.now();
  const result = await Promise.race<T>([
    fn(),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${name}_timeout_${timeoutMs}ms`)), timeoutMs)),
  ]);
  return { name, ms: Date.now() - start, result };
}

async function main() {
  const steps: Array<{ name: string; ms: number; detail?: any }> = [];

  const txStep = await timed('fetch_tx', async () => {
    return callRpc<any>('solana', 'getTransaction', [
      TX_HASH,
      { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }
    ], { rpcClass: 'best_effort_read', path: 'guard_trace_tx' });
  }, 9000);
  steps.push({ name: txStep.name, ms: txStep.ms });

  const decodeStep = await timed('decode_swap', async () => decodeSolanaSwap(txStep.result, TARGET_WALLET), 5000);
  const swap = decodeStep.result;
  if (!swap) throw new Error('decode_swap_failed_no_swap');
  steps.push({
    name: decodeStep.name,
    ms: decodeStep.ms,
    detail: { tokenIn: swap.tokenIn, tokenOut: swap.tokenOut, dex: swap.dexName }
  });

  const directionStep = await timed('direction_guard_eval', async () => determineCopyTradeDirection({
    chainId: CHAIN_ID,
    tokenIn: swap.tokenIn,
    tokenOut: swap.tokenOut,
    cashLegHint: swap.cashLegHint,
  }), 2000);
  steps.push({ name: directionStep.name, ms: directionStep.ms, detail: directionStep.result });

  const tokenInfoStep = await timed('token_info_fetch', async () => {
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
      provider: 'rpc-metadata-fallback',
      tokenAddress: swap.tokenOut,
    } as any;
  }, 9000);
  const tokenInfo = tokenInfoStep.result as any;
  steps.push({
    name: tokenInfoStep.name,
    ms: tokenInfoStep.ms,
    detail: {
      symbol: tokenInfo.symbol,
      price: tokenInfo.price,
      marketCap: tokenInfo.marketCap,
      provider: tokenInfo.provider,
    }
  });

  const targetValueStep = await timed('target_value_guard_snapshot', async () => computeBuyTargetValueSnapshot(swap, CHAIN_ID, tokenInfo), 9000);
  const targetValueSnapshot = targetValueStep.result;
  steps.push({ name: targetValueStep.name, ms: targetValueStep.ms, detail: targetValueSnapshot });

  const liquidityStep = await timed('liquidity_guard_snapshot', async () => resolveBuyLiquidityGuardSnapshot(swap.tokenOut, CHAIN_ID, tokenInfo), 5000);
  const liquiditySnapshot = liquidityStep.result;
  steps.push({ name: liquidityStep.name, ms: liquidityStep.ms, detail: liquiditySnapshot });

  const dbConfigStep = await timed('load_copytrade_config', async () => {
    return prisma.copyTradeConfig.findFirst({
      where: {
        targetWallet: { equals: TARGET_WALLET, mode: 'insensitive' },
        chainId: CHAIN_ID,
        status: 'active',
      },
      orderBy: { createdAt: 'desc' }
    });
  }, 3000);
  steps.push({ name: dbConfigStep.name, ms: dbConfigStep.ms, detail: { found: !!dbConfigStep.result, id: dbConfigStep.result?.id || null } });

  const cfg = dbConfigStep.result || {
    userId: 'guard-trace-user',
    buyAmountUsd: 20,
    minTargetValueUsd: 0,
    minLiquidityUsd: 0,
    minMarketCapUsd: 0,
    copyTradeTokenCooldownMinutes: 60,
    fastExecutionEnabled: false,
    chainId: CHAIN_ID,
  } as any;

  const targetSwapValueUsd = Number(targetValueSnapshot.targetSwapValueUsd || 0);

  const staticNormalStep = await timed('static_guards_normal', async () => evaluateStaticBuyGuards(
    tokenInfo,
    cfg,
    targetSwapValueUsd,
    resolveBuyGuardPolicy('normal'),
    { targetValueSnapshot, liquidityGuardSnapshot: liquiditySnapshot }
  ), 5000);
  steps.push({ name: staticNormalStep.name, ms: staticNormalStep.ms, detail: staticNormalStep.result });

  const staticTurboStep = await timed('static_guards_turbo', async () => evaluateStaticBuyGuards(
    tokenInfo,
    { ...cfg, fastExecutionEnabled: true },
    targetSwapValueUsd,
    resolveBuyGuardPolicy('turbo'),
    { targetValueSnapshot, liquidityGuardSnapshot: liquiditySnapshot }
  ), 5000);
  steps.push({ name: staticTurboStep.name, ms: staticTurboStep.ms, detail: staticTurboStep.result });

  const priceDeviationStep = await timed('price_deviation_ratio_guard', async () => {
    const decimals = Number(tokenInfo?.decimals || 6);
    const estimatedOut = Number(ethers.formatUnits(BigInt(String(swap.amountOut || '0')), decimals));
    return evaluateBuyPriceDeviationGuard({
      chainId: CHAIN_ID,
      oraclePrice: Number(tokenInfo?.price || 0),
      oracleProvider: tokenInfo?.provider,
      oracleDexName: tokenInfo?.rpcDexName,
      oracleValidationReason: tokenInfo?.priceValidationReason,
      referencePrice: tokenInfo?.referencePrice,
      referenceProvider: tokenInfo?.referenceProvider,
      oracleFallbackUsed: Boolean(tokenInfo?.priceFallbackUsed),
      estimatedOut,
      targetSwapValueUsd,
      strictTargetSwapValueUsd: Number(targetValueSnapshot.strictTargetSwapValueUsd || 0),
      strictTargetSwapValueReliable: Boolean(targetValueSnapshot.strictTargetSwapValueReliable),
      strictTargetSwapValueSource: String(targetValueSnapshot.strictTargetSwapValueSource || 'none'),
      policy: resolveBuyGuardPolicy('normal'),
      maxRatio: 3,
    });
  }, 2500);
  steps.push({ name: priceDeviationStep.name, ms: priceDeviationStep.ms, detail: priceDeviationStep.result });

  const cooldownWhere = buildDuplicateTradeWhere({
    userId: String(cfg.userId),
    tokenAddress: String(swap.tokenOut),
    cooldownMinutes: Number(cfg.copyTradeTokenCooldownMinutes || 0),
    positionStatusCompat: { lockStatuses: ['pending'] }
  });

  const cooldownStep = await timed('cooldown_guard_db_lookup', async () => {
    const existing = await prisma.position.findFirst({ where: cooldownWhere as any, select: { id: true, status: true, createdAt: true } });
    return {
      mode: describeCooldownMode(Number(cfg.copyTradeTokenCooldownMinutes || 0)),
      existing,
    };
  }, 3500);
  steps.push({ name: cooldownStep.name, ms: cooldownStep.ms, detail: cooldownStep.result });

  const delayNormalStep = await timed('delay_guard_normal', async () => isCopyTradeDelayExceeded(Date.now() - 42000, false), 1000);
  steps.push({ name: delayNormalStep.name, ms: delayNormalStep.ms, detail: delayNormalStep.result });

  const delayTurboStep = await timed('delay_guard_turbo', async () => isCopyTradeDelayExceeded(Date.now() - 42000, true), 1000);
  steps.push({ name: delayTurboStep.name, ms: delayTurboStep.ms, detail: delayTurboStep.result });

  const totalMs = steps.reduce((s, x) => s + x.ms, 0);
  console.log(JSON.stringify({
    txHash: TX_HASH,
    targetWallet: TARGET_WALLET,
    tokenOut: swap.tokenOut,
    totalMeasuredMs: totalMs,
    steps,
  }, null, 2));
}

main().catch((err) => {
  console.error('guardTrace failed:', err?.message || err);
  process.exit(1);
});
