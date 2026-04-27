# Board Home — Build Plan Summary

**Date:** 2026-04-22  
**Scope:** `frontend/src/features/board/` + shared layout + design tokens  
**Status:** Implemented ✅

---

## What was built

The Board page (`/board`) went from a one-line placeholder to a fully functional Kanban view with drag-and-drop, mock data, and the complete "Lucid Efficiency" design system applied.

---

## Phases (bottom-up order)

### Phase 0 — Design Token Foundation
**File:** `src/index.css`

Added all 16 "Lucid Efficiency" color tokens to `@theme inline` (surface hierarchy, primary palette, semantic status colors) plus four custom utilities:
- `shadow-ambient` — `0px 12px 32px rgba(12,14,16,0.04)`
- `text-display-md` — 2.75rem / -0.02em tracking
- `text-label-sm` — 0.6875rem / uppercase / +0.05em tracking
- `text-body-md` — 0.875rem / 1.6 line-height

---

### Phase 1 — AppLayout Redesign
**File:** `src/shared/components/AppLayout.tsx`

- Replaced `border-r border-border` with surface tier shift (sidebar = `bg-surface_container_low`, canvas = `bg-surface`) — no 1px lines
- Added Lucide icons to nav links (`LayoutGrid`, `BarChart2`, `Users`)
- Active nav state: `bg-primary_container text-on_primary_fixed`
- Hover state: `bg-surface_container_high`

---

### Phase 2 — TicketCard
**File:** `src/features/board/TicketCard.tsx`

Atomic presentational component:
- Priority badge (`label-sm`, color-coded: high=red, medium=blue, low=gray)
- Ticket ID in `label-sm` uppercase
- Title with `line-clamp-2`
- Footer: comment count icon + assignee avatar (initials fallback)
- `isDragging` prop: `opacity-50 rotate-1`
- "blocked" label → left accent border (only permitted border use)

---

### Phase 3 — KanbanColumn
**File:** `src/features/board/KanbanColumn.tsx`

- `useDroppable` from `@dnd-kit/core` per column
- Status dot color: gray (to_do) / blue (in_progress) / light-blue (in_review) / green (done)
- Drop zone highlight: `bg-surface_container_high` when `isOver`
- Cards separated by `gap-3` — no dividers
- Empty state: "Drop items here" text

---

### Phase 4 — BoardToolbar
**File:** `src/features/board/BoardToolbar.tsx`

- Breadcrumb in `label-sm`
- Title "Sprint Board" in `display-md` (2.75rem)
- Member avatar stack with +N overflow badge
- Filter button (ghost, `outline_variant/20` border)
- New Ticket button (primary gradient `145deg #005bbf → #0050a8`)
- "Show archived" toggle — admin-only

---

### Phase 5 — KanbanBoard + DnD
**File:** `src/features/board/KanbanBoard.tsx`

- `DndContext` with `PointerSensor` (`activationConstraint: { distance: 8 }`) + `KeyboardSensor`
- `DragOverlay` renders floating `TicketCard` during drag (portal — no z-index/overflow issues)
- `onDragEnd`: optimistic cache update → `PATCH /tickets/:id { status, version }` → rollback on error
- Version always read from TanStack Query cache, never from local state

---

### Phase 6 — BoardPage + useBoardTickets
**Files:** `src/features/board/BoardPage.tsx`, `src/features/board/useBoardTickets.ts`

- `useBoardTickets`: DEV mode returns `Promise.resolve(MOCK_TICKETS)` (12 active tickets mirroring `mock.sql`), PROD calls `GET /tickets`
- `MOCK_MEMBERS`: 7 users (2 admin, 5 user) for the avatar stack
- `BoardPage`: loading skeleton (pulse animation), error state, archived filter, composes toolbar + board
- Skeleton: 4 columns with variable card counts, `animate-pulse`

---

## File map

```
src/
├── index.css                              ← Phase 0: design tokens
├── shared/components/AppLayout.tsx        ← Phase 1: layout redesign
└── features/board/
    ├── TicketCard.tsx                     ← Phase 2
    ├── KanbanColumn.tsx                   ← Phase 3
    ├── BoardToolbar.tsx                   ← Phase 4
    ├── KanbanBoard.tsx                    ← Phase 5
    ├── useBoardTickets.ts                 ← Phase 6 (hook + mock data)
    └── BoardPage.tsx                      ← Phase 6 (composition)
```

---

## Key design decisions

| Decision | Choice | Reason |
|---|---|---|
| DnD library | `@dnd-kit` (already installed) | `DragOverlay` portal avoids z-index issues; full animation control |
| Mock data | Inline `Promise.resolve()` in DEV | Same pattern as `LoginPage`; zero extra dependencies |
| No borders | Surface color shifts only | "No-Line Rule" from Lucid Efficiency design system |
| `version` source | TanStack Query cache | Never duplicated in local state — single source of truth |
| Drag activation | `distance: 8px` | Prevents accidental drag on card click |
