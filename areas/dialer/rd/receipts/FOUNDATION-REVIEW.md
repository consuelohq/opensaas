# Foundation/RD1 follow-up receipt

Observed 2026-09-10 15:44 UTC; validated work awaits promotion in
https://github.com/consuelohq/opensaas/pull/2451.
Task tsk_328af0cac93f, branch task/dialer/finish-foundation-migration-rollback-review,
base 990f194015d12ccb34395830aafbb340d64657c4, target stream/dialer.

Late review 3975130655 on stream PR #2436 identified missing rollback handlers
for newly integrated migrations 002–004. Added guarded, atomic down paths and
made down mandatory for migrations after the pre-existing baseline 001.
Existing committed up SQL remains unchanged. The baseline is deliberately not
uninstalled by this feature rollback API.

The isolated real-Postgres proof refuses out-of-order rollback, removes 006,
005, 004, 003 and 002 in order, verifies original learning rows survive through
003, verifies 002 removes its table, and reapplies the full migration chain.
Existing baseline CRM outcomes survive. An outer test transaction restores
the entire isolated fixture afterward. These destructive down paths were never
executed against deployed/customer data.

A Node smoke import also exposed missing .js extensions in RD1's compiled
relative imports. Corrected the SDK specifiers and added a Node runtime smoke
test to the SDK build command, so TypeScript/Bun resolution cannot conceal
the packaged-module defect in future builds.

Validation:
- RED lab: missing rollback-chain proof; GREEN: 1 pass, 30 outer expectations.
- RED Node import: ERR_MODULE_NOT_FOUND for compiled inbound/contracts;
  GREEN: compiled Node test passes in the SDK build.
- Full package suites: 406 pass, 1 opt-in lab skip, 0 fail, 1433 expectations.
- Both Nx package builds and their two dependency builds passed.
- Both typechecks and full canonical verification are required before promotion;
  resolve final task evidence and coordinator handoff for their final result.
- No live providers, production migration, deployment or main promotion.

This corrects #2446/#2448, not the independently owned OS/workspace cleanup.
Resolve the merged task SHA and late reviews live. RD2/RD3 readiness requires
this correction on the same stream as RD1. Preserve dirty lifecycle metadata
using normal task.finish; no force cleanup.

## Late algorithm review corrections

Comments3975271110/3975271114 also reproduced in the integrated foundation.
The current-time ranking fallback now uses the store's aggregate attempt estimate,
not the best historical hour/day bin. Missing aggregate evidence retains the
missing-evidence/FIFO boundary. Shadow evaluation counts expanded training periods
and reports insufficient_training_periods if the chronological training partition
contains no usable periods; legitimate early censoring no longer causes fit to throw.
Three focused regressions failed before the fixes and passed afterward.

The final lab-helper generic correction is applied; both typechecks and isolated
lab pass. Prior deployment/live limits and safe-preservation requirements remain.
