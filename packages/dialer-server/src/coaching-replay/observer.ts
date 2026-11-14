import { independentScenarios } from './independent';
import { scenarios, type CardId, type Scenario } from './fixtures';

export interface Observation {
  readonly atMs: number;
  readonly cardId: CardId | null;
}
export interface Outcome {
  readonly scenarioId: string;
  readonly partition: Scenario['partition'];
  readonly verdict:
    'hit' | 'miss' | 'wrong-card' | 'false-interrupt' | 'correct-abstention';
  readonly wrongVisible: number;
  readonly correctVisible: number;
  readonly lateVisible: number;
  readonly churn: number;
  readonly firstCueMs: number | null;
}

/** Score every visible transition, not just the last view or a cherry-picked run. */
export function observeScenario(
  scenario: Scenario,
  observations: readonly Observation[],
): Outcome {
  let previous: CardId | null = null;
  let churn = 0;
  let wrongVisible = 0;
  let correctVisible = 0;
  let lateVisible = 0;
  let hit = false;
  let firstCueMs: number | null = null;
  let previousTime = 0;
  for (const observation of observations) {
    if (!Number.isFinite(observation.atMs) || observation.atMs < previousTime)
      throw new Error('invalid observation time');
    previousTime = observation.atMs;
    if (observation.cardId === previous) continue;
    if (previous !== null) churn++;
    previous = observation.cardId;
    if (observation.cardId === null) continue;
    firstCueMs ??= observation.atMs;
    const acceptable = scenario.acceptableCardIds.includes(observation.cardId);
    if (!acceptable) wrongVisible++;
    if (
      acceptable &&
      observation.atMs >= scenario.windowMs[0] &&
      observation.atMs <= scenario.windowMs[1]
    ) {
      hit = true;
      correctVisible++;
    } else if (acceptable) lateVisible++;
  }
  const verdict =
    scenario.acceptableCardIds.length === 0
      ? wrongVisible
        ? 'false-interrupt'
        : 'correct-abstention'
      : hit
        ? 'hit'
        : wrongVisible
          ? 'wrong-card'
          : 'miss';
  return {
    scenarioId: scenario.id,
    partition: scenario.partition,
    verdict,
    wrongVisible,
    correctVisible,
    lateVisible,
    churn,
    firstCueMs,
  };
}

export interface Report {
  readonly schemaVersion: 1;
  readonly seed: number;
  readonly outcomes: readonly Outcome[];
}

/** Recall is scenario-level; precision is per distinct visible cue transition. */
export function summarizeOutcomes(outcomes: readonly Outcome[]) {
  const count = (verdict: Outcome['verdict']) =>
    outcomes.filter((outcome) => outcome.verdict === verdict).length;
  const hits = count('hit');
  const misses = count('miss');
  const wrongCards = count('wrong-card');
  const falseInterrupts = count('false-interrupt');
  const correctAbstentions = count('correct-abstention');
  const correctVisible = outcomes.reduce(
    (sum, outcome) => sum + outcome.correctVisible,
    0,
  );
  const wrongVisible = outcomes.reduce(
    (sum, outcome) => sum + outcome.wrongVisible,
    0,
  );
  const lateVisible = outcomes.reduce(
    (sum, outcome) => sum + outcome.lateVisible,
    0,
  );
  const offsets = outcomes
    .flatMap((outcome) =>
      outcome.firstCueMs === null ? [] : [outcome.firstCueMs],
    )
    .sort((a, b) => a - b);
  const percentile = (fraction: number) =>
    offsets.length ? offsets[Math.ceil(offsets.length * fraction) - 1]! : null;
  return {
    scenarios: outcomes.length,
    hits,
    misses,
    wrongCards,
    falseInterrupts,
    correctAbstentions,
    recall:
      hits + misses + wrongCards ? hits / (hits + misses + wrongCards) : null,
    cuePrecision:
      correctVisible + wrongVisible + lateVisible
        ? correctVisible / (correctVisible + wrongVisible + lateVisible)
        : null,
    correctVisible,
    wrongVisible,
    lateVisible,
    churn: outcomes.reduce((sum, outcome) => sum + outcome.churn, 0),
    firstCueOffsetMs: {
      count: offsets.length,
      p50: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99),
    },
  };
}

/** Closed schema: no free-form text or provider/customer identifiers can enter an artifact. */
export function serializeReport(report: Report): string {
  const exactKeys = (object: object, keys: readonly string[]) => {
    const actual = Object.keys(object).sort();
    if (
      actual.length !== keys.length ||
      actual.some((key, index) => key !== [...keys].sort()[index])
    )
      throw new Error('unexpected artifact field');
  };
  const nonnegative = (n: number) => Number.isSafeInteger(n) && n >= 0;
  exactKeys(report, ['schemaVersion', 'seed', 'outcomes']);
  if (
    report.schemaVersion !== 1 ||
    !nonnegative(report.seed) ||
    !Array.isArray(report.outcomes)
  )
    throw new Error('invalid report');
  const seen = new Set<string>();
  for (const outcome of report.outcomes) {
    exactKeys(outcome, [
      'scenarioId',
      'partition',
      'verdict',
      'wrongVisible',
      'correctVisible',
      'lateVisible',
      'churn',
      'firstCueMs',
    ]);
    const scenario = [...scenarios, ...independentScenarios].find(
      (item) => item.id === outcome.scenarioId,
    );
    if (
      !scenario ||
      seen.has(outcome.scenarioId) ||
      scenario.partition !== outcome.partition ||
      !['calibration', 'holdout'].includes(outcome.partition) ||
      ![
        'hit',
        'miss',
        'wrong-card',
        'false-interrupt',
        'correct-abstention',
      ].includes(outcome.verdict) ||
      !nonnegative(outcome.wrongVisible) ||
      !nonnegative(outcome.correctVisible) ||
      !nonnegative(outcome.lateVisible) ||
      !nonnegative(outcome.churn) ||
      (outcome.firstCueMs !== null &&
        (!Number.isFinite(outcome.firstCueMs) || outcome.firstCueMs < 0))
    )
      throw new Error('invalid outcome');
    seen.add(outcome.scenarioId);
  }
  return JSON.stringify(report, null, 2) + '\n';
}
