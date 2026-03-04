import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveLegacyAttributionRepair } from '../services/copytrade/positions/legacyAttributionRepairPolicy.js';

describe('legacy attribution repair policy', () => {
  test('repairs from pending lot raw before falling back to position entry amount text', () => {
    const decision = resolveLegacyAttributionRepair({
      hasExactAmount: false,
      hasDecimalAmount: false,
      entryAmount: '123.45',
      decimals: 18,
      pendingLots: [{
        id: 'lot-1',
        positionId: 'pos-1',
        userId: 'u-1',
        chainId: 8453,
        tokenAddress: '0xtoken',
        entryTxHash: '0xtx',
        expectedAmountRaw: '1000000000000000000',
        status: 'armed',
      }],
    });

    assert.equal(decision.shouldRepair, true);
    assert.equal(decision.source, 'pending_lot_expected_raw');
    assert.equal(decision.repairedExactAmount, '1.0');
  });

  test('falls back to position entry amount text when no stronger source exists', () => {
    const decision = resolveLegacyAttributionRepair({
      hasExactAmount: false,
      hasDecimalAmount: false,
      entryAmount: '0.0015195066668355008',
      decimals: 18,
      pendingLots: [],
    });

    assert.equal(decision.shouldRepair, true);
    assert.equal(decision.source, 'position_entry_amount');
    assert.equal(decision.repairedExactAmount, '0.0015195066668355');
  });

  test('still repairs from entry amount text when decimal attribution is zero-like', () => {
    const decision = resolveLegacyAttributionRepair({
      hasExactAmount: false,
      hasDecimalAmount: false,
      entryAmount: '0.0015195066668355008',
      decimals: 18,
      pendingLots: [],
    });

    assert.equal(decision.shouldRepair, true);
    assert.equal(decision.reasonCode, 'repair_from_position_entry_amount');
    assert.equal(decision.repairedExactAmount, '0.0015195066668355');
  });
});
