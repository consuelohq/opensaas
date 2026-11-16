import { BudgetError, type BenchmarkFetch } from './provider-budget';
import type { ProviderBenchmarkConfig } from './provider-config';
const record = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);
/** Exact decimal conversion from USD/token to nano-USD/million tokens. */
export function rateNanoUsdPerMillion(value: unknown): number {
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value))
    throw new BudgetError('CONFIG');
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > 15) throw new BudgetError('CONFIG');
  const rate =
    BigInt(whole!) * 1_000_000_000_000_000n +
    BigInt(fraction.padEnd(15, '0') || '0');
  if (rate <= 0n || rate > BigInt(Number.MAX_SAFE_INTEGER))
    throw new BudgetError('CONFIG');
  return Number(rate);
}
export async function verifyPublicModelMetadata(
  config: ProviderBenchmarkConfig,
  fetcher: BenchmarkFetch,
  nowMs: number,
) {
  try {
    const url =
      'https://openrouter.ai/api/v1/models/' + config.model + '/endpoints';
    if (
      config.pricingSource !== url ||
      config.pricingAsOf !== new Date(nowMs).toISOString().slice(0, 10) ||
      config.allowedRequestProviderTags.length !== 1 ||
      config.allowedResponseProviderNames.length !== 1 ||
      (config.reasoningMode !== undefined &&
        config.reasoningMode !== 'disabled')
    )
      throw new BudgetError('CONFIG');
    const response = await fetcher(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok || !response.body) throw new BudgetError('CONFIG');
    const reader = response.body.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 128 * 1024) {
        await reader.cancel();
        throw new BudgetError('CONFIG');
      }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let body: unknown;
    try {
      body = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      );
    } catch {
      throw new BudgetError('CONFIG');
    }
    if (
      !record(body) ||
      !record(body.data) ||
      body.data.id !== config.model ||
      !Array.isArray(body.data.endpoints)
    )
      throw new BudgetError('CONFIG');
    const matches = body.data.endpoints.filter(
      (x: unknown) =>
        record(x) &&
        x.tag === config.allowedRequestProviderTags[0] &&
        x.provider_name === config.allowedResponseProviderNames[0] &&
        x.model_id === config.model,
    );
    if (matches.length !== 1 || !record(matches[0]))
      throw new BudgetError('CONFIG');
    const endpoint = matches[0];
    const parameters = endpoint.supported_parameters;
    if (
      endpoint.context_length !== config.contextWindowTokens ||
      !Number.isSafeInteger(endpoint.max_completion_tokens) ||
      Number(endpoint.max_completion_tokens) < 512 ||
      !Array.isArray(parameters) ||
      !['structured_outputs', 'response_format', 'max_tokens'].every((x) =>
        parameters.includes(x),
      ) ||
      (config.reasoningMode === 'disabled' &&
        !parameters.includes('reasoning')) ||
      !record(endpoint.pricing)
    )
      throw new BudgetError('CONFIG');
    const prompt = rateNanoUsdPerMillion(endpoint.pricing.prompt),
      completion = rateNanoUsdPerMillion(endpoint.pricing.completion),
      cache5 = Object.hasOwn(endpoint.pricing, 'input_cache_write')
        ? rateNanoUsdPerMillion(endpoint.pricing.input_cache_write)
        : prompt,
      cache1h = Object.hasOwn(endpoint.pricing, 'input_cache_write_1h')
        ? rateNanoUsdPerMillion(endpoint.pricing.input_cache_write_1h)
        : prompt;
    if (
      prompt !== config.maxPromptNanoUsdPerMillion ||
      completion !== config.maxCompletionNanoUsdPerMillion ||
      Math.max(prompt, cache5, cache1h) !== config.inputNanoUsdPerMillion ||
      completion !== config.outputNanoUsdPerMillion
    )
      throw new BudgetError('CONFIG');
    return {
      contextWindowTokens: config.contextWindowTokens,
      maxOutputTokens: 512,
      promptNanoUsdPerMillion: prompt,
      completionNanoUsdPerMillion: completion,
      conservativeInputNanoUsdPerMillion: Math.max(prompt, cache5, cache1h),
    };
  } catch (error: unknown) {
    throw error;
  }
}
