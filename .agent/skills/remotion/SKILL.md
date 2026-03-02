---
name: Remotion
description: The ultimate expert guide for building, optimizing, and scaling programmatic video with Remotion.
---

# Remotion Expert Skill

Remotion transforms React code into frame-accurate video. This skill covers everything from basic components to massive-scale SaaS rendering architectures.

## 1. The Pro Mindset: Fundamentals of Frame-Accuracy
- **Absolute Determinism**: Every render thread must yield identical results.
    - ❌ `Math.random()`, `new Date()`, `UUID()`.
    - ✅ `random(seed)`, `crypto.getRandomValues()` with fixed seed, or passing values via `inputProps`.
- **Frames > Time**: Always calculate animations based on `useCurrentFrame()`. 1 second is exactly `fps` frames.
- **Output Scaling**: For Retina-quality text, use `npx remotion render --scale=2` or target 4K resolution.

---

## 2. Advanced Composition & Dynamic Data
### Dynamic Metadata (`calculateMetadata`)
Essential for videos where length depends on external data (e.g., an audio track or a list of items).
```tsx
<Composition
  id="DynamicTrack"
  component={MyVideo}
  fps={30}
  width={1920}
  height={1080}
  schema={z.object({ audioUrl: z.string() })}
  calculateMetadata={async ({ props }) => {
    const { durationInSeconds } = await getAudioMetadata(props.audioUrl);
    return { durationInFrames: Math.floor(durationInSeconds * 30) };
  }}
/>
```
### Schema-Driven Development
Use **Zod** schemas in `Root.tsx` to enable the **Remotion Studio** visual editor and ensure type safety across your rendering pipeline.

---

## 3. SaaS & Enterprise Architecture: Remotion Lambda
The gold standard for scaling to thousands of concurrent renders.

### Architecture Overview
1.  **S3 Bucket**: Stores the code bundle (as a static site) and final MP4s.
2.  **Orchestrator Lambda**: Triggers the render, calculates chunks.
3.  **Worker Lambdas**: Render small chunks of frames in parallel.
4.  **Combiner**: Stitches chunks into the final video.

### Expert Performance Tuning
- **Concurrency**: Find your "sweet spot" using `npx remotion benchmark`.
- **Frames Per Lambda**: Lower = faster (more parallel), but higher overhead/cost.
- **MP3 Over AAC**: Set `audioCodec: 'mp3'` for 2x faster combining speed (unless QuickTime compatibility is critical).
- **Concurrency Per Lambda**: Set `concurrencyPerLambda` to allow one Lambda to handle multiple browser tabs.

---

## 4. Hyper-Optimization: The "No-GPU" Strategy
Serverless environments (Lambda/Cloud Run) lack GPUs. CPU-bound rendering is slow for modern CSS/WebGL.

### Avoid or Pre-render:
- **WebGL**: Three.js/React Three Fiber (slow on CPU).
- **CSS Filters**: `blur()`, `drop-shadow()`, `box-shadow`.
- **Gradients**: Complex linear/radial gradients.

### Performance Hacks:
- **OffthreadVideo**: Use `<OffthreadVideo>` for high-resolution source footage. Increase `offthreadVideoCacheSizeInBytes` if memory allows.
- **Asset Pre-flighting**: Check asset dimensions and accessibility *before* hitting the render command to avoid silent 404/corruption failures.

---

## 5. Rendering Command Mastery
| Goal | Command |
| :--- | :--- |
| **High Quality** | `npx remotion render --crf=18` (Lower = Better quality) |
| **Fastest Encode** | `npx remotion render --codec=h264 --preset=ultrafast` |
| **Web Optimized** | `npx remotion render --video-bitrate=2M` |
| **Alpha Channel** | `npx remotion render --codec=webm --prores-profile=4444` |
| **Debug Slow Frames**| `npx remotion render --log=verbose` |

---

## 6. Testing & CI/CD
- **Visual Snapshot Testing**: Render specific frames (e.g., frame 0, 30, 90) and compare pixel data against a baseline.
- **Unit Testing**: Use **React Testing Library** with **Happy DOM** for blazing fast component logic tests.
- **Snapshot Frames**: `npx remotion still <id> --frame=15` to verify layouts without a full render.
- **GitHub Actions**: Use the `Install and Test` workflow to ensure code changes don't break determinism.

---

