/**
 * Script to check and clean up ghost positions
 * Ghost positions are database records where the buy transaction failed on-chain
 * but the Position record was still created.
 */

import prisma from '../db/prisma.js';
import { ethers } from 'ethers';
import { getChainConfig } from '../config/chainConfig.js';

const DRY_RUN = process.argv.includes('--dry-run');

async function checkPositions() {
    console.log('=== Checking Open Positions for Ghost Entries ===\n');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : '⚠️ LIVE MODE (will close ghost positions)'}\n`);

    // 1. Get all open positions
    const openPositions = await prisma.position.findMany({
        where: { status: 'open' },
        include: { user: true }
    });

    console.log(`Found ${openPositions.length} open positions\n`);

    let ghostCount = 0;
    let validCount = 0;

    for (const pos of openPositions) {
        console.log(`\n--- Position ${pos.id.slice(0, 8)}... ---`);
        console.log(`  Token: ${pos.tokenSymbol || 'Unknown'} (${pos.tokenAddress.slice(0, 10)}...)`);
        console.log(`  Chain: ${pos.chainId}`);
        console.log(`  Entry TX: ${pos.entryTxHash.slice(0, 15)}...`);
        console.log(`  Entry Value: $${pos.entryUsdValue.toFixed(2)}`);
        console.log(`  User Wallet: ${pos.user.walletAddress.slice(0, 10)}...`);

        // Skip Solana positions (different balance check)
        if (pos.chainId === 900) {
            console.log(`  ⏭️ Skipping Solana position (manual check required)`);
            continue;
        }

        // 2. Check actual on-chain balance
        try {
            const chainConfig = getChainConfig(pos.chainId);
            const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);

            const tokenContract = new ethers.Contract(
                pos.tokenAddress,
                ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
                provider
            );

            const [balance, decimals] = await Promise.all([
                tokenContract.balanceOf(pos.user.walletAddress),
                tokenContract.decimals().catch(() => 18)
            ]);

            const balanceFormatted = parseFloat(ethers.formatUnits(balance, decimals));
            console.log(`  On-chain Balance: ${balanceFormatted.toFixed(6)} tokens`);

            // 3. Determine if ghost (balance is essentially zero)
            if (balance === 0n || balanceFormatted < 0.000001) {
                console.log(`  🚨 GHOST POSITION DETECTED - No actual balance!`);
                ghostCount++;

                if (!DRY_RUN) {
                    // Close the ghost position
                    await prisma.position.update({
                        where: { id: pos.id },
                        data: {
                            status: 'closed',
                            exitReason: 'ghost_position_cleanup',
                            closedAt: new Date()
                        }
                    });
                    console.log(`  ✅ Position closed (marked as ghost_position_cleanup)`);
                } else {
                    console.log(`  [DRY RUN] Would close this position`);
                }
            } else {
                console.log(`  ✅ Valid position - has actual balance`);
                validCount++;
            }

        } catch (err: any) {
            console.log(`  ⚠️ Error checking balance: ${err.message}`);
            // Don't close if we can't verify - might be a temporary RPC issue
        }
    }

    console.log('\n=== Summary ===');
    console.log(`Total Open Positions: ${openPositions.length}`);
    console.log(`Valid Positions: ${validCount}`);
    console.log(`Ghost Positions: ${ghostCount}`);

    if (DRY_RUN && ghostCount > 0) {
        console.log(`\nRun without --dry-run to close ghost positions`);
    }

    await prisma.$disconnect();
}

checkPositions().catch(console.error);
