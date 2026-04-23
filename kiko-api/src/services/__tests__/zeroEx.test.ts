import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { __testOnly } from '../zeroEx.js';
import { normalizeNativeTokenFor0x } from '../zeroExNormalize.js';

const NATIVE_PLACEHOLDER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

test('normalizeNativeTokenFor0x maps native symbols to the 0x placeholder on Base', () => {
  assert.equal(normalizeNativeTokenFor0x('ETH', 8453), NATIVE_PLACEHOLDER);
  assert.equal(normalizeNativeTokenFor0x('eth', 8453), NATIVE_PLACEHOLDER);
  assert.equal(normalizeNativeTokenFor0x('Base', 8453), NATIVE_PLACEHOLDER);
});

test('normalizeNativeTokenFor0x maps chain natives on other EVM chains', () => {
  assert.equal(normalizeNativeTokenFor0x('BNB', 56), NATIVE_PLACEHOLDER);
  assert.equal(normalizeNativeTokenFor0x('POL', 137), NATIVE_PLACEHOLDER);
  assert.equal(normalizeNativeTokenFor0x('SOL', 900), NATIVE_PLACEHOLDER);
});

test('normalizeNativeTokenFor0x leaves ERC20 addresses unchanged', () => {
  const token = '0xd53530cf723d50cac8872c389122a2932633dba3';
  assert.equal(normalizeNativeTokenFor0x(token, 8453), token);
});

test('0x quote endpoint selection never uses permit2 for native input', () => {
  assert.equal(__testOnly.shouldUsePermit2Endpoint(NATIVE_PLACEHOLDER, 8453, true), false);
  assert.equal(__testOnly.shouldUsePermit2Endpoint('ETH', 8453, true), false);
  assert.equal(__testOnly.shouldUsePermit2Endpoint('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', 8453, true), true);
});
