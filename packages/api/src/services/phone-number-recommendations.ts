import * as Sentry from '@sentry/node';
import type { Dialer } from '@consuelo/dialer';
import type { AvailableNumber } from '@consuelo/dialer';

type AreaCodeCandidate = {
  areaCode: string;
  reason: string;
};

export type PhoneNumberRecommendation = AvailableNumber & {
  reason: string;
  score: number;
};

const MAX_AREA_CODES = 5;
const DEFAULT_LIMIT = 8;
const FALLBACK_AREA_CODES: Record<string, AreaCodeCandidate[]> = {
  atlanta: [{ areaCode: '404', reason: 'matched atlanta' }],
  austin: [{ areaCode: '512', reason: 'matched austin' }],
  boston: [{ areaCode: '617', reason: 'matched boston' }],
  brooklyn: [{ areaCode: '718', reason: 'matched brooklyn' }],
  chicago: [{ areaCode: '312', reason: 'matched chicago' }],
  dallas: [{ areaCode: '214', reason: 'matched dallas' }],
  denver: [{ areaCode: '303', reason: 'matched denver' }],
  houston: [{ areaCode: '713', reason: 'matched houston' }],
  losangeles: [{ areaCode: '213', reason: 'matched los angeles' }],
  miami: [{ areaCode: '305', reason: 'matched miami' }],
  nashville: [{ areaCode: '615', reason: 'matched nashville' }],
  newyork: [{ areaCode: '212', reason: 'matched new york' }],
  phoenix: [{ areaCode: '602', reason: 'matched phoenix' }],
  sanantonio: [{ areaCode: '210', reason: 'matched san antonio' }],
  sanfrancisco: [{ areaCode: '415', reason: 'matched san francisco' }],
  seattle: [{ areaCode: '206', reason: 'matched seattle' }],
};

const getClient = async () => {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.GROQ_API_KEY ?? '';
  if (apiKey.length === 0) return null;

  const { default: OpenAIClient } = await import('openai');
  return new OpenAIClient({
    apiKey,
    baseURL:
      process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY
        ? 'https://api.groq.com/openai/v1'
        : undefined,
  });
};

const normalizeQuery = (query: string): string => {
  return query.toLowerCase().replace(/[^a-z0-9]+/g, '');
};

const extractHeuristicAreaCodes = (query: string): AreaCodeCandidate[] => {
  const explicitAreaCodes = Array.from(query.matchAll(/\b(\d{3})\b/g)).map(
    (match) => ({ areaCode: match[1], reason: 'matched explicit area code' }),
  );

  if (explicitAreaCodes.length > 0) {
    return explicitAreaCodes.slice(0, MAX_AREA_CODES);
  }

  const normalizedQuery = normalizeQuery(query);

  return Object.entries(FALLBACK_AREA_CODES)
    .flatMap(([token, candidates]) => {
      return normalizedQuery.includes(token) ? candidates : [];
    })
    .slice(0, MAX_AREA_CODES);
};

const inferAreaCodesWithLlm = async (
  query: string,
): Promise<AreaCodeCandidate[]> => {
  try {
    const client = await getClient();
    if (!client) return [];

    const response = await client.chat.completions.create({
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content:
            'extract the best 1-5 united states area codes for the request. return compact json with an array named areaCodes. each item must have areaCode and reason.',
        },
        {
          role: 'user',
          content: query,
        },
      ],
      model:
        process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY
          ? 'openai/gpt-oss-120b'
          : 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content ?? '';
    if (content.length === 0) return [];

    const parsed = JSON.parse(content) as {
      areaCodes?: Array<{ areaCode?: string; reason?: string }>;
    };

    return (parsed.areaCodes ?? [])
      .flatMap((entry) => {
        if (
          typeof entry.areaCode !== 'string' ||
          !/^\d{3}$/.test(entry.areaCode)
        ) {
          return [];
        }

        return [
          {
            areaCode: entry.areaCode,
            reason:
              typeof entry.reason === 'string' && entry.reason.length > 0
                ? entry.reason
                : 'matched request intent',
          },
        ];
      })
      .slice(0, MAX_AREA_CODES);
  } catch (err: unknown) {
    Sentry.captureException(err);
    return [];
  }
};

const rerankRecommendationsWithLlm = async (
  query: string,
  recommendations: PhoneNumberRecommendation[],
): Promise<PhoneNumberRecommendation[]> => {
  try {
    const client = await getClient();
    if (!client || recommendations.length === 0) {
      return recommendations;
    }

    const response = await client.chat.completions.create({
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content:
            'rank phone number candidates for the user request. return compact json with an array named rankings. each item must have phoneNumber, score from 0 to 100, and reason.',
        },
        {
          role: 'user',
          content: JSON.stringify({ query, recommendations }),
        },
      ],
      model:
        process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY
          ? 'openai/gpt-oss-120b'
          : 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content ?? '';
    if (content.length === 0) return recommendations;

    const parsed = JSON.parse(content) as {
      rankings?: Array<{
        phoneNumber?: string;
        reason?: string;
        score?: number;
      }>;
    };

    const rankingByPhoneNumber = new Map(
      (parsed.rankings ?? [])
        .filter((entry) => typeof entry.phoneNumber === 'string')
        .map((entry) => [entry.phoneNumber as string, entry]),
    );

    return recommendations
      .map((recommendation) => {
        const ranking = rankingByPhoneNumber.get(recommendation.phoneNumber);
        if (!ranking) return recommendation;

        return {
          ...recommendation,
          reason:
            typeof ranking.reason === 'string' && ranking.reason.length > 0
              ? ranking.reason
              : recommendation.reason,
          score:
            typeof ranking.score === 'number'
              ? ranking.score
              : recommendation.score,
        };
      })
      .sort((left, right) => right.score - left.score);
  } catch (err: unknown) {
    Sentry.captureException(err);
    return recommendations;
  }
};

export const recommendPhoneNumbers = async (
  dialer: Pick<Dialer, 'searchAvailableNumbers'>,
  query: string,
  options?: { country?: string; limit?: number },
): Promise<PhoneNumberRecommendation[]> => {
  try {
    const limit = Math.min(options?.limit ?? DEFAULT_LIMIT, 12);
    const llmCandidates = await inferAreaCodesWithLlm(query);
    const heuristicCandidates = extractHeuristicAreaCodes(query);
    const mergedCandidates = [...llmCandidates, ...heuristicCandidates].filter(
      (candidate, index, candidates) => {
        return (
          candidates.findIndex((entry) => entry.areaCode === candidate.areaCode) ===
          index
        );
      },
    );

    if (mergedCandidates.length === 0) {
      return [];
    }

    const recommendations: PhoneNumberRecommendation[] = [];
    const seenPhoneNumbers = new Set<string>();

    for (const [candidateIndex, candidate] of mergedCandidates.entries()) {
      const available = await dialer.searchAvailableNumbers({
        areaCode: candidate.areaCode,
        country: options?.country ?? 'US',
        limit: Math.max(2, Math.ceil(limit / mergedCandidates.length) + 1),
      });

      for (const [numberIndex, number] of available.entries()) {
        if (seenPhoneNumbers.has(number.phoneNumber)) {
          continue;
        }

        seenPhoneNumbers.add(number.phoneNumber);
        recommendations.push({
          ...number,
          reason: candidate.reason,
          score: Math.max(0, 100 - candidateIndex * 15 - numberIndex * 2),
        });
      }
    }

    const rankedRecommendations = await rerankRecommendationsWithLlm(
      query,
      recommendations,
    );

    return rankedRecommendations.slice(0, limit);
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};
