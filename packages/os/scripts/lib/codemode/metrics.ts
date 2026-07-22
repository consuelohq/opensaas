import { appendFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { ExecutionResult } from './types.js';

const METRICS_PATH = join(homedir(), '.kiro', 'codemode-metrics.jsonl');

export function recordMetrics(result: ExecutionResult, codeLength: number): void {
  try {
    mkdirSync(join(homedir(), '.kiro'), { recursive: true });
    const entry = {
      ts: new Date().toISOString(),
      ops: result.operations,
      dur: result.duration,
      code: codeLength,
      result: JSON.stringify(result.result ?? '').length,
      ok: result.success,
      saved: Math.max(0, result.operations - 1),
    };
    appendFileSync(METRICS_PATH, JSON.stringify(entry) + '\n');
  } catch {
    // silent — metrics should never break execution
  }
}

export function printStats(hours = 24): string {
  let lines: string[];
  try {
    lines = readFileSync(METRICS_PATH, 'utf-8').trim().split('\n').filter(Boolean);
  } catch {
    return 'No metrics data found.';
  }

  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const entries = lines
    .map(l => { try { return JSON.parse(l) as { ts: string; ops: number; dur: number; ok: boolean; saved: number }; } catch { return null; } })
    .filter((e): e is NonNullable<typeof e> => e !== null && new Date(e.ts).getTime() > cutoff);

  if (entries.length === 0) return `No metrics in the last ${hours}h.`;

  const total = entries.length;
  const ops = entries.reduce((s, e) => s + e.ops, 0);
  const saved = entries.reduce((s, e) => s + e.saved, 0);
  const dur = entries.reduce((s, e) => s + e.dur, 0);
  const ok = entries.filter(e => e.ok).length;

  return [
    `Code Mode Metrics (last ${hours}h):`,
    `  Executions:       ${total}`,
    `  Operations:       ${ops}`,
    `  Round-trips saved: ${saved}`,
    `  Avg ops/execution: ${(ops / total).toFixed(1)}`,
    `  Success rate:     ${((ok / total) * 100).toFixed(1)}%`,
    `  Total duration:   ${(dur / 1000).toFixed(1)}s`,
    `  Avg duration:     ${Math.round(dur / total)}ms`,
  ].join('\n');
}
