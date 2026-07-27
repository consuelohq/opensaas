#!/usr/bin/env bun

import {
  executeNativeLifecycleOperation,
  parseNativeLifecycleOperationArguments,
  safeNativeLifecycleOperationMessage,
} from './lib/native-lifecycle-operation';

const run = async (): Promise<void> => {
  const parsed = parseNativeLifecycleOperationArguments(process.argv.slice(2));
  const claimed = await executeNativeLifecycleOperation(parsed);
  if (!claimed) throw new Error('native lifecycle operation claim was lost');
};

run().catch((error: unknown) => {
  const message = safeNativeLifecycleOperationMessage(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
