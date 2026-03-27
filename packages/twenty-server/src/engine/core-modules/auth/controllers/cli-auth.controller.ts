import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Response, Request } from 'express';
import { Repository } from 'typeorm';

import { AuthRestApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-rest-api-exception.filter';
import { AuthService } from 'src/engine/core-modules/auth/services/auth.service';
import { ApiKeyService } from 'src/engine/core-modules/api-key/services/api-key.service';
import { UserWorkspaceService } from 'src/engine/core-modules/user-workspace/user-workspace.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import { AuthException, AuthExceptionCode } from 'src/engine/core-modules/auth/auth.exception';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const renderLoginForm = (
  redirectUrl: string,
  error?: string,
  hasGoogleAuth = true,
): string => {
  const googleButton = hasGoogleAuth
    ? `
      <a href="/auth/google?action=cli-auth&cliRedirect=${encodeURIComponent(redirectUrl)}" style="text-decoration: none;">
        <button type="button" class="google">
          <svg class="google-icon" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
      </a>
      <div class="divider">or</div>
      `
    : '';

  const errorDiv = error
    ? `<div class="error">${escapeHtml(error)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Consuelo CLI Authentication</title>
  <style>
    :root { --bg: #fff; --fg: #000; --muted: #6b6b6b; --border: #e5e5e5; --accent: #000; --error: #dc2626; }
    @media (prefers-color-scheme: dark) {
      :root { --bg: #000; --fg: #fff; --muted: #a0a0a0; --border: #1a1a1a; --accent: #fff; --error: #f87171; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Geist Sans', system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--fg); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .container { max-width: 400px; width: 100%; }
    .logo { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 4px; }
    .tagline { color: var(--muted); font-size: 14px; margin-bottom: 32px; }
    .card { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 24px; }
    .error { color: var(--error); font-size: 14px; margin-bottom: 16px; padding: 12px; background: rgba(220, 38, 38, 0.1); border-radius: 8px; }
    input { width: 100%; padding: 12px 16px; border: 1px solid var(--border); border-radius: 8px; font-size: 16px; background: var(--bg); color: var(--fg); margin-bottom: 12px; transition: border-color 0.15s; }
    input:focus { outline: none; border-color: var(--accent); }
    input::placeholder { color: var(--muted); }
    button { width: 100%; padding: 12px 16px; background: var(--accent); color: var(--bg); border: none; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; transition: opacity 0.15s; }
    button:hover { opacity: 0.85; }
    button.google { background: var(--bg); color: var(--fg); border: 1px solid var(--border); margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; }
    button.google:hover { background: var(--border); }
    .divider { display: flex; align-items: center; margin: 16px 0; color: var(--muted); font-size: 13px; }
    .divider::before, .divider::after { content: ''; flex: 1; border-bottom: 1px solid var(--border); }
    .divider::before { margin-right: 12px; }
    .divider::after { margin-left: 12px; }
    .footer { margin-top: 24px; text-align: center; color: var(--muted); font-size: 13px; }
    .footer a { color: var(--fg); text-decoration: underline; }
    .cli-icon { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .cli-icon span { font-size: 32px; }
    .cli-icon code { background: var(--border); padding: 4px 8px; border-radius: 4px; font-size: 12px; font-family: 'Geist Mono', monospace; }
    .google-icon { width: 18px; height: 18px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">consuelo</div>
    <div class="tagline">Authenticate your CLI</div>
    <div class="card">
      <div class="cli-icon">
        <span>⌘</span>
        <code>consuelo</code>
      </div>
      ${errorDiv}
      ${googleButton}
      <form action="/cli/auth/login" method="POST">
        <input type="hidden" name="redirect" value="${escapeHtml(redirectUrl)}" />
        <input type="email" name="email" placeholder="Email" required autocomplete="email" autofocus />
        <input type="password" name="password" placeholder="Password" required autocomplete="current-password" />
        <button type="submit">Sign In</button>
      </form>
    </div>
    <div class="footer">
      Don't have an account? <a href="https://app.consuelohq.com">Sign up</a>
    </div>
  </div>
</body>
</html>`;
};

