# Fix existing workspace node route provisioning

branch: `task/security/fix-existing-workspace-node-route-provisioning`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1488/fix-existing-workspace-node-route-provisioning
github pr: https://github.com/consuelohq/opensaas/pull/1488
started: 2026-07-14

## acceptance criteria

- [x] Hosted reinstall preserves the existing Google-account workspace membership.
- [x] Consuelo, not the customer, owns the Cloudflare provisioning credential.
- [x] Production OS releases sync a dedicated least-privilege provisioning token into the device-authority Worker before deployment.
- [x] Provisioning failures retain the failed provider operation while redacting credentials.
- [ ] Release the fix and complete a clean hosted install on the remote MacBook Air.
- [ ] Validate the installed local service, connector tunnel, and central MCP path end to end.

## plan

1. Reproduce the hosted install against the current production release.
2. Trace device approval, workspace reuse, route registration, and Cloudflare provisioning.
3. Add failing contracts for production credential wiring and diagnostic preservation.
4. Implement the smallest credential-sync and error-chain fixes.
5. Validate, publish through `stream/security`, release, and repeat the clean remote install.

## current status

- Implementation and focused tests are green. Publishing is blocked until the GitHub production environment contains `CLOUDFLARE_OS_PROVISIONING_API_TOKEN`.

## files changed

- `.github/workflows/consuelo-production-release.yaml`
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- `packages/os/tests/os-device-authority-architecture.test.ts`
- `packages/workspace/tests/website-deploy.test.js`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- Reproduced `workspace_route_setup_failed` after successful Google approval on the clean remote MacBook Air.
- Confirmed the deployed Worker has a Cloudflare token secret but the current credential cannot complete connector provisioning.
- Confirmed the production GitHub environment does not yet contain the dedicated provisioning secret.

## workspace-owned: validation evidence

- Red: production release workflow contract failed before secret synchronization was added.
- Red: Cloudflare provisioning contract failed because the wrapper dropped the failed operation.
- Green: `packages/workspace/tests/website-deploy.test.js` passed 3/3.
- Green: `packages/os/tests/cloudflare-provisioning-contract.test.ts` passed 26/26 with gateway contracts enabled.
- Green: `packages/os/tests/os-device-authority-architecture.test.ts` passed 24/24.
- Green: `packages/os/tests/os-device-authority-worker.test.ts` passed 23/23 with gateway contracts enabled.
- Green: OS syntax/type gate passed.
- Green: production workflow YAML parsed and secret synchronization precedes OS release.
- Green: strict `review.run --base HEAD` reported zero blocking issues.
- Green: `verify --base HEAD` produced a publish-valid stamp; focused tests were run separately because registry selection found zero suites.
- 2026-07-14 18:20:48 `review.run`: passed — OK
- 2026-07-14 18:21:16 `review.run`: passed — OK
- 2026-07-14 18:21:30 `verify`: passed — OK
- 2026-07-14 18:22:06 `verify`: passed — OK

## key decisions

- Keep customer onboarding independent of Cloudflare accounts and credentials.
- Use a dedicated platform provisioning token rather than broadening or reusing the Worker deployment token.
- Preserve the existing multi-node registration model; the reproduced failure is platform provisioning, not workspace membership selection.

## notes for ko

- Add `CLOUDFLARE_OS_PROVISIONING_API_TOKEN` to GitHub environment `consuelo / production`; never paste the token into chat or commit it.

## improvements noticed

- The production release workflow now makes the Worker runtime secret dependency explicit instead of relying on manually managed dashboard state.

## issues and recovery

- The GitHub CLI environment-name shortcut encoded the slash incorrectly; the encoded REST endpoint confirmed the secret inventory safely by name only.

---

## publish checklist

```bash
bun run task:push -- --message "fix(security): provision existing workspace node routes" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: test selection

- changed files: `.github/workflows/consuelo-production-release.yaml`, `.task/security/fix-existing-workspace-node-route-provisioning/current.json`, `.task/security/fix-existing-workspace-node-route-provisioning/session.json`, `.task/security/fix-existing-workspace-node-route-provisioning/verify.json`, `.task/security/fix-existing-workspace-node-route-provisioning/workpad.md`, `.task/tasks/security/fix-existing-workspace-node-route-provisioning.json`, `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`, `packages/os/tests/cloudflare-provisioning-contract.test.ts`, `packages/os/tests/os-device-authority-architecture.test.ts`, `packages/workspace/tests/website-deploy.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
