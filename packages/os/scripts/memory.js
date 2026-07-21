#!/usr/bin/env bun

// memory.js — search and save project memory in the local Consuelo runtime database.
// usage: bun run memory -- <command> [options]

const fs = require('node:fs');
const path = require('node:path');
const { Database } = require('bun:sqlite');

const { ensureRuntimePaths } = require('./lib/runtime-state.ts');
const { resolveCanonicalTraceDbPath } = require('./lib/trace-persistence.ts');

function writeStdout(value = '') { process.stdout.write(String(value) + '\n'); }
function writeStderr(value = '') { process.stderr.write(String(value) + '\n'); }

function printHelp() {
  const lines = [
    'usage: bun run memory -- <command> [options]',
    '',
    'search and save project memory in the local Consuelo runtime database.',
    '',
    'commands:',
    '  search <keyword>       search memories by content',
    '  find <keyword>         search memories by title',
    '  get <n> <keyword>      get full content of result #n from a search',
    '  list [category]        list recent memories, optionally filtered by category',
    '  save <title> <file>    save a file as a memory',
    '  save <title> --text    save inline text from stdin',
    '  categories             list available categories',
    '  trace [trace-id]       inspect local workspace trace rows',
    '',
    'options:',
    '  --category <name>      filter by category',
    '  --limit <n>            max results (default: 10)',
    '  --by-title             use title matching for get',
    '  --trace-id <id>        filter trace rows by trace or MCP trace id',
    '  --tool <name>          filter trace rows by tool',
    '  --status <status>      filter trace rows by status',
    '  --since <iso>          include trace rows at or after this timestamp',
    '  --until <iso>          include trace rows before this timestamp',
    '  --contains <text>      search trace payload fields',
    '  --task-session <id>    filter trace rows by task session',
    '  --branch <name>        filter trace rows by branch',
    '  --raw                  include raw trace payloads',
    '  --db <path>            use an explicit trace SQLite database',
    '  --json                 JSON output',
    '  --help                 show this help',
    '',
    'examples:',
    '  bun run memory -- search dialer',
    '  bun run memory -- find "queue handoff" --category handoff',
    '  bun run memory -- get 1 "queue handoff" --by-title',
    '  bun run memory -- save "dialer architecture" ./notes.md',
    '  bun run memory -- categories',
    '  bun run memory -- trace --status error --limit 20 --json',
  ];
  lines.forEach(writeStdout);
}

function parseArgs(argv) {
  const args = { limit: 10, positional: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--category': args.category = argv[++index]; break;
      case '--limit': args.limit = Number.parseInt(argv[++index], 10); break;
      case '--json': args.json = true; break;
      case '--text': args.text = true; break;
      case '--by-title': args.byTitle = true; break;
      case '--trace-id': args.traceId = argv[++index]; break;
      case '--tool': args.tool = argv[++index]; break;
      case '--status': args.status = argv[++index]; break;
      case '--since': args.since = argv[++index]; break;
      case '--until': args.until = argv[++index]; break;
      case '--contains': args.contains = argv[++index]; break;
      case '--task-session': args.taskSession = argv[++index]; break;
      case '--branch': args.branch = argv[++index]; break;
      case '--raw': args.raw = true; break;
      case '--db': args.db = argv[++index]; break;
      case '--help': args.help = true; break;
      default:
        if (arg.startsWith('--')) throw new Error(`unknown flag: ${arg}`);
        args.positional.push(arg);
    }
  }
  if (!Number.isFinite(args.limit) || args.limit <= 0) throw new Error('--limit must be a positive integer');
  return args;
}

function ensureMemorySchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'observation',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS memories_created_at_idx ON memories(created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS memories_category_idx ON memories(category);
    CREATE INDEX IF NOT EXISTS memories_title_idx ON memories(title);
  `);
}

function openMemoryDatabase() {
  const paths = ensureRuntimePaths();
  const db = new Database(paths.dbPath, { create: true });
  ensureMemorySchema(db);
  return { db, dbPath: paths.dbPath };
}

function limitValue(args, fallback = 10) {
  const value = Number.isFinite(args.limit) && args.limit > 0 ? args.limit : fallback;
  return Math.min(value, 500);
}

function memoryRows(db, field, keyword, args, queryLimit = limitValue(args)) {
  if (field !== 'content' && field !== 'title') throw new Error(`unsupported memory search field: ${field}`);
  const hasCategory = Boolean(args.category);
  const statement = field === 'content'
    ? hasCategory
      ? 'SELECT id,title,content,category,created_at,updated_at FROM memories WHERE instr(lower(content), lower(?)) > 0 AND category = ? ORDER BY created_at DESC, id DESC LIMIT ?'
      : 'SELECT id,title,content,category,created_at,updated_at FROM memories WHERE instr(lower(content), lower(?)) > 0 ORDER BY created_at DESC, id DESC LIMIT ?'
    : hasCategory
      ? 'SELECT id,title,content,category,created_at,updated_at FROM memories WHERE instr(lower(title), lower(?)) > 0 AND category = ? ORDER BY created_at DESC, id DESC LIMIT ?'
      : 'SELECT id,title,content,category,created_at,updated_at FROM memories WHERE instr(lower(title), lower(?)) > 0 ORDER BY created_at DESC, id DESC LIMIT ?';
  const values = hasCategory
    ? [keyword, args.category, queryLimit]
    : [keyword, queryLimit];
  return db.query(statement).all(...values);
}

function formatRow(row, index) {
  const category = row.category ? `[${row.category}]` : '';
  const title = row.title || '(untitled)';
  const date = row.created_at ? row.created_at.slice(0, 16).replace('T', ' ') : '';
  const preview = (row.content || '').replace(/\n/g, ' ').slice(0, 500);
  return `${index + 1}. ${category} ${title}  (${date})\n   ${preview}${preview.length >= 500 ? '...' : ''}`;
}

function printHeader(label) {
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  writeStdout(`${label}  (now: ${now})\n`);
}

function cmdSearch(keyword, args) {
  const { db } = openMemoryDatabase();
  try {
    const rows = memoryRows(db, 'content', keyword, args);
    if (args.json) { writeStdout(JSON.stringify(rows, null, 2)); return; }
    if (rows.length === 0) { writeStdout(`no memories found for "${keyword}"`); return; }
    printHeader(`${rows.length} result(s) for "${keyword}"`);
    rows.forEach((row, index) => writeStdout(formatRow(row, index)));
    writeStdout('');
    writeStdout(`tip: bun run memory -- get <number> ${keyword}`);
  } finally {
    db.close();
  }
}

function cmdFind(keyword, args) {
  const { db } = openMemoryDatabase();
  try {
    const rows = memoryRows(db, 'title', keyword, args);
    if (args.json) { writeStdout(JSON.stringify(rows, null, 2)); return; }
    if (rows.length === 0) { writeStdout(`no memories found with title matching "${keyword}"`); return; }
    writeStdout(`${rows.length} result(s) for title "${keyword}":\n`);
    rows.forEach((row, index) => writeStdout(formatRow(row, index)));
    writeStdout('');
    writeStdout(`tip: bun run memory -- get <number> ${keyword} --by-title`);
  } finally {
    db.close();
  }
}

function cmdList(category, args) {
  const { db } = openMemoryDatabase();
  try {
    const rows = category
      ? db.query('SELECT id,title,category,created_at,updated_at FROM memories WHERE category = ? ORDER BY created_at DESC, id DESC LIMIT ?').all(category, limitValue(args))
      : db.query('SELECT id,title,category,created_at,updated_at FROM memories ORDER BY created_at DESC, id DESC LIMIT ?').all(limitValue(args));
    if (args.json) { writeStdout(JSON.stringify(rows, null, 2)); return; }
    if (rows.length === 0) {
      writeStdout(category ? `no memories in category "${category}"` : 'no memories found');
      return;
    }
    const label = category ? `"${category}" memories` : 'recent memories';
    printHeader(`${rows.length} ${label}`);
    rows.forEach((row, index) => {
      const rowCategory = row.category ? `[${row.category}]` : '';
      const date = row.created_at ? row.created_at.slice(0, 16).replace('T', ' ') : '';
      writeStdout(`${index + 1}. ${rowCategory} ${row.title || '(untitled)'}  (${date})`);
    });
  } finally {
    db.close();
  }
}

async function cmdSave(title, source, args) {
  let content;
  if (args.text) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    content = Buffer.concat(chunks).toString('utf8');
  } else if (source && fs.existsSync(source)) {
    content = fs.readFileSync(source, 'utf8');
  } else {
    throw new Error(`file not found: ${source}. use --text to read from stdin.`);
  }

  if (!content.trim()) {
    throw new Error('memory content is required');
  }

  const category = args.category || 'observation';
  const createdAt = new Date().toISOString();
  const { db, dbPath } = openMemoryDatabase();
  try {
    const inserted = db.query('INSERT INTO memories(title, category, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(title, category, content, createdAt, createdAt);
    const payload = {
      id: Number(inserted.lastInsertRowid),
      title,
      category,
      contentLength: content.length,
      created_at: createdAt,
      dbPath,
    };
    if (args.json) { writeStdout(JSON.stringify(payload, null, 2)); return; }
    writeStdout(`saved: "${title}" [${category}] (${content.length} chars)`);
  } finally {
    db.close();
  }
}

function cmdGet(number, keyword, args) {
  const { db } = openMemoryDatabase();
  try {
    const rows = memoryRows(db, args.byTitle ? 'title' : 'content', keyword, args, number);
    const row = rows[number - 1];
    if (!row) { writeStdout(`no result #${number} for "${keyword}"`); return; }
    if (args.json) { writeStdout(JSON.stringify(row, null, 2)); return; }
    const category = row.category ? `[${row.category}]` : '';
    const date = row.created_at ? row.created_at.slice(0, 16).replace('T', ' ') : '';
    writeStdout(`${category} ${row.title}  (${date})\n`);
    writeStdout(row.content || '(empty)');

    const chunkMatch = (row.title || '').match(/\(chunk (\d+)\/(\d+)\)/);
    if (chunkMatch) {
      const current = Number.parseInt(chunkMatch[1], 10);
      const total = Number.parseInt(chunkMatch[2], 10);
      const baseName = row.title.replace(/\s*\(chunk \d+\/\d+\)/, '');
      writeStdout('');
      writeStdout(`--- chunk ${current} of ${total} ---`);
      writeStdout(`tip: bun run memory -- find "${baseName}" --limit ${total}`);
    }
  } finally {
    db.close();
  }
}

