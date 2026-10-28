# Business context

Consuelo OS is for revenue teams that need agents to operate across sales, marketing, support, and customer data without exposing a large tool surface.

The customer-facing idea:

> Consuelo OS turns a revenue workspace into an AI-operable business system.

The technical idea:

> Consuelo OS packages steering, typed tools, permissions, Bun runtime, app/API access, sandbox execution, files/artifacts, and documentation into one agent-operable runtime.

## Current scaffold boundary

The package now separates instruction skills from callable tools. Skills live under `skills/`; canonical TypeScript tool packages live under `tools/<domain>/`; generated manifests publish the customer-visible catalog.

## Future business domains

Future capabilities can cover:

- daily revenue summaries
- lead prioritization
- post-call analysis
- sales coaching
- follow-up generation
- campaign briefs
- manager reports
- ad review
- customer health summaries

Each new callable capability should enter through a canonical tool package, with a skill only when reusable instructions are also needed.
