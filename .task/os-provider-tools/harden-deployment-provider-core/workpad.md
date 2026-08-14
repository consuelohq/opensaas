# Harden deployment provider core

branch: `task/os-provider-tools/harden-deployment-provider-core`
stream: `stream/os-provider-tools`
pr: https://github.com/consuelohq/opensaas/pull/1585
started: 2026-07-23

## acceptance criteria

- [x] Verify and fix all still-valid high-signal review findings against the current provider core.
- [x] Keep parser and normalization failures inside the typed, redacted `ProviderError` model.
- [x] Carry environment values over stdin without placing secrets in argv or serialized errors.
- [x] Bound provider stdout and stderr by bytes and expose truncation metadata.
- [x] Preserve existing provider capability, approval, redaction, timeout, cancellation, and runtime bundle contracts.

## plan

1. Add failing behavioral tests for normalization defects, stdin secret transport, and bounded output.
2. Implement the smallest provider-neutral transport and error-model changes.
3. Run focused provider tests, distribution tests, syntax checks, and workspace verification.
4. Push the repair to PR #1585 and post finding dispositions on GitHub.

## current status

- Implementation and focused validation complete.
- Red run: 20 passing, 5 failing before the fix.
- Green run: 26 provider tests and 16 runtime bundle tests passing.
- Awaiting workspace verify and task push.

## files changed

- `packages/os/tools/deployment-provider/errors.ts`
- `packages/os/tools/deployment-provider/handler.test.ts`
- `packages/os/tools/deployment-provider/process.ts`
- `packages/os/tools/deployment-provider/service.ts`
- `packages/os/tools/deployment-provider/testing.ts`
- `packages/os/tools/deployment-provider/types.ts`

## validation evidence

- `bun test packages/os/tools/deployment-provider`: 26 passed.
- `bun test packages/os/tests/distribution/runtime-bundle.test.ts`: 16 passed.
- `bun run --cwd packages/os typecheck`: passed syntax checks.
- `git diff --check`: passed.

## key decisions

- The provider-neutral command contract owns optional stdin; provider adapters can select their CLI-specific stdin flags without exposing values in argv.
- Process output retains only the final configured byte window, because the tail contains the most useful provider failure context.
- Truncation flags are emitted only when true in public raw results and diagnostics, preserving existing response equality for untruncated commands.
- Parser and normalization are one guarded boundary so malformed provider data never becomes an Effect defect.

## notes for Ko

- This strengthens the shared foundation consumed by the Railway, Vercel, and Cloudflare provider workers.
- It does not register new public tools or authenticate any external provider.

## issues and recovery

- The task initially started from `main`; the provider stream was merged into the task before editing.
- `stream:sync` exposed a separate stale `--no-review` verify flag. That environment script needs a narrow follow-up before later stream orchestration.

---

## publish checklist

- [ ] workspace verify passes
- [ ] task changes pushed
- [ ] GitHub dispositions posted

## workspace-owned: validation evidence

- `bun test packages/os/tools/deployment-provider`: 26 passed.
- `bun test packages/os/tests/distribution/runtime-bundle.test.ts`: 16 passed.
- `bun run --cwd packages/os typecheck`: passed syntax checks.
- `git diff --check`: passed.
- 2026-07-23 04:56:06 `verify`: passed — OK
