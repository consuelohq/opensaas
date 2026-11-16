import { scenarios } from './fixtures';
import { independentScenarios } from './independent';
import { serializeReport, summarizeOutcomes, type Outcome } from './observer';
import { createProductionReplaySession } from './production';
import { runTextReplay } from './runner';

export const QUALITY_TARGETS = Object.freeze({
  fixedHits: 45,
  independentHits: 18,
  negatives: 12,
});
export type CohortScore = {
  hits: number;
  wrongVisible: number;
  lateVisible: number;
  falseInterrupts: number;
  correctAbstentions: number;
};
export function qualityFailures(
  fixed: CohortScore,
  independent: CohortScore,
): string[] {
  const failures: string[] = [];
  for (const [name, score, min] of [
    ['fixed', fixed, QUALITY_TARGETS.fixedHits],
    ['independent', independent, QUALITY_TARGETS.independentHits],
  ] as const) {
    if (score.hits < min) failures.push(name + ':hits');
    if (score.wrongVisible !== 0) failures.push(name + ':wrong-visible');
    if (score.lateVisible !== 0) failures.push(name + ':late-visible');
    if (
      score.falseInterrupts !== 0 ||
      score.correctAbstentions !== QUALITY_TARGETS.negatives
    )
      failures.push(name + ':negatives');
  }
  return failures;
}
export function assessReplay(outcomes: readonly Outcome[]) {
  // Reuse the closed report validation, including IDs, partitions and duplicates.
  serializeReport({ schemaVersion: 1, seed: 17, outcomes });
  const expected = [...scenarios, ...independentScenarios];
  if (
    outcomes.length !== expected.length ||
    expected.some((c) => !outcomes.some((o) => o.scenarioId === c.id))
  )
    throw new Error('quality gate requires all 108 frozen scenarios');
  const byId = new Map(
    outcomes.map((outcome) => [outcome.scenarioId, outcome]),
  );
  const fixed = summarizeOutcomes(scenarios.map((c) => byId.get(c.id)!));
  const independent = summarizeOutcomes(
    independentScenarios.map((c) => byId.get(c.id)!),
  );
  return { fixed, independent, failures: qualityFailures(fixed, independent) };
}

/** Explicit offline hypothesis test; never part of ordinary unit-test discovery. */
export async function runPhraseQualityGate() {
  try {
    const reports = [];
    for (const concurrency of [1, 5, 20] as const) {
      const results = await runTextReplay({
        cases: [...scenarios, ...independentScenarios],
        concurrency,
        seed: 17,
        create: createProductionReplaySession('reviewed-rules'),
      });
      reports.push({
        concurrency,
        ...assessReplay(results.map((result) => result.outcome)),
      });
    }
    return reports;
  } catch (error: unknown) {
    throw error;
  }
}
if (import.meta.main) {
  if (
    process.env.CONSUELO_RUN_COACHING_QUALITY !== '1' ||
    process.argv.length !== 2
  )
    throw new Error(
      'Set CONSUELO_RUN_COACHING_QUALITY=1 to run the offline phrase-only hypothesis gate',
    );
  const reports = await runPhraseQualityGate();
  for (const report of reports)
    process.stdout.write(JSON.stringify(report) + '\n');
  if (reports.some((report) => report.failures.length)) process.exitCode = 1;
}
