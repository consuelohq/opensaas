import { Effect } from 'effect';

import {
  loadLifecyclePreferences,
  setLifecycleChannel,
  setLifecycleNotificationPreference,
} from './config';
import { createLifecycleProgressEmitter } from './diagnostics';
import { asLifecycleError, lifecycleError } from './errors';
import { acquireLifecycleLock } from './lock';
import { noOpLifecycleMigrationRunner } from './migrations';
import { resolveLifecyclePaths } from './paths';
import {
  activateRuntimeRelease,
  cleanupRuntimeBundleStaging,
  materializeRuntimeBundleDownload,
  stageVerifiedRuntimeBundle,
  verifyDownloadedRuntimeBundle,
  verifySignedReleaseManifest,
} from './release';
import {
  inspectLifecycleInstallState,
  listVerifiedRetainedReleases,
} from './state';
import type {
  LifecycleEngine,
  LifecycleHealthAcceptance,
  LifecycleHooks,
  LifecycleMigrationRunner,
  LifecycleNotificationPreference,
  LifecycleOperation,
  LifecycleOperationResult,
  LifecycleProgressEvent,
  LifecycleReleaseChannel,
  LifecycleServiceController,
  ReleaseManifestPayload,
  ReleaseSource,
} from './types';

export type LifecycleEngineDependencies = {
  home?: string;
  releaseSource: ReleaseSource;
  trustedReleaseKeys: Record<string, string>;
  service: LifecycleServiceController;
  health: LifecycleHealthAcceptance;
  migration?: LifecycleMigrationRunner;
  hooks?: LifecycleHooks;
  onboarding?: () => Promise<void>;
  progress?: (event: LifecycleProgressEvent) => void;
  now?: () => Date;
  operationId?: () => string;
  persistDiagnostics?: boolean;
};

