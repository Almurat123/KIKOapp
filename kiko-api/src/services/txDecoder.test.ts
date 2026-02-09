import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSwapTransaction } from './txDecoder.js';

const TRANSFER_EVENT = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const V3_SWAP_EVENT = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';

function topicAddress(address: string): string {
    return `0x${'0'.repeat(24)}${address.slice(2).toLowerCase()}`;
}

function amountData(amount: bigint): string {
    return `0x${amount.toString(16).padStart(64, '0')}`;
}

function transferLog(token: string, from: string, to: string, amount: bigint) {
    return {
        address: token,
        topics: [TRANSFER_EVENT, topicAddress(from), topicAddress(to)],
        data: amountData(amount),
    };
}

test('parseSwapTransaction rejects transfer-only tx with no swap evidence', async () => {
    const wallet = '0xffed8b8c00000000000000000000000000000000';
    const token = '0x96f7c8b7c8e0c4e8e2982f0e79969a0267a1848b';
    const pool = '0x1111111111111111111111111111111111111111';

    const swap = await parseSwapTransaction(
        {
            hash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            from: wallet,
            to: '0x2222222222222222222222222222222222222222',
            input: '0x',
            value: '0xde0b6b3a7640000',
        },
        {
            logs: [transferLog(token, pool, wallet, 395n)],
            status: 1,
        },
        8453,
        wallet
    );

    assert.equal(swap, null);
});

test('parseSwapTransaction rejects transfer-only tx on BSC (no swap evidence)', async () => {
    const wallet = '0xb4beddf100000000000000000000000000000000';
    const token = '0x198df3579014b8d44f1415510665045c6043ea11';
    const poolLikeAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    const swap = await parseSwapTransaction(
        {
            hash: '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
            from: wallet,
            to: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            input: '0x',
            value: '0x2386f26fc10000', // 0.01 BNB
        },
        {
            logs: [transferLog(token, poolLikeAddress, wallet, 12345n)],
            status: 1,
        },
        56,
        wallet
    );

    assert.equal(swap, null);
});

test('parseSwapTransaction accepts swap when pool swap event exists', async () => {
    const wallet = '0xffed8b8c00000000000000000000000000000000';
    const tokenIn = '0x3333333333333333333333333333333333333333';
    const tokenOut = '0x4444444444444444444444444444444444444444';
    const pool = '0x5555555555555555555555555555555555555555';

    const swap = await parseSwapTransaction(
        {
            hash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            from: wallet,
            to: '0x6666666666666666666666666666666666666666',
            input: '0x',
            value: '0x0',
        },
        {
            logs: [
                { address: pool, topics: [V3_SWAP_EVENT], data: '0x' },
                transferLog(tokenIn, wallet, pool, 100n),
                transferLog(tokenOut, pool, wallet, 50n),
            ],
            status: 1,
        },
        8453,
        wallet
    );

    assert.ok(swap);
    assert.equal(swap?.tokenIn, tokenIn.toLowerCase());
    assert.equal(swap?.tokenOut, tokenOut.toLowerCase());
});

test('parseSwapTransaction accepts known router + known swap selector evidence', async () => {
    const wallet = '0xffed8b8c00000000000000000000000000000000';
    const tokenIn = '0x7777777777777777777777777777777777777777';
    const tokenOut = '0x8888888888888888888888888888888888888888';
    const router = '0x2626664c2603336e57b271c5c0b26f421741e481'; // Base Uniswap V3 router
    const pool = '0x9999999999999999999999999999999999999999';

    const swap = await parseSwapTransaction(
        {
            hash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
            from: wallet,
            to: router,
            input: '0x414bf389',
            value: '0x0',
        },
        {
            logs: [
                transferLog(tokenIn, wallet, pool, 123n),
                transferLog(tokenOut, pool, wallet, 77n),
            ],
            status: 1,
        },
        8453,
        wallet
    );

    assert.ok(swap);
    assert.equal(swap?.tokenIn, tokenIn.toLowerCase());
    assert.equal(swap?.tokenOut, tokenOut.toLowerCase());
});
