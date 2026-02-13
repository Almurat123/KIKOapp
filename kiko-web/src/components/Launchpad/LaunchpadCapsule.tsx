import React, { useMemo } from 'react';
import { getLaunchpadDisplayName, LAUNCHPAD_LOGOS } from '../../utils/launchpadLogos';
import styles from './LaunchpadCapsule.module.css';
import kikoLogo from '../../assets/images/kiko-logo.png';

interface LaunchpadCapsuleProps {
    address: string;
    chain: string;
    launchpad?: string; // Optional backend-provided launchpad tag
    websiteUrl?: string;
    creatorUrl?: string;
    creatorLabel?: string;
    onAskAI?: () => void;
}

export const LaunchpadCapsule: React.FC<LaunchpadCapsuleProps> = ({
    address,
    chain,
    launchpad: backendLaunchpad,
    websiteUrl,
    creatorUrl,
    creatorLabel,
    onAskAI
}) => {

    // 1. Determine Launchpad (Backend priority, then local fallback if needed)
    // Since backend does the heave lifting, we primarily rely on the prop.
    // NOTE: Local fallback logic can be added here if backend data latency is an issue, 
    // but per requirements, we trust the DB flow. Since the user asked for logic 
    // "based on chain matching" we can include a light version here if prop is missing.

    const normalizeLaunchpad = (value?: string | null): string | null => {
        const v = String(value || '').trim().toLowerCase();
        if (!v) return null;
        if (v === 'pumpfun') return 'pump.fun';
        if (v === 'bonkfun') return 'bonk.fun';
        if (v === 'fourmeme') return 'four.meme';
        if (v === 'dopplerfinance' || v === 'doppler finance') return 'doppler';
        return v;
    };

    const detectedLaunchpad = useMemo(() => {
        const normalizedBackend = normalizeLaunchpad(backendLaunchpad);
        if (normalizedBackend) return normalizedBackend;

        const lowerAddr = address?.toLowerCase() || '';
        const lowerChain = chain?.toLowerCase() || '';

        // Only deterministic suffix fallback; API verification happens in backend.
        if (lowerChain === 'sol' || lowerChain === 'solana') {
            if (lowerAddr.endsWith('pump')) return 'pump.fun';
            if (lowerAddr.endsWith('bonk')) return 'bonk.fun';
        }
        if (lowerChain === 'base' || lowerChain === '8453') {
            if (lowerAddr.endsWith('b07')) return 'clanker';
        }
        if (lowerChain === 'bsc' || lowerChain === 'bnb' || lowerChain === '56') {
            if (lowerAddr.endsWith('4444') || lowerAddr.endsWith('ffff')) return 'four.meme';
            if (lowerAddr.endsWith('8888') || lowerAddr.endsWith('7777')) return 'flap';
        }

        // Metadata fallback: Doppler tokens often expose doppler links before backend tag is hydrated.
        const dopplerHints = [websiteUrl, creatorUrl, creatorLabel]
            .filter(Boolean)
            .map((v) => String(v).toLowerCase())
            .join(' ');
        if (dopplerHints.includes('doppler.lol') || dopplerHints.includes('doppler')) return 'doppler';

        return null;
    }, [address, chain, backendLaunchpad, websiteUrl, creatorUrl, creatorLabel]);

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
        if (provider === 'flap') return `https://flap.sh/board`;
        if (provider === 'doppler') return `https://doppler.lol`;

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
    const logo = LAUNCHPAD_LOGOS[detectedLaunchpad.toLowerCase()] || kikoLogo;
    const displayName = getLaunchpadDisplayName(detectedLaunchpad.toLowerCase());

    return (
        <a
            href={getLaunchpadUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.capsule} ${styles[providerKey] || ''}`}
            onClick={(e) => e.stopPropagation()}
        >
            <img src={logo} alt={displayName} className={styles.logo} />
            <span className={styles.name}>{displayName}</span>
        </a>
    );
};
