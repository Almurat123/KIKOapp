// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Linh Tran
// Reason: Public Farcaster replies need a side-effect-free text formatter so
//         tests can validate cast-safe wrapping without importing the whole
//         ingress worker and its runtime dependencies.
// Goal: format assistant output into a short, readable public cast reply that
//       stays byte-safe and only inserts line-break opportunities for
//       continuous text runs that would otherwise render as a single overflow
//       token.
// Owns: whitespace normalization, display-line wrapping, and UTF-8 byte
//       truncation for public Farcaster replies.
// Does Not Own: reply publication, mention ingress, model generation, or
//               provider webhook delivery.
// Design Language:
// - Preserve meaningful paragraph boundaries instead of flattening replies.
// - Leave normal space-delimited sentences intact; only chunk continuous text
//   runs that lack natural break points.
// - Keep truncation UTF-8 safe.
// - Do not decide whether a reply should be sent; callers own that policy.
// Document Provenance:
// - Source: Farcaster cast writing docs and runtime client observation
// - Kind: product doc / runtime observation
// - Retrieved: 2026-04-15
// - Applied To: short public replies with explicit wrap opportunities only for
//   continuous text
// - Verification: verified in docs and code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-farcaster-reply-natural-wrap.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-reply-text-wrapping.md
// - /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

const DEFAULT_CAST_REPLY_MAX_BYTES = 320;
const MAX_CAST_REPLY_LINE_CHARS = 42;

function normalizeCastReplyWhitespace(text: string): string {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function chunkContinuousText(value: string, maxChars: number): string[] {
  const chars = Array.from(value);
  const chunks: string[] = [];
  for (let index = 0; index < chars.length; index += maxChars) {
    chunks.push(chars.slice(index, index + maxChars).join(''));
  }
  return chunks;
}

function wrapCastReplyLine(line: string, maxChars: number): string[] {
  if (!line) return [''];
  if (/\s/.test(line)) return [line];
  const chunks = chunkContinuousText(line, maxChars);
  return chunks.length > 0 ? chunks : [''];
}

function wrapCastReplyText(text: string, maxChars: number = MAX_CAST_REPLY_LINE_CHARS): string {
  return text
    .split('\n')
    .flatMap((line) => wrapCastReplyLine(line, maxChars))
    .join('\n')
    .trim();
}

function truncateUtf8Text(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text;

  let output = '';
  for (const char of text) {
    const candidate = `${output}${char}`;
    if (Buffer.byteLength(`${candidate}...`, 'utf8') > maxBytes) {
      break;
    }
    output = candidate;
  }
  return `${output.trim()}...`;
}

export function trimCastText(text: string, maxBytes: number = DEFAULT_CAST_REPLY_MAX_BYTES): string {
  const normalized = normalizeCastReplyWhitespace(text);
  if (!normalized) return 'I ran into an issue processing that request. Please try again.';
  return truncateUtf8Text(wrapCastReplyText(normalized), maxBytes);
}
