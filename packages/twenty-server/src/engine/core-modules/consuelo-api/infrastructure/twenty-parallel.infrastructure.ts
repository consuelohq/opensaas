import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import * as Sentry from '@sentry/node';
import {
  DialerConflictError,
  DialerInfrastructureError,
  DialerNotFoundError,
  DialerRequestError,
  ParallelCompatibilityRuntime,
  type DialerApplicationError,
  type ParallelCompatibilityRuntimeService,
  type ParallelTelemetryRecord,
} from '@consuelo/dialer';
import { isValidPhone, normalizePhone } from '@consuelo/contacts';
import { Effect, Layer } from 'effect';

import { LegacyDialerService } from 'src/engine/core-modules/consuelo-api/services/legacy-dialer.service';
import { ParallelPosteriorStore } from 'src/engine/core-modules/consuelo-api/services/parallel-posterior.store';
import { ParallelStrategyResolverService } from 'src/engine/core-modules/consuelo-api/services/parallel-strategy-resolver.service';

interface ActiveCallerIdLockService {
  refreshLock(phoneNumber: string, expectedCallSid: string): Promise<boolean>;
}

export class TwentyParallelInfrastructure {
  private readonly logger = new Logger(TwentyParallelInfrastructure.name);

  constructor(
    private readonly legacyDialerService: LegacyDialerService,
    private readonly parallelPosteriorStore: ParallelPosteriorStore,
    private readonly parallelStrategyResolver: ParallelStrategyResolverService,
  ) {}

  createApplicationLayer() {
    const runtime: ParallelCompatibilityRuntimeService = {
      normalizeCustomerNumber: (value) =>
        Effect.try({
          try: () => {
            const normalized = normalizePhone(String(value));
            if (!isValidPhone(normalized)) {
              throw new BadRequestException('Invalid customer phone number');
            }
            return normalized;
          },
          catch: (cause) => this.mapError('normalize-customer-number', cause),
        }),
      resolveStrategy: (input) =>
        this.tryEffect('resolve-strategy', () =>
          this.parallelStrategyResolver.resolve(input),
        ),
      listNumbers: () =>
        this.tryEffect('list-numbers', () =>
          this.legacyDialerService.getDialer().listNumbers(),
        ),
      resolveCallerId: (input) =>
        this.tryEffect('resolve-caller-id', () =>
          this.legacyDialerService
            .getDialer()
            .resolveCallerId(
              {
                to: input.customerNumber,
                from: '',
                localPresence: true,
              },
              input.pool,
            )
            .then(
              (resolution) =>
                resolution.callerIdNumber ??
                process.env.TWILIO_DEFAULT_NUMBER ??
                '',
            ),
        ),
      acquireCallerIdLock: (input) =>
        this.tryEffect('acquire-caller-id-lock', () =>
          this.legacyDialerService
            .getCallerIdLockService()
            .acquireLock(input.phoneNumber, input.userId, input.callSid)
            .then((locked) => {
              if (!locked) {
                const queueId = input.callSid
                  .replace(/^parallel-/, '')
                  .replace(/-\d+$/, '');
                this.logger.warn('parallel dial blocked by caller id lock', {
                  queueId,
                  userId: input.userId,
                  lockedFromNumberSuffix: input.phoneNumber.slice(-4),
                });
              }
              return locked;
            }),
        ),
      transferCallerIdLock: (input) =>
        this.tryEffect('transfer-caller-id-lock', () =>
          this.legacyDialerService
            .getCallerIdLockService()
            .transferLock(
              input.phoneNumber,
              input.expectedCallSid,
              input.callSid,
            ),
        ),
      refreshCallerIdLock: (call) => {
        const lockService =
          this.legacyDialerService.getCallerIdLockService() as
            | (ReturnType<LegacyDialerService['getCallerIdLockService']> &
                ActiveCallerIdLockService)
            | ActiveCallerIdLockService;
        return this.tryEffect('refresh-caller-id-lock', () =>
          lockService
            .refreshLock(call.fromNumber, call.callSid)
            .then((refreshed) => {
              if (!refreshed) {
                this.logger.warn('caller id lock refresh skipped', {
                  callSid: call.callSid,
                  fromNumberSuffix: call.fromNumber.slice(-4),
                });
              }
            }),
        );
      },
      releaseCallerIdLocks: (fromNumbers) =>
        this.tryEffect('release-caller-id-locks', () =>
          Promise.all(
            Array.from(new Set(fromNumbers.filter(Boolean))).map((fromNumber) =>
              this.legacyDialerService
                .getCallerIdLockService()
                .releaseLockByNumber(fromNumber),
            ),
          ).then(() => undefined),
        ),
      initiateGroup: (options) =>
        this.tryEffect('initiate-group', () =>
          this.legacyDialerService.getDialer().parallel.initiateGroup(options),
        ),
      terminateGroup: (groupId) =>
        this.tryEffect('terminate-group', () =>
          this.legacyDialerService.getDialer().parallel.terminateGroup(groupId),
        ),
      validateRequirements: (current, required) => {
        const result = this.legacyDialerService
          .getDialer()
          .parallel.validateRequirements(current, required);
        return {
          ...result,
          missing: Math.max(0, result.required - result.current),
        };
      },
      handleStatusCallback: (input) =>
        this.tryEffect('handle-status-callback', () =>
          this.legacyDialerService
            .getDialer()
            .parallel.handleStatusCallback(
              input.callSid,
              input.callStatus,
              input.answeredBy,
            ),
        ),
      getGroupIdForCall: (callSid) =>
        this.tryEffect('get-group-id-for-call', () =>
          this.legacyDialerService
            .getDialer()
            .parallel.getGroupIdForCall(callSid),
        ),
      getGroup: (groupId) =>
        this.tryEffect('get-group', () =>
          this.legacyDialerService.getDialer().parallel.getGroup(groupId),
        ),
      getReleasableNumbers: (group) =>
        this.legacyDialerService
          .getDialer()
          .parallel.getReleasableNumbers(group),
      getGroupForWorkspace: (groupId, workspaceId) =>
        this.tryEffect('get-group-for-workspace', () =>
          this.legacyDialerService
            .getDialer()
            .parallel.getGroupForWorkspace(groupId, workspaceId),
        ),
      generateCustomerTwiml: (callSid) =>
        this.tryEffect('generate-customer-twiml', () =>
          this.legacyDialerService
            .getDialer()
            .parallel.generateCustomerTwiml(callSid),
        ),
      terminateGroupForWorkspace: (groupId, workspaceId) =>
        this.tryEffect('terminate-group-for-workspace', () =>
          this.legacyDialerService
            .getDialer()
            .parallel.terminateGroupForWorkspace(groupId, workspaceId),
        ),
      claimTelemetryEmission: (groupId) =>
        this.tryEffect('claim-telemetry-emission', () =>
          this.legacyDialerService
            .getDialer()
            .parallel.markTelemetryEmittedIfAbsent(groupId),
        ),
      recordTelemetry: (record) => this.recordTelemetry(record),
    };

    return Layer.succeed(ParallelCompatibilityRuntime, runtime);
  }

