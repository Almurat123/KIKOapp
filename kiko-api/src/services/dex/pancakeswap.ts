/**
 * PancakeSwap Direct Swap Service (BSC Chain)
 * Direct interaction with PancakeSwap V3 and V2 Routers
 * 
 * [Ref]: PancakeSwap V3 uses same interface as Uniswap V3
 */

import { ethers } from 'ethers';
import { callRpc } from '../rpcManager.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import {
    DexQuote,
    SwapParams,
    PANCAKE_ROUTERS,
    V3_SWAP_ROUTER_ABI,
    V2_ROUTER_ABI,
    ERC20_ABI,
    V3_FEE_TIERS,
    DEFAULT_DEADLINE_SECONDS,
    MAX_UINT256
} from './types.js';

// PancakeSwap V3 Quoter on BSC
const PANCAKE_QUOTER_V2 = '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997';

const quoterV3Interface = new ethers.Interface([
    'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
]);

const swapRouterInterface = new ethers.Interface(V3_SWAP_ROUTER_ABI);
const v2RouterInterface = new ethers.Interface(V2_ROUTER_ABI);
const erc20Interface = new ethers.Interface(ERC20_ABI);

// PancakeSwap fee tiers (different from Uniswap)
const PANCAKE_FEE_TIERS = [100, 500, 2500, 10000] as const;  // 0.01%, 0.05%, 0.25%, 1%

/**
 * Get PancakeSwap V3 swap quote
 * [Logic]: Uses QuoterV2 to simulate swap
 */
export async function getPancakeV3Quote(
    params: SwapParams,
    chainId: number
): Promise<DexQuote | null> {
    // PancakeSwap V3 only on BSC
    if (chainId !== 56) {
        return null;
    }

    const routerConfig = PANCAKE_ROUTERS.v3;

    try {
        // Try each fee tier
        for (const fee of PANCAKE_FEE_TIERS) {
            try {
                const quoteParams = {
                    tokenIn: params.tokenIn,
                    tokenOut: params.tokenOut,
                    amountIn: params.amountIn,
                    fee: fee,
                    sqrtPriceLimitX96: 0
                };

                const callData = quoterV3Interface.encodeFunctionData('quoteExactInputSingle', [quoteParams]);

                const result = await callRpc<string>(chainId, 'eth_call', [{
                    to: PANCAKE_QUOTER_V2,
                    data: callData
                }, 'latest']);

                if (!result || result === '0x' || result.length < 66) {
                    continue;
                }

                const decoded = quoterV3Interface.decodeFunctionResult('quoteExactInputSingle', result);
                const amountOut = decoded[0] as bigint;
                const gasEstimate = decoded[3] as bigint;

                if (amountOut <= BigInt(0)) {
                    continue;
                }

                // Calculate minAmountOut with slippage
                const slippageMultiplier = BigInt(10000 - params.slippageBps);
                const amountOutMin = (amountOut * slippageMultiplier) / BigInt(10000);

                // Build swap calldata
                const deadline = params.deadline || Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_SECONDS;
                const swapParams = {
                    tokenIn: params.tokenIn,
                    tokenOut: params.tokenOut,
                    fee: fee,
                    recipient: params.recipient,
                    deadline: deadline,
                    amountIn: params.amountIn,
                    amountOutMinimum: amountOutMin,
                    sqrtPriceLimitX96: 0
                };

                const swapCalldata = swapRouterInterface.encodeFunctionData('exactInputSingle', [swapParams]);

                logger.info(LogCode.API_FETCH_SUCCESS, `✅ PancakeSwap V3 quote: ${fee / 10000}% pool`, {
                    amountOut: amountOut.toString(),
                    gasEstimate: gasEstimate.toString()
                });

                return {
                    dex: `PancakeSwap V3 (${fee / 10000}%)`,
                    router: routerConfig.address,
                    amountOut,
                    amountOutMin,
                    gasEstimate: gasEstimate + BigInt(50000),
                    calldata: swapCalldata,
                    path: {
                        tokenIn: params.tokenIn,
                        tokenOut: params.tokenOut,
                        fee
                    },
                    priceImpact: 0
                };
            } catch {
                continue;
            }
        }

        return null;
    } catch (err: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'PancakeSwap V3 quote failed', {
            error: err.message?.substring(0, 100)
        });
        return null;
    }
}

