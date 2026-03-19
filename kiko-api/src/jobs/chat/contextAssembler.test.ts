import assert from 'node:assert/strict';
import test from 'node:test';
import { assembleChatContext } from './contextAssembler.js';

test('assembleChatContext uses all-chain balances to seed current wallet state when single-chain balance is missing', () => {
    const snapshot = assembleChatContext({
        task: {
            id: 'task-1',
            sessionId: 'session-1',
            userMessageId: 'user-1',
            assistantMessageId: 'assistant-1',
            model: 'gpt-5-mini',
            toolContext: {
                walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
                chainId: 8453,
                chainName: 'Base',
                allChainBalances: {
                    base: {
                        ethBalance: '0x14d1120d7b160000',
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
                allChainBalancesSnapshotAt: '2026-03-19T00:00:00.000Z',
            },
        },
        session: {
            userId: 'user-1',
        },
        messages: [
            {
                role: 'user',
                content: 'Sell all USDC to ETH',
            },
        ],
        toolDefinitions: [],
        userId: 'user-1',
    });

    const contextBlocks = snapshot.runtime.contextBlocks || {};
    const walletState = String(contextBlocks.walletState || '');
    assert.match(walletState, /Native: 0\.145 ETH/);
    assert.match(walletState, /USDC: 1234\.5/);
    assert.ok(snapshot.runtime.prefetchedToolResults?.get_wallet_info);
    assert.equal(snapshot.runtime.prefetchedToolResults?.get_wallet_info?.address, '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E');
    assert.equal(snapshot.runtime.prefetchedToolResults?.get_wallet_info?.chain, 'Base');
    assert.equal(snapshot.runtime.prefetchedToolResults?.get_wallet_info?.ethBalance, '0.145');
    assert.ok(Array.isArray(snapshot.runtime.prefetchedToolResults?.get_wallet_info?.tokens));
    assert.equal(snapshot.runtime.prefetchedToolResults?.get_wallet_info?.tokens?.[0]?.symbol, 'USDC');
});

test('assembleChatContext surfaces exact requested token balances from direct token balance hydration', () => {
    const token = '0xe6cbe943baef2dbca46d68fe0db2e3a60073bba3';
    const snapshot = assembleChatContext({
        task: {
            id: 'task-2',
            sessionId: 'session-2',
            userMessageId: 'user-2',
            assistantMessageId: 'assistant-2',
            model: 'gpt-5-mini',
            toolContext: {
                walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
                chainId: 8453,
                chainName: 'Base',
                nativeBalance: '0.000642567281279995',
                balance: {
                    [token]: {
                        balance: '1870734.311693124190730712',
                        tokenBalance: '1870734.311693124190730712',
                        decimals: 18,
                        contractAddress: token,
                    },
                },
                balanceSnapshotAt: '2026-03-19T00:00:00.000Z',
            },
        },
        session: {
            userId: 'user-2',
        },
        messages: [
            {
                role: 'user',
                content: `Sell all ${token} to ETH`,
            },
        ],
        toolDefinitions: [],
        userId: 'user-2',
    });

    const walletState = String(snapshot.runtime.contextBlocks?.walletState || '');
    assert.match(walletState, /1870734\.311693124190730712/);
    assert.match(walletState, /\[REQUESTED_BALANCES\]/);
    assert.equal(snapshot.runtime.prefetchedToolResults?.get_wallet_info?.tokens?.[0]?.contractAddress, token);
    assert.equal(snapshot.runtime.prefetchedToolResults?.get_wallet_info?.tokens?.[0]?.balance, '1870734.311693124190730712');
});
