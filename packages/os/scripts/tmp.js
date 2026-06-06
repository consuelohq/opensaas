#!/usr/bin/env bun

// tmp.js — write exact content to temp files, no mangling
// usage: bun run tmp -- <command> [options]

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const TMP_DIR = path.join(os.tmpdir(), 'opensaas-handoffs');

function writeStdout(s = '') { process.stdout.write(s + '\n'); }
function writeStderr(s = '') { process.stderr.write(s + '\n'); }

function ensureDir() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

function printHelp() {
  const lines = [
    'usage: bun run tmp -- <command> [options]',
    '',
    'write exact content to temp files. no trimming, no reformatting.',
    `files go to: ${TMP_DIR}/`,
    '',
    'commands:',
    '  write <name> <content>     write content to <name>.md',
    '  write <name> --stdin       read from stdin',
    '  read <name>                read a temp file',
    '  list                       list temp files',
    '  path <name>                print full path to a temp file',
    '  clean                      remove all temp files',
    '  save <name> <title>        write temp file to supabase memories',
    '  checklist <name> [items]   create a checklist. add items and check off as you go.',
    '',
    'options:',
    '  --ext <ext>                file extension (default: md)',
    '  --help                     show this help',
    '',
    'examples:',
    '  bun run tmp -- write handoff "# dialer handoff notes"',
    '  cat notes.md | bun run tmp -- write handoff --stdin',
    '  bun run tmp -- read handoff',
    '  bun run tmp -- path handoff',
    '  bun run tmp -- save handoff "dialer handoff notes"',
    '  bun run tmp -- list',
    '  bun run tmp -- clean',
  ];
  lines.forEach((l) => writeStdout(l));
}

function parseArgs(argv) {
  const args = { positional: [], ext: 'md' };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--stdin': args.stdin = true; break;
      case '--ext': args.ext = argv[++i]; break;
      case '--help': args.help = true; break;
      default:
        if (argv[i].startsWith('--')) throw new Error(`unknown flag: ${argv[i]}`);
        args.positional.push(argv[i]);
    }
  }
  return args;
}

function filePath(name, ext) {
  // sanitize name
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, '-');
  return path.join(TMP_DIR, `${safe}.${ext}`);
}

function atomicWrite(dest, content) {
  const tmpPath = dest + '.tmp.' + crypto.randomUUID().slice(0, 8);
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, dest);
  const stat = fs.statSync(dest);
  return { path: dest, bytes: stat.size };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function cmdWrite(name, content, args) {
  ensureDir();
  let data;
  if (args.stdin) {
    data = await readStdin();
  } else if (content) {
    data = content;
  } else {
    throw new Error('provide content as argument or use --stdin');
  }

  const dest = filePath(name, args.ext);
  const result = atomicWrite(dest, data);
  writeStdout(`${result.path}  (${result.bytes} bytes)`);
}

function cmdRead(name, args) {
  const fp = filePath(name, args.ext);
  if (!fs.existsSync(fp)) {
    // try finding by prefix
    ensureDir();
    const files = fs.readdirSync(TMP_DIR).filter((f) => f.startsWith(name));
    if (files.length === 1) {
      writeStdout(fs.readFileSync(path.join(TMP_DIR, files[0]), 'utf8'));
      return;
    }
    throw new Error(`not found: ${fp}`);
  }
  writeStdout(fs.readFileSync(fp, 'utf8'));
}

function cmdPath(name, args) {
  writeStdout(filePath(name, args.ext));
}

function cmdList() {
  ensureDir();
  const files = fs.readdirSync(TMP_DIR).sort();
  if (files.length === 0) {
    writeStdout('no temp files');
    return;
  }
  writeStdout(`${TMP_DIR}/\n`);
  for (const f of files) {
    const stat = fs.statSync(path.join(TMP_DIR, f));
    const age = Math.round((Date.now() - stat.mtimeMs) / 60000);
    writeStdout(`  ${f}  (${stat.size} bytes, ${age}m ago)`);
  }
}

function cmdClean() {
  if (!fs.existsSync(TMP_DIR)) {
    writeStdout('nothing to clean');
    return;
  }
  const files = fs.readdirSync(TMP_DIR);
  for (const f of files) {
    fs.unlinkSync(path.join(TMP_DIR, f));
  }
  writeStdout(`removed ${files.length} file(s) from ${TMP_DIR}`);
}

async function cmdSave(name, title, args) {
  const fp = filePath(name, args.ext);
  if (!fs.existsSync(fp)) throw new Error(`not found: ${fp}`);

  // shell out to context save
  const { execFileSync } = require('child_process');
  const scriptPath = path.join(__dirname, 'context.js');
  const result = execFileSync('bun', [scriptPath, 'save', title, fp, '--category', 'handoff'], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  writeStdout(result.trim());
}

function cmdChecklist(name, items, args) {
  ensureDir();
  const dest = filePath(name, args.ext);
  const lines = [`# ${name.replace(/-/g, ' ')}`, '', 'add to this list and check off as you go. when every box is checked, you are done.', ''];
  for (const item of items) {
    lines.push(`- [ ] ${item}`);
  }
  if (items.length === 0) {
    lines.push('- [ ] ');
  }
  lines.push('');
  const result = atomicWrite(dest, lines.join('\n'));
  writeStdout(`${result.path}  (${result.bytes} bytes)`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.positional.length === 0) { printHelp(); return; }

  const command = args.positional[0];

  switch (command) {
    case 'write':
      if (!args.positional[1]) throw new Error('usage: bun run tmp -- write <name> <content>');
      await cmdWrite(args.positional[1], args.positional.slice(2).join(' '), args);
      break;
    case 'read':
      if (!args.positional[1]) throw new Error('usage: bun run tmp -- read <name>');
      cmdRead(args.positional[1], args);
      break;
    case 'path':
      if (!args.positional[1]) throw new Error('usage: bun run tmp -- path <name>');
      cmdPath(args.positional[1], args);
      break;
    case 'list':
    case 'ls':
      cmdList();
      break;
    case 'clean':
      cmdClean();
      break;
    case 'save':
      if (!args.positional[1] || !args.positional[2]) throw new Error('usage: bun run tmp -- save <name> <title>');
      await cmdSave(args.positional[1], args.positional[2], args);
      break;
    case 'checklist':
      if (!args.positional[1]) throw new Error('usage: bun run tmp -- checklist <name> [item1] [item2] ...');
      cmdChecklist(args.positional[1], args.positional.slice(2), args);
      break;
    default:
      throw new Error(`unknown command: ${command}. run --help for usage.`);
  }
}

main().catch((err) => {
  writeStderr(err.message);
  process.exit(1);
});
