import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const selectedSlugs = [
  'user-guide/user-stories-use-cases',
  'user-guide/introduction',
  'user-guide/getting-started/capabilities/what-is-consuelo',
  'user-guide/getting-started/capabilities/implementation-services',
  'user-guide/getting-started/capabilities/glossary',
  'user-guide/getting-started/capabilities/keyboard-shortcuts',
  'user-guide/getting-started/how-tos/create-workspace',
  'user-guide/getting-started/how-tos/navigate-around-consuelo',
  'user-guide/getting-started/how-tos/configure-your-workspace',
  'os/overview',
  'os/how-it-works',
  'os/glossary',
  'os/concepts/portal',
  'os/concepts/skills',
  'os/concepts/scripts',
  'os/concepts/files-and-artifacts',
  'os/concepts/approvals',
  'os/concepts/data-model-and-graphql',
  'os/concepts/context-and-memory',
  'os/concepts/integrations-and-capabilities',
  'os/concepts/observability',
  'os/concepts/local-and-cloud',
  'tools/overview',
  'tools/sites/overview',
  'tools/office',
  'tools/media/getting-started',
  'os/tools/browser-tools',
  'os/tools/overview',
  'developers/introduction',
  'developers/agent/overview',
  'developers/agent/tool-system',
  'developers/agent/crm-tools',
  'developers/agent/integrations',
  'developers/api/overview',
  'developers/api/auth',
  'developers/api/graphql',
  'developers/api/contacts',
  'developers/api/voice',
];

const removedSlugs = [
  'os/agent-context/steering',
  'os/agent-context/decision',
  'os/agent-context/tools',
  'os/agent-context/scripts',
  'os/tools/default-steering',
  'os/tools/decision-engine',
  'os/tools/tool-manifest',
  'os/tools/scripts',
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
for (const required of [
  'user-guide/user-stories-use-cases',
  'tools/sites/overview',
  'tools/office',
  'os/overview',
  'developers/introduction',
]) {
  assert(config.includes(required), `sidebar missing ${required}`);
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
  const slug = path.slice(docsRoot.length + 1).replace(/\.(md|mdx)$/, '');
  slugs.add(slug === 'index' ? '' : slug);
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
