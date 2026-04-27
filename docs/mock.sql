-- =============================================================
-- Mini Jira — Mock Data
-- Run AFTER init_db.sql
-- Passwords are all "password123" (bcrypt placeholder hash shown)
-- =============================================================

BEGIN;

-- =============================================================
-- USERS  (2 admins, 5 regular members — ~10-person team)
-- =============================================================

INSERT INTO users (id, name, email, password_hash, role) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Laura Gómez',    'laura@company.internal',   '$2b$12$mockhashLAURA',   'admin'),
    ('00000000-0000-0000-0000-000000000002', 'Marcos Reyes',   'marcos@company.internal',  '$2b$12$mockhashMARCOS',  'admin'),
    ('00000000-0000-0000-0000-000000000003', 'Sofia Vargas',   'sofia@company.internal',   '$2b$12$mockhashSOFIA',   'user'),
    ('00000000-0000-0000-0000-000000000004', 'Roberto Núñez',  'roberto@company.internal', '$2b$12$mockhashROBERTO', 'user'),
    ('00000000-0000-0000-0000-000000000005', 'Ana Torres',     'ana@company.internal',     '$2b$12$mockhashANA',     'user'),
    ('00000000-0000-0000-0000-000000000006', 'Diego Castillo', 'diego@company.internal',   '$2b$12$mockhashDIEGO',   'user'),
    ('00000000-0000-0000-0000-000000000007', 'Valeria Ruiz',   'valeria@company.internal', '$2b$12$mockhashVALERIA', 'user');

-- =============================================================
-- LABELS
-- =============================================================

INSERT INTO labels (id, name) VALUES
    (1,  'bug'),
    (2,  'feature'),
    (3,  'blocked'),
    (4,  'backend'),
    (5,  'frontend'),
    (6,  'auth'),
    (7,  'database'),
    (8,  'dashboard'),
    (9,  'notifications'),
    (10, 'chore');

-- Reset sequence after explicit IDs
SELECT setval('labels_id_seq', 10);

-- =============================================================
-- TICKETS
-- =============================================================

