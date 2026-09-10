# RD verification and acceptance

This is the common verification contract. Each node adds behavior-specific proof
in its own workpad and receipt. Passing a unit suite is not live-media evidence.

## RD0 documentation gate

Verify relative links, graph IDs/dependencies, receipt ownership and scope.
Confirm task-scoped stream.context resolves this stream's AGENTS.md and RD entry.
Review the diff for unrelated edits. Use the workspace's applicable docs checks.
No runtime test is required for Markdown-only coordination changes.

RD0 is complete only after material DESIGN.md decisions and node contracts are
approved. Coordination documents can integrate while alignment remains open.

## Lab structure from RD2 onward

Use the same SDK, application composition, migrations, durable stores and command
interfaces used by deployment. Switch provider/clock/endpoint adapters explicitly.
Use isolated databases, Redis namespaces, tenant fixtures and credentials; never
point failure injection at customer resources.

Layer proof:
1. Pure domain/policy tests with deterministic time and reproducible seeds.
2. Real Postgres/Redis service tests, including concurrent processes and restarts.
3. Provider simulator scenarios exercising ingress, durable commands and recovery.
4. Browser E2E with actual application APIs and authoritative state.
5. Separately authorized carrier tests with controlled customer and rep endpoints.

Choose existing package/Nx targets and owned test runners after inspecting current
configuration. Bun/Vitest are implementation choices, not interchangeable proof.
A mocked provider or Twilio test credentials do not prove a real media bridge.
The production-compatible application is reusable; fault injection is isolated
and disabled in live deployment. A shared harness does not mean shared data.

## Required distributed scenarios

| Scenario | Required observable result |
| --- | --- |
| Two callers target one rep slot | At most one current capacity owner |
| Browser and phone accept together | One committed winner; losing endpoint cannot bridge |
| Late accept after generation change | Stale acceptance rejected without disturbing current owner |
| Offer expires after carrier command escaped | Unknown outcome retains protected ownership |
| Crash after durable command before send | Recovery executes or reconciles from durable state |
| Timeout after provider accepted command | No blind duplicate bridge; unknown outcome reconciled |
| Duplicate or reordered provider facts | Legal state remains correct; no duplicate commands |
| Missing callback/event | Reconciliation detects discrepancy without assuming delivery |
| Caller hangs up during queue/offer/bridge | No later false connection; resource cleanup converges |
| App restart with waiting callers | Durable queue and surviving carrier legs reconcile |
| Redis loss/stale presence | Postgres authority preserved; availability cannot override occupancy |
| Browser refresh/network loss | Transport loss distinguished from media termination |
| No staffed eligible queue or max wait | Bounded offers and configured fallback |
| Call ends during wrap-up | Capacity returns only under wrap-up policy |
| Callback no-answer/cancel/reschedule | Obligation and capacity converge; attempts stay bounded |
| CRM/calendar unavailable | Explicit safe fallback; no invented booking or customer identity |
| Tenant crossing/spam/duplicate submission | Isolation and configured admission/cost limits hold |
| Transfer/consultation failure | Participant ownership and original caller remain consistent |

For every injected fault, record initial state, ordered observed facts, commands,
crash point, final durable state and cleanup evidence. Do not reduce correctness
to log messages or a provider HTTP 200.

## Scientific proof

Record policy version, candidates/eligibility, relevant queue and rep snapshots,
chosen proposal, reservation result and observed outcome with bounded PII.
Validate decision-time timestamps and prevent post-outcome features from leaking
into training snapshots. Preserve served/abandoned/callback/overflow/provider
failure as distinct exits. State operational estimands separately from latent
patience and document censoring/identification assumptions.

A deterministic baseline needs explicit tie-breaking and fairness/starvation tests.
Offline replay cannot establish a challenger's causal benefit without appropriate
support, identification and an evaluation design.

## Live and release evidence

Before authorized live tests, record isolated test tenant/numbers/endpoints, expected
call count/cost boundary, callback/recording policy and cleanup procedure.
Prove signed public ingress separately from SDK behavior and browser media.
Confirm both participant states; separately verify two-way audio in controlled
tests. Do not label an accepted offer, answered leg, or joined conference as proof
that people heard each other.

For release record source and deployed SHAs, configuration/policy versions, known
limitations, rollback procedure and post-activation checks. Monitor queue age,
abandonment, offer/bridge latency, unknown commands, orphaned legs, capacity leaks,
callback deadlines and provider cost. Define alerts and thresholds from agreed
traffic/service assumptions before activation.
