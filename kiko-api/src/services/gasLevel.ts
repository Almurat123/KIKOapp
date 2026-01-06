/**
 * Real-time Gas Level Service
 * Aggregates gas prices from multiple chains to determine overall network congestion
 */

import { getChainsData } from '../repositories/chainRepository.js';

export interface GasLevelData {
  averageGasLevel: number; // 0-100 scale
  status: 'Low' | 'Moderate' | 'High' | 'Very High';
  chains: Array<{
    name: string;
    gasPrice: string;
    level: number; // 0-100
  }>;
}

/**
 * Parse gas price string and convert to numeric level (0-100)
 */
function parseGasPriceToLevel(gasPrice: string | undefined, chainName: string): number {
  if (!gasPrice) return 0;

  // Extract numeric value from gas price string (e.g., "15 Gwei" -> 15)
  const match = gasPrice.match(/(\d+\.?\d*)/);
  if (!match) return 0;

  const value = parseFloat(match[1]);

  // Normalize to 0-100 scale based on chain
  // Different chains have different typical gas price ranges
  switch (chainName.toLowerCase()) {
    case 'ethereum':
      // ETH: 0-20 Gwei = Low, 20-50 = Moderate, 50-100 = High, 100+ = Very High
      if (value < 20) return (value / 20) * 30; // 0-30
      if (value < 50) return 30 + ((value - 20) / 30) * 30; // 30-60
      if (value < 100) return 60 + ((value - 50) / 50) * 30; // 60-90
      return Math.min(100, 90 + ((value - 100) / 100) * 10); // 90-100

    case 'solana':
      // Solana: Very low gas, convert from SOL to equivalent level
      // 0.00001 SOL = very low, 0.001 SOL = high
      if (value < 0.0001) return (value / 0.0001) * 30;
      if (value < 0.001) return 30 + ((value - 0.0001) / 0.0009) * 40;
      return Math.min(100, 70 + ((value - 0.001) / 0.001) * 30);

    case 'base':
    case 'arbitrum':
    case 'optimism':
      // L2s: Very low gas, 0-0.1 Gwei = Low, 0.1-0.5 = Moderate, 0.5+ = High
      if (value < 0.1) return (value / 0.1) * 40;
      if (value < 0.5) return 40 + ((value - 0.1) / 0.4) * 40;
      return Math.min(100, 80 + ((value - 0.5) / 0.5) * 20);

    default:
      // Generic normalization
      return Math.min(100, (value / 100) * 100);
  }
}

/**
 * Get real-time gas level across all chains
 */
export async function getGasLevel(manualEthGasPrice?: string): Promise<GasLevelData> {
  try {
    const chains = await getChainsData();

    // Inject manual ETH gas price if provided (calculated from real-time Etherscan API)
    if (manualEthGasPrice) {
      const ethChainIndex = chains.findIndex(c => c.name.toLowerCase() === 'ethereum');
      if (ethChainIndex >= 0) {
        chains[ethChainIndex].gasPrice = manualEthGasPrice;
      } else {
        // Add fake ETH chain if not found (shouldn't happen but good fallback)
        chains.push({
          id: 'eth-manual',
          name: 'Ethereum',
          gasPrice: manualEthGasPrice,
          tvl: 0,
          tvlChange24h: 0
        } as any);
      }
    }

    // Filter chains that have gas price data
    const chainsWithGas = chains
      .filter((chain) => chain.gasPrice)
      .map((chain) => ({
        name: chain.name,
        gasPrice: chain.gasPrice!,
        level: parseGasPriceToLevel(chain.gasPrice, chain.name),
      }));

    if (chainsWithGas.length === 0) {
      return {
        averageGasLevel: 0,
        status: 'Low',
        chains: [],
      };
    }

    // Calculate average gas level
    const averageGasLevel = chainsWithGas.reduce((sum, chain) => sum + chain.level, 0) / chainsWithGas.length;

    // Determine overall status
    let status: 'Low' | 'Moderate' | 'High' | 'Very High';
    if (averageGasLevel < 30) {
      status = 'Low';
    } else if (averageGasLevel < 60) {
      status = 'Moderate';
    } else if (averageGasLevel < 80) {
      status = 'High';
    } else {
      status = 'Very High';
    }

    return {
      averageGasLevel: Math.round(averageGasLevel * 10) / 10,
      status,
      chains: chainsWithGas,
    };
  } catch (error) {
    console.error('Error getting gas level:', error);
    return {
      averageGasLevel: 0,
      status: 'Low',
      chains: [],
    };
  }
}

