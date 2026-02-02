/**
 * Uniswap V4 Swap via Universal Router
 * 
 * [Logic]: 使用 Universal Router 执行 V4 池子交易
 * [Ref]: https://docs.uniswap.org/contracts/v4/quickstart/swap
 * 
 * Commands: V4_SWAP (0x10)
 * Actions: SWAP_EXACT_IN_SINGLE (0x06), SETTLE_ALL (0x0c), TAKE_ALL (0x0d)
 */

import { ethers } from 'ethers';
import { V4PoolKey } from './uniswapV4.js';

// Universal Router V4 addresses
export const UNIVERSAL_ROUTER_V4: Record<number, string> = {
    8453: '0xa51afafe0263b40edaef0df8781ea9aa03e381a3', // Base
    1: '0x66a9893cc07d91d95644aedd05d03f95e1dba8af'     // Ethereum (需验证)
};

// Permit2 addresses
export const PERMIT2: Record<number, string> = {
    8453: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    1: '0x000000000022D473030F116dDEE9F6B43aC78BA3'
};

// Universal Router Commands
export const Commands = {
    V4_SWAP: 0x10,           // V4 swap command
    PERMIT2_PERMIT: 0x0a,    // Permit2 approval
    WRAP_ETH: 0x0b,          // Wrap ETH to WETH
    UNWRAP_WETH: 0x0c,       // Unwrap WETH to ETH
};

// V4Router Actions
export const Actions = {
    SWAP_EXACT_IN_SINGLE: 0x06,   // 单池精确输入交换
    SWAP_EXACT_IN: 0x07,          // 多池精确输入交换
    SWAP_EXACT_OUT_SINGLE: 0x08,  // 单池精确输出交换
    SWAP_EXACT_OUT: 0x09,         // 多池精确输出交换
    SETTLE_ALL: 0x0c,             // 结算所有输入代币
    SETTLE: 0x0d,                 // 结算指定代币
    TAKE_ALL: 0x0e,               // 取出所有输出代币
    TAKE: 0x0f,                   // 取出指定代币
};

// ExactInputSingleParams struct
export interface ExactInputSingleParams {
    poolKey: V4PoolKey;
    zeroForOne: boolean;      // true = token0 -> token1
    amountIn: bigint;
    amountOutMinimum: bigint;
    hookData: string;         // 通常为 "0x"
}

/**
 * 编码 V4 swap 命令
 * [Logic]: 构建 Universal Router 需要的 commands 和 inputs
 */
export function encodeV4SwapExactIn(
    poolKey: V4PoolKey,
    zeroForOne: boolean,
    amountIn: bigint,
    minAmountOut: bigint,
    recipient: string
): { commands: string; inputs: string[] } {
    // Command: V4_SWAP
    const commands = ethers.solidityPacked(['uint8'], [Commands.V4_SWAP]);

    // Actions: SWAP_EXACT_IN_SINGLE + SETTLE_ALL + TAKE_ALL
    const actions = ethers.solidityPacked(
        ['uint8', 'uint8', 'uint8'],
        [Actions.SWAP_EXACT_IN_SINGLE, Actions.SETTLE_ALL, Actions.TAKE_ALL]
    );

    // Encode PoolKey
    const poolKeyEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'address', 'uint24', 'int24', 'address'],
        [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
    );

    // Param 1: ExactInputSingleParams
    const swapParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['tuple(tuple(address,address,uint24,int24,address),bool,uint128,uint128,bytes)'],
        [[
            [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks],
            zeroForOne,
            amountIn,
            minAmountOut,
            '0x' // hookData
        ]]
    );

    // Param 2: SETTLE_ALL params (currency, amount)
    const currency0 = zeroForOne ? poolKey.currency0 : poolKey.currency1;
    const settleParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [currency0, amountIn]
    );

    // Param 3: TAKE_ALL params (currency, minAmount)
    const currency1 = zeroForOne ? poolKey.currency1 : poolKey.currency0;
    const takeParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [currency1, minAmountOut]
    );

    // Combine actions and params
    const paramsArray = [swapParams, settleParams, takeParams];
    const combinedInput = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes', 'bytes[]'],
        [actions, paramsArray]
    );

    return {
        commands,
        inputs: [combinedInput]
    };
}

/**
 * 构建完整的 Universal Router 交易
 * [Logic]: 返回可以直接发送的交易数据
 */
export function buildV4SwapTransaction(
    chainId: number,
    poolKey: V4PoolKey,
    zeroForOne: boolean,
    amountIn: bigint,
    minAmountOut: bigint,
    recipient: string,
    deadline: number
): { to: string; data: string } {
    const router = UNIVERSAL_ROUTER_V4[chainId];
    if (!router) {
        throw new Error(`Unsupported chain for V4 swap: ${chainId}`);
    }

    const { commands, inputs } = encodeV4SwapExactIn(
        poolKey,
        zeroForOne,
        amountIn,
        minAmountOut,
        recipient
    );

    // Universal Router execute(bytes commands, bytes[] inputs, uint256 deadline)
    const routerInterface = new ethers.Interface([
        'function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable'
    ]);

    const data = routerInterface.encodeFunctionData('execute', [
        commands,
        inputs,
        deadline
    ]);

    return { to: router, data };
}

/**
 * 检查是否支持 V4 swap
 */
export function isV4SwapSupported(chainId: number): boolean {
    return chainId in UNIVERSAL_ROUTER_V4;
}