  private recordTelemetry(
    record: ParallelTelemetryRecord,
  ): Effect.Effect<void, never> {
    return Effect.promise(async () => {
      this.logger.log('parallel telemetry emitted', {
        groupId: record.group.groupId,
        queueId: record.group.queueId,
        profileId: record.group.profile.id,
        winnerRate: record.telemetry.winnerRate,
        wastedLegs: record.telemetry.wastedLegs,
        connectLatencyMs: record.telemetry.connectLatencyMs,
      });
      try {
        await this.parallelPosteriorStore.updatePosterior(
          record.group.profile.id,
          record.success,
        );
      } catch (cause: unknown) {
        this.logger.error('parallel posterior update failed', {
          groupId: record.group.groupId,
          profileId: record.group.profile.id,
          success: record.success,
        });
        Sentry.captureException(cause, {
          extra: {
            context: 'parallel_status_callback.posterior_update',
            groupId: record.group.groupId,
            profileId: record.group.profile.id,
            success: record.success,
          },
        });
      }
    });
  }

  private tryEffect<A>(
    operation: string,
    run: () => Promise<A>,
  ): Effect.Effect<A, DialerApplicationError> {
    return Effect.tryPromise({
      try: run,
      catch: (cause) => this.mapError(operation, cause),
    });
  }

  private mapError(operation: string, cause: unknown): DialerApplicationError {
    if (cause instanceof BadRequestException) {
      return new DialerRequestError({
        code: 'INVALID_REQUEST',
        message: cause.message,
        details: cause.getResponse(),
        retryable: false,
      });
    }
    if (cause instanceof ConflictException) {
      const response = cause.getResponse();
      return new DialerConflictError({
        code:
          typeof response === 'object' &&
          response !== null &&
          'code' in response
            ? String((response as { code: unknown }).code)
            : 'CONFLICT',
        message: cause.message,
        retryAfterMs:
          typeof response === 'object' &&
          response !== null &&
          'retryAfterMs' in response
            ? Number((response as { retryAfterMs: unknown }).retryAfterMs)
            : undefined,
        retryable: false,
      });
    }
    if (cause instanceof NotFoundException) {
      return new DialerNotFoundError({
        code: 'NOT_FOUND',
        message: cause.message,
        retryable: false,
      });
    }
    return new DialerInfrastructureError({
      operation,
      message: cause instanceof Error ? cause.message : String(cause),
      retryable: true,
      cause,
    });
  }
}
