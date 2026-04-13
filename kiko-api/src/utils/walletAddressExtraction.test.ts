import assert from 'node:assert/strict';
import test from 'node:test';

import { extractUniqueWalletAddressesFromText } from './walletAddressExtraction.js';

test('extractUniqueWalletAddressesFromText handles EVM and Solana literals in common text formats', () => {
    const evm = '0xBD708164137146AC234ACEB75D3981CD3599E21A';
    const sol = 'So11111111111111111111111111111111111111112';
    const wallets = extractUniqueWalletAddressesFromText(
        `Copy Trade \`${evm}\`, url=https://solscan.io/account/${sol}.`,
    );

    assert.deepEqual(wallets, [
        '0xbd708164137146ac234aceb75d3981cd3599e21a',
        sol,
    ]);
});

test('extractUniqueWalletAddressesFromText rejects truncated EVM strings instead of treating them as wallets', () => {
    assert.deepEqual(
        extractUniqueWalletAddressesFromText('Copy Trade 0xbd708164137146ac234aceb75d3981cd359e21a with $8'),
        [],
    );
});
