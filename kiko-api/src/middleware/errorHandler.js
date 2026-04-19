"use strict";
/**
 * Unified Error Handling Middleware for Fastify
 * Provides consistent error responses and logging
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.AppError = void 0;
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
exports.handleValidationError = handleValidationError;
exports.handleDatabaseError = handleDatabaseError;
exports.handleExternalApiError = handleExternalApiError;
var env_js_1 = require("../config/env.js");
var logger_js_1 = require("../utils/logger.js");
var logRegistry_js_1 = require("../config/logRegistry.js");
/**
 * Custom error class for API errors
 */
var AppError = /** @class */ (function (_super) {
    __extends(AppError, _super);
    function AppError(statusCode, message, code, logCode, isOperational) {
        if (code === void 0) { code = 'APP_ERROR'; }
        if (logCode === void 0) { logCode = logRegistry_js_1.LogCode.SYS_STARTUP; }
        if (isOperational === void 0) { isOperational = true; }
        var _this = _super.call(this, message) || this;
        _this.statusCode = statusCode;
        _this.code = code;
        _this.logCode = logCode;
        _this.isOperational = isOperational;
        Object.setPrototypeOf(_this, AppError.prototype);
        return _this;
    }
    return AppError;
}(Error));
exports.AppError = AppError;
/**
 * Get request ID from request (if available)
 */
function getRequestId(request) {
    return request.id || undefined;
}
var sanitizer_js_1 = require("../utils/sanitizer.js");
var scrubber_js_1 = require("../utils/scrubber.js");
/**
 * Log error with context
 */
function logError(error, request) {
    var requestId = getRequestId(request);
    var method = request.method;
    var url = (0, sanitizer_js_1.redactUrl)(request.url); // Sanitize request URL
    var ip = request.ip;
    var errorInfo = (0, scrubber_js_1.scrubObject)({
        requestId: requestId,
        method: method,
        url: url,
        ip: ip,
        error: {
            message: error.message,
            name: error.name,
            code: error.code,
            statusCode: error.statusCode || 500,
            stack: env_js_1.env.nodeEnv === 'development' ? error.stack : undefined,
        },
    });
    if (error.isOperational === false || error.statusCode === 500) {
        logger_js_1.logger.error(logRegistry_js_1.LogCode.SYS_ERROR, 'Unhandled API error', errorInfo);
    }
    else {
        logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_ERROR, 'Operational API error', errorInfo);
    }
}
/**
 * Format error response
 */
function formatErrorResponse(error, request, isDevelopment) {
    if (isDevelopment === void 0) { isDevelopment = false; }
    var requestId = getRequestId(request);
    var apiError = error;
    var fastifyError = error;
    var statusCode = fastifyError.statusCode || apiError.statusCode || 500;
    var code = apiError.code || fastifyError.code || 'INTERNAL_ERROR';
    // Don't expose internal errors in production
    var message = error.message;
    if (!isDevelopment && statusCode === 500 && !apiError.isOperational) {
        message = 'Internal server error';
    }
    var response = {
        success: false,
        error: message,
        code: code,
        requestId: requestId,
        timestamp: new Date().toISOString(),
    };
    // Only include stack trace in development
    if (isDevelopment && error.stack) {
        response.stack = error.stack;
    }
    return response;
}
/**
 * Error handler middleware
 */
function errorHandler(error, request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var isDevelopment, response, statusCode;
        return __generator(this, function (_a) {
            // Log the error
            logError(error, request);
            isDevelopment = env_js_1.env.nodeEnv === 'development';
            response = formatErrorResponse(error, request, isDevelopment);
            statusCode = error.statusCode || 500;
            // Send error response
            reply.status(statusCode).send(response);
            return [2 /*return*/];
        });
    });
}
/**
 * Not found handler
 */
function notFoundHandler(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var requestId;
        return __generator(this, function (_a) {
            requestId = getRequestId(request);
            reply.status(404).send({
                success: false,
                error: 'Route not found',
                code: 'NOT_FOUND',
                requestId: requestId,
                timestamp: new Date().toISOString(),
                path: request.url,
            });
            return [2 /*return*/];
        });
    });
}
/**
 * Validation error handler
 */
function handleValidationError(error) {
    var validationErrors = error.validation || [];
    var messages = validationErrors.map(function (err) { return "".concat(err.instancePath || '', " ").concat(err.message || '').trim(); }).join(', ');
    return new AppError(400, messages || 'Validation error', 'VALIDATION_ERROR', logRegistry_js_1.LogCode.SYS_STARTUP, true);
}
/**
 * Database error handler
 */
function handleDatabaseError(error) {
    // Don't expose database errors in production
    var isDevelopment = env_js_1.env.nodeEnv === 'development';
    // Check for common database errors
    if (error.message.includes('timeout')) {
        return new AppError(504, 'Database request timeout', 'DB_TIMEOUT', logRegistry_js_1.LogCode.SYS_STARTUP, true);
    }
    if (error.message.includes('connection')) {
        return new AppError(503, 'Database connection error', 'DB_CONNECTION_ERROR', logRegistry_js_1.LogCode.SYS_STARTUP, true);
    }
    if (error.message.includes('duplicate key')) {
        return new AppError(409, 'Resource already exists', 'DUPLICATE_KEY', logRegistry_js_1.LogCode.SYS_STARTUP, true);
    }
    return new AppError(500, isDevelopment ? error.message : 'Database error', 'DB_ERROR', logRegistry_js_1.LogCode.SYS_STARTUP, false);
}
/**
 * External API error handler
 */
function handleExternalApiError(error, serviceName) {
    var isDevelopment = env_js_1.env.nodeEnv === 'development';
    if (error.message.includes('timeout')) {
        return new AppError(504, "".concat(serviceName, " service timeout"), 'EXTERNAL_API_TIMEOUT', logRegistry_js_1.LogCode.SYS_STARTUP, true);
    }
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        return new AppError(503, "".concat(serviceName, " service unavailable"), 'EXTERNAL_API_UNAVAILABLE', logRegistry_js_1.LogCode.SYS_STARTUP, true);
    }
    return new AppError(502, isDevelopment
        ? "".concat(serviceName, " error: ").concat(error.message)
        : "".concat(serviceName, " service error"), 'EXTERNAL_API_ERROR', logRegistry_js_1.LogCode.SYS_STARTUP, true);
}
