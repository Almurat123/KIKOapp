import assert from 'node:assert/strict';
import test from 'node:test';

import { releaseMirrorSellAfterBuyConfirm } from '../buy/buyConfirmationMirrorSellRelease.js';

test('buy-confirmation mirror sell release schedules canonical target-sell intent when tx hash is available', async () => {
  const position = {
    id: 'pos-1',
    status: 'open',
    userId: 'user-1',
    configId: 'cfg-1',
    chainId: 8453,
    tokenAddress: '0x65021a79aeef22b17cdc1b768f5e79a8618beba3',
    entryAmountExact: '100',
    entryAmountDec: '0.0000000000000001',
  };

  let scheduledPayload: any = null;
  const released = await releaseMirrorSellAfterBuyConfirm({
    position,
    chainId: 8453,
    tokenAddress: position.tokenAddress,
    targetWallet: '0xtarget',
    targetSellTxHash: '0xselltx',
    reasonCode: 'TARGET_SELL_SEEN_IN_HISTORY',
    deps: {
      buildTargetSellEventPayload(payload: any) {
        return payload;
      },
      async persistTargetSellEventAndSchedulePositions(payload: any) {
        scheduledPayload = payload;
        return { event: payload.event, scheduled: 1, skipped: 0 };
      },
      async schedulePositionExitIntent() {
        throw new Error('should not use direct schedule fallback when target sell tx hash exists');
      },
    },
  });

  assert.equal(released, true);
  assert.equal(scheduledPayload?.event?.source, 'buy_confirmation');
  assert.equal(scheduledPayload?.positions?.[0]?.id, 'pos-1');
});

test('buy-confirmation mirror sell release falls back to direct intent scheduling when target sell tx hash is absent', async () => {
  const position = {
    id: 'pos-1',
    status: 'open',
    userId: 'user-1',
    configId: 'cfg-1',
    chainId: 8453,
    tokenAddress: '0x65021a79aeef22b17cdc1b768f5e79a8618beba3',
  };

  let scheduledFallback: any = null;
  const released = await releaseMirrorSellAfterBuyConfirm({
    position,
    chainId: 8453,
    tokenAddress: position.tokenAddress,
    targetWallet: '0xtarget',
    reasonCode: 'TARGET_SELL_BALANCE_UNVERIFIED',
    deps: {
      async persistTargetSellEventAndSchedulePositions() {
        throw new Error('should not persist target-sell event without tx hash');
      },
      async schedulePositionExitIntent(payload: any) {
        scheduledFallback = payload;
        return true;
      },
    },
  });

  assert.equal(released, true);
  assert.equal(scheduledFallback?.exitReason, 'mirror_sell');
  assert.equal(scheduledFallback?.position?.id, 'pos-1');
});
