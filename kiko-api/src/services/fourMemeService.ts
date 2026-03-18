/**
 * Four.meme Service
 * Handles native swaps for Four.meme tokens on BSC
 * Uses TokenManager2 contract for buying/selling
 * 
 * TokenManager2 Address: 0x5c952063c7fc8610FFDB798152D69F0B9550762b
 */

import { ethers } from 'ethers';
import { sendTransaction } from './privyWallet.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { getPlatformFee, isValidEvmAddress, type FeeContext } from './platformFeeService.js';
import { getEthersProvider } from './rpcManager.js';

// TokenManager2 contract address on BSC
const TOKEN_MANAGER_V2 = '0x5c952063c7fc8610FFDB798152D69F0B9550762b';

// Minimal ABI for TokenManager2 (buy/sell functions only)
const TOKEN_MANAGER_V2_ABI = [
    // buyTokenAMAP(address token, uint256 funds, uint256 minAmount)
    // Buy tokens spending a specific amount of quote (BNB for address(0) quote)
    {
        "inputs": [
            { "internalType": "address", "name": "token", "type": "address" },
            { "internalType": "uint256", "name": "funds", "type": "uint256" },
            { "internalType": "uint256", "name": "minAmount", "type": "uint256" }
        ],
        "name": "buyTokenAMAP",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    // buyTokenAMAP(address token, address to, uint256 funds, uint256 minAmount)
    // Buy tokens for a specific recipient
    {
        "inputs": [
            { "internalType": "address", "name": "token", "type": "address" },
            { "internalType": "address", "name": "to", "type": "address" },
            { "internalType": "uint256", "name": "funds", "type": "uint256" },
            { "internalType": "uint256", "name": "minAmount", "type": "uint256" }
        ],
        "name": "buyTokenAMAP",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    // sellToken(address token, uint256 amount)
    // Sell tokens
    {
        "inputs": [
            { "internalType": "address", "name": "token", "type": "address" },
            { "internalType": "uint256", "name": "amount", "type": "uint256" }
        ],
        "name": "sellToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    // TokenPurchase event
    {
        "anonymous": false,
        "inputs": [
            { "indexed": false, "internalType": "address", "name": "token", "type": "address" },
            { "indexed": false, "internalType": "address", "name": "account", "type": "address" },
            { "indexed": false, "internalType": "uint256", "name": "price", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "cost", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "fee", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "offers", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "funds", "type": "uint256" }
        ],
        "name": "TokenPurchase",
        "type": "event"
    },
    // TokenSale event
    {
        "anonymous": false,
        "inputs": [
            { "indexed": false, "internalType": "address", "name": "token", "type": "address" },
            { "indexed": false, "internalType": "address", "name": "account", "type": "address" },
            { "indexed": false, "internalType": "uint256", "name": "price", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "cost", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "fee", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "offers", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "funds", "type": "uint256" }
        ],
        "name": "TokenSale",
        "type": "event"
    }
];

interface BuyTokenParams {
    userId: string;
    walletAddress: string;
    tokenAddress: string;
    bnbAmount: string; // Amount in BNB (e.g., "0.01")
    minAmount?: string; // Minimum tokens to receive (set to 0 for no protection)
    slippageBps?: number; // Slippage in basis points (e.g., 300 = 3%)
    feeContext?: FeeContext;
}

interface SellTokenParams {
    userId: string;
    walletAddress: string;
    tokenAddress: string;
    amount: string; // Amount in Wei (token's smallest unit)
    minFunds?: string; // Minimum quote to receive
    feeContext?: FeeContext;
}

async function sendFourMemeFee(params: {
    userId: string;
    chainId: number;
    feeContext?: FeeContext;
    feeToken?: string;
    feeBaseAmount: bigint;
    trace: string;
}): Promise<void> {
    const fee = getPlatformFee(params.feeContext || 'swap');
    if (fee.bps <= 0 || !isValidEvmAddress(fee.evmRecipient)) return;

    if (params.feeBaseAmount <= 0n) return;

    const feeAmount = (params.feeBaseAmount * BigInt(fee.bps)) / 10000n;
    if (feeAmount <= 0n) return;

    if (!params.feeToken) {
        const feeTxHash = await sendTransaction(params.userId, '', {
            to: fee.evmRecipient!,
            data: '0x',
            value: feeAmount.toString(),
            chainId: params.chainId,
            txPurpose: 'fee'
        });
        logger.info(LogCode.EXE_TX_CONFIRMED, `${params.trace}: native fee sent`, {
            feeTxHash,
            feeAmount: feeAmount.toString(),
            feeRecipient: fee.evmRecipient
        });
        return;
    }

    const erc20 = new ethers.Interface(['function transfer(address to, uint256 value)']);
    const feeTxHash = await sendTransaction(params.userId, '', {
        to: params.feeToken,
        data: erc20.encodeFunctionData('transfer', [fee.evmRecipient!, feeAmount]),
        value: '0',
        chainId: params.chainId,
        txPurpose: 'fee'
    });
    logger.info(LogCode.EXE_TX_CONFIRMED, `${params.trace}: token fee sent`, {
        feeTxHash,
        token: params.feeToken,
        feeAmount: feeAmount.toString(),
        feeRecipient: fee.evmRecipient
    });
}

/**
 * Buy Four.meme token using BNB
 * Uses TokenManager2.buyTokenAMAP(token, funds, minAmount)
 */
export async function buyTokenAMAP(params: BuyTokenParams): Promise<string> {
    const { userId, walletAddress, tokenAddress, bnbAmount, minAmount = '0', slippageBps = 300, feeContext } = params;

    // === SIMULATION MODE ===
    if (process.env.SIMULATION_MODE === 'true') {
        logger.info(LogCode.EXE_TX_BROADCAST, '🧪 SIMULATION MODE: Skipping actual FourMeme buy', { token: tokenAddress });
        return `0xSIMULATION_FOURMEME_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    logger.info(LogCode.EXE_TX_BROADCAST, 'Buying token on Four.meme', { token: tokenAddress, bnb: bnbAmount });

    const chainId = 56; // BSC

    // Convert BNB amount to Wei
    let bnbInWei = ethers.parseEther(bnbAmount);


    // Encode buyTokenAMAP(token, funds, minAmount) call
    const iface = new ethers.Interface(TOKEN_MANAGER_V2_ABI);
    const callData = iface.encodeFunctionData('buyTokenAMAP(address,uint256,uint256)', [
        tokenAddress,
        bnbInWei,
        BigInt(minAmount)
    ]);

    logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Buy transaction details', {
        tokenManager: TOKEN_MANAGER_V2,
        token: tokenAddress.slice(0, 10) + '...',
        bnbAmount,
        minAmount
    });

    // Send transaction via Privy
    const txHash = await sendTransaction(userId, '', {
        to: TOKEN_MANAGER_V2,
        data: callData,
        value: bnbInWei.toString(),
        chainId,
    });

    logger.debug(LogCode.EXE_TX_BROADCAST, 'Transaction sent, waiting for confirmation', { txHash });

    // Wait for confirmation and check status
    const provider = getEthersProvider(chainId, 'tx_visibility');
    const receipt = await provider.waitForTransaction(txHash, 1);

    if (!receipt || receipt.status === 0) {
        logger.error(LogCode.EXE_TX_REVERTED, 'Four.meme buy transaction REVERTED', { txHash });
        throw new Error(`FourMeme buy reverted on-chain: ${txHash}`);
    }

    try {
        await sendFourMemeFee({
            userId,
            chainId,
            feeContext,
            feeBaseAmount: bnbInWei,
            trace: 'Four.meme buy'
        });
    } catch (feeErr: any) {
        logger.warn(LogCode.SYS_ERROR, 'Four.meme buy fee transfer failed (non-fatal)', {
            error: feeErr?.message || String(feeErr),
            txHash
        });
    }

    logger.info(LogCode.EXE_TX_CONFIRMED, 'Four.meme buy confirmed', { txHash });
    return txHash;
}

/**
 * Sell Four.meme token for BNB
 * Uses TokenManager2.sellToken(token, amount)
 * Note: Token must be approved to TokenManager2 before selling
 */
export async function sellToken(params: SellTokenParams): Promise<string> {
    const { userId, walletAddress, tokenAddress, amount, minFunds = '0', feeContext } = params;

    logger.info(LogCode.EXE_TX_BROADCAST, 'Selling token on Four.meme', { token: tokenAddress, amount });

    const chainId = 56; // BSC

    const amountNet = BigInt(amount);
    let sellAmount = amountNet;

    const fee = getPlatformFee(feeContext || 'swap');
    if (fee.bps > 0 && isValidEvmAddress(fee.evmRecipient)) {
        const feeAmount = (amountNet * BigInt(fee.bps)) / 10000n;
        if (feeAmount > 0n && feeAmount < amountNet) {
            try {
                await sendFourMemeFee({
                    userId,
                    chainId,
                    feeContext,
                    feeToken: tokenAddress,
                    feeBaseAmount: amountNet,
                    trace: 'Four.meme sell'
                });
                sellAmount = amountNet - feeAmount;
            } catch (feeErr: any) {
                logger.warn(LogCode.SYS_ERROR, 'Four.meme sell fee transfer failed (non-fatal)', {
                    error: feeErr?.message || String(feeErr)
                });
            }
        }
    }

    if (sellAmount <= 0n) {
        throw new Error('Sell amount after fee is zero');
    }

    // Check and approve token if needed
    await checkAndApproveForFourMeme(userId, walletAddress, tokenAddress, sellAmount.toString(), chainId);

    // Encode sellToken(token, amount) call
    const iface = new ethers.Interface(TOKEN_MANAGER_V2_ABI);
    const callData = iface.encodeFunctionData('sellToken(address,uint256)', [
        tokenAddress,
        sellAmount
    ]);

    logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Sell transaction details', {
        tokenManager: TOKEN_MANAGER_V2,
        token: tokenAddress.slice(0, 10) + '...',
        amount
    });

    const provider = getEthersProvider(chainId, 'tx_visibility');

    // Send transaction via Privy
    const txHash = await sendTransaction(userId, '', {
        to: TOKEN_MANAGER_V2,
        data: callData,
        value: '0',
        chainId,
    });

    logger.debug(LogCode.EXE_TX_BROADCAST, 'Sell transaction sent, waiting for confirmation', { txHash });

    // Wait for confirmation and check status
    const receipt = await provider.waitForTransaction(txHash, 1);

    if (!receipt || receipt.status === 0) {
        logger.error(LogCode.EXE_TX_REVERTED, 'Four.meme sell transaction REVERTED', { txHash });
        throw new Error(`FourMeme sell reverted on-chain: ${txHash}`);
    }


    logger.info(LogCode.EXE_TX_CONFIRMED, 'Four.meme sell confirmed', { txHash });
    return txHash;
}

/**
 * Check token allowance and approve TokenManager2 if needed
 */
async function checkAndApproveForFourMeme(
    userId: string,
    walletAddress: string,
    tokenAddress: string,
    amount: string,
    chainId: number
): Promise<void> {
    const provider = getEthersProvider(chainId, 'interactive_read');

    const ERC20_ABI = [
        'function allowance(address owner, address spender) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)'
    ];

    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const currentAllowance = await tokenContract.allowance(walletAddress, TOKEN_MANAGER_V2);

    const requiredAmount = BigInt(amount);
    if (currentAllowance >= requiredAmount) {
        logger.debug(LogCode.EXE_TX_CONFIRMED, 'Allowance sufficient for Four.meme', { token: tokenAddress });
        return;
    }

    logger.info(LogCode.EXE_TX_BROADCAST, 'Allowance insufficient. Approving TokenManager2 for Four.meme...', { token: tokenAddress });

    // Approve max uint256
    const iface = new ethers.Interface(ERC20_ABI);
    const approveData = iface.encodeFunctionData('approve', [
        TOKEN_MANAGER_V2,
        ethers.MaxUint256
    ]);

    const approvalTxHash = await sendTransaction(userId, '', {
        to: tokenAddress,
        data: approveData,
        value: '0',
        chainId,
    });

    logger.debug(LogCode.EXE_TX_BROADCAST, 'Approval tx sent for Four.meme, waiting...', { txHash: approvalTxHash });

    // Wait for approval confirmation
    const receipt = await provider.waitForTransaction(approvalTxHash, 1, 30000);
    if (receipt?.status !== 1) {
        throw new Error(`Four.meme approval failed: ${approvalTxHash}`);
    }

    logger.info(LogCode.EXE_TX_CONFIRMED, 'Four.meme approval confirmed', { token: tokenAddress });
}

/**
 * Detect if a token is a Four.meme token by checking known vanity suffixes.
 * This is a quick heuristic - for definitive check use launchpadDetector
 */
export function isFourMemeToken(tokenAddress: string): boolean {
    const lower = tokenAddress.toLowerCase();
    return lower.endsWith('4444') || lower.endsWith('ffff');
}

export const fourMemeService = {
    buyTokenAMAP,
    sellToken,
    isFourMemeToken,
    TOKEN_MANAGER_V2,
};

export default fourMemeService;
