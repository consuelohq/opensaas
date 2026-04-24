import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';

import type {
  NumberPool,
  ParallelCall,
  ParallelDialResult,
  ParallelGroup,
  ProfileKey,
} from '@consuelo/dialer';
import { LegacyDialerService } from 'src/engine/core-modules/consuelo-api/services/legacy-dialer.service';
import { ParallelPosteriorStore } from 'src/engine/core-modules/consuelo-api/services/parallel-posterior.store';
import { ParallelStrategyResolverService } from 'src/engine/core-modules/consuelo-api/services/parallel-strategy-resolver.service';

const E164_REGEX = /^\+[1-9]\d{1,14}$/;
const MIN_SUCCESS_DURATION_SECONDS = 30;

const TERMINAL_STATUSES = new Set([
  'completed',
  'failed',
  'busy',
  'no-answer',
  'canceled',
]);

type ParallelDialBody = {
  customerNumbers?: unknown;
  queueId?: unknown;
  contactIds?: unknown;
  profileId?: unknown;
  campaignSegment?: unknown;
  recentAnswerRate?: unknown;
};

type InitiateParallelDialInput = {
  body: Record<string, unknown>;
  userId: string;
  workspaceId: string;
};

type ValidateParallelDialInput = {
  query: Record<string, string | undefined>;
  workspaceId: string;
};

type GroupStatusInput = {
  groupId: string;
  workspaceId: string;
};

type TerminateGroupInput = {
  groupId: string;
  userId: string;
  workspaceId: string;
};

type ParallelDialCreateStage =
  | 'request-validation'
  | 'legacy-dialer'
  | 'strategy-resolution'
  | 'fanout-validation'
  | 'list-numbers'
  | 'caller-id-resolution'
  | 'caller-id-lock-acquisition'
  | 'callback-url-construction'
  | 'initiate-group';

type SafeErrorDetails = {
  name: string;
  message: string;
  stack?: string;
};

type GroupStatusResponse = {
  groupId: string;
  status: string;
  winnerSid: string | null;
  winner: ParallelCall | null;
  calls: Array<{
    callSid: string;
    customerNumber: string;
    position: number;
    status: string;
    amdResult?: string;
    contactId?: string;
  }>;
};

const isProfileKey = (value: unknown): value is ProfileKey =>
  value === 'balanced' || value === 'aggressive' || value === 'conservative';

const getErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

@Injectable()
export class ParallelService {
  private readonly logger = new Logger(ParallelService.name);

  constructor(
    private readonly legacyDialerService: LegacyDialerService,
    private readonly parallelPosteriorStore: ParallelPosteriorStore,
    private readonly parallelStrategyResolver: ParallelStrategyResolverService,
  ) {}

