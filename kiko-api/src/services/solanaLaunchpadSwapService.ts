import {
    Connection,
    PublicKey,
    TransactionInstruction,
    VersionedTransaction,
    TransactionMessage,
    SystemProgram,
    SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress
} from '../utils/solanaToken.js';
import { getSolanaConnection } from '../config/solanaConfig.js';
import { sendSolanaTransaction, getDelegatedSolanaWallet, getServerSolanaWalletAddress } from './privyWallet.js';
import { getPlatformFee, type FeeContext } from './platformFeeService.js';

// Pump.fun Constants
const PUMP_FUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const PUMP_FUN_GLOBAL = new PublicKey('4wTVyMKp1qLzFGZJv8P2zGjUjpasfT76MhYfNCpQ9R3J');
const PUMP_FUN_FEE_RECIPIENT = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM');
const PUMP_FUN_EVENT_AUTHORITY = new PublicKey('Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1');

// Raydium LaunchLab Constants (Bonk.fun)
const RAYDIUM_LAUNCHPAD_PROGRAM_ID = new PublicKey('LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj');
const RAYDIUM_POOL_SEED = Buffer.from('pool', 'utf8');
const RAYDIUM_AUTH_SEED = Buffer.from('vault_auth_seed', 'utf8');
const RAYDIUM_EVENT_AUTH_SEED = Buffer.from('__event_authority', 'utf8');

// Bonding Curve Account Layout
// Discriminator: 8 bytes
// virtualTokenReserves: u64 (8 bytes)
// virtualSolReserves: u64 (8 bytes)
// realTokenReserves: u64 (8 bytes)
// realSolReserves: u64 (8 bytes)
// tokenTotalSupply: u64 (8 bytes)
// complete: bool (1 byte)
interface PumpBondingCurveState {
    virtualTokenReserves: bigint;
    virtualSolReserves: bigint;
    realTokenReserves: bigint;
    realSolReserves: bigint;
    tokenTotalSupply: bigint;
    complete: boolean;
}

interface RaydiumPoolState {
    configId: PublicKey;
    platformId: PublicKey;
    mintA: PublicKey;
    mintB: PublicKey;
    vaultA: PublicKey;
    vaultB: PublicKey;
    creator: PublicKey;
}

// Instructions Discriminators (8 bytes)
const PUMP_BUY_DISCRIMINATOR = Buffer.from([0x66, 0x06, 0x3d, 0x12, 0x01, 0xda, 0xeb, 0xea]);
const PUMP_SELL_DISCRIMINATOR = Buffer.from([0x33, 0xe6, 0x85, 0xa4, 0x01, 0x7f, 0x83, 0xad]);

const RAYDIUM_BUY_DISCRIMINATOR = Buffer.from([250, 234, 13, 123, 213, 156, 19, 236]); // buyExactIn
const RAYDIUM_SELL_DISCRIMINATOR = Buffer.from([149, 39, 222, 155, 211, 124, 152, 26]); // sellExactIn

export interface SolanaLaunchpadSwapParams {
    userId: string;
    mint: string;
    amount: string; // Atomic units (tokens for sell, SOL for buy)
    isBuy: boolean;
    slippageBps?: number;
    provider: 'pumpfun' | 'bonkfun';
    feeContext?: FeeContext;
}

export class SolanaLaunchpadSwapService {
    /**
     * Get Bonding Curve PDA for a mint
     */
    private getBondingCurvePDA(mint: PublicKey): PublicKey {
        return PublicKey.findProgramAddressSync(
            [Buffer.from('bonding-curve'), mint.toBuffer()],
            PUMP_FUN_PROGRAM_ID
        )[0];
    }

    /**
     * Get Raydium Pool PDA
     */
    private getRaydiumPoolPDA(mintA: PublicKey, mintB: PublicKey): PublicKey {
        return PublicKey.findProgramAddressSync(
            [RAYDIUM_POOL_SEED, mintA.toBuffer(), mintB.toBuffer()],
            RAYDIUM_LAUNCHPAD_PROGRAM_ID
        )[0];
    }

