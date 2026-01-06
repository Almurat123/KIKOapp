/**
 * DeFiLlama API Service
 * Documentation: https://defillama.com/docs/api
 */

const DEFILLAMA_BASE_URL = 'https://api.llama.fi';

export interface ChainData {
  name: string;
  tvl: number;
  tvlChange24h: number;
  volume24h?: number;
  txns24h?: number;
  poolsCount?: number;
  tokensCount?: number;
  activeWallets?: number;
  gasPrice?: string;
  contracts24h?: number;
  contracts7d?: number;
  logoUrl?: string;
}

export interface ProtocolData {
  name: string;
  symbol?: string;
  category: string;
  tvl: number;
  tvlChange1d: number;
  tvlChange7d: number;
  volume24h?: number;
  chains: string[];
  mcapTvlRatio?: number;
  logoUrl?: string;
}

/**
 * Get historical TVL for a chain to calculate 24h change
 * Uses the change_1d field from the chains endpoint if available, otherwise fetches historical data
 */
async function getChainTvlChange(chainName: string, currentTvl: number): Promise<number> {
  try {
    // Try to get historical data to calculate 24h change
    // DeFiLlama uses chain name in the URL (e.g., "Ethereum", "Arbitrum")
    const url = `${DEFILLAMA_BASE_URL}/v2/historicalChainTvl/${chainName}`;
    const response = await fetch(url);

    if (!response.ok) {
      return 0; // Return 0 if historical data not available
    }

    const data = await response.json() as { tvl?: number[][] };

    if (!data.tvl || data.tvl.length < 2) {
      return 0;
    }

    // Find data points approximately 24 hours apart
    // Data is in format: [[timestamp, tvl], ...]
    const now = Date.now() / 1000; // Current timestamp in seconds
    const oneDayAgo = now - 24 * 60 * 60; // 24 hours ago

    // Find the closest data point to 24h ago
    let previousTvl: number | null = null;

    for (let i = data.tvl.length - 1; i >= 0; i--) {
      const [timestamp, tvl] = data.tvl[i];
      if (timestamp <= oneDayAgo) {
        previousTvl = tvl;
        break;
      }
    }

    // If we can't find data from 24h ago, use the second-to-last data point
    if (previousTvl === null && data.tvl.length >= 2) {
      previousTvl = data.tvl[data.tvl.length - 2][1];
    }

    if (!previousTvl || previousTvl === 0) {
      return 0;
    }

    // Calculate percentage change
    const change = ((currentTvl - previousTvl) / previousTvl) * 100;
    return change;
  } catch (error) {
    console.error(`Error fetching TVL change for ${chainName}:`, error);
    return 0;
  }
}

/**
 * Get all chains data
 * Merges DeFiLlama TVL data with Dune Analytics metrics (volume, txns, wallets, gas, contracts)
 * Includes ALL chains from Dune even if they don't have TVL data from DeFiLlama
 */
