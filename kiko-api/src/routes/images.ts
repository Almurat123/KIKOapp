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

function hashColor(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  const color = Math.abs(hash).toString(16).slice(0, 6).padEnd(6, '0');
  return `#${color}`;
}

function buildPlaceholderSvg(label: string): Buffer {
  const safeLabel = label.trim().slice(0, 6) || '?';
  const bg = hashColor(safeLabel);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="${bg}"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#ffffff">${safeLabel}</text>
</svg>`;
  return Buffer.from(svg);
}

function getLabelFromUrl(parsed: URL): string {
  if (parsed.hostname === 'ui-avatars.com') {
    const name = parsed.searchParams.get('name');
    if (name) return decodeURIComponent(name);
  }
  const path = parsed.pathname.split('/').filter(Boolean).pop();
  return path ? decodeURIComponent(path).slice(0, 12) : '?';
}

export async function imageRoutes(fastify: FastifyInstance) {
  await ensureCacheDir();

  fastify.get('/token', async (request, reply) => {
    const setImageHeaders = (source: 'cache' | 'upstream' | 'fallback') => {
      reply.removeHeader('Cross-Origin-Resource-Policy');
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
      reply.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
      reply.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
      reply.header('X-Image-Proxy', source);
    };

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

    reply.header('X-Image-Proxy-Host', parsed.hostname);

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
        setImageHeaders('cache');
        return reply.send(buffer);
      }
    } catch {
      // cache miss
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const acceptHeader = parsed.hostname === 'ui-avatars.com'
        ? 'image/svg+xml,image/png,image/webp,image/apng,image/*,*/*;q=0.8'
        : 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8';
      const response = await fetch(parsed.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': acceptHeader,
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const label = getLabelFromUrl(parsed);
        const fallback = buildPlaceholderSvg(label);
        reply.header('Content-Type', 'image/svg+xml');
        reply.header('Cache-Control', 'public, max-age=600');
        reply.header('X-Image-Proxy-Upstream-Status', String(response.status));
        setImageHeaders('fallback');
        return reply.send(fallback);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') || 'image/png';

      await fs.writeFile(binPath, buffer);
      await fs.writeFile(metaPath, JSON.stringify({ contentType, timestamp: Date.now() }));

      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=604800, immutable');
      reply.header('X-Image-Proxy-Upstream-Status', String(response.status));
      setImageHeaders('upstream');
      return reply.send(buffer);
    } catch (err) {
      clearTimeout(timeoutId);
      const label = getLabelFromUrl(parsed);
      const fallback = buildPlaceholderSvg(label);
      reply.header('Content-Type', 'image/svg+xml');
      reply.header('Cache-Control', 'public, max-age=600');
      reply.header('X-Image-Proxy-Upstream-Status', 'timeout');
      setImageHeaders('fallback');
      return reply.send(fallback);
    }
  });
}
