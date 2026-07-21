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

export const INSPECTOR_VERSION = 'v38';
export const TRACE_HISTORY_FETCH_TIMEOUT_MS = 8_000;
export const INSPECTOR_CSS_HREF = `/trace-burn-intelligence/_astro/trace-inspector-${INSPECTOR_VERSION}.css`;
export const INSPECTOR_SCRIPT_SRC = `/trace-burn-intelligence/_astro/trace-inspector-${INSPECTOR_VERSION}.js`;
export const TRACE_INSPECTOR_BOOTSTRAP_MARKUP = `<div class="tiInspector tiInspectorBoot" aria-busy="true"><header class="tiToolbar"><div class="tiToolbarIdentity"><div class="tiHeaderMetrics" aria-label="Branch metrics"><span class="tiHeaderMetric"><small>Branch</small><b>Loading...</b></span></div><div class="tiSelectedMeta">Preparing inspector</div></div></header><div class="tiInspectorBody"><aside class="tiSidebar" aria-label="Branch calls"><section class="tiCallRail"><label class="tiCallSearch"><span></span><input type="search" disabled placeholder="Search tool calls" aria-label="Search tool calls"></label></section></aside><main class="tiPreview" aria-label="Trace details"><div class="tiContent"><section class="tiSummaryHero"><div><span class="tiSummaryStatus">Loading</span><h2>Loading trace...</h2></div></section></div></main></div></div>`;
export const TRACE_TABLE_FOOTER_MARKUP = `<button type="button" data-show-filters>filters</button><span class="trxTraceTotal"><b data-trace-count>0</b> traces</span><button type="button" data-trace-scroll-top hidden>Scroll to top</button>`;
export const TRACE_INSPECTOR_BOOTSTRAP_SCRIPT = `<script id="consuelo-trace-inspector-bootstrap">(()=>{const mount=document.querySelector('[data-inspector]');if(!mount||mount.querySelector('.tiInspector'))return;mount.innerHTML=${JSON.stringify(TRACE_INSPECTOR_BOOTSTRAP_MARKUP)};mount.dataset.traceInspectorBootstrapped=''})()</script>`;
export const TRUSTED_TRACE_HISTORY_TRANSPORT_SCRIPT = `<script id="consuelo-trace-history-transport">(()=>{const historyRoute='/gateway/traces/recent';const snapshotRoute='/trace-burn-intelligence/live-traces.json';const timeoutMs=${TRACE_HISTORY_FETCH_TIMEOUT_MS};const normalizeError=error=>error instanceof Error?error:new Error('Trace data request failed.');window.__consueloTraceHistoryTransport={fetchJson(url){const allowed=typeof url==='string'&&(url===snapshotRoute||url.startsWith(historyRoute+'?'));if(!allowed)return Promise.reject(new Error('Trace data route is not allowed.'));const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),timeoutMs);return fetch(url,{cache:'no-store',credentials:'same-origin',headers:{accept:'application/json'},signal:controller.signal}).then(response=>response.json().then(payload=>({response,payload}))).then(({response,payload})=>{if(!response.ok){const message=payload&&payload.error&&typeof payload.error.message==='string'?payload.error.message:'Trace data request failed.';throw new Error(message)}return payload},error=>{throw normalizeError(error)}).finally(()=>clearTimeout(timeout))}}})()</script>`;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultArchiveRoot = resolve(
  process.cwd(),
  'packages/consuelo-design/upstream/open-design/.od/consuelo/archive/artifacts/trace-burn-intelligence',
);

