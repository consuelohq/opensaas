#!/usr/bin/env bun

// context.js — search and save project context (supabase memories)
// usage: bun run context -- <command> [options]

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { Database } = require('bun:sqlite');

function loadEnv() {
  const envPaths = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', '.env'),
    path.join(process.env.HOME || '/tmp', '.env'),
  ];
  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      const url = (content.match(/SUPABASE_URL=(.+)/) || [])[1];
      const key = (content.match(/SUPABASE_KEY=(.+)/) || [])[1];
      if (url && key) return { url: url.trim(), key: key.trim() };
    }
  }
  return {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY,
  };
}

function writeStdout(s = '') { process.stdout.write(s + '\n'); }
function writeStderr(s = '') { process.stderr.write(s + '\n'); }

function printHelp() {
  const lines = [
    'usage: bun run context -- <command> [options]',
    '',
    'search and save project context from supabase memories.',
    '',
    'commands:',
    '  search <keyword>       search memories by content (one keyword, simple)',
    '  find <keyword>         search by title',
    '  get <n> <keyword>      get full content of result #n from a search',
    '  list [category]        list recent memories, optionally filtered by category',
    '  save <title> <file>    save a file as a memory',
    '  save <title> --text    save inline text from stdin',
    '  categories             list available categories',
    '  trace                  query local workspace tool traces',
    '',
    'options:',
    '  --category <name>      filter by category',
    '  --limit <n>            max results (default: 10)',
    '  --trace-id <id>        filter trace rows by visible or MCP trace id',
    '  --tool <name>          filter trace rows by tool name',
    '  --status <status>      all, ok, error, blocked, or timeout',
    '  --since <iso>          filter trace rows at or after timestamp',
    '  --until <iso>          filter trace rows before timestamp',
    '  --task-session <id>    filter trace rows by task session',
    '  --branch <branch>      filter trace rows by task branch',
    '  --contains <text>      search raw trace JSON and stderr',
    '  --raw                  include raw input/result JSON for trace rows',
    '  --db <path>            read trace rows from an explicit SQLite db',
    '  --json                 json output',
    '  --help                 show this help',
    '',
    'examples:',
    '  bun run context -- search dialer',
    '  bun run context -- search queue --category workpad',
    '  bun run context -- find "queue handoff"',
    '  bun run context -- list workpad',
    '  bun run context -- list --limit 5',
    '  bun run context -- save "dialer architecture" ./notes.md',
    '  bun run context -- categories',
    '  bun run context -- trace --status error --limit 20',
    '  bun run context -- trace --trace-id trc_abc123 --raw',
  ];
  lines.forEach((l) => writeStdout(l));
}

function parseArgs(argv) {
  const args = { limit: 10, positional: [] };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--category': args.category = argv[++i]; break;
      case '--limit': args.limit = parseInt(argv[++i], 10); break;
      case '--trace-id': args.traceId = argv[++i]; break;
      case '--tool': args.tool = argv[++i]; break;
      case '--status': args.status = argv[++i]; break;
      case '--since': args.since = argv[++i]; break;
      case '--until': args.until = argv[++i]; break;
      case '--task-session': args.taskSession = argv[++i]; break;
      case '--branch': args.branch = argv[++i]; break;
      case '--contains': args.contains = argv[++i]; break;
      case '--raw': args.raw = true; break;
      case '--db': args.db = argv[++i]; break;
      case '--json': args.json = true; break;
      case '--text': args.text = true; break;
      case '--by-title': args.byTitle = true; break;
      case '--help': args.help = true; break;
      default:
        if (argv[i].startsWith('--')) throw new Error(`unknown flag: ${argv[i]}`);
        args.positional.push(argv[i]);
    }
  }
  return args;
}

async function supabaseGet(env, params) {
  try {
    const url = new URL(`${env.url}/rest/v1/memories`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    const resp = await fetch(url.toString(), {
      headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
    });
    if (!resp.ok) throw new Error(`supabase ${resp.status}: ${await resp.text()}`);
    return resp.json();
  
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`context supabaseGet failed: ${message}`);
  }
}

async function supabaseInsert(env, data) {
  try {
    const resp = await fetch(`${env.url}/rest/v1/memories`, {
      method: 'POST',
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(data),
    });
    if (!resp.ok) throw new Error(`supabase ${resp.status}: ${await resp.text()}`);
    const text = await resp.text();
    if (!text.trim()) return null;
    return JSON.parse(text);
  
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`context supabaseInsert failed: ${message}`);
  }
}

