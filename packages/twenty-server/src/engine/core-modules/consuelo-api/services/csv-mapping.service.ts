import { Injectable } from '@nestjs/common';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const CSV_FIELD_MAPPING_PROMPT = `You are a CSV field mapping expert. Analyze the CSV columns and sample data below, then map each column index to the most appropriate target field key.

## Rules

1. Map each CSV column INDEX (not header) to the single best-matching target field key.
2. If a column clearly does not match any target field, set its mapping to "skip".
3. Prioritize exact matches, then semantic matches (e.g. "First" → first name, "Ph" → phone).
4. For name fields: look for first name, last name, or full name patterns.
5. For phone fields: any column containing phone, cell, mobile, tel, or number patterns.
6. For email fields: any column containing email, e-mail, or mail patterns.
7. Each target field may only be used once.
8. Use the sample data rows to disambiguate ambiguous headers.

Return ONLY a JSON object — no explanation, no markdown fences:
{"mappings": {"<column_index_as_string>": "<target_field_key_or_skip>"}, "confidence": "high|medium|low"}`;

export type CsvMappingInput = {
  columns: { index: number; header: string }[];
  sampleRows: string[][];
  targetFields: { key: string; label: string }[];
};

export type CsvMappingOutput = {
  mappings: Record<string, string>;
  confidence: 'high' | 'medium' | 'low';
};

@Injectable()
export class CsvMappingService {
  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  async analyzeCsvMapping(input: CsvMappingInput): Promise<CsvMappingOutput> {
    // lazy imports — ai SDK is a peer dep
    const { generateText } = await import('ai');
    const { createGroq } = await import('@ai-sdk/groq');

    const apiKey = this.twentyConfigService.get('GROQ_API_KEY');
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    const groq = createGroq({ apiKey });

    const skillInput = {
      columns: input.columns,
      sampleRows: input.sampleRows.slice(0, 5),
      targetFields: input.targetFields,
    };

    const { text } = await generateText({
      model: groq('openai/gpt-oss-120b'),
      prompt: `${CSV_FIELD_MAPPING_PROMPT}\n\n## Input\n\n${JSON.stringify(skillInput, null, 2)}`,
      temperature: 0.1,
    });

    const cleaned = text
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();

    return JSON.parse(cleaned) as CsvMappingOutput;
  }
}
