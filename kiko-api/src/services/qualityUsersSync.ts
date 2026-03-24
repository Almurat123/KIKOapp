export interface HotCastAuthorLike {
  fid?: number | string | null;
  username?: string | null;
  displayName?: string | null;
  avatar?: string | null;
  bio?: string | null;
}

export interface QualityUserLike {
  fid?: number | string | null;
  username?: string | null;
  displayName?: string | null;
  avatar?: string | null;
  bio?: string | null;
  pfp?: string | null;
  pfp_url?: string | null;
  display_name?: string | null;
  user_name?: string | null;
}

export interface HotCastLike {
  fid?: number | string | null;
  author?: HotCastAuthorLike | null;
  cast?: {
    fid?: number | string | null;
    author?: HotCastAuthorLike | null;
  } | null;
  username?: string | null;
  displayName?: string | null;
  avatar?: string | null;
  bio?: string | null;
}

export interface ComputedQualityUser {
  fid: number;
  username?: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  firstSeenIndex: number;
}

export interface QualityUsersComputationResult {
  totalCastRows: number;
  processedCastRows: number;
  uniqueUsers: ComputedQualityUser[];
}

function toPositiveInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function getRows(source: unknown): any[] {
  const root = source as any;
  if (Array.isArray(source)) return source;
  if (Array.isArray(root?.rows)) return root.rows;
  if (Array.isArray(root?.casts)) return root.casts;
  if (Array.isArray(root?.data)) return root.data;
  if (Array.isArray(root?.result?.rows)) return root.result.rows;
  if (Array.isArray(root?.result?.data)) return root.result.data;
  return [];
}

function pickAuthor(cast: HotCastLike): HotCastAuthorLike | null {
  if (cast?.author) return cast.author;
  if (cast?.cast?.author) return cast.cast.author;
  return null;
}

function pickFid(cast: HotCastLike): number | null {
  return (
    toPositiveInteger(cast?.fid) ||
    toPositiveInteger(cast?.author?.fid) ||
    toPositiveInteger(cast?.cast?.fid) ||
    toPositiveInteger(cast?.cast?.author?.fid)
  );
}

/**
 * Compute a stable list of quality users from a ranked hot-cast list.
 *
 * The input is treated as a ranked list, so the first 1000 rows are the active
 * selection window. A user qualifies if their FID appears in that window at
 * least once.
 */
export function computeQualityUsersFromHotCasts(
  input: unknown,
  limit: number = 1000
): QualityUsersComputationResult {
  const rows: HotCastLike[] = getRows(input) as HotCastLike[];

  const cappedRows = rows.slice(0, Math.max(0, limit));
  const unique = new Map<number, ComputedQualityUser>();

  for (let index = 0; index < cappedRows.length; index++) {
    const cast = cappedRows[index];
    const fid = pickFid(cast);
    if (!fid || unique.has(fid)) continue;

    const author = pickAuthor(cast) || {};
    unique.set(fid, {
      fid,
      username: typeof author.username === 'string' && author.username.trim() ? author.username.trim() : undefined,
      displayName: typeof author.displayName === 'string' && author.displayName.trim() ? author.displayName.trim() : undefined,
      avatar: typeof author.avatar === 'string' && author.avatar.trim() ? author.avatar.trim() : undefined,
      bio: typeof author.bio === 'string' && author.bio.trim() ? author.bio.trim() : undefined,
      firstSeenIndex: index,
    });
  }

  return {
    totalCastRows: rows.length,
    processedCastRows: cappedRows.length,
    uniqueUsers: Array.from(unique.values()),
  };
}

export interface ParsedQualityUsersResult {
  totalRows: number;
  processedRows: number;
  usersByFid: Map<number, ComputedQualityUser>;
}

export function parseQualityUsers(
  input: unknown,
  limit: number = 1000
): ParsedQualityUsersResult {
  const rows: QualityUserLike[] = getRows(input) as QualityUserLike[];
  const cappedRows = rows.slice(0, Math.max(0, limit));
  const usersByFid = new Map<number, ComputedQualityUser>();

  for (let index = 0; index < cappedRows.length; index++) {
    const row = cappedRows[index];
    const fid = toPositiveInteger(row?.fid);
    if (!fid || usersByFid.has(fid)) continue;

    const username = typeof row.username === 'string' && row.username.trim()
      ? row.username.trim()
      : typeof row.user_name === 'string' && row.user_name.trim()
        ? row.user_name.trim()
        : undefined;
    const displayName = typeof row.displayName === 'string' && row.displayName.trim()
      ? row.displayName.trim()
      : typeof row.display_name === 'string' && row.display_name.trim()
        ? row.display_name.trim()
        : undefined;
    const avatar = typeof row.avatar === 'string' && row.avatar.trim()
      ? row.avatar.trim()
      : typeof row.pfp === 'string' && row.pfp.trim()
        ? row.pfp.trim()
        : typeof row.pfp_url === 'string' && row.pfp_url.trim()
          ? row.pfp_url.trim()
          : undefined;
    const bio = typeof row.bio === 'string' && row.bio.trim() ? row.bio.trim() : undefined;

    usersByFid.set(fid, {
      fid,
      username,
      displayName,
      avatar,
      bio,
      firstSeenIndex: index,
    });
  }

  return {
    totalRows: rows.length,
    processedRows: cappedRows.length,
    usersByFid,
  };
}

export function filterQualityUsersByHotCasts(
  hotCastUsers: ComputedQualityUser[],
  qualityUsersByFid: Map<number, ComputedQualityUser>
): ComputedQualityUser[] {
  const filtered: ComputedQualityUser[] = [];

  for (const hotUser of hotCastUsers) {
    const qualityUser = qualityUsersByFid.get(hotUser.fid);
    if (!qualityUser) continue;

    filtered.push({
      fid: hotUser.fid,
      username: qualityUser.username || hotUser.username,
      displayName: qualityUser.displayName || hotUser.displayName,
      avatar: qualityUser.avatar || hotUser.avatar,
      bio: qualityUser.bio || hotUser.bio,
      firstSeenIndex: hotUser.firstSeenIndex,
    });
  }

  return filtered;
}
