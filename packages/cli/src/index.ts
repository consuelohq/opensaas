#!/usr/bin/env node

globalThis.__consuelo_cli_mode = true;

import { Command } from 'commander';
import { createLogger } from '@consuelo/logger';
import { initCommand } from './commands/init.js';
import { callCommand } from './commands/call.js';
import { coachCommand } from './commands/coach.js';
import { registerContacts } from './commands/contacts.js';
import { analyticsCommand } from './commands/analytics.js';
import { statusCommand } from './commands/status.js';
import { loadConfig } from './config.js';
import { initSentry, captureError } from './sentry.js';
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
  .hook('preAction', (_thisCommand, actionCommand) => {
    const opts = actionCommand.optsWithGlobals();
    if (opts.json) globalThis.__consuelo_json = true;
    if (opts.quiet) globalThis.__consuelo_quiet = true;
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
  .action(async (opts) => {
    await initCommand({ managed: opts.managed });
  });

program
  .command('call')
  .description('make a call with AI coaching')
  .argument('<number>', 'phone number to call')
  .action(async (number) => {
    await callCommand(number);
  });

program
  .command('coach')
  .description('analyze a call transcript')
  .option('--transcript <file>', 'path to transcript file')
  .action(async (opts) => {
    await coachCommand({ transcript: opts.transcript });
  });

registerContacts(program);

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

program.parseAsync().catch((err) => {
  captureError(err, { command: process.argv[2] ?? 'unknown' });
  logger.error(err.message);
  process.exit(1);
});
