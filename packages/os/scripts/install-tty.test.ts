import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const bootstrap = readFileSync(new URL('./bootstrap.sh', import.meta.url), 'utf8');
const install = readFileSync(new URL('./install.ts', import.meta.url), 'utf8');

describe('hosted Clack install TTY wiring', () => {
  test('bootstrap has an explicit helper for running Clack against the controlling terminal', () => {
    expect(bootstrap).toContain('run_install_with_tty()');
    expect(bootstrap).toContain('< /dev/tty');
    expect(bootstrap).not.toContain('./scripts/install.ts --home "$os_home" < /dev/tty > /dev/tty');
    expect(bootstrap).not.toContain('./scripts/install.ts --check-tty < /dev/tty > /dev/tty');
    expect(bootstrap).not.toContain('2> /dev/tty');
  });

  test('interactive hosted onboarding runs Clack under a pseudo-terminal', () => {
    expect(bootstrap).toContain('run_install_with_tty "$os_dir" "$os_home"');
    expect(bootstrap).toContain('run_install_with_script_pty');
    expect(bootstrap).toContain('script -q /dev/null');
    expect(bootstrap).toContain('./scripts/install.ts --home "$os_home"');
    expect(bootstrap).not.toContain('./scripts/install.ts --home "$os_home" < /dev/tty > /dev/tty');
    expect(bootstrap).not.toContain('./scripts/install.ts --check-tty < /dev/tty > /dev/tty');
  });

  test('non-interactive automation path still bypasses prompts with --yes', () => {
    expect(bootstrap).toContain('./scripts/install.ts --yes --json --home');
    expect(bootstrap).toContain('install_args+=(--install-daemons)');
  });

  test('bootstrap exposes debug-friendly TTY checking for local diagnosis', () => {
    expect(bootstrap).toContain('check_install_tty()');
    expect(bootstrap).toContain('./scripts/install.ts --check-tty');
  });
});

describe('install.ts Clack prompt preflight', () => {
  test('local install completion keeps final output compact', () => {
    const completionStart = install.indexOf("local OS saved");
    const configurationSaved = install.indexOf("configuration saved", completionStart);
    const completionBlock = install.slice(completionStart, configurationSaved);

    expect(completionStart).toBeGreaterThanOrEqual(0);
    expect(configurationSaved).toBeGreaterThan(completionStart);
    expect(completionBlock).not.toContain("stepComplete('home')");
    expect(completionBlock).not.toContain("stepComplete('skills')");
    expect(completionBlock).not.toContain("stepComplete('artifacts')");
    expect(completionBlock).not.toContain("stepComplete('agents')");
  });

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

  test('Clack prompts use explicit process stdio streams after TTY preflight', () => {
    expect(install).toContain('getClackIo');
    expect(install).toContain('input: process.stdin');
    expect(install).toContain('output: process.stdout');
    expect(install).toContain('...clackIo');
  });

  test('Clack prompts fail before rendering if stdio is not a usable TTY', () => {
    expect(install).toContain('assertClackTtyReady');
    expect(install).toContain('options.yes || options.json');
    expect(install).toContain('process.stdin.isTTY');
    expect(install).toContain('process.stdout.isTTY');
    expect(install).toContain('process.stderr.isTTY');
  });
});

