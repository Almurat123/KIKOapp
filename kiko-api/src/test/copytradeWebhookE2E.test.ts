import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyRawBody from 'fastify-raw-body';

import prisma from '../db/prisma.js';
import { env } from '../config/env.js';
import webhookRoutes from '../routes/webhook.js';
import { refreshTrackedWalletSnapshot } from '../services/copytrade/ingress/trackedWalletSnapshot.js';
import { getCopyTradeIngressState } from '../services/copytrade/ingress/copyTradeIngressState.js';
import {
  getCopyTradeTxState,
  markPendingPredecodedSwap,
  markPendingTxHint,
} from '../services/copyTradeTxStateService.js';
import {
  resetCopyTradeQueueForTests,
  setCopyTradeQueueHandlerForTests,
  waitForCopyTradeQueueIdle,
} from '../services/copyTradeQueue.js';
import type { DecodedSwap } from '../services/txDecoder.js';

const BASE_CHAIN_ID = 8453;
const BASE_NETWORK = 'BASE_MAINNET';
const TOKEN_IN = '0x4200000000000000000000000000000000000006';
const TOKEN_OUT = '0xf30bf00edd0c22db54c9274b90d2a4c21fc09b07';
const ROUTER = '0x1111111111111111111111111111111111111111';
const TEST_PREFIX = 'copytrade-webhook-e2e';

type CapturedDispatch = {
  targetWallet: string;
  swap: DecodedSwap;
  chainId: number;
  detectedAt?: number;
};

function makeHex(seed: string, length: number): string {
  return Buffer.from(seed).toString('hex').padEnd(length, '0').slice(0, length);
}

function makeAddress(seed: string): string {
  return `0x${makeHex(seed, 40)}`;
}

function makeTxHash(seed: string): string {
  return `0x${makeHex(seed, 64)}`;
}

function createSwap(txHash: string, kind: 'buy' | 'sell'): DecodedSwap {
  return {
    txHash,
    sourceTxInput: '0x1234',
    sourceTxValue: kind === 'buy' ? '0x16345785d8a0000' : '0x0',
    tokenIn: kind === 'buy' ? TOKEN_IN : TOKEN_OUT,
    tokenOut: kind === 'buy' ? TOKEN_OUT : TOKEN_IN,
    amountIn: kind === 'buy' ? '100000000000000000' : '2500000000000000000000',
    amountOut: kind === 'buy' ? '2500000000000000000000' : '100000000000000000',
    router: ROUTER,
    dexName: 'PancakeSwap V2',
    cashLegHint: {
      cashSpentUsd: kind === 'buy' ? 250 : 0,
      cashReceivedUsd: kind === 'sell' ? 250 : 0,
      inferredTxType: kind === 'buy' ? 'TARGET_BUY' : 'TARGET_SELL',
    },
  };
}

