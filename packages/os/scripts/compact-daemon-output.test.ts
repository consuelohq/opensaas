import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const install = readFileSync(new URL('./install.ts', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('./bootstrap.sh', import.meta.url), 'utf8');
const daemonInstall = readFileSync(
  new URL('./install-system-daemons.sh', import.meta.url),
  'utf8',
);

function extractShellFunction(source: string, name: string): string {
  const start = source.indexOf(`${name}() {`);
  if (start < 0) throw new Error(`missing shell function: ${name}`);

  let depth = 0;
  let opened = false;
  for (let cursor = start; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    if (char === '{') {
      depth += 1;
      opened = true;
    } else if (char === '}') {
      depth -= 1;
      if (opened && depth === 0) return source.slice(start, cursor + 1);
    }
  }
  throw new Error(`unterminated shell function: ${name}`);
}

describe('Consuelo OS compact hosted daemon output', () => {
  test('hosted bootstrap invokes daemon install in quiet mode outside debug', () => {
    expect(bootstrap).toContain('install_daemons_quiet()');
    expect(bootstrap).toContain('bash ./scripts/install-system-daemons.sh --quiet');
    expect(bootstrap).toContain('bash ./scripts/install-system-daemons.sh --dry-run --quiet');
    expect(bootstrap).toContain('setting up background service');
    expect(bootstrap).not.toContain('background service ready');
    expect(bootstrap).not.toContain('"$BUN_BIN" run --cwd "$os_dir" install:system-daemons:quiet');
    expect(bootstrap).not.toContain('"$BUN_BIN" run --cwd "$os_dir" install:system-daemons:dry-run -- --quiet');
  });

  test('hosted bootstrap uses subtle loading dots for slow quiet steps', () => {
    expect(bootstrap).toContain('run_with_loading_dots()');
    expect(bootstrap).toContain('loading_message="$1"');
    expect(bootstrap).toContain('verify_runtime_release()');
    expect(bootstrap).toContain('install_verified_runtime()');
    expect(bootstrap).toContain('run_quiet_with_loading_dots "setting up background service" install_daemons_quiet');
  });

  test('normal hosted setup collapses dependency chatter behind one installer status while debug stays detailed', () => {
    expect(bootstrap).toContain('setup_local_runtime()');
    expect(bootstrap).toContain('run_quiet_with_loading_dots "Installing Consuelo OS" setup_local_runtime');
    expect(bootstrap).toContain('if [ "$DEBUG" = "1" ] || [ "$JSON" -eq 1 ] || [ "$DRY_RUN" -eq 1 ]; then');
    expect(bootstrap).toContain('setup_local_runtime');
    expect(bootstrap).toContain('"$BUN_BIN" install --frozen-lockfile --production');
  });


  test('quiet progress emits one completed status line when stdout is not a terminal', () => {
    const helper = extractShellFunction(bootstrap, 'run_quiet_with_loading_dots');
    const result = spawnSync('bash', [
      '-c',
      `${helper}\nDEBUG=0\nJSON=0\nDRY_RUN=0\nfail() { exit 1; }\nrun_quiet_with_loading_dots "Installing Consuelo OS" true`,
    ], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('Installing Consuelo OS... done\n');
  });

  test('daemon quiet mode suppresses generated plist and repeated summary details', () => {
    expect(daemonInstall).toContain('--quiet');
    expect(daemonInstall).toContain('quiet=');
    expect(daemonInstall).toContain('run_plutil_lint');
    expect(daemonInstall).toContain('print_success_summary');
    expect(daemonInstall).toContain('[ "$quiet" = "1" ] && return 0');
  });

  test('daemon details remain available in debug mode', () => {
    expect(daemonInstall).toContain('--debug');
    expect(daemonInstall).toContain('CONSUELO_OS_DEBUG');
    expect(daemonInstall).toContain('print_debug_state');
  });

  test('hosted onboarding result mode does not print an early doctor command or OS ready outro', () => {
    expect(install).toContain('CONSUELO_ONBOARDING_RESULT_FILE');
    expect(install).toContain('const suppressFinalSummary');
    expect(install).toContain('!suppressFinalSummary');
  });
});
