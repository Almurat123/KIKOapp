import { detectLaunchpadToken } from '../src/services/ai/launchpadDetector.ts';

const address = '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b';

(async () => {
  const result = await detectLaunchpadToken(address, 8453, { mode: 'full' });
  console.log('DOPPLER_HOOK_FALLBACK_ENABLED=', process.env.DOPPLER_HOOK_FALLBACK_ENABLED);
  console.log(JSON.stringify(result, null, 2));
})();
