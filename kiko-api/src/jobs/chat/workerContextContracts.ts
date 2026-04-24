// CONTEXT MEMORY
// Updated: 2026-04-23
// Author: Rowan
// Reason: chat context-read tools were returning mixed camelCase runtime
//         fields and raw wallet objects. That format made the model infer
//         operational meaning from vague summaries instead of reading a stable
//         worker-facing contract. API build later showed the contract builder
//         needs explicit primitive type helpers so TypeScript does not widen
//         chain IDs, token symbols, and filtered token arrays into unsafe
//         boolean/null unions.
// Goal: expose session and wallet context as compact operation fields that a
//       model worker can use directly for chain, wallet, entity, and balance decisions.
//       Model-selected TaskRoute chain requests must beat stale canonical
//       carry-forward inside the same contract.
// Owns: model-facing normalization of session context and wallet state.
// Does Not Own: wallet hydration, chain switching, balance fetching, or execution gating.
// Design Language:
// - context tool payloads use stable snake_case operation fields
// - session context answers who/where/what-chain, wallet state answers what funds exist
// - effective task chain must be explicit so requested chain beats connected chain
// - TaskRoute requested chain outranks legacy canonical requested chain
// - active-chain native balance must use chain-scoped prefetched wallet state
//   before any unscoped runtime nativeBalance value
// - raw provider/cache objects should be compacted before reaching the model
// - summaries should be short data contracts, not prose descriptions
// - contract fields use typed primitive helpers; do not pass generic mixed primitives into chain/string slots
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: on-demand worker-readable context contracts
// - Verification: inferred from plan and verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-worker-context-contracts.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: normalized read_user_context and read_wallet_state payloads
// - Verification: verified in code and targeted tests
// - Source: `npm run build` TypeScript diagnostics
// - Kind: test evidence
// - Retrieved: 2026-04-18
// - Applied To: typed primitive helpers and token-array filters
// - Verification: verified by api build
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-worker-context-contracts.md
// - /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-model-selected-task-menu.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import { resolveCanonicalChainRef } from './chainIntent.js';
import type { ChatContextSnapshot } from './contracts.js';

type CompactChain = {
    chain_id?: string | number;
    name?: string;
    source?: string;
};

type CompactTokenBalance = {
    symbol?: string;
    contract_address?: string;
    balance?: string | number | boolean;
    decimals?: string | number | boolean;
};

export function buildSessionContextContract(snapshot: ChatContextSnapshot) {
    const runtime = snapshot.runtime || {};
    const walletAddress = normalizePrimitive(runtime.walletAddress || runtime.userAddress);
    const connectedChain = buildChain(runtime.chainId, runtime.chainName);
    const requestedChainRef = resolveCanonicalChainRef({
        taskRoute: snapshot.taskRoute || null,
        canonicalIntent: snapshot.normalizedIntent || null,
        requestedTokenAddresses: snapshot.requestedTokenAddresses,
        requestedTokenSymbols: snapshot.requestedTokenSymbols,
        runtimeChainId: runtime.chainId,
        runtimeChainName: runtime.chainName,
    });
    const requestedChain = requestedChainRef && requestedChainRef.source !== 'wallet_context'
        ? buildChain(requestedChainRef.chainId, requestedChainRef.chainName, requestedChainRef.source)
        : undefined;
    const effectiveChain = requestedChain || connectedChain;

    return stripEmptyEntries({
        context_kind: 'session_context',
        wallet: stripEmptyEntries({
            connected: Boolean(walletAddress),
            address: walletAddress,
        }),
        chain: stripEmptyEntries({
            connected: connectedChain,
            requested: requestedChain,
            effective: effectiveChain,
            effective_source: requestedChain ? 'user_request' : connectedChain ? 'connected_wallet' : undefined,
        }),
        surface: stripEmptyEntries({
            page: normalizePrimitive(runtime.currentPage),
            page_context: truncateText(runtime.pageContext, 500),
            farcaster_profile: summarizeFarcaster(runtime.farcaster),
        }),
        request_entities: stripEmptyEntries({
            token_symbols: limitArray(snapshot.requestedTokenSymbols, 8),
            token_addresses: limitArray(snapshot.requestedTokenAddresses, 6),
            address_classifications: summarizeAddressClassifications(snapshot.requestedAddressClassifications),
        }),
    });
}

