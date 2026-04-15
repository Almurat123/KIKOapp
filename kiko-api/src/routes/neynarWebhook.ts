// CONTEXT MEMORY
// Updated: 2026-04-15
// Author: Linh Tran
// Reason: Neynar webhook deliveries need a dedicated server entrypoint so the
//         Farcaster agent can receive cast.created mention/reply events without
//         continuing to spend quota on polling.
// Goal: verify inbound Neynar webhook signatures, normalize mention/reply
//       payloads, and hand off accepted events to the existing Farcaster
//       ingress worker with no extra business logic in the route.
// Owns: Neynar webhook signature checks, payload admission, and reply/mention
//       event enqueueing.
// Does Not Own: webhook creation, worker cadence, reply publication, or cast
//               lookup.
// Design Language:
// - ACK fast after signature verification.
// - Never parse or enqueue unsigned webhook requests.
// - Only admit cast.created payloads that actually mention or reply to the bot.
// - Keep the route payload-neutral; downstream worker logic owns conversation
//   setup and reply behavior.
// Document Provenance:
// - Source: Neynar Documentation, Webhooks in Dashboard
// - Kind: official API doc
// - Retrieved: 2026-04-15
// - Applied To: `/api/webhook/neynar` callback expectations and cast.created
//   mention/reply event shape
// - Verification: verified in docs
// - Source: Neynar Documentation, Verify Webhooks with HMAC Signatures
// - Kind: official API doc
// - Retrieved: 2026-04-15
// - Applied To: X-Neynar-Signature validation on raw request bodies
// - Verification: verified in docs
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-neynar-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import {
  normalizeNeynarWebhookMention,
  verifyNeynarWebhookSignature,
} from '../services/farcaster-agent/neynarWebhookService.js';
import { farcasterIngressWorker } from '../services/farcaster-agent/farcasterIngressWorker.js';

interface NeynarWebhookPayload {
  type?: string | null;
}

function getRequestSignature(request: FastifyRequest): string {
  const header = request.headers['x-neynar-signature'];
  if (Array.isArray(header)) {
    return String(header[0] || '').trim();
  }
  return String(header || '').trim();
}

export default async function neynarWebhookRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/', { config: { rawBody: true } }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!env.farcasterAgent.neynarWebhookEnabled || !env.farcasterAgent.neynarWebhookSecret) {
      return reply.status(503).send({ error: 'Neynar webhook ingress disabled' });
    }

    const rawBody = String((request as any).rawBody || '');
    if (!rawBody) {
      return reply.status(400).send({ error: 'Missing raw body' });
    }

    const signature = getRequestSignature(request);
    if (!verifyNeynarWebhookSignature(signature, rawBody, env.farcasterAgent.neynarWebhookSecret)) {
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    let payload: NeynarWebhookPayload & Record<string, any>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return reply.status(400).send({ error: 'Invalid JSON body' });
    }

    const mention = normalizeNeynarWebhookMention(payload, env.farcasterAgent.botFid);
    logger.info(LogCode.SYS_INFO, '[Farcaster][Neynar] webhook ingress received', {
      type: String(payload?.type || '').trim(),
      botFid: env.farcasterAgent.botFid,
      accepted: Boolean(mention),
      castHash: mention?.castHash || null,
      notificationType: mention?.notificationType || null,
    });

    if (!mention) {
      return reply.send({ ok: true, accepted: 0 });
    }

    const accepted = await farcasterIngressWorker.enqueueMention(mention);
    return reply.send({
      ok: true,
      accepted: accepted ? 1 : 0,
      eventId: mention.eventId,
    });
  });
}

