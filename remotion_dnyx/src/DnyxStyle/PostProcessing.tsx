import { AbsoluteFill, random } from 'remotion';
import { useCurrentFrame } from 'remotion';

export const PostProcessing: React.FC = () => {
  const frame = useCurrentFrame();
  
  // 每一帧生成不同的种子以实现动态噪点
  const noiseSeed = random(`noise-${frame}`);
  const noiseX = (noiseSeed - 0.5) * 10;
  const noiseY = (random(`noise-y-${frame}`) - 0.5) * 10;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 100 }}>
      {/* 1. 动态噪点层 */}
      <div style={{
        position: 'absolute',
        width: '120%',
        height: '120%',
        left: '-10%',
        top: '-10%',
        backgroundImage: 'url("https://www.transparenttextures.com/patterns/stardust.png")', // 使用一个通用的噪点纹理
        opacity: 0.12,
        transform: `translate(${noiseX}px, ${noiseY}px)`,
        mixBlendMode: 'overlay',
      }} />

      {/* 2. 全局暗角 (Vignette) */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        background: 'radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.5) 100%)',
      }} />

      {/* 3. 色差滤镜 (SVG 实现) */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <filter id="chromatic-aberration">
          <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"/>
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"/>
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"/>
          <feOffset in="red" dx="1.5" dy="0" result="red-offset"/>
          <feOffset in="blue" dx="-1.5" dy="0" result="blue-offset"/>
          <feBlend in="red-offset" in2="green" mode="screen" result="temp"/>
          <feBlend in="temp" in2="blue-offset" mode="screen"/>
        </filter>
      </svg>
    </AbsoluteFill>
  );
};
