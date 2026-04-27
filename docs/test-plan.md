# Test Plan — Mini Jira MVP

**Version:** 1.1
**Date:** 2026-04-20
**Author:** QA Lead
**Source:** backlog.md v1.0, risk-matrix.md v1.0
**Scope:** US-01, US-02, US-03, EC-01, EC-02, R-01, R-02, R-03, R-04, R-05

---

## 1. Objectives

- Verify that every acceptance criterion defined in `backlog.md` is met before the MVP ships.
- Catch regressions introduced during iterative development.
- Validate edge-case behavior (session expiry, same-user tab conflicts) that is not covered by happy-path smoke tests.
- Verify mitigations for the five architectural risks identified in `risk-matrix.md`.

---

## 2. Scope

| In scope | Out of scope |
|---|---|
| Authentication (login, redirect, token issuance) | OAuth / SSO (deferred to v2) |
| Ticket creation validation | File attachments |
| Optimistic locking (multi-user and same-user) | Mobile / responsive layout |
| Session expiry and draft preservation | Dark mode |
| JWT refresh token silent exchange | Audit log UI |
| Refresh token race condition (R-01) | OAuth / SSO |
| TOCTOU optimistic locking (R-02) | File attachments |
| Deleted user JWT invalidation (R-03) | Mobile layout |
| @mention email idempotency (R-04) | — |
| CSV export event loop blocking (R-05) | — |

---

## 3. Test Environments

| Environment | Purpose | Notes |
|---|---|---|
| Local (dev) | Unit and integration tests | Runs against a local PostgreSQL instance via Docker |
| Staging | E2E and manual exploratory tests | Mirror of production config; seeded with fixture users |
| CI (GitHub Actions) | Automated gate on every PR | Runs unit + integration suites; E2E blocked on staging deploy |

---

## 4. Test Types and Ownership

| Type | Tooling | Who writes it | When it runs |
|---|---|---|---|
| Unit | Vitest (frontend), Jest (backend) | Dev | On every commit |
| Integration (API) | Supertest + real PostgreSQL | Dev + QA | On every PR |
| End-to-End (E2E) | Playwright | QA | On merge to `main` |
| Exploratory / Manual | — | QA Lead | Pre-release sprint |

---

## 5. Entry and Exit Criteria

### Entry criteria (before testing begins)
- Feature branch deployed to staging.
- Seed script has run successfully (at least one Admin and one User account exist).
- No P0 build failures in CI.

### Exit criteria (before marking a story Done)
- All test cases for the story are passing.
- No open Severity 1 or Severity 2 defects linked to the story.
- Exploratory session completed with no undocumented surprises.

---

## 6. Test Cases

Test cases are sorted by priority (P0 → P1 → P2). Cases within the same priority are grouped by story/risk.

---

### P0 — Ship Blockers

---

#### TC-01-01 · Successful login (US-01 — Happy Path)
- **Type:** E2E
- **Priority:** P0
- **Preconditions:** Staging DB has a seeded user with known credentials.
- **Steps:**
  1. Navigate to `/login`.
  2. Enter valid username and password.
  3. Submit the form.
- **Expected result:**
  - API responds with a JWT access token and a refresh token.
  - Browser stores tokens (httpOnly cookie or memory — per implementation).
  - User is redirected to `/board`.

#### TC-01-02 · Failed login — wrong password (US-01)
- **Type:** Integration + E2E
- **Priority:** P0
- **Steps:**
  1. POST `/auth/login` with a valid username and an incorrect password.
- **Expected result:**
  - API returns HTTP 401.
  - Response body contains `"Invalid credentials"`.
  - No token is issued.
  - UI displays the error message inline on the form.

#### TC-01-04 · Protected route redirect when unauthenticated (US-01)
- **Type:** E2E
- **Priority:** P0
- **Steps:**
  1. Clear all session tokens.
  2. Navigate directly to `/board`, `/tickets/42`, and `/dashboard`.
- **Expected result:**
  - All three routes redirect to `/login`.
  - No protected content is rendered even momentarily (no flash of content).

#### TC-02-01 · Create ticket with required fields only (US-02 — Happy Path)
- **Type:** Integration + E2E
- **Priority:** P0
- **Preconditions:** User is authenticated.
- **Steps:**
  1. POST `/tickets` with `title` (60 chars), `status: "To Do"`, `priority: "Medium"`.
