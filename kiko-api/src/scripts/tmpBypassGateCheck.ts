import { ethers } from 'ethers';
import { fetchTransaction, fetchTransactionReceipt } from '../services/watcherService.js';
import { parseSwapTransaction } from '../services/txDecoder.js';
import { executeDirectSwap } from '../services/dex/directSwapService.js';

process.env.SIMULATION_MODE = 'true';
process.env.DIRECT_SWAP_REF_MODE = 'onchain-only';

const chainId = 8453;
const wallet = '0xffed8b8c0dc8d2b378a75542b0a077263990f8ca';
const txHash = '0x80a6e612f3f78eff0cd4f29d46a4096ad0eb3c67242646b1aad299216c51af84';

async function main() {
  const [tx, receipt] = await Promise.all([
    fetchTransaction(txHash, chainId),
    fetchTransactionReceipt(txHash, chainId)
  ]);
  if (!tx || !receipt) return;
  const swap = await parseSwapTransaction(
    { hash: txHash, from: tx.from, to: tx.to, input: tx.input, value: tx.value },
    { logs: receipt.logs, status: parseInt(receipt.status, 16) },
    chainId,
    wallet
  );
  if (!swap) return;

  const t0 = Date.now();
  const res = await executeDirectSwap({
    userId: 'bypass-check',
    accessToken: '',
    walletAddress: wallet,
    tokenIn: swap.tokenIn,
    tokenOut: swap.tokenOut,
    amountIn: ethers.formatEther(BigInt(swap.amountIn)),
    chainId,
    slippageBps: 1500,
    hint: {
      sourceDexName: swap.dexName,
      sourceRouter: swap.router,
      sourceTxHash: swap.txHash,
      preferredStrategy: 'v4',
      preferredDex: 'uniswap',
      bypassReferencePrice: true
    }
  });
  console.log(`result success=${res.success} provider=${res.provider} err=${res.error || ''} ms=${Date.now()-t0}`);
}

main().catch((e)=>{ console.error(e); process.exit(1); });
