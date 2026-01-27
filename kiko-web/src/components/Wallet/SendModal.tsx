import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { isAddress, parseUnits, encodeFunctionData } from 'viem';
import { useWallets } from '@privy-io/react-auth';
import {
    Connection,
    PublicKey,
    Transaction,
    SystemProgram,
    LAMPORTS_PER_SOL
} from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    createTransferInstruction,
    getAssociatedTokenAddress
} from '@solana/spl-token';
import styles from './SendModal.module.css';

const LOGO_MAP: Record<string, string> = {
    'ETH': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    'WETH': 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
    'USDC': 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
    'USDT': 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
    'DAI': 'https://assets.coingecko.com/coins/images/9956/small/4943.png',
    'SOL': 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
    'OP': 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',
    'ARB': 'https://assets.coingecko.com/coins/images/16547/small/arbitrum.png',
    'MATIC': 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
    'BASE': 'https://assets.coingecko.com/coins/images/31199/small/base.png',
    'USDbC': 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png' // Base USDC
};

interface SendModalProps {
    isOpen: boolean;
    onClose: () => void;
    walletAddress?: string; // Senders address (optional context)
    chainId?: number;
    tokenAddress?: string; // If pre-selected
    tokenSymbol?: string;
    tokenDecimals?: number;
    tokenBalance?: string;
    tokenLogo?: string;
    isNative?: boolean;
    isSolana?: boolean;
    holdings?: any[]; // Pass available tokens
    onSelectToken?: (token: any) => void;
    onSuccess?: () => void;
}

