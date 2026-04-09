// CONTEXT MEMORY
// Updated: 2026-04-09
// Author: Almurat
// Reason: config-layer red teaming showed that structured logs could become a
//         secret exfiltration path if any caller accidentally logged headers,
//         tokens, cookies, or auth payloads.
// Goal: keep the default logger fail-safe by redacting sensitive strings and
//       metadata before anything reaches console or log files.
// Owns: structured log payload building, console interception, and default
//       metadata sanitization for logger-based output.
// Does Not Own: business-specific decisions about what should be logged.
// Design Language:
// - Redact before formatting, not after emission.
// - Treat metadata as untrusted input that may contain secrets.
// - Console interception must inherit the same redaction guarantees.
// See also:
// - system-journal/INDEX.md
// - system-journal/fix-log/2026-04-09-x-oauth-official-account-flow.md
// - system-journal/conflicts.md
import { LogCode, LogMetadata, LogRole } from '../config/logRegistry.js';
import { env } from '../config/env.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import * as fs from 'fs';
import * as path from 'path';
import { redact } from './sanitizer.js';

export const logStorage = new AsyncLocalStorage<LogMetadata>();

const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

const APP_LOG_PATH = path.join(LOG_DIR, 'app.log');
const ERROR_LOG_PATH = path.join(LOG_DIR, 'error.log');
const AUDIT_LOG_PATH = path.join(LOG_DIR, 'audit.log');

const appLogStream = fs.createWriteStream(APP_LOG_PATH, { flags: 'a' });
const errorLogStream = fs.createWriteStream(ERROR_LOG_PATH, { flags: 'a' });
const auditLogStream = fs.createWriteStream(AUDIT_LOG_PATH, { flags: 'a' });

const rawConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
};

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

const LEVEL_SHORTHAND: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: 'dbg',
    [LogLevel.INFO]: 'inf',
    [LogLevel.WARN]: 'wrn',
    [LogLevel.ERROR]: 'err',
};

type LogPayload = {
    timestamp: string;
    level: string;
    role: LogRole;
    code: LogCode;
    message: string;
    metadata: Record<string, unknown>;
    service: string;
    env: string | undefined;
};

class ConsoleRateLimiter {
    private tokens: number;
    private readonly maxTokens: number;
    private readonly refillPerSec: number;
    private readonly dropSummaryIntervalMs: number;
    private lastRefillAt = Date.now();
    private dropped = 0;
    private lastSummaryAt = Date.now();

    constructor(maxPerSecond: number, dropSummaryIntervalMs: number) {
        const safeRate = Math.max(1, maxPerSecond);
        this.maxTokens = safeRate;
        this.refillPerSec = safeRate;
        this.tokens = safeRate;
        this.dropSummaryIntervalMs = Math.max(1000, dropSummaryIntervalMs);
    }

    public allow(): boolean {
        this.refill();
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return true;
        }
        this.dropped += 1;
        return false;
    }

    public maybeEmitDropSummary(emit: (line: string) => void) {
        if (this.dropped === 0) return;
        const now = Date.now();
        if (now - this.lastSummaryAt < this.dropSummaryIntervalMs) return;
        emit(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'WARN',
            role: LogRole.EVENT,
            code: 'SYS-LOG-DROP',
            message: 'Console logs dropped by rate limiter',
            metadata: { dropped: this.dropped, intervalMs: now - this.lastSummaryAt },
            service: 'kiko-api',
            env: process.env.NODE_ENV,
        }));
        this.dropped = 0;
        this.lastSummaryAt = now;
    }

    private refill() {
        const now = Date.now();
        const elapsedMs = now - this.lastRefillAt;
        if (elapsedMs <= 0) return;
        this.lastRefillAt = now;
        const refill = (elapsedMs / 1000) * this.refillPerSec;
        this.tokens = Math.min(this.maxTokens, this.tokens + refill);
    }
}

