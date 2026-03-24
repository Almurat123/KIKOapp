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

export async function validateSwapExecutionChain(
    args: SwapArgsLike,
    context: Record<string, any> | undefined,
): Promise<SwapExecutionGuardResult> {
    const targetChainId = Number(args.chain_id || 0) || undefined;
    if (!targetChainId) return { ok: true };

    const pendingChainSwitchId = Number(context?.pendingChainSwitch?.targetChainId || 0) || undefined;
    if (pendingChainSwitchId) {
        return {
            ok: false,
            code: 'CHAIN_SWITCH_REQUIRED',
            error: `CHAIN_SWITCH_REQUIRED: A wallet chain switch to ${getConnectedChainLabel(pendingChainSwitchId)} (${pendingChainSwitchId}) is still pending confirmation. Wait for the wallet switch to succeed before retrying this trade.`,
        };
    }

    const connectedChainId = Number(context?.chainId || 0) || undefined;
    if (connectedChainId && connectedChainId !== targetChainId) {
        return {
            ok: false,
            code: 'CHAIN_SWITCH_REQUIRED',
            error: `CHAIN_SWITCH_REQUIRED: Connected chain is ${getConnectedChainLabel(connectedChainId)} (${connectedChainId}), but this trade targets chain ${targetChainId}. Call switch_wallet_chain first, then retry the trade.`,
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
