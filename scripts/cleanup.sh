#!/bin/bash
# cleanup.sh — truncate test tables in FK-safe order and wipe tmp/.
# Usage: ./scripts/cleanup.sh [--dry-run]
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"
TMP_DIR="$SCRIPT_DIR/../tmp"
DRY_RUN=false

for arg in "$@"; do
  [[ "$arg" == "--dry-run" ]] && DRY_RUN=true
done

# ── Resolve DB path ──────────────────────────────────────────────────────────
DATABASE_URL="$(grep '^DATABASE_URL=' "$BACKEND_DIR/.env" 2>/dev/null | head -1 | cut -d'=' -f2-)"
DB_PATH="${DATABASE_URL:-./dev.db}"
[[ "$DB_PATH" != /* ]] && DB_PATH="$BACKEND_DIR/$DB_PATH"

# ── SQL: truncate in FK-safe order (children before parents) ─────────────────
SQL="DELETE FROM comments;
DELETE FROM ticket_labels;
DELETE FROM tickets;
DELETE FROM labels;
DELETE FROM projects;
DELETE FROM users;
DELETE FROM sqlite_sequence
  WHERE name IN ('comments','ticket_labels','tickets','labels','projects','users');"

# ── Dry-run: preview only ─────────────────────────────────────────────────────
if $DRY_RUN; then
  echo "=== DRY RUN — would execute against: $DB_PATH ==="
  echo "$SQL"
  echo ""
  echo "=== DRY RUN — would delete files in: $TMP_DIR/ ==="
  if [[ -d "$TMP_DIR" ]]; then
    FILE_COUNT="$(find "$TMP_DIR" -type f | wc -l | tr -d ' ')"
    echo "  Files to delete: $FILE_COUNT"
    find "$TMP_DIR" -type f | head -20
  else
    echo "  (tmp/ does not exist — nothing to clean)"
  fi
  echo "=== DRY RUN complete — nothing modified ==="
  exit 0
fi

# ── Truncate tables ───────────────────────────────────────────────────────────
command -v sqlite3 >/dev/null 2>&1 || { echo "ERROR: sqlite3 CLI not found"; exit 1; }

if [[ -f "$DB_PATH" ]]; then
  echo "==> Truncating tables in $DB_PATH..."
  echo "$SQL" | sqlite3 "$DB_PATH"

  # Confirm row counts are zero
  REMAINING="$(sqlite3 "$DB_PATH" \
    "SELECT 'users='||count(*) FROM users UNION ALL
     SELECT 'projects='||count(*) FROM projects UNION ALL
     SELECT 'tickets='||count(*) FROM tickets UNION ALL
     SELECT 'labels='||count(*) FROM labels UNION ALL
     SELECT 'ticket_labels='||count(*) FROM ticket_labels UNION ALL
     SELECT 'comments='||count(*) FROM comments;")"
  echo "  Row counts after truncation:"
  echo "$REMAINING" | sed 's/^/    /'
else
  echo "  WARNING: DB not found at '$DB_PATH' — skipping table truncation"
fi

# ── Clean tmp/ ────────────────────────────────────────────────────────────────
echo "==> Cleaning tmp/..."
if [[ -d "$TMP_DIR" ]]; then
  FILE_COUNT="$(find "$TMP_DIR" -type f | wc -l | tr -d ' ')"
  find "$TMP_DIR" -type f -delete
  echo "  Deleted $FILE_COUNT file(s) from tmp/"
else
  echo "  tmp/ does not exist — skipping"
fi

echo ""
echo "Cleanup complete."
