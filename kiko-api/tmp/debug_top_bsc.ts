import { getTrendingTokens } from '../src/repositories/tokenRepository.js';

const rows = await getTrendingTokens('bsc', 30, { bypassMemoryCache: true, lightweight: true });
console.table(rows.slice(0, 12).map((r: any, i:number) => ({
  rank: i+1,
  address: r.address,
  name: r.name,
  launchpad: r.launchpad,
  creatorAddress: r.creatorAddress || '',
  creatorUrl: r.creatorUrl || '',
  creatorLabel: r.creatorLabel || '',
})));
