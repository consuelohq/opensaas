import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const packageFile = (path: string) => new URL(`../${path}`, import.meta.url);
const repoFile = (path: string) => new URL(`../../../${path}`, import.meta.url);
const read = (path: string) => readFileSync(packageFile(path), 'utf8');

const buildPages = [
  ['build/index.mdx', 'Overview'],
  ['build/tools/how-tools-work.mdx', 'How tools work'],
  ['build/tools/workspace.mdx', 'Workspace'],
  ['build/tools/browser.mdx', 'Browser'],
  ['build/tools/office.mdx', 'Office'],
  ['build/tools/media.mdx', 'Media'],
  ['build/skills/how-skills-work.mdx', 'How skills work'],
  ['build/skills/install-a-skill.mdx', 'Install a skill'],
  ['build/skills/create-a-skill.mdx', 'Create a skill'],
  ['build/skills/skill-structure.mdx', 'Skill structure'],
  ['build/steering/how-steering-works.mdx', 'How steering works'],
  ['build/steering/workspace-steering.mdx', 'Workspace steering'],
  ['build/steering/project-steering.mdx', 'Project steering'],
  ['build/workflows.mdx', 'Workflows'],
  ['build/shared-memory-and-context.mdx', 'Shared memory and context'],
  ['build/files-and-artifacts.mdx', 'Files and artifacts'],
  ['build/approvals.mdx', 'Approvals'],
] as const;

describe('Build with OS documentation contract', () => {
  test('publishes the complete approved Build with OS hierarchy in navigation order', () => {
    const navigation = read('src/lib/docs-navigation.ts');
    const orderedLabels = [
      "label: 'Overview', slug: 'build'",
      "label: 'Tools'",
      "label: 'How tools work'",
      "label: 'Workspace'",
      "label: 'Browser'",
      "label: 'Office'",
      "label: 'Media'",
      "label: 'Skills'",
      "label: 'How skills work'",
      "label: 'Install a skill'",
      "label: 'Create a skill'",
      "label: 'Skill structure'",
      "label: 'Steering'",
      "label: 'How steering works'",
      "label: 'Workspace steering'",
      "label: 'Project steering'",
      "label: 'Workflows'",
      "label: 'Shared memory and context'",
      "label: 'Files and artifacts'",
      "label: 'Approvals'",
    ];
    let previousIndex = -1;
    for (const needle of orderedLabels) {
      const currentIndex = navigation.indexOf(needle, previousIndex + 1);
      expect(currentIndex).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
    }

    for (const [sourcePath] of buildPages) {
      expect(existsSync(packageFile(`src/content/docs/${sourcePath}`))).toBe(true);
    }
  });

  test('marks every Build page as preview and records current evidence', () => {
    for (const [sourcePath] of buildPages) {
      const source = read(`src/content/docs/${sourcePath}`);
      expect(source).toContain('status: preview');
      expect(source).toContain('verifiedAt: 2026-07-13');
      expect(source).toContain('evidence:');
      expect(source).toContain('source:');
      expect(source).toContain('tests:');
      expect(source).toContain('runtime:');
      expect(source).not.toContain('Use this section when you are defining what agents can do');
    }
  });

  test('references evidence files that exist in the current repository', () => {
    for (const [sourcePath] of buildPages) {
      const source = read(`src/content/docs/${sourcePath}`);
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

  test('teaches the verified tool, skill, script, and workflow boundaries', () => {
    const overview = read('src/content/docs/build/index.mdx');
    expect(overview).toContain('tool');
    expect(overview).toContain('skill');
    expect(overview).toContain('script');
    expect(overview).toContain('steering');

    const tools = read('src/content/docs/build/tools/how-tools-work.mdx');
    expect(tools).toContain('get_steering');
    expect(tools).toContain('call');
    expect(tools).toContain('tools.search');
    expect(tools).toContain('typed input');

    const skills = read('src/content/docs/build/skills/how-skills-work.mdx');
    expect(skills).toContain('SKILL.md');
    expect(skills).toContain('skill.json');
    expect(skills).toContain('script');

    const workflows = read('src/content/docs/build/workflows.mdx');
    expect(workflows).toContain('workflow bundle');
    expect(workflows).toContain('taskSession');
    expect(workflows).not.toContain('runbook');
  });

  test('documents current support boundaries instead of planned product behavior', () => {
    const approvals = read('src/content/docs/build/approvals.mdx');
    expect(approvals).toContain('APPROVAL_REQUIRED');
    expect(approvals).toContain('before execution');
    expect(approvals).not.toContain('automatically resumes');

    const memory = read('src/content/docs/build/shared-memory-and-context.mdx');
    expect(memory).toContain('structured');
    expect(memory).toContain('source of truth');
    expect(memory).not.toContain('remembers everything');

    const artifacts = read('src/content/docs/build/files-and-artifacts.mdx');
    expect(artifacts).toContain('local');
    expect(artifacts).toContain('trace');
    expect(artifacts).toContain('app-visible');
  });

  test('keeps a checked-in Build with OS claim ledger', () => {
    const ledger = read('evidence/build-claims.md');
    for (const heading of [
      'Claim',
      'Public page',
      'Source code',
      'Tests',
      'Runtime verification',
      'Status',
    ]) {
      expect(ledger).toContain(heading);
    }
    expect(ledger).toContain('Tools');
    expect(ledger).toContain('Skills');
    expect(ledger).toContain('Steering');
    expect(ledger).toContain('Approvals');
  });

  test('replaces directly superseded legacy Build pages with redirects', () => {
    const redirects = read('src/lib/legacy-redirects.mjs');
    const replacements = [
      ['os/concepts/portal.mdx', "'/os/concepts/portal': '/build/tools/how-tools-work/'"],
      ['os/concepts/skills.mdx', "'/os/concepts/skills': '/build/skills/how-skills-work/'"],
      ['os/concepts/scripts.mdx', "'/os/concepts/scripts': '/build/skills/skill-structure/'"],
      ['os/concepts/context-and-memory.mdx', "'/os/concepts/context-and-memory': '/build/shared-memory-and-context/'"],
      ['os/concepts/files-and-artifacts.mdx', "'/os/concepts/files-and-artifacts': '/build/files-and-artifacts/'"],
      ['os/concepts/approvals.mdx', "'/os/concepts/approvals': '/build/approvals/'"],
      ['os/tools/overview.mdx', "'/os/tools/overview': '/build/tools/workspace/'"],
      ['os/tools/browser-tools.mdx', "'/os/tools/browser-tools': '/build/tools/browser/'"],
      ['tools/overview.mdx', "'/tools/overview': '/build/tools/how-tools-work/'"],
      ['tools/office.mdx', "'/tools/office': '/build/tools/office/'"],
      ['tools/media/getting-started.mdx', "'/tools/media/getting-started': '/build/tools/media/'"],
      ['developers/agent/tool-system.mdx', "'/developers/agent/tool-system': '/build/tools/how-tools-work/'"],
    ] as const;

    for (const [sourcePath, redirect] of replacements) {
      expect(existsSync(packageFile(`src/content/docs/${sourcePath}`))).toBe(false);
      expect(redirects).toContain(redirect);
    }
  });
});