async function waitForCondition(
  label: string,
  predicate: () => Promise<boolean> | boolean,
  timeoutMs = 5_000,
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for ${label} within ${timeoutMs}ms`);
}

async function buildWebhookApp(): Promise<FastifyInstance> {
  process.env.COPYTRADE_DISABLE_WEBHOOK_INBOX_WORKER = 'true';
  const app = Fastify({ logger: false });
  await app.register(fastifyRawBody, {
    global: false,
    encoding: 'utf8',
    runFirst: true,
  });
  await app.register(webhookRoutes);
  await app.ready();
  return app;
}

async function createTrackedFixture(targetWallet: string, seed: string): Promise<{
  userId: string;
  configId: string;
}> {
  const userId = `did:${TEST_PREFIX}:${seed}`;
  const followerWallet = makeAddress(`follower:${seed}`);
  await prisma.user.upsert({
    where: { privyDid: userId },
    update: { walletAddress: followerWallet },
    create: {
      privyDid: userId,
      walletAddress: followerWallet,
    },
  });
  await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  const config = await prisma.copyTradeConfig.create({
    data: {
      userId,
      targetWallet,
      chainId: BASE_CHAIN_ID,
      buyAmountUsd: 100,
      mirrorSell: true,
      executionMode: 'turbo',
    },
  });
  await prisma.trackedWallet.upsert({
    where: {
      address_chainId: {
        address: targetWallet,
        chainId: BASE_CHAIN_ID,
      },
    },
    update: { activeConfigs: 1 },
    create: {
      address: targetWallet,
      chainId: BASE_CHAIN_ID,
      activeConfigs: 1,
    },
  });
  await refreshTrackedWalletSnapshot();
  return { userId, configId: config.id };
}

async function cleanupArtifacts(params: {
  txHashes?: string[];
  targetWallets?: string[];
  userIds?: string[];
  configIds?: string[];
}): Promise<void> {
  const txHashes = params.txHashes || [];
  const targetWallets = params.targetWallets || [];
  const userIds = params.userIds || [];
  const configIds = params.configIds || [];

  if (txHashes.length > 0) {
    await prisma.walletTransaction.deleteMany({
      where: { txHash: { in: txHashes } },
    }).catch(() => undefined);
    for (const txHash of txHashes) {
      await prisma.$executeRawUnsafe(
        'DELETE FROM alchemy_webhook_inbox WHERE tx_hash = $1',
        txHash,
      ).catch(() => undefined);
      await prisma.$executeRawUnsafe(
        'DELETE FROM "Cache" WHERE key LIKE $1',
        `%${txHash.toLowerCase()}%`,
      ).catch(() => undefined);
    }
  }

  if (userIds.length > 0) {
    await prisma.position.deleteMany({
      where: { userId: { in: userIds } },
    }).catch(() => undefined);
    await prisma.copyTradeConfig.deleteMany({
      where: { id: { in: configIds }, userId: { in: userIds } },
    }).catch(() => undefined);
    await prisma.userSettings.deleteMany({
      where: { userId: { in: userIds } },
    }).catch(() => undefined);
    await prisma.user.deleteMany({
      where: { privyDid: { in: userIds } },
    }).catch(() => undefined);
  }

  if (targetWallets.length > 0) {
    await prisma.trackedWallet.deleteMany({
      where: {
        address: { in: targetWallets },
        chainId: BASE_CHAIN_ID,
      },
    }).catch(() => undefined);
  }
}

describe('copytrade webhook E2E', () => {
  let app: FastifyInstance | null = null;
  let captured: CapturedDispatch[] = [];
  let createdTxHashes: string[] = [];
  let createdTargetWallets: string[] = [];
  let createdUserIds: string[] = [];
  let createdConfigIds: string[] = [];

  beforeEach(async () => {
    captured = [];
    createdTxHashes = [];
    createdTargetWallets = [];
    createdUserIds = [];
    createdConfigIds = [];
    resetCopyTradeQueueForTests();
    setCopyTradeQueueHandlerForTests(async (targetWallet, swap, chainId, context) => {
      captured.push({ targetWallet, swap, chainId, detectedAt: context?.detectedAt });
    });
    app = await buildWebhookApp();
  });

  afterEach(async () => {
    await waitForCopyTradeQueueIdle(2_000).catch(() => undefined);
    if (app) await app.close().catch(() => undefined);
    setCopyTradeQueueHandlerForTests(null);
    resetCopyTradeQueueForTests();
    await cleanupArtifacts({
      txHashes: createdTxHashes,
      targetWallets: createdTargetWallets,
      userIds: createdUserIds,
      configIds: createdConfigIds,
    });
  });

  test('internal /process-tx pending-predecoded path writes ingress state and dispatches queue once', async () => {
    const targetWallet = makeAddress('process-target-buy');
    const txHash = makeTxHash('process-buy-tx');
    createdTxHashes.push(txHash);
    const swap = createSwap(txHash, 'buy');

    await markPendingTxHint(BASE_CHAIN_ID, txHash, targetWallet, Date.now() - 500);
    await markPendingPredecodedSwap(BASE_CHAIN_ID, txHash, targetWallet, swap, Date.now() - 400);

    const headers = env.security.internalWebhookSecret
      ? { 'x-internal-secret': env.security.internalWebhookSecret }
      : undefined;
    const response = await app!.inject({
      method: 'POST',
      url: '/process-tx',
      headers,
      payload: {
        wallet: targetWallet,
        txHash,
        network: BASE_NETWORK,
      },
    });

    assert.equal(response.statusCode, 200);
    await waitForCondition('process-tx dispatch', () => captured.length === 1);
    await waitForCopyTradeQueueIdle();

    assert.equal(captured.length, 1);
    assert.equal(captured[0].targetWallet, targetWallet.toLowerCase());
    assert.equal(captured[0].chainId, BASE_CHAIN_ID);
    assert.equal(captured[0].swap.txHash, txHash.toLowerCase());

    const ingress = await getCopyTradeIngressState(BASE_CHAIN_ID, txHash);
    assert.ok(ingress?.firstSeenAt);
    assert.ok(ingress?.swapReadyAt);
    assert.ok(ingress?.executionEnqueuedAt);

    const txState = await getCopyTradeTxState(BASE_CHAIN_ID, txHash);
    assert.equal(txState?.state, 'executed');
  });

  test('internal /process-tx skips when the transaction is already represented by an existing position', async () => {
    const targetWallet = makeAddress('process-target-existing');
    const txHash = makeTxHash('process-existing-position');
    createdTxHashes.push(txHash);
    createdTargetWallets.push(targetWallet.toLowerCase());
    const fixture = await createTrackedFixture(targetWallet.toLowerCase(), 'process-existing');
    createdUserIds.push(fixture.userId);
    createdConfigIds.push(fixture.configId);

    await prisma.position.create({
      data: {
        userId: fixture.userId,
        configId: fixture.configId,
        tokenAddress: TOKEN_OUT,
        chainId: BASE_CHAIN_ID,
        entryPrice: 1,
        entryAmount: '10',
        entryTxHash: txHash.toLowerCase(),
        entryUsdValue: 10,
        status: 'open',
      },
    });

    const headers = env.security.internalWebhookSecret
      ? { 'x-internal-secret': env.security.internalWebhookSecret }
      : undefined;
    const response = await app!.inject({
      method: 'POST',
      url: '/process-tx',
      headers,
      payload: {
        wallet: targetWallet.toLowerCase(),
        txHash,
        network: BASE_NETWORK,
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.skipped, true);
    assert.equal(body.reason, 'already_processed');
    assert.equal(captured.length, 0);
  });

  test('Alchemy webhook fast-lane uses tracked-wallet snapshot, inbox, DB state and queue for BUY swaps', async () => {
    const targetWallet = makeAddress('alchemy-target-buy').toLowerCase();
    const txHash = makeTxHash('alchemy-buy-tx');
    createdTxHashes.push(txHash.toLowerCase());
    createdTargetWallets.push(targetWallet);
    const fixture = await createTrackedFixture(targetWallet, 'alchemy-buy');
    createdUserIds.push(fixture.userId);
    createdConfigIds.push(fixture.configId);
    const swap = createSwap(txHash.toLowerCase(), 'buy');

    await markPendingTxHint(BASE_CHAIN_ID, txHash.toLowerCase(), targetWallet, Date.now() - 300);
    await markPendingPredecodedSwap(BASE_CHAIN_ID, txHash.toLowerCase(), targetWallet, swap, Date.now() - 200, 'pending_prefetch');

    const response = await app!.inject({
      method: 'POST',
      url: '/alchemy',
      payload: {
        type: 'ADDRESS_ACTIVITY',
        event: {
          network: BASE_NETWORK,
          activity: [{
            hash: txHash,
            fromAddress: targetWallet,
            toAddress: ROUTER,
            category: 'token',
            asset: 'ETH',
          }],
        },
      },
    });

    assert.equal(response.statusCode, 200);
    await waitForCondition('alchemy buy dispatch', () => captured.length === 1);
    await waitForCopyTradeQueueIdle();

    assert.equal(captured.length, 1);
    assert.equal(captured[0].targetWallet, targetWallet);
    assert.equal(captured[0].swap.tokenOut, TOKEN_OUT);

    const txState = await getCopyTradeTxState(BASE_CHAIN_ID, txHash);
    assert.equal(txState?.state, 'executed');

    const inboxRows = await prisma.$queryRawUnsafe<Array<{ status: string }>>(
      'SELECT status FROM alchemy_webhook_inbox WHERE tx_hash = $1',
      txHash.toLowerCase(),
    );
    assert.equal(inboxRows.length, 1);
    assert.equal(inboxRows[0].status, 'processed');
  });

  test('Alchemy webhook fast-lane sends SELL swaps through the same webhook -> DB -> queue boundary once', async () => {
    const targetWallet = makeAddress('alchemy-target-sell').toLowerCase();
    const txHash = makeTxHash('alchemy-sell-tx');
    createdTxHashes.push(txHash.toLowerCase());
    createdTargetWallets.push(targetWallet);
    const fixture = await createTrackedFixture(targetWallet, 'alchemy-sell');
    createdUserIds.push(fixture.userId);
    createdConfigIds.push(fixture.configId);
    const swap = createSwap(txHash.toLowerCase(), 'sell');

    await markPendingPredecodedSwap(BASE_CHAIN_ID, txHash.toLowerCase(), targetWallet, swap, Date.now() - 150, 'pending_prefetch');

    const response = await app!.inject({
      method: 'POST',
      url: '/alchemy',
      payload: {
        type: 'ADDRESS_ACTIVITY',
        event: {
          network: BASE_NETWORK,
          activity: [{
            hash: txHash,
            fromAddress: ROUTER,
            toAddress: targetWallet,
            category: 'token',
            asset: 'TOKEN',
            rawContract: { address: TOKEN_OUT },
          }],
        },
      },
    });

    assert.equal(response.statusCode, 200);
    await waitForCondition('alchemy sell dispatch', () => captured.length === 1);
    await waitForCopyTradeQueueIdle();

    assert.equal(captured.length, 1);
    assert.equal(captured[0].targetWallet, targetWallet);
    assert.equal(captured[0].swap.tokenIn, TOKEN_OUT);
    assert.equal(captured[0].swap.cashLegHint?.inferredTxType, 'TARGET_SELL');
  });
});
