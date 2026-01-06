import { pool } from '../src/db/connection.js';

async function checkData() {
    try {
        console.log('Checking for creator coins in DB...');
        const res = await pool.query(`
      SELECT author_username, author_creator_coin 
      FROM trending_casts 
      WHERE author_creator_coin IS NOT NULL
      LIMIT 5
    `);

        if (res.rows.length === 0) {
            console.log('❌ No creator coins found in trending_casts.');
            // Check total rows to be sure data was inserted at all
            const countRes = await pool.query('SELECT count(*) FROM trending_casts');
            console.log(`ℹ️ Total trending_casts rows: ${countRes.rows[0].count}`);
        } else {
            console.log(`✅ Found ${res.rows.length} casts with creator coins!`);
            console.log('Sample:', JSON.stringify(res.rows[0], null, 2));
        }
    } catch (error) {
        console.error('Check failed:', error);
    } finally {
        process.exit(0);
    }
}

checkData();
