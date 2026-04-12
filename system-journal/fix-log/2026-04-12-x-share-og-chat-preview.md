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
The first SVG draft used `foreignObject`, but runtime rendering under `sharp` produced blank output, so the card image now uses pure SVG text elements.
The final layout tightens the reply line budget so the fade and CTA remain visible inside X card crops.
The card image CTA was further demoted so the layout reads like a captured conversation, not a landing page.

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

### Source 4
- Source: local runtime render test of the share OG SVG
- Kind: runtime observation
- Retrieved: 2026-04-12
- Applied to:
  - replacing SVG `foreignObject` with pure text rendering after the first draft rendered blank
- Verification: verified in runtime

### Source 5
- Source: local runtime render test of the refined share OG SVG
- Kind: runtime observation
- Retrieved: 2026-04-12
- Applied to:
  - tightening the reply line budget and CTA spacing so the card crop keeps the fade and footer visible
- Verification: verified in runtime

### Source 6
- Source: user-provided design correction in active task thread
- Kind: product/design reference
- Retrieved: 2026-04-12
- Applied to:
  - demoting CTA prominence further so the share image reads as a conversation screenshot rather than a marketing poster
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

## Palette refinement

The share card palette was tightened after the initial chat-screenshot layout landed.
The background now uses a restrained graphite surface with a single system-blue accent,
instead of mixed blue/green decorative glow. This keeps the card closer to the user's
reference screenshot and closer to Apple's restrained dark-material language.

### Additional provenance

- Source: Apple Human Interface Guidelines - Materials
- Kind: official API doc
- Retrieved: 2026-04-12
- Applied to: dark graphite surface treatment, low-noise layering, and soft contrast
- Verification: inferred from docs and applied in code

- Source: Apple Human Interface Guidelines - Standard colors
- Kind: official API doc
- Retrieved: 2026-04-12
- Applied to: system-blue accent and avoidance of multicolor decorative halos
- Verification: inferred from docs and applied in code

## Minimal composition correction

After reviewing the user's follow-up screenshot, the card was further reduced to the
minimum conversation grammar:

1. prompt bubble
2. partial AI reply
3. bottom title

The framed poster background and capsule branding were removed from the OG image because
the user's intended semantic reads as a raw conversation snippet, not a poster or framed
card. The image still keeps a solid black canvas because X card clients need deterministic
image pixels; transparent previews are too dependent on the consuming client's background.

The bottom fade is no longer a rectangle overlay. Reply preview lines now reduce opacity
line by line, which is closer to the reference screenshot and avoids the heavy "covered by
a mask" look.

The prompt bubble now uses a separate sizing rule from the assistant body. Short user
messages stay on one line and the bubble hugs the message width; assistant text remains
paragraph-like and may wrap across multiple preview lines.

The assistant preview now preserves paragraph boundaries from the model output and wraps
by estimated SVG text width. This avoids the earlier fixed-character wrapping that made
the reply look like artificial line chunks instead of a real assistant response excerpt.

The bottom copy was reworded from reply language into trade language so the share card
reads like an invitation to continue in KIKO, not as a generic chat artifact.

### Additional provenance

- Source: user-provided design correction in active task thread
- Kind: product/design reference
- Retrieved: 2026-04-12
- Applied to: removing framed poster chrome, keeping a deterministic black canvas, and
  replacing the fade overlay with line-opacity fading
- Verification: verified in design direction

- Source: user-provided design correction in active task thread
- Kind: product/design reference
- Retrieved: 2026-04-12
- Applied to: separating prompt bubble sizing from assistant prose wrapping
- Verification: verified in design direction

- Source: user-provided design correction in active task thread
- Kind: product/design reference
- Retrieved: 2026-04-12
- Applied to: preserving real AI reply paragraph shape and wrapping preview text by
  visual width rather than fixed sentence-like character cuts
- Verification: verified in design direction

- Source: user-provided product copy correction in active task thread
- Kind: product/design reference
- Retrieved: 2026-04-12
- Applied to: changing bottom CTA copy from reply wording to trade wording
- Verification: verified in design direction
