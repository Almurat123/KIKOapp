/**
 * Uniswap V3 Direct Swap Service
 * Direct interaction with V3 SwapRouter - no 0x/Kyber dependency
 * 
 * [Ref]: https://github.com/Uniswap/v3-periphery/blob/main/contracts/SwapRouter.sol
 */

import { ethers } from 'ethers';
import { callRpc as callRpcRaw } from '../rpcManager.js';
import { getChainConfig } from '../../config/chainConfig.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import {
    DexQuote,
    SwapParams,
    SwapResult,
    V3_SWAP_ROUTERS,
    V3_SWAP_ROUTER_ABI,
    V3_FEE_TIERS,
    ERC20_ABI,
    DEFAULT_DEADLINE_SECONDS,
    MAX_UINT256
} from './types.js';
import { TRADE_QUOTE_PROFILE } from '../rpc/profile.js';

// V3 Quoter for getting quotes (same as in onChainPriceService)
const QUOTER_V2_ADDRESSES: Record<number, string> = {
    1: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    8453: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
    42161: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    10: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    137: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
};

const quoterV2Interface = new ethers.Interface([
    'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
]);

const swapRouterInterface = new ethers.Interface(V3_SWAP_ROUTER_ABI);
const erc20Interface = new ethers.Interface(ERC20_ABI);

async function callRpc<T = any>(chainId: number, method: string, params: any): Promise<T> {
    return callRpcRaw<T>(chainId, method, params, {
        strategy: TRADE_QUOTE_PROFILE.strategy,
        importance: TRADE_QUOTE_PROFILE.importance,
        purpose: TRADE_QUOTE_PROFILE.purpose,
        exhaustiveFailover: true
    });
}

/**
 * Get V3 swap quote - returns expected output amount
 * [Logic]: Uses QuoterV2 to simulate swap without execution
 */
export async function getV3Quote(
    params: SwapParams,
    chainId: number
): Promise<DexQuote | null> {
    const quoterAddress = QUOTER_V2_ADDRESSES[chainId];
    const routerConfig = V3_SWAP_ROUTERS[chainId];

    if (!quoterAddress || !routerConfig) {
        logger.debug(LogCode.API_FETCH_FAILED, 'V3 not supported on chain', { chainId });
        return null;
    }

    try {
        // Try each fee tier
        for (const fee of V3_FEE_TIERS) {
            try {
                const quoteParams = {
                    tokenIn: params.tokenIn,
                    tokenOut: params.tokenOut,
                    amountIn: params.amountIn,
                    fee: fee,
                    sqrtPriceLimitX96: 0
                };

                const callData = quoterV2Interface.encodeFunctionData('quoteExactInputSingle', [quoteParams]);

                const result = await callRpc<string>(chainId, 'eth_call', [{
                    to: quoterAddress,
                    data: callData
                }, 'latest']);

                if (!result || result === '0x' || result.length < 66) {
                    continue;
                }

                const decoded = quoterV2Interface.decodeFunctionResult('quoteExactInputSingle', result);
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

                // Calculate price impact
                // [Risk]: This is approximate, actual impact depends on pool state
                const priceImpact = 0; // TODO: Calculate from sqrtPriceX96After

                logger.info(LogCode.API_FETCH_SUCCESS, `✅ V3 quote: ${fee / 10000}% pool`, {
                    amountOut: amountOut.toString(),
                    gasEstimate: gasEstimate.toString()
                });

                return {
                    dex: `Uniswap V3 (${fee / 10000}%)`,
                    router: routerConfig.address,
                    amountOut,
                    amountOutMin,
                    gasEstimate: gasEstimate + BigInt(50000), // Add buffer for approval check
                    calldata: swapCalldata,
                    path: {
                        tokenIn: params.tokenIn,
                        tokenOut: params.tokenOut,
                        fee
                    },
                    priceImpact
                };
            } catch {
                // Try next fee tier
                continue;
            }
        }

        return null;
    } catch (err: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'V3 quote failed', {
            error: err.message?.substring(0, 100)
        });
        return null;
    }
}

/**
 * Check and ensure token approval for router
 * [Logic]: Returns approval tx if needed, null if already approved
 */
export async function ensureApproval(
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string,
    amount: bigint,
    chainId: number
): Promise<{ needed: boolean; txData?: string }> {
    try {
        // Check current allowance
        const allowanceData = erc20Interface.encodeFunctionData('allowance', [ownerAddress, spenderAddress]);
        const result = await callRpc<string>(chainId, 'eth_call', [{
            to: tokenAddress,
            data: allowanceData
        }, 'latest']);

        const currentAllowance = BigInt(result || '0x0');

        if (currentAllowance >= amount) {
            return { needed: false };
        }

        // Build approval tx
        const approveData = erc20Interface.encodeFunctionData('approve', [spenderAddress, MAX_UINT256]);

        return {
            needed: true,
            txData: approveData
        };
    } catch (err: any) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Approval check failed', { error: err.message });
        // Assume approval needed if check fails
        const approveData = erc20Interface.encodeFunctionData('approve', [spenderAddress, MAX_UINT256]);
        return { needed: true, txData: approveData };
    }
}

/**
 * Build complete swap transaction
 * [Logic]: Combines quote + approval check into ready-to-sign transaction
 */
export async function buildV3SwapTransaction(
    params: SwapParams,
    chainId: number
): Promise<{
    quote: DexQuote;
    approvalTx?: { to: string; data: string };
    swapTx: { to: string; data: string; value: string };
} | null> {
    const quote = await getV3Quote(params, chainId);
    if (!quote) {
        return null;
    }

    // Check approval
    const approval = await ensureApproval(
        params.tokenIn,
        params.recipient,
        quote.router,
        params.amountIn,
        chainId
    );

    const result: {
        quote: DexQuote;
        approvalTx?: { to: string; data: string };
        swapTx: { to: string; data: string; value: string };
    } = {
        quote,
        swapTx: {
            to: quote.router,
            data: quote.calldata,
            value: '0x0'  // No ETH value for token swaps
        }
    };

    if (approval.needed && approval.txData) {
        result.approvalTx = {
            to: params.tokenIn,
            data: approval.txData
        };
    }

    return result;
}

/**
 * Get the best V3 quote across all fee tiers
 * [Logic]: Already handled in getV3Quote, this is for API compatibility
 */
export async function getBestV3Quote(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    recipient: string,
    slippageBps: number,
    chainId: number
): Promise<DexQuote | null> {
    return getV3Quote({
        tokenIn,
        tokenOut,
        amountIn,
        recipient,
        slippageBps
    }, chainId);
}
