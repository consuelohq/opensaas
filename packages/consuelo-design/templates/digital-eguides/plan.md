## planning surface

This template is for **Open Design plan mode**.

Use it when Ko wants a polished, durable, Tailnet-readable plan guide with reader shell, `/design-wiki` entry, metadata footer, designed hierarchy, and easy navigation.

If Ko only asks to “plan” and does not specify the surface, ask:

> Do you want this as a Canvas living plan or an Open Design plan guide?

Canvas is for fast alignment, copy/paste execution, and working checklists.
Open Design plan mode is for polished planning artifacts that should be read, revisited, shared, or archived.

## source structure to preserve

If converting from a Canvas living plan, preserve the planning discipline and sections below. Do not flatten uncertainty away. Keep unresolved questions visible.

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

## interaction pattern

Make the plan guide easy to move through.

Use:
- reader shell with GSAP ScrollSmoother
- sticky or fixed table of contents
- collapsible sections for deep detail
- expandable command history
- expandable repo map
- decision cards
- risk / open-question drawer
- validation checklist cards
- phase timeline
- file table with status labels
- acceptance criteria as pass/fail checklist cards
- tap-to-read navigation
- back-to-top affordance
- compact metadata footer
- `/design-wiki` Consuelo Wiki link

Do not make the guide feel like pasted Markdown. Use the living plan as the source structure, then turn it into a navigable planning interface.

## layout standard

The top of the guide should include:

1. hero with plan title, objective, status, confidence, owner, and date
2. short TLDR
3. table of contents
4. current context card
5. phase timeline
6. risks / open questions callout
7. acceptance criteria summary

The body should include:

1. stream / task setup
2. commands already run
3. exploration findings
4. memory / prior context
5. repo map
6. relevant files
7. runtime / deployment observations
8. decisions
9. detailed plan
10. validation checklist
11. risks / open questions
12. acceptance criteria
13. handoff notes

## acceptance criteria rule

Acceptance criteria must never be blank.

Every Open Design plan must include concrete pass/fail acceptance criteria. If criteria cannot be finalized, include explicit unresolved items:

- [ ] UNRESOLVED: confirm whether `<specific blocker>` should be handled now or later.

Do not publish or hand off a plan guide with empty acceptance criteria.

##  potential vocab to use (dont limit yourself though)

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

## visual direction

Make the plan guide feel like a Consuelo operating artifact: precise, structured, technical, calm, and editorial.

Do not render this as an all-white Markdown document. Prefer a dark or adaptive reader surface: closer to an operating console crossed with a polished editorial guide.

Use `packages/consuelo-website/DESIGN.md` as the visual source of truth:

- Geist typography
- compact Geist Mono labels
- restrained monochrome palette
- shadow-as-border cards
- strong whitespace
- precise section hierarchy
- technical labels and status pills
- minimal decorative color

The plan guide should include:

- sticky table of contents
- collapsible sections for dense details
- timeline cards for phases
- decision cards
- risk / open-question drawer
- validation checklist cards
- file/status table
- metadata footer
- reader shell navigation

Do not invent a separate visual language. If dark mode or device-theme matching needs tokens that are not yet in `DESIGN.md`, extend the Consuelo design system tokens first, then apply them here.







