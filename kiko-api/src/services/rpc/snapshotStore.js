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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNativeBalanceSnapshot = getNativeBalanceSnapshot;
exports.setNativeBalanceSnapshot = setNativeBalanceSnapshot;
exports.getErc20BalanceSnapshot = getErc20BalanceSnapshot;
exports.setErc20BalanceSnapshot = setErc20BalanceSnapshot;
exports.getErc20AllowanceSnapshot = getErc20AllowanceSnapshot;
exports.setErc20AllowanceSnapshot = setErc20AllowanceSnapshot;
exports.withRouteReadSnapshot = withRouteReadSnapshot;
var cacheStore_js_1 = require("./cacheStore.js");
var BALANCE_TTL_MS = Math.max(250, Number(process.env.RPC_BALANCE_SNAPSHOT_TTL_MS || '1200'));
var ALLOWANCE_TTL_MS = Math.max(250, Number(process.env.RPC_ALLOWANCE_SNAPSHOT_TTL_MS || '1500'));
var ROUTE_READ_TTL_MS = Math.max(150, Number(process.env.RPC_ROUTE_SNAPSHOT_TTL_MS || '800'));
function normalizeBlockTag(blockTag) {
    return typeof blockTag === 'number' ? "0x".concat(blockTag.toString(16)) : String(blockTag || 'latest');
}
function getNativeBalanceSnapshot(chainId, walletAddress, blockTag) {
    if (blockTag === void 0) { blockTag = 'latest'; }
    return (0, cacheStore_js_1.getScopedCacheValue)((0, cacheStore_js_1.buildScopedCacheKey)('native_balance', [chainId, walletAddress.toLowerCase(), normalizeBlockTag(blockTag)]));
}
function setNativeBalanceSnapshot(chainId, walletAddress, blockTag, value, ttlMs) {
    if (ttlMs === void 0) { ttlMs = BALANCE_TTL_MS; }
    return (0, cacheStore_js_1.setScopedCacheValue)((0, cacheStore_js_1.buildScopedCacheKey)('native_balance', [chainId, walletAddress.toLowerCase(), normalizeBlockTag(blockTag)]), value, ttlMs);
}
function getErc20BalanceSnapshot(chainId, tokenAddress, ownerAddress, blockTag) {
    if (blockTag === void 0) { blockTag = 'latest'; }
    return (0, cacheStore_js_1.getScopedCacheValue)((0, cacheStore_js_1.buildScopedCacheKey)('erc20_balance', [chainId, tokenAddress.toLowerCase(), ownerAddress.toLowerCase(), normalizeBlockTag(blockTag)]));
}
function setErc20BalanceSnapshot(chainId, tokenAddress, ownerAddress, blockTag, value, ttlMs) {
    if (ttlMs === void 0) { ttlMs = BALANCE_TTL_MS; }
    return (0, cacheStore_js_1.setScopedCacheValue)((0, cacheStore_js_1.buildScopedCacheKey)('erc20_balance', [chainId, tokenAddress.toLowerCase(), ownerAddress.toLowerCase(), normalizeBlockTag(blockTag)]), value, ttlMs);
}
function getErc20AllowanceSnapshot(chainId, tokenAddress, ownerAddress, spenderAddress, blockTag) {
    if (blockTag === void 0) { blockTag = 'latest'; }
    return (0, cacheStore_js_1.getScopedCacheValue)((0, cacheStore_js_1.buildScopedCacheKey)('erc20_allowance', [chainId, tokenAddress.toLowerCase(), ownerAddress.toLowerCase(), spenderAddress.toLowerCase(), normalizeBlockTag(blockTag)]));
}
function setErc20AllowanceSnapshot(chainId, tokenAddress, ownerAddress, spenderAddress, blockTag, value, ttlMs) {
    if (ttlMs === void 0) { ttlMs = ALLOWANCE_TTL_MS; }
    return (0, cacheStore_js_1.setScopedCacheValue)((0, cacheStore_js_1.buildScopedCacheKey)('erc20_allowance', [chainId, tokenAddress.toLowerCase(), ownerAddress.toLowerCase(), spenderAddress.toLowerCase(), normalizeBlockTag(blockTag)]), value, ttlMs);
}
function withRouteReadSnapshot(params) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, (0, cacheStore_js_1.withScopedCache)({
                        key: (0, cacheStore_js_1.buildScopedCacheKey)('route_read', __spreadArray([params.chainId, params.method], params.keyParts, true)),
                        ttlMs: (_a = params.ttlMs) !== null && _a !== void 0 ? _a : ROUTE_READ_TTL_MS,
                        producer: params.producer
                    })];
                case 1: return [2 /*return*/, _b.sent()];
            }
        });
    });
}
