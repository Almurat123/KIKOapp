import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { buildSolanaDirectRequest } from '../services/solana/direct/router.js';

describe('solana direct router provider mapping', () => {
  test('maps bonkfun to raydium_launchlab', async () => {
    const req = await buildSolanaDirectRequest({
      userId: 'u1',
      mint: 'So11111111111111111111111111111111111111112',
      amountAtomic: '1000',
      isBuy: true,
      slippageBps: 500,
      provider: 'bonkfun',
    });
    assert.equal(req.provider, 'raydium_launchlab');
  });

  test('accepts meteora as direct provider', async () => {
    const req = await buildSolanaDirectRequest({
      userId: 'u1',
      mint: 'So11111111111111111111111111111111111111112',
      amountAtomic: '1000',
      isBuy: false,
      slippageBps: 500,
      provider: 'meteora',
    });
    assert.equal(req.provider, 'meteora');
  });
});
