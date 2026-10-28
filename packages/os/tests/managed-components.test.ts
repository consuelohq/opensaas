import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  acceptManagedComponentUpstream,
  applyReviewedManagedComponentMerge,
  applySafeManagedComponentItems,
  buildManagedComponentUpdateState,
  detachManagedComponent,
  hashComponentTree,
  inspectManagedComponentConflict,
  keepManagedComponentLocal,
  migrateLegacyManagedMetadata,
  readManagedComponentState,
  refreshManagedComponentPlan,
  requiredManagedContentBaseRefs,
  restoreManagedComponentDefault,
  snapshotManagedComponentLocalOverrides,
  writeManagedComponentState,
  type ComponentTree,
  type ManagedComponentProvenance,
} from '../scripts/lib/managed-components';
import { provisionManagedComponentIndexes } from '../scripts/lib/managed-component-install';

let home: string;
let userRoot: string;

const sourceBundle = {
  bundleId: 'sha256:bundle-next',
  version: '1.2.0',
};

const tree = (content: string, path = 'content.txt'): ComponentTree => ({ [path]: content });
const key = (kind: string, id: string): string => `${kind}:${id}`;

function provenance(input: Partial<ManagedComponentProvenance> & Pick<ManagedComponentProvenance, 'id' | 'kind' | 'baseHash' | 'baseContentRef'>): ManagedComponentProvenance {
  return {
    schemaVersion: 1,
    id: input.id,
    kind: input.kind,
    ownership: input.ownership ?? 'bundled-managed',
    sourceBundleId: input.sourceBundleId ?? 'sha256:bundle-old',
    sourceVersion: input.sourceVersion ?? '1.1.0',
    sourcePath: input.sourcePath ?? `components/${input.kind}/${input.id}`,
    baseHash: input.baseHash,
    baseContentRef: input.baseContentRef,
    localHash: input.localHash ?? input.baseHash,
    upstreamHash: input.upstreamHash ?? input.baseHash,
    installedAt: input.installedAt ?? '2026-07-01T00:00:00.000Z',
    updatedAt: input.updatedAt ?? '2026-07-01T00:00:00.000Z',
    resolutionState: input.resolutionState ?? 'clean',
    ...(input.localPath ? { localPath: input.localPath } : {}),
  };
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'consuelo-managed-components-'));
  userRoot = join(home, 'visible');
  mkdirSync(userRoot, { recursive: true });
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe('managed component update planning', () => {
  it('classifies every required action with deterministic ordering and stable schema', () => {
    const baseSame = tree('same\n');
    const baseUpdate = tree('old\n');
    const baseMerge = tree('first\nmiddle\nlast\n');
    const baseConflict = tree('same line\n');
    const baseRemoved = tree('removed upstream\n');
    const localModified = tree('local only\n');

    const records: ManagedComponentProvenance[] = [
      provenance({ id: 'same', kind: 'script', baseHash: hashComponentTree(baseSame), baseContentRef: hashComponentTree(baseSame) }),
      provenance({ id: 'update', kind: 'skill', baseHash: hashComponentTree(baseUpdate), baseContentRef: hashComponentTree(baseUpdate) }),
      provenance({ id: 'local-only', kind: 'skill', baseHash: hashComponentTree(baseUpdate), baseContentRef: hashComponentTree(baseUpdate), localPath: 'Skills/local-only' }),
      provenance({ id: 'merge', kind: 'tool', baseHash: hashComponentTree(baseMerge), baseContentRef: hashComponentTree(baseMerge), localPath: 'Tools/merge' }),
      provenance({ id: 'conflict', kind: 'site-template', baseHash: hashComponentTree(baseConflict), baseContentRef: hashComponentTree(baseConflict), localPath: 'Sites/conflict' }),
      provenance({ id: 'removed', kind: 'job-template', baseHash: hashComponentTree(baseRemoved), baseContentRef: hashComponentTree(baseRemoved), localPath: 'Jobs/removed' }),
      provenance({ id: 'detached', kind: 'script', ownership: 'detached', resolutionState: 'detached', baseHash: hashComponentTree(baseSame), baseContentRef: hashComponentTree(baseSame), localPath: 'Scripts/detached' }),
    ];

    const first = buildManagedComponentUpdateState({
      generatedAt: '2026-07-23T00:00:00.000Z',
      sourceBundle,
      provenance: [...records].reverse(),
      retainedContent: {
        [hashComponentTree(baseSame)]: baseSame,
        [hashComponentTree(baseUpdate)]: baseUpdate,
        [hashComponentTree(baseMerge)]: baseMerge,
        [hashComponentTree(baseConflict)]: baseConflict,
        [hashComponentTree(baseRemoved)]: baseRemoved,
      },
      upstream: [
        { id: 'new-site', kind: 'site-template', sourcePath: 'sites/new-site', content: tree('new\n') },
        { id: 'same', kind: 'script', sourcePath: 'scripts/same', content: baseSame },
        { id: 'update', kind: 'skill', sourcePath: 'skills/update', content: tree('new\n') },
        { id: 'local-only', kind: 'skill', sourcePath: 'skills/local-only', content: baseUpdate },
        { id: 'merge', kind: 'tool', sourcePath: 'tools/merge', content: tree('first upstream\nmiddle\nlast\n') },
        { id: 'conflict', kind: 'site-template', sourcePath: 'sites/conflict', content: tree('upstream line\n') },
        { id: 'detached', kind: 'script', sourcePath: 'scripts/detached', content: tree('new detached\n') },
        { id: 'collision', kind: 'tool', sourcePath: 'tools/collision', content: tree('bundled\n') },
      ].reverse(),
      localOverrides: [
        { id: 'local-only', kind: 'skill', localPath: 'Skills/local-only', content: localModified },
        { id: 'merge', kind: 'tool', localPath: 'Tools/merge', content: tree('first\nmiddle\nlast local\n') },
        { id: 'conflict', kind: 'site-template', localPath: 'Sites/conflict', content: tree('local line\n') },
        { id: 'removed', kind: 'job-template', localPath: 'Jobs/removed', content: tree('preserve me\n') },
      ].reverse(),
      custom: [
        { id: 'collision', kind: 'tool', localPath: 'Tools/collision', content: tree('customer-owned\n') },
      ],
    });

    const second = buildManagedComponentUpdateState({
      generatedAt: '2026-07-23T00:00:00.000Z',
      sourceBundle,
      provenance: records,
      retainedContent: first.content,
      upstream: [
        { id: 'collision', kind: 'tool', sourcePath: 'tools/collision', content: tree('bundled\n') },
        { id: 'conflict', kind: 'site-template', sourcePath: 'sites/conflict', content: tree('upstream line\n') },
        { id: 'detached', kind: 'script', sourcePath: 'scripts/detached', content: tree('new detached\n') },
        { id: 'local-only', kind: 'skill', sourcePath: 'skills/local-only', content: baseUpdate },
        { id: 'merge', kind: 'tool', sourcePath: 'tools/merge', content: tree('first upstream\nmiddle\nlast\n') },
        { id: 'new-site', kind: 'site-template', sourcePath: 'sites/new-site', content: tree('new\n') },
        { id: 'same', kind: 'script', sourcePath: 'scripts/same', content: baseSame },
        { id: 'update', kind: 'skill', sourcePath: 'skills/update', content: tree('new\n') },
      ],
      localOverrides: [
        { id: 'removed', kind: 'job-template', localPath: 'Jobs/removed', content: tree('preserve me\n') },
        { id: 'conflict', kind: 'site-template', localPath: 'Sites/conflict', content: tree('local line\n') },
        { id: 'merge', kind: 'tool', localPath: 'Tools/merge', content: tree('first\nmiddle\nlast local\n') },
        { id: 'local-only', kind: 'skill', localPath: 'Skills/local-only', content: localModified },
      ],
      custom: [{ id: 'collision', kind: 'tool', localPath: 'Tools/collision', content: tree('customer-owned\n') }],
    });

    expect(first.plan).toEqual(second.plan);
    expect(first.plan).toMatchObject({
      schemaVersion: 1,
      kind: 'consuelo-managed-component-update-plan',
      sourceBundle,
      summary: { total: 9, requiresReview: 2 },
    });
    expect(first.plan.items.map((item) => [item.key, item.action])).toEqual([
      [key('job-template', 'removed'), 'remove-upstream'],
      [key('script', 'detached'), 'detach'],
      [key('script', 'same'), 'no-change'],
      [key('site-template', 'conflict'), 'conflict'],
      [key('site-template', 'new-site'), 'install'],
      [key('skill', 'local-only'), 'preserve-custom'],
      [key('skill', 'update'), 'update-clean'],
      [key('tool', 'collision'), 'preserve-custom'],
      [key('tool', 'merge'), 'merge-clean'],
    ]);
    expect(first.plan.items.find((item) => item.key === key('job-template', 'removed'))).toMatchObject({
      requiresReview: true,
      resolutionState: 'upstream-removed-local-preserved',
    });
    expect(first.plan.items.find((item) => item.key === key('tool', 'collision'))).toMatchObject({
      ownership: 'custom',
      localPath: 'Tools/collision',
    });
    expect(first.plan.items.find((item) => item.key === key('tool', 'merge'))?.mergedContentRef).toMatch(/^sha256:/);
  });

  it('does not serialize source content or token-like values into update-plan.json', () => {
    const sensitive = 'private component fixture text';
    const state = buildManagedComponentUpdateState({
      generatedAt: '2026-07-23T00:00:00.000Z',
      sourceBundle,
      provenance: [],
      retainedContent: {},
      upstream: [{ id: 'secret-script', kind: 'script', sourcePath: 'scripts/secret', content: tree(`${sensitive}\n`) }],
      localOverrides: [],
      custom: [],
    });

    const serialized = JSON.stringify(state.plan);
    expect(serialized).not.toContain(sensitive);
    expect(state.plan.items[0]).not.toHaveProperty('content');
  });

  it('rejects secret-bearing component paths and token-like content', () => {
    expect(() => buildManagedComponentUpdateState({
      generatedAt: '2026-07-23T00:00:00.000Z',
      sourceBundle,
      provenance: [],
      retainedContent: {},
      upstream: [{ id: 'secret-script', kind: 'script', sourcePath: 'scripts/secret', content: { '.env': 'TOKEN=value\n' } }],
      localOverrides: [],
      custom: [],
    })).toThrow(/secret-bearing component content/);

    expect(() => buildManagedComponentUpdateState({
      generatedAt: '2026-07-23T00:00:00.000Z',
      sourceBundle,
      provenance: [],
      retainedContent: {},
      upstream: [{ id: 'secret-script', kind: 'script', sourcePath: 'scripts/secret', content: tree('ghp_abcdefghijklmnopqrstuvwxyz123456\n') }],
      localOverrides: [],
      custom: [],
    })).toThrow(/secret-bearing component content/);
  });

  it('retains content bases only for unresolved review work', () => {
    const base = tree('base\n');
    const baseRef = hashComponentTree(base);
    const state = buildManagedComponentUpdateState({
      generatedAt: '2026-07-23T00:00:00.000Z',
      sourceBundle,
      provenance: [
        provenance({ id: 'conflict', kind: 'tool', baseHash: baseRef, baseContentRef: baseRef, localPath: 'Tools/conflict' }),
        provenance({ id: 'clean', kind: 'skill', baseHash: baseRef, baseContentRef: baseRef }),
      ],
      retainedContent: { [baseRef]: base },
      upstream: [
        { id: 'conflict', kind: 'tool', sourcePath: 'tools/conflict', content: tree('upstream\n') },
        { id: 'clean', kind: 'skill', sourcePath: 'skills/clean', content: tree('next\n') },
      ],
      localOverrides: [{ id: 'conflict', kind: 'tool', localPath: 'Tools/conflict', content: tree('local\n') }],
      custom: [],
    });

    expect(requiredManagedContentBaseRefs(state.provenance, state.plan)).toEqual([baseRef]);
  });
});

