import {
    Connection,
    PublicKey,
    TransactionInstruction,
    VersionedTransaction,
    TransactionMessage,
    SystemProgram,
    SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';
import BN from 'bn.js';
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress
} from '../utils/solanaToken.js';
import { getSolanaConnection } from '../config/solanaConfig.js';
import { getSolanaSigningContext, sendSolanaTransactionWithContext } from './privyWallet.js';
import { getPlatformFee } from './platformFeeService.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { getLatestSolanaBlockhash } from './solana/blockhashProvider.js';
import type { ResolvedSolanaSigningContext } from './solana/solanaSigningContext.js';
import type { FeeConfig as PumpFeeConfig } from '@pump-fun/pump-sdk';

const PUMP_FUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const PUMP_FEE_PROGRAM_ID = new PublicKey('pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

// Raydium LaunchLab Constants (Bonk.fun)
const RAYDIUM_LAUNCHPAD_PROGRAM_ID = new PublicKey('LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj');
const RAYDIUM_POOL_SEED = Buffer.from('pool', 'utf8');
const RAYDIUM_AUTH_SEED = Buffer.from('vault_auth_seed', 'utf8');
const RAYDIUM_EVENT_AUTH_SEED = Buffer.from('__event_authority', 'utf8');

interface RaydiumPoolState {
    configId: PublicKey;
    platformId: PublicKey;
    mintA: PublicKey;
    mintB: PublicKey;
    vaultA: PublicKey;
    vaultB: PublicKey;
    creator: PublicKey;
}

interface PumpBondingCurveState {
    virtualTokenReserves: bigint;
    virtualSolReserves: bigint;
    realTokenReserves: bigint;
    realSolReserves: bigint;
    tokenTotalSupply: bigint;
    complete: boolean;
}

const RAYDIUM_BUY_DISCRIMINATOR = Buffer.from([250, 234, 13, 123, 213, 156, 19, 236]); // buyExactIn
const RAYDIUM_SELL_DISCRIMINATOR = Buffer.from([149, 39, 222, 155, 211, 124, 152, 26]); // sellExactIn

async function getMintProgramId(connection: Connection, mint: PublicKey): Promise<PublicKey> {
    const accountInfo = await connection.getAccountInfo(mint, 'confirmed');
    const owner = accountInfo?.owner;
    if (!owner) {
        return TOKEN_PROGRAM_ID;
    }
    return owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
}

async function getMintSupplyBn(connection: Connection, mint: PublicKey): Promise<BN> {
    const supply = await connection.getTokenSupply(mint, 'confirmed');
    return new BN(supply.value.amount);
}

function derivePumpGlobalPda(): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from('global')], PUMP_FUN_PROGRAM_ID)[0];
}

function derivePumpFeeConfigPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from('fee_config'), PUMP_FUN_PROGRAM_ID.toBuffer()],
        PUMP_FEE_PROGRAM_ID
    )[0];
}

export interface SolanaLaunchpadSwapParams {
    userId: string;
    mint: string;
    // Atomic units of input token: lamports for SOL buys, token base units for sells.
    amount: string;
    isBuy: boolean;
    slippageBps?: number;
    provider: 'pumpfun' | 'bonkfun';
    feeContext?: 'swap' | 'copyTrade';
}

export class SolanaLaunchpadSwapService {
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

    async getBondingCurveState(connection: Connection, mint: PublicKey): Promise<PumpBondingCurveState> {
        const bondingCurve = this.getBondingCurvePDA(mint);
        const accountInfo = await connection.getAccountInfo(bondingCurve, 'confirmed');
        if (!accountInfo) {
            throw new Error(`Bonding curve account not found for mint: ${mint.toBase58()}`);
        }
        const data = accountInfo.data;
        if (data.length < 49) {
            throw new Error(`Invalid bonding curve account data length: ${data.length}`);
        }
        return {
            virtualTokenReserves: data.readBigUInt64LE(8),
            virtualSolReserves: data.readBigUInt64LE(16),
            realTokenReserves: data.readBigUInt64LE(24),
            realSolReserves: data.readBigUInt64LE(32),
            tokenTotalSupply: data.readBigUInt64LE(40),
            complete: data[48] !== 0,
        };
    }

