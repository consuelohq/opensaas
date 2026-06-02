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
    const raw = execSync(`railway deployment list --service ${service} --json 2>&1`, { encoding: 'utf8', timeout: 15000 });
    const deploys = JSON.parse(raw);
    if (!deploys.length) return { status: 'unknown', meta: null };
    const d = deploys[0];
    const status = d.status === 'SUCCESS' ? 'success' : d.status === 'BUILDING' ? 'building' : d.status === 'DEPLOYING' ? 'deploying' : d.status === 'REMOVED' ? 'removed' : 'failed';
    return {
      status,
      meta: {
        commit: d.meta?.commitHash?.slice(0, 8) || null,
        message: d.meta?.commitMessage?.split('\n')[0] || null,
        author: d.meta?.commitAuthor || null,
        branch: d.meta?.branch || null,
        repo: d.meta?.repo || null,
        createdAt: d.createdAt || null,
      },
    };
  } catch { return { status: 'unknown', meta: null }; }
}

function fetchLogs(service, { filter, lines, deploymentId } = {}) {
  try {
    let cmd = `railway logs --service ${service}`;
    if (deploymentId) cmd += ` ${deploymentId}`;
    if (filter) cmd += ` --filter ${JSON.stringify(filter)}`;
    if (lines) cmd += ` --lines ${lines}`;
    else cmd += ' --lines 200';
    const out = execSync(`${cmd} 2>&1`, {
      encoding: 'utf8', timeout: 30000, maxBuffer: 10 * 1024 * 1024,
    });
    return out.split('\n');
  } catch (err) {
    if (err.stdout) return err.stdout.split('\n');
    throw new Error(`railway logs failed: ${err.message}`);
  }
}

function getRailwayToken() {
  try {
    const cfg = require('fs').readFileSync(require('os').homedir() + '/.railway/config.json', 'utf8');
    return JSON.parse(cfg).user?.token || null;
  } catch { return null; }
}

function getDeploymentId(service) {
  try {
    const raw = execSync(`railway deployment list --service ${service} --json 2>&1`, { encoding: 'utf8', timeout: 15000 });
    const deploys = JSON.parse(raw);
    const active = deploys.find((d) => d.status === 'SUCCESS') || deploys[0];
    return active?.id || null;
  } catch { return null; }
}

function fetchHttpLogs(deploymentId, { filter, lines } = {}) {
  const token = getRailwayToken();
  if (!token || !deploymentId) return [];
  try {
    const limit = lines || 50;
    const filterArg = filter ? `, filter: ${JSON.stringify(filter)}` : '';
    const query = `{ httpLogs(deploymentId: "${deploymentId}", limit: ${limit}${filterArg}) { timestamp method path httpStatus totalDuration } }`;
    const resp = execSync(
      `curl -s https://backboard.railway.com/graphql/v2 -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d ${JSON.stringify(JSON.stringify({ query }))}`,
      { encoding: 'utf8', timeout: 15000 },
    );
    const data = JSON.parse(resp);
    return (data.data?.httpLogs || []).map((h) => ({
      time: h.timestamp,
      method: h.method,
      path: h.path,
      status: h.httpStatus,
      duration: h.totalDuration,
    }));
  } catch { return []; }
}

function formatHttpLog(h) {
  const ts = h.time ? new Date(h.time).toLocaleTimeString() : '';
  return `${ts} ${h.method} ${h.path} → ${h.status} (${h.duration}ms)`;
}

