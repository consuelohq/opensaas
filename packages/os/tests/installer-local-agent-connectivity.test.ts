import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let osHome: string;
let userHome: string;

beforeEach(() => {
  osHome = mkdtempSync(join(tmpdir(), 'consuelo-installer-agent-os-'));
  userHome = mkdtempSync(join(tmpdir(), 'consuelo-installer-agent-user-'));
});

afterEach(() => {
  rmSync(osHome, { recursive: true, force: true });
  rmSync(userHome, { recursive: true, force: true });
});

describe('installer local agent connectivity', () => {
  it('reports connected only after the installed MCP command is verified', () => {
    mkdirSync(join(userHome, '.config', 'opencode'), { recursive: true });

    const stdout = execFileSync('bun', [
      './scripts/install.ts',
      '--yes',
      '--json',
      '--home',
      osHome,
      '--mode',
      'local',
      '--connect-agent',
      'opencode',
      '--skip-daemons',
    ], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: userHome,
        CONSUELO_HOME: osHome,
        CONSUELO_OS_DEV_DIAGNOSTICS: '0',
      },
      encoding: 'utf8',
      timeout: 120_000,
    });

    const payload = JSON.parse(stdout) as {
      agents: Array<{ name: string; status: string }>;
    };
    expect(payload.agents.find((agent) => agent.name === 'opencode')).toMatchObject({
      status: 'verified',
    });

    const persisted = JSON.parse(readFileSync(join(osHome, 'config.json'), 'utf8')) as {
      agents: Array<{ name: string; status: string }>;
    };
    expect(persisted.agents.find((agent) => agent.name === 'opencode')).toMatchObject({
      status: 'verified',
    });

    const commandPath = join(osHome, 'bin', 'consuelo-os-mcp');
    expect(existsSync(commandPath)).toBe(true);
    expect(statSync(commandPath).mode & 0o111).not.toBe(0);

    const openCodeConfig = JSON.parse(
      readFileSync(join(userHome, '.config', 'opencode', 'opencode.json'), 'utf8'),
    ) as { mcp: Record<string, { command: string[] }> };
    expect(openCodeConfig.mcp['consuelo-os'].command).toEqual([commandPath]);

    const launcher = readFileSync(join(osHome, 'sites', 'index.html'), 'utf8');
    const settings = readFileSync(join(osHome, 'sites', 'configuration', 'index.html'), 'utf8');
    const settingsSnapshot = JSON.parse(
      readFileSync(join(osHome, 'sites', '.data', 'configuration', 'snapshot.json'), 'utf8'),
    ) as {
      localAgents: Array<{ name: string; status: string; message?: string }>;
    };
    expect(launcher).toContain('Connected to 1 local agent');
    expect(launcher).toContain('OpenCode');
    expect(settings).toContain('/gateway/configuration/snapshot');
    expect(settings).not.toContain('OpenCode MCP connection is verified.');
    expect(settingsSnapshot.localAgents.find((agent) => agent.name === 'opencode')).toMatchObject({
      status: 'verified',
      message: 'OpenCode MCP connection is verified.',
    });
    expect(existsSync(join(osHome, 'consuelo.db'))).toBe(false);
  });
});
