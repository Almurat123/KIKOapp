import * as alchemy from '../../services/alchemy.js';
import * as chatRepo from '../../repositories/chatRepository.js';
import * as privyWallet from '../../services/privyWallet.js';
import { MainSwapService } from '../../services/MainSwapService.js';
import { getChainConfig } from '../../config/chainConfig.js';
import { LogCode } from '../../config/logRegistry.js';
import { logger } from '../../utils/logger.js';
import { buildSignedHeaders } from '../../utils/requestSigningClient.js';
import { fetchJson } from '../../config/unifiedApiService.js';
import { findTokenOnAnyChain } from '../../services/ai/tokenDetector.js';
import { chatWS } from '../../services/chatWebSocket.js';
import { getFastSwapDecision, prepareFastSwapExecution } from './fastSwapExecutor.js';
import { resolveRequestedChainHint } from './chainIntent.js';
import type { ChatContextSnapshot } from './contracts.js';
import { ChatStreamBroker } from './streamBroker.js';
import { resolveTokenDisplayMetadata } from '../../services/tokens.js';

const CHAIN_ID_MAP: Record<number, string> = {
    1: 'eth',
    8453: 'base',
    56: 'bsc',
    42161: 'arbitrum',
    10: 'optimism',
    137: 'polygon',
    900: 'solana',
};

const STABLE_SYMBOLS = new Set(['USDC', 'USDT', 'DAI', 'FDUSD', 'BUSD', 'USD1']);
const NATIVE_SYMBOLS_BY_CHAIN: Record<number, string> = {
    1: 'ETH',
    10: 'ETH',
    56: 'BNB',
    137: 'POL',
    42161: 'ETH',
    8453: 'ETH',
    900: 'SOL',
};