export function buildWalletStateContract(snapshot: ChatContextSnapshot, prefetchedWallet: Record<string, any> | null | undefined) {
    const runtime = snapshot.runtime || {};
    const walletAddress = normalizePrimitive(runtime.walletAddress || runtime.userAddress);
    const activeChain = buildChain(runtime.chainId, runtime.chainName);
    const activeChainBalance = buildActiveChainBalance({
        balance: runtime.balance,
        nativeBalance: runtime.nativeBalance,
        prefetchedWallet,
    });
    const allChainBalances = summarizeAllChainBalances(runtime.allChainBalances);

    return stripEmptyEntries({
        context_kind: 'wallet_state',
        wallet: stripEmptyEntries({
            connected: Boolean(walletAddress),
            address: walletAddress,
        }),
        active_chain: activeChain,
        balances: stripEmptyEntries({
            active_chain: activeChainBalance,
            all_chains: allChainBalances,
        }),
        snapshots: stripEmptyEntries({
            active_chain_at: normalizePrimitive(runtime.balanceSnapshotAt),
            all_chains_at: normalizePrimitive(runtime.allChainBalancesSnapshotAt),
        }),
    });
}

function buildChain(chainId: unknown, chainName: unknown, source?: string): CompactChain | undefined {
    const chain: CompactChain = stripEmptyEntries({
        chain_id: normalizeStringOrNumber(chainId),
        name: normalizeString(chainName),
        source: normalizeString(source),
    });
    return Object.keys(chain).length > 0 ? chain : undefined;
}

function buildActiveChainBalance(params: {
    balance: unknown;
    nativeBalance: unknown;
    prefetchedWallet: Record<string, any> | null | undefined;
}) {
    const native = normalizePrimitive(
        params.prefetchedWallet?.ethBalanceFormatted
        ?? params.prefetchedWallet?.ethBalance
        ?? params.prefetchedWallet?.nativeBalance
        ?? params.nativeBalance,
    );
    const balanceTokens = summarizeBalanceTokens(params.balance) || [];
    const prefetchedTokens = summarizeTokenArray(params.prefetchedWallet?.tokens);
    const active = stripEmptyEntries({
        native,
        tokens: mergeScopedWorkerTokens(prefetchedTokens, balanceTokens),
    });
    return Object.keys(active).length > 0 ? active : undefined;
}

function mergeScopedWorkerTokens(
    prefetchedTokens: CompactTokenBalance[] | undefined,
    balanceTokens: CompactTokenBalance[],
): CompactTokenBalance[] | undefined {
    if (!prefetchedTokens || prefetchedTokens.length === 0) {
        return balanceTokens.length > 0 ? balanceTokens : undefined;
    }
    if (balanceTokens.length === 0) return prefetchedTokens;
    const merged = [...prefetchedTokens];
    const knownAddresses = new Set(
        prefetchedTokens
            .map((token) => String(token.contract_address || '').toLowerCase())
            .filter(Boolean),
    );
    for (const token of balanceTokens) {
        const address = String(token.contract_address || '').toLowerCase();
        if (!address || knownAddresses.has(address)) continue;
        knownAddresses.add(address);
        merged.push(token);
    }
    return merged;
}

function summarizeAllChainBalances(allChainBalances: unknown) {
    if (!allChainBalances || typeof allChainBalances !== 'object') return undefined;
    const chains = Object.entries(allChainBalances as Record<string, any>)
        .slice(0, 8)
        .map<Record<string, any> | null>(([chainKey, snapshot]) => {
            if (!snapshot || typeof snapshot !== 'object') return null;
            const tokens = Array.isArray(snapshot.tokens)
                ? summarizeTokenArray(snapshot.tokens)
                : summarizeBalanceTokens(snapshot.tokens);
            return stripEmptyEntries({
                chain: normalizeStringOrNumber(chainKey),
                native: normalizePrimitive(snapshot.ethBalanceFormatted ?? snapshot.ethBalance ?? snapshot.nativeBalance),
                tokens,
            });
        })
        .filter((item): item is Record<string, any> => Boolean(item && Object.keys(item).length > 0));
    return chains.length > 0 ? chains : undefined;
}

function summarizeTokenArray(tokens: unknown): CompactTokenBalance[] | undefined {
    if (!Array.isArray(tokens)) return undefined;
    const compact = tokens
        .slice(0, 8)
        .map<CompactTokenBalance | null>((token) => {
            if (!token || typeof token !== 'object') return null;
            const item = token as Record<string, any>;
            return stripEmptyEntries({
                symbol: normalizeString(item.symbol),
                contract_address: normalizeString(item.contractAddress || item.contract_address || item.address),
                balance: normalizePrimitive(item.balance ?? item.tokenBalance ?? item.token_balance ?? item.formatted ?? item.amount),
                decimals: normalizePrimitive(item.decimals),
            });
        })
        .filter((item): item is CompactTokenBalance => Boolean(item && Object.keys(item).length > 0));
    return compact.length > 0 ? compact : undefined;
}

