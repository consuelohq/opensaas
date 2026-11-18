import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildComputerCommand, computerEnvironment, executeComputerSteps, runComputerUse } from '../scripts/lib/computer-use';
import { ComputerUseInput } from '../scripts/lib/facade/schemas';

const host = { platform: 'darwin', diaInstalled: true, home: '/tmp/consuelo-test' } as const;

describe('computer.use', () => {
  const result = (data: unknown, exitCode = 0) => ({
    stdout: JSON.stringify(data), stderr: '', exitCode, timedOut: false, cancelled: false,
    runtimeMissing: false, stdoutTruncated: false, stderrTruncated: false,
  });

  it('uses the remaining deadline for viewport retry and navigation', async () => {
    const command = buildComputerCommand({ target: 'browser', browser: 'dia', action: 'open', url: 'https://example.com' }, host);
    let now = 100;
    const budgets: number[] = [];
    const outcome = await executeComputerSteps(command, 'open', () => 200 - now, async (_args, timeout) => {
      budgets.push(timeout);
      now += 40;
      return budgets.length === 1 ? result({ success: false, error: 'Auto-launch failed: CDP error 1 Target closed' }, 1)
        : result({ success: true });
    }, op => op());
    expect(outcome.ok).toBe(true);
    expect(budgets).toEqual([100, 60, 20]);
  });

  it('installs Chromium only for an explicit prelaunch missing-browser result', async () => {
    const command = buildComputerCommand({ target: 'browser', browser: 'chromium', action: 'open', url: 'https://example.com' }, host);
    const calls: string[] = [];
    const outcome = await executeComputerSteps(command, 'open', () => 2000, async args => {
      calls.push(args[0] === 'install' ? 'install' : 'open');
      if (calls.length === 1) return result({ success: false, error: 'Auto-launch failed: Chrome not found. Checked:\\n  - System Chrome installations' }, 1);
      return result({ success: true });
    }, op => op());
    expect(outcome.ok).toBe(true);
    expect(calls).toEqual(['open', 'install', 'open']);
    let attempts = 0;
    await executeComputerSteps(command, 'open', () => 2000, async () => {
      attempts++;
      return result({ success: false, error: 'Navigation failed' }, 1);
    }, op => op());
    expect(attempts).toBe(1);
  });

  it('does not dispatch another process after the shared deadline expires', async () => {
    const command = buildComputerCommand({ target: 'browser', browser: 'dia', action: 'open', url: 'https://example.com' }, host);
    let remaining = 25;
    let calls = 0;
    const outcome = await executeComputerSteps(command, 'open', () => remaining, async () => {
      calls++;
      remaining = 0;
      return result({ success: true });
    }, op => op());
    expect(outcome.code).toBe('TIMEOUT');
    expect(calls).toBe(1);
  });

  it('returns a typed failure when the profile lock cannot be created', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'computer-use-lock-'));
    try {
      const home = join(dir, 'not-a-directory');
      writeFileSync(home, '');
      const input = ComputerUseInput.parse({ target: 'browser', browser: 'chromium', action: 'snapshot' });
      await expect(runComputerUse(input, { CONSUELO_HOME: home }, 500))
        .resolves.toMatchObject({ ok: false, code: 'COMMAND_FAILED' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('retains operator policies while isolating profile, routing and physical-input settings', () => {
    const env = computerEnvironment({
      AGENT_BROWSER_ALLOWED_DOMAINS: 'example.com',
      AGENT_BROWSER_ACTION_POLICY: '/policies/browser.json',
      AGENT_BROWSER_AUTO_CONNECT: 'true',
      AGENT_DESKTOP_HEADED: 'true',
      PATH: '/bin',
    });
    expect(env).toEqual({
      AGENT_BROWSER_ALLOWED_DOMAINS: 'example.com',
      AGENT_BROWSER_ACTION_POLICY: '/policies/browser.json',
      PATH: '/bin',
    });
  });

  it('observes a specific native window without physical input', () => {
    const command = buildComputerCommand(ComputerUseInput.parse({
      action: 'snapshot', app: 'Finder', windowId: 'w-17',
    }), host);
    expect(command.args).toEqual(expect.arrayContaining(['snapshot', '--app', 'Finder', '--window-id', 'w-17']));
    expect(command.args).not.toContain('--headed');
  });

  it('keeps desktop text on stdin and opts into headed input only on request', () => {
    const input = ComputerUseInput.parse({ action: 'fill', ref: '@sabc123:e4', text: '--headed' });
    const command = buildComputerCommand(input, host);
    expect(command.args).toContain('--stdin');
    expect(command.args).not.toContain('--headed');
    expect(command.stdin).toBe('--headed');
    expect(buildComputerCommand({ ...input, headed: true }, host).args).toContain('--headed');
  });

  it('selects an OS-owned Dia profile on Mac and scopes close to one browser session', () => {
    const input = ComputerUseInput.parse({ target: 'browser', action: 'open', url: 'https://example.com' });
    const command = buildComputerCommand(input, host);
    expect(command.command).toBe('agent-browser');
    expect(command.args).toContain('--profile');
    expect(command.args.join(' ')).toContain(host.home);
    expect(command.args).toContain('false');
    expect(command.setupArgs?.slice(-4)).toEqual(['set', 'viewport', '1280', '800']);
    const close = buildComputerCommand(ComputerUseInput.parse({ target: 'browser', action: 'close' }), host);
    expect(close.args).toContain('--session');
    expect(close.args).not.toContain('--all');
  });

  it('rejects selectors, native refs and routing flags on the wrong surface', () => {
    for (const input of [
      { action: 'click', ref: '@e2' },
      { action: 'click', app: 'Finder', ref: '@ssnapshot:e1' },
      { action: 'windows', windowId: 'w-17' },
      { target: 'browser', action: 'click', ref: '@sabc123:e4' },
      { target: 'browser', action: 'open', url: 'file:///tmp/private' },
      { action: 'press', key: '--headed', app: 'Dia' },
      { target: 'browser', action: 'snapshot', session: '../default' },
    ]) {
      expect(() => buildComputerCommand(ComputerUseInput.parse(input), host)).toThrow();
    }
  });

  it('fails explicitly when Dia is requested on a node without it', () => {
    expect(() => buildComputerCommand(ComputerUseInput.parse({
      target: 'browser', browser: 'dia', action: 'snapshot',
    }), { ...host, diaInstalled: false })).toThrow(/Dia/);
  });
});
