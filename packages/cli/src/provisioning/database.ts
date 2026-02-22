import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import ora from 'ora';

const CONTAINER_NAME = 'consuelo-postgres';
const POSTGRES_IMAGE = 'postgres:15';
const POSTGRES_PORT = 5432;

export async function provisionDockerPostgres(): Promise<string> {
  const spin = ora('Checking Docker...').start();

  try {
    execSync('docker info', { stdio: 'ignore' });
    spin.succeed('Docker is running');
  } catch (_err: unknown) {
    // Docker not available — intentional: config optional, will fail later with better message
    spin.fail('Docker is not running. Please start Docker and try again.');
    throw new Error('Docker not available');
  }

  // reuse existing container if running (volume keeps the original password)
  try {
    const running = execSync(`docker inspect --format='{{.State.Running}}' ${CONTAINER_NAME} 2>/dev/null`, { encoding: 'utf-8' }).trim();
    if (running === 'true') {
      const env = execSync(`docker inspect --format='{{range .Config.Env}}{{println .}}{{end}}' ${CONTAINER_NAME}`, { encoding: 'utf-8' });
      const pwMatch = env.match(/POSTGRES_PASSWORD=(.+)/);
      if (pwMatch) {
        spin.succeed('Existing database container is running');
        await waitForPostgres();
        return `postgres://consuelo:${pwMatch[1].trim()}@localhost:${POSTGRES_PORT}/consuelo`;
      }
    }
  } catch (_err: unknown) {
    // container doesn't exist — will create below
  }

  const password = randomBytes(16).toString('hex');

  try {
    spin.start('Pulling postgres:15...');
    execSync(`docker pull ${POSTGRES_IMAGE}`, { stdio: 'ignore' });
    spin.succeed('Image ready');
  } catch (err: unknown) {
    spin.fail('Failed to pull postgres:15');
    throw err;
  }

  try {
    spin.start('Starting database container...');
    try {
      execSync(`docker inspect ${CONTAINER_NAME}`, { stdio: 'ignore' });
      spin.warn(`Removing existing container '${CONTAINER_NAME}'`);
      execSync(`docker rm -f ${CONTAINER_NAME}`, { stdio: 'ignore' });
      spin.start('Starting database container...');
    } catch (_err: unknown) {
      // container doesn't exist, that's fine — intentional: cleanup best-effort
    }
    execSync(
      `docker run -d --name ${CONTAINER_NAME} ` +
        `-e POSTGRES_USER=consuelo -e POSTGRES_PASSWORD -e POSTGRES_DB=consuelo ` +
        `-p ${POSTGRES_PORT}:5432 -v consuelo-postgres-data:/var/lib/postgresql/data ${POSTGRES_IMAGE}`,
      { stdio: 'ignore', env: { ...process.env, POSTGRES_PASSWORD: password } },
    );
    spin.succeed(`Container ${CONTAINER_NAME} running`);
  } catch (err: unknown) {
    spin.fail('Failed to start database container');
    throw err;
  }

  spin.start('Waiting for database to be ready...');
  await waitForPostgres();
  spin.succeed('Database accepting connections');

  return `postgres://consuelo:${password}@localhost:${POSTGRES_PORT}/consuelo`;
}

async function waitForPostgres(maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      execSync(`docker exec ${CONTAINER_NAME} pg_isready -U consuelo`, {
        stdio: 'ignore',
      });
      return;
    } catch (_err: unknown) {
      // not ready yet — intentional: cleanup best-effort
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error('Database failed to start');
}

export function validateConnectionStringFormat(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:';
  } catch (_err: unknown) {
    // invalid URL — intentional: config optional
    return false;
  }
}
