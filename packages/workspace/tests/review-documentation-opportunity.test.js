import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const { findDocumentationOpportunities } = require('../scripts/lib/review-documentation.js');

describe('review documentation opportunities', () => {
  test('maps bundled skill changes to the matching bundled-skill documentation page', () => {
    const opportunities = findDocumentationOpportunities([
      'packages/os/skills/branch/SKILL.md',
      'packages/os/skills/branch/skill.json',
    ]);

    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]).toMatchObject({
      rule: 'DOCS_OPPORTUNITY',
      surface: 'skill:branch',
      docs: ['packages/documentation/src/content/docs/build/skills/bundled/branch.mdx'],
      blocking: false,
    });
    expect(opportunities[0].suggestedAction).toContain('documentation-writer');
  });

  test('suppresses an opportunity when one of its mapped docs targets changes in the same task', () => {
    expect(findDocumentationOpportunities([
      'packages/os/skills/branch/SKILL.md',
      'packages/documentation/src/content/docs/build/skills/bundled/branch.mdx',
    ])).toEqual([]);
  });

  test('maps public CLI, MCP, tool-manifest, and configuration surfaces to exact docs', () => {
    const opportunities = findDocumentationOpportunities([
      'packages/os/scripts/lifecycle.ts',
      'packages/os/scripts/server/routes/mcp.ts',
      'packages/os/manifests/schemas/tool-manifest.schema.json',
      'packages/workspace/tooling/workflows.json',
      'packages/os/scripts/lib/settings-control-plane.ts',
    ]);

    expect(opportunities.map((item) => item.surface)).toEqual([
      'cli',
      'configuration',
      'mcp',
      'tools',
      'workflows',
    ]);
    expect(opportunities.flatMap((item) => item.docs)).toEqual(expect.arrayContaining([
      'packages/documentation/src/content/docs/reference/cli.mdx',
      'packages/documentation/src/content/docs/reference/configuration.mdx',
      'packages/documentation/src/content/docs/reference/mcp.mdx',
      'packages/documentation/src/content/docs/reference/tools.mdx',
      'packages/documentation/src/content/docs/build/workflows.mdx',
    ]));
  });

  test('maps active packages/os/tools implementation changes to the tools documentation surface', () => {
    const opportunities = findDocumentationOpportunities([
      'packages/os/tools/memory/manifest.ts',
      'packages/os/tools/memory/schema.ts',
    ]);

    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]).toMatchObject({
      surface: 'tools',
      docs: ['packages/documentation/src/content/docs/reference/tools.mdx'],
    });
  });

  test('review --all marks documentation opportunity detection as skipped instead of executed', () => {
    const source = readFileSync(resolve(import.meta.dirname, '../scripts/review.js'), 'utf8');
    expect(source).toContain('const documentationCheckRan = !args.all');
    expect(source).toContain("if (documentationCheckRan) checksRun.push('documentation_opportunities')");
    expect(source).toContain('...(documentationCheckRan ? { documentationOpportunities } : {})');
  });

  test('does not create documentation noise for unrelated internal implementation changes', () => {
    expect(findDocumentationOpportunities([
      'packages/os/scripts/lib/node-resource-lock.ts',
      'packages/workspace/scripts/lib/review-run-state.js',
    ])).toEqual([]);
  });
});
