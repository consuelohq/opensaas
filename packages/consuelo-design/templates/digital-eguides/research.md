# research

Use for research lessons, research reports, source-grounded explainers, paper walkthroughs, and Daily Deep Idea artifacts.



## render protocol

Do not hand-author a new page shell for wiki artifacts.

Run the commands from the repository root. The root package forwards to `packages/consuelo-design`, so agents should not `cd` or infer a package-local invocation.

1. Read this template as the content/thinking contract.
2. Produce structured content for this template.
3. Render through the canonical Consuelo reader shell with one shared command:

```bash
bun run wiki:render -- --template <spec|research> --input <content.json> --out <index.html>
```

4. Validate the output before publishing:

```bash
bun run wiki:validate -- --input <index.html>
```

The Markdown template owns the section logic. The TypeScript renderer owns the repeatable UI/UX: top pill nav, section rail, resume reading, ScrollSmoother, back-to-top, favicon/theme-color, neutral dark mode, mobile responsiveness, cards, footer, and /design-wiki link.

For teaching, paper walkthroughs, Daily Deep Ideas, and research explainers, use `template: research` with the lesson-specific sections below. Do not force the spec checklist structure onto lessons.

## job

Turn source material into a durable teaching/report artifact that preserves evidence, improves understanding, and gives Ko a clear mental model he can reuse.

The guide should not feel like a paper summary. It should feel like a research mentor built into a polished interactive reading surface.

## source truth

The source material is the truth.

For Daily Deep Idea runs, the research bundle is the factual truth and the final Markdown lesson is the teaching truth. The digital e-guide is the presentation artifact.

Preserve:

- paper/source title
- authors
- year
- source link
- citations
- factual claims
- limitations
- uncertainty
- section order when Ko provides one
- final question or thinking prompt

Do not invent research claims. Do not remove citations. Do not make the artifact sound more certain than the source.

## basis

A strong research guide makes the research question, evidence, method, result, limitations, and implications easy to inspect.

It should help Ko answer:

- What is the deep idea?
- Why did this paper matter?
- What did the authors actually show?
- What should I believe, doubt, or remember?
- Where does this idea appear in real systems, agents, prediction, uncertainty, business, or everyday decisions?

- ## narrative spine

Do not design the guide as a decorated outline.

Shape it like an interactive learning journey:

1. **Hook** — open with the puzzle, tension, or surprising claim the paper helps explain.
2. **Source grounding** — show the source card early so Ko knows what the artifact is anchored in.
3. **Simple world** — teach the core idea with a toy example, story, or tiny model.
4. **Mechanism** — reveal the actual paper mechanism: what changed, what was measured, what was proven, or what framework was introduced.
5. **Evidence** — separate what the source shows from what the guide interprets.
6. **Transfer** — show where the idea appears in agents, prediction, systems, business, or everyday decisions.
7. **Caution** — show the limitation, failure mode, or common overread.
8. **Memory** — end with a small set of durable mental handles.
9. **Question** — close with one question Ko can reason with.

The guide should feel like a guided lesson with momentum, not a static research handout.

## required structure


1. **Hero**: topic, paper/source title, one-sentence thesis, source status, reading time, and why it matters.
2. **Source card**: title, authors, year, publication/source, link, source type, and evidence status.
3. **Paper map**: compact visual route through the guide: puzzle, simple model, prediction, mechanism, evidence, transfer, caution, memory.
4. **Deep idea**: the central insight in one sharp paragraph.
5. **Explain like im 5**: story, toy example, or metaphor before technical detail.
6. **Prediction-before-reveal**: ask Ko what he would expect before showing the paper’s key result or mechanism.
7. **Vocabulary**: compact cards for the terms Ko needs before the walkthrough.
8. **Paper/source walkthrough**:
   - question
   - method
   - key result
   - what made it important
   - limitations
   - the most important mechanism
9. **Evidence trail**: preserve citations and source links exactly. Keep evidence visibly separate from interpretation.
10. **Intuition builder**: examples in technology, systems/business, and everyday life.
11. **Deeper layer**: one advanced insight that goes beyond the simple explanation.
12. **Limits and caution**: what the source does not prove, where people overapply it, and what remains uncertain.
13. **Memory card**: 3–5 claims worth saving.
14. **Question for Ko**: one sharp question that makes Ko reason with the idea.

### learning route

Near the top, include a compact **Paper map** that acts as the table of contents and learning route.

Use this example structure:

Puzzle → Simple model → Prediction → Mechanism → Evidence → Transfer → Caution → Memory

Each item should link or scroll to its section.

The paper map should help Ko understand where he is in the lesson, not just list headings. Keep it compact, visual, and useful.

## interaction pattern

Use HTML to make the research easier to learn.

The page should feel like a small interactive field guide:

- sticky table of contents with section anchors
- progress or reading-position indicator
- collapsible deep dives for methods, math, caveats, and citations
- expandable evidence drawer that keeps sources visibly separate from interpretation
- glossary cards with hover/click expansion
- tabbed examples for technology, systems/business, and everyday life
- one lightweight interactive metaphor when it clarifies the core idea
- “what changed my mind?” or “why this mattered” callout
- limitations drawer or caution panel
- memory card near the end
- final question panel
- reader shell navigation
- back-to-top affordance
- compact metadata footer
- `/design-wiki` link

Interactions should reduce cognitive load. Do not add interactions that only decorate the page.

The page should still be readable if scripts fail.

## prediction-before-reveal

Include one tasteful prediction-before-reveal moment.

Place it after the simple explanation and before the paper’s key result or mechanism.

It should ask Ko to make a small prediction before the guide reveals what the paper found.

Good pattern:


Before the reveal:
Given the setup, what would you expect?

Option A: ...
Option B: ...
Option C: ...

