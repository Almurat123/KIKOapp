import { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const CACHE_DIR = process.env.IMAGE_CACHE_DIR || '/tmp/kiko-image-cache';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const ALLOWED_HOSTS = new Set([
  'cdn.dexscreener.com',
  'raw.githubusercontent.com',
  'assets.coingecko.com',
  'coin-images.coingecko.com',
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

function buildPlaceholderSvg(_label?: string): Buffer {
  // [Logic]: Use a neutral image placeholder icon instead of URL-derived text
  // [Ref]: User feedback - "Post" text appearing from URL paths like /post/...
  // [Risk]: None - purely visual improvement
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#2a2a2a"/>
  <path d="M20 18h24c1.1 0 2 .9 2 2v24c0 1.1-.9 2-2 2H20c-1.1 0-2-.9-2-2V20c0-1.1.9-2 2-2z" fill="none" stroke="#666" stroke-width="2"/>
  <circle cx="26" cy="28" r="3" fill="#666"/>
  <path d="M18 40l8-10 6 7 4-5 10 12H18z" fill="#666"/>
</svg>`;
  return Buffer.from(svg);
}

function getLabelFromUrl(parsed: URL): string {
  // [Logic]: Only extract meaningful labels for avatar services, return empty for others
  // [Ref]: Prevents confusing labels like "Post" from URL paths
  // [Risk]: Some placeholder SVGs may look generic, but this is preferred over misleading text
  if (parsed.hostname === 'ui-avatars.com') {
    const name = parsed.searchParams.get('name');
    if (name) return decodeURIComponent(name);
  }
  return ''; // Return empty to trigger generic placeholder
}

export async function imageRoutes(fastify: FastifyInstance) {
  await ensureCacheDir();

  fastify.get('/token', async (request, reply) => {
    const setImageHeaders = (source: 'cache' | 'upstream' | 'fallback' | 'optimized') => {
      reply.removeHeader('Cross-Origin-Resource-Policy');
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
      reply.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
      reply.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
      reply.header('X-Image-Proxy', source);
    };

    const { url, w, q, mode } = request.query as { url?: string; w?: string; q?: string; mode?: string };
    if (!url) return reply.status(400).send({ error: 'Missing url' });

    const width = w ? parseInt(w, 10) : null;
    const quality = q ? parseInt(q, 10) : 80;

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

    // Create a unique hash that includes optimization params
    const cacheParams = `w=${width || 'full'}&q=${quality}`;
    const hash = crypto.createHash('sha256').update(parsed.toString() + cacheParams).digest('hex');
    const binPath = path.join(CACHE_DIR, `${hash}.bin`);
    const metaPath = path.join(CACHE_DIR, `${hash}.json`);

    // Original hash for raw storage (avoid re-fetching from upstream)
    const rawHash = crypto.createHash('sha256').update(parsed.toString()).digest('hex');
    const rawBinPath = path.join(CACHE_DIR, `${rawHash}_raw.bin`);
    const rawMetaPath = path.join(CACHE_DIR, `${rawHash}_raw.json`);

    const serveBuffer = (buffer: Buffer, contentType: string, source: any) => {
      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=604800, immutable');
      setImageHeaders(source);
      return reply.send(buffer);
    };

    // 1. Check optimized cache
    try {
      const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
      if (Date.now() - meta.timestamp <= CACHE_TTL_MS) {
        return serveBuffer(await fs.readFile(binPath), meta.contentType, 'cache');
      }
    } catch { }

    // 2. Fetch or load raw image
    let rawBuffer: Buffer;
    let rawContentType: string;

    try {
      const rawMeta = JSON.parse(await fs.readFile(rawMetaPath, 'utf8'));
      if (Date.now() - rawMeta.timestamp <= CACHE_TTL_MS) {
        rawBuffer = await fs.readFile(rawBinPath);
        rawContentType = rawMeta.contentType;
      } else {
        throw new Error('Raw cache expired');
      }
    } catch {
      // Fetch from upstream
      try {
        const response = await fetch(parsed.toString(), {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
          signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error(`Upstream returned ${response.status}`);

        rawBuffer = Buffer.from(await response.arrayBuffer());
        rawContentType = response.headers.get('content-type') || 'image/png';

        // Save raw
        await fs.writeFile(rawBinPath, rawBuffer);
        await fs.writeFile(rawMetaPath, JSON.stringify({ contentType: rawContentType, timestamp: Date.now() }));
      } catch (e: any) {
        console.error(`[ImageProxy] Upstream fetch failed for ${parsed.hostname}:`, e.message);
        if (mode === 'preview') {
          return reply.status(502).send({ error: 'Preview image fetch failed' });
        }
        const label = getLabelFromUrl(parsed);
        const fallback = buildPlaceholderSvg(label);
        return serveBuffer(fallback, 'image/svg+xml', 'fallback');
      }
    }

    // 3. Optimize with Sharp (Efficiency Protocol)
    try {
      let pipeline = sharp(rawBuffer);

      if (width) {
        pipeline = pipeline.resize(width, null, { withoutEnlargement: true });
      }

      // Convert to webp for better compression
      const optimizedBuffer = await pipeline
        .webp({ quality })
        .toBuffer();

      const optimizedContentType = 'image/webp';

      // Save optimized
      await fs.writeFile(binPath, optimizedBuffer);
      await fs.writeFile(metaPath, JSON.stringify({ contentType: optimizedContentType, timestamp: Date.now() }));

      return serveBuffer(optimizedBuffer, optimizedContentType, 'optimized');
    } catch (err) {
      console.error('[ImageProxy] Sharp error:', err);
      return serveBuffer(rawBuffer, rawContentType, 'upstream');
    }
  });
}
