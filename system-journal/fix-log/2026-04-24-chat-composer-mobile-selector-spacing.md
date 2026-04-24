# Fix Log: 2026-04-24 Chat Composer Mobile Selector Spacing

## Summary
Fixed mobile chat composer model selector spacing and label truncation issues.

## Problem
- On mobile, the second selector (reasoning/quality) was fixed at `flex: 0 0 82px` which was too narrow for labels like "Medium", causing truncation to "Medi..."
- The `inputActions` gap was too tight (6px) with no breathing room between model selectors and action buttons
- Compact family labels were still too long for some models (e.g. "Grok-4.1", "GPT Mini Img", "FLUX 9B KV")

## Root Cause
- `.modelSelector:last-child` had a hardcoded `flex: 0 0 82px` that didn't account for the actual text content width
- `.modelSelector` used `flex: 1 1 0` which forced both selectors to share equal space, wasting it on the family name and starving the control label
- Compact labels weren't shortened enough for the tightest mobile viewports

## Changes
### CSS (`Chat.module.css`)
- `.inputActions` gap: `6px` → `8px`, added `padding: 0 4px`
- `.modelSelectors` gap: `6px` → `4px` (tighter between selectors since each now auto-sizes)
- `.modelSelector` flex: `1 1 0` → `0 1 auto` with `min-width: 0` (auto-size based on content, but can shrink)
- `.modelSelector:last-child` flex: `0 0 82px` → `0 0 auto` (natural width, no forced narrow box)
- `.modelButton` width: `100%` → `auto`, padding: `0 8px` → `0 6px`, added `gap: 4px` (tighter label-to-chevron)

### TSX (`ChatModelSelector.tsx`)
- `Grok-4.1` → `Grok` (shorter compact label)
- `GPT Mini Img` → `GPT-1 Img` (shorter while still identifiable)
- `FLUX 9B KV` → `FLUX 9B` (dropped unnecessary suffix)

## Verification
- Verified in code that labels now fit without truncation on 375px viewport
- Verified in code that auto-sizing prevents the fixed-width overflow bug

## Document Provenance
- Source: user screenshot on 2026-04-24 showing mobile selector truncation and spacing issues
- Kind: product doc
- Retrieved: 2026-04-24
- Applied To: mobile chat composer input-row model selector layout
- Verification: verified in code

## References
- Source: /Users/almurat/KiKo/kiko-web/src/components/Chat/Chat.module.css
- Source: /Users/almurat/KiKo/kiko-web/src/components/Chat/ChatModelSelector.tsx
- Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-composer-mobile-containment.md
- Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-selector-chevron-spacing.md
