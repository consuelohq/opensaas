import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { OPENROUTER_SELECTOR_REVISION } from '../coaching/openrouter-selector';
import { assessReplay } from './quality';
import { summarizeOutcomes } from './observer';
import { reservationPerRequest } from './provider-budget';
import {
  authorizeProviderRun,
  captureSourceSnapshot,
  configurationFingerprint,
  parseProviderConfig,
} from './provider-config';
import { verifyPublicModelMetadata } from './provider-metadata';
import {
  measureSyntheticRequestBytes,
  runProviderBenchmark,
} from './provider-benchmark';

export type Command =
  | { mode: 'preflight'; configPath: string; directory: string }
  | { mode: 'run'; configPath: string; directory: string; fingerprint: string };
export function parseCommand(
  args: readonly string[],
  optIn: string | undefined,
): Command {
  if (args.length === 3 && args[0] === '--preflight')
    return { mode: 'preflight', configPath: args[1]!, directory: args[2]! };
  if (
    args.length === 4 &&
    args[0] === '--run' &&
    optIn === '1' &&
    /^[a-f0-9]{64}$/.test(args[3]!)
  )
    return {
      mode: 'run',
      configPath: args[1]!,
      directory: args[2]!,
      fingerprint: args[3]!,
    };
  throw new Error('explicit command, opt-in and reviewed fingerprint required');
}
export function privateDirectory(path: string): string {
  const stat = lstatSync(path);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (stat.mode & 0o077) !== 0 ||
    (typeof process.getuid === 'function' && stat.uid !== process.getuid())
  )
    throw new Error('owner-only directory required');
  return realpathSync(path);
}
async function main() {
  try {
    const command = parseCommand(
      process.argv.slice(2),
      process.env.CONSUELO_RUN_COACHING_PROVIDER,
    );
    const configPath = resolve(command.configPath),
      stat = lstatSync(configPath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16_384)
      throw new Error('invalid config');
    const config = parseProviderConfig(
      JSON.parse(readFileSync(configPath, 'utf8')),
    );
    if (config.transportRevision !== OPENROUTER_SELECTOR_REVISION)
      throw new Error('transport revision changed');
    const directory = privateDirectory(resolve(command.directory)),
      root = process.cwd();
    const snapshot = captureSourceSnapshot(root),
      fingerprint = configurationFingerprint(config, snapshot, directory);
    if (command.mode === 'run')
      authorizeProviderRun({
        optIn: process.env.CONSUELO_RUN_COACHING_PROVIDER,
        config,
        snapshot,
        outputDirectory: directory,
        expectedFingerprint: command.fingerprint,
      });
    // Public metadata only. No model call and no key access in preflight.
    const metadata = await verifyPublicModelMetadata(
      config,
      globalThis.fetch,
      Date.now(),
    );
    const sizes = await measureSyntheticRequestBytes(config);
    if (
      configurationFingerprint(
        config,
        captureSourceSnapshot(root),
        privateDirectory(directory),
      ) !== fingerprint
    )
      throw new Error('source changed during preflight');
    const perRequest = reservationPerRequest(config);
    if (command.mode === 'preflight') {
      process.stdout.write(
        JSON.stringify({
          mode: 'preflight',
          fingerprint,
          config,
          metadata,
          syntheticRequestBytes: sizes,
          reservationPerRequestNanoUsd: perRequest,
          allRequestsWorstNanoUsd: perRequest * config.maxRequests,
          initialSimultaneousCapacity: Math.min(
            4,
            Math.floor(config.maxReservedNanoUsd / perRequest),
          ),
          note: 'No inference performed. A separate explicit user approval and credential setup are required.',
        }) + '\n',
      );
      return;
    }
    const report = await runProviderBenchmark({
      config,
      fingerprint,
      directory,
      integrity: () =>
        configurationFingerprint(
          config,
          captureSourceSnapshot(root),
          privateDirectory(directory),
        ) === fingerprint,
      getApiKey: () => process.env.OPENROUTER_API_KEY ?? '',
      fetcher: globalThis.fetch,
    });
    const virtual = summarizeOutcomes(report.results.map((x) => x.outcome));
    const wall = summarizeOutcomes(report.results.map((x) => x.wallOutcome!));
    const complete =
      report.attempts === config.scenarioCount &&
      report.metadataResponses === config.scenarioCount &&
      !report.halted &&
      report.unreconciledCharges === 0 &&
      report.refused === 0 &&
      report.physicalUnsettled === 0 &&
      report.queuedAtFinish === 0;
    const gate =
      config.scenarioCount === 108
        ? assessReplay(report.results.map((x) => x.wallOutcome!))
        : null;
    const percentile = (values: number[]) => {
      const sorted = values.sort((a, b) => a - b);
      const at = (q: number) =>
        sorted.length ? sorted[Math.ceil(sorted.length * q) - 1]! : null;
      return {
        count: sorted.length,
        p50: at(0.5),
        p95: at(0.95),
        p99: at(0.99),
      };
    };
    const metric = (
      key: 'discards' | 'failures' | 'checkpoints' | 'queueRejected',
    ) => {
      const values = report.results.map(
        (r) => r.selectorMetrics?.[key] ?? null,
      );
      return values.every((x) => x !== null)
        ? values.reduce<number>((a, b) => a + b!, 0)
        : null;
    };
    process.stdout.write(
      JSON.stringify({
        mode: 'provider-synthetic',
        fingerprint,
        artifact: directory + '/provider-replay-v1.json',
        complete,
        virtual,
        wall,
        firstCueWallMs: percentile(
          report.results.flatMap((r) =>
            r.firstCueWallMs === null ? [] : [r.firstCueWallMs],
          ),
        ),
        settleWallMs: percentile(report.results.map((r) => r.settleWallMs)),
        selectorRequests: report.results.every(
          (r) => r.selectorRequests !== null,
        )
          ? report.results.reduce((a, r) => a + r.selectorRequests!, 0)
          : null,
        selectorDiscards: metric('discards'),
        selectorFailures: metric('failures'),
        selectorCheckpoints: metric('checkpoints'),
        selectorQueueRejected: metric('queueRejected'),
        physicalUnsettled: report.physicalUnsettled,
        queuedAtFinish: report.queuedAtFinish,
        qualityFailures: gate
          ? [...gate.failures, ...(!complete ? ['provider:incomplete'] : [])]
          : null,
        attempts: report.attempts,
        settlements: report.settlements,
        unreconciledCharges: report.unreconciledCharges,
        reservedNanoUsd: report.reservedNanoUsd,
        spentNanoUsd: report.spentNanoUsd,
        refused: report.refused,
        metadataResponses: report.metadataResponses,
        promptTokenReports: report.promptTokenReports,
        promptTokensReported: report.promptTokensReported,
        completionTokenReports: report.completionTokenReports,
        completionTokensReported: report.completionTokensReported,
        costReports: report.costReports,
      }) + '\n',
    );
  } catch (error: unknown) {
    throw error;
  }
}
if (import.meta.main)
  main().catch(() => {
    process.stderr.write(
      'Provider benchmark refused or failed; inspect the private numeric ledger.\n',
    );
    process.exitCode = 1;
  });
