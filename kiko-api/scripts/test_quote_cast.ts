import { pool } from '../src/db/connection.js';
import snapchainService from '../src/services/snapchainService.js';

async function testQuoteCast() {
    // Get a cast with castId embed from DB
    const result = await pool.query(`
    SELECT cast_hash, text, embeds, mentions
    FROM trending_casts
    WHERE embeds::text LIKE '%castId%'
    LIMIT 1
  `);

    if (result.rows.length === 0) {
        console.log('No cast with castId embed found');
        process.exit(0);
    }

    const row = result.rows[0];
    console.log('Cast:', row.cast_hash);
    console.log('Text:', row.text);
    console.log('Embeds:', JSON.stringify(row.embeds, null, 2));
    console.log('Mentions:', row.mentions);
    console.log('');

    // Try to fetch the quoted cast
    const embed = row.embeds[0];
    if (embed.castId) {
        console.log(`Fetching quoted cast: FID=${embed.castId.fid}, Hash=${embed.castId.hash}`);
        try {
            const quotedCast = await snapchainService.getCastById(embed.castId.fid, embed.castId.hash);
            console.log('Quoted Cast Result:', JSON.stringify(quotedCast, null, 2));

            if (quotedCast) {
                const author = await snapchainService.getUserDataByFid(embed.castId.fid);
                console.log('Quoted Author:', JSON.stringify(author, null, 2));
            }
        } catch (e) {
            console.error('Error:', e);
        }
    }

    process.exit(0);
}

testQuoteCast();
