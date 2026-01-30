/*
 * DeFiLlama API Service
 * Documentation: https://defillama.com/docs/api
 */

const DEFILLAMA_BASE_URL = 'https://api.llama.fi';
import * as unifiedApiService from '../config/unifiedApiService.js';

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
  mcapTvlRatio?: number;
  logoUrl?: string;
  description?: string;
  audits?: any[];
  chains: string[];
  mcap?: number;
  fdv?: number;
}

interface DeFiLlamaChain {
  name: string;
  tvl: number;
  change_1d?: number;
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
    // # [Logic]: Fetch historical chain TVL via Unified Transport
    const data = await unifiedApiService.fetchJson<Array<{ date: number; tvl: number }>>({
      url,
      method: 'GET',
      requestTimeout: 10000,
      endpointName: 'defillama-historical-chain-tvl'
    }).catch(() => []);

    if (!Array.isArray(data) || data.length < 2) {
      return 0; // Return 0 if historical data not available or format invalid
    }

    if (!Array.isArray(data) || data.length < 2) {
      return 0;
    }

    // Find data points approximately 24 hours apart
    // Data is in format: [{ date, tvl }, ...]
    const now = Date.now() / 1000; // Current timestamp in seconds
    const oneDayAgo = now - 24 * 60 * 60; // 24 hours ago

    // Find the closest data point to 24h ago
    let previousTvl: number | null = null;

    // Iterate backwards to find the first timestamp <= 24h ago
    for (let i = data.length - 1; i >= 0; i--) {
      const { date, tvl } = data[i];
      if (date <= oneDayAgo) {
        previousTvl = tvl;
        break;
      }
    }

    // If we can't find data from 24h ago, use the second-to-last data point
    if (previousTvl === null && data.length >= 2) {
      previousTvl = data[data.length - 2].tvl;
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
    // # [Logic]: Fetch all chains data via Unified Transport
    const data = await unifiedApiService.fetchJson<Array<DeFiLlamaChain>>({
      url,
      method: 'GET',
      requestTimeout: 15000,
      endpointName: 'defillama-chains'
    });

    // Create a map of DeFiLlama chains for quick lookup (lowercase key)
    const defiLlamaChainMap = new Map<string, { name: string; tvl: number; change_1d?: number }>();
    for (const chain of data) {
      if (chain.tvl && chain.tvl > 0) {
        defiLlamaChainMap.set(chain.name.toLowerCase(), {
          name: chain.name,
          tvl: chain.tvl,
          change_1d: chain.change_1d,
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

    // # [Logic]: Start with Dune chains (52 chains with metrics) and enrich with DeFiLlama TVL
    // User requirement: Only show chains that have Dune data, not all DeFiLlama chains
    console.log(`[DeFiLlama] Starting with ${duneMetrics?.size || 0} Dune chains`);

    if (duneMetrics) {
      for (const [duneKey, dMetrics] of duneMetrics.entries()) {
        // Get the proper DeFiLlama chain name using alias mapping
        const properName = getProperChainName(duneKey, defiLlamaChainMap);

        const capitalizedDuneName = duneKey.charAt(0).toUpperCase() + duneKey.slice(1);
        const displayChainName = properName || capitalizedDuneName;
        const lowerDisplayChainName = displayChainName.toLowerCase();

        // Skip if already added (avoid duplicates)
        if (addedChains.has(lowerDisplayChainName)) {
          continue;
        }

        // Try to get TVL from DeFiLlama using the proper name
        let tvl = 0;

        if (properName) {
          const defiLlamaData = defiLlamaChainMap.get(properName.toLowerCase());
          if (defiLlamaData) {
            tvl = defiLlamaData.tvl;
            console.log(`[DeFiLlama] Enriched Dune chain "${duneKey}" (Display: "${displayChainName}") -> "${properName}" with TVL: $${(tvl / 1e9).toFixed(2)}B`);
          } else {
            console.log(`[DeFiLlama] Warning: "${duneKey}" mapped to "${properName}" but no TVL data found`);
          }
        } else {
          console.log(`[DeFiLlama] No DeFiLlama mapping for "${duneKey}", TVL will be 0`);
        }

        const chainData: ChainData = {
          name: displayChainName,
          tvl,
          tvlChange24h: 0,
          volume24h: dMetrics.volume24h,
          txns24h: dMetrics.txns24h,
          activeWallets: dMetrics.activeWallets,
          gasPrice: dMetrics.gasPrice,
          contracts24h: dMetrics.contracts24h,
          contracts7d: dMetrics.contracts7d,
          poolsCount: undefined,
          tokensCount: undefined,
          logoUrl: getChainLogoUrl(displayChainName),
        };

        chains.push(chainData);
        addedChains.add(lowerDisplayChainName);
      }
    }

    console.log(`[DeFiLlama] Created ${chains.length} chains with Dune metrics`);

    // Populate TVL changes in parallel with a concurrency limit
    const BATCH_SIZE = 10;
    for (let i = 0; i < chains.length; i += BATCH_SIZE) {
      const batch = chains.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (chain) => {
        if (chain.tvl > 0) {
          chain.tvlChange24h = await getChainTvlChange(chain.name, chain.tvl);
        }
      }));
    }

    // # [Logic]: Final sort by TVL descending as requested by user
    // # [Ref]: Implementation Plan - Goal 1
    chains.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));

    return chains;

    return chains;
  } catch (error) {
    console.error('Error fetching DeFiLlama chains data:', error);
    throw error;
  }
}

