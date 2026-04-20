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

This language should be paired with the editorial motion knowledge base:

- [/Users/almurat/KiKo/.agent/skills/editorial-motion-language/SKILL.md](/Users/almurat/KiKo/.agent/skills/editorial-motion-language/SKILL.md)
- [/Users/almurat/KiKo/kiko-web/src/remotion/presets/transitionPresets.ts](/Users/almurat/KiKo/kiko-web/src/remotion/presets/transitionPresets.ts)
- [/Users/almurat/KiKo/kiko-web/src/remotion/presets/sceneHandoffPresets.ts](/Users/almurat/KiKo/kiko-web/src/remotion/presets/sceneHandoffPresets.ts)

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

## What To Learn From The Current References

These four references imply a tighter motion brief than "make some animated
text":

- Mister Horse text presets:
  treat subtitle animation as a small set of reusable behaviors split across
  `lines`, `words`, `characters`, and `duration effects`
- Envato kinetic typography pack:
  use bold, readable text motion with repeating rhythm, pulsing emphasis, and
  warping/repeating accents only when the shot needs more energy
- Envato glitch text pack:
  glitch and chromatic aberration belong to short, high-tech accents, not to
  the base style
- Envato orb text intro:
  the closest baseline for the user's taste; keep typography clean, transitions
  smooth, and letter-by-letter movement subtle, with colorful abstract support
  staying secondary to the text

Operationally, this means:

1. start from clean text reveal
2. choose a unit: line / word / character
3. choose whether the animation is:
   - `transition in`
   - `transition out`
   - `effect over layer duration`
4. add one emphasis behavior at most:
   - scale hit
   - tracking tighten
   - repeated word pulse
   - short decode/glitch accent
5. only after that, decide whether the shot needs atmosphere support

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

## Composition / Layout Rules

The previous Remotion subtitle demos failed primarily on composition, not on
animation. Future promo frames must obey layout before motion.

- Geometry beats animation. Place the dominant visual anchor first, then place
  subtitle groups in the remaining ownership zone. Do not animate first and
  "find somewhere for the text" afterwards.
- One frame, one hierarchy. Each shot needs:
  1. one dominant object or cluster,
  2. one subtitle group,
  3. one secondary label layer at most.
- Poster-first composition wins over screenshot replica. Treat each frame like
  a designed poster, not like a full app screenshot plus extra text.
- Keep controls and labels close to the content they modify or describe. Do not
  let a subtitle sit far away from the visual idea it is naming.
- Do not bisect the hero object with the title block. If the product object is
  centered, place the text in a clean side or bottom zone with deliberate
  margin, not half-overlapping the focal area.
- Do not let the subtitle badge/pill collide with the subject's silhouette.
  Small chrome must live in a quiet edge, not on top of the strongest shape.
- Scale must be coordinated across layers. If the product object is small or
  mid-scale, the title cannot jump to billboard scale and crush the frame.
- Preserve breathing room on all four edges. Empty space should read as
  intentional whitespace, not as leftover room after pushing assets around.
- A product-promo frame should usually read in this order:
  hero object -> title -> support line -> small cue label
- If a frame cannot be explained as a clean left/right, top/bottom, or center +
  caption composition, the layout is probably unresolved.

Recommended layout audit before approving a frame:

1. Identify the single dominant anchor.
2. Mark the no-text zone around that anchor.
3. Place the title outside that zone.
4. Check whether the title and object feel proportionate.
5. Remove any badge, subtitle, or support line that sits on top of the object
   without clear compositional purpose.
6. Only after that, tune motion and easing.

## Asset Preparation Rules

Promo video quality depends on asset quality. Do not treat screenshot slicing as
real asset preparation.

- Never use naive hard-cropped screenshot fragments as final promo assets.
- If a shot needs a foreground object, choose one of these paths explicitly:
  1. redraw the object cleanly,
  2. extract it with a proper cutout workflow,
  3. process it in the correct external tool before bringing it into Remotion.
- "Crop a box and add a mask" is not considered correct cutout work unless the
  user explicitly wants a rough placeholder.
- If the source image is flattened and does not support clean extraction,
  prefer redraw/rebuild over fake separation.
- Do not use the same screenshot as both background atmosphere and foreground
  source object when that creates ghosting, duplicate silhouettes, or obvious
  fake layering.
