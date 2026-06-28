# AGENTS.md — consuelo-design

## core idea

Open Design is Consuelo’s design system, template, preview, project, and archive layer.

For Ko’s normal artifact requests, the agent should **execute the artifact directly**. Do not default to operating the Open Design chat UI.

The generated prompt is a **work order**, not a chat message.

Default flow:

```text
brief
  -> generated work order
  -> read DESIGN.md + relevant template
  -> create/edit local artifact source
  -> validate in browser
  -> publish with design.publish
  -> verify /design-wiki
```

Use the Open Design UI only when Ko explicitly wants live visual collaboration, project inspection, manual iteration, or a visible preview workspace.

## source of truth

Always read and follow:

```text
packages/consuelo-website/DESIGN.md
```

This file owns Consuelo visual language: Geist typography, black/white precision, shadow-as-border cards, restrained spacing, component rules, and theme direction.

For digital e-guides, also read:

```text
packages/consuelo-design/templates/digital-eguides/guide.md
packages/consuelo-design/templates/digital-eguides/spec.md
packages/consuelo-design/templates/digital-eguides/plan.md
packages/consuelo-design/templates/digital-eguides/reader-shell.md
```

Read only the template needed for the artifact type unless the task requires comparison.

Do not invent a separate visual system inside a template. If dark/adaptive theme behavior is needed and DESIGN.md does not cover it, update DESIGN.md or clearly flag the gap before hardcoding a one-off theme.

## when to use

Use this skill for:

* digital e-guides
* research guides and Daily Deep Idea artifacts
* specs
* plans
* PDFs
* flyers
* pricing cards
* landing pages
* website sections
* demos
* HTML emails
* social assets
* motion frames
* HyperFrames
* downloadable design assets

Use Open Design source-first for artifacts Ko may revise, reuse, inspect, archive, export, or build on later.

Use a quick throwaway artifact only when Ko explicitly asks for a quick sketch, moodboard, concept probe, or temporary static asset.

## execution model

Default to headless artifact execution.

Do:

1. Load workspace steering.
2. Run design health/context checks when relevant.
3. Read DESIGN.md.
4. Read the relevant artifact template.
5. Treat the generated `workOrder` as the spec. Do not expect or use `project.pendingPrompt` unless `live: true` was explicitly requested.
6. Create or update the local artifact source directly.
7. Validate with browser tools.
8. Publish durable links through `design.publish`.
9. Verify the artifact route and `/design-wiki`.
10. Report the source path, durable links, validation, and remaining decisions.

Do not:

* paste/send the generated prompt into Open Design chat by default
* depend on Claude/OpenAI keys inside the Open Design UI
* make Ko watch a headed UI unless he asks
* treat a prompt sitting in the UI as the final artifact
* publish important artifacts through temporary local HTTP servers

## workspace calls

Use workspace tools from steering. Do not invent tool names.

Common calls:

```ts
await workspace.get_steering()

await workspace.call({ tool: "office.check", input: {}, timeout: 120 })
await workspace.call({ tool: "office.listSkills", input: {}, timeout: 120 })
await workspace.call({ tool: "office.listDesignSystems", input: {}, timeout: 120 })
await workspace.call({ tool: "office.uiStatus", input: {}, timeout: 120 })
```

Use dry run to inspect the generated headless work order before creating files:

```ts
await workspace.call({
  tool: "office.generateDigitalEguide",
  input: {
    dryRun: true,
    name: "example-artifact",
    template: "research",
    prompt: "<brief>"
  },
  timeout: 600
})
```

Dry-run output should return `mode: "headless-work-order"` and a `workOrder` field. Treat `workOrder` as the spec to execute directly. Only `live: true` should return an Open Design UI project with `pendingPrompt`.

## current tool contract

Default `office.generate*` behavior:

