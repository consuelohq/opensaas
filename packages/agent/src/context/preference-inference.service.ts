import type { AgentMessage, AgentMemoryFull } from '../types.js';
import type { MemoryStore } from './memory.store.js';

// --- types ---

export type PreferenceSignalType = 'explicit' | 'correction' | 'repetition' | 'acceptance';

export type PreferenceSignal = {
  signalType: PreferenceSignalType;
  key: string;
  value: string;
  confidence: number;
};

export type InferenceInput = {
  messages: AgentMessage[];
  existingMemories: AgentMemoryFull[];
  injectedMemoryIds: string[];
};

// --- helpers ---

const getTextContent = (message: AgentMessage): string | null => {
  if ('content' in message && typeof message.content === 'string') {
    return message.content;
  }

  return null;
};

const normalizeText = (text: string): string =>
  text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

const toKey = (prefix: string, text: string): string => {
  const slug = normalizeText(text).slice(0, 80).replace(/\s/g, '-');

  return `${prefix}:${slug}`;
};

// --- explicit preference detection ---

const EXPLICIT_PATTERNS: RegExp[] = [
  /\bi prefer\b\s+(.{3,80})/i,
  /\balways use\b\s+(.{3,80})/i,
  /\bdon'?t (?:show|use|include|send)\b\s+(.{3,80})/i,
  /\bnever\b\s+(.{3,80})/i,
  /\bfrom now on\b[,]?\s+(.{3,80})/i,
  /\bplease always\b\s+(.{3,80})/i,
];

const detectExplicit = (messages: AgentMessage[]): PreferenceSignal[] => {
  const signals: PreferenceSignal[] = [];

  for (const message of messages) {
    if (message.role !== 'user') continue;
    const text = getTextContent(message);
    if (!text) continue;

    for (const pattern of EXPLICIT_PATTERNS) {
      const match = pattern.exec(text);

      if (match?.[1]) {
        const value = match[1].replace(/[.!?]+$/, '').trim();

        if (value.length >= 3) {
          signals.push({
            signalType: 'explicit',
            key: toKey('explicit', value),
            value: `${match[0].trim()}`,
            confidence: 1.0,
          });
        }
      }
    }
  }

  return signals;
};

// --- correction detection ---

const CORRECTION_MARKERS = [
  /^no[,.]?\s+/i,
  /^actually[,.]?\s+/i,
  /\bi meant\b/i,
  /\bchange (?:that|it) to\b/i,
  /\binstead (?:of|use)\b/i,
  /\bnot (?:that|this)[,.]?\s+/i,
];

const isCorrection = (text: string): boolean =>
  CORRECTION_MARKERS.some((marker) => marker.test(text));

const detectCorrections = (messages: AgentMessage[]): PreferenceSignal[] => {
  const corrections = new Map<string, number>();

  for (let i = 1; i < messages.length; i++) {
    const current = messages[i];

    if (current.role !== 'user') continue;
    if (messages[i - 1].role !== 'assistant') continue;

    const text = getTextContent(current);
    if (!text || !isCorrection(text)) continue;

    const normalized = normalizeText(text);
    const count = (corrections.get(normalized) ?? 0) + 1;

    corrections.set(normalized, count);
  }

  const signals: PreferenceSignal[] = [];

  for (const [normalized, count] of corrections) {
    if (count < 2) continue;
    const reinforcement = (count - 1) * 0.1;

    signals.push({
      signalType: 'correction',
      key: toKey('correction', normalized),
      value: normalized,
      confidence: Math.min(0.6 + reinforcement, 1.0),
    });
  }

  return signals;
};

// --- repetition detection ---

const detectRepetitions = (messages: AgentMessage[]): PreferenceSignal[] => {
  const counts = new Map<string, { count: number; original: string }>();

  for (const message of messages) {
    if (message.role !== 'user') continue;
    const text = getTextContent(message);
    if (!text) continue;

    const normalized = normalizeText(text);
    const existing = counts.get(normalized);

    if (existing) {
      existing.count += 1;
    } else {
      counts.set(normalized, { count: 1, original: text });
    }
  }

  const signals: PreferenceSignal[] = [];

  for (const [, entry] of counts) {
    if (entry.count < 3) continue;
    const reinforcement = (entry.count - 3) * 0.15;

    signals.push({
      signalType: 'repetition',
      key: toKey('repetition', entry.original),
      value: entry.original.trim(),
      confidence: Math.min(0.3 + reinforcement, 1.0),
    });
  }

  return signals;
};

// --- acceptance reinforcement ---

const detectAcceptance = (
  messages: AgentMessage[],
  existingMemories: AgentMemoryFull[],
  injectedMemoryIds: string[],
): PreferenceSignal[] => {
  if (injectedMemoryIds.length === 0) return [];

  // check if the latest user message is a correction
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');

  if (!lastUserMessage) return [];
  const text = getTextContent(lastUserMessage);
  if (!text) return [];
  if (isCorrection(text)) return [];

  const signals: PreferenceSignal[] = [];
  const memoryById = new Map(existingMemories.map((m) => [m.id, m]));

  for (const memoryId of injectedMemoryIds) {
    const memory = memoryById.get(memoryId);
    if (!memory) continue;

    signals.push({
      signalType: 'acceptance',
      key: memory.key,
      value: memory.value,
      confidence: Math.min(memory.confidence + 0.05, 1.0),
    });
  }

  return signals;
};

// --- main inference function ---

export const inferPreferences = (input: InferenceInput): PreferenceSignal[] => {
  const { messages, existingMemories, injectedMemoryIds } = input;

  if (messages.length === 0) return [];

  return [
    ...detectExplicit(messages),
    ...detectCorrections(messages),
    ...detectRepetitions(messages),
    ...detectAcceptance(messages, existingMemories, injectedMemoryIds),
  ];
};

// --- persistence ---

export const persistSignals = async (
  signals: PreferenceSignal[],
  userId: string,
  workspaceId: string,
  upsert: MemoryStore['upsert'],
): Promise<void> => {
  try {
    for (const signal of signals) {
      await upsert(userId, workspaceId, {
        type: 'preference',
        key: signal.key,
        value: signal.value,
        confidence: signal.confidence,
        source: signal.signalType === 'explicit' ? 'explicit' : 'inferred',
      });
    }
  } catch (err: unknown) {
    // fire-and-forget — log but don't throw
    const message = err instanceof Error ? err.message : 'unknown error';
    void message;
  }
};
