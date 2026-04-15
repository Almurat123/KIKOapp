import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  
  // 呼吸感发光效果
  const glowOpacity = interpolate(
    Math.sin(frame / 20),
    [-1, 1],
    [0.15, 0.25]
  );

  return (
    <AbsoluteFill>
      {/* 基础径向发光 */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        background: 'radial-gradient(circle at center, rgba(100, 100, 100, 0.2) 0%, rgba(0, 0, 0, 0) 70%)',
        opacity: glowOpacity,
      }} />

      {/* 扫描线系统 */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.2) 50%)',
        backgroundSize: '100% 4px',
        zIndex: 5,
        pointerEvents: 'none',
        opacity: 0.4
      }} />
    </AbsoluteFill>
  );
};
