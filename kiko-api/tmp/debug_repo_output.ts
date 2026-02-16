import { getTrendingTokens } from '../src/repositories/tokenRepository.js';

const baseTargets = new Set([
  '0x9318Ef764eaE1DE8A463296F01113fB18C227Ba3'.toLowerCase(),
  '0x06CecE127F81Bf76d388859549A93a120Ec52BA3'.toLowerCase(),
  '0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf'.toLowerCase(),
]);
const bscTargets = new Set([
  '0xc2E122C518C11d20B108fCBF280AbCF01a4B4444'.toLowerCase(),
  '0xfA72110998F3d401E3d9704afC1Dd4A9Bda04444'.toLowerCase(),
  '0x94e5f19CC645De47121C1082127607b85D1D4444'.toLowerCase(),
]);

async function dump(chain: string, targets: Set<string>) {
  const rows = await getTrendingTokens(chain, 120, { bypassMemoryCache: true, lightweight: true });
  const hit = rows
    .filter((r: any) => targets.has(String(r.address || '').toLowerCase()))
    .map((r: any) => ({
      chain,
      address: r.address,
      name: r.name,
      launchpad: r.launchpad,
      creatorAddress: r.creatorAddress,
      creatorUrl: r.creatorUrl,
      creatorLabel: r.creatorLabel,
    }));
  console.log(`\n${chain.toUpperCase()} hits=${hit.length}`);
  console.table(hit);
}

await dump('base', baseTargets);
await dump('bsc', bscTargets);
