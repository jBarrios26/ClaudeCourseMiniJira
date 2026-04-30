# Frontend API Integration

**Date:** 2026-04-29
**Scope:** `frontend/src/shared/api/` · `frontend/src/features/tickets/` · `frontend/src/features/board/` · `frontend/src/features/auth/` · `backend/src/index.ts`
**Status:** Implemented ✅

---

## What was built

Wired the frontend to the real backend. All ticket-related data flows — fetching, creating, updating, archiving, restoring, and comments — now call the Express API instead of returning mock data. The `axiosInstance` with its auth/refresh interceptor is the single HTTP client across all calls.

---

## Phase 1 — CORS fix

**File:** `backend/src/index.ts`

Added `credentials: true` to the existing `cors()` call:

```ts
// Before
app.use(cors({ origin: process.env.FRONTEND_URL }));

// After
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
```

`FRONTEND_URL=http://localhost:5173` was already set in `backend/.env`. Without `credentials: true`, the browser blocked every request because `axiosInstance` sends `withCredentials: true` for the httpOnly refresh-token cookie.

---

## Phase 2 — Typed API layer

**File:** `src/shared/api/api.ts` (new)

Central module with one typed function per endpoint. All functions use the existing `axiosInstance` (auth header + refresh mutex included automatically).

### Adapter pattern

The backend returns snake_case with Unix timestamps (integers); the frontend types use camelCase with ISO strings. Two private adapters handle the full conversion:

| Backend field | Frontend field | Conversion |
|---|---|---|
| `created_at: 1714000000` | `createdAt: "2024-04-25T..."` | `new Date(n * 1000).toISOString()` |
| `archived_at: number \| null` | `archivedAt: string \| null` | same |
| `updated_at` | `updatedAt` | same |
| `id: 1` (integer) | `id: "1"` (string) | `String(n)` |
| `created_by` | `createdBy` | rename |
| `assignee_id` | `assigneeId` | rename |
| `is_archived` | — | used only to derive `archivedAt` |
| `label_ids` (request) | `labelIds` | camelCase → snake_case on send |
| `assignee_id` (request) | `assigneeId` | camelCase → snake_case on send |

### Functions exposed

| Function | Method | Endpoint |
|---|---|---|
| `login(email, password)` | POST | `/auth/login` |
| `fetchTickets(filters?)` | GET | `/tickets` |
| `fetchTicket(id)` | GET | `/tickets/:id` |
| `createTicket(payload)` | POST | `/tickets` |
| `updateTicket(id, payload)` | PATCH | `/tickets/:id` |
| `archiveTicket(id)` | PATCH | `/tickets/:id/archive` |
| `restoreTicket(id)` | PATCH | `/tickets/:id/restore` |
| `fetchComments(ticketId)` | GET | `/tickets/:id/comments` |
| `createComment(ticketId, body)` | POST | `/tickets/:id/comments` |

`updateTicket` always includes the required `version` field for optimistic locking. On 409 the axios error propagates to the mutation's `onError` for the UI to handle.

### endpoints.ts changes

Added `archive` and `restore` to the tickets entry:

```ts
tickets: {
  list: '/tickets',
  detail: (id) => `/tickets/${id}`,
  archive: (id) => `/tickets/${id}/archive`,   // new
  restore: (id) => `/tickets/${id}/restore`,   // new
  comments: (id) => `/tickets/${id}/comments`,
}
```

---

## Phase 3 — Hook migration

Replaced raw `fetch` calls (no auth headers, manual param serialization) with the typed functions from `api.ts`.

### Updated hooks

**`features/board/useBoardTickets.ts`**
- Removed: 12-object `MOCK_TICKETS` array and the `import.meta.env.DEV` branch in `queryFn`
- Now: `queryFn: () => fetchTickets(filters)`
- Kept: `MOCK_MEMBERS` (7 users) — still consumed by `BoardPage` and `useMembers`

**`features/tickets/useUpdateTicket.ts`**
- Removed: DEV mock branch with `setTimeout`, manual `setQueriesData` cache patch, raw `fetch`
- Now: `mutationFn` calls `updateTicket(id, payload)` directly; `onSuccess` calls `invalidateQueries`

**`features/tickets/useCreateTicket.ts`**
- Removed: DEV mock branch with `crypto.randomUUID()` ticket construction, raw `fetch`
- Now: `mutationFn` calls `createTicket(payload)` directly; `onSuccess` calls `invalidateQueries`

### New hooks

| File | Type | Query key | Invalidates |
|---|---|---|---|
| `useArchiveTicket.ts` | `useMutation` | — | `['tickets']` |
| `useRestoreTicket.ts` | `useMutation` | — | `['tickets']` |
| `useComments.ts` | `useQuery` | `['comments', ticketId]` | — |
| `useCreateComment.ts` | `useMutation` | — | `['comments', ticketId]` |

`useComments` has `enabled: !!ticketId` to avoid firing before a ticket is selected.

---

## Phase 4 — Login form

**File:** `features/auth/LoginPage.tsx`

The "Entrar" button had a hardcoded `disabled` attribute and the form's `onSubmit` was `e.preventDefault()` with no further logic.

Changes:
- Controlled inputs for `email` and `password`
- `handleSubmit` calls `login(email, password)` → `setAuth(user, token)` → navigate to `/board`
- `loading` state disables inputs and button, changes label to "Entrando…"
- On 401: shows `"Invalid credentials"` (exact string from CLAUDE.md)
- DEV bypass panel (login as mock user) left untouched

---

## File map

```
backend/src/
└── index.ts                          ← credentials: true added to cors()

frontend/src/
├── shared/api/
│   ├── api.ts                        ← new: all typed API functions + adapters
│   └── endpoints.ts                  ← archive + restore routes added
└── features/
    ├── auth/
    │   └── LoginPage.tsx             ← form wired to login()
    ├── board/
    │   └── useBoardTickets.ts        ← MOCK_TICKETS removed, calls fetchTickets()
    └── tickets/
        ├── useUpdateTicket.ts        ← calls updateTicket(), mock removed
        ├── useCreateTicket.ts        ← calls createTicket(), mock removed
        ├── useArchiveTicket.ts       ← new
        ├── useRestoreTicket.ts       ← new
        ├── useComments.ts            ← new
        └── useCreateComment.ts       ← new
```

---

## Key decisions

| Decision | Choice | Reason |
|---|---|---|
| Single adapter layer | Private `toTicket` / `toUser` / `toComment` in `api.ts` | Keeps snake_case↔camelCase conversion in one place; hooks and components only see frontend types |
| `id` as string | `String(raw.id)` on every adapter | Frontend types use `string`; avoids type mismatches across the whole component tree |
| `invalidateQueries` on mutations | Always refetch after write | Ensures cache reflects real DB state; avoids stale version numbers that would cause spurious 409s |
| `MOCK_MEMBERS` kept | Not removed | Still referenced by `BoardPage` (avatar stack) and `useMembers` (admin page); removing it would break the UI |
| `credentials: true` on CORS | Required | `axiosInstance` sends `withCredentials: true` for the httpOnly refresh-token cookie; browser blocks credentialed requests unless the server explicitly opts in |
