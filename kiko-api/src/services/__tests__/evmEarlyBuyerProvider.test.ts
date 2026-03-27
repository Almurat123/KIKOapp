import assert from 'node:assert/strict';
import test from 'node:test';

import { __clearEvmEarlyBuyerTransferCacheForTests, __testOnly } from '../evmEarlyBuyerProvider.js';
import type { AssetTransfer, WalletTransaction } from '../alchemy.js';

function makeScanTransfer(overrides: Partial<{
  blockNumber: number;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  tokenAddress: string;
  tokenSymbol: string;
  blockTimestamp: Date;
}> = {}): WalletTransaction {
  return {
    blockNumber: overrides.blockNumber ?? 123,
    txHash: overrides.txHash ?? '0xscan',
    txType: 'TRANSFER_IN',
    fromAddress: overrides.fromAddress ?? '0x0000000000000000000000000000000000000001',
    toAddress: overrides.toAddress ?? '0x0000000000000000000000000000000000000002',
    amount: overrides.amount ?? '1000',
    tokenAddress: overrides.tokenAddress ?? '0x1111111111111111111111111111111111111111',
    tokenSymbol: overrides.tokenSymbol ?? 'TEST',
    blockTimestamp: overrides.blockTimestamp ?? new Date('2024-11-15T15:30:11.000Z'),
    valueUsd: null,
    chain: 'bsc',
  };
}

function makeAlchemyTransfer(overrides: Partial<{
  blockNum: string;
  hash: string;
  from: string;
  to: string;
  value: number;
  address: string;
  asset: string;
  blockTimestamp: string;
}> = {}): AssetTransfer {
  return {
    blockNum: overrides.blockNum ?? '0x7b',
    hash: overrides.hash ?? '0xalchemy',
    from: overrides.from ?? '0x0000000000000000000000000000000000000001',
    to: overrides.to ?? '0x0000000000000000000000000000000000000002',
    value: overrides.value ?? 1000,
    asset: overrides.asset ?? 'TEST',
    category: 'erc20',
    rawContract: {
      value: null,
      address: overrides.address ?? '0x1111111111111111111111111111111111111111',
      decimal: null,
    },
    metadata: {
      blockTimestamp: overrides.blockTimestamp ?? '2024-11-15T15:30:11.000Z',
    },
  };
}

test('early buyer provider prefers scan results before alchemy fallback', async () => {
  __clearEvmEarlyBuyerTransferCacheForTests();

  let scanCalls = 0;
  let alchemyCalls = 0;

  const result = await __testOnly.getEvmEarlyBuyerTransfersInternal(
    '0x1111111111111111111111111111111111111111',
    'bsc',
    { limit: 10 },
    {
      getAssetTransfers: async () => {
        alchemyCalls += 1;
        return [makeAlchemyTransfer()];
      },
      getEvmTokenTransfersByContract: async () => {
        scanCalls += 1;
        return [makeScanTransfer()];
      },
      callRpc: async <T>() => ({ number: '0x0', timestamp: '0x0' } as T),
      now: () => Date.now(),
      sleep: async () => undefined,
    }
  );

  assert.equal(result.provider, 'blockscout');
  assert.equal(result.transfers.length, 1);
  assert.equal(scanCalls, 1);
  assert.equal(alchemyCalls, 0);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0]?.provider, 'blockscout');
});

test('early buyer provider falls back to alchemy when scan returns no transfers', async () => {
  __clearEvmEarlyBuyerTransferCacheForTests();

  let scanCalls = 0;
  let alchemyCalls = 0;

  const result = await __testOnly.getEvmEarlyBuyerTransfersInternal(
    '0x1111111111111111111111111111111111111111',
    'bsc',
    { limit: 10 },
    {
      getAssetTransfers: async () => {
        alchemyCalls += 1;
        return [makeAlchemyTransfer()];
      },
      getEvmTokenTransfersByContract: async () => {
        scanCalls += 1;
        return [];
      },
      callRpc: async <T>() => ({ number: '0x0', timestamp: '0x0' } as T),
      now: () => Date.now(),
      sleep: async () => undefined,
    }
  );

  assert.equal(result.provider, 'alchemy');
  assert.equal(result.transfers.length, 1);
  assert.equal(scanCalls, 1);
  assert.equal(alchemyCalls, 1);
  assert.equal(result.diagnostics.length, 2);
  assert.equal(result.diagnostics[0]?.provider, 'blockscout');
  assert.equal(result.diagnostics[1]?.provider, 'alchemy');
});
