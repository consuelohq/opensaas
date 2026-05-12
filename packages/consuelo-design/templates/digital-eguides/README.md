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

- `research` — research lessons, source-grounded explainers, paper walkthroughs, daily deep ideas.
- `spec` — product specs, engineering specs, RFCs, design docs, architecture proposals. Decisions are baked into the spec.
- `plan` — execution plans, implementation plans, rollout plans, operating plans. Decisions are an ongoing section inside the plan.

Do not add a new workspace facade command for each template. The command starts the Open Design workflow; the template shapes the artifact.
