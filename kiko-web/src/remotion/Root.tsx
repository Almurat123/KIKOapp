import { Composition, registerRoot } from 'remotion';
import '../index.css'; // Add global Tailwind styles
import './remotion-overrides.css'; // Remotion-specific CSS fixes
import { MyVideo } from './MyVideo.tsx';
import { AppleTypingDemo } from './AppleTypingDemo';
import { CopyTradePhoneDemo } from './CopyTradePhoneDemo';

export const RemotionRoot = () => {
    return (
        <>
            <Composition
                id="KikoHero"
                component={MyVideo}
                durationInFrames={450}
                fps={30}
                width={1080}
                height={1920}
            />
            <Composition
                id="AppleTypingDemo"
                component={AppleTypingDemo}
                durationInFrames={180}
                fps={30}
                width={1920}
                height={1080}
            />
            <Composition
                id="CopyTradePhoneDemo"
                component={CopyTradePhoneDemo}
                durationInFrames={210}
                fps={30}
                width={1920}
                height={1080}
            />
        </>
    );
};

registerRoot(RemotionRoot);
