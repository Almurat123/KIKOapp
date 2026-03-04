import { afterEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';

import { readExitBalanceOracle } from '../services/copytrade/oracle/exitBalanceOracle.js';

describe('exitBalanceOracle', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  test('returns confirmed positive when any attempt reads positive balance', async () => {
    let calls = 0;
    const balanceReader = async () => {
      calls += 1;
      return calls < 2 ? 0n : 123n;
    };

    const result = await readExitBalanceOracle({
      tokenAddress: '0xtoken',
      walletAddress: '0xwallet',
      chainId: 56,
      isMirrorSell: true,
      attempts: 3,
      retryDelayMs: 0,
      balanceReader,
    });

    assert.equal(result.status, 'success');
    assert.equal(result.value, 123n);
    assert.equal(result.reasonCode, 'EXIT_BALANCE_CONFIRMED_POSITIVE');
  });

  test('returns uncertain when reads mix zero values and rpc failures', async () => {
    let calls = 0;
    const balanceReader = async () => {
      calls += 1;
      if (calls === 1) return 0n;
      throw new Error('rpc down');
    };

    const result = await readExitBalanceOracle({
      tokenAddress: '0xtoken',
      walletAddress: '0xwallet',
      chainId: 56,
      isMirrorSell: true,
      attempts: 2,
      retryDelayMs: 0,
      balanceReader,
    });

    assert.equal(result.status, 'uncertain');
    assert.equal(result.reasonCode, 'EXIT_BALANCE_RPC_UNCERTAIN');
  });

  test('returns failed when all attempts fail', async () => {
    const balanceReader = async () => {
      throw new Error('rpc down');
    };

    const result = await readExitBalanceOracle({
      tokenAddress: '0xtoken',
      walletAddress: '0xwallet',
      chainId: 56,
      isMirrorSell: true,
      attempts: 2,
      retryDelayMs: 0,
      balanceReader,
    });

    assert.equal(result.status, 'failed');
    assert.equal(result.reasonCode, 'EXIT_BALANCE_RPC_FAILED');
  });
});
