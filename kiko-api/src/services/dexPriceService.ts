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

import {
    computeUsdPriceFromRawQuote,
    fetchTokenDecimalsFromRPC,
    getTokenPriceUSD,
    getZeroExPrice,
    getZeroExTokenMetadata,
    resolveAdaptivePriceSampleSellAmountRaw,
    toWei
} from './zeroEx.js';
import { getKyberQuote } from './kyberAggregator.js';
import { getSolanaTokenPrice } from './solanaOnChainPriceService.js';
import { callRpc } from './rpcManager.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { getSolanaNativeQuotePrice } from './solana/direct/nativeQuote.js';
import { buildScopedCacheKey, getScopedCacheValue, setScopedCacheValue, withScopedSingleFlight } from './rpc/cacheStore.js';
import type { RpcExecutionLane } from './rpc/executionLane.js';

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

export interface DexPriceResult {
    price: number;
    provider: string;
}

type DexPriceOptions = {
    lane?: RpcExecutionLane;
    allowExternalMonitorFallback?: boolean;
};

// 价格缓存 (30秒有效期)
const priceCache = new Map<string, { price: number; provider: string; timestamp: number }>();
const CACHE_TTL_MS = 30_000;
const PRICE_UNAVAILABLE_COOLDOWN_MS = Math.max(500, Number(process.env.DEX_PRICE_UNAVAILABLE_COOLDOWN_MS || '1500'));
const KYBER_PRICE_DUMMY_RECIPIENT = '0x1111111111111111111111111111111111111111';
const KYBER_PRICE_SLIPPAGE_BPS = 100;
type PriceFailureEntry = { kind: 'failure'; provider: string };

/**
 * 获取代币 USD 价格
 * 
 * @param tokenAddress - 代币地址
 * @param chainId - 链 ID (1, 8453, 42161, 137, 56, 10) 或 'solana'
 * @returns USD 价格，失败返回 0
 */
export async function getDexPrice(
    tokenAddress: string,
    chainId: number | 'solana',
    options: DexPriceOptions = {}
): Promise<number> {
    const result = await getDexPriceDetailed(tokenAddress, chainId, options);
    return result.price;
}

