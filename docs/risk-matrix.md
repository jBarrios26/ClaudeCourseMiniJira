# MVP Risk Matrix — 5 Critical Edge Cases

**Version:** 1.0
**Date:** 2026-04-20
**Author:** QA Lead
**Input sources:** specs.md v1.0, backlog.md v1.0

---

## Priority Scale

| Score | Likelihood | Impact | Priority |
|---|---|---|---|
| P0 | High | Critical | Ship blocker — must be resolved before release |
| P1 | Medium–High | High–Critical | Must be resolved before release |
| P2 | Medium | Medium–High | Must be resolved before release; workaround acceptable |
| P3 | Low | Medium | Target for v1.1; document workaround |

---

## Risk Matrix Overview

| # | Edge Case | Likelihood | Impact | Priority |
|---|---|---|---|---|
| R-01 | Parallel 401s trigger a refresh token race condition | High | Critical | **P0** |
| R-02 | TOCTOU gap in optimistic locking allows silent data loss | Medium | Critical | **P1** |
| R-03 | User deleted mid-session retains an active JWT | Medium | High | **P1** |
| R-04 | @mention in comment fires duplicate or missing email notifications | High | Medium | **P2** |
| R-05 | CSV export blocks the Node.js event loop on large date ranges | Medium | Medium | **P2** |

---

## R-01 — Parallel 401s Trigger a Refresh Token Race Condition

**Priority: P0 — Ship Blocker**

| Attribute | Detail |
|---|---|
| Likelihood | High — TanStack Query fires multiple parallel requests on every page load (board + dashboard + user list) |
| Impact | Critical — all parallel refresh attempts after the first one will fail, logging the user out silently |
| Affected stories | US-01, EC-01 |

### What breaks

TanStack Query often issues 3–5 concurrent API calls on a single route change. If the access token expires while the user is navigating, every one of those requests will simultaneously receive a 401 and each will independently attempt a `POST /auth/refresh`. If refresh tokens are rotated on use (the secure default), the first call consumes the refresh token and receives a new pair. The remaining concurrent calls send the now-invalidated refresh token and receive a second 401 — with no valid token to fall back to. The app interprets this as a fully expired session and redirects to `/login`, even though the user's session was technically still valid one millisecond earlier.

### Failure scenario

```
t=0   Requests A, B, C fire simultaneously with expired access token
t=1   A, B, C all receive HTTP 401
t=2   A sends POST /auth/refresh → succeeds, refresh token rotated
t=3   B sends POST /auth/refresh with old token → 401
t=4   C sends POST /auth/refresh with old token → 401
t=5   App logs user out. User loses all unsaved work.
```

### Recommended mitigation

Implement a **token refresh mutex** on the client: the first 401 acquires a lock and performs the refresh; all other concurrent 401 requests queue behind the lock and reuse the new token once it resolves. Only escalate to logout if the refresh itself returns 401.

---

## R-02 — TOCTOU Gap in Optimistic Locking Allows Silent Data Loss

**Priority: P1**

| Attribute | Detail |
|---|---|
| Likelihood | Medium — unlikely in normal use; near-certain under load or with scripted clients |
| Impact | Critical — one user's changes silently overwrite another's with no conflict detected |
| Affected stories | US-03 |

### What breaks

The spec implements optimistic locking at the **application layer**: the server reads the current version, compares it to the client-sent version, and increments it. If two PATCH requests reach the server simultaneously — both passing the version check before either has written — both updates are applied, and the second write silently clobbers the first. No 409 is returned. The version ends up at `n+1` instead of `n+2`, and one user's changes disappear permanently with no warning.

### Failure scenario

```
Ticket is at version 5.
t=0   Request A reads version 5 from DB → passes check
t=0   Request B reads version 5 from DB → passes check (before A writes)
t=1   Request A writes, sets version = 6
t=1   Request B writes, sets version = 6 (overwrites A silently)
Result: version = 6 but A's changes are lost. No 409 fired.
```

### Recommended mitigation

Replace the read-compare-write logic with an **atomic conditional update** at the database layer:

```sql
UPDATE tickets
SET title = $1, version = version + 1, updated_at = NOW()
WHERE id = $2 AND version = $3
RETURNING *;
```

If zero rows are returned, the version has already advanced — return HTTP 409. This makes the check and the write a single atomic operation, eliminating the race window entirely.

---

## R-03 — Deleted User Retains an Active JWT

**Priority: P1**

| Attribute | Detail |
|---|---|
| Likelihood | Medium — will happen every time a team member offboards |
| Impact | High — deleted user can still read all tickets, post comments, and trigger email notifications until their token expires |
| Affected stories | US-01, specs section 2.4 |

