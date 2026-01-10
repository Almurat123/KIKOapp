import { getSolanaConnection } from '../config/solanaConfig.js';
import { decodeSolanaSwap } from '../services/solanaDecoder.js';
import 'dotenv/config';

async function main() {
    const signature = '3p1o6Ko34m7QA5ud5ZNoWN2bPGLFkXLLf4VJ1QTTaMp3Z2nLsyTE9M3pDjtE4iwVMPTJHKTGQoWzQN3y9m7epGLv';
    const wallet = 'CWk2NqZwy3Fo9cumJcWwt45j4D6FnboS5h3vHZWtKyvV';

    console.log(`[Test] Fetching Solana tx: ${signature}`);
    const connection = getSolanaConnection();

    try {
        const tx = await connection.getParsedTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
        });

        if (!tx) {
            console.error('[Test] ❌ Could not fetch transaction. It might be too new or already expired.');
            return;
        }

        console.log('[Test] Finalizing decode...');
        const swap = await decodeSolanaSwap(tx, wallet);

        if (swap) {
            console.log('[Test] ✅ Successfully decoded swap:');
            console.log(JSON.stringify(swap, null, 2));
        } else {
            console.log('[Test] ❌ Not a swap for this wallet.');
        }
    } catch (error) {
        console.error('[Test] Error during decode test:', error);
    }
}

main().catch(console.error);