export function patchTraceInspectorHtml(html: string): string {
  const withFinalInspector = replaceInspectorMountContents(
    html,
    TRACE_INSPECTOR_BOOTSTRAP_MARKUP,
  );
  const withoutRetiredCockpit = removeElementByClass(
    withFinalInspector,
    'screen',
  );
  const withoutLegacyToolbar = removeElementByClass(
    withoutRetiredCockpit,
    'trxToolbar',
  );
  const withFinalFooter = replaceElementContentsByClass(
    withoutLegacyToolbar,
    'trxFooter',
    TRACE_TABLE_FOOTER_MARKUP,
  );
  const withoutLegacyTraceRuntime = withFinalFooter.replace(
    /<script[^>]+src=["'][^"']*index\.astro_astro_type_script_index_0_lang\.trace(?:fix|clickfix)[^"']*\.js["'][^>]*><\/script>\s*/gi,
    '',
  );
  const withoutOldCss = withoutLegacyTraceRuntime.replace(
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
  const withoutOldBootstrap = withoutOldTransport.replace(
    /<script[^>]*id=["']consuelo-trace-inspector-bootstrap["'][^>]*>[\s\S]*?<\/script>\s*/gi,
    '',
  );
  const cssTag = `<link rel="stylesheet" href="${INSPECTOR_CSS_HREF}">`;
  const scriptTag = `<script type="module" src="${INSPECTOR_SCRIPT_SRC}"></script>`;
  const withCss = withoutOldBootstrap.includes(INSPECTOR_CSS_HREF)
    ? withoutOldBootstrap
    : withoutOldBootstrap.replace('</head>', `${cssTag}</head>`);
  const withBootstrap = withCss.replace(
    '</body>',
    `${TRACE_INSPECTOR_BOOTSTRAP_SCRIPT}</body>`,
  );
  const withTransport = withBootstrap.replace(
    '</body>',
    `${TRUSTED_TRACE_HISTORY_TRANSPORT_SCRIPT}</body>`,
  );
  return withTransport.includes(INSPECTOR_SCRIPT_SRC)
    ? withTransport
    : withTransport.replace('</body>', `${scriptTag}</body>`);
}

function replaceInspectorMountContents(html: string, markup: string): string {
  const opening = /<([a-zA-Z][\w:-]*)([^>]*\bdata-inspector\b[^>]*)>/i.exec(
    html,
  );
  if (!opening || opening.index === undefined) return html;
  const tag = opening[1];
  if (!tag) return html;
  const contentStart = opening.index + opening[0].length;
  const tags = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
  tags.lastIndex = contentStart;
  let depth = 1;
  for (let match = tags.exec(html); match; match = tags.exec(html)) {
    const token = match[0];
    if (token.startsWith('</')) depth -= 1;
    else if (!token.endsWith('/>')) depth += 1;
    if (depth !== 0) continue;
    return `${html.slice(0, contentStart)}${markup}${html.slice(match.index)}`;
  }
  return html;
}

function removeElementByClass(html: string, className: string): string {
  return rewriteElementByClass(html, className, '', true);
}

function replaceElementContentsByClass(
  html: string,
  className: string,
  markup: string,
): string {
  return rewriteElementByClass(html, className, markup, false);
}

function rewriteElementByClass(
  html: string,
  className: string,
  markup: string,
  removeElement: boolean,
): string {
  const opening = new RegExp(
    `<([a-zA-Z][\\w:-]*)([^>]*\\bclass\\s*=\\s*["'][^"']*\\b${escapeRegExp(className)}\\b[^"']*["'][^>]*)>`,
    'i',
  ).exec(html);
  if (!opening || opening.index === undefined) return html;
  const tag = opening[1];
  if (!tag) return html;
  const contentStart = opening.index + opening[0].length;
  const tags = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
  tags.lastIndex = contentStart;
  let depth = 1;
  for (let match = tags.exec(html); match; match = tags.exec(html)) {
    const token = match[0];
    if (token.startsWith('</')) depth -= 1;
    else if (!token.endsWith('/>')) depth += 1;
    if (depth !== 0) continue;
    return removeElement
      ? `${html.slice(0, opening.index)}${html.slice(match.index + token.length)}`
      : `${html.slice(0, contentStart)}${markup}${html.slice(match.index)}`;
  }
  return html;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
