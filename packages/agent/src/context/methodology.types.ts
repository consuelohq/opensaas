export type QualificationCriterion = {
  key: string;
  label: string;
  description: string;
  scoringGuide: string;
};

export type SalesMethodology = {
  id: string;
  name: string;
  type: 'built-in' | 'custom';
  description: string;
  systemPrompt: string;
  qualificationCriteria: QualificationCriterion[];
  scoringWeights: Record<string, number> | null;
};

export type WorkspaceMethodologyConfig = {
  activeMethodologyId: string;
  customOverrides?: { systemPromptAppend?: string };
};
