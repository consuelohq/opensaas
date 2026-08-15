import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createDefaultNodeYamlConfig,
  resolveConsueloHomeLayout,
  writeYamlConfig,
} from '../../os/scripts/lib/consuelo-home';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('workspace session.start compatibility', () => {
  it('creates the same durable work-session metadata used by the OS facade', () => {
    const root = mkdtempSync(join(tmpdir(), 'consuelo-workspace-session-start-'));
    roots.push(root);
    const home = join(root, '.consuelo');
    const workRoot = join(root, 'raycast-extension');
    mkdirSync(workRoot, { recursive: true });

    const layout = resolveConsueloHomeLayout(home);
    mkdirSync(layout.nodeDir, { recursive: true });
    const config = createDefaultNodeYamlConfig({
      nodeId: 'node_workspace_session_test',
      nodeName: 'Workspace Session Test',
      workspaceId: 'workspace_session_test',
    });
    writeYamlConfig(layout.nodeConfigPath, config);

    const result = spawnSync(
      'bun',
      ['packages/workspace/scripts/session-start.ts', '--kind', 'work', '--path', workRoot, '--json'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: { ...process.env, CONSUELO_HOME: home },
      },
    );

    expect(result.status, result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as {
      sessionKind: string;
      workSession: string;
      ownerNodeId: string;
      path: string;
    };
    const canonicalWorkRoot = realpathSync(workRoot);
    expect(output).toMatchObject({
      sessionKind: 'work',
      ownerNodeId: 'node_workspace_session_test',
      path: canonicalWorkRoot,
    });
    expect(output.workSession).toMatch(/^wrk_[A-Za-z0-9_-]{8,80}$/u);

    const metadataPath = join(layout.nodeDir, 'sessions', 'work', `${output.workSession}.json`);
    expect(existsSync(metadataPath)).toBe(true);
    expect(JSON.parse(readFileSync(metadataPath, 'utf8'))).toMatchObject({
      sessionKind: 'work',
      workSession: output.workSession,
      ownerNodeId: 'node_workspace_session_test',
      path: canonicalWorkRoot,
    });
  });
});
