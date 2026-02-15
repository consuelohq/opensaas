#!/usr/bin/env node

globalThis.__consuelo_cli_mode = true;

import { Command } from 'commander';
// eslint-disable-next-line @nx/enforce-module-boundaries -- DEV-788: nx tags not configured for cli
import { createLogger } from '@consuelo/logger';
import { initCommand } from './commands/init.js';
import { coachCommand } from './commands/coach.js';
import { registerContacts } from './commands/contacts.js';
import { registerCalls } from './commands/calls.js';
import { registerQueue } from './commands/queue.js';
import { registerKb } from './commands/kb.js';
import { registerFiles } from './commands/files.js';
import { registerHistory } from './commands/history.js';
import { registerConfig } from './commands/config.js';
import { analyticsCommand } from './commands/analytics.js';
import { statusCommand } from './commands/status.js';
import { loadConfig } from './config.js';
import { initSentry, captureError } from './sentry.js';
import { extractCatalog, catalogToTools } from './catalog.js';
import './output.js';

const logger = createLogger('CLI');
const program = new Command();

await initSentry();

program
  .name('consuelo')
  .description('AI-powered sales toolkit')
  .version('0.0.1')
  .option('--json', 'machine-readable output')
  .option('--quiet', 'suppress output')
  .option('--no-telemetry', 'disable error reporting')
  .option('--workspace <name>', 'use a specific workspace configuration')
  .hook('preAction', async (_thisCommand, actionCommand) => {
    const opts = actionCommand.optsWithGlobals();
    if (opts.json) globalThis.__consuelo_json = true;
    if (opts.quiet) globalThis.__consuelo_quiet = true;

    // twenty-sdk workspace resolution
    try {
      // eslint-disable-next-line @nx/enforce-module-boundaries -- DEV-788: nx tags not configured for cli
      const { ConfigService } = await import('twenty-sdk/cli');
      let workspace = opts.workspace as string | undefined;
      if (!workspace) {
        const configService = new ConfigService();
        workspace = await configService.getDefaultWorkspace();
      }
      ConfigService.setActiveWorkspace(workspace);
    } catch {
      // twenty-sdk not available — skip workspace resolution
    }
  })
  .action(async () => {
    const config = loadConfig();
    const isConfigured = config.twilioAccountSid || config.managed;
    if (isConfigured) {
      await statusCommand();
    } else {
      await initCommand({});
    }
  });

program
  .command('init')
  .description('interactive setup wizard')
  .option('--managed', 'use hosted infrastructure')
  .option('--yes', 'non-interactive mode with sensible defaults')
  .option('--template <type>', 'project template (full, minimal, api-only)')
  .action(async (opts) => {
    await initCommand({ managed: opts.managed, yes: opts.yes, template: opts.template });
  });

program
  .command('coach')
  .description('analyze a call transcript')
  .option('--transcript <file>', 'path to transcript file')
  .action(async (opts) => {
    await coachCommand({ transcript: opts.transcript });
  });

// phase 8 command groups
registerContacts(program);
registerCalls(program);
registerQueue(program);
registerKb(program);
registerFiles(program);
registerHistory(program);
registerConfig(program);

// twenty-sdk platform commands (auth, app, entity, function)
try {
  // eslint-disable-next-line @nx/enforce-module-boundaries -- DEV-788: nx tags not configured for cli
  const { registerCommands } = await import('twenty-sdk/cli');
  registerCommands(program);
} catch {
  // twenty-sdk not built — platform commands unavailable
}

program
  .command('analytics')
  .description('get call analytics')
  .argument('[callSid]', 'call SID to tag results with', '')
  .option('--transcript <file>', 'path to transcript file')
  .action(async (callSid, opts) => {
    await analyticsCommand(callSid, { transcript: opts.transcript });
  });

program
  .command('status')
  .description('show config and account status')
  .action(async () => {
    await statusCommand();
  });

program
  .command('catalog', { hidden: true })
  .description('generate command catalog for assistant')
  .action(() => {
    const catalog = extractCatalog(program);
    const tools = catalogToTools(catalog);
    json({ ...catalog, tools });
  });

program.parseAsync().catch((err: unknown) => {
  captureError(err, { command: process.argv[2] ?? 'unknown' });
  logger.error(err instanceof Error ? err.message : 'unexpected error');
  process.exit(1);
});
