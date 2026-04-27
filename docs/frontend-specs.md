# frontend-specs.md — Mini Jira (Frontend)

**Versión:** 1.0  
**Fecha:** 2026-04-22  
**Fuente:** specs.md v1.0, backlog.md v1.0, test-plan.md v1.1, decisiones de equipo (2026-04-22)

---

## 1. Stack y versiones

| Capa | Tecnología | Versión mínima | Notas React 19 |
|---|---|---|---|
| Framework UI | React | 19.x | `ref` como prop directa; sin `forwardRef` |
| Build tool | Vite | 8.x | `@vitejs/plugin-react` ^6 + `@tailwindcss/vite` ^4 |
| Routing | React Router | v7 | `createBrowserRouter` + `RouterProvider` |
| Server state | TanStack Query | v5 | — |
| Client state | Zustand | 5.x | — |
| HTTP client | Axios | 1.x | — |
| Componentes UI | shadcn/ui (Radix + Tailwind CSS) | latest (v4.x) | Tailwind CSS v4 (CSS-based config) |
| Formularios | React Hook Form | 7.x | — |
| Validación de esquemas | Zod | 4.x | API compatible con v3 para los schemas del proyecto |
| Editor/renderizador Markdown | @uiw/react-md-editor | 4.x | — |
| Gráficas | Recharts | 3.x | — |
| Drag-and-drop | @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities | 6.x / 10.x / 3.x | — |
| Testing unitario | Vitest | 4.x | — |
| Testing E2E | Playwright | 1.x | — |
| Lenguaje | TypeScript | 6.x (strict) | `ignoreDeprecations: "6.0"` para alias de path |

---

## 2. Rutas

| Ruta | Acceso | Descripción |
|---|---|---|
| `/login` | Público | Formulario de login. Redirige a `/board` si hay sesión activa. |
| `/board` | Autenticado | Board kanban. Ticket detail y creación abren como modal sobre este fondo. |
| `/tickets/:id` | Autenticado | Renderiza `/board` con el modal del ticket abierto para ese ID. |
| `/dashboard` | Autenticado | Gráficas + date-range picker + botón CSV export. |
| `/admin/members` | Admin | Gestión de miembros del equipo. |

Cualquier ruta protegida sin sesión redirige a `/login` sin mostrar contenido momentáneo.

---

## 3. Autenticación y almacenamiento de tokens

### Flujo de tokens
- **Access token:** almacenado en el `authStore` de Zustand (memoria JS, no persiste a disco).
- **Refresh token:** almacenado como `httpOnly` cookie por el servidor (invisible a JS, protegido de XSS).
- **Al recargar la página:** el SPA llama silenciosamente a `POST /auth/refresh` usando la cookie. Si el servidor responde con un nuevo access token, el `authStore` se repopula. Si responde 401, el usuario va a `/login`.

### Mutex de refresco (R-01)
Implementado en el interceptor de respuesta de Axios:

1. Si una respuesta es 401, se comprueba si hay una renovación en curso (`isRefreshing` flag).
2. Si no hay renovación en curso: se inicia `POST /auth/refresh` y se guarda la promesa.
3. Si ya hay renovación en curso: la petición fallida se encola en `failedQueue`.
4. Cuando la renovación termina, todas las peticiones en cola se reintentan con el nuevo access token.
5. Si la renovación falla (refresh token expirado): se vacía la cola, se limpia `authStore`, y se redirige a `/login` **una sola vez**.

### Draft preservation ante sesión expirada (EC-01)
- Antes de redirigir a `/login`, el SPA serializa el estado actual del formulario y lo guarda en `localStorage` con la clave `draft:{env}:{ticketId}`.
- Tras el login exitoso, el `draftStore` lee `localStorage`, y si existe un draft, muestra el `DraftBanner`.
- El draft se elimina de `localStorage` cuando el usuario guarda exitosamente o descarta explícitamente.

---

## 4. Modelo de datos (tipos TypeScript)

```ts
type UserRole = 'user' | 'admin';
type TicketStatus = 'to_do' | 'in_progress' | 'in_review' | 'done';
type TicketPriority = 'low' | 'medium' | 'high';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  removedAt: string | null;
}

interface Label {
  id: number;
  name: string;
}

interface Ticket {
  id: string;
  title: string;                  // max 120 chars
  description: string | null;     // raw markdown
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId: string | null;
  assignee: User | null;
  createdBy: User | null;         // null si el usuario fue eliminado (ON DELETE SET NULL)
  labels: Label[];
  version: number;                // optimistic lock
  archivedAt: string | null;      // null = activo
  createdAt: string;
  updatedAt: string;
}

interface Comment {
  id: string;
  ticketId: string;
  authorId: string | null;        // null si el autor fue eliminado
  author: User | null;
  body: string;                   // raw markdown, puede contener @mentions
  createdAt: string;
}

interface TicketDraft {
  ticketId: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId: string | null;
  labelIds: number[];
  version: number;
  savedAt: string;
}
```

