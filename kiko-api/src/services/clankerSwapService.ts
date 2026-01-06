/**
 * Clanker Swap Service - Native Uniswap V4 Swaps for Clanker Tokens
 * 
 * Implements direct swaps via Universal Router V4_SWAP command.
 */

import {
    createPublicClient,
    http,
    parseEther,
    encodeAbiParameters,
    parseAbiParameters,
    type Address,
    encodeFunctionData,
    parseAbi,
    concatHex,
    toHex,
    keccak256,
    toBytes
} from 'viem';
import { base } from 'viem/chains';
import { sendTransaction, isPrivyConfigured } from './privyWallet.js';
import { getChainConfig } from '../config/chainConfig.js';

// Addresses on Base
const UNISWAP_V4_POOL_MANAGER = '0x498581ff718922c3f8e6a244956af099b2652b2b';
const UNIVERSAL_ROUTER = '0x6fF5693b99212Da76ad316178A184AB56D299b43';
const WETH = '0x4200000000000000000000000000000000000006';
const CHAIN_ID = 8453;

// Clanker V4 Hooks - Official deployed addresses on Base (from docs)
// https://clanker.gitbook.io/clanker-documentation/references/deployed-contracts
const CLANKER_HOOKS = {
    // V1 hooks
    STATIC: '0xDd5EeaFf7BD481AD55Db083062b13a3cdf0A68CC',
    DYNAMIC: '0x34a45c6B61876d739400Bd71228CbcbD4F53E8cC',
    // V2 hooks (current default)
    STATIC_V2: '0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC',
    DYNAMIC_V2: '0xd60D6B218116cFd801E28F78d011a203D2b068Cc',
};

// Command bytes for Universal Router
const V4_SWAP = 0x10;

// Action bytes for V4_SWAP
const SWAP_EXACT_IN_SINGLE = 0x06;
const SETTLE_ALL = 0x0C;
const TAKE_ALL = 0x0F;

// MIN_SQRT_RATIO + 1 (for zeroForOne = true)
const MIN_SQRT_RATIO_PLUS_ONE = BigInt('4295128740');
// MAX_SQRT_RATIO - 1 (for zeroForOne = false)
const MAX_SQRT_RATIO_MINUS_ONE = BigInt('1461446703485210103287273052203988822378723970341');

export interface ClankerSwapResult {
    success: boolean;
    txHash?: string;
    error?: string;
}

export interface ClankerSwapParams {
    userId: string;
    accessToken: string;
    walletAddress: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string; // Readable string (e.g. "0.01")
    slippage?: number;
    chainId?: number;
}

// Helper to sort tokens for V4 PoolKey
function getPoolKey(tokenA: string, tokenB: string, fee: number, tickSpacing: number, hooks: string) {
    const sorted = tokenA.toLowerCase() < tokenB.toLowerCase();
    return {
        currency0: (sorted ? tokenA : tokenB) as Address,
        currency1: (sorted ? tokenB : tokenA) as Address,
        fee: fee,
        tickSpacing: tickSpacing,
        hooks: hooks as Address
    };
}

// Universal Router ABI (execute function)
const UNIVERSAL_ROUTER_ABI = parseAbi([
    'function execute(bytes commands, bytes[] inputs, uint256 deadline) external payable'
]);

export class ClankerSwapService {

