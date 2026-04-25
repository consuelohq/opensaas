# address queue autostart review comments

branch: `task/dialer/address-queue-autostart-review-comments`
stream: `stream/dialer`
task pr: https://github.com/consuelohq/opensaas/pull/192
review pr: https://github.com/consuelohq/opensaas/pull/191
started: 2026-04-25

## acceptance criteria

- [x] fetch CodeRabbit reviews for PR #191 with `pr-review`.
- [x] start a fresh task from `stream/dialer`.
- [x] read `AGENTS.md` and `CODING-STANDARDS.md` before editing.
- [x] repair metadata conflict that blocked task scripts.
- [x] verify CodeRabbit findings against current code.
- [x] tighten provider customer-phone failure classification to prefer provider error codes.
- [x] add observability before converting provider customer-phone failures to 400.
- [x] avoid logging full phone numbers in provider error messages.
- [x] add/update focused test coverage.
- [ ] publish with `task:push`, `task:pr`, and `task:finish`.
- [ ] ship review PR #191, wait for deploy, and test production queue walkthrough.
- [ ] bootstrap plan mode for the next agent if the 5-contact skip/retry/exhaust walkthrough still fails.

## plan

1. fix CodeRabbit actionable comment on `parallel.service.ts`.
2. run focused validation and review.
3. publish the review-fix task into `stream/dialer`, which updates PR #191.
4. update PR #191 title/body if CodeRabbit pre-merge checks still object.
5. merge PR #191, wait for railway deploy, and test the queue walkthrough.
6. if the walkthrough fails, create a plan-mode handoff with exact next-agent instructions.

## files changed

- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts`

## key decisions

- provider customer-phone failures now prefer known Twilio customer-number related codes: `21211`, `21215`, and `13227`.
- substring matching is now a fallback only for explicit invalid-phone wording.
- customer-provider rejections emit `logger.warn` and a Sentry breadcrumb before throwing `BadRequestException`.
- provider error messages are phone-redacted before logs and user-safe error details.

## validation

- `yarn prettier --write packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts` passed.
- `bun run review -- --base origin/task/dialer/address-queue-autostart-review-comments --no-tests --json --quiet` reported 0 issues in my changes; remaining issues are pre-existing stream issues.
- `git diff --check` passed after replacing placeholder workpad content.
- focused server jest is blocked locally because `node_modules/@nestjs/common` is missing in the linked dependency tree; this matches the existing server-test blocker documented in prior dialer workpads.

## notes for ko

- the malformed metadata was in `/private/tmp/opensaas-worktrees/stream-workspace-agents-sync-GXiVPA/.task/current.json`, containing conflict markers. i resolved it to the workspace-agents side so dialer task scripts stop crashing while scanning active worktrees.

## improvements noticed

- task scripts should tolerate malformed `.task/current.json` in unrelated worktrees instead of crashing before area filtering.
