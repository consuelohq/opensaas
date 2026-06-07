# Test-Driven Agent Work

Consuelo OS uses test-driven agent work to keep user intent intact through long tasks, compaction, handoffs, and future follow-up work.

For ordinary software, test-driven development usually means writing a failing automated test, writing the minimum implementation that passes, then refactoring while the test suite stays green. For agent work, the same loop becomes broader: capture the user's intent as executable or checkable assertions before changing the system, then keep those assertions visible in the workpad and runnable in validation.

This document is the operating contract for agent TDD inside Consuelo OS.

## Why this matters

Agents forget details when a task is long. Context gets compacted. A later agent may inherit only a summary. A user may give ten decisions in one message, and only seven make it into the final artifact. A publish may succeed while the important intent was dropped.

Test-driven agent work exists to prevent that.

The rule is simple:

```text
If the user says something important, turn it into a durable assertion before doing the work.
```

Assertions can be code tests, document checks, grep checks, schema checks, browser checks, screenshot checks, or manual acceptance criteria in the workpad. The right form depends on the task. The core requirement is that future agents can verify the intent without re-reading the entire original conversation.

## Vocabulary

Use these words consistently in OS tasks, docs, and workpads.

| Term | Meaning in Consuelo OS |
| --- | --- |
| Intent assertion | A checkable statement derived from user intent. |
| Red | The assertion exists and fails against the current state. |
| Green | The assertion passes after the implementation or document change. |
| Refactor | Clean up implementation, wording, shape, or structure without breaking the assertions. |
| Yellow / Amber | A known unresolved or partially validated assertion that is explicitly tracked and not hidden. |
| Acceptance test | A check from the user's point of view, focused on externally visible behavior or output. |
| Specification by example | A concrete example that doubles as specification and validation. |
| Living documentation | Documentation that stays useful because it is tied to checks, examples, and current behavior. |
| Workpad contract | The required task record that preserves assertions, evidence, blockers, and handoff state. |

## Agent TDD loop

Use this loop for code, docs, specs, pages, Office artifacts, traces, dashboards, tools, and generated documents.

### 1. Capture intent

Extract user intent into short assertions.

Good assertions:

- name the object being changed
- say what must be true when done
- include exact phrases when wording matters
- include non-goals when the user rejects a path
- distinguish current work from future work
- preserve user terminology unless the user asks for a rename

Example:

```text
- OS spec title must be "Consuelo OS Spec".
- "OS portal" must be replaced with "OS server".
- The V1 work map may stay as a map, but task execution items must live in the checkbox ledger.
- The ledger must include fs commands, docs, Office, collaborative artifact editing, traces, diffs, OS Cloud gateway, and state/artifacts/database-connected pages.
```

### 2. Write red checks

Before editing, create the checks that currently fail.

Red checks can be:

- a unit test
- an integration test
- a CLI smoke test
- a markdown/document assertion script
- a JSON schema assertion
- a browser or screenshot assertion
- a grep check for required or forbidden language
- a workpad checklist item marked `red`

For docs-only work, a small assertion script is often better than no test.

Example:

```js
const text = readFileSync("packages/os/docs/test-driven-agent-work.md", "utf8");
assert(text.includes("Intent assertion"));
assert(text.includes("Red"));
assert(text.includes("Green"));
assert(text.includes("Yellow / Amber"));
assert(text.includes("workpad contract"));
```

### 3. Make it green

Change the code, docs, or artifact until the checks pass.

Do the minimum needed to satisfy the assertions first. Do not use the green phase as permission to broaden scope invisibly.

### 4. Refactor safely

Clean up structure after green:

- move helpers to the correct file
- simplify wording
- remove duplicate sections
- convert prose into typed data
- split long assertions into named checks
- update related docs or manifests

Run the same checks again after refactor.

### 5. Record evidence

The workpad must record:

- what red checks were created
- what command showed failure
- what changed
- what command showed green
- what still remains yellow/amber
- what future agent should do next

## Red / Green / Yellow contract

Use this status model in task workpads and long-running OS work.

### Red

Red means an assertion exists and currently fails.

Red is good. It proves the task has captured intent before implementation.

A red entry should include:

```text
RED: <assertion name>
Expected: <what should be true>
Observed: <what is currently wrong>
Command/evidence: <test command, grep, screenshot, or manual check>
```

### Green

Green means the assertion passes.

A green entry should include:

```text
GREEN: <assertion name>
Command/evidence: <passing command or verified artifact>
Output/version/path: <result location>
```

### Yellow / Amber

Yellow means the assertion is important but not fully resolved in this task.

Use yellow instead of silently dropping intent.