    calculateTokensOut(state: PumpBondingCurveState, solIn: bigint): bigint {
        if (solIn <= 0n) return 0n;
        const k = state.virtualSolReserves * state.virtualTokenReserves;
        const newVirtualSolReserves = state.virtualSolReserves + solIn;
        if (newVirtualSolReserves <= 0n) return 0n;
        const newVirtualTokenReserves = k / newVirtualSolReserves;
        const tokensOut = state.virtualTokenReserves - newVirtualTokenReserves;
        return tokensOut > 0n ? tokensOut : 0n;
    }

    calculateSolOut(state: PumpBondingCurveState, tokensIn: bigint): bigint {
        if (tokensIn <= 0n) return 0n;
        const k = state.virtualSolReserves * state.virtualTokenReserves;
        const newVirtualTokenReserves = state.virtualTokenReserves + tokensIn;
        if (newVirtualTokenReserves <= 0n) return 0n;
        const newVirtualSolReserves = k / newVirtualTokenReserves;
        const solOut = state.virtualSolReserves - newVirtualSolReserves;
        return solOut > 0n ? solOut : 0n;
    }

    /**
     * Execute native swap on Solana Launchpads
     */
    async fastSwap(params: SolanaLaunchpadSwapParams): Promise<string> {
        const { userId, mint: mintStr, isBuy, provider } = params;
        const connection = getSolanaConnection();
        const mint = new PublicKey(mintStr);

        const signingContext = await getSolanaSigningContext(userId);
        const userPubkey = new PublicKey(signingContext.address);

        let amountBI: bigint;
        try {
            amountBI = BigInt(params.amount);
        } catch {
            throw new Error(`Invalid atomic amount: ${params.amount}`);
        }
        if (amountBI <= 0n) {
            throw new Error(`Invalid atomic amount (<=0): ${params.amount}`);
        }

        const fee = getPlatformFee(params.feeContext || 'swap');
        let feeRecipient: PublicKey | null = null;
        if (fee.bps > 0 && fee.solanaRecipient) {
            try {
                feeRecipient = new PublicKey(fee.solanaRecipient);
            } catch {
                logger.warn(LogCode.SYS_ERROR, 'Invalid PLATFORM_FEE_SOLANA_RECIPIENT, skipping Solana launchpad fee', {
                    recipient: fee.solanaRecipient
                });
            }
        }

        let feeAmount = 0n;
        let effectiveAmount = params.amount;
        if (isBuy && feeRecipient && fee.bps > 0) {
            feeAmount = (amountBI * BigInt(fee.bps)) / 10000n;
            if (feeAmount > 0n) {
                if (feeAmount >= amountBI) {
                    throw new Error('Fee is greater than or equal to swap amount');
                }
                effectiveAmount = (amountBI - feeAmount).toString();
            }
        }

        let txHash: string;
        if (provider === 'pumpfun') {
            txHash = await this.executePumpFunSwap(connection, userPubkey, mint, effectiveAmount, isBuy, userId, signingContext, params.slippageBps || 100);
        } else if (provider === 'bonkfun') {
            // For Raydium/Bonk.fun, we need mintB (WSOL usually). Assuming paired with SOL.
            const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
            txHash = await this.executeRaydiumSwap(connection, userPubkey, mint, WSOL_MINT, effectiveAmount, isBuy, userId, signingContext, params.slippageBps || 100);
        } else {
            throw new Error(`Unsupported launchpad provider: ${provider}`);
        }

        if (isBuy && feeRecipient && feeAmount > 0n) {
            try {
                const feeTxHash = await this.sendSolFeeTransfer(connection, userPubkey, feeRecipient, feeAmount, userId, signingContext);
                logger.info(LogCode.EXE_TX_CONFIRMED, 'Solana launchpad fee sent', {
                    provider,
                    feeAmount: feeAmount.toString(),
                    feeRecipient: feeRecipient.toString(),
                    feeTxHash
                });
            } catch (feeErr: any) {
                logger.warn(LogCode.SYS_ERROR, 'Solana launchpad fee transfer failed (non-fatal)', {
                    provider,
                    error: feeErr?.message || String(feeErr)
                });
            }
        }

        return txHash;
    }

