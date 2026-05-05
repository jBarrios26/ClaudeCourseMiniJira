#!/bin/bash
# seed.sh — inserts 2 projects, 3 users, 5 tickets with varied status.
# Truncates tables in FK-safe order before inserting (idempotent).
# Usage: ./scripts/seed.sh [--dry-run]
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"
DRY_RUN=false

for arg in "$@"; do
  [[ "$arg" == "--dry-run" ]] && DRY_RUN=true
done

# ── Resolve DB path from .env (falls back to .env.example, then default) ────
ENV_FILE="$BACKEND_DIR/.env"
[[ -f "$ENV_FILE" ]] || ENV_FILE="$BACKEND_DIR/.env.example"
DATABASE_URL="$(grep '^DATABASE_URL=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2-)"
DB_PATH="${DATABASE_URL:-./dev.db}"
[[ "$DB_PATH" != /* ]] && DB_PATH="$BACKEND_DIR/$DB_PATH"

# ── Pre-flight checks ────────────────────────────────────────────────────────
command -v sqlite3 >/dev/null 2>&1 || {
  echo "ERROR: sqlite3 CLI not found. Install via: brew install sqlite3"
  exit 1
}
command -v node >/dev/null 2>&1 || { echo "ERROR: node not found"; exit 1; }

if ! $DRY_RUN; then
  [[ -f "$DB_PATH" ]] || {
    echo "ERROR: DB not found at '$DB_PATH'. Run setup-dev.sh first."
    exit 1
  }
  [[ -d "$BACKEND_DIR/node_modules" ]] || {
    echo "ERROR: node_modules missing in backend/. Run setup-dev.sh first."
    exit 1
  }
fi

# ── Generate bcrypt hashes at runtime via project's bcryptjs ────────────────
# (avoids hardcoding and keeps hashes tied to the installed lib version)
echo "==> Generating password hashes..."
cd "$BACKEND_DIR"
HASH_ADMIN="$(node -e "const b=require('bcryptjs');console.log(b.hashSync('admin123',10))")"
HASH_USER="$(node  -e "const b=require('bcryptjs');console.log(b.hashSync('test123',10))")"

TS="$(date +%s)"

# ── Build SQL ────────────────────────────────────────────────────────────────
# Uses a double-quoted bash string so ${VAR} expands exactly once.
# bcrypt hashes ($2b$10$...) are safe inside SQL single quotes — no special chars.
SQL="-- ── Truncate in FK-safe order (children before parents) ────────────────
DELETE FROM comments;
DELETE FROM ticket_labels;
DELETE FROM tickets;
DELETE FROM labels;
DELETE FROM projects;
DELETE FROM users;
DELETE FROM sqlite_sequence
  WHERE name IN ('comments','ticket_labels','tickets','labels','projects','users');

-- ── Users: 1 admin + 2 regular ──────────────────────────────────────────────
INSERT INTO users (name, email, password_hash, role, created_at) VALUES
  ('Admin User', 'admin@example.com', '${HASH_ADMIN}', 'admin', ${TS}),
  ('Alice Dev',  'alice@example.com', '${HASH_USER}',  'user',  ${TS}),
  ('Bob Tester', 'bob@example.com',   '${HASH_USER}',  'user',  ${TS});

-- ── Projects: 2 ──────────────────────────────────────────────────────────────
INSERT INTO projects (name, description, created_at, updated_at) VALUES
  ('Frontend Revamp', 'Redesign of the customer-facing web app', ${TS}, ${TS}),
  ('API Gateway',     'REST API gateway for microservices',      ${TS}, ${TS});

-- ── Tickets: 5 with varied status ────────────────────────────────────────────
-- Columns: title, description, status, priority, assignee_id, created_by,
--          project_id, version, is_archived, created_at, updated_at
INSERT INTO tickets
  (title, description, status, priority, assignee_id, created_by,
   project_id, version, is_archived, created_at, updated_at)
VALUES
  ('Setup CI/CD pipeline',
   'Configure GitHub Actions for lint, test and deploy',
   'done',        'high',   1, 1, 1, 1, 0, ${TS}, ${TS}),
  ('Design login screen',
   'Figma mockups and React implementation',
   'in_review',   'medium', 2, 2, 1, 1, 0, ${TS}, ${TS}),
  ('Implement JWT auth',
   'Express middleware and token validation',
   'in_progress', 'high',   1, 1, 2, 1, 0, ${TS}, ${TS}),
  ('Write unit tests for auth',
   'Vitest coverage for all auth routes',
   'to_do',       'medium', 3, 3, 2, 1, 0, ${TS}, ${TS}),
  ('Document API endpoints',
   'Write OpenAPI spec for all routes',
   'to_do',       'low',    2, 1, 2, 1, 0, ${TS}, ${TS});"

# ── Execute or preview ────────────────────────────────────────────────────────
if $DRY_RUN; then
  echo ""
  echo "=== DRY RUN — SQL that would execute against: $DB_PATH ==="
  echo "$SQL"
  echo "=== DRY RUN complete — DB not modified ==="
  exit 0
fi

echo "==> Seeding $DB_PATH..."
echo "$SQL" | sqlite3 "$DB_PATH"

echo ""
echo "Seed complete."
echo "  Users    : admin@example.com / admin123  (role: admin)"
echo "             alice@example.com / test123   (role: user)"
echo "             bob@example.com   / test123   (role: user)"
echo "  Projects : Frontend Revamp, API Gateway"
echo "  Tickets  : done · in_review · in_progress · to_do · to_do"
