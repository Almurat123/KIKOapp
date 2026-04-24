import assert from 'node:assert/strict';
import test from 'node:test';

import { DeployClankerTokenTool } from './clankerTools.js';

function requirePayload(result: any): Record<string, any> {
    assert.equal(result?.success, true);
    assert.equal(result?.dryRun, true);
    assert.ok(result.payload && typeof result.payload === 'object');
    return result.payload as Record<string, any>;
}

test('deploy_clanker_token injects Farcaster provenance only in Farcaster agent mode', async () => {
    const result = await DeployClankerTokenTool.handler({
        name: 'Farcaster Token',
        symbol: 'FCAST',
        tokenAdmin: '0x0000000000000000000000000000000000000001',
        confirmDeploy: false,
    }, {
        userAddress: '0x0000000000000000000000000000000000000001',
        currentPage: 'farcaster',
        pageContext: 'farcaster_agent',
        farcaster: {
            fid: 1576616,
        },
        farcasterAgent: {
            sourceMessageId: '0xabc123cast',
            rootCastHash: '0xrootcast',
        },
        socialInput: {
            platform: 'farcaster',
            currentText: 'deploy token',
            images: [],
        },
    });

    const payload = requirePayload(result);
    assert.deepEqual(payload.context, {
        interface: 'KiKo Agent',
        platform: 'farcaster',
        messageId: '0xabc123cast',
        id: '1576616',
    });
});

test('deploy_clanker_token injects X provenance only in X agent mode', async () => {
    const result = await DeployClankerTokenTool.handler({
        name: 'X Token',
        symbol: 'XT',
        tokenAdmin: '0x0000000000000000000000000000000000000001',
        confirmDeploy: false,
    }, {
        userAddress: '0x0000000000000000000000000000000000000001',
        currentPage: 'x',
        pageContext: 'x_agent',
        x: {
            xUserId: '123456789',
            sourceMessageId: '1888888888888888888',
            rootTweetId: '1777777777777777777',
        },
        socialInput: {
            platform: 'x',
            currentText: 'deploy token',
            images: [],
        },
    });

    const payload = requirePayload(result);
    assert.deepEqual(payload.context, {
        interface: 'KiKo Agent',
        platform: 'x',
        messageId: '1888888888888888888',
        id: '123456789',
    });
});

test('deploy_clanker_token does not inject social context for ordinary web chat', async () => {
    const result = await DeployClankerTokenTool.handler({
        name: 'Web Token',
        symbol: 'WEB',
        tokenAdmin: '0x0000000000000000000000000000000000000001',
        confirmDeploy: false,
    }, {
        userAddress: '0x0000000000000000000000000000000000000001',
        currentPage: 'wallet',
        pageContext: 'web_chat',
    });

    const payload = requirePayload(result);
    assert.equal('context' in payload, false);
});
