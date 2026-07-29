import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { provisionLocalOs } from '../scripts/lib/install-state';
import {
  configureLocalAgents,
  detectLocalAgents,
  localAgentMcpCommandPath,
  parseMcpJsonLines,
  verifyLocalAgents,
  type AgentName,
} from '../scripts/lib/local-agent-connectivity';

let osHome: string;
let userHome: string;
const daemonProcesses: ChildProcess[] = [];

beforeEach(() => {
  osHome = mkdtempSync(join(tmpdir(), 'consuelo-agent-os-'));
  userHome = mkdtempSync(join(tmpdir(), 'consuelo-agent-user-'));
});

afterEach(() => {
  for (const daemon of daemonProcesses.splice(0)) daemon.kill('SIGTERM');
  rmSync(osHome, { recursive: true, force: true });
  rmSync(userHome, { recursive: true, force: true });
});

function writeJson(path: string, value: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

async function getFreeTcpPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('failed to reserve a test port');
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function provisionAgentAndStartDaemon(agentName: AgentName): Promise<void> {
  const port = await getFreeTcpPort();
  execFileSync('bun', ['-e', `
    const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
    provisionLocalOs({
      home: process.env.CONSUELO_HOME,
      mode: 'local',
      port: Number(process.env.CONSUELO_TEST_PORT),
      connectAgents: [process.env.CONSUELO_TEST_AGENT],
    });
  `], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CONSUELO_HOME: osHome,
      CONSUELO_TEST_AGENT: agentName,
      CONSUELO_TEST_PORT: String(port),
      HOME: userHome,
    },
    encoding: 'utf8',
  });
  const daemon = spawn('bun', ['scripts/server/main.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CONSUELO_HOME: osHome,
      CONSUELO_OS_PORT: String(port),
      HOME: userHome,
    },
    stdio: 'ignore',
  });
  daemonProcesses.push(daemon);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {
      // The daemon is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Consuelo test daemon did not become healthy');
}

const supportedAgents: AgentName[] = [
  'codex',
  'cursor',
  'claude',
  'opencode',
  'factory',
  'gemini',
];

