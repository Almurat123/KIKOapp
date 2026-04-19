import React, { useEffect, useRef, useState } from 'react';
import styles from './AuraBackground.module.css';

interface AuraTheme {
  deep: string;
  primary: string;
  light: string;
  medium: string;
  highlight: string;
  shadow: string;
}

interface AuraBlob {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  amp: number;
}

// CONTEXT MEMORY
// Updated: 2026-04-20
// Author: Rowan
// Reason: KiKo homepage background now has to match the MakeDream mobile AI
//         chat aura 1:1 instead of approximating it with a theme-aware web
//         effect. This owner therefore ports the MakeDream blob geometry,
//         theme-cycle timing, transition gating, highlight layers, and the
//         chat-screen dark veil directly into the web runtime.
// Goal: preserve pixel-faithful visual parity with MakeDream's AI chat aura on
//       both desktop and mobile without reintroducing a GPU canvas scene or
//       a second homepage-only background language.
// Owns: homepage aura motion constants, theme interpolation cadence, reduced-
//       motion static fallback, blob transform math, and the final dark veil
//       that matches the MakeDream chat canvas.
// Does Not Own: welcome copy, layout spacing, composer glass styling, or app-
//       wide theme policy outside this background owner.
// Design Language:
// - homepage aura must inherit MakeDream's blob count, positions, and motion
// - theme colors hold for most of a cycle and only crossfade in the terminal window
// - the rendered backdrop includes the same dark veil as the MakeDream chat screen
// - forbidden local patch patterns: light-theme alternates, noise overlays, or blob-internal gradients that diverge from MakeDream
// Document Provenance:
// - Source: /Users/almurat/MakeDream/MakeDreamEditor/Sources/MobileHomeSupport.swift (`MobileLiquidAuraBackground`)
// - Kind: repo doc
// - Retrieved: 2026-04-20
// - Applied To: porting the MakeDream AI chat aura math and layer order into the web homepage
// - Verification: verified in code
// - Source: /Users/almurat/MakeDream/MakeDreamEditor/Sources/MobileChatScreen.swift (`MobileAIChatCanvas`)
// - Kind: repo doc
// - Retrieved: 2026-04-20
// - Applied To: matching the extra `Color.black.opacity(0.2)` veil used above the aura
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-homepage-makedream-aura-parity.md
// - /Users/almurat/KiKo/kiko-web/src/components/Chat/WelcomeScreen.tsx

const THEMES: AuraTheme[] = [
  { deep: '#051429', primary: '#00B5D9', light: '#8EE0F0', medium: '#47CAE6', highlight: '#C9F0F7', shadow: '#0075B5' },
  { deep: '#031F0F', primary: '#057A42', light: '#51C66B', medium: '#2E9E61', highlight: '#8CE09E', shadow: '#035C2E' },
  { deep: '#0D0526', primary: '#592EB8', light: '#A67AF2', medium: '#7A47D1', highlight: '#D9C0FA', shadow: '#381E84' },
  { deep: '#2E0D0D', primary: '#FA7A6B', light: '#FFC6B8', medium: '#F2A694', highlight: '#FFE0D9', shadow: '#D95147' },
  { deep: '#051A40', primary: '#4794FA', light: '#ADE0FF', medium: '#7AC0F2', highlight: '#D9F2FF', shadow: '#2E6AC6' },
  { deep: '#331400', primary: '#F2A60D', light: '#FFE03D', medium: '#FAC61F', highlight: '#FFF273', shadow: '#D97303' },
  { deep: '#140A2E', primary: '#857AE0', light: '#C6ADF2', medium: '#9E8CEA', highlight: '#EAD9FA', shadow: '#6147C6' }
];

const BLOBS: AuraBlob[] = [
  { x: 0.12, y: 0.12, w: 0.62, h: 0.58, speed: 0.42, amp: 0.07 },
  { x: 0.68, y: 0.48, w: 0.5, h: 0.46, speed: 0.28, amp: 0.06 },
  { x: 0.72, y: 0.28, w: 0.46, h: 0.66, speed: 0.34, amp: 0.08 },
  { x: 0.18, y: 0.72, w: 0.58, h: 0.42, speed: 0.48, amp: 0.05 },
  { x: 0.46, y: 0.24, w: 0.3, h: 0.3, speed: 0.62, amp: 0.04 },
  { x: 0.32, y: 0.44, w: 0.72, h: 0.72, speed: 0.24, amp: 0.08 }
];

const BRAND_ACCENT = 'rgba(79, 69, 230, 0.12)';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const lerpColor = (c1: string, c2: string, t: number) => {
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
};