export async function maybeExecuteFastSwap(params: {
    snapshot: ChatContextSnapshot;
    task: any;
    userId: string | null;
    broker: ChatStreamBroker;
}): Promise<{ handled: boolean }> {
    if (params.snapshot.policySnapshot?.enforcementLevel === 'hard' && params.snapshot.policySnapshot?.mutationAllowed) {
        // Hard policy mode forbids bypassing preflight->confirm->execute through fast-swap direct execution.
        return { handled: false };
    }
    const toolConfig = params.task.toolContext?.toolConfig || {};
    if (toolConfig.fastSwapMode !== true) return { handled: false };

    const parsedIntent = await buildFastSwapIntent(params.snapshot);
    const requestedChainId = Number(parsedIntent?.chainId || 0);
    const currentChainId = Number(params.snapshot.runtime.chainId || 0);
    if (requestedChainId && currentChainId && requestedChainId !== currentChainId && params.userId) {
        chatWS.broadcastToUser(params.userId, {
            type: 'client_action',
            sessionId: params.task.sessionId,
            data: {
                message_id: params.task.assistantMessageId,
                action: {
                    type: 'switch_chain',
                    payload: {
                        chainId: requestedChainId,
                        chainName: CHAIN_ID_MAP[requestedChainId] || `chain-${requestedChainId}`,
                    },
                },
            },
        });
        logger.info(LogCode.AI_ORCHESTRATOR, 'Fast swap auto-switching chain before execution', {
            taskId: params.task.id,
            currentChainId,
            requestedChainId,
            tokenIn: parsedIntent?.swapIntent?.tokenIn,
            tokenOut: parsedIntent?.swapIntent?.tokenOut,
        });
    }
    const fastSwapDecision = getFastSwapDecision({
        parsedIntent,
        lastUserMessage: params.snapshot.lastUserMessage,
        toolContext: params.task.toolContext,
    });
    if (!fastSwapDecision.shouldAttempt) return { handled: false };

    const prepared = await prepareFastSwapExecution({
        parsedIntent,
        lastUserMessage: params.snapshot.lastUserMessage,
        taskToolContext: {
            ...(params.task.toolContext || {}),
            userId: params.userId,
        },
        chainIdMap: CHAIN_ID_MAP,
        findSnapshotBalance: (token, chain, isNative) => findSnapshotBalanceForToken(params.snapshot, token, chain, isNative),
        fetchOnchainBalance: fetchOnchainBalanceForToken,
        resolveSolWallet: (uid) => privyWallet.getSolanaEmbeddedWalletAddress(uid),
        resolveEvmWallet: (uid) => privyWallet.getEmbeddedWalletAddress(uid),
    });

    if (prepared.shouldFallbackToLlm || !prepared.resolvedWalletAddress) {
        const fallbackMessage =
            `BALANCE_AUTO_RESOLUTION_GUARD: Fast swap could not resolve a safe executable amount for ${prepared.tokenIn} on ${prepared.actualChainName}. ` +
            `Use WALLET_STATE and USER_CONTEXT first. Do NOT hallucinate balance or assume 'all' is executable. Ask a short clarification or fetch wallet data before proposing execution.`;
        const existingDirectives = Array.isArray(params.snapshot.runtime.systemDirectives)
            ? params.snapshot.runtime.systemDirectives
            : [];
        if (!existingDirectives.some((item) => String(item?.message || '').includes('BALANCE_AUTO_RESOLUTION_GUARD'))) {
            existingDirectives.push({
                kind: 'balance_auto_resolution_guard',
                message: fallbackMessage,
                metadata: {
                    tokenIn: prepared.tokenIn,
                    tokenOut: prepared.tokenOut,
                    chainId: prepared.chainId,
                    actualChainName: prepared.actualChainName,
                },
            });
            params.snapshot.runtime.systemDirectives = existingDirectives;
        }
        logger.info(LogCode.AI_ORCHESTRATOR, 'Fast swap prepared but falling back to orchestration', {
            taskId: params.task.id,
            tokenIn: prepared.tokenIn,
            tokenOut: prepared.tokenOut,
            amountIn: prepared.amountIn,
            chainId: prepared.chainId,
        });
        return { handled: false };
    }

    const [tokenInDisplay, tokenOutDisplay] = await Promise.all([
        resolveTokenDisplayMetadata(prepared.tokenIn, prepared.chainId),
        resolveTokenDisplayMetadata(prepared.tokenOut, prepared.chainId),
    ]);

    const txCardMessage = await chatRepo.createMessage(
        params.task.sessionId,
        'assistant',
        '',
        {
            type: 'transaction-status-card',
            data: {
                status: 'pending',
                swapType: inferFastSwapType(prepared.tokenIn, prepared.tokenOut, prepared.chainId),
                tokenIn: prepared.tokenIn,
                tokenOut: prepared.tokenOut,
                tokenInSymbol: tokenInDisplay.symbol,
                tokenOutSymbol: tokenOutDisplay.symbol,
                tokenInLogoURI: tokenInDisplay.logoURI,
                tokenOutLogoURI: tokenOutDisplay.logoURI,
                amountIn: prepared.amountIn,
                chainId: prepared.chainId,
                startedAt: Date.now(),
                message: 'Initiating fast swap...',
                isLoading: true,
            },
            status: 'streaming',
        },
    );

    if (params.userId) {
        chatWS.broadcastToUser(params.userId, {
            type: 'client_action',
            sessionId: params.task.sessionId,
            data: {
                targetMessageId: txCardMessage.id,
                action: {
                    type: 'show_transaction_status_card',
                    data: txCardMessage.data,
                },
            },
        });
    }

    void prewarmQuote({
        task: params.task,
        txCardMessageId: txCardMessage.id,
        userId: params.userId,
        tokenIn: prepared.tokenIn,
        tokenOut: prepared.tokenOut,
        amountIn: prepared.amountIn,
        chainId: prepared.chainId,
        sessionId: params.task.sessionId,
    });

    let swapResult: any;
    try {
        swapResult = await MainSwapService.executeSwap({
            userId: params.userId || '',
            walletAddress: prepared.resolvedWalletAddress,
            tokenIn: prepared.tokenIn,
            tokenOut: prepared.tokenOut,
            amountIn: prepared.amountIn,
            chainId: prepared.chainId,
            slippageBps: 300,
            mode: 'fast-swap',
            executionSource: 'chat',
            routePolicy: 'external_only',
            messageId: txCardMessage.id,
            userSettings: {
                swapMethod: 'allowance_trade',
                fastSwapMode: true,
                mevProtection: true,
            },
        });
    } catch (error: any) {
        swapResult = { success: false, error: error?.message || String(error) };
    }

    const cardData = {
        ...(txCardMessage.data || {}),
        status: swapResult.success ? 'success' : 'failed',
        txHash: swapResult.txHash,
        amountOut: swapResult.amountOut,
        error: swapResult.error,
        errorMessage: swapResult.error,
        completedAt: Date.now(),
        message: swapResult.success
            ? `Fast swap completed ${String(swapResult.txHash || '').slice(0, 10)}...`
            : `Swap failed: ${String(swapResult.error || 'unknown error')}`,
        isLoading: false,
    };

    await chatRepo.updateMessage(txCardMessage.id, {
        data: cardData,
        status: 'complete',
        transactionStatus: cardData.status,
        transactionHash: cardData.txHash,
        type: 'transaction-status-card',
    });

    if (params.userId) {
        chatWS.broadcastToUser(params.userId, {
            type: 'client_action',
            sessionId: params.task.sessionId,
            data: {
                targetMessageId: txCardMessage.id,
                action: {
                    type: 'show_transaction_status_card',
                    data: cardData,
                },
            },
        });
    }

    await params.broker.complete({ content: '' });
    return { handled: true };
}

