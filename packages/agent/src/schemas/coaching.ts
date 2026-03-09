// coaching schemas — moved from @consuelo/coaching (DEV-1262)
// zod is a peer dep — lazy import required (OPTIONAL_IMPORT rule)

// plain types — always available, no runtime dependency

export type SalesCoaching = {
  product_or_option_name: string;
  details: string[];
  clarifying_questions: string[];
};

export type KeyMoment = {
  timestamp: string;
  type: 'objection' | 'commitment' | 'question' | 'insight';
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
};

export type SentimentAnalysis = {
  overall: 'positive' | 'negative' | 'neutral' | 'mixed';
  customer: string;
  agent: string;
  trend: 'improving' | 'declining' | 'stable';
};

export type PerformanceMetrics = {
  talk_ratio: number;
  response_time_avg: number;
  objection_handling_score: number;
};

export type CallAnalytics = {
  key_moments: KeyMoment[];
  sentiment: SentimentAnalysis;
  performance: PerformanceMetrics;
};

export type PostCallAnalysisResult = {
  analytics: CallAnalytics;
  actions_taken: string[];
};

// zod schema builders — lazy-loaded, call only when runtime validation is needed

export const createCoachingSchemas = async () => {
  try {
    const { z } = await import('zod');

  const SalesCoachingSchema = z.object({
    product_or_option_name: z.string(),
    details: z.array(z.string()).min(1).max(3),
    clarifying_questions: z.array(z.string()).min(2).max(3),
  });

  const KeyMomentSchema = z.object({
    timestamp: z.string(),
    type: z.enum(['objection', 'commitment', 'question', 'insight']),
    description: z.string(),
    impact: z.enum(['positive', 'negative', 'neutral']),
  });

  const SentimentAnalysisSchema = z.object({
    overall: z.enum(['positive', 'negative', 'neutral', 'mixed']),
    customer: z.string(),
    agent: z.string(),
    trend: z.enum(['improving', 'declining', 'stable']),
  });

  const PerformanceMetricsSchema = z.object({
    talk_ratio: z.number(),
    response_time_avg: z.number(),
    objection_handling_score: z.number(),
  });

  const CallAnalyticsSchema = z.object({
    key_moments: z.array(KeyMomentSchema),
    sentiment: SentimentAnalysisSchema,
    performance: PerformanceMetricsSchema,
  });

  const PostCallAnalysisResultSchema = z.object({
    analytics: CallAnalyticsSchema,
    actions_taken: z.array(z.string()),
  });

  return {
    SalesCoachingSchema,
    KeyMomentSchema,
    SentimentAnalysisSchema,
    PerformanceMetricsSchema,
    CallAnalyticsSchema,
    PostCallAnalysisResultSchema,
  };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'failed to load zod';
    throw new Error(`createCoachingSchemas failed: ${message}`);
  }
};
