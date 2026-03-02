import { Config } from '@remotion/cli/config';
import path from 'path';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setCodec('h264');
Config.setCrf(18);
Config.setChromiumOpenGlRenderer('angle'); // Force WebGL GPU acceleration

Config.overrideWebpackConfig((config) => {
    return {
        ...config,
        resolve: {
            ...config.resolve,
            alias: {
                ...config.resolve?.alias,
                '@privy-io/react-auth': path.resolve(process.cwd(), 'src/remotion/mock-privy.tsx'),
                [path.resolve(process.cwd(), 'src/components/Effects/LiquidGlassEffect')]: path.resolve(process.cwd(), 'src/remotion/LiquidGlassEffect.remotion.tsx'),
                [path.resolve(process.cwd(), 'src/components/Effects/StardustBackground')]: path.resolve(process.cwd(), 'src/remotion/StardustBackground.remotion.tsx'),
                '@': path.resolve(process.cwd(), 'src'),
            },
        },
    };
});
