#!/bin/bash
# start-brain.sh — starts the internal-brain mcp server
cd /Users/kokayi/Dev/opensaas/packages/internal-brain
export $(grep -v '^#' .env | xargs)
export PORT=8850
export MCP_SERVER_URL=https://picassos-mac-mini.tail38ed59.ts.net:8851
exec .venv/bin/python3 server.py
