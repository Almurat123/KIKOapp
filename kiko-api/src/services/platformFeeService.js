"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlatformFee = getPlatformFee;
exports.isValidEvmAddress = isValidEvmAddress;
var env_js_1 = require("../config/env.js");
function getPlatformFee(context, bpsOverride) {
    var _a, _b;
    if (!((_a = env_js_1.env.platformFees) === null || _a === void 0 ? void 0 : _a.enabled)) {
        console.log('[PlatformFee] Fees DISABLED, returning 0 bps');
        return { bps: 0 };
    }
    var bps = Number.isFinite(bpsOverride)
        ? bpsOverride
        : (context === 'copyTrade' ? env_js_1.env.platformFees.copyTradeBps : env_js_1.env.platformFees.swapBps);
    var safeBps = Number.isFinite(bps) ? Math.max(0, Math.min(1000, Math.floor(bps))) : 0; // hard cap 10%
    console.log('[PlatformFee] Fees ENABLED:', { context: context, bps: safeBps, evmRecipient: (_b = env_js_1.env.platformFees.evmRecipient) === null || _b === void 0 ? void 0 : _b.slice(0, 12) });
    return {
        bps: safeBps,
        evmRecipient: env_js_1.env.platformFees.evmRecipient,
        solanaRecipient: env_js_1.env.platformFees.solanaRecipient,
    };
}
function isValidEvmAddress(address) {
    if (!address)
        return false;
    return /^0x[0-9a-fA-F]{40}$/.test(address);
}
