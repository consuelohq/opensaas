const path = require('node:path');

const DOCS_ROOT = 'packages/documentation/src/content/docs';

const STATIC_SURFACES = [
  {
    surface: 'cli',
    matches: (file) =>
      file === 'packages/os/scripts/lifecycle.ts' ||
      file === 'packages/cli/src/index.ts' ||
      file.startsWith('packages/cli/src/commands/'),
    docs: [`${DOCS_ROOT}/reference/cli.mdx`],
    reason: 'Public Consuelo CLI behavior or command discovery changed.',
  },
  {
    surface: 'configuration',
    matches: (file) =>
      /^packages\/os\/scripts\/lib\/(?:settings-control-plane|environment-control-plane|manifest-overlay|consuelo-home)\.(?:ts|js)$/.test(file),
    docs: [`${DOCS_ROOT}/reference/configuration.mdx`],
    reason: 'Public configuration, settings, or environment behavior changed.',
  },
  {
    surface: 'mcp',
    matches: (file) =>
      file === 'packages/os/scripts/server/routes/mcp.ts' ||
      /^packages\/os\/scripts\/lib\/mcp-[^/]+\.(?:ts|js)$/.test(file) ||
      file.includes('/mcp-proxy.'),
    docs: [`${DOCS_ROOT}/reference/mcp.mdx`],
    reason: 'The public MCP transport or gateway contract changed.',
  },
  {
    surface: 'tools',
    matches: (file) =>
      file.startsWith('packages/os/tools/') ||
      file.startsWith('packages/os/tooling/') ||
      file === 'packages/os/manifests/manifest.config.ts' ||
      file.startsWith('packages/os/manifests/schemas/') ||
      /^packages\/os\/manifests\/generated\/(?:tool|core)\.manifest\.json$/.test(file) ||
      (file.startsWith('packages/workspace/tooling/') && !file.endsWith('/workflows.json')),
    docs: [`${DOCS_ROOT}/reference/tools.mdx`],
    reason: 'The discoverable tool contract changed.',
  },
  {
    surface: 'workflows',
    matches: (file) =>
      file === 'packages/workspace/tooling/workflows.json' ||
      /^packages\/os\/hooks\/[^/]+\/workflow\.js$/.test(file),
    docs: [`${DOCS_ROOT}/build/workflows.mdx`],
    reason: 'The registered workflow bundle or lifecycle hook contract changed.',
  },
  {
    surface: 'skill-lifecycle',
    matches: (file) =>
      /packages\/os\/scripts\/(?:generate-skills-registry\.ts|lib\/(?:skill-selection|managed-component-install|steering-skills|onboarding-skills)\.ts)$/.test(file) ||
      file === 'packages/os/skills/skills.json',
    docs: [
      `${DOCS_ROOT}/build/skills/how-skills-work.mdx`,
      `${DOCS_ROOT}/build/skills/install-a-skill.mdx`,
      `${DOCS_ROOT}/reference/skills-and-manifests.mdx`,
    ],
    reason: 'Skill discovery, selection, installation, or steering behavior changed.',
  },
  {
    surface: 'installation',
    matches: (file) =>
      file === 'packages/os/scripts/lib/install-state.ts' ||
      file.startsWith('packages/os/scripts/lib/lifecycle/'),
    docs: [
      `${DOCS_ROOT}/start/install-consuelo-os.mdx`,
      `${DOCS_ROOT}/reference/configuration.mdx`,
    ],
    reason: 'Installation or lifecycle behavior changed.',
  },
  {
    surface: 'security',
    matches: (file) =>
      file === 'packages/os/scripts/lib/security-gateway.ts' ||
      file === 'packages/os/scripts/server/middleware/auth.ts' ||
      file === 'packages/os/scripts/server/services/oauth-introspection.ts',
    docs: [
      `${DOCS_ROOT}/secure/security-model.mdx`,
      `${DOCS_ROOT}/secure/hosted-mcp-ingress.mdx`,
    ],
    reason: 'A user-visible security, authentication, or ingress boundary changed.',
  },
  {
    surface: 'traces',
    matches: (file) =>
      /packages\/os\/scripts\/(?:server\/routes\/traces|lib\/trace[^/]*)\.(?:ts|js)$/.test(file),
    docs: [`${DOCS_ROOT}/observe/traces.mdx`],
    reason: 'Trace collection, persistence, or inspection behavior changed.',
  },
  {
    surface: 'artifacts',
    matches: (file) =>
      /packages\/os\/scripts\/lib\/(?:artifacts|cloud-artifacts)\.(?:ts|js)$/.test(file),
    docs: [
      `${DOCS_ROOT}/build/files-and-artifacts.mdx`,
      `${DOCS_ROOT}/observe/artifacts.mdx`,
    ],
    reason: 'Artifact creation, persistence, publishing, or inspection behavior changed.',
  },
];

function normalize(file) {
  return String(file || '')
    .split(path.sep)
    .join('/')
    .replace(/^\.\//, '');
}

function opportunity({ surface, sourceFiles, docs, reason }) {
  return {
    rule: 'DOCS_OPPORTUNITY',
    surface,
    sourceFiles: [...new Set(sourceFiles)].sort(),
    docs: [...new Set(docs)].sort(),
    blocking: false,
    reason,
    suggestedAction: `Invoke the documentation-writer workflow, but follow packages/documentation/README.md and AUTHORING.md as repository truth (Astro/Starlight), then update the mapped public docs if the changed behavior is user-visible: ${[...new Set(docs)].sort().join(', ')}`,
  };
}

function docsChanged(changed, docs) {
  return docs.some((doc) => changed.has(doc));
}

function findDocumentationOpportunities(changedFiles) {
  const normalized = [...new Set((changedFiles || []).map(normalize).filter(Boolean))].sort();
  const changed = new Set(normalized);
  const opportunities = [];

  const skills = new Map();
  for (const file of normalized) {
    const match = file.match(/^packages\/os\/skills\/([^/]+)\//);
    if (!match) continue;
    const name = match[1];
    if (!skills.has(name)) skills.set(name, []);
    skills.get(name).push(file);
  }
  for (const [name, sourceFiles] of [...skills.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const docs = [`${DOCS_ROOT}/build/skills/bundled/${name}.mdx`];
    if (docsChanged(changed, docs)) continue;
    opportunities.push(opportunity({
      surface: `skill:${name}`,
      sourceFiles,
      docs,
      reason: `Bundled skill '${name}' changed without its public skill page changing.`,
    }));
  }

  for (const rule of STATIC_SURFACES) {
    const sourceFiles = normalized.filter(rule.matches);
    if (sourceFiles.length === 0 || docsChanged(changed, rule.docs)) continue;
    opportunities.push(opportunity({
      surface: rule.surface,
      sourceFiles,
      docs: rule.docs,
      reason: rule.reason,
    }));
  }

  return opportunities.sort((left, right) => left.surface.localeCompare(right.surface));
}

module.exports = {
  findDocumentationOpportunities,
};
