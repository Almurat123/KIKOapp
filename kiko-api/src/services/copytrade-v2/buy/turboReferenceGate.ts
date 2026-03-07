import type { CopyTradeExecutionMode } from '../../copyTradeExecutionMode.js';

export function shouldSkipCopyTradeLocalReferenceQuote(chainId: number, executionMode: CopyTradeExecutionMode): boolean {
  return chainId === 900 || executionMode === 'turbo';
}
