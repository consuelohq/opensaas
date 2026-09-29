# add public windows installer and platform-aware landing command

branch: `task/os/add-public-windows-installer-and-platform-aware-landing-command`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2439
started: 2026-09-10

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/consuelo-website/src/lib/install-command.ts`
- `packages/consuelo-website/tests/install-command.test.ts`

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-website/DESIGN.md`
- `packages/consuelo-website/package.json`
- `packages/consuelo-website/src/components/home/HomeHero.astro`
- `packages/consuelo-website/src/data/home-content.ts`
- `packages/consuelo-website/tests/install-command.test.ts`
- `packages/consuelo-website/tests/website-structure.test.js`
- `packages/os/README.md`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/bootstrap.ps1`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/lib/distribution/release-channel.schema.json`
- `packages/os/scripts/lib/distribution/release-channels.ts`
- `packages/os/tests/hosted-release-worker-contract.test.ts`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/os-release-install.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## acceptance criteria

- [ ] `https://install.consuelohq.com/os.ps1` serves a native Windows PowerShell bootstrap that installs the current stable `windows-x64` release with no required arguments, so `irm https://install.consuelohq.com/os.ps1 | iex` is the canonical public Windows command.
- [ ] The hosted Worker resolves the stable Windows bundle from the existing release pointer, validates its platform/architecture/object-key/SHA shape, and fails closed if release metadata is malformed or the Windows bundle is absent.
- [ ] The existing `/os` shell installer and `/os/releases/*` release proxy keep their current behavior.
- [ ] The release operator publishes and verifies both `/os` and `/os.ps1` from the same Worker deployment.
- [ ] The public website hero shows the PowerShell command on Windows and the curl command on macOS/Linux, and Copy always copies the command currently displayed.
- [ ] Script/operator docs describe the Windows endpoint and command.
- [ ] Focused tests, review/verify, live installer checks, and desktop/mobile browser verification pass before completion.

## plan

1. Add RED contracts for the generated Worker `/os.ps1` route and platform-aware website command selection/copy behavior.
2. Extend the hosted installer Worker to bundle the maintained `bootstrap.ps1`, resolve the stable `windows-x64` release pointer at request time, validate it, and return an argument-bound PowerShell script.
3. Add a tiny website platform-selection helper and wire the hero display/copy behavior to it without changing the existing visual composition.
4. Update OS/workspace script docs, run focused GREEN validation, then review + verify and promote through `stream/os`.
5. Deploy the hosted installer and website, then independently verify `/os`, `/os.ps1`, the stable Windows bundle binding, and rendered landing-page behavior.

## Test-first contract

behavior under test: the hosted installer Worker exposes `/os.ps1` as a no-argument native Windows bootstrap backed by the current stable `windows-x64` release, while the website hero selects that PowerShell command only on Windows and copies the selected command.
existing local pattern: `packages/os/tests/hosted-release-worker-contract.test.ts` executes generated Worker source against an in-memory R2 fixture; `packages/consuelo-website/tests/website-structure.test.js` protects hero command/copy source contracts.
new or changed tests: extend the hosted Worker contract with stable Windows manifest materialization, HEAD/method/error cases, and malformed-release fail-closed behavior; add platform-selection tests for Windows vs macOS/Linux and update the hero structure contract to require selected-command copy behavior.
focused red command: run the hosted release Worker Vitest file plus the website command/structure tests after destructive-literal preflight.
expected red failure: generated Worker has no `/os.ps1` route or Windows bootstrap input; website exposes only one static curl command and copy always writes that constant.
no-test waiver: not applicable.

- 2026-09-10 01:59:56 append: `.task/os/add-public-windows-installer-and-platform-aware-landing-command/workpad.md`

## workspace-owned: files changed

- `packages/consuelo-website/src/lib/install-command.ts`
- `packages/consuelo-website/tests/install-command.test.ts`

## workspace-owned: activity log

