# Vitest Unit Test Suite — P0 Endpoints

**Version:** 1.0  
**Date:** 2026-04-29  
**Scope:** Unit tests with mocked SQLite for all P0 endpoints  
**References:** `api-contract.md`, `backlog.md`, `test-plan.md`

---

## Context

The backend (Express 5 + Drizzle ORM + SQLite `better-sqlite3` + Zod + JWT) has no test setup today.  
This plan adds a Vitest unit suite that covers every P0 endpoint with **3 tests each** (Happy Path, Validation Error, Critical Edge Case from the Gherkin scenarios in `backlog.md`).  
**SQLite is never touched** — `db` from `src/db/client.ts` is fully mocked with `vi.mock()`.

---

## Architecture Overview

```
supertest HTTP request
    ↓
Express app (src/index.ts)
    ↓
route handler (src/routes/*.ts)
    ↓
vi.mock('../db/client')   ← intercepted here, Drizzle never runs
    ↓
mocked Proxy chain resolves the configured fixture value
```

**Token auth**: real `jsonwebtoken.sign()` with `JWT_SECRET = 'test-secret'` (set in setup file).  
**bcryptjs**: mocked in `auth.test.ts` only (avoids slow hashing in tests).  
**Drizzle chain mock**: a `makeChain(result)` Proxy — any method call returns itself; when `await`ed resolves to `result`. Supports `mockReturnValueOnce` for sequential calls in the same handler.

---

## Checklist

### Setup

- [ ] Install dev deps: `npm install --save-dev vitest supertest @types/supertest`
- [ ] Add `"test": "vitest run --reporter=verbose"` and `"test:watch": "vitest"` to `package.json`
- [ ] Create `vitest.config.ts` (globals, node environment, setupFiles)
- [ ] Create `src/__tests__/setup.ts` (set `JWT_SECRET`, `JWT_EXPIRES_IN`, `DATABASE_URL`)
- [ ] Create `src/__tests__/helpers/mockDb.ts` (`makeChain`, exported `mockDb` vi.fn() object)

### Auth

- [ ] `auth.test.ts` — POST /auth/login — Happy Path: valid credentials → 200 with `token` + `user`
- [ ] `auth.test.ts` — POST /auth/login — Validation: missing email field → 400
- [ ] `auth.test.ts` — POST /auth/login — Edge case (US-01): wrong password → 401 `"Invalid credentials"`

### Tickets — GET list

- [ ] `tickets.test.ts` — GET /tickets — Happy Path: authenticated → 200 array
- [ ] `tickets.test.ts` — GET /tickets — Validation: invalid `status` query param → 400
- [ ] `tickets.test.ts` — GET /tickets — Edge case: non-admin sends `is_archived=true` → 403

### Tickets — POST create (US-02)

- [ ] `tickets.test.ts` — POST /tickets — Happy Path: title + defaults → 201 complete ticket object
- [ ] `tickets.test.ts` — POST /tickets — Validation: title of 121 chars → 400 `"Title must be 120 characters or fewer"`
- [ ] `tickets.test.ts` — POST /tickets — Edge case: missing `title` → 400 `"Title is required"`

### Tickets — GET single

- [ ] `tickets.test.ts` — GET /tickets/:id — Happy Path: existing id → 200 ticket object
- [ ] `tickets.test.ts` — GET /tickets/:id — Validation: non-integer id → 404
- [ ] `tickets.test.ts` — GET /tickets/:id — Edge case: id not in DB → 404

### Tickets — PATCH (US-03 + EC-02)

- [ ] `tickets.test.ts` — PATCH /tickets/:id — Happy Path: correct version → 200, `version` incremented by 1
- [ ] `tickets.test.ts` — PATCH /tickets/:id — Validation: missing `version` field → 400
- [ ] `tickets.test.ts` — PATCH /tickets/:id — Edge case (US-03): `version` mismatch → 409 `{ error: "conflict", updatedById, updatedByName }`

### Tickets — PATCH archive

- [ ] `tickets.test.ts` — PATCH /tickets/:id/archive — Happy Path: own ticket → 200 `is_archived: true`
- [ ] `tickets.test.ts` — PATCH /tickets/:id/archive — Validation: ticket not found → 404
- [ ] `tickets.test.ts` — PATCH /tickets/:id/archive — Edge case: already archived → 409 `"Already archived"`

### Users

