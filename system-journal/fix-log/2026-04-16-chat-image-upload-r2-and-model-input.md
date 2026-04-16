# 2026-04-16 Chat Image Upload R2 And Model Input

## What Changed

- Added authenticated chat image upload preparation at `/api/chat/uploads/images/prepare`.
- Added private chat image storage ownership in `kiko-api/src/services/chatImageUploads.ts`.
- Browser-selected chat images are now uploaded with short-lived presigned `PUT`
  URLs instead of going through the chat database.
- Chat send now accepts `imageUploadIds`, validates the prepared uploads, and
  binds them to the created AI task in Redis.
- The chat worker now loads task-bound uploaded images, merges them into the
  current-turn multimodal input envelope, and removes the Redis task binding
  after task completion, cancellation, or failure.
- The backend now persists private R2 object references and sanitized attachment
  metadata in `ChatMessage.data.attachments` after a successful image send.
- Session/message history responses now regenerate short-lived signed preview
  URLs from those private object references and strip the object keys before
  returning data to the frontend.
- Frontend image selection now starts the upload immediately. The composer
  shows upload loading on the thumbnail, keeps send disabled while the image is
  not ready, and sends only prepared upload ids when the user clicks send.
- After the browser `PUT` completes, the frontend calls an authenticated
  finalize endpoint so the backend can HEAD-check, decode, strip metadata,
  resize, normalize, and cache sanitized image metadata before send.
- The welcome composer and live composer now allow image-only sends.
- The frontend blocks image sends on text-only models such as `GLM-5` so the UI
  does not pretend the model saw an image when it did not.
- The frontend now keeps image drafts visible during upload, shows a loading
  overlay on each thumbnail, disables send/remove while upload is in progress,
  and only clears the draft row after upload succeeds and the optimistic send
  state starts.
- The backend now emits explicit upload lifecycle logs for prepare, task
  binding, model-input loading, and cleanup so local and Railway diagnosis can
  follow one image turn end-to-end.
- Added an authenticated discard endpoint for prepared uploads that are removed
  or abandoned before they become task-bound model inputs.
- Fixed the task handoff race found in local logs: image-bearing tasks are now
  created as `pending`, upload binding finishes first, and only then does the
  route flip the task to `queued` for worker claim.
- Fixed conversation hydration so the optimistic local image preview remains as
  a short race fallback until the backend returns durable signed attachments.
- Added click-to-open full-screen image preview for the shared attachment tray,
  covering welcome drafts, live composer drafts, optimistic user messages, and
  refreshed signed history attachments.

## Why

The product needed an end-to-end image path for web chat that preserves the
privacy boundary corrected on 2026-04-16:

- no image bytes in the main database
- no durable public image URLs in chat message rows
- durable private object references for sent chat history
- current-turn delivery into already-wired multimodal model paths

The existing social-agent multimodal path already knew how to pass current-turn
image URLs to GPT, NVIDIA Kimi, and Grok. This change reused that one-turn
runtime envelope instead of inventing a second image transport contract for web
chat.

## Boundaries

- This change does **not** write image binaries into Postgres.
- This change does **not** write signed or public image URLs into `ChatMessage.data`.
- This change **does** make sent uploaded images durable private chat history
  assets by storing object references and sanitized metadata.
- This change does **not** make `GLM-5` vision-capable; image sends are blocked
  when the selected model is not wired for image input.
- This change assumes the R2 bucket is private and CORS-enabled for the web app
  origin.
- This change no longer deletes successfully sent image objects during worker
  cleanup. Unsent prepared uploads and failed pre-release task bindings are still
  deleted.

## Runtime Shape

1. Frontend selects local files and keeps only local object-URL previews.
2. On selection, frontend asks the backend for presigned upload intents and
   disables send while those uploads are in progress.
3. Browser uploads each image directly to R2 with presigned `PUT`.
4. Backend finalizes each upload immediately after browser `PUT`, including
   validation, sanitation, and sanitized metadata caching in Redis.
