import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

// Per latest docs: https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/aggregator-api-specification/evm-swaps
// Latest endpoints:
// GET  https://aggregator-api.kyberswap.com/{chain}/api/v1/routes
// POST https://aggregator-api.kyberswap.com/{chain}/api/v1/route/build
// Legacy (single request):
// GET  https://aggregator-api.kyberswap.com/{chain}/route/encode

const KYBER_BASE = 'https://aggregator-api.kyberswap.com';
const CLIENT_ID = 'kiko-app';

const CHAIN_NAME_MAP: Record<number, string> = {
    1: 'ethereum',
    56: 'bsc',
    137: 'polygon',
    10: 'optimism',
    42161: 'arbitrum',
    8453: 'base',
    43114: 'avalanche',
    250: 'fantom',
    59144: 'linea',
};

// Use Legacy API for Base chain - more stable for new tokens
// DISABLED: Legacy API has issues with reverts, prefer V1 API with enableGasEstimation
const USE_LEGACY_FOR_CHAINS: number[] = []; // Disabled for now

export async function getKyberQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: string, // base units
    chainId: number,
    slippageBps: number,
    recipient: string
) {
    const chainName = CHAIN_NAME_MAP[chainId];
    if (!chainName) {
        throw new AppError(400, `KyberSwap unsupported chain ${chainId}`, 'UNSUPPORTED_CHAIN');
    }

    // For Base chain, try Legacy API first (single request, more stable)
    // DISABLED: Causing too many reverts, use V1 API instead
    if (false && USE_LEGACY_FOR_CHAINS.includes(chainId)) {
        const legacyResult = await getKyberQuoteLegacy(chainName, tokenIn, tokenOut, amountIn, slippageBps, recipient);
        if (legacyResult) return legacyResult;
        console.log('[Kyber] Legacy API failed, falling back to V1 API');
    }

    // Step 1: fetch routes
    const params = new URLSearchParams({
        tokenIn,
        tokenOut,
        amountIn,
        saveGas: 'true',
        gasInclude: 'true',
        clientId: CLIENT_ID,
    });

    const routesUrl = `${KYBER_BASE}/${chainName}/api/v1/routes?${params.toString()}`;
    console.log('[Kyber] GET routes', { routesUrl });

    // Add timeout for Kyber API calls (10 seconds)
    const routesController = new AbortController();
    const routesTimeoutId = setTimeout(() => routesController.abort(), 10000);

    let routesRes: Response;
    try {
        routesRes = await fetch(routesUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-client-id': CLIENT_ID,
            },
            signal: routesController.signal,
        });
    } finally {
        clearTimeout(routesTimeoutId);
    }

    let routesJson: any = null;
    try {
        routesJson = await routesRes.json();
    } catch (e) {
        console.error('[Kyber] routes parse error', e);
    }

    if (!routesRes.ok) {
        console.error('[Kyber] routes error', routesRes.status, {
            body: routesJson,
        });
        return null;
    }

    console.log('[Kyber] routes response', {
        status: routesRes.status,
        hasData: !!routesJson?.data,
        keys: routesJson ? Object.keys(routesJson) : [],
    });

    // Per Kyber V1 docs:
    // GET /{chain}/api/v1/routes returns { data: { routeSummary, routerAddress, routes: [...] } }
    // We need routeSummary and the preferred route (first).
    const routeSummary =
        routesJson?.data?.routeSummary ||
        routesJson?.data?.[0]?.routeSummary ||
        routesJson?.data?.summary ||
        routesJson?.data?.[0];

    const routeDetail =
        routesJson?.data?.routes?.[0] ||
        routesJson?.data?.route ||
        routesJson?.data?.[0]?.routes?.[0] ||
        routesJson?.data?.[0]?.route;

    // Some responses may nest path under 'route' or 'paths'. If missing, we rely on routeSummary only (per V1 spec).
    const routePath =
        routeDetail?.route ||
        routeDetail?.paths ||
        routeDetail?.routePath ||
        routeDetail;

    if (!routeSummary) {
        console.warn('[Kyber] no usable route found (missing summary)', {
            hasSummary: !!routeSummary,
            hasRouteDetail: !!routeDetail,
            routeDetailKeys: routeDetail ? Object.keys(routeDetail) : [],
        });
        return null;
    }

    // Step 2: build transaction
    const buildUrl = `${KYBER_BASE}/${chainName}/api/v1/route/build`;

    // Kyber V1 expects slippageTolerance in bps (10 = 0.1%)
    const slippageToleranceBps = Math.max(1, Math.round(slippageBps));

    const buildBody: any = {
        routeSummary, // required
        recipient, // required
        sender: recipient, // required
        slippageTolerance: slippageToleranceBps,
        deadline: Math.floor(Date.now() / 1000) + 600,
        clientId: CLIENT_ID,
        source: CLIENT_ID, // Per docs: should match x-client-id header
        // CRITICAL: Disable gas estimation per official Kyber documentation
        // Gas estimation calls eth_gasEstimate which simulates the full transaction
        // This fails if the user hasn't approved Kyber's router yet
        // Since we handle approvals separately in SwapExecutor, we disable this
        // to avoid false negatives. See: https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/aggregator-api-specification/permit#example
        enableGasEstimation: false,
    };

    // route is optional; include when available
    if (routePath && (!Array.isArray(routePath) || routePath.length > 0)) {
        buildBody.route = routeDetail?.route ? routeDetail : { route: routePath };
    }

    logger.debug(LogCode.API_FETCH_SUCCESS, '[Kyber] route/build request', {
      tokenIn: `${tokenIn.slice(0, 6)}...`,
      tokenOut: `${tokenOut.slice(0, 6)}...`,
      amountIn,
      slippage: slippageToleranceBps
    });

    // Add timeout for Kyber build API (10 seconds)
    const buildController = new AbortController();
    const buildTimeoutId = setTimeout(() => buildController.abort(), 10000);

    let buildRes: Response;
    try {
        buildRes = await fetch(buildUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-client-id': CLIENT_ID,
            },
            body: JSON.stringify(buildBody),
            signal: buildController.signal,
        });
    } finally {
        clearTimeout(buildTimeoutId);
    }

    let buildJson: any = null;
    try {
        buildJson = await buildRes.json();
    } catch (e) {
        console.error('[Kyber] build parse error', e);
    }

    if (!buildRes.ok) {
        console.error('[Kyber] build error', buildRes.status, {
            body: buildJson,
        });
        return null;
    }

    const buildData = buildJson?.data;
    
    logger.debug(LogCode.API_FETCH_SUCCESS, '[Kyber] route/build response', {
      amountOut: buildData?.amountOut,
      gas: buildData?.gas
    });

    const encoded =
        buildData?.data ||
        buildData?.encodedSwap ||
        buildData?.encodedSwapData;

    const routerAddr =
        buildData?.routerAddress ||
        buildData?.to ||
        routeSummary?.routerAddress;

    const txValue = buildData?.transactionValue || buildData?.value || '0';

    if (!encoded || !routerAddr) {
        console.warn('[Kyber] invalid build response', {
            dataLen: encoded ? String(encoded).length : 0,
            router: routerAddr,
            dataKeys: buildData ? Object.keys(buildData) : [],
            rootKeys: buildJson ? Object.keys(buildJson) : [],
        });
        return null;
    }

    // CRITICAL: For native token swaps (ETH), value MUST be the amountIn
    // Kyber's transactionValue might be incorrect, so we force it for native token
    const isNativeIn = tokenIn.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
                       tokenIn.toLowerCase() === '0x0000000000000000000000000000000000000000';
    const finalValue = isNativeIn ? amountIn : txValue;

    // Value handling for native tokens (logged at debug level only)

    const tx = {
        data: encoded,
        routerAddress: routerAddr,
        to: routerAddr,
        value: finalValue,
        gas: buildData?.gas,
        allowanceTarget: routerAddr,
    };

    const amountOut =
        routeSummary?.amountOut ||
        routeDetail?.amountOut ||
        routeDetail?.outputAmount ||
        '0';

    // Quote ready (logged at debug level)

    return {
        amountOut,
        amountOutBase: amountOut,
        routerAddress: tx.routerAddress,
        to: tx.routerAddress,
        data: tx.data,
        value: tx.value || '0',
        gas: tx.gas,
        priceImpact: routeSummary?.priceImpact || routeSummary?.priceImpactPct,
        allowanceTarget: tx.allowanceTarget || tx.routerAddress,
    };
}

