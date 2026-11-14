import { lstatSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  type BenchmarkReport,
  summarizeBenchmark,
  writePrivateBenchmark,
} from './artifact';
import { scenarios } from './fixtures';
import { independentScenarios } from './independent';
import { createProductionReplaySession } from './production';
import { runTextReplay } from './runner';

/** An offline fixture comparison. The caller supplies a fresh owner-only directory. */
export async function runComparison(directory: string, seed: number) {
  const stat = lstatSync(directory);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (stat.mode & 0o077) !== 0 ||
    (typeof process.getuid === 'function' && stat.uid !== process.getuid())
  ) {
    throw new Error(
      'comparison directory must be owner-only and owned by this user',
    );
  }
  const reports: { path: string; report: BenchmarkReport }[] = [];
  for (const lane of ['rules', 'mock-selector'] as const) {
    for (const concurrency of [1, 5, 20] as const) {
      try {
        const subdirectory = join(directory, `${lane}-${concurrency}`);
        mkdirSync(subdirectory, { mode: 0o700 });
        const results = await runTextReplay({
          cases: scenarios,
          concurrency,
          seed,
          create: createProductionReplaySession(lane),
        });
        const report: BenchmarkReport = {
          schemaVersion: 1,
          seed,
          lane,
          concurrency,
          results,
        };
        reports.push({
          path: writePrivateBenchmark(subdirectory, report),
          report,
        });
      } catch (cause: unknown) {
        throw new Error(
          `comparison failed for ${lane} at concurrency ${concurrency}`,
          { cause },
        );
      }
    }
  }
  return reports;
}

if (import.meta.main) {
  const directory = process.argv[2];
  if (!directory || process.argv.length !== 3)
    throw new Error('usage: bun compare.ts <fresh-private-directory>');
  for (const { path, report } of [
    ...(await runComparison(directory, 17)),
    ...(await runReviewedComparison(directory, 17)),
    ...(await runIndependentHeadingComparison(directory, 17)),
  ]) {
    process.stdout.write(
      JSON.stringify({
        path,
        lane: report.lane,
        concurrency: report.concurrency,
        summary: summarizeBenchmark(report),
      }) + '\n',
    );
  }
}

// Separate lane: keep the historical heading-only and mock comparison intact.
export async function runReviewedComparison(directory: string, seed: number) {
  try {
    const stat = lstatSync(directory);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      (stat.mode & 0o077) !== 0 ||
      (typeof process.getuid === 'function' && stat.uid !== process.getuid())
    )
      throw new Error(
        'comparison directory must be owner-only and owned by this user',
      );
    const reports: { path: string; report: BenchmarkReport }[] = [];
    for (const concurrency of [1, 5, 20] as const) {
      const subdirectory = join(directory, `reviewed-rules-${concurrency}`);
      mkdirSync(subdirectory, { mode: 0o700 });
      const results = await runTextReplay({
        cases: [...scenarios, ...independentScenarios],
        concurrency,
        seed,
        create: createProductionReplaySession('reviewed-rules'),
      });
      const report: BenchmarkReport = {
        schemaVersion: 1,
        seed,
        lane: 'reviewed-rules',
        concurrency,
        results,
      };
      reports.push({
        path: writePrivateBenchmark(subdirectory, report),
        report,
      });
    }
    return reports;
  } catch (error: unknown) {
    throw error;
  }
}

/** Separately preserve the original 72-case heading comparison and score new cases. */
export async function runIndependentHeadingComparison(
  directory: string,
  seed: number,
) {
  try {
    const stat = lstatSync(directory);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      (stat.mode & 0o077) !== 0 ||
      (typeof process.getuid === 'function' && stat.uid !== process.getuid())
    )
      throw new Error(
        'comparison directory must be owner-only and owned by this user',
      );
    const reports: { path: string; report: BenchmarkReport }[] = [];
    for (const concurrency of [1, 5, 20] as const) {
      const subdirectory = join(
        directory,
        `heading-independent-${concurrency}`,
      );
      mkdirSync(subdirectory, { mode: 0o700 });
      const results = await runTextReplay({
        cases: independentScenarios,
        concurrency,
        seed,
        create: createProductionReplaySession('rules'),
      });
      const report: BenchmarkReport = {
        schemaVersion: 1,
        seed,
        lane: 'rules',
        concurrency,
        results,
      };
      reports.push({
        path: writePrivateBenchmark(subdirectory, report),
        report,
      });
    }
    return reports;
  } catch (error: unknown) {
    throw error;
  }
}