    /**
     * Fetch and parse Pump.fun bonding curve state
     */
    async getBondingCurveState(connection: Connection, mint: PublicKey): Promise<PumpBondingCurveState> {
        const bondingCurve = this.getBondingCurvePDA(mint);
        const accountInfo = await connection.getAccountInfo(bondingCurve);

        if (!accountInfo) {
            throw new Error(`Bonding curve account not found for mint: ${mint.toString()}`);
        }

        const data = accountInfo.data;
        if (data.length < 49) {
            throw new Error('Invalid bonding curve account data length');
        }

        // Skip 8 byte discriminator
        return {
            virtualTokenReserves: data.readBigUInt64LE(8),
            virtualSolReserves: data.readBigUInt64LE(16),
            realTokenReserves: data.readBigUInt64LE(24),
            realSolReserves: data.readBigUInt64LE(32),
            tokenTotalSupply: data.readBigUInt64LE(40),
            complete: data[48] !== 0
        };
    }

    /**
     * Calculate tokens out for a given SOL input
     */
    calculateTokensOut(state: PumpBondingCurveState, solIn: bigint): bigint {
        if (solIn <= BigInt(0)) return BigInt(0);

        // Formula: tokensOut = virtualTokenReserves - (virtualSolReserves * virtualTokenReserves) / (virtualSolReserves + solIn)
        const k = state.virtualSolReserves * state.virtualTokenReserves;
        const newVirtualSolReserves = state.virtualSolReserves + solIn;
        const newVirtualTokenReserves = k / newVirtualSolReserves;
        const tokensOut = state.virtualTokenReserves - newVirtualTokenReserves;

        return tokensOut;
    }

    /**
     * Calculate SOL out for a given token input
     */
    calculateSolOut(state: PumpBondingCurveState, tokensIn: bigint): bigint {
        if (tokensIn <= BigInt(0)) return BigInt(0);

        // Formula: solOut = virtualSolReserves - (virtualSolReserves * virtualTokenReserves) / (virtualTokenReserves + tokensIn)
        const k = state.virtualSolReserves * state.virtualTokenReserves;
        const newVirtualTokenReserves = state.virtualTokenReserves + tokensIn;
        const newVirtualSolReserves = k / newVirtualTokenReserves;
        const solOut = state.virtualSolReserves - newVirtualSolReserves;

        return solOut;
    }

    /**
     * Execute native swap on Solana Launchpads
     */
    async fastSwap(params: SolanaLaunchpadSwapParams): Promise<string> {
        const { userId, mint: mintStr, isBuy, provider } = params;
        const connection = getSolanaConnection();
        const mint = new PublicKey(mintStr);

        // 1. Get Wallet
        let walletAddress: string;
        const delegatedWallet = await getDelegatedSolanaWallet(userId);
        if (delegatedWallet) {
            walletAddress = delegatedWallet.address;
        } else {
            walletAddress = await getServerSolanaWalletAddress();
        }
        const userPubkey = new PublicKey(walletAddress);

        // Platform fee: only supported for SOL-in buys on launchpads (charge lamports transfer before swap).
        // For sells, amount semantics differ per program; skip to avoid breaking sell flows.
        let effectiveAmount = params.amount;
        const fee = getPlatformFee(params.feeContext || 'swap');
        if (fee.bps > 0 && fee.solanaRecipient && isBuy) {
            const solAmount = parseFloat(effectiveAmount);
            if (Number.isFinite(solAmount) && solAmount > 0) {
                const lamports = BigInt(Math.floor(solAmount * 1e9));
                const feeLamports = (lamports * BigInt(fee.bps)) / BigInt(10000);
                if (feeLamports > BigInt(0) && lamports > feeLamports) {
                    const recipient = new PublicKey(fee.solanaRecipient);
                    const recentBlockhash = await connection.getLatestBlockhash();
                    const messageV0 = new TransactionMessage({
                        payerKey: userPubkey,
                        recentBlockhash: recentBlockhash.blockhash,
                        instructions: [
                            SystemProgram.transfer({
                                fromPubkey: userPubkey,
                                toPubkey: recipient,
                                lamports: Number(feeLamports),
                            }),
                        ],
                    }).compileToV0Message();
                    const tx = new VersionedTransaction(messageV0);
                    const txB64 = Buffer.from(tx.serialize()).toString('base64');
                    await sendSolanaTransaction(userId, txB64);
                    effectiveAmount = (Number(lamports - feeLamports) / 1e9).toString();
                }
            }
        }

        if (provider === 'pumpfun') {
            return this.executePumpFunSwap(connection, userPubkey, mint, effectiveAmount, isBuy, userId, params.slippageBps || 100);
        } else if (provider === 'bonkfun') {
            // For Raydium/Bonk.fun, we need mintB (WSOL usually). Assuming paired with SOL.
            const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
            return this.executeRaydiumSwap(connection, userPubkey, mint, WSOL_MINT, effectiveAmount, isBuy, userId, params.slippageBps || 100);
        } else {
            throw new Error(`Unsupported launchpad provider: ${provider}`);
        }
    }

