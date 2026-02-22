import * as fs from 'node:fs';
import { Coach } from '@consuelo/coaching';
import { loadConfig } from '../config.js';
import { log, error, json, isJson } from '../output.js';
import { captureError } from '../sentry.js';
import { parseTranscript } from '../utils/transcript.js';

export async function coachCommand(opts: { transcript?: string }): Promise<void> {
  if (!opts.transcript) {
    error('provide a transcript file: consuelo coach --transcript <file>');
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

  const coach = new Coach({
    provider: config.llmProvider ?? 'groq',
    apiKey: config.llmApiKey,
  });

  try {
    const analysis = await coach.analyzeCall(messages);

    if (isJson()) {
      json(analysis);
      return;
    }

    log('');
    log(`score: ${analysis.overall_score}/100`);
    log('');
    if (analysis.strengths.length) {
      log('strengths:');
      analysis.strengths.forEach((s: string) => log(`  ✓ ${s}`));
      log('');
    }
    if (analysis.improvement_areas.length) {
      log('areas to improve:');
      analysis.improvement_areas.forEach((a: string) => log(`  → ${a}`));
      log('');
    }
    if (analysis.action_items.length) {
      log('action items:');
      analysis.action_items.forEach((a: string) => log(`  • ${a}`));
      log('');
    }
    if (analysis.sentiment_analysis) {
      const s = analysis.sentiment_analysis;
      log(`sentiment: ${s.customer_sentiment} | engagement: ${s.engagement_level}`);
    }
    if (analysis.performance_metrics) {
      const m = analysis.performance_metrics;
      log(`talk ratio: ${Math.round(m.talk_ratio * 100)}% | questions: ${m.questions_asked} | objections handled: ${m.objections_handled}`);
    }
  } catch (err: unknown) {
    captureError(err, { command: 'coach' });
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
