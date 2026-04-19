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
exports.computeLaunchpadMultiple = computeLaunchpadMultiple;
var GLOBAL_FIXED_START_USD = Number(process.env.LAUNCHPAD_FIXED_START_USD || '0');
var fileOverridesLoaded = false;
var fileOverrides = new Map();
function toFinitePositive(value) {
    var n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
}
function normalizedLaunchpad(value) {
    var v = String(value || '').trim().toLowerCase();
    if (v === 'pumpfun')
        return 'pump.fun';
    if (v === 'bonkfun')
        return 'bonk.fun';
    if (v === 'fourmeme')
        return 'four.meme';
    if (v === 'four')
        return 'four.meme';
    if (v === 'virtual')
        return 'virtuals';
    if (v === 'doppler finance')
        return 'doppler';
    return v;
}
function loadOverridesOnce() {
    return __awaiter(this, void 0, void 0, function () {
        var readFile, resolve, raw, parsed, summary, _i, _a, _b, key, value, px, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (fileOverridesLoaded)
                        return [2 /*return*/];
                    fileOverridesLoaded = true;
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('node:fs/promises'); })];
                case 2:
                    readFile = (_d.sent()).readFile;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('node:path'); })];
                case 3:
                    resolve = (_d.sent()).resolve;
                    return [4 /*yield*/, readFile(resolve(process.cwd(), 'data/launchpad-start-price-overrides.json'), 'utf8')];
                case 4:
                    raw = _d.sent();
                    parsed = JSON.parse(raw);
                    summary = (parsed === null || parsed === void 0 ? void 0 : parsed.summary) || {};
                    for (_i = 0, _a = Object.entries(summary); _i < _a.length; _i++) {
                        _b = _a[_i], key = _b[0], value = _b[1];
                        px = Number((value === null || value === void 0 ? void 0 : value.median) || 0);
                        if (Number.isFinite(px) && px > 0)
                            fileOverrides.set(String(key).toLowerCase(), px);
                    }
                    return [3 /*break*/, 6];
                case 5:
                    _c = _d.sent();
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function getFixedStartUsd(chain, launchpad) {
    var chainId = String(chain || '').trim().toLowerCase();
    var lp = normalizedLaunchpad(launchpad);
    if (!lp)
        return null;
    var fromFile = fileOverrides.get("".concat(chainId, ":").concat(lp));
    if (fromFile)
        return fromFile;
    var envKey = "LAUNCHPAD_FIXED_START_USD_".concat(chainId.toUpperCase(), "_").concat(lp.replace(/[^a-z0-9]/gi, '_').toUpperCase());
    var fromEnv = toFinitePositive(process.env[envKey]);
    if (fromEnv)
        return fromEnv;
    var defaults = {
        // User-calibrated launchpad start prices (USD)
        'base:clanker': 0.00000025,
        'base:doppler': 0.00000025,
        'base:zora': 0.00001,
        'base:virtuals': 0.0001,
        'solana:pump.fun': 0.00003,
        'solana:bonk.fun': 0.00003,
        'bsc:four.meme': 0.000035,
        'bsc:flap': 0.000035,
    };
    return defaults["".concat(chainId, ":").concat(lp)] || toFinitePositive(GLOBAL_FIXED_START_USD);
}
function computeLaunchpadMultiple(chain, launchpad, currentPriceUsd) {
    // Fire-and-forget lazy load; first calls still use defaults/env.
    void loadOverridesOnce();
    var lp = normalizedLaunchpad(launchpad);
    if (!lp)
        return null;
    var current = toFinitePositive(currentPriceUsd);
    if (!current)
        return null;
    var startUsd = getFixedStartUsd(chain, lp);
    if (!startUsd)
        return null;
    var multiple = current / startUsd;
    if (!Number.isFinite(multiple) || multiple <= 0)
        return null;
    return Math.min(multiple, 200000);
}