- **Expected result:**
  - API returns HTTP 201.
  - Response body includes `createdBy` set to the authenticated user's ID.
  - `createdAt` and `updatedAt` are non-null ISO timestamps.
  - Ticket is visible on the board.

#### TC-02-04 · Title exceeds maximum boundary — 121 chars (US-02)
- **Type:** Integration + E2E
- **Priority:** P0
- **Steps:**
  1. Attempt to submit a ticket with a 121-character title via the UI form.
  2. Also POST directly to `/tickets` with a 121-character title.
- **Expected result:**
  - UI: inline validation error shown before submit; form does not call the API.
  - API: HTTP 422 with a message referencing the 120-character limit.
  - No ticket row is created in the database.

#### TC-02-05 · Create ticket with missing required title (US-02)
- **Type:** Integration
- **Priority:** P0
- **Steps:**
  1. POST `/tickets` with `title` omitted or empty string.
- **Expected result:**
  - HTTP 422. No ticket created.

#### TC-02-07 · Unauthenticated ticket creation blocked (US-02)
- **Type:** Integration
- **Priority:** P0
- **Steps:**
  1. POST `/tickets` with no Authorization header.
- **Expected result:**
  - HTTP 401. No ticket created.

#### TC-03-01 · Clean save increments version (US-03 — Happy Path)
- **Type:** Integration
- **Priority:** P0
- **Preconditions:** Ticket #42 exists at version 3.
- **Steps:**
  1. PATCH `/tickets/42` with `{ version: 3, title: "Updated" }`.
- **Expected result:**
  - HTTP 200.
  - Response shows `version: 4`.
  - `updatedAt` timestamp is newer than before.

#### TC-03-02 · Stale version from a different user triggers 409 (US-03)
- **Type:** Integration
- **Priority:** P0
- **Preconditions:** Two sessions: User A and User B; ticket at version 3.
- **Steps:**
  1. User B PATCHes with `version: 3` → succeeds, ticket now at version 4.
  2. User A PATCHes with `version: 3` (stale).
- **Expected result:**
  - HTTP 409.
  - Response body includes the ID/name of the user who last updated the ticket (User B).
  - Ticket remains at version 4 in the database.

#### TC-03-03 · Conflict warning renders correctly in UI — multi-user (US-03)
- **Type:** E2E
- **Priority:** P0
- **Steps:**
  1. Simulate TC-03-02 via two browser contexts in Playwright.
- **Expected result:**
  - User A sees a non-dismissible banner: *"This ticket was updated by [User B] while you were editing. Review their changes before saving."*
  - Banner has no close/dismiss button.

#### TC-EC01-03 · Refresh token still valid — silent token exchange, no interruption (EC-01)
- **Type:** Integration + E2E
- **Priority:** P0
- **Steps:**
  1. Let the access token expire (mock short TTL in test env).
  2. Keep the refresh token valid.
  3. User clicks Save.
- **Expected result:**
  - The HTTP interceptor silently POSTs to `/auth/refresh`.
  - The original save request is retried with the new access token.
  - No error, no redirect, no draft written to `localStorage`.
  - User sees the ticket save succeed normally.

#### TC-EC02-04 · No false-positive conflict when only one tab is open (EC-02)
- **Type:** E2E
- **Priority:** P0
- **Steps:**
  1. Open ticket #42 in a single tab.
  2. Save a change.
- **Expected result:**
  - HTTP 200. No conflict warning of any kind is shown.

#### TC-R01-01 · Parallel 401s do not log the user out — refresh mutex (R-01)
- **Type:** Integration + E2E
- **Priority:** P0
- **Preconditions:** Access token is expired; refresh token is valid.
- **Steps:**
  1. Trigger 5 concurrent API calls (simulating TanStack Query page load) while the access token is expired.
- **Expected result:**
  - Exactly one `POST /auth/refresh` is sent to the server.
  - All 5 original requests are retried with the new access token and succeed.
  - User is NOT redirected to `/login`.
  - No duplicate refresh calls appear in the network log.

