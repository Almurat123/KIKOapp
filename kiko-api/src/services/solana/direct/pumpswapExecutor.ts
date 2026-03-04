import { Connection, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
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

type PumpSwapPoolLayout = {
  creator: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseVault: PublicKey;
  quoteVault: PublicKey;
  // v2 pools do NOT store coin_creator in the pool account — coin_creator_vault_authority
  // must come from Jupiter/pAMM config; skip custom instruction for these pools.
  layoutVersion: 1 | 2;
};

// Known pAMM pool layout variants (offsets differ by token/deployment generation).
// Layout v1 (original): creator=40, baseMint=72, quoteMint=104, baseVault=168, quoteVault=200
// Layout v2 (graduated/new pAMM): baseMint=43, quoteMint=75, baseVault=139, quoteVault=171
//   NOTE: v2 coin_creator is NOT in the pool account at offset 11 (that byte range is pool metadata).
//   Using v2 creator from pool data causes ConstraintSeeds(2006) on coin_creator_vault_authority.
//   v2 pools must use Jupiter routing (which reads coin_creator from pAMM global config).
const POOL_LAYOUTS = [
  { version: 1 as const, creator: 40, baseMint: 72, quoteMint: 104, baseVault: 168, quoteVault: 200 },
  { version: 2 as const, creator: 11, baseMint: 43, quoteMint: 75, baseVault: 139, quoteVault: 171 },
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
      if (hintMint && baseMint.equals(hintMint)) {
        return { creator, baseMint, quoteMint, baseVault, quoteVault, layoutVersion: layout.version };
      }
      if (!hintMint) {
        return { creator, baseMint, quoteMint, baseVault, quoteVault, layoutVersion: layout.version };
      }
    } catch { /* try next layout */ }
  }
  // Default to v1 if no hint match found
  return {
    creator: new PublicKey(data.slice(40, 72)),
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
  // PumpSwap buy instruction: base_amount_out (tokens to receive) + max_quote_amount_in (max SOL to pay).
  // Given a fixed SOL spend (quoteInLamports), calculate expected tokenOut via constant-product AMM.
  //
  // Constant product with 0.3% protocol fee applied on the input:
  //   effectiveQuoteIn = quoteInLamports * (10000 - feeBps) / 10000
  //   tokenOut = baseReserves * effectiveQuoteIn / (quoteReserves + effectiveQuoteIn)
  //
  // maxQuoteAmountIn = quoteInLamports * (1 + slippage) — the most SOL we'll pay for tokenOut tokens.
  const feeBps = 30n;
  const effectiveQuoteIn = (quoteInLamports * (10000n - feeBps)) / 10000n;
  if (effectiveQuoteIn <= 0n) throw new Error('effective quote-in is zero after fee');

  const tokenOut = (baseReserves * effectiveQuoteIn) / (quoteReserves + effectiveQuoteIn);
  if (tokenOut <= 0n) throw new Error('calculated zero tokens out from AMM');

  const slip = BigInt(slippageBps);
  const maxQuoteAmountIn = (quoteInLamports * (10000n + slip)) / 10000n;
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
    const { pool, info: poolInfo, layout } = resolvedPool;

    // v2 pools don't embed coin_creator reliably; coin_creator_vault_authority must be
    // sourced from pAMM config, which only Jupiter knows. Skip custom instruction path.
    if (layout.layoutVersion === 2) {
      logger.info(LogCode.SYS_INFO, '[PumpSwapDirect] v2 pool detected, routing to Jupiter (coin_creator not in pool account)', {
        mint: request.mint,
        pool: pool.toBase58(),
      });
      return executePumpAmmViaJupiterDirect({ request, signingContext, connection });
    }

    const baseProgramId = await getMintProgramId(connection, layout.baseMint);

    if (!layout.baseMint.equals(mint) || !layout.quoteMint.equals(WSOL_MINT)) {
      return {
        ok: false,
        provider: 'pumpswap',
        reasonCode: 'pool_not_found',
        message: `resolved pumpswap pool does not match expected mint/WSOL pair (base=${layout.baseMint.toBase58()}, quote=${layout.quoteMint.toBase58()})`
      };
    }

    // Resolve creator: prefer caller-supplied, otherwise parse directly from pool account data.
    // PumpSwap pool layout: [0-7] discriminator, [8-39] global_config, [40-71] creator.
    // This avoids any external API call and works even for graduated pumpfun tokens.
    let creatorAddress = request.creatorAddress || null;
    if (!creatorAddress) {
      try {
        creatorAddress = layout.creator.toBase58();
        logger.info(LogCode.SYS_INFO, '[PumpSwapDirect] Resolved creator from on-chain pool data', {
          mint: request.mint,
          creatorAddress,
          pool: pool.toBase58()
        });
      } catch {
        return { ok: false, provider: 'pumpswap', reasonCode: 'missing_creator', message: 'could not parse creator from pool account data' };
      }
    }
    const creator = new PublicKey(creatorAddress);

    const userBaseAta = getAssociatedTokenAddress(layout.baseMint, user, false, baseProgramId);
    const userQuoteAta = getAssociatedTokenAddress(WSOL_MINT, user, false, TOKEN_PROGRAM_ID);
    const poolBaseAta = layout.baseVault;
    const poolQuoteAta = layout.quoteVault;
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
    const poolV2 = derivePoolV2Pda(layout.baseMint);

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
          { pubkey: layout.baseMint, isSigner: false, isWritable: false },
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
          { pubkey: layout.baseMint, isSigner: false, isWritable: false },
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
