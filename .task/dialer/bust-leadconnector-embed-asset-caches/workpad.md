# Bust LeadConnector embed asset caches

branch: `task/dialer/bust-leadconnector-embed-asset-caches`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1778/bust-leadconnector-embed-asset-caches
github pr: https://github.com/consuelohq/opensaas/pull/1778
started: 2026-08-04

## acceptance criteria

- [x] Built `index.html` references `main.js` and `main.css` through deterministic content-versioned URLs.
- [x] Rebuilding unchanged source produces the same version tokens; changing an asset changes its token.
- [ ] Public `/admin` and `/overlay` load the queue-first bundle instead of the stale canonical asset.
- [x] LeadConnector tests, typecheck, build, strict review, and publish verify pass.
- [x] No carrier call or GHL record mutation occurs.

## plan

1. Add a red build contract for content-versioned asset references.
2. Update the existing embed generator only; do not change product UI.
3. Validate determinism, full LeadConnector package, review, and verify.
4. Merge to stream, redeploy Worker, update Marketplace CSS, and prove the authenticated GHL iframe loads the new asset.

## current status

- Implementation and deterministic package validation complete. Strict review is clean. Pending verify, merge, Worker redeploy, Marketplace CSS read-back, and authenticated GHL proof.

## files changed

- `packages/lead-connector/scripts/build-embed.ts`
- `packages/lead-connector/src/embed/embed-build.contract.test.ts`
- task workpad/metadata

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-04 23:11:19 `review.run`: passed — OK
- 2026-08-04 23:11:19 `review.run`: passed — OK
- 2026-08-04 23:11:59 `verify`: passed — OK

## key decisions

- Use content-derived query tokens rather than timestamps so builds remain deterministic.
- Keep filenames stable for the Worker asset binding; only the HTML references need cache-busting.

## Test-first contract

- Behavior: generated `index.html` references both assets with SHA-derived query tokens matching their exact bytes.
- Test: build the embed, parse the index references, and compare each token to the generated asset digest.
- Focused red command: `bun test packages/lead-connector/src/embed/embed-build.contract.test.ts`.
- Expected red: current index references `./main.js` and `./main.css` without tokens.

## validation summary

- Red: focused build contract received unversioned `./main.css` and `./main.js`.
- Green: focused build contract 1/1.
- LeadConnector full suite: 89/89, 755 assertions.
- Typecheck passed.
- Two consecutive embed builds produced byte-identical `index.html` and identical asset tokens.
- Strict review: zero findings.

## notes for ko

- Cloudflare's active Worker version changed, but the canonical `/main.js` and `/main.css` URLs remained cache HITs for the previous asset bytes.
- Unique query URLs already returned the queue-first bundle, proving the Worker upload itself was correct.
- The generated shell now derives a 16-hex SHA-256 prefix independently for CSS and JS and appends it as `?v=`. Stable filenames and the Worker asset binding remain unchanged.

## improvements noticed

- The deployment verification workflow should always parse the deployed HTML shell and fetch its referenced asset URLs; checking Worker version plus canonical asset paths is insufficient.

## issues and recovery

- Worker version `0773f01c-164c-4b8c-a01c-dd5470da31c2` deployed successfully, but canonical asset URLs returned the prior ETags/hashes. Diagnosis used a unique query URL to prove the new bytes were present.
- This hotfix changes only the deterministic build shell; no product or telephony logic is modified.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```
