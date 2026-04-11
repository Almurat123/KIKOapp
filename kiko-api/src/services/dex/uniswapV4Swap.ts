/**
 * CONTEXT MEMORY
 * Updated: 2026-04-11
 * Author: Mina Zhou
 * Reason: DirectSwap 的 v4 交易构建层需要同时跟住 Uniswap 官方最新动作码
 *         和仓库当前启用的执行边界。之前动作表注释过旧，且链路支持范围没有
 *         明确区分“官方已部署”与“仓库当前已启用”。
 * Goal: 保持 Universal Router v4 编码与官方动作码对齐，同时让当前只启用的
 *       交易链路边界可见可解释。
 * Owns: DirectSwap 的 Universal Router v4 命令编码、已启用链路地址表、原生币
 *       wrap/sweep 组合逻辑。
 * Does Not Own: v4 池发现、hook 地址归因、或未知 hook 的执行前探测。
 * Design Language:
 * - 动作码表必须跟官方源码同步，即使当前没有全部使用。
 * - “官方已部署”不等于“当前仓库已启用执行支持”。
 * - native wrap/sweep 只在当前交易构建层处理，不要把它回灌到池键归一化层。
 * Document Provenance:
 * - Source: Uniswap v4 swap quickstart
 * - Kind: official API doc
 * - Retrieved: 2026-04-11
 * - Applied To: Universal Router `V4_SWAP` + `SWAP_EXACT_IN_SINGLE/SETTLE_ALL/TAKE_ALL` 编码顺序
 * - Verification: verified in docs
 * - Source: Uniswap `Actions.sol` and `V4Router.sol`
 * - Kind: official API doc
 * - Retrieved: 2026-04-11
 * - Applied To: action ids and supported router action subset
 * - Verification: verified in code
 * - Source: Uniswap v4 deployments
 * - Kind: official API doc
 * - Retrieved: 2026-04-11
 * - Applied To: currently enabled Universal Router addresses for Ethereum and Base
 * - Verification: verified in docs
 * See also:
 * - /Users/almurat/KiKo/system-journal/INDEX.md
 * - /Users/almurat/KiKo/system-journal/design-language/directswap-v4-hook-provenance.md
 * - /Users/almurat/KiKo/system-journal/owner-map/backend-swap-validation.md
 * - /Users/almurat/KiKo/system-journal/fix-log/2026-04-11-directswap-v4-hook-provenance-audit.md
 * - /Users/almurat/KiKo/system-journal/conflicts.md
 *
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

// Official Universal Router v4 deployments checked against Uniswap docs on 2026-04-11.
const UNIVERSAL_ROUTER_V4_DEPLOYED: Record<number, string> = {
    1: '0x66a9893cc07d91d95644aedd05d03f95e1dba8af',     // Ethereum
    8453: '0x6ff5693b99212da76ad316178a184ab56d299b43', // Base
    56: '0x1906c1d672b88cd1b9ac7593301ca990f94eae07',   // BNB Smart Chain
    42161: '0xa51afafe0263b40edaef0df8781ea9aa03e381a3',// Arbitrum
    10: '0x851116d9223fabed8e56c0e6b8ad0c31d98b3507',   // Optimism
};

// Product enablement boundary for DirectSwap execution.
// A chain being deployed upstream does not automatically mean KiKo should try to
// send live v4 orders there.
const ENABLED_V4_SWAP_CHAINS = [1, 8453] as const;

export const UNIVERSAL_ROUTER_V4: Record<number, string> = Object.fromEntries(
    ENABLED_V4_SWAP_CHAINS.map((chainId) => [chainId, UNIVERSAL_ROUTER_V4_DEPLOYED[chainId]])
) as Record<number, string>;

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

// V4Router Actions from the current official `Actions.sol`.
// DirectSwap only uses a strict subset during swap execution, but the table
// stays complete so future audits can diff against upstream easily.
export const Actions = {
    SWAP_EXACT_IN_SINGLE: 0x06,   // 单池精确输入交换
    SWAP_EXACT_IN: 0x07,          // 多池精确输入交换
    SWAP_EXACT_OUT_SINGLE: 0x08,  // 单池精确输出交换
    SWAP_EXACT_OUT: 0x09,         // 多池精确输出交换
    SETTLE: 0x0b,                 // 结算指定代币
    SETTLE_ALL: 0x0c,             // 结算所有输入代币
    SETTLE_PAIR: 0x0d,            // 结算指定币对
    TAKE: 0x0e,                   // 提取指定代币
    TAKE_ALL: 0x0f,               // [Fix]: 官方值 0x0f，不是 0x0e
    TAKE_PORTION: 0x10,           // 按比例提取余额
    TAKE_PAIR: 0x11,              // 提取指定币对
    CLOSE_CURRENCY: 0x12,         // 关闭单币 delta
    CLEAR_OR_TAKE: 0x13,          // 清理或提取余额
    SWEEP: 0x14,                  // 在 v4 action 层 sweep
    WRAP: 0x15,                   // 在 v4 action 层 wrap
    UNWRAP: 0x16,                 // 在 v4 action 层 unwrap
    MINT_6909: 0x17,              // 铸造 6909 以关闭 delta
    BURN_6909: 0x18,              // 销毁 6909 以关闭 delta
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
    return ENABLED_V4_SWAP_CHAINS.includes(chainId as (typeof ENABLED_V4_SWAP_CHAINS)[number]);
}
