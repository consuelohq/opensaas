import { Injectable } from '@nestjs/common';

import {
  StoppingModelService,
  type HazardEstimate,
  WhittleIndexService,
} from '@consuelo/dialer';

import { CallTimingStore } from 'src/engine/core-modules/consuelo-api/services/call-timing-store';
import { StoppingModelStoreService } from 'src/engine/core-modules/consuelo-api/services/stopping-model-store.service';

type RankCandidatesInput = {
  workspaceId: string;
  segmentId: string;
  localTimezone: string;
  callableWindowEndHour: number;
  candidates: Array<{
    queueItemId: string;
    contactId: string;
    position: number;
    attempts: number;
    lastAttemptAt: Date | null;
  }>;
};

@Injectable()
export class WhittleIndexStoreService {
  private readonly whittleIndexService = new WhittleIndexService();
  private readonly stoppingModelService: StoppingModelService;

  constructor(
    private readonly callTimingStore: CallTimingStore,
    private readonly stoppingModelStore: StoppingModelStoreService,
  ) {
    this.stoppingModelService = new StoppingModelService(this.stoppingModelStore);
  }

  async rankCandidates(
    params: RankCandidatesInput,
  ): Promise<
    Array<{
      queueItemId: string;
      contactId: string;
      index: number;
      position: number;
      components: {
        expectedReward: number;
        cost: number;
        urgencyBonus: number;
        explorationBonus: number;
      };
      filteredOut: boolean;
    }>
  > {
    if (params.candidates.length === 0) {
      return [];
    }

    const now = new Date();
    const localParts = this.getLocalTimeParts(now, params.localTimezone);
    const hoursRemainingInWindow = Math.max(
      params.callableWindowEndHour - localParts.localHour,
      0,
    );
    const economics = await this.stoppingModelStore.getWorkspaceEconomics(
      params.workspaceId,
    );

    const attemptNumbers = [
      ...new Set(params.candidates.map((candidate) => Number(candidate.attempts ?? 0) + 1)),
    ];

    const hazardByAttempt = new Map<number, HazardEstimate[]>();

    for (const attemptNumber of attemptNumbers) {
      const hazardEstimates = await this.callTimingStore.getHazardEstimates(
        params.segmentId,
        attemptNumber,
        params.workspaceId,
      );

      hazardByAttempt.set(attemptNumber, hazardEstimates);
    }

    const rankedCandidates = await Promise.all(
      params.candidates.map(async (candidate) => {
        const nextAttemptNumber = Number(candidate.attempts ?? 0) + 1;
        const hazardEstimates = hazardByAttempt.get(nextAttemptNumber) ?? [];
        const hazardEstimate = this.findHazardEstimate({
          hazardEstimates,
          hourOfDay: localParts.localHour,
          dayOfWeek: localParts.localDayOfWeek,
          attemptNumber: nextAttemptNumber,
        });
        const stoppingThreshold = await this.stoppingModelService.getThresholdForAttempt({
          workspaceId: params.workspaceId,
          segmentId: params.segmentId,
          attemptNumber: nextAttemptNumber,
          maxAttempts: nextAttemptNumber,
        });

        if (stoppingThreshold?.shouldStop) {
          return {
            queueItemId: candidate.queueItemId,
            contactId: candidate.contactId,
            index: Number.NEGATIVE_INFINITY,
            position: candidate.position,
            components: {
              expectedReward: 0,
              cost: economics.costPerAttempt,
              urgencyBonus: 0,
              explorationBonus: 0,
            },
            filteredOut: true,
          };
        }

        const staleDecayFactor = this.getStaleDecayFactor(
          candidate.lastAttemptAt,
          now,
        );
        const adjustedAnswerRate =
          Math.max(hazardEstimate?.answerRate ?? 0, 0) * staleDecayFactor;
        const computed = this.whittleIndexService.computeIndex({
          answerRate: adjustedAnswerRate,
          valuePerConnection: economics.valuePerConnection,
          costPerAttempt: economics.costPerAttempt,
          hoursRemainingInWindow,
          segmentSampleSize: Math.max(hazardEstimate?.sampleSize ?? 0, 1),
        });

        return {
          queueItemId: candidate.queueItemId,
          contactId: candidate.contactId,
          index: computed.index,
          position: candidate.position,
          components: computed.components,
          filteredOut: false,
        };
      }),
    );

    return rankedCandidates
      .filter((candidate) => !candidate.filteredOut)
      .sort((left, right) => {
        if (right.index !== left.index) {
          return right.index - left.index;
        }

        return left.position - right.position;
      });
  }

  private findHazardEstimate(params: {
    hazardEstimates: HazardEstimate[];
    hourOfDay: number;
    dayOfWeek: number;
    attemptNumber: number;
  }): HazardEstimate | null {
    const exactMatch = params.hazardEstimates.find(
      (estimate) =>
        estimate.hourOfDay === params.hourOfDay &&
        estimate.dayOfWeek === params.dayOfWeek &&
        estimate.attemptNumber === params.attemptNumber,
    );

    if (exactMatch) {
      return exactMatch;
    }

    const fallbackMatch = params.hazardEstimates.find(
      (estimate) => estimate.attemptNumber === params.attemptNumber,
    );

    return fallbackMatch ?? null;
  }

  private getLocalTimeParts(now: Date, timeZone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      hour: '2-digit',
      weekday: 'short',
    });
    const parts = formatter.formatToParts(now);
    const hourPart = parts.find((part) => part.type === 'hour')?.value ?? '0';
    const weekdayPart = parts.find((part) => part.type === 'weekday')?.value ?? 'Sun';

    return {
      localHour: Number(hourPart),
      localDayOfWeek: this.weekdayToNumber(weekdayPart),
    };
  }

  private weekdayToNumber(weekday: string) {
    switch (weekday) {
      case 'Mon':
        return 1;
      case 'Tue':
        return 2;
      case 'Wed':
        return 3;
      case 'Thu':
        return 4;
      case 'Fri':
        return 5;
      case 'Sat':
        return 6;
      default:
        return 0;
    }
  }

  private getStaleDecayFactor(lastAttemptAt: Date | null, now: Date) {
    if (!lastAttemptAt) {
      return 1;
    }

    const hoursSinceLastAttempt =
      (now.getTime() - lastAttemptAt.getTime()) / (60 * 60 * 1000);

    if (hoursSinceLastAttempt > 48) {
      return 0.8;
    }

    return 1;
  }
}
