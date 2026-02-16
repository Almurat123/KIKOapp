import { detectLaunchpadToken } from '../src/services/ai/launchpadDetector.js';

const addr = '0x9EadbE35F3Ee3bF3e28180070C429298a1b02F93';
const r = await detectLaunchpadToken(addr, 8453, { mode: 'full', forceRefresh: true, requireCreator: true });
console.log(r ? { provider: r.provider } : null);
