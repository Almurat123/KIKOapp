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

---

## 28. AE-Style Workflow For Remotion

If the user wants to use Remotion like After Effects, treat the project as a motion design timeline, not just a React app.

Default mental model:
- composition = final edit or sequence
- scene = shot or editorial beat
- layer = independently animated visual element
- keyframe logic = `interpolate()` / `spring()` / timing windows
- precomp = nested scene/component or child composition

The model should think in this order:
1. story beat
2. shot
3. layers
4. timing
5. transitions
6. polish

Do not jump directly from idea to code without building this structure first.

---

## 29. Motion Production Protocol

For every non-trivial Remotion task, follow this protocol before implementing.

### 29.1 Intent
Write down:
- what the viewer should feel
- what the viewer should understand
- what the shot is proving
- whether the motion should feel editorial, product-focused, cinematic, playful, or aggressive

### 29.2 Scene Grammar
Each scene must have:
- `scene_id`
- `purpose`
- `start_frame`
- `end_frame`
- `entry`
- `hold`
- `exit`
- `focus_element`

If any of these are unclear, the scene is not ready to build.

### 29.3 Animation Mapping
Each scene should use only a small number of motion primitives. Do not invent new motion language for every shot.

### 29.4 Implementation
Use the scene spec to decide:
- `Series` vs `Sequence`
- `interpolate()` vs `spring()`
- whether overlap is required
- which layers need independent motion

### 29.5 Validation
Before claiming the scene works, render:
- opening frame
- first fully readable frame
- transition frame
- final frame
- full draft clip

---

## 30. Scene Spec DSL

Before writing motion code, produce a compact shot spec like this:

```md
## Scene Plan
- Scene 1
  - Purpose: typed intro
  - Frames: 8-55
  - Entry: type append
  - Hold: 6f
  - Exit: slide down
  - Focus: main headline

- Scene 2
  - Purpose: feature statement
  - Frames: 72-125
  - Entry: slide from left
  - Emphasis: keyword overscale then settle
  - Exit: slide down
  - Focus: key claim

- Scene 3
  - Purpose: CTA
  - Frames: 126-180
  - Entry: drop from top
  - Hold: 10f
  - Exit: scale hold / fade
  - Focus: final line
```

This should be treated as a required planning artifact for motion-heavy work.

### 30.1 Why This Matters
- prevents timeline drift
- keeps shots readable
- makes transitions intentional
- helps compare motion ideas before coding

---

## 31. Layering Rules

When building motion like AE, think in layers.

Typical layer stack:
- background
- atmosphere / texture
- product or footage
- UI overlays
- primary text
- secondary text
- foreground accents

### 31.1 Rules
- animate only the layers that need movement
- do not wrap too much content into one transform if different parts need different timing
- isolate headline, subtitle, and supporting graphics into separate layers
- if a transition affects only one object, do not move the entire scene

### 31.2 Precomp Rule
If a visual block has internal animation and also needs scene-level motion, split it:
- inner component handles local animation
- outer `Sequence` or wrapper handles scene timing and entry/exit

---

## 32. Timing Rules

Motion quality is usually a timing problem before it is a rendering problem.

### 32.1 Standard Timeline Order
Default order:
- enter
- settle
- hold
- transition
- exit

### 32.2 Hold Time
Do not remove holds entirely. Even fast edits need a readable hold unless the goal is intentional chaos.

### 32.3 Overlap
Use overlap deliberately:
- overlap scenes when continuity should feel fluid
- hard cut when contrast or emphasis is needed

### 32.4 Keyframe Windows
Write transitions as explicit frame windows, not vague duration ideas.

Bad:
- "slide in quickly"

Good:
- "frames 72-86: slide from x=-180 to x=0"

---

## 33. Motion Primitive Library

Prefer a controlled set of primitives and combine them instead of inventing one-off effects.

Core primitives:
- `type_append`
- `fade`
- `slide_left`
- `slide_right`
- `slide_up`
- `slide_down`
- `drop_in`
- `scale_settle`
- `overscale_settle`
- `blur_to_sharp`
- `wipe_reveal`
- `push_transition`

