import { Composition, registerRoot } from 'remotion';
import { MyVideo } from './MyVideo.tsx';

export const RemotionRoot = () => {
    return (
        <Composition
            id="KikoHero"
            component={MyVideo}
            durationInFrames={300}
            fps={30}
            width={1920}
            height={1080}
        />
    );
};

registerRoot(RemotionRoot);
