import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const packageFile = (path: string) => new URL(`../${path}`, import.meta.url);
const repoFile = (path: string) => new URL(`../../../${path}`, import.meta.url);
const read = (path: string) => readFileSync(packageFile(path), 'utf8');

const promotedPages = [
  'tools/index.mdx',
  'tools/tool-list.mdx',
  'skills/index.mdx',
  'steering/index.mdx',
  'memory/index.mdx',
  'memory/workpads.mdx',
  'memory/handoffs.mdx',
  'memory/streams.mdx',
  'memory/saved-memory-and-traces.mdx',
] as const;

const preservedDetailPages = [
  'build/tools/how-tools-work.mdx',
  'build/tools/workspace.mdx',
  'build/tools/browser.mdx',
  'build/tools/media.mdx',
  'build/skills/how-skills-work.mdx',
  'build/skills/install-a-skill.mdx',
  'build/skills/create-a-skill.mdx',
  'build/skills/skill-structure.mdx',
  'build/steering/how-steering-works.mdx',
  'build/steering/workspace-steering.mdx',
  'build/steering/project-steering.mdx',
  'build/workflows.mdx',
  'build/shared-memory-and-context.mdx',
  'build/files-and-artifacts.mdx',
  'secure/approvals.mdx',
  'sites/index.mdx',
] as const;

describe('promoted Tools, Skills, Steering, and Memory documentation contract', () => {
  test('publishes the new top-level landing pages without deleting existing detail docs', () => {
    for (const sourcePath of [...promotedPages, ...preservedDetailPages]) {
      expect(existsSync(packageFile(`src/content/docs/${sourcePath}`))).toBe(true);
    }

    const navigation = read('src/lib/docs-navigation.ts');
    for (const needle of [
      "label: 'Tools', slug: 'tools'",
      "label: 'Tool List', slug: 'tools/tool-list'",
      "label: 'Skills', slug: 'skills'",
      "label: 'Steering', slug: 'steering'",
      "label: 'Memory', slug: 'memory'",
      "label: 'Workpads', slug: 'memory/workpads'",
      "label: 'Handoffs', slug: 'memory/handoffs'",
      "label: 'Streams', slug: 'memory/streams'",
      "label: 'Memory tool and traces', slug: 'memory/saved-memory-and-traces'",
    ]) {
      expect(navigation).toContain(needle);
    }
    expect(navigation).not.toContain("label: 'Build with OS'");
  });

  test('keeps Sites under Tools and durable files under Memory', () => {
    const navigation = read('src/lib/docs-navigation.ts');
    expect(navigation).toContain("label: 'Sites'");
    expect(navigation).toContain("label: 'Files and artifacts', slug: 'build/files-and-artifacts'");
    expect(navigation).toContain("label: 'Approvals', slug: 'secure/approvals'");
  });

  test('generates Tool List headings from every canonical facade tool in alphabetical order', () => {
    const source = read('src/content/docs/tools/tool-list.mdx');
    const manifest = JSON.parse(readFileSync(repoFile('packages/os/manifests/generated/tool.manifest.json'), 'utf8')) as {
      tools: Array<{ name?: string }>;
    };
    const expected = manifest.tools
      .map((tool) => tool.name)
      .filter((name): name is string => Boolean(name))
      .sort((left, right) => left.localeCompare(right));
    const headings = [...source.matchAll(/^## `([^`]+)`$/gm)].map((match) => match[1]);

    expect(expected.length).toBeGreaterThan(100);
    expect(headings).toEqual(expected);
    expect(new Set(headings).size).toBe(headings.length);
  });

  test('marks new pages as current preview docs with checked-in evidence', () => {
    for (const sourcePath of promotedPages) {
      const source = read(`src/content/docs/${sourcePath}`);
      expect(source).toContain('status: preview');
      expect(source).toContain('verifiedAt: 2026-08-11');
      expect(source).toContain('evidence:');
      expect(source).toContain('source:');
    }
  });

  test('documents workpads as task-local memory that is saved at publish time', () => {
    const workpads = read('src/content/docs/memory/workpads.mdx');
    for (const term of [
      '.task/<area>/<task-slug>/workpad.md',
      'acceptance criteria',
      'Test-first contract',
      'task.push',
      'category',
      'workpad',
      'best-effort',
    ]) expect(workpads).toContain(term);
    expect(workpads).toContain('packages/os/scripts/lib/task-workpad.js');
    expect(workpads).toContain('packages/os/scripts/task-push.js');
  });

  test('documents handoffs as explicit continuation-ready saved memory', () => {
    const handoffs = read('src/content/docs/memory/handoffs.mdx');
    for (const term of ['continuation-ready', 'zero-context', 'memory', 'handoff', 'search', 'full handoff']) {
      expect(handoffs.toLowerCase()).toContain(term.toLowerCase());
    }
    expect(handoffs).toContain('packages/os/skills/handoff/SKILL.md');
  });

  test('documents stream context as the cross-agent continuity surface', () => {
    const streams = read('src/content/docs/memory/streams.mdx');
    for (const term of [
      'stream.context',
      'stream instructions',
      'stream decisions',
      'open task PRs',
      'recent workpads',
      'recent commits',
      'worktrees',
    ]) expect(streams).toContain(term);
    expect(streams).toContain('packages/os/scripts/lib/streams/context-runtime.ts');
  });

  test('references evidence files that exist in the current repository', () => {
    for (const sourcePath of promotedPages) {
      const source = read(`src/content/docs/${sourcePath}`);
      const evidencePaths = [
        ...source.matchAll(/^\s*- source: (packages\/[^\n]+)$/gm),
        ...source.matchAll(/^\s+- (packages\/[^\n]+)$/gm),
      ].map((match) => match[1]);
      expect(evidencePaths.length).toBeGreaterThan(0);
      for (const evidencePath of evidencePaths) expect(existsSync(repoFile(evidencePath))).toBe(true);
    }
  });
});
