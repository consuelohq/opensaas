import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tempHome: string;
let tempUserHome: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-os-install-'));
  tempUserHome = mkdtempSync(join(tmpdir(), 'consuelo-user-home-'));
});

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true });
  rmSync(tempUserHome, { recursive: true, force: true });
});

function runBunEval(code: string): string {
  return execFileSync('bun', ['-e', code], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CONSUELO_HOME: tempHome,
      HOME: tempUserHome,
      CONSUELO_GRAPHQL_URL: '',
      CONSUELO_INTERNAL_GRAPHQL_API_KEY: '',
    },
    encoding: 'utf8',
  });
}

describe('local OS install state', () => {
  it('plans a dry run without creating files', () => {
    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ dryRun: true });
      process.stdout.write(JSON.stringify(result));
    `));

    expect(result.home).toBe(tempHome);
    expect(result.actions.some((action: { status: string }) => action.status === 'planned')).toBe(true);
    for (const expectedPath of [
      join('workspaces', 'local-consuelo-os', 'shared'),
      join('node', 'workspaces', 'local-consuelo-os', 'state'),
    ]) {
      expect(result.actions.some(
        (action: { type: string; path: string; status: string }) =>
          action.type === 'create_dir' &&
          action.path.endsWith(expectedPath) &&
          action.status === 'planned',
      )).toBe(true);
    }
    expect(existsSync(join(tempHome, 'config.json'))).toBe(false);
  });

  it('indexes immutable runtime components without hidden editable bundled copies', () => {
    JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local', selectedSkills: ['task'] });
      process.stdout.write(JSON.stringify(result));
    `));

    expect(existsSync(join(tempHome, 'skills', 'task'))).toBe(false);
    expect(existsSync(join(tempHome, 'tools', 'status'))).toBe(false);

    const skillsIndex = JSON.parse(readFileSync(join(tempHome, 'components', 'installed-skills.json'), 'utf8'));
    expect(skillsIndex).toMatchObject({
      schemaVersion: 1,
      kind: 'consuelo-installed-skill-index',
      selected: [expect.objectContaining({
        id: 'task',
        kind: 'skill',
        ownership: 'bundled-managed',
      })],
    });

    const toolsIndex = JSON.parse(readFileSync(join(tempHome, 'components', 'installed-tools.json'), 'utf8'));
    expect(toolsIndex.kind).toBe('consuelo-installed-tool-index');
    expect(toolsIndex.components.some((component: { id: string; ownership: string }) =>
      component.id === 'status' && component.ownership === 'bundled-managed',
    )).toBe(true);

    const provenance = JSON.parse(readFileSync(join(tempHome, 'components', 'provenance.json'), 'utf8'));
    const plan = JSON.parse(readFileSync(join(tempHome, 'components', 'update-plan.json'), 'utf8'));
    expect(provenance.kind).toBe('consuelo-managed-component-provenance');
    expect(plan).toMatchObject({
      schemaVersion: 1,
      kind: 'consuelo-managed-component-update-plan',
      summary: expect.objectContaining({ requiresReview: 0 }),
    });
  });

  it('fails closed when existing managed component provenance is corrupt', () => {
    JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      process.stdout.write(JSON.stringify(provisionLocalOs({ mode: 'local', selectedSkills: ['task'] })));
    `));
    writeFileSync(join(tempHome, 'components', 'provenance.json'), '{not-json');

    expect(() => runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      process.stdout.write(JSON.stringify(provisionLocalOs({ mode: 'local', selectedSkills: ['task'] })));
    `)).toThrow();
    expect(readFileSync(join(tempHome, 'components', 'provenance.json'), 'utf8')).toBe('{not-json');
  });

  it('rewrites existing ChatGPT MCP config to the central endpoint without rotating tokens', () => {
    JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      process.stdout.write(JSON.stringify(provisionLocalOs({ mode: 'local' })));
    `));

    const connectionPath = join(tempHome, 'node', 'security', 'generated', 'chatgpt-mcp.json');
    const authPath = join(tempHome, 'node', 'security', 'generated', 'auth.json');
    const before = JSON.parse(readFileSync(connectionPath, 'utf8'));
    const storedAuth = JSON.parse(readFileSync(authPath, 'utf8'));
    storedAuth.tokens[before.tokenId].scopes = ['route:/mcp:read', 'tool:*:read'];
    writeFileSync(authPath, JSON.stringify(storedAuth, null, 2));
    writeFileSync(connectionPath, JSON.stringify({
      ...before,
      url: 'https://legacy-workspace.consuelohq.com/mcp',
      scopes: ['route:/mcp:read', 'tool:*:read'],
    }, null, 2));

    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));

    const chatgptMcp = JSON.parse(readFileSync(connectionPath, 'utf8'));
    const updatedAuth = JSON.parse(readFileSync(authPath, 'utf8'));
    expect(chatgptMcp).toMatchObject({
      url: 'https://os.consuelohq.com/mcp',
      tokenId: before.tokenId,
      bearerToken: before.bearerToken,
      scopes: ['route:/mcp:read', 'mcp:call', 'os:tools'],
    });
    expect(updatedAuth.tokens[before.tokenId].scopes).toEqual([
      'route:/mcp:read',
      'mcp:call',
      'os:tools',
    ]);
    expect(JSON.stringify(updatedAuth)).not.toContain(before.bearerToken);
    const auditLog = readFileSync(join(tempHome, 'node', 'logs', 'gateway-audit.jsonl'), 'utf8');
    expect(auditLog).toContain('gateway.credential.scopes_updated');
    expect(auditLog).not.toContain(before.bearerToken);
    expect(result.actions.some((action: { path: string; status: string }) => action.path.endsWith(join('security', 'generated', 'chatgpt-mcp.json')) && action.status === 'updated')).toBe(true);
  });

  it('replaces stale ChatGPT MCP metadata when its stored credential is missing', () => {
    mkdirSync(join(tempHome, 'node', 'security', 'generated'), { recursive: true });
    const connectionPath = join(tempHome, 'node', 'security', 'generated', 'chatgpt-mcp.json');
    writeFileSync(connectionPath, JSON.stringify({
      version: 1,
      kind: 'consuelo-chatgpt-mcp-connection',
      auth: 'bearer',
      url: 'https://os.consuelohq.com/mcp',
      localUrl: 'http://127.0.0.1:46321/mcp',
      tokenId: 'tok_missing',
      bearerToken: 'cst_stale_fixture',
      scopes: ['route:/mcp:read', 'tool:*:read'],
      createdAt: '2026-06-13T00:00:00.000Z',
    }, null, 2));

    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      process.stdout.write(JSON.stringify(provisionLocalOs({ mode: 'local' })));
    `));

    const connection = JSON.parse(readFileSync(connectionPath, 'utf8'));
    const auth = JSON.parse(readFileSync(join(tempHome, 'node', 'security', 'generated', 'auth.json'), 'utf8'));
    expect(connection.tokenId).not.toBe('tok_missing');
    expect(connection.bearerToken).not.toBe('cst_stale_fixture');
    expect(connection.scopes).toEqual(['route:/mcp:read', 'mcp:call', 'os:tools']);
    expect(auth.tokens[connection.tokenId]).toMatchObject({
      status: 'active',
      scopes: ['route:/mcp:read', 'mcp:call', 'os:tools'],
    });
    expect(JSON.stringify(auth)).not.toContain(connection.bearerToken);
    expect(result.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: connectionPath,
        status: 'updated',
        message: 'ChatGPT MCP connection credential replaced',
      }),
    ]));
  });

  it('replaces an expired ChatGPT MCP credential during reprovisioning', () => {
    runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      provisionLocalOs({ mode: 'local' });
    `);
    const connectionPath = join(
      tempHome,
      'node',
      'security',
      'generated',
      'chatgpt-mcp.json',
    );
    const authPath = join(
      tempHome,
      'node',
      'security',
      'generated',
      'auth.json',
    );
    const before = JSON.parse(readFileSync(connectionPath, 'utf8')) as {
      tokenId: string;
      bearerToken: string;
    };
    const auth = JSON.parse(readFileSync(authPath, 'utf8')) as {
      tokens: Record<string, { expiresAt: string }>;
    };
    auth.tokens[before.tokenId].expiresAt = '2020-01-01T00:00:00.000Z';
    writeFileSync(authPath, JSON.stringify(auth, null, 2));

    runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      provisionLocalOs({ mode: 'local' });
    `);
    const after = JSON.parse(readFileSync(connectionPath, 'utf8')) as typeof before;

    expect(after.tokenId).not.toBe(before.tokenId);
    expect(after.bearerToken).not.toBe(before.bearerToken);
  });

  it('reports existing generated security assets as existing on reprovision', () => {
    JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));

    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));

    for (const expectedPath of [
      join('node', 'security', 'generated'),
      join('node', 'security', 'overrides'),
      join('node', 'security', 'generated', 'auth.json'),
      join('node', 'caddy', 'Caddyfile'),
    ]) {
      expect(result.actions.some((action: { path: string; status: string }) => action.path.endsWith(expectedPath) && action.status === 'preserved')).toBe(true);
    }
  });

  it('should reuse the active workspace and node when reprovisioning without a new bootstrap', () => {
    runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      provisionLocalOs({
        mode: 'local',
        workspaceBootstrap: {
          workspaceId: 'workspace_existing',
          workspaceSlug: 'existing',
          workspaceHost: 'existing.consuelohq.com',
          connectorId: 'connector_existing',
          connectorTransport: 'websocket-relay',
          nodeId: 'node_existing',
          nodeName: 'Existing Mac',
          nodeRole: 'home',
        },
      });
    `);

    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));

    const config = JSON.parse(readFileSync(result.configPath, 'utf8'));
    const auth = JSON.parse(readFileSync(
      join(tempHome, 'node', 'security', 'generated', 'auth.json'),
      'utf8',
    ));
    const globalConfig = readFileSync(join(tempHome, 'consuelo.yaml'), 'utf8');
    const nodeConfig = readFileSync(join(tempHome, 'node', 'node.yaml'), 'utf8');

    expect(config.workspace).toEqual({
      id: 'workspace_existing',
      slug: 'existing',
      host: 'existing.consuelohq.com',
    });
    expect(config.connector).toMatchObject({ id: 'connector_existing' });
    expect(auth.workspaceId).toBe('workspace_existing');
    expect(globalConfig).toContain('activeWorkspace: workspace_existing');
    expect(globalConfig).toContain('activeNode: node_existing');
    expect(nodeConfig).toContain('id: node_existing');
    expect(existsSync(join(tempHome, 'workspaces', 'local-consuelo-os'))).toBe(false);
  });


  it('should reject a noninteractive update when the active workspace conflicts with installed state', () => {
    runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      provisionLocalOs({
        mode: 'local',
        workspaceBootstrap: {
          workspaceId: 'workspace_existing',
          workspaceSlug: 'existing',
          workspaceHost: 'existing.consuelohq.com',
          connectorId: 'connector_existing',
          connectorTransport: 'websocket-relay',
          nodeId: 'node_existing',
          nodeName: 'Existing Mac',
          nodeRole: 'home',
        },
      });
    `);

    const globalConfigPath = join(tempHome, 'consuelo.yaml');
    writeFileSync(
      globalConfigPath,
      readFileSync(globalConfigPath, 'utf8').replace(
        'activeWorkspace: workspace_existing',
        'activeWorkspace: workspace_other',
      ),
    );

    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      try {
        provisionLocalOs({ mode: 'local' });
        process.stdout.write(JSON.stringify({ ok: true }));
      } catch (error: unknown) {
        process.stdout.write(JSON.stringify({
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        }));
      }
    `));

    expect(result).toEqual({
      ok: false,
      message: 'active workspace does not match the installed OS config',
    });
  });

  it('creates the approved local home shape and preserves existing config', () => {
    const first = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));

    for (const dir of [
      'agents',
      'components',
      'artifacts',
      'pages',
      'sites',
      'logs',
      'runs',
      'cache',
      'bin',
      'tmp',
      'runtime',
      'node',
      join('node', 'keys'),
      join('node', 'security'),
      join('node', 'tunnels'),
      join('node', 'caddy'),
      join('node', 'db'),
      'workspaces',
    ]) {
      expect(existsSync(join(tempHome, dir))).toBe(true);
    }
    for (const dir of ['skills', 'tools', 'scripts', 'src', 'manifests', 'workflows']) {
      expect(existsSync(join(tempHome, dir))).toBe(false);
    }
    for (const file of ['config.json', 'consuelo.yaml', join('node', 'node.yaml')]) {
      expect(existsSync(join(tempHome, file))).toBe(true);
    }
    expect(existsSync(join(tempHome, 'package.json'))).toBe(false);
    expect(existsSync(join(tempHome, 'bun.lock'))).toBe(false);
    expect(existsSync(join(tempHome, 'consuelo.db'))).toBe(false);
    expect(existsSync(join(tempHome, 'node', 'db', 'consuelo.db'))).toBe(true);
    expect(existsSync(join(tempHome, 'security', 'generated', 'auth.json'))).toBe(false);
    expect(existsSync(join(tempHome, 'security', 'generated', 'Caddyfile'))).toBe(false);
    expect(existsSync(join(tempHome, 'node', 'security', 'generated', 'auth.json'))).toBe(true);
    expect(existsSync(join(tempHome, 'node', 'caddy', 'Caddyfile'))).toBe(true);
    expect(existsSync(join(tempHome, 'workspaces', 'local-consuelo-os', 'shared', 'workspace.yaml'))).toBe(true);
    expect(existsSync(join(tempHome, 'source'))).toBe(false);
    expect(existsSync(join(tempHome, 'source', 'tools'))).toBe(false);
    expect(existsSync(join(tempHome, 'source', 'skills'))).toBe(false);
    expect(existsSync(join(tempHome, 'source', 'package.json'))).toBe(false);
    expect(existsSync(join(tempHome, 'skills', 'task'))).toBe(false);
    expect(existsSync(join(tempHome, 'tools', 'status'))).toBe(false);
    expect(existsSync(join(tempHome, 'components', 'installed-skills.json'))).toBe(true);
    expect(existsSync(join(tempHome, 'components', 'installed-tools.json'))).toBe(true);
    expect(existsSync(join(tempHome, 'components', 'provenance.json'))).toBe(true);
    expect(existsSync(join(tempHome, 'components', 'update-plan.json'))).toBe(true);
    expect(existsSync(join(tempHome, 'bin', 'status'))).toBe(true);
    const lifecycleCommand = readFileSync(
      join(tempHome, 'bin', 'consuelo'),
      'utf8',
    );
    expect(lifecycleCommand).toContain(
      '$OS_HOME/runtime/current/scripts/lifecycle.ts',
    );
    expect(lifecycleCommand).toContain(
      'CONSUELO_OS_PACKAGE_ROOT=*',
    );
    expect(lifecycleCommand).toContain(
      'BUN_BIN=*',
    );
    expect(lifecycleCommand).toContain(
      'exec "$BUN_EXECUTABLE"',
    );
    expect(lifecycleCommand).not.toContain('/Users/kokayi/');
    const fakePackageRoot = join(tempHome, 'local-package');
    const fakeBun = join(tempHome, 'managed-bun');
    mkdirSync(join(fakePackageRoot, 'scripts'), { recursive: true });
    writeFileSync(
      join(fakePackageRoot, 'scripts', 'lifecycle.ts'),
      '// lifecycle fixture\n',
    );
    writeFileSync(
      fakeBun,
      '#!/bin/bash\nprintf \'%s\\n\' "$@"\n',
      { mode: 0o755 },
    );
    writeFileSync(
      join(tempHome, '.env'),
      [
        `BUN_BIN=${fakeBun}`,
        `CONSUELO_OS_PACKAGE_ROOT=${fakePackageRoot}`,
        '',
      ].join('\n'),
      { mode: 0o600 },
    );
    const lifecycleInvocation = execFileSync(
      join(tempHome, 'bin', 'consuelo'),
      ['status', '--json'],
      {
        encoding: 'utf8',
        env: {
          CONSUELO_HOME: tempHome,
          PATH: '/usr/bin:/bin',
        },
      },
    );
    expect(lifecycleInvocation).toContain(
      join(fakePackageRoot, 'scripts', 'lifecycle.ts'),
    );
    expect(lifecycleInvocation).toContain('--home');
    expect(lifecycleInvocation).toContain(tempHome);
    expect(lifecycleInvocation).toContain('status');
    expect(lifecycleInvocation.trim().split('\n')).toEqual([
      join(fakePackageRoot, 'scripts', 'lifecycle.ts'),
      'status',
      '--home',
      tempHome,
      '--json',
    ]);
    expect(lifecycleInvocation).toContain('--json');
    expect(existsSync(join(tempHome, 'operator'))).toBe(false);
    const workspaceYaml = readFileSync(join(tempHome, 'workspaces', 'local-consuelo-os', 'shared', 'workspace.yaml'), 'utf8');
    expect(workspaceYaml).toContain('workspace:');
    expect(workspaceYaml).toContain('projects:');
    const chatgptMcp = JSON.parse(readFileSync(join(tempHome, 'node', 'security', 'generated', 'chatgpt-mcp.json'), 'utf8'));
    // The central router endpoint authenticates with OAuth and resolves the workspace from the
    // Google account; it rejects node-issued gateway bearers. The bearer is loopback-only.
    expect(chatgptMcp).toMatchObject({
      auth: 'oauth',
      url: 'https://os.consuelohq.com/mcp',
      localAuth: 'bearer',
      localUrl: 'http://127.0.0.1:46321/mcp',
    });
    expect(chatgptMcp.bearerToken).toMatch(/^cst_/);
    expect(chatgptMcp.scopes).toEqual([
      'route:/mcp:read',
      'mcp:call',
      'os:tools',
    ]);
    expect(existsSync(join(tempHome, 'hooks'))).toBe(false);
    expect(existsSync(join(tempHome, 'bin', 'browser.open'))).toBe(true);
    expect(existsSync(join(tempHome, 'steering'))).toBe(false);
    expect(first.actions.some((action: { path: string }) => action.path.endsWith(join('Steering', 'dialer-AGENTS.md')))).toBe(false);
    expect(existsSync(join(tempUserHome, 'Consuelo', 'Steering', 'dialer-AGENTS.md'))).toBe(false);
    expect(first.actions.some((action: { path: string }) => action.path.endsWith(join('steering', 'decision.md')))).toBe(false);
    expect(first.actions.some((action: { type: string; path: string; status: string }) => action.type === 'create_file' && action.path.endsWith(join('components', 'installed-skills.json')) && action.status === 'created')).toBe(true);
    expect(first.actions.some((action: { type: string; path: string; status: string }) => action.type === 'seed_tool' && action.path.endsWith(join('bin', 'status')) && action.status === 'created')).toBe(true);
    for (const dir of ['Artifacts', 'Projects', 'Sites', 'Skills', 'Tools', 'Steering']) {
      expect(existsSync(join(tempUserHome, 'Consuelo', dir))).toBe(true);
    }
    expect(existsSync(join(tempUserHome, 'Consuelo', 'Scripts'))).toBe(false);
    expect(existsSync(join(tempUserHome, 'Consuelo', 'Skills', 'task', 'SKILL.md'))).toBe(true);
    // BUILT_INS.md was renamed to TOOLS.md, which also documents how to view and edit tools.
    expect(existsSync(join(tempUserHome, 'Consuelo', 'Tools', 'TOOLS.md'))).toBe(true);
    expect(existsSync(join(tempUserHome, 'Consuelo', 'Tools', 'BUILT_INS.md'))).toBe(false);
    // Visible steering includes the system prompt; stream-scoped dialer instructions stay in stream context.
    const systemPrompt = join(tempUserHome, 'Consuelo', 'Steering', 'system.md');
    expect(existsSync(systemPrompt)).toBe(true);
    expect(existsSync(join(tempUserHome, 'Consuelo', 'Skills', 'skills.json'))).toBe(true);
    expect(first.actions.some((action: { path: string; status: string }) => action.path.endsWith('config.json') && action.status === 'created')).toBe(true);
    const installedRegistry = JSON.parse(readFileSync(join(tempHome, 'components', 'installed-skills.json'), 'utf8'));
    const installedTaskSkill = installedRegistry.selected.find((skill: { id: string }) => skill.id === 'task');
    expect(installedTaskSkill).toMatchObject({ id: 'task', kind: 'skill', ownership: 'bundled-managed', sourcePath: 'skills/task' });

    const sitesIndexPath = join(tempHome, 'sites', 'index.html');
    const artifactsSiteIndexPath = join(tempHome, 'sites', 'artifacts', 'index.html');
    const artifactsSiteDataPath = join(tempHome, 'sites', 'artifacts', 'data', 'catalog.json');
    const tracesIndexPath = join(tempHome, 'sites', 'traces', 'index.html');
    const diffsIndexPath = join(tempHome, 'sites', 'diffs', 'index.html');
    expect(existsSync(sitesIndexPath)).toBe(true);
    expect(existsSync(artifactsSiteIndexPath)).toBe(true);
    expect(existsSync(artifactsSiteDataPath)).toBe(true);
    expect(existsSync(tracesIndexPath)).toBe(true);
    expect(existsSync(diffsIndexPath)).toBe(true);
    expect(existsSync(join(tempHome, 'sites', 'github', 'index.html'))).toBe(false);
    expect(existsSync(join(tempHome, 'sites', 'office', 'index.html'))).toBe(false);

    const fullToolManifest = JSON.parse(readFileSync(join(process.cwd(), 'manifests', 'generated', 'tool.manifest.json'), 'utf8'));
    const coreToolManifest = JSON.parse(readFileSync(join(process.cwd(), 'manifests', 'generated', 'core.manifest.json'), 'utf8'));
    const installedToolRegistry = JSON.parse(readFileSync(join(tempHome, 'components', 'installed-tools.json'), 'utf8'));
    const installedToolNames = installedToolRegistry.components.map((tool: { id: string }) => tool.id);
    expect(installedToolRegistry.components).toHaveLength(fullToolManifest.tools.length);
    expect(installedToolRegistry.components.length).toBeGreaterThan(coreToolManifest.tools.length);
    expect(installedToolNames).toContain('status');
    expect(installedToolNames).toContain('browser.open');
    expect(installedToolNames).toContain('deployment.logs');
    expect(installedToolNames).toContain('code.call');
    const fullCodeCall = fullToolManifest.tools.find((tool: { name: string }) => tool.name === 'code.call');
    const coreCodeCall = coreToolManifest.tools.find((tool: { name: string }) => tool.name === 'code.call');
    expect(fullCodeCall?.core).toBe(true);
    expect(coreCodeCall?.core).toBe(true);
    expect(existsSync(join(tempHome, 'tools', 'code.call'))).toBe(false);
    const codeCallWrapper = readFileSync(join(tempHome, 'bin', 'code.call'), 'utf8');
    expect(codeCallWrapper).toContain('scripts/tool-runner.ts');
    expect(codeCallWrapper).toContain('code.call');
    const statusWrapper = readFileSync(join(tempHome, 'bin', 'status'), 'utf8');
    expect(statusWrapper).toContain('scripts/tool-runner.ts');
    expect(statusWrapper).toContain('status');
    expect(statusWrapper).toContain('OS_HOME=');
    expect(statusWrapper).toContain('cd "$PACKAGE_ROOT"');
    expect(statusWrapper).toContain(
      '$OS_HOME/runtime/current/scripts/tool-runner.ts',
    );
    expect(statusWrapper).toContain(
      'exec "$BUN_EXECUTABLE" "$PACKAGE_ROOT/scripts/tool-runner.ts"',
    );
    expect(statusWrapper).toContain('if [ "$#" -gt 0 ]; then');
    expect(statusWrapper).toContain("INPUT='{}'");
    expect(statusWrapper).not.toContain('INPUT="${1:-{}}"');
    expect(statusWrapper).not.toContain('CONSUELO_OS_SOURCE_DIR');
    expect(statusWrapper).not.toContain('$OS_HOME/source');
    expect(statusWrapper).not.toContain('$OS_HOME/../../source/opensaas');
    expect(statusWrapper).not.toContain('~/.consuelo/source/opensaas');
    expect(statusWrapper).not.toContain('/Users/kokayi/Dev/opensaas');
    expect(statusWrapper).not.toContain('packages/os');
    const installedStatus = installedToolRegistry.components.find((tool: { id: string }) => tool.id === 'status');
    const canonicalStatus = fullToolManifest.tools.find((tool: { name: string }) => tool.name === 'status');
    expect(installedStatus.sourcePath).toBe(canonicalStatus.sourcePath);
    const userSteeringPath = join(tempUserHome, 'Consuelo', 'Steering', 'preferences.md');
    writeFileSync(userSteeringPath, '# User steering\n\nuser-owned preferences\n');

    const second = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));
    expect(second.actions.some((action: { path: string; status: string }) => action.path.endsWith('config.json') && action.status === 'preserved')).toBe(true);
    expect(second.actions.some((action: { path: string }) => action.path.endsWith(join('Steering', 'dialer-AGENTS.md')))).toBe(false);
    expect(existsSync(join(tempUserHome, 'Consuelo', 'Steering', 'dialer-AGENTS.md'))).toBe(false);
    expect(readFileSync(userSteeringPath, 'utf8')).toContain('user-owned preferences');
    expect(existsSync(join(tempHome, 'steering'))).toBe(false);
  });



  it('writes approved node identity into flattened node config', () => {
    JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({
        mode: 'local',
        workspaceBootstrap: {
          workspaceId: 'workspace_123',
          workspaceSlug: 'kokayi',
          workspaceHost: 'kokayi.consuelohq.com',
          connectorId: 'connector_node_air',
          connectorTransport: 'websocket-relay',
          nodeId: 'node-air',
          nodeName: 'MacBook Air',
          nodeRole: 'member',
          nodeStatus: 'created',
        },
      });
      process.stdout.write(JSON.stringify(result));
    `));

    const nodeYaml = readFileSync(join(tempHome, 'node', 'node.yaml'), 'utf8');
    const globalYaml = readFileSync(join(tempHome, 'consuelo.yaml'), 'utf8');
    expect(nodeYaml).toContain('id: node-air');
    expect(nodeYaml).toContain('name: MacBook Air');
    expect(nodeYaml).toContain('role: member');
    expect(globalYaml).toContain('activeNode: node-air');
    expect(nodeYaml).not.toContain('connector_node_air');
    expect(globalYaml).not.toContain('connector_node_air');
  });

  it('writes an OpenCode MCP config that exposes Consuelo tools', () => {
    mkdirSync(join(tempUserHome, '.config', 'opencode'), { recursive: true });
    writeFileSync(
      join(tempUserHome, '.config', 'opencode', 'opencode.json'),
      `${JSON.stringify({ theme: 'system', mcp: { existing: { type: 'local', command: ['existing'], enabled: true } } }, null, 2)}\n`,
    );

    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local', connectAgents: ['opencode'] });
      process.stdout.write(JSON.stringify(result));
    `));

    const opencodeConfigPath = join(tempUserHome, '.config', 'opencode', 'opencode.json');
    const opencodeConfig = JSON.parse(readFileSync(opencodeConfigPath, 'utf8'));
    expect(opencodeConfig.theme).toBe('system');
    expect(opencodeConfig.mcp.existing).toMatchObject({ type: 'local', enabled: true });
    expect(opencodeConfig.mcp.os).toMatchObject({
      type: 'local',
      enabled: true,
      cwd: tempHome,
      environment: { CONSUELO_HOME: tempHome, CONSUELO_AGENT_ID: 'opencode' },
    });
    expect(opencodeConfig.mcp.os.command).toEqual([
      join(tempHome, 'bin', 'consuelo-mcp'),
    ]);
    expect(existsSync(join(tempHome, 'bin', 'consuelo-mcp'))).toBe(true);
    expect(opencodeConfig.mcp['consuelo-os']).toBeUndefined();
    expect(opencodeConfig.mcp.consuelo).toBeUndefined();
    const credentialPath = join(
      tempHome,
      'node',
      'security',
      'generated',
      'local-agent-mcp.json',
    );
    const credential = JSON.parse(readFileSync(credentialPath, 'utf8')) as {
      localUrl: string;
      agents: Record<string, { tokenId: string; bearerToken: string }>;
    };
    expect(statSync(credentialPath).mode & 0o777).toBe(0o600);
    expect(credential.localUrl).toBe('http://127.0.0.1:46321/mcp');
    expect(Object.keys(credential.agents)).toEqual(['opencode']);
    expect(credential.agents.opencode?.tokenId).toEqual(expect.any(String));
    expect(credential.agents.opencode?.bearerToken).toEqual(expect.any(String));
    expect(result.agents.find((agent: { name: string; status: string }) => agent.name === 'opencode')).toMatchObject({
      status: 'configured',
    });
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'connect_agent',
          path: opencodeConfigPath,
          message: expect.stringMatching(/OpenCode MCP/i),
        }),
      ]),
    );
  });

  it('preserves credentials for previously configured agents during partial reconfiguration', () => {
    mkdirSync(join(tempUserHome, '.codex'), { recursive: true });
    mkdirSync(join(tempUserHome, '.config', 'opencode'), { recursive: true });

    runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      provisionLocalOs({ mode: 'local', connectAgents: ['codex', 'opencode'] });
    `);
    const credentialPath = join(
      tempHome,
      'node',
      'security',
      'generated',
      'local-agent-mcp.json',
    );
    const first = JSON.parse(readFileSync(credentialPath, 'utf8')) as {
      agents: Record<string, { tokenId: string; bearerToken: string }>;
    };

    runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      provisionLocalOs({ mode: 'local', connectAgents: ['opencode'] });
    `);
    const second = JSON.parse(readFileSync(credentialPath, 'utf8')) as typeof first;

    expect(Object.keys(second.agents).sort()).toEqual(['codex', 'opencode']);
    expect(second.agents.codex).toEqual(first.agents.codex);
  });

  it('replaces expired local-agent credentials during reprovisioning', () => {
    mkdirSync(join(tempUserHome, '.config', 'opencode'), { recursive: true });

    runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      provisionLocalOs({ mode: 'local', connectAgents: ['opencode'] });
    `);
    const credentialPath = join(
      tempHome,
      'node',
      'security',
      'generated',
      'local-agent-mcp.json',
    );
    const authPath = join(
      tempHome,
      'node',
      'security',
      'generated',
      'auth.json',
    );
    const before = JSON.parse(readFileSync(credentialPath, 'utf8')) as {
      agents: Record<string, { tokenId: string; bearerToken: string }>;
    };
    const auth = JSON.parse(readFileSync(authPath, 'utf8')) as {
      tokens: Record<string, { expiresAt: string }>;
    };
    const previous = before.agents.opencode;
    auth.tokens[previous.tokenId].expiresAt = '2020-01-01T00:00:00.000Z';
    writeFileSync(authPath, JSON.stringify(auth, null, 2));

    runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      provisionLocalOs({ mode: 'local', connectAgents: ['opencode'] });
    `);
    const after = JSON.parse(readFileSync(credentialPath, 'utf8')) as typeof before;
    const updatedAuth = JSON.parse(readFileSync(authPath, 'utf8')) as typeof auth;
    const replacement = after.agents.opencode;

    expect(replacement.tokenId).not.toBe(previous.tokenId);
    expect(replacement.bearerToken).not.toBe(previous.bearerToken);
    expect(Date.parse(updatedAuth.tokens[replacement.tokenId].expiresAt)).toBeGreaterThan(
      Date.now(),
    );
  });

  it('materializes the canonical Artifacts site from persisted route-addressed artifacts', () => {
    const result = JSON.parse(runBunEval(`
      const { writeFileSync } = await import('node:fs');
      const { join } = await import('node:path');
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const { publishArtifact } = await import('./scripts/lib/artifacts.ts');
      provisionLocalOs({ mode: 'local' });
      const target = join(process.env.CONSUELO_HOME, 'quarterly-pipeline-brief.html');
      writeFileSync(target, '<!doctype html><html><body><h1>Quarterly Pipeline Brief</h1></body></html>');
      const published = publishArtifact({
        home: process.env.CONSUELO_HOME,
        target,
        path: '/briefs/quarterly-pipeline-brief',
        title: 'Quarterly Pipeline Brief',
        category: 'briefs',
        template: 'guide',
        traceId: 'trc_artifacts_site_test',
        skillName: 'fixture-report',
        now: '2026-07-15T00:00:00.000Z',
      });
      provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify({ artifact: published.artifact, version: published.version }));
    `)) as { artifact: { id: string; path: string; currentVersionId: string }; version: { localPath: string } };

    const sitesIndexPath = join(tempHome, 'sites', 'index.html');
    const artifactsSiteIndexPath = join(tempHome, 'sites', 'artifacts', 'index.html');
    const artifactsSiteDataPath = join(tempHome, 'sites', 'artifacts', 'data', 'catalog.json');
    expect(existsSync(sitesIndexPath)).toBe(true);
    expect(existsSync(artifactsSiteIndexPath)).toBe(true);
    expect(existsSync(artifactsSiteDataPath)).toBe(true);
    for (const site of ['traces', 'diffs']) {
      expect(existsSync(join(tempHome, 'sites', site))).toBe(true);
      expect(existsSync(join(tempHome, 'sites', site, 'index.html'))).toBe(true);
    }
    expect(existsSync(join(tempHome, 'sites', 'github', 'index.html'))).toBe(false);
    expect(existsSync(join(tempHome, 'sites', 'office', 'index.html'))).toBe(false);

    const sitesIndex = readFileSync(sitesIndexPath, 'utf8');
    expect(sitesIndex).toContain('<title>Overview - Consuelo OS</title>');
    expect(sitesIndex).toContain('data-workspace-shell');
    expect(sitesIndex).toContain('data-workspace-route-trigger');
    expect(sitesIndex).toContain('<h1>Overview</h1>');
    expect(sitesIndex).toContain('/gateway/configuration/snapshot');
    expect(sitesIndex).not.toContain('Welcome to Consuelo OS');
    expect(sitesIndex).not.toContain('<code id="mcp-url">');
    expect(sitesIndex).not.toContain('Connected to your cloud agents');
    expect(sitesIndex).not.toContain('data-agent-count');
    expect(sitesIndex).not.toContain('Consuelo OS Sites');

    const artifactsSitePage = readFileSync(artifactsSiteIndexPath, 'utf8');
    expect(artifactsSitePage).toContain('Consuelo Artifacts');
    expect(artifactsSitePage).toContain('Quarterly Pipeline Brief');
    expect(artifactsSitePage).toContain('/artifacts/briefs/quarterly-pipeline-brief');

    const artifactsSiteData = JSON.parse(readFileSync(artifactsSiteDataPath, 'utf8')) as {
      entries: Array<{
        id: string;
        title: string;
        path: string;
        currentVersionId: string;
      }>;
    };
    expect(artifactsSiteData.entries).toEqual([
      expect.objectContaining({
        id: result.artifact.id,
        title: 'Quarterly Pipeline Brief',
        path: result.artifact.path,
        currentVersionId: result.artifact.currentVersionId,
      }),
    ]);
    expect(existsSync(result.version.localPath)).toBe(true);
  });

  it('preserves local user skills while refreshing the installed registry', () => {
    const localSkillDir = join(tempHome, 'skills', 'local-research');
    mkdirSync(localSkillDir, { recursive: true });
    writeFileSync(join(localSkillDir, 'SKILL.md'), 'local skill body\n');
    writeFileSync(join(localSkillDir, 'skill.json'), `${JSON.stringify({
      name: 'local-research',
      title: 'Local Research',
      description: 'User-owned local research skill.',
      trigger: 'Invoke for local research experiments.',
      entrypoint: 'SKILL.md',
      load: { type: 'resource', path: 'skills/local-research/SKILL.md' },
      permission: 'read',
      requiresApproval: false,
      status: 'active',
    }, null, 2)}\n`);

    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));

    expect(readFileSync(join(localSkillDir, 'SKILL.md'), 'utf8')).toBe('local skill body\n');
    expect(result.actions.some((action: { path: string; status: string; message: string }) => action.path.endsWith(join('skills', 'local-research')) && action.status === 'preserved' && action.message.includes('legacy hidden skill preserved'))).toBe(true);
    const installedRegistry = JSON.parse(readFileSync(join(tempHome, 'components', 'installed-skills.json'), 'utf8'));
    expect(installedRegistry.legacyCustom.some((skill: { id: string; ownership: string }) => skill.id === 'local-research' && skill.ownership === 'custom')).toBe(true);
    expect(installedRegistry.selected.some((skill: { id: string }) => skill.id === 'task')).toBe(true);
  });


  it('drops unknown legacy skill selections without mapping them to another skill', () => {
    mkdirSync(tempHome, { recursive: true });
    writeFileSync(join(tempHome, 'config.json'), `${JSON.stringify({
      version: 1,
      mode: 'local',
      home: tempHome,
      port: 48761,
      artifactStorage: 'local',
      selectedSkills: ['office', 'task'],
      agents: [],
      createdAt: '2026-06-09T00:00:00.000Z',
      updatedAt: '2026-06-09T00:00:00.000Z',
    }, null, 2)}\n`);

    JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));

    const config = JSON.parse(readFileSync(join(tempHome, 'config.json'), 'utf8'));
    expect(config.selectedSkills).toContain('task');
    expect(config.selectedSkills).not.toContain('office');
    expect(config.selectedSkills).not.toContain('sites');
    expect(config.selectedSkills).not.toContain('artifacts');
    expect(existsSync(join(tempHome, 'skills', 'office'))).toBe(false);
  });

  it('installs every full-manifest tool even when only one skill is selected', () => {
    JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local', selectedSkills: ['task'] });
      process.stdout.write(JSON.stringify(result));
    `));

    expect(existsSync(join(tempHome, 'skills', 'task'))).toBe(false);
    expect(existsSync(join(tempHome, 'skills', 'research-ingest'))).toBe(false);
    const installedSkillRegistry = JSON.parse(readFileSync(join(tempHome, 'components', 'installed-skills.json'), 'utf8'));
    expect(installedSkillRegistry.selected.map((skill: { id: string }) => skill.id)).toEqual(['task']);

    const fullToolManifest = JSON.parse(readFileSync(join(process.cwd(), 'manifests', 'generated', 'tool.manifest.json'), 'utf8'));
    const installedToolRegistry = JSON.parse(readFileSync(join(tempHome, 'components', 'installed-tools.json'), 'utf8'));
    const installedToolNames = installedToolRegistry.components.map((tool: { id: string }) => tool.id);

    expect(installedToolRegistry.components).toHaveLength(fullToolManifest.tools.length);
    expect(installedToolNames).toContain('task.start');
    expect(installedToolNames).toContain('browser.open');
    expect(installedToolNames).toContain('deployment.logs');
  });

  it('preserves local user tools while refreshing the installed registry', () => {
    const localToolDir = join(tempHome, 'tools', 'local-tool');
    mkdirSync(localToolDir, { recursive: true });
    writeFileSync(join(localToolDir, 'tool.json'), `${JSON.stringify({
      name: 'local-tool',
      kind: 'local-tool',
      description: 'User-owned local tool.',
      source: 'local',
      core: false,
    }, null, 2)}\n`);

    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));

    expect(readFileSync(join(localToolDir, 'tool.json'), 'utf8')).toContain('User-owned local tool.');
    expect(result.actions.some((action: { path: string; status: string; message: string }) => action.path.endsWith(join('tools', 'local-tool')) && action.status === 'preserved' && action.message.includes('legacy hidden tool preserved'))).toBe(true);

    const installedToolRegistry = JSON.parse(readFileSync(join(tempHome, 'components', 'installed-tools.json'), 'utf8'));
    const installedToolNames = installedToolRegistry.components.map((tool: { id: string }) => tool.id);
    expect(installedToolRegistry.legacyCustom.some((tool: { id: string; ownership: string }) => tool.id === 'local-tool' && tool.ownership === 'custom')).toBe(true);
    expect(installedToolNames).toContain('status');
  });

  it('materializes only selected bundled skills on fresh install', () => {
    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local', selectedSkills: ['task', 'senior-engineer'] });
      process.stdout.write(JSON.stringify(result));
    `));

    expect(existsSync(join(tempUserHome, 'Consuelo', 'Skills', 'task', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tempUserHome, 'Consuelo', 'Skills', 'senior-engineer', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tempUserHome, 'Consuelo', 'Skills', 'research-ingest'))).toBe(false);
    expect(result.actions.some((action: { path: string }) => action.path.endsWith(join('Skills', 'research-ingest')))).toBe(false);

    const installedRegistry = JSON.parse(readFileSync(join(tempHome, 'components', 'installed-skills.json'), 'utf8'));
    const installedNames = installedRegistry.selected.map((skill: { id: string }) => skill.id);
    expect(installedNames).toContain('task');
    expect(installedNames).toContain('senior-engineer');
    expect(installedNames).not.toContain('research-ingest');
  });

  it('uses default selected bundled skills when no selectedSkills option is provided', () => {
    JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));

    expect(existsSync(join(tempUserHome, 'Consuelo', 'Skills', 'senior-engineer', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tempUserHome, 'Consuelo', 'Skills', 'research-ingest', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tempUserHome, 'Consuelo', 'Skills', 'office-landing-page'))).toBe(false);
    const installedRegistry = JSON.parse(readFileSync(join(tempHome, 'components', 'installed-skills.json'), 'utf8'));
    const installedNames = installedRegistry.selected.map((skill: { id: string }) => skill.id);
    expect(installedNames).toContain('senior-engineer');
    expect(installedNames).toContain('research-ingest');
    expect(installedNames).not.toContain('office-landing-page');

    const config = JSON.parse(readFileSync(join(tempHome, 'config.json'), 'utf8'));
    expect(config.selectedSkills).toContain('senior-engineer');
    expect(config.selectedSkills).toContain('research-ingest');
    expect(config.selectedSkills).not.toContain('office-landing-page');
  });

  it('configures Codex natively without writing a legacy sidecar or claiming verification', () => {
    mkdirSync(join(tempUserHome, '.codex'), { recursive: true });
    writeFileSync(join(tempUserHome, '.codex', 'config.toml'), 'model = "gpt-5"\n');

    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ connectAgents: ['codex'] });
      process.stdout.write(JSON.stringify(result));
    `));

    const configPath = join(tempUserHome, '.codex', 'config.toml');
    const config = readFileSync(configPath, 'utf8');
    expect(config).toContain('model = "gpt-5"');
    expect(config).toContain('[mcp_servers."os"]');
    expect(config).toContain(JSON.stringify(join(tempHome, 'bin', 'consuelo-mcp')));
    expect(config).not.toContain('[mcp_servers."consuelo"]');
    expect(config).not.toContain('[mcp_servers.\"consuelo-os\"]');
    expect(existsSync(join(tempUserHome, '.codex', 'consuelo-os.json'))).toBe(false);
    expect(result.agents.find((agent: { name: string; status: string }) => agent.name === 'codex')).toMatchObject({
      status: 'configured',
    });
  });

  it('detects common local agent footprints from the registry', () => {
    for (const footprint of [
      join(tempUserHome, '.codex'),
      join(tempUserHome, 'Library', 'Application Support', 'Cursor', 'User'),
      join(tempUserHome, '.claude'),
      join(tempUserHome, '.config', 'opencode'),
      join(tempUserHome, '.factory'),
      join(tempUserHome, '.gemini'),
      join(tempUserHome, 'Library', 'Application Support', 'Pi'),
    ]) {
      mkdirSync(footprint, { recursive: true });
    }
    writeFileSync(join(tempUserHome, '.gemini', 'consuelo-os.json'), '{}\n');
    writeFileSync(join(tempHome, 'config.json'), `${JSON.stringify({
      version: 1,
      mode: 'local',
      home: tempHome,
      port: 8960,
      artifactStorage: 'local',
      agents: [{
        name: 'gemini',
        homePath: join(tempUserHome, '.gemini'),
        configPath: join(tempUserHome, '.gemini', 'consuelo-os.json'),
        connected: true,
      }],
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    }, null, 2)}\n`);

    const agents = JSON.parse(runBunEval(`
      const { detectAgents } = await import('./scripts/lib/install-state.ts');
      const agents = detectAgents().filter((agent) => agent.detected).map((agent) => ({
        name: agent.name,
        label: agent.label,
        homePath: agent.homePath,
        configPath: agent.configPath,
        status: agent.status,
      }));
      process.stdout.write(JSON.stringify(agents));
    `)) as Array<{
      name: string;
      label: string;
      homePath: string;
      configPath: string;
      status: string;
    }>;

    expect(agents.map((agent) => agent.name)).toEqual([
      'codex',
      'cursor',
      'claude',
      'opencode',
      'factory',
      'gemini',
      'pi',
    ]);
    expect(agents.find((agent) => agent.name === 'cursor')).toMatchObject({
      label: 'Cursor',
      status: 'detected',
    });
    expect(agents.find((agent) => agent.name === 'gemini')).toMatchObject({
      label: 'Gemini CLI',
      status: 'detected',
    });
    expect(agents.find((agent) => agent.name === 'pi')).toMatchObject({
      label: 'Pi',
      status: 'unsupported',
    });
  });

  it('reports intent and task hook runtime modules in doctor checks', () => {
    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs, runDoctor } = await import('./scripts/lib/install-state.ts');
      provisionLocalOs({ mode: 'local' });
      const result = await runDoctor();
      process.stdout.write(JSON.stringify(result));
    `)) as { checks: Array<{ name: string; status: string; message: string }> };

    const intentCheck = result.checks.find((check) => check.name === 'runtime:intent');
    const taskHookCheck = result.checks.find((check) => check.name === 'runtime:task-hook');
    expect(intentCheck).toMatchObject({ status: 'connected' });
    expect(intentCheck?.message).toContain('hooks/intent.js');
    expect(taskHookCheck).toMatchObject({ status: 'connected' });
    expect(taskHookCheck?.message).toContain('hooks/task/guidance.js');
  });

  it('validates bundled skill metadata against the manifest', () => {
    const issues = JSON.parse(runBunEval(`
      const { validateBundledSkills } = await import('./scripts/lib/skills.ts');
      process.stdout.write(JSON.stringify(validateBundledSkills()));
    `));

    expect(issues).toEqual([]);
  });
});
