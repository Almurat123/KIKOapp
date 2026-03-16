import assert from 'node:assert/strict';
import test from 'node:test';

import { resolvePrivyServerConfig } from '../privy.js';

test('resolvePrivyServerConfig only trusts server env vars for backend auth', () => {
  const resolved = resolvePrivyServerConfig({
    PRIVY_APP_ID: 'server-app',
    PRIVY_APP_SECRET: 'server-secret',
    VITE_PRIVY_APP_ID: 'frontend-app',
  });

  assert.equal(resolved.appId, 'server-app');
  assert.equal(resolved.appSecret, 'server-secret');
  assert.equal(resolved.frontendAppId, 'frontend-app');
  assert.equal(resolved.appIdMismatch, true);
});

test('resolvePrivyServerConfig reports no mismatch when ids align', () => {
  const resolved = resolvePrivyServerConfig({
    PRIVY_APP_ID: 'shared-app',
    PRIVY_APP_SECRET: 'server-secret',
    VITE_PRIVY_APP_ID: 'shared-app',
  });

  assert.equal(resolved.appId, 'shared-app');
  assert.equal(resolved.appIdMismatch, false);
});
