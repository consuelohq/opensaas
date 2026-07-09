spec

Use for product specs, engineering specs, RFCs, architecture proposals, system designs, launch readiness specs, and high-stakes feature/product definition artifacts.


render protocol

Do not hand-author a new page shell for wiki artifacts.

Run the commands from the repository root. The root package forwards to `packages/consuelo-design`, so agents should not `cd` or infer a package-local invocation.

1. Read this template as the content/thinking contract.
2. Produce structured content for this template.
3. Render through the canonical Consuelo reader shell with one shared command:

```bash
bun run wiki:render -- --template spec --input <content.json> --out <index.html>
```

4. Validate the output before publishing:

```bash
bun run wiki:validate -- --input <index.html>
```

The Markdown template owns the section logic. The TypeScript renderer owns the repeatable UI/UX: top pill nav, section rail, resume reading, ScrollSmoother, back-to-top, favicon/theme-color, neutral dark mode, mobile responsiveness, cards, footer, and /design-wiki link.

For roadmap or operating-plan artifacts, use `template: plan`. Do not create a separate roadmap template.

optional typed section components

When producing the structured content JSON, do not hand-write HTML for variety. Use optional typed section components. A section may include any mix of:

- `body: string[]` for normal paragraphs.
- `cards: { title, body, tag? }[]` for simple card grids.
- `callout: { label?, title, body? }` for a large editorial emphasis block.
- `metrics: { label, value, body? }[]` for scoreboard/stat cards.
- `flow: { title, body?, tag? }[]` for process or system diagrams.
- `table: { columns: string[], rows: string[][] | Record<string,string>[] }` for requirements, validation matrices, and comparison tables. The renderer adds mobile `data-label` cells so tables collapse instead of clipping on iPhone.
- `timeline: { title, body?, tag?, items? }[]` for phases, rollout, and sequence sections.
- `details: { summary, body, open? }[]` for dropdown/accordion decisions, risks, and explanations.
- `ranges: { label, value, max?, note? }[]` for progress, confidence, readiness, or scoring bars.
- `comparisons: { title, body, tag? }[]` for side-by-side alternatives.

Prefer typed components over custom HTML. If a section needs a visual pattern not listed here, add it to the renderer as a typed component first so the shell stays deterministic.

job

Turn ambiguous product or engineering work into a durable specification that helps Ko and the team decide what to build, why it matters, how it should work, how it will be validated, and what must be true before it can ship.
The spec should not feel like a generic RFC or pasted Markdown. It should feel like a Consuelo decision artifact: precise, technical, editorial, opinionated, reviewable, and executable.
A good spec does five jobs at once:

1. Aligns product, design, engineering, and operations.
2. Records the decision and the tradeoffs.
3. Defines the system or product behavior clearly enough to implement.
4. Makes risk, uncertainty, and non-goals visible.
5. Ends with a ship checklist detailed enough to launch from

source truth

The source material is the truth Do not lose it.
Preserve:

* Linear project / issue links
* GitHub PR links
* repo branches and current implementation state
* product goals
* user/customer context
* business thesis
* technical constraints
* prior decisions
* open questions
* acceptance criteria
* validation requirements
* launch blockers
* citations or source links
* exact terminology Ko provides
* plans from chat

Do not invent product claims, implementation status, or shipped behavior. If something is unknown, mark it as unknown. If something is aspirational, mark it as planned. If a PR exists, inspect it or clearly mark that it has not been inspected.

The spec should distinguish:

* Source truth: what the source docs/issues/PRs say. with embeded links when refrenced
* Interpretation: what the spec concludes.
* Decision: what we are choosing.
* Open question: what remains unresolved.
* Ship requirement: what must be checked before launch.

basis

A strong spec is both a PRD and an engineering design document.
It answers:

* What problem are we solving?
* Who is it for?
* Why now?
* What are we building?
* What are we explicitly not building?
* What must be true for this to work?
* What decisions have already been made?
* What alternatives were rejected?
* What can fail?
* How will we validate it?
* What blocks shipping?
* What checklist proves the product is actually done?

A spec should prevent expensive mistakes before implementation, but it should not freeze the team into fake certainty. It should preserve uncertainty while making progress possible.

narrative spine

Do not design the spec as a decorated outline.
Shape it like a decision journey:

