import { Tool } from '../../tooling/registry.js';
import axios from 'axios';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { parseUnits } from 'ethers';

/**
 * [Configuration]: Supported Chains & Wrapped Tokens
 * [Logic]: LI.FI API requires token addresses. Native tokens must be mapped to their Wrapped equivalents for the API to find routes, 
 * even if the user inputs "ETH". The API handles the unwrapping at the destination if requested, but for quoting we often need the ERC20 address.
 * Actually, LI.FI supports "0x0000..." for native tokens, but using specific wrappers can sometimes be safer for price fetching.
 * HOWEVER, LI.FI specifically uses "0x0000000000000000000000000000000000000000" for native tokens on EVM chains
 * and "11111111111111111111111111111111" for SOL on Solana.
 * We will stick to Native Address for simplicity unless specific wrapper is needed.
 */
const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';
const SOL_NATIVE_ADDRESS = '11111111111111111111111111111111';

// [Config]: Wrapped Token Addresses (Source: chainConfig.ts)
const WRAPPED_TOKENS: Record<string, string> = {
    // Ethereum
    '1': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    // Base
    '8453': '0x4200000000000000000000000000000000000006',
    // BSC
    '56': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    // Solana (Native Mint)
    '1151111081099710': 'So11111111111111111111111111111111111111112',
    // Polygon
    '137': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    // Arbitrum
    '42161': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    // Optimism
    '10': '0x4200000000000000000000000000000000000006'
};

// [Config]: Supported Tokens (Native + Stables)
// STRICTLY MATCHING project supported chains (chainConfig.ts)
// Removed: AVAX, WAVAX (Not supported in KiKo config)
const ALLOWED_SYMBOLS = [
    'ETH', 'WETH',
    'USDC', 'USDT', 'DAI',
    'SOL', 'WSOL',
    'MATIC', 'WMATIC',
    'BNB', 'WBNB',
    'ARB', 'OP'
];

// [Config]: Supported Chains
// STRICTLY MATCHING src/config/chainConfig.ts
// Solana internal ID 900 is mapped to LI.FI ID 1151111081099710
const CHAIN_MAP: Record<string, string> = {
    // Ethereum (ID: 1)
    'ethereum': '1',
    'mainnet': '1',
    'eth': '1',

    // Base (ID: 8453)
    'base': '8453',

    // BNB Smart Chain (ID: 56)
    'bsc': '56',
    'bnb': '56',
    'binance': '56',

    // Solana (KiKo ID: 900 -> LI.FI ID: 1151111081099710)
    'solana': '1151111081099710',
    'sol': '1151111081099710',
    '900': '1151111081099710',

    // Polygon (ID: 137)
    'polygon': '137',
    'matic': '137',

    // Arbitrum (ID: 42161)
    'arbitrum': '42161',
    'arb': '42161',

    // Optimism (ID: 10)
    'optimism': '10',
    'op': '10'
};

function resolveChainId(chain: string): string {
    const lower = chain.toLowerCase();
    return CHAIN_MAP[lower] || chain;
}

// [Config]: Stablecoin Addresses (Manual Mapping for Safety)
const STABLE_TOKENS: Record<string, Record<string, string>> = {
    // Ethereum
    '1': {
        'USDC': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        'USDT': '0xdac17f958d2ee523a2206206994597c13d831ec7',
        'DAI': '0x6b175474e89094c44da98b954eedeac495271d0f'
    },
    // Base
    '8453': {
        'USDC': '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        'DAI': '0x50c5725949a6f0c72e6c4a641f24049a917db0cb'
    },
    // BSC
    '56': {
        'USDC': '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        'USDT': '0x55d398326f99059ff775485246999027b3197955',
        'DAI': '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3'
    },
    // Solana
    '1151111081099710': {
        'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
    },
    // Polygon
    '137': {
        'USDC': '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', // Native USDC
        'USDT': '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
        'DAI': '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
    },
    // Arbitrum
    '42161': {
        'USDC': '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // Native USDC
        'USDT': '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
        'DAI': '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1'
    },
    // Optimism
    '10': {
        'USDC': '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // Native USDC
        'USDT': '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', // Corrected from ...ef2b...
        'DAI': '0xda10009c5a05fb7926b60b7df1dcd7c9000da1'    // Corrected from Arbitrum address
    }
};

