import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveExitExecutionContext } from '../services/copytrade/exit/exitContextResolver.js';
import { resolveRetryExitExecutionContext } from '../services/copytrade/exit/exitRetryContextBridge.js';
import { buildEvmExitAttributionSnapshotFromResolvedInputs } from '../services/copytrade/exit/exitAttributionSnapshotBuilder.js';
import { buildEvmExitPlanFromSnapshot } from '../services/copytrade/exit/planner.js';
import type { ExitSnapshotPosition } from '../services/copytrade/exit/exitSnapshotTypes.js';
import type { PendingAttributedPositionLotLike } from '../services/copytrade/positions/pendingAttributedPositionLedger.js';

const TOKEN = '0x6b175474e89094c44da98b954eedeac495271d0f';
const WALLET = '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B';

function createPosition(id: string): ExitSnapshotPosition {
  return {
    id,
    tokenAddress: TOKEN,
    status: 'open',
    entryTxHash: '0xbuy',
    entryAmountExact: null,
    entryAmountDec: null,
  };
}

function createLot(positionId: string): PendingAttributedPositionLotLike {
  return {
    id: `lot:${positionId}`,
    positionId,
    userId: 'user-1',
    chainId: 1,
    tokenAddress: TOKEN,
    entryTxHash: '0xbuy',
    expectedAmountRaw: '9000000000000000000',
    status: 'sell_armed',
    targetSellTxHash: '0xtargetsell',
  };
}

describe('exit context resolver', () => {
  test('retry bridge widens mirror-sell context to include pending attributed lots', async () => {
    const position = createPosition('pos-retry');
    const lot = createLot(position.id);
    const resolved = await resolveRetryExitExecutionContext(
      {
        userId: 'user-1',
        chainId: 1,
        tokenAddress: TOKEN,
        exitReason: 'mirror_sell',
        position,
      },
      {
        async loadPositions() {
          return [position];
        },
        async loadPendingLots() {
          return [lot];
        },
      },
    );

    assert.equal(resolved.positions.length, 1);
    assert.equal(resolved.pendingAttributedLots.length, 1);

    const snapshot = buildEvmExitAttributionSnapshotFromResolvedInputs({
      tokenAddress: TOKEN,
      chainId: 1,
      walletAddress: WALLET,
      exitReason: 'mirror_sell',
      tokenInfo: { price: 1, symbol: 'TEST' },
      decimals: 18,
      onChainBalanceRaw: 9000000000000000000n,
      balanceRead: {
        status: 'success',
        value: 9000000000000000000n,
        reasonCode: 'EXIT_BALANCE_CONFIRMED_POSITIVE',
        attemptCount: 1,
        lastError: null,
        providerSource: 'test',
      },
      positions: resolved.positions,
      pendingLots: resolved.pendingAttributedLots,
    });
    const plan = buildEvmExitPlanFromSnapshot({
      userId: 'user-1',
      tokenAddress: TOKEN,
      chainId: 1,
      exitReason: 'mirror_sell',
      tokenInfo: { price: 1, symbol: 'TEST' },
      universalSlippageBps: 500,
      executionMode: 'turbo',
      targetWallet: '0xtarget',
      snapshot,
    });

    assert.equal(snapshot.attribution.reasonCode, 'PENDING_ATTRIBUTED_AMOUNT_RESOLVED');
    assert.equal(plan.kind, 'swap');
  });

  test('mirror-sell resolver merges canonical positions with supplied positions', async () => {
    const supplied = createPosition('pos-supplied');
    const canonical = createPosition('pos-canonical');
    const resolved = await resolveExitExecutionContext(
      {
        userId: 'user-1',
        chainId: 1,
        tokenAddress: TOKEN.toUpperCase(),
        exitReason: 'mirror_sell',
        positions: [supplied],
      },
      {
        async loadPositions() {
          return [canonical];
        },
        async loadPendingLots() {
          return [];
        },
      },
    );

    assert.equal(resolved.reasonCode, 'EXIT_CONTEXT_MIRROR_SELL_CANONICAL');
    assert.equal(resolved.positions.length, 2);
    assert.deepEqual(
      resolved.positions.map((position) => position.id).sort(),
      ['pos-canonical', 'pos-supplied'],
    );
  });
});
