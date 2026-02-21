/**
 * DEX Direct Swap - Type Definitions
 * Types for direct DEX router interactions
 */

// ============ Core Types ============

export interface DexQuote {
    dex: string;                    // DEX name (e.g., 'Uniswap V3', 'Aerodrome')
    router: string;                 // Router contract address
    amountOut: bigint;              // Expected output amount
    amountOutMin: bigint;           // Minimum output (with slippage)
    gasEstimate: bigint;            // Estimated gas cost
    calldata: string;               // Pre-encoded transaction data
    path: SwapPath;                 // Swap path details
    priceImpact: number;            // Price impact percentage
}

export interface SwapPath {
    tokenIn: string;
    tokenOut: string;
    fee?: number;                   // V3 fee tier (500, 3000, 10000)
    stable?: boolean;               // Aerodrome: stable vs volatile pool
    intermediateTokens?: string[];  // For multi-hop routes
}

export interface SwapParams {
    tokenIn: string;
    tokenOut: string;
    amountIn: bigint;
    recipient: string;
    slippageBps: number;            // Slippage in basis points (e.g., 50 = 0.5%)
    deadline?: number;              // Unix timestamp deadline
}

export interface SwapResult {
    success: boolean;
    txHash?: string;
    amountOut?: bigint;
    gasUsed?: bigint;
    error?: string;
}

// ============ Router Configs ============

export interface RouterConfig {
    name: string;
    address: string;
    type: 'v3' | 'v2' | 'aerodrome' | 'universal';
    chainId: number;
}

// V3 SwapRouter addresses
export const V3_SWAP_ROUTERS: Record<number, RouterConfig> = {
    1: {
        name: 'Uniswap V3',
        address: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        type: 'v3',
        chainId: 1
    },
    8453: {
        name: 'Uniswap V3',
        address: '0x2626664c2603336E57B271c5C0b26F421741e481',
        type: 'v3',
        chainId: 8453
    },
    42161: {
        name: 'Uniswap V3',
        address: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        type: 'v3',
        chainId: 42161
    }
};

// Aerodrome Router (Base)
export const AERODROME_ROUTER: RouterConfig = {
    name: 'Aerodrome',
    address: '0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43',
    type: 'aerodrome',
    chainId: 8453
};

// PancakeSwap Routers (BSC)
export const PANCAKE_ROUTERS: Record<string, RouterConfig> = {
    v3: {
        name: 'PancakeSwap V3',
        address: '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
        type: 'v3',
        chainId: 56
    },
    v2: {
        name: 'PancakeSwap V2',
        address: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
        type: 'v2',
        chainId: 56
    }
};

// ============ ABI Fragments ============

// V3 SwapRouter exactInputSingle
export const V3_SWAP_ROUTER_ABI = [
    'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
    'function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)'
];

// V2 Router (SushiSwap, PancakeSwap V2)
export const V2_ROUTER_ABI = [
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) external returns (uint[] amounts)',
    'function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) external payable returns (uint[] amounts)',
    'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) external returns (uint[] amounts)',
    'function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)'
];

// Aerodrome Router (uses Route struct)
export const AERODROME_ROUTER_ABI = [
    'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, (address from, address to, bool stable, address factory)[] routes, address to, uint256 deadline) external returns (uint256[] amounts)',
    'function swapExactETHForTokens(uint256 amountOutMin, (address from, address to, bool stable, address factory)[] routes, address to, uint256 deadline) external payable returns (uint256[] amounts)',
    'function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, (address from, address to, bool stable, address factory)[] routes, address to, uint256 deadline) external returns (uint256[] amounts)',
    'function getAmountsOut(uint256 amountIn, (address from, address to, bool stable, address factory)[] routes) view returns (uint256[] amounts)'
];

// ERC20 Approval
export const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)'
];

// ============ Constants ============

// Uniswap V3 standard enabled fee tiers (in hundredths of a bip):
// 100=0.01%, 500=0.05%, 3000=0.3%, 10000=1%
export const V3_FEE_TIERS = [100, 500, 3000, 10000] as const;
export const DEFAULT_DEADLINE_SECONDS = 1800;  // 30 minutes
export const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
