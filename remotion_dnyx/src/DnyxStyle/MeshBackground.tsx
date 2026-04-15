import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

export const MeshBackground: React.FC = () => {
  const frame = useCurrentFrame();

  // 模拟三个光斑的独立缓慢漂移
  const blob1X = interpolate(Math.sin(frame / 60), [-1, 1], [30, 70]);
  const blob1Y = interpolate(Math.cos(frame / 70), [-1, 1], [20, 50]);

  const blob2X = interpolate(Math.cos(frame / 80), [-1, 1], [60, 90]);
  const blob2Y = interpolate(Math.sin(frame / 90), [-1, 1], [50, 80]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0A0A0A', overflow: 'hidden' }}>
      {/* 动态 Mesh 光斑层 */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        background: `
          radial-gradient(circle at ${blob1X}% ${blob1Y}%, rgba(30, 40, 100, 0.3) 0%, transparent 60%),
          radial-gradient(circle at ${blob2X}% ${blob2Y}%, rgba(60, 30, 80, 0.25) 0%, transparent 70%),
          radial-gradient(circle at 50% 50%, rgba(40, 40, 40, 0.2) 0%, transparent 80%)
        `,
        filter: 'blur(80px)', // 二次柔化，确保光斑无硬边
      }} />

      {/* 经典的扫描线 - 深度降低以更自然 */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%)',
        backgroundSize: '100% 2px',
        zIndex: 5,
        opacity: 0.3
      }} />
    </AbsoluteFill>
  );
};
