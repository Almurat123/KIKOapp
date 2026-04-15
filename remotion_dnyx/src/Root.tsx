import { Composition } from 'remotion';
import { Main } from './DnyxStyle/Main';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Main"
        component={Main}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
