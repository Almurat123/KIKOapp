/**
 * Polymarket Token Approval Service
 * 
 * Handles USDC and CTF token approvals for the Polymarket Exchange contracts on Polygon.
 * Users must approve tokens before trading.
 */

import { ethers } from 'ethers';
import prisma from '../db/prisma.js';
import { getDelegatedEvmWallet } from './privyWallet.js';
import { sendTransaction } from './privyWallet.js';

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

    // Neg Risk Adapter from Polymarket clob-client contract config
    NEG_RISK_ADAPTER: '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296',

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

async function estimateApprovalGas(params: {
    walletAddress: string;
    to: string;
    data: string;
    type: 'usdc' | 'ctf';
}): Promise<string> {
    const provider = getPolygonProvider();
    try {
        const estimate = await provider.estimateGas({
            from: params.walletAddress,
            to: params.to,
            data: params.data,
            value: 0n
        });
        // Add a 25% safety buffer to raw-signed Polygon approvals.
        return ((estimate * 125n) / 100n).toString();
    } catch (error: any) {
        const fallbackGas = params.type === 'usdc' ? '120000' : '180000';
        console.warn('[PolymarketApproval] Gas estimation failed, using fallback gas limit', {
            type: params.type,
            to: params.to,
            walletAddress: params.walletAddress,
            fallbackGas,
            error: error?.message || String(error)
        });
        return fallbackGas;
    }
}

/**
 * Check if user has approved USDC for the CTF Exchange
 */
export async function checkUsdcApproval(walletAddress: string): Promise<{
    approved: boolean;
    allowances: Record<string, string>;
    balance: string;
}> {
    const provider = getPolygonProvider();
    const usdc = new ethers.Contract(POLYGON_CONTRACTS.USDC, ERC20_ABI, provider);
    const spenders = [
        POLYGON_CONTRACTS.CTF_EXCHANGE,
        POLYGON_CONTRACTS.NEG_RISK_ADAPTER
    ];

    const [allowances, balance, decimals] = await Promise.all([
        Promise.all(spenders.map((spender) => usdc.allowance(walletAddress, spender))),
        usdc.balanceOf(walletAddress),
        usdc.decimals()
    ]);

    const allowanceMap = Object.fromEntries(
        allowances.map((allowance: bigint, index: number) => [
            spenders[index],
            ethers.formatUnits(allowance, decimals)
        ])
    );
    const formattedBalance = ethers.formatUnits(balance, decimals);
    const isApproved = allowances.every((allowance: bigint) => allowance > 0n);

    return {
        approved: isApproved,
        allowances: allowanceMap,
        balance: formattedBalance
    };
}

/**
 * Check if user has approved CTF tokens for the Exchange
 */
export async function checkCtfApproval(walletAddress: string): Promise<{
    approved: boolean;
    operators: Record<string, boolean>;
}> {
    const provider = getPolygonProvider();
    const ctf = new ethers.Contract(POLYGON_CONTRACTS.CTF, CTF_ABI, provider);
    const operators = [
        POLYGON_CONTRACTS.CTF_EXCHANGE,
        POLYGON_CONTRACTS.NEG_RISK_CTF_EXCHANGE
    ];
    const approvals = await Promise.all(operators.map((operator) => ctf.isApprovedForAll(walletAddress, operator)));
    const operatorMap = Object.fromEntries(
        approvals.map((approved: boolean, index: number) => [operators[index], approved])
    );
    return {
        approved: approvals.every(Boolean),
        operators: operatorMap
    };
}

/**
 * Get the approval transaction data for USDC
 * Returns the transaction data that needs to be signed and sent
 */
export function getUsdcApprovalTx(spender: string): {
    to: string;
    data: string;
    chainId: number;
    description: string;
} {
    const iface = new ethers.Interface(ERC20_ABI);
    const maxApproval = ethers.MaxUint256; // Unlimited approval

    const data = iface.encodeFunctionData('approve', [
        spender,
        maxApproval
    ]);

    return {
        to: POLYGON_CONTRACTS.USDC,
        data,
        chainId: 137,
        description: `Approve USDC for ${spender}`
    };
}

/**
 * Get the approval transaction data for CTF tokens
 */
export function getCtfApprovalTx(operator: string): {
    to: string;
    data: string;
    chainId: number;
    description: string;
} {
    const iface = new ethers.Interface(CTF_ABI);

    const data = iface.encodeFunctionData('setApprovalForAll', [
        operator,
        true
    ]);

    return {
        to: POLYGON_CONTRACTS.CTF,
        data,
        chainId: 137,
        description: `Approve CTF tokens for ${operator}`
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
        for (const spender of [POLYGON_CONTRACTS.CTF_EXCHANGE, POLYGON_CONTRACTS.NEG_RISK_ADAPTER]) {
            const allowance = Number.parseFloat(usdcStatus.allowances[spender] || '0');
            if (allowance <= 0) {
                const tx = getUsdcApprovalTx(spender);
                transactions.push({ type: 'usdc', ...tx });
            }
        }
    }

    if (!ctfApproved.approved) {
        for (const operator of [POLYGON_CONTRACTS.CTF_EXCHANGE, POLYGON_CONTRACTS.NEG_RISK_CTF_EXCHANGE]) {
            if (!ctfApproved.operators[operator]) {
                const tx = getCtfApprovalTx(operator);
                transactions.push({ type: 'ctf', ...tx });
            }
        }
    }

    return {
        needsUsdcApproval: !usdcStatus.approved,
        needsCtfApproval: !ctfApproved.approved,
        usdcBalance: usdcStatus.balance,
        transactions
    };
}

export async function executeRequiredApprovals(params: {
    userId: string;
    accessToken?: string;
}): Promise<{
    txHashes: string[];
    readiness: Awaited<ReturnType<typeof checkTradingReadiness>>;
}> {
    const creds = await prisma.polymarketApiCreds.findUnique({
        where: { userId: params.userId }
    });
    if (!creds) {
        throw new Error('No credentials found. Generate Polymarket credentials first.');
    }

    const approvals = await getRequiredApprovals(creds.walletAddress);
    const txHashes: string[] = [];
    const provider = getPolygonProvider();

    for (const tx of approvals.transactions) {
        const gas = await estimateApprovalGas({
            walletAddress: creds.walletAddress,
            to: tx.to,
            data: tx.data,
            type: tx.type
        });
        const txHash = await sendTransaction(params.userId, params.accessToken || '', {
            to: tx.to,
            data: tx.data,
            gas,
            chainId: tx.chainId,
            txPurpose: 'approval'
        });
        txHashes.push(txHash);
        await provider.waitForTransaction(txHash as `0x${string}`, 1, 60_000);
    }

    const readiness = await checkTradingReadiness(params.userId);
    return { txHashes, readiness };
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
    let ctfApproved: { approved: boolean } | null = { approved: false };
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
        if (!ctfApproved.approved) {
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
        hasCtfApproval: blockchainCallFailed ? null : ctfApproved?.approved ?? false,
        usdcBalance: usdcStatus.balance,
        walletAddress: creds.walletAddress,
        isReady: !blockchainCallFailed && missingSteps.length === 0,
        missingSteps
    };
}

// Export contract addresses for reference
export const POLYMARKET_CONTRACTS = POLYGON_CONTRACTS;
