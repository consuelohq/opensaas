export type SkillCategory =
  | 'data_analysis'
  | 'outreach'
  | 'reporting'
  | 'automation'
  | 'custom';

export type OutputFormat = 'text' | 'chart' | 'table' | 'file' | 'mixed';

export type SkillFormData = {
  name: string;
  description: string;
  icon: string;
  category: SkillCategory;
  outputFormat: OutputFormat;
  systemPrompt: string;
  sandboxTemplate: string;
  sandboxLanguage: 'python' | 'javascript';
};

export type CrmVariable = {
  label: string;
  insertText: string;
  description: string;
};
