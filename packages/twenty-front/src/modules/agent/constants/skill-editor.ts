import {
  type CrmVariable,
  type OutputFormat,
  type SkillCategory,
} from '@/agent/types/skill-editor';

export const CRM_VARIABLES: CrmVariable[] = [
  {
    label: 'contact.name',
    insertText: '{{contact.name}}',
    description: 'Contact full name',
  },
  {
    label: 'contact.email',
    insertText: '{{contact.email}}',
    description: 'Contact email address',
  },
  {
    label: 'contact.company',
    insertText: '{{contact.company}}',
    description: 'Contact company name',
  },
  { label: 'deal.name', insertText: '{{deal.name}}', description: 'Deal name' },
  {
    label: 'deal.value',
    insertText: '{{deal.value}}',
    description: 'Deal monetary value',
  },
  {
    label: 'deal.stage',
    insertText: '{{deal.stage}}',
    description: 'Current deal stage',
  },
  {
    label: 'user.name',
    insertText: '{{user.name}}',
    description: 'Current user name',
  },
  {
    label: 'workspace.name',
    insertText: '{{workspace.name}}',
    description: 'Workspace name',
  },
];

export const SKILL_CATEGORIES: Array<{ value: SkillCategory; label: string }> =
  [
    { value: 'data_analysis', label: 'Data Analysis' },
    { value: 'outreach', label: 'Outreach' },
    { value: 'reporting', label: 'Reporting' },
    { value: 'automation', label: 'Automation' },
    { value: 'custom', label: 'Custom' },
  ];

export const OUTPUT_FORMATS: Array<{ value: OutputFormat; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'chart', label: 'Chart' },
  { value: 'table', label: 'Table' },
  { value: 'file', label: 'File' },
  { value: 'mixed', label: 'Mixed' },
];