1. Thesis — the one-sentence claim the spec is making.
2. Context — why this work exists now.
3. Current state — what is true today: PR, branch, system, constraints, blockers.
4. User / job — who needs this and what job they need done.
5. Decision — what we are choosing to build.
6. System model — how the pieces fit together.
7. Requirements — what the product/system must do.
8. Tradeoffs — why this path beats the alternatives.
9. Risks — what can break, block, or invalidate the plan.
10. Validation — how we prove it works.
11. Rollout — how it reaches users safely.
12. Ship checklist — the completion ledger.

The reader should feel the spec moving from ambiguity → decision → implementation shape → proof → launch.

required structure

1. Hero
    * title
    * status
    * owner
    * reviewers
    * date
    * source truth
    * one-sentence thesis
    * current checkpoint when known: PR, branch, issue, milestone, or implementation state
2. Executive summary
    * TLDR
    * decision summary
    * why this matters
    * what changes for the user/customer/team
    * what is blocked or unresolved
3. Problem / context
    * what triggered this
    * why now
    * current user/system reality
    * business or product motivation
    * relevant source links
    * what has already been tried or built
4. Users, jobs, and use cases
    * target users / roles
    * jobs-to-be-done
    * primary use cases
    * secondary use cases
    * excluded users or use cases when relevant
5. Goals and non-goals
    * goals as concrete outcomes
    * non-goals to prevent scope creep
    * nice-to-have / later items
    * explicit “we are not doing this now” list
6. Current state / implementation checkpoint
    * current branch, PR, issue, milestone, or artifact
    * what already exists
    * what is partially done
    * known blockers
    * failing checks
    * open review comments
    * what should be treated as source-of-truth right now
7. Requirements
    * functional requirements
    * non-functional requirements
    * UX requirements
    * API/interface requirements
    * data requirements
    * permissions/security requirements
    * observability/audit requirements
    * documentation requirements
    * rollout/release requirements
    * success metrics
8. Proposed design
    * product behavior
    * system architecture
    * components
    * interfaces
    * data flow
    * user flow
    * lifecycle/state model
    * error states
    * diagrams or pseudo-diagrams when useful
    * example requests/responses or contracts when useful
9. Decision log
    * decision
    * rationale
    * owner/date when known
    * alternatives considered
    * consequences
    * reversal condition when useful
10. Alternatives considered

* alternative
* why it was considered
* why rejected now
* what would make it viable later

11. Risks, edge cases, and mitigations

* risk
* likelihood when known
* impact
* mitigation
* fallback
* trigger / owner / decision needed
* rollback path where relevant

12. Validation plan

* unit/static checks
* integration tests
* browser/UI validation
* API/runtime validation
* migration/data validation
* permissions/security validation
* observability/log validation
* docs validation
* E2E proof
* launch/pilot verification

13. Rollout and operations

* rollout sequence
* feature flags or staged exposure
* migration/backfill plan
* operator actions
* support/debug plan
* telemetry
* audit events
* rollback
* post-launch monitoring

14. Open questions

* unresolved question
* why it matters
* owner
* evidence needed
* deadline / decision gate when known

15. Implementation sketch

* phases or milestones
* file-level plan only when useful
* dependencies
* sequencing
* first safe slice
* what should not be touched

16. Ship checklist / completion ledger

* bottom-of-spec checklist that answers:
    If every item here is checked, is this product actually shipped?
* include current checkpoint, blockers, product requirements, runtime requirements, data requirements, security gates, docs gates, validation gates, and launch criteria
* can be long
* prefer completeness over brevity

17. Metadata footer

* artifact title
* template: spec
* generated date/time
* source truth
* active PR/issues/branches when known
* local artifact path or Open Design path
* published URL when known
* /design-wiki link

spec map

Near the top, include a compact Spec map that acts as the table of contents and decision route.
Use this structure:

Context → User Job → Requirements → Design → Decisions → Risks → Validation → Ship

Each item should link or scroll to its section.

The spec map should help Ko understand where he is in the decision, not just list headings.

current checkpoint rule

Every spec should try to include a “You are here” checkpoint.

Use it when there is an active:

* GitHub PR
* branch
* Linear issue
* milestone
* current implementation artifact
* design artifact
* partial scaffold
* failing CI state
* launch gate

The checkpoint should state:

* current state
* what exists
* what is not done
* what is blocked
* what must happen next

If no current checkpoint exists, explicitly say:

Current checkpoint: not started / not inspected / unknown.

Do not fake progress.

requirements guidance

Requirements should be specific, testable, and grouped.

Avoid vague requirements like:

The system should be fast.

Prefer measurable requirements like:

The call endpoint returns a structured error within 500ms p95 when a runbook is missing.

Group requirements by type:

