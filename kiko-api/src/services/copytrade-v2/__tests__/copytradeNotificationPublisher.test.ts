import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import prisma from '../../../db/prisma.js';
import type { CopytradeOrderAggregate } from '../contracts/aggregate.js';
import type { CopytradeNotificationEvent } from '../contracts/notifications.js';
import {
  resolveDedupeKey,
  resolveUserNotificationPayload,
  shouldSkipByDedupeKey,
} from '../notifications/copytradeNotificationPublisher.js';

after(async () => {
  await prisma.$disconnect().catch(() => {});
});

function buildOrder(state: CopytradeOrderAggregate['lifecycleState']): CopytradeOrderAggregate {
  const now = new Date('2026-03-05T00:00:00.000Z');
  return {
    id: 'order-1',
    chainId: 8453,
    txHash: '0xsource',
    targetWallet: '0xTargetWallet',
    tokenIn: '0xTokenIn',
    tokenOut: '0xTokenOut',
    mode: 'normal',
    lifecycleState: state,
    lastReasonCode: 'ok_detected',
    retryCount: 0,
    direction: 'buy',
    createdAt: now,
    updatedAt: now,
    metadata: {
      amountIn: '25.5',
      amountOut: '1000',
    },
  };
}

function buildEvent(type: CopytradeNotificationEvent['type']): CopytradeNotificationEvent {
  return {
    type,
    order: buildOrder(type === 'BUY_CONFIRMED_OPEN' ? 'BUY_CONFIRMED_OPEN' : 'BUY_ACCEPTED'),
    reasonCode: 'ok_buy_confirmed_open',
    txHash: '0xexec',
    sourceTxHash: '0xsource',
  };
}

test('notification policy: BUY_ACCEPTED is internal-only and suppressed for user DM', () => {
  const payload = resolveUserNotificationPayload({
    event: buildEvent('BUY_ACCEPTED'),
    tokenSymbol: 'TEST',
    targetWallet: '0xTargetWallet',
    txHash: '0xexec',
  });
  assert.equal(payload, null);
});

test('notification policy: BUY_CONFIRMED_OPEN produces TRADE_SUCCESS_BUY payload', () => {
  const payload = resolveUserNotificationPayload({
    event: buildEvent('BUY_CONFIRMED_OPEN'),
    tokenSymbol: 'TEST',
    targetWallet: '0xTargetWallet',
    txHash: '0xexec',
  });
  assert.equal(payload?.type, 'TRADE_SUCCESS_BUY');
  assert.equal(payload?.data.tokenSymbol, 'TEST');
});

test('notification dedupe: identical event key can only pass once within TTL', () => {
  const dedupeKey = resolveDedupeKey(buildEvent('BUY_CONFIRMED_OPEN'));
  const first = shouldSkipByDedupeKey(dedupeKey);
  const second = shouldSkipByDedupeKey(dedupeKey);
  assert.equal(first, false);
  assert.equal(second, true);
});
