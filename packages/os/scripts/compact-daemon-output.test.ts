import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const install = readFileSync(new URL('./install.ts', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('./bootstrap.sh', import.meta.url), 'utf8');
const daemonInstall = readFileSync(
  new URL('./install-system-daemons.sh', import.meta.url),
  'utf8',
);

describe('Consuelo OS compact hosted daemon output', () => {
  test('hosted bootstrap invokes daemon install in quiet mode outside debug', () => {
    expect(bootstrap).toContain('install_daemons_quiet()');
    expect(bootstrap).toContain('bash ./scripts/install-system-daemons.sh --quiet');
    expect(bootstrap).toContain('bash ./scripts/install-system-daemons.sh --dry-run --quiet');
    expect(bootstrap).toContain('setting up background service');
    expect(bootstrap).toContain('background service ready');
    expect(bootstrap).not.toContain('"$BUN_BIN" run --cwd "$os_dir" install:system-daemons:quiet');
    expect(bootstrap).not.toContain('"$BUN_BIN" run --cwd "$os_dir" install:system-daemons:dry-run -- --quiet');
  });

  test('hosted bootstrap uses subtle loading dots for slow quiet steps', () => {
    expect(bootstrap).toContain('run_with_loading_dots()');
    expect(bootstrap).toContain('loading_message="$1"');
    expect(bootstrap).toContain('download_source_archive()');
    expect(bootstrap).toContain('run_with_loading_dots "Downloading Consuelo OS source" download_source_archive');
    expect(bootstrap).toContain('run_with_loading_dots "setting up background service" install_daemons_quiet');
  });

  test('runtime dependency install keeps Bun output visible', () => {
    expect(bootstrap).toContain('Installing Consuelo OS runtime dependencies...');
    expect(bootstrap).toContain('(cd "$os_dir" && "$BUN_BIN" install)');
    expect(bootstrap).not.toContain('run_with_loading_dots "Installing Consuelo OS runtime dependencies');
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