### Payloads de API relevantes

```ts
// PATCH /tickets/:id — body
interface UpdateTicketPayload {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeId?: string | null;
  labelIds?: number[];
  version: number;              // OBLIGATORIO siempre
}

// 409 Conflict — body
interface ConflictResponse {
  updatedByName: string;        // nombre del usuario que guardó primero
  updatedById: string;          // para detectar same-user conflict (EC-02)
}
```

---

## 5. Zustand stores

### `authStore`
```ts
interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}
```

### `draftStore`
```ts
interface DraftState {
  drafts: Record<string, TicketDraft>;  // keyed by ticketId
  saveDraft: (draft: TicketDraft) => void;
  clearDraft: (ticketId: string) => void;
  getDraft: (ticketId: string) => TicketDraft | undefined;
}
```
`draftStore` usa el middleware `persist` de Zustand con `localStorage` como storage.

---

## 6. Esquemas Zod

### Ticket (formulario de creación y edición)
```ts
const ticketSchema = z.object({
  title: z.string().min(1, 'El título es requerido').max(120, 'Title must be 120 characters or fewer'),
  description: z.string().optional(),
  status: z.enum(['to_do', 'in_progress', 'in_review', 'done']),
  priority: z.enum(['low', 'medium', 'high']),
  assigneeId: z.string().uuid().nullable().optional(),
  labelIds: z.array(z.number()).optional(),
});
```

La validación de `title` se dispara en el cliente antes de llamar a la API. Si el backend devuelve HTTP 422, el error se mapea al campo correspondiente en React Hook Form.

---

## 7. Arquitectura de componentes

### Layout principal (rutas protegidas)
```
AppLayout
├── Sidebar
│   ├── Logo
│   ├── NavLink → /board
│   ├── NavLink → /dashboard
│   └── NavLink → /admin/members   [solo si user.role === 'admin']
└── <Outlet />
```

### Board (`/board`)
```
BoardPage
├── BoardToolbar
│   ├── FilterBar (status, priority, assignee, labels, date range)
│   ├── ToggleArchived [solo admin]   // toggle visible solo si user.role === 'admin'
│   └── Button "Nuevo ticket" → abre TicketModal en modo creación
└── DndContext (de @dnd-kit/core — accesibilidad y eventos globales)
    └── KanbanBoard
        ├── KanbanColumn (To Do)      ← SortableContext por columna
        │   └── TicketCard[]          ← cada card es un <Draggable>
        ├── KanbanColumn (In Progress)
        ├── KanbanColumn (In Review)
        └── KanbanColumn (Done)
```

Cada `TicketCard` muestra: título, prioridad (badge de color), assignee (avatar), labels (chips), y número de comentarios. Al hacer clic, navega a `/tickets/:id` (que abre el `TicketModal`).

### Modal de ticket (`TicketModal`)
```
TicketModal (shadcn Dialog — tamaño lg)
├── ConflictBanner [visible solo si hay 409 activo, no tiene botón de cerrar]
├── TicketForm (React Hook Form)
│   ├── Input: title (max 120, contador de caracteres)
│   ├── Select: status
│   ├── Select: priority
│   ├── Combobox: assignee (busca entre usuarios activos)
│   ├── MultiSelect: labels
│   └── MDEditor: description (@uiw/react-md-editor, modo split o preview)
├── Divider
├── CommentList
│   └── CommentItem[] (avatar, nombre, fecha, body renderizado como markdown)
└── CommentForm
    ├── Textarea (soporta @username, append-only — sin editar ni borrar)
    └── Button "Comentar"
```

En modo **edición**, el botón "Guardar" envía `PATCH /tickets/:id` con el `version` actual. En modo **creación**, envía `POST /tickets`.

### Dashboard (`/dashboard`)
```
DashboardPage
├── DateRangePicker (from / to, máximo 12 meses)
├── BarChartMonthly   (Recharts BarChart — tickets Done por mes)
├── DonutChartStatus  (Recharts PieChart — tickets activos por status)
├── TopAssignees      (tabla: nombre, tickets cerrados este mes)
└── Button "Exportar CSV"
    └── GET /dashboard/export?from=&to= → descarga metrics-YYYY-MM-DD.csv
```