describe('local agent connectivity', () => {
  it('should parse newline-delimited MCP responses across partial UTF-8 chunks', () => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, result: { label: 'Consuelo ✓' } });
    const frame = Buffer.from(`\n\n${body}\n`, 'utf8');
    const splitAt = frame.length - 3;

    const partial = parseMcpJsonLines(frame.subarray(0, splitAt));
    expect(partial.messages).toEqual([]);
    expect(partial.remainder.equals(frame.subarray(2, splitAt))).toBe(true);

    const complete = parseMcpJsonLines(Buffer.concat([
      partial.remainder,
      frame.subarray(splitAt),
    ]));
    expect(complete.messages).toEqual([
      { jsonrpc: '2.0', id: 1, result: { label: 'Consuelo ✓' } },
    ]);
    expect(complete.remainder.length).toBe(0);
  });

  it('should emit JSON lines and skip blank request lines without recursion', () => {
    const source = readFileSync(
      join(process.cwd(), 'scripts', 'mcp-stdio.ts'),
      'utf8',
    );
    const writeStart = source.indexOf('function writeMessage');
    const writeEnd = source.indexOf('\n}\n\nasync function main', writeStart);
    const writeMessage = source.slice(writeStart, writeEnd);

    expect(writeMessage).toContain('process.stdout.write(`${body}\\n`);');
    expect(writeMessage).not.toContain('Content-Length');
    expect(source).not.toContain(
      'line.length > 0 ? line : takeMessage()',
    );
  });

  it('should detect local agents when provisioning uses the supplied user home', () => {
    // Arrange
    const codexHome = join(userHome, '.codex');
    mkdirSync(codexHome, { recursive: true });
    writeFileSync(join(codexHome, 'config.toml'), 'model = "gpt-5"\n');

    // Act
    const result = provisionLocalOs({
      home: osHome,
      userHome,
      mode: 'local',
    });

    // Assert
    expect(result.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'codex',
          homePath: codexHome,
          detected: true,
        }),
      ]),
    );
  });

  it('writes idempotent native MCP configuration for every supported client', () => {
    const configPaths = {
      codex: join(userHome, '.codex', 'config.toml'),
      cursor: join(userHome, '.cursor', 'mcp.json'),
      claude: join(userHome, '.claude.json'),
      opencode: join(userHome, '.config', 'opencode', 'opencode.json'),
      factory: join(userHome, '.factory', 'mcp.json'),
      gemini: join(userHome, '.gemini', 'settings.json'),
    } as const;

    mkdirSync(join(userHome, '.codex'), { recursive: true });
    writeFileSync(configPaths.codex, 'model = "gpt-5"\n');
    writeJson(configPaths.cursor, { theme: 'dark', mcpServers: { existing: { command: 'existing' } } });
    writeJson(configPaths.claude, { hasCompletedOnboarding: true, mcpServers: { existing: { command: 'existing' } } });
    writeJson(configPaths.opencode, { theme: 'system', mcp: { existing: { type: 'local', command: ['existing'] } } });
    writeJson(configPaths.factory, { telemetry: false, mcpServers: { existing: { command: 'existing' } } });
    writeJson(configPaths.gemini, { selectedAuthType: 'oauth-personal', mcpServers: { existing: { command: 'existing' } } });

    const first = configureLocalAgents({
      home: osHome,
      userHome,
      agentNames: supportedAgents,
    });
    const commandPath = localAgentMcpCommandPath(osHome);

    expect(first.agents.filter((agent) => supportedAgents.includes(agent.name))).toEqual(
      expect.arrayContaining(
        supportedAgents.map((name) => expect.objectContaining({ name, status: 'configured' })),
      ),
    );
    expect(existsSync(commandPath)).toBe(true);
    expect(statSync(commandPath).mode & 0o111).not.toBe(0);
    const commandSource = readFileSync(commandPath, 'utf8');
    expect(commandSource).toContain('$OS_HOME/runtime/current/scripts/mcp-stdio.ts');
    expect(commandSource).not.toContain('$OS_HOME/runtime/current/packages/os/scripts/mcp-stdio.ts');

    const codexConfig = readFileSync(configPaths.codex, 'utf8');
    expect(codexConfig).toContain('model = "gpt-5"');
    expect(codexConfig).toContain('[mcp_servers."consuelo"]');
    expect(codexConfig).toContain(`command = ${JSON.stringify(commandPath)}`);
    expect(codexConfig.match(/BEGIN CONSUELO MCP/g)).toHaveLength(1);

    const cursor = readJson(configPaths.cursor);
    expect(cursor.theme).toBe('dark');
    expect(cursor.mcpServers).toMatchObject({
      existing: { command: 'existing' },
      consuelo: {
        type: 'stdio',
        command: commandPath,
        args: [],
        env: { CONSUELO_HOME: osHome, CONSUELO_AGENT_ID: 'cursor' },
      },
    });

    const claude = readJson(configPaths.claude);
    expect(claude.hasCompletedOnboarding).toBe(true);
    expect(claude.mcpServers).toMatchObject({
      existing: { command: 'existing' },
      consuelo: {
        command: commandPath,
        args: [],
        env: { CONSUELO_HOME: osHome, CONSUELO_AGENT_ID: 'claude' },
      },
    });

    const opencode = readJson(configPaths.opencode);
    expect(opencode.theme).toBe('system');
    expect(opencode.mcp).toMatchObject({
      existing: { type: 'local', command: ['existing'] },
      consuelo: {
        type: 'local',
        command: [commandPath],
        cwd: osHome,
        enabled: true,
        environment: { CONSUELO_HOME: osHome, CONSUELO_AGENT_ID: 'opencode' },
      },
    });

    for (const name of ['factory', 'gemini'] as const) {
      const config = readJson(configPaths[name]);
      expect(config.mcpServers).toMatchObject({
        existing: { command: 'existing' },
        consuelo: {
          command: commandPath,
          args: [],
          env: { CONSUELO_HOME: osHome, CONSUELO_AGENT_ID: name },
        },
      });
    }

    const contentsAfterFirst = Object.fromEntries(
      Object.entries(configPaths).map(([name, configPath]) => [name, readFileSync(configPath, 'utf8')]),
    );
    for (const configPath of Object.values(configPaths)) {
      expect(existsSync(`${configPath}.bak`)).toBe(true);
    }

    configureLocalAgents({ home: osHome, userHome, agentNames: supportedAgents });

    for (const [name, configPath] of Object.entries(configPaths)) {
      expect(readFileSync(configPath, 'utf8')).toBe(contentsAfterFirst[name]);
      expect(existsSync(`${configPath}.bak`)).toBe(true);
    }
  });

  it('does not treat legacy sidecars or connected booleans as verified', () => {
    mkdirSync(join(userHome, '.codex'), { recursive: true });
    writeJson(join(userHome, '.codex', 'consuelo-os.json'), {
      name: 'codex',
      osHome,
      connectedAt: '2026-06-01T00:00:00.000Z',
    });
    writeJson(join(osHome, 'config.json'), {
      version: 1,
      mode: 'local',
      home: osHome,
      port: 8960,
      artifactStorage: 'local',
      agents: [{
        name: 'codex',
        homePath: join(userHome, '.codex'),
        configPath: join(userHome, '.codex', 'consuelo-os.json'),
        connected: true,
        connectedAt: '2026-06-01T00:00:00.000Z',
      }],
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    });

    const codex = detectLocalAgents({ home: osHome, userHome }).find((agent) => agent.name === 'codex');

    expect(codex).toMatchObject({ detected: true, status: 'detected' });
    expect(codex).not.toHaveProperty('connected');
  });

  it('fails closed and preserves malformed client configuration', () => {
    const cursorConfigPath = join(userHome, '.cursor', 'mcp.json');
    mkdirSync(join(userHome, '.cursor'), { recursive: true });
    writeFileSync(cursorConfigPath, '{ malformed json\n');

    const result = configureLocalAgents({
      home: osHome,
      userHome,
      agentNames: ['cursor'],
    });

    expect(result.agents.find((agent) => agent.name === 'cursor')).toMatchObject({
      status: 'failed',
      error: expect.objectContaining({ code: 'AGENT_CONFIG_MALFORMED' }),
    });
    expect(readFileSync(cursorConfigPath, 'utf8')).toBe('{ malformed json\n');
    expect(existsSync(`${cursorConfigPath}.bak`)).toBe(false);
  });

  it('keeps Pi detectable but unsupported', () => {
    mkdirSync(join(userHome, 'Library', 'Application Support', 'Pi'), { recursive: true });

    const result = configureLocalAgents({
      home: osHome,
      userHome,
      agentNames: ['pi'],
    });

    expect(result.agents.find((agent) => agent.name === 'pi')).toMatchObject({
      detected: true,
      status: 'unsupported',
    });
  });

  it('persists verified only after the installed stdio command completes an MCP handshake', async () => {
    mkdirSync(join(userHome, '.config', 'opencode'), { recursive: true });
    await provisionAgentAndStartDaemon('opencode');
    const before = detectLocalAgents({ home: osHome, userHome }).find((agent) => agent.name === 'opencode');
    expect(before).toMatchObject({ status: 'configured' });

    const verification = await verifyLocalAgents({
      home: osHome,
      userHome,
      agentNames: ['opencode'],
      timeoutMs: 10_000,
    });

    expect(verification.handshake).toMatchObject({
      protocolVersion: '2024-11-05',
    });
    expect(Number.isInteger(verification.handshake?.toolCount)).toBe(true);
    expect((verification.handshake?.toolCount ?? 0) > 0).toBe(true);
    expect(verification.agents.find((agent) => agent.name === 'opencode')).toMatchObject({
      status: 'verified',
    });

    const persisted = readJson(join(osHome, 'config.json'));
    expect(persisted.agents).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'opencode', status: 'verified' })]),
    );
    expect(detectLocalAgents({ home: osHome, userHome }).find((agent) => agent.name === 'opencode')).toMatchObject({
      status: 'verified',
    });

    const integration = JSON.parse(execFileSync('bun', ['-e', `
      const path = await import('node:path');
      const fs = await import('node:fs');
      const { materializeSites } = await import('./scripts/lib/sites.ts');
      const { getCapabilityHealth } = await import('./scripts/lib/capabilities.ts');
      const home = process.env.CONSUELO_HOME;
      const dbPath = path.join(home, 'node', 'db', 'consuelo.db');
      materializeSites({ home, dbPath, dryRun: false });
      process.stdout.write(JSON.stringify({
        health: getCapabilityHealth(home),
        launcher: fs.readFileSync(path.join(home, 'sites', 'index.html'), 'utf8'),
        configuration: fs.readFileSync(path.join(home, 'sites', 'configuration', 'index.html'), 'utf8'),
        configurationSnapshot: JSON.parse(fs.readFileSync(
          path.join(home, 'sites', '.data', 'configuration', 'snapshot.json'),
          'utf8',
        )),
        legacyDbExists: fs.existsSync(path.join(home, 'consuelo.db')),
      }));
    `], {
      cwd: process.cwd(),
      env: { ...process.env, CONSUELO_HOME: osHome, HOME: userHome },
      encoding: 'utf8',
    })) as {
      health: Array<{ id: string; status: string; details?: unknown }>;
      launcher: string;
      configuration: string;
      configurationSnapshot: {
        localAgents: Array<{ name: string; status: string }>;
      };
      legacyDbExists: boolean;
    };

    expect(integration.health.find((check) => check.id === 'sqlite')).toMatchObject({ status: 'connected' });
    expect(integration.health.find((check) => check.id === 'agent-connections')).toMatchObject({
      status: 'connected',
      details: ['opencode'],
    });
    expect(integration.launcher).toContain("agentStatusUrl.searchParams.set('workspace_host'");
    expect(integration.launcher).toContain("countElement.textContent = 'Connected to ' + count");
    expect(integration.launcher).toContain('item.textContent = agent.label');
    expect(integration.configuration).toContain('<title>Configuration');
    expect(integration.configurationSnapshot.localAgents).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'opencode', status: 'verified' })]),
    );
    expect(integration.legacyDbExists).toBe(false);
  });

  it('persists verification outcomes independently for each configured agent', async () => {
    mkdirSync(join(userHome, '.config', 'opencode'), { recursive: true });
    mkdirSync(join(userHome, '.cursor'), { recursive: true });
    await provisionAgentAndStartDaemon('opencode');
    configureLocalAgents({ home: osHome, userHome, agentNames: ['cursor'] });

    const credentialPath = join(
      osHome,
      'node',
      'security',
      'generated',
      'local-agent-mcp.json',
    );
    const credentials = readJson(credentialPath);
    const agents = credentials.agents as Record<string, unknown>;
    agents.cursor = {
      tokenId: 'invalid-cursor-token',
      bearerToken: 'invalid-cursor-secret',
    };
    writeJson(credentialPath, credentials);

    const verification = await verifyLocalAgents({
      home: osHome,
      userHome,
      agentNames: ['cursor', 'opencode'],
      timeoutMs: 10_000,
    });

    expect(verification.agents.find((agent) => agent.name === 'opencode')).toMatchObject({
      status: 'verified',
    });
    expect(verification.agents.find((agent) => agent.name === 'cursor')).toMatchObject({
      status: 'failed',
      error: expect.objectContaining({ code: 'MCP_HANDSHAKE_FAILED' }),
    });

    const persisted = readJson(join(osHome, 'config.json'));
    expect(persisted.agents).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'opencode', status: 'verified' }),
      expect.objectContaining({ name: 'cursor', status: 'failed' }),
    ]));
  });

  it('requires re-verification after a selected client is reconfigured', async () => {
    mkdirSync(join(userHome, '.config', 'opencode'), { recursive: true });
    await provisionAgentAndStartDaemon('opencode');
    await verifyLocalAgents({ home: osHome, userHome, agentNames: ['opencode'] });
    expect(detectLocalAgents({ home: osHome, userHome }).find((agent) => agent.name === 'opencode')).toMatchObject({
      status: 'verified',
    });

    const reconfigured = configureLocalAgents({ home: osHome, userHome, agentNames: ['opencode'] });
    expect(reconfigured.agents.find((agent) => agent.name === 'opencode')).toMatchObject({
      status: 'configured',
    });
    expect(detectLocalAgents({ home: osHome, userHome }).find((agent) => agent.name === 'opencode')).toMatchObject({
      status: 'configured',
    });
  });
});
