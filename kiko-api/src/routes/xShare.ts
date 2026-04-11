import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import sharp from 'sharp';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import {
  buildXReplyOpenAppUrl,
  buildXReplyShareImageUrl,
  buildXReplyShareUrl,
  getActiveXReplyShare,
  markXReplyShareOpened,
} from '../services/x/xReplyShareService.js';

// CONTEXT MEMORY
// Updated: 2026-04-12
// Author: Rowan
// Reason: X reply mode now publishes a KIKO-hosted share link instead of
//         returning full AI text directly on X. X card crawlers need a public
//         HTML page with stable meta tags and a public image route they can
//         fetch without user cookies or client-side rendering. The initial OG
//         poster was too marketing-like, so the image layout was corrected to
//         a chat-screenshot preview that shows the user's prompt and partial AI reply.
// Goal: expose a crawler-safe X share page and OG image endpoint that reveal
//       only preview-safe summary text while preserving a path back to the
//       private KIKO chat session.
// Owns: public HTML/meta rendering for X reply shares and dynamic OG image bytes.
// Does Not Own: share token generation, X reply policy, or private chat authorization.
// Design Language:
// - Return complete meta tags in server HTML; never rely on client-side React hydration for cards.
// - Expose only preview-safe summary text and branded affordances on public pages.
// - Keep the open-app target separate from the public share page itself.
// Document Provenance:
// - Source: X Cards markup + Getting started docs
// - Kind: official API doc
// - Retrieved: 2026-04-11
// - Applied To: server-rendered `twitter:*` card metadata and public image route
// - Verification: partially verified
// - Source: Open Graph protocol
// - Kind: official API doc
// - Retrieved: 2026-04-11
// - Applied To: fallback `og:*` metadata for X share pages
// - Verification: partially verified
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-11-x-reply-share-pages.md
// - Kind: repo doc
// - Retrieved: 2026-04-11
// - Applied To: public share page owner boundary and safety model
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-12-x-share-og-chat-preview.md
// - Kind: repo doc
// - Retrieved: 2026-04-12
// - Applied To: chat-screenshot visual direction for the OG image and share page
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-11-x-reply-share-pages.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-12-x-share-og-chat-preview.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

function escapeHtml(input: string): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(input: string): string {
  return escapeHtml(input);
}

