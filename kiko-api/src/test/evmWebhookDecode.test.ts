import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTxSkeletonFromAlchemyActivity,
  shouldForceFullTxRepair,
  shouldPreferSwapSourceField,
} from '../routes/webhook/evmWebhookDecode.js';

describe('evmWebhookDecode', () => {
  test('buildTxSkeletonFromAlchemyActivity preserves native value from full grouped activities', () => {
    const activities = [
      {
        category: 'token',
        fromAddress: '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed',
        toAddress: '0x5e1f62dac767b0491e3ce72469c217365d5b48cc',
        rawContract: {
          address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
          rawValue: '610456879661015573',
        },
      },
      {
        category: 'external',
        fromAddress: '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed',
        toAddress: '0x5e1f62dac767b0491e3ce72469c217365d5b48cc',
        value: 0.001190443380463463,
        rawContract: {
          rawValue: '0x437223d97d767',
        },
      },
    ];

    const txSkeleton = buildTxSkeletonFromAlchemyActivity(activities, '0x6f2d');
    assert.equal(txSkeleton.from, '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed');
    assert.equal(txSkeleton.to, '0x5e1f62dac767b0491e3ce72469c217365d5b48cc');
    assert.equal(txSkeleton.value, '0x437223d97d767');
  });

  test('shouldForceFullTxRepair replays when skeleton direction conflicts with cash hint', () => {
    const shouldRepair = shouldForceFullTxRepair({
      chainId: 1,
      swap: {
        tokenIn: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
        tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      },
      cashHint: {
        cashSpentUsd: 10,
        inferredTxType: 'TARGET_BUY',
      },
      hasCachedSwap: false,
    });

    assert.equal(shouldRepair, true);
  });

  test('shouldForceFullTxRepair keeps aligned sell directions untouched', () => {
    const shouldRepair = shouldForceFullTxRepair({
      chainId: 1,
      swap: {
        tokenIn: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
        tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      },
      cashHint: {
        cashReceivedUsd: 10,
        inferredTxType: 'TARGET_SELL',
      },
      hasCachedSwap: false,
    });

    assert.equal(shouldRepair, false);
  });

  test('shouldPreferSwapSourceField treats placeholder tx fields as unusable', () => {
    assert.equal(shouldPreferSwapSourceField('0x'), true);
    assert.equal(shouldPreferSwapSourceField('0x0'), true);
    assert.equal(shouldPreferSwapSourceField('0'), true);
    assert.equal(shouldPreferSwapSourceField('0xf2c42696'), false);
    assert.equal(shouldPreferSwapSourceField('0x437223d97d767'), false);
  });
});