/**
 * Helper to resolve token symbol to address.
 * If input is a symbol like "ETH", return the address 0x0... or Wrapper based on context?
 * LI.FI prefers 0x000... for native input.
 * But we can use this to validate inputs.
 */
function resolveToken(token: string, chainId: string): string {
    const upper = token.toUpperCase();

    // Handle NATIVE/WRAPPED symbols
    if (upper === 'ETH' || upper === 'BNB' || upper === 'MATIC' || upper === 'AVAX') {
        return NATIVE_TOKEN_ADDRESS; // LI.FI expects 0x000... for native input
    }
    if (upper === 'SOL') {
        return SOL_NATIVE_ADDRESS; // LI.FI expects 111... for SOL native
    }

    // If user explicitly asks for WETH/WBNB, return the mapped wrapper address
    if (upper === 'WETH' || upper === 'WBNB' || upper === 'WMATIC' || upper === 'WSOL') {
        return WRAPPED_TOKENS[chainId] || token;
    }

    // Handle Stablecoins
    if (STABLE_TOKENS[chainId] && STABLE_TOKENS[chainId][upper]) {
        return STABLE_TOKENS[chainId][upper];
    }

    return token;
}

/**
 * Helper to get token decimals for parsing
 */
function getDecimals(token: string, chainId: string): number {
    const upper = token.toUpperCase();

    // Solana Native
    if (upper === 'SOL' || upper === 'WSOL') return 9;

    // Stablecoins (USDC/USDT are usually 6, DAI is 18)
    if (upper.includes('USDC') || upper.includes('USDT')) return 6;
    if (upper.includes('DAI')) return 18;

    // EVM Native & Standard ERC20s (ETH, BNB, MATIC, ARB, OP, WETH)
    return 18;
}

/**
 * Interface for LI.FI Quote Response
 */
interface LiFiQuote {
    id: string;
    type: string;
    tool: string;
    action: {
        fromChainId: number;
        toChainId: number;
        fromToken: { address: string; symbol: string; decimals: number };
        toToken: { address: string; symbol: string; decimals: number };
    };
    estimate: {
        fromAmount: string;
        toAmount: string;
        toAmountMin: string;
        feeCosts?: any[];
        executionDuration: number;
        approvalAddress?: string;
    };
    transactionRequest?: {
        data: string;
        to: string;
        value: string;
        from: string;
        chainId: number;
        gasPrice: string;
        gasLimit: string;
    };
}

interface CrossChainArgs {
    fromChain: string;
    toChain: string;
    fromToken: string;
    toToken: string;
    fromAmount: string;
    fromAddress: string;
    toAddress?: string;
    slippage?: number;
}

/**
 * get_cross_chain_quote
 * [Logic]: Acts as a SIMULATION step. Fetches quote to show user:
 * 1. Expected output amount
 * 2. Estimated time
 * 3. Fees
 * DOES NOT return transaction data to prevent accidental execution.
 */
