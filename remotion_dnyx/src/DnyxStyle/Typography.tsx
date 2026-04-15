import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Typography: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: {
      damping: 15,
      stiffness: 100,
    },
  });

  // 关键修复：opacity 在第 0 帧即为 1 (或从 0.5 起跳)，解决黑屏开场漏洞
  const opacity = interpolate(progress, [0, 0.4], [1, 1]); // 强制开场可见
  const blur = interpolate(progress, [0, 1], [20, 0]);
  const y = interpolate(progress, [0, 1], [30, 0]);

  return (
    <div style={{
      fontSize: '200px',
      fontWeight: '700',
      color: 'white',
      letterSpacing: '-8px',
      filter: `blur(${blur}px)`,
      transform: `translateY(${y}px)`,
      opacity,
      textAlign: 'center',
      textShadow: '0 0 30px rgba(255, 255, 255, 0.15)'
    }}>
      {text}
    </div>
  );
};
