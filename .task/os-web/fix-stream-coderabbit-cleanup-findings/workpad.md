# fix stream coderabbit cleanup findings

branch: `task/os-web/fix-stream-coderabbit-cleanup-findings`
stream: `stream/os-web`
pr: https://github.com/consuelohq/opensaas/pull/1622
started: 2026-07-24

## goal

Verify and dispose every completed CodeRabbit finding on stream PR #1615 without requesting another review.

## findings

1. `trace-history-redaction.test.ts`: rename test to repository convention and remove unnecessary `async` — valid, fix.
2. `trace-site.ts`: remove unused `NEWER_QUERY` / `RAW_QUERY` and void suppressions — valid, fix.
3. `workspace-cloudflare-edge-router.ts`: make `https://os.consuelohq.com` injectable — verify against approved universal-login authority contract before deciding. Current hypothesis: skip because the single authority is an intentional product invariant and no environment-specific authority contract exists.

## test-first contract

- These are review cleanup changes with no intended runtime behavior change.
- Existing trace redaction, trace renderer, universal-login, workspace-hostname router, and gateway tests are the behavioral contracts.
- No new behavior is introduced. The authority-origin suggestion will be skipped unless existing code already exposes a typed environment override.

## plan

1. Inspect the exact code and neighboring authority-origin patterns.
2. Apply only verified minimal cleanup.
3. Run focused trace/auth/router tests and task verify.
4. Record fixed/skipped dispositions on PR #1615; do not invoke external review.

## dispositions

- Fixed: renamed the redaction test to the repository `should ... when ...` convention and removed the unnecessary synchronous-test `async` modifier.
- Fixed: removed the unused trace query constants and their `void` suppressions; request construction remains unchanged.
- Skipped as proposed scope expansion: a configurable workspace-edge authority origin. The master plan and Worker 14 explicitly define `https://os.consuelohq.com` as the universal authority, and the OAuth metadata in the same router already uses the canonical `OAUTH_AUTHORIZATION_SERVER` constant. Adding a new router input would create an unapproved second authority-selection surface. The duplicate redirect literal was still replaced with that existing constant.

## validation evidence

- Trace redaction, trace renderer, and universal-login suites: 12/12 passed.
- Environment-gated workspace hostname edge-router contract: 4/4 passed.
- OS package typecheck/syntax gate passed.
- Task verify passed static rules, ESLint, typecheck, spec compliance, and DB safety with zero findings.
- No external review requested.

- 2026-07-24 04:59:46 write: `.task/os-web/fix-stream-coderabbit-cleanup-findings/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-24 04:59:46 fs.write: `.task/os-web/fix-stream-coderabbit-cleanup-findings/workpad.md`

- 2026-07-24 05:00:03 apply-patch: `packages/os/tests/trace-history-redaction.test.ts`
- 2026-07-24 05:00:03 apply-patch: `packages/os/scripts/lib/trace-site.ts`
- 2026-07-24 05:00:03 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`

- 2026-07-24 05:00:53 apply-patch: `.task/os-web/fix-stream-coderabbit-cleanup-findings/workpad.md`

## workspace-owned: validation evidence

- Trace redaction, trace renderer, and universal-login suites: 12/12 passed.
- Environment-gated workspace hostname edge-router contract: 4/4 passed.
- OS package typecheck/syntax gate passed.
- No external review requested.
- 2026-07-24 04:59:46 write: `.task/os-web/fix-stream-coderabbit-cleanup-findings/workpad.md`
- 2026-07-24 05:01:18 `verify`: passed — OK
- 2026-07-24 05:01:22 apply-patch: `.task/os-web/fix-stream-coderabbit-cleanup-findings/workpad.md`
- 2026-07-24 05:01:28 `verify`: passed — OK
