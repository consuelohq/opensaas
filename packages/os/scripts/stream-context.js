#!/usr/bin/env bun

const { runStreamContextCli } = await import('./lib/streams/cli.ts');
await runStreamContextCli();