Reveal:
The paper shows ...
Why that matters ...

Use a collapsible reveal, small button, or <details> element. The page must still be readable if scripts fail.

Do not overuse this. One strong prediction moment is better than many gimmicks.

## visual direction

Make the research guide feel like a Consuelo research artifact: precise, calm, technical, editorial, and alive.

Aim for a dark-mode research console crossed with a polished editorial field guide.

Use `packages/consuelo-website/DESIGN.md` as the visual source of truth:

- Geist typography
- compact Geist Mono labels
- restrained monochrome palette
- shadow-as-border cards
- strong whitespace
- precise hierarchy
- technical labels and status pills
- minimal decorative color

Do not render this as an all-white Markdown page.

Avoid the “boxed Markdown” failure mode: headings stacked vertically, every paragraph placed in the same kind of card, and no real reading rhythm.

Create contrast between content types:

- hero should feel expansive
- source card should feel factual and grounded
- ELI5 section should feel warm and simple
- walkthrough should feel rigorous
- evidence should feel inspectable
- limitations should feel sober
- memory card should feel save-worthy
- final question should feel like a closing prompt, not a footer

Prefer a dark or adaptive reader surface when the design system supports it. If dark/adaptive tokens are missing, extend the design system first rather than inventing a one-off theme inside this template.

## layout standard

The top of the guide should include:

1. hero with topic, thesis, paper/source, and reading time
2. source card separated from interpretation
3. table of contents
4. deep idea callout
5. “explain simply” card

The body should include:

1. vocabulary cards
2. walkthrough section
3. evidence trail / citation drawer
4. limitations callout
5. intuition examples
6. deeper layer
7. memory card
8. final question

Use cards and collapsibles to reduce wall-of-text density. Keep the reading flow smooth: simple first, rigorous second.

## component guidance

Use the canonical Consuelo reader renderer. Do not hand-author custom HTML for normal lesson structure. Fill the typed section/component shapes so the page inherits the same shell, font loading, neutral dark mode, header, resume-reading, rail, mobile table behavior, hover states, and back-to-top behavior as specs.

Use these typed components when they fit the teaching job:

- **callout** for the deep idea, why-now, what-changed-my-mind, limitation, or caution moment
- **cards** for source metadata, vocabulary, key results, examples, and memory chunks
- **details** for collapsible dense methods, math, citations, caveats, spoilers, or reveal-after-prediction sections
- **table** for vocabulary maps, evidence ledgers, comparison grids, paper/source inventories, or concept contrasts
- **metrics** for small learning checkpoints, confidence levels, source counts, benchmark scores, or before/after understanding
- **flow** for mechanism walkthroughs, process diagrams, causal chains, or step-by-step algorithms
- **timeline** for historical development, paper sequence, learning route, or implementation phases
- **ranges** for confidence scales, tradeoff intensity, difficulty, maturity, or evidence strength
- **comparisons** for model/tool/framework differences, wrong-vs-right mental models, or rejected explanations
- **ledger** only when the lesson needs a learning checklist, practice route, or memory review list; do not force spec-style task checklists into teaching pages

Prefer typed renderer components over bespoke markup. Keep citations close to the claims they support.

## pacing rules

Give the guide rhythm.

Use alternating section shapes:

- big hero
- compact metadata card
- short thesis callout
- story/example panel
- glossary grid
- rigorous walkthrough
- collapsible evidence
- limitations callout
- example tabs
- memory card
- final question

Do not make every section the same visual weight.

The reader should always know:

- what idea they are learning
- what source supports it
- what is interpretation
- what remains uncertain
- what to remember

## reader shell

Use the shared reader shell.

The artifact should include:

- fixed header with `/design-wiki`
- `#smooth-wrapper`
- `#smooth-content`
- GSAP ScrollSmoother
- tap-to-read navigation
- back-to-top affordance
- metadata footer

Reader shell owns reading behavior. `DESIGN.md` owns visual appearance. This template owns research structure.

## anti-lifeless rules

The guide fails if it feels like source text poured into a template.

Avoid:

- generic section cards with identical styling
- long uninterrupted paragraphs
- citations hidden at the bottom
- no tension or central puzzle
- a hero with no real thesis
- examples that feel bolted on
- limitations treated as a small afterthought
- decorative animation with no learning purpose
- paper summary language that never becomes usable intuition

The guide should have a point of view:

- name the core puzzle
- explain why the paper’s move was clever
- show what the reader can now see differently
- make the limits easy to inspect
- end with a question that creates thought

## quality bar

The guide should:

- feel like a clear research mentor, not a paper summary dump
- start simple, then get rigorous
- preserve uncertainty and limitations
- make evidence inspectable
- make the central idea memorable
- connect the idea to real systems when useful
- avoid hype and marketing language
- use design only to improve comprehension

Bad research guide:

- long Markdown converted into cards
- citations removed or hidden
- paper details blurred into vibes
- limitations buried
- no clear idea to remember
- decorative interactions that do not help understanding

Good research guide:

- one clear deep idea
- source truth visible
- claims traceable to evidence
- simple metaphor first
- rigorous walkthrough second
- limitations visible
- examples make the idea usable
- final question makes Ko think harder

## full interaction list

- paper map as the table of contents / learning route
- sticky section navigation based on the paper map
- progress or reading-position indicator
- one prediction-before-reveal interaction before the key result
- collapsible deep dives for methods, math, caveats, and citations
- expandable evidence drawer that keeps sources visibly separate from interpretation
- glossary cards with hover/click expansion
- tabbed examples for technology, systems/business, and everyday life
- “what changed my mind?” or “why this mattered” callout
- limitations drawer or caution panel
- memory card near the end
- final question panel
- reader shell navigation
- back-to-top affordance
- compact metadata footer
- `/design-wiki` link