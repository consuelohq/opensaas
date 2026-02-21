import type { CoachingProvider } from './base.js';
import type { SalesCoaching, CallAnalytics } from '../schemas/coaching.js';
import type { CoachingConfig } from '../types.js';
import type OpenAI from 'openai';

/**
 * Groq-backed coaching provider.
 *
 * Uses the OpenAI-compatible API at api.groq.com.
 * Requires `openai` as a peer dependency.
 */
export class GroqProvider implements CoachingProvider {
  private config: CoachingConfig;
  private client: OpenAI | null = null;

  constructor(config: CoachingConfig = {}) {
    this.config = {
      model: 'llama-3.3-70b-versatile',
      temperature: 0.4,
      maxTokens: 1000,
      ...config,
      baseUrl: config.baseUrl ?? 'https://api.groq.com/openai/v1',
      apiKey: config.apiKey ?? process.env.GROQ_API_KEY,
    };
  }

  private async getClient() {
    try {
      if (!this.client) {
        const { default: OpenAI } = await import('openai');
        this.client = new OpenAI({ apiKey: this.config.apiKey, baseURL: this.config.baseUrl });
      }
      return this.client;
    } catch (err: unknown) {
      this.client = null;
      throw err;
    }
  }

  private safeParseJSON<T>(raw: string | null, label: string): T {
    if (!raw || raw.trim() === '') {
      throw new Error(`${label}: model returned empty response`);
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new Error(`${label}: model returned invalid JSON`);
    }
  }

  async coach(prompt: string): Promise<SalesCoaching> {
    try {
      const client = await this.getClient();
      const res = await client.chat.completions.create({
        model: this.config.model!,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        response_format: { type: 'json_object' },
      });
      return this.safeParseJSON<SalesCoaching>(res.choices[0].message.content, 'coaching');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'coaching failed';
      throw new Error(`Groq coaching error: ${msg}`, { cause: err });
    }
  }

  async analyze(transcript: string, meta: { callSid: string; userId: string; phoneNumber: string }): Promise<CallAnalytics> {
    try {
      const client = await this.getClient();
      const prompt = buildAnalyticsPrompt(transcript);
      const res = await client.chat.completions.create({
        model: this.config.model!,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      });
      const data = this.safeParseJSON<Record<string, unknown>>(res.choices[0].message.content, 'analysis');
      return { ...data, call_sid: meta.callSid, user_id: meta.userId, phone_number: meta.phoneNumber, generated_at: new Date().toISOString() } as CallAnalytics;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'analysis failed';
      throw new Error(`Groq analysis error: ${msg}`, { cause: err });
    }
  }
}

function buildAnalyticsPrompt(transcript: string): string {
  return `Analyze this sales call transcript and provide detailed analytics.

CALL TRANSCRIPT:
${transcript}

Return a JSON object with: key_moments (array of {timestamp, type, description, transcript_snippet}), sentiment_analysis ({customer_sentiment, engagement_level, objections_raised, buying_signals}), performance_metrics ({talk_ratio, questions_asked, objections_handled, next_steps_established, call_duration_minutes}), overall_score (0-100), strengths (array), improvement_areas (array), action_items (array).

Be specific and constructive. talk_ratio is a decimal 0-1 representing agent talk time.`;
}