export const SendModal: React.FC<SendModalProps> = ({
    isOpen,
    onClose,
    chainId = 1,
    tokenAddress,
    tokenSymbol = 'ETH',
    tokenDecimals = 18,
    tokenBalance = '0.00',
    tokenLogo,
    isNative = false,
    isSolana = false,
    holdings = [],
    onSelectToken,
    onSuccess
}) => {
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);

    const { wallets } = useWallets();
    const [step, setStep] = useState<'input' | 'confirm' | 'processing' | 'success'>('input');
    const [isSelectingToken, setIsSelectingToken] = useState(false);

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setRecipient('');
            setAmount('');
            setError(null);
            setStep('input');
            setTxHash(null);
            setIsSelectingToken(false);
        }
    }, [isOpen]);

    // Handle body scroll lock and ESC key
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';

            const handleEscape = (e: KeyboardEvent) => {
                if (e.key === 'Escape' && step !== 'processing') {
                    onClose();
                }
            };

            document.addEventListener('keydown', handleEscape);
            return () => {
                document.body.style.overflow = '';
                document.removeEventListener('keydown', handleEscape);
            };
        }
    }, [isOpen, onClose, step]);

    if (!isOpen) return null;

    // Get explorer URL based on chainId
    const getExplorerUrl = (hash: string) => {
        if (isSolana) return `https://solscan.io/tx/${hash}`;
        // Map chainId to corresponding scanner
        const scanners: Record<number, string> = {
            1: 'https://etherscan.io',
            8453: 'https://basescan.org',
            42161: 'https://arbiscan.io',
            10: 'https://optimistic.etherscan.io',
            137: 'https://polygonscan.com',
            56: 'https://bscscan.com'
        };
        const baseUrl = scanners[chainId] || 'https://etherscan.io';
        return `${baseUrl}/tx/${hash}`;
    };

    const handleNext = () => {
        setError(null);

        // Validation
        if (!recipient) {
            setError('Please enter a recipient address');
            return;
        }
        if (!isSolana && !isAddress(recipient)) {
            setError('Invalid wallet address');
            return;
        }
        if (!amount || parseFloat(amount) <= 0) {
            setError('Please enter a valid amount');
            return;
        }
        if (parseFloat(amount) > parseFloat(tokenBalance)) {
            setError('Insufficient balance');
            return;
        }

        setStep('confirm');
    };

    const handleSend = async () => {
        setIsSending(true);
        setError(null);
        try {
            const wallet = wallets.find(w =>
                isSolana ? w.chainId.includes('solana') : w.chainId.includes('eip155')
            );

            if (!wallet) throw new Error('Wallet not connected');

            if (isSolana) {
                await handleSolanaSend(wallet);
            } else {
                await handleEvmSend(wallet);
            }
            setStep('success');
            onSuccess?.();
        } catch (err: any) {
            console.error('Send error:', err);
            setError(err.message || 'Failed to send transaction');
        } finally {
            setIsSending(false);
        }
    };

    const handleEvmSend = async (wallet: any) => {
        // [Logic]: wallet.sendTransaction is used directly, no need for provider/signer here.

        // Ensure correct chain
        if (wallet.chainId !== `eip155:${chainId}`) {
            await wallet.switchChain(chainId);
        }

        let hash;
        if (isNative) {
            hash = await wallet.sendTransaction({
                to: recipient,
                value: parseUnits(amount, 18).toString(),
            });
        } else {
            const data = encodeFunctionData({
                abi: [{ name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: 'success', type: 'bool' }] }],
                args: [recipient as `0x${string}`, parseUnits(amount, tokenDecimals || 18)]
            });
            hash = await wallet.sendTransaction({
                to: tokenAddress as `0x${string}`,
                data,
                value: '0'
            });
        }
        setTxHash(hash.hash || hash);
    };

    const handleSolanaSend = async (wallet: any) => {
        const connection = new Connection(import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
        const fromPubkey = new PublicKey(wallet.address);
        const toPubkey = new PublicKey(recipient);
        const transaction = new Transaction();

        if (isNative) {
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey,
                    toPubkey,
                    lamports: Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL),
                })
            );
        } else {
            const mint = new PublicKey(tokenAddress!);
            const fromAta = await getAssociatedTokenAddress(mint, fromPubkey);
            const toAta = await getAssociatedTokenAddress(mint, toPubkey);

            transaction.add(
                createTransferInstruction(
                    fromAta,
                    toAta,
                    fromPubkey,
                    BigInt(Math.floor(parseFloat(amount) * Math.pow(10, tokenDecimals || 9))),
                    [],
                    TOKEN_PROGRAM_ID
                )
            );
        }

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;

        const signedTx = await wallet.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(signature);
        setTxHash(signature);
    };

    const handleClose = () => {
        onClose();
    };

    return createPortal(
        <div className={styles.overlay} onClick={handleClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>Send {tokenSymbol}</h2>
                    <button className={styles.closeButton} onClick={handleClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.content}>
                    {step === 'input' && (
                        <>
                            <div className={styles.amountContainer}>
                                <div className={styles.amountRow}>
                                    <div className={styles.inputWrapper}>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0"
                                            value={amount}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                    setAmount(val);
                                                }
                                            }}
                                            className={styles.largeAmountInput}
                                            autoFocus
                                        />
                                    </div>
                                    <div className={styles.badgeWrapper}>
                                        <button
                                            className={styles.tokenBadge}
                                            onClick={() => holdings.length > 0 && setIsSelectingToken(true)}
                                            style={{ cursor: holdings.length > 0 ? 'pointer' : 'default' }}
                                        >
                                            {tokenLogo || LOGO_MAP[tokenSymbol] ? (
                                                <img
                                                    src={tokenLogo || LOGO_MAP[tokenSymbol]}
                                                    alt={tokenSymbol}
                                                    className={styles.tokenLogoMain}
                                                    onError={(e) => {
                                                        // Fallback to text if image fails to load
                                                        e.currentTarget.style.display = 'none';
                                                        e.currentTarget.nextElementSibling?.classList.remove(styles.hidden);
                                                    }}
                                                />
                                            ) : (
                                                <div className={styles.tokenLogoFallbackMain}>
                                                    {tokenSymbol?.charAt(0)}
                                                </div>
                                            )}
                                            {/* Hidden fallback div references kept simple for now, relying on conditional rendering above unless onError is strict */}

                                            <span className={styles.tokenSymbolText}>{tokenSymbol}</span>
                                            {holdings.length > 0 && (
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <div className={styles.balanceLabel} onClick={() => setAmount(tokenBalance)}>
                                    Available: {tokenBalance} <span className={styles.maxText}>MAX</span>
                                </div>
                            </div>

                            <div className={styles.recipientContainer}>
                                <label className={styles.recipientLabel}>To</label>
                                <input
                                    type="text"
                                    placeholder={isSolana ? "Enter Solana address" : "0x..."}
                                    value={recipient}
                                    onChange={(e) => setRecipient(e.target.value)}
                                    className={styles.recipientInput}
                                />
                            </div>

                            {error && (
                                <div className={styles.errorMessage}>
                                    <AlertCircle size={16} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <button className={styles.primaryButton} onClick={handleNext}>
                                Send
                                <ArrowRight size={18} />
                            </button>
                        </>
                    )}

                    {isSelectingToken && (
                        <div className={styles.tokenSelectorOverlay}>
                            <div className={styles.tokenSelectorHeader}>
                                <h3>Select Token</h3>
                                <button onClick={() => setIsSelectingToken(false)}><X size={20} /></button>
                            </div>
                            <div className={styles.tokenList}>
                                {holdings.map((token, idx) => (
                                    <button
                                        key={idx}
                                        className={styles.tokenItem}
                                        onClick={() => {
                                            onSelectToken?.(token);
                                            setIsSelectingToken(false);
                                            setAmount(''); // Reset amount on token change logic preference
                                        }}
                                    >
                                        <div className={styles.tokenItemLeft}>
                                            {token.logo || LOGO_MAP[token.symbol] ? (
                                                <img
                                                    src={token.logo || LOGO_MAP[token.symbol]}
                                                    alt={token.symbol}
                                                    className={styles.tokenLogoList}
                                                />
                                            ) : (
                                                <div className={styles.tokenLogoFallback}>
                                                    {token.symbol?.charAt(0)}
                                                </div>
                                            )}
                                            <div className={styles.tokenInfo}>
                                                <span className={styles.tokenSymbol}>{token.symbol}</span>
                                                {/* Optional: Add full name if available later */}
                                            </div>
                                        </div>
                                        <div className={styles.tokenItemRight}>
                                            <span className={styles.tokenBalance}>{token.balance}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 'confirm' && (
                        <div className={styles.confirmState}>
                            <div className={styles.summaryCard}>
                                <div className={styles.summaryRow}>
                                    <span>Sending</span>
                                    <span className={styles.amountValue}>{amount} {tokenSymbol}</span>
                                </div>
                                <div className={styles.summaryRow}>
                                    <span>To</span>
                                    <span className={styles.addressValue}>
                                        {recipient.slice(0, 6)}...{recipient.slice(-4)}
                                    </span>
                                </div>
                            </div>

                            <div className={styles.warningBox}>
                                This transaction cannot be undone. Please verify the address.
                            </div>

                            <div className={styles.buttonRow}>
                                <button className={styles.secondaryButton} onClick={() => setStep('input')}>
                                    Back
                                </button>
                                <button
                                    className={styles.primaryButton}
                                    onClick={handleSend}
                                    disabled={isSending}
                                >
                                    {isSending ? (
                                        <Loader2 className={styles.spin} size={18} />
                                    ) : (
                                        'Confirm & Send'
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {(step === 'processing' || step === 'success') && (
                        <div className={styles.statusState}>
                            {step === 'processing' ? (
                                <Loader2 className={styles.statusIconRaw} size={48} />
                            ) : (
                                <div className={styles.successIcon}>✓</div>
                            )}
                            <h3>
                                {step === 'processing' ? 'Transaction Submitted' : 'Sent Successfully!'}
                            </h3>
                            <p>
                                {step === 'processing'
                                    ? 'Waiting for network confirmation...'
                                    : `You successfully sent ${amount} ${tokenSymbol}`}
                            </p>

                            {txHash && (
                                <a
                                    href={getExplorerUrl(txHash)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={styles.explorerLink}
                                >
                                    View on Explorer
                                </a>
                            )}

                            {step === 'success' && (
                                <button className={styles.primaryButton} onClick={handleClose}>
                                    Done
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
