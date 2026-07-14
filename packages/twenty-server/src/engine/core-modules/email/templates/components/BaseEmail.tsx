import { I18nProvider } from '@lingui/react';
import { Container, Html } from '@react-email/components';

import { BaseHead } from 'src/engine/core-modules/email/templates/components/BaseHead';
import { Footer } from 'src/engine/core-modules/email/templates/components/Footer';
import { Logo } from 'src/engine/core-modules/email/templates/components/Logo';
import { createI18nInstance } from 'src/engine/core-modules/email/templates/utils/i18n.utils';
import { type APP_LOCALES } from 'twenty-shared/translations';

type BaseEmailProps = {
  children: JSX.Element | JSX.Element[] | string;
  width?: number;
  locale: keyof typeof APP_LOCALES;
};

export const BaseEmail = ({ children, width, locale }: BaseEmailProps) => {
  const i18nInstance = createI18nInstance(locale);

  return (
    <I18nProvider i18n={i18nInstance}>
      <Html lang={locale}>
        <BaseHead />
        <Container width={width || 290}>
          <Logo />
          {children}
          <Footer i18n={i18nInstance} />
        </Container>
      </Html>
    </I18nProvider>
  );
};
