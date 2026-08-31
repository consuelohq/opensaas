import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const packageFile = (path: string) => new URL(`../${path}`, import.meta.url);
const repoFile = (path: string) => new URL(`../../../${path}`, import.meta.url);
const read = (path: string) => readFileSync(packageFile(path), 'utf8');

const nodePages = [
  ['nodes/index.mdx', 'Overview'],
  ['nodes/local.mdx', 'Local nodes'],
  ['nodes/cloud.mdx', 'Cloud nodes'],
  ['nodes/routing.mdx', 'Routing work'],
] as const;

describe('Nodes documentation contract', () => {
  test('publishes Nodes as one top-level local and cloud section', () => {
    const navigation = read('src/lib/docs-navigation.ts');
    const nodesStart = navigation.indexOf('const nodesItems');
    const nodesEnd = navigation.indexOf('const buildItems');
    const nodesBlock = navigation.slice(nodesStart, nodesEnd);
    let previousIndex = -1;
    expect(nodesStart).toBeGreaterThan(-1);
    expect(nodesEnd).toBeGreaterThan(nodesStart);

    for (const [sourcePath, label] of nodePages) {
      expect(existsSync(packageFile(`src/content/docs/${sourcePath}`))).toBe(true);
      const currentIndex = nodesBlock.indexOf(`label: '${label}'`, previousIndex + 1);
      expect(currentIndex).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
    }

    const sectionsStart = navigation.indexOf('export const docsSections');
    const sectionsEnd = navigation.indexOf('] as const;', sectionsStart);
    const sectionsBlock = navigation.slice(sectionsStart, sectionsEnd);
    const connectIndex = sectionsBlock.indexOf("label: 'Connect', slug: 'connect'");
    const nodesIndex = sectionsBlock.indexOf("label: 'Nodes', slug: 'nodes'");
    const toolsIndex = sectionsBlock.indexOf("label: 'Tools', slug: 'tools'");
    expect(connectIndex).toBeGreaterThan(-1);
    expect(nodesIndex).toBeGreaterThan(connectIndex);
    expect(toolsIndex).toBeGreaterThan(nodesIndex);

    const connectStart = navigation.indexOf('const connectItems');
    const connectEnd = navigation.indexOf('const nodesItems');
    const connectBlock = navigation.slice(connectStart, connectEnd);
    expect(connectBlock).not.toContain("label: 'Nodes'");
  });

  test('records current evidence for every Nodes page', () => {
    for (const [sourcePath] of nodePages) {
      const source = read(`src/content/docs/${sourcePath}`);
      expect(source).toContain('status: preview');
      expect(source).toContain('verifiedAt: 2026-08-12');
      expect(source).toContain('evidence:');
      const evidencePaths = [
        ...source.matchAll(/^\s*- source: (packages\/[^\n]+)$/gm),
        ...source.matchAll(/^\s+- (packages\/[^\n]+)$/gm),
      ].map((match) => match[1]);
      expect(evidencePaths.length).toBeGreaterThan(0);
      for (const evidencePath of evidencePaths) {
        expect(existsSync(repoFile(evidencePath))).toBe(true);
      }
    }
  });

  test('separates home identity, default routing, current node, and presence', () => {
    const overview = read('src/content/docs/nodes/index.mdx');
    for (const term of ['Home', 'Default', 'Current', 'Online / stale / offline', 'enrollment role']) {
      expect(overview).toContain(term);
    }
    expect(overview).toContain('automatically the permanent default');
  });

  test('states the exact current cloud self-service boundary', () => {
    const cloud = read('src/content/docs/nodes/cloud.mdx');
    expect(cloud).toContain('Create cloud node');
    expect(cloud).toContain('Provisioning coming soon');
    expect(cloud).toContain('does not provision a cloud node yet');
    expect(cloud).toContain('Starter');
    expect(cloud).toContain('Standard');
    expect(cloud).toContain('Performance');
    expect(cloud).toContain('Power');
    expect(cloud).toContain('Max');
    expect(cloud).not.toContain('self-service provisioning is available now');
  });

  test('documents default, explicit, and task-owned routing without silent fallback', () => {
    const routing = read('src/content/docs/nodes/routing.mdx');
    for (const term of [
      '`task`',
      '`explicit`',
      '`default`',
      'TASK_NODE_MISMATCH',
      'NODE_ROUTE_MISMATCH',
      'WORKSPACE_NODE_OFFLINE',
      'task.finish',
    ]) {
      expect(routing).toContain(term);
    }
    expect(routing).toContain('does **not** silently fall back');
    expect(routing).toContain('change the workspace default');
  });

  test('redirects the old Start and Connect node URLs instead of serving duplicate pages', () => {
    const redirects = read('src/lib/legacy-redirects.mjs');
    const replacements = [
      ['start/local-and-consuelo-cloud.mdx', "'/start/local-and-consuelo-cloud': '/nodes/'"],
      ['connect/nodes/how-nodes-work.mdx', "'/connect/nodes/how-nodes-work': '/nodes/'"],
      ['connect/nodes/home-node.mdx', "'/connect/nodes/home-node': '/nodes/'"],
      ['connect/nodes/local-nodes.mdx', "'/connect/nodes/local-nodes': '/nodes/local/'"],
      ['connect/nodes/cloud-nodes.mdx', "'/connect/nodes/cloud-nodes': '/nodes/cloud/'"],
    ] as const;

    for (const [sourcePath, redirect] of replacements) {
      expect(existsSync(packageFile(`src/content/docs/${sourcePath}`))).toBe(false);
      expect(redirects).toContain(redirect);
    }
  });

  test('keeps node-specific claims in the Nodes evidence ledger', () => {
    const ledger = read('evidence/nodes-claims.md');
    for (const term of ['defaultNodeId', 'task ownership', 'Provisioning coming soon', 'WORKSPACE_NODE_OFFLINE']) {
      expect(ledger).toContain(term);
    }
  });
});
