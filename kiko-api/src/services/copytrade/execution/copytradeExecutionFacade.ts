import type { MainSwapRequest, MainSwapResult } from '../../MainSwapService.js';
import type { TradeContext } from '../../TradeContext.js';
import { executeSwapViaPort } from '../../swap/swapExecutionPort.js';
import {
  resolveExecutionLifecycleSnapshot,
  type ExecutionLifecycleSnapshot,
} from '../../swap/lifecycle/executionLifecycleModel.js';

export interface CopytradeExecutionResult {
  swapResult: MainSwapResult;
  lifecycle: ExecutionLifecycleSnapshot;
}

export async function submitCopytradeBuy(
  request: MainSwapRequest,
  tradeContext?: TradeContext,
): Promise<CopytradeExecutionResult> {
  const swapResult = await executeSwapViaPort(request, tradeContext);
  return {
    lifecycle: resolveExecutionLifecycleSnapshot({ result: swapResult }),
    swapResult,
  };
}

export async function submitCopytradeExit(
  request: MainSwapRequest,
  tradeContext?: TradeContext,
): Promise<CopytradeExecutionResult> {
  const swapResult = await executeSwapViaPort(request, tradeContext);
  return {
    lifecycle: resolveExecutionLifecycleSnapshot({ result: swapResult }),
    swapResult,
  };
}
