# Masking, Alpha Channels & Chromakey ("扣下来")

Isolating elements (subjects, UI components) from their backgrounds is essential for advanced compositing in Remotion. There are three primary approaches, depending on the source material.

## 1. Alpha Channels (The Best Approach)

If you are generating the source assets (e.g., exporting from After Effects or Blender), **always export with an Alpha channel**.

-   **Supported Formats:** WebM (VP8/VP9) or Apple ProRes 4444 (`.mov`). Normal MP4s (H.264) do not support transparency.
-   **Remotion Integration:** Use `<OffthreadVideo>` with the `transparent={true}` prop.

```tsx
<OffthreadVideo 
    src={staticFile("character_with_alpha.webm")} 
    transparent={true} 
    style={{ /* overlays perfectly on whatever is behind it */ }}
/>
```

When *rendering* a Remotion composition that needs a transparent background (e.g., to use as an overlay elsewhere), you must render to WebM or ProRes 4444:
`npx remotion render src/index.ts MyComp out.webm --codec=webm`

## 2. CSS Masking & Clip Paths (For UI & Vectors)

For isolating standard React DOM elements or creating dynamic transitions, standard CSS masking works perfectly within Remotion because it uses a real browser engine.

### Using `clip-path`
Great for geometric isolation.

```tsx
<div style={{
    clipPath: 'circle(50% at 50% 50%)', // Creates a circular mask
    backgroundColor: 'red',
    width: 200, height: 200
}}>
    {/* Content inside will be masked to the circle */}
</div>
```

### SVG Path Animation (`@remotion/paths`)
Use the `@remotion/paths` package to draw complex, animated masks.

```tsx
import { evolvePath } from '@remotion/paths';
// ... you can use evolvePath to animate an SVG mask revealing a video layer beneath.
```

## 3. Chromakey / Green Screen (For Live Action Footage)

If you are provided with footage shot on a green screen, you must remove the background programmatically frame-by-frame.

**Note:** As of late 2025, Remotion introduced experimental native Chromakey effects.

### Example Implementation Strategy

If you need finer control than the built-in effects, you implement Chromakey at the Canvas level or via custom WebGL shaders:

1.  Use `<Video>` or `<OffthreadVideo>` but hide it visually (`display: none` or off-screen).
2.  In a `requestAnimationFrame` loop (synced to `useCurrentFrame`), draw the video frame to a hidden `<canvas>`.
3.  Read the `ImageData` using `ctx.getImageData()`.
4.  Iterate through every pixel. If the pixel's RGB value falls within the target "green" threshold, set its Alpha (A) value to `0`.
5.  Draw the modified `ImageData` to a visible `<canvas>`.

*Performance Warning:* CPU-based pixel iteration is slow. For production, a WebGL shader implementation is strongly recommended to process the chroma key on the GPU.
