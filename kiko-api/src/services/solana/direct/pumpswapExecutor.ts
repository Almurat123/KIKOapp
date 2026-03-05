import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { SOLANA_CONFIG, getSolanaConnection } from '../../../config/solanaConfig.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { getPlatformFee } from '../../platformFeeService.js';
import { getSolanaSigningContext, sendSolanaTransactionWithContext } from '../../privyWallet.js';
import { getLatestSolanaBlockhash } from '../blockhashProvider.js';
import { getJupiterSwapTransaction, getSolanaQuoteFromAggregator } from '../../solanaSwap.js';
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
const GET_FEES_DISCRIMINATOR = Buffer.from([124, 254, 211, 168, 174, 57, 138, 150]);
const FEE_CONFIG_MAGIC = Buffer.from([
  12, 20, 222, 252, 130, 94, 198, 118, 148, 37, 8, 24, 187, 101, 64, 101,
  244, 41, 141, 49, 86, 213, 113, 180, 212, 248, 9, 12, 24, 233, 168, 99,
]);
const PROTOCOL_FEE_RECIPIENT = new PublicKey('62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV');
const DEFAULT_PUMPSWAP_FEE_BPS = 30n;

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

type PumpSwapPoolLayout = {
  creator: PublicKey;
  coinCreator: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseVault: PublicKey;
  quoteVault: PublicKey;
  layoutVersion: 1 | 2;
};

// pAMM pool layout variants.
// v1 (legacy): creator=40, baseMint=72, quoteMint=104, baseVault=168, quoteVault=200
// v2 (current, per pump_amm IDL):
//   creator=11, baseMint=43, quoteMint=75, baseVault=139, quoteVault=171, coinCreator=211
const POOL_LAYOUTS = [
  { version: 1 as const, creator: 40, coinCreator: 40, baseMint: 72, quoteMint: 104, baseVault: 168, quoteVault: 200 },
  { version: 2 as const, creator: 11, coinCreator: 211, baseMint: 43, quoteMint: 75, baseVault: 139, quoteVault: 171 },
];

function decodePumpSwapPoolLayout(data: Buffer, hintMint?: PublicKey): PumpSwapPoolLayout {
  // Try each known layout; pick the one whose baseMint matches hintMint (or first valid decode)
  for (const layout of POOL_LAYOUTS) {
    try {
      const baseMint = new PublicKey(data.slice(layout.baseMint, layout.baseMint + 32));
      const quoteMint = new PublicKey(data.slice(layout.quoteMint, layout.quoteMint + 32));
      const baseVault = new PublicKey(data.slice(layout.baseVault, layout.baseVault + 32));
      const quoteVault = new PublicKey(data.slice(layout.quoteVault, layout.quoteVault + 32));
      const creator = new PublicKey(data.slice(layout.creator, layout.creator + 32));
      const coinCreator = new PublicKey(data.slice(layout.coinCreator, layout.coinCreator + 32));
      if (hintMint && baseMint.equals(hintMint)) {
        return { creator, coinCreator, baseMint, quoteMint, baseVault, quoteVault, layoutVersion: layout.version };
      }
      if (!hintMint) {
        return { creator, coinCreator, baseMint, quoteMint, baseVault, quoteVault, layoutVersion: layout.version };
      }
    } catch { /* try next layout */ }
  }
  // Default to v1 if no hint match found
  return {
    creator: new PublicKey(data.slice(40, 72)),
    coinCreator: new PublicKey(data.slice(40, 72)),
    baseMint: new PublicKey(data.slice(72, 104)),
    quoteMint: new PublicKey(data.slice(104, 136)),
    baseVault: new PublicKey(data.slice(168, 200)),
    quoteVault: new PublicKey(data.slice(200, 232)),
    layoutVersion: 1,
  };
}

