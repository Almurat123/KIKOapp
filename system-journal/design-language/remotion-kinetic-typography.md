# Design Language: Remotion Kinetic Typography for Product Promo

Updated: 2026-04-20
Author: Codex

## Purpose

KiKo needs a reusable motion language for product-promo videos where animated
subtitles and title cues are the main system. Backgrounds, cards, icon chips,
and atmospheres are support layers only. The target style is closer to
ChatGPT/OpenAI promo snippets than to noisy social template packs: clean
kinetic subtitles, restrained transitions, and timing that follows the music
instead of firing generic presets in isolation.

## Rules

- Build text animation as editorial timing, not as disconnected presets. Every
  subtitle or title cue must belong to a shot, a beat window, or a musical
  phrase.
- Default visual mode is clean and premium, not glitchy. Glitch/chromatic
  aberration is an accent mode only and should not become the base language.
- Background treatment is secondary. Choose it to support subtitle readability
  and rhythm, not to define the piece by itself. Soft gradients are one valid
  mode, not a fixed requirement.
- Text should do one clear thing at a time: reveal, slide, scale, decode,
  track, or swap. Do not stack multiple flashy behaviors on the same line.
- Use oversized sans-serif typography with strong weight contrast and generous
  spacing control. Favor 1 to 2 lines per beat. Do not flood the frame with
  small labels.
- UI surfaces may use frosted cards, pills, or circular chips when the shot
  needs product-context framing, but subtitle motion still owns the shot.
- Motion should be frame-accurate and deterministic. In Remotion, timing comes
  from `frame`, `fps`, beat maps, and cue lists. Never depend on CSS
  transitions, hover state, or live DOM timing.
- Every composition that uses this language should define a beat map or cue map
  first. "Looks good" is not enough; text entrances and exits must be anchored
  to explicit frames.
- Musical context owns pacing. When a track has a clear kick, clap, swell, or
  riser, typography should align to those accents rather than using evenly
  spaced default durations.
- The first working pass should use simple transforms and opacity only. Add
  blur, light streaks, or orb support after the beat structure reads correctly.

## Reference Pattern

Three source patterns are relevant:

1. Clean orb-backed text reveal:
   bright abstract light mass, smooth motion blur, letter-by-letter or word-by-
   word transitions, short opener structure.
2. Bold kinetic titles pack:
   energetic but readable type animation, repeating patterns, pulsing words,
   abstract backgrounds, quick customization of timing and font.
3. Text preset library behavior:
   transitions are either in/out moves or layer-duration effects; useful as a
   taxonomy of behaviors, but not a license to spam random presets.

For this design language, prefer pattern 1 as the base, borrow pattern 2 for
momentum, and keep pattern 3 as implementation vocabulary only.

## Visual Vocabulary

Animated subtitles are the primary design surface. Background and UI treatment
exist to frame the text and preserve contrast.

- Background:
  case-by-case support layer; may be soft gradient, blur wash, dark stage, or
  other restrained field that keeps text readable
- Surface:
  optional pill, card, or icon chip when product UI context is needed
- Foreground text:
  dark neutral or brand blue; occasional gradient-lit highlight
- Motion:
  reveal, nudge, settle, crossfade, soft zoom, horizontal or vertical track
- Depth:
  blur planes and broad glow, never heavy faux-3D chrome

The user-provided images establish one useful background family, but not a
universal rule:

- diffuse blue-cyan base with mint drift
- occasional pink/lilac bloom in corners
- soft-focus backdrop with no hard texture
- white cards/icons floating above the atmosphere

## Subtitle / Title Taxonomy

Use these categories when building promo subtitles in Remotion:

1. Hero line:
   1 phrase, oversized, anchored to a major beat or phrase start
2. Support line:
   smaller companion line, enters after the hero line lands
3. Feature callout:
   short phrase tied to a card, icon, or UI action
4. List beat:
   repeated one-line cues that step across consecutive beats
5. Button / chip label:
   tiny but crisp text on pills and circular UI tokens

Each category should have its own primitive. Do not make one generic
`AnimatedText` component try to cover every case.

## Beat-Driven Timing

This style must be music-aware. The editing model is:

1. Import or define the music cue structure.
2. Mark beats, phrase starts, risers, and cut points.
3. Build shot timing from those cues.
4. Attach typography entrances/exits to the cue map.
5. Only after that, tune easing and decoration.

Recommended timing units:

- `beatFrames`: major pulse frames
- `phraseStartFrames`: section starts
- `accentFrames`: impacts, whooshes, or lyric/emphasis hits
- `holdFrames`: intentional reading windows

Do not auto-assign equal durations to every subtitle if the soundtrack has
obvious phrasing. Reading speed still matters, but beat structure wins over
template regularity.

## Remotion Implementation Pattern

Preferred structure:

- `Root.tsx`: register composition and schema
- `composition/*`: editorial shot orchestration
- `scenes/*`: one shot or beat block per component
- `primitives/*`: reusable text, card, chip, orb, gradient helpers
- `utils/timing/*`: beat maps, cue helpers, frame windows, easing

Recommended primitives:

- `GradientAtmosphere`
- `OrbGlow`
- `FrostedPill`
- `FrostedCard`
- `IconChipRow`
- `HeroTextReveal`
- `WordCascade`
- `TrackingDecodeAccent`
- `BeatCutSequence`

Implementation notes:

