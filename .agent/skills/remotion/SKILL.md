---
name: Remotion
description: A teacher-style guide for planning, building, validating, and scaling cinematic programmatic video with Remotion.
---

# Remotion Skill

This skill is for building polished, frame-accurate videos with Remotion. Use it when the task is not just "render a React component", but "design and ship a video that feels intentional, premium, and production-safe".

This document is written as a working playbook. Follow it in order. Do not jump straight into code.

---

## 1. Mindset: What Remotion Is Good At

Remotion is best when:
- the video must be generated from data or reusable components
- typography, layout, and motion need to be exact
- the output must be deterministic across machines and render workers
- iterations happen in code, not in a manual timeline editor

Remotion is not automatically the right tool when:
- the effect depends heavily on interactive runtime input
- the output relies on live browser state or hover/mouse behavior
- the animation is mostly freeform character animation better suited to AE/C4D

The rule: if a non-technical viewer watches the export with no explanation, it should feel obvious, intentional, and clean. If the behavior would feel confusing or accidental in a product keynote, it is not ready.

---

## 2. First Principles: Non-Negotiable Rules

### 2.1 Determinism
Every frame must render the same way every time.

Avoid:
- `Math.random()` during render logic
- `new Date()`
- `Date.now()`
- UUID generation during render
- DOM measurements that depend on unstable layout timing

Prefer:
- seeded randomness
- values passed through `inputProps`
- `frame / fps` for all time logic
- `useVideoConfig()` for width, height, fps, and duration assumptions

### 2.2 Frames, Not Time
Never think in vague "seconds" once implementation starts.

Convert everything into:
- frame ranges
- shot boundaries
- sequence offsets
- easing windows

Example:

```ts
const seconds = frame / fps;
const introStart = 0;
const introEnd = 48;
const titleRevealStart = 36;
```

### 2.3 One Source of Truth
Before coding, define:
- aspect ratio
- fps
- master duration
- design language
- text hierarchy
- transition vocabulary

Do not invent these ad hoc inside different components.

---

## 3. How To Approach A Reference Video

When the user gives you a reference video, do not start by copying visual effects. Start by reverse-engineering the editorial logic.

### 3.1 Extract Hard Facts
Always inspect:
- duration
- resolution
- fps
- audio presence
- shot count
- density of cuts

For the provided Apple Creator Studio reference:
- duration is about `30.09s`
- resolution is `3840x2160`
- frame rate is about `23.98fps`
- it behaves like a cinematic product reel, not a raw app walkthrough

### 3.2 Break The Reference Into Buckets
Classify each moment into one of these:
- hero typography
- product framing
- montage / collage
- proof of capability
- feature callout
- logo / end card

### 3.3 Identify The Motion Vocabulary
Ask:
- Are cuts hard or eased?
- Is movement mostly camera-like, object-like, or typographic?
- Is the screen mostly black, white, or textured?
- Are compositions sparse or crowded?
- Is the emphasis on premium restraint or energetic overload?

### 3.4 Translate Taste Into Build Rules
Do not write "make it Apple-like". Write concrete rules:
- black stage background
- oversized type with strict alignment
- one hero idea per shot
- transitions driven by scale, mask, opacity, or z-space
- limited accent colors, mostly neutral base
- no decorative motion that competes with the main message

---

## 4. Reference Pattern: Videos Like The Apple Creator Studio Example

For this class of video, the core structure is usually:

1. Open with density or contrast
2. Snap into a clean hero statement
3. Alternate between capability proof and controlled spectacle
4. Keep the background simple so foreground motion reads instantly
5. End on a product or brand lockup

### 4.1 What Makes This Style Work
- strong negative space
- oversized typography
- minimal but decisive camera motion
- montage sections that feel curated, not random
- very disciplined pacing
- assets that already look premium before animation starts

### 4.2 Common Mistakes
- too many simultaneous effects
- generic gradients with no visual logic
- weak typography with default fonts
- no shot plan, only isolated components
- using blur everywhere to fake premium motion
- transitions that call attention to the tool instead of the message

---

## 5. Production Workflow: Use This Order Every Time

