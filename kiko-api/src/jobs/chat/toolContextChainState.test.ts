import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildToolContextForChain,
    markPendingToolContextChainSwitch,
    resolveToolContextChainSwitchAck,
} from './toolContextChainState.js';

test('buildToolContextForChain switches to target EVM chain and hydrates matching balance snapshot', () => {
    const next = buildToolContextForChain({
        toolContext: {
            chainId: 8453,
            chainName: 'Base',
            walletAddress: '0xbase',
            userAddress: '0xbase',
            evmWalletAddress: '0xevm',
            solanaWalletAddress: 'So11111111111111111111111111111111111111112',
            balance: { ETH: '1.25' },
            nativeBalance: '1.25',
            allChainBalances: {
                bsc: {
                    ethBalanceFormatted: '3.5',
                    tokens: {
                        BNB: { balance: '3.5' },
                        USDT: { balance: '120.25', contractAddress: '0x55d398326f99059ff775485246999027b3197955' },
                    },
                },
            },
        },
        chainId: 56,
        chainName: 'BNB Chain',
    });

    assert.equal(next.chainId, 56);
    assert.equal(next.chainName, 'BNB Chain');
    assert.equal(next.walletAddress, '0xevm');
    assert.equal(next.userAddress, '0xevm');
    assert.equal(next.nativeBalance, '3.5');
    assert.equal(next.balance.BNB, '3.5');
    assert.equal(next.balance.USDT, '120.25');
    assert.equal(next.balance['0x55d398326f99059ff775485246999027b3197955'], '120.25');
});

test('buildToolContextForChain switches to Solana wallet address and clears stale single-chain balances when snapshot is absent', () => {
    const next = buildToolContextForChain({
        toolContext: {
            chainId: 8453,
            chainName: 'Base',
            walletAddress: '0xbase',
            userAddress: '0xbase',
            evmWalletAddress: '0xevm',
            solanaWalletAddress: 'So11111111111111111111111111111111111111112',
            balance: { ETH: '1.25' },
            nativeBalance: '1.25',
        },
        chainId: 900,
        chainName: 'Solana',
    });

    assert.equal(next.chainId, 900);
    assert.equal(next.walletAddress, 'So11111111111111111111111111111111111111112');
    assert.equal(next.userAddress, 'So11111111111111111111111111111111111111112');
    assert.equal('balance' in next, false);
    assert.equal('nativeBalance' in next, false);
});

test('markPendingToolContextChainSwitch records a pending switch without mutating the connected chain yet', () => {
    const next = markPendingToolContextChainSwitch({
        toolContext: {
            chainId: 8453,
            chainName: 'Base',
            walletAddress: '0xbase',
            userAddress: '0xbase',
        },
        chainId: 56,
        chainName: 'BNB Chain',
        evmWalletAddress: '0xevm',
    });

    assert.equal(next.chainId, 8453);
    assert.equal(next.chainName, 'Base');
    assert.equal(next.evmWalletAddress, '0xevm');
    assert.equal(next.pendingChainSwitch.targetChainId, 56);
    assert.equal(next.pendingChainSwitch.targetChainName, 'BNB Chain');
    assert.equal(next.pendingChainSwitch.status, 'pending');
});

test('resolveToolContextChainSwitchAck applies the new chain only after a success ack arrives', () => {
    const next = resolveToolContextChainSwitchAck({
        toolContext: {
            chainId: 8453,
            chainName: 'Base',
            walletAddress: '0xbase',
            userAddress: '0xbase',
            evmWalletAddress: '0xevm',
            pendingChainSwitch: {
                targetChainId: 56,
                targetChainName: 'BNB Chain',
                status: 'pending',
            },
            allChainBalances: {
                bsc: {
                    ethBalanceFormatted: '2.0',
                    tokens: {
                        BNB: { balance: '2.0' },
                    },
                },
            },
        },
        chainId: 56,
        chainName: 'BNB Chain',
        status: 'success',
    });

    assert.equal(next.chainId, 56);
    assert.equal(next.chainName, 'BNB Chain');
    assert.equal(next.walletAddress, '0xevm');
    assert.equal(next.nativeBalance, '2.0');
    assert.equal(next.balance.BNB, '2.0');
    assert.equal('pendingChainSwitch' in next, false);
    assert.equal(next.lastChainSwitch.chainId, 56);
});

test('resolveToolContextChainSwitchAck preserves the old chain and records an error on failed ack', () => {
    const next = resolveToolContextChainSwitchAck({
        toolContext: {
            chainId: 8453,
            chainName: 'Base',
            walletAddress: '0xbase',
            userAddress: '0xbase',
            pendingChainSwitch: {
                targetChainId: 56,
                targetChainName: 'BNB Chain',
                status: 'pending',
            },
        },
        chainId: 56,
        chainName: 'BNB Chain',
        status: 'failed',
        error: 'User rejected the request',
    });

    assert.equal(next.chainId, 8453);
    assert.equal(next.chainName, 'Base');
    assert.equal('pendingChainSwitch' in next, false);
    assert.equal(next.lastChainSwitchError.chainId, 56);
    assert.match(next.lastChainSwitchError.error, /rejected/i);
});
