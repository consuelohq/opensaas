import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildComputerCommand, computerEnvironment, executeComputerSteps, runComputerUse, withBrowserDecision } from '../scripts/lib/computer-use';
import { ComputerUseInput } from '../scripts/lib/facade/schemas';

const host = { platform: 'darwin', arch: 'arm64', diaInstalled: true, home: '/tmp/consuelo-test' } as const;

describe('computer.use', () => {
  const result = (data: unknown, exitCode = 0) => ({
    stdout: JSON.stringify(data), stderr: '', exitCode, timedOut: false, cancelled: false,
    runtimeMissing: false, stdoutTruncated: false, stderrTruncated: false,
  });

  it('binds each browser decision to a named session and requires explicit approval to confirm', () => {
    const browser = { target: 'browser', browser: 'dia', session: 'example' };
    const confirmationId = '94f75b78-adca-4108-83f9-c295e489f4a1';
    for (const action of ['confirm', 'deny']) {
      const input = { ...browser, action, confirmationId, ...(action === 'confirm' ? { approved: true } : {}) };
      const decision = buildComputerCommand(ComputerUseInput.parse(input), host);
      const origin = buildComputerCommand(ComputerUseInput.parse({ ...browser, action: 'click', ref: '@e1' }), host);
      expect(decision.args.slice(0, 2)).toEqual(origin.args.slice(0, 2));
      expect(decision.args).toContain(action);
      expect(decision.args).not.toContain('--profile');
      expect(decision.profile).toBe(origin.profile);
    }
    for (const invalid of [
      { ...browser, action: 'confirm', confirmationId },
      { ...browser, action: 'deny' },
      { action: 'confirm', confirmationId, approved: true },
      { ...browser, action: 'click', ref: '@e1', approved: true },
    ]) expect(ComputerUseInput.safeParse(invalid).success).toBe(false);
  });

  it('consumes a browser decision once and rejects stale or foreign IDs before provider dispatch', async () => {
    const home = mkdtempSync(join(tmpdir(), 'computer-use-confirm-'));
    const browser = { target: 'browser', browser: 'chromium', session: 'origin' } as const;
    let executions = 0;
    const request = ComputerUseInput.parse({ ...browser, action: 'click', ref: '@e1' });
    const command = (input: typeof request) => buildComputerCommand(input, { ...host, home });
    try {
      const parked = await withBrowserDecision(request, command(request), false, async () => ({
        ok: false, code: 'APPROVAL_REQUIRED', message: 'pending', data: { confirmation_id: 'native-1', action: 'click' },
      }));
      const confirmationId = (parked.data as { confirmation_id: string }).confirmation_id;
      const blocked = await withBrowserDecision(request, command(request), false, async () => { throw Error('unexpected dispatch'); });
      expect(blocked).toMatchObject({ code: 'APPROVAL_REQUIRED', data: null });
      const decide = (session: string, policy = false) => {
        const input = ComputerUseInput.parse({ ...browser, session, action: 'confirm', confirmationId, approved: true });
        const decision = command(input);
        return withBrowserDecision(input, decision, policy, async () => {
          executions++;
          expect(decision.args.slice(-2)).toEqual(['confirm', 'native-1']);
          return { ok: true, code: 'OK', message: 'confirmed', data: {} };
        });
      };
      expect((await decide('another')).code).toBe('INVALID_INPUT');
      expect((await decide('origin', true)).code).toBe('INVALID_INPUT');
      expect(executions).toBe(0);
      expect((await decide('origin')).ok).toBe(true);
      expect((await decide('origin')).code).toBe('INVALID_INPUT');
      expect(executions).toBe(1);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('surfaces a failed provider replay as a failed browser decision', async () => {
    const command = buildComputerCommand({ target: 'browser', action: 'confirm' }, host);
    const replay = { success: true, data: { confirmed: true, result: { success: false, error: 'Element detached' } } };
    const outcome = await executeComputerSteps(command, 'confirm', () => 1000, async () => result(replay), op => op());
    expect(outcome).toMatchObject({ ok: false, code: 'COMMAND_FAILED', message: 'Element detached' });
  });

  it.each(['--', '--headed', '', 'two words'])('sends literal browser fill text %j after a delimiter', text => {
    const command = buildComputerCommand({ target: 'browser', browser: 'chromium', action: 'fill', ref: '@e2', text }, host);
    expect(JSON.parse(command.stdin!)).toEqual([['fill', '@e2', '--', text]]);
  });

  it.each(['click', 'fill'] as const)('reports a pending browser %s approval without continuing', async action => {
    const command = buildComputerCommand({ target: 'browser', browser: 'chromium', action, ref: '@e2', text: 'test' }, host);
    const confirmation = { confirmation_required: true, confirmation_id: 'abc', action };
    const payload = action === 'fill' ? [{ success: true, result: confirmation }] : { success: true, data: confirmation };
    const outcome = await executeComputerSteps(command, action, () => 2000, async () => result(payload), op => op());
    expect(outcome).toMatchObject({ ok: false, code: 'APPROVAL_REQUIRED', data: confirmation });
  });

  it.each([
    'Auto-launch failed: Chrome not found. Checked:',
    'Auto-launch failed: Chrome exited early (exit code: 127) without writing DevToolsActivePort\nerror while loading shared libraries: libnss3.so: cannot open shared object file',
  ])('provisions Linux x64 browser libraries before navigating again', async error => {
    const command = buildComputerCommand({ target: 'browser', action: 'open', url: 'https://example.com' },
      { ...host, platform: 'linux', arch: 'x64', diaInstalled: false });
    const calls: string[][] = [];
    const outcome = await executeComputerSteps(command, 'open', () => 2000, async args => {
      calls.push(args);
      return calls.length === 1 ? result({ success: false, error }, 1) : result({ success: true });
    }, op => op());
    expect(outcome.ok).toBe(true);
    expect(calls).toEqual([command.args, ['install', '--with-deps'], command.args]);
  });

  it('reports required Linux package-manager access before retrying a launch', async () => {
    const command = buildComputerCommand({ target: 'browser', action: 'open', url: 'https://example.com' },
      { ...host, platform: 'linux', arch: 'x64', diaInstalled: false });
    const calls: string[][] = [];
    const outcome = await executeComputerSteps(command, 'open', () => 2000, async args => {
      calls.push(args);
      if (args[0] === 'install') return { ...result(null, 1), stderr: 'root privileges are required for the system package manager' };
      return result({ success: false, error: 'Auto-launch failed: Chrome not found. Checked:' }, 1);
    }, op => op());
    expect(calls).toHaveLength(2);
    expect(outcome).toMatchObject({ ok: false, code: 'APPROVAL_REQUIRED' });
    expect(outcome.message).toContain('agent-browser install --with-deps');
  });

  it('selects the distribution Chromium on Linux ARM64 and never calls the unsupported installer', async () => {
    const linux = { ...host, platform: 'linux' as const, diaInstalled: false };
    const input = { target: 'browser', action: 'open', url: 'https://example.com' } as const;
    expect(() => buildComputerCommand(input, linux)).toThrow(/distribution Chromium/);
    const command = buildComputerCommand(input, { ...linux, systemChromium: '/usr/bin/chromium' });
    expect(command.args).toEqual(expect.arrayContaining(['--executable-path', '/usr/bin/chromium']));
    let calls = 0;
    await executeComputerSteps(command, 'open', () => 100, async () => {
      calls++;
      return result({ success: false, error: 'Auto-launch failed: Chrome not found. Checked:' }, 1);
    }, op => op());
    expect(calls).toBe(1);
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

  it.each([undefined, '', '   ', ' , , '])('reports a profile lock failure with an empty domain policy (%j)', async policy => {
    const dir = mkdtempSync(join(tmpdir(), 'computer-use-lock-'));
    try {
      const home = join(dir, 'not-a-directory');
      writeFileSync(home, '');
      const input = ComputerUseInput.parse({ target: 'browser', browser: 'chromium', action: 'snapshot' });
      await expect(runComputerUse(input, { CONSUELO_HOME: home, AGENT_BROWSER_ALLOWED_DOMAINS: policy }, 500))
        .resolves.toMatchObject({ ok: false, code: 'COMMAND_FAILED' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports incompatible persistent profiles before creating files or starting a browser', async () => {
    const home = mkdtempSync(join(tmpdir(), 'computer-use-policy-'));
    try {
      const input = ComputerUseInput.parse({ target: 'browser', browser: 'chromium', action: 'open', url: 'http://127.0.0.1:9' });
      const outcome = await runComputerUse(input, { CONSUELO_HOME: home, AGENT_BROWSER_ALLOWED_DOMAINS: '127.0.0.1' }, 100);
      expect(outcome).toMatchObject({ ok: false, code: 'INVALID_INPUT' });
      expect(outcome.message).toMatch(/allowed.domains.*persistent profile/i);
      expect(readdirSync(home)).toEqual([]);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('retains operator policies while isolating profile, routing and physical-input settings', () => {
    const env = computerEnvironment({
      AGENT_BROWSER_ALLOWED_DOMAINS: 'example.com',
      AGENT_BROWSER_ACTION_POLICY: '/policies/browser.json',
      AGENT_BROWSER_MAX_OUTPUT: '2048',
      AGENT_BROWSER_CONFIRM_INTERACTIVE: 'true',
      AGENT_BROWSER_CONFIRM_ACTIONS: 'click,fill',
      AGENT_BROWSER_AUTO_CONNECT: 'true',
      AGENT_DESKTOP_HEADED: 'true',
      PATH: '/bin',
    });
    expect(env).toEqual({
      AGENT_BROWSER_MAX_OUTPUT: '2048',
      AGENT_BROWSER_CONFIRM_ACTIONS: 'click,fill',
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
    expect(close.args).not.toContain('--profile');
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
