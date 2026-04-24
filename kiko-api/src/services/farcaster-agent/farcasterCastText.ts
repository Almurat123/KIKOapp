// CONTEXT MEMORY
// Updated: 2026-04-24
// Author: Linh Tran
// Reason: Public Farcaster replies need a side-effect-free text formatter so
//         tests can validate cast-safe wrapping without importing the whole
//         ingress worker and its runtime dependencies.
// Goal: format assistant output into a short, readable public cast reply that
//       stays byte-safe, strips markdown-only decoration that Farcaster renders
//       literally, reflows long sentence-heavy replies into short social
//       paragraphs, and only inserts line-break opportunities for continuous
//       text runs that would otherwise render as a single overflow token.
// Owns: whitespace normalization, display-line wrapping, and UTF-8 byte
//       truncation for public Farcaster replies.
// Does Not Own: reply publication, mention ingress, model generation, or
//               provider webhook delivery.
// Design Language:
// - Preserve meaningful paragraph boundaries instead of flattening replies.
// - Strip markdown-only emphasis so public casts read like plain social text.
// - Reflow long sentence-heavy replies into short paragraph groups before
//   publication so the cast reads like a natural in-thread reply.
// - Leave normal space-delimited sentences intact inside each paragraph; only
//   chunk continuous text runs that lack natural break points.
// - Keep truncation UTF-8 safe.
// - Do not decide whether a reply should be sent; callers own that policy.
// Document Provenance:
// - Source: Farcaster cast writing docs and runtime client observation
// - Kind: product doc / runtime observation
// - Retrieved: 2026-04-15
// - Applied To: short public replies with explicit wrap opportunities only for
//   continuous text
// - Verification: verified in docs and code
// - Source: runtime screenshot showing markdown emphasis markers rendered
//   literally in a published Farcaster reply
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: markdown decoration stripping before cast publication
// - Verification: verified in runtime observation and targeted tests
// - Source: runtime comparison against other Farcaster bots that format replies
//   as short conversational paragraphs instead of one dense block
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: sentence-aware paragraph reflow before cast publication
// - Verification: verified in targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-farcaster-reply-plain-text-sanitizer.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-farcaster-reply-sentence-reflow.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-farcaster-reply-natural-wrap.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-reply-text-wrapping.md
// - /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

const DEFAULT_CAST_REPLY_MAX_BYTES = 320;
const MAX_CAST_REPLY_LINE_CHARS = 42;
const MAX_SOCIAL_PARAGRAPH_CHARS = 110;
const MAX_SOCIAL_PARAGRAPH_SENTENCES = 2;

function markdownLinkToCastText(label: string, url: string): string {
  const normalizedLabel = String(label || '').trim();
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) return normalizedLabel;
  if (!normalizedLabel || /^open link$/i.test(normalizedLabel) || normalizedLabel === '打开链接') {
    return normalizedUrl;
  }
  return `${normalizedLabel}: ${normalizedUrl}`;
}

function stripCastMarkdownDecorators(text: string): string {
  return String(text || '')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, url) => markdownLinkToCastText(label, url))
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1');
}

function extractFirstUrl(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const url = match?.[1] || match?.[0] || '';
    if (url) return url.trim();
  }
  return null;
}

function compactDeploymentReceiptForCast(text: string): string | null {
  const normalized = stripCastMarkdownDecorators(text);
  const lower = normalized.toLowerCase();
  const isDeployReceipt =
    lower.includes('token deployed')
    || normalized.includes('代币已部署')
    || lower.includes('four.meme token')
    || lower.includes('clanker token');
  if (!isDeployReceipt) return null;

  const tokenPageUrl = extractFirstUrl(normalized, [
    /https?:\/\/(?:www\.)?clanker\.world\/\S+/i,
    /https?:\/\/(?:www\.)?four\.meme\/\S+/i,
  ]);
  const explorerUrl = extractFirstUrl(normalized, [
    /https?:\/\/(?:www\.)?basescan\.org\/token\/\S+/i,
    /https?:\/\/(?:www\.)?bscscan\.com\/token\/\S+/i,
  ]);
  const url = tokenPageUrl || explorerUrl;
  if (!url) return null;

  const launchpad = /four\.meme/i.test(url)
    ? 'Four.meme'
    : /clanker\.world/i.test(url)
      ? 'Clanker'
      : 'Token';
  return `${launchpad} token deployed.\n\n${url}`;
}

function normalizeCastReplyWhitespace(text: string): string {
  return (compactDeploymentReceiptForCast(text) || stripCastMarkdownDecorators(text))
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n\n')
    .map((paragraph) => paragraph
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join(' ')
      .trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function splitIntoSentences(line: string): string[] {
  const text = String(line || '').trim();
  if (!text) return [];
  const sentences: string[] = [];
  let current = '';

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const prev = index > 0 ? text[index - 1] : '';
    const next = index + 1 < text.length ? text[index + 1] : '';
    current += char;

    const isDecimalPoint = char == '.' && /\d/.test(prev) && /\d/.test(next);
    const isBoundaryPunctuation = /[.!?。！？]/.test(char) && !isDecimalPoint;
    const nextStartsNewSentence = !next || /\s/.test(next);

    if (isBoundaryPunctuation && nextStartsNewSentence) {
      const sentence = current.trim();
      if (sentence) sentences.push(sentence);
      current = '';
    }
  }

  const tail = current.trim();
  if (tail) sentences.push(tail);
  return sentences;
}

function isListLike(line: string): boolean {
  return /^([-*•]|\d+\.)\s+/.test(String(line || '').trim());
}

function reflowSocialParagraph(line: string): string[] {
  const text = String(line || '').trim();
  if (!text) return [];
  if (isListLike(text) || !/\s/.test(text)) return [text];

  const sentences = splitIntoSentences(text);
  if (sentences.length <= 1 && text.length <= MAX_SOCIAL_PARAGRAPH_CHARS) {
    return [text];
  }

  const groups: string[] = [];
  let current = '';
  let sentenceCount = 0;

  for (const sentence of sentences.length > 0 ? sentences : [text]) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    const shouldFlush = Boolean(current) && (
      candidate.length > MAX_SOCIAL_PARAGRAPH_CHARS
      || sentenceCount >= MAX_SOCIAL_PARAGRAPH_SENTENCES
    );
    if (shouldFlush) {
      groups.push(current);
      current = sentence;
      sentenceCount = 1;
    } else {
      current = candidate;
      sentenceCount += 1;
    }
  }

  if (current) groups.push(current);
  return groups;
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
  if (/^https?:\/\/\S+$/i.test(line)) return [line];
  if (/\s/.test(line)) return [line];
  const chunks = chunkContinuousText(line, maxChars);
  return chunks.length > 0 ? chunks : [''];
}

function wrapCastReplyText(text: string, maxChars: number = MAX_CAST_REPLY_LINE_CHARS): string {
  const paragraphs = text
    .split('\n\n')
    .flatMap((paragraph) =>
      reflowSocialParagraph(paragraph).map((line) =>
        wrapCastReplyLine(line, maxChars).join('\n')
      )
    )
    .filter(Boolean);

  return paragraphs
    .join('\n\n')
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
