/**
 * LiquidGlassEffect.remotion.tsx
 *
 * Remotion-compatible version of LiquidGlassEffect.tsx.
 * Key Changes from the original:
 * 1. Replaces R3F <Canvas> + useFrame() with a manual Three.js WebGLRenderer.
 * 2. Replaces `state.clock.elapsedTime` with `useCurrentFrame() / fps` for
 *    absolute determinism.
 * 3. Removes all pointer/mouse interaction effects (not applicable in video).
 * 4. Two-effect split: static setup (once) + frame render (per-frame).
 */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';


// Vertex shader - simple pass-through (unchanged from original)
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader - edge-only refraction with chromatic aberration (unchanged from original)
const fragmentShader = `
  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uEdgeWidth;
  uniform float uDistortionStrength;
  uniform float uChromaticStrength;
  uniform float uBorderRadius;
  uniform float uInteractionPulse;
  uniform float uEdgeTwist;
  uniform float uEdgeContact;
  uniform vec2 uInteractionCenter;
  uniform float uDrawProgress; // 0.0 to 1.0
  varying vec2 vUv;

  float roundedBoxSDF(vec2 centerPosition, vec2 size, float radius) {
    vec2 q = abs(centerPosition) - size + radius;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
  }

  void main() {
    vec2 uv = vUv;
    vec2 centeredUv = uv - 0.5;
    
    float aspect = uResolution.x / uResolution.y;
    vec2 adjustedUv = vec2(centeredUv.x * aspect, centeredUv.y);
    
    vec2 boxSize = vec2(0.48 * aspect, 0.48);
    float radius = uBorderRadius;
    
    // Signed distance to the edge
    float dist = roundedBoxSDF(adjustedUv, boxSize, radius);
    
    // Edge mask - only affect the rim area. 
    // Higher precision and tighter glow to prevent any haze.
    float edgeMask = 1.0 - smoothstep(-0.02, 0.0, dist);
    float innerMask = smoothstep(-0.06, -0.04, dist);
    float rimMask = edgeMask * innerMask;
    
    vec2 gradient = normalize(adjustedUv);
    
    float wave = sin(uTime * 2.0 + length(adjustedUv) * 10.0) * 0.1;
    
    float dispStrength = rimMask * uDistortionStrength * (1.0 + wave * 0.2);
    vec2 displacement = gradient * dispStrength;

    float angle = atan(adjustedUv.y, adjustedUv.x);
    float swirlWave = sin((angle * 8.0) - (uTime * 12.0));
    vec2 tangent = normalize(vec2(-gradient.y, gradient.x) + vec2(1e-5));
    vec2 edgeTwist = tangent * swirlWave * rimMask * uEdgeTwist * 0.034;

    vec2 pulseDelta = uv - uInteractionCenter;
    vec2 pulseDeltaAspect = vec2(pulseDelta.x * aspect, pulseDelta.y);
    float pulseDist = length(pulseDeltaAspect);
    float pulseRing = sin((pulseDist * 22.0) - (uTime * 14.0)) * exp(-pulseDist * 4.2);
    vec2 pulsePush = normalize(pulseDeltaAspect + vec2(1e-5)) * pulseRing * uInteractionPulse * 0.02;
    
    displacement += edgeTwist + pulsePush;
    
    float chromaOffset = rimMask * uChromaticStrength;
    
    vec2 redOffset = displacement * 1.2 + vec2(chromaOffset, 0.0);
    vec2 greenOffset = displacement * 0.8;
    vec2 blueOffset = displacement * 0.6 - vec2(chromaOffset, 0.0);
    
    float r = texture2D(uTexture, uv + redOffset).r;
    float g = texture2D(uTexture, uv + greenOffset).g;
    float b = texture2D(uTexture, uv + blueOffset).b;
    
    vec4 original = texture2D(uTexture, uv);
    
    float fresnel = pow(rimMask, 2.4) * (0.18 + uInteractionPulse * 0.16);
    
    vec3 distortedColor = vec3(r, g, b);
    vec3 finalColor = mix(original.rgb, distortedColor, rimMask);
    
    finalColor += vec3(fresnel);
    
    // --- PERIMETER TRACE LOGIC ---
    // Use angle as a proxy for perimeter progress (cinematic look)
    float angle = atan(adjustedUv.y, adjustedUv.x); 
    // Normalize angle to [0, 1] starting from the top center
    float pathDist = mod((angle / 6.28318) + 0.25, 1.0);
    
    // Draw only if pathDist < uDrawProgress
    float traceMask = smoothstep(uDrawProgress + 0.05, uDrawProgress, pathDist);
    
    // Laser tip glow - Cinematic White/Blue
    float tipGlow = exp(-abs(pathDist - uDrawProgress) * 60.0) * 8.0;
    
    // Cinematic colors
    vec3 laserTraceColor = vec3(0.4, 0.8, 1.0); // Electric Blue
    finalColor = mix(finalColor, laserTraceColor, tipGlow);
    
    float alpha = max(traceMask * rimMask, tipGlow * 0.9);
    
    gl_FragColor = vec4(finalColor, min(1.0, alpha));
  }
`;