    /**
     * Build and execute Pump.fun swap transaction
     */
    private async executePumpFunSwap(
        connection: Connection,
        userPubkey: PublicKey,
        mint: PublicKey,
        amount: string,
        isBuy: boolean,
        userId: string,
        slippageBps: number
    ): Promise<string> {
        const bondingCurve = this.getBondingCurvePDA(mint);
        const associatedBondingCurve = await getAssociatedTokenAddress(mint, bondingCurve, true);
        const userATA = await getAssociatedTokenAddress(mint, userPubkey);

        const instructions: TransactionInstruction[] = [];

        // Note: For Pump.fun, we don't strictly need to create userATA here if we buy,
        // but it's safer to include it or the program will fail if it's not present.
        // However, Pump.fun's buy instruction handles ATA creation if it's passed? 
        // Actually, it uses the userATA account.

        // Buy instruction data: [disc, amountTokens, maxSol]
        // Sell instruction data: [disc, amountTokens, minSol]
        // Convert amount from SOL (string like '0.01') to lamports (BigInt)
        // 1 SOL = 1,000,000,000 lamports (1e9)
        const solAmount = parseFloat(amount);
        if (isNaN(solAmount) || solAmount <= 0) {
            throw new Error(`Invalid SOL amount: ${amount}`);
        }
        const amountBI = BigInt(Math.floor(solAmount * 1e9));
        let data: Buffer;

        if (isBuy) {
            // For Buy, 'amount' is the SOL to spend (lamports)
            const state = await this.getBondingCurveState(connection, mint);
            const tokensOut = this.calculateTokensOut(state, amountBI);

            if (tokensOut <= BigInt(0)) {
                throw new Error('Calculated zero tokens out for the given SOL amount');
            }

            // data: [disc, tokens, max_sol]
            // We use a small slippage for max_sol (sol_in + 1% typically, but since we are buying 'fixed tokens'
            // we should set max_sol to what we are actually sending or slightly more)
            // Pump.fun instruction: if you want to buy X tokens, what's the max SOL you pay.
            const maxSol = amountBI + (amountBI * BigInt(slippageBps) / BigInt(10000));

            data = Buffer.concat([
                PUMP_BUY_DISCRIMINATOR,
                this.toBuffer(tokensOut, 8),
                this.toBuffer(maxSol, 8)
            ]);

            console.log(`[PumpFun] Buying ${tokensOut} tokens for max ${maxSol} lamports (Input: ${amountBI} lamports)`);
        } else {
            // Sell: 'amount' is tokens
            const state = await this.getBondingCurveState(connection, mint);
            const solOut = this.calculateSolOut(state, amountBI);

            // data: [disc, tokens, min_sol]
            const minSol = solOut - (solOut * BigInt(slippageBps) / BigInt(10000));

            data = Buffer.concat([
                PUMP_SELL_DISCRIMINATOR,
                this.toBuffer(amountBI, 8),
                this.toBuffer(minSol, 8)
            ]);

            console.log(`[PumpFun] Selling ${amountBI} tokens for min ${minSol} lamports`);
        }

        const keys = [
            { pubkey: PUMP_FUN_GLOBAL, isSigner: false, isWritable: false },
            { pubkey: PUMP_FUN_FEE_RECIPIENT, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: bondingCurve, isSigner: false, isWritable: true },
            { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
            { pubkey: userATA, isSigner: false, isWritable: true },
            { pubkey: userPubkey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: PUMP_FUN_EVENT_AUTHORITY, isSigner: false, isWritable: false },
            { pubkey: PUMP_FUN_PROGRAM_ID, isSigner: false, isWritable: false },
        ];

        instructions.push(new TransactionInstruction({
            programId: PUMP_FUN_PROGRAM_ID,
            keys,
            data
        }));

        // Build Versioned Transaction
        const recentBlockhash = await connection.getLatestBlockhash();
        const messageV0 = new TransactionMessage({
            payerKey: userPubkey,
            recentBlockhash: recentBlockhash.blockhash,
            instructions,
        }).compileToV0Message();

        const transaction = new VersionedTransaction(messageV0);
        const serializedTx = Buffer.from(transaction.serialize()).toString('base64');

        return sendSolanaTransaction(userId, serializedTx);
    }

    private async executeRaydiumSwap(
        connection: Connection,
        userPubkey: PublicKey,
        mintA: PublicKey,
        mintB: PublicKey,
        amount: string,
        isBuy: boolean,
        userId: string,
        slippageBps: number
    ): Promise<string> {
        const poolId = this.getRaydiumPoolPDA(mintA, mintB);
        const poolAccount = await connection.getAccountInfo(poolId);

        if (!poolAccount) {
            throw new Error('Raydium Pool account not found');
        }

        // Parse Pool Account manually using offsets derived from layout.ts
        const data = poolAccount.data;

        // Offsets:
        // 0: u64 (discriminator/prefix)
        // 141: configId (32)
        // 173: platformId (32)
        // 205: mintA (32)
        // 237: mintB (32)
        // 269: vaultA (32)
        // 301: vaultB (32)
        // 333: creator (32)

        const configId = new PublicKey(data.subarray(141, 141 + 32));
        const platformId = new PublicKey(data.subarray(173, 173 + 32));
        const vaultA = new PublicKey(data.subarray(269, 269 + 32));
        const vaultB = new PublicKey(data.subarray(301, 301 + 32));
        const creator = new PublicKey(data.subarray(333, 333 + 32));

        // Derived PDAs
        const auth = PublicKey.findProgramAddressSync([RAYDIUM_AUTH_SEED], RAYDIUM_LAUNCHPAD_PROGRAM_ID)[0];
        const eventAuth = PublicKey.findProgramAddressSync([RAYDIUM_EVENT_AUTH_SEED], RAYDIUM_LAUNCHPAD_PROGRAM_ID)[0];

        // Platform & Creator Fee Vaults
        // getPdaPlatformVault: [platformId, mintB]
        const platformClaimFeeVault = PublicKey.findProgramAddressSync(
            [platformId.toBuffer(), mintB.toBuffer()],
            RAYDIUM_LAUNCHPAD_PROGRAM_ID
        )[0];

        // getPdaCreatorVault: [creator, mintB]
        const creatorClaimFeeVault = PublicKey.findProgramAddressSync(
            [creator.toBuffer(), mintB.toBuffer()],
            RAYDIUM_LAUNCHPAD_PROGRAM_ID
        )[0];

        // User Accounts
        const userTokenAccountA = await getAssociatedTokenAddress(mintA, userPubkey);
        const userTokenAccountB = await getAssociatedTokenAddress(mintB, userPubkey);

        const instructions: TransactionInstruction[] = [];

        // Convert amount from SOL (string like '0.01') to lamports (BigInt)
        const solAmount = parseFloat(amount);
        if (isNaN(solAmount) || solAmount <= 0) {
            throw new Error(`Invalid SOL amount: ${amount}`);
        }
        const amountBI = BigInt(Math.floor(solAmount * 1e9));
        let ixData: Buffer;

        // Discriminator & Data Layout
        if (isBuy) {
            // BUY: amount is SOL (input B)
            // buyExactIn: [disc, amountB, minAmountA, shareFeeRate]
            // We use slippage for minAmountA. Since we don't have bonding curve state calculation yet,
            // we will set minAmountA to 0 for now or a very conservative estimate if possible.
            // TODO: Implement getRaydiumCurveState for proper slippage.

            const minAmountA = BigInt(0); // Allow max slippage for now (or implement calc)

            const buffer = Buffer.alloc(24); // 3 * u64
            buffer.writeBigUInt64LE(amountBI, 0); // amountB (SOL in)
            buffer.writeBigUInt64LE(minAmountA, 8); // minAmountA (Tokens out)
            buffer.writeBigUInt64LE(BigInt(0), 16); // shareFeeRate

            ixData = Buffer.concat([RAYDIUM_BUY_DISCRIMINATOR, buffer]);
        } else {
            // SELL: amount is Tokens (input A)
            // sellExactIn: [disc, amountA, minAmountB, shareFeeRate]

            const minAmountB = BigInt(0); // TODO: slippage

            const buffer = Buffer.alloc(24);
            buffer.writeBigUInt64LE(amountBI, 0); // amountA (Tokens in)
            buffer.writeBigUInt64LE(minAmountB, 8); // minAmountB (SOL out)
            buffer.writeBigUInt64LE(BigInt(0), 16); // shareFeeRate

            ixData = Buffer.concat([RAYDIUM_SELL_DISCRIMINATOR, buffer]);
        }

        const keys = [
            { pubkey: userPubkey, isSigner: true, isWritable: true },
            { pubkey: auth, isSigner: false, isWritable: false },
            { pubkey: configId, isSigner: false, isWritable: false },
            { pubkey: platformId, isSigner: false, isWritable: false },
            { pubkey: poolId, isSigner: false, isWritable: true },

            { pubkey: userTokenAccountA, isSigner: false, isWritable: true },
            { pubkey: userTokenAccountB, isSigner: false, isWritable: true },
            { pubkey: vaultA, isSigner: false, isWritable: true },
            { pubkey: vaultB, isSigner: false, isWritable: true },
            { pubkey: mintA, isSigner: false, isWritable: false },
            { pubkey: mintB, isSigner: false, isWritable: false }, // WSOL mint

            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Token Program B (same)

            { pubkey: eventAuth, isSigner: false, isWritable: false },
            { pubkey: RAYDIUM_LAUNCHPAD_PROGRAM_ID, isSigner: false, isWritable: false },

            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: platformClaimFeeVault, isSigner: false, isWritable: true },
            { pubkey: creatorClaimFeeVault, isSigner: false, isWritable: true },
        ];

        instructions.push(new TransactionInstruction({
            programId: RAYDIUM_LAUNCHPAD_PROGRAM_ID,
            keys,
            data: ixData
        }));

        // Build Versioned Transaction
        const recentBlockhash = await connection.getLatestBlockhash();
        const messageV0 = new TransactionMessage({
            payerKey: userPubkey,
            recentBlockhash: recentBlockhash.blockhash,
            instructions,
        }).compileToV0Message();

        const transaction = new VersionedTransaction(messageV0);
        const serializedTx = Buffer.from(transaction.serialize()).toString('base64');

        return sendSolanaTransaction(userId, serializedTx);
    }

    private toBuffer(value: bigint, length: number): Buffer {
        const buf = Buffer.alloc(length);
        buf.writeBigUInt64LE(value);
        return buf;
    }
}

export const solanaLaunchpadSwapService = new SolanaLaunchpadSwapService();
