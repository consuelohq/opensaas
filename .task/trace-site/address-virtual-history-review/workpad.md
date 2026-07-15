# address virtual history review

branch: `task/trace-site/address-virtual-history-review`
stream: `stream/trace-site`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1413/address-virtual-history-review
github pr: https://github.com/consuelohq/opensaas/pull/1413
started: 2026-07-11

## acceptance criteria

- [x] Clear the rendered inspector and preserve explicit empty selection when mobile Back/deselect is used.
- [x] Serialize trace seed JSON so literal `<` cannot close the enclosing script element.
- [x] Emit real newline-delimited Cloudflare `_headers`, redirect HTML, and JSON feed files.
- [x] Retain a contiguous bounded row window containing the selected trace during append/prepend eviction.
- [x] Scope mutation observers to the trace UI surface and cache parsed child operations without changing behavior.
- [x] Replace implementation-string assertions with behavior-level tests for virtualization, tabs, prefetch, responsive Back, and detail clearing.
- [x] Pass the 13-test focused suite, strict browser TypeScript, Bun browser build, strict workspace review, and full verification.
- [ ] Merge the narrow review fix into `stream/trace-site`, refresh stream PR #1411, and babysit the fresh CodeRabbit run with direct sub-ceiling waits.

## scope exclusions

- No React or frontend framework changes.
- No Hono/Effect/backend transport changes.
- No change to the approved TanStack Virtual Core architecture.
- No private trace data in Cloudflare.

## plan

1. Apply the six-file committed CodeRabbit review delta from the verified predecessor task onto this clean stream-based task.
2. Run the focused 13-test suite, strict browser TypeScript, Bun build, and private-artifact browser proof.
3. Run strict workspace review and full verification.
4. Push and merge PR #1413 into `stream/trace-site` so stream PR #1411 reruns CodeRabbit.
5. Poll CodeRabbit with direct 100-second waits, fix any new actionable findings, and record the wait-tool behavior.

## test-first contract

The predecessor task already produced the red evidence and validated these failures before the fixes were transferred:

- Non-contiguous selected retention windows.
- Ineffective `<` escaping inside seed scripts.
- Literal `\\n` bytes in Cloudflare line files.
- Stale detail DOM and hash-based selection resurrection after Back.

Permanent behavior tests cover those contracts and the virtual-list browser behavior.

## current status

- Clean follow-up task started from `stream/trace-site` after the original task PR had already merged and could not accept another task lifecycle merge.
- The exact six-file CodeRabbit review delta is applied and independently validated on this clean ancestry.
- Formatting, 13 focused tests, strict browser TypeScript, a 90.46 KB Bun bundle, the real private-artifact Back path, strict workspace review, and full publish verification pass.
- PR #1413 is ready to publish and merge into `stream/trace-site`.

## files changed

- `.task/trace-site/address-virtual-history-review/workpad.md`
- `packages/workspace/scripts/trace-site-inspector/browser.ts`
- `packages/workspace/scripts/trace-site-inspector/inspector.css`
- `packages/workspace/scripts/trace-site-inspector/preview.ts`
- `packages/workspace/scripts/trace-site-inspector/trace-list.ts`
- `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`
- `packages/workspace/tests/trace-site-inspector.test.ts`

## workspace-owned: files changed

- `.task/trace-site/address-virtual-history-review/workpad.md`
- `.task/tasks/trace-site/address-virtual-history-review.json`
- `packages/workspace/scripts/trace-site-inspector/browser.ts`
- `packages/workspace/scripts/trace-site-inspector/inspector.css`
- `packages/workspace/scripts/trace-site-inspector/preview.ts`
- `packages/workspace/scripts/trace-site-inspector/trace-list.ts`
- `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`
- `packages/workspace/tests/trace-site-inspector.test.ts`

## workspace-owned: activity log

- 2026-07-11 05:48:52 fs.write: `.task/trace-site/address-virtual-history-review/workpad.md`
- Compared committed stream and review-fix trees; isolated six modified files with 267 insertions and 71 deletions.
- Created clean follow-up task PR #1413 from current `stream/trace-site`.
- Applied the standard Git patch after `fs.apply_patch` correctly rejected the non-workspace patch format.

## workspace-owned: validation evidence

- Predecessor focused suite: 13 passed, `trc_c5520af8875e`.
- Predecessor strict browser TypeScript and 90.46 KB bundle: `trc_d730ed6ea719`.
- Predecessor real private-artifact Back/deselect proof: `trc_4d9245dbaa62`.
- Predecessor live Cloudflare Back/deselect proof: `trc_871c762ab692`.
- Clean follow-up formatting, 13-test suite, strict browser TypeScript, and 90.46 KB Bun bundle: `trc_20f509d5540a`.
- Clean follow-up real private-artifact proof: 250 roots, 32 mounted initial rows, 11 production cells, visible mobile Back, explicit empty selection, no detail DOM, zero inspector children, 33 mounted rows after clear, and zero browser errors: `trc_864caffab8af`.
- Clean follow-up strict workspace review: zero findings, `trc_bb161bf9fe0f`.
- Clean follow-up full verification: publish-valid, zero database risks, `trc_9492952c150e`.
- 2026-07-11 05:50:45 `review.run`: passed — OK
- 2026-07-11 05:50:56 `verify`: passed — OK
- 2026-07-11 05:51:18 `verify`: passed — OK

## key decisions

- Use a fresh task branch because task PR #1409 was already merged and the original task ref had divergent ancestry; this keeps the follow-up PR narrow and reviewable.
- Transfer only the committed six-file tree delta, excluding predecessor task metadata.

## notes for ko

- The direct wait-tool conclusion remains: a single 5-minute wait is unreliable because the connector terminates around two minutes; chained 100-second direct waits are reliable.

## improvements noticed

- The workspace task lifecycle should support a post-merge review-fix continuation or explicitly recommend creating a follow-up task.

## issues and recovery

- Reusing the merged task PR did not update the stream. The review fixes were moved to this clean stream-based follow-up instead of creating a noisy divergent PR.
- `fs.apply_patch` rejected the standard Git diff because it requires `*** Begin Patch` syntax; `git apply --check` plus `git apply` was run through the workspace code facade instead.

---

## publish checklist

```bash
bun run task:push -- --message "fix(trace-site): address virtual history review" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-11 05:48:52 write: `.task/trace-site/address-virtual-history-review/workpad.md`

## workspace-owned: files read

- none yet

- 2026-07-11 05:50:13 apply-patch: `.task/trace-site/address-virtual-history-review/workpad.md`

## workspace-owned: test selection

- changed files: `.task/tasks/trace-site/address-virtual-history-review.json`, `.task/trace-site/address-virtual-history-review/current.json`, `.task/trace-site/address-virtual-history-review/evidence-log.json`, `.task/trace-site/address-virtual-history-review/read-log.json`, `.task/trace-site/address-virtual-history-review/session.json`, `.task/trace-site/address-virtual-history-review/verify.json`, `.task/trace-site/address-virtual-history-review/workpad.md`, `packages/workspace/scripts/trace-site-inspector/browser.ts`, `packages/workspace/scripts/trace-site-inspector/inspector.css`, `packages/workspace/scripts/trace-site-inspector/preview.ts`, `packages/workspace/scripts/trace-site-inspector/trace-list.ts`, `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`, `packages/workspace/tests/trace-site-inspector.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
