import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import * as Sentry from '@sentry/node';
import {
  liveDialerIdGeneratorLayer,
  startDialerCall,
  type DialerCallStartCapacity,
  type DialerCallStartCall,
  type DialerCallStartResult,
  type StartDialerCallInput,
} from '@consuelo/dialer';
import { Effect, Either, Layer } from 'effect';
import { type DataSource } from 'typeorm';

import { TwentyDialerCallStartInfrastructure } from 'src/engine/core-modules/consuelo-api/infrastructure/twenty-dialer-call-start.infrastructure';
import { LegacyDialerService } from 'src/engine/core-modules/consuelo-api/services/legacy-dialer.service';

export type {
  DialerCallStartCapacity,
  DialerCallStartCall,
  DialerCallStartResult,
  StartDialerCallInput,
};

@Injectable()
export class DialerCallStartService {
  private readonly logger = new Logger(DialerCallStartService.name);
  private readonly infrastructure: TwentyDialerCallStartInfrastructure;

  constructor(
    @InjectDataSource() dataSource: DataSource,
    @Inject(LegacyDialerService) legacyDialerService: LegacyDialerService,
  ) {
    this.infrastructure = new TwentyDialerCallStartInfrastructure(
      dataSource,
      legacyDialerService,
    );
  }

  async startDialerCall(params: {
    workspaceId: string;
    userId: string;
    input: StartDialerCallInput;
  }): Promise<DialerCallStartResult> {
    try {
      const result = await Effect.runPromise(
        Effect.either(
          startDialerCall(params).pipe(
            Effect.provide(
              Layer.mergeAll(
                this.infrastructure.createApplicationLayer(),
                liveDialerIdGeneratorLayer,
              ),
            ),
          ),
        ),
      );

      if (Either.isRight(result)) {
        return result.right;
      }
      if (result.left._tag === 'DialerRequestError') {
        throw new BadRequestException(
          result.left.details ?? result.left.message,
        );
      }
      return this.failStart(params, result.left);
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      return this.failStart(params, error);
    }
  }

  private failStart(
    params: {
      workspaceId: string;
      userId: string;
      input: StartDialerCallInput;
    },
    error: unknown,
  ): never {
    this.logger.error('[DialerCallStart] start failed', {
      workspaceId: params.workspaceId,
      userId: params.userId,
      source: params.input.source,
      selectionStrategy: params.input.selectionStrategy,
      requestedFanout: params.input.requestedFanout,
      callMode: params.input.callMode ?? 'live',
      errorMessage: this.redactPhoneNumbers(
        error instanceof Error ? error.message : String(error),
      ),
    });
    Sentry.captureException(error, {
      extra: {
        context: 'dialer_call_start',
        workspaceId: params.workspaceId,
        source: params.input.source,
        selectionStrategy: params.input.selectionStrategy,
        requestedFanout: params.input.requestedFanout,
        callMode: params.input.callMode ?? 'live',
      },
    });

    throw new InternalServerErrorException({
      code: 'DIALER_CALL_START_FAILED',
      message: 'Dialer call start failed',
    });
  }

  private redactPhoneNumbers(message: string): string {
    return message.replace(/\+\d{7,15}/g, (match) => `***${match.slice(-4)}`);
  }
}
