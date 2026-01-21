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
    float fresnel = pow(rimMask, 2.0) * 0.4;
    
    // Combine effects
    vec3 distortedColor = vec3(r, g, b);
    vec3 finalColor = mix(original.rgb, distortedColor, rimMask);
    
    // Add rim highlight
    finalColor += vec3(fresnel);
    
    // Output with transparency for non-rim areas
    float alpha = max(rimMask * 0.95, step(0.0, -dist) * 0.02); // Slight tint inside
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

interface GlassPlaneProps {
    texture: THREE.Texture | null;
    resolution: [number, number];
}

function GlassPlane({ texture, resolution }: GlassPlaneProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    const uniforms = useMemo(() => ({
        uTexture: { value: texture },
        uResolution: { value: new THREE.Vector2(resolution[0], resolution[1]) },
        uTime: { value: 0 },
        uEdgeWidth: { value: 0.04 }, // Reduced from default
        uDistortionStrength: { value: 0.002 }, // Very subtle distortion
        uChromaticStrength: { value: 0.002 }, // Minimal chromatic aberration
        uBorderRadius: { value: 0.08 },
    }), [texture, resolution]);

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
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

                // Create gradient background to simulate backdrop
                const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                gradient.addColorStop(0, '#1a1a2e');
                gradient.addColorStop(1, '#16213e');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Add some simulated text lines
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                for (let i = 0; i < 5; i++) {
                    ctx.fillRect(50, 30 + i * 25, canvas.width - 100, 12);
                }

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
                    <GlassPlane texture={texture} resolution={resolution} />
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