* Functional
* Non-functional
* UX
* API/interface
* Data
* Permissions/security
* Observability/audit
* Docs
* Launch/readiness

Each requirement should ideally include:

* requirement
* why it matters
* priority
* validation method
* owner/status when known

proposed design guidance

The proposed design should be the center of the spec.

It should show:

* the model of the system
* the important components
* how data moves
* how users or agents interact with it
* where permissions apply
* where side effects happen
* what errors look like
* how artifacts/logs/results are produced
* what is deliberately not included

Use diagrams or pseudo-diagrams when they reduce ambiguity.

Good patterns:

User / Agent
  → Interface
  → Runtime / Service
  → Data / Integration
  → Artifact / Result
  → Audit / Observability

or:

Input → Validation → Permission Gate → Execution → Side Effect → Output → Audit

decision guidance

Decisions belong inside the spec, not in a separate document.

Each decision card should include:

* decision
* rationale
* rejected alternatives
* consequences
* reversal condition when useful

A decision is not “we will build X.” A decision explains why this version of X is the right tradeoff right now.

alternatives guidance

Alternatives should be real.

Do not add fake alternatives just to fill space.

For each alternative, include:

* what it would look like
* what it improves
* why it is not the chosen path
* what evidence would make us reconsider

This section helps future reviewers understand why the current design exists.

risk guidance

Risks should be prominent, not buried.

Include:

* product risks
* technical risks
* data risks
* permission/security risks
* operational risks
* integration risks
* rollout risks
* adoption risks
* documentation/support risks

Each risk should include mitigation and fallback.

A good risk section makes the spec more trustworthy, not more negative.

validation guidance

Validation is part of the design, not an afterthought.

Include checks relevant to the change:

* syntax/static checks
* typecheck
* unit tests
* integration tests
* browser tests
* API smoke tests
* migration checks
* docs lint/build
* security/permission checks
* audit/log checks
* E2E scenario
* pilot verification
* production/staging verification
* screenshot or artifact validation when design is involved
* /design-wiki validation when the spec is an Open Design artifact

Do not include irrelevant checks just to look thorough.

Mark missing or skipped validation explicitly:

Skipped: <check>
Reason: <why>
Risk: <what this leaves unproven>

rollout / readiness guidance

For product-facing or customer-facing work, include readiness criteria.

Consider:

* feature flag or staged rollout
* beta / pilot / GA distinction
* telemetry
* audit events
* security review
* scalability
* availability
* known bugs
* support expectations
* docs readiness
* rollback
* post-launch owner
* customer feedback loop

A spec is not launch-ready until readiness is explicit.

ship checklist / completion ledger

Every spec must end with a ship checklist.

The checklist should be a bottom-of-spec completion ledger that answers:

If every item here is checked, is this product actually shipped?

Include:

* Current checkpoint: active PR, branch, Linear issue, milestone, or implementation state.
* Merge blockers: conflicts, failing checks, open reviews, missing approvals.
* Product requirements: all user-visible and system-visible capabilities required for launch.
* Runtime requirements: services, runbooks, jobs, integrations, permissions, artifacts, logs, and recovery paths.
* Data requirements: models, records, migrations, facades, access scopes, and exact-vs-semantic retrieval rules.
* Security requirements: secrets, scopes, approval gates, audit logs, redaction, and fail-closed behavior.
* Docs requirements: customer docs, operator docs, setup docs, troubleshooting, and examples.
* Validation requirements: local checks, typechecks, tests, smoke tests, integration tests, E2E proof, and production/pilot verification.
* Launch criteria: the smallest real workflow proving the product works end to end.

Use grouped checklist sections rather than one flat list.

Recommended status markers:

* ✓ already present or complete
* • current checkpoint / you are here
* ! blocked before merge or launch
* □ still required

The checklist can be long. Prefer completeness over brevity. When every item is checked, the product should be connected, permissioned, documented, validated, operable, and ready for the intended launch or pilot.

interaction pattern

Use HTML to make the spec easier to inspect and review.

Use:

* reader shell with GSAP ScrollSmoother
* Spec map as the table of contents / decision route
* sticky or fixed section navigation
* progress or reading-position indicator
* current checkpoint card
* expandable source/context drawers
* requirements matrix
* architecture diagram or flow map
* interface/code snippets
* decision cards
* alternatives comparison cards
* risk drawer
* validation checklist cards
* rollout/readiness panel
* ship checklist completion ledger
* tap-to-read navigation
* back-to-top affordance
* compact metadata footer
* /design-wiki link

