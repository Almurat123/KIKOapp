"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTERACTIVE_READ_PROFILE = exports.EXECUTION_FEE_PROFILE = exports.TX_NONCE_PROFILE = exports.TRADE_VISIBILITY_PROFILE = exports.TRADE_QUOTE_PROFILE = exports.TRADE_READ_PROFILE = exports.TRADE_METADATA_PROFILE = void 0;
exports.resolveRpcCallProfile = resolveRpcCallProfile;
exports.TRADE_METADATA_PROFILE = {
    purpose: 'trade_execution',
    strategy: 'fast',
    importance: 'critical',
    latencyBudgetMs: 900,
};
exports.TRADE_READ_PROFILE = {
    purpose: 'trade_execution',
    strategy: 'fast',
    importance: 'critical',
    latencyBudgetMs: 1000,
};
exports.TRADE_QUOTE_PROFILE = {
    purpose: 'trade_execution',
    strategy: 'fast',
    importance: 'critical',
    latencyBudgetMs: 1200,
};
exports.TRADE_VISIBILITY_PROFILE = {
    purpose: 'tx_visibility',
    strategy: 'fast',
    importance: 'critical',
    latencyBudgetMs: 1500,
};
exports.TX_NONCE_PROFILE = {
    purpose: 'tx_visibility',
    strategy: 'fast',
    importance: 'critical',
    latencyBudgetMs: 1200,
};
exports.EXECUTION_FEE_PROFILE = {
    purpose: 'tx_visibility',
    strategy: 'fast',
    importance: 'critical',
    latencyBudgetMs: 900,
};
exports.INTERACTIVE_READ_PROFILE = {
    purpose: 'interactive_read',
    strategy: 'cheap',
    importance: 'normal',
    latencyBudgetMs: 1500,
};
function resolveRpcCallProfile(profile, fallback) {
    return {
        purpose: (profile === null || profile === void 0 ? void 0 : profile.purpose) || fallback.purpose,
        strategy: (profile === null || profile === void 0 ? void 0 : profile.strategy) || fallback.strategy || 'cheap',
        importance: (profile === null || profile === void 0 ? void 0 : profile.importance) || fallback.importance || 'normal',
        latencyBudgetMs: profile === null || profile === void 0 ? void 0 : profile.latencyBudgetMs,
    };
}