```json
{
  "mode": "headless-work-order",
  "artifact": { "...": "..." },
  "workOrder": "...",
  "workOrderPath": "..."
}

Explicit live UI behavior:

{
  "mode": "live-open-design-session",
  "project": {
    "pendingPrompt": "..."
  }
}

Only the live UI path should use project.pendingPrompt.

## workflow selection

Choose the closest workflow:

| User wants                                                                    | Tool                                   | Notes                                                           |
| ----------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------- |
| research guide, e-guide, designed doc, flyer, pricing card, PDF-like artifact | `office.generateDigitalEguide` | Use `template` when applicable.                                 |
| website section or landing page                                               | `office.generateWebsite`       | Use for site layout and source handoff.                         |
| demo or prototype                                                             | `office.generateDemo`          | Use for multi-screen or product story work.                     |
| image/media direction                                                         | `office.generateImageBrief`    | Use for briefs and direction, not final source unless extended. |
| HTML email                                                                    | `office.generateEmail`         | Use for email source and preview.                               |
| motion frame                                                                  | `office.generateMotionFrame`   | Use for motion concepts and still frames.                       |
| HTML-to-video / HyperFrames                                                   | `office.renderHyperframes`     | Use for render/video work.                                      |

If no workflow fits, call `office.listSkills`, choose the nearest existing workflow, and ask Ko only if the choice affects the output. Keep execution headless unless Ko explicitly asks for a live UI session.

## digital e-guide templates

For `office.generateDigitalEguide`, use:

| Template   | Use for                                                                             |
| ---------- | ----------------------------------------------------------------------------------- |
| `guide`    | source-grounded guides, paper explainers, Daily Deep Idea lessons, reusable walkthroughs |
| `spec`     | product specs, engineering specs, RFCs, architecture/design docs                    |
| `plan`     | implementation plans, operating plans, rollout plans, execution guides              |

Do not create a standalone `decision` template. Decisions belong inside `spec` and `plan`.

All three reader templates — `guide`, `spec`, and `plan` — must be rendered by the canonical TypeScript reader shell.

Use typed JSON/content input with `bun run wiki:render -- --template <spec|plan|guide> --input <content.json> --out <index.html>`.

Do not build a guide/spec/plan as plain HTML, plain Markdown, or a shell-less page.

Example:

```ts
await workspace.call({
  tool: "office.generateDigitalEguide",
  input: {
    name: "daily-deep-idea-2026-05-12-example",
    template: "research",
    prompt: "<full source content and design instructions>"
  },
  timeout: 600
})
```

Then execute the returned `workOrder` directly by creating or editing artifact files. Do not paste it into Open Design chat.

## planning mode

If Ko asks for a plan and does not specify the surface, stop and ask:

```text
Do you want this as a Canvas living plan or as an Open Design plan guide?
```

Use Canvas living plan for fast alignment, copy/paste execution, working checklists, Linear handoff, and active planning in chat.

Use Open Design plan guide when Ko wants a polished, durable, Tailnet-readable artifact with reader shell, `/design-wiki`, metadata footer, designed hierarchy, and easy navigation.

For Open Design plan mode, first run this exact batch read so the full source files are loaded into context:

```ts
await workspace.call({
  tool: "batch",
  input: [
    {
      tool: "mac.read",
      input: {
        path: "/Users/kokayi/Dev/opensaas/packages/consuelo-website/DESIGN.md"
      }
    },
    {
      tool: "mac.read",
      input: {
        path: "/Users/kokayi/Dev/opensaas/packages/consuelo-design/templates/digital-eguides/plan.md"
      }
    },
    {
      tool: "mac.read",
      input: {
        path: "/Users/kokayi/Dev/opensaas/packages/consuelo-design/templates/digital-eguides/reader-shell.md"
      }
    }
  ],
  timeout: 120
})

Do not read only the first page or first 200 lines. These files must be read in full before building the plan guide.


then

2. generate/build with `template: "plan"`
3. apply the shared reader shell
4. publish with `design.publish`
5. verify the artifact route, `/design-wiki`, and reader shell behavior

## specs

Use `template: "spec"`.

Specs should be durable, readable, Tailnet-published guide artifacts. Always apply the shared reader shell.

A good spec includes:

* problem/context
* goals and non-goals
* users or jobs-to-be-done
* proposed solution
* requirements
* decisions
* alternatives considered
* risks
* rollout
* validation
* open questions

