import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';

import {
  __balanceRpcReaderTest,
  readEvmTokenBalanceFast,
  readEvmTokenDecimalsFast,
  readNativeBalanceFast,
  readSolanaTokenBalanceFast,
} from '../services/rpc/balanceRpcReader.js';

describe('balanceRpcReader', () => {
  afterEach(() => {
    __balanceRpcReaderTest.resetForTest();
  });

  test('reads ERC20 balance via cheap/exhaustive raw RPC', async () => {
    const iface = new ethers.Interface(['function balanceOf(address owner) view returns (uint256)']);
    const encoded = iface.encodeFunctionResult('balanceOf', [123456789n]);
    const calls: any[] = [];
    __balanceRpcReaderTest.setCallRpcRawForTest(async (...args: any[]) => {
      calls.push(args);
      return {
        jsonrpc: '2.0',
        id: 1,
        result: encoded,
      } as any;
    });

    const balance = await readEvmTokenBalanceFast({
      tokenAddress: '0x0000000000000000000000000000000000000001',
      walletAddress: '0x0000000000000000000000000000000000000002',
      chainId: 1,
      path: 'test_balance',
    });

    assert.equal(balance, 123456789n);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][3].strategy, 'cheap');
    assert.equal(calls[0][3].importance, 'normal');
    assert.equal(calls[0][3].exhaustiveFailover, true);
    assert.equal(calls[0][3].path, 'test_balance');
  });

  test('reads ERC20 decimals via cheap/exhaustive raw RPC', async () => {
    const iface = new ethers.Interface(['function decimals() view returns (uint8)']);
    const encoded = iface.encodeFunctionResult('decimals', [18]);
    __balanceRpcReaderTest.setCallRpcRawForTest(async () => ({
      jsonrpc: '2.0',
      id: 1,
      result: encoded,
    } as any));

    const decimals = await readEvmTokenDecimalsFast({
      tokenAddress: '0x0000000000000000000000000000000000000001',
      chainId: 1,
    });

    assert.equal(decimals, 18);
  });

  test('reads native and Solana token balances from raw RPC result', async () => {
    const calls: any[] = [];
    __balanceRpcReaderTest.setCallRpcRawForTest(async (...args: any[]) => {
      calls.push(args);
      const method = args[1];
      if (method === 'eth_getBalance') {
        return { jsonrpc: '2.0', id: 1, result: '0x64' } as any;
      }
      return {
        jsonrpc: '2.0',
        id: 1,
        result: {
          value: [
            { account: { data: { parsed: { info: { tokenAmount: { amount: '10', decimals: 6 } } } } } },
            { account: { data: { parsed: { info: { tokenAmount: { amount: '25', decimals: 6 } } } } } },
          ],
        },
      } as any;
    });

    const nativeBalance = await readNativeBalanceFast({
      walletAddress: '0x0000000000000000000000000000000000000002',
      chainIdOrName: 1,
      path: 'test_native',
    });
    const solToken = await readSolanaTokenBalanceFast({
      walletAddress: 'So11111111111111111111111111111111111111111',
      tokenAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      path: 'test_sol_token',
    });

    assert.equal(nativeBalance, 100n);
    assert.equal(solToken.balanceRaw, 35n);
    assert.equal(solToken.decimals, 6);
    assert.equal(calls[0][3].path, 'test_native');
    assert.equal(calls[1][3].path, 'test_sol_token');
  });
});
