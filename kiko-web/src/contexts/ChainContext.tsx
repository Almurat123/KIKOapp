import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useChainId, useSwitchChain } from 'wagmi';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { mainnet, base, arbitrum, bsc, optimism, polygon } from 'viem/chains';

export interface ChainInfo {
  id: number;
  name: string;
  shortName: string;
  icon?: string;
  color?: string;
}

export const SUPPORTED_CHAINS: ChainInfo[] = [
  {
    id: base.id,
    name: 'Base',
    shortName: 'Base',
    color: '#0052FF',
  },
  {
    id: mainnet.id,
    name: 'Ethereum',
    shortName: 'ETH',
    color: '#627EEA',
  },
  {
    id: bsc.id,
    name: 'BNB Smart Chain',
    shortName: 'BSC',
    color: '#F0B90B',
  },
  {
    id: arbitrum.id,
    name: 'Arbitrum One',
    shortName: 'Arbitrum',
    color: '#28A0F0',
  },
  {
    id: optimism.id,
    name: 'Optimism',
    shortName: 'OP',
    color: '#FF0420',
  },
  {
    id: polygon.id,
    name: 'Polygon',
    shortName: 'MATIC',
    color: '#8247E5',
  },
  {
    id: 900,
    name: 'Solana',
    shortName: 'SOL',
    color: '#14F195',
  },
];

interface ChainContextType {
  currentChain: ChainInfo;
  switchChain: (chainId: number) => Promise<void>;
  supportedChains: ChainInfo[];
}

const ChainContext = createContext<ChainContextType | null>(null);

export const useChain = () => {
  const context = useContext(ChainContext);
  if (!context) {
    throw new Error('useChain must be used within ChainProvider');
  }
  return context;
};

interface ChainProviderProps {
  children: ReactNode;
}

export const ChainProvider: React.FC<ChainProviderProps> = ({ children }) => {
  const chainId = useChainId();
  const { switchChain: wagmiSwitchChain } = useSwitchChain();
  const { wallets } = useWallets(); // Get all connected wallets (EVM & Solana)
  const { connectWallet, authenticated, user } = usePrivy();

  // Load initial chain from localStorage or default to first supported chain
  const [currentChain, setCurrentChain] = useState<ChainInfo>(() => {
    try {
      const savedChainId = localStorage.getItem('kiko_active_chain_id');
      if (savedChainId) {
        const id = parseInt(savedChainId, 10);
        const chain = SUPPORTED_CHAINS.find(c => c.id === id);
        if (chain) return chain;
      }
    } catch (error) {
      console.warn('Failed to load chain from localStorage:', error);
    }
    return SUPPORTED_CHAINS[0];
  });

  // Persist chain selection
  useEffect(() => {
    localStorage.setItem('kiko_active_chain_id', currentChain.id.toString());
  }, [currentChain.id]);

  // Track previous chainId to distinguishing between "mounting" and "wallet switching"
  const prevChainIdRef = React.useRef<number | undefined>(undefined);

  // Sync with Wallet: Update current chain ONLY when Wagmi chainId changes.
  useEffect(() => {
    // Store current chainId as previous for next run
    const prevChainId = prevChainIdRef.current;
    prevChainIdRef.current = chainId;

    if (prevChainId !== undefined && chainId && chainId !== prevChainId && currentChain.id !== 900) {
      const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
      if (chain && chain.id !== currentChain.id) {
        console.log('[ChainContext] Wallet network changed from', prevChainId, 'to', chainId, '- Syncing UI');
        setCurrentChain(chain);
      }
    }
  }, [chainId, currentChain.id]);

  const handleSwitchChain = async (targetChainId: number) => {
    try {
      // 1. Solana Switch Logic
      if (targetChainId === 900) {
        // If not authenticated, prompt connect
        if (!authenticated) {
          connectWallet();
          return;
        }

        // If authenticated, we allow switching to Solana view
        const solChain = SUPPORTED_CHAINS.find(c => c.id === 900);
        if (solChain) setCurrentChain(solChain);
        console.log('[ChainContext] Switched to Solana view');
        return;
      }

      // 2. EVM Switch Logic
      const targetChain = SUPPORTED_CHAINS.find(c => c.id === targetChainId);

      if (targetChain) {
        // If not authenticated, prompt connect
        if (!authenticated) {
          connectWallet();
          return;
        }

        // ALWAYS update UI immediately - this is a "view" switch
        console.log('[ChainContext] Switching UI to', targetChain.name);
        setCurrentChain(targetChain);

        // Attempt to switch wallet network in background (best-effort, non-blocking)
        if (chainId !== targetChainId && wagmiSwitchChain) {
          try {
            wagmiSwitchChain({ chainId: targetChainId });
          } catch (error) {
            console.warn('[ChainContext] Wallet network switch failed (non-blocking):', error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to switch chain:', error);
    }
  };

  return (
    <ChainContext.Provider
      value={{
        currentChain,
        switchChain: handleSwitchChain,
        supportedChains: SUPPORTED_CHAINS,
      }}
    >
      {children}
    </ChainContext.Provider>
  );
};