- Before animation, label each foreground element as one of:
  - `redrawn asset`
  - `proper cutout asset`
  - `source screenshot kept intact`
- If an element cannot be classified honestly into one of those buckets, the
  asset is not ready for promo use.

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
- Character step-in:
  each character offset by 1 to 2 frames, subtle only, avoid cartoonish bounce
- Tracking tighten:
  start slightly over-spaced, then settle to final tracking over 8 to 14 frames
- Line swap:
  outgoing line leaves on the same axis the incoming line uses to arrive
- Decode accent:
  only on select emphasis words; use sparingly
- Pill/card pop:
  scale 0.96->1 with opacity fade and tiny shadow rise
- Carousel drift:
  slow x translation with selected item scaling up on the accent frame

## Expanded Template Catalog

This project needs many more templates than a few hero reveals. Future subtitle
work should start from this catalog instead of improvising.

### Hero Templates

1. `hero-fade-rise`
   - use: calm opener or main statement
   - unit: line
   - motion: opacity + y + blur
   - timing: 10f to 16f in, 24f to 40f hold

2. `hero-scale-settle`
   - use: end lockup or brand phrase
   - unit: line
   - motion: 1.06 scale -> 1, blur 6 -> 0
   - timing: 10f to 14f in, long hold

3. `tracking-tighten`
   - use: premium text opener
   - unit: line
   - motion: wide tracking -> final tracking, tiny y settle
   - timing: 8f to 14f in

4. `eyebrow-hero-support`
   - use: final card or structured message
   - unit: line stack
   - motion: eyebrow first, hero second, support third
   - timing: stagger 6f to 10f between layers

### Two-Line Templates

5. `line-lift`
   - use: top explainer + large bottom message
   - unit: line stack
   - motion: smaller top line first, larger bottom line second

6. `line-swap-vertical`
   - use: replace one line with the next on beat
   - unit: line
   - motion: previous line exits upward or downward, new line enters on same axis

7. `line-swap-horizontal`
   - use: stronger editorial movement
   - unit: line
   - motion: previous line exits left/right, next line enters from opposite side

8. `crossfade-line-replace`
   - use: calmer scene-to-scene textual replacement
   - unit: line
   - motion: opacity handoff with minimal y offset

### Word Templates

9. `word-cascade-up`
   - use: rhythmic statement without losing readability
   - unit: word
   - motion: each word y 28/40 -> 0, blur 8/10 -> 0

10. `word-cascade-side`
    - use: when vertical axis is busy
    - unit: word
    - motion: each word x 18/24 -> 0

11. `pulse-word-hit`
    - use: single emphasis word on accent frame
    - unit: one word in a line
    - motion: scale 1 -> 1.05/1.1 then settle

12. `word-color-hand-off`
    - use: move attention across a phrase
    - unit: word
    - motion: one word at a time shifts to accent color, others stay neutral

13. `word-mask-pass`
    - use: reveal one word group with a passing light or mask
    - unit: word group
    - motion: clipping mask or opacity wipe over 6f to 12f

### Character Templates

14. `character-rise`
    - use: subtle refined opener
    - unit: character
    - motion: each character delayed by 1f to 2f, y 18/30 -> 0

15. `cursor-type-in`
    - use: typed or system-text semantics only
    - unit: character
    - motion: progressive reveal plus caret blink

16. `decode-accent`
    - use: one tech word or phrase
    - unit: character
    - motion: scrambled chars resolve into final text

17. `tracking-decode-hybrid`
    - use: short premium tech accents
    - unit: character/line
    - motion: slight decode on start, tracking settles after

### Beat List Templates

18. `beat-steps`
    - use: Cue / Cut / Land type sequences
    - unit: line
    - motion: large single-word entries appear on consecutive beats

19. `repeat-word-loop`
    - use: machine-like or intense repeated rhythm
    - unit: repeated word/phrase
    - motion: duplicates offset in opacity/position

20. `stacked-beat-list`
    - use: 3 to 4 short lines building a list
    - unit: line stack
    - motion: each new line adds while previous lines dim slightly

### Accent Templates

21. `chromatic-flicker-accent`
    - use: 2f to 4f impact only
    - unit: line or single word
    - motion: tiny RGB separation or flicker

