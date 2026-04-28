# Backend Specs — Mini Jira
**Version:** 1.0  
**Date:** 2026-04-27  
**Stack:** Node.js 20 LTS · Express 5 · Drizzle ORM · SQLite · JWT

---

## 1. Overview

REST API for the Mini Jira internal ticket-management tool. Serves the React frontend on `http://localhost:5173`. All responses use `application/json`. Auth is JWT (single token, no refresh). All protected routes require `Authorization: Bearer <token>`.

Base URL: `http://localhost:3000`

---

## 2. Roles & Access

| Capability | user | admin |
|---|---|---|
| Login | Yes | Yes |
| View active tickets | Yes | Yes |
| Create tickets | Yes | Yes |
| Edit own tickets | Yes | Yes |
| Edit others' tickets | No | Yes |
| Archive own tickets | Yes | Yes |
| Archive others' tickets | No | Yes |
| View archived tickets | No | Yes |
| Restore archived tickets | No | Yes |
| Assign / reassign tickets | Yes | Yes |
| Add comments | Yes | Yes |
| Manage members | No | Yes |
| View dashboard & metrics | Yes | Yes |
| Export CSV | Yes | Yes |

---

## 3. Auth

### `POST /auth/login`
No auth required.

**Request body:**
```json
{ "email": "string", "password": "string" }
```

**Response `200`:**
```json
{
  "token": "string",
  "user": {
    "id": 1,
    "name": "string",
    "email": "string",
    "role": "user | admin"
  }
}
```

**Errors:**
- `400` — missing fields
- `401` — `{ "error": "Invalid credentials" }`

---

## 4. Users (Members)

### `GET /users`
Returns all users. Auth required.

**Response `200`:**
```json
[{ "id": 1, "name": "string", "email": "string", "role": "user | admin", "created_at": 1714000000 }]
```

---

### `GET /users/:id`
Auth required.

**Response `200`:** single user object.  
**Errors:** `404`

---

### `POST /users`
Admin only.

**Request body:**
```json
{ "name": "string", "email": "string", "password": "string", "role": "user | admin" }
```

**Response `201`:** created user (no `password_hash`).  
**Errors:** `400` — validation, `409` — email already exists.

---

### `PATCH /users/:id`
Admin only.

**Request body (all fields optional):**
```json
{ "name": "string", "email": "string", "password": "string", "role": "user | admin" }
```

**Response `200`:** updated user.  
**Errors:** `400`, `404`, `409`

---

### `DELETE /users/:id`
Admin only. Hard delete. All tickets where `assignee_id` or `created_by` equals this user are **not deleted** — `assignee_id` is set to `NULL` (Unassigned). `created_by` is preserved as a foreign key (set null on delete per schema).

**Response `204`:** no body.  
**Errors:** `404`

---

## 5. Tickets

### `GET /tickets`
Auth required. Supports filters via query params.

| Param | Type | Description |
|---|---|---|
| `status` | `to_do\|in_progress\|in_review\|done` | Filter by status |
| `priority` | `low\|medium\|high` | Filter by priority |
| `assignee_id` | integer | Filter by assignee |
| `label_id` | integer | Filter by label |
| `from` | `YYYY-MM-DD` | Created at ≥ |
| `to` | `YYYY-MM-DD` | Created at ≤ |
| `is_archived` | `true\|false` | Default: `false`. Requires admin when `true` |

**Response `200`:**
```json
[{
  "id": 1,
  "title": "string",
  "description": "string | null",
  "status": "to_do",
  "priority": "medium",
  "assignee": { "id": 1, "name": "string" } | null,
  "created_by": { "id": 1, "name": "string" },
  "labels": [{ "id": 1, "name": "string" }],
  "version": 1,
  "is_archived": false,
  "archived_at": null,
  "created_at": 1714000000,
  "updated_at": 1714000000
}]
```

---

### `POST /tickets`
Auth required.

**Request body:**
```json
{
  "title": "string (max 120)",
  "description": "string | null",
  "status": "to_do | in_progress | in_review | done",
  "priority": "low | medium | high",
  "assignee_id": "integer | null",
  "label_ids": [1, 2]
}
```

Defaults: `status = to_do`, `priority = medium`. `created_by` is taken from the JWT.

**Response `201`:** full ticket object.  
**Errors:** `400` — validation (e.g., `"Title must be 120 characters or fewer"`)

---

### `GET /tickets/:id`
Auth required. Returns a single ticket with full detail.

**Response `200`:** full ticket object (same shape as list item).  
**Errors:** `404`

---

### `PATCH /tickets/:id`
Auth required. `version` is **required** for optimistic locking. A regular `user` can only edit their own tickets.

**Request body (all optional except `version`):**
```json
{
  "version": 1,
  "title": "string",
  "description": "string | null",
  "status": "to_do | in_progress | in_review | done",
  "priority": "low | medium | high",
  "assignee_id": "integer | null",
  "label_ids": [1, 2]
}
```

