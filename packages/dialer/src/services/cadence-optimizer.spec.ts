import type { HazardEstimate } from '../types';

import { CadenceOptimizerService } from './cadence-optimizer.service';

describe('CadenceOptimizerService', () => {
  const service = new CadenceOptimizerService();

  const baseEconomics = {
    valuePerConnection: 100,
    costPerAttempt: 10,
  };

  const buildHazards = (segmentId: string, sampleSize: number): HazardEstimate[] => [
    {
      segmentId,
      attemptNumber: 1,
      hourOfDay: 9,
      dayOfWeek: 1,
      answerRate: 0.3,
      sampleSize,
    },
    {
      segmentId,
      attemptNumber: 2,
      hourOfDay: 13,
      dayOfWeek: 1,
      answerRate: 0.22,
      sampleSize,
    },
    {
      segmentId,
      attemptNumber: 3,
      hourOfDay: 17,
      dayOfWeek: 1,
      answerRate: 0.08,
      sampleSize,
    },
  ];

  it('fresh contacts get conservative cadence', () => {
    const policy = service.computeCadencePolicy({
      segmentId: 'insurance:fresh',
      ageBucket: 'fresh',
      hazardEstimates: buildHazards('insurance:fresh', 60),
      economics: baseEconomics,
    });

    expect(policy.maxAttemptsPerDay).toBeLessThanOrEqual(2);
    expect(policy.minSpacingMinutes).toBeGreaterThanOrEqual(120);
  });

  it('aged contacts get aggressive cadence', () => {
    const policy = service.computeCadencePolicy({
      segmentId: 'insurance:aged',
      ageBucket: 'aged',
      hazardEstimates: buildHazards('insurance:aged', 70),
      economics: baseEconomics,
    });

    expect(policy.maxAttemptsPerDay).toBeGreaterThanOrEqual(2);
    expect(policy.maxAttemptsPerDay).toBeLessThanOrEqual(4);
    expect(policy.minSpacingMinutes).toBeLessThanOrEqual(240);
  });

  it('sparse segments fall back to age bucket defaults', () => {
    const freshPolicy = service.computeCadencePolicy({
      segmentId: 'auto:fresh',
      ageBucket: 'fresh',
      hazardEstimates: buildHazards('auto:fresh', 5),
      economics: baseEconomics,
    });

    expect(freshPolicy.source).toBe('static_fallback');
    expect(freshPolicy.maxAttemptsPerDay).toBe(2);
    expect(freshPolicy.minSpacingMinutes).toBe(240);
  });

  it('double-dial triggers on voicemail with short duration', () => {
    const policy = service.computeCadencePolicy({
      segmentId: 'home:aged',
      ageBucket: 'aged',
      hazardEstimates: buildHazards('home:aged', 60),
      economics: baseEconomics,
    });

    expect(
      service.shouldDoubleDial({
        outcome: 'voicemail',
        callDurationSeconds: 8,
        minutesSinceLastAttempt: 31,
        doubleDialsThisSession: 0,
        policy,
      }),
    ).toBe(true);
  });

  it('double-dial blocked if already done this session', () => {
    const policy = service.computeCadencePolicy({
      segmentId: 'home:aged',
      ageBucket: 'aged',
      hazardEstimates: buildHazards('home:aged', 60),
      economics: baseEconomics,
    });

    expect(
      service.shouldDoubleDial({
        outcome: 'no-answer',
        callDurationSeconds: 6,
        minutesSinceLastAttempt: 31,
        doubleDialsThisSession: 1,
        policy,
      }),
    ).toBe(false);
  });

  it('double-dial blocked if last attempt was recent', () => {
    const policy = service.computeCadencePolicy({
      segmentId: 'home:aged',
      ageBucket: 'aged',
      hazardEstimates: buildHazards('home:aged', 60),
      economics: baseEconomics,
    });

    expect(
      service.shouldDoubleDial({
        outcome: 'no-answer',
        callDurationSeconds: 6,
        minutesSinceLastAttempt: 12,
        doubleDialsThisSession: 0,
        policy,
      }),
    ).toBe(false);
  });

  it('classifyAgeBucket uses 48h threshold', () => {
    const now = new Date('2026-04-12T12:00:00.000Z');

    expect(
      service.classifyAgeBucket(new Date('2026-04-10T13:00:00.000Z'), now),
    ).toBe('fresh');
    expect(
      service.classifyAgeBucket(new Date('2026-04-10T12:00:00.000Z'), now),
    ).toBe('aged');
  });

  it('learned cadence respects economics threshold', () => {
    const policy = service.computeCadencePolicy({
      segmentId: 'threshold:fresh',
      ageBucket: 'fresh',
      hazardEstimates: [
        {
          segmentId: 'threshold:fresh',
          attemptNumber: 1,
          hourOfDay: 9,
          dayOfWeek: 1,
          answerRate: 0.4,
          sampleSize: 80,
        },
        {
          segmentId: 'threshold:fresh',
          attemptNumber: 2,
          hourOfDay: 12,
          dayOfWeek: 1,
          answerRate: 0.15,
          sampleSize: 80,
        },
      ],
      economics: {
        valuePerConnection: 100,
        costPerAttempt: 20,
      },
    });

    expect(policy.maxAttemptsPerDay).toBe(1);
  });
});
