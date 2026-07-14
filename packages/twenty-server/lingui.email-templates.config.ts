import { defineConfig } from '@lingui/conf';
import { formatter } from '@lingui/format-po';
import { APP_LOCALES, SOURCE_LOCALE } from 'twenty-shared/translations';

export default defineConfig({
  sourceLocale: SOURCE_LOCALE,
  locales: Object.values(APP_LOCALES),
  pseudoLocale: 'pseudo-en',
  fallbackLocales: {
    'pseudo-en': 'en',
    default: SOURCE_LOCALE,
  },
  extractorParserOptions: {
    tsExperimentalDecorators: true,
  },
  catalogs: [
    {
      path: '<rootDir>/src/engine/core-modules/email/templates/locales/{locale}',
      include: ['src/engine/core-modules/email/templates'],
      exclude: [
        'src/engine/core-modules/email/templates/__tests__',
        'src/engine/core-modules/email/templates/locales/generated',
      ],
    },
  ],
  catalogsMergePath:
    '<rootDir>/src/engine/core-modules/email/templates/locales/generated/{locale}',
  compileNamespace: 'ts',
  format: formatter({ lineNumbers: false, printLinguiId: true }),
});
