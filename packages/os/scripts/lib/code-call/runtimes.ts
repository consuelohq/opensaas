import { Effect } from 'effect';

import type { CodeCallLanguage } from './types';

export type RuntimeProvider = {
  language: CodeCallLanguage;
  runtime: string;
  sourceExtension: string;
};

export const LANGUAGE_ALIASES: Record<string, CodeCallLanguage> = {
  py: 'python',
  python: 'python',
  python3: 'python',
  bun: 'bun',
  node: 'bun',
  javascript: 'bun',
  typescript: 'bun',
  js: 'bun',
  ts: 'bun',
  bash: 'bash',
  shell: 'bash',
  sh: 'bash',
};

const RUNTIME_PROVIDERS: Record<CodeCallLanguage, RuntimeProvider> = {
  python: { language: 'python', runtime: 'python3', sourceExtension: 'py' },
  bun: { language: 'bun', runtime: 'bun', sourceExtension: 'ts' },
  bash: { language: 'bash', runtime: 'bash', sourceExtension: 'sh' },
};

export function normalizeLanguage(language: string): CodeCallLanguage | null {
  return LANGUAGE_ALIASES[language.trim().toLowerCase()] || null;
}

export const resolveRuntimeProviderEffect = (language: CodeCallLanguage) => Effect.succeed(RUNTIME_PROVIDERS[language]);