function formatRow(row, idx) {
  const cat = row.category ? `[${row.category}]` : '';
  const title = row.title || '(untitled)';
  const date = row.created_at ? row.created_at.slice(0, 16).replace('T', ' ') : '';
  const preview = (row.content || '').replace(/\n/g, ' ').slice(0, 500);
  return `${idx + 1}. ${cat} ${title}  (${date})\n   ${preview}${preview.length >= 500 ? '...' : ''}`;
}

function printHeader(label) {
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  writeStdout(`${label}  (now: ${now})\n`);
}

async function cmdSearch(env, keyword, args) {
  try {
    const params = {
      select: 'title,content,category,created_at',
      'content': `ilike.*${keyword}*`,
      'order': 'created_at.desc',
      'limit': String(args.limit),
    };
    if (args.category) params['category'] = `eq.${args.category}`;
  
    const rows = await supabaseGet(env, params);
  
    if (args.json) { writeStdout(JSON.stringify(rows, null, 2)); return; }
  
    if (rows.length === 0) {
      writeStdout(`no memories found for "${keyword}"`);
      return;
    }
  
    printHeader(`${rows.length} result(s) for "${keyword}"`);
    rows.forEach((row, i) => writeStdout(formatRow(row, i)));
    writeStdout('');
    writeStdout(`tip: bun run context -- get <number> ${keyword}  next tool call to read full content of a result`);
  
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`context cmdSearch failed: ${message}`);
  }
}

async function cmdFind(env, keyword, args) {
  try {
    const params = {
      select: 'title,content,category,created_at',
      'title': `ilike.*${keyword}*`,
      'order': 'created_at.desc',
      'limit': String(args.limit),
    };
    if (args.category) params['category'] = `eq.${args.category}`;
  
    const rows = await supabaseGet(env, params);
  
    if (args.json) { writeStdout(JSON.stringify(rows, null, 2)); return; }
  
    if (rows.length === 0) {
      writeStdout(`no memories found with title matching "${keyword}"`);
      return;
    }
  
    writeStdout(`${rows.length} result(s) for title "${keyword}":\n`);
    rows.forEach((row, i) => writeStdout(formatRow(row, i)));
    writeStdout('');
    writeStdout(`tip: bun run context -- get <number> ${keyword} --by-title  next tool call to read full content of a result`);
  
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`context cmdFind failed: ${message}`);
  }
}

async function cmdList(env, category, args) {
  try {
    const params = {
      select: 'title,category,created_at',
      'order': 'created_at.desc',
      'limit': String(args.limit),
    };
    if (category) params['category'] = `eq.${category}`;
  
    const rows = await supabaseGet(env, params);
  
    if (args.json) { writeStdout(JSON.stringify(rows, null, 2)); return; }
  
    if (rows.length === 0) {
      writeStdout(category ? `no memories in category "${category}"` : 'no memories found');
      return;
    }
  
    const label = category ? `"${category}" memories` : 'recent memories';
    printHeader(`${rows.length} ${label}`);
    rows.forEach((row, i) => {
      const cat = row.category ? `[${row.category}]` : '';
      const date = row.created_at ? row.created_at.slice(0, 16).replace('T', ' ') : '';
      writeStdout(`${i + 1}. ${cat} ${row.title || '(untitled)'}  (${date})`);
    });
  
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`context cmdList failed: ${message}`);
  }
}

async function cmdSave(env, title, source, args) {
  try {
    let content;
    if (args.text) {
      // read from stdin
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      content = Buffer.concat(chunks).toString('utf8');
    } else if (source && fs.existsSync(source)) {
      content = fs.readFileSync(source, 'utf8');
    } else {
      throw new Error(`file not found: ${source}. use --text to read from stdin.`);
    }
  
    const category = args.category || 'observation';
    const inserted = await supabaseInsert(env, { title, category, content });
  
    if (args.json) {
      const insertedRows = Array.isArray(inserted) ? inserted : [];
      writeStdout(JSON.stringify({
        title,
        category,
        contentLength: content.length,
        saved: insertedRows.map((row) => ({
          id: row.id,
          title: row.title,
          category: row.category,
          created_at: row.created_at,
          updated_at: row.updated_at,
        })),
      }, null, 2));
      return;
    }
  
    writeStdout(`saved: "${title}" [${category}] (${content.length} chars)`);
  
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`context cmdSave failed: ${message}`);
  }
}


