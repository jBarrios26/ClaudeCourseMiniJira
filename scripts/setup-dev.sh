#!/bin/bash
# setup-dev.sh — install deps, bootstrap .env, run Drizzle migrations, verify DB.
# Usage: ./scripts/setup-dev.sh [--dry-run]
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"
FRONTEND_DIR="$SCRIPT_DIR/../frontend"
DRY_RUN=false

for arg in "$@"; do
  [[ "$arg" == "--dry-run" ]] && DRY_RUN=true
done

# Helper: print-only in dry-run mode, execute otherwise
run() {
  if $DRY_RUN; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

# ── 1. Backend dependencies ──────────────────────────────────────────────────
echo "==> [1/4] Installing backend dependencies (pnpm)..."
if $DRY_RUN; then
  echo "[dry-run] cd $BACKEND_DIR && pnpm install"
else
  cd "$BACKEND_DIR" && pnpm install
fi

# ── 2. Frontend dependencies ─────────────────────────────────────────────────
echo "==> [2/4] Installing frontend dependencies (pnpm)..."
if $DRY_RUN; then
  echo "[dry-run] cd $FRONTEND_DIR && pnpm install"
else
  cd "$FRONTEND_DIR" && pnpm install
fi

# ── 3. Bootstrap backend .env ────────────────────────────────────────────────
echo "==> [3/4] Configuring backend .env..."

if [[ -f "$BACKEND_DIR/.env" ]]; then
  echo "  .env already exists — skipping (idempotent)"
else
  if $DRY_RUN; then
    echo "[dry-run] cp $BACKEND_DIR/.env.example $BACKEND_DIR/.env"
    echo "[dry-run] Generate and inject JWT_SECRET via node crypto"
  else
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"

    # Generate a strong JWT secret using Node's built-in crypto module
    JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")"

    # sed -i.bak works on both macOS (BSD sed) and Linux (GNU sed)
    sed -i.bak "s|^JWT_SECRET=$|JWT_SECRET=${JWT_SECRET}|" "$BACKEND_DIR/.env"
    rm -f "$BACKEND_DIR/.env.bak"

    echo "  .env created with a generated JWT_SECRET"
    echo "  Review $BACKEND_DIR/.env and adjust as needed"
  fi
fi

# ── 4. Drizzle migrations ────────────────────────────────────────────────────
echo "==> [4/4] Running Drizzle migrations (drizzle-kit migrate)..."
if $DRY_RUN; then
  echo "[dry-run] cd $BACKEND_DIR && pnpm run db:migrate"
else
  cd "$BACKEND_DIR" && pnpm run db:migrate
fi

# ── Smoke-test: verify DB responds ──────────────────────────────────────────
if ! $DRY_RUN; then
  command -v sqlite3 >/dev/null 2>&1 || {
    echo "WARNING: sqlite3 CLI not found — skipping DB smoke-test"
    echo "Setup complete. Run scripts/seed.sh to populate dev data."
    exit 0
  }

  DATABASE_URL="$(grep '^DATABASE_URL=' "$BACKEND_DIR/.env" 2>/dev/null | head -1 | cut -d'=' -f2-)"
  DB_PATH="${DATABASE_URL:-./dev.db}"
  [[ "$DB_PATH" != /* ]] && DB_PATH="$BACKEND_DIR/$DB_PATH"

  echo ""
  echo "==> Smoke-testing DB at $DB_PATH..."
  TABLE_COUNT="$(sqlite3 "$DB_PATH" "SELECT count(*) FROM sqlite_master WHERE type='table';")"
  echo "  Tables found : $TABLE_COUNT"

  [[ "$TABLE_COUNT" -gt 0 ]] || {
    echo "ERROR: No tables found — migrations may have failed."
    exit 1
  }

  # List created tables for confirmation
  echo "  Tables       :"
  sqlite3 "$DB_PATH" "SELECT '    - ' || name FROM sqlite_master WHERE type='table' ORDER BY name;"
  echo "  DB is responding."
fi

echo ""
echo "Setup complete. Next: run scripts/seed.sh to populate dev data."
