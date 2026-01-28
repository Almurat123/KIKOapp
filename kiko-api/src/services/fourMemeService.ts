/**
 * Four.meme Service
 * Handles native swaps for Four.meme tokens on BSC
 * Uses TokenManager2 contract for buying/selling
 * 
 * TokenManager2 Address: 0x5c952063c7fc8610FFDB798152D69F0B9550762b
 */

import { ethers } from 'ethers';
import { sendTransaction } from './privyWallet.js';
import { getChainConfig } from '../config/chainConfig.js';
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

/**
 * Buy Four.meme token using BNB
 * Uses TokenManager2.buyTokenAMAP(token, funds, minAmount)
 */
export async function buyTokenAMAP(params: BuyTokenParams): Promise<string> {
    const { userId, walletAddress, tokenAddress, bnbAmount, minAmount = '0', slippageBps = 300 } = params;

    // === SIMULATION MODE ===
    if (process.env.SIMULATION_MODE === 'true') {
        logger.info(LogCode.EXE_TX_BROADCAST, '🧪 SIMULATION MODE: Skipping actual FourMeme buy', { token: tokenAddress });
        return `0xSIMULATION_FOURMEME_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    logger.info(LogCode.EXE_TX_BROADCAST, 'Buying token on Four.meme', { token: tokenAddress, bnb: bnbAmount });

    const chainId = 56; // BSC

    // Convert BNB amount to Wei
    let bnbInWei = ethers.parseEther(bnbAmount);

    // Platform fee (charged in native BNB before buy)
    const fee = getPlatformFee(params.feeContext || 'swap');
    if (fee.bps > 0 && isValidEvmAddress(fee.evmRecipient) && bnbInWei > 0n) {
        const feeWei = (bnbInWei * BigInt(fee.bps)) / 10000n;
        if (feeWei > 0n && bnbInWei > feeWei) {
            await sendTransaction(userId, '', {
                to: fee.evmRecipient!,
                data: '0x',
                value: feeWei.toString(),
                chainId,
            });
            bnbInWei = bnbInWei - feeWei;
            logger.info(LogCode.EXE_TX_BROADCAST, 'Four.meme: Collected platform fee (BNB)', { bps: fee.bps, wei: feeWei.toString() });
        }
    }

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
    const provider = getEthersProvider(chainId);
    const receipt = await provider.waitForTransaction(txHash, 1);

    if (!receipt || receipt.status === 0) {
        logger.error(LogCode.EXE_TX_REVERTED, 'Four.meme buy transaction REVERTED', { txHash });
        throw new Error(`FourMeme buy reverted on-chain: ${txHash}`);
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
    const { userId, walletAddress, tokenAddress, amount, minFunds = '0' } = params;

    logger.info(LogCode.EXE_TX_BROADCAST, 'Selling token on Four.meme', { token: tokenAddress, amount });

    const chainId = 56; // BSC
    const chainConfig = getChainConfig(chainId);

    const amountNet = BigInt(amount);

    // Check and approve token if needed
    await checkAndApproveForFourMeme(userId, walletAddress, tokenAddress, amountNet.toString(), chainId);

    // Encode sellToken(token, amount) call
    const iface = new ethers.Interface(TOKEN_MANAGER_V2_ABI);
    const callData = iface.encodeFunctionData('sellToken(address,uint256)', [
        tokenAddress,
        amountNet
    ]);

    logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Sell transaction details', {
        tokenManager: TOKEN_MANAGER_V2,
        token: tokenAddress.slice(0, 10) + '...',
        amount
    });

    // Track native balance for post-sell fee
    const provider = getEthersProvider(chainId);
    const preBalance = await provider.getBalance(walletAddress);

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

    // Platform fee: charge in native after sell (based on net proceeds)
    const fee = getPlatformFee(params.feeContext || 'swap');
    if (fee.bps > 0 && isValidEvmAddress(fee.evmRecipient)) {
        const postBalance = await provider.getBalance(walletAddress);
        const gasCost = receipt.gasUsed * (receipt.gasPrice || 0n);
        const received = postBalance + gasCost - preBalance;
        if (received > 0n) {
            const feeWei = (received * BigInt(fee.bps)) / 10000n;
            if (feeWei > 0n) {
                await sendTransaction(userId, '', {
                    to: fee.evmRecipient!,
                    data: '0x',
                    value: feeWei.toString(),
                    chainId,
                });
                logger.info(LogCode.EXE_TX_BROADCAST, 'Four.meme: Collected platform fee (native sell)', { bps: fee.bps, wei: feeWei.toString() });
            }
        }
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
    const chainConfig = getChainConfig(chainId);
    const provider = getEthersProvider(chainId);

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
 * Detect if a token is a Four.meme token by checking if address ends with '4444'
 * This is a quick heuristic - for definitive check use launchpadDetector
 */
export function isFourMemeToken(tokenAddress: string): boolean {
    return tokenAddress.toLowerCase().endsWith('4444');
}

export const fourMemeService = {
    buyTokenAMAP,
    sellToken,
    isFourMemeToken,
    TOKEN_MANAGER_V2,
};

export default fourMemeService;