    /**
     * Fast swap for Clanker tokens (ETH -> Token or Token -> ETH)
     */
    /**
     * Fast swap for Clanker tokens (ETH -> Token or Token -> ETH)
     */
    async fastSwap(params: {
        userId: string;
        accessToken: string;
        walletAddress: string;
        tokenOut: string; // For BUY: Token address. For SELL: ETH (address 0)
        tokenIn?: string; // For BUY: ETH (address 0). For SELL: Token address
        amountIn: string;
        slippage?: number;
    }): Promise<string> {
        console.log(`[ClankerService] ⚡ Executing FastSwap...`);

        if (!isPrivyConfigured()) {
            throw new Error('Privy not configured');
        }

        // Clanker V4 pools are paired with WETH, not native ETH (address 0)
        // We use WETH in PoolKey but send ETH as msg.value
        const isBuy = !params.tokenIn || params.tokenIn.toLowerCase() === WETH.toLowerCase() || params.tokenIn === '0x0000000000000000000000000000000000000000';
        const tokenIn = isBuy ? WETH : params.tokenIn!;  // Use WETH for buy, not address(0)
        const tokenOut = isBuy ? params.tokenOut : WETH;  // Sell outputs WETH

        console.log(`[ClankerService] ${isBuy ? 'BUY' : 'SELL'}: ${tokenIn} -> ${tokenOut}`);

        const amountInWei = parseEther(params.amountIn);
        // amountOutMin = 0 for now (slippage handled by router or ideally calculated here)
        const amountOutMin = BigInt(0);

        // Construct PoolKey - Clanker V4 pool
        // Found via brute-force match with PoolID 0x3f04... on-chain:
        const DYNAMIC_FEE_FLAG = 0x800000; // 8388608
        const poolKey = getPoolKey(tokenIn, tokenOut, DYNAMIC_FEE_FLAG, 200, CLANKER_HOOKS.STATIC_V2);
        const zeroForOne = tokenIn.toLowerCase() === poolKey.currency0.toLowerCase();

        // Actions: SETTLE_ALL (0x0C), SWAP_EXACT_IN_SINGLE (0x06), TAKE_ALL (0x0F)
        // Note: SETTLE before SWAP is more traditional in Uniswap V4 to ensure funds are with PoolManager
        const actions = concatHex([
            toHex(SETTLE_ALL, { size: 1 }),
            toHex(SWAP_EXACT_IN_SINGLE, { size: 1 }),
            toHex(TAKE_ALL, { size: 1 })
        ]);

        // Encode params for each action in the same order as actions
        const actionParams: `0x${string}`[] = [
            // 1. SETTLE_ALL params: (currency, maxAmount)
            encodeAbiParameters(
                parseAbiParameters('address,uint256'),
                [tokenIn as Address, amountInWei]
            ),
            // 2. SWAP_EXACT_IN_SINGLE params: (PoolKey, zeroForOne, amountIn, amountOutMinimum, hookData)
            encodeAbiParameters(
                parseAbiParameters('(address,address,uint24,int24,address),bool,uint128,uint128,bytes'),
                [
                    [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks],
                    zeroForOne,
                    amountInWei,
                    amountOutMin,
                    '0x' // No hook data
                ]
            ),
            // 3. TAKE_ALL params: (currency, minAmount)
            encodeAbiParameters(
                parseAbiParameters('address,uint256'),
                [tokenOut as Address, amountOutMin]
            )
        ];

        // Encode Universal Router commands
        // If it's a buy with ETH, we MUST wrap ETH to WETH first
        const WRAP_ETH = 0x0b;
        const ADDRESS_THIS = '0x0000000000000000000000000000000000000002';

        let commands: string;
        let inputs: `0x${string}`[];

        const v4SwapInput = encodeAbiParameters(
            parseAbiParameters('bytes,bytes[]'),
            [actions, actionParams]
        );

        if (isBuy) {
            commands = concatHex([
                toHex(WRAP_ETH, { size: 1 }),
                toHex(V4_SWAP, { size: 1 })
            ]);
            inputs = [
                encodeAbiParameters(
                    parseAbiParameters('address,uint256'),
                    [ADDRESS_THIS as Address, amountInWei]
                ),
                v4SwapInput
            ];
        } else {
            commands = toHex(V4_SWAP, { size: 1 });
            inputs = [v4SwapInput];
        }

        // Deadline: 20 minutes from now
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

        // Encode full transaction
        const txData = encodeFunctionData({
            abi: UNIVERSAL_ROUTER_ABI,
            functionName: 'execute',
            args: [commands as `0x${string}`, inputs, deadline]
        });

        // Prepare transaction
        const tx = {
            to: UNIVERSAL_ROUTER,
            data: txData,
            value: isBuy ? amountInWei.toString() : '0', // Send ETH only if buying
            chainId: CHAIN_ID,
        };

        console.log(`[ClankerService] Sending tx to Universal Router...`);

        // Execute via Privy
        const txHash = await sendTransaction(params.userId, params.accessToken, tx);

        console.log(`[ClankerService] ✅ Swap Success! Hash: ${txHash}`);
        return txHash;
    }
}

export const clankerSwapService = new ClankerSwapService();
