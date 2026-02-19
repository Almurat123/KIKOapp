import type { DexStrategy, DirectSwapHint } from './types.js';

const PANCAKE_V3_ROUTER = '0x1b81d678ffb9c0263b24a97847620c99d213eb14';
const PANCAKE_INFINITY_ROUTER = '0xd9c500dff816a1da21a48a732d3498bf09dc9aeb';

export function deriveHintStrategy(chainId: number, hint?: DirectSwapHint): DexStrategy | null {
  if (!hint) return null;
  if (hint.preferredStrategy) {
    return {
      kind: hint.preferredStrategy,
      dex: hint.preferredDex
    };
  }

  const dexName = String(hint.sourceDexName || '').toLowerCase().trim();
  const routerRaw = String(hint.sourceRouter || '').trim();
  const routerMatch = routerRaw.match(/0x[a-fA-F0-9]{40}/);
  const router = (routerMatch ? routerMatch[0] : routerRaw).toLowerCase();
  if (!dexName && !router) return null;

  if (dexName.includes('aerodrome') || dexName.includes('velodrome')) return { kind: 'aerodrome', dex: 'aerodrome' };
  if (dexName.includes('infinity')) return { kind: 'infinity', dex: 'pancake-infinity' };
  if (dexName.includes('virtual')) return { kind: 'virtual-bridge', dex: 'uniswap' };
  if (dexName.includes('zora')) return { kind: 'zora-sdk', dex: 'uniswap' };
  if (dexName.includes('v4') || dexName.includes('universal router')) return { kind: 'v4', dex: chainId === 56 ? 'pancake' : 'uniswap' };
  if (dexName.includes('v3')) return { kind: 'v3', dex: dexName.includes('pancake') || chainId === 56 ? 'pancake' : 'uniswap' };
  if (dexName.includes('v2')) return { kind: 'v2', dex: dexName.includes('pancake') || chainId === 56 ? 'pancake' : 'uniswap' };

  if (router === '0x6ff5693b99212da76ad316178a184ab56d299b43' || router === '0x498581ff718922c3f8e6a244956af099b2652b2b') return { kind: 'v4', dex: 'uniswap' };
  if (router === '0x2626664c2603336e57b271c5c0b26f421741e481') return { kind: 'v3', dex: 'uniswap' };
  if (router === '0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43' || router === '0x420dd381b31aef6683db6b902084cb0ffece40da') return { kind: 'aerodrome', dex: 'aerodrome' };
  if (router === '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24') return { kind: 'v2', dex: 'uniswap' };
  if (
    router === '0x0000000000001ff3684f28c67538d4d072c22734'
    || router === '0x6131b5fae19ea4f9d964eac0408e4408b66337b5'
    || router === '0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae'
    || router === '0x1111111254eeb25477b68fb85ed929f73a960582'
  ) {
    return { kind: 'v3', dex: chainId === 56 ? 'pancake' : 'uniswap' };
  }
  if (router === PANCAKE_V3_ROUTER) return { kind: 'v3', dex: 'pancake' };
  if (router === PANCAKE_INFINITY_ROUTER) return { kind: 'infinity', dex: 'pancake-infinity' };
  if (router === '0x10ed43c718714eb63d5aa57b78b54704e256024e') return { kind: 'v2', dex: 'pancake' };
  if (router === '0x13f4ea83d0bd40e75c8222255bc855a974568dd4' || router === '0x1b81d678ffb9c0263b24a97847620c99d213eb14') return { kind: 'v3', dex: 'pancake' };

  return null;
}

export function mergeStrategies(defaultStrategies: DexStrategy[], preferred: DexStrategy | null): DexStrategy[] {
  if (!preferred) return [...defaultStrategies];
  const seen = new Set<string>();
  const merged = [preferred, ...defaultStrategies];
  const deduped: DexStrategy[] = [];

  for (const strategy of merged) {
    const key = `${strategy.kind}:${strategy.dex || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(strategy);
  }

  return deduped;
}