    private async sendSolFeeTransfer(
        connection: Connection,
        payer: PublicKey,
        recipient: PublicKey,
        amountLamports: bigint,
        userId: string,
        signingContext: ResolvedSolanaSigningContext
    ): Promise<string> {
        const transferIx = SystemProgram.transfer({
            fromPubkey: payer,
            toPubkey: recipient,
            lamports: amountLamports
        });

        const recentBlockhash = await getLatestSolanaBlockhash(connection, 'launchpad_fee_transfer');
        const messageV0 = new TransactionMessage({
            payerKey: payer,
            recentBlockhash: recentBlockhash.blockhash,
            instructions: [transferIx]
        }).compileToV0Message();

        const transaction = new VersionedTransaction(messageV0);
        const serializedTx = Buffer.from(transaction.serialize()).toString('base64');
        return sendSolanaTransactionWithContext(userId, serializedTx, signingContext);
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
        signingContext: ResolvedSolanaSigningContext,
        slippageBps: number
    ): Promise<string> {
        const PumpSdkModule = await import('@pump-fun/pump-sdk');
        let amountBI: bigint;
        try {
            amountBI = BigInt(amount);
        } catch {
            throw new Error(`Invalid atomic amount: ${amount}`);
        }
        if (amountBI <= 0n) {
            throw new Error(`Invalid atomic amount (<=0): ${amount}`);
        }
        const tokenProgram = await getMintProgramId(connection, mint);
        const mintSupply = await getMintSupplyBn(connection, mint);
        const slippagePercent = Math.max(slippageBps, 0) / 100;
        const userAta = getAssociatedTokenAddress(mint, userPubkey, true, tokenProgram);
        const [globalAccountInfo, feeConfigAccountInfo] = await Promise.all([
            connection.getAccountInfo(derivePumpGlobalPda(), 'confirmed'),
            connection.getAccountInfo(derivePumpFeeConfigPda(), 'confirmed'),
        ]);
        if (!globalAccountInfo) {
            throw new Error('Pump global account unavailable');
        }
        const global = PumpSdkModule.PUMP_SDK.decodeGlobal(globalAccountInfo);

        let feeConfig: PumpFeeConfig | null = null;
        try {
            feeConfig = feeConfigAccountInfo ? PumpSdkModule.PUMP_SDK.decodeFeeConfig(feeConfigAccountInfo) : null;
        } catch (error: any) {
            logger.warn(LogCode.API_FETCH_FAILED, '[PumpFunDirect] fee config unavailable, falling back to global fee params', {
                mint: mint.toBase58(),
                error: error?.message || String(error),
            });
        }

        let instructions: TransactionInstruction[];
        if (isBuy) {
            const [bondingCurveAccountInfo, associatedUserAccountInfo] = await connection.getMultipleAccountsInfo(
                [this.getBondingCurvePDA(mint), userAta],
                'confirmed'
            );
            if (!bondingCurveAccountInfo) {
                throw new Error(`Bonding curve account not found for mint: ${mint.toBase58()}`);
            }
            const bondingCurve = PumpSdkModule.PUMP_SDK.decodeBondingCurve(bondingCurveAccountInfo);
            if (bondingCurve.complete) {
                throw new Error('PUMPFUN_GRADUATED: token has migrated to PumpSwap AMM, bonding curve is closed');
            }

            const tokenAmountOut = PumpSdkModule.getBuyTokenAmountFromSolAmount({
                global,
                feeConfig,
                mintSupply,
                bondingCurve,
                amount: new BN(amountBI.toString()),
            });
            if (tokenAmountOut.lte(new BN(0))) {
                throw new Error('Calculated zero tokens out for the given SOL amount');
            }

            instructions = await PumpSdkModule.PUMP_SDK.buyInstructions({
                global,
                bondingCurveAccountInfo,
                bondingCurve,
                associatedUserAccountInfo,
                mint,
                user: userPubkey,
                amount: tokenAmountOut,
                solAmount: new BN(amountBI.toString()),
                slippage: slippagePercent,
                tokenProgram,
            });
        } else {
            const [bondingCurveAccountInfo, associatedUserAccountInfo] = await connection.getMultipleAccountsInfo(
                [this.getBondingCurvePDA(mint), userAta],
                'confirmed'
            );
            if (!bondingCurveAccountInfo) {
                throw new Error(`Bonding curve account not found for mint: ${mint.toBase58()}`);
            }
            if (!associatedUserAccountInfo) {
                throw new Error(`Associated token account not found for mint: ${mint.toBase58()} and user: ${userPubkey.toBase58()}`);
            }
            const bondingCurve = PumpSdkModule.PUMP_SDK.decodeBondingCurve(bondingCurveAccountInfo);
            if (bondingCurve.complete) {
                throw new Error('PUMPFUN_GRADUATED: token has migrated to PumpSwap AMM, bonding curve is closed');
            }

            const minSolOut = PumpSdkModule.getSellSolAmountFromTokenAmount({
                global,
                feeConfig,
                mintSupply,
                bondingCurve,
                amount: new BN(amountBI.toString()),
            });
            if (minSolOut.lte(new BN(0))) {
                throw new Error('Calculated zero SOL out for the given token amount');
            }

            instructions = await PumpSdkModule.PUMP_SDK.sellInstructions({
                global,
                bondingCurveAccountInfo,
                bondingCurve,
                mint,
                user: userPubkey,
                amount: new BN(amountBI.toString()),
                solAmount: minSolOut,
                slippage: slippagePercent,
                tokenProgram,
                mayhemMode: bondingCurve.isMayhemMode,
                cashback: bondingCurve.isCashbackCoin,
            });
        }

        // Build Versioned Transaction
        const recentBlockhash = await getLatestSolanaBlockhash(connection, 'launchpad_pumpfun_swap');
        const messageV0 = new TransactionMessage({
            payerKey: userPubkey,
            recentBlockhash: recentBlockhash.blockhash,
            instructions,
        }).compileToV0Message();

        const transaction = new VersionedTransaction(messageV0);
        const serializedTx = Buffer.from(transaction.serialize()).toString('base64');

        return sendSolanaTransactionWithContext(userId, serializedTx, signingContext);
    }

