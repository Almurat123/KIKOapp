/**
 * Polymarket Order Builder
 * Builds and signs EIP-712 orders using the Polymarket wallet private key
 * 
 * Polymarket Wallet Structure:
 * - Signer Wallet: The wallet with private key, used to sign orders
 * - Funder/Proxy Wallet: The on-chain proxy that holds funds and executes trades
 * 
 * Signature Type 1 (POLY_PROXY) is used when the signer signs on behalf of the funder
 */

import { ethers } from 'ethers';

// Exchange contract addresses on Polygon
const CTF_EXCHANGE_ADDRESS = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const NEG_RISK_CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a';

// EIP-712 Domain for Polymarket
const DOMAIN_NAME = 'Polymarket CTF Exchange';
const DOMAIN_VERSION = '1';
const CHAIN_ID = 137; // Polygon

// Signature types
const SIGNATURE_TYPE_EOA = 0;
const SIGNATURE_TYPE_POLY_PROXY = 1;

// Order types for EIP-712
const ORDER_TYPES = {
    Order: [
        { name: 'salt', type: 'uint256' },
        { name: 'maker', type: 'address' },
        { name: 'signer', type: 'address' },
        { name: 'taker', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
        { name: 'makerAmount', type: 'uint256' },
        { name: 'takerAmount', type: 'uint256' },
        { name: 'expiration', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'feeRateBps', type: 'uint256' },
        { name: 'side', type: 'uint8' },
        { name: 'signatureType', type: 'uint8' }
    ]
};

export interface OrderData {
    salt: string;
    maker: string;     // Funder/Proxy wallet address (holds the funds)
    signer: string;    // Signer wallet address (signs the order)
    taker: string;
    tokenId: string;
    makerAmount: string;
    takerAmount: string;
    expiration: string;
    nonce: string;
    feeRateBps: string;
    side: number; // 0 = BUY, 1 = SELL
    signatureType: number; // 0 = EOA, 1 = POLY_PROXY
}

export interface SignedOrder extends OrderData {
    signature: string;
}

// Cached wallet instance
let polymarketWallet: ethers.Wallet | null = null;
let cachedFunderAddress: string | null = null;

/**
 * Get or create the Polymarket signer wallet from private key
 */
function getPolymarketWallet(): ethers.Wallet {
    if (polymarketWallet) return polymarketWallet;

    const privateKey = process.env.PRIVATE_KEY || process.env.POLYMARKET_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('PRIVATE_KEY not configured for Polymarket signing');
    }

    // Create wallet (no provider needed for signing)
    polymarketWallet = new ethers.Wallet(privateKey);
    console.log('[PolymarketOrderBuilder] Signer wallet:', polymarketWallet.address.slice(0, 15) + '...');

    return polymarketWallet;
}

/**
 * Get the funder/proxy wallet address
 */
export function getFunderAddress(): string {
    if (cachedFunderAddress) return cachedFunderAddress;

    cachedFunderAddress = (process.env.POLYMARKET_FUNDER_ADDRESS || process.env.FUNDER_ADDRESS) as string;
    if (!cachedFunderAddress) {
        throw new Error('POLYMARKET_FUNDER_ADDRESS not configured. This is your Polymarket proxy wallet address (visible at polymarket.com/settings)');
    }

    console.log('[PolymarketOrderBuilder] Funder/Proxy wallet:', cachedFunderAddress.slice(0, 15) + '...');
    return cachedFunderAddress;
}

/**
 * Backwards compatibility for getUserWalletAddress
 */
export function getUserWalletAddress(): string {
    return getFunderAddress();
}

/**
 * Get the signer wallet address (for L2 auth headers)
 */
export function getPolymarketWalletAddress(): string {
    return getPolymarketWallet().address;
}

/**
 * Build and sign an order using the Polymarket wallet private key
 * Uses POLY_PROXY signature type (1) since we're signing on behalf of the funder
 */