class Logger {
    private logLevel: LogLevel;
    private throttleMap: Map<string, { count: number; lastTime: number }> = new Map();
    private aggregator: LogAggregator;
    private timers: Map<string, number> = new Map();
    private readonly throttleWindowMs: number;
    private readonly consoleLimiter: ConsoleRateLimiter;
    private readonly maxConsolePerSecond: number;

    constructor() {
        this.logLevel = this.parseLogLevel(env.logLevel || 'info');
        this.throttleWindowMs = this.parsePositiveInt(process.env.LOG_THROTTLE_WINDOW_MS, 5000);
        const defaultConsoleRps = process.env.NODE_ENV === 'production' ? 60 : 5000;
        this.maxConsolePerSecond = this.parsePositiveInt(process.env.LOG_MAX_PER_SECOND, defaultConsoleRps);
        const dropSummaryIntervalMs = this.parsePositiveInt(process.env.LOG_DROP_SUMMARY_INTERVAL_MS, 10000);
        this.consoleLimiter = new ConsoleRateLimiter(this.maxConsolePerSecond, dropSummaryIntervalMs);
        this.aggregator = new LogAggregator(this, this.parsePositiveInt(process.env.LOG_AGGREGATE_INTERVAL_MS, 15 * 60 * 1000));
    }

    private get isProduction(): boolean {
        return process.env.NODE_ENV === 'production';
    }

    private parsePositiveInt(input: string | undefined, fallback: number): number {
        const parsed = Number(input);
        if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
        return Math.floor(parsed);
    }

    private parseLogLevel(level: string): LogLevel {
        switch (level.toLowerCase()) {
            case 'debug': return LogLevel.DEBUG;
            case 'info': return LogLevel.INFO;
            case 'warn': return LogLevel.WARN;
            case 'error': return LogLevel.ERROR;
            default: return LogLevel.INFO;
        }
    }

    private writeStream(stream: fs.WriteStream, line: string) {
        stream.write(`${line}\n`);
    }

    private formatConsoleLine(level: LogLevel, payload: LogPayload): string {
        if (this.isProduction) {
            return JSON.stringify(payload);
        }
        const levelShort = LEVEL_SHORTHAND[level];
        const timeShort = payload.timestamp.split('T')[1]?.split('.')[0] || payload.timestamp;
        const header = `[${timeShort}] [${levelShort}] [${payload.role}] [${payload.code}]`;
        const context = this.formatContextToKV(payload.metadata);
        return context.length > 0
            ? `${header} ${payload.message} | ${context.join(' ')}`
            : `${header} ${payload.message}`;
    }

