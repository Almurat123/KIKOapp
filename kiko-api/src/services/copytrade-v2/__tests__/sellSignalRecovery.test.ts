import assert from 'node:assert/strict';
import test from 'node:test';

import { handleTargetSell } from '../runtime/legacyCopytradeBuyRuntime.js';
import { resolveLatestTargetSellSignal } from '../positions/positionLedgerResolver.js';

test('mirror sell persists durable target-sell event even when no positions are currently reconcilable', async () => {
  const persisted: any[] = [];

  await handleTargetSell(
    {
      targetWallet: '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD',
      chainId: 56,
      swap: {
        txHash: '0xselltx',
        tokenIn: '0x9999999999999999999999999999999999999999',
      },
    },
    {
      normalizeAddress(value: string) {
        return String(value || '').toLowerCase();
      },
      logger: {
        info() {},
        warn() {},
      },
      LogCode: {
        EXE_QUOTE_FETCHED: 'EXE_QUOTE_FETCHED',
        EXE_TX_BROADCAST: 'EXE_TX_BROADCAST',
        WTC_TX_SKIPPED: 'WTC_TX_SKIPPED',
        API_FETCH_FAILED: 'API_FETCH_FAILED',
        SYS_ERROR: 'SYS_ERROR',
      },
      withRetry<T>(fn: () => Promise<T>) {
        return fn();
      },
      prisma: {
        copyTradeConfig: {
          async findMany() {
            return [{
              id: 'config-1',
              userId: 'user-1',
              targetWallet: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
              chainId: 56,
              status: 'active',
              mirrorSell: true,
            }];
          },
        },
        user: {
          async findMany() {
            return [{
              privyDid: 'user-1',
              walletAddress: '0x1111111111111111111111111111111111111111',
            }];
          },
        },
        position: {
          async findMany() {
            return [];
          },
        },
        copytradePositionLedger: {
          async findMany() {
            return [];
          },
        },
        pendingAttributedPosition: {
          async findMany() {
            return [];
          },
        },
      },
      filterExecutableCopyTradeConfigs(configs: any[]) {
        return configs;
      },
      dedupeConfigsByUser(configs: any[]) {
        return configs;
      },
      upsertTargetSellEvent(event: any) {
        persisted.push(event);
        return Promise.resolve(event);
      },
      async listActiveCanonicalOrders() {
        return [];
      },
      async advanceCanonicalOrderState() {
        return null;
      },
      async armPendingAttributedPositionsForMirrorSell() {
        return 0;
      },
      recordNewTrade() {},
    },
  );

  assert.equal(persisted.length, 1);
  assert.equal(persisted[0]?.targetSellTxHash, '0xselltx');
  assert.equal(persisted[0]?.targetWallet, '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
  assert.equal(persisted[0]?.source, 'webhook');
});

test('mirror sell schedules canonical exit intents instead of executing immediate exits', async () => {
  const scheduled: any[] = [];
  let executed = 0;

  await handleTargetSell(
    {
      targetWallet: '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD',
      chainId: 56,
      swap: {
        txHash: '0xselltx',
        tokenIn: '0x9999999999999999999999999999999999999999',
      },
    },
    {
      normalizeAddress(value: string) {
        return String(value || '').toLowerCase();
      },
      logger: {
        info() {},
        warn() {},
      },
      LogCode: {
        EXE_QUOTE_FETCHED: 'EXE_QUOTE_FETCHED',
        EXE_TX_BROADCAST: 'EXE_TX_BROADCAST',
        WTC_TX_SKIPPED: 'WTC_TX_SKIPPED',
        API_FETCH_FAILED: 'API_FETCH_FAILED',
        SYS_ERROR: 'SYS_ERROR',
      },
      withRetry<T>(fn: () => Promise<T>) {
        return fn();
      },
      prisma: {
        copyTradeConfig: {
          async findMany() {
            return [{
              id: 'config-1',
              userId: 'user-1',
              targetWallet: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
              chainId: 56,
              status: 'active',
              mirrorSell: true,
            }];
          },
        },
        user: {
          async findMany() {
            return [{
              privyDid: 'user-1',
              walletAddress: '0x1111111111111111111111111111111111111111',
            }];
          },
        },
        position: {
          async findMany() {
            return [{
              id: 'pos-1',
              userId: 'user-1',
              configId: 'config-1',
              chainId: 56,
              tokenAddress: '0x9999999999999999999999999999999999999999',
              entryAmountExact: '100',
              entryAmountDec: '0.0000000000000001',
              status: 'open',
              leaderTxHash: '0xbuytx',
              entryUsdValue: 12,
            }];
          },
        },
        copytradePositionLedger: {
          async findMany() {
            return [{ positionIdLegacy: 'pos-1' }];
          },
        },
        pendingAttributedPosition: {
          async findMany() {
            return [];
          },
        },
      },
      filterExecutableCopyTradeConfigs(configs: any[]) {
        return configs;
      },
      dedupeConfigsByUser(configs: any[]) {
        return configs;
      },
      upsertTargetSellEvent(event: any) {
        return Promise.resolve({ id: 'evt-1', ...event });
      },
      async listActiveCanonicalOrders() {
        return [];
      },
      async advanceCanonicalOrderState() {
        return null;
      },
      buildTargetSellEventPayload(event: any) {
        return event;
      },
      persistTargetSellEventAndSchedulePositions(payload: any) {
        scheduled.push(payload);
        return Promise.resolve({ event: payload.event, scheduled: payload.positions.length, skipped: 0 });
      },
      async armPendingAttributedPositionsForMirrorSell() {
        return 0;
      },
      recordNewTrade() {},
      async executePositionExit() {
        executed += 1;
        return null;
      },
    },
  );

  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0]?.positions?.length, 1);
  assert.equal(executed, 0);
});

