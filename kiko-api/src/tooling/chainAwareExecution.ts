import { findTokenOnAnyChain } from '../services/ai/tokenDetector.js';
import {
    canonicalizeChain,
    chainIdToSlug,
    chainSlugToId,
    parseChainId,
} from '../utils/chainParam.js';

const TOKEN_ANALYSIS_TOOLS = new Set([
    'get_token_info',
    'get_early_buyers',
    'check_token_risk',
    'get_token_top_gainers',
]);

const ADDRESS_TOKEN_TOOLS = new Set([
    ...TOKEN_ANALYSIS_TOOLS,
    'get_token_price',
]);

const CONTEXT_CHAIN_TOOLS = new Set([
    ...ADDRESS_TOKEN_TOOLS,
    'analyze_creator',
]);

type ToolContextLike = Record<string, any> | undefined;

type ChainAwareMeta = {
    explicitChainInput: boolean;
    attemptedChain?: string;
    attemptedChainId?: number;
    requestTokenAddress?: string;
    canonicalTokenAddress?: string;
};

type ChainResolutionInfo = {
    status: 'auto_corrected';
    reason: 'wrong_chain_candidate_detected';
    attemptedChain?: string;
    attemptedChainId?: number;
    resolvedChain: string;
    resolvedChainId?: number;
};

function normalizeAddress(value: unknown): string | undefined {
    if (!value) return undefined;
    return String(value).trim().toLowerCase();
}

function isAddressLike(value: unknown): boolean {
    if (!value) return false;
    const raw = String(value).trim();
    if (!raw) return false;
    if (/^0x[a-fA-F0-9]{40}$/.test(raw)) return true;
    return !raw.startsWith('0x') && raw.length >= 32;
}

function getRequestTokenAddress(args: Record<string, any>): string | undefined {
    const direct =
        args.address
        || args.token_address
        || args.contract_address;
    if (isAddressLike(direct)) {
        return normalizeAddress(direct);
    }

    if (isAddressLike(args.symbol_or_address)) {
        return normalizeAddress(args.symbol_or_address);
    }

    return undefined;
}

function getSnapshotRequestedTokenAddress(context: ToolContextLike): string | undefined {
    const requested = Array.isArray(context?.__snapshot?.requestedTokenAddresses)
        ? context.__snapshot.requestedTokenAddresses
        : [];
    if (requested.length !== 1) return undefined;
    return normalizeAddress(requested[0]);
}

function applyTokenAddress(args: Record<string, any>, address: string): Record<string, any> {
    const next: Record<string, any> = { ...args };
    if (next.address !== undefined || (next.token_address === undefined && next.contract_address === undefined)) {
        next.address = address;
    }
    if (next.token_address !== undefined) {
        next.token_address = address;
    }
    if (next.contract_address !== undefined) {
        next.contract_address = address;
    }
    if (next.symbol_or_address !== undefined && isAddressLike(next.symbol_or_address)) {
        next.symbol_or_address = address;
    }
    return next;
}

function resolveCanonicalTokenAddress(args: Record<string, any>, context?: ToolContextLike): string | undefined {
    const direct = getRequestTokenAddress(args);
    if (direct) return direct;
    return getSnapshotRequestedTokenAddress(context);
}

function hasExplicitChainInput(args: Record<string, any>): boolean {
    return args.chain !== undefined || args.chain_id !== undefined;
}

function applyChain(args: Record<string, any>, chain: string, chainId?: number): Record<string, any> {
    const next: Record<string, any> = { ...args, chain };
    if (chainId !== undefined) {
        next.chain_id = chainId;
    }
    return next;
}

function pickAnalysisChain(context: ToolContextLike): { chain?: string; chainId?: number } {
    const chain = canonicalizeChain(context?.analysisChain || context?.analysisChainName);
    const chainId = parseChainId(context?.analysisChainId) ?? (chain ? chainSlugToId(chain) : undefined);
    return { chain, chainId };
}

function shouldRespectAnalysisContext(
    toolName: string,
    args: Record<string, any>,
    context: ToolContextLike,
): boolean {
    if (!CONTEXT_CHAIN_TOOLS.has(toolName)) return false;
    if (toolName === 'analyze_creator') {
        return !!(context?.analysisChain || context?.analysisChainId);
    }

    const requestTokenAddress = getRequestTokenAddress(args);
    const analysisTokenAddress = normalizeAddress(context?.analysisTokenAddress);
    return !!requestTokenAddress && !!analysisTokenAddress && requestTokenAddress === analysisTokenAddress;
}

function looksLikeWrongChainOrEmptyResult(result: any): boolean {
    if (!result) return true;

    if (typeof result === 'string') {
        return /not found|no data|no early buyers|empty|unsupported chain/i.test(result);
    }

    if (typeof result !== 'object') return false;

    const statusText = [
        typeof result.error === 'string' ? result.error : '',
        typeof result.message === 'string' ? result.message : '',
    ].join(' ');

    if (/unsupported chain/i.test(statusText)) return false;
    if (/not found|no data|no early buyers|empty|not have trading activity/i.test(statusText)) {
        return true;
    }

    if (result.success === false) {
        return true;
    }

    if (Array.isArray(result.earlyBuyers) && result.earlyBuyers.length === 0) {
        return true;
    }

    if (Array.isArray(result.topGainers) && result.topGainers.length === 0) {
        return true;
    }

    return false;
}