### 33.1 Mapping
- use `interpolate()` for position, opacity, blur, scale, and masks
- use `spring()` for landings and gentle settle motion
- use `Series` for sequential blocks
- use `Sequence` for offsets and overlapping scenes

If a requested effect can be composed from these primitives, do that before building custom systems.

---

## 34. Text Motion Pattern Library

When the work is primarily text-based, start from one of these patterns.

### Pattern 1: Typed Headline
- append characters over time
- caret follows the visible text
- brief hold

### Pattern 2: Slide And Replace
- current line exits laterally or vertically
- next line enters from the opposite direction

### Pattern 3: Overscale Keyword
- keyword enters large
- other words lag slightly
- keyword settles back to final scale

### Pattern 4: Previous Down, Next From Top
- outgoing line drops below baseline
- incoming line descends from above
- incoming line settles, then optionally grows subtly

### Pattern 5: Sequential Tagline Ladder
- multiple lines appear one after another
- each new line inherits the last line's rhythm
- avoid resetting visual grammar every time

If the user provides a reference, choose the closest pattern and adapt it rather than inventing motion from zero.

---

## 35. Transitions: Order Of Construction

When building transitions, use this build order:

1. block timing
2. entry path
3. overlap or cut decision
4. exit path
5. opacity cleanup
6. blur or scale polish

Do not start with blur, glow, or easing polish before timing and spatial logic are correct.

### 35.1 Transition Checklist
- where does the old element go?
- where does the new element come from?
- do they overlap?
- when is each fully legible?
- does the transition support the message or distract from it?

---

## 36. Remotion As Motion Design System

To use Remotion like AE effectively, treat code as a motion system, not a one-off render script.

That means:
- reusable primitives
- reusable scene patterns
- reusable timing constants
- reusable typography presets
- reusable validation steps

Recommended reusable modules:
- `timing.ts`
- `motion-primitives.ts`
- `text-patterns.tsx`
- `scene-specs.ts`
- `render-checklist.md` or equivalent

The more the motion language is systematized, the better the model can extend it coherently.

---

## 37. Validation Checklist For Typography Videos

For text-led work, always verify:
- font family matches the brief
- font weight matches the reference
- letter spacing matches the reference
- caret position is correct
- line is centered or aligned intentionally
- each frame remains readable during transitions
- keyword emphasis does not break the line rhythm
- transitions do not leave ghosted text longer than intended

Render at least:
- one typing frame
- one fully typed frame
- one transition overlap frame
- one settled end frame

---

## 38. Model Behavior Rules For Motion Tasks

When using this skill, the model should behave like a motion designer with engineering discipline.

Always:
- summarize the intended sequence before coding
- identify the motion pattern being used
- state whether the result is inferred from reference or directly matched
- call out when typography is still approximate
- validate with still frames before claiming the motion is right

Never:
- improvise decorative layers without a reason
- confuse "dynamic" with "good motion"
- treat motion polish as a substitute for weak layout
- skip explaining the order of scenes

If the user wants something visually ambitious, increase planning discipline before increasing effect complexity.

---

## 39. Apple Motion Language In Remotion

Apple does not publish a single step-by-step guide for recreating keynote or commercial motion in code, but Apple does publish the design principles, typography guidance, symbol animation guidance, and motion accessibility constraints that should shape the work.

This section translates those principles into Remotion-oriented practice.

### 39.1 Source Principles
Use these Apple principles as the foundation:
- San Francisco / SF Pro is the default typographic voice for Apple platforms
- fluid motion should feel fast, smooth, natural, and "right"
- elasticity is useful when it reinforces natural movement and settling
- motion should clarify hierarchy and state, not decorate arbitrarily
- layered motion should be grouped when parts conceptually belong together
- reduced motion support matters, especially for scaling, depth, and simulated 3D

### 39.2 What This Means In Remotion
- typography-first scenes should begin with font, spacing, and timing, not visual effects
- use `spring()` for landing, settling, and elastic continuity
- use `interpolate()` for exact position, opacity, blur, and scale mapping
- use `Sequence` and `Series` to create editorial order and overlap intentionally
- use transitions only after scene timing is already correct

---

## 40. Apple Animation Categories

When matching Apple-like motion, sort the animation into one of these categories before implementing.

