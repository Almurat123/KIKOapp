import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import {
  COPYTRADE_INTENT_VERSION,
  assertConfigExecutable,
  computeCopyTradeConfigHash,
  normalizeSignedPayload,
  verifyCopyTradeConfigSignature,
  type CopyTradeSignedPayload,
} from './copyTradeConfigSignatureService.js';
import { AppError } from '../middleware/errorHandler.js';

const DOMAIN = {
  name: 'KiKo CopyTrade Config',
  version: '1',
  chainId: 1,
};

const TYPES = {
  CopyTradeConfigIntentV1: [
    { name: 'version', type: 'string' },
    { name: 'action', type: 'string' },
    { name: 'configId', type: 'string' },
    { name: 'userId', type: 'string' },
    { name: 'signerAddress', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiresAtMs', type: 'uint256' },
    { name: 'chainId', type: 'uint256' },
    { name: 'targetWallet', type: 'string' },
    { name: 'buyAmountUsd', type: 'string' },
    { name: 'maxSlippageBps', type: 'string' },
    { name: 'minMarketCapUsd', type: 'string' },
    { name: 'minLiquidityUsd', type: 'string' },
    { name: 'minTargetValueUsd', type: 'string' },
    { name: 'copyTradeTokenCooldownMinutes', type: 'string' },
    { name: 'executionMode', type: 'string' },
    { name: 'disableTokenInfo', type: 'bool' },
    { name: 'takeProfitPct', type: 'string' },
    { name: 'stopLossPct', type: 'string' },
    { name: 'mirrorSell', type: 'bool' },
    { name: 'aiAnalysisMode', type: 'string' },
    { name: 'enableDynamicTP', type: 'bool' },
    { name: 'dynamicTPMinProfitPct', type: 'string' },
  ],
};

function buildPayload(args: {
  action?: 'create' | 'update';
  configId?: string;
  signerAddress: string;
  userId?: string;
  nonce?: number;
  expiresAtMs?: number;
}): CopyTradeSignedPayload {
  return {
    version: COPYTRADE_INTENT_VERSION,
    action: args.action || 'update',
    configId: args.configId || 'cfg-1',
    userId: args.userId || 'did:privy:test-user',
    signerAddress: args.signerAddress.toLowerCase(),
    nonce: args.nonce || 1,
    expiresAtMs: args.expiresAtMs || Date.now() + 60_000,
    chainId: 8453,
    targetWallet: '0x1111111111111111111111111111111111111111',
    buyAmountUsd: '100',
    maxSlippageBps: '300',
    minMarketCapUsd: '0',
    minLiquidityUsd: '0',
    minTargetValueUsd: '0',
    copyTradeTokenCooldownMinutes: '0',
    executionMode: 'normal',
    disableTokenInfo: false,
    takeProfitPct: '0',
    stopLossPct: '0',
    mirrorSell: true,
    aiAnalysisMode: 'disabled',
    enableDynamicTP: false,
    dynamicTPMinProfitPct: '100',
  };
}

test('verifyCopyTradeConfigSignature accepts valid typed signature', async () => {
  const wallet = Wallet.createRandom();
  const payload = buildPayload({ signerAddress: wallet.address });
  const signature = await wallet.signTypedData(DOMAIN, TYPES, payload);

  const result = verifyCopyTradeConfigSignature({
    signedPayload: payload,
    signature,
    signerAddress: wallet.address,
    userId: payload.userId,
    expectedAction: 'update',
    expectedConfigId: payload.configId,
    currentNonce: 0,
    userWalletAddress: wallet.address,
  });

  assert.equal(result.payload.userId, payload.userId);
  assert.equal(result.configHash, computeCopyTradeConfigHash(payload));
});

test('verifyCopyTradeConfigSignature rejects tampered payload', async () => {
  const wallet = Wallet.createRandom();
  const payload = buildPayload({ signerAddress: wallet.address });
  const signature = await wallet.signTypedData(DOMAIN, TYPES, payload);
  const tampered = { ...payload, buyAmountUsd: '9999' };

  assert.throws(() => {
    verifyCopyTradeConfigSignature({
      signedPayload: tampered,
      signature,
      signerAddress: wallet.address,
      userId: payload.userId,
      expectedAction: 'update',
      expectedConfigId: payload.configId,
      currentNonce: 0,
      userWalletAddress: wallet.address,
    });
  }, (error: unknown) => {
    return error instanceof AppError && error.code === 'SIGNATURE_INVALID';
  });
});

test('verifyCopyTradeConfigSignature rejects stale nonce and expired payload', async () => {
  const wallet = Wallet.createRandom();
  const stalePayload = buildPayload({ signerAddress: wallet.address, nonce: 2 });
  const staleSignature = await wallet.signTypedData(DOMAIN, TYPES, stalePayload);

  assert.throws(() => {
    verifyCopyTradeConfigSignature({
      signedPayload: stalePayload,
      signature: staleSignature,
      signerAddress: wallet.address,
      userId: stalePayload.userId,
      expectedAction: 'update',
      expectedConfigId: stalePayload.configId,
      currentNonce: 0,
      userWalletAddress: wallet.address,
    });
  }, (error: unknown) => {
    return error instanceof AppError && error.code === 'CONFIG_STALE_NONCE';
  });

  const expiredPayload = buildPayload({
    signerAddress: wallet.address,
    expiresAtMs: Date.now() - 1_000,
  });

  assert.throws(() => {
    verifyCopyTradeConfigSignature({
      signedPayload: expiredPayload,
      signature: staleSignature,
      signerAddress: wallet.address,
      userId: expiredPayload.userId,
      expectedAction: 'update',
      expectedConfigId: expiredPayload.configId,
      currentNonce: 0,
      userWalletAddress: wallet.address,
    });
  }, (error: unknown) => {
    return error instanceof AppError && error.code === 'CONFIG_EXPIRED';
  });
});

test('normalizeSignedPayload rejects legacy balanced execution mode', () => {
  const wallet = Wallet.createRandom();
  const payload = buildPayload({ signerAddress: wallet.address }) as any;
  payload.executionMode = 'balanced';
  assert.throws(() => normalizeSignedPayload(payload), (error: unknown) => {
    return error instanceof AppError && error.code === 'SIGNATURE_INVALID';
  });
});

test('assertConfigExecutable rejects direct DB parameter tampering', async () => {
  const wallet = Wallet.createRandom();
  const payload = buildPayload({ signerAddress: wallet.address });
  const signature = await wallet.signTypedData(DOMAIN, TYPES, payload);

  const intact = {
    id: 'cfg-1',
    userId: payload.userId,
    requiresResign: false,
    signatureScheme: 'eip712_v1',
    configPayload: payload,
    configHash: computeCopyTradeConfigHash(payload),
    configSignature: signature,
    signerAddress: wallet.address,
    targetWallet: payload.targetWallet,
    chainId: payload.chainId,
    buyAmountUsd: Number(payload.buyAmountUsd),
    maxSlippageBps: Number(payload.maxSlippageBps),
  };

  const okResult = assertConfigExecutable(intact, wallet.address);
  assert.equal(okResult.ok, true);

  const tampered = {
    ...intact,
    buyAmountUsd: 777,
  };

  const failResult = assertConfigExecutable(tampered, wallet.address);
  assert.equal(failResult.ok, false);
  assert.equal(failResult.reason, 'buy_amount_mismatch');
});

test('assertConfigExecutable allows expired intent after it was already persisted', async () => {
  const wallet = Wallet.createRandom();
  const payload = buildPayload({
    signerAddress: wallet.address,
    expiresAtMs: Date.now() - 10 * 60 * 1000,
  });
  const signature = await wallet.signTypedData(DOMAIN, TYPES, payload);

  const config = {
    id: 'cfg-expired',
    userId: payload.userId,
    requiresResign: false,
    signatureScheme: 'eip712_v1',
    configPayload: payload,
    configHash: computeCopyTradeConfigHash(payload),
    configSignature: signature,
    signerAddress: wallet.address,
    targetWallet: payload.targetWallet,
    chainId: payload.chainId,
    buyAmountUsd: Number(payload.buyAmountUsd),
    maxSlippageBps: Number(payload.maxSlippageBps),
  };

  const result = assertConfigExecutable(config, wallet.address);
  assert.equal(result.ok, true);
});
