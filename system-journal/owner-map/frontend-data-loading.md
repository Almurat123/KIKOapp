# Frontend Data Loading Owner Map

Updated: 2026-04-17

## Owned Layers

- `kiko-web/src/services/api.ts`
- `kiko-web/src/utils/apiCache.ts`
- `kiko-web/src/pages/TokensPage.tsx`
- `kiko-web/src/pages/TokenDetailPage.tsx`
- `kiko-web/src/hooks/useStrategies.ts`
- `kiko-web/src/services/copyTradeApi.ts`
- `kiko-web/src/services/polymarketCopyApi.ts`

## Ownership Boundaries

### Shared request layer

Owns: request dedupe, short-lived read caching, stale fallback on 429/timeouts.

Does not own: page-specific batching, mutation invalidation, or backend limits.

### Page-level loaders

Owns: concurrency choices, retry UI, and deciding when to show cached data.

Does not own: the structure of API envelopes or auth token plumbing.

Tokens page note: prefer `/api/tokens/trending/all` as the first load path for
the multi-chain feed; do not restore per-chain live fan-out as the default page
loader.

Token detail note: the route owner should hydrate missing pool metadata once and
pass the resolved snapshot to child embeds; child charts must stay passive.

### Feature-specific loaders

Owns: merging partial results from multiple sources without dropping already
recovered data.

Does not own: global cache policy or request recovery for unrelated pages.