El date-range picker controla tanto las gráficas como el CSV export. El rango por defecto es los últimos 12 meses.

### Admin — Miembros (`/admin/members`)
```
AdminMembersPage
├── MemberTable
│   └── MemberRow[] (nombre, email, rol, estado, botón "Eliminar")
└── InviteMemberButton (si está en scope de v1 — pendiente Open Issue #2)
```

---

## 8. Estructura de carpetas

```
src/
├── app/
│   ├── main.tsx               # punto de entrada, providers
│   ├── App.tsx                # React Router: rutas, ProtectedRoute, AdminRoute
│   └── providers.tsx          # QueryClientProvider, wrappers globales
│
├── features/
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   ├── loginSchema.ts
│   │   └── useLogin.ts        # useMutation → POST /auth/login
│   │
│   ├── board/
│   │   ├── BoardPage.tsx
│   │   ├── KanbanBoard.tsx       # DndContext + columnas
│   │   ├── KanbanColumn.tsx      # SortableContext + DroppableColumn
│   │   ├── TicketCard.tsx        # useSortable (draggable)
│   │   └── FilterBar.tsx
│   │
│   ├── tickets/
│   │   ├── TicketModal.tsx
│   │   ├── TicketForm.tsx
│   │   ├── ticketSchema.ts    # Zod schema
│   │   ├── ConflictBanner.tsx
│   │   ├── useTickets.ts      # useQuery → GET /tickets
│   │   ├── useTicket.ts       # useQuery → GET /tickets/:id
│   │   ├── useCreateTicket.ts # useMutation → POST /tickets
│   │   └── useUpdateTicket.ts # useMutation → PATCH /tickets/:id
│   │
│   ├── comments/
│   │   ├── CommentList.tsx
│   │   ├── CommentForm.tsx
│   │   └── useComments.ts     # useQuery + useMutation
│   │
│   ├── dashboard/
│   │   ├── DashboardPage.tsx
│   │   ├── BarChartMonthly.tsx
│   │   ├── DonutChartStatus.tsx
│   │   ├── TopAssignees.tsx
│   │   └── useDashboard.ts    # useQuery → GET /dashboard/metrics
│   │
│   └── admin/
│       ├── MembersPage.tsx
│       └── useMembers.ts
│
├── shared/
│   ├── api/
│   │   ├── axiosInstance.ts   # instancia Axios + interceptores (mutex)
│   │   └── endpoints.ts       # constantes de rutas de API
│   │
│   ├── stores/
│   │   ├── authStore.ts       # Zustand — user + accessToken
│   │   └── draftStore.ts      # Zustand persist — drafts por ticketId
│   │
│   ├── components/
│   │   ├── ProtectedRoute.tsx # redirige a /login si no hay sesión
│   │   ├── AdminRoute.tsx     # redirige a /board si role !== 'admin'
│   │   ├── DraftBanner.tsx    # "You have an unsaved draft for ticket #X"
│   │   └── AppLayout.tsx      # Sidebar + Outlet
│   │
│   └── types/
│       └── index.ts           # User, Ticket, Comment, Label, enums, payloads
│
└── lib/
    └── utils.ts               # cn(), formatDate(), etc.
```

---

## 9. Reglas de negocio en el frontend

### Optimistic locking
- El `version` del ticket se almacena en el estado del componente al cargar el modal.
- Cada `PATCH` incluye el `version` leído. Si la API devuelve HTTP 409:
  - Se compara `ConflictResponse.updatedById` con `authStore.user.id`.
  - **Mismo usuario:** mostrar `"You saved this ticket in another tab. Reload to see the latest version before saving."` con botón "Recargar" (descarta el draft del tab).
  - **Otro usuario:** mostrar `"This ticket was updated by [updatedByName] while you were editing. Review their changes before saving."` sin botón de cierre.
  - El banner es **no dismissible** — permanece hasta que el usuario recargue o descarte.
- Si el `version` no se incluye en el PATCH, el backend responde 422 (el frontend nunca debe omitirlo).

### Draft preservation (EC-01 / EC-02)
- Cuando el interceptor de Axios detecta que la renovación falló (401 en `/auth/refresh`):
  1. Serializar el estado del formulario activo a `draftStore`.
  2. `draftStore.persist` escribe el draft en `localStorage` bajo la clave `draft:{VITE_ENV}:{ticketId}`.
  3. Limpiar `authStore` y redirigir a `/login`.
