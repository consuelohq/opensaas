# Teach

## Purpose

Use this skill when the user asks the OS agent to teach them one deep idea, run a daily teaching lesson, create an AI-seeded learning guide, ingest a research source for teaching, or publish a durable Sites guide.

The skill coordinates research ingest, lesson writing, typed guide content, Sites rendering, validation, publishing, and optional teach-state updates. It does not own the reader UI. Sites and the canonical reader shell own the page UI.

Default teaching is AI-seeded so a user can get useful lessons without setup. The user or their agent may swap the topic queue, source list, or cadence at any time.

## Default seeded topics

Use these only when the user has not provided a topic and no local teach state exists:

```text
ai systems
ai agents
evals and measurement
retrieval and search
human-ai interaction
reasoning and planning
model behavior and interpretability
safety and reliability
coordination and organizations
cognition for AI builders
```

Suggested local state names:

```text
teach-topic-queue
teach-paper-history
teach-preferences
teach-schedule-prompt
```

If those notes do not exist, continue from the default seed queue and report that no persistent teach state was found.

## Source of truth hierarchy

1. Current OS steering and active user request
2. Local teach state, if present
3. Research bundle from `research.ingest`
4. Final Markdown lesson
5. Typed `content.json`
6. Rendered Sites guide
7. Published Sites page/version

Research bundle is source truth. Markdown lesson is teaching truth. Typed `content.json` is render truth. Rendered HTML is presentation truth. Published Sites version is durable truth.

## Hard rules

- Call `os.get_steering` first and read the full response.
- Use `os.call` for OS actions.
- Do not invent tool names. Use only tools exposed by steering.
- Do not teach from search snippets.
- Do not write the final lesson until `research.ingest` succeeds or the user explicitly provides a source packet.
- Do not invent paper details, authors, dates, findings, or caveats.
- Do not remove citations.
- Do not turn the lesson into marketing copy.
- Do not hand-author reader-shell HTML/CSS/JS.
- Use the canonical typed Consuelo reader renderer through Sites.
- Use `template: guide` for teaching artifacts.
- Do not use the old `research` template.
- Do not publish localhost, preview, or fallback Markdown HTML as the final artifact.
- Do not update teach history/queue until the guide is rendered, validated, published, and verified.
- For an existing Sites page, publish with `--base-version <currentVersionId>`.
- Use `--force-publish` only when the user explicitly approves an intentional overwrite or recovery publish.

## Required orientation

After steering, inspect current local instructions when present:

```text
packages/os/skills/research-ingest/SKILL.md
packages/os/skills/sites/SKILL.md
packages/consuelo-design/templates/digital-eguides/guide.md
packages/consuelo-design/templates/digital-eguides/reader-shell.md
packages/consuelo-design/scripts/render-consuelo-reader.ts
packages/consuelo-design/scripts/validate-consuelo-reader.ts
```

Current renderer command help wins over stale prompt text.

## Run sequence

1. Load steering.
2. Read local teach state if it exists.
3. Select a topic from the user request, local topic queue, or AI seed queue.
4. Select exactly one strong source unless the user asks for comparison.
5. Prefer open papers, arXiv, ar5iv, official PDFs, author-hosted PDFs, proceedings pages, classic essays, or official documentation.
6. Verify recent, niche, or unstable source details with web search when needed.
7. Run `research.ingest` for the source.
8. Verify the bundle includes `packet.md`, `extracted.md`, and `manifest.json` or equivalent saved files.
9. Write the final Markdown lesson from the bundle.
10. Convert the lesson into typed `content.json` for `template: guide`.
11. Render with `sites render` or the current canonical `wiki:render` command if steering still exposes that as the renderer entrypoint.
12. Validate with the current validator.
13. Publish through Sites with immutable versioning.
14. Verify the Sites URL and `/sites` index.
15. Update teach history/queue only after successful verification.
16. Report source, bundle, local paths, Sites URL, version, and state updates.

## Source selection

Pick sources that teach a transferable idea.

For default AI-seeded lessons, prefer foundational papers in AI, agents, retrieval, evals, HCI, reasoning, interpretability, safety, and official reports/docs that changed practice.

Avoid shallow trend posts, inaccessible full text, duplicate sources already in teach history, and unsupported claims from failed or partial packets.

If ingest fails, try at most three sources in the same topic. If all fail, stop and report the failure. Do not update state.

## Research ingest

Use the research ingest skill/tool exposed by steering. Intended call shape:

```ts
await os.call({
  tool: "research.ingest",
  input: {
    source: "<paper-url-or-pdf-url>",
    question: "What is the deep idea from this source, and how does it improve real-world intuition?",
    contextTitle: "Research Bundle: <source title>",
    contextCategory: "teach",
    mode: "standard"
  },
  timeout: 900
})
```

Use visual mode only when the source is video, slides, a visual explanation, or diagrams are essential.

## Final lesson structure