test('mirror sell resolves pending follower exposure without preexisting ledger rows', async () => {
  const scheduled: any[] = [];
  const synced: any[] = [];
  const warnings: any[] = [];

  await handleTargetSell(
    {
      targetWallet: '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD',
      chainId: 56,
      swap: {
        txHash: '0xselltx',
        tokenIn: '0x9999999999999999999999999999999999999999',
      },
    },
    {
      normalizeAddress(value: string) {
        return String(value || '').toLowerCase();
      },
      logger: {
        info() {},
        warn(_code: any, _message: any, payload: any) {
          warnings.push(payload);
        },
      },
      LogCode: {
        EXE_QUOTE_FETCHED: 'EXE_QUOTE_FETCHED',
        EXE_TX_BROADCAST: 'EXE_TX_BROADCAST',
        WTC_TX_SKIPPED: 'WTC_TX_SKIPPED',
        API_FETCH_FAILED: 'API_FETCH_FAILED',
        SYS_ERROR: 'SYS_ERROR',
        SYS_INFO: 'SYS_INFO',
      },
      withRetry<T>(fn: () => Promise<T>) {
        return fn();
      },
      prisma: {
        copyTradeConfig: {
          async findMany() {
            return [{
              id: 'config-1',
              userId: 'user-1',
              targetWallet: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
              chainId: 56,
              status: 'active',
              mirrorSell: true,
            }];
          },
        },
        user: {
          async findMany() {
            return [{
              privyDid: 'user-1',
              walletAddress: '0x1111111111111111111111111111111111111111',
            }];
          },
        },
        position: {
          async findMany(args: any) {
            if (args?.where?.status?.in?.includes('pending_broadcast')) {
              return [{
                id: 'pos-1',
                userId: 'user-1',
                configId: 'config-1',
                chainId: 56,
                tokenAddress: '0x9999999999999999999999999999999999999999',
                entryAmountExact: '100',
                entryAmountDec: '0.0000000000000001',
                entryTxHash: '0xbuytx',
                status: 'pending_broadcast',
                leaderTxHash: '0xbuytx',
                entryUsdValue: 12,
              }];
            }
            return [];
          },
        },
        copytradePositionLedger: {
          async findMany() {
            return [];
          },
        },
        pendingAttributedPosition: {
          async findMany() {
            return [];
          },
        },
      },
      filterExecutableCopyTradeConfigs(configs: any[]) {
        return configs;
      },
      dedupeConfigsByUser(configs: any[]) {
        return configs;
      },
      upsertTargetSellEvent(event: any) {
        return Promise.resolve({ id: 'evt-1', ...event });
      },
      async listActiveCanonicalOrders() {
        return [];
      },
      async advanceCanonicalOrderState() {
        return null;
      },
      buildTargetSellEventPayload(event: any) {
        return event;
      },
      persistTargetSellEventAndSchedulePositions(payload: any) {
        scheduled.push(payload);
        return Promise.resolve({ event: payload.event, scheduled: payload.positions.length, skipped: 0 });
      },
      syncCopytradeLedgerFromLegacy(payload: any) {
        synced.push(payload);
        return Promise.resolve(null);
      },
      async armPendingAttributedPositionsForMirrorSell() {
        return 0;
      },
      recordNewTrade() {},
    },
  );

  assert.equal(synced.length, 1);
  assert.equal(synced[0]?.positionId, 'pos-1');
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0]?.metadata?.executionPolicyReasonCode, 'MIRROR_SELL_EXPOSURE_RESOLVED_FROM_PENDING_POSITION');
  assert.equal(scheduled[0]?.positions?.[0]?.id, 'pos-1');
  assert.equal(warnings[0]?.reasonCode, 'MIRROR_SELL_EXPOSURE_RESOLVED_FROM_PENDING_POSITION');
});

