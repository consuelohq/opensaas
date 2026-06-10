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

export const READER_SHELL_VERSION = '1.3.0';
export const READER_SHELL_TEMPLATES = ['spec', 'plan', 'guide'] as const;
export type ReaderTemplate = typeof READER_SHELL_TEMPLATES[number];
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
export type ReaderQuestion = { title: string; body: string; tag?: string };

export type ReaderLedgerGroup = {
  title: string;
  tag?: string;
  items: { status: LedgerStatus; text: string }[];
};

export type ReaderComponent =
  | { type: 'callout'; title: string; callout: ReaderCallout }
  | { type: 'metrics'; title: string; metrics: ReaderMetric[] }
  | { type: 'flow'; title: string; nodes: ReaderFlowNode[] }
  | { type: 'table'; title: string; table: ReaderTable }
  | { type: 'timeline'; title: string; items: ReaderTimelineItem[] }
  | { type: 'details'; title: string; details: ReaderDetail[] }
  | { type: 'ranges'; title: string; ranges: ReaderRange[] }
  | { type: 'comparisons'; title: string; comparisons: ReaderComparison[] }
  | { type: 'cards'; title: string; cards: ReaderCard[] }
  | { type: 'ledger'; title: string; groups: ReaderLedgerGroup[] }
  | { type: 'decisionCards'; title: string; items: ReaderDetail[] }
  | { type: 'requirementsMatrix'; title: string; columns: string[]; rows: ReaderTable['rows'] }
  | { type: 'architectureFlow'; title: string; nodes: ReaderFlowNode[] }
  | { type: 'riskPanels'; title: string; risks: ReaderCard[] }
  | { type: 'metricCards'; title: string; cards: ReaderMetric[] }
  | { type: 'taskLedger'; title: string; groups: ReaderLedgerGroup[] }
  | { type: 'openQuestions'; title: string; questions: ReaderQuestion[] };

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

