import { fetchTransaction, fetchTransactionReceipt } from '../services/watcherService.js';
import { parseSwapTransaction } from '../services/txDecoder.js';
import { getChainConfig } from '../config/chainConfig.js';
import { normalizeAddress } from '../utils/address.js';
import { isDirectSwapSupported } from '../services/dex/directSwapService.js';
import { isNativeToken } from '../config/tokenRegistry.js';

const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Usage: tsx tmpReplayCopytrade.ts <chainId> <targetWallet> <txHash1> [txHash2 ...]');
  process.exit(1);
}

const chainId = Number(args[0]);
const targetWallet = args[1];
const txHashes = args.slice(2);

const NATIVE_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

function classifySwap(chainId: number, tokenIn: string, tokenOut: string) {
  const chainConfig = getChainConfig(chainId);
  const cashTokens = [
    NATIVE_ADDRESS,
    chainConfig.wrappedNativeAddress,
    ...(chainConfig.stablecoins || [])
  ].filter(Boolean).map((t) => normalizeAddress(t));

  const tokenInCash = cashTokens.includes(normalizeAddress(tokenIn));
  const tokenOutCash = cashTokens.includes(normalizeAddress(tokenOut));

  const isBuy = tokenInCash && !tokenOutCash;
  const isSell = !tokenInCash && tokenOutCash;
  const isTokenToToken = !tokenInCash && !tokenOutCash;

  return { isBuy, isSell, isTokenToToken, tokenInCash, tokenOutCash, cashTokens };
}

async function runOne(txHash: string) {
  const t0 = Date.now();
  const [tx, receipt] = await Promise.all([
    fetchTransaction(txHash, chainId),
    fetchTransactionReceipt(txHash, chainId)
  ]);
  const tFetch = Date.now();

  if (!tx || !receipt) {
    console.log(`${txHash} status=missing_tx_or_receipt fetch_ms=${tFetch - t0}`);
    return;
  }

  const swap = await parseSwapTransaction(
    {
      hash: txHash,
      from: tx.from,
      to: tx.to,
      input: tx.input,
      value: tx.value
    },
    {
      logs: receipt.logs,
      status: parseInt(receipt.status, 16)
    },
    chainId,
    targetWallet
  );
  const tParse = Date.now();

  if (!swap) {
    console.log(`${txHash} status=not_swap fetch_ms=${tFetch - t0} parse_ms=${tParse - tFetch}`);
    return;
  }

  const classification = classifySwap(chainId, swap.tokenIn, swap.tokenOut);
  const isBuyWithNative = isNativeToken(swap.tokenIn, chainId);
  const fastSwapEnabled = true;
  const directSwapAttempted = fastSwapEnabled && isDirectSwapSupported(chainId) && isBuyWithNative;

  console.log(`${txHash} status=ok tokenIn=${swap.tokenIn} tokenOut=${swap.tokenOut} dex=${swap.dexName || 'unknown'}`);
  console.log(`  direction isBuy=${classification.isBuy} isSell=${classification.isSell} tokenToToken=${classification.isTokenToToken}`);
  console.log(`  cashFlags tokenInCash=${classification.tokenInCash} tokenOutCash=${classification.tokenOutCash}`);
  console.log(`  directSwapAttempted=${directSwapAttempted} reasons=${[
    fastSwapEnabled ? null : 'fastSwapMode=false',
    isDirectSwapSupported(chainId) ? null : 'chain_not_supported',
    isBuyWithNative ? null : 'tokenIn_not_native'
  ].filter(Boolean).join('|') || 'none'}`);
  console.log(`  timing fetch_ms=${tFetch - t0} parse_ms=${tParse - tFetch} total_ms=${tParse - t0}`);
}

async function main() {
  for (const tx of txHashes) {
    try {
      await runOne(tx);
    } catch (e: any) {
      console.log(`${tx} status=error err=${(e?.message || String(e)).slice(0, 160)}`);
    }
  }
  process.exit(0);
}

main();
