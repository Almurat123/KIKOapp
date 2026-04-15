import assert from 'node:assert/strict';
import test from 'node:test';
import { trimCastText } from './farcasterCastText.js';

test('trimCastText preserves paragraph breaks for cast rendering', () => {
  const formatted = trimCastText('First point.\n\nSecond point.', 320);

  assert.equal(formatted, 'First point.\nSecond point.');
});

test('trimCastText inserts line breaks into long continuous text', () => {
  const input = 'a'.repeat(90);
  const formatted = trimCastText(input, 320);
  const lines = formatted.split('\n');

  assert.equal(lines.length, 3);
  assert.equal(lines[0].length, 42);
  assert.equal(lines[1].length, 42);
  assert.equal(lines[2].length, 6);
});

test('trimCastText keeps normal space-delimited sentences intact', () => {
  const input = 'That address is a wallet address, but I do not have enough context yet.';
  const formatted = trimCastText(input, 320);

  assert.equal(formatted, input);
});

test('trimCastText truncates by utf8 bytes after wrapping', () => {
  const formatted = trimCastText('这是一个没有空格的很长中文回复'.repeat(20), 220);

  assert.equal(Buffer.byteLength(formatted, 'utf8') <= 220, true);
  assert.equal(formatted.endsWith('...'), true);
  assert.equal(formatted.includes('\n'), true);
});
