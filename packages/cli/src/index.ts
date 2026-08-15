#!/usr/bin/env node

globalThis.__consuelo_cli_mode = true;

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { coachCommand } from './commands/coach.js';
import { registerContacts } from './commands/contacts.js';
import { registerCalls } from './commands/calls.js';
import { registerQueue } from './commands/queue.js';
import { registerKb } from './commands/kb.js';
import { registerFiles } from './commands/files.js';
import { registerHistory } from './commands/history.js';
import { registerConfig } from './commands/config.js';
import { registerMigrate } from './commands/migrate.js';
import { registerOs } from './commands/os.js';
import { registerSkillCommands } from './commands/skills.js';
import { registerUpdate } from './commands/update.js';
import { registerLogin } from './commands/login.js';
import { analyticsCommand } from './commands/analytics.js';
import { statusCommand, registerStatus } from './commands/status.js';
import { loadConfig } from './config.js';
import { initSentry, captureError } from './sentry.js';
import { extractCatalog, catalogToTools } from './catalog.js';
import { json } from './output.js';
import { handleCommandError } from './errors.js';
import './output.js';

let lastCommandName = 'unknown';
let lastCommandArgs: string[] = [];

const program = new Command();

await initSentry();

program
  .name('consuelo')
  .description('Consuelo command-line interface')
  .version('0.0.1')
  .option('--json', 'machine-readable output')
  .option('--quiet', 'suppress output')
  .option('--no-telemetry', 'disable error reporting')
  .hook('preAction', async (_thisCommand, actionCommand) => {
    lastCommandName = actionCommand.name();
    lastCommandArgs = actionCommand.args;
    const opts = actionCommand.optsWithGlobals();
    if (opts.json) globalThis.__consuelo_json = true;
    if (opts.quiet) globalThis.__consuelo_quiet = true;
  })
  .action(async () => {
    try {
      const config = loadConfig();
      const isConfigured = config.twilioAccountSid || config.managed;
      if (isConfigured) {
        await statusCommand();
      } else {
        await initCommand({});
      }
    } catch (err: unknown) {
      handleCommandError(err, {
        code: 'CLI_ERROR',
        friendlyMessage:
          'consuelo failed — check your configuration and try again',
        command: 'consuelo',
      });
    }
  });

program
  .command('init')
  .description('interactive setup wizard')
  .option('--managed', 'use hosted infrastructure')
  .option('--yes', 'non-interactive mode with sensible defaults')
  .option('--template <type>', 'project template (full, minimal, api-only)')
  .action(async (opts) => {
    try {
      await initCommand({
        managed: opts.managed,
        yes: opts.yes,
        template: opts.template,
      });
    } catch (err: unknown) {
      handleCommandError(err, {
        code: 'CLI_ERROR',
        friendlyMessage: 'init failed — check your configuration and try again',
        command: 'init',
      });
    }
  });

program
  .command('coach')
  .description('analyze a call transcript')
  .option('--transcript <file>', 'path to transcript file')
  .action((opts) => coachCommand({ transcript: opts.transcript }));

// phase 8 command groups
registerContacts(program);
registerCalls(program);
registerQueue(program);
registerKb(program);
registerFiles(program);
registerHistory(program);
registerConfig(program);
registerMigrate(program);
registerStatus(program);
registerOs(program);
registerSkillCommands(program);
registerUpdate(program);
registerLogin(program);

program
  .command('analytics')
  .description('get call analytics')
  .argument('[callSid]', 'call SID to tag results with', '')
  .option('--transcript <file>', 'path to transcript file')
  .action(async (callSid, opts) => {
    await analyticsCommand(callSid, { transcript: opts.transcript });
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
  const command = lastCommandName;
  const args = lastCommandArgs;
  const safeArgs = args.map((a) =>
    /password|token|secret|key|phone|email/i.test(a) ? '***' : a,
  );
  captureError(err, { command, args: safeArgs.join(' ') });
  handleCommandError(err, {
    code: 'CLI_ERROR',
    friendlyMessage: `${command} failed — check your credentials and try again`,
    command,
  });
});
