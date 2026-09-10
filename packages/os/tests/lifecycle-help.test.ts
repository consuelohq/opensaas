import { describe, expect, it } from 'vitest';

import { runLifecycleCli } from '../scripts/lifecycle';

async function renderHelp(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const exitCode = await runLifecycleCli(args, {
    stdout: (value) => stdout.push(value),
    stderr: (value) => stderr.push(value),
  });
  return { exitCode, stdout: stdout.join(''), stderr: stderr.join('') };
}

describe('Consuelo lifecycle help', () => {
  it('renders compact Codex-style root help for help and --help', async () => {
    const help = await renderHelp(['help']);
    const flagHelp = await renderHelp(['--help']);

    expect(help.exitCode).toBe(0);
    expect(help.stderr).toBe('');
    expect(flagHelp).toEqual(help);

    expect(help.stdout).toStartWith(
      'Consuelo OS\n\nIf no command is specified, Consuelo shows the local OS status.\n',
    );
    expect(help.stdout).toContain('Usage: consuelo [OPTIONS] [COMMAND] [ARGS]');
    expect(help.stdout).toContain('Commands:\n');
    expect(help.stdout).toContain('  status');
    expect(help.stdout).toContain('Show installation and runtime status');
    expect(help.stdout).toContain('  add skill');
    expect(help.stdout).toContain('Install bundled skills (picker by default)');
    expect(help.stdout).toContain('  remove skill');
    expect(help.stdout).toContain('Remove installed bundled skills (picker by default)');
    expect(help.stdout).toContain('  help');
    expect(help.stdout).toContain('Print this message');
    expect(help.stdout).toContain('Options:\n');
    expect(help.stdout).toContain('--json');
    expect(help.stdout).toContain('--quiet');
    expect(help.stdout).toContain('-h, --help');
    expect(help.stdout).toContain('Channels:\n  stable, beta, canary, dev, nightly');

    expect(help.stdout).not.toContain('consuelo status [--json] [--quiet]');
    expect(help.stdout).not.toContain('consuelo update [--channel <channel>]');
  });
});
