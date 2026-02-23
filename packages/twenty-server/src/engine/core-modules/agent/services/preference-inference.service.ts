import { Injectable, Logger } from '@nestjs/common';

import { AgentMemoryEntity } from 'src/engine/core-modules/agent/entities/agent-memory.entity';
import { AgentMemoryService } from 'src/engine/core-modules/agent/services/memory.service';

// message shape compatible with AI SDK CoreMessage
type ChatMessage = {
  role: string;
  content: unknown;
};

type PreferenceSignal = {
  signalType: 'explicit' | 'correction' | 'repetition' | 'acceptance';
  key: string;
  value: string;
  confidence: number;
};

// --- helpers ---

const getTextContent = (message: ChatMessage): string | null => {
  if (typeof message.content === 'string') return message.content;

  return null;
};

const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const toKey = (prefix: string, text: string): string => {
  const slug = normalizeText(text).slice(0, 80).replace(/\s/g, '-');

  return `${prefix}:${slug}`;
};

// --- detection patterns ---

const EXPLICIT_PATTERNS: RegExp[] = [
  /\bi prefer\b\s+(.{3,80})/i,
  /\balways use\b\s+(.{3,80})/i,
  /\bdon'?t (?:show|use|include|send)\b\s+(.{3,80})/i,
  /\bnever\b\s+(.{3,80})/i,
  /\bfrom now on\b[,]?\s+(.{3,80})/i,
  /\bplease always\b\s+(.{3,80})/i,
];

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

@Injectable()
export class PreferenceInferenceService {
  private readonly logger = new Logger(PreferenceInferenceService.name);

  constructor(private readonly memoryService: AgentMemoryService) {}

  async runPostTurnInference(
    userId: string,
    workspaceId: string,
    messages: ChatMessage[],
    injectedMemoryIds: string[],
  ): Promise<void> {
    try {
      if (messages.length === 0) return;

      const existingMemories = await this.memoryService.getTopMemories(
        userId,
        50,
        0,
      );

      const signals = [
        ...this.detectExplicit(messages),
        ...this.detectCorrections(messages),
        ...this.detectRepetitions(messages),
        ...this.detectAcceptance(messages, existingMemories, injectedMemoryIds),
      ];

      if (signals.length === 0) return;

      for (const signal of signals) {
        await this.memoryService.upsert(userId, workspaceId, {
          type: 'preference',
          key: signal.key,
          value: signal.value,
          confidence: signal.confidence,
          source: signal.signalType === 'explicit' ? 'explicit' : 'inferred',
        } as Pick<
          AgentMemoryEntity,
          'type' | 'key' | 'value' | 'confidence' | 'source'
        >);
      }

      this.logger.log(
        `inferred ${signals.length} preference signal(s) for user ${userId}`,
      );
    } catch (err: unknown) {
      // fire-and-forget — log but don't throw
      const message = err instanceof Error ? err.message : 'unknown error';

      this.logger.error(
        `preference inference failed for user ${userId}: ${message}`,
      );
    }
  }

  private detectExplicit(messages: ChatMessage[]): PreferenceSignal[] {
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
  }

  private detectCorrections(messages: ChatMessage[]): PreferenceSignal[] {
    const corrections = new Map<string, number>();

    for (let i = 1; i < messages.length; i++) {
      const current = messages[i];

      if (current.role !== 'user') continue;
      if (messages[i - 1].role !== 'assistant') continue;

      const text = getTextContent(current);

      if (!text || !isCorrection(text)) continue;

      const normalized = normalizeText(text);

      corrections.set(normalized, (corrections.get(normalized) ?? 0) + 1);
    }

    const signals: PreferenceSignal[] = [];

    for (const [normalized, count] of corrections) {
      if (count < 2) continue;

      signals.push({
        signalType: 'correction',
        key: toKey('correction', normalized),
        value: normalized,
        confidence: Math.min(0.6 + (count - 1) * 0.1, 1.0),
      });
    }

    return signals;
  }

  private detectRepetitions(messages: ChatMessage[]): PreferenceSignal[] {
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

      signals.push({
        signalType: 'repetition',
        key: toKey('repetition', entry.original),
        value: entry.original.trim(),
        confidence: Math.min(0.3 + (entry.count - 3) * 0.15, 1.0),
      });
    }

    return signals;
  }

  private detectAcceptance(
    messages: ChatMessage[],
    existingMemories: AgentMemoryEntity[],
    injectedMemoryIds: string[],
  ): PreferenceSignal[] {
    if (injectedMemoryIds.length === 0) return [];

    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'user');

    if (!lastUserMessage) return [];

    const text = getTextContent(lastUserMessage);

    if (!text || isCorrection(text)) return [];

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
  }
}
