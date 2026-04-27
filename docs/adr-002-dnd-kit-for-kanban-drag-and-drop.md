# ADR-002 — Use @dnd-kit for Kanban Drag-and-Drop

**Status:** Accepted  
**Date:** 2026-04-22  
**Deciders:** jfbarrios2608@gmail.com (Frontend Architect)

---

## Context

The Kanban board requires drag-and-drop to move tickets between status columns (`to_do`, `in_progress`, `in_review`, `done`, `blocked`). The interaction is cross-column only — no reordering within the same column is required in v1.

Several constraints shaped this decision:

- **Optimistic UI is a hard requirement.** `onDragEnd` must update the TanStack Query cache immediately, issue `PATCH /tickets/:id` in the background, and roll back on failure (HTTP 409 or network error). The library must not own or interfere with server state.
- **Design system control.** The "Lucid Efficiency" design system defines specific surface tokens, ambient shadows, and transition rules. Any library that imposes its own visual styles requires overriding them — a maintenance liability.
- **Desktop-first in v1.** The spec explicitly excludes mobile. Touch sensor support is not a criterion for this decision.
- **React 19 compatibility.** The frontend runs React 19.2.x. The chosen library must be compatible without warnings or workarounds.
- **Bundle size.** The library must not add unnecessary weight. It is already part of the installed dependency tree.

---

## Options Considered

### Option A — @dnd-kit (chosen)

A modular, headless drag-and-drop toolkit for React. Composed of three packages: `@dnd-kit/core` (sensors, context, collision detection), `@dnd-kit/sortable` (list reordering primitives), and `@dnd-kit/utilities` (CSS transform helpers).

### Option B — @hello-pangea/dnd

A community fork of the abandoned `react-beautiful-dnd`, maintained by the Pangea organization. Provides a higher-level API with built-in animations (`DragDropContext → Droppable → Draggable`). Explicitly declares React 19 as a supported peer dependency.

### Option C — react-dnd

A low-level, backend-agnostic DnD library built on the HTML5 Drag and Drop API. Uses a provider + `useDrag` / `useDrop` hook model. Last published June 2022 — effectively unmaintained.

### Option D — HTML5 Drag and Drop API (native)

The browser-native drag-and-drop primitive. Zero bundle cost, but requires manual implementation of hit detection, ghost image customization, accessibility, and cross-browser quirks.

---

## Comparison

| Criterion | @dnd-kit | @hello-pangea/dnd | react-dnd | HTML5 native |
|---|---|---|---|---|
| React 19 compatibility | ✅ (`peerDeps: >=16.8`) | ✅ Explicit (`^18 \|\| ^19`) | ⚠️ Untested — last release 2022 | ✅ |
| Last published | Dec 2024 | Feb 2025 | Jun 2022 ❌ | N/A |
| Additional bundle cost | **0 KB** (already installed) | +~1.2 MB unpacked | +~1.4 MB unpacked | 0 KB |
| `DragOverlay` (portal-based preview) | ✅ Built-in | ❌ No equivalent | ❌ No equivalent | ❌ |
| Animation control | ★★★★★ Fully custom | ★★★☆☆ Built-in, hard to override | ★★☆☆☆ Minimal | ★☆☆☆☆ None |
| Headless (no imposed styles) | ✅ | ⚠️ Injects placeholder styles | ✅ | ✅ |
| Cross-column DnD API | `useDraggable` + `useDroppable` | `Droppable` + `Draggable` | `useDrag` + `useDrop` | Manual |
| Accessibility (keyboard + ARIA) | ✅ First-class | ✅ Good | ❌ Manual | ❌ Manual |
| Optimistic UI compatibility | ✅ Stateless — does not own data | ✅ | ✅ | ✅ |
| Active maintenance | ✅ | ✅ | ❌ | N/A |

---

## Decision

**@dnd-kit** (`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`) is confirmed as the drag-and-drop solution for the Kanban board.

The decisive factor is the `DragOverlay` component. Because it renders the dragged ticket in a React portal at the document root, the drag preview is never clipped by `overflow: hidden` on column containers, has no z-index conflicts, and benefits from GPU-accelerated transforms throughout the drag gesture. No other evaluated option provides this capability.

Beyond `DragOverlay`, @dnd-kit is headless by design — it applies no styles and owns no visual state. This is the correct fit for a project with a strict design system: drop-zone highlighting (`bg-surface_container_high`), shadow tokens (`shadow-ambient`), and transition durations are applied entirely in component code without fighting library defaults.

@hello-pangea/dnd was the strongest alternative. Its explicit React 19 peer dependency declaration and February 2025 release are advantages. However, its placeholder animation system injects inline styles that conflict with the project's surface-tier layout model, and it has no portal-based drag preview. The migration cost (removing 3 packages, rewriting all DnD integration code) is not justified by the gain.

---

## Implementation Notes

For cross-column-only drag (v1 requirement), the recommended primitive composition is:

- `DndContext` wraps `KanbanBoard` — owns sensors, collision detection, and `onDragEnd`.
- `useDroppable` on each `KanbanColumn` — receives the dragged ticket and highlights via `isOver`.
- `useDraggable` on each `TicketCard` — initiates drag, exposes `transform` for live position.
- `DragOverlay` renders the floating ticket preview during drag.
- `@dnd-kit/sortable` is available for within-column reordering if required in a future version.

`onDragEnd` sequence (per spec):
1. Optimistic cache update via TanStack Query `queryClient.setQueryData`.
2. Issue `PATCH /tickets/:id` with `{ status, version }`.
3. On error: roll back via `onError` callback.
4. On HTTP 409: display conflict banner per the exact UI strings in CLAUDE.md.

---

## Consequences

### Positive

- Zero bundle impact — the library is already installed and tree-shaken.
- `DragOverlay` produces a portal-rendered drag ghost that floats freely over column boundaries without z-index or overflow constraints.
- Full control over every visual state (idle, dragging, over valid target, over invalid target) using the project's own design tokens.
- Keyboard navigation and ARIA announcements are built into `DndContext` — accessibility is not an afterthought.
- `@dnd-kit/sortable` is available in the dependency tree if within-column reordering is added in v2 without installing anything new.

### Negative

- More boilerplate than @hello-pangea/dnd. Drop-zone highlighting, overlay rendering, and collision strategy must be wired explicitly rather than inherited from the library.
- Animation on drop (ticket "snapping" into the new column) requires manual CSS transitions; it is not provided automatically.

### Risks & Mitigations

| Risk | Mitigation |
|---|---|
| @dnd-kit v6 has an open React 19 Strict Mode double-invocation issue (sensors fire twice in dev) | Only affects development mode. Has no production impact. Monitor the upstream repository for a patch in v7. |
| Library goes unmaintained | @hello-pangea/dnd is a validated fallback with an explicit React 19 peer dep. Migration path is mechanical (replace context/hook names). |
| Complex collision detection needed if columns are dense | @dnd-kit ships `closestCenter`, `closestCorners`, and `rectIntersection` strategies — select per column layout at integration time. |
