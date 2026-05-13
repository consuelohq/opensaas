#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TEMP_ROOT = path.join(os.tmpdir(), 'consuelo-research');
const KEEP_ROOT = path.join(os.homedir(), 'Documents', 'consuelo-research');
const EXCERPT_LIMIT = 20000;

const out = (value = '') => process.stdout.write(`${value}\n`);
const err = (value = '') => process.stderr.write(`${value}\n`);

function help() {
  out([
    'usage: bun run research:ingest -- <url-or-file> [options]',
    '',
    'generate a research packet from a video, podcast, paper, web page, or local media file.',
    '',
    'options:',
    '  --question <text>       include a research question in the packet',
    '  --mode <mode>           quick, standard, deep (default: standard)',
    '  --visual                extract slides/frames with summarize',
    '  --slides-max <count>    max slides/frames when --visual is set',
    '  --video-mode <mode>     auto, transcript, understand (default: auto)',
    '  --keep                  write to ~/Documents/consuelo-research',
    '  --out-dir <path>        override output root',
    '  --summarize-bin <path>  summarize executable',
    '  --context-title <text>  context title for autosave',
    '  --context-category <name> context category (default: research)',
    '  --no-context-save       skip automatic context save',
    '  --json                  print manifest JSON',
    '  --dry-run               print planned command only',
    `default output root: ${TEMP_ROOT}`,
    `durable output root with --keep: ${KEEP_ROOT}`,
  ].join('\n'));
}

function readValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

function choice(value, allowed, flag) {
  if (allowed.includes(value)) return value;
  throw new Error(`${flag} must be one of: ${allowed.join(', ')}`);
}

function positiveInteger(value, flag) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer`);
  return parsed;
}

function parseArgs(argv) {
  const options = { mode: 'standard', visual: false, keep: false, json: false, dryRun: false, summarizeBin: 'summarize', videoMode: 'auto', contextCategory: 'research', contextSave: true };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { help(); process.exit(0); }
    else if (arg === '--question') options.question = readValue(argv, ++i, arg);
    else if (arg === '--mode') options.mode = choice(readValue(argv, ++i, arg), ['quick', 'standard', 'deep'], arg);
    else if (arg === '--visual') options.visual = true;
    else if (arg === '--slides-max') options.slidesMax = positiveInteger(readValue(argv, ++i, arg), arg);
    else if (arg === '--video-mode') options.videoMode = choice(readValue(argv, ++i, arg), ['auto', 'transcript', 'understand'], arg);
    else if (arg === '--keep') options.keep = true;
    else if (arg === '--out-dir') options.outDir = readValue(argv, ++i, arg);
    else if (arg === '--summarize-bin') options.summarizeBin = readValue(argv, ++i, arg);
    else if (arg === '--context-title') options.contextTitle = readValue(argv, ++i, arg);
    else if (arg === '--context-category') options.contextCategory = readValue(argv, ++i, arg);
    else if (arg === '--no-context-save') options.contextSave = false;
    else if (arg === '--json') options.json = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--')) throw new Error(`unknown flag: ${arg}`);
    else if (!options.source) options.source = arg;
    else throw new Error(`unexpected positional argument: ${arg}`);
  }

  if (!options.source) throw new Error('missing source. run with --help for usage.');
  return options;
}

function sourceKind(source) {
  if (source === '-') return 'stdin';
  if (source.startsWith('http://') || source.startsWith('https://')) return 'url';
  return 'file';
}

function slug(source) {
  const name = source.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'source';
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const hash = crypto.createHash('sha256').update(source).digest('hex').slice(0, 8);
  return `${stamp}-${name}-${hash}`;
}

function root(options) {
  if (options.outDir) return path.resolve(options.outDir);
  if (options.keep) return KEEP_ROOT;
  return TEMP_ROOT;
}

function lengthFor(mode) {
  return mode === 'quick' ? 'medium' : mode === 'deep' ? 'xxl' : 'xl';
}

function slidesFor(mode) {
  return mode === 'quick' ? 4 : mode === 'deep' ? 16 : 8;
}

function contextTitle(options) {
  if (options.contextTitle) return options.contextTitle;

  const titleSource = options.source
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .slice(0, 90) || 'source';

  return `Research Bundle: ${titleSource}`;
}

function readTextFile(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`expected research bundle file missing: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function buildContextBundle(manifest) {
  const packetText = readTextFile(manifest.packetPath);
  const extractedText = readTextFile(manifest.extractedPath);
  const manifestText = readTextFile(manifest.manifestPath);

  return [
    `# ${manifest.context.title}`,
    '',
    `Source: ${manifest.source}`,
    `Created: ${manifest.createdAt}`,
    `Bundle path: ${manifest.outputDir}`,
    '',
    '---',
    '',
    '## packet.md',
    '',
    packetText.trimEnd(),
    '',
    '---',
    '',
    '## extracted.md',
    '',
    extractedText.trimEnd(),
    '',
    '---',
    '',
    '## manifest.json',
    '',
    '```json',
    manifestText.trimEnd(),
    '```',
    '',
  ].join('\n');
}

