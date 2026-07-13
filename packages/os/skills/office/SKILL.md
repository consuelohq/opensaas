---
name: office
description: Use for Office artifact work, including digital e-guides, specs, plans, research guides, PDFs, landing pages, website sections, demos, HTML emails, social assets, motion frames, HyperFrames, and Office publishing. Trigger when the user asks to create, revise, publish, validate, or inspect a durable visual/design artifact through Office or the Open Design archive.
---

# Office

Use this as the top-level orchestration skill for Office work. The skill is an operating manual for chaining existing workspace tools and scripts; it is not a replacement script engine.

## Core rule

Default to source-first, headless artifact execution:

```text
brief
  -> choose subskill/preset
  -> read design context and template rules
  -> create or edit artifact source
  -> validate in browser
  -> publish with design.publish
  -> verify artifact route and /office
  -> report durable links, source path, validation, and remaining decisions
```

Use the live Open Design UI only when Ko explicitly asks for live visual collaboration, project inspection, manual iteration, or a visible preview workspace.

## Required context

Always read the current repo operator manual before substantial design work:

- `areas/office/AGENTS.md`
- `packages/consuelo-website/DESIGN.md`

A packaged copy of the operator manual is also available at `references/agents.md` for productized skill consumers.

## Workflow

1. Load workspace steering.
2. Run design health/context checks when relevant: `office.check`, `office.listSkills`, `office.listDesignSystems`, and `office.uiStatus`.
3. Select the closest subskill from `subskills/`.
4. Read only the template/reference files needed for that artifact type.
5. Use existing workspace tools/scripts as the machinery. Do not reimplement them inside the skill.
6. Create or update the local artifact source directly unless Ko asks for live Open Design UI work.
7. Validate in browser, including screenshots or accessibility snapshots when visual truth matters.
8. Publish durable artifacts with `design.publish` or the appropriate Office publish facade.
9. Verify the artifact route and `/office` after publishing.
10. Report the source path, durable links, validation evidence, and any approval-gated next action.

## Subskills

Use subskills as additive rules on top of the base design operating manual:

- `subskills/landing-page.json` — website/landing page drafts and campaign briefs.
- `subskills/spec.json` — product specs, engineering specs, RFCs, architecture/design docs.
- `subskills/research-guide.json` — research guides, source-grounded explainers, Daily Deep Idea artifacts.
- `subskills/digital-eguide.json` — long-form editable digital e-guides.
- `subskills/plan.json` — execution plans, rollout plans, operating plans.
- `subskills/html-email.json` — HTML/email design artifacts.
- `subskills/motion-frame.json` — motion frames, GSAP, and HyperFrames preparation.
- `subskills/hyperframes.json` — HTML-to-MP4 render work.

Subskills should remain thin. They define workflow IDs, default tools, templates, and extra artifact-specific rules. The top-level skill supplies the operating model.

## Approval gates

Drafting and local artifact generation are allowed in the `draft` permission tier. Publishing, replacing customer-facing pages, external side effects, campaign mutation, spend, or destructive changes require explicit approval.

## Reporting

Every final report for design work must include:

- source path or project/work order location
- durable artifact link and direct tailnet link when available
- `/office` verification status when published
- browser validation evidence
- approval-gated next actions
