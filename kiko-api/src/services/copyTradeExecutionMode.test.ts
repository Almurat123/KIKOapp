import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseExecutionModeStrict,
  resolveExecutionModeFromConfig,
  isTurboMode,
  isSafeMode,
  isNormalMode,
} from './copyTradeExecutionMode.js';

test('parseExecutionModeStrict accepts safe/normal/turbo and rejects balanced', () => {
  assert.equal(parseExecutionModeStrict('safe'), 'safe');
  assert.equal(parseExecutionModeStrict('NORMAL'), 'normal');
  assert.equal(parseExecutionModeStrict(' turbo '), 'turbo');
  assert.equal(parseExecutionModeStrict('balanced'), null);
  assert.equal(parseExecutionModeStrict(undefined), null);
});

test('resolveExecutionModeFromConfig enforces strict requested values', () => {
  const invalid = resolveExecutionModeFromConfig({ requested: 'balanced', fallback: 'normal' });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.mode, 'normal');

  const explicit = resolveExecutionModeFromConfig({ requested: 'safe', fallback: 'normal' });
  assert.equal(explicit.valid, true);
  assert.equal(explicit.mode, 'safe');
});

test('resolveExecutionModeFromConfig supports legacy disableTokenInfo fallback', () => {
  const legacyTurbo = resolveExecutionModeFromConfig({ legacyDisableTokenInfo: true });
  const legacyNormal = resolveExecutionModeFromConfig({ legacyDisableTokenInfo: false });
  assert.equal(legacyTurbo.mode, 'turbo');
  assert.equal(legacyNormal.mode, 'normal');
});

test('execution mode predicates work', () => {
  assert.equal(isTurboMode('turbo'), true);
  assert.equal(isTurboMode('safe'), false);
  assert.equal(isSafeMode('safe'), true);
  assert.equal(isSafeMode('normal'), false);
  assert.equal(isNormalMode('normal'), true);
  assert.equal(isNormalMode('turbo'), false);
});
