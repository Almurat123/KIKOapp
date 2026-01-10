
import { ethers } from 'ethers';

/**
 * SIMULATION: Mirror Sell Precision Logic
 * This script tests the math behind the multi-step retry fallback.
 */

function simulateSell(balance: bigint, decimals: number) {
    console.log(`\n--- Simulating Sell for Balance: ${balance.toString()} (Decimals: ${decimals}) ---`);
    console.log(`Human readable: ${ethers.formatUnits(balance, decimals)}`);

    // Step 1: 100%
    const step1 = balance;
    console.log(`Step 1 (100%): ${step1.toString()} (${ethers.formatUnits(step1, decimals)})`);
    console.log(`Residue: 0`);

    // Step 2: 99.9%
    const step2 = (balance * 999n) / 1000n;
    console.log(`Step 2 (99.9%): ${step2.toString()} (${ethers.formatUnits(step2, decimals)})`);
    const residue2 = balance - step2;
    console.log(`Residue: ${residue2.toString()} (${ethers.formatUnits(residue2, decimals)})`);

    // Step 3: 99.5%
    const step3 = (balance * 995n) / 1000n;
    console.log(`Step 3 (99.5%): ${step3.toString()} (${ethers.formatUnits(step3, decimals)})`);
    const residue3 = balance - step3;
    console.log(`Residue: ${residue3.toString()} (${ethers.formatUnits(residue3, decimals)})`);

    // User's reported case: 1% left (99% sell)
    const oldStep = (balance * 99n) / 100n;
    console.log(`Old Step (99%): ${oldStep.toString()} (${ethers.formatUnits(oldStep, decimals)})`);
    const oldResidue = balance - oldStep;
    console.log(`Old Residue (1%): ${oldResidue.toString()} (${ethers.formatUnits(oldResidue, decimals)})`);
}

// Test Case 1: Standard 18 decimals (e.g. 1 ETH)
simulateSell(ethers.parseEther('1'), 18);

// Test Case 2: BSC Token with 18 decimals (e.g. 1000 Tokens)
simulateSell(ethers.parseEther('1000'), 18);

// Test Case 3: USDC/USDT with 6 decimals (e.g. 100 USDC)
simulateSell(100_000_000n, 6);

// Test Case 4: Small balance (e.g. 0.001 ETH)
simulateSell(ethers.parseEther('0.001'), 18);
