import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatContextSnapshot } from './contracts.js';
import { __fastSwapCoordinatorTest, deriveFastSwapIntentDraft, findSnapshotBalanceForToken } from './fastSwapCoordinator.js';

function makeSnapshot(message: string, overrides: Partial<ChatContextSnapshot> = {}): ChatContextSnapshot {
    const { runtime: runtimeOverrides, ...restOverrides } = overrides;
    return {
        sessionId: 'session-1',
        taskId: 'task-1',
        model: 'gpt-5-mini',
        history: [{ role: 'user', content: message }],
        lastUserMessage: message,
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        toolDefinitions: [],
        runtime: {
            userSettings: {},
            contextBlocks: {},
            chainId: 8453,
            chainName: 'Base',
            ...(runtimeOverrides || {}),
        },
        ...restOverrides,
    } as ChatContextSnapshot;
}

test('deriveFastSwapIntentDraft lets explicit query chain override connected chain', () => {
    const snapshot = makeSnapshot('Buy CAKE on BNB chain with 1 BNB', {
        requestedTokenSymbols: ['CAKE', 'BNB'],
    });

    const intent = deriveFastSwapIntentDraft(snapshot);

    assert.equal(intent.chainId, 56);
    assert.equal(intent.swapIntent.tokenIn, 'BNB');
    assert.equal(intent.swapIntent.tokenOut, 'CAKE');
});

test('deriveFastSwapIntentDraft does not hard-map ETH to Base when no explicit chain exists', () => {
    const snapshot = makeSnapshot('Swap ETH to USDC', {
        requestedTokenSymbols: ['ETH', 'USDC'],
        runtime: {
            chainId: 1,
            chainName: 'Ethereum',
        },
    });

    const intent = deriveFastSwapIntentDraft(snapshot);

    assert.equal(intent.chainId, 1);
    assert.equal(intent.swapIntent.tokenIn, 'ETH');
    assert.equal(intent.swapIntent.tokenOut, 'USDC');
});

test('findSnapshotBalanceForToken falls back to all-chain balances when single-chain balance is missing', () => {
    const snapshot = makeSnapshot('Sell all USDC to ETH', {
        runtime: {
            chainId: 8453,
            chainName: 'Base',
            allChainBalances: {
                base: {
                    ethBalanceFormatted: 0.145,
                    tokens: [
                        {
                            symbol: 'USDC',
                            tokenBalance: '1234.5',
                            decimals: 6,
                            contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
                        },
                    ],
                },
            },
        },
    });

    const nativeBalance = findSnapshotBalanceForToken(snapshot, 'ETH', 'base', true);
    const tokenBalance = findSnapshotBalanceForToken(snapshot, '0x1234567890abcdef1234567890abcdef12345678', 'base', false);

    assert.equal(nativeBalance, 0.145);
    assert.equal(tokenBalance, 1234.5);
});

test('resolveFastSwapFinalStatus keeps submitted instant trades pending until settlement completes', () => {
    assert.equal(__fastSwapCoordinatorTest.resolveFastSwapFinalStatus({
        ok: true,
        data: { status: 'PENDING' },
    }), 'pending');

    assert.equal(__fastSwapCoordinatorTest.resolveFastSwapFinalStatus({
        ok: true,
        data: { status: 'SUCCESS' },
    }), 'success');

    assert.equal(__fastSwapCoordinatorTest.resolveFastSwapFinalStatus({
        ok: false,
        data: { status: 'PENDING' },
    }), 'failed');
});

test('canAttemptFastSwap allows fast mode even when hard policy and mutation are enabled', () => {
    const snapshot = makeSnapshot('Sell all VIRTUAL to ETH', {
        policySnapshot: {
            enforcementLevel: 'hard',
            mutationAllowed: true,
        } as ChatContextSnapshot['policySnapshot'],
    });

    const result = __fastSwapCoordinatorTest.canAttemptFastSwap({
        snapshot,
        task: {
            toolContext: {
                toolConfig: {
                    fastSwapMode: true,
                },
            },
        },
    });

    assert.equal(result, true);
});
