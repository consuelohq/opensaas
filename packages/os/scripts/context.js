#!/usr/bin/env bun

// context.js — search and save project context (supabase memories)
// usage: bun run context -- <command> [options]

const fs = require('fs');
const path = require('path');

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
    '',
    'options:',
    '  --category <name>      filter by category',
    '  --limit <n>            max results (default: 10)',
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
  ];
  lines.forEach((l) => writeStdout(l));
}

function parseArgs(argv) {
  const args = { limit: 10, positional: [] };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--category': args.category = argv[++i]; break;
      case '--limit': args.limit = parseInt(argv[++i], 10); break;
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
  const url = new URL(`${env.url}/rest/v1/memories`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const resp = await fetch(url.toString(), {
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
  });
  if (!resp.ok) throw new Error(`supabase ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

async function supabaseInsert(env, data) {
  const resp = await fetch(`${env.url}/rest/v1/memories`, {
    method: 'POST',
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!resp.ok) throw new Error(`supabase ${resp.status}: ${await resp.text()}`);
  return true;
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
}

async function cmdFind(env, keyword, args) {
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
}

async function cmdList(env, category, args) {
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
}

async function cmdSave(env, title, source, args) {
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
  await supabaseInsert(env, { title, category, content });
  writeStdout(`saved: "${title}" [${category}] (${content.length} chars)`);
}


async function cmdGet(env, num, keyword, args) {
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
    writeStdout(`no result #${num} for "${keyword}"`);
    return;
  }

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
}

async function cmdCategories(env) {
  const rows = await supabaseGet(env, {
    select: 'category',
    'order': 'category',
  });
  const cats = [...new Set(rows.map((r) => r.category).filter(Boolean))].sort();
  writeStdout('categories:\n');
  cats.forEach((c) => writeStdout(`  ${c}`));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.positional.length === 0) { printHelp(); return; }

  const env = loadEnv();
  if (!env.url || !env.key) {
    throw new Error('missing SUPABASE_URL or SUPABASE_KEY. set in packages/workspace/.env or environment.');
  }

  const command = args.positional[0];

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
      await cmdCategories(env);
      break;
    default:
      // treat as search shorthand
      await cmdSearch(env, command, args);
  }
}

main().catch((err) => {
  writeStderr(err.message);
  process.exit(1);
});
