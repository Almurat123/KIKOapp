import { ethers } from 'ethers';
import { parseSwapTransaction } from './src/services/txDecoder.ts';
import { getTransactionByHash, getTransactionReceipt } from './src/services/rpcManager.ts';
import { resolveHintedPoolFromSwapSupply } from './src/services/dex/directSwap/supplyParser.ts';
import { buildV4ExecutionPlan } from './src/services/dex/v4ExecutionPlan.ts';
import { buildV4SwapTransaction } from './src/services/dex/uniswapV4Swap.ts';

const chainId = 8453;
const txHash = '0xaa0bd768d67d71c52dae764069cc5d0cf24a5075db5361c684933c2b452950cd';

(async()=>{
  const [tx, receipt] = await Promise.all([
    getTransactionByHash(chainId, txHash),
    getTransactionReceipt(chainId, txHash)
  ]);
  const decoded:any = await parseSwapTransaction(tx as any, receipt as any, chainId);
  const tokenIn=String(decoded.tokenIn).toLowerCase();
  const tokenOut=String(decoded.tokenOut).toLowerCase();
  const hinted = await resolveHintedPoolFromSwapSupply({
    tokenIn, tokenOut, chainId,
    hint: {
      sourceTxHash: txHash,
      sourceRouter: String(decoded.router || tx.to || '').toLowerCase(),
      sourceTokenIn: tokenIn,
      sourceTokenOut: tokenOut,
      sourceAmountIn: String(decoded.amountIn || '0'),
      sourceAmountOut: String(decoded.amountOut || '0'),
      resolvedPoolHint: decoded.resolvedPoolHint,
      routeHopCount: Number(decoded.routeHopCount || 0),
      routeHops: decoded.routeHops,
      canUseResolvedPoolFastPath: decoded.canUseResolvedPoolFastPath
    }
  });
  if (!hinted || hinted.kind !== 'v4') throw new Error('no hinted v4');

  const plan = buildV4ExecutionPlan({
    tokenIn,
    tokenOut,
    chainId,
    walletAddress: String(tx.from || '').toLowerCase(),
    pool: hinted.pool
  });
  const built = buildV4SwapTransaction(
    chainId,
    plan.poolKey,
    plan.zeroForOne,
    BigInt(String(decoded.amountIn || '0')),
    0n,
    String(tx.from || '').toLowerCase(),
    Math.floor(Date.now()/1000)+300,
    plan.isNativeIn,
    plan.isNativeOut,
    plan.hookDataCandidates[0] || '0x',
    { usePathSwap: plan.hookFamily==='flaunch', appendSweepOut: plan.hookFamily==='flaunch' }
  );

  const iface = new ethers.Interface([
    'function execute(bytes commands, bytes[] inputs, uint256 deadline)',
    'function execute(bytes commands, bytes[] inputs)'
  ]);
  const d = iface.parseTransaction({ data: built.data, value: 0n });
  const commands = String(d?.args?.[0] || '0x');
  const inputs = (d?.args?.[1] || []) as string[];
  console.log('hookFamily', plan.hookFamily);
  console.log('commands', commands);
  console.log('commandsBytes', commands.slice(2).match(/.{1,2}/g));
  const abi = ethers.AbiCoder.defaultAbiCoder();
  for (let i=0;i<inputs.length;i++) {
    console.log('input', i, 'len', (inputs[i].length-2)/2);
    try {
      const [actions, params] = abi.decode(['bytes','bytes[]'], inputs[i]) as [string,string[]];
      console.log(' actions', actions, (actions.slice(2).match(/.{1,2}/g)));
      console.log(' params', params.map((p)=>(p.length-2)/2));
      if (params[1]) {
        try {
          const [c,a]=abi.decode(['address','uint256'], params[1]);
          console.log(' settle', c, a.toString());
        } catch {}
      }
      if (params[2]) {
        try {
          const [c,a]=abi.decode(['address','uint256'], params[2]);
          console.log(' take', c, a.toString());
        } catch {}
      }
    } catch {}
  }
})();
