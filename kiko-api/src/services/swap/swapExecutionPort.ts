import { MainSwapService, type MainSwapRequest, type MainSwapResult } from '../MainSwapService.js';
import type { TradeContext } from '../TradeContext.js';

type SwapExecutionHandler = (
  request: MainSwapRequest,
  tradeContext?: TradeContext,
) => Promise<MainSwapResult>;

let testHandler: SwapExecutionHandler | null = null;

async function defaultSwapExecutionHandler(
  request: MainSwapRequest,
  tradeContext?: TradeContext,
): Promise<MainSwapResult> {
  return await MainSwapService.executeSwap(request, tradeContext);
}

export async function executeSwapViaPort(
  request: MainSwapRequest,
  tradeContext?: TradeContext,
): Promise<MainSwapResult> {
  const handler = testHandler || defaultSwapExecutionHandler;
  return await handler(request, tradeContext);
}

export function setSwapExecutionHandlerForTests(handler: SwapExecutionHandler | null): void {
  testHandler = handler;
}

export function resetSwapExecutionHandlerForTests(): void {
  testHandler = null;
}
