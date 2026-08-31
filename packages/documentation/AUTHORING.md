# Consuelo OS documentation authoring

The public documentation is organized around ten user intents, in this order: **Start, Connect, Nodes, Tools, Skills, Steering, Memory, Observe, Secure, and Reference**.

Each top-level section should answer one human question:

| Section | Reader question |
| --- | --- |
| Start | How do I get one working Consuelo setup? |
| Connect | How do I connect agents, apps, and services? |
| Nodes | Where does Consuelo run, and how is work routed across local and cloud nodes? |
| Tools | What operations can an agent call? |
| Skills | How do I reuse or create a way of working? |
| Steering | How do I tell agents how to work before they act? |
| Memory | How does useful work state carry forward? |
| Observe | What ran, where did it run, and what happened? |
| Secure | Who can do what, through which boundary? |
| Reference | What is the exact command, schema, field, URL, or error contract? |

Do not create a second canonical explanation because a concept touches two sections. Put the mental model in the section that owns the reader question, then link to it. For example, Nodes owns local, cloud, default, explicit, and task routing; Secure owns the trust boundary around those routes; Observe owns the evidence that explains a completed route.

Office specifications, old docs, design reports, and research artifacts are directional inputs. They are not proof of current product behavior. Before publishing a material claim, verify it against current code, focused tests, and a real runtime path where practical.

## Write for a person who is trying to do something

Treat prose as attention design. The reader should always know what they are about to learn, where they are in the explanation, and what decision or action to carry forward.

For a complex page, use this shape when it helps:

1. **Promise** — say what the reader will understand or accomplish.
2. **Map** — give the simple mental model or landmarks before dense detail.
3. **Mechanism** — explain how it actually works.
4. **Evidence** — show the command, state, result, trace, example, or failure that proves the model.
5. **Package** — end with the next useful move or the rule worth remembering.

A useful paragraph often follows `Claim → Mechanism → Evidence → Consequence`.

The first sentence should orient the reader rather than describe the documentation itself. Prefer “A node is a computer or managed runtime that can do work for your workspace” over “This page explains nodes.”

Explain the simple model first, then add exact product vocabulary. Do not hide a useful concept behind implementation jargon, and do not remove the precise term the reader will see in the product or an error message.

Use headings and signposts when they reduce cognitive load. Do not add labels merely for visual structure.

## Separate learning, tasks, explanation, and reference

A page can contain more than one mode, but one mode should lead:

- **Guided learning** helps a new user build the mental model.
- **Task guidance** gives the shortest correct sequence to reach a result.
- **Explanation** answers why the system behaves this way and names important boundaries.
- **Reference** states exact commands, fields, schemas, states, and errors without trying to teach the product from scratch.

Do not put a protocol dump in the middle of an onboarding journey. Link to Reference when the reader needs exact contracts.

## Task page contract

A task page should state what the reader will accomplish, prerequisites, the shortest correct path, exact commands or settings when needed, the expected result, verification, common failures, and the relevant reference page.

Keep one action or decision per numbered step. Put prerequisites before the sequence. State the expected result after an action when the user could otherwise wonder whether it worked.

## Claim ledger

Each writing PR keeps a claim ledger with these fields:

| Claim | Public page | Source code | Tests | Runtime verification | Directional artifact | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

Allowed status values are `shipped`, `preview`, `planned`, `unresolved`, and `deprecated`. Public pages may describe shipped behavior and clearly labeled preview behavior. Planned and unresolved behavior must not be written as available.

When the UI exposes a preview of a future action, state both truths. Example: a plan picker can be available while the final provisioning action is still disabled. Never collapse those into “the feature exists” or “the feature does not exist.”

## Move or remove obsolete docs deliberately

When a canonical page moves, remove the obsolete MDX file and preserve the old URL in `src/lib/legacy-redirects.mjs`. Do not keep a duplicate page whose only purpose is to point somewhere else.

When an old page contains claims that are no longer part of the product, either migrate the still-valid material into the current information architecture or remove it behind an appropriate redirect. Hidden, unnavigated pages are still public pages and still require current evidence.

## Skill Templates

`src/content/docs/build/skills/bundled/` is a generated review and install surface for bundled OS skills. The per-skill page contract is intentionally minimal: enable/remove commands, the exact registry description, then the exact `SKILL.md` body.

Do not paraphrase or add editorial usage, boundary, or verification sections to those pages. Update the source skill, regenerate with `bun run generate:skill-templates`, and let `tests/build.test.ts` prove the preview remains exact.
