#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function writeStdout(value: string): void {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value: string): void {
  process.stderr.write(`${value}\n`);
}
import { validateConsueloReaderHtml } from './validate-consuelo-reader';

export type ReaderTemplate = 'spec' | 'research';
export type LedgerStatus = 'done' | 'current' | 'todo' | 'blocked';

export type ReaderMetadata = {
  status?: string;
  owner?: string;
  date?: string;
  sourceTruth?: string;
  confidence?: string;
};

export type ReaderLink = { label: string; href: string };
export type ReaderCard = { title: string; body: string; tag?: string };
export type ReaderSection = {
  id: string;
  eyebrow?: string;
  title: string;
  body?: string[];
  cards?: ReaderCard[];
};
export type ReaderLedgerGroup = {
  title: string;
  tag?: string;
  items: { status: LedgerStatus; text: string }[];
};

export type ConsueloReaderContent = {
  template: ReaderTemplate;
  title: string;
  eyebrow?: string;
  thesis: string;
  metadata?: ReaderMetadata;
  map?: ReaderLink[];
  sections: ReaderSection[];
  ledgerTitle?: string;
  ledger?: ReaderLedgerGroup[];
  sourceCard?: Record<string, string>;
  learningRoute?: string[];
  footer?: string;
};

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] ?? char);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
}

function defaultMap(content: ConsueloReaderContent): ReaderLink[] {
  if (content.map?.length) return content.map;
  if (content.template === 'research') {
    return [
      { label: 'Source', href: '#source-card' },
      { label: 'ELI5', href: '#eli5' },
      { label: 'Evidence', href: '#evidence' },
      { label: 'Memory', href: '#memory' },
    ];
  }
  return [
    { label: 'Summary', href: '#summary' },
    { label: 'Requirements', href: '#requirements' },
    { label: 'Design', href: '#design' },
    { label: 'Task', href: '#ship-checklist' },
  ];
}