### 40.1 Typography Motion
Typical behavior:
- direct, minimal entry
- precise spacing
- clear settling
- subtle but not mushy scale changes

In Remotion:
- use clean text layers
- avoid decorative backgrounds unless directly supported by a reference
- prefer `type_append`, `fade`, `slide`, or restrained `scale_settle`

### 40.2 Hierarchical Transition Motion
Apple often uses motion to show structure:
- current content exits with direction
- incoming content arrives from a meaningful opposite direction
- overlap is short and readable

In Remotion:
- stage each scene with `Sequence` or `TransitionSeries`
- define overlap in frames explicitly
- keep the old scene legible only as long as it supports the handoff

### 40.3 Elastic Settle Motion
Apple's fluid interfaces use elasticity to make motion feel natural and continuous.

In Remotion:
- use `spring()` when an element needs to come to rest
- tune `damping`, `mass`, and `stiffness` for natural landing, not flashy bounce
- avoid spring on every property at once

### 40.4 Layered Symbol Motion
Apple's SF Symbols guidance emphasizes deciding when layers move independently and when they move together.

In Remotion:
- group conceptual units so they move as one layer if that matches the meaning
- split layers only when independent motion adds clarity
- do not animate all child layers separately by default

### 40.5 Reduced-Motion Alternate Motion
Apple explicitly calls out scaling, spinning, parallax, animated blur, depth-of-field, multi-axis motion, and ongoing motion as things to reduce or replace when necessary.

In Remotion:
- for alternate motion modes, replace depth-heavy or scale-heavy transitions with dissolve, fade, color shift, or simple directional movement
- keep the semantic transition, remove the unnecessary trigger

---

## 41. Apple Typography Guidance For Motion Scenes

Apple's typography guidance and San Francisco sessions imply that typography quality depends on optical size, weight choice, width choice, and spacing discipline.

### 41.1 Defaults For Apple-Like Title Cards
- use `SF Pro Display`-style typography for large titles
- prefer lighter or regular weights before jumping to heavy bold
- adjust letter-spacing intentionally, especially for large display text
- keep line-height tight but readable
- use width and scale as expressive tools only when they reinforce tone

### 41.2 Motion Rule
Do not animate typography until the base line looks correct as a still frame.

The model should first verify:
- font family
- weight
- width feel
- tracking
- baseline alignment
- overall scale in frame

If the still frame is wrong, animation will only hide the problem temporarily.

---

## 42. Apple-Like Motion Order

For Apple-style text and product scenes, this is the default order of construction.

1. static layout
2. timing windows
3. directional entry
4. settle behavior
5. overlap / transition
6. end hold
7. subtle polish

### 42.1 Default Rule
If a scene does not already look good with no motion, do not add more motion.

### 42.2 Preferred Transition Shapes
- slide in from left or right for feature changes
- slide down / slide up for replacing one line with another
- overscale then settle for emphasizing one word
- blur-to-sharp only when it adds readability or cinematic focus
- dissolve instead of depth-heavy motion when clarity matters more than spectacle

---

## 43. Apple-Like Remotion Mapping

Use the following mapping when translating Apple-style motion into Remotion decisions.

### 43.1 Editorial Order
- sequential scenes: `Series`
- overlapping scenes: `Sequence` with explicit offsets
- named timeline blocks: use `name` on sequences when helpful for timeline clarity

### 43.2 Motion Curves
- natural landing: `spring()`
- exact directional travel: `interpolate()`
- transition packages between scenes: `@remotion/transitions` when the edit benefits from standardized presentations

### 43.3 Async Assets
- use `useDelayRender()` for font or asset readiness
- use `calculateMetadata()` if scene length depends on content

### 43.4 Typography Clips
- text typing: append characters over time
- text replacement: separate outgoing and incoming layers
- headline emphasis: scale one word independently

### 43.5 Video / Footage Integration
- use `OffthreadVideo` when source footage is part of the shot
- keep product footage and title layers separate so they can be timed independently

---

## 44. Apple Motion Recipes Without Code Reuse

These are conceptual recipes for the model to follow. They are not reusable code components.

### Recipe A: Apple-Style Typed Headline
- choose `SF Pro Display`-style typography
- make the still frame correct first
- append text characters over time
- keep caret attached to current text
- hold briefly
- remove or replace line cleanly

