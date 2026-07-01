# plan

Use for polished planning artifacts, implementation guides, operating plans, decision logs, and durable Open Design plan guides.

## job

Turn ambiguous work into a navigable plan Ko can use to understand the work, make decisions, execute in order, and hand off to another agent or human.

The guide should not feel like pasted Markdown. It should feel like a Consuelo operating artifact: structured, calm, technical, editorial, and easy to move through.

## planning surface

This template is for **Open Design plan mode**.

Use it when Ko wants a polished, durable, Tailnet-readable planning guide with reader shell, `/design-wiki` entry, metadata footer, designed hierarchy, and easy navigation.

If Ko only asks to “plan” and does not specify the surface, ask:

> Do you want this as a Canvas living plan or an Open Design plan guide?

Use **Canvas living plan** for fast alignment, copy/paste execution, working checklists, Linear handoff, and active task management inside chat.

Use **Open Design plan guide** for a designed artifact that should be read, revisited, shared, archived, or used as a durable project map.

## render protocol

Plan guides use the canonical Consuelo reader renderer. Run commands from the repository root, not from `packages/consuelo-design`.

Do not hand-author a new page shell. Produce structured content for the plan, then render through:

```bash
bun run wiki:render -- --template plan --input <content.json> --out <index.html>
bun run wiki:validate -- --input <index.html>
```

Use the `plan` renderer template for plans. Do not create a separate roadmap template; roadmap content is plan content.

## typed component guidance

Use the shared reader components for visual variety and repeatability:

- **callout** for objective, why-now, decision, blocker, or caution
- **metrics** for progress, budget, confidence, effort, scope, or review counts
- **cards** for context, assumptions, known facts, owners, files, and handoff notes
- **table** for relevant files, command history, decisions, validation matrices, and acceptance criteria
- **flow** for execution order, system/process sequence, or dependency path
- **timeline** for phases, milestones, rollout, or review cadence
- **details** for investigation notes, logs, unresolved questions, caveats, and raw evidence
- **ranges** for priority, risk, confidence, impact, effort, or readiness scoring
- **comparisons** for options, tradeoffs, rejected paths, or before/after plans
- **ledger** for actionable checklists and completion tracking

Do not use custom HTML unless a typed component cannot express the artifact. If custom HTML is unavoidable, keep the canonical reader shell and validation requirements intact.

## source truth

The source plan is the planning truth.

If converting from a Canvas living plan, preserve the planning discipline. Do not flatten uncertainty away. Do not turn unresolved decisions into fake certainty.

Preserve:

* TLDR
* goal
* current context
* stream/task setup
* commands already run
* exploration findings
* memory / prior context
* repo map
* relevant files
* runtime/deployment observations
* decisions
* phased plan
* validation checklist
* risks / open questions
* acceptance criteria
* handoff notes

If some sections are missing, create the section and mark it as unknown, unresolved, or not yet inspected. Do not silently omit important planning surfaces.

## living plan structure to preserve

Use this as the underlying information architecture when source material allows:

```text
living plan

tldr

goal

current context

stream / task setup
  area:
  stream branch:
  task title:
  task branch / worktree:
  related pr / issue:

commands already run

exploration findings

memory / prior context

repo map

relevant files
  file                    why it matters              status

runtime / deployment observations

decisions
  decision                reason                      owner/date

plan
  phase 1 — understand
  [ ]

  phase 2 — implement
  [ ]

  phase 3 — verify
  [ ]

  phase 4 — publish / handoff
  [ ]

validation checklist
  [ ] review run
  [ ] verify
  [ ] doctor
  [ ] status
  [ ] script audit
  [ ] browser check
  [ ] railway/log check

risks / open questions

plan template
  objective
  [ ]

  what is known
  [ ]

  exact next steps

  files to inspect first
  [ ]

  gotchas
  [ ]

acceptance criteria
  - [ ] concrete pass/fail outcome 1
  - [ ] concrete pass/fail outcome 2
  - [ ] concrete pass/fail outcome 3
  - [ ] UNRESOLVED: specific question blocking final criteria, if any
```

