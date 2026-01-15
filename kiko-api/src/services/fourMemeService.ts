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
}

interface SellTokenParams {
    userId: string;
    walletAddress: string;
    tokenAddress: string;
    amount: string; // Amount in Wei (token's smallest unit)
    minFunds?: string; // Minimum quote to receive
}

/**
 * Buy Four.meme token using BNB
 * Uses TokenManager2.buyTokenAMAP(token, funds, minAmount)
 */
export async function buyTokenAMAP(params: BuyTokenParams): Promise<string> {
    const { userId, walletAddress, tokenAddress, bnbAmount, minAmount = '0', slippageBps = 300 } = params;

    // === SIMULATION MODE ===
    if (process.env.SIMULATION_MODE === 'true') {
        console.log('[FourMeme] 🧪 SIMULATION MODE: Skipping actual trade execution');
        return `0xSIMULATION_FOURMEME_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    console.log(`[FourMeme] 🔶 Buying token ${tokenAddress.slice(0, 10)}... with ${bnbAmount} BNB`);

    const chainId = 56; // BSC
    const chainConfig = getChainConfig(chainId);

    // Convert BNB amount to Wei
    const bnbInWei = ethers.parseEther(bnbAmount);

    // Encode buyTokenAMAP(token, funds, minAmount) call
    const iface = new ethers.Interface(TOKEN_MANAGER_V2_ABI);
    const callData = iface.encodeFunctionData('buyTokenAMAP(address,uint256,uint256)', [
        tokenAddress,
        bnbInWei,
        BigInt(minAmount)
    ]);

    console.log('[FourMeme] Buy transaction details:', {
        tokenManager: TOKEN_MANAGER_V2,
        token: tokenAddress.slice(0, 10) + '...',
        bnbAmount,
        bnbInWei: bnbInWei.toString(),
        minAmount
    });

    // Send transaction via Privy
    const txHash = await sendTransaction(userId, '', {
        to: TOKEN_MANAGER_V2,
        data: callData,
        value: bnbInWei.toString(),
        chainId,
    });

    console.log(`[FourMeme] Transaction sent: ${txHash}. Waiting for confirmation...`);

    // Wait for confirmation and check status
    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
    const receipt = await provider.waitForTransaction(txHash, 1);

    if (!receipt || receipt.status === 0) {
        console.error(`[FourMeme] ❌ Buy transaction REVERTED: ${txHash}`);
        throw new Error(`FourMeme buy reverted on-chain: ${txHash}`);
    }

    console.log(`[FourMeme] ✅ Buy confirmed: ${txHash}`);
    return txHash;
}

/**
 * Sell Four.meme token for BNB
 * Uses TokenManager2.sellToken(token, amount)
 * Note: Token must be approved to TokenManager2 before selling
 */
export async function sellToken(params: SellTokenParams): Promise<string> {
    const { userId, walletAddress, tokenAddress, amount, minFunds = '0' } = params;

    console.log(`[FourMeme] 🔶 Selling ${amount} of token ${tokenAddress.slice(0, 10)}...`);

    const chainId = 56; // BSC
    const chainConfig = getChainConfig(chainId);

    // Check and approve token if needed
    await checkAndApproveForFourMeme(userId, walletAddress, tokenAddress, amount, chainId);

    // Encode sellToken(token, amount) call
    const iface = new ethers.Interface(TOKEN_MANAGER_V2_ABI);
    const callData = iface.encodeFunctionData('sellToken(address,uint256)', [
        tokenAddress,
        BigInt(amount)
    ]);

    console.log('[FourMeme] Sell transaction details:', {
        tokenManager: TOKEN_MANAGER_V2,
        token: tokenAddress.slice(0, 10) + '...',
        amount
    });

    // Send transaction via Privy
    const txHash = await sendTransaction(userId, '', {
        to: TOKEN_MANAGER_V2,
        data: callData,
        value: '0',
        chainId,
    });

    console.log(`[FourMeme] Sell transaction sent: ${txHash}. Waiting for confirmation...`);

    // Wait for confirmation and check status
    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
    const receipt = await provider.waitForTransaction(txHash, 1);

    if (!receipt || receipt.status === 0) {
        console.error(`[FourMeme] ❌ Sell transaction REVERTED: ${txHash}`);
        throw new Error(`FourMeme sell reverted on-chain: ${txHash}`);
    }

    console.log(`[FourMeme] ✅ Sell confirmed: ${txHash}`);
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
    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);

    const ERC20_ABI = [
        'function allowance(address owner, address spender) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)'
    ];

    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const currentAllowance = await tokenContract.allowance(walletAddress, TOKEN_MANAGER_V2);

    const requiredAmount = BigInt(amount);
    if (currentAllowance >= requiredAmount) {
        console.log(`[FourMeme] Allowance sufficient: ${currentAllowance} >= ${requiredAmount}`);
        return;
    }

    console.log(`[FourMeme] Allowance insufficient. Approving TokenManager2...`);

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

    console.log(`[FourMeme] Approval tx sent: ${approvalTxHash}. Waiting for confirmation...`);

    // Wait for approval confirmation
    const receipt = await provider.waitForTransaction(approvalTxHash, 1, 30000);
    if (receipt?.status !== 1) {
        throw new Error(`Four.meme approval failed: ${approvalTxHash}`);
    }

    console.log(`[FourMeme] Approval confirmed.`);
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
