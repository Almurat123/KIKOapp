import { findTokenOnAnyChain } from '../../../services/ai/tokenDetector.js';
import { resolveRequestedChainHint } from '../../../jobs/chat/chainIntent.js';
import { getConnectedChainLabel } from '../../../jobs/chat/toolContextChainState.js';

type SwapArgsLike = {
    token_in?: string;
    token_out?: string;
    chain_id?: number;
};

type SwapExecutionGuardResult =
    | { ok: true }
    | {
        ok: false;
        code: 'CHAIN_SWITCH_REQUIRED' | 'REQUESTED_CHAIN_MISMATCH' | 'TOKEN_CHAIN_MISMATCH';
        error: string;
      };

const POLYGON_CHAIN_ID = 137;
const POLYMARKET_POLYGON_COLLATERAL_TOKEN_ALIASES = new Set([
    'usdc',
    'usdce',
    'usdc.e',
    'usdc_native',
    'native_usdc',
    '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
]);

function isAddressLike(value: unknown): boolean {
    const raw = String(value || '').trim();
    if (!raw) return false;
    if (/^0x[a-fA-F0-9]{40}$/.test(raw)) return true;
    return !raw.startsWith('0x') && raw.length >= 32 && raw.length <= 44;
}

function collectRecentUserText(snapshot: any): string {
    const userMessages = Array.isArray(snapshot?.history)
        ? snapshot.history.filter((item: any) => item?.role === 'user').slice(-6)
        : [];
    return userMessages.map((item: any) => String(item?.content || '')).join('\n');
}

function normalizeCollateralToken(value: unknown): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/_/g, '')
        .replace(/-/g, '');
}

function isPolymarketPolygonCollateralSwap(args: SwapArgsLike, targetChainId?: number): boolean {
    if (Number(targetChainId || 0) !== POLYGON_CHAIN_ID) return false;
    const normalizedTokens = [args.token_in, args.token_out]
        .map((token) => normalizeCollateralToken(token))
        .filter(Boolean);
    if (normalizedTokens.length < 2) return false;
    return normalizedTokens.every((token) => POLYMARKET_POLYGON_COLLATERAL_TOKEN_ALIASES.has(token));
}

export async function validateSwapExecutionChain(
    args: SwapArgsLike,
    context: Record<string, any> | undefined,
): Promise<SwapExecutionGuardResult> {
    const targetChainId = Number(args.chain_id || 0) || undefined;
    if (!targetChainId) return { ok: true };

    if (isPolymarketPolygonCollateralSwap(args, targetChainId)) {
        return { ok: true };
    }

    const pendingChainSwitchId = Number(context?.pendingChainSwitch?.targetChainId || 0) || undefined;
    if (pendingChainSwitchId) {
        return {
            ok: false,
            code: 'CHAIN_SWITCH_REQUIRED',
            error: `CHAIN_SWITCH_REQUIRED: An automatic wallet chain switch to ${getConnectedChainLabel(pendingChainSwitchId)} (${pendingChainSwitchId}) is already in progress. Do not ask the user for an extra in-chat confirmation; wait for the switch result before retrying this trade.`,
        };
    }

    const connectedChainId = Number(context?.chainId || 0) || undefined;
    if (connectedChainId && connectedChainId !== targetChainId) {
        return {
            ok: false,
            code: 'CHAIN_SWITCH_REQUIRED',
            error: `CHAIN_SWITCH_REQUIRED: Connected chain is ${getConnectedChainLabel(connectedChainId)} (${connectedChainId}), but this trade targets chain ${targetChainId}. Use switch_wallet_chain now to trigger the automatic client-side chain switch, then retry the trade after the switch completes.`,
        };
    }

    const snapshot = context?.__snapshot;
    const requestedChain = snapshot
        ? resolveRequestedChainHint({
            text: collectRecentUserText(snapshot),
            requestedTokenAddresses: snapshot.requestedTokenAddresses,
            requestedTokenSymbols: snapshot.requestedTokenSymbols,
        })
        : null;
    if (requestedChain?.chainId && requestedChain.chainId !== targetChainId) {
        return {
            ok: false,
            code: 'REQUESTED_CHAIN_MISMATCH',
            error: `REQUESTED_CHAIN_MISMATCH: The user requested ${requestedChain.chainName} (${requestedChain.chainId}), but this trade is using chain ${targetChainId}. Use the user-requested chain and switch context before continuing.`,
        };
    }

    for (const token of [args.token_in, args.token_out]) {
        if (!isAddressLike(token)) continue;
        const detected = await findTokenOnAnyChain(String(token)).catch(() => null);
        if (detected?.chainId && Number(detected.chainId) !== targetChainId) {
            return {
                ok: false,
                code: 'TOKEN_CHAIN_MISMATCH',
                error: `TOKEN_CHAIN_MISMATCH: Token ${String(token)} belongs to chain ${detected.chainId}, but this trade is targeting chain ${targetChainId}. Fix the chain and switch context before continuing.`,
            };
        }
    }

    return { ok: true };
}
