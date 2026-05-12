# research

Use for research lessons, research reports, source-grounded explainers, paper walkthroughs, and Daily Deep Idea artifacts.

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

## required structure

1. **Hero**: topic, paper/source title, one-sentence thesis, source status, reading time, and why it matters.
2. **Source card**: title, authors, year, publication/source, link, source type, and evidence status.
3. **Deep idea**: the central insight in one sharp paragraph.
4. **Explain like im 5**: story, toy example, or metaphor before technical detail.
5. **Vocabulary**: compact cards for the terms Ko needs before the walkthrough.
6. **Paper/source walkthrough**:
   - question
   - method
   - key result
   - what made it important
   - limitations
   - the most important mechanism
7. **Evidence trail**: preserve citations and source links exactly. Keep evidence visibly separate from interpretation.
8. **Intuition builder**: examples in technology, systems/business, and everyday life.
9. **Deeper layer**: one advanced insight that goes beyond the simple explanation.
10. **Limits and caution**: what the source does not prove, where people overapply it, and what remains uncertain.
11. **Memory card**: 3–5 claims worth saving.
12. **Question for Ko**: one sharp question that makes Ko reason with the idea.

## interaction pattern

Use HTML to make the research navigable, not decorative.

Prefer a polished multi-panel reading surface with:

- sticky table of contents
- section progress or reading position
- collapsible deep dives
- expandable limitations
- expandable evidence/citation drawer
- tabbed examples or source views
- hover/click glossary aids
- numbered insight cards
- one lightweight interactive metaphor when it clarifies the core idea
- reader shell navigation
- back-to-top affordance
- compact metadata footer
- `/design-wiki` link

The page should still be readable if scripts fail.

## visual direction

Make the research guide feel like a Consuelo research artifact: precise, calm, technical, editorial, and alive.

Do not render this as an all-white Markdown page.

Use `packages/consuelo-website/DESIGN.md` as the visual source of truth:

- Geist typography
- compact Geist Mono labels
- restrained monochrome palette
- shadow-as-border cards
- strong whitespace
- precise hierarchy
- technical labels and status pills
- minimal decorative color

Prefer a dark or adaptive reader surface when the design system supports it. If dark/adaptive tokens are missing, extend the design system first rather than inventing a one-off theme inside this template.

The guide should feel like a dark-mode research console crossed with a polished editorial essay.

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

Use:

- **source card** for paper metadata
- **deep idea card** for the central insight
- **glossary cards** for vocabulary
- **numbered cards** for key results or mechanisms
- **details/collapsible panels** for dense methods, math, citations, or caveats
- **callout card** for limitations
- **three-column or stacked examples** for intuition builder
- **closing panel** for the final question
- **metadata footer** for source truth, generated date, template, Open Design path, and design wiki link

Keep citations close to the claims they support.

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
