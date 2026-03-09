#!/bin/bash
cd /Users/kokayi/Dev/opensaas/packages/consuelo-website
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
exec bun run astro dev --host 0.0.0.0 --port 4321