Valid yellow cases:

- blocked by missing credentials or local-only access
- requires product decision from Ko
- depends on another branch or stream
- requires a live environment not available to the agent
- is intentionally deferred to a follow-up task
- can only be manually verified for now

A yellow entry should include:

```text
YELLOW: <assertion name>
Why not green: <blocker or deferral reason>
Next owner/task: <who or what should continue it>
Risk if ignored: <what breaks if nobody follows up>
```

Never mark a task green while hiding yellow assertions.

## Workpad contract

Every non-trivial OS task should leave a workpad that a future agent can use without the original chat.

Required sections:

```markdown
# Workpad

## User intent assertions
- [ ] <assertion>
- [ ] <assertion>

## Red checks
- RED: <assertion> — <command/evidence>

## Green checks
- GREEN: <assertion> — <command/evidence>

## Yellow / Amber checks
- YELLOW: <assertion> — <why not green, next owner/task>

## Files changed
- <file> — <why>

## Validation commands
- <command> — <result>

## Handoff notes
- <what future agents must preserve>
```

The workpad is not a diary. It is the executable memory of the task.

## Assertion levels

Use the cheapest assertion that can actually catch the failure.

| Level | Best for | Example |
| --- | --- | --- |
| Phrase assertion | Required or forbidden wording | `grep -q "OS server" spec.md` and no `OS portal`. |
| Structure assertion | Required sections or fields | JSON has `sections`, `components`, `ledger`. |
| Behavior assertion | CLI, API, or server behavior | `bun ./scripts/os.ts call ...` returns expected JSON. |
| Browser assertion | UI affordances or rendered output | nav exists, button works, mobile table does not overflow. |
| Screenshot assertion | Visual regressions | Roadmap-style shell still matches mobile baseline. |
| Manual assertion | Human product judgment | Ko confirms the page feels like roadmap baseline. |

Prefer automated checks for anything likely to regress.

Use manual assertions only when taste, product judgment, or live credentials are unavoidable.

## How to turn a long user message into assertions

When Ko gives a long message, first extract the intent into groups.

Example grouping:

```text
Naming:
- Rename OS portal to OS server.

Task ledger:
- Move execution items from V1 map into checkbox ledger.
- Keep completed historical work checked off.

Office:
- Rename wiki/design artifact direction toward Office.
- Add user/team Office pages.
- Preserve typed reader components.

Traces:
- Connect dashboard to live data.
- Deploy internally on Cloudflare.
- Add per-user/team traces pages.

Diffs:
- Treat as additive stream-native PR surface.
- Do not block V1 on matching Graphite.
```

Then create at least one check per group.

For a generated spec or Office artifact, save the assertion script next to the source JSON or in `/tmp` during the task, then record its path in the workpad.

## Using this for specs and Office artifacts

For typed specs, plans, guides, dashboards, and docs:

1. Put the source truth in typed JSON or Markdown.
2. Put user intent into an assertion script or checklist.
3. Render the artifact.
4. Validate the renderer markers.
5. Run intent assertions against the rendered artifact and source.
6. Publish with `--base-version` when replacing an existing page.
7. Record current version, artifact path, and assertion evidence.

Office artifacts should not rely on a successful publish alone. A page can publish successfully while still losing user intent. The intent assertions are the guardrail.

## Surviving compaction and handoff

Surviving compaction is an explicit design goal for OS agent work.

Compaction-safe tasks require durable state.

Before a long task risks compaction, the agent should write or update:

- the workpad assertions
- source file paths
- current branch and task session
- failing/passing command history
- unresolved yellow items
- publish/version IDs
- rollback paths or backups

A future agent should be able to continue by reading the workpad and running the listed checks.

## When not to use TDD

A no-test waiver is acceptable only for:

- pure typo fixes
- mechanical formatting
- comments that do not affect generated docs
- emergency repair where test setup is broken
- truly trivial docs-only edits

Even then, the workpad should say why no red/green check was useful and what validation replaced it.

## Good default for OS docs work

For an OS documentation task, use this minimum bar:

```text
1. Write intent assertions from Ko's request.
2. Add or update the Markdown doc.
3. Add a small doc assertion test when the doc captures product/process rules.
4. Run node --check on the assertion test if it is JavaScript.
5. Run the assertion test.
6. Run any relevant docs/audit/check command.
7. Record green/yellow evidence in the workpad.
```

## Product rule

TDD is not only for code.

For Consuelo OS, TDD is how agents preserve intent.

When the task is long, the assertion list is the memory. When context compacts, the workpad is the handoff. When another agent resumes, green checks prove that the important parts survived.
