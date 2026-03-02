#!/usr/bin/env bash
# db-restore.sh — restore railway postgres from a backup file
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
BACKUP_DIR="$REPO_ROOT/.agent/backups"

# no args: list available backups and print usage
if [[ $# -eq 0 ]]; then
  echo "usage: bash scripts/db-restore.sh <backup-file> [--force]"
  echo ""
  if compgen -G "$BACKUP_DIR/backup-*.sql.gz" > /dev/null 2>&1; then
    echo "available backups:"
    ls -lht "$BACKUP_DIR"/backup-*.sql.gz | awk '{print "  " $NF " (" $5 ")"}'
  else
    echo "no backups found in .agent/backups/"
  fi
  exit 0
fi

BACKUP_FILE="$1"
FORCE="${2:-}"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "error: file not found: $BACKUP_FILE" >&2
  exit 1
fi

# resolve DATABASE_PUBLIC_URL
if [[ -z "${DATABASE_PUBLIC_URL:-}" ]]; then
  if [[ -f "$REPO_ROOT/.agent/config.sh" ]]; then
    # shellcheck source=/dev/null
    source "$REPO_ROOT/.agent/config.sh"
  fi
fi

if [[ -z "${DATABASE_PUBLIC_URL:-}" ]]; then
  echo "error: DATABASE_PUBLIC_URL is not set and .agent/config.sh did not provide it" >&2
  exit 1
fi

SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
# mask password in url for display
MASKED_URL="$(echo "$DATABASE_PUBLIC_URL" | sed 's|://[^:]*:[^@]*@|://***:***@|')"

echo "restore details:"
echo "  file: $BACKUP_FILE ($SIZE)"
echo "  target: $MASKED_URL"
echo ""

if [[ "$FORCE" != "--force" ]]; then
  echo "this will overwrite the current database. continue? (y/n)"
  read -r CONFIRM
  if [[ "$CONFIRM" != "y" ]]; then
    echo "restore cancelled."
    exit 0
  fi
fi

echo "restoring database ..."

if ! gunzip -c "$BACKUP_FILE" | psql "$DATABASE_PUBLIC_URL" --single-transaction -q; then
  echo "error: restore failed" >&2
  exit 1
fi

echo "restore complete from $BACKUP_FILE"
