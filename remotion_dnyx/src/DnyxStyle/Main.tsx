import { AbsoluteFill, Sequence } from 'remotion';
import { MeshBackground } from './MeshBackground';
import { Card } from './Card';
import { Typography } from './Typography';
import { Camera } from './Camera';
import { PostProcessing } from './PostProcessing';

export const Main: React.FC = () => {
  return (
    <AbsoluteFill style={{ 
      backgroundColor: '#050505', 
      overflow: 'hidden',
    }}>
      <PostProcessing />

      <AbsoluteFill style={{ transformStyle: 'preserve-3d' }}>
        <Camera>
          
          {/* 1. 远景：Deep Bokeh 背景 (明度补偿) */}
          <div style={{ 
            position: 'absolute',
            transform: 'translateZ(-3000px) scale(15)', 
            transformStyle: 'preserve-3d',
            filter: 'blur(35px) brightness(0.8)', // 略微提升亮度，确保朦胧感可见
          }}>
            <MeshBackground />
          </div>

          {/* 2. 中景：引导节点 (0,0) */}
          <Sequence from={0} durationInFrames={65}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100%', 
              width: '100%',
              transform: 'translate3d(0, 0, 0)',
              transformStyle: 'preserve-3d'
            }}>
              <Typography text="smooth" />
            </div>
          </Sequence>

          {/* 3. 前景：目标 UI (900,0) */}
          <Sequence from={70}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100%', 
              width: '100%',
              transform: 'translate3d(900px, 0, 200px)', // 落位坐标精准对齐相机 900 路径
              transformStyle: 'preserve-3d'
            }}>
              <Card />
            </div>
          </Sequence>

        </Camera>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
