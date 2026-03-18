import assert from 'node:assert/strict';
import test from 'node:test';

import { ethers } from 'ethers';

import { getV2ExpectedOutput, getV3BestQuoteOut } from '../application/quoteEngines.js';
import { V2_ROUTER_ABI } from '../../types.js';

const v2RouterInterface = new ethers.Interface(V2_ROUTER_ABI);
const v3QuoterInterface = new ethers.Interface([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
]);

test('getV2ExpectedOutput routes quote reads through the trade-execution profile', async () => {
  const observed: Array<{ purpose: string; strategy: string; importance: string }> = [];

  const amountOut = await getV2ExpectedOutput(
    '0x1111111111111111111111111111111111111111',
    '0x2222222222222222222222222222222222222222',
    123n,
    8453,
    {
      async callRpcFn(_chainId, _method, _params, options) {
        observed.push({
          purpose: String(options?.profile?.purpose || ''),
          strategy: String(options?.profile?.strategy || ''),
          importance: String(options?.profile?.importance || ''),
        });
        return v2RouterInterface.encodeFunctionResult('getAmountsOut', [[123n, 456n]]) as any;
      },
    }
  );

  assert.equal(amountOut, 456n);
  assert.equal(observed.length, 1);
  assert.equal(observed[0]?.purpose, 'trade_execution');
  assert.equal(observed[0]?.strategy !== 'cheap', true);
  assert.equal(observed[0]?.importance, 'critical');
});

test('getV3BestQuoteOut uses trade-execution profile for every quoter probe', async () => {
  const observed: Array<{ purpose: string; strategy: string; importance: string }> = [];

  const bestOut = await getV3BestQuoteOut(
    '0x1111111111111111111111111111111111111111',
    '0x2222222222222222222222222222222222222222',
    123n,
    8453,
    'uniswap',
    {
      async callRpcFn(_chainId, _method, _params, options) {
        observed.push({
          purpose: String(options?.profile?.purpose || ''),
          strategy: String(options?.profile?.strategy || ''),
          importance: String(options?.profile?.importance || ''),
        });
        return v3QuoterInterface.encodeFunctionResult('quoteExactInputSingle', [789n, 0n, 0, 0n]) as any;
      },
    }
  );

  assert.equal(bestOut, 789n);
  assert.equal(observed.length, 4);
  assert.ok(observed.every((entry) =>
    entry.purpose === 'trade_execution'
    && entry.strategy !== 'cheap'
    && entry.importance === 'critical'
  ));
});
