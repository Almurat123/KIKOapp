# 2026-04-20 Homepage MakeDream Aura Parity

## Problem

The KiKo homepage aura background was only a loose approximation of the
MakeDream AI chat background.

It diverged in multiple visible ways:

- theme interpolation was continuous instead of holding and then transitioning
- blobs used internal radial gradients instead of solid blurred ellipses
- a noise layer and light-theme variant changed the final look
- the MakeDream chat dark veil was missing

That meant the homepage could not visually match the MakeDream AI chat surface
1:1 on desktop or mobile.

## Root Cause

`kiko-web/src/components/Effects/AuraBackground.tsx` had evolved into a
theme-aware web effect instead of staying grounded to the MakeDream owner
implementation.

`kiko-web/src/components/Chat/WelcomeScreen.tsx` also still treated the
homepage aura as a generic welcome background rather than a parity-bound visual
surface with external provenance.

Follow-up diagnosis on 2026-04-22 found that the served production bundle was
still stale. The `dist` bundle did not contain the non-repeating theme seed
logic, and the first rebuild attempt was blocked by TypeScript because an
unused `BRAND_ACCENT` constant remained in `AuraBackground.tsx`.

## Fix

- Rebuilt `AuraBackground` from the MakeDream `MobileLiquidAuraBackground`
  constants and timing model.
- Matched the MakeDream blob count, positions, amplitudes, scale motion,
  rotation motion, and theme hold/transition cadence.
- Seeded the homepage aura with a per-load random phase offset so each fresh
  page load can enter the shared cycle on a different theme.
- Tightened the seed rule so the next homepage load never reuses the last
  entry theme and the first frame always lands inside the hold window instead
  of the crossfade window.
- Removed the unused `BRAND_ACCENT` constant that blocked the production build
  and prevented the updated theme logic from reaching `dist`.
- Removed the web-only noise layer and light-theme alternate styling.
- Added the same dark veil used in MakeDream's `MobileAIChatCanvas`.
- Updated `WelcomeScreen` ownership notes so the homepage background placement
  explicitly points at the MakeDream provenance.

## Guardrail

The homepage aura is now a parity-owned surface, not a place for local visual
experimentation.

If the MakeDream chat aura changes again, KiKo should update from that owner
source instead of layering ad hoc CSS tweaks on top.

## Verification

- Verified in code that `AuraBackground` now follows the MakeDream timing and
  blob geometry from the referenced source files.
- Verified in code that the homepage background no longer mounts the prior
  noise/light-theme aura variant.
- Verified with `npm run build` on 2026-04-22 after removing the unused
  constant.
- Verified the rebuilt `dist` bundle contains `kiko-home-aura-theme-index`.
- Verified against local `vite preview` with Puppeteer on 2026-04-22:
  five reloads produced theme indices `1 -> 6 -> 0 -> 3 -> 2` and matching
  background colors.

## Document Provenance

- Source: /Users/almurat/MakeDream/MakeDreamEditor/Sources/MobileHomeSupport.swift (`MobileLiquidAuraBackground`)
  - Kind: repo doc
  - Retrieved: 2026-04-20
  - Applied To: homepage aura theme cycle, blob geometry, motion, and static fallback
  - Verification: verified in code
- Source: /Users/almurat/MakeDream/MakeDreamEditor/Sources/MobileChatScreen.swift (`MobileAIChatCanvas`)
  - Kind: repo doc
  - Retrieved: 2026-04-20
  - Applied To: preserving the same black overlay above the aura
  - Verification: verified in code
- Source: user report that the homepage currently randomizes the initial aura theme per load
  - Kind: runtime observation
  - Retrieved: 2026-04-20
  - Applied To: seeding the aura cycle with a non-repeating start theme and hold-window entry offset instead of a fixed theme-zero entry
  - Verification: verified in code
- Source: local `vite preview` runtime probe with Puppeteer
  - Kind: runtime observation
  - Retrieved: 2026-04-22
  - Applied To: confirming the rebuilt production bundle changes aura theme across refreshes
  - Verification: verified in runtime

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
- /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-homepage-welcome-stardust-background-removal.md
- /Users/almurat/KiKo/kiko-web/src/components/Effects/AuraBackground.tsx
- /Users/almurat/KiKo/kiko-web/src/components/Chat/WelcomeScreen.tsx