For Open Design spec mode:

```ts
await workspace.call({
  tool: "batch",
  input: [
    {
      tool: "mac.read",
      input: {
        path: "/Users/kokayi/Dev/opensaas/packages/consuelo-website/DESIGN.md"
      }
    },
    {
      tool: "mac.read",
      input: {
        path: "/Users/kokayi/Dev/opensaas/packages/consuelo-design/templates/digital-eguides/spec.md"
      }
    },
    {
      tool: "mac.read",
      input: {
        path: "/Users/kokayi/Dev/opensaas/packages/consuelo-design/templates/digital-eguides/reader-shell.md"
      }
    }
  ],
  timeout: 120
})

Do not read only the first page or first 200 lines. These files must be read in full before building the spec guide.


then

2. generate/build with `template: "spec"`
3. apply the shared reader shell
4. publish with `design.publish`
5. verify the artifact route, `/design-wiki`, and reader shell behavior

## research guides and Daily Deep Idea

Use `template: "research"`.

Research bundle or source docs are factual truth. Final Markdown lesson/report is content truth. Digital e-guide is presentation truth.

Preserve:

* citations
* source titles, authors, dates, and links
* paper/source details
* limitations
* uncertainty
* section order when provided
* final question or prompt

Do not add research claims. Do not remove citations.

The research e-guide should feel like an interactive research mentor, not a styled article. Use the research template’s learning structure: source card, paper map, thesis/deep idea, ELI5/simple model, prediction-before-reveal, mechanism, evidence trail, limitations, intuition examples, memory card, and final question.

## reader shell for e-guides

All `research`, `spec`, and `plan` digital e-guides must use the shared reader shell.

This is not optional for readable guide artifacts.

Required reader shell features:

* fixed header with `/design-wiki`
* `#smooth-wrapper`
* `#smooth-content`
* GSAP ScrollSmoother
* tap-to-read navigation
* bottom-right back-to-top affordance
* resume-reading chip when saved progress exists
* vertical section completion rail for long guides
* compact metadata footer

The shell owns reading behavior. The selected template owns structure. `packages/consuelo-website/DESIGN.md` owns visual appearance.

Fixed controls must live outside `#smooth-wrapper` because ScrollSmoother transforms `#smooth-content`.

Use GSAP for reader shell motion. Respect `prefers-reduced-motion` by setting durations/smoothing to `0` while keeping the same code path.

## durable Tailscale publishing

Use `design.publish` for durable reading/review links.

Durable model:

```text
local artifact file/directory
  -> materialized archive copy
  -> managed archive server
  -> Tailscale Serve route
  -> /design-wiki entry
```

Do not publish important artifacts through throwaway local HTTP servers.

Publish like this:

```ts
await workspace.call({
  tool: "design.publish",
  input: {
    target: "<local artifact file or directory>",
    path: "/daily-deep-idea/2026-05-12-example",
    name: "Daily Deep Idea — Example",
    category: "daily-deep-idea",
    template: "research"
  },
  timeout: 120
})
```

Use the direct Tailnet HTTP link when Ko is reading on iPhone or HTTPS Tailscale has secure-connection issues.

`design.publish` should update `/design-wiki` automatically.

Verify:

* artifact URL returns `200`
* page title or h1 matches the artifact
* `/design-wiki` includes the artifact
* wiki entry opens the artifact
* reader shell markers exist for e-guides
* tap-to-read and back-to-top work when applicable

## hydration and Open Design UI

Hydration matters only when Ko explicitly wants project inspection, live collaboration, reusable Open Design project files, or `live: true` operation.

For normal headless delivery, durable artifact source + `design.publish` is enough.

When UI/project hydration is required:

1. upload editable source files
2. upload styles/source dependencies
3. upload required assets
4. upload README/handoff notes
5. upload ZIP/source bundle when useful
6. upload final exports
7. list project files and verify they are present
8. tell Ko to refresh the Design Files pane only after verification

Do not use hydration as an excuse to operate the Open Design chat by default.

## validation

