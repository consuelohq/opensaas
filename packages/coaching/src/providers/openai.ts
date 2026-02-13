import type { CoachingProvider } from './base.js';
import type { SalesCoaching, CallAnalytics } from '../schemas/coaching.js';
import type { CoachingConfig } from '../types.js';
import type OpenAI from 'openai';

/**
 * OpenAI-backed coaching provider.
 * Requires `openai` as a peer dependency.
 */
export class OpenAIProvider implements CoachingProvider {
  private config: CoachingConfig;
  private client: OpenAI | null = null;

  constructor(config: CoachingConfig = {}) {
    this.config = {
      model: 'gpt-4o-mini',
      temperature: 0.4,
      maxTokens: 1000,
      ...config,
      apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
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
      return JSON.parse(res.choices[0].message.content ?? '{}') as SalesCoaching;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'coaching failed';
      throw new Error(`OpenAI coaching error: ${msg}`, { cause: err });
    }
  }

  async analyze(transcript: string, meta: { callSid: string; userId: string; phoneNumber: string }): Promise<CallAnalytics> {
    try {
      const client = await this.getClient();
      const prompt = `Analyze this sales call transcript. Return JSON with: key_moments, sentiment_analysis, performance_metrics, overall_score, strengths, improvement_areas, action_items.\n\nTRANSCRIPT:\n${transcript}`;
      const res = await client.chat.completions.create({
        model: this.config.model!,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      });
      const data = JSON.parse(res.choices[0].message.content ?? '{}');
      delete data.__proto__; delete data.constructor; delete data.prototype;
      return { ...data, call_sid: meta.callSid, user_id: meta.userId, phone_number: meta.phoneNumber, generated_at: new Date().toISOString() };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'analysis failed';
      throw new Error(`OpenAI analysis error: ${msg}`, { cause: err });
    }
  }
}
