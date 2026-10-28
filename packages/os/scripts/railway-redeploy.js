#!/usr/bin/env bun

import { runRailwayRedeployCli } from '../tools/railway/cli.ts';

process.exitCode = await runRailwayRedeployCli(process.argv.slice(2));
