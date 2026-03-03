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
import { getSolanaTokenPrice } from './solanaOnChainPriceService.js';
import { callRpc } from './rpcManager.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

const RAYDIUM_PRICE_API = 'https://api-v3.raydium.io/mint/price';
const PUMP_FUN_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

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
 * Solana 价格获取
 *
 * 策略 (按优先级):
 *   1. Jupiter Price API v2   — 外部 API，轻量 GET，无需 swap 模拟
 *   2. Raydium Mint Price API — 外部 API，兜底
 *   3. DexScreener REST API  — 外部 API，免费，第三道保险
 *   4. Solana 免费 RPC 节点  — 最后兜底：读链上 PumpFun bonding curve 储量推导价格
 */
async function getSolanaPriceUsd(tokenMint: string): Promise<number> {
    if (tokenMint === SOLANA_USDC_MINT) return 1.0;

    // ── Strategy 1: Jupiter Price API v2 (external, fast GET) ─────────────
    try {
        const jupiterPrice = await getSolanaTokenPrice(tokenMint);
        if (jupiterPrice && jupiterPrice > 0) {
            logger.debug(LogCode.API_FETCH_SUCCESS, 'Solana price from Jupiter Price API v2', {
                token: tokenMint.slice(0, 10), price: jupiterPrice.toFixed(8)
            });
            return jupiterPrice;
        }
    } catch (err: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'Jupiter Price API v2 failed', { token: tokenMint.slice(0, 10), error: err?.message });
    }

    // ── Strategy 2: Raydium Mint Price API (external) ─────────────────────
    try {
        const resp = await fetch(`${RAYDIUM_PRICE_API}?mints=${tokenMint}`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(3000)
        });
        if (resp.ok) {
            const data: any = await resp.json();
            const priceRaw = data?.data?.[tokenMint];
            if (priceRaw) {
                const price = typeof priceRaw === 'number' ? priceRaw : parseFloat(priceRaw);
                if (Number.isFinite(price) && price > 0) {
                    logger.debug(LogCode.API_FETCH_SUCCESS, 'Solana price from Raydium API', {
                        token: tokenMint.slice(0, 10), price: price.toFixed(8)
                    });
                    return price;
                }
            }
        }
    } catch (err: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'Raydium price API failed', { token: tokenMint.slice(0, 10), error: err?.message });
    }

    // ── Strategy 3: DexScreener REST API (external, free) ─────────────────
    try {
        const resp = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(3000)
        });
        if (resp.ok) {
            const data: any = await resp.json();
            const pairs: any[] = data?.pairs || [];
            if (pairs.length > 0) {
                // Pick the pair with highest liquidity
                const best = pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
                const price = parseFloat(best?.priceUsd || '0');
                if (Number.isFinite(price) && price > 0) {
                    logger.debug(LogCode.API_FETCH_SUCCESS, 'Solana price from DexScreener REST', {
                        token: tokenMint.slice(0, 10), price: price.toFixed(8)
                    });
                    return price;
                }
            }
        }
    } catch (err: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'DexScreener REST failed', { token: tokenMint.slice(0, 10), error: err?.message });
    }

    // ── Strategy 4: Cheap RPC fallback — read PumpFun bonding curve on-chain ─
    // Works for non-graduated pump.fun tokens whose bonding curve PDA is derivable.
    // Price = (virtualSolReserves_lamports / 1e9) / (virtualTokenReserves_units / 1e6) * SOL_USD
    try {
        const { PublicKey } = await import('@solana/web3.js');
        const mintPubkey = new PublicKey(tokenMint);
        const [bondingCurvePda] = PublicKey.findProgramAddressSync(
            [Buffer.from('bonding-curve'), mintPubkey.toBuffer()],
            new PublicKey(PUMP_FUN_PROGRAM_ID)
        );

        const accountResult = await callRpc<any>(
            'solana', 'getAccountInfo',
            [bondingCurvePda.toString(), { encoding: 'base64' }],
            { strategy: 'cheap' }
        );

        const dataArr: string[] | undefined = accountResult?.value?.data;
        if (dataArr && dataArr.length > 0) {
            const raw = Buffer.from(dataArr[0], 'base64');
            if (raw.length >= 49) {
                const virtualTokenReserves = raw.readBigUInt64LE(8);   // u64 @ offset 8
                const virtualSolReserves   = raw.readBigUInt64LE(16);  // u64 @ offset 16
                const complete             = raw[48] !== 0;             // bool @ offset 48

                if (!complete && virtualTokenReserves > 0n && virtualSolReserves > 0n) {
                    // pump tokens have 6 decimals; SOL has 9
                    const priceSol = Number(virtualSolReserves) / (Number(virtualTokenReserves) * 1e3);
                    const { getNativeTokenPriceUsd } = await import('./onChainPriceService.js');
                    const solUsd = await getNativeTokenPriceUsd(900).catch(() => 0);
                    if (solUsd > 0) {
                        const price = priceSol * solUsd;
                        logger.debug(LogCode.API_FETCH_SUCCESS, 'Solana price from PumpFun bonding curve (cheap RPC)', {
                            token: tokenMint.slice(0, 10), price: price.toFixed(8)
                        });
                        return price;
                    }
                }
            }
        }
    } catch (err: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'PumpFun bonding curve RPC fallback failed', { token: tokenMint.slice(0, 10), error: err?.message });
    }

    return 0;
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
