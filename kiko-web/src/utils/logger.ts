/**
 * KiKo Logger - 统一日志工具
 * 
 * 使用示例:
 * import { logger } from '@/utils/logger';
 * 
 * logger.info('AI', '调用 Claude 模型');
 * logger.error('Swap', '交易失败', error);
 * logger.debug('Wallet', '余额查询', { balance: 100 });
 * 
 * // 性能计时
 * const timer = logger.time('AI', '模型响应');
 * await callModel();
 * timer.end(); // 输出: [AI] 模型响应 完成 (1.23s)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
    /** 是否启用 debug 级别日志 */
    enableDebug: boolean;
    /** 是否在生产环境禁用所有日志 */
    disableInProduction: boolean;
    /** 是否包含时间戳 */
    showTimestamp: boolean;
}

// 日志分类标签
type LogCategory =
    | 'AI'       // AI 模型调用
    | 'Swap'     // 交易相关
    | 'Wallet'   // 钱包操作
    | 'API'      // 外部 API 调用
    | 'Auth'     // 认证相关
    | 'Error'    // 错误处理
    | 'Perf'     // 性能监控
    | 'App'      // 应用通用
    | string;    // 允许自定义

// 颜色配置 (控制台)
const COLORS: Record<LogCategory, string> = {
    AI: '#8B5CF6',      // 紫色
    Swap: '#10B981',    // 绿色
    Wallet: '#F59E0B',  // 橙色
    API: '#3B82F6',     // 蓝色
    Auth: '#EC4899',    // 粉色
    Error: '#EF4444',   // 红色
    Perf: '#6366F1',    // 靛蓝
    App: '#6B7280',     // 灰色
};

const LEVEL_STYLES: Record<LogLevel, { icon: string; color: string }> = {
    debug: { icon: '🔍', color: '#9CA3AF' },
    info: { icon: 'ℹ️', color: '#3B82F6' },
    warn: { icon: '⚠️', color: '#F59E0B' },
    error: { icon: '❌', color: '#EF4444' },
};

class Logger {
    private config: LoggerConfig;

    constructor(config?: Partial<LoggerConfig>) {
        this.config = {
            enableDebug: import.meta.env.DEV, // 开发环境默认开启
            disableInProduction: false,
            showTimestamp: true,
            ...config,
        };
    }

    private shouldLog(level: LogLevel): boolean {
        // 生产环境禁用（如果配置了）
        if (this.config.disableInProduction && import.meta.env.PROD) {
            return false;
        }
        // debug 级别特殊处理
        if (level === 'debug' && !this.config.enableDebug) {
            return false;
        }
        return true;
    }

    private formatMessage(
        level: LogLevel,
        category: LogCategory,
        message: string,
        data?: unknown
    ): void {
        if (!this.shouldLog(level)) return;

        const { icon, color: levelColor } = LEVEL_STYLES[level];
        const categoryColor = COLORS[category] || COLORS.App;

        const timestamp = this.config.showTimestamp
            ? new Date().toLocaleTimeString('zh-CN', { hour12: false })
            : '';

        // 构建控制台输出
        const prefix = timestamp ? `${timestamp} ` : '';
        const categoryBadge = `%c[${category}]%c`;
        const fullMessage = `${prefix}${icon} ${categoryBadge} ${message}`;

        const styles = [
            `color: ${categoryColor}; font-weight: bold; background: ${categoryColor}15; padding: 1px 4px; border-radius: 3px;`,
            'color: inherit;',
        ];

        if (data !== undefined) {
            if (level === 'error') {
                console.error(fullMessage, ...styles, data);
            } else if (level === 'warn') {
                console.warn(fullMessage, ...styles, data);
            } else {
                console.log(fullMessage, ...styles, data);
            }
        } else {
            if (level === 'error') {
                console.error(fullMessage, ...styles);
            } else if (level === 'warn') {
                console.warn(fullMessage, ...styles);
            } else {
                console.log(fullMessage, ...styles);
            }
        }
    }

    // ===== 日志方法 =====

    debug(category: LogCategory, message: string, data?: unknown): void {
        this.formatMessage('debug', category, message, data);
    }

    info(category: LogCategory, message: string, data?: unknown): void {
        this.formatMessage('info', category, message, data);
    }