### Recipe B: Statement Replacement
- outgoing statement exits vertically or laterally
- incoming statement enters from the opposite side
- overlap only long enough to communicate continuity
- settle incoming line into a quiet hold

### Recipe C: Keyword Overscale
- incoming keyword arrives large
- supporting words lag behind slightly
- keyword scales back to the final reading size
- avoid using the same trick repeatedly in adjacent scenes

### Recipe D: New Line From Top
- current line slides downward out of the center
- new line descends from above
- once centered, new line grows subtly over time
- keep the final scale move modest

### Recipe E: Symbol Or Layer Group Animation
- decide if the object should move as one unit or by layer
- if all parts belong together conceptually, group them
- if independent layer motion adds meaning, stagger it carefully

---

## 45. Accessibility And Reduced-Motion Rule

Apple explicitly warns that scaling, spinning, depth simulation, animated blur, depth-of-field, multi-axis motion, and ongoing motion can be problematic for motion-sensitive users.

For motion-heavy Remotion work, record whether the scene includes:
- large scale jumps
- simulated depth
- parallax
- blur-as-motion
- spinning or vortex movement
- perpetual background motion

If yes, note a reduced-motion fallback:
- fade
- dissolve
- color shift
- smaller directional move
- reduced overlap

Do not remove meaningful hierarchy transitions entirely if the motion is communicating structure. Replace them with calmer motion.

---

## 46. Research-Informed Rules For The Model

When the user asks for Apple-like animation, the model should now assume:
- Apple-like does not mean visually busy
- Apple-like motion is structured, hierarchical, and restrained
- elasticity is for believable settling, not spectacle
- typography and spacing are usually more important than effect complexity
- grouped motion is often more Apple-like than independently flaring sublayers

### 46.1 Required Workflow
Before coding:
- identify the animation category
- identify whether the scene is typography-led or product-led
- identify the transition direction
- identify whether the scene needs spring or interpolation

After coding:
- render still frames for typography verification
- render a transition frame
- render a final settled frame
- explicitly state what was matched from reference and what was inferred from Apple principles

---

## 47. Sources To Anchor Apple-Style Motion Decisions

Prefer these sources when refreshing Apple-oriented guidance:
- Apple Fonts: `https://developer.apple.com/fonts/`
- Apple WWDC: Designing Fluid Interfaces
- Apple WWDC: The details of UI typography
- Apple WWDC: Meet the expanded San Francisco font family
- Apple WWDC: What’s new in SF Symbols 5
- Apple WWDC: Create animated symbols
- Apple Reduced Motion evaluation criteria

Use these alongside Remotion docs:
- `https://www.remotion.dev/docs/sequence`
- `https://www.remotion.dev/docs/series`
- `https://www.remotion.dev/docs/interpolate`
- `https://www.remotion.dev/docs/spring`
- `https://www.remotion.dev/docs/transitions`
- `https://www.remotion.dev/docs/use-delay-render`

If the exact Apple commercial effect is not documented, say so and derive the motion from Apple's published principles rather than pretending there is an official recipe.

---

## 48. Editor-Style Component Mindset

Modern editors like CapCut, Jianying, Premiere, and similar tools feel productive because they expose repeatable motion components:
- titles
- captions
- stickers
- overlays
- transitions
- particles
- backgrounds
- HUDs
- camera moves
- beat-driven reveals

When using Remotion, think in the same way.

The model should first ask:
- is this a title component?
- is this a subtitle / caption component?
- is this a transition component?
- is this a decorative overlay?
- is this a texture / atmosphere layer?
- is this a product framing component?

Then decide how to build it.

Do not begin by asking "what JSX should I write?" Start by asking "what kind of editor component is this?"

---

## 49. Built-In Component Categories To Emulate

If the user wants "editor-style" motion, sort the request into one or more of these categories.

### 49.1 Title Components
Common examples:
- typing title
- scale-in title
- blur reveal title
- split-word title
- keyword emphasis title
- stacked title

In Remotion:
- use separate layers for each logical text unit
- define entry, hold, and exit in frames
- verify still-frame typography before motion

