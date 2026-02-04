import { performance } from 'perf_hooks';
import { getOnChainPrice } from '../services/onChainPriceService.js';

const tokens = process.argv.slice(2);
if (!tokens.length) {
  console.error('Usage: tsx benchmarkRpcOnlyList.ts <token1> <token2> ...');
  process.exit(1);
}

const chainId = Number(process.env.CHAIN_ID || '8453');
const timeoutMs = process.env.TIMEOUT_MS ? Number(process.env.TIMEOUT_MS) : 8000;

async function main() {
  const results: Array<{ token: string; ms: number; ok: boolean }> = [];
  for (const token of tokens) {
    const start = performance.now();
    let ok = false;
    try {
      const res = await Promise.race([
        getOnChainPrice(token, chainId, { rpcStrategy: 'fast' }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
      ]);
      ok = !!res && res.price > 0;
    } catch {
      ok = false;
    }
    const ms = performance.now() - start;
    results.push({ token, ms, ok });
    console.log(`${token},rpc_ok=${ok},rpc_ms=${ms.toFixed(1)}`);
  }
  const avg = results.reduce((s, r) => s + r.ms, 0) / results.length;
  const okCount = results.filter(r => r.ok).length;
  console.log(`SUMMARY chain=${chainId} tokens=${results.length} rpc_ok=${okCount}/${results.length} rpc_avg_ms=${avg.toFixed(1)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