22. `flash-bridge-title`
    - use: transition between text states
    - unit: line
    - motion: brief white/blue flash bridge

23. `strobe-cut-type`
    - use: short, aggressive cut point
    - unit: line
    - motion: 2 to 3 rapid title states with strong restraint

24. `blur-snap-settle`
    - use: energetic reveal without glitch
    - unit: line
    - motion: over-blurred entry, sharp settle

## Timing Preset Catalog

Use explicit timing presets so templates can be reused.

- `calm`
  - in: 12f to 18f
  - hold: 28f to 48f
  - out: 8f to 12f

- `standard-promo`
  - in: 8f to 14f
  - hold: 20f to 36f
  - out: 6f to 10f

- `fast-beat`
  - in: 4f to 8f
  - hold: 12f to 20f
  - out: 4f to 6f

- `phrase-start`
  - hero lands on a phrase start
  - support enters 8f to 14f later
  - cut after readable hold

- `accent-hit`
  - main text already visible
  - emphasis event lasts 2f to 6f

## Scene Context Template Catalog

Subtitle templates are not enough. The same template behaves differently
depending on scene context.

1. `white-stage`
   - use: judge motion language only
   - risk: can hide composition problems if overused later

2. `soft-gradient-stage`
   - use: add atmosphere while keeping text primary
   - risk: background becomes the subject

3. `hero-object-caption`
   - use: product poster frames with one dominant object
   - rule: text must stay outside the object no-text zone

4. `ui-screenshot-callout`
   - use: product demonstrations and feature labeling
   - rule: only with honest asset prep

5. `scene-cut-world-change`
   - use: next shot is a new visual world
   - rule: subtitle fully exits before cut

## Editorial Bundle Presets

Start from these bundles instead of assembling everything from scratch.

### Bundle: OpenAI-style clean opener

- shot role: hero statement
- template: `tracking-tighten` or `hero-fade-rise`
- timing: `calm` or `phrase-start`
- cut: `line-finish-then-cut`

### Bundle: Feature explainer

- shot role: feature callout
- template: `hero-fade-rise`
- timing: `standard-promo`
- cut: `clean-hard-cut`

### Bundle: Beat-driven list

- shot role: beat list
- template: `line-swap-vertical` or `beat-steps`
- timing: `fast-beat`
- cut: `accent-cut`

### Bundle: Premium end card

- shot role: end lockup
- template: `eyebrow-hero-support`
- timing: `calm`
- cut: none or fade to end

### Bundle: Tech accent

- shot role: support statement or callout
- template: clean base + `decode-accent`
- timing: `standard-promo`
- cut: `clean-hard-cut`

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

## Transition Language

Transitions need their own design language. "Make it smoother" is too vague.
Choose who owns the transition first.

### Transition Ownership Types

1. `element-owned`
   - the scene stays the same
   - one subtitle or inserted object enters, settles, and exits
   - use local scene logic rather than scene overlap

2. `cut-owned`
   - two scenes overlap
   - the cut point itself is the event
   - use short, deliberate overlap

3. `overlay-owned`
   - a flash, glow, or bridge layer sits over the cut
   - the scenes underneath may still hard cut

4. `internal-object`
   - the transition should be driven by objects inside the scenes
   - use custom progress instead of generic fade/slide

### Transition Timing Rules

- Most promo transitions should start in the `6f to 16f` range.
- Only use `16f to 24f` when the transition is a major gesture.
- Every inserted element needs:
  1. entrance
  2. settle
  3. readable hold
  4. exit or bridge
- If there is no settle, the motion feels accidental.

### Inserted Image Between Letters

For probes like `KI [image] KO`, the default good pattern is:

1. word appears as a whole
2. letter groups separate
3. image rotates in while scaling up
4. image decelerates into a stable hold
5. image either:
   - retracts and letters close
   - or scales up into the next scene

Rules:

- rotation should do most of its travel early
- the last frames before hold should be a settle, not continued spinning
- if the image becomes the next shot, treat that as a real scene transition

### Expansion Bridge

An inserted image can become a fullscreen transition bridge, but only if the
shot structure supports it.

Pattern:

1. subtitle or word opens space
2. image inserts
3. image holds long enough to be read
4. image scales up smoothly and quickly
5. next scene takes over using the expanded image or a matched crop

This is not just a subtitle animation. It is a mixed subtitle + scene
transition.