function saveContextBundle(options, manifest) {
  if (!manifest.context.enabled) return null;

  const bundleText = buildContextBundle(manifest);
  fs.writeFileSync(manifest.context.bundlePath, bundleText, 'utf8');

  const contextArgs = [
    'run',
    'context',
    '--',
    'save',
    manifest.context.title,
    manifest.context.bundlePath,
    '--category',
    manifest.context.category,
  ];

  const result = spawnSync('bun', contextArgs, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  });

  if (result.error) throw new Error(`failed to run context save: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`context save failed with exit code ${result.status}: ${result.stderr || result.stdout}`);
  }

  return {
    command: ['bun', ...contextArgs],
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status,
  };
}

function summarizeArgs(options, dir, kind) {
  const args = [options.source, '--json', '--plain', '--metrics', 'detailed', '--format', 'md', '--video-mode', options.videoMode];

  if (kind === 'extract') args.push('--extract');
  else {
    args.push('--length', lengthFor(options.mode));
    if (options.question) args.push('--prompt', `Create a research packet summary focused on: ${options.question}`);
  }

  if (options.visual) {
    args.push('--slides', '--slides-ocr', '--slides-debug', '--slides-dir', path.join(dir, 'slides'), '--slides-max', String(options.slidesMax || slidesFor(options.mode)));
  }

  return args;
}

function run(options, dir, kind) {
  const args = summarizeArgs(options, dir, kind);
  const result = spawnSync(options.summarizeBin, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 100 });
  if (result.error) throw new Error(`failed to run ${options.summarizeBin}: ${result.error.message}`);
  return { kind, args, status: result.status, signal: result.signal, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function writeRaw(dir, runResult) {
  const rawDir = path.join(dir, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });
  fs.writeFileSync(path.join(rawDir, `${runResult.kind}.stdout`), runResult.stdout, 'utf8');
  fs.writeFileSync(path.join(rawDir, `${runResult.kind}.stderr`), runResult.stderr, 'utf8');
}

function parseJson(raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (_error) {
    return null;
  }
}

const SKIPPED_TEXT_SEARCH_KEYS = new Set(['input', 'env', 'metrics', 'diagnostics', 'prompt']);
const TEXT_KEYS = new Set(['content', 'text', 'markdown', 'transcript', 'extracted', 'extractedContent', 'summary', 'output', 'result']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function textAtPath(value, segments) {
  let current = value;
  for (const segment of segments) {
    if (!current || typeof current !== 'object') return null;
    current = current[segment];
  }
  return isNonEmptyString(current) ? current.trim() : null;
}

function preferredText(parsed, kind) {
  const extractPaths = [
    ['extracted', 'content'],
    ['extracted', 'text'],
    ['extracted', 'markdown'],
    ['extractedContent'],
    ['content'],
    ['text'],
    ['transcript'],
  ];
  const summaryPaths = [
    ['summary'],
    ['output'],
    ['result'],
    ['content'],
    ['text'],
    ['markdown'],
    ['extracted', 'content'],
    ['extracted', 'text'],
    ['transcript'],
  ];

  for (const pathSegments of kind === 'summary' ? summaryPaths : extractPaths) {
    const found = textAtPath(parsed, pathSegments);
    if (found) return found;
  }
  return null;
}

function findText(value) {
  if (!value || typeof value !== 'object') return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findText(item);
      if (found) return found;
    }
    return null;
  }

  for (const [key, child] of Object.entries(value)) {
    if (SKIPPED_TEXT_SEARCH_KEYS.has(key)) continue;
    if (TEXT_KEYS.has(key) && isNonEmptyString(child)) return child.trim();
  }

  for (const [key, child] of Object.entries(value)) {
    if (SKIPPED_TEXT_SEARCH_KEYS.has(key)) continue;
    const found = findText(child);
    if (found) return found;
  }

  return null;
}

function extractedText(runResult) {
  const parsed = parseJson(runResult.stdout);
  return (parsed && (preferredText(parsed, runResult.kind) || findText(parsed))) || runResult.stdout.trim();
}

function packet(manifest, text) {
  const excerpt = text.length > EXCERPT_LIMIT ? `${text.slice(0, EXCERPT_LIMIT)}\n\n[truncated in packet; full text is in ${manifest.extractedPath}]` : text;
  const cleanup = manifest.temporary
    ? 'Output is under the OS temp directory and is expected to be cleaned by the operating system after restart. Delete the run directory when done.'
    : 'Output is durable because --keep or --out-dir was used.';
  const visual = manifest.visual ? `Visual extraction enabled. Slides/frames directory: ${manifest.slidesDir}` : 'Visual extraction disabled.';
  const rawLine = manifest.selectedRun === 'extract'
    ? `- raw extract stdout/stderr: ${manifest.raw.extractStdout}, ${manifest.raw.extractStderr}`
    : `- raw summary stdout/stderr: ${manifest.raw.summaryStdout}, ${manifest.raw.summaryStderr}`;

  const lines = [
    '# Research Packet',
    '',
    `source: ${manifest.source}`,
    `created: ${manifest.createdAt}`,
    `mode: ${manifest.mode}`,
    `selected run: ${manifest.selectedRun}`,
    `fallback used: ${manifest.fallbackUsed ? 'yes' : 'no'}`,
    `output directory: ${manifest.outputDir}`,
    '',
    '## Question',
    '',
    manifest.question || 'No specific question provided.',
    '',
    '## Cleanup',
    '',
    cleanup,
    '',
    visual,
    '',
    '## Files',
    '',
    `- manifest: ${manifest.manifestPath}`,
    `- extracted text: ${manifest.extractedPath}`,
    `- summary json: ${manifest.summaryJsonPath}`,
    rawLine,
  ];

  if (manifest.fallbackUsed) lines.push(`- raw failed extract stderr: ${manifest.raw.extractStderr}`);
  lines.push('', '## How to use', '', 'Give ChatGPT or a workspace agent this packet plus `extracted.md` when the full source text matters.', '', '## Extracted source material', '', excerpt || '_No extracted text captured._', '');

  return lines.join('\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const kind = sourceKind(options.source);
  if (kind === 'file' && !fs.existsSync(options.source)) throw new Error(`source file not found: ${options.source}`);

  const outDir = path.join(root(options), slug(options.source));

  if (options.dryRun) {
    const plan = {
      dryRun: true,
      source: options.source,
      outputDir: outDir,
      temporary: !options.keep && !options.outDir,
      extractArgs: [options.summarizeBin, ...summarizeArgs(options, outDir, 'extract')],
      summaryFallbackArgs: [options.summarizeBin, ...summarizeArgs(options, outDir, 'summary')],
      contextSave: {
        enabled: options.contextSave,
        title: contextTitle(options),
        category: options.contextCategory,
        bundlePath: path.join(outDir, 'context-bundle.md'),
      },
    };
    out(options.json ? JSON.stringify(plan, null, 2) : outDir);
    return;
  }

  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const extract = run(options, outDir, 'extract');
  writeRaw(outDir, extract);

  let selected = extract;
  let fallbackUsed = false;
  if (extract.status !== 0 || !extract.stdout.trim()) {
    const summary = run(options, outDir, 'summary');
    writeRaw(outDir, summary);
    selected = summary;
    fallbackUsed = true;
  }

  if (selected.status !== 0 || !selected.stdout.trim()) throw new Error(`summarize produced no usable output. see ${path.join(outDir, 'raw')}`);

  const text = extractedText(selected);
  const manifest = {
    source: options.source,
    sourceKind: kind,
    mode: options.mode,
    question: options.question,
    visual: options.visual,
    keep: options.keep,
    temporary: !options.keep && !options.outDir,
    createdAt: new Date().toISOString(),
    outputDir: outDir,
    packetPath: path.join(outDir, 'packet.md'),
    extractedPath: path.join(outDir, 'extracted.md'),
    manifestPath: path.join(outDir, 'manifest.json'),
    summaryJsonPath: path.join(outDir, 'summary.json'),
    slidesDir: options.visual ? path.join(outDir, 'slides') : undefined,
    context: {
      enabled: options.contextSave,
      title: contextTitle(options),
      category: options.contextCategory,
      bundlePath: path.join(outDir, 'context-bundle.md'),
    },
    selectedRun: selected.kind,
    fallbackUsed,
    summarizeBin: options.summarizeBin,
    summarizeArgs: selected.args,
    raw: {
      extractStdout: path.join(outDir, 'raw', 'extract.stdout'),
      extractStderr: path.join(outDir, 'raw', 'extract.stderr'),
      summaryStdout: fallbackUsed ? path.join(outDir, 'raw', 'summary.stdout') : undefined,
      summaryStderr: fallbackUsed ? path.join(outDir, 'raw', 'summary.stderr') : undefined,
    },
  };

  fs.writeFileSync(manifest.extractedPath, `${text}\n`, 'utf8');
  fs.writeFileSync(manifest.summaryJsonPath, `${JSON.stringify({ selectedRun: selected.kind, fallbackUsed, status: selected.status, parsed: parseJson(selected.stdout), rawStdout: parseJson(selected.stdout) ? undefined : selected.stdout }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(manifest.packetPath, packet(manifest, text), 'utf8');
  fs.writeFileSync(manifest.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  saveContextBundle(options, manifest);

  out(options.json ? JSON.stringify(manifest, null, 2) : manifest.packetPath);
}

try {
  main();
} catch (error) {
  err(error instanceof Error ? error.message : 'unknown research ingest failure');
  process.exit(1);
}