function renderMetadata(metadata: ReaderMetadata | undefined): string {
  const items = [
    ['Status', metadata?.status ?? 'Draft'],
    ['Owner', metadata?.owner ?? 'Ko / Consuelo'],
    ['Date', metadata?.date ?? new Date().toISOString().slice(0, 10)],
    ['Source Truth', metadata?.sourceTruth ?? 'Provided source material'],
  ];
  if (metadata?.confidence) items.push(['Confidence', metadata.confidence]);
  return items.map(([label, value]) => `<div class="meta-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
}

function renderMap(map: ReaderLink[]): string {
  return `<div class="spec-map">${map.map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join('')}</div>`;
}

function renderCards(cards: ReaderCard[] | undefined): string {
  if (!cards?.length) return '';
  return `<div class="grid-3">${cards.map((card) => `<article class="card">${card.tag ? `<p class="tag">${escapeHtml(card.tag)}</p>` : ''}<h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.body)}</p></article>`).join('')}</div>`;
}

function renderSection(section: ReaderSection): string {
  const body = section.body?.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('') ?? '';
  return `<section id="${escapeHtml(section.id)}"><div class="container"><p class="eyebrow">${escapeHtml(section.eyebrow ?? section.title)}</p><h2>${escapeHtml(section.title)}</h2><div class="band">${body}${renderCards(section.cards)}</div></div></section>`;
}

function renderSourceCard(content: ConsueloReaderContent): string {
  if (content.template !== 'research' || !content.sourceCard) return '';
  const rows = Object.entries(content.sourceCard).map(([key, value]) => `<div class="meta-item"><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
  return `<section id="source-card"><div class="container"><p class="eyebrow">Source Card</p><h2>Source grounding</h2><div class="hero-card meta-grid">${rows}</div></div></section>`;
}

function renderLearningRoute(content: ConsueloReaderContent): string {
  if (content.template !== 'research' || !content.learningRoute?.length) return '';
  return `<section id="learning-route"><div class="container"><p class="eyebrow">Learning Route</p><h2>How the lesson moves</h2><div class="spec-map">${content.learningRoute.map((label) => `<a href="#${escapeHtml(slug(label))}">${escapeHtml(label)}</a>`).join('')}</div></div></section>`;
}

function renderLedger(content: ConsueloReaderContent): string {
  if (!content.ledger?.length) return '';
  return `<section id="ship-checklist"><div class="container"><p class="eyebrow">${content.template === 'research' ? 'Learning Ledger' : 'Task Profile'}</p><h2>${escapeHtml(content.ledgerTitle ?? 'Completion ledger')}</h2><div class="ship-checklist">${content.ledger.map((group) => `<article class="checklist-group"><h3>${escapeHtml(group.title)}${group.tag ? ` <span>${escapeHtml(group.tag)}</span>` : ''}</h3><ul class="checklist-items">${group.items.map((item) => `<li><i class="check-box ${escapeHtml(item.status)}">${item.status === 'done' ? '✓' : item.status === 'current' ? '•' : ''}</i><span>${escapeHtml(item.text)}</span></li>`).join('')}</ul></article>`).join('')}</div></div></section>`;
}

function sectionRailLinks(map: ReaderLink[]): string {
  const links = [{ label: 'Hero', href: '#top' }, ...map].slice(0, 9);
  return links.map((item, index) => `<button type="button" data-target="${escapeHtml(item.href)}" aria-label="Go to ${escapeHtml(item.label)}"><span>${String(index + 1).padStart(2, '0')}</span></button>`).join('');
}

export function renderConsueloReader(content: ConsueloReaderContent): string {
  const map = defaultMap(content);
  const shellId = `${content.template}:${slug(content.title)}`;
  const bodySections = [renderSourceCard(content), renderLearningRoute(content), ...content.sections.map(renderSection), renderLedger(content)].filter(Boolean).join('\n');
  const footer = content.footer ?? `Artifact: ${content.title} · Template: ${content.template} · Generated with canonical Consuelo reader shell · /design-wiki`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#FAF7F2" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#202020" media="(prefers-color-scheme: dark)" />
  <title>${escapeHtml(content.title)}</title>
  <link rel="icon" href="https://consuelohq.com/favicon.ico" sizes="48x48" />
  <link rel="icon" href="https://consuelohq.com/favicon.svg" type="image/svg+xml" />
  <link rel="icon" href="https://consuelohq.com/favicon-32x32.png" sizes="32x32" type="image/png" />
  <link rel="apple-touch-icon" href="https://consuelohq.com/apple-touch-icon.png" />
  <style>
    :root { color-scheme: light; --paper:#FAF7F2; --ink:#211b17; --surface:#fffaf3; --muted:#74685e; --line:rgba(33,27,23,.14); --line-strong:rgba(33,27,23,.28); --soft:rgba(33,27,23,.045); --terracotta:#b86143; --forest:#315f53; --gold:#b88945; --mono:"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; --sans:Geist, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    @media (prefers-color-scheme: dark) { :root { color-scheme: dark; --paper:#202020; --ink:#f1f1f1; --surface:#272727; --muted:#b6b6b6; --line:rgba(255,255,255,.12); --line-strong:rgba(255,255,255,.22); --soft:rgba(255,255,255,.055); --terracotta:#ff8a63; --forest:#d5d5d5; --gold:#c5a06f; } html, body { background:var(--paper); color:var(--ink); } p, li { color:rgba(241,241,241,.78); } .hero-card,.card,.band,.matrix,.diagram,.checkpoint,.ship-checklist .checklist-group,.current-marker { background:rgba(39,39,39,.72); border-color:var(--line); box-shadow:0 2px 16px rgba(0,0,0,.18); } .reader-nav-shell,.reader-back-to-top,.reader-resume { background:rgba(32,32,32,.84); border-color:rgba(255,255,255,.14); } .spec-map a,.flow-node { background:rgba(39,39,39,.72); border-color:var(--line); color:var(--ink); } .check-box { border-color:rgba(255,255,255,.52); background:rgba(255,255,255,.08); box-shadow:inset 0 0 0 1px rgba(255,255,255,.16), 0 0 0 1px rgba(0,0,0,.18); } .check-box.todo { border-color:rgba(255,255,255,.48); background:rgba(255,255,255,.075); } .check-box.current,.check-box.done { border-color:#ff8a63; background:#ff8a63; color:#202020; } }
    * { box-sizing:border-box; }
    html { min-height:100%; scroll-behavior:smooth; background:var(--paper); }
    body { min-height:100dvh; margin:0; font-family:var(--sans); color:var(--ink); background:var(--paper); font-size:16px; line-height:1.5; }
    a { color:inherit; }
    #smooth-wrapper { overflow:hidden; min-height:100vh; }
    #smooth-content { min-height:100vh; }
    .container { width:min(1120px, calc(100vw - 44px)); margin:0 auto; }
    .reader-nav { position:fixed; z-index:50; top:16px; left:0; right:0; display:flex; justify-content:center; pointer-events:none; }
    .reader-nav-shell { pointer-events:auto; width:min(820px, calc(100vw - 24px)); min-height:44px; display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:18px; align-items:center; padding:6px 8px 6px 16px; border:1px solid var(--line); border-radius:999px; background:rgba(250,247,242,.88); box-shadow:0 10px 30px rgba(28,26,23,.08); backdrop-filter:blur(16px); }
    .reader-brand { font:700 13px/1 var(--mono); text-decoration:none; white-space:nowrap; }
    .reader-links { display:flex; justify-content:center; gap:clamp(12px,2vw,22px); overflow:visible; }
    .reader-links a { color:var(--muted); font:600 12px/1 var(--mono); text-decoration:none; text-transform:uppercase; letter-spacing:.06em; }
    .reader-progress { width:74px; height:4px; border-radius:999px; background:var(--soft); overflow:hidden; }
    .reader-progress i { display:block; height:100%; width:0%; background:var(--terracotta); border-radius:999px; }
    .reader-section-rail { position:fixed; z-index:45; left:18px; top:50%; transform:translateY(-50%); display:grid; gap:8px; }
    .reader-section-rail button { width:30px; height:30px; border-radius:999px; border:1px solid var(--line); background:var(--surface); color:var(--muted); font:600 10px/1 var(--mono); cursor:pointer; }
    .reader-section-rail button.active { color:var(--ink); border-color:var(--terracotta); }
    .reader-resume { position:fixed; z-index:55; left:50%; top:74px; transform:translateX(-50%); display:none; gap:10px; align-items:center; padding:10px 12px; border:1px solid var(--line); border-radius:999px; background:rgba(250,247,242,.92); box-shadow:0 12px 40px rgba(28,26,23,.12); font-size:13px; }
    .reader-resume button,.reader-back-to-top { border:1px solid var(--line); border-radius:999px; background:var(--surface); color:var(--ink); cursor:pointer; }
    .reader-resume button { padding:6px 10px; }
    .reader-back-to-top { position:fixed; right:20px; bottom:20px; z-index:55; width:42px; height:42px; opacity:0; pointer-events:none; transition:.18s ease; }
    .reader-back-to-top.visible { opacity:1; pointer-events:auto; }
    .hero { min-height:86vh; display:grid; align-items:end; padding:112px 0 64px; }
    .eyebrow { margin:0 0 14px; color:var(--terracotta); font:700 12px/1 var(--mono); letter-spacing:.12em; text-transform:uppercase; }
    h1 { margin:0; font-size:clamp(58px, 10vw, 124px); line-height:.88; letter-spacing:-.08em; font-weight:800; }
    h2 { margin:0 0 20px; font-size:clamp(34px, 6vw, 76px); line-height:.94; letter-spacing:-.06em; }
    h3 { margin:0 0 10px; font-size:22px; line-height:1.05; letter-spacing:-.035em; }
    .lead { max-width:820px; color:var(--muted); font-size:clamp(18px, 2vw, 24px); line-height:1.5; letter-spacing:-.02em; }
    .hero-grid { display:grid; grid-template-columns:1.1fr .9fr; gap:18px; margin-top:36px; align-items:start; }
    .hero-card,.band,.card,.checklist-group { border:1px solid var(--line); border-radius:24px; background:var(--surface); box-shadow:0 0 0 1px rgba(33,27,23,.04), 0 20px 60px rgba(33,27,23,.06); }
    .hero-card,.band { padding:24px; }
    .meta-grid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px; }
    .meta-item { padding:14px; border-radius:18px; background:var(--soft); }
    .meta-item span { display:block; margin-bottom:8px; color:var(--muted); font:700 10px/1 var(--mono); letter-spacing:.1em; text-transform:uppercase; }
    .meta-item strong { display:block; font-size:16px; line-height:1.2; }
    .spec-map { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:10px; }
    .spec-map a { min-height:52px; display:flex; align-items:center; justify-content:space-between; padding:14px; border:1px solid var(--line); border-radius:18px; background:var(--surface); color:var(--ink); text-decoration:none; font:700 12px/1.2 var(--mono); text-transform:uppercase; letter-spacing:.04em; }
    section { padding:76px 0; scroll-margin-top:90px; }
    .grid-3 { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:14px; margin-top:18px; }
    .card { padding:20px; }
    .tag { display:inline-flex; margin:0 0 10px; padding:6px 9px; border:1px solid var(--line); border-radius:999px; color:var(--muted); font:700 10px/1 var(--mono); text-transform:uppercase; letter-spacing:.08em; }
    .ship-checklist { display:grid; gap:14px; }
    .checklist-group { padding:20px; }
    .checklist-group h3 span { color:var(--muted); font:700 11px/1 var(--mono); text-transform:uppercase; letter-spacing:.08em; }
    .checklist-items { list-style:none; margin:0; padding:0; display:grid; gap:10px; }
    .checklist-items li { display:grid; grid-template-columns:18px 1fr; gap:10px; align-items:start; color:var(--muted); }
    .check-box { width:15px; height:15px; border-radius:4px; border:1px solid rgba(47,91,79,.34); margin-top:4px; display:inline-grid; place-items:center; color:var(--paper); font:700 10px/1 var(--mono); font-style:normal; }
    .check-box.done { background:var(--forest); border-color:var(--forest); }
    .check-box.current { background:var(--terracotta); border-color:var(--terracotta); }
    .check-box.todo { background:transparent; }
    .footer-meta { padding:42px 0 70px; color:var(--muted); font:500 12px/1.6 var(--mono); border-top:1px solid var(--line); }
    @media (max-width: 980px) { .reader-section-rail { display:none; } .hero-grid,.grid-3 { grid-template-columns:1fr; } .spec-map { grid-template-columns:repeat(2, minmax(0,1fr)); } }
    @media (max-width: 680px) { .container { width:min(100vw - 26px, 1120px); } .reader-nav-shell { grid-template-columns:auto auto; gap:12px; } .reader-links { display:none; } .reader-progress { width:58px; } .hero { min-height:78vh; padding-top:96px; } h1 { font-size:clamp(52px, 17vw, 86px); } section { padding:50px 0; } .spec-map { grid-template-columns:1fr; } .meta-grid { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <nav class="reader-nav" aria-label="Spec navigation" data-no-tap-scroll><div class="reader-nav-shell"><a class="reader-brand" href="/design-wiki">Open Consuelo Wiki</a><div class="reader-links">${map.slice(0, 6).map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join('')}</div><div class="reader-progress" aria-hidden="true"><i></i></div></div></nav>
  <nav class="reader-section-rail" aria-label="Section progress" data-no-tap-scroll>${sectionRailLinks(map)}</nav>
  <div class="reader-resume" id="reader-resume" data-no-tap-scroll>Resume where you left off <button type="button" data-resume>Resume</button><button type="button" data-dismiss-resume>Dismiss</button></div>
  <button class="reader-back-to-top" type="button" data-no-tap-scroll aria-label="Back to top">↑</button>
  <div id="smooth-wrapper"><main id="smooth-content"><article>
    <section class="hero" id="top"><div class="container"><p class="eyebrow">${escapeHtml(content.eyebrow ?? content.template)}</p><h1>${escapeHtml(content.title)}</h1><p class="lead">${escapeHtml(content.thesis)}</p><div class="hero-grid"><div class="hero-card meta-grid">${renderMetadata(content.metadata)}</div>${renderMap(map)}</div></div></section>
    ${bodySections}
    <footer class="footer-meta"><div class="container">${escapeHtml(footer)}</div></footer>
  </article></main></div>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollToPlugin.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollSmoother.min.js"></script>
  <script>
    const shellId = ${JSON.stringify(shellId)};
    let smoother = null;
    if (window.gsap && window.ScrollSmoother) { gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, ScrollSmoother); smoother = ScrollSmoother.create({ wrapper:'#smooth-wrapper', content:'#smooth-content', smooth:0.55, smoothTouch:0.24 }); }
    window.__readerShell = { shell:'consuelo-reader', template:${JSON.stringify(content.template)}, id:shellId, smoother:!!smoother };
    const storageKey = 'consuelo-reader:' + shellId + ':scroll';
    const resume = document.getElementById('reader-resume');
    const saved = Number(localStorage.getItem(storageKey) || 0);
    if (saved > 420) resume.style.display = 'flex';
    function scrollTop(){ return smoother ? smoother.scrollTop() : window.scrollY; }
    function go(target){ if (smoother) smoother.scrollTo(target, true, 'top 80px'); else document.querySelector(target)?.scrollIntoView({ behavior:'smooth' }); }
    document.querySelectorAll('a[href^="#"], [data-target]').forEach((el) => el.addEventListener('click', (event) => { const target = el.getAttribute('href') || el.dataset.target; if (!target) return; event.preventDefault(); go(target); }));
    document.querySelector('[data-resume]')?.addEventListener('click', () => { resume.style.display = 'none'; if (smoother) smoother.scrollTo(saved, true); else scrollTo({ top:saved, behavior:'smooth' }); });
    document.querySelector('[data-dismiss-resume]')?.addEventListener('click', () => resume.style.display = 'none');
    document.querySelector('.reader-back-to-top')?.addEventListener('click', () => go('#top'));
    const progress = document.querySelector('.reader-progress i');
    const topButton = document.querySelector('.reader-back-to-top');
    const railButtons = [...document.querySelectorAll('.reader-section-rail button')];
    function tick(){ const y = scrollTop(); const max = Math.max(1, document.documentElement.scrollHeight - innerHeight); progress.style.width = Math.min(100, Math.max(0, y / max * 100)) + '%'; topButton.classList.toggle('visible', y > 700); localStorage.setItem(storageKey, String(Math.round(y))); railButtons.forEach((button) => { const target = document.querySelector(button.dataset.target); if (!target) return; const active = y >= target.offsetTop - 160 && y < target.offsetTop + target.offsetHeight - 160; button.classList.toggle('active', active); }); requestAnimationFrame(tick); }
    tick();
  </script>
</body>
</html>`;
}

function readArg(name: string): string | null {
  const index = Bun.argv.indexOf(`--${name}`);
  if (index === -1) return null;
  return Bun.argv[index + 1] ?? null;
}

if (import.meta.main) {
  const input = readArg('input');
  const out = readArg('out');
  const template = readArg('template') as ReaderTemplate | null;
  if (!input || !out) {
    writeStderr('usage: bun run packages/consuelo-design/scripts/render-consuelo-reader.ts --template <spec|research> --input <content.json> --out <index.html>');
    process.exit(2);
  }
  if (!existsSync(input)) {
    writeStderr(`missing input: ${input}`);
    process.exit(2);
  }
  const content = JSON.parse(readFileSync(input, 'utf8')) as ConsueloReaderContent;
  if (template) content.template = template;
  const html = renderConsueloReader(content);
  const validation = validateConsueloReaderHtml(html);
  if (!validation.ok) {
    writeStderr(`rendered HTML failed validation: ${validation.missing.join(', ')}`);
    process.exit(1);
  }
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, html);
  writeStdout(JSON.stringify({ ok: true, out, template: content.template }, null, 2));
}
