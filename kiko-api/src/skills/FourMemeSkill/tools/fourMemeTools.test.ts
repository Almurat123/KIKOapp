import assert from 'node:assert/strict';
import test from 'node:test';

import { DeployFourMemeTokenTool } from './fourMemeTools.js';

function requirePayload(result: any): Record<string, any> {
    assert.equal(result?.success, true);
    assert.equal(result?.dryRun, true);
    assert.ok(result.payload && typeof result.payload === 'object');
    return result.payload as Record<string, any>;
}

test('deploy_fourmeme_token injects source tweet URL in X agent mode', async () => {
    const result = await DeployFourMemeTokenTool.handler({
        name: 'X Meme',
        symbol: 'XM',
        image: 'https://example.com/token.png',
        bnbAmount: 0.1,
        confirmDeploy: false,
    }, {
        currentPage: 'x',
        pageContext: 'x_agent',
        x: {
            xUserId: '123456789',
            sourceMessageId: '1888888888888888888',
        },
        socialInput: {
            platform: 'x',
            currentText: 'deploy token',
            images: [],
        },
    });

    const payload = requirePayload(result);
    assert.equal(payload.twitterUrl, 'https://x.com/i/web/status/1888888888888888888');
});

test('deploy_fourmeme_token does not override an explicit twitterUrl', async () => {
    const result = await DeployFourMemeTokenTool.handler({
        name: 'Explicit X Meme',
        symbol: 'EXM',
        image: 'https://example.com/token.png',
        bnbAmount: 0.1,
        twitterUrl: 'https://x.com/project/status/1',
        confirmDeploy: false,
    }, {
        currentPage: 'x',
        pageContext: 'x_agent',
        x: {
            xUserId: '123456789',
            sourceMessageId: '1888888888888888888',
        },
        socialInput: {
            platform: 'x',
            currentText: 'deploy token',
            images: [],
        },
    });

    const payload = requirePayload(result);
    assert.equal(payload.twitterUrl, 'https://x.com/project/status/1');
});

test('deploy_fourmeme_token does not invent unsupported Farcaster social fields', async () => {
    const result = await DeployFourMemeTokenTool.handler({
        name: 'Farcaster Meme',
        symbol: 'FM',
        image: 'https://example.com/token.png',
        bnbAmount: 0.1,
        confirmDeploy: false,
    }, {
        currentPage: 'farcaster',
        pageContext: 'farcaster_agent',
        farcaster: {
            fid: 1576616,
        },
        farcasterAgent: {
            sourceMessageId: '0xabc123cast',
        },
        socialInput: {
            platform: 'farcaster',
            currentText: 'deploy token',
            images: [],
        },
    });

    const payload = requirePayload(result);
    assert.equal('twitterUrl' in payload, false);
    assert.equal('websiteUrl' in payload, false);
});

test('deploy_fourmeme_token does not inject social links for ordinary web chat', async () => {
    const result = await DeployFourMemeTokenTool.handler({
        name: 'Web Meme',
        symbol: 'WM',
        image: 'https://example.com/token.png',
        bnbAmount: 0.1,
        confirmDeploy: false,
    }, {
        currentPage: 'wallet',
        pageContext: 'web_chat',
    });

    const payload = requirePayload(result);
    assert.equal('twitterUrl' in payload, false);
    assert.equal('websiteUrl' in payload, false);
});