  async initiateParallelDial(
    input: InitiateParallelDialInput,
  ): Promise<ParallelDialResult> {
    const body = input.body as ParallelDialBody;
    const customerNumbers = this.readCustomerNumbers(body.customerNumbers);
    const queueId = this.readRequiredString(body.queueId, 'queueId');
    const contactIds = this.readOptionalStringArray(body.contactIds);
    const campaignSegment = this.readOptionalString(body.campaignSegment);
    const recentAnswerRate = this.readOptionalNumber(body.recentAnswerRate);
    const profileId = isProfileKey(body.profileId) ? body.profileId : undefined;

    this.validateCustomerNumbers(customerNumbers);

    let createStage: ParallelDialCreateStage = 'request-validation';
    let resolvedProfileId = profileId;
    let fromNumberCount = 0;

    try {
      createStage = 'legacy-dialer';
      const dialer = this.legacyDialerService.getDialer();

      createStage = 'strategy-resolution';
      const strategy = await this.parallelStrategyResolver.resolve({
        queueId,
        workspaceId: input.workspaceId,
        campaignSegment,
        recentAnswerRate,
        profileId,
      });
      resolvedProfileId = strategy.profile.id;

      createStage = 'fanout-validation';
      if (customerNumbers.length !== strategy.profile.fanout) {
        throw new BadRequestException(
          `Profile ${strategy.profile.id} requires exactly ${strategy.profile.fanout} customerNumbers`,
        );
      }

      createStage = 'list-numbers';
      const accountNumbers = await dialer.listNumbers();
      const pool: NumberPool = {
        numbers: accountNumbers,
        primaryNumber: accountNumbers[0],
      };

      createStage = 'caller-id-resolution';
      const fromNumbers = await this.resolveCallerIds(customerNumbers, pool);
      fromNumberCount = fromNumbers.length;

      createStage = 'caller-id-lock-acquisition';
      const acquiredFromNumbers = await this.acquireCallerIdLocks({
        fromNumbers,
        queueId,
        userId: input.userId,
      });

      try {
        createStage = 'callback-url-construction';
        const baseUrl = process.env.API_BASE_URL ?? '';
        const statusCallbackUrl = `${baseUrl}/api/v1/calls/parallel/status-callback`;
        const customerTwimlUrl = `${baseUrl}/api/v1/calls/parallel/customer-twiml`;

        createStage = 'initiate-group';
        const result = await dialer.parallel.initiateGroup({
          customerNumbers,
          queueId,
          contactIds,
          userId: input.userId,
          fromNumbers,
          statusCallbackUrl,
          customerTwimlUrl,
          profile: strategy.profile,
          campaignSegment,
        });

        this.logger.log('parallel dial created', {
          queueId,
          workspaceId: input.workspaceId,
          profileId: strategy.profile.id,
          strategyReason: strategy.reason,
        });

        return result;
      } catch (err: unknown) {
        await this.releaseCallerIdLocks(acquiredFromNumbers);
        throw err;
      }
    } catch (err: unknown) {
      if (err instanceof BadRequestException || err instanceof ConflictException) {
        throw err;
      }

      const safeError = this.getSafeErrorDetails(err);

      this.logger.error('parallel dial failed', {
        queueId,
        workspaceId: input.workspaceId,
        profileId: resolvedProfileId,
        stage: createStage,
        customerNumberCount: customerNumbers.length,
        fromNumberCount,
        errorName: safeError.name,
        errorMessage: safeError.message,
        errorStack: safeError.stack,
      });
      Sentry.captureException(err, {
        extra: {
          context: 'nest_parallel_dial',
          queueId,
          workspaceId: input.workspaceId,
          profileId: resolvedProfileId,
          stage: createStage,
          customerNumberCount: customerNumbers.length,
          fromNumberCount,
          errorName: safeError.name,
          errorMessage: safeError.message,
          errorStack: safeError.stack,
        },
      });

      throw new InternalServerErrorException({
        code: 'PARALLEL_DIAL_FAILED',
        message: getErrorMessage(err, 'Parallel dial failed'),
      });
    }
  }

  async validateParallelDial(input: ValidateParallelDialInput) {
    try {
      const profileId = isProfileKey(input.query.profileId)
        ? input.query.profileId
        : undefined;
      const queueId = input.query.queueId ?? 'default';
      const recentAnswerRate = this.readOptionalNumber(
        input.query.recentAnswerRate,
      );
      const strategy = await this.parallelStrategyResolver.resolve({
        queueId,
        workspaceId: input.workspaceId,
        campaignSegment: input.query.campaignSegment,
        recentAnswerRate,
        profileId,
      });
      const dialer = this.legacyDialerService.getDialer();
      const numbers = await dialer.listNumbers();
      const result = dialer.parallel.validateRequirements(
        numbers.length,
        strategy.profile.fanout,
      );

      return {
        ...result,
        profile: strategy.profile,
        strategyReason: strategy.reason,
      };
    } catch (err: unknown) {
      this.logger.error('parallel validation failed', {
        workspaceId: input.workspaceId,
      });
      Sentry.captureException(err, {
        extra: { context: 'nest_parallel_validate', workspaceId: input.workspaceId },
      });

      throw new InternalServerErrorException({
        code: 'VALIDATION_FAILED',
        message: getErrorMessage(err, 'Validation failed'),
      });
    }
  }

  async statusCallback(body: Record<string, string | undefined>) {
    const callSid = body.CallSid;
    const callStatus = body.CallStatus;
    const answeredBy = body.AnsweredBy;

    if (!callSid || !callStatus) {
      throw new BadRequestException('Missing CallSid or CallStatus');
    }

    const dialer = this.legacyDialerService.getDialer();
    await dialer.parallel.handleStatusCallback(callSid, callStatus, answeredBy);

    const groupId = await dialer.parallel.getGroupIdForCall(callSid);
    if (!groupId) {
      return { received: true };
    }

    const group = await dialer.parallel.getGroup(groupId);
    if (!group) {
      return { received: true };
    }

    if (group.status === 'connected' || group.status === 'completed') {
      const releasableNumbers = dialer.parallel.getReleasableNumbers(group);
      await this.releaseCallerIdLocks(releasableNumbers);
    }

    const isTerminalCallback = TERMINAL_STATUSES.has(callStatus);
    const isWinnerCallback = callSid === group.winnerSid;
    const groupHasWinner = group.winnerSid !== null;

    if (isTerminalCallback && isWinnerCallback && groupHasWinner) {
      const claimed = await dialer.parallel.markTelemetryEmittedIfAbsent(groupId);

      if (claimed) {
        const telemetry = dialer.parallel.computeTelemetry(group);

        this.logger.log('parallel telemetry emitted', {
          groupId,
          queueId: group.queueId,
          profileId: group.profile.id,
          winnerRate: telemetry.winnerRate,
          wastedLegs: telemetry.wastedLegs,
          connectLatencyMs: telemetry.connectLatencyMs,
        });

        const success = this.isSuccessfulCompletion(group, body, new Date());

        try {
          await this.parallelPosteriorStore.updatePosterior(
            group.profile.id,
            success,
          );
        } catch (err: unknown) {
          this.logger.error('parallel posterior update failed', {
            groupId,
            profileId: group.profile.id,
            success,
          });
          Sentry.captureException(err, {
            extra: {
              context: 'parallel_status_callback.posterior_update',
              groupId,
              profileId: group.profile.id,
              success,
            },
          });
        }
      }
    }

    return { received: true };
  }