### Step 1: Write A Creative Brief
Before code, answer:
- What is the video trying to make the viewer believe?
- Who is the audience?
- What should they remember after 5 seconds?
- What should they remember at the end?
- What is the visual promise: futuristic, editorial, product-demo, playful, dramatic?

### Step 2: Build A Shot List
Write a table before implementation:

| Shot | Frames | Purpose | Visual | Transition In | Transition Out |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 01 | 0-35 | establish | collage / proof | fade from black | hard cut |
| 02 | 36-95 | headline | giant type | hard cut | scale/mask |
| 03 | 96-155 | product demo | device frame | mask reveal | hard cut |

If you cannot explain each shot in one sentence, the edit is not ready.

### Step 3: Prepare Assets Before Animation
Collect and validate:
- fonts
- logos
- screenshots
- device frames
- video clips
- transcripts
- music / SFX

Check each asset for:
- real resolution
- aspect ratio
- alpha needs
- visual consistency
- licensing / permissions if relevant

### Step 4: Build Low-Fidelity Timing First
Use blocks, placeholder text, and simple transforms first.

Do not begin with:
- particle systems
- shader polish
- advanced glow stacks
- bespoke typography systems

First prove:
- shot order works
- pacing works
- duration works
- hierarchy works without decoration

### Step 5: Add Motion Language
Once the skeleton works, add:
- type reveal
- image sequencing
- transitions
- camera simulation
- texture / atmosphere

### Step 6: Add Finish
Last layer only:
- film grain
- chroma treatment
- subtle glow
- vignettes
- audio ducking
- final grade adjustments

---

## 6. Engineering Structure For Remotion Projects

Use a structure that separates editorial logic from rendering primitives.

Recommended mental model:
- `Root.tsx`: register compositions and schemas
- `composition`: one main orchestration component
- `scenes`: one component per shot or editorial block
- `primitives`: reusable motion/text/device/background helpers
- `utils`: timing helpers, interpolation helpers, seeded random, asset guards

Do not let one giant component manage the full timeline if the video has multiple beats.

### Good Pattern

```tsx
export const MainVideo: React.FC<Props> = (props) => {
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <Sequence from={0} durationInFrames={40}>
        <IntroMontage {...props} />
      </Sequence>
      <Sequence from={36} durationInFrames={72}>
        <HeroTitle {...props} />
      </Sequence>
      <Sequence from={108} durationInFrames={96}>
        <ProductReveal {...props} />
      </Sequence>
    </AbsoluteFill>
  );
};
```

This keeps the timeline readable and lets you debug shots independently.

---

## 7. Shot Design Rules

Each shot should have:
- one clear focal point
- one dominant action
- one emotional intention

If a shot contains multiple ideas, split it.

### 7.1 Hero Typography Shots
Use when:
- introducing a concept
- punctuating a beat
- clarifying a feature

Guidelines:
- use fewer words
- increase size before increasing effect complexity
- animate position, opacity, blur, or mask with restraint
- align text to a deliberate grid, not approximate center guesses

### 7.2 Product Frame Shots
Use when:
- showing an interface
- presenting a device
- proving product quality

Guidelines:
- keep device angle changes intentional
- avoid fake perspective unless it adds meaning
- leave breathing room around the device
- ensure screen content is legible at export resolution

### 7.3 Montage / Capability Shots
Use when:
- you need density and energy
- you want to imply ecosystem breadth

Guidelines:
- vary size and crop intentionally
- keep one dominant panel and supporting panels
- avoid equal visual weight everywhere
- darken the global stage so the collage reads as foreground

---

## 8. Typography For Cinematic Product Video

Typography carries more than half the perceived quality.

### 8.1 Rules
- choose a font family on purpose
- define display, headline, body, and caption styles up front
- track line-height and letter-spacing manually for large type
- prefer fewer words and stronger rhythm
- on premium black backgrounds, minor spacing errors become obvious

### 8.2 What To Avoid
- default system font unless brand requires it
- too many font weights
- text centered by habit instead of by composition
- excessive gradient text without narrative reason

### 8.3 Recommended Reveal Strategies
- blur to sharp
- vertical lift with soft opacity ramp
- letter stagger for dramatic emphasis
- masked wipe for bold announcements
- scale settle for hero words

Example:

