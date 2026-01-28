import { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const CACHE_DIR = process.env.IMAGE_CACHE_DIR || '/tmp/kiko-image-cache';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const ALLOWED_HOSTS = new Set([
  'cdn.dexscreener.com',
  'raw.githubusercontent.com',
  'assets.coingecko.com',
  'ipfs.io',
  'cloudflare-ipfs.com',
  'api.geckoterminal.com',
  'ui-avatars.com',
]);

async function ensureCacheDir(): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

function isAllowedUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return ALLOWED_HOSTS.has(host);
}

export async function imageRoutes(fastify: FastifyInstance) {
  await ensureCacheDir();

  fastify.get('/token', async (request, reply) => {
    const { url } = request.query as { url?: string };
    if (!url) return reply.status(400).send({ error: 'Missing url' });

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return reply.status(400).send({ error: 'Invalid url' });
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return reply.status(400).send({ error: 'Invalid protocol' });
    }

    // OGP images can come from anywhere, so we allow all HTTP/HTTPS hosts
    // if (!isAllowedUrl(parsed)) {
    //   return reply.status(403).send({ error: 'Host not allowed' });
    // }

    const hash = crypto.createHash('sha256').update(parsed.toString()).digest('hex');
    const binPath = path.join(CACHE_DIR, `${hash}.bin`);
    const metaPath = path.join(CACHE_DIR, `${hash}.json`);

    try {
      const metaRaw = await fs.readFile(metaPath, 'utf8');
      const meta = JSON.parse(metaRaw) as { contentType?: string; timestamp?: number };
      const age = meta.timestamp ? Date.now() - meta.timestamp : CACHE_TTL_MS + 1;
      if (age <= CACHE_TTL_MS) {
        const buffer = await fs.readFile(binPath);
        reply.header('Content-Type', meta.contentType || 'image/png');
        reply.header('Cache-Control', 'public, max-age=604800, immutable');
        return reply.send(buffer);
      }
    } catch {
      // cache miss
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(parsed.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (image-proxy)',
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return reply.status(502).send({ error: 'Upstream failed' });
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') || 'image/png';

      await fs.writeFile(binPath, buffer);
      await fs.writeFile(metaPath, JSON.stringify({ contentType, timestamp: Date.now() }));

      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=604800, immutable');
      return reply.send(buffer);
    } catch (err) {
      clearTimeout(timeoutId);
      return reply.status(504).send({ error: 'Upstream timeout' });
    }
  });
}

