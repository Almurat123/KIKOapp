import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { moderationClient } from '../services/moderationClient.js';
import { ChatWorker } from './chatWorker.js';
import { ChatStreamBroker } from './chat/streamBroker.js';

test('ChatWorker starts the broker and emits progress before wallet hydration begins', async () => {
    const events: string[] = [];
    const worker = new ChatWorker() as any;
    const originalBrokerStart = ChatStreamBroker.prototype.start;
    const originalBrokerFail = ChatStreamBroker.prototype.fail;
    const originalHydrate = worker.hydrateWalletSnapshotIfNeeded;

    ChatStreamBroker.prototype.start = function startPatched() {
        events.push('broker:start');
    };
    ChatStreamBroker.prototype.fail = async function failPatched() {
        events.push('broker:fail');
    };

    worker.hydrateWalletSnapshotIfNeeded = async () => {
        events.push('hydrate:start');
    };

    const repoCalls = {
        getSession: 0,
        getSessionMessages: 0,
        updateTaskStatus: 0,
    };
    worker.repo = {
        getSession: async () => {
            repoCalls.getSession += 1;
            return { userId: 'user-1' };
        },
        getSessionMessages: async () => {
            repoCalls.getSessionMessages += 1;
            return [{ role: 'user', content: 'Sell all token to ETH' }];
        },
        updateTaskStatus: async () => {
            repoCalls.updateTaskStatus += 1;
        },
    };
    const moderateInputMock = mock.method(moderationClient, 'moderateInput', async () => ({
        safe: false,
        checks: { intent: { reason: 'blocked for test' } },
    } as any));
    const broadcasts: any[] = [];
    worker.ws = {
        broadcastToUser: (...args: any[]) => {
            broadcasts.push(args);
        const payload = args[1];
        if (payload?.type === 'task_status') {
            events.push(`status:${payload.data?.message}`);
        }
        },
    };

    try {
        await worker.runTask({
            id: 'task-1',
            sessionId: 'session-1',
            assistantMessageId: 'assistant-1',
            model: 'gpt-5-mini',
            toolContext: {
                walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
                chainId: 8453,
            },
        });

        const brokerStartIndex = events.indexOf('broker:start');
        const hydrationIndex = events.indexOf('hydrate:start');
        const loadingStatusIndex = events.indexOf('status:Loading wallet and context');

        assert.ok(brokerStartIndex >= 0, 'expected broker.start to be called');
        assert.ok(hydrationIndex >= 0, 'expected wallet hydration to run');
        assert.ok(loadingStatusIndex >= 0, 'expected loading status to be broadcast');
        assert.ok(brokerStartIndex < hydrationIndex, 'broker.start should happen before hydration');
        assert.ok(loadingStatusIndex < hydrationIndex, 'loading status should be broadcast before hydration');
        assert.equal(repoCalls.getSession, 1);
        assert.equal(repoCalls.getSessionMessages, 1);
        assert.ok(repoCalls.updateTaskStatus >= 1);
        assert.equal(moderateInputMock.mock.callCount(), 1);
        assert.ok(broadcasts.length >= 1);
        assert.ok(events.includes('broker:fail'));
    } finally {
        ChatStreamBroker.prototype.start = originalBrokerStart;
        ChatStreamBroker.prototype.fail = originalBrokerFail;
        worker.hydrateWalletSnapshotIfNeeded = originalHydrate;
        mock.restoreAll();
    }
});
