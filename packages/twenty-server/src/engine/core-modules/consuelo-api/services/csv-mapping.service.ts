import { Injectable } from '@nestjs/common';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const CSV_FIELD_MAPPING_PROMPT = `You are a CSV field mapping expert. You receive raw rows from a spreadsheet upload. Your job:

1. **Detect the header row.** The first row might be a title, description, or metadata — not actual column headers. Examine all provided rows and identify which row index (0-based) contains the real column headers. Headers are the row where most cells are short descriptive labels (e.g. "First Name", "Phone", "Email", "City").
2. **Map each column** from the header row to the best-matching target field key.

## Mapping rules

- Map each column INDEX (0-based, relative to the header row) to the single best-matching target field key.
- If a column clearly does not match any target field, set its mapping to "skip".
- Prioritize exact matches, then semantic matches (e.g. "First" → first name, "Ph" → phone).
- For name fields: look for first name, last name, or full name patterns.
- For phone fields: any column containing phone, cell, mobile, tel, or number patterns.
- For email fields: any column containing email, e-mail, or mail patterns.
- Each target field may only be used once.
- Use the data rows below the header to disambiguate ambiguous headers.

Return ONLY a JSON object — no explanation, no markdown fences:
{"headerRowIndex": <number>, "mappings": {"<column_index_as_string>": "<target_field_key_or_skip>"}, "confidence": "high|medium|low"}`;

export type CsvMappingInput = {
  columns: { index: number; header: string }[];
  sampleRows: string[][];
  targetFields: { key: string; label: string }[];
  rawRows?: string[][];
};

export type CsvMappingOutput = {
  headerRowIndex?: number;
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

    // if rawRows provided, use header-detection prompt
    // otherwise fall back to legacy column-based input
    const useRawRows =
      Array.isArray(input.rawRows) && input.rawRows.length > 0;

    const skillInput = useRawRows
      ? {
          rawRows: input.rawRows!.slice(0, 10),
          targetFields: input.targetFields,
        }
      : {
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
