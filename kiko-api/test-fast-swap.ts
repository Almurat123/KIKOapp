/**
 * Fast Swap Test Script (Dry Run)
 * Tests the transaction building logic without actually sending transactions
 */

import { Connection, PublicKey, TransactionInstruction, VersionedTransaction, TransactionMessage, SystemProgram } from '@solana/web3.js';
import { getSolanaConnection } from './src/config/solanaConfig.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from './src/utils/solanaToken.js';

// Pump.fun Constants
const PUMP_FUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const PUMP_FUN_GLOBAL = new PublicKey('4wTVyMKp1qLzFGZJv8P2zGjUjpasfT76MhYfNCpQ9R3J');
const PUMP_FUN_FEE_RECIPIENT = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM');
const PUMP_FUN_EVENT_AUTHORITY = new PublicKey('Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1');

const PUMP_BUY_DISCRIMINATOR = Buffer.from([0x66, 0x06, 0x3d, 0x12, 0x01, 0xda, 0xeb, 0xea]);

// Test wallet (random, not real - just for building tx)
const TEST_WALLET = new PublicKey('11111111111111111111111111111111');

function toBuffer(value: bigint, length: number): Buffer {
    const buf = Buffer.alloc(length);
    buf.writeBigUInt64LE(value);
    return buf;
}

function getBondingCurvePDA(mint: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from('bonding-curve'), mint.toBuffer()],
        PUMP_FUN_PROGRAM_ID
    )[0];
}

interface BondingCurveState {
    virtualTokenReserves: bigint;
    virtualSolReserves: bigint;
    realTokenReserves: bigint;
    realSolReserves: bigint;
    tokenTotalSupply: bigint;
    complete: boolean;
}

async function getBondingCurveState(connection: Connection, mint: PublicKey): Promise<BondingCurveState> {
    const bondingCurve = getBondingCurvePDA(mint);
    const accountInfo = await connection.getAccountInfo(bondingCurve);

    if (!accountInfo) {
        throw new Error(`Bonding curve not found for ${mint.toBase58()}`);
    }

    const data = accountInfo.data;
    return {
        virtualTokenReserves: data.readBigUInt64LE(8),
        virtualSolReserves: data.readBigUInt64LE(16),
        realTokenReserves: data.readBigUInt64LE(24),
        realSolReserves: data.readBigUInt64LE(32),
        tokenTotalSupply: data.readBigUInt64LE(40),
        complete: data[48] !== 0
    };
}

function calculateTokensOut(state: BondingCurveState, solIn: bigint): bigint {
    if (solIn <= 0n) return 0n;
    const k = state.virtualSolReserves * state.virtualTokenReserves;
    const newVirtualSolReserves = state.virtualSolReserves + solIn;
    const newVirtualTokenReserves = k / newVirtualSolReserves;
    return state.virtualTokenReserves - newVirtualTokenReserves;
}

async function testPumpFunBuy(mint: PublicKey, solAmount: bigint) {
    console.log('\n=== Testing Pump.fun Buy Transaction ===');
    console.log(`Mint: ${mint.toBase58()}`);
    console.log(`SOL Amount: ${Number(solAmount) / 1e9} SOL (${solAmount} lamports)`);

    const connection = getSolanaConnection();

    // 1. Get Bonding Curve State
    console.log('\n[1] Fetching bonding curve state...');
    const state = await getBondingCurveState(connection, mint);
    console.log('State:', {
        virtualSol: `${Number(state.virtualSolReserves) / 1e9} SOL`,
        virtualToken: state.virtualTokenReserves.toString(),
        complete: state.complete
    });

    if (state.complete) {
        console.log('⚠️ Token has completed bonding curve. Native swap not applicable.');
        return;
    }

    // 2. Calculate Output
    console.log('\n[2] Calculating token output...');
    const tokensOut = calculateTokensOut(state, solAmount);
    console.log(`Estimated Tokens Out: ${tokensOut}`);

    // 3. Build Instruction
    console.log('\n[3] Building transaction instruction...');
    const bondingCurve = getBondingCurvePDA(mint);
    const associatedBondingCurve = getAssociatedTokenAddress(mint, bondingCurve, true);
    const userATA = getAssociatedTokenAddress(mint, TEST_WALLET);

    const slippageBps = 100; // 1%
    const maxSol = solAmount + (solAmount * BigInt(slippageBps) / 10000n);

    const data = Buffer.concat([
        PUMP_BUY_DISCRIMINATOR,
        toBuffer(tokensOut, 8),
        toBuffer(maxSol, 8)
    ]);

    const keys = [
        { pubkey: PUMP_FUN_GLOBAL, isSigner: false, isWritable: false },
        { pubkey: PUMP_FUN_FEE_RECIPIENT, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: bondingCurve, isSigner: false, isWritable: true },
        { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
        { pubkey: userATA, isSigner: false, isWritable: true },
        { pubkey: TEST_WALLET, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: PUMP_FUN_EVENT_AUTHORITY, isSigner: false, isWritable: false },
        { pubkey: PUMP_FUN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    const instruction = new TransactionInstruction({
        programId: PUMP_FUN_PROGRAM_ID,
        keys,
        data
    });

    console.log('Instruction built successfully!');
    console.log('Program ID:', instruction.programId.toBase58());
    console.log('Account count:', instruction.keys.length);
    console.log('Data length:', instruction.data.length, 'bytes');

    // 4. Build Transaction (but don't sign/send)
    console.log('\n[4] Building versioned transaction...');
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

    console.log('\n✅ Fast Swap Transaction Build: SUCCESS');
    console.log('---');
    console.log('Summary:');
    console.log(`  Input: ${Number(solAmount) / 1e9} SOL`);
    console.log(`  Output: ~${tokensOut} tokens`);
    console.log(`  Max SOL (with slippage): ${Number(maxSol) / 1e9} SOL`);
}

async function main() {
    try {
        // Use a known active Pump.fun token
        const testMint = new PublicKey('7N9uKLksN2FmoLxDiNc8Kdv4NYxJC174hRLcCSYZpump');
        const testAmount = 100000000n; // 0.1 SOL

        await testPumpFunBuy(testMint, testAmount);

        console.log('\n\n=== All Tests Passed ===');
    } catch (error: any) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }
}

main();
