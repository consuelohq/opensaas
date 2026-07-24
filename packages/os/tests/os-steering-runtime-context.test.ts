import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readEffectiveCoreManifest } from '../scripts/lib/manifest';

const WORKSPACE_ID = 'workspace-steering';
const NODE_ID = 'node-home';
const SECRET = 'super-secret-bootstrap-value';

let home: string;
let userHome: string;

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(join(filePath, '..'), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeYaml(filePath: string, value: unknown): void {
  mkdirSync(join(filePath, '..'), { recursive: true });
  writeFileSync(filePath, stringify(value));
}

function nodeSummaryPayload(): Record<string, unknown> {
  const currentNode = {
    workspaceId: WORKSPACE_ID,
    nodeId: NODE_ID,
    displayName: 'Studio Mac',
    role: 'home',
    platform: 'darwin',
    architecture: 'arm64',
    channel: 'beta',
    connectorId: `connector-${SECRET}`,
    capabilities: ['local-runtime', 'workspace-tools'],
    createdAt: '2026-07-20T00:00:00.000Z',
    lastSeenAt: '2026-07-24T16:00:00.000Z',
    presence: 'online',
    state: 'active',
    publicKeyThumbprint: `thumbprint-${SECRET}`,
  };
  const offlineNode = {
    workspaceId: WORKSPACE_ID,
    nodeId: 'node-travel',
    displayName: 'Travel Mac',
    role: 'member',
    platform: 'darwin',
    architecture: 'arm64',
    channel: 'stable',
    connectorId: null,
    capabilities: ['local-runtime'],
    createdAt: '2026-07-21T00:00:00.000Z',
    lastSeenAt: '2026-07-22T12:00:00.000Z',
    presence: 'offline',
    state: 'active',
    publicKeyThumbprint: 'thumbprint-offline',
  };
  return {
    workspaceId: WORKSPACE_ID,
    workspaceHost: 'steering.consuelohq.com',
    currentNodeId: NODE_ID,
    currentNode,
    defaultNodeId: NODE_ID,
    nodeCount: 2,
    presence: { online: 1, stale: 0, offline: 1 },
    nodes: [currentNode, offlineNode],
  };
}

function managedPlan(input: { available?: number } = {}): {
  provenance: Record<string, unknown>;
  plan: Record<string, unknown>;
} {
  const available = input.available ?? 2;
  const actions = available === 0
    ? ['no-change', 'no-change']
    : ['update-clean', 'conflict'];
  const byAction = {
    install: 0,
    'update-clean': actions.filter((action) => action === 'update-clean').length,
    'preserve-custom': 0,
    'merge-clean': 0,
    conflict: actions.filter((action) => action === 'conflict').length,
    'remove-upstream': 0,
    detach: 0,
    'no-change': actions.filter((action) => action === 'no-change').length,
  };
  const components = [{
    schemaVersion: 1,
    id: 'runtime-core',
    kind: 'script',
    ownership: 'bundled-managed',
    sourceBundleId: 'sha256:installed',
    sourceVersion: '1.2.3',
    sourcePath: 'scripts/runtime-core.ts',
    baseHash: 'sha256:base',
    baseContentRef: 'sha256:base',
    localHash: 'sha256:base',
    upstreamHash: 'sha256:base',
    installedAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    resolutionState: 'clean',
  }];
  const items = actions.map((action, index) => ({
    key: `script:private-plan-item-${index}-${SECRET}`,
    id: `private-plan-item-${index}-${SECRET}`,
    kind: 'script',
    action,
    ownership: 'bundled-managed',
    sourceBundleId: 'sha256:target',
    sourceVersion: '1.3.0',
    sourcePath: `/private/source/${SECRET}`,
    requiresReview: action === 'conflict',
    resolutionState: action === 'conflict' ? 'conflict' : 'clean',
  }));
  return {
    provenance: {
      schemaVersion: 1,
      kind: 'consuelo-managed-component-provenance',
      sourceBundle: { bundleId: 'sha256:installed', version: '1.2.3' },
      components,
    },
    plan: {
      schemaVersion: 1,
      kind: 'consuelo-managed-component-update-plan',
      generatedAt: '2026-07-24T16:00:00.000Z',
      sourceBundle: { bundleId: 'sha256:target', version: '1.3.0' },
      summary: {
        total: items.length,
        requiresReview: byAction.conflict,
        byAction,
      },
      items,
    },
  };
}

function installFixture(input: {
  available?: number;
  notifications?: { mode: 'on' | 'off' } | { mode: 'snoozed'; snoozedUntil: string };
} = {}): void {
  const notifications = input.notifications ?? { mode: 'on' };
  writeYaml(join(home, 'consuelo.yaml'), {
    version: 1,
    activeWorkspace: WORKSPACE_ID,
    activeNode: NODE_ID,
    runtime: { current: 'runtime/current' },
    updates: { channel: 'beta', notifications },
  });
  writeYaml(join(home, 'node', 'node.yaml'), {
    version: 1,
    node: { id: NODE_ID, name: 'Studio Mac', role: 'home' },
    capabilities: ['local-runtime', 'darwin'],
    workspaces: [{ id: WORKSPACE_ID, state: `workspaces/${WORKSPACE_ID}/state` }],
  });
  writeYaml(join(home, 'workspaces', WORKSPACE_ID, 'shared', 'workspace.yaml'), {
    version: 1,
    workspace: {
      id: WORKSPACE_ID,
      name: 'Steering Workspace',
      slug: 'steering',
      host: 'steering.consuelohq.com',
    },
    defaults: { project: 'opensaas', node: NODE_ID },
    projects: [{
      id: 'opensaas',
      name: 'OpenSaaS',
      repo: 'consuelohq/opensaas',
      defaultBranch: 'main',
    }],
    routing: {},
    policy: { allowedAgents: [] },
    sites: {},
    agents: { defaults: [] },
  });

  mkdirSync(join(home, 'steering'), { recursive: true });
  writeFileSync(join(home, 'steering', 'system_prompt.md'), '# Managed system prompt\n\nmanaged system body\n');
  writeFileSync(join(home, 'steering', 'hidden-notes.md'), 'hidden notes must not appear\n');

  const visibleSteering = join(userHome, 'Consuelo', 'Steering');
  mkdirSync(visibleSteering, { recursive: true });
  writeFileSync(join(visibleSteering, 'alpha.md'), '# Alpha user steering\n\nalpha body\n');
  writeFileSync(join(visibleSteering, 'zeta.md'), '# Zeta user steering\n\nzeta body\n');
  writeFileSync(join(visibleSteering, 'decision.md'), 'visible decision must not appear\n');
  writeFileSync(join(visibleSteering, 'steering.md'), 'legacy steering must not appear\n');

  mkdirSync(join(home, 'skills', 'custom-insight'), { recursive: true });
  writeJson(join(home, 'skills', 'custom-insight', 'skill.json'), {
    name: 'custom-insight',
    title: 'Custom Insight',
    description: 'A user-installed compact custom skill.',
    trigger: 'Invoke for custom insight work.',
    entrypoint: 'SKILL.md',
    status: 'custom',
    token: SECRET,
  });
  writeFileSync(
    join(home, 'skills', 'custom-insight', 'SKILL.md'),
    `# Custom body\n\nmarkdown body must not appear ${SECRET}\n`,
  );
  writeJson(join(home, 'components', 'installed-skills.json'), {
    schemaVersion: 1,
    kind: 'consuelo-installed-skill-index',
    sourceBundle: { bundleId: 'sha256:installed', version: '1.2.3' },
    selected: [{
      id: 'task',
      kind: 'skill',
      ownership: 'bundled-managed',
      sourcePath: 'skills/task',
      contentHash: 'sha256:task',
      name: 'task',
      title: 'Task Workflow',
      description: 'Selected task workflow.',
      trigger: 'Invoke for task work.',
      entrypoint: 'SKILL.md',
      status: 'active',
    }],
    legacyCustom: [{
      id: 'custom-insight',
      kind: 'skill',
      ownership: 'custom',
      legacyPath: 'skills/custom-insight',
      migrationRequired: true,
    }],
  });

  writeJson(
    join(home, 'node', 'workspaces', WORKSPACE_ID, 'state', 'workspace-nodes.json'),
    {
      schemaVersion: 1,
      kind: 'consuelo-workspace-node-summary-cache',
      cachedAt: '2026-07-24T16:00:00.000Z',
      summary: nodeSummaryPayload(),
    },
  );

  const state = managedPlan({ available: input.available });
  writeJson(join(home, 'components', 'provenance.json'), state.provenance);
  writeJson(join(home, 'components', 'update-plan.json'), state.plan);
}

function runSteering(): string {
  const result = spawnSync('bun', ['--eval', `
    const { getSteering } = await import('./scripts/os.ts');
    process.stdout.write(JSON.stringify({ steering: getSteering() }));
  `], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: userHome,
      CONSUELO_HOME: home,
      CONSUELO_WORKSPACE_ID: 'env-workspace-must-not-win',
      CONSUELO_USER_ID: 'env-user-must-not-appear',
      CONSUELO_GRAPHQL_URL: `https://${SECRET}.invalid/graphql`,
      CONSUELO_INTERNAL_GRAPHQL_API_KEY: SECRET,
    },
  });
  if (result.status !== 0) {
    throw new Error(`getSteering failed:\n${result.stderr || result.stdout}`);
  }
  return (JSON.parse(result.stdout) as { steering: string }).steering;
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'consuelo-steering-runtime-'));
  userHome = mkdtempSync(join(tmpdir(), 'consuelo-steering-user-'));
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  rmSync(userHome, { recursive: true, force: true });
});

