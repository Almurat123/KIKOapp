import { Composition, registerRoot } from 'remotion';
import '../index.css';
import './remotion-overrides.css';
import { KikoTokenOrbitOutro } from './KikoTokenOrbitOutro';

export const RemotionRoot = () => {
    return (
        <Composition
            id="KikoTokenOrbitOutro"
            component={KikoTokenOrbitOutro}
            durationInFrames={180}
            fps={30}
            width={1920}
            height={1080}
        />
    );
};

registerRoot(RemotionRoot);