describe('managed component state and typed resolution operations', () => {
  function conflictState() {
    const base = tree('base\n');
    const baseRef = hashComponentTree(base);
    return buildManagedComponentUpdateState({
      generatedAt: '2026-07-23T00:00:00.000Z',
      sourceBundle,
      provenance: [provenance({ id: 'conflict', kind: 'tool', baseHash: baseRef, baseContentRef: baseRef, localPath: 'Tools/conflict' })],
      retainedContent: { [baseRef]: base },
      upstream: [{ id: 'conflict', kind: 'tool', sourcePath: 'tools/conflict', content: tree('upstream\n') }],
      localOverrides: [{ id: 'conflict', kind: 'tool', localPath: 'Tools/conflict', content: tree('local\n') }],
      custom: [],
    });
  }

  it('writes stable state files and exposes conflict content only through explicit inspection', () => {
    const state = conflictState();
    const orphanRef = `sha256:${'f'.repeat(64)}`;
    mkdirSync(join(home, 'components', 'content-bases'), { recursive: true });
    writeFileSync(
      join(home, 'components', 'content-bases', `${orphanRef.slice('sha256:'.length)}.json`),
      '{}\n',
    );
    writeManagedComponentState(home, state);

    const planPath = join(home, 'components', 'update-plan.json');
    const provenancePath = join(home, 'components', 'provenance.json');
    const retentionPath = join(home, 'components', 'retention.json');
    expect(existsSync(planPath)).toBe(true);
    expect(existsSync(provenancePath)).toBe(true);
    expect(existsSync(
      join(home, 'components', 'content-bases', `${orphanRef.slice('sha256:'.length)}.json`),
    )).toBe(false);
    expect(JSON.parse(readFileSync(retentionPath, 'utf8'))).toEqual({
      schemaVersion: 1,
      kind: 'consuelo-managed-component-retention',
      requiredContentBaseRefs: [state.provenance[0].baseContentRef],
    });
    expect(readFileSync(planPath, 'utf8')).not.toContain('local\n');

    const reloaded = readManagedComponentState(home);
    expect(reloaded.plan).toEqual(state.plan);
    expect(inspectManagedComponentConflict(home, key('tool', 'conflict'))).toMatchObject({
      base: tree('base\n'),
      local: tree('local\n'),
      upstream: tree('upstream\n'),
    });
  });

  it('applies only safe items and materializes a proven clean merge into visible user content', () => {
    const base = tree('first\nmiddle\nlast\n');
    const baseRef = hashComponentTree(base);
    const state = buildManagedComponentUpdateState({
      generatedAt: '2026-07-23T00:00:00.000Z',
      sourceBundle,
      provenance: [
        provenance({ id: 'merge', kind: 'tool', baseHash: baseRef, baseContentRef: baseRef, localPath: 'Tools/merge' }),
        provenance({ id: 'conflict', kind: 'site-template', baseHash: baseRef, baseContentRef: baseRef, localPath: 'Sites/conflict' }),
      ],
      retainedContent: { [baseRef]: base },
      upstream: [
        { id: 'merge', kind: 'tool', sourcePath: 'tools/merge', content: tree('first upstream\nmiddle\nlast\n') },
        { id: 'conflict', kind: 'site-template', sourcePath: 'sites/conflict', content: tree('upstream only\n') },
        { id: 'new-job', kind: 'job-template', sourcePath: 'jobs/new-job', content: tree('job\n') },
      ],
      localOverrides: [
        { id: 'merge', kind: 'tool', localPath: 'Tools/merge', content: tree('first\nmiddle\nlast local\n') },
        { id: 'conflict', kind: 'site-template', localPath: 'Sites/conflict', content: tree('local only\n') },
      ],
      custom: [],
    });
    writeManagedComponentState(home, state);
    mkdirSync(join(userRoot, 'Tools', 'merge'), { recursive: true });
    writeFileSync(join(userRoot, 'Tools', 'merge', 'content.txt'), 'first\nmiddle\nlast local\n');
    mkdirSync(join(userRoot, 'Sites', 'conflict'), { recursive: true });
    writeFileSync(join(userRoot, 'Sites', 'conflict', 'content.txt'), 'local only\n');

    const result = applySafeManagedComponentItems({ home, userRoot });
    expect(result.applied).toEqual([key('job-template', 'new-job'), key('tool', 'merge')]);
    expect(result.skipped).toEqual([key('site-template', 'conflict')]);
    expect(readFileSync(join(userRoot, 'Tools', 'merge', 'content.txt'), 'utf8')).toBe('first upstream\nmiddle\nlast local\n');
    expect(readFileSync(join(userRoot, 'Sites', 'conflict', 'content.txt'), 'utf8')).toBe('local only\n');
    const persisted = readManagedComponentState(home);
    expect(persisted.provenance.find((item) => item.id === 'new-job')?.ownership).toBe('bundled-managed');
  });

  it('refuses stale local writes and replaces managed trees exactly after hash verification', () => {
    const base = { 'content.txt': 'old\n', 'stale.txt': 'remove me\n' };
    const baseRef = hashComponentTree(base);
    const state = buildManagedComponentUpdateState({
      generatedAt: '2026-07-23T00:00:00.000Z',
      sourceBundle,
      provenance: [provenance({
        id: 'exact-update',
        kind: 'tool',
        baseHash: baseRef,
        baseContentRef: baseRef,
        localPath: 'Tools/exact-update',
      })],
      retainedContent: { [baseRef]: base },
      upstream: [{
        id: 'exact-update',
        kind: 'tool',
        sourcePath: 'tools/exact-update',
        content: tree('new\n'),
      }],
      localOverrides: [],
      custom: [],
    });
    writeManagedComponentState(home, state);
    mkdirSync(join(userRoot, 'Tools', 'exact-update'), { recursive: true });
    writeFileSync(join(userRoot, 'Tools', 'exact-update', 'content.txt'), 'changed after planning\n');
    writeFileSync(join(userRoot, 'Tools', 'exact-update', 'stale.txt'), 'remove me\n');

    expect(() => applySafeManagedComponentItems({ home, userRoot })).toThrow(/changed since the update plan/);
    expect(readFileSync(join(userRoot, 'Tools', 'exact-update', 'content.txt'), 'utf8')).toBe('changed after planning\n');

    writeFileSync(join(userRoot, 'Tools', 'exact-update', 'content.txt'), 'old\n');
    applySafeManagedComponentItems({ home, userRoot });
    expect(readFileSync(join(userRoot, 'Tools', 'exact-update', 'content.txt'), 'utf8')).toBe('new\n');
    expect(existsSync(join(userRoot, 'Tools', 'exact-update', 'stale.txt'))).toBe(false);
  });

  it('accepts upstream, keeps local, applies a reviewed merge, and detaches through explicit operations', () => {
    writeManagedComponentState(home, conflictState());
    mkdirSync(join(userRoot, 'Tools', 'conflict'), { recursive: true });
    writeFileSync(join(userRoot, 'Tools', 'conflict', 'content.txt'), 'local\n');

    acceptManagedComponentUpstream({ home, userRoot, componentKey: key('tool', 'conflict') });
    expect(readFileSync(join(userRoot, 'Tools', 'conflict', 'content.txt'), 'utf8')).toBe('upstream\n');
    expect(readManagedComponentState(home).provenance[0].resolutionState).toBe('accepted-upstream');

    writeManagedComponentState(home, conflictState());
    writeFileSync(join(userRoot, 'Tools', 'conflict', 'content.txt'), 'local\n');
    keepManagedComponentLocal({ home, userRoot, componentKey: key('tool', 'conflict') });
    expect(readManagedComponentState(home).provenance[0]).toMatchObject({
      ownership: 'bundled-managed',
      resolutionState: 'kept-local',
    });

    writeManagedComponentState(home, conflictState());
    writeFileSync(join(userRoot, 'Tools', 'conflict', 'content.txt'), 'local\n');
    const conflict = inspectManagedComponentConflict(home, key('tool', 'conflict'));
    applyReviewedManagedComponentMerge({
      home,
      userRoot,
      componentKey: key('tool', 'conflict'),
      merged: tree('reviewed merge\n'),
      expectedLocalHash: conflict.item.localHash!,
      expectedUpstreamHash: conflict.item.upstreamHash!,
    });
    expect(readFileSync(join(userRoot, 'Tools', 'conflict', 'content.txt'), 'utf8')).toBe('reviewed merge\n');
    expect(readManagedComponentState(home).provenance[0].resolutionState).toBe('reviewed-merge');

    detachManagedComponent({ home, componentKey: key('tool', 'conflict') });
    expect(readManagedComponentState(home).provenance[0]).toMatchObject({
      ownership: 'detached',
      resolutionState: 'detached',
    });
  });

  it('refreshes from live visible trees and preserves a keep-local decision', () => {
    writeManagedComponentState(home, conflictState());
    mkdirSync(join(userRoot, 'Tools', 'conflict'), { recursive: true });
    writeFileSync(join(userRoot, 'Tools', 'conflict', 'content.txt'), 'local\n');

    keepManagedComponentLocal({ home, userRoot, componentKey: key('tool', 'conflict') });
    const refreshed = refreshManagedComponentPlan({
      home,
      userRoot,
      generatedAt: '2026-07-23T00:01:00.000Z',
    });

    expect(refreshed.provenance[0]).toMatchObject({
      localHash: hashComponentTree(tree('local\n')),
      resolutionState: 'kept-local',
    });
    expect(refreshed.plan.items[0]).toMatchObject({
      action: 'preserve-custom',
      localHash: hashComponentTree(tree('local\n')),
      resolutionState: 'kept-local',
    });
    expect(readFileSync(join(userRoot, 'Tools', 'conflict', 'content.txt'), 'utf8')).toBe('local\n');
  });

  it('inspects an upstream removal review without fabricating upstream content', () => {
    const base = tree('bundled\n');
    const baseRef = hashComponentTree(base);
    const local = tree('customer change\n');
    const state = buildManagedComponentUpdateState({
      generatedAt: '2026-07-23T00:00:00.000Z',
      sourceBundle,
      provenance: [provenance({
        id: 'removed',
        kind: 'job-template',
        baseHash: baseRef,
        baseContentRef: baseRef,
        localPath: 'Jobs/removed',
      })],
      retainedContent: { [baseRef]: base },
      upstream: [],
      localOverrides: [{
        id: 'removed',
        kind: 'job-template',
        localPath: 'Jobs/removed',
        content: local,
      }],
      custom: [],
    });
    writeManagedComponentState(home, state);

    expect(inspectManagedComponentConflict(home, key('job-template', 'removed'))).toEqual({
      item: state.plan.items[0],
      base,
      local,
      upstream: null,
    });
  });

  it('restores a bundled default to a new visible path without replacing local content', () => {
    writeManagedComponentState(home, conflictState());
    const localPath = join(userRoot, 'Tools', 'conflict', 'content.txt');
    mkdirSync(join(userRoot, 'Tools', 'conflict'), { recursive: true });
    writeFileSync(localPath, 'local remains\n');

    const restored = restoreManagedComponentDefault({
      home,
      userRoot,
      componentKey: key('tool', 'conflict'),
      destination: 'Tools/conflict-bundled-default',
    });

    expect(restored).toBe(join(userRoot, 'Tools', 'conflict-bundled-default'));
    expect(readFileSync(localPath, 'utf8')).toBe('local remains\n');
    expect(readFileSync(join(restored, 'content.txt'), 'utf8')).toBe('upstream\n');
    expect(() => restoreManagedComponentDefault({
      home,
      userRoot,
      componentKey: key('tool', 'conflict'),
      destination: 'Tools/conflict-bundled-default',
    })).toThrow(/already exists/);
    expect(() => restoreManagedComponentDefault({
      home,
      userRoot,
      componentKey: key('tool', 'conflict'),
      destination: '../escape',
    })).toThrow(/inside the visible user root/);
  });
});

