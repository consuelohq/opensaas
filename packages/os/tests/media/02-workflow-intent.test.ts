import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { expectedMediaToolNames, expectArrayContainsAll, readJson, readPackageJson } from './helpers';

type Workflow = {
  id: string;
  aliases?: string[];
  roles?: string[];
  subscriptions?: Array<Record<string, unknown>>;
  tools?: Array<{ name: string; definition?: { category?: string; workflowRole?: string } }>;
};

type WorkflowFile = { workflows: Workflow[] };

describe('media workflow intent and runbook routing', () => {
  it('should satisfy media contract when it declares media as a first-class OS workflow with video/youtube/sports aliases', () => {
    const workflowFile = readJson<WorkflowFile>('tooling/workflows.json');
    const media = workflowFile.workflows.find((workflow) => workflow.id === 'media');

    expect(media, 'tooling/workflows.json should declare media workflow').toBeDefined();
    expect(media?.aliases).toEqual(expect.arrayContaining(['video', 'clips', 'youtube', 'sports-media']));
    expect(media?.roles).toEqual(expect.arrayContaining(['media.probe', 'media.compose', 'media.qa', 'media.workflow.runbook']));
    expect(media?.subscriptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: 'workflow.intent.media.detected', workflow: 'media' }),
    ]));
  });

  it('should satisfy media contract when it generates media workflow bundles with media tools only, not office-owned tools', () => {
    const bundles = readJson<WorkflowFile>('manifests/workflow-bundles.json');
    const media = bundles.workflows.find((workflow) => workflow.id === 'media');
    const toolNames = media?.tools?.map((tool) => tool.name).sort() ?? [];

    expect(media, 'generated workflow bundles should include media').toBeDefined();
    expectArrayContainsAll(toolNames, expectedMediaToolNames);
    expect(toolNames).not.toContain('office.generateWebsite');
    expect(toolNames).not.toContain('design.publish');
    for (const tool of media?.tools ?? []) {
      expect(tool.definition?.category).toBe('media');
      expect(tool.definition?.workflowRole).toMatch(/^media\./);
    }
  });

  it('should satisfy media contract when it accepts media and aliases in the OS workflow intent schema', () => {
    const result = spawnSync('bun', ['./scripts/task-intent.js', 'start', '--workflow', 'media', '--json'], {
      cwd: readPackageRoot(),
      encoding: 'utf8',
      timeout: 10_000,
    });

    expect(result.status, result.stderr).toBe(0);
    const json = JSON.parse(result.stdout) as { workflow?: string; requestedWorkflow?: string; manifestBundle?: { aliases?: string[] } };
    expect(json.workflow).toBe('media');
    expect(json.manifestBundle?.aliases).toEqual(expect.arrayContaining(['video', 'clips', 'youtube', 'sports-media']));
  });

  it('should satisfy media contract when it keeps the media runbook in OS and models the deterministic recipe order', () => {
    const runbook = readJson<{ id: string; steps: string[]; ownedBy: string }>('runbooks/media.json');

    expect(runbook).toMatchObject({ id: 'media', ownedBy: 'os' });
    expect(runbook.steps).toEqual([
      'doctor',
      'probe',
      'ingest',
      'timeline.validate',
      'compose',
      'qa',
      'export',
      'artifact.handoff',
    ]);
  });
});

function readPackageRoot(): string {
  const pkg = readPackageJson();
  expect(pkg.name).toBe('@consuelo/os');
  return fileURLToPath(new URL('../..', import.meta.url));
}
