# 2026-04-19 Chat Selector Chevron Spacing

## What Changed

- Removed the mobile `justify-content: space-between` rule from the inline
  model and thinking selector buttons in both the live chat composer and the
  welcome shell.
- Kept the selector buttons full-width on mobile, but aligned their contents to
  the start so the label and chevron remain visually packed together.
- Added owner comments to state that any spare horizontal space belongs outside
  the control, not between the label and the arrow icon.

## Why

The large gap was not coming from the icon size; it was caused by the mobile
button layout stretching the control to full width and then distributing the
label and chevron to opposite ends. That makes the selector read as a broken
row. The control should stay compact even when the button itself is full-width.

## Verification

- Verified in code that the mobile selector buttons now use
  `justify-content: flex-start` in both `Chat.module.css` and
  `WelcomeScreen.module.css`.
- Verified in code that the owner comments now record the packed label/chevron
  rule.

## Document Provenance

- Source: user screenshot on 2026-04-19 showing the selector label and chevron
  spaced too far apart
  - Kind: product doc
  - Retrieved: 2026-04-19
  - Applied To: replacing the mobile `space-between` alignment with a packed
    inline control layout
  - Verification: inferred
- Source: /Users/almurat/KiKo/kiko-web/src/components/Chat/ChatModelSelector.tsx
  - Kind: repo doc
  - Retrieved: 2026-04-19
  - Applied To: the shared selector owner boundary and label/chevron chrome
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-composer-mobile-containment.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-image-model-selector-sections.md
