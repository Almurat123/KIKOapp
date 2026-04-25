import * as alchemy from '../../services/alchemy.js';
import * as chatRepo from '../../repositories/chatRepository.js';
import * as privyWallet from '../../services/privyWallet.js';
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
import { resolveTradeSemantics } from '../../services/ai/tradeSemantics.js';
import { resolveDisplayedAmountOut } from '../../services/swapCardAmount.js';
import { inferSwapCardType } from '../../services/swap/swapCardType.js';

const CHAIN_ID_MAP: Record<number, string> = {
    1: 'eth',
    8453: 'base',
    56: 'bsc',
    42161: 'arbitrum',
    10: 'optimism',
    137: 'polygon',
    900: 'solana',
};

const NATIVE_SYMBOLS_BY_CHAIN: Record<number, string> = {
    1: 'ETH',
    10: 'ETH',
    56: 'BNB',
    137: 'POL',
    42161: 'ETH',
    8453: 'ETH',
    900: 'SOL',
};

function shouldAttachTradeDebug(task: any): boolean {
    return task?.toolContext?.toolConfig?.tradeDebugMode === true;
}

function buildTradeDebug(task: any, details: Record<string, any>) {
    if (!shouldAttachTradeDebug(task)) return undefined;
    return {
        ts: new Date().toISOString(),
        ...details,
    };
}

function resolveFastSwapFinalStatus(result: {
    ok?: boolean;
    data?: { status?: string | null };
}): 'success' | 'pending' | 'failed' {
    const backendStatus = String(result.data?.status || '').toUpperCase();
    if (!result.ok) return 'failed';
    return backendStatus === 'PENDING' ? 'pending' : 'success';
}

function canAttemptFastSwap(params: {
    snapshot: ChatContextSnapshot;
    task: any;
}): boolean {
    const toolConfig = params.task?.toolContext?.toolConfig || {};
    if (toolConfig.fastSwapMode !== true) return false;
    return true;
}