export async function buildSignedOrder(
    _userId: string, // Not used when signing with private key
    order: OrderData,
    isNegRisk: boolean = false
): Promise<SignedOrder> {
    const wallet = getPolymarketWallet();

    // Select exchange address based on market type
    const exchangeAddress = isNegRisk ? NEG_RISK_CTF_EXCHANGE : CTF_EXCHANGE_ADDRESS;

    // Build EIP-712 domain
    const domain = {
        name: DOMAIN_NAME,
        version: DOMAIN_VERSION,
        chainId: CHAIN_ID,
        verifyingContract: exchangeAddress
    };

    // Prepare message
    const message = {
        salt: order.salt,
        maker: order.maker,
        signer: order.signer,
        taker: order.taker,
        tokenId: order.tokenId,
        makerAmount: order.makerAmount,
        takerAmount: order.takerAmount,
        expiration: order.expiration,
        nonce: order.nonce,
        feeRateBps: order.feeRateBps,
        side: order.side,
        signatureType: order.signatureType
    };

    console.log('[PolymarketOrderBuilder] Signing order:', {
        maker: order.maker.slice(0, 10) + '...',
        signer: order.signer.slice(0, 10) + '...',
        tokenId: order.tokenId.slice(0, 20) + '...',
        side: order.side === 0 ? 'BUY' : 'SELL',
        signatureType: order.signatureType === 0 ? 'EOA' : 'POLY_PROXY'
    });

    // Sign with EIP-712
    const signature = await wallet.signTypedData(domain, ORDER_TYPES, message);

    console.log('[PolymarketOrderBuilder] Signature obtained:', signature.slice(0, 20) + '...');

    return {
        ...order,
        signature
    };
}

/**
 * Create order data for a limit order
 * Uses POLY_PROXY signature type with separate maker (funder) and signer addresses
 */
export function createLimitOrderData(params: {
    makerAddress?: string; // Ignored, uses POLYMARKET_FUNDER_ADDRESS
    tokenId: string;
    side: 'BUY' | 'SELL';
    price: number;
    size: number;
    feeRateBps?: number;
}): OrderData {
    const { tokenId, side, price, size, feeRateBps = 0 } = params;

    // Get wallet addresses
    const signerAddress = getPolymarketWalletAddress(); // Signs the order
    const funderAddress = getFunderAddress(); // Holds the funds (maker)

    // Calculate amounts based on side
    // For BUY: makerAmount = USDC to pay, takerAmount = shares to receive
    // For SELL: makerAmount = shares to sell, takerAmount = USDC to receive
    let makerAmount: number;
    let takerAmount: number;

    if (side === 'BUY') {
        // BUY: We pay (size * price) USDC to get (size) shares
        makerAmount = Math.floor(size * price * 1e6); // USDC has 6 decimals
        takerAmount = Math.floor(size * 1e6); // Shares also use 1e6 scaling
    } else {
        // SELL: We sell (size) shares to get (size * price) USDC
        makerAmount = Math.floor(size * 1e6);
        takerAmount = Math.floor(size * price * 1e6);
    }

    // Generate random salt
    const salt = BigInt(Math.floor(Math.random() * 1e18)).toString();

    // Expiration: 24 hours from now
    const expiration = Math.floor(Date.now() / 1000 + 24 * 60 * 60).toString();

    return {
        salt,
        maker: funderAddress,    // The proxy wallet that holds funds
        signer: signerAddress,   // The wallet that signs orders
        taker: '0x0000000000000000000000000000000000000000', // Any taker
        tokenId,
        makerAmount: makerAmount.toString(),
        takerAmount: takerAmount.toString(),
        expiration,
        nonce: '0',
        feeRateBps: feeRateBps.toString(),
        side: side === 'BUY' ? 0 : 1,
        signatureType: SIGNATURE_TYPE_POLY_PROXY // Using proxy signature type
    };
}
