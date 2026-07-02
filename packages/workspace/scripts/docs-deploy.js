#!/usr/bin/env bun

// docs-deploy.js - build and deploy packages/documentation to Cloudflare Workers
// usage: bun run docs:deploy -- [options]

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.resolve(__dirname, '..', '..', 'documentation');
const BUILT_WRANGLER_CONFIG = path.join(DOCS_DIR, 'dist', 'server', 'wrangler.json');

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
    writeStderr('CLOUDFLARE_API_TOKEN is required in CI to deploy consuelo-docs to Cloudflare Workers.');
    writeStderr('Set the GitHub Actions secret CLOUDFLARE_API_TOKEN or CF_API_TOKEN.');
    process.exit(1);
  }

  writeStderr('CLOUDFLARE_API_TOKEN is not set; using existing Wrangler auth if available.');
}

function run(cmd, opts = {}) {
  writeStderr(`> ${cmd}`);
  return execSync(cmd, {
    cwd: opts.cwd || DOCS_DIR,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: opts.timeout || 120000,
  });
}

function printHelp() {
  const lines = [
    'usage: bun run docs:deploy -- [options]',
    '',
    'build and deploy packages/documentation to cloudflare workers.',
    '',
    'options:',
    '  --skip-build         skip build, deploy existing dist/',
    '  --build-only         build without deploying',
    '  --json               json output',
    '  --help               show this help',
  ];
  lines.forEach((l) => writeStdout(l));
}

function assertBuiltWranglerConfig() {
  if (!fs.existsSync(BUILT_WRANGLER_CONFIG)) {
    throw new Error('missing dist/server/wrangler.json; run build before deploy');
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--skip-build': args.skipBuild = true; break;
      case '--build-only': args.buildOnly = true; break;
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

  const startTime = Date.now();

  if (!args.skipBuild) {
    writeStderr('building packages/documentation...');
    try {
      run('bun run build', { timeout: 180000 });
      writeStderr('build complete.');
    } catch (err) {
      writeStdout('build failed:');
      writeStdout(err.stderr || err.stdout || err.message);
      process.exit(1);
    }
  }

  try {
    assertBuiltWranglerConfig();
  } catch (err) {
    writeStdout('deploy config check failed:');
    writeStdout(err.message);
    process.exit(1);
  }

  if (args.buildOnly) {
    writeStdout('build complete. skipping deploy.');
    return;
  }

  ensureDeployAuth();

  writeStderr('deploying to cloudflare workers...');
  try {
    const serverDir = path.join(DOCS_DIR, 'dist', 'server');
    const output = run(
      'bunx wrangler deploy --config wrangler.json',
      { cwd: serverDir, timeout: 180000 },
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const urlMatch = output.match(/https:\/\/docs\.consuelohq\.com[^\s]*/i)
      || output.match(/https:\/\/[^\s]+\.workers\.dev/i);
    const url = urlMatch ? urlMatch[0] : 'https://docs.consuelohq.com';

    if (args.json) {
      writeStdout(JSON.stringify({ url, elapsed: `${elapsed}s`, output: output.trim() }, null, 2));
    } else {
      writeStdout('');
      writeStdout(`deployed: ${url}`);
      writeStdout(`time: ${elapsed}s`);
    }
  } catch (err) {
    writeStdout('deploy failed:');
    writeStdout(err.stderr || err.stdout || err.message);
    process.exit(1);
  }
}

main();