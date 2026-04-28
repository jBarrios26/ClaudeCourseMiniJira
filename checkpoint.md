# Session Checkpoint — 2026-04-27

## What was done

### `backend/src/db/schema.ts` — Drizzle ORM schema (complete)

Generated the full Drizzle ORM schema from `docs/database-schema.yaml`.

**Tables defined:**
- `users` — team members with role (`user` | `admin`), hashed password, timestamps
- `tickets` — Kanban work items with status, priority, assignee, optimistic-lock `version`, soft-delete via `is_archived` / `archived_at`
- `labels` — reusable tags (unique name)
- `ticket_labels` — many-to-many junction (composite PK: `ticket_id` + `label_id`)
- `comments` — append-only; comment preserved if author is deleted (`SET NULL`)

**Foreign keys & onDelete:**
| FK | Behavior |
|---|---|
| `tickets.assignee_id → users.id` | SET NULL |
| `tickets.created_by → users.id` | SET NULL |
| `ticket_labels.ticket_id → tickets.id` | CASCADE |
| `ticket_labels.label_id → labels.id` | CASCADE |
| `comments.ticket_id → tickets.id` | CASCADE |
| `comments.author_id → users.id` | SET NULL |

**Indexes added (were missing from the initial file):**
| Table | Column | Reason |
|---|---|---|
| `tickets` | `status` | board filtering |
| `tickets` | `assignee_id` | filtering + metrics |
| `tickets` | `created_at` | date-range queries |
| `tickets` | `is_archived` | default board filter |
| `ticket_labels` | `label_id` | filter tickets by label |
| `comments` | `ticket_id` | fetch comments per ticket |

## Pending

- Run `npm run db:push` inside `backend/` to apply the schema to the SQLite database (intentionally left to the user).
- Backend routes (`src/routes/`) not yet implemented.
