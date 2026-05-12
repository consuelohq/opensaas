# add design publish tailscale serve links

branch: `task/workspace-agents/add-design-publish-tailscale-serve-links`
stream: `stream/workspace-agents`
task pr: https://github.com/consuelohq/opensaas/pull/373
started: 2026-05-11

## acceptance criteria

- [x] Add a generic `design.publish` workspace tool for publishing design artifacts through private Tailscale Serve.
- [x] Use one persistent Tailscale host with unique per-artifact paths.
- [x] Support publishing any local target URL/file/directory, not just daily lessons.
- [x] Support a named local Open Design target through `portless`, with `design.localhost` as the recommended name.
- [x] Return a stable tailnet URL and local target details.
- [x] Keep Funnel/public exposure out of scope; default is private tailnet Serve only.
- [x] Add CLI command, typed facade schema/manifest, generated docs/types, and script docs.
- [x] Validate dry-run, Tailscale status/serve command shape, focused tests/audit/review, and publish.

## implementation plan

1. Read repo standards, consuelo-design facade, manifest/schema/docs patterns, and local Tailscale/portless CLI help.
2. Add `publish` command to `packages/workspace/scripts/consuelo-design.ts`.
3. Expose it as `design.publish` in the typed workspace tool manifest with its own schema.
4. Document usage in `packages/workspace/SCRIPTS.md` and regenerate docs/types.
5. Validate with dry-run and non-destructive Tailscale/portless command shape smoke checks.
6. Review and publish.

## files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/TOOLS.md`
- `packages/workspace/scripts/consuelo-design.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/workspace/tooling/tool-manifest.json`


## key decisions

- Use Tailscale Serve, not Funnel. Links are private to devices connected to Ko's tailnet.
- Keep a persistent host from `tailscale status --json`, then create unique paths such as `/daily-deep-idea/<slug>` or `/research-packet/<slug>/packet`.
- `design.publish` is generic and accepts a direct `target` URL/file/directory or a `portlessName`.
- `design.localhost` is the recommended local Open Design service name. When `portlessName` ends with `.localhost`, the tool treats it as exact and targets `https://design.localhost:1355` instead of asking `portless get`, because `portless get design.localhost` can add worktree-specific prefixes.
- For non-`.localhost` portless names, `design.publish` resolves the target with `portless get <name>`.
- For Open Design projects, the target can be the local `projectUrl` returned by `consueloDesign.generateDigitalEguide`, or the agent can publish the stable `design.localhost` service at a unique artifact path.
- No actual `tailscale serve` mutation was run during validation; dry-run plus local CLI/status inspection proved command construction without changing Ko's existing Serve config.

## notes for Ko

- Local Tailscale DNS name currently reports `picassos-mac-mini.tail38ed59.ts.net.` from `tailscale status --json`; the tool derives this dynamically and strips the trailing dot.
- `tailscale serve --help` supports `--bg` and `--set-path`, which is the needed persistent-host / unique-path mechanism.
- `portless` is installed at `/opt/homebrew/bin/portless`; the tool does not add it as a project dependency.
- If `https://design.localhost:1355` does not resolve locally, Open Design still needs to be run or aliased through portless under `design.localhost`.

## improvements noticed

- `decideNext` evidence state appears polluted by previous task validation events; ignored for this targeted implementation after direct file reads.
- The generated facade snapshot suite still reports obsolete snapshots even when tests pass; this is existing suite noise.

## errors or blockers

- No existing Tailscale publish tooling was found, only sandbox guardrails around not killing/disabling `tailscaled`.
- A long patch command was interrupted by chat input; inspected the partial state and completed the patch safely.
- `portless get design.localhost` was not used as the final default because it can infer worktree-specific names; exact `.localhost` names are now treated as literal local service hosts.

## validation

- Read `AGENTS.md` and full `CODING-STANDARDS.md`.
- Read `packages/workspace/scripts/consuelo-design.ts`, `packages/workspace/tooling/tool-manifest.json`, `packages/workspace/scripts/lib/facade/schemas.ts`, and `packages/workspace/SCRIPTS.md`.
- Inspected `tailscale serve --help`; confirmed `--bg` and `--set-path` support.
- Inspected `tailscale status --json`; confirmed tailnet hostname is available under `Self.DNSName`.
- Inspected `tailscale serve status --json`; existing Serve config was read only.
- Inspected `portless --help`; confirmed named `.localhost` URLs and `portless get` support.
- `bun --check packages/workspace/scripts/consuelo-design.ts`: passed.
- `bun --check packages/workspace/scripts/lib/facade/schemas.ts`: passed.
- `bun packages/workspace/scripts/consuelo-design.ts publish --portless-name design.localhost --path /daily-deep-idea/2026-05-12-prospect-theory --dry-run --json`: passed and returned `https://<tailscale-host>/daily-deep-idea/2026-05-12-prospect-theory` targeting `https://design.localhost:1355`.
- `bun packages/workspace/scripts/consuelo-design.ts publish --target /tmp/research/packet.md --path /research-packet/2026-05-12-prospect-theory/packet --dry-run --json`: passed.
- `bun run generate-docs`: passed.
- `bun run generate-types`: passed.
- `bun packages/workspace/scripts/tool-runner.ts design.publish '{"portlessName":"design.localhost","path":"/daily-deep-idea/example","dryRun":true}'`: passed; output URL is `https://<tailscale-host>/daily-deep-idea/example`.
- `workspace checkFiles` for `consuelo-design.ts` and `schemas.ts`: passed.
- `workspace audit { scripts: true }`: passed, 48 documented / 48 actual.
- `cd packages/workspace && bun run test tests/facade/facade.test.ts`: passed, 444 tests. Vitest still reports 242 obsolete snapshots.
- `git diff --check`: passed.
- First `review.run` found async error-handling findings in new publish helpers; patched local try/catch wrappers and reran review successfully.
- `review.run --base origin/main --noTests`: passed with no findings after patch.
- `workspace verify` timed out through the connector, but direct task-worktree `node packages/workspace/scripts/verify.js --base origin/main --no-db --json` passed and wrote a task-local stamp for this branch.

- 2026-05-12 00:05:05 write: `.task/workpad.md`