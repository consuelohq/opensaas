export const TRACE_HEATMAP_DAYS = 7;
export const TRACE_HEATMAP_HOURS = 24;

export type TraceHeatmapInputRow = {
  startedAt: string;
  tokens?: number;
  cost?: number;
};

export type TraceHeatmapBucket = {
  calls: number;
  tokens: number;
  cost: number;
  level: 0 | 1 | 2 | 3 | 4 | 5;
};

export type TraceHeatmapDay = {
  key: string;
  label: string;
  dateLabel: string;
  buckets: TraceHeatmapBucket[];
};

export type TraceHeatmapAggregate = {
  days: TraceHeatmapDay[];
  totals: {
    calls: number;
    tokens: number;
    cost: number;
  };
  maxCalls: number;
};

const dayKey = (date: Date) =>
  [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');

const dayLabel = (date: Date) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' })
    .format(date)
    .toUpperCase();

const dateLabel = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);

export function traceHeatLevel(calls: number, maxCalls: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!calls || !maxCalls) return 0;
  const ratio = calls / maxCalls;
  if (ratio >= 0.8) return 5;
  if (ratio >= 0.55) return 4;
  if (ratio >= 0.32) return 3;
  if (ratio >= 0.14) return 2;
  return 1;
}

export function aggregateTraceHeatmap(
  rows: TraceHeatmapInputRow[],
  anchor = new Date(),
): TraceHeatmapAggregate {
  const days = Array.from({ length: TRACE_HEATMAP_DAYS }, (_, index) => {
    const offset = TRACE_HEATMAP_DAYS - 1 - index;
    const date = new Date(Date.UTC(
      anchor.getUTCFullYear(),
      anchor.getUTCMonth(),
      anchor.getUTCDate() - offset,
    ));
    return {
      key: dayKey(date),
      label: dayLabel(date),
      dateLabel: dateLabel(date),
    };
  });

  const allowedDays = new Set(days.map((day) => day.key));
  const buckets = new Map<string, Omit<TraceHeatmapBucket, 'level'>>();

  for (const day of days) {
    for (let hour = 0; hour < TRACE_HEATMAP_HOURS; hour += 1) {
      buckets.set(`${day.key}:${hour}`, { calls: 0, tokens: 0, cost: 0 });
    }
  }

  const totals = { calls: 0, tokens: 0, cost: 0 };

  for (const row of rows) {
    const date = new Date(row.startedAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = dayKey(date);
    if (!allowedDays.has(key)) continue;
    const bucket = buckets.get(`${key}:${date.getUTCHours()}`);
    if (!bucket) continue;

    const tokens = Number(row.tokens || 0);
    const cost = Number(row.cost || 0);
    bucket.calls += 1;
    bucket.tokens += tokens;
    bucket.cost += cost;
    totals.calls += 1;
    totals.tokens += tokens;
    totals.cost += cost;
  }

  const maxCalls = Math.max(0, ...Array.from(buckets.values(), (bucket) => bucket.calls));

  return {
    days: days.map((day) => ({
      ...day,
      buckets: Array.from({ length: TRACE_HEATMAP_HOURS }, (_, hour) => {
        const bucket = buckets.get(`${day.key}:${hour}`) ?? { calls: 0, tokens: 0, cost: 0 };
        return {
          ...bucket,
          level: traceHeatLevel(bucket.calls, maxCalls),
        };
      }),
    })),
    totals,
    maxCalls,
  };
}