## required structure

1. **Hero**: plan title, objective, status, confidence, owner, date, and one-sentence TLDR.
2. **Plan map**: compact visual route through the guide.
3. **Current context**: what is true right now and why the work exists.
4. **Objective and success**: desired outcome, what “done” means, and how success will be judged.
5. **Scope**: must-have, nice-to-have, and out-of-scope.
6. **Stream / task setup**: area, branch, worktree, PR/issue, and relevant working context.
7. **What we know**: exploration findings, prior memory, repo map, and runtime/deployment observations.
8. **Relevant files**: file/status table with why each file matters.
9. **Decisions**: decision log with rationale, owner/date, and status.
10. **Risks and open questions**: visible unresolved items, blockers, dependencies, and mitigation paths.
11. **Phased plan**: understand, implement, verify, publish/handoff.
12. **Validation plan**: checks required to prove the work is correct.
13. **Acceptance criteria**: concrete pass/fail outcomes.
14. **Handoff notes**: what the next agent/human should know.
15. **Metadata footer**: source truth, generated date, template, Open Design path, and `/design-wiki` link.

## plan map

Near the top, include a compact **Plan map** that acts as the table of contents and operating route.

Use this structure:

```text
Context → Objective → Scope → Decisions → Risks → Phases → Validation → Handoff
```

Each item should link or scroll to its section.

The plan map should help Ko understand where he is in the work, not just list headings. Keep it compact, visual, and useful.

## interaction pattern

Make the plan guide easy to move through.

Use:

* reader shell with GSAP ScrollSmoother
* plan map as the table of contents / operating route
* sticky or fixed section navigation
* progress or reading-position indicator
* collapsible sections for dense detail
* expandable command history
* expandable repo map
* decision cards
* risk / open-question drawer
* validation checklist cards
* phase timeline
* file table with status labels
* acceptance criteria as pass/fail checklist cards
* tap-to-read navigation
* back-to-top affordance
* compact metadata footer
* `/design-wiki` link

Interactions should make the plan easier to inspect and execute. Do not add interactions that only decorate the page.

The page should still be readable if scripts fail.

## visual direction

Make the plan guide feel like a Consuelo operating artifact: precise, structured, technical, calm, and editorial.

Aim for a dark-mode operating console crossed with a polished editorial guide.

Use `packages/consuelo-website/DESIGN.md` as the visual source of truth:

* Geist typography
* compact Geist Mono labels
* restrained monochrome palette
* shadow-as-border cards
* strong whitespace
* precise section hierarchy
* technical labels and status pills
* minimal decorative color

Do not render this as an all-white Markdown document.

Avoid the “boxed Markdown” failure mode: headings stacked vertically, every paragraph placed in the same kind of card, and no real operating rhythm.

Create contrast between content types:

* hero should feel like the project control surface
* plan map should feel like navigation, not decoration
* context should feel factual and grounded
* decisions should feel explicit and auditable
* risks should feel visible, not buried
* phases should feel executable
* validation should feel pass/fail
* acceptance criteria should feel binding
* handoff should feel clear enough for another agent to continue

Prefer a dark or adaptive reader surface when the design system supports it. If dark/adaptive tokens are missing, extend the design system first rather than inventing a one-off theme inside this template.

## layout standard

The top of the guide should include:

1. hero with plan title, objective, status, confidence, owner, and date
2. short TLDR
3. Plan map
4. current context card
5. objective and success card
6. phase timeline preview
7. risk / open-question callout
8. acceptance criteria summary

The body should include:

1. stream / task setup
2. commands already run
3. exploration findings
4. memory / prior context
5. repo map
6. relevant files
7. runtime / deployment observations
8. decisions
9. detailed phased plan
10. validation checklist
11. risks / open questions
12. acceptance criteria
13. handoff notes

