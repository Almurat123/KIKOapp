import { ethers } from 'ethers';
import { getTransactionByHash, getTransactionReceipt } from './src/services/rpcManager.ts';
import { parseSwapTransaction } from './src/services/txDecoder.ts';
import { buildExecutionPlan } from './src/services/copytrade/planner/pathPlanner.ts';
import { simulatePlan } from './src/services/copytrade/planner/shadowRunner.ts';

const chainId = 8453;
const hashes = [
  '0xaa0bd768d67d71c52dae764069cc5d0cf24a5075db5361c684933c2b452950cd',
  '0x8e23781e9b83f7140014608e34d6628adcbbb018131067a1def8c6e3f78d0586',
  '0x902a0a46eb5cadf2aaceb41ab4c6e470d7eb202495b77460e66bec8f61d9ce87',
  '0x88bcd0cea619cf9b6208b122fd910a5078d6d9307cc41bb47ee83109967bd538',
  '0x091a682617395e7390f4929ab95f3c8fabf62fdc56d8b0fdf7e4c6d796183821'
];

(async()=>{
  for (const txHash of hashes) {
    const [tx, receipt] = await Promise.all([
      getTransactionByHash(chainId, txHash),
      getTransactionReceipt(chainId, txHash)
    ]);
    const decoded: any = await parseSwapTransaction(tx as any, receipt as any, chainId).catch(() => null);
    if (!decoded) {
      console.log(JSON.stringify({ txHash, status: 'decode_failed' }));
      continue;
    }
    const amountInHuman = decoded.tokenIn?.toLowerCase?.() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
      ? ethers.formatEther(BigInt(String(decoded.amountIn || tx.value || '0')))
      : '1';

    const plan = await buildExecutionPlan({
      chainId,
      side: 'buy',
      tokenIn: String(decoded.tokenIn || '').toLowerCase(),
      tokenOut: String(decoded.tokenOut || '').toLowerCase(),
      amountIn: amountInHuman,
      walletAddress: String(tx.from || '').toLowerCase(),
      sourceTxHash: txHash,
      sourceRouter: String(decoded.router || tx.to || '').toLowerCase(),
      sourceSelector: String(decoded.sourceSelector || '').toLowerCase(),
      sourceTxInput: String(decoded.sourceTxInput || tx.input || ''),
      sourceTxValue: String(decoded.sourceTxValue || tx.value || '0')
    });

    const sim = await simulatePlan(plan, String(tx.from || '').toLowerCase(), String(plan.templateRef.router || '').toLowerCase());
    console.log(JSON.stringify({
      txHash,
      template: plan.templateRef.commandType,
      commands: plan.execData.commands,
      inputCount: plan.execData.inputs?.length || 0,
      sourceValue: plan.execData.sourceValue || '0',
      simSuccess: sim.success,
      simReason: sim.success ? 'ok' : String(sim.revertReason || 'failed').slice(0, 120)
    }));
  }
})();