export async function getDexPriceDetailed(
    tokenAddress: string,
    chainId: number | 'solana',
    options: DexPriceOptions = {}
): Promise<DexPriceResult> {
    const cacheKey = `${chainId}:${tokenAddress.toLowerCase()}`;
    const lane = options.lane || 'cheap';
    const sharedKey = buildScopedCacheKey('dex_price_detail', [chainId, tokenAddress.toLowerCase(), lane]);

    // 检查缓存
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return { price: cached.price, provider: cached.provider };
    }
    const throttled = getScopedCacheValue<DexPriceResult | PriceFailureEntry>(sharedKey);
    if (throttled && 'kind' in throttled && throttled.kind === 'failure') {
        return { price: 0, provider: throttled.provider };
    }

    try {
        return await withScopedSingleFlight(sharedKey, async () => {
            const hot = priceCache.get(cacheKey);
            if (hot && Date.now() - hot.timestamp < CACHE_TTL_MS) {
                return { price: hot.price, provider: hot.provider };
            }

            let price = 0;
            let provider = 'unavailable';

            if (chainId === 'solana' || chainId === 101) {
                const solPrice = await getSolanaPriceUsd(tokenAddress, lane);
                price = solPrice.price;
                provider = solPrice.provider;
            } else if (typeof chainId === 'number') {
                const result = await getEvmPriceUsd(tokenAddress, chainId, lane);
                price = result.price;
                provider = result.provider;
                if (!(Number.isFinite(price) && price > 0) && options.allowExternalMonitorFallback) {
                    const external = await getEvmExternalMonitorPriceUsd(tokenAddress, chainId);
                    price = external.price;
                    provider = external.provider;
                }
            }

            if (Number.isFinite(price) && price > 0) {
                priceCache.set(cacheKey, { price, provider, timestamp: Date.now() });
                return { price, provider };
            }

            priceCache.delete(cacheKey);
            setScopedCacheValue<PriceFailureEntry>(sharedKey, { kind: 'failure', provider }, PRICE_UNAVAILABLE_COOLDOWN_MS);
            return { price: 0, provider };
        });
    } catch (error: any) {
        logger.warn(LogCode.API_FETCH_FAILED, 'getDexPrice failed', {
            tokenAddress: tokenAddress.slice(0, 10),
            chain: String(chainId),
            error: error.message
        });
        setScopedCacheValue<PriceFailureEntry>(sharedKey, { kind: 'failure', provider: 'unavailable' }, PRICE_UNAVAILABLE_COOLDOWN_MS);
        return { price: 0, provider: 'unavailable' };
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
async function getEvmPriceUsd(tokenAddress: string, chainId: number, lane: RpcExecutionLane): Promise<DexPriceResult> {
    const precisePrice = await getTokenPriceUSD(tokenAddress, chainId, { lane });
    if (Number.isFinite(precisePrice) && Number(precisePrice) > 0) {
        return { price: Number(precisePrice), provider: '0x-dex' };
    }

    const usdcAddress = USDC_ADDRESSES[chainId];
    if (!usdcAddress) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Unsupported chain for 0x price', { chainId });
        return { price: 0, provider: 'unavailable' };
    }

    // 跳过 USDC 本身
    if (tokenAddress.toLowerCase() === usdcAddress.toLowerCase()) {
        return { price: 1.0, provider: '0x-dex' };
    }

    const [tokenMeta, usdcMeta] = await Promise.all([
        getZeroExTokenMetadata(tokenAddress, chainId, { lane }).catch(() => null),
        getZeroExTokenMetadata(usdcAddress, chainId, { lane }).catch(() => null)
    ]);
    const tokenDecimals = Number(tokenMeta?.decimals ?? await fetchTokenDecimalsFromRPC(tokenAddress, chainId, { lane }));
    const usdcDecimals = Number(usdcMeta?.decimals ?? await fetchTokenDecimalsFromRPC(usdcAddress, chainId, { lane }));
    if (!Number.isFinite(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 24) {
        return { price: 0, provider: 'unavailable' };
    }
    if (!Number.isFinite(usdcDecimals) || usdcDecimals < 0 || usdcDecimals > 24) {
        return { price: 0, provider: 'unavailable' };
    }

    let sellAmount = toWei('1', tokenDecimals); // 1 token (decimals-aware)

    const quote = await getZeroExPrice(tokenAddress, usdcAddress, sellAmount, chainId);

    if (!quote || !quote.buyAmount) {
        const kyberPrice = await getEvmPriceUsdFromKyber(tokenAddress, chainId, usdcAddress, lane);
        if (kyberPrice > 0) {
            return { price: kyberPrice, provider: 'kyber-dex' };
        }
        return { price: 0, provider: 'unavailable' };
    }

    const adaptiveSample = resolveAdaptivePriceSampleSellAmountRaw({
        baseSellAmountRaw: sellAmount,
        quotedBuyAmountRaw: quote.buyAmount,
    });
    let finalQuote = quote;
    if (adaptiveSample.resampled) {
        const refinedQuote = await getZeroExPrice(tokenAddress, usdcAddress, adaptiveSample.sellAmountRaw, chainId);
        if (refinedQuote?.buyAmount) {
            finalQuote = refinedQuote;
            sellAmount = adaptiveSample.sellAmountRaw;
        }
    }

    const price = computeUsdPriceFromRawQuote({
        sellAmountRaw: sellAmount,
        buyAmountRaw: finalQuote.buyAmount,
        sellTokenDecimals: tokenDecimals,
        buyTokenDecimals: usdcDecimals,
    });
    if (!(Number.isFinite(price) && price > 0)) {
        const kyberPrice = await getEvmPriceUsdFromKyber(tokenAddress, chainId, usdcAddress, lane);
        if (kyberPrice > 0) return { price: kyberPrice, provider: 'kyber-dex' };
        return { price: 0, provider: 'unavailable' };
    }

    logger.debug(LogCode.API_FETCH_SUCCESS, 'EVM price from 0x', {
        token: tokenAddress.slice(0, 10),
        chainId,
        price: price.toFixed(8)
    });

    return { price, provider: '0x-dex' };
}

const DEX_SCREENER_CHAIN_IDS: Record<number, string> = {
    1: 'ethereum',
    10: 'optimism',
    56: 'bsc',
    137: 'polygon',
    8453: 'base',
    42161: 'arbitrum',
};

const GECKO_TERMINAL_NETWORK_IDS: Record<number, string> = {
    1: 'eth',
    10: 'optimism',
    56: 'bsc',
    137: 'polygon_pos',
    8453: 'base',
    42161: 'arbitrum',
};

export function resolveDexScreenerUsdPrice(payload: any, chainId: number): number {
    const targetChain = DEX_SCREENER_CHAIN_IDS[chainId];
    if (!targetChain) return 0;
    const pairs = Array.isArray(payload?.pairs) ? payload.pairs : [];
    const matchingPairs = pairs.filter((pair: any) => String(pair?.chainId || '').toLowerCase() === targetChain);
    const rankedPairs = matchingPairs.sort((a: any, b: any) => {
        const aLiquidity = Number(a?.liquidity?.usd || 0);
        const bLiquidity = Number(b?.liquidity?.usd || 0);
        return bLiquidity - aLiquidity;
    });
    for (const pair of rankedPairs) {
        const price = Number(pair?.priceUsd || 0);
        if (Number.isFinite(price) && price > 0) return price;
    }
    return 0;
}

export function resolveGeckoTerminalUsdPrice(payload: any): number {
    const price = Number(payload?.data?.attributes?.price_usd || 0);
    return Number.isFinite(price) && price > 0 ? price : 0;
}

async function getEvmExternalMonitorPriceUsd(tokenAddress: string, chainId: number): Promise<DexPriceResult> {
    const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    const geckoNetwork = GECKO_TERMINAL_NETWORK_IDS[chainId];
    const geckoUrl = geckoNetwork
        ? `https://api.geckoterminal.com/api/v2/networks/${geckoNetwork}/tokens/${tokenAddress}`
        : null;

    try {
        const dexResp = await fetch(dexScreenerUrl, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(3000),
        });
        if (dexResp.ok) {
            const dexPayload = await dexResp.json();
            const dexPrice = resolveDexScreenerUsdPrice(dexPayload, chainId);
            if (dexPrice > 0) return { price: dexPrice, provider: 'dexscreener-monitor' };
        }
    } catch (error: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'DexScreener monitor price fallback failed', {
            token: tokenAddress.slice(0, 10),
            chainId,
            error: error?.message,
        });
    }

    if (!geckoUrl) return { price: 0, provider: 'unavailable' };
    try {
        const geckoResp = await fetch(geckoUrl, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(3000),
        });
        if (geckoResp.ok) {
            const geckoPayload = await geckoResp.json();
            const geckoPrice = resolveGeckoTerminalUsdPrice(geckoPayload);
            if (geckoPrice > 0) return { price: geckoPrice, provider: 'geckoterminal-monitor' };
        }
    } catch (error: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'GeckoTerminal monitor price fallback failed', {
            token: tokenAddress.slice(0, 10),
            chainId,
            error: error?.message,
        });
    }

    return { price: 0, provider: 'unavailable' };
}

