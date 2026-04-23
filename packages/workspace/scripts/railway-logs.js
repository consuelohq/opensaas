#!/usr/bin/env bun

// railway-logs.js — LLM-friendly log viewer for opensaas railway services
// strips noise, groups errors, adds context summary

const { execSync } = require('child_process');

const DEFAULT_SERVICE = 'opensaas';

const NOISE_PATTERNS = [
  /\[InstanceLoader\]/,
  /\[RoutesResolver\]/,
  /\[RouterExplorer\]/,
  /dependencies initialized/,
  /Mapped \{.*route$/,
  /Nest application successfully started/,
  /Messages dropped: \d+/,
];

const ERROR_PATTERNS = [
  /error/i, /exception/i, /failed/i, /crash/i,
  /ECONNREFUSED/, /ETIMEDOUT/, /killed/i, /OOM/i,
  /unhandled/i, /rejection/i, /TypeError/, /ReferenceError/,
  /SyntaxError/, /Cannot find module/, /SIGTERM/, /SIGKILL/,
];

const WARN_PATTERNS = [/warn/i, /deprecat/i, /rate limit/i, /timeout/i, /retry/i];

function stripAnsi(s) { return s.replace(/\x1b\[[0-9;]*m/g, ''); }

function parseLine(raw) {
  const clean = stripAnsi(raw).trim();
  if (!clean) return null;

  // nest format: [Nest] 1 - 04/23/2026, 7:32:16 PM LOG [Context] message
  const nestMatch = clean.match(/^\[Nest\]\s+\d+\s+-\s+(\S+,\s+\S+\s+\S+)\s+(\w+)\s+\[([^\]]+)\]\s+(.*)/);
  if (nestMatch) {
    return { time: nestMatch[1], level: nestMatch[2], context: nestMatch[3], message: nestMatch[4], raw: clean };
  }

  // structured format: 2026-04-23T19:32:46Z [INFO] message component="x"
  const structMatch = clean.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s+\[(\w+)\]\s+(.*)/);
  if (structMatch) {
    return { time: structMatch[1], level: structMatch[2], context: '', message: structMatch[3], raw: clean };
  }

  // query logs, stack traces, plain text
  return { time: '', level: '', context: '', message: clean, raw: clean };
}

function classify(parsed) {
  if (!parsed) return 'skip';
  const text = parsed.raw;
  if (NOISE_PATTERNS.some((p) => p.test(text))) return 'noise';
  if (parsed.level === 'ERROR' || ERROR_PATTERNS.some((p) => p.test(text))) return 'error';
  if (parsed.level === 'WARN' || WARN_PATTERNS.some((p) => p.test(text))) return 'warn';
  if (/^query:/.test(parsed.message)) return 'query';
  return 'log';
}

function formatLine(parsed) {
  if (!parsed) return '';
  const level = parsed.level ? `[${parsed.level}]` : '';
  const ctx = parsed.context ? `[${parsed.context}]` : '';
  const parts = [level, ctx, parsed.message].filter(Boolean);
  return parts.join(' ');
}

function dedup(lines) {
  const seen = new Map();
  const result = [];
  for (const line of lines) {
    const key = line.replace(/\d{2}:\d{2}:\d{2}/g, '').trim();
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);
    if (count === 1) {
      result.push(line);
    } else if (count === 2) {
      result.push(`  ... (repeated, showing first occurrence only)`);
    }
  }
  return result;
}

function groupErrors(parsed) {
  const groups = [];
  let current = null;

  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    const cls = classify(p);

    if (cls === 'error' || cls === 'warn') {
      if (current) groups.push(current);
      // grab up to 3 lines before for context
      const contextStart = Math.max(0, i - 3);
      const before = parsed.slice(contextStart, i)
        .filter((x) => x && classify(x) !== 'noise')
        .map(formatLine);
      current = { type: cls, lines: [...before, formatLine(p)], main: formatLine(p) };
    } else if (current && p && (p.message.startsWith('at ') || p.message.startsWith('Error:') || p.message.startsWith('  '))) {
      // stack trace continuation
      current.lines.push('  ' + p.message);
    } else {
      if (current) { groups.push(current); current = null; }
    }
  }

  if (current) groups.push(current);
  return groups;
}

function getServiceStatus(service) {
  try {
    const out = execSync(`railway status --service ${service} 2>&1`, { encoding: 'utf8', timeout: 10000 });
    return stripAnsi(out).trim();
  } catch { return 'unknown'; }
}

function getLatestDeploy(service) {
  try {
    const out = execSync(`railway logs --service ${service} --build 2>&1 | tail -20`, { encoding: 'utf8', timeout: 15000 });
    const lines = stripAnsi(out).split('\n').filter(Boolean);
    const success = lines.some((l) => /successfully|done|complete/i.test(l));
    const failed = lines.some((l) => /error|failed|exit code/i.test(l));
    return { status: failed ? 'failed' : success ? 'success' : 'unknown', lastLines: lines.slice(-5) };
  } catch { return { status: 'unknown', lastLines: [] }; }
}

