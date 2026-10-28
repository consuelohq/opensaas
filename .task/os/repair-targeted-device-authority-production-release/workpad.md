# repair targeted device authority production release

branch: `task/os/repair-targeted-device-authority-production-release`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/1961
started: 2026-08-14

## acceptance criteria

- [x] Preserve full `target=os` fail-closed behavior; do not skip workspace-edge/D1 in the full release.
- [x] Add a narrow Device Authority-only release selector that uses existing `os:release -- --device-auth-only` isolation and still syncs the provisioning secret.
- [x] Prove current source uses canonical logo-only/no stripe while production still serves the old monogram/text/stripe.
- [x] Determine Device Authority canary topology before any provider mutation: no separate canary Worker/hostname exists today.
- [x] Canary does not exist, so stop before Cloudflare mutation under the user’s canary-only boundary.
- [x] Focused RED->GREEN workflow test, strict review, and full verify passed before publish.

## plan

1. Inspect current release workflow, Worker config, live production DOM, and canary topology.
2. Pin workflow-level RED coverage for a targeted Device Authority release; keep full OS semantics unchanged.
3. Implement only release-selector wiring, run GREEN, strict review, and verify.
4. Publish through `stream/os`; use only a genuine canary deployment surface.
5. Keep paid-plan/Stripe checkout in a separate follow-up task.

## current status

- OS control facade is healthy after the user's `consuelo restart`.
- `stream/os` is current with `main` and includes the existing-account launcher/internal-route repair.
- Live `https://os.consuelohq.com/` still has `.brand-monogram`, visible Consuelo OS text, and `.consuelo-stripes`; current source has only `.brand-logo` and no stripe.
- Previous full OS release stopped before Device Authority on workspace-edge D1 authorization (Cloudflare 7403).
- Current production workflow exposes only `target=os`; existing CLI already supports `--device-auth-only`.
- Formal OS runtime canary exists, but Device Authority has only `consuelo-os-device-authority` on `os.consuelohq.com/*`; no Worker canary is configured.
- Validation: workflow test 3/3, production-release MCP security 2/2, YAML target parse green, strict review 0 blockers, full verify publish-valid.

## Test-first contract

- Manual release must explicitly select Device Authority only, call `bun run os:release -- --device-auth-only`, preserve full `os` => `bun run os:release`, and keep provisioning-secret sync after deploy.
- Extend `packages/workspace/tests/website-deploy.test.js`; expected RED is missing target/branching in current workflow.
- No Cloudflare mutation until GREEN/review/verify and a real canary target are proven.

## files changed

- `.github/workflows/consuelo-production-release.yaml`
- `packages/workspace/tests/website-deploy.test.js`

## key decisions

- Release repair and Stripe/pricing UX are separate tasks because billing adds checkout/webhook/idempotency/entitlement state.
- Do not broaden `CLOUDFLARE_OS_RELEASE_API_TOKEN` or suppress the D1 failure here.

## issues and recovery

- `stream.sync` advertised a repo field the wrapper rejected; retry without it ran. Its temporary verifier lacked OS dependencies, but fresh stream context confirms 0 behind main and task is synced.
- Cloudflare `deployment.list` returned malformed output; authenticated Cloudflare context is healthy.

## workspace-owned: files read

- `.github/workflows/consuelo-os-runtime-promote.yaml`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/docs/distribution/release-channels.md`

## workspace-owned: validation evidence

- 2026-08-14 20:54:38 `review.run`: passed — OK
- 2026-08-14 20:54:55 `verify`: passed — OK