- Use `Sequence` for shot ownership and local frame reasoning.
- Convert beats into frame numbers up front.
- Use `interpolate()` for most timing and `spring()` only for selected settle
  moments.
- Separate timing progress from property mapping so the same cue can drive
  opacity, y-offset, blur, and tracking together.
- Keep text measurement stable. Predefine max widths and responsive font caps so
  long words do not reflow unpredictably during animation.

## Default Motion Recipes

- Clean reveal:
  opacity 0->1, y 18->0, blur 8->0 over 10 to 16 frames
- Word step-in:
  each word offset by 2 to 4 frames, shared easing, short hold
- Decode accent:
  only on select emphasis words; use sparingly
- Pill/card pop:
  scale 0.96->1 with opacity fade and tiny shadow rise
- Carousel drift:
  slow x translation with selected item scaling up on the accent frame

## Scene Cuts

For promo-style videos that jump to a new background or a new visual world,
default to scene ownership and cuts, not one fake continuous mega-world.

- Prefer hard cuts over weak pseudo-continuous camera moves when the next shot
  is already a new background language.
- If a cut is supposed to feel intentional, the framing delta must be large
  enough to read as a new shot. Tiny camera deltas make the cut feel accidental
  and amateur.
- Subtitle exits must finish before or at the cut point. Do not let the previous
  subtitle linger visibly into a new world unless that overlap is a deliberate
  design choice.
- Each scene should own its own background, camera path, and subtitle anchors.
  Continuity should come from timing and direction, not forced shared space.
- Use matched cuts only when preserving momentum adds clarity. Keep the overlap
  short and directional.

Recommended cut checklist:

1. Last readable subtitle finishes before the scene cut.
2. New scene opens with a distinct framing change.
3. Background language can change completely if the editorial beat changes.
4. Keep a viewport/minimap debug overlay while building camera-driven scenes so
   "camera move" can be proven, not guessed.

## What To Avoid

- constant glitch overlays
- noisy particle fields behind text
- multiple unrelated easing styles in one 10-second clip
- giant gradient orbs that compete with the headline
- overlong subtitles that require the viewer to read through a fast cut
- fake complexity where a cleaner reveal would read better
- weak cuts where the next frame is too close to the previous framing
- carrying one subtitle visibly into the next background by accident
- removing camera debug too early and mistaking object motion for camera motion

## Document Provenance

- Source: https://misterhorse.com/products/text-presets/42
  - Kind: vendor product page
  - Retrieved: 2026-04-20
  - Applied To: transition/effect taxonomy, lines/words/characters split, and
    decode/tracking vocabulary
  - Verification: verified on page

- Source: https://elements.envato.com/kinetic-typography-RQD3YL3
  - Kind: vendor template page
  - Retrieved: 2026-04-20
  - Applied To: energetic kinetic titles framing, abstract-background title
    pack language, editable timing/font/color expectations
  - Verification: verified on page

- Source: https://elements.envato.com/text-animation-BLPVHE6
  - Kind: vendor template page
  - Retrieved: 2026-04-20
  - Applied To: glitch/chromatic aberration as optional accent mode, not base
    style
  - Verification: verified on page

- Source: https://elements.envato.com/text-intro-HYYZ8SH
  - Kind: vendor template page
  - Retrieved: 2026-04-20
  - Applied To: clean animated typography, abstract orb support, modern intro
    structure, smooth motion-blur reveal behavior
  - Verification: verified on page

- Source: /Users/almurat/Desktop/Catch/Hero-v1.webp
  - Kind: user-provided image
  - Retrieved: 2026-04-20
  - Applied To: soft cyan/mint atmospheric background and centered circular chip
    layout
  - Verification: visually verified

- Source: /Users/almurat/Desktop/Catch/Apps_preview__3_.webp
  - Kind: user-provided image
  - Retrieved: 2026-04-20
  - Applied To: floating icon-chip row composition over bright soft-focus
    background
  - Verification: visually verified

- Source: /Users/almurat/KiKo/kiko-web/src/remotion/KikoTokenOrbitOutro.tsx
  - Kind: repo code
  - Retrieved: 2026-04-20
  - Applied To: current gradient-atmosphere and deterministic frame-driven
    implementation pattern
  - Verification: verified in code

- Source: /Users/almurat/KiKo/kiko-web/src/remotion/CameraFollowSubtitleDemo.tsx
  - Kind: repo code
  - Retrieved: 2026-04-20
  - Applied To: proving viewport motion with fixed landmarks and persistent
    camera debug/minimap
  - Verification: verified in code and rendered debug mp4

- Source: /Users/almurat/KiKo/kiko-web/src/remotion/SceneCutCameraDemo.tsx
  - Kind: repo code
  - Retrieved: 2026-04-20
  - Applied To: hard-cut vs matched-cut comparison, scene ownership, and cut
    spacing lessons for new-background promo edits
  - Verification: verified in code and rendered debug mp4s

- Source: /Users/almurat/.codex/skills/remotion/SKILL.md
  - Kind: local skill doc
  - Retrieved: 2026-04-20
  - Applied To: deterministic Remotion constraints, shot-first workflow, and
    frame-native timing discipline
  - Verification: verified in local skill doc

## See Also

- /Users/almurat/KiKo/kiko-web/src/remotion/Root.outro.tsx
- /Users/almurat/KiKo/kiko-web/src/remotion/KikoTokenOrbitOutro.tsx
