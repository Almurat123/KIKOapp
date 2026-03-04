import assert from 'node:assert/strict';

import type { MainSwapRequest, MainSwapResult } from '../../services/MainSwapService.js';
import { resetSwapExecutionHandlerForTests, setSwapExecutionHandlerForTests } from '../../services/swap/swapExecutionPort.js';

export type CapturedSwapExecution = {
  request: MainSwapRequest;
};

const capturedExecutions: CapturedSwapExecution[] = [];
const queuedResults: Array<MainSwapResult | Error> = [];

export function queueSwapExecutionResult(result: MainSwapResult | Error): void {
  queuedResults.push(result);
}

export function getCapturedSwapExecutions(): CapturedSwapExecution[] {
  return [...capturedExecutions];
}

export function installCopytradeExecutionPortHarness(): void {
  resetCopytradeExecutionPortHarness();
  setSwapExecutionHandlerForTests(async (request) => {
    capturedExecutions.push({ request });
    const next = queuedResults.shift();
    assert.ok(next, 'No queued executeSwap result available for test harness');
    if (next instanceof Error) {
      throw next;
    }
    return next;
  });
}

export function resetCopytradeExecutionPortHarness(): void {
  capturedExecutions.length = 0;
  queuedResults.length = 0;
  resetSwapExecutionHandlerForTests();
}
