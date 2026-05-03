#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_FILE = fileURLToPath(import.meta.url);
const PACKAGE_ROOT = resolve(dirname(CURRENT_FILE), '..');
const REPO_ROOT = resolve(PACKAGE_ROOT, '../..');

const DESIGN_SYSTEM_FILES = [
  { role: 'visual-design', path: 'packages/consuelo-website/DESIGN.md' },
  { role: 'motion-design', path: 'packages/consuelo-website/animations.md' },
  { role: 'website-agent-rules', path: 'packages/consuelo-website/AGENTS.md' },
  { role: 'design-tooling-agent-rules', path: 'packages/consuelo-design/AGENTS.md' },
];

const WORKFLOWS = [
  { name: 'website', description: 'Website design and implementation work grounded in Consuelo DESIGN.md and GSAP animation rules.' },
  { name: 'demo', description: 'Demo artifact planning and design prompts for product walkthroughs and prototypes.' },
  { name: 'image', description: 'Image-generation briefs using Consuelo typography, color, spacing, and art-direction rules.' },
  { name: 'digital-eguide', description: 'Long-form digital e-guide structure, visual language, and production prompts.' },
  { name: 'email', description: 'Email design and content artifacts grounded in Consuelo design rules.' },
  { name: 'motion-frame', description: 'Motion frame briefs for GSAP, HyperFrames, and future video workflows.' },
];

const DEPLOYMENT_DOCKERFILES = [
  'Dockerfile',
  'packages/twenty-docker/twenty/Dockerfile',
];

const DEPLOYED_PACKAGE_MANIFESTS = [
  'packages/twenty-server/package.json',
  'packages/twenty-front/package.json',
  'packages/api/package.json',
  'packages/agent/package.json',
  'packages/coaching/package.json',
  'packages/contacts/package.json',
  'packages/dialer/package.json',
  'packages/logger/package.json',
  'packages/metering/package.json',
  'packages/sdk/package.json',
];

function readText(path) {
  return readFileSync(resolve(REPO_ROOT, path), 'utf8');
}

