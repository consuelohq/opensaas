import {
  Controller,
  Get,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import { Response } from 'express';

import { AuthOAuthExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-oauth-exception.filter';
import { AuthRestApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-rest-api-exception.filter';
import { GoogleOauthGuard } from 'src/engine/core-modules/auth/guards/google-oauth.guard';
import { GoogleProviderEnabledGuard } from 'src/engine/core-modules/auth/guards/google-provider-enabled.guard';
import { AuthService } from 'src/engine/core-modules/auth/services/auth.service';
import { GoogleRequest } from 'src/engine/core-modules/auth/strategies/google.auth.strategy';
import { AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';

type OsDeviceApprovalView = {
  status: 'approved' | 'failed';
  email?: string;
  message?: string;
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[char] ?? char,
  );
}

function renderOsDeviceApprovalPage(input: OsDeviceApprovalView): string {
  const approved = input.status === 'approved';
  const title = approved ? 'Device authorized' : 'Device authorization failed';
  const message = approved
    ? 'Your device has been authorized. You can close this window and return to your terminal.'
    : escapeHtml(
        input.message ?? 'Return to your terminal and restart device approval.',
      );
  const detail = approved
    ? `<p class="detail">Approved as ${escapeHtml(input.email ?? 'your Google account')}.</p>`
    : '';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#fff;color:#171717;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{min-height:100vh;display:grid;grid-template-columns:minmax(0,52%) minmax(0,48%)}.copy{min-height:100vh;display:grid;grid-template-rows:auto 1fr;padding:42px clamp(24px,6vw,88px) 64px}.brand{width:fit-content;color:#171717;font-size:14px;font-weight:600;letter-spacing:0;line-height:1;text-decoration:none}.message-wrap{align-self:center;max-width:680px}.message-wrap h1{margin:0 0 58px;color:#171717;font-size:34px;font-weight:400;letter-spacing:0;line-height:1.06}.message{margin:0;max-width:66ch;color:#777;font-size:16px;line-height:1.6}.detail{margin:18px 0 0;color:#999;font-size:14px;line-height:1.5}.visual{position:relative;min-height:100vh;overflow:hidden;background:radial-gradient(circle at 82% 48%,rgba(255,255,255,.32),transparent 0 28%,transparent 46%),linear-gradient(125deg,#050505 0%,#0c0d10 48%,#26313e 100%)}.mark{position:absolute;right:-64px;top:50%;transform:translateY(-50%) rotate(-18deg);color:rgba(255,255,255,.11);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:272px;font-weight:700;letter-spacing:0;line-height:.85;white-space:nowrap}@media(max-width:860px){.shell{grid-template-columns:1fr}.copy{min-height:68vh;padding:22px 20px 42px}.message-wrap{align-self:end}.message-wrap h1{margin-bottom:26px;font-size:34px}.visual{min-height:32vh}.mark{right:16px;font-size:144px}}</style></head><body><main class="shell" data-os-device-approval-state="${input.status}"><section class="copy"><a class="brand" href="/" aria-label="Consuelo OS home">Consuelo OS</a><div class="message-wrap"><h1>${approved ? 'Device authorized' : 'Device authorization failed'}</h1><p class="message">${message}</p>${detail}</div></section><aside class="visual" aria-hidden="true"><div class="mark">OS</div></aside></main></body></html>`;
}

@Controller('auth/google')
@UseFilters(AuthRestApiExceptionFilter)
export class GoogleAuthController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @UseGuards(
    GoogleProviderEnabledGuard,
    GoogleOauthGuard,
    PublicEndpointGuard,
    NoPermissionGuard,
  )
  async googleAuth() {
    // As this method is protected by Google Auth guard, it will trigger Google SSO flow
    return;
  }

  @Get('redirect')
  @UseGuards(
    GoogleProviderEnabledGuard,
    GoogleOauthGuard,
    PublicEndpointGuard,
    NoPermissionGuard,
  )
  @UseFilters(AuthOAuthExceptionFilter)
  async googleAuthRedirect(@Req() req: GoogleRequest, @Res() res: Response) {
    if (req.user.action === 'os-device-approval') {
      const approval = await this.authService.approveOsDeviceWithGoogle(
        req.user,
      );

      res.setHeader('Content-Type', 'text/html');

      return res.send(renderOsDeviceApprovalPage(approval));
    }

    return res.redirect(
      await this.authService.signInUpWithSocialSSO(
        req.user,
        AuthProviderEnum.Google,
      ),
    );
  }
}
