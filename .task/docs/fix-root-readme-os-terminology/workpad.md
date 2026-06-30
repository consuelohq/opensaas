# Fix root README OS terminology

## Goal
Correct the root README after the first rewrite.

## Acceptance criteria
- Keep the logo at the top and use the website SVG logo.
- Do not mention `packages/workspace` or describe the workspace package in the public README.
- Keep OS workspaces as a product concept, but avoid confusing them with implementation package names.
- Say the OS runtime lives in `packages/os`.
- Opening description should say file system, not local files.
- Keep the hosted install command and repo-local install command, but remove dry-run install guidance.
- Split hosted routing from security. Do not imply Cloudflare routing and Caddy gateway security are the same layer.
- Use tool categories, not tool families.
- Explain tool bundles as workflow/runbook bundles of tools plus just-in-time instructions.
- Link to the tools docs and generated tool catalog.
- Keep prose plain and human. No em or en dashes.

## Evidence read
- `README.md`: current stream README still mentions `packages/workspace`, uses `local files`, includes a dry-run install block, and combines Cloudflare hosted routing with Caddy security language.
- `packages/consuelo-website/src/components/Logo.astro`: site logo component points at `/images/logo/logo.svg`, but that current file is absent in the repo.
- `packages/consuelo-website/public/logo.svg`: existing website SVG logo asset, 200 by 200, used as the README logo path.
- `packages/consuelo-docs/tools/overview.mdx`: public tools docs page.
- `packages/consuelo-docs/os/tools/overview.mdx`: defines tools, scripts, skills, manifests, and artifacts.
- `packages/os/TOOLS.md`: generated human-readable tool catalog, with a tool index and tools by category.
- `.task/os/add-public-gateway-security-tests/workpad.md`: security model covers local-only server boundary, generated auth, signed requests, replay resistance, scoped tokens, Caddy config, policy/audit, and install security files.
- `.task/security/align-os-mcp-ingress-provisioning-boundary/workpad.md`: public install must not call Cloudflare WAF/IP-list/Rulesets provisioning or require user Cloudflare credentials. Platform/admin provisioning is separate.
- `.task/security/cloudflare-tdd-contracts/workpad.md`: Cloudflare routing, D1 registry, OAuth device onboarding, connector bootstrap, and tunnel launch are separate from local generated auth/Caddy files.
- `packages/os/scripts/lib/security-gateway.ts`: generated auth, scoped app/agent tokens, signed gateway requests, route scopes, audit, and Caddy rendering live in OS.
- `packages/os/scripts/lib/install-state.ts`: generated security files include `security/generated/auth.json` and `security/generated/Caddyfile`.

## Validation plan
Docs-only README edit. Run static README checks, inspect diff, run scoped review without tests.

## workspace-owned: validation evidence

- 2026-06-30 02:53:27 `review.run`: passed — OK
- 2026-06-30 02:53:27 `review.run`: passed — OK

## Validation
- Static README validation passed: logo path exists, no `packages/workspace`, no `openworkspace`, no `workspace MCP server`, no `local files`, no dry-run install text, no tool-family wording, tool categories present, tool bundles explained, security split present, relative links valid, fences balanced, no em or en dash, no curly quotes.
- Diff inspected with `git.diff`: only README plus task metadata/workpad changed.
- Scoped review passed with zero issues from this README change. Pre-existing eslint/typecheck debt remains outside this docs-only edit.


## Final change summary
Updated README to keep the public story on Consuelo OS and remove the internal package reference. Added the website logo, changed the intro to file system, removed the dry-run install block, and kept the runtime pointer to packages/os.

Separated hosted routing from security. Hosted routing now covers Cloudflare-backed published surfaces. Security now covers the OS gateway, generated files, scoped credentials, signed requests, audit records, and Caddy config.

Changed tool families to tool categories. Added a separate tool bundles section for workflow and runbook bundles that include tools plus just-in-time agent instructions.

## Publish summary
Changed README.md and validated the README constraints. Scoped review passed with zero issues from this change.

- 2026-06-30 03:12:14 append: `.task/docs/fix-root-readme-os-terminology/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-30 03:12:14 fs.write: `.task/docs/fix-root-readme-os-terminology/workpad.md`
<<<<<<< Updated upstream
=======
- 2026-06-30 03:13:42 fs.write: `.task/docs/fix-root-readme-os-terminology/workpad.md`

## Ready for review
What changed: README.md now has the website logo, points readers to packages/os, removes the internal package reference, removes the dry-run install block, and replaces local files with file system.

Why: Ko clarified that the internal implementation package should not be part of the public README, and that OS workspaces are a product concept separate from implementation details.

Validation: static README checks passed for logo path, relative links, fenced code blocks, prohibited old terms, package reference removal, dry-run removal, and dash/quote rules. Scoped review passed with zero issues on the diff.

Follow-up: the root LICENSE file still contains inherited license text and was not changed in this README terminology pass.

- 2026-06-30 03:13:42 append: `.task/docs/fix-root-readme-os-terminology/workpad.md`
>>>>>>> Stashed changes
