import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

const readBootstrap = () =>
  readFileSync(join(process.cwd(), 'scripts', 'bootstrap.sh'), 'utf8');

function runBootstrapFunction(
  source: string,
  name: string,
  input: string,
  options: { env?: NodeJS.ProcessEnv } = {},
): string {
  const fn = extractShellFunction(source, name);
  const result = spawnSync(
    '/bin/bash',
    [
      '-c',
      `set -euo pipefail
${fn}
${name}`,
    ],
    {
      input,
      encoding: 'utf8',
      env: {
        ...process.env,
        BASH_ENV: '/dev/null',
        ENV: '/dev/null',
        ...options.env,
      },
    },
  );
  if (result.error) {
    throw new Error(`${name} failed to start: ${result.error.message}`);
  }
  if (result.status === null) {
    throw new Error(
      `${name} terminated by signal ${result.signal ?? 'unknown'}`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      result.stderr || `${name} failed with status ${result.status}`,
    );
  }
  return result.stdout;
}

function createSedOnlyPath(): string {
  const directory = mkdtempSync(join(tmpdir(), 'consuelo-bootstrap-sed-'));
  const sedPath = ['/usr/bin/sed', '/bin/sed'].find((candidate) =>
    existsSync(candidate),
  );
  if (!sedPath) {
    throw new Error('sed binary not found for fallback redaction test');
  }
  symlinkSync(sedPath, join(directory, 'sed'));
  return directory;
}
function extractShellFunction(source: string, name: string): string {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => line === `${name}() {`);
  if (start === -1) {
    throw new Error(`missing shell function: ${name}`);
  }
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index] === '}') {
      return lines.slice(start, index + 1).join('\n');
    }
  }
  throw new Error(`unterminated shell function: ${name}`);
}

function runPathSetup(
  bootstrap: string,
  options: { home: string; path: string },
) {
  const script = [
    'set -euo pipefail',
    extractShellFunction(bootstrap, 'has_unsafe_shared_write'),
    extractShellFunction(bootstrap, 'resolve_cli_symlink_target'),
    extractShellFunction(bootstrap, 'is_safe_immediate_cli_link_dir'),
    extractShellFunction(bootstrap, 'find_immediate_cli_link_dir'),
    extractShellFunction(bootstrap, 'ensure_command_on_path'),
    'log() { :; }',
    'DRY_RUN=0',
    'PATH_HINT=""',
    'PATH_IMMEDIATE=0',
    'ensure_command_on_path',
    'printf "PATH_IMMEDIATE=%s\\nPATH_HINT=%s\\n" "$PATH_IMMEDIATE" "$PATH_HINT"',
  ].join('\n');
  return spawnSync('/bin/bash', ['-c', script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      BASH_ENV: '/dev/null',
      ENV: '/dev/null',
      HOME: options.home,
      OS_HOME: join(options.home, '.consuelo'),
      PATH: options.path,
      SHELL: '/bin/zsh',
    },
  });
}

