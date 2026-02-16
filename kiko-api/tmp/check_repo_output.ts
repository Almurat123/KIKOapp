import { getTrendingTokens } from '../src/repositories/tokenRepository.js';

async function main() {
  const base = await getTrendingTokens('base', 120, { bypassMemoryCache: true, lightweight: true });
  const bsc = await getTrendingTokens('bsc', 120, { bypassMemoryCache: true, lightweight: true });
  const pick = (rows: any[], addr: string) => rows.find((r) => String(r.address).toLowerCase() === addr.toLowerCase());

  const targets = [
    '0x9318Ef764eaE1DE8A463296F01113fB18C227Ba3',
    '0x06CecE127F81Bf76d388859549A93a120Ec52BA3',
    '0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf',
    '0x16332535E2c27da578bC2e82bEb09Ce9d3C8EB07',
    '0xc2E122C518C11d20B108fCBF280AbCF01a4B4444',
    '0xfA72110998F3d401E3d9704afC1Dd4A9Bda04444',
    '0x94e5f19CC645De47121C1082127607b85D1D4444',
  ];

  const out = targets.map((addr) => ({
    address: addr,
    base: pick(base, addr),
    bsc: pick(bsc, addr),
  }));

  const badBase = base
    .filter((r: any) => {
      const l = String((r as any).creatorLabel || '').trim();
      return /^fid:\d+$/i.test(l) || /^@?\d+$/.test(l) || /^@?(i|status)$/i.test(l);
    })
    .map((r: any) => ({ address: r.address, symbol: r.symbol, launchpad: (r as any).launchpad, creatorLabel: (r as any).creatorLabel, creatorUrl: (r as any).creatorUrl }));

  const badBsc = bsc
    .filter((r: any) => {
      const l = String((r as any).creatorLabel || '').trim();
      return /^fid:\d+$/i.test(l) || /^@?\d+$/.test(l) || /^@?(i|status)$/i.test(l);
    })
    .map((r: any) => ({ address: r.address, symbol: r.symbol, launchpad: (r as any).launchpad, creatorLabel: (r as any).creatorLabel, creatorUrl: (r as any).creatorUrl }));

  console.log(JSON.stringify({ out, badBase, badBsc, baseCount: base.length, bscCount: bsc.length }, null, 2));
}

main().catch((e)=>{console.error(e); process.exitCode=1;});
