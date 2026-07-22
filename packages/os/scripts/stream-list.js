#!/usr/bin/env bun

const { runStreamListCli } = await import('./lib/streams/cli.ts');
await runStreamListCli();
