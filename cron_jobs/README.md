# Consuelo cron jobs

`cron_jobs/` is the local background job surface for workspace now and Consuelo OS later. The command surface is `bun run cron`.

Commands:

```bash
bun run cron -- list
bun run cron -- run-once --job sites-launcher --dry-run --force
bun run cron -- watch --interval-ms 30000
bun run cron -- install --name opensaas --interval-ms 30000
bun run cron -- status
bun run cron -- logs
bun run cron -- uninstall --name opensaas
```

Each job lives in `cron_jobs/<name>` and is discovered from `cron.json`. Local secrets belong in each job's `.env` file or the shell environment. The remaining Sites launcher job runs the checked-in OS Sites refresh command, then requests the public root URL to verify hotkeys and cache headers. Diffs no longer uses cron-driven cache warming; the authenticated OS Diffs gateway serves live workspace-scoped data.

Runtime state and logs stay local:

```text
~/.consuelo/state/cron_jobs.json
~/.consuelo/logs/cron_jobs.log
```

