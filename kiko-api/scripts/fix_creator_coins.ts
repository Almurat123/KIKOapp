import { pool } from '../src/db/connection.js';
import snapchainService from '../src/services/snapchainService.js';
import { zoraService } from '../src/services/zoraService.js';

async function main() {
    console.log('Fixing Creator Coin data for all casts...');

    // Get all unique authors
    const authorsResult = await pool.query(`
        SELECT DISTINCT fid, author_username 
        FROM trending_casts 
        WHERE author_creator_coin IS NULL
    `);

    console.log(`Found ${authorsResult.rows.length} authors without Creator Coin`);

    let fixed = 0;
    for (const author of authorsResult.rows) {
        try {
            // Get user's verified addresses
            const userData = await snapchainService.getUserDataByFid(author.fid);
            if (!userData.verifications || userData.verifications.length === 0) continue;

            // Check for Creator Coin
            let creatorCoin = null;
            for (const address of userData.verifications) {
                if (!address.startsWith('0x')) continue;
                creatorCoin = await zoraService.getUserCreatorCoin(address);
                if (creatorCoin) break;
            }

            if (creatorCoin) {
                // Update all casts from this user
                await pool.query(`
                    UPDATE trending_casts 
                    SET author_creator_coin = $1 
                    WHERE fid = $2
                `, [JSON.stringify(creatorCoin), author.fid]);

                console.log(`✅ Updated casts for @${author.author_username} with Creator Coin: ${creatorCoin.name}`);
                fixed++;
            }
        } catch (error) {
            // Ignore errors
        }
    }

    console.log(`\nFixed ${fixed} authors`);
    await pool.end();
}

main().catch(console.error);
