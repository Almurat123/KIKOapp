import { LogCode, LogMetadata, LogRole } from '../config/logRegistry.js';
import { env } from '../config/env.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import * as fs from 'fs';
import * as path from 'path';

export const logStorage = new AsyncLocalStorage<LogMetadata>();

// Ensure logs directory exists
const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}
const LOG_FILE_PATH = path.join(LOG_DIR, 'app.log');
const logStream = fs.createWriteStream(LOG_FILE_PATH, { flags: 'a' });

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

// [Logic]: Mapping internal LogLevel to shorthand symbols for brevity. [Ref]: backend.txt
const LEVEL_SHORTHAND: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: 'dbg',
    [LogLevel.INFO]: 'inf',
    [LogLevel.WARN]: 'wrn',
    [LogLevel.ERROR]: 'err',
};

class Logger {
    private logLevel: LogLevel;
    private throttleMap: Map<string, { count: number; lastTime: number }> = new Map();
    private aggregator: LogAggregator;
    private timers: Map<string, number> = new Map();
    private THROTTLE_WINDOW_MS = 5000;
    constructor() {
        this.logLevel = this.parseLogLevel(env.logLevel || 'info');
        this.aggregator = new LogAggregator(this);
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
        const levelShort = LEVEL_SHORTHAND[level];

        // Merge with storage metadata
        const storageMeta = logStorage.getStore() || {};
        const combinedMeta = { ...storageMeta, ...metadata };

        // [Logic]: Default role based on code prefix or explicit meta.
        const role = combinedMeta.role || this.getDefaultRole(code);
        combinedMeta.role = role;

        // [Logic]: Dual-Channel Logging
        // 1. File Output: Standard JSON (Full Data)
        const filePayload = JSON.stringify({
            timestamp,
            level: levelName,
            role,
            code,
            message,
            metadata: combinedMeta,
            service: 'kiko-api',
            env: process.env.NODE_ENV
        });

        // Write to file asynchronously to avoid blocking event loop
        logStream.write(filePayload + '\n');

        // 2. Console Output: Human-Readable "Monitor" Mode
        // [Logic]: Production stays JSON for machine parsing (CloudWatch etc)
        if (this.isProduction) {
            return filePayload;
        }

        // [Logic]: Development - Concise "Key=Value" format
        // Format: [TIME] [lvl] [ROLE] [CODE] Message | key=value key2=value2

        // Time & Header
        const timeShort = timestamp.split('T')[1].split('.')[0];
        const header = `[${timeShort}] [${levelShort}] [${role}] [${code}]`;

        // Process Metadata for Console
        // [Logic]: Extract error reason, flatten others to k=v
        let reason = message;
        let contextKV: string[] = [];

        const { traceId, durationMs, role: _, ...rest } = combinedMeta;

        // Error handling (Console: simplified, File: full stack in JSON)
        if (rest.error && rest.error instanceof Error) {
            const simplified = this.simplifyError(rest.error);
            reason = `${message} : ${simplified.message}`;
            delete rest.error;
        } else if (rest.err && rest.err instanceof Error) {
            const simplified = this.simplifyError(rest.err);
            reason = `${message} : ${simplified.message}`;
            delete rest.err;
        }

        // Flatten remaining context to K=V
        contextKV = this.formatContextToKV(rest);

        if (traceId) contextKV.unshift(`tid=${traceId}`);
        if (durationMs) contextKV.push(`dur=${durationMs}ms`);

        // Assemble
        const kvString = contextKV.length > 0 ? ` | ${contextKV.join(' ')}` : '';
        const fullLine = `${header} ${reason}${kvString}`;

        return fullLine; // No truncation, let terminal wrap
    }

    // [Logic]: Helper to format object into k=v pairs
    private formatContextToKV(meta: any): string[] {
        const values: string[] = [];
        for (const [key, value] of Object.entries(meta)) {
            if (value === null || value === undefined) continue;

            let strVal = '';
            if (typeof value === 'object') {
                if (value instanceof Date) strVal = value.toISOString();
                else if (Array.isArray(value)) strVal = `[${value.length}]`;
                else {
                    // Start with simple identification
                    const v = value as any;
                    if (v.id) strVal = `id:${v.id}`;
                    else if (v.symbol) strVal = v.symbol;
                    else if (v.address) strVal = v.address;
                    else {
                        try {
                            strVal = JSON.stringify(value);
                            // If it's too long, just say Object
                            if (strVal.length > 50) strVal = '{Obj}';
                        }
                        catch { strVal = '{Cycle}'; }
                    }
                }
            } else {
                strVal = String(value);
            }
            values.push(`${key}=${strVal}`);
        }
        return values;
    }







