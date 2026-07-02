#!/usr/bin/env bun

// web-deploy.js - deploy Consuelo web surfaces to Cloudflare
// usage: bun run web:deploy -- <target> [options]

const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPTS_DIR = __dirname;
const TARGETS = new Set(['docs', 'website', 'all']);

function writeStdout(s = '') { process.stdout.write(s + '\n'); }
function writeStderr(s = '') { process.stderr.write(s + '\n'); }

function printHelp() {
  const lines = [
    'usage: bun run web:deploy -- <target> [options]',
    '',
    'deploy consuelo web surfaces to cloudflare.',
    '',
    'targets:',
    '  docs                 deploy packages/documentation (cloudflare workers)',
    '  website              deploy packages/consuelo-website (cloudflare pages)',
    '  all                  deploy docs then website',
    '',
    'options:',
    '  --build-only         build without deploying',
    '  --skip-build         skip build, deploy existing artifacts',
    '  --branch <name>      website deploy branch (default: main)',
    '  --preview            website preview deploy (non-production)',
    '  --json               json output',
    '  --help               show this help',
  ];
  lines.forEach((l) => writeStdout(l));
}

function parseArgs(argv) {
  const args = { passthrough: [] };
  let target = null;

  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === '--help') {
      args.help = true;
      continue;
    }

    if (!value.startsWith('--') && !target) {
      target = value;
      continue;
    }

    args.passthrough.push(value);
    if (value === '--branch') {
      args.passthrough.push(argv[++i]);
    }
  }

  args.target = target;
  return args;
}

function runScript(scriptName, extraArgs = []) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  const result = spawnSync('bun', [scriptPath, ...extraArgs], {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  if (result.stdout) writeStdout(result.stdout.trimEnd());
  if (result.stderr) writeStderr(result.stderr.trimEnd());

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.target) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  if (!TARGETS.has(args.target)) {
    writeStderr(`unknown target: ${args.target}`);
    printHelp();
    process.exit(1);
  }

  const passthrough = args.passthrough;

  if (args.target === 'docs' || args.target === 'all') {
    writeStderr(`web deploy: docs`);
    runScript('docs-deploy.js', passthrough);
  }

  if (args.target === 'website' || args.target === 'all') {
    writeStderr(`web deploy: website`);
    runScript('website-deploy.js', passthrough);
  }
}

main();