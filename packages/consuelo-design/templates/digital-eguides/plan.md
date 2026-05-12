# plan

Use for execution plans, project plans, implementation plans, rollout plans, and operating plans.

## job

Turn intent into a sequenced operating artifact that shows what will happen, who owns it, what can go wrong, and how progress will be checked.

## basis

A strong plan makes objectives, scope, owners, milestones, dependencies, risks, validation, and reference materials visible in one place. It should break work into manageable phases, expose sequencing and dependencies, and keep decisions as an ongoing section rather than a separate artifact.

## required structure

1. **Hero**: plan title, objective, current status, target date, owner, and confidence level.
2. **Objective and success**: project objective, outcomes, metrics, and what “done” means.
3. **Scope**: must-have, nice-to-have, and out-of-scope.
4. **Roles**: driver, approver, contributors, stakeholders, and review cadence.
5. **Phases / milestones**: ordered phases with deadlines, owners, dependencies, and proof of completion.
6. **Workstreams**: parallel tracks when helpful; keep sequencing explicit.
7. **Decision log**: ongoing decisions, rationale, owner, status, and review date.
8. **Risks and dependencies**: risk, likelihood, impact, mitigation, fallback, and trigger.
9. **Validation plan**: how each phase is verified, including tests, browser checks, deploy checks, or user review.
10. **Operating updates**: status, blockers, changes since last update, next checkpoint.
11. **Reference shelf**: links, docs, files, tickets, and prior decisions.

## html interaction pattern

Use HTML to make execution state visible. Prefer a two-page or multi-panel surface with smooth-scroll navigation, milestone timelines, dependency maps, collapsible phase detail, risk tables, decision-log cards, and status/update panels. Use lightweight click interactions for drill-down. The page should still be readable as static HTML if scripts fail.

## visual pattern

- Status strip with objective, owner, confidence, and target date.
- Scope as three cards: must / nice / out.
- Milestones as a timeline or stacked phase cards.
- Decision log as a living table/card stack.
- Risks and validation as paired cards.

## quality bar

- The plan should make execution calmer.
- It should show order, ownership, and proof, not just a list of tasks.
- It should make decisions visible over time.
- It should be easy to update after each checkpoint.
