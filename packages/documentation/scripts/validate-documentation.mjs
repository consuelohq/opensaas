import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const selectedSlugs = [
  'start/index',
  'start/install-consuelo-os',
  'start/create-a-workspace',
  'start/connect-your-first-agent',
  'start/local-and-consuelo-cloud',
  'start/core-concepts',
  'connect/index',
  'connect/agents/chatgpt',
  'connect/agents/codex',
  'connect/agents/claude-code',
  'connect/agents/cursor',
  'connect/agents/opencode',
  'connect/agents/gemini',
  'connect/agents/other-agents',
  'connect/connectors/index',
  'connect/connectors/github',
  'connect/connectors/google-drive',
  'connect/connectors/gmail',
  'connect/connectors/google-calendar',
  'connect/connectors/slack',
  'connect/connectors/additional-connectors',
  'connect/nodes/how-nodes-work',
  'connect/nodes/home-node',
  'connect/nodes/local-nodes',
  'connect/nodes/cloud-nodes',
  'build/index',
  'build/tools/how-tools-work',
  'build/tools/workspace',
  'build/tools/browser',
  'build/tools/office',
  'build/tools/media',
  'build/skills/how-skills-work',
  'build/skills/install-a-skill',
  'build/skills/create-a-skill',
  'build/skills/skill-structure',
  'build/steering/how-steering-works',
  'build/steering/workspace-steering',
  'build/steering/project-steering',
  'build/workflows',
  'build/shared-memory-and-context',
  'build/files-and-artifacts',
  'build/approvals',
  'sites/index',
  'sites/create-a-site',
  'sites/pages-and-content',
  'sites/preview-locally',
  'sites/publish',
  'sites/domains',
  'sites/troubleshooting',
  'observe/index',
  'observe/runs',
  'observe/traces',
  'observe/tool-calls',
  'observe/artifacts',
  'observe/logs',
  'observe/debugging-failures',
  'secure/index',
  'secure/security-model',
  'secure/access-and-permissions',
  'secure/credentials',
  'secure/approvals',
  'secure/nodes-and-network-access',
  'secure/tailscale',
  'secure/hosted-mcp-ingress',
  'secure/security-reference',
  'reference/index',
  'reference/cli',
  'reference/configuration',
  'reference/mcp',
  'reference/tools',
  'reference/skills-and-manifests',
  'reference/result-and-error-formats',
  'reference/environment-variables',
  'reference/urls-and-ports',
  'reference/glossary',
  'user-guide/user-stories-use-cases',
  'user-guide/getting-started/capabilities/implementation-services',
  'user-guide/getting-started/capabilities/glossary',
  'user-guide/getting-started/capabilities/keyboard-shortcuts',
  'user-guide/getting-started/how-tos/navigate-around-consuelo',
  'user-guide/getting-started/how-tos/configure-your-workspace',
  'os/concepts/data-model-and-graphql',
  'os/tools/subagents',
  'developers/introduction',
  'developers/agent/overview',
  'developers/agent/crm-tools',
  'developers/api/overview',
  'developers/api/auth',
  'developers/api/graphql',
  'developers/api/contacts',
  'developers/api/voice',
];

const removedSlugs = [
  'os/overview',
  'os/how-it-works',
  'os/getting-started/install',
  'os/getting-started/connect-agents',
  'os/getting-started/workspace-launcher',
  'os/concepts/local-and-cloud',
  'user-guide/introduction',
  'user-guide/getting-started/capabilities/what-is-consuelo',
  'user-guide/getting-started/how-tos/create-workspace',
  'os/agent-context/steering',
  'os/agent-context/decision',
  'os/agent-context/tools',
  'os/agent-context/scripts',
  'os/tools/default-steering',
  'os/tools/decision-engine',
  'os/tools/tool-manifest',
  'os/tools/scripts',
  'developers/agent/integrations',
  'os/concepts/integrations-and-capabilities',
  'os/concepts/portal',
  'os/concepts/skills',
  'os/concepts/scripts',
  'os/concepts/context-and-memory',
  'os/concepts/files-and-artifacts',
  'os/concepts/approvals',
  'os/tools/overview',
  'os/tools/browser-tools',
  'tools/overview',
  'tools/office',
  'tools/media/getting-started',
  'developers/agent/tool-system',
  'tools/sites/overview',
  'os/concepts/observability',
  'os/concepts/mcp-ingress-security',
  'os/concepts/configuration',
  'os/glossary',
];

