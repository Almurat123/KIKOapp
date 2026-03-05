import assert from 'node:assert/strict';
import {
  computeUsdPriceFromRawQuote,
  fetchTokenDecimalsFromRPC,
  getTokenPriceUSD,
  getZeroExPrice,
  getZeroExTokenMetadata,
  resolveAdaptivePriceSampleSellAmountRaw,
  toWei,
} from '../services/zeroEx.js';

const CHAIN_ID = 1;
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const PEPE = '0x6982508145454Ce325dDbE47a25d4ec3d2311933';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

function parseNumberEnv(key: string, fallback: number): number {
  const value = Number(process.env[key] || '');
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function bpsDiff(a: number, b: number): number {
  if (!(a > 0) || !(b > 0)) return Number.POSITIVE_INFINITY;
  return Math.abs(a - b) / b * 10000;
}

async function resolveDecimals(token: string): Promise<number> {
  const meta = await getZeroExTokenMetadata(token, CHAIN_ID).catch(() => null);
  const fromMeta = Number(meta?.decimals);
  if (Number.isFinite(fromMeta) && fromMeta >= 0 && fromMeta <= 30) return fromMeta;
  return fetchTokenDecimalsFromRPC(token, CHAIN_ID);
}

async function main() {
  const ethIn = parseNumberEnv('REPLAY_ETH_IN', 0.00001);
  const maxAllowedBps = parseNumberEnv('REPLAY_MAX_BPS', 7000);

  const [pepeDecimals, usdcDecimals, ethPriceUsd, pepePriceUsd] = await Promise.all([
    resolveDecimals(PEPE),
    resolveDecimals(USDC),
    getTokenPriceUSD(WETH, CHAIN_ID),
    getTokenPriceUSD(PEPE, CHAIN_ID),
  ]);

  assert.ok(ethPriceUsd && ethPriceUsd > 0, 'failed_to_resolve_eth_usd_price');
  assert.ok(pepePriceUsd && pepePriceUsd > 0, 'failed_to_resolve_pepe_usd_price');

  // Flow A: replay micro target buy (ETH -> PEPE), then compute implied token USD.
  const microEthSellRaw = toWei(String(ethIn), 18);
  const ethToPepe = await getZeroExPrice(WETH, PEPE, microEthSellRaw, CHAIN_ID);
  assert.ok(ethToPepe?.buyAmount, 'failed_to_quote_eth_to_pepe_micro_trade');

  const pepeOutTokens = Number(ethToPepe!.buyAmount) / (10 ** pepeDecimals);
  assert.ok(Number.isFinite(pepeOutTokens) && pepeOutTokens > 0, 'invalid_pepe_out_amount');
  const targetExecutionPriceUsd = (ethIn * ethPriceUsd!) / pepeOutTokens;
  const microTradeDeviationBps = bpsDiff(targetExecutionPriceUsd, pepePriceUsd!);

  // Flow B: replay PEPE micro-price quote (PEPE -> USDC) with adaptive resample.
  const onePepeRaw = toWei('1', pepeDecimals);
  const pepeToUsdc = await getZeroExPrice(PEPE, USDC, onePepeRaw, CHAIN_ID);
  assert.ok(pepeToUsdc?.buyAmount, 'failed_to_quote_pepe_to_usdc');

  const coarsePriceUsd = computeUsdPriceFromRawQuote({
    sellAmountRaw: onePepeRaw,
    buyAmountRaw: pepeToUsdc!.buyAmount,
    sellTokenDecimals: pepeDecimals,
    buyTokenDecimals: usdcDecimals,
  });

  const adaptive = resolveAdaptivePriceSampleSellAmountRaw({
    baseSellAmountRaw: onePepeRaw,
    quotedBuyAmountRaw: pepeToUsdc!.buyAmount,
  });

  let refinedPriceUsd = coarsePriceUsd;
  if (adaptive.resampled) {
    const refinedQuote = await getZeroExPrice(PEPE, USDC, adaptive.sellAmountRaw, CHAIN_ID);
    assert.ok(refinedQuote?.buyAmount, 'failed_to_resample_pepe_to_usdc_quote');
    refinedPriceUsd = computeUsdPriceFromRawQuote({
      sellAmountRaw: adaptive.sellAmountRaw,
      buyAmountRaw: refinedQuote!.buyAmount,
      sellTokenDecimals: pepeDecimals,
      buyTokenDecimals: usdcDecimals,
    });
  }

  const coarseVsOracleBps = bpsDiff(coarsePriceUsd, pepePriceUsd!);
  const refinedVsOracleBps = bpsDiff(refinedPriceUsd, pepePriceUsd!);

  const result = {
    chainId: CHAIN_ID,
    token: PEPE,
    ethIn,
    maxAllowedBps,
    pricesUsd: {
      eth: ethPriceUsd,
      pepeOracle: pepePriceUsd,
      targetExecution: targetExecutionPriceUsd,
      quoteCoarse: coarsePriceUsd,
      quoteRefined: refinedPriceUsd,
    },
    deviationsBps: {
      targetExecutionVsOracle: Number(microTradeDeviationBps.toFixed(2)),
      coarseVsOracle: Number(coarseVsOracleBps.toFixed(2)),
      refinedVsOracle: Number(refinedVsOracleBps.toFixed(2)),
    },
    adaptiveSample: {
      resampled: adaptive.resampled,
      multiplier: adaptive.multiplier.toString(),
      sellAmountRaw: adaptive.sellAmountRaw,
    },
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(result, null, 2));

  assert.ok(microTradeDeviationBps <= maxAllowedBps, `micro_trade_bps_exceeded_${microTradeDeviationBps.toFixed(2)}`);
  assert.ok(refinedVsOracleBps <= maxAllowedBps, `refined_quote_bps_exceeded_${refinedVsOracleBps.toFixed(2)}`);
}

main().catch((error) => {
  console.error('[ETH-PEPE-Replay] fatal', error?.message || error);
  process.exitCode = 1;
});
