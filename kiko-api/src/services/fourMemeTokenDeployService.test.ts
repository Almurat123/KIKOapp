import assert from 'node:assert/strict';
import test from 'node:test';

import { deployFourMemeToken } from './fourMemeTokenDeployService.js';

test('deployFourMemeToken dry run returns a normalized BSC payload', async () => {
    const result = await deployFourMemeToken({
        name: 'Four Demo',
        symbol: 'FDEMO',
        image: 'https://example.com/token.png',
        bnbAmount: 0.15,
    }, {
        confirmDeploy: false,
    });

    assert.equal(result.success, true);
    assert.equal(result.dryRun, true);
    const payload = result.payload as Record<string, any>;
    assert.equal(payload.chainId, 56);
    assert.equal(payload.category, 'Meme');
    assert.equal(payload.tokenManagerAddress, '0x5c952063c7fc8610FFDB798152D69F0B9550762b');
    assert.equal(payload.bnbAmount, 0.15);
    assert.equal('websiteUrl' in payload, false);
    assert.equal('twitterUrl' in payload, false);
    assert.equal('telegramUrl' in payload, false);
});

test('deployFourMemeToken rejects non-BSC chains', async () => {
    await assert.rejects(
        () => deployFourMemeToken({
            name: 'Wrong Chain',
            symbol: 'WC',
            image: 'https://example.com/token.png',
            bnbAmount: 0.1,
            chainId: 8453,
        }, {
            confirmDeploy: false,
        }),
        /only supported on BNB Chain/,
    );
});
