import { execSync } from 'node:child_process';
import { select, text, password, confirm, isCancel, cancel, log } from '@clack/prompts';
import { printBanner, printEnd, spinner, success, stepComplete } from '../utils/ui.js';
import { saveConfig } from '../config.js';
import { captureError } from '../sentry.js';
import { validateTwilio, validateGroq } from '../validators/index.js';
import { generateEnv } from '../generators/env.js';
import { generateDockerCompose } from '../generators/docker.js';
import { authenticateHosted } from '../auth.js';
import { provisionDockerPostgres, validateConnectionStringFormat } from '../provisioning/database.js';
import { setupWhisper } from '../provisioning/whisper.js';

export type Template = 'full' | 'minimal' | 'api-only';

export interface InitOptions {
  managed?: boolean;
  yes?: boolean;
  template?: Template;
}

export async function initCommand(opts: InitOptions): Promise<void> {
  try {
    checkPrerequisites();

    printBanner(['deployment', 'database', 'credentials', 'speech-to-text (optional)']);

    if (opts.managed) {
      generateEnv({ deploymentType: 'hosted', template: opts.template ?? 'full' });
      success('Configured for hosted mode');
      log.info('Run: npx @consuelo/cli status');
      printEnd();
      return;
    }

    if (opts.yes) {
      await runNonInteractive(opts.template ?? 'full');
      return;
    }

    const template = opts.template ?? await promptTemplate();
    if (isCancel(template)) { cancel('setup cancelled.'); process.exit(0); }

    const deploymentType = await select({
      message: 'how would you like to deploy?',
      options: [
        { value: 'hosted' as const, label: 'hosted (mercury)', hint: 'we handle infrastructure' },
        { value: 'self-hosted' as const, label: 'self-hosted', hint: 'you control everything' },
      ],
    });

    if (isCancel(deploymentType)) { cancel('setup cancelled.'); process.exit(0); }

    if (deploymentType === 'hosted') {
      await handleHostedSetup(template);
    } else {
      await handleSelfHostedSetup(template);
    }

    await promptAuthLogin();
    printNextSteps(deploymentType);
    printEnd();
  } catch (err: unknown) {
    captureError(err, { command: 'init' });
    throw err;
  }
}

function checkPrerequisites(): void {
  const missing: string[] = [];

  const nodeVersion = parseInt(process.version.slice(1), 10);
  if (nodeVersion < 18) {
    missing.push(`node 18+ required (found ${process.version}) — https://nodejs.org`);
  }

  try { execSync('git --version', { stdio: 'ignore' }); } catch {
    missing.push('git not found — https://git-scm.com');
  }

  try { execSync('docker --version', { stdio: 'ignore' }); } catch {
    missing.push('docker not found (needed for self-hosted) — https://docker.com');
  }

  if (missing.length > 0) {
    log.error('missing prerequisites:');
    for (const m of missing) log.error(`  ✗ ${m}`);
    process.exit(1);
  }
}

async function promptTemplate(): Promise<Template> {
  const result = await select({
    message: 'choose a template',
    options: [
      { value: 'full' as const, label: 'full', hint: 'CRM + dialer + coaching + analytics' },
      { value: 'minimal' as const, label: 'minimal', hint: 'dialer + coaching only' },
      { value: 'api-only' as const, label: 'api-only', hint: 'backend services, no CRM UI' },
    ],
  });
  return result as Template;
}

async function runNonInteractive(template: Template): Promise<void> {
  log.info('running in non-interactive mode (--yes)');

  const spin = spinner('provisioning postgres...').start();
  try {
    const databaseUrl = await provisionDockerPostgres();
    spin.succeed('database ready');

    generateEnv({ deploymentType: 'self-hosted', template, databaseUrl });
    success('configuration saved to .env (fill in credentials manually)');

    generateDockerCompose();
    success('docker files generated');

    printNextSteps('self-hosted');
    printEnd();
  } catch (err: unknown) {
    spin.fail('provisioning failed');
    captureError(err, { command: 'init' });
    throw err;
  }
}

async function handleHostedSetup(template: Template): Promise<void> {
  const spin = spinner('waiting for authentication...').start();

  try {
    const { apiKey, email } = await authenticateHosted();
    spin.succeed(`authenticated as ${email}`);

    generateEnv({ deploymentType: 'hosted', template, apiKey });
    success('API key saved to .env');
  } catch (err: unknown) {
    spin.fail(err instanceof Error ? err.message : 'authentication failed');
    captureError(err, { command: 'init' });
    throw err;
  }
}

