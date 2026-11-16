import { describe, expect, it } from 'bun:test';
import { parseCommand } from './provider-cli';
describe('provider CLI admission', () => {
  it('requires explicit opt-in, exact reviewed fingerprint and all arguments before work', () => {
    expect(() => parseCommand([], undefined)).toThrow();
    expect(() =>
      parseCommand(['--run', 'config', 'dir', 'a'.repeat(64)], undefined),
    ).toThrow();
    expect(() =>
      parseCommand(['--run', 'config', 'dir', 'bad'], '1'),
    ).toThrow();
    expect(() => parseCommand(['--run', 'config', 'dir'], '1')).toThrow();
    expect(
      parseCommand(['--run', 'config', 'dir', 'a'.repeat(64)], '1').mode,
    ).toBe('run');
    expect(parseCommand(['--preflight', 'config', 'dir'], undefined).mode).toBe(
      'preflight',
    );
  });
  it('exits before reading config or starting network when run opt-in is absent', async () => {
    const p = Bun.spawn(
      [
        'bun',
        'packages/dialer-server/src/coaching-replay/provider-cli.ts',
        '--run',
        '/does-not-exist',
        '/does-not-exist',
        'a'.repeat(64),
      ],
      { env: { PATH: process.env.PATH }, stdout: 'pipe', stderr: 'pipe' },
    );
    const [stdout, stderr, exit] = await Promise.all([
      new Response(p.stdout).text(),
      new Response(p.stderr).text(),
      p.exited,
    ]);
    expect(exit).not.toBe(0);
    expect(stdout).toBe('');
    expect(stderr).toContain('refused or failed');
    expect(stderr).not.toContain('OPENROUTER_API_KEY');
  });
});
