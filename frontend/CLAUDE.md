# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
npm run dev          # Vite dev server → http://localhost:5173
npm run build        # tsc -b && vite build
npm run lint         # ESLint
npm run test         # Vitest (unit)
npm run test:ui      # Vitest with browser UI
npm run test:e2e     # Playwright (E2E)
```

---

## Architecture

**Stack:** React 19 · Vite 8 · TypeScript 6 (strict) · React Router v7 · TanStack Query v5 · Zustand v5 · Axios · React Hook Form · Zod v4 · @dnd-kit · Recharts · @uiw/react-md-editor · shadcn/ui · Tailwind CSS v4

**Import alias:** `@/` → `src/`. Always use `@/` — never relative paths crossing feature boundaries.

**Folder structure:**
```
src/
├── app/              # App.tsx (router), providers.tsx
├── components/ui/    # shadcn-generated primitives (Button, Input, Badge, etc.)
├── features/         # One folder per domain: auth, board, tickets, comments, dashboard, admin
├── shared/
│   ├── api/          # axiosInstance.ts (mutex interceptor), endpoints.ts
│   ├── stores/       # authStore.ts, draftStore.ts
│   ├── components/   # AppLayout, ProtectedRoute, AdminRoute, DraftBanner
│   └── types/        # index.ts — all TypeScript types
└── lib/utils.ts      # cn() and helpers
```

Keep feature code inside its feature folder. Only `shared/` is cross-feature. shadcn-generated components belong in `src/components/ui/`, not `src/shared/components/`.

**Env vars** (`.env`): `VITE_API_BASE_URL=http://localhost:3000`, `VITE_ENV=development`

---

## Routing

```
/login            → LoginPage
/board            → BoardPage (KanbanBoard)
/tickets/:id      → BoardPage — same component, ticket detail opens as a modal overlay
/dashboard        → DashboardPage
/admin/members    → AdminMembersPage (AdminRoute guard)
```

`ProtectedRoute` checks `authStore.user`; `AdminRoute` additionally checks `user.role === 'admin'`.

---

## Implementation status (as of 2026-04-22)

**Complete:**
- `features/auth` — `LoginPage` with DEV bypass panel
- `features/board` — `BoardPage`, `BoardToolbar`, `KanbanBoard`, `KanbanColumn`, `TicketCard`, `useBoardTickets`
- `shared/` — `axiosInstance` (mutex refresh), `authStore`, `draftStore`, `AppLayout`, `ProtectedRoute`, `AdminRoute`, `DraftBanner`
- `features/tickets/ticketSchema.ts` — Zod schema for ticket forms

**Stub / not yet implemented:**
- `features/dashboard/DashboardPage.tsx`
- `features/admin/AdminMembersPage.tsx`
- Ticket detail modal (opened via `/tickets/:id`)
- Comments UI
- Filter/search UI on the board

---

## DEV mock pattern

In DEV mode there is no backend. Query hooks branch on `import.meta.env.DEV`:

```ts
queryFn: import.meta.env.DEV
  ? () => Promise.resolve(MOCK_DATA)
  : () => api.get(API.resource.list).then(r => r.data),
```

`MOCK_MEMBERS` and `MOCK_TICKETS` are defined and exported from `features/board/useBoardTickets.ts`. Reuse them across features rather than defining new mock arrays.

---

## Auth / token flow

`axiosInstance.ts` handles all token management:
- Attaches `Authorization: Bearer <token>` from `authStore` on every request
- On 401: uses a mutex to refresh once, queues parallel in-flight requests
- On refresh failure: reads `window.__activeDraft` and passes it to `draftStore.saveDraft()`, clears auth, redirects to `/login`

**Draft capture convention:** any component with an editable ticket form must write its current form state to `window.__activeDraft` on every change so the interceptor can capture it on unexpected session expiry. Set it back to `undefined` on successful save or discard.

---

## Design System — "Lucid Efficiency"

> **Strict rule: NEVER invent or approximate colors. Use ONLY the tokens listed below.**
> If a color is not in this list, it does not exist in this project.

**Font:** Geist Variable (`@fontsource-variable/geist`).

### Color tokens (defined in `src/index.css` under `@theme inline`, consumed via Tailwind)

