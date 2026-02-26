/**
 * Uniswap V4 Swap via Universal Router
 * 
 * [Logic]: 使用 Universal Router 执行 V4 池子交易
 * [Ref]: https://docs.uniswap.org/contracts/v4/quickstart/swap
 * 
 * Commands: V4_SWAP (0x10)
 * Actions: SWAP_EXACT_IN_SINGLE (0x06), SETTLE_ALL (0x0c), TAKE_ALL (0x0f)
 */

import { ethers } from 'ethers';
import { V4PoolKey } from './uniswapV4.js';

// Universal Router V4 addresses
export const UNIVERSAL_ROUTER_V4: Record<number, string> = {
    8453: '0x6ff5693b99212da76ad316178a184ab56d299b43', // Base (UniversalRouterV2)
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
    SWEEP: 0x04,             // Sweep token balance to recipient
    PERMIT2_PERMIT: 0x0a,    // Permit2 approval
    WRAP_ETH: 0x0b,          // Wrap ETH to WETH
    UNWRAP_WETH: 0x0c,       // Unwrap WETH to ETH
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const WRAPPED_NATIVE_BY_CHAIN: Record<number, string> = {
    8453: '0x4200000000000000000000000000000000000006',
    1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
};

// V4Router Actions
export const Actions = {
    SWAP_EXACT_IN_SINGLE: 0x06,   // 单池精确输入交换
    SWAP_EXACT_IN: 0x07,          // 多池精确输入交换
    SWAP_EXACT_OUT_SINGLE: 0x08,  // 单池精确输出交换
    SWAP_EXACT_OUT: 0x09,         // 多池精确输出交换
    SETTLE_ALL: 0x0c,             // 结算所有输入代币
    SETTLE: 0x0b,                 // 结算指定代币
    TAKE_ALL: 0x0f,               // [Fix]: 官方值 0x0f，不是 0x0e
    TAKE: 0x0e,                   // [Fix]: 官方值 0x0e，不是 0x0f
};

function isZeroAddress(value: string): boolean {
    return String(value || '').toLowerCase() === ZERO_ADDRESS;
}

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
    recipient: string,
    // [Fix]: 不再通过这里处理 native 转换，调用方应处理 WRAP/UNWRAP
    settleFromRouter: boolean = false,
    hookData: string = '0x',
    settleCurrencyOverride?: string
): { commands: string; inputs: string[] } {
    // Command: V4_SWAP
    const commands = ethers.solidityPacked(['uint8'], [Commands.V4_SWAP]);

    // Actions: SWAP_EXACT_IN_SINGLE + SETTLE(_ALL) + TAKE_ALL
    const actions = ethers.solidityPacked(
        ['uint8', 'uint8', 'uint8'],
        [
            Actions.SWAP_EXACT_IN_SINGLE,
            settleFromRouter ? Actions.SETTLE : Actions.SETTLE_ALL,
            Actions.TAKE_ALL
        ]
    );

    // [Logic]: Clanker 池子是 WETH 池，PoolKey 必须使用 WETH 地址
    // 不要将其替换为 address(0)

    // Param 1: ExactInputSingleParams
    const swapParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['tuple(tuple(address,address,uint24,int24,address),bool,uint128,uint128,bytes)'],
        [[
            [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks],
            zeroForOne,
            amountIn,
            minAmountOut,
            hookData
        ]]
    );

    // Param 2: SETTLE/SETTLE_ALL params
    // [Logic]: 无论是 WETH 还是其他 ERC20，都使用 PoolKey 中的 currency
    // 如果之前执行了 WRAP_ETH，Router 现在持有 WETH，所以需要从 Router 结算
    const currencyIn = (settleCurrencyOverride || (zeroForOne ? poolKey.currency0 : poolKey.currency1)).toLowerCase();
    const settleParams = settleFromRouter
        ? ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256', 'bool'],
            [currencyIn, 0n, false] // OPEN_DELTA: settle full debt from router balance
        )
        : ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256'],
            [currencyIn, amountIn]
        );

    // Param 3: TAKE_ALL params (currency, minAmount)
    const currencyOut = zeroForOne ? poolKey.currency1 : poolKey.currency0;
    const takeParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [currencyOut, minAmountOut]
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