- [ ] `users.test.ts` — GET /users — Happy Path: authenticated → 200 array
- [ ] `users.test.ts` — GET /users — Validation: no `Authorization` header → 401
- [ ] `users.test.ts` — GET /users — Edge case: malformed/invalid token → 401
- [ ] `users.test.ts` — POST /users — Happy Path: admin creates user → 201
- [ ] `users.test.ts` — POST /users — Validation: missing required `name` → 400
- [ ] `users.test.ts` — POST /users — Edge case: duplicate email → 409

### Labels

- [ ] `labels.test.ts` — GET /labels — Happy Path: authenticated → 200 array
- [ ] `labels.test.ts` — GET /labels — Validation: no auth → 401
- [ ] `labels.test.ts` — GET /labels — Edge case: empty table → 200 `[]`
- [ ] `labels.test.ts` — POST /labels — Happy Path: new label → 201 `{ id, name }`
- [ ] `labels.test.ts` — POST /labels — Validation: empty `name` → 400
- [ ] `labels.test.ts` — POST /labels — Edge case: duplicate name → 409
- [ ] `labels.test.ts` — DELETE /labels/:id — Happy Path → 204
- [ ] `labels.test.ts` — DELETE /labels/:id — Validation: not found → 404
- [ ] `labels.test.ts` — DELETE /labels/:id — Edge case: no auth → 401

### Comments

- [ ] `comments.test.ts` — GET /tickets/:id/comments — Happy Path → 200 array ordered by `created_at`
- [ ] `comments.test.ts` — GET /tickets/:id/comments — Validation: no auth → 401
- [ ] `comments.test.ts` — GET /tickets/:id/comments — Edge case: ticket not found → 404
- [ ] `comments.test.ts` — POST /tickets/:id/comments — Happy Path → 201 comment object
- [ ] `comments.test.ts` — POST /tickets/:id/comments — Validation: empty `body` → 400
- [ ] `comments.test.ts` — POST /tickets/:id/comments — Edge case: ticket not found → 404

### Dashboard

- [ ] `dashboard.test.ts` — GET /dashboard — Happy Path: returns `tickets_by_status`, `closed_per_month`, `top_assignees`
- [ ] `dashboard.test.ts` — GET /dashboard — Validation: no auth → 401
- [ ] `dashboard.test.ts` — GET /dashboard — Edge case: all counts zero → 200 with valid zero-value structure

---

## Files to Create / Modify

| Action | Path |
|---|---|
| MODIFY | `backend/package.json` |
| CREATE | `backend/vitest.config.ts` |
| CREATE | `backend/src/__tests__/setup.ts` |
| CREATE | `backend/src/__tests__/helpers/mockDb.ts` |
| CREATE | `backend/src/__tests__/auth.test.ts` |
| CREATE | `backend/src/__tests__/tickets.test.ts` |
| CREATE | `backend/src/__tests__/users.test.ts` |
| CREATE | `backend/src/__tests__/labels.test.ts` |
| CREATE | `backend/src/__tests__/comments.test.ts` |
| CREATE | `backend/src/__tests__/dashboard.test.ts` |

---

## Test Structure Template

Each test follows Given / When / Then with comments:

```typescript
it('should return 409 when version is stale (US-03)', async () => {
  // Given — ticket at version 4 in DB, request sends version 3
  mockDb.select.mockReturnValueOnce(makeChain([{ ...ticketRow, version: 4, createdById: 99, createdByName: 'User B' }]));

  // When
  const res = await request(app)
    .patch('/tickets/42')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ version: 3, title: 'Stale edit' });

  // Then
  expect(res.status).toBe(409);
  expect(res.body).toEqual({ error: 'conflict', updatedById: 99, updatedByName: 'User B' });
});
```

---

## Verification

```bash
cd jira-clone/backend
npx vitest run --reporter=verbose
```

**Expected:** ≥ 39 tests passing, 0 failures, 0 real SQLite connections.

---

## Key Implementation Notes

1. **`vi.mock('../db/client')`** is hoisted — the resolved path `src/db/client.ts` is shared by all route imports, so all handlers receive the mock automatically.
2. **`Promise.all` handlers** (GET /tickets, POST /tickets, PATCH /tickets/:id) call `db.select` multiple times — use `mockReturnValueOnce` in the exact call order defined in the route source.
3. **`bcryptjs`** is only mocked in `auth.test.ts`; all other route tests don't touch it.
4. **Admin-required routes** (POST /users, PATCH /tickets/:id/restore) need a token signed with `role: 'admin'`.
5. **Duplicate-key 409s** (labels, users email) are triggered by making `db.insert` throw a SQLite unique constraint error: `throw Object.assign(new Error('UNIQUE constraint failed'), { code: 'SQLITE_CONSTRAINT_UNIQUE' })`.
