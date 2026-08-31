import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const project = JSON.parse(
  readFileSync('packages/twenty-server/project.json', 'utf8'),
);

test('Twenty server uses the Node 24-compatible TypeORM ts-node wrapper', () => {
  const command = project.targets?.typeorm?.options?.command;

  assert.equal(
    command,
    'TS_NODE_TRANSPILE_ONLY=true TS_NODE_PROJECT=tsconfig.json npx --no-install typeorm-ts-node-commonjs',
  );
  assert.equal(command.includes('node_modules/typeorm/cli.js'), false);
});

test('the configured TypeORM wrapper resolves from the installed package', () => {
  const result = spawnSync(
    'npx',
    ['--no-install', 'typeorm-ts-node-commonjs', '--version'],
    {
      cwd: 'packages/twenty-server',
      env: {
        ...process.env,
        TS_NODE_TRANSPILE_ONLY: 'true',
        TS_NODE_PROJECT: 'tsconfig.json',
      },
      encoding: 'utf8',
    },
  );

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /^0\.3\.20\s*$/);
});
