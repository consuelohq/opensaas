import { describe, expect, it } from 'vitest';
import { summarizeSkillDocument } from '../scripts/lib/trace-site-inspector/skill-reading';
import { renderInspectorReading } from '../scripts/lib/trace-site-inspector/reading-view';

const skillText = `---
name: task-workflow
description: Make isolated, verified repository changes.
---
# Task Workflow

Create a scoped task branch, write tests, and verify before publishing.

## When to use
- Changes to repository code
- Release work requiring review

## Workflow
1. Inspect the current implementation
2. Write a failing test
3. Verify and publish

## Notes
- Never overwrite other agents' work.
`;

describe('Readable skill call inspector', () => {
  const row = {
    name: 'fs.read',
    rawResolvedInputJson: JSON.stringify({path: 'packages/os/skills/task/SKILL.md'}),
    rawResultJson: JSON.stringify({ok: true, code: 'OK', data: {path:'packages/os/skills/task/SKILL.md', content:skillText}}),
  };

  it('extracts useful purpose and steps from a skill markdown source', () => {
    const result = summarizeSkillDocument(row, {path:'packages/os/skills/task/SKILL.md', content:skillText});
    expect(result?.name).toBe('Task Workflow');
    expect(result?.description).toContain('isolated, verified repository changes');
    expect(result?.highlights).toContain('Inspect the current implementation');
    expect(result?.highlights?.length).toBeLessThanOrEqual(5);
  });

  it('recognizes a skill read with an MCP text content array, without dumping JSON', () => {
    const result = summarizeSkillDocument(
      {name:'skills.read', inputObj:{uri:'skills://plugins/fixtures/task/SKILL.md'}},
      [{type:'text', text:skillText}],
    );
    expect(result?.name).toBe('Task Workflow');
  });

  it('renders a concise readable overview first with expandable full source', () => {
    const html = renderInspectorReading(row);
    expect(html).toContain('data-ti-skill-overview');
    expect(html).toContain('Task Workflow');
    expect(html).toContain('Write a failing test');
    expect(html).toContain('Full SKILL.md');
    expect(html).toContain('data-ti-disclosure="full-skill-instructions"');
    expect(html).not.toContain('<script');
  });

  it('does not interpret arbitrary JSON or non-skill reads as a skill document', () => {
    expect(summarizeSkillDocument({name:'fs.read', inputObj:{path:'workpad.md'}}, {content:skillText})).toBeNull();
    expect(summarizeSkillDocument({name:'fs.read', inputObj:{path:'SKILL.md'}}, {ok:true, data:{status:'done'}})).toBeNull();
  });
});