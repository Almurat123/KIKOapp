import { Connection, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { SOLANA_CONFIG, getSolanaConnection } from '../../../config/solanaConfig.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { getPlatformFee } from '../../platformFeeService.js';
import { getSolanaSigningContext, sendSolanaTransactionWithContext } from '../../privyWallet.js';
import { getLatestSolanaBlockhash } from '../blockhashProvider.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '../../../utils/solanaToken.js';
import type { SolDirectExecutionRequest, SolDirectExecutionResult } from './types.js';
import type { ResolvedSolanaSigningContext } from '../solanaSigningContext.js';

const PUMPFUN_PROGRAM_ID = new PublicKey(SOLANA_CONFIG.PROGRAMS.PUMP_FUN);
const PUMP_SWAP_PROGRAM_ID = new PublicKey(SOLANA_CONFIG.PROGRAMS.PUMP_SWAP);
const FEE_PROGRAM_ID = new PublicKey('pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ');
const WSOL_MINT = new PublicKey(SOLANA_CONFIG.TOKENS.SOL);
const SYSTEM_PROGRAM_ID = SystemProgram.programId;
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const BUY_DISCRIMINATOR = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);
const SELL_DISCRIMINATOR = Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]);
const FEE_CONFIG_MAGIC = Buffer.from([
  12, 20, 222, 252, 130, 94, 198, 118, 148, 37, 8, 24, 187, 101, 64, 101,
  244, 41, 141, 49, 86, 213, 113, 180, 212, 248, 9, 12, 24, 233, 168, 99,
]);
const PROTOCOL_FEE_RECIPIENT = new PublicKey('62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV');

function encodeAtaCreate(): Buffer {
  return Buffer.alloc(0);
}

function encodeSyncNative(): Buffer {
  return Buffer.from([17]);
}

function encodeCloseAccount(): Buffer {
  return Buffer.from([9]);
}

function createAssociatedTokenAccountInstruction(
  payer: PublicKey,
  ata: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
  tokenProgramId: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: tokenProgramId, isSigner: false, isWritable: false },
    ],
    data: encodeAtaCreate(),
  });
}

function createSyncNativeInstruction(tokenAccount: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [{ pubkey: tokenAccount, isSigner: false, isWritable: true }],
    data: encodeSyncNative(),
  });
}

function createCloseAccountInstruction(
  account: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data: encodeCloseAccount(),
  });
}

async function getWalletSigningContext(userId: string): Promise<ResolvedSolanaSigningContext> {
  return getSolanaSigningContext(userId);
}

async function getMintProgramId(connection: Connection, mint: PublicKey): Promise<PublicKey> {
  const accountInfo = await connection.getAccountInfo(mint, 'confirmed');
  const owner = accountInfo?.owner;
  if (!owner) {
    return TOKEN_PROGRAM_ID;
  }
  return owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
}

function derivePoolAuthority(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('pool-authority'), mint.toBuffer()], PUMPFUN_PROGRAM_ID)[0];
}

function derivePoolPda(mint: PublicKey, quoteMint: PublicKey = WSOL_MINT, poolIndex = 0): PublicKey {
  const poolAuthority = derivePoolAuthority(mint);
  const poolIndexBuffer = Buffer.alloc(2);
  poolIndexBuffer.writeUInt16LE(poolIndex, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), poolIndexBuffer, poolAuthority.toBuffer(), mint.toBuffer(), quoteMint.toBuffer()],
    PUMP_SWAP_PROGRAM_ID,
  )[0];
}

function derivePoolV2Pda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('pool-v2'), mint.toBuffer()], PUMP_SWAP_PROGRAM_ID)[0];
}

function deriveCreatorVaultAuthority(creator: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('creator_vault'), creator.toBuffer()], PUMP_SWAP_PROGRAM_ID)[0];
}

function deriveFeeConfig(): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('fee_config'), FEE_CONFIG_MAGIC], FEE_PROGRAM_ID)[0];
}

function deriveGlobalConfig(): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('global_config')], PUMP_SWAP_PROGRAM_ID)[0];
}

function deriveEventAuthority(): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('__event_authority')], PUMP_SWAP_PROGRAM_ID)[0];
}

function deriveGlobalVolumeAccumulator(): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('global_volume_accumulator')], PUMP_SWAP_PROGRAM_ID)[0];
}

function deriveUserVolumeAccumulator(user: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('user_volume_accumulator'), user.toBuffer()], PUMP_SWAP_PROGRAM_ID)[0];
}