const renderSuccessPage = (email: string, redirectWithToken: string): string => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Consuelo CLI - Authenticated</title>
  <style>
    :root { --bg: #fff; --fg: #000; --muted: #6b6b6b; --success: #16a34a; }
    @media (prefers-color-scheme: dark) {
      :root { --bg: #000; --fg: #fff; --muted: #a0a0a0; --success: #22c55e; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Geist Sans', system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--fg); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .container { text-align: center; max-width: 400px; }
    .icon { width: 64px; height: 64px; border-radius: 50%; background: var(--success); display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
    .icon svg { width: 32px; height: 32px; color: white; }
    .title { font-size: 24px; font-weight: 600; margin-bottom: 8px; }
    .subtitle { color: var(--muted); font-size: 14px; line-height: 1.5; }
    .email { font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <div class="title">Authentication successful</div>
    <div class="subtitle">
      Authenticated as <span class="email">${escapeHtml(email)}</span>.<br>
      You can close this tab and return to your terminal.
    </div>
  </div>
  <script>
    setTimeout(() => {
      window.location.href = "${escapeHtml(redirectWithToken)}";
    }, 500);
  </script>
</body>
</html>`;
};

const renderErrorPage = (message: string, redirectUrl?: string): string => {
  const tryAgainLink = redirectUrl
    ? `<a href="/cli/auth?redirect=${encodeURIComponent(redirectUrl)}">Try again</a>`
    : '<a href="https://app.consuelohq.com">Go to Consuelo</a>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Consuelo CLI - Error</title>
  <style>
    :root { --bg: #fff; --fg: #000; --muted: #6b6b6b; --error: #dc2626; }
    @media (prefers-color-scheme: dark) {
      :root { --bg: #000; --fg: #fff; --muted: #a0a0a0; --error: #f87171; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Geist Sans', system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--fg); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .container { text-align: center; max-width: 400px; }
    .icon { width: 64px; height: 64px; border-radius: 50%; background: var(--error); display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
    .icon svg { width: 32px; height: 32px; color: white; }
    .title { font-size: 24px; font-weight: 600; margin-bottom: 8px; }
    .subtitle { color: var(--muted); font-size: 14px; line-height: 1.5; margin-bottom: 24px; }
    a { color: var(--fg); text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
    <div class="title">Authentication failed</div>
    <div class="subtitle">${escapeHtml(message)}</div>
    ${tryAgainLink}
  </div>
</body>
</html>`;
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface LoginBody {
  email: string;
  password: string;
  redirect: string;
}

@Controller('cli/auth')
@UseFilters(AuthRestApiExceptionFilter)
export class CliAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly apiKeyService: ApiKeyService,
    private readonly userWorkspaceService: UserWorkspaceService,
    private readonly jwtWrapperService: JwtWrapperService,
    private readonly twentyConfigService: TwentyConfigService,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  @Get()
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async cliAuthPage(
    @Query('redirect') redirect: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!redirect) {
      res.setHeader('Content-Type', 'text/html');
      res.send(
        renderErrorPage(
          'Missing redirect URL. Please start authentication from the CLI.',
        ),
      );
      return;
    }

    // Validate redirect URL is localhost
    try {
      const redirectUrl = new URL(redirect);
      if (
        redirectUrl.hostname !== 'localhost' &&
        redirectUrl.hostname !== '127.0.0.1'
      ) {
        res.setHeader('Content-Type', 'text/html');
        res.send(
          renderErrorPage('Invalid redirect URL. Must be localhost.', redirect),
        );
        return;
      }
    } catch {
      res.setHeader('Content-Type', 'text/html');
      res.send(renderErrorPage('Invalid redirect URL format.', redirect));
      return;
    }

    // Check if user already has a valid session (via cookies)
    const tokenPairCookie = req.cookies?.['tokenPair'];
    if (tokenPairCookie) {
      try {
        const tokenPair = JSON.parse(tokenPairCookie);
        const accessToken = tokenPair.accessOrWorkspaceAgnosticToken;

        if (accessToken) {
          const decoded = this.jwtWrapperService.verifyJwtToken(accessToken);

          if (decoded?.userId) {
            // User is already logged in - get their workspace and generate API key
            const user = await this.userRepository.findOne({
              where: { id: decoded.userId },
            });

            if (user) {
              const availableWorkspaces =
                await this.userWorkspaceService.findAvailableWorkspacesByEmail(
                  user.email,
                );

              const signInWorkspaces =
                availableWorkspaces.availableWorkspacesForSignIn;

              if (signInWorkspaces.length > 0) {
                const workspace = signInWorkspaces[0].workspace;

                if (workspace) {
                  const redirectHtml = await this.generateTokenAndRedirect(
                    user,
                    workspace,
                    redirect,
                  );

                  res.setHeader('Content-Type', 'text/html');
                  res.send(redirectHtml);
                  return;
                }
              }
            }
          }
        }
      } catch {
        // Token invalid or expired - fall through to login form
      }
    }

    // Check if Google auth is enabled
    const hasGoogleAuth = this.twentyConfigService.get('AUTH_GOOGLE_ENABLED');

    res.setHeader('Content-Type', 'text/html');
    res.send(renderLoginForm(redirect, undefined, hasGoogleAuth));
  }

  @Post('login')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async cliAuthLogin(
    @Body() body: LoginBody,
    @Res() res: Response,
  ): Promise<void> {
    const { email, password, redirect } = body;
    const hasGoogleAuth = this.twentyConfigService.get('AUTH_GOOGLE_ENABLED');

    if (!email || !password) {
      res.setHeader('Content-Type', 'text/html');
      res.send(
        renderLoginForm(
          redirect,
          'Email and password are required',
          hasGoogleAuth,
        ),
      );
      return;
    }

    try {
      // Get user first to check auth method
      const user = await this.userRepository.findOne({
        where: { email: email.toLowerCase() },
        relations: { userWorkspaces: true },
      });

      if (!user) {
        res.setHeader('Content-Type', 'text/html');
        res.send(
          renderLoginForm(
            redirect,
            'No account found with this email. Please sign up first.',
            hasGoogleAuth,
          ),
        );
        return;
      }

      // Check if user has password set (might be Google-only user)
      if (!user.passwordHash) {
        res.setHeader('Content-Type', 'text/html');
        res.send(
          renderLoginForm(
            redirect,
            'This account uses Google sign-in. Please click "Continue with Google" above.',
            hasGoogleAuth,
          ),
        );
        return;
      }

      // Validate credentials
      await this.authService.validateLoginWithPassword({
        email: email.toLowerCase(),
        password,
      });

      // Get user's workspaces
      const availableWorkspaces =
        await this.userWorkspaceService.findAvailableWorkspacesByEmail(email);

      const signInWorkspaces =
        availableWorkspaces.availableWorkspacesForSignIn;
      const signUpWorkspaces =
        availableWorkspaces.availableWorkspacesForSignUp;

      if (signInWorkspaces.length === 0 && signUpWorkspaces.length === 0) {
        res.setHeader('Content-Type', 'text/html');
        res.send(
          renderLoginForm(
            redirect,
            'No workspace found for this account',
            hasGoogleAuth,
          ),
        );
        return;
      }

      // Use the first available workspace (prefer sign-in workspaces)
      const workspaceInfo = signInWorkspaces[0] ?? signUpWorkspaces[0];
      const workspace = workspaceInfo.workspace;

      if (!workspace) {
        res.setHeader('Content-Type', 'text/html');
        res.send(
          renderLoginForm(redirect, 'Workspace not found', hasGoogleAuth),
        );
        return;
      }

      const redirectHtml = await this.generateTokenAndRedirect(
        user,
        workspace,
        redirect,
      );

      res.setHeader('Content-Type', 'text/html');
      res.send(redirectHtml);
    } catch (err) {
      let errorMessage = 'Invalid email or password. Please try again.';

      if (err instanceof AuthException) {
        if (err.code === AuthExceptionCode.INVALID_INPUT) {
          errorMessage =
            'This account uses Google sign-in. Please click "Continue with Google" above.';
        }
      }

      res.setHeader('Content-Type', 'text/html');
      res.send(renderLoginForm(redirect, errorMessage, hasGoogleAuth));
    }
  }

  private async generateTokenAndRedirect(
    user: UserEntity,
    workspace: WorkspaceEntity,
    redirect: string,
  ): Promise<string> {
    // Generate API key for CLI
    const { token } = await this.createApiKeyForCLI(user, workspace);

    // Build redirect URL with token
    const redirectUrl = new URL(redirect);
    redirectUrl.searchParams.set('token', token);
    redirectUrl.searchParams.set('email', user.email);
    redirectUrl.searchParams.set('workspaceId', workspace.id);

    return renderSuccessPage(user.email, redirectUrl.toString());
  }

  private async createApiKeyForCLI(
    user: UserEntity,
    workspace: WorkspaceEntity,
  ): Promise<{ token: string }> {
    // Create API key with 1 year expiry
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // Use workspace default role
    const roleId = workspace.defaultRoleId;

    if (!roleId) {
      throw new Error('Workspace has no default role configured');
    }

    const apiKey = await this.apiKeyService.create({
      name: 'CLI - ' + user.email,
      expiresAt,
      workspaceId: workspace.id,
      roleId,
    });

    const tokenResult = await this.apiKeyService.generateApiKeyToken(
      workspace.id,
      apiKey.id,
      expiresAt,
    );

    if (!tokenResult?.token) {
      throw new Error('Failed to generate API key token');
    }

    return { token: tokenResult.token };
  }
}
