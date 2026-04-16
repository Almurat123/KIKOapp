# 2026-04-16 Social Agent Thread Context And Image Input

## What Changed

- X mention ingress now hydrates the current post plus a bounded parent thread
  from the X REST API before model execution.
- X ingress now preserves attached media from the current post, referenced
  quoted/replied posts, and parent posts as a normalized social-agent image list.
- Farcaster mention ingress now hydrates the current cast plus parent thread and
  preserves image-bearing embeds from Neynar cast lookup data. Hub fallback now
  also preserves direct URL embeds when they look like image assets.
- Both X and Farcaster chat bridges now persist:
  - a plain text transport message for audit/history
  - a separate `socialInput` envelope in message data and task `toolContext`
- Prompt assembly now turns `socialInput` into:
  - real multimodal `content` arrays with `text` + `image_url` parts on
    verified vision-capable provider/model paths
  - explicit image-URL fallback text on provider/model paths that are not
    verified for image input
- Python generation and gateway schemas now allow structured `content` values
  instead of forcing every message into plain text.

## Why

The old social-agent path only handed plain text to the model:

- X only passed the current mention text.
- Farcaster passed parent-thread text but dropped image-bearing embeds.

That meant the model could not actually see post images, and on X it also could
not see the surrounding thread context. The current fix keeps text history
stable for audit/replay, but adds a separate current-turn multimodal envelope so
vision-capable providers can receive the real post images without polluting
replayed history or tool-state contracts.

The provider policy is intentionally conservative:

- OpenAI is enabled for true image input because the official Chat Completions
  docs explicitly show `content` arrays with `text` and `image_url` parts.
- NVIDIA Kimi and xAI Grok were initially left on fallback until their official
  image contracts were verified; they are now enabled in
  /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-kimi-grok-social-image-input.md.
- NVIDIA GLM still falls back to labeled image URLs until the active endpoint
  documents image input.

## Document Provenance

- Source: X documentation, expansions and media fields
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: `attachments.media_keys`,
    `referenced_tweets.id`,
    `referenced_tweets.id.attachments.media_keys`,
    and media-field hydration for X mention turns
  - Verification: verified in docs
- Source: Neynar documentation, cast lookup by hash or URL
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: preserving Farcaster cast embeds and thread context through
    Neynar cast hydration
  - Verification: verified in docs and code
- Source: Neynar documentation, fetch all notifications / listen for @bot mentions
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: Farcaster mention/reply ingress assumptions for webhook and
    notification-fed events
  - Verification: verified in docs and existing ingress code
- Source: OpenAI documentation, Images and vision / Chat Completions
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: OpenAI-only multimodal current-turn `content` arrays using
    `text` and `image_url` parts
  - Verification: verified in docs and code
- Source: repo runtime inspection of `grok/router.py` and current NVIDIA chat
  gateway path
  - Kind: repo code
  - Retrieved: 2026-04-16
  - Applied To: initial non-OpenAI fallback to labeled image URLs instead of
    claiming unverified multimodal support
  - Verification: verified in code
- Source: NVIDIA NIM moonshotai/kimi-k2.5 inference docs and xAI Image Understanding docs
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: later Kimi/Grok true image-input enablement
  - Verification: verified in docs and code

## Verification

- `npm test -- src/jobs/chat/nodePromptAssembler.test.ts src/services/farcaster-agent/farcasterApiClient.test.ts`
  passed.
- `npx tsc --noEmit`
  pending at the time this note was first drafted, then completed successfully
  in the same task.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/social-agent-multimodal-input.md
- /Users/almurat/KiKo/system-journal/owner-map/social-agent-multimodal-input.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-kimi-grok-social-image-input.md
- /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-neynar-webhook-ingress.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-x-mention-feed-confirmation.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-farcaster-agent-mode-prompt.md
