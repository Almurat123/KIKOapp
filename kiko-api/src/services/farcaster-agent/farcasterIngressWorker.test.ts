import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { trimCastText } from './farcasterCastText.js';
import prisma from '../../db/prisma.js';
import { createFarcasterInboundEventLog } from './farcasterIngressWorker.js';

after(async () => {
  await prisma.$disconnect().catch(() => {});
  setImmediate(() => process.exit(0));
});

test('trimCastText preserves paragraph breaks for cast rendering', () => {
  const formatted = trimCastText('First point.\n\nSecond point.', 320);

  assert.equal(formatted, 'First point.\n\nSecond point.');
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

test('trimCastText reflows long multi-sentence replies into short social paragraphs', () => {
  const input = 'Your Base PnL is about +$592.05 realized over the last 30D. Including unrealized, it is about +$567.05 total gain right now. I can also break it down by token or show the full wallet summary.';
  const formatted = trimCastText(input, 320);

  assert.match(formatted, /30D\.\n\nIncluding unrealized/);
  assert.match(formatted, /right now\.\n\nI can also break it down/);
});

test('trimCastText truncates by utf8 bytes after wrapping', () => {
  const formatted = trimCastText('这是一个没有空格的很长中文回复'.repeat(20), 220);

  assert.equal(Buffer.byteLength(formatted, 'utf8') <= 220, true);
  assert.equal(formatted.endsWith('...'), true);
  assert.equal(formatted.includes('\n'), true);
});

test('trimCastText strips markdown emphasis so Farcaster shows plain text', () => {
  const formatted = trimCastText('Your Base PnL is about **+$592.05 realized** right now. See `wallet` details.', 320);

  assert.equal(formatted.includes('**'), false);
  assert.equal(formatted.includes('`'), false);
  assert.match(formatted, /\+\$592\.05 realized/);
});

test('createFarcasterInboundEventLog accepts first insert and quietly rejects duplicates', async () => {
  const eventLog = prisma.farcasterEventLog as any;
  const originalCreateMany = eventLog.createMany;
  const calls: any[] = [];
  let count = 0;

  eventLog.createMany = async (args: any) => {
    calls.push(args);
    count += 1;
    return { count: count === 1 ? 1 : 0 } as any;
  };

  try {
    const first = await createFarcasterInboundEventLog({
      eventId: 'farcaster:mention:test-hash',
      farcasterFid: 877398,
      channel: 'mention',
      sourceId: 'test-hash',
      payload: { castHash: 'test-hash' },
    });
    const second = await createFarcasterInboundEventLog({
      eventId: 'farcaster:mention:test-hash',
      farcasterFid: 877398,
      channel: 'mention',
      sourceId: 'test-hash',
      payload: { castHash: 'test-hash' },
    });

    assert.equal(first.accepted, true);
    assert.equal(second.accepted, false);
    assert.equal(calls.length, 2);
    assert.equal(calls[0]?.skipDuplicates, true);
    assert.equal(calls[0]?.data?.[0]?.eventId, 'farcaster:mention:test-hash');
  } finally {
    eventLog.createMany = originalCreateMany;
  }
});