    private formatContextToKV(meta: Record<string, unknown>): string[] {
        const values: string[] = [];
        for (const [key, value] of Object.entries(meta)) {
            if (value === null || value === undefined) continue;
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                values.push(`${key}=${String(value)}`);
                continue;
            }
            if (value instanceof Date) {
                values.push(`${key}=${value.toISOString()}`);
                continue;
            }
            if (Array.isArray(value)) {
                values.push(`${key}=[${value.length}]`);
                continue;
            }
            try {
                const str = JSON.stringify(value);
                values.push(`${key}=${str.length > 80 ? '{Obj}' : str}`);
            } catch {
                values.push(`${key}={Obj}`);
            }
        }
        return values;
    }

    private processMetadata(meta: Record<string, unknown>): Record<string, unknown> {
        const processed: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(meta)) {
            if (value instanceof Error) {
                processed[key] = this.simplifyError(value);
                continue;
            }
            processed[key] = redact(value);
        }
        return processed;
    }

    private simplifyError(err: Error): Record<string, string> {
        const stack = err.stack || '';
        const businessFrame = stack.split('\n').find(line => line.includes('/src/') && !line.includes('node_modules')) || stack.split('\n')[1] || '';
        return {
            name: err.name,
            message: String(redact(err.message)),
            at: String(redact(businessFrame.trim())),
        };
    }

    private getDefaultRole(code: LogCode): LogRole {
        if (code.startsWith('EXE-') || code === LogCode.WTC_SWAP_DETECTED) return LogRole.AUDIT;
        if (code.startsWith('API-') || code.startsWith('PRF-') || code.startsWith('CH-')) return LogRole.METRIC;
        if (code.startsWith('SYS-')) return LogRole.EVENT;
        return LogRole.TRACE;
    }

    private buildPayload(level: LogLevel, code: LogCode, message: string, metadata?: LogMetadata): LogPayload {
        const timestamp = new Date().toISOString();
        const storageMeta = logStorage.getStore() || {};
        const combinedMeta = this.processMetadata({ ...storageMeta, ...(metadata || {}) });
        const role = (combinedMeta.role as LogRole | undefined) || this.getDefaultRole(code);
        combinedMeta.role = role;
        const safeMessage = String(redact(message));

        return {
            timestamp,
            level: LogLevel[level],
            role,
            code,
            message: safeMessage,
            metadata: combinedMeta,
            service: 'kiko-api',
            env: process.env.NODE_ENV,
        };
    }

    private emit(level: LogLevel, code: LogCode, message: string, metadata?: LogMetadata) {
        const payload = this.buildPayload(level, code, message, metadata);
        const line = JSON.stringify(payload);

        this.writeStream(appLogStream, line);
        if (level >= LogLevel.WARN) this.writeStream(errorLogStream, line);
        if (payload.role === LogRole.AUDIT) this.writeStream(auditLogStream, line);

        this.consoleLimiter.maybeEmitDropSummary((summary) => rawConsole.warn(summary));
        if (!this.consoleLimiter.allow()) return;

        const consoleLine = this.formatConsoleLine(level, payload);
        switch (level) {
            case LogLevel.ERROR:
                rawConsole.error(consoleLine);
                break;
            case LogLevel.WARN:
                rawConsole.warn(consoleLine);
                break;
            case LogLevel.INFO:
                rawConsole.info(consoleLine);
                break;
            default:
                rawConsole.log(consoleLine);
                break;
        }
    }

    public startTimer(label: string) {
        this.timers.set(label, Date.now());
    }

    public endTimer(label: string, code: LogCode = LogCode.PERF_METRIC, metadata: LogMetadata = {}, level: 'info' | 'debug' = 'debug') {
        const startTime = this.timers.get(label);
        if (!startTime) return;
        const durationMs = Date.now() - startTime;
        this.timers.delete(label);
        const payload = { ...metadata, durationMs, timerLabel: label };
        if (level === 'debug') {
            this.debug(code, `Timer finished: ${label}`, payload);
        } else {
            this.info(code, `Timer finished: ${label}`, payload);
        }
    }

    private shouldThrottle(code: LogCode, message: string, windowMs?: number): boolean {
        const key = `${code}:${message}`;
        const now = Date.now();
        const entry = this.throttleMap.get(key);
        const effectiveWindowMs = windowMs && windowMs > 0 ? windowMs : this.throttleWindowMs;

        if (!entry) {
            this.throttleMap.set(key, { count: 1, lastTime: now });
            return false;
        }

        if (now - entry.lastTime < effectiveWindowMs) {
            entry.count++;
            return true;
        }

        if (entry.count > 1) {
            this.emit(LogLevel.INFO, LogCode.SYS_INFO, 'Suppressed repeated logs', {
                repeated: entry.count,
                original: key,
                windowMs: effectiveWindowMs,
            });
        }

        this.throttleMap.set(key, { count: 1, lastTime: now });
        return false;
    }

    public debug(code: LogCode, message: string, metadata?: LogMetadata) {
        if (this.logLevel > LogLevel.DEBUG) return;
        this.emit(LogLevel.DEBUG, code, message, metadata);
    }

    public info(code: LogCode, message: string, metadata?: LogMetadata) {
        if (this.logLevel > LogLevel.INFO) return;
        this.emit(LogLevel.INFO, code, message, metadata);
    }

    public warn(code: LogCode, message: string, metadata?: LogMetadata) {
        if (this.logLevel > LogLevel.WARN) return;
        this.emit(LogLevel.WARN, code, message, metadata);
    }

    public error(code: LogCode, message: string, metadata?: LogMetadata) {
        if (this.logLevel > LogLevel.ERROR) return;

        const storageMeta = logStorage.getStore() || {};
        const combinedMeta = { ...storageMeta, ...metadata };
        if (combinedMeta.action) {
            message = `${message} | ACTION REQUIRED: ${combinedMeta.action}`;
        }

        this.emit(LogLevel.ERROR, code, message, metadata);
    }

    public throttled(code: LogCode, message: string, metadata?: LogMetadata, windowMs?: number) {
        if (this.logLevel > LogLevel.INFO) return;
        if (this.shouldThrottle(code, message, windowMs)) return;
        this.emit(LogLevel.INFO, code, message, metadata);
    }

    public throttledError(code: LogCode, message: string, metadata?: LogMetadata, windowMs?: number) {
        if (this.logLevel > LogLevel.ERROR) return;
        if (this.shouldThrottle(code, message, windowMs)) return;
        this.emit(LogLevel.ERROR, code, message, metadata);
    }

    public aggregate(code: LogCode, message: string, metadata?: LogMetadata) {
        if (this.logLevel > LogLevel.INFO) return;
        this.aggregator.add(code, message, metadata);
    }
}

