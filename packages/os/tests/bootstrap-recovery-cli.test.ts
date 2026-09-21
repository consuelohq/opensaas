import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const bootstrapPath = resolve(import.meta.dirname, '../scripts/bootstrap.sh');

function mainBody(source: string): string {
  const start = source.indexOf('\nmain() {\n');
  const end = source.indexOf('\nmain "$@"', start);
  if (start === -1 || end === -1) {
    throw new Error('bootstrap main function was not found');
  }
  return source.slice(start, end);
}

function functionBody(source: string, name: string): string {
  const start = source.indexOf(`\n${name}() {\n`);
  if (start === -1) throw new Error(`${name} was not found`);
  const next = source.indexOf('\n}\n', start);
  if (next === -1) throw new Error(`${name} end was not found`);
  return source.slice(start, next + 3);
}

function expectOrdered(body: string, names: string[]): void {
  let previous = -1;
  for (const name of names) {
    const current = body.indexOf(`  ${name}\n`);
    expect(current, `missing ${name} in bootstrap main`).toBeGreaterThan(previous);
    previous = current;
  }
}

describe('bootstrap partial-install recovery CLI', () => {
  it('exposes the lifecycle command and PATH before onboarding can fail', () => {
    const source = readFileSync(bootstrapPath, 'utf8');
    const body = mainBody(source);
    const setup = functionBody(source, 'setup_local_runtime');

    expect(source).toContain('prepare_recovery_cli() {');
    expect(source).toContain('./scripts/install.ts --materialize-lifecycle-command');
    expect(source).toContain('--recovery-package-root "$os_dir"');
    expect(source.match(/--recovery-package-root/g)).toHaveLength(3);
    expect(source).toContain('finalize_recovery_cli() {');
    expect(source).toContain('recovery_cli_hint() {');
    expect(source).toContain('Recovery CLI is ready');
    expect(source).toContain('consuelo status');
    expect(source).toContain('consuelo uninstall --dry-run --json');
    expect(source).toContain('grep -qF "$bin_dir" "$rc_file"');
    expect(source).toContain("Warning: another 'consuelo' is already on PATH");

    expectOrdered(setup, [
      'install_verified_runtime',
      'ensure_dependencies',
      'prepare_recovery_cli',
      'ensure_command_on_path',
      'ensure_named_bun_runtime',
      'ensure_install_id',
      'ensure_portless',
      'ensure_caddy',
      'ensure_cloudflared',
      'persist_runtime_paths',
    ]);
    expect(body).toContain(
      'run_quiet_with_loading_dots "Installing Consuelo OS" setup_local_runtime',
    );
    expectOrdered(body, [
      'run_onboarding',
      'activate_verified_runtime',
      'finalize_recovery_cli',
      'maybe_install_daemons',
    ]);
  });

  it('keeps canonical runtime activation after onboarding succeeds', () => {
    const source = readFileSync(bootstrapPath, 'utf8');
    const body = mainBody(source);

    expect(body.indexOf('  run_onboarding\n')).toBeLessThan(
      body.indexOf('  activate_verified_runtime\n'),
    );
  });
});