export async function getChainsData(duneMetrics?: Map<string, { volume24h?: number; txns24h?: number; activeWallets?: number; gasPrice?: string; contracts24h?: number; contracts7d?: number }>): Promise<ChainData[]> {
  try {
    // Use the correct DeFiLlama API endpoint
    const url = `${DEFILLAMA_BASE_URL}/v2/chains`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`DeFiLlama API error: ${response.statusText}`);
    }

    const data = await response.json() as Array<{
      name: string;
      tvl?: number;
      gecko_id?: string;
      tokenSymbol?: string;
      cmcId?: string | null;
      chainId?: number;
    }>;

    // Create a map of DeFiLlama chains for quick lookup (lowercase key)
    const defiLlamaChainMap = new Map<string, { name: string; tvl: number }>();
    for (const chain of data) {
      if (chain.tvl && chain.tvl > 0) {
        defiLlamaChainMap.set(chain.name.toLowerCase(), {
          name: chain.name,
          tvl: chain.tvl,
        });
      }
    }

    // Chain name to DeFiLlama icon slug mapping
    const CHAIN_ICON_SLUGS: Record<string, string> = {
      'Ethereum': 'ethereum',
      'Solana': 'solana',
      'BSC': 'binance',
      'Bitcoin': 'bitcoin',
      'Tron': 'tron',
      'Base': 'base',
      'Arbitrum': 'arbitrum',
      'Polygon': 'polygon',
      'Avalanche': 'avalanche',
      'OP Mainnet': 'optimism',
      'Aptos': 'aptos',
      'Hyperliquid L1': 'hyperliquid',
      'Linea': 'linea',
      'Mantle': 'mantle',
      'Scroll': 'scroll',
      'ZKsync Era': 'zksync%20era',
      'Berachain': 'berachain',
      'Sei': 'sei',
      'Starknet': 'starknet',
      'Near': 'near',
      'TON': 'ton',
      'Fantom': 'fantom',
      'Gnosis': 'gnosis',
      'Celo': 'celo',
      'Sonic': 'sonic',
      'Monad': 'monad',
      'Ink': 'ink',
      'Ronin': 'ronin',
      'Flow': 'flow',
      'Flare': 'flare',
      'Kaia': 'kaia',
      'opBNB': 'op_bnb',
      'Arbitrum Nova': 'arbitrum%20nova',
      'Polygon zkEVM': 'polygon%20zkevm',
      'Boba': 'boba',
      'Plasma': 'plasma',
      'Katana': 'katana',
      'Unichain': 'unichain',
      'World Chain': 'world%20chain',
      'Abstract': 'abstract',
      'Story': 'story',
      'Taiko': 'taiko',
      'Hemi': 'hemi',
      'Somnia': 'somnia',
      'Sophon': 'sophon',
      'Mezo': 'mezo',
      'Corn': 'corn',
      'Peaq': 'peaq',
      'TAC': 'tac',
      'Superseed': 'superseed',
      'Shape': 'shape',
      'Plume Mainnet': 'plume',
    };

    function getChainLogoUrl(chainName: string): string {
      const slug = CHAIN_ICON_SLUGS[chainName] || chainName.toLowerCase().replace(/ /g, '%20');
      return `https://icons.llamao.fi/icons/chains/rsz_${slug}?w=48&h=48`;
    }

    const chains: ChainData[] = [];
    const addedChains = new Set<string>();

    // First, add all chains from Dune that have metrics (if available)
    if (duneMetrics && duneMetrics.size > 0) {
      for (const [chainKey, duneData] of duneMetrics.entries()) {
        // Get the proper chain name from Dune data
        const chainName = duneData.gasPrice !== undefined || duneData.txns24h !== undefined
          ? getProperChainName(chainKey, defiLlamaChainMap)
          : null;

        if (!chainName) continue;

        const chainKeyLower = chainName.toLowerCase();
        if (addedChains.has(chainKeyLower)) continue;

        // Get TVL from DeFiLlama if available
        const defiLlamaData = defiLlamaChainMap.get(chainKeyLower);
        const tvl = defiLlamaData?.tvl || 0;

        chains.push({
          name: chainName,
          tvl,
          tvlChange24h: 0, // Skip TVL change calculation for performance
          volume24h: duneData.volume24h,
          txns24h: duneData.txns24h,
          activeWallets: duneData.activeWallets,
          gasPrice: duneData.gasPrice,
          contracts24h: duneData.contracts24h,
          contracts7d: duneData.contracts7d,
          poolsCount: undefined,
          tokensCount: undefined,
          logoUrl: getChainLogoUrl(chainName),
        });

        addedChains.add(chainKeyLower);
      }
    }

    // If no Dune data available, add top DeFiLlama chains (TVL only)
    if (chains.length === 0) {
      const sortedDefiLlamaChains = data
        .filter((chain) => (chain.tvl || 0) > 0)
        .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
        .slice(0, 50); // Top 50 chains by TVL

      for (const chain of sortedDefiLlamaChains) {
        chains.push({
          name: chain.name,
          tvl: chain.tvl || 0,
          tvlChange24h: 0,
          volume24h: undefined,
          txns24h: undefined,
          activeWallets: undefined,
          gasPrice: undefined,
          contracts24h: undefined,
          contracts7d: undefined,
          poolsCount: undefined,
          tokensCount: undefined,
          logoUrl: `https://icons.llamao.fi/icons/chains/rsz_${chain.name.toLowerCase()}?w=48&h=48`,
        });
      }
    }

    // Sort by TVL descending
    chains.sort((a, b) => b.tvl - a.tvl);

    return chains;
  } catch (error) {
    console.error('Error fetching DeFiLlama chains data:', error);
    throw error;
  }
}

/**
 * Get the proper display name for a chain
 * Tries to match with DeFiLlama name first, otherwise uses capitalized version
 */
function getProperChainName(
  chainKey: string,
  defiLlamaChainMap: Map<string, { name: string; tvl: number }>
): string {
  // Check if we have a DeFiLlama match
  const defiLlamaData = defiLlamaChainMap.get(chainKey.toLowerCase());
  if (defiLlamaData) {
    return defiLlamaData.name;
  }

  // Otherwise capitalize the chain name properly
  return chainKey.split(/[\s_-]+/).map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

/**
 * Get all protocols data
 */
export async function getProtocolsData(): Promise<ProtocolData[]> {
  try {
    const url = `${DEFILLAMA_BASE_URL}/protocols`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`DeFiLlama API error: ${response.statusText}`);
    }

    const data = await response.json() as Array<{
      name: string;
      symbol?: string;
      category?: string;
      tvl?: number;
      change_1d?: number;
      change_7d?: number;
      volume_1d?: number;
      chains?: string[];
      mcapTvlRatio?: number;
      logo?: string;
    }>;

    return data.map((protocol) => ({
      name: protocol.name,
      symbol: protocol.symbol,
      category: protocol.category || 'Other',
      tvl: protocol.tvl || 0,
      tvlChange1d: protocol.change_1d || 0,
      tvlChange7d: protocol.change_7d || 0,
      volume24h: protocol.volume_1d,
      chains: protocol.chains || [],
      mcapTvlRatio: protocol.mcapTvlRatio,
      logoUrl: protocol.logo,
    }));
  } catch (error) {
    console.error('Error fetching DeFiLlama protocols data:', error);
    throw error;
  }
}

