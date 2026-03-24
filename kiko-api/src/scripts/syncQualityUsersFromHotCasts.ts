import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import qualityUsersRepo from '../repositories/qualityUsersRepository.js';
import { computeQualityUsersFromHotCasts, type ComputedQualityUser } from '../services/qualityUsersSync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePathFromArgOrEnv(
  argValue: string | undefined,
  envValue: string | undefined,
  defaultRelativePath: string
): string {
  const raw = argValue || envValue || defaultRelativePath;
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function readJsonFile(filePath: string): unknown {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(fileContent);
}

function serializeUsers(users: ComputedQualityUser[]) {
  return users.map((user) => ({
    fid: user.fid,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    bio: user.bio,
    source: 'dune_hot_casts',
    isActive: true,
    firstSeenIndex: user.firstSeenIndex,
  }));
}

async function main() {
  const inputPath = resolvePathFromArgOrEnv(
    process.argv[2],
    process.env.QUALITY_CASTS_PATH,
    path.resolve(__dirname, '../../data/real_hot_casts.json')
  );

  const outputPath = resolvePathFromArgOrEnv(
    process.argv[3],
    process.env.QUALITY_USERS_OUTPUT_PATH,
    path.resolve(__dirname, '../../data/real_hot_users.json')
  );

  if (!fs.existsSync(inputPath)) {
    throw new Error(
      `Input file not found: ${inputPath}. ` +
      'Provide a Dune hot-cast export as JSON or set QUALITY_CASTS_PATH.'
    );
  }

  const parsed = readJsonFile(inputPath);
  const { totalCastRows, processedCastRows, uniqueUsers } = computeQualityUsersFromHotCasts(parsed, 1000);

  if (uniqueUsers.length === 0) {
    throw new Error('No quality users were derived from the hot-cast input.');
  }

  const payload = serializeUsers(uniqueUsers);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');

  const savedCount = await qualityUsersRepo.mergeQualityUsersFromFids(
    uniqueUsers.map((user) => user.fid),
    'dune_hot_casts'
  );

  console.log(JSON.stringify({
    inputPath,
    outputPath,
    totalCastRows,
    processedCastRows,
    uniqueUsers: uniqueUsers.length,
    savedCount,
  }, null, 2));
}

main().catch((error) => {
  console.error('[syncQualityUsersFromHotCasts] Failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
