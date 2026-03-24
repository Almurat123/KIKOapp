import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { env } from '../config/env.js';
import qualityUsersRepo from '../repositories/qualityUsersRepository.js';
import {
  computeQualityUsersFromHotCasts,
  filterQualityUsersByHotCasts,
  parseQualityUsers,
  type ComputedQualityUser,
} from '../services/qualityUsersSync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_CASTS_PATH = path.resolve(__dirname, '../../data/real_hot_casts.json');
const DEFAULT_QUALITY_USERS_QUERY_PATH = path.resolve(__dirname, '../../data/dune_quality_users.json');
const DEFAULT_USERS_PATH = path.resolve(__dirname, '../../data/real_hot_users.json');
const DEFAULT_RECEIPT_PATH = path.resolve(__dirname, '../../data/dune_hot_casts_fetch_receipt.json');
const DEFAULT_LOCK_PATH = path.resolve(__dirname, '../../data/dune_hot_casts_fetch.lock');
const FETCH_LIMIT = 1000;
const HOT_CASTS_QUERY_ID = 3194474;
const QUALITY_USERS_QUERY_ID = 3023113;

function resolvePathFromArgOrEnv(
  argValue: string | undefined,
  envValue: string | undefined,
  fallback: string
): string {
  const raw = argValue || envValue || fallback;
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function getApiKey(): string {
  return env.duneQueries?.apiKey || env.apiKeys.dune || process.env.DUNE_API_KEY || '';
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

async function fetchLatestResultsOnce(queryId: number, apiKey: string) {
  const url = new URL(`https://api.dune.com/api/v1/query/${queryId}/results`);
  url.searchParams.set('limit', String(FETCH_LIMIT));
  url.searchParams.set('offset', '0');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-Dune-API-Key': apiKey,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Dune latest results request failed: HTTP ${response.status} ${body}`.slice(0, 500));
  }

  return response.json();
}

function createExclusiveLock(lockPath: string): number {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  return fs.openSync(lockPath, 'wx');
}

async function main() {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('DUNE_API_KEY is not configured.');
  }

  const castsPath = resolvePathFromArgOrEnv(process.argv[2], process.env.DUNE_HOT_CASTS_OUTPUT_PATH, DEFAULT_CASTS_PATH);
  const qualityUsersQueryPath = resolvePathFromArgOrEnv(process.argv[3], process.env.DUNE_QUALITY_USERS_QUERY_OUTPUT_PATH, DEFAULT_QUALITY_USERS_QUERY_PATH);
  const usersPath = resolvePathFromArgOrEnv(process.argv[4], process.env.DUNE_HOT_USERS_OUTPUT_PATH, DEFAULT_USERS_PATH);
  const receiptPath = resolvePathFromArgOrEnv(process.argv[5], process.env.DUNE_HOT_CASTS_RECEIPT_PATH, DEFAULT_RECEIPT_PATH);
  const lockPath = resolvePathFromArgOrEnv(undefined, process.env.DUNE_HOT_CASTS_LOCK_PATH, DEFAULT_LOCK_PATH);

  if (fs.existsSync(receiptPath)) {
    throw new Error(`Refusing to fetch again: receipt already exists at ${receiptPath}`);
  }

  let lockFd: number | null = null;
  let createdLock = false;
  try {
    lockFd = createExclusiveLock(lockPath);
    createdLock = true;

    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    fs.writeFileSync(receiptPath, JSON.stringify({
      startedAt: new Date().toISOString(),
      status: 'started',
      hotCastsQueryId: HOT_CASTS_QUERY_ID,
      qualityUsersQueryId: QUALITY_USERS_QUERY_ID,
      limit: FETCH_LIMIT,
      castsPath,
      qualityUsersQueryPath,
      usersPath,
    }, null, 2) + '\n', 'utf-8');

    const hotCastsResponse = await fetchLatestResultsOnce(HOT_CASTS_QUERY_ID, apiKey);
    const qualityUsersResponse = await fetchLatestResultsOnce(QUALITY_USERS_QUERY_ID, apiKey);

    const { totalCastRows, processedCastRows, uniqueUsers: hotCastUsers } = computeQualityUsersFromHotCasts(
      hotCastsResponse,
      FETCH_LIMIT
    );
    const { totalRows: totalQualityRows, processedRows: processedQualityRows, usersByFid } = parseQualityUsers(
      qualityUsersResponse,
      FETCH_LIMIT
    );
    const filteredUsers = filterQualityUsersByHotCasts(hotCastUsers, usersByFid);

    if (processedCastRows === 0 || processedQualityRows === 0 || filteredUsers.length === 0) {
      throw new Error('Dune responses did not contain a usable quality-user intersection.');
    }

    fs.mkdirSync(path.dirname(castsPath), { recursive: true });
    fs.mkdirSync(path.dirname(qualityUsersQueryPath), { recursive: true });
    fs.mkdirSync(path.dirname(usersPath), { recursive: true });
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });

    fs.writeFileSync(castsPath, JSON.stringify(hotCastsResponse, null, 2) + '\n', 'utf-8');
    fs.writeFileSync(qualityUsersQueryPath, JSON.stringify(qualityUsersResponse, null, 2) + '\n', 'utf-8');
    fs.writeFileSync(usersPath, JSON.stringify(serializeUsers(filteredUsers), null, 2) + '\n', 'utf-8');

    const savedCount = await qualityUsersRepo.mergeQualityUsersFromFids(
      filteredUsers.map((user) => user.fid),
      'dune_hot_casts'
    );

    const receipt = {
      status: 'completed',
      fetchedAt: new Date().toISOString(),
      hotCastsQueryId: HOT_CASTS_QUERY_ID,
      qualityUsersQueryId: QUALITY_USERS_QUERY_ID,
      limit: FETCH_LIMIT,
      castsPath,
      qualityUsersQueryPath,
      usersPath,
      totalCastRows,
      processedCastRows,
      totalQualityRows,
      processedQualityRows,
      hotCastAuthors: hotCastUsers.length,
      filteredUsers: filteredUsers.length,
      savedCount,
    };

    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', 'utf-8');
    console.log(JSON.stringify(receipt, null, 2));
  } finally {
    if (lockFd !== null) {
      fs.closeSync(lockFd);
    }
    if (createdLock && fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  }
}

main().catch((error) => {
  console.error('[fetchQualityUsersFromDuneHotCasts] Failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
