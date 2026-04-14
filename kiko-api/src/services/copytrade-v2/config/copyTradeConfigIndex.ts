import prisma, { withRetry } from '../../../db/prisma.js';
import { normalizeAddress } from '../../../utils/address.js';
import { resolveExecutionModeFromConfig } from '../../copyTradeExecutionMode.js';

type IndexedCopyTradeConfig = any;

type CacheEntry = {
    configs: IndexedCopyTradeConfig[];
    timestamp: number;
};

const CONFIG_INDEX_TTL_MS = Math.max(5_000, Number(process.env.COPYTRADE_CONFIG_INDEX_TTL_MS || '60000'));
const configIndexCache = new Map<string, CacheEntry>();
const configIndexInflight = new Map<string, Promise<IndexedCopyTradeConfig[]>>();

function buildConfigIndexKey(chainId: number, targetWallet: string): string {
    const normalizedTarget = normalizeAddress(targetWallet);
    return normalizedTarget ? `${chainId}:${normalizedTarget}` : `${chainId}:`;
}

// CONTEXT MEMORY
// Updated: 2026-04-14
// Author: Mira Chen
// Reason: Copytrade buy hot path was resolving follower configs with repeated
// database reads, user joins, and settings warmup on every leader buy event.
// Goal: Preserve a hot-path-ready config index so the runtime can hit
// `chainId + targetWallet -> configs[]` directly instead of rebuilding follower
// context on every event.
// Owns: Active copytrade config index hydration, per-wallet cache reuse, and
// targeted invalidation after config writes.
// Does Not Own: Event ingress truth, runtime admission policy, or swap execution.
// Design Language:
// - Config lookup for hot-path buy execution should be index-first, not query-first.
// - Joined user and userSettings context may be cached with the config tuple if
//   invalidation is explicit on config writes.
// - Forbidden local patch patterns: reintroducing per-event `findMany` + user
//   warmup as the primary buy-path lookup owner.
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/design-language/copytrade-buy-hot-path-refactor-todo.md
// - Kind: repo doc
// - Retrieved: 2026-04-14
// - Applied To: moving copytrade config resolution off the repeated buy-event path
// - Verification: verified in code design review
// - Source: /Users/almurat/Downloads/logs.1776159582066.json
// - Kind: runtime observation
// - Retrieved: 2026-04-14
// - Applied To: buy hot path latency where preparation should avoid repeated config/user warmup work
// - Verification: verified in runtime log analysis
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/copytrade-buy-hot-path-refactor-todo.md
// - /Users/almurat/KiKo/system-journal/owner-map/copytrade-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-14-copytrade-buy-config-index-and-shared-warmup-decoupling.md
async function loadActiveCopyTradeConfigs(chainId: number, normalizedTargetWallet: string): Promise<IndexedCopyTradeConfig[]> {
    const rawConfigs = await withRetry(() => prisma.copyTradeConfig.findMany({
        where: {
            targetWallet: { mode: 'insensitive', equals: normalizedTargetWallet },
            chainId,
            status: 'active',
        },
        orderBy: { updatedAt: 'desc' },
    }));

    if (rawConfigs.length === 0) {
        return [];
    }

    const userIds = [...new Set(rawConfigs.map((config) => String(config.userId || '')).filter(Boolean))];
    const [users, userSettings] = await Promise.all([
        prisma.user.findMany({
            where: { privyDid: { in: userIds } },
        }),
        prisma.userSettings.findMany({
            where: { userId: { in: userIds } },
        }),
    ]);

    const userMap = new Map(users.map((user) => [user.privyDid, user]));
    const userSettingsMap = new Map(userSettings.map((settings) => [settings.userId, settings]));

    return rawConfigs
        .map((config) => {
            const user = userMap.get(String(config.userId || ''));
            if (!user) return null;
            const executionMode = resolveExecutionModeFromConfig({
                requested: config.executionMode,
                legacyDisableTokenInfo: config.disableTokenInfo,
                fallback: 'normal',
            }).mode;
            return {
                ...config,
                user,
                userSettings: userSettingsMap.get(String(config.userId || '')) || null,
                executionMode,
                fastExecutionEnabled: executionMode !== 'safe',
            };
        })
        .filter(Boolean);
}

export async function getActiveCopyTradeConfigIndex(
    chainId: number,
    targetWallet: string
): Promise<IndexedCopyTradeConfig[]> {
    const normalizedTargetWallet = normalizeAddress(targetWallet);
    if (!normalizedTargetWallet) return [];

    const key = buildConfigIndexKey(chainId, normalizedTargetWallet);
    const cached = configIndexCache.get(key);
    if (cached && Date.now() - cached.timestamp < CONFIG_INDEX_TTL_MS) {
        return cached.configs;
    }

    const existing = configIndexInflight.get(key);
    if (existing) return existing;

    const inflight = loadActiveCopyTradeConfigs(chainId, normalizedTargetWallet)
        .then((configs) => {
            configIndexCache.set(key, {
                configs,
                timestamp: Date.now(),
            });
            return configs;
        })
        .finally(() => {
            configIndexInflight.delete(key);
        });

    configIndexInflight.set(key, inflight);
    return inflight;
}

export function invalidateActiveCopyTradeConfigIndex(targetWallet: string, chainId: number): void {
    const key = buildConfigIndexKey(chainId, targetWallet);
    configIndexCache.delete(key);
    configIndexInflight.delete(key);
}

export function invalidateActiveCopyTradeConfigIndexEntries(entries: Array<{ targetWallet: string; chainId: number }>): void {
    for (const entry of entries) {
        invalidateActiveCopyTradeConfigIndex(entry.targetWallet, entry.chainId);
    }
}

export const __copyTradeConfigIndexTest = {
    clear(): void {
        configIndexCache.clear();
        configIndexInflight.clear();
    }
};