/**
 * Get total TVL across all chains
 */
export async function getTotalTVL(): Promise<number> {
  try {
    const chains = await getChainsData();
    return chains.reduce((sum, chain) => sum + chain.tvl, 0);
  } catch (error) {
    console.error('Error calculating total TVL:', error);
    return 0;
  }
}

/**
 * Get historical TVL data for a protocol
 * DeFiLlama API: /protocol/{protocol}
 * Returns array of [timestamp, tvl] pairs
 */
export async function getProtocolHistoricalTvl(protocolName: string): Promise<Array<[number, number]>> {
  try {
    // DeFiLlama uses protocol slug (lowercase, hyphenated, special characters removed)
    // Common transformations:
    // - "AAVE V3" -> "aave-v3"
    // - "Uniswap V3" -> "uniswap-v3"
    // - "JustLend" -> "justlend"
    let protocolSlug = protocolName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Try the protocol endpoint first
    let url = `${DEFILLAMA_BASE_URL}/protocol/${protocolSlug}`;
    let response = await fetch(url);

    if (!response.ok) {
      // Try alternative: /tvl/{protocol}
      url = `${DEFILLAMA_BASE_URL}/tvl/${protocolSlug}`;
      response = await fetch(url);

      if (!response.ok) {
        // Try without version suffix (e.g., "aave-v3" -> "aave")
        const baseSlug = protocolSlug.split('-').slice(0, -1).join('-');
        if (baseSlug && baseSlug !== protocolSlug) {
          url = `${DEFILLAMA_BASE_URL}/protocol/${baseSlug}`;
          response = await fetch(url);
        }

        if (!response.ok) {
          console.warn(`Protocol ${protocolName} (slug: ${protocolSlug}) not found in DeFiLlama`);
          return [];
        }
      }
    }

    const data = await response.json() as any;

    // Handle different response formats
    if (Array.isArray(data)) {
      // Direct array format: [[timestamp, tvl], ...]
      return data as Array<[number, number]>;
    } else if (data.tvl && Array.isArray(data.tvl)) {
      // Object with tvl property: { tvl: [[timestamp, tvl], ...] }
      return data.tvl as Array<[number, number]>;
    } else if (data.chainTvls) {
      // Aggregate TVL from all chains
      const chainTvls = data.chainTvls as Record<string, number[][]>;
      const allTvls: Record<number, number> = {};

      for (const chainData of Object.values(chainTvls)) {
        if (Array.isArray(chainData)) {
          for (const [timestamp, tvl] of chainData) {
            allTvls[timestamp] = (allTvls[timestamp] || 0) + tvl;
          }
        }
      }

      return Object.entries(allTvls)
        .map(([ts, tvl]) => [Number(ts), tvl] as [number, number])
        .sort((a, b) => a[0] - b[0]);
    }

    return [];
  } catch (error) {
    console.error(`Error fetching historical TVL for ${protocolName}:`, error);
    return [];
  }
}

/**
 * Get total Open Interest from DeFiLlama derivatives API
 * This is a free alternative to Binance API which may be blocked in some regions
 * Reference: https://defillama.com/docs/api
 */
export async function getDerivativesOpenInterest(): Promise<number | undefined> {
  try {
    const url = `${DEFILLAMA_BASE_URL}/overview/derivatives`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`DeFiLlama derivatives API error: ${response.statusText}`);
      return undefined;
    }

    const data = await response.json() as {
      total24h?: number;
      totalDataChart?: Array<[number, number]>;
    };

    // total24h represents total Open Interest across all derivatives protocols
    if (data.total24h && data.total24h > 0) {
      console.log(`DeFiLlama Derivatives Open Interest: $${(data.total24h / 1e9).toFixed(2)}B`);
      return data.total24h;
    }

    return undefined;
  } catch (error) {
    console.error('Error fetching Open Interest from DeFiLlama:', error);
    return undefined;
  }
}

/**
 * Get protocol details by name
 */
export async function getProtocolDetails(protocolName: string): Promise<any | null> {
  try {
    const protocolSlug = protocolName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const url = `${DEFILLAMA_BASE_URL}/protocol/${protocolSlug}`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching protocol details for ${protocolName}:`, error);
    return null;
  }
}
