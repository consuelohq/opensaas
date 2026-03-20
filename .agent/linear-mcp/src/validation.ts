// validation — label enforcement + spec template checks
// returns warnings (never blocks)

interface ValidationWarning {
  field: string;
  message: string;
}

const BRACKET_LABELS = ['[phase]', '[task]', '[epic]', '[bug]', '[spike]', '[gtm]', '[skill]', '[doc]', '[review]', '[feature]'];
const REPO_LABELS = ['opensaas', 'web'];

export function validateLabels(labelNames: string[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const lower = labelNames.map(l => l.toLowerCase());
  if (!BRACKET_LABELS.some(b => lower.includes(b))) {
    warnings.push({ field: 'labels', message: `missing bracket type label — need one of: ${BRACKET_LABELS.join(', ')}` });
  }
  if (!REPO_LABELS.some(r => lower.includes(r))) {
    warnings.push({ field: 'labels', message: `missing repo label — need one of: ${REPO_LABELS.join(', ')}` });
  }
  return warnings;
}

const REQUIRED_SECTIONS = [
  { heading: '## conversation context', label: 'conversation context' },
  { heading: '## qmd context for agents', label: 'qmd context for agents' },
  { heading: '## acceptance criteria', label: 'acceptance criteria' },
];

export function validateDescription(description: string): ValidationWarning[] {
  const lower = description.toLowerCase();
  return REQUIRED_SECTIONS
    .filter(s => !lower.includes(s.heading))
    .map(s => ({ field: 'description', message: `missing "${s.label}" section in spec` }));
}
