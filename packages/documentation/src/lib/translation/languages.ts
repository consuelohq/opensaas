export type SupportedTranslationLanguage = {
  code: string;
  label: string;
  nativeLabel: string;
};

export const sourceLanguage = 'en';

export const supportedTranslationLanguages = [
  { code: 'es', label: 'Spanish', nativeLabel: 'Español' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語' },
  { code: 'ko', label: 'Korean', nativeLabel: '한국어' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية' },
  { code: 'zh', label: 'Chinese', nativeLabel: '中文' },
] as const satisfies readonly SupportedTranslationLanguage[];

const supportedLanguageByCode = new Map(
  supportedTranslationLanguages.map((language) => [language.code, language]),
);

export function getSupportedTranslationLanguage(code: string | null): SupportedTranslationLanguage | null {
  if (!code || code === sourceLanguage) return null;
  return supportedLanguageByCode.get(code.toLowerCase()) ?? null;
}

export function isSupportedTranslationLanguage(code: string | null): boolean {
  return getSupportedTranslationLanguage(code) !== null;
}
