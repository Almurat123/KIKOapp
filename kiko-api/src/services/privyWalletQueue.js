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
exports.markUserChainInflight = markUserChainInflight;
exports.isTransactionQueueBusy = isTransactionQueueBusy;
exports.resolveTransactionQueuePriority = resolveTransactionQueuePriority;
exports.withUserTransactionLock = withUserTransactionLock;
exports.__resetUserTransactionSchedulerForTests = __resetUserTransactionSchedulerForTests;
exports.__runUserTransactionTaskForTests = __runUserTransactionTaskForTests;
var userTransactionQueues = new Map();
var userChainInflightTx = new Map();
function buildUserChainKey(userId, chainId) {
    return "".concat(userId, ":").concat(chainId);
}
function markUserChainInflight(userId, chainId, delta) {
    var key = buildUserChainKey(userId, chainId);
    var current = userChainInflightTx.get(key) || 0;
    var next = current + delta;
    if (next <= 0) {
        userChainInflightTx.delete(key);
        return;
    }
    userChainInflightTx.set(key, next);
}
function isTransactionQueueBusy(userId, chainId) {
    var queueKey = buildUserChainKey(userId, chainId);
    var queueState = userTransactionQueues.get(queueKey);
    return (userChainInflightTx.get(queueKey) || 0) > 0 || Boolean(queueState === null || queueState === void 0 ? void 0 : queueState.running) || Boolean(queueState === null || queueState === void 0 ? void 0 : queueState.queue.length);
}
function resolveTransactionQueuePriority(tx) {
    if (Number.isFinite(Number(tx === null || tx === void 0 ? void 0 : tx.txPriority))) {
        return Number(tx === null || tx === void 0 ? void 0 : tx.txPriority);
    }
    switch ((tx === null || tx === void 0 ? void 0 : tx.txPurpose) || 'other') {
        case 'trade':
        case 'speedup':
            return 400;
        case 'approval':
            return 300;
        case 'fee':
            return 100;
        case 'preheat':
            return 50;
        default:
            return 0;
    }
}
function getUserTransactionQueueState(lockKey) {
    var state = userTransactionQueues.get(lockKey);
    if (!state) {
        state = {
            running: false,
            sequence: 0,
            queue: [],
        };
        userTransactionQueues.set(lockKey, state);
    }
    return state;
}
function drainUserTransactionQueue(lockKey) {
    var state = userTransactionQueues.get(lockKey);
    if (!state || state.running)
        return;
    var next = state.queue.shift();
    if (!next) {
        userTransactionQueues.delete(lockKey);
        return;
    }
    state.running = true;
    void Promise.resolve()
        .then(function () { return next.fn(); })
        .then(function (value) {
        next.resolve(value);
    })
        .catch(function (error) {
        next.reject(error);
    })
        .finally(function () {
        var current = userTransactionQueues.get(lockKey);
        if (!current)
            return;
        current.running = false;
        if (current.queue.length === 0) {
            userTransactionQueues.delete(lockKey);
            return;
        }
        drainUserTransactionQueue(lockKey);
    });
}
function withUserTransactionLock(params) {
    return __awaiter(this, void 0, void 0, function () {
        var lockKey, priority, state;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    lockKey = buildUserChainKey(params.userId, params.chainId);
                    priority = resolveTransactionQueuePriority(params.tx);
                    state = getUserTransactionQueueState(lockKey);
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            state.queue.push({
                                priority: priority,
                                sequence: state.sequence++,
                                fn: params.fn,
                                resolve: resolve,
                                reject: reject,
                            });
                            state.queue.sort(function (left, right) {
                                if (right.priority !== left.priority)
                                    return right.priority - left.priority;
                                return left.sequence - right.sequence;
                            });
                            drainUserTransactionQueue(lockKey);
                        })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function __resetUserTransactionSchedulerForTests() {
    userTransactionQueues.clear();
    userChainInflightTx.clear();
}
function __runUserTransactionTaskForTests(params) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, withUserTransactionLock({
                        userId: params.userId,
                        chainId: params.chainId,
                        tx: {
                            txPurpose: params.txPurpose,
                            txPriority: params.txPriority,
                        },
                        fn: params.fn,
                    })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