    warn(category: LogCategory, message: string, data?: unknown): void {
        this.formatMessage('warn', category, message, data);
    }

    error(category: LogCategory, message: string, error?: unknown): void {
        this.formatMessage('error', category, message, error);

        // 同时上报到 Sentry (如果已初始化)
        if (typeof window !== 'undefined' && (window as any).__SENTRY__) {
            import('@sentry/react').then((Sentry) => {
                if (error instanceof Error) {
                    Sentry.captureException(error, {
                        tags: { category },
                        extra: { message },
                    });
                } else {
                    Sentry.captureMessage(`[${category}] ${message}`, {
                        level: 'error',
                        extra: { error },
                    });
                }
            });
        }
    }

    // ===== 性能计时 =====

    time(category: LogCategory, label: string): { end: () => number } {
        const start = performance.now();
        this.debug(category, `${label} 开始...`);

        return {
            end: () => {
                const duration = performance.now() - start;
                const formatted = duration > 1000
                    ? `${(duration / 1000).toFixed(2)}s`
                    : `${duration.toFixed(0)}ms`;

                this.info(category, `${label} 完成 (${formatted})`);
                return duration;
            },
        };
    }

    // ===== 分组日志 =====

    group(category: LogCategory, label: string): void {
        if (!this.shouldLog('debug')) return;
        console.group(`%c[${category}] ${label}`, `color: ${COLORS[category] || COLORS.App}; font-weight: bold;`);
    }

    groupEnd(): void {
        if (!this.shouldLog('debug')) return;
        console.groupEnd();
    }

    // ===== AI 调用专用 =====

    /**
     * AI 模型调用日志
     * @param action - 操作类型
     * @param model - 模型名称 (DeepSeek-V3.2, Grok-4.1-Fast, Claude-3.5, Gemini-2.0)
     * @param data - 附加数据
     */
    ai(
        action: 'request' | 'response' | 'stream-start' | 'stream-chunk' | 'stream-end' | 'error',
        model: 'DeepSeek-V3.2' | 'Grok-4.1' | 'Claude-3.5' | 'Gemini-2.0' | string,
        data?: unknown
    ): void {
        switch (action) {
            case 'request':
                this.info('AI', `📤 请求 ${model}`, data);
                break;
            case 'response':
                this.info('AI', `📥 ${model} 响应`, data);
                break;
            case 'stream-start':
                this.debug('AI', `🌊 ${model} 开始流式输出`);
                break;
            case 'stream-chunk':
                this.debug('AI', `📦 ${model} 流式数据块`, data);
                break;
            case 'stream-end':
                this.info('AI', `✅ ${model} 流式输出完成`);
                break;
            case 'error':
                this.error('AI', `❌ ${model} 调用失败`, data);
                break;
        }
    }

    // ===== Swap 专用 =====

    /**
     * Swap 交易日志
     * @param action - 交易阶段
     * @param data - 交易数据
     */
    swap(
        action: 'init' | 'quote' | 'approve' | 'execute' | 'success' | 'fail',
        data?: unknown
    ): void {
        switch (action) {
            case 'init':
                this.info('Swap', '🔄 发起交易请求', data);
                break;
            case 'quote':
                this.debug('Swap', '💰 获取报价', data);
                break;
            case 'approve':
                this.info('Swap', '✍️ 授权代币', data);
                break;
            case 'execute':
                this.info('Swap', '⚡ 执行交易', data);
                break;
            case 'success':
                this.info('Swap', '✅ 交易成功', data);
                break;
            case 'fail':
                this.error('Swap', '❌ 交易失败', data);
                break;
        }
    }

    // ===== Intent 解析专用 =====

    /**
     * 意图解析日志
     */
    intent(action: 'parse' | 'result' | 'error', data?: unknown): void {
        switch (action) {
            case 'parse':
                this.debug('AI', '🧠 解析用户意图...', data);
                break;
            case 'result':
                this.info('AI', '🎯 意图识别结果', data);
                break;
            case 'error':
                this.error('AI', '❌ 意图解析失败', data);
                break;
        }
    }
}

// 导出单例
export const logger = new Logger();

// 类型导出
export type { LogCategory, LogLevel, LoggerConfig };
