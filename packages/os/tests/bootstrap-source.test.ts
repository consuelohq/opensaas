import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readBootstrap = () => readFileSync(join(process.cwd(), 'scripts', 'bootstrap.sh'), 'utf8');

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
    expect(bootstrap).toContain('1) local');
    expect(bootstrap).toContain('2) cloud');
    expect(bootstrap).toContain('CONTACT_URL="https://consuelohq.com/contact/"');
    expect(bootstrap).toContain('open_contact_url');

    expect(bootstrap.indexOf('choose_os_mode')).toBeLessThan(
      bootstrap.indexOf('prompt_dependency_setup'),
    );
    expect(bootstrap.indexOf('choose_os_mode')).toBeLessThan(
      bootstrap.indexOf('ensure_bun'),
    );
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
    expect(bootstrap).toContain('render_dependency_progress');
    expect(bootstrap).toContain('● dependencies');
    expect(bootstrap).not.toContain('○ home');
    expect(bootstrap).toContain('○ workspace');
    expect(bootstrap).toContain('○ skills');
    expect(bootstrap).toContain('○ artifacts');
    expect(bootstrap).toContain('○ agents');
    expect(bootstrap).toContain('○ health');
    expect(bootstrap).not.toContain('Consuelo OS needs the local runtime source to continue.');
    expect(bootstrap).not.toContain('Consuelo OS needs its local runtime dependencies to continue.');
    expect(bootstrap).not.toContain('We can download/setup this now.');
    expect(bootstrap).not.toContain('We can install/setup this now.');
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

  it('pins cloudflared darwin archive checksums to the currently served release assets', () => {
    const bootstrap = readBootstrap();

    expect(bootstrap).toContain(
      'CLOUDFLARED_DARWIN_ARM64_SHA256="f6d4c439c6c782b83264951d327989ce5e23373acc5942b872411601fedb020d"',
    );
    expect(bootstrap).toContain(
      'CLOUDFLARED_DARWIN_AMD64_SHA256="d7a66b525fe76820da6e5406611b61e48b40de682368ac00454d9158f085be4b"',
    );
  });
});
