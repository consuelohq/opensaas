# Address computer use policy and privacy review

branch: `task/os-computer-use/address-computer-use-policy-and-privacy-review`
stream: `stream/os-computer-use`
pr: https://github.com/consuelohq/opensaas/pull/2815
started: 2026-11-18

## acceptance criteria

- [x] Stop single and batched browser actions that need approval with an APPROVAL_REQUIRED result.
- [x] Preserve literal browser fill text, including --.
- [x] Keep private form data out of traces for invalid nested batch payloads.
- [x] Correct headed/browser guidance and generated git.diff/stream signatures.

## plan

1. Verify the upstream parser and batch JSON contracts, run the regression suite red then green, verify, publish and request reviewer readback.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- Seven new regression examples failed before the fix. Normalized provider data and preserved the policy confirmation id. Scanned both format variants for Trace privacy and refreshed generated tool documentation from current schemas.

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os-computer-use): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: preserve literal fill values and required approvals, omit private content from invalid mixed-field batches, keep generated references consistent, and document repeated browser and headed choices.
existing local pattern: typed provider outcomes, facade trace regression tests, generated tool references and skills.
new or changed tests: computer-use.test.ts and computer-use-trace.test.ts.
focused red command: cd packages/os && bun x vitest run tests/computer-use.test.ts tests/computer-use-trace.test.ts
expected red failure: the exact -- value uses the parser delimiter, user confirmation is reported as success, and invalid batch input/args can expose raw text.
no-test waiver: not applicable.

- 2026-11-18 22:36:40 append: `.task/os-computer-use/address-computer-use-policy-and-privacy-review/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-18 22:36:40 fs.write: `.task/os-computer-use/address-computer-use-policy-and-privacy-review/workpad.md`

## workspace-owned: validation evidence

- 2026-11-18 22:38:38 `review.run`: passed — OK
- 2026-11-18 22:40:36 `review.run`: passed — OK
- 2026-11-18 22:42:50 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/definitely-missing.json`
