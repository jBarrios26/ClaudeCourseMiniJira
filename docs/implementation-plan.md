# Implementation Plan: Remaining Backend Endpoints

## Context

The backend has a full Express + Drizzle + SQLite stack with 2 working endpoints (`GET /tickets`, `POST /tickets`) and 18+ stubs returning 501. The middleware (`authenticate`, `requireAdmin`) is also unimplemented. The API contract in `docs/api-contract.md` is already complete and accurate — no updates needed.

---

## Implementation Order

### Step 1 — Middleware

**File:** `backend/src/middleware/auth.ts`

Implement `authenticate()`:
- Extract `Authorization: Bearer <token>` header
- Verify with `jwt.verify(token, process.env.JWT_SECRET!)`
- On success: attach `{ id, email, role }` to `req.user`, call `next()`
- On missing/invalid: `res.status(401).json({ error: 'Unauthorized' })`

**File:** `backend/src/middleware/requireAdmin.ts`

Implement `requireAdmin()`:
- Check `req.user?.role === 'admin'`
- On fail: `res.status(403).json({ error: 'Insufficient role' })`
- On pass: `next()`

---

### Step 2 — Auth (`backend/src/routes/auth.ts`)

**`POST /auth/login`** (no auth):
- Zod schema: `{ email: string, password: string }`
- Query user by email; 401 if not found
- `bcrypt.compare(password, user.password_hash)`; 401 if mismatch
- Sign JWT: `{ id, email, role }`, secret from `JWT_SECRET`, expiry from `JWT_EXPIRES_IN`
- Return `{ token, user: { id, name, email, role } }`

---

### Step 3 — Users (`backend/src/routes/users.ts`)

All routes use `authenticate`; write/delete routes add `requireAdmin`.

Response shape (no `password_hash`): `{ id, name, email, role, created_at }`

- **`GET /users`** — select all, order by `created_at ASC`
- **`GET /users/:id`** — single row; 404 if not found
- **`POST /users`** — Zod `{ name, email, password, role? }`. Hash with `bcrypt.hash(password, 10)`. Catch unique constraint → 409. Return 201 + user.
- **`PATCH /users/:id`** — Zod (all optional). Hash password if provided. Catch duplicate email → 409. Return 200 + updated user.
- **`DELETE /users/:id`** — 404 if not found. Delete row (FK `SET NULL` handles tickets). Return 204.

---

### Step 4 — Tickets (remaining stubs in `backend/src/routes/tickets.ts`)

Reuse existing `shapeTicket`, `TICKET_SELECT`, `assigneeUser`/`creatorUser` aliases, and `unixNow()`.

**`GET /tickets/:id`** (auth):
- Fetch ticket row + labels in parallel (same pattern as `POST /tickets` re-fetch)
- 404 if not found

**`PATCH /tickets/:id`** (auth):
- Zod: `{ version: number (required), title?, description?, status?, priority?, assignee_id?, label_ids? }`
- Fetch current ticket; 404 if missing
- If `role === 'user'` and `ticket.created_by !== req.user.id` → 403
- If `currentTicket.version !== body.version` → 409 `{ error: "conflict", updatedById, updatedByName }` (use `created_by` info as proxy since there is no `updated_by` column)
- Update fields, increment `version + 1`, set `updatedAt = unixNow()`
- If `label_ids` provided: delete existing `ticketLabels`, insert new ones
- Return 200 + shaped ticket

**`PATCH /tickets/:id/archive`** (auth):
- Fetch ticket; 404 if missing
- If `role === 'user'` and `ticket.created_by !== req.user.id` → 403
- If already archived → 409 `{ error: "Already archived" }`
- Set `isArchived = true`, `archivedAt = unixNow()`, `updatedAt = unixNow()`
- Return 200 + shaped ticket

**`PATCH /tickets/:id/restore`** (auth + requireAdmin):
- Fetch ticket; 404 if missing
- Set `isArchived = false`, `archivedAt = null`, `updatedAt = unixNow()`
- Return 200 + shaped ticket

---

### Step 5 — Labels (`backend/src/routes/labels.ts`)

- **`GET /labels`** (auth) — select all, order by `name ASC`
- **`POST /labels`** (auth) — Zod `{ name: string min 1 }`. Catch unique → 409. Return 201 + `{ id, name }`.
- **`DELETE /labels/:id`** (auth) — 404 if not found. Delete (cascade handles `ticket_labels`). Return 204.

---

### Step 6 — Comments (`backend/src/routes/comments.ts`)

**`GET /tickets/:id/comments`** (auth):
- Check ticket exists; 404 if not
- Select comments left-joined with users, ordered by `created_at ASC`
- Shape: `{ id, body, author: { id, name } | null, created_at }`

**`POST /tickets/:id/comments`** (auth):
- Check ticket exists; 404 if not
- Zod `{ body: string min 1 }`; 400 if empty
- Insert `{ ticketId, authorId: req.user.id, body, createdAt: unixNow() }`
- Return 201 + shaped comment

---

### Step 7 — Dashboard (`backend/src/routes/dashboard.ts`)

**`GET /dashboard`** (auth) — computed in real time:

1. **tickets_by_status** — `COUNT` grouped by `status` where `is_archived = false`
2. **closed_per_month** — `status = 'done'`, grouped by calendar month for last 12 months using `strftime('%Y-%m', datetime(updated_at, 'unixepoch'))` via Drizzle `sql` template
3. **top_assignees** — current month, `status = 'done'`, grouped by `assignee_id`, top 5, joined with users for name