/**
 * Legacy single-request API - more stable for some tokens
 * GET https://aggregator-api.kyberswap.com/{chain}/route/encode
 */
async function getKyberQuoteLegacy(
    chainName: string,
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    slippageBps: number,
    recipient: string
) {
    try {
        const params = new URLSearchParams({
            tokenIn,
            tokenOut,
            amountIn,
            to: recipient, // Legacy API uses 'to' for recipient
            saveGas: 'true',
            gasInclude: 'true',
            slippageTolerance: String(slippageBps),
        });

        const url = `${KYBER_BASE}/${chainName}/route/encode?${params.toString()}`;
        console.log('[Kyber Legacy] GET route/encode', { url: url.substring(0, 100) + '...' });

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-client-id': CLIENT_ID,
            },
        });

        if (!res.ok) {
            console.warn('[Kyber Legacy] request failed', res.status);
            return null;
        }

        const json: any = await res.json();
        
        console.log('[Kyber Legacy] response', {
            hasEncodedSwapData: !!json?.encodedSwapData,
            hasRouterAddress: !!json?.routerAddress,
            outputAmount: json?.outputAmount,
        });

        if (!json?.encodedSwapData || !json?.routerAddress) {
            console.warn('[Kyber Legacy] missing data');
            return null;
        }

        // For native token input, value should be amountIn
        const isNativeIn = tokenIn.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
                           tokenIn.toLowerCase() === '0x0000000000000000000000000000000000000000';
        const txValue = isNativeIn ? amountIn : '0';

        return {
            amountOut: json.outputAmount,
            amountOutBase: json.outputAmount,
            routerAddress: json.routerAddress,
            to: json.routerAddress,
            data: json.encodedSwapData,
            value: txValue,
            gas: json.totalGas || 300000,
            priceImpact: 0,
            allowanceTarget: json.routerAddress,
        };
    } catch (err) {
        console.error('[Kyber Legacy] error', err);
        return null;
    }
}
