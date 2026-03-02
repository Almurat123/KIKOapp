import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useCurrentFrame } from 'remotion';

export const BackgroundOnly: React.FC = () => {
    const frame = useCurrentFrame();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        try {
            const renderer = new THREE.WebGLRenderer({
                canvas: canvasRef.current,
                alpha: true,
                powerPreference: 'high-performance'
            });
            renderer.setSize(1920, 1080, false); // false = don't update style

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1000);
            camera.position.z = 5;

            const geometry = new THREE.BoxGeometry();
            const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const cube = new THREE.Mesh(geometry, material);
            scene.add(cube);

            cube.rotation.x = frame * 0.1;
            cube.rotation.y = frame * 0.1;

            renderer.render(scene, camera);

            // Cleanup immediately (for still frame testing)
            return () => {
                renderer.dispose();
                geometry.dispose();
                material.dispose();
            };
        } catch (e: any) {
            setError(e.message || 'Unknown WebGL Error');
        }
    }, [frame]);

    if (error) {
        return (
            <div style={{ color: 'red', fontSize: 50, background: 'white' }}>
                WebGL Error: {error}
            </div>
        );
    }

    return (
        <canvas
            ref={canvasRef}
            width={1920}
            height={1080}
            style={{ width: '100%', height: '100%', background: 'black' }}
        />
    );
};