5. Chat send includes only already-finalized `imageUploadIds`.
6. Backend binds the already-finalized images to the new AI task in Redis.
7. Backend marks the task `queued` only after that Redis binding exists, so the
   worker cannot claim the task before images are attached.
8. The route stores private attachment metadata on the user message.
9. Worker loads the bound images, generates short-lived signed `GET` URLs, and
   merges them into the current-turn multimodal envelope.
10. Worker deletes the Redis task binding after the task finishes or fails; the
   R2 objects remain available for refreshed chat history.
11. History endpoints regenerate signed preview URLs from the private object
    references and never expose the object keys to the browser.

## Runtime Fix Evidence

The 2026-04-16 local test log showed the broken ordering:

- `Chat route: sendMessage received ... imageCount=1`
- `Chat image uploads: bind start`
- `Chat image uploads: load skipped ... reason=no_task_binding`
- `Chat image uploads: bind complete`

This proves the worker claimed and started the task while the request route was
still sanitizing and binding the uploaded image. The model did not receive an
image because `loadTaskChatImageInputs()` ran before the task binding existed.
The corrected owner contract is now:

- `AITask.status='pending'` while request-time image binding is still running.
- `claimQueuedTasks()` only claims `status='queued'`.
- `bindPreparedChatImageUploadsToTask()` must finish before the route calls
  `updateTaskStatus(task.id, 'queued')`.
- Send-message error cleanup only removes task-bound images before the task has
  been released to the worker.

## Upload-Phase UI Contract

- Selecting an image starts upload immediately.
- During that phase, the thumbnail row stays in place and each item shows a
  simple loading indicator through both browser upload and server finalize.
- The send button and remove button stay disabled until the upload phase ends.
- If upload preparation, browser upload, or server finalize fails, the draft
  remains in the composer with an error state and the user must remove/re-add it.
- If upload succeeds, the thumbnail becomes send-ready and the send button is
  enabled.
- If the user removes a ready draft before send, the frontend asks the backend
  to discard that prepared upload.
- If send succeeds, the optimistic user message takes over the preview row and
  the composer clears.
- Any rendered thumbnail can be clicked to open a full-screen preview. The
  preview closes via backdrop click, close button, or Escape.

## Latency Notes From Local Image Test

The 2026-04-16 local successful image test showed:

- Browser/R2 upload preparation started at `15:42:59`.
- `sendMessage` reached the backend at `15:43:02`.
- Task image binding ran from `15:43:05` to `15:43:11`.
- The route queued the task after `routeStageMs=8514`.
- Kimi/NVIDIA's main vision request reported `prompt_tokens=15808`.
- The main model stream's first event arrived after `elapsedMs=41905`.

This means selection-time preupload improves perceived send behavior, but the
vision model call can still be slower than text-only turns because image input
adds large prompt payloads and provider-side image processing.

## Required Environment / Infra

- R2 credentials on `kiko-api`:
  - `CLOUDFLARE_R2_ACCOUNT_ID` or `R2_ACCOUNT_ID`
  - `CLOUDFLARE_R2_BUCKET` or `R2_BUCKET`
  - `CLOUDFLARE_R2_ACCESS_KEY_ID` or `R2_ACCESS_KEY_ID`
  - `CLOUDFLARE_R2_SECRET_ACCESS_KEY` or `R2_SECRET_ACCESS_KEY`
  - optional `CLOUDFLARE_R2_ENDPOINT` or `R2_ENDPOINT`
- Redis available for prepared-upload and task-binding state.
- Bucket CORS allowing the frontend origin to `PUT`.
- Optional bucket lifecycle policy only if product later wants automatic expiry;
  do not enable a short lifecycle on sent chat-history images.

## Document Provenance

- Source: Cloudflare R2 Presigned URLs
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: browser-side presigned `PUT` upload and server-generated signed
    `GET` model reads
  - Verification: verified in docs and code
