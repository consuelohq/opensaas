import { log } from '@clack/prompts';
import type { Command } from 'commander';
import { applyHostedAuthResult, authenticateHosted } from '../auth.js';
import { loadConfig, saveConfig } from '../config.js';
import { captureError } from '../sentry.js';
import { spinner, success } from '../utils/ui.js';

export async function loginCommand(): Promise<void> {
  const spin = spinner('opening Consuelo OS sign in...').start();

  try {
    const result = await authenticateHosted();
    spin.stop();

    const config = loadConfig();
    saveConfig(applyHostedAuthResult(config, result, { managed: true }));
    success(`authenticated as ${result.email}`);
    log.info(`workspace: ${result.workspaceHost}`);
  } catch (error: unknown) {
    spin.fail('authentication failed');
    captureError(error, { command: 'login' });
    throw error;
  }
}

export function registerLogin(program: Command): void {
  program
    .command('login')
    .description('sign in to Consuelo OS')
    .action(async () => loginCommand());
}
