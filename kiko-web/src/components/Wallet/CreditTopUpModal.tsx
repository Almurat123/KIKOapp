import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Check, ChevronDown, ChevronUp, Loader2, X } from 'lucide-react';
import { encodeFunctionData, isAddress, keccak256, parseUnits, toBytes } from 'viem';
import { useWallets } from '@privy-io/react-auth';
import type { UsageSummary } from '../../services/billingApi';
import { creditTopUpRouterAbi } from '../../contracts/creditTopUpRouterAbi';
import styles from './CreditTopUpModal.module.css';

interface CreditTopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: UsageSummary | null;
  walletAddress?: string | null;
  holdings?: Array<{
    address?: string;
    symbol?: string;
    balance?: string;
    chainId?: number;
  }>;
  onSuccess?: () => void;
}

type TopUpStep = 'input' | 'approving' | 'depositing' | 'success';

const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;
const ERC20_APPROVE_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const TOKEN_ICON_MAP: Record<string, string> = {
  USDC: '/assets/tokens/usdc.png',
  USDT: '/assets/tokens/usdt.png',
  KIKO: '/icon.png',
};

const chainLabelFor = (chainId: number) => {
  if (chainId === 84532) return 'Base Sepolia';
  if (chainId === 8453) return 'Base';
  return `Chain ${chainId}`;
};

const explorerFor = (chainId: number, txHash: string) => {
  if (chainId === 84532) return `https://base-sepolia.blockscout.com/tx/${txHash}`;
  if (chainId === 8453) return `https://basescan.org/tx/${txHash}`;
  return null;
};

const createOrderId = (walletAddress: string, asset: string, amountRaw: bigint) => {
  const random = new Uint32Array(4);
  crypto.getRandomValues(random);
  return keccak256(toBytes(`kiko-credit-topup:${walletAddress}:${asset}:${amountRaw}:${Date.now()}:${Array.from(random).join(':')}`));
};

const readTxHash = (result: unknown) => {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object' && 'hash' in result && typeof result.hash === 'string') {
    return result.hash;
  }
  return null;
};

const trimAmount = (value: number, decimals = 6) => {
  if (!Number.isFinite(value) || value <= 0) return '';
  return value.toFixed(decimals).replace(/\.?0+$/, '');
};