export const AuraBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const topGlowRef = useRef<HTMLDivElement>(null);
  const highlightGlowRef = useRef<HTMLDivElement>(null);
  const blobRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => {
      const saveData = typeof navigator !== 'undefined' && 'connection' in navigator
        ? Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)
        : false;
      setReducedMotion(mediaQuery.matches || saveData);
    };

    updateMotionPreference();
    mediaQuery.addEventListener('change', updateMotionPreference);
    return () => mediaQuery.removeEventListener('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;

    let frameId: number;
    const start = performance.now();
    const cycleDuration = 30;
    const transitionDuration = 6;
    const totalCycle = cycleDuration * THEMES.length;

    const animate = () => {
      const t = (performance.now() - start) / 1000;
      if (!containerRef.current || !topGlowRef.current || !highlightGlowRef.current) {
        frameId = requestAnimationFrame(animate);
        return;
      }

      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      const progress = t % totalCycle;
      const currentIndex = Math.floor(progress / cycleDuration);
      const nextIndex = (currentIndex + 1) % THEMES.length;
      const intraProgress = progress % cycleDuration;
      const blend = clamp((intraProgress - (cycleDuration - transitionDuration)) / transitionDuration, 0, 1);
      const smoothBlend = 3 * blend * blend - 2 * blend * blend * blend;

      const currentTheme = THEMES[currentIndex];
      const nextTheme = THEMES[nextIndex];
      const dynamicDeep = lerpColor(currentTheme.deep, nextTheme.deep, smoothBlend);
      const dynamicPrimary = lerpColor(currentTheme.primary, nextTheme.primary, smoothBlend);
      const blobColors = [
        lerpColor(currentTheme.primary, nextTheme.primary, smoothBlend),
        lerpColor(currentTheme.light, nextTheme.light, smoothBlend),
        lerpColor(currentTheme.medium, nextTheme.medium, smoothBlend),
        lerpColor(currentTheme.highlight, nextTheme.highlight, smoothBlend),
        'rgba(255, 255, 255, 0.35)',
        lerpColor(currentTheme.shadow, nextTheme.shadow, smoothBlend),
      ];

      containerRef.current.style.backgroundColor = dynamicDeep;
      topGlowRef.current.style.background = `radial-gradient(circle at 50% 0%, ${dynamicPrimary.replace('rgb', 'rgba').replace(')', ', 0.15)')} 0px, rgba(0, 0, 0, 0) ${w * 0.85}px)`;
      highlightGlowRef.current.style.background = `radial-gradient(circle at 28% 28%, rgba(255, 255, 255, 0.08) 0px, rgba(255, 255, 255, 0) ${w * 0.5}px)`;
      highlightGlowRef.current.style.opacity = String(0.8 + 0.08 * Math.sin(t * 0.45));

      BLOBS.forEach((b, i) => {
        const el = blobRefs.current[i];
        if (!el) return;

        const blobWidth = w * b.w;
        const blobHeight = h * b.h;
        const x = (b.x + Math.sin(t * b.speed + i) * b.amp) * w;
        const y = (b.y + Math.cos(t * b.speed * 1.2 + i) * b.amp) * h;
        const scale = 1 + Math.sin(t * b.speed + i) * 0.14;
        const rotation = Math.sin(t * b.speed + i * 0.6) * 120;
        const opacity = 0.16 + Math.abs(Math.sin(t * b.speed + i)) * 0.18;

        el.style.width = `${blobWidth}px`;
        el.style.height = `${blobHeight}px`;
        el.style.backgroundColor = blobColors[i];
        el.style.opacity = String(opacity);
        el.style.transform = `translate3d(${x - blobWidth / 2}px, ${y - blobHeight / 2}px, 0) scale(${scale}) rotate(${rotation}deg)`;
      });

      frameId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(frameId);
  }, [reducedMotion]);

  return (
    <div className={styles.auraContainer} ref={containerRef}>
      {reducedMotion ? (
        <>
          <div
            className={styles.staticGlow}
            style={{
              background: `radial-gradient(circle at top left, ${BRAND_ACCENT} 0px, rgba(0, 0, 0, 0) 85%)`,
            }}
          />
          <div className={styles.staticHighlight} />
        </>
      ) : (
        <>
          <div ref={topGlowRef} className={styles.topGlow} />
          <div ref={highlightGlowRef} className={styles.highlightGlow} />
        </>
      )}
      {BLOBS.map((b, i) => (
        <div
          key={i}
          ref={(el) => {
            blobRefs.current[i] = el;
          }}
          className={styles.blob}
          style={reducedMotion ? undefined : { width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
        />
      ))}
      <div className={styles.veil} />
    </div>
  );
};