class LogAggregator {
    private logs: Map<string, { count: number; firstTime: number; lastTime: number; metadata: LogMetadata | undefined }> = new Map();
    private timer: NodeJS.Timeout;
    private logger: Logger;

    constructor(logger: Logger, intervalMs: number) {
        this.logger = logger;
        this.timer = setInterval(() => this.flush(), intervalMs);
        this.timer.unref();
    }

    public add(code: LogCode, message: string, metadata?: LogMetadata) {
        const key = `${code}|${message}`;
        const now = Date.now();
        const entry = this.logs.get(key);
        if (!entry) {
            this.logs.set(key, {
                count: 1,
                firstTime: now,
                lastTime: now,
                metadata,
            });
            return;
        }
        entry.count += 1;
        entry.lastTime = now;
    }

    public flush() {
        if (this.logs.size === 0) return;

        this.logs.forEach((stats, key) => {
            const [code, ...rest] = key.split('|');
            const message = rest.join('|');
            const spanMs = Math.max(1, stats.lastTime - stats.firstTime);
            const ratePerMin = Number((stats.count / (spanMs / 60000)).toFixed(2));
            this.logger.info(LogCode.SYS_AGG_REPORT, 'Aggregated repetitive logs', {
                code,
                message,
                count: stats.count,
                spanMs,
                ratePerMin,
                sample: stats.metadata,
            });
        });

        this.logs.clear();
    }
}

export const logger = new Logger();
export default logger;

let consoleInterceptInstalled = false;

function stringifyConsoleArgs(args: unknown[]): string {
    return args.map((arg) => {
        if (typeof arg === 'string') return arg;
        if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
        try {
            return JSON.stringify(arg);
        } catch {
            return String(arg);
        }
    }).join(' ');
}

export function installConsoleInterception() {
    if (consoleInterceptInstalled) return;

    const captureEnabled = (process.env.LOG_INTERCEPT_CONSOLE || '').toLowerCase();
    const enabled = captureEnabled === '1' || captureEnabled === 'true' || (captureEnabled === '' && process.env.NODE_ENV === 'production');
    if (!enabled) return;

    consoleInterceptInstalled = true;

    console.log = (...args: unknown[]) => logger.throttled(LogCode.SYS_INFO, stringifyConsoleArgs(args), { role: LogRole.TRACE, source: 'console.log' });
    console.info = (...args: unknown[]) => logger.throttled(LogCode.SYS_INFO, stringifyConsoleArgs(args), { role: LogRole.TRACE, source: 'console.info' });
    console.warn = (...args: unknown[]) => logger.throttled(LogCode.SYS_INFO, stringifyConsoleArgs(args), { role: LogRole.EVENT, source: 'console.warn' });
    console.error = (...args: unknown[]) => logger.error(LogCode.SYS_ERROR, stringifyConsoleArgs(args), { role: LogRole.EVENT, source: 'console.error' });
}