async function handleSelfHostedSetup(template: Template): Promise<void> {
  try {
    const dbChoice = await select({
      message: 'database setup',
      options: [
        { value: 'docker' as const, label: 'spin up docker', hint: 'recommended' },
        { value: 'connection' as const, label: 'use existing connection string' },
      ],
    });

    if (isCancel(dbChoice)) { cancel('setup cancelled.'); process.exit(0); }

    let databaseUrl: string;
    if (dbChoice === 'docker') {
      const spin = spinner('provisioning postgres...').start();
      databaseUrl = await provisionDockerPostgres();
      spin.succeed(`database ready at ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
    } else {
      const url = await text({
        message: 'database url',
        placeholder: 'postgres://user:pass@host:5432/db',
        validate: (v) => {
          if (!v || !v.startsWith('postgres')) return 'must be a postgres url';
          return undefined;
        },
      });

      if (isCancel(url)) { cancel('setup cancelled.'); process.exit(0); }

      if (!validateConnectionStringFormat(url)) {
        throw new Error('invalid database connection string');
      }
      databaseUrl = url;
    }

    stepComplete('deployment');
    stepComplete('database');

    const twilioAccountSid = await text({
      message: 'twilio account sid',
      placeholder: 'https://console.twilio.com',
      validate: (v) => {
        if (!v || !v.startsWith('AC')) return 'must start with AC';
        return undefined;
      },
    });

    if (isCancel(twilioAccountSid)) { cancel('setup cancelled.'); process.exit(0); }

    const twilioAuthToken = await password({ message: 'twilio auth token' });
    if (isCancel(twilioAuthToken)) { cancel('setup cancelled.'); process.exit(0); }

    const twilioPhoneNumber = await text({
      message: 'twilio phone number (E.164)',
      placeholder: '+1234567890',
      validate: (v) => {
        if (!v || !/^\+\d{10,15}$/.test(v)) return 'must be E.164 format (+1234567890)';
        return undefined;
      },
    });

    if (isCancel(twilioPhoneNumber)) { cancel('setup cancelled.'); process.exit(0); }

    const groqApiKey = await password({
      message: 'groq api key (https://console.groq.com)',
      validate: (v) => {
        if (!v || !v.startsWith('gsk_')) return 'must start with gsk_';
        return undefined;
      },
    });

    if (isCancel(groqApiKey)) { cancel('setup cancelled.'); process.exit(0); }

    const spin = spinner('validating credentials...').start();

    const twilioValid = await validateTwilio(twilioAccountSid, twilioAuthToken);
    if (!twilioValid) {
      spin.fail('invalid twilio credentials');
      throw new Error('check your Account SID and Auth Token at https://console.twilio.com');
    }
    spin.text = 'twilio ✓ validating groq...';

    const groqValid = await validateGroq(groqApiKey);
    if (!groqValid) {
      spin.fail('invalid groq api key');
      throw new Error('get your API key at https://console.groq.com');
    }
    spin.succeed('all credentials validated');

    stepComplete('credentials');

    saveConfig({
      twilioAccountSid,
      twilioAuthToken,
      twilioPhoneNumber,
      llmProvider: 'groq',
      llmApiKey: groqApiKey,
    });

    const setupStt = await confirm({
      message: 'set up local speech-to-text? (optional, ~75MB download)',
      initialValue: false,
    });

    let whisperModelPath: string | undefined;
    if (!isCancel(setupStt) && setupStt) {
      const modelSize = await select({
        message: 'choose model size',
        options: [
          { value: 'tiny' as const, label: 'tiny (~75MB)', hint: 'fastest, good for voice commands' },
          { value: 'base' as const, label: 'base (~150MB)', hint: 'better accuracy' },
        ],
      });

      if (!isCancel(modelSize)) {
        const sttSpin = spinner('downloading whisper model...').start();
        whisperModelPath = await setupWhisper(modelSize);
        sttSpin.succeed('speech-to-text ready');
      }
    }

    stepComplete('speech-to-text (optional)');

    generateEnv({
      deploymentType: 'self-hosted',
      template,
      databaseUrl,
      twilioAccountSid,
      twilioAuthToken,
      twilioPhoneNumber,
      groqApiKey,
      whisperModelPath,
    });
    success('configuration saved to .env');

    generateDockerCompose();
    success('docker files generated');
  } catch (err: unknown) {
    captureError(err, { command: 'init' });
    throw err;
  }
}

async function promptAuthLogin(): Promise<void> {
  try {
    const shouldAuth = await confirm({
      message: 'authenticate with twenty CRM now?',
      initialValue: false,
    });

    if (isCancel(shouldAuth) || !shouldAuth) return;

    const { registerCommands } = await import('twenty-sdk/cli');
    const { Command } = await import('commander');
    const sub = new Command();
    registerCommands(sub);
    await sub.parseAsync(['node', 'consuelo', 'auth:login']);
  } catch {
    log.warn('workspace auth skipped (twenty-sdk not available)');
  }
}

function printNextSteps(deploymentType: 'hosted' | 'self-hosted'): void {
  log.step('next steps:');
  if (deploymentType === 'hosted') {
    log.info('1. consuelo status');
    log.info('2. https://consuelohq.com');
  } else {
    log.info('1. docker-compose up');
    log.info('2. http://localhost:3000');
    log.info('3. https://consuelohq.com');
  }
}
