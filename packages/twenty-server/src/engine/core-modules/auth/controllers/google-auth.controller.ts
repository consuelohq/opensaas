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
  const title = approved
    ? 'Consuelo OS approved'
    : 'Consuelo OS approval failed';
  const message = approved
    ? `Approved as ${escapeHtml(input.email ?? 'your Google account')}. You can close this tab and return to your terminal.`
    : escapeHtml(
        input.message ?? 'Return to your terminal and restart device approval.',
      );

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:Inter,system-ui,-apple-system,sans-serif;min-height:100vh;margin:0;display:grid;place-items:center;background:#050505;color:#fff}.card{width:min(520px,calc(100vw - 32px));border:1px solid #ffffff24;border-radius:24px;padding:32px;background:#ffffff0f;text-align:center}.eyebrow{letter-spacing:.18em;text-transform:uppercase;color:#aaa}.status{font-size:40px;margin:8px 0 16px}.message{color:#ddd;line-height:1.5}</style></head><body><main class="card"><p class="eyebrow">Consuelo OS</p><h1 class="status">${approved ? 'Approved' : 'Approval failed'}</h1><p class="message">${message}</p></main></body></html>`;
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