test('mirror sell resolves exposure from pending attribution when ledger is empty', async () => {
  const scheduled: any[] = [];
  const warnings: any[] = [];

  await handleTargetSell(
    {
      targetWallet: '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD',
      chainId: 56,
      swap: {
        txHash: '0xselltx',
        tokenIn: '0x9999999999999999999999999999999999999999',
      },
    },
    {
      normalizeAddress(value: string) {
        return String(value || '').toLowerCase();
      },
      logger: {
        info() {},
        warn(_code: any, _message: any, payload: any) {
          warnings.push(payload);
        },
      },
      LogCode: {
        EXE_QUOTE_FETCHED: 'EXE_QUOTE_FETCHED',
        EXE_TX_BROADCAST: 'EXE_TX_BROADCAST',
        WTC_TX_SKIPPED: 'WTC_TX_SKIPPED',
        API_FETCH_FAILED: 'API_FETCH_FAILED',
        SYS_ERROR: 'SYS_ERROR',
        SYS_INFO: 'SYS_INFO',
      },
      withRetry<T>(fn: () => Promise<T>) {
        return fn();
      },
      prisma: {
        copyTradeConfig: {
          async findMany() {
            return [{
              id: 'config-1',
              userId: 'user-1',
              targetWallet: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
              chainId: 56,
              status: 'active',
              mirrorSell: true,
            }];
          },
        },
        user: {
          async findMany() {
            return [{
              privyDid: 'user-1',
              walletAddress: '0x1111111111111111111111111111111111111111',
            }];
          },
        },
        position: {
          async findMany() {
            return [{
              id: 'pos-1',
              userId: 'user-1',
              configId: 'config-1',
              chainId: 56,
              tokenAddress: '0x9999999999999999999999999999999999999999',
              entryAmountExact: '100',
              entryAmountDec: '0.0000000000000001',
              entryTxHash: '0xbuytx',
              status: 'pending_broadcast',
              leaderTxHash: '0xbuytx',
              entryUsdValue: 12,
            }];
          },
        },
        copytradePositionLedger: {
          async findMany() {
            return [];
          },
        },
        pendingAttributedPosition: {
          async findMany() {
            return [{
              id: 'lot-1',
              positionId: 'pos-1',
              userId: 'user-1',
              chainId: 56,
              tokenAddress: '0x9999999999999999999999999999999999999999',
              entryTxHash: '0xbuytx',
              leaderBuyTxHash: '0xbuytx',
              status: 'armed',
            }];
          },
        },
      },
      filterExecutableCopyTradeConfigs(configs: any[]) {
        return configs;
      },
      dedupeConfigsByUser(configs: any[]) {
        return configs;
      },
      upsertTargetSellEvent(event: any) {
        return Promise.resolve({ id: 'evt-1', ...event });
      },
      async listActiveCanonicalOrders() {
        return [];
      },
      async advanceCanonicalOrderState() {
        return null;
      },
      buildTargetSellEventPayload(event: any) {
        return event;
      },
      persistTargetSellEventAndSchedulePositions(payload: any) {
        scheduled.push(payload);
        return Promise.resolve({ event: payload.event, scheduled: payload.positions.length, skipped: 0 });
      },
      syncCopytradeLedgerFromLegacy() {
        return Promise.resolve(null);
      },
      async armPendingAttributedPositionsForMirrorSell() {
        return 1;
      },
      recordNewTrade() {},
    },
  );

  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0]?.metadata?.executionPolicyReasonCode, 'MIRROR_SELL_EXPOSURE_RESOLVED_FROM_PENDING_ATTRIBUTION');
  assert.equal(warnings[0]?.reasonCode, 'MIRROR_SELL_EXPOSURE_RESOLVED_FROM_PENDING_ATTRIBUTION');
});

