"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TRENDING_WEIGHTS = void 0;
exports.computeTrendingScore = computeTrendingScore;
exports.DEFAULT_TRENDING_WEIGHTS = {
    // Fitted against `test/backlog.md` Dex榜单导出（base/eth/bsc/sol 各100条）。
    // Note: backlog里有“boosts”列，但我们的免费数据源不会稳定提供 boosts，因此这里做了去除后重新归一化。
    volume24h: 0.0361,
    txns24h: 0.4496,
    makersEst: 0.1324,
    liquidity: 0.0446,
    priceChange5m: 0.1225,
    priceChange1h: 0.0998,
    priceChange6h: 0.0604,
    priceChange24h: 0.0545,
};
function safeNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
}
function logScore(value) {
    var n = Math.max(0, safeNumber(value));
    return Math.log10(n + 1);
}
function momentumScore(pct) {
    var n = safeNumber(pct);
    // Dex榜单会对极端涨跌敏感，但不会线性无限放大；用tanh做饱和。
    // 50% -> ~0.76, 200% -> ~0.999
    return Math.tanh(n / 50);
}
/**
 * Multi-window, multi-factor trending score (Dex-like).
 * Higher is better.
 */
function computeTrendingScore(token, weights) {
    if (weights === void 0) { weights = exports.DEFAULT_TRENDING_WEIGHTS; }
    var volume = logScore(token.volume24h);
    var txns = logScore(token.txns24h);
    var liquidity = logScore(token.liquidity);
    var makersEst = logScore(token.txns24h ? Math.floor(safeNumber(token.txns24h) * 0.5) : 0);
    var m5 = momentumScore(token.priceChange5m);
    var h1 = momentumScore(token.priceChange1h);
    var h6 = momentumScore(token.priceChange6h);
    var h24 = momentumScore(token.priceChange24h);
    return (weights.volume24h * volume +
        weights.txns24h * txns +
        weights.makersEst * makersEst +
        weights.liquidity * liquidity +
        weights.priceChange5m * m5 +
        weights.priceChange1h * h1 +
        weights.priceChange6h * h6 +
        weights.priceChange24h * h24);
}
