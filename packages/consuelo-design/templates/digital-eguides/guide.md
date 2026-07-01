# guide

Guides are source-grounded reader-shell artifacts rendered by the canonical TypeScript renderer.

Use typed input for `packages/consuelo-design/scripts/render-consuelo-reader.ts`.

Required fields:

- `template: "guide"`
- `title`
- `eyebrow`
- `thesis`
- `metadata`
- `sections`
- `ledgerTitle`
- `ledger`

Preferred first-class typed components:

- `callout`
- `metrics`
- `flow`
- `table`
- `timeline`
- `details`
- `ranges`
- `comparisons`
- `cards`
- `ledger`

Compatibility aliases still render through the same shell when useful: `decisionCards`, `requirementsMatrix`, `architectureFlow`, `riskPanels`, `metricCards`, `taskLedger`, and `openQuestions`.

Do not hand-author the reader chrome, ScrollSmoother setup, pill nav, checklist UI, or mobile layout. The renderer owns those decisions.