export function encodeV4SwapExactInPath(
    poolKey: V4PoolKey,
    zeroForOne: boolean,
    amountIn: bigint,
    minAmountOut: bigint,
    settleCurrency: string,
    hookData: string = '0x'
): { commands: string; inputs: string[] } {
    const commands = ethers.solidityPacked(['uint8'], [Commands.V4_SWAP]);
    const actions = ethers.solidityPacked(
        ['uint8', 'uint8', 'uint8'],
        [Actions.SWAP_EXACT_IN, Actions.SETTLE_ALL, Actions.TAKE_ALL]
    );

    const currencyIn = settleCurrency.toLowerCase();
    const currencyOut = (zeroForOne ? poolKey.currency1 : poolKey.currency0).toLowerCase();
    const path = [[
        currencyOut,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks,
        hookData
    ]];

    const swapParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['tuple(address,tuple(address,uint24,int24,address,bytes)[],uint256[],uint128,uint128)'],
        [[currencyIn, path, [], amountIn, minAmountOut]]
    );
    const settleParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [currencyIn, amountIn]
    );
    const takeParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [currencyOut, minAmountOut]
    );
    const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes', 'bytes[]'],
        [actions, [swapParams, settleParams, takeParams]]
    );
    return { commands, inputs: [payload] };
}


/**
 * 构建完整的 Universal Router 交易
 * [Logic]: 返回可以直接发送的交易数据
 * [Ref]: https://docs.uniswap.org/contracts/v4/quickstart/swap
 */
export function buildV4SwapTransaction(
    chainId: number,
    poolKey: V4PoolKey,
    zeroForOne: boolean,
    amountIn: bigint,
    minAmountOut: bigint,
    recipient: string,
    deadline: number,
    isNativeIn: boolean = false,   // 输入是否是 Native ETH
    isNativeOut: boolean = false,  // 输出是否是 Native ETH
    hookData: string = '0x',
    options?: {
        usePathSwap?: boolean;
        appendSweepOut?: boolean;
    }
): { to: string; data: string } {
    const router = UNIVERSAL_ROUTER_V4[chainId];
    if (!router) {
        throw new Error(`Unsupported chain for V4 swap: ${chainId}`);
    }

    const currencyIn = zeroForOne ? poolKey.currency0 : poolKey.currency1;
    const wrappedNative = String(WRAPPED_NATIVE_BY_CHAIN[chainId] || '').toLowerCase();
    const shouldWrapNativeIn = isNativeIn
        && Boolean(wrappedNative)
        && String(currencyIn || '').toLowerCase() === wrappedNative;
    const settleCurrencyOverride = isNativeIn && !shouldWrapNativeIn ? ZERO_ADDRESS : undefined;
    const settleCurrency = String(settleCurrencyOverride || currencyIn).toLowerCase();
    const usePathSwap = options?.usePathSwap === true;

    // 1. 获取基础 V4 Swap 命令和输入
    const { commands: v4Commands, inputs: v4Inputs } = usePathSwap
        ? encodeV4SwapExactInPath(
            poolKey,
            zeroForOne,
            amountIn,
            minAmountOut,
            settleCurrency,
            hookData
        )
        : encodeV4SwapExactIn(
            poolKey,
            zeroForOne,
            amountIn,
            minAmountOut,
            recipient,
            shouldWrapNativeIn,
            hookData,
            settleCurrencyOverride
        );

    let finalCommands = v4Commands;
    let finalInputs = v4Inputs;

    // 2. 如果输入是 Native ETH (且池子是 WETH 池，这是目前所有 Clanker 池的情况)
    // 需要先 WRAP_ETH -> Router 这里
    if (shouldWrapNativeIn) {
        // [Ref]: Uniswap Universal Router - Payments.sol wrapETH function
        // recipient = router 让 WETH 留在 Router 中供后续 V4_SWAP 使用
        // amount = CONTRACT_BALANCE (1 << 255) = 使用 Router 当前持有的全部 ETH (即 msg.value)
        const CONTRACT_BALANCE = 1n << 255n; // 特殊值：使用 router 的全部 ETH 余额

        const wrapParams = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256'],
            [router, CONTRACT_BALANCE]
        );

        // 组合 commands: WRAP_ETH (0x0b) + V4_SWAP (0x10)
        finalCommands = ethers.solidityPacked(
            ['uint8', 'bytes'],
            [Commands.WRAP_ETH, v4Commands]
        );

        finalInputs = [wrapParams, ...v4Inputs];
    }

    const currencyOut = (zeroForOne ? poolKey.currency1 : poolKey.currency0).toLowerCase();
    const shouldAppendSweep = options?.appendSweepOut === true && !isNativeOut && !isZeroAddress(currencyOut);
    if (shouldAppendSweep) {
        const sweepParams = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'address', 'uint256'],
            [currencyOut, recipient, 0n]
        );
        finalCommands = ethers.solidityPacked(['bytes', 'uint8'], [finalCommands, Commands.SWEEP]);
        finalInputs = [...finalInputs, sweepParams];
    }

    // 3. 如果输出需要 unwrapped native (暂略，如果 future 需要支持则在这里添加 UNWRAP_WETH)

    // Universal Router execute(bytes commands, bytes[] inputs, uint256 deadline)
    const routerInterface = new ethers.Interface([
        'function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable'
    ]);

    const data = routerInterface.encodeFunctionData('execute', [
        finalCommands,
        finalInputs,
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
