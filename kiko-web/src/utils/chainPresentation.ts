export interface ChainPresentation {
  chainId?: number;
  slug: string;
  displayName: string;
  icon: string;
  color: string;
}

const CHAIN_PRESENTATIONS: Record<number, ChainPresentation> = {
  1: {
    chainId: 1,
    slug: 'eth',
    displayName: 'Ethereum',
    icon: '/assets/tokens/eth.png',
    color: '#627EEA',
  },
  56: {
    chainId: 56,
    slug: 'bsc',
    displayName: 'BSC',
    icon: '/assets/tokens/bsc.png',
    color: '#F0B90B',
  },
  137: {
    chainId: 137,
    slug: 'polygon',
    displayName: 'Polygon',
    icon: '/assets/tokens/polygon.png',
    color: '#8247E5',
  },
  8453: {
    chainId: 8453,
    slug: 'base',
    displayName: 'Base',
    icon: '/assets/tokens/base.png',
    color: '#0052FF',
  },
  900: {
    chainId: 900,
    slug: 'solana',
    displayName: 'Solana',
    icon: '/assets/tokens/sol.png',
    color: '#14F195',
  },
};

const CHAIN_SLUG_ALIASES: Record<string, number> = {
  '1': 1,
  eth: 1,
  ethereum: 1,
  mainnet: 1,
  '56': 56,
  bsc: 56,
  bnb: 56,
  binance: 56,
  smartchain: 56,
  '137': 137,
  polygon: 137,
  pol: 137,
  '8453': 8453,
  base: 8453,
  '900': 900,
  sol: 900,
  solana: 900,
};

const UNKNOWN_CHAIN_PRESENTATION: ChainPresentation = {
  slug: 'unknown',
  displayName: 'Unknown',
  icon: '/assets/tokens/eth.png',
  color: '#627EEA',
};

export function resolveChainPresentation(input?: number | string | null): ChainPresentation {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return CHAIN_PRESENTATIONS[input] || UNKNOWN_CHAIN_PRESENTATION;
  }

  const normalized = String(input || '').trim().toLowerCase();
  if (!normalized) return UNKNOWN_CHAIN_PRESENTATION;

  const chainId = CHAIN_SLUG_ALIASES[normalized];
  return chainId ? CHAIN_PRESENTATIONS[chainId] : UNKNOWN_CHAIN_PRESENTATION;
}