describe('bootstrap source refresh controls', () => {
  it('should declare the public installer dependency model explicitly', () => {
    const bootstrap = readBootstrap();

    expect(bootstrap).toContain('MACOS_EXPECTED_SYSTEM_TOOLS=(');
    expect(bootstrap).toContain('INSTALLER_MANAGED_RUNTIME_BINARIES=(');
    expect(bootstrap).toContain('PACKAGE_MANAGED_DEPENDENCIES_DESCRIPTION=');
    expect(bootstrap).toContain('OPERATOR_ONLY_TOOLS=(');
    expect(bootstrap).toContain('curl');
    expect(bootstrap).toContain('portless');
    expect(bootstrap).toContain('cloudflared');
    expect(bootstrap).toContain('wrangler');
  });

  it('should resolve the signed stable channel when a hosted install runs', () => {
    const bootstrap = readBootstrap();

    expect(bootstrap).toContain(
      'RELEASE_CHANNEL="${CONSUELO_RELEASE_CHANNEL:-stable}"',
    );
    expect(bootstrap).toMatch(
      /if \[ "\$\{CONSUELO_OS_DEV:-0\}" = "1" \]; then[\s\S]*RELEASE_CHANNEL="\$\{CONSUELO_RELEASE_CHANNEL:-stable\}"[\s\S]*else[\s\S]*RELEASE_CHANNEL="stable"/,
    );
    expect(bootstrap).toContain(
      '--refresh-source|--use-existing-source) ;;',
    );
    expect(bootstrap).toContain('SOURCE_STATUS="verified"');
    expect(bootstrap).not.toContain('REPO_ARCHIVE_URL');
  });

  it('defaults the hosted installer to local without a mode prompt while preserving explicit cloud mode', () => {
    const bootstrap = readBootstrap();

    expect(bootstrap).toContain('choose_os_mode');
    expect(bootstrap).toContain('OS_MODE="local"');
    expect(bootstrap).not.toContain('Choose Consuelo OS mode:');
    expect(bootstrap).not.toContain('render_os_mode_select');
    expect(bootstrap).not.toContain('Choose local or cloud before setup.');
    expect(bootstrap).toContain(
      'CONTACT_URL="https://consuelohq.com/contact/"',
    );
    expect(bootstrap).toContain('open_contact_url');
    expect(bootstrap).toContain('--mode <mode>      local or cloud');
    expect(bootstrap).toContain('local|cloud) OS_MODE="$1"');
    expect(bootstrap.indexOf('choose_os_mode')).toBeLessThan(
      bootstrap.indexOf('ensure_bun'),
    );
  });

  it('does not carry an interactive shell selector now that hosted choices are defaulted', () => {
    const bootstrap = readBootstrap();
    expect(bootstrap).not.toContain('prompt_select()');
    expect(bootstrap).not.toContain('Use arrow keys and Enter.');
  });

  it('exits the cloud path before source download or dependency install', () => {
    const bootstrap = readBootstrap();
    const main = extractShellFunction(bootstrap, 'main');

    expect(bootstrap).toContain('handle_cloud_mode');
    expect(bootstrap).toContain(
      'Consuelo cloud is handled by the Consuelo team. Opening the contact page.',
    );
    expect(bootstrap).toContain('exit 0');
    expect(bootstrap).toContain('local|cloud) OS_MODE="$1"');

    expect(main.indexOf('handle_cloud_mode')).toBeLessThan(
      main.indexOf('setup_local_runtime'),
    );
  });

  it('installs required local dependencies without a redundant confirmation gate', () => {
    const bootstrap = readBootstrap();

    expect(bootstrap).not.toContain('prompt_dependency_setup');
    expect(bootstrap).not.toContain('render_dependency_progress');
    expect(bootstrap).not.toContain(
      'Consuelo OS needs its dependencies to continue.',
    );
    expect(bootstrap).toContain('ensure_bun');
    expect(bootstrap).toContain('ensure_dependencies');
  });

  it('opens the installed workspace through the authority handoff instead of forcing a second Google login', () => {
    const bootstrap = readBootstrap();
    const openLauncher = extractShellFunction(
      bootstrap,
      'open_workspace_launcher',
    );

    expect(openLauncher).toContain(
      'https://os.consuelohq.com/auth/workspaces?workspace_host=$workspace_host&return_to=%2F',
    );
    expect(openLauncher).not.toContain('open_url "https://$workspace_host"');
  });

  it('resolves existing legacy nested installs before creating a fresh flattened home', () => {
    const bootstrap = readBootstrap();

    expect(bootstrap).toContain('resolve_os_home()');
    expect(bootstrap).toContain(
      'DEFAULT_OS_HOME="${CONSUELO_DEFAULT_HOME:-$HOME/.consuelo}"',
    );
    expect(bootstrap).toContain(
      'LEGACY_OS_HOME="${CONSUELO_LEGACY_OS_HOME:-$HOME/.consuelo/os}"',
    );
    expect(bootstrap).toContain('OS_HOME="$(resolve_os_home)"');
    expect(bootstrap).toContain('resolve_runtime_home()');
    expect(bootstrap).toContain('RUNTIME_HOME="$(resolve_runtime_home)"');
    expect(bootstrap).toContain('[ ! -f "$DEFAULT_OS_HOME/consuelo.yaml" ]');
  });

  it('should isolate the active runtime when migrating a legacy nested install', () => {
    const bootstrap = readBootstrap();
    const legacyHome = mkdtempSync(
      join(tmpdir(), 'consuelo-bootstrap-legacy-home-'),
    );
    writeFileSync(join(legacyHome, 'package.json'), '{}');

    const runtimeHome = runBootstrapFunction(
      bootstrap,
      'resolve_runtime_home',
      '',
      {
        env: {
          CONSUELO_RUNTIME_HOME: '',
          LEGACY_OS_HOME: legacyHome,
          OS_HOME: legacyHome,
        },
      },
    ).trim();

    expect(runtimeHome).toBe(join(legacyHome, 'runtime', 'current'));
  });

  const createSensitiveTranscript = () =>
    [
      '\u001B[32m◇\u001B[39m Consuelo OS',
      '    C7UD-BR7N',
      '\u001B]8;;https://os.consuelohq.com/login/device?user_code=C7UDBR7N\u0007click here\u001B]8;;\u0007',
      'Full URL: https://os.consuelohq.com/login/device?user_code=C7UDBR7N&device_code=device-secret&token=osat_secret',
      'Callback: https://os.consuelohq.com/callback?authorization=auth-secret&bootstrap_token=boot-secret&state=state-secret&secret=plain-secret&code=code-secret',
      'path=/Users/kokayikobb/.consuelo and /home/kokayi/.consuelo',
      'Authorization: Bearer abc.def.ghi',
      'cloudflare_tunnel_token=secret-token-123',
      'client_secret=client-secret-456',
      'MCP_TOKEN=mcp-secret',
      'pat_secretprefix',
    ].join('\n');

  function expectRedactedTranscript(redacted: string): void {
    expect(redacted).not.toContain('\u001B');
    expect(redacted).not.toContain('C7UD-BR7N');
    expect(redacted).not.toContain('C7UDBR7N');
    expect(redacted).not.toContain('device-secret');
    expect(redacted).not.toContain('osat_secret');
    expect(redacted).not.toContain('auth-secret');
    expect(redacted).not.toContain('boot-secret');
    expect(redacted).not.toContain('state-secret');
    expect(redacted).not.toContain('plain-secret');
    expect(redacted).not.toContain('code-secret');
    expect(redacted).not.toContain('kokayikobb');
    expect(redacted).not.toContain('kokayi');
    expect(redacted).not.toContain('abc.def.ghi');
    expect(redacted).not.toContain('secret-token-123');
    expect(redacted).not.toContain('client-secret-456');
    expect(redacted).not.toContain('mcp-secret');
    expect(redacted).not.toContain('pat_secretprefix');
    expect(redacted).toContain('[redacted]');
    expect(redacted).toContain('/Users/[user]/.consuelo');
    expect(redacted).toContain('/home/[user]/.consuelo');
  }

  it('should install the immutable stable runtime instead of promoting repository source', () => {
    const bootstrap = readBootstrap();
    expect(bootstrap).toContain(
      'HOSTED_RELEASE_BASE_URL="https://install.consuelohq.com/os/releases"',
    );
    expect(bootstrap).toContain('if [ "${CONSUELO_OS_DEV:-0}" = "1" ]; then');
    expect(bootstrap).toContain('RELEASE_BASE_URL="$HOSTED_RELEASE_BASE_URL"');
    expect(bootstrap).toContain(
      'RELEASE_PUBLIC_KEYS_BASE64="$BAKED_RELEASE_PUBLIC_KEYS_BASE64"',
    );
    expect(bootstrap).toContain('/channels/${channel}.json');
    expect(bootstrap).toContain('verify_runtime_release');
    expect(bootstrap).toContain('install_verified_runtime');
    expect(bootstrap).not.toContain('main.tar.gz');
    expect(bootstrap).not.toContain('download_source_archive');
    expect(bootstrap).not.toContain('promote_hosted_runtime');
  });

  it('should activate the verified runtime after onboarding succeeds and before daemon installation', () => {
    const bootstrap = readBootstrap();
    const main = extractShellFunction(bootstrap, 'main');
    const setupLocalRuntime = extractShellFunction(
      bootstrap,
      'setup_local_runtime',
    );
    const daemonInstall = extractShellFunction(
      bootstrap,
      'install_daemons_quiet',
    );

    expect(setupLocalRuntime).toContain('install_verified_runtime');
    expect(main).toContain(
      'run_quiet_with_loading_dots "Installing Consuelo OS" setup_local_runtime',
    );
    expect(main.indexOf('setup_local_runtime')).toBeLessThan(
      main.indexOf('run_onboarding'),
    );
    expect(main.indexOf('run_onboarding')).toBeLessThan(
      main.indexOf('activate_verified_runtime'),
    );
    expect(main.indexOf('activate_verified_runtime')).toBeLessThan(
      main.indexOf('maybe_install_daemons'),
    );
    expect(daemonInstall).toContain('CONSUELO_HOME="$OS_HOME"');
    expect(daemonInstall).toContain(
      'CONSUELO_SECURITY_GENERATED_DIR="$OS_HOME/node/security/generated"',
    );
    expect(daemonInstall).toContain(
      'CONSUELO_DAEMON_LOG_DIR="$OS_HOME/node/logs"',
    );
  });

  it('should repair only inactive incomplete immutable release directories', () => {
    const installRuntime = extractShellFunction(
      readBootstrap(),
      'install_verified_runtime',
    );

    expect(installRuntime).toContain(
      'active verified release directory is incomplete',
    );
    expect(installRuntime).toContain(
      'stale_release_dir="${release_dir}.stale.$$"',
    );
    expect(installRuntime).toContain(
      'mv "$release_dir" "$stale_release_dir"',
    );
    expect(installRuntime).toContain(
      'mv "$extracted_dir" "$release_dir"',
    );
    expect(installRuntime.indexOf(
      '[ "$active_release_dir" = "$release_dir_resolved" ]',
    )).toBeLessThan(
      installRuntime.indexOf('mv "$release_dir" "$stale_release_dir"'),
    );
  });

  it('should redact child installer PTY transcripts before saving diagnostics when perl is available', () => {
    const bootstrap = readBootstrap();

    expectRedactedTranscript(
      runBootstrapFunction(
        bootstrap,
        'redact_dev_log_line',
        createSensitiveTranscript(),
      ),
    );
  });

  it('should redact child installer PTY transcripts before saving diagnostics when using sed fallback', () => {
    const bootstrap = readBootstrap();
    const sedOnlyPath = createSedOnlyPath();

    expectRedactedTranscript(
      runBootstrapFunction(
        bootstrap,
        'redact_dev_log_line',
        createSensitiveTranscript(),
        {
          env: { PATH: sedOnlyPath },
        },
      ),
    );
  });
  it('forwards daemon decisions into interactive onboarding', () => {
    const bootstrap = readBootstrap();
    const runner = extractShellFunction(
      bootstrap,
      'run_install_with_script_pty',
    );

    expect(runner).toContain('local install_args=');
    expect(runner).toContain('install_args+=(--quiet)');
    expect(runner).toContain('install_args+=(--install-daemons)');
    expect(runner).toContain('install_args+=(--skip-daemons)');
    expect(runner).toContain('"${install_args[@]}"');
  });

  it('keeps the hosted happy path quiet after browser approval and opens the launcher last', () => {
    const bootstrap = readBootstrap();
    const summary = extractShellFunction(bootstrap, 'print_success_summary');
    const main = extractShellFunction(bootstrap, 'main');
    const daemons = extractShellFunction(bootstrap, 'maybe_install_daemons');

    expect(summary).toContain('Consuelo OS installed');
    expect(summary).toContain('Use now: $OS_HOME/bin/consuelo status');
    expect(summary).not.toContain('Home:');
    expect(summary).not.toContain('Already on PATH');
    expect(summary).not.toContain('Try:');
    expect(summary).not.toContain('Package:');
    expect(summary).not.toContain('Config:');
    expect(summary).not.toContain('Database:');
    expect(summary).not.toContain('Logs:');
    expect(summary).not.toContain('Services:');
    expect(summary).not.toContain('Doctor:');
    expect(summary).not.toContain('Tokens and secrets');
    expect(daemons).toContain(
      'run_quiet_with_loading_dots "setting up background service" install_daemons_quiet',
    );
    expect(daemons).not.toContain('log "background service ready"');

    expect(bootstrap).toContain('open_workspace_launcher');
    expect(bootstrap).toContain('[ "$YES" -eq 0 ] || return 0');
    expect(bootstrap).toContain('[ "$DRY_RUN" -eq 0 ] || return 0');
    expect(bootstrap).toContain('[ "$JSON" -eq 0 ] || return 0');
    expect(main.indexOf('print_success_summary')).toBeGreaterThan(-1);
    expect(main.indexOf('open_workspace_launcher')).toBeGreaterThan(
      main.indexOf('print_success_summary'),
    );
    expect(main.indexOf('emit_json_summary')).toBeGreaterThan(
      main.indexOf('open_workspace_launcher'),
    );
  });

  it('renders quiet setup stages as one stable in-place progress line', () => {
    const bootstrap = readBootstrap();
    const progress = extractShellFunction(bootstrap, 'run_quiet_with_loading_dots');

    expect(progress).toContain('printf \'%s...\' "$loading_message"');
    expect(progress).toContain('printf \'\\r%s... done\\n\' "$loading_message"');
    expect(progress).toContain('printf \'\\r%s... failed\\n\' "$loading_message"');
    expect(progress).not.toContain('log "${loading_message}..."');
  });

  it('makes consuelo immediately discoverable through an existing writable PATH directory', () => {
    const bootstrap = readBootstrap();
    const home = mkdtempSync(join(tmpdir(), 'consuelo-bootstrap-path-'));
    const pathDir = join(home, 'bin');
    const canonicalBin = join(home, '.consuelo', 'bin');
    const canonicalCli = join(canonicalBin, 'consuelo');
    mkdirSync(pathDir, { recursive: true });
    mkdirSync(canonicalBin, { recursive: true });
    writeFileSync(canonicalCli, '#!/bin/sh\nexit 0\n', { mode: 0o755 });

    const result = runPathSetup(bootstrap, {
      home,
      path: `${pathDir}:/usr/bin:/bin`,
    });

    expect(result.status, result.stderr).toBe(0);
    const immediateCli = join(pathDir, 'consuelo');
    expect(lstatSync(immediateCli).isSymbolicLink()).toBe(true);
    expect(readlinkSync(immediateCli)).toBe(canonicalCli);
    expect(result.stdout).toContain('PATH_IMMEDIATE=1');
  });

  it.each([0o775, 0o757])(
    'should skip PATH directories with either shared write bit when mode is %s',
    (unsafeMode) => {
    const bootstrap = readBootstrap();
    const home = mkdtempSync(join(tmpdir(), 'consuelo-bootstrap-path-safety-'));
    const unsafeDir = join(home, 'unsafe-bin');
    const safeDir = join(home, 'safe-bin');
    const canonicalBin = join(home, '.consuelo', 'bin');
    const canonicalCli = join(canonicalBin, 'consuelo');
    mkdirSync(unsafeDir, { recursive: true, mode: unsafeMode });
    mkdirSync(safeDir, { recursive: true, mode: 0o700 });
    chmodSync(unsafeDir, unsafeMode);
    mkdirSync(canonicalBin, { recursive: true });
    writeFileSync(canonicalCli, '#!/bin/sh\nexit 0\n', { mode: 0o755 });

    const result = runPathSetup(bootstrap, {
      home,
      path: `${unsafeDir}:${safeDir}:/usr/bin:/bin`,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(join(unsafeDir, 'consuelo'))).toBe(false);
    expect(lstatSync(join(safeDir, 'consuelo')).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(safeDir, 'consuelo'))).toBe(canonicalCli);
    expect(result.stdout).toContain('PATH_IMMEDIATE=1');
    },
  );

  it('should skip a user-owned PATH directory when a non-sticky parent is shared-writable', () => {
    const bootstrap = readBootstrap();
    const home = mkdtempSync(join(tmpdir(), 'consuelo-bootstrap-parent-safety-'));
    const replaceableParent = join(home, 'replaceable');
    const unsafeChild = join(replaceableParent, 'bin');
    const safeDir = join(home, 'safe-bin');
    const canonicalBin = join(home, '.consuelo', 'bin');
    const canonicalCli = join(canonicalBin, 'consuelo');
    mkdirSync(unsafeChild, { recursive: true, mode: 0o700 });
    mkdirSync(safeDir, { recursive: true, mode: 0o700 });
    chmodSync(replaceableParent, 0o777);
    chmodSync(unsafeChild, 0o700);
    mkdirSync(canonicalBin, { recursive: true });
    writeFileSync(canonicalCli, '#!/bin/sh\nexit 0\n', { mode: 0o755 });

    const result = runPathSetup(bootstrap, {
      home,
      path: `${unsafeChild}:${safeDir}:/usr/bin:/bin`,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(join(unsafeChild, 'consuelo'))).toBe(false);
    expect(lstatSync(join(safeDir, 'consuelo')).isSymbolicLink()).toBe(true);
  });

  it('should recognize a relative symlink that already resolves to the canonical Consuelo CLI', () => {
    const bootstrap = readBootstrap();
    const home = mkdtempSync(join(tmpdir(), 'consuelo-bootstrap-relative-link-'));
    const pathDir = join(home, 'bin');
    const canonicalBin = join(home, '.consuelo', 'bin');
    const canonicalCli = join(canonicalBin, 'consuelo');
    mkdirSync(pathDir, { recursive: true });
    mkdirSync(canonicalBin, { recursive: true });
    writeFileSync(canonicalCli, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    symlinkSync('../.consuelo/bin/consuelo', join(pathDir, 'consuelo'));

    const result = runPathSetup(bootstrap, {
      home,
      path: `${pathDir}:/usr/bin:/bin`,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('PATH_IMMEDIATE=1');
    expect(result.stdout).not.toContain("Another 'consuelo' already owns PATH");
  });

  it('never overwrites an unrelated consuelo command already on PATH', () => {
    const bootstrap = readBootstrap();
    const home = mkdtempSync(join(tmpdir(), 'consuelo-bootstrap-collision-'));
    const pathDir = join(home, 'bin');
    const canonicalBin = join(home, '.consuelo', 'bin');
    mkdirSync(pathDir, { recursive: true });
    mkdirSync(canonicalBin, { recursive: true });
    const existingCli = join(pathDir, 'consuelo');
    writeFileSync(existingCli, '#!/bin/sh\necho unrelated\n', { mode: 0o755 });
    writeFileSync(join(canonicalBin, 'consuelo'), '#!/bin/sh\nexit 0\n', {
      mode: 0o755,
    });

    const result = runPathSetup(bootstrap, {
      home,
      path: `${pathDir}:/usr/bin:/bin`,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(existingCli, 'utf8')).toContain('echo unrelated');
    expect(result.stdout).toContain('PATH_IMMEDIATE=0');
    expect(result.stdout).toContain("Another 'consuelo' already owns PATH");
  });

  it('should pin darwin cloudflared checksums when bootstrap.sh is read', () => {
    const bootstrap = readBootstrap();

    expect(bootstrap).toContain(
      'CLOUDFLARED_DARWIN_ARM64_SHA256="f6d4c439c6c782b83264951d327989ce5e23373acc5942b872411601fedb020d"',
    );
    expect(bootstrap).toContain(
      'CLOUDFLARED_DARWIN_AMD64_SHA256="d7a66b525fe76820da6e5406611b61e48b40de682368ac00454d9158f085be4b"',
    );
  });
});
