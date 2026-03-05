import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import prisma from '../../../db/prisma.js';
import { resolveSellAmountInHuman } from '../trading-flow/amountResolver.js';

after(async () => {
  await prisma.$disconnect().catch(() => {});
});

test('sell amount resolver: wallet balance wins and skips fallback chain', async () => {
  let pendingCalls = 0;
  const result = await resolveSellAmountInHuman({
    walletAddress: '0xwallet',
    tokenIn: '0xtoken',
    chainId: 56,
    context: {
      userId: 'user-1',
      mode: 'normal',
    },
    overrides: {
      async resolveWalletAmountInHuman() {
        return { amountInHuman: '12.34' };
      },
      async resolvePendingLotAmountInHuman() {
        pendingCalls += 1;
        return { amountInHuman: '10' };
      },
    },
  });

  assert.equal(result.amountInHuman, '12.34');
  assert.equal(result.source, 'wallet_balance');
  assert.equal(pendingCalls, 0);
});

test('sell amount resolver: pending lot fallback is used when wallet amount is missing', async () => {
  const result = await resolveSellAmountInHuman({
    walletAddress: '0xwallet',
    tokenIn: '0xtoken',
    chainId: 900,
    context: {
      userId: 'user-1',
      mode: 'normal',
    },
    overrides: {
      async resolveWalletAmountInHuman() {
        return { amountInHuman: null };
      },
      async resolvePendingLotAmountInHuman() {
        return {
          amountInHuman: '3.21',
          metadata: { pendingLotId: 'lot-1' },
        };
      },
      async resolveLedgerAmountInHuman() {
        return { amountInHuman: null };
      },
      async resolveInferredAmountInHuman() {
        return { amountInHuman: null };
      },
    },
  });

  assert.equal(result.amountInHuman, '3.21');
  assert.equal(result.source, 'pending_lot');
});

test('sell amount resolver: ledger fallback is used when wallet/pending are unavailable', async () => {
  const result = await resolveSellAmountInHuman({
    walletAddress: '0xwallet',
    tokenIn: '0xtoken',
    chainId: 8453,
    context: {
      userId: 'user-1',
      mode: 'normal',
    },
    overrides: {
      async resolveWalletAmountInHuman() {
        return { amountInHuman: null };
      },
      async resolvePendingLotAmountInHuman() {
        return { amountInHuman: null };
      },
      async resolveLedgerAmountInHuman() {
        return {
          amountInHuman: '1.5',
          metadata: { ledgerId: 'ledger-1' },
        };
      },
      async resolveInferredAmountInHuman() {
        return { amountInHuman: null };
      },
    },
  });

  assert.equal(result.amountInHuman, '1.5');
  assert.equal(result.source, 'ledger');
});

test('sell amount resolver: inferred source ratio works in normal mode', async () => {
  const result = await resolveSellAmountInHuman({
    walletAddress: '0xwallet',
    tokenIn: '0xtoken',
    chainId: 56,
    context: {
      userId: 'user-1',
      mode: 'normal',
      sourceAmountIn: '100',
    },
    overrides: {
      async resolveWalletAmountInHuman() {
        return { amountInHuman: null };
      },
      async resolvePendingLotAmountInHuman() {
        return { amountInHuman: null };
      },
      async resolveLedgerAmountInHuman() {
        return { amountInHuman: null };
      },
      async resolveInferredAmountInHuman() {
        return {
          amountInHuman: '0.88',
          metadata: { inferredRatio: 0.5 },
        };
      },
    },
  });

  assert.equal(result.amountInHuman, '0.88');
  assert.equal(result.source, 'inferred_source_ratio');
});

test('sell amount resolver: safety mode blocks inferred source ratio fallback', async () => {
  const result = await resolveSellAmountInHuman({
    walletAddress: '0xwallet',
    tokenIn: '0xtoken',
    chainId: 56,
    context: {
      userId: 'user-1',
      mode: 'safety',
      sourceAmountIn: '100',
    },
    overrides: {
      async resolveWalletAmountInHuman() {
        return { amountInHuman: null };
      },
      async resolvePendingLotAmountInHuman() {
        return { amountInHuman: null };
      },
      async resolveLedgerAmountInHuman() {
        return { amountInHuman: null };
      },
      async resolveInferredAmountInHuman() {
        return { amountInHuman: '9.99' };
      },
    },
  });

  assert.equal(result.amountInHuman, null);
  assert.equal(result.source, null);
  assert.equal(result.metadata.reason, 'sell_amount_inferred_disabled_in_safety_mode');
});
