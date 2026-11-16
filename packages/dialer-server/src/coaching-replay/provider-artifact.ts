import {
  SELECTOR_OUTCOMES,
  type SelectorObservation,
} from '../coaching/selector-observation';
import { CONTEXT_LIMITS } from '../coaching/context-selector';
import { lstatSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serializeReport } from './observer';
import type { ReplayResult } from './runner';
import type {
  ProviderAttemptStage,
  ProviderFinishReason,
} from '../coaching/openrouter-selector';

export type ProviderDiagnostics = {
  stages: Partial<Record<ProviderAttemptStage, number>>;
  statuses: Record<string, number>;
  finishReasons: Partial<Record<ProviderFinishReason, number>>;
  cachedInputTokens: { reports: number; total: number | null };
  cacheWriteTokens: { reports: number; total: number | null };
  reasoningTokens: { reports: number; total: number | null };
};

export type ProviderReport = {
  schemaVersion: 1;
  lane: 'provider-synthetic';
  fingerprint: string;
  seed: 17;
  logicalConcurrency: 20;
  maxRequests: number;
  reservationPerRequestNanoUsd: number;
  attempts: number;
  reservedNanoUsd: number;
  spentNanoUsd: number;
  maxReservedNanoUsd: number;
  settlements: number;
  halted: boolean;
  physicalUnsettled: number;
  queuedAtFinish: number;
  unreconciledCharges: number;
  refused: number;
  metadataResponses: number;
  promptTokenReports: number;
  promptTokensReported: number | null;
  completionTokenReports: number;
  completionTokensReported: number | null;
  costReports: number;
  diagnostics?: ProviderDiagnostics;
  results: readonly ReplayResult[];
};
const keys = (o: object, names: readonly string[]) => {
  const actual = Object.keys(o).sort(),
    expected = [...names].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, i) => key === expected[i])
  );
};
const count = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0;
export function serializeProviderReport(report: ProviderReport): string {
  const diagnostics = report.diagnostics;
  const stages = [
    'accepted',
    'transport',
    'http',
    'body',
    'identity',
    'choices',
    'finish',
    'content',
    'schema',
    'selection',
    'card',
    'slots',
    'evidence',
    'abstention',
    'aborted',
  ];
  const validCounts = (value: unknown, allowed: (key: string) => boolean) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return false;
    const entries = Object.entries(value);
    return (
      entries.every(([key, n]) => allowed(key) && count(n) && Number(n) > 0) &&
      entries.reduce((sum, [, n]) => sum + Number(n), 0) <= report.attempts
    );
  };
  const validTokens = (value: ProviderDiagnostics['cachedInputTokens']) =>
    !!value &&
    keys(value, ['reports', 'total']) &&
    count(value.reports) &&
    value.reports <= report.attempts &&
    (value.reports === 0 ? value.total === null : count(value.total));
  if (
    !keys(report, [
      'schemaVersion',
      'lane',
      'fingerprint',
      'seed',
      'logicalConcurrency',
      'maxRequests',
      'reservationPerRequestNanoUsd',
      'attempts',
      'reservedNanoUsd',
      'spentNanoUsd',
      'maxReservedNanoUsd',
      'settlements',
      'halted',
      'physicalUnsettled',
      'queuedAtFinish',
      'unreconciledCharges',
      'refused',
      'metadataResponses',
      'promptTokenReports',
      'promptTokensReported',
      'completionTokenReports',
      'completionTokensReported',
      'costReports',
      ...(diagnostics === undefined ? [] : ['diagnostics']),
      'results',
    ]) ||
    report.schemaVersion !== 1 ||
    report.lane !== 'provider-synthetic' ||
    !/^[a-f0-9]{64}$/.test(report.fingerprint) ||
    report.seed !== 17 ||
    report.logicalConcurrency !== 20 ||
    !count(report.maxRequests) ||
    report.maxRequests < 1 ||
    report.maxRequests > 108 ||
    !count(report.reservationPerRequestNanoUsd) ||
    !report.reservationPerRequestNanoUsd ||
    !count(report.attempts) ||
    report.attempts > report.maxRequests ||
    !count(report.reservedNanoUsd) ||
    !count(report.spentNanoUsd) ||
    !count(report.maxReservedNanoUsd) ||
    !count(report.settlements) ||
    report.settlements > report.attempts ||
    typeof report.halted !== 'boolean' ||
    !count(report.physicalUnsettled) ||
    report.physicalUnsettled > 4 ||
    !count(report.queuedAtFinish) ||
    report.queuedAtFinish > 20 ||
    !count(report.unreconciledCharges) ||
    report.unreconciledCharges !== report.attempts - report.settlements ||
    BigInt(report.reservedNanoUsd) !==
      BigInt(report.unreconciledCharges) *
        BigInt(report.reservationPerRequestNanoUsd) ||
    BigInt(report.spentNanoUsd) >
      BigInt(report.settlements) *
        BigInt(report.reservationPerRequestNanoUsd) ||
    BigInt(report.spentNanoUsd) + BigInt(report.reservedNanoUsd) >
      BigInt(report.maxReservedNanoUsd) ||
    !count(report.refused) ||
    !count(report.metadataResponses) ||
    report.metadataResponses > report.attempts ||
    !count(report.promptTokenReports) ||
    report.promptTokenReports > report.attempts ||
    (report.promptTokenReports === 0
      ? report.promptTokensReported !== null
      : !count(report.promptTokensReported)) ||
    !count(report.completionTokenReports) ||
    report.completionTokenReports > report.attempts ||
    (report.completionTokenReports === 0
      ? report.completionTokensReported !== null
      : !count(report.completionTokensReported)) ||
    !count(report.costReports) ||
    report.costReports > report.attempts ||
    (diagnostics !== undefined &&
      (!keys(diagnostics, [
        'stages',
        'statuses',
        'finishReasons',
        'cachedInputTokens',
        'cacheWriteTokens',
        'reasoningTokens',
      ]) ||
        !validCounts(diagnostics.stages, (key) => stages.includes(key)) ||
        !validCounts(diagnostics.statuses, (key) => /^[1-5]\d\d$/.test(key)) ||
        !validCounts(diagnostics.finishReasons, (key) =>
          [
            'stop',
            'length',
            'content_filter',
            'tool_calls',
            'error',
            'other',
          ].includes(key),
        ) ||
        !validTokens(diagnostics.cachedInputTokens) ||
        !validTokens(diagnostics.cacheWriteTokens) ||
        !validTokens(diagnostics.reasoningTokens))) ||
    !Array.isArray(report.results) ||
    report.results.length !== report.maxRequests
  )
    throw new Error('invalid provider report');
  serializeReport({
    schemaVersion: 1,
    seed: 17,
    outcomes: report.results.map((r) => r.outcome),
  });
  serializeReport({
    schemaVersion: 1,
    seed: 17,
    outcomes: report.results.map((r) => r.wallOutcome!),
  });
  for (const result of report.results) {
    const metrics = result.selectorMetrics;
    if (
      !keys(result, [
        'scenarioId',
        'outcome',
        'wallOutcome',
        'ingestWallMs',
        'settleWallMs',
        'firstCueWallMs',
        'selectorRequests',
        'selectorMetrics',
        ...(result.selectorTrace === undefined ? [] : ['selectorTrace']),
      ]) ||
      !result.wallOutcome ||
      result.scenarioId !== result.outcome.scenarioId ||
      result.scenarioId !== result.wallOutcome.scenarioId ||
      !Number.isFinite(result.ingestWallMs) ||
      result.ingestWallMs < 0 ||
      !Number.isFinite(result.settleWallMs) ||
      result.settleWallMs < result.ingestWallMs ||
      (result.firstCueWallMs !== null &&
        (!Number.isFinite(result.firstCueWallMs) ||
          result.firstCueWallMs < 0 ||
          result.firstCueWallMs > result.settleWallMs)) ||
      result.firstCueWallMs !== result.wallOutcome.firstCueMs ||
      (result.selectorRequests !== null && !count(result.selectorRequests)) ||
      !metrics ||
      !keys(metrics, [
        'discards',
        'failures',
        'checkpoints',
        'queueRejected',
      ]) ||
      Object.values(metrics).some((n) => n !== null && !count(n))
    )
      throw new Error('invalid provider result');
    if (result.selectorTrace !== undefined) {
      const time = (n: unknown) =>
        typeof n === 'number' &&
        Number.isFinite(n) &&
        n >= 0 &&
        n <= Number.MAX_SAFE_INTEGER;
      if (
        !Array.isArray(result.selectorTrace) ||
        result.selectorTrace.length > 20 ||
        result.selectorTrace.length !== result.selectorRequests ||
        result.selectorTrace.some(
          (o: SelectorObservation, i: number) =>
            !o ||
            !keys(o, [
              'request',
              'queueMs',
              'requestMs',
              'decisionMs',
              'cueAgeMs',
              'outcome',
              'cardIndex',
              'evidenceTurnIndices',
            ]) ||
            o.request !== i + 1 ||
            !time(o.queueMs) ||
            (o.requestMs !== null && !time(o.requestMs)) ||
            (o.decisionMs !== null && !time(o.decisionMs)) ||
            (o.cueAgeMs !== null && !time(o.cueAgeMs)) ||
            !SELECTOR_OUTCOMES.includes(o.outcome) ||
            (o.cardIndex !== null &&
              (!count(o.cardIndex) || o.cardIndex >= CONTEXT_LIMITS.cards)) ||
            !Array.isArray(o.evidenceTurnIndices) ||
            o.evidenceTurnIndices.length > CONTEXT_LIMITS.turns ||
            new Set(o.evidenceTurnIndices).size !==
              o.evidenceTurnIndices.length ||
            o.evidenceTurnIndices.some(
              (n: number) => !count(n) || n >= CONTEXT_LIMITS.turns,
            ),
        )
      )
        throw new Error('invalid selector observation');
    }
  }
  return JSON.stringify(report, null, 2) + '\n';
}
export function writePrivateProviderReport(
  directory: string,
  report: ProviderReport,
): string {
  const stat = lstatSync(directory);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (stat.mode & 0o077) !== 0 ||
    (typeof process.getuid === 'function' && stat.uid !== process.getuid())
  )
    throw new Error('provider report directory must be owner-only');
  const path = join(directory, 'provider-replay-v1.json');
  writeFileSync(path, serializeProviderReport(report), {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  return path;
}
