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

## 9. Deterministic High-Fidelity Backgrounds (WebGL & Canvas 2D)
Complex backgrounds (WebGL/Three.js) can be problematic in serverless/headless environments.
- **WebGL Context Failures**: Headless Chromium often fails to create WebGL contexts (`BindToCurrentSequence failed`). In React 19, this can trigger recursive re-render loops in passive effects (`useEffect`).
- **Canvas 2D Fallback**: Always provide a high-fidelity Canvas 2D fallback for backgrounds to ensure 100% stability in headless rendering.
- **Determinism**: Use `useCurrentFrame()` for all animation timing. Synchronize Three.js/Canvas updates with provide frame counts.
- **Resource Management**: Move heavy resource creation (Geometries, Textures) outside the render loop or into stable `useMemo` hooks with fixed data.
