import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import * as Sentry from '@sentry/node';
import {
  generateParallelCustomerTwiml,
  getParallelGroupStatus,
  initiateParallelDial,
  processParallelCallback,
  terminateParallelGroup,
  validateParallelDial,
  type DialerApplicationError,
  type ParallelDialResult,
  type ParallelGroupStatusResult,
} from '@consuelo/dialer';
import { Effect, Either } from 'effect';

import { TwentyParallelInfrastructure } from 'src/engine/core-modules/consuelo-api/infrastructure/twenty-parallel.infrastructure';
import { LegacyDialerService } from 'src/engine/core-modules/consuelo-api/services/legacy-dialer.service';
import { ParallelPosteriorStore } from 'src/engine/core-modules/consuelo-api/services/parallel-posterior.store';
import { ParallelStrategyResolverService } from 'src/engine/core-modules/consuelo-api/services/parallel-strategy-resolver.service';

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

type SafeErrorDetails = {
  name: string;
  message: string;
  stack?: string;
};

type ProviderErrorDetails = SafeErrorDetails & {
  code: string | null;
};

const CUSTOMER_PHONE_PROVIDER_ERROR_CODES = new Set([
  '21211',
  '21215',
  '13227',
]);

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : fallback;

@Injectable()
export class ParallelService {
  private readonly logger = new Logger(ParallelService.name);
  private readonly infrastructure: TwentyParallelInfrastructure;

  constructor(
    legacyDialerService: LegacyDialerService,
    parallelPosteriorStore: ParallelPosteriorStore,
    parallelStrategyResolver: ParallelStrategyResolverService,
  ) {
    this.infrastructure = new TwentyParallelInfrastructure(
      legacyDialerService,
      parallelPosteriorStore,
      parallelStrategyResolver,
    );
  }

  async initiateParallelDial(
    input: InitiateParallelDialInput,
  ): Promise<ParallelDialResult> {
    const body = input.body;
    const queueId = typeof body.queueId === 'string' ? body.queueId.trim() : '';
    const customerNumberCount = Array.isArray(body.customerNumbers)
      ? body.customerNumbers.length
      : 0;
    const profileId =
      typeof body.profileId === 'string' ? body.profileId : undefined;

    const result = await this.run(
      initiateParallelDial({
        ...input,
        callbackBaseUrl: process.env.API_BASE_URL ?? '',
      }),
    );

    if (Either.isRight(result)) {
      this.logger.log('parallel dial created', {
        queueId,
        workspaceId: input.workspaceId,
        profileId: profileId ?? result.right.profileId,
      });
      return result.right;
    }

    const providerError = this.getProviderErrorDetails(result.left);
    if (this.isProviderCustomerPhoneFailure(providerError)) {
      this.logger.warn('parallel dial rejected customer number', {
        queueId,
        workspaceId: input.workspaceId,
        profileId,
        stage: this.getOperation(result.left, 'initiate-group'),
        customerNumberCount,
        fromNumberCount: customerNumberCount,
        errorCode: providerError.code,
        errorName: providerError.name,
        errorMessage: providerError.message,
      });
      Sentry.addBreadcrumb({
        category: 'parallel-dial',
        level: 'warning',
        message: 'provider rejected customer number',
        data: {
          queueId,
          workspaceId: input.workspaceId,
          profileId,
          stage: this.getOperation(result.left, 'initiate-group'),
          errorCode: providerError.code,
          errorName: providerError.name,
        },
      });
      throw new BadRequestException('Invalid customer phone number');
    }

    if (result.left._tag === 'DialerConflictError') {
      throw new ConflictException({
        code: result.left.code,
        message: result.left.message,
        retryAfterMs: result.left.retryAfterMs,
      });
    }
    if (
      result.left._tag === 'DialerRequestError' &&
      result.left.code !== 'CALLER_ID_LOCK_TRANSFER_FAILED'
    ) {
      throw new BadRequestException(result.left.details ?? result.left.message);
    }

    const safeError = this.getSafeErrorDetails(result.left);
    this.logger.error('parallel dial failed', {
      queueId,
      workspaceId: input.workspaceId,
      profileId,
      stage: this.getOperation(result.left, 'request-validation'),
      customerNumberCount,
      fromNumberCount: customerNumberCount,
      errorName: safeError.name,
      errorMessage: safeError.message,
      errorStack: safeError.stack,
    });
    Sentry.captureException(this.getCause(result.left), {
      extra: {
        context: 'nest_parallel_dial',
        queueId,
        workspaceId: input.workspaceId,
        profileId,
        stage: this.getOperation(result.left, 'request-validation'),
        customerNumberCount,
        fromNumberCount: customerNumberCount,
        errorName: safeError.name,
        errorMessage: safeError.message,
        errorStack: safeError.stack,
      },
    });

    throw new InternalServerErrorException({
      code: 'PARALLEL_DIAL_FAILED',
      message: getErrorMessage(result.left, 'Parallel dial failed'),
    });
  }

