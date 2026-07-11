#!/usr/bin/env bun

import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const INSPECTOR_VERSION = 'v29';
export const INSPECTOR_CSS_HREF = `/trace-burn-intelligence/_astro/trace-inspector-${INSPECTOR_VERSION}.css`;
export const INSPECTOR_SCRIPT_SRC = `/trace-burn-intelligence/_astro/trace-inspector-${INSPECTOR_VERSION}.js`;
export const TRUSTED_TRACE_HISTORY_TRANSPORT_SCRIPT = `<script id="consuelo-trace-history-transport">(()=>{const route='/gateway/traces/recent';const normalizeError=error=>error instanceof Error?error:new Error('Trace history request failed.');window.__consueloTraceHistoryTransport={fetchJson(url){if(typeof url!=='string'||!url.startsWith(route+'?'))return Promise.reject(new Error('Trace history route is not allowed.'));return fetch(url,{credentials:'same-origin',headers:{accept:'application/json'}}).then(response=>response.json().then(payload=>({response,payload}))).then(({response,payload})=>{if(!response.ok){const message=payload&&payload.error&&typeof payload.error.message==='string'?payload.error.message:'Trace history request failed.';throw new Error(message)}return payload},error=>{throw normalizeError(error)})}}})()</script>`;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultArchiveRoot = resolve(
  process.cwd(),
  'packages/consuelo-design/upstream/open-design/.od/consuelo/archive/artifacts/trace-burn-intelligence',
);

export function patchTraceInspectorHtml(html: string): string {
  const withoutOldCss = html.replace(
    /<link[^>]+href=["'][^"']*trace-inspector-v\d+\.css["'][^>]*>\s*/g,
    '',
  );
  const withoutOldJs = withoutOldCss.replace(
    /<script[^>]+src=["'][^"']*trace-inspector-v\d+\.js["'][^>]*><\/script>\s*/g,
    '',
  );
  const withoutOldTransport = withoutOldJs.replace(
    /<script[^>]*id=["']consuelo-trace-history-transport["'][^>]*>[\s\S]*?<\/script>\s*/gi,
    '',
  );
  const cssTag = `<link rel="stylesheet" href="${INSPECTOR_CSS_HREF}">`;
  const scriptTag = `<script type="module" src="${INSPECTOR_SCRIPT_SRC}"></script>`;
  const withCss = withoutOldTransport.includes(INSPECTOR_CSS_HREF)
    ? withoutOldTransport
    : withoutOldTransport.replace('</head>', `${cssTag}</head>`);
  const withTransport = withCss.replace(
    '</body>',
    `${TRUSTED_TRACE_HISTORY_TRANSPORT_SCRIPT}</body>`,
  );
  return withTransport.includes(INSPECTOR_SCRIPT_SRC)
    ? withTransport
    : withTransport.replace('</body>', `${scriptTag}</body>`);
}

export async function deployTraceInspector(
  input: {
    archiveRoot?: string;
    dryRun?: boolean;
  } = {},
): Promise<{
  archiveRoot: string;
  indexPath: string;
  cssPath: string;
  scriptPath: string;
  changed: boolean;
}> {
  const archiveRoot = resolve(input.archiveRoot ?? defaultArchiveRoot);
  const indexPath = join(archiveRoot, 'index.html');
  const astroDir = join(archiveRoot, '_astro');
  await access(indexPath);

  const html = await readFile(indexPath, 'utf8');
  const patched = patchTraceInspectorHtml(html);
  const cssPath = join(astroDir, basename(INSPECTOR_CSS_HREF));
  const scriptPath = join(astroDir, basename(INSPECTOR_SCRIPT_SRC));
  const changed = patched !== html;
  if (input.dryRun)
    return { archiveRoot, indexPath, cssPath, scriptPath, changed };

  await mkdir(astroDir, { recursive: true });
  const temp = await mkdtemp(join(tmpdir(), 'trace-inspector-build-'));
  try {
    const result = await Bun.build({
      entrypoints: [join(scriptDir, 'browser.ts')],
      outdir: temp,
      target: 'browser',
      format: 'esm',
      minify: false,
      sourcemap: 'none',
    });
    if (!result.success) {
      throw new Error(
        result.logs.map((log) => log.message).join('\n') ||
          'trace inspector browser build failed',
      );
    }
    const built = result.outputs.find((output) => output.path.endsWith('.js'));
    if (!built)
      throw new Error(
        'trace inspector browser build produced no JavaScript output',
      );

    const backup = join(
      archiveRoot,
      `index.before-trace-inspector-${INSPECTOR_VERSION}.html`,
    );
    try {
      await access(backup);
    } catch {
      await copyFile(indexPath, backup);
    }
    await writeFile(scriptPath, await built.text());
    await copyFile(join(scriptDir, 'inspector.css'), cssPath);
    if (changed) await writeFile(indexPath, patched);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }

  return { archiveRoot, indexPath, cssPath, scriptPath, changed };
}

function parseArgs(argv: string[]): { archiveRoot?: string; dryRun: boolean } {
  const result: { archiveRoot?: string; dryRun: boolean } = { dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') result.dryRun = true;
    else if (arg === '--archive-root') {
      const value = argv[++index];
      if (!value) throw new Error('--archive-root requires a path');
      result.archiveRoot = value;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return result;
}

if (import.meta.main) {
  deployTraceInspector(parseArgs(process.argv.slice(2)))
    .then((result) =>
      process.stdout.write(
        `${JSON.stringify({ ok: true, ...result }, null, 2)}\n`,
      ),
    )
    .catch((error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    });
}
