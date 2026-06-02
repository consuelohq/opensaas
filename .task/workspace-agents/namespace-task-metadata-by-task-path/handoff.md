# Handoff: dialer queue starts but no outbound calls

Branch: `task/dialer/diagnose-call-queue-not-dialing`
Stream: `stream/dialer`
PR: https://github.com/consuelohq/opensaas/pull/248
Mode: investigation only. No product code changes yet.

## Symptom

From Home, Start Dialer sets up an active queue view but no customer call is placed. A sound can play, but the call never dials. First press can appear to do nothing. Skip used to sometimes cause dialing, but no longer does.

## Sentry and log evidence

Ko screenshot showed high signal Sentry events: `GET /v1/voice/status` with missing relation `workspace_phone_numbers`, warning `voice.buildWorkspaceNumberPool.raw_fallback`, cache provider `flatWebhookMaps` not found, SSE duplicate event stream, and `Unknown type CompanyOrderByInput`. A Railway log check immediately after task start did not reproduce those errors in the visible window; it only showed successful `/v1/voice/status` traffic. Treat screenshot as the production error trail and Railway as not yet reproducing the failure.

## Current best hypothesis

The likely blocker is before Twilio call creation. The frontend queue runner is gated by `/v1/voice/status` reporting `configured: true`. If that status endpoint returns `configured: false` or an error because phone number state cannot be resolved, Start Dialer can mark the opportunity list active and navigate, but no backend queue session starts, no queue item becomes `calling`, and `startParallelBatch()` is never invoked.

Secondary hypothesis: if `startParallelBatch()` has already returned blocked or failed, `useOpportunityQueueWorkspace.ts` leaves `autoStartedItemIdRef` set for that item, preventing another autostart attempt until the current item changes. That may explain why Skip now feels stuck if backend sync does not move to a different item.

## Confirmed code path

1. `DialerHomePrep.tsx`: Start Dialer calls `handleLaunch()`. `handleLaunch()` calls `startQueue(selectedListId)` and navigates to the opportunity record page.
2. `useQueueOperations.ts`: `startQueue()` only updates the opportunity record with `listStatus: ACTIVE`, `sessionStartedAt`, and `currentIndex: 0`. It does not call Twilio or backend queue endpoints.
3. `useOpportunityQueueWorkspace.ts`: defines `queueSessionReady = twilioConfigStatus !== null && twilioConfigStatus.configured`. The effect that calls `startBackendQueueSession()` exits early unless this is true. Another effect invokes `startParallelBatch()` only when `currentQueueItem.status === calling`.
4. `useTwilioConfigStatus.ts`: calls `/v1/voice/status`. On non-OK or exception it sets `configured: false`.
5. `voice.controller.ts`: production native Nest route `GET /v1/voice/status` calls `VoiceService.getVoiceStatus(workspaceId)`.
6. `voice.service.ts`: `getVoiceStatus()` returns `configured: hasPhoneNumbers && twimlAppConfigured`; `hasPhoneNumbers` comes from `getPhoneNumbers(workspaceId)`.
7. `queues.service.ts`: `startQueue()` marks a backend queue active and claims one queue item by setting it to `calling`. `skipCurrentItem()` selects the next item only if the backend queue exists and can be synced.
8. `useParallelDialer.ts`: `startParallelBatch()` POSTs to `/api/v1/calls/parallel` and only plays the dialing sound after a successful response with `groupId` and `calls`.
9. `parallel.controller.ts` and `parallel.service.ts`: production endpoint `POST /api/v1/calls/parallel`; service resolves strategy, lists Twilio numbers, resolves caller IDs, acquires caller-id locks, builds callback URLs, then calls `dialer.parallel.initiateGroup(...)`.

## Implementation agent first checks

1. In the logged-in workspace, capture the exact `/v1/voice/status` JSON: `configured`, `hasPhoneNumbers`, `twimlAppConfigured`, and `error`.
2. Press Start Dialer with Network open and verify where the chain stops: opportunity update, `/v1/voice/status`, `/api/v1/queues?sourceType=list&sourceId=...`, queue create, `/api/v1/queues/:id/start`, `/api/v1/calls/parallel`.
3. If it stops before `/api/v1/queues/:id/start`, fix the `/v1/voice/status` gate or queue-session effect.
4. If queue start runs but no item becomes `calling`, inspect `QueuesService.selectNextCallableItem()` and suppression output.
5. If `/api/v1/calls/parallel` runs, inspect response and map to `ParallelService` stage: list-numbers, caller-id-resolution, caller-id-lock-acquisition, callback-url-construction, initiate-group.
6. During reproduction, search Sentry/logs for `fetchTwilioConfigStatus`, `startBackendQueueSession`, `startParallelBatch`, `nest_parallel_dial`, `parallel dial blocked by caller id lock`, and `buildTwimlResponse.addCustomer`.

## Likely fix areas

Primary: make native `GET /v1/voice/status` resilient and truthful. If the missing `workspace_phone_numbers` relation is still emitted, either the mounted status path still depends on legacy phone-number storage or production has an unapplied migration. Confirm before editing.

Secondary: provide a safe retry path when `startParallelBatch()` returns blocked or failed so the auto-start guard does not permanently suppress the current item without user-visible recovery.

## Validation plan

Add or extend frontend hook tests for the config gate and blocked/failed autostart behavior. Add or extend backend tests for `VoiceService.getVoiceStatus()` when phone-number state fails. Runtime verification must show this chain: Start Dialer -> queue start -> `POST /api/v1/calls/parallel` -> response with `groupId` and `calls` -> dialing sound -> visible active calls. Sentry should show no new `workspace_phone_numbers` status errors, no `nest_parallel_dial` failure, and no caller-id lock loop.

## Commands already run

- `workspace stream.context` for `dialer`
- `workspace task.start` from `stream/dialer`
- `workspace explore` for queue start not creating Twilio calls
- `workspace railway.logs` for current opensaas errors and dialer/status filters
- `workspace fs.read` for the frontend home/start path, queue workspace hook, Twilio status hook, native voice controller/service, backend queues service, parallel frontend hook, parallel controller/service

## Open uncertainty

The live click has not yet been reproduced with browser Network open, so the exact stopping point is not proven. The strongest evidence points to the config/status gate or a blocked/failed parallel-start guard. Verify the live request chain before editing.