- 2026-09-10 01:59:56 fs.write: `.task/os/add-public-windows-installer-and-platform-aware-landing-command/workpad.md`
- 2026-09-10 02:02:14 write: `packages/consuelo-website/tests/install-command.test.ts`
- 2026-09-10 02:02:14 fs.write: `packages/consuelo-website/tests/install-command.test.ts`
- 2026-09-10 02:02:23 apply-patch: `packages/consuelo-website/tests/website-structure.test.js`
- 2026-09-10 02:02:35 apply-patch: `packages/os/tests/hosted-release-worker-contract.test.ts`
- 2026-09-10 02:03:54 write: `packages/consuelo-website/src/lib/install-command.ts`
- 2026-09-10 02:03:54 fs.write: `packages/consuelo-website/src/lib/install-command.ts`
- 2026-09-10 02:04:23 apply-patch: `packages/consuelo-website/src/components/home/HomeHero.astro`
- 2026-09-10 02:04:30 apply-patch: `packages/workspace/scripts/os-release-install.ts`
- 2026-09-10 02:05:02 apply-patch: `packages/workspace/scripts/os-release-install.ts`
- 2026-09-10 02:05:12 apply-patch: `packages/workspace/scripts/os-release-install.ts`
- 2026-09-10 02:05:22 apply-patch: `packages/workspace/scripts/os-release-install.ts`
- 2026-09-10 02:05:33 apply-patch: `packages/workspace/scripts/os-release-install.ts`
- 2026-09-10 02:05:48 apply-patch: `packages/workspace/scripts/os-release-install.ts`
- 2026-09-10 02:06:31 apply-patch: `packages/consuelo-website/tests/install-command.test.ts`
- 2026-09-10 02:06:31 apply-patch: `packages/consuelo-website/tests/install-command-source.test.js`
- 2026-09-10 02:07:05 apply-patch: `packages/os/tests/hosted-release-worker-contract.test.ts`
- 2026-09-10 02:07:29 apply-patch: `packages/os/tests/hosted-release-worker-contract.test.ts`
- 2026-09-10 02:07:49 apply-patch: `packages/workspace/scripts/os-release-install.ts`
- 2026-09-10 02:11:38 apply-patch: `packages/os/tests/hosted-release-worker-contract.test.ts`
- 2026-09-10 02:12:00 apply-patch: `packages/workspace/scripts/os-release-install.ts`
- 2026-09-10 02:14:41 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-09-10 02:15:48 fs.write: `.task/os/add-public-windows-installer-and-platform-aware-landing-command/workpad.md`

## implementation evidence

- RED established before product edits: generated Worker had no Windows route and the website platform helper did not exist.
- Windows endpoint design: the same `consuelo-os-install` Worker serves `/os.ps1`; on each request it loads `channels/stable.json`, verifies the Ed25519 channel signature with the baked public trust map, selects exactly one `windows-x64` bundle, validates immutable object-key and digest shape, and binds that bundle URL/SHA into the maintained `bootstrap.ps1`.
- Tampering a signed fixture manifest after signing returns HTTP 503; unsigned/malformed release metadata is never handed to PowerShell.
- Public PowerShell wrapper self-elevates through normal UAC when required by downloading the same `/os.ps1` endpoint to a temp file and relaunching `powershell.exe -Verb RunAs`; elevated execution re-resolves the signed stable release.
- Website defaults to the existing curl command during SSR, switches to the PowerShell command for Windows platform strings at client runtime, and Copy writes the same selected command shown to the user.
- Focused Worker tests: 4/4 pass, including valid signature, tamper rejection, HEAD, and POST method guard.
- Focused website command tests: 8/8 pass across Windows, macOS, Linux, and unknown platform cases plus hero source/copy wiring.
- Test-selection regression: focused public-Windows-installer rule selected exactly three critical suites and explicitly suppressed the broad OS package test; selector regression passed.
- Generated test registry refreshed: 2693 test files / 2608 mapped / 80 rules; website test inventory increased from 11 to 13.
- Actual Astro validation (not the earlier malformed Bun invocation): `astro check` passed with 0 errors / 0 warnings / 23 existing hints; `astro build` passed with 24 pages built.
- Canonical `os-release-install` dry-run passed with both bootstrap sources, `/os` + `/os.ps1`, R2 bucket `consuelo-os-releases`, and Wrangler dry-run accepted the generated Worker.
- Local `pwsh` is not installed, so no local PowerShell parser was available; generated Worker contracts plus native Windows CI/live endpoint validation remain the cross-platform proof path.
- Existing `website-structure.test.js` has unrelated stale assertions; temporary edits to it were fully reverted. New isolated tests cover this task without carrying legacy-test churn.

- 2026-09-10 02:15:48 append: `.task/os/add-public-windows-installer-and-platform-aware-landing-command/workpad.md`

## workspace-owned: validation evidence

- 2026-09-10 02:16:32 `review.run`: passed — OK
- 2026-09-10 02:16:45 apply-patch: `packages/workspace/scripts/os-release-install.ts`
- 2026-09-10 02:17:16 `review.run`: passed — OK
- 2026-09-10 02:18:09 `verify`: passed — OK
