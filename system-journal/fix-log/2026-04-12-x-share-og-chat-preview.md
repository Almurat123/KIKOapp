# Fix Log: 2026-04-12 X Share OG Chat Preview

## What changed

The public X reply share card no longer renders as a generic marketing poster.

The new visual contract is:

1. top-left KiKo brand pill
2. the user's original prompt as a right-aligned message bubble
3. a partial AI reply preview underneath
4. a bottom fade that suggests more content exists in KIKO
5. a small CTA/footer instead of a dominant hero button inside the image

The share persistence model was also expanded to store the original prompt so the image can render a real conversation preview.

## Why

The first share-card implementation over-indexed on brand/title and under-indexed on conversation trust.

For X clickthrough, the card needs to feel like:

- a real chat screenshot
- a preview of an existing answer
- something the user wants to open to continue reading

That means the user prompt and partial assistant answer must dominate the visual hierarchy.

## Document provenance

### Source 1
- Source: X Cards Getting Started
- Kind: official API doc
- Retrieved: 2026-04-12
- Applied to:
  - keeping the card image on a crawler-safe server route
  - continuing to use `summary_large_image`
- Verification: partially verified

### Source 2
- Source: X Cards Markup
- Kind: official API doc
- Retrieved: 2026-04-12
- Applied to:
  - preserving `twitter:*` image/title/description metadata while redesigning the actual image layout
- Verification: partially verified

### Source 3
- Source: user-provided Grok share screenshot in active task thread
- Kind: runtime/design reference
- Retrieved: 2026-04-12
- Applied to:
  - choosing a conversation-screenshot visual instead of a title-first poster
  - placing brand as a small pill
  - placing the prompt bubble above the AI preview
  - using bottom fade instead of filling the whole image with text
- Verification: verified in design direction

## Owner map

### `src/services/x/xReplyShareService.ts`
Owns:
- prompt summarization for share-safe storage
- summary-safe persistence for public preview

Does not own:
- SVG composition
- HTML presentation

### `src/routes/xShare.ts`
Owns:
- conversation-style share HTML
- conversation-style OG image bytes
- image fade/layout rules

Does not own:
- agent invocation
- session privacy rules

### `src/services/x/xIngressWorker.ts`
Owns:
- passing the original inbound mention text into share creation

Does not own:
- share presentation rules

## Design rules

- Do not render the OG image as a landing-page hero poster.
- The prompt bubble must be visible in the image.
- The AI preview must be partial and visually fade out at the bottom.
- The public image must never reveal full private conversation history.
- CTA text belongs near the bottom and must not overpower the conversation preview.

## Runtime verification status

Verified in code:
- share persistence now stores prompt text
- OG image route now renders prompt + partial reply layout
- share HTML mirrors the same conversation-first hierarchy

Not yet verified in runtime:
- live X card fetch and caching against production URLs
- exact crop/render behavior in the X timeline UI
