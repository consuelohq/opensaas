import {
  parseMaybeJson,
  extractTraceError,
  isFailure,
  traceNodeLabel,
  traceRouteLabel,
  type TokenCount,
  type TraceRecord,
} from './model';
import {
  inspectorSections,
  type InspectorReadingSection,
} from './inspector-state';
import {
  prepareTraceReading,
  traceObject,
  type TraceToolProfile,
} from './tool-presentation';

export function escapeTraceHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatTokenCount(count: TokenCount): string {
  return count.value === null || count.estimated
    ? '—'
    : Math.round(count.value).toLocaleString('en-US');
}

export function inspectorReadingValue(
  row: TraceRecord,
  section: InspectorReadingSection,
): unknown {
  const prepared = prepareTraceReading(row);
  if (section === 'input') return prepared.input;
  if (section === 'output') return prepared.output;
  const metadata =
    traceObject(
      inspectorSections(row).find((item) => item.id === 'metadata')?.value,
    ) ?? {};
  return Object.fromEntries(
    Object.entries({
      ...metadata,
      ...prepared.bookkeeping,
      node: traceNodeLabel(row),
      route: traceRouteLabel(row),
    }).filter(
      ([, value]) => value !== null && value !== undefined && value !== '',
    ),
  );
}

function serialized(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function inlineMarkdown(text: string): string {
  // Escape source HTML first. Only these explicitly generated elements are allowed.
  return text
    .split(/(\x60[^\x60]+\x60)/g)
    .map((part) => {
      if (part.startsWith('\x60') && part.endsWith('\x60'))
        return '<code>' + escapeTraceHtml(part.slice(1, -1)) + '</code>';
      return escapeTraceHtml(part)
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (original, label, url) =>
          /^(?:https?:\/\/|mailto:|\/(?!\/)|#)/i.test(url)
            ? '<a href="' +
              url +
              '" target="_blank" rel="noopener noreferrer">' +
              label +
              '</a>'
            : original,
        )
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(?:^|(?<=\s))\*([^*]+)\*/g, '<em>$1</em>');
    })
    .join('');
}

export function renderTraceMarkdown(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const result: string[] = [];
  let paragraph: string[] = [];
  let list = '';
  let fence: string | null = null;
  let code: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) {
      result.push('<p>' + paragraph.map(inlineMarkdown).join('<br>') + '</p>');
      paragraph = [];
    }
  };
  const closeList = () => {
    if (list) {
      result.push('</' + list + '>');
      list = '';
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenced = line.match(/^\s*(\x60{3,}|~{3,})/);
    if (fence) {
      if (
        fenced &&
        fenced[1][0] === fence[0] &&
        fenced[1].length >= fence.length
      ) {
        result.push(
          '<pre class="tiCodeValue"><code>' +
            escapeTraceHtml(code.join('\n')) +
            '</code></pre>',
        );
        code = [];
        fence = null;
      } else code.push(line);
      continue;
    }
    if (fenced) {
      flushParagraph();
      closeList();
      fence = fenced[1];
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      result.push(
        '<h' +
          heading[1].length +
          '>' +
          inlineMarkdown(heading[2]) +
          '</h' +
          heading[1].length +
          '>',
      );
      continue;
    }
    const item = line.match(/^\s*(?:([-*+])|\d+[.)])\s+(.+)$/);
    if (item) {
      flushParagraph();
      const tag = item[1] ? 'ul' : 'ol';
      if (list !== tag) {
        closeList();
        result.push('<' + tag + '>');
        list = tag;
      }
      result.push('<li>' + inlineMarkdown(item[2]) + '</li>');
      continue;
    }
    closeList();
    if (/^\s*$/.test(line)) {
      flushParagraph();
      continue;
    }
    if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) {
      flushParagraph();
      result.push('<hr>');
      continue;
    }
    if (line.startsWith('> ')) {
      flushParagraph();
      result.push(
        '<blockquote>' + inlineMarkdown(line.slice(2)) + '</blockquote>',
      );
      continue;
    }
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:|-]+\|[\s:|-]+\|?\s*$/.test(lines[i + 1])
    ) {
      flushParagraph();
      const cells = (row: string) =>
        row
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((cell) => inlineMarkdown(cell.trim()));
      result.push(
        '<div class="tiMarkdownTable"><table><thead><tr>' +
          cells(line)
            .map((cell) => '<th>' + cell + '</th>')
            .join('') +
          '</tr></thead><tbody>',
      );
      i++;
      while (i + 1 < lines.length && lines[i + 1].includes('|'))
        result.push(
          '<tr>' +
            cells(lines[++i])
              .map((cell) => '<td>' + cell + '</td>')
              .join('') +
            '</tr>',
        );
      result.push('</tbody></table></div>');
      continue;
    }
    paragraph.push(line);
  }
  if (fence)
    result.push(
      '<pre class="tiCodeValue"><code>' +
        escapeTraceHtml(code.join('\n')) +
        '</code></pre>',
    );
  flushParagraph();
  closeList();
  return '<article class="tiMarkdown">' + result.join('') + '</article>';
}

