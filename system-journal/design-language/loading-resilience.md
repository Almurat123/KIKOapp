# Loading Resilience

Updated: 2026-04-17

## Purpose

Define how the UI should behave when backend reads are slow, throttled, or
temporarily unavailable.

## Canonical Rules

1. Prefer stale-but-present data over empty loading states when the failure is
   transient and the page already has a valid snapshot.
2. Keep read fan-out bounded. Do not fan out many chain/page requests in full
   parallel when a small batch size will preserve responsiveness.
3. Do not add cache-busting noise to endpoints that already have request
   deduplication and local response reuse.
4. Surface real auth/signature failures plainly. Recovery logic is for rate
   limits, timeouts, and transient transport errors only.
5. When the backend already exposes a safe aggregate read, prefer it over
   client-side multi-request fan-out for the same page.
6. Keep parent-owned detail hydration on the parent route. Child embeds should
   render the resolved snapshot instead of re-reading the same entity to fill an
   optional field.

## Forbidden Local Patch Patterns

- Replacing one-off failures with silent empty arrays when cached data exists.
- Using random query noise to force refreshes on read-heavy endpoints.
- Letting one failing upstream source erase already recovered data from another.
- Rebuilding a server-provided aggregate view by issuing the same reads from the
  browser one-by-one.
- Letting a chart or other child visual re-query a parent-hydrated token detail
  endpoint just to recover optional display metadata.

## Related Outcomes

- Trending reads may fall back to stale cache on 429 or short network failures.
- Strategy and copy-trade lists should remain partially visible when one source
  is throttled.
