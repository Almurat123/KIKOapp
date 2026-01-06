import { AppError } from '../middleware/errorHandler.js';

// Per latest docs: https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/aggregator-api-specification/evm-swaps
// Latest endpoints:
// GET  https://aggregator-api.kyberswap.com/{chain}/api/v1/routes
// POST https://aggregator-api.kyberswap.com/{chain}/api/v1/route/build

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

    const routesRes = await fetch(routesUrl, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'x-client-id': CLIENT_ID,
        },
    });

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
    };

    // route is optional; include when available
    if (routePath && (!Array.isArray(routePath) || routePath.length > 0)) {
        buildBody.route = routeDetail?.route ? routeDetail : { route: routePath };
    }

    console.log('[Kyber] POST build', {
        buildUrl,
        hasRouteSummary: !!routeSummary,
        hasRoute: !!buildBody.route,
    });

    const buildRes = await fetch(buildUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-client-id': CLIENT_ID,
        },
        body: JSON.stringify(buildBody),
    });

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

    console.log('[Kyber] build response', {
        status: buildRes.status,
        dataKeys: buildJson?.data ? Object.keys(buildJson.data) : [],
        rootKeys: buildJson ? Object.keys(buildJson) : [],
    });

    const buildData = buildJson?.data;
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

    const tx = {
        data: encoded,
        routerAddress: routerAddr,
        to: routerAddr,
        value: txValue,
        gas: buildData?.gas,
        allowanceTarget: routerAddr,
    };

    const amountOut =
        routeSummary?.amountOut ||
        routeDetail?.amountOut ||
        routeDetail?.outputAmount ||
        '0';

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
