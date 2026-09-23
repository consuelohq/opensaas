# RD8 review and acceptance receipt

Date: 2026-09-20. Task: `task/dialer/rd8-close-final-review-contract-gaps`.
Task PR: https://github.com/consuelohq/opensaas/pull/2483
Stream PR: https://github.com/consuelohq/opensaas/pull/2436
Resolve current heads/merge status live; this receipt precedes promotion.

## Reviewed and repaired

- Retained the prior signed edge-client identity, append-only booking cancellation
  migration and nested public error fixes. Added the missing cancellation projection
  into customer status/restart reads, with truthful pending outcomes.
- Composed installation-scoped CRM owner enrichment for live calls and public
  callbacks. Ambiguous/unavailable enrichment cannot bypass eligibility or hold
  admission beyond its bounded deadline.
- Standardized oversized-request errors and used the required shared phone helper,
  including its explicit workspace dependency and CI/release/Docker build closure.
- Fixed rescheduled recipient retention and rejected rescheduling purged recipients
  under the same database transaction. Disabled numbers no longer activate callback
  secrets. Terminal callbacks no longer appear pending.
- Attributed created outbound legs by target position rather than contact ID.
- Distinguished provider-confirmed creation rejection from unknown outcomes.
  Partial outbound failures retain ownership until all known legs are terminal;
  unknown creates remain protected.

Each behavior fix has a failing regression recorded before implementation in the
task workpad, followed by focused green runs. No real carrier calls were initiated.

## Evidence and limits

Final continuation validation passed 263 SDK, 156 LeadConnector and 278 server
tests with service-backed suites enabled, plus Nx builds/typechecks and the
isolated Postgres/Redis lab. Strict review reported zero findings. Canonical verify
and exact promotion state are recorded in the task workpad.

Read-only production checks during review returned Railway `Application not found`
through both the configured public edge and direct Railway origin. Local Railway
CLI authentication is unavailable.
The GitHub deployment environment exists, but its new edge-authentication secret
was absent at inspection. These are deployment readiness gaps, not passing live
acceptance. RD8 must not be labeled released solely from source merge or simulation.

External calendar booking is a tested port, not an activated GoHighLevel calendar
adapter. Customer browser calling and transfer UI remain deferred; operator policy
configuration is read-only. See `packages/dialer-server/INBOUND-TESTING.md` for the
concrete activation inputs and live acceptance ladder. Production changes and real
call evidence must be recorded separately.

## Publication status

Full canonical verification passed with a publish-valid stamp after recovering
missing task metadata. The earlier GitHub workflow-scope blocker was resolved and
verified on 2026-09-21. Publication is proceeding through the existing task and
stream PRs. Resolve their exact heads and status live; neither source publication
nor previous stream CI establishes deployed acceptance.
