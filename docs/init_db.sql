-- =============================================================
-- Mini Jira — PostgreSQL 16 DDL
-- Derived from specs.md §2 and ADR-001
-- =============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- ENUMS
-- =============================================================

CREATE TYPE user_role     AS ENUM ('user', 'admin');
CREATE TYPE ticket_status AS ENUM ('to_do', 'in_progress', 'in_review', 'done');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high');

-- =============================================================
-- USERS
-- =============================================================

CREATE TABLE users (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(100) NOT NULL,
    email        VARCHAR(254) NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    role         user_role    NOT NULL DEFAULT 'user',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    -- Soft removal: when a user is removed their FK references become NULL
    -- (handled by ON DELETE SET NULL on tickets/comments), but we keep
    -- the row so audit history remains readable.
    removed_at   TIMESTAMPTZ
);

-- =============================================================
-- REFRESH TOKENS
-- =============================================================

CREATE TABLE refresh_tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT        NOT NULL UNIQUE,   -- store bcrypt/sha256 hash, never plaintext
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- =============================================================
-- LABELS
-- =============================================================

CREATE TABLE labels (
    id         SERIAL      PRIMARY KEY,
    name       VARCHAR(50) NOT NULL UNIQUE
);

-- =============================================================
-- TICKETS
-- =============================================================

CREATE TABLE tickets (
    id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(120)     NOT NULL,
    description TEXT,                                          -- markdown
    status      ticket_status    NOT NULL DEFAULT 'to_do',
    priority    ticket_priority  NOT NULL DEFAULT 'medium',
    assignee_id UUID             REFERENCES users(id) ON DELETE SET NULL,
    created_by  UUID             REFERENCES users(id) ON DELETE SET NULL,
    -- Optimistic locking (§2.5 / ADR-001):
    --   UPDATE tickets SET ..., version = version + 1
    --   WHERE id = :id AND version = :client_version
    --   → 0 rows affected → HTTP 409
    version     INTEGER          NOT NULL DEFAULT 1,
    archived_at TIMESTAMPTZ,                                   -- NULL = active (§2.4)
    created_at  TIMESTAMPTZ      NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ      NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_status      ON tickets(status)       WHERE archived_at IS NULL;
CREATE INDEX idx_tickets_priority    ON tickets(priority)     WHERE archived_at IS NULL;
CREATE INDEX idx_tickets_assignee_id ON tickets(assignee_id)  WHERE archived_at IS NULL;
CREATE INDEX idx_tickets_created_by  ON tickets(created_by);
CREATE INDEX idx_tickets_archived_at ON tickets(archived_at);
CREATE INDEX idx_tickets_created_at  ON tickets(created_at);
CREATE INDEX idx_tickets_updated_at  ON tickets(updated_at);

-- =============================================================
-- TICKET ↔ LABEL  (many-to-many)
-- =============================================================

CREATE TABLE ticket_labels (
    ticket_id UUID    NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    label_id  INTEGER NOT NULL REFERENCES labels(id)  ON DELETE CASCADE,
    PRIMARY KEY (ticket_id, label_id)
);

CREATE INDEX idx_ticket_labels_label_id ON ticket_labels(label_id);

-- =============================================================
-- COMMENTS  (append-only per §2.7)
-- =============================================================

CREATE TABLE comments (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id  UUID        NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author_id  UUID        REFERENCES users(id) ON DELETE SET NULL,
    body       TEXT        NOT NULL,                           -- markdown; may contain @mentions
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_ticket_id ON comments(ticket_id);
CREATE INDEX idx_comments_author_id ON comments(author_id);

-- =============================================================
-- TICKET HISTORY  (audit trail §2.4)
-- One row per changed field per save operation.
-- =============================================================

CREATE TABLE ticket_history (
    id          BIGSERIAL   PRIMARY KEY,
    ticket_id   UUID        NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    changed_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    field_name  VARCHAR(50) NOT NULL,
    old_value   TEXT,
    new_value   TEXT,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_history_ticket_id  ON ticket_history(ticket_id);
CREATE INDEX idx_ticket_history_changed_at ON ticket_history(changed_at);

-- =============================================================
-- updated_at auto-maintenance trigger
-- =============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
