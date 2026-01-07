/**
 * 日志工具 - 统一管理日志输出
 * 生产环境自动禁用 DEBUG 日志
 */

const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

export const logger = {
    log: (...args: any[]) => {
        if (isDevelopment) {
            console.log(...args);
        }
    },
    warn: (...args: any[]) => {
        console.warn(...args);
    },
    error: (...args: any[]) => {
        console.error(...args);
    },
    debug: (...args: any[]) => {
        if (isDevelopment) {
            console.log('[DEBUG]', ...args);
        }
    },
};
