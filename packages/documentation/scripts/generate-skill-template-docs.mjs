import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const skillsRoot = path.join(repoRoot, 'packages', 'os', 'skills');
const docsRoot = path.join(packageRoot, 'src', 'content', 'docs', 'build', 'skills', 'bundled');
const registryPath = path.join(skillsRoot, 'skills.json');

function yamlString(value) {
  return JSON.stringify(String(value));
}

function escapeMdxText(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function skillFence(source) {
  const runs = [...source.matchAll(/`+/g)].map((match) => match[0].length);
  return '`'.repeat(Math.max(4, (runs.length ? Math.max(...runs) : 0) + 1));
}

export function renderSkillTemplatePage(skill, source) {
  const fence = skillFence(source);
  const exactSource = source.replace(/\n$/, '');
  return `---
title: ${yamlString(skill.title)}
description: ${yamlString(skill.description)}
status: preview
verifiedAt: 2026-08-11
evidence:
  - source: packages/os/skills/${skill.name}/skill.json
    tests:
      - packages/os/tests/skills-registry.test.ts
    runtime: Bundled metadata and registry inclusion for \`${skill.name}\` were verified on 2026-08-11.
  - source: packages/os/skills/${skill.name}/SKILL.md
    tests:
      - packages/os/tests/skills-registry.test.ts
    runtime: The exact current skill instructions are displayed below from the bundled source.
---

## Enable it

\`\`\`bash
consuelo add skill ${skill.name}
\`\`\`

Remove it with:

\`\`\`bash
consuelo remove skill ${skill.name}
\`\`\`

## Description

${escapeMdxText(skill.description)}

## SKILL.md

{/* skill-source:start */}
${fence}markdown
${exactSource}
${fence}
{/* skill-source:end */}
`;
}

function renderIndex(skills) {
  const rows = skills.map((skill) => `| [${skill.title}](/build/skills/bundled/${skill.name}/) | ${escapeMdxText(skill.description).replaceAll('|', '\\|')} | \`consuelo add skill ${skill.name}\` |`).join('\n');
  return `---
title: Skill Templates
description: Review the exact bundled Consuelo skill templates and enable the ones you want to use.
status: preview
verifiedAt: 2026-08-11
evidence:
  - source: packages/os/skills/skills.json
    tests:
      - packages/os/tests/skills-registry.test.ts
    runtime: The template list is generated from the current bundled skill registry.
---

Review the exact bundled skill instructions before enabling them.

| Skill | Description | Enable |
| --- | --- | --- |
${rows}
`;
}

export function generateSkillTemplateDocs() {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  fs.mkdirSync(docsRoot, { recursive: true });
  const expected = new Set(['index.mdx']);
  fs.writeFileSync(path.join(docsRoot, 'index.mdx'), renderIndex(registry.skills));
  for (const skill of registry.skills) {
    const source = fs.readFileSync(path.join(skillsRoot, skill.name, 'SKILL.md'), 'utf8');
    const fileName = `${skill.name}.mdx`;
    expected.add(fileName);
    fs.writeFileSync(path.join(docsRoot, fileName), renderSkillTemplatePage(skill, source));
  }
  for (const entry of fs.readdirSync(docsRoot, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.mdx') && !expected.has(entry.name)) {
      fs.unlinkSync(path.join(docsRoot, entry.name));
    }
  }
  return { count: registry.skills.length, docsRoot };
}

if (import.meta.main) {
  const result = generateSkillTemplateDocs();
  process.stdout.write(`generated ${result.count} skill template pages in ${path.relative(repoRoot, result.docsRoot)}\n`);
}
