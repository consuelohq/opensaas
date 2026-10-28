import { formatDuration, formatTokens } from './model';
import type { NormalizedTraceRow, TraceChild, TraceHomeModel, TraceHomeRenderOptions } from './types';

const TIMESTAMP_WIDTH = 19;
const TOOL_WIDTH = 16;
const DURATION_WIDTH = 7;
const TOKENS_WIDTH = 7;
const MIN_BRANCH_WIDTH = 34;

type TableLayout = {
  branchWidth: number;
};

function stripAnsi(value: string): string {
  return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

function fit(value: string, width: number): string {
  if (width <= 0) return '';
  const text = String(value ?? '').replace(/\n/g, ' ');
  const plain = stripAnsi(text);
  if (plain.length > width) return `${plain.slice(0, Math.max(0, width - 1))}…`;
  return text + ' '.repeat(Math.max(0, width - plain.length));
}
function h(width: number): string {
  return '─'.repeat(Math.max(0, width));
}

function boxed(title: string, body: string[], width: number, height: number): string[] {
  const inner = Math.max(1, width - 2);
  const rows = [`┌─ ${fit(title, Math.max(1, inner - 3))}┐`];
  for (let i = 0; i < Math.max(0, height - 2); i += 1) rows.push(`│${fit(body[i] || '', inner)}│`);
  rows.push(`└${h(inner)}┘`);
  return rows.map((line) => fit(line, width));
}

function zip(left: string[], right: string[], gap = '  '): string[] {
  const rows = Math.max(left.length, right.length);
  return Array.from({ length: rows }, (_, i) => `${left[i] || ''}${gap}${right[i] || ''}`.trimEnd());
}

function tableLayout(mainWidth: number): TableLayout {
  const innerWidth = Math.max(1, mainWidth - 2);
  const fixedWidth = 1 + 1 + TIMESTAMP_WIDTH + 2 + TOOL_WIDTH + 1 + DURATION_WIDTH + 1 + TOKENS_WIDTH + 1;
  return { branchWidth: Math.max(MIN_BRANCH_WIDTH, innerWidth - fixedWidth) };
}

function tableHeader(layout: TableLayout): string {
  return `${fit('', 1)} ${fit('TIMESTAMP', TIMESTAMP_WIDTH)}  ${fit('TOOL', TOOL_WIDTH)} ${fit('DUR', DURATION_WIDTH)} ${fit('TOKENS', TOKENS_WIDTH)} ${fit('BRANCH / TASK', layout.branchWidth)}`;
}

function statusToolCell(ok: boolean, tool: string): string {
  return `${ok ? '✓' : '✕'} ${tool}`;
}

function rowLine(row: NormalizedTraceRow, selected: boolean, layout: TableLayout): string {
  return `${fit(selected ? '▸' : ' ', 1)} ${fit(row.time, TIMESTAMP_WIDTH)}  ${fit(statusToolCell(row.ok, row.tool), TOOL_WIDTH)} ${fit(formatDuration(row.durationMs), DURATION_WIDTH)} ${fit(formatTokens(row.totalTokens), TOKENS_WIDTH)} ${fit(row.shortBranch, layout.branchWidth)}`;
}

function childLine(child: TraceChild, layout: TableLayout): string {
  return `  ${fit('', 1)} ${fit('', TIMESTAMP_WIDTH)}  ${fit(`├─ ${statusToolCell(child.ok, child.tool)}`, TOOL_WIDTH)} ${fit(formatDuration(child.durationMs), DURATION_WIDTH)} ${fit(formatTokens(child.totalTokens), TOKENS_WIDTH)} ${fit(child.detail, layout.branchWidth)}`;
}

function keybar(): string {
  return 'enter: open   space: pause live   /: search   f: failed   b: filter branch   t: filter tool   g: group   r: refresh   c: copy id   ?: help   q: quit';
}

function topPaneHeight(height: number): number {
  const bottomHeight = Math.max(6, Math.min(12, Math.floor(height * 0.22)));
  return Math.max(16, height - bottomHeight - 3);
}

export function renderTraceHome(model: TraceHomeModel, options: TraceHomeRenderOptions = {}): string {
  const width = Math.max(100, options.width || 151);
  const height = Math.max(28, options.height || 44);
  const sidebarWidth = Math.max(34, Math.min(42, Math.floor(width * 0.22)));
  const mainWidth = width - sidebarWidth - 2;
  const topHeight = topPaneHeight(height);
  const layout = tableLayout(mainWidth);
  const header = `${model.header.title}   ${model.header.live ? 'LIVE ●' : 'PAUSED'}   since ${model.header.since}   rows ${model.header.rows.toLocaleString('en-US')}   errors ${model.header.errors}   running ${model.header.running}   branches ${model.header.branches}   filter ${model.header.filter}   group ${model.header.group}   space pause · ? help`;
  const table = [tableHeader(layout), h(mainWidth - 2)];
  const rowBudget = Math.max(3, topHeight - 4);
  const start = Math.max(0, model.selectedIndex - Math.floor(rowBudget / 2));
  for (const row of model.visibleRows.slice(start, start + rowBudget)) {
    table.push(rowLine(row, row.traceId === model.selected?.traceId, layout));
    for (const child of row.children.slice(0, 3)) table.push(childLine(child, layout));
  }
  const main = boxed('live trace table', table, mainWidth, topHeight);
  const sideBody = [
    'SUMMARY',
    `rows      ${model.summary.rows}`,
    `errors    ${model.summary.errors}`,
    `running   ${model.summary.running}`,
    `branches  ${model.summary.branches}`,
    `since     ${model.summary.since}`,
    '',
    'TOP TOOLS (TOKENS)',
    ...model.topTools.slice(0, 6).map((tool) => `${fit(tool.tool, 18)} ${fit(formatTokens(tool.tokens), 7)} ${tool.calls}x`),
    '',
    'RAW SHELL (TASK.CALL / TASK.EXEC)',
    `total     ${model.rawShell.total}`,
    `good      ${model.rawShell.good}`,
    `suspect   ${model.rawShell.suspect}`,
    `bad       ${model.rawShell.bad}`,
  ];
  const top = zip(main, boxed('sidebar', sideBody, sidebarWidth, topHeight));
  const bottomHeight = height - topHeight - 3;
  const paneGap = 2;
  const paneWidth = Math.floor((width - paneGap * 2) / 3);
  const inspect = model.inspect ? [
    `status ${model.inspect.status}`,
    `duration ${model.inspect.duration}`,
    `tokens ${model.inspect.tokens}`,
    `branch/task ${model.inspect.branch}`,
    `timing ${model.inspect.timing}`,
    `command quality ${model.inspect.commandQuality?.quality || 'none'}`,
    model.inspect.commandQuality ? `reason ${model.inspect.commandQuality.reason}` : '',
    model.inspect.commandQuality?.replacement ? `replacement ${model.inspect.commandQuality.replacement}` : '',
    model.inspect.tabs.join(' | '),
    `command ${model.inspect.command}`,
    model.inspect.stderr ? `stderr ${model.inspect.stderr}` : '',
  ].filter(Boolean) : [];
  const rawJsonLines = model.rawJson.split('\n').slice(0, bottomHeight - 2);
  const bottom = zip(
    zip(
      boxed('trace:inspect', inspect, paneWidth, bottomHeight),
      boxed('trace:tree', model.tree.lines.slice(0, bottomHeight - 2), paneWidth, bottomHeight),
      '  ',
    ),
    boxed('trace:json', rawJsonLines, width - paneWidth * 2 - paneGap * 2, bottomHeight),
    '  ',
  );
  const frame = [fit(header, width), ...top, fit(keybar(), width), ...bottom].slice(0, height);
  while (frame.length < height) frame.push('');
  return frame.map((line) => fit(line, width)).join('\n');
}
