import { ethers } from 'ethers';
import { callRpc } from '../../rpcManager.js';
import type { ExecutionPlanV1, SimulationResult } from './types.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';

const ROUTER_EXECUTE_ABI = [
  'function execute(bytes commands, bytes[] inputs) payable returns (uint256 amountOut)'
];

export function buildRouterExecuteCalldata(plan: ExecutionPlanV1): string {
  const iface = new ethers.Interface(ROUTER_EXECUTE_ABI);
  return iface.encodeFunctionData('execute', [plan.execData.commands || '0x', plan.execData.inputs || []]);
}

export async function simulatePlan(
  plan: ExecutionPlanV1,
  walletAddress: string,
  routerAddress?: string
): Promise<SimulationResult> {
  const target = routerAddress || plan.templateRef.router;
  if (!target || !/^0x[a-fA-F0-9]{40}$/.test(target)) {
    return {
      success: false,
      revertReason: 'router_address_not_configured'
    };
  }

  try {
    const data = buildRouterExecuteCalldata(plan);
    const raw = await callRpc<string>(plan.chainId, 'eth_call', [{
      from: walletAddress,
      to: target,
      data,
      value: '0x0'
    }, 'latest'], {
      strategy: 'fast',
      importance: 'critical'
    });

    return {
      success: true,
      amountOut: raw && raw !== '0x' ? BigInt(raw).toString() : '0',
      raw
    };
  } catch (error: any) {
    const message = String(error?.message || error || 'simulation_failed');
    logger.warn(LogCode.SYS_INFO, '[P2] Plan simulation failed', {
      chainId: plan.chainId,
      reason: message.slice(0, 180)
    });
    return {
      success: false,
      revertReason: message
    };
  }
}
