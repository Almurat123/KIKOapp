/**
 * Polymarket Token Approval Service
 * 
 * Handles USDC and CTF token approvals for the Polymarket Exchange contracts on Polygon.
 * Users must approve tokens before trading.
 */

import { ethers } from 'ethers';
import prisma from '../db/prisma.js';
import { getDelegatedEvmWallet } from './privyWallet.js';

// Contract addresses on Polygon (chainId: 137)
const POLYGON_CONTRACTS = {
    // USDC.e (Bridged USDC from Ethereum) - used by Polymarket
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',

    // Native USDC on Polygon (newer)
    USDC_NATIVE: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',

    // Polymarket CTF Exchange
    CTF_EXCHANGE: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',

    // Neg Risk CTF Exchange (for negatively correlated markets)
    NEG_RISK_CTF_EXCHANGE: '0xC5d563A36AE78145C45a50134d48A1215220f80a',

    // Conditional Tokens Framework (CTF) contract
    CTF: '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045'
};

// Standard ERC20 ABI for approval functions
const ERC20_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)'
];

// CTF approval ABI (uses setApprovalForAll for ERC1155)
const CTF_ABI = [
    'function setApprovalForAll(address operator, bool approved)',
    'function isApprovedForAll(address owner, address operator) view returns (bool)'
];

import { getEthersProvider } from './rpcManager.js';

/**
 * Get a read-only provider for Polygon
 */
function getPolygonProvider(): ethers.JsonRpcProvider {
    return getEthersProvider(137);
}

/**
 * Check if user has approved USDC for the CTF Exchange
 */
export async function checkUsdcApproval(walletAddress: string): Promise<{
    approved: boolean;
    allowance: string;
    balance: string;
}> {
    const provider = getPolygonProvider();
    const usdc = new ethers.Contract(POLYGON_CONTRACTS.USDC, ERC20_ABI, provider);

    const [allowance, balance, decimals] = await Promise.all([
        usdc.allowance(walletAddress, POLYGON_CONTRACTS.CTF_EXCHANGE),
        usdc.balanceOf(walletAddress),
        usdc.decimals()
    ]);

    const formattedAllowance = ethers.formatUnits(allowance, decimals);
    const formattedBalance = ethers.formatUnits(balance, decimals);

    const isApproved = allowance > 0n;

    return {
        approved: isApproved,
        allowance: formattedAllowance,
        balance: formattedBalance
    };
}

/**
 * Check if user has approved CTF tokens for the Exchange
 */
export async function checkCtfApproval(walletAddress: string): Promise<boolean> {
    const provider = getPolygonProvider();
    const ctf = new ethers.Contract(POLYGON_CONTRACTS.CTF, CTF_ABI, provider);

    const isApproved = await ctf.isApprovedForAll(walletAddress, POLYGON_CONTRACTS.CTF_EXCHANGE);
    return isApproved;
}

/**
 * Get the approval transaction data for USDC
 * Returns the transaction data that needs to be signed and sent
 */
export function getUsdcApprovalTx(): {
    to: string;
    data: string;
    chainId: number;
    description: string;
} {
    const iface = new ethers.Interface(ERC20_ABI);
    const maxApproval = ethers.MaxUint256; // Unlimited approval

    const data = iface.encodeFunctionData('approve', [
        POLYGON_CONTRACTS.CTF_EXCHANGE,
        maxApproval
    ]);

    return {
        to: POLYGON_CONTRACTS.USDC,
        data,
        chainId: 137,
        description: 'Approve USDC for Polymarket CTF Exchange'
    };
}

/**
 * Get the approval transaction data for CTF tokens
 */
export function getCtfApprovalTx(): {
    to: string;
    data: string;
    chainId: number;
    description: string;
} {
    const iface = new ethers.Interface(CTF_ABI);

    const data = iface.encodeFunctionData('setApprovalForAll', [
        POLYGON_CONTRACTS.CTF_EXCHANGE,
        true
    ]);

    return {
        to: POLYGON_CONTRACTS.CTF,
        data,
        chainId: 137,
        description: 'Approve CTF tokens for Polymarket Exchange'
    };
}

/**
 * Get all required approval transactions for a user
 */
