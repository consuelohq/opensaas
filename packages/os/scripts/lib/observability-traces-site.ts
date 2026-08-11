import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const canonicalAssetDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../assets/vendor/observability-traces-v38',
);

const canonicalAsset = (name: string): string =>
  fs.readFileSync(path.join(canonicalAssetDir, name), 'utf8');

const productionHistoryTransport = `<script id="consuelo-trace-history-transport">
(()=>{const historyRoute='/gateway/traces/recent';const snapshotRoute='/trace-burn-intelligence/live-traces.json';const snapshotUrl=historyRoute+'?direction=older&cursor=latest&limit=100&site=trace-burn-intelligence&sourceMode=local-networked&includeRawPayload=true';const allowed=(url)=>url===snapshotRoute||url===historyRoute||url.startsWith(historyRoute+'?');window.__consueloTraceHistoryTransport={fetchJson(url){if(!allowed(url))return Promise.reject(new Error('Trace history route is not allowed.'));const requestUrl=url===snapshotRoute?snapshotUrl:url;return fetch(requestUrl,{cache:'no-store',credentials:'same-origin',headers:{accept:'application/json'}}).then(response=>response.json().then(payload=>{if(!response.ok||payload?.ok===false)throw new Error(payload?.error?.message||'Trace history request failed.');return url===snapshotRoute?(payload?.data??{rows:[],failures:[]}):payload;}));}};})();
</script>`;

function replaceExactlyOnce(
  html: string,
  pattern: RegExp,
  replacement: string,
  label: string,
): string {
  const matches = html.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)) ?? [];
  if (matches.length !== 1) {
    throw new Error(`Canonical Trace Burn template expected exactly one ${label}; found ${matches.length}.`);
  }
  return html.replace(pattern, () => replacement);
}

function inlineStyle(html: string, sourceHref: string, id: string, css: string): string {
  return replaceExactlyOnce(
    html,
    new RegExp(`<link\\s+rel=["']stylesheet["']\\s+href=["']${escapeRegExp(sourceHref)}["']\\s*\\/?>(?:</link>)?`, 'i'),
    `<style id="${id}">${css.replaceAll('</style', '<\\/style')}</style>`,
    sourceHref,
  );
}

function inlineScript(
  html: string,
  sourceSrc: string,
  id: string,
  javascript: string,
  module = false,
): string {
  const type = module ? ' type="module"' : '';
  return replaceExactlyOnce(
    html,
    new RegExp(`<script(?:\\s+type=["']module["'])?\\s+src=["']${escapeRegExp(sourceSrc)}["']\\s*><\\/script>`, 'i'),
    `<script id="${id}"${type}>${javascript.replaceAll('</script', '<\\/script')}</script>`,
    sourceSrc,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildObservabilityTracesSite(): string {
  let html = canonicalAsset('template.html');

  html = inlineStyle(
    html,
    '/trace-burn-intelligence/_astro/index@_@astro.footerclock.css',
    'trace-burn-v38-base',
    canonicalAsset('base.css'),
  );
  html = inlineStyle(
    html,
    '/trace-burn-intelligence/_astro/trace-mobile-scroll-fix-v9.css',
    'trace-burn-v38-mobile',
    canonicalAsset('mobile.css'),
  );
  html = inlineStyle(
    html,
    '/trace-burn-intelligence/_astro/trace-inspector-v38.css',
    'trace-burn-v38-inspector',
    canonicalAsset('inspector.css'),
  );

  html = inlineScript(
    html,
    '/trace-burn-intelligence/_astro/trace-table-overview-v22.js',
    'trace-burn-v38-table-overview',
    canonicalAsset('table-overview.js'),
    true,
  );
  html = inlineScript(
    html,
    '/trace-burn-intelligence/_astro/vendor-gsap-3.15.0.min.js',
    'trace-burn-v38-gsap',
    canonicalAsset('gsap.js'),
  );
  html = inlineScript(
    html,
    '/trace-burn-intelligence/_astro/trace-gsap-scroll-v6.js',
    'trace-burn-v38-scroll',
    canonicalAsset('scroll.js'),
  );
  html = inlineScript(
    html,
    '/trace-burn-intelligence/_astro/trace-inspector-v38.js',
    'trace-burn-v38-inspector-runtime',
    canonicalAsset('inspector.js'),
    true,
  );

  html = replaceExactlyOnce(
    html,
    /<script\s+id=["']consuelo-trace-history-transport["'][^>]*>[\s\S]*?<\/script>/i,
    productionHistoryTransport,
    'trusted trace history transport',
  );

  return html;
}
