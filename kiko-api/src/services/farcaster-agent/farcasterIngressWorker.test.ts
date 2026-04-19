import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { trimCastText } from './farcasterCastText.js';
import { env } from '../../config/env.js';
import prisma from '../../db/prisma.js';
import { farcasterApiClient } from './farcasterApiClient.js';
import { farcasterReplyService } from './farcasterReplyService.js';
import {
  buildBindReplyIdempotencyKey,
  createFarcasterInboundEventLog,
  FarcasterIngressWorker,
  getFarcasterInboundIgnoreReason,
} from './farcasterIngressWorker.js';
import {
  buildFarcasterAssistantReplyFromGeneratedImageState,
  buildFarcasterAssistantReplyFromMessage,
  resolveFarcasterAssistantReplyText,
} from './farcasterChatBridge.js';

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

test('getFarcasterInboundIgnoreReason rejects self and configured bot authors', () => {
  assert.equal(getFarcasterInboundIgnoreReason(1576616, { botFid: 1576616 }), 'self_author');
  assert.equal(getFarcasterInboundIgnoreReason(4242, { botFid: 1576616, blockedBotFids: [4242] }), 'blocked_bot_author');
  assert.equal(getFarcasterInboundIgnoreReason(877398, { botFid: 1576616, blockedBotFids: [4242] }), null);
});

test('FarcasterIngressWorker drops self-authored webhook events before persistence', async () => {
  const eventLog = prisma.farcasterEventLog as any;
  const originalCreateMany = eventLog.createMany;
  const originalBotFid = env.farcasterAgent.botFid;
  let createManyCalls = 0;

  eventLog.createMany = async () => {
    createManyCalls += 1;
    return { count: 1 } as any;
  };
  env.farcasterAgent.botFid = 1576616;

  try {
    const accepted = await new FarcasterIngressWorker().enqueueMention({
      eventId: 'farcaster:mention:self-loop',
      notificationType: 'replies',
      castHash: '0xselfloop',
      text: 'Link your Farcaster account in KIKO first.',
      authorFid: 1576616,
      authorUsername: 'kikoapp',
      parentHash: '0xparent',
      parentAuthorFid: 1576616,
      rootCastHash: '0xroot',
      occurredAt: '2026-04-16T17:29:06.000Z',
    });

    assert.equal(accepted, false);
    assert.equal(createManyCalls, 0);
  } finally {
    env.farcasterAgent.botFid = originalBotFid;
    eventLog.createMany = originalCreateMany;
  }
});

test('buildBindReplyIdempotencyKey scopes public bind prompts by author and day', () => {
  assert.equal(
    buildBindReplyIdempotencyKey(877398, '2026-04-16T17:29:06.000Z'),
    'farcaster:reply:bind:877398:2026-04-16',
  );
  assert.equal(
    buildBindReplyIdempotencyKey(877398, '2026-04-16T23:59:59.000Z'),
    'farcaster:reply:bind:877398:2026-04-16',
  );
  assert.equal(
    buildBindReplyIdempotencyKey(877398, '2026-04-17T00:00:00.000Z'),
    'farcaster:reply:bind:877398:2026-04-17',
  );
});

test('farcasterReplyService treats concurrent idempotency insert races as already reserved', async () => {
  const delivery = prisma.farcasterMessageDelivery as any;
  const originalFindUnique = delivery.findUnique;
  const originalCreate = delivery.create;
  const originalIsConfigured = (farcasterApiClient as any).isConfigured;
  const originalPublishCastReply = (farcasterApiClient as any).publishCastReply;
  let publishCalls = 0;

  delivery.findUnique = async () => null;
  delivery.create = async (args: any) => {
    const error: any = new Error('unique constraint');
    error.code = 'P2002';
    delivery.findUnique = async () => ({
      id: 'delivery-raced',
      idempotencyKey: args.data.idempotencyKey,
      status: 'pending',
      attemptCount: 1,
      updatedAt: new Date(),
    });
    throw error;
  };
  (farcasterApiClient as any).isConfigured = () => true;
  (farcasterApiClient as any).publishCastReply = async () => {
    publishCalls += 1;
    return { hash: '0xshould-not-publish', raw: null };
  };

  try {
    const result = await farcasterReplyService.replyToMention({
      farcasterFid: 877398,
      parentHash: '0xparent',
      parentAuthorFid: 877398,
      text: 'Link your Farcaster account in KIKO first.',
      idempotencyKey: 'farcaster:reply:bind:877398:2026-04-16',
    });

    assert.equal(result, true);
    assert.equal(publishCalls, 0);
  } finally {
    delivery.findUnique = originalFindUnique;
    delivery.create = originalCreate;
    (farcasterApiClient as any).isConfigured = originalIsConfigured;
    (farcasterApiClient as any).publishCastReply = originalPublishCastReply;
  }
});

