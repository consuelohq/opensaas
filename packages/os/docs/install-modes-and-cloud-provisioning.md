# Install modes and cloud provisioning

Status: **findings and proposal, not implemented.**

## The naming problem

`curl -fsSL https://install.consuelohq.com/os | bash -s -- --mode cloud` does not install anything.
It prints "Consuelo cloud is handled by the Consuelo team" and opens the contact page.

`--mode cloud` means *Consuelo-managed hosting*, a sales path. It does not mean *install onto a
cloud machine*. Those are different axes and they are sharing one word, so the obvious command for
"install OS on my VM" is the one guaranteed not to.

`workspace-control-plane-contract.md` already models this correctly under the node model:

```text
Role                Location
  home                this-device
  member              self-hosted
                      consuelo-hosted
```

Three locations. The installer exposes two modes and maps the wrong one to the interesting case.

**Proposal:** rename to match the contract the rest of the system already uses.

| today | proposed | behavior |
|---|---|---|
| `--mode local` | `--location this-device` | install here (currently macOS-gated, see below) |
| `--mode cloud` | `--location consuelo-hosted` | contact page, unchanged |
| — | `--location self-hosted` | install onto this machine as a member node |

Keep `--mode` as a deprecated alias. The point is that `self-hosted` stops being unreachable.

## The Darwin gate

`bootstrap.sh:1757` calls `check_mac_prerequisites`, which hard-fails on anything but Darwin:

```
error: Consuelo OS local bootstrap currently supports macOS. Detected: Linux.
```

This is the only thing blocking Linux from the public installer. Everything beneath it is already
cross-platform:

- `scripts/lib/platforms/linux.ts` — systemd user units, 32 references
- `scripts/lib/windows-platform.ts` — Windows service control
- both are imported and wired in `lifecycle.ts` (lines 421 and 427)
- CI runs **Debian 12**, **native linux**, and **clean OCI host** jobs, and they pass
- `docs/linux-platform.md` and `docs/windows-platform.md` specify the contracts
- stable publishes a `linux/x64` bundle

So the platform work described in `plan.md` §10.2 is largely done. The installer just refuses to
call it. Replacing the blanket Darwin check with a per-platform prerequisite check is the whole job
for Linux.

## What actually provisions a cloud node today

Not the installer. The GCP path is instance metadata: a `startup-script` that prepares the data
disk, creates an unprivileged `consuelo` service user, installs bun and cloudflared, seeds trusted
release keys, runs `lifecycle.ts install`, and starts `managed-cloud-node-enroll.ts`.

`lifecycle.ts install` is the Linux-capable entry point and bypasses `bootstrap.sh` entirely. That
is why the cloud node can run on Linux while the public installer says Linux is unsupported.

### Two things the original script got wrong

**1. A second release trust anchor.** It pulled the runtime from a private GCS bucket signed with
its own key (`task-os-cloud-*`), so cloud nodes trusted a *different* release authority than every
other node. That is the most security-relevant divergence found in this area. Rewritten to install
from the public signed channel using the same key baked into the public installer.

**2. A pinned digest.** It hardcoded one bundle digest, so a reboot silently reinstalled a stale
build — in practice a `1.0.0-dev` build months behind stable, enrolled in a workspace that had been
abandoned. Rewritten to resolve the bundle from the channel manifest at run time.

### Gap worth knowing

Nothing outside `bootstrap.sh` seeds `runtime/trusted-release-keys.json`, so `lifecycle.ts install`
fails closed with `MANIFEST_SIGNATURE_INVALID` on a machine the installer never touched. The
startup script now writes it, but any future non-bootstrap install path will hit the same wall. The
trust anchor should be seeded by the lifecycle installer itself rather than by whichever script
happens to run first.

## Recommended order

1. Replace the Darwin gate with per-platform prerequisite checks. Linux support exists and is
   CI-tested; only the gate is missing.
2. Rename the mode flag to `--location` with the three contract values.
3. Move trusted-key seeding into `lifecycle.ts install`.
4. Only then consider folding GCP provisioning into the installer. It is genuinely different work —
   disk, service user, tunnel, enrollment — and belongs behind an operator command rather than a
   flag on the public curl installer.

Item 3 is small and removes a whole class of "works on a Mac, fails everywhere else" failure.
