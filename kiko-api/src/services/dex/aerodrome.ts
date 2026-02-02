/**
 * Aerodrome Direct Swap Service (Base Chain)
 * Direct interaction with Aerodrome Router using Route struct
 * 
 * [Ref]: Aerodrome uses Route[] instead of address[] for path
 */

import { ethers } from 'ethers';
import { callRpc } from '../rpcManager.js';
import { getChainConfig } from '../../config/chainConfig.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import {
    DexQuote,
    SwapParams,
    AERODROME_ROUTER,
    AERODROME_ROUTER_ABI,
    ERC20_ABI,
    DEFAULT_DEADLINE_SECONDS,
    MAX_UINT256
} from './types.js';

const AERODROME_FACTORY = '0x420DD381b31aEf6683db6B902084cB0FFECe40Da';
const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

const aerodromeInterface = new ethers.Interface(AERODROME_ROUTER_ABI);
const erc20Interface = new ethers.Interface(ERC20_ABI);

/**
 * Get Aerodrome swap quote
 * [Logic]: Uses getAmountsOut with Route struct
 */
export async function getAerodromeQuote(
    params: SwapParams,
    chainId: number
): Promise<DexQuote | null> {
    // Aerodrome only on Base
    if (chainId !== 8453) {
        return null;
    }

    try {
        const chainConfig = getChainConfig(chainId);
        const wrappedNative = chainConfig.wrappedNativeAddress;
        const isNativeIn = params.tokenIn.toLowerCase() === ETH_ADDRESS;
        const isNativeOut = params.tokenOut.toLowerCase() === ETH_ADDRESS;

        const routeFrom = isNativeIn ? wrappedNative : params.tokenIn;
        const routeTo = isNativeOut ? wrappedNative : params.tokenOut;

        let bestQuote: DexQuote | null = null;

        // Try volatile pool first, then stable
        for (const stable of [false, true]) {
            try {
                const routes = [{
                    from: routeFrom,
                    to: routeTo,
                    stable: stable,
                    factory: AERODROME_FACTORY
                }];

                const callData = aerodromeInterface.encodeFunctionData('getAmountsOut', [
                    params.amountIn,
                    routes
                ]);

                const result = await callRpc<string>(chainId, 'eth_call', [{
                    to: AERODROME_ROUTER.address,
                    data: callData
                }, 'latest']);

                if (!result || result === '0x' || result.length < 66) {
                    continue;
                }

                const decoded = aerodromeInterface.decodeFunctionResult('getAmountsOut', result);
                const amounts = decoded[0] as bigint[];
                const amountOut = amounts[amounts.length - 1];

                if (amountOut <= BigInt(0)) {
                    continue;
                }

                // Calculate minAmountOut with slippage
                const slippageMultiplier = BigInt(10000 - params.slippageBps);
                const amountOutMin = (amountOut * slippageMultiplier) / BigInt(10000);

                // Build swap calldata
                const deadline = params.deadline || Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_SECONDS;

                const swapCalldata = isNativeIn
                    ? aerodromeInterface.encodeFunctionData('swapExactETHForTokens', [
                        amountOutMin,
                        routes,
                        params.recipient,
                        deadline
                    ])
                    : isNativeOut
                        ? aerodromeInterface.encodeFunctionData('swapExactTokensForETH', [
                            params.amountIn,
                            amountOutMin,
                            routes,
                            params.recipient,
                            deadline
                        ])
                        : aerodromeInterface.encodeFunctionData('swapExactTokensForTokens', [
                            params.amountIn,
                            amountOutMin,
                            routes,
                            params.recipient,
                            deadline
                        ]);

                const poolType = stable ? 'stable' : 'volatile';
                logger.info(LogCode.API_FETCH_SUCCESS, `✅ Aerodrome quote: ${poolType} pool`, {
                    amountOut: amountOut.toString()
                });

                const quote: DexQuote = {
                    dex: `Aerodrome (${poolType})`,
                    router: AERODROME_ROUTER.address,
                    amountOut,
                    amountOutMin,
                    gasEstimate: BigInt(200000), // Aerodrome typical gas
                    calldata: swapCalldata,
                    path: {
                        tokenIn: params.tokenIn,
                        tokenOut: params.tokenOut,
                        stable
                    },
                    priceImpact: 0
                };

                if (!bestQuote || quote.amountOut > bestQuote.amountOut) {
                    bestQuote = quote;
                }
            } catch {
                continue;
            }
        }

        return bestQuote;
    } catch (err: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'Aerodrome quote failed', {
            error: err.message?.substring(0, 100)
        });
        return null;
    }
}

/**
 * Build Aerodrome swap transaction
 */
export async function buildAerodromeSwapTransaction(
    params: SwapParams,
    chainId: number
): Promise<{
    quote: DexQuote;
    approvalTx?: { to: string; data: string };
    swapTx: { to: string; data: string; value: string };
} | null> {
    const quote = await getAerodromeQuote(params, chainId);
    if (!quote) {
        return null;
    }

    const isNativeIn = params.tokenIn.toLowerCase() === ETH_ADDRESS;

    // Check approval
    let needsApproval = !isNativeIn;
    if (!isNativeIn) {
        const allowanceData = erc20Interface.encodeFunctionData('allowance', [params.recipient, quote.router]);
        try {
            const result = await callRpc<string>(chainId, 'eth_call', [{
                to: params.tokenIn,
                data: allowanceData
            }, 'latest']);
            const currentAllowance = BigInt(result || '0x0');
            needsApproval = currentAllowance < params.amountIn;
        } catch {
            needsApproval = true;
        }
    }

    const result: {
        quote: DexQuote;
        approvalTx?: { to: string; data: string };
        swapTx: { to: string; data: string; value: string };
    } = {
        quote,
        swapTx: {
            to: quote.router,
            data: quote.calldata,
            value: isNativeIn ? params.amountIn.toString() : '0x0'
        }
    };

    if (needsApproval) {
        result.approvalTx = {
            to: params.tokenIn,
            data: erc20Interface.encodeFunctionData('approve', [quote.router, MAX_UINT256])
        };
    }

    return result;
}