export async function prepareChainAwareToolExecution(
    toolName: string,
    args: Record<string, any>,
    context?: ToolContextLike,
    deps?: {
        findTokenOnAnyChain?: typeof findTokenOnAnyChain;
    },
): Promise<{ args: Record<string, any>; meta: ChainAwareMeta }> {
    const detector = deps?.findTokenOnAnyChain || findTokenOnAnyChain;
    let nextArgs = { ...(args || {}) };
    const explicitChainInput = hasExplicitChainInput(nextArgs);
    const requestTokenAddress = getRequestTokenAddress(nextArgs);
    const canonicalTokenAddress = resolveCanonicalTokenAddress(nextArgs, context);

    if (ADDRESS_TOKEN_TOOLS.has(toolName) && canonicalTokenAddress && canonicalTokenAddress !== requestTokenAddress) {
        nextArgs = applyTokenAddress(nextArgs, canonicalTokenAddress);
    }

    if (ADDRESS_TOKEN_TOOLS.has(toolName) && canonicalTokenAddress) {
        const detected = await detector(canonicalTokenAddress).catch(() => null);
        if (detected?.chainId) {
            const detectedChain = canonicalizeChain(detected.chainName) || chainIdToSlug(detected.chainId);
            if (detectedChain) {
                const attemptedChain = canonicalizeChain(args?.chain) || chainIdToSlug(parseChainId(args?.chain_id));
                const attemptedChainId = parseChainId(args?.chain_id) ?? (attemptedChain ? chainSlugToId(attemptedChain) : undefined);
                const detectedArgs = applyChain(nextArgs, detectedChain, detected.chainId);
                return {
                    args: detectedArgs,
                    meta: {
                        explicitChainInput,
                        requestTokenAddress,
                        canonicalTokenAddress,
                        attemptedChain,
                        attemptedChainId,
                    },
                };
            }
        }
    }

    if (shouldRespectAnalysisContext(toolName, nextArgs, context)) {
        const { chain, chainId } = pickAnalysisChain(context);
        if (chain) {
            const forcedArgs = applyChain(nextArgs, chain, chainId);
            return {
                args: forcedArgs,
                meta: {
                    explicitChainInput,
                    requestTokenAddress,
                    canonicalTokenAddress,
                    attemptedChain: chain,
                    attemptedChainId: chainId,
                },
            };
        }
    }

    const attemptedChain = canonicalizeChain(nextArgs.chain) || chainIdToSlug(parseChainId(nextArgs.chain_id));
    const attemptedChainId = parseChainId(nextArgs.chain_id) ?? (attemptedChain ? chainSlugToId(attemptedChain) : undefined);
    return {
        args: nextArgs,
        meta: {
            explicitChainInput,
            requestTokenAddress,
            canonicalTokenAddress,
            attemptedChain,
            attemptedChainId,
        },
    };
}

export async function maybeRetryChainAwareToolExecution<T>(
    toolName: string,
    args: Record<string, any>,
    context: ToolContextLike,
    result: T,
    meta: ChainAwareMeta,
    executor: (nextArgs: Record<string, any>) => Promise<T>,
    deps?: {
        findTokenOnAnyChain?: typeof findTokenOnAnyChain;
    },
): Promise<T> {
    const detector = deps?.findTokenOnAnyChain || findTokenOnAnyChain;
    if (!ADDRESS_TOKEN_TOOLS.has(toolName)) {
        return result;
    }

    const candidateAddress = meta.canonicalTokenAddress || meta.requestTokenAddress;
    if (!candidateAddress || !looksLikeWrongChainOrEmptyResult(result)) {
        return result;
    }

    const detected = await detector(candidateAddress).catch(() => null);
    if (!detected?.chainId) {
        return result;
    }

    const candidateChain = canonicalizeChain(detected.chainName) || chainIdToSlug(detected.chainId);
    if (!candidateChain) {
        return result;
    }

    if (candidateChain === meta.attemptedChain && detected.chainId === meta.attemptedChainId) {
        return result;
    }

    const retryArgs = applyChain(args, candidateChain, detected.chainId);
    console.warn(`[ToolRegistry] Retrying ${toolName} on detected analysis chain ${candidateChain} (${detected.chainId})`);
    const retried = await executor(retryArgs);
    const chainResolution: ChainResolutionInfo = {
        status: 'auto_corrected',
        reason: 'wrong_chain_candidate_detected',
        attemptedChain: meta.attemptedChain,
        attemptedChainId: meta.attemptedChainId,
        resolvedChain: candidateChain,
        resolvedChainId: detected.chainId,
    };

    if (retried && typeof retried === 'object' && !Array.isArray(retried)) {
        return {
            ...(retried as Record<string, any>),
            chainResolution,
        } as T;
    }

    return retried;
}
