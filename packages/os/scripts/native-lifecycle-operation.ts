#!/usr/bin/env bun

import {
  executeNativeLifecycleOperation,
  parseNativeLifecycleOperationArguments,
} from './lib/native-lifecycle-operation';

const run = async (): Promise<void> => {
  const parsed = parseNativeLifecycleOperationArguments(process.argv.slice(2));
  await executeNativeLifecycleOperation(parsed);
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
