import { detectLaunchpadToken } from './src/services/ai/launchpadDetector.js';

async function testDetection() {
    // ERIKA = 8n1KRuB9WX6VRhpBo9SGxe1EWKQzudtrcC8ePATnbonk
    // This token has no API metadata indicators but has Update Auth = Launchpad Auth PDA
    const address = '8n1KRuB9WX6VRhpBo9SGxe1EWKQzudtrcC8ePATnbonk';
    console.log(`Testing detection for: ${address}`);

    // Test context: detection logic
    const result = await detectLaunchpadToken(address, 101); // Solana chain ID is often handled internally or mapped to 900/101

    console.log('Detection Result:', result); // Expecting provider: 'bonkfun'

    if (result) {
        if (result.provider === 'bonkfun') {
            console.log('✅ Correctly detected as BonkFun (via Launchpad ID)');
        } else if (result.provider === 'raydium') {
            console.log('⚠️ Detected as Raydium (Generic) - Should be BonkFun?');
        } else if (result.provider === 'pumpfun') {
            console.log('❌ Incorrectly detected as Pump.fun');
        } else {
            console.log('❓ Detected as:', result.provider);
        }
    } else {
        console.log('❌ Failed to detect token');
    }
}

testDetection();