---

### Step 8 — Metrics (`backend/src/routes/metrics.ts` + `backend/src/lib/csv.ts`)

**`GET /metrics`** (auth):
- Zod query: `{ from: YYYY-MM, to: YYYY-MM }` — both required
- Validate range ≤ 12 months; exact 400 error: `"Export range cannot exceed 12 months."`
- For each month in range return:
  - `tickets_created`: count where `created_at` falls in month
  - `tickets_closed`: count where `status = 'done'` and `updated_at` falls in month
  - `tickets_archived`: count where `archived_at` falls in month
  - `open_by_status`: count of non-archived tickets per status `[to_do, in_progress, in_review]`

**`GET /metrics/export`** (auth):
- Same query params and validation as `GET /metrics`
- Create `backend/src/lib/csv.ts` with `toCSV(rows)` helper
- Columns: `Month, Tickets Created, Tickets Closed (Done), Tickets Archived, Open To Do, Open In Progress, Open In Review`
- Response headers: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="metrics-{to}.csv"`

---

## API Contract Changes

**None required.** `docs/api-contract.md` is accurate and complete.

---

## Critical Files

| File | Action |
|------|--------|
| `backend/src/middleware/auth.ts` | Implement `authenticate()` |
| `backend/src/middleware/requireAdmin.ts` | Implement `requireAdmin()` |
| `backend/src/routes/auth.ts` | Implement `POST /auth/login` |
| `backend/src/routes/users.ts` | Implement all 5 user endpoints |
| `backend/src/routes/tickets.ts` | Implement 4 remaining stub endpoints |
| `backend/src/routes/labels.ts` | Implement all 3 label endpoints |
| `backend/src/routes/comments.ts` | Implement both comment endpoints |
| `backend/src/routes/dashboard.ts` | Implement `GET /dashboard` |
| `backend/src/routes/metrics.ts` | Implement `GET /metrics` and `GET /metrics/export` |
| `backend/src/lib/csv.ts` | Create CSV generation helper |

**Reuse from existing code:**
- `shapeTicket()`, `TICKET_SELECT`, `assigneeUser`/`creatorUser` aliases, `unixNow()` — `backend/src/routes/tickets.ts`
- `db` client — `backend/src/db/client.ts`
- All schema tables — `backend/src/db/schema.ts`
- `AuthRequest` type — `backend/src/middleware/auth.ts`

---

## Verification

1. Start backend: `npm run dev` from `backend/`
2. Seed a user via `npm run db:studio` or `init_db.sql`
3. Test `POST /auth/login` → get token
4. Test each endpoint group with `curl` or REST client using Bearer token
5. Verify optimistic locking: send `PATCH /tickets/:id` twice with same version → second must 409
6. Verify archive/restore cycle
7. Verify `GET /metrics/export` downloads `.csv` with correct columns
8. Verify `GET /dashboard` returns real counts after seeding tickets

---

## Implementation Results

**Completed:** 2026-04-28  
**TypeScript compile:** clean (`tsc --noEmit` exits with no errors)  
**Server startup:** confirmed — `Server running on http://localhost:3000`

### Files delivered

| File | Result |
|------|--------|
| `backend/src/middleware/auth.ts` | `authenticate()` — extracts Bearer token, verifies with `jwt.verify`, attaches `req.user`, returns 401 on failure |
| `backend/src/middleware/requireAdmin.ts` | `requireAdmin()` — checks `req.user.role === 'admin'`, returns 403 otherwise |
| `backend/src/routes/auth.ts` | `POST /auth/login` — Zod validation, bcryptjs compare, JWT sign with `JWT_SECRET`/`JWT_EXPIRES_IN` |
| `backend/src/routes/users.ts` | 5 endpoints fully implemented; password hashing via bcryptjs; SQLITE_CONSTRAINT_UNIQUE → 409 |
| `backend/src/routes/tickets.ts` | 4 stubs replaced: GET detail, PATCH with optimistic locking (version check → 409 conflict), archive (409 if already archived), restore |
| `backend/src/routes/labels.ts` | GET / POST / DELETE; unique constraint → 409; cascade delete handles `ticket_labels` |
| `backend/src/routes/comments.ts` | GET (ordered ASC) and POST; ticket-existence check before both; append-only |
| `backend/src/routes/dashboard.ts` | 3 parallel queries: status counts, closed-per-month (last 12mo via SQLite `strftime`), top-5 assignees this month |
| `backend/src/routes/metrics.ts` | GET + export; shared `fetchMetrics()` helper; per-month parallel queries; 12-month cap enforced |
| `backend/src/lib/csv.ts` | `buildMetricsCsv()` implemented (was a stub returning `''`) |

### Notable decisions

- **No `updated_by` column** — the 409 conflict response uses `created_by` as the proxy for `updatedById`/`updatedByName`, since the schema has no last-updater field.
- **`open_by_status` in metrics** — counts all currently non-archived tickets per status (live snapshot), not a point-in-time value, consistent with how the API contract describes it.
- **`isUniqueConstraintError`** — shared helper in users.ts and labels.ts checks for SQLite error code `SQLITE_CONSTRAINT_UNIQUE` to return 409 without catching unrelated errors.
- **API contract** — no changes required; the existing `docs/api-contract.md` was already accurate and complete.