Use browser validation for UI truth.

Common checks:

```ts
await workspace.call({
  tool: "browser.test",
  input: { url: "<preview-or-tailnet-url>", full: true },
  timeout: 300
})

await workspace.call({
  tool: "browser.eval",
  input: { js: "document.title" },
  timeout: 300
})

await workspace.call({
  tool: "browser.screenshot",
  input: { name: "artifact-preview", full: true },
  timeout: 300
})
```

For all research/spec/plan e-guides, verify reader shell behavior:

```text
ScrollSmoother is loaded
#smooth-wrapper exists
#smooth-content exists
window.__readerShell exists when implemented
tap-to-read moves the page
back-to-top appears after scroll and returns to top
/design-wiki links back to the archive
```

## PDFs

PDFs are exports. Editable source remains the source of truth.

When exporting PDFs:

1. export normal PDF from editable source
2. render the PDF to an image and inspect it
3. if colors shift in Preview/Quick Look/PDFKit, create flattened sRGB/color-safe PDF
4. keep editable source unchanged
5. report which file is editable source and which PDF is final/share-safe

Produce color-safe flattened PDFs when the design includes gradients, transparent PNGs, shadows, blending, or dark backgrounds.

## repo changes

Do not start a task branch for a one-off local design export unless Ko wants repo changes committed.

Start a task workflow when changing:

* workspace facade behavior
* Open Design templates
* reader shell behavior
* durable publish/archive/wiki behavior
* design system files
* website implementation files
* committed generated assets
* docs/tooling

Record acceptance criteria in `.task/workpad.md`.

## output report

For completed artifacts, report:

* what was created
* source file or project path
* durable Tailnet URL
* `/design-wiki` URL
* exported/downloadable files when relevant
* validation performed
* assumptions made
* blockers or remaining decisions

For e-guides, include whether reader shell behavior was verified.

For PDFs, include whether the PDF was visually checked and whether a color-safe/flattened PDF was produced.

## anti-patterns

Do not:

* send generated prompts into Open Design chat unless Ko explicitly asks
* rely on Open Design UI model/API keys for normal artifact generation
* make Ko manually operate Open Design unless he asks
* treat a prompt as the artifact
* treat PDF, PNG, MP4, or screenshot as the working source
* default to a flattened generated image for an artifact Ko will iterate
* create a new project when the task is clearly an iteration
* inspect the whole repo for a simple design/export task
* invent research claims or remove citations
* publish durable artifacts through temporary local HTTP servers
* forget `/design-wiki` verification
* let Open Design or design assets enter Railway deploy paths





`consuelo-design` is Consuelo's Bun-first design tooling facade over the vendored Open Design project. It is a tooling package, not a deployed product package.

## core decisions

- The canonical Consuelo design facade lives in `packages/workspace/scripts/office.ts`.
- The package-local script at `packages/consuelo-design/scripts/consuelo-design.ts` is a thin Bun passthrough to `packages/workspace/scripts/office.ts`.
- Human commands start from the repo root with `bun run consuelo-design ...`.
- Tool calls go through the typed workspace facade as `workspace office.*`.
- Open Design upstream remains vendored at `packages/consuelo-design/upstream/open-design`.
- `pnpm` is not a Consuelo-facing workflow tool. It is used only behind the Bun facade because upstream Open Design pins `pnpm@10.33.2`.
- `generate <workflow>` returns a headless work order by default. Only `generate <workflow> --live` or an explicit `live: true` input starts a live Open Design working session, and only that live path may set `project.pendingPrompt`.
- Open Design bundled design systems are reference skins only. Consuelo truth comes from our repo.
- `consuelo-design` must remain outside Railway deployment graphs.

## source of truth for design context

Base Consuelo design system context is exactly:

- `packages/consuelo-website/DESIGN.md`
- `areas/consuelo-design/AGENTS.md`

`get-design-system` must return only those files.

Website-specific context is attached only when starting website or motion-oriented sessions:

- `packages/consuelo-website/animations.md`
- `areas/website/AGENTS.md`

