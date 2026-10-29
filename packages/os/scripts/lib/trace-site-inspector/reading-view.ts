import {
  parseMaybeJson,
  traceNodeLabel,
  traceRouteLabel,
  type TokenCount,
  type TraceRecord,
} from './model';
import {
  inspectorSections,
  type InspectorReadingSection,
} from './inspector-state';

export function escapeTraceHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatTokenCount(count: TokenCount): string {
  if (count.value === null) return '—';
  const value =
    count.value >= 1_000_000
      ? (count.value / 1_000_000).toFixed(2) + 'M'
      : count.value >= 1_000
        ? (count.value / 1_000).toFixed(1) + 'K'
        : String(Math.round(count.value));
  return (count.estimated ? '≈' : '') + value;
}

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const transportKeys = new Set(['requestId', 'taskSession', 'workSession']);

export function inspectorReadingValue(
  row: TraceRecord,
  section: InspectorReadingSection,
): unknown {
  const sections = inspectorSections(row);
  const input = sections.find((item) => item.id === 'input')?.value;
  if (section === 'input') {
    const fields = record(parseMaybeJson(input));
    return fields
      ? Object.fromEntries(
          Object.entries(fields).filter(([key]) => !transportKeys.has(key)),
        )
      : input;
  }
  if (section === 'details') {
    const metadata =
      record(sections.find((item) => item.id === 'metadata')?.value) ?? {};
    const bookkeeping = Object.fromEntries(
      Object.entries(record(input) ?? {}).filter(([key]) =>
        transportKeys.has(key),
      ),
    );
    return Object.fromEntries(
      Object.entries({
        ...metadata,
        ...bookkeeping,
        node: traceNodeLabel(row),
        route: traceRouteLabel(row),
        error: sections.find((item) => item.id === 'error')?.value,
      }).filter(
        ([, value]) => value !== null && value !== undefined && value !== '',
      ),
    );
  }
  let output = sections.find((item) => item.id === 'output')?.value;
  for (let depth = 0; depth < 8; depth++) {
    const envelope = record(output);
    if (
      !envelope ||
      typeof envelope.ok !== 'boolean' ||
      typeof envelope.code !== 'string' ||
      !('data' in envelope)
    )
      break;
    output = envelope.data;
  }
  return output;
}

function serialized(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function valueMarkup(value: unknown, key: string): string {
  const text = serialized(value);
  const code =
    /^(?:code|stdout|stderr|command|script|sql|diff|stack|path|file|cwd|.*Json|.*Id)$/i.test(
      key,
    );
  const tag = code ? 'pre' : 'div';
  return (
    '<' +
    tag +
    ' class="' +
    (code ? 'tiCodeValue' : 'tiTextValue') +
    '">' +
    escapeTraceHtml(text) +
    '</' +
    tag +
    '>'
  );
}

export function renderInspectorPayload(value: unknown, depth = 0): string {
  const parsed = parseMaybeJson(value);
  if (parsed === null || parsed === undefined || parsed === '') {
    return '<p class="tiEmptyValue">No value recorded.</p>';
  }
  if (depth >= 8 || typeof parsed !== 'object') return valueMarkup(parsed, '');
  const entries = Array.isArray(parsed)
    ? parsed.map((item, index) => [String(index), item] as const)
    : Object.entries(parsed);
  if (!entries.length)
    return (
      '<p class="tiEmptyValue">' +
      (Array.isArray(parsed) ? 'Empty array' : 'Empty object') +
      '</p>'
    );
  // Command results put the useful text ahead of runtime bookkeeping.
  const ordered = [...entries].sort(
    ([a], [b]) =>
      Number(/^(stdout|output|content)$/.test(b)) -
      Number(/^(stdout|output|content)$/.test(a)),
  );
  return (
    '<dl class="tiFields">' +
    ordered
      .map(([key, item]) => {
        const nested = item !== null && typeof item === 'object';
        const text = serialized(item);
        const long = nested || text.includes('\n') || text.length > 120;
        const body = nested
          ? '<details class="tiObject"' +
            (depth === 0 ? ' open' : '') +
            '><summary>' +
            (Array.isArray(item)
              ? item.length + ' items'
              : Object.keys(item).length + ' fields') +
            '</summary>' +
            renderInspectorPayload(item, depth + 1) +
            '</details>'
          : valueMarkup(item, key);
        return (
          '<div class="tiField' +
          (long ? ' tiLongField' : '') +
          '"><dt>' +
          escapeTraceHtml(key) +
          '</dt><dd>' +
          body +
          '</dd></div>'
        );
      })
      .join('') +
    '</dl>'
  );
}

export function renderInspectorReading(
  row: TraceRecord,
  section: InspectorReadingSection,
): string {
  const labels: Record<InspectorReadingSection, string> = {
    output: 'Output',
    input: 'Input',
    details: 'Details',
  };
  const tabs = (Object.keys(labels) as InspectorReadingSection[])
    .map(
      (id) =>
        '<button type="button" role="tab" id="ti-tab-' +
        id +
        '" aria-selected="' +
        (id === section) +
        '" aria-controls="ti-reading-panel" tabindex="' +
        (id === section ? '0' : '-1') +
        '" data-ti-section-tab="' +
        id +
        '">' +
        labels[id] +
        '</button>',
    )
    .join('');
  return (
    '<section class="tiSection tiReading" data-ti-section="' +
    section +
    '"><header><div class="tiReadingTabs" role="tablist" aria-label="Call content">' +
    tabs +
    '</div><button type="button" data-ti-copy aria-label="Copy ' +
    labels[section] +
    '">Copy</button></header>' +
    '<div class="tiSectionBody" id="ti-reading-panel" role="tabpanel" aria-labelledby="ti-tab-' +
    section +
    '">' +
    renderInspectorPayload(inspectorReadingValue(row, section)) +
    '</div></section>'
  );
}