```tsx
const reveal = spring({
  frame,
  fps,
  config: { damping: 14, stiffness: 90, mass: 0.9 },
});

const translateY = interpolate(reveal, [0, 1], [32, 0]);
const blur = interpolate(reveal, [0, 1], [24, 0]);
const opacity = interpolate(reveal, [0, 1], [0, 1]);
```

---

## 9. Motion Principles That Actually Feel Premium

Premium motion is not "many animations". It is:
- decisive timing
- clear hierarchy
- consistency
- intentional restraint

### 9.1 Use Springs Carefully
Springs are powerful for:
- title landings
- card entrances
- subtle settle motion

Bad spring usage:
- everything overshoots
- different shots use unrelated motion curves
- spring is used where a linear camera move would be cleaner

### 9.2 Use Interpolation For Precision
Use `interpolate()` for:
- blur
- opacity
- scale ramps
- masked reveals
- position tracking
- value mapping between editorial beats

### 9.3 Motion Vocabulary Should Be Limited
Pick 2-4 core motion behaviors for the whole video, for example:
- hard cut
- masked slide
- blur-to-focus
- slow push-in

If every shot invents a new trick, the edit loses authority.

---

## 10. Building With `Sequence`

Use `Sequence` for timeline orchestration. It is the core tool for editorial clarity.

Use it to:
- stagger scene start times
- overlap shots for transitions
- isolate debugging to a frame window
- keep shot durations explicit

Pattern:

```tsx
<Sequence from={0} durationInFrames={45}>
  <OpeningGrid />
</Sequence>
<Sequence from={36} durationInFrames={60}>
  <HeroWord text="Take" />
</Sequence>
```

The overlap from `36` lets one shot begin before the previous fully ends.

---

## 11. Delays, Async Assets, And Fonts

If rendering depends on remote assets or font loading, make the wait explicit. Do not hope the browser loads everything in time.

Use:
- `delayRender()` / `continueRender()` or project-approved wrappers
- `@remotion/google-fonts` if appropriate
- asset preflight checks before full render

Rules:
- fail early if required media is missing
- do not silently render fallback fonts unless the brief accepts it
- cache or prefetch expensive assets if repeat renders are expected

---

## 12. Video, Audio, And Heavy Media

### 12.1 Offthread Video
Use `<OffthreadVideo>` for source footage and high-resolution video assets when frame extraction reliability matters.

Why:
- better render stability
- better handling of real video content
- fewer surprises than DIY `<video>` behavior

### 12.2 Audio
Treat audio as a timing tool, not a last-minute add-on.

Define:
- where the first beat lands
- where feature reveals sync
- whether SFX accent transitions
- whether voiceover controls shot durations

### 12.3 Dynamic Duration
Use `calculateMetadata()` when duration must depend on:
- audio length
- transcript length
- number of items in data
- user-provided scene counts

---

## 13. Visual Systems For This Style Of Video

For Apple-style product reels or keynote-inspired edits, think in systems.

### 13.1 Background System
Usually one of:
- pure black stage
- slightly textured dark stage
- soft vignette with subtle depth

Do not use noisy, busy backgrounds unless the shot is intentionally dense.

### 13.2 Lighting System
Use light as hierarchy:
- hero text is clean and bright
- secondary elements are dimmer or lower contrast
- glows are subtle and supportive

### 13.3 Color System
Keep a small palette:
- neutral stage
- white or off-white type
- one or two accent colors

Avoid rainbow gradients unless the asset itself justifies them.

---

## 14. Converting A Reference Video Into An Implementation Plan

Use this checklist.

### 14.1 Editorial Breakdown
- total duration
- frame count
- shot count
- intro / middle / end structure
- main message per shot

### 14.2 Asset Breakdown
- logos
- screenshots
- clips
- device shells
- 3D or shader needs
- text copy

### 14.3 Technical Breakdown
- composition size
- fps
- whether alpha exports are needed
- whether WebGL is required
- whether there are dynamic props
- whether fonts need preloading

### 14.4 Risk Breakdown
Ask before implementation:
- what depends on runtime DOM measurement?
- what depends on mouse or hover?
- what will be expensive in headless Chromium?
- what might render differently on CI?
- what needs snapshot verification?