### 49.2 Caption Components
Common examples:
- karaoke captions
- active-word highlight captions
- subtitle cards
- bottom-safe captions
- word-by-word pop captions

In Remotion:
- treat transcript timing as data
- map frame ranges to active words or lines
- build bottom-safe layouts with clear margins
- use restrained emphasis rather than random per-word effects

### 49.3 Transition Components
Common examples:
- slide replace
- push transition
- zoom cut
- blur cut
- whip-inspired directional move
- dissolve

In Remotion:
- define outgoing and incoming layers separately
- write overlap explicitly
- build the transition as scene timing first, polish second

### 49.4 Decorative Overlay Components
Common examples:
- glows
- grain
- scanlines
- stickers
- scribbles
- paper tears
- spark lines
- masks

In Remotion:
- put overlays on their own layers
- keep them optional
- never let them fix weak composition

### 49.5 Background Components
Common examples:
- gradient stage
- moving noise
- soft spotlight
- abstract shape field
- image collage
- product stage

In Remotion:
- backgrounds should support hierarchy, not compete with it
- motion on the background should usually be slower than motion in the foreground

### 49.6 Product / Device Components
Common examples:
- phone frame reveal
- desktop screen reveal
- scrolling UI card
- feature spotlight
- comparison panel

In Remotion:
- isolate frame, content, reflections, and shadow layers when necessary
- animate device and UI separately if the shot needs both

---

## 50. How To Build Editor-Style Components In Remotion

For any editor-style component, use this process:

1. define the component category
2. define the visual hierarchy
3. define the frame window
4. define the entry behavior
5. define the hold behavior
6. define the exit behavior
7. define whether it is reusable conceptually
8. validate the component as a still and as a moving clip

### 50.1 Example Questions
- what is the primary readable element?
- does the component need a background plate?
- is the motion data-driven?
- does it sync to audio or captions?
- does it require a reduced-motion alternative?

---

## 51. Resource Sourcing Rules

The model should not only know how to animate. It should know where the ingredients come from and how to judge them.

Resource categories:
- fonts
- icons / symbols
- stock video
- still images
- textures
- music
- sound effects
- transcripts
- vector assets
- UI references

### 51.1 Source Priority
Use this priority order when sourcing:

1. user-provided assets
2. official platform resources
3. official brand resources
4. reputable stock libraries with clear licenses
5. community resources only with caution

### 51.2 Sourcing Rule
Never assume an asset is usable just because it is easy to download. Check:
- license
- attribution requirement
- commercial use status
- resolution

---

## 52. Advanced Production Pattern: Technical Isolation

In large Vite or Next.js projects, global dependencies and `import.meta` usage can often conflict with Remotion's Webpack-based bundler.

### 52.1 The Isolated Root Solution
If you encounter "import.meta" errors or build hangs:
- Create an isolated root file (e.g., `Root.isolated.tsx`).
- Register only the current composition being worked on.
- Import components directly from their source without going through high-level feature index files.
- **Render Command**: `npx remotion render src/remotion/Root.isolated.tsx <comp-id> out/video.mp4`

### 52.2 Benefits
- Bypasses project-wide environment variable conflicts.
- Reduces bundle size for the render worker significantly.
- Faster hot-reloading during animation refinement.

---

## 53. Advanced Production Pattern: Coordinated Layer Motion

High-end "keynote-style" motion often involves one master movement (like a logo sliding) triggering a trailing secondary movement (like a box expanding).

### 53.1 The "Single Source of Truth" Rule
Do not use two different `spring()` calls for linked movements. This leads to drift and "jitter" where the trail doesn't perfectly follow the host.

### 53.2 Correct Implementation
1. Define **one** master `spring()` or `interpolate()` progress value.
2. Map that value to both components using math:
   - `Host.translateX = interpolate(progress, [0, 1], [0, -300])`
   - `Trail.width = interpolate(progress, [0, 1], [0, 600])`
   - `Trail.translateX = Host.translateX` (or a calculated offset)

This ensures that even at 120fps or during a slow render, the physical connection between layers is sub-pixel perfect.

---

## 54. Advanced Production Pattern: Resolution Adaptation (1:1 to 16:9)

When scaling a design from Square (Shorts/Social) to Wide (Cinematic/16:9), simply centering the old design often feels "empty" or "thin".

