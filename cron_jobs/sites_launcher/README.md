# sites-launcher

Refreshes the Consuelo Sites root launcher through the same local cron surface as the diff cockpit cache warmer.

The job runs `consuelo-design refresh`, then requests the public launcher URL and verifies the numeric hotkeys plus cache-control header. Runtime state stays in `~/.consuelo/state/cron_jobs.json`.
