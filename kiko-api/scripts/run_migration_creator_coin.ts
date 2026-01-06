import { pool } from '../src/db/connection.js';
import fs from 'fs';
import path from 'path';

async function runMigration() {
    console.log('Running migration: add_creator_coin.sql...');

    try {
        const migrationPath = path.join(process.cwd(), 'migrations', 'add_creator_coin.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        await pool.query(sql);

        console.log('Migration executed successfully!');

        // Verify column exists
        const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'trending_casts' AND column_name = 'author_creator_coin';
    `);

        if (result.rows.length > 0) {
            console.log('Verified: author_creator_coin column exists (type: jsonb)');
        } else {
            console.error('Error: Column not found after migration!');
        }
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit(0);
    }
}

runMigration();