On success: increments `version` by 1, updates `updated_at`.

**Response `200`:** updated ticket.  
**Errors:**
- `400` — missing `version` or validation error
- `403` — user editing another user's ticket
- `404` — ticket not found
- `409` — version conflict: `{ "error": "conflict", "updatedById": 5, "updatedByName": "string" }`

---

### `PATCH /tickets/:id/archive`
Auth required. A regular `user` can only archive their own tickets. Sets `is_archived = true`, `archived_at = now`.

**Request body:** none.  
**Response `200`:** updated ticket.  
**Errors:** `403`, `404`, `409` (if already archived)

---

### `PATCH /tickets/:id/restore`
Admin only. Sets `is_archived = false`, `archived_at = null`.

**Request body:** none.  
**Response `200`:** updated ticket.  
**Errors:** `403`, `404`

---

## 6. Labels

### `GET /labels`
Auth required. Returns all labels.

**Response `200`:** `[{ "id": 1, "name": "string" }]`

---

### `POST /labels`
Auth required.

**Request body:** `{ "name": "string" }`  
**Response `201`:** `{ "id": 1, "name": "string" }`  
**Errors:** `400`, `409` — duplicate name

---

### `DELETE /labels/:id`
Auth required. Removes the label and all `ticket_labels` rows (cascade).

**Response `204`:** no body.  
**Errors:** `404`

---

## 7. Comments

### `GET /tickets/:id/comments`
Auth required. Returns all comments for a ticket, ascending by `created_at`.

**Response `200`:**
```json
[{
  "id": 1,
  "body": "string",
  "author": { "id": 1, "name": "string" } | null,
  "created_at": 1714000000
}]
```

---

### `POST /tickets/:id/comments`
Auth required. Append-only — no edit or delete.

**Request body:** `{ "body": "string" }`  
**Response `201`:** comment object.  
**Errors:** `400` — empty body, `404` — ticket not found

---

## 8. Dashboard

### `GET /dashboard`
Auth required. All values computed in real time from the DB.

**Response `200`:**
```json
{
  "tickets_by_status": {
    "to_do": 4,
    "in_progress": 3,
    "in_review": 1,
    "done": 12
  },
  "closed_per_month": [
    { "month": "2025-05", "count": 7 },
    { "month": "2025-06", "count": 4 }
  ],
  "top_assignees": [
    { "id": 2, "name": "string", "closed_this_month": 5 }
  ]
}
```

`tickets_by_status` counts active (non-archived) tickets only.  
`closed_per_month` covers the last 12 calendar months.  
`top_assignees` covers the current calendar month, top 5.

---

## 9. Metrics

### `GET /metrics`
Auth required. Computes per-month aggregate data in real time.

**Query params:**

| Param | Type | Required | Description |
|---|---|---|---|
| `from` | `YYYY-MM` | Yes | Start month (inclusive) |
| `to` | `YYYY-MM` | Yes | End month (inclusive) |

Max range: 12 months. If exceeded → `400 { "error": "Export range cannot exceed 12 months." }`

**Response `200`:**
```json
[{
  "month": "2025-05",
  "tickets_created": 10,
  "tickets_closed": 7,
  "tickets_archived": 2,
  "open_by_status": {
    "to_do": 3,
    "in_progress": 2,
    "in_review": 1
  }
}]
```

---

### `GET /metrics/export`
Auth required. Same query params as `GET /metrics`.

Returns a CSV file download. Filename: `metrics-{to}.csv` (e.g., `metrics-2025-10.csv`).

**Response headers:**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="metrics-2025-10.csv"
```

**CSV columns:**
```
Month, Tickets Created, Tickets Closed (Done), Tickets Archived, Open To Do, Open In Progress, Open In Review
```

**Errors:** `400` — range exceeds 12 months.

---

## 10. Business Rules

### Optimistic Locking
- Every `PATCH /tickets/:id` must include `version`.
- Server compares incoming `version` against DB value.
- If DB version is ahead → `409` with `updatedById` and `updatedByName`.
- On successful update: `version` incremented by 1.

### Soft Delete (Archive)
- `is_archived = true` hides a ticket from the active board.
- Archived tickets are never physically deleted.
- `GET /tickets?is_archived=true` requires admin role.
- Archive status does **not** count as "closed" — only `status = done` counts for metrics.

### Member Deletion
- Deleting a user sets `assignee_id = NULL` on all their assigned tickets.
- `created_by` is preserved (set null on delete per FK policy).
- Comments by deleted users show `author: null`.

### Comments
- Append-only. No `PATCH` or `DELETE` endpoints for comments.

---

## 11. HTTP Error Shape

All error responses follow:
```json
{ "error": "string" }
```

| Code | Meaning |
|---|---|
| `400` | Validation error |
| `401` | Missing or invalid token |
| `403` | Insufficient role |
| `404` | Resource not found |
| `409` | Conflict (version mismatch or duplicate) |
| `422` | Missing required field (e.g., `version` omitted) |
| `500` | Internal server error |
