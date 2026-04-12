# Farcaster Mini App Promo Assets

Updated: 2026-04-11

## Purpose

Define the final brand-asset direction for KiKo's Farcaster Mini App surfaces:
use poster-first typography, pure gradient backdrops, and a small number of
high-contrast words instead of screenshot-replica compositions. The current
approved direction is closer to a product poster than a UI mockup: one dominant
visual anchor, sparse supporting copy, and a controlled brand mark.

## Canonical Rules

1. Preview and promotional art should read like polished product posters, not
   like direct recreations of the in-app UI.
2. Loading art should foreground the brand avatar / mark as the central object,
   with minimal or no supporting copy.
3. Copy-trading promotion should communicate the theme with concise labels and
   readable hierarchy, not dense feature dumps.
4. Backgrounds should stay clean and current: soft mesh gradients for light
   surfaces, dark glassmorphism for trading promotions.
5. Preview art should keep one calm stage with a single product story, not a
   screenshot collage or a dense UI panel stack.
6. When the surface is about prompting or conversation, the preview should
   read as a chat-first poster with a glass composer and a few readable AI
   messages or a clean task-report card.
7. Loading surfaces should use the logo mark itself, not a poster image or a
   screenshot-derived composition.

## Forbidden Local Patch Patterns

- Reusing ugly product screenshots as the main visual anchor.
- Adding accidental blank rails, empty placeholders, or clipped helper text.
- Overloading the promo surface with too many microcopy fragments.
- Letting model-generated imagery override the approved poster layout.

## Accepted Outputs

- `/Users/almurat/KiKo/kiko-web/public/farcaster-preview.png`
- `/Users/almurat/KiKo/kiko-web/public/farcaster-promo.png`
- `/Users/almurat/KiKo/kiko-web/public/farcaster-social.png`
- `/Users/almurat/KiKo/kiko-web/public/icon.png`

The working render folders under `output/` were intentionally pruned from the
repository after export so the branch keeps only the published assets. The
loading surface is now canonicalized to the separate logo splash at
`/farcaster-splash.png`, while `/icon.png` remains the favicon / touch icon.
The public app naming now uses the longer `KiKo your best way to trade !`
brand string in the shell and manifest.

## Document Provenance

- Source: user feedback in the thread and attached screenshot references
  - Kind: runtime observation
  - Retrieved: 2026-04-11
  - Applied To: final poster-first asset direction, preview text-only response layout, and avatar-first loading treatment
  - Verification: verified in generated local outputs

- Source: local asset export into `kiko-web/public`
  - Kind: runtime observation
  - Retrieved: 2026-04-12
  - Applied To: canonical published asset paths after pruning the generated working renders
  - Verification: verified in file layout

- Source: logo-only loading correction from user feedback
  - Kind: runtime observation
  - Retrieved: 2026-04-12
  - Applied To: canonical loading splash choice and removal of the poster-style loading asset from publication
  - Verification: verified in local asset references

- Source: user-provided app name and subtitle correction
  - Kind: runtime observation
  - Retrieved: 2026-04-12
  - Applied To: Farcaster manifest naming, subtitle, and share metadata
  - Verification: verified in shell and manifest updates

- Source: Farcaster Mini Apps publishing guide
  - Kind: official API doc
  - Retrieved: 2026-04-12
  - Applied To: canonical `iconUrl` and `splashImageUrl` size split, plus
    the separate logo splash asset
  - Verification: verified in docs

- Source: Farcaster Mini Apps sharing guide
  - Kind: official API doc
  - Retrieved: 2026-04-10
  - Applied To: image size expectations for promotional surfaces
  - Verification: verified in docs

See also:
- `system-journal/INDEX.md`
- `system-journal/design-language/farcaster-miniapp-shell.md`
- `system-journal/fix-log/2026-04-10-farcaster-miniapp-support.md`
- `system-journal/fix-log/2026-04-12-farcaster-manifest-splash-fix.md`
