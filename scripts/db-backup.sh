#!/usr/bin/env bash
# db-backup.sh — snapshot railway postgres before migrations/schema changes
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
BACKUP_DIR="$REPO_ROOT/.agent/backups"

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

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y-%m-%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/backup-$TIMESTAMP.sql.gz"

echo "backing up database to $BACKUP_FILE ..."

if ! pg_dump "$DATABASE_PUBLIC_URL" --no-owner --no-acl | gzip > "$BACKUP_FILE"; then
  rm -f "$BACKUP_FILE"
  echo "error: pg_dump failed" >&2
  exit 1
fi

SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
echo "backup complete: $BACKUP_FILE ($SIZE)"

# prune old backups, keep last 5
ls -t "$BACKUP_DIR"/backup-*.sql.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