async function buildFastSwapIntent(snapshot: ChatContextSnapshot): Promise<any> {
    const contractAddress = snapshot.requestedTokenAddresses[0];
    const detectedToken = contractAddress ? await findTokenOnAnyChain(contractAddress).catch(() => null) : null;
    return deriveFastSwapIntentDraft(snapshot, detectedToken?.chainId);
}

export function deriveFastSwapIntentDraft(snapshot: ChatContextSnapshot, detectedTokenChainId?: number): any {
    const chainId = snapshot.runtime.chainId || 8453;
    const query = snapshot.lastUserMessage;
    const lower = query.toLowerCase();
    const contractAddress = snapshot.requestedTokenAddresses[0];
    const requestedChain = resolveRequestedChainHint({
        text: query,
        requestedTokenAddresses: snapshot.requestedTokenAddresses,
        requestedTokenSymbols: snapshot.requestedTokenSymbols,
    });
    const destinationAsset = extractDestinationAsset(query, requestedChain?.chainId || chainId);
    const explicitBuy = /\b(buy|get|swap|trade|ape)\b/i.test(query) || /买|换/.test(query);
    const amountMatch = query.match(/\b(all|\d+(?:\.\d+)?%?)\b/i);
    const symbolCandidates = snapshot.requestedTokenSymbols.filter((symbol) =>
        !['BUY', 'SELL', 'SWAP', 'TRADE', 'GET', 'ALL'].includes(symbol)
    );
    const destinationChainId = destinationAsset ? inferChainIdFromAsset(destinationAsset) : undefined;
    const inferredChainId = requestedChain?.chainId || detectedTokenChainId || destinationChainId || chainId;
    const effectiveChainId = inferredChainId || 8453;
    const nativeSymbol = nativeSymbolForChain(effectiveChainId);
    const explicitSell =
        /\b(sell|dump)\b/i.test(query)
        || /卖/.test(query)
        || (!!contractAddress && !!destinationAsset && destinationAsset.toUpperCase() !== String(contractAddress).toUpperCase());
    const target = contractAddress || symbolCandidates.find((symbol) => !STABLE_SYMBOLS.has(symbol) && symbol !== nativeSymbolForChain(effectiveChainId))
        || symbolCandidates[0];
    let tokenIn = nativeSymbol;
    let tokenOut = destinationAsset || target || '';
    if (explicitSell && target) {
        tokenIn = target;
        tokenOut = destinationAsset || nativeSymbol;
    }
    if (!explicitSell && target && STABLE_SYMBOLS.has(String(target).toUpperCase())) {
        tokenOut = target;
        tokenIn = nativeSymbol;
    }
    const explicitSource = extractSourceSymbol(query, symbolCandidates, tokenOut, effectiveChainId);
    if (explicitSource) tokenIn = explicitSource;
    const parsedAmount = normalizeRequestedAmount(amountMatch?.[1], lower, explicitSell, tokenIn);

    return {
        detailed: { action: explicitBuy || explicitSell ? 'swap' : 'other' },
        swapIntent: {
            tokenIn,
            tokenOut,
            amount: parsedAmount,
        },
        contractAddress,
        chainId: effectiveChainId,
    };
}

function nativeSymbolForChain(chainId: number): string {
    return NATIVE_SYMBOLS_BY_CHAIN[chainId] || 'ETH';
}

