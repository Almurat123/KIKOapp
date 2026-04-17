# 2026-04-17 Homepage Welcome Stardust Background Removal

## Problem

The homepage welcome shell still mounted `StardustBackground`, which rendered a
GPU-backed particle scene behind the first-paint composer.

That effect made the welcome surface visually busier than necessary and kept a
background animation owned by a shell that is supposed to stay light.

## Root Cause

`kiko-web/src/components/Chat/WelcomeScreen.tsx` still imported and rendered
the shared background effect directly inside the welcome owner.

## Fix

- Removed the `StardustBackground` import from the welcome screen.
- Removed the rendered background component from the welcome shell tree.
- Updated the welcome-screen `CONTEXT MEMORY` block to state that this owner
  does not own animated particle or canvas backdrops.

## Guardrail

The welcome shell should stay lightweight and interactive without owning a
persistent animated backdrop.

If a future design needs ambient motion, it should be owned by a separate layer
with an explicit design decision and provenance record.

## Verification

- Verified in code that `WelcomeScreen` no longer references `StardustBackground`.
- Verified with `npm exec tsc --noEmit` in `kiko-web`.

## Document Provenance

- Source: user request to remove the welcome-page dynamic background particles
  - Kind: product doc
  - Retrieved: 2026-04-17
  - Applied To: removing the welcome-shell particle backdrop
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/kiko-web/src/components/Chat/WelcomeScreen.tsx
- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-homepage-welcome-shell-split.md
- /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
