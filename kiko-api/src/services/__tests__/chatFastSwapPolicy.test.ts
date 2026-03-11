import assert from 'node:assert/strict';
import test from 'node:test';

import { getFastSwapDecision } from '../../jobs/chat/fastSwapExecutor.js';
import { resolveTokenAddress } from '../tokens.js';

test('fast swap does not hard-require a contract address for non-whitelisted token names', () => {
  const decision = getFastSwapDecision({
    parsedIntent: {
      detailed: { action: 'swap' },
      swapIntent: { tokenOut: 'MOONCAT' },
      chainId: 8453,
    },
    lastUserMessage: 'buy mooncat with eth',
    toolContext: {
      chainId: 8453,
      toolConfig: { fastSwapMode: true },
    },
  });

  assert.equal(decision.requiresAddressForFastSwap, false);
  assert.equal(decision.shouldAttempt, false);
});

test('resolveTokenAddress supports USDCE alias on Polygon for Polymarket collateral', () => {
  assert.equal(
    resolveTokenAddress('USDCE', 137),
    '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  );
});
