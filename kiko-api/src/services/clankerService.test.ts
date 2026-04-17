import assert from 'node:assert/strict';
import test from 'node:test';
import { WETH_ADDRESSES } from 'clanker-sdk';

import { deployClankerToken } from './clankerService.js';

function requirePayload(result: Awaited<ReturnType<typeof deployClankerToken>>): Record<string, any> {
    assert.ok(result.payload && typeof result.payload === 'object');
    return result.payload as Record<string, any>;
}

test('deployClankerToken dry run resolves wrapped-native pair and maxLpFee payload fields', async () => {
    const result = await deployClankerToken({
        name: 'Demo Token',
        symbol: 'DEMO',
        tokenAdmin: '0x0000000000000000000000000000000000000001',
        devBuy: {
            ethAmount: 0.25,
        },
        fees: {
            type: 'dynamic',
            maxFee: 450,
        },
    }, {
        confirmDeploy: false,
    });

    assert.equal(result.success, true);
    assert.equal(result.dryRun, true);
    const payload = requirePayload(result);
    assert.equal(payload.pool?.pairedToken, WETH_ADDRESSES[8453]);
    assert.equal(payload.fees?.maxLpFee, 450);
    assert.equal(payload.devBuy?.ethAmount, 0.25);
    assert.ok(!('maxFee' in (payload.fees || {})));
});

test('deployClankerToken dry run preserves chain-neutral context and devBuy route overrides on a non-Base chain', async () => {
    const result = await deployClankerToken({
        name: 'Alt Token',
        symbol: 'ALT',
        chainId: 130,
        tokenAdmin: '0x0000000000000000000000000000000000000001',
        context: {
            interface: 'KiKo Agent',
            platform: 'KiKo',
            messageId: 'msg-130',
            id: 'alt-130',
        },
        devBuy: {
            ethAmount: 0.5,
            amountOutMin: 0.25,
            recipient: '0x0000000000000000000000000000000000000002',
            poolKey: {
                currency0: '0x0000000000000000000000000000000000000003',
                currency1: '0x0000000000000000000000000000000000000004',
                fee: 3000,
                tickSpacing: 60,
                hooks: '0x0000000000000000000000000000000000000005',
            },
        },
    }, {
        confirmDeploy: false,
    });

    assert.equal(result.success, true);
    assert.equal(result.dryRun, true);
    const payload = requirePayload(result);
    assert.equal(payload.chainId, 130);
    assert.equal(payload.pool?.pairedToken, WETH_ADDRESSES[130]);
    assert.equal(payload.context?.interface, 'KiKo Agent');
    assert.equal(payload.context?.platform, 'KiKo');
    assert.equal(payload.devBuy?.ethAmount, 0.5);
    assert.equal(payload.devBuy?.amountOutMin, 0.25);
    assert.equal(payload.devBuy?.recipient, '0x0000000000000000000000000000000000000002');
    assert.equal(payload.devBuy?.poolKey?.currency0, '0x0000000000000000000000000000000000000003');
    assert.equal(payload.devBuy?.poolKey?.currency1, '0x0000000000000000000000000000000000000004');
    assert.equal(payload.devBuy?.poolKey?.fee, 3000);
    assert.equal(payload.devBuy?.poolKey?.tickSpacing, 60);
    assert.equal(payload.devBuy?.poolKey?.hooks, '0x0000000000000000000000000000000000000005');
});

test('deployClankerToken real deploy returns the Clanker token page URL from expectedAddress', async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.CLANKER_API_KEY;
    const expectedAddress = '0x0000000000000000000000000000000000000123';
    let postedBody = '';

    process.env.CLANKER_API_KEY = 'test-api-key';

    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
        postedBody = String(init?.body || '');
        return new Response(JSON.stringify({
            success: true,
            message: `Token deployment enqueued. Expected address: ${expectedAddress}`,
            expectedAddress,
        }), {
            status: 200,
            headers: {
                'content-type': 'application/json',
            },
        });
    }) as typeof fetch;

    try {
        const result = await deployClankerToken({
            name: 'Demo Token',
            symbol: 'DEMO',
            tokenAdmin: '0x0000000000000000000000000000000000000001',
            devBuy: {
                ethAmount: 0.25,
            },
        }, {
            confirmDeploy: true,
        });

        assert.equal(result.success, true);
        assert.equal(result.dryRun, false);
        assert.equal(result.tokenAddress, expectedAddress);
        assert.equal(result.tokenUrl, `https://www.clanker.world/clanker/${expectedAddress}`);
        assert.equal(JSON.parse(postedBody).devBuy.ethAmount, 0.25);
    } finally {
        globalThis.fetch = originalFetch;
        if (originalApiKey === undefined) {
            delete process.env.CLANKER_API_KEY;
        } else {
            process.env.CLANKER_API_KEY = originalApiKey;
        }
    }
});
