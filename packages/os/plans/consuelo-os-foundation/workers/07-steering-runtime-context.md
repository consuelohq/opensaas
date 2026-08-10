# Worker 07: Installed Skills, Node Identity, and Update Summary in Steering

## Dependencies

Begin after Worker 06 defines the compact update-summary interface and Worker 25 defines the safe node-summary contract. Do not duplicate either parser.

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` in full and read the repo/OS skills. Start from `stream/os-distribution`. Work with concurrent changes and preserve unrelated edits.

The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory for this task.

## Objective

Make `os.get_steering` accurately describe the installed OS without injecting stale doctrine, secrets, unselected skills, or the full update plan.

## Confirmed issues to re-verify

- Installed `skills/skills.json` exists but is not read by `getSteering()`.
- `decision.md` is excluded from runtime steering but is still copied by installation and required by tests.
- Runtime identity is mostly environment presence and paths, not safe node/workspace/channel context.
- Multiple manifest surfaces may expose stale tool lists.

## Required steering sections

1. Safe runtime identity:
   - opaque node ID or safe short ID;
   - node display name;
   - platform and architecture;
   - selected channel and installed runtime-bundle version;
   - workspace ID/slug/host;
   - whether this is the workspace default node.
2. Supported steering Markdown:
   - `system_prompt.md` first;
   - explicit user-added Markdown files from `~/Consuelo/Steering/` in deterministic order;
   - never `decision.md` or legacy `steering.md`.
3. Installed skill index:
   - read the installed registry from the active Consuelo home;
   - include only selected/installed skills;
   - compact name, title, description/trigger, status, and entrypoint metadata;
   - do not inline SKILL.md files.
4. Core tool manifest from one canonical authority.
5. Compact update summary:
   - available count;
   - conflict count;
   - checked timestamp;
   - current/target version;
   - no full update items.

When update count is positive, add a concise instruction to mention the count at the end of responses without reading the plan unless asked.

Honor typed notification preferences: disabled or currently snoozed notices must not appear. Product updates never overwrite user steering.

## Installer cleanup

Stop seeding `decision.md` into new installations. Migrate existing installs by leaving a user-modified file alone but removing an unchanged Consuelo-managed copy. Update tests accordingly.

Do not merely delete assertions; replace them with behavioral assertions that `decision.md` is absent from fresh installs and absent from steering.

## Owned files

- `packages/os/scripts/os.ts` steering assembly.
- A focused steering-context helper if useful.
- Steering/install tests.
- The bounded `install-state.ts` changes required for `decision.md` ownership.
- Canonical-manifest selection only if proved necessary; broad manifest regeneration belongs to integration work.

## Forbidden scope

- Do not include secrets, raw environment maps, tunnel tokens, provider tokens, or sensitive filesystem data.
- Do not dump all tools or skills into prose.
- Do not add `decision.md` under another name.
- Do not redesign the entire steering manual.

## Required tests

- Preserve `os-get-steering-trace.test.ts`, `os-raw-steering.test.ts`, `install-state.test.ts`, `skills-registry.test.ts`, `mcp-gateway.test.ts`, and `security-gateway.test.ts` as regression contracts. Add characterization coverage before reorganizing steering assembly.
- Installed selected skills appear; unselected skills do not.
- Custom installed skill metadata appears safely.
- Missing/corrupt skills registry fails safely with a diagnostic rather than crashing bootstrap.
- Node/workspace/channel fields come from typed state, not hard-coded env assumptions.
- Multiple safe node summaries are sourced from Worker 25's authenticated registry contract; a powered-off node is reported offline rather than erased.
- Update summary is compact and the full plan is absent.
- Zero updates adds no response reminder.
- Disabled and snoozed notification preferences add no response reminder.
- User steering is loaded from the visible tree and remains unchanged across runtime updates.
- `decision.md` is not installed or returned.
- Secret fixtures are redacted/absent.
- Steering remains deterministic and within an explicit size budget.

Do not rewrite existing suites to match the new implementation. The intentional product change is narrow: fresh installs no longer seed `decision.md`, so replace only assertions that required that file with behavioral assertions proving it is absent. All unrelated steering, trace, manifest, OAuth, MCP, redaction, and gateway behavior must remain unchanged.

## Completion output

Provide before/after steering structure, measured size, tests, migration behavior for existing `decision.md`, and any canonical-manifest debt deferred to integration.
