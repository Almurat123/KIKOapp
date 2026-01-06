/**
 * Test DB Insert/Read
 */
import 'dotenv/config';
import { pool } from '../src/db/connection.js';

async function test() {
    try {
        const now = Date.now();
        console.log('Inserting test cast...');
        const result = await pool.query(`
      INSERT INTO trending_casts (
        cast_hash, fid, author_username, author_display_name, author_avatar, 
        text, timestamp, stats_likes, stats_recasts, stats_replies, heat_score, rank, updated_at
      ) VALUES (
        '0xtest' || $1, 1, 'tester', 'Tester', '',
        'Test execution cast', $2, 100, 50, 10, 150, 1, NOW()
      ) RETURNING cast_hash
    `, [Math.floor(Math.random() * 10000), now]);

        console.log('Inserted:', result.rows[0].cast_hash);

        console.log('Reading back...');
        const read = await pool.query('SELECT * FROM trending_casts WHERE cast_hash = $1', [result.rows[0].cast_hash]);
        console.log('Read result:', read.rows.length > 0 ? 'Success' : 'Failed');

        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

test();
