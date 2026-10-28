export type TraceCostEstimate = {
  cost: number;
  costLabel: string;
  model: string;
  rateModel: string;
  pricingSource: 'trace_model' | 'trace_model_fallback' | 'sol_fallback';
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
};

type PricingRate = {
  inputPerMillion: number;
  cachedInputPerMillion: number;
  outputPerMillion: number;
};

// ChatGPT Web does not expose a billable per-request model price. Until it does,
// use the current trace-pricing baseline as a Sol-equivalent estimate rather than
// presenting zero. This is an observability estimate, not an OpenAI invoice rate.
export const SOL_EQUIVALENT_MODEL = 'gpt-5.6-sol';
export const SOL_EQUIVALENT_RATE: PricingRate = {
  inputPerMillion: 5,
  cachedInputPerMillion: 0.5,
  outputPerMillion: 30,
};

const KNOWN_MODEL_RATES: Record<string, PricingRate> = {
  'gpt-5.5': SOL_EQUIVALENT_RATE,
};

const MODEL_ALIASES: Record<string, string> = {
  'codex-5.5': 'gpt-5.5',
  'gpt-5.5-codex': 'gpt-5.5',
};

type EstimateInput = {
  tool: string;
  model?: string;
  provider?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens?: number;
  rawInputJson?: string;
  rawResolvedInputJson?: string;
  rawResultJson?: string;
};

export function estimateTraceCost(input: EstimateInput): TraceCostEstimate | null {
  const inputPayload = String(input.rawResolvedInputJson ?? input.rawInputJson ?? '').trim();
  const outputPayload = String(input.rawResultJson ?? '').trim();
  const payloads = [inputPayload, outputPayload].filter(Boolean);
  const recordedInput = positiveNumber(input.inputTokens);
  const recordedOutput = positiveNumber(input.outputTokens);
  const recordedTotal = positiveNumber(input.totalTokens);
  const inputWeight = estimateTokens(inputPayload);
  const outputWeight = estimateTokens(outputPayload);
  const { inputTokens, outputTokens } = allocateTokens({
    recordedInput,
    recordedOutput,
    recordedTotal,
    inputWeight,
    outputWeight,
  });
  if (inputTokens + outputTokens <= 0) return null;

  const payloadText = payloads.join('\n');
  const detectedModel =
    String(input.model ?? '').trim() ||
    findFirstStringField(payloads, ['model', 'modelname', 'modelid']) ||
    findModelInText(payloadText);
  const provider =
    String(input.provider ?? '').trim() ||
    findFirstStringField(payloads, ['provider', 'providername']) ||
    findProviderInText(payloadText) ||
    providerFromTool(input.tool);
  const resolvedKnownModel = detectedModel ? resolveKnownModel(detectedModel) : null;
  const model = detectedModel || SOL_EQUIVALENT_MODEL;
  const rateModel = resolvedKnownModel || SOL_EQUIVALENT_MODEL;
  const rate = resolvedKnownModel ? KNOWN_MODEL_RATES[resolvedKnownModel] : SOL_EQUIVALENT_RATE;
  const cachedInputTokens = Math.min(
    inputTokens,
    findLargestNumericField(payloads, (key) => key.includes('cached') && key.includes('token')),
  );
  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const cost =
    (uncachedInputTokens / 1_000_000) * rate.inputPerMillion +
    (cachedInputTokens / 1_000_000) * rate.cachedInputPerMillion +
    (outputTokens / 1_000_000) * rate.outputPerMillion;

  return {
    cost,
    costLabel: formatEstimatedCost(cost),
    model,
    rateModel,
    pricingSource: detectedModel
      ? resolvedKnownModel
        ? 'trace_model'
        : 'trace_model_fallback'
      : 'sol_fallback',
    provider,
    inputTokens,
    outputTokens,
    cachedInputTokens,
  };
}

export function formatEstimatedCost(cost: number): string {
  if (!Number.isFinite(cost) || cost <= 0) return '—';
  if (cost < 0.0001) return '<$0.0001';
  return `$${cost.toFixed(4)}`;
}

