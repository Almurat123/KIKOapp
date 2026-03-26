import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildUserFacingSwapError,
  inferSwapReasonCode,
  verifyNativeBalancePrecheck,
} from '../MainSwapService.js';

test('verifyNativeBalancePrecheck bypasses transient RPC auth failures', async () => {
  let bypassed: string | null = null;

  await verifyNativeBalancePrecheck({
    chainId: 56,
    walletAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B',
    amountIn: '0.001',
    gasReserve: '0.003',
    getNativeBalanceFn: async () => {
      throw new Error('All RPC endpoints failed for BNB Smart Chain. Last error: HTTP 401: Unauthorized');
    },
    onBypass: (error) => {
      bypassed = String((error as Error).message || error);
    },
  });

  assert.match(bypassed || '', /HTTP 401: Unauthorized/);
});

test('verifyNativeBalancePrecheck still rejects true insufficient native balance', async () => {
  await assert.rejects(
    () => verifyNativeBalancePrecheck({
      chainId: 56,
      walletAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B',
      amountIn: '0.01',
      gasReserve: '0.003',
      getNativeBalanceFn: async () => '0x0',
    }),
    /insufficient_native_balance_precheck/
  );
});

test('swap error mapping classifies rpc pool failures explicitly', () => {
  const message = 'All RPC endpoints failed for BNB Smart Chain. Last error: HTTP 401: Unauthorized';
  assert.equal(inferSwapReasonCode(message), 'rpc_unavailable');
  assert.equal(
    buildUserFacingSwapError(message),
    'Trade execution RPC is temporarily unavailable on this chain. Please retry shortly.'
  );
});
