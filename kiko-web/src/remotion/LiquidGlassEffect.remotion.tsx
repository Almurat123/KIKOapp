import React, { useEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

export const LiquidGlassEffect: React.FC<{ children: React.ReactNode; className?: string; enabled?: boolean }> = ({
  children,
  className = '',
  enabled = true,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 2. Rendering loop (deterministic based on 'frame')
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Constants matching the original effect
    const borderRadius = (width * 0.08); // Approximate
    const time = frame * 0.05;

    // 1. Draw the "Glass" rim using shadows and gradients
    ctx.save();

    // Define the rounded rectangle path
    const x = width * 0.02;
    const y = height * 0.02;
    const w = width * 0.96;
    const h = height * 0.96;

    const drawRoundedRect = (c: CanvasRenderingContext2D, rx: number, ry: number, rw: number, rh: number, rr: number) => {
      c.beginPath();
      c.moveTo(rx + rr, ry);
      c.lineTo(rx + rw - rr, ry);
      c.quadraticCurveTo(rx + rw, ry, rx + rw, ry + rr);
      c.lineTo(rx + rw, ry + rh - rr);
      c.quadraticCurveTo(rx + rw, ry + rh, rx + rw - rr, ry + rh);
      c.lineTo(rx + rr, ry + rh);
      c.quadraticCurveTo(rx, ry + rh, rx, ry + rh - rr);
      c.lineTo(rx, ry + rr);
      c.quadraticCurveTo(rx, ry, rx + rr, ry);
      c.closePath();
    };

    // Inner Glow / Fresnel shim
    drawRoundedRect(ctx, x, y, w, h, borderRadius);

    // Use shadowBlur and shadowColor for the bloom/rim effect
    ctx.shadowBlur = 40 + Math.sin(time) * 10;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 2. Refractive Shim (using a subtle animated gradient)
    const outerGrad = ctx.createLinearGradient(0, 0, width, height);
    outerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
    outerGrad.addColorStop(0.5 + Math.sin(time * 0.5) * 0.1, 'rgba(255, 255, 255, 0.15)');
    outerGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');

    ctx.fillStyle = outerGrad;
    ctx.fill();

    // 3. Animated Chromatic Abberation / Swirl simulation
    // (Hard to do perfectly in 2D without pixel manipulation, but we can do highlights)
    ctx.restore();

    // Interaction pulse highlight
    ctx.save();
    ctx.translate(width / 2, height / 2);
    const pulse = (Math.sin(time * 2.0) + 1.0) / 2.0;
    const pulseGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.5);
    pulseGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    pulseGrad.addColorStop(0.8 + pulse * 0.1, 'rgba(255, 255, 255, 0.1)');
    pulseGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = pulseGrad;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();

  }, [frame, width, height, enabled]);

  if (!enabled) return <div className={className}>{children}</div>;

  return (
    <div className={className} style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
};

export default LiquidGlassEffect;