    /**
     * [Logic]: Processes metadata to simplify Errors and prevent circular refs.
     */
    private processMetadata(meta: any): any {
        const processed: any = {};
        for (const [key, value] of Object.entries(meta)) {
            if (value instanceof Error) {
                processed[key] = this.simplifyError(value);
            } else if (typeof value === 'object' && value !== null) {
                // Shallow clone/stringify to avoid circularity issues in simple logger
                try { processed[key] = JSON.parse(JSON.stringify(value)); }
                catch (e) { processed[key] = '[Circular/Complex Object]'; }
            } else {
                processed[key] = value;
            }
        }
        return processed;
    }

    /**
     * [Logic]: Extracts critical info from Error objects. [Ref]: implementation_plan.md
     */
    private simplifyError(err: Error): any {
        const stack = err.stack || '';
        const businessFrame = stack.split('\n').find(line => line.includes('/src/') && !line.includes('node_modules')) || stack.split('\n')[1] || '';
        return {
            name: err.name,
            message: err.message,
            at: businessFrame.trim()
        };
    }

    /**
     * [Logic]: Truncates string to keep it within 2 lines. [Ref]: Google/Microsoft specs
     */
    private truncatePayload(str: string, limit: number = 160): string {
        if (str.length <= limit) return str;
        const half = Math.floor((limit - 20) / 2);
        return `${str.slice(0, half)}...[truncated ${str.length - limit} chars]...${str.slice(-half)}`;
    }

    /**
     * [Logic]: Heuristic to assign roles based on LogCode prefixes.
     */
    private getDefaultRole(code: LogCode): LogRole {
        if (code.startsWith('EXE-') || code === LogCode.WTC_SWAP_DETECTED) return LogRole.AUDIT;
        if (code.startsWith('API-') || code.startsWith('PRF-') || code.startsWith('CH-')) return LogRole.METRIC;
        if (code.startsWith('SYS-')) return LogRole.EVENT;
        return LogRole.TRACE;
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
    /**
     * Aggregates repetitive logs and reports them periodically
     */
    public aggregate(code: LogCode, message: string, metadata?: LogMetadata) {
        if (this.logLevel > LogLevel.INFO) return;
        this.aggregator.add(code, message, metadata);
    }
}

/**
 * Log Aggregator
 * Collects high-frequency logs and reports summarized stats periodically
 */
class LogAggregator {
    private logs: Map<string, { count: number; firstTime: number; lastTime: number; metadata: any }> = new Map();
    private readonly REPORT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
    // private readonly REPORT_INTERVAL_MS = 60 * 1000; // 1 minute (For testing)
    private timer: NodeJS.Timeout;
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
        this.timer = setInterval(() => this.flush(), this.REPORT_INTERVAL_MS);
        // Ensure timer doesn't prevent process exit
        this.timer.unref();
    }

    public add(code: LogCode, message: string, metadata?: LogMetadata) {
        const key = `${code}|${message}`;
        const now = Date.now();

        if (!this.logs.has(key)) {
            this.logs.set(key, {
                count: 1,
                firstTime: now,
                lastTime: now,
                metadata: metadata // Keep sample metadata from first occurrence
            });
        } else {
            const entry = this.logs.get(key)!;
            entry.count++;
            entry.lastTime = now;
            // Optionally update usage stats in metadata if needed, but keeping it simple for now
        }
    }

    public flush() {
        if (this.logs.size === 0) return;

        const report: string[] = [];
        const now = new Date().toISOString();

        report.push(`📊 [Log Aggregation Report] ${now}`);
        report.push(`----------------------------------------`);

        this.logs.forEach((stats, key) => {
            const [code, message] = key.split('|');
            const durationSec = ((stats.lastTime - stats.firstTime) / 1000).toFixed(1);
            const rate = (stats.count / (Math.max(1, stats.lastTime - stats.firstTime) / 60000)).toFixed(1); // logs per minute

            report.push(`• [${code}] "${message}"`);
            report.push(`  Count: ${stats.count} | Span: ${durationSec}s | Rate: ~${rate}/min`);
        });

        report.push(`----------------------------------------`);

        // Print directly to stdout to bypass logger formatting/filtering logic for the report itself
        // Or use logger.info with a special code
        // [Ref]: Use console.log with shorthand inf for the report.
        console.log(`[${now}] [inf] [AUDIT] [${LogCode.SYS_AGG_REPORT}] 📊 [Log Aggregation Report]`);
        console.log(report.join('\n'));

        // Clear aggregation buffer
        this.logs.clear();
    }
}

export const logger = new Logger();
export default logger;
