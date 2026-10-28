#!/usr/bin/env bun

const { runBrowserCli } = await import('./lib/browser/cli.ts');
await runBrowserCli();