- Tras login exitoso, `DraftBanner` verifica `draftStore`. Si hay drafts, muestra la alerta globalmente (encima del board).
- Al navegar al ticket en cuestión, el modal se abre con los campos pre-populados desde el draft.
- El draft se borra de `draftStore` (y por ende de `localStorage`) al guardar exitosamente **o** al hacer clic en "Descartar draft".
- Los drafts están **aislados por `ticketId`** — abriendo otro ticket no se muestra su banner.

### Visibilidad de tickets archivados
- Por defecto, `GET /tickets` omite los archivados (`archivedAt IS NULL`).
- El toggle "Mostrar archivados" en `BoardToolbar` es visible **solo si `user.role === 'admin'`**.
- Cuando el toggle está activo, la query incluye `?archived=true`; los tickets archivados se muestran en todas las columnas con un estilo visual diferenciado (opacidad reducida + badge "Archivado").
- Restaurar un ticket archivado → `PATCH /tickets/:id` con `{ archivedAt: null, version }`.

### Métricas y CSV export
- El `DateRangePicker` del dashboard valida en cliente que el rango no supere 12 meses antes de llamar a la API.
- El botón "Exportar CSV" dispara `GET /dashboard/export?from=&to=` con el rango activo. La respuesta es un stream; el navegador descarga el archivo `metrics-YYYY-MM-DD.csv` directamente.

### Roles y permisos (aplicados en componentes)
| Acción | User | Admin |
|---|---|---|
| Editar ticket propio | ✅ | ✅ |
| Editar ticket ajeno | ❌ (botón Guardar deshabilitado) | ✅ |
| Archivar ticket propio | ✅ | ✅ |
| Ver / restaurar archivados | ❌ | ✅ (toggle en board) |
| Acceder a /admin/members | ❌ (AdminRoute redirige) | ✅ |

### Comentarios
- No hay botones de editar ni borrar en ningún `CommentItem`.
- El formulario de comentarios soporta texto con `@username` (autocompletado opcional en v2).

### Drag-and-drop de tickets entre columnas
- Implementado con `@dnd-kit/core` + `@dnd-kit/sortable`.
- Cada `KanbanColumn` es un `SortableContext`. El `DndContext` vive en `KanbanBoard` y gestiona los eventos `onDragEnd`.
- Al soltar un card en otra columna, `onDragEnd` recibe `active.id` (ticketId) y `over.id` (columnStatus). Si el status cambió:
  1. **Optimistic update:** TanStack Query muta el cache local inmediatamente (el card aparece en la nueva columna).
  2. **PATCH** `/tickets/:id` con `{ status: newStatus, version }`.
  3. Si el PATCH falla (incluido HTTP 409), se hace rollback del cache con `onError` de `useMutation`.
- La versión (`version`) del ticket se lee siempre del cache de TanStack Query al iniciar el drag — nunca se guarda en estado local separado.
- El `Select` de status en el `TicketModal` sigue disponible como alternativa; ambos mecanismos conviven.
- Cualquier transición entre estados es válida (to_do → done es legal).
- No hay reordenación dentro de la misma columna en v1 (solo cambio de columna).

---

## 10. Copias de UI exactas (strings definidos en spec)

| Situación | String exacto |
|---|---|
| 409 — conflicto con otro usuario | `"This ticket was updated by [nombre] while you were editing. Review their changes before saving."` |
| 409 — mismo usuario, otra pestaña | `"You saved this ticket in another tab. Reload to see the latest version before saving."` |
| Banner de draft tras re-login | `"You have an unsaved draft for ticket #[id]. Resume editing?"` |
| Login fallido | `"Invalid credentials"` |
| Validación de título | `"Title must be 120 characters or fewer"` |
| Límite de exportación superado | `"Export range cannot exceed 12 months."` |

---

## 11. Variables de entorno (Vite)

```
VITE_API_BASE_URL=http://localhost:3000   # URL base de la API
VITE_ENV=development                      # usado para namespace de draft keys en localStorage
```

---

## 12. Decisiones pendientes (deben resolverse antes de scaffoldear)

| # | Pregunta | Bloquea |
|---|---|---|
| 1 | Login con username o email (specs dice "username and password" pero el mock usa email) | `loginSchema.ts`, campo de login |
| 2 | ¿La ruta `/tickets/:id` está desacoplada del board o es siempre board + modal? | Configuración de React Router |
| 3 | ¿La creación del primer Admin es por seed o por registro propio? (Open Issue #2) | `AdminMembersPage` — botón de invitar |