  validateParallelDial(input: ValidateParallelDialInput) {
    return this.run(validateParallelDial(input)).then((result) => {
      if (Either.isRight(result)) return result.right;

      this.logger.error('parallel validation failed', {
        workspaceId: input.workspaceId,
      });
      Sentry.captureException(this.getCause(result.left), {
        extra: {
          context: 'nest_parallel_validate',
          workspaceId: input.workspaceId,
        },
      });
      throw new InternalServerErrorException({
        code: 'VALIDATION_FAILED',
        message: getErrorMessage(result.left, 'Validation failed'),
      });
    });
  }

  async statusCallback(body: Record<string, string | undefined>) {
    const callSid = body.CallSid;
    const callStatus = body.CallStatus;
    if (!callSid || !callStatus) {
      throw new BadRequestException('Missing CallSid or CallStatus');
    }

    const result = await this.run(
      processParallelCallback({
        callSid,
        callStatus,
        answeredBy: body.AnsweredBy,
        callDuration: body.CallDuration,
        dialCallDuration: body.DialCallDuration,
      }),
    );
    if (Either.isRight(result)) return { received: true };

    this.logger.error('parallel callback lifecycle failed', {
      callSid,
      callStatus,
      errorMessage: getErrorMessage(result.left, 'Callback lifecycle failed'),
    });
    Sentry.captureException(this.getCause(result.left), {
      extra: {
        context: 'parallel_callback.lifecycle',
        callSid,
        callStatus,
      },
    });
    throw this.toNestError(result.left, {
      internalCode: 'CALLBACK_FAILED',
      fallback: 'Callback lifecycle failed',
    });
  }

  async customerTwiml(
    body: Record<string, string | undefined>,
  ): Promise<string> {
    const callSid = body.CallSid;
    if (!callSid) throw new BadRequestException('Missing CallSid');

    const result = await this.run(
      generateParallelCustomerTwiml({
        callSid,
        callStatus: body.CallStatus,
        answeredBy: body.AnsweredBy,
        callDuration: body.CallDuration,
        dialCallDuration: body.DialCallDuration,
      }),
    );
    if (Either.isRight(result)) return result.right;
    if (result.left._tag === 'DialerNotFoundError') {
      throw new NotFoundException(result.left.message);
    }
    if (result.left._tag === 'DialerRequestError') {
      throw new BadRequestException(result.left.details ?? result.left.message);
    }

    this.logger.error('parallel customer twiml failed', { callSid });
    Sentry.captureException(this.getCause(result.left), {
      extra: { context: 'nest_parallel_customer_twiml', callSid },
    });
    throw new InternalServerErrorException({
      code: 'TWIML_FAILED',
      message: getErrorMessage(result.left, 'TwiML generation failed'),
    });
  }

  getGroupStatus(input: GroupStatusInput): Promise<ParallelGroupStatusResult> {
    return this.run(getParallelGroupStatus(input)).then((result) => {
      if (Either.isRight(result)) return result.right;
      if (result.left._tag === 'DialerNotFoundError') {
        throw new NotFoundException(result.left.message);
      }

      this.logger.error('parallel group lookup failed', input);
      Sentry.captureException(this.getCause(result.left), {
        extra: { context: 'nest_parallel_get_group', ...input },
      });
      throw new InternalServerErrorException({
        code: 'GROUP_LOOKUP_FAILED',
        message: getErrorMessage(result.left, 'Group lookup failed'),
      });
    });
  }