### One-Sided Transition Logic

Editing software commonly treats transitions as centered on a cut, but also
allows single-sided transitions when one side owns the motion. This maps well
to promo-video work:

- old scene can stay calm while new element arrives
- inserted object can exit while the next shot is already stable
- not every smooth handoff needs both scenes moving

### Remotion Tools For Transition Work

- `Series`:
  scene sequencing without overlap
- `TransitionSeries`:
  scene overlap around a cut
- `TransitionSeries.Overlay`:
  bridge layer over a cut
- `none()` + `useTransitionProgress()`:
  custom object-driven handoff inside each scene
- `slide()`:
  useful when the new scene should literally push the old one

Default recommendation:

- use `Series` for most hard-cut promo scenes
- use `TransitionSeries` only when overlap adds real clarity
- use `none()` + `useTransitionProgress()` for premium custom handoffs
- use overlay layers for flash/blur bridges instead of forcing every transition
  into a scene slide

## Transition Template Catalog

Add these to the reusable system:

1. `insert-rotate-settle-retract`
2. `insert-rotate-settle-expand`
3. `matched-scale-bridge`
4. `flash-overlay-bridge`
5. `none-progress-handoff`
6. `slide-push`

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
- fake cutouts made from screenshot slices masquerading as clean foreground
  assets
- turning every subtitle into a glitch pack when the reference style is
  primarily clean and modern
- using heavy per-character chaos when the reference calls for subtle
  letter-by-letter motion
- treating a transition as a random effect rather than deciding who owns the
  motion
- inserted objects that enter and leave without any settle window
- rotation that keeps spinning through the hold instead of easing into place
- trying to use one generic slide/fade for every scene handoff

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

- Source: https://www.remotion.dev/docs/transitions/transitionseries
  - Kind: official documentation
  - Retrieved: 2026-04-20
  - Applied To: scene-overlap transition ownership, transition-first/last
    entry/exit patterns, and overlay usage
  - Verification: verified on page

- Source: https://www.remotion.dev/docs/transitions/use-transition-progress
  - Kind: official documentation
  - Retrieved: 2026-04-20
  - Applied To: custom internal-object transition handoff using entering/exiting
    progress values
  - Verification: verified on page

- Source: https://helpx.adobe.com/premiere-pro/using/applying-removing-find-transitions.html
  - Kind: official documentation
  - Retrieved: 2026-04-20
  - Applied To: centered vs single-sided transition thinking and the idea that
    transitions need available media handles or explicit ownership on one or
    both sides
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

- Source: /Users/almurat/MakeDream/_agent/skills/makedream-ui-spec/SKILL.md
  - Kind: local skill doc
  - Retrieved: 2026-04-20
  - Applied To: geometry-first rule, whitespace ownership, and cluster sizing
    discipline for promo-frame layout
  - Verification: verified in local skill doc

- Source: /Users/almurat/MakeDream/_agent/skills/makedream-ui-spec/references/layout_prompt_sources.md
  - Kind: local reference doc
  - Retrieved: 2026-04-20
  - Applied To: screenshot contradiction rule, geometry-over-styling, and
    dominant-task layout logic
  - Verification: verified in local reference doc

- Source: /Users/almurat/MakeDream/_agent/skills/makedream-ui-spec/references/ios26_adaptive_accessibility_rules.md
  - Kind: local reference doc
  - Retrieved: 2026-04-20
  - Applied To: functional whitespace, rational grouping, and primary-task-first
    layout hierarchy
  - Verification: verified in local reference doc

- Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-11-farcaster-miniapp-poster-redesign.md
  - Kind: repo doc
  - Retrieved: 2026-04-20
  - Applied To: poster-first composition, one dominant anchor per image, and
    sparse readable copy
  - Verification: verified in repo doc

- Source: user feedback in this thread
  - Kind: runtime/design review
  - Retrieved: 2026-04-20
  - Applied To: explicit ban on naive screenshot hard-crop "cutouts" for promo
    assets; require redraw, proper cutout, or correct external tool workflow
  - Verification: confirmed by review of failed local cutout assets

## See Also

- /Users/almurat/KiKo/kiko-web/src/remotion/Root.outro.tsx
- /Users/almurat/KiKo/kiko-web/src/remotion/KikoTokenOrbitOutro.tsx
