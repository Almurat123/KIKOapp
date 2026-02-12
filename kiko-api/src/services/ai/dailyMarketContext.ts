import { getMarketOverview, getLastUpdateTime as getMarketLastUpdateTime } from '../../repositories/marketRepository.js';
import { getChainsData, getLastUpdateTime as getChainsLastUpdateTime } from '../../repositories/chainRepository.js';
import type { ChainData } from '../defillama.js';

function formatCompactUsd(value?: number): string {
    if (value === undefined || value === null || Number.isNaN(value)) return 'n/a';
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';

    if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(2)}K`;
    return `${sign}$${abs.toFixed(2)}`;
}

function formatPct(value?: number): string {
    if (value === undefined || value === null || Number.isNaN(value)) return 'n/a';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
}

function formatNumber(value?: number): string {
    if (value === undefined || value === null || Number.isNaN(value)) return 'n/a';
    return Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function pickChain(chains: ChainData[], chainName?: string): ChainData | null {
    if (!chainName) return null;
    const target = chainName.trim().toLowerCase();
    if (!target) return null;
    return chains.find(c => (c.name || '').trim().toLowerCase() === target) || null;
}

function formatChainLine(chain: ChainData): string {
    const tvl = formatCompactUsd(chain.tvl);
    const tvlChange = formatPct(chain.tvlChange24h);
    const gas = chain.gasPrice ? `${chain.gasPrice}` : 'n/a';
    const txns = chain.txns24h !== undefined ? formatNumber(chain.txns24h) : 'n/a';
    const vol = chain.volume24h !== undefined ? formatCompactUsd(chain.volume24h) : 'n/a';

    return `${chain.name}: TVL ${tvl} (${tvlChange} 24h), Vol24h ${vol}, Txns24h ${txns}, Gas ${gas}`;
}

export async function buildDailyMarketContext(params?: { chainName?: string }): Promise<string | null> {
    try {
        const [overview, overviewUpdatedAt, chains, chainsUpdatedAt] = await Promise.all([
            getMarketOverview(),
            getMarketLastUpdateTime('overview'),
            getChainsData(),
            getChainsLastUpdateTime(),
        ]);

        // If nothing is available, don't inject anything.
        if (!overview && (!chains || chains.length === 0)) return null;

        const todayUtc = new Date().toISOString().slice(0, 10);
        const lines: string[] = [];

        lines.push('[DAILY_MARKET_CONTEXT]');
        lines.push(`- Date (UTC): ${todayUtc}`);
        if (overviewUpdatedAt) lines.push(`- Overview Updated: ${overviewUpdatedAt.toISOString()} (UTC)`);
        if (chainsUpdatedAt) lines.push(`- Chains Updated: ${chainsUpdatedAt.toISOString()} (UTC)`);

        if (overview) {
            lines.push('\nMarket (cached overview):');
            lines.push(`- Sentiment: Fear & Greed ${overview.fearGreedIndex} (${overview.fearGreedClassification || 'n/a'})`);
            lines.push(`- Global MCap: ${formatCompactUsd(overview.globalMarketCap)} (24h: ${formatPct(overview.mcapChange24h)})`);
            lines.push(`- 24h Volume: ${formatCompactUsd(overview.volume24h)}`);
            lines.push(`- BTC Dominance: ${overview.bitcoinDominance?.toFixed?.(2) ?? 'n/a'}% (24h: ${formatPct(overview.btcDomChange24h)})`);
            if (overview.ethGasPrice) lines.push(`- Ethereum Gas (base): ${overview.ethGasPrice}`);
            if (overview.globalOpenInterest !== undefined) lines.push(`- Global OI: ${formatCompactUsd(overview.globalOpenInterest)}`);
        }

        if (chains && chains.length > 0) {
            const selected = pickChain(chains, params?.chainName);
            const topChains = chains
                .slice()
                .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
                .slice(0, 6);

            lines.push('\nChains (cached conditions):');
            if (selected) {
                lines.push(`- Current Chain: ${formatChainLine(selected)}`);
            }
            lines.push(`- Top Chains by TVL: ${topChains.map(c => formatChainLine(c)).join(' | ')}`);
        }

        lines.push('\nInstruction: Use this as today\'s snapshot. When the user asks about the market (or plans a trade), start your answer with a short 2–4 line summary of the market tone and network cost conditions based on this cache.');

        return lines.join('\n');
    } catch {
        return null;
    }
}
