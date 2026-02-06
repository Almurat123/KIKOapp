import { ethers } from 'ethers';
import { fetchTransaction, fetchTransactionReceipt } from '../services/watcherService.js';
import { parseSwapTransaction } from '../services/txDecoder.js';
import { executeDirectSwap } from '../services/dex/directSwapService.js';

process.env.SIMULATION_MODE = 'true';
process.env.DIRECT_SWAP_REF_MODE = 'onchain-only';

const chainId = 8453;
const wallet = '0xb4beddf1b828aaed9638601f7145b0f6093f2d3f';
const txs = [
  '0xcdcd6afd5c7d9580c27250be401963d9370e2c38f1969f0a54e1dbc19308ba56',
  '0x27a92c0276cacfde88b858cd68969e216eaf2d53cef2ea368c47fe9d6ac1390c',
  '0x962a05aeb703d528bb6137079b467e6a95b275c9b5a73f24acb49edaa82cc233',
  '0x8f448163207c484f27e3bf617449fda6e1dd3558d432069be3adc45a720f0191'
];

async function runOne(txHash: string): Promise<void> {
  const [tx, receipt] = await Promise.all([
    fetchTransaction(txHash, chainId),
    fetchTransactionReceipt(txHash, chainId)
  ]);
  if (!tx || !receipt) {
    console.log(`${txHash} missing`);
    return;
  }

  const swap = await parseSwapTransaction(
    { hash: txHash, from: tx.from, to: tx.to, input: tx.input, value: tx.value },
    { logs: receipt.logs, status: parseInt(receipt.status, 16) },
    chainId,
    wallet
  );
  if (!swap) {
    console.log(`${txHash} not_swap`);
    return;
  }

  const start = Date.now();
  const result = await executeDirectSwap({
    userId: 'speed-check',
    accessToken: '',
    walletAddress: wallet,
    tokenIn: swap.tokenIn,
    tokenOut: swap.tokenOut,
    amountIn: ethers.formatEther(BigInt(swap.amountIn)),
    chainId,
    slippageBps: 1500,
    hint: {
      sourceDexName: swap.dexName || undefined,
      sourceRouter: swap.router || undefined,
      sourceTxHash: swap.txHash
    }
  });
  const ms = Date.now() - start;
  console.log(`${txHash} success=${result.success} provider=${result.provider} err=${result.error || ''} ms=${ms}`);
}

async function main() {
  for (const tx of txs) {
    await runOne(tx);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

