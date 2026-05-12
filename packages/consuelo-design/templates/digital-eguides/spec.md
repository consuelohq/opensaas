# spec

Use for product specs, engineering specs, RFCs, design docs, architecture proposals, and rich one-off HTML specs.

## job

Turn a proposed change into an artifact that aligns product, engineering, and design before implementation.

## basis

A strong spec explains the problem and scope, names goals and non-goals, records decisions and tradeoffs, describes the proposed design, surfaces constraints and risks, and gives reviewers enough context to catch expensive mistakes early. Decisions belong inside the spec rather than in a separate template.

## required structure

1. **Hero**: title, status, owner, reviewers, date, and one-line decision summary.
2. **Problem / context**: what triggered this, why now, and what existing system/user reality matters.
3. **Goals and non-goals**: crisp bullets that prevent scope creep.
4. **Requirements**: functional requirements, non-functional requirements, constraints, and success metrics.
5. **Proposed design**: components, interfaces, data flow, user/system flow, and diagrams or pseudo-diagrams when useful.
6. **Decisions**: decision log with decision, rationale, alternatives, and consequences.
7. **Alternatives considered**: why rejected, what would make each viable later.
8. **Risks / edge cases / rollback**: failure modes, mitigation, observability, migration, rollout, and recovery.
9. **Testing / validation**: unit, integration, browser, API, migration, runtime, and acceptance checks.
10. **Open questions**: unresolved questions with owners or next evidence needed.
11. **Implementation sketch**: phases or file-level plan only when it clarifies the spec.

## html interaction pattern

Use HTML to make the spec spatial and reviewable. Prefer a two-page or multi-panel surface with smooth-scroll navigation, side-by-side alternatives, clickable decision cards, expandable risks, diagrams or flow maps, and inline code/interface snippets. Use motion only to clarify hierarchy or transitions, not as decoration. The page should still be readable as static HTML if scripts fail.

## visual pattern

- Executive summary band at top.
- Goals/non-goals as side-by-side cards.
- Proposed design as the central section with clear hierarchy.
- Decisions embedded as durable cards.
- Risks and validation as high-signal checklists.
- Open questions as a visible unresolved-state panel.

## quality bar

- The spec should make future implementation easier and safer.
- It should document tradeoffs, not merely describe the chosen path.
- It should be readable by a busy reviewer in layers: summary first, evidence/details second.
- Do not turn it into a task list unless implementation detail is the point.
