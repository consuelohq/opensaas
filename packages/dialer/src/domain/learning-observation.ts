import type { ParallelCall, ParallelGroup } from '../types.js';
import { isHumanLikeAnswer } from './parallel-profile.js';

export type LearningOutcomeClass =
  | 'response'
  | 'non_response'
  | 'censored';

export type LearningCensorReason =
  | 'competing_winner'
  | 'ambiguous_termination';

export type LearningObservationClassification = {
  outcomeClass: LearningOutcomeClass;
  censorReason: LearningCensorReason | null;
};

export type LocalCalendarSlot = {
  hourOfDay: number;
  dayOfWeek: number;
};

const DAY_OF_WEEK: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export const resolveLocalCalendarSlot = (
  attemptedAt: string | Date,
  timeZone: string,
): LocalCalendarSlot => {
  const date =
    attemptedAt instanceof Date ? attemptedAt : new Date(attemptedAt);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('attemptedAt must be a valid date');
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date);
  const hourPart = parts.find((part) => part.type === 'hour')?.value;
  const weekdayPart = parts.find((part) => part.type === 'weekday')?.value;
  const hourOfDay = Number(hourPart);
  const dayOfWeek = weekdayPart ? DAY_OF_WEEK[weekdayPart] : undefined;

  if (
    !Number.isInteger(hourOfDay) ||
    hourOfDay < 0 ||
    hourOfDay > 23 ||
    dayOfWeek === undefined
  ) {
    throw new Error('Failed to resolve local calendar slot');
  }

  return { hourOfDay, dayOfWeek };
};

export const classifyLearningObservation = (
  group: ParallelGroup,
  call: ParallelCall,
): LearningObservationClassification => {
  if (call.amdResult === 'machine') {
    return { outcomeClass: 'non_response', censorReason: null };
  }

  const status = call.status.trim().toLowerCase();
  if (status === 'no-answer' || status === 'busy' || status === 'failed') {
    return { outcomeClass: 'non_response', censorReason: null };
  }

  if (call.answeredAt && isHumanLikeAnswer(group.profile, call.amdResult)) {
    return { outcomeClass: 'response', censorReason: null };
  }

  const connectedAt = group.connectedAt ? Date.parse(group.connectedAt) : Number.NaN;
  const terminatedAt = call.terminatedAt
    ? Date.parse(call.terminatedAt)
    : Number.NaN;
  if (
    group.profile.terminationPolicy === 'winner-take-all' &&
    group.winnerSid !== null &&
    group.winnerSid !== call.callSid &&
    Number.isFinite(connectedAt) &&
    Number.isFinite(terminatedAt) &&
    terminatedAt >= connectedAt
  ) {
    return {
      outcomeClass: 'censored',
      censorReason: 'competing_winner',
    };
  }

  return {
    outcomeClass: 'censored',
    censorReason: 'ambiguous_termination',
  };
};