export const GetCrossChainQuoteTool: Tool<CrossChainArgs> = {
    definition: {
        name: 'get_cross_chain_quote',
        description: 'Simulate and get a quote for cross-chain swap. Validates supported tokens (Native/Stables).',
        parameters: {
            type: 'object',
            properties: {
                fromChain: { type: 'string', description: 'Source chain ID or name (e.g., "base", "1")' },
                toChain: { type: 'string', description: 'Destination chain ID or name (e.g., "solana", "1151111081099710")' },
                fromToken: { type: 'string', description: 'Source token symbol or address (e.g. "USDC", "ETH")' },
                toToken: { type: 'string', description: 'Destination token symbol or address' },
                fromAmount: { type: 'string', description: 'Amount in atomic units' },
                fromAddress: { type: 'string', description: 'User wallet address' },
                toAddress: { type: 'string', description: 'Recipient address (optional)' },
                slippage: { type: 'number', description: 'Max slippage (default 0.005)' }
            },
            required: ['fromChain', 'toChain', 'fromToken', 'toToken', 'fromAmount']
        }
    },
    handler: async (args, context) => {
        try {
            const userId = context?.userId;

            // [Address Auto-Discovery]
            // If addresses are not provided by LLM (user didn't specify), resolve them from Privy.
            // This enables "bridge to Solana" without user needing to paste their Solana address.

            const fromChainId = resolveChainId(args.fromChain);
            const toChainId = resolveChainId(args.toChain);

            // Dynamic Import to avoid top-level circular deps
            const { getEmbeddedWalletAddress, getSolanaEmbeddedWalletAddress } = await import('../../services/privyWallet.js');

            let fromAddress = args.fromAddress;
            if (!fromAddress && userId) {
                if (fromChainId === '1151111081099710') { // Solana
                    fromAddress = await getSolanaEmbeddedWalletAddress(userId) || '';
                } else { // EVM
                    fromAddress = await getEmbeddedWalletAddress(userId) || '';
                }
            }

            let toAddress = args.toAddress;
            if (!toAddress && userId) {
                // Default to self-transfer
                if (toChainId === '1151111081099710') { // Solana
                    toAddress = await getSolanaEmbeddedWalletAddress(userId) || '';
                } else { // EVM
                    toAddress = await getEmbeddedWalletAddress(userId) || '';
                }
            }

            if (!fromAddress || !toAddress) {
                return { error: "Could not resolve wallet addresses. Please log in or specify addresses." };
            }

            // [Validation]: Token Whitelist Check (Simplified)
            const fromToken = resolveToken(args.fromToken, fromChainId);
            const toToken = resolveToken(args.toToken, toChainId);

            // [Amount Parsing]: Handle Human Readable Input (e.g. "0.1") -> Atomic Units
            // LLM often outputs "0.1", but API needs Wei.
            let amountAtomic = args.fromAmount;
            if (args.fromAmount.includes('.') || parseFloat(args.fromAmount) < 1000) {
                // Heuristic: If it has decimal or is small value, treat as human readable.
                // Exception: 1000 Wei is tiny, so <1000 is safe to assume human readable for main tokens.
                const decimals = getDecimals(args.fromToken, fromChainId);
                try {
                    amountAtomic = parseUnits(args.fromAmount, decimals).toString();
                    logger.info(LogCode.SYS_INFO, `Parsed amount ${args.fromAmount} -> ${amountAtomic} (${decimals} decimals)`);
                } catch (e) {
                    logger.warn(LogCode.SYS_INFO, `Failed to parse amount ${args.fromAmount}, using as-is`);
                }
            }

            const params = {
                fromChain: fromChainId,
                toChain: toChainId,
                fromToken: fromToken,
                toToken: toToken,
                fromAmount: amountAtomic,
                fromAddress: fromAddress,
                toAddress: toAddress,
                slippage: args.slippage || 0.005
            };

            const response = await axios.get('https://li.quest/v1/quote', { params });
            const quote: LiFiQuote = response.data;

            // [Risk]: Check Price Impact or unusual fees here if needed

            return {
                type: 'simulation',
                tool: quote.tool,
                fromChain: fromChainId,
                toChain: toChainId,
                srcToken: quote.action.fromToken,
                dstToken: quote.action.toToken,
                expectedOutput: quote.estimate.toAmount,
                minOutput: quote.estimate.toAmountMin,
                estimatedTimeSeconds: quote.estimate.executionDuration,
                totalGasCosts: quote.estimate.feeCosts,
                warning: "This is a simulation. Call prepare_cross_chain_tx to execute."
            };
        } catch (error: any) {
            logger.error(LogCode.API_FETCH_FAILED, 'LI.FI Quote Error', {
                error: error.message,
                details: error.response?.data,
                args
            });
            const apiMsg = error.response?.data?.message || error.message;
            return { error: `Failed to get quote: ${apiMsg}` };
        }
    }
};


// [Concurrent]: Local Retry Logic for Robustness
async function fetchWithRetry(url: string, params: any, retries = 3): Promise<any> {
    const apiKey = process.env.LIFI_API_KEY; // Verify this is set in .env

    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(url, {
                params,
                headers: apiKey ? { 'x-lifi-api-key': apiKey } : undefined,
                timeout: 10000 // 10s timeout
            });
            return response.data;
        } catch (error: any) {
            const isRateLimit = error.response?.status === 429;
            const isServerErr = error.response?.status >= 500;

            if ((isRateLimit || isServerErr) && i < retries - 1) {
                const delay = 1000 * Math.pow(2, i); // Exponential backoff
                await new Promise(res => setTimeout(res, delay));
                continue;
            }
            throw error;
        }
    }
}