| Token | Hex | Role |
|---|---|---|
| `surface` | `#f9f9fb` | App canvas — page background |
| `surface_container_low` | `#f2f4f6` | Sidebar, secondary panels |
| `surface_container_lowest` | `#ffffff` | Active cards, main editor, inputs |
| `surface_container_high` | `#e4e9ee` | Hover states on list items |
| `surface_container_highest` | `#dde3e9` | Command palette inner glow |
| `primary` | `#005bbf` | Primary action color |
| `primary_dim` | `#0050a8` | Gradient end for CTAs |
| `primary_container` | `#d7e2ff` | "In Progress" badge background |
| `on_primary` | `#ffffff` | Text on primary backgrounds |
| `on_primary_fixed` | `#003d84` | "In Progress" badge text |
| `outline_variant` | `#acb3b8` | Ghost borders (15–20% opacity only) |
| `inverse_surface` | `#0c0e10` | Pure dark — use instead of black |
| `tertiary_container` | `#69f6b8` | "Done" badge background |
| `on_tertiary_fixed` | `#00452d` | "Done" badge text |
| `error_container` | `#fe8983` | "Blocked" badge background |
| `on_error_container` | `#752121` | "Blocked" badge text |

### Typography

| Scale | Size | Usage |
|---|---|---|
| `display-md` | 2.75rem / tracking `-0.02em` | Project/page titles |
| `label-sm` | 0.6875rem / uppercase / tracking `+0.05em` | Metadata labels (e.g., ISSUE-124) |
| `body-md` | 0.875rem / line-height `1.6` | All body text |

### Layout & depth rules (enforced — no exceptions)

- **No 1px solid borders for sectioning.** Define boundaries only through background color shifts between surface tiers. Use `border` only when required for accessibility, then apply `outline_variant` at 15% opacity (`border-outline_variant/15`).
- **No divider lines between list items.** Use `gap` / vertical whitespace (`1.5rem`) instead.
- **No black (`#000000`).** Use `inverse_surface` (`#0c0e10`) for pure darks.
- **No flat drop shadows.** Use the Ambient Shadow spec: `0px 12px 32px rgba(12, 14, 16, 0.04)` (`shadow-ambient` custom utility).
- **Surface nesting order:** `surface` → `surface_container_low` → `surface_container_lowest`. A white card on a gray section creates the lift without shadows.
- **Glassmorphism** (modals, command palette): `surface_container_lowest` at 80% opacity + `backdrop-blur-[24px]`.
- **Primary button gradient:** `linear-gradient(145deg, #005bbf, #0050a8)` — never a flat fill.
- **Asymmetric padding:** give top and left more breathing room than bottom/right.

---

## Business Rules (enforced at component level)

### Optimistic locking
- Every `PATCH /tickets/:id` **must** include `version`. Omitting it returns 422.
- On HTTP 409: compare `ConflictResponse.updatedById` vs `authStore.user.id`.
  - Same user → `"You saved this ticket in another tab. Reload to see the latest version before saving."` (no dismiss button).
  - Other user → `"This ticket was updated by [name] while you were editing. Review their changes before saving."` (no dismiss button).
- Read `version` from TanStack Query cache — never from separate local state.

### Drag-and-drop
- `DndContext` wraps `KanbanBoard`. Each `KanbanColumn` is a `useDroppable` target whose `id` equals its `TicketStatus` string value.
- `onDragEnd`: optimistic cache update first → `PATCH` → rollback via `.catch()` if it fails.
- No reordering within the same column in v1. Only cross-column status changes.

### Draft preservation
- On refresh token expiry (401 on `/auth/refresh`): save active form state to `draftStore` → clear `authStore` → redirect to `/login`.
- Draft key namespace: `draft:{VITE_ENV}:{ticketId}` (handled by `draftStore` persist config).
- After login: `DraftBanner` shows `"You have an unsaved draft for ticket #[id]. Resume editing?"`.
- Clear draft on successful save or explicit discard.

### Roles
- Admin-only UI: "Show archived" toggle on board, `/admin/members` route.
- `AdminRoute` redirects non-admins to `/board`.
- Never hide the board from a regular user — only gate admin-specific controls.

### Comments
- No edit or delete buttons on `CommentItem`. Append-only.

### Exact UI strings (copy verbatim — do not paraphrase)
| Situation | String |
|---|---|
| 409 other user | `"This ticket was updated by [name] while you were editing. Review their changes before saving."` |
| 409 same user/tab | `"You saved this ticket in another tab. Reload to see the latest version before saving."` |
| Draft banner | `"You have an unsaved draft for ticket #[id]. Resume editing?"` |
| Login error | `"Invalid credentials"` |
| Title too long | `"Title must be 120 characters or fewer"` |
| CSV range exceeded | `"Export range cannot exceed 12 months."` |

---

## Dev Bypass

The `LoginPage` includes a `DEV`-only panel (visible only when `import.meta.env.DEV === true`) that lets you log in as any mock user without a backend. It disappears in production builds.
