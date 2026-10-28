import type { DialerPlanCatalog, DialerPlanCode } from './catalog';

type CallerIdSelection =
  | { kind: 'automatic' }
  | { kind: 'explicit'; phoneNumber: string };

export const resolveSeatEntitlement = (input: {
  catalog: DialerPlanCatalog;
  planCode: DialerPlanCode;
  activeNumberCount: number;
  requestedLines: number;
  callerIdSelection: CallerIdSelection;
  connectedMinutes: number;
}) => {
  const plan = input.catalog.plans[input.planCode];
  const minuteLimitReached =
    plan.includedMinutes !== null &&
    input.connectedMinutes >= plan.includedMinutes;
  const effectiveLineCount =
    input.callerIdSelection.kind === 'explicit'
      ? Math.min(input.activeNumberCount > 0 ? 1 : 0, input.requestedLines)
      : Math.min(
          Math.max(0, input.requestedLines),
          plan.predictive ? input.activeNumberCount : 1,
        );
  const noNumber = input.activeNumberCount <= 0 || effectiveLineCount <= 0;

  return {
    maxNumbers: plan.maxNumbersPerSeat,
    effectiveLineCount,
    predictive: plan.predictive,
    recordings: plan.recordings,
    transcripts: plan.transcripts,
    canStartCall: !minuteLimitReached && !noNumber,
    denialCode: minuteLimitReached
      ? 'MINUTE_LIMIT_REACHED'
      : noNumber
        ? 'NO_CALLER_ID'
        : null,
  };
};

export const resolveTrialEntitlement = (input: {
  catalog: DialerPlanCatalog;
  seatCount: number;
  numberCount: number;
  connectedMinutes: number;
}) => ({
  planCode: input.catalog.trial.planCode,
  canStartCall:
    input.connectedMinutes < input.catalog.trial.includedMinutes &&
    input.seatCount <= input.catalog.trial.maxSeats &&
    input.numberCount <= input.catalog.trial.maxNumbers,
  canAddSeat: input.seatCount < input.catalog.trial.maxSeats,
  canAddNumber: input.numberCount < input.catalog.trial.maxNumbers,
  remainingMinutes: Math.max(
    0,
    input.catalog.trial.includedMinutes - input.connectedMinutes,
  ),
});
