// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Rowan
// Reason: literal addresses in chat turns were being left for the model to
//         interpret from raw text alone, which made token contracts drift into
//         wallet-analysis or copy-trade paths when the wording was short.
// Goal: classify requested addresses into explicit wallet/token/contract hints
//       before canonical intent normalization so the model receives structured
//       evidence instead of guessing from shape alone.
// Owns: requested-address classification for chat snapshot enrichment.
// Does Not Own: final canonical intent selection, token analysis execution, or copy-trade mutation logic.
// Design Language:
// - prefer deterministic address classification before model inference
// - token contract detection should reuse existing RPC/token-service logic
// - unknown is acceptable; wrong certainty is not
// Document Provenance:
// - Source: Farcaster/runtime incidents where token contract addresses were
//           routed into wallet-oriented intents
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: requested address classification before canonical normalization
// - Verification: verified in code and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-address-preclassification-for-chat.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-query-unwrapping-and-wallet-guard.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-farcaster-agent-mode-prompt.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import { getChainConfig } from '../../config/chainConfig.js';
import type { ChatContextSnapshot, RequestedAddressClassification } from './contracts.js';
import { isErc20ContractAddress } from '../../utils/evmTokenCheck.js';
import { callRpc } from '../../services/rpcManager.js';
import { getTokenInfo } from '../../services/tokenService.js';

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function enrichRequestedAddressClassifications(
    snapshot: ChatContextSnapshot,
): Promise<ChatContextSnapshot> {
    const addresses = Array.from(new Set((snapshot.requestedTokenAddresses || []).map((value) => String(value || '').trim()).filter(Boolean)));
    if (addresses.length === 0) {
        return {
            ...snapshot,
            requestedAddressClassifications: [],
        };
    }

    const chainId = Number(snapshot.normalizedIntent?.requestedChain?.chainId || snapshot.runtime.chainId || 0) || undefined;
    const chainName = chainId ? resolveChainName(chainId) : snapshot.runtime.chainName || null;
    const classifications = await Promise.all(
        addresses.map((address) => classifyRequestedAddress({
            address,
            chainId,
            chainName,
        })),
    );

    return {
        ...snapshot,
        requestedAddressClassifications: classifications,
    };
}

async function classifyRequestedAddress(params: {
    address: string;
    chainId?: number;
    chainName?: string | null;
}): Promise<RequestedAddressClassification> {
    const address = String(params.address || '').trim();
    if (!address) {
        return {
            address,
            kind: 'unknown',
            chainId: params.chainId || null,
            chainName: params.chainName || null,
            source: 'heuristic',
        };
    }

    if (EVM_ADDRESS_RE.test(address)) {
        return classifyEvmAddress({
            address: address.toLowerCase(),
            chainId: params.chainId,
            chainName: params.chainName || null,
        });
    }

    if (SOLANA_ADDRESS_RE.test(address)) {
        return classifySolanaAddress({
            address,
            chainId: params.chainId,
            chainName: params.chainName || null,
        });
    }

    return {
        address,
        kind: 'unknown',
        chainId: params.chainId || null,
        chainName: params.chainName || null,
        source: 'heuristic',
    };
}

async function classifyEvmAddress(params: {
    address: string;
    chainId?: number;
    chainName?: string | null;
}): Promise<RequestedAddressClassification> {
    if (!params.chainId) {
        return {
            address: params.address,
            kind: 'unknown',
            chainId: null,
            chainName: params.chainName || null,
            source: 'heuristic',
        };
    }

    const tokenContract = await isErc20ContractAddress(params.chainId, params.address).catch(() => false);
    if (tokenContract) {
        return {
            address: params.address,
            kind: 'token_contract',
            chainId: params.chainId,
            chainName: params.chainName || null,
            source: 'rpc',
        };
    }

    try {
        const code = await callRpc<string>(params.chainId, 'eth_getCode', [params.address, 'latest']);
        if (code && code !== '0x' && code !== '0x0' && code.length > 2) {
            return {
                address: params.address,
                kind: 'contract',
                chainId: params.chainId,
                chainName: params.chainName || null,
                source: 'rpc',
            };
        }
        return {
            address: params.address,
            kind: 'wallet',
            chainId: params.chainId,
            chainName: params.chainName || null,
            source: 'rpc',
        };
    } catch {
        return {
            address: params.address,
            kind: 'unknown',
            chainId: params.chainId,
            chainName: params.chainName || null,
            source: 'heuristic',
        };
    }
}

async function classifySolanaAddress(params: {
    address: string;
    chainId?: number;
    chainName?: string | null;
}): Promise<RequestedAddressClassification> {
    const chainId = params.chainId || 900;
    const tokenInfo = await getTokenInfo(params.address, chainId, { verbose: false, fastMode: true }).catch(() => null);
    if (tokenInfo?.symbol || tokenInfo?.name || tokenInfo?.decimals !== undefined) {
        return {
            address: params.address,
            kind: 'token_contract',
            chainId,
            chainName: params.chainName || 'Solana',
            source: 'token_service',
        };
    }
    return {
        address: params.address,
        kind: 'unknown',
        chainId,
        chainName: params.chainName || 'Solana',
        source: 'heuristic',
    };
}

function resolveChainName(chainId: number): string | null {
    try {
        return getChainConfig(chainId).name;
    } catch {
        return null;
    }
}
