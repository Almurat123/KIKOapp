import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThemeContext } from '../../contexts/ThemeContext';

export const StardustBackground: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { resolvedTheme } = useThemeContext();

    // Safety guard to prevent double-initialization (Fixes "Browser Freeze" in StrictMode)
    const initializedRef = useRef(false);

    useEffect(() => {
        if (!containerRef.current || initializedRef.current) return;
        initializedRef.current = true;

        const container = containerRef.current;
        const width = window.innerWidth;
        const height = window.innerHeight;

        // --- Init Three.js Scene ---
        const scene = new THREE.Scene();
        const isLight = resolvedTheme === 'light';
        const bgColor = isLight ? 0xFFFFFF : 0x000103;
        scene.fog = new THREE.FogExp2(bgColor, 0.0006);
        scene.background = new THREE.Color(bgColor);

        const aspect = width / height;
        const camera = new THREE.PerspectiveCamera(aspect < 1 ? 85 : 60, aspect, 1, 10000);
        camera.position.set(0, 0, 1400);

        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height);
        container.appendChild(renderer.domElement);

        // --- GPU Accelerated Shaders (Moving math to GPU to avoid lag) ---
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

                // Exact Wave Logic from User Reference (Computed on GPU)
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

                // Exact Pulse logic from reference: (Math.sin(count * 2.5 + randoms[i]) + 1.0) / 2.0;
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

                // 黑底增强发光算法 (Exact from User Reference)
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

        const material = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader,
            fragmentShader,
            transparent: true,
            blending: isLight ? THREE.NormalBlending : THREE.AdditiveBlending,
            depthWrite: false
        });

        // --- Implementation of Google 4-Color Gradient ---
        const SEPARATION = 45, AMOUNTX = 100, AMOUNTY = 65;
        const googleColors = [
            new THREE.Color(0x4285F4), // 蓝
            new THREE.Color(0x34A853), // 绿
            new THREE.Color(0xFBBC05), // 黄
            new THREE.Color(0xEA4335)  // 红
        ];

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
                const y = isTop ? 1.0 : -1.0; // Use Y to store the "factor" for the shader

                positions[i * 3] = x;
                positions[i * 3 + 1] = y;
                positions[i * 3 + 2] = z;

                basePositions[i * 3] = x;
                basePositions[i * 3 + 1] = y;
                basePositions[i * 3 + 2] = z;

                // Gradient Interpolation
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

                scales[i] = Math.random() > 0.98 ? 40.0 : 14.0;
                randoms[i] = Math.random() * Math.PI * 2;
            }

            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geo.setAttribute('aBasePos', new THREE.BufferAttribute(basePositions, 3));
            geo.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
            geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
            geo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

            const points = new THREE.Points(geo, material);
            // In original code, position.y is set to +/- GAP. Here we use uGap attribute in vertex shader.
            return points;
        };

        const pointsTop = createLayer(true);
        const pointsBottom = createLayer(false);
        scene.add(pointsTop);
        scene.add(pointsBottom);

        // --- Animation Loop ---
        let count = 0;
        let animationFrameId: number;

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            count += 0.02;
            uniforms.uTime.value = count;

            const time = Date.now() * 0.0001;
            camera.position.x = 450 * Math.sin(time * 0.4);
            camera.position.y = 100 * Math.cos(time * 0.3);
            camera.position.z = 1350 + 200 * Math.cos(time * 0.6);
            camera.lookAt(0, 0, 0);

            renderer.render(scene, camera);
        };

        animate();

        // --- Robust Cleanup ---
        const handleResize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);

            // Explicit Disposal
            material.dispose();
            pointsTop.geometry.dispose();
            pointsBottom.geometry.dispose();
            renderer.dispose();

            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
            initializedRef.current = false;
        };
    }, [resolvedTheme]);

    return (
        <div
            ref={containerRef}
            id="webgl-background-root"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 0,
                pointerEvents: 'none',
                overflow: 'hidden',
                backgroundColor: resolvedTheme === 'light' ? '#FFFFFF' : '#000103',
            }}
        />
    );
};