function toU64LE(value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value);
  return buf;
}

async function resolveReserves(
  connection: Connection,
  poolBaseAta: PublicKey,
  poolQuoteAta: PublicKey,
): Promise<{ baseReserves: bigint; quoteReserves: bigint }> {
  const [baseBalResp, quoteBalResp] = await Promise.all([
    connection.getTokenAccountBalance(poolBaseAta, 'confirmed'),
    connection.getTokenAccountBalance(poolQuoteAta, 'confirmed'),
  ]);
  return {
    baseReserves: BigInt(baseBalResp.value.amount),
    quoteReserves: BigInt(quoteBalResp.value.amount),
  };
}

function computeBuyAmounts(quoteInLamports: bigint, baseReserves: bigint, quoteReserves: bigint, slippageBps: number) {
  const feeBps = 30n;
  const tokenOut = quoteInLamports;
  if (baseReserves < tokenOut) {
    throw new Error(`insufficient base reserves: need ${tokenOut}, have ${baseReserves}`);
  }
  const k = baseReserves * quoteReserves;
  const newBaseReserves = baseReserves - tokenOut;
  if (newBaseReserves <= 0n) {
    throw new Error('cannot consume full pool reserves');
  }
  let quoteIn = (k / newBaseReserves) - quoteReserves;
  if (k % newBaseReserves !== 0n) quoteIn += 1n;
  if (quoteIn < 0n) quoteIn = 0n;
  let quoteInWithFee = (quoteIn * 10000n) / (10000n - feeBps);
  if ((quoteIn * 10000n) % (10000n - feeBps) !== 0n) quoteInWithFee += 1n;
  const slip = BigInt(slippageBps);
  let maxQuoteAmountIn = (quoteInWithFee * (10000n + slip)) / 10000n;
  if ((quoteInWithFee * (10000n + slip)) % 10000n !== 0n) maxQuoteAmountIn += 1n;
  return { tokenOut, maxQuoteAmountIn };
}

function computeSellAmounts(tokenIn: bigint, baseReserves: bigint, quoteReserves: bigint, slippageBps: number) {
  const feeBps = 30n;
  const tokenInWithFee = (tokenIn * (10000n - feeBps)) / 10000n;
  const newBaseReserve = baseReserves + tokenInWithFee;
  const product = baseReserves * quoteReserves;
  let quoteOut = quoteReserves - (product / newBaseReserve);
  if (quoteOut < 0n) quoteOut = 0n;
  const slip = BigInt(slippageBps);
  const minQuoteAmountOut = (quoteOut * (10000n - slip)) / 10000n;
  return { tokenIn, minQuoteAmountOut };
}

