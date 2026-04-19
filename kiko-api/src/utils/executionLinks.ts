// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Renata
// Reason: Agent-mode mutation tools need to return user-visible receipt URLs
//         next to hashes, order ids, token addresses, and market identifiers so
//         final replies do not rely on the model guessing explorer or product
//         link formats.
// Goal: centralize deterministic URL construction for transaction receipts,
//       deployed-token pages, Polymarket market pages, and tracked-wallet pages.
// Owns: pure URL formatting for known KiKo-supported chains and product pages.
// Does Not Own: transaction execution, chain support policy, provider API calls,
//               or frontend card rendering.
// Design Language:
// - never fabricate hashes; only format URLs from concrete tool-result fields
// - prefer exact product pages when a product id/slug is available
// - expose both chain explorer and product-specific tracker URLs where they answer different user questions
// - keep this module side-effect free; do not import env-heavy chain clients here
// Document Provenance:
// - Source: operator requirement on 2026-04-19 for Agent-mode execution replies
// - Kind: product instruction / runtime observation
// - Retrieved: 2026-04-19
// - Applied To: transaction, token, Polymarket, and copy-trade URL shaping
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/kiko-web/src/components/Chat/TransactionStatusCard.tsx
// - Kind: repo doc
// - Retrieved: 2026-04-19
// - Applied To: supported explorer URL bases for chat transaction cards
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-agent-execution-receipt-links.md

const LIFI_SOLANA_CHAIN_ID = 1151111081099710;

const TX_EXPLORER_BASE_BY_CHAIN_ID: Record<number, string> = {
    1: 'https://etherscan.io/tx/',
    8453: 'https://basescan.org/tx/',
    56: 'https://bscscan.com/tx/',
    137: 'https://polygonscan.com/tx/',
    42161: 'https://arbiscan.io/tx/',
    10: 'https://optimistic.etherscan.io/tx/',
    43114: 'https://snowtrace.io/tx/',
    900: 'https://solscan.io/tx/',
    [LIFI_SOLANA_CHAIN_ID]: 'https://solscan.io/tx/',
};

const ADDRESS_EXPLORER_BASE_BY_CHAIN_ID: Record<number, string> = {
    1: 'https://etherscan.io/address/',
    8453: 'https://basescan.org/address/',
    56: 'https://bscscan.com/address/',
    137: 'https://polygonscan.com/address/',
    42161: 'https://arbiscan.io/address/',
    10: 'https://optimistic.etherscan.io/address/',
    43114: 'https://snowtrace.io/address/',
    900: 'https://solscan.io/account/',
    [LIFI_SOLANA_CHAIN_ID]: 'https://solscan.io/account/',
};

const CHAIN_NAME_TO_ID: Record<string, number> = {
    eth: 1,
    ethereum: 1,
    mainnet: 1,
    base: 8453,
    bsc: 56,
    bnb: 56,
    binance: 56,
    polygon: 137,
    matic: 137,
    arbitrum: 42161,
    arb: 42161,
    optimism: 10,
    op: 10,
    solana: 900,
    sol: 900,
};

function normalizeChainId(chainId: string | number | null | undefined): number | null {
    if (chainId === null || chainId === undefined) return null;
    if (typeof chainId === 'number' && Number.isFinite(chainId)) return Math.trunc(chainId);
    const raw = String(chainId || '').trim().toLowerCase();
    if (!raw) return null;
    if (CHAIN_NAME_TO_ID[raw]) return CHAIN_NAME_TO_ID[raw];
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function nonEmpty(value: unknown): string {
    return String(value || '').trim();
}

export function buildTransactionExplorerUrl(
    chainId: string | number | null | undefined,
    txHash: string | null | undefined,
): string | undefined {
    const hash = nonEmpty(txHash);
    if (!hash) return undefined;
    const normalizedChainId = normalizeChainId(chainId);
    const base = normalizedChainId ? TX_EXPLORER_BASE_BY_CHAIN_ID[normalizedChainId] : undefined;
    return base ? `${base}${hash}` : undefined;
}

export function buildAddressExplorerUrl(
    chainId: string | number | null | undefined,
    address: string | null | undefined,
): string | undefined {
    const value = nonEmpty(address);
    if (!value) return undefined;
    const normalizedChainId = normalizeChainId(chainId);
    const base = normalizedChainId ? ADDRESS_EXPLORER_BASE_BY_CHAIN_ID[normalizedChainId] : undefined;
    return base ? `${base}${value}` : undefined;
}

export function buildLiFiTransactionUrl(txHash: string | null | undefined): string | undefined {
    const hash = nonEmpty(txHash);
    return hash ? `https://scan.li.fi/tx/${hash}` : undefined;
}

export function buildClankerTokenUrl(tokenAddress: string | null | undefined): string | undefined {
    const address = nonEmpty(tokenAddress);
    return address ? `https://www.clanker.world/clanker/${address}` : undefined;
}

export function buildPolymarketMarketUrl(marketSlug: string | null | undefined): string | undefined {
    const slug = nonEmpty(marketSlug);
    return slug ? `https://polymarket.com/event/${encodeURIComponent(slug)}` : undefined;
}

export function buildPolymarketProfileUrl(walletAddress: string | null | undefined): string | undefined {
    const wallet = nonEmpty(walletAddress);
    return wallet ? `https://polymarket.com/profile/${encodeURIComponent(wallet)}` : undefined;
}
