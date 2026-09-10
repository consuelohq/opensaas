export const createLabClock = (initial: string) => {
  let milliseconds = Date.parse(initial);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString() !== initial
  )
    throw new Error('Lab clock requires a canonical UTC timestamp');
  return {
    now: () => new Date(milliseconds).toISOString(),
    advance: (duration: number) => {
      const next = milliseconds + duration;
      if (
        !Number.isSafeInteger(duration) ||
        duration < 0 ||
        !Number.isFinite(new Date(next).getTime())
      )
        throw new Error(
          'Lab clock must advance by a bounded nonnegative integer',
        );
      milliseconds = next;
    },
  };
};

export const createDeliverySchedule = <TFact>(input: {
  seed: number;
  facts: readonly TFact[];
  copies: readonly number[];
  maxDelayMilliseconds: number;
}) => {
  if (
    !Number.isSafeInteger(input.seed) ||
    input.copies.length !== input.facts.length ||
    !Number.isSafeInteger(input.maxDelayMilliseconds) ||
    input.maxDelayMilliseconds < 0 ||
    input.maxDelayMilliseconds > 86_400_000 ||
    input.copies.some(
      (count) => !Number.isSafeInteger(count) || count < 0 || count > 10,
    ) ||
    input.facts.length > 10_000
  )
    throw new Error('Invalid bounded delivery schedule');
  let state = input.seed >>> 0;
  const random = () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
  return input.facts
    .flatMap((fact, index) =>
      Array.from({ length: input.copies[index]! }, (_, copy) => ({
        fact,
        index,
        copy,
        at: Math.floor(random() * (input.maxDelayMilliseconds + 1)),
      })),
    )
    .sort(
      (left, right) =>
        left.at - right.at ||
        left.index - right.index ||
        left.copy - right.copy,
    );
};

export const createSimulatedEndpoint = (
  endpoint: 'browser' | 'phone',
  clock: ReturnType<typeof createLabClock>,
) => {
  let reachable = true;
  return {
    setReachable: (value: boolean) => {
      reachable = value;
    },
    respond: (result: 'accept' | 'decline' | 'timeout') => ({
      endpoint,
      result: reachable ? result : 'unreachable',
      observedAt: clock.now(),
    }),
  };
};

export type SimulatedCarrierMode = 'succeed' | 'reject' | 'lose_response';
export type SimulatedCarrierOutcome =
  | 'succeeded'
  | 'failed'
  | 'unknown'
  | 'absent';

// Intentionally no deduplication: an accidental resend must be visible as a second effect.
export const createSimulatedCarrier = () => {
  const records = new Map<
    string,
    {
      attempts: number;
      effects: number;
      outcome: 'succeeded' | 'failed';
    }
  >();
  let lookupAvailable = true;
  return {
    setLookupAvailable: (available: boolean) => {
      lookupAvailable = available;
    },
    execute: (commandId: string, mode: SimulatedCarrierMode) => {
      const previous = records.get(commandId);
      records.set(commandId, {
        attempts: (previous?.attempts ?? 0) + 1,
        effects: (previous?.effects ?? 0) + (mode === 'reject' ? 0 : 1),
        outcome: mode === 'reject' ? 'failed' : 'succeeded',
      });
      return {
        outcome:
          mode === 'lose_response'
            ? ('unknown' as const)
            : mode === 'reject'
              ? ('failed' as const)
              : ('succeeded' as const),
      };
    },
    inspect: (commandId: string): { outcome: SimulatedCarrierOutcome } => ({
      outcome: lookupAvailable
        ? (records.get(commandId)?.outcome ?? 'absent')
        : 'unknown',
    }),
    evidence: () =>
      [...records]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([commandId, record]) => ({
          commandId,
          attempts: record.attempts,
          effects: record.effects,
        })),
  };
};
