import { parseMaybeJson, type TraceRecord } from './model';

export type SkillDocumentSummary = {
  name: string;
  description: string;
  highlights: string[];
  fullText: string;
  path: string;
};

type Fields = Record<string, unknown>;
const asObject = (value: unknown): Fields | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Fields)
    : null;
const clean = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

function readSkillInput(row: Partial<TraceRecord>): Fields | null {
  const raw = row.rawResolvedInputJson ?? row.rawInputJson ??
    row.resolvedInputObj ?? row.inputObj ?? row.input;
  return asObject(parseMaybeJson(raw));
}

function skillText(value: unknown, depth = 0): string {
  if (depth > 6 || value === null || value === undefined) return '';
  const parsed = parseMaybeJson(value);
  if (typeof parsed === 'string') {
    const text = parsed.trim();
    return text.length > 20 && /(?:^|\n)\s*(?:#|---|name:|description:|[-*] )/.test(text)
      ? text.slice(0, 120_000) : '';
  }
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const text = skillText(item, depth + 1);
      if (text) return text;
    }
    return '';
  }
  const fields = asObject(parsed);
  if (!fields) return '';
  for (const key of ['content', 'markdown', 'body', 'text', 'data', 'result', 'files', 'items']) {
    const text = skillText(fields[key], depth + 1);
    if (text) return text;
  }
  return '';
}

const humanLine = (value: string) => value
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/[\x60*_#]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 200);

/**
 * This is an explanation of already recorded, untrusted skill text; it does not
 * import, execute, follow or modify the skill. The raw JSON view stays available.
 */
export function summarizeSkillDocument(
  row: Partial<TraceRecord>,
  output: unknown,
): SkillDocumentSummary | null {
  const input = readSkillInput(row);
  const path = clean(input?.path ?? input?.uri ?? input?.file ?? input?.name);
  if (!/(?:^|[\\/])skill\.md(?:$|[?#])/i.test(path)) return null;
  const fullText = skillText(output);
  if (!fullText) return null;
  const lines = fullText.replace(/\r\n/g, '\n').split('\n');
  let frontmatterName = '';
  let frontmatterDescription = '';
  let start = 0;
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
    if (end > 0 && end <= 60) {
      for (const line of lines.slice(1, end)) {
        const name = line.match(/^name:\s*(.+)$/i);
        const desc = line.match(/^description:\s*(.+)$/i);
        if (name) frontmatterName = humanLine(name[1].replace(/^["']|["']$/g, ''));
        if (desc) frontmatterDescription = humanLine(desc[1].replace(/^["']|["']$/g, ''));
      }
      start = end + 1;
    }
  }
  const heading = lines.slice(start).find((line) => /^#\s+\S/.test(line.trim()));
  const name = humanLine(heading?.replace(/^\s*#\s+/, '') || frontmatterName ||
    path.split('/').slice(-2, -1)[0] || 'Skill');
  const firstHeading = heading ? lines.indexOf(heading, start) : start;
  const introductory = lines.slice(firstHeading + (heading ? 1 : 0))
    .find((line) => line.trim() && !/^\s*(?:#|[-*]|\d+\.|\x60{3}|>)/.test(line));
  const description = frontmatterDescription || humanLine(introductory || 'Skill instructions');
  const highlights: string[] = [];
  const seen = new Set<string>();
  let section = '';
  let inCode = false;
  for (const line of lines.slice(start)) {
    if (/^\s*\x60{3}/.test(line)) { inCode = !inCode; continue; }
    if (inCode) continue;
    const title = line.match(/^#{2,4}\s+(.+)$/);
    if (title) { section = humanLine(title[1]).toLowerCase(); continue; }
    if (!/(use|workflow|step|how|rule|requirement|guide|process|quick|safety|instruction)/i.test(section)) continue;
    const bullet = line.match(/^\s*(?:[-*+]\s+|\d+[.)]\s+)(.+)$/);
    if (!bullet) continue;
    const value = humanLine(bullet[1]);
    if (value && !seen.has(value.toLowerCase()) && highlights.length < 5) {
      highlights.push(value);
      seen.add(value.toLowerCase());
    }
  }
  return {name,description,highlights,fullText,path};
}