---

## 15. WebGL / Three.js In Remotion: Kiko-Proven Recipe

This project already has real-world experience here. Use these rules when porting interactive visuals into Remotion.

### 15.1 Renderer Setup
On macOS Apple Silicon:

```ts
Config.setChromiumOpenGlRenderer('angle');
```

On Linux/CI without GPU:

```ts
Config.setChromiumOpenGlRenderer('swangle');
```

### 15.2 CSS Import
If project styling depends on global CSS or Tailwind, import the required stylesheet in the Remotion root entry.

### 15.3 Split Setup And Per-Frame Rendering
Do not combine one-time WebGL initialization with frame-driven animation updates in the same effect if it can trigger recursive rerenders or unstable headless behavior.

Preferred pattern:
- one setup effect with empty dependency array
- one frame-driven effect keyed by `frame` and `fps`

### 15.4 Replace Runtime Time Sources
Map:
- `Date.now()` -> `frame / fps`
- `elapsedTime` -> `frame / fps`
- incremental `count += delta` loops -> direct deterministic formulas from frame

### 15.5 Seed Any Random Initialization
Use seeded pseudo-random setup for particles or layout noise if reproducibility matters.

### 15.6 Remove Interaction
No hover, pointer tracking, wheel listeners, or focus-driven motion in final render components.

### 15.7 Known Headless Risk
Canvas dimensions derived from `clientWidth` or layout timing can fail in headless environments. Prefer explicit sizing from `useVideoConfig()`.

---

## 16. Performance Rules

The fastest render is the one that avoids unnecessary complexity.

Avoid or minimize:
- large blur stacks
- deep shadow stacks
- heavy CSS filters
- too many full-screen gradients
- uncontrolled particle counts
- excessive SVG path complexity

Prefer:
- pre-rendered textures
- simpler layer stacks
- explicit asset sizes
- controlled concurrency
- testing slow frames with verbose logs

If serverless or CI rendering is involved, remember: GPU assumptions usually do not hold.

---

## 17. Rendering Commands

Use these as defaults, then tune for the brief.

High quality:

```bash
npx remotion render --crf=18
```

Fast draft:

```bash
npx remotion render --codec=h264 --preset=ultrafast
```

Single-frame inspection:

```bash
npx remotion still <composition-id> --frame=120
```

Verbose debugging:

```bash
npx remotion render --log=verbose
```

For high-density typography or premium UI details, increase scale or render at a true target resolution such as 4K.

---

## 18. Validation Checklist: Never Skip This

After implementation, verify all of the following.

### 18.1 Visual Checks
- frame 0
- first text reveal
- first transition
- busiest montage frame
- darkest frame
- final lockup frame

### 18.2 Editorial Checks
- does each shot communicate one idea?
- does any shot overstay?
- is the pacing still understandable without audio?
- does the ending feel earned, not abrupt?

### 18.3 Technical Checks
- no missing assets
- no font fallback surprises
- no flicker
- no cut reveals caused by async loading
- no inconsistent random layouts
- no headless-only regressions

### 18.4 Edge Cases
If the video is data-driven, test:
- very short text
- very long text
- zero items
- one item
- many items
- missing optional assets

If it cannot be verified, say so explicitly. Do not imply certainty.

---

## 19. Teaching Recipe: How To Build This Class Of Video From Scratch

If the user asks "make a video like the reference", teach and execute in this order.

### Phase A: Define The Film
- write the one-sentence promise
- define duration, fps, and aspect ratio
- write a shot list with purpose per shot

### Phase B: Build The Skeleton
- black background
- placeholder text
- simple sequences
- rough timing only

### Phase C: Prove The Editorial Cut
- export stills from key frames
- export a fast draft
- adjust pacing before polish

### Phase D: Add Premium Systems
- typography refinement
- transition system
- image treatment
- device framing
- atmosphere

### Phase E: Harden For Render
- remove non-determinism
- preload critical assets
- verify headless-safe behavior
- render frame snapshots

### Phase F: Final Output
- final quality render
- review on actual playback
- fix the 2-3 moments that feel "almost right" but not clean enough

---

## 20. What To Say Out Loud While Working

