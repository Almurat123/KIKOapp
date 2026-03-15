import assert from 'node:assert/strict';
import test from 'node:test';

import { __testOnly } from '../runtime/tokenExitLock.js';

test('token exit lock scope differs across wallets for the same token', () => {
  const a = __testOnly.buildTokenExitLockScopeKey({
    chainId: 8453,
    tokenAddress: '0x65021a79AeEF22b17cdc1B768f5e79a8618bEbA3',
    walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
  });
  const b = __testOnly.buildTokenExitLockScopeKey({
    chainId: 8453,
    tokenAddress: '0x65021a79AeEF22b17cdc1B768f5e79a8618bEbA3',
    walletAddress: '0xF5e383733E4C7082F743D9038aC29b9E43c674EB',
  });

  assert.notEqual(a, b);
});

test('token exit lock scope stays stable for the same wallet/token pair', () => {
  const a = __testOnly.buildTokenExitLockScopeKey({
    chainId: 8453,
    tokenAddress: '0x65021a79AeEF22b17cdc1B768f5e79a8618bEbA3',
    walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
  });
  const b = __testOnly.buildTokenExitLockScopeKey({
    chainId: 8453,
    tokenAddress: '0x65021a79aeef22b17cdc1b768f5e79a8618beba3',
    walletAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e',
  });

  assert.equal(a, b);
});

test('token exit lock scope falls back to owner scope when wallet is absent', () => {
  const scoped = __testOnly.buildTokenExitLockScopeKey({
    chainId: 8453,
    tokenAddress: '0x65021a79AeEF22b17cdc1B768f5e79a8618bEbA3',
    ownerScope: 'user-1',
  });

  assert.match(scoped, /user-1$/);
});
