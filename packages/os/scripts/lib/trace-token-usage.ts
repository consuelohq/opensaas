export type RecordedTraceUsage = {
  input: number | null;
  output: number | null;
  total: number | null;
};
const object = (value: unknown): Record<string, unknown> | null => {
  let parsed = value;
  for (let n = 0; n < 3 && typeof parsed === 'string'; n++) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      break;
    }
  }
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
};
const count = (value: unknown): number | null => {
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    typeof value === 'boolean'
  )
    return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

export function readRecordedTraceUsage(
  row: Record<string, unknown>,
  depth = 0,
): RecordedTraceUsage {
  const flags = object(row.tokenCountsRecorded);
  const usage: RecordedTraceUsage = {
    input:
      flags?.input === false
        ? null
        : count(row.inputTokens ?? row.input_tokens),
    output:
      flags?.output === false
        ? null
        : count(row.outputTokens ?? row.output_tokens),
    total:
      flags?.total === false
        ? null
        : count(row.tokens ?? row.totalTokens ?? row.total_tokens),
  };
  let result = object(row.rawResultJson ?? row.outputObj ?? row.resultObj);
  for (let n = 0; n < 8 && result; n++) {
    if (typeof result.ok !== 'boolean' || typeof result.code !== 'string')
      break;
    usage.input ??= count(result.inputTokens ?? result.input_tokens);
    usage.output ??= count(result.outputTokens ?? result.output_tokens);
    usage.total ??= count(
      result.totalTokens ?? result.total_tokens ?? result.tokens,
    );
    result = object(result.data ?? result.result);
  }
  if (usage.total === null && usage.input !== null && usage.output !== null)
    usage.total = usage.input + usage.output;
  if (depth < 8 && String(row.name ?? row.tool ?? row.traceName) === 'batch') {
    let children: unknown = row.batchResultsJson;
    if (typeof children === 'string') {
      try {
        children = JSON.parse(children);
      } catch {
        children = null;
      }
    }
    const envelope = object(row.rawResultJson ?? row.outputObj);
    const data = object(envelope?.data);
    children ??= data?.results;
    if (Array.isArray(children) && children.length) {
      const values = children
        .map((child) => object(child))
        .map((child) =>
          child
            ? readRecordedTraceUsage(child, depth + 1)
            : { input: null, output: null, total: null },
        );
      for (const field of ['input', 'output', 'total'] as const) {
        if (
          usage[field] === null &&
          values.every((value) => value[field] !== null)
        )
          usage[field] = values.reduce(
            (sum, value) => sum + (value[field] ?? 0),
            0,
          );
      }
    }
  }
  return usage;
}

// The facade's established payload counter is chars/4. Preserve reported counters
// when supplied, and keep this distinct from provider billing usage.
export function measureTracePayloadUsage(
  input: unknown,
  result: unknown,
  provided: Record<string, unknown> = {},
): RecordedTraceUsage {
  const supplied = Object.fromEntries(
    Object.entries(provided).filter(([, value]) => value !== undefined),
  );
  const usage = readRecordedTraceUsage({ ...object(result), ...supplied });
  if (Object.values(usage).some((value) => value !== null)) return usage;
  const measure = (value: unknown): number | null => {
    if (value === null || value === undefined) return 0;
    try {
      const text = typeof value === 'string' ? value : JSON.stringify(value);
      return text ? Math.ceil(text.length / 4) : 0;
    } catch {
      return null;
    }
  };
  const inputCount = measure(input),
    outputCount = measure(result);
  return {
    input: inputCount,
    output: outputCount,
    total:
      inputCount === null || outputCount === null
        ? null
        : inputCount + outputCount,
  };
}
