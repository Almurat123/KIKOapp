import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
    getAlchemyWebhookEnvKeys,
    getAlchemyWebhookId,
    getSupportedAlchemyWebhookChains,
} from '../services/alchemyWebhookConfig.js';

const ORIGINAL_ETH = process.env.ALCHEMY_WEBHOOK_ID_ETH;
const ORIGINAL_ETH_MAINNET = process.env.ALCHEMY_WEBHOOK_ID_ETH_MAINNET;

afterEach(() => {
    if (ORIGINAL_ETH === undefined) delete process.env.ALCHEMY_WEBHOOK_ID_ETH;
    else process.env.ALCHEMY_WEBHOOK_ID_ETH = ORIGINAL_ETH;

    if (ORIGINAL_ETH_MAINNET === undefined) delete process.env.ALCHEMY_WEBHOOK_ID_ETH_MAINNET;
    else process.env.ALCHEMY_WEBHOOK_ID_ETH_MAINNET = ORIGINAL_ETH_MAINNET;
});

describe('alchemyWebhookConfig', () => {
    test('supports ethereum mainnet webhook ids', () => {
        assert.equal(getSupportedAlchemyWebhookChains().includes(1), true);
        assert.deepEqual(getAlchemyWebhookEnvKeys(1), ['ALCHEMY_WEBHOOK_ID_ETH', 'ALCHEMY_WEBHOOK_ID_ETH_MAINNET']);
    });

    test('prefers explicit ethereum webhook env var', () => {
        process.env.ALCHEMY_WEBHOOK_ID_ETH = 'wh_eth_primary';
        process.env.ALCHEMY_WEBHOOK_ID_ETH_MAINNET = 'wh_eth_fallback';
        assert.equal(getAlchemyWebhookId(1), 'wh_eth_primary');
    });

    test('falls back to legacy ethereum mainnet env var alias', () => {
        delete process.env.ALCHEMY_WEBHOOK_ID_ETH;
        process.env.ALCHEMY_WEBHOOK_ID_ETH_MAINNET = 'wh_eth_alias';
        assert.equal(getAlchemyWebhookId(1), 'wh_eth_alias');
    });
});
