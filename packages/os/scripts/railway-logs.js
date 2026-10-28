#!/usr/bin/env bun

import { runRailwayLogsCli } from '../tools/railway/cli.ts';

process.exitCode = await runRailwayLogsCli(process.argv.slice(2));
