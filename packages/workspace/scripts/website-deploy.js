#!/usr/bin/env bun

// website-deploy.js - build and deploy consuelo-website to Cloudflare Pages
// usage: bun run website:deploy -- [options]

const { execSync } = require('child_process');
const path = require('path');

const WEBSITE_DIR = path.resolve(__dirname, '..', '..', 'consuelo-website');
const PROJECT_NAME = 'consuelo-website';
const DEFAULT_BRANCH = 'main';

function writeStdout(s = '') { process.stdout.write(s + '\n'); }
function writeStderr(s = '') { process.stderr.write(s + '\n'); }

function hasCloudflareApiToken(env = process.env) {
  return Boolean(env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_API_TOKEN.trim());
}

function isCiDeploy(env = process.env) {
  return env.CI === 'true' || env.GITHUB_ACTIONS === 'true';
}

function ensureDeployAuth(env = process.env) {
  if (hasCloudflareApiToken(env)) return;

  if (isCiDeploy(env)) {
    writeStderr('CLOUDFLARE_API_TOKEN is required in CI to deploy consuelo-website to Cloudflare Pages.');
    writeStderr('Set the GitHub Actions secret CLOUDFLARE_API_TOKEN, CLOUDFLARE_PAGES_API_TOKEN, or CF_API_TOKEN.');
    process.exit(1);
  }

  writeStderr('CLOUDFLARE_API_TOKEN is not set; using existing Wrangler auth if available.');
}

function run(cmd, opts = {}) {
  writeStderr(`> ${cmd}`);
  return execSync(cmd, {
    cwd: opts.cwd || WEBSITE_DIR,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: opts.timeout || 120000,
  });
}

function printHelp() {
  const lines = [
    'usage: bun run website:deploy -- [options]',
    '',
    'build and deploy consuelo-website to cloudflare pages.',
    '',
    'options:',
    `  --branch <name>      deploy branch (default: ${DEFAULT_BRANCH})`,
    '  --skip-build         skip build, deploy existing dist/',
    '  --build-only         build without deploying',
    '  --preview            deploy to preview url (non-production)',
    '  --json               json output',
    '  --help               show this help',
  ];
  lines.forEach((l) => writeStdout(l));
}

function parseArgs(argv) {
  const args = { branch: DEFAULT_BRANCH };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--branch': args.branch = argv[++i]; break;
      case '--skip-build': args.skipBuild = true; break;
      case '--build-only': args.buildOnly = true; break;
      case '--preview': args.preview = true; break;
      case '--json': args.json = true; break;
      case '--help': args.help = true; break;
      default: throw new Error(`unknown flag: ${argv[i]}`);
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); return; }

  const branch = args.preview ? 'preview' : args.branch;
  const startTime = Date.now();

  // build
  if (!args.skipBuild) {
    writeStderr('building consuelo-website...');
    try {
      run('bun run build', { timeout: 180000 });
      writeStderr('build complete.');
    } catch (err) {
      writeStdout('build failed:');
      writeStdout(err.stderr || err.stdout || err.message);
      process.exit(1);
    }
  }

  if (args.buildOnly) {
    writeStdout('build complete. skipping deploy.');
    return;
  }

  // deploy
  ensureDeployAuth();

  writeStderr(`deploying to cloudflare pages (branch: ${branch})...`);
  try {
    const output = run(
      `bunx wrangler pages deploy dist --project-name=${PROJECT_NAME} --branch=${branch}`,
      { timeout: 120000 },
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const urlMatch = output.match(/https:\/\/[^\s]+\.pages\.dev/);
    const url = urlMatch ? urlMatch[0] : null;

    if (args.json) {
      writeStdout(JSON.stringify({ branch, url, elapsed: `${elapsed}s`, output: output.trim() }, null, 2));
    } else {
      writeStdout('');
      writeStdout(`deployed: ${url || 'check wrangler output'}`);
      writeStdout(`branch: ${branch}`);
      writeStdout(`time: ${elapsed}s`);
    }
  } catch (err) {
    writeStdout('deploy failed:');
    writeStdout(err.stderr || err.stdout || err.message);
    process.exit(1);
  }
}

main();
