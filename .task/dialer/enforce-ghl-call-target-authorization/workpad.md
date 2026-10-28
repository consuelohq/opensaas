# enforce GHL call target authorization

branch: `task/dialer/enforce-ghl-call-target-authorization`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/1815
started: 2026-08-10

## acceptance criteria

- [x] Commercial Direct/Single Dial cannot start against an arbitrary client-supplied phone; the server resolves the authenticated installation's GHL contact by contact ID and uses that phone.
- [x] Commercial queue/progressive/predictive starts resolve requested contacts from the authenticated installation's pipeline-stage queue preview and ignore client-supplied phone numbers.
- [x] A contact or queue target that cannot be resolved through the authenticated installation fails closed with stable redacted `CALL_TARGET_NOT_AUTHORIZED` and never invokes provider call creation.
- [x] Existing non-commercial/internal call-session behavior remains unchanged.
- [x] This P1 task excludes same-workspace session read/agent-ready ownership and Twenty compatibility changes; those remain a separate follow-up.
- [x] Focused/full server + LeadConnector contracts, typechecks, strict review, and canonical verify pass.

## Test-first evidence

- Red before implementation: `app.contract.test.ts` = 11 pass / 3 fail. Unauthorized direct target returned 201, client Single Dial phone flowed through unchanged, and queue candidate resolution was never called.
- Green after implementation: `app.contract.test.ts` = 14/14 and `application.contract.test.ts` = 10/10.
- Full package evidence: dialer-server 129/129; LeadConnector 109/109.
- `packages/dialer-server` typecheck: pass.
- `packages/lead-connector` typecheck: pass.

## implementation

- Added `commercial-target-authorization.ts`: commercial direct targets resolve via installation-scoped LeadConnector contact lookup; queue targets resolve via authenticated pipeline/stage queue preview; unresolved/mismatched contacts fail closed.
- `POST /v1/call-sessions` applies target resolution only after commercial entitlement authorization succeeds. Non-commercial call-session behavior remains unchanged.
- Exposed the existing LeadConnector single-contact resource through the server adapter. The server interface keeps this capability optional so unrelated LeadConnector test/legacy dependency stubs remain compatible; commercial target authorization requires it at runtime and fails closed if absent.
- Added provider-boundary coverage proving single-contact lookup uses the workspace installation context.

## validation

- Strict review: 0 owned issues, 0 pre-existing/related issues, 0 blocking issues.
- Canonical verify: `passed:true`, `publishValid:true`, DB risk scan passed, 8 product files in scope.
- Verify head before publish: `806272a0a6a188f187fb23ab8eb2b07faa486eaa`.

## scope / follow-up

- Deliberately not included: same-workspace session read/agent-ready ownership, legacy Twenty compatibility propagation, provider/local number-release consistency, terminal resource-lock fallback cleanup.
- A failed earlier task-start left an orphan unregistered worktree directory plus remote branch `task/dialer/authorize-commercial-targets-from-ghl`; preserved untouched for OS tooling debugging.
- The broader PR #1808 worktree remains preserved and unmerged as source evidence for the P2 ownership follow-up.

## safety

- Code/test only. No live call, number, CRM, Stripe, Railway, Cloudflare, or Marketplace mutation.
- `task.pr` is a merge operation and is invoked only deliberately by the orchestrator after this review/verify evidence.
- Do not call `task.finish`; preserve worktree.

- 2026-08-10 02:46:39 write: `.task/dialer/enforce-ghl-call-target-authorization/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-10 02:46:39 fs.write: `.task/dialer/enforce-ghl-call-target-authorization/workpad.md`