/**
 * Get the proper display name for a chain
 * Tries to match with DeFiLlama name first, otherwise returns null if no match found
 * @returns The proper chain name from DeFiLlama, or null if not found
 */
function getProperChainName(
  chainKey: string,
  defiLlamaChainMap: Map<string, { name: string; tvl: number }>
): string | null {
  // Alias mapping for common mismatches (lowercase input -> lowercase key in map)
  const CHAIN_NAME_ALIASES: Record<string, string> = {
    // BNB Chain variants
    'bnb': 'bsc',
    'binance': 'bsc',
    'bnb smart chain': 'bsc',
    'binance smart chain': 'bsc',
    'op_bnb': 'opbnb',

    // Common underscored variants
    'arbitrum_one': 'arbitrum',
    'polygon_pos': 'polygon',

    // Avalanche variants
    'avalanche_c': 'avalanche',
    'avalanche c': 'avalanche',

    // Optimism variants
    'optimism': 'op mainnet',

    // zkSync variants
    'zksync': 'zksync era',
    'zksync_era': 'zksync era',

    // Arbitrum Nova
    'nova': 'arbitrum nova',

    // Polygon zkEVM
    'zkevm': 'polygon zkevm',
    'polygon_zkevm': 'polygon zkevm',

    // World Chain
    'worldchain': 'world chain',

    // Hyperliquid
    'hyperevm': 'hyperliquid l1',

    // Plume
    'plume': 'plume mainnet',

    // Other chains
    'gnosis_chain': 'gnosis',
    'base_mainnet': 'base'
  };

  const chainKeyLower = chainKey.toLowerCase();

  // Check direct match in DeFiLlama map
  let defiLlamaData = defiLlamaChainMap.get(chainKeyLower);
  if (defiLlamaData) {
    return defiLlamaData.name;
  }

  // Check alias mapping
  const aliasKey = CHAIN_NAME_ALIASES[chainKeyLower];
  if (aliasKey) {
    // Try the alias as-is (already lowercase)
    defiLlamaData = defiLlamaChainMap.get(aliasKey.toLowerCase());
    if (defiLlamaData) {
      return defiLlamaData.name;
    }

    // Some aliases point to proper names like "OP Mainnet" which need special handling
    // Try to find by iterating through all chains (slow but thorough)
    for (const [key, value] of defiLlamaChainMap.entries()) {
      if (key === aliasKey.toLowerCase() || value.name.toLowerCase() === aliasKey.toLowerCase()) {
        return value.name;
      }
    }
  }

  // If still not found, return null to indicate this chain doesn't exist in DeFiLlama
  // This prevents creating chains with TVL=0 that should actually be filtered out
  return null;
}

/**
 * Get the proper display name for a chain (with fallback)
 */
function getProperChainNameWithFallback(
  chainKey: string,
  defiLlamaChainMap: Map<string, { name: string; tvl: number }>
): string {
  const matched = getProperChainName(chainKey, defiLlamaChainMap);

  if (matched) {
    return matched;
  }

  // Otherwise capitalize the chain name properly as fallback
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
    // # [Logic]: Fetch protocols data via Unified Transport
    const data = await unifiedApiService.fetchJson<Array<{
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
    }>>({
      url,
      method: 'GET',
      requestTimeout: 15000,
      endpointName: 'defillama-protocols'
    });

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
 * Get total Open Interest from DeFiLlama derivatives API
 * This is a free alternative to Binance API which may be blocked in some regions
 * Reference: https://defillama.com/docs/api
 */
export async function getDerivativesOpenInterest(): Promise<number | undefined> {
  try {
    const url = `${DEFILLAMA_BASE_URL}/overview/derivatives`;
    // # [Logic]: Fetch derivatives OI via Unified Transport
    const data = await unifiedApiService.fetchJson<{
      total24h?: number;
      totalDataChart?: Array<[number, number]>;
    }>({
      url,
      method: 'GET',
      requestTimeout: 10000,
      endpointName: 'defillama-derivatives'
    }).catch(e => {
      console.warn(`DeFiLlama derivatives API error: ${e.message}`);
      return {};
    });

    // total24h represents total Open Interest across all derivatives protocols
    const dataAny = data as any;
    if (dataAny.total24h && dataAny.total24h > 0) {
      console.log(`DeFiLlama Derivatives Open Interest: $${(dataAny.total24h / 1e9).toFixed(2)}B`);
      return dataAny.total24h;
    }

    return undefined;
  } catch (error) {
    console.error('Error fetching Open Interest from DeFiLlama:', error);
    return undefined;
  }
}



/**
 * Get total circulating market cap for all stablecoins
 * Reference: https://defillama.com/docs/api
 */
export async function getStablecoinsCirculating(): Promise<number> {
  try {
    const url = `${DEFILLAMA_BASE_URL}/stablecoins/circulating`;
    // # [Logic]: Fetch stablecoins market cap via Unified Transport
    // # [Ref]: Official DeFiLlama Stablecoins API
    const data = await unifiedApiService.fetchJson<number>({
      url,
      method: 'GET',
      requestTimeout: 10000,
      endpointName: 'defillama-stablecoins-circulating'
    });

    return data || 0;
  } catch (error) {
    console.error('Error fetching stablecoins circulating cap:', error);
    return 0;
  }
}