When using this skill, explicitly state:
- what the video is trying to communicate
- how the reference is being decomposed
- what parts are verified versus inferred
- what could break elsewhere in the system
- what edge cases were checked

Do not silently skip this reasoning.

---

## 21. Official References To Prefer

When validating or refreshing best practices, prefer official Remotion documentation first:
- `https://www.remotion.dev/docs/sequence`
- `https://www.remotion.dev/docs/interpolate`
- `https://www.remotion.dev/docs/spring`
- `https://www.remotion.dev/docs/delay-render`
- `https://www.remotion.dev/docs/offthreadvideo`
- `https://www.remotion.dev/docs/calculate-metadata`

Project experience is useful, but official docs should anchor general guidance.

---

## 22. Default Operating Procedure For This Skill

If asked to create or adapt a video:

1. Inspect the reference or brief first.
2. Extract duration, fps, and style cues.
3. Write a shot list before touching motion polish.
4. Build with `Sequence` and deterministic timing.
5. Validate key frames and edge cases.
6. Only then optimize quality and performance.

This is the default path unless the user explicitly asks for something narrower.

---

## 23. Apple Typography Mode

When the user asks for Apple-style title cards, keynote-like typography, or premium minimal text animation, use this mode by default.

### 23.1 Defaults
- prefer `SF Pro Display` / `San Francisco` style typography
- prefer clean white-on-black or black-on-white before trying stylized palettes
- prioritize `font-size`, `font-weight`, `letter-spacing`, `line-height`, and composition spacing before adding effects
- keep the stage minimal and let the typography carry the frame

### 23.2 What Not To Add Without Permission
- creative glyph substitutions
- outlined letters
- gradient-filled type
- pill backgrounds
- decorative underlays
- experimental distortions

If the user says "make it like Apple", default to restraint, not decoration.

---

## 24. Typing Interpretation Rules

When the user asks for a typing or typewriter effect, do not assume they want per-letter animation.

Default interpretation:
- characters are appended to the text string over time
- the caret follows the currently typed text
- the rhythm should feel like real input, not a presentation gimmick
- animation on letters should be minimal or absent unless explicitly requested

### 24.1 Default Behavior
- use direct text append behavior first
- use a blinking caret that sits immediately after the visible text
- avoid large bounce, blur, or spring effects on each character
- prefer a faster cadence over a slow demo-like cadence unless the brief says otherwise

### 24.2 If The User Says "More Realistic"
Try in this order:
1. increase typing speed
2. reduce per-letter animation
3. keep caret movement tightly coupled to the appended text
4. only then consider non-uniform cadence

---

## 25. Reference Hierarchy

When multiple sources of direction exist, use this priority order:

1. visual reference image or video
2. precise textual instruction
3. broad style adjectives
4. your own taste

If the reference image conflicts with earlier vague wording, explicitly note the conflict and choose one source of truth before implementing.

### 25.1 Practical Rule
If the user provides a frame, screenshot, or video:
- treat it as the strongest visual authority
- match typography, color relationship, spacing, and layout before inventing motion polish
- verify key frames against the reference before extending the timeline

---

## 26. Text-Only Video Patterns

For short text-driven videos, prefer a small set of proven structures instead of inventing a new timeline each time.

### Pattern A: Typed Headline
- line types in
- caret follows the text
- line holds briefly

### Pattern B: Feature Statement Reveal
- current line exits
- next line enters from one direction
- a key word can overscale briefly before settling

### Pattern C: Sequential Taglines
- previous line slides down or fades out
- new line enters from above
- new line settles
- subtle end-scale can add weight if the user asks for emphasis

If the request is mostly typography, start from one of these patterns before adding anything else.

---

## 27. Do Not Overdesign

Premium-looking text videos often get worse when too many ideas are added.

Default rule:
- first build the pure version
- only add decorative treatment if the user asks for it

### 27.1 Warning Signs
- adding creative letters before matching the base typography
- adding backgrounds behind letters without reference support
- mistaking "premium" for "complex"
- using motion to compensate for weak spacing

### 27.2 Safer Escalation Path
1. get the text, weight, size, and spacing right
2. get the timing right
3. get the transition right
4. only then propose stylization

If unsure, keep it cleaner.