async function getEvmPriceUsdFromKyber(tokenAddress: string, chainId: number, usdcAddress: string, lane: RpcExecutionLane): Promise<number> {
    try {
        const [tokenMeta, usdcMeta] = await Promise.all([
            getZeroExTokenMetadata(tokenAddress, chainId, { lane }).catch(() => null),
            getZeroExTokenMetadata(usdcAddress, chainId, { lane }).catch(() => null)
        ]);
        const tokenDecimals = Number(tokenMeta?.decimals ?? await fetchTokenDecimalsFromRPC(tokenAddress, chainId, { lane }));
        const usdcDecimals = Number(usdcMeta?.decimals ?? await fetchTokenDecimalsFromRPC(usdcAddress, chainId, { lane }));
        if (!Number.isFinite(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 24) return 0;
        if (!Number.isFinite(usdcDecimals) || usdcDecimals < 0 || usdcDecimals > 24) return 0;

        const oneTokenRaw = toWei('1', tokenDecimals);
        const quote = await getKyberQuote(
            tokenAddress,
            usdcAddress,
            oneTokenRaw,
            chainId,
            KYBER_PRICE_SLIPPAGE_BPS,
            KYBER_PRICE_DUMMY_RECIPIENT,
            'swap',
            true,
            undefined,
            { disablePlatformFee: true }
        );
        const amountOutRaw = quote?.amountOut || quote?.amountOutBase;
        if (!amountOutRaw) return 0;
        const usdOut = computeUsdPriceFromRawQuote({
            sellAmountRaw: oneTokenRaw,
            buyAmountRaw: amountOutRaw,
            sellTokenDecimals: tokenDecimals,
            buyTokenDecimals: usdcDecimals,
        });
        if (!Number.isFinite(usdOut) || usdOut <= 0) return 0;
        logger.debug(LogCode.API_FETCH_SUCCESS, 'EVM price from Kyber', {
            token: tokenAddress.slice(0, 10),
            chainId,
            price: usdOut.toFixed(8)
        });
        return usdOut;
    } catch (error: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'Kyber EVM price fallback failed', {
            token: tokenAddress.slice(0, 10),
            chainId,
            error: error?.message
        });
        return 0;
    }
}

