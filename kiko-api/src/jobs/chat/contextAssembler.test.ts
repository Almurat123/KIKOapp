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

test('assembleChatContext does not let unscoped nativeBalance override current-chain all-chain balance', () => {
    const snapshot = assembleChatContext({
        task: {
            id: 'task-chain-scope',
            sessionId: 'session-chain-scope',
            userMessageId: 'user-chain-scope',
            assistantMessageId: 'assistant-chain-scope',
            model: 'gpt-5-mini',
            toolContext: {
                walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
                chainId: 8453,
                chainName: 'Base',
                nativeBalance: '0.47',
                balance: {
                    ETH: '0.47',
                    USDC: '999',
                },
                allChainBalances: {
                    base: {
                        ethBalanceFormatted: '0.000642567281279995',
                        tokens: [
                            {
                                symbol: 'USDC',
                                balance: '1.25',
                                contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71B54bdA02913',
                                decimals: 6,
                            },
                        ],
                    },
                    eth: {
                        ethBalanceFormatted: '0.47',
                        tokens: [],
                    },
                },
                allChainBalancesSnapshotAt: '2026-04-23T08:39:00.000Z',
            },
        },
        session: {
            userId: 'user-chain-scope',
        },
        messages: [
            {
                role: 'user',
                content: 'Swap ETH to USDC on Base',
            },
        ],
        toolDefinitions: [],
        userId: 'user-chain-scope',
    });

    const walletState = String(snapshot.runtime.contextBlocks?.walletState || '');
    assert.match(walletState, /Chain: Base/);
    assert.match(walletState, /Native: 0\.000642567281279995 ETH/);
    assert.doesNotMatch(walletState, /Native: 0\.47 ETH/);
    assert.match(walletState, /USDC: 1\.25/);
    assert.doesNotMatch(walletState, /ETH: 0\.47/);
    assert.doesNotMatch(walletState, /USDC: 999/);
    assert.equal(snapshot.runtime.prefetchedToolResults?.get_wallet_info?.ethBalance, '0.000642567281279995');
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

test('assembleChatContext clears swap confirmation for explicit chain switch requests', () => {
    const snapshot = assembleChatContext({
        task: {
            id: 'task-3',
            sessionId: 'session-3',
            userMessageId: 'user-3',
            assistantMessageId: 'assistant-3',
            model: 'gpt-5-mini',
            toolContext: {
                walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
                chainId: 8453,
                chainName: 'Base',
            },
        },
        session: {
            userId: 'user-3',
        },
        messages: [
            {
                role: 'assistant',
                id: 'assistant-1',
                message_index: 1,
                data: {
                    toolTrace: {
                        toolCalls: [
                            {
                                tool: 'prepare_swap_transaction',
                                status: 'success',
                                args: {
                                    token_in: '0x8ac76a51cc950d982d68b83fe1ad97b32cd580d',
                                    token_out: 'BNB',
                                    amount_in: '0.065216073765713464',
                                    chain_id: 56,
                                },
                                result: { finishedAt: '2026-03-19T09:36:35.000Z' },
                            },
                        ],
                    },
                },
            },
            {
                role: 'user',
                content: 'Switch to polygon',
                message_index: 2,
            },
        ],
        toolDefinitions: [],
        userId: 'user-3',
    });

    assert.equal(snapshot.confirmationState, null);
});

test('assembleChatContext unwraps Farcaster mention wrapper before snapshot extraction', () => {
    const token = '0x4972e029f2e1831d205b20d05833cc771feb2ba3';
    const snapshot = assembleChatContext({
        task: {
            id: 'task-4',
            sessionId: 'session-4',
            userMessageId: 'user-4',
            assistantMessageId: 'assistant-4',
            model: 'gpt-5-mini',
            toolContext: {
                pageContext: 'farcaster_agent',
            },
        },
        session: {
            userId: 'user-4',
        },
        messages: [
            {
                role: 'user',
                content: `Farcaster inbound mention context:\nCurrent @almurat: ${token}`,
            },
        ],
        toolDefinitions: [],
        userId: 'user-4',
    });

    assert.equal(snapshot.lastUserMessage, token);
    assert.deepEqual(snapshot.requestedTokenAddresses, [token]);
    assert.deepEqual(snapshot.requestedTokenSymbols, []);
});
