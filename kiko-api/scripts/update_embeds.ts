import { pool } from '../src/db/connection.js';
import snapchainService from '../src/services/snapchainService.js';

async function updateExistingCasts() {
    console.log('Updating existing casts with expanded embeds and bio...\n');

    // Get all casts with castId embeds that need expansion
    const result = await pool.query(`
    SELECT cast_hash, fid, embeds
    FROM trending_casts
    WHERE embeds::text LIKE '%castId%'
    LIMIT 20
  `);

    console.log(`Found ${result.rows.length} casts to update\n`);

    for (const row of result.rows) {
        console.log(`Processing: ${row.cast_hash}`);

        try {
            // Expand embeds
            const expandedEmbeds = await Promise.all(row.embeds.map(async (embed: any) => {
                if (embed.castId && !embed.cast) {
                    try {
                        const quotedCast = await snapchainService.getCastById(embed.castId.fid, embed.castId.hash);
                        if (quotedCast) {
                            const quotedAuthor = await snapchainService.getUserDataByFid(embed.castId.fid);
                            return {
                                ...embed,
                                cast: {
                                    ...quotedCast,
                                    author: {
                                        fid: quotedAuthor.fid,
                                        username: quotedAuthor.username,
                                        displayName: quotedAuthor.displayName,
                                        avatar: quotedAuthor.pfp,
                                        verified: false
                                    }
                                }
                            };
                        }
                    } catch (e) {
                        console.log(`  - Failed to expand embed: ${e}`);
                    }
                }
                return embed;
            }));

            // Get author bio
            const authorData = await snapchainService.getUserDataByFid(row.fid);

            // Update database
            await pool.query(`
        UPDATE trending_casts 
        SET embeds = $1, author_bio = $2, updated_at = NOW()
        WHERE cast_hash = $3
      `, [JSON.stringify(expandedEmbeds), authorData.bio || null, row.cast_hash]);

            console.log(`  ✓ Updated with bio: "${(authorData.bio || '').substring(0, 30)}..."`);
        } catch (e) {
            console.log(`  ✗ Error: ${e}`);
        }
    }

    // Also update bio for other casts
    const allCasts = await pool.query(`
    SELECT cast_hash, fid FROM trending_casts WHERE author_bio IS NULL LIMIT 30
  `);

    console.log(`\nUpdating bio for ${allCasts.rows.length} more casts...`);

    for (const row of allCasts.rows) {
        try {
            const authorData = await snapchainService.getUserDataByFid(row.fid);
            if (authorData.bio) {
                await pool.query(`
          UPDATE trending_casts SET author_bio = $1 WHERE cast_hash = $2
        `, [authorData.bio, row.cast_hash]);
            }
        } catch (e) {
            // Skip
        }
    }

    console.log('\nDone!');
    process.exit(0);
}

updateExistingCasts();
