# Finalize homepage release review fixes

branch: `task/website/finalize-homepage-release-review-fixes`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2617

## acceptance criteria

- [x] Replace the inherited cloud mask literal with a semantic token without changing rendering.
- [x] Replace the inherited task scaffold with a factual handoff for the changes actually present.
- [ ] Validate, promote and complete the approved website release.

## plan

1. Apply the two outstanding review corrections from #2614.
2. Run website build and strict review/verify.
3. Promote into the stream and ship the approved main website.

## Test-first contract

behavior under test: CSS masks retain exactly the same alpha behavior while complying with website token policy; the handoff records inherited changes without inventing validation.
existing local pattern: website-owned tokens and task-local Markdown workpads.
new or changed tests: Reuse website build/typecheck; no new implementation-mirroring tests.
focused red command: Source inspection shows #000 in CloudField and scaffold acceptance in the inherited workpad.
expected red failure: Existing token policy violation and incomplete durable handoff.
no-test waiver: This is a constant-for-constant CSS token extraction plus documentation correction; build/typecheck and final live responsive checks prove the applicable behavior.

## files changed

- none yet

## key decisions

Keep all approved page copy, layout and artwork behavior. Record only evidenced history for sibling work.

## notes for ko

Ko authorized merging and Cloudflare production deployment of the approved homepage.

## improvements noticed

Final production checks should inspect both markup and the actual social PNG.

## errors i ran into

The first stream.context call omitted required area; corrected input uses area website.

- 2026-09-29 21:07:15 write: `.task/website/finalize-homepage-release-review-fixes/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-29 21:07:15 fs.write: `.task/website/finalize-homepage-release-review-fixes/workpad.md`

## workspace-owned: validation evidence

- 2026-09-29 21:08:15 `review.run`: passed — OK
- 2026-09-29 21:08:16 `verify`: passed — OK
- 2026-09-29 21:08:33 `verify`: passed — OK

## validation evidence

Website build passed (24 routes, 0 errors, 0 warnings, 23 inherited hints). Strict review passed with zero changed issues or blockers; the root Nx typecheck-target finding remains inherited. Full verification is running before push.
