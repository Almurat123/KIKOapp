# Fix Log: 2026-04-13 X Share Public Rate Limit Bypass

## What Changed

- Exempted the public X reply share HTML route from the global rate limiter:
  - `/x/share/:token`

## Why

Production logs showed successful X mention replies were posting share links,
but opening the share URL could return:

- `429 RATE_LIMIT_EXCEEDED`
- `You have exceeded the request limit. Please try again later.`

The limiter log proved the blocked route was:

- `GET /x/share/HxxWfL3bh-OS2HsMrSCVD6R6`

That route is a public crawler-facing share page. It is not interactive chat
traffic, and it can be fetched by:

- X card crawlers
- X link unfurlers
- real users clicking the tweet reply

Treating it as default interactive traffic breaks the core share-open path.

## Product Rule

- Public share HTML pages used for X card unfurls must bypass the default global
  API limiter.
- OG image routes and public share HTML routes belong to the same delivery
  surface and should not be throttled like chat/API endpoints.

## Document Provenance

- Source: production log `logs.1776060669760.json`
- Kind: runtime observation
- Retrieved: 2026-04-13
- Applied To: exempting `/x/share/:token` from the global limiter
- Verification: verified in runtime
