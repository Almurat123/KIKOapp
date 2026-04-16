import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

export const Camera: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // 1. 下沉式阻尼曲线 (Quart Out)
  const easeQuartOut = (t: number) => 1 - Math.pow(1 - t, 4);

  // 2. 物理 24mm 机位轨迹
  const cx = interpolate(frame, [15, 65, 110], [0, 0, 900], { easing: easeQuartOut, extrapolateRight: 'clamp' });
  const cz = interpolate(frame, [0, 60, durationInFrames], [0, 350, 450], { easing: easeQuartOut });
  const cy = interpolate(frame, [0, durationInFrames], [0, 100]);
  const ry = interpolate(frame, [50, 100], [0, 12], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // 3. 稳态色散计算 (RGB Ghosting)
  const prevCx = interpolate(frame - 1, [15, 65, 110], [0, 0, 900], { easing: easeQuartOut });
  const velocity = Math.abs(cx - prevCx);
  const caShift = interpolate(velocity, [0, 25], [0, 4], { extrapolateRight: 'clamp' }); // 最大 4px 偏移

  const renderWorld = (offset: number, opacity: number, colorFilter?: string) => (
    <div style={{
      position: 'absolute',
      width: '100%',
      height: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      transform: `translate3d(${-cx + offset}px, ${-cy}px, ${-cz}px) rotateY(${-ry}deg)`,
      transformStyle: 'preserve-3d',
      opacity,
      mixBlendMode: colorFilter ? 'screen' : 'normal',
      filter: colorFilter,
    }}>
      {children}
    </div>
  );

  return (
    <AbsoluteFill style={{
      perspective: '800px', // 稳健的 24mm
      transformStyle: 'preserve-3d',
    }}>
      {/* 极速期通过三层叠加模拟 Chromatic Aberration */}
      {caShift > 0.3 ? (
        <>
          {renderWorld(caShift, 1, 'none')}
          {renderWorld(-caShift, 0.4, 'none')}
        </>
      ) : (
        renderWorld(0, 1)
      )}
    </AbsoluteFill>
  );
};