function fetchNetworkSummary(deployId) {
  if (!deployId) return null;
  const PROJECT_ID = 'a3e618e2-9685-401f-b924-a125b0fb9123';
  const SERVICE_ID = '85b58812-5bc2-4a99-a1ca-aa64a0a213b5';
  const ENV_ID = '6de4fa99-b047-4587-b003-69f78b650aa1';
  const url = `https://railway.com/project/${PROJECT_ID}/service/${SERVICE_ID}?environmentId=${ENV_ID}&id=${deployId}#network`;
  try {
    execSync('agent-browser open ' + JSON.stringify(url), { encoding: 'utf8', timeout: 15000, stdio: 'pipe' });
    try { execSync('agent-browser wait --text "TCP" --timeout 8000', { encoding: 'utf8', timeout: 12000, stdio: 'pipe' }); }
    catch { /* might already be loaded */ }
    const tabSnap = execSync('agent-browser snapshot -i', { encoding: 'utf8', timeout: 10000, stdio: 'pipe' });
    const tabMatch = tabSnap.match(/tab "Network Flow\s+Logs".*?\[ref=(e\d+)\]/);
    if (tabMatch) {
      execSync(`agent-browser click @${tabMatch[1]}`, { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
      try { execSync('agent-browser wait --text "TCP" --timeout 5000', { encoding: 'utf8', timeout: 8000, stdio: 'pipe' }); }
      catch { /* data might already be there */ }
    }
    const snap = execSync('agent-browser snapshot', { encoding: 'utf8', timeout: 10000, stdio: 'pipe' });
    const rows = [];
    const lines = snap.split('\n');
    let i = 0;
    while (i < lines.length) {
      if (/- row\b/.test(lines[i]) && lines[i].includes('clickable')) {
        const cells = [];
        i++;
        while (i < lines.length && !/- row\b/.test(lines[i])) {
          const m = lines[i].match(/- cell "([^"]*)"/);
          if (m) cells.push(m[1]);
          else if (/- cell\s*$/.test(lines[i].trim())) cells.push('');
          i++;
        }
        if (cells.length >= 9) rows.push({ proto: cells[2], peer: cells[5], latency: parseInt(cells[7]) || 0, status: cells[8] });
      } else { i++; }
    }
    if (!rows.length) return null;
    const groups = {};
    for (const r of rows) {
      const key = r.peer || 'unknown';
      if (!groups[key]) groups[key] = { count: 0, totalLatency: 0, errors: 0 };
      groups[key].count++;
      groups[key].totalLatency += r.latency;
      if (r.status !== 'OK') groups[key].errors++;
    }
    return { total: rows.length, groups };
  } catch { return null; }
}

function formatNetworkSummary(summary) {
  if (!summary) return [];
  const lines = [`--- network (${summary.total} flows) ---`];
  for (const [peer, g] of Object.entries(summary.groups)) {
    const avg = Math.round(g.totalLatency / g.count);
    const err = g.errors > 0 ? `, ${g.errors} errors` : '';
    lines.push(`  ${peer}: ${g.count} connections, avg ${avg}ms${err}`);
  }
  return lines;
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
    '  --errors             only show errors (uses @level:error server-side)',
    '  --filter <query>     railway filter query (e.g. "@level:error", "twilio OR queue")',
    '  --lines <n>          number of log lines to fetch (default: 200)',
    '  --build              show build logs instead of runtime',
    '  --network            show network flow logs (TCP/UDP connections)',
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
      case '--filter': args.filter = argv[++i]; break;
      case '--lines': args.lines = parseInt(argv[++i], 10); break;
      case '--build': args.build = true; break;
      case '--network': args.network = true; break;
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
    if (deploy.meta) {
      const m = deploy.meta;
      if (m.commit) out(`commit: ${m.commit} (${m.branch || 'unknown'})`);
      if (m.message) out(`message: ${m.message}`);
      if (m.author) out(`author: ${m.author}`);
      if (m.createdAt) out(`deployed: ${new Date(m.createdAt).toLocaleString()}`);
    }
    const netSummary = fetchNetworkSummary(getDeploymentId(args.service));
    if (netSummary) { out(''); formatNetworkSummary(netSummary).forEach((l) => out(l)); }
    return;
  }

  // --build logs
  if (args.build) {
    err(`fetching build logs for ${args.service}...`);
    const deploy = getLatestDeploy(args.service);
    out(`build: ${deploy.status}`);
    if (deploy.meta?.commit) out(`commit: ${deploy.meta.commit} — ${deploy.meta.message || ''}`);
    out('');
    try {
      const raw = execSync(`railway logs --service ${args.service} --build 2>&1 | tail -20`, { encoding: 'utf8', timeout: 15000 });
      stripAnsi(raw).split('\n').filter(Boolean).forEach((l) => out(l));
    } catch { /* no build logs available */ }
    return;
  }

  // --network flow logs (scraped from railway dashboard via agent-browser)
  if (args.network) {
    err(`fetching network flow logs for ${args.service}...`);
    const deploy = getLatestDeploy(args.service);
    if (deploy.meta) out(`deploy: ${deploy.meta.commit} — ${deploy.meta.message || ''}`);
    const deployId = getDeploymentId(args.service);
    if (!deployId) { out('no active deployment found'); return; }
    const PROJECT_ID = 'a3e618e2-9685-401f-b924-a125b0fb9123';
    const SERVICE_ID = '85b58812-5bc2-4a99-a1ca-aa64a0a213b5';
    const ENV_ID = '6de4fa99-b047-4587-b003-69f78b650aa1';
    const url = `https://railway.com/project/${PROJECT_ID}/service/${SERVICE_ID}?environmentId=${ENV_ID}&id=${deployId}#network`;
    try {
      execSync('agent-browser open ' + JSON.stringify(url), { encoding: 'utf8', timeout: 15000, stdio: 'pipe' });
      // wait for the network tab to load with data
      try { execSync('agent-browser wait --text "TCP" --timeout 8000', { encoding: 'utf8', timeout: 12000, stdio: 'pipe' }); }
      catch { /* might already be loaded */ }
      // click the Network Flow Logs tab to ensure it's active
      const tabSnap = execSync('agent-browser snapshot -i', { encoding: 'utf8', timeout: 10000, stdio: 'pipe' });
      const tabMatch = tabSnap.match(/tab "Network Flow\s+Logs".*?\[ref=(e\d+)\]/);
      if (tabMatch) {
        execSync(`agent-browser click @${tabMatch[1]}`, { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
        try { execSync('agent-browser wait --text "TCP" --timeout 5000', { encoding: 'utf8', timeout: 8000, stdio: 'pipe' }); }
        catch { /* data might already be there */ }
      }
      const snap = execSync('agent-browser snapshot', { encoding: 'utf8', timeout: 10000, stdio: 'pipe' });
      const rows = [];
      const lines = snap.split('\n');
      let i = 0;
      while (i < lines.length) {
        if (/- row\b/.test(lines[i]) && lines[i].includes('clickable')) {
          const cells = [];
          i++;
          // collect cells until next row or end of indentation
          while (i < lines.length && !/- row\b/.test(lines[i])) {
            const m = lines[i].match(/- cell "([^"]*)"/);
            if (m) cells.push(m[1]);
            else if (/- cell\s*$/.test(lines[i].trim())) cells.push(''); // empty cell (Dir column)
            i++;
          }
          // columns: time, dir(empty), proto, source, dest, peer, traffic, latency, status, settings(empty)
          if (cells.length >= 9) rows.push({ time: cells[0], proto: cells[2], src: cells[3], dst: cells[4], peer: cells[5], traffic: cells[6], latency: cells[7], status: cells[8] });
        } else { i++; }
      }
      if (rows.length === 0) { out('no network flow logs found'); return; }
      out(`\n--- network flow logs (${rows.length} entries) ---`);
      for (const r of rows) {
        const ts = r.time.replace(/^Apr \d+ \d{4} /, '');
        out(`${ts}  ${r.proto.padEnd(5)} ${r.src.padEnd(28)} → ${r.dst.padEnd(28)} ${r.peer.padEnd(12)} ${r.traffic.padEnd(8)} ${r.latency.padEnd(6)} ${r.status}`);
      }
    } catch (e) {
      out('failed to fetch network logs (is agent-browser running with ko\'s profile?)');
      out('start with: agent-browser --profile ~/.agent-browser-ko --headed open https://railway.com');
    }
    return;
  }

  // runtime logs
  err(`fetching runtime logs for ${args.service}...`);
  const filter = args.errorsOnly ? '@level:error' : args.filter || null;
  const deploy = getLatestDeploy(args.service);
  const deployId = deploy.meta ? getDeploymentId(args.service) : null;
  if (deploy.meta) {
    err(`deploy: ${deploy.meta.commit} — ${deploy.meta.message}`);
  }
  const rawLines = fetchLogs(args.service, { filter, lines: args.lines, deploymentId: deployId });

  // http logs
  let httpLogs = fetchHttpLogs(deployId, { filter, lines: args.lines ? Math.min(args.lines, 50) : 50 });

  // --raw mode
  if (args.raw) {
    rawLines.forEach((l) => out(stripAnsi(l)));
    if (httpLogs.length) {
      out('');
      httpLogs.forEach((h) => out(formatHttpLog(h)));
    }
    return;
  }

  const parsed = rawLines.map(parseLine).filter(Boolean);
  const boot = detectBootHealth(parsed);
  const errorGroups = groupErrors(parsed);
  const errors = errorGroups.filter((g) => g.type === 'error');
  const warnings = errorGroups.filter((g) => g.type === 'warn');

  // http errors (4xx/5xx)
  const httpErrors = httpLogs.filter((h) => h.status >= 400);

  // filter out noise for activity section
  let activity = parsed
    .filter((p) => classify(p) !== 'noise' && classify(p) !== 'query')
    .map(formatLine);

  activity = dedup(activity);

  if (args.json) {
    out(JSON.stringify({ service: args.service, boot, errors: errors.length, warnings: warnings.length, errorGroups, httpLogs, httpErrors: httpErrors.length, activity }, null, 2));
    return;
  }

  // header
  out(`service: ${args.service}`);
  out(`boot: ${boot}`);
  out(`errors: ${errors.length}, warnings: ${warnings.length}, http errors: ${httpErrors.length}`);

  // errors section
  if (errors.length > 0) {
    out('');
    out(`--- errors (${errors.length}) ---`);
    for (const group of errors) {
      out('');
      dedup(group.lines).forEach((l) => out(l));
    }
  }

  // http errors section
  if (httpErrors.length > 0) {
    out('');
    out(`--- http errors (${httpErrors.length}) ---`);
    httpErrors.forEach((h) => out(formatHttpLog(h)));
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

    // recent http traffic
    const recentHttp = httpLogs.slice(-20);
    if (recentHttp.length > 0) {
      out('');
      out(`--- recent http (${recentHttp.length} requests) ---`);
      recentHttp.forEach((h) => out(formatHttpLog(h)));
    }
  }

  // network summary (always shown)
  const netSummary = fetchNetworkSummary(deployId);
  if (netSummary) { out(''); formatNetworkSummary(netSummary).forEach((l) => out(l)); }
}

main();
