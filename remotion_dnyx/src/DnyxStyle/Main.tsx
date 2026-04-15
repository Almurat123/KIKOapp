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
          
          {/* 1. 深度背景层 (Z=-3000px) */}
          <div style={{ 
            position: 'absolute',
            transform: 'translateZ(-3000px) scale(8)', 
            transformStyle: 'preserve-3d' 
          }}>
            <MeshBackground />
          </div>

          {/* 2. 引导文字层 (Z=0px，聚焦中心) */}
          <Sequence from={0} durationInFrames={55}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100%', 
              width: '100%',
              transform: 'translateZ(0px)',
              transformStyle: 'preserve-3d'
            }}>
              <Typography text="smooth" />
            </div>
          </Sequence>

          {/* 3. 核芯 UI 层 (Z=300px，爆发位移位) */}
          <Sequence from={60}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100%', 
              width: '100%',
              transform: 'translateZ(300px)', 
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