interface LiquidGlassEffectProps {
  className?: string;
  enabled: boolean;
  children?: React.ReactNode;
}

export const LiquidGlassEffect: React.FC<LiquidGlassEffectProps> = ({
  children,
  className = '',
  enabled = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, width: videoWidth, height: videoHeight } = useVideoConfig();

  // Cinematic Trace Progress: 0s to 4s (at 30fps = 120 frames)
  const drawProgress = interpolate(frame, [0, 120], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });


  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const uniformsRef = useRef<Record<string, { value: unknown }> | null>(null);

  // 1. One-time setup of the Three.js scene (mirrors the original GlassPlane + Canvas logic)
  useEffect(() => {
    if (!canvasRef.current || rendererRef.current || !enabled) return;

    const canvas = canvasRef.current;

    // Use composition dimensions but allow them to be capped for small UI elements.
    // Most chat inputs are around 800px wide. 
    const canvasW = Math.min(videoWidth, 800);
    const canvasH = Math.min(videoHeight, 240);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        premultipliedAlpha: false,
      });
    } catch (e) {
      console.error('[LiquidGlassEffect.remotion] WebGL init failed:', e);
      return;
    }

    renderer.setPixelRatio(1); // Deterministic
    renderer.setSize(canvasW, canvasH, false);
    renderer.setClearColor(0x000000, 0); // Explicitly transparent
    canvas.id = 'liquid-glass-canvas';

    // 5. Plane geometry for the effect
    rendererRef.current = renderer;

    // Orthographic camera (mirrors R3F Canvas orthographic + zoom=1)
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;
    cameraRef.current = camera;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Create a simple gradient texture (mirrors the original CanvasTexture logic)
    const texCanvas = document.createElement('canvas');
    texCanvas.width = canvasW;
    texCanvas.height = canvasH;
    const ctx = texCanvas.getContext('2d')!;
    // Use a much darker, nearly invisible gradient for the reflection base
    const gradient = ctx.createLinearGradient(0, 0, canvasW, canvasH);
    gradient.addColorStop(0, 'rgba(0,0,0,0.05)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.02)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasW, canvasH);
    const texture = new THREE.CanvasTexture(texCanvas);

    const uniforms: Record<string, { value: unknown }> = {
      uTexture: { value: texture },
      uResolution: { value: new THREE.Vector2(canvasW, canvasH) },
      uTime: { value: 0 },
      uEdgeWidth: { value: 0.04 },
      uDistortionStrength: { value: 0.0035 },
      uChromaticStrength: { value: 0.002 },
      uBorderRadius: { value: 0.08 },
      uInteractionPulse: { value: 0 },
      uEdgeTwist: { value: 0 },
      uEdgeContact: { value: 0 },
      uInteractionCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uDrawProgress: { value: drawProgress },
    };
    uniformsRef.current = uniforms;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    return () => {
      texture.dispose();
      material.dispose();
      geometry.dispose();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [enabled]);

  // 2. Per-frame render loop driven by Remotion's useCurrentFrame()
  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !uniformsRef.current) return;

    // Map Remotion frame → shader time (matches original `state.clock.elapsedTime`)
    const elapsedTime = frame / fps;
    (uniformsRef.current.uTime as { value: number }).value = elapsedTime;
    (uniformsRef.current.uDrawProgress as { value: number }).value = drawProgress;

    const w = containerRef.current?.clientWidth || 768;
    const h = containerRef.current?.clientHeight || 90;

    rendererRef.current.setSize(w, h);
    (uniformsRef.current.uResolution as { value: THREE.Vector2 }).value.set(w, h);

    rendererRef.current.render(sceneRef.current, cameraRef.current);
  }, [frame, fps, drawProgress]);

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* WebGL Canvas Layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          borderRadius: 'inherit',
          overflow: 'hidden',
          background: 'transparent',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            background: 'transparent',
            mixBlendMode: 'normal'
          }}
        />
      </div>

      {/* Content Layer */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
};

export default LiquidGlassEffect;