export async function getRequiredApprovals(walletAddress: string): Promise<{
    needsUsdcApproval: boolean;
    needsCtfApproval: boolean;
    usdcBalance: string;
    transactions: Array<{
        type: 'usdc' | 'ctf';
        to: string;
        data: string;
        chainId: number;
        description: string;
    }>;
}> {
    const [usdcStatus, ctfApproved] = await Promise.all([
        checkUsdcApproval(walletAddress),
        checkCtfApproval(walletAddress)
    ]);

    const transactions: Array<{
        type: 'usdc' | 'ctf';
        to: string;
        data: string;
        chainId: number;
        description: string;
    }> = [];

    if (!usdcStatus.approved) {
        const tx = getUsdcApprovalTx();
        transactions.push({ type: 'usdc', ...tx });
    }

    if (!ctfApproved) {
        const tx = getCtfApprovalTx();
        transactions.push({ type: 'ctf', ...tx });
    }

    return {
        needsUsdcApproval: !usdcStatus.approved,
        needsCtfApproval: !ctfApproved,
        usdcBalance: usdcStatus.balance,
        transactions
    };
}

/**
 * Check user's Polymarket trading readiness
 */
export async function checkTradingReadiness(userId: string): Promise<{
    hasCredentials: boolean;
    hasDelegatedEvm: boolean;
    hasUsdcApproval: boolean | null;
    hasCtfApproval: boolean | null;
    usdcBalance: string;
    walletAddress: string | null;
    isReady: boolean;
    missingSteps: string[];
}> {
    // Get user's credentials
    const creds = await prisma.polymarketApiCreds.findUnique({
        where: { userId }
    });

    if (!creds) {
        const delegatedEvmWallet = await getDelegatedEvmWallet(userId);
        return {
            hasCredentials: false,
            hasDelegatedEvm: !!delegatedEvmWallet,
            hasUsdcApproval: false,
            hasCtfApproval: false,
            usdcBalance: '0',
            walletAddress: null,
            isReady: false,
            missingSteps: ['Generate Polymarket API credentials']
        };
    }

    // [Fix]: Wrap blockchain calls in try-catch so a Polygon RPC failure does not mask
    // the credential status. Previously, if the RPC was down the whole function threw,
    // the /trading/readiness endpoint returned 500, and the PolymarketAuthButton left
    // readiness=null → hasCredentials=false → the "Revoke" button never appeared.
    let delegatedEvmWallet: any = null;
    let usdcStatus: { approved: boolean; balance: string } = { approved: false, balance: '0' };
    let ctfApproved = false;
    let blockchainCallFailed = false;

    try {
        [delegatedEvmWallet, usdcStatus, ctfApproved] = await Promise.all([
            getDelegatedEvmWallet(userId),
            checkUsdcApproval(creds.walletAddress),
            checkCtfApproval(creds.walletAddress)
        ]);
    } catch (rpcErr: any) {
        console.warn('[PolymarketApproval] Polygon RPC call failed, returning credential status only:', rpcErr.message);
        blockchainCallFailed = true;
        // Try fetching just the delegation status (no on-chain call)
        try { delegatedEvmWallet = await getDelegatedEvmWallet(userId); } catch { /* ignore */ }
    }

    const missingSteps: string[] = [];

    if (!delegatedEvmWallet) {
        missingSteps.push('Enable EVM server-side signing delegation in Settings');
    }

    if (!blockchainCallFailed) {
        if (!usdcStatus.approved) {
            missingSteps.push('Approve USDC for Polymarket');
        }
        if (!ctfApproved) {
            missingSteps.push('Approve CTF tokens for Polymarket');
        }
        if (parseFloat(usdcStatus.balance) < 1) {
            missingSteps.push('Deposit USDC to your wallet on Polygon');
        }
    }

    return {
        hasCredentials: true,
        hasDelegatedEvm: !!delegatedEvmWallet,
        hasUsdcApproval: blockchainCallFailed ? null : usdcStatus.approved,
        hasCtfApproval: blockchainCallFailed ? null : ctfApproved,
        usdcBalance: usdcStatus.balance,
        walletAddress: creds.walletAddress,
        isReady: !blockchainCallFailed && missingSteps.length === 0,
        missingSteps
    };
}

// Export contract addresses for reference
export const POLYMARKET_CONTRACTS = POLYGON_CONTRACTS;
