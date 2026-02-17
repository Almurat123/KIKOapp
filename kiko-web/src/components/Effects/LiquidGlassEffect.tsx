import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Vertex shader - simple pass-through
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader - edge-only refraction with chromatic aberration
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
  varying vec2 vUv;

  // Signed distance function for rounded rectangle
  float roundedBoxSDF(vec2 centerPosition, vec2 size, float radius) {
    vec2 q = abs(centerPosition) - size + radius;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
  }

  void main() {
    vec2 uv = vUv;
    vec2 centeredUv = uv - 0.5;
    
    // Calculate aspect ratio for proper rounded rect
    float aspect = uResolution.x / uResolution.y;
    vec2 adjustedUv = vec2(centeredUv.x * aspect, centeredUv.y);
    
    // Box size (slightly smaller than 0.5 to account for padding)
    vec2 boxSize = vec2(0.48 * aspect, 0.48);
    float radius = uBorderRadius;
    
    // Signed distance to the edge
    float dist = roundedBoxSDF(adjustedUv, boxSize, radius);
    
    // Edge mask - only affect the rim area
    float edgeMask = 1.0 - smoothstep(-uEdgeWidth, 0.0, dist);
    float innerMask = smoothstep(-uEdgeWidth * 2.0, -uEdgeWidth, dist);
    float rimMask = edgeMask * innerMask;
    
    // Calculate displacement direction (outward from edge)
    vec2 gradient = normalize(adjustedUv);
    
    // Add subtle wave animation
    float wave = sin(uTime * 2.0 + length(adjustedUv) * 10.0) * 0.1;
    
    // Displacement strength based on edge proximity
    float dispStrength = rimMask * uDistortionStrength * (1.0 + wave * 0.2);
    vec2 displacement = gradient * dispStrength;

    // Edge twist: tangential swirl on rim to mimic "twist when state changes"
    float angle = atan(adjustedUv.y, adjustedUv.x);
    float swirlWave = sin((angle * 8.0) - (uTime * 12.0));
    vec2 tangent = normalize(vec2(-gradient.y, gradient.x) + vec2(1e-5));
    vec2 edgeTwist = tangent * swirlWave * rimMask * (uEdgeTwist * 0.45 + uEdgeContact * 2.1) * 0.034;

    // Interaction ripple centered at pointer/focus location
    vec2 pulseDelta = uv - uInteractionCenter;
    vec2 pulseDeltaAspect = vec2(pulseDelta.x * aspect, pulseDelta.y);
    float pulseDist = length(pulseDeltaAspect);
    float pulseRing = sin((pulseDist * 22.0) - (uTime * 14.0)) * exp(-pulseDist * 4.2);
    vec2 pulsePush = normalize(pulseDeltaAspect + vec2(1e-5)) * pulseRing * (uInteractionPulse * 0.55 + uEdgeContact * 1.45) * 0.02;
    
    displacement += edgeTwist + pulsePush;
    
    // Chromatic aberration - offset each channel differently
    float chromaOffset = rimMask * uChromaticStrength;
    
    vec2 redOffset = displacement * 1.2 + vec2(chromaOffset, 0.0);
    vec2 greenOffset = displacement * 0.8;
    vec2 blueOffset = displacement * 0.6 - vec2(chromaOffset, 0.0);
    
    // Sample texture with chromatic aberration
    float r = texture2D(uTexture, uv + redOffset).r;
    float g = texture2D(uTexture, uv + greenOffset).g;
    float b = texture2D(uTexture, uv + blueOffset).b;
    
    // Original color for blending
    vec4 original = texture2D(uTexture, uv);
    
    // Fresnel-like rim highlight
    float fresnel = pow(rimMask, 2.4) * (0.18 + uInteractionPulse * 0.16 + uEdgeContact * 0.22);
    
    // Combine effects
    vec3 distortedColor = vec3(r, g, b);
    vec3 finalColor = mix(original.rgb, distortedColor, rimMask);
    
    // Add rim highlight
    finalColor += vec3(fresnel);
    
    // Output with transparency for non-rim areas
    float alpha = max(rimMask * 0.92, step(0.0, -dist) * 0.006); // Keep center clear
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

interface GlassPlaneProps {
    texture: THREE.Texture | null;
    resolution: [number, number];
    interactionRef: React.MutableRefObject<{
        pulse: number;
        twist: number;
        edge: number;
        center: THREE.Vector2;
    }>;
}

function GlassPlane({ texture, resolution, interactionRef }: GlassPlaneProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    const uniforms = useMemo(() => ({
        uTexture: { value: texture },
        uResolution: { value: new THREE.Vector2(resolution[0], resolution[1]) },
        uTime: { value: 0 },
        uEdgeWidth: { value: 0.04 }, // Reduced from default
        uDistortionStrength: { value: 0.0035 }, // Base refraction
        uChromaticStrength: { value: 0.002 }, // Minimal chromatic aberration
        uBorderRadius: { value: 0.08 },
        uInteractionPulse: { value: 0 },
        uEdgeTwist: { value: 0 },
        uEdgeContact: { value: 0 },
        uInteractionCenter: { value: new THREE.Vector2(0.5, 0.5) },
    }), [texture, resolution]);

    useFrame((state, delta) => {
        if (materialRef.current) {
            const mat = materialRef.current;
            mat.uniforms.uTime.value = state.clock.elapsedTime;

            // Decay interaction values every frame
            interactionRef.current.pulse = Math.max(0, interactionRef.current.pulse - delta * 0.65);
            interactionRef.current.twist = Math.max(0, interactionRef.current.twist - delta * 0.55);
            interactionRef.current.edge = Math.max(0, interactionRef.current.edge - delta * 0.75);

            mat.uniforms.uInteractionPulse.value = interactionRef.current.pulse;
            mat.uniforms.uEdgeTwist.value = interactionRef.current.twist;
            mat.uniforms.uEdgeContact.value = interactionRef.current.edge;
            mat.uniforms.uInteractionCenter.value.copy(interactionRef.current.center);
        }
    });

    useEffect(() => {
        if (materialRef.current && texture) {
            materialRef.current.uniforms.uTexture.value = texture;
        }
    }, [texture]);

    return (
        <mesh ref={meshRef}>
            <planeGeometry args={[2, 2]} />
            <shaderMaterial
                ref={materialRef}
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                uniforms={uniforms}
                transparent={true}
                depthWrite={false}
            />
        </mesh>
    );
}

interface LiquidGlassEffectProps {
    children: React.ReactNode;
    className?: string;
    enabled?: boolean;
}

export const LiquidGlassEffect: React.FC<LiquidGlassEffectProps> = ({
    children,
    className = '',
    enabled = true,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const [texture, setTexture] = useState<THREE.Texture | null>(null);
    const [resolution, setResolution] = useState<[number, number]>([800, 200]);
    const animationFrameRef = useRef<number | undefined>(undefined);
    const interactionRef = useRef({
        pulse: 0,
        twist: 0,
        edge: 0,
        center: new THREE.Vector2(0.5, 0.5),
    });
    const lastMoveTsRef = useRef(0);

    // Capture backdrop content and create texture
    useEffect(() => {
        if (!enabled || !containerRef.current) return;

        const updateTexture = async () => {
            try {
                // For now, create a simple gradient texture as placeholder
                // In production, this would capture actual backdrop content
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;

                const dpr = window.devicePixelRatio || 1;
                canvas.width = (rect.width || 800) * dpr;
                canvas.height = (rect.height || 200) * dpr;

                setResolution([canvas.width, canvas.height]);

                // Keep proxy texture clean/bright to avoid dark haze streaks
                const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                gradient.addColorStop(0, 'rgba(255,255,255,0.12)');
                gradient.addColorStop(1, 'rgba(245,246,252,0.06)');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Create Three.js texture from canvas
                const newTexture = new THREE.CanvasTexture(canvas);
                newTexture.needsUpdate = true;
                setTexture(newTexture);

            } catch (error) {
                console.error('[LiquidGlassEffect] Failed to capture backdrop:', error);
            }
        };

        updateTexture();

        // Update on resize
        const handleResize = () => {
            updateTexture();
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [enabled]);

    useEffect(() => {
        if (!enabled || !containerRef.current) return;

        const container = containerRef.current;
        const triggerTwist = (x: number, y: number, intensity: number, edgeIntensity = 0) => {
            interactionRef.current.center.set(x, y);
            interactionRef.current.pulse = Math.max(interactionRef.current.pulse, intensity);
            interactionRef.current.twist = Math.max(interactionRef.current.twist, intensity);
            interactionRef.current.edge = Math.max(interactionRef.current.edge, edgeIntensity);
        };

        const setFromEvent = (clientX: number, clientY: number, intensity: number) => {
            const rect = container.getBoundingClientRect();
            if (rect.width < 2 || rect.height < 2) return;
            const localX = clientX - rect.left;
            const localY = clientY - rect.top;
            const x = Math.min(1, Math.max(0, localX / rect.width));
            const y = Math.min(1, Math.max(0, localY / rect.height));
            const minEdgePx = Math.min(localX, rect.width - localX, localY, rect.height - localY);
            const edgeBandPx = Math.max(14, Math.min(28, Math.min(rect.width, rect.height) * 0.1));
            const edgeStrength = minEdgePx < edgeBandPx ? 1 - (minEdgePx / edgeBandPx) : 0;
            triggerTwist(x, y, intensity + edgeStrength * 1.4, edgeStrength * 2.8);
        };

        const onFocusIn = () => triggerTwist(0.5, 0.5, 0.9, 0.25);
        const onInput = () => triggerTwist(0.5, 0.5, 0.75, 0.2);
        const onPointerMove = (e: PointerEvent) => {
            const now = performance.now();
            if (now - lastMoveTsRef.current < 33) return;
            lastMoveTsRef.current = now;
            const rect = container.getBoundingClientRect();
            if (rect.width < 2 || rect.height < 2) return;
            const localX = e.clientX - rect.left;
            const localY = e.clientY - rect.top;
            const clampedX = Math.min(1, Math.max(0, localX / rect.width));
            const clampedY = Math.min(1, Math.max(0, localY / rect.height));
            const minEdgePx = Math.min(localX, rect.width - localX, localY, rect.height - localY);
            const edgeBandPx = Math.max(14, Math.min(28, Math.min(rect.width, rect.height) * 0.1));
            const edgeStrength = minEdgePx < edgeBandPx ? 1 - (minEdgePx / edgeBandPx) : 0;
            if (edgeStrength <= 0.02) return;
            triggerTwist(clampedX, clampedY, 0.55 + edgeStrength * 1.55, edgeStrength * 2.8);
        };
        const onPointerDown = (e: PointerEvent) => setFromEvent(e.clientX, e.clientY, 2.4);

        container.addEventListener('focusin', onFocusIn);
        container.addEventListener('input', onInput);
        container.addEventListener('pointermove', onPointerMove, { passive: true });
        container.addEventListener('pointerdown', onPointerDown, { passive: true });

        return () => {
            container.removeEventListener('focusin', onFocusIn);
            container.removeEventListener('input', onInput);
            container.removeEventListener('pointermove', onPointerMove);
            container.removeEventListener('pointerdown', onPointerDown);
        };
    }, [enabled]);

    if (!enabled) {
        return <div className={className}>{children}</div>;
    }

    return (
        <div ref={containerRef} className={className} style={{ position: 'relative' }}>
            {/* WebGL Canvas Layer */}
            <div
                ref={canvasContainerRef}
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 0,
                    borderRadius: 'inherit',
                    overflow: 'hidden',
                }}
            >
                <Canvas
                    orthographic
                    camera={{ zoom: 1, position: [0, 0, 1] }}
                    style={{
                        width: '100%',
                        height: '100%',
                        background: 'transparent',
                    }}
                    gl={{
                        alpha: true,
                        antialias: true,
                        premultipliedAlpha: false,
                    }}
                >
                    <GlassPlane texture={texture} resolution={resolution} interactionRef={interactionRef} />
                </Canvas>
            </div>

            {/* Content Layer */}
            <div style={{ position: 'relative', zIndex: 1 }}>
                {children}
            </div>
        </div>
    );
};

export default LiquidGlassEffect;
