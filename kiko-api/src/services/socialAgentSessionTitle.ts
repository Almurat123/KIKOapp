// CONTEXT MEMORY
// Updated: 2026-04-20
// Author: Rowan
// Reason: social-agent sessions created from X/Farcaster should be readable in
//         the normal chat history list. The old titles only carried platform
//         and author handle, so multiple agent-created sessions from the same
//         author were hard to distinguish. This helper centralizes the product
//         title shape instead of letting each ingress service invent its own
//         string.
// Goal: generate deterministic social-agent session titles in the form
//       `HH:mm platform message-prefix` for X and Farcaster agent-created
//       sessions only.
// Owns: social-agent session title formatting, input cleanup, platform labels,
//       and message-prefix truncation.
// Does Not Own: ordinary web chat title generation, session persistence,
//               social ingress admission, or model selection.
// Design Language:
// - Social-agent titles start with service-local `HH:mm` time.
// - Platform labels are lowercase `x` or `farcaster`.
// - The suffix comes from the user's original message prefix, not model output.
// - Strip leading @handles so titles do not collapse to the bot mention.
// - forbidden local patch pattern: platform-specific ad hoc title builders with
//   different separators or truncation rules.
// Document Provenance:
// - Source: operator request on 2026-04-20
// - Kind: product doc
// - Retrieved: 2026-04-20
// - Applied To: X/Farcaster agent-created chat session title format
// - Verification: verified in targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-social-agent-session-title-format.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-user-default-chat-model-for-x-mentions.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-farcaster-polling-agent-ingress.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

export type SocialAgentSessionPlatform = 'x' | 'farcaster';

const DEFAULT_PREFIX_MAX_LENGTH = 32;

function padTimePart(value: number): string {
  return String(Math.max(0, Math.trunc(value || 0))).padStart(2, '0');
}

export function formatSocialAgentSessionTime(createdAt: Date = new Date()): string {
  const safeDate = Number.isFinite(createdAt.getTime()) ? createdAt : new Date();
  return `${padTimePart(safeDate.getHours())}:${padTimePart(safeDate.getMinutes())}`;
}

export function normalizeSocialAgentSessionTitlePrefix(
  input?: string | null,
  maxLength = DEFAULT_PREFIX_MAX_LENGTH,
): string {
  const compact = String(input || '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const withoutLeadingHandles = compact.replace(/^(@[a-zA-Z0-9_.-]+\s*)+/g, '').trim();
  const source = withoutLeadingHandles || compact || 'message';
  const limit = Math.max(8, Math.trunc(Number(maxLength) || DEFAULT_PREFIX_MAX_LENGTH));
  const chars = Array.from(source);
  if (chars.length <= limit) return source;
  return `${chars.slice(0, limit).join('').trimEnd()}...`;
}

export function buildSocialAgentSessionTitle(params: {
  platform: SocialAgentSessionPlatform;
  text?: string | null;
  createdAt?: Date;
  prefixMaxLength?: number;
}): string {
  const platform = params.platform === 'farcaster' ? 'farcaster' : 'x';
  const time = formatSocialAgentSessionTime(params.createdAt || new Date());
  const prefix = normalizeSocialAgentSessionTitlePrefix(params.text, params.prefixMaxLength);
  return `${time} ${platform} ${prefix}`;
}
