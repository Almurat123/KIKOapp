import { performance } from 'node:perf_hooks';
import { getOnChainPrice } from './src/services/onChainPriceService.ts';
import { getTokenLiquidity } from './src/services/dex/directSwap/pipeline/poolLayer.ts';
import { getTokenInfo } from './src/services/tokenService.ts';

const token = '0x4a07a361157c75ce392364051813d09bef054c0c';
const chainId = 1;

async function timed<T>(label: string, fn: () => Promise<T>) {
  const start = performance.now();
  try {
    const result = await fn();
    const ms = Number((performance.now() - start).toFixed(2));
    return { label, ok: true, ms, result };
  } catch (error: any) {
    const ms = Number((performance.now() - start).toFixed(2));
    return { label, ok: false, ms, error: error?.message || String(error) };
  }
}

async function main() {
  const onChain = await timed('getOnChainPrice.fast.lightweight', () =>
    getOnChainPrice(token, chainId, { rpcStrategy: 'fast', lightweight: true })
  );
  const liquidity = await timed('getTokenLiquidity.direct', () => getTokenLiquidity(token, chainId));
  const tokenInfoFast = await timed('getTokenInfo.fastMode', () =>
    getTokenInfo(token, chainId, { priority: 'high', rpcStrategy: 'fast', fastMode: true })
  );
  console.log(JSON.stringify({ token, chainId, probes: [onChain, liquidity, tokenInfoFast] }, null, 2));
}

main().catch((error) => {
  console.error('[tmp_single_latency_probe] fatal', error?.message || error);
  process.exitCode = 1;
});
