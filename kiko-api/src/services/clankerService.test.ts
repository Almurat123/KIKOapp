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
            maxFee: 4.5,
        },
    }, {
        confirmDeploy: false,
    });

    assert.equal(result.success, true);
    assert.equal(result.dryRun, true);
    const payload = requirePayload(result);
    assert.equal(payload.pool?.pairedToken, WETH_ADDRESSES[8453]);
    assert.equal(payload.fees?.maxLpFee, 4.5);
    assert.equal(payload.fees?.baseFee, 0.5);
    assert.equal(payload.devBuy?.ethAmount, 0.25);
    assert.ok(!('maxFee' in (payload.fees || {})));
});

test('deployClankerToken dry run uses percentage fee units that match Clanker v4 docs', async () => {
    const result = await deployClankerToken({
        name: 'Fee Unit Token',
        symbol: 'FEE',
        tokenAdmin: '0x0000000000000000000000000000000000000001',
    }, {
        confirmDeploy: false,
    });

    const payload = requirePayload(result);
    assert.deepEqual(payload.fees, {
        type: 'static',
        clankerFee: 1,
        pairedFee: 1,
    });
});

test('deployClankerToken omits Clanker social context for ordinary web launches', async () => {
    const result = await deployClankerToken({
        name: 'Web Token',
        symbol: 'WEB',
        tokenAdmin: '0x0000000000000000000000000000000000000001',
    }, {
        confirmDeploy: false,
    });

    const payload = requirePayload(result);
    assert.equal('context' in payload, false);
});

test('deployClankerToken includes social context only when platform message and user ids are complete', async () => {
    const result = await deployClankerToken({
        name: 'Farcaster Token',
        symbol: 'FCAST',
        tokenAdmin: '0x0000000000000000000000000000000000000001',
        context: {
            interface: 'KiKo Agent',
            platform: 'farcaster',
            messageId: '0xcast',
            id: '1576616',
        },
    }, {
        confirmDeploy: false,
    });

    const payload = requirePayload(result);
    assert.deepEqual(payload.context, {
        interface: 'KiKo Agent',
        platform: 'farcaster',
        messageId: '0xcast',
        id: '1576616',
    });
});

test('deployClankerToken drops incomplete social context instead of sending undefined fields', async () => {
    const result = await deployClankerToken({
        name: 'Incomplete Context Token',
        symbol: 'ICT',
        tokenAdmin: '0x0000000000000000000000000000000000000001',
        context: {
            interface: 'KiKo Agent',
            platform: 'farcaster',
        },
    }, {
        confirmDeploy: false,
    });

    const payload = requirePayload(result);
    assert.equal('context' in payload, false);
});

test('deployClankerToken dry run uses documented 0.5% to 5% defaults for generic dynamic fees', async () => {
    const result = await deployClankerToken({
        name: 'Dynamic Default Token',
        symbol: 'DDT',
        tokenAdmin: '0x0000000000000000000000000000000000000001',
        fees: {
            type: 'dynamic',
        },
    }, {
        confirmDeploy: false,
    });

    const payload = requirePayload(result);
    assert.deepEqual(payload.fees, {
        type: 'dynamic',
        baseFee: 0.5,
        maxLpFee: 5,
        referenceTickFilterPeriod: 30,
        resetPeriod: 120,
        resetTickFilter: 200,
        feeControlNumerator: 500000000,
        decayFilterBps: 7500,
    });
});

test('deployClankerToken rejects non-Base deploy chains in the current product path', async () => {
    await assert.rejects(
        () => deployClankerToken({
            name: 'Alt Token',
            symbol: 'ALT',
            chainId: 130,
            tokenAdmin: '0x0000000000000000000000000000000000000001',
        }, {
            confirmDeploy: false,
        }),
        /Unsupported Clanker deploy chainId: 130/,
    );
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

test('deployClankerToken surfaces Clanker validation details from 400 responses', async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.CLANKER_API_KEY;

    process.env.CLANKER_API_KEY = 'test-api-key';

    globalThis.fetch = (async () => new Response(JSON.stringify({
        error: 'Invalid input. See data for details.',
        data: [
            {
                path: ['fees', 'clankerFee'],
                message: 'Fee percentage must be less than or equal to 5',
            },
        ],
    }), {
        status: 400,
        headers: {
            'content-type': 'application/json',
        },
    })) as typeof fetch;

    try {
        await assert.rejects(
            () => deployClankerToken({
                name: 'Broken Token',
                symbol: 'BROKE',
                tokenAdmin: '0x0000000000000000000000000000000000000001',
            }, {
                confirmDeploy: true,
            }),
            /fees\.clankerFee: Fee percentage must be less than or equal to 5/,
        );
    } finally {
        globalThis.fetch = originalFetch;
        if (originalApiKey === undefined) {
            delete process.env.CLANKER_API_KEY;
        } else {
            process.env.CLANKER_API_KEY = originalApiKey;
        }
    }
});
