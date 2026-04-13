import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import {
  buildXReplyOpenAppUrl,
  buildXReplyShareImageVersion,
  buildXReplyShareImageUrl,
  buildXReplyShareUrl,
  getActiveXReplyShare,
  markXReplyShareOpened,
} from '../services/x/xReplyShareService.js';

// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Rowan
// Reason: X reply mode now publishes a KIKO-hosted share link instead of
//         returning full AI text directly on X. X card crawlers need a public
//         HTML page with stable meta tags and a public image route they can
//         fetch without user cookies or client-side rendering. The initial OG
//         poster was too marketing-like, so the image layout was corrected to
//         a chat-screenshot preview that shows the user's prompt and partial AI reply.
//         The first SVG draft relied on foreignObject and rendered blank under
//         sharp, so the public image now uses pure SVG text layout with a tighter
//         line budget that preserves a screenshot-like conversation composition.
//         The card now keeps the brand as a small wordmark and moves the title
//         to the bottom, matching the reference Grok-style hierarchy. The palette
//         was later tightened to an Apple-like graphite / system-blue language to
//         reduce visual noise and keep the card feeling like an actual product
//         screenshot instead of a marketing illustration. The final correction
//         removed the framed poster background and capsule branding, but keeps a
//         solid black X-card canvas so the preview is deterministic in clients.
//         The reply fade is now line-opacity based instead of a blocking overlay.
//         The prompt bubble has its own width calculation because user messages
//         and assistant prose are different visual objects and must not share
//         the same wrapping rules. Assistant preview text now wraps by estimated
//         pixel width and preserves paragraph boundaries from the real model
//         reply excerpt instead of forcing sentence-like fixed character cuts.
//         Later review showed the preview still read as too short because the
//         summary budget and line budget together exposed only about two lines.
//         The image now renders a deeper excerpt and uses a true bottom fade
//         mask instead of only fading line colors. A follow-up preview review
//         showed the assistant lines could still overflow on the right because
//         the local width heuristic was too optimistic for the actual rendered
//         Inter glyph widths under resvg. The width heuristic and safety margin
//         were tightened so lines wrap before the right edge. A final pass
//         added hard fragment splitting for overlong reply segments because
//         a purely word-based wrap still allowed some Latin lines to leak
//         across the usable canvas under resvg. A later design correction
//         showed the safety margin had become too conservative and forced the
//         assistant preview into the left half of the image. The body layout
//         now reclaims the right-side canvas and only keeps a small fixed
//         safety margin, so the card reads like a full-width conversation
//         excerpt instead of a narrow text column. A follow-up spacing
//         correction then relaxed the wrap again so the first reply line can
//         travel farther horizontally before breaking, matching the intended
//         conversation-screenshot density without reintroducing overflow. The
//         next correction then pushed the first line even farther so the body
//         reads like a true near-full-width excerpt instead of a still-cautious
//         paragraph block.
//         Production runtime later showed the OG image can render prompt/reply
//         text as tofu boxes on Linux when the render path depends on host
//         Fontconfig/Pango state. The final correction moved OG PNG generation
//         to `@resvg/resvg-js` with a shipped TTF font buffer so production no
//         longer depends on machine font configuration. A later production
//         check proved the server was running compiled `dist/` files without
//         copying font assets into `dist/assets`, so the renderer drew the
//         bubble/background but no text. The route now resolves fonts from both
//         `dist/assets` and `src/assets` to stay correct under the current
//         deployment model. A later production check proved the origin image
//         route was fixed while X still showed the old broken card, so this
//         layer now disables share-page caching and emits versioned OG image
//         URLs for new shares. Product behavior later clarified that a human
//         clicking the X card must land in KIKO, not stay on the API-owned
//         share page. The route therefore keeps crawler-readable HTML/meta for
//         card generation, but adds an immediate script + noscript redirect to
//         the real KIKO chat URL for browser users.
// Goal: expose a crawler-safe X share page and OG image endpoint that reveal
//       only preview-safe summary text while preserving a path back to the
//       private KIKO chat session.
// Owns: public HTML/meta rendering for X reply shares and dynamic OG image bytes.
// Does Not Own: share token generation, X reply policy, or private chat authorization.
// Design Language:
// - Return complete meta tags in server HTML; never rely on client-side React hydration for cards.
// - Expose only preview-safe summary text and branded affordances on public pages.
// - Keep the open-app target separate from the public share page itself.
// - Render enough assistant text to feel like a real answer excerpt before the fade begins.
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
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-12-x-share-og-chat-preview.md
// - Kind: repo doc
// - Retrieved: 2026-04-12
// - Applied To: pure SVG text rendering after foreignObject blanked out in sharp,
//   plus the screenshot-style hierarchy and bottom title treatment
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-12-x-share-og-chat-preview.md
// - Kind: repo doc
// - Retrieved: 2026-04-12
// - Applied To: removing CTA prominence and shifting the bottom copy into a
//   screenshot-style title treatment
// - Verification: verified in code
// - Source: Apple Human Interface Guidelines - Materials
// - Kind: official API doc
// - Retrieved: 2026-04-12
// - Applied To: restrained graphite surface treatment and system-blue accent
// - Verification: inferred from docs and applied in code
// - Source: Apple Human Interface Guidelines - Standard colors
// - Kind: official API doc
// - Retrieved: 2026-04-12
// - Applied To: system-blue accent and neutral dark surfaces that adapt cleanly
// - Verification: inferred from docs and applied in code
// - Source: user-provided design correction in active task thread
// - Kind: product/design reference
// - Retrieved: 2026-04-12
// - Applied To: removing framed poster chrome while keeping a deterministic black
//   canvas and replacing the hard fade overlay with line-opacity fading
// - Verification: verified in design direction
// - Source: user-provided design correction in active task thread
// - Kind: product/design reference
// - Retrieved: 2026-04-12
// - Applied To: separating prompt-bubble layout from assistant prose layout so
//   short user messages do not wrap unnecessarily
// - Verification: verified in design direction
// - Source: user-provided design correction in active task thread
// - Kind: product/design reference
// - Retrieved: 2026-04-12
// - Applied To: wrapping assistant preview text by visual width while preserving
//   real reply paragraph boundaries
// - Verification: verified in design direction
// - Source: production screenshot + latest `x_reply_shares` row with visible
//   prompt/summary text but tofu-box OG rendering
// - Kind: runtime observation
// - Retrieved: 2026-04-13
// - Applied To: replacing host Fontconfig-dependent text rendering with resvg
//   and a shipped TTF font buffer, then resolving that font from `dist` or
//   `src` depending on deployment layout
// - Verification: verified in runtime
// - Source: user-provided product correction in active task thread
// - Kind: product/design reference
// - Retrieved: 2026-04-13
// - Applied To: increasing the visible reply excerpt and restoring a true
//   bottom fade in the OG image
// - Verification: verified in design direction
// - Source: user-provided overflow screenshot in active task thread
// - Kind: runtime/design reference
// - Retrieved: 2026-04-13
// - Applied To: tightening assistant line-wrap width estimation and reply
//   layout safety margins so text does not cross the right edge, plus hard
//   fragment splitting for overlong reply segments
// - Verification: verified in local runtime
// - Source: user-provided layout correction in active task thread
// - Kind: product/design reference
// - Retrieved: 2026-04-13
// - Applied To: widening the assistant reply block so the preview uses the
//   right-side canvas instead of collapsing into a left-only column
// - Verification: verified in local runtime
// - Source: user-provided spacing correction in active task thread
// - Kind: product/design reference
// - Retrieved: 2026-04-13
// - Applied To: allowing the first reply line to run farther before wrapping
//   so the body reads like a denser conversation excerpt
// - Verification: verified in local runtime
// - Source: user-provided spacing correction in active task thread
// - Kind: product/design reference
// - Retrieved: 2026-04-13
// - Applied To: pushing the first reply line closer to a full-width run before
//   wrapping while preserving the no-overflow guarantee
// - Verification: verified in local runtime
// - Source: runtime verification against https://api.kikoapp.app/api/images/x-share/<token>.png
// - Kind: runtime observation
// - Retrieved: 2026-04-13
// - Applied To: disabling share-page caching and emitting versioned OG image
//   URLs so X card fetches do not keep stale broken previews
// - Verification: verified in runtime
// - Source: user-provided click-through screenshot in active task thread
// - Kind: runtime/product observation
// - Retrieved: 2026-04-13
// - Applied To: redirecting human visitors from the crawler-safe API share page
//   to the real KIKO chat target while preserving crawler-visible meta tags
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-11-x-reply-share-pages.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-12-x-share-og-chat-preview.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-x-share-og-font-embed.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-x-share-card-cache-busting.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-x-share-click-through-redirect.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function resolveXShareFontPath(): string {
  const candidates = [
    path.resolve(__dirname, '../assets/fonts/Inter-Variable.ttf'),
    path.resolve(__dirname, '../../src/assets/fonts/Inter-Variable.ttf'),
    path.resolve(process.cwd(), 'dist/assets/fonts/Inter-Variable.ttf'),
    path.resolve(process.cwd(), 'src/assets/fonts/Inter-Variable.ttf'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

const X_SHARE_FONT_PATH = resolveXShareFontPath();

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

function sanitizeOgText(input: string): string {
  return String(input || '')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\uFE0E\uFE0F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateVisualText(input: string, maxLength: number): string {
  const value = String(input || '').trim();
  if (!value) return '';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function wrapVisualText(input: string, maxCharsPerLine: number, maxLines: number): string[] {
  const normalized = String(input || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const words = normalized.split(' ');
  const lines: string[] = [];
  let current = '';

  const flush = () => {
    if (current) lines.push(current);
    current = '';
  };

  for (const word of words) {
    if (!word) continue;
    if (word.length > maxCharsPerLine) {
      flush();
      for (let index = 0; index < word.length; index += maxCharsPerLine) {
        lines.push(word.slice(index, index + maxCharsPerLine));
      }
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }

    flush();
    current = word;
  }

  flush();

  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  clipped[maxLines - 1] = `${clipped[maxLines - 1].slice(0, Math.max(1, maxCharsPerLine - 1)).trimEnd()}…`;
  return clipped;
}

function measureSvgTextWidth(input: string, fontSize: number): number {
  let width = 0;
  for (const char of String(input || '')) {
    if (/[A-Z0-9]/.test(char)) {
      width += fontSize * 0.69;
    } else if (/[a-z]/.test(char)) {
      width += fontSize * 0.59;
    } else if (/\s/.test(char)) {
      width += fontSize * 0.34;
    } else if (/[.,!?;:'"()\-]/.test(char)) {
      width += fontSize * 0.43;
    } else {
      width += fontSize * 1.02;
    }
  }
  return Math.ceil(width);
}

function splitSvgFragmentByWidth(input: string, maxWidth: number, fontSize: number): string[] {
  const normalized = String(input || '').trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let current = '';

  for (const char of normalized) {
    const candidate = current + char;
    if (current && measureSvgTextWidth(candidate, fontSize) > maxWidth) {
      chunks.push(current);
      current = char;
      continue;
    }
    current = candidate;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function wrapSvgTextByWidth(input: string, maxWidth: number, fontSize: number, maxLines: number): string[] {
  const paragraphs = String(input || '')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const sourceLines = paragraphs.length ? paragraphs : [String(input || '').replace(/\s+/g, ' ').trim()].filter(Boolean);
  const lines: string[] = [];

  for (const sourceLine of sourceLines) {
    const words = sourceLine.split(' ').filter(Boolean);
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (measureSvgTextWidth(candidate, fontSize) <= maxWidth) {
        current = candidate;
        continue;
      }

      if (current) lines.push(current);
      if (measureSvgTextWidth(word, fontSize) > maxWidth) {
        const fragments = splitSvgFragmentByWidth(word, maxWidth, fontSize);
        for (const fragment of fragments) {
          lines.push(fragment);
          if (lines.length >= maxLines) break;
        }
        current = '';
      } else {
        current = word;
      }
      if (lines.length >= maxLines) break;
    }

    if (lines.length >= maxLines) break;
    if (current) lines.push(current);
    if (lines.length >= maxLines) break;
  }

  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  clipped[maxLines - 1] = `${clipped[maxLines - 1].slice(0, Math.max(1, clipped[maxLines - 1].length - 1)).trimEnd()}…`;
  return clipped;
}

function buildPromptBubbleLayout(prompt: string): {
  lines: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  textX: number;
  textY: number;
} {
  const singleLine = truncateVisualText(prompt, 58);
  const singleLineWidth = measureSvgTextWidth(singleLine, 23);
  const maxBubbleWidth = 520;
  const horizontalPadding = 32;

  if (singleLineWidth + horizontalPadding * 2 <= maxBubbleWidth) {
    const width = Math.max(220, singleLineWidth + horizontalPadding * 2);
    return {
      lines: [escapeXml(singleLine)],
      x: 1072 - width,
      y: 152,
      width,
      height: 70,
      textX: 1072 - width + horizontalPadding,
      textY: 193,
    };
  }

  const lines = wrapVisualText(prompt, 36, 2).map((line) => escapeXml(line));
  return {
    lines,
    x: 620,
    y: 146,
    width: 452,
    height: 94,
    textX: 650,
    textY: 180,
  };
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
    <link rel="canonical" href="${openAppUrl}" />
    <noscript><meta http-equiv="refresh" content="0;url=${openAppUrl}" /></noscript>
    <script>
      window.location.replace(${JSON.stringify(params.openAppUrl)});
    </script>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at 18% 18%, rgba(10,132,255,0.16), transparent 28%),
          linear-gradient(180deg, #09090b 0%, #050507 100%);
        color: #f5f5f7;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .card {
        width: min(760px, 100%);
        border-radius: 34px;
        padding: 30px;
        background: rgba(15, 16, 19, 0.96);
        border: 1px solid rgba(255,255,255,0.06);
        box-shadow: 0 28px 90px rgba(0,0,0,0.48);
        overflow: hidden;
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 36px;
        padding: 0 14px;
        border-radius: 999px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.07);
        font-size: 17px;
        font-weight: 700;
        color: rgba(245,245,247,0.96);
      }
      .brand-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: #0a84ff;
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
        background: rgba(255,255,255,0.055);
        border: 1px solid rgba(255,255,255,0.06);
        color: rgba(245,245,247,0.96);
        font-size: 22px;
        line-height: 1.34;
        letter-spacing: -0.01em;
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
        color: rgba(245,245,247,0.36);
      }
      .reply-text {
        margin: 0;
        font-size: clamp(28px, 4vw, 42px);
        line-height: 1.28;
        color: rgba(245,245,247,0.93);
        white-space: pre-wrap;
      }
      .fade {
        pointer-events: none;
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 96px;
        background: linear-gradient(to bottom, rgba(15,16,19,0), rgba(15,16,19,0.98) 82%);
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
        background: #0a84ff;
        color: #ffffff;
      }
      .secondary {
        background: rgba(255,255,255,0.04);
        color: rgba(245,245,247,0.86);
        border: 1px solid rgba(255,255,255,0.07);
      }
      .foot {
        margin-top: 18px;
        font-size: 13px;
        color: rgba(245,245,247,0.46);
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
        <a class="button primary" href="${openAppUrl}">Trade in KIKO</a>
        <a class="button secondary" href="${shareUrl}">Share page</a>
      </div>
      <div class="foot">${title}. Open in KIKO to continue trading.</div>
    </main>
  </body>
</html>`;
}

function renderMultilineTextLines(params: {
  lines: string[];
  x: number;
  y: number;
  lineHeight: number;
  className: string;
  anchor?: 'start' | 'middle' | 'end';
}) {
  return params.lines
    .map((line, index) => {
      const dy = params.y + index * params.lineHeight;
      return `<text x="${params.x}" y="${dy}" class="${params.className}"${params.anchor ? ` text-anchor="${params.anchor}"` : ''}>${escapeXml(line)}</text>`;
    })
    .join('\n');
}

function renderShareSvg(params: { title: string; prompt: string; summary: string }) {
  const promptBubble = buildPromptBubbleLayout(sanitizeOgText(params.prompt));
  const summaryLines = wrapSvgTextByWidth(sanitizeOgText(params.summary), 1010, 31, 7);
  const promptLines = promptBubble.lines.map((line) => String(line || '').replace(/&amp;/g, '&').replace(/&#39;/g, "'"));

  return `
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    .promptText {
      font-family: Inter;
      font-size: 23px;
      font-weight: 500;
      fill: #F5F5F7;
    }
    .ctaText {
      font-family: Inter;
      font-size: 23px;
      font-weight: 700;
      fill: #F5F5F7;
    }
    .titleText {
      font-family: Inter;
      font-size: 15px;
      font-weight: 500;
      fill: #5D5D62;
    }
  </style>
  <defs>
    <linearGradient id="promptBubble" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0" stop-color="#1E1E21"/>
      <stop offset="1" stop-color="#26262A"/>
    </linearGradient>
    <linearGradient id="replyFadeGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="white" stop-opacity="1"/>
      <stop offset="62%" stop-color="white" stop-opacity="1"/>
      <stop offset="82%" stop-color="white" stop-opacity="0.46"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </linearGradient>
    <mask id="replyFadeMask">
      <rect x="112" y="286" width="1030" height="236" fill="url(#replyFadeGradient)"/>
    </mask>
  </defs>
  <rect width="1200" height="630" fill="#000000"/>
  <rect x="${promptBubble.x}" y="${promptBubble.y}" width="${promptBubble.width}" height="${promptBubble.height}" rx="${Math.floor(promptBubble.height / 2)}" fill="url(#promptBubble)" stroke="rgba(255,255,255,0.06)"/>
  ${renderMultilineTextLines({
    lines: promptLines,
    x: promptBubble.textX,
    y: promptBubble.lines.length > 1 ? promptBubble.y + 40 : promptBubble.y + 45,
    lineHeight: 28,
    className: 'promptText',
  })}
  <g mask="url(#replyFadeMask)">
    ${summaryLines
      .map((line, index) => `<text x="112" y="${320 + index * 39}" font-family="Inter" font-size="31" font-weight="500" fill="#F5F5F7">${escapeXml(line)}</text>`)
      .join('\n')}
  </g>
  <text x="112" y="566" class="ctaText">Trade in KIKO</text>
  <text x="1088" y="566" class="titleText" text-anchor="end">${escapeXml(sanitizeOgText(params.title))}</text>
</svg>`;
}

async function renderSharePng(params: { title: string; prompt: string; summary: string }) {
  const svg = renderShareSvg(params);
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: {
      fontFiles: [X_SHARE_FONT_PATH],
      loadSystemFonts: false,
      defaultFontFamily: 'Inter',
    },
  }).render();
  return Buffer.from(png.asPng());
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
      const imageUrl = buildXReplyShareImageUrl(share.token, buildXReplyShareImageVersion(share.createdAt));
      const openAppUrl = buildXReplyOpenAppUrl(share.chatSessionId);
      return reply
        .header('Cache-Control', 'no-store, max-age=0')
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
        const buffer = await renderSharePng({
          title: share.title,
          prompt: share.prompt,
          summary: share.summary,
        });
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
