"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePrivyServerConfig = resolvePrivyServerConfig;
function resolvePrivyServerConfig(env) {
    if (env === void 0) { env = process.env; }
    var appId = String(env.PRIVY_APP_ID || '').trim();
    var appSecret = String(env.PRIVY_APP_SECRET || '').trim();
    var frontendAppId = String(env.VITE_PRIVY_APP_ID || '').trim();
    return {
        appId: appId,
        appSecret: appSecret,
        frontendAppId: frontendAppId,
        appIdMismatch: Boolean(appId && frontendAppId && appId !== frontendAppId),
    };
}
