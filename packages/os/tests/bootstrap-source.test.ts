import { existsSync, mkdtempSync, readFileSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

const readBootstrap = () => readFileSync(join(process.cwd(), 'scripts', 'bootstrap.sh'), 'utf8');


function runBootstrapFunction(
  source: string,
  name: string,
  input: string,
  options: { env?: NodeJS.ProcessEnv } = {},
): string {
  const fn = extractShellFunction(source, name);
  const result = spawnSync('/bin/bash', ['-c', `set -euo pipefail
${fn}
${name}`], {
    input,
    encoding: 'utf8',
    env: { ...process.env, BASH_ENV: '/dev/null', ENV: '/dev/null', ...options.env },
  });
  if (result.error) {
    throw new Error(`${name} failed to start: ${result.error.message}`);
  }
  if (result.status === null) {
    throw new Error(`${name} terminated by signal ${result.signal ?? 'unknown'}`);
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || `${name} failed with status ${result.status}`);
  }
  return result.stdout;
}

function createSedOnlyPath(): string {
  const directory = mkdtempSync(join(tmpdir(), 'consuelo-bootstrap-sed-'));
  const sedPath = ['/usr/bin/sed', '/bin/sed'].find((candidate) => existsSync(candidate));
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

  it('refreshes hosted source by default with an explicit reuse escape hatch', () => {
    const bootstrap = readBootstrap();

    expect(bootstrap).toContain('REFRESH_SOURCE=1');
    expect(bootstrap).toContain('--refresh-source');
    expect(bootstrap).toContain('--use-existing-source');
    expect(bootstrap).toContain('SOURCE_STATUS="refreshed"');
    expect(bootstrap).toContain('SOURCE_STATUS="reused"');
    expect(bootstrap).not.toContain('pass --refresh-source to refresh it');
  });

  it('asks for local or cloud before dependency setup', () => {
    const bootstrap = readBootstrap();

    expect(bootstrap).toContain('choose_os_mode');
    expect(bootstrap).toContain('Choose Consuelo OS mode:');
    expect(bootstrap).toContain('prompt_select');
    expect(bootstrap).toContain('◆ %s');
    expect(bootstrap).toContain('○ %s');
    expect(bootstrap).toContain('read -rsn1');
    expect(bootstrap).toContain('CONTACT_URL="https://consuelohq.com/contact/"');
    expect(bootstrap).toContain('open_contact_url');
    expect(bootstrap).not.toContain('Enter 1 or 2:');

    expect(bootstrap.indexOf('choose_os_mode')).toBeLessThan(
      bootstrap.indexOf('prompt_dependency_setup'),
    );
    expect(bootstrap.indexOf('choose_os_mode')).toBeLessThan(
      bootstrap.indexOf('ensure_bun'),
    );
  });

  it('redraws selector choices in place instead of duplicating on arrow keys', () => {
    const bootstrap = readBootstrap();
    const promptSelect = extractShellFunction(bootstrap, 'prompt_select');

    expect(promptSelect).toContain('prompt_lines=4');
    expect(promptSelect).toContain('rendered=0');
    expect(promptSelect).toContain('if [ "$rendered" -eq 1 ]; then');
    expect(promptSelect).toContain("printf '\\033[%sA' \"$prompt_lines\" > /dev/tty");
    expect(promptSelect).toContain("printf '\\033[2K%s\\n' \"$message\" > /dev/tty");
    expect(promptSelect).not.toContain("printf '\\n' > /dev/tty");
  });

  it('exits the cloud path before source download or dependency install', () => {
    const bootstrap = readBootstrap();

    expect(bootstrap).toContain('handle_cloud_mode');
    expect(bootstrap).toContain('Consuelo cloud is handled by the Consuelo team. Opening the contact page.');
    expect(bootstrap).toContain('exit 0');
    expect(bootstrap).toContain('OS_MODE="cloud"');
    expect(bootstrap).toContain('handle_cloud_mode');

    expect(bootstrap.indexOf('handle_cloud_mode')).toBeLessThan(
      bootstrap.indexOf('resolve_source'),
    );
    expect(bootstrap.indexOf('handle_cloud_mode')).toBeLessThan(
      bootstrap.indexOf('ensure_dependencies'),
    );
  });

  it('uses one dependency gate before the Bun onboarding UI for local installs', () => {
    const bootstrap = readBootstrap();

    expect(bootstrap).toContain('Consuelo OS needs its dependencies to continue.');
    expect(bootstrap).toContain('yes');
    expect(bootstrap).toContain('no');
    expect(bootstrap).toContain('DEPENDENCY_STATUS="cancelled"');
    expect(bootstrap).toContain('render_dependency_progress');
    expect(bootstrap).toContain('CONSUELO OS');
    expect(bootstrap).not.toContain('CONSUELO  OS');
    expect(bootstrap).not.toContain('C O N S U E L O');
    expect(bootstrap).toContain('● dependencies');
    expect(bootstrap).toContain('○ security');
    expect(bootstrap).not.toContain('○ home');
    expect(bootstrap).toContain('○ workspace');
    expect(bootstrap).toContain('○ security');
    expect(bootstrap).toContain('○ skills');
    expect(bootstrap).toContain('○ agents');
    expect(bootstrap).toContain('○ service');
    expect(bootstrap).toContain('○ health');
    expect(bootstrap).not.toContain('○ artifacts');
    expect(bootstrap).not.toContain('Press Enter to continue');
    expect(bootstrap).not.toContain('prompt_enter');
    expect(bootstrap).not.toContain('Consuelo OS needs the local runtime source to continue.');
    expect(bootstrap).not.toContain('Consuelo OS needs its local runtime dependencies to continue.');
    expect(bootstrap).not.toContain('We can download/setup this now.');
    expect(bootstrap).not.toContain('We can install/setup this now.');
  });


  it('resolves existing legacy nested installs before creating a fresh flattened home', () => {
    const bootstrap = readBootstrap();

    expect(bootstrap).toContain('resolve_os_home()');
    expect(bootstrap).toContain('DEFAULT_OS_HOME="${CONSUELO_DEFAULT_HOME:-$HOME/.consuelo}"');
    expect(bootstrap).toContain('LEGACY_OS_HOME="${CONSUELO_LEGACY_OS_HOME:-$HOME/.consuelo/os}"');
    expect(bootstrap).toContain('OS_HOME="$(resolve_os_home)"');
    expect(bootstrap).toContain('resolve_runtime_home()');
    expect(bootstrap).toContain('RUNTIME_HOME="$(resolve_runtime_home)"');
    expect(bootstrap).toContain('[ -f "$LEGACY_OS_HOME/package.json" ]');
    expect(bootstrap).toContain('[ ! -f "$DEFAULT_OS_HOME/consuelo.yaml" ]');
  });


  const createSensitiveTranscript = () => [
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

  it('should redact child installer PTY transcripts before saving diagnostics when perl is available', () => {
    const bootstrap = readBootstrap();

    expectRedactedTranscript(runBootstrapFunction(bootstrap, 'redact_dev_log_line', createSensitiveTranscript()));
  });

  it('should redact child installer PTY transcripts before saving diagnostics when using sed fallback', () => {
    const bootstrap = readBootstrap();
    const sedOnlyPath = createSedOnlyPath();

    expectRedactedTranscript(
      runBootstrapFunction(bootstrap, 'redact_dev_log_line', createSensitiveTranscript(), {
        env: { PATH: sedOnlyPath },
      }),
    );
  });
  it('forwards daemon decisions into interactive onboarding', () => {
    const bootstrap = readBootstrap();
    const runner = extractShellFunction(bootstrap, 'run_install_with_script_pty');

    expect(runner).toContain('local install_args=');
    expect(runner).toContain('install_args+=(--install-daemons)');
    expect(runner).toContain('install_args+=(--skip-daemons)');
    expect(runner).toContain('"${install_args[@]}"');
  });

  it('keeps the human success summary minimal and opens the launcher last', () => {
    const bootstrap = readBootstrap();
    const summary = extractShellFunction(bootstrap, 'print_success_summary');
    const main = extractShellFunction(bootstrap, 'main');

    expect(summary).toContain('Consuelo OS setup complete');
    expect(summary).toContain('Home: $os_home');
    expect(summary).not.toContain('Package:');
    expect(summary).not.toContain('Config:');
    expect(summary).not.toContain('Database:');
    expect(summary).not.toContain('Logs:');
    expect(summary).not.toContain('Services:');
    expect(summary).not.toContain('Doctor:');
    expect(summary).not.toContain('Tokens and secrets');

    expect(bootstrap).toContain('open_workspace_launcher');
    expect(bootstrap).toContain('[ "$YES" -eq 0 ] || return 0');
    expect(bootstrap).toContain('[ "$DRY_RUN" -eq 0 ] || return 0');
    expect(bootstrap).toContain('[ "$JSON" -eq 0 ] || return 0');
    expect(main.indexOf('print_success_summary')).toBeGreaterThan(-1);
    expect(main.indexOf('open_workspace_launcher')).toBeGreaterThan(main.indexOf('print_success_summary'));
    expect(main.indexOf('emit_json_summary')).toBeGreaterThan(main.indexOf('open_workspace_launcher'));
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
