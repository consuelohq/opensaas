import {
  BadRequestException,
  Injectable,
  Logger,
  NotImplementedException,
} from "@nestjs/common";
import * as Sentry from "@sentry/node";

import type { ParallelGroup } from "@consuelo/dialer";
import { LegacyDialerService } from "src/engine/core-modules/consuelo-api/services/legacy-dialer.service";
import { ParallelPosteriorStore } from "src/engine/core-modules/consuelo-api/services/parallel-posterior.store";

const MIN_SUCCESS_DURATION_SECONDS = 30;

const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "busy",
  "no-answer",
  "canceled",
]);

@Injectable()
export class ParallelService {
  private readonly logger = new Logger(ParallelService.name);

  constructor(
    private readonly legacyDialerService: LegacyDialerService,
    private readonly parallelPosteriorStore: ParallelPosteriorStore,
  ) {}

  async initiateParallelDial() {
    throw new NotImplementedException(
      "DEV-1459: parallel dial migration in progress",
    );
  }

  async validateParallelDial() {
    throw new NotImplementedException(
      "DEV-1459: parallel validation migration in progress",
    );
  }

  async statusCallback(body: Record<string, string | undefined>) {
    const callSid = body.CallSid;
    const callStatus = body.CallStatus;
    const answeredBy = body.AnsweredBy;

    if (!callSid || !callStatus) {
      throw new BadRequestException("Missing CallSid or CallStatus");
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

    const isTerminalCallback = TERMINAL_STATUSES.has(callStatus);
    const isWinnerCallback = callSid === group.winnerSid;
    const groupHasWinner = group.winnerSid !== null;

    if (isTerminalCallback && isWinnerCallback && groupHasWinner) {
      const claimed =
        await dialer.parallel.markTelemetryEmittedIfAbsent(groupId);

      if (claimed) {
        const telemetry = dialer.parallel.computeTelemetry(group);

        this.logger.log("parallel telemetry emitted", {
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
          this.logger.error("parallel posterior update failed", {
            groupId,
            profileId: group.profile.id,
            success,
          });
          Sentry.captureException(err, {
            extra: {
              context: "parallel_status_callback.posterior_update",
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

  async customerTwiml() {
    throw new NotImplementedException(
      "DEV-1459: customer TwiML migration in progress",
    );
  }

  async getGroupStatus() {
    throw new NotImplementedException(
      "DEV-1459: group status migration in progress",
    );
  }

  async terminateGroup() {
    throw new NotImplementedException(
      "DEV-1459: terminate group migration in progress",
    );
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
      winnerCall.amdResult === "human" ||
      (group.profile.amdPolicy === "human-or-unknown" &&
        winnerCall.amdResult === "unknown");

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
      callbackBody.CallStatus ?? "",
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
