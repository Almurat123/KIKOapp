/**
 * Bonk.fun (Raydium Launchpad) Fast Swap Test Script
 */

import { Connection, PublicKey, TransactionInstruction, VersionedTransaction, TransactionMessage, SystemProgram } from '@solana/web3.js';
import { getSolanaConnection } from './src/config/solanaConfig.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from './src/utils/solanaToken.js';

// Raydium LaunchLab Constants
const RAYDIUM_LAUNCHPAD_PROGRAM_ID = new PublicKey('LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj');
const RAYDIUM_POOL_SEED = Buffer.from('pool', 'utf8');
const RAYDIUM_AUTH_SEED = Buffer.from('vault_auth_seed', 'utf8');
const RAYDIUM_EVENT_AUTH_SEED = Buffer.from('__event_authority', 'utf8');

const RAYDIUM_BUY_DISCRIMINATOR = Buffer.from([250, 234, 13, 123, 213, 156, 19, 236]); // buyExactIn

// Test Wallet
const TEST_WALLET = new PublicKey('11111111111111111111111111111111');
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

function getRaydiumPoolPDA(mintA: PublicKey, mintB: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [RAYDIUM_POOL_SEED, mintA.toBuffer(), mintB.toBuffer()],
        RAYDIUM_LAUNCHPAD_PROGRAM_ID
    )[0];
}

async function testBonkFunBuy(mint: PublicKey, solAmount: bigint) {
    console.log('\n=== Testing Bonk.fun (Raydium) Buy Transaction ===');
    console.log(`Mint: ${mint.toBase58()}`);
    console.log(`SOL Amount: ${Number(solAmount) / 1e9}`);

    const connection = getSolanaConnection();

    // 1. Get Pool Account
    console.log('\n[1] Fetching Pool Account...');
    const poolId = getRaydiumPoolPDA(mint, WSOL_MINT);
    console.log(`Pool ID: ${poolId.toBase58()}`);

    const poolAccount = await connection.getAccountInfo(poolId);
    if (!poolAccount) {
        throw new Error('Pool account not found');
    }
    console.log(`Pool Account Data Length: ${poolAccount.data.length}`);

    // 2. Parse Pool Data
    console.log('\n[2] Parsing Pool Data...');
    const data = poolAccount.data;
    const configId = new PublicKey(data.subarray(141, 141 + 32));
    const platformId = new PublicKey(data.subarray(173, 173 + 32));
    const vaultA = new PublicKey(data.subarray(269, 269 + 32));
    const vaultB = new PublicKey(data.subarray(301, 301 + 32));
    const creator = new PublicKey(data.subarray(333, 333 + 32));

    console.log('Config:', configId.toBase58());
    console.log('Platform:', platformId.toBase58());
    console.log('Vault A:', vaultA.toBase58());
    console.log('Vault B:', vaultB.toBase58());

    // 3. Derive PDAs
    const auth = PublicKey.findProgramAddressSync([RAYDIUM_AUTH_SEED], RAYDIUM_LAUNCHPAD_PROGRAM_ID)[0];
    const eventAuth = PublicKey.findProgramAddressSync([RAYDIUM_EVENT_AUTH_SEED], RAYDIUM_LAUNCHPAD_PROGRAM_ID)[0];

    // Fee Vaults
    const platformClaimFeeVault = PublicKey.findProgramAddressSync(
        [platformId.toBuffer(), WSOL_MINT.toBuffer()],
        RAYDIUM_LAUNCHPAD_PROGRAM_ID
    )[0];

    const creatorClaimFeeVault = PublicKey.findProgramAddressSync(
        [creator.toBuffer(), WSOL_MINT.toBuffer()],
        RAYDIUM_LAUNCHPAD_PROGRAM_ID
    )[0];

    // 4. Build Instruction
    console.log('\n[4] Building Instruction...');
    const userTokenAccountA = await getAssociatedTokenAddress(mint, TEST_WALLET);
    const userTokenAccountB = await getAssociatedTokenAddress(WSOL_MINT, TEST_WALLET);

    const minAmountA = 0n; // Test with 0 min out

    const buffer = Buffer.alloc(24);
    buffer.writeBigUInt64LE(solAmount, 0); // amountB (SOL in)
    buffer.writeBigUInt64LE(minAmountA, 8); // minAmountA (Tokens out)
    buffer.writeBigUInt64LE(0n, 16); // shareFeeRate

    const ixData = Buffer.concat([RAYDIUM_BUY_DISCRIMINATOR, buffer]);

    const keys = [
        { pubkey: TEST_WALLET, isSigner: true, isWritable: true },
        { pubkey: auth, isSigner: false, isWritable: false },
        { pubkey: configId, isSigner: false, isWritable: false },
        { pubkey: platformId, isSigner: false, isWritable: false },
        { pubkey: poolId, isSigner: false, isWritable: true },

        { pubkey: userTokenAccountA, isSigner: false, isWritable: true },
        { pubkey: userTokenAccountB, isSigner: false, isWritable: true },
        { pubkey: vaultA, isSigner: false, isWritable: true },
        { pubkey: vaultB, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: WSOL_MINT, isSigner: false, isWritable: false },

        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },

        { pubkey: eventAuth, isSigner: false, isWritable: false },
        { pubkey: RAYDIUM_LAUNCHPAD_PROGRAM_ID, isSigner: false, isWritable: false },

        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: platformClaimFeeVault, isSigner: false, isWritable: true },
        { pubkey: creatorClaimFeeVault, isSigner: false, isWritable: true },
    ];

    const instruction = new TransactionInstruction({
        programId: RAYDIUM_LAUNCHPAD_PROGRAM_ID,
        keys,
        data: ixData
    });

    console.log('Instruction built successfully!');
    console.log('Program ID:', instruction.programId.toBase58());
    console.log('Account count:', instruction.keys.length);

    // 5. Build Transaction
    console.log('\n[5] Building Transaction...');
    const recentBlockhash = await connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
        payerKey: TEST_WALLET,
        recentBlockhash: recentBlockhash.blockhash,
        instructions: [instruction],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);
    const serializedTx = Buffer.from(transaction.serialize()).toString('base64');

    console.log('Transaction built successfully!');
    console.log('Serialized size:', serializedTx.length, 'chars (base64)');
    console.log('\n✅ Bonk.fun Swap Transaction Build: SUCCESS');
}

async function main() {
    try {
        // Active Bonk.fun mint found earlier
        const testMint = new PublicKey('AiaukH7LxwyvRMoDQQTVE296VemactTP3rpoD7csZSAY');
        const testAmount = 100000000n; // 0.1 SOL

        await testBonkFunBuy(testMint, testAmount);
    } catch (error: any) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }
}

main();
