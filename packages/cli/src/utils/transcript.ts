import type { Message } from '@consuelo/coaching';

/** Parse a transcript with speaker labels into structured messages */
export function parseTranscript(content: string): Message[] {
  const messages: Message[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(agent|rep|sales_rep|customer|client|prospect)\s*:\s*(.+)/i);
    if (match) {
      const role = /^(agent|rep|sales_rep)$/i.test(match[1]) ? 'sales_rep' : 'customer';
      messages.push({ role, content: match[2].trim() });
    } else if (messages.length) {
      messages[messages.length - 1].content += ' ' + trimmed;
    }
  }
  return messages;
}
