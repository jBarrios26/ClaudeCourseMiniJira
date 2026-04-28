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

## Session 2 — 2026-04-27

### `backend/src/routes/tickets.ts` — GET y POST implementados

**`GET /tickets`**
- Validación estricta de query params con Zod: `status`, `priority`, `assignee_id`, `label_id`, `from`/`to` (`YYYY-MM-DD`), `is_archived`
- `is_archived=true` requiere rol admin → `403` si no
- Filtro por `label_id` resuelto en pre-query separada (evita `selectDistinct` y N+1)
- Query principal: `LEFT JOIN` doble a `users` con alias (`assigneeUser`, `creatorUser`)
- Labels cargados en un segundo query con `inArray` sobre los IDs resultado
- Try-catch: traza solo en `console.error`, cliente recibe `{ error: 'Internal server error' }`

**`POST /tickets`**
- Validación Zod: `title` (min 1, max 120), defaults `status=to_do` / `priority=medium`, `label_ids[]`
- Flujo: insert ticket → insert `ticket_labels` (si aplica) → `fetchFullTicket`
- `fetchFullTicket` usa **`Promise.all`** para ejecutar en paralelo la query del ticket (con aliases) y la query de labels
- Responde `201` con objeto completo según spec

**Decisiones de diseño**
- `alias` importado de `drizzle-orm/sqlite-core` para joins dobles a la misma tabla
- `unixNow()` helper para timestamps en segundos
- Stubs `501` preservados para `GET /:id`, `PATCH /:id`, `PATCH /:id/archive`, `PATCH /:id/restore`
- `tsc --noEmit` pasa sin errores

## Pending

- Run `npm run db:push` inside `backend/` to apply the schema to the SQLite database (intentionally left to the user).
- `middleware/auth.ts` — implementar verify JWT (actualmente llama `next()` sin validar)
- `middleware/requireAdmin.ts` — implementar check de rol
- `routes/tickets.ts` — `GET /:id`, `PATCH /:id` (optimistic lock), `PATCH /:id/archive`, `PATCH /:id/restore`
- `routes/auth.ts` — `POST /auth/login`
- `routes/users.ts` — CRUD completo
- `routes/labels.ts` — GET / POST / DELETE
- `routes/comments.ts` — GET / POST
- `routes/dashboard.ts` — GET dashboard
- `routes/metrics.ts` — GET metrics + GET metrics/export (CSV)
- `lib/csv.ts` — implementar `buildMetricsCsv`
