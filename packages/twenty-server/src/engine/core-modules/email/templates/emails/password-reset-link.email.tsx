import { Trans } from '@lingui/react';
import { BaseEmail } from 'src/engine/core-modules/email/templates/components/BaseEmail';
import { CallToAction } from 'src/engine/core-modules/email/templates/components/CallToAction';
import { Link } from 'src/engine/core-modules/email/templates/components/Link';
import { MainText } from 'src/engine/core-modules/email/templates/components/MainText';
import { Title } from 'src/engine/core-modules/email/templates/components/Title';
import { createI18nInstance } from 'src/engine/core-modules/email/templates/utils/i18n.utils';
import { type APP_LOCALES } from 'twenty-shared/translations';

type PasswordResetLinkEmailProps = {
  duration: string;
  hasPassword: boolean;
  link: string;
  locale: keyof typeof APP_LOCALES;
};

export const PasswordResetLinkEmail = ({
  duration,
  hasPassword,
  link,
  locale,
}: PasswordResetLinkEmailProps) => {
  const i18n = createI18nInstance(locale);
  const headline = hasPassword
    ? i18n._('Reset your password 🗝')
    : i18n._('Set your password 🗝');
  const ctaLabel = hasPassword ? i18n._('Reset') : i18n._('Set');

  return (
    <BaseEmail locale={locale}>
      <Title value={headline} />
      <MainText>
        <Trans
          id="This link is only valid for the next {duration}. If the link does not work, you can use the login verification link directly:"
          values={{ duration }}
        />
        <br />
        <Link href={link} value={link} />
      </MainText>
      <br />
      <CallToAction href={link} value={ctaLabel} />
      <br />
      <br />
    </BaseEmail>
  );
};

PasswordResetLinkEmail.PreviewProps = {
  duration: '24 hours',
  hasPassword: true,
  link: 'https://app.consuelo.com/reset-password/123',
  locale: 'en',
} as PasswordResetLinkEmailProps;

export default PasswordResetLinkEmail;