async function cmdGet(env, num, keyword, args) {
  try {
    const byTitle = args.byTitle;
    const params = {
      select: 'title,content,category,created_at',
      'order': 'created_at.desc',
      'limit': String(num),
    };
    if (byTitle) {
      params['title'] = `ilike.*${keyword}*`;
    } else {
      params['content'] = `ilike.*${keyword}*`;
    }
    if (args.category) params['category'] = `eq.${args.category}`;
  
    const rows = await supabaseGet(env, params);
    const row = rows[num - 1];
  
    if (!row) {
      if (args.json) { writeStdout(JSON.stringify(null)); return; }
      writeStdout(`no result #${num} for "${keyword}"`);
      return;
    }
  
    if (args.json) { writeStdout(JSON.stringify(row, null, 2)); return; }
  
    const cat = row.category ? `[${row.category}]` : '';
    const date = row.created_at ? row.created_at.slice(0, 16).replace('T', ' ') : '';
    writeStdout(`${cat} ${row.title}  (${date})\n`);
    writeStdout(row.content || '(empty)');
  
    // detect chunks and hint how to get the rest
    const chunkMatch = (row.title || '').match(/\(chunk (\d+)\/(\d+)\)/);
    if (chunkMatch) {
      const current = parseInt(chunkMatch[1], 10);
      const total = parseInt(chunkMatch[2], 10);
      const baseName = row.title.replace(/\s*\(chunk \d+\/\d+\)/, '');
      writeStdout('');
      writeStdout(`--- chunk ${current} of ${total} ---`);
      writeStdout(`tip: bun run context -- find "${baseName}" --limit ${total}  next tool call to see all ${total} chunks`);
    } else {
      writeStdout('');
      writeStdout(`tip: bun run context -- get <number> ${keyword}  next tool call to read another result`);
    }
  
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`context cmdGet failed: ${message}`);
  }
}

async function cmdCategories(env, args) {
  try {
    const rows = await supabaseGet(env, {
      select: 'category',
      'order': 'category',
    });
    const cats = [...new Set(rows.map((r) => r.category).filter(Boolean))].sort();

    if (args.json) { writeStdout(JSON.stringify(cats, null, 2)); return; }

    writeStdout('categories:\n');
    cats.forEach((c) => writeStdout(`  ${c}`));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to load context categories: ${message}`);
  }
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function workspaceRoot() {
  return path.resolve(__dirname, '..');
}

function repoIdentifier() {
  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: workspaceRoot(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    }).trim();
    if (remote) return remote;
  } catch {}
  return workspaceRoot();
}

function defaultTraceDbPath() {
  const root = process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support', 'OpenWorkspace', 'traces')
    : path.join(os.homedir(), '.local', 'share', 'openworkspace', 'traces');
  return path.join(root, sha256(repoIdentifier()).slice(0, 24), 'traces.db');
}

function traceDbPath(args) {
  return args.db || process.env.OPENWORKSPACE_TRACE_DB || defaultTraceDbPath();
}

function ensureTraceSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tool_traces (
      id TEXT PRIMARY KEY,
      ts TEXT NOT NULL,
      trace_id TEXT NOT NULL,
      mcp_trace_id TEXT,
      source TEXT NOT NULL,
      tool TEXT NOT NULL,
      task_session TEXT,
      branch TEXT,
      worktree TEXT,
      status TEXT NOT NULL,
      ok INTEGER NOT NULL,
      code TEXT,
      exit_code INTEGER,
      duration_ms INTEGER,
      input_json TEXT,
      resolved_input_json TEXT,
      result_json TEXT,
      stderr TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      total_tokens INTEGER
    );
    CREATE INDEX IF NOT EXISTS tool_traces_ts_idx ON tool_traces(ts);
    CREATE INDEX IF NOT EXISTS tool_traces_trace_id_idx ON tool_traces(trace_id);
    CREATE INDEX IF NOT EXISTS tool_traces_mcp_trace_id_idx ON tool_traces(mcp_trace_id);
    CREATE INDEX IF NOT EXISTS tool_traces_tool_idx ON tool_traces(tool);
    CREATE INDEX IF NOT EXISTS tool_traces_status_idx ON tool_traces(status);
    CREATE INDEX IF NOT EXISTS tool_traces_task_session_idx ON tool_traces(task_session);
    CREATE INDEX IF NOT EXISTS tool_traces_branch_idx ON tool_traces(branch);
  `);
  const columns = db.query('PRAGMA table_info(tool_traces)').all().map((row) => row.name);
  for (const column of ['input_tokens', 'output_tokens', 'total_tokens']) {
    if (!columns.includes(column)) {
      db.exec(`ALTER TABLE tool_traces ADD COLUMN ${column} INTEGER`);
    }
  }
}

function parseJsonField(value) {
  if (typeof value !== 'string' || !value) return null;
  try { return JSON.parse(value); } catch { return value; }
}