test('farcasterReplyService persists and publishes generated-image embeds', async () => {
  const delivery = prisma.farcasterMessageDelivery as any;
  const originalFindUnique = delivery.findUnique;
  const originalCreate = delivery.create;
  const originalUpdate = delivery.update;
  const originalIsConfigured = (farcasterApiClient as any).isConfigured;
  const originalPublishCastReply = (farcasterApiClient as any).publishCastReply;
  let createdPayload: any = null;
  let publishedParams: any = null;

  delivery.findUnique = async () => null;
  delivery.create = async (args: any) => {
    createdPayload = args.data.payload;
    return {
      id: 'delivery-embeds',
      idempotencyKey: args.data.idempotencyKey,
      status: 'pending',
      attemptCount: 1,
      updatedAt: new Date(),
    } as any;
  };
  delivery.update = async (args: any) => ({
    id: args.where.id,
    ...args.data,
  });
  (farcasterApiClient as any).isConfigured = () => true;
  (farcasterApiClient as any).publishCastReply = async (params: any) => {
    publishedParams = params;
    return { hash: '0xsent', raw: null };
  };

  try {
    const result = await farcasterReplyService.replyToMention({
      farcasterFid: 877398,
      parentHash: '0xparent',
      parentAuthorFid: 877398,
      text: 'Generated.',
      embeds: ['https://cdn.example/generated.png', 'data:image/png;base64,skip'],
      idempotencyKey: 'farcaster:reply:mention:0xparent',
    });

    assert.equal(result, true);
    assert.deepEqual(createdPayload?.embeds, ['https://cdn.example/generated.png']);
    assert.deepEqual(publishedParams?.embeds, ['https://cdn.example/generated.png']);
  } finally {
    delivery.findUnique = originalFindUnique;
    delivery.create = originalCreate;
    delivery.update = originalUpdate;
    (farcasterApiClient as any).isConfigured = originalIsConfigured;
    (farcasterApiClient as any).publishCastReply = originalPublishCastReply;
  }
});

test('buildFarcasterAssistantReplyFromMessage prefers public embeds from generated-image messages', async () => {
  const reply = await buildFarcasterAssistantReplyFromMessage({
    content: '',
    type: 'generated-image',
    data: {
      generatedImage: {
        status: 'complete',
        images: [
          {
            id: 'generated-1',
            publicUrl: 'https://cdn.example/public-generated.png',
            previewUrl: 'https://signed.example/generated.png',
            name: 'generated.png',
            type: 'image/png',
            size: 123,
            width: 1024,
            height: 1024,
          },
        ],
      },
    },
  });

  assert.equal(reply.text, 'Generated.');
  assert.deepEqual(reply.embeds, ['https://cdn.example/public-generated.png']);
});

test('buildFarcasterAssistantReplyFromGeneratedImageState uses task output fallback embeds', async () => {
  const reply = await buildFarcasterAssistantReplyFromGeneratedImageState({
    status: 'complete',
    images: [
      {
        id: 'generated-1',
        publicUrl: 'https://cdn.example/task-output.png',
        name: 'generated.png',
        type: 'image/png',
        size: 123,
        width: 1024,
        height: 1024,
      },
    ],
  });

  assert.equal(reply.text, 'Generated.');
  assert.deepEqual(reply.embeds, ['https://cdn.example/task-output.png']);
});

test('resolveFarcasterAssistantReplyText acknowledges terminal generated-image turns without assistant text', () => {
  const reply = resolveFarcasterAssistantReplyText({
    type: 'generated-image',
    content: '',
    data: null,
  }, {
    taskStatus: 'done',
  });

  assert.equal(reply, 'Generated.');
});

test('resolveFarcasterAssistantReplyText keeps generated-image timeout replies out of the generic error fallback', () => {
  const reply = resolveFarcasterAssistantReplyText({
    type: 'generated-image',
    content: '',
    data: null,
  }, {
    taskStatus: 'running',
    timedOut: true,
  });

  assert.equal(reply, 'Image generation is still running. Please try again in a moment.');
});
