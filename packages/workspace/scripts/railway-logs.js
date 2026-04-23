#!/usr/bin/env bun

// railway-logs.js — smart log viewer for opensaas railway services
// filters out NestJS boot noise, route mappings, and module init spam
// usage: bun run railway:logs -- [options]

const { execSync } = require('child_process');

const SERVICES = ['opensaas', 'twenty-worker'];
const DEFAULT_SERVICE = 'opensaas';
const DEFAULT_LINES = 200;

// patterns that are just boot noise — never useful for debugging
const NOISE_PATTERNS = [
  /\[InstanceLoader\]/,
  /\[RoutesResolver\]/,
  /\[RouterExplorer\]/,
  /dependencies initialized/,
  /Mapped \{.*route$/,
  /Nest application successfully started/,
  /Messages dropped: \d+/,
];

// patterns that are always interesting
const IMPORTANT_PATTERNS = [
  /error/i,
  /warn/i,
  /exception/i,
  /failed/i,
  /crash/i,
  /ECONNREFUSED/,
  /ETIMEDOUT/,
  /killed/i,
  /OOM/i,
  /signal/i,
  /unhandled/i,
  /rejection/i,
  /stack.*at /i,
  /TypeError/,
  /ReferenceError/,
  /SyntaxError/,
  /Cannot find module/,
  /rate limit/i,
];

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: bun run railway:logs -- [options]');
  writeStdout('');
  writeStdout('smart log viewer that filters NestJS boot noise.');
  writeStdout('');
  writeStdout('options:');
  writeStdout(`  --service <name>     railway service (default: ${DEFAULT_SERVICE})`);
  writeStdout(`  --lines <n>          number of raw lines to fetch (default: ${DEFAULT_LINES})`);
  writeStdout('  --errors             only show errors/warnings');
  writeStdout('  --raw                no filtering, show everything');
  writeStdout('  --build              show build logs instead of runtime');
  writeStdout('  --grep <pattern>     filter to lines matching pattern');
  writeStdout('  --json               output as json array');
  writeStdout('  --help               show this help');
}

function parseArgs(argv) {
  const args = {
    service: DEFAULT_SERVICE,
    lines: DEFAULT_LINES,
    errorsOnly: false,
    raw: false,
    build: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    switch (flag) {
      case '--service':
        args.service = argv[++i];
        break;
      case '--lines':
        args.lines = parseInt(argv[++i], 10);
        break;
      case '--errors':
        args.errorsOnly = true;
        break;
      case '--raw':
        args.raw = true;
        break;
      case '--build':
        args.build = true;
        break;
      case '--grep':
        args.grep = argv[++i];
        break;
      case '--json':
        args.json = true;
        break;
      case '--help':
        args.help = true;
        break;
      default:
        throw new Error(`unknown flag: ${flag}`);
    }
  }

  return args;
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function isNoise(line) {
  const clean = stripAnsi(line);
  return NOISE_PATTERNS.some((p) => p.test(clean));
}

function isImportant(line) {
  const clean = stripAnsi(line);
  return IMPORTANT_PATTERNS.some((p) => p.test(clean));
}

function fetchLogs(args) {
  const cmd = args.build
    ? `railway logs --service ${args.service} --build`
    : `railway logs --service ${args.service}`;

  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return output.split('\n');
  } catch (err) {
    if (err.stdout) return err.stdout.split('\n');
    throw new Error(`railway logs failed: ${err.message}`);
  }
}

function filterLogs(lines, args) {
  if (args.raw) return lines;

  let filtered = lines;

  // remove boot noise
  if (!args.raw) {
    filtered = filtered.filter((line) => !isNoise(line));
  }

  // errors only
  if (args.errorsOnly) {
    filtered = filtered.filter((line) => isImportant(line));
  }

  // grep
  if (args.grep) {
    const pattern = new RegExp(args.grep, 'i');
    filtered = filtered.filter((line) => pattern.test(stripAnsi(line)));
  }

  // remove empty lines
  filtered = filtered.filter((line) => line.trim());

  return filtered;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  writeStderr(`fetching ${args.build ? 'build' : 'runtime'} logs for ${args.service}...`);

  const rawLines = fetchLogs(args);
  const filtered = filterLogs(rawLines, args);

  if (args.json) {
    writeStdout(JSON.stringify(filtered, null, 2));
    return;
  }

  const totalRaw = rawLines.filter((l) => l.trim()).length;
  const totalFiltered = filtered.length;

  writeStderr(`${totalFiltered} lines (filtered from ${totalRaw} raw)`);
  writeStderr('');

  for (const line of filtered) {
    writeStdout(stripAnsi(line));
  }
}

main();