  async customerTwiml(
    body: Record<string, string | undefined>,
  ): Promise<string> {
    const callSid = body.CallSid;

    if (!callSid) {
      throw new BadRequestException('Missing CallSid');
    }

    try {
      const twiml =
        await this.legacyDialerService.getDialer().parallel.generateCustomerTwiml(
          callSid,
        );

      if (!twiml) {
        throw new NotFoundException('No parallel group for this call');
      }

      return twiml;
    } catch (err: unknown) {
      if (err instanceof NotFoundException) {
        throw err;
      }

      this.logger.error('parallel customer twiml failed', { callSid });
      Sentry.captureException(err, {
        extra: { context: 'nest_parallel_customer_twiml', callSid },
      });

      throw new InternalServerErrorException({
        code: 'TWIML_FAILED',
        message: getErrorMessage(err, 'TwiML generation failed'),
      });
    }
  }

  async getGroupStatus(input: GroupStatusInput): Promise<GroupStatusResponse> {
    try {
      const group = await this.legacyDialerService
        .getDialer()
        .parallel.getGroup(input.groupId);

      if (!group) {
        throw new NotFoundException('Parallel group not found');
      }

      const winner = group.winnerSid
        ? group.calls.find((call) => call.callSid === group.winnerSid) ?? null
        : null;

      return {
        groupId: group.groupId,
        status: group.status,
        winnerSid: group.winnerSid,
        winner,
        calls: group.calls.map((call) => ({
          callSid: call.callSid,
          customerNumber: call.customerNumber,
          position: call.position,
          status: call.status,
          amdResult: call.amdResult,
          contactId: call.contactId,
        })),
      };
    } catch (err: unknown) {
      if (err instanceof NotFoundException) {
        throw err;
      }

      this.logger.error('parallel group lookup failed', {
        groupId: input.groupId,
        workspaceId: input.workspaceId,
      });
      Sentry.captureException(err, {
        extra: {
          context: 'nest_parallel_get_group',
          groupId: input.groupId,
          workspaceId: input.workspaceId,
        },
      });

      throw new InternalServerErrorException({
        code: 'GROUP_LOOKUP_FAILED',
        message: getErrorMessage(err, 'Group lookup failed'),
      });
    }
  }

  async terminateGroup(input: TerminateGroupInput) {
    try {
      const dialer = this.legacyDialerService.getDialer();
      const group = await dialer.parallel.getGroup(input.groupId);

      if (!group) {
        throw new NotFoundException('Parallel group not found');
      }

      await this.releaseCallerIdLocks(
        group.calls.map((call) => call.fromNumber).filter(Boolean),
      );
      await dialer.parallel.terminateGroup(input.groupId);

      this.logger.log('parallel group terminated', {
        groupId: input.groupId,
        userId: input.userId,
        workspaceId: input.workspaceId,
        profileId: group.profile.id,
      });

      return { groupId: input.groupId, status: 'completed' };
    } catch (err: unknown) {
      if (err instanceof NotFoundException) {
        throw err;
      }

      this.logger.error('parallel group terminate failed', {
        groupId: input.groupId,
        workspaceId: input.workspaceId,
      });
      Sentry.captureException(err, {
        extra: {
          context: 'nest_parallel_terminate',
          groupId: input.groupId,
          workspaceId: input.workspaceId,
        },
      });

      throw new InternalServerErrorException({
        code: 'TERMINATE_FAILED',
        message: getErrorMessage(err, 'Terminate failed'),
      });
    }
  }

