export type DirectionCard = {
  id: string;
  label: string;
  palette: string[];
  displayFont: string;
  bodyFont: string;
  mood?: string;
  references: string[];
};

export type Question = {
  id: string;
  label: string;
  type: 'radio' | 'checkbox' | 'select' | 'text' | 'textarea' | 'direction-cards';
  required?: boolean;
  help?: string;
  options?: string[];
  cards?: DirectionCard[];
  placeholder?: string;
  defaultValue?: string | string[];
  maxSelections?: number;
};

export type QuestionForm = {
  id: string;
  title: string;
  description?: string;
  submitLabel?: string;
  questions: Question[];
};

export type QuestionFormSegment =
  | { kind: 'text'; text: string }
  | { kind: 'form'; form: QuestionForm };

function parseForm(raw: string): QuestionForm | null {
  try {
    const parsed = JSON.parse(raw) as Partial<QuestionForm>;
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.title !== 'string' || !Array.isArray(parsed.questions)) {
      return null;
    }
    return {
      id: parsed.id,
      title: parsed.title,
      description: parsed.description,
      submitLabel: parsed.submitLabel,
      questions: parsed.questions as Question[],
    };
  } catch {
    return null;
  }
}

export function splitOnQuestionForms(text: string): QuestionFormSegment[] {
  const segments: QuestionFormSegment[] = [];
  const pattern = /<question-form\b[^>]*>([\s\S]*?)<\/question-form>/gi;
  let lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ kind: 'text', text: text.slice(lastIndex, index) });
    const form = parseForm(match[1] ?? '');
    if (form) segments.push({ kind: 'form', form });
    else segments.push({ kind: 'text', text: match[0] ?? '' });
    lastIndex = index + (match[0]?.length ?? 0);
  }
  if (lastIndex < text.length) segments.push({ kind: 'text', text: text.slice(lastIndex) });
  return segments;
}

export function formatFormAnswers(form: QuestionForm, answers: Record<string, string | string[]>): string {
  const lines = [`[form answers — ${form.id}]`];
  for (const question of form.questions) {
    const value = answers[question.id];
    const formatted = Array.isArray(value) ? value.join(', ') : value;
    lines.push(`- ${question.label}: ${formatted && formatted.length > 0 ? formatted : '(skipped)'}`);
  }
  return lines.join('\n');
}