Do not include `animations.md` or website `AGENTS.md` in base `get-design-system`. They are workflow context, not global design-system truth.

## Open Design mental model

Open Design supports live design workspaces, but the Consuelo facade is headless by default.

The live UI loop is used only when Ko asks for a live session or the tool input passes `live: true`:

```text
start Open Design
  -> browser UI opens
  -> pick/use skill
  -> pick/use design system context
  -> create project/session
  -> agent works in the project folder
  -> artifact renders live
  -> Ko and the agent iterate together
```

Default `generate <workflow>` commands return a headless work order that agents can execute directly. Live `generate <workflow> --live` commands start or reuse Open Design, create or open a project, attach the right Consuelo prompt context, set `project.pendingPrompt`, and take Ko to the working session.


## workflow mapping

Use this mapping unless Ko changes it:

| Consuelo command | Primary Open Design skill | Notes |
| --- | --- | --- |
| `generate website` | `saas-landing` | Include `DESIGN.md`, `consuelo-design/AGENTS.md`, website `animations.md`, and website `AGENTS.md`. |
| `generate demo` | `web-prototype` | Use base Consuelo design context. |
| `generate image-brief` | `image-poster` | Use image/media surfaces when available; fall back to magazine/social/video prototype skills. |
| `generate digital-eguide` | `digital-eguide` | Use base Consuelo design context. |
| `generate email` | `email-marketing` | Use base Consuelo design context. |
| `generate motion-frame` | `motion-frames` | Include motion/website context. |
| `render hyperframes` | `hyperframes` | Include motion/website context and prepare for HTML-to-MP4 work. |

### digital e-guide templates

`generate digital-eguide` supports an optional `--template <research|spec|plan>` hint. The command still uses the `digital-eguide` Open Design skill; the template shapes the artifact inside the existing workflow.

Template meanings:

- `research`: research lessons, source-grounded explainers, paper walkthroughs, daily deep ideas.
- `spec`: product specs, engineering specs, RFCs, design docs, architecture proposals. Decisions are baked into the spec.
- `plan`: execution plans, implementation plans, rollout plans, operating plans. Decisions are an ongoing section inside the plan.

Templates live in `packages/consuelo-design/templates/digital-eguides/`. Do not add new facade commands for these variants. Pass a template hint when the artifact type is known; otherwise let the operator choose from the brief.

A prepared prompt in the Open Design UI is the operator handoff. Continue from that prompt, use the selected template, build or hydrate the editable artifact, verify the Design Files pane, preview, and publish only after the final URL renders the artifact.

## Railway boundary

No Railway-deployed package should depend on `consuelo-design`.

`bun run consuelo-design check` should include Railway exclusion. `railway:check` may exist as a lower-level command, but it is not a normal design operator command.

Keep `packages/consuelo-design` absent from Railway Dockerfile COPY lists unless Ko explicitly approves a deployment boundary change.

## upstream boundary

Do not edit vendored Open Design internals to encode Consuelo-specific behavior unless the task explicitly says to patch upstream behavior. Put Consuelo behavior in the facade.

Generated Open Design state belongs under ignored runtime paths such as `.od/`, `out/`, or `artifacts/`.


## Consuelo Wiki archive

Every `design.publish` call records the published artifact in the private Consuelo Wiki. Pass `--name` for the human-readable artifact title and `--template <research|spec|plan>` when the artifact is a templated e-guide so the Consuelo Wiki can filter it correctly. The Consuelo Wiki is automatically regenerated and published at `/design-wiki`.

The archive exposes both HTTPS Tailscale Serve URLs and direct tailnet HTTP URLs. Use the direct URL when iPhone Safari cannot open the HTTPS Serve link.

The publish path is durable. `design.publish` materializes local file or directory targets under the Open Design archive before registering the route, then points Tailscale Serve at the managed archive server. This avoids macOS path-serving restrictions and avoids per-artifact temporary servers. The Consuelo Wiki and every archived artifact are served by the same tailnet archive server.## publish concurrency guard

When publishing over an existing `/design-wiki` page, read the latest page/archive state first and pass the current page revision to publish:

