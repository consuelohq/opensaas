export interface ParsedContact {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  notes?: string;
}

export interface ParseResult {
  contacts: ParsedContact[];
  errors: string[];
  rawCount: number;
}

const EXTRACTION_PROMPT = `Extract all contacts from this document. Return JSON with a "contacts" array containing objects with:
- name (required): full name
- email (optional): email address
- phone (optional): phone number
- company (optional): company name
- title (optional): job title
- notes (optional): any other relevant info

Only include contacts that have at least a name. Return: {"contacts": [...]}
`;

/**
 * Parse any document format and extract contacts using Groq AI.
 * Accepts CSV, plain text, Excel exports, PDFs (as text), etc.
 */
export async function parseDocument(
  content: string,
  groqApiKey: string
): Promise<ParseResult> {
  if (!content.trim()) {
    return { contacts: [], errors: ['Empty document'], rawCount: 0 };
  }

  try {
    const { default: Groq } = await import('groq-sdk');
    const groq = new Groq({ apiKey: groqApiKey });
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content },
      ],
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      return { contacts: [], errors: ['No response from AI'], rawCount: 0 };
    }

    const parsed = JSON.parse(text) as { contacts?: unknown[] };
    const rawContacts = Array.isArray(parsed.contacts) ? parsed.contacts : [];

    const contacts = rawContacts
      .filter((c): c is ParsedContact => typeof c === 'object' && c !== null && typeof (c as ParsedContact).name === 'string')
      .filter((c) => c.name.trim().length > 0);

    return { contacts, errors: [], rawCount: rawContacts.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { contacts: [], errors: [message], rawCount: 0 };
  }
}