### What breaks

The spec states that when a user is removed, their assigned tickets become Unassigned. However, JWTs are stateless — the server has no built-in mechanism to invalidate an issued token before its expiry. If an admin deletes User X at 9:00 AM but User X has an access token valid until 9:15 AM, User X can continue making authenticated API calls for 15 minutes. Depending on the token TTL chosen (a currently unresolved open issue), this window could be longer.

### Failure scenario

```
Admin deletes User X at 09:00.
User X's access token expires at 09:15.
Between 09:00 and 09:15, User X can:
  - Read all active tickets (including sensitive ones)
  - Post comments that reference their now-deleted account
  - Trigger @mention email notifications to other users
```

### Recommended mitigation

Maintain a **token denylist** in Redis (or the PostgreSQL DB) keyed by `jti` (JWT ID claim). On user deletion, insert the user's active token JTIs into the denylist. The auth middleware checks the denylist on every request before trusting the token. Entries expire automatically after the token's natural TTL.

---

## R-04 — @mention Fires Duplicate or Missing Email Notifications

**Priority: P2**

| Attribute | Detail |
|---|---|
| Likelihood | High — comment creation is a fire-and-forget write; no idempotency mechanism is defined in the spec |
| Impact | Medium — users receive duplicate emails or miss mentions; does not corrupt data |
| Affected stories | specs section 2.8 |

### What breaks

The spec says email is triggered when a user is @mentioned in a comment. Two failure modes exist:

**Duplicate:** If the comment-creation endpoint is called twice due to a network retry (user double-clicks Submit, or TanStack Query retries on a timeout), two comment rows may be inserted and Resend fires twice. The user receives two identical notification emails.

**Missing:** If the email dispatch is done synchronously inside the HTTP request handler and the Resend API call times out or throws, the entire comment creation may fail or the email may be silently swallowed depending on error handling. The comment saves but no notification is sent.

### Failure scenario

```
User submits comment mentioning @Sofia.
Network is slow; client retries after 3 seconds.
Two comments are inserted.
Resend is called twice.
Sofia receives two identical emails for one comment.
```

### Recommended mitigation

1. Make comment creation **idempotent** using a client-generated `idempotencyKey` sent with every POST.
2. Decouple email dispatch from the HTTP request: write the comment synchronously, then enqueue the notification to a background job (a simple DB-backed queue is sufficient for 10 users). The HTTP response returns as soon as the comment is persisted, regardless of email delivery status.

---

## R-05 — CSV Export Blocks the Node.js Event Loop on Large Date Ranges

**Priority: P2**

| Attribute | Detail |
|---|---|
| Likelihood | Medium — low at launch (10-person team), grows over time as ticket volume accumulates |
| Impact | Medium — export endpoint becomes unresponsive; all other users experience degraded API performance during the export |
| Affected stories | specs section 2.10 |

### What breaks

The spec says the CSV is generated server-side and returned as a file download. If the selected date range covers a long history, the server must query a potentially large result set, serialize it to CSV, and hold the entire payload in memory before streaming the response. Node.js is single-threaded: a synchronous CSV serialization loop on a large dataset will block the event loop, delaying all other in-flight requests for every active user until the export finishes.

### Failure scenario

```
User selects "All time" date range and clicks Export.
Server queries 5,000 ticket rows.
Synchronous CSV serialization runs for ~800ms.
All other API calls (board refresh, comment post) are queued.
Other users see the UI freeze or requests time out.
```

### Recommended mitigation

1. In the short term: **cap the exportable date range** at 12 months server-side and return HTTP 400 if the range exceeds it — acceptable for a 10-person team at launch.
2. For durability: **stream the CSV** using Node.js streams and `res.write()` in chunks rather than building the full string in memory. This keeps the event loop responsive and also prevents memory spikes on large exports.

---

## Summary and Recommended Action Order

| Priority | Risk | Action before ship |
|---|---|---|
| P0 | R-01 Refresh token race | Implement client-side mutex; add E2E test with 5 parallel 401s |
| P1 | R-02 TOCTOU locking | Replace app-layer check with atomic SQL `WHERE version = $n` |
| P1 | R-03 Deleted user JWT | Add `jti` denylist checked in auth middleware; test offboarding flow |
| P2 | R-04 Duplicate @mention email | Add `idempotencyKey` to comment POST; move email dispatch to background queue |
| P2 | R-05 CSV event loop block | Cap date range at 12 months; move to streaming response |