function summarizeBalanceTokens(balance: unknown): CompactTokenBalance[] | undefined {
    if (!balance || typeof balance !== 'object') return undefined;
    if (Array.isArray(balance)) return summarizeTokenArray(balance);
    const compact = Object.entries(balance as Record<string, any>)
        .slice(0, 8)
        .map<CompactTokenBalance | null>(([key, value]) => {
            if (value && typeof value === 'object') {
                const item = value as Record<string, any>;
                return stripEmptyEntries({
                    symbol: normalizeString(item.symbol || (isLikelyAddress(key) ? undefined : key)),
                    contract_address: normalizeString(item.contractAddress || item.contract_address || item.address || (isLikelyAddress(key) ? key : undefined)),
                    balance: normalizePrimitive(item.balance ?? item.tokenBalance ?? item.token_balance ?? item.formatted ?? item.amount),
                    decimals: normalizePrimitive(item.decimals),
                });
            }
            return stripEmptyEntries({
                symbol: normalizeString(isLikelyAddress(key) ? undefined : key),
                contract_address: normalizeString(isLikelyAddress(key) ? key : undefined),
                balance: normalizePrimitive(value),
            });
        })
        .filter((item): item is CompactTokenBalance => Boolean(item && Object.keys(item).length > 0));
    return compact.length > 0 ? compact : undefined;
}

function summarizeAddressClassifications(classifications: ChatContextSnapshot['requestedAddressClassifications']) {
    if (!Array.isArray(classifications) || classifications.length === 0) return undefined;
    const compact = classifications.slice(0, 6).map((item) => stripEmptyEntries({
        address: normalizePrimitive(item.address),
        kind: normalizePrimitive(item.kind),
        chain_id: normalizePrimitive(item.chainId),
        chain: normalizePrimitive(item.chainName),
        source: normalizePrimitive(item.source),
    }));
    return compact.length > 0 ? compact : undefined;
}

function summarizeFarcaster(farcaster: Record<string, any> | null | undefined) {
    if (!farcaster || typeof farcaster !== 'object') return undefined;
    const walletEvidence = farcaster.walletEvidence && typeof farcaster.walletEvidence === 'object'
        ? farcaster.walletEvidence as Record<string, any>
        : {};
    const socialProfile = farcaster.socialProfile && typeof farcaster.socialProfile === 'object'
        ? farcaster.socialProfile as Record<string, any>
        : walletEvidence.socialProfile && typeof walletEvidence.socialProfile === 'object'
            ? walletEvidence.socialProfile as Record<string, any>
            : {};
    const accountStatus = farcaster.accountStatus && typeof farcaster.accountStatus === 'object'
        ? farcaster.accountStatus as Record<string, any>
        : walletEvidence.accountStatus && typeof walletEvidence.accountStatus === 'object'
            ? walletEvidence.accountStatus as Record<string, any>
            : {};
    const qualitySignals = farcaster.qualitySignals && typeof farcaster.qualitySignals === 'object'
        ? farcaster.qualitySignals as Record<string, any>
        : walletEvidence.qualitySignals && typeof walletEvidence.qualitySignals === 'object'
            ? walletEvidence.qualitySignals as Record<string, any>
            : {};
    return stripEmptyEntries({
        handle: normalizePrimitive(farcaster.handle || farcaster.username || farcaster.kikoHandle),
        display_name: normalizePrimitive(farcaster.displayName),
        fid: normalizePrimitive(farcaster.fid),
        social_profile: summarizeFarcasterSocialProfile(socialProfile),
        account_status: summarizeFarcasterAccountStatus(accountStatus),
        quality_signals: summarizeFarcasterQualitySignals(qualitySignals),
        identity_tags: limitArray(
            Array.isArray(farcaster.identityTags)
                ? farcaster.identityTags
                : Array.isArray(walletEvidence.identityTags)
                    ? walletEvidence.identityTags
                    : undefined,
            16,
        ),
        wallet_source: normalizePrimitive(farcaster.walletSource || walletEvidence.source),
        primary_verified_evm_address: normalizePrimitive(farcaster.primaryVerifiedEvmAddress || walletEvidence.primaryVerifiedEvmAddress),
        pnl_eligible_evm_addresses: limitArray(
            Array.isArray(farcaster.pnlEligibleEvmAddresses)
                ? farcaster.pnlEligibleEvmAddresses
                : Array.isArray(walletEvidence.pnlEligibleEvmAddresses)
                    ? walletEvidence.pnlEligibleEvmAddresses
                    : undefined,
            5,
        ),
        trading_wallet_candidate_evm_addresses: limitArray(
            Array.isArray(farcaster.tradingWalletCandidateEvmAddresses)
                ? farcaster.tradingWalletCandidateEvmAddresses
                : Array.isArray(walletEvidence.tradingWalletCandidateEvmAddresses)
                    ? walletEvidence.tradingWalletCandidateEvmAddresses
                    : undefined,
            5,
        ),
        confirmed_trading_wallet_addresses: limitArray(
            Array.isArray(farcaster.confirmedTradingWalletAddresses)
                ? farcaster.confirmedTradingWalletAddresses
                : Array.isArray(walletEvidence.confirmedTradingWalletAddresses)
                    ? walletEvidence.confirmedTradingWalletAddresses
                    : undefined,
            5,
        ),
        wallet_candidates: summarizeFarcasterWalletCandidates(
            Array.isArray(farcaster.walletCandidates)
                ? farcaster.walletCandidates
                : Array.isArray(walletEvidence.walletCandidates)
                    ? walletEvidence.walletCandidates
                    : undefined,
        ),
        wallet_evidence_policy: walletEvidence.answerPolicy && typeof walletEvidence.answerPolicy === 'object'
            ? stripEmptyEntries({
                can_use_for_pnl_input: normalizePrimitive(walletEvidence.answerPolicy.canUseForPnlInput),
                can_answer_pnl: normalizePrimitive(walletEvidence.answerPolicy.canAnswerPnl),
                trading_wallet_rule: truncateText(walletEvidence.answerPolicy.tradingWalletRule, 280),
                custody_address_rule: truncateText(walletEvidence.answerPolicy.custodyAddressRule, 240),
            })
            : undefined,
    });
}

