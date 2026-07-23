import { rmSync } from 'node:fs';

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
import { noOpLifecycleRuntimeMaterializer } from './runtime';
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
  verifyInstalledRuntimeRelease,
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
  LifecycleRuntimeMaterializer,
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
  runtime?: LifecycleRuntimeMaterializer;
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
  const runtime = dependencies.runtime ?? noOpLifecycleRuntimeMaterializer;
  const paths = resolveLifecyclePaths(home);

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
      const verified = yield* Effect.try({
        try: () => verifySignedReleaseManifest(signed, dependencies.trustedReleaseKeys),
        catch: (error) => asLifecycleError(
          error,
          'MANIFEST_SIGNATURE_INVALID',
          'release manifest verification failed',
          'manifest-verify',
        ),
      });
      if (verified.channel !== channel) {
        return yield* Effect.fail(lifecycleError(
          'MANIFEST_INVALID',
          `release manifest channel ${verified.channel} does not match requested channel ${channel}`,
          { phase: 'manifest-verify' },
        ));
      }
      return verified;
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

  const acceptHealth = async (
    emit: ReturnType<typeof emitter>,
    hooksInput: {
      operationId: string;
      previousReleasePath?: string;
      nextReleasePath?: string;
    },
    expected?: { bundleId?: string; version?: string },
  ): Promise<void> => {
    emit('health', expected);
    let healthy: boolean;
    try {
      healthy = await dependencies.health.accept(expected);
    } catch (error: unknown) {
      throw asLifecycleError(
        error,
        'HEALTH_REJECTED',
        'runtime health acceptance failed',
        'health',
      );
    }
    if (healthy) return;
    if (dependencies.hooks?.onHealthFailure) {
      await dependencies.hooks.onHealthFailure({ home, ...hooksInput });
    }
    throw lifecycleError('HEALTH_REJECTED', 'runtime health was not accepted', {
      phase: 'health',
    });
  };

  const activateAndAccept = async (input: {
    emit: ReturnType<typeof emitter>;
    operationId: string;
    previousReleasePath?: string;
    nextReleasePath: string;
    manifest: Parameters<LifecycleMigrationRunner['run']>[0]['manifest'];
  }): Promise<void> => {
    let activated = false;
    try {
      if (dependencies.hooks?.beforeActivate) {
        await dependencies.hooks.beforeActivate({
          home,
          operationId: input.operationId,
          previousReleasePath: input.previousReleasePath,
          nextReleasePath: input.nextReleasePath,
          manifest: input.manifest,
        });
      }
      input.emit('activate', {
        bundleId: input.manifest.bundleId,
        previousReleasePath: input.previousReleasePath,
      });
      activateRuntimeRelease({
        home,
        releasePath: input.nextReleasePath,
        operationId: input.operationId,
        previousReleasePath: input.previousReleasePath,
      });
      activated = true;
      if (dependencies.hooks?.afterActivate) {
        await dependencies.hooks.afterActivate({
          home,
          operationId: input.operationId,
          previousReleasePath: input.previousReleasePath,
          nextReleasePath: input.nextReleasePath,
          manifest: input.manifest,
        });
      }
      input.emit('service-restart');
      try {
        await dependencies.service.restart({
          operationId: input.operationId,
          expectedBundleId: input.manifest.bundleId,
          waitForCompletion: true,
        });
      } catch (error: unknown) {
        throw asLifecycleError(
          error,
          'SERVICE_RESTART_FAILED',
          'failed to restart Consuelo services',
          'service-restart',
        );
      }
      await acceptHealth(input.emit, {
        operationId: input.operationId,
        previousReleasePath: input.previousReleasePath,
        nextReleasePath: input.nextReleasePath,
      }, {
        bundleId: input.manifest.bundleId,
        version: input.manifest.version,
      });
    } catch (error: unknown) {
      if (dependencies.hooks?.onActivationFailure) {
        await dependencies.hooks.onActivationFailure({
          home,
          operationId: input.operationId,
          previousReleasePath: input.previousReleasePath,
          nextReleasePath: input.nextReleasePath,
          error,
        });
      }
      if (!activated) throw error;
      try {
        if (input.previousReleasePath) {
          const previousManifest = verifyInstalledRuntimeRelease(input.previousReleasePath);
          activateRuntimeRelease({
            home,
            releasePath: input.previousReleasePath,
            operationId: `${input.operationId}-rollback`,
          });
          await dependencies.service.restart({
            operationId: `${input.operationId}-rollback`,
            expectedBundleId: previousManifest.bundleId,
            waitForCompletion: true,
          });
          await acceptHealth(input.emit, {
            operationId: `${input.operationId}-rollback`,
            nextReleasePath: input.previousReleasePath,
          }, {
            bundleId: previousManifest.bundleId,
            version: previousManifest.version,
          });
        } else {
          rmSync(paths.currentLink, { force: true });
        }
      } catch (rollbackError: unknown) {
        throw lifecycleError(
          'ACTIVATION_FAILED',
          `runtime activation failed and rollback was not accepted: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
          { phase: 'health', cause: { error, rollbackError } },
        );
      }
      throw error;
    }
  };

  const applyRelease = async (input: {
    operation: 'install' | 'update';
    channel: LifecycleReleaseChannel;
    check?: boolean;
    existingState?: Awaited<ReturnType<typeof inspectLifecycleInstallState>>;
    emit: ReturnType<typeof emitter>;
    operationId?: string;
    lockHeld?: boolean;
  }): Promise<LifecycleOperationResult> => {
    const operationId = input.operationId ?? nextOperationId();
    const program = Effect.gen(function* () {
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

        input.emit('preflight', { dependencyMaterialization: true });
        yield* tryPromise({
          try: () => runtime.materialize({ home, releasePath: staged.releasePath, manifest }),
          code: 'PREFLIGHT_FAILED',
          message: 'runtime dependency materialization failed',
          phase: 'preflight',
        });
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
        yield* tryPromise({
          try: () => activateAndAccept({
            emit: input.emit,
            operationId,
            previousReleasePath,
            nextReleasePath: staged.releasePath,
            manifest,
          }),
          code: 'ACTIVATION_FAILED',
          message: 'runtime activation transaction failed',
          phase: 'activate',
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
    });
    return input.lockHeld
      ? runEffect(program)
      : exclusive(operationId, input.emit, () => program);
  };

  return {
    async status() {
      try {
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
      } catch (error: unknown) {
        throw asLifecycleError(
          error,
          'INSTALL_STATE_INVALID',
          'failed to inspect lifecycle status',
          'inspect',
        );
      }
    },

    async install(input = {}) {
      const emit = emitter('install');
      const initialState = await inspectLifecycleInstallState(home);
      emit('inspect', { installState: initialState.kind });
      if (!initialState.onboardingRequired) {
        const preferences = loadLifecyclePreferences(home, now());
        if (initialState.kind === 'legacy') {
          throw lifecycleError(
            'INSTALL_STATE_INVALID',
            'legacy install must be migrated before runtime activation',
          );
        }
        return applyRelease({
          operation: 'install',
          channel: input.channel ?? preferences.channel,
          existingState: initialState,
          emit,
        });
      }
      if (!dependencies.onboarding) {
        throw lifecycleError(
          'INSTALL_STATE_INVALID',
          'first install requires the onboarding adapter',
        );
      }
      const operationId = nextOperationId();
      return exclusive(operationId, emit, () => Effect.tryPromise({
        try: async () => {
          emit('onboarding');
          try {
            await dependencies.onboarding!();
          } catch (error: unknown) {
            throw asLifecycleError(
              error,
              'ONBOARDING_FAILED',
              'first-install onboarding failed',
              'onboarding',
            );
          }
          const state = await inspectLifecycleInstallState(home);
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
            operationId,
            lockHeld: true,
          });
        },
        catch: (error) => error,
      }));
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
      emit('service-restart', { replySafe: true });
      try {
        await dependencies.service.restart();
      } catch (error: unknown) {
        throw asLifecycleError(
          error,
          'SERVICE_RESTART_FAILED',
          'failed to schedule Consuelo service restart',
          'service-restart',
        );
      }
      emit('complete', { changed: true, scheduled: true });
      return { operation: 'restart', changed: true, detail: { scheduled: true } };
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
          if (!state.currentReleasePath || !state.manifest) {
            throw lifecycleError(
              'REPAIR_FAILED',
              'valid runtime state is missing its release identity',
              { phase: 'inspect' },
            );
          }
          const operationId = nextOperationId();
          return await exclusive(operationId, emit, () =>
            Effect.gen(function* () {
              emit('preflight', { dependencyMaterialization: true, repair: true });
              yield* tryPromise({
                try: () => runtime.materialize({
                  home,
                  releasePath: state.currentReleasePath!,
                  manifest: state.manifest!,
                }),
                code: 'PREFLIGHT_FAILED',
                message: 'runtime dependency materialization failed during repair',
                phase: 'preflight',
              });
              yield* tryPromise({
                try: () => dependencies.service.preflight(),
                code: 'PREFLIGHT_FAILED',
                message: 'platform preflight failed during repair',
                phase: 'preflight',
              });
              emit('migrate', { repair: true });
              yield* tryPromise({
                try: () => migration.run({
                  home,
                  releasePath: state.currentReleasePath!,
                  manifest: state.manifest!,
                }),
                code: 'MIGRATION_FAILED',
                message: 'runtime migration verification failed during repair',
                phase: 'migrate',
              });
              emit('service-restart', { repair: true });
              yield* tryPromise({
                try: () => dependencies.service.restart({
                  operationId,
                  expectedBundleId: state.currentBundleId,
                  waitForCompletion: true,
                }),
                code: 'SERVICE_RESTART_FAILED',
                message: 'failed to restart Consuelo services after repair',
                phase: 'service-restart',
              });
              yield* tryPromise({
                try: () => acceptHealth(emit, {
                  operationId,
                  nextReleasePath: state.currentReleasePath,
                }, {
                  bundleId: state.currentBundleId,
                  version: state.currentVersion,
                }),
                code: 'HEALTH_REJECTED',
                message: 'repaired runtime health acceptance failed',
                phase: 'health',
              });
              emit('complete', {
                changed: true,
                reason: 'runtime dependencies and service state repaired',
              });
              return {
                operation: 'repair',
                changed: true,
                version: state.currentVersion,
                bundleId: state.currentBundleId,
                detail: { repaired: ['dependencies', 'migrations', 'service'] },
              } satisfies LifecycleOperationResult;
            }),
          );
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
            emit('preflight', { dependencyMaterialization: true, repair: true });
            yield* tryPromise({
              try: () => runtime.materialize({
                home,
                releasePath: retained.path,
                manifest: retained.manifest,
              }),
              code: 'PREFLIGHT_FAILED',
              message: 'runtime dependency materialization failed during repair',
              phase: 'preflight',
            });
            yield* tryPromise({
              try: () => dependencies.service.preflight(),
              code: 'PREFLIGHT_FAILED',
              message: 'platform preflight failed during repair',
              phase: 'preflight',
            });
            yield* tryPromise({
              try: () => activateAndAccept({
                emit,
                operationId,
                previousReleasePath: state.currentReleasePath,
                nextReleasePath: retained.path,
                manifest: retained.manifest,
              }),
              code: 'REPAIR_FAILED',
              message: 'failed to reactivate retained runtime release',
              phase: 'activate',
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
