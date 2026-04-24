# 2026-04-24 RAG Service Removal

## Problem

KIKO no longer uses the local RAG service, but the repository still carried a
disabled RAG path:

- `RAG_SERVICE_URL` in local compose wiring.
- A Node `ragClient` that could silently fall back to localhost.
- A Python `/rag` mount guarded by `ENABLE_RAG_SERVICE`.
- Optional Grok-side RAG context injection.
- RAG-only Python dependencies.

Keeping the disabled path made environment cleanup ambiguous and created a
future risk that an old context path could be re-enabled accidentally.

## Fix

Removed the RAG runtime boundary instead of only disabling it:

- Deleted the Node RAG client.
- Deleted the Python `kiko-python/rag` service package.
- Removed the `/rag` mount and `ENABLE_RAG_SERVICE` gate from the unified Python
  app.
- Removed Grok-side RAG knowledge-base injection.
- Removed `rag-service`, `RAG_SERVICE_URL`, and API dependency wiring from
  `docker-compose.yml`.
- Removed RAG-only Python dependencies from `kiko-python/requirements.txt`.
- Removed local startup script output for `/rag`.

## Deployment Boundary

`RAG_SERVICE_URL` and `ENABLE_RAG_SERVICE` are no longer runtime configuration
for KIKO. They should not be set in Railway or local env files.

Wallet context, social-agent context, image generation, moderation, Grok, and
chat orchestration do not depend on this removed RAG path.

## Verification

- Exact code scan found no remaining RAG runtime references.
- `kiko-api`: `npx tsc --noEmit --pretty false`
- `kiko-python`: `python3 -m py_compile main.py grok/router.py`
