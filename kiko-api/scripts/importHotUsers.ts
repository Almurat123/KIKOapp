import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function importHotUsers() {
    console.log('🚀 Starting import of Farcaster hot users...');

    // Read the JSON file
    const jsonPath = path.resolve(__dirname, '../../test/Farcaste/real_hot_users.json');
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const users: { fid: number; username: string }[] = JSON.parse(rawData);

    console.log(`📋 Found ${users.length} users in JSON file`);

    // Remove duplicates based on fid
    const uniqueUsers = Array.from(
        new Map(users.map(u => [u.fid, u])).values()
    );
    console.log(`✅ Unique users after deduplication: ${uniqueUsers.length}`);

    let created = 0;
    let errors = 0;

    for (const user of uniqueUsers) {
        try {
            await prisma.qualityFarcasterUser.upsert({
                where: { fid: user.fid },
                create: {
                    fid: user.fid,
                    username: user.username,
                    source: 'json_import',
                    isActive: true,
                },
                update: {
                    username: user.username,
                    isActive: true,
                },
            });
            created++;
        } catch (error) {
            console.error(`❌ Error importing FID ${user.fid}:`, error);
            errors++;
        }
    }

    console.log('\n📊 Import Summary:');
    console.log(`   ✅ Successfully imported/updated: ${created}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log('\n🎉 Import complete!');
}

importHotUsers()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
