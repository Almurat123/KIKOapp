import dotenv from 'dotenv';
dotenv.config();
import { getTransactionByHash, getTransactionReceipt } from './src/services/rpcManager.js';
import { parseSwapTransaction } from './src/services/txDecoder.js';
import { buildSourceReplayPlanFromInput } from './src/services/copytrade/planner/adapters/registry.js';
import type { PlannerInput } from './src/services/copytrade/planner/types.js';

const chainId = 8453;
const txHash = process.argv[2] || '0xb4f8c16853e131ecd55aae8a78971a0dfbaac807442a86df96dfd545a1d947b3';
const follower = process.argv[3] || '0x4f67f52147c6bc03563772fa3d7af3adffb92110';

const tx = await getTransactionByHash(chainId, txHash);
const rc = await getTransactionReceipt(chainId, txHash);
const decoded: any = await parseSwapTransaction(tx as any, rc as any, chainId);

const tokenIn = String(decoded?.tokenIn || '').toLowerCase();
const amountInRaw = String(decoded?.amountIn || tx.value || '0');
let amountIn = '0';
try {
  if (tokenIn === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' || tokenIn === '0x4200000000000000000000000000000000000006') {
    amountIn = (await import('ethers')).ethers.formatEther(BigInt(amountInRaw));
  } else {
    amountIn = '1';
  }
} catch {
  amountIn = '1';
}

const input: PlannerInput = {
  chainId,
  side: tokenIn === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' || tokenIn === '0x4200000000000000000000000000000000000006' ? 'buy' : 'sell',
  tokenIn,
  tokenOut: String(decoded?.tokenOut || '').toLowerCase(),
  amountIn,
  walletAddress: follower,
  sourceWallet: String(tx.from || '').toLowerCase(),
  sourceTxHash: txHash,
  sourceRouter: String(decoded?.router || tx.to || '').toLowerCase(),
  sourceSelector: String(decoded?.sourceSelector || String(tx.input || '').slice(0,10)).toLowerCase(),
  sourceTxInput: String(decoded?.sourceTxInput || tx.input || ''),
  sourceTxValue: String(decoded?.sourceTxValue || tx.value || '0')
};

const result = buildSourceReplayPlanFromInput(input);
console.log(JSON.stringify({
  txHash,
  selector: input.sourceSelector,
  tokenIn: input.tokenIn,
  amountIn: input.amountIn,
  amountInRaw,
  router: input.sourceRouter,
  status: result.status,
  reason: result.reason,
  adapterName: result.adapterName,
  warnings: result.warnings,
  commandType: result.plan?.templateRef?.commandType,
  sourceValue: result.plan?.execData?.sourceValue
}, null, 2));
