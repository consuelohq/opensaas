import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import ora from 'ora';

const CONTAINER_NAME = 'opensaas-postgres';
const POSTGRES_IMAGE = 'postgres:15';
const POSTGRES_PORT = 5432;

export async function provisionDockerPostgres(): Promise<string> {
  const spin = ora('Checking Docker...').start();

  try {
    execSync('docker info', { stdio: 'ignore' });
    spin.succeed('Docker is running');
  } catch {
    spin.fail('Docker is not running. Please start Docker and try again.');
    throw new Error('Docker not available');
  }

  spin.start('Pulling postgres:15...');
  execSync(`docker pull ${POSTGRES_IMAGE}`, { stdio: 'ignore' });
  spin.succeed('Image ready');

  const password = crypto.randomBytes(16).toString('hex');

  spin.start('Starting database container...');
  try {
    execSync(`docker inspect ${CONTAINER_NAME}`, { stdio: 'ignore' });
    spin.warn(`Removing existing container '${CONTAINER_NAME}'`);
    execSync(`docker rm -f ${CONTAINER_NAME}`, { stdio: 'ignore' });
    spin.start('Starting database container...');
  } catch {
    // container doesn't exist, that's fine
  }
  execSync(
    `docker run -d --name ${CONTAINER_NAME} ` +
    `-e POSTGRES_USER=opensaas -e POSTGRES_PASSWORD -e POSTGRES_DB=opensaas ` +
    `-p ${POSTGRES_PORT}:5432 -v opensaas-postgres-data:/var/lib/postgresql/data ${POSTGRES_IMAGE}`,
    { stdio: 'ignore', env: { ...process.env, POSTGRES_PASSWORD: password } }
  );
  spin.succeed(`Container ${CONTAINER_NAME} running`);

  spin.start('Waiting for database to be ready...');
  await waitForPostgres();
  spin.succeed('Database accepting connections');

  return `postgres://opensaas:${password}@localhost:${POSTGRES_PORT}/opensaas`;
}

async function waitForPostgres(maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      execSync(`docker exec ${CONTAINER_NAME} pg_isready -U opensaas`, { stdio: 'ignore' });
      return;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('Database failed to start');
}

export function validateConnectionStringFormat(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:';
  } catch {
    return false;
  }
}