INSERT INTO tickets (id, title, description, status, priority, assignee_id, created_by, version, archived_at) VALUES

    -- Active board tickets ---------------------------------------------------

    ('10000000-0000-0000-0000-000000000001',
     'Set up PostgreSQL schema and run initial migration',
     'Create all tables via Prisma migrate and verify the schema matches ADR-001.',
     'done', 'high',
     '00000000-0000-0000-0000-000000000002',  -- Marcos
     '00000000-0000-0000-0000-000000000002',
     3, NULL),

    ('10000000-0000-0000-0000-000000000002',
     'Implement JWT auth — access + refresh token flow',
     'Issue access tokens (15 min TTL) and refresh tokens (7 days). Store hashed refresh tokens in `refresh_tokens` table.',
     'in_review', 'high',
     '00000000-0000-0000-0000-000000000003',  -- Sofia
     '00000000-0000-0000-0000-000000000002',
     2, NULL),

    ('10000000-0000-0000-0000-000000000003',
     'Ticket CRUD API — create, read, update, archive',
     'REST endpoints: POST /tickets, GET /tickets/:id, PATCH /tickets/:id, DELETE /tickets/:id (soft-delete).\nInclude optimistic locking: reject update if version mismatch → HTTP 409.',
     'in_progress', 'high',
     '00000000-0000-0000-0000-000000000003',  -- Sofia
     '00000000-0000-0000-0000-000000000001',
     1, NULL),

    ('10000000-0000-0000-0000-000000000004',
     'Board view — Kanban columns by status',
     'Four columns: To Do / In Progress / In Review / Done. Drag-and-drop not required in v1; status change via dropdown.',
     'in_progress', 'medium',
     '00000000-0000-0000-0000-000000000004',  -- Roberto
     '00000000-0000-0000-0000-000000000001',
     1, NULL),

    ('10000000-0000-0000-0000-000000000005',
     'Dashboard — tickets closed per month (bar chart)',
     'Use `DATE_TRUNC(''month'', updated_at)` + `status = ''done''` aggregation. Render with Recharts BarChart.',
     'to_do', 'medium',
     '00000000-0000-0000-0000-000000000005',  -- Ana
     '00000000-0000-0000-0000-000000000001',
     1, NULL),

    ('10000000-0000-0000-0000-000000000006',
     'Dashboard — current ticket count by status (donut chart)',
     'Live count grouped by status for active (non-archived) tickets. Recharts PieChart.',
     'to_do', 'medium',
     '00000000-0000-0000-0000-000000000005',  -- Ana
     '00000000-0000-0000-0000-000000000001',
     1, NULL),

    ('10000000-0000-0000-0000-000000000007',
     'Email notification — ticket assigned to you',
     'Trigger via Resend when `assignee_id` changes. Include ticket title, excerpt, and deep link.',
     'to_do', 'medium',
     '00000000-0000-0000-0000-000000000006',  -- Diego
     '00000000-0000-0000-0000-000000000002',
     1, NULL),

    ('10000000-0000-0000-0000-000000000008',
     'Email notification — @mention in comment',
     'Parse comment body for @username patterns and send notification to each mentioned user.',
     'to_do', 'medium',
     '00000000-0000-0000-0000-000000000006',  -- Diego
     '00000000-0000-0000-0000-000000000002',
     1, NULL),

    ('10000000-0000-0000-0000-000000000009',
     'Metrics CSV export endpoint',
     'GET /metrics/export?from=YYYY-MM-DD&to=YYYY-MM-DD — returns `metrics-YYYY-MM-DD.csv`. Columns per §2.10.',
     'to_do', 'low',
     NULL,
     '00000000-0000-0000-0000-000000000001',
     1, NULL),

    ('10000000-0000-0000-0000-000000000010',
     'Role-based access control middleware',
     'Express middleware that reads JWT role claim and enforces §2.1 capability matrix. Return 403 on violation.',
     'in_progress', 'high',
     '00000000-0000-0000-0000-000000000007',  -- Valeria
     '00000000-0000-0000-0000-000000000002',
     2, NULL),

    ('10000000-0000-0000-0000-000000000011',
     'Ticket filter & search — status, priority, assignee, labels, date range',
     'Query params on GET /tickets. All filters are optional and combinable.',
     'to_do', 'medium',
     '00000000-0000-0000-0000-000000000004',  -- Roberto
     '00000000-0000-0000-0000-000000000001',
     1, NULL),

    ('10000000-0000-0000-0000-000000000012',
     'Optimistic locking — HTTP 409 conflict UI',
     'When API returns 409, show non-dismissible banner: "This ticket was updated by [user] while you were editing."',
     'to_do', 'medium',
     '00000000-0000-0000-0000-000000000003',  -- Sofia
     '00000000-0000-0000-0000-000000000001',
     1, NULL),

    -- Archived ticket --------------------------------------------------------

    ('10000000-0000-0000-0000-000000000013',
     '[SPIKE] Evaluate Slack webhook for notifications',
     'Brief investigation into Slack integration. Deferred — out of scope for v1 per §3.',
     'to_do', 'low',
     NULL,
     '00000000-0000-0000-0000-000000000002',
     1, now() - INTERVAL '5 days');

-- =============================================================
-- TICKET ↔ LABEL
-- =============================================================