    private async executeRaydiumSwap(
        connection: Connection,
        userPubkey: PublicKey,
        mintA: PublicKey,
        mintB: PublicKey,
        amount: string,
        isBuy: boolean,
        userId: string,
        signingContext: ResolvedSolanaSigningContext,
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

        // IMPORTANT: amount is already atomic units.
        let amountBI: bigint;
        try {
            amountBI = BigInt(amount);
        } catch {
            throw new Error(`Invalid atomic amount: ${amount}`);
        }
        if (amountBI <= 0n) {
            throw new Error(`Invalid atomic amount (<=0): ${amount}`);
        }
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
        const recentBlockhash = await getLatestSolanaBlockhash(connection, 'launchpad_raydium_swap');
        const messageV0 = new TransactionMessage({
            payerKey: userPubkey,
            recentBlockhash: recentBlockhash.blockhash,
            instructions,
        }).compileToV0Message();

        const transaction = new VersionedTransaction(messageV0);
        const serializedTx = Buffer.from(transaction.serialize()).toString('base64');

        return sendSolanaTransactionWithContext(userId, serializedTx, signingContext);
    }

    private toBuffer(value: bigint, length: number): Buffer {
        const buf = Buffer.alloc(length);
        buf.writeBigUInt64LE(value);
        return buf;
    }
}

export const solanaLaunchpadSwapService = new SolanaLaunchpadSwapService();