describe('managed metadata migration and ownership', () => {
  it('migrates legacy bundled metadata without treating a same-name custom component as bundled', () => {
    const migrated = migrateLegacyManagedMetadata({
      kind: 'skill',
      metadata: {
        version: 1,
        name: 'task',
        source: 'bundled',
        sourcePath: 'skills/task',
        hash: 'sha256:legacy',
        installedAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-02T00:00:00.000Z',
      },
      sourceBundleId: 'sha256:bundle-old',
      sourceVersion: '1.1.0',
    });
    expect(migrated).toMatchObject({
      schemaVersion: 1,
      id: 'task',
      kind: 'skill',
      ownership: 'bundled-managed',
      baseHash: 'sha256:legacy',
      baseContentRef: 'sha256:legacy',
      resolutionState: 'clean',
    });

    const customContent = tree('my own task skill\n');
    const state = buildManagedComponentUpdateState({
      generatedAt: '2026-07-23T00:00:00.000Z',
      sourceBundle,
      provenance: [],
      retainedContent: {},
      upstream: [{ id: 'task', kind: 'skill', sourcePath: 'skills/task', content: tree('bundled task\n') }],
      localOverrides: [],
      custom: [{ id: 'task', kind: 'skill', localPath: 'Skills/task', content: customContent }],
    });
    expect(state.plan.items[0]).toMatchObject({ action: 'preserve-custom', ownership: 'custom' });
    expect(state.provenance).toEqual([]);
  });
});

