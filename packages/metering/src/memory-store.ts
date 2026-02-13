import type { ApiKey, Balance, MeteringStore, UsageQuery, UsageRecord } from './index.js';

/** In-memory implementation of MeteringStore for dev/testing */
export class MemoryMeteringStore implements MeteringStore {
  private apiKeys = new Map<string, ApiKey>();
  private usageRecords: UsageRecord[] = [];
  private balances = new Map<string, Balance>();

  async saveApiKey(key: ApiKey): Promise<void> {
    this.apiKeys.set(key.hash, key);
  }

  async getApiKeyByHash(hash: string): Promise<ApiKey | null> {
    return this.apiKeys.get(hash) ?? null;
  }

  async listApiKeys(userId: string): Promise<ApiKey[]> {
    return [...this.apiKeys.values()].filter(k => k.userId === userId);
  }

  async revokeApiKey(id: string): Promise<void> {
    for (const key of this.apiKeys.values()) {
      if (key.id === id) {
        key.revokedAt = new Date().toISOString();
        break;
      }
    }
  }

  async recordUsage(record: UsageRecord): Promise<void> {
    this.usageRecords.push(record);
  }

  async getUsage(query: UsageQuery): Promise<UsageRecord[]> {
    return this.usageRecords.filter(r => {
      if (r.userId !== query.userId) return false;
      if (query.type && r.type !== query.type) return false;
      if (query.startDate && r.timestamp < query.startDate) return false;
      if (query.endDate && r.timestamp > query.endDate) return false;
      return true;
    });
  }

  async getBalance(userId: string): Promise<Balance | null> {
    return this.balances.get(userId) ?? null;
  }

  async updateBalance(userId: string, balanceCents: number): Promise<void> {
    const existing = this.balances.get(userId);
    if (existing) {
      existing.balanceCents = balanceCents;
    } else {
      this.balances.set(userId, {
        userId,
        balanceCents,
        spendLimitCents: 100000,
        autoTopUp: false,
        topUpAmountCents: 5000,
        topUpThresholdCents: 1000,
      });
    }
  }
}