async function resolvePumpSwapPoolForMint(
  connection: Connection,
  mint: PublicKey,
  hintedPoolId?: string | null
): Promise<{ pool: PublicKey; info: NonNullable<Awaited<ReturnType<Connection['getAccountInfo']>>>; layout: PumpSwapPoolLayout } | null> {
  if (hintedPoolId) {
    try {
      const hintedPool = new PublicKey(hintedPoolId);
      const hintedInfo = await connection.getAccountInfo(hintedPool, 'confirmed');
      if (hintedInfo) {
        const layout = decodePumpSwapPoolLayout(hintedInfo.data, mint);
        if (layout.baseMint.equals(mint) && layout.quoteMint.equals(WSOL_MINT)) {
          return { pool: hintedPool, info: hintedInfo, layout };
        }
      }
    } catch {
      // ignore invalid hinted pool id
    }
  }

  // Try deterministic PDA path first (fast path)
  const derived = derivePoolPda(mint);
  const derivedInfo = await connection.getAccountInfo(derived, 'confirmed');
  if (derivedInfo) {
    const layout = decodePumpSwapPoolLayout(derivedInfo.data, mint);
    if (layout.baseMint.equals(mint) && layout.quoteMint.equals(WSOL_MINT)) {
      return { pool: derived, info: derivedInfo, layout };
    }
  }

  // Scan using both known pool layout offsets (v1: 72/104, v2: 43/75)
  const scanLayouts = [
    { baseMintOffset: 72, quoteMintOffset: 104 }, // v1
    { baseMintOffset: 43, quoteMintOffset: 75 },  // v2 (graduated tokens)
  ];

  for (const scanLayout of scanLayouts) {
    let candidates: Awaited<ReturnType<Connection['getProgramAccounts']>> = [];
    try {
      candidates = await connection.getProgramAccounts(PUMP_SWAP_PROGRAM_ID, {
        commitment: 'confirmed',
        filters: [
          { dataSize: 301 },
          { memcmp: { offset: scanLayout.baseMintOffset, bytes: mint.toBase58() } },
          { memcmp: { offset: scanLayout.quoteMintOffset, bytes: WSOL_MINT.toBase58() } },
        ],
      });
    } catch (scanErr: any) {
      logger.warn(LogCode.API_FETCH_FAILED, '[PumpSwapDirect] pool scan failed for layout', {
        mint: mint.toBase58(),
        baseMintOffset: scanLayout.baseMintOffset,
        error: scanErr?.message || String(scanErr),
      });
      continue;
    }
    if (candidates.length > 0) {
      const picked = candidates[0];
      const layout = decodePumpSwapPoolLayout(picked.account.data, mint);
      if (layout.baseMint.equals(mint) && layout.quoteMint.equals(WSOL_MINT)) {
        return { pool: picked.pubkey, info: picked.account, layout };
      }
    }
  }

  return null;
}

function derivePoolV2Pda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('pool-v2'), mint.toBuffer()], PUMP_SWAP_PROGRAM_ID)[0];
}

function deriveCreatorVaultAuthority(creator: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('creator_vault'), creator.toBuffer()], PUMP_SWAP_PROGRAM_ID)[0];
}

function isZeroLikePubkey(pubkey: PublicKey): boolean {
  return pubkey.equals(SystemProgram.programId);
}

function readPubkey(data: Buffer, offset: number): PublicKey | null {
  if (offset < 0 || offset + 32 > data.length) return null;
  try {
    return new PublicKey(data.slice(offset, offset + 32));
  } catch {
    return null;
  }
}

function resolveProtocolFeeRecipientFromGlobalConfigData(data: Buffer): PublicKey | null {
  // GlobalConfig layout from pump_amm IDL:
  // discriminator(8) + admin(32) + lpFeeBps(8) + protocolFeeBps(8) + disableFlags(1)
  // + protocol_fee_recipients[8](32*8) + ... + reserved_fee_recipient(32)
  const protocolRecipientsOffset = 57;
  for (let i = 0; i < 8; i++) {
    const candidate = readPubkey(data, protocolRecipientsOffset + (i * 32));
    if (candidate && !isZeroLikePubkey(candidate)) return candidate;
  }
  const reservedFeeRecipientOffset = 385;
  const reserved = readPubkey(data, reservedFeeRecipientOffset);
  if (reserved && !isZeroLikePubkey(reserved)) return reserved;
  return null;
}