function pathExists(path) {
  try {
    statSync(resolve(REPO_ROOT, path));
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv) {
  const flags = new Set(argv.filter((arg) => arg.startsWith('--')));
  const positionals = argv.filter((arg) => !arg.startsWith('--'));
  return { command: positionals[0] ?? 'help', flags };
}

function getDesignSystem({ json }) {
  const files = DESIGN_SYSTEM_FILES.map((file) => ({ ...file, content: readText(file.path) }));

  if (json) {
    printJson({
      name: 'consuelo-design-system',
      policy: 'Consuelo uses repo-local DESIGN.md, animations.md, and AGENTS.md files as the design system. Upstream Open Design design-system registries are not imported in this integration.',
      files,
    });
    return;
  }

  for (const file of files) {
    process.stdout.write('\n---\n');
    process.stdout.write(`# ${file.role}: ${file.path}\n\n`);
    process.stdout.write(file.content);
    if (!file.content.endsWith('\n')) {
      process.stdout.write('\n');
    }
  }
}

function listWorkflows({ json }) {
  if (json) {
    printJson({ workflows: WORKFLOWS });
    return;
  }

  for (const workflow of WORKFLOWS) {
    process.stdout.write(`${workflow.name}: ${workflow.description}\n`);
  }
}

function upstreamStatus({ json }) {
  const upstreamRoot = 'packages/consuelo-design/upstream/open-design';
  const packageJson = JSON.parse(readText(`${upstreamRoot}/package.json`));
  const details = {
    path: upstreamRoot,
    packageName: packageJson.name,
    version: packageJson.version,
    license: packageJson.license,
    packageManager: packageJson.packageManager,
    nodeEngine: packageJson.engines?.node ?? null,
    pnpmEngine: packageJson.engines?.pnpm ?? null,
    hasLicense: pathExists(`${upstreamRoot}/LICENSE`),
    hasReadme: pathExists(`${upstreamRoot}/README.md`),
    hasGitMetadata: pathExists(`${upstreamRoot}/.git`),
  };

  if (json) {
    printJson(details);
    return;
  }

  for (const [key, value] of Object.entries(details)) {
    process.stdout.write(`${key}: ${String(value)}\n`);
  }
}

function checkRailway({ json }) {
  const failures = [];

  for (const dockerfile of DEPLOYMENT_DOCKERFILES) {
    const content = readText(dockerfile);
    if (content.includes('consuelo-design')) {
      failures.push(`${dockerfile} references consuelo-design`);
    }
  }

  for (const manifestPath of DEPLOYED_PACKAGE_MANIFESTS) {
    if (!pathExists(manifestPath)) {
      continue;
    }

    const manifest = JSON.parse(readText(manifestPath));
    const dependencyGroups = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

    for (const group of dependencyGroups) {
      if (manifest[group]?.['consuelo-design'] || manifest[group]?.['@consuelo/design']) {
        failures.push(`${manifestPath} ${group} references consuelo-design`);
      }
    }
  }

  const result = {
    ok: failures.length === 0,
    checkedDockerfiles: DEPLOYMENT_DOCKERFILES,
    checkedPackageManifests: DEPLOYED_PACKAGE_MANIFESTS,
    failures,
  };

  if (json) {
    printJson(result);
  } else if (result.ok) {
    process.stdout.write('Railway exclusion check passed.\n');
  } else {
    for (const failure of failures) {
      process.stderr.write(`${failure}\n`);
    }
  }

  if (!result.ok) {
    process.exit(1);
  }
}

function check({ json }) {
  const requiredPaths = [
    'packages/consuelo-design/package.json',
    'packages/consuelo-design/AGENTS.md',
    'packages/consuelo-design/README.md',
    'packages/consuelo-design/RAILWAY.md',
    'packages/consuelo-design/UPSTREAM.md',
    'packages/consuelo-design/upstream/open-design/package.json',
    'packages/consuelo-design/upstream/open-design/LICENSE',
    ...DESIGN_SYSTEM_FILES.map((file) => file.path),
  ];

  const missingPaths = requiredPaths.filter((path) => !pathExists(path));
  const upstreamRoot = 'packages/consuelo-design/upstream/open-design';
  const result = {
    ok: missingPaths.length === 0 && !pathExists(`${upstreamRoot}/.git`),
    missingPaths,
    hasNestedGitMetadata: pathExists(`${upstreamRoot}/.git`),
    designSystemFiles: DESIGN_SYSTEM_FILES,
    workflows: WORKFLOWS.map((workflow) => workflow.name),
  };

  if (json) {
    printJson(result);
  } else if (result.ok) {
    process.stdout.write('consuelo-design check passed.\n');
  } else {
    if (missingPaths.length > 0) {
      process.stderr.write(`missing paths:\n${missingPaths.join('\n')}\n`);
    }
    if (result.hasNestedGitMetadata) {
      process.stderr.write(`${upstreamRoot}/.git should not be committed.\n`);
    }
  }

  if (!result.ok) {
    process.exit(1);
  }
}

function help() {
  process.stdout.write(`consuelo-design

Commands:
  get-design-system     Print Consuelo DESIGN.md, animations.md, and AGENTS.md design context
  workflows             List Consuelo design facade workflow names
  upstream-status       Show vendored Open Design metadata
  railway-check         Verify consuelo-design is excluded from Railway deploy paths
  check                 Run package boundary checks

Flags:
  --json                Print structured JSON where supported
`);
}

function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const json = flags.has('--json');

  switch (command) {
    case 'get-design-system':
      getDesignSystem({ json });
      break;
    case 'workflows':
      listWorkflows({ json });
      break;
    case 'upstream-status':
      upstreamStatus({ json });
      break;
    case 'railway-check':
      checkRailway({ json });
      break;
    case 'check':
      check({ json });
      break;
    case 'help':
    case '--help':
    case '-h':
      help();
      break;
    default:
      process.stderr.write(`Unknown command: ${command}\n\n`);
      help();
      process.exit(1);
  }
}

main();
