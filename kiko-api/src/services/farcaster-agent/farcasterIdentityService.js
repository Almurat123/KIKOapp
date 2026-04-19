"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeFarcasterUsername = normalizeFarcasterUsername;
exports.extractPrivyFarcasterAccount = extractPrivyFarcasterAccount;
exports.getVerifiedPrivyFarcasterAccount = getVerifiedPrivyFarcasterAccount;
exports.buildFarcasterProfileUrl = buildFarcasterProfileUrl;
exports.buildFarcasterLinkUrl = buildFarcasterLinkUrl;
exports.getUserByFarcasterFid = getUserByFarcasterFid;
exports.syncVerifiedPrivyFarcasterUser = syncVerifiedPrivyFarcasterUser;
exports.maybeAutoSyncVerifiedPrivyFarcasterUser = maybeAutoSyncVerifiedPrivyFarcasterUser;
// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Linh Tran
// Reason: Farcaster agent ingress must resolve mention authors against the
//         shared User table without assuming webhook-only flows or frontend
//         state. Public mention replies also need one canonical link-back URL,
//         and verified Farcaster linkage must come from Privy instead of
//         trusting client-supplied FIDs.
// Goal: keep Farcaster identity normalization and KiKo link URL shaping in one
//       place so ingress/reply layers stay deterministic.
// Owns: Farcaster username normalization, profile URL shaping, link URL shaping,
//       linked-user lookup by FID, and Privy-verified Farcaster identity sync.
// Does Not Own: polling cadence, or AI execution.
// Design Language:
// - Normalize usernames before comparison or persistence.
// - Use FID as the canonical external identity key.
// - Keep public bind prompts stable and short.
// - Never trust client-supplied Farcaster ids when Privy exposes the linked account.
// Document Provenance:
// - Source: repo code review of `/api/users/farcaster` sync path
// - Kind: repo doc
// - Retrieved: 2026-04-10
// - Applied To: resolving linked users by persisted `farcasterFid`
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/kiko-web/src/contexts/FarcasterContext.tsx
// - Kind: repo doc
// - Retrieved: 2026-04-13
// - Applied To: extracting Farcaster identity from Privy linked accounts
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-farcaster-polling-agent-ingress.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-farcaster-verified-identity-sync.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
var prisma_js_1 = require("../../db/prisma.js");
var env_js_1 = require("../../config/env.js");
var server_auth_1 = require("@privy-io/server-auth");
var privy_js_1 = require("../../config/privy.js");
var privyWallet_js_1 = require("../privyWallet.js");
var _a = (0, privy_js_1.resolvePrivyServerConfig)(), PRIVY_APP_ID = _a.appId, PRIVY_APP_SECRET = _a.appSecret;
var farcasterIdentityPrivyClient = null;
var AUTO_SYNC_COOLDOWN_MS = 60000;
var autoSyncCooldown = new Map();
function getFarcasterIdentityPrivyClient() {
    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
        throw new Error('Privy server credentials are not configured');
    }
    if (!farcasterIdentityPrivyClient) {
        farcasterIdentityPrivyClient = new server_auth_1.PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
    }
    return farcasterIdentityPrivyClient;
}
function parseFarcasterFid(value) {
    var parsed = Number.parseInt(String(value !== null && value !== void 0 ? value : '').trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
function normalizeFarcasterUsername(username) {
    var value = String(username || '').trim().replace(/^@/, '');
    return value || null;
}
function extractPrivyFarcasterAccount(user) {
    var _a, _b, _c;
    var account = ((user === null || user === void 0 ? void 0 : user.linkedAccounts) || []).find(function (acc) {
        var type = String((acc === null || acc === void 0 ? void 0 : acc.type) || '').toLowerCase();
        var chainType = String((acc === null || acc === void 0 ? void 0 : acc.chainType) || '').toLowerCase();
        return type === 'farcaster' || (type === 'wallet' && chainType === 'farcaster');
    });
    return {
        farcasterFid: parseFarcasterFid((account === null || account === void 0 ? void 0 : account.fid) || (account === null || account === void 0 ? void 0 : account.subject) || ((_a = user === null || user === void 0 ? void 0 : user.farcaster) === null || _a === void 0 ? void 0 : _a.fid) || ((_b = user === null || user === void 0 ? void 0 : user.farcaster) === null || _b === void 0 ? void 0 : _b.subject) || null),
        username: normalizeFarcasterUsername((account === null || account === void 0 ? void 0 : account.username) || ((_c = user === null || user === void 0 ? void 0 : user.farcaster) === null || _c === void 0 ? void 0 : _c.username) || null),
    };
}
function getVerifiedPrivyFarcasterAccount(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var client, user;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    client = getFarcasterIdentityPrivyClient();
                    return [4 /*yield*/, client.getUser(userId)];
                case 1:
                    user = _a.sent();
                    return [2 /*return*/, extractPrivyFarcasterAccount(user)];
            }
        });
    });
}
function buildFarcasterProfileUrl(username) {
    var normalized = normalizeFarcasterUsername(username);
    return normalized ? "https://warpcast.com/".concat(normalized) : null;
}
function buildFarcasterLinkUrl(params) {
    var base = String(env_js_1.env.farcasterAgent.linkBaseUrl || 'https://kikoapp.app/settings').trim();
    try {
        var url = new URL(base);
        url.searchParams.set('connect', 'farcaster');
        if (params === null || params === void 0 ? void 0 : params.username) {
            url.searchParams.set('fc', normalizeFarcasterUsername(params.username) || '');
        }
        return url.toString();
    }
    catch (_a) {
        return base;
    }
}
function getUserByFarcasterFid(farcasterFid) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (!Number.isFinite(farcasterFid) || farcasterFid <= 0)
                return [2 /*return*/, null];
            return [2 /*return*/, prisma_js_1.default.user.findFirst({
                    where: { farcasterFid: farcasterFid },
                    orderBy: { createdAt: 'asc' },
                    include: {
                        settings: {
                            select: {
                                defaultChatModel: true,
                            },
                        },
                    },
                })];
        });
    });
}
function syncVerifiedPrivyFarcasterUser(params) {
    return __awaiter(this, void 0, void 0, function () {
        var verifiedAccount, farcasterFid, username, existingOwner, existingUser, user_1, embeddedWalletAddress, user;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getVerifiedPrivyFarcasterAccount(params.userId)];
                case 1:
                    verifiedAccount = _a.sent();
                    farcasterFid = Number(verifiedAccount.farcasterFid || 0);
                    username = normalizeFarcasterUsername(verifiedAccount.username);
                    if (!Number.isFinite(farcasterFid) || farcasterFid <= 0) {
                        return [2 /*return*/, { status: 'no_farcaster_account', user: null }];
                    }
                    return [4 /*yield*/, prisma_js_1.default.user.findFirst({
                            where: {
                                farcasterFid: farcasterFid,
                                NOT: { privyDid: params.userId },
                            },
                            select: { privyDid: true },
                        })];
                case 2:
                    existingOwner = _a.sent();
                    if (existingOwner) {
                        throw new Error('Farcaster account already linked to another user');
                    }
                    return [4 /*yield*/, prisma_js_1.default.user.findUnique({
                            where: { privyDid: params.userId },
                            select: {
                                privyDid: true,
                                username: true,
                            },
                        })];
                case 3:
                    existingUser = _a.sent();
                    if (!existingUser) return [3 /*break*/, 5];
                    return [4 /*yield*/, prisma_js_1.default.user.update({
                            where: { privyDid: params.userId },
                            data: {
                                username: existingUser.username || username,
                                farcasterFid: farcasterFid,
                                farcasterUsername: username,
                            },
                        })];
                case 4:
                    user_1 = _a.sent();
                    return [2 /*return*/, { status: 'synced', user: user_1 }];
                case 5: return [4 /*yield*/, (0, privyWallet_js_1.getEmbeddedWalletAddress)(params.userId).catch(function () { return null; })];
                case 6:
                    embeddedWalletAddress = _a.sent();
                    if (!embeddedWalletAddress) {
                        return [2 /*return*/, { status: 'missing_wallet', user: null }];
                    }
                    return [4 /*yield*/, prisma_js_1.default.user.create({
                            data: {
                                privyDid: params.userId,
                                username: username,
                                walletAddress: embeddedWalletAddress,
                                farcasterFid: farcasterFid,
                                farcasterUsername: username,
                            },
                        })];
                case 7:
                    user = _a.sent();
                    return [2 /*return*/, { status: 'synced', user: user }];
            }
        });
    });
}
function maybeAutoSyncVerifiedPrivyFarcasterUser(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var lastAttemptAt, existingUser;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!userId)
                        return [2 /*return*/];
                    lastAttemptAt = autoSyncCooldown.get(userId) || 0;
                    if ((Date.now() - lastAttemptAt) < AUTO_SYNC_COOLDOWN_MS) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, prisma_js_1.default.user.findUnique({
                            where: { privyDid: userId },
                            select: { farcasterFid: true },
                        }).catch(function () { return null; })];
                case 1:
                    existingUser = _a.sent();
                    if (existingUser === null || existingUser === void 0 ? void 0 : existingUser.farcasterFid) {
                        return [2 /*return*/];
                    }
                    autoSyncCooldown.set(userId, Date.now());
                    return [4 /*yield*/, syncVerifiedPrivyFarcasterUser({ userId: userId }).catch(function () { return undefined; })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
