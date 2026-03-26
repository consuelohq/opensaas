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
import { Response } from 'express';
import { Repository } from 'typeorm';

import { AuthRestApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-rest-api-exception.filter';
import { AuthService } from 'src/engine/core-modules/auth/services/auth.service';
import { ApiKeyService } from 'src/engine/core-modules/api-key/services/api-key.service';
import { UserWorkspaceService } from 'src/engine/core-modules/user-workspace/user-workspace.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';

const renderLoginForm = (redirectUrl: string, error?: string): string => `
<!DOCTYPE html>
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
    .footer { margin-top: 24px; text-align: center; color: var(--muted); font-size: 13px; }
    .footer a { color: var(--fg); text-decoration: underline; }
    .cli-icon { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .cli-icon span { font-size: 32px; }
    .cli-icon code { background: var(--border); padding: 4px 8px; border-radius: 4px; font-size: 12px; font-family: 'Geist Mono', monospace; }
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
      ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
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
</html>
`;

const renderSuccessPage = (email: string, tokenReceived: boolean): string => `
<!DOCTYPE html>
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
    .warning { margin-top: 24px; padding: 16px; background: rgba(234, 179, 8, 0.1); border-radius: 8px; color: var(--fg); font-size: 14px; }
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
    ${
      !tokenReceived
        ? `
    <div class="warning">
      ⚠️ The CLI did not receive the token. Please check your terminal for errors.
    </div>
    `
        : ''
    }
  </div>
</body>
</html>
`;

const renderErrorPage = (message: string, redirectUrl?: string): string => `
<!DOCTYPE html>
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
    code { background: rgba(128,128,128,0.1); padding: 2px 6px; border-radius: 4px; font-family: 'Geist Mono', monospace; font-size: 13px; }
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
    ${redirectUrl ? `<a href="${escapeHtml(redirectUrl)}">Try again</a>` : '<a href="https://app.consuelohq.com">Go to Consuelo</a>'}
  </div>
</body>
</html>
`;

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
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
  ) {}

  @Get()
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async cliAuthPage(
    @Query('redirect') redirect: string,
    @Query('scope') scope: string,
    @Req()
    req: { user?: { id: string; email: string }; workspace?: { id: string } },
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
    // This is handled by JwtAuthGuard on other routes, but for this public endpoint
    // we need to check manually
    // For now, always show the login form - the user can sign in

    res.setHeader('Content-Type', 'text/html');
    res.send(renderLoginForm(redirect));
  }

  @Post('login')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async cliAuthLogin(
    @Body() body: LoginBody,
    @Res() res: Response,
  ): Promise<void> {
    const { email, password, redirect } = body;

    if (!email || !password) {
      res.setHeader('Content-Type', 'text/html');
      res.send(renderLoginForm(redirect, 'Email and password are required'));
      return;
    }

    try {
      // Validate credentials
      const user = await this.authService.validateLoginWithPassword({
        email: email.toLowerCase(),
        password,
      });

      // Get user's workspaces
      const availableWorkspaces =
        await this.userWorkspaceService.findAvailableWorkspacesByEmail(email);

      const signInWorkspaces = availableWorkspaces.availableWorkspacesForSignIn;
      const signUpWorkspaces = availableWorkspaces.availableWorkspacesForSignUp;

      if (signInWorkspaces.length === 0 && signUpWorkspaces.length === 0) {
        res.setHeader('Content-Type', 'text/html');
        res.send(
          renderLoginForm(redirect, 'No workspace found for this account'),
        );
        return;
      }

      // Use the first available workspace (prefer sign-in workspaces)
      const workspaceInfo = signInWorkspaces[0] ?? signUpWorkspaces[0];
      const workspace = workspaceInfo.workspace;

      if (!workspace) {
        res.setHeader('Content-Type', 'text/html');
        res.send(renderLoginForm(redirect, 'Workspace not found'));
        return;
      }

      // Generate API key for CLI
      const { token } = await this.createApiKeyForCLI(user, workspace);

      // Build redirect URL with token
      const redirectUrl = new URL(redirect);
      redirectUrl.searchParams.set('token', token);
      redirectUrl.searchParams.set('email', email);
      redirectUrl.searchParams.set('workspaceId', workspace.id);

      // Show success page (the redirect happens client-side via the callback)
      res.setHeader('Content-Type', 'text/html');
      res.send(renderSuccessPage(email, true));

      // Also trigger the redirect via a script
      res.write(`
        <script>
          setTimeout(() => {
            window.location.href = "${redirectUrl.toString()}";
          }, 100);
        </script>
      `);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Authentication failed';
      res.setHeader('Content-Type', 'text/html');
      res.send(
        renderLoginForm(
          redirect,
          'Invalid email or password. Please try again.',
        ),
      );
    }
  }

  private async createApiKeyForCLI(
    user: UserEntity,
    workspace: WorkspaceEntity,
  ): Promise<{ token: string }> {
    // Create API key with 1 year expiry
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // Use workspace default role (read-only by default for CLI)
    // If no default role, the API key will have minimal permissions
    const roleId = workspace.defaultRoleId;

    if (!roleId) {
      throw new Error('Workspace has no default role configured');
    }

    const apiKey = await this.apiKeyService.create({
      name: `CLI - ${user.email}`,
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