#### TC-R01-02 · All tokens expired under parallel requests logs the user out once (R-01)
- **Type:** E2E
- **Priority:** P0
- **Steps:**
  1. Expire both access and refresh tokens.
  2. Trigger 5 concurrent API calls.
- **Expected result:**
  - The refresh mutex fires one `POST /auth/refresh`, which returns 401.
  - User is redirected to `/login` exactly once.
  - No additional refresh calls are made by the queued requests after the mutex resolves.

---

### P1 — Must Fix Before Release

---

#### TC-01-03 · Failed login — unknown username (US-01)
- **Type:** Integration
- **Priority:** P1
- **Steps:**
  1. POST `/auth/login` with a username that does not exist.
- **Expected result:**
  - API returns HTTP 401 with the same generic `"Invalid credentials"` message (no user enumeration).

#### TC-01-05 · Protected route accessible after login (US-01)
- **Type:** E2E
- **Priority:** P1
- **Steps:**
  1. Log in with valid credentials.
  2. Navigate directly to `/board`.
- **Expected result:**
  - Board renders without redirect.

#### TC-02-02 · Create ticket with all optional fields (US-02)
- **Type:** Integration
- **Priority:** P1
- **Steps:**
  1. POST `/tickets` with all fields populated: markdown description, assignee ID, labels `["frontend", "bug"]`.
- **Expected result:**
  - HTTP 201.
  - All fields are returned in the response and persist on subsequent GET.
  - Markdown in description is stored as raw markdown (not rendered server-side).

#### TC-02-03 · Title at maximum boundary — 120 chars (US-02)
- **Type:** Integration
- **Priority:** P1
- **Steps:**
  1. POST `/tickets` with a title of exactly 120 characters.
- **Expected result:**
  - HTTP 201. Ticket created successfully.

#### TC-02-06 · Default values applied when status/priority omitted (US-02)
- **Type:** Integration
- **Priority:** P1
- **Steps:**
  1. POST `/tickets` with only `title` provided.
- **Expected result:**
  - Response shows `status: "To Do"` and `priority: "Medium"`.

#### TC-03-04 · Version field missing from PATCH request (US-03)
- **Type:** Integration
- **Priority:** P1
- **Steps:**
  1. PATCH `/tickets/42` without a `version` field.
- **Expected result:**
  - HTTP 422. Server rejects the request; no update applied.

#### TC-EC01-01 · Both tokens expired — draft saved to localStorage (EC-01)
- **Type:** E2E
- **Priority:** P1
- **Preconditions:** User is on the ticket edit page with unsaved changes.
- **Steps:**
  1. Expire both the access token and refresh token (manipulate token TTL in test env or mock the auth interceptor to return 401 with no valid refresh).
  2. User clicks Save.
- **Expected result:**
  - Before any navigation, the current draft is written to `localStorage` under a key scoped to the ticket ID.
  - User is redirected to `/login`.
  - After successful login, a banner is shown: *"You have an unsaved draft for ticket #42. Resume editing?"*

#### TC-EC01-02 · Banner links back to the correct ticket with draft restored (EC-01)
- **Type:** E2E
- **Priority:** P1
- **Steps:**
  1. Reproduce TC-EC01-01 through the redirect and re-login.
  2. Click the "Resume editing" link in the banner.
- **Expected result:**
  - User is taken to ticket #42 in edit mode.
  - All draft field values are pre-populated from `localStorage`.
  - The draft entry is cleared from `localStorage` once the user either saves successfully or explicitly discards.

#### TC-EC01-04 · Draft is scoped per ticket — no cross-ticket bleed (EC-01)
- **Type:** Unit
- **Priority:** P1
- **Steps:**
  1. Write a draft for ticket #42 to `localStorage`.
  2. Navigate to ticket #99.
- **Expected result:**
  - No resume-draft banner is shown on ticket #99.
  - `localStorage` key for ticket #42 is unaffected.

#### TC-EC02-01 · Same-user tab conflict shows tab-specific warning (EC-02)
- **Type:** E2E
- **Priority:** P1
- **Preconditions:** Same user authenticated; ticket #42 at version 3.
- **Steps:**
  1. Open ticket #42 in Tab 1 and Tab 2 (both read version 3).
  2. Save a change in Tab 1 → version becomes 4.
  3. Attempt to save a different change in Tab 2 with version 3.