Interactions should reduce review load. Do not add interactions that only decorate the page.

The page should still be readable if scripts fail.

visual direction

Make the spec feel like a Consuelo decision artifact: precise, technical, calm, editorial, and serious.

Aim for an operating-spec surface: less playful than research, more structured than a plan, more decision-heavy than a doc.

Use packages/consuelo-website/DESIGN.md as the visual source of truth unless Ko explicitly asks for another reference skin.

When Ko asks for a reference skin, preserve the spec structure and use the reference only for styling.

Design priorities:

* strong thesis up top
* current checkpoint visible early
* decision summary visible early
* proposed design as the central section
* requirements as inspectable matrix/cards
* decisions as durable cards
* risks as visible sober panels
* validation as pass/fail
* ship checklist as the final completion ledger

Avoid the “boxed Markdown” failure mode:

* every section in identical cards
* headings stacked vertically
* no central diagram
* no current state
* decisions hidden in prose
* validation buried
* checklist omitted or too vague

layout standard

The top of the spec should include:

1. hero with title, status, owner, reviewers, date, source truth, and thesis
2. executive summary band
3. Spec map
4. current checkpoint card
5. goals/non-goals summary
6. requirements preview
7. proposed design preview
8. risk / blocker callout when relevant

The body should include:

1. problem/context
2. users/jobs/use cases
3. requirements
4. proposed design
5. decisions
6. alternatives
7. risks/edge cases
8. validation
9. rollout/operations
10. open questions
11. implementation sketch
12. ship checklist

Use contrast between content types:

* hero should feel decisive
* context should feel grounded
* requirements should feel testable
* proposed design should feel architectural
* decisions should feel auditable
* risks should feel sober
* validation should feel pass/fail
* ship checklist should feel like a real completion ledger

component guidance

Use:

* control-surface hero for title, thesis, status, owner, source truth, and date
* executive summary band for TLDR and decision summary
* Spec map for navigation and decision route
* current checkpoint card for PR/branch/issue/current state
* goals/non-goals cards for scope control
* requirements matrix for testable requirements
* architecture flow for proposed design
* interface cards for APIs, tools, schemas, or contracts
* decision cards for rationale and tradeoffs
* alternatives comparison for rejected paths
* risk drawer for failure modes and mitigations
* validation cards for proof obligations
* rollout panel for release and operations
* open-question cards for unresolved items
* ship checklist ledger for launch readiness
* metadata footer for traceability

pacing rules

Give the spec rhythm.

Use alternating section shapes:

* expansive hero
* compact executive band
* map / route
* current checkpoint card
* scope cards
* requirements matrix
* architecture section
* decision cards
* alternatives comparison
* risk drawer
* validation checklist
* rollout panel
* open questions
* ship checklist
* metadata footer

Do not make every section the same visual weight.

The reader should always know:

* what decision the spec is making
* what source supports it
* what is already true
* what is still unknown
* what will be built
* what will not be built
* how it works
* how it can fail
* how it will be proven
* what remains before ship

reader shell

Use the shared reader shell.

The artifact should include:

* fixed header with /design-wiki
* #smooth-wrapper
* #smooth-content
* GSAP ScrollSmoother
* tap-to-read navigation
* section completion rail
* resume reading chip when applicable
* back-to-top affordance
* compact metadata footer

Reader shell owns reading behavior. DESIGN.md owns visual appearance. This template owns spec structure.

anti-lifeless rules

The spec fails if it feels like an RFC checklist poured into cards.

Avoid:

* generic section cards with identical styling
* no real thesis
* no current implementation state
* no user/job framing
* requirements that are vague or untestable
* proposed design that never shows the system
* decisions mixed into prose
* fake alternatives
* risks hidden at the bottom
* validation as an afterthought
* no launch/readiness thinking
* ship checklist missing or too short
* decorative animation with no review purpose

The spec should have decision force:

* name the thesis
* show the current state
* expose uncertainty
* make tradeoffs inspectable
* define the system model
* make validation concrete
* end with a checklist that can actually ship the product

quality bar

The spec should:

* feel like a serious product + engineering decision artifact
* make ambiguous work safer to implement
* preserve current state and source truth
* make goals and non-goals explicit
* define requirements clearly enough to test
* explain the proposed design clearly enough to review
* record decisions and tradeoffs
* surface risks and mitigations
* define validation and rollout
* include a complete ship checklist
* be useful to Ko, reviewers, engineers, designers, operators, and the next agent

Bad spec:

