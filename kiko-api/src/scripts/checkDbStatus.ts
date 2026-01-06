
import { pool } from '../db/connection.js';

async function main() {
    const args = process.argv.slice(2);
    const fid = args[0] ? parseInt(args[0]) : 8;

    console.log(`Checking Database for FID: ${fid}...`);

    try {
        // 1. Check Quality Users Table
        const userRes = await pool.query(
            `SELECT fid, username, has_creator_coin, creator_coin_address, last_coin_check 
       FROM quality_farcaster_users 
       WHERE fid = $1`,
            [fid]
        );

        if (userRes.rows.length > 0) {
            console.log('\n[quality_farcaster_users]');
            console.table(userRes.rows[0]);
        } else {
            console.log('\n[quality_farcaster_users] User not found.');
        }

        // 2. Check Trending Casts Table (Recent casts by this user)
        const castsRes = await pool.query(
            `SELECT cast_hash, fid, author_username, is_base_app_coin, coin_value, author_creator_coin 
       FROM trending_casts 
       WHERE fid = $1 
       ORDER BY timestamp DESC 
       LIMIT 3`,
            [fid]
        );

        if (castsRes.rows.length > 0) {
            console.log(`\n[trending_casts] Found ${castsRes.rows.length} recent casts:`);
            castsRes.rows.forEach((row, i) => {
                console.log(`\n--- Cast ${i + 1} (${row.cast_hash.substring(0, 10)}...) ---`);
                console.log(`is_base_app_coin: ${row.is_base_app_coin}`);
                console.log(`coin_value: ${row.coin_value}`);
                console.log('author_creator_coin:', row.author_creator_coin ? JSON.stringify(JSON.parse(row.author_creator_coin as string), null, 2) : 'NULL');
            });
        } else {
            console.log('\n[trending_casts] No casts found for this user.');
        }

    } catch (error) {
        console.error('Database Error:', error);
    } finally {
        await pool.end();
    }
}

main();
