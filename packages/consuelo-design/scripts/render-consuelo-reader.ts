#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { validateConsueloReaderHtml } from './validate-consuelo-reader';

function writeStdout(value: string): void {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value: string): void {
  process.stderr.write(`${value}\n`);
}

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
export type ReaderCallout = { label?: string; title: string; body?: string };
export type ReaderMetric = { label: string; value: string; body?: string };
export type ReaderFlowNode = { title: string; body?: string; tag?: string };
export type ReaderTimelineItem = { title: string; body?: string; tag?: string; items?: string[] };
export type ReaderDetail = { summary: string; body: string; open?: boolean };
export type ReaderRange = { label: string; value: number; max?: number; note?: string };
export type ReaderComparison = { title: string; body: string; tag?: string };
export type ReaderTable = { columns: string[]; rows: Array<string[] | Record<string, string>> };

export type ReaderSection = {
  id: string;
  eyebrow?: string;
  title: string;
  body?: string[];
  cards?: ReaderCard[];
  callout?: ReaderCallout;
  metrics?: ReaderMetric[];
  flow?: ReaderFlowNode[];
  table?: ReaderTable;
  timeline?: ReaderTimelineItem[];
  details?: ReaderDetail[];
  ranges?: ReaderRange[];
  comparisons?: ReaderComparison[];
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
  return `<div class="spec-map">${map.map((item, index) => `<a href="${escapeHtml(item.href)}"><span>${escapeHtml(item.label)}</span><i>${String(index + 1).padStart(2, '0')}</i></a>`).join('')}</div>`;
}

function renderCards(cards: ReaderCard[] | undefined): string {
  if (!cards?.length) return '';
  return `<div class="grid-3">${cards.map((card) => `<article class="card">${card.tag ? `<p class="tag">${escapeHtml(card.tag)}</p>` : ''}<h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.body)}</p></article>`).join('')}</div>`;
}

function renderCallout(callout: ReaderCallout | undefined): string {
  if (!callout) return '';
  return `<div class="callout">${callout.label ? `<p class="tag">${escapeHtml(callout.label)}</p>` : ''}<strong>${escapeHtml(callout.title)}</strong>${callout.body ? `<p>${escapeHtml(callout.body)}</p>` : ''}</div>`;
}

function renderMetrics(metrics: ReaderMetric[] | undefined): string {
  if (!metrics?.length) return '';
  return `<div class="metric-grid">${metrics.map((metric) => `<article class="metric"><span>${escapeHtml(metric.label)}</span><b>${escapeHtml(metric.value)}</b>${metric.body ? `<p>${escapeHtml(metric.body)}</p>` : ''}</article>`).join('')}</div>`;
}

function renderFlow(flow: ReaderFlowNode[] | undefined): string {
  if (!flow?.length) return '';
  return `<div class="diagram"><div class="flow-row">${flow.map((node) => `<div class="flow-node">${node.tag ? `<p class="tag">${escapeHtml(node.tag)}</p>` : ''}<h3>${escapeHtml(node.title)}</h3>${node.body ? `<p>${escapeHtml(node.body)}</p>` : ''}</div>`).join('')}</div></div>`;
}

function normalizeRow(columns: string[], row: string[] | Record<string, string>): string[] {
  if (Array.isArray(row)) return row;
  return columns.map((column) => row[column] ?? row[column.toLowerCase()] ?? '');
}