/**
 * Get PancakeSwap V2 swap quote (fallback)
 * [Logic]: Uses getAmountsOut with path array
 */
export async function getPancakeV2Quote(
    params: SwapParams,
    chainId: number
): Promise<DexQuote | null> {
    // PancakeSwap V2 only on BSC
    if (chainId !== 56) {
        return null;
    }

    const routerConfig = PANCAKE_ROUTERS.v2;

    try {
        const path = [params.tokenIn, params.tokenOut];
        const callData = v2RouterInterface.encodeFunctionData('getAmountsOut', [params.amountIn, path]);

        const result = await callRpc<string>(chainId, 'eth_call', [{
            to: routerConfig.address,
            data: callData
        }, 'latest']);

        if (!result || result === '0x' || result.length < 66) {
            return null;
        }

        const decoded = v2RouterInterface.decodeFunctionResult('getAmountsOut', result);
        const amounts = decoded[0] as bigint[];
        const amountOut = amounts[amounts.length - 1];

        if (amountOut <= BigInt(0)) {
            return null;
        }

        // Calculate minAmountOut with slippage
        const slippageMultiplier = BigInt(10000 - params.slippageBps);
        const amountOutMin = (amountOut * slippageMultiplier) / BigInt(10000);

        // Build swap calldata
        const deadline = params.deadline || Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_SECONDS;
        const swapCalldata = v2RouterInterface.encodeFunctionData('swapExactTokensForTokens', [
            params.amountIn,
            amountOutMin,
            path,
            params.recipient,
            deadline
        ]);

        logger.info(LogCode.API_FETCH_SUCCESS, `✅ PancakeSwap V2 quote`, {
            amountOut: amountOut.toString()
        });

        return {
            dex: 'PancakeSwap V2',
            router: routerConfig.address,
            amountOut,
            amountOutMin,
            gasEstimate: BigInt(150000),  // V2 typical gas
            calldata: swapCalldata,
            path: {
                tokenIn: params.tokenIn,
                tokenOut: params.tokenOut
            },
            priceImpact: 0
        };
    } catch (err: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'PancakeSwap V2 quote failed', {
            error: err.message?.substring(0, 100)
        });
        return null;
    }
}

/**
 * Get best PancakeSwap quote (V3 first, then V2)
 */
export async function getPancakeQuote(
    params: SwapParams,
    chainId: number
): Promise<DexQuote | null> {
    // Try V3 first
    const v3Quote = await getPancakeV3Quote(params, chainId);
    if (v3Quote) {
        return v3Quote;
    }

    // Fallback to V2
    return getPancakeV2Quote(params, chainId);
}

/**
 * Build PancakeSwap swap transaction
 */
export async function buildPancakeSwapTransaction(
    params: SwapParams,
    chainId: number
): Promise<{
    quote: DexQuote;
    approvalTx?: { to: string; data: string };
    swapTx: { to: string; data: string; value: string };
} | null> {
    const quote = await getPancakeQuote(params, chainId);
    if (!quote) {
        return null;
    }

    // Check approval
    const allowanceData = erc20Interface.encodeFunctionData('allowance', [params.recipient, quote.router]);
    let needsApproval = true;

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

    const result: {
        quote: DexQuote;
        approvalTx?: { to: string; data: string };
        swapTx: { to: string; data: string; value: string };
    } = {
        quote,
        swapTx: {
            to: quote.router,
            data: quote.calldata,
            value: '0x0'
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
