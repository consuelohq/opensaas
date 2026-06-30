# Rewrite root README for Consuelo OS

## Goal
Replace the stale root `README.md` with a correct GitHub-facing README for Consuelo OS and the `opensaas` monorepo.

## Acceptance criteria
- Remove old OpenSaaS/Twenty framing from the main README.
- Explain Consuelo OS as the gateway/runtime for workspaces, agents, tools, scripts, sites, traces, and artifacts.
- Include the public install command: `curl -fsSL https://install.consuelohq.com/os | bash`.
- Link to the OS package at `packages/os` and mention that `opensaas` is the monorepo.
- Cover local and cloud modes, MCP, ChatGPT, Cloudflare, Caddy reverse proxy, portability, tools, scripts, sites, tracing, and artifacts.
- Use plain human prose. Avoid AI writing patterns: no em/en dashes, no promotional puffery, no rule-of-three cadence for decoration, no fake significance language.
- Push to `stream/docs` for review.

## Evidence read
- `README.md`: stale root README still references `packages/twenty-website`, old CRM/dialer package table, old OpenSaaS wording, and AGPL/Twenty license text.
- `packages/os/package.json`: `@consuelo/os`, `install:local`, `doctor`, `artifacts`, `media`, Cloudflare workspace edge scripts, tool manifest generation.
- `packages/os/README.md`: OS runtime, get_steering/call portal, local state, installer commands, hosted install command, artifacts, doctor/traces.
- `packages/os/SCRIPTS.md`: public install command, local bootstrap, hosted `/os` route, portless note, workspace scripts.
- `packages/workspace/README.md`: MCP server, ChatGPT connector, Cloudflare tunnel/WAF, local SQLite tracing fallback.
- `packages/os/cloudflare/workspace-edge/README.md`: Cloudflare edge routing for workspace hostnames, D1/R2, local authoring plus cloud publishing.
- `packages/consuelo-docs/get-started/*`: local/cloud, first skill, first artifact, agent connection language.

## License note
Ko says the project is MIT licensed. The root `LICENSE` file still contains AGPL text from the old fork. This task is scoped to `README.md`; the license file mismatch should be reviewed separately unless Ko wants the license file changed in this task.

## Test decision
Docs-only README rewrite. No runtime test needed. Validation will check links, stale forbidden phrases, no em/en dashes, Markdown fence balance, and repo paths referenced by the README.

- 2026-06-30 02:09:58 write: `.task/docs/rewrite-root-readme-for-consuelo-os/workpad.md`

## files changed

- `README.md`

## workspace-owned: files changed

- `README.md`

## workspace-owned: activity log

- 2026-06-30 02:09:58 fs.write: `.task/docs/rewrite-root-readme-for-consuelo-os/workpad.md`
- 2026-06-30 02:10:40 write: `README.md`
- 2026-06-30 02:10:40 fs.write: `README.md`
- 2026-06-30 02:12:48 fs.write: `.task/docs/rewrite-root-readme-for-consuelo-os/workpad.md`

## README validation
- README rewrite completed.
- Static README validation passed: no em/en dashes, no curly quotes, balanced code fences, relative links exist, required concepts present, stale Twenty/OpenSaaS/AGPL README terms removed.
- Humanizer audit found only false-positive heading hits for proper nouns: `Consuelo OS`, `MCP`, and `ChatGPT`. No AI vocabulary cluster, no chatty artifacts, no negative parallelism, no boldface, no emojis.
- Diff inspected with `git.diff`; changed surface is root `README.md` plus task metadata/workpad.

## Open review note
The README now states MIT licensing per Ko's instruction. The root `LICENSE` file still contains AGPL text inherited from the old fork. This PR intentionally leaves `LICENSE` unchanged so Ko can review the license-file change explicitly.

- 2026-06-30 02:12:48 append: `.task/docs/rewrite-root-readme-for-consuelo-os/workpad.md`

## workspace-owned: validation evidence

- 2026-06-30 02:16:00 `review.run`: passed — OK
- 2026-06-30 02:16:01 `review.run`: passed — OK
- 2026-06-30 02:18:57 `verify`: failed — COMMAND_FAILED
- 2026-06-30 02:18:58 `verify`: failed — COMMAND_FAILED

## workspace-owned: test selection

- changed files: `.task/docs/rewrite-root-readme-for-consuelo-os/current.json`, `.task/docs/rewrite-root-readme-for-consuelo-os/session.json`, `.task/docs/rewrite-root-readme-for-consuelo-os/workpad.md`, `.task/tasks/docs/rewrite-root-readme-for-consuelo-os.json`, `README.md`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed files are docs or task metadata

## Final validation note
- Scoped review passed with zero issues from this README change.
- Full verify failed on broad existing repo test debt after selecting no README-specific suites.
- README static validation passed, so this task is being pushed as an approved docs-only review change.