const defaultOperationId = (): string =>
  `lifecycle-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;

async function runEffect<T, E>(effect: Effect.Effect<T, E>): Promise<T> {
  try {
    const outcome = await Effect.runPromise(Effect.either(effect));
    if (outcome._tag === 'Left') throw outcome.left;
    return outcome.right;
  } catch (error: unknown) {
    throw error;
  }
}

function tryPromise<T>(input: {
  try: () => Promise<T>;
  code: Parameters<typeof asLifecycleError>[1];
  message: string;
  phase?: string;
}): Effect.Effect<T, ReturnType<typeof asLifecycleError>> {
  return Effect.tryPromise({
    try: input.try,
    catch: (error) => asLifecycleError(error, input.code, input.message, input.phase),
  });
}

export function createLifecycleEngine(
  dependencies: LifecycleEngineDependencies,
): LifecycleEngine {
  const home = resolveLifecyclePaths(dependencies.home).home;
  const now = dependencies.now ?? (() => new Date());
  const nextOperationId = dependencies.operationId ?? defaultOperationId;
  const migration = dependencies.migration ?? noOpLifecycleMigrationRunner;

  const emitter = (operation: LifecycleOperation) =>
    createLifecycleProgressEmitter({
      home,
      operation,
      now,
      sink: dependencies.progress,
      persistDiagnostics: dependencies.persistDiagnostics,
    });

  const fetchVerifiedRelease = (
    channel: LifecycleReleaseChannel,
    emit: ReturnType<typeof emitter>,
  ): Effect.Effect<ReleaseManifestPayload, ReturnType<typeof asLifecycleError>> =>
    Effect.gen(function* () {
      emit('manifest-fetch', { channel });
      const signed = yield* tryPromise({
        try: () => dependencies.releaseSource.fetchManifest(channel),
        code: 'MANIFEST_FETCH_FAILED',
        message: 'failed to fetch release manifest',
        phase: 'manifest-fetch',
      });
      emit('manifest-verify', { channel, keyId: signed.signature?.keyId });
      return yield* Effect.try({
        try: () => verifySignedReleaseManifest(signed, dependencies.trustedReleaseKeys),
        catch: (error) => asLifecycleError(
          error,
          'MANIFEST_SIGNATURE_INVALID',
          'release manifest verification failed',
          'manifest-verify',
        ),
      });
    });

  const exclusive = <T>(
    operationId: string,
    emit: ReturnType<typeof emitter>,
    use: () => Effect.Effect<T, unknown>,
  ): Promise<T> =>
    runEffect(
      Effect.acquireUseRelease(
        tryPromise({
          try: () => acquireLifecycleLock({ home, operationId, now: now() }),
          code: 'LOCK_IO_FAILED',
          message: 'failed to acquire lifecycle lock',
          phase: 'lock',
        }),
        (release) => {
          emit('lock', { recoveredStaleLock: release.recoveredStaleLock });
          return use();
        },
        (release) => Effect.promise(() => release()),
      ),
    );

  const acceptHealth = (
    emit: ReturnType<typeof emitter>,
    hooksInput: {
      operationId: string;
      previousReleasePath?: string;
      nextReleasePath?: string;
    },
  ): Effect.Effect<void, ReturnType<typeof asLifecycleError>> =>
    Effect.gen(function* () {
      emit('health');
      const healthy = yield* tryPromise({
        try: () => dependencies.health.accept(),
        code: 'HEALTH_REJECTED',
        message: 'runtime health acceptance failed',
        phase: 'health',
      });
      if (!healthy) {
        if (dependencies.hooks?.onHealthFailure) {
          yield* Effect.promise(() => dependencies.hooks!.onHealthFailure!(
            { home, ...hooksInput },
          ));
        }
        return yield* Effect.fail(
          lifecycleError('HEALTH_REJECTED', 'runtime health was not accepted', {
            phase: 'health',
          }),
        );
      }
    });

  const applyRelease = async (input: {
    operation: 'install' | 'update';
    channel: LifecycleReleaseChannel;
    check?: boolean;
    existingState?: Awaited<ReturnType<typeof inspectLifecycleInstallState>>;
    emit: ReturnType<typeof emitter>;
  }): Promise<LifecycleOperationResult> => {
    const operationId = nextOperationId();
    return exclusive(operationId, input.emit, () =>
      Effect.gen(function* () {
        const current = input.existingState ?? (yield* Effect.promise(() => inspectLifecycleInstallState(home)));
        const release = yield* fetchVerifiedRelease(input.channel, input.emit);
        const updateAvailable = current.currentBundleId !== release.bundleId;

        if (input.check) {
          input.emit('complete', {
            changed: false,
            updateAvailable,
            version: release.version,
          });
          return {
            operation: input.operation,
            changed: false,
            updateAvailable,
            version: release.version,
            bundleId: release.bundleId,
          } satisfies LifecycleOperationResult;
        }

        if (!updateAvailable && current.kind === 'valid') {
          input.emit('complete', {
            changed: false,
            updateAvailable: false,
            version: release.version,
          });
          return {
            operation: input.operation,
            changed: false,
            updateAvailable: false,
            version: release.version,
            bundleId: release.bundleId,
          } satisfies LifecycleOperationResult;
        }

        input.emit('bundle-download', { version: release.version, bundleId: release.bundleId });
        const bytes = yield* tryPromise({
          try: () => dependencies.releaseSource.fetchBundle(release.bundleUrl),
          code: 'BUNDLE_DOWNLOAD_FAILED',
          message: 'failed to download runtime bundle',
          phase: 'bundle-download',
        });
        const archivePath = yield* Effect.try({
          try: () => materializeRuntimeBundleDownload({ home, operationId, bytes }),
          catch: (error) => asLifecycleError(
            error,
            'STAGING_FAILED',
            'failed to materialize downloaded runtime bundle',
            'bundle-download',
          ),
        });
        input.emit('bundle-verify', { bundleId: release.bundleId });
        const manifest = yield* Effect.try({
          try: () => verifyDownloadedRuntimeBundle(bytes, release),
          catch: (error) => asLifecycleError(
            error,
            'BUNDLE_VERIFY_FAILED',
            'downloaded runtime bundle verification failed',
            'bundle-verify',
          ),
        }).pipe(
          Effect.tapError(() => Effect.sync(() => cleanupRuntimeBundleStaging({ home, operationId }))),
        );

        if (dependencies.hooks?.beforeStage) {
          yield* tryPromise({
            try: () => dependencies.hooks!.beforeStage!({ home, operationId }),
            code: 'STAGING_FAILED',
            message: 'runtime staging precondition failed',
            phase: 'stage',
          });
        }
        input.emit('stage', { bundleId: manifest.bundleId });
        const staged = yield* Effect.try({
          try: () => stageVerifiedRuntimeBundle({
            home,
            operationId,
            archivePath,
            manifest,
          }),
          catch: (error) => asLifecycleError(
            error,
            'STAGING_FAILED',
            'failed to stage runtime bundle',
            'stage',
          ),
        });

        input.emit('preflight');
        yield* tryPromise({
          try: () => dependencies.service.preflight(),
          code: 'PREFLIGHT_FAILED',
          message: 'platform preflight failed',
          phase: 'preflight',
        });

        input.emit('migrate', { migrations: manifest.migrations.map((entry) => entry.id) });
        yield* tryPromise({
          try: () => migration.run({ home, releasePath: staged.releasePath, manifest }),
          code: 'MIGRATION_FAILED',
          message: 'runtime migration failed',
          phase: 'migrate',
        });

        const previousReleasePath = current.currentReleasePath;
        if (dependencies.hooks?.beforeActivate) {
          yield* Effect.promise(() => dependencies.hooks!.beforeActivate!({
            home,
            operationId,
            previousReleasePath,
            nextReleasePath: staged.releasePath,
            manifest,
          }));
        }
        input.emit('activate', {
          bundleId: manifest.bundleId,
          previousBundleId: current.currentBundleId,
        });
        yield* Effect.try({
          try: () => activateRuntimeRelease({
            home,
            releasePath: staged.releasePath,
            operationId,
          }),
          catch: (error) => asLifecycleError(
            error,
            'ACTIVATION_FAILED',
            'failed to activate runtime bundle',
            'activate',
          ),
        });
        if (dependencies.hooks?.afterActivate) {
          yield* Effect.promise(() => dependencies.hooks!.afterActivate!({
            home,
            operationId,
            previousReleasePath,
            nextReleasePath: staged.releasePath,
            manifest,
          }));
        }

        input.emit('service-restart');
        yield* tryPromise({
          try: () => dependencies.service.restart(),
          code: 'SERVICE_RESTART_FAILED',
          message: 'failed to restart Consuelo services',
          phase: 'service-restart',
        });
        yield* acceptHealth(input.emit, {
          operationId,
          previousReleasePath,
          nextReleasePath: staged.releasePath,
        });

        input.emit('complete', {
          changed: true,
          version: manifest.version,
          bundleId: manifest.bundleId,
        });
        return {
          operation: input.operation,
          changed: true,
          updateAvailable: false,
          version: manifest.version,
          bundleId: manifest.bundleId,
        } satisfies LifecycleOperationResult;
      }),
    );
  };

  return {
    async status() {
      const state = await inspectLifecycleInstallState(home);
      return {
        operation: 'status',
        changed: false,
        installState: state.kind,
        version: state.currentVersion,
        bundleId: state.currentBundleId,
        preferences: loadLifecyclePreferences(home, now()),
        ...(state.reason ? { detail: { reason: state.reason } } : {}),
      };
    },

    async install(input = {}) {
      const emit = emitter('install');
      let state = await inspectLifecycleInstallState(home);
      emit('inspect', { installState: state.kind });
      if (state.onboardingRequired) {
        if (!dependencies.onboarding) {
          throw lifecycleError(
            'INSTALL_STATE_INVALID',
            'first install requires the onboarding adapter',
          );
        }
        emit('onboarding');
        try {
          await dependencies.onboarding();
        } catch (error: unknown) {
          throw asLifecycleError(error, 'ONBOARDING_FAILED', 'first-install onboarding failed', 'onboarding');
        }
        state = await inspectLifecycleInstallState(home);
      }
      if (state.kind === 'legacy') {
        throw lifecycleError(
          'INSTALL_STATE_INVALID',
          'legacy install must be migrated before runtime activation',
        );
      }
      const preferences = loadLifecyclePreferences(home, now());
      return applyRelease({
        operation: 'install',
        channel: input.channel ?? preferences.channel,
        existingState: state,
        emit,
      });
    },

    async update(input = {}) {
      try {
        const emit = emitter('update');
        const state = await inspectLifecycleInstallState(home);
        emit('inspect', { installState: state.kind });
        if (state.kind === 'no-install' || state.onboardingRequired) {
          throw lifecycleError(
            'INSTALL_STATE_INVALID',
            'update requires an existing Consuelo OS identity; run install first',
          );
        }
        if (state.kind === 'legacy') {
          throw lifecycleError(
            'INSTALL_STATE_INVALID',
            'legacy install must be migrated before update',
          );
        }
        const preferences = loadLifecyclePreferences(home, now());
        return await applyRelease({
          operation: 'update',
          channel: input.channel ?? preferences.channel,
          check: input.check,
          existingState: state,
          emit,
        });
      } catch (error: unknown) {
        throw asLifecycleError(error, 'INSTALL_STATE_INVALID', 'lifecycle update failed');
      }
    },

    async restart() {
      const emit = emitter('restart');
      const state = await inspectLifecycleInstallState(home);
      emit('inspect', { installState: state.kind });
      if (state.kind === 'no-install' || state.kind === 'legacy') {
        throw lifecycleError('INSTALL_STATE_INVALID', 'restart requires an installed Consuelo OS');
      }
      emit('service-restart');
      try {
        await dependencies.service.restart();
      } catch (error: unknown) {
        throw asLifecycleError(
          error,
          'SERVICE_RESTART_FAILED',
          'failed to restart Consuelo services',
          'service-restart',
        );
      }
      await runEffect(acceptHealth(emit, { operationId: nextOperationId() }));
      emit('complete', { changed: true });
      return { operation: 'restart', changed: true };
    },

    async repair() {
      try {
        const emit = emitter('repair');
        const state = await inspectLifecycleInstallState(home);
        emit('inspect', { installState: state.kind });
        if (state.kind === 'no-install' || state.onboardingRequired) {
          throw lifecycleError(
            'INSTALL_STATE_INVALID',
            'repair requires an existing Consuelo OS identity; run install first',
          );
        }
        if (state.kind === 'valid') {
          emit('complete', { changed: false, reason: 'runtime already valid' });
          return {
            operation: 'repair',
            changed: false,
            version: state.currentVersion,
            bundleId: state.currentBundleId,
          };
        }

        emit('repair-scan');
        const retained = listVerifiedRetainedReleases(home)[0];
        if (!retained) {
          const preferences = loadLifecyclePreferences(home, now());
          const updated = await applyRelease({
            operation: 'update',
            channel: preferences.channel,
            existingState: state,
            emit,
          });
          return { ...updated, operation: 'repair' };
        }

        const operationId = nextOperationId();
        return await exclusive(operationId, emit, () =>
          Effect.gen(function* () {
            emit('preflight');
            yield* tryPromise({
              try: () => dependencies.service.preflight(),
              code: 'PREFLIGHT_FAILED',
              message: 'platform preflight failed during repair',
              phase: 'preflight',
            });
            emit('activate', { bundleId: retained.manifest.bundleId, repair: true });
            yield* Effect.try({
              try: () => activateRuntimeRelease({
                home,
                releasePath: retained.path,
                operationId,
              }),
              catch: (error) => asLifecycleError(
                error,
                'REPAIR_FAILED',
                'failed to reactivate retained runtime release',
                'activate',
              ),
            });
            emit('service-restart');
            yield* tryPromise({
              try: () => dependencies.service.restart(),
              code: 'SERVICE_RESTART_FAILED',
              message: 'failed to restart Consuelo services after repair',
              phase: 'service-restart',
            });
            yield* acceptHealth(emit, {
              operationId,
              nextReleasePath: retained.path,
            });
            emit('complete', {
              changed: true,
              version: retained.manifest.version,
              bundleId: retained.manifest.bundleId,
            });
            return {
              operation: 'repair',
              changed: true,
              version: retained.manifest.version,
              bundleId: retained.manifest.bundleId,
            } satisfies LifecycleOperationResult;
          }),
        );
      } catch (error: unknown) {
        throw asLifecycleError(error, 'REPAIR_FAILED', 'lifecycle repair failed');
      }
    },

    async setChannel(channel) {
      const preferences = setLifecycleChannel(home, channel, now());
      return {
        operation: 'channel',
        changed: true,
        preferences,
      };
    },

    async setUpdateNotifications(preference: LifecycleNotificationPreference) {
      const preferences = setLifecycleNotificationPreference(home, preference, now());
      return {
        operation: 'notifications',
        changed: true,
        preferences,
      };
    },
  };
}
