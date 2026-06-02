import { formatDuration, formatTokens } from './model';
import type { NormalizedTraceRow, TraceHomeModel, TraceHomeRenderOptions } from './types';

function stripAnsi(value: string): string { return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, ''); }
function fit(value: string, width: number): string { if (width <= 0) return ''; const text = String(value ?? '').replace(/\n/g, ' '); const plain = stripAnsi(text); if (plain.length > width) return `${plain.slice(0, Math.max(0, width - 1))}…`; return text + ' '.repeat(Math.max(0, width - plain.length)); }
function h(width: number): string { return '─'.repeat(Math.max(0, width)); }
function boxed(title: string, body: string[], width: number, height: number): string[] { const inner = Math.max(1, width - 2); const rows = [`┌─ ${fit(title, Math.max(1, inner - 3))}┐`]; for (let i = 0; i < Math.max(0, height - 2); i += 1) rows.push(`│${fit(body[i] || '', inner)}│`); rows.push(`└${h(inner)}┘`); return rows.map((line) => fit(line, width)); }
function zip(left: string[], right: string[], gap = '  '): string[] { const rows = Math.max(left.length, right.length); return Array.from({ length: rows }, (_, i) => `${left[i] || ''}${gap}${right[i] || ''}`.trimEnd()); }
function rowLine(row: NormalizedTraceRow, selected: boolean): string { return [fit(selected ? '▸' : ' ', 1), fit(row.time, 8), fit(row.ok ? '✓' : '✕', 3), fit(row.tool, 13), fit(formatDuration(row.durationMs), 7), fit(formatTokens(row.totalTokens), 7), fit(row.shortBranch, 30), fit(row.message, 74)].join(' '); }
function keybar(): string { return 'enter: open   space: pause live   /: search   f: failed   b: filter branch   t: filter tool   g: group   r: refresh   c: copy id   ?: help   q: quit'; }

export function renderTraceHome(model: TraceHomeModel, options: TraceHomeRenderOptions = {}): string {
  const width = Math.max(100, options.width || 151);
  const height = Math.max(28, options.height || 44);
  const sidebarWidth = Math.max(34, Math.min(46, Math.floor(width * 0.28)));
  const mainWidth = width - sidebarWidth - 2;
  const topHeight = Math.max(10, height - 17);
  const header = `${model.header.title}   ${model.header.live ? 'LIVE ●' : 'PAUSED'}   since ${model.header.since}   rows ${model.header.rows.toLocaleString('en-US')}   errors ${model.header.errors}   running ${model.header.running}   branches ${model.header.branches}   filter ${model.header.filter}   group ${model.header.group}   space pause · ? help`;
  const table = ['TIME     ST  TOOL          DUR     TOKENS  BRANCH / TASK                  MESSAGE / COMMAND', h(mainWidth - 2)];
  const rowBudget = Math.max(3, topHeight - 4);
  const start = Math.max(0, model.selectedIndex - Math.floor(rowBudget / 2));
  for (const row of model.visibleRows.slice(start, start + rowBudget)) {
    table.push(rowLine(row, row.traceId === model.selected?.traceId));
    for (const child of row.children.slice(0, 3)) table.push(`  ${fit('├─ ' + (child.ok ? '✓' : '✕'), 6)} ${fit(child.tool, 13)} ${fit(formatDuration(child.durationMs), 7)} ${fit(formatTokens(child.totalTokens), 7)} ${fit(row.shortBranch, 30)} ${fit(child.detail, 70)}`);
  }
  const main = boxed('live trace table', table, mainWidth, topHeight);
  const sideBody = ['SUMMARY', `rows      ${model.summary.rows}`, `errors    ${model.summary.errors}`, `running   ${model.summary.running}`, `branches  ${model.summary.branches}`, `since     ${model.summary.since}`, '', 'TOP TOOLS (TOKENS)', ...model.topTools.slice(0, 6).map((tool) => `${fit(tool.tool, 18)} ${fit(formatTokens(tool.tokens), 7)} ${tool.calls}x`), '', 'RAW SHELL (TASK.CALL / TASK.EXEC)', `total     ${model.rawShell.total}`, `good      ${model.rawShell.good}`, `suspect   ${model.rawShell.suspect}`, `bad       ${model.rawShell.bad}`];
  const top = zip(main, boxed('sidebar', sideBody, sidebarWidth, topHeight));
  const bottomHeight = height - topHeight - 3;
  const paneGap = 2;
  const paneWidth = Math.floor((width - paneGap * 2) / 3);
  const inspect = model.inspect ? [`status ${model.inspect.status}`, `duration ${model.inspect.duration}`, `tokens ${model.inspect.tokens}`, `branch/task ${model.inspect.branch}`, `timing ${model.inspect.timing}`, `command quality ${model.inspect.commandQuality?.quality || 'none'}`, model.inspect.commandQuality ? `reason ${model.inspect.commandQuality.reason}` : '', model.inspect.commandQuality?.replacement ? `replacement ${model.inspect.commandQuality.replacement}` : '', model.inspect.tabs.join(' | '), `command ${model.inspect.command}`, model.inspect.stderr ? `stderr ${model.inspect.stderr}` : ''].filter(Boolean) : [];
  const bottom = zip(zip(boxed('trace:inspect', inspect, paneWidth, bottomHeight), boxed('trace:tree', model.tree.lines.slice(0, bottomHeight - 2), paneWidth, bottomHeight), '  '), boxed('trace:json', model.rawJson.split('\n').slice(0, bottomHeight - 2), width - paneWidth * 2 - paneGap * 2, bottomHeight), '  ');
  const frame = [fit(header, width), ...top, fit(keybar(), width), ...bottom].slice(0, height);
  while (frame.length < height) frame.push('');
  return frame.map((line) => fit(line, width)).join('\n');
}