function inferChainIdFromAsset(asset: string): number | undefined {
    const upper = String(asset || '').toUpperCase();
    if (upper === 'BNB') return 56;
    if (upper === 'POL' || upper === 'MATIC') return 137;
    if (upper === 'SOL') return 900;
    return undefined;
}

function inferFastSwapType(tokenIn: string, tokenOut: string, chainId: number): 'buy' | 'sell' {
    const native = nativeSymbolForChain(chainId).toUpperCase();
    const tokenInUpper = String(tokenIn || '').toUpperCase();
    const tokenOutUpper = String(tokenOut || '').toUpperCase();
    const tokenInIsNative = tokenInUpper === native;
    const tokenOutIsNative = tokenOutUpper === native;
    if (!tokenInIsNative && tokenOutIsNative) return 'sell';
    return 'buy';
}

export function findSnapshotBalanceForToken(snapshot: ChatContextSnapshot, tokenIn: string, chainName: string, isNative: boolean): number | null {
    if (isNative) {
        const allChainSnapshot = snapshot.runtime.allChainBalances?.[chainName] || null;
        const nativeBalance = Number(
            snapshot.runtime.nativeBalance
            ?? allChainSnapshot?.ethBalanceFormatted
            ?? allChainSnapshot?.ethBalance
            ?? allChainSnapshot?.nativeBalance
        );
        if (Number.isFinite(nativeBalance) && nativeBalance >= 0) return nativeBalance;
    }
    const allChainSnapshot = snapshot.runtime.allChainBalances?.[chainName] || null;
    const entries = normalizeBalanceEntries(snapshot.runtime.balance || allChainSnapshot?.tokens);
    if (entries.length === 0) return null;
    const tokenLower = String(tokenIn || '').toLowerCase();
    const tokenUpper = String(tokenIn || '').toUpperCase();
    const tokenIsAddress = tokenLower.startsWith('0x') || tokenLower.length >= 32;
    const nativeSymbols = chainName === 'solana' ? ['SOL'] : chainName === 'bsc' ? ['BNB'] : chainName === 'polygon' ? ['POL', 'MATIC'] : ['ETH'];
    const match = entries.find((entry) => {
        const symbolUpper = String(entry.symbol || '').toUpperCase();
        const contractLower = String(entry.contractAddress || '').toLowerCase();
        if (tokenIsAddress) return !!contractLower && contractLower === tokenLower;
        if (isNative && nativeSymbols.includes(symbolUpper)) return true;
        return symbolUpper === tokenUpper;
    });
    if (!match) return null;
    const value = Number(match.balance);
    return Number.isFinite(value) && value >= 0 ? value : null;
}

async function fetchOnchainBalanceForToken(walletAddress: string, chainName: string, tokenIn: string, isNative: boolean): Promise<number> {
    if (isNative) {
        const wallet = await alchemy.getWalletBalance(walletAddress, chainName);
        const nativeBalance = Number(wallet?.ethBalanceFormatted || 0);
        return Number.isFinite(nativeBalance) && nativeBalance >= 0 ? nativeBalance : 0;
    }
    if (chainName !== 'solana' && tokenIn.startsWith('0x')) {
        const direct = await alchemy.getSpecificTokenBalance(walletAddress, chainName, tokenIn);
        const directBalance = Number(direct?.formatted || 0);
        return Number.isFinite(directBalance) && directBalance >= 0 ? directBalance : 0;
    }
    const balances = await alchemy.getTokenBalances(walletAddress, chainName);
    const tokenLower = tokenIn.toLowerCase();
    const tokenUpper = tokenIn.toUpperCase();
    const found = balances.find((entry: any) => {
        const contract = String(entry?.contractAddress || '').toLowerCase();
        const symbol = String(entry?.symbol || '').toUpperCase();
        return contract === tokenLower || symbol === tokenUpper;
    });
    const listedBalance = Number(found?.tokenBalance || 0);
    return Number.isFinite(listedBalance) && listedBalance >= 0 ? listedBalance : 0;
}

