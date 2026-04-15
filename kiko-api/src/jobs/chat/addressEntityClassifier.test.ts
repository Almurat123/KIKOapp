import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { enrichRequestedAddressClassifications } from './addressEntityClassifier.js';
import type { ChatContextSnapshot } from './contracts.js';
import prisma from '../../db/prisma.js';

after(async () => {
    await prisma.$disconnect().catch(() => {});
    setImmediate(() => process.exit(0));
});

test('enrichRequestedAddressClassifications leaves empty address lists untouched', async () => {
    const snapshot = {
        sessionId: 's1',
        taskId: 't1',
        model: 'gpt-5-mini',
        history: [],
        lastUserMessage: 'hello',
        runtime: {},
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        toolDefinitions: [],
    } as ChatContextSnapshot;

    const enriched = await enrichRequestedAddressClassifications(snapshot);
    assert.deepEqual(enriched.requestedAddressClassifications, []);
});