function cmdCategories(args) {
  const { db } = openMemoryDatabase();
  try {
    const rows = db.query("SELECT DISTINCT category FROM memories WHERE category IS NOT NULL AND category != '' ORDER BY category").all();
    const categories = rows.map((row) => row.category);
    if (args.json) { writeStdout(JSON.stringify(categories, null, 2)); return; }
    writeStdout('categories:\n');
    categories.forEach((category) => writeStdout(`  ${category}`));
  } finally {
    db.close();
  }
}

function traceDbPath(args) {
  return args.db ? path.resolve(args.db) : resolveCanonicalTraceDbPath();
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
    if (!columns.includes(column)) db.exec(`ALTER TABLE tool_traces ADD COLUMN ${column} INTEGER`);
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

function cmdTrace(args) {
  const dbPath = traceDbPath(args);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath, { create: true });
  try {
    ensureTraceSchema(db);
    const clauses = [];
    const values = [];
    const traceId = args.traceId || args.positional[1];
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
    const rows = db.query([
      'SELECT *',
      'FROM tool_traces',
      clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
      'ORDER BY ts DESC',
      'LIMIT ?',
    ].filter(Boolean).join('\n')).all(...values, limitValue(args, 20)).map((row) => normalizeTraceRow(row, Boolean(args.raw)));
    const payload = { dbPath, count: rows.length, rows };
    if (args.json) { writeStdout(JSON.stringify(payload, null, 2)); return; }
    if (rows.length === 0) { writeStdout(`no trace rows found in ${dbPath}`); return; }
    writeStdout(`${rows.length} trace row(s) from ${dbPath}\n`);
    rows.forEach((row, index) => {
      const status = row.ok ? 'ok' : row.status;
      const branch = row.branch ? ` branch=${row.branch}` : '';
      const tokens = Number.isFinite(row.totalTokens) ? ` tokens=${row.totalTokens}` : '';
      writeStdout(`${index + 1}. ${row.ts} ${row.traceId} ${row.tool} ${status} code=${row.code || ''} duration=${row.durationMs || 0}ms${branch}${tokens}`);
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
    switch (command) {
      case 'search':
        if (!args.positional[1]) throw new Error('usage: bun run memory -- search <keyword>');
        cmdSearch(args.positional[1], args);
        break;
      case 'find':
        if (!args.positional[1]) throw new Error('usage: bun run memory -- find <keyword>');
        cmdFind(args.positional[1], args);
        break;
      case 'get':
        if (!args.positional[1] || !args.positional[2]) throw new Error('usage: bun run memory -- get <number> <keyword>');
        cmdGet(Number.parseInt(args.positional[1], 10), args.positional[2], args);
        break;
      case 'list':
        cmdList(args.positional[1] || args.category, args);
        break;
      case 'save':
        if (!args.positional[1]) throw new Error('usage: bun run memory -- save <title> <file>');
        await cmdSave(args.positional[1], args.positional[2], args);
        break;
      case 'categories':
        cmdCategories(args);
        break;
      case 'trace':
        cmdTrace(args);
        break;
      default:
        cmdSearch(command, args);
    }
  } catch (error) {
    throw error;
  }
}

main().catch((error) => {
  writeStderr(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
