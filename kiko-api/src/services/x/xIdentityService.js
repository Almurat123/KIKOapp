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
exports.extractPrivyXAccount = extractPrivyXAccount;
exports.getVerifiedPrivyXAccount = getVerifiedPrivyXAccount;
exports.normalizeXUsername = normalizeXUsername;
exports.buildXProfileUrl = buildXProfileUrl;
exports.buildXLinkUrl = buildXLinkUrl;
exports.serializeXContext = serializeXContext;
exports.getUserByXUserId = getUserByXUserId;
exports.syncVerifiedPrivyXUser = syncVerifiedPrivyXUser;
exports.maybeAutoSyncVerifiedPrivyXUser = maybeAutoSyncVerifiedPrivyXUser;
exports.getXContextForUser = getXContextForUser;
// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Almurat
// Reason: X identity linkage now needs a server-verified source of truth from
//         Privy to prevent clients from claiming arbitrary X accounts, and the
//         authenticated backend must be able to auto-persist verified X linkage
//         instead of relying on a frontend-only sync side effect.
// Goal: keep X identity normalization and Privy-backed verification in one
//       layer so route handlers never trust frontend-provided X account claims.
// Owns: X username normalization, profile/link URL shaping, and verified X
//       identity lookup for authenticated Privy users, including auto-sync into
//       the shared User row.
// Does Not Own: OAuth bot authorization, webhook ingress, or DM delivery.
// Design Language:
// - Never trust client-supplied X ids when Privy can verify the linked account.
// - Normalize handles before any persistence or comparison.
// - Keep route payloads limited to safe X context, not token material.
// - Existing authenticated users should gain verified X linkage without a second
//   manual bind step when Privy already knows the linked account.
// See also:
// - system-journal/INDEX.md
// - system-journal/fix-log/2026-04-09-x-oauth-official-account-flow.md
// - system-journal/fix-log/2026-04-10-x-user-auto-sync.md
// - system-journal/conflicts.md
var prisma_js_1 = require("../../db/prisma.js");
var env_js_1 = require("../../config/env.js");
var server_auth_1 = require("@privy-io/server-auth");
var privy_js_1 = require("../../config/privy.js");
var privyWallet_js_1 = require("../privyWallet.js");
var _a = (0, privy_js_1.resolvePrivyServerConfig)(), PRIVY_APP_ID = _a.appId, PRIVY_APP_SECRET = _a.appSecret;
var xIdentityPrivyClient = null;
var AUTO_SYNC_COOLDOWN_MS = 60000;
var autoSyncCooldown = new Map();
function getXIdentityPrivyClient() {
    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
        throw new Error('Privy server credentials are not configured');
    }
    if (!xIdentityPrivyClient) {
        xIdentityPrivyClient = new server_auth_1.PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
    }
    return xIdentityPrivyClient;
}
function extractPrivyXAccount(user) {
    var _a, _b, _c;
    var account = ((user === null || user === void 0 ? void 0 : user.linkedAccounts) || []).find(function (acc) {
        var type = String((acc === null || acc === void 0 ? void 0 : acc.type) || '').toLowerCase();
        return type === 'twitter' || type === 'x';
    });
    var xUserId = String((account === null || account === void 0 ? void 0 : account.subject) || (account === null || account === void 0 ? void 0 : account.userId) || ((_a = user === null || user === void 0 ? void 0 : user.twitter) === null || _a === void 0 ? void 0 : _a.subject) || ((_b = user === null || user === void 0 ? void 0 : user.twitter) === null || _b === void 0 ? void 0 : _b.userId) || '').trim() || null;
    var username = normalizeXUsername((account === null || account === void 0 ? void 0 : account.username) || ((_c = user === null || user === void 0 ? void 0 : user.twitter) === null || _c === void 0 ? void 0 : _c.username) || null);
    return { xUserId: xUserId, username: username };
}
function getVerifiedPrivyXAccount(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var client, user;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    client = getXIdentityPrivyClient();
                    return [4 /*yield*/, client.getUser(userId)];
                case 1:
                    user = _a.sent();
                    return [2 /*return*/, extractPrivyXAccount(user)];
            }
        });
    });
}
function normalizeXUsername(username) {
    var value = String(username || '').trim().replace(/^@/, '');
    return value || null;
}
function buildXProfileUrl(username) {
    var normalized = normalizeXUsername(username);
    return normalized ? "https://x.com/".concat(normalized) : null;
}
function buildXLinkUrl(params) {
    var base = String(env_js_1.env.x.linkBaseUrl || 'https://kikoapp.app/settings').trim();
    try {
        var url = new URL(base);
        url.searchParams.set('connect', 'x');
        if (params === null || params === void 0 ? void 0 : params.username) {
            url.searchParams.set('x', normalizeXUsername(params.username) || '');
        }
        return url.toString();
    }
    catch (_a) {
        return base;
    }
}
function serializeXContext(user) {
    var _a, _b;
    return {
        xUserId: (user === null || user === void 0 ? void 0 : user.xUserId) || null,
        username: (user === null || user === void 0 ? void 0 : user.xUsername) || null,
        profileUrl: buildXProfileUrl(user === null || user === void 0 ? void 0 : user.xUsername),
        linkedAt: ((_a = user === null || user === void 0 ? void 0 : user.xLinkedAt) === null || _a === void 0 ? void 0 : _a.toISOString()) || null,
        dmOptInAt: ((_b = user === null || user === void 0 ? void 0 : user.xDmOptInAt) === null || _b === void 0 ? void 0 : _b.toISOString()) || null,
        notificationsMuted: Boolean(user === null || user === void 0 ? void 0 : user.xNotificationsMutedAt),
        linkUrl: buildXLinkUrl({ username: (user === null || user === void 0 ? void 0 : user.xUsername) || null }),
    };
}
function getUserByXUserId(xUserId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (!xUserId)
                return [2 /*return*/, null];
            return [2 /*return*/, prisma_js_1.default.user.findUnique({
                    where: { xUserId: xUserId },
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
function syncVerifiedPrivyXUser(params) {
    return __awaiter(this, void 0, void 0, function () {
        var verifiedXAccount, xUserId, username, dmOptIn, accessTokenRef, refreshTokenRef, existingOwner, existingUser, user_1, embeddedWalletAddress, user;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getVerifiedPrivyXAccount(params.userId)];
                case 1:
                    verifiedXAccount = _a.sent();
                    xUserId = String(verifiedXAccount.xUserId || '').trim();
                    username = normalizeXUsername(verifiedXAccount.username);
                    dmOptIn = params.dmOptIn !== false;
                    accessTokenRef = String(params.accessTokenRef || '').trim() || null;
                    refreshTokenRef = String(params.refreshTokenRef || '').trim() || null;
                    if (!xUserId) {
                        return [2 /*return*/, { status: 'no_x_account', user: null }];
                    }
                    return [4 /*yield*/, prisma_js_1.default.user.findFirst({
                            where: {
                                xUserId: xUserId,
                                NOT: { privyDid: params.userId },
                            },
                            select: { privyDid: true },
                        })];
                case 2:
                    existingOwner = _a.sent();
                    if (existingOwner) {
                        throw new Error('X account already linked to another user');
                    }
                    return [4 /*yield*/, prisma_js_1.default.user.findUnique({
                            where: { privyDid: params.userId },
                            select: {
                                privyDid: true,
                                username: true,
                                xDmOptInAt: true,
                            },
                        })];
                case 3:
                    existingUser = _a.sent();
                    if (!existingUser) return [3 /*break*/, 5];
                    return [4 /*yield*/, prisma_js_1.default.user.update({
                            where: { privyDid: params.userId },
                            data: {
                                username: existingUser.username || username,
                                xUserId: xUserId,
                                xUsername: username,
                                xLinkedAt: new Date(),
                                xDmOptInAt: existingUser.xDmOptInAt || (dmOptIn ? new Date() : null),
                                xAccessTokenRef: accessTokenRef,
                                xRefreshTokenRef: refreshTokenRef,
                                xNotificationsMutedAt: null,
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
                                xUserId: xUserId,
                                xUsername: username,
                                xLinkedAt: new Date(),
                                xDmOptInAt: dmOptIn ? new Date() : null,
                                xAccessTokenRef: accessTokenRef,
                                xRefreshTokenRef: refreshTokenRef,
                                xNotificationsMutedAt: null,
                            },
                        })];
                case 7:
                    user = _a.sent();
                    return [2 /*return*/, { status: 'synced', user: user }];
            }
        });
    });
}
function maybeAutoSyncVerifiedPrivyXUser(userId) {
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
                            select: { xUserId: true },
                        }).catch(function () { return null; })];
                case 1:
                    existingUser = _a.sent();
                    if (existingUser === null || existingUser === void 0 ? void 0 : existingUser.xUserId) {
                        return [2 /*return*/];
                    }
                    autoSyncCooldown.set(userId, Date.now());
                    return [4 /*yield*/, syncVerifiedPrivyXUser({ userId: userId, dmOptIn: true }).catch(function () { return undefined; })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getXContextForUser(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var user;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.user.findUnique({
                        where: { privyDid: userId },
                        select: {
                            xUserId: true,
                            xUsername: true,
                            xLinkedAt: true,
                            xDmOptInAt: true,
                            xNotificationsMutedAt: true,
                        },
                    })];
                case 1:
                    user = _a.sent();
                    if (!user)
                        return [2 /*return*/, null];
                    return [2 /*return*/, serializeXContext(user)];
            }
        });
    });
}
