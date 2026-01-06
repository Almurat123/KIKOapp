/**
 * Extract all unique FIDs and compare with real_hot_users.json
 */
import { pool } from '../src/db/connection.js';
import * as fs from 'fs';
import * as path from 'path';

async function extractFIDs() {
    try {
        // 读取 real_hot_users.json
        const jsonPath = path.join(process.cwd(), '..', 'test', 'Farcaste', 'real_hot_users.json');
        const hotUsers = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const hotFids = new Set(hotUsers.map((u: any) => u.fid));

        console.log('=== real_hot_users.json 中的用户 ===');
        hotUsers.forEach((u: any) => console.log(`  FID ${u.fid}: @${u.username}`));

        // 查询数据库中所有唯一的 FID
        const result = await pool.query(`
            SELECT DISTINCT fid, author_username, author_display_name 
            FROM trending_casts 
            WHERE fid IS NOT NULL
            ORDER BY fid
        `);

        console.log('\n=== 数据库中的所有 Farcaster 用户 ===');
        console.log(`找到 ${result.rows.length} 个唯一用户\n`);

        // 检查 hot users 是否在数据库中
        console.log('=== Hot Users 在数据库中的状态 ===');
        hotUsers.forEach((hu: any) => {
            const found = result.rows.find((r: any) => r.fid === hu.fid);
            if (found) {
                console.log(`  ✅ FID ${hu.fid} (@${hu.username}) - 在数据库中`);
            } else {
                console.log(`  ❌ FID ${hu.fid} (@${hu.username}) - 不在数据库中`);
            }
        });

        // 输出前 20 个 FID
        console.log('\n=== 数据库中前 20 个 FID (可添加到 real_hot_users.json) ===');
        result.rows.slice(0, 20).forEach((r: any) => {
            const inHot = hotFids.has(r.fid) ? '(已在 hot_users)' : '';
            console.log(`  { "fid": ${r.fid}, "username": "${r.author_username}" }, ${inHot}`);
        });

    } catch (e: any) {
        console.log('错误:', e.message);
    } finally {
        await pool.end();
    }
}

extractFIDs();