async function resolveProtocolFeeRecipient(connection: Connection, globalConfig: PublicKey): Promise<PublicKey> {
  try {
    const account = await connection.getAccountInfo(globalConfig, 'confirmed');
    if (account?.data?.length) {
      const resolved = resolveProtocolFeeRecipientFromGlobalConfigData(account.data);
      if (resolved) return resolved;
    }
  } catch {
    // ignore and use default
  }
  return PROTOCOL_FEE_RECIPIENT;
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

async function executePumpAmmViaJupiterDirect(params: {
  request: SolDirectExecutionRequest;
  signingContext: ResolvedSolanaSigningContext;
  connection: Connection;
}): Promise<SolDirectExecutionResult> {
  const { request, signingContext, connection } = params;
  const inputMint = request.isBuy ? WSOL_MINT.toBase58() : request.mint;
  const outputMint = request.isBuy ? request.mint : WSOL_MINT.toBase58();

  // First attempt: Pump.fun AMM filtered quote (single-hop, deterministic)
  let quote = await getSolanaQuoteFromAggregator(
    'jupiter',
    inputMint,
    outputMint,
    request.amountAtomic,
    request.slippageBps,
    signingContext.address,
    undefined,
    request.feeContext,
    {
      forcePublicApi: true,
      dexes: ['Pump.fun Amm', 'Pump.fun AMM', 'Pump.fun'],
    }
  );

  // Second attempt: unfiltered Jupiter (token may not be on Pump.fun AMM)
  if (!quote) {
    logger.warn(LogCode.API_FETCH_FAILED, '[PumpSwapDirect] Pump.fun AMM filtered quote unavailable, retrying with unfiltered Jupiter', {
      mint: request.mint,
      side: request.isBuy ? 'buy' : 'sell',
    });
    quote = await getSolanaQuoteFromAggregator(
      'jupiter',
      inputMint,
      outputMint,
      request.amountAtomic,
      request.slippageBps,
      signingContext.address,
      undefined,
      request.feeContext,
      { forcePublicApi: true }
    );
  }

  if (!quote) {
    return {
      ok: false,
      provider: 'pumpswap',
      reasonCode: 'pool_not_found',
      message: `pumpswap direct fallback: no Jupiter quote available for mint=${request.mint}`,
    };
  }

  let swapTransaction = quote.swapTransaction;
  if (!swapTransaction) {
    const builtSwapTx = await getJupiterSwapTransaction(quote, signingContext.address, true, request.feeContext);
    if (builtSwapTx) {
      swapTransaction = builtSwapTx;
    }
  }
  if (!swapTransaction) {
    return {
      ok: false,
      provider: 'pumpswap',
      reasonCode: 'build_failed',
      message: `pumpswap direct fallback failed to build Jupiter swap tx for mint=${request.mint}`,
    };
  }

  const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'));
  const recentBlockhash = await getLatestSolanaBlockhash(connection, 'pumpswap_direct_jupiter_fallback');
  tx.message.recentBlockhash = recentBlockhash.blockhash;
  const refreshedTxBase64 = Buffer.from(tx.serialize()).toString('base64');
  const txHash = await sendSolanaTransactionWithContext(request.userId, refreshedTxBase64, signingContext);

  logger.info(LogCode.EXE_TX_BROADCAST, '[PumpSwapDirect] Executed via Jupiter Pump.fun AMM direct fallback', {
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
      mode: 'pumpswap_direct_jupiter_filtered',
    },
  };
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

function clampBps(value: number): bigint {
  const safe = Number.isFinite(value) ? Math.floor(value) : 0;
  if (safe <= 0) return 0n;
  if (safe >= 9999) return 9999n;
  return BigInt(safe);
}

async function resolvePumpSwapFeeBps(
  connection: Connection,
  globalConfig: PublicKey,
  feeConfig: PublicKey
): Promise<{ totalFeeBps: bigint; source: 'fee_program' | 'global_config' | 'fallback' }> {
  try {
    const ix = new TransactionInstruction({
      programId: FEE_PROGRAM_ID,
      keys: [{ pubkey: feeConfig, isSigner: false, isWritable: false }],
      data: GET_FEES_DISCRIMINATOR,
    });
    const simulation = await connection.simulateTransaction(
      new Transaction().add(ix),
      undefined,
      false
    );
    const rawBase64 = simulation?.value?.returnData?.data?.[0];
    if (rawBase64) {
      const raw = Buffer.from(rawBase64, 'base64');
      if (raw.length >= 24) {
        const protocolBps = raw.readBigUInt64LE(8);
        const creatorBps = raw.readBigUInt64LE(16);
        const total = protocolBps + creatorBps;
        if (total > 0n && total < 10000n) {
          return { totalFeeBps: total, source: 'fee_program' };
        }
      }
    }
  } catch {
    // fallback below
  }

  try {
    const globalInfo = await connection.getAccountInfo(globalConfig, 'confirmed');
    if (globalInfo?.data?.length && globalInfo.data.length >= 56) {
      const lpFeeBps = globalInfo.data.readBigUInt64LE(40);
      const protocolFeeBps = globalInfo.data.readBigUInt64LE(48);
      const total = lpFeeBps + protocolFeeBps;
      if (total > 0n && total < 10000n) {
        return { totalFeeBps: total, source: 'global_config' };
      }
    }
  } catch {
    // fallback below
  }

  return { totalFeeBps: DEFAULT_PUMPSWAP_FEE_BPS, source: 'fallback' };
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

function quoteNetQuoteInForTokenOut(tokenOut: bigint, baseReserves: bigint, quoteReserves: bigint): bigint | null {
  if (tokenOut <= 0n || tokenOut >= baseReserves) return null;
  const denominator = baseReserves - tokenOut;
  if (denominator <= 0n) return null;
  return ceilDiv(quoteReserves * tokenOut, denominator);
}

function quoteGrossQuoteInForTokenOut(
  tokenOut: bigint,
  baseReserves: bigint,
  quoteReserves: bigint,
  totalFeeBps: bigint
): bigint | null {
  const net = quoteNetQuoteInForTokenOut(tokenOut, baseReserves, quoteReserves);
  if (net === null) return null;
  if (totalFeeBps < 0n || totalFeeBps >= 10000n) return null;
  const feeDen = 10000n - totalFeeBps;
  if (feeDen <= 0n) return null;
  return ceilDiv(net * 10000n, feeDen);
}

function findMaxTokensOutForGrossBudget(
  grossBudget: bigint,
  baseReserves: bigint,
  quoteReserves: bigint,
  totalFeeBps: bigint
): bigint {
  if (grossBudget <= 0n || baseReserves <= 1n || quoteReserves <= 0n) return 0n;
  if (totalFeeBps < 0n || totalFeeBps >= 10000n) return 0n;
  let low = 0n;
  let high = baseReserves - 1n;
  while (low < high) {
    const mid = (low + high + 1n) / 2n;
    const needed = quoteGrossQuoteInForTokenOut(mid, baseReserves, quoteReserves, totalFeeBps);
    if (needed !== null && needed <= grossBudget) {
      low = mid;
    } else {
      high = mid - 1n;
    }
  }
  return low;
}

function computeBuyAmounts(
  quoteInLamports: bigint,
  baseReserves: bigint,
  quoteReserves: bigint,
  slippageBps: number,
  totalFeeBps: bigint,
  extraTokenOutHaircutBps = 0
) {
  // Build PumpSwap buy in a fixed-input style:
  // - max_quote_amount_in stays at the user's budget.
  // - base_amount_out is conservative (slippage + optional retry haircut).
  const tokenOutExpected = findMaxTokensOutForGrossBudget(quoteInLamports, baseReserves, quoteReserves, totalFeeBps);
  if (tokenOutExpected <= 0n) throw new Error('calculated zero tokens out from AMM');
  const slip = clampBps(slippageBps);
  const retryHaircut = clampBps(extraTokenOutHaircutBps);
  let tokenOut = (tokenOutExpected * (10000n - slip)) / 10000n;
  tokenOut = (tokenOut * (10000n - retryHaircut)) / 10000n;
  if (tokenOut <= 0n) tokenOut = 1n;
  if (tokenOut >= baseReserves) tokenOut = baseReserves - 1n;
  const maxQuoteAmountIn = quoteInLamports;
  return { tokenOutExpected, tokenOut, maxQuoteAmountIn };
}

function extractErrorText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function isPumpOverflowErrorMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('error code: overflow')
    || m.includes('custom program error: 0x1788')
    || m.includes('custom error: 6023')
    || m.includes('anchorerror occurred. error code: overflow')
  );
}

async function simulateDirectTransaction(connection: Connection, tx: VersionedTransaction): Promise<{ ok: boolean; errorText: string; overflow: boolean }> {
  try {
    const simulation = await connection.simulateTransaction(
      tx,
      { sigVerify: false, replaceRecentBlockhash: true, commitment: 'processed' }
    );
    const errorText = [
      extractErrorText(simulation?.value?.err),
      ...(simulation?.value?.logs || []),
    ].filter(Boolean).join('\n');
    if (!simulation?.value?.err) {
      return { ok: true, errorText, overflow: false };
    }
    return { ok: false, errorText, overflow: isPumpOverflowErrorMessage(errorText) };
  } catch (error: any) {
    const errorText = extractErrorText(error?.message || error);
    return { ok: false, errorText, overflow: isPumpOverflowErrorMessage(errorText) };
  }
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

    const connection = getSolanaConnection('fast', 'critical');
    const mint = new PublicKey(request.mint);
    const signingContext = await getWalletSigningContext(request.userId);
    const user = new PublicKey(signingContext.address);
    const resolvedPool = await resolvePumpSwapPoolForMint(connection, mint, request.poolId || null);
    if (!resolvedPool) {
      logger.warn(LogCode.API_FETCH_FAILED, '[PumpSwapDirect] no validated mint/WSOL pool resolved, trying Jupiter Pump.fun AMM direct fallback', {
        mint: request.mint,
        side: request.isBuy ? 'buy' : 'sell',
      });
      return executePumpAmmViaJupiterDirect({ request, signingContext, connection });
    }
    const { pool, layout } = resolvedPool;

    const baseProgramId = await getMintProgramId(connection, layout.baseMint);
    if (!layout.baseMint.equals(mint) || !layout.quoteMint.equals(WSOL_MINT)) {
      return {
        ok: false,
        provider: 'pumpswap',
        reasonCode: 'pool_not_found',
        message: `resolved pumpswap pool does not match expected mint/WSOL pair (base=${layout.baseMint.toBase58()}, quote=${layout.quoteMint.toBase58()})`
      };
    }

    let effectiveCoinCreator = !isZeroLikePubkey(layout.coinCreator) ? layout.coinCreator : layout.creator;
    if (request.creatorAddress) {
      try {
        const hinted = new PublicKey(request.creatorAddress);
        if (!hinted.equals(effectiveCoinCreator)) {
          logger.warn(LogCode.SYS_INFO, '[PumpSwapDirect] creator hint mismatch; using on-chain coin_creator', {
            mint: request.mint,
            pool: pool.toBase58(),
            hintedCreator: hinted.toBase58(),
            onchainCoinCreator: effectiveCoinCreator.toBase58(),
            layoutVersion: layout.layoutVersion,
          });
        }
      } catch {
        // ignore malformed hint and keep on-chain value
      }
    }

    const userBaseAta = getAssociatedTokenAddress(layout.baseMint, user, false, baseProgramId);
    const userQuoteAta = getAssociatedTokenAddress(WSOL_MINT, user, false, TOKEN_PROGRAM_ID);
    const poolBaseAta = layout.baseVault;
    const poolQuoteAta = layout.quoteVault;
    const globalConfig = deriveGlobalConfig();
    const feeConfig = deriveFeeConfig();
    const feeSnapshot = await resolvePumpSwapFeeBps(connection, globalConfig, feeConfig);
    const protocolFeeRecipient = await resolveProtocolFeeRecipient(connection, globalConfig);
    const protocolFeeAta = getAssociatedTokenAddress(WSOL_MINT, protocolFeeRecipient, true, TOKEN_PROGRAM_ID);
    const creatorVaultAuthority = deriveCreatorVaultAuthority(effectiveCoinCreator);
    const creatorVaultAta = PublicKey.findProgramAddressSync(
      [creatorVaultAuthority.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), WSOL_MINT.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID,
    )[0];
    const eventAuthority = deriveEventAuthority();
    const globalVolumeAccumulator = deriveGlobalVolumeAccumulator();
    const userVolumeAccumulator = deriveUserVolumeAccumulator(user);
    const [baseExists, quoteExists] = await Promise.all([
      connection.getAccountInfo(userBaseAta, 'confirmed'),
      connection.getAccountInfo(userQuoteAta, 'confirmed'),
    ]);

    const { baseReserves, quoteReserves } = await resolveReserves(connection, poolBaseAta, poolQuoteAta);
    if (baseReserves <= 0n || quoteReserves <= 0n) {
      return { ok: false, provider: 'pumpswap', reasonCode: 'insufficient_liquidity', message: 'pumpswap reserves are empty' };
    }

    const baseInstructions: TransactionInstruction[] = [];
    if (!quoteExists) {
      baseInstructions.push(createAssociatedTokenAccountInstruction(user, userQuoteAta, user, WSOL_MINT, TOKEN_PROGRAM_ID));
    }
    if (!baseExists) {
      baseInstructions.push(createAssociatedTokenAccountInstruction(user, userBaseAta, user, mint, baseProgramId));
    }

    const buildPumpSwapIx = (data: Buffer, includeVolumeAccounts: boolean) => new TransactionInstruction({
      programId: PUMP_SWAP_PROGRAM_ID,
      keys: [
        { pubkey: pool, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: globalConfig, isSigner: false, isWritable: false },
        { pubkey: layout.baseMint, isSigner: false, isWritable: false },
        { pubkey: WSOL_MINT, isSigner: false, isWritable: false },
        { pubkey: userBaseAta, isSigner: false, isWritable: true },
        { pubkey: userQuoteAta, isSigner: false, isWritable: true },
        { pubkey: poolBaseAta, isSigner: false, isWritable: true },
        { pubkey: poolQuoteAta, isSigner: false, isWritable: true },
        { pubkey: protocolFeeRecipient, isSigner: false, isWritable: false },
        { pubkey: protocolFeeAta, isSigner: false, isWritable: true },
        { pubkey: baseProgramId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: eventAuthority, isSigner: false, isWritable: false },
        { pubkey: PUMP_SWAP_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: creatorVaultAta, isSigner: false, isWritable: true },
        { pubkey: creatorVaultAuthority, isSigner: false, isWritable: false },
        ...(includeVolumeAccounts
          ? [
              { pubkey: globalVolumeAccumulator, isSigner: false, isWritable: true },
              { pubkey: userVolumeAccumulator, isSigner: false, isWritable: true },
            ]
          : []),
        { pubkey: feeConfig, isSigner: false, isWritable: false },
        { pubkey: FEE_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });

    const platformFeeInstructions: TransactionInstruction[] = [];
    const platformFee = getPlatformFee(request.feeContext || 'swap');
    if (request.isBuy && platformFee.bps > 0 && platformFee.solanaRecipient) {
      const feeAmount = (amount * BigInt(platformFee.bps)) / 10000n;
      if (feeAmount > 0n) {
        platformFeeInstructions.push(SystemProgram.transfer({
          fromPubkey: user,
          toPubkey: new PublicKey(platformFee.solanaRecipient),
          lamports: Number(feeAmount),
        }));
      }
    }

    const buildTx = async (instructions: TransactionInstruction[], blockhashTag: string): Promise<VersionedTransaction> => {
      const recentBlockhash = await getLatestSolanaBlockhash(connection, blockhashTag);
      const messageV0 = new TransactionMessage({
        payerKey: user,
        recentBlockhash: recentBlockhash.blockhash,
        instructions,
      }).compileToV0Message();
      return new VersionedTransaction(messageV0);
    };

    if (request.isBuy) {
      const retryHaircutsBps = [0, 500, 1000, 2000];
      let lastBuyError = '';
      for (const retryHaircutBps of retryHaircutsBps) {
        const { tokenOutExpected, tokenOut, maxQuoteAmountIn } = computeBuyAmounts(
          amount,
          baseReserves,
          quoteReserves,
          request.slippageBps,
          feeSnapshot.totalFeeBps,
          retryHaircutBps
        );
        const data = Buffer.concat([
          BUY_DISCRIMINATOR,
          toU64LE(tokenOut),
          toU64LE(maxQuoteAmountIn),
          Buffer.from([0]),
        ]);
        const instructions = [
          ...platformFeeInstructions,
          ...baseInstructions,
          SystemProgram.transfer({ fromPubkey: user, toPubkey: userQuoteAta, lamports: Number(maxQuoteAmountIn + 500000n) }),
          createSyncNativeInstruction(userQuoteAta),
          buildPumpSwapIx(data, true),
          createCloseAccountInstruction(userQuoteAta, user, user),
        ];
        const tx = await buildTx(instructions, 'pumpswap_direct_buy');
        const simulation = await simulateDirectTransaction(connection, tx);
        if (!simulation.ok) {
          lastBuyError = simulation.errorText;
          if (simulation.overflow && retryHaircutBps < retryHaircutsBps[retryHaircutsBps.length - 1]) {
            logger.warn(LogCode.EXE_TX_REVERTED, '[PumpSwapDirect] buy simulation overflow, retrying with tighter tokenOut', {
              mint: request.mint,
              retryHaircutBps,
              tokenOutExpected: tokenOutExpected.toString(),
              tokenOutAttempt: tokenOut.toString(),
              feeBps: feeSnapshot.totalFeeBps.toString(),
              feeSource: feeSnapshot.source,
            });
            continue;
          }
          if (simulation.overflow) break;
          return {
            ok: false,
            provider: 'pumpswap',
            reasonCode: 'build_failed',
            message: simulation.errorText || 'pumpswap direct simulation failed',
          };
        }

        try {
          const txHash = await sendSolanaTransactionWithContext(
            request.userId,
            Buffer.from(tx.serialize()).toString('base64'),
            signingContext
          );
          logger.info(LogCode.EXE_TX_BROADCAST, '[PumpSwapDirect] Transaction sent', {
            txHash,
            mint: request.mint,
            side: 'buy',
            retryHaircutBps,
            tokenOutExpected: tokenOutExpected.toString(),
            tokenOutSent: tokenOut.toString(),
            feeBps: feeSnapshot.totalFeeBps.toString(),
            feeSource: feeSnapshot.source,
          });
          return {
            ok: true,
            txHash,
            provider: 'pumpswap',
            route: 'direct',
            metadata: {
              creatorAddress: effectiveCoinCreator.toBase58(),
              pool: pool.toBase58(),
              baseProgramId: baseProgramId.toBase58(),
              protocolFeeRecipient: protocolFeeRecipient.toBase58(),
              layoutVersion: layout.layoutVersion,
              buyTokenOutExpected: tokenOutExpected.toString(),
              buyTokenOutSent: tokenOut.toString(),
              maxQuoteAmountIn: maxQuoteAmountIn.toString(),
              feeBps: feeSnapshot.totalFeeBps.toString(),
              feeSource: feeSnapshot.source,
            },
          };
        } catch (sendError: any) {
          const sendText = extractErrorText(sendError?.message || sendError);
          lastBuyError = sendText;
          if (isPumpOverflowErrorMessage(sendText) && retryHaircutBps < retryHaircutsBps[retryHaircutsBps.length - 1]) {
            logger.warn(LogCode.EXE_TX_REVERTED, '[PumpSwapDirect] buy send overflow, retrying with tighter tokenOut', {
              mint: request.mint,
              retryHaircutBps,
              error: sendText.slice(0, 220),
            });
            continue;
          }
          throw sendError;
        }
      }

      logger.warn(LogCode.EXE_TX_REVERTED, '[PumpSwapDirect] buy path exhausted direct retries, falling back to Jupiter', {
        mint: request.mint,
        error: lastBuyError.slice(0, 220),
      });
      return executePumpAmmViaJupiterDirect({ request, signingContext, connection });
    }

    const { tokenIn, minQuoteAmountOut } = computeSellAmounts(amount, baseReserves, quoteReserves, request.slippageBps);
    const sellData = Buffer.concat([SELL_DISCRIMINATOR, toU64LE(tokenIn), toU64LE(minQuoteAmountOut)]);
    const sellInstructions = [
      ...baseInstructions,
      buildPumpSwapIx(sellData, false),
      createCloseAccountInstruction(userQuoteAta, user, user),
    ];
    const sellTx = await buildTx(sellInstructions, 'pumpswap_direct_sell');
    const txHash = await sendSolanaTransactionWithContext(
      request.userId,
      Buffer.from(sellTx.serialize()).toString('base64'),
      signingContext
    );

    logger.info(LogCode.EXE_TX_BROADCAST, '[PumpSwapDirect] Transaction sent', {
      txHash,
      mint: request.mint,
      side: 'sell',
      minQuoteAmountOut: minQuoteAmountOut.toString(),
    });
    return {
      ok: true,
      txHash,
      provider: 'pumpswap',
      route: 'direct',
      metadata: {
        creatorAddress: effectiveCoinCreator.toBase58(),
        pool: pool.toBase58(),
        baseProgramId: baseProgramId.toBase58(),
        protocolFeeRecipient: protocolFeeRecipient.toBase58(),
        layoutVersion: layout.layoutVersion,
        minQuoteAmountOut: minQuoteAmountOut.toString(),
      },
    };
  } catch (error: any) {
    const msg = String(error?.message || error || '');
    const retryableSeedMismatch =
      msg.includes('ConstraintSeeds')
      || msg.includes('custom program error: 0x7d6')
      || msg.includes('0x7d6');
    const retryableOverflow = isPumpOverflowErrorMessage(msg);
    if (retryableSeedMismatch || retryableOverflow) {
      logger.warn(LogCode.EXE_TX_REVERTED, '[PumpSwapDirect] direct path failed, falling back to Jupiter Pump.fun AMM route', {
        mint: request.mint,
        side: request.isBuy ? 'buy' : 'sell',
        retryableSeedMismatch,
        retryableOverflow,
        error: msg.slice(0, 220),
      });
      try {
        const connection = getSolanaConnection('fast', 'critical');
        const signingContext = await getWalletSigningContext(request.userId);
        return await executePumpAmmViaJupiterDirect({ request, signingContext, connection });
      } catch (fallbackErr: any) {
        return {
          ok: false,
          provider: 'pumpswap',
          reasonCode: 'build_failed',
          message: fallbackErr?.message || String(fallbackErr),
        };
      }
    }
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

export const __pumpSwapExecutorTest = {
  decodePumpSwapPoolLayout,
  resolveProtocolFeeRecipientFromGlobalConfigData,
  resolvePumpSwapPoolForMint,
  resolvePumpSwapFeeBps,
  resolveReserves,
  deriveGlobalConfig,
  deriveFeeConfig,
  WSOL_MINT,
  findMaxTokensOutForGrossBudget,
  quoteGrossQuoteInForTokenOut,
  computeBuyAmounts,
  isPumpOverflowErrorMessage,
};

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
