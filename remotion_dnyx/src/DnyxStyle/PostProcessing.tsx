import { AbsoluteFill } from 'remotion';

export const PostProcessing: React.FC = () => {
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 100 }}>
      {/* 1. 广角边缘暗角 (优化渐变梯度) */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.7) 150%)',
        opacity: 0.7,
      }} />

      {/* 2. 微光层 (Bloom) - 仅作为高光补偿，不全局虚化 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(255,255,255,0.02)',
        mixBlendMode: 'screen',
      }} />
      
      {/* 3. 极细颗粒感 (Film Grain) */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.03,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
      }} />
    </AbsoluteFill>
  );
};
