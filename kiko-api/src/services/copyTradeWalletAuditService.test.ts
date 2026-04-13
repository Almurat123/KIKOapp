import assert from 'node:assert/strict';
import test from 'node:test';

import prisma from '../db/prisma.js';
import { safeRecordCopyTradeWalletAudit } from './copyTradeWalletAuditService.js';

test('safeRecordCopyTradeWalletAudit records mismatch provenance without throwing', async () => {
    const original = (prisma as any).$executeRawUnsafe;
    const calls: any[][] = [];
    (prisma as any).$executeRawUnsafe = async (...args: any[]) => {
        calls.push(args);
        return 1;
    };

    try {
        await safeRecordCopyTradeWalletAudit({
            userId: 'did:privy:test',
            configId: 'cfg-1',
            action: 'tool_create_created',
            chainId: 56,
            source: 'chat_tool',
            binding: {
                rawUserMessage: 'Copy Trade 0xbd708164137146ac234aceb75d3981cd3599e21a with $8',
                extractedWallets: ['0xbd708164137146ac234aceb75d3981cd3599e21a'],
                llmTargetWallet: '0xbd708164137146ac234aceb75d3981cd359e21a',
                finalTargetWallet: '0xbd708164137146ac234aceb75d3981cd3599e21a',
                source: 'latest_user_message_literal',
                reasonCode: 'MODEL_ARG_OVERRIDDEN_BY_LITERAL',
            },
            finalTargetWallet: '0xbd708164137146ac234aceb75d3981cd3599e21a',
            writtenTargetWallet: '0xbd708164137146ac234aceb75d3981cd3599e21a',
        });

        assert.equal(calls.length, 1);
        assert.equal(calls[0][4], 'tool_create_created');
        assert.equal(calls[0][5], 'chat_tool');
        assert.equal(calls[0][9], '0xbd708164137146ac234aceb75d3981cd359e21a');
        assert.equal(calls[0][10], '0xbd708164137146ac234aceb75d3981cd3599e21a');
        assert.equal(calls[0][12], true);
        assert.equal(calls[0][13], 'MODEL_ARG_OVERRIDDEN_BY_LITERAL');
    } finally {
        (prisma as any).$executeRawUnsafe = original;
    }
});
