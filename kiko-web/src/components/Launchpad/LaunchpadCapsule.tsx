import React, { useMemo } from 'react';
import { getLaunchpadDisplayName, LAUNCHPAD_LOGOS, normalizeLaunchpadTag } from '../../utils/launchpadLogos';
import styles from './LaunchpadCapsule.module.css';

const icon = '/icon.png';

interface LaunchpadCapsuleProps {
    address: string;
    chain: string;
    launchpad?: string; // Optional backend-provided launchpad tag
    onAskAI?: () => void;
}

export const LaunchpadCapsule: React.FC<LaunchpadCapsuleProps> = ({
    address,
    chain,
    launchpad: backendLaunchpad,
    onAskAI
}) => {
    const detectedLaunchpad = useMemo(() => {
        const normalizedBackend = normalizeLaunchpadTag(backendLaunchpad);
        return normalizedBackend;
    }, [backendLaunchpad]);

    // 2. URL Generation
    const getLaunchpadUrl = () => {
        if (!detectedLaunchpad) return '#';

        const provider = detectedLaunchpad.toLowerCase();

        // Pump.fun
        if (provider === 'pump.fun') return `https://pump.fun/${address}`;

        // Moonshot
        if (provider === 'moonshot') return `https://dexscreener.com/solana/${address}`; // Moonshot often best viewed on DexS for now

        // Bonk.fun
        if (provider === 'bonk.fun') return `https://bond.bonk.fun/${address}`;

        // Clanker
        if (provider === 'clanker') return `https://clanker.world/clanker/${address}`;

        // Virtuals
        if (provider === 'virtuals') return `https://app.virtuals.io/prototypes/${address}`;

        // Zora
        if (provider === 'zora') return `https://zora.co/coin/base:${address}`;

        // Paragraph
        if (provider === 'paragraph') return `https://paragraph.xyz`;

        // Four.meme
        if (provider === 'four.meme') return `https://four.meme/token/${address}`;
        if (provider === 'flaunch') return `https://www.flaunch.gg/`;
        if (provider === 'creatorbid') return `https://creator.bid/agents/${address}`;
        if (provider === 'flap') return `https://flap.sh/board`;
        if (provider === 'doppler') {
            const chainRoute = String(chain || '').toLowerCase() === 'base' || String(chain || '') === '8453' ? 'base' : String(chain || '').toLowerCase();
            return `https://app.doppler.lol/tokens/${chainRoute}/${address}`;
        }

        // Fallback
        return '#';
    };

    // 3. Render "Ask AI" if no launchpad detected
    if (!detectedLaunchpad) {
        return (
            <button
                className={`${styles.capsule} ${styles.askAi}`}
                onClick={(e) => {
                    e.stopPropagation();
                    onAskAI?.();
                }}
            >
                <span className={styles.name}>Ask AI</span>
            </button>
        );
    }

    // 4. Render Launchpad Capsule
    const providerKey = detectedLaunchpad.toLowerCase().replace('.', ''); // e.g. pumpfun
    const logo = LAUNCHPAD_LOGOS[detectedLaunchpad.toLowerCase()] || icon;
    const displayName = getLaunchpadDisplayName(detectedLaunchpad.toLowerCase());
    const logoClassName = `${styles.logo} ${providerKey === 'flaunch' ? styles.logoFlaunch : ''}`;

    return (
        <a
            href={getLaunchpadUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.capsule} ${styles[providerKey] || ''}`}
            onClick={(e) => e.stopPropagation()}
        >
            <img src={logo} alt={displayName} className={logoClassName} />
            <span className={styles.name}>{displayName}</span>
        </a>
    );
};