export type ConsueloReaderContent = {
  template: ReaderTemplate;
  title: string;
  eyebrow?: string;
  thesis: string;
  metadata?: ReaderMetadata;
  map?: ReaderLink[];
  sections: ReaderSection[];
  components?: ReaderComponent[];
  ledgerTitle?: string;
  ledger?: ReaderLedgerGroup[];
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

function escapeAttribute(value: unknown): string {
  return String(value ?? '').replace(/[&<"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] ?? char);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
}

function assertReaderTemplate(template: unknown): asserts template is ReaderTemplate {
  if (!READER_SHELL_TEMPLATES.includes(template as ReaderTemplate)) {
    throw new Error(`unsupported reader shell template: ${String(template)}. Use spec, plan, or guide. Roadmaps are plan documents; uncategorized artifacts do not use the reader shell.`);
  }
}

function validateConsueloReaderContent(content: ConsueloReaderContent): void {
  assertReaderTemplate(content.template);
  if (!content.title?.trim()) throw new Error('reader shell document requires title');
  if (!content.thesis?.trim()) throw new Error('reader shell document requires thesis');
  if (!content.sections?.length) throw new Error('reader shell document requires at least one body section');
  if (!content.ledger?.length) throw new Error('reader shell document requires checklist ledger');
  for (const section of content.sections) {
    if (!section.id?.trim()) throw new Error('reader shell section requires id');
    if (!section.title?.trim()) throw new Error('reader shell section requires title');
  }
  for (const group of content.ledger) {
    if (!group.title?.trim()) throw new Error('reader shell checklist group requires title');
    if (!group.items?.length) throw new Error('reader shell checklist group requires items');
  }
}


function navDisplayTitle(value: string): string {
  const shortTitle = value.split(/\s+[—–-]\s+/)[0]?.trim();
  return shortTitle || value;
}

function componentAnchor(component: ReaderComponent): string {
  return slug(component.title);
}

function sectionNavigationItems(content: ConsueloReaderContent): ReaderLink[] {
  const sectionLinks = content.sections.map((section) => ({ label: section.title, href: `#${section.id}` }));
  const componentLinks = content.components?.map((component) => ({ label: component.title, href: `#${componentAnchor(component)}` })) ?? [];
  return [...sectionLinks, ...componentLinks, { label: content.ledgerTitle ?? 'Task', href: '#ship-checklist' }];
}

function defaultMap(content: ConsueloReaderContent): ReaderLink[] {
  if (content.map?.length) return content.map;
  const sectionLinks = content.sections.slice(0, 3).map((section) => ({ label: section.eyebrow ?? section.title, href: `#${section.id}` }));
  return [...sectionLinks, { label: 'Task', href: '#ship-checklist' }].slice(0, 6);
}

function renderMetadata(metadata: ReaderMetadata | undefined): string {
  const items = [
    ['Status', metadata?.status ?? 'Draft'],
    ['Owner', metadata?.owner ?? 'Ko / Consuelo'],
    ['Date', metadata?.date ?? new Date().toISOString().slice(0, 10)],
    ['Source Truth', metadata?.sourceTruth ?? 'Typed reader-shell input'],
  ];
  if (metadata?.confidence) items.push(['Confidence', metadata.confidence]);
  return items.map(([label, value]) => `<div class="meta-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
}

function renderMap(map: ReaderLink[]): string {
  return `<div class="spec-map">${map.map((item, index) => `<a href="${escapeHtml(item.href)}"><span>${escapeHtml(item.label)}</span><i>${String(index + 1).padStart(2, '0')}</i></a>`).join('')}</div>`;
}

function renderCards(cards: ReaderCard[] | undefined): string {
  if (!cards?.length) return '';
  return `<div class="grid-2 roadmap-card-grid">${cards.map((card) => `<article class="card">${card.tag ? `<p class="tag">${escapeHtml(card.tag)}</p>` : ''}<h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.body)}</p></article>`).join('')}</div>`;
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
  const parts = [body, renderCallout(section.callout), renderCards(section.cards), renderMetrics(section.metrics), renderFlow(section.flow), renderTable(section.table), renderTimeline(section.timeline), renderDetails(section.details), renderRanges(section.ranges), renderComparisons(section.comparisons)].filter(Boolean);
  const content = parts.join('');
  const componentCount = [
    section.cards?.length ? 1 : 0,
    section.callout ? 1 : 0,
    section.metrics?.length ? 1 : 0,
    section.flow?.length ? 1 : 0,
    section.table ? 1 : 0,
    section.timeline?.length ? 1 : 0,
    section.details?.length ? 1 : 0,
    section.ranges?.length ? 1 : 0,
    section.comparisons?.length ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);
  const flat = !body && componentCount >= 1;
  const contentClass = flat ? 'section-content flat-content' : 'section-content';
  return `<section id="${escapeHtml(section.id)}" data-reader-section><div class="container"><p class="eyebrow">${escapeHtml(section.eyebrow ?? section.title)}</p><h2>${escapeHtml(section.title)}</h2><div class="${contentClass}">${content}</div></div></section>`;
}

function ledgerStatusMark(status: LedgerStatus): string {
  if (status === 'done') return 'x';
  if (status === 'current') return '>';
  if (status === 'blocked') return '!';
  return ' ';
}

function ledgerGroupMarkdown(group: ReaderLedgerGroup): string {
  const lines = [
    `## ${group.title}`,
    group.tag ? `_${group.tag}_` : '',
    ...group.items.map((item) => `- [${ledgerStatusMark(item.status)}] ${item.text}`),
  ].filter(Boolean);
  return lines.join('\n');
}

function renderLedgerGroups(groups: ReaderLedgerGroup[]): string {
  return groups.map((group) => {
    const markdown = ledgerGroupMarkdown(group);
    return `<article class="checklist-group"><div class="checklist-heading"><h3>${escapeHtml(group.title)}${group.tag ? ` <span>${escapeHtml(group.tag)}</span>` : ''}</h3><button class="task-copy-button" type="button" data-copy-markdown="${escapeAttribute(markdown)}" aria-label="Copy task as Markdown">Copy</button></div><ul class="checklist-items">${group.items.map((item) => `<li><i class="check-box ${escapeHtml(item.status)}">${item.status === 'done' ? '✓' : item.status === 'current' ? '•' : ''}</i><span>${escapeHtml(item.text)}</span></li>`).join('')}</ul></article>`;
  }).join('');
}

function renderLedger(content: ConsueloReaderContent): string {
  return `<section id="ship-checklist" data-reader-component="taskLedger"><div class="container"><p class="eyebrow">Task Profile</p><h2>${escapeHtml(content.ledgerTitle ?? 'Completion ledger')}</h2><div class="ship-checklist">${renderLedgerGroups(content.ledger ?? [])}</div></div></section>`;
}

function renderTypedComponent(component: ReaderComponent): string {
  if (component.type === 'callout') return `<section id="${escapeHtml(slug(component.title))}" data-reader-component="callout"><div class="container"><p class="eyebrow">Callout</p><h2>${escapeHtml(component.title)}</h2><div class="section-content flat-content">${renderCallout(component.callout)}</div></div></section>`;
  if (component.type === 'metrics') return `<section id="${escapeHtml(slug(component.title))}" data-reader-component="metrics"><div class="container"><p class="eyebrow">Metrics</p><h2>${escapeHtml(component.title)}</h2><div class="section-content flat-content">${renderMetrics(component.metrics)}</div></div></section>`;
  if (component.type === 'flow') return `<section id="${escapeHtml(slug(component.title))}" data-reader-component="flow"><div class="container"><p class="eyebrow">Flow</p><h2>${escapeHtml(component.title)}</h2><div class="section-content flat-content">${renderFlow(component.nodes)}</div></div></section>`;
  if (component.type === 'table') return `<section id="${escapeHtml(slug(component.title))}" data-reader-component="table"><div class="container"><p class="eyebrow">Table</p><h2>${escapeHtml(component.title)}</h2><div class="section-content flat-content">${renderTable(component.table)}</div></div></section>`;
  if (component.type === 'timeline') return `<section id="${escapeHtml(slug(component.title))}" data-reader-component="timeline"><div class="container"><p class="eyebrow">Timeline</p><h2>${escapeHtml(component.title)}</h2><div class="section-content flat-content">${renderTimeline(component.items)}</div></div></section>`;
  if (component.type === 'details') return `<section id="${escapeHtml(slug(component.title))}" data-reader-component="details"><div class="container"><p class="eyebrow">Details</p><h2>${escapeHtml(component.title)}</h2><div class="section-content flat-content">${renderDetails(component.details)}</div></div></section>`;
  if (component.type === 'ranges') return `<section id="${escapeHtml(slug(component.title))}" data-reader-component="ranges"><div class="container"><p class="eyebrow">Ranges</p><h2>${escapeHtml(component.title)}</h2><div class="section-content flat-content">${renderRanges(component.ranges)}</div></div></section>`;
  if (component.type === 'comparisons') return `<section id="${escapeHtml(slug(component.title))}" data-reader-component="comparisons"><div class="container"><p class="eyebrow">Comparisons</p><h2>${escapeHtml(component.title)}</h2><div class="section-content flat-content">${renderComparisons(component.comparisons)}</div></div></section>`;
  if (component.type === 'cards') return `<section id="${escapeHtml(slug(component.title))}" data-reader-component="cards"><div class="container"><p class="eyebrow">Cards</p><h2>${escapeHtml(component.title)}</h2><div class="section-content flat-content">${renderCards(component.cards)}</div></div></section>`;
  if (component.type === 'ledger') return `<section id="${escapeHtml(slug(component.title))}" data-reader-component="ledger"><div class="container"><p class="eyebrow">Ledger</p><h2>${escapeHtml(component.title)}</h2><div class="ship-checklist">${renderLedgerGroups(component.groups)}</div></div></section>`;
  if (component.type === 'decisionCards') return `<section id="${escapeHtml(slug(component.title))}" data-reader-component="decisionCards"><div class="container"><p class="eyebrow">Decisions</p><h2>${escapeHtml(component.title)}</h2><div class="section-content flat-content">${renderDetails(component.items)}</div></div></section>`;
  if (component.type === 'requirementsMatrix') return `<section id="${escapeHtml(slug(component.title))}" data-reader-component="requirementsMatrix"><div class="container"><p class="eyebrow">Requirements</p><h2>${escapeHtml(component.title)}</h2><div class="section-content flat-content">${renderTable({ columns: component.columns, rows: component.rows })}</div></div></section>`;
  if (component.type === 'architectureFlow') return `<section id="${escapeHtml(slug(component.title))}" data-reader-component="architectureFlow"><div class="container"><p class="eyebrow">Architecture</p><h2>${escapeHtml(component.title)}</h2><div class="section-content flat-content">${renderFlow(component.nodes)}</div></div></section>`;
  if (component.type === 'riskPanels') return `<section id="${escapeHtml(slug(component.title))}" data-reader-component="riskPanels"><div class="container"><p class="eyebrow">Risks</p><h2>${escapeHtml(component.title)}</h2><div class="section-content flat-content">${renderCards(component.risks)}</div></div></section>`;
  if (component.type === 'metricCards') return `<section id="${escapeHtml(slug(component.title))}" data-reader-component="metricCards"><div class="container"><p class="eyebrow">Metrics</p><h2>${escapeHtml(component.title)}</h2><div class="section-content flat-content">${renderMetrics(component.cards)}</div></div></section>`;
  if (component.type === 'taskLedger') return `<section id="${escapeHtml(slug(component.title))}" data-reader-component="taskLedger"><div class="container"><p class="eyebrow">Task Ledger</p><h2>${escapeHtml(component.title)}</h2><div class="ship-checklist">${renderLedgerGroups(component.groups)}</div></div></section>`;
  if (component.type === 'openQuestions') return `<section id="${escapeHtml(slug(component.title))}" data-reader-component="openQuestions"><div class="container"><p class="eyebrow">Open Questions</p><h2>${escapeHtml(component.title)}</h2><div class="section-content flat-content"><div class="grid-2">${component.questions.map((question) => `<article class="card">${question.tag ? `<p class="tag">${escapeHtml(question.tag)}</p>` : ''}<h3>${escapeHtml(question.title)}</h3><p>${escapeHtml(question.body)}</p></article>`).join('')}</div></div></div></section>`;
  const _exhaustive: never = component;
  return _exhaustive;
}

function sectionRailLinks(items: ReaderLink[]): string {
  return items.map((item, index) => `<button type="button" class="reader-section-line" data-target="${escapeHtml(item.href)}" data-reader-section-target="${escapeHtml(item.href)}" data-reader-section-title="${escapeHtml(item.label)}" aria-label="Go to ${escapeHtml(item.label)}"><i aria-hidden="true"></i><span>${escapeHtml(item.label)}</span><b>${String(index + 1).padStart(2, '0')}</b></button>`).join('');
}

function sectionDrawerLinks(items: ReaderLink[]): string {
  return items.map((item, index) => `<button type="button" class="reader-section-drawer-row" data-target="${escapeHtml(item.href)}" data-reader-section-target="${escapeHtml(item.href)}" data-reader-section-title="${escapeHtml(item.label)}"><i>${String(index + 1).padStart(2, '0')}</i><span>${escapeHtml(item.label)}</span></button>`).join('');
}

export function renderConsueloReader(content: ConsueloReaderContent): string {
  validateConsueloReaderContent(content);
  const map = defaultMap(content);
  const navLinks = map.filter((item) => item.label.toLowerCase() !== 'task').slice(0, 4);
  const sectionLinks = sectionNavigationItems(content);
  const taskHref = map.find((item) => item.label.toLowerCase() === 'task')?.href ?? '#ship-checklist';
  const brandTitle = navDisplayTitle(content.title);
  const shellId = `${content.template}:${slug(content.title)}`;
  const typedComponents = content.components?.map(renderTypedComponent) ?? [];
  const bodySections = [...content.sections.map(renderSection), ...typedComponents, renderLedger(content)].filter(Boolean).join('\n');
  const footer = content.footer ?? `Artifact: ${content.title} · Template: ${content.template} · Generated with canonical Consuelo reader shell ${READER_SHELL_VERSION} · /design-wiki`;

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
    :root { color-scheme: light; --paper:#FAF7F2; --ink:#211b17; --surface:#fffaf3; --muted:#74685e; --line:rgba(33,27,23,.14); --line-strong:rgba(33,27,23,.28); --soft:rgba(33,27,23,.045); --terracotta:#b86143; --forest:#315f53; --shadow:0 0 0 1px rgba(33,27,23,.08), 0 26px 90px rgba(33,27,23,.12); --mono:"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; --sans:Geist, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; --serif: Georgia, ui-serif, "Times New Roman", serif; }
    * { box-sizing:border-box; } html { min-height:100%; scroll-behavior:smooth; background:var(--paper); } body { min-height:100dvh; margin:0; font-family:var(--sans); color:var(--ink); background:var(--paper); font-size:16px; line-height:1.5; } a { color:inherit; } p, li { color:color-mix(in srgb, var(--ink) 76%, var(--muted)); }
    #smooth-wrapper { overflow:hidden; min-height:100vh; } #smooth-content { min-height:100vh; } .container { width:min(1120px, calc(100vw - 44px)); margin:0 auto; }
    .reader-nav { position:fixed; z-index:50; top:16px; left:0; right:0; display:flex; justify-content:center; pointer-events:none; } .reader-nav-shell { pointer-events:auto; width:min(820px, calc(100vw - 24px)); min-height:44px; display:grid; grid-template-columns:minmax(0,1fr) auto auto; gap:18px; align-items:center; padding:6px 8px 6px 16px; border:1px solid var(--line); border-radius:999px; background:rgba(250,247,242,.88); box-shadow:0 10px 30px rgba(28,26,23,.08); backdrop-filter:blur(16px); } .reader-brand { min-width:0; overflow:hidden; text-overflow:ellipsis; font:600 13px/1 var(--serif); text-decoration:none; white-space:nowrap; } .reader-links { display:flex; justify-content:flex-end; justify-self:end; gap:clamp(12px,2vw,22px); overflow:hidden; white-space:nowrap; } .reader-links a { color:var(--muted); font:600 12px/1 var(--sans); text-decoration:none; } .reader-nav-task { display:inline-flex; align-items:center; justify-content:center; min-width:76px; height:34px; padding:0 18px; border-radius:999px; border:1px solid color-mix(in srgb, var(--terracotta) 82%, var(--ink)); background:var(--terracotta); color:#211b17; font:700 13px/1 var(--sans); text-decoration:none; box-shadow:inset 0 0 0 1px rgba(255,255,255,.18); }
    .reader-section-rail { position:fixed; z-index:45; right:18px; top:50%; transform:translateY(-50%); display:grid; gap:8px; padding:8px 0; } .reader-section-line { width:34px; min-height:12px; display:grid; grid-template-columns:1fr auto; gap:6px; align-items:center; padding:3px 0; border:0; background:transparent; color:transparent; cursor:pointer; -webkit-tap-highlight-color:transparent; } .reader-section-line i { display:block; height:2px; border-radius:999px; background:var(--line-strong); transition:transform .18s ease, background .18s ease, width .18s ease; } .reader-section-line b { display:none; } .reader-section-line span { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; } .reader-section-line.active i { transform:scaleX(1.35); background:var(--terracotta); }
    .reader-section-drawer-toggle { display:none; } .reader-section-drawer[hidden] { display:none !important; } .reader-section-drawer { position:fixed; inset:0; z-index:70; display:grid; place-items:stretch; background:rgba(0,0,0,.36); backdrop-filter:blur(10px); } .reader-section-drawer-panel { align-self:end; max-height:min(82vh, 760px); overflow-y:auto; padding:22px; border:1px solid var(--line); border-radius:28px 28px 0 0; background:var(--surface); box-shadow:0 -20px 80px rgba(0,0,0,.28); } .reader-section-drawer-head { position:sticky; top:-22px; z-index:1; display:flex; align-items:center; justify-content:space-between; gap:16px; margin:-22px -22px 12px; padding:18px 22px; border-bottom:1px solid var(--line); background:color-mix(in srgb, var(--surface) 94%, transparent); backdrop-filter:blur(14px); } .reader-section-drawer-head p { margin:0; color:var(--muted); font:700 11px/1 var(--mono); letter-spacing:.14em; text-transform:uppercase; } .reader-section-drawer-head button { width:36px; height:36px; border:1px solid var(--line); border-radius:999px; background:var(--soft); color:var(--ink); cursor:pointer; } .reader-section-drawer-list { display:grid; gap:8px; padding-bottom:18px; } .reader-section-drawer-row { display:grid; grid-template-columns:44px 1fr; gap:14px; align-items:center; min-height:56px; padding:13px 15px; border:1px solid var(--line); border-radius:18px; background:var(--soft); color:var(--ink); text-align:left; cursor:pointer; } .reader-section-drawer-row i { color:var(--muted); font:700 11px/1 var(--mono); font-style:normal; } .reader-section-drawer-row span { font:700 17px/1.1 var(--sans); letter-spacing:-.03em; }
    .reader-tap-zone { position:fixed; z-index:8; top:86px; bottom:86px; width:min(18vw,120px); border:0; padding:0; margin:0; background:transparent; opacity:0; cursor:pointer; -webkit-tap-highlight-color:transparent; } .reader-tap-zone-left { left:0; } .reader-tap-zone-right { right:0; }
    .reader-resume { position:fixed; z-index:55; left:50%; bottom:32px; transform:translateX(-50%); display:none; gap:12px; align-items:center; padding:10px 16px; border:1px solid var(--line); border-radius:18px; background:rgba(32,32,32,.84); box-shadow:0 14px 50px rgba(0,0,0,.22); color:var(--terracotta); font:500 13px/1.15 var(--sans); backdrop-filter:blur(16px); } .reader-resume button { padding:7px 12px; border:1px solid var(--line); border-radius:999px; background:rgba(255,255,255,.06); color:var(--terracotta); cursor:pointer; font:500 12px/1 var(--sans); } .reader-back-to-top { --reader-scroll:0%; position:fixed; right:22px; bottom:24px; z-index:55; width:52px; height:52px; opacity:0; pointer-events:none; border:0; border-radius:999px; background:conic-gradient(var(--terracotta) var(--reader-scroll), rgba(255,255,255,.14) 0); color:var(--ink); cursor:pointer; transition:.18s ease; display:grid; place-items:center; } .reader-back-to-top-progress { position:absolute; inset:4px; border-radius:inherit; background:var(--surface); border:1px solid var(--line); } .reader-back-to-top b { position:relative; z-index:1; font:500 23px/1 var(--sans); } .reader-back-to-top.visible { opacity:1; pointer-events:auto; }
    .hero { min-height:86vh; display:grid; align-items:end; padding:112px 0 64px; } .eyebrow { margin:0 0 14px; color:var(--forest); font:700 12px/1.5 var(--mono); letter-spacing:.14em; text-transform:uppercase; } h1 { max-width:980px; margin:0; font-family:var(--serif); font-size:clamp(58px, 9vw, 112px); line-height:.9; letter-spacing:-.065em; font-weight:500; text-wrap:balance; } h2 { margin:0 0 24px; font-family:var(--serif); font-size:clamp(38px, 6vw, 76px); line-height:.96; letter-spacing:-.05em; font-weight:500; text-wrap:balance; } h3 { margin:0 0 10px; font-size:22px; line-height:1.08; letter-spacing:-.03em; font-weight:600; } .lead { max-width:820px; color:color-mix(in srgb, var(--ink) 82%, var(--muted)); font-size:clamp(20px, 2vw, 28px); line-height:1.5; letter-spacing:-.02em; } .hero-thesis { max-width:900px; margin:38px 0 0; padding-top:32px; border-top:1px solid var(--line-strong); color:var(--terracotta); font-size:clamp(20px, 2.7vw, 34px); line-height:1.58; letter-spacing:-.035em; } .hero-grid { display:grid; grid-template-columns:1.1fr .9fr; gap:18px; margin-top:54px; align-items:start; }
    .hero-card,.section-content,.card,.checklist-group,.callout,.metric,.matrix,.diagram,.phase,.decision,.range-card,.comparison { border:1px solid var(--line); border-radius:24px; background:var(--surface); box-shadow:var(--shadow); } .hero-card,.section-content,.callout,.matrix,.diagram { padding:24px; } .section-content { display:grid; gap:18px; } .section-content.flat-content { padding:0; border:0; background:transparent; box-shadow:none; } .meta-grid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px; } .meta-item { padding:14px; border-radius:18px; background:var(--soft); } .meta-item span { display:block; margin-bottom:8px; color:var(--muted); font:700 10px/1 var(--mono); letter-spacing:.1em; text-transform:uppercase; } .meta-item strong { display:block; font-size:16px; line-height:1.2; }
    .spec-map { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:10px; } .spec-map a { min-height:52px; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px; border:1px solid var(--line); border-radius:18px; background:var(--surface); color:var(--ink); text-decoration:none; font:700 12px/1.2 var(--mono); text-transform:uppercase; letter-spacing:.04em; transition:transform .18s ease, border-color .18s ease, background .18s ease; } .spec-map a i { color:var(--muted); font-style:normal; }
    section { padding:76px 0; scroll-margin-top:90px; } .grid-2,.grid-3,.metric-grid,.range-grid { display:grid; gap:14px; } .grid-2 { grid-template-columns:repeat(2, minmax(0,1fr)); } .roadmap-card-grid { gap:18px; } .grid-3,.metric-grid { grid-template-columns:repeat(3, minmax(0,1fr)); } .range-grid { grid-template-columns:repeat(2, minmax(0,1fr)); } .card,.comparison,.metric,.range-card,.phase,.decision,.checklist-group { padding:clamp(22px,3vw,38px); } .tag { display:inline-flex; margin:0 0 10px; padding:6px 9px; border:1px solid var(--line); border-radius:999px; color:var(--muted); font:700 10px/1 var(--mono); text-transform:uppercase; letter-spacing:.08em; }
    .callout strong { display:block; max-width:900px; font-size:clamp(26px,4vw,48px); line-height:1; letter-spacing:-.05em; } .callout p:last-child { max-width:760px; margin-bottom:0; font-size:18px; } .metric span { display:block; color:var(--muted); font:700 10px/1 var(--mono); letter-spacing:.1em; text-transform:uppercase; } .metric b { display:block; margin:12px 0; font-size:32px; line-height:1; letter-spacing:-.04em; } .flow-row { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; } .flow-node { position:relative; padding:18px; border:1px solid var(--line); border-radius:18px; background:var(--soft); }
    .matrix { overflow:hidden; padding:0; } table { width:100%; border-collapse:collapse; table-layout:fixed; } th,td { padding:18px 20px; text-align:left; vertical-align:top; border-bottom:1px solid var(--line); } th { color:var(--muted); font:700 11px/1 var(--mono); letter-spacing:.14em; text-transform:uppercase; } td { color:color-mix(in srgb, var(--ink) 82%, var(--muted)); font-size:16px; line-height:1.5; } tr:last-child td { border-bottom:0; }
    .timeline { display:grid; gap:14px; } .phase { display:grid; grid-template-columns:64px 1fr; gap:18px; align-items:start; } .phase-index { color:var(--muted); font:700 32px/.9 var(--mono); opacity:.7; } .decision-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; } .decision summary { cursor:pointer; font-weight:700; letter-spacing:-.02em; } .decision p { margin-bottom:0; } .range-card div { display:flex; justify-content:space-between; gap:12px; margin-bottom:12px; } .range-card span { color:var(--muted); font:700 12px/1 var(--mono); } .range-card i { display:block; height:10px; border-radius:999px; background:var(--soft); overflow:hidden; } .range-card b { display:block; height:100%; border-radius:inherit; background:var(--terracotta); }
    .ship-checklist { display:grid; gap:14px; } .checklist-group h3 span { color:var(--muted); font:700 11px/1 var(--mono); text-transform:uppercase; letter-spacing:.08em; } .checklist-items { list-style:none; margin:0; padding:0; display:grid; gap:10px; } .checklist-items li { display:grid; grid-template-columns:18px 1fr; gap:10px; align-items:start; color:var(--muted); } .check-box { width:15px; height:15px; border-radius:4px; border:1px solid rgba(47,91,79,.34); margin-top:4px; display:inline-grid; place-items:center; color:var(--paper); font:700 10px/1 var(--mono); font-style:normal; } .check-box.done { background:var(--forest); border-color:var(--forest); } .check-box.current { background:var(--terracotta); border-color:var(--terracotta); } .check-box.todo { background:transparent; } .footer-meta { padding:42px 0 70px; color:var(--muted); font:500 12px/1.6 var(--mono); border-top:1px solid var(--line); }
    @media (hover:hover) { .reader-links a:hover { color:var(--ink); } .spec-map a:hover,.card:hover,.comparison:hover,.metric:hover,.phase:hover,.decision:hover,.range-card:hover,.reader-nav-task:hover { transform:translateY(-2px); border-color:var(--line-strong); } .reader-back-to-top:hover,.reader-resume button:hover,.reader-nav-task:hover { border-color:var(--line-strong); } }
    @media (max-width: 980px) { .reader-section-rail { display:none; } .hero-grid,.grid-2,.grid-3,.metric-grid,.range-grid,.flow-row,.decision-grid { grid-template-columns:1fr; } .spec-map { grid-template-columns:repeat(2, minmax(0,1fr)); } }
    @media (max-width: 680px) { .reader-section-rail { right:10px; gap:5px; } .reader-section-line { width:26px; min-height:10px; } .reader-section-line i { height:2px; } .reader-section-drawer-toggle { display:block; position:fixed; right:12px; bottom:92px; z-index:56; width:42px; height:42px; border:1px solid var(--line); border-radius:999px; background:var(--surface); color:var(--ink); box-shadow:var(--shadow); } .container { width:min(100vw - 26px, 1120px); } .reader-nav { top:14px; } .reader-nav-shell { width:calc(100vw - 24px); grid-template-columns:minmax(92px, .65fr) minmax(0, 1.4fr) auto; gap:10px; padding-left:12px; } .reader-links { justify-content:flex-start; gap:16px; overflow:hidden; } .reader-links a:nth-child(n+4) { display:none; } .reader-progress { width:52px; } .hero { min-height:78vh; padding-top:106px; } h1 { font-size:clamp(48px, 12vw, 88px); letter-spacing:-.055em; } h2 { font-size:clamp(38px, 13vw, 64px); } section { padding:54px 0; } .spec-map { grid-template-columns:1fr; } .meta-grid { grid-template-columns:1fr; } .hero-card,.section-content,.callout,.matrix,.diagram { padding:20px; } .section-content.flat-content { padding:0; } table, thead, tbody, tr, td { display:block; width:100%; } thead { display:none; } tr { padding:14px 0; border-bottom:1px solid var(--line); } tr:last-child { border-bottom:0; } td { display:grid; grid-template-columns:118px minmax(0,1fr); gap:14px; padding:10px 0; border:0; overflow-wrap:anywhere; } td::before { content:attr(data-label); color:var(--muted); font:700 10px/1.2 var(--mono); letter-spacing:.1em; text-transform:uppercase; } .phase { grid-template-columns:1fr; } .phase-index { font-size:20px; } }
    @media (prefers-color-scheme: dark) { :root { color-scheme: dark; --paper:#202020; --ink:#f1f1f1; --surface:#272727; --muted:#b6b6b6; --line:rgba(255,255,255,.14); --line-strong:rgba(255,255,255,.28); --soft:rgba(255,255,255,.06); --terracotta:#ff8a63; --forest:#d5d5d5; --shadow:0 0 0 1px rgba(255,255,255,.04), 0 22px 70px rgba(0,0,0,.18); } html, body { background:var(--paper); color:var(--ink); } p, li, td { color:rgba(241,241,241,.78); } .hero-card,.section-content,.card,.checklist-group,.callout,.metric,.matrix,.diagram,.phase,.decision,.range-card,.comparison { background:rgba(39,39,39,.72); border-color:var(--line); box-shadow:var(--shadow); } .reader-nav-shell,.reader-back-to-top-progress,.reader-resume { background:rgba(32,32,32,.88); border-color:rgba(255,255,255,.16); box-shadow:0 12px 42px rgba(0,0,0,.22); } .reader-brand,.reader-links a,button { color:var(--ink); } .reader-nav-task { color:#202020; } .reader-links a { color:rgba(241,241,241,.72); } .spec-map a,.flow-node,.meta-item { background:rgba(255,255,255,.045); border-color:var(--line); color:var(--ink); } .tag { border-color:var(--line); color:var(--muted); } .check-box { border-color:rgba(255,255,255,.52); background:rgba(255,255,255,.08); box-shadow:inset 0 0 0 1px rgba(255,255,255,.16), 0 0 0 1px rgba(0,0,0,.18); } .check-box.todo { border-color:rgba(255,255,255,.48); background:rgba(255,255,255,.075); } .check-box.current,.check-box.done { border-color:#ff8a63; background:#ff8a63; color:#202020; } }
  </style>
</head>
<body data-reader-shell-version="${escapeHtml(READER_SHELL_VERSION)}" data-reader-shell-template="${escapeHtml(content.template)}">
  <nav class="reader-nav" aria-label="Spec navigation" data-no-tap-scroll><div class="reader-nav-shell"><a class="reader-brand" href="/design-wiki" aria-label="${escapeHtml(content.title)}" title="${escapeHtml(content.title)}">${escapeHtml(brandTitle)}</a><div class="reader-links">${navLinks.map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join('')}</div><a class="reader-nav-task" href="${escapeHtml(taskHref)}">Task</a></div></nav>
  <nav class="reader-section-rail" aria-label="Section progress" data-no-tap-scroll>${sectionRailLinks(sectionLinks)}</nav>
  <button class="reader-section-drawer-toggle" type="button" data-section-drawer-toggle data-no-tap-scroll aria-label="Open section drawer">☰</button>
  <div class="reader-section-drawer" data-section-drawer hidden data-no-tap-scroll><div class="reader-section-drawer-panel" role="dialog" aria-modal="true" aria-label="Section drawer"><div class="reader-section-drawer-head"><p>Sections</p><button type="button" data-section-drawer-close aria-label="Close section drawer">×</button></div><div class="reader-section-drawer-list">${sectionDrawerLinks(sectionLinks)}</div></div></div>
  <div class="reader-resume" id="reader-resume" data-auto-dismiss-ms="10000" data-no-tap-scroll>Resume reading <button type="button" data-resume>Continue</button></div>
  <button class="reader-back-to-top" type="button" data-no-tap-scroll aria-label="Back to top"><span class="reader-back-to-top-progress" aria-hidden="true"></span><b>↑</b></button>
  <button class="reader-tap-zone reader-tap-zone-left" type="button" data-tap-scroll="up" data-no-tap-scroll aria-label="Scroll up"></button>
  <button class="reader-tap-zone reader-tap-zone-right" type="button" data-tap-scroll="down" data-no-tap-scroll aria-label="Scroll down"></button>
  <div id="smooth-wrapper"><main id="smooth-content"><article>
    <section class="hero" id="top"><div class="container"><p class="eyebrow">${escapeHtml(content.eyebrow ?? content.template)}</p><h1>${escapeHtml(content.title)}</h1><p class="lead">${escapeHtml(content.thesis)}</p><p class="hero-thesis">Thesis: ${escapeHtml(content.thesis)}</p><div class="hero-grid"><div class="hero-card meta-grid">${renderMetadata(content.metadata)}</div>${renderMap(map)}</div></div></section>
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
    window.__readerShell = { shell:'consuelo-reader', version:${JSON.stringify(READER_SHELL_VERSION)}, template:${JSON.stringify(content.template)}, id:shellId, smoother:!!smoother, sectionCount:${sectionLinks.length} };
    const storageKey = 'consuelo-reader:' + shellId + ':scroll';
    const resume = document.getElementById('reader-resume');
    const saved = Number(localStorage.getItem(storageKey) || 0);
    if (saved > 420) { resume.style.display = 'flex'; setTimeout(() => { resume.style.display = 'none'; }, Number(resume.dataset.autoDismissMs || 10000)); }
    function scrollTop(){ return smoother ? smoother.scrollTop() : window.scrollY; }
    function go(target){ if (smoother) smoother.scrollTo(target, true, 'top 80px'); else document.querySelector(target)?.scrollIntoView({ behavior:'smooth' }); }
    function pageStep(direction){ const max = Math.max(1, document.documentElement.scrollHeight - innerHeight); const delta = innerHeight * 0.62 * (direction === 'up' ? -1 : 1); const target = Math.max(0, Math.min(max, scrollTop() + delta)); if (smoother) smoother.scrollTo(target, true); else scrollTo({ top:target, behavior:'smooth' }); }
    const drawer = document.querySelector('[data-section-drawer]');
    function openSectionDrawer(){ if (!drawer) return; drawer.hidden = false; document.body.dataset.sectionDrawer = 'open'; }
    function closeSectionDrawer(){ if (!drawer) return; drawer.hidden = true; delete document.body.dataset.sectionDrawer; }
    function isSmallScreen(){ return window.matchMedia('(max-width: 680px)').matches; }
    document.querySelector('[data-section-drawer-toggle]')?.addEventListener('click', openSectionDrawer);
    document.querySelector('[data-section-drawer-close]')?.addEventListener('click', closeSectionDrawer);
    document.querySelectorAll('a[href^="#"], [data-target]').forEach((el) => el.addEventListener('click', (event) => { const target = el.getAttribute('href') || el.dataset.target; if (!target) return; if (el.classList.contains('reader-section-line') && isSmallScreen()) { event.preventDefault(); openSectionDrawer(); return; } event.preventDefault(); closeSectionDrawer(); go(target); }));
    document.querySelectorAll('[data-tap-scroll]').forEach((el) => el.addEventListener('click', (event) => { event.preventDefault(); pageStep(el.dataset.tapScroll); }));
    document.querySelector('[data-resume]')?.addEventListener('click', () => { resume.style.display = 'none'; if (smoother) smoother.scrollTo(saved, true); else scrollTo({ top:saved, behavior:'smooth' }); });
    document.querySelector('.reader-back-to-top')?.addEventListener('click', () => go('#top'));
    function writeClipboard(text){ if (!text || !navigator.clipboard) return Promise.resolve(false); return navigator.clipboard.writeText(text).then(() => true).catch(() => false); }
    function copySelectedText(){ const selection = window.getSelection(); const text = selection && !selection.isCollapsed ? selection.toString().trim() : ''; if (!text) return; window.__readerLastFindNeedle = text; void writeClipboard(text); }
    let selectionCopyTimer = 0;
    document.addEventListener('selectionchange', () => { clearTimeout(selectionCopyTimer); selectionCopyTimer = window.setTimeout(copySelectedText, 180); });
    document.querySelectorAll('[data-copy-markdown]').forEach((button) => button.addEventListener('click', (event) => { event.preventDefault(); writeClipboard(button.getAttribute('data-copy-markdown') || '').then((ok) => { button.dataset.copied = ok ? 'true' : 'false'; window.setTimeout(() => { delete button.dataset.copied; }, 1400); }); }));
    function findNextOccurrence(needle){ if (!needle) return false; const root = document.querySelector('#smooth-content') || document.body; const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const ranges = []; let node; while ((node = walker.nextNode())) { const text = node.nodeValue || ''; const lower = text.toLowerCase(); const target = needle.toLowerCase(); let index = lower.indexOf(target); while (index !== -1) { const range = document.createRange(); range.setStart(node, index); range.setEnd(node, index + needle.length); ranges.push(range); index = lower.indexOf(target, index + Math.max(1, needle.length)); } } if (!ranges.length) return false; const y = scrollTop(); const next = ranges.find((range) => range.getBoundingClientRect().top + y > y + 32) || ranges[0]; const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(next); const element = next.startContainer.parentElement?.closest('[id]'); if (element) go('#' + element.id); return true; }
    function handleReaderFindEnter(event){ if (event.key !== 'Enter' || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return; const active = document.activeElement; if (active && ['INPUT','TEXTAREA','SELECT'].includes(active.tagName)) return; const selected = window.getSelection()?.toString().trim(); const needle = selected || window.__readerLastFindNeedle || ''; if (!needle || needle.length > 120) return; if (findNextOccurrence(needle)) event.preventDefault(); }
    document.addEventListener('keydown', handleReaderFindEnter);
    const topButton = document.querySelector('.reader-back-to-top');
    const railButtons = [...document.querySelectorAll('.reader-section-rail button')];
    function tick(){ const y = scrollTop(); const max = Math.max(1, document.documentElement.scrollHeight - innerHeight); const pct = Math.min(100, Math.max(0, y / max * 100)); topButton.style.setProperty('--reader-scroll', pct + '%'); topButton.classList.toggle('visible', y > 700); localStorage.setItem(storageKey, String(Math.round(y))); railButtons.forEach((button) => { const target = document.querySelector(button.dataset.target); if (!target) return; const active = y >= target.offsetTop - 160 && y < target.offsetTop + target.offsetHeight - 160; button.classList.toggle('active', active); }); requestAnimationFrame(tick); }
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
    writeStderr('usage: bun run packages/consuelo-design/scripts/render-consuelo-reader.ts --template <spec|plan|guide> --input <content.json> --out <index.html>');
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
  writeStdout(JSON.stringify({ ok: true, out, template: content.template, readerShellVersion: READER_SHELL_VERSION }, null, 2));
}