describe('visible steering provisioning integration', () => {
  it('does not copy stream-scoped dialer instructions into the visible user root', () => {
    const actions = provisionManagedComponentIndexes({
      home,
      selectedSkills: [],
      dryRun: false,
      generatedAt: '2026-07-23T00:00:00.000Z',
      userRoot,
    });
    const target = join(userRoot, 'Steering', 'dialer-AGENTS.md');

    expect(existsSync(target)).toBe(false);
    expect(actions.some((action) => action.path === target)).toBe(false);
  });
});
describe('managed component provisioning integration', () => {
  it('should run built-in tool wrappers from the active runtime with persisted Bun', () => {
    provisionManagedComponentIndexes({
      home,
      selectedSkills: [],
      dryRun: false,
      generatedAt: '2026-07-23T00:00:00.000Z',
      userRoot,
    });
    const runtimeRoot = join(home, 'runtime', 'current');
    const runnerPath = join(runtimeRoot, 'scripts', 'tool-runner.ts');
    const bunExecutable = join(home, 'managed-bun');
    mkdirSync(join(runtimeRoot, 'scripts'), { recursive: true });
    writeFileSync(runnerPath, '// tool runner fixture\n');
    writeFileSync(
      bunExecutable,
      '#!/bin/bash\nprintf \'%s\\n\' "$@"\n',
      { mode: 0o755 },
    );
    writeFileSync(
      join(home, '.env'),
      `BUN_BIN=${bunExecutable}\n`,
      { mode: 0o600 },
    );

    const result = spawnSync(join(home, 'bin', 'status'), ['{"ok":true}'], {
      encoding: 'utf8',
      env: {
        CONSUELO_HOME: home,
        HOME: userRoot,
        PATH: '/usr/bin:/bin',
      },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout.trim().split('\n')).toEqual([
      runnerPath,
      'status',
      '{"ok":true}',
    ]);
  });

  it('should remove a clean visible skill and preserve a modified skill when it is deselected', () => {
    const firstActions = provisionManagedComponentIndexes({
      home,
      selectedSkills: ['task'],
      dryRun: false,
      generatedAt: '2026-07-23T00:00:00.000Z',
      userRoot,
    });
    const skillPath = join(userRoot, 'Skills', 'task');
    const skillInstructionsPath = join(skillPath, 'SKILL.md');
    expect(existsSync(skillInstructionsPath)).toBe(true);
    expect(firstActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'seed_skill',
        path: skillPath,
        status: 'created',
      }),
    ]));

    const repeatedActions = provisionManagedComponentIndexes({
      home,
      selectedSkills: ['task'],
      dryRun: false,
      generatedAt: '2026-07-23T00:01:00.000Z',
      userRoot,
    });
    expect(repeatedActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'seed_skill',
        path: skillPath,
        status: 'preserved',
      }),
    ]));

    provisionManagedComponentIndexes({
      home,
      selectedSkills: [],
      dryRun: false,
      generatedAt: '2026-07-23T00:02:00.000Z',
      userRoot,
    });
    expect(existsSync(skillPath)).toBe(false);
    expect(
      readManagedComponentState(home).provenance.some(
        (record) => record.kind === 'skill' && record.id === 'task',
      ),
    ).toBe(false);

    provisionManagedComponentIndexes({
      home,
      selectedSkills: ['task'],
      dryRun: false,
      generatedAt: '2026-07-23T00:03:00.000Z',
      userRoot,
    });
    writeFileSync(
      skillInstructionsPath,
      `${readFileSync(skillInstructionsPath, 'utf8')}\nUser customization.\n`,
    );
    provisionManagedComponentIndexes({
      home,
      selectedSkills: [],
      dryRun: false,
      generatedAt: '2026-07-23T00:04:00.000Z',
      userRoot,
    });
    expect(existsSync(skillInstructionsPath)).toBe(true);
    expect(
      readManagedComponentState(home).plan.items.find(
        (item) => item.key === key('skill', 'task'),
      ),
    ).toMatchObject({
      action: 'remove-upstream',
      requiresReview: true,
    });
  });

  it('should re-plan a selected skill when its visible directory was removed', () => {
    provisionManagedComponentIndexes({
      home,
      selectedSkills: ['task'],
      dryRun: false,
      generatedAt: '2026-07-23T00:00:00.000Z',
      userRoot,
    });
    const skillPath = join(userRoot, 'Skills', 'task');
    rmSync(skillPath, { recursive: true, force: true });

    expect(() => provisionManagedComponentIndexes({
      home,
      selectedSkills: ['task'],
      dryRun: false,
      generatedAt: '2026-07-23T00:01:00.000Z',
      userRoot,
    })).not.toThrow();
    expect(existsSync(join(skillPath, 'SKILL.md'))).toBe(true);

    rmSync(skillPath, { recursive: true, force: true });
    writeFileSync(skillPath, 'user-owned replacement\n');
    const actions = provisionManagedComponentIndexes({
      home,
      selectedSkills: ['task'],
      dryRun: false,
      generatedAt: '2026-07-23T00:02:00.000Z',
      userRoot,
    });
    expect(readFileSync(skillPath, 'utf8')).toBe('user-owned replacement\n');
    expect(actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'seed_skill',
        path: skillPath,
        status: 'skipped',
      }),
    ]));

    const current = readManagedComponentState(home);
    const changedUpstream = [{
      id: 'task',
      kind: 'skill' as const,
      sourcePath: 'skills/task',
      localPath: 'Skills/task',
      content: { 'SKILL.md': '# changed upstream\n' },
    }];
    const localOverrides = snapshotManagedComponentLocalOverrides(
      userRoot,
      current.provenance,
      changedUpstream,
    );
    expect(localOverrides).toEqual([
      expect.objectContaining({
        id: 'task',
        kind: 'skill',
        localPath: 'Skills/task',
        obstruction: 'file',
      }),
    ]);
    const obstructed = buildManagedComponentUpdateState({
      generatedAt: '2026-07-23T00:03:00.000Z',
      sourceBundle: {
        bundleId: 'sha256:changed',
        version: '1.2.1',
      },
      provenance: current.provenance,
      retainedContent: current.content,
      upstream: changedUpstream,
      localOverrides,
      custom: [],
    });
    expect(
      obstructed.plan.items.find(
        (item) => item.key === key('skill', 'task'),
      ),
    ).toMatchObject({
      action: 'conflict',
      requiresReview: true,
      resolutionState: 'conflict',
    });
  });

  it('loads a configured visible local tree when rebuilding the production update plan', () => {
    provisionManagedComponentIndexes({
      home,
      selectedSkills: [],
      dryRun: false,
      generatedAt: '2026-07-23T00:00:00.000Z',
      userRoot,
    });
    const initial = readManagedComponentState(home);
    initial.provenance = initial.provenance.map((record) => record.kind === 'tool' && record.id === 'status'
      ? { ...record, localPath: 'Tools/status' }
      : record);
    writeManagedComponentState(home, initial);

    const visible = { 'tool.json': '{"name":"status","description":"customer visible override"}\n' };
    mkdirSync(join(userRoot, 'Tools', 'status'), { recursive: true });
    writeFileSync(join(userRoot, 'Tools', 'status', 'tool.json'), visible['tool.json']);

    provisionManagedComponentIndexes({
      home,
      selectedSkills: [],
      dryRun: false,
      generatedAt: '2026-07-23T00:01:00.000Z',
      userRoot,
    });

    const refreshed = readManagedComponentState(home);
    expect(refreshed.plan.items.find((item) => item.key === key('tool', 'status'))).toMatchObject({
      action: 'preserve-custom',
      localPath: 'Tools/status',
      localHash: hashComponentTree(visible),
    });
    expect(readFileSync(join(userRoot, 'Tools', 'status', 'tool.json'), 'utf8')).toBe(visible['tool.json']);
  });
});


