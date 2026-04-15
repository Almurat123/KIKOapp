import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

export const Camera: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // 1. 甩镜核心时段：在 45-75 帧之间爆发动能
  const panProgress = interpolate(
    frame,
    [45, 75],
    [0, 1],
    { easing: (t) => t * t * t * (t * (t * 6 - 15) + 10), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } // Quintic Easing
  );

  // 2. 长廊慢速漂移 (0-150 全程背景)
  const driftProgress = interpolate(frame, [0, durationInFrames], [0, 1]);

  // 3. 构造三段式位移
  // 起点聚焦文字中心，中段爆发性甩向 UI，末尾保持缓慢环绕
  const txInitial = interpolate(frame, [0, 45], [0, -40]); // 聚焦期微动
  const txPan = interpolate(panProgress, [0, 1], [0, 700]); // 甩镜期爆发 700px
  const txDrift = interpolate(driftProgress, [0.5, 1], [0, 100], { extrapolateLeft: 'clamp' }); // 漂移期
  
  const tx = txInitial + txPan + txDrift;

  // 4. 暴力广角与消失点对冲 (仅在甩镜期剧烈偏移)
  const eyeX = interpolate(panProgress, [0, 1], [50, 80]); // 视点向右对冲，产生侧切形变
  const eyeY = interpolate(driftProgress, [0, 1], [45, 55]);

  // 5. Z 轴推进
  const scale = interpolate(frame, [0, durationInFrames], [0.8, 1.2]);

  // 6. 姿态展示
  const rotateY = interpolate(panProgress, [0, 1], [-10, 10]);
  const rotateX = interpolate(frame, [0, durationInFrames], [5, -5]);

  return (
    <AbsoluteFill style={{
      perspective: '1000px', // 回归电影质感视距
      perspectiveOrigin: `${eyeX}% ${eyeY}%`,
      transformStyle: 'preserve-3d',
    }}>
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        transform: `
          scale(${scale}) 
          translateX(${tx}px) 
          rotateY(${rotateY}deg) 
          rotateX(${rotateX}deg)
        `,
        transformStyle: 'preserve-3d',
      }}>
        {children}
      </div>
    </AbsoluteFill>
  );
};