function normalizeBalanceEntries(balance: any): Array<{ symbol: string; balance: string; contractAddress?: string }> {
    if (!balance || typeof balance !== 'object') return [];
    if (Array.isArray(balance)) {
        return balance.map((item) => ({
            symbol: String(item?.symbol || item?.tokenSymbol || item?.contractAddress || ''),
            balance: String(item?.balance || item?.tokenBalance || item?.amount || item?.formatted || item?.value || '0'),
            contractAddress: item?.contractAddress || item?.contract,
        })).filter((item) => item.symbol);
    }
    return Object.entries(balance).map(([symbol, raw]) => {
        if (raw && typeof raw === 'object') {
            return {
                symbol,
                balance: String((raw as any).balance || (raw as any).tokenBalance || (raw as any).amount || (raw as any).formatted || (raw as any).value || '0'),
                contractAddress: (raw as any).contractAddress || (raw as any).contract,
            };
        }
        return { symbol, balance: String(raw) };
    });
}

async function prewarmQuote(params: {
    task: any;
    txCardMessageId: string;
    userId: string | null;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    chainId: number;
    sessionId: string;
}) {
    const apiBase = process.env.API_BASE_URL || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://localhost:3001');
    const appKey = process.env.KIKO_WEB_APP_KEY || process.env.KIKO_MOBILE_APP_KEY || '';
    const body = JSON.stringify({
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn,
        chainId: params.chainId,
        slippageBps: 1000,
        userAddress: params.task.toolContext?.walletAddress,
    });
    try {
        const quote = await fetchJson<any>({
            url: `${apiBase}/api/swap/quote`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(appKey ? { 'X-App-Key': appKey } : {}),
                ...buildSignedHeaders('POST', '/api/swap/quote', body),
            },
            body,
            suppressError: true,
            retry: { retries: 0 },
        });
        const amountOut = quote?.data?.amountOut;
        if (!amountOut) return;
        const message = await chatRepo.getMessage(params.txCardMessageId);
        const data = {
            ...(message?.data || {}),
            amountOut,
            isLoading: false,
        };
        await chatRepo.updateMessage(params.txCardMessageId, { data });
        if (params.userId) {
            chatWS.broadcastToUser(params.userId, {
                type: 'client_action',
                sessionId: params.sessionId,
                data: {
                    targetMessageId: params.txCardMessageId,
                    action: {
                        type: 'show_transaction_status_card',
                        data,
                    },
                },
            });
        }
    } catch {
        // Best effort prewarm only.
    }
}

function extractSourceSymbol(query: string, candidates: string[], tokenOut: string, chainId: number): string | null {
    const lower = query.toLowerCase();
    const native = nativeSymbolForChain(chainId);
    for (const symbol of candidates) {
        if (symbol === tokenOut) continue;
        if (new RegExp(`\\bwith\\s+${symbol.toLowerCase()}\\b`).test(lower)) return symbol;
        if (new RegExp(`\\busing\\s+${symbol.toLowerCase()}\\b`).test(lower)) return symbol;
        if (new RegExp(`\\bfrom\\s+${symbol.toLowerCase()}\\b`).test(lower)) return symbol;
    }
    if (/\bwith\s+all\b/.test(lower) || /\buse\s+my\b/.test(lower)) return native;
    return null;
}

function extractDestinationAsset(query: string, chainId: number): string | null {
    const native = nativeSymbolForChain(chainId);
    const match = query.match(/\bto\s+([A-Za-z0-9._-]+)\b/i) || query.match(/(?:换成|兑成|到)\s*([A-Za-z0-9._-]+)/i);
    if (!match?.[1]) return null;
    const asset = String(match[1]).trim();
    if (!asset) return null;
    const upper = asset.toUpperCase();
    if (upper === 'NATIVE') return native;
    if (upper === 'MATIC') return 'POL';
    return upper;
}

function normalizeRequestedAmount(
    rawAmount: string | undefined,
    lower: string,
    explicitSell: boolean,
    tokenIn: string,
): string {
    if (!rawAmount) {
        if (/\ball\b/.test(lower) || /全部/.test(lower)) return 'all';
        if (/\bhalf\b/.test(lower)) return '50%';
        return explicitSell ? 'all' : '0.001';
    }
    if (/^\d+$/.test(rawAmount) && /\bpercent\b/.test(lower)) return `${rawAmount}%`;
    if (rawAmount.toLowerCase() === 'all') return 'all';
    if (rawAmount.endsWith('%')) return rawAmount;
    if (/\bbuy\b/.test(lower) && STABLE_SYMBOLS.has(String(tokenIn || '').toUpperCase())) return rawAmount;
    return rawAmount;
}
