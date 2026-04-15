import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Card: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 为 UI 专门定制的入场弹性 (稍微重一点，突显分量)
  const entrance = spring({
    frame, // 移除 -60，Sequence 已经处理了时间偏移
    fps,
    config: { damping: 16, stiffness: 80, mass: 1.2 },
  });

  const scale = interpolate(entrance, [0, 1], [0.85, 1]);
  const y = interpolate(entrance, [0, 1], [150, 0]);
  const opacity = interpolate(entrance, [0, 0.5], [0, 1]);

  return (
    <div style={{
      width: '1100px',
      height: '660px',
      backgroundColor: 'rgba(20, 20, 20, 0.9)',
      backdropFilter: 'blur(40px) saturate(140%)',
      borderRadius: '24px', // 紧凑型圆角，更符合系统 UI 逻辑
      border: '1px solid rgba(255, 255, 255, 0.15)',
      transform: `scale(${scale}) translateY(${y}px)`,
      opacity,
      boxShadow: '0 30px 60px rgba(0, 0, 0, 0.7), inset 0 0 0 1px rgba(255,255,255,0.05)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* 顶部标题栏 (Window Title Bar) */}
      <div style={{
        height: '48px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        backgroundColor: 'rgba(255, 255, 255, 0.03)'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#FF5F56' }} />
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#FFBD2E' }} />
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#27C93F' }} />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '12px', fontWeight: 'bold' }}>
          <span>PROJECT_01</span>
          <span>DNYX_V4</span>
        </div>
      </div>

      {/* 主体内容区 */}
      <div style={{ flex: 1, display: 'flex', padding: '40px', gap: '40px' }}>
        {/* 左侧功能模块 (Sidebar Style) */}
        <div style={{ width: '30%', height: '100%', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }} />
        
        {/* 右侧展示区 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h2 style={{ 
            color: 'white', 
            fontSize: '64px', 
            fontWeight: '900', 
            letterSpacing: '-4px', 
            marginBottom: '10px' 
          }}>
            SYSTEM INTERFACE
          </h2>
          <div style={{ width: '100px', height: '4px', backgroundColor: '#3A3A3A', borderRadius: '2px', marginBottom: '20px' }} />
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '24px', letterSpacing: '0px', lineHeight: '1.4' }}>
            High-fidelity reconstruction focusing on <br/> narrative and structural logic.
          </p>
        </div>
      </div>
    </div>
  );
};
