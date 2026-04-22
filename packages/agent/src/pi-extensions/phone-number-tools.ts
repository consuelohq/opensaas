import { Type, type Static } from '@sinclair/typebox';

import type { AgentTool, AgentToolResult } from '@mariozechner/pi-agent-core';

export type PhoneNumberRecommendation = {
  phoneNumber: string;
  areaCode: string;
  friendlyName: string;
  city?: string;
  state?: string;
  region?: string;
  reason?: string;
  score?: number;
};

export type PhoneNumberRecommendationService = {
  recommend: (
    query: string,
    options?: { limit?: number },
  ) => Promise<PhoneNumberRecommendation[]>;
};

type PhoneNumberToolResult = AgentToolResult<Record<string, unknown>>;

const textResult = (data: unknown): PhoneNumberToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data) }],
  details: {},
});

const safeExecute = async (
  fn: () => Promise<unknown>,
  fallbackMessage: string,
): Promise<PhoneNumberToolResult> => {
  try {
    const result = await fn();

    return textResult(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : fallbackMessage;

    return textResult({ error: message });
  }
};

const RecommendPhoneNumbersParams = Type.Object({
  query: Type.String({
    description: 'Natural-language request for a phone number market or style',
  }),
  limit: Type.Optional(
    Type.Number({ description: 'Maximum number of recommendations to return' }),
  ),
});

type RecommendPhoneNumbersParamsType = Static<typeof RecommendPhoneNumbersParams>;

export const createPhoneNumberTools = (
  service: PhoneNumberRecommendationService,
): AgentTool[] => [
  {
    name: 'recommend_phone_numbers',
    label: 'Recommend Phone Numbers',
    description:
      'Recommend and rank purchasable phone numbers based on a natural-language request',
    parameters: RecommendPhoneNumbersParams,
    async execute(_toolCallId, params) {
      const { query, limit } = params as RecommendPhoneNumbersParamsType;

      return safeExecute(
        () => service.recommend(query, { limit }),
        'phone number recommendation failed',
      );
    },
  },
];
