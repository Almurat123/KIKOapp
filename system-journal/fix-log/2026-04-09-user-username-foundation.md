# Fix Log: User Username Foundation

Updated: 2026-04-09

## Problem

The shared `User` table had no canonical username field. Social identities such
as X and Farcaster each had their own username columns, but the base user record
could not store a stable in-app username for routing, operator visibility, or
future profile flows.

## Root Cause

1. The original `User` model only tracked wallet and social-link identifiers.
2. Username persistence was split into social-specific fields like
   `farcasterUsername` and `xUsername`.
3. New user rows created from authenticated flows had no canonical app-level
   username slot.

## Target Behavior

- `User` must expose a nullable canonical `username` field.
- X and Farcaster sync paths should hydrate that field from authenticated social
  usernames when available.
- The base user schema should carry the field in both Prisma and SQL memory
  layers so future models do not need commit history to rediscover it.

## Files Corrected

- `kiko-api/prisma/schema.prisma`
- `kiko-api/prisma/migrations/20260409193000_add_user_username/migration.sql`
- `kiko-api/src/db/schema.sql`
- `kiko-api/src/routes/users.ts`