const adapterNames = [
  'Note',
  'Warning',
  'CardGroup',
  'Card',
  'CardTitle',
  'VimeoEmbed',
  'AgentContext',
];
const translationInvariantFiles = [
  'src/components/translation/RuntimeLanguageSelect.astro',
  'src/lib/translation/cache.ts',
  'src/lib/translation/languages.ts',
  'src/lib/translation/provider.ts',
  'src/lib/translation/source.ts',
  'src/pages/api/docs/translate.ts',
  'scripts/test-translation.mjs',
  'src/lib/legacy-redirects.mjs',
];
const failures = [];
const read = (path) => readFileSync(path, 'utf8');
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const packageJson = JSON.parse(read('package.json'));
assert(
  packageJson.name === 'packages-documentation',
  'package name must remain packages-documentation',
);
assert(Boolean(packageJson.scripts?.build), 'package must expose build script');
assert(
  typeof packageJson.packageManager === 'string' &&
    packageJson.packageManager.startsWith('bun@'),
  'package must declare Bun packageManager',
);
assert(
  Boolean(packageJson.scripts?.validate),
  'package must expose validate script',
);
assert(
  Boolean(packageJson.scripts?.['test:translation']),
  'package must expose test:translation script',
);
for (const script of ['test:foundation', 'test:start', 'test:connect', 'test:connect-browser', 'test:build', 'test:build-browser', 'test:sites', 'test:sites-browser', 'test:observe', 'test:observe-browser', 'test:secure', 'test:secure-browser', 'test:reference', 'test:reference-browser', 'test:review-cleanup', 'test:browser', 'test:boundary']) {
  assert(Boolean(packageJson.scripts?.[script]), `package must expose ${script} script`);
}
assert(existsSync('bun.lock'), 'bun.lock must exist');

const rootPackageJson = JSON.parse(read('../../package.json'));
const workspaces = Array.isArray(rootPackageJson.workspaces)
  ? rootPackageJson.workspaces
  : (rootPackageJson.workspaces?.packages ?? []);
assert(
  Array.isArray(workspaces),
  'root workspaces must be an array or an object with packages',
);
assert(
  !workspaces.includes('packages/documentation'),
  'packages/documentation must stay outside root Yarn workspaces',
);
assert(
  !workspaces.includes('packages/consuelo-docs'),
  'legacy Mintlify package must not remain in root Yarn workspaces',
);
assert(
  !existsSync('../consuelo-docs'),
  'legacy Mintlify package directory must be absent',
);
assert(
  rootPackageJson.scripts?.['docs:build'] ===
    'bun run --cwd packages/documentation build',
  'root docs:build must target packages/documentation',
);
assert(
  rootPackageJson.scripts?.['docs:validate'] ===
    'bun run --cwd packages/documentation validate',
  'root docs:validate must target packages/documentation',
);

const docsRoot = 'src/content/docs';
assert(
  existsSync(join(docsRoot, 'index.mdx')),
  'documentation index.mdx must exist',
);
for (const slug of selectedSlugs) {
  assert(
    existsSync(join(docsRoot, `${slug}.mdx`)),
    `missing curated docs page ${slug}.mdx`,
  );
}
for (const slug of removedSlugs) {
  assert(
    !existsSync(join(docsRoot, `${slug}.mdx`)),
    `removed generated route came back: ${slug}`,
  );
}

for (const name of adapterNames) {
  assert(
    existsSync(`src/components/mintlify/${name}.astro`),
    `missing Mintlify adapter ${name}.astro`,
  );
}
for (const file of translationInvariantFiles) {
  assert(existsSync(file), `missing runtime translation file ${file}`);
}

const config = read('astro.config.mjs');
assert(
  config.includes("title: 'Consuelo Docs'"),
  'Starlight title must be Consuelo Docs',
);
assert(
  config.includes('RuntimeLanguageSelect.astro'),
  'Starlight LanguageSelect must use runtime translation selector',
);
const navigation = read('src/lib/docs-navigation.ts');
for (const required of [
  'Start',
  'Connect',
  'Build with OS',
  'Sites',
  'Observe',
  'Secure',
  'Reference',
]) {
  assert(navigation.includes(`label: '${required}'`), `navigation missing ${required}`);
}
for (const required of [
  'docsSidebar',
  'customCss',
  'PageTitle',
  'Sidebar',
]) {
  assert(config.includes(required), `Starlight config missing ${required}`);
}
assert(
  !config.includes('Example Guide'),
  'starter sidebar content must be removed',
);

const index = read('src/content/docs/index.mdx');
assert(index.includes('Consuelo'), 'index page must be Consuelo-branded');
assert(
  !index.includes('Welcome to Starlight'),
  'starter index title must be removed',
);
assert(
  !existsSync('src/content/docs/guides/example.md'),
  'starter guide must be removed',
);
assert(
  !existsSync('src/content/docs/reference/example.md'),
  'starter reference must be removed',
);
for (const file of [
  'AUTHORING.md',
  'src/components/PageTitle.astro',
  'src/components/Sidebar.astro',
  'src/lib/docs-navigation.ts',
  'src/lib/markdown-pages.ts',
  'src/pages/[...slug].md.ts',
  'src/styles/docs.css',
]) {
  assert(existsSync(file), `missing documentation foundation file ${file}`);
}
const pageTitle = read('src/components/PageTitle.astro');
for (const action of ['Copy page', 'View as Markdown', 'Open in ChatGPT', 'Open in Claude']) {
  assert(pageTitle.includes(action), `page actions missing ${action}`);
}
assert(!pageTitle.includes('Ask AI'), 'Ask AI action must not be added');
const docsCss = read('src/styles/docs.css');
assert(docsCss.includes('--sl-content-width: 44rem'), 'docs reading lane must remain 44rem');
assert(docsCss.includes('max-width: 65ch'), 'docs prose measure must remain 65ch');
const authoring = read('AUTHORING.md');
for (const status of ['shipped', 'preview', 'planned', 'unresolved', 'deprecated']) {
  assert(authoring.includes(status), `authoring contract missing ${status} status`);
}