### 54.1 Upscaling Strategy
- **Master Elements**: Increase size (e.g., from 140px to 200px) to maintain visual weight on a 1920x1080 canvas.
- **Layout Centering**: Move horizontal anchors from 540 (Square center) to 960 (Wide center).
- **Tight Wrapping**: Reduce trailing empty space in containers. A wider screen makes "dead air" on the right side of a text box more apparent. Match the container width to the content length tightly.

---

## 55. Advanced Production Pattern: Deterministic Fluid Backgrounds

Standard linear gradients feel static. For a premium "breathing" feel:

### 55.1 The Radial Blur Trick
1. Create a container with 3-4 absolute-positioned `div`s.
2. Give each a different `radial-gradient` color.
3. Animate their top/left positions using **deterministic** math:
   ```ts
   const waveA = Math.sin(frame * 0.02) * 10;
   const waveB = Math.cos(frame * 0.015) * 15;
   ```
4. Layer a `backdrop-filter: blur(100px)` on top of the whole stack.

This creates a high-fidelity "fluid" effect that is 100% reproducible and doesn't require heavy video textures or non-deterministic noise.
- alpha / transparency needs
- style consistency
- whether the source is likely to disappear

### 51.3 No Fabricated Brand Or System Assets
Do not invent or improvise:
- app logos
- brand marks
- wallet icons
- product symbols
- system notification assets
- system UI components when accuracy matters
- notification copy when the user expects an exact real-world message
- DM contents, wallet addresses, transaction summaries, or branded alert copy that was not provided

If an asset is specific to the user's product, brand, wallet, or app:
- ask the user for the real asset when possible
- use an official source if one exists
- use a neutral placeholder only when the user explicitly accepts it or when the task is clearly a rough structural mock

Production rule:
- do not hard-code fantasy logos or guessed icons into polished video work
- do not pretend an invented icon is the real product mark
- if the real asset is missing, state that it is missing instead of silently fabricating it
- if the exact content is missing and accuracy matters, stop and ask for the exact content instead of guessing a plausible one

### 51.4 Screenshot Is Specification, Not Inspiration
When the user provides a screenshot of a system component, treat it as a formatting specification unless the user explicitly says it is only mood or inspiration.

This applies especially to:
- iOS notifications
- Android notifications
- toasts
- modals
- sheets
- alerts
- status bars

Production rule:
- do not redesign a system component when the user has already shown the target component
- do not "abstract the pattern" before reproducing the visible structure
- lock visible facts first: container style, icon size, padding, line count, title/time layout, truncation behavior, and color logic

### 51.5 System Component Style Must Stay Unified
If multiple notifications belong to the same host OS surface, keep the host system style unified even when the source apps differ.

Production rule:
- different apps may change icon and text, but not the host iOS notification grammar
- do not create a custom card for one app if the user is still showing iOS notifications
- source app identity is not permission to invent a new system surface

### 51.6 Content Discipline For Reference-Driven UI
If the user provides exact visible text format, preserve that content structure unless the user explicitly asks for a rewrite.

Production rule:
- do not change a one-message notification into a multi-detail card
- do not turn matching notifications into different content templates without instruction
- do not replace a demonstrated text pattern with a guessed narrative progression
- when a screenshot shows four visible lines, do not compress it to three because it feels cleaner

### 51.7 Spec Lock Rule
Before implementing a reference-driven UI shot, explicitly lock what is fixed.

Minimum lock list:
- host OS component type
- container style
- icon size and position
- title / sender / time arrangement
- visible line count
- truncation pattern
- color logic
- material logic
- which fields are real and already provided
- which fields are missing

Production rule:
- after these are locked, do not change them unless the user asks
- do not start inventing variants before the locked spec is reproduced

### 51.8 Do Not Infer Zone
In reference-driven UI work, some fields are forbidden to infer.

Do not infer:
- exact notification copy
- DM contents
- wallet labels
- transaction summaries
- app names
- system component structure
- visible line count
- sender / title hierarchy

Production rule:
- if a field is in the Do Not Infer Zone and the user has not provided it, stop and ask

### 51.9 Static Match Gate
Before animating a screenshot-driven system component, first verify a static frame match.