  terminateGroup(input: TerminateGroupInput) {
    return this.run(terminateParallelGroup(input)).then((result) => {
      if (Either.isRight(result)) {
        this.logger.log('parallel group terminated', input);
        return result.right;
      }
      if (result.left._tag === 'DialerNotFoundError') {
        throw new NotFoundException(result.left.message);
      }

      this.logger.error('parallel group terminate failed', {
        groupId: input.groupId,
        workspaceId: input.workspaceId,
      });
      Sentry.captureException(this.getCause(result.left), {
        extra: {
          context: 'nest_parallel_terminate',
          groupId: input.groupId,
          workspaceId: input.workspaceId,
        },
      });
      throw new InternalServerErrorException({
        code: 'TERMINATE_FAILED',
        message: getErrorMessage(result.left, 'Terminate failed'),
      });
    });
  }

  private run<A>(program: Effect.Effect<A, DialerApplicationError, unknown>) {
    return Effect.runPromise(
      Effect.either(
        program.pipe(
          Effect.provide(this.infrastructure.createApplicationLayer()),
        ) as Effect.Effect<A, DialerApplicationError>,
      ),
    );
  }

  private toNestError(
    error: DialerApplicationError,
    input: { internalCode: string; fallback: string },
  ) {
    if (error._tag === 'DialerRequestError') {
      return new BadRequestException(error.details ?? error.message);
    }
    if (error._tag === 'DialerConflictError') {
      return new ConflictException({
        code: error.code,
        message: error.message,
        retryAfterMs: error.retryAfterMs,
      });
    }
    if (error._tag === 'DialerNotFoundError') {
      return new NotFoundException(error.message);
    }
    return new InternalServerErrorException({
      code: input.internalCode,
      message: getErrorMessage(error, input.fallback),
    });
  }

  private getOperation(
    error: DialerApplicationError,
    fallback: string,
  ): string {
    return error._tag === 'DialerInfrastructureError'
      ? error.operation
      : fallback;
  }

  private getCause(error: DialerApplicationError): unknown {
    return error._tag === 'DialerInfrastructureError' && error.cause
      ? error.cause
      : error;
  }

  private getSafeErrorDetails(error: DialerApplicationError): SafeErrorDetails {
    const cause = this.getCause(error);
    if (cause instanceof Error) {
      return {
        name: cause.name,
        message: this.redactPhoneNumbers(cause.message),
        stack: cause.stack,
      };
    }
    return {
      name:
        typeof cause === 'object' && cause !== null && 'name' in cause
          ? String((cause as { name: unknown }).name)
          : error._tag,
      message: this.redactPhoneNumbers(getErrorMessage(cause, error.message)),
    };
  }

  private getProviderErrorDetails(
    error: DialerApplicationError,
  ): ProviderErrorDetails {
    const safe = this.getSafeErrorDetails(error);
    const cause = this.getCause(error);
    const code =
      typeof cause === 'object' &&
      cause !== null &&
      'code' in cause &&
      (typeof (cause as { code: unknown }).code === 'string' ||
        typeof (cause as { code: unknown }).code === 'number')
        ? String((cause as { code: string | number }).code)
        : null;
    return { ...safe, code };
  }

  private isProviderCustomerPhoneFailure(error: ProviderErrorDetails): boolean {
    if (
      error.code !== null &&
      CUSTOMER_PHONE_PROVIDER_ERROR_CODES.has(error.code)
    ) {
      return true;
    }
    const message = error.message.toLowerCase();
    return (
      message.includes('not a valid phone number') ||
      message.includes('invalid phone number') ||
      message.includes('not authorized to call') ||
      message.includes('geo-permissions')
    );
  }

  private redactPhoneNumbers(message: string): string {
    return message.replace(/\+\d{7,15}/g, (match) => `***${match.slice(-4)}`);
  }
}
