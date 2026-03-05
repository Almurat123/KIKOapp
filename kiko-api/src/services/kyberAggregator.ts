import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { fetchJson } from '../config/unifiedApiService.js';
import { getPlatformFee, isValidEvmAddress, type FeeContext } from './platformFeeService.js';

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
    recipient: string,
    feeContext?: FeeContext | 'copy_trade' | 'launchpad',
    isSell?: boolean,
    signal?: AbortSignal,
    options?: {
        permit?: string;
        deadline?: number;
        disablePlatformFee?: boolean;
    }
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
        origin: recipient,
    });

    const normalizedFeeContext: FeeContext =
        feeContext === 'copy_trade' || feeContext === 'copyTrade' ? 'copyTrade' : 'swap';
    const fee = getPlatformFee(normalizedFeeContext);
    if (!options?.disablePlatformFee && fee.bps > 0 && isValidEvmAddress(fee.evmRecipient)) {
        params.set('feeReceiver', fee.evmRecipient!);
        params.set('feeAmount', String(fee.bps));
        params.set('isInBps', 'true');
        params.set('chargeFeeBy', isSell ? 'currency_out' : 'currency_in');
    }

    const routesUrl = `${KYBER_BASE}/${chainName}/api/v1/routes?${params.toString()}`;
    console.log('[Kyber] GET routes', { routesUrl });

    // Step 1.5: fetch routes using unified fetchJson
    const routesJson = await fetchJson<any>({
        url: routesUrl,
        headers: {
            'Content-Type': 'application/json',
            'x-client-id': CLIENT_ID,
        },
        requestTimeout: 20000,
        retry: { retries: 1 },
        signal
    });

    if (!routesJson) {
        console.error('[Kyber] routes error (null response)');
        return null;
    }

    console.log('[Kyber] routes response', {
        status: 200,
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
    const routerAddress =
        routesJson?.data?.routerAddress ||
        routesJson?.data?.[0]?.routerAddress;

    if (!routeSummary) {
        console.warn('[Kyber] no usable route found (missing summary)', {
            hasSummary: !!routeSummary,
            hasRouterAddress: !!routerAddress,
        });
        return null;
    }

    // Step 2: build transaction
    const buildUrl = `${KYBER_BASE}/${chainName}/api/v1/route/build`;

    // Kyber V1 expects slippageTolerance in bps (10 = 0.1%)
    const slippageToleranceBps = Math.max(1, Math.round(slippageBps));

    // CRITICAL: Kyber API V1 expects EXACT structure per their documentation
    // Missing fields or wrong types cause "unable to bind request body" error
    const buildBody: any = {
        routeSummary: routeSummary, // REQUIRED: Must be exact object from GET /routes
        sender: recipient,          // REQUIRED
        recipient: recipient,       // REQUIRED
        origin: recipient,          // Optional but recommended to avoid rate limits
        slippageTolerance: slippageToleranceBps, // bps number
        deadline: options?.deadline || (Math.floor(Date.now() / 1000) + 600), // Unix timestamp
    };
    if (options?.permit) {
        buildBody.permit = options.permit;
    }

    // Debug: Log the exact structure being sent to help diagnose binding issues
    console.log('[Kyber] Building route/build request body:', {
        hasRouteSummary: !!buildBody.routeSummary,
        routeSummaryKeys: buildBody.routeSummary ? Object.keys(buildBody.routeSummary).slice(0, 8) : [],
        sender: buildBody.sender?.slice(0, 10),
        recipient: buildBody.recipient?.slice(0, 10),
        slippageTolerance: buildBody.slippageTolerance,
        slippageToleranceType: typeof buildBody.slippageTolerance,
        deadline: buildBody.deadline,
        deadlineType: typeof buildBody.deadline,
        allBodyKeys: Object.keys(buildBody),
    });

    logger.debug(LogCode.API_FETCH_SUCCESS, '[Kyber] route/build request', {
        tokenIn: `${tokenIn.slice(0, 6)}...`,
        tokenOut: `${tokenOut.slice(0, 6)}...`,
        amountIn,
        slippage: slippageToleranceBps
    });

    // Add timeout for Kyber build API (10 seconds)
    let buildJson: any = null;
    try {
            buildJson = await fetchJson<any>({
                url: buildUrl,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-client-id': CLIENT_ID,
                },
                body: JSON.stringify(buildBody),
                requestTimeout: 20000,
                retry: { retries: 1 },
                signal
            });
    } catch (buildErr: any) {
        const errMsg = String(buildErr?.message || '');
        const isBindError = errMsg.includes('unable to bind request body') || errMsg.includes('4002');
        if (isBindError) {
            // Retry with minimal body to satisfy strict Kyber binding rules
            const minimalBody: any = {
                routeSummary,
                sender: recipient,
                recipient,
                slippageTolerance: slippageToleranceBps,
                ...(options?.deadline ? { deadline: options.deadline } : {}),
                ...(options?.permit ? { permit: options.permit } : {})
            };
            try {
                buildJson = await fetchJson<any>({
                    url: buildUrl,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-client-id': CLIENT_ID,
                    },
                    body: JSON.stringify(minimalBody),
                    requestTimeout: 20000,
                    retry: { retries: 1 },
                    signal
                });
            } catch (retryErr: any) {
                throw retryErr;
            }
        } else {
            throw buildErr;
        }
    }

    if (!buildJson) {
        console.error('[Kyber] build error (null response)');
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
        routerAddress ||
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

        const json = await fetchJson<any>({
            url,
            headers: {
                'Content-Type': 'application/json',
                'x-client-id': CLIENT_ID,
            }
        });

        if (!json) {
            console.warn('[Kyber Legacy] request failed (null response)');
            return null;
        }



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
