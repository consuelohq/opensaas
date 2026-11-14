export type BenchmarkFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;
export type BudgetConfig = {
  model: string;
  allowedRequestProviderTags: readonly string[];
  maxRequests: number;
  maxReservedNanoUsd: number;
  contextWindowTokens: number;
  inputNanoUsdPerMillion: number;
  outputNanoUsdPerMillion: number;
  maxPromptNanoUsdPerMillion: number;
  maxCompletionNanoUsdPerMillion: number;
};
export class BudgetError extends Error {
  constructor(
    readonly code:
      'CONFIG' | 'REQUEST' | 'LIMIT' | 'ABORTED' | 'INTEGRITY' | 'COST',
  ) {
    super('Provider benchmark: ' + code);
  }
}
const uint = (n: unknown, max: number): n is number =>
  Number.isSafeInteger(n) && Number(n) >= 0 && Number(n) <= max;
export function reservationPerRequest(config: BudgetConfig): number {
  if (
    !config.model ||
    !Array.isArray(config.allowedRequestProviderTags) ||
    !config.allowedRequestProviderTags.length ||
    !uint(config.maxRequests, 108) ||
    config.maxRequests < 1 ||
    !uint(config.maxReservedNanoUsd, Number.MAX_SAFE_INTEGER) ||
    !uint(config.contextWindowTokens, 2_000_000) ||
    config.contextWindowTokens < 512 ||
    !uint(config.inputNanoUsdPerMillion, Number.MAX_SAFE_INTEGER) ||
    !uint(config.outputNanoUsdPerMillion, Number.MAX_SAFE_INTEGER) ||
    !config.inputNanoUsdPerMillion ||
    !config.outputNanoUsdPerMillion ||
    !uint(config.maxPromptNanoUsdPerMillion, Number.MAX_SAFE_INTEGER) ||
    !config.maxPromptNanoUsdPerMillion ||
    !uint(config.maxCompletionNanoUsdPerMillion, Number.MAX_SAFE_INTEGER) ||
    !config.maxCompletionNanoUsdPerMillion ||
    config.maxPromptNanoUsdPerMillion > config.inputNanoUsdPerMillion ||
    config.maxCompletionNanoUsdPerMillion > config.outputNanoUsdPerMillion
  )
    throw new BudgetError('CONFIG');
  const cost =
    (BigInt(config.contextWindowTokens) *
      BigInt(config.inputNanoUsdPerMillion) +
      512n * BigInt(config.outputNanoUsdPerMillion) +
      999_999n) /
    1_000_000n;
  if (
    cost > BigInt(Number.MAX_SAFE_INTEGER) ||
    cost > BigInt(config.maxReservedNanoUsd)
  )
    throw new BudgetError('CONFIG');
  return Number(cost);
}
export type LedgerEntry = {
  attempts: number;
  reservedNanoUsd: number;
  spentNanoUsd: number;
  settlements: number;
  halted: boolean;
};
export function createBudgetedFetch(
  config: BudgetConfig,
  downstream: BenchmarkFetch,
  integrity: () => boolean,
  persist: (entry: LedgerEntry) => void = () => {},
) {
  const frozen = {
    ...config,
    allowedRequestProviderTags: [...config.allowedRequestProviderTags],
  };
  const reservation = reservationPerRequest(frozen);
  let active = 0,
    attempts = 0,
    reservedNanoUsd = 0,
    spentNanoUsd = 0,
    settlements = 0,
    refused = 0,
    halted = false,
    finalized = false,
    sequence = 0;
  const pending = new Set<string>(),
    responded = new Set<string>(),
    used = new Set<string>();
  type Waiter = { grant: () => void; signal?: AbortSignal; abort?: () => void };
  const queue: Waiter[] = [];
  const snapshot = (): LedgerEntry => ({
    attempts,
    reservedNanoUsd,
    spentNanoUsd,
    settlements,
    halted,
  });
  const acquire = async (signal?: AbortSignal) => {
    try {
      if (signal?.aborted) throw new BudgetError('ABORTED');
      if (active < 4 && queue.length === 0) {
        active++;
        return;
      }
      await new Promise<void>((resolve, reject) => {
        const item: Waiter = {
          grant: () => {
            item.signal?.removeEventListener('abort', item.abort!);
            active++;
            resolve();
          },
          signal,
        };
        item.abort = () => {
          const index = queue.indexOf(item);
          if (index >= 0) queue.splice(index, 1);
          reject(new BudgetError('ABORTED'));
        };
        queue.push(item);
        signal?.addEventListener('abort', item.abort, { once: true });
        if (signal?.aborted) item.abort();
      });
    } catch (error: unknown) {
      throw error;
    }
  };
  const release = () => {
    active--;
    queue.shift()?.grant();
  };
  const fetchFor =
    (ticket: string): BenchmarkFetch =>
    async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      let body: unknown;
      try {
        body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      } catch {
        throw new BudgetError('REQUEST');
      }
      const data = body as {
        model?: unknown;
        max_tokens?: unknown;
        provider?: {
          only?: unknown;
          require_parameters?: unknown;
          allow_fallbacks?: unknown;
          data_collection?: unknown;
          max_price?: { prompt?: unknown; completion?: unknown };
        };
      };
      const containsCacheField = (value: unknown): boolean => {
        if (!value || typeof value !== 'object') return false;
        return Object.entries(value).some(
          ([key, child]) =>
            [
              'cache_control',
              'prompt_cache_breakpoint',
              'prompt_cache_options',
            ].includes(key) || containsCacheField(child),
        );
      };
      if (
        containsCacheField(data) ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(ticket) ||
        url !== 'https://openrouter.ai/api/v1/chat/completions' ||
        init?.method !== 'POST' ||
        !data ||
        data.model !== frozen.model ||
        data.max_tokens !== 512 ||
        data.provider?.require_parameters !== true ||
        data.provider?.allow_fallbacks !== false ||
        data.provider?.data_collection !== 'deny' ||
        JSON.stringify(data.provider?.only) !==
          JSON.stringify(frozen.allowedRequestProviderTags) ||
        data.provider?.max_price?.prompt !==
          frozen.maxPromptNanoUsdPerMillion / 1_000_000_000 ||
        data.provider?.max_price?.completion !==
          frozen.maxCompletionNanoUsdPerMillion / 1_000_000_000
      )
        throw new BudgetError('REQUEST');
      const signal = init?.signal ?? undefined;
      await acquire(signal);
      try {
        if (signal?.aborted) throw new BudgetError('ABORTED');
        if (!integrity()) throw new BudgetError('INTEGRITY');
        if (used.has(ticket)) throw new BudgetError('REQUEST');
        if (
          halted ||
          finalized ||
          attempts >= frozen.maxRequests ||
          reservation >
            frozen.maxReservedNanoUsd - spentNanoUsd - reservedNanoUsd
        ) {
          refused++;
          throw new BudgetError('LIMIT');
        }
        // Durable full reservation is recorded before a request can leave.
        persist({
          ...snapshot(),
          attempts: attempts + 1,
          reservedNanoUsd: reservedNanoUsd + reservation,
        });
        attempts++;
        reservedNanoUsd += reservation;
        pending.add(ticket);
        used.add(ticket);
        const response = await downstream(input, init);
        responded.add(ticket);
        return response;
      } finally {
        release();
      }
    };
  const settle = (ticket: string, costUsd: unknown): void => {
    if (
      finalized ||
      !pending.has(ticket) ||
      !responded.has(ticket) ||
      typeof costUsd !== 'number' ||
      !Number.isFinite(costUsd) ||
      costUsd < 0
    )
      return;
    // One nano-dollar margin covers binary floating-point conversion; zero is exact.
    const charge = costUsd === 0 ? 0 : Math.ceil(costUsd * 1_000_000_000) + 1;
    if (!Number.isSafeInteger(charge) || charge > reservation) {
      halted = true;
      try {
        persist(snapshot());
      } catch {}
      return;
    }
    try {
      persist({
        ...snapshot(),
        reservedNanoUsd: reservedNanoUsd - reservation,
        spentNanoUsd: spentNanoUsd + charge,
        settlements: settlements + 1,
      });
    } catch {
      halted = true;
      return;
    }
    pending.delete(ticket);
    reservedNanoUsd -= reservation;
    spentNanoUsd += charge;
    settlements++;
  };
  const wrapped: BenchmarkFetch = (input, init) =>
    fetchFor('auto-' + ++sequence)(input, init);
  return {
    fetch: wrapped,
    fetchFor,
    settle,
    finalize: () => {
      finalized = true;
    },
    counters: () => ({
      ...snapshot(),
      refused,
      unreconciledCharges: pending.size,
      active,
      queued: queue.length,
    }),
    reservationPerRequestNanoUsd: reservation,
  };
}
