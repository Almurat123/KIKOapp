import assert from 'node:assert/strict';
import test from 'node:test';

import { CreateCopyTradeConfigTool } from './copyTradeTools.js';

test('create_copy_trade_config returns existing active config for duplicate user chain target without creating another row', async () => {
    const targetWallet = '0xbd708164137146ac234aceb75d3981cd3599e21a';
    const existing = {
        id: 'cfg-existing',
        targetWallet,
        chainId: 56,
        buyAmountUsd: 8,
        status: 'active',
        createdAt: new Date('2026-04-13T00:00:00.000Z'),
        configPayload: null,
    };
    const calls: string[] = [];
    const prisma = (await import('../../../db/prisma.js')).default as any;
    const original = {
        findFirst: prisma.copyTradeConfig.findFirst,
        create: prisma.copyTradeConfig.create,
        findUnique: prisma.user.findUnique,
        upsert: prisma.trackedWallet.upsert,
        executeRawUnsafe: prisma.$executeRawUnsafe,
    };
    prisma.copyTradeConfig.findFirst = async () => {
        calls.push('copyTradeConfig.findFirst');
        return existing;
    };
    prisma.copyTradeConfig.create = async () => {
        calls.push('copyTradeConfig.create');
        throw new Error('duplicate path should not create');
    };
    prisma.user.findUnique = async () => ({ privyDid: 'did:privy:test', walletAddress: '0xwallet' });
    prisma.trackedWallet.upsert = async () => {
        calls.push('trackedWallet.upsert');
        throw new Error('duplicate path should not update tracked wallet counts');
    };
    prisma.$executeRawUnsafe = async () => {
        calls.push('copyTradeWalletAudit.insert');
        return 1;
    };

    try {
        const result: any = await CreateCopyTradeConfigTool.handler({
            target_wallet: targetWallet,
            buy_amount_usd: 8,
            chain_id: 56,
        }, {
            userId: 'did:privy:test',
        } as any);

        assert.equal(result.id, 'cfg-existing');
        assert.equal(result.alreadyExists, true);
        assert.equal(result.targetWallet, targetWallet);
        assert.deepEqual(calls, ['copyTradeConfig.findFirst', 'copyTradeWalletAudit.insert']);
    } finally {
        prisma.copyTradeConfig.findFirst = original.findFirst;
        prisma.copyTradeConfig.create = original.create;
        prisma.user.findUnique = original.findUnique;
        prisma.trackedWallet.upsert = original.upsert;
        prisma.$executeRawUnsafe = original.executeRawUnsafe;
    }
});

test('create_copy_trade_config converts database unique races into existing config response', async () => {
    const targetWallet = 'So11111111111111111111111111111111111111112';
    const existing = {
        id: 'cfg-raced',
        targetWallet,
        chainId: 900,
        buyAmountUsd: 8,
        status: 'active',
        createdAt: new Date('2026-04-13T00:00:00.000Z'),
        configPayload: null,
    };
    const calls: string[] = [];
    const prisma = (await import('../../../db/prisma.js')).default as any;
    const original = {
        findFirst: prisma.copyTradeConfig.findFirst,
        create: prisma.copyTradeConfig.create,
        findUnique: prisma.user.findUnique,
        upsert: prisma.trackedWallet.upsert,
        executeRawUnsafe: prisma.$executeRawUnsafe,
    };
    let findFirstCount = 0;
    prisma.copyTradeConfig.findFirst = async () => {
        calls.push('copyTradeConfig.findFirst');
        findFirstCount += 1;
        return findFirstCount === 1 ? null : existing;
    };
    prisma.copyTradeConfig.create = async () => {
        calls.push('copyTradeConfig.create');
        const error: any = new Error('Unique constraint failed');
        error.code = 'P2002';
        throw error;
    };
    prisma.user.findUnique = async () => ({ privyDid: 'did:privy:test', walletAddress: '0x9aef1e321ea673d0b2ba929de0760ac8a1238ba3' });
    prisma.trackedWallet.upsert = async () => {
        calls.push('trackedWallet.upsert');
        throw new Error('raced duplicate should not update tracked wallet counts');
    };
    prisma.$executeRawUnsafe = async () => {
        calls.push('copyTradeWalletAudit.insert');
        return 1;
    };

    try {
        const result: any = await CreateCopyTradeConfigTool.handler({
            target_wallet: targetWallet,
            buy_amount_usd: 8,
            chain_id: 900,
        }, {
            userId: 'did:privy:test',
        } as any);

        assert.equal(result.id, 'cfg-raced');
        assert.equal(result.alreadyExists, true);
        assert.equal(result.targetWallet, targetWallet);
        assert.deepEqual(calls, [
            'copyTradeConfig.findFirst',
            'copyTradeConfig.create',
            'copyTradeConfig.findFirst',
            'copyTradeWalletAudit.insert',
        ]);
    } finally {
        prisma.copyTradeConfig.findFirst = original.findFirst;
        prisma.copyTradeConfig.create = original.create;
        prisma.user.findUnique = original.findUnique;
        prisma.trackedWallet.upsert = original.upsert;
        prisma.$executeRawUnsafe = original.executeRawUnsafe;
    }
});