describe('managed component CLI', () => {
  it('exposes stable plan and explicit conflict inspection commands', () => {
    const base = tree('base\n');
    const baseRef = hashComponentTree(base);
    const state = buildManagedComponentUpdateState({
      generatedAt: '2026-07-23T00:00:00.000Z',
      sourceBundle,
      provenance: [provenance({
        id: 'conflict',
        kind: 'tool',
        baseHash: baseRef,
        baseContentRef: baseRef,
        localPath: 'Tools/conflict',
      })],
      retainedContent: { [baseRef]: base },
      upstream: [{ id: 'conflict', kind: 'tool', sourcePath: 'tools/conflict', content: tree('upstream\n') }],
      localOverrides: [{ id: 'conflict', kind: 'tool', localPath: 'Tools/conflict', content: tree('local\n') }],
      custom: [],
    });
    writeManagedComponentState(home, state);

    const planCommand = spawnSync('bun', [
      'scripts/managed-components.ts',
      'inspect-plan',
      '--home',
      home,
      '--json',
    ], { cwd: process.cwd(), encoding: 'utf8' });
    expect(planCommand.status).toBe(0);
    expect(JSON.parse(planCommand.stdout)).toMatchObject({
      ok: true,
      command: 'inspect-plan',
      plan: {
        schemaVersion: 1,
        summary: { total: 1, requiresReview: 1 },
      },
    });

    const conflictCommand = spawnSync('bun', [
      'scripts/managed-components.ts',
      'inspect-conflict',
      '--home',
      home,
      '--component',
      key('tool', 'conflict'),
      '--json',
    ], { cwd: process.cwd(), encoding: 'utf8' });
    expect(conflictCommand.status).toBe(0);
    expect(JSON.parse(conflictCommand.stdout)).toMatchObject({
      ok: true,
      command: 'inspect-conflict',
      component: key('tool', 'conflict'),
      conflict: {
        base: tree('base\n'),
        local: tree('local\n'),
        upstream: tree('upstream\n'),
      },
    });

    mkdirSync(join(userRoot, 'Tools', 'conflict'), { recursive: true });
    writeFileSync(join(userRoot, 'Tools', 'conflict', 'content.txt'), 'local\n');
    const refreshCommand = spawnSync('bun', [
      'scripts/managed-components.ts',
      'refresh-plan',
      '--home',
      home,
      '--user-root',
      userRoot,
      '--json',
    ], { cwd: process.cwd(), encoding: 'utf8' });
    expect(refreshCommand.status).toBe(0);
    expect(JSON.parse(refreshCommand.stdout)).toMatchObject({
      ok: true,
      command: 'refresh-plan',
      plan: { summary: { total: 1, requiresReview: 1 } },
    });
  });
});