Use cards and collapsibles to reduce wall-of-text density. Keep the guide executable: context first, sequence second, proof third.

## component guidance

Use:

* **control-surface hero** for title, objective, status, confidence, owner, and date
* **Plan map** for navigation and learning route
* **context card** for current state
* **scope card** for must-have / nice-to-have / out-of-scope
* **phase timeline** for sequencing
* **decision cards** for rationale and ownership
* **risk drawer** for unresolved issues and mitigation
* **file/status table** for relevant files
* **command history accordion** for commands already run
* **validation cards** for test/proof obligations
* **acceptance checklist** for pass/fail criteria
* **handoff panel** for next-agent continuity
* **metadata footer** for source truth, generated date, template, Open Design path, and design wiki link

Keep unresolved questions visible. A good plan does not hide uncertainty; it manages it.

## pacing rules

Give the plan rhythm.

Use alternating section shapes:

* big hero
* compact operating metadata
* Plan map
* short TLDR panel
* context card
* phase timeline
* collapsible evidence/details
* decision cards
* risk drawer
* validation checklist
* acceptance checklist
* final handoff panel

Do not make every section the same visual weight.

The reader should always know:

* what the work is
* why it matters
* what is known
* what is unresolved
* what happens next
* how success will be verified
* what another agent needs to continue

## acceptance criteria rule

Acceptance criteria must never be blank.

Every Open Design plan must include concrete pass/fail acceptance criteria. If criteria cannot be finalized, include explicit unresolved items:

```text
- [ ] UNRESOLVED: confirm whether <specific blocker> should be handled now or later.
```

Do not publish or hand off a plan guide with empty acceptance criteria.

Acceptance criteria should be specific enough that another agent can tell whether the work is done without guessing.

## validation guidance

Use validation sections heavily.

Include relevant checks such as:

* review run
* verify
* doctor
* status
* script audit
* browser check
* Railway/log check
* unit/integration tests
* screenshot comparison
* design preview check
* durable link check
* `/design-wiki` entry check

Do not include irrelevant checks just to fill space. Mark missing or skipped checks explicitly.

## risk and decision guidance

Risks and open questions should be prominent, not buried.

Each risk should include:

* risk
* likelihood when known
* impact
* mitigation
* fallback
* trigger or decision needed

Each decision should include:

* decision
* reason
* owner/date when known
* status
* reversal condition if useful

## reader shell

Use the shared reader shell.

The artifact should include:

* fixed header with `/design-wiki`
* `#smooth-wrapper`
* `#smooth-content`
* GSAP ScrollSmoother
* tap-to-read navigation
* back-to-top affordance
* metadata footer

Reader shell owns reading behavior. `DESIGN.md` owns visual appearance. This template owns plan structure.

## anti-lifeless rules

The guide fails if it feels like a Markdown checklist poured into a template.

Avoid:

* generic section cards with identical styling
* long uninterrupted paragraphs
* risks hidden at the bottom
* decisions mixed into prose
* no visible acceptance criteria
* validation as an afterthought
* vague “next steps” without owners or proof
* decorative animation with no planning purpose
* handoff notes that do not help the next agent continue

The guide should have operating force:

* name the objective
* show the current state
* expose uncertainty
* make decisions auditable
* sequence the work
* define proof
* preserve handoff context

## quality bar

The guide should:

* feel like a serious operating plan, not a pretty note
* make ambiguous work easier to execute
* preserve unresolved questions
* make decisions inspectable
* make validation concrete
* be useful to Ko and to the next agent
* avoid hype and marketing language
* use design only to improve execution and understanding

Bad plan guide:

* long Markdown converted into cards
* no current context
* no explicit decisions
* no risks or unresolved questions
* vague phases
* blank acceptance criteria
* validation buried or missing
* no handoff value

Good plan guide:

* clear objective
* current state visible
* plan map near the top
* phases are executable
* decisions are auditable
* risks are visible
* validation is pass/fail
* acceptance criteria are concrete
* handoff is useful