function truncateVisualText(input: string, maxLength: number): string {
  const value = String(input || '').trim();
  if (!value) return '';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function renderShareHtml(params: {
  token: string;
  title: string;
  prompt: string;
  summary: string;
  shareUrl: string;
  imageUrl: string;
  openAppUrl: string;
}) {
  const title = escapeHtml(params.title);
  const prompt = escapeHtml(params.prompt);
  const summary = escapeHtml(params.summary);
  const shareUrl = escapeHtml(params.shareUrl);
  const imageUrl = escapeHtml(params.imageUrl);
  const openAppUrl = escapeHtml(params.openAppUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${summary}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${summary}" />
    <meta property="og:url" content="${shareUrl}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:site_name" content="KIKO" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${summary}" />
    <meta name="twitter:image" content="${imageUrl}" />
    <meta name="robots" content="noindex, noarchive, max-image-preview:large" />
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(49,103,255,0.18), transparent 40%),
          radial-gradient(circle at bottom right, rgba(0,207,164,0.16), transparent 35%),
          #090b12;
        color: #f7f8fb;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .card {
        width: min(760px, 100%);
        border-radius: 34px;
        padding: 30px;
        background: rgba(9, 11, 18, 0.94);
        border: 1px solid rgba(255,255,255,0.08);
        box-shadow: 0 28px 80px rgba(0,0,0,0.35);
        overflow: hidden;
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 36px;
        padding: 0 14px;
        border-radius: 999px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.08);
        font-size: 17px;
        font-weight: 700;
        color: rgba(255,255,255,0.96);
      }
      .brand-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: linear-gradient(135deg, #61a7ff, #00d2a4 88%);
      }
      .prompt-row {
        margin-top: 26px;
        display: flex;
        justify-content: flex-end;
      }
      .prompt-bubble {
        max-width: min(76%, 520px);
        padding: 18px 24px;
        border-radius: 999px;
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.94);
        font-size: 22px;
        line-height: 1.34;
      }
      .reply {
        position: relative;
        margin-top: 56px;
        min-height: 240px;
      }
      .reply-label {
        margin: 0 0 20px;
        font-size: 14px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.42);
      }
      .reply-text {
        margin: 0;
        font-size: clamp(28px, 4vw, 42px);
        line-height: 1.28;
        color: rgba(255,255,255,0.92);
        white-space: pre-wrap;
      }
      .fade {
        pointer-events: none;
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 96px;
        background: linear-gradient(to bottom, rgba(9,11,18,0), rgba(9,11,18,0.98) 82%);
      }
      .actions {
        margin-top: 18px;
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        border-radius: 999px;
        padding: 0 20px;
        text-decoration: none;
        font-weight: 600;
      }
      .primary {
        background: linear-gradient(135deg, #61a7ff, #00d2a4);
        color: #071119;
      }
      .secondary {
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.86);
        border: 1px solid rgba(255,255,255,0.08);
      }
      .foot {
        margin-top: 18px;
        font-size: 13px;
        color: rgba(255,255,255,0.48);
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="brand"><span class="brand-dot"></span>KiKo</div>
      <div class="prompt-row">
        <div class="prompt-bubble">${prompt}</div>
      </div>
      <section class="reply">
        <div class="reply-label">Reply preview</div>
        <p class="reply-text">${summary}</p>
        <div class="fade"></div>
      </section>
      <div class="actions">
        <a class="button primary" href="${openAppUrl}">Open in KIKO</a>
        <a class="button secondary" href="${shareUrl}">Share page</a>
      </div>
      <div class="foot">${title}. Full reply continues in KIKO.</div>
    </main>
  </body>
</html>`;
}

function renderShareSvg(params: { title: string; prompt: string; summary: string; openAppUrl: string }) {
  const title = escapeXml(params.title);
  const prompt = escapeXml(truncateVisualText(params.prompt, 88));
  const summary = escapeXml(truncateVisualText(params.summary, 260));
  const footer = escapeXml(params.openAppUrl.replace(/^https?:\/\//, ''));

  return `
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="120" y1="40" x2="1040" y2="590" gradientUnits="userSpaceOnUse">
      <stop stop-color="#10141F"/>
      <stop offset="0.55" stop-color="#0B0F18"/>
      <stop offset="1" stop-color="#080B12"/>
    </linearGradient>
    <linearGradient id="accent" x1="160" y1="120" x2="1030" y2="500" gradientUnits="userSpaceOnUse">
      <stop stop-color="#69ACFF"/>
      <stop offset="1" stop-color="#07D2A7"/>
    </linearGradient>
    <linearGradient id="replyFade" x1="0" y1="1" x2="0" y2="0" gradientUnits="objectBoundingBox">
      <stop offset="0" stop-color="#090B12"/>
      <stop offset="0.75" stop-color="#090B12" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#090B12" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" rx="0" fill="url(#bg)"/>
  <circle cx="112" cy="78" r="180" fill="#3D76FF" opacity="0.12"/>
  <circle cx="1070" cy="565" r="180" fill="#07D2A7" opacity="0.12"/>
  <rect x="72" y="56" width="1056" height="518" rx="38" fill="#090B12" stroke="rgba(255,255,255,0.09)"/>
  <rect x="112" y="96" width="120" height="40" rx="20" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.08)"/>
  <circle cx="138" cy="116" r="6" fill="url(#accent)"/>
  <text x="183" y="123" font-size="24" text-anchor="middle" fill="#F7F8FB" font-family="Arial, Helvetica, sans-serif" font-weight="700">KiKo</text>
  <foreignObject x="672" y="148" width="360" height="116">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex; justify-content:flex-end; align-items:flex-start; width:100%; height:100%;">
      <div style="max-width:360px; padding:18px 22px; border-radius:999px; background:rgba(255,255,255,0.08); color:rgba(247,248,251,0.95); font-family:Arial, Helvetica, sans-serif; font-size:24px; line-height:1.28; text-align:left; word-break:break-word;">
        ${prompt}
      </div>
    </div>
  </foreignObject>
  <text x="112" y="272" font-size="18" fill="rgba(247,248,251,0.38)" font-family="Arial, Helvetica, sans-serif" letter-spacing="2.8">REPLY PREVIEW</text>
  <foreignObject x="112" y="304" width="930" height="190">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, Helvetica, sans-serif; color: rgba(247,248,251,0.94); font-size: 46px; line-height: 1.18; font-weight: 500; word-break: break-word;">
      ${summary}
    </div>
  </foreignObject>
  <rect x="112" y="428" width="930" height="108" fill="url(#replyFade)"/>
  <text x="112" y="548" font-size="26" fill="#F7F8FB" font-family="Arial, Helvetica, sans-serif" font-weight="700">Open full reply in KIKO</text>
  <text x="112" y="579" font-size="20" fill="rgba(247,248,251,0.42)" font-family="Arial, Helvetica, sans-serif">${footer}</text>
  <text x="1042" y="579" font-size="16" text-anchor="end" fill="rgba(247,248,251,0.28)" font-family="Arial, Helvetica, sans-serif">${title}</text>
</svg>`;
}

export async function xShareRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { token: string } }>(
    '/x/share/:token',
    async (request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
      const share = await getActiveXReplyShare(request.params.token);
      if (!share) {
        return reply.code(404).type('text/plain; charset=utf-8').send('Share not found');
      }

      void markXReplyShareOpened(share.token);

      const shareUrl = buildXReplyShareUrl(share.token);
      const imageUrl = buildXReplyShareImageUrl(share.token);
      const openAppUrl = buildXReplyOpenAppUrl(share.chatSessionId);
      return reply
        .type('text/html; charset=utf-8')
        .send(renderShareHtml({
          token: share.token,
          title: share.title,
          prompt: share.prompt,
          summary: share.summary,
          shareUrl,
          imageUrl,
          openAppUrl,
        }));
    },
  );

  fastify.get<{ Params: { token: string } }>(
    '/api/images/x-share/:token.png',
    async (request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
      const share = await getActiveXReplyShare(request.params.token);
      if (!share) {
        return reply.code(404).type('text/plain; charset=utf-8').send('Image not found');
      }

      try {
        const svg = renderShareSvg({
          title: share.title,
          prompt: share.prompt,
          summary: share.summary,
          openAppUrl: buildXReplyOpenAppUrl(share.chatSessionId),
        });
        const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
        return reply
          .header('Cache-Control', 'public, max-age=300')
          .type('image/png')
          .send(buffer);
      } catch (error) {
        logger.warn(LogCode.SYS_ERROR, '[X] failed to render share OG image', {
          token: share.token,
          error: String((error as any)?.message || error || 'unknown_error'),
        });
        return reply.code(500).type('text/plain; charset=utf-8').send('Image render failed');
      }
    },
  );
}
