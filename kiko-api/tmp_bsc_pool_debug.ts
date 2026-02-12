import { ethers } from 'ethers';
import { getRpcEndpointsWithStrategy } from './src/config/apiEndpoints.js';

async function main() {
  const pool = process.argv[2] || '0x5efA1C13EaAbE45151d750A85a69d1c94219999a';
  const iface = new ethers.Interface([
    'function token0() view returns (address)',
    'function token1() view returns (address)',
  ]);
  const urls = getRpcEndpointsWithStrategy('bsc', 'cheap').filter((e) => !!e.url).map((e) => e.url);
  for (const url of urls.slice(0, 10)) {
    const provider = new ethers.JsonRpcProvider(url, 56, { staticNetwork: true });
    try {
      const d0 = iface.encodeFunctionData('token0');
      const r0 = await provider.call({ to: pool, data: d0 });
      const t0 = String(iface.decodeFunctionResult('token0', r0)[0]);
      const d1 = iface.encodeFunctionData('token1');
      const r1 = await provider.call({ to: pool, data: d1 });
      const t1 = String(iface.decodeFunctionResult('token1', r1)[0]);
      console.log('ok', url, t0, t1);
    } catch (error: any) {
      console.log('fail', url, error?.message || String(error));
    }
  }
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
