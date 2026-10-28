#!/usr/bin/env bun

const { runStreamCreateCli } = await import('./lib/streams/cli.ts');
await runStreamCreateCli();