test('mirror sell still skips when no exposure exists anywhere', async () => {
  const infos: Array<{ message: string; payload: any }> = [];

  await handleTargetSell(
    {
      targetWallet: '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD',
      chainId: 56,
      swap: {
        txHash: '0xselltx',
        tokenIn: '0x9999999999999999999999999999999999999999',
      },
    },
    {
      normalizeAddress(value: string) {
        return String(value || '').toLowerCase();
      },
      logger: {
        info(_code: any, message: string, payload: any) {
          infos.push({ message, payload });
        },
        warn() {},
      },
      LogCode: {
        EXE_QUOTE_FETCHED: 'EXE_QUOTE_FETCHED',
        EXE_TX_BROADCAST: 'EXE_TX_BROADCAST',
        WTC_TX_SKIPPED: 'WTC_TX_SKIPPED',
        API_FETCH_FAILED: 'API_FETCH_FAILED',
        SYS_ERROR: 'SYS_ERROR',
        SYS_INFO: 'SYS_INFO',
      },
      withRetry<T>(fn: () => Promise<T>) {
        return fn();
      },
      prisma: {
        copyTradeConfig: {
          async findMany() {
            return [{
              id: 'config-1',
              userId: 'user-1',
              targetWallet: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
              chainId: 56,
              status: 'active',
              mirrorSell: true,
            }];
          },
        },
        user: {
          async findMany() {
            return [{
              privyDid: 'user-1',
              walletAddress: '0x1111111111111111111111111111111111111111',
            }];
          },
        },
        position: {
          async findMany() {
            return [];
          },
        },
        copytradePositionLedger: {
          async findMany() {
            return [];
          },
        },
        pendingAttributedPosition: {
          async findMany() {
            return [];
          },
        },
      },
      filterExecutableCopyTradeConfigs(configs: any[]) {
        return configs;
      },
      dedupeConfigsByUser(configs: any[]) {
        return configs;
      },
      upsertTargetSellEvent(event: any) {
        return Promise.resolve({ id: 'evt-1', ...event });
      },
      async listActiveCanonicalOrders() {
        return [];
      },
      async advanceCanonicalOrderState() {
        return null;
      },
      async armPendingAttributedPositionsForMirrorSell() {
        return 0;
      },
      recordNewTrade() {},
    },
  );

  const skip = infos.find((entry) => entry.message === 'Mirror sell skipped: no ledger-backed follower exposure for target sell');
  assert.ok(skip);
  assert.equal(skip?.payload?.reasonCode, 'MIRROR_SELL_NO_LEDGER_CANDIDATES');
});

test('latest target sell signal falls back to persisted event when wallet history linkage is absent', () => {
  const resolved = resolveLatestTargetSellSignal({
    linkedSell: {
      txHash: null,
      blockTimestamp: null,
    },
    persistedSellEvent: {
      id: 'evt-1',
      chainId: 56,
      targetWallet: '0xwallet',
      tokenAddress: '0xtoken',
      targetSellTxHash: '0xfallback',
      targetSellRatioBps: null,
      targetFullExitVerified: false,
      targetRemainingBalanceRaw: null,
      detectedAt: new Date('2026-03-11T09:18:00.000Z'),
      source: 'webhook',
      metadata: null,
    },
  });

  assert.equal(resolved.txHash, '0xfallback');
  assert.equal(resolved.source, 'persisted_event');
});

test('latest target sell signal keeps linked wallet history when it already exists', () => {
  const resolved = resolveLatestTargetSellSignal({
    linkedSell: {
      txHash: '0xhistory',
      blockTimestamp: new Date('2026-03-11T09:17:00.000Z'),
    },
    persistedSellEvent: {
      id: 'evt-1',
      chainId: 56,
      targetWallet: '0xwallet',
      tokenAddress: '0xtoken',
      targetSellTxHash: '0xfallback',
      targetSellRatioBps: null,
      targetFullExitVerified: false,
      targetRemainingBalanceRaw: null,
      detectedAt: new Date('2026-03-11T09:18:00.000Z'),
      source: 'webhook',
      metadata: null,
    },
  });

  assert.equal(resolved.txHash, '0xhistory');
  assert.equal(resolved.source, 'linked_history');
});
