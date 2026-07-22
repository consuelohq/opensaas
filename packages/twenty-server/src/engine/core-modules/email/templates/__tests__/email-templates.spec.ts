import { renderToStaticMarkup } from 'react-dom/server';

import {
  CleanSuspendedWorkspaceEmail,
  PasswordResetLinkEmail,
  PasswordUpdateNotifyEmail,
  SendApprovedAccessDomainValidation,
  SendEmailVerificationLinkEmail,
  SendInviteLinkEmail,
  WarnSuspendedWorkspaceEmail,
} from 'src/engine/core-modules/email/templates';

describe('server-owned email templates', () => {
  it('renders every migrated production template', () => {
    const commonSender = {
      email: 'owner@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
    };
    const workspace = { name: 'Analytical Engines', logo: undefined };

    const templates = [
      CleanSuspendedWorkspaceEmail({
        daysSinceInactive: 30,
        userName: 'Ada Lovelace',
        workspaceDisplayName: workspace.name,
        locale: 'en',
      }),
      PasswordResetLinkEmail({
        duration: '24 hours',
        hasPassword: true,
        link: 'https://app.consuelohq.com/reset-password/token',
        locale: 'en',
      }),
      PasswordUpdateNotifyEmail({
        userName: 'Ada Lovelace',
        email: commonSender.email,
        link: 'https://app.consuelohq.com',
        locale: 'en',
      }),
      SendEmailVerificationLinkEmail({
        link: 'https://app.consuelohq.com/verify-email/token',
        locale: 'en',
      }),
      SendInviteLinkEmail({
        link: 'https://app.consuelohq.com/invite/token',
        workspace,
        sender: commonSender,
        serverUrl: 'https://app.consuelohq.com',
        locale: 'en',
      }),
      SendApprovedAccessDomainValidation({
        link: 'https://app.consuelohq.com/settings/domains',
        domain: 'example.com',
        workspace,
        sender: commonSender,
        serverUrl: 'https://app.consuelohq.com',
        locale: 'en',
      }),
      WarnSuspendedWorkspaceEmail({
        daysSinceInactive: 10,
        inactiveDaysBeforeDelete: 14,
        userName: 'Ada Lovelace',
        workspaceDisplayName: workspace.name,
        locale: 'en',
      }),
    ];

    const htmlResults = templates.map((template) =>
      renderToStaticMarkup(template),
    );

    expect(htmlResults).toHaveLength(7);
    for (const html of htmlResults) {
      expect(html).toContain('<html');
      expect(html).toContain('Consuelo');
    }
  });

  it('preserves the migrated localized message catalogs', () => {
    const html = renderToStaticMarkup(
      PasswordResetLinkEmail({
        duration: '24 heures',
        hasPassword: true,
        link: 'https://app.consuelohq.com/reset-password/token',
        locale: 'fr-FR',
      }),
    );

    expect(html).toContain('lang="fr-FR"');
    expect(html).toContain('Réinitialisez votre mot de passe');
    expect(html).toContain('Réinitialiser');
  });
});
