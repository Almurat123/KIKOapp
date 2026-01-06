
import { Connection, PublicKey } from '@solana/web3.js';
import { getSolanaConnection } from '../src/config/solanaConfig.js';

const PUMP_PROGRAM = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const BONK_PROGRAM = new PublicKey('LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj');

async function findActiveMint(connection: Connection, programId: PublicKey, name: string) {
    console.log(`Searching for active ${name} tokens...`);
    // Get recent 10 signatures
    const signatures = await connection.getSignaturesForAddress(programId, { limit: 10 });

    for (const sigInfo of signatures) {
        if (sigInfo.err) continue;

        const tx = await connection.getTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0
        });

        if (!tx) continue;

        // Naive heuristic: Look for an account that is NOT the program, NOT system, and is writable/signer
        // Better: For Pump.fun, the mint is the 3rd account in 'buy' typically.
        // Or just print all non-program keys and let us pick one.

        // Let's just output the signature and maybe we can inspect or guess.
        // Actually, we can check account data size to see if it's a Mint (82 bytes) or Token Account (165 bytes).

        const accountKeys = tx.transaction.message.staticAccountKeys;

        // Check for Mint-like accounts (we can't easily check size here without fetching).
        // But we can check if it's involved.

        console.log(`Tx: ${sigInfo.signature}`);
        // Just return the first potential one for manual checking or further script usage
        // This script is just to help me manually finding a mint.
    }
}

async function main() {
    const connection = getSolanaConnection();

    // await findActiveMint(connection, PUMP_PROGRAM, 'Pump.fun');
    console.log('---');
    await findActiveMint(connection, BONK_PROGRAM, 'Bonk.fun');
}

main().catch(console.error);
