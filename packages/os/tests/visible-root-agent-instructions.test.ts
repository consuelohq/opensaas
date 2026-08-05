import { afterEach, describe, expect, it } from 'bun:test';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  reconcileVisibleRootAgentInstructions,
  ROOT_AGENT_INSTRUCTION_FILE_NAMES,
} from '../scripts/lib/visible-root-agent-instructions';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('visible root agent instructions', () => {
  it('creates byte-identical AGENTS.md and CLAUDE.md from one canonical source', () => {
    const userRoot = mkdtempSync(join(tmpdir(), 'consuelo-visible-root-agents-'));
    roots.push(userRoot);

    const actions = reconcileVisibleRootAgentInstructions({ userRoot, dryRun: false });
    const [agentsName, claudeName] = ROOT_AGENT_INSTRUCTION_FILE_NAMES;
    const agentsPath = join(userRoot, agentsName);
    const claudePath = join(userRoot, claudeName);
    const agents = readFileSync(agentsPath, 'utf8');

    expect(actions).toEqual([
      expect.objectContaining({ path: agentsPath, status: 'created' }),
      expect.objectContaining({ path: claudePath, status: 'created' }),
    ]);
    expect(agents).toContain('# OS Steering Instructions Rewrite');
    expect(readFileSync(claudePath, 'utf8')).toBe(agents);
    expect(statSync(agentsPath).mode & 0o777).toBe(0o600);
    expect(statSync(claudePath).mode & 0o777).toBe(0o600);
  });

  it('repairs stale or missing aliases from the canonical bytes', () => {
    const userRoot = mkdtempSync(join(tmpdir(), 'consuelo-visible-root-agents-'));
    roots.push(userRoot);
    reconcileVisibleRootAgentInstructions({ userRoot, dryRun: false });

    const [agentsName, claudeName] = ROOT_AGENT_INSTRUCTION_FILE_NAMES;
    const agentsPath = join(userRoot, agentsName);
    const claudePath = join(userRoot, claudeName);
    writeFileSync(agentsPath, '# stale local instructions\n');
    rmSync(claudePath);

    const actions = reconcileVisibleRootAgentInstructions({ userRoot, dryRun: false });
    expect(actions).toEqual([
      expect.objectContaining({ path: agentsPath, status: 'updated' }),
      expect.objectContaining({ path: claudePath, status: 'created' }),
    ]);
    expect(readFileSync(claudePath, 'utf8')).toBe(readFileSync(agentsPath, 'utf8'));
  });

  it('reports both writes during dry-run without touching disk', () => {
    const userRoot = mkdtempSync(join(tmpdir(), 'consuelo-visible-root-agents-'));
    roots.push(userRoot);

    const actions = reconcileVisibleRootAgentInstructions({ userRoot, dryRun: true });
    expect(actions.map((action) => action.status)).toEqual(['planned', 'planned']);
    for (const fileName of ROOT_AGENT_INSTRUCTION_FILE_NAMES) {
      expect(existsSync(join(userRoot, fileName))).toBe(false);
    }
  });

  it('rejects the hidden runtime folder as the visible target', () => {
    const userRoot = mkdtempSync(join(tmpdir(), 'consuelo-visible-root-agents-'));
    roots.push(userRoot);
    const hiddenRoot = join(userRoot, '.consuelo');

    expect(() =>
      reconcileVisibleRootAgentInstructions({ userRoot: hiddenRoot, dryRun: true }),
    ).toThrow(/visible Consuelo folder/);
  });
});
