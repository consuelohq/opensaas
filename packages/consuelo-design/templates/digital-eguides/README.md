# Digital e-guide templates

These are Consuelo-owned Open Design templates for the existing `digital-eguide` workflow.

Use the existing workflow entrypoint and pass a template hint when the artifact type is known:

```ts
workspace.call({
  tool: "consueloDesign.generateDigitalEguide",
  input: {
    name: "example-spec",
    template: "spec",
    prompt: "Build a rich HTML spec for ..."
  },
  timeout: 600,
})
```

Templates:

- `research` — research lessons, source-grounded explainers, paper walkthroughs, daily deep ideas. Render with `--template research`.
- `spec` — product specs, roadmaps, engineering specs, RFCs, design docs, architecture proposals. Render with `--template spec`. Decisions are baked into the spec.
- `plan` — execution plans, implementation plans, rollout plans, operating plans. Plan is an instruction contract, but it renders through the `spec` reader mode because plans are operating specs with checkpoint, validation, rollout, and ledger surfaces.

Do not add a new workspace facade command for each template. The command returns a headless work order by default; the selected template shapes the local artifact the agent should create/edit directly. Use `--live` only for an explicit headed Open Design UI session.

Use the repo-root renderer commands when producing durable wiki pages:

```bash
bun run wiki:render -- --template <spec|research> --input <content.json> --out <index.html>
bun run wiki:validate -- --file <index.html> --template <spec|research>
```

Use the shared typed components instead of custom HTML wherever possible: `callout`, `cards`, `metrics`, `table`, `flow`, `timeline`, `details`, `ranges`, `comparisons`, and `ledger`. The component data changes by content contract: specs use them for decisions, requirements, validation, and task ledgers; research lessons use them for source cards, vocabulary, evidence, reveals, explanations, and memory review; plans use them for context, phase sequencing, risks, validation, and handoff.

The shared `reader-shell` requires GSAP ScrollSmoother for smooth swipe/native scrolling, GSAP ScrollToPlugin for fallbacks, nearly-page-sized tap-to-read movement, and a quiet bottom-right back-to-top affordance. Generated HTML artifacts should wrap the article content in `#smooth-wrapper > #smooth-content`, keep fixed controls outside that wrapper, initialize ScrollSmoother before tap navigation, and mark fixed controls with `data-no-tap-scroll`.