```bash
bun run consuelo-design publish --target <artifact> --path <page-path> --base-version <currentVersionId>
```

Rules:

- Do not publish over an existing page without `--base-version`.
- Use `--base-revision` only as an alias for `--base-version`.
- Use `--force-publish` only when Ko explicitly asks for an intentional overwrite or recovery publish.
- If publish reports `stale design wiki publish rejected`, re-read the current page and rebase your typed changes before publishing.
- Prefer section/component-level typed changes so non-overlapping agent work can be recovered or merged from page versions.

### Context-Free Instruction Voice

Write every durable instruction as if the reader has no access to the conversation that produced it.

A good instruction should stand alone inside the artifact. It should name the rule, the standard, the failure mode, and the replacement behavior. The agent reading it should not need chat history, surrounding commentary, screenshots, or the author’s intent to know what to do.

#### Core Rule

Use **artifact voice**, not **patch voice**.

Artifact voice states the final rule.

Patch voice describes the editing operation that created the rule.

| ❌ Patch voice                                                        | ✅ Artifact voice                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------ |
| Replace the stale tooling section with this                          | Tooling Preference Order                                     |
| Add this snippet under communication style                           | Context-Free Instruction Voice                               |
| In our conversation, we decided agents should avoid vague references | Durable instructions must avoid vague references             |
| For this example, use `code.call` instead of `task.call`             | Use `code.call` for focused command and runtime evidence     |
| The thing above should be rewritten as a standalone rule             | Rewrite every durable rule so it stands without chat context |

The first line of a durable snippet should be the title or rule name, not an instruction to the human editor.

#### Required Shape

When writing a durable rule, use this shape:

```text
Rule: what to do.
Standard: what good behavior looks like.
Failure mode: what goes wrong.
Replacement behavior: what the agent should do instead.
```

Example:

```text
Rule: Durable instructions must be context-free.
Standard: The instruction names the subject, action, boundary, and expected behavior directly.
Failure mode: The instruction depends on phrases like “this,” “above,” “as discussed,” or “the current example.”
Replacement behavior: Rewrite the instruction with explicit nouns, stable labels, and final artifact prose.
```

#### Forbidden Context Phrases

Avoid phrases that point back to the conversation, editing session, or local screen state:

* “in our conversation”
* “like we talked about”
* “for this example”
* “the thing above”
* “this situation”
* “the current issue”
* “the previous section”
* “as mentioned earlier”
* “here”
* “above”
* “below”
* vague pronouns without explicit referents: “this,” “that,” “it,” “they,” “those”

Use explicit referents instead.

| ❌ Weak                                  | ✅ Strong                                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| This should use the new tool            | Repo validation should use `code.call` for focused command evidence                             |
| That section teaches the wrong behavior | The tooling section incorrectly teaches `task.call` as the command runner                       |
| It should be more direct                | The rule should state the required behavior in the first sentence                               |
| The above example is bad                | The patch-voice example is bad because it describes an edit operation instead of the final rule |

#### Prefer Stable Labels

Give every durable concept a stable name.

Use:

* rule names
* section titles
* tool names
* file paths
* command names
* trace IDs
* URLs
* exact failure labels
* explicit actor names: “agent,” “reviewer,” “reader,” “operator”

Avoid:

* “this”
* “that”
* “the thing”
* “the stuff”
* “the earlier point”
* “what we just said”

Stable labels let future agents inherit the instruction without reconstructing the original context.

#### Replacement Behavior

When an agent catches itself writing patch voice, convert it before presenting the snippet.

Use this conversion:

```text
Patch voice: what the editor should change.
Artifact voice: the final rule the artifact should contain.
```

Example:

```text
Patch voice: Replace the validation section with this.
Artifact voice: Validation Evidence Standard

Rule: Validation claims require command, output, and location evidence.
Standard: The agent reports the exact validation command, the result, and the trace or file path that proves it.
Failure mode: The agent says “validated” without evidence.
Replacement behavior: Report the validation packet: command, result, evidence, remaining risk.
```

The durable artifact should receive the artifact voice only.
