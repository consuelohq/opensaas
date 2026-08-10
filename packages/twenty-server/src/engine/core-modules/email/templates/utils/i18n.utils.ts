import { setupI18n, type I18n, type Messages } from '@lingui/core';
import { type APP_LOCALES } from 'twenty-shared/translations';
import { isDefined } from 'twenty-shared/utils';
import { messages as afMessages } from 'src/engine/core-modules/email/templates/locales/generated/af-ZA';
import { messages as arMessages } from 'src/engine/core-modules/email/templates/locales/generated/ar-SA';
import { messages as caMessages } from 'src/engine/core-modules/email/templates/locales/generated/ca-ES';
import { messages as csMessages } from 'src/engine/core-modules/email/templates/locales/generated/cs-CZ';
import { messages as daMessages } from 'src/engine/core-modules/email/templates/locales/generated/da-DK';
import { messages as deMessages } from 'src/engine/core-modules/email/templates/locales/generated/de-DE';
import { messages as elMessages } from 'src/engine/core-modules/email/templates/locales/generated/el-GR';
import { messages as enMessages } from 'src/engine/core-modules/email/templates/locales/generated/en';
import { messages as esMessages } from 'src/engine/core-modules/email/templates/locales/generated/es-ES';
import { messages as fiMessages } from 'src/engine/core-modules/email/templates/locales/generated/fi-FI';
import { messages as frMessages } from 'src/engine/core-modules/email/templates/locales/generated/fr-FR';
import { messages as heMessages } from 'src/engine/core-modules/email/templates/locales/generated/he-IL';
import { messages as huMessages } from 'src/engine/core-modules/email/templates/locales/generated/hu-HU';
import { messages as itMessages } from 'src/engine/core-modules/email/templates/locales/generated/it-IT';
import { messages as jaMessages } from 'src/engine/core-modules/email/templates/locales/generated/ja-JP';
import { messages as koMessages } from 'src/engine/core-modules/email/templates/locales/generated/ko-KR';
import { messages as nlMessages } from 'src/engine/core-modules/email/templates/locales/generated/nl-NL';
import { messages as noMessages } from 'src/engine/core-modules/email/templates/locales/generated/no-NO';
import { messages as plMessages } from 'src/engine/core-modules/email/templates/locales/generated/pl-PL';
import { messages as pseudoEnMessages } from 'src/engine/core-modules/email/templates/locales/generated/pseudo-en';
import { messages as ptBRMessages } from 'src/engine/core-modules/email/templates/locales/generated/pt-BR';
import { messages as ptPTMessages } from 'src/engine/core-modules/email/templates/locales/generated/pt-PT';
import { messages as roMessages } from 'src/engine/core-modules/email/templates/locales/generated/ro-RO';
import { messages as ruMessages } from 'src/engine/core-modules/email/templates/locales/generated/ru-RU';
import { messages as srMessages } from 'src/engine/core-modules/email/templates/locales/generated/sr-Cyrl';
import { messages as svMessages } from 'src/engine/core-modules/email/templates/locales/generated/sv-SE';
import { messages as trMessages } from 'src/engine/core-modules/email/templates/locales/generated/tr-TR';
import { messages as ukMessages } from 'src/engine/core-modules/email/templates/locales/generated/uk-UA';
import { messages as viMessages } from 'src/engine/core-modules/email/templates/locales/generated/vi-VN';
import { messages as zhHansMessages } from 'src/engine/core-modules/email/templates/locales/generated/zh-CN';
import { messages as zhHantMessages } from 'src/engine/core-modules/email/templates/locales/generated/zh-TW';

const messages: Record<keyof typeof APP_LOCALES, Messages> = {
  en: enMessages,
  'pseudo-en': pseudoEnMessages,
  'af-ZA': afMessages,
  'ar-SA': arMessages,
  'ca-ES': caMessages,
  'cs-CZ': csMessages,
  'da-DK': daMessages,
  'de-DE': deMessages,
  'el-GR': elMessages,
  'es-ES': esMessages,
  'fi-FI': fiMessages,
  'fr-FR': frMessages,
  'he-IL': heMessages,
  'hu-HU': huMessages,
  'it-IT': itMessages,
  'ja-JP': jaMessages,
  'ko-KR': koMessages,
  'nl-NL': nlMessages,
  'no-NO': noMessages,
  'pl-PL': plMessages,
  'pt-BR': ptBRMessages,
  'pt-PT': ptPTMessages,
  'ro-RO': roMessages,
  'ru-RU': ruMessages,
  'sr-Cyrl': srMessages,
  'sv-SE': svMessages,
  'tr-TR': trMessages,
  'uk-UA': ukMessages,
  'vi-VN': viMessages,
  'zh-CN': zhHansMessages,
  'zh-TW': zhHantMessages,
};

const i18nInstancesMap: Partial<Record<keyof typeof APP_LOCALES, I18n>> = {};

export const createI18nInstance = (locale: keyof typeof APP_LOCALES): I18n => {
  if (isDefined(i18nInstancesMap[locale])) {
    return i18nInstancesMap[locale];
  }

  const i18nInstance = setupI18n();
  const localeMessages = messages[locale] ?? messages.en;

  i18nInstance.load(locale, localeMessages);
  i18nInstance.activate(locale);

  i18nInstancesMap[locale] = i18nInstance;

  return i18nInstance;
};