- **Expected result:**
  - API returns HTTP 409.
  - Tab 2 shows: *"You saved this ticket in another tab. Reload to see the latest version before saving."*
  - The generic multi-user conflict message is NOT shown.

#### TC-EC02-02 · Correct conflict message discrimination — same user vs. different user (EC-02)
- **Type:** Integration
- **Priority:** P1
- **Steps:**
  1. Trigger a 409 where the `lastUpdatedBy` user ID equals the requesting user's ID (same-user case).
  2. Trigger a 409 where they differ (multi-user case).
- **Expected result:**
  - API response or frontend logic correctly distinguishes between the two cases.
  - Each case maps to the correct UI message string.

#### TC-EC02-03 · Reload after same-user tab conflict discards Tab 2 draft (EC-02)
- **Type:** E2E
- **Priority:** P1
- **Steps:**
  1. Reproduce TC-EC02-01 to reach the conflict warning in Tab 2.
  2. Click "Reload" in the conflict warning.
- **Expected result:**
  - Ticket reloads at version 4.
  - Tab 2 draft changes are discarded.
  - No conflict warning is shown after reload.

#### TC-R02-01 · Simultaneous PATCHes at the same version — only one succeeds (R-02)
- **Type:** Integration
- **Priority:** P1
- **Preconditions:** Ticket #42 at version 5.
- **Steps:**
  1. Fire two concurrent PATCH requests for ticket #42, both with `version: 5`, using different field values.
- **Expected result:**
  - Exactly one request returns HTTP 200 and the ticket is saved at version 6.
  - The other request returns HTTP 409.
  - No silent overwrite occurs; the database contains only one of the two edits.

#### TC-R02-02 · Atomic SQL update returns 0 rows on version mismatch (R-02)
- **Type:** Integration
- **Priority:** P1
- **Steps:**
  1. PATCH `/tickets/42` with a `version` value that is 2 steps behind the current version (e.g., send version 3 when DB is at version 5).
- **Expected result:**
  - HTTP 409 returned immediately.
  - Zero rows updated in the database (verified via a subsequent GET).

#### TC-R03-01 · Deleted user's token is rejected immediately (R-03)
- **Type:** Integration
- **Priority:** P1
- **Preconditions:** User X is authenticated and holds a valid access token.
- **Steps:**
  1. Admin deletes User X via `DELETE /users/:id`.
  2. User X immediately sends `GET /tickets` using their still-valid access token.
- **Expected result:**
  - HTTP 401 returned.
  - Request is not processed.
  - User X's token JTI is present in the denylist.

#### TC-R03-02 · Deleted user's refresh token is also rejected (R-03)
- **Type:** Integration
- **Priority:** P1
- **Steps:**
  1. Admin deletes User X.
  2. User X attempts `POST /auth/refresh` with their refresh token.
- **Expected result:**
  - HTTP 401 returned.
  - No new token pair is issued.

#### TC-R03-03 · Tickets owned or assigned to deleted user become Unassigned (R-03)
- **Type:** Integration
- **Priority:** P1
- **Steps:**
  1. User X is the assignee and creator of tickets #10 and #11.
  2. Admin deletes User X.
  3. GET `/tickets/10` and `/tickets/11`.
- **Expected result:**
  - Both tickets return `assignee: null`.
  - `createdBy` reference is preserved (or resolved to a tombstone display name) — data is not deleted.

---

### P2 — Must Fix; Workaround Acceptable

---

#### TC-R04-01 · Duplicate comment submission is idempotent (R-04)
- **Type:** Integration
- **Priority:** P2
- **Steps:**
  1. POST `/tickets/42/comments` twice with the identical `idempotencyKey` and body.
- **Expected result:**
  - HTTP 201 on the first call; HTTP 200 (or 201 with the same resource) on the second.
  - Exactly one comment row exists in the database.
  - Resend is called exactly once.

#### TC-R04-02 · Resend API timeout does not fail the comment POST (R-04)
- **Type:** Integration
- **Priority:** P2
- **Steps:**
  1. Mock the Resend API to time out after 100ms.
  2. POST a comment with a valid @mention.