export async function maybeExecuteFastSwap(params: {
    snapshot: ChatContextSnapshot;
    task: any;
    userId: string | null;
    broker: ChatStreamBroker;
}): Promise<{ handled: boolean }> {
    if (!canAttemptFastSwap(params)) return { handled: false };

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
    const initialDebug = buildTradeDebug(params.task, {
        mode: 'fast_swap',
        path: 'chat_fast_swap_coordinator',
        tokenIn: prepared.tokenIn,
        tokenOut: prepared.tokenOut,
        amountIn: prepared.amountIn,
        chainId: prepared.chainId,
    });

    const txCardMessage = await chatRepo.createMessage(
        params.task.sessionId,
        'assistant',
        '',
        {
            type: 'transaction-status-card',
            data: {
                status: 'sending',
                swapType: inferSwapCardType({
                    tokenIn: prepared.tokenIn,
                    tokenOut: prepared.tokenOut,
                    tokenInSymbol: tokenInDisplay.symbol,
                    tokenOutSymbol: tokenOutDisplay.symbol,
                    chainId: prepared.chainId,
                }),
                tokenIn: prepared.tokenIn,
                tokenOut: prepared.tokenOut,
                tokenInSymbol: tokenInDisplay.symbol,
                tokenOutSymbol: tokenOutDisplay.symbol,
                tokenInLogoURI: tokenInDisplay.logoURI,
                tokenOutLogoURI: tokenOutDisplay.logoURI,
                amountIn: prepared.amountIn,
                chainId: prepared.chainId,
                startedAt: Date.now(),
                message: 'Submitting fast swap...',
                isLoading: true,
                ...(initialDebug ? { debug: initialDebug } : {}),
            },
            status: 'streaming',
        },
    );
    let latestCardData = { ...(txCardMessage.data || {}) };

    if (params.userId) {
        chatWS.broadcastToUser(params.userId, {
            type: 'client_action',
            sessionId: params.task.sessionId,
            data: {
                targetMessageId: txCardMessage.id,
                action: {
                    type: 'show_transaction_status_card',
                    data: latestCardData,
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
        const apiBase = process.env.API_BASE_URL
            || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://localhost:3001');
        const accessToken = params.task.toolContext?.accessToken;
        const appKey = process.env.KIKO_WEB_APP_KEY || process.env.KIKO_MOBILE_APP_KEY || '';
        if (!accessToken) {
            throw new Error('Missing access token for fast swap execution');
        }

        const requestBody = {
            tokenIn: prepared.tokenIn,
            tokenOut: prepared.tokenOut,
            amountIn: prepared.amountIn,
            chainId: prepared.chainId,
            slippageBps: 300,
            messageId: txCardMessage.id,
        };

        const response = await fetch(`${apiBase}/api/swap/execute-instant`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                ...(appKey ? { 'X-App-Key': appKey } : {}),
                ...buildSignedHeaders('POST', '/api/swap/execute-instant', JSON.stringify(requestBody)),
                'X-Transaction-Message-Id': txCardMessage.id,
            },
            body: JSON.stringify(requestBody),
        });

        const payload = await response.json() as {
            success?: boolean;
            error?: string;
            message?: string;
            data?: {
                txHash?: string;
                amountOut?: string | null;
                tradeId?: string;
                status?: 'PENDING' | 'SUCCESS' | 'FAILED';
            };
        };

        swapResult = {
            ok: response.ok && payload.success,
            error: payload.error || payload.message,
            data: payload.data || {},
            responseStatus: response.status,
        };
    } catch (error: any) {
        swapResult = { ok: false, error: error?.message || String(error), data: {} };
    }

    const finalStatus = resolveFastSwapFinalStatus(swapResult);
    const latestPersistedCard = await chatRepo.getMessage(txCardMessage.id).catch(() => null);
    latestCardData = {
        ...latestCardData,
        ...((latestPersistedCard?.data as Record<string, any> | undefined) || {}),
    };
    const finalDebug = buildTradeDebug(params.task, {
        mode: 'fast_swap',
        finalStatus,
        responseStatus: swapResult.responseStatus,
        txHash: swapResult.data?.txHash || null,
        tradeId: swapResult.data?.tradeId || null,
    });
    const cardData = {
        ...latestCardData,
        status: finalStatus,
        txHash: swapResult.data?.txHash,
        amountOut: resolveDisplayedAmountOut({
            status: finalStatus,
            currentAmountOut: latestCardData.amountOut,
            settledAmountOut: swapResult.data?.amountOut,
        }),
        error: swapResult.error,
        errorMessage: swapResult.error,
        completedAt: Date.now(),
        message: finalStatus === 'success'
            ? `Fast swap completed ${String(swapResult.data?.txHash || '').slice(0, 10)}...`
            : finalStatus === 'pending'
                ? `Fast swap submitted ${String(swapResult.data?.txHash || '').slice(0, 10)}...`
                : `Swap failed: ${String(swapResult.error || 'unknown error')}`,
        isLoading: finalStatus === 'pending',
        ...(finalDebug ? {
            debug: {
                ...((txCardMessage.data as any)?.debug || {}),
                ...finalDebug,
            }
        } : {}),
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
    const contractAddress = snapshot.requestedTokenAddresses[0];
    const requestedChain = resolveRequestedChainHint({
        text: query,
        requestedTokenAddresses: snapshot.requestedTokenAddresses,
        requestedTokenSymbols: snapshot.requestedTokenSymbols,
        runtimeChainId: snapshot.runtime.chainId,
        runtimeChainName: snapshot.runtime.chainName,
    });
    const semantics = resolveTradeSemantics({
        text: query,
        chainId: requestedChain?.chainId || chainId,
        requestedTokenAddresses: snapshot.requestedTokenAddresses,
        requestedTokenSymbols: snapshot.requestedTokenSymbols,
        preferredTokenAddress: contractAddress,
    });
    const destinationChainId = semantics.destinationAsset ? inferChainIdFromAsset(semantics.destinationAsset) : undefined;
    const inferredChainId = requestedChain?.chainId || detectedTokenChainId || destinationChainId || chainId;
    const effectiveChainId = inferredChainId || 8453;
    const tokenIn = semantics.tokenIn || nativeSymbolForChain(effectiveChainId);
    const tokenOut = semantics.tokenOut || '';
    const parsedAmount = semantics.amount.value || (semantics.action === 'sell' ? 'all' : '0.001');

    return {
        detailed: { action: semantics.explicitTradeVerb ? 'swap' : 'other' },
        tradeAction: semantics.action,
        swapIntent: {
            tokenIn,
            tokenOut,
            amount: parsedAmount,
            amountKind: semantics.amount.kind,
            amountSemantic: semantics.amount.semantic,
            amountCurrency: semantics.amount.currency,
        },
        contractAddress,
        chainId: effectiveChainId,
        needsAmountResolution: semantics.needsAmountResolution,
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
            isLoading: (message?.data as any)?.isLoading ?? true,
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

export const __fastSwapCoordinatorTest = {
    resolveFastSwapFinalStatus,
    canAttemptFastSwap,
};
