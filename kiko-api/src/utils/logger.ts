import { LogCode, LogMetadata } from '../config/logRegistry.js';
import { env } from '../config/env.js';
import { AsyncLocalStorage } from 'node:async_hooks';

export const logStorage = new AsyncLocalStorage<LogMetadata>();

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

class Logger {
    private logLevel: LogLevel;
    private throttleMap: Map<string, { count: number; lastTime: number }> = new Map();
    private timers: Map<string, number> = new Map();
    private THROTTLE_WINDOW_MS = 5000;
    constructor() {
        this.logLevel = this.parseLogLevel(env.logLevel || 'info');
    }

    private get isProduction(): boolean {
        return process.env.NODE_ENV === 'production';
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

    private format(level: LogLevel, code: LogCode, message: string, metadata?: LogMetadata): string {
        const timestamp = new Date().toISOString();
        const levelName = LogLevel[level];

        // Merge with storage metadata if available
        const storageMeta = logStorage.getStore() || {};
        const combinedMeta = { ...storageMeta, ...metadata };

        if (this.isProduction) {
            return JSON.stringify({
                timestamp,
                level: levelName,
                code,
                message,
                metadata: combinedMeta,
                service: 'kiko-api',
                env: process.env.NODE_ENV
            });
        }

        const traceInfo = combinedMeta.traceId ? `[TID:${combinedMeta.traceId}]` : '';
        const durationInfo = combinedMeta.durationMs ? `[${combinedMeta.durationMs}ms]` : '';

        let metaString = '';
        if (Object.keys(combinedMeta).length > 0) {
            const { traceId, durationMs, ...rest } = combinedMeta;
            if (Object.keys(rest).length > 0) {
                metaString = ` | DATA: ${JSON.stringify(rest)}`;
            }
        }

        return `[${timestamp}] [${levelName}] [${code}]${traceInfo}${durationInfo} ${message}${metaString}`;
    }

    /**
     * Start a timer for performance tracking
     */
    public startTimer(label: string) {
        this.timers.set(label, Date.now());
    }

    /**
     * Stop a timer and log the duration
     */
    public endTimer(label: string, code: LogCode = LogCode.PERF_METRIC, metadata: LogMetadata = {}) {
        const startTime = this.timers.get(label);
        if (!startTime) return;

        const durationMs = Date.now() - startTime;
        this.timers.delete(label);

        this.info(code, `Timer finished: ${label}`, { ...metadata, durationMs, timerLabel: label });
    }

    /**
     * Check if a log should be throttled
     * Returns true if it should be suppressed
     */
    private shouldThrottle(code: LogCode, message: string): boolean {
        const key = `${code}:${message}`;
        const now = Date.now();
        const entry = this.throttleMap.get(key);

        if (!entry) {
            this.throttleMap.set(key, { count: 1, lastTime: now });
            return false;
        }

        if (now - entry.lastTime < this.THROTTLE_WINDOW_MS) {
            entry.count++;
            return true; // Throttle
        }

        const repeats = entry.count;
        this.throttleMap.set(key, { count: 1, lastTime: now });

        if (repeats > 1) {
            const throttleMsg = this.isProduction
                ? JSON.stringify({
                    level: 'INFO',
                    code: 'SYS-THROTTLE',
                    message: `Repeated x${repeats}: ${key}`,
                    timestamp: new Date().toISOString(),
                    metadata: logStorage.getStore() || {}
                })
                : `[REPEATED x${repeats}] PREVIOUS LOG ${key}`;
            process.stdout.write(`${throttleMsg}\n`);
        }
        return false;
    }

    public debug(code: LogCode, message: string, metadata?: LogMetadata) {
        if (this.logLevel > LogLevel.DEBUG) return;
        console.log(this.format(LogLevel.DEBUG, code, message, metadata));
    }

    public info(code: LogCode, message: string, metadata?: LogMetadata) {
        if (this.logLevel > LogLevel.INFO) return;
        // Don't throttle important info logs if they contain unique metadata
        console.log(this.format(LogLevel.INFO, code, message, metadata));
    }

    public warn(code: LogCode, message: string, metadata?: LogMetadata) {
        if (this.logLevel > LogLevel.WARN) return;
        console.warn(this.format(LogLevel.WARN, code, message, metadata));
    }

    public error(code: LogCode, message: string, metadata?: LogMetadata) {
        if (this.logLevel > LogLevel.ERROR) return;

        const storageMeta = logStorage.getStore() || {};
        const combinedMeta = { ...storageMeta, ...metadata };

        // Enhance error logs with an Action Guideline if available
        if (combinedMeta.action) {
            message = `${message} | ACTION REQUIRED: ${combinedMeta.action}`;
        }

        console.error(this.format(LogLevel.ERROR, code, message, metadata));
    }

    /**
     * Specialized method for high-frequency logs (e.g., polling)
     */
    public throttled(code: LogCode, message: string, metadata?: LogMetadata) {
        if (this.logLevel > LogLevel.INFO) return;
        if (this.shouldThrottle(code, message)) return;
        console.log(this.format(LogLevel.INFO, code, message, metadata));
    }
}

export const logger = new Logger();
export default logger;
