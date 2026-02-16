import { detectLaunchpadToken } from '../src/services/ai/launchpadDetector.js';

const addrs = [
  '0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf',
  '0x06CecE127F81Bf76d388859549A93a120Ec52BA3',
  '0x9318Ef764eaE1DE8A463296F01113fB18C227Ba3',
  '0xdD505db2F238c85004e01632c252906065A6Ab07',
];
for (const a of addrs) {
  const r = await detectLaunchpadToken(a, 8453, { mode: 'full', forceRefresh: true, requireCreator: true });
  console.log('\n', a, '\n', r ? { provider: r.provider, hasData: !!r.data, keys: r.data ? Object.keys(r.data as any).slice(0, 12) : [] } : null);
  if (r?.provider === 'clanker') {
    console.log('clanker social_context', (r.data as any)?.social_context || null);
  }
}