describe('installed runtime steering context', () => {
  it('renders typed identity, authenticated safe nodes, selected skills, compact updates, and visible user steering', () => {
    installFixture();
    const alphaPath = join(userHome, 'Consuelo', 'Steering', 'alpha.md');
    const alphaBefore = readFileSync(alphaPath, 'utf8');

    const first = runSteering();
    const second = runSteering();

    expect(first).toBe(second);
    expect(first).toContain('# Consuelo OS runtime context');
    expect(first).toContain('"nodeId": "node-home"');
    expect(first).toContain('"displayName": "Studio Mac"');
    expect(first).toContain('"platform": "darwin"');
    expect(first).toContain('"architecture": "arm64"');
    expect(first).toContain('"channel": "beta"');
    expect(first).toContain('"installedVersion": "1.2.3"');
    expect(first).toContain('"workspaceId": "workspace-steering"');
    expect(first).toContain('"workspaceSlug": "steering"');
    expect(first).toContain('"workspaceHost": "steering.consuelohq.com"');
    expect(first).toContain('"isDefaultNode": true');

    expect(first).toContain('"nodeCount": 2');
    expect(first).toContain('"displayName": "Travel Mac"');
    expect(first).toContain('"presence": "offline"');

    expect(first).toContain('"name": "task"');
    expect(first).toContain('"title": "Task Workflow"');
    expect(first).toContain('"name": "custom-insight"');
    expect(first).toContain('"title": "Custom Insight"');
    expect(first).not.toContain('"name": "browser"');
    expect(first).not.toContain('markdown body must not appear');

    expect(first).toContain('"availableCount": 2');
    expect(first).toContain('"conflictCount": 1');
    expect(first).toContain('"checkedAt": "2026-07-24T16:00:00.000Z"');
    expect(first).toContain('"currentVersion": "1.2.3"');
    expect(first).toContain('"targetVersion": "1.3.0"');
    expect(first).toContain('Consuelo OS: 2 updates available.');
    expect(first).not.toContain('private-plan-item');

    expect(first).toContain('# system_prompt.md');
    expect(first).toContain('managed system body');
    expect(first).toContain('# alpha.md');
    expect(first).toContain('alpha body');
    expect(first).toContain('# zeta.md');
    expect(first).toContain('zeta body');
    expect(first.indexOf('# system_prompt.md')).toBeLessThan(first.indexOf('# alpha.md'));
    expect(first.indexOf('# alpha.md')).toBeLessThan(first.indexOf('# zeta.md'));
    expect(first).not.toContain('hidden notes must not appear');
    expect(first).not.toContain('visible decision must not appear');
    expect(first).not.toContain('legacy steering must not appear');
    expect(readFileSync(alphaPath, 'utf8')).toBe(alphaBefore);

    expect(first).not.toContain(SECRET);
    expect(first).not.toContain(home);
    expect(first).not.toContain(userHome);
    expect(first).not.toContain('env-workspace-must-not-win');
    expect(first).not.toContain('env-user-must-not-appear');
    expect(first.length).toBeLessThanOrEqual(65_536);
    for (const tool of readEffectiveCoreManifest(home).tools) {
      expect(first).toContain(`"name": "${tool.name}"`);
    }
  });

  it('retains core routing metadata and emits bounded diagnostics for oversized steering files', () => {
    installFixture();
    writeFileSync(
      join(home, 'steering', 'system_prompt.md'),
      `# Managed system prompt\n\n${'managed '.repeat(20_000)}`,
    );
    const visibleRoot = join(userHome, 'Consuelo', 'Steering');
    for (let index = 0; index < 11; index += 1) {
      writeFileSync(
        join(visibleRoot, `large-${String(index).padStart(2, '0')}.md`),
        `# Large ${index}\n\n${'user '.repeat(20_000)}`,
      );
    }

    const steering = runSteering();

    expect(steering.length).toBe(65_534);
    expect(steering).toContain('steering_file_truncated');
    expect(steering).toContain('steering_output_truncated');
    expect(steering).toContain('# enabled core tools');
    for (const tool of readEffectiveCoreManifest(home).tools) {
      expect(steering).toContain(`"name": "${tool.name}"`);
    }
  });

  it.each([
    ['zero updates', { available: 0 }],
    ['notifications off', { notifications: { mode: 'off' as const } }],
    ['active snooze', {
      notifications: {
        mode: 'snoozed' as const,
        snoozedUntil: '2099-01-01T00:00:00.000Z',
      },
    }],
  ])('omits the response reminder for %s', (_label, options) => {
    installFixture(options);
    expect(runSteering()).not.toContain('updates available.');
  });

  it('degrades corrupt installed registries to bounded diagnostics without leaking raw content', () => {
    installFixture();
    writeFileSync(join(home, 'components', 'installed-skills.json'), `{not-json-${SECRET}`);
    writeFileSync(
      join(home, 'node', 'workspaces', WORKSPACE_ID, 'state', 'workspace-nodes.json'),
      `{not-json-${SECRET}`,
    );
    writeFileSync(join(home, 'components', 'update-plan.json'), `{not-json-${SECRET}`);

    const steering = runSteering();

    expect(steering).toContain('installed_skills_unavailable');
    expect(steering).toContain('node_summary_unavailable');
    expect(steering).toContain('update_summary_unavailable');
    expect(steering).not.toContain(SECRET);
    expect(steering.length).toBeLessThanOrEqual(65_536);
  });

  it('does not follow user steering symlinks outside the visible steering directory', () => {
    installFixture();
    const outsidePath = join(userHome, `outside-${SECRET}.md`);
    writeFileSync(outsidePath, `# Outside\n\n${SECRET}\n`);
    symlinkSync(outsidePath, join(userHome, 'Consuelo', 'Steering', 'linked.md'));

    const steering = runSteering();

    expect(steering).not.toContain('# linked.md');
    expect(steering).not.toContain(SECRET);
  });
});
