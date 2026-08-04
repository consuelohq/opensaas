# deploy merged leadconnector dialer to ghl sandbox

branch: `task/dialer/deploy-merged-leadconnector-dialer-to-ghl-sandbox`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1775/deploy-merged-leadconnector-dialer-to-ghl-sandbox
github pr: https://github.com/consuelohq/opensaas/pull/1775
started: 2026-08-04

## acceptance criteria

- [x] Build only from product source at merged main commit `57267e0b246a2960c37ebb78afd573e5f2ac6e6f`.
- [x] LeadConnector tests, typecheck, and embed build pass.
- [x] Generated JS/CSS contain the new call-operations and transcript markers before deployment.
- [x] Deploy the existing Cloudflare Worker while preserving `DIALER_SERVER_ORIGIN`, then verify `/`, `/admin`, `/overlay`, `/health`, static assets, and API proxying.
- [x] Confirm the sandbox custom menu uses the Cloudflare `/admin` URL with microphone permission.
- [x] Read back the installed generated Marketplace Custom JS/CSS artifacts, then verify the Contacts/Opportunities launcher opens `/overlay`.
- [x] Leave the sandbox dialer loaded for Ko without initiating a carrier call.

## plan

1. Prove the task source is the exact merged-main tree and run package validation/build.
2. Inspect generated artifacts for unmistakable new UI markers and record asset hashes.
3. Verify Cloudflare identity/bindings, deploy with the existing command, and probe shell/proxy routes.
4. Verify or correct the sandbox custom menu and update the two Marketplace fields from generated artifacts.
5. Use the existing authenticated browser profile to verify both GHL surfaces and leave the dialer ready for manual testing.

## current status

- Deployment task branch bootstrap commit `f4f2256cd4f510b1e6500bed6c987f0202883013` has no product diff; its parent is exact merged main commit `57267e0b246a2960c37ebb78afd573e5f2ac6e6f`.
- The exact merged source is live in Cloudflare Worker version 16 (`4e6501ef-6b03-4cce-a1fa-399e6a9cc611`) and Railway deployment `22169d81-9ed6-4c59-9810-bbdd134c4646`.
- The sandbox custom page and both launcher surfaces are Ready, and the sidebar dialer is left loaded for Ko.

## files changed

- `.task/dialer/deploy-merged-leadconnector-dialer-to-ghl-sandbox/workpad.md` (operational evidence only)

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- Regenerated `packages/lead-connector/dist/embed-app`; no stale `dist` output was trusted.
- Deployed the existing `consuelo-lead-connector-embed` Worker with `bun run --cwd packages/lead-connector deploy:embed`.
- Confirmed Marketplace Custom JS module `01KYGP2NDCSJBA9C3T34PSWD9D` already contained canonical equivalents of the generated inline-script wrapper and CSS, so no no-op Marketplace save was forced.
- Found the new overlay failing only on authenticated `/v1/calls/active` and `/v1/calls`; deployed exact merged source to Railway `dialer-server` and reverified both as 200.
- Verified Contacts and Opportunities each create exactly one native launcher and lazily create the `/overlay` iframe.
- Exercised the embedded search without a GoHighLevel page reload, narrowing the visible list to the matching CRM record, then restored the full list.

## workspace-owned: validation evidence

- `bun test packages/lead-connector/src`: 81 passed, 0 failed, 721 expectations.
- `bun run --cwd packages/lead-connector typecheck`: passed.
- `bun run --cwd packages/lead-connector build:embed`: passed.
- Generated `main.js`: 218722 bytes, SHA-256 `c19574a39811b1000962547cbaa093fa33a1252d065672db471ff1e60aa65d55`; markers include `Call operations`, `Call transcript`, `call-operations`, and `transcript-panel`.
- Generated `main.css`: 12095 bytes, SHA-256 `fea89a350dc1a0bf5a552e70fcfaf301643b1bd3f7bcb4e63736fccd83593d18`; markers include `.call-operations`, `.call-card`, and `.transcript-panel`.
- Live `/main.js` and `/main.css` byte counts and SHA-256 hashes exactly match the regenerated local assets.
- Worker version 16 serves `/`, `/admin`, `/overlay`, and `/health` successfully; `/health` reports the dialer server healthy, and a `/v1/*` probe returns the backend's structured auth response.
- `DIALER_SERVER_ORIGIN` remained present before and after Worker deployment; the `ASSETS` binding remained present.
- The sandbox menu iframe is `https://consuelo-lead-connector-embed.kokayi-90b.workers.dev/admin` with `clipboard-write;microphone;` permission.
- The visible admin iframe loaded `/main.js` and `/main.css` from the Cloudflare origin with 200 responses and rendered `.call-operations`, `Active calls`, and `Call history`.
- Fresh Contacts and Opportunities overlays each reached Ready: embed session 201; contacts, opportunities, pipelines, active calls, and call history all 200.
- Railway exact-source staging verified 218 source/config files with zero hash mismatches, immutable Yarn install passed, the dialer-server compiled successfully, and deployment `22169d81-9ed6-4c59-9810-bbdd134c4646` reached SUCCESS using `packages/dialer-server/Dockerfile`.

## key decisions

- The Worker is the visible iframe application and Railway remains API-only.
- Actual shell routes are `/`, `/admin`, and `/overlay`; the sandbox menu must not be repointed to a stale `/embed/` example.
- Marketplace receives the generated inline-script HTML and generated CSS, never raw TypeScript.

## notes for ko

- The sandbox sidebar dialer is loaded on the new Operator workspace and is ready for manual calling tests.
- No Call button was clicked and no carrier call was initiated.

## improvements noticed

- `bun run --cwd packages/lead-connector test` changes cwd while tests assume repo-root paths; the meaningful repo-root invocation is `bun test packages/lead-connector/src`.
- The Railway facade currently loses long-running upload calls near 30 seconds. A clean 6.2 MB exact-source context completed through the same typed provider surface; full 123.6 MB uploads timed out before creating a build.

## issues and recovery

- The already-open sidebar iframe initially retained the old browser DOM after Worker version 16 was deployed. One reload proved the source, Worker, menu, and Cloudflare layers were current; the stale layer was the in-memory iframe instance.
- The first live new overlay then exposed a separate backend mismatch: signed session and CRM resource requests succeeded, while authenticated call-operation routes returned 404. Railway's prior deployment predated the main merge. Exact merged source deployment `22169d81-9ed6-4c59-9810-bbdd134c4646` fixed the mismatch; the same requests now return 200.
- Interrupted full-context Railway uploads were automatically removed and never became healthy traffic. The successful deployment replaced the prior runtime only after Railway reported SUCCESS.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-04 21:09:25 apply-patch: `.task/dialer/deploy-merged-leadconnector-dialer-to-ghl-sandbox/workpad.md`

## workspace-owned: files read

- `packages/lead-connector/dist/embed-app/consuelo-lead-connector-click-to-call.css`
- `packages/lead-connector/dist/embed-app/consuelo-lead-connector-click-to-call.marketplace.html`

- 2026-08-04 21:55:09 apply-patch: `.task/dialer/deploy-merged-leadconnector-dialer-to-ghl-sandbox/workpad.md`