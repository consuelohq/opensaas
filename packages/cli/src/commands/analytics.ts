import * as fs from 'node:fs';
import { Analytics } from '@consuelo/analytics';
import { loadConfig } from '../config.js';
import { log, error, json, isJson } from '../output.js';
import { captureError } from '../sentry.js';
import { parseTranscript } from '../utils/transcript.js';

export async function analyticsCommand(callSid: string, opts: { transcript?: string } = {}): Promise<void> {
  try {
    if (!opts.transcript) {
      error('provide a transcript: consuelo analytics --transcript <file> [callSid]');
      process.exit(1);
    }

    if (!fs.existsSync(opts.transcript)) {
      error(`file not found: ${opts.transcript}`);
      process.exit(1);
    }

    const config = loadConfig();
    if (!config.llmApiKey) {
      error('not configured — run `consuelo init` to set your LLM API key');
      process.exit(1);
    }

    const content = fs.readFileSync(opts.transcript, 'utf-8');
    const messages = parseTranscript(content);
    if (!messages.length) {
      error('no conversation found — expected lines like "Agent: ..." and "Customer: ..."');
      process.exit(1);
    }

    log(`analyzing ${messages.length} messages...`);

    const analytics = new Analytics({
      provider: config.llmProvider ?? 'groq',
      apiKey: config.llmApiKey,
    });
    const result = await analytics.analyzeCall(messages, {
      callSid: callSid || undefined,
      userId: 'cli',
    });

    if (isJson()) {
      json(result);
      return;
    }

    log('');
    log(`score: ${result.overall_score}/100`);
    if (callSid) log(`call: ${callSid}`);
    log('');

    if (result.performance_metrics) {
      const m = result.performance_metrics;
      log(`talk ratio: ${Math.round(m.talk_ratio * 100)}% | questions: ${m.questions_asked} | objections handled: ${m.objections_handled} | next steps: ${m.next_steps_established ? 'yes' : 'no'}`);
      log('');
    }

    if (result.sentiment_analysis) {
      const s = result.sentiment_analysis;
      log(`sentiment: ${s.customer_sentiment} | engagement: ${s.engagement_level}`);
      if (s.buying_signals.length) log(`buying signals: ${s.buying_signals.join(', ')}`);
      if (s.objections_raised.length) log(`objections: ${s.objections_raised.join(', ')}`);
      log('');
    }

    if (result.key_moments.length) {
      log('key moments:');
      for (const km of result.key_moments) {
        log(`  [${km.timestamp}] ${km.type}: ${km.description}`);
      }
      log('');
    }

    if (result.strengths.length) {
      log('strengths:');
      result.strengths.forEach((s: string) => log(`  ✓ ${s}`));
      log('');
    }

    if (result.improvement_areas.length) {
      log('areas to improve:');
      result.improvement_areas.forEach((a: string) => log(`  → ${a}`));
      log('');
    }

    if (result.action_items.length) {
      log('action items:');
      result.action_items.forEach((a: string) => log(`  • ${a}`));
    }
  } catch (err: unknown) {
    captureError(err, { command: 'analytics' });
    const status = err instanceof Object && 'status' in err ? (err as { status: number }).status : undefined;
    if (status === 401) {
      error('invalid API key — run `consuelo init` to update');
    } else if (status === 429) {
      error('rate limited — try again in a moment');
    } else {
      error(err instanceof Error ? err.message : 'analysis failed');
    }
    process.exit(1);
  }
}