- **Expected result:**
  - HTTP 201 is returned; the comment is persisted.
  - The email notification is queued for background delivery (not lost).
  - No 500 error is surfaced to the caller.

#### TC-R04-03 · @mention email is delivered exactly once under normal conditions (R-04)
- **Type:** Integration
- **Priority:** P2
- **Steps:**
  1. POST a comment mentioning @Sofia (no retries, no network issues).
- **Expected result:**
  - Exactly one email is dispatched to Sofia's address.
  - Resend call count equals 1 (verified via mock/spy).

#### TC-R05-01 · CSV export with date range exceeding 12 months is rejected (R-05)
- **Type:** Integration
- **Priority:** P2
- **Steps:**
  1. GET `/dashboard/export?from=2020-01-01&to=2026-04-20`.
- **Expected result:**
  - HTTP 400 with message: "Export range cannot exceed 12 months."
  - No CSV is generated; no DB query is executed.

#### TC-R05-02 · CSV export within 12-month range streams correctly (R-05)
- **Type:** Integration
- **Priority:** P2
- **Steps:**
  1. GET `/dashboard/export` with a valid 12-month range.
- **Expected result:**
  - Response uses `Transfer-Encoding: chunked` or `Content-Type: text/csv` with streaming.
  - First byte is received within 500ms (no full in-memory build before send).
  - CSV contains all required columns: Month, Tickets Created, Tickets Closed, Tickets Archived, Open by Status.

#### TC-R05-03 · CSV export does not degrade concurrent API response times (R-05)
- **Type:** Integration
- **Priority:** P2
- **Steps:**
  1. Trigger a CSV export for a 12-month range.
  2. Simultaneously send 10 `GET /tickets` requests.
- **Expected result:**
  - All 10 ticket requests complete within their normal SLA (< 200ms p95).
  - The export does not visibly delay or block other responses.

---

---

## 7. Regression Checklist

Run after any change to auth middleware, ticket controller, or optimistic locking logic:

- [ ] TC-01-01 — Login happy path
- [ ] TC-01-04 — Unauthenticated redirect
- [ ] TC-02-01 — Ticket creation happy path
- [ ] TC-02-04 — Title length validation
- [ ] TC-03-01 — Clean save increments version
- [ ] TC-03-02 — Stale version returns 409
- [ ] TC-EC01-03 — Silent token refresh
- [ ] TC-EC02-04 — No false-positive conflict (single tab)
- [ ] TC-R01-01 — Parallel 401s do not log the user out (refresh mutex)
- [ ] TC-R02-01 — Simultaneous PATCHes — only one succeeds
- [ ] TC-R03-01 — Deleted user token rejected immediately

---

## 8. Defect Severity Matrix

| Severity | Definition | Examples from this plan |
|---|---|---|
| S1 — Blocker | Feature completely broken; no workaround | TC-01-01, TC-01-04, TC-02-01, TC-03-02 |
| S2 — Critical | Core behavior wrong but partial workaround exists | TC-02-04, TC-03-03, TC-EC01-01 |
| S3 — Major | Edge case fails; main flow unaffected | TC-EC01-02, TC-EC02-01, TC-EC02-02 |
| S4 — Minor | Cosmetic or copy issue | Wrong warning message string |

---

## 9. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Token TTL hard to control in E2E tests | High | Medium | Expose a test-only endpoint to invalidate tokens, or use clock mocking in Playwright |
| Two-tab simulation is flaky in CI | Medium | Medium | Run tab-conflict tests in a dedicated retry-enabled job; flag as non-blocking until stable |
| Staging DB not reset between runs causing version drift | Medium | High | Reset fixture tickets to a known version in the `beforeEach` hook of each optimistic locking test |
| Draft `localStorage` key collision across environments | Low | Low | Namespace the key: `draft:{env}:{ticketId}` |
| Parallel request simulation non-deterministic in CI | Medium | Medium | Use a controlled HTTP mock that artificially delays responses to guarantee simultaneity |
| Resend mock not available in integration env | Medium | Medium | Inject a no-op email adapter in test env; assert on queued job count, not actual delivery |
| CSV streaming response hard to assert in Supertest | Low | Low | Use a custom response collector or pipe to a writable stream; assert on chunk count > 1 |