/**
 * Solana 价格获取
 *
 * 策略 (按优先级):
 *   1. Jupiter Price API v2   — 外部 API，轻量 GET，无需 swap 模拟
 *   2. Raydium Mint Price API — 外部 API，兜底
 *   3. Solana 免费 RPC 节点  — 最后兜底：读链上 PumpFun bonding curve 储量推导价格
 */
async function getSolanaPriceUsd(tokenMint: string, lane: RpcExecutionLane): Promise<DexPriceResult> {
    if (tokenMint === SOLANA_USDC_MINT) return { price: 1.0, provider: 'stablecoin' };

    // Strategy 1: program-native quote / reserve math.
    try {
        const nativeQuote = await getSolanaNativeQuotePrice(tokenMint, '1000000');
        if (nativeQuote && nativeQuote.priceUsd > 0) {
            logger.debug(LogCode.API_FETCH_SUCCESS, 'Solana price from native program quote', {
                token: tokenMint.slice(0, 10),
                provider: nativeQuote.provider,
                price: nativeQuote.priceUsd.toFixed(8)
            });
            return { price: nativeQuote.priceUsd, provider: nativeQuote.provider };
        }
    } catch (err: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'Solana native quote provider failed', { token: tokenMint.slice(0, 10), error: err?.message });
    }

    // ── Strategy 2: Jupiter Price API v2 (external, fast GET) ─────────────
    try {
        const jupiterPrice = await getSolanaTokenPrice(tokenMint);
        if (jupiterPrice && jupiterPrice > 0) {
            logger.debug(LogCode.API_FETCH_SUCCESS, 'Solana price from Jupiter Price API v2', {
                token: tokenMint.slice(0, 10), price: jupiterPrice.toFixed(8)
            });
            return { price: jupiterPrice, provider: 'jupiter-dex' };
        }
    } catch (err: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'Jupiter Price API v2 failed', { token: tokenMint.slice(0, 10), error: err?.message });
    }

    // ── Strategy 3: Raydium Mint Price API (external) ─────────────────────
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
                    return { price, provider: 'raydium-dex' };
                }
            }
        }
    } catch (err: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'Raydium price API failed', { token: tokenMint.slice(0, 10), error: err?.message });
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
            { strategy: lane === 'critical' ? 'fast' : 'cheap', lane }
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
                        return { price, provider: 'pumpfun-bonding-rpc' };
                    }
                }
            }
        }
    } catch (err: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'PumpFun bonding curve RPC fallback failed', { token: tokenMint.slice(0, 10), error: err?.message });
    }

    return { price: 0, provider: 'unavailable' };
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
