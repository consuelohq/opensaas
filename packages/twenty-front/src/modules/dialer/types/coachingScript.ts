export type CallAssistMode = 'ai' | 'script';

export type CoachingScript = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type CoachingScriptSection = {
  id: string;
  title: string;
  body: string;
  preview: string;
  keywords: string[];
};
