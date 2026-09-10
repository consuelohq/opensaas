# verify release local platform bundle

branch: `task/os/verify-release-local-platform-bundle`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2189/verify-release-local-platform-bundle
github pr: https://github.com/consuelohq/opensaas/pull/2189
started: 2026-08-26

## acceptance criteria

- [x] Verify local operator lifecycle status against the exact platform runtime bundle selected from the signed release manifest, not the release-set bundle ID.
- [x] Keep release-set and platform-runtime identities explicit in code/results/tests.
- [x] Preserve exact SemVer/channel/signature/checksum/platform verification and fail closed on a wrong local platform bundle.
- [x] Keep secret handling unchanged; no credential or signing/provider secret is introduced or returned.
- [ ] Prove the completed fix with a real self-release to canary after merge.

## plan

1. Reproduce the false negative with distinct release-set and platform bundle identities.
2. Add an exact OS/architecture platform-bundle selector and make both identities explicit through the release adapter/result.
3. Update promotion correlation to continue keying channel promotion on the release-set ID while local lifecycle verification keys on the platform bundle ID.
4. Run focused release/security tests, critical selected suites, strict review, and full verify.
5. Publish/merge this clean main-target task, wait for its exact runtime publication, then dogfood `release --channel canary` on itself.

## current status

- Code fix is publish-valid. Unit/integration/security coverage, selected critical suites, strict review, and full verify are green. The final acceptance item is the post-merge real canary/self-update dogfood run.

## files changed

- `packages/os/scripts/lib/release-platform-bundle.ts` — exact OS/architecture platform runtime bundle selection with fail-closed identity validation.
- `packages/os/scripts/lib/release-orchestrator.ts` — explicit `releaseSetBundleId` vs `platformBundleId`; promotion uses the former, local lifecycle verification the latter.
- `packages/os/scripts/lib/release-promotion-correlation.ts` — exact promotion correlation remains keyed to release-set identity.
- `packages/os/scripts/release.ts` — parses signed channel platform records and maps lifecycle status to platform-bundle identity.
- `packages/os/tests/release-local-platform-bundle.test.ts`, `release-orchestrator.test.ts`, `release-script-promotion-correlation.test.ts` — regression coverage with intentionally distinct bundle IDs.
- release docs clarify release-set versus installed platform-runtime bundle identity.
- release-focused test-selection source/registry updated for the new helper/test.

## workspace-owned: files changed

- `packages/os/scripts/lib/release-platform-bundle.ts`
- `packages/os/tests/release-local-platform-bundle.test.ts`

## workspace-owned: activity log

- 2026-08-26 03:43:35 fs.write: `.task/os/verify-release-local-platform-bundle/workpad.md`
- 2026-08-26 03:43:52 fs.write: `packages/os/tests/release-local-platform-bundle.test.ts`
- 2026-08-26 03:45:04 fs.write: `packages/os/scripts/lib/release-platform-bundle.ts`

## workspace-owned: validation evidence

- Focused RED: missing platform-bundle selector reproduced the false-negative contract (`trc_cb9097a13511`).
- Focused GREEN: 14 passed, 0 failed, 32 expectations (`trc_ddb2d260d9f8`).
- Critical selected suites: 7/7 passed; no changed code file uncovered (`trc_00f9208ab631`).
- Strict review: 0 blocking issues, 0 documentation opportunities (`trc_b7b2f06e47d1`).
- Full verify: `passed: true`, `publishValid: true`, DB guard clean (`trc_4367987b768e`).
- 2026-08-26 03:46:42 `review.run`: passed — OK
- 2026-08-26 03:46:58 `verify`: passed — OK

## key decisions

- A channel's top-level `payload.bundleId` is the immutable release-set identity; it is correct for promotion and cross-platform release correlation.
- Lifecycle installs one platform-specific archive selected by `process.platform` + `process.arch`, so lifecycle `status.bundleId` is the platform runtime bundle identity. These IDs must never be compared directly.
- Exact version pinning remains the updater guard; updater signature/checksum/platform validation remains authoritative. This change only fixes the final release-orchestrator equality check and makes the two identities explicit.

## notes for ko

- Canary 0.1.73 and this Mac were already updated successfully during the first live dogfood. The command returned failure only because it compared the release-set ID to the installed platform bundle ID. This task fixes that final false negative.
- GitHub login remains valid; no re-login is required.

## improvements noticed

- none yet

## issues and recovery

- Live `release --pr 2188 --channel canary` successfully promoted 0.1.73 and installed it locally, then falsely failed final verification because release-set bundle `sha256:ca98...` differs by design from installed Darwin/arm64 platform bundle `sha256:a232...`. The fix models both identities separately instead of weakening verification.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Acceptance criteria (detailed)

- [x] A successful `release` run verifies the local operator node against the exact platform bundle selected by the signed release manifest, not the release-set bundle ID.
- [x] Release-set identity and platform-runtime identity remain distinct and are named explicitly in code/tests to prevent future accidental equality assumptions.
- [x] The updater continues to require the exact released SemVer and signed target channel; no signature, checksum, platform, or channel verification is weakened.
- [x] A local node on the exact version but the wrong platform bundle fails closed.
- [x] A local node on the exact platform bundle/version returns success in deterministic coverage; live self-release proof remains pending until merge.
- [x] No credential, signing key, provider token, raw environment value, or new secret-bearing payload is introduced.
- [ ] Focused tests, strict review, full verify, and a real self-release dogfood run pass before reporting done.

## Test-first contract

behavior under test: after the exact signed release-set is promoted and `lifecycle.update --channel <channel> --version <version>` succeeds, the release orchestrator must compare lifecycle status to the exact platform bundle for the current OS/architecture, not to the release-set bundle ID.
existing local pattern: signed channel payloads identify the release set and carry platform-specific bundle records; lifecycle stores the installed platform bundle ID after the updater selects and verifies the current platform archive.
new or changed tests: extend release orchestration with distinct release-set/platform bundle fixture IDs; add manifest/platform-selection coverage for `darwin-arm64`/other platform key resolution and a fail-closed mismatch case.
focused red command: `bun test packages/os/tests/release-orchestrator.test.ts packages/os/tests/release-local-platform-bundle.test.ts`
expected red failure: current release result/adapter compares lifecycle `status.bundleId` directly with signed channel `payload.bundleId`, so a correct 0.1.73 install reports a different platform bundle ID and the release falsely fails.
no-test waiver: not applicable.

- 2026-08-26 03:43:35 append: `.task/os/verify-release-local-platform-bundle/workpad.md`

- 2026-08-26 03:43:52 write: `packages/os/tests/release-local-platform-bundle.test.ts`

## workspace-owned: files read

- `packages/os/scripts/lib/lifecycle/release.ts`
- `packages/os/scripts/lib/release-orchestrator.ts`
- `packages/os/scripts/lib/release-promotion-correlation.ts`
- `packages/os/scripts/release.ts`
- `packages/os/tests/release-orchestrator.test.ts`
- `packages/os/tests/release-script-promotion-correlation.test.ts`

- 2026-08-26 03:47:23 apply-patch: `.task/os/verify-release-local-platform-bundle/workpad.md`