function summarizeFarcasterAccountStatus(status: Record<string, any>) {
    const viewer = status.viewerContext && typeof status.viewerContext === 'object'
        ? status.viewerContext as Record<string, any>
        : {};
    return stripEmptyEntries({
        source: normalizePrimitive(status.source),
        fid_registered: normalizePrimitive(status.fidRegistered ?? status.fid_registered),
        username_present: normalizePrimitive(status.usernamePresent ?? status.username_present),
        custody_address_present: normalizePrimitive(status.custodyAddressPresent ?? status.custody_address_present),
        has_verified_evm_wallet: normalizePrimitive(status.hasVerifiedEvmWallet ?? status.has_verified_evm_wallet),
        has_verified_sol_wallet: normalizePrimitive(status.hasVerifiedSolWallet ?? status.has_verified_sol_wallet),
        has_verified_external_accounts: normalizePrimitive(status.hasVerifiedExternalAccounts ?? status.has_verified_external_accounts),
        auth_address_count: normalizePrimitive(status.authAddressCount ?? status.auth_address_count),
        farcaster_pro_status: normalizePrimitive(status.farcasterProStatus ?? status.farcaster_pro_status),
        power_badge: normalizePrimitive(status.powerBadge ?? status.power_badge),
        viewer_context: stripEmptyEntries({
            following: normalizePrimitive(viewer.following),
            followed_by: normalizePrimitive(viewer.followedBy ?? viewer.followed_by),
            blocking: normalizePrimitive(viewer.blocking),
            blocked_by: normalizePrimitive(viewer.blockedBy ?? viewer.blocked_by),
        }),
        status_tags: limitArray(
            Array.isArray(status.statusTags)
                ? status.statusTags
                : Array.isArray(status.status_tags)
                    ? status.status_tags
                    : undefined,
            16,
        ),
        interpretation: truncateText(status.interpretation, 220),
    });
}

