# Vitest Unit Test Suite — Implementation Result

**Date:** 2026-04-29  
**Status:** ✅ 42/42 passing — 0 failures  
**Runtime:** ~577ms (no real DB connections)

---

## Final Test Run

```
 Test Files  6 passed (6)
      Tests  42 passed (42)
   Start at  19:15:42
   Duration  577ms (transform 666ms, setup 85ms, import 2.59s, tests 138ms)
```

---

## Coverage by File

| File | Suite | Tests | Gherkin |
|---|---|---|---|
| `auth.test.ts` | POST /auth/login | 3 | US-01 |
| `tickets.test.ts` | GET /tickets, POST /tickets, GET /tickets/:id, PATCH /tickets/:id, PATCH /tickets/:id/archive | 15 | US-02, US-03, EC-02 |
| `users.test.ts` | GET /users, POST /users | 6 | — |
| `labels.test.ts` | GET /labels, POST /labels, DELETE /labels/:id | 9 | — |
| `comments.test.ts` | GET /tickets/:id/comments, POST /tickets/:id/comments | 6 | — |
| `dashboard.test.ts` | GET /dashboard | 3 | — |
| **Total** | **13 endpoints** | **42 tests** | |

Each endpoint has exactly **3 tests**: Happy Path · Validation Error · Critical Edge Case.

---

## Test Structure

Every test follows Given / When / Then with inline comments:

```typescript
it('Edge Case (US-03): version mismatch → 409 conflict with last updater info', async () => {
  // Given — DB has version 4; admin sends stale version 3
  vi.mocked(db.select).mockReturnValueOnce(makeChain([{
    ...ticketRow, version: 4, createdById: 99, createdByName: 'User B',
  }]));

  // When
  const res = await request(app)
    .patch('/tickets/42')
    .set('Authorization', adminHeader)
    .send({ version: 3, title: 'Stale edit' });

  // Then
  expect(res.status).toBe(409);
  expect(res.body).toEqual({ error: 'conflict', updatedById: 99, updatedByName: 'User B' });
});
```

---

## Files Created / Modified

| Action | Path |
|---|---|
| CREATED | `src/app.ts` — Express app factory (no dotenv, no .listen) |
| MODIFIED | `src/index.ts` — now imports app and calls .listen |
| CREATED | `vitest.config.ts` — globals, node env, setupFiles |
| CREATED | `src/__tests__/setup.ts` — sets JWT_SECRET before any module loads |
| CREATED | `src/__tests__/helpers/mockDb.ts` — Drizzle chain mock utilities |
| CREATED | `src/__tests__/auth.test.ts` |
| CREATED | `src/__tests__/tickets.test.ts` |
| CREATED | `src/__tests__/users.test.ts` |
| CREATED | `src/__tests__/labels.test.ts` |
| CREATED | `src/__tests__/comments.test.ts` |
| CREATED | `src/__tests__/dashboard.test.ts` |
| MODIFIED | `package.json` — added `test` and `test:watch` scripts, vitest + supertest deps |

---

## Architecture Decisions

### 1. `src/app.ts` split
`index.ts` previously mixed app creation with `dotenv/config` and `.listen()`. Tests need the Express app without starting a real server. The fix: extract the app to `src/app.ts` (no dotenv, no listen); `index.ts` handles boot.

### 2. Drizzle mock via Proxy thenable (`makeChain`)
Drizzle queries are fluent chains (`db.select(cols).from(t).where(...)`). Any method call must return a chainable object; the final `await` resolves the value. A Proxy intercepts every property access — methods return the same proxy, `.then` resolves the configured fixture.

```typescript
export function makeChain<T>(result: T): any {
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === 'then')
        return (onFulfilled) => Promise.resolve(result).then(onFulfilled);
      return (..._args) => proxy;   // any method → same proxy
    },
  };
  const proxy: any = new Proxy({}, handler);
  return proxy;
}
```

For constraint errors (409 duplicate), `makeRejectedChain(error)` rejects the chain with a `SQLITE_CONSTRAINT_UNIQUE` error that the route's inner try/catch already handles.

### 3. `mockReturnValueOnce` for sequential DB calls
Handlers that call `db.select` multiple times (e.g. `GET /tickets` fires `Promise.all([select, select])`) are handled by chaining `mockReturnValueOnce` in the exact call order declared in the route source:

```typescript
vi.mocked(db.select)
  .mockReturnValueOnce(makeChain(ticketRows))   // 1st call — TICKET_SELECT
  .mockReturnValueOnce(makeChain(labelRows));    // 2nd call — ticketLabels join
```

### 4. Real JWT, mocked bcrypt
The `authenticate` middleware does a real `jwt.verify`. Tests generate tokens with `jwt.sign({...}, 'test-secret')` — matching `JWT_SECRET = 'test-secret'` set in `setup.ts`. No JWT mocking needed.  
`bcryptjs` is mocked in `auth.test.ts` and `users.test.ts` to avoid the ~100ms cost of the real hash.

### 5. `vi.mock` path resolution
`vi.mock('../db/client')` in `src/__tests__/*.test.ts` resolves to `src/db/client.ts` — the same absolute path that all route files import. Vitest replaces the module once; every handler that imports `db` receives the mocked version automatically.

---

## Known Limitation

**Zod `"Required"` vs custom message:** `z.string().min(1, 'Title is required')` fires the custom message only when the field is present but empty. A completely absent field returns Zod's default `"Required"`. The edge case test for US-02 sends `title: ""` to exercise the custom message from the Gherkin scenario.

---

## How to Run

```bash
cd jira-clone/backend

# Single run with verbose output
npm test

# Watch mode during development
npm run test:watch
```