function valueMarkup(value: unknown, key: string, markdown = false): string {
  const text = serialized(value);
  if (markdown) return renderTraceMarkdown(text);
  const code =
    /^(?:code|stdout|stderr|command|script|sql|diff|patch|patchText|stack|path|file|cwd|snapshot|preview|.*Json|.*Id)$/i.test(
      key,
    );
  return (
    '<' +
    (code ? 'pre' : 'div') +
    ' class="' +
    (code ? 'tiCodeValue' : 'tiTextValue') +
    '">' +
    escapeTraceHtml(text) +
    '</' +
    (code ? 'pre' : 'div') +
    '>'
  );
}

type RenderOptions = {
  profile?: TraceToolProfile;
  input?: boolean;
  expand?: boolean;
  markdown?: boolean;
  path?: string;
};
function cardTitle(value: Record<string, unknown>, index: number): string {
  return String(
    value.symbol ??
      value.name ??
      value.tool ??
      value.title ??
      value.path ??
      value.identifier ??
      value.url ??
      'Result ' + (index + 1),
  );
}

export function renderInspectorPayload(
  value: unknown,
  depth = 0,
  options: RenderOptions = {},
): string {
  const parsed = parseMaybeJson(value);
  if (parsed === null || parsed === undefined || parsed === '')
    return '<p class="tiEmptyValue">No value recorded.</p>';
  if (depth >= 10 || typeof parsed !== 'object')
    return valueMarkup(parsed, '', options.markdown);
  if (Array.isArray(parsed)) {
    if (!parsed.length) return '<p class="tiEmptyValue">No items.</p>';
    if (parsed.every((item) => traceObject(item))) {
      return (
        '<div class="tiResultList">' +
        parsed
          .map((item, index) => {
            const fields = traceObject(item)!;
            const title = cardTitle(fields, index);
            let body: unknown = fields;
            if (
              typeof fields.ok === 'boolean' &&
              ('data' in fields || 'result' in fields)
            ) {
              body = prepareTraceReading({
                name: fields.tool ?? fields.name,
                rawResultJson: fields,
              }).output;
            }
            return (
              '<article class="tiResultCard"><h4>' +
              escapeTraceHtml(title) +
              '</h4>' +
              renderInspectorPayload(body, depth + 1, {
                ...options,
                path: (options.path ?? '') + '[' + index + ']',
                expand: true,
                markdown:
                  options.markdown ||
                  /\.mdx?$/i.test(String(fields.path ?? '')),
              }) +
              '</article>'
            );
          })
          .join('') +
        '</div>'
      );
    }
    return (
      '<ul class="tiValueList">' +
      parsed.map((item) => '<li>' + valueMarkup(item, '') + '</li>').join('') +
      '</ul>'
    );
  }
  const fields = parsed as Record<string, unknown>;
  const entries = Object.entries(fields);
  if (!entries.length)
    return (
      '<p class="tiEmptyValue">' +
      (options.input ? 'No parameters.' : 'No fields recorded.') +
      '</p>'
    );
  const priority = options.input
    ? options.profile?.input
    : options.profile?.output;
  const ordered = [...entries].sort(([a], [b]) => {
    const rank = (key: string) => {
      const index = priority?.indexOf(key) ?? -1;
      return index >= 0 ? index : 100;
    };
    return rank(a) - rank(b);
  });
  return (
    '<dl class="tiFields">' +
    ordered
      .map(([key, item]) => {
        const nested = item !== null && typeof item === 'object';
        const text = serialized(item);
        const long = nested || text.includes('\n') || text.length > 120;
        const secondary =
          !options.input && Boolean(options.profile?.secondary.includes(key));
        const important =
          options.input ||
          options.expand ||
          Boolean(priority?.includes(key)) ||
          /error|reason|message|cause|detail/i.test(key);
        const markdown =
          key === 'content' &&
          (options.markdown ||
            options.profile?.family === 'steering' ||
            String(fields.mime ?? '').includes('markdown') ||
            /\.mdx?$/i.test(String(fields.path ?? '')));
        let body: string;
        if (options.input && key === 'files' && Array.isArray(item)) {
          body =
            '<ul class="tiFileTargets">' +
            item
              .map((file) => {
                const target = traceObject(file);
                const path = target?.path ?? file;
                const range = target?.from
                  ? 'lines ' + target.from + (target.to ? '–' + target.to : '+')
                  : '';
                return (
                  '<li><code>' +
                  escapeTraceHtml(path) +
                  '</code><small>' +
                  escapeTraceHtml(range) +
                  '</small></li>'
                );
              })
              .join('') +
            '</ul>';
        } else if (
          Array.isArray(item) &&
          item.every((value) => typeof value === 'string') &&
          /^(?:rawArgs|command|args)$/.test(key)
        ) {
          body = valueMarkup(item.join(' '), 'command');
        } else if (nested) {
          const content = renderInspectorPayload(item, depth + 1, {
            ...options,
            path: (options.path ?? '') + '.' + key,
            expand: important && !secondary,
            markdown: options.markdown,
          });
          const open = !secondary && (important || depth === 0);
          // Arrays of semantic results are already individually named and readable.
          body =
            Array.isArray(item) && open
              ? content
              : '<details class="tiObject" data-ti-disclosure="' +
                escapeTraceHtml((options.path ?? '') + '.' + key) +
                '"' +
                (open ? ' open' : '') +
                '><summary>' +
                (Array.isArray(item)
                  ? item.length + ' items'
                  : Object.keys(item).length + ' fields') +
                '</summary>' +
                content +
                '</details>';
        } else if (secondary) {
          body =
            '<details class="tiObject" data-ti-disclosure="' +
            escapeTraceHtml((options.path ?? '') + '.' + key) +
            '"><summary>Show ' +
            escapeTraceHtml(key) +
            '</summary>' +
            valueMarkup(item, key, markdown) +
            '</details>';
        } else body = valueMarkup(item, key, markdown);
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
  _section?: InspectorReadingSection,
): string {
  const prepared = prepareTraceReading(row);
  const options = { profile: prepared.profile };
  const insight = isFailure(row) ? extractTraceError(row) : null;
  const alerts = [
    ...new Set([...prepared.alerts, ...(insight ? [insight.detail] : [])]),
  ];
  const error = alerts.length
    ? '<div class="tiCallError" role="alert"><strong>' +
      escapeTraceHtml(insight?.code || 'Call failed') +
      '</strong>' +
      alerts
        .map((message) => '<p>' + escapeTraceHtml(message) + '</p>')
        .join('') +
      '</div>'
    : '';
  const section = (id: 'input' | 'output', value: unknown) =>
    '<section class="tiSection tiReading" data-ti-section="' +
    id +
    '"><header><h3>' +
    (id === 'input' ? 'Input' : 'Output') +
    '</h3><button type="button" data-ti-copy aria-label="Copy ' +
    id +
    '">Copy</button></header><div class="tiSectionBody">' +
    renderInspectorPayload(value, 0, {
      ...options,
      input: id === 'input',
      expand: id === 'input',
    }) +
    '</div></section>';
  const details = inspectorReadingValue(row, 'details');
  return (
    error +
    section('input', prepared.input) +
    section('output', prepared.output) +
    '<details class="tiDiagnostics" data-ti-disclosure="call-details" data-ti-section="details"><summary>Call details</summary><div class="tiSectionBody">' +
    renderInspectorPayload(details) +
    '</div></details>'
  );
}
