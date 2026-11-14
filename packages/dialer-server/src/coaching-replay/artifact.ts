import { lstatSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serializeReport, summarizeOutcomes, type Report } from './observer';
import type { ReplayResult } from './runner';

export interface BenchmarkReport {
  readonly schemaVersion: 1;
  readonly seed: number;
  readonly lane: 'rules' | 'mock-selector';
  readonly concurrency: 1 | 5 | 20;
  readonly results: readonly ReplayResult[];
}

export function serializeBenchmark(report: BenchmarkReport): string {
  const keys = (value: object, expected: readonly string[]) => {
    const actual = Object.keys(value).sort();
    const sorted = [...expected].sort();
    return (
      actual.length === sorted.length &&
      actual.every((key, i) => key === sorted[i])
    );
  };
  if (
    !keys(report, [
      'schemaVersion',
      'seed',
      'lane',
      'concurrency',
      'results',
    ]) ||
    report.schemaVersion !== 1 ||
    !Number.isSafeInteger(report.seed) ||
    report.seed < 0 ||
    report.seed > 0xffffffff ||
    !['rules', 'mock-selector'].includes(report.lane) ||
    ![1, 5, 20].includes(report.concurrency) ||
    !Array.isArray(report.results)
  ) {
    throw new Error('invalid benchmark report');
  }
  serializeReport({
    schemaVersion: 1,
    seed: report.seed,
    outcomes: report.results.map((result) => result.outcome),
  });
  for (const result of report.results) {
    const { ingestWallMs, settleWallMs, firstCueWallMs, selectorRequests } =
      result;
    if (
      !keys(result, [
        'scenarioId',
        'outcome',
        'ingestWallMs',
        'settleWallMs',
        'firstCueWallMs',
        'selectorRequests',
      ]) ||
      result.scenarioId !== result.outcome.scenarioId ||
      !Number.isFinite(ingestWallMs) ||
      ingestWallMs < 0 ||
      !Number.isFinite(settleWallMs) ||
      settleWallMs < ingestWallMs ||
      (firstCueWallMs !== null &&
        (!Number.isFinite(firstCueWallMs) ||
          firstCueWallMs < 0 ||
          firstCueWallMs > settleWallMs)) ||
      (firstCueWallMs === null) !== (result.outcome.firstCueMs === null) ||
      (selectorRequests !== null &&
        (!Number.isSafeInteger(selectorRequests) || selectorRequests < 0))
    )
      throw new Error('invalid benchmark result');
  }
  return JSON.stringify(report, null, 2) + '\n';
}

export function summarizeBenchmark(report: BenchmarkReport) {
  serializeBenchmark(report);
  const percentiles = (values: readonly number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const at = (fraction: number) =>
      sorted.length ? sorted[Math.ceil(sorted.length * fraction) - 1]! : null;
    return { count: sorted.length, p50: at(0.5), p95: at(0.95), p99: at(0.99) };
  };
  return {
    outcomes: summarizeOutcomes(report.results.map((result) => result.outcome)),
    ingestWallMs: percentiles(
      report.results.map((result) => result.ingestWallMs),
    ),
    settleWallMs: percentiles(
      report.results.map((result) => result.settleWallMs),
    ),
    firstCueWallMs: percentiles(
      report.results.flatMap((result) =>
        result.firstCueWallMs === null ? [] : [result.firstCueWallMs],
      ),
    ),
    selectorRequests:
      report.results.length &&
      report.results.every((result) => result.selectorRequests !== null)
        ? report.results.reduce(
            (total, result) => total + result.selectorRequests!,
            0,
          )
        : null,
  };
}

// Caller creates a fresh private directory per run; exclusive create preserves prior evidence.
export function writePrivateReport(directory: string, report: Report): string {
  return writePrivate(directory, serializeReport(report));
}

export function writePrivateBenchmark(
  directory: string,
  report: BenchmarkReport,
): string {
  return writePrivate(directory, serializeBenchmark(report));
}

function writePrivate(directory: string, json: string): string {
  const stat = lstatSync(directory);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (stat.mode & 0o077) !== 0 ||
    (typeof process.getuid === 'function' && stat.uid !== process.getuid())
  ) {
    throw new Error(
      'replay artifact directory must be owner-only and owned by this user',
    );
  }
  const path = join(directory, 'replay-v1.json');
  writeFileSync(path, json, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  return path;
}
