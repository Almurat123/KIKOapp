// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Rowan
// Reason: copy-trade must not depend on LLM-rewritten wallet strings for exact
//         target identities, especially when repeated characters can be dropped
//         during model normalization.
// Goal: provide one deterministic extractor for user-supplied wallet literals so
//       EVM and Solana copy-trade targets are recovered from raw text, not model
//       paraphrases.
// Owns: extracting strict wallet-address literals from user text and normalizing
//       extracted candidates into execution-safe identity strings.
// Does Not Own: deciding whether an extracted wallet is the intended copy-trade
//               target, signed payload validation, or persistence uniqueness.
// Design Language:
// - exact user-text wallet literals outrank LLM normalized address entities
// - multiple wallet literals are ambiguity, not permission for the model to pick
// - EVM addresses normalize to lowercase; Solana addresses preserve case
// - do not repair or autocomplete partial wallet strings in this owner
// Document Provenance:
// - Source: chat transcript + runtime logs + production database inspection for BSC copy-trade target wallets
// - Kind: runtime observation
// - Retrieved: 2026-04-13
// - Applied To: deterministic EVM/Solana wallet literal extraction for copy-trade
// - Verification: verified in unit tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/copytrade-race-recovery.md
// - /Users/almurat/KiKo/system-journal/owner-map/copytrade-buy-confirmation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-copytrade-wallet-entity-hardening.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-copytrade-wallet-deterministic-extraction.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import {
    isStrictEvmAddress,
    isStrictSolanaAddress,
} from './validation.js';

export type WalletAddressKind = 'evm' | 'solana';

export interface WalletAddressCandidate {
    address: string;
    kind: WalletAddressKind;
    raw: string;
    start: number;
    end: number;
}

const EVM_CANDIDATE_RE = /0x[a-fA-F0-9]{40}/g;
const SOLANA_CANDIDATE_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

export function extractWalletAddressesFromText(text: string | null | undefined): WalletAddressCandidate[] {
    const source = String(text || '');
    const candidates: WalletAddressCandidate[] = [];
    const seen = new Set<string>();

    for (const match of source.matchAll(EVM_CANDIDATE_RE)) {
        const raw = match[0];
        const start = match.index ?? -1;
        const end = start + raw.length;
        if (start < 0 || !hasIdentifierBoundary(source, start, end)) continue;
        if (!isStrictEvmAddress(raw)) continue;
        pushUnique(candidates, seen, {
            address: raw.toLowerCase(),
            kind: 'evm',
            raw,
            start,
            end,
        });
    }

    for (const match of source.matchAll(SOLANA_CANDIDATE_RE)) {
        const raw = match[0];
        const start = match.index ?? -1;
        const end = start + raw.length;
        if (start < 0 || !hasIdentifierBoundary(source, start, end)) continue;
        if (!isStrictSolanaAddress(raw)) continue;
        pushUnique(candidates, seen, {
            address: raw,
            kind: 'solana',
            raw,
            start,
            end,
        });
    }

    return candidates.sort((a, b) => a.start - b.start);
}

export function extractUniqueWalletAddressesFromText(text: string | null | undefined): string[] {
    return extractWalletAddressesFromText(text).map((candidate) => candidate.address);
}

export function extractSingleWalletAddressFromText(text: string | null | undefined): string | null {
    const candidates = extractUniqueWalletAddressesFromText(text);
    return candidates.length === 1 ? candidates[0] : null;
}

function pushUnique(candidates: WalletAddressCandidate[], seen: Set<string>, candidate: WalletAddressCandidate): void {
    const key = `${candidate.kind}:${candidate.address}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
}

function hasIdentifierBoundary(source: string, start: number, end: number): boolean {
    const before = start > 0 ? source[start - 1] : '';
    const after = end < source.length ? source[end] : '';
    return !isIdentifierChar(before) && !isIdentifierChar(after);
}

function isIdentifierChar(value: string): boolean {
    return /^[a-zA-Z0-9]$/.test(value);
}