function renderTable(table: ReaderTable | undefined): string {
  if (!table?.columns.length) return '';
  const header = table.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('');
  const rows = table.rows.map((row) => `<tr>${normalizeRow(table.columns, row).map((cell, index) => `<td data-label="${escapeHtml(table.columns[index] ?? '')}">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
  return `<div class="matrix"><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderTimeline(timeline: ReaderTimelineItem[] | undefined): string {
  if (!timeline?.length) return '';
  return `<div class="timeline">${timeline.map((item, index) => `<article class="phase"><span class="phase-index">${String(index + 1).padStart(2, '0')}</span><div>${item.tag ? `<p class="tag">${escapeHtml(item.tag)}</p>` : ''}<h3>${escapeHtml(item.title)}</h3>${item.body ? `<p>${escapeHtml(item.body)}</p>` : ''}${item.items?.length ? `<ul>${item.items.map((li) => `<li>${escapeHtml(li)}</li>`).join('')}</ul>` : ''}</div></article>`).join('')}</div>`;
}

function renderDetails(details: ReaderDetail[] | undefined): string {
  if (!details?.length) return '';
  return `<div class="decision-grid">${details.map((detail) => `<details class="decision"${detail.open ? ' open' : ''}><summary>${escapeHtml(detail.summary)}</summary><p>${escapeHtml(detail.body)}</p></details>`).join('')}</div>`;
}

function renderRanges(ranges: ReaderRange[] | undefined): string {
  if (!ranges?.length) return '';
  return `<div class="range-grid">${ranges.map((range) => { const max = range.max ?? 100; const pct = Math.max(0, Math.min(100, Math.round((range.value / max) * 100))); return `<article class="range-card"><div><strong>${escapeHtml(range.label)}</strong><span>${escapeHtml(range.value)} / ${escapeHtml(max)}</span></div><i><b style="width:${pct}%"></b></i>${range.note ? `<p>${escapeHtml(range.note)}</p>` : ''}</article>`; }).join('')}</div>`;
}

function renderComparisons(comparisons: ReaderComparison[] | undefined): string {
  if (!comparisons?.length) return '';
  return `<div class="grid-2">${comparisons.map((item) => `<article class="comparison">${item.tag ? `<p class="tag">${escapeHtml(item.tag)}</p>` : ''}<h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`).join('')}</div>`;
}

function renderSection(section: ReaderSection): string {
  const body = section.body?.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('') ?? '';
  const content = [
    body,
    renderCallout(section.callout),
    renderCards(section.cards),
    renderMetrics(section.metrics),
    renderFlow(section.flow),
    renderTable(section.table),
    renderTimeline(section.timeline),
    renderDetails(section.details),
    renderRanges(section.ranges),
    renderComparisons(section.comparisons),
  ].filter(Boolean).join('');
  return `<section id="${escapeHtml(section.id)}"><div class="container"><p class="eyebrow">${escapeHtml(section.eyebrow ?? section.title)}</p><h2>${escapeHtml(section.title)}</h2><div class="section-content">${content}</div></div></section>`;
}

function renderSourceCard(content: ConsueloReaderContent): string {
  if (content.template !== 'research' || !content.sourceCard) return '';
  const rows = Object.entries(content.sourceCard).map(([key, value]) => `<div class="meta-item"><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
  return `<section id="source-card"><div class="container"><p class="eyebrow">Source Card</p><h2>Source grounding</h2><div class="hero-card meta-grid">${rows}</div></div></section>`;
}

function renderLearningRoute(content: ConsueloReaderContent): string {
  if (content.template !== 'research' || !content.learningRoute?.length) return '';
  return `<section id="learning-route"><div class="container"><p class="eyebrow">Learning Route</p><h2>How the lesson moves</h2><div class="spec-map">${content.learningRoute.map((label, index) => `<a href="#${escapeHtml(slug(label))}"><span>${escapeHtml(label)}</span><i>${String(index + 1).padStart(2, '0')}</i></a>`).join('')}</div></div></section>`;
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
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="icon" href="https://consuelohq.com/favicon.ico" sizes="48x48" />
  <link rel="icon" href="https://consuelohq.com/favicon.svg" type="image/svg+xml" />
  <link rel="icon" href="https://consuelohq.com/favicon-32x32.png" sizes="32x32" type="image/png" />
  <link rel="apple-touch-icon" href="https://consuelohq.com/apple-touch-icon.png" />
  <style>
    :root { color-scheme: light; --paper:#FAF7F2; --ink:#211b17; --surface:#fffaf3; --muted:#74685e; --line:rgba(33,27,23,.14); --line-strong:rgba(33,27,23,.28); --soft:rgba(33,27,23,.045); --terracotta:#b86143; --forest:#315f53; --gold:#b88945; --shadow:0 0 0 1px rgba(33,27,23,.05), 0 22px 70px rgba(33,27,23,.08); --mono:"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; --sans:Geist, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; --serif: Georgia, ui-serif, "Times New Roman", serif; }
    * { box-sizing:border-box; }
    html { min-height:100%; scroll-behavior:smooth; background:var(--paper); }
    body { min-height:100dvh; margin:0; font-family:var(--sans); color:var(--ink); background:var(--paper); font-size:16px; line-height:1.5; }
    a { color:inherit; }
    p, li { color:color-mix(in srgb, var(--ink) 72%, var(--muted)); }
    #smooth-wrapper { overflow:hidden; min-height:100vh; }
    #smooth-content { min-height:100vh; }
    .container { width:min(1120px, calc(100vw - 44px)); margin:0 auto; }
    .reader-nav { position:fixed; z-index:50; top:16px; left:0; right:0; display:flex; justify-content:center; pointer-events:none; }
    .reader-nav-shell { pointer-events:auto; width:min(820px, calc(100vw - 24px)); min-height:44px; display:grid; grid-template-columns:minmax(120px,auto) minmax(0,1fr) auto; gap:18px; align-items:center; padding:6px 8px 6px 16px; border:1px solid var(--line); border-radius:999px; background:rgba(250,247,242,.88); box-shadow:0 10px 30px rgba(28,26,23,.08); backdrop-filter:blur(16px); }
    .reader-brand { min-width:0; overflow:hidden; text-overflow:ellipsis; font:600 13px/1 var(--serif); text-decoration:none; white-space:nowrap; }
    .reader-links { display:flex; justify-content:center; gap:clamp(12px,2vw,22px); overflow:hidden; white-space:nowrap; }
    .reader-links a { color:var(--muted); font:600 12px/1 var(--sans); text-decoration:none; transition:color .18s ease; }
    .reader-progress { width:74px; height:4px; border-radius:999px; background:var(--soft); overflow:hidden; }
    .reader-progress i { display:block; height:100%; width:0%; background:var(--terracotta); border-radius:999px; }
    .reader-section-rail { position:fixed; z-index:45; right:18px; top:50%; transform:translateY(-50%); display:grid; gap:8px; }
    .reader-section-rail button { width:9px; height:9px; padding:0; border-radius:999px; border:1px solid var(--line); background:var(--surface); color:transparent; cursor:pointer; transition:transform .18s ease, background .18s ease, border-color .18s ease; }
    .reader-section-rail button.active { transform:scale(1.45); background:var(--terracotta); border-color:var(--terracotta); }
    .reader-section-rail span { display:none; }
    .reader-resume { position:fixed; z-index:55; left:50%; bottom:24px; transform:translateX(-50%); display:none; gap:10px; align-items:center; padding:10px 12px; border:1px solid var(--line); border-radius:999px; background:rgba(250,247,242,.92); box-shadow:0 12px 40px rgba(28,26,23,.12); color:var(--terracotta); font-size:13px; }
    .reader-resume button,.reader-back-to-top { border:1px solid var(--line); border-radius:999px; background:var(--surface); color:var(--ink); cursor:pointer; }
    .reader-resume button { padding:6px 10px; color:var(--terracotta); }
    .reader-back-to-top { position:fixed; right:22px; bottom:24px; z-index:55; width:46px; height:46px; opacity:0; pointer-events:none; transition:.18s ease; }
    .reader-back-to-top.visible { opacity:1; pointer-events:auto; }
    .hero { min-height:86vh; display:grid; align-items:end; padding:112px 0 64px; }
    .eyebrow { margin:0 0 14px; color:var(--forest); font:700 12px/1.5 var(--mono); letter-spacing:.14em; text-transform:uppercase; }
    h1 { margin:0; font-family:var(--serif); font-size:clamp(58px, 10vw, 124px); line-height:.88; letter-spacing:-.075em; font-weight:500; }
    h2 { margin:0 0 24px; font-family:var(--serif); font-size:clamp(38px, 6vw, 78px); line-height:.94; letter-spacing:-.055em; font-weight:500; }
    h3 { margin:0 0 10px; font-size:22px; line-height:1.05; letter-spacing:-.035em; }
    .lead { max-width:820px; color:color-mix(in srgb, var(--ink) 82%, var(--muted)); font-size:clamp(18px, 2vw, 24px); line-height:1.5; letter-spacing:-.02em; }
    .hero-grid { display:grid; grid-template-columns:1.1fr .9fr; gap:18px; margin-top:42px; align-items:start; }
    .hero-card,.section-content,.card,.checklist-group,.callout,.metric,.matrix,.diagram,.phase,.decision,.range-card,.comparison { border:1px solid var(--line); border-radius:24px; background:var(--surface); box-shadow:var(--shadow); }
    .hero-card,.section-content,.callout,.matrix,.diagram { padding:24px; }
    .section-content { display:grid; gap:18px; }
    .meta-grid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px; }
    .meta-item { padding:14px; border-radius:18px; background:var(--soft); }
    .meta-item span { display:block; margin-bottom:8px; color:var(--muted); font:700 10px/1 var(--mono); letter-spacing:.1em; text-transform:uppercase; }
    .meta-item strong { display:block; font-size:16px; line-height:1.2; }
    .spec-map { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:10px; }
    .spec-map a { min-height:52px; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px; border:1px solid var(--line); border-radius:18px; background:var(--surface); color:var(--ink); text-decoration:none; font:700 12px/1.2 var(--mono); text-transform:uppercase; letter-spacing:.04em; transition:transform .18s ease, border-color .18s ease, background .18s ease; }
    .spec-map a i { color:var(--muted); font-style:normal; }
    section { padding:76px 0; scroll-margin-top:90px; }
    .grid-2,.grid-3,.metric-grid,.range-grid { display:grid; gap:14px; }
    .grid-2 { grid-template-columns:repeat(2, minmax(0,1fr)); }
    .grid-3,.metric-grid { grid-template-columns:repeat(3, minmax(0,1fr)); }
    .range-grid { grid-template-columns:repeat(2, minmax(0,1fr)); }
    .card,.comparison,.metric,.range-card,.phase,.decision,.checklist-group { padding:20px; }
    .tag { display:inline-flex; margin:0 0 10px; padding:6px 9px; border:1px solid var(--line); border-radius:999px; color:var(--muted); font:700 10px/1 var(--mono); text-transform:uppercase; letter-spacing:.08em; }
    .callout strong { display:block; max-width:900px; font-size:clamp(26px,4vw,48px); line-height:1; letter-spacing:-.05em; }
    .callout p:last-child { max-width:760px; margin-bottom:0; font-size:18px; }
    .metric span { display:block; color:var(--muted); font:700 10px/1 var(--mono); letter-spacing:.1em; text-transform:uppercase; }
    .metric b { display:block; margin:12px 0; font-size:32px; line-height:1; letter-spacing:-.04em; }
    .flow-row { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    .flow-node { position:relative; padding:18px; border:1px solid var(--line); border-radius:18px; background:var(--soft); }
    .matrix { overflow:hidden; padding:0; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; }
    th,td { padding:18px 20px; text-align:left; vertical-align:top; border-bottom:1px solid var(--line); }
    th { color:var(--muted); font:700 11px/1 var(--mono); letter-spacing:.14em; text-transform:uppercase; }
    td { color:color-mix(in srgb, var(--ink) 82%, var(--muted)); font-size:16px; line-height:1.5; }
    tr:last-child td { border-bottom:0; }
    .timeline { display:grid; gap:14px; }
    .phase { display:grid; grid-template-columns:64px 1fr; gap:18px; align-items:start; }
    .phase-index { color:var(--muted); font:700 32px/.9 var(--mono); opacity:.7; }
    .decision-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .decision summary { cursor:pointer; font-weight:700; letter-spacing:-.02em; }
    .decision p { margin-bottom:0; }
    .range-card div { display:flex; justify-content:space-between; gap:12px; margin-bottom:12px; }
    .range-card span { color:var(--muted); font:700 12px/1 var(--mono); }
    .range-card i { display:block; height:10px; border-radius:999px; background:var(--soft); overflow:hidden; }
    .range-card b { display:block; height:100%; border-radius:inherit; background:var(--terracotta); }
    .ship-checklist { display:grid; gap:14px; }
    .checklist-group h3 span { color:var(--muted); font:700 11px/1 var(--mono); text-transform:uppercase; letter-spacing:.08em; }
    .checklist-items { list-style:none; margin:0; padding:0; display:grid; gap:10px; }
    .checklist-items li { display:grid; grid-template-columns:18px 1fr; gap:10px; align-items:start; color:var(--muted); }
    .check-box { width:15px; height:15px; border-radius:4px; border:1px solid rgba(47,91,79,.34); margin-top:4px; display:inline-grid; place-items:center; color:var(--paper); font:700 10px/1 var(--mono); font-style:normal; }
    .check-box.done { background:var(--forest); border-color:var(--forest); }
    .check-box.current { background:var(--terracotta); border-color:var(--terracotta); }
    .check-box.todo { background:transparent; }
    .footer-meta { padding:42px 0 70px; color:var(--muted); font:500 12px/1.6 var(--mono); border-top:1px solid var(--line); }
    @media (hover:hover) { .reader-links a:hover { color:var(--ink); } .spec-map a:hover,.card:hover,.comparison:hover,.metric:hover,.phase:hover,.decision:hover,.range-card:hover { transform:translateY(-2px); border-color:var(--line-strong); } .reader-back-to-top:hover,.reader-resume button:hover { border-color:var(--line-strong); } }
    @media (max-width: 980px) { .reader-section-rail { display:none; } .hero-grid,.grid-2,.grid-3,.metric-grid,.range-grid,.flow-row,.decision-grid { grid-template-columns:1fr; } .spec-map { grid-template-columns:repeat(2, minmax(0,1fr)); } }
    @media (max-width: 680px) { .container { width:min(100vw - 26px, 1120px); } .reader-nav { top:14px; } .reader-nav-shell { width:calc(100vw - 24px); grid-template-columns:minmax(92px, .65fr) minmax(0, 1.4fr) auto; gap:10px; padding-left:12px; } .reader-links { justify-content:flex-start; gap:16px; overflow:hidden; } .reader-links a:nth-child(n+4) { display:none; } .reader-progress { width:52px; } .hero { min-height:78vh; padding-top:106px; } h1 { font-size:clamp(50px, 16vw, 86px); } h2 { font-size:clamp(38px, 13vw, 64px); } section { padding:54px 0; } .spec-map { grid-template-columns:1fr; } .meta-grid { grid-template-columns:1fr; } .hero-card,.section-content,.callout,.matrix,.diagram { padding:20px; } table, thead, tbody, tr, td { display:block; width:100%; } thead { display:none; } tr { padding:14px 0; border-bottom:1px solid var(--line); } tr:last-child { border-bottom:0; } td { display:grid; grid-template-columns:118px minmax(0,1fr); gap:14px; padding:10px 0; border:0; overflow-wrap:anywhere; } td::before { content:attr(data-label); color:var(--muted); font:700 10px/1.2 var(--mono); letter-spacing:.1em; text-transform:uppercase; } .phase { grid-template-columns:1fr; } .phase-index { font-size:20px; } }
    @media (prefers-color-scheme: dark) { :root { color-scheme: dark; --paper:#202020; --ink:#f1f1f1; --surface:#272727; --muted:#b6b6b6; --line:rgba(255,255,255,.14); --line-strong:rgba(255,255,255,.28); --soft:rgba(255,255,255,.06); --terracotta:#ff8a63; --forest:#d5d5d5; --gold:#c5a06f; --shadow:0 0 0 1px rgba(255,255,255,.04), 0 22px 70px rgba(0,0,0,.18); } html, body { background:var(--paper); color:var(--ink); } p, li, td { color:rgba(241,241,241,.78); } .hero-card,.section-content,.card,.checklist-group,.callout,.metric,.matrix,.diagram,.phase,.decision,.range-card,.comparison { background:rgba(39,39,39,.72); border-color:var(--line); box-shadow:var(--shadow); } .reader-nav-shell,.reader-back-to-top,.reader-resume { background:rgba(32,32,32,.88); border-color:rgba(255,255,255,.16); box-shadow:0 12px 42px rgba(0,0,0,.22); } .reader-brand,.reader-links a,button { color:var(--ink); } .reader-links a { color:rgba(241,241,241,.72); } .spec-map a,.flow-node,.meta-item { background:rgba(255,255,255,.045); border-color:var(--line); color:var(--ink); } .tag { border-color:var(--line); color:var(--muted); } .check-box { border-color:rgba(255,255,255,.52); background:rgba(255,255,255,.08); box-shadow:inset 0 0 0 1px rgba(255,255,255,.16), 0 0 0 1px rgba(0,0,0,.18); } .check-box.todo { border-color:rgba(255,255,255,.48); background:rgba(255,255,255,.075); } .check-box.current,.check-box.done { border-color:#ff8a63; background:#ff8a63; color:#202020; } }
  </style>
</head>
<body>
  <nav class="reader-nav" aria-label="Spec navigation" data-no-tap-scroll><div class="reader-nav-shell"><a class="reader-brand" href="/design-wiki">${escapeHtml(content.title)}</a><div class="reader-links">${map.slice(0, 6).map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join('')}</div><div class="reader-progress" aria-hidden="true"><i></i></div></div></nav>
  <nav class="reader-section-rail" aria-label="Section progress" data-no-tap-scroll>${sectionRailLinks(map)}</nav>
  <div class="reader-resume" id="reader-resume" data-no-tap-scroll>Resume reading <button type="button" data-resume>Resume</button><button type="button" data-dismiss-resume>Dismiss</button></div>
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