function positiveNumber(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function estimateTokens(value: string): number {
  return value ? Math.max(1, Math.round(value.length / 4)) : 0;
}

function allocateTokens(input: {
  recordedInput: number;
  recordedOutput: number;
  recordedTotal: number;
  inputWeight: number;
  outputWeight: number;
}): { inputTokens: number; outputTokens: number } {
  if (input.recordedInput > 0 && input.recordedOutput > 0) {
    return { inputTokens: input.recordedInput, outputTokens: input.recordedOutput };
  }
  if (input.recordedTotal > 0 && input.recordedInput > 0) {
    return {
      inputTokens: input.recordedInput,
      outputTokens: Math.max(0, input.recordedTotal - input.recordedInput),
    };
  }
  if (input.recordedTotal > 0 && input.recordedOutput > 0) {
    return {
      inputTokens: Math.max(0, input.recordedTotal - input.recordedOutput),
      outputTokens: input.recordedOutput,
    };
  }
  if (input.recordedTotal > 0) {
    const weightTotal = input.inputWeight + input.outputWeight;
    const inputTokens = weightTotal > 0
      ? Math.round(input.recordedTotal * (input.inputWeight / weightTotal))
      : input.recordedTotal;
    return {
      inputTokens,
      outputTokens: Math.max(0, input.recordedTotal - inputTokens),
    };
  }
  return {
    inputTokens: input.recordedInput || input.inputWeight,
    outputTokens: input.recordedOutput || input.outputWeight,
  };
}

function resolveKnownModel(model: string): string | null {
  const normalized = model.trim().toLowerCase();
  const resolved = MODEL_ALIASES[normalized] || normalized;
  return KNOWN_MODEL_RATES[resolved] ? resolved : null;
}

function providerFromTool(tool: string): string {
  const normalized = tool.toLowerCase();
  if (normalized.includes('codex')) return 'codex';
  if (normalized.includes('claude')) return 'claude';
  if (normalized.includes('opencode')) return 'opencode';
  return 'chatgpt';
}

function findModelInText(value: string): string {
  const named = value.match(/\bmodel\s*[:=]\s*["']?([a-z0-9][a-z0-9._/-]{2,})/i)?.[1];
  if (named) return named;
  return value.match(/\b((?:gpt|codex|claude|gemini|o[1-9])[a-z0-9._/-]*)\b/i)?.[1] ?? '';
}

function findProviderInText(value: string): string {
  return value.match(/\bprovider\s*[:=]\s*["']?([a-z0-9][a-z0-9._/-]{1,})/i)?.[1] ?? '';
}

function findFirstStringField(payloads: string[], keys: string[]): string {
  const wanted = new Set(keys);
  for (const raw of payloads) {
    const parsed = parseJson(raw);
    if (parsed === null) continue;
    const found = findStringField(parsed, wanted);
    if (found) return found;
  }
  return '';
}

function findStringField(value: unknown, wanted: Set<string>): string {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findStringField(child, wanted);
      if (found) return found;
    }
    return '';
  }
  if (!value || typeof value !== 'object') return '';
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (wanted.has(normalized) && typeof child === 'string' && child.trim()) return child.trim();
    const found = findStringField(child, wanted);
    if (found) return found;
  }
  return '';
}

function findLargestNumericField(
  payloads: string[],
  matches: (normalizedKey: string) => boolean,
): number {
  let largest = 0;
  for (const raw of payloads) {
    const parsed = parseJson(raw);
    if (parsed !== null) largest = Math.max(largest, largestNumericField(parsed, matches));
  }
  return largest;
}

function largestNumericField(
  value: unknown,
  matches: (normalizedKey: string) => boolean,
): number {
  if (Array.isArray(value)) {
    return value.reduce((largest, child) => Math.max(largest, largestNumericField(child, matches)), 0);
  }
  if (!value || typeof value !== 'object') return 0;
  let largest = 0;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (matches(normalized)) largest = Math.max(largest, positiveNumber(child));
    largest = Math.max(largest, largestNumericField(child, matches));
  }
  return largest;
}

function parseJson(value: string): unknown | null {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
