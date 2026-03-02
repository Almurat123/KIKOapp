import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { useThemeContext } from '../contexts/ThemeContext';

export const StardustBackground: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { resolvedTheme } = useThemeContext();
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();

    // We store refs to the uniforms and camera so we can update them inside the useEffect
    // without re-running the entire Three.js setup pipeline.
    const uniformsRef = useRef<{ uTime: { value: number }, uGap: { value: number } } | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);

    // 1. One-time Setup of the WebGL Environment
    useEffect(() => {
        if (!containerRef.current || rendererRef.current) return;

        const container = containerRef.current;
        const isLight = resolvedTheme === 'light';
        const bgColor = isLight ? 0xFFFFFF : 0x000103;

        // --- Init Three.js Scene ---
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.fog = new THREE.FogExp2(bgColor, 0.0006);
        scene.background = new THREE.Color(bgColor);

        const aspect = width / height;
        const camera = new THREE.PerspectiveCamera(aspect < 1 ? 85 : 60, aspect, 1, 10000);
        camera.position.set(0, 0, 1400);
        cameraRef.current = camera;

        let renderer: THREE.WebGLRenderer;
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: 'high-performance'
            });
        } catch (error) {
            console.error('[StardustBackground] Remotion WebGL init failed:', error);
            return;
        }

        // Lock pixel ratio to 1 for deterministic video output
        renderer.setPixelRatio(1);
        renderer.setSize(width, height);
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // --- GPU Accelerated Shaders ---
        const vertexShader = `
            uniform float uTime;
            uniform float uGap;
            attribute float aScale;
            attribute float aRandom;
            attribute vec3 aBasePos;
            attribute vec3 customColor;
            varying float vPulse;
            varying vec3 vColor;

            void main() {
                vColor = customColor;
                
                // Coordinate-based noise seeds
                float ix = aBasePos.x / 45.0 + 50.0;
                float iy = aBasePos.z / 45.0 + 32.5;
                float factor = position.y > 0.0 ? 1.0 : -1.0;

                // Exact Wave Logic from User Reference
                float mainWave = sin((ix * 0.15) + (uTime * 0.6)) * 80.0;
                float secondaryWave = cos((iy * 0.12) + (uTime * 0.8)) * 60.0;
                float turbulence = sin((ix * 0.3 + iy * 0.2 + uTime * 1.2)) * 30.0;
                
                // Pulsing motion scale
                float breath = 0.8 + sin(uTime * 0.4) * 0.2;
                
                // Horizontal drifting
                float driftX = sin(uTime * 0.5 + aRandom) * 15.0;
                float driftZ = cos(uTime * 0.5 + aRandom) * 15.0;

                float targetY = (uGap * factor) + (mainWave + secondaryWave + turbulence) * factor * breath;
                vec3 animatedPos = vec3(aBasePos.x + driftX, targetY, aBasePos.z + driftZ);

                vPulse = (sin(uTime * 2.5 + aRandom) + 1.0) / 2.0;

                vec4 mvPosition = modelViewMatrix * vec4( animatedPos, 1.0 );
                gl_PointSize = aScale * ( 600.0 / - mvPosition.z );
                gl_Position = projectionMatrix * mvPosition;
            }
        `;

        const fragmentShader = `
            varying float vPulse;
            varying vec3 vColor;
            
            void main() {
                float r = distance(gl_PointCoord, vec2(0.5));
                if (r > 0.5) discard;

                // 黑底增强发光算法
                float core = pow(1.0 - r * 4.2, 4.0);
                core = max(core, 0.0);
                float glow = pow(1.0 - r * 2.1, 3.2);
                
                vec3 finalColor = mix(vColor, vec3(1.0, 1.0, 1.0), core);
                gl_FragColor = vec4( finalColor, glow * (0.4 + vPulse * 0.6) );
            }
        `;

        const uniforms = {
            uTime: { value: 0 },
            uGap: { value: 360.0 }
        };
        uniformsRef.current = uniforms;

        const material = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader,
            fragmentShader,
            transparent: true,
            blending: isLight ? THREE.NormalBlending : THREE.AdditiveBlending,
            depthWrite: false
        });

        // --- Implementation of Google 4-Color Gradient ---
        // For determinism in video, we use a seeded random or fixed pattern if possible.
        // Math.random() is technically okay here ONLY because it runs once during setup, 
        // but `random` per frame is safer.
        const SEPARATION = 45, AMOUNTX = 100, AMOUNTY = 65;
        const googleColors = [
            new THREE.Color(0x4285F4),
            new THREE.Color(0x34A853),
            new THREE.Color(0xFBBC05),
            new THREE.Color(0xEA4335)
        ];

        // Seeded random replacement for determinism
        const randomSeed = (s: number) => {
            return () => {
                s = Math.sin(s) * 10000;
                return s - Math.floor(s);
            };
        };
        const pseudoRandom = randomSeed(42);

        const createLayer = (isTop: boolean) => {
            const numParticles = AMOUNTX * AMOUNTY;
            const positions = new Float32Array(numParticles * 3);
            const basePositions = new Float32Array(numParticles * 3);
            const colors = new Float32Array(numParticles * 3);
            const scales = new Float32Array(numParticles);
            const randoms = new Float32Array(numParticles);

            for (let i = 0; i < numParticles; i++) {
                const ix = Math.floor(i / AMOUNTY);
                const iy = i % AMOUNTY;
                const x = ix * SEPARATION - ((AMOUNTX * SEPARATION) / 2);
                const z = iy * SEPARATION - ((AMOUNTY * SEPARATION) / 2);
                const y = isTop ? 1.0 : -1.0;

                positions[i * 3] = x;
                positions[i * 3 + 1] = y;
                positions[i * 3 + 2] = z;

                basePositions[i * 3] = x;
                basePositions[i * 3 + 1] = y;
                basePositions[i * 3 + 2] = z;

                const t = ix / (AMOUNTX - 1);
                let baseColor = new THREE.Color();
                if (t < 0.33) {
                    baseColor.lerpColors(googleColors[0], googleColors[1], t / 0.33);
                } else if (t < 0.66) {
                    baseColor.lerpColors(googleColors[1], googleColors[2], (t - 0.33) / 0.33);
                } else {
                    baseColor.lerpColors(googleColors[2], googleColors[3], (t - 0.66) / 0.34);
                }

                colors[i * 3] = baseColor.r;
                colors[i * 3 + 1] = baseColor.g;
                colors[i * 3 + 2] = baseColor.b;

                scales[i] = pseudoRandom() > 0.98 ? 40.0 : 14.0;
                randoms[i] = pseudoRandom() * Math.PI * 2;
            }

            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geo.setAttribute('aBasePos', new THREE.BufferAttribute(basePositions, 3));
            geo.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
            geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
            geo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

            return new THREE.Points(geo, material);
        };

        const pointsTop = createLayer(true);
        const pointsBottom = createLayer(false);
        scene.add(pointsTop);
        scene.add(pointsBottom);

        return () => {
            material.dispose();
            pointsTop.geometry.dispose();
            pointsBottom.geometry.dispose();
            renderer.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
            rendererRef.current = null;
        };
    }, [resolvedTheme, width, height]);

    // 2. Render Loop (Driven by Remotion's frame)
    useEffect(() => {
        if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !uniformsRef.current) return;

        // Map Remotion frame to the original shader's "count" and "time" logic
        // Original: count += 0.02 per rAF. 60fps * 0.02 = 1.2 units per second.
        const seconds = frame / fps;
        const count = seconds * 1.2;

        uniformsRef.current.uTime.value = count;

        // Original camera logic: const time = Date.now() * 0.0001; 
        // 1 second real time = 0.1 units.
        const cameraTime = seconds * 0.1;

        cameraRef.current.position.x = 450 * Math.sin(cameraTime * 0.4);
        cameraRef.current.position.y = 100 * Math.cos(cameraTime * 0.3);
        cameraRef.current.position.z = 1350 + 200 * Math.cos(cameraTime * 0.6);
        cameraRef.current.lookAt(0, 0, 0);

        // Crucial: Manually trigger render for this exact frame
        rendererRef.current.render(sceneRef.current, cameraRef.current);

    }, [frame, fps]);

    return (
        <div
            ref={containerRef}
            id="remotion-stardust-root"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 0,
                pointerEvents: 'none',
                overflow: 'hidden',
                backgroundColor: resolvedTheme === 'light' ? '#FFFFFF' : '#000103',
            }}
        />
    );
};

export default StardustBackground;
