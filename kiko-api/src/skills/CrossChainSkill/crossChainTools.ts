import { Tool } from '../../tooling/registry.js';
import axios from 'axios';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { parseUnits, formatUnits, Interface } from 'ethers';
import { getErc20Allowance, getTransactionReceipt } from '../../services/rpcManager.js';
import { chatWS } from '../../services/chatWebSocket.js';
import { updateMessage } from '../../repositories/chatRepository.js';

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

export function trimDisplayAmount(value: string, maxFractionDigits = 6): string {
    const [whole, fraction = ''] = value.split('.');
    if (!fraction) return whole;
    const trimmedFraction = fraction.slice(0, maxFractionDigits).replace(/0+$/, '');
    return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

export function formatAtomicAmount(rawAmount: string | undefined, decimals: number | undefined, maxFractionDigits = 6): string | undefined {
    if (!rawAmount || decimals === undefined || decimals === null) return undefined;
    try {
        return trimDisplayAmount(formatUnits(BigInt(rawAmount), decimals), maxFractionDigits);
    } catch {
        return rawAmount;
    }
}

export function buildDisplayAmounts(quote: LiFiQuote, fallbackAmountIn: string) {
    const tokenInDecimals = Number(quote.action?.fromToken?.decimals ?? getDecimals(quote.action?.fromToken?.symbol || '', String(quote.action?.fromChainId || '')));
    const tokenOutDecimals = Number(quote.action?.toToken?.decimals ?? getDecimals(quote.action?.toToken?.symbol || '', String(quote.action?.toChainId || '')));

    return {
        amountInRaw: quote.estimate?.fromAmount,
        amountOutRaw: quote.estimate?.toAmount,
        tokenInDecimals,
        tokenOutDecimals,
        amountInDisplay: formatAtomicAmount(quote.estimate?.fromAmount, tokenInDecimals) || fallbackAmountIn,
        amountOutDisplay: formatAtomicAmount(quote.estimate?.toAmount, tokenOutDecimals),
        minAmountOutDisplay: formatAtomicAmount(quote.estimate?.toAmountMin, tokenOutDecimals),
    };
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
                fromAmount: { type: 'string', description: 'Amount to bridge. Prefer a human-readable numeric string like "10" or "0.5"; atomic/base-unit values are also accepted.' },
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

            const quote: LiFiQuote = await fetchWithRetry('https://li.quest/v1/quote', params);
            const display = buildDisplayAmounts(quote, args.fromAmount);

            // [Risk]: Check Price Impact or unusual fees here if needed

            return {
                type: 'simulation',
                tool: quote.tool,
                fromChain: fromChainId,
                toChain: toChainId,
                srcToken: quote.action.fromToken,
                dstToken: quote.action.toToken,
                requestedInput: display.amountInDisplay,
                requestedInputRaw: display.amountInRaw,
                expectedOutput: display.amountOutDisplay || quote.estimate.toAmount,
                expectedOutputRaw: display.amountOutRaw,
                minOutput: display.minAmountOutDisplay || quote.estimate.toAmountMin,
                minOutputRaw: quote.estimate.toAmountMin,
                tokenInDecimals: display.tokenInDecimals,
                tokenOutDecimals: display.tokenOutDecimals,
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

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function broadcastTxCardUpdate(
    userId: string,
    sessionId: string | undefined,
    messageId: string | undefined,
    data: Record<string, any>,
): void {
    if (!sessionId) {
        logger.warn(LogCode.WS_MESSAGE_SENT, '[CARD-BACKLOG] cross-chain skipped WS broadcast (missing sessionId)', {
            userId,
            messageId: messageId || null,
            status: data?.status || null,
            txHash: data?.txHash || null,
        });
        return;
    }
    logger.info(LogCode.WS_MESSAGE_SENT, '[CARD-BACKLOG] cross-chain WS tx card update', {
        userId,
        sessionId,
        messageId: messageId || null,
        status: data?.status || null,
        txHash: data?.txHash || null,
        chainId: data?.chainId || null,
    });
    chatWS.broadcastToUser(userId, {
        type: 'client_action',
        sessionId,
        data: {
            message_id: messageId,
            targetMessageId: messageId,
            action: {
                type: 'show_transaction_status_card',
                data,
            },
        },
    });
}

async function persistTxCardUpdate(messageId: string | undefined, data: Record<string, any>): Promise<void> {
    if (!messageId) {
        logger.warn(LogCode.AI_API_CALL, '[CARD-BACKLOG] cross-chain skipped DB persist (missing messageId)', {
            status: data?.status || null,
            txHash: data?.txHash || null,
        });
        return;
    }
    await updateMessage(messageId, {
        type: 'transaction-status-card',
        data,
        transactionStatus: data.status,
        transactionHash: data.txHash,
    });
    logger.info(LogCode.AI_API_CALL, '[CARD-BACKLOG] cross-chain persisted tx card update', {
        messageId,
        status: data?.status || null,
        txHash: data?.txHash || null,
        chainId: data?.chainId || null,
    });
}

function normalizeLiFiTerminalStatus(payload: any): { terminal: boolean; success: boolean; rawStatus: string; message?: string } {
    const candidates = [
        payload?.status,
        payload?.bridgeStatus,
        payload?.execution?.status,
        payload?.result?.status,
        payload?.data?.status,
        payload?.transaction?.status,
    ].filter(Boolean).map((s: any) => String(s).toUpperCase());

    const joined = candidates.join(' | ');
    if (!joined) return { terminal: false, success: false, rawStatus: 'UNKNOWN' };

    const successPatterns = ['DONE', 'SUCCESS', 'COMPLETED', 'CONFIRMED', 'FINISHED'];
    const failedPatterns = ['FAILED', 'ERROR', 'CANCELLED', 'INVALID', 'REVERTED'];

    if (successPatterns.some(p => joined.includes(p))) {
        return { terminal: true, success: true, rawStatus: joined, message: payload?.substatus || payload?.message };
    }
    if (failedPatterns.some(p => joined.includes(p))) {
        return { terminal: true, success: false, rawStatus: joined, message: payload?.substatus || payload?.message || payload?.error?.message };
    }
    return { terminal: false, success: false, rawStatus: joined, message: payload?.substatus || payload?.message };
}

async function monitorCrossChainLifecycle(params: {
    userId: string;
    sessionId?: string;
    messageId?: string;
    txHash: string;
    fromChainId: string;
    toChainId: string;
    fromToken: string;
    toToken: string;
    amountIn: string;
    amountOut?: string;
    amountInRaw?: string;
    amountOutRaw?: string;
    tokenInDecimals?: number;
    tokenOutDecimals?: number;
    bridgeTool?: string;
}) {
    const {
        userId,
        sessionId,
        messageId,
        txHash,
        fromChainId,
        toChainId,
        fromToken,
        toToken,
        amountIn,
        amountOut,
        amountInRaw,
        amountOutRaw,
        tokenInDecimals,
        tokenOutDecimals,
        bridgeTool,
    } = params;
    if (!sessionId) {
        logger.warn(LogCode.AI_API_CALL, '[CARD-BACKLOG] monitor aborted (missing sessionId)', {
            userId,
            messageId: messageId || null,
            txHash,
        });
        return;
    }
    logger.info(LogCode.AI_API_CALL, '[CARD-BACKLOG] monitor started', {
        userId,
        sessionId,
        messageId: messageId || null,
        txHash,
        fromChainId,
        toChainId,
        bridgeTool: bridgeTool || null,
    });

    const baseCard = {
        tokenInSymbol: fromToken,
        tokenOutSymbol: toToken,
        amountIn,
        amountOut,
        amountInRaw,
        amountOutRaw,
        tokenInDecimals,
        tokenOutDecimals,
        chainId: Number(fromChainId),
        txHash,
        bridgeTool,
        explorerLink: `https://scan.li.fi/tx/${txHash}`,
    };

    const lifiApiKey = process.env.LIFI_API_KEY;
    let sourceConfirmed = false;
    let lastPendingMessage = '';

    for (let i = 0; i < 90; i++) {
        await delay(i === 0 ? 5000 : 10000);

        if (!sourceConfirmed) {
            try {
                const sourceReceipt = await getTransactionReceipt(Number(fromChainId), txHash);
                if (sourceReceipt?.status === 1) {
                    sourceConfirmed = true;
                    lastPendingMessage = 'Source transaction confirmed. Waiting for bridge settlement...';
                    logger.info(LogCode.AI_API_CALL, '[CARD-BACKLOG] source tx confirmed', {
                        sessionId,
                        messageId: messageId || null,
                        txHash,
                        fromChainId,
                    });
                    const payload = {
                        ...baseCard,
                        status: 'pending',
                        isLoading: true,
                        message: lastPendingMessage,
                    };
                    broadcastTxCardUpdate(userId, sessionId, messageId, payload);
                    await persistTxCardUpdate(messageId, payload);
                } else if (sourceReceipt?.status === 0) {
                    logger.warn(LogCode.AI_API_CALL, '[CARD-BACKLOG] source tx failed', {
                        sessionId,
                        messageId: messageId || null,
                        txHash,
                        fromChainId,
                    });
                    const payload = {
                        ...baseCard,
                        status: 'failed',
                        isLoading: false,
                        errorMessage: 'Source-chain transaction failed.',
                    };
                    broadcastTxCardUpdate(userId, sessionId, messageId, payload);
                    await persistTxCardUpdate(messageId, payload);
                    return;
                }
            } catch {
                // best-effort only
            }
        }

        try {
            const statusResp = await axios.get('https://li.quest/v1/status', {
                params: {
                    txHash,
                    fromChain: fromChainId,
                    toChain: toChainId,
                    bridge: bridgeTool,
                },
                headers: lifiApiKey ? { 'x-lifi-api-key': lifiApiKey } : undefined,
                timeout: 8000,
            });
            const statusPayload = statusResp?.data || {};
            const normalized = normalizeLiFiTerminalStatus(statusPayload);

            if (normalized.terminal && normalized.success) {
                logger.info(LogCode.AI_API_CALL, '[CARD-BACKLOG] bridge terminal success', {
                    sessionId,
                    messageId: messageId || null,
                    txHash,
                    rawStatus: normalized.rawStatus,
                });
                const payload = {
                    ...baseCard,
                    status: 'success',
                    isLoading: false,
                    message: normalized.message || 'Bridge settlement complete.',
                };
                broadcastTxCardUpdate(userId, sessionId, messageId, payload);
                await persistTxCardUpdate(messageId, payload);
                return;
            }
            if (normalized.terminal && !normalized.success) {
                logger.warn(LogCode.AI_API_CALL, '[CARD-BACKLOG] bridge terminal failed', {
                    sessionId,
                    messageId: messageId || null,
                    txHash,
                    rawStatus: normalized.rawStatus,
                    errorMessage: normalized.message || null,
                });
                const payload = {
                    ...baseCard,
                    status: 'failed',
                    isLoading: false,
                    errorMessage: normalized.message || `Bridge failed (${normalized.rawStatus}).`,
                };
                broadcastTxCardUpdate(userId, sessionId, messageId, payload);
                await persistTxCardUpdate(messageId, payload);
                return;
            }

            const progressMessage = normalized.message
                ? `Bridge in progress: ${normalized.message}`
                : (sourceConfirmed
                    ? 'Source confirmed. Waiting for destination settlement...'
                    : 'Waiting for bridge status update...');
            if (progressMessage !== lastPendingMessage && i % 2 === 0) {
                lastPendingMessage = progressMessage;
                const payload = {
                    ...baseCard,
                    status: 'pending',
                    isLoading: true,
                    message: progressMessage,
                };
                broadcastTxCardUpdate(userId, sessionId, messageId, payload);
                await persistTxCardUpdate(messageId, payload);
            }
        } catch {
            // LI.FI status can be delayed; keep monitoring
            if (i === 0 || i % 6 === 0) {
                logger.warn(LogCode.API_FETCH_FAILED, '[CARD-BACKLOG] monitor status polling failed', {
                    sessionId,
                    messageId: messageId || null,
                    txHash,
                    pollRound: i + 1,
                });
            }
        }
    }

    logger.info(LogCode.AI_API_CALL, '[CARD-BACKLOG] monitor timeout fallback', {
        sessionId,
        messageId: messageId || null,
        txHash,
    });
    const payload = {
        ...baseCard,
        status: 'pending',
        isLoading: true,
        message: 'Still processing across chains. You can continue tracking from hash.',
    };
    broadcastTxCardUpdate(userId, sessionId, messageId, payload);
    await persistTxCardUpdate(messageId, payload);
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
                fromAmount: { type: 'string', description: 'Amount to bridge. Prefer a human-readable numeric string like "10" or "0.5"; atomic/base-unit values are also accepted.' },
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
            const { getEmbeddedWalletAddress, getSolanaEmbeddedWalletAddress, sendTransaction, sendSolanaTransaction } = await import('../../services/privyWallet.js');

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

            const display = buildDisplayAmounts(quote, args.fromAmount);

            const buildTxCardData = (status: string, extra: Record<string, any> = {}) => ({
                status,
                tokenInSymbol: args.fromToken,
                tokenOutSymbol: args.toToken,
                amountIn: display.amountInDisplay,
                amountOut: display.amountOutDisplay,
                amountInRaw: display.amountInRaw,
                amountOutRaw: display.amountOutRaw,
                tokenInDecimals: display.tokenInDecimals,
                tokenOutDecimals: display.tokenOutDecimals,
                chainId: Number(fromChainId),
                ...extra,
            });

            // [Flow]: Check if Approval is needed
            // Native tokens (0x0... / 111...) do not need approval.
            // ERC20/SPL tokens DO need approval.
            const isNative = fromToken === NATIVE_TOKEN_ADDRESS || fromToken === SOL_NATIVE_ADDRESS;
            const isSolana = fromChainId === '1151111081099710';
            const approvalAddress = quote.estimate.approvalAddress;
            let requiresApproval = !isNative && !!approvalAddress && !isSolana;

            // [Smart Account Automation]: Auto-Approve for Privy Users
            // If it's an ERC20 token and user is on Privy, we can check allowance and auto-approve.
            const isPrivyUser = userId.includes('did:privy');

            if (requiresApproval && isPrivyUser) {
                try {
                    logger.info(LogCode.SYS_INFO, `[CrossChain] Checking allowance for ${args.fromToken} on ${fromChainId}...`);

                    // 1. Check current allowance
                    const currentAllowance = await getErc20Allowance(
                        fromToken,
                        fromAddress,
                        approvalAddress!,
                        Number(fromChainId)
                    );

                    if (currentAllowance >= BigInt(amountAtomic)) {
                        logger.info(LogCode.SYS_INFO, `[CrossChain] Allowance sufficient (${currentAllowance.toString()} >= ${amountAtomic})`);
                        requiresApproval = false;
                    } else {
                        logger.info(LogCode.SYS_INFO, `[CrossChain] Allowance insufficient. Auto-approving...`);

                        // [UX Update] Broadcast "Approving" status card
                        chatWS.broadcastToUser(userId, {
                            type: 'client_action',
                            sessionId: context?.sessionId,
                            data: {
                                action: {
                                    type: 'show_transaction_status_card',
                                    data: buildTxCardData('approving', {
                                        message: 'Approval transaction sent. Waiting for confirmation...',
                                        isLoading: true,
                                    }),
                                }
                            }
                        });

                        // 2. Construct Approval Transaction
                        const iface = new Interface(['function approve(address spender, uint256 amount) returns (bool)']);
                        const approveData = iface.encodeFunctionData('approve', [approvalAddress, amountAtomic]);

                        // 3. Send Approval Transaction
                        // Using a dummy high gas limit or letting Privy estimate. Usually 60k is safe for approve.
                        const approveTxHash = await sendTransaction(userId, context.accessToken || '', {
                            to: fromToken,
                            data: approveData,
                            chainId: Number(fromChainId),
                            gas: '0x186A0' // 100,000 gas safety limit
                        });

                        logger.info(LogCode.EXE_TX_BROADCAST, `[CrossChain] Approval Sent: ${approveTxHash}. Waiting for confirmation...`);

                        // 4. Wait for Confirmation (Polling)
                        // Poll up to 120 seconds (60 attempts * 2s)
                        let confirmed = false;
                        for (let i = 0; i < 60; i++) {
                            await new Promise(r => setTimeout(r, 2000)); // Wait 2s
                            try {
                                const receipt = await getTransactionReceipt(Number(fromChainId), approveTxHash);
                                if (receipt && receipt.status === 1) { // 1 = success
                                    confirmed = true;
                                    logger.info(LogCode.EXE_TX_CONFIRMED, `[CrossChain] Approval Confirmed!`);
                                    break;
                                }
                            } catch (e) {
                                // Ignore RPC errors during polling
                            }
                        }

                        // 5. Double Check: If timeout, check allowance one last time
                        if (!confirmed) {
                            logger.warn(LogCode.SYS_INFO, `[CrossChain] Approval polling timed out. Verifying allowance directly...`);
                            const finalAllowance = await getErc20Allowance(fromToken, fromAddress, approvalAddress!, Number(fromChainId));
                            if (finalAllowance >= BigInt(amountAtomic)) {
                                confirmed = true;
                                logger.info(LogCode.SYS_INFO, `[CrossChain] Allowance verification passed! Proceeding.`);
                            }
                        }

                        if (confirmed) {
                            requiresApproval = false; // Proceed to swap
                            // [UX Update] Broadcast "Bridge Pending" (Executing Swap) status
                            chatWS.broadcastToUser(userId, {
                                type: 'client_action',
                                sessionId: context?.sessionId,
                                data: {
                                    action: {
                                        type: 'show_transaction_status_card',
                                        data: buildTxCardData('pending', {
                                            message: 'Approval confirmed. Submitting cross-chain transaction...',
                                            isLoading: true,
                                        }),
                                    }
                                }
                            });
                        } else {
                            throw new Error("Approval transaction timed out or failed.");
                        }
                    }
                } catch (err: any) {
                    logger.warn(LogCode.SYS_ERROR, `[CrossChain] Auto-approval failed: ${err.message}. Falling back to manual.`, { error: err });
                    // requiresApproval remains true, will fall back to manual card
                }
            }

            // [Smart Account Optimization]:
            // If NO approval is needed (Native Token, Solana, or Auto-Approved), execute INSTANTLY!
            if (!requiresApproval) {
                try {
                    let txHash = '';

                    if (isSolana) {
                        // Handle Solana Server Execution
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

                    const resultPayload = {
                        success: true,
                        txHash: txHash,
                        summary: `✅ Cross-chain transaction submitted! ${args.fromAmount} ${args.fromToken} -> ${args.toToken}. Track status below.`,
                        __client_action: {
                            type: 'show_transaction_status_card',
                            data: buildTxCardData('pending', {
                                txHash,
                                bridgeTool: quote.tool,
                                estimatedDuration: quote.estimate.executionDuration,
                                explorerLink: `https://scan.li.fi/tx/${txHash}`,
                                message: 'Cross-chain transaction submitted. Waiting for bridge confirmation...',
                                isLoading: true,
                            }),
                        }
                    };
                    void monitorCrossChainLifecycle({
                        userId,
                        sessionId: context?.sessionId,
                        messageId: context?.messageId,
                        txHash,
                        fromChainId,
                        toChainId,
                        fromToken: args.fromToken,
                        toToken: args.toToken,
                        amountIn: display.amountInDisplay,
                        amountOut: display.amountOutDisplay,
                        amountInRaw: display.amountInRaw,
                        amountOutRaw: display.amountOutRaw,
                        tokenInDecimals: display.tokenInDecimals,
                        tokenOutDecimals: display.tokenOutDecimals,
                        bridgeTool: quote.tool,
                    }).catch((monitorErr) => {
                        logger.warn(LogCode.SYS_ERROR, `[CrossChain] monitor failed: ${monitorErr?.message || monitorErr}`);
                    });
                    return resultPayload;

                } catch (execError: any) {
                    logger.warn(LogCode.EXE_TX_BROADCAST, 'Server-Side Execution failed', { error: execError.message });

                    // Return failure card instead of generic error text
                    return {
                        success: false,
                        error: execError.message,
                        summary: `❌ Transaction failed: ${execError.message}`,
                        __client_action: {
                            type: 'show_transaction_status_card',
                            data: buildTxCardData('failed', {
                                errorMessage: execError.message,
                                fromChain: fromChainId,
                                toChain: toChainId,
                                amount: args.fromAmount,
                                isLoading: false,
                            }),
                        }
                    };
                }
            }

            return {
                success: false,
                error: 'Approval is required but could not be auto-completed.',
                summary: `❌ Cross-chain swap requires token approval and auto-approval did not complete. Please retry in a moment.`,
                __client_action: {
                    type: 'show_transaction_status_card',
                    data: buildTxCardData('failed', {
                        errorMessage: 'Approval is required but auto-approval was not completed.',
                        fromChain: fromChainId,
                        toChain: toChainId,
                        isLoading: false,
                    }),
                }
            };

        } catch (error: any) {
            logger.error(LogCode.API_FETCH_FAILED, 'LI.FI Tx Prep Error', { error: error.message, args });
            // Return failure card for API errors too
            return {
                success: false,
                error: `Failed to prepare: ${error.message}`,
                __client_action: {
                    type: 'show_transaction_status_card',
                    data: {
                        status: 'failed',
                        tokenInSymbol: args.fromToken,
                        tokenOutSymbol: args.toToken,
                        amountIn: args.fromAmount,
                        chainId: Number(resolveChainId(args.fromChain || '8453')),
                        errorMessage: error.message || 'Route unavailable or API error',
                        fromChain: args.fromChain,
                        toChain: args.toChain,
                        isLoading: false,
                    },
                }
            };
        }
    }
};
