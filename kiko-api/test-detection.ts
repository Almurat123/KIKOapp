import { detectLaunchpadToken } from './src/services/ai/launchpadDetector.js';

async function testDetection() {
    const address = 'A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump';
    console.log(`Testing detection for: ${address}`);

    const result = await detectLaunchpadToken(address, 900);
    console.log('Detection Result:', result);

    if (result?.provider === 'raydium') {
        console.log('⚠️ Detected as Raydium. This might be why UI shows BonkFun/LaunchLab if mapped that way.');
    } else if (result?.provider === 'pumpfun') {
        console.log('✅ Detected as Pump.fun');
    } else {
        console.log('❓ Detected as:', result?.provider);
    }
}

testDetection();
