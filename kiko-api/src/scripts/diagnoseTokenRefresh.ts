/**
 * Token Refresh Diagnostic Script
 * 运行方式: npx tsx src/scripts/diagnoseTokenRefresh.ts
 * 
 * 诊断 Token 页面刷新问题
 */

import 'dotenv/config';
import prisma from '../db/prisma.js';

const CHAINS = ['eth', 'base', 'solana', 'bsc', 'arbitrum', 'optimism', 'polygon'];

async function diagnose() {
    console.log('====================================');
    console.log('Token 刷新诊断工具');
    console.log('====================================\n');

    try {
        // 1. 检查数据库连接
        console.log('1. 检查数据库连接...');
        await prisma.$queryRaw`SELECT 1`;
        console.log('   ✅ 数据库连接正常\n');

        // 2. 检查各链的 TrendingToken 数据状态
        console.log('2. 检查各链的 TrendingToken 数据状态：\n');

        for (const chain of CHAINS) {
            const result = await prisma.trendingToken.aggregate({
                where: { chain },
                _count: { id: true },
                _max: { updatedAt: true, createdAt: true }
            });

            const count = result._count.id;
            const lastUpdate = result._max.updatedAt;
            const ageMinutes = lastUpdate
                ? Math.round((Date.now() - lastUpdate.getTime()) / 60000)
                : null;

            const status = ageMinutes === null
                ? '❌ 无数据'
                : ageMinutes < 10
                    ? '✅ 正常'
                    : ageMinutes < 60
                        ? '⚠️ 较旧'
                        : '❌ 过期';

            console.log(`   ${chain.toUpperCase().padEnd(10)} | ${status} | 数量: ${count} | 最后更新: ${lastUpdate ? `${ageMinutes} 分钟前 (${lastUpdate.toISOString()})` : 'N/A'
                }`);
        }

        // 3. 检查 Cache 表中的锁状态
        console.log('\n3. 检查 Cache 表中的锁状态：\n');

        const locks = await prisma.cache.findMany({
            where: {
                key: { startsWith: 'lock:tokenJob:' }
            }
        });

        if (locks.length === 0) {
            console.log('   ✅ 没有锁被持有');
        } else {
            console.log('   ⚠️ 发现锁：');
            for (const lock of locks) {
                const expired = lock.expiresAt && new Date() > lock.expiresAt;
                const ageMs = Date.now() - lock.updatedAt.getTime();
                console.log(`   - ${lock.key}`);
                console.log(`     创建于: ${lock.updatedAt.toISOString()} (${Math.round(ageMs / 1000)}s 前)`);
                console.log(`     过期时间: ${lock.expiresAt?.toISOString() || 'N/A'}`);
                console.log(`     状态: ${expired ? '❌ 已过期但未清理' : '🔒 活跃'}`);
            }
        }

        // 4. 检查 trending 缓存
        console.log('\n4. 检查 trending 缓存键：\n');

        const trendingCaches = await prisma.cache.findMany({
            where: {
                key: { startsWith: 'trending:' }
            },
            select: { key: true, updatedAt: true, expiresAt: true }
        });

        if (trendingCaches.length === 0) {
            console.log('   ⚠️ 没有 trending 缓存');
        } else {
            for (const cache of trendingCaches) {
                const ageMinutes = Math.round((Date.now() - cache.updatedAt.getTime()) / 60000);
                console.log(`   - ${cache.key} | ${ageMinutes} 分钟前`);
            }
        }

        // 5. 建议修复操作
        console.log('\n====================================');
        console.log('诊断建议：');
        console.log('====================================\n');

        // 检查是否有过期的锁需要清理
        const staleLocks = locks.filter(l => {
            if (!l.expiresAt) return true;
            return new Date() > l.expiresAt;
        });

        if (staleLocks.length > 0) {
            console.log('🔧 发现过期锁，建议清理：');
            console.log('   运行以下命令清理过期锁：');
            console.log('   npx tsx src/scripts/diagnoseTokenRefresh.ts --fix\n');
        }

        // 检查参数是否需要修复
        if (process.argv.includes('--fix')) {
            console.log('🔧 开始修复...\n');

            // 清理过期锁
            const deletedLocks = await prisma.cache.deleteMany({
                where: {
                    key: { startsWith: 'lock:tokenJob:' }
                }
            });
            console.log(`   ✅ 清理了 ${deletedLocks.count} 个锁\n`);

            // 清理过期缓存
            const deletedCaches = await prisma.cache.deleteMany({
                where: {
                    expiresAt: { lt: new Date() }
                }
            });
            console.log(`   ✅ 清理了 ${deletedCaches.count} 个过期缓存\n`);

            console.log('🔄 现在重启服务器，tokenDataJob 将在30秒后自动开始刷新！');
        }

    } catch (error: any) {
        console.error('❌ 诊断过程中发生错误:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

diagnose().catch(console.error);