The static check must confirm:
- same host-system style
- same component anatomy
- same visible line count
- same title / time structure
- same icon logic
- same color logic

Production rule:
- if the static frame does not match, do not proceed to motion polish
- animation cannot compensate for a format mismatch

### 51.10 Stop And Ask Rule
If the user expects fidelity and any of the following are missing, pause implementation and ask:
- real logo or icon
- exact notification copy
- exact DM text
- exact sender naming
- exact screenshot-derived formatting that cannot be read confidently

Production rule:
- do not fill missing fidelity-critical fields with plausible guesses
- lack of exact content is a blocker, not a creative prompt

### 51.11 Mandatory UI Spec Preflight
For screenshot-driven system UI work, the model must explicitly complete a preflight before editing code.

Required preflight output:
- host component type
- whether the screenshot is a spec or only inspiration
- fixed fields
- missing fields
- fields in the Do Not Infer Zone
- go / no-go decision

Hard rule:
- if the preflight is not completed, do not implement
- if the preflight result is `no-go`, do not implement
- if the user has provided screenshots and the model has not explicitly locked the visible format, implementation is not allowed to proceed

Default no-go conditions:
- exact notification copy is missing but fidelity is expected
- exact DM text is missing but fidelity is expected
- sender / title / line-count structure is not confidently readable
- the model wants to vary host-system style across app senders

### 51.12 Reference Override Rule
When reference evidence conflicts with model intuition, the reference wins.

Hard rule:
- screenshots override memory
- user-stated formatting overrides stylistic preference
- visible UI evidence overrides generalized design knowledge
- "this feels cleaner" is not a valid reason to change a shown format

### 51.13 System UI Mode
When the task is about iOS, Android, macOS, Windows, or other system-surface UI, enter System UI Mode.

System UI Mode means:
- specification-first
- host-system style is fixed
- screenshot evidence outranks invention
- missing fidelity-critical content blocks implementation

Hard rule:
- in System UI Mode, do not improvise formatting
- in System UI Mode, do not vary host-system grammar across app senders
- in System UI Mode, do not treat system UI as a place for creative redesign unless the user explicitly asks for a redesign

### 51.14 Never Do These In System UI Work
Never:
- treat a screenshot spec as loose inspiration
- redesign one iOS notification while leaving others native
- change visible line count
- change title / time / sender hierarchy without instruction
- expand a simple system notification into a richer custom info card
- shrink a multi-line screenshot into fewer lines because it looks cleaner
- invent missing system text or branded content to keep momentum

### 51.15 Acceptance Criteria For Screenshot-Driven Components
A screenshot-driven system component is only acceptable if:
- host-system style is consistent
- component anatomy matches the screenshot
- visible line count matches the screenshot
- title / sender / time structure matches the screenshot
- only allowed fields were changed
- static frame match was achieved before motion polish

---

## 52. Resource Types And Where To Look

These are search directions to use when the user asks for assets or when the task clearly needs them.

### 52.1 Fonts
Look at:
- Apple Fonts / San Francisco resources
- official brand font resources
- Google Fonts when a project allows it

Use when:
- typography scenes need consistent, legal, high-quality type

### 52.2 Icons And Symbols
Look at:
- SF Symbols for Apple-like work
- official icon sets from product or design systems

Use when:
- UI-like motion needs clean symbolic layers

### 52.3 Stock Video
Look at:
- Pexels videos
- Mixkit stock video
- other reputable stock libraries with clear licensing

Use when:
- backgrounds, montage shots, or cutaway footage are needed

### 52.4 Music And Sound Effects
Look at:
- Mixkit music and SFX
- licensed music libraries the user already has access to

Use when:
- rhythm, transitions, or title impact needs audio support

### 52.5 Design References
Look at:
- Apple Design Resources
- Figma Community and official design resources
- Sketch shared design resources and UI kits
- official product marketing pages

Use when:
- trying to match product-stage layouts, icon behavior, typography, or editorial hierarchy

### 52.6 External Material-Source Skills

Treat public design-resource links as a separate material-source class, not as casual inspiration links.

This includes:
- Sketch shared documents
- Figma files and community kits
- official UI kits
- public design-system downloads
- shared product bezel / device mockup libraries

