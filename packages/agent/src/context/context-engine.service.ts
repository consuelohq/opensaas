import type { ContextLayer, ContextBudget } from './types.js';

// rough token estimate: ~4 chars per token
export const estimateTokens = (text: string): number =>
  Math.ceil(text.length / 4);

export const shouldSummarize = (
  messageCount: number,
  threshold = 20,
): boolean => messageCount > threshold;

// sort by priority (lower = higher priority), trim to fit budget
export const buildContextLayers = (
  layers: ContextLayer[],
  budget: ContextBudget,
): ContextLayer[] => {
  const sorted = [...layers].sort((a, b) => a.priority - b.priority);
  const result: ContextLayer[] = [];
  let remaining = budget.maxTokens;

  for (const layer of sorted) {
    if (remaining <= 0) break;

    if (layer.tokenEstimate <= remaining) {
      result.push(layer);
      remaining -= layer.tokenEstimate;
    } else {
      // trim content to fit remaining budget
      const charLimit = remaining * 4;
      const trimmed = layer.content.slice(0, charLimit);

      result.push({
        ...layer,
        content: trimmed,
        tokenEstimate: estimateTokens(trimmed),
      });
      remaining = 0;
    }
  }

  return result;
};

// render layers into XML-tagged system prompt block
export const renderContextBlock = (layers: ContextLayer[]): string =>
  layers
    .map(
      (layer) =>
        `<${layer.name}>\n${layer.content}\n</${layer.name}>`,
    )
    .join('\n\n');

// build a prompt string for LLM summarization (caller makes the actual LLM call)
export const summarizeMessages = (
  messages: Array<{ role: string; content: string }>,
  existingSummary?: string,
): string => {
  const conversationText = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const base = existingSummary
    ? `Previous summary:\n${existingSummary}\n\nNew messages:\n${conversationText}`
    : `Messages:\n${conversationText}`;

  return `Summarize the following conversation concisely, preserving key facts, decisions, and user preferences. Output only the summary.\n\n${base}`;
};
