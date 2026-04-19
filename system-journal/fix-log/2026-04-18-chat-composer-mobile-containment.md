# 2026-04-18 Chat Composer Mobile Containment

## What Changed

- Added shrink-safe flex constraints to the welcome-shell and live-chat model
  selector row so the selector controls can contract inside the composer.
- Added mobile-only compact sizing so the two selectors plus upload, settings,
  and send actions remain on a single row.
- Added compact mobile labels for long model families such as `GPT Image 1.5`
  and `Grok Imagine` while leaving desktop labels unchanged.
- Added truncation rules to selector labels so long model names stop inside the
  control instead of pushing fixed-size buttons outside the glass shell.
- Narrowed mobile dropdown width so selector menus stay within the viewport.

## Why

The current mobile layout allowed the selector labels to keep too much
intrinsic width. Once image-model labels such as `Grok Imagine` were
introduced, the send button could be pushed past the rounded composer
boundary. The owner needs explicit `min-width: 0`, tighter fixed control
sizes, and compact mobile labels so the full action row stays on a single line
without overflow.

## Product Rule

- Composer controls must stay visually contained inside the chat input shell on
  mobile widths.
- Composer controls must remain on one row on mobile widths.
- Long model labels must truncate inside their control instead of stretching
  the input row wider than the shell.
- Welcome shell and live chat composer must follow the same responsive rules.

## Verification

- Verified in code that both `WelcomeScreen.module.css` and `Chat.module.css`
  now give the selector row `min-width: 0` and single-line mobile sizing.
- Verified in code that both selector buttons now ellipsize long labels.
- Verified in code that `ChatModelSelector.tsx` now exposes compact mobile
  family labels without changing the underlying model id.
- Verified `npm exec tsc --noEmit --pretty false` in `kiko-web`.
- Verified a mobile Playwright screenshot after the CSS change.

## Document Provenance

- Source: user screenshot showing the send button rendered outside the mobile
  composer shell
  - Kind: product doc
  - Retrieved: 2026-04-18
  - Applied To: requiring strict containment for the mobile input row
  - Verification: inferred
- Source: MDN flex property reference
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: documenting that flex items do not shrink below min-content
    size unless min-width/min-height is overridden
  - Verification: verified in docs
- Source: MDN text-overflow reference
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: truncating selector labels inside a single mobile row
  - Verification: verified in docs
- Source: operator requirement on 2026-04-18
  - Kind: product doc
  - Retrieved: 2026-04-18
  - Applied To: preserving a single-row mobile composer instead of a wrapped layout
  - Verification: inferred
- Source: /Users/almurat/KiKo/kiko-web/src/components/Chat/WelcomeScreen.tsx
  - Kind: repo doc
  - Retrieved: 2026-04-18
  - Applied To: confirming the welcome shell owns the same action row shape
  - Verification: verified in code
- Source: /Users/almurat/KiKo/kiko-web/src/components/Chat/ChatComposer.tsx
  - Kind: repo doc
  - Retrieved: 2026-04-18
  - Applied To: confirming the live composer owns the same action row shape
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-input-borderless-model-reasoning-selector.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-image-model-selector-sections.md
- /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
- /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
- /Users/almurat/KiKo/system-journal/conflicts.md
