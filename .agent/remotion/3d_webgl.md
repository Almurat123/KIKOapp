# 3D Integration & WebGL in Remotion

Integrating 3D elements (via `three.js` and `@react-three/fiber`) into Remotion requires strict adherence to deterministic rendering principles. If a 3D animation relies on real-time clocks (`Date.now()`) or non-deterministic loops (`requestAnimationFrame`), the resulting video will have jitter, flickering, or completely desynced frames.

## The Golden Rule: `useCurrentFrame()` is your only clock

Never use R3F's `useFrame` hook to drive animations based on its `state.clock.elapsedTime` or `delta`. 
**Always** derive animation state directly from Remotion's `useCurrentFrame()`.

### Example: The Deterministic Rotating Cube

```tsx
import { useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';

export const SpinningCube: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const mesh = useRef<Mesh>(null!);

    // Calculate time deterministically
    const timeInSeconds = frame / fps;

    useFrame(() => {
        if (!mesh.current) return;
        // FORCE the rotation based on the absolute frame time, 
        // ignoring R3F's internal delta/clock.
        mesh.current.rotation.x = timeInSeconds * 0.5;
        mesh.current.rotation.y = timeInSeconds * 1.2;
    });

    return (
        <mesh ref={mesh}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="hotpink" />
        </mesh>
    );
};
```

## Setup: `<ThreeCanvas>` over `<Canvas>`

When using `@remotion/three`, you MUST use their specialized `<ThreeCanvas>` instead of the default R3F `<Canvas>`. This specialized canvas ensures that the WebGL renderer halts and waits for Remotion's frame capture mechanism before proceeding.

```tsx
import { ThreeCanvas } from '@remotion/three';

export const Scene: React.FC = () => {
    return (
        <ThreeCanvas width={1920} height={1080}>
            <ambientLight intensity={0.5} />
            <SpinningCube />
        </ThreeCanvas>
    );
};
```

## Handling Complex Assets (GLTF/GLB)

Loading external models requires ensuring the asset is fully loaded *before* the frame renders.

1.  Use `@react-three/drei`'s `useGLTF` for local caching.
2.  If animations are baked into the GLTF, you must manually scrub the `AnimationMixer` using the calculated `timeInSeconds`, rather than calling `mixer.update(delta)`.

## Troubleshooting Chromium WebGL Context Loss

In headless environments (like Remotion Lambda or CI/CD pipelines), Chromium often drops the WebGL context (`BindToCurrentSequence failed`).

**Solution:**
Configure Remotion to use software rendering or specific ANGLE parameters in your `remotion.config.ts`:

```typescript
// remotion.config.ts
import { Config } from '@remotion/cli/config';

// Use 'angle' for desktop with GPU
// Use 'swangle' (SwiftShader) for CPU-only environments (Lambda/CI)
Config.setChromiumOpenGlRenderer('swangle'); 
```
