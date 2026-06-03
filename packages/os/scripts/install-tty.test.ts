import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const bootstrap = readFileSync(new URL('./bootstrap.sh', import.meta.url), 'utf8');
const install = readFileSync(new URL('./install.ts', import.meta.url), 'utf8');

describe('hosted Clack install TTY wiring', () => {
  test('bootstrap has an explicit helper for running Clack against the controlling terminal', () => {
    expect(bootstrap).toContain('run_install_with_tty()');
    expect(bootstrap).toContain('< /dev/tty');
    expect(bootstrap).toContain('> /dev/tty');
    expect(bootstrap).toContain('2> /dev/tty');
  });

  test('interactive hosted onboarding uses the TTY helper instead of only redirecting stdin', () => {
    expect(bootstrap).toContain('run_install_with_tty "$os_dir" "$os_home"');
    expect(bootstrap).not.toContain('OLD_STDIN_ONLY_INSTALL_CALL_SENTINEL');
  });

  test('non-interactive automation path still bypasses prompts with --yes', () => {
    expect(bootstrap).toContain('./scripts/install.ts --yes --home "$os_home"');
    expect(bootstrap).toContain('./scripts/install.ts --yes --json --home "$os_home"');
  });

  test('bootstrap exposes debug-friendly TTY checking for local diagnosis', () => {
    expect(bootstrap).toContain('check_install_tty()');
    expect(bootstrap).toContain('./scripts/install.ts --check-tty');
  });
});

describe('install.ts Clack prompt preflight', () => {
  test('install.ts accepts a --check-tty diagnostic command', () => {
    expect(install).toContain('checkTty');
    expect(install).toContain("arg === '--check-tty'");
    expect(install).toContain('--check-tty          print safe terminal diagnostics');
  });

  test('TTY diagnostic is safe and limited to terminal facts', () => {
    expect(install).toContain('stdinIsTTY');
    expect(install).toContain('stdoutIsTTY');
    expect(install).toContain('stderrIsTTY');
    expect(install).toContain('canSetRawMode');
    expect(install).toContain('term');
    expect(install).toContain('ci');
    expect(install).not.toContain('process.env.WORKSPACE_MCP_TOKEN');
  });

  test('Clack prompts fail before rendering if stdio is not a usable TTY', () => {
    expect(install).toContain('assertClackTtyReady');
    expect(install).toContain('options.yes || options.json');
    expect(install).toContain('process.stdin.isTTY');
    expect(install).toContain('process.stdout.isTTY');
    expect(install).toContain('process.stderr.isTTY');
  });
});