export const CreditTopUpModal: React.FC<CreditTopUpModalProps> = ({
  isOpen,
  onClose,
  summary,
  walletAddress,
  holdings = [],
  onSuccess,
}) => {
  const { wallets } = useWallets();
  const [amount, setAmount] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [showAssets, setShowAssets] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [step, setStep] = useState<TopUpStep>('input');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const supportedAssets = useMemo(
    () => summary?.topUp.supportedAssets || [],
    [summary?.topUp.supportedAssets],
  );
  const selectedAsset = supportedAssets.find((asset) => asset.symbol === selectedSymbol) || supportedAssets[0] || null;
  const creditsPerUsd = summary?.credits.perUsd ?? 10;
  const minimumUsd = summary?.topUp.minimumUsd ?? 1;
  const topUpChainId = summary?.topUp.chainId ?? 8453;
  const routerAddress = summary?.topUp.routerAddress || '';
  const chainLabel = chainLabelFor(topUpChainId);
  const amountNumber = Number(amount || '0');
  const stableCreditEstimate = selectedAsset?.pricingMode === 'stable_1_to_1' && Number.isFinite(amountNumber)
    ? amountNumber * creditsPerUsd
    : null;
  const isSubmitting = step === 'approving' || step === 'depositing';
  const successExplorer = txHash ? explorerFor(topUpChainId, txHash) : null;
  const selectedHolding = selectedAsset ? holdings.find((holding) => {
    const holdingChainMatches = !holding.chainId || holding.chainId === topUpChainId;
    const holdingAddress = String(holding.address || '').toLowerCase();
    const assetAddress = String(selectedAsset.tokenAddress || '').toLowerCase();
    const addressMatches = assetAddress && holdingAddress === assetAddress;
    const symbolMatches = String(holding.symbol || '').toUpperCase() === selectedAsset.symbol.toUpperCase();
    return holdingChainMatches && (addressMatches || symbolMatches);
  }) : null;
  const selectedBalance = selectedHolding ? Number(selectedHolding.balance || '0') : 0;
  const hasSelectedBalance = Number.isFinite(selectedBalance) && selectedBalance > 0;

  const applyBalancePercent = (percent: number) => {
    if (!hasSelectedBalance) return;
    setAmount(trimAmount(selectedBalance * percent));
    setError(null);
  };

  useEffect(() => {
    if (!isOpen) return;
    setAmount('');
    setSelectedSymbol((current) => current || supportedAssets[0]?.symbol || '');
    setStep('input');
    setError(null);
    setTxHash(null);
    setShowTokenSelector(false);
  }, [isOpen, supportedAssets]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (showTokenSelector) {
      setShowTokenSelector(false);
      return;
    }
    if (!isSubmitting) onClose();
  };

  const handleAmountChange = (value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
    }
  };

  // CONTEXT MEMORY
  // Updated: 2026-04-22
  // Status: verified
  // Why: Credits top-up now uses the router contract instead of copying a treasury address.
  // Debug Goal: User selects token and amount, Privy shows ERC20 approval and router deposit confirmations, and the event watcher can credit from DepositReceived.
  // Search Tags: credit top up router deposit privy approve wallet popup
  // Invariants:
  // - Frontend must never expose or use a platform private key.
  // - Deposit beneficiary and refund address stay bound to the connected wallet.
  // Failure Modes:
  // - Missing tokenAddress/routerAddress silently falls back to copy-address flow.
  // - Wallet sends deposit on the wrong chain because chainId is not server-owned.
  const handleTopUp = async () => {
    setError(null);
    if (summary?.topUp.mode !== 'router_contract') {
      setError('Credit router is not configured yet.');
      return;
    }
    if (!routerAddress || !isAddress(routerAddress)) {
      setError('Missing router contract address.');
      return;
    }
    if (!selectedAsset?.tokenAddress || !isAddress(selectedAsset.tokenAddress)) {
      setError('This asset is missing a token contract address.');
      return;
    }
    if (!amount || !Number.isFinite(amountNumber) || amountNumber <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    if (selectedAsset.pricingMode === 'stable_1_to_1' && amountNumber < minimumUsd) {
      setError(`Minimum top up is $${minimumUsd}.`);
      return;
    }

    const evmWallet = (wallets.find((wallet: any) => {
      const walletChain = String(wallet?.chainId || '');
      const isEvm = walletChain.includes('eip155') || wallet?.walletClientType !== 'solana';
      const matchesAddress = walletAddress
        ? String(wallet?.address || '').toLowerCase() === walletAddress.toLowerCase()
        : true;
      return isEvm && matchesAddress;
    }) || wallets.find((wallet: any) => String(wallet?.chainId || '').includes('eip155'))) as any;

    if (!evmWallet?.address || typeof evmWallet.sendTransaction !== 'function') {
      setError('Connect an EVM wallet first.');
      return;
    }

    const beneficiary = walletAddress || evmWallet.address;
    if (!isAddress(beneficiary)) {
      setError('Connected wallet address is invalid.');
      return;
    }

    const amountRaw = parseUnits(amount, selectedAsset.decimals);
    const orderId = createOrderId(beneficiary, selectedAsset.symbol, amountRaw);

    try {
      if (String(evmWallet.chainId) !== `eip155:${topUpChainId}`) {
        await evmWallet.switchChain(topUpChainId);
      }

      setStep('approving');
      const approveData = encodeFunctionData({
        abi: ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [routerAddress as `0x${string}`, amountRaw],
      });
      await evmWallet.sendTransaction({
        to: selectedAsset.tokenAddress as `0x${string}`,
        data: approveData,
        value: '0',
      });

      setStep('depositing');
      const depositData = encodeFunctionData({
        abi: creditTopUpRouterAbi,
        functionName: 'deposit',
        args: [
          orderId,
          selectedAsset.tokenAddress as `0x${string}`,
          amountRaw,
          beneficiary as `0x${string}`,
          beneficiary as `0x${string}`,
          ZERO_HASH,
        ],
      });
      const depositResult = await evmWallet.sendTransaction({
        to: routerAddress as `0x${string}`,
        data: depositData,
        value: '0',
      });
      setTxHash(readTxHash(depositResult));
      setStep('success');
      onSuccess?.();
    } catch (err: any) {
      console.error('Credit top up failed', err);
      setStep('input');
      setError(err?.message || 'Top up failed');
    }
  };

  return createPortal(
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>Top Up</div>
            <h2 className={styles.title}>Top up credits</h2>
          </div>
          <button className={styles.closeButton} onClick={handleClose} aria-label="Close top up dialog" disabled={isSubmitting}>
            <X size={18} />
          </button>
        </div>

        <section className={styles.summaryBar}>
          <div className={styles.summaryItemWide}>
            <span className={styles.summaryLabel}>Rate</span>
            <span className={styles.summaryValue}>1 USD = {creditsPerUsd} credits</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Minimum</span>
            <span className={styles.summaryValue}>${minimumUsd}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Network</span>
            <span className={styles.summaryValueWithIcon}>
              <img className={styles.networkIcon} src="/assets/tokens/base.png" alt={chainLabel} />
              {chainLabel}
            </span>
          </div>
        </section>

        {step === 'success' ? (
          <section className={styles.successCard}>
            <div className={styles.successIcon}><Check size={22} /></div>
            <div className={styles.successTitle}>Payment sent</div>
            <p className={styles.successBody}>Credits will appear after the deposit event is confirmed and indexed.</p>
            {successExplorer && (
              <a className={styles.explorerLink} href={successExplorer} target="_blank" rel="noreferrer">
                View transaction
              </a>
            )}
            <button className={styles.primaryButton} onClick={handleClose}>Close</button>
          </section>
        ) : (
          <>
            <section className={styles.card}>
              <div className={styles.assetPickerHeader}>
                <div>
                  <div className={styles.cardTitle}>Amount</div>
                  <p className={styles.cardBody}>Choose a supported token and confirm with your wallet.</p>
                </div>
              </div>

              <div className={styles.amountPanel}>
                <input
                  className={styles.amountInput}
                  inputMode="decimal"
                  placeholder="0"
                  value={amount}
                  onChange={(event) => handleAmountChange(event.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className={styles.selectedTokenButton}
                  onClick={() => setShowTokenSelector(true)}
                  disabled={supportedAssets.length === 0}
                >
                  {selectedAsset ? (
                    <>
                      <img
                        className={styles.selectedTokenIcon}
                        src={TOKEN_ICON_MAP[selectedAsset.symbol] || '/icon.png'}
                        alt={selectedAsset.symbol}
                      />
                      <span className={styles.selectedTokenSymbol}>{selectedAsset.symbol}</span>
                      <span className={styles.tokenChevron} aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      <span className={styles.emptyTokenIcon} />
                      <span className={styles.selectedTokenSymbol}>Select</span>
                      <span className={styles.tokenChevron} aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>

              <div className={styles.quickAmountRow}>
                {[
                  { label: '25%', percent: 0.25 },
                  { label: '50%', percent: 0.5 },
                  { label: '100%', percent: 1 },
                  { label: 'Max', percent: 1 },
                ].map(({ label, percent }) => (
                  <button
                    key={label}
                    type="button"
                    className={styles.quickAmountButton}
                    onClick={() => applyBalancePercent(percent)}
                    disabled={!hasSelectedBalance}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className={styles.estimateRow}>
                <span>Estimated credits</span>
                <strong>
                  {stableCreditEstimate !== null
                    ? `${stableCreditEstimate.toFixed(2)} credits`
                    : 'Market price + 20% bonus'}
                </strong>
              </div>
              <div className={styles.flowHint}>
                Wallet will ask for approval first, then the deposit transaction.
              </div>
            </section>

            {error && (
              <div className={styles.errorBox}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              className={styles.primaryButtonFull}
              onClick={handleTopUp}
              disabled={isSubmitting || !selectedAsset || !amount}
            >
              {isSubmitting && <Loader2 className={styles.spinIcon} size={16} />}
              {step === 'approving' ? 'Approve in wallet' : step === 'depositing' ? 'Confirm deposit' : 'Top Up'}
            </button>

            <section className={styles.disclosureCard}>
              <button
                type="button"
                className={styles.disclosureButton}
                onClick={() => setShowAssets((value) => !value)}
                aria-expanded={showAssets}
              >
                <span>Supported assets</span>
                <span className={styles.disclosureMeta}>
                  {supportedAssets.length}
                  {showAssets ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              </button>
              {showAssets && (
                <div className={styles.disclosureContent}>
                  <div className={styles.assetList}>
                    {supportedAssets.map((asset) => (
                      <div key={asset.symbol} className={styles.assetRow}>
                        <div className={styles.assetNameGroup}>
                          <img className={styles.tokenIcon} src={TOKEN_ICON_MAP[asset.symbol] || '/icon.png'} alt={asset.symbol} />
                          <div>
                            <div className={styles.assetName}>
                              {asset.symbol} {asset.symbol === 'KIKO' ? '120%' : '100%'}
                            </div>
                            <div className={styles.assetMeta}>
                              {asset.pricingMode === 'stable_1_to_1' ? '1:1 USD crediting' : 'Market priced'} · {asset.requiredConfirmations} confirmations
                            </div>
                          </div>
                        </div>
                        <div className={styles.assetBadge}>{chainLabel}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className={styles.disclosureCard}>
              <button
                type="button"
                className={styles.disclosureButton}
                onClick={() => setShowRules((value) => !value)}
                aria-expanded={showRules}
              >
                <span>Rules</span>
                <span className={styles.disclosureMeta}>
                  {showRules ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              </button>
              {showRules && (
                <div className={styles.disclosureContent}>
                  <div className={styles.noticeList}>
                    <div className={styles.noticeItem}>USDC / USDT credit at 100%. KIKO credits at 120%.</div>
                    <div className={styles.noticeItem}>Deposits below ${minimumUsd} stay pending until the threshold is reached.</div>
                    <div className={styles.noticeItem}>Refunds are per deposit, within 24 hours, back to the same wallet.</div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
        {showTokenSelector && (
          <div
            className={styles.tokenSelectorOverlay}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setShowTokenSelector(false);
              }
            }}
          >
            <div className={styles.tokenSelectorModal} onClick={(event) => event.stopPropagation()}>
              <div className={styles.tokenSelectorHeader}>
                <div>
                  <div className={styles.eyebrow}>Asset</div>
                  <h3 className={styles.tokenSelectorTitle}>Select token</h3>
                </div>
                <button className={styles.modalCloseButton} onClick={() => setShowTokenSelector(false)} aria-label="Close token selector">
                  <X size={20} />
                </button>
              </div>
              <div className={styles.tokenList}>
                {supportedAssets.length === 0 ? (
                  <div className={styles.emptyTokenState}>No supported tokens configured.</div>
                ) : (
                  supportedAssets.map((asset) => {
                    const selected = selectedAsset?.symbol === asset.symbol;
                    return (
                      <button
                        key={asset.symbol}
                        type="button"
                        className={`${styles.tokenItem} ${selected ? styles.tokenItemSelected : ''}`}
                        onClick={() => {
                          setSelectedSymbol(asset.symbol);
                          setShowTokenSelector(false);
                        }}
                      >
                        <img
                          className={styles.tokenItemIcon}
                          src={TOKEN_ICON_MAP[asset.symbol] || '/icon.png'}
                          alt={asset.symbol}
                        />
                        <div className={styles.tokenItemInfo}>
                          <div className={styles.tokenItemSymbolRow}>
                            <span className={styles.tokenItemSymbol}>{asset.symbol}</span>
                            {asset.symbol === 'KIKO' && <span className={styles.bonusBadge}>120%</span>}
                          </div>
                          <span className={styles.tokenItemName}>
                            {asset.pricingMode === 'stable_1_to_1' ? 'Stable 1:1 crediting' : 'Market priced with bonus'}
                          </span>
                          <span className={styles.tokenItemAddress}>
                            {asset.tokenAddress ? `${asset.tokenAddress.slice(0, 6)}...${asset.tokenAddress.slice(-4)}` : 'Contract not configured'}
                          </span>
                        </div>
                        <div className={styles.tokenItemMeta}>
                          <span>{asset.requiredConfirmations} conf</span>
                          {selected && (
                            <span className={styles.selectedCheck}>
                              <Check size={13} />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default CreditTopUpModal;