INSERT INTO ticket_labels (ticket_id, label_id) VALUES
    ('10000000-0000-0000-0000-000000000001', 7),   -- database
    ('10000000-0000-0000-0000-000000000001', 10),  -- chore
    ('10000000-0000-0000-0000-000000000002', 6),   -- auth
    ('10000000-0000-0000-0000-000000000002', 4),   -- backend
    ('10000000-0000-0000-0000-000000000003', 2),   -- feature
    ('10000000-0000-0000-0000-000000000003', 4),   -- backend
    ('10000000-0000-0000-0000-000000000004', 2),   -- feature
    ('10000000-0000-0000-0000-000000000004', 5),   -- frontend
    ('10000000-0000-0000-0000-000000000005', 8),   -- dashboard
    ('10000000-0000-0000-0000-000000000005', 5),   -- frontend
    ('10000000-0000-0000-0000-000000000006', 8),   -- dashboard
    ('10000000-0000-0000-0000-000000000006', 5),   -- frontend
    ('10000000-0000-0000-0000-000000000007', 9),   -- notifications
    ('10000000-0000-0000-0000-000000000008', 9),   -- notifications
    ('10000000-0000-0000-0000-000000000009', 8),   -- dashboard
    ('10000000-0000-0000-0000-000000000010', 6),   -- auth
    ('10000000-0000-0000-0000-000000000010', 4),   -- backend
    ('10000000-0000-0000-0000-000000000010', 3),   -- blocked (pending auth ticket)
    ('10000000-0000-0000-0000-000000000011', 5),   -- frontend
    ('10000000-0000-0000-0000-000000000012', 5),   -- frontend
    ('10000000-0000-0000-0000-000000000012', 1),   -- bug
    ('10000000-0000-0000-0000-000000000013', 10);  -- chore

-- =============================================================
-- COMMENTS
-- =============================================================

INSERT INTO comments (id, ticket_id, author_id, body) VALUES

    ('20000000-0000-0000-0000-000000000001',
     '10000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002',
     'Migration ran cleanly on local. Verified all FK constraints are active. Moving to done.'),

    ('20000000-0000-0000-0000-000000000002',
     '10000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000003',
     'Access token and refresh token endpoints are working. PR is up for review.'),

    ('20000000-0000-0000-0000-000000000003',
     '10000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000002',
     'Reviewing now. One question: are we rotating the refresh token on every use (sliding window) or only on expiry?'),

    ('20000000-0000-0000-0000-000000000004',
     '10000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000003',
     'Rotating on every use — single-use refresh tokens. Updated the PR description.'),

    ('20000000-0000-0000-0000-000000000005',
     '10000000-0000-0000-0000-000000000003',
     '00000000-0000-0000-0000-000000000001',
     'Reminder: the 409 response body should include the `updated_by` user name so the frontend can show it in the conflict banner (§2.5).'),

    ('20000000-0000-0000-0000-000000000006',
     '10000000-0000-0000-0000-000000000003',
     '00000000-0000-0000-0000-000000000003',
     'Good catch @laura, will add `updatedByName` to the 409 payload.'),

    ('20000000-0000-0000-0000-000000000007',
     '10000000-0000-0000-0000-000000000010',
     '00000000-0000-0000-0000-000000000007',
     'This is blocked on the auth ticket (#002). Will pick it up as soon as the JWT PR is merged.'),

    ('20000000-0000-0000-0000-000000000008',
     '10000000-0000-0000-0000-000000000004',
     '00000000-0000-0000-0000-000000000004',
     'Columns rendering. Status change via dropdown is wired up. @sofia can you review the PATCH call once your API ticket is done?');

-- =============================================================
-- TICKET HISTORY  (audit trail for completed/updated tickets)
-- =============================================================

INSERT INTO ticket_history (ticket_id, changed_by, field_name, old_value, new_value, changed_at) VALUES

    -- Ticket 001: To Do → In Progress → Done
    ('10000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002',
     'status', 'to_do', 'in_progress',
     now() - INTERVAL '10 days'),

    ('10000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002',
     'status', 'in_progress', 'done',
     now() - INTERVAL '8 days'),

    -- Ticket 002: To Do → In Progress → In Review
    ('10000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000003',
     'status', 'to_do', 'in_progress',
     now() - INTERVAL '7 days'),

    ('10000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000003',
     'status', 'in_progress', 'in_review',
     now() - INTERVAL '2 days'),

    -- Ticket 002: assignee set by Marcos
    ('10000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000002',
     'assignee_id', NULL, '00000000-0000-0000-0000-000000000003',
     now() - INTERVAL '9 days'),

    -- Ticket 010: priority bumped to high; labeled blocked
    ('10000000-0000-0000-0000-000000000010',
     '00000000-0000-0000-0000-000000000002',
     'priority', 'medium', 'high',
     now() - INTERVAL '3 days');

COMMIT;
