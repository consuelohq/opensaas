# Windows platform support

Consuelo OS supports native x64 Windows hosts beginning with Windows 10 22H2 (build 19045), Windows 11, Windows Server 2022, and Windows Server 2025. WSL is not an installation target. Unsupported operating-system builds and CPU architectures fail preflight before Consuelo directories, runtime state, Bun, or service registration are changed.

## Installation boundary

The Windows bootstrap is `scripts/bootstrap.ps1`. It downloads the Windows release artifact into a temporary directory, verifies its required SHA-256 digest, and only then extracts or executes release content. It reuses Bun when present or invokes Bun's official PowerShell installer and persists the resolved absolute `bun.exe` path. Service startup never depends on an interactive user's `PATH`.

Service registration and removal require an elevated PowerShell window. Normal status, start, stop, restart, lifecycle update, rollback, repair, and diagnostics do not require continuing administrator access. When PowerShell policy blocks the bootstrap, use a process-scoped bypass rather than changing machine policy:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\bootstrap.ps1
```

## Runtime and service model

The logical Consuelo home remains `~/.consuelo/`; on Windows it maps to `%USERPROFILE%\.consuelo` unless explicitly overridden. Non-default profiles, alternate drives, and paths containing spaces are supported.

Consuelo runs as the non-interactive `ConsueloOS` Windows Service Control Manager service under `NT AUTHORITY\LocalService`. The service has:

- automatic boot startup;
- a restricted service SID;
- bounded recovery restarts;
- a service DACL that grants the installing user query/start/stop rights without granting service reconfiguration;
- a filesystem ACL limited to the installing user, Local System, and `NT SERVICE\ConsueloOS`;
- a Windows Job Object configured to terminate the complete Bun process tree when the service stops or fails.

The service configuration stores only absolute executable and runtime paths. Authorization material remains in Consuelo-owned state under the protected home and is not placed in SCM arguments, service environment registration, or the registry.

## Shared lifecycle ownership

Windows does not implement a separate updater. `scripts/lifecycle.ts` remains the single authority for signed release manifests, bundle verification, activation, health acceptance, update, rollback, repair, retention, and ownership-safe uninstall. Windows activation uses directory junctions, and digest bundle identities are mapped to Windows-safe release directory names without changing their signed manifest identity.

Default uninstall removes the Consuelo-owned service and runtime-owned paths while preserving workspace membership, node identity, provider authorization state, and user-modified content. Destructive node or user-content removal remains explicit through the shared lifecycle flags.

## Authentication and diagnostics

Device authorization is browser-first through native PowerShell `Start-Process`. When browser launch is unavailable, the installer prints the complete verification URL and code and attempts to copy the full URL with `clip.exe`.

Use:

```powershell
bun run windows-platform -- status --json
bun run windows-platform -- diagnostics --json
bun run lifecycle -- status --json
```

Service stdout and stderr are written under `%USERPROFILE%\.consuelo\node\logs`. The platform diagnostics report the resolved Bun executable, service host, service configuration, active runtime junction, and log directory.

## Release and signing boundary

The task-owned CI lane compiles and behaviorally validates the Windows service host on `windows-2025`. Public distribution, Authenticode signing, timestamping, installer reputation, and final release-artifact assembly remain the downstream distribution and signing gate. An unsigned locally built service host is suitable only for CI and development validation.

## Real-device checkpoint

Do not install or restart Consuelo OS on an operator workstation as part of automated validation. After the signed Windows artifact exists, the human checkpoint is an elevated PowerShell run on a disposable supported Windows machine:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\bootstrap.ps1 -BundleUrl <signed-artifact-url> -BundleSha256 <sha256>
```

Expected result: the archive digest verifies, Bun is installed or reused, `ConsueloOS` reaches `RUNNING`, `http://127.0.0.1:46321/health` returns the Consuelo health envelope, and a default uninstall followed by reinstall preserves workspace and user-owned state.