## 7. Specialized Ecosystem Integrations
- **@remotion/paths**: The `evolvePath()` function is the secret to "handwritten" SVG animations.
- **@remotion/lottie**: Perfect for importing complex After Effects animations.
- **@remotion/google-fonts**: Use `continueRender()` to wait for fonts to load before the first frame renders.
- **@remotion/skia**: High-performance 2D graphics that can be faster than standard Canvas for certain operations.

---

## 8. Common Community Solutions (Patterns)
- **The "Ken Burns" Effect**: Interpolating scale and position simultaneously for still images.
- **Automatic Subtitles**: Fetching JSON transcripts and mapping `useCurrentFrame()` to the active subtitle index.
- **Data-Viz**: Using D3.js inside Remotion components (treat D3 as a pure rendering function).

---

## 9. ✅ PROVEN RECIPE: Native WebGL / Three.js Parity in Remotion

> This recipe was battle-tested on the Kiko project (March 2026). Follow it exactly to replicate existing Three.js / WebGL React components 1:1 in Remotion video output.

### Step 1: Enable the Correct OpenGL Renderer (CRITICAL)

Without this, Headless Chrome on macOS (Apple Silicon) will crash with `BindToCurrentSequence failed` and trigger a React 19 infinite recursive re-render loop.

```typescript
// remotion.config.ts
Config.setChromiumOpenGlRenderer('angle'); // macOS (uses Apple Metal via ANGLE)
// Config.setChromiumOpenGlRenderer('swangle'); // Linux/CI with no GPU (SwiftShader software renderer)
```

### Step 2: Import Global CSS in Root.tsx

Without this, Tailwind classes are stripped and the UI layout will look completely wrong.

```tsx
// src/remotion/Root.tsx
import '../index.css'; // ← Add this line FIRST
```

### Step 3: Split One-time Setup from Per-Frame Rendering

This is the pattern that eliminates the React 19 recursion loop. Two separate `useEffect` hooks, never one combined loop.

```tsx
// ✅ Correct Pattern
const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
const sceneRef = useRef<THREE.Scene | null>(null);
const uniformsRef = useRef<{uTime: {value: number}} | null>(null);

// Effect 1: ONE-TIME setup. Runs once, creates the WebGL context.
useEffect(() => {
    if (rendererRef.current) return; // Guard against double-run (StrictMode)
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(1); // Always 1 for deterministic video output
    rendererRef.current = renderer;
    // ... build scene, geometry, shaders ...
    return () => { renderer.dispose(); rendererRef.current = null; };
}, []); // Empty deps = truly one-time

// Effect 2: PER-FRAME render. Driven by Remotion's frame clock.
useEffect(() => {
    if (!rendererRef.current || !uniformsRef.current) return;
    const seconds = frame / fps;
    uniformsRef.current.uTime.value = seconds * ORIGINAL_SPEED_FACTOR;
    rendererRef.current.render(sceneRef.current!, cameraRef.current!);
}, [frame, fps]); // Runs every time Remotion advances to a new frame
```

### Step 4: Replace All Non-Deterministic Time Sources

| ❌ Original (Non-Deterministic) | ✅ Remotion Replacement |
|---|---|
| `Date.now() * 0.0001` | `(frame / fps) * 0.0001` |
| `state.clock.elapsedTime` (R3F `useFrame`) | `frame / fps` |
| `count += 0.02` per rAF | `(frame / fps) * (fps * 0.02)` |
| `delta` for decay animations | Remove; set to animated fixed values |

### Step 5: Use Seeded Pseudo-Random for Particle Initialization

`Math.random()` is fine in setup but can differ across render threads. Use a seeded function for true reproducibility:

```ts
const randomSeed = (s: number) => () => {
    s = Math.sin(s) * 10000;
    return s - Math.floor(s);
};
const rand = randomSeed(42); // Always use the same seed
```

### Step 6: Remove Interaction Effects

Mouse hover, pointer events, focus effects — these cannot exist in a headless render. Remove all `addEventListener` calls and interaction-driven uniform updates from `.remotion.tsx` files.

### Known Remaining Issue (Low Priority)
The `LiquidGlassEffect` canvas may render as a white box because the canvas `width`/`height` are not set from a style-derived pixel size at mount time in a headless environment. Fix by reading dimensions from `useVideoConfig()` instead of `clientWidth`.