* long Markdown converted into cards
* vague “why”
* no current checkpoint
* no user/job framing
* no concrete requirements
* no architecture or flow
* decisions hidden
* alternatives fake or missing
* risks buried
* validation weak
* no ship checklist

Good spec:

* clear thesis
* source truth visible
* current state visible
* users/jobs clear
* scope controlled
* requirements testable
* system design inspectable
* decisions auditable
* risks sober
* validation pass/fail
* rollout realistic
* ship checklist complete

ship checklist / completion ledger

Every spec must end with a ship checklist.

The checklist should be a bottom-of-spec completion ledger that answers:

If every item here is checked, is this product actually shipped?

Include:

* Current checkpoint: active PR, branch, Linear issue, milestone, or implementation state.
* Merge blockers: conflicts, failing checks, open reviews, missing approvals.
* Product requirements: all user-visible and system-visible capabilities required for launch.
* Runtime requirements: services, runbooks, jobs, integrations, permissions, artifacts, logs, and recovery paths.
* Data requirements: models, records, migrations, facades, access scopes, and exact-vs-semantic retrieval rules.
* Security requirements: secrets, scopes, approval gates, audit logs, redaction, and fail-closed behavior.
* Docs requirements: customer docs, operator docs, setup docs, troubleshooting, and examples.
* Validation requirements: local checks, typechecks, tests, smoke tests, integration tests, E2E proof, and production/pilot verification.
* Launch criteria: the smallest real workflow proving the product works end to end.

Use grouped checklist sections rather than one flat list.

Recommended status markers:

* ✓ already present or complete
* • current checkpoint / you are here
* ! blocked before merge or launch
* □ still required

The checklist can be long. Prefer completeness over brevity. When every item is checked, the product should be connected, permissioned, documented, validated, operable, and ready for the intended launch or pilot.

## sticky spec navigation

Every Open Design spec should include a mobile-friendly sticky pill header.
The header should:
- stay fixed at the top of the reader
- use a rounded pill / floating nav treatment
- include the artifact or product name on the left
- include 4–6 main section links in the center
- include a high-priority action button on the far right
- keep working on mobile without wrapping into multiple rows
- allow horizontal scrolling for section links on small screens
- preserve `/design-wiki` access through the brand link
Default section links:
- Summary
- Requirements
- Design
- Decisions
- Validation
The far-right action button should be visually distinct and should always be:

**Task**

The Task button must link to the bottom ship checklist:

<a class="reader-task-button" href="#ship-checklist">Task</a>

The purpose of the button is to make the spec executable: no matter where Ko is reading, he can jump straight to the completion ledger.

required markup

<header class="reader-header" data-no-tap-scroll>
  <nav class="reader-nav-shell" aria-label="Spec navigation">
    <a class="reader-brand" href="/design-wiki" aria-label="Open Consuelo Wiki">
      Artifact Name
    </a>
    <div class="reader-links" aria-label="Main sections">
      <a href="#summary">Summary</a>
      <a href="#requirements">Requirements</a>
      <a href="#design">Design</a>
      <a href="#decisions">Decisions</a>
      <a href="#validation">Validation</a>
    </div>
    <a class="reader-task-button" href="#ship-checklist">Task</a>
    <span class="progress-track" aria-hidden="true">
      <span class="progress-bar"></span>
    </span>
  </nav>
</header>

required behavior

Do not rely on native hash-anchor jumping for the sticky header links. Native anchor scrolling can fight ScrollSmoother and can land sections underneath the fixed header.

All in-page header links must be routed through the reader shell’s GSAP scroll helper.

Required behavior:

* intercept links with href^="#"
* prevent default browser anchor jump
* find the target section by ID
* calculate a header-aware offset
* call the existing scrollToY(...) helper
* update the URL hash after the GSAP scroll begins
* make Task scroll to #ship-checklist

Use this pattern inside the reader shell script, after scrollToY(...) is defined:

const scrollToSection = (section, duration = 0.85) => {
  if (!section) return;
  const header = document.querySelector(".reader-header");
  const offset = header
    ? Math.max(72, Math.round(header.getBoundingClientRect().height + 18))
    : 72;
  const y = section.getBoundingClientRect().top + window.scrollY - offset;
  scrollToY(y, duration);
};
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (event) => {
    const href = anchor.getAttribute("href");
    if (!href || href === "#") return;
    const id = href.slice(1);
    const section = document.getElementById(id);
    if (!section) return;
    event.preventDefault();
    scrollToSection(
      section,
      anchor.classList.contains("reader-task-button") ? 1.05 : 0.85
    );
    if (history.pushState) {
      history.pushState(null, "", href);
    }
  });
});

