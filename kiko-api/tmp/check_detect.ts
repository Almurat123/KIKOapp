import { detectLaunchpadToken } from '../src/services/ai/launchpadDetector.js';

async function main() {
  const addrs = [
    '0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf',
    '0x06CecE127F81Bf76d388859549A93a120Ec52BA3',
    '0x9318Ef764eaE1DE8A463296F01113fB18C227Ba3',
    '0x16332535E2c27da578bC2e82bEb09Ce9d3C8EB07',
  ];
  for (const a of addrs) {
    const r = await detectLaunchpadToken(a, 8453, { mode: 'full', forceRefresh: true, requireCreator: false });
    console.log(a, JSON.stringify(r));
  }
}
main().catch((e)=>{console.error(e);process.exitCode=1});