- Source: Cloudflare R2 Configure CORS
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: bucket CORS requirement for browser uploads to presigned URLs
  - Verification: verified in docs and code
- Source: Cloudflare R2 Object lifecycles
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: optional expiry guidance for unsent or failed uploads, while sent
    chat-history images are retained
  - Verification: verified in docs and code
- Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-kimi-grok-social-image-input.md
  - Kind: repo doc
  - Retrieved: 2026-04-16
  - Applied To: reusing the existing current-turn multimodal image envelope for
    uploaded web-chat images
  - Verification: verified in code
- Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
  - Kind: repo doc
  - Retrieved: 2026-04-16
  - Applied To: keeping uploaded images in runtime-only `socialInput` rather
    than replayed chat history
  - Verification: verified in code
- Source: operator correction from 2026-04-16 refreshed chat-history discussion
  - Kind: product doc
  - Retrieved: 2026-04-16
  - Applied To: durable private image attachments and response-time signed preview hydration
  - Verification: verified in code
- Source: /Users/almurat/KiKo/test.txt
  - Kind: runtime observation
  - Retrieved: 2026-04-16
  - Applied To: delayed worker claim until after chat-image binding, preserving
    optimistic image previews during the backend attachment update race,
    selection-time upload readiness/finalization, and vision-turn latency analysis
  - Verification: verified in runtime log and code
- Source: operator screenshot and full-screen preview correction on 2026-04-17
  - Kind: product doc
  - Retrieved: 2026-04-17
  - Applied To: shared attachment tray click-to-preview behavior across welcome,
    composer, sent message, and refreshed history surfaces
  - Verification: verified in code

## Verification

- Passed after private history attachment persistence correction:
  `cd /Users/almurat/KiKo/kiko-api && npm exec tsc --noEmit --pretty false`
- Passed after private history attachment persistence correction:
  `cd /Users/almurat/KiKo/kiko-web && npx tsc --noEmit --pretty false`
- Passed after the task-claim race and local attachment hydration fix:
  `cd /Users/almurat/KiKo/kiko-api && npm exec tsc --noEmit`
- Passed after the task-claim race and local attachment hydration fix:
  `cd /Users/almurat/KiKo/kiko-web && npx tsc --noEmit`
- Passed after selection-time image preupload and prepared-upload discard:
  `cd /Users/almurat/KiKo/kiko-api && npm exec tsc --noEmit`
- Passed after selection-time image preupload and prepared-upload discard:
  `cd /Users/almurat/KiKo/kiko-web && npx tsc --noEmit`
- Passed after server-side finalize moved into the selection upload phase:
  `cd /Users/almurat/KiKo/kiko-api && npm exec tsc --noEmit`
- Passed after server-side finalize moved into the selection upload phase:
  `cd /Users/almurat/KiKo/kiko-web && npx tsc --noEmit`
- Passed after shared attachment tray full-screen preview:
  `cd /Users/almurat/KiKo/kiko-web && npx tsc --noEmit`
- Checked: `cd /Users/almurat/KiKo/kiko-web && npx eslint src/components/Chat/ChatInterface.tsx src/components/Chat/ChatComposer.tsx src/components/Chat/WelcomeScreen.tsx src/components/Chat/chatConstants.ts src/components/Chat/chatImageDrafts.ts src/services/api.ts`
  - Result: existing lint errors/warnings remain in `ChatInterface.tsx`,
    `WelcomeScreen.tsx`, and `api.ts`; this run did not reveal a new
    image-upload-specific lint regression.
- Not verified yet: refreshed browser history against a real R2-backed image turn.
- Not verified yet: real R2 browser upload against a configured bucket after the
  history persistence correction.
- Not verified yet: live GPT/Kimi/Grok external request with an uploaded image
  after the history persistence correction.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/social-agent-multimodal-input.md
- /Users/almurat/KiKo/system-journal/owner-map/social-agent-multimodal-input.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-local-image-composer-base.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-kimi-grok-social-image-input.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