Set a small debug flag so validation can confirm the behavior is active:

window.__readerShell = {
  ...window.__readerShell,
  gsapAnchorScroll: true
};

required CSS

.reader-header {
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 30;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 clamp(12px, 4vw, 44px);
  pointer-events: none;
}
.reader-nav-shell {
  pointer-events: auto;
  width: min(960px, calc(100vw - 24px));
  min-height: 44px;
  display: grid;
  grid-template-columns: minmax(130px, .9fr) minmax(0, 1.2fr) auto;
  align-items: center;
  gap: 10px;
  padding: 6px 8px 6px 14px;
  background: rgba(250, 247, 242, .88);
  border: 1px solid rgba(28, 26, 23, .12);
  border-radius: 999px;
  box-shadow: 0 10px 30px rgba(28, 26, 23, .08);
  backdrop-filter: blur(16px);
}
.reader-brand {
  color: var(--ink);
  text-decoration: none;
  white-space: nowrap;
  font-family: var(--serif);
  font-size: 16px;
}
.reader-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(12px, 2vw, 22px);
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.reader-links::-webkit-scrollbar {
  display: none;
}
.reader-links a {
  color: rgba(28, 26, 23, .72);
  text-decoration: none;
  white-space: nowrap;
  font-size: 13px;
}
.reader-links a:hover {
  color: var(--terracotta);
}
.reader-task-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 0 16px;
  border-radius: 999px;
  background: var(--terracotta);
  color: var(--paper);
  text-decoration: none;
  font-weight: 650;
  white-space: nowrap;
}
.reader-task-button:hover {
  background: #AA4327;
  color: var(--paper);
}
@media (max-width: 720px) {
  .reader-header {
    height: 62px;
    padding: 0 8px;
  }
  .reader-nav-shell {
    width: calc(100vw - 16px);
    min-height: 42px;
    padding: 5px 6px 5px 12px;
    gap: 8px;
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
  .reader-brand {
    font-size: 15px;
    max-width: 116px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .reader-links {
    justify-content: flex-start;
    gap: 14px;
    mask-image: linear-gradient(
      90deg,
      #000 0%,
      #000 calc(100% - 18px),
      transparent 100%
    );
  }
  .reader-links a,
  .reader-task-button {
    font-size: 12px;
  }
  .reader-task-button {
    min-height: 30px;
    padding: 0 13px;
  }
}
@media (max-width: 460px) {
  .reader-brand {
    max-width: 90px;
  }
  .reader-links a:nth-child(n+4) {
    display: none;
  }
}

JavaScript that intercepts hash links 

const scrollToSection = (section, duration = 0.85) => {
  if (!section) return;

  const header = document.querySelector(".reader-header");
  const offset = header
    ? Math.max(72, Math.round(header.getBoundingClientRect().height + 18))
    : 72;

  const y = section.getBoundingClientRect().top + window.scrollY - offset;
  scrollToY(y, duration);
};

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (event) => {
    const href = anchor.getAttribute("href");
    if (!href || href === "#") return;

    const id = href.slice(1);
    const section = document.getElementById(id);
    if (!section) return;

    event.preventDefault();

    scrollToSection(
      section,
      anchor.classList.contains("reader-task-button") ? 1.05 : 0.85
    );

    if (history.pushState) {
      history.pushState(null, "", href);
    }
  });
});

validation

Before publishing, verify:

* sticky pill header renders at the top
* brand links to /design-wiki
* main links route through GSAP, not native anchor jump
* Task scrolls to #ship-checklist
* target section lands below the sticky header
* mobile width does not wrap the nav into two rows
* window.__readerShell.gsapAnchorScroll === true


reader shell v1.3 interaction contract

Do not hand-author these behaviors inside a spec. Provide typed section titles, typed components, and checklist groups; the TypeScript renderer owns the interaction layer.

The renderer now provides:

* line-style section rail generated from every top-level section, typed component, and task ledger
* mobile section drawer generated from the same section list, using each section title as the row text
* automatic copy for selected text
* Enter-to-next-occurrence behavior when the page can infer the selected search term
* per-task copy buttons that copy the task/checklist group as Markdown

Spec authors should make section titles short and useful because they appear in the mobile drawer. Task/checklist groups should be written as transferable agent work blocks: one clear group title, optional area/status tag, and checklist items with explicit completion state.