function summarizeFarcasterSocialProfile(profile: Record<string, any>) {
    const verifiedAccounts = Array.isArray(profile.verifiedAccounts)
        ? profile.verifiedAccounts
        : Array.isArray(profile.verified_accounts)
            ? profile.verified_accounts
            : [];
    const mentions = profile.profileMentions && typeof profile.profileMentions === 'object'
        ? profile.profileMentions as Record<string, any>
        : {};
    const mentionedProfiles = Array.isArray(mentions.profiles) ? mentions.profiles : [];
    const mentionedChannels = Array.isArray(mentions.channels) ? mentions.channels : [];

    return stripEmptyEntries({
        bio: truncateText(profile.bio, 500),
        pfp_url: normalizePrimitive(profile.pfpUrl || profile.pfp_url),
        follower_count: normalizePrimitive(profile.followerCount ?? profile.follower_count),
        following_count: normalizePrimitive(profile.followingCount ?? profile.following_count),
        verified_accounts: verifiedAccounts.slice(0, 8).map((account: any) => stripEmptyEntries({
            platform: normalizePrimitive(account?.platform),
            username: normalizePrimitive(account?.username),
        })).filter((item: Record<string, any>) => Object.keys(item).length > 0),
        mentioned_profiles: mentionedProfiles.slice(0, 6).map((profileItem: any) => stripEmptyEntries({
            fid: normalizePrimitive(profileItem?.fid),
            username: normalizePrimitive(profileItem?.username),
            display_name: normalizePrimitive(profileItem?.displayName || profileItem?.display_name),
        })).filter((item: Record<string, any>) => Object.keys(item).length > 0),
        mentioned_channels: mentionedChannels.slice(0, 6).map((channel: any) => stripEmptyEntries({
            id: normalizePrimitive(channel?.id),
            name: normalizePrimitive(channel?.name),
        })).filter((item: Record<string, any>) => Object.keys(item).length > 0),
    });
}

function summarizeFarcasterQualitySignals(signals: Record<string, any>) {
    return stripEmptyEntries({
        neynar_user_score: normalizePrimitive(signals.neynarUserScore ?? signals.neynar_user_score),
        score: normalizePrimitive(signals.score),
        score_source: normalizePrimitive(signals.scoreSource || signals.score_source),
        quality_tier: normalizePrimitive(signals.qualityTier || signals.quality_tier),
        quality_threshold: normalizePrimitive(signals.qualityThreshold ?? signals.quality_threshold),
        score_interpretation: truncateText(signals.scoreInterpretation || signals.score_interpretation, 220),
        pro_status: normalizePrimitive(signals.proStatus || signals.pro_status),
        power_badge: normalizePrimitive(signals.powerBadge ?? signals.power_badge),
        labels: limitArray(Array.isArray(signals.labels) ? signals.labels : undefined, 12),
    });
}

function summarizeFarcasterWalletCandidates(candidates: unknown) {
    if (!Array.isArray(candidates) || candidates.length === 0) return undefined;
    const compact = candidates.slice(0, 8).map((candidate) => {
        const item = candidate && typeof candidate === 'object' ? candidate as Record<string, any> : {};
        return stripEmptyEntries({
            address: normalizePrimitive(item.address),
            network: normalizePrimitive(item.network),
            address_type: normalizePrimitive(item.addressType || item.address_type),
            wallet_role: normalizePrimitive(item.walletRole || item.wallet_role),
            analysis_role: normalizePrimitive(item.analysisRole || item.analysis_role),
            source: normalizePrimitive(item.source),
            confidence: normalizePrimitive(item.confidence),
            is_primary: normalizePrimitive(item.isPrimary ?? item.is_primary),
            pnl_eligible: normalizePrimitive(item.pnlEligible ?? item.pnl_eligible),
            can_assume_trading_wallet: normalizePrimitive(item.canAssumeTradingWallet ?? item.can_assume_trading_wallet),
        });
    }).filter((item) => Object.keys(item).length > 0);
    return compact.length > 0 ? compact : undefined;
}

function normalizePrimitive(value: unknown): string | number | boolean | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : undefined;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    return undefined;
}

function normalizeString(value: unknown): string | undefined {
    const primitive = normalizePrimitive(value);
    return typeof primitive === 'string' ? primitive : undefined;
}

function normalizeStringOrNumber(value: unknown): string | number | undefined {
    const primitive = normalizePrimitive(value);
    return typeof primitive === 'string' || typeof primitive === 'number' ? primitive : undefined;
}

function limitArray(values: string[] | undefined, maxLen: number): string[] | undefined {
    if (!Array.isArray(values) || values.length === 0) return undefined;
    const compact = values.slice(0, maxLen).map((item) => String(item || '').trim()).filter(Boolean);
    return compact.length > 0 ? compact : undefined;
}

function truncateText(value: unknown, maxLen: number): string | undefined {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) return undefined;
    return text.length <= maxLen ? text : `${text.slice(0, maxLen)}...`;
}

function isLikelyAddress(value: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function stripEmptyEntries<T extends Record<string, any>>(input: T): T {
    return Object.fromEntries(
        Object.entries(input).filter(([, value]) => {
            if (value === null || value === undefined) return false;
            if (typeof value === 'string' && !value.trim()) return false;
            if (Array.isArray(value) && value.length === 0) return false;
            if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return false;
            return true;
        }),
    ) as T;
}
