
import { CheckTokenRiskTool } from '../src/tools/tokenRisk.js';

async function testBSC() {
    console.log("Testing BSC Token Risk...");

    // Test a known safe token (CAKE)
    // CAKE Address: 0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82
    const safeToken = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82';
    console.log(`\n--- Testing CAKE (Safe) ---`);
    const resultSafe = await CheckTokenRiskTool.handler({
        address: safeToken,
        chain: 'bsc'
    });
    console.log('Result:', JSON.stringify(resultSafe, null, 2));

    // Test a likely risky or random token (if you have one, otherwise just verify the safe one works first)
    // 0x8076c74c5e3f5852037f31ff0093eeb8c8add8d3 (Safemoon Old - often flagged)
    const riskyToken = '0x8076c74c5e3f5852037f31ff0093eeb8c8add8d3';
    console.log(`\n--- Testing Safemoon V1 (High Risk) ---`);
    const resultRisky = await CheckTokenRiskTool.handler({
        address: riskyToken,
        chain: 'bsc'
    });
    console.log('Result:', JSON.stringify(resultRisky, null, 2));

}

testBSC().catch(console.error).then(() => process.exit(0));
