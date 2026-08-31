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
  ['build/tools/artifacts.mdx', 'Artifacts'],
  ['build/tools/media.mdx', 'Media'],
  ['build/skills/how-skills-work.mdx', 'How skills work'],
  ['build/skills/install-a-skill.mdx', 'Install a skill'],
  ['build/skills/create-a-skill.mdx', 'Create a skill'],
  ['build/skills/skill-structure.mdx', 'Skill structure'],
  ['build/skills/bundled/index.mdx', 'Skill Templates'],
  ['build/skills/bundled/artifacts.mdx', 'Artifacts'],
  ['build/skills/bundled/branch.mdx', 'Branch'],
  ['build/skills/bundled/browser.mdx', 'Browser'],
  ['build/skills/bundled/debugger.mdx', 'Debugger'],
  ['build/skills/bundled/handoff.mdx', 'Handoff'],
  ['build/skills/bundled/research-ingest.mdx', 'Research Ingest'],
  ['build/skills/bundled/senior-engineer.mdx', 'Senior Engineer'],
  ['build/skills/bundled/sites.mdx', 'Sites'],
  ['build/skills/bundled/skill-creator.mdx', 'Skill Creator'],
  ['build/skills/bundled/task.mdx', 'Task'],
  ['build/skills/bundled/teach.mdx', 'Teach'],
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
      "label: 'Artifacts'",
      "label: 'Media'",
      "label: 'Skills'",
      "label: 'How skills work'",
      "label: 'Install a skill'",
      "label: 'Create a skill'",
      "label: 'Skill structure'",
      "label: 'Skill Templates'",
      "slug: 'build/skills/bundled'",
      "slug: 'build/skills/bundled/artifacts'",
      "slug: 'build/skills/bundled/branch'",
      "slug: 'build/skills/bundled/browser'",
      "slug: 'build/skills/bundled/debugger'",
      "slug: 'build/skills/bundled/handoff'",
      "slug: 'build/skills/bundled/research-ingest'",
      "slug: 'build/skills/bundled/senior-engineer'",
      "slug: 'build/skills/bundled/sites'",
      "slug: 'build/skills/bundled/skill-creator'",
      "slug: 'build/skills/bundled/task'",
      "slug: 'build/skills/bundled/teach'",
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
      expect(source).toMatch(/verifiedAt: 2026-\d{2}-\d{2}/);
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

  test('documents every skill template in the final Skills subgroup', () => {
    const registry = JSON.parse(readFileSync(repoFile('packages/os/skills/skills.json'), 'utf8')) as { skills: Array<{ name: string }> };
    const expected = registry.skills.map((skill) => skill.name).sort();
    const documented = buildPages
      .map(([sourcePath]) => sourcePath.match(/^build\/skills\/bundled\/([^/]+)\.mdx$/)?.[1])
      .filter((name): name is string => Boolean(name) && name !== 'index')
      .sort();
    expect(documented).toEqual(expected);

    const navigation = read('src/lib/docs-navigation.ts');
    const skillStructureIndex = navigation.indexOf("label: 'Skill structure'");
    const bundledIndex = navigation.indexOf("label: 'Skill Templates'", skillStructureIndex);
    const steeringIndex = navigation.indexOf("label: 'Steering'", bundledIndex);
    expect(bundledIndex).toBeGreaterThan(skillStructureIndex);
    expect(steeringIndex).toBeGreaterThan(bundledIndex);
  });

  test('renders each skill template from the exact skill metadata and SKILL.md source', () => {
    const registry = JSON.parse(readFileSync(repoFile('packages/os/skills/skills.json'), 'utf8')) as {
      skills: Array<{ name: string; title: string; description: string }>;
    };
    for (const skill of registry.skills) {
      const page = read(`src/content/docs/build/skills/bundled/${skill.name}.mdx`);
      const skillSource = readFileSync(repoFile(`packages/os/skills/${skill.name}/SKILL.md`), 'utf8');
      expect(page).toContain(`title: ${JSON.stringify(skill.title)}`);
      expect(page).toContain(`description: ${JSON.stringify(skill.description)}`);
      expect(page.indexOf('## Enable it')).toBeLessThan(page.indexOf('## Description'));
      expect(page.indexOf('## Description')).toBeLessThan(page.indexOf('## SKILL.md'));
      expect(page).toContain(`consuelo add skill ${skill.name}`);
      expect(page).toContain(`consuelo remove skill ${skill.name}`);
      const renderedDescription = skill.description.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
      expect(page).toContain(`\n${renderedDescription}\n`);

      const startMarker = '{/* skill-source:start */}';
      const authored = page.slice(0, page.indexOf(startMarker));
      expect(authored).not.toContain('## When to use it');
      expect(authored).not.toContain('## What the agent loads');
      expect(authored).not.toContain('## Boundary');
      expect(authored).not.toContain('## Verify');

      const endMarker = '{/* skill-source:end */}';
      const start = page.indexOf(startMarker);
      const end = page.indexOf(endMarker, start + startMarker.length);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeGreaterThan(start);
      const fenced = page.slice(start + startMarker.length, end).trim();
      const firstNewline = fenced.indexOf('\n');
      const lastNewline = fenced.lastIndexOf('\n');
      expect(firstNewline).toBeGreaterThan(0);
      expect(lastNewline).toBeGreaterThan(firstNewline);
      const openingFence = fenced.slice(0, firstNewline).match(/^(`{4,})markdown$/)?.[1];
      expect(openingFence).toBeTruthy();
      expect(fenced.slice(lastNewline + 1)).toBe(openingFence);
      expect(fenced.slice(firstNewline + 1, lastNewline)).toBe(skillSource.replace(/\n$/, ''));
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

  test('promotes the current subagent tool and retires the legacy OS page', () => {
    const navigation = read('src/lib/docs-navigation.ts');
    expect(navigation).toContain("label: 'Subagents', slug: 'tools/subagents'");

    const sourcePath = 'tools/subagents.mdx';
    expect(existsSync(packageFile(`src/content/docs/${sourcePath}`))).toBe(true);
    const source = read(`src/content/docs/${sourcePath}`);
    for (const term of [
      'run',
      'start',
      'status',
      'wait',
      'logs',
      'cancel',
      'instructionPath',
      'taskSession',
      'requestId',
      'CAPABILITY_NOT_SUPPORTED',
    ]) {
      expect(source).toContain(term);
    }
    expect(source).toContain('verifiedAt: 2026-08-12');
    expect(source).toContain('packages/os/tools/subagent/schema.ts');
    expect(source).toContain('packages/os/tests/subagent-orchestration-contract.test.ts');

    expect(existsSync(packageFile('src/content/docs/os/tools/subagents.mdx'))).toBe(false);
    const redirects = read('src/lib/legacy-redirects.mjs');
    expect(redirects).toContain("'/os/tools/subagents': '/tools/subagents/'");
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
    expect(artifacts).toContain('Sites');
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
      ['tools/office.mdx', "'/tools/office': '/build/tools/artifacts/'"],
      ['tools/media/getting-started.mdx', "'/tools/media/getting-started': '/build/tools/media/'"],
      ['developers/agent/tool-system.mdx', "'/developers/agent/tool-system': '/build/tools/how-tools-work/'"],
    ] as const;

    for (const [sourcePath, redirect] of replacements) {
      expect(existsSync(packageFile(`src/content/docs/${sourcePath}`))).toBe(false);
      expect(redirects).toContain(redirect);
    }

    expect(redirects).not.toMatch(/:\s*'\/build\/tools\/office\/'/);
    for (const legacyCalendarPath of [
      '/user-guide/calendar-emails/how-tos/can-i-book-meetings-from-consuelo',
      '/user-guide/calendar-emails/how-tos/can-i-send-emails-from-consuelo',
      '/user-guide/calendar-emails/how-tos/can-i-track-email-activity-on-all-objects',
      '/user-guide/calendar-emails/how-tos/connect-several-mailboxes-per-user',
      '/user-guide/calendar-emails/how-tos/i-dont-see-emails-on-records',
    ]) {
      const start = redirects.indexOf(`'${legacyCalendarPath}':`);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(redirects.slice(start, start + 180)).toContain("'/build/tools/artifacts/'");
    }
  });
});
