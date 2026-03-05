import assert from 'node:assert/strict';
import { PublicKey } from '@solana/web3.js';
import { getSolanaConnection } from '../config/solanaConfig.js';
import { __pumpSwapExecutorTest } from '../services/solana/direct/pumpswapExecutor.js';

const PUMP_SWAP_PROGRAM_ID = new PublicKey('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA');
const BUY_DISCRIMINATOR = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);

function parsePositiveIntEnv(name: string, fallback: number): number {
  const value = Number(process.env[name] || '');
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function parsePositiveBigIntEnv(name: string, fallback: bigint): bigint {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  try {
    const parsed = BigInt(raw);
    return parsed > 0n ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseMintEnvList(): string[] {
  const raw = (process.env.PUMP_REPLAY_MINTS || '').trim();
  if (!raw) return [];
  return raw.split(',').map((v) => v.trim()).filter(Boolean);
}

function isPumpMint(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value) && value.endsWith('pump');
}

async function discoverRecentPumpMints(maxTx: number): Promise<string[]> {
  const connection = getSolanaConnection('cheap', 'normal');
  const signatures = await connection.getSignaturesForAddress(PUMP_SWAP_PROGRAM_ID, { limit: Math.max(5, Math.min(maxTx, 80)) });
  const mints = new Set<string>();
  for (const item of signatures) {
    try {
      const tx = await connection.getTransaction(item.signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      const keys = tx?.transaction?.message?.getAccountKeys()?.staticAccountKeys || [];
      for (const key of keys) {
        const asBase58 = key.toBase58();
        if (isPumpMint(asBase58)) mints.add(asBase58);
      }
    } catch {
      // ignore one-off tx fetch failures
    }
    if (mints.size >= 20) break;
  }
  return [...mints];
}

function encodeBuyData(tokenOut: bigint, maxQuoteAmountIn: bigint): Buffer {
  const data = Buffer.alloc(25);
  BUY_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(tokenOut, 8);
  data.writeBigUInt64LE(maxQuoteAmountIn, 16);
  data.writeUInt8(0, 24);
  return data;
}

async function main() {
  const maxTests = parsePositiveIntEnv('PUMP_REPLAY_MAX_MINTS', 5);
  const minSuccess = parsePositiveIntEnv('PUMP_REPLAY_MIN_SUCCESS', 3);
  const maxScanTx = parsePositiveIntEnv('PUMP_REPLAY_SCAN_TX', 0);
  const amountLamports = parsePositiveBigIntEnv('PUMP_REPLAY_BUY_LAMPORTS', 1_000_000n);
  const slippageBps = parsePositiveIntEnv('PUMP_REPLAY_SLIPPAGE_BPS', 300);

  const discovered = maxScanTx > 0 ? await discoverRecentPumpMints(maxScanTx) : [];
  const configured = parseMintEnvList();
  const seedMints = [
    'EvNVARJUBMn7cUN34pN2LEuxQxX12wzD88jetDVYpump',
    'AiY9tSkqAb8gM1JWC9tzXNsykdvSqS64yF3MNMTxpump',
    '3WaDEAD8oFehQUHLiap7R6WSgoMguoyKA3evtUgcpump',
  ];
  const mintCandidates = [...new Set([...configured, ...discovered, ...seedMints].filter(isPumpMint))];

  const connection = getSolanaConnection('cheap', 'normal');
  const globalConfig = __pumpSwapExecutorTest.deriveGlobalConfig();
  const feeConfig = __pumpSwapExecutorTest.deriveFeeConfig();
  const feeSnapshot = await __pumpSwapExecutorTest.resolvePumpSwapFeeBps(connection, globalConfig, feeConfig);

  const results: Array<Record<string, unknown>> = [];
  let successCount = 0;
  for (const mint of mintCandidates) {
    if (results.length >= maxTests) break;
    try {
      const mintPk = new PublicKey(mint);
      const resolved = await __pumpSwapExecutorTest.resolvePumpSwapPoolForMint(connection, mintPk, null);
      if (!resolved) {
        results.push({ mint, status: 'skipped_no_pool' });
        continue;
      }
      const reserves = await __pumpSwapExecutorTest.resolveReserves(connection, resolved.layout.baseVault, resolved.layout.quoteVault);
      if (!(reserves.baseReserves > 0n) || !(reserves.quoteReserves > 0n)) {
        results.push({ mint, status: 'skipped_empty_reserves' });
        continue;
      }
      const buy = __pumpSwapExecutorTest.computeBuyAmounts(
        amountLamports,
        reserves.baseReserves,
        reserves.quoteReserves,
        slippageBps,
        feeSnapshot.totalFeeBps,
        0
      );
      const requiredGross = __pumpSwapExecutorTest.quoteGrossQuoteInForTokenOut(
        buy.tokenOut,
        reserves.baseReserves,
        reserves.quoteReserves,
        feeSnapshot.totalFeeBps
      );

      const buyData = encodeBuyData(buy.tokenOut, buy.maxQuoteAmountIn);
      const dataLooksValid = buyData.length === 25
        && buyData.subarray(0, 8).equals(BUY_DISCRIMINATOR)
        && buyData.readBigUInt64LE(8) === buy.tokenOut
        && buyData.readBigUInt64LE(16) === buy.maxQuoteAmountIn;

      const passed = dataLooksValid
        && buy.tokenOut > 0n
        && buy.tokenOut <= buy.tokenOutExpected
        && requiredGross !== null
        && requiredGross <= amountLamports;

      results.push({
        mint,
        pool: resolved.pool.toBase58(),
        layoutVersion: resolved.layout.layoutVersion,
        baseReserves: reserves.baseReserves.toString(),
        quoteReserves: reserves.quoteReserves.toString(),
        feeBps: feeSnapshot.totalFeeBps.toString(),
        feeSource: feeSnapshot.source,
        amountLamports: amountLamports.toString(),
        tokenOutExpected: buy.tokenOutExpected.toString(),
        tokenOutSent: buy.tokenOut.toString(),
        maxQuoteAmountIn: buy.maxQuoteAmountIn.toString(),
        requiredGrossForTokenOut: requiredGross?.toString() || null,
        buyInstructionDataLen: buyData.length,
        status: passed ? 'ok' : 'failed_invariant',
      });
      if (passed) successCount += 1;
    } catch (error: any) {
      results.push({
        mint,
        status: 'error',
        error: error?.message || String(error),
      });
    }
  }

  const summary = {
    timestamp: new Date().toISOString(),
    tested: results.length,
    successCount,
    minSuccess,
    amountLamports: amountLamports.toString(),
    slippageBps,
    feeBps: feeSnapshot.totalFeeBps.toString(),
    feeSource: feeSnapshot.source,
    results,
  };

  console.log(JSON.stringify(summary, null, 2));
  assert.ok(successCount >= minSuccess, `pump_direct_replay_insufficient_success_${successCount}_lt_${minSuccess}`);
}

main().catch((error) => {
  console.error('[PumpDirectReplay] fatal', error?.message || error);
  process.exitCode = 1;
});
