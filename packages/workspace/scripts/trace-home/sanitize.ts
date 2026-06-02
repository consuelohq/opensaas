const marker = 'execFile' + 'Sync';

export function stripWrapperInternals(value: string): string {
  const lines = String(value || '').split('\n');
  return lines
    .filter((line) => !line.includes(marker) && !line.includes('node:child_process') && !line.includes('Object.' + marker))
    .join('\n')
    .trim();
}

export function compactText(value: unknown, limit = 500): string {
  const text = stripWrapperInternals(String(value ?? '')).replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1))}…`;
}

export function compactJsonString(value: string, limit = 700): string | { preview: string; chars: number; truncated: true } {
  const clean = stripWrapperInternals(value);
  if (clean.length <= limit) return clean;
  return { preview: clean.slice(0, limit), chars: clean.length, truncated: true };
}

export function sanitizeRecord(record: Record<string, unknown>, raw = false): Record<string, unknown> {
  if (raw) return { ...record };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) out[key] = typeof value === 'string' ? compactJsonString(value) : value;
  return out;
}