How to classify them:
- these are not final assets by default
- these are structured source materials for rebuilding UI, mockups, device shells, notification surfaces, and motion references
- the model should extract layout logic, spacing, radii, safe areas, hierarchy, and component anatomy from them

How to use them:
- treat them as a source of component structure
- prefer them over random screenshots when rebuilding system UI or phone mockups
- combine them with official HIG or platform docs when accuracy matters
- if the resource is user-provided, record the link in the skill or addendum as a known material source

Example material source:
- user-provided Sketch resource: `https://www.sketch.com/s/f63aa308-1f82-498c-8019-530f3b846db9`

Naming rule:
- in this skill system, links like the Sketch resource above should be described as `material-source references` or `material-source skills`
- they exist to feed the model better structural design context for future video work

---

## 53. Resource Search Heuristics

When searching for assets, do not search vaguely.

Bad:
- "cool video background"

Good:
- "white paper texture subtle 4k"
- "soft spotlight black background 4k"
- "phone hand closeup neutral lighting"
- "minimal synth rise sound effect"
- "grain overlay loop 4k"

The model should search with:
- subject
- style
- color
- duration or loopability
- resolution
- usage context

### 53.1 Asset Quality Checklist
- is the asset too generic?
- does it match the motion language?
- does it hold up at output resolution?
- does it contain hidden branding or legal risk?
- will it distract from the message?

---

## 54. Licensing And Risk Notes

Free stock libraries are useful, but they are not risk-free.

Default rule:
- prefer official or clearly licensed sources
- keep a record of where an asset came from
- if the project is commercial or high-visibility, be stricter

### 54.1 Practical Warning
Even when a stock site says "free", uploaded content can still be risky if the uploader was not the rightful owner.

Therefore:
- save the source URL
- save license context when relevant
- prefer assets from stable libraries and established contributors
- avoid building critical brand work on questionable uploads

---

## 55. Component Recipes Inspired By Editors

These are component-style recipes to think with. They are not code templates.

### Recipe A: Typing Title
- centered or aligned headline
- direct text append
- caret follow
- clean hold

### Recipe B: Active Word Captions
- line stays stable
- active word changes weight, color, or scale
- emphasis follows transcript timing

### Recipe C: Sticker Accent
- core message remains primary
- sticker or accent enters on top
- exits quickly
- used for energy, not for readability

### Recipe D: Texture Overlay
- low-opacity grain, glow, or vignette
- should be removable without breaking the layout

### Recipe E: Slide Replace
- previous line leaves
- new line arrives from opposite direction
- overlap is short and deliberate

### Recipe F: Device Showcase
- product frame enters
- content reveals inside
- camera or stage movement is slower than UI movement

---

## 56. Research-Informed Asset Sources

Use these sources when appropriate, and re-check their terms when the stakes are high.

### Official / Platform
- Apple Fonts: `https://developer.apple.com/fonts/`
- Apple Design Resources: `https://developer.apple.com/design/resources/`
- SF Symbols: `https://developer.apple.com/sf-symbols/`

### Stock / Media
- Pexels videos help page: `https://help.pexels.com/hc/en-us/articles/360042296474-Do-you-also-provide-free-videos`
- Pexels overview: `https://help.pexels.com/hc/en-us/articles/360042088914-What-is-Pexels-and-how-does-Pexels-work-`
- Mixkit home: `https://mixkit.co/`
- Mixkit music: `https://mixkit.co/free-stock-music/`

### Remotion / Motion Construction
- Remotion docs: `https://www.remotion.dev/docs/`
- Remotion captions docs when subtitle work is needed
- Remotion transitions docs when scene packaging is needed

These are starting points, not blanket approvals. Always match the asset source to the project's legal and visual requirements.

---

## 57. AI Video Foundation Addendum

For editor-style component systems and AI video foundation rules, also read:
- [`AI_VIDEO_FOUNDATION.md`](/Users/almurat/KiKo/.agent/skills/remotion/AI_VIDEO_FOUNDATION.md)

Use the addendum when the task needs:
- CapCut / Jianying style component thinking
- a larger component vocabulary
- asset dependency planning
- AI video system behavior rules
