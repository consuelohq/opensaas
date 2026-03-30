import { type TranscriptEntry } from '@/dialer/types/coaching';
import {
  type CoachingScript,
  type CoachingScriptSection,
} from '@/dialer/types/coachingScript';

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'this',
  'to',
  'we',
  'with',
  'you',
  'your',
]);

const normalizeToken = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '');

const extractKeywords = (value: string) => {
  const counts = new Map<string, number>();

  value
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
    .forEach((token) => {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([token]) => token);
};

const splitIntoBlocks = (content: string) => {
  const headingBlocks = content
    .split(/\n(?=# )/g)
    .map((block) => block.trim())
    .filter(Boolean);

  if (headingBlocks.some((block) => block.startsWith('# '))) {
    return headingBlocks;
  }

  return content
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean);
};

export const parseCoachingScript = (
  script: CoachingScript | null | undefined,
): CoachingScriptSection[] => {
  if (!script?.content.trim()) {
    return [];
  }

  return splitIntoBlocks(script.content).map((block, index) => {
    const [firstLine, ...rest] = block.split('\n');
    const hasHeading = firstLine.startsWith('# ');
    const title = hasHeading
      ? firstLine.replace(/^#\s+/, '').trim()
      : `Section ${index + 1}`;
    const body = hasHeading ? rest.join('\n').trim() : block.trim();
    const preview = body.replace(/\s+/g, ' ').trim();

    return {
      id: `${script.id}-${index}`,
      title,
      body,
      preview,
      keywords: extractKeywords(`${title} ${body}`),
    };
  });
};

const buildTranscriptKeywordSet = (transcript: TranscriptEntry[]) => {
  return new Set(
    transcript.slice(-12).flatMap((entry) => extractKeywords(entry.text)),
  );
};

export const getSuggestedScriptSectionIndex = ({
  sections,
  transcript,
  currentIndex,
}: {
  sections: CoachingScriptSection[];
  transcript: TranscriptEntry[];
  currentIndex: number;
}) => {
  if (sections.length === 0 || transcript.length === 0) {
    return currentIndex;
  }

  const transcriptKeywords = buildTranscriptKeywordSet(transcript);

  let bestIndex = currentIndex;
  let bestScore = 0;

  sections.forEach((section, index) => {
    if (index < currentIndex) {
      return;
    }

    const score = section.keywords.reduce(
      (sum, keyword) => sum + (transcriptKeywords.has(keyword) ? 1 : 0),
      0,
    );

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestScore >= 2 ? bestIndex : currentIndex;
};
