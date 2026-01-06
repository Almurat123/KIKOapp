/**
 * Export all Farcaster users from database to real_hot_users.json
 * 
 * Run: npx tsx scripts/export-farcaster-users.ts
 */
import { pool } from '../src/db/connection.js';
import * as fs from 'fs';
import * as path from 'path';

async function exportFarcasterUsers() {
    try {
        console.log('=== 导出 Farcaster 用户到 JSON ===\n');

        // 查询所有唯一用户，按热度排序（出现次数 + 总互动量）
        const result = await pool.query(`
            SELECT 
                fid,
                author_username as username,
                author_display_name as display_name,
                COUNT(*) as cast_count,
                SUM(stats_likes) as total_likes,
                SUM(stats_recasts) as total_recasts,
                MAX(heat_score) as max_heat_score
            FROM trending_casts 
            WHERE fid IS NOT NULL
            GROUP BY fid, author_username, author_display_name
            ORDER BY total_likes DESC, cast_count DESC
        `);

        console.log(`从数据库获取了 ${result.rows.length} 个唯一用户\n`);

        // 转换为 JSON 格式
        const users = result.rows.map((r: any) => ({
            fid: r.fid,
            username: r.username,
            displayName: r.display_name,
            stats: {
                castCount: parseInt(r.cast_count),
                totalLikes: parseInt(r.total_likes) || 0,
                totalRecasts: parseInt(r.total_recasts) || 0,
                maxHeatScore: parseFloat(r.max_heat_score) || 0
            }
        }));

        // 输出前 10 个热门用户
        console.log('前 10 个热门用户:');
        users.slice(0, 10).forEach((u: any, i: number) => {
            console.log(`  ${i + 1}. @${u.username} (FID: ${u.fid}) - ${u.stats.totalLikes} likes`);
        });

        // 保存到 JSON 文件
        const outputPath = path.join(process.cwd(), '..', 'test', 'Farcaste', 'real_hot_users.json');

        // 简化版本 - 只保留 fid 和 username
        const simpleUsers = users.map((u: any) => ({
            fid: u.fid,
            username: u.username
        }));

        fs.writeFileSync(outputPath, JSON.stringify(simpleUsers, null, 4));
        console.log(`\n✅ 已导出 ${simpleUsers.length} 个用户到:`);
        console.log(`   ${outputPath}`);

        // 同时保存完整版本（包含统计数据）
        const fullOutputPath = path.join(process.cwd(), '..', 'test', 'Farcaste', 'real_hot_users_full.json');
        fs.writeFileSync(fullOutputPath, JSON.stringify(users, null, 4));
        console.log(`✅ 完整版本（含统计）已导出到:`);
        console.log(`   ${fullOutputPath}`);

    } catch (e: any) {
        console.log('错误:', e.message);
    } finally {
        await pool.end();
    }
}

exportFarcasterUsers();
