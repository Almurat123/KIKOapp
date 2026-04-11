# Fix Log: 2026-04-11 X Reply Share Pages

## What changed

X mention replies no longer post full AI-generated answer text directly on X.

The new flow is:

1. inbound mention still creates or reuses an X conversation mapping
2. the agent still runs against the user's KIKO chat session
3. the completed assistant output is summarized into a preview-safe excerpt
4. KIKO persists an opaque public share token
5. the X reply contains only a short KIKO link
6. the link resolves to a server-rendered public share page with X/OG card metadata

## Why

This shift was made for three reasons:

1. product policy:
   - the public X reply should be a short pointer into KIKO, not a full in-thread AI answer
2. crawler reality:
   - X card crawlers cannot use the user's login/session context
   - a React client-side route cannot be trusted to populate meta tags in time
3. security boundary:
   - private chat session access must stay behind KIKO auth
   - only a preview-safe summary may be exposed to public crawlers

## Document provenance

### Source 1
- Source: X Cards Getting Started
- Kind: official API doc
- Retrieved: 2026-04-11
- Applied to:
  - requirement that card metadata must be present in server HTML for crawler fetches
- Verification: partially verified

### Source 2
- Source: X Cards Markup
- Kind: official API doc
- Retrieved: 2026-04-11
- Applied to:
  - use of `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
- Verification: partially verified

### Source 3
- Source: Open Graph protocol
- Kind: official API doc
- Retrieved: 2026-04-11
- Applied to:
  - fallback `og:title`, `og:description`, `og:image`, `og:url`
- Verification: partially verified

### Source 4
- Source: local runtime architecture review of `kiko-web` and `kiko-api`
- Kind: runtime/code observation
- Retrieved: 2026-04-11
- Applied to:
  - decision to implement public share pages in `kiko-api`, not `kiko-web`
- Verification: verified in code

## Owner map

### `src/services/x/xReplyShareService.ts`
Owns:
- opaque token generation
- preview-safe excerpt shaping
- public share URL generation
- open-app link generation

Does not own:
- HTML card rendering
- webhook parsing
- model execution

### `src/routes/xShare.ts`
Owns:
- public HTML page for X crawler and user clickthrough
- dynamic OG image bytes
- no-auth public card endpoint behavior

Does not own:
- token issuance
- private chat authorization
- X reply policy

### `src/services/x/xIngressWorker.ts`
Owns:
- mention business flow
- session creation/reuse
- agent invocation
- switching the final public reply from direct AI text to KIKO share link

Does not own:
- card rendering
- public token persistence internals

## Design rules

- Never place private chat credentials or raw session secrets in the public URL.
- Public share pages may reveal only preview-safe summary text.
- Full conversation continues in KIKO web app.
- The public share page and the private chat page are separate URLs with separate trust boundaries.
- X replies must remain short and deterministic.

## Runtime verification status

Verified in code:
- share owner added to API layer
- mention flow changed to emit share link replies
- public share route is intentionally excluded from app-key/origin enforcement

Not yet verified in runtime:
- X crawler rendering against the new share page
- preview image appearance inside live X cards
- card cache behavior on production URLs