function pickCreatorAddress(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const candidates = [
    data.creatorAddress,
    data.creator_address,
    data.creator,
    data.userAddress,
    data.user_address,
    data.owner,
    data.ownerAddress,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

export async function executePumpSwapDirect(
  request: SolDirectExecutionRequest,
): Promise<SolDirectExecutionResult> {
  try {
    const amount = BigInt(request.amountAtomic);
    if (amount <= 0n) {
      return { ok: false, provider: 'pumpswap', reasonCode: 'invalid_amount', message: `invalid amount ${request.amountAtomic}` };
    }

    const creatorAddress = request.creatorAddress || null;
    if (!creatorAddress) {
      return { ok: false, provider: 'pumpswap', reasonCode: 'missing_creator', message: 'missing creatorAddress for pumpswap direct path' };
    }

    const connection = getSolanaConnection('fast', 'critical');
    const mint = new PublicKey(request.mint);
    const creator = new PublicKey(creatorAddress);
    const signingContext = await getWalletSigningContext(request.userId);
    const user = new PublicKey(signingContext.address);
    const baseProgramId = await getMintProgramId(connection, mint);
    const pool = derivePoolPda(mint);
    const poolInfo = await connection.getAccountInfo(pool, 'confirmed');
    if (!poolInfo) {
      return { ok: false, provider: 'pumpswap', reasonCode: 'pool_not_found', message: 'pumpswap pool not found' };
    }

    const userBaseAta = getAssociatedTokenAddress(mint, user, false, baseProgramId);
    const userQuoteAta = getAssociatedTokenAddress(WSOL_MINT, user, false, TOKEN_PROGRAM_ID);
    const poolBaseAta = getAssociatedTokenAddress(mint, pool, true, baseProgramId);
    const poolQuoteAta = getAssociatedTokenAddress(WSOL_MINT, pool, true, TOKEN_PROGRAM_ID);
    const protocolFeeAta = getAssociatedTokenAddress(WSOL_MINT, PROTOCOL_FEE_RECIPIENT, true, TOKEN_PROGRAM_ID);
    const creatorVaultAuthority = deriveCreatorVaultAuthority(creator);
    const creatorVaultAta = PublicKey.findProgramAddressSync(
      [creatorVaultAuthority.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), WSOL_MINT.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID,
    )[0];
    const feeConfig = deriveFeeConfig();
    const globalConfig = deriveGlobalConfig();
    const eventAuthority = deriveEventAuthority();
    const globalVolumeAccumulator = deriveGlobalVolumeAccumulator();
    const userVolumeAccumulator = deriveUserVolumeAccumulator(user);
    const poolV2 = derivePoolV2Pda(mint);

    const [baseExists, quoteExists, poolV2Exists] = await Promise.all([
      connection.getAccountInfo(userBaseAta, 'confirmed'),
      connection.getAccountInfo(userQuoteAta, 'confirmed'),
      connection.getAccountInfo(poolV2, 'confirmed'),
    ]);

    const { baseReserves, quoteReserves } = await resolveReserves(connection, poolBaseAta, poolQuoteAta);
    if (baseReserves <= 0n || quoteReserves <= 0n) {
      return { ok: false, provider: 'pumpswap', reasonCode: 'insufficient_liquidity', message: 'pumpswap reserves are empty' };
    }

    const instructions: TransactionInstruction[] = [];

    if (!quoteExists) {
      instructions.push(createAssociatedTokenAccountInstruction(user, userQuoteAta, user, WSOL_MINT, TOKEN_PROGRAM_ID));
    }
    if (!baseExists) {
      instructions.push(createAssociatedTokenAccountInstruction(user, userBaseAta, user, mint, baseProgramId));
    }

    if (request.isBuy) {
      const { tokenOut, maxQuoteAmountIn } = computeBuyAmounts(amount, baseReserves, quoteReserves, request.slippageBps);
      const wrapAmount = maxQuoteAmountIn + 500000n;
      instructions.push(
        SystemProgram.transfer({ fromPubkey: user, toPubkey: userQuoteAta, lamports: Number(wrapAmount) }),
        createSyncNativeInstruction(userQuoteAta),
      );

      const data = Buffer.concat([
        BUY_DISCRIMINATOR,
        toU64LE(tokenOut),
        toU64LE(maxQuoteAmountIn),
        Buffer.from([1]),
      ]);

      instructions.push(new TransactionInstruction({
        programId: PUMP_SWAP_PROGRAM_ID,
        keys: [
          { pubkey: pool, isSigner: false, isWritable: true },
          { pubkey: user, isSigner: true, isWritable: true },
          { pubkey: globalConfig, isSigner: false, isWritable: false },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: WSOL_MINT, isSigner: false, isWritable: false },
          { pubkey: userBaseAta, isSigner: false, isWritable: true },
          { pubkey: userQuoteAta, isSigner: false, isWritable: true },
          { pubkey: poolBaseAta, isSigner: false, isWritable: true },
          { pubkey: poolQuoteAta, isSigner: false, isWritable: true },
          { pubkey: PROTOCOL_FEE_RECIPIENT, isSigner: false, isWritable: false },
          { pubkey: protocolFeeAta, isSigner: false, isWritable: true },
          { pubkey: baseProgramId, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: eventAuthority, isSigner: false, isWritable: false },
          { pubkey: PUMP_SWAP_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: creatorVaultAta, isSigner: false, isWritable: true },
          { pubkey: creatorVaultAuthority, isSigner: false, isWritable: false },
          { pubkey: globalVolumeAccumulator, isSigner: false, isWritable: true },
          { pubkey: userVolumeAccumulator, isSigner: false, isWritable: true },
          { pubkey: feeConfig, isSigner: false, isWritable: false },
          { pubkey: FEE_PROGRAM_ID, isSigner: false, isWritable: false },
          ...(poolV2Exists ? [{ pubkey: poolV2, isSigner: false, isWritable: false }] : []),
        ],
        data,
      }));

      instructions.push(createCloseAccountInstruction(userQuoteAta, user, user));
    } else {
      const { tokenIn, minQuoteAmountOut } = computeSellAmounts(amount, baseReserves, quoteReserves, request.slippageBps);
      const data = Buffer.concat([
        SELL_DISCRIMINATOR,
        toU64LE(tokenIn),
        toU64LE(minQuoteAmountOut),
      ]);

      instructions.push(new TransactionInstruction({
        programId: PUMP_SWAP_PROGRAM_ID,
        keys: [
          { pubkey: pool, isSigner: false, isWritable: true },
          { pubkey: user, isSigner: true, isWritable: true },
          { pubkey: globalConfig, isSigner: false, isWritable: false },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: WSOL_MINT, isSigner: false, isWritable: false },
          { pubkey: userBaseAta, isSigner: false, isWritable: true },
          { pubkey: userQuoteAta, isSigner: false, isWritable: true },
          { pubkey: poolBaseAta, isSigner: false, isWritable: true },
          { pubkey: poolQuoteAta, isSigner: false, isWritable: true },
          { pubkey: PROTOCOL_FEE_RECIPIENT, isSigner: false, isWritable: false },
          { pubkey: protocolFeeAta, isSigner: false, isWritable: true },
          { pubkey: baseProgramId, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: eventAuthority, isSigner: false, isWritable: false },
          { pubkey: PUMP_SWAP_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: creatorVaultAta, isSigner: false, isWritable: true },
          { pubkey: creatorVaultAuthority, isSigner: false, isWritable: false },
          { pubkey: feeConfig, isSigner: false, isWritable: false },
          { pubkey: FEE_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: userVolumeAccumulator, isSigner: false, isWritable: true },
          ...(poolV2Exists ? [{ pubkey: poolV2, isSigner: false, isWritable: false }] : []),
        ],
        data,
      }));

      instructions.push(createCloseAccountInstruction(userQuoteAta, user, user));
    }

    const fee = getPlatformFee(request.feeContext || 'swap');
    if (request.isBuy && fee.bps > 0 && fee.solanaRecipient) {
      const feeAmount = (amount * BigInt(fee.bps)) / 10000n;
      if (feeAmount > 0n) {
        instructions.unshift(SystemProgram.transfer({
          fromPubkey: user,
          toPubkey: new PublicKey(fee.solanaRecipient),
          lamports: Number(feeAmount),
        }));
      }
    }

    const recentBlockhash = await getLatestSolanaBlockhash(connection, 'pumpswap_direct');
    const messageV0 = new TransactionMessage({
      payerKey: user,
      recentBlockhash: recentBlockhash.blockhash,
      instructions,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);
    const serializedTx = Buffer.from(transaction.serialize()).toString('base64');
    const txHash = await sendSolanaTransactionWithContext(request.userId, serializedTx, signingContext);

    logger.info(LogCode.EXE_TX_BROADCAST, '[PumpSwapDirect] Transaction sent', {
      txHash,
      mint: request.mint,
      side: request.isBuy ? 'buy' : 'sell',
    });

    return {
      ok: true,
      txHash,
      provider: 'pumpswap',
      route: 'direct',
      metadata: {
        creatorAddress,
        pool: pool.toBase58(),
        baseProgramId: baseProgramId.toBase58(),
      },
    };
  } catch (error: any) {
    return {
      ok: false,
      provider: 'pumpswap',
      reasonCode: 'build_failed',
      message: error?.message || String(error),
    };
  }
}

export function extractPumpSwapCreatorAddress(data: unknown): string | null {
  return pickCreatorAddress(data);
}

export async function getPumpSwapLiquidityUsd(mintAddress: string, creatorAddress?: string | null): Promise<number | null> {
  try {
    void creatorAddress;
    const connection = getSolanaConnection('cheap', 'normal');
    const mint = new PublicKey(mintAddress);
    const pool = derivePoolPda(mint);
    const poolInfo = await connection.getAccountInfo(pool, 'confirmed');
    if (!poolInfo) return null;
    const baseProgramId = await getMintProgramId(connection, mint);
    const poolBaseAta = getAssociatedTokenAddress(mint, pool, true, baseProgramId);
    const poolQuoteAta = getAssociatedTokenAddress(WSOL_MINT, pool, true, TOKEN_PROGRAM_ID);
    const { quoteReserves } = await resolveReserves(connection, poolBaseAta, poolQuoteAta);
    if (quoteReserves <= 0n) return null;
    const { getNativeTokenPriceUsd } = await import('../../onChainPriceService.js');
    const nativePrice = await getNativeTokenPriceUsd(900).catch(() => 0);
    if (!(nativePrice > 0)) return null;
    return (Number(quoteReserves) / 1e9) * nativePrice * 2;
  } catch {
    return null;
  }
}