function normalizeTraceRow(row, raw) {
  const result = {
    id: row.id,
    ts: row.ts,
    traceId: row.trace_id,
    mcpTraceId: row.mcp_trace_id,
    source: row.source,
    tool: row.tool,
    taskSession: row.task_session,
    branch: row.branch,
    worktree: row.worktree,
    status: row.status,
    ok: Boolean(row.ok),
    code: row.code,
    exitCode: row.exit_code,
    durationMs: row.duration_ms,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
  };
  if (raw) {
    result.input = parseJsonField(row.input_json);
    result.resolvedInput = parseJsonField(row.resolved_input_json);
    result.result = parseJsonField(row.result_json);
    result.stderr = row.stderr;
  }
  return result;
}

async function cmdTrace(args) {
  const dbPath = traceDbPath(args);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath, { create: true });
  try {
    ensureTraceSchema(db);

    const clauses = [];
    const values = [];
    const positionalTraceId = args.positional[1];
    const traceId = args.traceId || positionalTraceId;
    if (traceId) {
      clauses.push('(trace_id = ? OR mcp_trace_id = ?)');
      values.push(traceId, traceId);
    }
    if (args.tool) { clauses.push('tool = ?'); values.push(args.tool); }
    if (args.status && args.status !== 'all') { clauses.push('status = ?'); values.push(args.status); }
    if (args.taskSession) { clauses.push('task_session = ?'); values.push(args.taskSession); }
    if (args.branch) { clauses.push('branch = ?'); values.push(args.branch); }
    if (args.since) { clauses.push('ts >= ?'); values.push(args.since); }
    if (args.until) { clauses.push('ts < ?'); values.push(args.until); }
    if (args.contains) {
      clauses.push('(tool LIKE ? OR code LIKE ? OR stderr LIKE ? OR input_json LIKE ? OR resolved_input_json LIKE ? OR result_json LIKE ?)');
      const needle = `%${args.contains}%`;
      values.push(needle, needle, needle, needle, needle, needle);
    }

    const limit = Number.isFinite(args.limit) && args.limit > 0 ? Math.min(args.limit, 500) : 20;
    const selectSql = [
      'SELECT *',
      'FROM tool_traces',
      clauses.length ? 'WHERE ' + clauses.join(' AND ') : '',
      'ORDER BY ts DESC',
      'LIMIT ?',
    ].filter(Boolean).join('\n');
    const rows = db.query(selectSql)
      .all(...values, limit)
      .map((row) => normalizeTraceRow(row, Boolean(args.raw)));

    const payload = { dbPath, count: rows.length, rows };
    if (args.json) { writeStdout(JSON.stringify(payload, null, 2)); return; }
    if (rows.length === 0) {
      writeStdout(`no trace rows found in ${dbPath}`);
      return;
    }
    writeStdout(`${rows.length} trace row(s) from ${dbPath}\n`);
    rows.forEach((row, index) => {
      const ok = row.ok ? 'ok' : row.status;
      const branch = row.branch ? ` branch=${row.branch}` : '';
      const tokens = Number.isFinite(row.totalTokens) ? ` tokens=${row.totalTokens}` : '';
      writeStdout(`${index + 1}. ${row.ts} ${row.traceId} ${row.tool} ${ok} code=${row.code || ''} duration=${row.durationMs || 0}ms${branch}${tokens}`);
    });
  } finally {
    db.close();
  }
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || args.positional.length === 0) { printHelp(); return; }
  
    const command = args.positional[0];
    if (command === 'trace') {
      await cmdTrace(args);
      return;
    }
  
    const env = loadEnv();
    if (!env.url || !env.key) {
      throw new Error('missing SUPABASE_URL or SUPABASE_KEY. set in packages/workspace/.env or environment.');
    }
  
    switch (command) {
      case 'search':
        if (!args.positional[1]) throw new Error('usage: bun run context -- search <keyword>');
        await cmdSearch(env, args.positional[1], args);
        break;
      case 'find':
        if (!args.positional[1]) throw new Error('usage: bun run context -- find <keyword>');
        await cmdFind(env, args.positional[1], args);
        break;
      case 'get':
        if (!args.positional[1] || !args.positional[2]) throw new Error('usage: bun run context -- get <number> <keyword>');
        await cmdGet(env, parseInt(args.positional[1], 10), args.positional[2], args);
        break;
      case 'list':
        await cmdList(env, args.positional[1] || args.category, args);
        break;
      case 'save':
        if (!args.positional[1]) throw new Error('usage: bun run context -- save <title> <file>');
        await cmdSave(env, args.positional[1], args.positional[2], args);
        break;
      case 'categories':
        await cmdCategories(env, args);
        break;
      default:
        // treat as search shorthand
        await cmdSearch(env, command, args);
    }
  
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`context main failed: ${message}`);
  }
}

main().catch((err) => {
  writeStderr(err.message);
  process.exit(1);
});
