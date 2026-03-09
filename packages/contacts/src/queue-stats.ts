import type { StorageProvider } from './types.js';

export type QueueStats = {
  queueId: string;
  totalCalls: number;
  answeredCalls: number;
  unansweredCalls: number;
  avgDurationSeconds: number;
  answerRatePercentage: number;
};

export type AggregateStats = {
  totalQueues: number;
  totalCalls: number;
  overallAnswerRate: number;
  overallAvgDuration: number;
  activeAgents: number;
  callsPerHour: number;
};

export type CallRecord = {
  answered: boolean;
  duration?: number;
  agentId?: string;
  timestamp: string;
};

export class QueueStatsService {
  private store: StorageProvider;
  private callRecords = new Map<string, CallRecord[]>();

  constructor(store: StorageProvider) {
    this.store = store;
  }

  async getStats(queueId: string): Promise<QueueStats | null> {
    const queue = await this.store.getQueue(queueId);
    if (!queue) return null;

    const records = this.callRecords.get(queueId) ?? [];
    const totalCalls = records.length;
    const answeredCalls = records.filter((r) => r.answered).length;
    const unansweredCalls = totalCalls - answeredCalls;
    const totalDuration = records.reduce(
      (sum, r) => sum + (r.duration ?? 0),
      0,
    );

    return {
      queueId,
      totalCalls,
      answeredCalls,
      unansweredCalls,
      avgDurationSeconds: totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
      answerRatePercentage:
        totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0,
    };
  }

  async recordCall(
    queueId: string,
    data: { answered: boolean; duration?: number; agentId?: string },
  ): Promise<void> {
    const queue = await this.store.getQueue(queueId);
    if (!queue) return;

    const record: CallRecord = {
      answered: data.answered,
      duration: data.duration,
      agentId: data.agentId,
      timestamp: new Date().toISOString(),
    };

    const existing = this.callRecords.get(queueId) ?? [];
    existing.push(record);
    this.callRecords.set(queueId, existing);
  }

  async getAggregateStats(): Promise<AggregateStats> {
    let totalCalls = 0;
    let answeredCalls = 0;
    let totalDuration = 0;
    const agentSet = new Set<string>();
    let earliestTimestamp: string | null = null;
    let latestTimestamp: string | null = null;

    for (const records of this.callRecords.values()) {
      for (const record of records) {
        totalCalls++;
        if (record.answered) answeredCalls++;
        totalDuration += record.duration ?? 0;
        if (record.agentId) agentSet.add(record.agentId);

        if (!earliestTimestamp || record.timestamp < earliestTimestamp) {
          earliestTimestamp = record.timestamp;
        }
        if (!latestTimestamp || record.timestamp > latestTimestamp) {
          latestTimestamp = record.timestamp;
        }
      }
    }

    let callsPerHour = 0;
    if (earliestTimestamp && latestTimestamp && totalCalls > 0) {
      const elapsedMs =
        new Date(latestTimestamp).getTime() -
        new Date(earliestTimestamp).getTime();
      const hoursElapsed = elapsedMs / 3_600_000;
      callsPerHour =
        hoursElapsed > 0 ? Math.round(totalCalls / hoursElapsed) : totalCalls;
    }

    return {
      totalQueues: this.callRecords.size,
      totalCalls,
      overallAnswerRate:
        totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0,
      overallAvgDuration:
        totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
      activeAgents: agentSet.size,
      callsPerHour,
    };
  }
}