  private getSafeErrorDetails(err: unknown): SafeErrorDetails {
    if (err instanceof Error) {
      return {
        name: err.name,
        message: err.message,
        stack: err.stack,
      };
    }

    return {
      name: 'NonError',
      message: String(err),
    };
  }

  private readCustomerNumbers(value: unknown): string[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException('Requires customerNumbers and a queueId');
    }

    return value.map((customerNumber) => String(customerNumber));
  }

  private readRequiredString(value: unknown, fieldName: string): string {
    const parsed = typeof value === 'string' ? value.trim() : '';

    if (parsed.length === 0) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    return parsed;
  }

  private readOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private readOptionalStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    return value.map((item) => String(item));
  }

  private readOptionalNumber(value: unknown): number | undefined {
    if (typeof value !== 'string' && typeof value !== 'number') {
      return undefined;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private validateCustomerNumbers(customerNumbers: string[]) {
    const hasInvalidNumber = customerNumbers.some(
      (customerNumber) => !E164_REGEX.test(customerNumber),
    );

    if (hasInvalidNumber) {
      throw new BadRequestException('Invalid E.164 customer numbers');
    }
  }

  private async resolveCallerIds(
    customerNumbers: string[],
    pool: NumberPool,
  ): Promise<string[]> {
    const dialer = this.legacyDialerService.getDialer();
    const fromNumbers: string[] = [];

    for (const customerNumber of customerNumbers) {
      const resolution = await dialer.resolveCallerId(
        {
          to: customerNumber,
          from: '',
          localPresence: true,
        },
        pool,
      );

      fromNumbers.push(
        resolution.callerIdNumber ?? process.env.TWILIO_DEFAULT_NUMBER ?? '',
      );
    }

    return fromNumbers;
  }

  private async acquireCallerIdLocks(input: {
    fromNumbers: string[];
    queueId: string;
    userId: string;
  }): Promise<string[]> {
    const lockableFromNumbers = Array.from(
      new Set(input.fromNumbers.filter((fromNumber) => fromNumber.length > 0)),
    );
    const acquiredFromNumbers: string[] = [];

    for (const [index, fromNumber] of lockableFromNumbers.entries()) {
      const locked = await this.legacyDialerService
        .getCallerIdLockService()
        .acquireLock(fromNumber, input.userId, `parallel-${input.queueId}-${index}`);

      if (!locked) {
        await this.releaseCallerIdLocks(acquiredFromNumbers);
        throw new ConflictException({
          code: 'CALLER_ID_LOCKED',
          message: 'Caller ID is in use',
        });
      }

      acquiredFromNumbers.push(fromNumber);
    }

    return acquiredFromNumbers;
  }

  private async releaseCallerIdLocks(fromNumbers: string[]) {
    for (const fromNumber of fromNumbers) {
      await this.legacyDialerService
        .getCallerIdLockService()
        .releaseLockByNumber(fromNumber);
    }
  }

  private isSuccessfulCompletion(
    group: ParallelGroup,
    callbackBody: Record<string, string | undefined>,
    callbackReceivedAt: Date,
  ): boolean {
    if (!group.winnerSid) {
      return false;
    }

    const winnerCall = group.calls.find(
      (call) => call.callSid === group.winnerSid,
    );
    if (!winnerCall) {
      return false;
    }

    const isHumanOrUnknown =
      winnerCall.amdResult === 'human' ||
      (group.profile.amdPolicy === 'human-or-unknown' &&
        winnerCall.amdResult === 'unknown');

    if (!isHumanOrUnknown) {
      return false;
    }

    const callbackDurationSeconds = this.parseDurationSeconds(callbackBody);
    if (callbackDurationSeconds !== null) {
      return callbackDurationSeconds >= MIN_SUCCESS_DURATION_SECONDS;
    }

    if (!group.connectedAt) {
      return false;
    }

    const connectedAtMs = new Date(group.connectedAt).getTime();
    if (Number.isNaN(connectedAtMs)) {
      return false;
    }

    const proxyDurationSeconds = Math.max(
      0,
      Math.floor((callbackReceivedAt.getTime() - connectedAtMs) / 1000),
    );

    const isTerminalState = TERMINAL_STATUSES.has(
      callbackBody.CallStatus ?? '',
    );
    return (
      isTerminalState && proxyDurationSeconds >= MIN_SUCCESS_DURATION_SECONDS
    );
  }

  private parseDurationSeconds(
    callbackBody: Record<string, string | undefined>,
  ): number | null {
    const rawDuration =
      callbackBody.CallDuration ?? callbackBody.DialCallDuration;
    if (!rawDuration) {
      return null;
    }

    const parsed = Number(rawDuration);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }

    return Math.floor(parsed);
  }
}
