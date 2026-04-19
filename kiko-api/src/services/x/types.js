"use strict";
// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Linh Tran
// Reason: X social-agent ingress now needs a richer post context shape than
//         the earlier mention-only event snapshot because the model must be
//         able to reason over parent posts and attached media after webhook
//         intake. The webhook route still stays lean, but downstream owners now
//         need a normalized hydrated tweet contract.
// Goal: keep X ingress event snapshots lightweight while exposing a separate
//       hydrated tweet/thread contract for context and image-aware replies.
// Owns: shared TypeScript contracts for X ingress events and hydrated tweet context.
// Does Not Own: X REST fetching, webhook parsing, or chat prompt assembly.
// Design Language:
// - Keep webhook event snapshots minimal and string-safe.
// - Hydrated tweet/media context belongs in a separate explicit contract.
// - Media URLs should be normalized before entering model-facing owners.
// Document Provenance:
// - Source: X expansions/media docs
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: hydrated tweet context with referenced tweet/media expansions
// - Verification: verified in docs
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-x-mention-feed-confirmation.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
Object.defineProperty(exports, "__esModule", { value: true });