Save or stage a Markdown lesson with this structure:

```markdown
# daily idea

## 1) the source
- title
- authors / publisher
- year
- link
- why it matters
- what kind of source it is

## 2) explain like i am 5

## 3) vocabulary

## 4) walkthrough
- question
- mechanism
- key result or claim
- importance
- limitations

## 5) intuition builder
- AI systems
- product or engineering
- everyday decision-making

## 6) deeper layer

## 7) what to remember

## 8) one question for the user
```

Style: simple first, rigorous second; concrete; source-grounded; uncertainty visible; terms explained; citations preserved; AI-building connections when useful.

## Typed guide rendering

Teaching artifacts must use `template: guide`. Do not use `template: research`.

Do not hand-author the reader shell. The renderer owns UI, typography, nav, scroll, mobile behavior, cards, tables, dark mode, and Sites links.

Preferred command surface:

```bash
bun ./scripts/os.ts sites render --template guide --input <content.json> --out <index.html>
bun ./scripts/os.ts sites publish --target <artifact-dir> --path /pages/teach/<slug> --title "Teach — <source title>" --kind guide [--base-version <id>]
```

If steering says the current renderer entrypoint is still `bun run wiki:render`, use it, but keep `template: guide`.

## Typed components

Use typed components instead of custom HTML:

```text
callout
metrics
flow
table
timeline
details
ranges
comparisons
cards
ledger
```

Use `callout` for the deep idea, `cards` for source/vocabulary/examples/memory, `details` for caveats and optional depth, `table` for evidence or vocabulary, `metrics` for confidence and difficulty, `flow` for mechanisms, `timeline` for history, `ranges` for uncertainty and tradeoffs, `comparisons` for wrong-vs-right mental models, and `ledger` for a learning checklist.

## Minimum `content.json` intent

Inspect the current renderer before writing exact JSON. Minimum teaching intent:

```json
{
  "template": "guide",
  "title": "Teach — <source title>",
  "eyebrow": "AI learning guide • <date>",
  "thesis": "<the deep idea in one sentence>",
  "metadata": {
    "status": "published lesson",
    "sourceTruth": "Research Bundle: <source title>",
    "date": "<YYYY-MM-DD>"
  },
  "sections": [
    { "id": "deep-idea", "eyebrow": "deep idea", "title": "<central insight>", "body": ["<simple promise>"], "callout": { "label": "deep idea", "title": "<central insight>", "body": "<why it matters>" } },
    { "id": "source", "eyebrow": "source", "title": "The source", "cards": [] },
    { "id": "eli5", "eyebrow": "explain like i am 5", "title": "The simple version", "body": [] },
    { "id": "vocabulary", "eyebrow": "vocabulary", "title": "Terms", "table": { "columns": ["Term", "Meaning", "Why it matters"], "rows": [] } },
    { "id": "walkthrough", "eyebrow": "walkthrough", "title": "How it works", "flow": [] },
    { "id": "evidence", "eyebrow": "evidence", "title": "Evidence and caveats", "details": [] },
    { "id": "intuition", "eyebrow": "intuition", "title": "How to use it elsewhere", "comparisons": [] },
    { "id": "remember", "eyebrow": "memory", "title": "What to remember", "cards": [] },
    { "id": "question", "eyebrow": "question", "title": "One question for you", "body": [] }
  ],
  "ledgerTitle": "Learning checklist",
  "ledger": [
    { "title": "Review path", "items": [
      { "status": "done", "text": "Understand the deep idea." },
      { "status": "current", "text": "Apply it to an AI system." },
      { "status": "todo", "text": "Return to the final question." }
    ] }
  ]
}
```

## Validation gate

Before publishing, verify: `content.json` exists, rendered `index.html` exists, validator passes with no missing markers, title matches, source/thesis/ELI5/vocabulary/walkthrough/evidence/caveats/memory/final question exist, the page was rendered by the canonical typed reader, and the page links back to Sites.

Do not publish if validation fails.

## Publish gate

Use Sites for durable output when available.

New page:

```bash
bun ./scripts/os.ts sites publish --target <artifact-dir> --path /pages/teach/<slug> --title "Teach — <source title>" --kind guide
```

Existing page:

```bash
bun ./scripts/os.ts sites publish --target <artifact-dir> --path /pages/teach/<slug> --title "Teach — <source title>" --kind guide --base-version <currentVersionId>
```

Existing pages require `--base-version`. `--force-publish` requires explicit user approval. If publish reports a stale version, re-read current, rebase, then publish.

## State update gate

Only update teach history or queue after the research bundle exists, lesson exists, typed content exists, guide rendered, guide validated, guide published, and Sites URL verified.

If any step fails, stop and report the blocker without updating state.

## Final report

Return topic, source title/author/year/URL, research bundle path/title, lesson path/title, content JSON path, rendered guide path, Sites URL, current version ID, state updates made, validation checks, and blockers or manual action needed.