function fetchLogs(service) {
  try {
    const out = execSync(`railway logs --service ${service} 2>&1`, {
      encoding: 'utf8', timeout: 30000, maxBuffer: 10 * 1024 * 1024,
    });
    return out.split('\n');
  } catch (err) {
    if (err.stdout) return err.stdout.split('\n');
    throw new Error(`railway logs failed: ${err.message}`);
  }
}

function detectBootHealth(parsed) {
  const hasStart = parsed.some((p) => p && /Nest application successfully started/.test(p.raw));
  const hasError = parsed.some((p) => p && classify(p) === 'error');
  if (hasStart && !hasError) return 'healthy';
  if (hasStart && hasError) return 'running with errors';
  if (!hasStart && hasError) return 'crashed or failing';
  return 'unknown';
}

function printHelp() {
  const lines = [
    'usage: bun run railway:logs -- [options]',
    '',
    'LLM-friendly railway log viewer. filters boot noise, groups errors,',
    'adds service status and deploy context.',
    '',
    'options:',
    `  --service <name>     railway service (default: ${DEFAULT_SERVICE})`,
    '  --errors             only show errors/warnings section',
    '  --grep <pattern>     filter to lines matching pattern',
    '  --build              show build logs instead of runtime',
    '  --raw                no filtering or formatting',
    '  --status             just show service status + deploy info',
    '  --env <key>          check if env var is set (shows set/missing, not value)',
    '  --json               output as json',
    '  --help               show this help',
  ];
  lines.forEach((l) => process.stdout.write(l + '\n'));
}

function parseArgs(argv) {
  const args = { service: DEFAULT_SERVICE, json: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--service': args.service = argv[++i]; break;
      case '--errors': args.errorsOnly = true; break;
      case '--grep': args.grep = argv[++i]; break;
      case '--build': args.build = true; break;
      case '--raw': args.raw = true; break;
      case '--status': args.statusOnly = true; break;
      case '--env': args.envCheck = argv[++i]; break;
      case '--json': args.json = true; break;
      case '--help': args.help = true; break;
      default: throw new Error(`unknown flag: ${argv[i]}`);
    }
  }
  return args;
}

function checkEnv(service, key) {
  try {
    const out = execSync(`railway variables --service ${service} 2>&1`, { encoding: 'utf8', timeout: 10000 });
    const hasKey = out.includes(key);
    return hasKey ? 'set' : 'missing';
  } catch { return 'error checking'; }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); return; }

  const out = (s) => process.stdout.write(s + '\n');
  const err = (s) => process.stderr.write(s + '\n');

  // --env check
  if (args.envCheck) {
    const status = checkEnv(args.service, args.envCheck);
    out(`${args.envCheck}: ${status}`);
    return;
  }

  // --status only
  if (args.statusOnly) {
    const deploy = getLatestDeploy(args.service);
    out(`service: ${args.service}`);
    out(`last build: ${deploy.status}`);
    if (deploy.lastLines.length) {
      out('');
      deploy.lastLines.forEach((l) => out('  ' + l));
    }
    return;
  }

  // --build logs
  if (args.build) {
    err(`fetching build logs for ${args.service}...`);
    const deploy = getLatestDeploy(args.service);
    out(`build: ${deploy.status}`);
    out('');
    deploy.lastLines.forEach((l) => out(l));
    return;
  }

  // runtime logs
  err(`fetching runtime logs for ${args.service}...`);
  const rawLines = fetchLogs(args.service);

  // --raw mode
  if (args.raw) {
    rawLines.forEach((l) => out(stripAnsi(l)));
    return;
  }

  const parsed = rawLines.map(parseLine).filter(Boolean);
  const boot = detectBootHealth(parsed);
  const errorGroups = groupErrors(parsed);
  const errors = errorGroups.filter((g) => g.type === 'error');
  const warnings = errorGroups.filter((g) => g.type === 'warn');

  // filter out noise for activity section
  let activity = parsed
    .filter((p) => classify(p) !== 'noise' && classify(p) !== 'query')
    .map(formatLine);

  if (args.grep) {
    const pattern = new RegExp(args.grep, 'i');
    activity = activity.filter((l) => pattern.test(l));
  }

  activity = dedup(activity);

  if (args.json) {
    out(JSON.stringify({ service: args.service, boot, errors: errors.length, warnings: warnings.length, errorGroups, activity }, null, 2));
    return;
  }

  // header
  out(`service: ${args.service}`);
  out(`boot: ${boot}`);
  out(`errors: ${errors.length}, warnings: ${warnings.length}`);

  // errors section
  if (errors.length > 0) {
    out('');
    out(`--- errors (${errors.length}) ---`);
    for (const group of errors) {
      out('');
      dedup(group.lines).forEach((l) => out(l));
    }
  }

  // warnings section
  if (warnings.length > 0) {
    out('');
    out(`--- warnings (${warnings.length}) ---`);
    for (const group of warnings) {
      out('');
      dedup(group.lines).forEach((l) => out(l));
    }
  }

  // activity (skip if --errors)
  if (!args.errorsOnly) {
    const tail = activity.slice(-30);
    if (tail.length > 0) {
      out('');
      out(`--- recent activity (${tail.length} lines) ---`);
      tail.forEach((l) => out(l));
    }
  }
}

main();
