/**
 * Unified DEX Price Service
 * 
 * 使用 DEX 聚合器 API 获取代币价格：
 * - EVM 链 (ETH, Base, Arbitrum, Polygon, BSC): 0x API
 * - Solana: Jupiter / Raydium
 * 
 * 优势：
 * - 基于真实流动性的准确价格
 * - 无需额外第三方 API (如 DexScreener)
 * - 多链支持
 */

import { getZeroExPrice } from './zeroEx.js';
import { getSolanaPrice } from './solanaSwap.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

// USDC 地址映射
const USDC_ADDRESSES: Record<number, string> = {
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',      // Ethereum
    8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913',   // Base
    42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',  // Arbitrum (native USDC)
    137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',    // Polygon (native USDC)
    56: '0x8AC76a51cc950d9822D68b83FE1Ad97B32Cd580d',     // BSC
    10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',     // Optimism (native USDC)
};

// Solana USDC Mint
const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// 价格缓存 (30秒有效期)
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_TTL_MS = 30_000;

/**
 * 获取代币 USD 价格
 * 
 * @param tokenAddress - 代币地址
 * @param chainId - 链 ID (1, 8453, 42161, 137, 56, 10) 或 'solana'
 * @returns USD 价格，失败返回 0
 */
export async function getDexPrice(
    tokenAddress: string,
    chainId: number | 'solana'
): Promise<number> {
    const cacheKey = `${chainId}:${tokenAddress.toLowerCase()}`;

    // 检查缓存
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.price;
    }

    try {
        let price = 0;

        if (chainId === 'solana' || chainId === 101) {
            // Solana: 使用 Jupiter
            price = await getSolanaPriceUsd(tokenAddress);
        } else if (typeof chainId === 'number') {
            // EVM: 使用 0x
            price = await getEvmPriceUsd(tokenAddress, chainId);
        }

        // 缓存结果
        priceCache.set(cacheKey, { price, timestamp: Date.now() });

        return price;
    } catch (error: any) {
        logger.warn(LogCode.API_FETCH_FAILED, 'getDexPrice failed', {
            tokenAddress: tokenAddress.slice(0, 10),
            chain: String(chainId),
            error: error.message
        });
        return 0;
    }
}

/**
 * 批量获取代币价格
 */
export async function getDexPricesBatch(
    tokens: Array<{ address: string; chainId: number | 'solana' }>
): Promise<Map<string, number>> {
    const results = new Map<string, number>();

    // 并行获取所有价格
    const promises = tokens.map(async (token) => {
        const price = await getDexPrice(token.address, token.chainId);
        const key = `${token.chainId}:${token.address.toLowerCase()}`;
        results.set(key, price);
    });

    await Promise.allSettled(promises);
    return results;
}

/**
 * EVM 链价格获取 (使用 0x API)
 * 
 * 策略: 获取 Token -> USDC 的报价，反推价格
 */
async function getEvmPriceUsd(tokenAddress: string, chainId: number): Promise<number> {
    const usdcAddress = USDC_ADDRESSES[chainId];
    if (!usdcAddress) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Unsupported chain for 0x price', { chainId });
        return 0;
    }

    // 跳过 USDC 本身
    if (tokenAddress.toLowerCase() === usdcAddress.toLowerCase()) {
        return 1.0;
    }

    // 获取 1 单位代币能换多少 USDC
    // 使用较小金额以获取更准确的价格 (避免滑点影响)
    const sellAmount = '1000000000000000000'; // 1e18 (1 token with 18 decimals)

    const quote = await getZeroExPrice(tokenAddress, usdcAddress, sellAmount, chainId);

    if (!quote || !quote.buyAmount) {
        return 0;
    }

    // 计算价格: buyAmount (USDC, 6 decimals) / sellAmount (token, 18 decimals)
    // price = (buyAmount / 1e6) / (sellAmount / 1e18)
    // price = buyAmount * 1e12 / sellAmount
    const buyAmountBigInt = BigInt(quote.buyAmount);
    const sellAmountBigInt = BigInt(sellAmount);

    // USDC has 6 decimals, most tokens have 18
    // Price = (buyAmount / 10^6) / (sellAmount / 10^18) = buyAmount * 10^12 / sellAmount
    const priceBigInt = (buyAmountBigInt * BigInt(1e12)) / sellAmountBigInt;
    const price = Number(priceBigInt) / 1e12;

    logger.debug(LogCode.API_FETCH_SUCCESS, 'EVM price from 0x', {
        token: tokenAddress.slice(0, 10),
        chainId,
        price: price.toFixed(8)
    });

    return price;
}

/**
 * Solana 价格获取 (使用 Jupiter)
 * 
 * 策略: 获取 Token -> USDC 的报价，反推价格
 */
async function getSolanaPriceUsd(tokenMint: string): Promise<number> {
    // 跳过 USDC 本身
    if (tokenMint === SOLANA_USDC_MINT) {
        return 1.0;
    }

    // 获取 1 单位代币能换多少 USDC
    const amount = '1000000000'; // 1e9 (1 SOL-like token with 9 decimals)

    const quote = await getSolanaPrice(tokenMint, SOLANA_USDC_MINT, amount);

    if (!quote || !quote.outAmount) {
        return 0;
    }

    // 计算价格: outAmount (USDC, 6 decimals) / inAmount (token, 9 decimals)
    // price = (outAmount / 1e6) / (inAmount / 1e9)
    // price = outAmount * 1e3 / inAmount
    const outAmountBigInt = BigInt(quote.outAmount);
    const inAmountBigInt = BigInt(amount);

    const priceBigInt = (outAmountBigInt * BigInt(1e3)) / inAmountBigInt;
    const price = Number(priceBigInt) / 1e3;

    logger.debug(LogCode.API_FETCH_SUCCESS, 'Solana price from Jupiter', {
        token: tokenMint.slice(0, 10),
        price: price.toFixed(8)
    });

    return price;
}

/**
 * 清除价格缓存
 */
export function clearPriceCache(): void {
    priceCache.clear();
}

/**
 * 获取支持的链 ID 列表
 */
export function getSupportedChainIds(): (number | 'solana')[] {
    return [...Object.keys(USDC_ADDRESSES).map(Number), 'solana'];
}