const readme = read('README.md');
for (const phrase of [
  'Source of truth',
  'Bun-owned',
  'Legacy-route compatibility',
  'Adding or moving pages',
  'Runtime translation',
]) {
  assert(readme.includes(phrase), `README missing guidance phrase: ${phrase}`);
}

const illegalLocaleDirs = [
  'src/content/docs/es',
  'src/content/docs/fr',
  'src/content/docs/pt',
  'src/content/docs/de',
  'src/content/docs/ja',
  'src/content/docs/ko',
  'src/content/docs/ar',
  'src/content/docs/zh',
];
for (const dir of illegalLocaleDirs) {
  assert(!existsSync(dir), `committed locale docs tree is not allowed: ${dir}`);
}

const allFiles = [];
function collect(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collect(path);
    else allFiles.push(path);
  }
}
collect(docsRoot);
for (const path of allFiles) {
  const text = read(path);
  assert(
    !text.includes("from '/snippets/"),
    `${path} still imports legacy Mintlify snippets`,
  );
  assert(
    !text.includes('Welcome to Starlight'),
    `${path} still contains starter text`,
  );
}

const slugs = new Set();
for (const path of allFiles) {
  const sourceSlug = path.slice(docsRoot.length + 1).replace(/\.(md|mdx)$/, '');
  const slug = sourceSlug === 'index' ? '' : sourceSlug.replace(/\/index$/, '');
  slugs.add(slug);
}

const routeExists = (ref) => {
  const clean = ref
    .split('#')[0]
    .split('?')[0]
    .replace(/^\//, '')
    .replace(/\/$/, '');
  return clean === '' || slugs.has(clean);
};

assert(
  existsSync('project.json'),
  'documentation package must declare Nx project ownership',
);

if (existsSync('src/lib/legacy-redirects.mjs')) {
  const redirectText = read('src/lib/legacy-redirects.mjs');
  assert(
    redirectText.includes('legacyRedirects'),
    'legacy redirects module must export legacyRedirects',
  );
  const redirectLines = redirectText
    .split('\n')
    .filter((line) => line.includes(": '"));
  assert(
    redirectLines.length > 0,
    'legacy redirects must preserve old public docs routes',
  );
  for (const line of redirectLines) {
    const parts = line.trim().split(": '");
    if (parts.length < 2) continue;
    const from = parts[0].slice(1);
    const to = parts[1].split("'")[0];
    assert(
      from.startsWith('/'),
      `legacy redirect source must start with /: ${from}`,
    );
    assert(
      routeExists(to),
      `legacy redirect destination must exist: ${from} -> ${to}`,
    );
  }
}

for (const path of allFiles) {
  const text = read(path);
  const refs = [];
  for (const match of text.matchAll(/href=["\']([^"\']+)["\']/g))
    refs.push(match[1]);
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g))
    refs.push(match[1]);
  for (const ref of refs) {
    if (!ref.startsWith('/') || ref.startsWith('/images/')) continue;
    assert(routeExists(ref), `${path} links to missing internal route ${ref}`);
  }
}
if (existsSync('src/components/translation/RuntimeLanguageSelect.astro')) {
  const translationClient = read(
    'src/components/translation/RuntimeLanguageSelect.astro',
  );
  assert(
    translationClient.includes('/api/docs/translate'),
    'translation selector must call the docs translation API',
  );
  assert(
    !translationClient.includes('GOOGLE_TRANSLATE_API_KEY'),
    'translation selector must not reference provider credentials',
  );
}
if (existsSync('src/pages/api/docs/translate.ts')) {
  const translationEndpoint = read('src/pages/api/docs/translate.ts');
  assert(
    translationEndpoint.includes('prerender = false'),
    'translation API route must be runtime only',
  );
}
if (existsSync('src/lib/translation/cache.ts')) {
  const translationCache = read('src/lib/translation/cache.ts');
  assert(
    translationCache.includes('contentHash') &&
      translationCache.includes('targetLanguage') &&
      translationCache.includes('route'),
    'translation cache must include route, source content hash, and target language',
  );
}
if (existsSync('src/lib/translation/provider.ts')) {
  const provider = read('src/lib/translation/provider.ts');
  assert(
    provider.includes('GOOGLE_TRANSLATE_API_KEY'),
    'translation provider must read Google credentials server-side',
  );
  assert(
    provider.includes('translation.googleapis.com'),
    'translation provider must target Google Cloud Translation API',
  );
}

if (failures.length) {
  process.stderr.write(`${JSON.stringify({ ok: false, failures }, null, 2)}\n`);
  process.exit(1);
}

process.stdout.write(
  `${JSON.stringify({ ok: true, selectedPages: selectedSlugs.length, adapters: adapterNames }, null, 2)}\n`,
);
