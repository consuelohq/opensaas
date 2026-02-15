import * as fs from 'node:fs';
import { execSync } from 'node:child_process';
import type { Command } from 'commander';
import { log, error, json, isJson } from '../output.js';
import { captureError } from '../sentry.js';

type Platform = 'railway' | 'vercel' | 'docker' | 'aws';
type Environment = 'production' | 'staging' | 'preview';

interface DeployOptions {
  platform?: Platform;
  env: Environment;
  dryRun: boolean;
  skipBuild: boolean;
  skipMigrations: boolean;
  json: boolean;
}

interface DeployResult {
  platform: Platform;
  environment: Environment;
  url?: string;
  duration: number;
  dryRun: boolean;
  success: boolean;
}

const PLATFORM_CONFIG_FILES: Record<Platform, string> = {
  railway: 'railway.json',
  vercel: 'vercel.json',
  docker: 'docker-compose.yml',
  aws: 'template.yaml',
};

const PLATFORM_CLIS: Record<Platform, string> = {
  railway: 'railway',
  vercel: 'vercel',
  docker: 'docker',
  aws: 'sam',
};

const detectPlatform = (): Platform | null => {
  for (const [platform, configFile] of Object.entries(PLATFORM_CONFIG_FILES)) {
    if (fs.existsSync(configFile)) return platform as Platform;
  }
  return null;
};

const isCliInstalled = (cli: string): boolean => {
  try {
    execSync(`which ${cli}`, { stdio: 'ignore' });
    return true;
  } catch (_err: unknown) {
    return false;
  }
};

const runCommand = (cmd: string, dryRun: boolean): string => {
  if (dryRun) {
    log(`  [dry-run] ${cmd}`);
    return '';
  }
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['inherit', 'pipe', 'pipe'] }).trim();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`command failed: ${cmd}\n${message}`);
  }
};

const preDeployChecks = (platform: Platform): void => {
  const cli = PLATFORM_CLIS[platform];
  if (!isCliInstalled(cli)) {
    throw new Error(`${cli} CLI not found. install it first: https://docs.${platform === 'aws' ? 'aws.amazon.com/sam' : `${platform}.com`}`);
  }

  const configFile = PLATFORM_CONFIG_FILES[platform];
  if (platform !== 'docker' && !fs.existsSync(configFile)) {
    throw new Error(`${configFile} not found in project root. run \`consuelo init\` or create it manually.`);
  }
};

const deployRailway = (options: DeployOptions): string | undefined => {
  const envFlag = options.env !== 'production' ? ` --environment ${options.env}` : '';
  const output = runCommand(`railway up${envFlag}`, options.dryRun);
  const urlMatch = output.match(/https?:\/\/[^\s]+\.up\.railway\.app/);
  return urlMatch?.[0];
};

const deployVercel = (options: DeployOptions): string | undefined => {
  const prodFlag = options.env === 'production' ? ' --prod' : '';
  const output = runCommand(`vercel${prodFlag} --yes`, options.dryRun);
  const urlMatch = output.match(/https?:\/\/[^\s]+\.vercel\.app/);
  return urlMatch?.[0];
};

const deployDocker = (options: DeployOptions): string | undefined => {
  runCommand('docker compose build', options.dryRun);
  runCommand('docker compose up -d', options.dryRun);
  return undefined;
};

const deployAws = (options: DeployOptions): string | undefined => {
  const stackSuffix = options.env !== 'production' ? `-${options.env}` : '';
  runCommand('sam build', options.dryRun);
  const output = runCommand(`sam deploy --no-confirm-changeset --stack-name consuelo${stackSuffix}`, options.dryRun);
  const urlMatch = output.match(/https?:\/\/[^\s]+\.amazonaws\.com[^\s]*/);
  return urlMatch?.[0];
};

const DEPLOY_HANDLERS: Record<Platform, (options: DeployOptions) => string | undefined> = {
  railway: deployRailway,
  vercel: deployVercel,
  docker: deployDocker,
  aws: deployAws,
};

const deploy = async (options: DeployOptions): Promise<void> => {
  const platform = options.platform ?? detectPlatform();
  if (!platform) {
    error('could not detect platform. use --platform or add a config file (railway.json, vercel.json, docker-compose.yml, template.yaml).');
    process.exit(1);
  }

  log(`deploying to ${platform} (${options.env})...`);

  preDeployChecks(platform);
  log('  ✓ pre-deploy checks passed');

  if (!options.skipBuild) {
    log('  building...');
    runCommand('npm run build', options.dryRun);
    log('  ✓ build complete');
  }

  if (!options.skipMigrations && platform !== 'docker') {
    log('  running migrations...');
    runCommand('npx nx run twenty-server:database:migrate:prod', options.dryRun);
    log('  ✓ migrations complete');
  }

  const start = Date.now();
  log(`  deploying to ${platform}...`);
  const url = DEPLOY_HANDLERS[platform]({ ...options, platform });
  const duration = Math.round((Date.now() - start) / 1000);

  const result: DeployResult = {
    platform,
    environment: options.env,
    url,
    duration,
    dryRun: options.dryRun,
    success: true,
  };

  if (isJson()) {
    json(result);
  } else {
    log('');
    log(`  ✓ deployed to ${platform}${options.dryRun ? ' (dry run)' : ''}`);
    if (url) log(`  url: ${url}`);
    log(`  duration: ${duration}s`);
  }
};

export const registerDeploy = (program: Command): void => {
  program
    .command('deploy')
    .description('deploy consuelo to a platform')
    .option('--platform <platform>', 'target platform (railway, vercel, docker, aws)')
    .option('--env <environment>', 'deployment environment', 'production')
    .option('--dry-run', 'show plan without deploying', false)
    .option('--skip-build', 'skip build step', false)
    .option('--skip-migrations', 'skip database migrations', false)
    .action(async (opts: DeployOptions) => {
      try {
        await deploy(opts);
      } catch (err: unknown) {
        captureError(err, { command: 'deploy' });
        const message = err instanceof Error ? err.message : 'deploy failed';
        if (isJson()) {
          json({ success: false, error: message });
        } else {
          error(message);
        }
        process.exit(1);
      }
    });
};
