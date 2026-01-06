import * as Sentry from '@sentry/react';
import { logger } from './logger';

/**
 * Sentry 测试工具
 * 用于验证 Sentry 是否正确配置
 */

export function testSentry() {
    console.log('🧪 开始测试 Sentry...');

    // 1. 检查 Sentry 是否初始化
    const client = Sentry.getClient();
    if (!client) {
        console.error('❌ Sentry 未初始化！请检查 VITE_SENTRY_DSN 环境变量');
        return false;
    }

    console.log('✅ Sentry 已初始化');
    console.log('📍 DSN:', import.meta.env.VITE_SENTRY_DSN?.slice(0, 30) + '...');

    // 2. 发送测试消息
    Sentry.captureMessage('🧪 Sentry 测试消息', {
        level: 'info',
        tags: {
            test: true,
            source: 'manual_test',
        },
    });

    console.log('📤 已发送测试消息到 Sentry');

    // 3. 发送测试错误
    try {
        throw new Error('🧪 Sentry 测试错误 - 这是一个测试');
    } catch (error) {
        Sentry.captureException(error, {
            tags: {
                test: true,
                source: 'manual_test',
            },
            extra: {
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
            },
        });

        console.log('📤 已发送测试错误到 Sentry');
        logger.error('App', 'Sentry 测试错误', error);
    }

    console.log('✅ Sentry 测试完成！');
    console.log('👉 请在 Sentry Dashboard 查看: https://sentry.io/');
    console.log('⏱️ 可能需要等待 10-30 秒才能在 Dashboard 看到');

    return true;
}

/**
 * 测试 Logger
 */
export function testLogger() {
    console.log('🧪 开始测试 Logger...');

    // 基础日志
    logger.info('App', '🧪 Logger 测试 - Info');
    logger.debug('App', '🧪 Logger 测试 - Debug');
    logger.warn('App', '🧪 Logger 测试 - Warn');

    // AI 日志
    logger.ai('request', 'DeepSeek-V3.2', { prompt: 'Hello' });
    logger.ai('response', 'Grok-4.1', { tokens: 1500 });

    // Swap 日志
    logger.swap('init', { tokenIn: 'ETH', tokenOut: 'USDC', amount: 1 });
    logger.swap('success', { txHash: '0x123...' });

    // 性能计时
    const timer = logger.time('App', '测试计时');
    setTimeout(() => {
        timer.end();
    }, 100);

    console.log('✅ Logger 测试完成！请查看上方彩色日志');

    return true;
}

/**
 * 完整测试
 */
export function runFullTest() {
    console.clear();
    console.log('🚀 开始完整测试...\n');

    testLogger();
    console.log('\n---\n');
    testSentry();

    console.log('\n✨ 全部测试完成！');
}
