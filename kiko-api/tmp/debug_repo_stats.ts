import { getTrendingTokens } from '../src/repositories/tokenRepository.js';

const chains = ['base','bsc','solana'];
const low = (v?: string | null) => {
  const s = String(v || '').trim();
  if (!s) return false;
  return /^fid:\d+$/i.test(s) || /^@?\d+$/.test(s) || /^@?(i|status)$/i.test(s);
};

for (const chain of chains) {
  const rows = await getTrendingTokens(chain, 120, { bypassMemoryCache: true, lightweight: true });
  const lowLabel = rows.filter((r: any) => low(r.creatorLabel)).length;
  const launchpadNoCreator = rows.filter((r: any) => r.launchpad && !r.creatorAddress && !r.creatorUrl && !r.creatorLabel).length;
  const withLaunchpad = rows.filter((r: any) => !!r.launchpad).length;
  console.log(JSON.stringify({chain, total: rows.length, withLaunchpad, lowLabel, launchpadNoCreator}));
}