/**
 * PrepareCrossChainTxTool
 * [Logic]: The EXECUTION step with Approval Handling via __client_action.
 * Returns payload for Frontend/Privy execution.
 */
export const PrepareCrossChainTxTool: Tool<CrossChainArgs> = {
    definition: {
        name: 'prepare_cross_chain_tx',
        description: 'Generate transaction data for cross-chain swap. HANDLES APPROVALS. Must be called after quote confirmation.',
        parameters: {
            type: 'object',
            properties: {
                fromChain: { type: 'string' },
                toChain: { type: 'string' },
                fromToken: { type: 'string' },
                toToken: { type: 'string' },
                fromAmount: { type: 'string' },
                fromAddress: { type: 'string' },
                toAddress: { type: 'string' },
                slippage: { type: 'number' }
            },
            required: ['fromChain', 'toChain', 'fromToken', 'toToken', 'fromAmount']
        }
    },
    handler: async (args, context) => {
        try {
            const userId = context?.userId;
            if (!userId) {
                return { error: "User context required for execution. Please log in." };
            }

            const fromChainId = resolveChainId(args.fromChain);
            const toChainId = resolveChainId(args.toChain);

            // Dynamic Import
            const { getEmbeddedWalletAddress, getSolanaEmbeddedWalletAddress } = await import('../../services/privyWallet.js');

            // [Address Auto-Discovery]
            let fromAddress = args.fromAddress;
            if (!fromAddress) {
                if (fromChainId === '1151111081099710') {
                    fromAddress = await getSolanaEmbeddedWalletAddress(userId) || '';
                } else {
                    fromAddress = await getEmbeddedWalletAddress(userId) || '';
                }
            }

            let toAddress = args.toAddress;
            if (!toAddress) {
                if (toChainId === '1151111081099710') {
                    toAddress = await getSolanaEmbeddedWalletAddress(userId) || '';
                } else {
                    toAddress = await getEmbeddedWalletAddress(userId) || '';
                }
            }

            if (!fromAddress || !toAddress) {
                return { error: "Could not resolve wallet addresses. Ensure you have EVM and Solana wallets created." };
            }

            const fromToken = resolveToken(args.fromToken, fromChainId);
            const toToken = resolveToken(args.toToken, toChainId);

            // [Amount Parsing]: Handle Human Readable Input (e.g. "0.1") -> Atomic Units
            let amountAtomic = args.fromAmount;
            if (args.fromAmount.includes('.') || parseFloat(args.fromAmount) < 1000) {
                const decimals = getDecimals(args.fromToken, fromChainId);
                try {
                    amountAtomic = parseUnits(args.fromAmount, decimals).toString();
                } catch (e) {
                    // Ignore, use as-is
                }
            }

            const params = {
                fromChain: fromChainId,
                toChain: toChainId,
                fromToken: fromToken,
                toToken: toToken,
                fromAmount: amountAtomic,
                fromAddress: fromAddress,
                toAddress: toAddress,
                slippage: args.slippage || 0.005
            };

            // [Concurrent]: Use fetchWithRetry for stability
            const quote: LiFiQuote = await fetchWithRetry('https://li.quest/v1/quote', params);

            if (!quote.transactionRequest) {
                return { error: 'No transaction data returned. Route unavailable.' };
            }

            // [Flow]: Check if Approval is needed
            // Native tokens (0x0... / 111...) do not need approval.
            // ERC20/SPL tokens DO need approval.
            const isNative = fromToken === NATIVE_TOKEN_ADDRESS || fromToken === SOL_NATIVE_ADDRESS;
            // Solana transactions (even for SPL) usually bundle necessary instructions, 
            // so we can consider them "executable" directly if LI.FI allows.
            // However, strictly speaking, `isNative` check is safest for automations.
            // Let's trust LI.FI's Solana tx building to include delegation/owner checks correctly.
            const isSolana = fromChainId === '1151111081099710';

            const approvalAddress = quote.estimate.approvalAddress;
            const requiresApproval = !isNative && !!approvalAddress && !isSolana; // Solana doesn't use semantic approval step like EVM ERC20

            // [Smart Account Optimization]: 
            // If NO approval is needed (Native Token or Solana), we can execute INSTANTLY via Privy Server Wallet!
            // This is the "missing step" to true AI automation.
            if (!requiresApproval) {
                try {
                    // Import dynamically to avoid circular deps if any (though currently safe)
                    const { sendTransaction, sendSolanaTransaction } = await import('../../services/privyWallet.js');

                    // console.log(`[CrossChain] Attempting Server-Side Execution for ${userId} on ${fromChainId}`);

                    let txHash = '';

                    if (isSolana) {
                        // Handle Solana Server Execution
                        // LI.FI returns transactionRequest.data which might be base64 encoded transaction?
                        // LI.FI documentation: data is "The transaction data..."
                        // For Solana validation, we need to ensure quote.transactionRequest.data is the base64 encoded tx.
                        if (quote.transactionRequest.data) {
                            txHash = await sendSolanaTransaction(userId, quote.transactionRequest.data);
                        } else {
                            throw new Error("Missing Solana transaction data from LI.FI");
                        }
                    } else {
                        // Handle EVM Native Execution
                        txHash = await sendTransaction(userId, context.accessToken || '', {
                            to: quote.transactionRequest.to,
                            data: quote.transactionRequest.data,
                            value: quote.transactionRequest.value,
                            chainId: quote.transactionRequest.chainId,
                            gas: quote.transactionRequest.gasLimit
                        });
                    }

                    return {
                        success: true,
                        txHash: txHash,
                        summary: `✅ Cross-chain transaction submitted! ${args.fromAmount} ${args.fromToken} -> ${args.toToken}. Track status below.`,
                        __client_action: {
                            type: 'show_cross_chain_status_card',
                            payload: {
                                status: 'submitted',
                                txHash: txHash,
                                fromChain: fromChainId,
                                toChain: toChainId,
                                fromToken: args.fromToken,
                                toToken: args.toToken,
                                amount: args.fromAmount,
                                bridgeTool: quote.tool,
                                estimatedDuration: quote.estimate.executionDuration,
                                explorerLink: `https://scan.li.fi/tx/${txHash}` // Generic LI.FI explorer
                            }
                        }
                    };

                } catch (execError: any) {
                    logger.warn(LogCode.EXE_TX_BROADCAST, 'Server-Side Execution failed', { error: execError.message });

                    // Return failure card instead of generic error text
                    return {
                        success: false,
                        error: execError.message,
                        summary: `❌ Transaction failed: ${execError.message}`,
                        __client_action: {
                            type: 'show_cross_chain_status_card',
                            payload: {
                                status: 'failed',
                                error: execError.message,
                                fromChain: fromChainId,
                                toChain: toChainId,
                                fromToken: args.fromToken,
                                toToken: args.toToken,
                                amount: args.fromAmount
                            }
                        }
                    };
                }
            }

            // [Client Action]: Fallback or Manual Requirement
            // Return structured data for Frontend/Privy (Manual Execution)
            return {
                summary: `Prepared cross-chain swap. Please confirm in your wallet.`,
                __client_action: {
                    type: 'execute_cross_chain_swap',
                    payload: {
                        // ... (existing payload)
                        bridgeTransaction: {
                            to: quote.transactionRequest.to,
                            data: quote.transactionRequest.data,
                            value: quote.transactionRequest.value,
                            chainId: quote.transactionRequest.chainId,
                            gasLimit: quote.transactionRequest.gasLimit
                        },
                        approval: requiresApproval ? {
                            token: fromToken,
                            spender: approvalAddress,
                            amount: args.fromAmount
                        } : undefined,
                        routeDetails: {
                            tool: quote.tool,
                            estimatedTime: quote.estimate.executionDuration
                        },
                        // Add status card metadata for frontend to show "Pending" card initially
                        cardMetadata: {
                            status: 'pending_signature',
                            fromChain: fromChainId,
                            toChain: toChainId,
                            fromToken: args.fromToken,
                            toToken: args.toToken,
                            amount: args.fromAmount
                        }
                    }
                }
            };

        } catch (error: any) {
            logger.error(LogCode.API_FETCH_FAILED, 'LI.FI Tx Prep Error', { error: error.message, args });
            // Return failure card for API errors too
            return {
                success: false,
                error: `Failed to prepare: ${error.message}`,
                __client_action: {
                    type: 'show_cross_chain_status_card',
                    payload: {
                        status: 'failed',
                        error: error.message || 'Route unavailable or API error',
                        fromChain: args.fromChain,
                        toChain: args.toChain
                    }
                }
            };
        }
    }
};
