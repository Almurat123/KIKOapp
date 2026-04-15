# 2026-04-16 Farcaster Agent Mode Prompt

## What Changed

- Added a Farcaster-only system prompt overlay in `nodePromptAssembler.ts`.
- The overlay explicitly tells the model that the turn is running in KiKo
  social-agent mode for a public Farcaster reply.
- The overlay sets the default response style to:
  - short
  - direct
  - conversational
  - only detailed when the user explicitly asks for detail

## Why

Runtime directives and cast formatting helped, but they still sat too late in
the pipeline. The model needed an earlier prompt-level reminder that this
surface is not the normal web chat product. Farcaster agent conversations are
closer to social in-thread replies, so the default response should be concise
and friend-like rather than report-like.

## Document Provenance

- Source: Neynar / Farcaster cast writing docs
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: treating Farcaster replies as plain cast text instead of rich report layout
  - Verification: verified in docs
- Source: user requirement that Agent mode should default to short social replies
  - Kind: product requirement
  - Retrieved: 2026-04-16
  - Applied To: system prompt overlay for `farcaster_agent`
  - Verification: verified in code and targeted tests

## Verification

- `npx tsx --test src/jobs/chat/nodePromptAssembler.test.ts`
  passed.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-farcaster-reply-style-directive.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-farcaster-reply-natural-wrap.md
- /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
