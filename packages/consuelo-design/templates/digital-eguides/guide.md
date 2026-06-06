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

Optional typed components:

- `timeline`
- `decisionCards`
- `requirementsMatrix`
- `architectureFlow`
- `riskPanels`
- `metricCards`
- `taskLedger`
- `openQuestions`

Do not hand-author the reader chrome, ScrollSmoother setup, pill nav, checklist UI, or mobile layout. The renderer owns those decisions.
