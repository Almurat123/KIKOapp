"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.chatWS = exports.ChatWebSocketService = void 0;
exports.chatWSRoutes = chatWSRoutes;
var ws_1 = require("ws");
var node_crypto_1 = require("node:crypto");
var auth_js_1 = require("../middleware/auth.js");
var logger_js_1 = require("../utils/logger.js");
var logRegistry_js_1 = require("../config/logRegistry.js");
var chatStreamDebug_js_1 = require("./chatStreamDebug.js");
var ChatWebSocketService = /** @class */ (function () {
    function ChatWebSocketService() {
        var _this = this;
        this.clients = new Map(); // userId -> WebSockets
        // Sequence tracking: sessionId -> current sequence number
        this.sessionSequences = new Map();
        // Message buffer for reliable delivery: sessionId -> buffered messages
        this.messageBuffer = new Map();
        this.MAX_BUFFER_SIZE = 100; // Max messages per session
        this.BUFFER_TTL_MS = 60000; // 60 seconds TTL for buffered messages
        // Periodically clean up old buffered messages
        setInterval(function () { return _this.cleanupBuffers(); }, 30000);
        // Fix 5: Cleanup session sequences (Memory Leak)
        setInterval(function () {
            // Check usage timestamp if we had one, for now just clear very old ones or rely on connection status?
            // Since we don't track last access time for sequences, let's at least cap the map size
            if (_this.sessionSequences.size > 10000) {
                logger_js_1.logger.warn(logRegistry_js_1.LogCode.WS_ERROR, 'Session sequence map too large, purging old entries...');
                _this.sessionSequences.clear(); // Hard reset if too big to prevent OOM
            }
        }, 3600000); // Check every hour
    }
    ChatWebSocketService.getInstance = function () {
        if (!ChatWebSocketService.instance) {
            ChatWebSocketService.instance = new ChatWebSocketService();
        }
        return ChatWebSocketService.instance;
    };
    ChatWebSocketService.prototype.normalizeEvent = function (event) {
        var _a;
        return __assign(__assign({}, event), { requestId: event.requestId || (0, node_crypto_1.randomUUID)(), ts: event.ts || new Date().toISOString(), payload: (_a = event.payload) !== null && _a !== void 0 ? _a : event.data });
    };
    /**
     * Get next sequence number for a session
     */
    ChatWebSocketService.prototype.getNextSequence = function (sessionId) {
        var current = this.sessionSequences.get(sessionId) || 0;
        var next = current + 1;
        this.sessionSequences.set(sessionId, next);
        return next;
    };
    /**
     * Buffer a message for potential retransmission
     */
    ChatWebSocketService.prototype.bufferMessage = function (sessionId, event) {
        if (!this.messageBuffer.has(sessionId)) {
            this.messageBuffer.set(sessionId, []);
        }
        var buffer = this.messageBuffer.get(sessionId);
        buffer.push({ event: event, timestamp: Date.now() });
        // Enforce max buffer size (FIFO)
        while (buffer.length > this.MAX_BUFFER_SIZE) {
            buffer.shift();
        }
    };
    /**
     * Get buffered messages after a specific sequence
     */
    ChatWebSocketService.prototype.getBufferedMessagesAfter = function (sessionId, afterSeq) {
        var buffer = this.messageBuffer.get(sessionId) || [];
        return buffer
            .filter(function (b) { return b.event.seq > afterSeq; })
            .map(function (b) { return b.event; });
    };
    /**
     * Clean up old buffered messages
     */
    ChatWebSocketService.prototype.cleanupBuffers = function () {
        var _this = this;
        var now = Date.now();
        this.messageBuffer.forEach(function (buffer, sessionId) {
            var filtered = buffer.filter(function (b) { return now - b.timestamp < _this.BUFFER_TTL_MS; });
            if (filtered.length === 0) {
                _this.messageBuffer.delete(sessionId);
            }
            else {
                _this.messageBuffer.set(sessionId, filtered);
            }
        });
    };
    /**
     * Register a new client connection for a user
     */
    ChatWebSocketService.prototype.registerClient = function (userId, socket) {
        var _this = this;
        if (!this.clients.has(userId)) {
            this.clients.set(userId, new Set());
        }
        this.clients.get(userId).add(socket);
        socket.on('close', function () {
            _this.unregisterClient(userId, socket);
        });
        logger_js_1.logger.info(logRegistry_js_1.LogCode.WS_CONNECTION_OPENED, 'ChatWS Client connected', { userId: userId, totalConnections: this.clients.get(userId).size });
    };
    /**
     * Unregister a client connection
     */
    ChatWebSocketService.prototype.unregisterClient = function (userId, socket) {
        var userClients = this.clients.get(userId);
        if (userClients) {
            userClients.delete(socket);
            if (userClients.size === 0) {
                this.clients.delete(userId);
            }
        }
    };
    /**
     * Handle client messages (ack, sync, ping)
     */
    ChatWebSocketService.prototype.handleClientMessage = function (userId, socket, message) {
        return __awaiter(this, void 0, void 0, function () {
            var lastSeq, buffered;
            return __generator(this, function (_a) {
                if (message.type === 'ping') {
                    socket.send(JSON.stringify({ type: 'pong' }));
                }
                else if (message.type === 'ack' && message.sessionId && message.seq) {
                    // ACK received - currently we just log it, could be used for flow control
                    // In future: remove from pending-ack queue
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.WS_MESSAGE_SENT, 'ACK received', {
                        userId: userId,
                        sessionId: message.sessionId,
                        seq: message.seq
                    });
                }
                else if (message.type === 'sync' && message.sessionId) {
                    lastSeq = message.lastSeq || 0;
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.WS_CONNECTION_OPENED, 'Sync request', {
                        userId: userId,
                        sessionId: message.sessionId,
                        lastSeq: lastSeq
                    });
                    buffered = this.getBufferedMessagesAfter(message.sessionId, lastSeq);
                    if (buffered.length > 0) {
                        logger_js_1.logger.info(logRegistry_js_1.LogCode.WS_MESSAGE_SENT, 'Sending buffered messages', {
                            count: buffered.length,
                            sessionId: message.sessionId
                        });
                        buffered.forEach(function (event) {
                            if (socket.readyState === ws_1.WebSocket.OPEN) {
                                socket.send(JSON.stringify(event));
                            }
                        });
                    }
                    // Signal sync complete
                    socket.send(JSON.stringify({
                        type: 'sync_complete',
                        sessionId: message.sessionId,
                        bufferedCount: buffered.length
                    }));
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Broadcast an event to all user's connections with sequence number
     */
    ChatWebSocketService.prototype.broadcastToUser = function (userId, event) {
        var _a, _b, _c, _d;
        var userClients = this.clients.get(userId);
        if (userClients) {
            var normalizedEvent = this.normalizeEvent(event);
            // Skip logging for high-frequency 'chunk' events to prevent console flooding
            var isHighFreq = normalizedEvent.type === 'chunk';
            var timerLabel = "ws_broadcast_".concat(userId, "_").concat(normalizedEvent.type);
            if (!isHighFreq) {
                logger_js_1.logger.startTimer(timerLabel);
            }
            // Add sequence number if session-scoped
            var payload_1;
            if (normalizedEvent.sessionId) {
                var seq = this.getNextSequence(normalizedEvent.sessionId);
                var sequencedEvent = __assign(__assign({}, normalizedEvent), { seq: seq });
                payload_1 = JSON.stringify(sequencedEvent);
                var eventData = normalizedEvent.data || {};
                var deltaText = (_c = (_b = (_a = eventData.content) !== null && _a !== void 0 ? _a : eventData.delta) !== null && _b !== void 0 ? _b : eventData.reasoning_content) !== null && _c !== void 0 ? _c : '';
                (0, chatStreamDebug_js_1.logChatStreamDebug)(logRegistry_js_1.LogCode.WS_MESSAGE_SENT, 'ChatWS: stream event broadcast', {
                    userId: userId,
                    eventType: normalizedEvent.type,
                    sessionId: normalizedEvent.sessionId,
                    seq: seq,
                    messageId: eventData.messageId || eventData.message_id || null,
                    chunkType: normalizedEvent.type === 'chunk'
                        ? (eventData.type === 'reasoning' ? 'reasoning' : 'content')
                        : undefined,
                    deltaLength: normalizedEvent.type === 'chunk' ? String(deltaText || '').length : undefined,
                    payloadBytes: Buffer.byteLength(payload_1),
                    connectionCount: userClients.size,
                    bufferedCount: ((_d = this.messageBuffer.get(normalizedEvent.sessionId)) === null || _d === void 0 ? void 0 : _d.length) || 0,
                });
                // Buffer for potential retransmission
                this.bufferMessage(normalizedEvent.sessionId, sequencedEvent);
            }
            else {
                payload_1 = JSON.stringify(normalizedEvent);
            }
            userClients.forEach(function (socket) {
                if (socket.readyState === ws_1.WebSocket.OPEN) {
                    socket.send(payload_1);
                }
            });
            if (!isHighFreq) {
                logger_js_1.logger.endTimer(timerLabel, logRegistry_js_1.LogCode.WS_MESSAGE_SENT, { userId: userId, eventType: normalizedEvent.type, connectionCount: userClients.size });
            }
        }
    };
    /**
     * @deprecated Use broadcastToUser
     */
    ChatWebSocketService.prototype.broadcast = function (sessionId, event) {
        // Fallback for transition period - will be removed once all workers use broadcastToUser
        this.clients.forEach(function (sockets, userId) {
            var payload = JSON.stringify(event);
            sockets.forEach(function (socket) {
                if (socket.readyState === ws_1.WebSocket.OPEN) {
                    socket.send(payload);
                }
            });
        });
    };
    return ChatWebSocketService;
}());
exports.ChatWebSocketService = ChatWebSocketService;
exports.chatWS = ChatWebSocketService.getInstance();
var VALID_WS_APP_KEYS = new Set([
    process.env.KIKO_WEB_APP_KEY,
    process.env.KIKO_MOBILE_APP_KEY,
].filter(Boolean));
function isValidWsAppKey(appKey) {
    if (!appKey) {
        return true;
    }
    if (VALID_WS_APP_KEYS.size === 0) {
        return false;
    }
    return VALID_WS_APP_KEYS.has(appKey);
}
/**
 * Fastify plugin to set up WebSocket route
 */
function chatWSRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function () {
        var handleUserWs;
        var _this = this;
        return __generator(this, function (_a) {
            handleUserWs = function (connection, req) { return __awaiter(_this, void 0, void 0, function () {
                var userId, authenticated, authTimeout, authenticate, queryToken, queryAppKey;
                var _this = this;
                var _a, _b;
                return __generator(this, function (_c) {
                    userId = null;
                    authenticated = false;
                    authTimeout = setTimeout(function () {
                        if (!authenticated) {
                            logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_AUTH_FAILED, 'ChatWS: auth timeout');
                            connection.socket.close(1008, 'Auth timeout');
                        }
                    }, 8000);
                    authenticate = function (token_1, appKey_1) {
                        var args_1 = [];
                        for (var _i = 2; _i < arguments.length; _i++) {
                            args_1[_i - 2] = arguments[_i];
                        }
                        return __awaiter(_this, __spreadArray([token_1, appKey_1], args_1, true), void 0, function (token, appKey, source) {
                            var payload, resolvedUserId, err_1, errorCode, errorMsg;
                            if (source === void 0) { source = 'message'; }
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (authenticated)
                                            return [2 /*return*/];
                                        if (!isValidWsAppKey(appKey)) {
                                            logger_js_1.logger.error(logRegistry_js_1.LogCode.API_AUTH_FAILED, 'ChatWS: Invalid app key', {
                                                source: source,
                                                hasAppKey: !!appKey,
                                            });
                                            connection.socket.close(1008, 'Invalid app key');
                                            return [2 /*return*/];
                                        }
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 3, , 4]);
                                        return [4 /*yield*/, (0, auth_js_1.verifyPrivyToken)(token)];
                                    case 2:
                                        payload = _a.sent();
                                        resolvedUserId = payload.sub;
                                        if (!resolvedUserId) {
                                            logger_js_1.logger.error(logRegistry_js_1.LogCode.API_AUTH_FAILED, 'ChatWS: Token missing sub claim');
                                            connection.socket.close(1008, 'Invalid token');
                                            return [2 /*return*/];
                                        }
                                        userId = resolvedUserId;
                                        authenticated = true;
                                        clearTimeout(authTimeout);
                                        exports.chatWS.registerClient(userId, connection.socket);
                                        if (connection.socket.readyState === ws_1.WebSocket.OPEN) {
                                            connection.socket.send(JSON.stringify({ type: 'auth_ok' }));
                                        }
                                        logger_js_1.logger.info(logRegistry_js_1.LogCode.WS_CONNECTION_OPENED, 'ChatWS: User connected', {
                                            source: source,
                                            userId: userId.substring(0, 25) + '...',
                                            tokenExp: payload.exp
                                        });
                                        return [3 /*break*/, 4];
                                    case 3:
                                        err_1 = _a.sent();
                                        errorCode = (err_1 === null || err_1 === void 0 ? void 0 : err_1.code) || 'AUTH_FAILED';
                                        errorMsg = (err_1 === null || err_1 === void 0 ? void 0 : err_1.message) || 'Auth failed';
                                        logger_js_1.logger.error(logRegistry_js_1.LogCode.API_AUTH_FAILED, 'ChatWS auth error', {
                                            source: source,
                                            error: errorMsg,
                                            code: errorCode
                                        });
                                        if (errorCode === 'TOKEN_EXPIRED') {
                                            connection.socket.close(4001, 'Token expired - please refresh');
                                        }
                                        else {
                                            connection.socket.close(1008, 'Auth failed');
                                        }
                                        return [3 /*break*/, 4];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        });
                    };
                    queryToken = typeof ((_a = req.query) === null || _a === void 0 ? void 0 : _a.token) === 'string' ? req.query.token : '';
                    queryAppKey = typeof ((_b = req.query) === null || _b === void 0 ? void 0 : _b.appKey) === 'string' ? req.query.appKey : '';
                    if (queryToken) {
                        authenticate(queryToken, queryAppKey, 'query');
                    }
                    connection.socket.on('message', function (message) {
                        try {
                            var data = JSON.parse(message.toString());
                            if (!authenticated) {
                                if ((data === null || data === void 0 ? void 0 : data.type) === 'auth' && typeof (data === null || data === void 0 ? void 0 : data.token) === 'string' && data.token) {
                                    authenticate(data.token, data.appKey, 'message');
                                }
                                else {
                                    connection.socket.close(1008, 'Auth required');
                                }
                                return;
                            }
                            if (userId) {
                                exports.chatWS.handleClientMessage(userId, connection.socket, data);
                            }
                        }
                        catch (e) {
                            // Ignore parse errors
                        }
                    });
                    connection.socket.on('close', function () {
                        clearTimeout(authTimeout);
                    });
                    return [2 /*return*/];
                });
            }); };
            // New endpoint for user-level WebSocket
            fastify.get('/api/chat/ws', { websocket: true }, handleUserWs);
            // v2 compatibility path (frontend now uses /v2/chat/ws)
            fastify.get('/v2/chat/ws', { websocket: true }, handleUserWs);
            // Legacy endpoint for backward compatibility during migration
            fastify.get('/api/chat/ws/:sessionId', { websocket: true }, function (connection, req) {
                // Just close it and tell client to use the new one, or handle it for a bit
                // For now, let's log and close so we see which clients are still using it
                logger_js_1.logger.warn(logRegistry_js_1.LogCode.WS_ERROR, 'ChatWS Legacy sessionId connection attempt', { sessionId: req.params.sessionId });
                connection.socket.close(1000, 'Please use /api/chat/ws');
            });
            return [2 /*return*/];
        });
    });
}
