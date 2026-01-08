/**
 * Swap 集成测试页面
 * 验证 useSwap Hook 与 SwapCardIntegrated 的完整功能
 * 使用内联样式确保样式正确显示
 */

import React, { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useAccount, useChainId } from 'wagmi';
import { PageContainer } from '../components/Layout/PageContainer';
import { SwapCardIntegrated } from '../components/Swap/SwapCardIntegrated';
import { isWalletConnected, getConnectedWalletAddress } from '@/utils/walletUtils';

export const SwapTestPage: React.FC = () => {
  const { authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const { address: wagmiAddress, isConnected: wagmiIsConnected } = useAccount();
  const chainIdFromWagmi = useChainId();

  // Strict wallet connection check
  const isConnected = isWalletConnected({
    authenticated,
    ready,
    wallets,
    wagmiAddress,
    wagmiIsConnected,
  });

  const connectedWalletAddress = getConnectedWalletAddress({
    authenticated,
    ready,
    wallets,
    wagmiAddress,
    wagmiIsConnected,
  }) || '';

  const [chainId, setChainId] = useState<number>(1); // 默认使用以太坊主网
  const [solanaAggregator, setSolanaAggregator] = useState<'jupiter' | 'raydium' | 'auto'>('auto');
  const [lastSwapHash, setLastSwapHash] = useState<string>('');
  const [lastError, setLastError] = useState<string>('');
  const [windowWidth, setWindowWidth] = useState<number>(1024);

  // Update chainId when wagmi chain changes (but keep default as Ethereum)
  useEffect(() => {
    if (chainIdFromWagmi && chainIdFromWagmi !== chainId) {
      setChainId(chainIdFromWagmi);
    }
  }, [chainIdFromWagmi]);

  // Debug: Log all wallets whenever they change
  useEffect(() => {
    console.log('[SwapTestPage] ========== ALL WALLETS DEBUG ==========');
    console.log('[SwapTestPage] Total wallets:', wallets.length);
    console.log('[SwapTestPage] Authenticated:', authenticated);
    console.log('[SwapTestPage] Ready:', ready);
    wallets.forEach((wallet, index) => {
      console.log(`[SwapTestPage] Wallet ${index}:`, {
        address: wallet.address,
        chainType: (wallet as any).chainType,
        walletClientType: (wallet as any).walletClientType,
        connectorType: (wallet as any).connectorType,
      });
    });
    console.log('[SwapTestPage] ==========================================');
  }, [wallets, authenticated, ready]);

  // Debug: Log Privy user object to see if Solana wallets are there
  const { user } = usePrivy();
  useEffect(() => {
    if (user) {
      console.log('[SwapTestPage] ========== PRIVY USER OBJECT ==========');
      console.log('[SwapTestPage] User:', user);
      console.log('[SwapTestPage] User.linkedAccounts count:', user.linkedAccounts?.length);
      user.linkedAccounts?.forEach((account, index) => {
        console.log(`[SwapTestPage] LinkedAccount ${index}:`, {
          type: account.type,
          address: (account as any).address,
          chainType: (account as any).chainType,
          walletClientType: (account as any).walletClientType,
          connectorType: (account as any).connectorType,
          fullAccount: account,
        });
      });
      console.log('[SwapTestPage] User.wallet:', (user as any).wallet);
      console.log('[SwapTestPage] User.solana:', (user as any).solana);
      console.log('[SwapTestPage] ==========================================');
    }
  }, [user]);

  // Handle window resize for responsive layout
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWindowWidth(window.innerWidth);
      const handleResize = () => {
        setWindowWidth(window.innerWidth);
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const handleSwapSuccess = (txHash: string) => {
    setLastSwapHash(txHash);
    setLastError('');
  };

  const handleSwapError = (error: string) => {
    setLastError(error);
    setLastSwapHash('');
    console.error('❌ Swap failed:', error);
  };

  // 内联样式对象
  const styles = {
    page: {
      minHeight: '100vh',
      backgroundColor: '#09090b',
      color: '#ffffff',
      padding: '32px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    header: {
      marginBottom: '48px',
    },
    title: {
      fontSize: '36px',
      fontWeight: 'bold',
      marginBottom: '8px',
      color: '#ffffff',
    },
    subtitle: {
      color: 'rgba(255, 255, 255, 0.6)',
      fontSize: '14px',
    },
    configPanel: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '24px',
      marginBottom: '48px',
    },
    configItem: {
      display: 'flex',
      flexDirection: 'column' as const,
    },
    label: {
      display: 'block',
      fontSize: '14px',
      fontWeight: 500,
      color: 'rgba(255, 255, 255, 0.8)',
      marginBottom: '8px',
    },
    select: {
      width: '100%',
      backgroundColor: '#27272a',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      padding: '8px 16px',
      color: '#ffffff',
      fontSize: '14px',
      outline: 'none',
    },
    input: {
      width: '100%',
      backgroundColor: '#27272a',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      padding: '8px 16px',
      color: '#ffffff',
      fontSize: '14px',
      outline: 'none',
    },
    mainGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 3fr',
      gap: '32px',
      marginBottom: '32px',
    },
    mainGridMobile: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '32px',
      marginBottom: '32px',
    },
    cardWrapper: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
    },
    cardContainer: {
      width: '100%',
      maxWidth: '360px',
    },
    rightPanel: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '24px',
    },
    statusCard: {
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      border: '1px solid rgba(34, 197, 94, 0.3)',
      borderRadius: '8px',
      padding: '16px',
    },
    errorCard: {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '8px',
      padding: '16px',
    },
    infoCard: {
      backgroundColor: '#27272a',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      padding: '16px',
    },
    cardTitle: {
      fontWeight: 600,
      marginBottom: '16px',
      color: '#ffffff',
    },
    successTitle: {
      color: '#4ade80',
      fontWeight: 600,
      marginBottom: '8px',
    },
    errorTitle: {
      color: '#ef4444',
      fontWeight: 600,
      marginBottom: '8px',
    },
    successText: {
      color: '#86efac',
      fontSize: '14px',
      wordBreak: 'break-all' as const,
    },
    errorText: {
      color: '#fca5a5',
      fontSize: '14px',
    },
    infoList: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '12px',
      fontSize: '14px',
    },
    infoRow: {
      display: 'flex',
      justifyContent: 'space-between',
    },
    infoLabel: {
      color: 'rgba(255, 255, 255, 0.6)',
    },
    infoValue: {
      fontFamily: 'monospace',
      color: '#ffffff',
    },
    section: {
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      paddingTop: '12px',
      marginTop: '12px',
    },
    listItem: {
      color: 'rgba(255, 255, 255, 0.4)',
      fontSize: '12px',
      marginTop: '4px',
    },
    workflowCard: {
      backgroundColor: '#27272a',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      padding: '24px',
      marginTop: '32px',
    },
    workflowTitle: {
      fontSize: '20px',
      fontWeight: 600,
      marginBottom: '16px',
      color: '#ffffff',
    },
    workflowList: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '12px',
      fontSize: '14px',
      color: 'rgba(255, 255, 255, 0.8)',
    },
    workflowItem: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '4px',
    },
    workflowStep: {
      fontWeight: 600,
      color: '#ffffff',
    },
    workflowDesc: {
      color: 'rgba(255, 255, 255, 0.6)',
    },
    debugCard: {
      marginTop: '32px',
      backgroundColor: '#27272a',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      padding: '24px',
    },
    debugList: {
      marginTop: '8px',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '4px',
      fontSize: '12px',
      color: 'rgba(255, 255, 255, 0.4)',
    },
    warningBox: {
      backgroundColor: 'rgba(234, 179, 8, 0.1)',
      border: '1px solid rgba(234, 179, 8, 0.2)',
      borderRadius: '8px',
      padding: '12px',
      color: '#fbbf24',
      fontSize: '13px',
      lineHeight: '1.5',
    },
  };

  return (
    <PageContainer>
      <div style={styles.page}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>Swap Integration Test</h1>
          <p style={styles.subtitle}>Test useSwap Hook with real 0x aggregator and DexScreener data</p>
        </div>

        {/* Configuration Panel */}
        <div style={styles.configPanel}>
          {/* Chain Selector */}
          <div style={styles.configItem}>
            <label style={styles.label}>Chain ID</label>
            <select
              value={chainId}
              onChange={(e) => setChainId(Number(e.target.value))}
              style={styles.select}
            >
              <option value={1}>Ethereum (1) ✅ Recommended</option>
              <option value={8453}>Base (8453) ⚠️ Limited liquidity</option>
              <option value={42161}>Arbitrum (42161)</option>
              <option value={56}>BSC (56)</option>
              <option value={10}>Optimism (10)</option>
              <option value={137}>Polygon (137)</option>
              <option value={900}>Solana (900) 🆕</option>
            </select>
            {chainId !== 1 && chainId !== 900 && (
              <p style={{ marginTop: '4px', fontSize: '11px', color: '#fbbf24' }}>
                ⚠️ This chain may have limited liquidity. Switch to Ethereum for best results.
              </p>
            )}
            {chainId === 900 && (
              <p style={{ marginTop: '4px', fontSize: '11px', color: '#14F195' }}>
                ✅ Solana selected - Choose aggregator below
              </p>
            )}
          </div>

          {/* Wallet Warning */}
          {chainId === 900 && connectedWalletAddress && connectedWalletAddress.startsWith('0x') && (
            <div style={{ ...styles.configItem, gridColumn: 'span 2' }}>
              <div style={styles.warningBox}>
                ⚠️ <strong>Wallet Mismatch Detected</strong><br />
                You are trying to use Solana (Chain 900) but your connected wallet appears to be an EVM wallet (starts with 0x).<br />
                Please connect a Solana wallet (e.g. Phantom) to swap on Solana.
              </div>
            </div>
          )}

          {/* Solana Aggregator Selector - Only show when Solana is selected */}
          {chainId === 900 && (
            <div style={styles.configItem}>
              <label style={styles.label}>Solana Aggregator</label>
              <select
                value={solanaAggregator}
                onChange={(e) => setSolanaAggregator(e.target.value as 'jupiter' | 'raydium' | 'auto')}
                style={styles.select}
              >
                <option value="auto">Auto (Best Price) 🔄</option>
                <option value="jupiter">Jupiter (20+ DEXs) ⚡</option>
                <option value="raydium">Raydium 🧬</option>
              </select>
              <p style={{ marginTop: '4px', fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>
                {solanaAggregator === 'auto' && 'Compares Jupiter & Raydium, selects best price'}
                {solanaAggregator === 'jupiter' && 'Jupiter aggregates 20+ DEXs including Orca, Raydium, Serum, etc.'}
                {solanaAggregator === 'raydium' && 'Raydium - Direct AMM integration'}
              </p>
            </div>
          )}

          {/* User Address - Auto from wallet */}
          <div style={{ ...styles.configItem, gridColumn: windowWidth >= 768 ? 'span 2' : 'span 1' }}>
            <label style={styles.label}>User Address {isConnected ? '(Connected ✅)' : '(Not Connected ❌)'}</label>
            <input
              type="text"
              value={connectedWalletAddress || ''}
              readOnly
              placeholder={isConnected ? "Wallet connected" : "No wallet connected"}
              style={{
                ...styles.input,
                backgroundColor: isConnected ? '#27272a' : '#1a1a1a',
                color: isConnected ? '#ffffff' : 'rgba(255, 255, 255, 0.4)',
                cursor: 'not-allowed',
              }}
            />
            {!connectedWalletAddress && (
              <p style={{ marginTop: '4px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                Please connect your wallet to use swap functionality
              </p>
            )}
          </div>
        </div>

        {/* Main Swap Card */}
        <div style={windowWidth < 1024 ? styles.mainGridMobile : styles.mainGrid}>
          {/* Swap Card - Left */}
          <div style={styles.cardWrapper}>
            <div style={styles.cardContainer}>
              <SwapCardIntegrated
                userAddress={connectedWalletAddress}
                chainId={chainId}
                onSwapSuccess={handleSwapSuccess}
                onSwapError={handleSwapError}
                solanaAggregator={chainId === 900 ? solanaAggregator : undefined}
              />
            </div>
          </div>

          {/* Right Panel - Status & Info */}
          <div style={styles.rightPanel}>
            {/* Success Status */}
            {lastSwapHash && (
              <div style={styles.statusCard}>
                <h3 style={styles.successTitle}>✅ Swap Successful</h3>
                <p style={styles.successText}>TX Hash: {lastSwapHash}</p>
              </div>
            )}

            {/* Error Status */}
            {lastError && (
              <div style={styles.errorCard}>
                <h3 style={styles.errorTitle}>❌ Swap Failed</h3>
                <p style={styles.errorText}>{lastError}</p>
              </div>
            )}

            {/* Test Information */}
            <div style={styles.infoCard}>
              <h3 style={styles.cardTitle}>Test Information</h3>
              <div style={styles.infoList}>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Chain ID:</span>
                  <span style={styles.infoValue}>{chainId}</span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>User Address:</span>
                  <span style={{ ...styles.infoValue, fontSize: '12px' }}>
                    {connectedWalletAddress
                      ? `${connectedWalletAddress.slice(0, 10)}...${connectedWalletAddress.slice(-8)}`
                      : 'Not connected'}
                  </span>
                </div>
                <div style={styles.section}>
                  <div style={styles.infoLabel}>Integration Points:</div>
                  <div style={styles.infoList}>
                    <div style={styles.listItem}>✓ useSwap Hook</div>
                    <div style={styles.listItem}>✓ dexAggregatorService (0x + DexScreener)</div>
                    <div style={styles.listItem}>✓ tokenDataService (logos + metadata)</div>
                    <div style={styles.listItem}>✓ swapService (quotes + execution)</div>
                    <div style={styles.listItem}>✓ SwapCardIntegrated (UI rendering)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* API Endpoints */}
            <div style={styles.infoCard}>
              <h3 style={styles.cardTitle}>API Endpoints Being Used</h3>
              <div style={styles.infoList}>
                <div style={styles.listItem}>
                  📍 <span style={{ color: '#ffffff' }}>POST /api/swap/quote</span> - Get aggregated quote
                </div>
                <div style={styles.listItem}>
                  📍 <span style={{ color: '#ffffff' }}>POST /api/swap/prices</span> - Get token prices
                </div>
                <div style={styles.listItem}>
                  📍 <span style={{ color: '#ffffff' }}>POST /api/swap/approval-status</span> - Check ERC-20 approval
                </div>
                <div style={styles.listItem}>
                  📍 <span style={{ color: '#ffffff' }}>GET /api/wallets/:address/balance</span> - Get balance
                </div>
                <div style={styles.listItem}>
                  📍 <span style={{ color: '#ffffff' }}>POST /api/swap/execute</span> - Execute swap
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div style={styles.workflowCard}>
          <h2 style={styles.workflowTitle}>Test Workflow</h2>
          <ol style={styles.workflowList}>
            <li style={styles.workflowItem}>
              <span style={styles.workflowStep}>1. Select Tokens</span>
              <p style={styles.workflowDesc}>Click token buttons to select input/output tokens</p>
            </li>
            <li style={styles.workflowItem}>
              <span style={styles.workflowStep}>2. Enter Amount</span>
              <p style={styles.workflowDesc}>Type amount in "You pay" field - triggers 500ms debounce</p>
            </li>
            <li style={styles.workflowItem}>
              <span style={styles.workflowStep}>3. Get Quote</span>
              <p style={styles.workflowDesc}>Hook calls getBestSwapQuote() from 0x aggregator</p>
            </li>
            <li style={styles.workflowItem}>
              <span style={styles.workflowStep}>4. Review Details</span>
              <p style={styles.workflowDesc}>Check price impact, gas cost, and DEX source</p>
            </li>
            <li style={styles.workflowItem}>
              <span style={styles.workflowStep}>5. Execute Swap</span>
              <p style={styles.workflowDesc}>Click Confirm button to execute swap</p>
            </li>
          </ol>
        </div>

        {/* Debug Console */}
        <div style={styles.debugCard}>
          <h3 style={styles.cardTitle}>Browser Console Output</h3>
          <p style={styles.subtitle}>
            Open browser DevTools (F12) to see detailed logs:
          </p>
          <ul style={styles.debugList}>
            <li>• [useSwap] Quote fetching and debouncing</li>
            <li>• [dexAggregatorService] 0x API calls</li>
            <li>• [tokenDataService] Token metadata enrichment</li>
            <li>• Swap state updates and balance checks</li>
          </ul>
        </div>
      </div>
    </PageContainer>
  );
};

export default SwapTestPage;
